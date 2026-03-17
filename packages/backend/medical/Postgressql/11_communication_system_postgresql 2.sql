-- =====================================================
-- Communication System Tables
-- =====================================================
-- This script creates the communication infrastructure for automated
-- appointment reminders, confirmations, and notifications

-- Communication Types Enum
CREATE TYPE communication_type AS ENUM (
    'reminder',
    'confirmation', 
    'cancellation',
    'rescheduling',
    'waitlist_notification'
);

-- Communication Methods Enum
CREATE TYPE communication_method AS ENUM (
    'email',
    'sms',
    'push_notification',
    'phone_call'
);

-- Communication Status Enum
CREATE TYPE communication_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed',
    'bounced'
);

-- =====================================================
-- COMUNICACIONES Table
-- =====================================================
-- Stores all communication records sent to patients
CREATE TABLE IF NOT EXISTS COMUNICACIONES (
    id_comunicacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cita UUID NOT NULL,
    tipo communication_type NOT NULL,
    metodo communication_method NOT NULL,
    destinatario VARCHAR(255) NOT NULL, -- Email or phone number
    asunto VARCHAR(500),
    contenido TEXT NOT NULL,
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    estado communication_status DEFAULT 'pending',
    intentos_envio INTEGER DEFAULT 0,
    ultimo_intento TIMESTAMP WITH TIME ZONE,
    error_mensaje TEXT,
    id_externo VARCHAR(255), -- External provider message ID
    metadatos JSONB, -- Additional metadata (provider response, etc.)
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_comunicaciones_cita 
        FOREIGN KEY (id_cita) REFERENCES CITAS(id_cita) 
        ON DELETE CASCADE
);

-- =====================================================
-- RECORDATORIOS Table  
-- =====================================================
-- Stores reminder schedules and templates
CREATE TABLE IF NOT EXISTS RECORDATORIOS (
    id_recordatorio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo_cita UUID, -- Optional: specific to appointment type
    tiempo_anticipacion INTEGER NOT NULL, -- Minutes before appointment
    metodo_preferido communication_method NOT NULL,
    plantilla_asunto VARCHAR(500),
    plantilla_contenido TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    automatico BOOLEAN DEFAULT TRUE, -- Auto-send or manual trigger
    dias_semana INTEGER[], -- Array of weekdays (0=Sunday, 6=Saturday)
    hora_envio TIME, -- Preferred sending time
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID NOT NULL,
    
    -- Foreign key constraints
    CONSTRAINT fk_recordatorios_tipo_cita 
        FOREIGN KEY (tipo_cita) REFERENCES TIPOS_CITA(id_tipo_cita) 
        ON DELETE SET NULL,
    CONSTRAINT fk_recordatorios_creado_por 
        FOREIGN KEY (creado_por) REFERENCES USUARIOS(id_usuario) 
        ON DELETE RESTRICT,
        
    -- Check constraints
    CONSTRAINT chk_tiempo_anticipacion_positivo 
        CHECK (tiempo_anticipacion > 0),
    CONSTRAINT chk_dias_semana_validos 
        CHECK (array_length(dias_semana, 1) IS NULL OR 
               (SELECT bool_and(d >= 0 AND d <= 6) FROM unnest(dias_semana) AS d))
);

-- =====================================================
-- PREFERENCIAS_COMUNICACION Table
-- =====================================================
-- Stores patient communication preferences
CREATE TABLE IF NOT EXISTS PREFERENCIAS_COMUNICACION (
    id_preferencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente UUID NOT NULL,
    metodo_preferido communication_method NOT NULL,
    recordatorios_habilitados BOOLEAN DEFAULT TRUE,
    confirmaciones_habilitadas BOOLEAN DEFAULT TRUE,
    notificaciones_lista_espera BOOLEAN DEFAULT TRUE,
    idioma VARCHAR(10) DEFAULT 'es',
    zona_horaria VARCHAR(50) DEFAULT 'America/Mexico_City',
    horario_no_molestar_inicio TIME,
    horario_no_molestar_fin TIME,
    dias_no_molestar INTEGER[], -- Array of weekdays to avoid
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_preferencias_paciente 
        FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id_paciente) 
        ON DELETE CASCADE,
        
    -- Unique constraint - one preference record per patient
    CONSTRAINT uk_preferencias_paciente UNIQUE (id_paciente)
);

