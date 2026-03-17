-- EcoDigital - Enhanced Appointments System Database Schema
-- This script enhances the existing CITAS table and adds supporting tables for advanced appointment management

-- First, let's add missing columns to the existing CITAS table if they don't exist
DO $$ 
BEGIN
    -- Add fecha_hora_fin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'fecha_hora_fin') THEN
        ALTER TABLE CITAS ADD COLUMN fecha_hora_fin TIMESTAMP;
    END IF;

    -- Add equipos_necesarios column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'equipos_necesarios') THEN
        ALTER TABLE CITAS ADD COLUMN equipos_necesarios JSONB;
    END IF;

    -- Add preparacion_especial column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'preparacion_especial') THEN
        ALTER TABLE CITAS ADD COLUMN preparacion_especial TEXT;
    END IF;

    -- Add recordatorio_enviado column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'recordatorio_enviado') THEN
        ALTER TABLE CITAS ADD COLUMN recordatorio_enviado BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add fecha_recordatorio column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'fecha_recordatorio') THEN
        ALTER TABLE CITAS ADD COLUMN fecha_recordatorio TIMESTAMP;
    END IF;

    -- Add tiempo_espera_minutos column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'tiempo_espera_minutos') THEN
        ALTER TABLE CITAS ADD COLUMN tiempo_espera_minutos INTEGER;
    END IF;

    -- Add tiempo_consulta_minutos column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'tiempo_consulta_minutos') THEN
        ALTER TABLE CITAS ADD COLUMN tiempo_consulta_minutos INTEGER;
    END IF;

    -- Add facturado column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'facturado') THEN
        ALTER TABLE CITAS ADD COLUMN facturado BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add sala_consulta column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'sala_consulta') THEN
        ALTER TABLE CITAS ADD COLUMN sala_consulta VARCHAR(100);
    END IF;

    -- Add copago column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'copago') THEN
        ALTER TABLE CITAS ADD COLUMN copago DECIMAL(10,2);
    END IF;

    -- Add seguro_medico column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'seguro_medico') THEN
        ALTER TABLE CITAS ADD COLUMN seguro_medico VARCHAR(200);
    END IF;

    -- Add costo_consulta column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'costo_consulta') THEN
        ALTER TABLE CITAS ADD COLUMN costo_consulta DECIMAL(10,2);
    END IF;

    -- Add email_contacto column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'email_contacto') THEN
        ALTER TABLE CITAS ADD COLUMN email_contacto VARCHAR(255);
    END IF;

    -- Add telefono_contacto column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'telefono_contacto') THEN
        ALTER TABLE CITAS ADD COLUMN telefono_contacto VARCHAR(20);
    END IF;

    -- Add fecha_confirmacion column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'fecha_confirmacion') THEN
        ALTER TABLE CITAS ADD COLUMN fecha_confirmacion TIMESTAMP;
    END IF;

    -- Add fecha_cancelacion column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'fecha_cancelacion') THEN
        ALTER TABLE CITAS ADD COLUMN fecha_cancelacion TIMESTAMP;
    END IF;

    -- Add motivo_cancelacion column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'motivo_cancelacion') THEN
        ALTER TABLE CITAS ADD COLUMN motivo_cancelacion TEXT;
    END IF;

    -- Add especialidad column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'especialidad') THEN
        ALTER TABLE CITAS ADD COLUMN especialidad VARCHAR(100);
    END IF;

    -- Add tipo_cita column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'tipo_cita') THEN
        ALTER TABLE CITAS ADD COLUMN tipo_cita VARCHAR(50);
    END IF;

    -- Add duracion_minutos column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'duracion_minutos') THEN
        ALTER TABLE CITAS ADD COLUMN duracion_minutos INTEGER DEFAULT 30;
    END IF;

    -- Add estado column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'estado') THEN
        ALTER TABLE CITAS ADD COLUMN estado VARCHAR(20) DEFAULT 'PROGRAMADA';
    END IF;

    -- Add numero_cita column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citas' AND column_name = 'numero_cita') THEN
        ALTER TABLE CITAS ADD COLUMN numero_cita VARCHAR(20) UNIQUE;
    END IF;

END $$;

-- Create or update the trigger function to calculate fecha_hora_fin
CREATE OR REPLACE FUNCTION calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate end time based on start time and duration
    NEW.fecha_hora_fin = NEW.fecha_hora + (NEW.duracion_minutos || ' minutes')::INTERVAL;
    
    -- Generate appointment number if not provided
    IF NEW.numero_cita IS NULL THEN
        NEW.numero_cita = 'CITA-' || TO_CHAR(NEW.fecha_hora, 'YYYYMMDD') || '-' || LPAD(NEW.id::TEXT, 4, '0');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for calculating end time (drop if exists first)
