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

// GET /api/v1/waitlist - Get waitlist entries with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'puntuacion_prioridad',
            sortOrder = 'DESC',
            estado,
            prioridad,
            medico_id,
            tipo_cita,
            es_urgente,
            activo = 'true'
        } = req.query;

        // Build base query using the complete view
        let baseQuery = `
            SELECT 
                le.id,
                le.numero_lista,
                le.tipo_cita,
                le.especialidad,
                le.prioridad,
                le.puntuacion_prioridad,
                le.estado,
                le.posicion_actual,
                le.tiempo_espera_total_horas,
                le.es_urgente,
                le.motivo,
                le.fecha_preferida_inicio,
                le.fecha_preferida_fin,
                le.horario_preferido_inicio,
                le.horario_preferido_fin,
                le.dias_semana_preferidos,
                le.acepta_cualquier_horario,
                le.fecha_creacion,
                le.fecha_notificacion,
                le.intentos_notificacion,
                le.fecha_expiracion,
                le.metodo_notificacion_preferido,
                le.telefono_notificacion,
                le.email_notificacion,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.telefono as telefono_paciente,
                p.numero_expediente,
                CONCAT(u.nombres, ' ', u.apellidos) as medico_preferido,
                u.especialidad as especialidad_medico
            FROM LISTA_ESPERA le
            JOIN PACIENTES p ON le.id_paciente = p.id
            LEFT JOIN USUARIOS u ON le.medico_preferido_id = u.id
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            filters['le.activo'] = activo === 'true';
        }

        // Search filter (patient name, waitlist number, reason)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                CONCAT(p.nombre, ' ', p.apellido) ILIKE $${paramIndex} OR 
                le.numero_lista ILIKE $${paramIndex + 1} OR 
                le.motivo ILIKE $${paramIndex + 2}
            )`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        // Additional filters
        if (estado) filters['le.estado'] = estado;
        if (prioridad) filters['le.prioridad'] = prioridad;
        if (medico_id) filters['le.medico_preferido_id'] = parseInt(medico_id);
        if (tipo_cita) filters['le.tipo_cita'] = tipo_cita;
        if (es_urgente !== undefined) filters['le.es_urgente'] = es_urgente === 'true';

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
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_waitlist`;
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
            message: `Found ${rows.length} waitlist entries`
        });

    } catch (err) {
        console.error('Error getting waitlist:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/waitlist - Add patient to waitlist
router.post('/', async (req, res) => {
    const {
        id_paciente,
        medico_preferido_id,
        tipo_cita,
        especialidad,
        duracion_minutos = 30,
        motivo,
        fecha_preferida_inicio,
        fecha_preferida_fin,
        horario_preferido_inicio,
        horario_preferido_fin,
        dias_semana_preferidos,
        acepta_cualquier_horario = false,
        prioridad = 'NORMAL',
        es_urgente = false,
        motivo_urgencia,
        metodo_notificacion_preferido = 'EMAIL',
        telefono_notificacion,
        email_notificacion,
        acepta_notificaciones_automaticas = true,
        tiempo_respuesta_horas = 24
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!id_paciente || isNaN(parseInt(id_paciente))) {
        errors.push('Valid patient ID is required');
    }
    if (!tipo_cita) {
        errors.push('Appointment type is required');
    }
    if (!motivo || motivo.trim().length < 5) {
        errors.push('Reason is required and must be at least 5 characters');
    }

    // Validate appointment type
    const validTypes = ['CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'];
    if (tipo_cita && !validTypes.includes(tipo_cita)) {
        errors.push('Invalid appointment type');
    }

    // Validate priority
    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
    if (prioridad && !validPriorities.includes(prioridad)) {
        errors.push('Invalid priority level');
    }

    // Validate notification method
    const validMethods = ['EMAIL', 'SMS', 'TELEFONO', 'WHATSAPP'];
    if (metodo_notificacion_preferido && !validMethods.includes(metodo_notificacion_preferido)) {
        errors.push('Invalid notification method');
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
            'SELECT id, nombre, apellido, activo, telefono, email FROM PACIENTES WHERE id = $1',
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

        const patient = patientCheck.rows[0];

        // Check if doctor exists (if specified)
        if (medico_preferido_id) {
            const doctorCheck = await pool.query(
                'SELECT id, nombres, apellidos, activo FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ADMIN\')',
                [medico_preferido_id]
            );

            if (doctorCheck.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Preferred doctor not found or not authorized'
                });
            }

            if (!doctorCheck.rows[0].activo) {
                return res.status(400).json({
                    success: false,
                    error: 'Preferred doctor is inactive'
                });
            }
        }

        // Check if patient already has an active waitlist entry for the same type
        const existingEntry = await pool.query(`
            SELECT id, numero_lista, estado
            FROM LISTA_ESPERA
            WHERE id_paciente = $1
            AND tipo_cita = $2
            AND estado IN ('ACTIVA', 'NOTIFICADA')
            AND activo = TRUE
        `, [id_paciente, tipo_cita]);

        if (existingEntry.rowCount > 0) {
            return res.status(409).json({
                success: false,
                error: 'Patient already has an active waitlist entry for this appointment type',
                existingEntry: existingEntry.rows[0]
            });
        }

        // Calculate priority score
        const priorityScores = {
            'BAJA': 10,
            'NORMAL': 50,
            'ALTA': 100,
            'URGENTE': 200
        };

        let puntuacion_prioridad = priorityScores[prioridad];
        if (es_urgente) {
            puntuacion_prioridad += 50;
        }

        // Calculate current position (last position + 1)
        const positionQuery = await pool.query(`
            SELECT COALESCE(MAX(posicion_actual), 0) + 1 as nueva_posicion
            FROM LISTA_ESPERA
            WHERE activo = TRUE AND estado IN ('ACTIVA', 'NOTIFICADA')
        `);
        const posicion_actual = positionQuery.rows[0].nueva_posicion;

        // Set expiration date (30 days from now by default)
        const fecha_expiracion = new Date();
        fecha_expiracion.setDate(fecha_expiracion.getDate() + 30);

        // Use patient contact info if not provided
        const telefono_final = telefono_notificacion || patient.telefono;
        const email_final = email_notificacion || patient.email;

        // Get user ID from auth middleware (if available)
        const creado_por = req.user?.id || null;

        const query = `
            INSERT INTO LISTA_ESPERA (
                id_paciente, medico_preferido_id, tipo_cita, especialidad,
                duracion_minutos, motivo, fecha_preferida_inicio, fecha_preferida_fin,
                horario_preferido_inicio, horario_preferido_fin, dias_semana_preferidos,
                acepta_cualquier_horario, prioridad, puntuacion_prioridad, es_urgente,
                motivo_urgencia, posicion_actual, posicion_inicial, mejor_posicion_alcanzada,
                metodo_notificacion_preferido, telefono_notificacion, email_notificacion,
                acepta_notificaciones_automaticas, tiempo_respuesta_horas, fecha_expiracion,
                creado_por
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $17, $17, $18, $19, $20, $21, $22, $23, $24
            ) RETURNING *
        `;

        const values = [
            id_paciente, medico_preferido_id, tipo_cita, especialidad,
            duracion_minutos, motivo, fecha_preferida_inicio, fecha_preferida_fin,
            horario_preferido_inicio, horario_preferido_fin,
            dias_semana_preferidos ? JSON.stringify(dias_semana_preferidos) : null,
            acepta_cualquier_horario, prioridad, puntuacion_prioridad, es_urgente,
            motivo_urgencia, posicion_actual,
            metodo_notificacion_preferido, telefono_final, email_final,
            acepta_notificaciones_automaticas, tiempo_respuesta_horas, fecha_expiracion,
            creado_por
        ];

        const { rows } = await pool.query(query, values);

        // Get the complete waitlist entry for response
        const completeEntry = await pool.query(`
            SELECT 
                le.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as medico_preferido
            FROM LISTA_ESPERA le
            JOIN PACIENTES p ON le.id_paciente = p.id
            LEFT JOIN USUARIOS u ON le.medico_preferido_id = u.id
            WHERE le.id = $1
        `, [rows[0].id]);

        res.status(201).json({
            success: true,
            data: completeEntry.rows[0],
            message: 'Patient added to waitlist successfully'
        });

    } catch (err) {
        console.error('Error adding to waitlist:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/waitlist/:id/priority - Update waitlist entry priority
router.put('/:id/priority', async (req, res) => {
    const { id } = req.params;
    const { prioridad, es_urgente, motivo_urgencia } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid waitlist entry ID provided'
        });
    }

    // Validate priority
    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
    if (prioridad && !validPriorities.includes(prioridad)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid priority level'
        });
    }

    try {
        const pool = getPool();

        // Check if entry exists
        const existingEntry = await pool.query(
            'SELECT * FROM LISTA_ESPERA WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (existingEntry.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found or inactive'
            });
        }

        const current = existingEntry.rows[0];

        // Calculate new priority score
        const priorityScores = {
            'BAJA': 10,
            'NORMAL': 50,
            'ALTA': 100,
            'URGENTE': 200
        };

        const newPrioridad = prioridad || current.prioridad;
        const newEsUrgente = es_urgente !== undefined ? es_urgente : current.es_urgente;

        let puntuacion_prioridad = priorityScores[newPrioridad];
        if (newEsUrgente) {
            puntuacion_prioridad += 50;
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        const query = `
            UPDATE LISTA_ESPERA SET 
                prioridad = $1,
                puntuacion_prioridad = $2,
                es_urgente = $3,
                motivo_urgencia = $4,
                fecha_escalacion = CASE WHEN $1 != $6 OR $3 != $7 THEN CURRENT_TIMESTAMP ELSE fecha_escalacion END,
                escalado_por = CASE WHEN $1 != $6 OR $3 != $7 THEN $5 ELSE escalado_por END,
                modificado_por = $5,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $8 AND activo = TRUE 
            RETURNING *
        `;

        const { rows, rowCount } = await pool.query(query, [
            newPrioridad, puntuacion_prioridad, newEsUrgente, motivo_urgencia,
            modificado_por, current.prioridad, current.es_urgente, id
        ]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found or inactive'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Waitlist entry priority updated successfully'
        });

    } catch (err) {
        console.error(`Error updating waitlist priority ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/waitlist/:id/convert - Convert waitlist entry to appointment
