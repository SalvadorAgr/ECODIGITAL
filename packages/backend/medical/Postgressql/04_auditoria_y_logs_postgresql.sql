-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Auditoría y Logs (WORM Pattern) - PostgreSQL
-- Descripción: Logs inmutables y sistema de auditoría
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: LOGS_AUDITORIA (Inmutable - WORM Pattern)
-- =====================================================
CREATE TABLE IF NOT EXISTS LOGS_AUDITORIA (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificación del evento
    evento_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN (
        'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA',
        'CREAR_REGISTRO', 'ACTUALIZAR_REGISTRO', 'ELIMINAR_REGISTRO', 'CONSULTAR_REGISTRO',
        'SUBIR_ARCHIVO', 'DESCARGAR_ARCHIVO', 'ELIMINAR_ARCHIVO',
        'CAMBIO_PERMISOS', 'CAMBIO_ROL', 'CAMBIO_PASSWORD',
        'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO',
        'BACKUP_CREADO', 'RESTAURACION_DATOS',
        'CONFIGURACION_CAMBIADA', 'MANTENIMIENTO_SISTEMA',
        'ERROR_SISTEMA', 'ALERTA_SEGURIDAD'
    )),
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN (
        'AUTENTICACION', 'AUTORIZACION', 'DATOS_PACIENTE', 'HISTORIAL_CLINICO',
        'DOCUMENTOS', 'CITAS', 'USUARIOS', 'SISTEMA', 'SEGURIDAD', 'REPORTES'
    )),
    nivel_criticidad VARCHAR(10) NOT NULL DEFAULT 'MEDIO' CHECK (nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
    
    -- Información del usuario
    usuario_id INTEGER NULL,
    username VARCHAR(50) NULL,
    rol_usuario VARCHAR(50) NULL,
    
    -- Información de la sesión
    sesion_id VARCHAR(100) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    dispositivo VARCHAR(100) NULL,
    ubicacion_geografica VARCHAR(200) NULL,
    
    -- Información del recurso afectado
    modulo VARCHAR(50) NOT NULL,
    recurso_tipo VARCHAR(50) NULL,
    recurso_id VARCHAR(36) NULL,
    recurso_nombre VARCHAR(200) NULL,
    
    -- Detalles de la operación
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    datos_antes JSONB NULL,
    datos_despues JSONB NULL,
    metadatos_adicionales JSONB NULL,
    
    -- Información temporal
    fecha_evento TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_hora TIMESTAMP(6) GENERATED ALWAYS AS (fecha_evento) STORED,
    duracion_ms INTEGER NULL,
    
    -- Información de integridad (WORM)
    hash_integridad VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64) NULL,
    numero_secuencia BIGINT NOT NULL,
    
    -- Información de resultado
    resultado VARCHAR(10) NOT NULL DEFAULT 'EXITOSO' CHECK (resultado IN ('EXITOSO', 'FALLIDO', 'PARCIAL', 'CANCELADO')),
    codigo_error VARCHAR(20) NULL,
    mensaje_error TEXT NULL,
    
    -- Información de cumplimiento
    requiere_retencion BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_retencion_hasta DATE NULL,
    politica_retencion VARCHAR(50) NULL,
    
    -- Metadatos del sistema
    version_aplicacion VARCHAR(20) NULL,
    servidor VARCHAR(50) NULL,
    proceso_id VARCHAR(50) NULL,
    
    UNIQUE(evento_id)
);

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

