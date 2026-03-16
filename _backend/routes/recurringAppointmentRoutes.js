const express = require('express');
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

// GET /api/v1/recurring-appointments - Get recurring appointment patterns
router.get('/', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'fecha_creacion',
            sortOrder = 'DESC',
            estado,
            tipo_recurrencia,
            medico_id,
            id_paciente,
            activo = 'true'
        } = req.query;

        // Build base query
        let baseQuery = `
            SELECT 
                cr.id,
                cr.nombre_patron,
                cr.descripcion,
                cr.tipo_cita,
                cr.tipo_recurrencia,
                cr.intervalo_recurrencia,
                cr.dias_semana,
                cr.hora_inicio,
                cr.hora_fin,
                cr.fecha_inicio,
                cr.fecha_fin,
                cr.numero_ocurrencias,
                cr.ocurrencias_generadas,
                cr.estado,
                cr.generar_automaticamente,
                cr.dias_anticipacion,
                cr.fecha_creacion,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.numero_expediente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad as especialidad_medico,
                (SELECT COUNT(*) FROM CITAS_RECURRENTES_INSTANCIAS cri WHERE cri.patron_recurrente_id = cr.id) as total_instancias,
                (SELECT COUNT(*) FROM CITAS_RECURRENTES_INSTANCIAS cri 
                 JOIN CITAS c ON cri.cita_id = c.id 
                 WHERE cri.patron_recurrente_id = cr.id AND c.estado = 'COMPLETADA') as citas_completadas
            FROM CITAS_RECURRENTES cr
            JOIN PACIENTES p ON cr.id_paciente = p.id
            JOIN USUARIOS u ON cr.medico_id = u.id
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            filters['cr.activo'] = activo === 'true';
        }

        // Search filter (patient name, pattern name, description)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                CONCAT(p.nombre, ' ', p.apellido) ILIKE $${paramIndex} OR 
                cr.nombre_patron ILIKE $${paramIndex + 1} OR 
                cr.descripcion ILIKE $${paramIndex + 2}
            )`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        // Additional filters
        if (estado) filters['cr.estado'] = estado;
        if (tipo_recurrencia) filters['cr.tipo_recurrencia'] = tipo_recurrencia;
        if (medico_id) filters['cr.medico_id'] = parseInt(medico_id);
        if (id_paciente) filters['cr.id_paciente'] = parseInt(id_paciente);

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
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_patterns`;
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
            message: `Found ${rows.length} recurring appointment patterns`
        });

    } catch (err) {
        console.error('Error getting recurring appointments:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/recurring-appointments - Create recurring appointment pattern
router.post('/', async (req, res) => {
    const {
        nombre_patron,
        descripcion,
        id_paciente,
        medico_id,
        tipo_cita,
        duracion_minutos = 30,
        motivo,
        observaciones,
        tipo_recurrencia,
        intervalo_recurrencia = 1,
        dias_semana,
        dia_mes,
        semana_mes,
        mes_año,
        hora_inicio,
        hora_fin,
        fecha_inicio,
        fecha_fin,
        numero_ocurrencias,
        generar_automaticamente = true,
        dias_anticipacion = 30,
        permitir_fines_semana = false,
        excluir_feriados = true,
        notificar_creacion = true,
        accion_conflicto = 'NOTIFICAR',
        max_intentos_reprogramacion = 3
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!nombre_patron || nombre_patron.trim().length < 3) {
        errors.push('Pattern name is required and must be at least 3 characters');
    }
    if (!id_paciente || isNaN(parseInt(id_paciente))) {
        errors.push('Valid patient ID is required');
    }
    if (!medico_id || isNaN(parseInt(medico_id))) {
        errors.push('Valid doctor ID is required');
    }
    if (!tipo_cita) {
        errors.push('Appointment type is required');
    }
    if (!motivo || motivo.trim().length < 5) {
        errors.push('Reason is required and must be at least 5 characters');
    }
    if (!tipo_recurrencia) {
        errors.push('Recurrence type is required');
    }
    if (!hora_inicio) {
        errors.push('Start time is required');
    }
    if (!fecha_inicio) {
        errors.push('Start date is required');
    }

    // Validate appointment type
    const validTypes = ['CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'];
    if (tipo_cita && !validTypes.includes(tipo_cita)) {
        errors.push('Invalid appointment type');
    }

    // Validate recurrence type
    const validRecurrenceTypes = ['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL', 'PERSONALIZADA'];
    if (tipo_recurrencia && !validRecurrenceTypes.includes(tipo_recurrencia)) {
        errors.push('Invalid recurrence type');
    }

    // Validate conflict action
    const validConflictActions = ['OMITIR', 'REPROGRAMAR', 'NOTIFICAR'];
    if (accion_conflicto && !validConflictActions.includes(accion_conflicto)) {
        errors.push('Invalid conflict action');
    }

    // Validate date range
    if (fecha_inicio && new Date(fecha_inicio) <= new Date()) {
        errors.push('Start date must be in the future');
    }
    if (fecha_fin && fecha_inicio && new Date(fecha_fin) <= new Date(fecha_inicio)) {
        errors.push('End date must be after start date');
    }

    // Validate weekly recurrence
    if (tipo_recurrencia === 'SEMANAL' && (!dias_semana || !Array.isArray(dias_semana) || dias_semana.length === 0)) {
        errors.push('Days of week are required for weekly recurrence');
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

        // Check if patient exists and is active
        const patientCheck = await pool.query(
            'SELECT id, nombre, apellido, activo FROM PACIENTES WHERE id = $1',
            [id_paciente]
        );

        if (patientCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        if (!patientCheck.rows[0].activo) {
            return res.status(400).json({
                success: false,
                error: 'Patient is inactive'
            });
        }

        // Check if doctor exists and is active
        const doctorCheck = await pool.query(
            'SELECT id, nombres, apellidos, activo FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\')',
            [medico_id]
        );

        if (doctorCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or not authorized'
            });
        }

        if (!doctorCheck.rows[0].activo) {
            return res.status(400).json({
                success: false,
                error: 'Doctor is inactive'
            });
        }

        // Calculate end time if not provided
        const calculatedHoraFin = hora_fin || calculateEndTime(hora_inicio, duracion_minutos);

        // Get user ID from auth middleware (if available)
        const creado_por = req.user?.id || null;

        const query = `
            INSERT INTO CITAS_RECURRENTES (
                nombre_patron, descripcion, id_paciente, medico_id,
                tipo_cita, duracion_minutos, motivo, observaciones,
                tipo_recurrencia, intervalo_recurrencia, dias_semana,
                dia_mes, semana_mes, mes_año,
                hora_inicio, hora_fin, fecha_inicio, fecha_fin, numero_ocurrencias,
                generar_automaticamente, dias_anticipacion,
                permitir_fines_semana, excluir_feriados, notificar_creacion,
                accion_conflicto, max_intentos_reprogramacion,
                creado_por
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
            ) RETURNING *
        `;

        const values = [
            nombre_patron.trim(), descripcion, id_paciente, medico_id,
            tipo_cita, duracion_minutos, motivo, observaciones,
            tipo_recurrencia, intervalo_recurrencia,
            dias_semana ? JSON.stringify(dias_semana) : null,
            dia_mes, semana_mes, mes_año,
            hora_inicio, calculatedHoraFin, fecha_inicio, fecha_fin, numero_ocurrencias,
            generar_automaticamente, dias_anticipacion,
            permitir_fines_semana, excluir_feriados, notificar_creacion,
            accion_conflicto, max_intentos_reprogramacion,
            creado_por
        ];

        const { rows } = await pool.query(query, values);

        // Get the complete pattern information for response
        const completePattern = await pool.query(`
            SELECT 
                cr.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS_RECURRENTES cr
            JOIN PACIENTES p ON cr.id_paciente = p.id
            JOIN USUARIOS u ON cr.medico_id = u.id
            WHERE cr.id = $1
        `, [rows[0].id]);

        res.status(201).json({
            success: true,
            data: completePattern.rows[0],
            message: 'Recurring appointment pattern created successfully'
        });

    } catch (err) {
        console.error('Error creating recurring appointment:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/recurring-appointments/:id/generate - Generate appointments from pattern
router.post('/:id/generate', async (req, res) => {
    const { id } = req.params;
    const {
        generate_count = 10,
        force_generate = false,
        start_from_date
    } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid recurring pattern ID provided'
        });
    }

    try {
        const pool = getPool();

        // Get the recurring pattern
        const patternQuery = await pool.query(
            'SELECT * FROM CITAS_RECURRENTES WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (patternQuery.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Recurring pattern not found or inactive'
            });
        }

        const pattern = patternQuery.rows[0];

        if (pattern.estado !== 'ACTIVO') {
            return res.status(400).json({
                success: false,
                error: 'Pattern is not active'
            });
        }

        // Check if we've reached the maximum occurrences
        if (pattern.numero_ocurrencias && pattern.ocurrencias_generadas >= pattern.numero_ocurrencias) {
            return res.status(400).json({
                success: false,
                error: 'Maximum number of occurrences already generated'
            });
        }

        // Generate appointment dates based on pattern
        const appointmentDates = generateRecurringDates(
            pattern,
            generate_count,
            start_from_date
        );

        const generatedAppointments = [];
        const conflicts = [];
        const errors = [];

        // Get user ID from auth middleware (if available)
        const creado_por = req.user?.id || null;

        for (let i = 0; i < appointmentDates.length; i++) {
            const appointmentDate = appointmentDates[i];
            const sequenceNumber = pattern.ocurrencias_generadas + i + 1;

            try {
                // Check for conflicts
                const conflictCheck = await pool.query(`
                    SELECT id, numero_cita, fecha_hora, duracion_minutos
                    FROM CITAS
                    WHERE medico_id = $1
                    AND activo = TRUE
                    AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                    AND (
                        ($2 BETWEEN fecha_hora AND fecha_hora_fin) OR
                        ($2 + INTERVAL '1 minute' * $3 BETWEEN fecha_hora AND fecha_hora_fin) OR
                        (fecha_hora BETWEEN $2 AND $2 + INTERVAL '1 minute' * $3)
                    )
                `, [pattern.medico_id, appointmentDate, pattern.duracion_minutos]);

                if (conflictCheck.rowCount > 0 && !force_generate) {
                    conflicts.push({
                        date: appointmentDate,
                        conflict: conflictCheck.rows[0],
                        sequence: sequenceNumber
                    });
                    continue;
                }

                // Create the appointment
                const appointmentQuery = `
                    INSERT INTO CITAS (
                        id_paciente, medico_id, fecha_hora, duracion_minutos,
                        tipo_cita, motivo, observaciones, creado_por
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8
                    ) RETURNING *
                `;

                const appointmentValues = [
                    pattern.id_paciente,
                    pattern.medico_id,
                    appointmentDate,
                    pattern.duracion_minutos,
                    pattern.tipo_cita,
                    pattern.motivo,
                    `Generated from recurring pattern: ${pattern.nombre_patron}`,
                    creado_por
                ];

                const { rows: appointmentRows } = await pool.query(appointmentQuery, appointmentValues);
                const newAppointment = appointmentRows[0];

                // Create instance record
                const instanceQuery = `
                    INSERT INTO CITAS_RECURRENTES_INSTANCIAS (
                        patron_recurrente_id, cita_id, numero_secuencia,
                        fecha_programada_original, estado_generacion
                    ) VALUES (
                        $1, $2, $3, $4, 'GENERADA'
                    ) RETURNING *
                `;

                await pool.query(instanceQuery, [
                    pattern.id,
                    newAppointment.id,
                    sequenceNumber,
                    appointmentDate.split('T')[0]
                ]);

                generatedAppointments.push({
                    appointment: newAppointment,
                    sequence: sequenceNumber,
                    date: appointmentDate
                });

            } catch (err) {
                errors.push({
                    date: appointmentDate,
                    sequence: sequenceNumber,
                    error: err.message
                });
            }
        }

        // Update the pattern's generated count
        if (generatedAppointments.length > 0) {
            await pool.query(`
                UPDATE CITAS_RECURRENTES 
                SET ocurrencias_generadas = ocurrencias_generadas + $1,
                    fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [generatedAppointments.length, id]);
        }

        res.status(200).json({
            success: true,
            data: {
                pattern: pattern.nombre_patron,
                requested: generate_count,
                generated: generatedAppointments.length,
                conflicts: conflicts.length,
                errors: errors.length,
                appointments: generatedAppointments,
                conflictDetails: conflicts,
                errorDetails: errors
            },
            message: `Generated ${generatedAppointments.length} appointments from recurring pattern`
        });

    } catch (err) {
        console.error(`Error generating appointments from pattern ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/recurring-appointments/:id/status - Update pattern status
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado, motivo_pausa } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid recurring pattern ID provided'
        });
    }

    // Validate status
    const validStates = ['ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO'];
    if (!estado || !validStates.includes(estado)) {
        return res.status(400).json({
            success: false,
            error: 'Valid status is required (ACTIVO, PAUSADO, FINALIZADO, CANCELADO)'
        });
    }

    try {
        const pool = getPool();

        // Check if pattern exists
        const existingPattern = await pool.query(
            'SELECT * FROM CITAS_RECURRENTES WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (existingPattern.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Recurring pattern not found or inactive'
            });
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Build update query based on status
        let updateQuery = `
            UPDATE CITAS_RECURRENTES SET 
                estado = $1,
                modificado_por = $2,
                fecha_modificacion = CURRENT_TIMESTAMP
        `;
        let updateValues = [estado, modificado_por];
        let paramIndex = 3;

        if (estado === 'PAUSADO') {
            updateQuery += `, fecha_pausa = CURRENT_TIMESTAMP, motivo_pausa = $${paramIndex}`;
            updateValues.push(motivo_pausa);
            paramIndex++;
        } else if (estado === 'ACTIVO') {
            updateQuery += `, fecha_pausa = NULL, motivo_pausa = NULL`;
        }

        updateQuery += ` WHERE id = $${paramIndex} AND activo = TRUE RETURNING *`;
        updateValues.push(id);

        const { rows, rowCount } = await pool.query(updateQuery, updateValues);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Recurring pattern not found or inactive'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: `Recurring pattern status updated to ${estado} successfully`
        });

    } catch (err) {
        console.error(`Error updating recurring pattern status ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/recurring-appointments/:id/instances - Get pattern instances
router.get('/:id/instances', async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, estado_generacion } = req.query;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid recurring pattern ID provided'
        });
    }

    try {
        const pool = getPool();

        // Build query for instances
        let instanceQuery = `
            SELECT 
                cri.id,
                cri.numero_secuencia,
                cri.fecha_programada_original,
                cri.fecha_generacion,
                cri.estado_generacion,
                cri.motivo_omision,
                cri.intentos_reprogramacion,
                cri.modificada_manualmente,
                c.id as cita_id,
                c.numero_cita,
                c.fecha_hora,
                c.estado as estado_cita,
                c.motivo_cancelacion
            FROM CITAS_RECURRENTES_INSTANCIAS cri
            LEFT JOIN CITAS c ON cri.cita_id = c.id
            WHERE cri.patron_recurrente_id = $1
        `;

        const params = [id];
        let paramIndex = 2;

        if (estado_generacion) {
            instanceQuery += ` AND cri.estado_generacion = $${paramIndex}`;
            params.push(estado_generacion);
            paramIndex++;
        }

        instanceQuery += ` ORDER BY cri.numero_secuencia`;

        // Add pagination
        const { clause: paginationClause, params: paginationParams } = utils.buildPaginationClause(
            parseInt(page),
            parseInt(limit),
            paramIndex
        );
        instanceQuery += ` ${paginationClause}`;
        params.push(...paginationParams);

        const { rows } = await pool.query(instanceQuery, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM CITAS_RECURRENTES_INSTANCIAS cri
            WHERE cri.patron_recurrente_id = $1
            ${estado_generacion ? 'AND cri.estado_generacion = $2' : ''}
        `;
        const countParams = estado_generacion ? [id, estado_generacion] : [id];
        const { rows: countRows } = await pool.query(countQuery, countParams);
        const total = parseInt(countRows[0].total);

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
            message: `Found ${rows.length} pattern instances`
        });

    } catch (err) {
        console.error(`Error getting pattern instances ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

/**
 * Helper function to calculate end time based on start time and duration
 */
function calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
}

/**
 * Helper function to generate recurring appointment dates
 */
function generateRecurringDates(pattern, count, startFromDate) {
    const dates = [];
    const startDate = startFromDate ? new Date(startFromDate) : new Date(pattern.fecha_inicio);
    const endDate = pattern.fecha_fin ? new Date(pattern.fecha_fin) : null;

    let currentDate = new Date(startDate);
    let generated = 0;
    let iterations = 0;
    const maxIterations = count * 10; // Prevent infinite loops

    while (generated < count && iterations < maxIterations) {
        iterations++;

        // Check if we've exceeded the end date
        if (endDate && currentDate > endDate) {
            break;
        }

        // Check if this date should generate an appointment
        if (shouldGenerateOnDate(currentDate, pattern)) {
            const appointmentDateTime = new Date(currentDate);
            const [hours, minutes] = pattern.hora_inicio.split(':').map(Number);
            appointmentDateTime.setHours(hours, minutes, 0, 0);

            // Only include future dates
            if (appointmentDateTime > new Date()) {
                dates.push(appointmentDateTime.toISOString());
                generated++;
            }
        }

        // Move to next date based on recurrence type
        currentDate = getNextRecurrenceDate(currentDate, pattern);
    }

    return dates;
}

/**
 * Helper function to check if an appointment should be generated on a specific date
 */
function shouldGenerateOnDate(date, pattern) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    switch (pattern.tipo_recurrencia) {
        case 'DIARIA':
            return true;

        case 'SEMANAL':
            if (pattern.dias_semana) {
                const diasSemana = JSON.parse(pattern.dias_semana);
                // Convert Sunday (0) to 7 for consistency with database
                const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
                return diasSemana.includes(dbDayOfWeek);
            }
            return false;

        case 'MENSUAL':
            if (pattern.dia_mes) {
                return date.getDate() === pattern.dia_mes;
            }
            return false;

        case 'ANUAL':
            if (pattern.mes_año && pattern.dia_mes) {
                return date.getMonth() + 1 === pattern.mes_año && date.getDate() === pattern.dia_mes;
            }
            return false;

        default:
            return false;
    }
}

/**
 * Helper function to get the next recurrence date
 */
function getNextRecurrenceDate(currentDate, pattern) {
    const nextDate = new Date(currentDate);

    switch (pattern.tipo_recurrencia) {
        case 'DIARIA':
            nextDate.setDate(nextDate.getDate() + pattern.intervalo_recurrencia);
            break;

        case 'SEMANAL':
            nextDate.setDate(nextDate.getDate() + 1);
            break;

        case 'MENSUAL':
            nextDate.setMonth(nextDate.getMonth() + pattern.intervalo_recurrencia);
            break;

        case 'ANUAL':
            nextDate.setFullYear(nextDate.getFullYear() + pattern.intervalo_recurrencia);
            break;

        default:
            nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
}

module.exports = router;