router.post('/:id/convert', async (req, res) => {
    const { id } = req.params;
    const {
        fecha_hora,
        duracion_minutos,
        medico_id,
        sala_consulta,
        observaciones
    } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid waitlist entry ID provided'
        });
    }

    // Validate required fields
    const errors = [];
    if (!fecha_hora) {
        errors.push('Appointment date and time is required');
    }
    if (!medico_id || isNaN(parseInt(medico_id))) {
        errors.push('Valid doctor ID is required');
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

        // Start transaction
        await pool.query('BEGIN');

        try {
            // Get waitlist entry
            const waitlistQuery = await pool.query(
                'SELECT * FROM LISTA_ESPERA WHERE id = $1 AND activo = TRUE AND estado = \'ACTIVA\'',
                [id]
            );

            if (waitlistQuery.rowCount === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Waitlist entry not found, inactive, or already converted'
                });
            }

            const waitlistEntry = waitlistQuery.rows[0];

            // Check for scheduling conflicts
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
            `, [medico_id, fecha_hora, duracion_minutos || waitlistEntry.duracion_minutos]);

            if (conflictCheck.rowCount > 0) {
                await pool.query('ROLLBACK');
                const conflict = conflictCheck.rows[0];
                return res.status(409).json({
                    success: false,
                    error: 'Scheduling conflict detected',
                    details: `Doctor already has appointment ${conflict.numero_cita} scheduled at ${conflict.fecha_hora}`,
                    conflictingAppointment: conflict
                });
            }

            // Get user ID from auth middleware (if available)
            const convertido_por = req.user?.id || null;

            // Create the appointment
            const appointmentQuery = `
                INSERT INTO CITAS (
                    id_paciente, medico_id, fecha_hora, duracion_minutos,
                    tipo_cita, especialidad, motivo, observaciones,
                    telefono_contacto, email_contacto,
                    sala_consulta, creado_por
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                ) RETURNING *
            `;

            const appointmentValues = [
                waitlistEntry.id_paciente,
                medico_id,
                fecha_hora,
                duracion_minutos || waitlistEntry.duracion_minutos,
                waitlistEntry.tipo_cita,
                waitlistEntry.especialidad,
                waitlistEntry.motivo,
                observaciones,
                waitlistEntry.telefono_notificacion,
                waitlistEntry.email_notificacion,
                sala_consulta,
                convertido_por
            ];

            const { rows: appointmentRows } = await pool.query(appointmentQuery, appointmentValues);
            const newAppointment = appointmentRows[0];

            // Update waitlist entry status
            const updateWaitlistQuery = `
                UPDATE LISTA_ESPERA SET 
                    estado = 'CONVERTIDA',
                    cita_convertida_id = $1,
                    fecha_conversion = CURRENT_TIMESTAMP,
                    convertido_por = $2,
                    modificado_por = $2,
                    fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;

            const { rows: waitlistRows } = await pool.query(updateWaitlistQuery, [
                newAppointment.id,
                convertido_por,
                id
            ]);

            // Commit transaction
            await pool.query('COMMIT');

            // Get complete appointment information for response
            const completeAppointment = await pool.query(`
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
                FROM CITAS c
                JOIN PACIENTES p ON c.id_paciente = p.id
                JOIN USUARIOS u ON c.medico_id = u.id
                WHERE c.id = $1
            `, [newAppointment.id]);

            res.status(201).json({
                success: true,
                data: {
                    appointment: completeAppointment.rows[0],
                    waitlistEntry: waitlistRows[0]
                },
                message: 'Waitlist entry converted to appointment successfully'
            });

        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }

    } catch (err) {
        console.error(`Error converting waitlist entry ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// DELETE /api/v1/waitlist/:id - Cancel waitlist entry
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid waitlist entry ID provided'
        });
    }

    try {
        const pool = getPool();

        // Check if entry exists
        const checkQuery = `
            SELECT 
                le.id, 
                le.numero_lista,
                le.estado,
                le.activo,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente
            FROM LISTA_ESPERA le
            JOIN PACIENTES p ON le.id_paciente = p.id
            WHERE le.id = $1
        `;

        const { rows: checkRows, rowCount: checkCount } = await pool.query(checkQuery, [id]);

        if (checkCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found'
            });
        }

        const entry = checkRows[0];

        if (!entry.activo) {
            return res.status(400).json({
                success: false,
                error: 'Waitlist entry is already inactive'
            });
        }

        if (entry.estado === 'CANCELADA') {
            return res.status(400).json({
                success: false,
                error: 'Waitlist entry is already cancelled'
            });
        }

        // Get user ID from auth middleware (if available)
        const cancelado_por = req.user?.id || null;

        // Cancel the waitlist entry
        const cancelQuery = `
            UPDATE LISTA_ESPERA 
            SET 
                estado = 'CANCELADA',
                fecha_cancelacion = CURRENT_TIMESTAMP,
                motivo_cancelacion = $1,
                cancelado_por = $2,
                modificado_por = $2,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $3 AND activo = TRUE
            RETURNING id, numero_lista, estado
        `;

        const { rows: cancelRows, rowCount: cancelCount } = await pool.query(cancelQuery, [
            motivo_cancelacion || 'Cancelled by user',
            cancelado_por,
            id
        ]);

        if (cancelCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found or already inactive'
            });
        }

        res.status(200).json({
            success: true,
            message: `Waitlist entry ${entry.numero_lista} has been cancelled successfully`,
            data: {
                id: entry.id,
                numero_lista: entry.numero_lista,
                status: 'cancelled',
                patient: entry.nombre_paciente
            }
        });

    } catch (err) {
        console.error(`Error cancelling waitlist entry ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/waitlist/metrics - Get waitlist metrics and statistics
router.get('/metrics', async (req, res) => {
    try {
        const pool = getPool();

        // Get overall metrics
        const metricsQuery = `
            SELECT 
                COUNT(*) as total_entradas,
                COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) as activas,
                COUNT(CASE WHEN estado = 'NOTIFICADA' THEN 1 END) as notificadas,
                COUNT(CASE WHEN estado = 'CONVERTIDA' THEN 1 END) as convertidas,
                COUNT(CASE WHEN estado = 'EXPIRADA' THEN 1 END) as expiradas,
                COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as canceladas,
                COUNT(CASE WHEN es_urgente = TRUE THEN 1 END) as urgentes,
                AVG(tiempo_espera_total_horas) as tiempo_espera_promedio,
                MAX(tiempo_espera_total_horas) as tiempo_espera_maximo,
                MIN(tiempo_espera_total_horas) as tiempo_espera_minimo,
                AVG(posicion_actual) as posicion_promedio,
                COUNT(CASE WHEN fecha_creacion >= NOW() - INTERVAL '24 hours' THEN 1 END) as nuevas_24h,
                COUNT(CASE WHEN fecha_conversion >= NOW() - INTERVAL '24 hours' THEN 1 END) as convertidas_24h
            FROM LISTA_ESPERA
            WHERE activo = TRUE
        `;

        const { rows: metricsRows } = await pool.query(metricsQuery);

        // Get metrics by priority
        const priorityQuery = `
            SELECT 
                prioridad,
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) as activas,
                AVG(tiempo_espera_total_horas) as tiempo_espera_promedio
            FROM LISTA_ESPERA
            WHERE activo = TRUE
            GROUP BY prioridad
            ORDER BY 
                CASE prioridad 
                    WHEN 'URGENTE' THEN 1 
                    WHEN 'ALTA' THEN 2 
                    WHEN 'NORMAL' THEN 3 
                    WHEN 'BAJA' THEN 4 
                END
        `;

        const { rows: priorityRows } = await pool.query(priorityQuery);

        // Get metrics by appointment type
        const typeQuery = `
            SELECT 
                tipo_cita,
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) as activas,
                AVG(tiempo_espera_total_horas) as tiempo_espera_promedio
            FROM LISTA_ESPERA
            WHERE activo = TRUE
            GROUP BY tipo_cita
            ORDER BY total DESC
        `;

        const { rows: typeRows } = await pool.query(typeQuery);

        // Get conversion rate by week
        const conversionQuery = `
            SELECT 
                DATE_TRUNC('week', fecha_creacion) as semana,
                COUNT(*) as total_creadas,
                COUNT(CASE WHEN estado = 'CONVERTIDA' THEN 1 END) as convertidas,
                ROUND(
                    COUNT(CASE WHEN estado = 'CONVERTIDA' THEN 1 END) * 100.0 / COUNT(*), 
                    2
                ) as tasa_conversion
            FROM LISTA_ESPERA
            WHERE activo = TRUE
            AND fecha_creacion >= NOW() - INTERVAL '8 weeks'
            GROUP BY DATE_TRUNC('week', fecha_creacion)
            ORDER BY semana DESC
            LIMIT 8
        `;

        const { rows: conversionRows } = await pool.query(conversionQuery);

        res.status(200).json({
            success: true,
            data: {
                general: metricsRows[0],
                byPriority: priorityRows,
                byType: typeRows,
                conversionTrend: conversionRows
            },
            message: 'Waitlist metrics retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting waitlist metrics:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;