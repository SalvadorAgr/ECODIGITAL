-- Integration Enhancements for Appointment Scheduling System
-- Adds tables and enhancements for integration with Python services

-- Error logging table for enhanced error handling
CREATE TABLE IF NOT EXISTS LOGS_ERRORES (
    id SERIAL PRIMARY KEY,
    tipo_error VARCHAR(100) NOT NULL,
    mensaje TEXT NOT NULL,
    detalles JSONB,
    contexto_request JSONB,
    usuario_id INTEGER REFERENCES USUARIOS(id),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelto BOOLEAN DEFAULT FALSE,
    fecha_resolucion TIMESTAMP,
    resuelto_por INTEGER REFERENCES USUARIOS(id),
    notas_resolucion TEXT,
    
    -- Indexes for performance
    INDEX idx_logs_errores_tipo (tipo_error),
    INDEX idx_logs_errores_fecha (fecha_hora),
    INDEX idx_logs_errores_usuario (usuario_id),
    INDEX idx_logs_errores_resuelto (resuelto)
);

-- Add priority scoring fields to CITAS table if they don't exist
ALTER TABLE CITAS 
ADD COLUMN IF NOT EXISTS puntuacion_prioridad INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS fecha_asignacion_prioridad TIMESTAMP,
ADD COLUMN IF NOT EXISTS asignado_prioridad_por INTEGER REFERENCES USUARIOS(id),
ADD COLUMN IF NOT EXISTS fecha_escalacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalado_por INTEGER REFERENCES USUARIOS(id),
ADD COLUMN IF NOT EXISTS motivo_urgencia TEXT;

-- Priority history table
CREATE TABLE IF NOT EXISTS HISTORIAL_PRIORIDADES (
    id SERIAL PRIMARY KEY,
    cita_id INTEGER NOT NULL REFERENCES CITAS(id),
    prioridad_anterior VARCHAR(20),
    prioridad_nueva VARCHAR(20) NOT NULL,
    motivo_cambio TEXT,
    es_escalacion_automatica BOOLEAN DEFAULT FALSE,
    puntuacion_anterior INTEGER,
    puntuacion_nueva INTEGER NOT NULL,
    cambiado_por INTEGER REFERENCES USUARIOS(id),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_historial_prioridades_cita (cita_id),
    INDEX idx_historial_prioridades_fecha (fecha_cambio)
);

