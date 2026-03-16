/**
 * EcoDigital - Dashboard Principal Database Schema
 * PostgreSQL schema for Dashboard Principal functionality
 * 
 * Tables:
 * - patient_context: Patient selection context management
 * - user_notes: User personal notes with optional patient attachment
 * - ai_conversations: AI assistant conversation history
 * - file_metadata: Enhanced file metadata for visual viewer
 */
-- =====================================================
-- Patient Context Management
-- =====================================================
CREATE TABLE IF NOT EXISTS patient_context (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES PACIENTES(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context_data JSONB DEFAULT '{}',
    session_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes for patient context
CREATE INDEX IF NOT EXISTS idx_patient_context_user_session ON patient_context(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_patient_context_patient ON patient_context(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_context_last_accessed ON patient_context(last_accessed DESC);
-- =====================================================
-- User Notes Management
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE NOT NULL,
    patient_id INTEGER REFERENCES PACIENTES(id) ON DELETE
    SET NULL,
        content TEXT NOT NULL,
        is_private BOOLEAN DEFAULT TRUE,
        tags VARCHAR(255) [] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes for user notes
CREATE INDEX IF NOT EXISTS idx_user_notes_user_patient ON user_notes(user_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_created ON user_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notes_tags ON user_notes USING GIN(tags);
-- =====================================================
-- AI Assistant Conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(20) CHECK (message_type IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    context_data JSONB DEFAULT '{}',
    actions_executed JSONB DEFAULT '[]',
    confidence_score DECIMAL(3, 2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes for AI conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_session ON ai_conversations(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_created ON ai_conversations(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created ON ai_conversations(user_id, created_at DESC);
-- =====================================================
-- Enhanced File Metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS file_metadata (
    id SERIAL PRIMARY KEY,
    file_id VARCHAR(255) NOT NULL UNIQUE,
    patient_id INTEGER REFERENCES PACIENTES(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    source_type VARCHAR(50) CHECK (
        source_type IN ('cloud_drive', 'local', 'dicom', 'upload')
    ) DEFAULT 'local',
    thumbnail_url TEXT,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    file_path TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes for file metadata
CREATE INDEX IF NOT EXISTS idx_file_metadata_patient_type ON file_metadata(patient_id, file_type);
CREATE INDEX IF NOT EXISTS idx_file_metadata_source_type ON file_metadata(source_type);
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_active_created ON file_metadata(is_active, created_at DESC);
-- =====================================================
-- Dashboard Statistics Cache
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_stats_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE,
    stat_type VARCHAR(50) NOT NULL,
    stat_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Indexes for dashboard stats cache
CREATE INDEX IF NOT EXISTS idx_dashboard_stats_user_type ON dashboard_stats_cache(user_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_stats_expires ON dashboard_stats_cache(expires_at);
-- =====================================================
-- Triggers for Updated At
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_patient_context_updated_at ON patient_context;
CREATE TRIGGER update_patient_context_updated_at BEFORE
UPDATE ON patient_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
CREATE TRIGGER update_user_notes_updated_at BEFORE
UPDATE ON user_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_file_metadata_updated_at ON file_metadata;
CREATE TRIGGER update_file_metadata_updated_at BEFORE
UPDATE ON file_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- Dashboard Permissions
-- =====================================================
-- Insert dashboard-specific permissions if they don't exist
INSERT INTO PERMISOS (nombre_permiso, descripcion)
VALUES (
        'dashboard_access',
        'Acceso al dashboard principal'
    ),
    ('notes_manage', 'Gestionar notas personales'),
    ('ai_assistant_use', 'Usar asistente virtual'),
    (
        'file_viewer_access',
        'Acceso al visor de archivos'
    ),
    (
        'patient_context_manage',
        'Gestionar contexto de pacientes'
    ) ON CONFLICT (nombre_permiso) DO NOTHING;
-- Grant dashboard permissions to existing roles
DO $$
DECLARE admin_role_id INTEGER;
medico_role_id INTEGER;
asistente_role_id INTEGER;
permission_ids INTEGER [];
BEGIN -- Get role IDs
SELECT id_role INTO admin_role_id
FROM ROLES
WHERE nombre_role = 'ADMIN'
LIMIT 1;
SELECT id_role INTO medico_role_id
FROM ROLES
WHERE nombre_role = 'MEDICO'
LIMIT 1;
SELECT id_role INTO asistente_role_id
FROM ROLES
WHERE nombre_role = 'ASISTENTE'
LIMIT 1;
-- Get permission IDs
SELECT ARRAY_AGG(id_permiso) INTO permission_ids
FROM PERMISOS
WHERE nombre_permiso IN (
        'dashboard_access',
        'notes_manage',
        'ai_assistant_use',
        'file_viewer_access',
        'patient_context_manage'
    );
-- Grant all dashboard permissions to ADMIN
IF admin_role_id IS NOT NULL THEN
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT admin_role_id,
    unnest(permission_ids) ON CONFLICT (id_role, id_permiso) DO NOTHING;
END IF;
-- Grant most permissions to MEDICO (except patient_context_manage)
IF medico_role_id IS NOT NULL THEN
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT medico_role_id,
    id_permiso
FROM PERMISOS
WHERE nombre_permiso IN (
        'dashboard_access',
        'notes_manage',
        'ai_assistant_use',
        'file_viewer_access'
    ) ON CONFLICT (id_role, id_permiso) DO NOTHING;
END IF;
-- Grant basic permissions to ASISTENTE
IF asistente_role_id IS NOT NULL THEN
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT asistente_role_id,
    id_permiso
FROM PERMISOS
WHERE nombre_permiso IN (
        'dashboard_access',
        'notes_manage',
        'file_viewer_access'
    ) ON CONFLICT (id_role, id_permiso) DO NOTHING;
END IF;
END $$;
-- =====================================================
-- Sample Data for Development
-- =====================================================
-- Insert sample file metadata (only in development)
DO $$ BEGIN IF current_setting('server_version_num')::int >= 120000
AND EXISTS (
    SELECT 1
    FROM PACIENTES
    LIMIT 1
) THEN
INSERT INTO file_metadata (
        file_id,
        patient_id,
        file_name,
        file_type,
        source_type,
        mime_type,
        file_size,
        metadata
    )
SELECT 'sample_' || p.id || '_' || generate_random_uuid()::text,
    p.id,
    'Radiografia_' || p.nombre || '_' || EXTRACT(
        YEAR
        FROM CURRENT_DATE
    ) || '.jpg',
    'image',
    'local',
    'image/jpeg',
    1024000 + (random() * 5000000)::bigint,
    jsonb_build_object(
        'description',
        'Radiografía de control',
        'date_taken',
        CURRENT_DATE - (random() * 365)::int,
        'equipment',
        'Digital X-Ray System'
    )
FROM PACIENTES p
WHERE p.activo = TRUE
LIMIT 5 ON CONFLICT (file_id) DO NOTHING;
END IF;
END $$;
-- =====================================================
-- Views for Dashboard Analytics
-- =====================================================
-- Dashboard summary view
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT (
        SELECT COUNT(*)
        FROM PACIENTES
        WHERE activo = TRUE
    ) as active_patients,
    (
        SELECT COUNT(*)
        FROM CITAS
        WHERE fecha_hora::date = CURRENT_DATE
    ) as appointments_today,
    (
        SELECT COUNT(*)
        FROM file_metadata
        WHERE is_active = TRUE
    ) as total_files,
    (
        SELECT COUNT(*)
        FROM user_notes
        WHERE created_at::date = CURRENT_DATE
    ) as notes_today;
-- Recent activity view
CREATE OR REPLACE VIEW recent_dashboard_activity AS
SELECT 'patient' as activity_type,
    p.id as entity_id,
    CONCAT(p.nombre, ' ', p.apellido) as entity_name,
    p.fecha_registro as activity_date,
    'Nuevo paciente registrado' as description
FROM PACIENTES p
WHERE p.fecha_registro >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 'appointment' as activity_type,
    c.id as entity_id,
    CONCAT('Cita con ', p.nombre, ' ', p.apellido) as entity_name,
    c.fecha_hora as activity_date,
    'Cita programada' as description
FROM CITAS c
    JOIN PACIENTES p ON c.id_paciente = p.id
WHERE c.fecha_hora >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 'file' as activity_type,
    fm.id as entity_id,
    fm.file_name as entity_name,
    fm.created_at as activity_date,
    'Archivo subido' as description
FROM file_metadata fm
WHERE fm.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY activity_date DESC
LIMIT 20;
-- =====================================================
-- Cleanup Functions
-- =====================================================
-- Function to clean old AI conversations (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_ai_conversations() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM ai_conversations
WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
-- Function to clean expired dashboard stats cache
CREATE OR REPLACE FUNCTION cleanup_expired_dashboard_cache() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM dashboard_stats_cache
WHERE expires_at < CURRENT_TIMESTAMP;
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- Comments for Documentation
-- =====================================================
COMMENT ON TABLE patient_context IS 'Stores patient selection context for dashboard sessions';
COMMENT ON TABLE user_notes IS 'Personal notes for users with optional patient attachment';
COMMENT ON TABLE ai_conversations IS 'AI assistant conversation history and context';
COMMENT ON TABLE file_metadata IS 'Enhanced metadata for files in the visual viewer';
COMMENT ON TABLE dashboard_stats_cache IS 'Cached dashboard statistics for performance';
COMMENT ON COLUMN patient_context.context_data IS 'JSON data containing additional context information';
COMMENT ON COLUMN user_notes.tags IS 'Array of tags for note categorization';
COMMENT ON COLUMN ai_conversations.actions_executed IS 'JSON array of actions executed by the assistant';
COMMENT ON COLUMN file_metadata.metadata IS 'JSON metadata specific to file type (DICOM, image properties, etc.)';
-- =====================================================
-- Grant Permissions
-- =====================================================
-- Grant permissions to application user
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON patient_context TO ecodigital_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON user_notes TO ecodigital_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON ai_conversations TO ecodigital_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON file_metadata TO ecodigital_app;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON dashboard_stats_cache TO ecodigital_app;
-- Grant sequence permissions
GRANT USAGE,
    SELECT ON SEQUENCE patient_context_id_seq TO ecodigital_app;
GRANT USAGE,
    SELECT ON SEQUENCE user_notes_id_seq TO ecodigital_app;
GRANT USAGE,
    SELECT ON SEQUENCE ai_conversations_id_seq TO ecodigital_app;
GRANT USAGE,
    SELECT ON SEQUENCE file_metadata_id_seq TO ecodigital_app;
GRANT USAGE,
    SELECT ON SEQUENCE dashboard_stats_cache_id_seq TO ecodigital_app;
-- Grant view permissions
GRANT SELECT ON dashboard_summary TO ecodigital_app;
GRANT SELECT ON recent_dashboard_activity TO ecodigital_app;
-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION cleanup_old_ai_conversations() TO ecodigital_app;
GRANT EXECUTE ON FUNCTION cleanup_expired_dashboard_cache() TO ecodigital_app;
-- =====================================================
-- Success Message
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Dashboard Principal schema created successfully!';
RAISE NOTICE 'Tables created: patient_context, user_notes, ai_conversations, file_metadata, dashboard_stats_cache';
RAISE NOTICE 'Views created: dashboard_summary, recent_dashboard_activity';
RAISE NOTICE 'Functions created: cleanup_old_ai_conversations, cleanup_expired_dashboard_cache';
END $$;