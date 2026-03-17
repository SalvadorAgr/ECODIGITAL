-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Citas Recurrentes (PostgreSQL)
-- Descripción: Gestión de citas médicas recurrentes
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: CITAS_RECURRENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS CITAS_RECURRENTES (
    id SERIAL PRIMARY KEY,
    
    -- Información básica del patrón recurrente
    nombre_patron VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- Relaciones
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,
    
    -- Configuración de la cita base
    tipo_cita VARCHAR(20) NOT NULL CHECK (tipo_cita IN ('CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA')),
    duracion_minutos INTEGER DEFAULT 30,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    
    -- Configuración de recurrencia
    tipo_recurrencia VARCHAR(15) NOT NULL CHECK (tipo_recurrencia IN ('DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL', 'PERSONALIZADA')),
    intervalo_recurrencia INTEGER DEFAULT 1,
    dias_semana JSONB, -- Días de la semana para recurrencia semanal [1-7, donde 1=Lunes]
    dia_mes INTEGER,
    semana_mes INTEGER,
    mes_año INTEGER,
    
    -- Horario de las citas
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    
    -- Período de vigencia
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    numero_ocurrencias INTEGER,
    ocurrencias_generadas INTEGER DEFAULT 0,
    
    -- Configuración avanzada
    generar_automaticamente BOOLEAN DEFAULT TRUE,
    dias_anticipacion INTEGER DEFAULT 30,
    permitir_fines_semana BOOLEAN DEFAULT FALSE,
    excluir_feriados BOOLEAN DEFAULT TRUE,
    
    -- Configuración de notificaciones
    notificar_creacion BOOLEAN DEFAULT TRUE,
    plantilla_notificacion TEXT,
    
    -- Estado del patrón
    estado VARCHAR(15) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO')),
    fecha_pausa TIMESTAMP,
    motivo_pausa TEXT,
    
    -- Configuración de conflictos
    accion_conflicto VARCHAR(15) DEFAULT 'NOTIFICAR' CHECK (accion_conflicto IN ('OMITIR', 'REPROGRAMAR', 'NOTIFICAR')),
    max_intentos_reprogramacion INTEGER DEFAULT 3,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_citas_recurrentes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_citas_recurrentes
    BEFORE UPDATE ON CITAS_RECURRENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_citas_recurrentes();

-- Índices para rendimiento
CREATE INDEX idx_recurrentes_paciente ON CITAS_RECURRENTES(id_paciente);
CREATE INDEX idx_recurrentes_medico ON CITAS_RECURRENTES(medico_id);
CREATE INDEX idx_recurrentes_estado ON CITAS_RECURRENTES(estado);
CREATE INDEX idx_recurrentes_tipo ON CITAS_RECURRENTES(tipo_recurrencia);
CREATE INDEX idx_recurrentes_fecha_inicio ON CITAS_RECURRENTES(fecha_inicio);
CREATE INDEX idx_recurrentes_fecha_fin ON CITAS_RECURRENTES(fecha_fin);
CREATE INDEX idx_recurrentes_activo ON CITAS_RECURRENTES(activo);
CREATE INDEX idx_recurrentes_generacion ON CITAS_RECURRENTES(generar_automaticamente, estado);

-- Claves foráneas
ALTER TABLE CITAS_RECURRENTES 
ADD CONSTRAINT fk_recurrentes_paciente 
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES 
ADD CONSTRAINT fk_recurrentes_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES 
ADD CONSTRAINT fk_recurrentes_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES 
ADD CONSTRAINT fk_recurrentes_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: CITAS_RECURRENTES_INSTANCIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS CITAS_RECURRENTES_INSTANCIAS (
    id SERIAL PRIMARY KEY,
    
    -- Relación con el patrón recurrente
    patron_recurrente_id INTEGER NOT NULL,
    cita_id INTEGER NOT NULL,
    
    -- Información de la instancia
    numero_secuencia INTEGER NOT NULL,
    fecha_programada_original DATE NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Estado de la instancia
    estado_generacion VARCHAR(15) DEFAULT 'GENERADA' CHECK (estado_generacion IN ('GENERADA', 'OMITIDA', 'REPROGRAMADA', 'ERROR')),
    motivo_omision TEXT,
    intentos_reprogramacion INTEGER DEFAULT 0,
    
    -- Modificaciones específicas de la instancia
    modificada_manualmente BOOLEAN DEFAULT FALSE,
    fecha_modificacion_manual TIMESTAMP,
    modificado_por INTEGER,
    
    -- Campos de auditoría
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX idx_instancias_patron ON CITAS_RECURRENTES_INSTANCIAS(patron_recurrente_id);
CREATE INDEX idx_instancias_cita ON CITAS_RECURRENTES_INSTANCIAS(cita_id);
CREATE INDEX idx_instancias_secuencia ON CITAS_RECURRENTES_INSTANCIAS(patron_recurrente_id, numero_secuencia);
CREATE INDEX idx_instancias_fecha_programada ON CITAS_RECURRENTES_INSTANCIAS(fecha_programada_original);
CREATE INDEX idx_instancias_estado ON CITAS_RECURRENTES_INSTANCIAS(estado_generacion);

-- Claves foráneas
ALTER TABLE CITAS_RECURRENTES_INSTANCIAS 
ADD CONSTRAINT fk_instancias_patron 
FOREIGN KEY (patron_recurrente_id) REFERENCES CITAS_RECURRENTES(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES_INSTANCIAS 
ADD CONSTRAINT fk_instancias_cita 
FOREIGN KEY (cita_id) REFERENCES CITAS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES_INSTANCIAS 
ADD CONSTRAINT fk_instancias_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones únicas para evitar duplicados
ALTER TABLE CITAS_RECURRENTES_INSTANCIAS 
ADD CONSTRAINT uk_patron_secuencia UNIQUE (patron_recurrente_id, numero_secuencia);

ALTER TABLE CITAS_RECURRENTES_INSTANCIAS 
ADD CONSTRAINT uk_patron_cita UNIQUE (patron_recurrente_id, cita_id);

-- =====================================================
-- TABLA: CITAS_RECURRENTES_EXCEPCIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS CITAS_RECURRENTES_EXCEPCIONES (
    id SERIAL PRIMARY KEY,
    
    -- Relación con el patrón recurrente
    patron_recurrente_id INTEGER NOT NULL,
    
    -- Información de la excepción
    fecha_excepcion DATE NOT NULL,
    tipo_excepcion VARCHAR(20) NOT NULL CHECK (tipo_excepcion IN ('OMITIR', 'REPROGRAMAR', 'MODIFICAR_HORARIO', 'CAMBIAR_DURACION')),
    motivo TEXT,
    
    -- Configuración de reprogramación (si aplica)
    nueva_fecha DATE,
    nueva_hora_inicio TIME,
    nueva_duracion INTEGER,
    
    -- Estado de la excepción
    activo BOOLEAN DEFAULT TRUE,
    aplicada BOOLEAN DEFAULT FALSE,
    fecha_aplicacion TIMESTAMP,
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX idx_excepciones_patron ON CITAS_RECURRENTES_EXCEPCIONES(patron_recurrente_id);
CREATE INDEX idx_excepciones_fecha ON CITAS_RECURRENTES_EXCEPCIONES(fecha_excepcion);
CREATE INDEX idx_excepciones_tipo ON CITAS_RECURRENTES_EXCEPCIONES(tipo_excepcion);
CREATE INDEX idx_excepciones_activo ON CITAS_RECURRENTES_EXCEPCIONES(activo);

-- Claves foráneas
ALTER TABLE CITAS_RECURRENTES_EXCEPCIONES 
ADD CONSTRAINT fk_excepciones_patron 
FOREIGN KEY (patron_recurrente_id) REFERENCES CITAS_RECURRENTES(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE CITAS_RECURRENTES_EXCEPCIONES 
ADD CONSTRAINT fk_excepciones_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricción única para evitar excepciones duplicadas en la misma fecha
ALTER TABLE CITAS_RECURRENTES_EXCEPCIONES 
ADD CONSTRAINT uk_patron_fecha_excepcion UNIQUE (patron_recurrente_id, fecha_excepcion);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de patrones recurrentes con estadísticas
CREATE OR REPLACE VIEW v_patrones_recurrentes_completos AS
SELECT 
    cr.id,
    cr.nombre_patron,
    cr.descripcion,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    cr.tipo_cita,
    cr.tipo_recurrencia,
    cr.fecha_inicio,
    cr.fecha_fin,
    cr.estado,
    cr.ocurrencias_generadas,
    cr.numero_ocurrencias,
    -- Estadísticas calculadas
    (SELECT COUNT(*) FROM CITAS_RECURRENTES_INSTANCIAS cri WHERE cri.patron_recurrente_id = cr.id) as total_instancias,
    (SELECT COUNT(*) FROM CITAS_RECURRENTES_INSTANCIAS cri 
     JOIN CITAS c ON cri.cita_id = c.id 
     WHERE cri.patron_recurrente_id = cr.id AND c.estado = 'COMPLETADA') as citas_completadas,
    (SELECT COUNT(*) FROM CITAS_RECURRENTES_EXCEPCIONES cre 
     WHERE cre.patron_recurrente_id = cr.id AND cre.activo = TRUE) as excepciones_activas,
    cr.fecha_creacion,
    cr.activo
FROM CITAS_RECURRENTES cr
JOIN PACIENTES p ON cr.id_paciente = p.id
JOIN USUARIOS u ON cr.medico_id = u.id
WHERE cr.activo = TRUE AND p.activo = TRUE;

-- Vista de próximas citas a generar
CREATE OR REPLACE VIEW v_proximas_citas_generar AS
SELECT 
    cr.id as patron_id,
    cr.nombre_patron,
    cr.id_paciente,
    cr.medico_id,
    cr.tipo_cita,
    cr.duracion_minutos,
    cr.hora_inicio,
    cr.dias_anticipacion,
    cr.fecha_inicio,
    cr.fecha_fin,
    cr.numero_ocurrencias,
    cr.ocurrencias_generadas,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico
FROM CITAS_RECURRENTES cr
JOIN PACIENTES p ON cr.id_paciente = p.id
JOIN USUARIOS u ON cr.medico_id = u.id
WHERE cr.activo = TRUE 
  AND cr.estado = 'ACTIVO'
  AND cr.generar_automaticamente = TRUE
  AND (cr.fecha_fin IS NULL OR cr.fecha_fin >= CURRENT_DATE)
  AND (cr.numero_ocurrencias IS NULL OR cr.ocurrencias_generadas < cr.numero_ocurrencias);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa:

1. TABLA CITAS_RECURRENTES:
   - Patrones de recurrencia flexibles (diaria, semanal, mensual, anual, personalizada)
   - Configuración avanzada de generación automática
   - Manejo de conflictos y excepciones
   - Control de estado y auditoría completa

2. TABLA CITAS_RECURRENTES_INSTANCIAS:
   - Seguimiento de cada cita generada por el patrón
   - Control de secuencia y estado de generación
   - Manejo de modificaciones manuales

3. TABLA CITAS_RECURRENTES_EXCEPCIONES:
   - Excepciones específicas para fechas particulares
   - Diferentes tipos de excepciones (omitir, reprogramar, modificar)
   - Control de aplicación de excepciones

4. CARACTERÍSTICAS PRINCIPALES:
   - Generación automática con días de anticipación configurables
   - Manejo de conflictos con diferentes estrategias
   - Exclusión de feriados y fines de semana
   - Notificaciones personalizables
   - Soft delete en todas las tablas
   - Índices optimizados para consultas frecuentes

5. VISTAS ÚTILES:
   - Vista completa de patrones con estadísticas
   - Vista de próximas citas a generar para procesos automáticos

Conversiones PostgreSQL aplicadas:
- AUTO_INCREMENT → SERIAL
- ENUM → VARCHAR con CHECK constraints
- JSON → JSONB para mejor rendimiento
- Triggers para fecha_modificacion automática
- CURDATE() → CURRENT_DATE
- NOW() → CURRENT_TIMESTAMP
*/