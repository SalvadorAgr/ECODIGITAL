const express = require('express');
const { getPool, utils } = require('../db'); // Import database connection and utilities

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

// GET /api/v1/patients - Get list of patients with advanced search, filtering and pagination
router.get('/', async (req, res) => {
    try {
        console.time('GET /api/v1/patients');
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'apellido',
            sortOrder = 'ASC',
            genero,
            ciudad,
            activo = 'true',
            edad_min,
            edad_max,
            tipo_sangre,
            tiene_seguro
        } = req.query;

        // Build base query
        let baseQuery = `
            SELECT 
                id,
                nombre,
                apellido,
                cedula,
                fecha_nacimiento,
                EXTRACT(YEAR FROM AGE(fecha_nacimiento)) as edad,
                genero,
                telefono,
                email,
                ciudad,
                tipo_sangre,
                seguro_medico,
                numero_expediente,
                fecha_primera_consulta,
                fecha_ultima_consulta,
                activo,
                fecha_creacion
            FROM PACIENTES
        `;

        // Build filters
        const filters = {};
        const params = [];
        let paramIndex = 1;

        // Active status filter
        if (activo !== 'all') {
            filters.activo = activo === 'true';
        }

        // Search filter (name, lastname, cedula, expediente)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` WHERE (
                nombre ILIKE $${paramIndex} OR 
                apellido ILIKE $${paramIndex + 1} OR 
                cedula ILIKE $${paramIndex + 2} OR 
                numero_expediente ILIKE $${paramIndex + 3}
            )`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            paramIndex += 4;
        }

        // Additional filters
        if (genero) filters.genero = genero;
        if (ciudad) filters.ciudad = ciudad;
        if (tipo_sangre) filters.tipo_sangre = tipo_sangre;

        // Insurance filter
        if (tiene_seguro !== undefined) {
            if (tiene_seguro === 'true') {
                baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                    `seguro_medico IS NOT NULL AND seguro_medico != ''`;
            } else if (tiene_seguro === 'false') {
                baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                    `(seguro_medico IS NULL OR seguro_medico = '')`;
            }
        }

        // Age range filters
        if (edad_min || edad_max) {
            const ageConditions = [];
            if (edad_min) {
                ageConditions.push(`EXTRACT(YEAR FROM AGE(fecha_nacimiento)) >= $${paramIndex}`);
                params.push(parseInt(edad_min));
                paramIndex++;
            }
            if (edad_max) {
                ageConditions.push(`EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= $${paramIndex}`);
                params.push(parseInt(edad_max));
                paramIndex++;
            }
            if (ageConditions.length > 0) {
                baseQuery += (baseQuery.includes('WHERE') ? ' AND ' : ' WHERE ') +
                    `(${ageConditions.join(' AND ')})`;
            }
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
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_patients`;
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
        
        console.timeEnd('GET /api/v1/patients');

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
            message: `Found ${rows.length} patients`
        });

    } catch (err) {
        console.error('Error getting patients:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/patients/:id - Get specific patient by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid patient ID provided'
        });
    }

    try {
        const pool = getPool();

        // Get patient with additional computed fields
        const query = `
            SELECT 
                p.*,
                EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad,
                (SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = p.id AND h.activo = TRUE) as total_consultas,
                (SELECT MAX(h.fecha_hora) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = p.id AND h.activo = TRUE) as ultima_consulta_real
            FROM PACIENTES p 
            WHERE p.id = $1
        `;

        const { rows, rowCount } = await pool.query(query, [id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Patient retrieved successfully'
        });

    } catch (err) {
        console.error(`Error getting patient ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


// POST /api/v1/patients - Create new patient
router.post('/', async (req, res) => {
    const {
        nombre,
        apellido,
        cedula,
        fecha_nacimiento,
        genero,
        telefono,
        email,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        pais = 'República Dominicana',
        tipo_sangre,
        alergias,
        medicamentos_actuales,
        condiciones_medicas,
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        contacto_emergencia_relacion,
        seguro_medico,
        numero_poliza,
        notas_administrativas
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!nombre || nombre.trim().length < 2) {
        errors.push('Name is required and must be at least 2 characters');
    }
    if (!apellido || apellido.trim().length < 2) {
        errors.push('Last name is required and must be at least 2 characters');
    }
    if (!fecha_nacimiento) {
        errors.push('Birth date is required');
    }
    if (!genero || !['M', 'F', 'O'].includes(genero)) {
        errors.push('Gender is required and must be M, F, or O');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
    }
    if (tipo_sangre && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(tipo_sangre)) {
        errors.push('Invalid blood type');
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

        // Generate unique expediente number if not provided
        const numero_expediente = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Get user ID from auth middleware (if available)
        const creado_por = req.user?.id || null;

        const query = `
            INSERT INTO PACIENTES (
                nombre, apellido, cedula, fecha_nacimiento, genero,
                telefono, email, direccion, ciudad, provincia, codigo_postal, pais,
                tipo_sangre, alergias, medicamentos_actuales, condiciones_medicas,
                contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion,
                numero_expediente, seguro_medico, numero_poliza, notas_administrativas,
                creado_por
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
                $17, $18, $19, $20, $21, $22, $23, $24
            ) RETURNING *
        `;

        const values = [
            nombre.trim(), apellido.trim(), cedula, fecha_nacimiento, genero,
            telefono, email, direccion, ciudad, provincia, codigo_postal, pais,
            tipo_sangre, alergias, medicamentos_actuales, condiciones_medicas,
            contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion,
            numero_expediente, seguro_medico, numero_poliza, notas_administrativas,
            creado_por
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            data: rows[0],
            message: 'Patient created successfully'
        });

    } catch (err) {
        console.error('Error creating patient:', err.stack);

        // Handle unique constraint violations
        if (err.code === '23505') {
            if (err.constraint?.includes('cedula')) {
                return res.status(409).json({
                    success: false,
                    error: 'A patient with this ID number already exists'
                });
            }
            if (err.constraint?.includes('numero_expediente')) {
                return res.status(409).json({
                    success: false,
                    error: 'A patient with this file number already exists'
                });
            }
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/patients/:id - Update existing patient
router.put('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid patient ID provided'
        });
    }

    const {
        nombre,
        apellido,
        cedula,
        fecha_nacimiento,
        genero,
        telefono,
        email,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        pais,
        tipo_sangre,
        alergias,
        medicamentos_actuales,
        condiciones_medicas,
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        contacto_emergencia_relacion,
        seguro_medico,
        numero_poliza,
        notas_administrativas
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!nombre || nombre.trim().length < 2) {
        errors.push('Name is required and must be at least 2 characters');
    }
    if (!apellido || apellido.trim().length < 2) {
        errors.push('Last name is required and must be at least 2 characters');
    }
    if (!fecha_nacimiento) {
        errors.push('Birth date is required');
    }
    if (!genero || !['M', 'F', 'O'].includes(genero)) {
        errors.push('Gender is required and must be M, F, or O');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
    }
    if (tipo_sangre && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(tipo_sangre)) {
        errors.push('Invalid blood type');
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

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        const query = `
            UPDATE PACIENTES SET 
                nombre = $1, 
                apellido = $2, 
                cedula = $3,
                fecha_nacimiento = $4, 
                genero = $5,
                telefono = $6,
                email = $7,
                direccion = $8,
                ciudad = $9,
                provincia = $10,
                codigo_postal = $11,
                pais = $12,
                tipo_sangre = $13,
                alergias = $14,
                medicamentos_actuales = $15,
                condiciones_medicas = $16,
                contacto_emergencia_nombre = $17,
                contacto_emergencia_telefono = $18,
                contacto_emergencia_relacion = $19,
                seguro_medico = $20,
                numero_poliza = $21,
                notas_administrativas = $22,
                modificado_por = $23,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $24 AND activo = TRUE 
            RETURNING *
        `;

        const values = [
            nombre.trim(), apellido.trim(), cedula, fecha_nacimiento, genero,
            telefono, email, direccion, ciudad, provincia, codigo_postal, pais,
            tipo_sangre, alergias, medicamentos_actuales, condiciones_medicas,
            contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion,
            seguro_medico, numero_poliza, notas_administrativas,
            modificado_por, id
        ];

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found or inactive'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Patient updated successfully'
        });

    } catch (err) {
        console.error(`Error updating patient ${id}:`, err.stack);

        // Handle unique constraint violations
        if (err.code === '23505') {
            if (err.constraint?.includes('cedula')) {
                return res.status(409).json({
                    success: false,
                    error: 'A patient with this ID number already exists'
                });
            }
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// DELETE /api/v1/patients/:id - Soft delete patient with confirmation
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { confirm = false } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid patient ID provided'
        });
    }

    try {
        const pool = getPool();

        // First check if patient exists and get basic info
        const checkQuery = `
            SELECT 
                id, 
                nombre, 
                apellido, 
                activo,
                (SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = $1 AND h.activo = TRUE) as total_consultas
            FROM PACIENTES 
            WHERE id = $1
        `;

        const { rows: checkRows, rowCount: checkCount } = await pool.query(checkQuery, [id]);

        if (checkCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        const patient = checkRows[0];

        if (!patient.activo) {
            return res.status(400).json({
                success: false,
                error: 'Patient is already inactive'
            });
        }

        // If patient has clinical history, require confirmation
        if (patient.total_consultas > 0 && !confirm) {
            return res.status(400).json({
                success: false,
                error: 'Confirmation required',
                message: `Patient ${patient.nombre} ${patient.apellido} has ${patient.total_consultas} clinical records. This action will deactivate the patient but preserve all medical history.`,
                requiresConfirmation: true,
                patientInfo: {
                    id: patient.id,
                    name: `${patient.nombre} ${patient.apellido}`,
                    totalConsultas: patient.total_consultas
                }
            });
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Perform soft delete
        const deleteQuery = `
            UPDATE PACIENTES 
            SET 
                activo = FALSE,
                modificado_por = $1,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $2 AND activo = TRUE
            RETURNING id, nombre, apellido
        `;

        const { rows: deleteRows, rowCount: deleteCount } = await pool.query(deleteQuery, [modificado_por, id]);

        if (deleteCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found or already inactive'
            });
        }

        const deletedPatient = deleteRows[0];

        res.status(200).json({
            success: true,
            message: `Patient ${deletedPatient.nombre} ${deletedPatient.apellido} has been deactivated successfully`,
            data: {
                id: deletedPatient.id,
                name: `${deletedPatient.nombre} ${deletedPatient.apellido}`,
                status: 'deactivated',
                preservedRecords: patient.total_consultas
            }
        });

    } catch (err) {
        console.error(`Error deactivating patient ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;

