-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Enhanced Schedule Exception Handling - PostgreSQL
-- Descripción: Extensión del sistema de excepciones de horario
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: PLANTILLAS_DISPONIBILIDAD
-- =====================================================
CREATE TABLE IF NOT EXISTS PLANTILLAS_DISPONIBILIDAD (
    id SERIAL PRIMARY KEY,
    
    -- Información básica de la plantilla
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_plantilla VARCHAR(15) NOT NULL CHECK (tipo_plantilla IN ('SEMANAL', 'MENSUAL', 'TEMPORAL', 'ESPECIAL')),
    
    -- Configuración de horarios
    configuracion_horarios JSONB NOT NULL,
    excepciones_incluidas JSONB,
    
    -- Aplicabilidad
    aplicable_a_especialidades JSONB,
    aplicable_a_usuarios JSONB,
    es_plantilla_global BOOLEAN DEFAULT FALSE,
    
    -- Vigencia
    fecha_inicio_vigencia DATE,
    fecha_fin_vigencia DATE,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para PLANTILLAS_DISPONIBILIDAD
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo ON PLANTILLAS_DISPONIBILIDAD(tipo_plantilla);
CREATE INDEX IF NOT EXISTS idx_plantillas_vigencia ON PLANTILLAS_DISPONIBILIDAD(fecha_inicio_vigencia, fecha_fin_vigencia);
CREATE INDEX IF NOT EXISTS idx_plantillas_activo ON PLANTILLAS_DISPONIBILIDAD(activo);
CREATE INDEX IF NOT EXISTS idx_plantillas_global ON PLANTILLAS_DISPONIBILIDAD(es_plantilla_global);

-- =====================================================
-- TABLA: FERIADOS_Y_EVENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS FERIADOS_Y_EVENTOS (
    id SERIAL PRIMARY KEY,
    
    -- Información del feriado/evento
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_evento VARCHAR(25) NOT NULL CHECK (tipo_evento IN (
        'FERIADO_NACIONAL', 'FERIADO_LOCAL', 'EVENTO_MEDICO', 'CONFERENCIA', 
        'CAPACITACION', 'MANTENIMIENTO_SISTEMA', 'OTRO'
    )),
    
    -- Fechas del evento
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    es_recurrente BOOLEAN DEFAULT FALSE,
    patron_recurrencia JSONB,
    
    -- Impacto en horarios
    afecta_horarios BOOLEAN DEFAULT TRUE,
    tipo_impacto VARCHAR(20) DEFAULT 'CIERRE_TOTAL' CHECK (tipo_impacto IN (
        'CIERRE_TOTAL', 'HORARIO_REDUCIDO', 'HORARIO_ESPECIAL', 'SIN_IMPACTO'
    )),
    horario_especial JSONB,
    
    -- Aplicabilidad
    aplica_a_toda_institucion BOOLEAN DEFAULT TRUE,
    departamentos_afectados JSONB,
    especialidades_afectadas JSONB,
    usuarios_afectados JSONB,
    
    -- Notificaciones
    requiere_notificacion BOOLEAN DEFAULT TRUE,
    dias_anticipacion_notificacion INTEGER DEFAULT 7,
    mensaje_notificacion TEXT,
    
    -- Estado y aprobación
    estado VARCHAR(20) DEFAULT 'BORRADOR' CHECK (estado IN (
        'BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'ACTIVO', 'FINALIZADO', 'CANCELADO'
    )),
    aprobado_por INTEGER,
    fecha_aprobacion TIMESTAMP NULL,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT chk_eventos_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- Índices para FERIADOS_Y_EVENTOS
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON FERIADOS_Y_EVENTOS(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_fechas ON FERIADOS_Y_EVENTOS(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON FERIADOS_Y_EVENTOS(estado);
CREATE INDEX IF NOT EXISTS idx_eventos_activo ON FERIADOS_Y_EVENTOS(activo);
CREATE INDEX IF NOT EXISTS idx_eventos_recurrente ON FERIADOS_Y_EVENTOS(es_recurrente);
CREATE INDEX IF NOT EXISTS idx_eventos_institucion ON FERIADOS_Y_EVENTOS(aplica_a_toda_institucion);

-- =====================================================
-- TABLA: APLICACION_PLANTILLAS
-- =====================================================
CREATE TABLE IF NOT EXISTS APLICACION_PLANTILLAS (
    id SERIAL PRIMARY KEY,
    
    -- Información de la aplicación
    plantilla_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    
    -- Período de aplicación
    fecha_inicio_aplicacion DATE NOT NULL,
    fecha_fin_aplicacion DATE,
    
    -- Configuración específica
    configuracion_personalizada JSONB,
    excepciones_adicionales JSONB,
    
    -- Estado
    estado_aplicacion VARCHAR(15) DEFAULT 'PROGRAMADA' CHECK (estado_aplicacion IN (
        'PROGRAMADA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'
    )),
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    aplicado_por INTEGER,
    fecha_aplicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(plantilla_id, usuario_id, fecha_inicio_aplicacion)
);

-- Índices para APLICACION_PLANTILLAS
CREATE INDEX IF NOT EXISTS idx_aplicacion_plantilla ON APLICACION_PLANTILLAS(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_aplicacion_usuario ON APLICACION_PLANTILLAS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_aplicacion_fechas ON APLICACION_PLANTILLAS(fecha_inicio_aplicacion, fecha_fin_aplicacion);
CREATE INDEX IF NOT EXISTS idx_aplicacion_estado ON APLICACION_PLANTILLAS(estado_aplicacion);
CREATE INDEX IF NOT EXISTS idx_aplicacion_activo ON APLICACION_PLANTILLAS(activo);

-- =====================================================
-- EXTENSIÓN DE TABLA EXCEPCIONES_HORARIO
-- =====================================================

-- Agregar nuevos campos a la tabla existente
ALTER TABLE EXCEPCIONES_HORARIO 
ADD COLUMN IF NOT EXISTS evento_id INTEGER,
ADD COLUMN IF NOT EXISTS plantilla_id INTEGER,
ADD COLUMN IF NOT EXISTS es_recurrente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS patron_recurrencia JSONB,
ADD COLUMN IF NOT EXISTS fecha_fin DATE,
ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'CRITICA')),
ADD COLUMN IF NOT EXISTS requiere_aprobacion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aprobado_por INTEGER,
ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS estado_excepcion VARCHAR(15) DEFAULT 'ACTIVA' CHECK (estado_excepcion IN (
    'BORRADOR', 'PENDIENTE', 'APROBADA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'
)),
ADD COLUMN IF NOT EXISTS notificacion_enviada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fecha_notificacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS observaciones TEXT,
ADD COLUMN IF NOT EXISTS modificado_por INTEGER,
ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Agregar nuevos índices
CREATE INDEX IF NOT EXISTS idx_excepciones_evento ON EXCEPCIONES_HORARIO(evento_id);
CREATE INDEX IF NOT EXISTS idx_excepciones_plantilla ON EXCEPCIONES_HORARIO(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_excepciones_recurrente ON EXCEPCIONES_HORARIO(es_recurrente);
CREATE INDEX IF NOT EXISTS idx_excepciones_fecha_fin ON EXCEPCIONES_HORARIO(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_excepciones_prioridad ON EXCEPCIONES_HORARIO(prioridad);
CREATE INDEX IF NOT EXISTS idx_excepciones_estado ON EXCEPCIONES_HORARIO(estado_excepcion);
CREATE INDEX IF NOT EXISTS idx_excepciones_aprobacion ON EXCEPCIONES_HORARIO(requiere_aprobacion, aprobado_por);
CREATE INDEX IF NOT EXISTS idx_excepciones_rango_fechas ON EXCEPCIONES_HORARIO(fecha, fecha_fin);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- PLANTILLAS_DISPONIBILIDAD
ALTER TABLE PLANTILLAS_DISPONIBILIDAD 
ADD CONSTRAINT fk_plantillas_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE PLANTILLAS_DISPONIBILIDAD 
ADD CONSTRAINT fk_plantillas_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- FERIADOS_Y_EVENTOS
ALTER TABLE FERIADOS_Y_EVENTOS 
ADD CONSTRAINT fk_eventos_aprobado_por 
FOREIGN KEY (aprobado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE FERIADOS_Y_EVENTOS 
ADD CONSTRAINT fk_eventos_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE FERIADOS_Y_EVENTOS 
ADD CONSTRAINT fk_eventos_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- APLICACION_PLANTILLAS
ALTER TABLE APLICACION_PLANTILLAS 
ADD CONSTRAINT fk_aplicacion_plantilla 
FOREIGN KEY (plantilla_id) REFERENCES PLANTILLAS_DISPONIBILIDAD(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE APLICACION_PLANTILLAS 
ADD CONSTRAINT fk_aplicacion_usuario 
FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE APLICACION_PLANTILLAS 
ADD CONSTRAINT fk_aplicacion_aplicado_por 
FOREIGN KEY (aplicado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- EXCEPCIONES_HORARIO (nuevas claves foráneas)
ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_evento 
FOREIGN KEY (evento_id) REFERENCES FERIADOS_Y_EVENTOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_plantilla 
FOREIGN KEY (plantilla_id) REFERENCES PLANTILLAS_DISPONIBILIDAD(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_aprobado_por 
FOREIGN KEY (aprobado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR fecha_modificacion
-- =====================================================

-- Trigger para PLANTILLAS_DISPONIBILIDAD
CREATE TRIGGER tr_plantillas_update_fecha_modificacion
    BEFORE UPDATE ON PLANTILLAS_DISPONIBILIDAD
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para FERIADOS_Y_EVENTOS
CREATE TRIGGER tr_eventos_update_fecha_modificacion
    BEFORE UPDATE ON FERIADOS_Y_EVENTOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para EXCEPCIONES_HORARIO (actualizar fecha_modificacion)
CREATE OR REPLACE FUNCTION update_excepciones_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_excepciones_update_fecha_modificacion
    BEFORE UPDATE ON EXCEPCIONES_HORARIO
    FOR EACH ROW
    EXECUTE FUNCTION update_excepciones_fecha_modificacion();

-- =====================================================
-- VISTAS MEJORADAS
-- =====================================================

-- Vista de excepciones con información completa
CREATE OR REPLACE VIEW v_excepciones_completas AS
SELECT 
    e.id,
    e.medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as medico_nombre,
    u.especialidad,
    e.fecha,
    e.fecha_fin,
    e.tipo_excepcion,
    e.motivo,
    e.hora_inicio_especial,
    e.hora_fin_especial,
    e.es_recurrente,
    e.prioridad,
    e.estado_excepcion,
    e.requiere_aprobacion,
    CONCAT(ua.nombres, ' ', ua.apellidos) as aprobado_por_nombre,
    e.fecha_aprobacion,
    ev.nombre as evento_nombre,
    ev.tipo_evento,
    p.nombre as plantilla_nombre,
    e.notificacion_enviada,
    e.observaciones,
    e.activo,
    e.fecha_creacion
FROM EXCEPCIONES_HORARIO e
JOIN USUARIOS u ON e.medico_id = u.id
LEFT JOIN USUARIOS ua ON e.aprobado_por = ua.id
LEFT JOIN FERIADOS_Y_EVENTOS ev ON e.evento_id = ev.id
LEFT JOIN PLANTILLAS_DISPONIBILIDAD p ON e.plantilla_id = p.id
WHERE e.activo = TRUE AND u.activo = TRUE;

-- Vista de eventos activos
CREATE OR REPLACE VIEW v_eventos_activos AS
SELECT 
    e.id,
    e.nombre,
    e.descripcion,
    e.tipo_evento,
    e.fecha_inicio,
    e.fecha_fin,
    e.es_recurrente,
    e.afecta_horarios,
    e.tipo_impacto,
    e.aplica_a_toda_institucion,
    e.estado,
    CONCAT(u.nombres, ' ', u.apellidos) as creado_por_nombre,
    e.fecha_creacion,
    (e.fecha_inicio - CURRENT_DATE) as dias_hasta_inicio
FROM FERIADOS_Y_EVENTOS e
LEFT JOIN USUARIOS u ON e.creado_por = u.id
WHERE e.activo = TRUE 
  AND e.estado IN ('APROBADO', 'ACTIVO')
  AND e.fecha_fin >= CURRENT_DATE;

-- Vista de plantillas disponibles
CREATE OR REPLACE VIEW v_plantillas_disponibles AS
SELECT 
    p.id,
    p.nombre,
    p.descripcion,
    p.tipo_plantilla,
    p.es_plantilla_global,
    p.fecha_inicio_vigencia,
    p.fecha_fin_vigencia,
    CONCAT(u.nombres, ' ', u.apellidos) as creado_por_nombre,
    p.fecha_creacion,
    COUNT(ap.id) as aplicaciones_activas
FROM PLANTILLAS_DISPONIBILIDAD p
LEFT JOIN USUARIOS u ON p.creado_por = u.id
LEFT JOIN APLICACION_PLANTILLAS ap ON p.id = ap.plantilla_id AND ap.activo = TRUE
WHERE p.activo = TRUE
  AND (p.fecha_fin_vigencia IS NULL OR p.fecha_fin_vigencia >= CURRENT_DATE)
GROUP BY p.id, u.nombres, u.apellidos;

-- Vista de disponibilidad mejorada con excepciones
CREATE OR REPLACE VIEW v_disponibilidad_medicos_mejorada AS
SELECT 
    u.id as medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.duracion_cita_minutos,
    h.activo as horario_activo,
    h.fecha_inicio_vigencia,
    h.fecha_fin_vigencia,
    COUNT(e.id) as excepciones_activas,
    STRING_AGG(DISTINCT e.tipo_excepcion, ', ') as tipos_excepciones,
    ap.plantilla_id,
    p.nombre as plantilla_nombre
FROM USUARIOS u
JOIN HORARIOS_MEDICOS h ON u.id = h.medico_id
LEFT JOIN EXCEPCIONES_HORARIO e ON u.id = e.medico_id 
    AND e.activo = TRUE 
    AND e.estado_excepcion = 'ACTIVA'
    AND (e.fecha_fin IS NULL OR e.fecha_fin >= CURRENT_DATE)
LEFT JOIN APLICACION_PLANTILLAS ap ON u.id = ap.usuario_id 
    AND ap.activo = TRUE 
    AND ap.estado_aplicacion = 'ACTIVA'
LEFT JOIN PLANTILLAS_DISPONIBILIDAD p ON ap.plantilla_id = p.id
WHERE u.activo = TRUE AND h.activo = TRUE
  AND (h.fecha_fin_vigencia IS NULL OR h.fecha_fin_vigencia >= CURRENT_DATE)
GROUP BY u.id, h.id, ap.plantilla_id, p.nombre;

-- =====================================================
-- PROCEDIMIENTOS ALMACENADOS
-- =====================================================

-- Procedimiento para aplicar eventos a excepciones
CREATE OR REPLACE FUNCTION sp_aplicar_evento_a_excepciones(
    p_evento_id INTEGER,
    p_usuario_aplicacion INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_medico_id INTEGER;
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
    v_tipo_evento VARCHAR(50);
    v_nombre_evento VARCHAR(100);
    medicos_cursor CURSOR FOR
        SELECT u.id
        FROM USUARIOS u
        WHERE u.activo = TRUE 
          AND u.rol_id IN (SELECT id FROM ROLES WHERE nombre LIKE '%MEDICO%' OR nombre LIKE '%ESPECIALISTA%');
BEGIN
    -- Obtener información del evento
    SELECT fecha_inicio, fecha_fin, tipo_evento, nombre
    INTO v_fecha_inicio, v_fecha_fin, v_tipo_evento, v_nombre_evento
    FROM FERIADOS_Y_EVENTOS
    WHERE id = p_evento_id AND activo = TRUE;
    
    -- Aplicar a todos los médicos
    FOR medico_rec IN medicos_cursor LOOP
        -- Insertar excepción para cada médico
        INSERT INTO EXCEPCIONES_HORARIO (
            medico_id, fecha, fecha_fin, tipo_excepcion, motivo, evento_id,
            estado_excepcion, creado_por
        ) VALUES (
            medico_rec.id, v_fecha_inicio, v_fecha_fin, 'NO_DISPONIBLE', 
            CONCAT('Evento: ', v_nombre_evento), p_evento_id,
            'ACTIVA', p_usuario_aplicacion
        )
        ON CONFLICT (medico_id, fecha) DO UPDATE SET
            motivo = CONCAT('Evento: ', v_nombre_evento),
            evento_id = p_evento_id,
            modificado_por = p_usuario_aplicacion,
            fecha_modificacion = CURRENT_TIMESTAMP;
    END LOOP;
    
    -- Actualizar estado del evento
    UPDATE FERIADOS_Y_EVENTOS 
    SET estado = 'ACTIVO'
    WHERE id = p_evento_id;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento para generar excepciones recurrentes
CREATE OR REPLACE FUNCTION sp_generar_excepciones_recurrentes(
    p_fecha_limite DATE
)
RETURNS VOID AS $$
DECLARE
    excepcion_rec RECORD;
    fecha_actual DATE;
BEGIN
    FOR excepcion_rec IN
        SELECT id, medico_id, fecha, patron_recurrencia, tipo_excepcion, motivo
        FROM EXCEPCIONES_HORARIO
        WHERE es_recurrente = TRUE 
          AND activo = TRUE 
          AND estado_excepcion = 'ACTIVA'
          AND patron_recurrencia IS NOT NULL
    LOOP
        -- Ejemplo básico para recurrencia semanal
        IF excepcion_rec.patron_recurrencia->>'tipo' = 'semanal' THEN
            fecha_actual := excepcion_rec.fecha + INTERVAL '1 week';
            
            WHILE fecha_actual <= p_fecha_limite LOOP
                INSERT INTO EXCEPCIONES_HORARIO (
                    medico_id, fecha, tipo_excepcion, motivo, es_recurrente,
                    patron_recurrencia, estado_excepcion, creado_por
                ) VALUES (
                    excepcion_rec.medico_id, fecha_actual, excepcion_rec.tipo_excepcion, 
                    CONCAT(excepcion_rec.motivo, ' (Recurrente)'), FALSE, NULL,
                    'ACTIVA', 1
                )
                ON CONFLICT (medico_id, fecha) DO NOTHING;
                
                fecha_actual := fecha_actual + INTERVAL '1 week';
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema de extensión implementa:

1. PLANTILLAS_DISPONIBILIDAD:
   - Sistema de plantillas para horarios estándar
   - Configuración reutilizable de horarios
   - Aplicabilidad por especialidad o usuario

2. FERIADOS_Y_EVENTOS:
   - Gestión centralizada de feriados y eventos
   - Impacto automático en horarios
   - Sistema de aprobación y notificación

3. APLICACION_PLANTILLAS:
   - Aplicación de plantillas a usuarios específicos
   - Personalización por usuario
   - Control de vigencia temporal

4. EXTENSIÓN EXCEPCIONES_HORARIO:
   - Excepciones recurrentes
   - Vinculación con eventos y plantillas
   - Sistema de aprobación mejorado
   - Mejor seguimiento y auditoría

5. VISTAS MEJORADAS:
   - Información completa de excepciones
   - Eventos activos con impacto
   - Disponibilidad con excepciones integradas

6. PROCEDIMIENTOS ALMACENADOS:
   - Aplicación automática de eventos
   - Generación de excepciones recurrentes
   - Automatización de procesos comunes

El sistema permite:
- Gestión avanzada de excepciones de horario
- Plantillas reutilizables de disponibilidad
- Manejo automático de feriados y eventos
- Sistema de aprobación y notificación
- Excepciones recurrentes automatizadas
*/