const request = require('supertest');
const express = require('express');
const optimizationRoutes = require('../routes/optimizationRoutes');

// Mock the database and optimization engine
jest.mock('../db', () => ({
    getPool: jest.fn(() => ({
        query: jest.fn()
    }))
}));

jest.mock('../services/optimizationEngine');

describe('Optimization Routes', () => {
    let app;
    let mockPool;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/v1/optimization', optimizationRoutes);

        const { getPool } = require('../db');
        mockPool = getPool();

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('POST /api/v1/optimization/schedule', () => {
        test('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/optimization/schedule')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Valid provider ID is required');
            expect(response.body.details).toContain('Start date is required');
            expect(response.body.details).toContain('End date is required');
        });

        test('should validate date range', async () => {
            const response = await request(app)
                .post('/api/v1/optimization/schedule')
                .send({
                    providerId: '1',
                    startDate: '2024-01-15',
                    endDate: '2024-01-10' // End before start
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('End date must be after start date');
        });

        test('should validate maximum date range', async () => {
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000); // 35 days

            const response = await request(app)
                .post('/api/v1/optimization/schedule')
                .send({
                    providerId: '1',
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Date range cannot exceed 30 days');
        });

        test('should check if provider exists', async () => {
            mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const response = await request(app)
                .post('/api/v1/optimization/schedule')
                .send({
                    providerId: '999',
                    startDate: '2024-01-01',
                    endDate: '2024-01-07'
                });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Provider not found or not authorized');
        });

        test('should return optimization results for valid request', async () => {
            // Mock provider exists
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    id: 1,
                    nombres: 'Dr. John',
                    apellidos: 'Doe',
                    especialidad: 'Cardiology'
                }]
            });

            // Mock optimization engine
            const OptimizationEngine = require('../services/optimizationEngine');
            const mockEngine = new OptimizationEngine();
            mockEngine.optimizeSchedule = jest.fn().mockResolvedValue({
                success: true,
                data: {
                    providerId: '1',
                    dateRange: { startDate: '2024-01-01', endDate: '2024-01-07' },
                    currentMetrics: { utilization: 0.7, averageWaitTime: 15 },
                    optimizedSchedule: { modifications: [] },
                    recommendations: [],
                    improvementMetrics: { utilizationImprovement: 0.1 },
                    optimizationScore: 75
                }
            });

            const response = await request(app)
                .post('/api/v1/optimization/schedule')
                .send({
                    providerId: '1',
                    startDate: '2024-01-01',
                    endDate: '2024-01-07'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.provider.name).toBe('Dr. John Doe');
        });
    });

    describe('POST /api/v1/optimization/utilization', () => {
        test('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/optimization/utilization')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Valid provider ID is required');
            expect(response.body.details).toContain('Date is required');
        });

        test('should validate date is not in the past', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const response = await request(app)
                .post('/api/v1/optimization/utilization')
                .send({
                    providerId: '1',
                    date: pastDate.toISOString().split('T')[0]
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Date cannot be in the past');
        });
    });

    describe('POST /api/v1/optimization/wait-times', () => {
        test('should validate appointment requests format', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const response = await request(app)
                .post('/api/v1/optimization/wait-times')
                .send({
                    providerId: '1',
                    date: futureDate.toISOString().split('T')[0],
                    appointmentRequests: [
                        { /* missing required fields */ },
                        { id_paciente: '123' /* missing tipo_cita */ }
                    ]
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Appointment request 1: Patient ID is required');
            expect(response.body.details).toContain('Appointment request 1: Appointment type is required');
            expect(response.body.details).toContain('Appointment request 2: Appointment type is required');
        });
    });

    describe('GET /api/v1/optimization/metrics/:providerId', () => {
        test('should validate provider ID', async () => {
            const response = await request(app)
                .get('/api/v1/optimization/metrics/invalid');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Valid provider ID is required');
        });

        test('should return metrics for valid provider', async () => {
            // Mock provider exists
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    id: 1,
                    nombres: 'Dr. Jane',
                    apellidos: 'Smith',
                    especialidad: 'Pediatrics'
                }]
            });

            // Mock optimization engine methods
            const OptimizationEngine = require('../services/optimizationEngine');
            const mockEngine = new OptimizationEngine();
            mockEngine.getScheduleData = jest.fn().mockResolvedValue([]);
            mockEngine.analyzeSchedulePerformance = jest.fn().mockResolvedValue({
                utilization: 0.8,
                averageWaitTime: 12,
                onTimeRate: 0.85
            });
            mockEngine.generateOptimizationRecommendations = jest.fn().mockResolvedValue([]);
            mockEngine.calculateOptimizationScore = jest.fn().mockReturnValue(80);

            const response = await request(app)
                .get('/api/v1/optimization/metrics/1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.provider.name).toBe('Dr. Jane Smith');
            expect(response.body.data.metrics).toBeDefined();
        });
    });

    describe('GET /api/v1/optimization/recommendations/:providerId', () => {
        test('should filter recommendations by priority', async () => {
            // Mock provider exists
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    id: 1,
                    nombres: 'Dr. Bob',
                    apellidos: 'Johnson',
                    especialidad: 'Surgery'
                }]
            });

            // Mock optimization engine methods
            const OptimizationEngine = require('../services/optimizationEngine');
            const mockEngine = new OptimizationEngine();
            mockEngine.getScheduleData = jest.fn().mockResolvedValue([]);
            mockEngine.analyzeSchedulePerformance = jest.fn().mockResolvedValue({});
            mockEngine.generateOptimizationRecommendations = jest.fn().mockResolvedValue([
                { priority: 'HIGH', type: 'UTILIZATION' },
                { priority: 'MEDIUM', type: 'WAIT_TIME' },
                { priority: 'LOW', type: 'LOAD_BALANCING' }
            ]);

            const response = await request(app)
                .get('/api/v1/optimization/recommendations/1?priority=high');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.filteredCount).toBe(1);
            expect(response.body.data.totalRecommendations).toBe(3);
        });
    });

    describe('POST /api/v1/optimization/simulate', () => {
        test('should validate modifications array', async () => {
            const response = await request(app)
                .post('/api/v1/optimization/simulate')
                .send({
                    providerId: '1',
                    date: '2024-01-01',
                    modifications: 'not-an-array'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.details).toContain('Modifications must be an array');
        });

        test('should return simulation results', async () => {
            // Mock provider exists
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    id: 1,
                    nombres: 'Dr. Alice',
                    apellidos: 'Brown',
                    especialidad: 'Internal Medicine'
                }]
            });

            // Mock optimization engine methods
            const OptimizationEngine = require('../services/optimizationEngine');
            const mockEngine = new OptimizationEngine();
            mockEngine.getCurrentSchedule = jest.fn().mockResolvedValue([]);
            mockEngine.analyzeSchedulePerformance = jest.fn().mockResolvedValue({
                utilization: 0.7,
                averageWaitTime: 15
            });
            mockEngine.simulateOptimizedMetrics = jest.fn().mockResolvedValue({
                utilization: 0.8,
                averageWaitTime: 10
            });
            mockEngine.calculateImprovementMetrics = jest.fn().mockResolvedValue({
                utilizationImprovement: 0.1,
                waitTimeReduction: 5
            });
            mockEngine.calculateOptimizationScore = jest.fn().mockReturnValue(85);

            const response = await request(app)
                .post('/api/v1/optimization/simulate')
                .send({
                    providerId: '1',
                    date: '2024-01-01',
                    modifications: [
                        { type: 'BUFFER_ADJUSTMENT', expectedWaitTimeReduction: 3 }
                    ]
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.provider.name).toBe('Dr. Alice Brown');
            expect(response.body.data.optimizationScore).toBe(85);
        });
    });
});