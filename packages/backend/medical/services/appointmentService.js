/**
 * EcoDigital - Advanced Appointment Service
 * Complete appointment management service with scheduling, conflicts, and reminders
 */

const { query, transaction } = require('../db');
const notificationService = require('./notificationService');

class AppointmentService {
    constructor() {
        this.appointmentTypes = {
            CONSULTA_GENERAL: 'Consulta General',
            PRIMERA_VEZ: 'Primera Vez',
            SEGUIMIENTO: 'Seguimiento',
            CONTROL: 'Control',
            CIRUGIA: 'Cirugía',
            POST_OPERATORIO: 'Post Operatorio',
            URGENCIA: 'Urgencia'
        };

        this.appointmentStates = {
            PROGRAMADA: 'Programada',
            CONFIRMADA: 'Confirmada',
            EN_CURSO: 'En Curso',
            COMPLETADA: 'Completada',
            CANCELADA: 'Cancelada',
            NO_ASISTIO: 'No Asistió',
            REPROGRAMADA: 'Reprogramada'
        };

        this.defaultDurations = {
            CONSULTA_GENERAL: 30,
            PRIMERA_VEZ: 45,
            SEGUIMIENTO: 20,
            CONTROL: 15,
            CIRUGIA: 120,
            POST_OPERATORIO: 30,
            URGENCIA: 30
        };
    }

    /**
     * Create appointment with advanced validation and conflict detection
     */
    async createAppointment(appointmentData, userId = null) {
        try {
            const {
                patientId,
                doctorId,
                dateTime,
                duration,
                type,
                specialty,
                reason,
                notes,
                contactPhone,
                contactEmail,
                cost,
                insurance,
                copay,
                room,
                equipment,
                specialPreparation
            } = appointmentData;

            // Validate required fields
            const validation = this.validateAppointmentData(appointmentData);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check for conflicts
            const conflicts = await this.checkSchedulingConflicts(doctorId, dateTime, duration, null);
            if (conflicts.hasConflicts) {
                throw new Error(`Scheduling conflict: ${conflicts.message}`);
            }

            // Get default duration if not provided
            const appointmentDuration = duration || this.defaultDurations[type] || 30;

            const result = await transaction(async (client) => {
                // Create appointment
                const insertQuery = `
                    INSERT INTO CITAS (
                        id_paciente, medico_id, fecha_hora, duracion_minutos,
                        tipo_cita, especialidad, motivo, observaciones,
                        telefono_contacto, email_contacto,
                        costo_consulta, seguro_medico, copago,
                        sala_consulta, equipos_necesarios, preparacion_especial,
                        estado, creado_por, fecha_creacion
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PROGRAMADA', $17, NOW()
                    ) RETURNING *
                `;

                const values = [
                    patientId, doctorId, dateTime, appointmentDuration,
                    type, specialty, reason, notes,
                    contactPhone, contactEmail,
                    cost, insurance, copay,
                    room, equipment ? JSON.stringify(equipment) : null, specialPreparation,
                    userId
                ];

                const { rows } = await client.query(insertQuery, values);
                const appointment = rows[0];

                // Get complete appointment info
                const completeQuery = `
                    SELECT 
                        c.*,
                        CONCAT(p.nombre, ' ', p.apellido) as patient_name,
                        p.telefono as patient_phone,
                        p.email as patient_email,
                        CONCAT(u.nombres, ' ', u.apellidos) as doctor_name,
                        u.especialidad as doctor_specialty
                    FROM CITAS c
                    JOIN PACIENTES p ON c.id_paciente = p.id
                    JOIN USUARIOS u ON c.medico_id = u.id_usuario
                    WHERE c.id = $1
                `;

                const { rows: completeRows } = await client.query(completeQuery, [appointment.id]);
                const completeAppointment = completeRows[0];

                // Schedule reminder notification
                await this.scheduleReminder(completeAppointment, client);

                // Log appointment creation
                await client.query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, id_registro_afectado, tipo_operacion,
                        id_usuario_autor, fecha_hora, detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'CITAS',
                    appointment.id,
                    'INSERT',
                    userId,
                    JSON.stringify({
                        action: 'appointment_created',
                        appointmentNumber: appointment.numero_cita,
                        patientId: patientId,
                        doctorId: doctorId,
                        dateTime: dateTime
                    })
                ]);

                return completeAppointment;
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Create appointment error:', error);
            throw new Error(`Failed to create appointment: ${error.message}`);
        }
    }

