-- ============================================================================
-- MIGRACIÓN: 02_pacientes_y_historial_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Pacientes, historial clínico y datos médicos
-- FECHA: Marzo 2026
-- ============================================================================
-- ESTÁNDARES APLICADOS:
-- 1. Seguridad y Atomicidad: Transacciones explícitas con ROLLBACK automático
-- 2. Idempotencia: Uso de IF NOT EXISTS / IF EXISTS
-- 3. Gestión de Dependencias: Orden correcto de creación/eliminación
-- 4. Preservación de Datos: Lógica de respaldo cuando aplica
-- 5. Reversibilidad: Script DOWN incluido al final
-- ============================================================================
-- DEPENDENCIAS:
-- - Requiere: 01_usuarios_y_roles_postgresql.sql (tabla USUARIOS)
-- ============================================================================

-- ============================================================================
-- SECCIÓN UP: Creación de objetos
-- ============================================================================

BEGIN;

-- Verificar que las tablas dependientes existan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'usuarios' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla USUARIOS no existe. Ejecute primero 01_usuarios_y_roles_postgresql.sql';
    END IF;
END $$;

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para género
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'genero_type') THEN
        CREATE DOMAIN genero_type AS VARCHAR(15)
        CHECK (VALUE IN ('MASCULINO', 'FEMENINO', 'OTRO', 'PREFERIRIA_NO_DECIR'));
    END IF;
END $$;

-- Dominio para tipo de sangre
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_sangre_type') THEN
        CREATE DOMAIN tipo_sangre_type AS VARCHAR(5)
        CHECK (VALUE IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'DESCONOCIDO'));
    END IF;
END $$;

