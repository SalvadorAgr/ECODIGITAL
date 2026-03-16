const { getPool } = require('../db');
const EmailService = require('./emailService');
const SMSService = require('./smsService');

/**
 * Communication Service
 * Handles automated appointment communications including reminders, confirmations, and notifications
 */
class CommunicationService {
    constructor() {
        this.pool = null;
        this.emailService = new EmailService();
        this.smsService = new SMSService();
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
     * Send appointment reminder
     * @param {Object} appointment - Appointment object
     * @param {string} reminderType - Type of reminder (24h, 2h, etc.)
     * @returns {Object} Communication result
     */
    async sendReminder(appointment, reminderType = '24h') {
        try {
            this.initialize();

            // Get patient communication preferences
            const preferences = await this.getPatientPreferences(appointment.id_paciente);

            if (!preferences.recordatorios_habilitados) {
                return {
                    success: false,
                    message: 'Patient has disabled reminders',
                    skipped: true
                };
            }

            // Get reminder template
            const template = await this.getReminderTemplate(reminderType, preferences.metodo_preferido);

            if (!template) {
                return {
                    success: false,
                    message: 'No reminder template found',
                    error: 'TEMPLATE_NOT_FOUND'
                };
            }

            // Prepare communication data
            const communicationData = {
                id_cita: appointment.id || appointment.id_cita,
                tipo: 'reminder',
                metodo: preferences.metodo_preferido,
                destinatario: this.getRecipientAddress(appointment, preferences.metodo_preferido),
                asunto: this.processTemplate(template.asunto, appointment),
                contenido: this.processTemplate(template.contenido, appointment)
            };

            // Send the communication
            const result = await this.sendCommunication(communicationData);

            return {
                success: true,
                data: result,
                message: 'Reminder sent successfully'
            };

        } catch (error) {
            console.error('Error sending reminder:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send reminder'
            };
        }
    }

    /**
     * Send appointment confirmation request
     * @param {Object} appointment - Appointment object
     * @returns {Object} Communication result
     */
    async sendConfirmationRequest(appointment) {
        try {
            this.initialize();

            // Get patient communication preferences
            const preferences = await this.getPatientPreferences(appointment.id_paciente);

            if (!preferences.confirmaciones_habilitadas) {
                return {
                    success: false,
                    message: 'Patient has disabled confirmations',
                    skipped: true
                };
            }

            // Get confirmation template
            const template = await this.getTemplate('confirmation', preferences.metodo_preferido);

            if (!template) {
                return {
                    success: false,
                    message: 'No confirmation template found',
                    error: 'TEMPLATE_NOT_FOUND'
                };
            }

            // Prepare communication data
            const communicationData = {
                id_cita: appointment.id || appointment.id_cita,
                tipo: 'confirmation',
                metodo: preferences.metodo_preferido,
                destinatario: this.getRecipientAddress(appointment, preferences.metodo_preferido),
                asunto: this.processTemplate(template.asunto, appointment),
                contenido: this.processTemplate(template.contenido, appointment)
            };

            // Send the communication
            const result = await this.sendCommunication(communicationData);

            return {
                success: true,
                data: result,
                message: 'Confirmation request sent successfully'
            };

        } catch (error) {
            console.error('Error sending confirmation request:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send confirmation request'
            };
        }
    }

    /**
     * Send cancellation notification
     * @param {Object} appointment - Appointment object
     * @param {string} reason - Cancellation reason
     * @returns {Object} Communication result
     */
    async sendCancellationNotification(appointment, reason = '') {
        try {
            this.initialize();

            // Get patient communication preferences
            const preferences = await this.getPatientPreferences(appointment.id_paciente);

            // Get cancellation template
            const template = await this.getTemplate('cancellation', preferences.metodo_preferido);

            if (!template) {
                return {
                    success: false,
                    message: 'No cancellation template found',
                    error: 'TEMPLATE_NOT_FOUND'
                };
            }

            // Add cancellation reason to appointment data
            const appointmentWithReason = { ...appointment, motivo_cancelacion: reason };

            // Prepare communication data
            const communicationData = {
                id_cita: appointment.id || appointment.id_cita,
                tipo: 'cancellation',
                metodo: preferences.metodo_preferido,
                destinatario: this.getRecipientAddress(appointment, preferences.metodo_preferido),
                asunto: this.processTemplate(template.asunto, appointmentWithReason),
                contenido: this.processTemplate(template.contenido, appointmentWithReason)
            };

            // Send the communication
            const result = await this.sendCommunication(communicationData);

            return {
                success: true,
                data: result,
                message: 'Cancellation notification sent successfully'
            };

        } catch (error) {
            console.error('Error sending cancellation notification:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send cancellation notification'
            };
        }
    }

    /**
     * Send waitlist notification
     * @param {Object} waitlistEntry - Waitlist entry object
     * @param {Object} availableSlot - Available appointment slot
     * @returns {Object} Communication result
     */
    async sendWaitlistNotification(waitlistEntry, availableSlot) {
        try {
            this.initialize();

            // Get patient communication preferences
            const preferences = await this.getPatientPreferences(waitlistEntry.id_paciente);

            if (!preferences.notificaciones_lista_espera) {
                return {
                    success: false,
                    message: 'Patient has disabled waitlist notifications',
                    skipped: true
                };
            }

            // Get waitlist notification template
            const template = await this.getTemplate('waitlist_notification', preferences.metodo_preferido);

            if (!template) {
                return {
                    success: false,
                    message: 'No waitlist notification template found',
                    error: 'TEMPLATE_NOT_FOUND'
                };
            }

            // Combine waitlist and slot data
            const notificationData = { ...waitlistEntry, ...availableSlot };

            // Prepare communication data
            const communicationData = {
                id_cita: null, // No appointment ID yet
                tipo: 'waitlist_notification',
                metodo: preferences.metodo_preferido,
                destinatario: this.getRecipientAddress(notificationData, preferences.metodo_preferido),
                asunto: this.processTemplate(template.asunto, notificationData),
                contenido: this.processTemplate(template.contenido, notificationData)
            };

            // Send the communication
            const result = await this.sendCommunication(communicationData);

            // Update waitlist entry with notification timestamp
            await this.pool.query(
                'UPDATE LISTA_ESPERA SET notificado_en = CURRENT_TIMESTAMP WHERE id_entrada = $1',
                [waitlistEntry.id_entrada]
            );

            return {
                success: true,
                data: result,
                message: 'Waitlist notification sent successfully'
            };

        } catch (error) {
            console.error('Error sending waitlist notification:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send waitlist notification'
            };
        }
    }

    /**
     * Process patient response to communications
     * @param {Object} response - Patient response object
     * @returns {Object} Processing result
     */
    async processPatientResponse(response) {
        try {
            this.initialize();

            const { communicationId, responseType, responseContent } = response;

            // Update communication record with response
            const updateQuery = `
                UPDATE COMUNICACIONES 
                SET 
                    fecha_respuesta = CURRENT_TIMESTAMP,
                    metadatos = COALESCE(metadatos, '{}')::jsonb || $1::jsonb
                WHERE id_comunicacion = $2
                RETURNING *
            `;

            const responseMetadata = {
                response_type: responseType,
                response_content: responseContent,
                processed_at: new Date().toISOString()
            };

            const { rows } = await this.pool.query(updateQuery, [
                JSON.stringify(responseMetadata),
                communicationId
            ]);

            if (rows.length === 0) {
                return {
                    success: false,
                    message: 'Communication record not found'
                };
            }

            // Process specific response types
            const communication = rows[0];
            let processingResult = {};

            switch (responseType) {
                case 'confirmation':
                    processingResult = await this.processConfirmationResponse(communication, responseContent);
                    break;
                case 'cancellation':
                    processingResult = await this.processCancellationResponse(communication, responseContent);
                    break;
                case 'reschedule':
                    processingResult = await this.processRescheduleResponse(communication, responseContent);
                    break;
                default:
                    processingResult = { message: 'Response recorded' };
            }

            return {
                success: true,
                data: processingResult,
                message: 'Patient response processed successfully'
            };

        } catch (error) {
            console.error('Error processing patient response:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to process patient response'
            };
        }
    }

    /**
     * Get patient communication preferences
     * @param {string} patientId - Patient ID
     * @returns {Object} Patient preferences
     */
    async getPatientPreferences(patientId) {
        try {
            const query = `
                SELECT 
                    pc.*,
                    p.email,
                    p.telefono
                FROM PREFERENCIAS_COMUNICACION pc
                RIGHT JOIN PACIENTES p ON pc.id_paciente = p.id
                WHERE p.id = $1
            `;

            const { rows } = await this.pool.query(query, [patientId]);

            if (rows.length === 0) {
                throw new Error('Patient not found');
            }

            const patient = rows[0];

            // Return default preferences if none exist
            return {
                metodo_preferido: patient.metodo_preferido || 'email',
                recordatorios_habilitados: patient.recordatorios_habilitados !== false,
                confirmaciones_habilitadas: patient.confirmaciones_habilitadas !== false,
                notificaciones_lista_espera: patient.notificaciones_lista_espera !== false,
                idioma: patient.idioma || 'es',
                zona_horaria: patient.zona_horaria || 'America/Mexico_City',
                email: patient.email,
                telefono: patient.telefono
            };

        } catch (error) {
            console.error('Error getting patient preferences:', error);
            throw error;
        }
    }

    /**
     * Get communication template
     * @param {string} type - Communication type
     * @param {string} method - Communication method
     * @param {string} language - Language code
     * @returns {Object} Template object
     */
    async getTemplate(type, method, language = 'es') {
        try {
            const query = `
                SELECT * FROM PLANTILLAS_COMUNICACION
                WHERE tipo = $1 AND metodo = $2 AND idioma = $3 AND activa = TRUE
                ORDER BY por_defecto DESC, creado_en DESC
                LIMIT 1
            `;

            const { rows } = await this.pool.query(query, [type, method, language]);

            return rows.length > 0 ? rows[0] : null;

        } catch (error) {
            console.error('Error getting template:', error);
            throw error;
        }
    }

    /**
     * Get reminder template based on type
     * @param {string} reminderType - Reminder type (24h, 2h, etc.)
     * @param {string} method - Communication method
     * @param {string} language - Language code
     * @returns {Object} Template object
     */
    async getReminderTemplate(reminderType, method, language = 'es') {
        try {
            // First try to get specific reminder template
            let query = `
                SELECT * FROM RECORDATORIOS r
                JOIN PLANTILLAS_COMUNICACION pt ON r.plantilla_asunto = pt.asunto
                WHERE r.nombre ILIKE $1 AND pt.metodo = $2 AND pt.idioma = $3 AND r.activo = TRUE
                ORDER BY r.creado_en DESC
                LIMIT 1
            `;

            let { rows } = await this.pool.query(query, [`%${reminderType}%`, method, language]);

            if (rows.length > 0) {
                return {
                    asunto: rows[0].plantilla_asunto,
                    contenido: rows[0].plantilla_contenido
                };
            }

            // Fallback to default reminder template
            return await this.getTemplate('reminder', method, language);

        } catch (error) {
            console.error('Error getting reminder template:', error);
            throw error;
        }
    }

    /**
     * Send communication via appropriate channel
     * @param {Object} communicationData - Communication data
     * @returns {Object} Send result
     */
    async sendCommunication(communicationData) {
        try {
            // Insert communication record
            const insertQuery = `
                INSERT INTO COMUNICACIONES (
                    id_cita, tipo, metodo, destinatario, asunto, contenido, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                RETURNING *
            `;

            const { rows } = await this.pool.query(insertQuery, [
                communicationData.id_cita,
                communicationData.tipo,
                communicationData.metodo,
                communicationData.destinatario,
                communicationData.asunto,
                communicationData.contenido
            ]);

            const communication = rows[0];

            // Send via appropriate method
            let sendResult;
            switch (communicationData.metodo) {
                case 'email':
                    sendResult = await this.sendEmail(communication);
                    break;
                case 'sms':
                    sendResult = await this.sendSMS(communication);
                    break;
                case 'push_notification':
                    sendResult = await this.sendPushNotification(communication);
                    break;
                default:
                    throw new Error(`Unsupported communication method: ${communicationData.metodo}`);
            }

            // Update communication record with send result
            await this.updateCommunicationStatus(communication.id_comunicacion, sendResult);

            return {
                id: communication.id_comunicacion,
                status: sendResult.success ? 'sent' : 'failed',
                method: communicationData.metodo,
                recipient: communicationData.destinatario,
                external_id: sendResult.external_id,
                error: sendResult.error
            };

        } catch (error) {
            console.error('Error sending communication:', error);
            throw error;
        }
    }

    /**
     * Send email communication
     * @param {Object} communication - Communication record
     * @returns {Object} Send result
     */
    async sendEmail(communication) {
        try {
            const emailData = {
                to: communication.destinatario,
                subject: communication.asunto,
                content: communication.contenido,
                html: this.emailService.createHtmlTemplate({
                    title: communication.asunto,
                    content: communication.contenido,
                    clinicName: process.env.CLINIC_NAME,
                    clinicPhone: process.env.CLINIC_PHONE,
                    clinicAddress: process.env.CLINIC_ADDRESS
                })
            };

            const result = await this.emailService.sendEmail(emailData);

            return {
                success: result.success,
                external_id: result.messageId,
                sent_at: new Date(),
                error: result.error,
                provider_response: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send SMS communication
     * @param {Object} communication - Communication record
     * @returns {Object} Send result
     */
    async sendSMS(communication) {
        try {
            const smsData = {
                to: communication.destinatario,
                content: communication.contenido
            };

            const result = await this.smsService.sendSMS(smsData);

            return {
                success: result.success,
                external_id: result.messageId,
                sent_at: new Date(),
                error: result.error,
                provider_response: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send push notification
     * @param {Object} communication - Communication record
     * @returns {Object} Send result
     */
    async sendPushNotification(communication) {
        try {
            // TODO: Integrate with push notification service (Firebase, AWS SNS, etc.)
            // For now, simulate push notification
            console.log(`Sending push notification to ${communication.destinatario}:`);
            console.log(`Content: ${communication.contenido}`);

            // Simulate success
            return {
                success: true,
                external_id: `push_${Date.now()}`,
                sent_at: new Date()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update communication status
     * @param {string} communicationId - Communication ID
     * @param {Object} sendResult - Send result
     */
    async updateCommunicationStatus(communicationId, sendResult) {
        try {
            const updateQuery = `
                UPDATE COMUNICACIONES 
                SET 
                    estado = $1,
                    fecha_envio = $2,
                    id_externo = $3,
                    error_mensaje = $4,
                    intentos_envio = intentos_envio + 1,
                    ultimo_intento = CURRENT_TIMESTAMP
                WHERE id_comunicacion = $5
            `;

            await this.pool.query(updateQuery, [
                sendResult.success ? 'sent' : 'failed',
                sendResult.sent_at || new Date(),
                sendResult.external_id,
                sendResult.error,
                communicationId
            ]);

        } catch (error) {
            console.error('Error updating communication status:', error);
        }
    }

    /**
     * Get recipient address based on communication method
     * @param {Object} data - Data object containing contact information
     * @param {string} method - Communication method
     * @returns {string} Recipient address
     */
    getRecipientAddress(data, method) {
        switch (method) {
            case 'email':
                return data.email_contacto || data.email || data.email_paciente;
            case 'sms':
            case 'phone_call':
                return data.telefono_contacto || data.telefono || data.telefono_paciente;
            case 'push_notification':
                return data.device_token || data.user_id || data.id_paciente;
            default:
                throw new Error(`Unknown communication method: ${method}`);
        }
    }

    /**
     * Process template with data variables
     * @param {string} template - Template string
     * @param {Object} data - Data object for variable replacement
     * @returns {string} Processed template
     */
    processTemplate(template, data) {
        if (!template) return '';

        let processed = template;

        // Replace common variables
        const variables = {
            nombre_paciente: data.nombre_paciente || `${data.nombre || ''} ${data.apellido || ''}`.trim(),
            fecha_cita: data.fecha_hora ? new Date(data.fecha_hora).toLocaleDateString('es-ES') : '',
            hora_cita: data.fecha_hora ? new Date(data.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
            nombre_medico: data.nombre_medico || `${data.nombres || ''} ${data.apellidos || ''}`.trim(),
            ubicacion: data.sala_consulta || 'Consultorio principal',
            telefono_clinica: process.env.CLINIC_PHONE || '(555) 123-4567',
            nombre_clinica: process.env.CLINIC_NAME || 'EcoDigital Clinic',
            motivo_cancelacion: data.motivo_cancelacion || 'No especificado',
            numero_cita: data.numero_cita || data.id
        };

        // Replace all variables in template
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processed = processed.replace(regex, variables[key] || '');
        });

        return processed;
    }

    /**
     * Process confirmation response
     * @param {Object} communication - Communication record
     * @param {string} responseContent - Response content
     * @returns {Object} Processing result
     */
    async processConfirmationResponse(communication, responseContent) {
        try {
            if (communication.id_cita) {
                // Update appointment status to confirmed
                await this.pool.query(
                    'UPDATE CITAS SET estado = $1, fecha_confirmacion = CURRENT_TIMESTAMP WHERE id = $2',
                    ['CONFIRMADA', communication.id_cita]
                );

                return { message: 'Appointment confirmed', appointment_id: communication.id_cita };
            }

            return { message: 'Confirmation recorded' };

        } catch (error) {
            console.error('Error processing confirmation response:', error);
            throw error;
        }
    }

    /**
     * Process cancellation response
     * @param {Object} communication - Communication record
     * @param {string} responseContent - Response content
     * @returns {Object} Processing result
     */
    async processCancellationResponse(communication, responseContent) {
        try {
            if (communication.id_cita) {
                // Update appointment status to cancelled
                await this.pool.query(
                    'UPDATE CITAS SET estado = $1, fecha_cancelacion = CURRENT_TIMESTAMP, motivo_cancelacion = $2 WHERE id = $3',
                    ['CANCELADA', responseContent || 'Cancelled by patient', communication.id_cita]
                );

                return { message: 'Appointment cancelled', appointment_id: communication.id_cita };
            }

            return { message: 'Cancellation recorded' };

        } catch (error) {
            console.error('Error processing cancellation response:', error);
            throw error;
        }
    }

    /**
     * Process reschedule response
     * @param {Object} communication - Communication record
     * @param {string} responseContent - Response content
     * @returns {Object} Processing result
     */
    async processRescheduleResponse(communication, responseContent) {
        try {
            // For reschedule requests, we would typically need additional logic
            // to handle the new appointment time selection
            return {
                message: 'Reschedule request recorded',
                appointment_id: communication.id_cita,
                requested_time: responseContent
            };

        } catch (error) {
            console.error('Error processing reschedule response:', error);
            throw error;
        }
    }

    /**
     * Get communication history for an appointment
     * @param {string} appointmentId - Appointment ID
     * @returns {Array} Communication history
     */
    async getCommunicationHistory(appointmentId) {
        try {
            this.initialize();

            const query = `
                SELECT * FROM COMUNICACIONES
                WHERE id_cita = $1
                ORDER BY fecha_envio DESC
            `;

            const { rows } = await this.pool.query(query, [appointmentId]);

            return rows;

        } catch (error) {
            console.error('Error getting communication history:', error);
            throw error;
        }
    }

    /**
     * Get communication statistics
     * @param {Object} filters - Filter options
     * @returns {Object} Communication statistics
     */
    async getCommunicationStats(filters = {}) {
        try {
            this.initialize();

            const { startDate, endDate, type, method, status } = filters;

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

            if (type) {
                whereClause += ` AND tipo = $${paramIndex++}`;
                params.push(type);
            }

            if (method) {
                whereClause += ` AND metodo = $${paramIndex++}`;
                params.push(method);
            }

            if (status) {
                whereClause += ` AND estado = $${paramIndex++}`;
                params.push(status);
            }

            const query = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN estado = 'sent' THEN 1 END) as sent,
                    COUNT(CASE WHEN estado = 'delivered' THEN 1 END) as delivered,
                    COUNT(CASE WHEN estado = 'failed' THEN 1 END) as failed,
                    COUNT(CASE WHEN fecha_respuesta IS NOT NULL THEN 1 END) as responded,
                    tipo,
                    metodo
                FROM COMUNICACIONES
                ${whereClause}
                GROUP BY tipo, metodo
                ORDER BY tipo, metodo
            `;

            const { rows } = await this.pool.query(query, params);

            return rows;

        } catch (error) {
            console.error('Error getting communication stats:', error);
            throw error;
        }
    }
}

module.exports = CommunicationService;