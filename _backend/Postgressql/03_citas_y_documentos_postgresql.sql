-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Citas y Documentos - PostgreSQL
-- Descripción: Gestión de citas médicas y documentos
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: CITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS CITAS (
    id SERIAL PRIMARY KEY,
    
    -- Información básica de la cita
    numero_cita VARCHAR(20) UNIQUE NOT NULL,
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,
    
    -- Programación de la cita
    fecha_hora TIMESTAMP NOT NULL,
    duracion_minutos INTEGER DEFAULT 30,
    fecha_hora_fin TIMESTAMP GENERATED ALWAYS AS (fecha_hora + INTERVAL '1 minute' * duracion_minutos) STORED,
    
    -- Detalles de la cita
    tipo_cita VARCHAR(20) NOT NULL CHECK (tipo_cita IN (
        'CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL', 
        'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'
    )),
    especialidad VARCHAR(100),
    motivo TEXT NOT NULL,
    observaciones TEXT,
    
    -- Estado de la cita
    estado VARCHAR(15) DEFAULT 'PROGRAMADA' CHECK (estado IN (
        'PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 
        'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'
    )),
    fecha_confirmacion TIMESTAMP NULL,
    fecha_cancelacion TIMESTAMP NULL,
    motivo_cancelacion TEXT,
    
    -- Información de contacto y recordatorios
    telefono_contacto VARCHAR(20),
    email_contacto VARCHAR(100),
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    fecha_recordatorio TIMESTAMP NULL,
    
    -- Información de la consulta (si se completó)
    historial_clinico_id BIGINT NULL,
    tiempo_espera_minutos INTEGER,
    tiempo_consulta_minutos INTEGER,
    
    -- Información de facturación
    costo_consulta DECIMAL(10,2),
    seguro_medico VARCHAR(100),
    copago DECIMAL(10,2),
    facturado BOOLEAN DEFAULT FALSE,
    
    -- Sala y recursos
    sala_consulta VARCHAR(50),
    equipos_necesarios JSONB,
    preparacion_especial TEXT,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_citas_fecha_hora ON CITAS(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON CITAS(id_paciente);
CREATE INDEX IF NOT EXISTS idx_citas_medico ON CITAS(medico_id);
CREATE INDEX IF NOT EXISTS idx_citas_paciente_fecha ON CITAS(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON CITAS(estado);
CREATE INDEX IF NOT EXISTS idx_citas_tipo ON CITAS(tipo_cita);
CREATE INDEX IF NOT EXISTS idx_citas_numero ON CITAS(numero_cita);
CREATE INDEX IF NOT EXISTS idx_citas_activo ON CITAS(activo);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_creacion ON CITAS(fecha_creacion);

-- =====================================================
-- TABLA: DOCUMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS DOCUMENTOS (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información básica del documento
    nombre_archivo VARCHAR(255) NOT NULL,
    nombre_interno VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(25) NOT NULL CHECK (tipo_documento IN (
        'HISTORIA_CLINICA', 'RECETA_MEDICA', 'ORDEN_EXAMENES', 'RESULTADO_LABORATORIO',
        'IMAGEN_RADIOLOGICA', 'CONSENTIMIENTO', 'FACTURA', 'SEGURO',
        'IDENTIFICACION', 'REFERENCIA', 'INFORME_MEDICO', 'OTRO'
    )),
    
    -- Clasificación y categorización
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    descripcion TEXT,
    palabras_clave JSONB,
    
    -- Relaciones
    id_paciente INTEGER NOT NULL,
    historial_clinico_id BIGINT NULL,
    cita_id INTEGER NULL,
    
    -- Información del archivo
    extension VARCHAR(10) NOT NULL,
    tamaño_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    hash_archivo VARCHAR(64) NOT NULL,
    
    -- Almacenamiento en Cloud Storage
    ruta_storage VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    url_publica VARCHAR(500),
    fecha_expiracion_url TIMESTAMP NULL,
    
    -- Metadatos del documento
    fecha_documento DATE,
    autor_documento VARCHAR(100),
    institucion_origen VARCHAR(100),
    numero_documento VARCHAR(50),
    
    -- Seguridad y acceso
    nivel_confidencialidad VARCHAR(15) DEFAULT 'CONFIDENCIAL' CHECK (nivel_confidencialidad IN (
        'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO'
    )),
    cifrado BOOLEAN DEFAULT TRUE,
    clave_cifrado VARCHAR(255),
    requiere_autorizacion BOOLEAN DEFAULT TRUE,
    
    -- Control de versiones
    version INTEGER DEFAULT 1,
    documento_padre_id BIGINT NULL,
    es_version_actual BOOLEAN DEFAULT TRUE,
    
    -- Estado y procesamiento
    estado_procesamiento VARCHAR(15) DEFAULT 'SUBIENDO' CHECK (estado_procesamiento IN (
        'SUBIENDO', 'PROCESANDO', 'DISPONIBLE', 'ERROR', 'ARCHIVADO'
    )),
    ocr_procesado BOOLEAN DEFAULT FALSE,
    texto_extraido TEXT,
    metadatos_extraidos JSONB,
    
    -- Auditoría de acceso
    total_descargas INTEGER DEFAULT 0,
    ultima_descarga TIMESTAMP NULL,
    ultimo_acceso_usuario INTEGER NULL,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    fecha_eliminacion TIMESTAMP NULL,
    motivo_eliminacion TEXT,
    
    -- Campos de auditoría
    subido_por INTEGER NOT NULL,
    modificado_por INTEGER,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON DOCUMENTOS(id_paciente);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON DOCUMENTOS(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON DOCUMENTOS(categoria);
CREATE INDEX IF NOT EXISTS idx_documentos_historial ON DOCUMENTOS(historial_clinico_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cita ON DOCUMENTOS(cita_id);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha_documento ON DOCUMENTOS(fecha_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha_subida ON DOCUMENTOS(fecha_subida);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON DOCUMENTOS(estado_procesamiento);
CREATE INDEX IF NOT EXISTS idx_documentos_activo ON DOCUMENTOS(activo);
CREATE INDEX IF NOT EXISTS idx_documentos_hash ON DOCUMENTOS(hash_archivo);
CREATE INDEX IF NOT EXISTS idx_documentos_nombre ON DOCUMENTOS(nombre_archivo);
CREATE INDEX IF NOT EXISTS idx_documentos_subido_por ON DOCUMENTOS(subido_por);
CREATE INDEX IF NOT EXISTS idx_documentos_version ON DOCUMENTOS(documento_padre_id, version);

-- =====================================================
-- TABLA: HORARIOS_MEDICOS
-- =====================================================
CREATE TABLE IF NOT EXISTS HORARIOS_MEDICOS (
    id SERIAL PRIMARY KEY,
    
    -- Información del médico
    medico_id INTEGER NOT NULL,
    
    -- Configuración del horario
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_cita_minutos INTEGER DEFAULT 30,
    
    -- Configuración de disponibilidad
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia DATE NULL,
    
    -- Excepciones y pausas
    pausas JSONB,
    observaciones TEXT,
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(medico_id, dia_semana, fecha_inicio_vigencia)
);

-- Índices para HORARIOS_MEDICOS
CREATE INDEX IF NOT EXISTS idx_horarios_medico ON HORARIOS_MEDICOS(medico_id);
CREATE INDEX IF NOT EXISTS idx_horarios_dia ON HORARIOS_MEDICOS(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_vigencia ON HORARIOS_MEDICOS(fecha_inicio_vigencia, fecha_fin_vigencia);
CREATE INDEX IF NOT EXISTS idx_horarios_activo ON HORARIOS_MEDICOS(activo);

-- =====================================================
-- TABLA: EXCEPCIONES_HORARIO
-- =====================================================
CREATE TABLE IF NOT EXISTS EXCEPCIONES_HORARIO (
    id SERIAL PRIMARY KEY,
    
    -- Información del médico
    medico_id INTEGER NOT NULL,
    
    -- Información de la excepción
    fecha DATE NOT NULL,
    tipo_excepcion VARCHAR(15) NOT NULL CHECK (tipo_excepcion IN (
        'NO_DISPONIBLE', 'HORARIO_ESPECIAL', 'VACACIONES', 
        'ENFERMEDAD', 'CONFERENCIA', 'OTRO'
    )),
    motivo TEXT,
    
    -- Horario especial (si aplica)
    hora_inicio_especial TIME NULL,
    hora_fin_especial TIME NULL,
    
    -- Estado
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(medico_id, fecha)
);

-- Índices para EXCEPCIONES_HORARIO
CREATE INDEX IF NOT EXISTS idx_excepciones_medico ON EXCEPCIONES_HORARIO(medico_id);
CREATE INDEX IF NOT EXISTS idx_excepciones_fecha ON EXCEPCIONES_HORARIO(fecha);
CREATE INDEX IF NOT EXISTS idx_excepciones_tipo ON EXCEPCIONES_HORARIO(tipo_excepcion);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- CITAS
ALTER TABLE CITAS 
ADD CONSTRAINT fk_citas_paciente 
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE CITAS 
ADD CONSTRAINT fk_citas_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE CITAS 
ADD CONSTRAINT fk_citas_historial 
FOREIGN KEY (historial_clinico_id) REFERENCES HISTORIAL_CLINICO(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CITAS 
ADD CONSTRAINT fk_citas_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CITAS 
ADD CONSTRAINT fk_citas_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- DOCUMENTOS
ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_paciente 
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_historial 
FOREIGN KEY (historial_clinico_id) REFERENCES HISTORIAL_CLINICO(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_cita 
FOREIGN KEY (cita_id) REFERENCES CITAS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_padre 
FOREIGN KEY (documento_padre_id) REFERENCES DOCUMENTOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_subido_por 
FOREIGN KEY (subido_por) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS 
ADD CONSTRAINT fk_documentos_ultimo_acceso 
FOREIGN KEY (ultimo_acceso_usuario) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- HORARIOS_MEDICOS
ALTER TABLE HORARIOS_MEDICOS 
ADD CONSTRAINT fk_horarios_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE HORARIOS_MEDICOS 
ADD CONSTRAINT fk_horarios_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- EXCEPCIONES_HORARIO
ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE EXCEPCIONES_HORARIO 
ADD CONSTRAINT fk_excepciones_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR fecha_modificacion
-- =====================================================

-- Trigger para CITAS
CREATE TRIGGER tr_citas_update_fecha_modificacion
    BEFORE UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para DOCUMENTOS
CREATE TRIGGER tr_documentos_update_fecha_modificacion
    BEFORE UPDATE ON DOCUMENTOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- =====================================================
-- FUNCIÓN PARA GENERAR NÚMERO DE CITA
-- =====================================================
CREATE OR REPLACE FUNCTION generar_numero_cita()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_cita IS NULL OR NEW.numero_cita = '' THEN
        NEW.numero_cita = 'CITA-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                         LPAD(NEXTVAL('citas_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de cita automáticamente
CREATE TRIGGER tr_generar_numero_cita
    BEFORE INSERT ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION generar_numero_cita();

-- =====================================================
-- FUNCIÓN PARA VALIDAR CONFLICTOS DE CITAS
-- =====================================================
CREATE OR REPLACE FUNCTION validar_conflicto_citas()
RETURNS TRIGGER AS $$
DECLARE
    conflictos INTEGER;
BEGIN
    -- Verificar conflictos con otras citas del mismo médico
    SELECT COUNT(*)
    INTO conflictos
    FROM CITAS
    WHERE medico_id = NEW.medico_id
    AND activo = TRUE
    AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
    AND id != COALESCE(NEW.id, 0)
    AND (
        (NEW.fecha_hora BETWEEN fecha_hora AND fecha_hora_fin) OR
        (NEW.fecha_hora + INTERVAL '1 minute' * NEW.duracion_minutos BETWEEN fecha_hora AND fecha_hora_fin) OR
        (fecha_hora BETWEEN NEW.fecha_hora AND NEW.fecha_hora + INTERVAL '1 minute' * NEW.duracion_minutos)
    );
    
    IF conflictos > 0 THEN
        RAISE EXCEPTION 'Conflicto de horario: El médico ya tiene una cita programada en ese horario';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar conflictos de citas
CREATE TRIGGER tr_validar_conflicto_citas
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION validar_conflicto_citas();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de citas con información completa
CREATE OR REPLACE VIEW v_citas_completas AS
SELECT 
    c.id,
    c.numero_cita,
    c.fecha_hora,
    c.duracion_minutos,
    c.tipo_cita,
    c.estado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    c.motivo,
    c.observaciones,
    c.sala_consulta,
    c.costo_consulta,
    c.fecha_creacion
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id
WHERE c.activo = TRUE AND p.activo = TRUE;

-- Vista de documentos con información del paciente
CREATE OR REPLACE VIEW v_documentos_pacientes AS
SELECT 
    d.id,
    d.nombre_archivo,
    d.tipo_documento,
    d.categoria,
    d.descripcion,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    d.fecha_documento,
    d.fecha_subida,
    d.tamaño_bytes,
    d.estado_procesamiento,
    CONCAT(u.nombres, ' ', u.apellidos) as subido_por_nombre,
    d.total_descargas,
    d.activo
FROM DOCUMENTOS d
JOIN PACIENTES p ON d.id_paciente = p.id
JOIN USUARIOS u ON d.subido_por = u.id
WHERE d.activo = TRUE AND p.activo = TRUE;

-- Vista de disponibilidad de médicos
CREATE OR REPLACE VIEW v_disponibilidad_medicos AS
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
    h.fecha_fin_vigencia
FROM USUARIOS u
JOIN HORARIOS_MEDICOS h ON u.id = h.medico_id
WHERE u.activo = TRUE AND h.activo = TRUE
  AND (h.fecha_fin_vigencia IS NULL OR h.fecha_fin_vigencia >= CURRENT_DATE);

-- Vista de agenda diaria de médicos
CREATE OR REPLACE VIEW v_agenda_medicos AS
SELECT 
    c.medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    DATE(c.fecha_hora) as fecha,
    c.id as cita_id,
    c.numero_cita,
    c.fecha_hora,
    c.duracion_minutos,
    c.tipo_cita,
    c.estado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    c.motivo,
    c.sala_consulta
FROM CITAS c
JOIN USUARIOS u ON c.medico_id = u.id
JOIN PACIENTES p ON c.id_paciente = p.id
WHERE c.activo = TRUE 
  AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
  AND DATE(c.fecha_hora) >= CURRENT_DATE
ORDER BY c.medico_id, c.fecha_hora;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa:

1. TABLA CITAS:
   - Gestión completa de citas médicas
   - Índice requerido: fecha_hora ✓
   - Relación con PACIENTES y USUARIOS ✓
   - Soft delete con campo 'activo' ✓
   - Estados completos del ciclo de vida de citas
   - Información de facturación y seguimiento
   - Validación automática de conflictos de horario
   - Generación automática de números de cita

2. TABLA DOCUMENTOS:
   - Gestión de documentos médicos con Cloud Storage
   - Cifrado y seguridad de archivos
   - Control de versiones
   - OCR y extracción de texto
   - Auditoría completa de accesos
   - Soft delete con campo 'activo' ✓

3. TABLAS AUXILIARES:
   - HORARIOS_MEDICOS: Gestión de horarios de atención
   - EXCEPCIONES_HORARIO: Manejo de excepciones y vacaciones

4. ÍNDICES REQUERIDOS:
   - CITAS.fecha_hora ✓
   - Índices adicionales para rendimiento óptimo

5. RELACIONES:
   - PACIENTES ↔ CITAS ✓
   - USUARIOS ↔ CITAS ✓
   - PACIENTES ↔ DOCUMENTOS ✓
   - HISTORIAL_CLINICO ↔ DOCUMENTOS ✓

6. FUNCIONALIDADES ADICIONALES:
   - Validación automática de conflictos de citas
   - Generación automática de números de cita
   - Vistas útiles para consultas frecuentes
   - Triggers para mantener datos actualizados

7. SEGURIDAD:
   - Campos preparados para encriptación at rest
   - Control de acceso por niveles de confidencialidad
   - Hash de integridad para archivos
*/