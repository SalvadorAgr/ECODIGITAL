-- ============================================================================
-- MIGRACIÓN: 01_usuarios_y_roles_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Usuarios, roles, sesiones, permisos y configuración de seguridad
-- FECHA: Marzo 2026
-- ============================================================================
-- ESTÁNDARES APLICADOS:
-- 1. Seguridad y Atomicidad: Transacciones explícitas con ROLLBACK automático
-- 2. Idempotencia: Uso de IF NOT EXISTS / IF EXISTS
-- 3. Gestión de Dependencias: Orden correcto de creación/eliminación
-- 4. Preservación de Datos: Lógica de respaldo cuando aplica
-- 5. Reversibilidad: Script DOWN incluido al final
-- ============================================================================

-- ============================================================================
-- SECCIÓN UP: Creación de objetos
-- ============================================================================

BEGIN;

-- Variable para control de errores
DO $$
BEGIN
    -- Verificar que no existan conflictos de nombres
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'usuarios' AND schemaname = 'public') THEN
        RAISE NOTICE 'Tabla USUARIOS ya existe. Verificando estructura...';
    END IF;
END $$;

-- ============================================================================
-- EXTENSIONES REQUERIDAS
-- ============================================================================

-- Extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para funciones criptográficas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extensión para generación de UUIDs aleatorios
CREATE EXTENSION IF NOT EXISTS "gen_random_uuid" SCHEMA public;

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para niveles de acceso
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_acceso_type') THEN
        CREATE DOMAIN nivel_acceso_type AS VARCHAR(20)
        CHECK (VALUE IN ('ADMIN', 'MEDICO', 'ENFERMERA', 'ADMINISTRATIVO', 'VISITANTE'));
    END IF;
END $$;

-- Dominio para estados de usuario
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_usuario_type') THEN
        CREATE DOMAIN estado_usuario_type AS VARCHAR(20)
        CHECK (VALUE IN ('ACTIVO', 'INACTIVO', 'PENDIENTE', 'BLOQUEADO', 'ELIMINADO'));
    END IF;
END $$;