-- Priority configuration table
CREATE TABLE IF NOT EXISTS CONFIGURACION_PRIORIDADES (
    id SERIAL PRIMARY KEY,
    nivel_prioridad VARCHAR(20) UNIQUE NOT NULL,
    puntuacion_base INTEGER NOT NULL,
    color_codigo VARCHAR(7) DEFAULT '#000000',
    descripcion TEXT,
    requiere_autorizacion BOOLEAN DEFAULT FALSE,
    tiempo_maximo_espera_horas INTEGER,
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER REFERENCES USUARIOS(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default priority configurations
INSERT INTO CONFIGURACION_PRIORIDADES (nivel_prioridad, puntuacion_base, color_codigo, descripcion, tiempo_maximo_espera_horas) 
VALUES 
    ('BAJA', 10, '#28a745', 'Prioridad baja - no urgente', 168),
    ('NORMAL', 50, '#007bff', 'Prioridad normal - rutinaria', 72),
    ('ALTA', 100, '#fd7e14', 'Prioridad alta - importante', 24),
    ('URGENTE', 200, '#dc3545', 'Prioridad urgente - inmediata', 4)
ON CONFLICT (nivel_prioridad) DO NOTHING;

-- Escalation rules table
CREATE TABLE IF NOT EXISTS REGLAS_ESCALACION (
    id SERIAL PRIMARY KEY,
    nombre_regla VARCHAR(100) NOT NULL,
    descripcion TEXT,
    prioridad_origen VARCHAR(20) NOT NULL,
    prioridad_destino VARCHAR(20) NOT NULL,
    horas_espera INTEGER NOT NULL,
    tipo_cita VARCHAR(50),
    dias_semana_aplicables JSONB, -- Array of day numbers [1,2,3,4,5]
    horario_inicio TIME,
    horario_fin TIME,
    max_escalaciones_por_cita INTEGER DEFAULT 3,
    requiere_aprobacion BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    orden_ejecucion INTEGER DEFAULT 1,
    creado_por INTEGER REFERENCES USUARIOS(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_reglas_escalacion_origen (prioridad_origen),
    INDEX idx_reglas_escalacion_activo (activo),
    INDEX idx_reglas_escalacion_orden (orden_ejecucion)
);

-- Insert default escalation rules
INSERT INTO REGLAS_ESCALACION (nombre_regla, descripcion, prioridad_origen, prioridad_destino, horas_espera, dias_semana_aplicables)
VALUES 
    ('Escalación Normal a Alta', 'Escalar citas normales después de 48 horas', 'NORMAL', 'ALTA', 48, '[1,2,3,4,5]'),
    ('Escalación Alta a Urgente', 'Escalar citas de alta prioridad después de 12 horas', 'ALTA', 'URGENTE', 12, '[1,2,3,4,5,6,7]'),
    ('Escalación Baja a Normal', 'Escalar citas de baja prioridad después de 1 semana', 'BAJA', 'NORMAL', 168, '[1,2,3,4,5]')
ON CONFLICT DO NOTHING;

-- Resource availability configuration table
CREATE TABLE IF NOT EXISTS DISPONIBILIDAD_RECURSOS (
    id SERIAL PRIMARY KEY,
    recurso_id INTEGER NOT NULL REFERENCES RECURSOS(id),
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    capacidad_disponible INTEGER DEFAULT 1,
    requiere_reserva_previa BOOLEAN DEFAULT TRUE,
    tiempo_minimo_reserva INTEGER DEFAULT 60, -- minutes
    fecha_inicio_vigencia DATE DEFAULT CURRENT_DATE,
    fecha_fin_vigencia DATE,
    activo BOOLEAN DEFAULT TRUE,
    excepciones JSONB, -- Special exceptions for this availability
    creado_por INTEGER REFERENCES USUARIOS(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_disponibilidad_recursos_horario CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_disponibilidad_recursos_capacidad CHECK (capacidad_disponible > 0),
    
    -- Indexes
    INDEX idx_disponibilidad_recursos_recurso (recurso_id),
    INDEX idx_disponibilidad_recursos_dia (dia_semana),
    INDEX idx_disponibilidad_recursos_vigencia (fecha_inicio_vigencia, fecha_fin_vigencia)
);

-- Integration service status table
CREATE TABLE IF NOT EXISTS ESTADO_SERVICIOS_INTEGRACION (
    id SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(100) NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'unknown', -- healthy, unhealthy, unknown
    ultima_verificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tiempo_respuesta_ms INTEGER,
    mensaje_error TEXT,
    version_servicio VARCHAR(50),
    configuracion JSONB,
    metricas JSONB,
    
    -- Indexes
    INDEX idx_estado_servicios_nombre (nombre_servicio),
    INDEX idx_estado_servicios_estado (estado),
    INDEX idx_estado_servicios_verificacion (ultima_verificacion)
);

-- Insert default service status entries
INSERT INTO ESTADO_SERVICIOS_INTEGRACION (nombre_servicio, estado)
VALUES 
    ('resource_manager', 'unknown'),
    ('priority_manager', 'unknown'),
    ('schedule_exception_manager', 'unknown'),
    ('mobile_sync_service', 'unknown')
ON CONFLICT (nombre_servicio) DO NOTHING;

-- Patient scheduling preferences table
CREATE TABLE IF NOT EXISTS PREFERENCIAS_PROGRAMACION_PACIENTES (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES PACIENTES(id),
    medico_preferido_id INTEGER REFERENCES USUARIOS(id),
    horario_preferido_inicio TIME,
    horario_preferido_fin TIME,
    dias_preferidos JSONB, -- Array of preferred days [1,2,3,4,5]
    duracion_preferida_minutos INTEGER,
    tipo_cita_preferido VARCHAR(50),
    requiere_recordatorios BOOLEAN DEFAULT TRUE,
    metodo_recordatorio_preferido VARCHAR(20) DEFAULT 'email', -- email, sms, phone
    tiempo_anticipacion_recordatorio INTEGER DEFAULT 24, -- hours
    notas_especiales TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT uk_preferencias_paciente UNIQUE (paciente_id),
    
    -- Indexes
    INDEX idx_preferencias_paciente (paciente_id),
    INDEX idx_preferencias_medico (medico_preferido_id)
);

-- Appointment optimization metrics table
CREATE TABLE IF NOT EXISTS METRICAS_OPTIMIZACION_CITAS (
    id SERIAL PRIMARY KEY,
    cita_id INTEGER NOT NULL REFERENCES CITAS(id),
    puntuacion_optimizacion DECIMAL(5,2),
    factores_optimizacion JSONB,
    tiempo_calculo_ms INTEGER,
    algoritmo_utilizado VARCHAR(50),
    sugerencias_aplicadas JSONB,
    resultado_optimizacion VARCHAR(20), -- optimal, good, acceptable, poor
    fecha_calculo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_metricas_optimizacion_cita (cita_id),
    INDEX idx_metricas_optimizacion_fecha (fecha_calculo),
    INDEX idx_metricas_optimizacion_resultado (resultado_optimizacion)
);

-- Add indexes to existing tables for better performance
CREATE INDEX IF NOT EXISTS idx_citas_puntuacion_prioridad ON CITAS(puntuacion_prioridad DESC);
CREATE INDEX IF NOT EXISTS idx_citas_prioridad_fecha ON CITAS(prioridad, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_es_urgente ON CITAS(es_urgente) WHERE es_urgente = TRUE;
CREATE INDEX IF NOT EXISTS idx_reservas_recursos_fecha_inicio ON RESERVAS_RECURSOS(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_recursos_estado ON RESERVAS_RECURSOS(estado_reserva);

-- Add triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to preferences table
DROP TRIGGER IF EXISTS trigger_update_preferencias_fecha_modificacion ON PREFERENCIAS_PROGRAMACION_PACIENTES;
CREATE TRIGGER trigger_update_preferencias_fecha_modificacion
    BEFORE UPDATE ON PREFERENCIAS_PROGRAMACION_PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Create view for enhanced appointment data
CREATE OR REPLACE VIEW vista_citas_mejoradas AS
SELECT 
    c.*,
    cp.descripcion as descripcion_prioridad,
    cp.color_codigo as color_prioridad,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    p.email as email_paciente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad as especialidad_medico,
    COUNT(rr.id) as recursos_asignados,
    COUNT(hp.id) as cambios_prioridad,
    mo.puntuacion_optimizacion,
    mo.resultado_optimizacion,
    CASE 
        WHEN c.es_urgente THEN c.puntuacion_prioridad + 1000
        ELSE c.puntuacion_prioridad
    END as puntuacion_final
FROM CITAS c
LEFT JOIN PACIENTES p ON c.id_paciente = p.id
LEFT JOIN USUARIOS u ON c.medico_id = u.id
LEFT JOIN CONFIGURACION_PRIORIDADES cp ON c.prioridad = cp.nivel_prioridad
LEFT JOIN RESERVAS_RECURSOS rr ON c.id = rr.cita_id AND rr.activo = TRUE
LEFT JOIN HISTORIAL_PRIORIDADES hp ON c.id = hp.cita_id
LEFT JOIN METRICAS_OPTIMIZACION_CITAS mo ON c.id = mo.cita_id
WHERE c.activo = TRUE
GROUP BY c.id, cp.descripcion, cp.color_codigo, p.nombre, p.apellido, p.telefono, p.email,
         u.nombres, u.apellidos, u.especialidad, mo.puntuacion_optimizacion, mo.resultado_optimizacion;

-- Create function for automatic priority escalation
CREATE OR REPLACE FUNCTION escalar_prioridades_automaticamente()
RETURNS INTEGER AS $$
DECLARE
    regla RECORD;
    cita RECORD;
    escalaciones_realizadas INTEGER := 0;
BEGIN
    -- Loop through active escalation rules
    FOR regla IN 
        SELECT * FROM REGLAS_ESCALACION 
        WHERE activo = TRUE 
        ORDER BY orden_ejecucion ASC
    LOOP
        -- Find eligible appointments for this rule
        FOR cita IN
            SELECT c.id, c.numero_cita, c.prioridad, c.fecha_hora
            FROM CITAS c
            WHERE c.activo = TRUE
              AND c.prioridad = regla.prioridad_origen
              AND c.fecha_hora <= (CURRENT_TIMESTAMP - INTERVAL '1 hour' * regla.horas_espera)
              AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
              AND (regla.tipo_cita IS NULL OR c.tipo_cita = regla.tipo_cita)
              AND (regla.max_escalaciones_por_cita = 0 OR 
                   (SELECT COUNT(*) FROM HISTORIAL_PRIORIDADES hp 
                    WHERE hp.cita_id = c.id AND hp.es_escalacion_automatica = TRUE) < regla.max_escalaciones_por_cita)
        LOOP
            -- Update appointment priority
            UPDATE CITAS 
            SET prioridad = regla.prioridad_destino,
                puntuacion_prioridad = (
                    SELECT puntuacion_base FROM CONFIGURACION_PRIORIDADES 
                    WHERE nivel_prioridad = regla.prioridad_destino
                ),
                fecha_escalacion = CURRENT_TIMESTAMP,
                fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id = cita.id;
            
            -- Record escalation in history
            INSERT INTO HISTORIAL_PRIORIDADES (
                cita_id, prioridad_anterior, prioridad_nueva,
                motivo_cambio, es_escalacion_automatica,
                puntuacion_anterior, puntuacion_nueva,
                fecha_cambio
            ) VALUES (
                cita.id, cita.prioridad, regla.prioridad_destino,
                'Escalación automática por regla: ' || regla.nombre_regla,
                TRUE,
                (SELECT puntuacion_base FROM CONFIGURACION_PRIORIDADES WHERE nivel_prioridad = cita.prioridad),
                (SELECT puntuacion_base FROM CONFIGURACION_PRIORIDADES WHERE nivel_prioridad = regla.prioridad_destino),
                CURRENT_TIMESTAMP
            );
            
            escalaciones_realizadas := escalaciones_realizadas + 1;
        END LOOP;
    END LOOP;
    
    RETURN escalaciones_realizadas;
END;
$$ LANGUAGE plpgsql;

-- Create function to update service health status
CREATE OR REPLACE FUNCTION actualizar_estado_servicio(
    p_nombre_servicio VARCHAR(100),
    p_estado VARCHAR(20),
    p_tiempo_respuesta_ms INTEGER DEFAULT NULL,
    p_mensaje_error TEXT DEFAULT NULL,
    p_version VARCHAR(50) DEFAULT NULL,
    p_metricas JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ESTADO_SERVICIOS_INTEGRACION (
        nombre_servicio, estado, ultima_verificacion, tiempo_respuesta_ms,
        mensaje_error, version_servicio, metricas
    ) VALUES (
        p_nombre_servicio, p_estado, CURRENT_TIMESTAMP, p_tiempo_respuesta_ms,
        p_mensaje_error, p_version, p_metricas
    )
    ON CONFLICT (nombre_servicio) 
    DO UPDATE SET
        estado = EXCLUDED.estado,
        ultima_verificacion = EXCLUDED.ultima_verificacion,
        tiempo_respuesta_ms = EXCLUDED.tiempo_respuesta_ms,
        mensaje_error = EXCLUDED.mensaje_error,
        version_servicio = EXCLUDED.version_servicio,
        metricas = EXCLUDED.metricas;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE LOGS_ERRORES IS 'Comprehensive error logging for enhanced error handling';
COMMENT ON TABLE HISTORIAL_PRIORIDADES IS 'Track all priority changes and escalations for appointments';
COMMENT ON TABLE CONFIGURACION_PRIORIDADES IS 'Configuration for appointment priority levels';
COMMENT ON TABLE REGLAS_ESCALACION IS 'Automatic priority escalation rules';
COMMENT ON TABLE DISPONIBILIDAD_RECURSOS IS 'Resource availability schedules';
COMMENT ON TABLE ESTADO_SERVICIOS_INTEGRACION IS 'Health status of integration services';
COMMENT ON TABLE PREFERENCIAS_PROGRAMACION_PACIENTES IS 'Patient scheduling preferences and history';
COMMENT ON TABLE METRICAS_OPTIMIZACION_CITAS IS 'Appointment optimization metrics and results';

COMMENT ON FUNCTION escalar_prioridades_automaticamente() IS 'Automatically escalate appointment priorities based on configured rules';
COMMENT ON FUNCTION actualizar_estado_servicio(VARCHAR, VARCHAR, INTEGER, TEXT, VARCHAR, JSONB) IS 'Update integration service health status';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO appointment_scheduler_role;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO appointment_scheduler_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO appointment_scheduler_role;