-- Dominio para estado civil
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_civil_type') THEN
        CREATE DOMAIN estado_civil_type AS VARCHAR(20)
        CHECK (VALUE IN ('SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'UNION_LIBRE', 'OTRO'));
    END IF;
END $$;

-- Dominio para tipo de consulta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_consulta_type') THEN
        CREATE DOMAIN tipo_consulta_type AS VARCHAR(30)
        CHECK (VALUE IN ('CONSULTA_GENERAL', 'CONSULTA_PROGRAMADA', 'URGENCIA', 'SEGUIMIENTO', 'INTERCONSULTA', 'PROCEDIMIENTO'));
    END IF;
END $$;

-- Dominio para estado de consulta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_consulta_type') THEN
        CREATE DOMAIN estado_consulta_type AS VARCHAR(20)
        CHECK (VALUE IN ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'));
    END IF;
END $$;

-- Dominio para prioridad
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridad_type') THEN
        CREATE DOMAIN prioridad_type AS VARCHAR(10)
        CHECK (VALUE IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: PACIENTES
-- Descripción: Información de pacientes del sistema médico
-- ============================================================================

CREATE TABLE IF NOT EXISTS PACIENTES (
    id SERIAL PRIMARY KEY,
    numero_expediente VARCHAR(20) UNIQUE NOT NULL,
    
    -- Información personal
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    genero genero_type,
    estado_civil estado_civil_type,
    
    -- Información de contacto
    telefono VARCHAR(30),
    telefono_emergencia VARCHAR(30),
    email VARCHAR(100),
    direccion TEXT,
    ciudad VARCHAR(100),
    estado_provincia VARCHAR(100),
    codigo_postal VARCHAR(10),
    pais VARCHAR(50) DEFAULT 'México',
    
    -- Información médica básica
    tipo_sangre tipo_sangre_type DEFAULT 'DESCONOCIDO',
    alergias JSONB DEFAULT '[]',
    medicamentos_actuales JSONB DEFAULT '[]',
    condiciones_cronicas JSONB DEFAULT '[]',
    
    -- Información de contacto de emergencia
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_parentesco VARCHAR(50),
    contacto_emergencia_telefono VARCHAR(30),
    
    -- Información de seguro médico
    seguro_medico VARCHAR(100),
    numero_poliza VARCHAR(50),
    vigencia_seguro DATE,
    
    -- Control de consultas
    fecha_primera_consulta TIMESTAMP WITH TIME ZONE,
    fecha_ultima_consulta TIMESTAMP WITH TIME ZONE,
    total_consultas INTEGER DEFAULT 0,
    
    -- Estado del paciente
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_pacientes_nombre CHECK (LENGTH(TRIM(nombre)) >= 2),
    CONSTRAINT chk_pacientes_apellido CHECK (LENGTH(TRIM(apellido)) >= 2),
    CONSTRAINT chk_pacientes_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_pacientes_fecha_nacimiento CHECK (fecha_nacimiento <= CURRENT_DATE)
);

-- Comentarios descriptivos
COMMENT ON TABLE PACIENTES IS 'Información de pacientes del sistema médico';
COMMENT ON COLUMN PACIENTES.numero_expediente IS 'Número único de expediente médico';
COMMENT ON COLUMN PACIENTES.alergias IS 'JSONB con array de alergias del paciente';
COMMENT ON COLUMN PACIENTES.medicamentos_actuales IS 'JSONB con array de medicamentos actuales';
COMMENT ON COLUMN PACIENTES.condiciones_cronicas IS 'JSONB con array de condiciones crónicas';

-- ============================================================================
-- TABLA: HISTORIAL_CLINICO
-- Descripción: Historial clínico de consultas médicas
-- ============================================================================

CREATE TABLE IF NOT EXISTS HISTORIAL_CLINICO (
    id BIGSERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,
    
    -- Información de la consulta
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_consulta tipo_consulta_type NOT NULL DEFAULT 'CONSULTA_GENERAL',
    estado_consulta estado_consulta_type NOT NULL DEFAULT 'PROGRAMADA',
    
    -- Motivo y diagnóstico
    motivo_consulta TEXT NOT NULL,
    sintomas TEXT,
    diagnostico_principal TEXT,
    diagnosticos_secundarios JSONB DEFAULT '[]',
    cie10_codigo VARCHAR(10),
    
    -- Signos vitales (JSONB estructurado)
    signos_vitales JSONB DEFAULT '{}',
    
    -- Datos antropométricos
    peso DECIMAL(5,2),
    altura DECIMAL(5,2),
    imc DECIMAL(5,2),
    perimetro_abdominal DECIMAL(5,2),
    
    -- Tratamiento
    medicamentos_recetados JSONB DEFAULT '[]',
    indicaciones TEXT,
    procedimientos_realizados JSONB DEFAULT '[]',
    
    -- Seguimiento
    requiere_seguimiento BOOLEAN NOT NULL DEFAULT FALSE,
    proxima_cita DATE,
    notas_seguimiento TEXT,
    
    -- Urgencia
    urgente BOOLEAN NOT NULL DEFAULT FALSE,
    prioridad prioridad_type DEFAULT 'MEDIA',
    
    -- Referencias
    referido_a INTEGER,
    motivo_referencia TEXT,
    
    -- Estado del registro
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_historial_paciente FOREIGN KEY (id_paciente) 
        REFERENCES PACIENTES(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_medico FOREIGN KEY (medico_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE RESTRICT,
    CONSTRAINT chk_historial_peso CHECK (peso IS NULL OR (peso > 0 AND peso < 1000)),
    CONSTRAINT chk_historial_altura CHECK (altura IS NULL OR (altura > 0 AND altura < 300)),
    CONSTRAINT chk_historial_imc CHECK (imc IS NULL OR (imc > 0 AND imc < 100))
);

-- Comentarios descriptivos
COMMENT ON TABLE HISTORIAL_CLINICO IS 'Historial clínico de consultas médicas';
COMMENT ON COLUMN HISTORIAL_CLINICO.signos_vitales IS 'JSONB con signos vitales: presion_arterial, frecuencia_cardiaca, temperatura, etc.';
COMMENT ON COLUMN HISTORIAL_CLINICO.medicamentos_recetados IS 'JSONB con array de medicamentos recetados';
COMMENT ON COLUMN HISTORIAL_CLINICO.diagnosticos_secundarios IS 'JSONB con array de diagnósticos secundarios';
COMMENT ON COLUMN HISTORIAL_CLINICO.procedimientos_realizados IS 'JSONB con array de procedimientos realizados';

-- ============================================================================
-- TABLA: ANTECEDENTES_MEDICOS
-- Descripción: Antecedentes médicos del paciente
-- ============================================================================

CREATE TABLE IF NOT EXISTS ANTECEDENTES_MEDICOS (
    id SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL,
    
    -- Tipo de antecedente
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('PERSONAL', 'FAMILIAR', 'QUIRURGICO', 'GINECO_OBSTETRICO', 'TRAUMATICO', 'ALERGICO')),
    categoria VARCHAR(50) NOT NULL,
    
    -- Detalles del antecedente
    descripcion TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    activo_actualmente BOOLEAN DEFAULT FALSE,
    
    -- Información adicional
    medico_diagnostico VARCHAR(100),
    institucion VARCHAR(100),
    notas TEXT,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_antecedentes_paciente FOREIGN KEY (id_paciente) 
        REFERENCES PACIENTES(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE ANTECEDENTES_MEDICOS IS 'Antecedentes médicos personales y familiares del paciente';

-- ============================================================================
-- TABLA: VACUNAS_PACIENTE
-- Descripción: Registro de vacunas del paciente
-- ============================================================================

CREATE TABLE IF NOT EXISTS VACUNAS_PACIENTE (
    id SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL,
    
    -- Información de la vacuna
    nombre_vacuna VARCHAR(100) NOT NULL,
    lote VARCHAR(50),
    laboratorio VARCHAR(100),
    
    -- Fechas
    fecha_aplicacion DATE NOT NULL,
    fecha_proxima_dosis DATE,
    dosis VARCHAR(20),
    numero_dosis INTEGER DEFAULT 1,
    
    -- Lugar de aplicación
    lugar_aplicacion VARCHAR(100),
    aplicado_por VARCHAR(100),
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vacunas_paciente FOREIGN KEY (id_paciente) 
        REFERENCES PACIENTES(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE VACUNAS_PACIENTE IS 'Registro de vacunas aplicadas al paciente';

-- ============================================================================
-- TABLA: ARCHIVOS_ADJUNTOS
-- Descripción: Archivos adjuntos al historial clínico
-- ============================================================================

CREATE TABLE IF NOT EXISTS ARCHIVOS_ADJUNTOS (
    id SERIAL PRIMARY KEY,
    historial_id BIGINT NOT NULL,
    
    -- Información del archivo
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    hash_archivo VARCHAR(64),
    
    -- Metadatos
    descripcion TEXT,
    categoria VARCHAR(50) CHECK (categoria IN ('IMAGEN', 'DOCUMENTO', 'VIDEO', 'AUDIO', 'OTRO')),
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_archivos_historial FOREIGN KEY (historial_id) 
        REFERENCES HISTORIAL_CLINICO(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT chk_archivos_tamano CHECK (tamano_bytes > 0)
);

-- Comentarios descriptivos
COMMENT ON TABLE ARCHIVOS_ADJUNTOS IS 'Archivos adjuntos al historial clínico (imágenes, documentos, etc.)';

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para calcular IMC automáticamente
CREATE OR REPLACE FUNCTION calcular_imc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.peso IS NOT NULL AND NEW.altura IS NOT NULL AND NEW.altura > 0 THEN
        NEW.imc = ROUND((NEW.peso / POWER(NEW.altura / 100, 2))::NUMERIC, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_imc() IS 'Función trigger para calcular automáticamente el IMC';

-- Función para actualizar fechas de consulta en paciente
CREATE OR REPLACE FUNCTION actualizar_fechas_consulta_paciente()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar fecha de primera consulta si es la primera
    UPDATE PACIENTES
    SET fecha_primera_consulta = 
        CASE 
            WHEN fecha_primera_consulta IS NULL THEN NEW.fecha_hora
            ELSE fecha_primera_consulta
        END,
        fecha_ultima_consulta = GREATEST(fecha_ultima_consulta, NEW.fecha_hora),
        total_consultas = total_consultas + 1,
        fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id = NEW.id_paciente;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actualizar_fechas_consulta_paciente() IS 'Función trigger para actualizar fechas de consulta del paciente';

-- Función para generar número de expediente
CREATE OR REPLACE FUNCTION generar_numero_expediente()
RETURNS VARCHAR AS $$
DECLARE
    v_numero_expediente VARCHAR(20);
    v_anio INTEGER;
    v_consecutivo INTEGER;
BEGIN
    v_anio := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Obtener el siguiente consecutivo
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_expediente FROM 9 FOR 6) AS INTEGER)), 0) + 1
    INTO v_consecutivo
    FROM PACIENTES
    WHERE numero_expediente LIKE 'EXP' || v_anio || '%';
    
    -- Generar el número de expediente
    v_numero_expediente := 'EXP' || v_anio || LPAD(v_consecutivo::TEXT, 6, '0');
    
    RETURN v_numero_expediente;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_numero_expediente() IS 'Función para generar número de expediente único';

-- Función para generar número de expediente (trigger)
CREATE OR REPLACE FUNCTION tr_generar_numero_expediente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_expediente IS NULL OR NEW.numero_expediente = '' THEN
        NEW.numero_expediente := generar_numero_expediente();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION tr_generar_numero_expediente() IS 'Función trigger para generar número de expediente automáticamente';

-- Función para validar signos vitales
CREATE OR REPLACE FUNCTION validar_signos_vitales()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que los signos vitales tengan estructura correcta
    IF NEW.signos_vitales IS NOT NULL AND jsonb_typeof(NEW.signos_vitales) = 'object' THEN
        -- Verificar presion_arterial si existe
        IF NEW.signos_vitales ? 'presion_arterial' THEN
            IF NOT (NEW.signos_vitales->'presion_arterial' ? 'sistolica' AND NEW.signos_vitales->'presion_arterial' ? 'diastolica') THEN
                RAISE EXCEPTION 'Signos vitales: presion_arterial debe tener sistolica y diastolica';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_signos_vitales() IS 'Función trigger para validar estructura de signos vitales';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha_modificacion en PACIENTES
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_pacientes_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_pacientes_update_fecha_modificacion
            BEFORE UPDATE ON PACIENTES
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para generar número de expediente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_pacientes_generar_expediente'
    ) THEN
        CREATE TRIGGER tr_pacientes_generar_expediente
            BEFORE INSERT ON PACIENTES
            FOR EACH ROW
            EXECUTE FUNCTION tr_generar_numero_expediente();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en HISTORIAL_CLINICO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_historial_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_historial_update_fecha_modificacion
            BEFORE UPDATE ON HISTORIAL_CLINICO
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para calcular IMC
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_historial_calcular_imc'
    ) THEN
        CREATE TRIGGER tr_historial_calcular_imc
            BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
            FOR EACH ROW
            EXECUTE FUNCTION calcular_imc();
    END IF;
END $$;

-- Trigger para actualizar fechas de consulta en paciente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_actualizar_fechas_consulta'
    ) THEN
        CREATE TRIGGER tr_actualizar_fechas_consulta
            AFTER INSERT ON HISTORIAL_CLINICO
            FOR EACH ROW
            EXECUTE FUNCTION actualizar_fechas_consulta_paciente();
    END IF;
END $$;

-- Trigger para validar signos vitales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_historial_validar_signos'
    ) THEN
        CREATE TRIGGER tr_historial_validar_signos
            BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
            FOR EACH ROW
            EXECUTE FUNCTION validar_signos_vitales();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en ANTECEDENTES_MEDICOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_antecedentes_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_antecedentes_update_fecha_modificacion
            BEFORE UPDATE ON ANTECEDENTES_MEDICOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en VACUNAS_PACIENTE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_vacunas_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_vacunas_update_fecha_modificacion
            BEFORE UPDATE ON VACUNAS_PACIENTE
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en ARCHIVOS_ADJUNTOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_archivos_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_archivos_update_fecha_modificacion
            BEFORE UPDATE ON ARCHIVOS_ADJUNTOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para PACIENTES
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON PACIENTES(nombre);
CREATE INDEX IF NOT EXISTS idx_pacientes_apellido ON PACIENTES(apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_cedula ON PACIENTES(cedula);
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_consulta ON PACIENTES(fecha_primera_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_ultima_consulta ON PACIENTES(fecha_ultima_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_activo ON PACIENTES(activo);
CREATE INDEX IF NOT EXISTS idx_pacientes_expediente ON PACIENTES(numero_expediente);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono ON PACIENTES(telefono);
CREATE INDEX IF NOT EXISTS idx_pacientes_email ON PACIENTES(email);
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_nacimiento ON PACIENTES(fecha_nacimiento);

-- Índices para HISTORIAL_CLINICO
CREATE INDEX IF NOT EXISTS idx_historial_paciente ON HISTORIAL_CLINICO(id_paciente);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_hora ON HISTORIAL_CLINICO(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_medico ON HISTORIAL_CLINICO(medico_id);
CREATE INDEX IF NOT EXISTS idx_historial_tipo_consulta ON HISTORIAL_CLINICO(tipo_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_estado ON HISTORIAL_CLINICO(estado_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_activo ON HISTORIAL_CLINICO(activo);
CREATE INDEX IF NOT EXISTS idx_historial_urgente ON HISTORIAL_CLINICO(urgente);
CREATE INDEX IF NOT EXISTS idx_historial_seguimiento ON HISTORIAL_CLINICO(requiere_seguimiento);
CREATE INDEX IF NOT EXISTS idx_historial_cie10 ON HISTORIAL_CLINICO(cie10_codigo);
CREATE INDEX IF NOT EXISTS idx_historial_prioridad ON HISTORIAL_CLINICO(prioridad);

-- Índices para ANTECEDENTES_MEDICOS
CREATE INDEX IF NOT EXISTS idx_antecedentes_paciente ON ANTECEDENTES_MEDICOS(id_paciente);
CREATE INDEX IF NOT EXISTS idx_antecedentes_tipo ON ANTECEDENTES_MEDICOS(tipo);
CREATE INDEX IF NOT EXISTS idx_antecedentes_categoria ON ANTECEDENTES_MEDICOS(categoria);
CREATE INDEX IF NOT EXISTS idx_antecedentes_activo ON ANTECEDENTES_MEDICOS(activo);

-- Índices para VACUNAS_PACIENTE
CREATE INDEX IF NOT EXISTS idx_vacunas_paciente ON VACUNAS_PACIENTE(id_paciente);
CREATE INDEX IF NOT EXISTS idx_vacunas_nombre ON VACUNAS_PACIENTE(nombre_vacuna);
CREATE INDEX IF NOT EXISTS idx_vacunas_fecha ON VACUNAS_PACIENTE(fecha_aplicacion);
CREATE INDEX IF NOT EXISTS idx_vacunas_activo ON VACUNAS_PACIENTE(activo);

-- Índices para ARCHIVOS_ADJUNTOS
CREATE INDEX IF NOT EXISTS idx_archivos_historial ON ARCHIVOS_ADJUNTOS(historial_id);
CREATE INDEX IF NOT EXISTS idx_archivos_tipo ON ARCHIVOS_ADJUNTOS(tipo_archivo);
CREATE INDEX IF NOT EXISTS idx_archivos_categoria ON ARCHIVOS_ADJUNTOS(categoria);
CREATE INDEX IF NOT EXISTS idx_archivos_activo ON ARCHIVOS_ADJUNTOS(activo);

-- Índices GIN para JSONB
CREATE INDEX IF NOT EXISTS idx_pacientes_alergias ON PACIENTES USING GIN (alergias);
CREATE INDEX IF NOT EXISTS idx_pacientes_medicamentos ON PACIENTES USING GIN (medicamentos_actuales);
CREATE INDEX IF NOT EXISTS idx_historial_signos ON HISTORIAL_CLINICO USING GIN (signos_vitales);
CREATE INDEX IF NOT EXISTS idx_historial_medicamentos ON HISTORIAL_CLINICO USING GIN (medicamentos_recetados);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de pacientes resumen
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
    p.tipo_sangre,
    p.fecha_primera_consulta,
    p.fecha_ultima_consulta,
    (SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = p.id AND h.activo = TRUE) as total_consultas,
    p.activo,
    p.fecha_creacion
FROM PACIENTES p
WHERE p.activo = TRUE;

COMMENT ON VIEW v_pacientes_resumen IS 'Vista resumida de pacientes activos';

-- Vista de historial completo
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
    h.cie10_codigo,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    h.estado_consulta,
    h.requiere_seguimiento,
    h.urgente,
    h.prioridad,
    h.proxima_cita,
    h.fecha_creacion
FROM HISTORIAL_CLINICO h
JOIN PACIENTES p ON h.id_paciente = p.id
JOIN USUARIOS u ON h.medico_id = u.id
WHERE h.activo = TRUE AND p.activo = TRUE;

COMMENT ON VIEW v_historial_completo IS 'Vista completa del historial clínico con información de paciente y médico';

-- Vista de signos vitales
CREATE OR REPLACE VIEW v_signos_vitales AS
SELECT
    h.id as historial_id,
    h.id_paciente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    h.fecha_hora,
    h.signos_vitales->>'presion_arterial'->>'sistolica' as presion_sistolica,
    h.signos_vitales->>'presion_arterial'->>'diastolica' as presion_diastolica,
    h.signos_vitales->>'frecuencia_cardiaca'->>'valor' as frecuencia_cardiaca,
    h.signos_vitales->>'temperatura'->>'valor' as temperatura,
    h.signos_vitales->>'saturacion_oxigeno'->>'valor' as saturacion_oxigeno,
    h.peso,
    h.altura,
    h.imc,
    h.perimetro_abdominal
FROM HISTORIAL_CLINICO h
JOIN PACIENTES p ON h.id_paciente = p.id
WHERE h.activo = TRUE;

COMMENT ON VIEW v_signos_vitales IS 'Vista de signos vitales extraídos del historial clínico';

-- Vista de antecedentes por paciente
CREATE OR REPLACE VIEW v_antecedentes_paciente AS
SELECT
    a.id,
    a.id_paciente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    a.tipo,
    a.categoria,
    a.descripcion,
    a.fecha_inicio,
    a.fecha_fin,
    a.activo_actualmente,
    a.medico_diagnostico,
    a.institucion
FROM ANTECEDENTES_MEDICOS a
JOIN PACIENTES p ON a.id_paciente = p.id
WHERE a.activo = TRUE AND p.activo = TRUE
ORDER BY a.tipo, a.categoria;

COMMENT ON VIEW v_antecedentes_paciente IS 'Vista de antecedentes médicos por paciente';

-- Vista de vacunas por paciente
CREATE OR REPLACE VIEW v_vacunas_paciente AS
SELECT
    v.id,
    v.id_paciente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    v.nombre_vacuna,
    v.lote,
    v.laboratorio,
    v.fecha_aplicacion,
    v.fecha_proxima_dosis,
    v.dosis,
    v.numero_dosis,
    v.lugar_aplicacion,
    v.aplicado_por
FROM VACUNAS_PACIENTE v
JOIN PACIENTES p ON v.id_paciente = p.id
WHERE v.activo = TRUE AND p.activo = TRUE
ORDER BY v.fecha_aplicacion DESC;

COMMENT ON VIEW v_vacunas_paciente IS 'Vista de vacunas por paciente';

-- ============================================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================================================

-- Procedimiento para crear paciente completo
CREATE OR REPLACE PROCEDURE sp_crear_paciente_completo(
    p_nombre VARCHAR(100),
    p_apellido VARCHAR(100),
    p_fecha_nacimiento DATE,
    p_genero genero_type,
    p_telefono VARCHAR(30) DEFAULT NULL,
    p_email VARCHAR(100) DEFAULT NULL,
    p_cedula VARCHAR(20) DEFAULT NULL,
    p_tipo_sangre tipo_sangre_type DEFAULT 'DESCONOCIDO',
    p_direccion TEXT DEFAULT NULL,
    p_alergias JSONB DEFAULT '[]',
    p_medicamentos_actuales JSONB DEFAULT '[]',
    p_condiciones_cronicas JSONB DEFAULT '[]',
    p_seguro_medico VARCHAR(100) DEFAULT NULL,
    p_numero_poliza VARCHAR(50) DEFAULT NULL,
    OUT p_id_paciente INTEGER,
    OUT p_numero_expediente VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insertar paciente
    INSERT INTO PACIENTES (
        nombre, apellido, fecha_nacimiento, genero, telefono, email, cedula,
        tipo_sangre, direccion, alergias, medicamentos_actuales, condiciones_cronicas,
        seguro_medico, numero_poliza
    ) VALUES (
        p_nombre, p_apellido, p_fecha_nacimiento, p_genero, p_telefono, p_email, p_cedula,
        p_tipo_sangre, p_direccion, p_alergias, p_medicamentos_actuales, p_condiciones_cronicas,
        p_seguro_medico, p_numero_poliza
    ) RETURNING id, numero_expediente INTO p_id_paciente, p_numero_expediente;
    
    COMMIT;
END;
$$;

COMMENT ON PROCEDURE sp_crear_paciente_completo IS 'Procedimiento para crear un paciente completo con datos opcionales';

-- ============================================================================
-- CONFIRMACIÓN DE TRANSACCIÓN
-- ============================================================================

-- Verificar que todas las tablas se crearon correctamente
DO $$
DECLARE
    tablas_creadas INTEGER;
BEGIN
    SELECT COUNT(*) INTO tablas_creadas
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('pacientes', 'historial_clinico', 'antecedentes_medicos', 'vacunas_paciente', 'archivos_adjuntos');
    
    IF tablas_creadas = 5 THEN
        RAISE NOTICE 'Migración 02 completada exitosamente. 5 tablas creadas/verificadas.';
    ELSE
        RAISE EXCEPTION 'Error: No todas las tablas fueron creadas correctamente. Esperadas: 5, Encontradas: %', tablas_creadas;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIN DEL SCRIPT UP
-- ============================================================================

-- ============================================================================
-- SCRIPT DOWN: Reversión de la migración
-- ============================================================================
-- Para revertir esta migración, ejecutar el siguiente bloque:
/*
BEGIN;

-- ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS
-- Asegúrese de tener un respaldo antes de ejecutar

-- Eliminar vistas
DROP VIEW IF EXISTS v_vacunas_paciente CASCADE;
DROP VIEW IF EXISTS v_antecedentes_paciente CASCADE;
DROP VIEW IF EXISTS v_signos_vitales CASCADE;
DROP VIEW IF EXISTS v_historial_completo CASCADE;
DROP VIEW IF EXISTS v_pacientes_resumen CASCADE;

-- Eliminar procedimientos
DROP PROCEDURE IF EXISTS sp_crear_paciente_completo(VARCHAR, VARCHAR, DATE, genero_type, VARCHAR, VARCHAR, VARCHAR, tipo_sangre_type, TEXT, JSONB, JSONB, JSONB, VARCHAR, VARCHAR);

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_archivos_update_fecha_modificacion ON ARCHIVOS_ADJUNTOS;
DROP TRIGGER IF EXISTS tr_vacunas_update_fecha_modificacion ON VACUNAS_PACIENTE;
DROP TRIGGER IF EXISTS tr_antecedentes_update_fecha_modificacion ON ANTECEDENTES_MEDICOS;
DROP TRIGGER IF EXISTS tr_historial_validar_signos ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_actualizar_fechas_consulta ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_historial_calcular_imc ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_historial_update_fecha_modificacion ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_pacientes_generar_expediente ON PACIENTES;
DROP TRIGGER IF EXISTS tr_pacientes_update_fecha_modificacion ON PACIENTES;

-- Eliminar funciones
DROP FUNCTION IF EXISTS validar_signos_vitales();
DROP FUNCTION IF EXISTS tr_generar_numero_expediente();
DROP FUNCTION IF EXISTS generar_numero_expediente();
DROP FUNCTION IF EXISTS actualizar_fechas_consulta_paciente();
DROP FUNCTION IF EXISTS calcular_imc();

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS ARCHIVOS_ADJUNTOS CASCADE;
DROP TABLE IF EXISTS VACUNAS_PACIENTE CASCADE;
DROP TABLE IF EXISTS ANTECEDENTES_MEDICOS CASCADE;
DROP TABLE IF EXISTS HISTORIAL_CLINICO CASCADE;
DROP TABLE IF EXISTS PACIENTES CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS prioridad_type;
DROP DOMAIN IF EXISTS estado_consulta_type;
DROP DOMAIN IF EXISTS tipo_consulta_type;
DROP DOMAIN IF EXISTS estado_civil_type;
DROP DOMAIN IF EXISTS tipo_sangre_type;
DROP DOMAIN IF EXISTS genero_type;

COMMIT;
*/