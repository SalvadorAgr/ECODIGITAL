-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Waitlist Management System (PostgreSQL)
-- Descripción: Sistema de gestión de listas de espera
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: LISTA_ESPERA
-- =====================================================
CREATE TABLE IF NOT EXISTS LISTA_ESPERA (
    id SERIAL PRIMARY KEY,
    
    -- Información básica de la entrada en lista de espera
    numero_lista VARCHAR(20) UNIQUE NOT NULL,
    id_paciente INTEGER NOT NULL,
    medico_preferido_id INTEGER,
    
    -- Configuración de la cita deseada
    tipo_cita VARCHAR(20) NOT NULL CHECK (tipo_cita IN ('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA')),
    especialidad VARCHAR(100),
    duracion_minutos INTEGER DEFAULT 30,
    motivo TEXT NOT NULL,
    
    -- Preferencias de programación
    fecha_preferida_inicio DATE,
    fecha_preferida_fin DATE,
    horario_preferido_inicio TIME,
    horario_preferido_fin TIME,
    dias_semana_preferidos JSONB, -- Días de la semana preferidos [1-7]
    acepta_cualquier_horario BOOLEAN DEFAULT FALSE,
    
    -- Sistema de prioridades
    prioridad VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    puntuacion_prioridad INTEGER DEFAULT 50,
    es_urgente BOOLEAN DEFAULT FALSE,
    motivo_urgencia TEXT,
    fecha_escalacion TIMESTAMP,
    escalado_por INTEGER,
    
    -- Estado de la lista de espera
    estado VARCHAR(15) DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'NOTIFICADA', 'CONVERTIDA', 'EXPIRADA', 'CANCELADA')),
    fecha_notificacion TIMESTAMP,
    intentos_notificacion INTEGER DEFAULT 0,
    fecha_expiracion TIMESTAMP,
    tiempo_respuesta_horas INTEGER DEFAULT 24,
    
    -- Información de conversión
    cita_convertida_id INTEGER,
    fecha_conversion TIMESTAMP,
    convertido_por INTEGER,
    
    -- Información de cancelación
    fecha_cancelacion TIMESTAMP,
    motivo_cancelacion TEXT,
    cancelado_por INTEGER,
    
    -- Configuración de notificaciones
    metodo_notificacion_preferido VARCHAR(15) DEFAULT 'EMAIL' CHECK (metodo_notificacion_preferido IN ('EMAIL', 'SMS', 'TELEFONO', 'WHATSAPP')),
    telefono_notificacion VARCHAR(20),
    email_notificacion VARCHAR(100),
    acepta_notificaciones_automaticas BOOLEAN DEFAULT TRUE,
    
    -- Métricas de tiempo
    tiempo_espera_total_horas INTEGER DEFAULT 0,
    posicion_inicial INTEGER,
    posicion_actual INTEGER,
    mejor_posicion_alcanzada INTEGER,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_lista_espera()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_lista_espera
    BEFORE UPDATE ON LISTA_ESPERA
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_lista_espera();

-- Índices para rendimiento
CREATE INDEX idx_lista_espera_paciente ON LISTA_ESPERA(id_paciente);
CREATE INDEX idx_lista_espera_medico ON LISTA_ESPERA(medico_preferido_id);
CREATE INDEX idx_lista_espera_tipo_cita ON LISTA_ESPERA(tipo_cita);
CREATE INDEX idx_lista_espera_especialidad ON LISTA_ESPERA(especialidad);
CREATE INDEX idx_lista_espera_estado ON LISTA_ESPERA(estado);
CREATE INDEX idx_lista_espera_prioridad ON LISTA_ESPERA(prioridad, puntuacion_prioridad);
CREATE INDEX idx_lista_espera_fecha_creacion ON LISTA_ESPERA(fecha_creacion);
CREATE INDEX idx_lista_espera_fecha_preferida ON LISTA_ESPERA(fecha_preferida_inicio, fecha_preferida_fin);
CREATE INDEX idx_lista_espera_activo ON LISTA_ESPERA(activo);
CREATE INDEX idx_lista_espera_numero ON LISTA_ESPERA(numero_lista);
CREATE INDEX idx_lista_espera_posicion ON LISTA_ESPERA(posicion_actual);
CREATE INDEX idx_lista_espera_urgente ON LISTA_ESPERA(es_urgente);

