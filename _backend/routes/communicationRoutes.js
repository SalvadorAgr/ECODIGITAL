const express = require('express');
const { getPool } = require('../db');
const CommunicationService = require('../services/communicationService');
const DeliveryTrackingService = require('../services/deliveryTrackingService');

const router = express.Router();
const communicationService = new CommunicationService();
const deliveryTrackingService = new DeliveryTrackingService();

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

// GET /api/v1/communications - Get communication history with filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            appointment_id,
            patient_id,
            type,
            method,
            status,
            start_date,
            end_date
        } = req.query;

        const pool = getPool();

        // Build base query
        let baseQuery = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                cit.numero_cita,
                cit.fecha_hora as fecha_cita
            FROM COMUNICACIONES c
            LEFT JOIN CITAS cit ON c.id_cita = cit.id
            LEFT JOIN PACIENTES p ON cit.id_paciente = p.id
        `;

        // Build filters
        const filters = [];
        const params = [];
        let paramIndex = 1;

        if (appointment_id) {
            filters.push(`c.id_cita = $${paramIndex++}`);
            params.push(appointment_id);
        }

        if (patient_id) {
            filters.push(`cit.id_paciente = $${paramIndex++}`);
            params.push(patient_id);
        }

        if (type) {
            filters.push(`c.tipo = $${paramIndex++}`);
            params.push(type);
        }

        if (method) {
            filters.push(`c.metodo = $${paramIndex++}`);
            params.push(method);
        }

        if (status) {
            filters.push(`c.estado = $${paramIndex++}`);
            params.push(status);
        }

        if (start_date) {
            filters.push(`c.fecha_envio >= $${paramIndex++}`);
            params.push(start_date);
        }

        if (end_date) {
            filters.push(`c.fecha_envio <= $${paramIndex++}`);
            params.push(end_date + ' 23:59:59');
        }

        // Apply filters
        if (filters.length > 0) {
            baseQuery += ` WHERE ${filters.join(' AND ')}`;
        }

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_communications`;
        const { rows: countRows } = await pool.query(countQuery, params);
        const total = parseInt(countRows[0].total);

        // Add sorting and pagination
        baseQuery += ` ORDER BY c.fecha_envio DESC`;
        baseQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        // Execute main query
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
            message: `Found ${rows.length} communications`
        });

    } catch (err) {
        console.error('Error getting communications:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/:id - Get specific communication by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Communication ID is required'
        });
    }

    try {
        const pool = getPool();

        const query = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                cit.numero_cita,
                cit.fecha_hora as fecha_cita
            FROM COMUNICACIONES c
            LEFT JOIN CITAS cit ON c.id_cita = cit.id
            LEFT JOIN PACIENTES p ON cit.id_paciente = p.id
            WHERE c.id_comunicacion = $1
        `;

        const { rows, rowCount } = await pool.query(query, [id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Communication not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Communication retrieved successfully'
        });

    } catch (err) {
        console.error(`Error getting communication ${id}:`, err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/send-reminder - Send appointment reminder
router.post('/send-reminder', async (req, res) => {
    const { appointment_id, reminder_type = '24h' } = req.body;

    if (!appointment_id) {
        return res.status(400).json({
            success: false,
            error: 'Appointment ID is required'
        });
    }

    try {
        const pool = getPool();

        // Get appointment details
        const appointmentQuery = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.email,
                p.telefono,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1 AND c.activo = TRUE
        `;

        const { rows: appointmentRows, rowCount } = await pool.query(appointmentQuery, [appointment_id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found or inactive'
            });
        }

        const appointment = appointmentRows[0];

        // Send reminder using communication service
        const result = await communicationService.sendReminder(appointment, reminder_type);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                skipped: result.skipped
            });
        }

    } catch (err) {
        console.error('Error sending reminder:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/send-confirmation - Send appointment confirmation request
router.post('/send-confirmation', async (req, res) => {
    const { appointment_id } = req.body;

    if (!appointment_id) {
        return res.status(400).json({
            success: false,
            error: 'Appointment ID is required'
        });
    }

    try {
        const pool = getPool();

        // Get appointment details
        const appointmentQuery = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.email,
                p.telefono,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1 AND c.activo = TRUE
        `;

        const { rows: appointmentRows, rowCount } = await pool.query(appointmentQuery, [appointment_id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found or inactive'
            });
        }

        const appointment = appointmentRows[0];

        // Send confirmation request using communication service
        const result = await communicationService.sendConfirmationRequest(appointment);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                skipped: result.skipped
            });
        }

    } catch (err) {
        console.error('Error sending confirmation:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/send-cancellation - Send cancellation notification
router.post('/send-cancellation', async (req, res) => {
    const { appointment_id, reason } = req.body;

    if (!appointment_id) {
        return res.status(400).json({
            success: false,
            error: 'Appointment ID is required'
        });
    }

    try {
        const pool = getPool();

        // Get appointment details
        const appointmentQuery = `
            SELECT 
                c.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.email,
                p.telefono,
                CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
            FROM CITAS c
            JOIN PACIENTES p ON c.id_paciente = p.id
            JOIN USUARIOS u ON c.medico_id = u.id
            WHERE c.id = $1
        `;

        const { rows: appointmentRows, rowCount } = await pool.query(appointmentQuery, [appointment_id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const appointment = appointmentRows[0];

        // Send cancellation notification using communication service
        const result = await communicationService.sendCancellationNotification(appointment, reason);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error sending cancellation notification:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/send-waitlist-notification - Send waitlist notification
router.post('/send-waitlist-notification', async (req, res) => {
    const { waitlist_entry_id, available_slot } = req.body;

    if (!waitlist_entry_id || !available_slot) {
        return res.status(400).json({
            success: false,
            error: 'Waitlist entry ID and available slot are required'
        });
    }

    try {
        const pool = getPool();

        // Get waitlist entry details
        const waitlistQuery = `
            SELECT 
                le.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
                p.email,
                p.telefono
            FROM LISTA_ESPERA le
            JOIN PACIENTES p ON le.id_paciente = p.id
            WHERE le.id_entrada = $1 AND le.estado = 'ACTIVA'
        `;

        const { rows: waitlistRows, rowCount } = await pool.query(waitlistQuery, [waitlist_entry_id]);

        if (rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found or inactive'
            });
        }

        const waitlistEntry = waitlistRows[0];

        // Send waitlist notification using communication service
        const result = await communicationService.sendWaitlistNotification(waitlistEntry, available_slot);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                skipped: result.skipped
            });
        }

    } catch (err) {
        console.error('Error sending waitlist notification:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/process-response - Process patient response
router.post('/process-response', async (req, res) => {
    const { communication_id, response_type, response_content } = req.body;

    if (!communication_id || !response_type) {
        return res.status(400).json({
            success: false,
            error: 'Communication ID and response type are required'
        });
    }

    try {
        const response = {
            communicationId: communication_id,
            responseType: response_type,
            responseContent: response_content
        };

        // Process response using communication service
        const result = await communicationService.processPatientResponse(response);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error processing patient response:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/stats - Get communication statistics
router.get('/stats', async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            type,
            method,
            status
        } = req.query;

        const filters = {
            startDate: start_date,
            endDate: end_date,
            type,
            method,
            status
        };

        // Get statistics using communication service
        const stats = await communicationService.getCommunicationStats(filters);

        res.status(200).json({
            success: true,
            data: stats,
            message: 'Communication statistics retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting communication stats:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/templates - Get communication templates
router.get('/templates', async (req, res) => {
    try {
        const { type, method, language = 'es' } = req.query;

        const pool = getPool();

        let query = `
            SELECT * FROM PLANTILLAS_COMUNICACION
            WHERE activa = TRUE
        `;

        const params = [];
        let paramIndex = 1;

        if (type) {
            query += ` AND tipo = $${paramIndex++}`;
            params.push(type);
        }

        if (method) {
            query += ` AND metodo = $${paramIndex++}`;
            params.push(method);
        }

        if (language) {
            query += ` AND idioma = $${paramIndex++}`;
            params.push(language);
        }

        query += ` ORDER BY tipo, metodo, por_defecto DESC`;

        const { rows } = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: rows,
            message: 'Communication templates retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting communication templates:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/preferences/:patient_id - Get patient communication preferences
router.get('/preferences/:patient_id', async (req, res) => {
    const { patient_id } = req.params;

    if (!patient_id) {
        return res.status(400).json({
            success: false,
            error: 'Patient ID is required'
        });
    }

    try {
        const preferences = await communicationService.getPatientPreferences(patient_id);

        res.status(200).json({
            success: true,
            data: preferences,
            message: 'Patient communication preferences retrieved successfully'
        });

    } catch (err) {
        console.error('Error getting patient preferences:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/communications/preferences/:patient_id - Update patient communication preferences
router.put('/preferences/:patient_id', async (req, res) => {
    const { patient_id } = req.params;
    const {
        metodo_preferido,
        recordatorios_habilitados,
        confirmaciones_habilitadas,
        notificaciones_lista_espera,
        idioma,
        zona_horaria,
        horario_no_molestar_inicio,
        horario_no_molestar_fin,
        dias_no_molestar
    } = req.body;

    if (!patient_id) {
        return res.status(400).json({
            success: false,
            error: 'Patient ID is required'
        });
    }

    try {
        const pool = getPool();

        // Check if patient exists
        const patientCheck = await pool.query(
            'SELECT id FROM PACIENTES WHERE id = $1 AND activo = TRUE',
            [patient_id]
        );

        if (patientCheck.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found or inactive'
            });
        }

        // Upsert preferences
        const upsertQuery = `
            INSERT INTO PREFERENCIAS_COMUNICACION (
                id_paciente, metodo_preferido, recordatorios_habilitados,
                confirmaciones_habilitadas, notificaciones_lista_espera,
                idioma, zona_horaria, horario_no_molestar_inicio,
                horario_no_molestar_fin, dias_no_molestar
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id_paciente) 
            DO UPDATE SET
                metodo_preferido = EXCLUDED.metodo_preferido,
                recordatorios_habilitados = EXCLUDED.recordatorios_habilitados,
                confirmaciones_habilitadas = EXCLUDED.confirmaciones_habilitadas,
                notificaciones_lista_espera = EXCLUDED.notificaciones_lista_espera,
                idioma = EXCLUDED.idioma,
                zona_horaria = EXCLUDED.zona_horaria,
                horario_no_molestar_inicio = EXCLUDED.horario_no_molestar_inicio,
                horario_no_molestar_fin = EXCLUDED.horario_no_molestar_fin,
                dias_no_molestar = EXCLUDED.dias_no_molestar,
                actualizado_en = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const { rows } = await pool.query(upsertQuery, [
            patient_id,
            metodo_preferido || 'email',
            recordatorios_habilitados !== false,
            confirmaciones_habilitadas !== false,
            notificaciones_lista_espera !== false,
            idioma || 'es',
            zona_horaria || 'America/Mexico_City',
            horario_no_molestar_inicio,
            horario_no_molestar_fin,
            dias_no_molestar
        ]);

        res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Patient communication preferences updated successfully'
        });

    } catch (err) {
        console.error('Error updating patient preferences:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;

// POST /api/v1/communications/webhook/:provider - Handle delivery webhooks from external providers
router.post('/webhook/:provider', async (req, res) => {
    const { provider } = req.params;
    const webhookData = req.body;

    try {
        // Process delivery webhook
        const result = await deliveryTrackingService.processDeliveryWebhook(provider, webhookData);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    provider: result.provider,
                    communicationId: result.communicationId,
                    status: result.status
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error processing delivery webhook:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT /api/v1/communications/:id/delivery-status - Update delivery status manually
router.put('/:id/delivery-status', async (req, res) => {
    const { id } = req.params;
    const { status, metadata } = req.body;

    if (!id || !status) {
        return res.status(400).json({
            success: false,
            error: 'Communication ID and status are required'
        });
    }

    try {
        const result = await deliveryTrackingService.updateDeliveryStatus(id, status, metadata);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error updating delivery status:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/:id/delivery-history - Get delivery history for a communication
router.get('/:id/delivery-history', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Communication ID is required'
        });
    }

    try {
        const result = await deliveryTrackingService.getDeliveryHistory(id);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error getting delivery history:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/delivery-stats - Get delivery statistics
router.get('/delivery-stats', async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            method,
            type
        } = req.query;

        const filters = {
            startDate: start_date,
            endDate: end_date,
            method,
            type
        };

        const result = await deliveryTrackingService.getDeliveryStats(filters);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error getting delivery stats:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/retry-failed - Retry failed communications
router.post('/retry-failed', async (req, res) => {
    try {
        const {
            max_age = 24,
            max_attempts = 3,
            method,
            type
        } = req.body;

        const filters = {
            maxAge: max_age,
            maxAttempts: max_attempts,
            method,
            type
        };

        const result = await deliveryTrackingService.retryFailedCommunications(filters);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message,
                retried: result.retried
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error retrying failed communications:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// POST /api/v1/communications/:id/confirm-delivery - Handle delivery confirmation from patient
router.post('/:id/confirm-delivery', async (req, res) => {
    const { id } = req.params;
    const { confirmation_type, metadata } = req.body;

    if (!id || !confirmation_type) {
        return res.status(400).json({
            success: false,
            error: 'Communication ID and confirmation type are required'
        });
    }

    try {
        const result = await deliveryTrackingService.handleDeliveryConfirmation(id, confirmation_type, metadata);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error handling delivery confirmation:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET /api/v1/communications/preferences/:patient_id/management - Get patient preferences management data
router.get('/preferences/:patient_id/management', async (req, res) => {
    const { patient_id } = req.params;

    if (!patient_id) {
        return res.status(400).json({
            success: false,
            error: 'Patient ID is required'
        });
    }

    try {
        const result = await deliveryTrackingService.getPatientPreferencesManagement(patient_id);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.message
            });
        }

    } catch (err) {
        console.error('Error getting patient preferences management:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});