    /**
     * Update appointment with conflict checking
     */
    async updateAppointment(appointmentId, updateData, userId = null) {
        try {
            const result = await transaction(async (client) => {
                // Get current appointment
                const currentQuery = `
                    SELECT * FROM CITAS WHERE id = $1 AND activo = TRUE
                `;
                const { rows: currentRows } = await client.query(currentQuery, [appointmentId]);

                if (currentRows.length === 0) {
                    throw new Error('Appointment not found');
                }

                const currentAppointment = currentRows[0];

                // Check for conflicts if date/time is being changed
                if (updateData.dateTime && updateData.dateTime !== currentAppointment.fecha_hora) {
                    const duration = updateData.duration || currentAppointment.duracion_minutos;
                    const conflicts = await this.checkSchedulingConflicts(
                        currentAppointment.medico_id,
                        updateData.dateTime,
                        duration,
                        appointmentId
                    );

                    if (conflicts.hasConflicts) {
                        throw new Error(`Scheduling conflict: ${conflicts.message}`);
                    }
                }

                // Build update query with proper parameter indexing
                const updateFields = [];
                const updateValues = [];
                let paramIndex = 1;

                if (updateData.dateTime !== undefined) {
                    updateFields.push(`fecha_hora = $${paramIndex++}`);
                    updateValues.push(updateData.dateTime);
                }
                if (updateData.duration !== undefined) {
                    updateFields.push(`duracion_minutos = $${paramIndex++}`);
                    updateValues.push(updateData.duration);
                }
                if (updateData.type !== undefined) {
                    updateFields.push(`tipo_cita = $${paramIndex++}`);
                    updateValues.push(updateData.type);
                }
                if (updateData.specialty !== undefined) {
                    updateFields.push(`especialidad = $${paramIndex++}`);
                    updateValues.push(updateData.specialty);
                }
                if (updateData.reason !== undefined) {
                    updateFields.push(`motivo = $${paramIndex++}`);
                    updateValues.push(updateData.reason);
                }
                if (updateData.notes !== undefined) {
                    updateFields.push(`observaciones = $${paramIndex++}`);
                    updateValues.push(updateData.notes);
                }
                if (updateData.state !== undefined) {
                    updateFields.push(`estado = $${paramIndex++}`);
                    updateValues.push(updateData.state);

                    // Set appropriate timestamps
                    if (updateData.state === 'CONFIRMADA') {
                        updateFields.push(`fecha_confirmacion = NOW()`);
                    } else if (updateData.state === 'CANCELADA') {
                        updateFields.push(`fecha_cancelacion = NOW()`);
                        if (updateData.cancellationReason) {
                            updateFields.push(`motivo_cancelacion = $${paramIndex++}`);
                            updateValues.push(updateData.cancellationReason);
                        }
                    }
                }
                if (updateData.contactPhone !== undefined) {
                    updateFields.push(`telefono_contacto = $${paramIndex++}`);
                    updateValues.push(updateData.contactPhone);
                }
                if (updateData.contactEmail !== undefined) {
                    updateFields.push(`email_contacto = $${paramIndex++}`);
                    updateValues.push(updateData.contactEmail);
                }
                if (updateData.cost !== undefined) {
                    updateFields.push(`costo_consulta = $${paramIndex++}`);
                    updateValues.push(updateData.cost);
                }
                if (updateData.room !== undefined) {
                    updateFields.push(`sala_consulta = $${paramIndex++}`);
                    updateValues.push(updateData.room);
                }

                // Always update modification fields
                updateFields.push(`modificado_por = $${paramIndex++}`);
                updateValues.push(userId);
                updateFields.push(`fecha_modificacion = NOW()`);

                if (updateFields.length === 2) {
                    throw new Error('No fields to update');
                }

                const updateQuery = `
                    UPDATE CITAS SET ${updateFields.join(', ')}
                    WHERE id = $${paramIndex} AND activo = TRUE
                    RETURNING *
                `;
                updateValues.push(appointmentId);

                const { rows } = await client.query(updateQuery, updateValues);

                if (rows.length === 0) {
                    throw new Error('Appointment not found or update failed');
                }

                // Log the update
                await client.query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, id_registro_afectado, tipo_operacion,
                        id_usuario_autor, fecha_hora, detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'CITAS',
                    appointmentId,
                    'UPDATE',
                    userId,
                    JSON.stringify({
                        action: 'appointment_updated',
                        updatedFields: Object.keys(updateData),
                        previousState: currentAppointment.estado,
                        newState: updateData.state || currentAppointment.estado
                    })
                ]);

                return rows[0];
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Update appointment error:', error);
            throw new Error(`Failed to update appointment: ${error.message}`);
        }
    }