-- =====================================================
-- TABLA: REPORTES_PROGRAMADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS REPORTES_PROGRAMADOS (
    id SERIAL PRIMARY KEY,
    
    -- Identificación del reporte
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    tipo_reporte VARCHAR(25) NOT NULL CHECK (tipo_reporte IN (
        'ACTIVIDAD_USUARIOS', 'GESTION_PACIENTES', 'CITAS_MEDICAS',
        'DOCUMENTOS', 'SEGURIDAD', 'RENDIMIENTO', 'CUMPLIMIENTO',
        'ESTADISTICAS_GENERALES', 'PERSONALIZADO'
    )),
    
    -- Configuración de generación
    plantilla_id VARCHAR(50) NULL,
    parametros_reporte JSONB NOT NULL,
    formato_salida VARCHAR(10) NOT NULL DEFAULT 'PDF' CHECK (formato_salida IN ('PDF', 'EXCEL', 'CSV', 'JSON', 'HTML')),
    
    -- Programación
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    frecuencia VARCHAR(15) NOT NULL CHECK (frecuencia IN ('DIARIO', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'ANUAL', 'PERSONALIZADO')),
    cron_expresion VARCHAR(50) NULL,
    dia_semana SMALLINT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    dia_mes SMALLINT NULL CHECK (dia_mes BETWEEN 1 AND 31),
    hora_ejecucion TIME NOT NULL DEFAULT '08:00:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
    
    -- Distribución
    destinatarios JSONB NOT NULL,
    incluir_graficos BOOLEAN NOT NULL DEFAULT TRUE,
    incluir_datos_detallados BOOLEAN NOT NULL DEFAULT TRUE,
    password_protegido BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Fechas de ejecución
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    proxima_ejecucion TIMESTAMP NULL,
    ultima_ejecucion TIMESTAMP NULL,
    
    -- Información de creación
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_por INTEGER NULL,
    fecha_modificacion TIMESTAMP NULL
);

