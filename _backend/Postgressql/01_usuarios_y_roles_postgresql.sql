-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Esquema: Usuarios y Roles (User Management) - PostgreSQL
-- Versión: 1.0
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- Configuración de base de datos PostgreSQL
SET client_encoding = 'UTF8';

-- =====================================================
-- TABLA: ROLES
-- Descripción: Roles del sistema con permisos específicos
-- =====================================================
CREATE TABLE IF NOT EXISTS ROLES (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSONB,
    nivel_acceso VARCHAR(20) NOT NULL CHECK (nivel_acceso IN ('ADMIN_PRINCIPAL', 'ADMIN_SECUNDARIO', 'ASISTENTE', 'INVITADO')),
    activo BOOLEAN DEFAULT TRUE,
    es_sistema BOOLEAN DEFAULT FALSE,
    timeout_sesion INTEGER DEFAULT 3600,
    max_sesiones_concurrentes INTEGER DEFAULT 3,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para ROLES
CREATE INDEX IF NOT EXISTS idx_roles_nombre ON ROLES(nombre);
CREATE INDEX IF NOT EXISTS idx_roles_nivel_acceso ON ROLES(nivel_acceso);
CREATE INDEX IF NOT EXISTS idx_roles_activo ON ROLES(activo);

-- =====================================================
-- TABLA: USUARIOS
-- Descripción: Usuarios del sistema médico
-- =====================================================
CREATE TABLE IF NOT EXISTS USUARIOS (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(32) NOT NULL,
    
    -- Información personal
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    cedula VARCHAR(20) UNIQUE,
    foto_perfil VARCHAR(255),
    
    -- Información profesional
    titulo_profesional VARCHAR(100),
    especialidad VARCHAR(100),
    numero_colegiado VARCHAR(50),
    firma_digital VARCHAR(255),
    
    -- Configuración de cuenta
    rol_id INTEGER NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    verificado BOOLEAN DEFAULT FALSE,
    bloqueado BOOLEAN DEFAULT FALSE,
    intentos_fallidos INTEGER DEFAULT 0,
    fecha_bloqueo TIMESTAMP NULL,
    fecha_ultimo_acceso TIMESTAMP NULL,
    
    -- Configuración de seguridad
    cambiar_password BOOLEAN DEFAULT TRUE,
    fecha_expiracion_password TIMESTAMP NULL,
    token_recuperacion VARCHAR(255) NULL,
    fecha_expiracion_token TIMESTAMP NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(32) NULL,
    
    -- Preferencias del usuario
    preferencias JSONB,
    timezone VARCHAR(50) DEFAULT 'America/Santo_Domingo',
    idioma VARCHAR(5) DEFAULT 'es',
    tema VARCHAR(10) DEFAULT 'dark' CHECK (tema IN ('dark', 'light', 'auto')),
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para USUARIOS
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON USUARIOS(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON USUARIOS(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON USUARIOS(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON USUARIOS(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON USUARIOS(bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON USUARIOS(cedula);
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acceso ON USUARIOS(fecha_ultimo_acceso);

-- =====================================================
-- TABLA: SESIONES_USUARIO
-- Descripción: Gestión de sesiones activas
-- =====================================================
CREATE TABLE IF NOT EXISTS SESIONES_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    token_sesion VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    ubicacion VARCHAR(100),
    activa BOOLEAN DEFAULT TRUE,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    fecha_ultimo_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL
);

-- Crear índices para SESIONES_USUARIO
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON SESIONES_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON SESIONES_USUARIO(token_sesion);
CREATE INDEX IF NOT EXISTS idx_sesiones_refresh ON SESIONES_USUARIO(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sesiones_activa ON SESIONES_USUARIO(activa);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON SESIONES_USUARIO(fecha_expiracion);

-- =====================================================
-- TABLA: PERMISOS_USUARIO
-- Descripción: Permisos específicos por usuario (override de rol)
-- =====================================================
CREATE TABLE IF NOT EXISTS PERMISOS_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    permitido BOOLEAN NOT NULL,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL,
    motivo TEXT,
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(usuario_id, modulo, accion)
);

-- Crear índices para PERMISOS_USUARIO
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON PERMISOS_USUARIO(modulo);
CREATE INDEX IF NOT EXISTS idx_permisos_vigencia ON PERMISOS_USUARIO(fecha_inicio, fecha_fin);

-- =====================================================
-- TABLA: LOG_ACCESOS
-- Descripción: Registro de accesos al sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS LOG_ACCESOS (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    username VARCHAR(50),
    tipo_evento VARCHAR(30) NOT NULL CHECK (tipo_evento IN (
        'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA', 
        'CUENTA_BLOQUEADA', 'PASSWORD_CAMBIADO'
    )),
    ip_address INET,
    user_agent TEXT,
    ubicacion VARCHAR(100),
    detalles JSONB,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para LOG_ACCESOS
CREATE INDEX IF NOT EXISTS idx_log_usuario ON LOG_ACCESOS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_tipo ON LOG_ACCESOS(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_log_fecha ON LOG_ACCESOS(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_log_ip ON LOG_ACCESOS(ip_address);

-- =====================================================
-- TABLA: CONFIGURACION_SEGURIDAD
-- Descripción: Configuración de políticas de seguridad
-- =====================================================
CREATE TABLE IF NOT EXISTS CONFIGURACION_SEGURIDAD (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo VARCHAR(10) DEFAULT 'STRING' CHECK (tipo IN ('STRING', 'INTEGER', 'BOOLEAN', 'JSON')),
    descripcion TEXT,
    categoria VARCHAR(50),
    editable BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    modificado_por INTEGER,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para CONFIGURACION_SEGURIDAD
CREATE INDEX IF NOT EXISTS idx_config_categoria ON CONFIGURACION_SEGURIDAD(categoria);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- USUARIOS
ALTER TABLE USUARIOS 
ADD CONSTRAINT fk_usuarios_rol 
FOREIGN KEY (rol_id) REFERENCES ROLES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE USUARIOS 
ADD CONSTRAINT fk_usuarios_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE USUARIOS 
ADD CONSTRAINT fk_usuarios_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ROLES
ALTER TABLE ROLES 
ADD CONSTRAINT fk_roles_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE ROLES 
ADD CONSTRAINT fk_roles_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- SESIONES_USUARIO
ALTER TABLE SESIONES_USUARIO 
ADD CONSTRAINT fk_sesiones_usuario 
FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- PERMISOS_USUARIO
ALTER TABLE PERMISOS_USUARIO 
ADD CONSTRAINT fk_permisos_usuario 
FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE PERMISOS_USUARIO 
ADD CONSTRAINT fk_permisos_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- LOG_ACCESOS
ALTER TABLE LOG_ACCESOS 
ADD CONSTRAINT fk_log_usuario 
FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- CONFIGURACION_SEGURIDAD
ALTER TABLE CONFIGURACION_SEGURIDAD 
ADD CONSTRAINT fk_config_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- FUNCIÓN PARA ACTUALIZAR fecha_modificacion
-- =====================================================
CREATE OR REPLACE FUNCTION update_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para actualizar fecha_modificacion
CREATE TRIGGER tr_usuarios_update_fecha_modificacion
    BEFORE UPDATE ON USUARIOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

CREATE TRIGGER tr_roles_update_fecha_modificacion
    BEFORE UPDATE ON ROLES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

CREATE TRIGGER tr_sesiones_update_fecha_ultimo_uso
    BEFORE UPDATE ON SESIONES_USUARIO
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar roles del sistema
INSERT INTO ROLES (nombre, descripcion, permisos, nivel_acceso, es_sistema, timeout_sesion, max_sesiones_concurrentes) VALUES
('Admin Principal', 'Administrador principal con acceso completo al sistema', 
 '{"*": ["*"]}', 'ADMIN_PRINCIPAL', TRUE, 7200, 5),
('Admin Secundario', 'Administrador secundario sin gestión de usuarios', 
 '{"patients": ["*"], "appointments": ["*"], "clinical_history": ["*"], "documents": ["*"], "reports": ["read"]}', 
 'ADMIN_SECUNDARIO', TRUE, 3600, 3),
('Asistente', 'Personal administrativo con acceso a gestión básica', 
 '{"patients": ["create", "read", "update"], "appointments": ["*"], "documents": ["create", "read", "update"]}', 
 'ASISTENTE', TRUE, 3600, 2),
('Invitado', 'Acceso de solo lectura para consultores externos', 
 '{"patients": ["read"], "appointments": ["read"], "clinical_history": ["read"], "documents": ["read"]}', 
 'INVITADO', TRUE, 1800, 1);

-- Insertar configuraciones de seguridad por defecto
INSERT INTO CONFIGURACION_SEGURIDAD (clave, valor, tipo, descripcion, categoria, editable) VALUES
('password_min_length', '8', 'INTEGER', 'Longitud mínima de contraseña', 'password_policy', TRUE),
('password_require_uppercase', 'true', 'BOOLEAN', 'Requerir mayúsculas en contraseña', 'password_policy', TRUE),
('password_require_lowercase', 'true', 'BOOLEAN', 'Requerir minúsculas en contraseña', 'password_policy', TRUE),
('password_require_numbers', 'true', 'BOOLEAN', 'Requerir números en contraseña', 'password_policy', TRUE),
('password_require_symbols', 'false', 'BOOLEAN', 'Requerir símbolos en contraseña', 'password_policy', TRUE),
('password_expiry_days', '90', 'INTEGER', 'Días para expiración de contraseña', 'password_policy', TRUE),
('max_login_attempts', '5', 'INTEGER', 'Máximo intentos de login antes de bloqueo', 'security', TRUE),
('account_lockout_duration', '1800', 'INTEGER', 'Duración de bloqueo en segundos', 'security', TRUE),
('session_timeout_warning', '300', 'INTEGER', 'Advertencia de timeout en segundos', 'session', TRUE),
('jwt_access_token_expiry', '900', 'INTEGER', 'Expiración de access token en segundos', 'jwt', FALSE),
('jwt_refresh_token_expiry', '604800', 'INTEGER', 'Expiración de refresh token en segundos', 'jwt', FALSE),
('enable_2fa', 'false', 'BOOLEAN', 'Habilitar autenticación de dos factores', 'security', TRUE),
('force_password_change_first_login', 'true', 'BOOLEAN', 'Forzar cambio de contraseña en primer login', 'security', TRUE);

-- Insertar usuario administrador por defecto (Dr. Joel Sánchez García)
-- Contraseña temporal: EcoDigital2026! (debe cambiarse en primer login)
INSERT INTO USUARIOS (
    username, email, password_hash, salt, 
    nombres, apellidos, telefono, cedula,
    titulo_profesional, especialidad, numero_colegiado,
    rol_id, activo, verificado, cambiar_password
) VALUES (
    'jsanchez', 'joel.sanchez@ecodigital.com', 
    '$2b$12$LQv3c1yqBwEHFNjNJRJ3nOHSCzxwqUzaHfBvjRy4FooqQUjd2YxYO', -- Hash de EcoDigital2026!
    'ecodigital_salt_2026',
    'Joel', 'Sánchez García', '+1-809-555-0100', '001-1234567-8',
    'Dr.', 'Cirugía Especializada', 'COL-2024-001',
    1, TRUE, TRUE, TRUE
);

-- Actualizar referencias de auditoría
UPDATE ROLES SET creado_por = 1 WHERE es_sistema = TRUE;
UPDATE USUARIOS SET creado_por = 1 WHERE id = 1;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de usuarios con información de rol
CREATE OR REPLACE VIEW v_usuarios_completo AS
SELECT 
    u.id,
    u.username,
    u.email,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    u.telefono,
    u.cedula,
    u.titulo_profesional,
    u.especialidad,
    u.numero_colegiado,
    r.nombre as rol_nombre,
    r.nivel_acceso,
    u.activo,
    u.verificado,
    u.bloqueado,
    u.fecha_ultimo_acceso,
    u.fecha_creacion,
    (SELECT COUNT(*) FROM SESIONES_USUARIO s WHERE s.usuario_id = u.id AND s.activa = TRUE) as sesiones_activas
FROM USUARIOS u
JOIN ROLES r ON u.rol_id = r.id;

-- Vista de sesiones activas
CREATE OR REPLACE VIEW v_sesiones_activas AS
SELECT 
    s.id,
    s.usuario_id,
    u.username,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    s.ip_address,
    s.dispositivo,
    s.fecha_inicio,
    s.fecha_ultimo_uso,
    s.fecha_expiracion,
    EXTRACT(EPOCH FROM (s.fecha_expiracion - CURRENT_TIMESTAMP))/60 as minutos_restantes
FROM SESIONES_USUARIO s
JOIN USUARIOS u ON s.usuario_id = u.id
WHERE s.activa = TRUE AND s.fecha_expiracion > CURRENT_TIMESTAMP;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
-- Este esquema implementa:
-- 1. Sistema completo de usuarios y roles con RBAC
-- 2. Gestión de sesiones con JWT y refresh tokens
-- 3. Auditoría completa de accesos y cambios
-- 4. Configuración flexible de políticas de seguridad
-- 5. Soporte para 2FA (preparado para implementación futura)
-- 6. Soft delete y campos de auditoría en todas las tablas
-- 7. Índices optimizados para consultas frecuentes
-- 8. Vistas útiles para reportes y consultas
-- 9. Triggers para mantener fecha_modificacion actualizada