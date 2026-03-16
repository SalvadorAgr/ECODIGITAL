/**
 * EcoDigital - Notification Service
 * Service for managing system notifications and alerts
 */

const { query, transaction } = require('../db');

class NotificationService {
    constructor() {
        this.notificationTypes = {
            APPOINTMENT_REMINDER: 'appointment_reminder',
            APPOINTMENT_CANCELLED: 'appointment_cancelled',
            PATIENT_UPDATE: 'patient_update',
            SYSTEM_ALERT: 'system_alert',
            FILE_UPLOADED: 'file_uploaded',
            EXPORT_READY: 'export_ready',
            AI_RESPONSE: 'ai_response'
        };

        this.priorities = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            URGENT: 'urgent'
        };
    }

    /**
     * Create a new notification
     */
    async createNotification(notificationData) {
        try {
            const {
                userId,
                type,
                title,
                message,
                priority = this.priorities.MEDIUM,
                actionUrl = null,
                actionData = null,
                expiresAt = null,
                sendEmail = false,
                sendSms = false
            } = notificationData;

            // Validate required fields
            if (!userId || !type || !title || !message) {
                throw new Error('User ID, type, title, and message are required');
            }

            // Validate type
            if (!Object.values(this.notificationTypes).includes(type)) {
                throw new Error(`Invalid notification type: ${type}`);
            }

            // Validate priority
            if (!Object.values(this.priorities).includes(priority)) {
                throw new Error(`Invalid priority: ${priority}`);
            }

            const insertQuery = `
                INSERT INTO notifications (
                    user_id, type, title, message, priority,
                    action_url, action_data, expires_at,
                    send_email, send_sms, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                RETURNING *
            `;

            const values = [
                userId,
                type,
                title,
                message,
                priority,
                actionUrl,
                actionData ? JSON.stringify(actionData) : null,
                expiresAt,
                sendEmail,
                sendSms
            ];

            const { rows } = await query(insertQuery, values);
            const notification = rows[0];

            // Send email/SMS if requested
            if (sendEmail) {
                await this.sendEmailNotification(notification);
            }

            if (sendSms) {
                await this.sendSmsNotification(notification);
            }

            return {
                success: true,
                data: notification
            };

        } catch (error) {
            console.error('Create notification error:', error);
            throw new Error('Failed to create notification');
        }
    }

    /**
     * Get notifications for a user
     */
    async getUserNotifications(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                unreadOnly = false,
                type = null,
                priority = null,
                includeExpired = false
            } = options;

            let baseQuery = `
                SELECT 
                    n.*,
                    u.nombre as user_name
                FROM notifications n
                JOIN USUARIOS u ON n.user_id = u.id_usuario
                WHERE n.user_id = $1
            `;

            const params = [userId];
            let paramIndex = 2;

            // Filter by read status
            if (unreadOnly) {
                baseQuery += ` AND n.is_read = FALSE`;
            }

            // Filter by type
            if (type) {
                baseQuery += ` AND n.type = $${paramIndex}`;
                params.push(type);
                paramIndex++;
            }

            // Filter by priority
            if (priority) {
                baseQuery += ` AND n.priority = $${paramIndex}`;
                params.push(priority);
                paramIndex++;
            }

            // Filter expired notifications
            if (!includeExpired) {
                baseQuery += ` AND (n.expires_at IS NULL OR n.expires_at > NOW())`;
            }

            // Count total
            const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_notifications`;
            const { rows: countRows } = await query(countQuery, params);
            const total = parseInt(countRows[0].total);

            // Add sorting and pagination
            baseQuery += ` ORDER BY n.created_at DESC`;

            const offset = (page - 1) * limit;
            baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const { rows } = await query(baseQuery, params);

            // Parse action_data JSON
            const notifications = rows.map(notification => ({
                ...notification,
                action_data: notification.action_data ? JSON.parse(notification.action_data) : null
            }));

            return {
                success: true,
                data: {
                    notifications,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page < Math.ceil(total / limit),
                        hasPrev: page > 1
                    }
                }
            };

        } catch (error) {
            console.error('Get user notifications error:', error);
            throw new Error('Failed to retrieve notifications');
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const updateQuery = `
                UPDATE notifications 
                SET is_read = TRUE, read_at = NOW()
                WHERE id = $1 AND user_id = $2 AND is_read = FALSE
                RETURNING *
            `;

            const { rows, rowCount } = await query(updateQuery, [notificationId, userId]);

            if (rowCount === 0) {
                throw new Error('Notification not found or already read');
            }

            return {
                success: true,
                data: rows[0]
            };

        } catch (error) {
            console.error('Mark notification as read error:', error);
            throw new Error('Failed to mark notification as read');
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        try {
            const updateQuery = `
                UPDATE notifications 
                SET is_read = TRUE, read_at = NOW()
                WHERE user_id = $1 AND is_read = FALSE
                RETURNING COUNT(*) as updated_count
            `;

            const { rows } = await query(updateQuery, [userId]);

            return {
                success: true,
                data: {
                    updatedCount: parseInt(rows[0].updated_count || 0)
                }
            };

        } catch (error) {
            console.error('Mark all notifications as read error:', error);
            throw new Error('Failed to mark all notifications as read');
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            const deleteQuery = `
                DELETE FROM notifications 
                WHERE id = $1 AND user_id = $2
                RETURNING id
            `;

            const { rows, rowCount } = await query(deleteQuery, [notificationId, userId]);

            if (rowCount === 0) {
                throw new Error('Notification not found');
            }

            return {
                success: true,
                data: { deletedId: rows[0].id }
            };

        } catch (error) {
            console.error('Delete notification error:', error);
            throw new Error('Failed to delete notification');
        }
    }

    /**
     * Get notification statistics for user
     */
    async getNotificationStats(userId) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread,
                    COUNT(CASE WHEN priority = 'urgent' AND is_read = FALSE THEN 1 END) as urgent_unread,
                    COUNT(CASE WHEN priority = 'high' AND is_read = FALSE THEN 1 END) as high_unread,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as today,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week
                FROM notifications 
                WHERE user_id = $1 
                AND (expires_at IS NULL OR expires_at > NOW())
            `;

            const { rows } = await query(statsQuery, [userId]);
            const stats = rows[0];

            return {
                success: true,
                data: {
                    total: parseInt(stats.total),
                    unread: parseInt(stats.unread),
                    urgentUnread: parseInt(stats.urgent_unread),
                    highUnread: parseInt(stats.high_unread),
                    today: parseInt(stats.today),
                    thisWeek: parseInt(stats.this_week)
                }
            };

        } catch (error) {
            console.error('Get notification stats error:', error);
            throw new Error('Failed to retrieve notification statistics');
        }
    }

    /**
     * Create appointment reminder notification
     */
    async createAppointmentReminder(appointmentData) {
        try {
            const { patientId, appointmentId, appointmentDate, patientName, doctorName } = appointmentData;

            // Get patient's user ID (if patient has user account)
            // For now, we'll send to all users with appointment management permissions
            const usersQuery = `
                SELECT DISTINCT u.id_usuario
                FROM USUARIOS u
                JOIN ROLES_PERMISOS rp ON u.id_role = rp.id_role
                JOIN PERMISOS p ON rp.id_permiso = p.id_permiso
                WHERE p.nombre_permiso IN ('appointment_manage', 'dashboard_access')
                AND u.activo = TRUE
            `;

            const { rows: users } = await query(usersQuery);

            const notifications = [];

            for (const user of users) {
                const notification = await this.createNotification({
                    userId: user.id_usuario,
                    type: this.notificationTypes.APPOINTMENT_REMINDER,
                    title: 'Recordatorio de Cita',
                    message: `Cita programada para ${patientName} el ${new Date(appointmentDate).toLocaleString('es-ES')} con Dr. ${doctorName}`,
                    priority: this.priorities.HIGH,
                    actionUrl: `/appointments/${appointmentId}`,
                    actionData: {
                        appointmentId,
                        patientId,
                        appointmentDate
                    },
                    expiresAt: new Date(appointmentDate).toISOString()
                });

                notifications.push(notification.data);
            }

            return {
                success: true,
                data: notifications
            };

        } catch (error) {
            console.error('Create appointment reminder error:', error);
            throw new Error('Failed to create appointment reminder');
        }
    }

    /**
     * Create file upload notification
     */
    async createFileUploadNotification(fileData) {
        try {
            const { patientId, fileName, uploadedBy, fileType } = fileData;

            // Get users who can view patient files
            const usersQuery = `
                SELECT DISTINCT u.id_usuario
                FROM USUARIOS u
                JOIN ROLES_PERMISOS rp ON u.id_role = rp.id_role
                JOIN PERMISOS p ON rp.id_permiso = p.id_permiso
                WHERE p.nombre_permiso IN ('file_viewer_access', 'dashboard_access')
                AND u.activo = TRUE
                AND u.id_usuario != $1
            `;

            const { rows: users } = await query(usersQuery, [uploadedBy]);

            // Get patient name
            const patientQuery = `
                SELECT CONCAT(nombre, ' ', apellido) as patient_name
                FROM PACIENTES WHERE id = $1
            `;
            const { rows: patientRows } = await query(patientQuery, [patientId]);
            const patientName = patientRows[0]?.patient_name || 'Paciente';

            const notifications = [];

            for (const user of users) {
                const notification = await this.createNotification({
                    userId: user.id_usuario,
                    type: this.notificationTypes.FILE_UPLOADED,
                    title: 'Nuevo Archivo Subido',
                    message: `Se ha subido un nuevo archivo "${fileName}" para el paciente ${patientName}`,
                    priority: this.priorities.MEDIUM,
                    actionUrl: `/file-viewer/patient/${patientId}`,
                    actionData: {
                        patientId,
                        fileName,
                        fileType,
                        uploadedBy
                    }
                });

                notifications.push(notification.data);
            }

            return {
                success: true,
                data: notifications
            };

        } catch (error) {
            console.error('Create file upload notification error:', error);
            throw new Error('Failed to create file upload notification');
        }
    }

    /**
     * Send email notification (placeholder)
     */
    async sendEmailNotification(notification) {
        try {
            // TODO: Implement email sending using emailService
            console.log('Email notification would be sent:', {
                to: notification.user_id,
                subject: notification.title,
                body: notification.message
            });

            // Update notification to mark email as sent
            await query(`
                UPDATE notifications 
                SET email_sent = TRUE, email_sent_at = NOW()
                WHERE id = $1
            `, [notification.id]);

        } catch (error) {
            console.error('Send email notification error:', error);
            // Don't throw error, just log it
        }
    }

    /**
     * Send SMS notification (placeholder)
     */
    async sendSmsNotification(notification) {
        try {
            // TODO: Implement SMS sending using smsService
            console.log('SMS notification would be sent:', {
                to: notification.user_id,
                message: `${notification.title}: ${notification.message}`
            });

            // Update notification to mark SMS as sent
            await query(`
                UPDATE notifications 
                SET sms_sent = TRUE, sms_sent_at = NOW()
                WHERE id = $1
            `, [notification.id]);

        } catch (error) {
            console.error('Send SMS notification error:', error);
            // Don't throw error, just log it
        }
    }

    /**
     * Clean up expired notifications
     */
    async cleanupExpiredNotifications() {
        try {
            const deleteQuery = `
                DELETE FROM notifications 
                WHERE expires_at IS NOT NULL 
                AND expires_at < NOW() - INTERVAL '30 days'
                RETURNING COUNT(*) as deleted_count
            `;

            const { rows } = await query(deleteQuery);

            return {
                success: true,
                data: {
                    deletedCount: parseInt(rows[0].deleted_count || 0)
                }
            };

        } catch (error) {
            console.error('Cleanup expired notifications error:', error);
            throw new Error('Failed to cleanup expired notifications');
        }
    }
}

module.exports = new NotificationService();