DROP TRIGGER IF EXISTS trigger_calculate_appointment_end_time ON CITAS;
CREATE TRIGGER trigger_calculate_appointment_end_time
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION calculate_appointment_end_time();

-- Create function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION check_appointment_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
    conflict_appointment RECORD;
BEGIN
    -- Only check conflicts for active appointments that are not cancelled
    IF NEW.activo = TRUE AND NEW.estado NOT IN ('CANCELADA', 'NO_ASISTIO') THEN
        -- Check for overlapping appointments for the same doctor
        SELECT COUNT(*), 
               (SELECT ROW(numero_cita, fecha_hora, 
                          CONCAT(p.nombre, ' ', p.apellido)) 
                FROM CITAS c2 
                JOIN PACIENTES p ON c2.id_paciente = p.id 
                WHERE c2.medico_id = NEW.medico_id
                AND c2.activo = TRUE
                AND c2.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                AND c2.id != COALESCE(NEW.id, -1)
                AND (
                    (NEW.fecha_hora BETWEEN c2.fecha_hora AND c2.fecha_hora_fin) OR
                    (NEW.fecha_hora_fin BETWEEN c2.fecha_hora AND c2.fecha_hora_fin) OR
                    (c2.fecha_hora BETWEEN NEW.fecha_hora AND NEW.fecha_hora_fin)
                )
                LIMIT 1)
        INTO conflict_count, conflict_appointment
        FROM CITAS c
        WHERE c.medico_id = NEW.medico_id
        AND c.activo = TRUE
        AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
        AND c.id != COALESCE(NEW.id, -1)
        AND (
            (NEW.fecha_hora BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
            (NEW.fecha_hora_fin BETWEEN c.fecha_hora AND c.fecha_hora_fin) OR
            (c.fecha_hora BETWEEN NEW.fecha_hora AND NEW.fecha_hora_fin)
        );

        -- If conflicts found, raise an exception
        IF conflict_count > 0 THEN
            RAISE EXCEPTION 'Conflicto de horario detectado. El médico ya tiene una cita programada: % a las % con %',
                conflict_appointment.numero_cita,
                conflict_appointment.fecha_hora,
                conflict_appointment.f3;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conflict checking (drop if exists first)
DROP TRIGGER IF EXISTS trigger_check_appointment_conflicts ON CITAS;
CREATE TRIGGER trigger_check_appointment_conflicts
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION check_appointment_conflicts();

-- Create table for doctor schedules (working hours, holidays, etc.)
CREATE TABLE IF NOT EXISTS HORARIOS_MEDICOS (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES USUARIOS(id_usuario),
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    hora_almuerzo_inicio TIME,
    hora_almuerzo_fin TIME,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por INTEGER REFERENCES USUARIOS(id_usuario),
    modificado_por INTEGER REFERENCES USUARIOS(id_usuario),
    UNIQUE(medico_id, dia_semana)
);

-- Create table for doctor holidays and exceptions
CREATE TABLE IF NOT EXISTS EXCEPCIONES_HORARIO (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES USUARIOS(id_usuario),
    fecha DATE NOT NULL,
    tipo_excepcion VARCHAR(20) NOT NULL CHECK (tipo_excepcion IN ('FERIADO', 'VACACIONES', 'ENFERMEDAD', 'PERSONAL', 'CAPACITACION')),
    hora_inicio TIME,
    hora_fin TIME,
    descripcion TEXT,
    todo_el_dia BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por INTEGER REFERENCES USUARIOS(id_usuario),
    UNIQUE(medico_id, fecha)
);

-- Create table for appointment templates (common appointment types with default settings)
CREATE TABLE IF NOT EXISTS PLANTILLAS_CITAS (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_cita VARCHAR(50) NOT NULL,
    duracion_minutos INTEGER NOT NULL DEFAULT 30,
    costo_base DECIMAL(10,2),
    especialidad VARCHAR(100),
    preparacion_especial TEXT,
    equipos_necesarios JSONB,
    color_calendario VARCHAR(7), -- Hex color code
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por INTEGER REFERENCES USUARIOS(id_usuario)
);

-- Insert default appointment templates
INSERT INTO PLANTILLAS_CITAS (nombre, tipo_cita, duracion_minutos, costo_base, descripcion, color_calendario) VALUES
('Consulta General', 'CONSULTA_GENERAL', 30, 500.00, 'Consulta médica general', '#3B82F6'),
('Primera Vez', 'PRIMERA_VEZ', 45, 600.00, 'Primera consulta con nuevo paciente', '#059669'),
('Seguimiento', 'SEGUIMIENTO', 20, 400.00, 'Consulta de seguimiento', '#0D9488'),
('Control', 'CONTROL', 15, 300.00, 'Consulta de control rutinario', '#0891B2'),
('Cirugía', 'CIRUGIA', 120, 2000.00, 'Procedimiento quirúrgico', '#7C2D12'),
('Post Operatorio', 'POST_OPERATORIO', 30, 450.00, 'Consulta post operatoria', '#BE185D'),
('Urgencia', 'URGENCIA', 30, 800.00, 'Consulta de urgencia', '#DC2626')
ON CONFLICT DO NOTHING;

-- Create table for appointment reminders configuration
CREATE TABLE IF NOT EXISTS CONFIGURACION_RECORDATORIOS (
    id SERIAL PRIMARY KEY,
    tipo_recordatorio VARCHAR(20) NOT NULL CHECK (tipo_recordatorio IN ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH')),
    horas_antes INTEGER NOT NULL,
    plantilla_mensaje TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por INTEGER REFERENCES USUARIOS(id_usuario)
);

-- Insert default reminder configurations
INSERT INTO CONFIGURACION_RECORDATORIOS (tipo_recordatorio, horas_antes, plantilla_mensaje) VALUES
('EMAIL', 24, 'Estimado/a {PATIENT_NAME}, le recordamos su cita médica programada para mañana {APPOINTMENT_DATE} a las {APPOINTMENT_TIME} con {DOCTOR_NAME}. Por favor confirme su asistencia.'),
('SMS', 2, 'Recordatorio: Cita médica hoy a las {APPOINTMENT_TIME} con {DOCTOR_NAME}. Consultorio: {ROOM}'),
('EMAIL', 2, 'Su cita médica con {DOCTOR_NAME} está programada para hoy a las {APPOINTMENT_TIME}. Ubicación: {ROOM}')
ON CONFLICT DO NOTHING;

-- Create table for appointment history (for tracking changes)
CREATE TABLE IF NOT EXISTS HISTORIAL_CITAS (
    id SERIAL PRIMARY KEY,
    cita_id INTEGER NOT NULL REFERENCES CITAS(id),
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREADA', 'MODIFICADA', 'CANCELADA', 'REPROGRAMADA', 'CONFIRMADA', 'COMPLETADA')),
    fecha_anterior TIMESTAMP,
    fecha_nueva TIMESTAMP,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    motivo TEXT,
    detalles JSONB,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER REFERENCES USUARIOS(id_usuario)
);

-- Create function to log appointment changes
CREATE OR REPLACE FUNCTION log_appointment_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the change
    IF TG_OP = 'INSERT' THEN
        INSERT INTO HISTORIAL_CITAS (cita_id, accion, fecha_nueva, estado_nuevo, usuario_id)
        VALUES (NEW.id, 'CREADA', NEW.fecha_hora, NEW.estado, NEW.creado_por);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if significant fields changed
        IF OLD.fecha_hora != NEW.fecha_hora OR OLD.estado != NEW.estado THEN
            INSERT INTO HISTORIAL_CITAS (
                cita_id, accion, fecha_anterior, fecha_nueva, 
                estado_anterior, estado_nuevo, usuario_id
            ) VALUES (
                NEW.id, 
                CASE 
                    WHEN OLD.estado != NEW.estado AND NEW.estado = 'CANCELADA' THEN 'CANCELADA'
                    WHEN OLD.estado != NEW.estado AND NEW.estado = 'REPROGRAMADA' THEN 'REPROGRAMADA'
                    WHEN OLD.estado != NEW.estado AND NEW.estado = 'CONFIRMADA' THEN 'CONFIRMADA'
                    WHEN OLD.estado != NEW.estado AND NEW.estado = 'COMPLETADA' THEN 'COMPLETADA'
                    ELSE 'MODIFICADA'
                END,
                OLD.fecha_hora, NEW.fecha_hora,
                OLD.estado, NEW.estado,
                NEW.modificado_por
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging appointment changes
DROP TRIGGER IF EXISTS trigger_log_appointment_changes ON CITAS;
CREATE TRIGGER trigger_log_appointment_changes
    AFTER INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION log_appointment_changes();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente_fecha ON CITAS(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado_fecha ON CITAS(estado, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_hora_fin ON CITAS(fecha_hora_fin);
CREATE INDEX IF NOT EXISTS idx_citas_numero_cita ON CITAS(numero_cita);
CREATE INDEX IF NOT EXISTS idx_citas_activo_estado ON CITAS(activo, estado);
CREATE INDEX IF NOT EXISTS idx_horarios_medicos_dia ON HORARIOS_MEDICOS(medico_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_excepciones_horario_fecha ON EXCEPCIONES_HORARIO(medico_id, fecha);
CREATE INDEX IF NOT EXISTS idx_historial_citas_cita_id ON HISTORIAL_CITAS(cita_id);

-- Create view for appointment calendar
CREATE OR REPLACE VIEW vista_calendario_citas AS
SELECT 
    c.id,
    c.numero_cita,
    c.fecha_hora,
    c.fecha_hora_fin,
    c.duracion_minutos,
    c.tipo_cita,
    c.especialidad,
    c.motivo,
    c.estado,
    c.sala_consulta,
    c.costo_consulta,
    c.telefono_contacto,
    c.email_contacto,
    c.recordatorio_enviado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    p.email as email_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad as especialidad_medico,
    u.id_usuario as medico_id,
    pt.color_calendario,
    CASE 
        WHEN c.estado = 'URGENCIA' THEN '#DC2626'
        WHEN c.tipo_cita = 'CIRUGIA' THEN '#7C2D12'
        WHEN c.estado = 'PROGRAMADA' THEN '#3B82F6'
        WHEN c.estado = 'CONFIRMADA' THEN '#10B981'
        WHEN c.estado = 'EN_CURSO' THEN '#F59E0B'
        WHEN c.estado = 'COMPLETADA' THEN '#6B7280'
        WHEN c.estado = 'CANCELADA' THEN '#EF4444'
        WHEN c.estado = 'NO_ASISTIO' THEN '#F97316'
        WHEN c.estado = 'REPROGRAMADA' THEN '#8B5CF6'
        ELSE '#6B7280'
    END as color_estado
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id_usuario
LEFT JOIN PLANTILLAS_CITAS pt ON c.tipo_cita = pt.tipo_cita
WHERE c.activo = TRUE;

-- Create view for doctor availability
CREATE OR REPLACE VIEW vista_disponibilidad_medicos AS
SELECT 
    u.id_usuario as medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    hm.dia_semana,
    hm.hora_inicio,
    hm.hora_fin,
    hm.hora_almuerzo_inicio,
    hm.hora_almuerzo_fin,
    CASE 
        WHEN eh.id IS NOT NULL THEN FALSE
        ELSE TRUE
    END as disponible_hoy
FROM USUARIOS u
LEFT JOIN HORARIOS_MEDICOS hm ON u.id_usuario = hm.medico_id AND hm.activo = TRUE
LEFT JOIN EXCEPCIONES_HORARIO eh ON u.id_usuario = eh.medico_id 
    AND eh.fecha = CURRENT_DATE 
    AND eh.activo = TRUE
WHERE u.activo = TRUE 
AND u.rol IN ('MEDICO', 'ADMIN');

-- Update existing appointments to have proper numero_cita if missing
UPDATE CITAS 
SET numero_cita = 'CITA-' || TO_CHAR(fecha_hora, 'YYYYMMDD') || '-' || LPAD(id::TEXT, 4, '0')
WHERE numero_cita IS NULL;

-- Update existing appointments to have proper fecha_hora_fin if missing
UPDATE CITAS 
SET fecha_hora_fin = fecha_hora + (COALESCE(duracion_minutos, 30) || ' minutes')::INTERVAL
WHERE fecha_hora_fin IS NULL;

-- Add comment to document the enhanced appointment system
COMMENT ON TABLE CITAS IS 'Enhanced appointments table with advanced scheduling, conflict detection, and calendar integration';
COMMENT ON TABLE HORARIOS_MEDICOS IS 'Doctor working hours and schedule configuration';
COMMENT ON TABLE EXCEPCIONES_HORARIO IS 'Doctor schedule exceptions (holidays, vacations, etc.)';
COMMENT ON TABLE PLANTILLAS_CITAS IS 'Appointment templates with default settings';
COMMENT ON TABLE CONFIGURACION_RECORDATORIOS IS 'Reminder configuration for different notification types';
COMMENT ON TABLE HISTORIAL_CITAS IS 'Appointment change history for audit trail';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecodigital_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecodigital_app;

COMMIT;