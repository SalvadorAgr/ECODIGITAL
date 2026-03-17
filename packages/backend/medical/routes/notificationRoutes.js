/**
 * EcoDigital - Notification Routes
 * Routes for system notifications and alerts
 */

const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/v1/notifications
 * @desc Get notifications for current user
 * @access Private
 */
router.get('/', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        const {
            page = 1,
            limit = 20,
            unreadOnly = false,
            type,
            priority,
            includeExpired = false
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            unreadOnly: unreadOnly === 'true',
            type,
            priority,
            includeExpired: includeExpired === 'true'
        };

        const result = await notificationService.getUserNotifications(userId, options);

        res.status(200).json({
            success: true,
            ...result.data,
            message: `Retrieved ${result.data.notifications.length} notifications`
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve notifications',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/notifications/stats
 * @desc Get notification statistics for current user
 * @access Private
 */
router.get('/stats', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        const result = await notificationService.getNotificationStats(userId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Notification statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve notification statistics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/notifications
 * @desc Create a new notification (Admin only)
 * @access Private (Admin)
 */
router.post('/', authMiddleware.authenticateToken, authMiddleware.requireRole([1]), async (req, res) => {
    try {
        const {
            userId,
            type,
            title,
            message,
            priority = 'medium',
            actionUrl,
            actionData,
            expiresAt,
            sendEmail = false,
            sendSms = false
        } = req.body;

        // Validate required fields
        if (!userId || !type || !title || !message) {
            return res.status(400).json({
                success: false,
                error: 'User ID, type, title, and message are required'
            });
        }

        const notificationData = {
            userId,
            type,
            title,
            message,
            priority,
            actionUrl,
            actionData,
            expiresAt,
            sendEmail,
            sendSms
        };

        const result = await notificationService.createNotification(notificationData);

        res.status(201).json({
            success: true,
            data: result.data,
            message: 'Notification created successfully'
        });

    } catch (error) {
        console.error('Create notification error:', error);

        if (error.message.includes('Invalid')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create notification',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route PUT /api/v1/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:id/read', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_usuario;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Valid notification ID is required'
            });
        }

        const result = await notificationService.markAsRead(parseInt(id), userId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification as read error:', error);

        if (error.message.includes('not found') || error.message.includes('already read')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route PUT /api/v1/notifications/read-all
 * @desc Mark all notifications as read for current user
 * @access Private
 */
router.put('/read-all', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        const result = await notificationService.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: `${result.data.updatedCount} notifications marked as read`
        });

    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark all notifications as read',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete('/:id', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_usuario;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Valid notification ID is required'
            });
        }

        const result = await notificationService.deleteNotification(parseInt(id), userId);

        res.status(200).json({
            success: true,
            data: result.data,
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        console.error('Delete notification error:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to delete notification',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/notifications/types
 * @desc Get available notification types and priorities
 * @access Private
 */
router.get('/types', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const types = [
            {
                id: 'appointment_reminder',
                name: 'Recordatorio de Cita',
                description: 'Recordatorios de citas médicas programadas',
                icon: 'calendar'
            },
            {
                id: 'appointment_cancelled',
                name: 'Cita Cancelada',
                description: 'Notificaciones de citas canceladas',
                icon: 'x-circle'
            },
            {
                id: 'patient_update',
                name: 'Actualización de Paciente',
                description: 'Cambios en información de pacientes',
                icon: 'user'
            },
            {
                id: 'system_alert',
                name: 'Alerta del Sistema',
                description: 'Alertas importantes del sistema',
                icon: 'alert-triangle'
            },
            {
                id: 'file_uploaded',
                name: 'Archivo Subido',
                description: 'Nuevos archivos subidos al sistema',
                icon: 'upload'
            },
            {
                id: 'export_ready',
                name: 'Exportación Lista',
                description: 'Exportaciones de datos completadas',
                icon: 'download'
            },
            {
                id: 'ai_response',
                name: 'Respuesta de IA',
                description: 'Respuestas del asistente virtual',
                icon: 'message-circle'
            }
        ];

        const priorities = [
            {
                id: 'low',
                name: 'Baja',
                color: 'gray',
                description: 'Información general'
            },
            {
                id: 'medium',
                name: 'Media',
                color: 'blue',
                description: 'Información importante'
            },
            {
                id: 'high',
                name: 'Alta',
                color: 'orange',
                description: 'Requiere atención pronta'
            },
            {
                id: 'urgent',
                name: 'Urgente',
                color: 'red',
                description: 'Requiere atención inmediata'
            }
        ];

        res.status(200).json({
            success: true,
            data: {
                types,
                priorities
            },
            message: 'Notification types and priorities retrieved successfully'
        });

    } catch (error) {
        console.error('Get notification types error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve notification types',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/notifications/cleanup
 * @desc Clean up expired notifications (Admin only)
 * @access Private (Admin)
 */
router.post('/cleanup', authMiddleware.authenticateToken, authMiddleware.requireRole([1]), async (req, res) => {
    try {
        const result = await notificationService.cleanupExpiredNotifications();

        res.status(200).json({
            success: true,
            data: result.data,
            message: `${result.data.deletedCount} expired notifications cleaned up`
        });

    } catch (error) {
        console.error('Cleanup notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup expired notifications',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;