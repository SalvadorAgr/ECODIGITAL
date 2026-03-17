/**
 * Integration System Tests
 * Tests the complete integration between Node.js backend and Python services
 */

const request = require('supertest');
const { getPool } = require('../db');
const integrationService = require('../services/integrationService');
const enhancedErrorHandler = require('../middleware/enhancedErrorHandler');

// Mock the Python service calls for testing
jest.mock('../services/integrationService');

// Mock database
const mockQuery = jest.fn();
jest.mock('../db', () => ({
    getPool: () => ({
        query: mockQuery
    })
}));

describe('Integration System Tests', () => {
    let app;
    let pool;

    beforeAll(async () => {
        // Setup test app
        const express = require('express');
        app = express();
        app.use(express.json());

        // Add enhanced error handling
        app.use(enhancedErrorHandler.requestId());

        // Add test routes
        const enhancedAppointmentRoutes = require('../routes/enhancedAppointmentRoutes');
        app.use('/api/v1/appointments', enhancedAppointmentRoutes);
        app.use(enhancedErrorHandler.handleError());

        pool = getPool();
    });

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup default db mock responses
        mockQuery.mockImplementation((text, params) => {
            if (text.includes('FROM PACIENTES')) {
                return { rows: [{ id: 1, nombre: 'Test', apellido: 'Patient', activo: true }] };
            }
            if (text.includes('FROM USUARIOS')) {
                return { rows: [{ id: 1, nombres: 'Dr.', apellidos: 'Test', activo: true, especialidad: 'GENERAL' }] };
            }
            if (text.includes('FROM CITAS')) {
                return { rows: [{
                    id: 123,
                    fecha_hora: new Date(Date.now() + 86400000).toISOString(),
                    duracion_minutos: 30,
                    medico_id: 1,
                    activo: true,
                    equipos_necesarios: '[]'
                }]};
            }
            return { rows: [] };
        });
    });

    describe('Enhanced Appointment Creation', () => {
        test('should create appointment with priority calculation', async () => {
            // Mock integration service responses
            integrationService.calculatePriorityScore.mockResolvedValue(75);
            integrationService.checkScheduleExceptions.mockResolvedValue([]);
            integrationService.createEnhancedAppointment.mockResolvedValue({
                success: true,
                appointmentId: 123,
                priorityScore: 75
            });

            const appointmentData = {
                id_paciente: 1,
                medico_id: 1,
                fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                duracion_minutos: 30,
                tipo_cita: 'CONSULTA_GENERAL',
                motivo: 'Consulta de rutina',
                prioridad: 'ALTA'
            };

            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(appointmentData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(integrationService.createEnhancedAppointment).toHaveBeenCalledWith(
                expect.objectContaining({
                    prioridad: 'ALTA',
                    tipo_cita: 'CONSULTA_GENERAL'
                }),
                expect.any(Number)
            );
        });

        test('should handle resource conflicts', async () => {
            integrationService.createEnhancedAppointment.mockRejectedValue(
                enhancedErrorHandler.resourceConflictError([
                    {
                        resource_id: 1,
                        resource_name: 'Sala 1',
                        conflict_type: 'time_overlap',
                        description: 'Resource already booked'
                    }
                ])
            );

            const appointmentData = {
                id_paciente: 1,
                medico_id: 1,
                fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                tipo_cita: 'CONSULTA_GENERAL',
                motivo: 'Test appointment',
                recursos: [{ id: 1, nombre: 'Sala 1' }]
            };

            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(appointmentData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error_type).toBe('RESOURCE_CONFLICT');
        });

        test('should handle schedule conflicts', async () => {
            integrationService.createEnhancedAppointment.mockRejectedValue(
                enhancedErrorHandler.scheduleConflictError([
                    {
                        tipo_excepcion: 'VACACIONES',
                        motivo: 'Doctor on vacation',
                        fecha_inicio: new Date().toISOString(),
                        fecha_fin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ])
            );

            const appointmentData = {
                id_paciente: 1,
                medico_id: 1,
                fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                tipo_cita: 'CONSULTA_GENERAL',
                motivo: 'Test appointment'
            };

            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(appointmentData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error_type).toBe('SCHEDULE_CONFLICT');
            expect(response.body.suggestions).toBeDefined();
        });
    });

    describe('Priority Management', () => {
        test('should assign priority to appointment', async () => {
            integrationService.assignAppointmentPriority.mockResolvedValue(true);
            integrationService.getEnhancedAppointmentData.mockResolvedValue({
                id: 123,
                prioridad: 'URGENTE',
                puntuacion_prioridad: 200,
                priority_info: {
                    prioridad_actual: 'URGENTE',
                    puntuacion_prioridad: 200
                }
            });

            const response = await request(app)
                .post('/api/v1/appointments/123/assign-priority')
                .send({
                    prioridad: 'URGENTE',
                    motivo: 'Patient condition worsened',
                    es_urgente: true
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(integrationService.assignAppointmentPriority).toHaveBeenCalledWith(
                123, 'URGENTE', expect.any(Number), 'Patient condition worsened', true, undefined
            );
        });

        test('should get priority-ordered appointments', async () => {
            const mockAppointments = [
                {
                    id: 1,
                    numero_cita: 'APT001',
                    prioridad: 'URGENTE',
                    puntuacion_prioridad: 200,
                    es_urgente: true,
                    fecha_hora: new Date().toISOString(),
                    nombre_paciente: 'John Doe',
                    nombre_medico: 'Dr. Smith'
                },
                {
                    id: 2,
                    numero_cita: 'APT002',
                    prioridad: 'ALTA',
                    puntuacion_prioridad: 100,
                    es_urgente: false,
                    fecha_hora: new Date().toISOString(),
                    nombre_paciente: 'Jane Doe',
                    nombre_medico: 'Dr. Johnson'
                }
            ];

            integrationService.getPriorityOrderedAppointments.mockResolvedValue(mockAppointments);

            const response = await request(app)
                .get('/api/v1/appointments/priority-ordered')
                .query({ limit: 10 })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0].prioridad).toBe('URGENTE');
        });
    });

    describe('Conflict Detection', () => {
        test('should check appointment conflicts', async () => {
            integrationService.checkScheduleExceptions.mockResolvedValue([]);
            integrationService.getResourceConflicts.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/v1/appointments/123/check-conflicts')
                .query({
                    fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    duracion_minutos: 30
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.has_conflicts).toBe(false);
        });

        test('should detect schedule exceptions', async () => {
            integrationService.checkScheduleExceptions.mockResolvedValue([
                {
                    tipo_excepcion: 'FERIADO',
                    motivo: 'National Holiday',
                    fecha_inicio: new Date().toISOString(),
                    fecha_fin: new Date().toISOString()
                }
            ]);

            const response = await request(app)
                .get('/api/v1/appointments/123/check-conflicts')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.has_conflicts).toBe(true);
            expect(response.body.data.schedule_exceptions).toHaveLength(1);
        });
    });

    describe('Integration Health', () => {
        test('should check integration service health', async () => {
            integrationService.healthCheck.mockResolvedValue({
                resource_manager: 'healthy',
                priority_manager: 'healthy',
                schedule_exception_manager: 'healthy',
                mobile_sync_service: 'healthy'
            });

            const response = await request(app)
                .get('/api/v1/appointments/integration/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.resource_manager).toBe('healthy');
        });

        test('should handle unhealthy services', async () => {
            integrationService.healthCheck.mockResolvedValue({
                resource_manager: 'unhealthy',
                priority_manager: 'healthy',
                schedule_exception_manager: 'healthy',
                mobile_sync_service: 'unhealthy'
            });

            const response = await request(app)
                .get('/api/v1/appointments/integration/health')
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('unhealthy');
        });
    });

    describe('Error Handling', () => {
        test('should handle validation errors', async () => {
            const invalidData = {
                // Missing required fields
                motivo: 'Test'
            };

            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Validation failed');
            expect(response.body.details).toBeInstanceOf(Array);
        });

        test('should handle integration service errors', async () => {
            integrationService.createEnhancedAppointment.mockRejectedValue(
                new Error('Python service unavailable')
            );

            const appointmentData = {
                id_paciente: 1,
                medico_id: 1,
                fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                tipo_cita: 'CONSULTA_GENERAL',
                motivo: 'Test appointment'
            };

            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(appointmentData)
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Python service unavailable');
        });

        test('should include request ID in error responses', async () => {
            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send({})
                .expect(400);

            expect(response.body.request_id).toBeDefined();
            expect(response.headers['x-request-id']).toBeDefined();
        });
    });

    describe('Enhanced Appointment Updates', () => {
        test('should update appointment with conflict checking', async () => {
            integrationService.updateEnhancedAppointment.mockResolvedValue({
                success: true,
                appointmentId: 123,
                priorityScore: 85
            });
            integrationService.getEnhancedAppointmentData.mockResolvedValue({
                id: 123,
                prioridad: 'ALTA',
                puntuacion_prioridad: 85
            });

            const updates = {
                fecha_hora: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                prioridad: 'ALTA'
            };

            const response = await request(app)
                .put('/api/v1/appointments/enhanced/123')
                .send(updates)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(integrationService.updateEnhancedAppointment).toHaveBeenCalledWith(
                123, updates, expect.any(Number)
            );
        });
    });

    describe('Performance and Reliability', () => {
        test('should handle concurrent requests', async () => {
            integrationService.getPriorityOrderedAppointments.mockResolvedValue([]);

            const requests = Array(5).fill().map(() =>
                request(app)
                    .get('/api/v1/appointments/priority-ordered')
                    .expect(200)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.body.success).toBe(true);
            });
        });

        test('should timeout on slow integration calls', async () => {
            integrationService.createEnhancedAppointment.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 35000))
            );

            const appointmentData = {
                id_paciente: 1,
                medico_id: 1,
                fecha_hora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                tipo_cita: 'CONSULTA_GENERAL',
                motivo: 'Test appointment'
            };

            // This should timeout before 35 seconds
            const response = await request(app)
                .post('/api/v1/appointments/enhanced')
                .send(appointmentData)
                .timeout(5000)
                .expect(500);

            expect(response.body.success).toBe(false);
        }, 10000);
    });
});

