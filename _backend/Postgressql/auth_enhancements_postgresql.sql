-- =====================================================
-- EcoSecial - Authentication Enhancements
-- Additional tables for enhanced authentication features
-- Version: 1.0
-- Author: Sistema EcoSecial
-- Date: 2024
-- =====================================================

-- Set PostgreSQL encoding
SET client_encoding = 'UTF8';

-- =====================================================
-- TABLE: REFRESH_TOKENS
-- Description: Refresh tokens for JWT authentication
-- =====================================================
CREATE TABLE IF NOT EXISTS REFRESH_TOKENS (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one active refresh token per user
    CONSTRAINT unique_user_refresh_token UNIQUE (id_usuario)
);

-- Create indexes for REFRESH_TOKENS
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON REFRESH_TOKENS(id_usuario);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON REFRESH_TOKENS(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON REFRESH_TOKENS(expires_at);

-- =====================================================
-- TABLE: PASSWORD_RESET_TOKENS
-- Description: Password reset tokens for forgot password functionality
-- =====================================================
CREATE TABLE IF NOT EXISTS PASSWORD_RESET_TOKENS (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL,
    
    -- Ensure only one active reset token per user
    CONSTRAINT unique_user_reset_token UNIQUE (id_usuario)
);

-- Create indexes for PASSWORD_RESET_TOKENS
CREATE INDEX IF NOT EXISTS idx_password_reset_usuario ON PASSWORD_RESET_TOKENS(id_usuario);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON PASSWORD_RESET_TOKENS(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON PASSWORD_RESET_TOKENS(expires_at);

-- =====================================================
-- Update existing USUARIOS table to match auth routes expectations
-- =====================================================

-- Add columns if they don't exist (for compatibility with existing auth routes)
DO $$ 
BEGIN
    -- Add id_usuario column if it doesn't exist (alias for id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'id_usuario') THEN
        ALTER TABLE USUARIOS ADD COLUMN id_usuario INTEGER;
        UPDATE USUARIOS SET id_usuario = id;
        ALTER TABLE USUARIOS ALTER COLUMN id_usuario SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_id_usuario ON USUARIOS(id_usuario);
    END IF;

    -- Add nombre column if it doesn't exist (alias for username)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'nombre') THEN
        ALTER TABLE USUARIOS ADD COLUMN nombre VARCHAR(50);
        UPDATE USUARIOS SET nombre = username;
        ALTER TABLE USUARIOS ALTER COLUMN nombre SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nombre ON USUARIOS(nombre);
    END IF;

    -- Add hash_password column if it doesn't exist (alias for password_hash)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'hash_password') THEN
        ALTER TABLE USUARIOS ADD COLUMN hash_password VARCHAR(255);
        UPDATE USUARIOS SET hash_password = password_hash;
        ALTER TABLE USUARIOS ALTER COLUMN hash_password SET NOT NULL;
    END IF;

    -- Add id_role column if it doesn't exist (alias for rol_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'id_role') THEN
        ALTER TABLE USUARIOS ADD COLUMN id_role INTEGER;
        UPDATE USUARIOS SET id_role = rol_id;
        ALTER TABLE USUARIOS ALTER COLUMN id_role SET NOT NULL;
    END IF;

    -- Add nombre_completo column if it doesn't exist (combination of nombres + apellidos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'nombre_completo') THEN
        ALTER TABLE USUARIOS ADD COLUMN nombre_completo VARCHAR(200);
        UPDATE USUARIOS SET nombre_completo = CONCAT(nombres, ' ', apellidos);
    END IF;

    -- Add activo column if it doesn't exist (alias for activo boolean)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'activo') THEN
        ALTER TABLE USUARIOS ADD COLUMN activo BOOLEAN DEFAULT TRUE;
        UPDATE USUARIOS SET activo = TRUE WHERE activo IS NULL;
    END IF;

    -- Add fecha_creacion column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'fecha_creacion') THEN
        ALTER TABLE USUARIOS ADD COLUMN fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        UPDATE USUARIOS SET fecha_creacion = COALESCE(fecha_creacion, CURRENT_TIMESTAMP);
    END IF;

    -- Add fecha_actualizacion column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'fecha_actualizacion') THEN
        ALTER TABLE USUARIOS ADD COLUMN fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        UPDATE USUARIOS SET fecha_actualizacion = COALESCE(fecha_modificacion, CURRENT_TIMESTAMP);
    END IF;

    -- Add telefono column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'telefono') THEN
        ALTER TABLE USUARIOS ADD COLUMN telefono VARCHAR(20);
    END IF;
END $$;

-- =====================================================
-- Update existing ROLES table to match auth routes expectations
-- =====================================================

DO $$ 
BEGIN
    -- Add id_role column if it doesn't exist (alias for id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'id_role') THEN
        ALTER TABLE ROLES ADD COLUMN id_role INTEGER;
        UPDATE ROLES SET id_role = id;
        ALTER TABLE ROLES ALTER COLUMN id_role SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_id_role ON ROLES(id_role);
    END IF;

    -- Add nombre_role column if it doesn't exist (alias for nombre)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'nombre_role') THEN
        ALTER TABLE ROLES ADD COLUMN nombre_role VARCHAR(50);
        UPDATE ROLES SET nombre_role = nombre;
        ALTER TABLE ROLES ALTER COLUMN nombre_role SET NOT NULL;
    END IF;
