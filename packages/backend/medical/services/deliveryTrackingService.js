const { getPool } = require('../db');

/**
 * Delivery Tracking Service
 * Handles communication delivery status tracking and confirmation handling
 */
class DeliveryTrackingService {
    constructor() {
        this.pool = null;
    }

    /**
     * Initialize the service with database connection
     */
    initialize() {
        this.pool = getPool();
        if (!this.pool) {
            throw new Error('Database connection not available');
        }
    }

    /**
     * Update delivery status for a communication
     * @param {string} communicationId - Communication ID
     * @param {string} status - New delivery status
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Update result
     */
    async updateDeliveryStatus(communicationId, status, metadata = {}) {
        try {
            this.initialize();

            const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed', 'bounced'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
            }

            // Prepare update fields based on status
            const updateFields = ['estado = $2'];
            const params = [communicationId, status];
            let paramIndex = 3;

            // Set appropriate timestamp fields
            switch (status) {
                case 'sent':
                    if (!metadata.sent_at) {
                        updateFields.push('fecha_envio = CURRENT_TIMESTAMP');
                    } else {
                        updateFields.push(`fecha_envio = $${paramIndex++}`);
                        params.push(metadata.sent_at);
                    }
                    break;
                case 'delivered':
                    updateFields.push('fecha_entrega = CURRENT_TIMESTAMP');
                    break;
                case 'read':
                    updateFields.push('fecha_lectura = CURRENT_TIMESTAMP');
                    break;
                case 'failed':
                case 'bounced':
                    if (metadata.error_message) {
                        updateFields.push(`error_mensaje = $${paramIndex++}`);
                        params.push(metadata.error_message);
                    }
                    break;
            }

            // Update external ID if provided
            if (metadata.external_id) {
                updateFields.push(`id_externo = $${paramIndex++}`);
                params.push(metadata.external_id);
            }

            // Update metadata
            if (Object.keys(metadata).length > 0) {
                updateFields.push(`metadatos = COALESCE(metadatos, '{}')::jsonb || $${paramIndex++}::jsonb`);
                params.push(JSON.stringify(metadata));
            }

            // Always update last attempt timestamp
            updateFields.push('ultimo_intento = CURRENT_TIMESTAMP');

            const query = `
                UPDATE COMUNICACIONES 
                SET ${updateFields.join(', ')}
                WHERE id_comunicacion = $1
                RETURNING *
            `;

            const { rows, rowCount } = await this.pool.query(query, params);

            if (rowCount === 0) {
                return {
                    success: false,
                    message: 'Communication record not found'
                };
            }

            return {
                success: true,
                data: rows[0],
                message: `Delivery status updated to ${status}`
            };

        } catch (error) {
            console.error('Error updating delivery status:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update delivery status'
            };
        }
    }

    /**
     * Process delivery webhook from external providers
     * @param {string} provider - Provider name (sendgrid, twilio, etc.)
     * @param {Object} webhookData - Webhook payload
     * @returns {Object} Processing result
     */
    async processDeliveryWebhook(provider, webhookData) {
        try {
            this.initialize();

            let communicationId, status, metadata;

            // Parse webhook data based on provider
            switch (provider.toLowerCase()) {
                case 'sendgrid':
                    ({ communicationId, status, metadata } = this.parseSendGridWebhook(webhookData));
                    break;
                case 'twilio':
                    ({ communicationId, status, metadata } = this.parseTwilioWebhook(webhookData));
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }

            if (!communicationId) {
                return {
                    success: false,
                    message: 'Could not extract communication ID from webhook'
                };
            }

            // Update delivery status
            const result = await this.updateDeliveryStatus(communicationId, status, metadata);

            return {
                success: result.success,
                message: result.message,
                provider: provider,
                communicationId: communicationId,
                status: status
            };

        } catch (error) {
            console.error('Error processing delivery webhook:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to process delivery webhook'
            };
        }
    }

    /**
     * Parse SendGrid webhook data
     * @param {Object} webhookData - SendGrid webhook payload
     * @returns {Object} Parsed data
     */
    parseSendGridWebhook(webhookData) {
        // SendGrid sends an array of events
        const events = Array.isArray(webhookData) ? webhookData : [webhookData];
        const event = events[0]; // Process first event

        if (!event) {
            throw new Error('No event data in SendGrid webhook');
        }

        // Map SendGrid events to our status
        const statusMap = {
            'processed': 'sent',
            'delivered': 'delivered',
            'open': 'read',
            'bounce': 'bounced',
            'dropped': 'failed',
            'deferred': 'pending',
            'blocked': 'failed'
        };

        const status = statusMap[event.event] || 'pending';

        // Extract communication ID from custom args or message ID
        const communicationId = event.unique_arg_communication_id ||
            event.sg_message_id ||
            event.smtp_id;

        const metadata = {
            provider_event: event.event,
            provider_timestamp: event.timestamp,
            provider_message_id: event.sg_message_id,
            email: event.email,
            reason: event.reason,
            response: event.response
        };

        return { communicationId, status, metadata };
    }

    /**
     * Parse Twilio webhook data
     * @param {Object} webhookData - Twilio webhook payload
     * @returns {Object} Parsed data
     */
    parseTwilioWebhook(webhookData) {
        // Map Twilio status to our status
        const statusMap = {
            'queued': 'pending',
            'sent': 'sent',
            'delivered': 'delivered',
            'read': 'read',
            'failed': 'failed',
            'undelivered': 'failed'
        };

        const status = statusMap[webhookData.MessageStatus] || 'pending';
        const communicationId = webhookData.MessageSid;

        const metadata = {
            provider_status: webhookData.MessageStatus,
            provider_timestamp: webhookData.Timestamp,
            provider_message_id: webhookData.MessageSid,
            phone: webhookData.To,
            error_code: webhookData.ErrorCode,
            error_message: webhookData.ErrorMessage
        };

        return { communicationId, status, metadata };
    }

    /**
     * Get delivery statistics for a date range
     * @param {Object} filters - Filter options
     * @returns {Object} Delivery statistics
     */
    async getDeliveryStats(filters = {}) {
        try {
            this.initialize();

            const { startDate, endDate, method, type } = filters;

            let whereClause = 'WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            if (startDate) {
                whereClause += ` AND fecha_envio >= $${paramIndex++}`;
                params.push(startDate);
            }

            if (endDate) {
                whereClause += ` AND fecha_envio <= $${paramIndex++}`;
                params.push(endDate);
            }

            if (method) {
                whereClause += ` AND metodo = $${paramIndex++}`;
                params.push(method);
            }

            if (type) {
                whereClause += ` AND tipo = $${paramIndex++}`;
                params.push(type);
            }

            const query = `
                SELECT 
                    metodo,
                    tipo,
                    estado,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (fecha_entrega - fecha_envio))) as avg_delivery_time_seconds,
                    MIN(fecha_envio) as first_sent,
                    MAX(fecha_envio) as last_sent
                FROM COMUNICACIONES
                ${whereClause}
                GROUP BY metodo, tipo, estado
                ORDER BY metodo, tipo, estado
            `;

            const { rows } = await this.pool.query(query, params);

            // Calculate overall statistics
            const totalQuery = `
                SELECT 
                    COUNT(*) as total_communications,
                    COUNT(CASE WHEN estado = 'sent' THEN 1 END) as sent_count,
                    COUNT(CASE WHEN estado = 'delivered' THEN 1 END) as delivered_count,
                    COUNT(CASE WHEN estado = 'read' THEN 1 END) as read_count,
                    COUNT(CASE WHEN estado = 'failed' THEN 1 END) as failed_count,
                    COUNT(CASE WHEN estado = 'bounced' THEN 1 END) as bounced_count,
                    ROUND(
                        COUNT(CASE WHEN estado IN ('delivered', 'read') THEN 1 END) * 100.0 / 
                        NULLIF(COUNT(CASE WHEN estado != 'pending' THEN 1 END), 0), 
                        2
                    ) as delivery_rate_percent,
                    ROUND(
                        COUNT(CASE WHEN estado = 'read' THEN 1 END) * 100.0 / 
                        NULLIF(COUNT(CASE WHEN estado IN ('delivered', 'read') THEN 1 END), 0), 
                        2
                    ) as read_rate_percent
                FROM COMUNICACIONES
                ${whereClause}
            `;

            const { rows: totalRows } = await this.pool.query(totalQuery, params);

            return {
                success: true,
                data: {
                    detailed_stats: rows,
                    summary: totalRows[0]
                },
                message: 'Delivery statistics retrieved successfully'
            };

        } catch (error) {
            console.error('Error getting delivery stats:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to get delivery statistics'
            };
        }
    }

    /**
     * Get delivery history for a specific communication
     * @param {string} communicationId - Communication ID
     * @returns {Object} Delivery history
     */
    async getDeliveryHistory(communicationId) {
        try {
            this.initialize();

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

            const { rows, rowCount } = await this.pool.query(query, [communicationId]);

            if (rowCount === 0) {
                return {
                    success: false,
                    message: 'Communication not found'
                };
            }

            const communication = rows[0];

            // Build delivery timeline
            const timeline = [];

            if (communication.fecha_envio) {
                timeline.push({
                    status: 'sent',
                    timestamp: communication.fecha_envio,
                    description: 'Communication sent'
                });
            }

            if (communication.fecha_entrega) {
                timeline.push({
                    status: 'delivered',
                    timestamp: communication.fecha_entrega,
                    description: 'Communication delivered'
                });
            }

            if (communication.fecha_lectura) {
                timeline.push({
                    status: 'read',
                    timestamp: communication.fecha_lectura,
                    description: 'Communication read'
                });
            }

            if (communication.fecha_respuesta) {
                timeline.push({
                    status: 'responded',
                    timestamp: communication.fecha_respuesta,
                    description: 'Patient responded'
                });
            }

            // Sort timeline by timestamp
            timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            return {
                success: true,
                data: {
                    communication: communication,
                    timeline: timeline,
                    current_status: communication.estado,
                    delivery_attempts: communication.intentos_envio,
                    last_attempt: communication.ultimo_intento
                },
                message: 'Delivery history retrieved successfully'
            };

        } catch (error) {
            console.error('Error getting delivery history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to get delivery history'
            };
        }
    }

    /**
     * Retry failed communications
     * @param {Object} filters - Filter options for selecting communications to retry
     * @returns {Object} Retry result
     */
    async retryFailedCommunications(filters = {}) {
        try {
            this.initialize();

            const { maxAge = 24, maxAttempts = 3, method, type } = filters;

            let whereClause = `
                WHERE estado IN ('failed', 'bounced') 
                AND intentos_envio < $1 
                AND fecha_envio >= CURRENT_TIMESTAMP - INTERVAL '${maxAge} hours'
            `;
            const params = [maxAttempts];
            let paramIndex = 2;

            if (method) {
                whereClause += ` AND metodo = $${paramIndex++}`;
                params.push(method);
            }

            if (type) {
                whereClause += ` AND tipo = $${paramIndex++}`;
                params.push(type);
            }

            // Get communications to retry
            const selectQuery = `
                SELECT id_comunicacion, metodo, destinatario, asunto, contenido, tipo
                FROM COMUNICACIONES
                ${whereClause}
                ORDER BY fecha_envio DESC
                LIMIT 50
            `;

            const { rows } = await this.pool.query(selectQuery, params);

            if (rows.length === 0) {
                return {
                    success: true,
                    message: 'No failed communications found to retry',
                    retried: 0
                };
            }

            const retryResults = [];

            // Process each communication for retry
            for (const comm of rows) {
                try {
                    // Reset status to pending for retry
                    await this.updateDeliveryStatus(comm.id_comunicacion, 'pending', {
                        retry_attempt: true,
                        retry_timestamp: new Date().toISOString()
                    });

                    retryResults.push({
                        id: comm.id_comunicacion,
                        method: comm.metodo,
                        recipient: comm.destinatario,
                        status: 'queued_for_retry'
                    });

                } catch (error) {
                    retryResults.push({
                        id: comm.id_comunicacion,
                        method: comm.metodo,
                        recipient: comm.destinatario,
                        status: 'retry_failed',
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                data: retryResults,
                message: `Queued ${retryResults.length} communications for retry`,
                retried: retryResults.filter(r => r.status === 'queued_for_retry').length
            };

        } catch (error) {
            console.error('Error retrying failed communications:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retry communications'
            };
        }
    }

    /**
     * Get communication preferences management data
     * @param {string} patientId - Patient ID
     * @returns {Object} Preferences data
     */
    async getPatientPreferencesManagement(patientId) {
        try {
            this.initialize();

            // Get patient preferences with communication history
            const query = `
                SELECT 
                    p.id,
                    p.nombre,
                    p.apellido,
                    p.email,
                    p.telefono,
                    pc.metodo_preferido,
                    pc.recordatorios_habilitados,
                    pc.confirmaciones_habilitadas,
                    pc.notificaciones_lista_espera,
                    pc.idioma,
                    pc.zona_horaria,
                    pc.horario_no_molestar_inicio,
                    pc.horario_no_molestar_fin,
                    pc.dias_no_molestar,
                    COUNT(c.id_comunicacion) as total_communications,
                    COUNT(CASE WHEN c.estado = 'delivered' THEN 1 END) as delivered_count,
                    COUNT(CASE WHEN c.estado = 'read' THEN 1 END) as read_count,
                    COUNT(CASE WHEN c.estado = 'failed' THEN 1 END) as failed_count,
                    MAX(c.fecha_envio) as last_communication
                FROM PACIENTES p
                LEFT JOIN PREFERENCIAS_COMUNICACION pc ON p.id = pc.id_paciente
                LEFT JOIN CITAS cit ON p.id = cit.id_paciente
                LEFT JOIN COMUNICACIONES c ON cit.id = c.id_cita
                WHERE p.id = $1 AND p.activo = TRUE
                GROUP BY p.id, p.nombre, p.apellido, p.email, p.telefono,
                         pc.metodo_preferido, pc.recordatorios_habilitados,
                         pc.confirmaciones_habilitadas, pc.notificaciones_lista_espera,
                         pc.idioma, pc.zona_horaria, pc.horario_no_molestar_inicio,
                         pc.horario_no_molestar_fin, pc.dias_no_molestar
            `;

            const { rows, rowCount } = await this.pool.query(query, [patientId]);

            if (rowCount === 0) {
                return {
                    success: false,
                    message: 'Patient not found'
                };
            }

            const patientData = rows[0];

            // Get recent communication history
            const historyQuery = `
                SELECT 
                    c.tipo,
                    c.metodo,
                    c.estado,
                    c.fecha_envio,
                    c.fecha_entrega,
                    c.fecha_lectura,
                    cit.numero_cita,
                    cit.fecha_hora as fecha_cita
                FROM COMUNICACIONES c
                JOIN CITAS cit ON c.id_cita = cit.id
                WHERE cit.id_paciente = $1
                ORDER BY c.fecha_envio DESC
                LIMIT 10
            `;

            const { rows: historyRows } = await this.pool.query(historyQuery, [patientId]);

            return {
                success: true,
                data: {
                    patient: patientData,
                    recent_communications: historyRows,
                    communication_stats: {
                        total: patientData.total_communications || 0,
                        delivered: patientData.delivered_count || 0,
                        read: patientData.read_count || 0,
                        failed: patientData.failed_count || 0,
                        delivery_rate: patientData.total_communications > 0 ?
                            Math.round((patientData.delivered_count || 0) * 100 / patientData.total_communications) : 0
                    }
                },
                message: 'Patient preferences and communication history retrieved successfully'
            };

        } catch (error) {
            console.error('Error getting patient preferences management:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to get patient preferences management data'
            };
        }
    }

    /**
     * Handle delivery confirmation from patient
     * @param {string} communicationId - Communication ID
     * @param {string} confirmationType - Type of confirmation (delivered, read, etc.)
     * @param {Object} metadata - Additional confirmation metadata
     * @returns {Object} Confirmation result
     */
    async handleDeliveryConfirmation(communicationId, confirmationType, metadata = {}) {
        try {
            this.initialize();

            const validTypes = ['delivered', 'read', 'clicked', 'unsubscribed'];
            if (!validTypes.includes(confirmationType)) {
                throw new Error(`Invalid confirmation type: ${confirmationType}`);
            }

            // Update communication status
            const result = await this.updateDeliveryStatus(communicationId, confirmationType, {
                ...metadata,
                confirmation_source: 'patient',
                confirmation_timestamp: new Date().toISOString()
            });

            if (!result.success) {
                return result;
            }

            // Handle specific confirmation types
            if (confirmationType === 'unsubscribed') {
                // Update patient preferences to disable communications
                const communication = result.data;
                if (communication.id_cita) {
                    const patientQuery = `
                        SELECT cit.id_paciente 
                        FROM CITAS cit 
                        WHERE cit.id = $1
                    `;
                    const { rows: patientRows } = await this.pool.query(patientQuery, [communication.id_cita]);

                    if (patientRows.length > 0) {
                        await this.pool.query(`
                            UPDATE PREFERENCIAS_COMUNICACION 
                            SET recordatorios_habilitados = FALSE,
                                confirmaciones_habilitadas = FALSE,
                                notificaciones_lista_espera = FALSE
                            WHERE id_paciente = $1
                        `, [patientRows[0].id_paciente]);
                    }
                }
            }

            return {
                success: true,
                data: result.data,
                message: `Delivery confirmation processed: ${confirmationType}`
            };

        } catch (error) {
            console.error('Error handling delivery confirmation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to handle delivery confirmation'
            };
        }
    }
}

module.exports = DeliveryTrackingService;