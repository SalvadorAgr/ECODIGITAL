const { getPool } = require('../db');

/**
 * Optimization Engine Service
 * Implements schedule optimization algorithms for appointment scheduling
 * Focuses on utilization maximization and patient wait time minimization
 */
class OptimizationEngine {
    constructor() {
        this.pool = null;

        // Optimization parameters
        this.config = {
            // Weight factors for optimization objectives
            utilizationWeight: 0.6,
            waitTimeWeight: 0.4,

            // Scheduling constraints
            maxDailyAppointments: 20,
            minBufferTimeMinutes: 5,
            maxBufferTimeMinutes: 15,

            // Optimization thresholds
            minUtilizationThreshold: 0.7,
            maxWaitTimeMinutes: 30,

            // Algorithm parameters
            maxIterations: 1000,
            convergenceThreshold: 0.001
        };
    }

    /**
     * Initialize the service with database connection
     */
    initialize() {
        this.pool = getPool();
        if (!this.pool) {
            throw new Error('Database connection not available');
        }
    }

    /**
     * Optimize schedule for a specific provider and date range
     * @param {string} providerId - Provider ID
     * @param {Date} startDate - Start date for optimization
     * @param {Date} endDate - End date for optimization
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization result
     */
    async optimizeSchedule(providerId, startDate, endDate, options = {}) {
        try {
            this.initialize();

            const optimizationOptions = { ...this.config, ...options };

            // Get current schedule data
            const scheduleData = await this.getScheduleData(providerId, startDate, endDate);

            // Analyze current performance
            const currentMetrics = await this.analyzeSchedulePerformance(scheduleData);

            // Generate optimization recommendations
            const recommendations = await this.generateOptimizationRecommendations(
                scheduleData,
                currentMetrics,
                optimizationOptions
            );

            // Apply optimization algorithms
            const optimizedSchedule = await this.applyOptimizationAlgorithms(
                scheduleData,
                recommendations,
                optimizationOptions
            );

            // Calculate improvement metrics
            const improvementMetrics = await this.calculateImprovementMetrics(
                currentMetrics,
                optimizedSchedule
            );

            return {
                success: true,
                data: {
                    providerId,
                    dateRange: { startDate, endDate },
                    currentMetrics,
                    optimizedSchedule,
                    recommendations,
                    improvementMetrics,
                    optimizationScore: this.calculateOptimizationScore(improvementMetrics)
                },
                message: 'Schedule optimization completed successfully'
            };

        } catch (error) {
            console.error('Error optimizing schedule:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to optimize schedule'
            };
        }
    }

    /**
     * Maximize provider utilization for a given time period
     * @param {string} providerId - Provider ID
     * @param {Date} date - Target date
     * @param {Object} constraints - Scheduling constraints
     * @returns {Object} Utilization optimization result
     */
    async maximizeUtilization(providerId, date, constraints = {}) {
        try {
            this.initialize();

            // Get provider's schedule and availability
            const providerSchedule = await this.getProviderSchedule(providerId, date);
            const existingAppointments = await this.getExistingAppointments(providerId, date);
            const availableSlots = await this.calculateAvailableSlots(providerSchedule, existingAppointments);

            // Get pending appointments and waitlist
            const pendingAppointments = await this.getPendingAppointments(providerId);
            const waitlistEntries = await this.getWaitlistEntries(providerId);

            // Apply utilization maximization algorithm
            const utilizationPlan = await this.applyUtilizationMaximization(
                availableSlots,
                pendingAppointments,
                waitlistEntries,
                constraints
            );

            // Calculate utilization metrics
            const utilizationMetrics = this.calculateUtilizationMetrics(
                providerSchedule,
                existingAppointments,
                utilizationPlan.suggestedAppointments
            );

            return {
                success: true,
                data: {
                    providerId,
                    date,
                    currentUtilization: utilizationMetrics.currentUtilization,
                    optimizedUtilization: utilizationMetrics.optimizedUtilization,
                    availableSlots: availableSlots.length,
                    suggestedAppointments: utilizationPlan.suggestedAppointments,
                    utilizationImprovement: utilizationMetrics.improvement,
                    recommendations: utilizationPlan.recommendations
                },
                message: 'Utilization optimization completed successfully'
            };

        } catch (error) {
            console.error('Error maximizing utilization:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to maximize utilization'
            };
        }
    }

    /**
     * Minimize patient wait times through intelligent scheduling
     * @param {string} providerId - Provider ID
     * @param {Date} date - Target date
     * @param {Array} appointmentRequests - List of appointment requests
     * @returns {Object} Wait time optimization result
     */
    async minimizeWaitTimes(providerId, date, appointmentRequests = []) {
        try {
            this.initialize();

            // Get current schedule and calculate wait times
            const currentSchedule = await this.getCurrentSchedule(providerId, date);
            const currentWaitTimes = await this.calculateCurrentWaitTimes(currentSchedule);

            // Apply wait time minimization algorithm
            const optimizedSchedule = await this.applyWaitTimeMinimization(
                currentSchedule,
                appointmentRequests,
                this.config
            );

            // Calculate optimized wait times
            const optimizedWaitTimes = await this.calculateOptimizedWaitTimes(optimizedSchedule);

            // Generate scheduling recommendations
            const recommendations = await this.generateWaitTimeRecommendations(
                currentWaitTimes,
                optimizedWaitTimes,
                optimizedSchedule
            );

            return {
                success: true,
                data: {
                    providerId,
                    date,
                    currentAverageWaitTime: currentWaitTimes.average,
                    optimizedAverageWaitTime: optimizedWaitTimes.average,
                    waitTimeReduction: currentWaitTimes.average - optimizedWaitTimes.average,
                    optimizedSchedule,
                    recommendations,
                    impactedAppointments: optimizedSchedule.modifications
                },
                message: 'Wait time optimization completed successfully'
            };

        } catch (error) {
            console.error('Error minimizing wait times:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to minimize wait times'
            };
        }
    }

