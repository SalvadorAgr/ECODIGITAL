-- ============================================================================
-- MIGRACIÓN: 04_auditoria_y_logs_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Logs de auditoría WORM, alertas, reportes y métricas del sistema
-- FECHA: Marzo 2026
-- ============================================================================
-- ESTÁNDARES APLICADOS:
-- 1. Seguridad y Atomicidad: Transacciones explícitas con ROLLBACK automático
-- 2. Idempotencia: Uso de IF NOT EXISTS / IF EXISTS
-- 3. Gestión de Dependencias: Orden correcto de creación/eliminación
-- 4. Preservación de Datos: Lógica de respaldo cuando aplica
-- 5. Reversibilidad: Script DOWN incluido al final
-- ============================================================================
-- DEPENDENCIAS:
-- - Requiere: 01_usuarios_y_roles_postgresql.sql (tabla USUARIOS)
-- ============================================================================

-- ============================================================================
-- SECCIÓN UP: Creación de objetos
-- ============================================================================

BEGIN;

-- Verificar que las tablas dependientes existan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'usuarios' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla USUARIOS no existe. Ejecute primero 01_usuarios_y_roles_postgresql.sql';
    END IF;
END $$;

-- ============================================================================
-- EXTENSIONES ADICIONALES
-- ============================================================================

-- Extensión para funciones de hash
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para tipo de evento de auditoría
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_evento_auditoria_type') THEN
        CREATE DOMAIN tipo_evento_auditoria_type AS VARCHAR(50)
        CHECK (VALUE IN (
            'LOGIN', 'LOGOUT', 'ACCESO_DATOS', 'MODIFICACION_DATOS', 'ELIMINACION_DATOS',
            'CREACION_REGISTRO', 'ACTUALIZACION_REGISTRO', 'EXPORTACION_DATOS', 'IMPORTACION_DATOS',
            'ERROR_SISTEMA', 'ADVERTENCIA', 'SEGURIDAD', 'CONFIGURACION', 'BACKUP', 'RESTORE',
            'CAMBIO_PASSWORD', 'CAMBIO_PERMISOS', 'CAMBIO_ROL', 'BLOQUEO_USUARIO', 'DESBLOQUEO_USUARIO',
            'CREACION_CITA', 'CANCELACION_CITA', 'MODIFICACION_CITA', 'CREACION_PACIENTE',
            'MODIFICACION_PACIENTE', 'CREACION_DOCUMENTO', 'ELIMINACION_DOCUMENTO', 'OTRO'
        ));
    END IF;
END $$;

-- Dominio para categoría de auditoría
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_auditoria_type') THEN
        CREATE DOMAIN categoria_auditoria_type AS VARCHAR(30)
        CHECK (VALUE IN ('SEGURIDAD', 'ACCESO', 'DATOS', 'SISTEMA', 'NEGOCIO', 'INTEGRACION', 'OTRO'));
    END IF;
END $$;