describe('Integration Service Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Error Handling', () => {
        test('should create resource conflict error', () => {
            const conflicts = [
                {
                    resource_id: 1,
                    resource_name: 'Sala 1',
                    conflict_type: 'time_overlap',
                    description: 'Resource already booked'
                }
            ];

            const error = enhancedErrorHandler.resourceConflictError(conflicts);

            expect(error.message).toBe('Resource scheduling conflict detected');
            expect(error.type).toBe('RESOURCE_CONFLICT');
            expect(error.statusCode).toBe(409);
            expect(error.details.conflicts).toEqual(conflicts);
        });

        test('should create schedule conflict error', () => {
            const exceptions = [
                {
                    tipo_excepcion: 'VACACIONES',
                    motivo: 'Doctor on vacation'
                }
            ];

            const error = enhancedErrorHandler.scheduleConflictError(exceptions);

            expect(error.message).toBe('Provider schedule conflict detected');
            expect(error.type).toBe('SCHEDULE_CONFLICT');
            expect(error.statusCode).toBe(409);
            expect(error.details.schedule_exceptions).toEqual(exceptions);
        });

        test('should create priority error', () => {
            const error = enhancedErrorHandler.priorityError(
                'Invalid priority level',
                { provided: 'INVALID', valid: ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] }
            );

            expect(error.message).toBe('Invalid priority level');
            expect(error.type).toBe('PRIORITY_ERROR');
            expect(error.statusCode).toBe(400);
            expect(error.details.provided).toBe('INVALID');
        });
    });

    describe('Request ID Generation', () => {
        test('should generate unique request IDs', () => {
            const id1 = enhancedErrorHandler.generateRequestId();
            const id2 = enhancedErrorHandler.generateRequestId();

            expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });
    });
});