    /**
     * Get comprehensive schedule data for optimization
     * @param {string} providerId - Provider ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object} Schedule data
     */
    async getScheduleData(providerId, startDate, endDate) {
        const query = `
            SELECT 
                c.id,
                c.fecha_hora,
                c.duracion_minutos,
                c.tipo_cita,
                c.estado,
                c.tiempo_espera_minutos,
                c.tiempo_consulta_minutos,
                p.id as patient_id,
                p.nombre,
                p.apellido
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            WHERE c.medico_id = $1
            AND c.fecha_hora BETWEEN $2 AND $3
            AND c.activo = TRUE
            ORDER BY c.fecha_hora
        `;

        const { rows } = await this.pool.query(query, [providerId, startDate, endDate]);
        return rows;
    }

    /**
     * Analyze current schedule performance
     * @param {Array} scheduleData - Schedule data
     * @returns {Object} Performance metrics
     */
    async analyzeSchedulePerformance(scheduleData) {
        const totalAppointments = scheduleData.length;
        const completedAppointments = scheduleData.filter(apt => apt.estado === 'COMPLETADA');

        // Calculate utilization metrics
        const totalScheduledMinutes = scheduleData.reduce((sum, apt) => sum + apt.duracion_minutos, 0);
        const totalActualMinutes = completedAppointments.reduce((sum, apt) => sum + (apt.tiempo_consulta_minutos || apt.duracion_minutos), 0);

        // Calculate wait time metrics
        const waitTimes = completedAppointments
            .filter(apt => apt.tiempo_espera_minutos !== null)
            .map(apt => apt.tiempo_espera_minutos);

        const averageWaitTime = waitTimes.length > 0 ?
            waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length : 0;

        // Calculate efficiency metrics
        const onTimeAppointments = completedAppointments.filter(apt => (apt.tiempo_espera_minutos || 0) <= 15);
        const onTimeRate = completedAppointments.length > 0 ?
            onTimeAppointments.length / completedAppointments.length : 0;

        return {
            totalAppointments,
            completedAppointments: completedAppointments.length,
            completionRate: totalAppointments > 0 ? completedAppointments.length / totalAppointments : 0,
            utilization: totalScheduledMinutes > 0 ? totalActualMinutes / totalScheduledMinutes : 0,
            averageWaitTime,
            maxWaitTime: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
            onTimeRate,
            totalScheduledMinutes,
            totalActualMinutes
        };
    }

    /**
     * Generate optimization recommendations based on analysis
     * @param {Array} scheduleData - Schedule data
     * @param {Object} currentMetrics - Current performance metrics
     * @param {Object} options - Optimization options
     * @returns {Array} Optimization recommendations
     */
    async generateOptimizationRecommendations(scheduleData, currentMetrics, options) {
        const recommendations = [];

        // Utilization recommendations
        if (currentMetrics.utilization < options.minUtilizationThreshold) {
            recommendations.push({
                type: 'UTILIZATION',
                priority: 'HIGH',
                title: 'Increase Schedule Utilization',
                description: `Current utilization is ${(currentMetrics.utilization * 100).toFixed(1)}%. Consider adding more appointments or reducing buffer times.`,
                suggestedActions: [
                    'Reduce buffer time between appointments',
                    'Add appointments during low-utilization periods',
                    'Consider shorter appointment durations for routine visits'
                ],
                expectedImpact: 'Increase utilization by 15-25%'
            });
        }

        // Wait time recommendations
        if (currentMetrics.averageWaitTime > options.maxWaitTimeMinutes) {
            recommendations.push({
                type: 'WAIT_TIME',
                priority: 'HIGH',
                title: 'Reduce Patient Wait Times',
                description: `Average wait time is ${currentMetrics.averageWaitTime.toFixed(1)} minutes. Consider schedule adjustments.`,
                suggestedActions: [
                    'Increase buffer time between appointments',
                    'Reschedule appointments to balance load',
                    'Implement staggered arrival times'
                ],
                expectedImpact: 'Reduce wait times by 20-30%'
            });
        }

        // Schedule balance recommendations
        const hourlyDistribution = this.analyzeHourlyDistribution(scheduleData);
        const peakHours = hourlyDistribution.filter(hour => hour.appointmentCount > hourlyDistribution.length * 0.8);

        if (peakHours.length > 0) {
            recommendations.push({
                type: 'LOAD_BALANCING',
                priority: 'MEDIUM',
                title: 'Balance Appointment Distribution',
                description: 'Some time periods have significantly higher appointment density.',
                suggestedActions: [
                    'Redistribute appointments to off-peak hours',
                    'Offer incentives for off-peak appointments',
                    'Implement dynamic scheduling based on demand'
                ],
                expectedImpact: 'Improve schedule balance by 15-20%'
            });
        }

        // Appointment type optimization
        const typeAnalysis = this.analyzeAppointmentTypes(scheduleData);
        if (typeAnalysis.hasOptimizationOpportunity) {
            recommendations.push({
                type: 'APPOINTMENT_TYPES',
                priority: 'MEDIUM',
                title: 'Optimize Appointment Type Scheduling',
                description: 'Appointment types could be better distributed for efficiency.',
                suggestedActions: [
                    'Group similar appointment types together',
                    'Schedule complex procedures during optimal times',
                    'Balance routine and complex appointments'
                ],
                expectedImpact: 'Improve efficiency by 10-15%'
            });
        }

        return recommendations;
    }

