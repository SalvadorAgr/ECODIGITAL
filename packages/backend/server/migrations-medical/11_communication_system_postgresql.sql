-- ============================================================================
-- MIGRACIÓN: 11_communication_system_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Sistema de comunicaciones, notificaciones, mensajes y correos
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
-- - Requiere: 02_pacientes_y_historial_postgresql.sql (tabla PACIENTES)
-- - Requiere: 03_citas_y_documentos_postgresql.sql (tabla CITAS)
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
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'pacientes' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla PACIENTES no existe. Ejecute primero 02_pacientes_y_historial_postgresql.sql';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'citas' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla CITAS no existe. Ejecute primero 03_citas_y_documentos_postgresql.sql';
    END IF;
END $$;

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para tipo de notificación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_notificacion_type') THEN
        CREATE DOMAIN tipo_notificacion_type AS VARCHAR(30)
        CHECK (VALUE IN (
            'SISTEMA', 'CITA', 'RECORDATORIO', 'ALERTA', 'SEGURIDAD',
            'DOCUMENTO', 'PAGO', 'PROMOCION', 'ENCUESTA', 'OTRO'
        ));
    END IF;
END $$;

-- Dominio para estado de notificación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_notificacion_type') THEN
        CREATE DOMAIN estado_notificacion_type AS VARCHAR(20)
        CHECK (VALUE IN ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'ERROR', 'CANCELADA'));
    END IF;
END $$;