-- Dominio para tipos de documento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento_type') THEN
        CREATE DOMAIN tipo_documento_type AS VARCHAR(20)
        CHECK (VALUE IN ('CEDULA', 'PASAPORTE', 'LICENCIA', 'OTRO'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: ROLES
-- Descripción: Define los roles del sistema con sus niveles de acceso
-- ============================================================================

CREATE TABLE IF NOT EXISTS ROLES (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    nivel_acceso nivel_acceso_type NOT NULL DEFAULT 'VISITANTE',
    permisos JSONB DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_roles_nombre CHECK (LENGTH(TRIM(nombre)) >= 2)
);

-- Comentario descriptivo
COMMENT ON TABLE ROLES IS 'Catálogo de roles del sistema con niveles de acceso y permisos';
COMMENT ON COLUMN ROLES.permisos IS 'JSONB con permisos específicos del rol';

-- ============================================================================
-- TABLA: USUARIOS
-- Descripción: Usuarios del sistema con información personal y profesional
-- ============================================================================

CREATE TABLE IF NOT EXISTS USUARIOS (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Información personal
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    genero VARCHAR(10) CHECK (genero IN ('MASCULINO', 'FEMENINO', 'OTRO', 'PREFERIRIA_NO_DECIR')),
    direccion TEXT,
    foto_perfil VARCHAR(255),
    
    -- Información profesional
    cedula VARCHAR(20) UNIQUE,
    titulo_profesional VARCHAR(100),
    especialidad VARCHAR(100),
    numero_colegiado VARCHAR(50),
    
    -- Relación con rol
    rol_id INTEGER NOT NULL,
    
    -- Estado del usuario
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_bloqueo TEXT,
    
    -- Control de acceso
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    fecha_ultimo_acceso TIMESTAMP WITH TIME ZONE,
    fecha_verificacion TIMESTAMP WITH TIME ZONE,
    fecha_bloqueo TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) 
        REFERENCES ROLES(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_usuarios_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_usuarios_password CHECK (LENGTH(password_hash) >= 60),
    CONSTRAINT chk_usuarios_nombres CHECK (LENGTH(TRIM(nombres)) >= 2),
    CONSTRAINT chk_usuarios_apellidos CHECK (LENGTH(TRIM(apellidos)) >= 2)
);

-- Comentarios descriptivos
COMMENT ON TABLE USUARIOS IS 'Usuarios del sistema con información personal, profesional y de acceso';
COMMENT ON COLUMN USUARIOS.password_hash IS 'Hash bcrypt de la contraseña (mínimo 60 caracteres)';
COMMENT ON COLUMN USUARIOS.intentos_fallidos IS 'Contador de intentos fallidos de autenticación';

-- ============================================================================
-- TABLA: SESIONES_USUARIO
-- Descripción: Gestión de sesiones activas de usuarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS SESIONES_USUARIO (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id INTEGER NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    refresh_token VARCHAR(500) UNIQUE,
    
    -- Información de dispositivo
    dispositivo VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    -- Estado de sesión
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_ultima_actividad TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    motivo_cierre VARCHAR(100),
    
    CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT chk_sesiones_fechas CHECK (fecha_expiracion > fecha_inicio)
);

-- Comentarios descriptivos
COMMENT ON TABLE SESIONES_USUARIO IS 'Sesiones activas e históricas de usuarios para control de acceso';
COMMENT ON COLUMN SESIONES_USUARIO.token IS 'Token JWT de autenticación';
COMMENT ON COLUMN SESIONES_USUARIO.refresh_token IS 'Token de refresco para renovar sesión';

-- ============================================================================
-- TABLA: PERMISOS_USUARIO
-- Descripción: Permisos específicos por usuario (complementarios al rol)
-- ============================================================================

CREATE TABLE IF NOT EXISTS PERMISOS_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    permitido BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_permisos_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT uq_permisos_usuario_modulo_accion UNIQUE (usuario_id, modulo, accion)
);

-- Comentarios descriptivos
COMMENT ON TABLE PERMISOS_USUARIO IS 'Permisos específicos por usuario que complementan o sobrescriben los del rol';

-- ============================================================================
-- TABLA: LOG_ACCESOS
-- Descripción: Registro de accesos al sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS LOG_ACCESOS (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER,
    username VARCHAR(50),
    
    -- Información del acceso
    tipo_acceso VARCHAR(20) NOT NULL CHECK (tipo_acceso IN ('LOGIN', 'LOGOUT', 'REFRESH', 'FAILED')),
    exitoso BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_fallo VARCHAR(255),
    
    -- Información de conexión
    ip_address INET,
    user_agent TEXT,
    dispositivo VARCHAR(255),
    ubicacion VARCHAR(255),
    
    -- Timestamps
    fecha_acceso TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duracion_sesion_segundos INTEGER,
    
    CONSTRAINT fk_log_accesos_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE LOG_ACCESOS IS 'Log de accesos al sistema para auditoría y seguridad';
COMMENT ON COLUMN LOG_ACCESOS.duracion_sesion_segundos IS 'Duración de la sesión en segundos (solo para LOGOUT)';

-- ============================================================================
-- TABLA: CONFIGURACION_SEGURIDAD
-- Descripción: Configuración de seguridad del sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS CONFIGURACION_SEGURIDAD (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER UNIQUE,
    
    -- Configuración de contraseña
    longitud_minima_password INTEGER NOT NULL DEFAULT 8,
    requiere_mayusculas BOOLEAN NOT NULL DEFAULT TRUE,
    requiere_minusculas BOOLEAN NOT NULL DEFAULT TRUE,
    requiere_numeros BOOLEAN NOT NULL DEFAULT TRUE,
    requiere_caracteres_especiales BOOLEAN NOT NULL DEFAULT TRUE,
    dias_expiracion_password INTEGER DEFAULT 90,
    historial_passwords INTEGER DEFAULT 5,
    
    -- Configuración de sesión
    max_intentos_fallidos INTEGER NOT NULL DEFAULT 5,
    tiempo_bloqueo_minutos INTEGER NOT NULL DEFAULT 30,
    duracion_sesion_horas INTEGER NOT NULL DEFAULT 8,
    duracion_refresh_token_dias INTEGER NOT NULL DEFAULT 7,
    max_sesiones_activas INTEGER NOT NULL DEFAULT 5,
    
    -- Configuración de MFA
    requiere_mfa BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_obligatorio_roles JSONB DEFAULT '[]',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_config_seguridad_rol FOREIGN KEY (rol_id) 
        REFERENCES ROLES(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT chk_config_password_length CHECK (longitud_minima_password >= 6),
    CONSTRAINT chk_config_intentos CHECK (max_intentos_fallidos >= 1)
);

-- Comentarios descriptivos
COMMENT ON TABLE CONFIGURACION_SEGURIDAD IS 'Configuración de políticas de seguridad por rol o global';
COMMENT ON COLUMN CONFIGURACION_SEGURIDAD.mfa_obligatorio_roles IS 'Array JSONB de roles que requieren MFA obligatorio';

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para actualizar fecha_modificacion automáticamente
CREATE OR REPLACE FUNCTION update_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_fecha_modificacion() IS 'Función trigger para actualizar automáticamente fecha_modificacion';

-- Función para hashear contraseñas
CREATE OR REPLACE FUNCTION hash_password(password VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION hash_password(VARCHAR) IS 'Función para hashear contraseñas usando bcrypt';

-- Función para verificar contraseñas
CREATE OR REPLACE FUNCTION verify_password(password VARCHAR, hash VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_password(VARCHAR, VARCHAR) IS 'Función para verificar contraseñas contra hash bcrypt';

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION limpiar_sesiones_expiradas()
RETURNS INTEGER AS $$
DECLARE
    sesiones_eliminadas INTEGER;
BEGIN
    DELETE FROM SESIONES_USUARIO 
    WHERE fecha_expiracion < CURRENT_TIMESTAMP 
    AND activa = FALSE;
    
    GET DIAGNOSTICS sesiones_eliminadas = ROW_COUNT;
    RETURN sesiones_eliminadas;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpiar_sesiones_expiradas() IS 'Función de mantenimiento para limpiar sesiones expiradas';

-- Función para verificar si un usuario está bloqueado
CREATE OR REPLACE FUNCTION usuario_bloqueado(p_usuario_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_bloqueado BOOLEAN;
    v_intentos INTEGER;
    v_max_intentos INTEGER;
BEGIN
    SELECT bloqueado, intentos_fallidos INTO v_bloqueado, v_intentos
    FROM USUARIOS WHERE id = p_usuario_id;
    
    IF v_bloqueado THEN
        RETURN TRUE;
    END IF;
    
    -- Obtener configuración de seguridad
    SELECT COALESCE(
        (SELECT max_intentos_fallidos FROM CONFIGURACION_SEGURIDAD WHERE rol_id = u.rol_id AND activo = TRUE LIMIT 1),
        (SELECT max_intentos_fallidos FROM CONFIGURACION_SEGURIDAD WHERE rol_id IS NULL AND activo = TRUE LIMIT 1),
        5
    ) INTO v_max_intentos
    FROM USUARIOS u WHERE u.id = p_usuario_id;
    
    RETURN v_intentos >= v_max_intentos;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION usuario_bloqueado(INTEGER) IS 'Función para verificar si un usuario está bloqueado por intentos fallidos';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha_modificacion en USUARIOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_usuarios_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_usuarios_update_fecha_modificacion
            BEFORE UPDATE ON USUARIOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en ROLES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_roles_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_roles_update_fecha_modificacion
            BEFORE UPDATE ON ROLES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en PERMISOS_USUARIO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_permisos_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_permisos_update_fecha_modificacion
            BEFORE UPDATE ON PERMISOS_USUARIO
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en CONFIGURACION_SEGURIDAD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_config_seguridad_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_config_seguridad_update_fecha_modificacion
            BEFORE UPDATE ON CONFIGURACION_SEGURIDAD
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para ROLES
CREATE INDEX IF NOT EXISTS idx_roles_nombre ON ROLES(nombre);
CREATE INDEX IF NOT EXISTS idx_roles_nivel_acceso ON ROLES(nivel_acceso);
CREATE INDEX IF NOT EXISTS idx_roles_activo ON ROLES(activo);

-- Índices para USUARIOS
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON USUARIOS(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON USUARIOS(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON USUARIOS(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON USUARIOS(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON USUARIOS(bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON USUARIOS(cedula);
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acceso ON USUARIOS(fecha_ultimo_acceso);
CREATE INDEX IF NOT EXISTS idx_usuarios_verificado ON USUARIOS(verificado);

-- Índices para SESIONES_USUARIO
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON SESIONES_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON SESIONES_USUARIO(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_activa ON SESIONES_USUARIO(activa);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON SESIONES_USUARIO(fecha_expiracion);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_activa ON SESIONES_USUARIO(usuario_id, activa);

-- Índices para PERMISOS_USUARIO
CREATE INDEX IF NOT EXISTS idx_permisos_usuario ON PERMISOS_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON PERMISOS_USUARIO(modulo);
CREATE INDEX IF NOT EXISTS idx_permisos_usuario_modulo ON PERMISOS_USUARIO(usuario_id, modulo);

-- Índices para LOG_ACCESOS
CREATE INDEX IF NOT EXISTS idx_log_accesos_usuario ON LOG_ACCESOS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_accesos_fecha ON LOG_ACCESOS(fecha_acceso);
CREATE INDEX IF NOT EXISTS idx_log_accesos_tipo ON LOG_ACCESOS(tipo_acceso);
CREATE INDEX IF NOT EXISTS idx_log_accesos_exitoso ON LOG_ACCESOS(exitoso);
CREATE INDEX IF NOT EXISTS idx_log_accesos_ip ON LOG_ACCESOS(ip_address);

-- Índices para CONFIGURACION_SEGURIDAD
CREATE INDEX IF NOT EXISTS idx_config_seguridad_rol ON CONFIGURACION_SEGURIDAD(rol_id);
CREATE INDEX IF NOT EXISTS idx_config_seguridad_activo ON CONFIGURACION_SEGURIDAD(activo);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de usuarios completo con información de rol
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

COMMENT ON VIEW v_usuarios_completo IS 'Vista completa de usuarios con información de rol y sesiones activas';

-- Vista de sesiones activas
CREATE OR REPLACE VIEW v_sesiones_activas AS
SELECT
    s.id,
    s.usuario_id,
    u.username,
    u.email,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    s.dispositivo,
    s.ip_address,
    s.fecha_inicio,
    s.fecha_expiracion,
    s.fecha_ultima_actividad,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.fecha_inicio)) as duracion_segundos
FROM SESIONES_USUARIO s
JOIN USUARIOS u ON s.usuario_id = u.id
WHERE s.activa = TRUE
AND s.fecha_expiracion > CURRENT_TIMESTAMP;

COMMENT ON VIEW v_sesiones_activas IS 'Vista de sesiones activas con información de usuario';

-- Vista de logs de acceso resumidos
CREATE OR REPLACE VIEW v_log_accesos_resumen AS
SELECT
    l.id,
    l.usuario_id,
    l.username,
    l.tipo_acceso,
    l.exitoso,
    l.motivo_fallo,
    l.ip_address,
    l.dispositivo,
    l.fecha_acceso,
    CASE 
        WHEN l.tipo_acceso = 'LOGIN' AND l.exitoso = TRUE THEN 'Inicio de sesión exitoso'
        WHEN l.tipo_acceso = 'LOGIN' AND l.exitoso = FALSE THEN 'Intento de inicio de sesión fallido'
        WHEN l.tipo_acceso = 'LOGOUT' THEN 'Cierre de sesión'
        WHEN l.tipo_acceso = 'REFRESH' THEN 'Refresco de token'
        WHEN l.tipo_acceso = 'FAILED' THEN 'Acceso denegado'
        ELSE 'Otro'
    END as descripcion
FROM LOG_ACCESOS l
ORDER BY l.fecha_acceso DESC;

COMMENT ON VIEW v_log_accesos_resumen IS 'Vista resumida de logs de acceso con descripción legible';

-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar roles por defecto
INSERT INTO ROLES (nombre, descripcion, nivel_acceso, permisos, activo)
VALUES 
    ('Administrador', 'Rol con acceso completo al sistema', 'ADMIN', '{"all": true}', TRUE),
    ('Médico', 'Rol para médicos con acceso a pacientes y historial', 'MEDICO', '{"pacientes": {"read": true, "write": true}, "historial": {"read": true, "write": true}, "citas": {"read": true, "write": true}}', TRUE),
    ('Enfermera', 'Rol para enfermeras con acceso limitado', 'ENFERMERA', '{"pacientes": {"read": true}, "historial": {"read": true}, "citas": {"read": true}}', TRUE),
    ('Administrativo', 'Rol para personal administrativo', 'ADMINISTRATIVO', '{"pacientes": {"read": true, "write": true}, "citas": {"read": true, "write": true}}', TRUE),
    ('Visitante', 'Rol con acceso mínimo de solo lectura', 'VISITANTE', '{"dashboard": {"read": true}}', TRUE)
ON CONFLICT (nombre) DO NOTHING;

-- Insertar configuración de seguridad global
INSERT INTO CONFIGURACION_SEGURIDAD (
    longitud_minima_password, requiere_mayusculas, requiere_minusculas,
    requiere_numeros, requiere_caracteres_especiales, dias_expiracion_password,
    historial_passwords, max_intentos_fallidos, tiempo_bloqueo_minutos,
    duracion_sesion_horas, duracion_refresh_token_dias, max_sesiones_activas,
    requiere_mfa, activo
) VALUES (
    8, TRUE, TRUE, TRUE, TRUE, 90, 5, 5, 30, 8, 7, 5, FALSE, TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONFIRMACIÓN DE TRANSACCIÓN
-- ============================================================================

-- Verificar que todas las tablas se crearon correctamente
DO $$
DECLARE
    tablas_creadas INTEGER;
BEGIN
    SELECT COUNT(*) INTO tablas_creadas
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('roles', 'usuarios', 'sesiones_usuario', 'permisos_usuario', 'log_accesos', 'configuracion_seguridad');
    
    IF tablas_creadas = 6 THEN
        RAISE NOTICE 'Migración 01 completada exitosamente. 6 tablas creadas/verificadas.';
    ELSE
        RAISE EXCEPTION 'Error: No todas las tablas fueron creadas correctamente. Esperadas: 6, Encontradas: %', tablas_creadas;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIN DEL SCRIPT UP
-- ============================================================================

-- ============================================================================
-- SCRIPT DOWN: Reversión de la migración
-- ============================================================================
-- Para revertir esta migración, ejecutar el siguiente bloque:
/*
BEGIN;

-- ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS
-- Asegúrese de tener un respaldo antes de ejecutar

-- Eliminar vistas
DROP VIEW IF EXISTS v_log_accesos_resumen CASCADE;
DROP VIEW IF EXISTS v_sesiones_activas CASCADE;
DROP VIEW IF EXISTS v_usuarios_completo CASCADE;

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_config_seguridad_update_fecha_modificacion ON CONFIGURACION_SEGURIDAD;
DROP TRIGGER IF EXISTS tr_permisos_update_fecha_modificacion ON PERMISOS_USUARIO;
DROP TRIGGER IF EXISTS tr_roles_update_fecha_modificacion ON ROLES;
DROP TRIGGER IF EXISTS tr_usuarios_update_fecha_modificacion ON USUARIOS;

-- Eliminar funciones
DROP FUNCTION IF EXISTS usuario_bloqueado(INTEGER);
DROP FUNCTION IF EXISTS limpiar_sesiones_expiradas();
DROP FUNCTION IF EXISTS verify_password(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS hash_password(VARCHAR);
DROP FUNCTION IF EXISTS update_fecha_modificacion();

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS CONFIGURACION_SEGURIDAD CASCADE;
DROP TABLE IF EXISTS LOG_ACCESOS CASCADE;
DROP TABLE IF EXISTS PERMISOS_USUARIO CASCADE;
DROP TABLE IF EXISTS SESIONES_USUARIO CASCADE;
DROP TABLE IF EXISTS USUARIOS CASCADE;
DROP TABLE IF EXISTS ROLES CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS tipo_documento_type;
DROP DOMAIN IF EXISTS estado_usuario_type;
DROP DOMAIN IF EXISTS nivel_acceso_type;

-- Eliminar extensiones (opcional, puede afectar a otras tablas)
-- DROP EXTENSION IF EXISTS gen_random_uuid;
-- DROP EXTENSION IF EXISTS pgcrypto;
-- DROP EXTENSION IF EXISTS "uuid-ossp";

COMMIT;
*/