    /**
     * Apply optimization algorithms to improve schedule
     * @param {Array} scheduleData - Current schedule data
     * @param {Array} recommendations - Optimization recommendations
     * @param {Object} options - Optimization options
     * @returns {Object} Optimized schedule
     */
    async applyOptimizationAlgorithms(scheduleData, recommendations, options) {
        let optimizedSchedule = [...scheduleData];
        const modifications = [];

        // Apply utilization optimization
        if (recommendations.some(r => r.type === 'UTILIZATION')) {
            const utilizationResult = await this.applyUtilizationOptimization(optimizedSchedule, options);
            optimizedSchedule = utilizationResult.schedule;
            modifications.push(...utilizationResult.modifications);
        }

        // Apply wait time optimization
        if (recommendations.some(r => r.type === 'WAIT_TIME')) {
            const waitTimeResult = await this.applyWaitTimeOptimization(optimizedSchedule, options);
            optimizedSchedule = waitTimeResult.schedule;
            modifications.push(...waitTimeResult.modifications);
        }

        // Apply load balancing
        if (recommendations.some(r => r.type === 'LOAD_BALANCING')) {
            const balancingResult = await this.applyLoadBalancing(optimizedSchedule, options);
            optimizedSchedule = balancingResult.schedule;
            modifications.push(...balancingResult.modifications);
        }

        return {
            schedule: optimizedSchedule,
            modifications,
            algorithmResults: {
                utilizationOptimized: recommendations.some(r => r.type === 'UTILIZATION'),
                waitTimeOptimized: recommendations.some(r => r.type === 'WAIT_TIME'),
                loadBalanced: recommendations.some(r => r.type === 'LOAD_BALANCING')
            }
        };
    }

    /**
     * Apply utilization maximization algorithm
     * @param {Array} availableSlots - Available time slots
     * @param {Array} pendingAppointments - Pending appointments
     * @param {Array} waitlistEntries - Waitlist entries
     * @param {Object} constraints - Scheduling constraints
     * @returns {Object} Utilization plan
     */
    async applyUtilizationMaximization(availableSlots, pendingAppointments, waitlistEntries, constraints) {
        const suggestedAppointments = [];
        const recommendations = [];

        // Sort slots by optimization score (considering time of day, duration, etc.)
        const scoredSlots = availableSlots.map(slot => ({
            ...slot,
            score: this.calculateSlotOptimizationScore(slot)
        })).sort((a, b) => b.score - a.score);

        // Sort appointments by priority and urgency
        const prioritizedAppointments = [...pendingAppointments, ...waitlistEntries]
            .sort((a, b) => this.compareAppointmentPriority(a, b));

        // Greedy algorithm for slot assignment
        for (const appointment of prioritizedAppointments) {
            const suitableSlot = scoredSlots.find(slot =>
                this.isSlotSuitable(slot, appointment, constraints)
            );

            if (suitableSlot) {
                suggestedAppointments.push({
                    appointmentId: appointment.id,
                    slotId: suitableSlot.id,
                    startTime: suitableSlot.startTime,
                    endTime: suitableSlot.endTime,
                    priority: appointment.priority || 'NORMAL',
                    expectedUtilizationIncrease: this.calculateUtilizationIncrease(suitableSlot)
                });

                // Remove assigned slot from available slots
                const slotIndex = scoredSlots.findIndex(s => s.id === suitableSlot.id);
                scoredSlots.splice(slotIndex, 1);
            }
        }

        // Generate utilization recommendations
        if (scoredSlots.length > 0) {
            recommendations.push({
                type: 'UNUSED_CAPACITY',
                message: `${scoredSlots.length} time slots remain unused`,
                suggestion: 'Consider marketing to fill remaining slots or adjusting schedule'
            });
        }

        return {
            suggestedAppointments,
            recommendations,
            utilizationIncrease: suggestedAppointments.reduce(
                (sum, apt) => sum + apt.expectedUtilizationIncrease, 0
            )
        };
    }

