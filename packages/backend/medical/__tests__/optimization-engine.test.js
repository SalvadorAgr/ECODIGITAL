const OptimizationEngine = require('../services/optimizationEngine');

// Mock the database pool
jest.mock('../db', () => ({
    getPool: jest.fn(() => ({
        query: jest.fn()
    }))
}));

describe('OptimizationEngine', () => {
    let optimizationEngine;
    let mockPool;

    beforeEach(() => {
        optimizationEngine = new OptimizationEngine();
        const { getPool } = require('../db');
        mockPool = getPool();

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('Configuration', () => {
        test('should have default configuration values', () => {
            expect(optimizationEngine.config).toBeDefined();
            expect(optimizationEngine.config.utilizationWeight).toBe(0.6);
            expect(optimizationEngine.config.waitTimeWeight).toBe(0.4);
            expect(optimizationEngine.config.maxDailyAppointments).toBe(20);
            expect(optimizationEngine.config.minBufferTimeMinutes).toBe(5);
            expect(optimizationEngine.config.maxBufferTimeMinutes).toBe(15);
        });

        test('should allow configuration override', () => {
            const customConfig = {
                utilizationWeight: 0.7,
                waitTimeWeight: 0.3,
                maxDailyAppointments: 25
            };

            const customEngine = new OptimizationEngine();
            customEngine.config = { ...customEngine.config, ...customConfig };

            expect(customEngine.config.utilizationWeight).toBe(0.7);
            expect(customEngine.config.waitTimeWeight).toBe(0.3);
            expect(customEngine.config.maxDailyAppointments).toBe(25);
        });
    });

    describe('Schedule Performance Analysis', () => {
        test('should analyze schedule performance correctly', async () => {
            const mockScheduleData = [
                {
                    id: 1,
                    duracion_minutos: 30,
                    estado: 'COMPLETADA',
                    tiempo_espera_minutos: 10,
                    tiempo_consulta_minutos: 35
                },
                {
                    id: 2,
                    duracion_minutos: 45,
                    estado: 'COMPLETADA',
                    tiempo_espera_minutos: 5,
                    tiempo_consulta_minutos: 40
                },
                {
                    id: 3,
                    duracion_minutos: 30,
                    estado: 'PROGRAMADA',
                    tiempo_espera_minutos: null,
                    tiempo_consulta_minutos: null
                }
            ];

            const metrics = await optimizationEngine.analyzeSchedulePerformance(mockScheduleData);

            expect(metrics.totalAppointments).toBe(3);
            expect(metrics.completedAppointments).toBe(2);
            expect(metrics.completionRate).toBeCloseTo(0.667, 2);
            expect(metrics.averageWaitTime).toBe(7.5); // (10 + 5) / 2
            expect(metrics.maxWaitTime).toBe(10);
            expect(metrics.utilization).toBeCloseTo(0.714, 2); // 75 / 105
        });

        test('should handle empty schedule data', async () => {
            const metrics = await optimizationEngine.analyzeSchedulePerformance([]);

            expect(metrics.totalAppointments).toBe(0);
            expect(metrics.completedAppointments).toBe(0);
            expect(metrics.completionRate).toBe(0);
            expect(metrics.averageWaitTime).toBe(0);
            expect(metrics.maxWaitTime).toBe(0);
            expect(metrics.utilization).toBe(0);
        });
    });

    describe('Optimization Score Calculation', () => {
        test('should calculate optimization score correctly', () => {
            const improvementMetrics = {
                utilizationImprovement: 0.2, // 20% improvement
                waitTimeReduction: 10, // 10 minutes reduction
                efficiencyImprovement: 0.15 // 15% improvement
            };

            const score = optimizationEngine.calculateOptimizationScore(improvementMetrics);

            // Expected: 20 (utilization) + 20 (wait time) + 15 (efficiency) = 55
            expect(score).toBe(55);
        });

        test('should cap scores at maximum values', () => {
            const improvementMetrics = {
                utilizationImprovement: 1.0, // 100% improvement (capped at 50)
                waitTimeReduction: 50, // 50 minutes reduction (capped at 30)
                efficiencyImprovement: 0.5 // 50% improvement (capped at 20)
            };

            const score = optimizationEngine.calculateOptimizationScore(improvementMetrics);

            // Expected: 50 (max utilization) + 30 (max wait time) + 20 (max efficiency) = 100
            expect(score).toBe(100);
        });
    });

    describe('Appointment Complexity Factor', () => {
        test('should return correct complexity factors', () => {
            expect(optimizationEngine.getAppointmentComplexityFactor('CONSULTA_GENERAL')).toBe(1);
            expect(optimizationEngine.getAppointmentComplexityFactor('PRIMERA_VEZ')).toBe(2);
            expect(optimizationEngine.getAppointmentComplexityFactor('CIRUGIA')).toBe(3);
            expect(optimizationEngine.getAppointmentComplexityFactor('URGENCIA')).toBe(3);
            expect(optimizationEngine.getAppointmentComplexityFactor('UNKNOWN_TYPE')).toBe(1);
        });
    });

    describe('Optimal Buffer Time Calculation', () => {
        test('should calculate optimal buffer time based on appointment complexity', () => {
            const currentAppointment = { tipo_cita: 'CIRUGIA' };
            const nextAppointment = { tipo_cita: 'CONSULTA_GENERAL' };
            const waitTimePatterns = {};

            const bufferTime = optimizationEngine.calculateOptimalBufferTime(
                currentAppointment,
                nextAppointment,
                waitTimePatterns
            );

            // Expected: 5 (base) + 15 (complexity factor 3 * 5) = 20, but capped at 15
            expect(bufferTime).toBe(15);
        });

        test('should respect minimum and maximum buffer time limits', () => {
            const currentAppointment = { tipo_cita: 'CONSULTA_GENERAL' };
            const nextAppointment = { tipo_cita: 'CONSULTA_GENERAL' };
            const waitTimePatterns = {
                'CONSULTA_GENERAL': { averageOverrun: 30 } // Large overrun
            };

            const bufferTime = optimizationEngine.calculateOptimalBufferTime(
                currentAppointment,
                nextAppointment,
                waitTimePatterns
            );

            // Should be capped at maximum
            expect(bufferTime).toBe(15);
        });
    });

    describe('Slot Optimization Score', () => {
        test('should score morning slots higher', () => {
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

        test('should score longer slots higher', () => {
            const shortSlot = {
                startTime: new Date('2024-01-01T09:00:00'),
                duration: 15
            };

            const longSlot = {
                startTime: new Date('2024-01-01T09:00:00'),
                duration: 60
            };

            const shortScore = optimizationEngine.calculateSlotOptimizationScore(shortSlot);
            const longScore = optimizationEngine.calculateSlotOptimizationScore(longSlot);

            expect(longScore).toBeGreaterThan(shortScore);
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

            expect(comparison).toBeGreaterThan(0); // Urgent should come first
        });

        test('should prioritize older appointments when priority is equal', () => {
            const olderAppointment = {
                priority: 'NORMAL',
                created_at: '2024-01-01T09:00:00'
            };

            const newerAppointment = {
                priority: 'NORMAL',
                created_at: '2024-01-01T10:00:00'
            };

            const comparison = optimizationEngine.compareAppointmentPriority(
                newerAppointment,
                olderAppointment
            );

            expect(comparison).toBeGreaterThan(0); // Older should come first
        });
    });

    describe('Slot Suitability Check', () => {
        test('should reject slots that are too short', () => {
            const slot = {
                duration: 20,
                startTime: new Date('2024-01-01T09:00:00')
            };

            const appointment = {
                duracion_minutos: 30
            };

            const isSuitable = optimizationEngine.isSlotSuitable(slot, appointment, {});

            expect(isSuitable).toBe(false);
        });

        test('should accept suitable slots', () => {
            const slot = {
                duration: 45,
                startTime: new Date('2024-01-01T09:00:00')
            };

            const appointment = {
                duracion_minutos: 30
            };

            const isSuitable = optimizationEngine.isSlotSuitable(slot, appointment, {});

            expect(isSuitable).toBe(true);
        });

        test('should respect time preferences', () => {
            const slot = {
                duration: 30,
                startTime: new Date('2024-01-01T15:00:00') // 3 PM
            };

            const appointment = {
                duracion_minutos: 30,
                preferred_time_start: '09:00',
                preferred_time_end: '12:00'
            };

            const isSuitable = optimizationEngine.isSlotSuitable(slot, appointment, {});

            expect(isSuitable).toBe(false);
        });
    });

    describe('Utilization Calculation', () => {
        test('should calculate utilization increase correctly', () => {
            const slot = { duration: 30 };
            const increase = optimizationEngine.calculateUtilizationIncrease(slot);

            // Expected: 30 minutes / (8 hours * 60 minutes) = 0.0625
            expect(increase).toBeCloseTo(0.0625, 4);
        });
    });

    describe('Hourly Distribution Analysis', () => {
        test('should analyze hourly distribution correctly', () => {
            const scheduleData = [
                { fecha_hora: new Date('2024-01-01T09:00:00') },
                { fecha_hora: new Date('2024-01-01T09:30:00') },
                { fecha_hora: new Date('2024-01-01T10:00:00') },
                { fecha_hora: new Date('2024-01-01T14:00:00') }
            ];

            const distribution = optimizationEngine.analyzeHourlyDistribution(scheduleData);

            expect(distribution).toHaveLength(3); // 9 AM, 10 AM, 2 PM

            const nineAM = distribution.find(d => d.hour === 9);
            expect(nineAM.appointmentCount).toBe(2);
            expect(nineAM.utilization).toBe(1); // Highest count

            const tenAM = distribution.find(d => d.hour === 10);
            expect(tenAM.appointmentCount).toBe(1);
            expect(tenAM.utilization).toBe(0.5);
        });
    });

    describe('Wait Time Reduction Estimation', () => {
        test('should estimate wait time reduction correctly', () => {
            const bufferIncrease = 10; // 10 minutes
            const reduction = optimizationEngine.estimateWaitTimeReduction(bufferIncrease);

            // Expected: 10 * 0.7 = 7 minutes
            expect(reduction).toBe(7);
        });

        test('should not return negative reductions', () => {
            const bufferDecrease = -5; // 5 minutes decrease
            const reduction = optimizationEngine.estimateWaitTimeReduction(bufferDecrease);

            expect(reduction).toBe(0);
        });
    });

    describe('Schedule Gap Identification', () => {
        test('should identify gaps in schedule', () => {
            const schedule = [
                {
                    fecha_hora: new Date('2024-01-01T09:00:00'),
                    duracion_minutos: 30
                },
                {
                    fecha_hora: new Date('2024-01-01T10:00:00'), // 30-minute gap
                    duracion_minutos: 30
                }
            ];

            const gaps = optimizationEngine.identifyScheduleGaps(schedule);

            expect(gaps).toHaveLength(1);
            expect(gaps[0].duration).toBe(30);
            expect(gaps[0].startTime).toEqual(new Date('2024-01-01T09:30:00'));
            expect(gaps[0].endTime).toEqual(new Date('2024-01-01T10:00:00'));
        });

        test('should ignore small gaps', () => {
            const schedule = [
                {
                    fecha_hora: new Date('2024-01-01T09:00:00'),
                    duracion_minutos: 30
                },
                {
                    fecha_hora: new Date('2024-01-01T09:40:00'), // 10-minute gap (ignored)
                    duracion_minutos: 30
                }
            ];

            const gaps = optimizationEngine.identifyScheduleGaps(schedule);

            expect(gaps).toHaveLength(0);
        });
    });

    describe('Hourly Load Calculation', () => {
        test('should calculate hourly load correctly', () => {
            const schedule = [
                { fecha_hora: new Date('2024-01-01T09:00:00') },
                { fecha_hora: new Date('2024-01-01T09:30:00') },
                { fecha_hora: new Date('2024-01-01T10:00:00') }
            ];

            const load = optimizationEngine.calculateHourlyLoad(schedule);

            expect(load[9]).toBe(2);
            expect(load[10]).toBe(1);
            expect(load[11]).toBeUndefined();
        });
    });
});