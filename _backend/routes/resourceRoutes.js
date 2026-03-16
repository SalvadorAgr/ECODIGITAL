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

// GET /api/v1/resources - Get list of medical resources
router.get('/', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'nombre',
            sortOrder = 'ASC',
            tipo_recurso,
            ubicacion,
            estado,
            activo = 'true'
        } = req.query;

        // Build base query
        let baseQuery = `
            SELECT 
                r.id,
                r.nombre,
                r.descripcion,
                r.tipo_recurso,
                r.ubicacion,
                r.capacidad_maxima,
                r.estado,
                r.costo_por_hora,
                r.requiere_autorizacion,
                r.tiempo_preparacion_minutos,
                r.tiempo_limpieza_minutos,
                r.equipos_incluidos,
                r.restricciones_uso,
                r.instrucciones_uso,
                r.activo,
                r.fecha_creacion,
                (SELECT COUNT(*) FROM RESERVAS_RECURSOS rr 
                 WHERE rr.recurso_id = r.id 
                 AND rr.fecha_reserva >= CURRENT_DATE 
                 AND rr.estado = 'CONFIRMADA') as reservas_activas
            FROM RECURSOS_MEDICOS r
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            filters['r.activo'] = activo === 'true';
        }

        // Search filter (name, description, location)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                r.nombre ILIKE $${paramIndex} OR 
                r.descripcion ILIKE $${paramIndex + 1} OR 
                r.ubicacion ILIKE $${paramIndex + 2}
            )`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        // Additional filters
        if (tipo_recurso) filters['r.tipo_recurso'] = tipo_recurso;
        if (ubicacion) filters['r.ubicacion'] = ubicacion;
        if (estado) filters['r.estado'] = estado;

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
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_resources`;
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
            message: `Found ${rows.length} medical resources`
        });

    } catch (err) {
        console.error('Error getting resources:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/resources/:id/availability - Check resource availability
router.get('/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { fecha, hora_inicio, duracion_horas = 1 } = req.query;

    // Validate parameters
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid resource ID provided'
        });
    }

    if (!fecha) {
        return res.status(400).json({
            success: false,
            error: 'Date parameter is required'
        });
    }

    try {
        const pool = getPool();

        // Check if resource exists and is active
        const resourceCheck = await pool.query(
            'SELECT * FROM RECURSOS_MEDICOS WHERE id = $1 AND activo = TRUE',
            [id]
        );

        if (resourceCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Resource not found or inactive'
            });
        }

        const resource = resourceCheck.rows[0];

        if (resource.estado !== 'DISPONIBLE') {
            return res.status(200).json({
                success: true,
                data: {
                    resource: resource.nombre,
                    fecha,
                    available: false,
                    reason: `Resource is ${resource.estado.toLowerCase()}`,
                    slots: []
                }
            });
        }

        // Get existing reservations for the date
        const reservationsQuery = `
            SELECT 
                rr.id,
                rr.hora_inicio,
                rr.hora_fin,
                rr.estado,
                rr.proposito,
                CONCAT(u.nombres, ' ', u.apellidos) as reservado_por_nombre
            FROM RESERVAS_RECURSOS rr
            JOIN USUARIOS u ON rr.reservado_por = u.id
            WHERE rr.recurso_id = $1
            AND rr.fecha_reserva = $2
            AND rr.estado IN ('CONFIRMADA', 'EN_USO')
            ORDER BY rr.hora_inicio
        `;

        const { rows: reservations } = await pool.query(reservationsQuery, [id, fecha]);

        // Generate available time slots
        let availableSlots = [];

        if (hora_inicio) {
            // Check specific time slot
            const isAvailable = checkTimeSlotAvailability(
                hora_inicio,
                duracion_horas,
                reservations,
                resource
            );

            availableSlots = isAvailable ? [{
                hora_inicio,
                hora_fin: calculateEndTime(hora_inicio, duracion_horas * 60),
                duracion_horas: parseFloat(duracion_horas),
                available: true
            }] : [];
        } else {
            // Generate all available slots for the day (8 AM to 6 PM)
            availableSlots = generateAvailableSlots(
                '08:00',
                '18:00',
                duracion_horas,
                reservations,
                resource,
                fecha
            );
        }

        res.status(200).json({
            success: true,
            data: {
                resource: {
                    id: resource.id,
                    nombre: resource.nombre,
                    tipo_recurso: resource.tipo_recurso,
                    ubicacion: resource.ubicacion,
                    capacidad_maxima: resource.capacidad_maxima,
                    tiempo_preparacion_minutos: resource.tiempo_preparacion_minutos,
                    tiempo_limpieza_minutos: resource.tiempo_limpieza_minutos
                },
                fecha,
                available: availableSlots.length > 0,
                totalSlots: availableSlots.length,
                slots: availableSlots,
                existingReservations: reservations.length,
                reservations: reservations
            }
        });

    } catch (err) {
        console.error('Error checking resource availability:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/resources/reservations - Create resource reservation
router.post('/reservations', async (req, res) => {
    const {
        recurso_id,
        fecha_reserva,
        hora_inicio,
        hora_fin,
        duracion_horas,
        proposito,
        descripcion,
        cita_id,
        requiere_preparacion = true,
        notas_especiales,
        contacto_responsable,
        telefono_contacto
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!recurso_id || isNaN(parseInt(recurso_id))) {
        errors.push('Valid resource ID is required');
    }
    if (!fecha_reserva) {
        errors.push('Reservation date is required');
    }
    if (!hora_inicio) {
        errors.push('Start time is required');
    }
    if (!proposito || proposito.trim().length < 5) {
        errors.push('Purpose is required and must be at least 5 characters');
    }

    // Validate date is in the future
    if (fecha_reserva && new Date(fecha_reserva) < new Date().setHours(0, 0, 0, 0)) {
        errors.push('Reservation date must be today or in the future');
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

        // Check if resource exists and is available
        const resourceCheck = await pool.query(
            'SELECT * FROM RECURSOS_MEDICOS WHERE id = $1 AND activo = TRUE',
            [recurso_id]
        );

        if (resourceCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Resource not found or inactive'
            });
        }

        const resource = resourceCheck.rows[0];

        if (resource.estado !== 'DISPONIBLE') {
            return res.status(400).json({
                success: false,
                error: `Resource is currently ${resource.estado.toLowerCase()}`
            });
        }

        // Calculate end time if not provided
        const calculatedHoraFin = hora_fin || calculateEndTime(
            hora_inicio,
            (duracion_horas || 1) * 60
        );

        // Check for conflicts
        const conflictCheck = await pool.query(`
            SELECT 
                rr.id,
                rr.hora_inicio,
                rr.hora_fin,
                rr.proposito,
                CONCAT(u.nombres, ' ', u.apellidos) as reservado_por_nombre
            FROM RESERVAS_RECURSOS rr
            JOIN USUARIOS u ON rr.reservado_por = u.id
            WHERE rr.recurso_id = $1
            AND rr.fecha_reserva = $2
            AND rr.estado IN ('CONFIRMADA', 'EN_USO')
            AND (
                ($3 BETWEEN rr.hora_inicio AND rr.hora_fin) OR
                ($4 BETWEEN rr.hora_inicio AND rr.hora_fin) OR
                (rr.hora_inicio BETWEEN $3 AND $4)
            )
        `, [recurso_id, fecha_reserva, hora_inicio, calculatedHoraFin]);

        if (conflictCheck.rowCount > 0) {
            const conflict = conflictCheck.rows[0];
            return res.status(409).json({
                success: false,
                error: 'Resource scheduling conflict detected',
                details: `Resource is already reserved from ${conflict.hora_inicio} to ${conflict.hora_fin} by ${conflict.reservado_por_nombre}`,
                conflictingReservation: conflict
            });
        }

        // Check if appointment exists (if provided)
        if (cita_id) {
            const appointmentCheck = await pool.query(
                'SELECT id, numero_cita, estado FROM CITAS WHERE id = $1 AND activo = TRUE',
                [cita_id]
            );

            if (appointmentCheck.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Associated appointment not found'
                });
            }
        }

        // Calculate total duration including preparation and cleanup
        const totalDuration = calculateTotalDuration(
            duracion_horas || 1,
            resource.tiempo_preparacion_minutos || 0,
            resource.tiempo_limpieza_minutos || 0,
            requiere_preparacion
        );

        // Get user ID from auth middleware (if available)
        const reservado_por = req.user?.id || null;

        const query = `
            INSERT INTO RESERVAS_RECURSOS (
                recurso_id, fecha_reserva, hora_inicio, hora_fin,
                duracion_horas, proposito, descripcion, cita_id,
                requiere_preparacion, notas_especiales,
                contacto_responsable, telefono_contacto,
                reservado_por
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            ) RETURNING *
        `;

        const values = [
            recurso_id, fecha_reserva, hora_inicio, calculatedHoraFin,
            totalDuration, proposito.trim(), descripcion, cita_id,
            requiere_preparacion, notas_especiales,
            contacto_responsable, telefono_contacto,
            reservado_por
        ];

        const { rows } = await pool.query(query, values);

        // Get the complete reservation information for response
        const completeReservation = await pool.query(`
            SELECT 
                rr.*,
                rm.nombre as nombre_recurso,
                rm.tipo_recurso,
                rm.ubicacion,
                CONCAT(u.nombres, ' ', u.apellidos) as reservado_por_nombre,
                c.numero_cita
            FROM RESERVAS_RECURSOS rr
            JOIN RECURSOS_MEDICOS rm ON rr.recurso_id = rm.id
            LEFT JOIN USUARIOS u ON rr.reservado_por = u.id
            LEFT JOIN CITAS c ON rr.cita_id = c.id
            WHERE rr.id = $1
        `, [rows[0].id]);

        res.status(201).json({
            success: true,
            data: completeReservation.rows[0],
            message: 'Resource reservation created successfully'
        });

    } catch (err) {
        console.error('Error creating resource reservation:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/resources/reservations - Get resource reservations
router.get('/reservations', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'fecha_reserva',
            sortOrder = 'ASC',
            recurso_id,
            fecha_inicio,
            fecha_fin,
            estado,
            reservado_por
        } = req.query;

        // Build base query
        let baseQuery = `
            SELECT 
                rr.id,
                rr.fecha_reserva,
                rr.hora_inicio,
                rr.hora_fin,
                rr.duracion_horas,
                rr.proposito,
                rr.descripcion,
                rr.estado,
                rr.requiere_preparacion,
                rr.notas_especiales,
                rr.contacto_responsable,
                rr.telefono_contacto,
                rr.fecha_creacion,
                rm.nombre as nombre_recurso,
                rm.tipo_recurso,
                rm.ubicacion,
                CONCAT(u.nombres, ' ', u.apellidos) as reservado_por_nombre,
                c.numero_cita,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente
            FROM RESERVAS_RECURSOS rr
            JOIN RECURSOS_MEDICOS rm ON rr.recurso_id = rm.id
            LEFT JOIN USUARIOS u ON rr.reservado_por = u.id
            LEFT JOIN CITAS c ON rr.cita_id = c.id
            LEFT JOIN PACIENTES p ON c.id_paciente = p.id
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Search filter (resource name, purpose, contact)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                rm.nombre ILIKE $${paramIndex} OR 
                rr.proposito ILIKE $${paramIndex + 1} OR 
                rr.contacto_responsable ILIKE $${paramIndex + 2}
            )`;
            params.push(searchPattern, searchPattern, searchPattern);
            paramIndex += 3;
        }

        // Additional filters
        if (recurso_id) filters['rr.recurso_id'] = parseInt(recurso_id);
        if (estado) filters['rr.estado'] = estado;
        if (reservado_por) filters['rr.reservado_por'] = parseInt(reservado_por);

        // Date range filters
        if (fecha_inicio) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                `rr.fecha_reserva >= $${paramIndex}`;
            params.push(fecha_inicio);
            paramIndex++;
        }
        if (fecha_fin) {
            baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                `rr.fecha_reserva <= $${paramIndex}`;
            params.push(fecha_fin);
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
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_reservations`;
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
            message: `Found ${rows.length} resource reservations`
        });

    } catch (err) {
        console.error('Error getting resource reservations:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/resources/reservations/:id/status - Update reservation status
router.put('/reservations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado, notas } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid reservation ID provided'
        });
    }

    // Validate status
    const validStates = ['PENDIENTE', 'CONFIRMADA', 'EN_USO', 'COMPLETADA', 'CANCELADA'];
    if (!estado || !validStates.includes(estado)) {
        return res.status(400).json({
            success: false,
            error: 'Valid status is required (PENDIENTE, CONFIRMADA, EN_USO, COMPLETADA, CANCELADA)'
        });
    }

    try {
        const pool = getPool();

        // Check if reservation exists
        const existingReservation = await pool.query(
            'SELECT * FROM RESERVAS_RECURSOS WHERE id = $1',
            [id]
        );

        if (existingReservation.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Reservation not found'
            });
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Build update query based on status
        let updateQuery = `
            UPDATE RESERVAS_RECURSOS SET 
                estado = $1,
                notas_especiales = COALESCE($2, notas_especiales),
                fecha_modificacion = CURRENT_TIMESTAMP
        `;
        let updateValues = [estado, notas];
        let paramIndex = 3;

        // Add status-specific timestamps
        if (estado === 'CONFIRMADA') {
            updateQuery += `, fecha_confirmacion = CURRENT_TIMESTAMP`;
        } else if (estado === 'EN_USO') {
            updateQuery += `, fecha_inicio_uso = CURRENT_TIMESTAMP`;
        } else if (estado === 'COMPLETADA') {
            updateQuery += `, fecha_fin_uso = CURRENT_TIMESTAMP`;
        } else if (estado === 'CANCELADA') {
            updateQuery += `, fecha_cancelacion = CURRENT_TIMESTAMP`;
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        updateValues.push(id);

        const { rows, rowCount } = await pool.query(updateQuery, updateValues);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Reservation not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: `Reservation status updated to ${estado} successfully`
        });

    } catch (err) {
        console.error(`Error updating reservation status ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

/**
 * Helper function to check if a specific time slot is available
 */
function checkTimeSlotAvailability(startTime, durationHours, reservations, resource) {
    const endTime = calculateEndTime(startTime, durationHours * 60);

    // Add preparation and cleanup time if needed
    const prepTime = resource.tiempo_preparacion_minutos || 0;
    const cleanupTime = resource.tiempo_limpieza_minutos || 0;

    const adjustedStartTime = calculateEndTime(startTime, -prepTime);
    const adjustedEndTime = calculateEndTime(endTime, cleanupTime);

    // Check for conflicts with existing reservations
    return !reservations.some(reservation => {
        const resStart = reservation.hora_inicio;
        const resEnd = reservation.hora_fin;

        return (
            (adjustedStartTime >= resStart && adjustedStartTime < resEnd) ||
            (adjustedEndTime > resStart && adjustedEndTime <= resEnd) ||
            (adjustedStartTime <= resStart && adjustedEndTime >= resEnd)
        );
    });
}

/**
 * Helper function to generate available time slots
 */
function generateAvailableSlots(startTime, endTime, durationHours, reservations, resource, fecha) {
    const slots = [];
    const slotDurationMinutes = durationHours * 60;

    // Convert time strings to minutes since midnight
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    // Generate slots every 30 minutes
    let currentTime = startMinutes;

    while (currentTime + slotDurationMinutes <= endMinutes) {
        const slotStartTime = minutesToTime(currentTime);
        const slotEndTime = minutesToTime(currentTime + slotDurationMinutes);

        // Check if this slot is available
        if (checkTimeSlotAvailability(slotStartTime, durationHours, reservations, resource)) {
            const slotDateTime = new Date(fecha + 'T' + slotStartTime);

            // Only include future slots
            if (slotDateTime > new Date()) {
                slots.push({
                    hora_inicio: slotStartTime,
                    hora_fin: slotEndTime,
                    duracion_horas: durationHours,
                    fecha_hora_inicio: slotDateTime.toISOString(),
                    available: true
                });
            }
        }

        // Move to next 30-minute interval
        currentTime += 30;
    }

    return slots;
}

/**
 * Helper function to calculate end time
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
 * Helper function to calculate total duration including prep and cleanup
 */
function calculateTotalDuration(baseDurationHours, prepMinutes, cleanupMinutes, requiresPrep) {
    let totalMinutes = baseDurationHours * 60;

    if (requiresPrep) {
        totalMinutes += prepMinutes + cleanupMinutes;
    }

    return totalMinutes / 60; // Convert back to hours
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

module.exports = router;