    /**
     * Apply wait time minimization algorithm
     * @param {Array} currentSchedule - Current schedule
     * @param {Array} appointmentRequests - New appointment requests
     * @param {Object} config - Configuration parameters
     * @returns {Object} Optimized schedule
     */
    async applyWaitTimeMinimization(currentSchedule, appointmentRequests, config) {
        const optimizedSchedule = [...currentSchedule];
        const modifications = [];

        // Calculate current wait time patterns
        const waitTimePatterns = this.analyzeWaitTimePatterns(currentSchedule);

        // Apply buffer time optimization
        for (let i = 0; i < optimizedSchedule.length - 1; i++) {
            const current = optimizedSchedule[i];
            const next = optimizedSchedule[i + 1];

            const currentEndTime = new Date(current.fecha_hora.getTime() + current.duracion_minutos * 60000);
            const nextStartTime = new Date(next.fecha_hora);
            const currentBuffer = (nextStartTime - currentEndTime) / 60000; // minutes

            // Optimize buffer time based on appointment type and historical data
            const optimalBuffer = this.calculateOptimalBufferTime(current, next, waitTimePatterns);

            if (Math.abs(currentBuffer - optimalBuffer) > 2) { // 2-minute threshold
                const newNextStartTime = new Date(currentEndTime.getTime() + optimalBuffer * 60000);

                modifications.push({
                    type: 'BUFFER_ADJUSTMENT',
                    appointmentId: next.id,
                    originalTime: next.fecha_hora,
                    newTime: newNextStartTime,
                    bufferChange: optimalBuffer - currentBuffer,
                    expectedWaitTimeReduction: this.estimateWaitTimeReduction(optimalBuffer - currentBuffer)
                });

                optimizedSchedule[i + 1] = {
                    ...next,
                    fecha_hora: newNextStartTime
                };
            }
        }

        // Apply appointment reordering for wait time optimization
        const reorderingResult = this.optimizeAppointmentOrder(optimizedSchedule, config);
        modifications.push(...reorderingResult.modifications);

        return {
            schedule: reorderingResult.schedule,
            modifications,
            expectedWaitTimeReduction: modifications.reduce(
                (sum, mod) => sum + (mod.expectedWaitTimeReduction || 0), 0
            )
        };
    }

    /**
     * Calculate optimization score for the overall improvement
     * @param {Object} improvementMetrics - Improvement metrics
     * @returns {number} Optimization score (0-100)
     */
    calculateOptimizationScore(improvementMetrics) {
        const utilizationScore = Math.min(improvementMetrics.utilizationImprovement * 100, 50);
        const waitTimeScore = Math.min(improvementMetrics.waitTimeReduction * 2, 30);
        const efficiencyScore = Math.min(improvementMetrics.efficiencyImprovement * 100, 20);

        return Math.round(utilizationScore + waitTimeScore + efficiencyScore);
    }

    /**
     * Calculate improvement metrics comparing current vs optimized
     * @param {Object} currentMetrics - Current performance metrics
     * @param {Object} optimizedSchedule - Optimized schedule result
     * @returns {Object} Improvement metrics
     */
    async calculateImprovementMetrics(currentMetrics, optimizedSchedule) {
        // Simulate optimized metrics based on the optimized schedule
        const optimizedMetrics = await this.simulateOptimizedMetrics(optimizedSchedule);

        return {
            utilizationImprovement: optimizedMetrics.utilization - currentMetrics.utilization,
            waitTimeReduction: currentMetrics.averageWaitTime - optimizedMetrics.averageWaitTime,
            efficiencyImprovement: optimizedMetrics.onTimeRate - currentMetrics.onTimeRate,
            appointmentIncrease: optimizedSchedule.modifications?.filter(m => m.type === 'NEW_APPOINTMENT').length || 0,
            totalModifications: optimizedSchedule.modifications?.length || 0
        };
    }

    /**
     * Analyze hourly distribution of appointments
     * @param {Array} scheduleData - Schedule data
     * @returns {Array} Hourly distribution analysis
     */
    analyzeHourlyDistribution(scheduleData) {
        const hourlyCount = {};

        scheduleData.forEach(appointment => {
            const hour = new Date(appointment.fecha_hora).getHours();
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        });

        return Object.entries(hourlyCount).map(([hour, count]) => ({
            hour: parseInt(hour),
            appointmentCount: count,
            utilization: count / Math.max(...Object.values(hourlyCount))
        }));
    }

    /**
     * Analyze appointment types for optimization opportunities
     * @param {Array} scheduleData - Schedule data
     * @returns {Object} Appointment type analysis
     */
    analyzeAppointmentTypes(scheduleData) {
        const typeDistribution = {};

        scheduleData.forEach(appointment => {
            const type = appointment.tipo_cita;
            if (!typeDistribution[type]) {
                typeDistribution[type] = {
                    count: 0,
                    totalDuration: 0,
                    averageWaitTime: 0
                };
            }

            typeDistribution[type].count++;
            typeDistribution[type].totalDuration += appointment.duracion_minutos;
            if (appointment.tiempo_espera_minutos) {
                typeDistribution[type].averageWaitTime += appointment.tiempo_espera_minutos;
            }
        });

        // Calculate averages and identify optimization opportunities
        Object.keys(typeDistribution).forEach(type => {
            const data = typeDistribution[type];
            data.averageDuration = data.totalDuration / data.count;
            data.averageWaitTime = data.averageWaitTime / data.count;
        });

        // Determine if there are optimization opportunities
        const types = Object.keys(typeDistribution);
        const hasOptimizationOpportunity = types.length > 1 &&
            Math.max(...types.map(t => typeDistribution[t].averageWaitTime)) >
            Math.min(...types.map(t => typeDistribution[t].averageWaitTime)) * 2;

        return {
            typeDistribution,
            hasOptimizationOpportunity,
            recommendedGrouping: this.recommendAppointmentTypeGrouping(typeDistribution)
        };
    }

