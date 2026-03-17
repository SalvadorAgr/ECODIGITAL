-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Pacientes y Historial Clínico - PostgreSQL
-- Descripción: Gestión de pacientes e historiales médicos
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: PACIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS PACIENTES (
    id SERIAL PRIMARY KEY,
    
    -- Información personal (ENCRYPTED AT REST)
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    genero CHAR(1) NOT NULL CHECK (genero IN ('M', 'F', 'O')),
    telefono VARCHAR(20),
    email VARCHAR(100),
    
    -- Dirección
    direccion TEXT,
    ciudad VARCHAR(100),
    provincia VARCHAR(100),
    codigo_postal VARCHAR(10),
    pais VARCHAR(50) DEFAULT 'República Dominicana',
    
    -- Información médica básica
    tipo_sangre VARCHAR(3) CHECK (tipo_sangre IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    alergias TEXT,
    medicamentos_actuales TEXT,
    condiciones_medicas TEXT,
    
    -- Contacto de emergencia
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_telefono VARCHAR(20),
    contacto_emergencia_relacion VARCHAR(50),
    
    -- Información administrativa
    numero_expediente VARCHAR(50) UNIQUE,
    seguro_medico VARCHAR(100),
    numero_poliza VARCHAR(50),
    fecha_primera_consulta TIMESTAMP NULL,
    fecha_ultima_consulta TIMESTAMP NULL,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    notas_administrativas TEXT,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento y búsqueda
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON PACIENTES(nombre);
CREATE INDEX IF NOT EXISTS idx_pacientes_apellido ON PACIENTES(apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_cedula ON PACIENTES(cedula);
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_consulta ON PACIENTES(fecha_primera_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_ultima_consulta ON PACIENTES(fecha_ultima_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_activo ON PACIENTES(activo);
CREATE INDEX IF NOT EXISTS idx_pacientes_expediente ON PACIENTES(numero_expediente);
CREATE INDEX IF NOT EXISTS idx_pacientes_creado_por ON PACIENTES(creado_por);

-- =====================================================
-- TABLA: HISTORIAL_CLINICO
-- =====================================================
CREATE TABLE IF NOT EXISTS HISTORIAL_CLINICO (
    id BIGSERIAL PRIMARY KEY,
    
    -- Relación con paciente
    id_paciente INTEGER NOT NULL,
    
    -- Información de la consulta
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_consulta VARCHAR(20) NOT NULL CHECK (tipo_consulta IN (
        'PRIMERA_VEZ', 'SEGUIMIENTO', 'URGENCIA', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO'
    )),
    motivo_consulta TEXT NOT NULL,
    
    -- Examen físico
    signos_vitales JSONB,
    peso DECIMAL(5,2),
    altura DECIMAL(5,2),
    imc DECIMAL(4,2),
    
    -- Evaluación médica
    sintomas TEXT,
    examen_fisico TEXT,
    diagnostico_principal TEXT NOT NULL,
    diagnosticos_secundarios TEXT,
    codigo_cie10 VARCHAR(10),
    
    -- Tratamiento
    plan_tratamiento TEXT,
    medicamentos_prescritos JSONB,
    examenes_solicitados TEXT,
    procedimientos_realizados TEXT,
    
    -- Seguimiento
    recomendaciones TEXT,
    proxima_cita DATE,
    observaciones TEXT,
    
    -- Información del médico
    medico_id INTEGER NOT NULL,
    especialidad_consulta VARCHAR(100),
    
    -- Archivos adjuntos
    imagenes_adjuntas JSONB,
    documentos_adjuntos JSONB,
    
    -- Estado y seguimiento
    estado_consulta VARCHAR(15) DEFAULT 'COMPLETADA' CHECK (estado_consulta IN (
        'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'
    )),
    requiere_seguimiento BOOLEAN DEFAULT FALSE,
    urgente BOOLEAN DEFAULT FALSE,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_historial_paciente ON HISTORIAL_CLINICO(id_paciente);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_hora ON HISTORIAL_CLINICO(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_medico ON HISTORIAL_CLINICO(medico_id);
CREATE INDEX IF NOT EXISTS idx_historial_tipo_consulta ON HISTORIAL_CLINICO(tipo_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_estado ON HISTORIAL_CLINICO(estado_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_activo ON HISTORIAL_CLINICO(activo);
CREATE INDEX IF NOT EXISTS idx_historial_urgente ON HISTORIAL_CLINICO(urgente);
CREATE INDEX IF NOT EXISTS idx_historial_seguimiento ON HISTORIAL_CLINICO(requiere_seguimiento);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- PACIENTES
ALTER TABLE PACIENTES 
ADD CONSTRAINT fk_pacientes_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE PACIENTES 
ADD CONSTRAINT fk_pacientes_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- HISTORIAL_CLINICO
ALTER TABLE HISTORIAL_CLINICO 
ADD CONSTRAINT fk_historial_paciente 
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO 
ADD CONSTRAINT fk_historial_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO 
ADD CONSTRAINT fk_historial_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO 
ADD CONSTRAINT fk_historial_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR fecha_modificacion
-- =====================================================

-- Trigger para PACIENTES
CREATE TRIGGER tr_pacientes_update_fecha_modificacion
    BEFORE UPDATE ON PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para HISTORIAL_CLINICO
CREATE TRIGGER tr_historial_update_fecha_modificacion
    BEFORE UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- =====================================================
-- FUNCIÓN PARA CALCULAR IMC
-- =====================================================
CREATE OR REPLACE FUNCTION calcular_imc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.peso IS NOT NULL AND NEW.altura IS NOT NULL AND NEW.altura > 0 THEN
        NEW.imc = NEW.peso / POWER(NEW.altura / 100, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular IMC automáticamente
CREATE TRIGGER tr_historial_calcular_imc
    BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION calcular_imc();

-- =====================================================
-- FUNCIÓN PARA ACTUALIZAR FECHAS DE CONSULTA EN PACIENTES
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_fechas_consulta_paciente()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar fecha_primera_consulta si es NULL
    UPDATE PACIENTES 
    SET fecha_primera_consulta = NEW.fecha_hora
    WHERE id = NEW.id_paciente 
    AND fecha_primera_consulta IS NULL;
    
    -- Actualizar fecha_ultima_consulta
    UPDATE PACIENTES 
    SET fecha_ultima_consulta = NEW.fecha_hora
    WHERE id = NEW.id_paciente 
    AND (fecha_ultima_consulta IS NULL OR fecha_ultima_consulta < NEW.fecha_hora);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar fechas de consulta
CREATE TRIGGER tr_actualizar_fechas_consulta
    AFTER INSERT ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fechas_consulta_paciente();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista completa de pacientes con información resumida
CREATE OR REPLACE VIEW v_pacientes_resumen AS
SELECT 
    p.id,
    p.numero_expediente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_completo,
    p.cedula,
    p.fecha_nacimiento,
    EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad,
    p.genero,
    p.telefono,
    p.email,
    p.fecha_primera_consulta,
    p.fecha_ultima_consulta,
    (SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = p.id AND h.activo = TRUE) as total_consultas,
    p.activo,
    p.fecha_creacion
FROM PACIENTES p
WHERE p.activo = TRUE;

-- Vista de historial clínico con información del paciente y médico
CREATE OR REPLACE VIEW v_historial_completo AS
SELECT 
    h.id,
    h.id_paciente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    h.fecha_hora,
    h.tipo_consulta,
    h.motivo_consulta,
    h.diagnostico_principal,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    h.estado_consulta,
    h.requiere_seguimiento,
    h.urgente,
    h.proxima_cita,
    h.fecha_creacion
FROM HISTORIAL_CLINICO h
JOIN PACIENTES p ON h.id_paciente = p.id
JOIN USUARIOS u ON h.medico_id = u.id
WHERE h.activo = TRUE AND p.activo = TRUE;

-- Vista de pacientes con estadísticas médicas
CREATE OR REPLACE VIEW v_pacientes_estadisticas AS
SELECT 
    p.id,
    p.numero_expediente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_completo,
    p.fecha_nacimiento,
    EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad,
    p.genero,
    p.tipo_sangre,
    p.fecha_primera_consulta,
    p.fecha_ultima_consulta,
    COUNT(h.id) as total_consultas,
    COUNT(CASE WHEN h.urgente = TRUE THEN 1 END) as consultas_urgentes,
    COUNT(CASE WHEN h.requiere_seguimiento = TRUE THEN 1 END) as consultas_seguimiento,
    MAX(h.fecha_hora) as ultima_consulta_fecha,
    COUNT(DISTINCT h.medico_id) as medicos_diferentes
FROM PACIENTES p
LEFT JOIN HISTORIAL_CLINICO h ON p.id = h.id_paciente AND h.activo = TRUE
WHERE p.activo = TRUE
GROUP BY p.id, p.numero_expediente, p.nombre, p.apellido, p.fecha_nacimiento, 
         p.genero, p.tipo_sangre, p.fecha_primera_consulta, p.fecha_ultima_consulta;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa:

1. TABLA PACIENTES:
   - Información personal completa con campos para encriptación
   - Información médica básica y contactos de emergencia
   - Soft delete con campo 'activo'
   - Índices optimizados para búsquedas por nombre, apellido, cédula
   - Auditoría completa de cambios

2. TABLA HISTORIAL_CLINICO:
   - Relación con pacientes mediante clave foránea
   - Información completa de consultas médicas
   - Soporte para JSONB en campos complejos (signos vitales, medicamentos)
   - Índices optimizados para consultas por paciente y fecha
   - Soft delete y auditoría completa
   - Cálculo automático de IMC
   - Actualización automática de fechas de consulta en pacientes

3. ÍNDICES REQUERIDOS:
   - PACIENTES: nombre, apellido, fecha_consulta ✓
   - HISTORIAL_CLINICO: id_paciente, fecha_hora ✓

4. RELACIONES:
   - PACIENTES ↔ HISTORIAL_CLINICO (id_paciente) ✓
   - USUARIOS ↔ HISTORIAL_CLINICO (medico_id) ✓

5. SOFT DELETE:
   - PACIENTES.activo ✓
   - HISTORIAL_CLINICO.activo ✓

6. FUNCIONALIDADES ADICIONALES:
   - Triggers para mantener fechas actualizadas
   - Cálculo automático de IMC
   - Vistas con estadísticas útiles
   - Preparado para encriptación at rest
*/