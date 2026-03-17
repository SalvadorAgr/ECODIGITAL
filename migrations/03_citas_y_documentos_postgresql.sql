-- ============================================================================
-- MIGRACIÓN: 03_citas_y_documentos_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Citas, documentos, horarios y gestión de agenda médica
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
-- - Requiere: 02_pacientes_y_historial_postgresql.sql (tabla PACIENTES)
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
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'pacientes' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla PACIENTES no existe. Ejecute primero 02_pacientes_y_historial_postgresql.sql';
    END IF;
END $$;

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para estado de cita
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cita_type') THEN
        CREATE DOMAIN estado_cita_type AS VARCHAR(20)
        CHECK (VALUE IN ('PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'));
    END IF;
END $$;

-- Dominio para tipo de cita
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cita_type') THEN
        CREATE DOMAIN tipo_cita_type AS VARCHAR(30)
        CHECK (VALUE IN ('CONSULTA_GENERAL', 'CONSULTA_ESPECIALIDAD', 'SEGUIMIENTO', 'URGENCIA', 'PROCEDIMIENTO', 'INTERCONSULTA', 'TELEMEDICINA'));
    END IF;
END $$;

-- Dominio para día de la semana
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dia_semana_type') THEN
        CREATE DOMAIN dia_semana_type AS VARCHAR(15)
        CHECK (VALUE IN ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'));
    END IF;
END $$;

-- Dominio para estado de documento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_documento_type') THEN
        CREATE DOMAIN estado_documento_type AS VARCHAR(20)
        CHECK (VALUE IN ('PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'ARCHIVADO', 'ELIMINADO'));
    END IF;
END $$;

-- Dominio para tipo de documento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento_type') THEN
        CREATE DOMAIN tipo_documento_type AS VARCHAR(30)
        CHECK (VALUE IN ('RECETA', 'INFORME', 'CONSTANCIA', 'CERTIFICADO', 'RESULTADO', 'IMAGEN', 'CONSENTIMIENTO', 'REFERENCIA', 'OTRO'));
    END IF;
END $$;

-- Dominio para modalidad de cita
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalidad_cita_type') THEN
        CREATE DOMAIN modalidad_cita_type AS VARCHAR(20)
        CHECK (VALUE IN ('PRESENCIAL', 'TELEMEDICINA', 'DOMICILIO'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: HORARIOS_MEDICOS
-- Descripción: Horarios de disponibilidad de médicos
-- ============================================================================

CREATE TABLE IF NOT EXISTS HORARIOS_MEDICOS (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL,

    -- Día y horario
    dia_semana dia_semana_type NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    -- Configuración de citas
    duracion_cita_minutos INTEGER NOT NULL DEFAULT 30,
    max_citas_dia INTEGER DEFAULT 20,
    intervalo_descanso_minutos INTEGER DEFAULT 15,

    -- Excepciones
    fecha_inicio_vigencia DATE DEFAULT CURRENT_DATE,
    fecha_fin_vigencia DATE,
    es_excepcion BOOLEAN DEFAULT FALSE,
    motivo_excepcion TEXT,

    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_horarios_medico FOREIGN KEY (medico_id)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT chk_horarios_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT chk_horarios_duracion CHECK (duracion_cita_minutos > 0 AND duracion_cita_minutos <= 480),
    CONSTRAINT chk_horarios_max_citas CHECK (max_citas_dia > 0),
    CONSTRAINT uq_horarios_medico_dia UNIQUE (medico_id, dia_semana, hora_inicio)
);

COMMENT ON TABLE HORARIOS_MEDICOS IS 'Horarios de disponibilidad de médicos para programación de citas';
COMMENT ON COLUMN HORARIOS_MEDICOS.es_excepcion IS 'Indica si es una excepción al horario regular (día festivo, vacaciones, etc.)';

-- ============================================================================
-- TABLA: BLOQUEOS_HORARIO
-- Descripción: Bloqueos temporales de horarios de médicos
-- ============================================================================

CREATE TABLE IF NOT EXISTS BLOQUEOS_HORARIO (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL,

    -- Período de bloqueo
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Información del bloqueo
    motivo VARCHAR(255) NOT NULL,
    tipo_bloqueo VARCHAR(20) NOT NULL CHECK (tipo_bloqueo IN ('VACACIONES', 'CAPACITACION', 'INCAPACIDAD', 'REUNION', 'OTRO')),
    descripcion TEXT,

    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bloqueos_medico FOREIGN KEY (medico_id)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_bloqueos_creador FOREIGN KEY (creado_por)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT chk_bloqueos_fechas CHECK (fecha_inicio < fecha_fin)
);

COMMENT ON TABLE BLOQUEOS_HORARIO IS 'Bloqueos temporales de horarios de médicos (vacaciones, capacitaciones, etc.)';

-- ============================================================================
-- TABLA: CITAS
-- Descripción: Citas médicas programadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS CITAS (
    id BIGSERIAL PRIMARY KEY,
    numero_cita VARCHAR(20) UNIQUE,

    -- Relaciones
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,
    horario_id INTEGER,

    -- Información de la cita
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    duracion_minutos INTEGER NOT NULL DEFAULT 30,
    tipo_cita tipo_cita_type NOT NULL DEFAULT 'CONSULTA_GENERAL',
    modalidad modalidad_cita_type NOT NULL DEFAULT 'PRESENCIAL',
    estado estado_cita_type NOT NULL DEFAULT 'PROGRAMADA',

    -- Detalles
    motivo TEXT NOT NULL,
    observaciones TEXT,
    sintomas TEXT,

    -- Ubicación
    sala_consulta VARCHAR(50),
    ubicacion VARCHAR(255),
    enlace_telemedicina VARCHAR(500),

    -- Costos
    costo_consulta DECIMAL(10,2),
    moneda VARCHAR(3) DEFAULT 'MXN',
    estado_pago VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado_pago IN ('PENDIENTE', 'PAGADO', 'REEMBOLSADO', 'CANCELADO')),

    -- Seguimiento
    requiere_seguimiento BOOLEAN DEFAULT FALSE,
    cita_previa_id BIGINT,

    -- Recordatorios
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    fecha_recordatorio TIMESTAMP WITH TIME ZONE,

    -- Cancelación/Reprogramación
    motivo_cancelacion TEXT,
    cancelado_por INTEGER,
    fecha_cancelacion TIMESTAMP WITH TIME ZONE,

    -- Estado del registro
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_citas_paciente FOREIGN KEY (id_paciente)
        REFERENCES PACIENTES(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_citas_medico FOREIGN KEY (medico_id)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_citas_horario FOREIGN KEY (horario_id)
        REFERENCES HORARIOS_MEDICOS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT fk_citas_cancelado_por FOREIGN KEY (cancelado_por)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT fk_citas_cita_previa FOREIGN KEY (cita_previa_id)
        REFERENCES CITAS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT chk_citas_duracion CHECK (duracion_minutos > 0 AND duracion_minutos <= 480),
    CONSTRAINT chk_citas_costo CHECK (costo_consulta IS NULL OR costo_consulta >= 0)
);

COMMENT ON TABLE CITAS IS 'Citas médicas programadas';
COMMENT ON COLUMN CITAS.numero_cita IS 'Número único de cita generado automáticamente';
COMMENT ON COLUMN CITAS.enlace_telemedicina IS 'URL para videollamada en caso de modalidad TELEMEDICINA';

-- ============================================================================
-- TABLA: DOCUMENTOS
-- Descripción: Documentos médicos generados
-- ============================================================================

CREATE TABLE IF NOT EXISTS DOCUMENTOS (
    id SERIAL PRIMARY KEY,
    numero_documento VARCHAR(30) UNIQUE NOT NULL,

    -- Relaciones
    cita_id BIGINT,
    historial_id BIGINT,
    paciente_id INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,

    -- Información del documento
    tipo_documento tipo_documento_type NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT,

    -- Archivo adjunto
    archivo_path VARCHAR(500),
    archivo_nombre VARCHAR(255),
    archivo_tipo VARCHAR(50),
    archivo_tamano BIGINT,
    archivo_hash VARCHAR(64),

    -- Estado y validación
    estado estado_documento_type NOT NULL DEFAULT 'PENDIENTE',
    version INTEGER DEFAULT 1,
    documento_padre_id INTEGER,

    -- Fechas importantes
    fecha_documento DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,

    -- Firma digital
    firma_digital TEXT,
    fecha_firma TIMESTAMP WITH TIME ZONE,
    certificado_firma VARCHAR(500),

    -- Aprobación
    aprobado_por INTEGER,
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    comentarios_revision TEXT,

    -- Estado del registro
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    confidencial BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_documentos_cita FOREIGN KEY (cita_id)
        REFERENCES CITAS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT fk_documentos_historial FOREIGN KEY (historial_id)
        REFERENCES HISTORIAL_CLINICO(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT fk_documentos_paciente FOREIGN KEY (paciente_id)
        REFERENCES PACIENTES(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_medico FOREIGN KEY (medico_id)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_aprobador FOREIGN KEY (aprobado_por)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,
    CONSTRAINT fk_documentos_padre FOREIGN KEY (documento_padre_id)
        REFERENCES DOCUMENTOS(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL
);

COMMENT ON TABLE DOCUMENTOS IS 'Documentos médicos generados (recetas, informes, constancias, etc.)';
COMMENT ON COLUMN DOCUMENTOS.firma_digital IS 'Firma digital del documento para autenticidad';

-- ============================================================================
-- TABLA: PLANTILLAS_DOCUMENTOS
-- Descripción: Plantillas para generación de documentos
-- ============================================================================

CREATE TABLE IF NOT EXISTS PLANTILLAS_DOCUMENTOS (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo_documento tipo_documento_type NOT NULL,

    -- Contenido de la plantilla
    contenido TEXT NOT NULL,
    variables JSONB DEFAULT '{}',

    -- Configuración
    formato VARCHAR(20) DEFAULT 'HTML' CHECK (formato IN ('HTML', 'PDF', 'DOCX', 'TXT')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadatos
    descripcion TEXT,
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_plantillas_creador FOREIGN KEY (creado_por)
        REFERENCES USUARIOS(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

COMMENT ON TABLE PLANTILLAS_DOCUMENTOS IS 'Plantillas para generación automática de documentos médicos';
COMMENT ON COLUMN PLANTILLAS_DOCUMENTOS.variables IS 'JSONB con variables disponibles para la plantilla';

-- ============================================================================
-- TABLA: SALAS_CONSULTA
-- Descripción: Salas de consulta disponibles
-- ============================================================================

CREATE TABLE IF NOT EXISTS SALAS_CONSULTA (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,

    -- Ubicación
    edificio VARCHAR(100),
    piso INTEGER,
    area VARCHAR(100),

    -- Capacidad y equipamiento
    capacidad INTEGER DEFAULT 1,
    equipamiento JSONB DEFAULT '[]',

    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT,

    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_salas_capacidad CHECK (capacidad > 0)
);

COMMENT ON TABLE SALAS_CONSULTA IS 'Salas de consulta disponibles para citas médicas';
COMMENT ON COLUMN SALAS_CONSULTA.equipamiento IS 'JSONB con array de equipamiento disponible';

-- ============================================================================
-- SECUENCIAS PERSONALIZADAS
-- ============================================================================

-- Secuencia para números de cita
CREATE SEQUENCE IF NOT EXISTS citas_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Secuencia para números de documento
CREATE SEQUENCE IF NOT EXISTS documentos_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para validar conflicto de citas
CREATE OR REPLACE FUNCTION validar_conflicto_citas()
RETURNS TRIGGER AS $$
DECLARE
    conflictos INTEGER;
    v_hora_fin TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calcular hora de fin de la cita
    v_hora_fin := NEW.fecha_hora + INTERVAL '1 minute' * NEW.duracion_minutos;

    -- Buscar conflictos
    SELECT COUNT(*) INTO conflictos
    FROM CITAS
    WHERE medico_id = NEW.medico_id
    AND activo = TRUE
    AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
    AND id != COALESCE(NEW.id, 0)
    AND (
        -- La nueva cita empieza durante una cita existente
        (NEW.fecha_hora >= fecha_hora AND NEW.fecha_hora < fecha_hora + INTERVAL '1 minute' * duracion_minutos)
        OR
        -- La nueva cita termina durante una cita existente
        (v_hora_fin > fecha_hora AND v_hora_fin <= fecha_hora + INTERVAL '1 minute' * duracion_minutos)
        OR
        -- La nueva cita abarca completamente una cita existente
        (NEW.fecha_hora <= fecha_hora AND v_hora_fin >= fecha_hora + INTERVAL '1 minute' * duracion_minutos)
    );

    IF conflictos > 0 THEN
        RAISE EXCEPTION 'Conflicto de horario: El médico ya tiene una cita programada en ese horario';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_conflicto_citas() IS 'Función trigger para validar que no haya conflictos de horario en citas';

-- Función para generar número de cita
CREATE OR REPLACE FUNCTION generar_numero_cita()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_cita IS NULL OR NEW.numero_cita = '' THEN
        NEW.numero_cita := 'CITA-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                          LPAD(NEXTVAL('citas_numero_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_numero_cita() IS 'Función trigger para generar número de cita único automáticamente';

-- Función para generar número de documento
CREATE OR REPLACE FUNCTION generar_numero_documento()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_documento IS NULL OR NEW.numero_documento = '' THEN
        NEW.numero_documento := 'DOC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                               LPAD(NEXTVAL('documentos_numero_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_numero_documento() IS 'Función trigger para generar número de documento único automáticamente';

-- Función para verificar disponibilidad del médico
CREATE OR REPLACE FUNCTION verificar_disponibilidad_medico(
    p_medico_id INTEGER,
    p_fecha_hora TIMESTAMP WITH TIME ZONE,
    p_duracion_minutos INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_dia_semana VARCHAR(15);
    v_hora TIME;
    v_disponible BOOLEAN := FALSE;
    v_horario RECORD;
    v_bloqueado BOOLEAN;
BEGIN
    -- Obtener día de la semana y hora
    v_dia_semana := CASE EXTRACT(DOW FROM p_fecha_hora)
        WHEN 0 THEN 'DOMINGO'
        WHEN 1 THEN 'LUNES'
        WHEN 2 THEN 'MARTES'
        WHEN 3 THEN 'MIERCOLES'
        WHEN 4 THEN 'JUEVES'
        WHEN 5 THEN 'VIERNES'
        WHEN 6 THEN 'SABADO'
    END;

    v_hora := CAST(p_fecha_hora AS TIME);

    -- Verificar si hay horario configurado
    SELECT * INTO v_horario
    FROM HORARIOS_MEDICOS
    WHERE medico_id = p_medico_id
    AND dia_semana = v_dia_semana
    AND hora_inicio <= v_hora
    AND hora_fin >= v_hora + INTERVAL '1 minute' * p_duracion_minutos
    AND activo = TRUE
    AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= CURRENT_DATE)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Verificar si hay bloqueos
    SELECT EXISTS (
        SELECT 1 FROM BLOQUEOS_HORARIO
        WHERE medico_id = p_medico_id
        AND activo = TRUE
        AND p_fecha_hora >= fecha_inicio
        AND p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos <= fecha_fin
    ) INTO v_bloqueado;

    IF v_bloqueado THEN
        RETURN FALSE;
    END IF;

    -- Verificar si hay citas conflictivas
    SELECT NOT EXISTS (
        SELECT 1 FROM CITAS
        WHERE medico_id = p_medico_id
        AND activo = TRUE
        AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
        AND (
            (p_fecha_hora >= fecha_hora AND p_fecha_hora < fecha_hora + INTERVAL '1 minute' * duracion_minutos)
            OR
            (p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos > fecha_hora AND
             p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos <= fecha_hora + INTERVAL '1 minute' * duracion_minutos)
            OR
            (p_fecha_hora <= fecha_hora AND
             p_fecha_hora + INTERVAL '1 minute' * p_duracion_minutos >= fecha_hora + INTERVAL '1 minute' * duracion_minutos)
        )
    ) INTO v_disponible;

    RETURN v_disponible;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_disponibilidad_medico(INTEGER, TIMESTAMP WITH TIME ZONE, INTEGER) IS 'Función para verificar disponibilidad de un médico en una fecha y hora específica';

-- Función para obtener horarios disponibles
CREATE OR REPLACE FUNCTION obtener_horarios_disponibles(
    p_medico_id INTEGER,
    p_fecha DATE
) RETURNS TABLE (
    hora_inicio TIME,
    hora_fin TIME,
    disponible BOOLEAN
) AS $$
DECLARE
    v_dia_semana VARCHAR(15);
    v_horario RECORD;
    v_citas_ocupadas TIME[];
    v_hora_actual TIME;
    v_hora_fin TIME;
    v_intervalo INTEGER;
BEGIN
    -- Obtener día de la semana
    v_dia_semana := CASE EXTRACT(DOW FROM p_fecha)
        WHEN 0 THEN 'DOMINGO'
        WHEN 1 THEN 'LUNES'
        WHEN 2 THEN 'MARTES'
        WHEN 3 THEN 'MIERCOLES'
        WHEN 4 THEN 'JUEVES'
        WHEN 5 THEN 'VIERNES'
        WHEN 6 THEN 'SABADO'
    END;

    -- Obtener horario del médico
    FOR v_horario IN
        SELECT * FROM HORARIOS_MEDICOS
        WHERE medico_id = p_medico_id
        AND dia_semana = v_dia_semana
        AND activo = TRUE
        AND fecha_inicio_vigencia <= p_fecha
        AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= p_fecha)
    LOOP
        v_intervalo := v_horario.duracion_cita_minutos;
        v_hora_actual := v_horario.hora_inicio;
        v_hora_fin := v_horario.hora_fin;

        -- Generar slots de tiempo
        WHILE v_hora_actual + INTERVAL '1 minute' * v_intervalo <= v_hora_fin LOOP
            -- Verificar si está disponible
            SELECT NOT EXISTS (
                SELECT 1 FROM CITAS
                WHERE medico_id = p_medico_id
                AND activo = TRUE
                AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
                AND DATE(fecha_hora) = p_fecha
                AND CAST(fecha_hora AS TIME) = v_hora_actual
            ) INTO disponible;

            hora_inicio := v_hora_actual;
            hora_fin := v_hora_actual + INTERVAL '1 minute' * v_intervalo;

            RETURN NEXT;

            v_hora_actual := v_hora_actual + INTERVAL '1 minute' * v_intervalo;
        END LOOP;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_horarios_disponibles(INTEGER, DATE) IS 'Función para obtener horarios disponibles de un médico en una fecha específica';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha_modificacion en HORARIOS_MEDICOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_horarios_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_horarios_update_fecha_modificacion
            BEFORE UPDATE ON HORARIOS_MEDICOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en BLOQUEOS_HORARIO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_bloqueos_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_bloqueos_update_fecha_modificacion
            BEFORE UPDATE ON BLOQUEOS_HORARIO
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para generar número de cita
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_citas_generar_numero'
    ) THEN
        CREATE TRIGGER tr_citas_generar_numero
            BEFORE INSERT ON CITAS
            FOR EACH ROW
            EXECUTE FUNCTION generar_numero_cita();
    END IF;
END $$;

-- Trigger para validar conflicto de citas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_citas_validar_conflicto'
    ) THEN
        CREATE TRIGGER tr_citas_validar_conflicto
            BEFORE INSERT OR UPDATE ON CITAS
            FOR EACH ROW
            EXECUTE FUNCTION validar_conflicto_citas();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en CITAS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_citas_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_citas_update_fecha_modificacion
            BEFORE UPDATE ON CITAS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para generar número de documento
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_documentos_generar_numero'
    ) THEN
        CREATE TRIGGER tr_documentos_generar_numero
            BEFORE INSERT ON DOCUMENTOS
            FOR EACH ROW
            EXECUTE FUNCTION generar_numero_documento();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en DOCUMENTOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_documentos_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_documentos_update_fecha_modificacion
            BEFORE UPDATE ON DOCUMENTOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en PLANTILLAS_DOCUMENTOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_plantillas_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_plantillas_update_fecha_modificacion
            BEFORE UPDATE ON PLANTILLAS_DOCUMENTOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en SALAS_CONSULTA
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_salas_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_salas_update_fecha_modificacion
            BEFORE UPDATE ON SALAS_CONSULTA
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para HORARIOS_MEDICOS
CREATE INDEX IF NOT EXISTS idx_horarios_medico ON HORARIOS_MEDICOS(medico_id);
CREATE INDEX IF NOT EXISTS idx_horarios_dia ON HORARIOS_MEDICOS(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_activo ON HORARIOS_MEDICOS(activo);
CREATE INDEX IF NOT EXISTS idx_horarios_medico_dia ON HORARIOS_MEDICOS(medico_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_vigencia ON HORARIOS_MEDICOS(fecha_inicio_vigencia, fecha_fin_vigencia);

-- Índices para BLOQUEOS_HORARIO
CREATE INDEX IF NOT EXISTS idx_bloqueos_medico ON BLOQUEOS_HORARIO(medico_id);
CREATE INDEX IF NOT EXISTS idx_bloqueos_fechas ON BLOQUEOS_HORARIO(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_bloqueos_activo ON BLOQUEOS_HORARIO(activo);
CREATE INDEX IF NOT EXISTS idx_bloqueos_tipo ON BLOQUEOS_HORARIO(tipo_bloqueo);

-- Índices para CITAS
CREATE INDEX IF NOT EXISTS idx_citas_fecha_hora ON CITAS(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON CITAS(id_paciente);
CREATE INDEX IF NOT EXISTS idx_citas_medico ON CITAS(medico_id);
CREATE INDEX IF NOT EXISTS idx_citas_paciente_fecha ON CITAS(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON CITAS(estado);
CREATE INDEX IF NOT EXISTS idx_citas_tipo ON CITAS(tipo_cita);
CREATE INDEX IF NOT EXISTS idx_citas_numero ON CITAS(numero_cita);
CREATE INDEX IF NOT EXISTS idx_citas_activo ON CITAS(activo);
CREATE INDEX IF NOT EXISTS idx_citas_modalidad ON CITAS(modalidad);

-- Índices para DOCUMENTOS
CREATE INDEX IF NOT EXISTS idx_documentos_cita ON DOCUMENTOS(cita_id);
CREATE INDEX IF NOT EXISTS idx_documentos_historial ON DOCUMENTOS(historial_id);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON DOCUMENTOS(paciente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_medico ON DOCUMENTOS(medico_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON DOCUMENTOS(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON DOCUMENTOS(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha ON DOCUMENTOS(fecha_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_numero ON DOCUMENTOS(numero_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_activo ON DOCUMENTOS(activo);

-- Índices para PLANTILLAS_DOCUMENTOS
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo ON PLANTILLAS_DOCUMENTOS(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_plantillas_activo ON PLANTILLAS_DOCUMENTOS(activo);
CREATE INDEX IF NOT EXISTS idx_plantillas_nombre ON PLANTILLAS_DOCUMENTOS(nombre);

-- Índices para SALAS_CONSULTA
CREATE INDEX IF NOT EXISTS idx_salas_codigo ON SALAS_CONSULTA(codigo);
CREATE INDEX IF NOT EXISTS idx_salas_activo ON SALAS_CONSULTA(activo);
CREATE INDEX IF NOT EXISTS idx_salas_disponible ON SALAS_CONSULTA(disponible);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de citas completas
CREATE OR REPLACE VIEW v_citas_completas AS
SELECT
    c.id,
    c.numero_cita,
    c.fecha_hora,
    c.duracion_minutos,
    c.tipo_cita,
    c.modalidad,
    c.estado,
    c.motivo,
    c.observaciones,
    c.sala_consulta,
    c.costo_consulta,
    c.moneda,
    c.estado_pago,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    p.email as email_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    u.telefono as telefono_medico,
    c.fecha_creacion,
    c.fecha_confirmacion
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id
WHERE c.activo = TRUE AND p.activo = TRUE;

COMMENT ON VIEW v_citas_completas IS 'Vista completa de citas con información de paciente y médico';

-- Vista de citas del día
CREATE OR REPLACE VIEW v_citas_hoy AS
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
    c.sala_consulta,
    c.motivo
FROM CITAS c
JOIN PACIENTES p ON c.id_paciente = p.id
JOIN USUARIOS u ON c.medico_id = u.id
WHERE c.activo = TRUE
AND DATE(c.fecha_hora) = CURRENT_DATE
ORDER BY c.fecha_hora;

COMMENT ON VIEW v_citas_hoy IS 'Vista de citas programadas para el día actual';

-- Vista de horarios de médicos
CREATE OR REPLACE VIEW v_horarios_medicos AS
SELECT
    h.id,
    h.medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.duracion_cita_minutos,
    h.max_citas_dia,
    h.activo
FROM HORARIOS_MEDICOS h
JOIN USUARIOS u ON h.medico_id = u.id
WHERE h.activo = TRUE
ORDER BY h.medico_id,
    CASE h.dia_semana
        WHEN 'LUNES' THEN 1
        WHEN 'MARTES' THEN 2
        WHEN 'MIERCOLES' THEN 3
        WHEN 'JUEVES' THEN 4
        WHEN 'VIERNES' THEN 5
        WHEN 'SABADO' THEN 6
        WHEN 'DOMINGO' THEN 7
    END;

COMMENT ON VIEW v_horarios_medicos IS 'Vista de horarios de médicos con información del médico';

-- Vista de documentos por paciente
CREATE OR REPLACE VIEW v_documentos_paciente AS
SELECT
    d.id,
    d.numero_documento,
    d.tipo_documento,
    d.titulo,
    d.fecha_documento,
    d.estado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    d.confidencial,
    d.fecha_creacion
FROM DOCUMENTOS d
JOIN PACIENTES p ON d.paciente_id = p.id
JOIN USUARIOS u ON d.medico_id = u.id
WHERE d.activo = TRUE
ORDER BY d.fecha_documento DESC;

COMMENT ON VIEW v_documentos_paciente IS 'Vista de documentos por paciente con información médica';

-- Vista de disponibilidad de salas
CREATE OR REPLACE VIEW v_salas_disponibles AS
SELECT
    s.id,
    s.codigo,
    s.nombre,
    s.edificio,
    s.piso,
    s.area,
    s.capacidad,
    s.equipamiento,
    s.disponible,
    (SELECT COUNT(*) FROM CITAS c
     WHERE c.sala_consulta = s.codigo
     AND DATE(c.fecha_hora) = CURRENT_DATE
     AND c.activo = TRUE
     AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')) as citas_hoy
FROM SALAS_CONSULTA s
WHERE s.activo = TRUE
ORDER BY s.codigo;

COMMENT ON VIEW v_salas_disponibles IS 'Vista de salas de consulta con disponibilidad';

-- ============================================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================================================

-- Procedimiento para reprogramar cita
CREATE OR REPLACE PROCEDURE sp_reprogramar_cita(
    p_cita_id BIGINT,
    p_nueva_fecha_hora TIMESTAMP WITH TIME ZONE,
    p_motivo TEXT,
    p_usuario_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cita_antigua RECORD;
    v_nueva_cita_id BIGINT;
BEGIN
    -- Obtener datos de la cita original
    SELECT * INTO v_cita_antigua
    FROM CITAS WHERE id = p_cita_id AND activo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita no encontrada o inactiva';
    END IF;

    -- Verificar disponibilidad
    IF NOT verificar_disponibilidad_medico(v_cita_antigua.medico_id, p_nueva_fecha_hora, v_cita_antigua.duracion_minutos) THEN
        RAISE EXCEPTION 'El médico no tiene disponibilidad en el nuevo horario';
    END IF;

    -- Crear nueva cita
    INSERT INTO CITAS (
        id_paciente, medico_id, fecha_hora, duracion_minutos,
        tipo_cita, modalidad, motivo, observaciones,
        sala_consulta, costo_consulta, moneda,
        cita_previa_id, estado
    ) VALUES (
        v_cita_antigua.id_paciente, v_cita_antigua.medico_id, p_nueva_fecha_hora,
        v_cita_antigua.duracion_minutos, v_cita_antigua.tipo_cita, v_cita_antigua.modalidad,
        v_cita_antigua.motivo, v_cita_antigua.observaciones, v_cita_antigua.sala_consulta,
        v_cita_antigua.costo_consulta, v_cita_antigua.moneda, p_cita_id, 'PROGRAMADA'
    ) RETURNING id INTO v_nueva_cita_id;

    -- Actualizar cita anterior
    UPDATE CITAS SET
        estado = 'REPROGRAMADA',
        motivo_cancelacion = p_motivo,
        cancelado_por = p_usuario_id,
        fecha_cancelacion = CURRENT_TIMESTAMP,
        fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id = p_cita_id;

    COMMIT;
END;
$$;

COMMENT ON PROCEDURE sp_reprogramar_cita IS 'Procedimiento para reprogramar una cita existente';

-- Procedimiento para cancelar cita
CREATE OR REPLACE PROCEDURE sp_cancelar_cita(
    p_cita_id BIGINT,
    p_motivo TEXT,
    p_usuario_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE CITAS SET
        estado = 'CANCELADA',
        motivo_cancelacion = p_motivo,
        cancelado_por = p_usuario_id,
        fecha_cancelacion = CURRENT_TIMESTAMP,
        fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id = p_cita_id AND activo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita no encontrada o inactiva';
    END IF;

    COMMIT;
END;
$$;

COMMENT ON PROCEDURE sp_cancelar_cita IS 'Procedimiento para cancelar una cita';

-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar salas de consulta por defecto
INSERT INTO SALAS_CONSULTA (codigo, nombre, edificio, piso, area, capacidad, equipamiento, activo, disponible)
VALUES
    ('SALA-001', 'Consulta General 1', 'Edificio Principal', 1, 'Área Médica', 1, '["camilla", "escritorio", "computadora", "tensiómetro"]'::jsonb, TRUE, TRUE),
    ('SALA-002', 'Consulta General 2', 'Edificio Principal', 1, 'Área Médica', 1, '["camilla", "escritorio", "computadora", "tensiómetro"]'::jsonb, TRUE, TRUE),
    ('SALA-003', 'Consulta Especialidades', 'Edificio Principal', 2, 'Área Especialidades', 1, '["camilla", "escritorio", "computadora", "ecografía"]'::jsonb, TRUE, TRUE),
    ('SALA-004', 'Urgencias 1', 'Edificio Principal', 0, 'Urgencias', 2, '["camilla", "monitor", "carro_de_emergencias"]'::jsonb, TRUE, TRUE),
    ('SALA-005', 'Telemedicina', 'Edificio Principal', 2, 'Área Digital', 1, '["computadora", "webcam", "micrófono"]'::jsonb, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Insertar plantillas de documentos por defecto
INSERT INTO PLANTILLAS_DOCUMENTOS (nombre, tipo_documento, contenido, variables, formato, activo, descripcion, creado_por)
SELECT 'Plantilla de Receta Médica', 'RECETA',
    '<h1>Receta Médica</h1><p>Paciente: {{nombre_paciente}}</p><p>Fecha: {{fecha}}</p><p>Diagnóstico: {{diagnostico}}</p><p>Medicamentos:</p><ul>{{#each medicamentos}}<li>{{nombre}} - {{dosis}} - {{frecuencia}}</li>{{/each}}</ul><p>Médico: {{nombre_medico}}</p><p>Cédula: {{cedula_medico}}</p>',
    '{"nombre_paciente": "string", "fecha": "date", "diagnostico": "string", "medicamentos": "array", "nombre_medico": "string", "cedula_medico": "string"}'::jsonb,
    'HTML', TRUE, 'Plantilla estándar para recetas médicas', id
FROM USUARIOS WHERE rol_id = (SELECT id FROM ROLES WHERE nombre = 'Administrador' LIMIT 1) LIMIT 1
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO PLANTILLAS_DOCUMENTOS (nombre, tipo_documento, contenido, variables, formato, activo, descripcion, creado_por)
SELECT 'Plantilla de Constancia Médica', 'CONSTANCIA',
    '<h1>Constancia Médica</h1><p>Se hace constar que el paciente {{nombre_paciente}}</p><p>asistió a consulta el día {{fecha_consulta}}</p><p>por el motivo: {{motivo}}</p><p>Atendido por: {{nombre_medico}}</p>',
    '{"nombre_paciente": "string", "fecha_consulta": "date", "motivo": "string", "nombre_medico": "string"}'::jsonb,
    'HTML', TRUE, 'Plantilla estándar para constancias médicas', id
FROM USUARIOS WHERE rol_id = (SELECT id FROM ROLES WHERE nombre = 'Administrador' LIMIT 1) LIMIT 1
ON CONFLICT (nombre) DO NOTHING;

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
    AND tablename IN ('horarios_medicos', 'bloqueos_horario', 'citas', 'documentos', 'plantillas_documentos', 'salas_consulta');

    IF tablas_creadas = 6 THEN
        RAISE NOTICE 'Migración 03 completada exitosamente. 6 tablas creadas/verificadas.';
    ELSE
        RAISE EXCEPTION 'Error: No todas las tablas fueron creadas correctamente. Esperadas: 6, Encontradas: %', tablas_creadas;
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
DROP VIEW IF EXISTS v_salas_disponibles CASCADE;
DROP VIEW IF EXISTS v_documentos_paciente CASCADE;
DROP VIEW IF EXISTS v_horarios_medicos CASCADE;
DROP VIEW IF EXISTS v_citas_hoy CASCADE;
DROP VIEW IF EXISTS v_citas_completas CASCADE;

-- Eliminar procedimientos
DROP PROCEDURE IF EXISTS sp_cancelar_cita(BIGINT, TEXT, INTEGER);
DROP PROCEDURE IF EXISTS sp_reprogramar_cita(BIGINT, TIMESTAMP WITH TIME ZONE, TEXT, INTEGER);

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_salas_update_fecha_modificacion ON SALAS_CONSULTA;
DROP TRIGGER IF EXISTS tr_plantillas_update_fecha_modificacion ON PLANTILLAS_DOCUMENTOS;
DROP TRIGGER IF EXISTS tr_documentos_update_fecha_modificacion ON DOCUMENTOS;
DROP TRIGGER IF EXISTS tr_documentos_generar_numero ON DOCUMENTOS;
DROP TRIGGER IF EXISTS tr_citas_update_fecha_modificacion ON CITAS;
DROP TRIGGER IF EXISTS tr_citas_validar_conflicto ON CITAS;
DROP TRIGGER IF EXISTS tr_citas_generar_numero ON CITAS;
DROP TRIGGER IF EXISTS tr_bloqueos_update_fecha_modificacion ON BLOQUEOS_HORARIO;
DROP TRIGGER IF EXISTS tr_horarios_update_fecha_modificacion ON HORARIOS_MEDICOS;

-- Eliminar funciones
DROP FUNCTION IF EXISTS obtener_horarios_disponibles(INTEGER, DATE);
DROP FUNCTION IF EXISTS verificar_disponibilidad_medico(INTEGER, TIMESTAMP WITH TIME ZONE, INTEGER);
DROP FUNCTION IF EXISTS generar_numero_documento();
DROP FUNCTION IF EXISTS generar_numero_cita();
DROP FUNCTION IF EXISTS validar_conflicto_citas();

-- Eliminar secuencias
DROP SEQUENCE IF EXISTS documentos_numero_seq;
DROP SEQUENCE IF EXISTS citas_numero_seq;

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS SALAS_CONSULTA CASCADE;
DROP TABLE IF EXISTS PLANTILLAS_DOCUMENTOS CASCADE;
DROP TABLE IF EXISTS DOCUMENTOS CASCADE;
DROP TABLE IF EXISTS CITAS CASCADE;
DROP TABLE IF EXISTS BLOQUEOS_HORARIO CASCADE;
DROP TABLE IF EXISTS HORARIOS_MEDICOS CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS modalidad_cita_type;
DROP DOMAIN IF EXISTS tipo_documento_type;
DROP DOMAIN IF EXISTS estado_documento_type;
DROP DOMAIN IF EXISTS dia_semana_type;
DROP DOMAIN IF EXISTS tipo_cita_type;
DROP DOMAIN IF EXISTS estado_cita_type;

COMMIT;
*/
