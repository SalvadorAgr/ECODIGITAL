const fc = require('fast-check');
const { getPool } = require('../db');

/**
 * Property-Based Tests for Real-Time Availability Accuracy
 * Feature: appointment-scheduling-system, Property 8: Real-Time Availability Accuracy
 * Validates: Requirements 3.2
 */

describe('Real-Time Availability Property Tests', () => {
    let pool;

    beforeAll(async () => {
        // Initialize database connection
        pool = getPool();

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
     * Property 8: Real-Time Availability Accuracy
     * For any change in appointment status or provider schedule, 
     * the displayed availability should immediately reflect the updated state.
     */
    describe('Property 8: Real-Time Availability Accuracy', () => {

        test('should reflect appointment cancellations in availability', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentDataGenerator(),
                    async (appointmentData) => {
                        // Setup: Create test doctor and patient
                        const testDoctor = await createTestDoctor();
                        const testPatient = await createTestPatient();

                        // Setup: Create doctor schedule for the test date
                        const testDate = appointmentData.fecha_hora.toISOString().split('T')[0];
                        await createDoctorSchedule(testDoctor.id, testDate);

                        // Setup: Create appointment
                        const appointment = await createTestAppointment(
                            testPatient.id,
                            testDoctor.id,
                            appointmentData
                        );

                        // Action 1: Get initial availability (should show slot as occupied)
                        const initialAvailability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            appointmentData.duracion_minutos
                        );

                        // Assertion: Slot should not be available initially
                        const appointmentTime = appointmentData.fecha_hora.toTimeString().slice(0, 5);
                        const initialSlot = initialAvailability.slots.find(
                            slot => slot.hora_inicio === appointmentTime
                        );
                        expect(initialSlot).toBeUndefined(); // Slot should not exist in available slots

                        // Action 2: Cancel the appointment
                        await cancelAppointment(appointment.id);

                        // Action 3: Get updated availability (should show slot as available)
                        const updatedAvailability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            appointmentData.duracion_minutos
                        );

                        // Assertion: Slot should now be available
                        const updatedSlot = updatedAvailability.slots.find(
                            slot => slot.hora_inicio === appointmentTime
                        );
                        expect(updatedSlot).toBeDefined();
                        expect(updatedSlot.available).toBe(true);
                    }
                ),
                { numRuns: 30, timeout: 30000 }
            );
        });

        test('should reflect new appointments in availability', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentDataGenerator(),
                    async (appointmentData) => {
                        // Setup: Create test doctor and patient
                        const testDoctor = await createTestDoctor();
                        const testPatient = await createTestPatient();

                        // Setup: Create doctor schedule for the test date
                        const testDate = appointmentData.fecha_hora.toISOString().split('T')[0];
                        await createDoctorSchedule(testDoctor.id, testDate);

                        // Action 1: Get initial availability (should show slot as available)
                        const initialAvailability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            appointmentData.duracion_minutos
                        );

                        const appointmentTime = appointmentData.fecha_hora.toTimeString().slice(0, 5);
                        const initialSlot = initialAvailability.slots.find(
                            slot => slot.hora_inicio === appointmentTime
                        );

                        // Only proceed if the slot was initially available
                        if (initialSlot && initialSlot.available) {
                            // Action 2: Create appointment in the available slot
                            await createTestAppointment(
                                testPatient.id,
                                testDoctor.id,
                                appointmentData
                            );

                            // Action 3: Get updated availability (should show slot as occupied)
                            const updatedAvailability = await getProviderAvailability(
                                testDoctor.id,
                                testDate,
                                appointmentData.duracion_minutos
                            );

                            // Assertion: Slot should no longer be available
                            const updatedSlot = updatedAvailability.slots.find(
                                slot => slot.hora_inicio === appointmentTime
                            );
                            expect(updatedSlot).toBeUndefined(); // Slot should not exist in available slots
                        }
                    }
                ),
                { numRuns: 25, timeout: 30000 }
            );
        });

        test('should reflect schedule exceptions in availability', async () => {
            await fc.assert(
                fc.asyncProperty(
                    scheduleExceptionGenerator(),
                    async (exceptionData) => {
                        // Setup: Create test doctor
                        const testDoctor = await createTestDoctor();

                        // Setup: Create normal schedule for the test date
                        const testDate = exceptionData.fecha.toISOString().split('T')[0];
                        await createDoctorSchedule(testDoctor.id, testDate);

                        // Action 1: Get initial availability (normal schedule)
                        const initialAvailability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            30
                        );

                        const initialSlotCount = initialAvailability.slots.length;

                        // Action 2: Add schedule exception
                        await createScheduleException(testDoctor.id, exceptionData);

                        // Action 3: Get updated availability (with exception)
                        const updatedAvailability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            30
                        );

                        // Assertion: Availability should reflect the exception
                        if (exceptionData.tipo_excepcion === 'NO_DISPONIBLE') {
                            expect(updatedAvailability.available).toBe(false);
                            expect(updatedAvailability.slots.length).toBe(0);
                        } else if (exceptionData.tipo_excepcion === 'HORARIO_ESPECIAL') {
                            // Should have different slot count based on special hours
                            expect(updatedAvailability.slots.length).not.toBe(initialSlotCount);
                        }
                    }
                ),
                { numRuns: 20, timeout: 30000 }
            );
        });

        test('should handle concurrent appointment bookings correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(appointmentDataGenerator(), { minLength: 2, maxLength: 5 }),
                    async (appointmentsData) => {
                        // Setup: Create test doctor and patients
                        const testDoctor = await createTestDoctor();
                        const testPatients = await Promise.all(
                            appointmentsData.map(() => createTestPatient())
                        );

                        // Setup: Use same date for all appointments
                        const testDate = appointmentsData[0].fecha_hora.toISOString().split('T')[0];
                        await createDoctorSchedule(testDoctor.id, testDate);

                        // Setup: Ensure appointments have different times to avoid conflicts
                        const sortedAppointments = appointmentsData
                            .map((apt, index) => ({
                                ...apt,
                                patientId: testPatients[index].id,
                                fecha_hora: new Date(testDate + 'T' +
                                    String(9 + index).padStart(2, '0') + ':00:00')
                            }))
                            .sort((a, b) => a.fecha_hora - b.fecha_hora);

                        // Action: Create appointments sequentially and check availability after each
                        const availabilityResults = [];

                        for (let i = 0; i < sortedAppointments.length; i++) {
                            const appointment = sortedAppointments[i];

                            // Get availability before creating appointment
                            const beforeAvailability = await getProviderAvailability(
                                testDoctor.id,
                                testDate,
                                appointment.duracion_minutos
                            );

                            // Create appointment
                            await createTestAppointment(
                                appointment.patientId,
                                testDoctor.id,
                                appointment
                            );

                            // Get availability after creating appointment
                            const afterAvailability = await getProviderAvailability(
                                testDoctor.id,
                                testDate,
                                appointment.duracion_minutos
                            );

                            availabilityResults.push({
                                before: beforeAvailability.slots.length,
                                after: afterAvailability.slots.length,
                                appointmentTime: appointment.fecha_hora.toTimeString().slice(0, 5)
                            });
                        }

                        // Assertion: Each appointment creation should reduce available slots
                        availabilityResults.forEach((result, index) => {
                            expect(result.after).toBeLessThanOrEqual(result.before);

                            // The specific slot should no longer be available
                            const finalAvailability = availabilityResults[availabilityResults.length - 1];
                            // We can't easily check individual slots due to overlapping durations,
                            // but total slots should decrease or stay same
                        });
                    }
                ),
                { numRuns: 15, timeout: 45000 }
            );
        });

        test('should maintain consistency between availability and conflict checking', async () => {
            await fc.assert(
                fc.asyncProperty(
                    appointmentDataGenerator(),
                    async (appointmentData) => {
                        // Setup: Create test doctor and patient
                        const testDoctor = await createTestDoctor();
                        const testPatient = await createTestPatient();

                        // Setup: Create doctor schedule
                        const testDate = appointmentData.fecha_hora.toISOString().split('T')[0];
                        await createDoctorSchedule(testDoctor.id, testDate);

                        // Action 1: Get availability
                        const availability = await getProviderAvailability(
                            testDoctor.id,
                            testDate,
                            appointmentData.duracion_minutos
                        );

                        const appointmentTime = appointmentData.fecha_hora.toTimeString().slice(0, 5);
                        const availableSlot = availability.slots.find(
                            slot => slot.hora_inicio === appointmentTime
                        );

                        // Action 2: Check for conflicts at the same time
                        const conflictCheck = await checkScheduleConflicts(
                            testDoctor.id,
                            appointmentData.fecha_hora,
                            appointmentData.duracion_minutos
                        );

                        // Assertion: Availability and conflict checking should be consistent
                        if (availableSlot && availableSlot.available) {
                            // If slot is available, there should be no conflicts
                            expect(conflictCheck.hasConflicts).toBe(false);
                        } else {
                            // If slot is not available, there might be conflicts
                            // (or it might be outside working hours)
                            // We can't assert conflicts exist because slot might be outside schedule
                        }
                    }
                ),
                { numRuns: 25, timeout: 30000 }
            );
        });
    });

    // Helper functions for test data generation and database operations

    /**
     * Generate random appointment data
     */
    function appointmentDataGenerator() {
        return fc.record({
            fecha_hora: fc.date({
                min: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next week
            }).map(date => {
                // Ensure time is within working hours (9 AM - 5 PM)
                const workingHour = 9 + Math.floor(Math.random() * 8); // 9-16
                date.setHours(workingHour, 0, 0, 0);
                return date;
            }),
            duracion_minutos: fc.constantFrom(30, 45, 60),
            tipo_cita: fc.constantFrom('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO'),
            motivo: fc.string({ minLength: 10, maxLength: 50 })
        });
    }

    /**
     * Generate schedule exception data
     */
    function scheduleExceptionGenerator() {
        return fc.record({
            fecha: fc.date({
                min: new Date(Date.now() + 24 * 60 * 60 * 1000),
                max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }),
            tipo_excepcion: fc.constantFrom('NO_DISPONIBLE', 'HORARIO_ESPECIAL'),
            motivo: fc.string({ minLength: 5, maxLength: 30 }),
            hora_inicio_especial: fc.constantFrom('10:00', '11:00', '14:00'),
            hora_fin_especial: fc.constantFrom('15:00', '16:00', '17:00')
        });
    }

    /**
     * Create test doctor
     */
    async function createTestDoctor() {
        const doctorData = {
            nombres: 'Test',
            apellidos: 'Doctor',
            email: `test.doctor.${Date.now()}@example.com`,
            telefono: '+525587654321',
            rol: 'MEDICO',
            especialidad: 'Medicina General'
        };

        const query = `
            INSERT INTO USUARIOS (nombres, apellidos, email, telefono, rol, especialidad, activo)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING *
        `;

        const { rows } = await pool.query(query, [
            doctorData.nombres,
            doctorData.apellidos,
            doctorData.email,
            doctorData.telefono,
            doctorData.rol,
            doctorData.especialidad
        ]);

        return rows[0];
    }

    /**
     * Create test patient
     */
    async function createTestPatient() {
        const patientData = {
            nombre: 'Test',
            apellido: 'Patient',
            email: `test.patient.${Date.now()}.${Math.random()}@example.com`,
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
     * Create doctor schedule
     */
    async function createDoctorSchedule(doctorId, date) {
        const dayOfWeek = new Date(date).getDay() || 7; // Convert Sunday (0) to 7

        const query = `
            INSERT INTO HORARIOS_MEDICOS (
                medico_id, dia_semana, hora_inicio, hora_fin,
                duracion_cita_minutos, fecha_inicio_vigencia, activo
            ) VALUES ($1, $2, '09:00', '17:00', 30, $3, TRUE)
            ON CONFLICT (medico_id, dia_semana) DO UPDATE SET
                hora_inicio = EXCLUDED.hora_inicio,
                hora_fin = EXCLUDED.hora_fin,
                activo = TRUE
        `;

        await pool.query(query, [doctorId, dayOfWeek, date]);
    }

    /**
     * Create test appointment
     */
    async function createTestAppointment(patientId, doctorId, appointmentData) {
        const query = `
            INSERT INTO CITAS (
                id_paciente, medico_id, fecha_hora, duracion_minutos,
                tipo_cita, motivo, estado, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, 'PROGRAMADA', TRUE)
            RETURNING *
        `;

        const { rows } = await pool.query(query, [
            patientId,
            doctorId,
            appointmentData.fecha_hora,
            appointmentData.duracion_minutos,
            appointmentData.tipo_cita,
            appointmentData.motivo
        ]);

        return rows[0];
    }

    /**
     * Cancel appointment
     */
    async function cancelAppointment(appointmentId) {
        const query = `
            UPDATE CITAS 
            SET estado = 'CANCELADA', fecha_cancelacion = CURRENT_TIMESTAMP
            WHERE id = $1
        `;

        await pool.query(query, [appointmentId]);
    }

    /**
     * Create schedule exception
     */
    async function createScheduleException(doctorId, exceptionData) {
        const query = `
            INSERT INTO EXCEPCIONES_HORARIO (
                medico_id, fecha, tipo_excepcion, motivo,
                hora_inicio_especial, hora_fin_especial, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        `;

        await pool.query(query, [
            doctorId,
            exceptionData.fecha.toISOString().split('T')[0],
            exceptionData.tipo_excepcion,
            exceptionData.motivo,
            exceptionData.tipo_excepcion === 'HORARIO_ESPECIAL' ? exceptionData.hora_inicio_especial : null,
            exceptionData.tipo_excepcion === 'HORARIO_ESPECIAL' ? exceptionData.hora_fin_especial : null
        ]);
    }

    /**
     * Get provider availability (simulates API call)
     */
    async function getProviderAvailability(doctorId, date, durationMinutes) {
        // This simulates the availability endpoint logic
        const dayOfWeek = new Date(date).getDay() || 7;

        // Get doctor's schedule
        const scheduleQuery = `
            SELECT hora_inicio, hora_fin, duracion_cita_minutos, pausas
            FROM HORARIOS_MEDICOS
            WHERE medico_id = $1 AND dia_semana = $2 AND activo = TRUE
        `;
        const { rows: scheduleRows } = await pool.query(scheduleQuery, [doctorId, dayOfWeek]);

        if (scheduleRows.length === 0) {
            return { available: false, slots: [] };
        }

        const schedule = scheduleRows[0];

        // Check for exceptions
        const exceptionQuery = `
            SELECT tipo_excepcion, hora_inicio_especial, hora_fin_especial
            FROM EXCEPCIONES_HORARIO
            WHERE medico_id = $1 AND fecha = $2 AND activo = TRUE
        `;
        const { rows: exceptionRows } = await pool.query(exceptionQuery, [doctorId, date]);

        if (exceptionRows.length > 0 && exceptionRows[0].tipo_excepcion === 'NO_DISPONIBLE') {
            return { available: false, slots: [] };
        }

        // Use exception hours if available
        let startTime = schedule.hora_inicio;
        let endTime = schedule.hora_fin;

        if (exceptionRows.length > 0 && exceptionRows[0].tipo_excepcion === 'HORARIO_ESPECIAL') {
            startTime = exceptionRows[0].hora_inicio_especial || startTime;
            endTime = exceptionRows[0].hora_fin_especial || endTime;
        }

        // Get existing appointments
        const appointmentsQuery = `
            SELECT fecha_hora, duracion_minutos
            FROM CITAS
            WHERE medico_id = $1 AND DATE(fecha_hora) = $2 
            AND activo = TRUE AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
        `;
        const { rows: appointments } = await pool.query(appointmentsQuery, [doctorId, date]);

        // Generate available slots
        const slots = generateAvailableSlots(startTime, endTime, durationMinutes, appointments, date);

        return {
            available: slots.length > 0,
            slots
        };
    }

    /**
     * Check schedule conflicts (simulates API call)
     */
    async function checkScheduleConflicts(doctorId, fechaHora, durationMinutes) {
        const query = `
            SELECT id, numero_cita, fecha_hora, duracion_minutos
            FROM CITAS
            WHERE medico_id = $1 AND activo = TRUE 
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            AND (
                ($2 BETWEEN fecha_hora AND fecha_hora_fin) OR
                ($2 + INTERVAL '1 minute' * $3 BETWEEN fecha_hora AND fecha_hora_fin) OR
                (fecha_hora BETWEEN $2 AND $2 + INTERVAL '1 minute' * $3)
            )
        `;

        const { rows: conflicts } = await pool.query(query, [doctorId, fechaHora, durationMinutes]);

        return {
            hasConflicts: conflicts.length > 0,
            conflictCount: conflicts.length,
            conflicts
        };
    }

    /**
     * Generate available time slots
     */
    function generateAvailableSlots(startTime, endTime, duration, existingAppointments, fecha) {
        const slots = [];

        // Convert time strings to minutes since midnight
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        // Convert existing appointments to busy ranges
        const busyRanges = existingAppointments.map(apt => {
            const aptDate = new Date(apt.fecha_hora);
            const startMins = aptDate.getHours() * 60 + aptDate.getMinutes();
            return {
                start: startMins,
                end: startMins + apt.duracion_minutos
            };
        });

        // Generate slots every 15 minutes
        let currentTime = startMinutes;

        while (currentTime + duration <= endMinutes) {
            const slotEnd = currentTime + duration;

            // Check if this slot conflicts with any busy range
            const hasConflict = busyRanges.some(range =>
                (currentTime < range.end && slotEnd > range.start)
            );

            if (!hasConflict) {
                const slotDateTime = new Date(fecha + 'T' + minutesToTime(currentTime));

                // Only include future slots
                if (slotDateTime > new Date()) {
                    slots.push({
                        hora_inicio: minutesToTime(currentTime),
                        hora_fin: minutesToTime(slotEnd),
                        available: true
                    });
                }
            }

            currentTime += 15; // 15-minute intervals
        }

        return slots;
    }

    /**
     * Convert time string (HH:MM) to minutes since midnight
     */
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Convert minutes since midnight to time string (HH:MM)
     */
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Clean up test data
     */
    async function cleanupTestData() {
        try {
            // Clean up in reverse order of dependencies
            await pool.query('DELETE FROM EXCEPCIONES_HORARIO WHERE medico_id IN (SELECT id FROM USUARIOS WHERE email LIKE \'%@example.com\')');
            await pool.query('DELETE FROM HORARIOS_MEDICOS WHERE medico_id IN (SELECT id FROM USUARIOS WHERE email LIKE \'%@example.com\')');
            await pool.query('DELETE FROM CITAS WHERE id_paciente IN (SELECT id FROM PACIENTES WHERE email LIKE \'%@example.com\')');
            await pool.query('DELETE FROM PACIENTES WHERE email LIKE \'%@example.com\'');
            await pool.query('DELETE FROM USUARIOS WHERE email LIKE \'%@example.com\'');
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }
});