    /**
     * Check for scheduling conflicts
     */
    async checkSchedulingConflicts(doctorId, dateTime, duration, excludeAppointmentId = null) {
        try {
            const endTime = new Date(new Date(dateTime).getTime() + duration * 60000);

            let conflictQuery = `
                SELECT 
                    id, numero_cita, fecha_hora, duracion_minutos,
                    CONCAT(p.nombre, ' ', p.apellido) as patient_name
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                WHERE c.medico_id = $1
                AND c.activo = TRUE
                AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                AND (
                    ($2 BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
                    ($3 BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
                    (c.fecha_hora BETWEEN $2 AND $3)
                )
            `;

            const params = [doctorId, dateTime, endTime.toISOString()];

            if (excludeAppointmentId) {
                conflictQuery += ` AND c.id != $4`;
                params.push(excludeAppointmentId);
            }

            const { rows } = await query(conflictQuery, params);

            return {
                hasConflicts: rows.length > 0,
                conflicts: rows,
                message: rows.length > 0
                    ? `Doctor has conflicting appointment: ${rows[0].numero_cita} with ${rows[0].patient_name} at ${rows[0].fecha_hora}`
                    : null
            };

        } catch (error) {
            console.error('Check conflicts error:', error);
            throw new Error('Failed to check scheduling conflicts');
        }
    }

    /**
     * Get doctor availability for a specific date
     */
    async getDoctorAvailability(doctorId, date, duration = 30) {
        try {
            // Get doctor's working hours (this would come from a schedule table in a real system)
            const workingHours = {
                start: '08:00',
                end: '18:00',
                lunchStart: '12:00',
                lunchEnd: '13:00'
            };

            // Get existing appointments for the date
            const appointmentsQuery = `
                SELECT fecha_hora, duracion_minutos, fecha_hora_fin
                FROM CITAS
                WHERE medico_id = $1
                AND DATE(fecha_hora) = $2
                AND activo = TRUE
                AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                ORDER BY fecha_hora
            `;

            const { rows: appointments } = await query(appointmentsQuery, [doctorId, date]);

            // Generate available time slots
            const availableSlots = this.generateAvailableSlots(
                date,
                workingHours,
                appointments,
                duration
            );

            return {
                success: true,
                data: {
                    date,
                    doctorId,
                    workingHours,
                    existingAppointments: appointments.length,
                    availableSlots,
                    requestedDuration: duration
                }
            };

        } catch (error) {
            console.error('Get doctor availability error:', error);
            throw new Error('Failed to get doctor availability');
        }
    }

