const fc = require('fast-check');
const CommunicationService = require('../services/communicationService');
const { getPool } = require('../db');

/**
 * Property-Based Tests for Automated Communication Delivery
 * Feature: appointment-scheduling-system, Property 12: Automated Communication Delivery
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 3.8
 */

describe('Communication Service Property Tests', () => {
    let communicationService;
    let pool;

    beforeAll(async () => {
        // Initialize database connection
        pool = getPool();
        communicationService = new CommunicationService();

        // Ensure database is ready
        if (!pool) {
            throw new Error('Database connection not available for testing');
        }
    });

    afterAll(async () => {
        // Clean up database connections
        if (pool) {
            await pool.end();
        }
    });

    beforeEach(async () => {
        // Clean up test data before each test
        await cleanupTestData();
    });

    afterEach(async () => {
        // Clean up test data after each test
        await cleanupTestData();
    });

    /**
     * Property 12: Automated Communication Delivery
     * For any appointment event that triggers communications (reminders, confirmations, changes), 
     * the appropriate notifications should be sent via the patient's preferred communication methods.
     */
    describe('Property 12: Automated Communication Delivery', () => {

        test('should send communications for all valid appointment events', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentGenerator(),
                    communicationTypeGenerator(),
                    async (appointment, communicationType) => {
                        // Setup: Create test patient and appointment
                        const testPatient = await createTestPatient();
                        const testAppointment = {
                            ...appointment,
                            id_paciente: testPatient.id,
                            id: await createTestAppointment(testPatient.id, appointment)
                        };

                        // Setup: Set patient communication preferences
                        await setPatientPreferences(testPatient.id, {
                            metodo_preferido: 'email',
                            recordatorios_habilitados: true,
                            confirmaciones_habilitadas: true,
                            notificaciones_lista_espera: true
                        });

                        // Action: Send communication based on type
                        let result;
                        switch (communicationType) {
                            case 'reminder':
                                result = await communicationService.sendReminder(testAppointment, '24h');
                                break;
                            case 'confirmation':
                                result = await communicationService.sendConfirmationRequest(testAppointment);
                                break;
                            case 'cancellation':
                                result = await communicationService.sendCancellationNotification(testAppointment, 'Test cancellation');
                                break;
                            default:
                                result = { success: false, message: 'Unknown communication type' };
                        }

                        // Assertion: Communication should be successful
                        expect(result.success).toBe(true);

                        // Assertion: Communication should be recorded in database
                        if (result.success && result.data) {
                            const communicationRecord = await getCommunicationRecord(result.data.id);
                            expect(communicationRecord).toBeDefined();
                            expect(communicationRecord.tipo).toBe(communicationType);
                            expect(communicationRecord.metodo).toBe('email');
                            expect(communicationRecord.destinatario).toBe(testPatient.email);
                        }
                    }
                ),
                { numRuns: 50, timeout: 30000 }
            );
        });

        test('should respect patient communication preferences', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentGenerator(),
                    communicationPreferencesGenerator(),
                    async (appointment, preferences) => {
                        // Setup: Create test patient and appointment
                        const testPatient = await createTestPatient();
                        const testAppointment = {
                            ...appointment,
                            id_paciente: testPatient.id,
                            id: await createTestAppointment(testPatient.id, appointment)
                        };

                        // Setup: Set patient communication preferences
                        await setPatientPreferences(testPatient.id, preferences);

                        // Action: Attempt to send reminder
                        const result = await communicationService.sendReminder(testAppointment, '24h');

                        // Assertion: Communication should respect preferences
                        if (preferences.recordatorios_habilitados === false) {
                            expect(result.success).toBe(false);
                            expect(result.skipped).toBe(true);
                        } else {
                            expect(result.success).toBe(true);

                            if (result.data) {
                                const communicationRecord = await getCommunicationRecord(result.data.id);
                                expect(communicationRecord.metodo).toBe(preferences.metodo_preferido);
                            }
                        }
                    }
                ),
                { numRuns: 30, timeout: 30000 }
            );
        });

        test('should use correct communication method based on preferences', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentGenerator(),
                    fc.constantFrom('email', 'sms'),
                    async (appointment, preferredMethod) => {
                        // Setup: Create test patient and appointment
                        const testPatient = await createTestPatient();
                        const testAppointment = {
                            ...appointment,
                            id_paciente: testPatient.id,
                            id: await createTestAppointment(testPatient.id, appointment)
                        };

                        // Setup: Set communication method preference
                        await setPatientPreferences(testPatient.id, {
                            metodo_preferido: preferredMethod,
                            recordatorios_habilitados: true
                        });

                        // Action: Send reminder
                        const result = await communicationService.sendReminder(testAppointment, '24h');

                        // Assertion: Should use preferred method
                        expect(result.success).toBe(true);

                        if (result.data) {
                            const communicationRecord = await getCommunicationRecord(result.data.id);
                            expect(communicationRecord.metodo).toBe(preferredMethod);
                        }
                    }
                ),
                { numRuns: 20, timeout: 30000 }
            );
        });

        test('should handle template processing correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentWithDetailsGenerator(),
                    async (appointmentDetails) => {
                        // Setup: Create test patient and appointment with specific details
                        const testPatient = await createTestPatient();
                        const testAppointment = {
                            ...appointmentDetails,
                            id_paciente: testPatient.id,
                            id: await createTestAppointment(testPatient.id, appointmentDetails),
                            nombre_paciente: `${testPatient.nombre} ${testPatient.apellido}`,
                            email: testPatient.email
                        };

                        // Setup: Enable communications
                        await setPatientPreferences(testPatient.id, {
                            metodo_preferido: 'email',
                            recordatorios_habilitados: true
                        });

                        // Action: Send reminder
                        const result = await communicationService.sendReminder(testAppointment, '24h');

                        // Assertion: Communication should be successful
                        expect(result.success).toBe(true);

                        if (result.data) {
                            const communicationRecord = await getCommunicationRecord(result.data.id);

                            // Assertion: Template variables should be processed
                            expect(communicationRecord.contenido).toContain(testPatient.nombre);
                            expect(communicationRecord.contenido).not.toContain('{{nombre_paciente}}');

                            if (appointmentDetails.fecha_hora) {
                                const expectedDate = new Date(appointmentDetails.fecha_hora).toLocaleDateString('es-ES');
                                expect(communicationRecord.contenido).toContain(expectedDate);
                            }
                        }
                    }
                ),
                { numRuns: 25, timeout: 30000 }
            );
        });

        test('should track communication delivery status', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentGenerator(),
                    async (appointment) => {
                        // Setup: Create test patient and appointment
                        const testPatient = await createTestPatient();
                        const testAppointment = {
                            ...appointment,
                            id_paciente: testPatient.id,
                            id: await createTestAppointment(testPatient.id, appointment)
                        };

                        // Setup: Enable communications
                        await setPatientPreferences(testPatient.id, {
                            metodo_preferido: 'email',
                            recordatorios_habilitados: true
                        });

                        // Action: Send reminder
                        const result = await communicationService.sendReminder(testAppointment, '24h');

                        // Assertion: Communication should be tracked
                        expect(result.success).toBe(true);

                        if (result.data) {
                            const communicationRecord = await getCommunicationRecord(result.data.id);

                            // Assertion: Should have delivery tracking fields
                            expect(communicationRecord.estado).toBeDefined();
                            expect(communicationRecord.fecha_envio).toBeDefined();
                            expect(communicationRecord.intentos_envio).toBeGreaterThan(0);

                            // Assertion: Should have external ID for tracking
                            if (communicationRecord.estado === 'sent') {
                                expect(communicationRecord.id_externo).toBeDefined();
                            }
                        }
                    }
                ),
                { numRuns: 20, timeout: 30000 }
            );
        });
    });

    // Helper functions for test data generation and cleanup

    /**
     * Generate random appointment data
     */
    function appointmentGenerator() {
        return fc.record({
            fecha_hora: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
            duracion_minutos: fc.integer({ min: 15, max: 120 }),
            tipo_cita: fc.constantFrom('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL'),
            motivo: fc.string({ minLength: 10, maxLength: 100 }),
            estado: fc.constantFrom('PROGRAMADA', 'CONFIRMADA')
        });
    }

    /**
     * Generate appointment with detailed information
     */
    function appointmentWithDetailsGenerator() {
        return fc.record({
            fecha_hora: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
            duracion_minutos: fc.integer({ min: 15, max: 120 }),
            tipo_cita: fc.constantFrom('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO'),
            motivo: fc.string({ minLength: 10, maxLength: 100 }),
            sala_consulta: fc.string({ minLength: 5, maxLength: 20 }),
            nombre_medico: fc.string({ minLength: 5, maxLength: 30 })
        });
    }

    /**
     * Generate communication type
     */
    function communicationTypeGenerator() {
        return fc.constantFrom('reminder', 'confirmation', 'cancellation');
    }

    /**
     * Generate communication preferences
     */
    function communicationPreferencesGenerator() {
        return fc.record({
            metodo_preferido: fc.constantFrom('email', 'sms'),
            recordatorios_habilitados: fc.boolean(),
            confirmaciones_habilitadas: fc.boolean(),
            notificaciones_lista_espera: fc.boolean(),
            idioma: fc.constantFrom('es', 'en')
        });
    }

    /**
     * Create test patient
     */
    async function createTestPatient() {
        const patientData = {
            nombre: 'Test',
            apellido: 'Patient',
            email: `test.patient.${Date.now()}@example.com`,
            telefono: '+525512345678',
            fecha_nacimiento: '1990-01-01',
            genero: 'M'
        };

        const query = `
            INSERT INTO PACIENTES (nombre, apellido, email, telefono, fecha_nacimiento, genero, activo)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING *
        `;

        const { rows } = await pool.query(query, [
            patientData.nombre,
            patientData.apellido,
            patientData.email,
            patientData.telefono,
            patientData.fecha_nacimiento,
            patientData.genero
        ]);

        return rows[0];
    }

    /**
     * Create test appointment
     */
    async function createTestAppointment(patientId, appointmentData) {
        // Get a test doctor
        const doctorQuery = `
            SELECT id FROM USUARIOS 
            WHERE rol IN ('MEDICO', 'ADMIN') AND activo = TRUE 
            LIMIT 1
        `;
        const { rows: doctorRows } = await pool.query(doctorQuery);

        if (doctorRows.length === 0) {
            // Create a test doctor if none exists
            const createDoctorQuery = `
                INSERT INTO USUARIOS (nombres, apellidos, email, telefono, rol, activo)
                VALUES ('Test', 'Doctor', 'test.doctor@example.com', '+525587654321', 'MEDICO', TRUE)
                RETURNING id
            `;
            const { rows: newDoctorRows } = await pool.query(createDoctorQuery);
            var doctorId = newDoctorRows[0].id;
        } else {
            var doctorId = doctorRows[0].id;
        }

        const query = `
            INSERT INTO CITAS (
                id_paciente, medico_id, fecha_hora, duracion_minutos,
                tipo_cita, motivo, estado, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id
        `;

        const { rows } = await pool.query(query, [
            patientId,
            doctorId,
            appointmentData.fecha_hora,
            appointmentData.duracion_minutos,
            appointmentData.tipo_cita,
            appointmentData.motivo,
            appointmentData.estado || 'PROGRAMADA'
        ]);

        return rows[0].id;
    }

    /**
     * Set patient communication preferences
     */
    async function setPatientPreferences(patientId, preferences) {
        const query = `
            INSERT INTO PREFERENCIAS_COMUNICACION (
                id_paciente, metodo_preferido, recordatorios_habilitados,
                confirmaciones_habilitadas, notificaciones_lista_espera, idioma
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id_paciente) 
            DO UPDATE SET
                metodo_preferido = EXCLUDED.metodo_preferido,
                recordatorios_habilitados = EXCLUDED.recordatorios_habilitados,
                confirmaciones_habilitadas = EXCLUDED.confirmaciones_habilitadas,
                notificaciones_lista_espera = EXCLUDED.notificaciones_lista_espera,
                idioma = EXCLUDED.idioma
        `;

        await pool.query(query, [
            patientId,
            preferences.metodo_preferido || 'email',
            preferences.recordatorios_habilitados !== false,
            preferences.confirmaciones_habilitadas !== false,
            preferences.notificaciones_lista_espera !== false,
            preferences.idioma || 'es'
        ]);
    }

    /**
     * Get communication record by ID
     */
    async function getCommunicationRecord(communicationId) {
        const query = 'SELECT * FROM COMUNICACIONES WHERE id_comunicacion = $1';
        const { rows } = await pool.query(query, [communicationId]);
        return rows[0];
    }

    /**
     * Clean up test data
     */
    async function cleanupTestData() {
        try {
            // Clean up in reverse order of dependencies
            await pool.query('DELETE FROM COMUNICACIONES WHERE destinatario LIKE \'%@example.com\'');
            await pool.query('DELETE FROM PREFERENCIAS_COMUNICACION WHERE id_paciente IN (SELECT id FROM PACIENTES WHERE email LIKE \'%@example.com\')');
            await pool.query('DELETE FROM CITAS WHERE id_paciente IN (SELECT id FROM PACIENTES WHERE email LIKE \'%@example.com\')');
            await pool.query('DELETE FROM PACIENTES WHERE email LIKE \'%@example.com\'');
            await pool.query('DELETE FROM USUARIOS WHERE email LIKE \'%@example.com\'');
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }
});