    /**
     * Calculate optimal buffer time between appointments
     * @param {Object} currentAppointment - Current appointment
     * @param {Object} nextAppointment - Next appointment
     * @param {Object} waitTimePatterns - Historical wait time patterns
     * @returns {number} Optimal buffer time in minutes
     */
    calculateOptimalBufferTime(currentAppointment, nextAppointment, waitTimePatterns) {
        // Base buffer time
        let optimalBuffer = this.config.minBufferTimeMinutes;

        // Adjust based on appointment type complexity
        const complexityFactor = this.getAppointmentComplexityFactor(currentAppointment.tipo_cita);
        optimalBuffer += complexityFactor * 5;

        // Adjust based on historical overrun patterns
        const historicalOverrun = waitTimePatterns[currentAppointment.tipo_cita]?.averageOverrun || 0;
        optimalBuffer += Math.min(historicalOverrun * 0.5, 10);

        // Ensure within bounds
        return Math.min(Math.max(optimalBuffer, this.config.minBufferTimeMinutes), this.config.maxBufferTimeMinutes);
    }

    /**
     * Get appointment complexity factor for buffer time calculation
     * @param {string} appointmentType - Appointment type
     * @returns {number} Complexity factor (0-3)
     */
    getAppointmentComplexityFactor(appointmentType) {
        const complexityMap = {
            'CONSULTA_GENERAL': 1,
            'PRIMERA_VEZ': 2,
            'SEGUIMIENTO': 1,
            'CONTROL': 1,
            'CIRUGIA': 3,
            'POST_OPERATORIO': 2,
            'URGENCIA': 3
        };

        return complexityMap[appointmentType] || 1;
    }

    /**
     * Simulate optimized metrics based on optimized schedule
     * @param {Object} optimizedSchedule - Optimized schedule
     * @returns {Object} Simulated optimized metrics
     */
    async simulateOptimizedMetrics(optimizedSchedule) {
        // This is a simplified simulation - in a real implementation,
        // you might use more sophisticated modeling

        const baseMetrics = {
            utilization: 0.75,
            averageWaitTime: 15,
            onTimeRate: 0.80
        };

        // Apply improvements based on modifications
        const modifications = optimizedSchedule.modifications || [];

        let utilizationImprovement = 0;
        let waitTimeImprovement = 0;
        let efficiencyImprovement = 0;

        modifications.forEach(mod => {
            switch (mod.type) {
                case 'BUFFER_ADJUSTMENT':
                    waitTimeImprovement += mod.expectedWaitTimeReduction || 0;
                    break;
                case 'NEW_APPOINTMENT':
                    utilizationImprovement += 0.05; // 5% per new appointment
                    break;
                case 'REORDER':
                    efficiencyImprovement += 0.02; // 2% per reorder
                    break;
            }
        });

        return {
            utilization: Math.min(baseMetrics.utilization + utilizationImprovement, 1.0),
            averageWaitTime: Math.max(baseMetrics.averageWaitTime - waitTimeImprovement, 5),
            onTimeRate: Math.min(baseMetrics.onTimeRate + efficiencyImprovement, 1.0)
        };
    }

    /**
     * Get provider schedule for a specific date
     * @param {string} providerId - Provider ID
     * @param {Date} date - Target date
     * @returns {Object} Provider schedule
     */
    async getProviderSchedule(providerId, date) {
        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday from 0 to 7

        const query = `
            SELECT 
                h.hora_inicio,
                h.hora_fin,
                h.duracion_cita_minutos,
                e.tipo_excepcion,
                e.hora_inicio_especial,
                e.hora_fin_especial
            FROM HORARIOS_MEDICOS h
            LEFT JOIN EXCEPCIONES_HORARIO e ON h.medico_id = e.medico_id AND e.fecha = $2
            WHERE h.medico_id = $1 
            AND h.dia_semana = $3
            AND h.activo = TRUE
            AND (h.fecha_fin_vigencia IS NULL OR h.fecha_fin_vigencia >= $2)
        `;

        const { rows } = await this.pool.query(query, [providerId, date, dayOfWeek]);
        return rows[0] || null;
    }

    /**
     * Get existing appointments for a provider on a specific date
     * @param {string} providerId - Provider ID
     * @param {Date} date - Target date
     * @returns {Array} Existing appointments
     */
    async getExistingAppointments(providerId, date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const query = `
            SELECT 
                id,
                fecha_hora,
                duracion_minutos,
                tipo_cita,
                estado
            FROM CITAS
            WHERE medico_id = $1
            AND fecha_hora BETWEEN $2 AND $3
            AND activo = TRUE
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            ORDER BY fecha_hora
        `;

        const { rows } = await this.pool.query(query, [providerId, startOfDay, endOfDay]);
        return rows;
    }

    /**
     * Calculate available time slots
     * @param {Object} providerSchedule - Provider schedule
     * @param {Array} existingAppointments - Existing appointments
     * @returns {Array} Available slots
     */
    async calculateAvailableSlots(providerSchedule, existingAppointments) {
        if (!providerSchedule) return [];

        const slots = [];
        const workStart = providerSchedule.hora_inicio_especial || providerSchedule.hora_inicio;
        const workEnd = providerSchedule.hora_fin_especial || providerSchedule.hora_fin;
        const slotDuration = providerSchedule.duracion_cita_minutos || 30;

        // Create time slots for the day
        let currentTime = new Date(`1970-01-01T${workStart}`);
        const endTime = new Date(`1970-01-01T${workEnd}`);

        let slotId = 1;
        while (currentTime < endTime) {
            const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);

            // Check if slot conflicts with existing appointments
            const hasConflict = existingAppointments.some(apt => {
                const aptStart = new Date(apt.fecha_hora);
                const aptEnd = new Date(aptStart.getTime() + apt.duracion_minutos * 60000);

                return (currentTime < aptEnd && slotEnd > aptStart);
            });

            if (!hasConflict) {
                slots.push({
                    id: slotId++,
                    startTime: new Date(currentTime),
                    endTime: new Date(slotEnd),
                    duration: slotDuration,
                    available: true
                });
            }

            currentTime = new Date(slotEnd);
        }

