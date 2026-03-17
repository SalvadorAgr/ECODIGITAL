const OptimizationEngine = require('../services/optimizationEngine');

describe('OptimizationEngine Core Functionality', () => {
    let optimizationEngine;

    beforeEach(() => {
        optimizationEngine = new OptimizationEngine();
    });

    describe('Configuration', () => {
        test('should have correct default configuration', () => {
            expect(optimizationEngine.config.utilizationWeight).toBe(0.6);
            expect(optimizationEngine.config.waitTimeWeight).toBe(0.4);
            expect(optimizationEngine.config.maxDailyAppointments).toBe(20);
            expect(optimizationEngine.config.minBufferTimeMinutes).toBe(5);
            expect(optimizationEngine.config.maxBufferTimeMinutes).toBe(15);
        });
    });

    describe('Schedule Performance Analysis', () => {
        test('should analyze performance metrics correctly', async () => {
            const scheduleData = [
                {
                    duracion_minutos: 30,
                    estado: 'COMPLETADA',
                    tiempo_espera_minutos: 10,
                    tiempo_consulta_minutos: 35
                },
                {
                    duracion_minutos: 45,
                    estado: 'COMPLETADA',
                    tiempo_espera_minutos: 5,
                    tiempo_consulta_minutos: 40
                },
                {
                    duracion_minutos: 30,
                    estado: 'PROGRAMADA',
                    tiempo_espera_minutos: null,
                    tiempo_consulta_minutos: null
                }
            ];

            const metrics = await optimizationEngine.analyzeSchedulePerformance(scheduleData);

            expect(metrics.totalAppointments).toBe(3);
            expect(metrics.completedAppointments).toBe(2);
            expect(metrics.completionRate).toBeCloseTo(0.667, 2);
            expect(metrics.averageWaitTime).toBe(7.5);
            expect(metrics.utilization).toBeCloseTo(0.714, 2);
        });
    });

    describe('Optimization Score Calculation', () => {
        test('should calculate optimization score correctly', () => {
            const improvementMetrics = {
                utilizationImprovement: 0.2,
                waitTimeReduction: 10,
                efficiencyImprovement: 0.15
            };

            const score = optimizationEngine.calculateOptimizationScore(improvementMetrics);
            expect(score).toBe(55);
        });
    });

    describe('Buffer Time Optimization', () => {
        test('should calculate optimal buffer time', () => {
            const currentAppointment = { tipo_cita: 'CIRUGIA' };
            const nextAppointment = { tipo_cita: 'CONSULTA_GENERAL' };
            const waitTimePatterns = {};

            const bufferTime = optimizationEngine.calculateOptimalBufferTime(
                currentAppointment,
                nextAppointment,
                waitTimePatterns
            );

            expect(bufferTime).toBe(15); // Should be capped at max
        });
    });

    describe('Slot Optimization', () => {
        test('should score morning slots higher than afternoon', () => {
            const morningSlot = {
                startTime: new Date('2024-01-01T09:00:00'),
                duration: 30
            };

            const afternoonSlot = {
                startTime: new Date('2024-01-01T15:00:00'),
                duration: 30
            };

            const morningScore = optimizationEngine.calculateSlotOptimizationScore(morningSlot);
            const afternoonScore = optimizationEngine.calculateSlotOptimizationScore(afternoonSlot);

            expect(morningScore).toBeGreaterThan(afternoonScore);
        });
    });

    describe('Appointment Priority Comparison', () => {
        test('should prioritize urgent appointments', () => {
            const urgentAppointment = {
                priority: 'URGENT',
                created_at: '2024-01-01T10:00:00'
            };

            const normalAppointment = {
                priority: 'NORMAL',
                created_at: '2024-01-01T09:00:00'
            };

            const comparison = optimizationEngine.compareAppointmentPriority(
                normalAppointment,
                urgentAppointment
            );

            expect(comparison).toBeGreaterThan(0);
        });
    });

    describe('Slot Suitability', () => {
        test('should reject slots that are too short', () => {
            const slot = { duration: 20, startTime: new Date('2024-01-01T09:00:00') };
            const appointment = { duracion_minutos: 30 };

            const isSuitable = optimizationEngine.isSlotSuitable(slot, appointment, {});
            expect(isSuitable).toBe(false);
        });

        test('should accept suitable slots', () => {
            const slot = { duration: 45, startTime: new Date('2024-01-01T09:00:00') };
            const appointment = { duracion_minutos: 30 };

            const isSuitable = optimizationEngine.isSlotSuitable(slot, appointment, {});
            expect(isSuitable).toBe(true);
        });
    });

    describe('Available Slots Calculation', () => {
        test('should calculate available slots correctly', async () => {
            const providerSchedule = {
                hora_inicio: '09:00:00',
                hora_fin: '12:00:00',
                duracion_cita_minutos: 30
            };

            const existingAppointments = [
                {
                    fecha_hora: new Date('1970-01-01T10:00:00'),
                    duracion_minutos: 30
                }
            ];

            const slots = await optimizationEngine.calculateAvailableSlots(
                providerSchedule,
                existingAppointments
            );

            expect(slots.length).toBeGreaterThan(0);
            expect(slots[0]).toHaveProperty('startTime');
            expect(slots[0]).toHaveProperty('endTime');
            expect(slots[0]).toHaveProperty('duration');
            expect(slots[0]).toHaveProperty('available');
        });

        test('should return empty array for no schedule', async () => {
            const slots = await optimizationEngine.calculateAvailableSlots(null, []);
            expect(slots).toEqual([]);
        });
    });

    describe('Utilization Metrics', () => {
        test('should calculate utilization correctly', () => {
            const providerSchedule = {
                hora_inicio: '09:00:00',
                hora_fin: '17:00:00'
            };

            const existingAppointments = [
                { duracion_minutos: 30 },
                { duracion_minutos: 45 }
            ];

            const suggestedAppointments = [
                { duration: 30 }
            ];

            const metrics = optimizationEngine.calculateUtilizationMetrics(
                providerSchedule,
                existingAppointments,
                suggestedAppointments
            );

            expect(metrics.currentUtilization).toBeCloseTo(0.156, 2);
            expect(metrics.optimizedUtilization).toBeCloseTo(0.219, 2);
            expect(metrics.improvement).toBeCloseTo(0.063, 2);
        });
    });

    describe('Wait Time Analysis', () => {
        test('should analyze wait time patterns', () => {
            const schedule = [
                {
                    tipo_cita: 'CONSULTA_GENERAL',
                    tiempo_espera_minutos: 10,
                    tiempo_consulta_minutos: 35,
                    duracion_minutos: 30
                },
                {
                    tipo_cita: 'CONSULTA_GENERAL',
                    tiempo_espera_minutos: 15,
                    tiempo_consulta_minutos: 40,
                    duracion_minutos: 30
                }
            ];

            const patterns = optimizationEngine.analyzeWaitTimePatterns(schedule);

            expect(patterns['CONSULTA_GENERAL']).toBeDefined();
            expect(patterns['CONSULTA_GENERAL'].averageWaitTime).toBe(12.5);
            expect(patterns['CONSULTA_GENERAL'].averageOverrun).toBe(7.5);
        });
    });

    describe('Schedule Gap Identification', () => {
        test('should identify gaps correctly', () => {
            const schedule = [
                {
                    fecha_hora: new Date('2024-01-01T09:00:00'),
                    duracion_minutos: 30
                },
                {
                    fecha_hora: new Date('2024-01-01T10:00:00'),
                    duracion_minutos: 30
                }
            ];

            const gaps = optimizationEngine.identifyScheduleGaps(schedule);

            expect(gaps).toHaveLength(1);
            expect(gaps[0].duration).toBe(30);
        });
    });

    describe('Appointment Type Analysis', () => {
        test('should analyze appointment types', () => {
            const scheduleData = [
                {
                    tipo_cita: 'CONSULTA_GENERAL',
                    duracion_minutos: 30,
                    tiempo_espera_minutos: 5
                },
                {
                    tipo_cita: 'CIRUGIA',
                    duracion_minutos: 90,
                    tiempo_espera_minutos: 25 // Higher wait time to trigger optimization opportunity
                }
            ];

            const analysis = optimizationEngine.analyzeAppointmentTypes(scheduleData);

            expect(analysis.typeDistribution['CONSULTA_GENERAL']).toBeDefined();
            expect(analysis.typeDistribution['CIRUGIA']).toBeDefined();
            expect(analysis.hasOptimizationOpportunity).toBe(true);
        });
    });

    describe('Complexity Factors', () => {
        test('should return correct complexity factors', () => {
            expect(optimizationEngine.getAppointmentComplexityFactor('CONSULTA_GENERAL')).toBe(1);
            expect(optimizationEngine.getAppointmentComplexityFactor('CIRUGIA')).toBe(3);
            expect(optimizationEngine.getAppointmentComplexityFactor('UNKNOWN')).toBe(1);
        });
    });

    describe('Wait Time Estimation', () => {
        test('should estimate wait time reduction', () => {
            expect(optimizationEngine.estimateWaitTimeReduction(10)).toBe(7);
            expect(optimizationEngine.estimateWaitTimeReduction(-5)).toBe(0);
        });
    });

    describe('Hourly Analysis', () => {
        test('should analyze hourly distribution', () => {
            const scheduleData = [
                { fecha_hora: new Date('2024-01-01T09:00:00') },
                { fecha_hora: new Date('2024-01-01T09:30:00') },
                { fecha_hora: new Date('2024-01-01T10:00:00') }
            ];

            const distribution = optimizationEngine.analyzeHourlyDistribution(scheduleData);

            expect(distribution).toHaveLength(2);
            expect(distribution.find(d => d.hour === 9).appointmentCount).toBe(2);
            expect(distribution.find(d => d.hour === 10).appointmentCount).toBe(1);
        });

        test('should calculate hourly load', () => {
            const schedule = [
                { fecha_hora: new Date('2024-01-01T09:00:00') },
                { fecha_hora: new Date('2024-01-01T09:30:00') }
            ];

            const load = optimizationEngine.calculateHourlyLoad(schedule);

            expect(load[9]).toBe(2);
            expect(load[10]).toBeUndefined();
        });
    });
});