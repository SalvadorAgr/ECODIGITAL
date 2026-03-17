-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Priority System for Appointments (PostgreSQL)
-- Descripción: Adds priority and urgency handling to appointments
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- ADD PRIORITY FIELDS TO CITAS TABLE
-- =====================================================

-- Add priority field to CITAS table
ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE'));

-- Add urgency escalation fields
ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS es_urgente BOOLEAN DEFAULT FALSE;

ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS fecha_escalacion TIMESTAMP;

ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS motivo_urgencia TEXT;

ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS escalado_por INTEGER;

-- Add priority score for algorithmic sorting
ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS puntuacion_prioridad INTEGER DEFAULT 0;

-- Add priority-related timestamps
ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS fecha_asignacion_prioridad TIMESTAMP;

ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS asignado_prioridad_por INTEGER;

-- Add indexes for priority-based queries
CREATE INDEX IF NOT EXISTS idx_citas_prioridad ON CITAS(prioridad);
CREATE INDEX IF NOT EXISTS idx_citas_urgente ON CITAS(es_urgente);
CREATE INDEX IF NOT EXISTS idx_citas_puntuacion_prioridad ON CITAS(puntuacion_prioridad);
CREATE INDEX IF NOT EXISTS idx_citas_prioridad_fecha ON CITAS(prioridad, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_urgente_fecha ON CITAS(es_urgente, fecha_hora);

-- Add foreign key constraints for priority assignment tracking
ALTER TABLE CITAS 
ADD CONSTRAINT IF NOT EXISTS fk_citas_escalado_por 
FOREIGN KEY (escalado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CITAS 
ADD CONSTRAINT IF NOT EXISTS fk_citas_asignado_prioridad_por 
FOREIGN KEY (asignado_prioridad_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: CONFIGURACION_PRIORIDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS CONFIGURACION_PRIORIDADES (
    id SERIAL PRIMARY KEY,
    
    -- Configuración de prioridad
    nivel_prioridad VARCHAR(10) NOT NULL CHECK (nivel_prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    puntuacion_base INTEGER NOT NULL,
    color_codigo VARCHAR(7) NOT NULL,
    descripcion TEXT,
    
    -- Configuración de escalación automática
    escalacion_automatica BOOLEAN DEFAULT FALSE,
    horas_para_escalacion INTEGER,
    nivel_escalacion VARCHAR(10) CHECK (nivel_escalacion IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    
    -- Configuración de notificaciones
    notificar_asignacion BOOLEAN DEFAULT TRUE,
    notificar_escalacion BOOLEAN DEFAULT TRUE,
    plantilla_notificacion TEXT,
    
    -- Configuración de acceso
    requiere_autorizacion BOOLEAN DEFAULT FALSE,
    roles_autorizados JSONB,
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_configuracion_prioridades()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_configuracion_prioridades
    BEFORE UPDATE ON CONFIGURACION_PRIORIDADES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_configuracion_prioridades();

-- Índices
CREATE INDEX idx_config_prioridad_nivel ON CONFIGURACION_PRIORIDADES(nivel_prioridad);
CREATE INDEX idx_config_prioridad_activo ON CONFIGURACION_PRIORIDADES(activo);

-- Claves foráneas
ALTER TABLE CONFIGURACION_PRIORIDADES 
ADD CONSTRAINT fk_config_prioridad_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CONFIGURACION_PRIORIDADES 
ADD CONSTRAINT fk_config_prioridad_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricción única para evitar configuraciones duplicadas
ALTER TABLE CONFIGURACION_PRIORIDADES 
ADD CONSTRAINT uk_config_prioridad_nivel UNIQUE (nivel_prioridad);

-- =====================================================
-- TABLA: HISTORIAL_PRIORIDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS HISTORIAL_PRIORIDADES (
    id BIGSERIAL PRIMARY KEY,
    
    -- Relación con la cita
    cita_id INTEGER NOT NULL,
    
    -- Cambio de prioridad
    prioridad_anterior VARCHAR(10) CHECK (prioridad_anterior IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    prioridad_nueva VARCHAR(10) NOT NULL CHECK (prioridad_nueva IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    motivo_cambio TEXT,
    es_escalacion_automatica BOOLEAN DEFAULT FALSE,
    
    -- Información del cambio
    puntuacion_anterior INTEGER,
    puntuacion_nueva INTEGER NOT NULL,
    
    -- Campos de auditoría
    cambiado_por INTEGER,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_origen INET,
    user_agent TEXT
);

-- Índices
CREATE INDEX idx_historial_prioridad_cita ON HISTORIAL_PRIORIDADES(cita_id);
CREATE INDEX idx_historial_prioridad_fecha ON HISTORIAL_PRIORIDADES(fecha_cambio);
CREATE INDEX idx_historial_prioridad_usuario ON HISTORIAL_PRIORIDADES(cambiado_por);
CREATE INDEX idx_historial_prioridad_escalacion ON HISTORIAL_PRIORIDADES(es_escalacion_automatica);

-- Claves foráneas
ALTER TABLE HISTORIAL_PRIORIDADES 
ADD CONSTRAINT fk_historial_prioridad_cita 
FOREIGN KEY (cita_id) REFERENCES CITAS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_PRIORIDADES 
ADD CONSTRAINT fk_historial_prioridad_cambiado_por 
FOREIGN KEY (cambiado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: REGLAS_ESCALACION
-- =====================================================
CREATE TABLE IF NOT EXISTS REGLAS_ESCALACION (
    id SERIAL PRIMARY KEY,
    
    -- Configuración de la regla
    nombre_regla VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- Condiciones de activación
    tipo_cita VARCHAR(20) CHECK (tipo_cita IN ('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA')),
    especialidad VARCHAR(100),
    prioridad_origen VARCHAR(10) NOT NULL CHECK (prioridad_origen IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    prioridad_destino VARCHAR(10) NOT NULL CHECK (prioridad_destino IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    
    -- Configuración de tiempo
    horas_espera INTEGER NOT NULL,
    dias_semana_aplicables JSONB, -- Días de la semana en que aplica [1-7]
    horario_inicio TIME,
    horario_fin TIME,
    
    -- Condiciones adicionales
    edad_minima_paciente INTEGER,
    edad_maxima_paciente INTEGER,
    requiere_condicion_medica BOOLEAN DEFAULT FALSE,
    condiciones_medicas JSONB,
    
    -- Configuración de notificaciones
    notificar_escalacion BOOLEAN DEFAULT TRUE,
    notificar_a_medico BOOLEAN DEFAULT TRUE,
    notificar_a_administrador BOOLEAN DEFAULT FALSE,
    plantilla_notificacion TEXT,
    
    -- Estado y configuración
    activo BOOLEAN DEFAULT TRUE,
    orden_ejecucion INTEGER DEFAULT 0,
    max_escalaciones_por_cita INTEGER DEFAULT 1,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_reglas_escalacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_reglas_escalacion
    BEFORE UPDATE ON REGLAS_ESCALACION
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_reglas_escalacion();

-- Índices
CREATE INDEX idx_reglas_escalacion_activo ON REGLAS_ESCALACION(activo);
CREATE INDEX idx_reglas_escalacion_tipo_cita ON REGLAS_ESCALACION(tipo_cita);
CREATE INDEX idx_reglas_escalacion_especialidad ON REGLAS_ESCALACION(especialidad);
CREATE INDEX idx_reglas_escalacion_prioridad_origen ON REGLAS_ESCALACION(prioridad_origen);
CREATE INDEX idx_reglas_escalacion_orden ON REGLAS_ESCALACION(orden_ejecucion);

-- Claves foráneas
ALTER TABLE REGLAS_ESCALACION 
ADD CONSTRAINT fk_reglas_escalacion_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE REGLAS_ESCALACION 
ADD CONSTRAINT fk_reglas_escalacion_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- INSERT DEFAULT PRIORITY CONFIGURATIONS
-- =====================================================

-- Configuraciones por defecto de prioridades
INSERT INTO CONFIGURACION_PRIORIDADES (
    nivel_prioridad, puntuacion_base, color_codigo, descripcion,
    escalacion_automatica, horas_para_escalacion, nivel_escalacion,
    notificar_asignacion, notificar_escalacion, requiere_autorizacion,
    creado_por
) VALUES 
(
    'BAJA', 10, '#28a745', 'Prioridad baja - Citas de rutina y seguimiento',
    FALSE, NULL, NULL, FALSE, FALSE, FALSE, 1
),
(
    'NORMAL', 50, '#007bff', 'Prioridad normal - Citas estándar',
    TRUE, 72, 'ALTA', TRUE, TRUE, FALSE, 1
),
(
    'ALTA', 100, '#fd7e14', 'Prioridad alta - Requiere atención prioritaria',
    TRUE, 24, 'URGENTE', TRUE, TRUE, TRUE, 1
),
(
    'URGENTE', 200, '#dc3545', 'Prioridad urgente - Requiere atención inmediata',
    FALSE, NULL, NULL, TRUE, TRUE, TRUE, 1
)
ON CONFLICT (nivel_prioridad) DO UPDATE SET
    fecha_modificacion = CURRENT_TIMESTAMP;

-- Reglas de escalación por defecto
INSERT INTO REGLAS_ESCALACION (
    nombre_regla, descripcion, prioridad_origen, prioridad_destino,
    horas_espera, notificar_escalacion, notificar_a_medico, creado_por
) VALUES 
(
    'Escalación Normal a Alta', 
    'Escala citas normales a alta prioridad después de 72 horas',
    'NORMAL', 'ALTA', 72, TRUE, TRUE, 1
),
(
    'Escalación Alta a Urgente', 
    'Escala citas de alta prioridad a urgente después de 24 horas',
    'ALTA', 'URGENTE', 24, TRUE, TRUE, 1
),
(
    'Escalación Cirugía', 
    'Escalación especial para citas de cirugía',
    'NORMAL', 'ALTA', 48, TRUE, TRUE, 1
)
ON CONFLICT DO NOTHING;

-- Update existing appointments to have normal priority
UPDATE CITAS SET prioridad = 'NORMAL', puntuacion_prioridad = 50 WHERE prioridad IS NULL;

-- =====================================================
-- VISTAS ÚTILES PARA PRIORIDADES
-- =====================================================

-- Vista de citas con información de prioridad
CREATE OR REPLACE VIEW v_citas_con_prioridad AS
SELECT 
    c.id,
    c.numero_cita,
    c.fecha_hora,
    c.duracion_minutos,
    c.tipo_cita,
    c.prioridad,
    c.es_urgente,
    c.puntuacion_prioridad,
    c.fecha_escalacion,
    c.motivo_urgencia,
    c.estado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    cp.color_codigo as color_prioridad,
    cp.descripcion as descripcion_prioridad,
    CASE 
        WHEN c.es_urgente = TRUE THEN 'URGENTE'
        ELSE c.prioridad
    END as prioridad_efectiva,
    c.fecha_creacion
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id
LEFT JOIN CONFIGURACION_PRIORIDADES cp ON c.prioridad = cp.nivel_prioridad
WHERE c.activo = TRUE AND p.activo = TRUE;

-- Vista de citas pendientes ordenadas por prioridad
CREATE OR REPLACE VIEW v_citas_por_prioridad AS
SELECT 
    c.id,
    c.numero_cita,
    c.fecha_hora,
    c.prioridad,
    c.es_urgente,
    c.puntuacion_prioridad,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    c.motivo,
    cp.color_codigo,
    CASE 
        WHEN c.es_urgente = TRUE THEN 1000 + c.puntuacion_prioridad
        ELSE c.puntuacion_prioridad
    END as puntuacion_final
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id
LEFT JOIN CONFIGURACION_PRIORIDADES cp ON c.prioridad = cp.nivel_prioridad
WHERE c.activo = TRUE 
  AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
  AND c.fecha_hora >= NOW()
ORDER BY puntuacion_final DESC, c.fecha_hora ASC;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa el sistema de prioridades para citas:

1. CAMPOS DE PRIORIDAD EN CITAS:
   - prioridad: Nivel de prioridad (BAJA, NORMAL, ALTA, URGENTE)
   - es_urgente: Marca booleana para urgencias
   - puntuacion_prioridad: Puntuación numérica para algoritmos
   - Campos de auditoría para cambios de prioridad

2. TABLA CONFIGURACION_PRIORIDADES:
   - Configuración de niveles de prioridad
   - Escalación automática
   - Notificaciones y autorizaciones

3. TABLA HISTORIAL_PRIORIDADES:
   - Auditoría completa de cambios de prioridad
   - Trazabilidad de escalaciones

4. TABLA REGLAS_ESCALACION:
   - Reglas configurables de escalación automática
   - Condiciones por tipo de cita, especialidad, tiempo
   - Notificaciones automáticas

5. VISTAS ÚTILES:
   - v_citas_con_prioridad: Información completa de prioridades
   - v_citas_por_prioridad: Ordenamiento por prioridad efectiva

6. ÍNDICES OPTIMIZADOS:
   - Consultas por prioridad
   - Ordenamiento por puntuación
   - Búsquedas por urgencia

Conversiones PostgreSQL aplicadas:
- AUTO_INCREMENT → SERIAL/BIGSERIAL
- ENUM → VARCHAR con CHECK constraints
- JSON → JSONB para mejor rendimiento
- VARCHAR(45) para IP → INET type
- Triggers para fecha_modificacion automática
- ON DUPLICATE KEY UPDATE → ON CONFLICT DO UPDATE
- NOW() → CURRENT_TIMESTAMP

El sistema permite escalación automática y manual de prioridades,
con auditoría completa y notificaciones configurables.
*/