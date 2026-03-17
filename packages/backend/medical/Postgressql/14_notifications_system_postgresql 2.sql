/**
 * EcoDigital - Notifications System Database Schema
 * PostgreSQL schema for notification system functionality
 * 
 * Tables:
 * - notifications: System notifications and alerts
 * - notification_preferences: User notification preferences
 */

-- =====================================================
-- Notifications Table
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'appointment_reminder',
            'appointment_cancelled', 
            'patient_update',
            'system_alert',
            'file_uploaded',
            'export_ready',
            'ai_response'
        )
    ),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (
        priority IN ('low', 'medium', 'high', 'urgent')
    ),
    action_url TEXT,
    action_data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    send_email BOOLEAN DEFAULT FALSE,
    send_sms BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Notification Preferences Table
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    appointment_reminders BOOLEAN DEFAULT TRUE,
    appointment_changes BOOLEAN DEFAULT TRUE,
    patient_updates BOOLEAN DEFAULT TRUE,
    system_alerts BOOLEAN DEFAULT TRUE,
    file_uploads BOOLEAN DEFAULT TRUE,
    export_notifications BOOLEAN DEFAULT TRUE,
    ai_responses BOOLEAN DEFAULT TRUE,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'America/Santo_Domingo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_unread ON notifications(user_id, type, is_read);

-- Notification preferences indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- =====================================================
-- Triggers for Updated At
-- =====================================================

-- Trigger for notifications updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for notification_preferences updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Default Notification Preferences
-- =====================================================

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id_usuario)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default preferences when user is created
DROP TRIGGER IF EXISTS create_user_notification_preferences ON USUARIOS;
CREATE TRIGGER create_user_notification_preferences
    AFTER INSERT ON USUARIOS
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- =====================================================
-- Notification Statistics View
-- =====================================================

