const OptimizationEngine = require('../services/optimizationEngine');

// Mock the database pool
jest.mock('../db', () => ({
    getPool: jest.fn(() => ({
        query: jest.fn()
    }))
}));

describe('OptimizationEngine Integration Tests', () => {
    let optimizationEngine;
    let mockPool;

    beforeEach(() => {
        optimizationEngine = new OptimizationEngine();
        const { getPool } = require('../db');
        mockPool = getPool();

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('Schedule Data Retrieval', () => {
        test('should retrieve schedule data correctly', async () => {
            const mockScheduleData = [
                {
                    id: 1,
                    fecha_hora: new Date('2024-01-01T09:00:00'),
                    duracion_minutos: 30,
                    tipo_cita: 'CONSULTA_GENERAL',
                    estado: 'COMPLETADA',
                    tiempo_espera_minutos: 10,
                    tiempo_consulta_minutos: 35,
                    patient_id: 1,
                    nombre: 'John',
                    apellido: 'Doe'
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockScheduleData });

            // Initialize the engine to set up the pool
            optimizationEngine.initialize();

            const result = await optimizationEngine.getScheduleData(
                '1',
                new Date('2024-01-01'),
                new Date('2024-01-07')
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['1', new Date('2024-01-01'), new Date('2024-01-07')]
            );
            expect(result).toEqual(mockScheduleData);
        });
    });

    describe('Provider Schedule Retrieval', () => {
        test('should retrieve provider schedule correctly', async () => {
            const mockSchedule = {
                hora_inicio: '09:00:00',
                hora_fin: '17:00:00',
                duracion_cita_minutos: 30,
                tipo_excepcion: null,
                hora_inicio_especial: null,
                hora_fin_especial: null
            };

            mockPool.query.mockResolvedValueOnce({ rows: [mockSchedule] });

            const result = await optimizationEngine.getProviderSchedule(
                '1',
                new Date('2024-01-01')
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining(['1', new Date('2024-01-01')])
            );
            expect(result).toEqual(mockSchedule);
        });

        test('should handle no schedule found', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const result = await optimizationEngine.getProviderSchedule(
                '999',
                new Date('2024-01-01')
            );

            expect(result).toBeNull();
        });
    });

    describe('Existing Appointments Retrieval', () => {
        test('should retrieve existing appointments correctly', async () => {
            const mockAppointments = [
                {
                    id: 1,
                    fecha_hora: new Date('2024-01-01T09:00:00'),
                    duracion_minutos: 30,
                    tipo_cita: 'CONSULTA_GENERAL',
                    estado: 'PROGRAMADA'
                },
                {
                    id: 2,
                    fecha_hora: new Date('2024-01-01T10:00:00'),
                    duracion_minutos: 45,
                    tipo_cita: 'PRIMERA_VEZ',
                    estado: 'CONFIRMADA'
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockAppointments });

            const result = await optimizationEngine.getExistingAppointments(
                '1',
                new Date('2024-01-01')
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining(['1'])
            );
            expect(result).toEqual(mockAppointments);
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

        test('should handle no provider schedule', async () => {
            const slots = await optimizationEngine.calculateAvailableSlots(null, []);
            expect(slots).toEqual([]);
        });
    });

    describe('Pending Appointments Retrieval', () => {
        test('should retrieve pending appointments correctly', async () => {
            const mockPendingAppointments = [
                {
                    id: 1,
                    id_paciente: 1,
                    tipo_cita: 'CONSULTA_GENERAL',
                    duracion_minutos: 30,
                    motivo: 'Checkup',
                    fecha_creacion: new Date('2024-01-01'),
                    priority: 'NORMAL'
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockPendingAppointments });

            const result = await optimizationEngine.getPendingAppointments('1');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['1']
            );
            expect(result).toEqual(mockPendingAppointments);
        });
    });

    describe('Waitlist Entries Retrieval', () => {
        test('should retrieve waitlist entries correctly', async () => {
            const mockWaitlistEntries = [
                {
                    id: 1,
                    id_paciente: 1,
                    tipo_cita: 'CONSULTA_GENERAL',
                    duracion_minutos: 30,
                    motivo: 'Consultation',
                    fecha_creacion: new Date('2024-01-01'),
                    priority: 'HIGH',
                    preferred_time_start: '09:00',
                    preferred_time_end: '12:00'
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockWaitlistEntries });

            const result = await optimizationEngine.getWaitlistEntries('1');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['1']
            );
            expect(result).toEqual(mockWaitlistEntries);
        });
    });

    describe('Utilization Metrics Calculation', () => {
        test('should calculate utilization metrics correctly', () => {
            const providerSchedule = {
                hora_inicio: '09:00:00',
                hora_fin: '17:00:00'
            };

            const existingAppointments = [
                { duracion_minutos: 30 },
                { duracion_minutos: 45 },
                { duracion_minutos: 30 }
            ];

            const suggestedAppointments = [
                { duration: 30 },
                { duration: 30 }
            ];

            const metrics = optimizationEngine.calculateUtilizationMetrics(
                providerSchedule,
                existingAppointments,
                suggestedAppointments
            );

            expect(metrics.currentUtilization).toBeCloseTo(0.219, 2); // 105 minutes / 480 minutes
            expect(metrics.optimizedUtilization).toBeCloseTo(0.344, 2); // 165 minutes / 480 minutes
            expect(metrics.improvement).toBeCloseTo(0.125, 2);
        });

        test('should handle no provider schedule', () => {
            const metrics = optimizationEngine.calculateUtilizationMetrics(null, [], []);

            expect(metrics.currentUtilization).toBe(0);
            expect(metrics.optimizedUtilization).toBe(0);
            expect(metrics.improvement).toBe(0);
        });
    });

    describe('Wait Time Patterns Analysis', () => {
        test('should analyze wait time patterns correctly', () => {
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
                },
                {
                    tipo_cita: 'CIRUGIA',
                    tiempo_espera_minutos: 5,
                    tiempo_consulta_minutos: 120,
                    duracion_minutos: 90
                }
            ];

            const patterns = optimizationEngine.analyzeWaitTimePatterns(schedule);

            expect(patterns['CONSULTA_GENERAL']).toBeDefined();
            expect(patterns['CONSULTA_GENERAL'].averageWaitTime).toBe(12.5);
            expect(patterns['CONSULTA_GENERAL'].averageOverrun).toBe(7.5);

            expect(patterns['CIRUGIA']).toBeDefined();
            expect(patterns['CIRUGIA'].averageWaitTime).toBe(5);
            expect(patterns['CIRUGIA'].averageOverrun).toBe(30);
        });
    });

    describe('Appointment Type Analysis', () => {
        test('should analyze appointment types correctly', () => {
            const scheduleData = [
                {
                    tipo_cita: 'CONSULTA_GENERAL',
                    duracion_minutos: 30,
                    tiempo_espera_minutos: 10
                },
                {
                    tipo_cita: 'CONSULTA_GENERAL',
                    duracion_minutos: 30,
                    tiempo_espera_minutos: 15
                },
                {
                    tipo_cita: 'CIRUGIA',
                    duracion_minutos: 90,
                    tiempo_espera_minutos: 5
                }
            ];

            const analysis = optimizationEngine.analyzeAppointmentTypes(scheduleData);

            expect(analysis.typeDistribution['CONSULTA_GENERAL']).toBeDefined();
            expect(analysis.typeDistribution['CONSULTA_GENERAL'].count).toBe(2);
            expect(analysis.typeDistribution['CONSULTA_GENERAL'].averageDuration).toBe(30);
            expect(analysis.typeDistribution['CONSULTA_GENERAL'].averageWaitTime).toBe(12.5);

            expect(analysis.typeDistribution['CIRUGIA']).toBeDefined();
            expect(analysis.typeDistribution['CIRUGIA'].count).toBe(1);
            expect(analysis.typeDistribution['CIRUGIA'].averageDuration).toBe(90);
            expect(analysis.typeDistribution['CIRUGIA'].averageWaitTime).toBe(5);

            expect(analysis.hasOptimizationOpportunity).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await expect(
                optimizationEngine.getScheduleData('1', new Date(), new Date())
            ).rejects.toThrow('Database connection failed');
        });

        test('should handle optimization errors gracefully', async () => {
            // Mock database calls to fail
            mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

            const result = await optimizationEngine.optimizeSchedule(
                '1',
                new Date('2024-01-01'),
                new Date('2024-01-07')
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Query failed');
        });
    });

    describe('Configuration Validation', () => {
        test('should use default configuration when none provided', () => {
            expect(optimizationEngine.config.utilizationWeight).toBe(0.6);
            expect(optimizationEngine.config.waitTimeWeight).toBe(0.4);
            expect(optimizationEngine.config.maxDailyAppointments).toBe(20);
        });

        test('should validate configuration bounds', () => {
            // Test that weights sum to 1.0
            const totalWeight = optimizationEngine.config.utilizationWeight +
                optimizationEngine.config.waitTimeWeight;
            expect(totalWeight).toBe(1.0);

            // Test reasonable bounds
            expect(optimizationEngine.config.minBufferTimeMinutes).toBeGreaterThan(0);
            expect(optimizationEngine.config.maxBufferTimeMinutes).toBeGreaterThan(
                optimizationEngine.config.minBufferTimeMinutes
            );
        });
    });
});