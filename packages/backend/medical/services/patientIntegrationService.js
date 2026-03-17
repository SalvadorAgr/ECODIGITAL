/**
 * Patient Integration Service
 * Integrates appointment scheduling with existing patient management system
 */

const { getPool } = require('../db');
const integrationService = require('./integrationService');

class PatientIntegrationService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Get patient with appointment history and preferences
     */
    async getPatientWithAppointmentData(patientId) {
        try {
            const cacheKey = `patient_${patientId}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
            }

            const pool = getPool();

            // Get patient basic information
            const { rows: patientRows } = await pool.query(`
                SELECT 
                    p.*,
                    COUNT(c.id) as total_appointments,
                    COUNT(CASE WHEN c.estado = 'COMPLETADA' THEN 1 END) as completed_appointments,
                    COUNT(CASE WHEN c.estado = 'CANCELADA' THEN 1 END) as cancelled_appointments,
                    COUNT(CASE WHEN c.estado = 'NO_ASISTIO' THEN 1 END) as no_show_appointments,
                    MAX(c.fecha_hora) as last_appointment_date,
                    AVG(CASE WHEN c.estado = 'COMPLETADA' THEN c.tiempo_consulta_minutos END) as avg_consultation_time
                FROM PACIENTES p
                LEFT JOIN CITAS c ON p.id = c.id_paciente AND c.activo = TRUE
                WHERE p.id = $1 AND p.activo = TRUE
                GROUP BY p.id
            `, [patientId]);

            if (patientRows.length === 0) {
                return null;
            }

            const patient = patientRows[0];

            // Get appointment preferences
            const { rows: preferenceRows } = await pool.query(`
                SELECT 
                    medico_id,
                    COUNT(*) as appointment_count,
                    CONCAT(u.nombres, ' ', u.apellidos) as doctor_name,
                    u.especialidad
                FROM CITAS c
                JOIN USUARIOS u ON c.medico_id = u.id
                WHERE c.id_paciente = $1 AND c.activo = TRUE
                GROUP BY medico_id, u.nombres, u.apellidos, u.especialidad
                ORDER BY appointment_count DESC
                LIMIT 5
            `, [patientId]);

            // Get recent appointments
            const { rows: recentAppointments } = await pool.query(`
                SELECT 
                    c.id,
                    c.numero_cita,
                    c.fecha_hora,
                    c.tipo_cita,
                    c.estado,
                    c.motivo,
                    c.prioridad,
                    c.es_urgente,
                    CONCAT(u.nombres, ' ', u.apellidos) as doctor_name,
                    u.especialidad
                FROM CITAS c
                JOIN USUARIOS u ON c.medico_id = u.id
                WHERE c.id_paciente = $1 AND c.activo = TRUE
                ORDER BY c.fecha_hora DESC
                LIMIT 10
            `, [patientId]);

            // Get waitlist entries
            const { rows: waitlistEntries } = await pool.query(`
                SELECT 
                    le.*,
                    ta.nombre as appointment_type_name,
                    CONCAT(u.nombres, ' ', u.apellidos) as preferred_doctor_name
                FROM LISTA_ESPERA le
                LEFT JOIN TIPOS_CITA ta ON le.tipo_cita_id = ta.id
                LEFT JOIN USUARIOS u ON le.medico_preferido_id = u.id
                WHERE le.paciente_id = $1 AND le.activo = TRUE
                ORDER BY le.fecha_creacion DESC
            `, [patientId]);

            // Calculate patient risk factors
            const riskFactors = this.calculatePatientRiskFactors(patient, recentAppointments);

            // Get priority recommendations
            const priorityRecommendation = await this.calculatePatientPriorityRecommendation(
                patient,
                recentAppointments
            );

            const enhancedPatientData = {
                ...patient,
                appointment_statistics: {
                    total: patient.total_appointments,
                    completed: patient.completed_appointments,
                    cancelled: patient.cancelled_appointments,
                    no_show: patient.no_show_appointments,
                    no_show_rate: patient.total_appointments > 0 ?
                        (patient.no_show_appointments / patient.total_appointments * 100).toFixed(2) : 0,
                    avg_consultation_time: patient.avg_consultation_time
                },
                preferred_doctors: preferenceRows,
                recent_appointments: recentAppointments,
                waitlist_entries: waitlistEntries,
                risk_factors: riskFactors,
                priority_recommendation: priorityRecommendation,
                last_updated: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: enhancedPatientData,
                timestamp: Date.now()
            });

            return enhancedPatientData;

        } catch (error) {
            console.error('Error getting patient with appointment data:', error);
            throw error;
        }
    }

    /**
     * Calculate patient risk factors for scheduling
     */
    calculatePatientRiskFactors(patient, recentAppointments) {
        const riskFactors = [];

        // Age-based risk
        if (patient.fecha_nacimiento) {
            const age = Math.floor((Date.now() - new Date(patient.fecha_nacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            if (age >= 65) {
                riskFactors.push({
                    type: 'age_based',
                    severity: 'medium',
                    description: 'Patient is 65 or older',
                    recommendation: 'Consider priority scheduling'
                });
            }
            if (age >= 80) {
                riskFactors.push({
                    type: 'age_based',
                    severity: 'high',
                    description: 'Patient is 80 or older',
                    recommendation: 'Recommend high priority and shorter wait times'
                });
            }
        }

        // Medical condition risk
        if (patient.condiciones_medicas) {
            const conditions = patient.condiciones_medicas.toLowerCase();
            const highRiskConditions = ['diabetes', 'hipertension', 'cancer', 'cardiopatia', 'insuficiencia'];

            for (const condition of highRiskConditions) {
                if (conditions.includes(condition)) {
                    riskFactors.push({
                        type: 'medical_condition',
                        severity: 'high',
                        description: `High-risk medical condition: ${condition}`,
                        recommendation: 'Consider priority scheduling and frequent monitoring'
                    });
                    break; // Only add one medical condition risk factor
                }
            }
        }

        // No-show risk
        const totalAppointments = recentAppointments.length;
        const noShowCount = recentAppointments.filter(apt => apt.estado === 'NO_ASISTIO').length;

        if (totalAppointments >= 3 && noShowCount / totalAppointments > 0.3) {
            riskFactors.push({
                type: 'no_show_risk',
                severity: 'medium',
                description: `High no-show rate: ${((noShowCount / totalAppointments) * 100).toFixed(1)}%`,
                recommendation: 'Consider confirmation calls and flexible scheduling'
            });
        }

        // Frequent cancellation risk
        const cancelledCount = recentAppointments.filter(apt => apt.estado === 'CANCELADA').length;

        if (totalAppointments >= 3 && cancelledCount / totalAppointments > 0.4) {
            riskFactors.push({
                type: 'cancellation_risk',
                severity: 'low',
                description: `High cancellation rate: ${((cancelledCount / totalAppointments) * 100).toFixed(1)}%`,
                recommendation: 'Offer flexible scheduling options'
            });
        }

        // Urgent appointment history
        const urgentCount = recentAppointments.filter(apt => apt.es_urgente || apt.tipo_cita === 'URGENCIA').length;

        if (urgentCount >= 2) {
            riskFactors.push({
                type: 'urgent_history',
                severity: 'medium',
                description: `History of urgent appointments: ${urgentCount} recent urgent visits`,
                recommendation: 'Monitor closely and consider preventive care scheduling'
            });
        }

        return riskFactors;
    }

    /**
     * Calculate priority recommendation for new appointments
     */
    async calculatePatientPriorityRecommendation(patient, recentAppointments) {
        try {
            let recommendedPriority = 'NORMAL';
            let reasons = [];
            let urgencyScore = 0;

            // Age factor
            if (patient.fecha_nacimiento) {
                const age = Math.floor((Date.now() - new Date(patient.fecha_nacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                if (age >= 80) {
                    urgencyScore += 30;
                    reasons.push('Patient age 80+');
                } else if (age >= 65) {
                    urgencyScore += 15;
                    reasons.push('Patient age 65+');
                }
            }

            // Medical conditions factor
            if (patient.condiciones_medicas) {
                const conditions = patient.condiciones_medicas.toLowerCase();
                const criticalConditions = ['cancer', 'insuficiencia cardiaca', 'dialisis'];
                const highRiskConditions = ['diabetes', 'hipertension', 'cardiopatia'];

                if (criticalConditions.some(condition => conditions.includes(condition))) {
                    urgencyScore += 50;
                    reasons.push('Critical medical condition');
                } else if (highRiskConditions.some(condition => conditions.includes(condition))) {
                    urgencyScore += 25;
                    reasons.push('High-risk medical condition');
                }
            }

            // Recent urgent appointments
            const recentUrgent = recentAppointments.filter(apt =>
                apt.es_urgente || apt.tipo_cita === 'URGENCIA'
            ).length;

            if (recentUrgent >= 2) {
                urgencyScore += 20;
                reasons.push('History of urgent appointments');
            }

            // Time since last appointment
            if (recentAppointments.length > 0) {
                const lastAppointment = new Date(recentAppointments[0].fecha_hora);
                const daysSinceLastAppointment = Math.floor((Date.now() - lastAppointment.getTime()) / (24 * 60 * 60 * 1000));

                if (daysSinceLastAppointment > 365) {
                    urgencyScore += 10;
                    reasons.push('Long time since last appointment');
                }
            }

            // Determine priority based on score
            if (urgencyScore >= 70) {
                recommendedPriority = 'URGENTE';
            } else if (urgencyScore >= 40) {
                recommendedPriority = 'ALTA';
            } else if (urgencyScore >= 20) {
                recommendedPriority = 'NORMAL';
            } else {
                recommendedPriority = 'BAJA';
            }

            return {
                recommended_priority: recommendedPriority,
                urgency_score: urgencyScore,
                reasons: reasons,
                confidence: this.calculateConfidence(urgencyScore, reasons.length)
            };

        } catch (error) {
            console.error('Error calculating priority recommendation:', error);
            return {
                recommended_priority: 'NORMAL',
                urgency_score: 0,
                reasons: [],
                confidence: 'low'
            };
        }
    }

    /**
     * Calculate confidence level for priority recommendation
     */
    calculateConfidence(urgencyScore, reasonCount) {
        if (reasonCount >= 3 && urgencyScore >= 50) {
            return 'high';
        } else if (reasonCount >= 2 && urgencyScore >= 25) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Create appointment with patient-specific optimizations
     */
    async createOptimizedAppointment(appointmentData, patientId, userId) {
        try {
            // Get patient data with recommendations
            const patientData = await this.getPatientWithAppointmentData(patientId);

            if (!patientData) {
                throw new Error('Patient not found');
            }

            // Apply patient-specific optimizations
            const optimizedData = { ...appointmentData };

            // Apply priority recommendation if not explicitly set
            if (!appointmentData.prioridad && patientData.priority_recommendation) {
                optimizedData.prioridad = patientData.priority_recommendation.recommended_priority;
                optimizedData.priority_reason = `Auto-assigned based on patient profile: ${patientData.priority_recommendation.reasons.join(', ')}`;
            }

            // Apply preferred doctor if not specified and patient has strong preference
            if (!appointmentData.medico_id && patientData.preferred_doctors.length > 0) {
                const strongPreference = patientData.preferred_doctors[0];
                if (strongPreference.appointment_count >= 3) {
                    optimizedData.suggested_doctor = {
                        id: strongPreference.medico_id,
                        name: strongPreference.doctor_name,
                        reason: `Patient has ${strongPreference.appointment_count} previous appointments with this doctor`
                    };
                }
            }

            // Add buffer time for high-risk patients
            const hasHighRiskFactors = patientData.risk_factors.some(rf => rf.severity === 'high');
            if (hasHighRiskFactors && !appointmentData.duracion_minutos) {
                optimizedData.duracion_minutos = 45; // Extended time for high-risk patients
                optimizedData.duration_reason = 'Extended time allocated for high-risk patient';
            }

            // Add special instructions based on patient history
            const specialInstructions = [];

            if (patientData.appointment_statistics.no_show_rate > 20) {
                specialInstructions.push('High no-show risk - confirm appointment 24h before');
            }

            if (patientData.risk_factors.some(rf => rf.type === 'age_based')) {
                specialInstructions.push('Elderly patient - allow extra time for check-in');
            }

            if (patientData.condiciones_medicas) {
                specialInstructions.push(`Medical conditions: ${patientData.condiciones_medicas}`);
            }

            if (specialInstructions.length > 0) {
                optimizedData.observaciones = (optimizedData.observaciones || '') +
                    '\n\nPatient-specific notes:\n' + specialInstructions.join('\n');
            }

            // Create the appointment using the integration service
            const result = await integrationService.createEnhancedAppointment(optimizedData, userId);

            return {
                ...result,
                patient_optimizations: {
                    priority_applied: optimizedData.prioridad !== appointmentData.prioridad,
                    duration_extended: optimizedData.duracion_minutos > (appointmentData.duracion_minutos || 30),
                    special_instructions_added: specialInstructions.length > 0,
                    suggested_doctor: optimizedData.suggested_doctor,
                    risk_factors: patientData.risk_factors.length
                }
            };

        } catch (error) {
            console.error('Error creating optimized appointment:', error);
            throw error;
        }
    }

    /**
     * Get patient scheduling recommendations
     */
    async getPatientSchedulingRecommendations(patientId, appointmentType = null) {
        try {
            const patientData = await this.getPatientWithAppointmentData(patientId);

            if (!patientData) {
                return null;
            }

            const recommendations = {
                priority: patientData.priority_recommendation,
                preferred_doctors: patientData.preferred_doctors.slice(0, 3),
                optimal_duration: this.calculateOptimalDuration(patientData, appointmentType),
                best_time_slots: this.calculateBestTimeSlots(patientData),
                special_considerations: this.getSpecialConsiderations(patientData),
                risk_assessment: {
                    no_show_risk: patientData.appointment_statistics.no_show_rate,
                    cancellation_risk: (patientData.appointment_statistics.cancelled / patientData.appointment_statistics.total * 100).toFixed(2),
                    overall_risk: this.calculateOverallRisk(patientData)
                }
            };

            return recommendations;

        } catch (error) {
            console.error('Error getting patient scheduling recommendations:', error);
            throw error;
        }
    }

    /**
     * Calculate optimal appointment duration
     */
    calculateOptimalDuration(patientData, appointmentType) {
        let baseDuration = 30; // Default 30 minutes

        // Adjust based on appointment type
        const typeDurations = {
            'PRIMERA_VEZ': 45,
            'SEGUIMIENTO': 30,
            'CONTROL': 20,
            'CIRUGIA': 120,
            'POST_OPERATORIO': 30,
            'URGENCIA': 30
        };

        if (appointmentType && typeDurations[appointmentType]) {
            baseDuration = typeDurations[appointmentType];
        }

        // Adjust based on patient factors
        const hasHighRiskFactors = patientData.risk_factors.some(rf => rf.severity === 'high');
        const isElderly = patientData.risk_factors.some(rf => rf.type === 'age_based');
        const hasComplexConditions = patientData.condiciones_medicas &&
            patientData.condiciones_medicas.split(',').length > 2;

        if (hasHighRiskFactors || isElderly || hasComplexConditions) {
            baseDuration += 15; // Add 15 minutes for complex cases
        }

        // Use historical data if available
        if (patientData.appointment_statistics.avg_consultation_time) {
            const avgTime = Math.ceil(patientData.appointment_statistics.avg_consultation_time);
            baseDuration = Math.max(baseDuration, avgTime);
        }

        return {
            recommended_duration: baseDuration,
            factors: {
                appointment_type: appointmentType,
                high_risk_factors: hasHighRiskFactors,
                elderly_patient: isElderly,
                complex_conditions: hasComplexConditions,
                historical_average: patientData.appointment_statistics.avg_consultation_time
            }
        };
    }

    /**
     * Calculate best time slots for patient
     */
    calculateBestTimeSlots(patientData) {
        const preferences = [];

        // Analyze historical appointment times
        const appointmentHours = patientData.recent_appointments
            .map(apt => new Date(apt.fecha_hora).getHours())
            .filter(hour => !isNaN(hour));

        if (appointmentHours.length > 0) {
            const hourCounts = {};
            appointmentHours.forEach(hour => {
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            });

            const preferredHour = Object.keys(hourCounts)
                .reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);

            preferences.push({
                type: 'historical_preference',
                time_range: `${preferredHour}:00-${parseInt(preferredHour) + 1}:00`,
                confidence: hourCounts[preferredHour] >= 3 ? 'high' : 'medium',
                reason: `Patient has ${hourCounts[preferredHour]} appointments at this time`
            });
        }

        // Age-based recommendations
        const isElderly = patientData.risk_factors.some(rf => rf.type === 'age_based');
        if (isElderly) {
            preferences.push({
                type: 'age_based',
                time_range: '09:00-11:00',
                confidence: 'medium',
                reason: 'Morning appointments recommended for elderly patients'
            });
        }

        // Risk-based recommendations
        const hasHighRisk = patientData.risk_factors.some(rf => rf.severity === 'high');
        if (hasHighRisk) {
            preferences.push({
                type: 'risk_based',
                time_range: '08:00-10:00',
                confidence: 'medium',
                reason: 'Early appointments recommended for high-risk patients'
            });
        }

        return preferences;
    }

    /**
     * Get special considerations for patient
     */
    getSpecialConsiderations(patientData) {
        const considerations = [];

        // Risk factor considerations
        patientData.risk_factors.forEach(rf => {
            considerations.push({
                type: rf.type,
                severity: rf.severity,
                description: rf.description,
                recommendation: rf.recommendation
            });
        });

        // No-show risk considerations
        if (patientData.appointment_statistics.no_show_rate > 15) {
            considerations.push({
                type: 'scheduling',
                severity: 'medium',
                description: `No-show rate: ${patientData.appointment_statistics.no_show_rate}%`,
                recommendation: 'Send confirmation reminders and consider overbooking protection'
            });
        }

        // Waitlist considerations
        if (patientData.waitlist_entries.length > 0) {
            considerations.push({
                type: 'waitlist',
                severity: 'low',
                description: `Patient has ${patientData.waitlist_entries.length} active waitlist entries`,
                recommendation: 'Consider priority scheduling or alternative appointment types'
            });
        }

        return considerations;
    }

    /**
     * Calculate overall risk score
     */
    calculateOverallRisk(patientData) {
        let riskScore = 0;

        // Risk factors
        patientData.risk_factors.forEach(rf => {
            switch (rf.severity) {
                case 'high': riskScore += 30; break;
                case 'medium': riskScore += 15; break;
                case 'low': riskScore += 5; break;
            }
        });

        // No-show rate
        riskScore += patientData.appointment_statistics.no_show_rate * 0.5;

        // Determine risk level
        if (riskScore >= 50) return 'high';
        if (riskScore >= 25) return 'medium';
        return 'low';
    }

    /**
     * Clear patient cache
     */
    clearPatientCache(patientId = null) {
        if (patientId) {
            this.cache.delete(`patient_${patientId}`);
        } else {
            this.cache.clear();
        }
    }
}

module.exports = new PatientIntegrationService();