CREATE OR REPLACE VIEW notification_stats AS
SELECT 
    u.id_usuario,
    u.nombre as user_name,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.is_read = FALSE THEN 1 END) as unread_notifications,
    COUNT(CASE WHEN n.priority = 'urgent' AND n.is_read = FALSE THEN 1 END) as urgent_unread,
    COUNT(CASE WHEN n.priority = 'high' AND n.is_read = FALSE THEN 1 END) as high_unread,
    COUNT(CASE WHEN n.created_at >= CURRENT_DATE THEN 1 END) as today_notifications,
    COUNT(CASE WHEN n.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_notifications,
    MAX(n.created_at) as last_notification
FROM USUARIOS u
LEFT JOIN notifications n ON u.id_usuario = n.user_id 
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
WHERE u.activo = TRUE
GROUP BY u.id_usuario, u.nombre;

-- =====================================================
-- Notification Cleanup Functions
-- =====================================================

-- Function to clean up old read notifications (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE is_read = TRUE 
    AND read_at < CURRENT_DATE - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get notification summary for dashboard
CREATE OR REPLACE FUNCTION get_notification_summary(p_user_id INTEGER)
RETURNS TABLE(
    total_count BIGINT,
    unread_count BIGINT,
    urgent_count BIGINT,
    high_count BIGINT,
    today_count BIGINT,
    types_summary JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN n.is_read = FALSE THEN 1 END) as unread_count,
        COUNT(CASE WHEN n.priority = 'urgent' AND n.is_read = FALSE THEN 1 END) as urgent_count,
        COUNT(CASE WHEN n.priority = 'high' AND n.is_read = FALSE THEN 1 END) as high_count,
        COUNT(CASE WHEN n.created_at >= CURRENT_DATE THEN 1 END) as today_count,
        jsonb_object_agg(
            n.type, 
            COUNT(CASE WHEN n.is_read = FALSE THEN 1 END)
        ) FILTER (WHERE n.type IS NOT NULL) as types_summary
    FROM notifications n
    WHERE n.user_id = p_user_id
    AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample Notification Types Data
-- =====================================================

-- Insert notification-specific permissions if they don't exist
INSERT INTO PERMISOS (nombre_permiso, descripcion)
VALUES 
    ('notifications_view', 'Ver notificaciones'),
    ('notifications_manage', 'Gestionar notificaciones'),
    ('notifications_create', 'Crear notificaciones del sistema'),
    ('notifications_admin', 'Administrar sistema de notificaciones')
ON CONFLICT (nombre_permiso) DO NOTHING;

-- Grant notification permissions to existing roles
DO $$
DECLARE 
    admin_role_id INTEGER;
    medico_role_id INTEGER;
    asistente_role_id INTEGER;
BEGIN
    -- Get role IDs
    SELECT id_role INTO admin_role_id FROM ROLES WHERE nombre_role = 'ADMIN' LIMIT 1;
    SELECT id_role INTO medico_role_id FROM ROLES WHERE nombre_role = 'MEDICO' LIMIT 1;
    SELECT id_role INTO asistente_role_id FROM ROLES WHERE nombre_role = 'ASISTENTE' LIMIT 1;

    -- Grant all notification permissions to ADMIN
    IF admin_role_id IS NOT NULL THEN
        INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
        SELECT admin_role_id, id_permiso
        FROM PERMISOS 
        WHERE nombre_permiso LIKE 'notifications_%'
        ON CONFLICT (id_role, id_permiso) DO NOTHING;
    END IF;

    -- Grant view and basic permissions to MEDICO
    IF medico_role_id IS NOT NULL THEN
        INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
        SELECT medico_role_id, id_permiso
        FROM PERMISOS 
        WHERE nombre_permiso IN ('notifications_view', 'notifications_manage')
        ON CONFLICT (id_role, id_permiso) DO NOTHING;
    END IF;

    -- Grant view permission to ASISTENTE
    IF asistente_role_id IS NOT NULL THEN
        INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
        SELECT asistente_role_id, id_permiso
        FROM PERMISOS 
        WHERE nombre_permiso = 'notifications_view'
        ON CONFLICT (id_role, id_permiso) DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- Grant Permissions to Application User
-- =====================================================

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO ecodigital_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO ecodigital_app;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE notifications_id_seq TO ecodigital_app;
GRANT USAGE, SELECT ON SEQUENCE notification_preferences_id_seq TO ecodigital_app;

-- Grant view permissions
GRANT SELECT ON notification_stats TO ecodigital_app;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO ecodigital_app;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications() TO ecodigital_app;
GRANT EXECUTE ON FUNCTION get_notification_summary(INTEGER) TO ecodigital_app;
GRANT EXECUTE ON FUNCTION create_default_notification_preferences() TO ecodigital_app;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE notifications IS 'System notifications and alerts for users';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification delivery';

COMMENT ON COLUMN notifications.type IS 'Type of notification (appointment_reminder, system_alert, etc.)';
COMMENT ON COLUMN notifications.priority IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN notifications.action_url IS 'URL to navigate when notification is clicked';
COMMENT ON COLUMN notifications.action_data IS 'JSON data for notification actions';
COMMENT ON COLUMN notifications.expires_at IS 'When notification should expire (optional)';

COMMENT ON COLUMN notification_preferences.quiet_hours_start IS 'Start time for quiet hours (no notifications)';
COMMENT ON COLUMN notification_preferences.quiet_hours_end IS 'End time for quiet hours';
COMMENT ON COLUMN notification_preferences.timezone IS 'User timezone for notification scheduling';

-- =====================================================
-- Success Message
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Notifications System Schema Created Successfully!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Tables created: notifications, notification_preferences';
    RAISE NOTICE 'Views created: notification_stats';
    RAISE NOTICE 'Functions created: cleanup functions, notification summary';
    RAISE NOTICE 'Triggers created: auto-create preferences, updated_at triggers';
    RAISE NOTICE 'Permissions granted to roles and application user';
    RAISE NOTICE '==============================================';
END $$;