-- =====================================================
-- PLANTILLAS_COMUNICACION Table
-- =====================================================
-- Stores communication templates for different scenarios
CREATE TABLE IF NOT EXISTS PLANTILLAS_COMUNICACION (
    id_plantilla UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    tipo communication_type NOT NULL,
    metodo communication_method NOT NULL,
    asunto VARCHAR(500),
    contenido TEXT NOT NULL,
    variables_disponibles TEXT[], -- Available template variables
    idioma VARCHAR(10) DEFAULT 'es',
    activa BOOLEAN DEFAULT TRUE,
    por_defecto BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID NOT NULL,
    
    -- Foreign key constraints
    CONSTRAINT fk_plantillas_creado_por 
        FOREIGN KEY (creado_por) REFERENCES USUARIOS(id_usuario) 
        ON DELETE RESTRICT,
        
    -- Unique constraint for default templates
    CONSTRAINT uk_plantilla_defecto_tipo_metodo 
        UNIQUE (tipo, metodo, idioma, por_defecto) 
        DEFERRABLE INITIALLY DEFERRED
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- COMUNICACIONES indexes
CREATE INDEX idx_comunicaciones_cita ON COMUNICACIONES(id_cita);
CREATE INDEX idx_comunicaciones_estado ON COMUNICACIONES(estado);
CREATE INDEX idx_comunicaciones_fecha_envio ON COMUNICACIONES(fecha_envio);
CREATE INDEX idx_comunicaciones_tipo_metodo ON COMUNICACIONES(tipo, metodo);
CREATE INDEX idx_comunicaciones_destinatario ON COMUNICACIONES(destinatario);

-- RECORDATORIOS indexes
CREATE INDEX idx_recordatorios_activo ON RECORDATORIOS(activo);
CREATE INDEX idx_recordatorios_automatico ON RECORDATORIOS(automatico);
CREATE INDEX idx_recordatorios_tipo_cita ON RECORDATORIOS(tipo_cita);

-- PREFERENCIAS_COMUNICACION indexes
CREATE INDEX idx_preferencias_paciente ON PREFERENCIAS_COMUNICACION(id_paciente);
CREATE INDEX idx_preferencias_metodo ON PREFERENCIAS_COMUNICACION(metodo_preferido);

-- PLANTILLAS_COMUNICACION indexes
CREATE INDEX idx_plantillas_tipo_metodo ON PLANTILLAS_COMUNICACION(tipo, metodo);
CREATE INDEX idx_plantillas_activa ON PLANTILLAS_COMUNICACION(activa);
CREATE INDEX idx_plantillas_defecto ON PLANTILLAS_COMUNICACION(por_defecto);

-- =====================================================
-- Triggers for Updated Timestamps
-- =====================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for each table
CREATE TRIGGER update_comunicaciones_updated_at 
    BEFORE UPDATE ON COMUNICACIONES 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordatorios_updated_at 
    BEFORE UPDATE ON RECORDATORIOS 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferencias_updated_at 
    BEFORE UPDATE ON PREFERENCIAS_COMUNICACION 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plantillas_updated_at 
    BEFORE UPDATE ON PLANTILLAS_COMUNICACION 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Default Data
-- =====================================================

-- Insert default reminder templates
INSERT INTO PLANTILLAS_COMUNICACION (
    nombre, tipo, metodo, asunto, contenido, variables_disponibles, por_defecto, creado_por
) VALUES 
(
    'Recordatorio 24h - Email',
    'reminder',
    'email',
    'Recordatorio: Cita médica mañana - {{fecha_cita}}',
    'Estimado/a {{nombre_paciente}},

Le recordamos que tiene una cita médica programada para mañana:

📅 Fecha: {{fecha_cita}}
🕐 Hora: {{hora_cita}}
👨‍⚕️ Médico: {{nombre_medico}}
🏥 Consultorio: {{ubicacion}}

Por favor, llegue 15 minutos antes de su cita y traiga:
- Documento de identidad
- Carnet de seguro médico (si aplica)
- Estudios médicos previos

Si necesita reprogramar o cancelar, contáctenos al {{telefono_clinica}}.

Saludos cordiales,
{{nombre_clinica}}',
    ARRAY['nombre_paciente', 'fecha_cita', 'hora_cita', 'nombre_medico', 'ubicacion', 'telefono_clinica', 'nombre_clinica'],
    TRUE,
    (SELECT id_usuario FROM USUARIOS WHERE email = 'admin@ecodigital.com' LIMIT 1)
),
(
    'Recordatorio 24h - SMS',
    'reminder',
    'sms',
    NULL,
    'Recordatorio: Cita médica mañana {{fecha_cita}} a las {{hora_cita}} con {{nombre_medico}}. Llegue 15 min antes. Info: {{telefono_clinica}}',
    ARRAY['fecha_cita', 'hora_cita', 'nombre_medico', 'telefono_clinica'],
    TRUE,
    (SELECT id_usuario FROM USUARIOS WHERE email = 'admin@ecodigital.com' LIMIT 1)
),
(
    'Confirmación de Cita - Email',
    'confirmation',
    'email',
    'Confirmación de Cita - {{fecha_cita}}',
    'Estimado/a {{nombre_paciente}},

Su cita médica ha sido confirmada:

📅 Fecha: {{fecha_cita}}
🕐 Hora: {{hora_cita}}
👨‍⚕️ Médico: {{nombre_medico}}
🏥 Consultorio: {{ubicacion}}

Por favor, confirme su asistencia respondiendo a este mensaje o llamando al {{telefono_clinica}}.

Saludos cordiales,
{{nombre_clinica}}',
    ARRAY['nombre_paciente', 'fecha_cita', 'hora_cita', 'nombre_medico', 'ubicacion', 'telefono_clinica', 'nombre_clinica'],
    TRUE,
    (SELECT id_usuario FROM USUARIOS WHERE email = 'admin@ecodigital.com' LIMIT 1)
);

-- Insert default reminder schedules
INSERT INTO RECORDATORIOS (
    nombre, descripcion, tiempo_anticipacion, metodo_preferido, 
    plantilla_asunto, plantilla_contenido, creado_por
) VALUES 
(
    'Recordatorio 24 horas',
    'Recordatorio automático enviado 24 horas antes de la cita',
    1440, -- 24 hours in minutes
    'email',
    'Recordatorio: Cita médica mañana - {{fecha_cita}}',
    'Recordatorio automático de cita médica programada para mañana.',
    (SELECT id_usuario FROM USUARIOS WHERE email = 'admin@ecodigital.com' LIMIT 1)
),
(
    'Recordatorio 2 horas',
    'Recordatorio automático enviado 2 horas antes de la cita',
    120, -- 2 hours in minutes
    'sms',
    NULL,
    'Recordatorio: Su cita es en 2 horas. {{fecha_cita}} {{hora_cita}}',
    (SELECT id_usuario FROM USUARIOS WHERE email = 'admin@ecodigital.com' LIMIT 1)
);

-- =====================================================
-- Comments and Documentation
-- =====================================================

COMMENT ON TABLE COMUNICACIONES IS 'Registro de todas las comunicaciones enviadas a pacientes';
COMMENT ON TABLE RECORDATORIOS IS 'Configuración de recordatorios automáticos';
COMMENT ON TABLE PREFERENCIAS_COMUNICACION IS 'Preferencias de comunicación por paciente';
COMMENT ON TABLE PLANTILLAS_COMUNICACION IS 'Plantillas para diferentes tipos de comunicación';

COMMENT ON COLUMN COMUNICACIONES.intentos_envio IS 'Número de intentos de envío realizados';
COMMENT ON COLUMN COMUNICACIONES.id_externo IS 'ID del proveedor externo (Twilio, SendGrid, etc.)';
COMMENT ON COLUMN RECORDATORIOS.tiempo_anticipacion IS 'Minutos antes de la cita para enviar recordatorio';
COMMENT ON COLUMN RECORDATORIOS.dias_semana IS 'Días de la semana para envío (0=Domingo, 6=Sábado)';