END $$;

-- =====================================================
-- Create PERMISOS table if it doesn't exist
-- =====================================================
CREATE TABLE IF NOT EXISTS PERMISOS (
    id_permiso SERIAL PRIMARY KEY,
    nombre_permiso VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    modulo VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Create ROLES_PERMISOS table if it doesn't exist
-- =====================================================
CREATE TABLE IF NOT EXISTS ROLES_PERMISOS (
    id SERIAL PRIMARY KEY,
    id_role INTEGER NOT NULL,
    id_permiso INTEGER NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_role_permission UNIQUE (id_role, id_permiso)
);

-- Create indexes for ROLES_PERMISOS
CREATE INDEX IF NOT EXISTS idx_roles_permisos_role ON ROLES_PERMISOS(id_role);
CREATE INDEX IF NOT EXISTS idx_roles_permisos_permiso ON ROLES_PERMISOS(id_permiso);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- REFRESH_TOKENS
ALTER TABLE REFRESH_TOKENS 
ADD CONSTRAINT fk_refresh_tokens_usuario 
FOREIGN KEY (id_usuario) REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE;

-- PASSWORD_RESET_TOKENS
ALTER TABLE PASSWORD_RESET_TOKENS 
ADD CONSTRAINT fk_password_reset_usuario 
FOREIGN KEY (id_usuario) REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE;

-- ROLES_PERMISOS
ALTER TABLE ROLES_PERMISOS 
ADD CONSTRAINT fk_roles_permisos_role 
FOREIGN KEY (id_role) REFERENCES ROLES(id_role) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE ROLES_PERMISOS 
ADD CONSTRAINT fk_roles_permisos_permiso 
FOREIGN KEY (id_permiso) REFERENCES PERMISOS(id_permiso) ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean expired refresh tokens
    DELETE FROM REFRESH_TOKENS WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean expired password reset tokens
    DELETE FROM PASSWORD_RESET_TOKENS WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INSERT BASIC PERMISSIONS
-- =====================================================

-- Insert basic permissions if they don't exist
INSERT INTO PERMISOS (nombre_permiso, descripcion, modulo) VALUES
('users.create', 'Crear usuarios', 'users'),
('users.read', 'Ver usuarios', 'users'),
('users.update', 'Actualizar usuarios', 'users'),
('users.delete', 'Eliminar usuarios', 'users'),
('patients.create', 'Crear pacientes', 'patients'),
('patients.read', 'Ver pacientes', 'patients'),
('patients.update', 'Actualizar pacientes', 'patients'),
('patients.delete', 'Eliminar pacientes', 'patients'),
('appointments.create', 'Crear citas', 'appointments'),
('appointments.read', 'Ver citas', 'appointments'),
('appointments.update', 'Actualizar citas', 'appointments'),
('appointments.delete', 'Eliminar citas', 'appointments'),
('documents.create', 'Crear documentos', 'documents'),
('documents.read', 'Ver documentos', 'documents'),
('documents.update', 'Actualizar documentos', 'documents'),
('documents.delete', 'Eliminar documentos', 'documents'),
('audit.read', 'Ver auditoría', 'audit'),
('reports.read', 'Ver reportes', 'reports')
ON CONFLICT (nombre_permiso) DO NOTHING;

-- Assign permissions to roles
-- Admin Principal (id_role = 1) - All permissions
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT 1, id_permiso FROM PERMISOS
ON CONFLICT (id_role, id_permiso) DO NOTHING;

-- Admin Secundario (id_role = 2) - Most permissions except user management
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT 2, id_permiso FROM PERMISOS 
WHERE nombre_permiso NOT LIKE 'users.%'
ON CONFLICT (id_role, id_permiso) DO NOTHING;

-- Asistente (id_role = 3) - Basic operations
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT 3, id_permiso FROM PERMISOS 
WHERE nombre_permiso IN (
    'patients.create', 'patients.read', 'patients.update',
    'appointments.create', 'appointments.read', 'appointments.update',
    'documents.create', 'documents.read', 'documents.update'
)
ON CONFLICT (id_role, id_permiso) DO NOTHING;

-- Invitado (id_role = 4) - Read only
INSERT INTO ROLES_PERMISOS (id_role, id_permiso)
SELECT 4, id_permiso FROM PERMISOS 
WHERE nombre_permiso LIKE '%.read'
ON CONFLICT (id_role, id_permiso) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE REFRESH_TOKENS IS 'JWT refresh tokens for extended authentication sessions';
COMMENT ON TABLE PASSWORD_RESET_TOKENS IS 'Secure tokens for password reset functionality';
COMMENT ON TABLE PERMISOS IS 'System permissions for role-based access control';
COMMENT ON TABLE ROLES_PERMISOS IS 'Many-to-many relationship between roles and permissions';

-- =====================================================
-- FINAL NOTES
-- =====================================================
-- This enhancement script adds:
-- 1. Refresh token management for JWT authentication
-- 2. Password reset token system with secure hashing
-- 3. Enhanced role-based permission system
-- 4. Compatibility aliases for existing auth routes
-- 5. Cleanup functions for expired tokens
-- 6. Basic permissions and role assignments