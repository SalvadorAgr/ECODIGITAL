const express = require('express');
const appointmentService = require('../services/appointmentService');
const calendarService = require('../services/calendarService');
const { getPool, utils } = require('../db');

const router = express.Router();

// Middleware to verify database connection is ready
router.use((req, res, next) => {
    const pool = getPool();
    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Service unavailable, database not connected.'
        });
    }
    next();
});

// GET /api/v1/appointments - Get list of appointments with advanced search, filtering and pagination
router.get('/', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'fecha_hora',
            sortOrder = 'ASC',
            medico_id,
            id_paciente,
            estado,
            tipo_cita,
            fecha_inicio,
            fecha_fin,
            activo = 'true'
        } = req.query;

        // Build base query using the complete view
        let baseQuery = `
            SELECT 
                c.id,
                c.numero_cita,
                c.fecha_hora,
                c.duracion_minutos,
                c.fecha_hora_fin,
                c.tipo_cita,
                c.especialidad,
                c.motivo,
                c.observaciones,
                c.estado,
                c.fecha_confirmacion,
                c.fecha_cancelacion,
                c.motivo_cancelacion,
                c.telefono_contacto,
                c.email_contacto,
                c.recordatorio_enviado,
                c.fecha_recordatorio,
                c.historial_clinico_id,
                c.tiempo_espera_minutos,
                c.tiempo_consulta_minutos,
                c.costo_consulta,
                c.seguro_medico,
                c.copago,
                c.facturado,
                c.sala_consulta,
                c.equipos_necesarios,
                c.preparacion_especial,
                c.activo,
                c.fecha_creacion,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.telefono as telefono_paciente,
                p.numero_expediente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad as especialidad_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            filters['c.activo'] = activo === 'true';
        }

        // Search filter (patient name, appointment number, doctor name)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                CONCAT(p.nombre, ' ', p.apellido) ILIKE $${paramIndex} OR 
                c.numero_cita ILIKE $${paramIndex + 1} OR 
                CONCAT(u.nombres, ' ', u.apellidos) ILIKE $${paramIndex + 2} OR
                c.motivo ILIKE $${paramIndex + 3}
            )`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            paramIndex += 4;
        }

        // Additional filters
        if (medico_id) filters['c.medico_id'] = parseInt(medico_id);
        if (id_paciente) filters['c.id_paciente'] = parseInt(id_paciente);
        if (estado) filters['c.estado'] = estado;
        if (tipo_cita) filters['c.tipo_cita'] = tipo_cita;

        // Date range filters
        if (fecha_inicio) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                `c.fecha_hora >= $${paramIndex}`;
            params.push(fecha_inicio);
            paramIndex++;
        }
        if (fecha_fin) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                `c.fecha_hora <= $${paramIndex}`;
            params.push(fecha_fin + ' 23:59:59');
            paramIndex++;
        }

        // Apply additional filters
        if (Object.keys(filters).length > 0) {
            const { clause, params: filterParams, nextIndex } = utils.buildWhereClause(filters, paramIndex);
            if (clause) {
                baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                    clause.replace('WHERE ', '');
                params.push(...filterParams);
                paramIndex = nextIndex;
            }
        }

        // Count total records for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_appointments`;
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].total);

        // Add sorting
        const orderClause = utils.buildOrderClause(sortBy, sortOrder);
        baseQuery += ` ${orderClause}`;

        // Add pagination
        const { clause: paginationClause, params: paginationParams } = utils.buildPaginationClause(
            parseInt(page),
            parseInt(limit),
            paramIndex
        );
        baseQuery += ` ${paginationClause}`;
        params.push(...paginationParams);

        // Execute main query
        const { rows } = await pool.query(baseQuery, params);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage,
                hasPrevPage
            },
            message: `Found ${rows.length} appointments`
        });

    } catch (err) {
        console.error('Error getting appointments:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/appointments/:id - Get specific appointment by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    try {
        const pool = getPool();

        // Get appointment with complete information
        const query = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.telefono as telefono_paciente,
                p.email as email_paciente,
                p.numero_expediente,
                p.fecha_nacimiento,
                p.genero,
                p.tipo_sangre,
                p.alergias,
                p.medicamentos_actuales,
                p.condiciones_medicas,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad as especialidad_medico,
                u.telefono as telefono_medico,
                u.email as email_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1
        `;

        const { rows, rowCount } = await pool.query(query, [id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Appointment retrieved successfully'
        });

    } catch (err) {
        console.error(`Error getting appointment ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/appointments - Create new appointment with advanced validation
router.post('/', async (req, res) => {
    try {
        const appointmentData = {
            patientId: req.body.id_paciente,
            doctorId: req.body.medico_id,
            dateTime: req.body.fecha_hora,
            duration: req.body.duracion_minutos,
            type: req.body.tipo_cita,
            specialty: req.body.especialidad,
            reason: req.body.motivo,
            notes: req.body.observaciones,
            contactPhone: req.body.telefono_contacto,
            contactEmail: req.body.email_contacto,
            cost: req.body.costo_consulta,
            insurance: req.body.seguro_medico,
            copay: req.body.copago,
            room: req.body.sala_consulta,
            equipment: req.body.equipos_necesarios,
            specialPreparation: req.body.preparacion_especial
        };

        const userId = req.user?.id || null;
        const result = await appointmentService.createAppointment(appointmentData, userId);

        res.status(201).json({
            success: true,
            data: result.data,
            message: 'Appointment created successfully'
        });

    } catch (error) {
        console.error('Error creating appointment:', error);

        if (error.message.includes('Validation failed')) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.message
            });
        }

        if (error.message.includes('Scheduling conflict')) {
            return res.status(409).json({
                success: false,
                error: 'Scheduling conflict detected',
                details: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/v1/appointments/:id - Update existing appointment
router.put('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    const {
        fecha_hora,
        duracion_minutos,
        tipo_cita,
        especialidad,
        motivo,
        observaciones,
        estado,
        telefono_contacto,
        email_contacto,
        costo_consulta,
        seguro_medico,
        copago,
        sala_consulta,
        equipos_necesarios,
        preparacion_especial,
        motivo_cancelacion
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (fecha_hora && new Date(fecha_hora) <= new Date()) {
        errors.push('Appointment date must be in the future');
    }
    if (tipo_cita) {
        const validTypes = ['CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'];
        if (!validTypes.includes(tipo_cita)) {
            errors.push('Invalid appointment type');
        }
    }
    if (estado) {
        const validStates = ['PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'];
        if (!validStates.includes(estado)) {
            errors.push('Invalid appointment state');
        }
    }
    if (motivo && motivo.trim().length < 5) {
        errors.push('Reason for appointment must be at least 5 characters');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors
        });
    }

    try {
        const pool = getPool();

        // Check if appointment exists
        const existingAppointment = await pool.query(
            'SELECT * FROM CITAS WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (existingAppointment.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found or inactive'
            });
        }

        const current = existingAppointment.rows[0];

        // If changing date/time, check for conflicts
        if (fecha_hora && fecha_hora !== current.fecha_hora) {
            const conflictCheck = await pool.query(`
                SELECT id, numero_cita, fecha_hora, duracion_minutos
                FROM CITAS
                WHERE medico_id = $1
                AND activo = TRUE
                AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                AND id != $2
                AND (
                    ($3 BETWEEN fecha_hora AND fecha_hora_fin) OR
                    ($3 + INTERVAL '1 minute' * $4 BETWEEN fecha_hora AND fecha_hora_fin) OR
                    (fecha_hora BETWEEN $3 AND $3 + INTERVAL '1 minute' * $4)
                )
            `, [current.medico_id, id, fecha_hora, duracion_minutos || current.duracion_minutos]);

            if (conflictCheck.rowCount > 0) {
                const conflict = conflictCheck.rows[0];
                return res.status(409).json({
                    success: false,
                    error: 'Scheduling conflict detected',
                    details: `Doctor already has appointment ${conflict.numero_cita} scheduled at ${conflict.fecha_hora}`,
                    conflictingAppointment: conflict
                });
            }
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (fecha_hora !== undefined) {
            updateFields.push(`fecha_hora = $${paramIndex++}`);
            updateValues.push(fecha_hora);
        }
        if (duracion_minutos !== undefined) {
            updateFields.push(`duracion_minutos = $${paramIndex++}`);
            updateValues.push(duracion_minutos);
        }
        if (tipo_cita !== undefined) {
            updateFields.push(`tipo_cita = $${paramIndex++}`);
            updateValues.push(tipo_cita);
        }
        if (especialidad !== undefined) {
            updateFields.push(`especialidad = $${paramIndex++}`);
            updateValues.push(especialidad);
        }
        if (motivo !== undefined) {
            updateFields.push(`motivo = $${paramIndex++}`);
            updateValues.push(motivo);
        }
        if (observaciones !== undefined) {
            updateFields.push(`observaciones = $${paramIndex++}`);
            updateValues.push(observaciones);
        }
        if (estado !== undefined) {
            updateFields.push(`estado = $${paramIndex++}`);
            updateValues.push(estado);

            // Set appropriate timestamps based on state
            if (estado === 'CONFIRMADA') {
                updateFields.push(`fecha_confirmacion = CURRENT_TIMESTAMP`);
            } else if (estado === 'CANCELADA') {
                updateFields.push(`fecha_cancelacion = CURRENT_TIMESTAMP`);
                if (motivo_cancelacion) {
                    updateFields.push(`motivo_cancelacion = $${paramIndex++}`);
                    updateValues.push(motivo_cancelacion);
                }
            }
        }
        if (telefono_contacto !== undefined) {
            updateFields.push(`telefono_contacto = $${paramIndex++}`);
            updateValues.push(telefono_contacto);
        }
        if (email_contacto !== undefined) {
            updateFields.push(`email_contacto = $${paramIndex++}`);
            updateValues.push(email_contacto);
        }
        if (costo_consulta !== undefined) {
            updateFields.push(`costo_consulta = $${paramIndex++}`);
            updateValues.push(costo_consulta);
        }
        if (seguro_medico !== undefined) {
            updateFields.push(`seguro_medico = $${paramIndex++}`);
            updateValues.push(seguro_medico);
        }
        if (copago !== undefined) {
            updateFields.push(`copago = $${paramIndex++}`);
            updateValues.push(copago);
        }
        if (sala_consulta !== undefined) {
            updateFields.push(`sala_consulta = $${paramIndex++}`);
            updateValues.push(sala_consulta);
        }
        if (equipos_necesarios !== undefined) {
            updateFields.push(`equipos_necesarios = $${paramIndex++}`);
            updateValues.push(JSON.stringify(equipos_necesarios));
        }
        if (preparacion_especial !== undefined) {
            updateFields.push(`preparacion_especial = $${paramIndex++}`);
            updateValues.push(preparacion_especial);
        }

        // Always update modification fields
        updateFields.push(`modificado_por = $${paramIndex++}`);
        updateValues.push(modificado_por);
        updateFields.push(`fecha_modificacion = CURRENT_TIMESTAMP`);

        if (updateFields.length === 2) { // Only modification fields
            return res.status(400).json({
                success: false,
                error: 'No fields to update provided'
            });
        }

        const query = `
            UPDATE CITAS SET 
                ${updateFields.join(', ')}
            WHERE id = $${paramIndex} AND activo = TRUE 
            RETURNING *
        `;

        updateValues.push(id);

        const { rows, rowCount } = await pool.query(query, updateValues);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found or inactive'
            });
        }

        // Get the complete appointment information for response
        const completeAppointment = await pool.query(`
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1
        `, [rows[0].id]);

        res.status(200).json({
            success: true,
            data: completeAppointment.rows[0],
            message: 'Appointment updated successfully'
        });

    } catch (err) {
        console.error(`Error updating appointment ${id}:`, err.stack);

        // Handle specific database errors
        if (err.message && err.message.includes('Conflicto de horario')) {
            return res.status(409).json({
                success: false,
                error: 'Scheduling conflict detected',
                details: err.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// DELETE /api/v1/appointments/:id - Soft delete appointment
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid appointment ID provided'
        });
    }

    try {
        const pool = getPool();

        // Check if appointment exists and get basic info
        const checkQuery = `
            SELECT 
                c.id, 
                c.numero_cita,
                c.estado,
                c.fecha_hora,
                c.activo,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1
        `;

        const { rows: checkRows, rowCount: checkCount } = await pool.query(checkQuery, [id]);

        if (checkCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const appointment = checkRows[0];

        if (!appointment.activo) {
            return res.status(400).json({
                success: false,
                error: 'Appointment is already inactive'
            });
        }

        if (appointment.estado === 'CANCELADA') {
            return res.status(400).json({
                success: false,
                error: 'Appointment is already cancelled'
            });
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Cancel the appointment (soft delete by setting estado to CANCELADA)
        const cancelQuery = `
            UPDATE CITAS 
            SET 
                estado = 'CANCELADA',
                fecha_cancelacion = CURRENT_TIMESTAMP,
                motivo_cancelacion = $1,
                modificado_por = $2,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $3 AND activo = TRUE
            RETURNING id, numero_cita, estado
        `;

        const { rows: cancelRows, rowCount: cancelCount } = await pool.query(cancelQuery, [
            motivo_cancelacion || 'Cancelled by user',
            modificado_por,
            id
        ]);

        if (cancelCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found or already inactive'
            });
        }

        res.status(200).json({
            success: true,
            message: `Appointment ${appointment.numero_cita} has been cancelled successfully`,
            data: {
                id: appointment.id,
                numero_cita: appointment.numero_cita,
                status: 'cancelled',
                patient: appointment.nombre_paciente,
                doctor: appointment.nombre_medico,
                original_date: appointment.fecha_hora
            }
        });

    } catch (err) {
        console.error(`Error cancelling appointment ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;

// Advanced Appointment Management Routes

// GET /api/v1/appointments/calendar/:viewType - Get calendar view
router.get('/calendar/:viewType', async (req, res) => {
    try {
        const { viewType } = req.params;
        const { startDate, endDate, doctorId, states, types } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Start date and end date are required'
            });
        }

        const filters = {};
        if (states) filters.states = states.split(',');
        if (types) filters.types = types.split(',');

        const result = await calendarService.getCalendarView(
            viewType,
            startDate,
            endDate,
            doctorId ? parseInt(doctorId) : null,
            filters
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting calendar view:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/availability/:doctorId - Get doctor availability
router.get('/availability/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date, duration = 30 } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date is required'
            });
        }

        const result = await appointmentService.getDoctorAvailability(
            parseInt(doctorId),
            date,
            parseInt(duration)
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting doctor availability:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/slots/available - Find available slots across doctors
router.get('/slots/available', async (req, res) => {
    try {
        const { date, duration = 30, doctorIds, specialty } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date is required'
            });
        }

        const doctorIdArray = doctorIds ? doctorIds.split(',').map(id => parseInt(id)) : [];

        const result = await calendarService.findAvailableSlots(
            date,
            parseInt(duration),
            doctorIdArray,
            specialty
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error finding available slots:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/schedule/:doctorId - Get doctor schedule
router.get('/schedule/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Start date and end date are required'
            });
        }

        const result = await calendarService.getDoctorSchedule(
            parseInt(doctorId),
            startDate,
            endDate
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting doctor schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/stats - Get appointment statistics
router.get('/stats', async (req, res) => {
    try {
        const { doctorId, dateFrom, dateTo, patientId } = req.query;

        const filters = {};
        if (doctorId) filters.doctorId = parseInt(doctorId);
        if (patientId) filters.patientId = parseInt(patientId);
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const result = await appointmentService.getAppointmentStats(filters);

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting appointment stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/appointments/:id/cancel - Cancel appointment
router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid appointment ID provided'
            });
        }

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Cancellation reason is required and must be at least 5 characters'
            });
        }

        const userId = req.user?.id || null;
        const result = await appointmentService.cancelAppointment(
            parseInt(id),
            reason.trim(),
            userId
        );

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Appointment cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling appointment:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        if (error.message.includes('already cancelled')) {
            return res.status(400).json({
                success: false,
                error: 'Appointment is already cancelled'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/appointments/:id/reschedule - Reschedule appointment
router.post('/:id/reschedule', async (req, res) => {
    try {
        const { id } = req.params;
        const { newDateTime, reason } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid appointment ID provided'
            });
        }

        if (!newDateTime) {
            return res.status(400).json({
                success: false,
                error: 'New date and time is required'
            });
        }

        if (new Date(newDateTime) <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'New appointment date must be in the future'
            });
        }

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Reschedule reason is required and must be at least 5 characters'
            });
        }

        const userId = req.user?.id || null;
        const result = await appointmentService.rescheduleAppointment(
            parseInt(id),
            newDateTime,
            reason.trim(),
            userId
        );

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Appointment rescheduled successfully'
        });

    } catch (error) {
        console.error('Error rescheduling appointment:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        if (error.message.includes('Scheduling conflict')) {
            return res.status(409).json({
                success: false,
                error: 'Scheduling conflict detected',
                details: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/upcoming - Get upcoming appointments for reminders
router.get('/upcoming', async (req, res) => {
    try {
        const { hoursAhead = 24 } = req.query;

        const result = await appointmentService.getUpcomingAppointments(parseInt(hoursAhead));

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting upcoming appointments:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/v1/appointments/:id/reminder-sent - Mark reminder as sent
router.post('/:id/reminder-sent', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid appointment ID provided'
            });
        }

        const result = await appointmentService.markReminderSent(parseInt(id));

        res.status(200).json({
            success: true,
            message: 'Reminder marked as sent'
        });

    } catch (error) {
        console.error('Error marking reminder as sent:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/calendar/summary - Get calendar summary for dashboard
router.get('/calendar/summary', async (req, res) => {
    try {
        const { doctorId } = req.query;

        const result = await calendarService.getCalendarSummary(
            doctorId ? parseInt(doctorId) : null
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error getting calendar summary:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/v1/appointments/export/:format - Export appointments to calendar format
router.get('/export/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate, doctorId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Start date and end date are required'
            });
        }

        if (!['ical', 'google'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid format. Supported formats: ical, google'
            });
        }

        const result = await calendarService.getCalendarEvents(
            startDate,
            endDate,
            doctorId ? parseInt(doctorId) : null,
            format
        );

        if (format === 'ical') {
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.status(200).send(result.data);
        } else {
            res.status(200).json(result);
        }

    } catch (error) {
        console.error('Error exporting calendar:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});