        return slots;
    }

    /**
     * Calculate slot optimization score
     * @param {Object} slot - Time slot
     * @returns {number} Optimization score
     */
    calculateSlotOptimizationScore(slot) {
        let score = 100;

        // Prefer morning slots (higher productivity)
        const hour = slot.startTime.getHours();
        if (hour >= 8 && hour <= 11) {
            score += 20;
        } else if (hour >= 14 && hour <= 16) {
            score += 10;
        }

        // Prefer longer slots for efficiency
        if (slot.duration >= 45) {
            score += 15;
        } else if (slot.duration >= 30) {
            score += 10;
        }

        return score;
    }

    /**
     * Compare appointment priority for scheduling
     * @param {Object} a - First appointment
     * @param {Object} b - Second appointment
     * @returns {number} Comparison result
     */
    compareAppointmentPriority(a, b) {
        const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'NORMAL': 2, 'LOW': 1 };

        const aPriority = priorityOrder[a.priority] || 2;
        const bPriority = priorityOrder[b.priority] || 2;

        if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
        }

        // If same priority, prefer older requests
        return new Date(a.created_at || a.fecha_creacion) - new Date(b.created_at || b.fecha_creacion);
    }

    /**
     * Check if a slot is suitable for an appointment
     * @param {Object} slot - Time slot
     * @param {Object} appointment - Appointment request
     * @param {Object} constraints - Scheduling constraints
     * @returns {boolean} Whether slot is suitable
     */
    isSlotSuitable(slot, appointment, constraints) {
        // Check duration compatibility
        const requiredDuration = appointment.duracion_minutos || 30;
        if (slot.duration < requiredDuration) {
            return false;
        }

        // Check time preferences (if any)
        if (appointment.preferred_time_start && appointment.preferred_time_end) {
            const slotHour = slot.startTime.getHours();
            const preferredStart = parseInt(appointment.preferred_time_start.split(':')[0]);
            const preferredEnd = parseInt(appointment.preferred_time_end.split(':')[0]);

            if (slotHour < preferredStart || slotHour >= preferredEnd) {
                return false;
            }
        }

        // Check appointment type constraints
        if (constraints.appointmentTypeRestrictions) {
            const typeRestriction = constraints.appointmentTypeRestrictions[appointment.tipo_cita];
            if (typeRestriction && !typeRestriction.allowedHours.includes(slot.startTime.getHours())) {
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate utilization increase for a slot assignment
     * @param {Object} slot - Time slot
     * @returns {number} Utilization increase percentage
     */
    calculateUtilizationIncrease(slot) {
        // Simplified calculation - in practice, this would consider
        // the provider's total available time and current utilization
        return slot.duration / (8 * 60); // Assuming 8-hour workday
    }

    /**
     * Get pending appointments for a provider
     * @param {string} providerId - Provider ID
     * @returns {Array} Pending appointments
     */
    async getPendingAppointments(providerId) {
        const query = `
            SELECT 
                id,
                id_paciente,
                tipo_cita,
                duracion_minutos,
                motivo,
                fecha_creacion,
                'NORMAL' as priority
            FROM CITAS
            WHERE medico_id = $1
            AND estado = 'PROGRAMADA'
            AND fecha_hora > CURRENT_TIMESTAMP
            AND activo = TRUE
            ORDER BY fecha_creacion
        `;

        const { rows } = await this.pool.query(query, [providerId]);
        return rows;
    }

    /**
     * Get waitlist entries for a provider
     * @param {string} providerId - Provider ID
     * @returns {Array} Waitlist entries
     */
    async getWaitlistEntries(providerId) {
        const query = `
            SELECT 
                le.id_entrada as id,
                le.id_paciente,
                le.tipo_cita_preferido as tipo_cita,
                30 as duracion_minutos,
                le.motivo,
                le.fecha_creacion,
                le.prioridad as priority,
                le.hora_preferida_inicio as preferred_time_start,
                le.hora_preferida_fin as preferred_time_end
            FROM LISTA_ESPERA le
            WHERE (le.medico_preferido = $1 OR le.medico_preferido IS NULL)
            AND le.estado = 'ACTIVA'
            ORDER BY le.prioridad DESC, le.fecha_creacion
        `;

        const { rows } = await this.pool.query(query, [providerId]);
        return rows;
    }

    /**
     * Calculate utilization metrics
     * @param {Object} providerSchedule - Provider schedule
     * @param {Array} existingAppointments - Existing appointments
     * @param {Array} suggestedAppointments - Suggested new appointments
     * @returns {Object} Utilization metrics
     */
    calculateUtilizationMetrics(providerSchedule, existingAppointments, suggestedAppointments) {
        if (!providerSchedule) {
            return {
                currentUtilization: 0,
                optimizedUtilization: 0,
                improvement: 0
            };
        }

        // Calculate total available time
        const workStart = new Date(`1970-01-01T${providerSchedule.hora_inicio}`);
        const workEnd = new Date(`1970-01-01T${providerSchedule.hora_fin}`);
        const totalAvailableMinutes = (workEnd - workStart) / 60000;

        // Calculate current utilization
        const currentBookedMinutes = existingAppointments.reduce(
            (sum, apt) => sum + apt.duracion_minutos, 0
        );
        const currentUtilization = currentBookedMinutes / totalAvailableMinutes;

        // Calculate optimized utilization
        const additionalMinutes = suggestedAppointments.reduce(
            (sum, apt) => sum + (apt.duration || 30), 0
        );
        const optimizedUtilization = (currentBookedMinutes + additionalMinutes) / totalAvailableMinutes;

        return {
            currentUtilization,
            optimizedUtilization,
            improvement: optimizedUtilization - currentUtilization
        };
    }

    /**
     * Get current schedule for a provider on a specific date
     * @param {string} providerId - Provider ID
     * @param {Date} date - Target date
     * @returns {Array} Current schedule
     */
    async getCurrentSchedule(providerId, date) {
        return await this.getExistingAppointments(providerId, date);
    }

    /**
     * Calculate current wait times from schedule
     * @param {Array} schedule - Current schedule
     * @returns {Object} Wait time metrics
     */
    async calculateCurrentWaitTimes(schedule) {
        const waitTimes = schedule
            .filter(apt => apt.tiempo_espera_minutos !== null)
            .map(apt => apt.tiempo_espera_minutos);

        if (waitTimes.length === 0) {
            return { average: 0, max: 0, min: 0 };
        }

        return {
            average: waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length,
            max: Math.max(...waitTimes),
            min: Math.min(...waitTimes)
        };
    }

    /**
     * Calculate optimized wait times
     * @param {Object} optimizedSchedule - Optimized schedule
     * @returns {Object} Optimized wait time metrics
     */
    async calculateOptimizedWaitTimes(optimizedSchedule) {
        // Simulate optimized wait times based on modifications
        const baseWaitTime = 10; // Optimistic base wait time
        const modifications = optimizedSchedule.modifications || [];

        const totalReduction = modifications.reduce(
            (sum, mod) => sum + (mod.expectedWaitTimeReduction || 0), 0
        );

        return {
            average: Math.max(baseWaitTime - totalReduction, 5),
            max: Math.max((baseWaitTime - totalReduction) * 2, 10),
            min: Math.max((baseWaitTime - totalReduction) * 0.5, 2)
        };
    }

    /**
     * Generate wait time reduction recommendations
     * @param {Object} currentWaitTimes - Current wait times
     * @param {Object} optimizedWaitTimes - Optimized wait times
     * @param {Object} optimizedSchedule - Optimized schedule
     * @returns {Array} Recommendations
     */
    async generateWaitTimeRecommendations(currentWaitTimes, optimizedWaitTimes, optimizedSchedule) {
        const recommendations = [];
        const improvement = currentWaitTimes.average - optimizedWaitTimes.average;

        if (improvement > 5) {
            recommendations.push({
                type: 'SIGNIFICANT_IMPROVEMENT',
                title: 'Significant Wait Time Reduction Possible',
                description: `Average wait time can be reduced by ${improvement.toFixed(1)} minutes`,
                priority: 'HIGH'
            });
        }

        if (optimizedSchedule.modifications?.length > 0) {
            recommendations.push({
                type: 'SCHEDULE_MODIFICATIONS',
                title: 'Schedule Modifications Required',
                description: `${optimizedSchedule.modifications.length} appointments need to be rescheduled`,
                priority: 'MEDIUM'
            });
        }

        return recommendations;
    }

    /**
     * Analyze wait time patterns from historical data
     * @param {Array} schedule - Schedule data
     * @returns {Object} Wait time patterns
     */
    analyzeWaitTimePatterns(schedule) {
        const patterns = {};

        schedule.forEach(appointment => {
            const type = appointment.tipo_cita;
            if (!patterns[type]) {
                patterns[type] = {
                    totalWaitTime: 0,
                    totalOverrun: 0,
                    count: 0
                };
            }

            if (appointment.tiempo_espera_minutos !== null) {
                patterns[type].totalWaitTime += appointment.tiempo_espera_minutos;
                patterns[type].count++;
            }

            // Calculate overrun (actual time vs scheduled time)
            if (appointment.tiempo_consulta_minutos && appointment.duracion_minutos) {
                const overrun = appointment.tiempo_consulta_minutos - appointment.duracion_minutos;
                if (overrun > 0) {
                    patterns[type].totalOverrun += overrun;
                }
            }
        });

        // Calculate averages
        Object.keys(patterns).forEach(type => {
            const pattern = patterns[type];
            if (pattern.count > 0) {
                pattern.averageWaitTime = pattern.totalWaitTime / pattern.count;
                pattern.averageOverrun = pattern.totalOverrun / pattern.count;
            }
        });

        return patterns;
    }

    /**
     * Optimize appointment order to minimize wait times
     * @param {Array} schedule - Current schedule
     * @param {Object} config - Configuration
     * @returns {Object} Reordering result
     */
    optimizeAppointmentOrder(schedule, config) {
        // Simple optimization: sort by expected duration and complexity
        const optimizedSchedule = [...schedule].sort((a, b) => {
            const aComplexity = this.getAppointmentComplexityFactor(a.tipo_cita);
            const bComplexity = this.getAppointmentComplexityFactor(b.tipo_cita);

            // Prefer simpler appointments first to build momentum
            if (aComplexity !== bComplexity) {
                return aComplexity - bComplexity;
            }

            // Then sort by duration
            return a.duracion_minutos - b.duracion_minutos;
        });

        const modifications = [];

        // Identify reordered appointments
        for (let i = 0; i < schedule.length; i++) {
            if (schedule[i].id !== optimizedSchedule[i].id) {
                modifications.push({
                    type: 'REORDER',
                    appointmentId: optimizedSchedule[i].id,
                    originalPosition: schedule.findIndex(apt => apt.id === optimizedSchedule[i].id),
                    newPosition: i,
                    expectedWaitTimeReduction: 2 // Estimated reduction per reorder
                });
            }
        }

        return {
            schedule: optimizedSchedule,
            modifications
        };
    }

    /**
     * Estimate wait time reduction from buffer time changes
     * @param {number} bufferChange - Buffer time change in minutes
     * @returns {number} Estimated wait time reduction
     */
    estimateWaitTimeReduction(bufferChange) {
        // Simplified model: each minute of buffer reduces wait time by 0.7 minutes on average
        return Math.max(bufferChange * 0.7, 0);
    }

    /**
     * Recommend appointment type grouping for efficiency
     * @param {Object} typeDistribution - Appointment type distribution
     * @returns {Array} Grouping recommendations
     */
    recommendAppointmentTypeGrouping(typeDistribution) {
        const recommendations = [];
        const types = Object.keys(typeDistribution);

        // Group similar duration appointments
        const shortAppointments = types.filter(t => typeDistribution[t].averageDuration <= 20);
        const mediumAppointments = types.filter(t => typeDistribution[t].averageDuration > 20 && typeDistribution[t].averageDuration <= 45);
        const longAppointments = types.filter(t => typeDistribution[t].averageDuration > 45);

        if (shortAppointments.length > 1) {
            recommendations.push({
                group: 'SHORT_APPOINTMENTS',
                types: shortAppointments,
                suggestion: 'Schedule these together for efficiency'
            });
        }

        if (longAppointments.length > 0) {
            recommendations.push({
                group: 'COMPLEX_APPOINTMENTS',
                types: longAppointments,
                suggestion: 'Schedule during optimal hours with adequate buffer time'
            });
        }

        return recommendations;
    }

    /**
     * Apply utilization optimization to schedule
     * @param {Array} schedule - Current schedule
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization result
     */
    async applyUtilizationOptimization(schedule, options) {
        const modifications = [];

        // Identify gaps in schedule that could be filled
        const gaps = this.identifyScheduleGaps(schedule);

        gaps.forEach(gap => {
            if (gap.duration >= 30) { // Minimum appointment duration
                modifications.push({
                    type: 'NEW_APPOINTMENT',
                    startTime: gap.startTime,
                    endTime: gap.endTime,
                    duration: gap.duration,
                    suggestion: 'Consider scheduling appointment in this gap'
                });
            }
        });

        return {
            schedule,
            modifications
        };
    }

    /**
     * Apply wait time optimization to schedule
     * @param {Array} schedule - Current schedule
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization result
     */
    async applyWaitTimeOptimization(schedule, options) {
        return await this.applyWaitTimeMinimization(schedule, [], options);
    }

    /**
     * Apply load balancing to schedule
     * @param {Array} schedule - Current schedule
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization result
     */
    async applyLoadBalancing(schedule, options) {
        const modifications = [];
        const hourlyLoad = this.calculateHourlyLoad(schedule);

        // Identify overloaded and underloaded hours
        const averageLoad = Object.values(hourlyLoad).reduce((sum, load) => sum + load, 0) / Object.keys(hourlyLoad).length;

        Object.entries(hourlyLoad).forEach(([hour, load]) => {
            if (load > averageLoad * 1.5) {
                modifications.push({
                    type: 'LOAD_BALANCING',
                    hour: parseInt(hour),
                    currentLoad: load,
                    suggestion: 'Consider moving some appointments to less busy hours',
                    priority: 'MEDIUM'
                });
            }
        });

        return {
            schedule,
            modifications
        };
    }

    /**
     * Identify gaps in schedule
     * @param {Array} schedule - Current schedule
     * @returns {Array} Schedule gaps
     */
    identifyScheduleGaps(schedule) {
        const gaps = [];

        for (let i = 0; i < schedule.length - 1; i++) {
            const current = schedule[i];
            const next = schedule[i + 1];

            const currentEnd = new Date(current.fecha_hora.getTime() + current.duracion_minutos * 60000);
            const nextStart = new Date(next.fecha_hora);

            const gapDuration = (nextStart - currentEnd) / 60000; // minutes

            if (gapDuration > 15) { // Significant gap
                gaps.push({
                    startTime: currentEnd,
                    endTime: nextStart,
                    duration: gapDuration
                });
            }
        }

        return gaps;
    }

    /**
     * Calculate hourly load distribution
     * @param {Array} schedule - Current schedule
     * @returns {Object} Hourly load
     */
    calculateHourlyLoad(schedule) {
        const hourlyLoad = {};

        schedule.forEach(appointment => {
            const hour = new Date(appointment.fecha_hora).getHours();
            hourlyLoad[hour] = (hourlyLoad[hour] || 0) + 1;
        });

        return hourlyLoad;
    }
}

module.exports = OptimizationEngine;