    /**
     * Generate available time slots
     */
    generateAvailableSlots(date, workingHours, existingAppointments, duration) {
        const slots = [];
        const startTime = new Date(`${date}T${workingHours.start}:00`);
        const endTime = new Date(`${date}T${workingHours.end}:00`);
        const lunchStart = new Date(`${date}T${workingHours.lunchStart}:00`);
        const lunchEnd = new Date(`${date}T${workingHours.lunchEnd}:00`);

        let currentTime = new Date(startTime);

        while (currentTime < endTime) {
            const slotEnd = new Date(currentTime.getTime() + duration * 60000);

            // Skip if slot overlaps with lunch
            if (currentTime < lunchEnd && slotEnd > lunchStart) {
                currentTime = new Date(lunchEnd);
                continue;
            }

            // Check if slot conflicts with existing appointments
            const hasConflict = existingAppointments.some(apt => {
                const aptStart = new Date(apt.fecha_hora);
                const aptEnd = new Date(apt.fecha_hora_fin);
                return (currentTime < aptEnd && slotEnd > aptStart);
            });

            if (!hasConflict && slotEnd <= endTime) {
                slots.push({
                    startTime: currentTime.toISOString(),
                    endTime: slotEnd.toISOString(),
                    duration: duration,
                    available: true
                });
            }

            // Move to next slot (15-minute intervals)
            currentTime = new Date(currentTime.getTime() + 15 * 60000);
        }

        return slots;
    }

    /**
     * Schedule appointment reminder
     */
    async scheduleReminder(appointment, client = null) {
        try {
            const appointmentDate = new Date(appointment.fecha_hora);
            const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before

            // Only schedule if appointment is in the future
            if (appointmentDate > new Date()) {
                const reminderData = {
                    patientId: appointment.id_paciente,
                    appointmentId: appointment.id,
                    appointmentDate: appointment.fecha_hora,
                    patientName: appointment.patient_name,
                    doctorName: appointment.doctor_name
                };

                // Create reminder notification
                await notificationService.createAppointmentReminder(reminderData);

                // Update appointment to mark reminder as scheduled
                const updateQuery = `
                    UPDATE CITAS 
                    SET fecha_recordatorio = $1
                    WHERE id = $2
                `;

                if (client) {
                    await client.query(updateQuery, [reminderDate.toISOString(), appointment.id]);
                } else {
                    await query(updateQuery, [reminderDate.toISOString(), appointment.id]);
                }
            }

        } catch (error) {
            console.error('Schedule reminder error:', error);
            // Don't throw error, just log it
        }
    }

    /**
     * Cancel appointment
     */
    async cancelAppointment(appointmentId, reason, userId = null) {
        try {
            const result = await transaction(async (client) => {
                // Get appointment info
                const appointmentQuery = `
                    SELECT 
                        c.*,
                        CONCAT(p.nombre, ' ', p.apellido) as patient_name,
                        CONCAT(u.nombres, ' ', u.apellidos) as doctor_name
                    FROM CITAS c
                    JOIN PACIENTES p ON c.id_paciente = p.id
                    JOIN USUARIOS u ON c.medico_id = u.id_usuario
                    WHERE c.id = $1 AND c.activo = TRUE
                `;

                const { rows } = await client.query(appointmentQuery, [appointmentId]);

                if (rows.length === 0) {
                    throw new Error('Appointment not found');
                }

                const appointment = rows[0];

                if (appointment.estado === 'CANCELADA') {
                    throw new Error('Appointment is already cancelled');
                }

                // Cancel the appointment
                const cancelQuery = `
                    UPDATE CITAS 
                    SET 
                        estado = 'CANCELADA',
                        fecha_cancelacion = NOW(),
                        motivo_cancelacion = $1,
                        modificado_por = $2,
                        fecha_modificacion = NOW()
                    WHERE id = $3
                    RETURNING *
                `;

                const { rows: cancelledRows } = await client.query(cancelQuery, [
                    reason,
                    userId,
                    appointmentId
                ]);

                // Create cancellation notification
                await notificationService.createNotification({
                    userId: appointment.medico_id,
                    type: 'appointment_cancelled',
                    title: 'Cita Cancelada',
                    message: `La cita con ${appointment.patient_name} programada para ${new Date(appointment.fecha_hora).toLocaleString('es-ES')} ha sido cancelada. Motivo: ${reason}`,
                    priority: 'high',
                    actionUrl: `/appointments/${appointmentId}`,
                    actionData: {
                        appointmentId,
                        patientName: appointment.patient_name,
                        originalDate: appointment.fecha_hora,
                        reason
                    }
                });

                // Log cancellation
                await client.query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, id_registro_afectado, tipo_operacion,
                        id_usuario_autor, fecha_hora, detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'CITAS',
                    appointmentId,
                    'CANCEL',
                    userId,
                    JSON.stringify({
                        action: 'appointment_cancelled',
                        reason: reason,
                        patientName: appointment.patient_name,
                        originalDate: appointment.fecha_hora
                    })
                ]);

                return cancelledRows[0];
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Cancel appointment error:', error);
            throw new Error(`Failed to cancel appointment: ${error.message}`);
        }
    }