-- Dominio para canal de comunicación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_comunicacion_type') THEN
        CREATE DOMAIN canal_comunicacion_type AS VARCHAR(20)
        CHECK (VALUE IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP', 'TELEFONO'));
    END IF;
END $$;

-- Dominio para estado de mensaje
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_mensaje_type') THEN
        CREATE DOMAIN estado_mensaje_type AS VARCHAR(20)
        CHECK (VALUE IN ('BORRADOR', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'ARCHIVADO', 'ELIMINADO'));
    END IF;
END $$;

-- Dominio para prioridad de mensaje
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridad_mensaje_type') THEN
        CREATE DOMAIN prioridad_mensaje_type AS VARCHAR(10)
        CHECK (VALUE IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE'));
    END IF;
END $$;

-- Dominio para tipo de plantilla
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_plantilla_type') THEN
        CREATE DOMAIN tipo_plantilla_type AS VARCHAR(30)
        CHECK (VALUE IN ('NOTIFICACION', 'EMAIL', 'SMS', 'PUSH', 'DOCUMENTO', 'REPORTE', 'OTRO'));
    END IF;
END $$;

-- Dominio para estado de plantilla
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_plantilla_type') THEN
        CREATE DOMAIN estado_plantilla_type AS VARCHAR(20)
        CHECK (VALUE IN ('BORRADOR', 'ACTIVA', 'INACTIVA', 'ARCHIVADA'));
    END IF;
END $$;

-- Dominio para tipo de cola
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cola_type') THEN
        CREATE DOMAIN tipo_cola_type AS VARCHAR(30)
        CHECK (VALUE IN ('EMAIL', 'SMS', 'PUSH', 'NOTIFICACION', 'REPORTE', 'INTEGRACION'));
    END IF;
END $$;

-- Dominio para estado de cola
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cola_type') THEN
        CREATE DOMAIN estado_cola_type AS VARCHAR(20)
        CHECK (VALUE IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR', 'REINTENTO'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: PLANTILLAS_COMUNICACION
-- Descripción: Plantillas para notificaciones y mensajes
-- ============================================================================

CREATE TABLE IF NOT EXISTS PLANTILLAS_COMUNICACION (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo tipo_plantilla_type NOT NULL,
    
    -- Contenido
    asunto VARCHAR(255),
    contenido TEXT NOT NULL,
    contenido_html TEXT,
    variables JSONB DEFAULT '[]',
    
    -- Configuración
    canal_default canal_comunicacion_type DEFAULT 'EMAIL',
    idioma VARCHAR(10) DEFAULT 'es',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    estado estado_plantilla_type NOT NULL DEFAULT 'ACTIVA',
    
    -- Metadatos
    version INTEGER DEFAULT 1,
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_plantillas_creador FOREIGN KEY (creado_por) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_plantillas_contenido CHECK (LENGTH(contenido) > 0)
);

-- Comentarios descriptivos
COMMENT ON TABLE PLANTILLAS_COMUNICACION IS 'Plantillas para notificaciones y mensajes del sistema';
COMMENT ON COLUMN PLANTILLAS_COMUNICACION.variables IS 'Array JSONB con variables disponibles en la plantilla';
COMMENT ON COLUMN PLANTILLAS_COMUNICACION.contenido_html IS 'Versión HTML del contenido para emails';

-- ============================================================================
-- TABLA: NOTIFICACIONES
-- Descripción: Notificaciones del sistema para usuarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS NOTIFICACIONES (
    id BIGSERIAL PRIMARY KEY,
    
    -- Destinatario
    usuario_id INTEGER NOT NULL,
    paciente_id INTEGER,
    
    -- Contenido
    tipo tipo_notificacion_type NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos_adicionales JSONB DEFAULT '{}',
    
    -- Referencia
    referencia_tipo VARCHAR(50),
    referencia_id VARCHAR(36),
    url_accion VARCHAR(500),
    
    -- Plantilla
    plantilla_id INTEGER,
    
    -- Estado
    estado estado_notificacion_type NOT NULL DEFAULT 'PENDIENTE',
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    
    -- Envío
    canal_envio canal_comunicacion_type DEFAULT 'IN_APP',
    fecha_envio TIMESTAMP WITH TIME ZONE,
    intentos_envio INTEGER DEFAULT 0,
    error_envio TEXT,
    
    -- Prioridad y expiración
    prioridad prioridad_mensaje_type DEFAULT 'NORMAL',
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT fk_notificaciones_paciente FOREIGN KEY (paciente_id) 
        REFERENCES PACIENTES(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_notificaciones_plantilla FOREIGN KEY (plantilla_id) 
        REFERENCES PLANTILLAS_COMUNICACION(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE NOTIFICACIONES IS 'Notificaciones del sistema para usuarios';
COMMENT ON COLUMN NOTIFICACIONES.datos_adicionales IS 'JSONB con datos adicionales de la notificación';
COMMENT ON COLUMN NOTIFICACIONES.referencia_tipo IS 'Tipo de entidad referenciada (CITA, DOCUMENTO, etc.)';
COMMENT ON COLUMN NOTIFICACIONES.referencia_id IS 'ID de la entidad referenciada';

-- ============================================================================
-- TABLA: MENSAJES
-- Descripción: Mensajes entre usuarios del sistema
-- ============================================================================

CREATE TABLE IF NOT EXISTS MENSAJES (
    id BIGSERIAL PRIMARY KEY,
    
    -- Remitente y destinatarios
    remitente_id INTEGER NOT NULL,
    destinatarios JSONB NOT NULL DEFAULT '[]',
    destinatarios_copia JSONB DEFAULT '[]',
    destinatarios_ocultos JSONB DEFAULT '[]',
    
    -- Contenido
    asunto VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    contenido_html TEXT,
    
    -- Adjuntos
    adjuntos JSONB DEFAULT '[]',
    
    -- Estado
    estado estado_mensaje_type NOT NULL DEFAULT 'BORRADOR',
    prioridad prioridad_mensaje_type DEFAULT 'NORMAL',
    
    -- Respuestas y reenvío
    mensaje_padre_id BIGINT,
    es_respuesta BOOLEAN DEFAULT FALSE,
    es_reenvio BOOLEAN DEFAULT FALSE,
    
    -- Programación
    fecha_programada TIMESTAMP WITH TIME ZONE,
    fecha_envio TIMESTAMP WITH TIME ZONE,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mensajes_remitente FOREIGN KEY (remitente_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT fk_mensajes_padre FOREIGN KEY (mensaje_padre_id) 
        REFERENCES MENSAJES(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE MENSAJES IS 'Mensajes entre usuarios del sistema';
COMMENT ON COLUMN MENSAJES.destinatarios IS 'Array JSONB con IDs de destinatarios principales';
COMMENT ON COLUMN MENSAJES.adjuntos IS 'Array JSONB con información de archivos adjuntos';

-- ============================================================================
-- TABLA: MENSAJES_DESTINATARIOS
-- Descripción: Relación entre mensajes y destinatarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS MENSAJES_DESTINATARIOS (
    id BIGSERIAL PRIMARY KEY,
    mensaje_id BIGINT NOT NULL,
    usuario_id INTEGER NOT NULL,
    
    -- Tipo de destinatario
    tipo_destinatario VARCHAR(10) NOT NULL CHECK (tipo_destinatario IN ('TO', 'CC', 'BCC')),
    
    -- Estado
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_eliminacion TIMESTAMP WITH TIME ZONE,
    archivado BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Carpetas
    carpeta VARCHAR(20) DEFAULT 'INBOX' CHECK (carpeta IN ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'ARCHIVE')),
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mensajes_dest_mensaje FOREIGN KEY (mensaje_id) 
        REFERENCES MENSAJES(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT fk_mensajes_dest_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT uq_mensajes_destinatario UNIQUE (mensaje_id, usuario_id)
);

-- Comentarios descriptivos
COMMENT ON TABLE MENSAJES_DESTINATARIOS IS 'Relación entre mensajes y destinatarios con estado individual';

-- ============================================================================
-- TABLA: COLA_ENVIO
-- Descripción: Cola de envío de comunicaciones
-- ============================================================================

CREATE TABLE IF NOT EXISTS COLA_ENVIO (
    id BIGSERIAL PRIMARY KEY,
    
    -- Tipo de envío
    tipo tipo_cola_type NOT NULL,
    
    -- Destinatario
    destinatario_id INTEGER,
    destinatario_email VARCHAR(255),
    destinatario_telefono VARCHAR(30),
    destinatario_usuario VARCHAR(100),
    
    -- Contenido
    asunto VARCHAR(255),
    contenido TEXT NOT NULL,
    contenido_html TEXT,
    datos JSONB DEFAULT '{}',
    
    -- Plantilla
    plantilla_id INTEGER,
    parametros_plantilla JSONB DEFAULT '{}',
    
    -- Configuración de envío
    canal canal_comunicacion_type NOT NULL,
    prioridad INTEGER DEFAULT 5,
    intentos_maximos INTEGER DEFAULT 3,
    intentos_realizados INTEGER DEFAULT 0,
    
    -- Estado
    estado estado_cola_type NOT NULL DEFAULT 'PENDIENTE',
    fecha_procesamiento TIMESTAMP WITH TIME ZONE,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    error_mensaje TEXT,
    codigo_error VARCHAR(20),
    
    -- Programación
    fecha_programada TIMESTAMP WITH TIME ZONE,
    
    -- Referencia
    referencia_tipo VARCHAR(50),
    referencia_id VARCHAR(36),
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_cola_plantilla FOREIGN KEY (plantilla_id) 
        REFERENCES PLANTILLAS_COMUNICACION(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_cola_destinatario FOREIGN KEY (destinatario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE COLA_ENVIO IS 'Cola de envío de comunicaciones (email, SMS, push, etc.)';
COMMENT ON COLUMN COLA_ENVIO.parametros_plantilla IS 'JSONB con parámetros para renderizar la plantilla';

-- ============================================================================
-- TABLA: CONFIGURACION_NOTIFICACIONES
-- Descripción: Configuración de notificaciones por usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS CONFIGURACION_NOTIFICACIONES (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL,
    
    -- Preferencias de canal
    email_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    sms_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    push_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Configuración de tipos
    notificaciones_sistema BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_citas BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_documentos BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_pagos BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_seguridad BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Horarios de silencio
    silencio_inicio TIME,
    silencio_fin TIME,
    silencio_dias JSONB DEFAULT '[]',
    
    -- Frecuencia de resumen
    resumen_diario BOOLEAN NOT NULL DEFAULT FALSE,
    resumen_semanal BOOLEAN NOT NULL DEFAULT FALSE,
    hora_resumen TIME DEFAULT '09:00:00',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_config_notif_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE CONFIGURACION_NOTIFICACIONES IS 'Configuración de preferencias de notificaciones por usuario';
COMMENT ON COLUMN CONFIGURACION_NOTIFICACIONES.silencio_dias IS 'Array JSONB con días de silencio (0=Dom, 1=Lun, etc.)';

-- ============================================================================
-- TABLA: REGISTRO_ENVIOS
-- Descripción: Historial de envíos de comunicaciones
-- ============================================================================

CREATE TABLE IF NOT EXISTS REGISTRO_ENVIOS (
    id BIGSERIAL PRIMARY KEY,
    
    -- Referencia
    cola_id BIGINT,
    notificacion_id BIGINT,
    mensaje_id BIGINT,
    
    -- Destinatario
    destinatario_id INTEGER,
    destinatario_email VARCHAR(255),
    destinatario_telefono VARCHAR(30),
    
    -- Información del envío
    canal canal_comunicacion_type NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    asunto VARCHAR(255),
    
    -- Resultado
    exitoso BOOLEAN NOT NULL DEFAULT FALSE,
    mensaje_error TEXT,
    codigo_respuesta VARCHAR(20),
    proveedor VARCHAR(50),
    id_externo VARCHAR(100),
    
    -- Tiempos
    fecha_envio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    duracion_ms INTEGER,
    
    -- Metadatos
    datos_adicionales JSONB DEFAULT '{}',
    
    CONSTRAINT fk_registro_cola FOREIGN KEY (cola_id) 
        REFERENCES COLA_ENVIO(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_registro_notificacion FOREIGN KEY (notificacion_id) 
        REFERENCES NOTIFICACIONES(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_registro_mensaje FOREIGN KEY (mensaje_id) 
        REFERENCES MENSAJES(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL,
    CONSTRAINT fk_registro_destinatario FOREIGN KEY (destinatario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE SET NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE REGISTRO_ENVIOS IS 'Historial de envíos de comunicaciones';
COMMENT ON COLUMN REGISTRO_ENVIOS.id_externo IS 'ID del mensaje en el proveedor externo (SendGrid, Twilio, etc.)';

-- ============================================================================
-- TABLA: RECORDATORIOS_CITAS
-- Descripción: Configuración de recordatorios de citas
-- ============================================================================

CREATE TABLE IF NOT EXISTS RECORDATORIOS_CITAS (
    id SERIAL PRIMARY KEY,
    cita_id BIGINT NOT NULL,
    
    -- Configuración
    recordatorio_horas INTEGER NOT NULL DEFAULT 24,
    canal canal_comunicacion_type NOT NULL DEFAULT 'EMAIL',
    mensaje_personalizado TEXT,
    
    -- Estado
    programado BOOLEAN NOT NULL DEFAULT FALSE,
    enviado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_programada TIMESTAMP WITH TIME ZONE,
    fecha_envio TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_recordatorios_cita FOREIGN KEY (cita_id) 
        REFERENCES CITAS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT chk_recordatorios_horas CHECK (recordatorio_horas > 0)
);

-- Comentarios descriptivos
COMMENT ON TABLE RECORDATORIOS_CITAS IS 'Configuración de recordatorios automáticos de citas';

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para enviar notificación
CREATE OR REPLACE FUNCTION enviar_notificacion(
    p_usuario_id INTEGER,
    p_tipo tipo_notificacion_type,
    p_titulo VARCHAR(200),
    p_mensaje TEXT,
    p_datos_adicionales JSONB DEFAULT '{}',
    p_canal canal_comunicacion_type DEFAULT 'IN_APP',
    p_referencia_tipo VARCHAR(50) DEFAULT NULL,
    p_referencia_id VARCHAR(36) DEFAULT NULL,
    p_url_accion VARCHAR(500) DEFAULT NULL,
    p_prioridad prioridad_mensaje_type DEFAULT 'NORMAL',
    p_fecha_expiracion TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_notificacion_id BIGINT;
BEGIN
    INSERT INTO NOTIFICACIONES (
        usuario_id, tipo, titulo, mensaje, datos_adicionales,
        canal_envio, referencia_tipo, referencia_id, url_accion,
        prioridad, fecha_expiracion, estado
    ) VALUES (
        p_usuario_id, p_tipo, p_titulo, p_mensaje, p_datos_adicionales,
        p_canal, p_referencia_tipo, p_referencia_id, p_url_accion,
        p_prioridad, p_fecha_expiracion, 'PENDIENTE'
    ) RETURNING id INTO v_notificacion_id;
    
    -- Agregar a cola de envío si no es solo IN_APP
    IF p_canal != 'IN_APP' THEN
        INSERT INTO COLA_ENVIO (
            tipo, destinatario_id, asunto, contenido, datos,
            canal, prioridad, referencia_tipo, referencia_id
        ) VALUES (
            'NOTIFICACION', p_usuario_id, p_titulo, p_mensaje, p_datos_adicionales,
            p_canal, 
            CASE p_prioridad 
                WHEN 'URGENTE' THEN 1 
                WHEN 'ALTA' THEN 2 
                WHEN 'NORMAL' THEN 3 
                ELSE 4 
            END,
            p_referencia_tipo, p_referencia_id
        );
    END IF;
    
    RETURN v_notificacion_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enviar_notificacion IS 'Función para enviar una notificación a un usuario';

-- Función para enviar mensaje
CREATE OR REPLACE FUNCTION enviar_mensaje(
    p_remitente_id INTEGER,
    p_destinatarios JSONB,
    p_asunto VARCHAR(255),
    p_contenido TEXT,
    p_contenido_html TEXT DEFAULT NULL,
    p_prioridad prioridad_mensaje_type DEFAULT 'NORMAL',
    p_fecha_programada TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_mensaje_id BIGINT;
    v_destinatario_id INTEGER;
    v_destinatario RECORD;
BEGIN
    -- Crear el mensaje
    INSERT INTO MENSAJES (
        remitente_id, destinatarios, asunto, contenido, contenido_html,
        prioridad, fecha_programada, estado
    ) VALUES (
        p_remitente_id, p_destinatarios, p_asunto, p_contenido, p_contenido_html,
        p_prioridad, p_fecha_programada, 
        CASE WHEN p_fecha_programada IS NULL THEN 'ENVIADO' ELSE 'BORRADOR' END
    ) RETURNING id INTO v_mensaje_id;
    
    -- Crear registros para cada destinatario
    FOR v_destinatario IN SELECT * FROM jsonb_array_elements(p_destinatarios) AS t(id)
    LOOP
        v_destinatario_id := v_destinatario.id::INTEGER;
        
        INSERT INTO MENSAJES_DESTINATARIOS (
            mensaje_id, usuario_id, tipo_destinatario, carpeta
        ) VALUES (
            v_mensaje_id, v_destinatario_id, 'TO', 'INBOX'
        );
    END LOOP;
    
    -- Agregar a cola de envío
    INSERT INTO COLA_ENVIO (
        tipo, destinatario_id, asunto, contenido, contenido_html,
        canal, prioridad, referencia_tipo, referencia_id
    ) SELECT 
        'EMAIL',
        (t.id::INTEGER),
        p_asunto,
        p_contenido,
        p_contenido_html,
        'EMAIL',
        CASE p_prioridad 
            WHEN 'URGENTE' THEN 1 
            WHEN 'ALTA' THEN 2 
            WHEN 'NORMAL' THEN 3 
            ELSE 4 
        END,
        'MENSAJE',
        v_mensaje_id::TEXT
    FROM jsonb_array_elements(p_destinatarios) AS t(id);
    
    RETURN v_mensaje_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enviar_mensaje IS 'Función para enviar un mensaje a múltiples destinatarios';

-- Función para procesar cola de envío
CREATE OR REPLACE FUNCTION procesar_cola_envio(
    p_limite INTEGER DEFAULT 100
)
RETURNS INTEGER AS $$
DECLARE
    v_procesados INTEGER := 0;
    v_registro RECORD;
BEGIN
    FOR v_registro IN 
        SELECT id, tipo, destinatario_id, destinatario_email, destinatario_telefono,
               asunto, contenido, contenido_html, datos, canal, intentos_realizados
        FROM COLA_ENVIO
        WHERE estado = 'PENDIENTE'
        AND (fecha_programada IS NULL OR fecha_programada <= CURRENT_TIMESTAMP)
        AND intentos_realizados < 3
        ORDER BY prioridad, fecha_creacion
        LIMIT p_limite
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Actualizar estado a procesando
        UPDATE COLA_ENVIO SET 
            estado = 'PROCESANDO',
            intentos_realizados = intentos_realizados + 1,
            fecha_modificacion = CURRENT_TIMESTAMP
        WHERE id = v_registro.id;
        
        -- Simular envío (en producción se conectaría con proveedores externos)
        -- Aquí se registraría el resultado
        INSERT INTO REGISTRO_ENVIOS (
            cola_id, destinatario_id, destinatario_email, destinatario_telefono,
            canal, tipo, asunto, exitoso, fecha_envio
        ) VALUES (
            v_registro.id, v_registro.destinatario_id, v_registro.destinario_email,
            v_registro.destinatario_telefono, v_registro.canal, v_registro.tipo,
            v_registro.asunto, TRUE, CURRENT_TIMESTAMP
        );
        
        -- Actualizar estado a completado
        UPDATE COLA_ENVIO SET 
            estado = 'COMPLETADO',
            fecha_completado = CURRENT_TIMESTAMP,
            fecha_modificacion = CURRENT_TIMESTAMP
        WHERE id = v_registro.id;
        
        v_procesados := v_procesados + 1;
    END LOOP;
    
    RETURN v_procesados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION procesar_cola_envio IS 'Función para procesar la cola de envío de comunicaciones';

-- Función para crear recordatorio de cita
CREATE OR REPLACE FUNCTION crear_recordatorio_cita(
    p_cita_id BIGINT,
    p_horas_anticipacion INTEGER DEFAULT 24,
    p_canal canal_comunicacion_type DEFAULT 'EMAIL'
)
RETURNS INTEGER AS $$
DECLARE
    v_recordatorio_id INTEGER;
    v_fecha_cita TIMESTAMP WITH TIME ZONE;
    v_paciente_id INTEGER;
    v_usuario_id INTEGER;
    v_motivo TEXT;
BEGIN
    -- Obtener datos de la cita
    SELECT fecha_hora, id_paciente, motivo INTO v_fecha_cita, v_paciente_id, v_motivo
    FROM CITAS WHERE id = p_cita_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita no encontrada';
    END IF;
    
    -- Crear recordatorio
    INSERT INTO RECORDATORIOS_CITAS (
        cita_id, recordatorio_horas, canal, programado, fecha_programada
    ) VALUES (
        p_cita_id, p_horas_anticipacion, p_canal, TRUE, v_fecha_cita - INTERVAL '1 hour' * p_horas_anticipacion
    ) RETURNING id INTO v_recordatorio_id;
    
    RETURN v_recordatorio_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crear_recordatorio_cita IS 'Función para crear un recordatorio de cita';

-- Función para obtener notificaciones no leídas
CREATE OR REPLACE FUNCTION obtener_notificaciones_no_leidas(
    p_usuario_id INTEGER
)
RETURNS TABLE (
    id BIGINT,
    tipo tipo_notificacion_type,
    titulo VARCHAR(200),
    mensaje TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE,
    prioridad prioridad_mensaje_type
) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.tipo, n.titulo, n.mensaje, n.fecha_creacion, n.prioridad
    FROM NOTIFICACIONES n
    WHERE n.usuario_id = p_usuario_id
    AND n.leida = FALSE
    AND (n.fecha_expiracion IS NULL OR n.fecha_expiracion > CURRENT_TIMESTAMP)
    ORDER BY 
        CASE n.prioridad 
            WHEN 'URGENTE' THEN 1 
            WHEN 'ALTA' THEN 2 
            WHEN 'NORMAL' THEN 3 
            ELSE 4 
        END,
        n.fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_notificaciones_no_leidas IS 'Función para obtener notificaciones no leídas de un usuario';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha_modificacion en PLANTILLAS_COMUNICACION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_plantillas_comunicacion_update_fecha'
    ) THEN
        CREATE TRIGGER tr_plantillas_comunicacion_update_fecha
            BEFORE UPDATE ON PLANTILLAS_COMUNICACION
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en NOTIFICACIONES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notificaciones_update_fecha'
    ) THEN
        CREATE TRIGGER tr_notificaciones_update_fecha
            BEFORE UPDATE ON NOTIFICACIONES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en MENSAJES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_mensajes_update_fecha'
    ) THEN
        CREATE TRIGGER tr_mensajes_update_fecha
            BEFORE UPDATE ON MENSAJES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en COLA_ENVIO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_cola_envio_update_fecha'
    ) THEN
        CREATE TRIGGER tr_cola_envio_update_fecha
            BEFORE UPDATE ON COLA_ENVIO
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en CONFIGURACION_NOTIFICACIONES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_config_notif_update_fecha'
    ) THEN
        CREATE TRIGGER tr_config_notif_update_fecha
            BEFORE UPDATE ON CONFIGURACION_NOTIFICACIONES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en RECORDATORIOS_CITAS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_recordatorios_update_fecha'
    ) THEN
        CREATE TRIGGER tr_recordatorios_update_fecha
            BEFORE UPDATE ON RECORDATORIOS_CITAS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para PLANTILLAS_COMUNICACION
CREATE INDEX IF NOT EXISTS idx_plantillas_codigo ON PLANTILLAS_COMUNICACION(codigo);
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo ON PLANTILLAS_COMUNICACION(tipo);
CREATE INDEX IF NOT EXISTS idx_plantillas_activo ON PLANTILLAS_COMUNICACION(activo);
CREATE INDEX IF NOT EXISTS idx_plantillas_estado ON PLANTILLAS_COMUNICACION(estado);
CREATE INDEX IF NOT EXISTS idx_plantillas_canal ON PLANTILLAS_COMUNICACION(canal_default);

-- Índices para NOTIFICACIONES
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON NOTIFICACIONES(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_paciente ON NOTIFICACIONES(paciente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON NOTIFICACIONES(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON NOTIFICACIONES(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON NOTIFICACIONES(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON NOTIFICACIONES(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_estado ON NOTIFICACIONES(usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_referencia ON NOTIFICACIONES(referencia_tipo, referencia_id);

-- Índices para MENSAJES
CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON MENSAJES(remitente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_estado ON MENSAJES(estado);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON MENSAJES(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_mensajes_padre ON MENSAJES(mensaje_padre_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_programada ON MENSAJES(fecha_programada) WHERE fecha_programada IS NOT NULL;

-- Índices para MENSAJES_DESTINATARIOS
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_mensaje ON MENSAJES_DESTINATARIOS(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_usuario ON MENSAJES_DESTINATARIOS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_carpeta ON MENSAJES_DESTINATARIOS(carpeta);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_leido ON MENSAJES_DESTINATARIOS(leido);

-- Índices para COLA_ENVIO
CREATE INDEX IF NOT EXISTS idx_cola_estado ON COLA_ENVIO(estado);
CREATE INDEX IF NOT EXISTS idx_cola_tipo ON COLA_ENVIO(tipo);
CREATE INDEX IF NOT EXISTS idx_cola_canal ON COLA_ENVIO(canal);
CREATE INDEX IF NOT EXISTS idx_cola_destinatario ON COLA_ENVIO(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_cola_programada ON COLA_ENVIO(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_cola_prioridad ON COLA_ENVIO(prioridad, fecha_creacion);

-- Índices para CONFIGURACION_NOTIFICACIONES
CREATE INDEX IF NOT EXISTS idx_config_notif_usuario ON CONFIGURACION_NOTIFICACIONES(usuario_id);

-- Índices para REGISTRO_ENVIOS
CREATE INDEX IF NOT EXISTS idx_registro_cola ON REGISTRO_ENVIOS(cola_id);
CREATE INDEX IF NOT EXISTS idx_registro_notificacion ON REGISTRO_ENVIOS(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_registro_mensaje ON REGISTRO_ENVIOS(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_registro_destinatario ON REGISTRO_ENVIOS(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_registro_fecha ON REGISTRO_ENVIOS(fecha_envio);
CREATE INDEX IF NOT EXISTS idx_registro_canal ON REGISTRO_ENVIOS(canal);

-- Índices para RECORDATORIOS_CITAS
CREATE INDEX IF NOT EXISTS idx_recordatorios_cita ON RECORDATORIOS_CITAS(cita_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_enviado ON RECORDATORIOS_CITAS(enviado);
CREATE INDEX IF NOT EXISTS idx_recordatorios_programada ON RECORDATORIOS_CITAS(fecha_programada);

-- Índices GIN para JSONB
CREATE INDEX IF NOT EXISTS idx_notificaciones_datos ON NOTIFICACIONES USING GIN (datos_adicionales);
CREATE INDEX IF NOT EXISTS idx_mensajes_adjuntos ON MENSAJES USING GIN (adjuntos);
CREATE INDEX IF NOT EXISTS idx_cola_datos ON COLA_ENVIO USING GIN (datos);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de notificaciones por usuario
CREATE OR REPLACE VIEW v_notificaciones_usuario AS
SELECT
    n.id,
    n.usuario_id,
    n.tipo,
    n.titulo,
    n.mensaje,
    n.estado,
    n.leida,
    n.fecha_creacion,
    n.fecha_lectura,
    n.prioridad,
    n.url_accion,
    CASE 
        WHEN n.paciente_id IS NOT NULL THEN CONCAT(p.nombre, ' ', p.apellido)
        ELSE NULL
    END as nombre_paciente,
    n.referencia_tipo,
    n.referencia_id
FROM NOTIFICACIONES n
LEFT JOIN PACIENTES p ON n.paciente_id = p.id
ORDER BY n.fecha_creacion DESC;

COMMENT ON VIEW v_notificaciones_usuario IS 'Vista de notificaciones con información de paciente relacionado';

-- Vista de mensajes de usuario
CREATE OR REPLACE VIEW v_mensajes_usuario AS
SELECT
    m.id,
    m.asunto,
    m.contenido,
    m.prioridad,
    m.estado,
    m.fecha_creacion,
    m.fecha_envio,
    md.usuario_id,
    md.tipo_destinatario,
    md.carpeta,
    md.leido,
    md.fecha_lectura,
    CASE 
        WHEN m.remitente_id = md.usuario_id THEN 'ENVIADO'
        ELSE 'RECIBIDO'
    END as direccion,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_remitente
FROM MENSAJES m
JOIN MENSAJES_DESTINATARIOS md ON m.id = md.mensaje_id
JOIN USUARIOS u ON m.remitente_id = u.id
WHERE md.eliminado = FALSE;

COMMENT ON VIEW v_mensajes_usuario IS 'Vista de mensajes con información de destinatarios';

-- Vista de cola de envío pendiente
CREATE OR REPLACE VIEW v_cola_pendiente AS
SELECT
    c.id,
    c.tipo,
    c.canal,
    c.asunto,
    c.estado,
    c.prioridad,
    c.intentos_realizados,
    c.fecha_creacion,
    c.fecha_programada,
    CASE 
        WHEN c.destinatario_id IS NOT NULL THEN CONCAT(u.nombres, ' ', u.apellidos)
        WHEN c.destinatario_email IS NOT NULL THEN c.destinatario_email
        WHEN c.destinatario_telefono IS NOT NULL THEN c.destinatario_telefono
        ELSE 'Desconocido'
    END as destinatario
FROM COLA_ENVIO c
LEFT JOIN USUARIOS u ON c.destinatario_id = u.id
WHERE c.estado IN ('PENDIENTE', 'REINTENTO')
ORDER BY c.prioridad, c.fecha_creacion;

COMMENT ON VIEW v_cola_pendiente IS 'Vista de elementos pendientes en la cola de envío';

-- Vista de estadísticas de envío
CREATE OR REPLACE VIEW v_estadisticas_envio AS
SELECT
    canal,
    tipo,
    COUNT(*) as total_envios,
    SUM(CASE WHEN exitoso THEN 1 ELSE 0 END) as exitosos,
    SUM(CASE WHEN exitoso THEN 0 ELSE 1 END) as fallidos,
    AVG(duracion_ms) as promedio_duracion_ms,
    MAX(fecha_envio) as ultimo_envio
FROM REGISTRO_ENVIOS
GROUP BY canal, tipo
ORDER BY canal, tipo;

COMMENT ON VIEW v_estadisticas_envio IS 'Vista de estadísticas de envíos por canal y tipo';

-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar plantillas de comunicación por defecto
INSERT INTO PLANTILLAS_COMUNICACION (codigo, nombre, descripcion, tipo, asunto, contenido, contenido_html, variables, canal_default, idioma, activo, estado, creado_por)
SELECT 
    'NOTIF-CITA-RECORDATORIO', 
    'Recordatorio de Cita', 
    'Plantilla para recordatorio de cita médica',
    'NOTIFICACION',
    'Recordatorio de su cita médica',
    'Estimado/a {nombre_paciente}, le recordamos que tiene una cita programada para el {fecha_cita} a las {hora_cita} con el Dr./Dra. {nombre_medico}.',
    '<p>Estimado/a <strong>{nombre_paciente}</strong>,</p><p>Le recordamos que tiene una cita programada para el <strong>{fecha_cita}</strong> a las <strong>{hora_cita}</strong> con el Dr./Dra. <strong>{nombre_medico}</strong>.</p>',
    '["nombre_paciente", "fecha_cita", "hora_cita", "nombre_medico"]'::jsonb,
    'EMAIL',
    'es',
    TRUE,
    'ACTIVA',
    id
FROM USUARIOS WHERE rol_id = (SELECT id FROM ROLES WHERE nombre = 'Administrador' LIMIT 1) LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO PLANTILLAS_COMUNICACION (codigo, nombre, descripcion, tipo, asunto, contenido, contenido_html, variables, canal_default, idioma, activo, estado, creado_por)
SELECT 
    'NOTIF-CITA-CANCELACION', 
    'Cancelación de Cita', 
    'Plantilla para notificación de cancelación de cita',
    'NOTIFICACION',
    'Cancelación de su cita médica',
    'Estimado/a {nombre_paciente}, su cita programada para el {fecha_cita} ha sido cancelada. Motivo: {motivo}.',
    '<p>Estimado/a <strong>{nombre_paciente}</strong>,</p><p>Su cita programada para el <strong>{fecha_cita}</strong> ha sido cancelada.</p><p><strong>Motivo:</strong> {motivo}</p>',
    '["nombre_paciente", "fecha_cita", "motivo"]'::jsonb,
    'EMAIL',
    'es',
    TRUE,
    'ACTIVA',
    id
FROM USUARIOS WHERE rol_id = (SELECT id FROM ROLES WHERE nombre = 'Administrador' LIMIT 1) LIMIT 1
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO PLANTILLAS_COMUNICACION (codigo, nombre, descripcion, tipo, asunto, contenido, contenido_html, variables, canal_default, idioma, activo, estado, creado_por)
SELECT 
    'NOTIF-SEGURIDAD-ACCESO', 
    'Alerta de Seguridad', 
    'Plantilla para alertas de seguridad de acceso',
    'NOTIFICACION',
    'Alerta de seguridad: Nuevo acceso detectado',
    'Se ha detectado un nuevo acceso a su cuenta desde {ip_address} en {fecha_hora}. Si no fue usted, contacte a soporte.',
    '<p>Se ha detectado un nuevo acceso a su cuenta desde <strong>{ip_address}</strong> en <strong>{fecha_hora}</strong>.</p><p>Si no fue usted, contacte a soporte inmediatamente.</p>',
    '["ip_address", "fecha_hora"]'::jsonb,
    'EMAIL',
    'es',
    TRUE,
    'ACTIVA',
    id
FROM USUARIOS WHERE rol_id = (SELECT id FROM ROLES WHERE nombre = 'Administrador' LIMIT 1) LIMIT 1
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
    AND tablename IN ('plantillas_comunicacion', 'notificaciones', 'mensajes', 
                       'mensajes_destinatarios', 'cola_envio', 'configuracion_notificaciones',
                       'registro_envios', 'recordatorios_citas');
    
    IF tablas_creadas = 8 THEN
        RAISE NOTICE 'Migración 11 completada exitosamente. 8 tablas creadas/verificadas.';
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
DROP VIEW IF EXISTS v_estadisticas_envio CASCADE;
DROP VIEW IF EXISTS v_cola_pendiente CASCADE;
DROP VIEW IF EXISTS v_mensajes_usuario CASCADE;
DROP VIEW IF EXISTS v_notificaciones_usuario CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS obtener_notificaciones_no_leidas(INTEGER);
DROP FUNCTION IF EXISTS crear_recordatorio_cita(BIGINT, INTEGER, canal_comunicacion_type);
DROP FUNCTION IF EXISTS procesar_cola_envio(INTEGER);
DROP FUNCTION IF EXISTS enviar_mensaje(INTEGER, JSONB, VARCHAR, TEXT, TEXT, prioridad_mensaje_type, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS enviar_notificacion(INTEGER, tipo_notificacion_type, VARCHAR, TEXT, JSONB, canal_comunicacion_type, VARCHAR, VARCHAR, VARCHAR, prioridad_mensaje_type, TIMESTAMP WITH TIME ZONE);

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_recordatorios_update_fecha ON RECORDATORIOS_CITAS;
DROP TRIGGER IF EXISTS tr_config_notif_update_fecha ON CONFIGURACION_NOTIFICACIONES;
DROP TRIGGER IF EXISTS tr_cola_envio_update_fecha ON COLA_ENVIO;
DROP TRIGGER IF EXISTS tr_mensajes_update_fecha ON MENSAJES;
DROP TRIGGER IF EXISTS tr_notificaciones_update_fecha ON NOTIFICACIONES;
DROP TRIGGER IF EXISTS tr_plantillas_comunicacion_update_fecha ON PLANTILLAS_COMUNICACION;

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS RECORDATORIOS_CITAS CASCADE;
DROP TABLE IF EXISTS REGISTRO_ENVIOS CASCADE;
DROP TABLE IF EXISTS CONFIGURACION_NOTIFICACIONES CASCADE;
DROP TABLE IF EXISTS COLA_ENVIO CASCADE;
DROP TABLE IF EXISTS MENSAJES_DESTINATARIOS CASCADE;
DROP TABLE IF EXISTS MENSAJES CASCADE;
DROP TABLE IF EXISTS NOTIFICACIONES CASCADE;
DROP TABLE IF EXISTS PLANTILLAS_COMUNICACION CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS estado_cola_type;
DROP DOMAIN IF EXISTS tipo_cola_type;
DROP DOMAIN IF EXISTS estado_plantilla_type;
DROP DOMAIN IF EXISTS tipo_plantilla_type;
DROP DOMAIN IF EXISTS prioridad_mensaje_type;
DROP DOMAIN IF EXISTS estado_mensaje_type;
DROP DOMAIN IF EXISTS canal_comunicacion_type;
DROP DOMAIN IF EXISTS estado_notificacion_type;
DROP DOMAIN IF EXISTS tipo_notificacion_type;

COMMIT;
*/