/**
 * EcoDigital - Dashboard Principal Routes
 * Routes for dashboard context management and statistics
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/v1/dashboard/context
 * @desc Get dashboard context for current user
 * @access Private
 */
router.get('/context', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        // Demo mode - return mock data
        if (process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true') {
            const mockData = {
                selectedPatient: null,
                recentPatients: [
                    {
                        id: 1,
                        nombre: 'Juan',
                        apellido: 'Pérez García',
                        telefono: '555-0123',
                        email: 'juan.perez@email.com',
                        last_accessed: new Date().toISOString()
                    },
                    {
                        id: 2,
                        nombre: 'María',
                        apellido: 'López Rodríguez',
                        telefono: '555-0124',
                        email: 'maria.lopez@email.com',
                        last_accessed: new Date().toISOString()
                    }
                ],
                notifications: [],
                quickStats: {
                    active_patients: 3,
                    appointments_today: 2,
                    total_files: 15,
                    user_notes_count: 5
                },
                userPreferences: {
                    theme: 'glassmorphism-dark',
                    language: 'es',
                    autoSave: true,
                    notificationsEnabled: true
                }
            };

            return res.status(200).json({
                success: true,
                data: mockData,
                message: 'Dashboard context retrieved successfully (demo mode)'
            });
        }

        // Get current patient context
        const patientContextQuery = `
            SELECT 
                pc.patient_id,
                pc.context_data,
                pc.last_accessed,
                p.nombre,
                p.apellido,
                p.fecha_nacimiento,
                p.telefono,
                p.email
            FROM patient_context pc
            JOIN PACIENTES p ON pc.patient_id = p.id
            WHERE pc.user_id = $1 
            ORDER BY pc.last_accessed DESC 
            LIMIT 1
        `;

        const patientContextResult = await query(patientContextQuery, [userId]);
        const selectedPatient = patientContextResult.rows.length > 0 ? patientContextResult.rows[0] : null;

        // Get recent patients for this user
        const recentPatientsQuery = `
            SELECT DISTINCT
                p.id,
                p.nombre,
                p.apellido,
                p.telefono,
                p.email,
                pc.last_accessed
            FROM patient_context pc
            JOIN PACIENTES p ON pc.patient_id = p.id
            WHERE pc.user_id = $1 AND p.activo = TRUE
            ORDER BY pc.last_accessed DESC
            LIMIT 5
        `;

        const recentPatientsResult = await query(recentPatientsQuery, [userId]);

        // Get dashboard statistics
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM PACIENTES WHERE activo = TRUE) as active_patients,
                (SELECT COUNT(*) FROM CITAS WHERE fecha_hora::date = CURRENT_DATE) as appointments_today,
                (SELECT COUNT(*) FROM file_metadata WHERE is_active = TRUE) as total_files,
                (SELECT COUNT(*) FROM user_notes WHERE user_id = $1) as user_notes_count
        `;

        const statsResult = await query(statsQuery, [userId]);
        const quickStats = statsResult.rows[0];

        // Get user notifications (placeholder - implement based on your notification system)
        const notifications = []; // TODO: Implement notification system

        // Get user preferences (placeholder)
        const userPreferences = {
            theme: 'glassmorphism-dark',
            language: 'es',
            autoSave: true,
            notificationsEnabled: true
        };

        res.status(200).json({
            success: true,
            data: {
                selectedPatient,
                recentPatients: recentPatientsResult.rows,
                notifications,
                quickStats,
                userPreferences
            },
            message: 'Dashboard context retrieved successfully'
        });

    } catch (error) {
        console.error('Dashboard context error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve dashboard context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/dashboard/context/patient
 * @desc Set patient context for dashboard
 * @access Private
 */
router.post('/context/patient', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { patientId, sessionId, contextData = {} } = req.body;
        const userId = req.user.id_usuario;

        // Validate input
        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID is required'
            });
        }

        // Verify patient exists and is active
        const patientCheck = await query(
            'SELECT id, nombre, apellido FROM PACIENTES WHERE id = $1 AND activo = TRUE',
            [patientId]
        );

        if (patientCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found or inactive'
            });
        }

        const patient = patientCheck.rows[0];

        // Use transaction to ensure consistency
        await transaction(async (client) => {
            // Insert or update patient context
            const upsertQuery = `
                INSERT INTO patient_context (user_id, patient_id, session_id, context_data, last_accessed)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, patient_id) 
                DO UPDATE SET 
                    session_id = EXCLUDED.session_id,
                    context_data = EXCLUDED.context_data,
                    last_accessed = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const result = await client.query(upsertQuery, [
                userId,
                patientId,
                sessionId || `session_${Date.now()}`,
                JSON.stringify(contextData)
            ]);

            return result.rows[0];
        });

        res.status(200).json({
            success: true,
            data: {
                patientId,
                patientName: `${patient.nombre} ${patient.apellido}`,
                contextSet: true,
                timestamp: new Date().toISOString()
            },
            message: 'Patient context set successfully'
        });

    } catch (error) {
        console.error('Set patient context error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set patient context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route DELETE /api/v1/dashboard/context/patient
 * @desc Clear patient context for dashboard
 * @access Private
 */
router.delete('/context/patient', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        // Clear current patient context (soft delete by updating last_accessed to old date)
        await query(
            'UPDATE patient_context SET last_accessed = $1 WHERE user_id = $2',
            [new Date('2000-01-01'), userId]
        );

        res.status(200).json({
            success: true,
            message: 'Patient context cleared successfully'
        });

    } catch (error) {
        console.error('Clear patient context error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear patient context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/dashboard/stats
 * @desc Get dashboard statistics
 * @access Private
 */
router.get('/stats', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;

        // Demo mode - return mock data
        if (process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true') {
            const mockStats = {
                active_patients: 3,
                appointments_today: 2,
                appointments_week: 8,
                total_files: 15,
                user_notes: 5,
                ai_interactions_today: 3,
                avg_appointment_duration: 45.5,
                recent_activity: [
                    {
                        id: 1,
                        activity_type: 'patient_created',
                        description: 'Nuevo paciente registrado: Juan Pérez',
                        activity_date: new Date().toISOString()
                    },
                    {
                        id: 2,
                        activity_type: 'appointment_scheduled',
                        description: 'Cita programada para María López',
                        activity_date: new Date(Date.now() - 3600000).toISOString()
                    }
                ],
                generated_at: new Date().toISOString()
            };

            return res.status(200).json({
                success: true,
                data: mockStats,
                cached: false,
                message: 'Dashboard statistics generated successfully (demo mode)'
            });
        }

        // Check cache first
        const cacheQuery = `
            SELECT stat_data, expires_at
            FROM dashboard_stats_cache 
            WHERE user_id = $1 AND stat_type = 'dashboard_summary' AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const cacheResult = await query(cacheQuery, [userId]);

        if (cacheResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                data: cacheResult.rows[0].stat_data,
                cached: true,
                message: 'Dashboard statistics retrieved from cache'
            });
        }

        // Generate fresh statistics
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM PACIENTES WHERE activo = TRUE) as active_patients,
                (SELECT COUNT(*) FROM CITAS WHERE fecha_hora::date = CURRENT_DATE) as appointments_today,
                (SELECT COUNT(*) FROM CITAS WHERE fecha_hora >= CURRENT_TIMESTAMP AND fecha_hora < CURRENT_TIMESTAMP + INTERVAL '7 days') as appointments_week,
                (SELECT COUNT(*) FROM file_metadata WHERE is_active = TRUE) as total_files,
                (SELECT COUNT(*) FROM user_notes WHERE user_id = $1) as user_notes,
                (SELECT COUNT(*) FROM ai_conversations WHERE user_id = $1 AND created_at::date = CURRENT_DATE) as ai_interactions_today,
                (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 2) FROM CITAS WHERE estado = 'COMPLETADA' AND fecha_hora >= CURRENT_DATE - INTERVAL '30 days') as avg_appointment_duration
        `;

        const statsResult = await query(statsQuery, [userId]);
        const stats = statsResult.rows[0];

        // Get recent activity
        const activityQuery = `
            SELECT * FROM recent_dashboard_activity LIMIT 10
        `;

        const activityResult = await query(activityQuery);

        const dashboardData = {
            ...stats,
            recent_activity: activityResult.rows,
            generated_at: new Date().toISOString()
        };

        // Cache the results for 5 minutes
        const cacheInsertQuery = `
            INSERT INTO dashboard_stats_cache (user_id, stat_type, stat_data, expires_at)
            VALUES ($1, 'dashboard_summary', $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes')
        `;

        await query(cacheInsertQuery, [userId, JSON.stringify(dashboardData)]);

        res.status(200).json({
            success: true,
            data: dashboardData,
            cached: false,
            message: 'Dashboard statistics generated successfully'
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve dashboard statistics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/dashboard/recent-activity
 * @desc Get recent dashboard activity
 * @access Private
 */
router.get('/recent-activity', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const activityQuery = `
            SELECT * FROM recent_dashboard_activity 
            ORDER BY activity_date DESC 
            LIMIT $1
        `;

        const result = await query(activityQuery, [parseInt(limit)]);

        res.status(200).json({
            success: true,
            data: result.rows,
            message: 'Recent activity retrieved successfully'
        });

    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve recent activity',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/dashboard/cleanup
 * @desc Clean up old dashboard data
 * @access Private (Admin only)
 */
router.post('/cleanup', authMiddleware.authenticateToken, authMiddleware.requireRole([1]), async (req, res) => {
    try {
        // Clean old AI conversations
        const aiCleanupResult = await query('SELECT cleanup_old_ai_conversations()');
        const aiDeleted = aiCleanupResult.rows[0].cleanup_old_ai_conversations;

        // Clean expired cache
        const cacheCleanupResult = await query('SELECT cleanup_expired_dashboard_cache()');
        const cacheDeleted = cacheCleanupResult.rows[0].cleanup_expired_dashboard_cache;

        res.status(200).json({
            success: true,
            data: {
                ai_conversations_deleted: aiDeleted,
                cache_entries_deleted: cacheDeleted,
                cleanup_date: new Date().toISOString()
            },
            message: 'Dashboard cleanup completed successfully'
        });

    } catch (error) {
        console.error('Dashboard cleanup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup dashboard data',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/dashboard/export
 * @desc Export dashboard data
 * @access Private
 */
router.post('/export', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { dataType, format = 'csv', filters = {} } = req.body;
        const userId = req.user.id_usuario;

        // Import export service
        const exportService = require('../services/exportService');

        // Validate request
        const validation = exportService.validateExportRequest(dataType, format, filters);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }

        let exportResult;

        // Export based on data type
        switch (dataType) {
            case 'patients':
                exportResult = await exportService.exportPatients(filters, format, userId);
                break;
            case 'clinical_history':
                exportResult = await exportService.exportClinicalHistory(filters, format, userId);
                break;
            case 'appointments':
                exportResult = await exportService.exportAppointments(filters, format, userId);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unsupported data type: ${dataType}`
                });
        }

        // Set appropriate headers for file download
        res.setHeader('Content-Type', exportResult.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.setHeader('Content-Length', exportResult.size);

        // Send the file content
        res.status(200).send(exportResult.content);

    } catch (error) {
        console.error('Dashboard export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/v1/dashboard/export/stats
 * @desc Get export statistics for user
 * @access Private
 */
router.get('/export/stats', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id_usuario;
        const { dateFrom, dateTo } = req.query;

        const exportService = require('../services/exportService');
        const stats = await exportService.getExportStats(userId, dateFrom, dateTo);

        res.status(200).json({
            success: true,
            data: stats.data,
            summary: stats.summary,
            message: 'Export statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Get export stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve export statistics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route POST /api/v1/dashboard/bulk-actions
 * @desc Perform bulk actions on selected records
 * @access Private
 */
router.post('/bulk-actions', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { action, dataType, selectedIds, filters = {} } = req.body;
        const userId = req.user.id_usuario;

        // Validate input
        if (!action || !dataType) {
            return res.status(400).json({
                success: false,
                error: 'Action and data type are required'
            });
        }

        if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Selected IDs array is required and cannot be empty'
            });
        }

        if (selectedIds.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Cannot perform bulk actions on more than 100 records at once'
            });
        }

        let result;

        switch (dataType) {
            case 'patients':
                result = await performBulkPatientActions(action, selectedIds, userId);
                break;
            case 'clinical_history':
                result = await performBulkClinicalHistoryActions(action, selectedIds, userId);
                break;
            case 'appointments':
                result = await performBulkAppointmentActions(action, selectedIds, userId);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unsupported data type: ${dataType}`
                });
        }

        res.status(200).json({
            success: true,
            data: result,
            message: `Bulk ${action} completed successfully`
        });

    } catch (error) {
        console.error('Bulk actions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform bulk actions',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Helper function for bulk patient actions
 */
async function performBulkPatientActions(action, selectedIds, userId) {
    const placeholders = selectedIds.map((_, index) => `$${index + 2}`).join(',');

    switch (action) {
        case 'archive':
        case 'delete':
            const archiveQuery = `
                UPDATE PACIENTES 
                SET activo = FALSE, modificado_por = $1, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders}) AND activo = TRUE
                RETURNING id, nombre, apellido
            `;
            const { rows } = await query(archiveQuery, [userId, ...selectedIds]);

            // Log bulk action
            await query(`
                INSERT INTO LOGS_AUDITORIA (
                    tabla_afectada, tipo_operacion, id_usuario_autor, fecha_hora, detalles
                ) VALUES ($1, $2, $3, NOW(), $4)
            `, [
                'PACIENTES',
                'BULK_ARCHIVE',
                userId,
                JSON.stringify({
                    action: 'bulk_archive_patients',
                    affectedIds: selectedIds,
                    archivedCount: rows.length
                })
            ]);

            return {
                action: 'archive',
                requested: selectedIds.length,
                processed: rows.length,
                affectedRecords: rows.map(r => ({ id: r.id, name: `${r.nombre} ${r.apellido}` }))
            };

        case 'activate':
            const activateQuery = `
                UPDATE PACIENTES 
                SET activo = TRUE, modificado_por = $1, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders}) AND activo = FALSE
                RETURNING id, nombre, apellido
            `;
            const { rows: activatedRows } = await query(activateQuery, [userId, ...selectedIds]);

            return {
                action: 'activate',
                requested: selectedIds.length,
                processed: activatedRows.length,
                affectedRecords: activatedRows.map(r => ({ id: r.id, name: `${r.nombre} ${r.apellido}` }))
            };

        default:
            throw new Error(`Unsupported action: ${action}`);
    }
}

/**
 * Helper function for bulk clinical history actions
 */
async function performBulkClinicalHistoryActions(action, selectedIds, userId) {
    const placeholders = selectedIds.map((_, index) => `$${index + 2}`).join(',');

    switch (action) {
        case 'archive':
        case 'delete':
            const archiveQuery = `
                UPDATE HISTORIAL_CLINICO 
                SET activo = FALSE, modificado_por = $1, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders}) AND activo = TRUE
                RETURNING id, fecha_hora, diagnostico_principal
            `;
            const { rows } = await query(archiveQuery, [userId, ...selectedIds]);

            return {
                action: 'archive',
                requested: selectedIds.length,
                processed: rows.length,
                affectedRecords: rows.map(r => ({
                    id: r.id,
                    date: r.fecha_hora,
                    diagnosis: r.diagnostico_principal
                }))
            };

        default:
            throw new Error(`Unsupported action: ${action}`);
    }
}

/**
 * Helper function for bulk appointment actions
 */
async function performBulkAppointmentActions(action, selectedIds, userId) {
    const placeholders = selectedIds.map((_, index) => `$${index + 2}`).join(',');

    switch (action) {
        case 'cancel':
            const cancelQuery = `
                UPDATE CITAS 
                SET estado = 'CANCELADA', modificado_por = $1, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders}) AND estado != 'CANCELADA'
                RETURNING id, numero_cita, fecha_hora
            `;
            const { rows } = await query(cancelQuery, [userId, ...selectedIds]);

            return {
                action: 'cancel',
                requested: selectedIds.length,
                processed: rows.length,
                affectedRecords: rows.map(r => ({
                    id: r.id,
                    number: r.numero_cita,
                    date: r.fecha_hora
                }))
            };

        case 'archive':
        case 'delete':
            const archiveQuery = `
                UPDATE CITAS 
                SET activo = FALSE, modificado_por = $1, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders}) AND activo = TRUE
                RETURNING id, numero_cita, fecha_hora
            `;
            const { rows: archivedRows } = await query(archiveQuery, [userId, ...selectedIds]);

            return {
                action: 'archive',
                requested: selectedIds.length,
                processed: archivedRows.length,
                affectedRecords: archivedRows.map(r => ({
                    id: r.id,
                    number: r.numero_cita,
                    date: r.fecha_hora
                }))
            };

        default:
            throw new Error(`Unsupported action: ${action}`);
    }
}

module.exports = router;