    /**
     * Get appointment statistics
     */
    async getAppointmentStats(filters = {}) {
        try {
            const { doctorId, dateFrom, dateTo, patientId } = filters;

            let statsQuery = `
                SELECT 
                    COUNT(*) as total_appointments,
                    COUNT(CASE WHEN estado = 'PROGRAMADA' THEN 1 END) as scheduled,
                    COUNT(CASE WHEN estado = 'CONFIRMADA' THEN 1 END) as confirmed,
                    COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as completed,
                    COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN estado = 'NO_ASISTIO' THEN 1 END) as no_show,
                    COUNT(CASE WHEN DATE(fecha_hora) = CURRENT_DATE THEN 1 END) as today,
                    COUNT(CASE WHEN DATE(fecha_hora) = CURRENT_DATE + 1 THEN 1 END) as tomorrow,
                    COUNT(CASE WHEN fecha_hora >= CURRENT_TIMESTAMP AND fecha_hora < CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 1 END) as this_week,
                    AVG(duracion_minutos) as avg_duration,
                    AVG(costo_consulta) as avg_cost
                FROM CITAS
                WHERE activo = TRUE
            `;

            const params = [];
            let paramIndex = 1;

            if (doctorId) {
                statsQuery += ` AND medico_id = $${paramIndex}`;
                params.push(doctorId);
                paramIndex++;
            }

            if (patientId) {
                statsQuery += ` AND id_paciente = $${paramIndex}`;
                params.push(patientId);
                paramIndex++;
            }

            if (dateFrom) {
                statsQuery += ` AND fecha_hora >= $${paramIndex}`;
                params.push(dateFrom);
                paramIndex++;
            }

            if (dateTo) {
                statsQuery += ` AND fecha_hora <= $${paramIndex}`;
                params.push(dateTo + ' 23:59:59');
                paramIndex++;
            }

            const { rows } = await query(statsQuery, params);
            const stats = rows[0];

            // Convert string numbers to integers
            Object.keys(stats).forEach(key => {
                if (key.includes('avg_')) {
                    stats[key] = parseFloat(stats[key]) || 0;
                } else {
                    stats[key] = parseInt(stats[key]) || 0;
                }
            });

            return {
                success: true,
                data: stats
            };

        } catch (error) {
            console.error('Get appointment stats error:', error);
            throw new Error('Failed to get appointment statistics');
        }
    }