-- Dominio para nivel de criticidad
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_criticidad_type') THEN
        CREATE DOMAIN nivel_criticidad_type AS VARCHAR(10)
        CHECK (VALUE IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO'));
    END IF;
END $$;

-- Dominio para resultado de operación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resultado_operacion_type') THEN
        CREATE DOMAIN resultado_operacion_type AS VARCHAR(20)
        CHECK (VALUE IN ('EXITOSO', 'FALLIDO', 'PARCIAL', 'PENDIENTE'));
    END IF;
END $$;

-- Dominio para tipo de alerta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_alerta_type') THEN
        CREATE DOMAIN tipo_alerta_type AS VARCHAR(30)
        CHECK (VALUE IN ('SEGURIDAD', 'SISTEMA', 'NEGOCIO', 'RENDIMIENTO', 'CUMPLIMIENTO', 'OTRO'));
    END IF;
END $$;

-- Dominio para severidad de alerta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severidad_alerta_type') THEN
        CREATE DOMAIN severidad_alerta_type AS VARCHAR(10)
        CHECK (VALUE IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'));
    END IF;
END $$;

-- Dominio para estado de alerta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_alerta_type') THEN
        CREATE DOMAIN estado_alerta_type AS VARCHAR(20)
        CHECK (VALUE IN ('ACTIVA', 'RECONOCIDA', 'RESUELTA', 'IGNORADA', 'ESCALADA'));
    END IF;
END $$;

-- Dominio para tipo de reporte
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_reporte_type') THEN
        CREATE DOMAIN tipo_reporte_type AS VARCHAR(30)
        CHECK (VALUE IN ('PACIENTES', 'CITAS', 'CONSULTAS', 'FINANCIERO', 'ESTADISTICO', 'AUDITORIA', 'CUMPLIMIENTO', 'OTRO'));
    END IF;
END $$;

-- Dominio para formato de reporte
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'formato_reporte_type') THEN
        CREATE DOMAIN formato_reporte_type AS VARCHAR(10)
        CHECK (VALUE IN ('PDF', 'XLSX', 'CSV', 'JSON', 'HTML'));
    END IF;
END $$;

-- Dominio para frecuencia de programación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frecuencia_type') THEN
        CREATE DOMAIN frecuencia_type AS VARCHAR(20)
        CHECK (VALUE IN ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: LOGS_AUDITORIA (WORM - Write Once Read Many)
-- Descripción: Logs inmutables de auditoría del sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS LOGS_AUDITORIA (
    id BIGSERIAL PRIMARY KEY,
    evento_id UUID DEFAULT gen_random_uuid(),
    
    -- Clasificación del evento
    tipo_evento tipo_evento_auditoria_type NOT NULL,
    categoria categoria_auditoria_type NOT NULL,
    nivel_criticidad nivel_criticidad_type NOT NULL DEFAULT 'MEDIO',
    
    -- Información del usuario
    usuario_id INTEGER,
    username VARCHAR(50),
    rol_usuario VARCHAR(50),
    sesion_id VARCHAR(100),
    
    -- Información de conexión
    ip_address INET,
    user_agent TEXT,
    dispositivo VARCHAR(255),
    ubicacion VARCHAR(255),
    
    -- Información del evento
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT,
    
    -- Recurso afectado
    recurso_tipo VARCHAR(50),
    recurso_id VARCHAR(36),
    
    -- Datos del evento (JSONB)
    datos_antes JSONB,
    datos_despues JSONB,
    datos_adicionales JSONB DEFAULT '{}',
    
    -- Resultado de la operación
    resultado resultado_operacion_type NOT NULL DEFAULT 'EXITOSO',
    mensaje_error TEXT,
    codigo_error VARCHAR(20),
    
    -- Tiempos
    duracion_ms INTEGER,
    fecha_evento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Integridad WORM
    numero_secuencia BIGSERIAL,
    hash_integridad VARCHAR(64),
    hash_previo VARCHAR(64),
    requiere_retencion BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_retencion DATE,
    
    -- Metadatos
    aplicacion VARCHAR(50) DEFAULT 'ECODIGITAL',
    version_aplicacion VARCHAR(20),
    ambiente VARCHAR(20) DEFAULT 'PRODUCCION',
    
    CONSTRAINT chk_logs_datos CHECK (datos_antes IS NOT NULL OR datos_despues IS NOT NULL OR descripcion IS NOT NULL)
);

-- Comentarios descriptivos
COMMENT ON TABLE LOGS_AUDITORIA IS 'Logs de auditoría inmutables (WORM) para trazabilidad del sistema';
COMMENT ON COLUMN LOGS_AUDITORIA.evento_id IS 'UUID único del evento para correlación';
COMMENT ON COLUMN LOGS_AUDITORIA.hash_integridad IS 'Hash SHA-256 para verificación de integridad';
COMMENT ON COLUMN LOGS_AUDITORIA.hash_previo IS 'Hash del registro anterior para cadena de integridad';
COMMENT ON COLUMN LOGS_AUDITORIA.numero_secuencia IS 'Número secuencial para ordenamiento garantizado';

-- ============================================================================
-- TABLA: ALERTAS_AUDITORIA
-- Descripción: Definición de alertas del sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS ALERTAS_AUDITORIA (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- Clasificación
    tipo tipo_alerta_type NOT NULL,
    severidad severidad_alerta_type NOT NULL DEFAULT 'WARNING',
    categoria categoria_auditoria_type NOT NULL,
    
    -- Configuración de detección
    condicion JSONB NOT NULL,
    umbral INTEGER DEFAULT 1,
    ventana_tiempo_segundos INTEGER DEFAULT 300,
    
    -- Notificaciones
    notificar_email BOOLEAN DEFAULT TRUE,
    notificar_sms BOOLEAN DEFAULT FALSE,
    notificar_push BOOLEAN DEFAULT FALSE,
    destinatarios JSONB DEFAULT '[]',
    
    -- Acciones automáticas
    accion_automatica VARCHAR(50),
    parametros_accion JSONB DEFAULT '{}',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_alertas_umbral CHECK (umbral > 0),
    CONSTRAINT chk_alertas_ventana CHECK (ventana_tiempo_segundos > 0)
);

-- Comentarios descriptivos
COMMENT ON TABLE ALERTAS_AUDITORIA IS 'Definición de alertas configurables del sistema';
COMMENT ON COLUMN ALERTAS_AUDITORIA.condicion IS 'JSONB con la condición de activación de la alerta';
COMMENT ON COLUMN ALERTAS_AUDITORIA.destinatarios IS 'Array JSONB de destinatarios para notificaciones';

-- ============================================================================
-- TABLA: INSTANCIAS_ALERTAS
-- Descripción: Instancias de alertas activadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS INSTANCIAS_ALERTAS (
    id BIGSERIAL PRIMARY KEY,
    alerta_id INTEGER NOT NULL,
    
    -- Información de la instancia
    mensaje TEXT NOT NULL,
    datos_evento JSONB DEFAULT '{}',
    
    -- Contexto
    usuario_id INTEGER,
    sesion_id VARCHAR(100),
    ip_address INET,
    
    -- Estado
    estado estado_alerta_type NOT NULL DEFAULT 'ACTIVA',
    reconocido_por INTEGER,
    fecha_reconocimiento TIMESTAMP WITH TIME ZONE,
    resuelto_por INTEGER,
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    solucion TEXT,
    
    -- Escalamiento
    escalado BOOLEAN DEFAULT FALSE,
    nivel_escalamiento INTEGER DEFAULT 0,
    fecha_escalamiento TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    fecha_activacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_instancias_alerta FOREIGN KEY (alerta_id) 
        REFERENCES ALERTAS_AUDITORIA(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT fk_instancias_usuario_reconoce FOREIGN KEY (reconocido_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_instancias_usuario_resuelve FOREIGN KEY (resuelto_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE INSTANCIAS_ALERTAS IS 'Instancias de alertas activadas para seguimiento';

-- ============================================================================
-- TABLA: REPORTES_PROGRAMADOS
-- Descripción: Programación de reportes automáticos
-- ============================================================================

CREATE TABLE IF NOT EXISTS REPORTES_PROGRAMADOS (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo tipo_reporte_type NOT NULL,
    
    -- Configuración del reporte
    configuracion JSONB NOT NULL DEFAULT '{}',
    filtros JSONB DEFAULT '{}',
    columnas JSONB DEFAULT '[]',
    ordenamiento JSONB DEFAULT '[]',
    
    -- Formato y destino
    formato formato_reporte_type NOT NULL DEFAULT 'PDF',
    destino_email VARCHAR(100),
    destino_ruta VARCHAR(255),
    
    -- Programación
    frecuencia frecuencia_type NOT NULL DEFAULT 'DIARIO',
    hora_programada TIME NOT NULL DEFAULT '08:00:00',
    dias_ejecucion JSONB DEFAULT '[]',
    fecha_inicio DATE,
    fecha_fin DATE,
    proxima_ejecucion TIMESTAMP WITH TIME ZONE,
    ultima_ejecucion TIMESTAMP WITH TIME ZONE,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_reportes_creador FOREIGN KEY (creado_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_reportes_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- Comentarios descriptivos
COMMENT ON TABLE REPORTES_PROGRAMADOS IS 'Programación de reportes automáticos del sistema';
COMMENT ON COLUMN REPORTES_PROGRAMADOS.configuracion IS 'JSONB con configuración específica del reporte';
COMMENT ON COLUMN REPORTES_PROGRAMADOS.dias_ejecucion IS 'Array JSONB con días de ejecución (para frecuencia SEMANAL)';

-- ============================================================================
-- TABLA: EJECUCIONES_REPORTES
-- Descripción: Historial de ejecuciones de reportes
-- ============================================================================

CREATE TABLE IF NOT EXISTS EJECUCIONES_REPORTES (
    id BIGSERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL,
    
    -- Información de ejecución
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    duracion_ms INTEGER,
    
    -- Resultado
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ERROR', 'CANCELADO')),
    registros_procesados INTEGER DEFAULT 0,
    tamano_archivo BIGINT,
    
    -- Archivo generado
    archivo_path VARCHAR(500),
    archivo_nombre VARCHAR(255),
    
    -- Error
    mensaje_error TEXT,
    
    -- Metadatos
    ejecutado_por INTEGER,
    parametros_usados JSONB DEFAULT '{}',
    
    CONSTRAINT fk_ejecuciones_reporte FOREIGN KEY (reporte_id) 
        REFERENCES REPORTES_PROGRAMADOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT fk_ejecuciones_usuario FOREIGN KEY (ejecutado_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE EJECUCIONES_REPORTES IS 'Historial de ejecuciones de reportes programados';

-- ============================================================================
-- TABLA: PLANTILLAS_REPORTES
-- Descripción: Plantillas para generación de reportes
-- ============================================================================

CREATE TABLE IF NOT EXISTS PLANTILLAS_REPORTES (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    tipo tipo_reporte_type NOT NULL,
    
    -- Contenido
    consulta_sql TEXT NOT NULL,
    columnas JSONB NOT NULL DEFAULT '[]',
    parametros JSONB DEFAULT '[]',
    
    -- Formato
    formato_default formato_reporte_type NOT NULL DEFAULT 'PDF',
    estilos JSONB DEFAULT '{}',
    
    -- Permisos
    roles_permitidos JSONB DEFAULT '[]',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_plantillas_reportes_creador FOREIGN KEY (creado_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT
);

-- Comentarios descriptivos
COMMENT ON TABLE PLANTILLAS_REPORTES IS 'Plantillas para generación de reportes personalizados';
COMMENT ON COLUMN PLANTILLAS_REPORTES.consulta_sql IS 'Consulta SQL base para el reporte';
COMMENT ON COLUMN PLANTILLAS_REPORTES.columnas IS 'Array JSONB con definición de columnas';
COMMENT ON COLUMN PLANTILLAS_REPORTES.parametros IS 'Array JSONB con parámetros aceptados';

-- ============================================================================
-- TABLA: METRICAS_SISTEMA
-- Descripción: Métricas de rendimiento del sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS METRICAS_SISTEMA (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificación
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    subcategoria VARCHAR(50),
    
    -- Valores
    valor DECIMAL(20,6) NOT NULL,
    unidad VARCHAR(20),
    
    -- Contexto
    contexto JSONB DEFAULT '{}',
    
    -- Timestamps
    fecha_medicion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_metricas_valor CHECK (valor IS NOT NULL)
);

-- Comentarios descriptivos
COMMENT ON TABLE METRICAS_SISTEMA IS 'Métricas de rendimiento y operación del sistema';
COMMENT ON COLUMN METRICAS_SISTEMA.contexto IS 'JSONB con contexto adicional de la medición';

-- ============================================================================
-- TABLA: CONFIGURACION_AUDITORIA
-- Descripción: Configuración del sistema de auditoría
-- ============================================================================

CREATE TABLE IF NOT EXISTS CONFIGURACION_AUDITORIA (
    id SERIAL PRIMARY KEY,
    
    -- Configuración de retención
    retencion_dias INTEGER NOT NULL DEFAULT 365,
    retencion_criticos_dias INTEGER NOT NULL DEFAULT 2555,
    
    -- Configuración de archivado
    archivado_automatico BOOLEAN NOT NULL DEFAULT TRUE,
    frecuencia_archivado VARCHAR(20) DEFAULT 'DIARIO' CHECK (frecuencia_archivado IN ('DIARIO', 'SEMANAL', 'MENSUAL')),
    ruta_archivado VARCHAR(255),
    
    -- Configuración de limpieza
    limpieza_automatica BOOLEAN NOT NULL DEFAULT TRUE,
    dias_eliminacion INTEGER DEFAULT 2555,
    
    -- Configuración de alertas
    alertas_activas BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_email BOOLEAN NOT NULL DEFAULT TRUE,
    servidor_smtp VARCHAR(100),
    puerto_smtp INTEGER DEFAULT 587,
    
    -- Configuración de integridad
    verificar_integridad BOOLEAN NOT NULL DEFAULT TRUE,
    algoritmo_hash VARCHAR(20) DEFAULT 'SHA256',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_config_retencion CHECK (retencion_dias > 0),
    CONSTRAINT chk_config_retencion_criticos CHECK (retencion_criticos_dias > 0)
);

-- Comentarios descriptivos
COMMENT ON TABLE CONFIGURACION_AUDITORIA IS 'Configuración del sistema de auditoría y retención de logs';

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para generar hash de integridad
CREATE OR REPLACE FUNCTION generate_log_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_hash_input TEXT;
    v_prev_hash VARCHAR(64);
BEGIN
    -- Obtener hash anterior
    SELECT hash_integridad INTO v_prev_hash
    FROM LOGS_AUDITORIA
    ORDER BY id DESC
    LIMIT 1;
    
    -- Generar hash de entrada
    v_hash_input := COALESCE(NEW.evento_id::TEXT, '') ||
                    COALESCE(NEW.tipo_evento::TEXT, '') ||
                    COALESCE(NEW.categoria::TEXT, '') ||
                    COALESCE(NEW.usuario_id::TEXT, '') ||
                    COALESCE(NEW.modulo, '') ||
                    COALESCE(NEW.accion, '') ||
                    COALESCE(NEW.fecha_evento::TEXT, '') ||
                    COALESCE(v_prev_hash, '');
    
    -- Generar hash SHA-256
    NEW.hash_integridad := encode(sha256(v_hash_input::bytea), 'hex');
    NEW.hash_previo := v_prev_hash;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_log_integrity() IS 'Función trigger para generar hash de integridad en logs WORM';

-- Función para prevenir actualizaciones en logs
CREATE OR REPLACE FUNCTION prevent_logs_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser actualizados';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_logs_update() IS 'Función trigger para prevenir actualizaciones en logs WORM';

-- Función para prevenir eliminación en logs
CREATE OR REPLACE FUNCTION prevent_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser eliminados';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_logs_delete() IS 'Función trigger para prevenir eliminación en logs WORM';

-- Función para crear log de auditoría
CREATE OR REPLACE FUNCTION sp_crear_log_auditoria(
    p_evento_id UUID DEFAULT NULL,
    p_tipo_evento VARCHAR(50) DEFAULT NULL,
    p_categoria VARCHAR(30) DEFAULT NULL,
    p_nivel_criticidad VARCHAR(10) DEFAULT 'MEDIO',
    p_usuario_id INTEGER DEFAULT NULL,
    p_username VARCHAR(50) DEFAULT NULL,
    p_rol_usuario VARCHAR(50) DEFAULT NULL,
    p_sesion_id VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_modulo VARCHAR(50) DEFAULT NULL,
    p_accion VARCHAR(50) DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_recurso_tipo VARCHAR(50) DEFAULT NULL,
    p_recurso_id VARCHAR(36) DEFAULT NULL,
    p_datos_antes JSONB DEFAULT NULL,
    p_datos_despues JSONB DEFAULT NULL,
    p_resultado VARCHAR(20) DEFAULT 'EXITOSO',
    p_duracion_ms INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO LOGS_AUDITORIA (
        evento_id, tipo_evento, categoria, nivel_criticidad,
        usuario_id, username, rol_usuario, sesion_id,
        ip_address, user_agent, modulo, accion, descripcion,
        recurso_tipo, recurso_id, datos_antes, datos_despues,
        resultado, duracion_ms, requiere_retencion
    ) VALUES (
        COALESCE(p_evento_id, gen_random_uuid()),
        p_tipo_evento::tipo_evento_auditoria_type,
        p_categoria::categoria_auditoria_type,
        p_nivel_criticidad::nivel_criticidad_type,
        p_usuario_id, p_username, p_rol_usuario, p_sesion_id,
        p_ip_address, p_user_agent, p_modulo, p_accion, p_descripcion,
        p_recurso_tipo, p_recurso_id, p_datos_antes, p_datos_despues,
        p_resultado::resultado_operacion_type, p_duracion_ms, TRUE
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sp_crear_log_auditoria IS 'Función para crear logs de auditoría de forma estandarizada';

-- Función para verificar integridad de logs
CREATE OR REPLACE FUNCTION verificar_integridad_logs(
    p_fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_fecha_fin TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    evento_id UUID,
    hash_esperado VARCHAR(64),
    hash_actual VARCHAR(64),
    integridad_valida BOOLEAN
) AS $$
DECLARE
    v_hash_input TEXT;
    v_prev_hash VARCHAR(64);
BEGIN
    FOR id, evento_id, hash_actual IN
        SELECT l.id, l.evento_id, l.hash_integridad
        FROM LOGS_AUDITORIA l
        WHERE (p_fecha_inicio IS NULL OR l.fecha_evento >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR l.fecha_evento <= p_fecha_fin)
        ORDER BY l.id
    LOOP
        -- Obtener hash anterior
        SELECT hash_integridad INTO v_prev_hash
        FROM LOGS_AUDITORIA
        WHERE id < verificar_integridad_logs.id
        ORDER BY id DESC
        LIMIT 1;
        
        -- Generar hash esperado
        v_hash_input := COALESCE(evento_id::TEXT, '') ||
                        COALESCE(hash_actual, '') ||
                        COALESCE(v_prev_hash, '');
        
        hash_esperado := encode(sha256(v_hash_input::bytea), 'hex');
        integridad_valida := (hash_esperado = hash_actual);
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_integridad_logs IS 'Función para verificar la integridad de los logs de auditoría';

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION limpiar_logs_antiguos(
    p_dias_retencion INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    logs_eliminados INTEGER;
BEGIN
    -- Solo eliminar logs que no requieren retención extendida
    DELETE FROM LOGS_AUDITORIA
    WHERE fecha_evento < CURRENT_DATE - p_dias_retencion
    AND requiere_retencion = FALSE
    AND nivel_criticidad NOT IN ('ALTO', 'CRITICO');
    
    GET DIAGNOSTICS logs_eliminados = ROW_COUNT;
    
    -- Registrar la limpieza
    INSERT INTO LOGS_AUDITORIA (
        tipo_evento, categoria, nivel_criticidad,
        modulo, accion, descripcion,
        resultado, datos_adicionales
    ) VALUES (
        'SISTEMA', 'SISTEMA', 'MEDIO',
        'AUDITORIA', 'LIMPIEZA_LOGS',
        'Limpieza automática de logs antiguos',
        'EXITOSO',
        jsonb_build_object('logs_eliminados', logs_eliminados, 'dias_retencion', p_dias_retencion)
    );
    
    RETURN logs_eliminados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpiar_logs_antiguos(INTEGER) IS 'Función para limpiar logs antiguos según política de retención';

-- Función para activar alerta
CREATE OR REPLACE FUNCTION activar_alerta(
    p_alerta_id INTEGER,
    p_mensaje TEXT,
    p_datos_evento JSONB DEFAULT '{}',
    p_usuario_id INTEGER DEFAULT NULL,
    p_sesion_id VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_instancia_id BIGINT;
BEGIN
    INSERT INTO INSTANCIAS_ALERTAS (
        alerta_id, mensaje, datos_evento,
        usuario_id, sesion_id, ip_address
    ) VALUES (
        p_alerta_id, p_mensaje, p_datos_evento,
        p_usuario_id, p_sesion_id, p_ip_address
    ) RETURNING id INTO v_instancia_id;
    
    RETURN v_instancia_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION activar_alerta IS 'Función para activar una instancia de alerta';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para generar hash de integridad en logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_logs_auditoria_before_insert'
    ) THEN
        CREATE TRIGGER tr_logs_auditoria_before_insert
            BEFORE INSERT ON LOGS_AUDITORIA
            FOR EACH ROW
            EXECUTE FUNCTION generate_log_integrity();
    END IF;
END $$;

-- Trigger para prevenir actualizaciones en logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_logs_auditoria_prevent_update'
    ) THEN
        CREATE TRIGGER tr_logs_auditoria_prevent_update
            BEFORE UPDATE ON LOGS_AUDITORIA
            FOR EACH ROW
            EXECUTE FUNCTION prevent_logs_update();
    END IF;
END $$;

-- Trigger para prevenir eliminación en logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_logs_auditoria_prevent_delete'
    ) THEN
        CREATE TRIGGER tr_logs_auditoria_prevent_delete
            BEFORE DELETE ON LOGS_AUDITORIA
            FOR EACH ROW
            EXECUTE FUNCTION prevent_logs_delete();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en ALERTAS_AUDITORIA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_alertas_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_alertas_update_fecha_modificacion
            BEFORE UPDATE ON ALERTAS_AUDITORIA
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en INSTANCIAS_ALERTAS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_instancias_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_instancias_update_fecha_modificacion
            BEFORE UPDATE ON INSTANCIAS_ALERTAS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en REPORTES_PROGRAMADOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_reportes_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_reportes_update_fecha_modificacion
            BEFORE UPDATE ON REPORTES_PROGRAMADOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en PLANTILLAS_REPORTES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_plantillas_reportes_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_plantillas_reportes_update_fecha_modificacion
            BEFORE UPDATE ON PLANTILLAS_REPORTES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en CONFIGURACION_AUDITORIA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_config_auditoria_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_config_auditoria_update_fecha_modificacion
            BEFORE UPDATE ON CONFIGURACION_AUDITORIA
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para LOGS_AUDITORIA
CREATE INDEX IF NOT EXISTS idx_logs_fecha_evento ON LOGS_AUDITORIA(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_logs_fecha_hora ON LOGS_AUDITORIA(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_fecha ON LOGS_AUDITORIA(usuario_id, fecha_evento);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_categoria ON LOGS_AUDITORIA(tipo_evento, categoria);
CREATE INDEX IF NOT EXISTS idx_logs_modulo_accion ON LOGS_AUDITORIA(modulo, accion);
CREATE INDEX IF NOT EXISTS idx_logs_recurso ON LOGS_AUDITORIA(recurso_tipo, recurso_id);
CREATE INDEX IF NOT EXISTS idx_logs_nivel_criticidad ON LOGS_AUDITORIA(nivel_criticidad);
CREATE INDEX IF NOT EXISTS idx_logs_resultado ON LOGS_AUDITORIA(resultado);
CREATE INDEX IF NOT EXISTS idx_logs_numero_secuencia ON LOGS_AUDITORIA(numero_secuencia);
CREATE INDEX IF NOT EXISTS idx_logs_hash_integridad ON LOGS_AUDITORIA(hash_integridad);
CREATE INDEX IF NOT EXISTS idx_logs_evento_id ON LOGS_AUDITORIA(evento_id);

-- Índices GIN para JSONB
CREATE INDEX IF NOT EXISTS idx_logs_datos_antes ON LOGS_AUDITORIA USING GIN (datos_antes);
CREATE INDEX IF NOT EXISTS idx_logs_datos_despues ON LOGS_AUDITORIA USING GIN (datos_despues);
CREATE INDEX IF NOT EXISTS idx_logs_datos_adicionales ON LOGS_AUDITORIA USING GIN (datos_adicionales);

-- Índices para ALERTAS_AUDITORIA
CREATE INDEX IF NOT EXISTS idx_alertas_codigo ON ALERTAS_AUDITORIA(codigo);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON ALERTAS_AUDITORIA(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_severidad ON ALERTAS_AUDITORIA(severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_activo ON ALERTAS_AUDITORIA(activo);

-- Índices para INSTANCIAS_ALERTAS
CREATE INDEX IF NOT EXISTS idx_instancias_alerta ON INSTANCIAS_ALERTAS(alerta_id);
CREATE INDEX IF NOT EXISTS idx_instancias_estado ON INSTANCIAS_ALERTAS(estado);
CREATE INDEX IF NOT EXISTS idx_instancias_fecha_activacion ON INSTANCIAS_ALERTAS(fecha_activacion);
CREATE INDEX IF NOT EXISTS idx_instancias_usuario ON INSTANCIAS_ALERTAS(usuario_id);

-- Índices para REPORTES_PROGRAMADOS
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON REPORTES_PROGRAMADOS(tipo);
CREATE INDEX IF NOT EXISTS idx_reportes_frecuencia ON REPORTES_PROGRAMADOS(frecuencia);
CREATE INDEX IF NOT EXISTS idx_reportes_activo ON REPORTES_PROGRAMADOS(activo);
CREATE INDEX IF NOT EXISTS idx_reportes_proxima_ejecucion ON REPORTES_PROGRAMADOS(proxima_ejecucion);
CREATE INDEX IF NOT EXISTS idx_reportes_creador ON REPORTES_PROGRAMADOS(creado_por);

-- Índices para EJECUCIONES_REPORTES
CREATE INDEX IF NOT EXISTS idx_ejecuciones_reporte ON EJECUCIONES_REPORTES(reporte_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_estado ON EJECUCIONES_REPORTES(estado);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_fecha_inicio ON EJECUCIONES_REPORTES(fecha_inicio);

-- Índices para PLANTILLAS_REPORTES
CREATE INDEX IF NOT EXISTS idx_plantillas_reportes_tipo ON PLANTILLAS_REPORTES(tipo);
CREATE INDEX IF NOT EXISTS idx_plantillas_reportes_activo ON PLANTILLAS_REPORTES(activo);

-- Índices para METRICAS_SISTEMA
CREATE INDEX IF NOT EXISTS idx_metricas_nombre ON METRICAS_SISTEMA(nombre);
CREATE INDEX IF NOT EXISTS idx_metricas_categoria ON METRICAS_SISTEMA(categoria);
CREATE INDEX IF NOT EXISTS idx_metricas_fecha ON METRICAS_SISTEMA(fecha_medicion);
CREATE INDEX IF NOT EXISTS idx_metricas_nombre_fecha ON METRICAS_SISTEMA(nombre, fecha_medicion);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de logs de auditoría resumidos
CREATE OR REPLACE VIEW v_logs_auditoria_resumen AS
SELECT
    l.id,
    l.evento_id,
    l.tipo_evento,
    l.categoria,
    l.nivel_criticidad,
    l.modulo,
    l.accion,
    l.descripcion,
    l.usuario_id,
    l.username,
    l.resultado,
    l.fecha_evento,
    l.duracion_ms,
    CASE 
        WHEN l.usuario_id IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos)
        ELSE 'Sistema'
    END as nombre_usuario
FROM LOGS_AUDITORIA l
LEFT JOIN USUARIOS u ON l.usuario_id = u.id
ORDER BY l.fecha_evento DESC;

COMMENT ON VIEW v_logs_auditoria_resumen IS 'Vista resumida de logs de auditoría con información de usuario';

-- Vista de alertas activas
CREATE OR REPLACE VIEW v_alertas_activas AS
SELECT
    i.id,
    i.alerta_id,
    a.codigo,
    a.nombre,
    a.tipo,
    a.severidad,
    i.mensaje,
    i.estado,
    i.fecha_activacion,
    i.escalado,
    i.nivel_escalamiento,
    CASE 
        WHEN i.usuario_id IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos)
        ELSE 'Sistema'
    END as nombre_usuario
FROM INSTANCIAS_ALERTAS i
JOIN ALERTAS_AUDITORIA a ON i.alerta_id = a.id
LEFT JOIN USUARIOS u ON i.usuario_id = u.id
WHERE i.estado = 'ACTIVA'
ORDER BY 
    CASE a.severidad 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'ERROR' THEN 2 
        WHEN 'WARNING' THEN 3 
        ELSE 4 
    END,
    i.fecha_activacion DESC;

COMMENT ON VIEW v_alertas_activas IS 'Vista de alertas activas ordenadas por severidad';

-- Vista de reportes pendientes
CREATE OR REPLACE VIEW v_reportes_pendientes AS
SELECT
    r.id,
    r.nombre,
    r.tipo,
    r.frecuencia,
    r.proxima_ejecucion,
    r.ultima_ejecucion,
    CASE 
        WHEN r.creado_por IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos)
        ELSE 'Sistema'
    END as creado_por_nombre
FROM REPORTES_PROGRAMADOS r
LEFT JOIN USUARIOS u ON r.creado_por = u.id
WHERE r.activo = TRUE
AND (r.fecha_fin IS NULL OR r.fecha_fin >= CURRENT_DATE)
AND (r.proxima_ejecucion IS NULL OR r.proxima_ejecucion <= CURRENT_TIMESTAMP)
ORDER BY r.proxima_ejecucion;

COMMENT ON VIEW v_reportes_pendientes IS 'Vista de reportes pendientes de ejecución';

-- Vista de métricas por categoría
CREATE OR REPLACE VIEW v_metricas_por_categoria AS
SELECT
    categoria,
    subcategoria,
    nombre,
    AVG(valor) as promedio,
    MIN(valor) as minimo,
    MAX(valor) as maximo,
    COUNT(*) as mediciones,
    MAX(fecha_medicion) as ultima_medicion
FROM METRICAS_SISTEMA
GROUP BY categoria, subcategoria, nombre
ORDER BY categoria, subcategoria, nombre;

COMMENT ON VIEW v_metricas_por_categoria IS 'Vista de métricas agregadas por categoría';

-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar configuración de auditoría por defecto
INSERT INTO CONFIGURACION_AUDITORIA (
    retencion_dias, retencion_criticos_dias,
    archivado_automatico, frecuencia_archivado,
    limpieza_automatica, dias_eliminacion,
    alertas_activas, notificaciones_email,
    verificar_integridad, algoritmo_hash,
    activo
) VALUES (
    365, 2555,
    TRUE, 'DIARIO',
    TRUE, 2555,
    TRUE, TRUE,
    TRUE, 'SHA256',
    TRUE
) ON CONFLICT DO NOTHING;

-- Insertar alertas por defecto
INSERT INTO ALERTAS_AUDITORIA (codigo, nombre, descripcion, tipo, severidad, categoria, condicion, umbral, ventana_tiempo_segundos, activo)
VALUES 
    ('ALERT-001', 'Intentos de acceso fallidos', 'Múltiples intentos de acceso fallidos', 'SEGURIDAD', 'WARNING', 'SEGURIDAD', 
     '{"tipo_evento": "LOGIN", "resultado": "FALLIDO"}'::jsonb, 5, 300, TRUE),
    ('ALERT-002', 'Acceso desde IP sospechosa', 'Acceso desde dirección IP no reconocida', 'SEGURIDAD', 'ERROR', 'SEGURIDAD',
     '{"tipo_evento": "LOGIN", "condicion": "ip_no_reconocida"}'::jsonb, 1, 60, TRUE),
    ('ALERT-003', 'Modificación de permisos', 'Cambio en permisos de usuario', 'SEGURIDAD', 'WARNING', 'SEGURIDAD',
     '{"tipo_evento": "CAMBIO_PERMISOS"}'::jsonb, 1, 0, TRUE),
    ('ALERT-004', 'Error de sistema crítico', 'Error crítico en el sistema', 'SISTEMA', 'CRITICAL', 'SISTEMA',
     '{"tipo_evento": "ERROR_SISTEMA", "nivel_criticidad": "CRITICO"}'::jsonb, 1, 60, TRUE),
    ('ALERT-005', 'Exportación masiva de datos', 'Exportación de gran volumen de datos', 'SEGURIDAD', 'WARNING', 'DATOS',
     '{"tipo_evento": "EXPORTACION_DATOS", "condicion": "volumen_alto"}'::jsonb, 1, 300, TRUE)
ON CONFLICT (codigo) DO NOTHING;

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
    AND tablename IN ('logs_auditoria', 'alertas_auditoria', 'instancias_alertas', 
                       'reportes_programados', 'ejecuciones_reportes', 'plantillas_reportes',
                       'metricas_sistema', 'configuracion_auditoria');
    
    IF tablas_creadas = 8 THEN
        RAISE NOTICE 'Migración 04 completada exitosamente. 8 tablas creadas/verificadas.';
    ELSE
        RAISE EXCEPTION 'Error: No todas las tablas fueron creadas correctamente. Esperadas: 8, Encontradas: %', tablas_creadas;
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
DROP VIEW IF EXISTS v_metricas_por_categoria CASCADE;
DROP VIEW IF EXISTS v_reportes_pendientes CASCADE;
DROP VIEW IF EXISTS v_alertas_activas CASCADE;
DROP VIEW IF EXISTS v_logs_auditoria_resumen CASCADE;

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_config_auditoria_update_fecha_modificacion ON CONFIGURACION_AUDITORIA;
DROP TRIGGER IF EXISTS tr_plantillas_reportes_update_fecha_modificacion ON PLANTILLAS_REPORTES;
DROP TRIGGER IF EXISTS tr_reportes_update_fecha_modificacion ON REPORTES_PROGRAMADOS;
DROP TRIGGER IF EXISTS tr_instancias_update_fecha_modificacion ON INSTANCIAS_ALERTAS;
DROP TRIGGER IF EXISTS tr_alertas_update_fecha_modificacion ON ALERTAS_AUDITORIA;
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_delete ON LOGS_AUDITORIA;
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_update ON LOGS_AUDITORIA;
DROP TRIGGER IF EXISTS tr_logs_auditoria_before_insert ON LOGS_AUDITORIA;

-- Eliminar funciones
DROP FUNCTION IF EXISTS activar_alerta(INTEGER, TEXT, JSONB, INTEGER, VARCHAR, INET);
DROP FUNCTION IF EXISTS limpiar_logs_antiguos(INTEGER);
DROP FUNCTION IF EXISTS verificar_integridad_logs(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS sp_crear_log_auditoria(UUID, VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, INET, TEXT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, JSONB, JSONB, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS prevent_logs_delete();
DROP FUNCTION IF EXISTS prevent_logs_update();
DROP FUNCTION IF EXISTS generate_log_integrity();

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS CONFIGURACION_AUDITORIA CASCADE;
DROP TABLE IF EXISTS METRICAS_SISTEMA CASCADE;
DROP TABLE IF EXISTS PLANTILLAS_REPORTES CASCADE;
DROP TABLE IF EXISTS EJECUCIONES_REPORTES CASCADE;
DROP TABLE IF EXISTS REPORTES_PROGRAMADOS CASCADE;
DROP TABLE IF EXISTS INSTANCIAS_ALERTAS CASCADE;
DROP TABLE IF EXISTS ALERTAS_AUDITORIA CASCADE;
DROP TABLE IF EXISTS LOGS_AUDITORIA CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS frecuencia_type;
DROP DOMAIN IF EXISTS formato_reporte_type;
DROP DOMAIN IF EXISTS tipo_reporte_type;
DROP DOMAIN IF EXISTS estado_alerta_type;
DROP DOMAIN IF EXISTS severidad_alerta_type;
DROP DOMAIN IF EXISTS tipo_alerta_type;
DROP DOMAIN IF EXISTS resultado_operacion_type;
DROP DOMAIN IF EXISTS nivel_criticidad_type;
DROP DOMAIN IF EXISTS categoria_auditoria_type;
DROP DOMAIN IF EXISTS tipo_evento_auditoria_type;

COMMIT;
*/