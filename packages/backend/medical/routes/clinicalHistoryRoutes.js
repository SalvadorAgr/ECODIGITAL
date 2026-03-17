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

// GET /api/v1/clinical-history - Get clinical history records with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const pool = getPool();

        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'fecha_hora',
            sortOrder = 'DESC',
            paciente_id,
            medico_id,
            tipo_consulta,
            estado_consulta,
            fecha_desde,
            fecha_hasta,
            urgente,
            requiere_seguimiento
        } = req.query;

        // Build base query with joins
        let baseQuery = `
            SELECT 
                h.id,
                h.id_paciente,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.numero_expediente,
                h.fecha_hora,
                h.tipo_consulta,
                h.motivo_consulta,
                h.diagnostico_principal,
                h.diagnosticos_secundarios,
                h.codigo_cie10,
                h.medico_id,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                h.estado_consulta,
                h.requiere_seguimiento,
                h.urgente,
                h.proxima_cita,
                h.peso,
                h.altura,
                h.imc,
                h.signos_vitales,
                h.plan_tratamiento,
                h.recomendaciones,
                h.observaciones,
                h.fecha_creacion,
                h.fecha_modificacion
            FROM HISTORIAL_CLINICO h
            JOIN PACIENTES p ON h.id_paciente = p.id
            LEFT JOIN USUARIOS u ON h.medico_id = u.id
            WHERE h.activo = TRUE AND p.activo = TRUE
        `;

        const params = [];
        let paramIndex = 1;

        // Search filter (patient name, diagnosis, motivo)
        if (search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            baseQuery += ` AND (
                CONCAT(p.nombre, ' ', p.apellido) ILIKE $${paramIndex} OR 
                h.diagnostico_principal ILIKE $${paramIndex + 1} OR 
                h.motivo_consulta ILIKE $${paramIndex + 2} OR
                p.numero_expediente ILIKE $${paramIndex + 3}
            )`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            paramIndex += 4;
        }

        // Specific filters
        if (paciente_id) {
            baseQuery += ` AND h.id_paciente = $${paramIndex}`;
            params.push(parseInt(paciente_id));
            paramIndex++;
        }

        if (medico_id) {
            baseQuery += ` AND h.medico_id = $${paramIndex}`;
            params.push(parseInt(medico_id));
            paramIndex++;
        }

        if (tipo_consulta) {
            baseQuery += ` AND h.tipo_consulta = $${paramIndex}`;
            params.push(tipo_consulta);
            paramIndex++;
        }

        if (estado_consulta) {
            baseQuery += ` AND h.estado_consulta = $${paramIndex}`;
            params.push(estado_consulta);
            paramIndex++;
        }

        if (urgente !== undefined) {
            baseQuery += ` AND h.urgente = $${paramIndex}`;
            params.push(urgente === 'true');
            paramIndex++;
        }

        if (requiere_seguimiento !== undefined) {
            baseQuery += ` AND h.requiere_seguimiento = $${paramIndex}`;
            params.push(requiere_seguimiento === 'true');
            paramIndex++;
        }

        // Date range filters
        if (fecha_desde) {
            baseQuery += ` AND h.fecha_hora >= $${paramIndex}`;
            params.push(fecha_desde);
            paramIndex++;
        }

        if (fecha_hasta) {
            baseQuery += ` AND h.fecha_hora <= $${paramIndex}`;
            params.push(fecha_hasta);
            paramIndex++;
        }

        // Count total records for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_history`;
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
            message: `Found ${rows.length} clinical history records`
        });

    } catch (err) {
        console.error('Error getting clinical history:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/clinical-history/:id - Get specific clinical history record by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid clinical history ID provided'
        });
    }

    try {
        const pool = getPool();

        const query = `
            SELECT 
                h.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.numero_expediente,
                p.fecha_nacimiento,
                EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad_paciente,
                p.genero,
                p.tipo_sangre,
                p.alergias as alergias_paciente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                u.email as email_medico
            FROM HISTORIAL_CLINICO h
            JOIN PACIENTES p ON h.id_paciente = p.id
            LEFT JOIN USUARIOS u ON h.medico_id = u.id
            WHERE h.id = $1 AND h.activo = TRUE
        `;

        const { rows, rowCount } = await pool.query(query, [id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Clinical history record not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Clinical history record retrieved successfully'
        });

    } catch (err) {
        console.error(`Error getting clinical history ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/clinical-history/patient/:patientId - Get chronological history for a specific patient
router.get('/patient/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const {
        page = 1,
        limit = 10,
        includeInactive = false,
        sortOrder = 'DESC'
    } = req.query;

    // Validate patient ID parameter
    if (!patientId || isNaN(parseInt(patientId))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid patient ID provided'
        });
    }

    try {
        const pool = getPool();

        // First verify patient exists
        const patientCheck = await pool.query(
            'SELECT id, nombre, apellido, activo FROM PACIENTES WHERE id = $1',
            [patientId]
        );

        if (patientCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        const patient = patientCheck.rows[0];

        // Build query for patient's clinical history
        let historyQuery = `
            SELECT 
                h.id,
                h.fecha_hora,
                h.tipo_consulta,
                h.motivo_consulta,
                h.diagnostico_principal,
                h.diagnosticos_secundarios,
                h.codigo_cie10,
                h.peso,
                h.altura,
                h.imc,
                h.signos_vitales,
                h.plan_tratamiento,
                h.medicamentos_prescritos,
                h.examenes_solicitados,
                h.recomendaciones,
                h.proxima_cita,
                h.estado_consulta,
                h.requiere_seguimiento,
                h.urgente,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
                u.especialidad,
                h.fecha_creacion
            FROM HISTORIAL_CLINICO h
            LEFT JOIN USUARIOS u ON h.medico_id = u.id
            WHERE h.id_paciente = $1
        `;

        const params = [patientId];
        let paramIndex = 2;

        // Filter by active status unless includeInactive is true
        if (includeInactive !== 'true') {
            historyQuery += ` AND h.activo = TRUE`;
        }

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM (${historyQuery}) as patient_history`;
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].total);

        // Add sorting (chronological order)
        const orderClause = utils.buildOrderClause('fecha_hora', sortOrder);
        historyQuery += ` ${orderClause}`;

        // Add pagination
        const { clause: paginationClause, params: paginationParams } = utils.buildPaginationClause(
            parseInt(page),
            parseInt(limit),
            paramIndex
        );
        historyQuery += ` ${paginationClause}`;
        params.push(...paginationParams);

        // Execute query
        const { rows } = await pool.query(historyQuery, params);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        res.status(200).json({
            success: true,
            data: {
                patient: {
                    id: patient.id,
                    name: `${patient.nombre} ${patient.apellido}`,
                    active: patient.activo
                },
                history: rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    hasNextPage,
                    hasPrevPage
                }
            },
            message: `Found ${rows.length} clinical history records for patient`
        });

    } catch (err) {
        console.error(`Error getting patient clinical history ${patientId}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});
// POST /api/v1/clinical-history - Create new clinical history record
router.post('/', async (req, res) => {
    const {
        id_paciente,
        tipo_consulta,
        motivo_consulta,
        signos_vitales,
        peso,
        altura,
        sintomas,
        examen_fisico,
        diagnostico_principal,
        diagnosticos_secundarios,
        codigo_cie10,
        plan_tratamiento,
        medicamentos_prescritos,
        examenes_solicitados,
        procedimientos_realizados,
        recomendaciones,
        proxima_cita,
        observaciones,
        medico_id,
        especialidad_consulta,
        imagenes_adjuntas,
        documentos_adjuntos,
        estado_consulta = 'COMPLETADA',
        requiere_seguimiento = false,
        urgente = false
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (!id_paciente || isNaN(parseInt(id_paciente))) {
        errors.push('Valid patient ID is required');
    }
    if (!tipo_consulta || !['PRIMERA_VEZ', 'SEGUIMIENTO', 'URGENCIA', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO'].includes(tipo_consulta)) {
        errors.push('Valid consultation type is required');
    }
    if (!motivo_consulta || motivo_consulta.trim().length < 5) {
        errors.push('Consultation reason is required and must be at least 5 characters');
    }
    if (!diagnostico_principal || diagnostico_principal.trim().length < 5) {
        errors.push('Primary diagnosis is required and must be at least 5 characters');
    }
    if (!medico_id || isNaN(parseInt(medico_id))) {
        errors.push('Valid doctor ID is required');
    }
    if (peso && (peso < 0 || peso > 1000)) {
        errors.push('Weight must be between 0 and 1000 kg');
    }
    if (altura && (altura < 0 || altura > 300)) {
        errors.push('Height must be between 0 and 300 cm');
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

        // Verify patient exists and is active
        const patientCheck = await pool.query(
            'SELECT id, activo FROM PACIENTES WHERE id = $1',
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
                error: 'Cannot create clinical history for inactive patient'
            });
        }

        // Verify doctor exists
        const doctorCheck = await pool.query(
            'SELECT id FROM USUARIOS WHERE id = $1 AND activo = TRUE',
            [medico_id]
        );

        if (doctorCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor not found or inactive'
            });
        }

        // Get user ID from auth middleware (if available)
        const creado_por = req.user?.id || medico_id;

        const query = `
            INSERT INTO HISTORIAL_CLINICO (
                id_paciente, tipo_consulta, motivo_consulta,
                signos_vitales, peso, altura,
                sintomas, examen_fisico, diagnostico_principal, diagnosticos_secundarios, codigo_cie10,
                plan_tratamiento, medicamentos_prescritos, examenes_solicitados, procedimientos_realizados,
                recomendaciones, proxima_cita, observaciones,
                medico_id, especialidad_consulta,
                imagenes_adjuntas, documentos_adjuntos,
                estado_consulta, requiere_seguimiento, urgente,
                creado_por
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
            ) RETURNING *
        `;

        const values = [
            id_paciente, tipo_consulta, motivo_consulta.trim(),
            signos_vitales ? JSON.stringify(signos_vitales) : null, peso, altura,
            sintomas, examen_fisico, diagnostico_principal.trim(), diagnosticos_secundarios, codigo_cie10,
            plan_tratamiento, medicamentos_prescritos ? JSON.stringify(medicamentos_prescritos) : null,
            examenes_solicitados, procedimientos_realizados,
            recomendaciones, proxima_cita, observaciones,
            medico_id, especialidad_consulta,
            imagenes_adjuntas ? JSON.stringify(imagenes_adjuntas) : null,
            documentos_adjuntos ? JSON.stringify(documentos_adjuntos) : null,
            estado_consulta, requiere_seguimiento, urgente,
            creado_por
        ];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            success: true,
            data: rows[0],
            message: 'Clinical history record created successfully'
        });

    } catch (err) {
        console.error('Error creating clinical history:', err.stack);

        // Handle foreign key constraint violations
        if (err.code === '23503') {
            if (err.constraint?.includes('paciente')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid patient ID'
                });
            }
            if (err.constraint?.includes('medico')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid doctor ID'
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

// PUT /api/v1/clinical-history/:id - Update existing clinical history record
router.put('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid clinical history ID provided'
        });
    }

    const {
        tipo_consulta,
        motivo_consulta,
        signos_vitales,
        peso,
        altura,
        sintomas,
        examen_fisico,
        diagnostico_principal,
        diagnosticos_secundarios,
        codigo_cie10,
        plan_tratamiento,
        medicamentos_prescritos,
        examenes_solicitados,
        procedimientos_realizados,
        recomendaciones,
        proxima_cita,
        observaciones,
        especialidad_consulta,
        imagenes_adjuntas,
        documentos_adjuntos,
        estado_consulta,
        requiere_seguimiento,
        urgente
    } = req.body;

    // Enhanced validation
    const errors = [];
    if (tipo_consulta && !['PRIMERA_VEZ', 'SEGUIMIENTO', 'URGENCIA', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO'].includes(tipo_consulta)) {
        errors.push('Invalid consultation type');
    }
    if (motivo_consulta && motivo_consulta.trim().length < 5) {
        errors.push('Consultation reason must be at least 5 characters');
    }
    if (diagnostico_principal && diagnostico_principal.trim().length < 5) {
        errors.push('Primary diagnosis must be at least 5 characters');
    }
    if (peso && (peso < 0 || peso > 1000)) {
        errors.push('Weight must be between 0 and 1000 kg');
    }
    if (altura && (altura < 0 || altura > 300)) {
        errors.push('Height must be between 0 and 300 cm');
    }
    if (estado_consulta && !['PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'].includes(estado_consulta)) {
        errors.push('Invalid consultation status');
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

        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (tipo_consulta !== undefined) {
            updateFields.push(`tipo_consulta = $${paramIndex++}`);
            values.push(tipo_consulta);
        }
        if (motivo_consulta !== undefined) {
            updateFields.push(`motivo_consulta = $${paramIndex++}`);
            values.push(motivo_consulta.trim());
        }
        if (signos_vitales !== undefined) {
            updateFields.push(`signos_vitales = $${paramIndex++}`);
            values.push(signos_vitales ? JSON.stringify(signos_vitales) : null);
        }
        if (peso !== undefined) {
            updateFields.push(`peso = $${paramIndex++}`);
            values.push(peso);
        }
        if (altura !== undefined) {
            updateFields.push(`altura = $${paramIndex++}`);
            values.push(altura);
        }
        if (sintomas !== undefined) {
            updateFields.push(`sintomas = $${paramIndex++}`);
            values.push(sintomas);
        }
        if (examen_fisico !== undefined) {
            updateFields.push(`examen_fisico = $${paramIndex++}`);
            values.push(examen_fisico);
        }
        if (diagnostico_principal !== undefined) {
            updateFields.push(`diagnostico_principal = $${paramIndex++}`);
            values.push(diagnostico_principal.trim());
        }
        if (diagnosticos_secundarios !== undefined) {
            updateFields.push(`diagnosticos_secundarios = $${paramIndex++}`);
            values.push(diagnosticos_secundarios);
        }
        if (codigo_cie10 !== undefined) {
            updateFields.push(`codigo_cie10 = $${paramIndex++}`);
            values.push(codigo_cie10);
        }
        if (plan_tratamiento !== undefined) {
            updateFields.push(`plan_tratamiento = $${paramIndex++}`);
            values.push(plan_tratamiento);
        }
        if (medicamentos_prescritos !== undefined) {
            updateFields.push(`medicamentos_prescritos = $${paramIndex++}`);
            values.push(medicamentos_prescritos ? JSON.stringify(medicamentos_prescritos) : null);
        }
        if (examenes_solicitados !== undefined) {
            updateFields.push(`examenes_solicitados = $${paramIndex++}`);
            values.push(examenes_solicitados);
        }
        if (procedimientos_realizados !== undefined) {
            updateFields.push(`procedimientos_realizados = $${paramIndex++}`);
            values.push(procedimientos_realizados);
        }
        if (recomendaciones !== undefined) {
            updateFields.push(`recomendaciones = $${paramIndex++}`);
            values.push(recomendaciones);
        }
        if (proxima_cita !== undefined) {
            updateFields.push(`proxima_cita = $${paramIndex++}`);
            values.push(proxima_cita);
        }
        if (observaciones !== undefined) {
            updateFields.push(`observaciones = $${paramIndex++}`);
            values.push(observaciones);
        }
        if (especialidad_consulta !== undefined) {
            updateFields.push(`especialidad_consulta = $${paramIndex++}`);
            values.push(especialidad_consulta);
        }
        if (imagenes_adjuntas !== undefined) {
            updateFields.push(`imagenes_adjuntas = $${paramIndex++}`);
            values.push(imagenes_adjuntas ? JSON.stringify(imagenes_adjuntas) : null);
        }
        if (documentos_adjuntos !== undefined) {
            updateFields.push(`documentos_adjuntos = $${paramIndex++}`);
            values.push(documentos_adjuntos ? JSON.stringify(documentos_adjuntos) : null);
        }
        if (estado_consulta !== undefined) {
            updateFields.push(`estado_consulta = $${paramIndex++}`);
            values.push(estado_consulta);
        }
        if (requiere_seguimiento !== undefined) {
            updateFields.push(`requiere_seguimiento = $${paramIndex++}`);
            values.push(requiere_seguimiento);
        }
        if (urgente !== undefined) {
            updateFields.push(`urgente = $${paramIndex++}`);
            values.push(urgente);
        }

        // Always update modification fields
        updateFields.push(`modificado_por = $${paramIndex++}`);
        values.push(modificado_por);
        updateFields.push(`fecha_modificacion = CURRENT_TIMESTAMP`);

        if (updateFields.length === 2) { // Only modification fields
            return res.status(400).json({
                success: false,
                error: 'No fields to update provided'
            });
        }

        const query = `
            UPDATE HISTORIAL_CLINICO 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex} AND activo = TRUE 
            RETURNING *
        `;
        values.push(id);

        const { rows, rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Clinical history record not found or inactive'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Clinical history record updated successfully'
        });

    } catch (err) {
        console.error(`Error updating clinical history ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// DELETE /api/v1/clinical-history/:id - Soft delete clinical history record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { confirm = false } = req.body;

    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid clinical history ID provided'
        });
    }

    try {
        const pool = getPool();

        // First check if record exists and get basic info
        const checkQuery = `
            SELECT 
                h.id, 
                h.fecha_hora,
                h.diagnostico_principal,
                h.activo,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente
            FROM HISTORIAL_CLINICO h
            JOIN PACIENTES p ON h.id_paciente = p.id
            WHERE h.id = $1
        `;

        const { rows: checkRows, rowCount: checkCount } = await pool.query(checkQuery, [id]);

        if (checkCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Clinical history record not found'
            });
        }

        const record = checkRows[0];

        if (!record.activo) {
            return res.status(400).json({
                success: false,
                error: 'Clinical history record is already inactive'
            });
        }

        // Require confirmation for deletion
        if (!confirm) {
            return res.status(400).json({
                success: false,
                error: 'Confirmation required',
                message: `This will deactivate the clinical history record from ${record.fecha_hora} for patient ${record.nombre_paciente}. The record will be preserved for audit purposes.`,
                requiresConfirmation: true,
                recordInfo: {
                    id: record.id,
                    patient: record.nombre_paciente,
                    date: record.fecha_hora,
                    diagnosis: record.diagnostico_principal
                }
            });
        }

        // Get user ID from auth middleware (if available)
        const modificado_por = req.user?.id || null;

        // Perform soft delete
        const deleteQuery = `
            UPDATE HISTORIAL_CLINICO 
            SET 
                activo = FALSE,
                modificado_por = $1,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = $2 AND activo = TRUE
            RETURNING id, fecha_hora, diagnostico_principal
        `;

        const { rows: deleteRows, rowCount: deleteCount } = await pool.query(deleteQuery, [modificado_por, id]);

        if (deleteCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Clinical history record not found or already inactive'
            });
        }

        const deletedRecord = deleteRows[0];

        res.status(200).json({
            success: true,
            message: `Clinical history record from ${deletedRecord.fecha_hora} has been deactivated successfully`,
            data: {
                id: deletedRecord.id,
                date: deletedRecord.fecha_hora,
                diagnosis: deletedRecord.diagnostico_principal,
                status: 'deactivated'
            }
        });

    } catch (err) {
        console.error(`Error deactivating clinical history ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;