    /**
     * Validate appointment data
     */
    validateAppointmentData(data) {
        const errors = [];

        if (!data.patientId || isNaN(parseInt(data.patientId))) {
            errors.push('Valid patient ID is required');
        }

        if (!data.doctorId || isNaN(parseInt(data.doctorId))) {
            errors.push('Valid doctor ID is required');
        }

        if (!data.dateTime) {
            errors.push('Appointment date and time is required');
        } else if (new Date(data.dateTime) <= new Date()) {
            errors.push('Appointment date must be in the future');
        }

        if (!data.type || !Object.keys(this.appointmentTypes).includes(data.type)) {
            errors.push('Valid appointment type is required');
        }

        if (!data.reason || data.reason.trim().length < 5) {
            errors.push('Reason for appointment is required and must be at least 5 characters');
        }

        if (data.duration && (data.duration < 5 || data.duration > 480)) {
            errors.push('Duration must be between 5 and 480 minutes');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get upcoming appointments for reminders
     */
    async getUpcomingAppointments(hoursAhead = 24) {
        try {
            const reminderTime = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);

            const upcomingQuery = `
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) as patient_name,
                    p.telefono as patient_phone,
                    p.email as patient_email,
                    CONCAT(u.nombres, ' ', u.apellidos) as doctor_name
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                JOIN USUARIOS u ON c.medico_id = u.id_usuario
                WHERE c.fecha_hora <= $1
                AND c.fecha_hora > NOW()
                AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
                AND c.activo = TRUE
                AND (c.recordatorio_enviado = FALSE OR c.recordatorio_enviado IS NULL)
                ORDER BY c.fecha_hora
            `;

            const { rows } = await query(upcomingQuery, [reminderTime.toISOString()]);

            return {
                success: true,
                data: rows
            };

        } catch (error) {
            console.error('Get upcoming appointments error:', error);
            throw new Error('Failed to get upcoming appointments');
        }
    }

    /**
     * Mark reminder as sent
     */
    async markReminderSent(appointmentId) {
        try {
            await query(`
                UPDATE CITAS 
                SET recordatorio_enviado = TRUE, fecha_recordatorio = NOW()
                WHERE id = $1
            `, [appointmentId]);

            return { success: true };

        } catch (error) {
            console.error('Mark reminder sent error:', error);
            throw new Error('Failed to mark reminder as sent');
        }
    }

    /**
     * Reschedule appointment
     */
    async rescheduleAppointment(appointmentId, newDateTime, reason, userId = null) {
        try {
            const result = await transaction(async (client) => {
                // Get current appointment
                const currentQuery = `
                    SELECT 
                        c.*,
                        CONCAT(p.nombre, ' ', p.apellido) as patient_name,
                        CONCAT(u.nombres, ' ', u.apellidos) as doctor_name
                    FROM CITAS c
                    JOIN PACIENTES p ON c.id_paciente = p.id
                    JOIN USUARIOS u ON c.medico_id = u.id_usuario
                    WHERE c.id = $1 AND c.activo = TRUE
                `;

                const { rows } = await client.query(currentQuery, [appointmentId]);

                if (rows.length === 0) {
                    throw new Error('Appointment not found');
                }

                const appointment = rows[0];

                // Check for conflicts at new time
                const conflicts = await this.checkSchedulingConflicts(
                    appointment.medico_id,
                    newDateTime,
                    appointment.duracion_minutos,
                    appointmentId
                );

                if (conflicts.hasConflicts) {
                    throw new Error(`Scheduling conflict: ${conflicts.message}`);
                }

                // Update appointment
                const updateQuery = `
                    UPDATE CITAS 
                    SET 
                        fecha_hora = $1,
                        estado = 'REPROGRAMADA',
                        observaciones = COALESCE(observaciones, '') || $2,
                        modificado_por = $3,
                        fecha_modificacion = NOW()
                    WHERE id = $4
                    RETURNING *
                `;

                const { rows: updatedRows } = await client.query(updateQuery, [
                    newDateTime,
                    `\n[REPROGRAMADA] ${reason}`,
                    userId,
                    appointmentId
                ]);

                // Create notification
                await notificationService.createNotification({
                    userId: appointment.medico_id,
                    type: 'appointment_rescheduled',
                    title: 'Cita Reprogramada',
                    message: `La cita con ${appointment.patient_name} ha sido reprogramada para ${new Date(newDateTime).toLocaleString('es-ES')}. Motivo: ${reason}`,
                    priority: 'medium',
                    actionUrl: `/appointments/${appointmentId}`,
                    actionData: {
                        appointmentId,
                        patientName: appointment.patient_name,
                        originalDate: appointment.fecha_hora,
                        newDate: newDateTime,
                        reason
                    }
                });

                // Log rescheduling
                await client.query(`
                    INSERT INTO LOGS_AUDITORIA (
                        tabla_afectada, id_registro_afectado, tipo_operacion,
                        id_usuario_autor, fecha_hora, detalles
                    ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                    'CITAS',
                    appointmentId,
                    'RESCHEDULE',
                    userId,
                    JSON.stringify({
                        action: 'appointment_rescheduled',
                        reason: reason,
                        patientName: appointment.patient_name,
                        originalDate: appointment.fecha_hora,
                        newDate: newDateTime
                    })
                ]);

                return updatedRows[0];
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('Reschedule appointment error:', error);
            throw new Error(`Failed to reschedule appointment: ${error.message}`);
        }
    }
}

module.exports = new AppointmentService();