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

// GET /api/v1/schedule-management/providers - Get all providers with their schedules
router.get('/providers', async (req, res) => {
    try {
        const pool = getPool();

        const {
            page = 1,
            limit = 20,
            search = '',
            especialidad,
            activo = 'true'
        } = req.query;

        let baseQuery = `
            SELECT 
                u.id,
                u.nombres,
                u.apellidos,
                u.especialidad,
                u.activo,
                u.fecha_creacion,
                COUNT(DISTINCT h.id) as horarios_configurados,
                COUNT(DISTINCT e.id) as excepciones_activas,
                COUNT(DISTINCT c.id) as citas_proximas
            FROM USUARIOS u
            LEFT JOIN HORARIOS_MEDICOS h ON u.id = h.medico_id AND h.activo = TRUE
            LEFT JOIN EXCEPCIONES_HORARIO e ON u.id = e.medico_id 
                AND e.activo = TRUE 
                AND e.estado_excepcion = 'ACTIVA'
                AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)
            LEFT JOIN CITAS c ON u.id = c.medico_id 
                AND c.activo = TRUE 
                AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
                AND c.fecha_hora >= CURRENT_TIMESTAMP
            WHERE u.rol IN ('MEDICO', 'ESPECIALISTA', 'ADMIN')
        `;

        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            baseQuery += ` AND u.activo = $${paramIndex}`;
            params.push(activo === 'true');
            paramIndex++;
        }

        // Search filter
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` AND (
                u.nombres ILIKE $${paramIndex} OR 
                u.apellidos ILIKE $${paramIndex + 1} OR 
                u.especialidad ILIKE $${paramIndex + 2}
            )`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        // Specialty filter
        if (especialidad) {
            baseQuery += ` AND u.especialidad = $${paramIndex}`;
            params.push(especialidad);
            paramIndex++;
        }

        baseQuery += ` GROUP BY u.id, u.nombres, u.apellidos, u.especialidad, u.activo, u.fecha_creacion`;

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_providers`;
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].total);

        // Add sorting and pagination
        baseQuery += ` ORDER BY u.apellidos, u.nombres`;

        const { clause: paginationClause, params: paginationParams } = utils.buildPaginationClause(
            parseInt(page),
            parseInt(limit),
            paramIndex
        );
        baseQuery += ` ${paginationClause}`;
        params.push(...paginationParams);

        const { rows } = await pool.query(baseQuery, params);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            message: `Found ${rows.length} providers`
        });

    } catch (err) {
        console.error('Error getting providers:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/schedule-management/providers/:id/schedule - Get provider's complete schedule
router.get('/providers/:id/schedule', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid provider ID provided'
        });
    }

    try {
        const pool = getPool();

        // Get provider information
        const providerQuery = `
            SELECT id, nombres, apellidos, especialidad, activo
            FROM USUARIOS
            WHERE id = $1 AND rol IN ('MEDICO', 'ESPECIALISTA', 'ADMIN')
        `;

        const { rows: providerRows } = await pool.query(providerQuery, [id]);

        if (providerRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        const provider = providerRows[0];

        // Get regular schedules
        const schedulesQuery = `
            SELECT 
                id,
                dia_semana,
                hora_inicio,
                hora_fin,
                duracion_cita_minutos,
                pausas,
                fecha_inicio_vigencia,
                fecha_fin_vigencia,
                activo
            FROM HORARIOS_MEDICOS
            WHERE medico_id = $1
            ORDER BY dia_semana, fecha_inicio_vigencia DESC
        `;

        const { rows: schedules } = await pool.query(schedulesQuery, [id]);

        // Get active exceptions
        const exceptionsQuery = `
            SELECT 
                id,
                fecha,
                fecha_fin,
                tipo_excepcion,
                motivo,
                hora_inicio_especial,
                hora_fin_especial,
                es_recurrente,
                patron_recurrencia,
                prioridad,
                estado_excepcion,
                observaciones
            FROM EXCEPCIONES_HORARIO
            WHERE medico_id = $1
            AND activo = TRUE
            AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
            ORDER BY fecha, prioridad DESC
        `;

        const { rows: exceptions } = await pool.query(exceptionsQuery, [id]);

        // Get applied templates
        const templatesQuery = `
            SELECT 
                ap.id,
                ap.fecha_inicio_aplicacion,
                ap.fecha_fin_aplicacion,
                ap.estado_aplicacion,
                p.nombre as plantilla_nombre,
                p.descripcion as plantilla_descripcion,
                p.tipo_plantilla
            FROM APLICACION_PLANTILLAS ap
            JOIN PLANTILLAS_DISPONIBILIDAD p ON ap.plantilla_id = p.id
            WHERE ap.usuario_id = $1
            AND ap.activo = TRUE
            ORDER BY ap.fecha_inicio_aplicacion DESC
        `;

        const { rows: templates } = await pool.query(templatesQuery, [id]);

        res.status(200).json({
            success: true,
            data: {
                provider,
                schedules,
                exceptions,
                appliedTemplates: templates,
                summary: {
                    totalSchedules: schedules.length,
                    activeSchedules: schedules.filter(s => s.activo).length,
                    totalExceptions: exceptions.length,
                    activeExceptions: exceptions.filter(e => e.estado_excepcion === 'ACTIVA').length,
                    appliedTemplates: templates.length
                }
            },
            message: `Retrieved complete schedule for ${provider.nombres} ${provider.apellidos}`
        });

    } catch (err) {
        console.error('Error getting provider schedule:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/schedule-management/providers/:id/schedule - Create/Update provider schedule
router.post('/providers/:id/schedule', async (req, res) => {
    const { id } = req.params;
    const {
        dia_semana,
        hora_inicio,
        hora_fin,
        duracion_cita_minutos = 30,
        pausas,
        fecha_inicio_vigencia,
        fecha_fin_vigencia
    } = req.body;

    // Validation
    const errors = [];
    if (!id || isNaN(parseInt(id))) {
        errors.push('Invalid provider ID');
    }
    if (!dia_semana || dia_semana < 1 || dia_semana > 7) {
        errors.push('Valid day of week (1-7) is required');
    }
    if (!hora_inicio || !hora_fin) {
        errors.push('Start and end times are required');
    }
    if (!fecha_inicio_vigencia) {
        errors.push('Start date for schedule validity is required');
    }

    // Validate time format and logic
    if (hora_inicio && hora_fin) {
        const startTime = new Date(`2000-01-01T${hora_inicio}`);
        const endTime = new Date(`2000-01-01T${hora_fin}`);
        if (startTime >= endTime) {
            errors.push('End time must be after start time');
        }
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

        // Check if provider exists
        const providerCheck = await pool.query(
            'SELECT id FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ESPECIALISTA\', \'ADMIN\')',
            [id]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        // Check for existing schedule conflicts
        const conflictQuery = `
            SELECT id FROM HORARIOS_MEDICOS
            WHERE medico_id = $1
            AND dia_semana = $2
            AND activo = TRUE
            AND fecha_inicio_vigencia <= $3
            AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= $3)
        `;

        const { rows: conflicts } = await pool.query(conflictQuery, [
            id, dia_semana, fecha_inicio_vigencia
        ]);

        if (conflicts.length > 0) {
            // Deactivate existing conflicting schedules
            await pool.query(
                'UPDATE HORARIOS_MEDICOS SET activo = FALSE WHERE id = ANY($1)',
                [conflicts.map(c => c.id)]
            );
        }

        // Create new schedule
        const insertQuery = `
            INSERT INTO HORARIOS_MEDICOS (
                medico_id, dia_semana, hora_inicio, hora_fin,
                duracion_cita_minutos, pausas, fecha_inicio_vigencia,
                fecha_fin_vigencia, creado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const creado_por = req.user?.id || null;
        const { rows } = await pool.query(insertQuery, [
            id, dia_semana, hora_inicio, hora_fin,
            duracion_cita_minutos, pausas ? JSON.stringify(pausas) : null,
            fecha_inicio_vigencia, fecha_fin_vigencia, creado_por
        ]);

        res.status(201).json({
            success: true,
            data: rows[0],
            message: 'Provider schedule created successfully'
        });

    } catch (err) {
        console.error('Error creating provider schedule:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/schedule-management/providers/:id/exceptions - Create schedule exception
router.post('/providers/:id/exceptions', async (req, res) => {
    const { id } = req.params;
    const {
        fecha,
        fecha_fin,
        tipo_excepcion,
        motivo,
        hora_inicio_especial,
        hora_fin_especial,
        es_recurrente = false,
        patron_recurrencia,
        prioridad = 'NORMAL',
        observaciones
    } = req.body;

    // Validation
    const errors = [];
    if (!id || isNaN(parseInt(id))) {
        errors.push('Invalid provider ID');
    }
    if (!fecha) {
        errors.push('Exception date is required');
    }
    if (!tipo_excepcion) {
        errors.push('Exception type is required');
    }
    if (!motivo || motivo.trim().length < 3) {
        errors.push('Reason is required and must be at least 3 characters');
    }

    const validTypes = ['NO_DISPONIBLE', 'HORARIO_ESPECIAL', 'PAUSA_EXTENDIDA'];
    if (tipo_excepcion && !validTypes.includes(tipo_excepcion)) {
        errors.push('Invalid exception type');
    }

    const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'CRITICA'];
    if (prioridad && !validPriorities.includes(prioridad)) {
        errors.push('Invalid priority level');
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

        // Check if provider exists
        const providerCheck = await pool.query(
            'SELECT id FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ESPECIALISTA\', \'ADMIN\')',
            [id]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        // Check for existing exceptions on the same date
        const existingException = await pool.query(
            'SELECT id FROM EXCEPCIONES_HORARIO WHERE medico_id = $1 AND fecha = $2 AND activo = TRUE',
            [id, fecha]
        );

        if (existingException.rowCount > 0) {
            return res.status(409).json({
                success: false,
                error: 'An exception already exists for this date'
            });
        }

        // Create exception
        const insertQuery = `
            INSERT INTO EXCEPCIONES_HORARIO (
                medico_id, fecha, fecha_fin, tipo_excepcion, motivo,
                hora_inicio_especial, hora_fin_especial, es_recurrente,
                patron_recurrencia, prioridad, estado_excepcion,
                observaciones, creado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const creado_por = req.user?.id || null;
        const { rows } = await pool.query(insertQuery, [
            id, fecha, fecha_fin, tipo_excepcion, motivo.trim(),
            hora_inicio_especial, hora_fin_especial, es_recurrente,
            patron_recurrencia ? JSON.stringify(patron_recurrencia) : null,
            prioridad, 'ACTIVA', observaciones, creado_por
        ]);

        res.status(201).json({
            success: true,
            data: rows[0],
            message: 'Schedule exception created successfully'
        });

    } catch (err) {
        console.error('Error creating schedule exception:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/schedule-management/templates - Get available schedule templates
router.get('/templates', async (req, res) => {
    try {
        const pool = getPool();

        const {
            page = 1,
            limit = 20,
            tipo_plantilla,
            activo = 'true'
        } = req.query;

        let baseQuery = `
            SELECT 
                p.id,
                p.nombre,
                p.descripcion,
                p.tipo_plantilla,
                p.configuracion_horarios,
                p.es_plantilla_global,
                p.fecha_inicio_vigencia,
                p.fecha_fin_vigencia,
                p.activo,
                p.fecha_creacion,
                CONCAT(u.nombres, ' ', u.apellidos) as creado_por_nombre,
                COUNT(ap.id) as aplicaciones_activas
            FROM PLANTILLAS_DISPONIBILIDAD p
            LEFT JOIN USUARIOS u ON p.creado_por = u.id
            LEFT JOIN APLICACION_PLANTILLAS ap ON p.id = ap.plantilla_id AND ap.activo = TRUE
        `;

        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            baseQuery += ` WHERE p.activo = $${paramIndex}`;
            params.push(activo === 'true');
            paramIndex++;
        }

        // Template type filter
        if (tipo_plantilla) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                `p.tipo_plantilla = $${paramIndex}`;
            params.push(tipo_plantilla);
            paramIndex++;
        }

        // Only show templates that are currently valid
        baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
            `(p.fecha_fin_vigencia IS NULL OR p.fecha_fin_vigencia >= CURRENT_DATE)`;

        baseQuery += ` GROUP BY p.id, u.nombres, u.apellidos ORDER BY p.nombre`;

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_templates`;
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].total);

        // Add pagination
        const { clause: paginationClause, params: paginationParams } = utils.buildPaginationClause(
            parseInt(page),
            parseInt(limit),
            paramIndex
        );
        baseQuery += ` ${paginationClause}`;
        params.push(...paginationParams);

        const { rows } = await pool.query(baseQuery, params);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            message: `Found ${rows.length} schedule templates`
        });

    } catch (err) {
        console.error('Error getting schedule templates:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/schedule-management/templates/:id/apply - Apply template to provider
router.post('/templates/:id/apply', async (req, res) => {
    const { id } = req.params;
    const {
        usuario_id,
        fecha_inicio_aplicacion,
        fecha_fin_aplicacion,
        configuracion_personalizada
    } = req.body;

    // Validation
    const errors = [];
    if (!id || isNaN(parseInt(id))) {
        errors.push('Invalid template ID');
    }
    if (!usuario_id || isNaN(parseInt(usuario_id))) {
        errors.push('Valid provider ID is required');
    }
    if (!fecha_inicio_aplicacion) {
        errors.push('Application start date is required');
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

        // Check if template exists and is active
        const templateCheck = await pool.query(
            'SELECT * FROM PLANTILLAS_DISPONIBILIDAD WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (templateCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Template not found or inactive'
            });
        }

        // Check if provider exists
        const providerCheck = await pool.query(
            'SELECT id FROM USUARIOS WHERE id = $1 AND rol IN (\'MEDICO\', \'ESPECIALISTA\', \'ADMIN\')',
            [usuario_id]
        );

        if (providerCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        // Check for existing active applications
        const existingApplication = await pool.query(`
            SELECT id FROM APLICACION_PLANTILLAS
            WHERE plantilla_id = $1 AND usuario_id = $2
            AND activo = TRUE AND estado_aplicacion = 'ACTIVA'
        `, [id, usuario_id]);

        if (existingApplication.rowCount > 0) {
            return res.status(409).json({
                success: false,
                error: 'Template is already applied to this provider'
            });
        }

        // Apply template
        const insertQuery = `
            INSERT INTO APLICACION_PLANTILLAS (
                plantilla_id, usuario_id, fecha_inicio_aplicacion,
                fecha_fin_aplicacion, configuracion_personalizada,
                estado_aplicacion, aplicado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const aplicado_por = req.user?.id || null;
        const { rows } = await pool.query(insertQuery, [
            id, usuario_id, fecha_inicio_aplicacion, fecha_fin_aplicacion,
            configuracion_personalizada ? JSON.stringify(configuracion_personalizada) : null,
            'ACTIVA', aplicado_por
        ]);

        res.status(201).json({
            success: true,
            data: rows[0],
            message: 'Template applied to provider successfully'
        });

    } catch (err) {
        console.error('Error applying template:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;