-- Claves foráneas
ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_paciente 
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_medico_preferido 
FOREIGN KEY (medico_preferido_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_cita_convertida 
FOREIGN KEY (cita_convertida_id) REFERENCES CITAS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_escalado_por 
FOREIGN KEY (escalado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_convertido_por 
FOREIGN KEY (convertido_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_cancelado_por 
FOREIGN KEY (cancelado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE LISTA_ESPERA 
ADD CONSTRAINT fk_lista_espera_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: NOTIFICACIONES_LISTA_ESPERA
-- =====================================================
CREATE TABLE IF NOT EXISTS NOTIFICACIONES_LISTA_ESPERA (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información básica de la notificación
    lista_espera_id INTEGER NOT NULL,
    tipo_notificacion VARCHAR(25) NOT NULL CHECK (tipo_notificacion IN ('DISPONIBILIDAD', 'POSICION_ACTUALIZADA', 'EXPIRACION_PROXIMA', 'ESCALACION_PRIORIDAD', 'CANCELACION')),
    
    -- Detalles de la oportunidad (para notificaciones de disponibilidad)
    cita_disponible_fecha DATE,
    cita_disponible_hora TIME,
    cita_disponible_duracion INTEGER,
    medico_disponible_id INTEGER,
    sala_disponible VARCHAR(50),
    
    -- Información de envío
    metodo_envio VARCHAR(20) NOT NULL CHECK (metodo_envio IN ('EMAIL', 'SMS', 'TELEFONO', 'WHATSAPP', 'PUSH_NOTIFICATION')),
    destinatario VARCHAR(255) NOT NULL,
    asunto VARCHAR(255),
    mensaje TEXT NOT NULL,
    plantilla_utilizada VARCHAR(100),
    
    -- Estado de la notificación
    estado_envio VARCHAR(15) DEFAULT 'PENDIENTE' CHECK (estado_envio IN ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'RESPONDIDA', 'FALLIDA', 'EXPIRADA')),
    fecha_envio TIMESTAMP,
    fecha_entrega TIMESTAMP,
    fecha_lectura TIMESTAMP,
    fecha_respuesta TIMESTAMP,
    fecha_expiracion TIMESTAMP,
    
    -- Respuesta del paciente
    respuesta_paciente VARCHAR(20) CHECK (respuesta_paciente IN ('ACEPTA', 'RECHAZA', 'SOLICITA_ALTERNATIVA', 'NO_RESPONDE')),
    comentarios_respuesta TEXT,
    fecha_limite_respuesta TIMESTAMP,
    
    -- Información de error (si falló el envío)
    codigo_error VARCHAR(50),
    mensaje_error TEXT,
    intentos_reenvio INTEGER DEFAULT 0,
    proximo_intento TIMESTAMP,
    
    -- Métricas de seguimiento
    tiempo_respuesta_minutos INTEGER,
    costo_envio DECIMAL(10,4),
    proveedor_servicio VARCHAR(100),
    id_externo VARCHAR(255),
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX idx_notif_lista_espera ON NOTIFICACIONES_LISTA_ESPERA(lista_espera_id);
CREATE INDEX idx_notif_tipo ON NOTIFICACIONES_LISTA_ESPERA(tipo_notificacion);
CREATE INDEX idx_notif_estado ON NOTIFICACIONES_LISTA_ESPERA(estado_envio);
CREATE INDEX idx_notif_fecha_envio ON NOTIFICACIONES_LISTA_ESPERA(fecha_envio);
CREATE INDEX idx_notif_fecha_expiracion ON NOTIFICACIONES_LISTA_ESPERA(fecha_expiracion);
CREATE INDEX idx_notif_metodo ON NOTIFICACIONES_LISTA_ESPERA(metodo_envio);
CREATE INDEX idx_notif_respuesta ON NOTIFICACIONES_LISTA_ESPERA(respuesta_paciente);
CREATE INDEX idx_notif_medico ON NOTIFICACIONES_LISTA_ESPERA(medico_disponible_id);

-- Claves foráneas
ALTER TABLE NOTIFICACIONES_LISTA_ESPERA 
ADD CONSTRAINT fk_notif_lista_espera 
FOREIGN KEY (lista_espera_id) REFERENCES LISTA_ESPERA(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE NOTIFICACIONES_LISTA_ESPERA 
ADD CONSTRAINT fk_notif_medico_disponible 
FOREIGN KEY (medico_disponible_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE NOTIFICACIONES_LISTA_ESPERA 
ADD CONSTRAINT fk_notif_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: HISTORIAL_LISTA_ESPERA
-- =====================================================
CREATE TABLE IF NOT EXISTS HISTORIAL_LISTA_ESPERA (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información básica del cambio
    lista_espera_id INTEGER NOT NULL,
    accion VARCHAR(25) NOT NULL CHECK (accion IN ('CREADA', 'MODIFICADA', 'PRIORIDAD_CAMBIADA', 'POSICION_ACTUALIZADA', 'NOTIFICADA', 'CONVERTIDA', 'CANCELADA', 'EXPIRADA')),
    
    -- Estados anterior y nuevo
    estado_anterior VARCHAR(15) CHECK (estado_anterior IN ('ACTIVA', 'NOTIFICADA', 'CONVERTIDA', 'EXPIRADA', 'CANCELADA')),
    estado_nuevo VARCHAR(15) CHECK (estado_nuevo IN ('ACTIVA', 'NOTIFICADA', 'CONVERTIDA', 'EXPIRADA', 'CANCELADA')),
    
    -- Prioridades anterior y nueva
    prioridad_anterior VARCHAR(10) CHECK (prioridad_anterior IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    prioridad_nueva VARCHAR(10) CHECK (prioridad_nueva IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    puntuacion_anterior INTEGER,
    puntuacion_nueva INTEGER,
    
    -- Posiciones anterior y nueva
    posicion_anterior INTEGER,
    posicion_nueva INTEGER,
    
    -- Detalles del cambio
    motivo TEXT,
    observaciones TEXT,
    datos_adicionales JSONB,
    
    -- Información de la acción
    es_automatico BOOLEAN DEFAULT FALSE,
    regla_aplicada VARCHAR(100),
    
    -- Campos de auditoría
    realizado_por INTEGER,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_origen INET,
    user_agent TEXT
);

-- Índices para rendimiento
CREATE INDEX idx_historial_lista_espera ON HISTORIAL_LISTA_ESPERA(lista_espera_id);
CREATE INDEX idx_historial_accion ON HISTORIAL_LISTA_ESPERA(accion);
CREATE INDEX idx_historial_fecha ON HISTORIAL_LISTA_ESPERA(fecha_cambio);
CREATE INDEX idx_historial_usuario ON HISTORIAL_LISTA_ESPERA(realizado_por);
CREATE INDEX idx_historial_automatico ON HISTORIAL_LISTA_ESPERA(es_automatico);

-- Claves foráneas
ALTER TABLE HISTORIAL_LISTA_ESPERA 
ADD CONSTRAINT fk_historial_lista_espera 
FOREIGN KEY (lista_espera_id) REFERENCES LISTA_ESPERA(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_LISTA_ESPERA 
ADD CONSTRAINT fk_historial_realizado_por 
FOREIGN KEY (realizado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: CONFIGURACION_LISTA_ESPERA
-- =====================================================
CREATE TABLE IF NOT EXISTS CONFIGURACION_LISTA_ESPERA (
    id SERIAL PRIMARY KEY,
    
    -- Configuración general
    nombre_configuracion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Configuración de prioridades
    puntuacion_base_baja INTEGER DEFAULT 10,
    puntuacion_base_normal INTEGER DEFAULT 50,
    puntuacion_base_alta INTEGER DEFAULT 100,
    puntuacion_base_urgente INTEGER DEFAULT 200,
    
    -- Configuración de escalación automática
    escalacion_automatica_activa BOOLEAN DEFAULT TRUE,
    horas_para_escalacion_normal INTEGER DEFAULT 72,
    horas_para_escalacion_alta INTEGER DEFAULT 168,
    horas_para_escalacion_urgente INTEGER DEFAULT 336,
    
    -- Configuración de notificaciones
    notificaciones_automaticas_activas BOOLEAN DEFAULT TRUE,
    tiempo_respuesta_default_horas INTEGER DEFAULT 24,
    max_intentos_notificacion INTEGER DEFAULT 3,
    intervalo_reintento_horas INTEGER DEFAULT 2,
    
    -- Configuración de expiración
    expiracion_automatica_activa BOOLEAN DEFAULT TRUE,
    dias_expiracion_default INTEGER DEFAULT 30,
    notificar_expiracion_proxima BOOLEAN DEFAULT TRUE,
    dias_aviso_expiracion INTEGER DEFAULT 7,
    
    -- Configuración de conversión
    conversion_automatica_activa BOOLEAN DEFAULT FALSE,
    tiempo_limite_conversion_minutos INTEGER DEFAULT 30,
    
    -- Configuración por tipo de cita
    configuracion_por_tipo JSONB,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_configuracion_lista_espera()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_configuracion_lista_espera
    BEFORE UPDATE ON CONFIGURACION_LISTA_ESPERA
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_configuracion_lista_espera();

-- Índices
CREATE INDEX idx_config_nombre ON CONFIGURACION_LISTA_ESPERA(nombre_configuracion);
CREATE INDEX idx_config_activo ON CONFIGURACION_LISTA_ESPERA(activo);

-- Claves foráneas
ALTER TABLE CONFIGURACION_LISTA_ESPERA 
ADD CONSTRAINT fk_config_lista_espera_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CONFIGURACION_LISTA_ESPERA 
ADD CONSTRAINT fk_config_lista_espera_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de lista de espera con información completa
CREATE OR REPLACE VIEW v_lista_espera_completa AS
SELECT 
    le.id,
    le.numero_lista,
    le.tipo_cita,
    le.especialidad,
    le.prioridad,
    le.puntuacion_prioridad,
    le.estado,
    le.posicion_actual,
    le.tiempo_espera_total_horas,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    p.email as email_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as medico_preferido,
    u.especialidad as especialidad_medico,
    le.fecha_preferida_inicio,
    le.fecha_preferida_fin,
    le.motivo,
    le.fecha_creacion,
    le.fecha_notificacion,
    le.intentos_notificacion,
    CASE 
        WHEN le.fecha_expiracion IS NOT NULL AND le.fecha_expiracion < NOW() THEN 'EXPIRADA'
        ELSE le.estado
    END as estado_actual
FROM LISTA_ESPERA le
JOIN PACIENTES p ON le.id_paciente = p.id
LEFT JOIN USUARIOS u ON le.medico_preferido_id = u.id
WHERE le.activo = TRUE AND p.activo = TRUE;

-- Vista de notificaciones pendientes
CREATE OR REPLACE VIEW v_notificaciones_pendientes AS
SELECT 
    n.id,
    n.lista_espera_id,
    n.tipo_notificacion,
    n.metodo_envio,
    n.destinatario,
    n.estado_envio,
    n.fecha_expiracion,
    n.intentos_reenvio,
    n.proximo_intento,
    le.numero_lista,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    le.prioridad,
    le.es_urgente
FROM NOTIFICACIONES_LISTA_ESPERA n
JOIN LISTA_ESPERA le ON n.lista_espera_id = le.id
JOIN PACIENTES p ON le.id_paciente = p.id
WHERE n.estado_envio IN ('PENDIENTE', 'FALLIDA') 
  AND (n.fecha_expiracion IS NULL OR n.fecha_expiracion > NOW())
  AND le.activo = TRUE;

-- Vista de métricas de lista de espera
CREATE OR REPLACE VIEW v_metricas_lista_espera AS
SELECT 
    COUNT(*) as total_entradas,
    COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) as activas,
    COUNT(CASE WHEN estado = 'NOTIFICADA' THEN 1 END) as notificadas,
    COUNT(CASE WHEN estado = 'CONVERTIDA' THEN 1 END) as convertidas,
    COUNT(CASE WHEN estado = 'EXPIRADA' THEN 1 END) as expiradas,
    COUNT(CASE WHEN estado = 'CANCELADA' THEN 1 END) as canceladas,
    COUNT(CASE WHEN es_urgente = TRUE THEN 1 END) as urgentes,
    AVG(tiempo_espera_total_horas) as tiempo_espera_promedio,
    MAX(tiempo_espera_total_horas) as tiempo_espera_maximo,
    MIN(tiempo_espera_total_horas) as tiempo_espera_minimo,
    AVG(posicion_actual) as posicion_promedio,
    COUNT(CASE WHEN fecha_creacion >= NOW() - INTERVAL '24 hours' THEN 1 END) as nuevas_24h,
    COUNT(CASE WHEN fecha_conversion >= NOW() - INTERVAL '24 hours' THEN 1 END) as convertidas_24h
FROM LISTA_ESPERA
WHERE activo = TRUE;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa un sistema completo de lista de espera que incluye:

1. TABLA LISTA_ESPERA:
   - Gestión completa de entradas en lista de espera
   - Sistema de prioridades con puntuación numérica
   - Preferencias de programación flexibles
   - Seguimiento de posición y métricas de tiempo
   - Estados del ciclo de vida completo

2. TABLA NOTIFICACIONES_LISTA_ESPERA:
   - Gestión de notificaciones automáticas
   - Múltiples métodos de envío
   - Seguimiento de respuestas del paciente
   - Manejo de errores y reintentos

3. TABLA HISTORIAL_LISTA_ESPERA:
   - Auditoría completa de cambios
   - Seguimiento de escalaciones automáticas
   - Trazabilidad de todas las acciones

4. TABLA CONFIGURACION_LISTA_ESPERA:
   - Configuración flexible del sistema
   - Parámetros de escalación y notificación
   - Configuración por tipo de cita

5. VISTAS:
   - Vista completa con información del paciente
   - Vista de notificaciones pendientes
   - Vista de métricas y estadísticas

6. CARACTERÍSTICAS CLAVE:
   - Sistema de prioridades avanzado
   - Notificaciones automáticas
   - Escalación de prioridad
   - Conversión a citas
   - Métricas de rendimiento
   - Soft delete y auditoría completa

Conversiones PostgreSQL aplicadas:
- AUTO_INCREMENT → SERIAL/BIGSERIAL
- ENUM → VARCHAR con CHECK constraints
- JSON → JSONB para mejor rendimiento
- VARCHAR(45) para IP → INET type
- Triggers para fecha_modificacion automática
- DATE_SUB(NOW(), INTERVAL 24 HOUR) → NOW() - INTERVAL '24 hours'
- CURDATE() → CURRENT_DATE
- NOW() → CURRENT_TIMESTAMP
*/