-- Índices para REPORTES_PROGRAMADOS
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON REPORTES_PROGRAMADOS(tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_reportes_activo_proxima ON REPORTES_PROGRAMADOS(activo, proxima_ejecucion);
CREATE INDEX IF NOT EXISTS idx_reportes_creado_por ON REPORTES_PROGRAMADOS(creado_por);

-- =====================================================
-- TABLA: EJECUCIONES_REPORTES
-- =====================================================
CREATE TABLE IF NOT EXISTS EJECUCIONES_REPORTES (
    id BIGSERIAL PRIMARY KEY,
    
    -- Referencia al reporte
    reporte_programado_id INTEGER NULL,
    nombre_reporte VARCHAR(100) NOT NULL,
    tipo_ejecucion VARCHAR(15) NOT NULL DEFAULT 'MANUAL' CHECK (tipo_ejecucion IN ('PROGRAMADA', 'MANUAL', 'API')),
    
    -- Información de ejecución
    usuario_solicitante INTEGER NULL,
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio_procesamiento TIMESTAMP NULL,
    fecha_fin_procesamiento TIMESTAMP NULL,
    duracion_segundos INTEGER NULL,
    
    -- Estado y resultado
    estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO', 'CANCELADO')),
    progreso_porcentaje SMALLINT NOT NULL DEFAULT 0 CHECK (progreso_porcentaje BETWEEN 0 AND 100),
    mensaje_estado TEXT NULL,
    
    -- Parámetros utilizados
    parametros_utilizados JSONB NOT NULL,
    formato_generado VARCHAR(10) NOT NULL CHECK (formato_generado IN ('PDF', 'EXCEL', 'CSV', 'JSON', 'HTML')),
    
    -- Información del archivo generado
    archivo_nombre VARCHAR(255) NULL,
    archivo_ruta VARCHAR(500) NULL,
    archivo_tamaño_bytes BIGINT NULL,
    archivo_hash VARCHAR(64) NULL,
    
    -- Estadísticas del reporte
    registros_procesados INTEGER NULL,
    registros_incluidos INTEGER NULL,
    paginas_generadas INTEGER NULL,
    
    -- Distribución
    destinatarios_enviados JSONB NULL,
    fecha_envio TIMESTAMP NULL,
    
    -- Información de error
    codigo_error VARCHAR(20) NULL,
    detalle_error TEXT NULL,
    stack_trace TEXT NULL,
    
    -- Retención y limpieza
    fecha_expiracion TIMESTAMP NULL,
    eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_eliminacion TIMESTAMP NULL
);

-- Índices para EJECUCIONES_REPORTES
CREATE INDEX IF NOT EXISTS idx_ejecuciones_reporte_programado ON EJECUCIONES_REPORTES(reporte_programado_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_usuario_fecha ON EJECUCIONES_REPORTES(usuario_solicitante, fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_estado_fecha ON EJECUCIONES_REPORTES(estado, fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_tipo ON EJECUCIONES_REPORTES(tipo_ejecucion);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_fecha_expiracion ON EJECUCIONES_REPORTES(fecha_expiracion);

-- =====================================================
-- TABLA: PLANTILLAS_REPORTES
-- =====================================================
CREATE TABLE IF NOT EXISTS PLANTILLAS_REPORTES (
    id VARCHAR(50) PRIMARY KEY,
    
    -- Información básica
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    categoria VARCHAR(15) NOT NULL CHECK (categoria IN (
        'MEDICO', 'ADMINISTRATIVO', 'FINANCIERO', 'SEGURIDAD',
        'OPERACIONAL', 'CUMPLIMIENTO', 'ESTADISTICO'
    )),
    
    -- Configuración de la plantilla
    tipo_datos VARCHAR(15) NOT NULL CHECK (tipo_datos IN (
        'PACIENTES', 'CITAS', 'HISTORIALES', 'DOCUMENTOS',
        'USUARIOS', 'AUDITORIA', 'MIXTO'
    )),
    consulta_sql TEXT NULL,
    campos_disponibles JSONB NOT NULL,
    filtros_disponibles JSONB NOT NULL,
    
    -- Configuración de formato
    formatos_soportados JSONB NOT NULL,
    plantilla_html TEXT NULL,
    estilos_css TEXT NULL,
    configuracion_pdf JSONB NULL,
    
    -- Configuración de gráficos
    incluye_graficos BOOLEAN NOT NULL DEFAULT FALSE,
    tipos_graficos_disponibles JSONB NULL,
    configuracion_graficos JSONB NULL,
    
    -- Metadatos
    es_sistema BOOLEAN NOT NULL DEFAULT FALSE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    
    -- Información de creación
    creado_por INTEGER NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_por INTEGER NULL,
    fecha_modificacion TIMESTAMP NULL
);

-- Índices para PLANTILLAS_REPORTES
CREATE INDEX IF NOT EXISTS idx_plantillas_categoria ON PLANTILLAS_REPORTES(categoria);
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo_datos ON PLANTILLAS_REPORTES(tipo_datos);
CREATE INDEX IF NOT EXISTS idx_plantillas_activa ON PLANTILLAS_REPORTES(activa);
CREATE INDEX IF NOT EXISTS idx_plantillas_es_sistema ON PLANTILLAS_REPORTES(es_sistema);

-- =====================================================
-- TABLA: ALERTAS_AUDITORIA
-- =====================================================
CREATE TABLE IF NOT EXISTS ALERTAS_AUDITORIA (
    id SERIAL PRIMARY KEY,
    
    -- Identificación de la alerta
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    tipo_alerta VARCHAR(30) NOT NULL CHECK (tipo_alerta IN (
        'ACCESO_NO_AUTORIZADO', 'MULTIPLES_INTENTOS_FALLIDOS', 'ACCESO_FUERA_HORARIO',
        'CAMBIOS_MASIVOS', 'ELIMINACIONES_MASIVAS', 'ACCESO_DATOS_SENSIBLES',
        'PATRON_SOSPECHOSO', 'CONFIGURACION_CRITICA', 'ERROR_SISTEMA',
        'UMBRAL_SUPERADO', 'PERSONALIZADA'
    )),
    
    -- Configuración de detección
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    nivel_severidad VARCHAR(15) NOT NULL DEFAULT 'ADVERTENCIA' CHECK (nivel_severidad IN ('INFORMATIVO', 'ADVERTENCIA', 'CRITICO', 'EMERGENCIA')),
    condiciones_deteccion JSONB NOT NULL,
    umbral_cantidad INTEGER NULL,
    ventana_tiempo_minutos INTEGER NULL,
    
    -- Configuración de notificación
    notificar_email BOOLEAN NOT NULL DEFAULT TRUE,
    notificar_sms BOOLEAN NOT NULL DEFAULT FALSE,
    notificar_sistema BOOLEAN NOT NULL DEFAULT TRUE,
    destinatarios_email JSONB NULL,
    destinatarios_sms JSONB NULL,
    
    -- Configuración de escalamiento
    escalar_si_no_resuelve BOOLEAN NOT NULL DEFAULT FALSE,
    tiempo_escalamiento_minutos INTEGER NULL,
    destinatarios_escalamiento JSONB NULL,
    
    -- Plantilla de mensaje
    plantilla_mensaje TEXT NOT NULL,
    incluir_detalles_evento BOOLEAN NOT NULL DEFAULT TRUE,
    incluir_contexto_usuario BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Información de creación
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_por INTEGER NULL,
    fecha_modificacion TIMESTAMP NULL
);

-- Índices para ALERTAS_AUDITORIA
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON ALERTAS_AUDITORIA(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alertas_activa_severidad ON ALERTAS_AUDITORIA(activa, nivel_severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_creado_por ON ALERTAS_AUDITORIA(creado_por);

-- =====================================================
-- TABLA: INSTANCIAS_ALERTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS INSTANCIAS_ALERTAS (
    id BIGSERIAL PRIMARY KEY,
    
    -- Referencia a la alerta
    alerta_id INTEGER NOT NULL,
    
    -- Información del evento que disparó la alerta
    evento_disparador_id BIGINT NULL,
    eventos_relacionados JSONB NULL,
    
    -- Información de la instancia
    fecha_deteccion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nivel_severidad VARCHAR(15) NOT NULL CHECK (nivel_severidad IN ('INFORMATIVO', 'ADVERTENCIA', 'CRITICO', 'EMERGENCIA')),
    mensaje_generado TEXT NOT NULL,
    contexto_deteccion JSONB NOT NULL,
    
    -- Estado de la alerta
    estado VARCHAR(15) NOT NULL DEFAULT 'NUEVA' CHECK (estado IN ('NUEVA', 'NOTIFICADA', 'EN_REVISION', 'RESUELTA', 'FALSA_ALARMA', 'ESCALADA')),
    fecha_notificacion TIMESTAMP NULL,
    fecha_resolucion TIMESTAMP NULL,
    resuelto_por INTEGER NULL,
    notas_resolucion TEXT NULL,
    
    -- Información de notificación
    notificaciones_enviadas JSONB NULL,
    escalado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_escalamiento TIMESTAMP NULL,
    
    -- Métricas
    tiempo_deteccion_ms INTEGER NULL,
    tiempo_resolucion_minutos INTEGER NULL
);

-- Índices para INSTANCIAS_ALERTAS
CREATE INDEX IF NOT EXISTS idx_instancias_alerta_fecha ON INSTANCIAS_ALERTAS(alerta_id, fecha_deteccion);
CREATE INDEX IF NOT EXISTS idx_instancias_estado_fecha ON INSTANCIAS_ALERTAS(estado, fecha_deteccion);
CREATE INDEX IF NOT EXISTS idx_instancias_evento_disparador ON INSTANCIAS_ALERTAS(evento_disparador_id);
CREATE INDEX IF NOT EXISTS idx_instancias_nivel_severidad ON INSTANCIAS_ALERTAS(nivel_severidad);
CREATE INDEX IF NOT EXISTS idx_instancias_resuelto_por ON INSTANCIAS_ALERTAS(resuelto_por);

-- =====================================================
-- TABLA: METRICAS_SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS METRICAS_SISTEMA (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificación de la métrica
    nombre_metrica VARCHAR(100) NOT NULL,
    categoria VARCHAR(15) NOT NULL CHECK (categoria IN (
        'RENDIMIENTO', 'SEGURIDAD', 'USUARIOS', 'DATOS',
        'SISTEMA', 'NEGOCIO', 'CUMPLIMIENTO'
    )),
    
    -- Valor de la métrica
    valor_numerico DECIMAL(15,4) NULL,
    valor_texto VARCHAR(500) NULL,
    valor_json JSONB NULL,
    unidad_medida VARCHAR(20) NULL,
    
    -- Información temporal
    fecha_metrica TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    periodo_agregacion VARCHAR(15) NOT NULL DEFAULT 'INSTANTANEO' CHECK (periodo_agregacion IN ('INSTANTANEO', 'MINUTO', 'HORA', 'DIA', 'SEMANA', 'MES')),
    
    -- Contexto adicional
    etiquetas JSONB NULL,
    metadatos JSONB NULL,
    
    -- Información de origen
    origen_sistema VARCHAR(50) NOT NULL DEFAULT 'ecosecial',
    componente VARCHAR(50) NULL
);

-- Índices para METRICAS_SISTEMA
CREATE INDEX IF NOT EXISTS idx_metricas_nombre_fecha ON METRICAS_SISTEMA(nombre_metrica, fecha_metrica);
CREATE INDEX IF NOT EXISTS idx_metricas_categoria_fecha ON METRICAS_SISTEMA(categoria, fecha_metrica);
CREATE INDEX IF NOT EXISTS idx_metricas_periodo_fecha ON METRICAS_SISTEMA(periodo_agregacion, fecha_metrica);
CREATE INDEX IF NOT EXISTS idx_metricas_origen_componente ON METRICAS_SISTEMA(origen_sistema, componente);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- LOGS_AUDITORIA
ALTER TABLE LOGS_AUDITORIA 
ADD CONSTRAINT fk_logs_usuario 
FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- REPORTES_PROGRAMADOS
ALTER TABLE REPORTES_PROGRAMADOS 
ADD CONSTRAINT fk_reportes_creador 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE REPORTES_PROGRAMADOS 
ADD CONSTRAINT fk_reportes_modificador 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- EJECUCIONES_REPORTES
ALTER TABLE EJECUCIONES_REPORTES 
ADD CONSTRAINT fk_ejecuciones_reporte 
FOREIGN KEY (reporte_programado_id) REFERENCES REPORTES_PROGRAMADOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE EJECUCIONES_REPORTES 
ADD CONSTRAINT fk_ejecuciones_usuario 
FOREIGN KEY (usuario_solicitante) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- PLANTILLAS_REPORTES
ALTER TABLE PLANTILLAS_REPORTES 
ADD CONSTRAINT fk_plantillas_creador 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE PLANTILLAS_REPORTES 
ADD CONSTRAINT fk_plantillas_modificador 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- ALERTAS_AUDITORIA
ALTER TABLE ALERTAS_AUDITORIA 
ADD CONSTRAINT fk_alertas_creador 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ALERTAS_AUDITORIA 
ADD CONSTRAINT fk_alertas_modificador 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- INSTANCIAS_ALERTAS
ALTER TABLE INSTANCIAS_ALERTAS 
ADD CONSTRAINT fk_instancias_alerta 
FOREIGN KEY (alerta_id) REFERENCES ALERTAS_AUDITORIA(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE INSTANCIAS_ALERTAS 
ADD CONSTRAINT fk_instancias_evento 
FOREIGN KEY (evento_disparador_id) REFERENCES LOGS_AUDITORIA(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE INSTANCIAS_ALERTAS 
ADD CONSTRAINT fk_instancias_resuelto 
FOREIGN KEY (resuelto_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TRIGGERS PARA LOGS INMUTABLES (WORM Pattern)
-- =====================================================

-- Función para prevenir actualizaciones en logs de auditoría
CREATE OR REPLACE FUNCTION prevent_logs_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser modificados';
END;
$$ LANGUAGE plpgsql;

-- Función para prevenir eliminaciones en logs de auditoría
CREATE OR REPLACE FUNCTION prevent_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser eliminados';
END;
$$ LANGUAGE plpgsql;

-- Función para generar hash de integridad y número de secuencia
CREATE OR REPLACE FUNCTION generate_log_integrity()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_numero_secuencia BIGINT DEFAULT 0;
    ultimo_hash VARCHAR(64) DEFAULT '';
    datos_hash TEXT;
BEGIN
    -- Obtener último número de secuencia y hash
    SELECT COALESCE(MAX(numero_secuencia), 0), COALESCE(MAX(hash_integridad), '')
    INTO ultimo_numero_secuencia, ultimo_hash
    FROM LOGS_AUDITORIA;
    
    -- Asignar número de secuencia
    NEW.numero_secuencia = ultimo_numero_secuencia + 1;
    NEW.hash_anterior = ultimo_hash;
    
    -- Preparar datos para hash
    datos_hash = CONCAT(
        COALESCE(NEW.evento_id::TEXT, ''), '|',
        COALESCE(NEW.tipo_evento, ''), '|',
        COALESCE(NEW.categoria, ''), '|',
        COALESCE(NEW.usuario_id::TEXT, ''), '|',
        COALESCE(NEW.modulo, ''), '|',
        COALESCE(NEW.accion, ''), '|',
        COALESCE(NEW.descripcion, ''), '|',
        COALESCE(NEW.fecha_evento::TEXT, ''), '|',
        COALESCE(NEW.numero_secuencia::TEXT, ''), '|',
        COALESCE(NEW.hash_anterior, '')
    );
    
    -- Generar hash de integridad
    NEW.hash_integridad = encode(digest(datos_hash, 'sha256'), 'hex');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para logs inmutables
CREATE TRIGGER tr_logs_auditoria_prevent_update
    BEFORE UPDATE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_update();

CREATE TRIGGER tr_logs_auditoria_prevent_delete
    BEFORE DELETE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_delete();

CREATE TRIGGER tr_logs_auditoria_before_insert
    BEFORE INSERT ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION generate_log_integrity();

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR fecha_modificacion
-- =====================================================

-- Trigger para REPORTES_PROGRAMADOS
CREATE TRIGGER tr_reportes_update_fecha_modificacion
    BEFORE UPDATE ON REPORTES_PROGRAMADOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para PLANTILLAS_REPORTES
CREATE TRIGGER tr_plantillas_update_fecha_modificacion
    BEFORE UPDATE ON PLANTILLAS_REPORTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para ALERTAS_AUDITORIA
CREATE TRIGGER tr_alertas_update_fecha_modificacion
    BEFORE UPDATE ON ALERTAS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- =====================================================
-- PROCEDIMIENTOS ALMACENADOS PARA AUDITORÍA
-- =====================================================

-- Procedimiento para crear log de auditoría
CREATE OR REPLACE FUNCTION sp_crear_log_auditoria(
    p_evento_id UUID DEFAULT NULL,
    p_tipo_evento VARCHAR(50) DEFAULT NULL,
    p_categoria VARCHAR(50) DEFAULT NULL,
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
        p_tipo_evento, p_categoria, p_nivel_criticidad,
        p_usuario_id, p_username, p_rol_usuario, p_sesion_id,
        p_ip_address, p_user_agent, p_modulo, p_accion, p_descripcion,
        p_recurso_tipo, p_recurso_id, p_datos_antes, p_datos_despues,
        p_resultado, p_duracion_ms, TRUE
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento para verificar integridad de logs
CREATE OR REPLACE FUNCTION sp_verificar_integridad_logs(
    p_fecha_desde DATE,
    p_fecha_hasta DATE,
    OUT p_total_logs INTEGER,
    OUT p_logs_validos INTEGER,
    OUT p_logs_invalidos INTEGER
)
AS $$
DECLARE
    rec RECORD;
    v_hash_calculado VARCHAR(64);
    datos_hash TEXT;
BEGIN
    p_total_logs := 0;
    p_logs_validos := 0;
    p_logs_invalidos := 0;
    
    FOR rec IN
        SELECT id, hash_integridad, evento_id, tipo_evento, categoria, usuario_id,
               modulo, accion, descripcion, fecha_evento, numero_secuencia, hash_anterior
        FROM LOGS_AUDITORIA
        WHERE DATE(fecha_evento) BETWEEN p_fecha_desde AND p_fecha_hasta
        ORDER BY numero_secuencia
    LOOP
        p_total_logs := p_total_logs + 1;
        
        datos_hash := CONCAT(
            COALESCE(rec.evento_id::TEXT, ''), '|',
            COALESCE(rec.tipo_evento, ''), '|',
            COALESCE(rec.categoria, ''), '|',
            COALESCE(rec.usuario_id::TEXT, ''), '|',
            COALESCE(rec.modulo, ''), '|',
            COALESCE(rec.accion, ''), '|',
            COALESCE(rec.descripcion, ''), '|',
            COALESCE(rec.fecha_evento::TEXT, ''), '|',
            COALESCE(rec.numero_secuencia::TEXT, ''), '|',
            COALESCE(rec.hash_anterior, '')
        );
        
        v_hash_calculado := encode(digest(datos_hash, 'sha256'), 'hex');
        
        IF v_hash_calculado = rec.hash_integridad THEN
            p_logs_validos := p_logs_validos + 1;
        ELSE
            p_logs_invalidos := p_logs_invalidos + 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Plantillas de reportes del sistema
INSERT INTO PLANTILLAS_REPORTES (
    id, nombre, descripcion, categoria, tipo_datos, 
    campos_disponibles, filtros_disponibles, formatos_soportados,
    es_sistema, activa
) VALUES 
(
    'RPT_ACTIVIDAD_USUARIOS',
    'Reporte de Actividad de Usuarios',
    'Reporte detallado de la actividad de usuarios en el sistema',
    'ADMINISTRATIVO',
    'USUARIOS',
    '["usuario", "rol", "fecha_acceso", "acciones_realizadas", "tiempo_sesion", "ip_address"]',
    '["fecha_desde", "fecha_hasta", "usuario_id", "rol_id", "tipo_evento"]',
    '["PDF", "EXCEL", "CSV"]',
    TRUE,
    TRUE
),
(
    'RPT_GESTION_PACIENTES',
    'Reporte de Gestión de Pacientes',
    'Estadísticas y detalles de la gestión de pacientes',
    'MEDICO',
    'PACIENTES',
    '["nombre_completo", "edad", "genero", "fecha_registro", "ultima_cita", "documentos_count"]',
    '["fecha_desde", "fecha_hasta", "genero", "edad_min", "edad_max", "registrado_por"]',
    '["PDF", "EXCEL", "CSV"]',
    TRUE,
    TRUE
),
(
    'RPT_SEGURIDAD',
    'Reporte de Seguridad',
    'Análisis de eventos de seguridad y accesos',
    'SEGURIDAD',
    'AUDITORIA',
    '["fecha_evento", "tipo_evento", "usuario", "ip_address", "resultado", "detalles"]',
    '["fecha_desde", "fecha_hasta", "tipo_evento", "nivel_criticidad", "usuario_id"]',
    '["PDF", "EXCEL"]',
    TRUE,
    TRUE
);

-- Alertas de seguridad predefinidas
INSERT INTO ALERTAS_AUDITORIA (
    nombre, descripcion, tipo_alerta, nivel_severidad,
    condiciones_deteccion, umbral_cantidad, ventana_tiempo_minutos,
    plantilla_mensaje, creado_por
) VALUES 
(
    'Múltiples Intentos de Login Fallidos',
    'Detecta múltiples intentos de login fallidos desde la misma IP',
    'MULTIPLES_INTENTOS_FALLIDOS',
    'ADVERTENCIA',
    '{"tipo_evento": "LOGIN_FALLIDO", "agrupar_por": "ip_address"}',
    5,
    15,
    'Se han detectado {cantidad} intentos de login fallidos desde la IP {ip_address} en los últimos {tiempo} minutos.',
    1
),
(
    'Acceso Fuera de Horario',
    'Detecta accesos al sistema fuera del horario laboral',
    'ACCESO_FUERA_HORARIO',
    'INFORMATIVO',
    '{"tipo_evento": "LOGIN_EXITOSO", "horario_inicio": "07:00", "horario_fin": "20:00"}',
    1,
    NULL,
    'Usuario {usuario} accedió al sistema fuera del horario laboral a las {hora}.',
    1
),
(
    'Cambios Masivos de Datos',
    'Detecta cuando un usuario realiza muchas modificaciones en poco tiempo',
    'CAMBIOS_MASIVOS',
    'CRITICO',
    '{"tipo_evento": "ACTUALIZAR_REGISTRO", "agrupar_por": "usuario_id"}',
    20,
    30,
    'El usuario {usuario} ha realizado {cantidad} modificaciones en los últimos {tiempo} minutos.',
    1
);

-- Configuración inicial de métricas
INSERT INTO METRICAS_SISTEMA (
    nombre_metrica, categoria, valor_numerico, unidad_medida,
    periodo_agregacion, origen_sistema
) VALUES 
('usuarios_activos_total', 'USUARIOS', 0, 'count', 'DIA', 'ecosecial'),
('sesiones_activas_total', 'USUARIOS', 0, 'count', 'INSTANTANEO', 'ecosecial'),
('logs_generados_total', 'SISTEMA', 0, 'count', 'DIA', 'ecosecial'),
('alertas_activas_total', 'SEGURIDAD', 0, 'count', 'INSTANTANEO', 'ecosecial');

-- =====================================================
-- VISTAS PARA CONSULTAS FRECUENTES
-- =====================================================

-- Vista para dashboard de auditoría
CREATE OR REPLACE VIEW v_dashboard_auditoria AS
SELECT 
    DATE(fecha_evento) as fecha,
    categoria,
    tipo_evento,
    nivel_criticidad,
    COUNT(*) as total_eventos,
    COUNT(DISTINCT usuario_id) as usuarios_unicos,
    COUNT(DISTINCT ip_address) as ips_unicas,
    SUM(CASE WHEN resultado = 'FALLIDO' THEN 1 ELSE 0 END) as eventos_fallidos
FROM LOGS_AUDITORIA
WHERE fecha_evento >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(fecha_evento), categoria, tipo_evento, nivel_criticidad;

-- Vista para eventos de seguridad críticos
CREATE OR REPLACE VIEW v_eventos_seguridad_criticos AS
SELECT 
    l.*,
    u.nombres,
    u.apellidos,
    r.nombre as rol_nombre
FROM LOGS_AUDITORIA l
LEFT JOIN USUARIOS u ON l.usuario_id = u.id
LEFT JOIN ROLES r ON u.rol_id = r.id
WHERE l.nivel_criticidad IN ('ALTO', 'CRITICO')
   OR l.tipo_evento IN ('LOGIN_FALLIDO', 'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO')
ORDER BY l.fecha_evento DESC;

-- Vista para estadísticas de reportes
CREATE OR REPLACE VIEW v_estadisticas_reportes AS
SELECT 
    rp.tipo_reporte,
    rp.nombre,
    COUNT(er.id) as total_ejecuciones,
    SUM(CASE WHEN er.estado = 'COMPLETADO' THEN 1 ELSE 0 END) as ejecuciones_exitosas,
    SUM(CASE WHEN er.estado = 'FALLIDO' THEN 1 ELSE 0 END) as ejecuciones_fallidas,
    AVG(er.duracion_segundos) as duracion_promedio,
    MAX(er.fecha_solicitud) as ultima_ejecucion
FROM REPORTES_PROGRAMADOS rp
LEFT JOIN EJECUCIONES_REPORTES er ON rp.id = er.reporte_programado_id
WHERE rp.activo = TRUE
GROUP BY rp.id, rp.tipo_reporte, rp.nombre;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa un sistema completo de auditoría con las siguientes características:

1. LOGS INMUTABLES (WORM Pattern):
   - Triggers que previenen modificaciones y eliminaciones
   - Hash de integridad para verificar la integridad de los datos
   - Número de secuencia para orden cronológico
   - Hash del registro anterior para crear una cadena de integridad

2. SISTEMA DE REPORTES:
   - Reportes programados con múltiples frecuencias
   - Plantillas reutilizables para diferentes tipos de reportes
   - Historial completo de ejecuciones
   - Soporte para múltiples formatos de salida

3. SISTEMA DE ALERTAS:
   - Alertas configurables basadas en patrones
   - Múltiples canales de notificación
   - Sistema de escalamiento automático
   - Seguimiento completo del ciclo de vida de alertas

4. MÉTRICAS DEL SISTEMA:
   - Recolección de métricas en tiempo real
   - Soporte para diferentes tipos de agregación
   - Flexibilidad para métricas personalizadas

5. CUMPLIMIENTO Y RETENCIÓN:
   - Políticas de retención configurables
   - Marcado de datos que requieren retención especial
   - Soporte para regulaciones médicas

El sistema está diseñado para ser altamente escalable y cumplir con los requisitos
de auditoría médica más estrictos, adaptado para PostgreSQL.
*/