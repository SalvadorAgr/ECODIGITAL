-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Recursos y Reservas - PostgreSQL
-- Descripción: Gestión de recursos (salas, equipos, personal) y reservas
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: RECURSOS
-- =====================================================
CREATE TABLE IF NOT EXISTS RECURSOS (
    id SERIAL PRIMARY KEY,
    
    -- Información básica del recurso
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    codigo_interno VARCHAR(50) UNIQUE,
    
    -- Tipo y categorización
    tipo_recurso VARCHAR(25) NOT NULL CHECK (tipo_recurso IN (
        'SALA_CONSULTA', 'SALA_CIRUGIA', 'SALA_PROCEDIMIENTOS',
        'EQUIPO_MEDICO', 'EQUIPO_DIAGNOSTICO', 'EQUIPO_CIRUGIA',
        'PERSONAL_APOYO', 'PERSONAL_TECNICO', 'PERSONAL_ENFERMERIA',
        'VEHICULO', 'OTRO'
    )),
    categoria VARCHAR(50),
    subcategoria VARCHAR(50),
    
    -- Capacidad y disponibilidad
    capacidad_maxima INTEGER DEFAULT 1,
    capacidad_actual INTEGER DEFAULT 0,
    permite_reserva_multiple BOOLEAN DEFAULT FALSE,
    
    -- Ubicación y características
    ubicacion VARCHAR(100),
    piso VARCHAR(20),
    edificio VARCHAR(50),
    caracteristicas JSONB,
    
    -- Configuración de reservas
    duracion_minima_reserva INTEGER DEFAULT 30,
    duracion_maxima_reserva INTEGER DEFAULT 480,
    tiempo_preparacion INTEGER DEFAULT 0,
    tiempo_limpieza INTEGER DEFAULT 15,
    requiere_autorizacion BOOLEAN DEFAULT FALSE,
    
    -- Disponibilidad por horarios
    horario_disponibilidad JSONB,
    dias_no_disponible JSONB,
    
    -- Costos y facturación
    costo_por_hora DECIMAL(10,2),
    costo_fijo DECIMAL(10,2),
    requiere_facturacion BOOLEAN DEFAULT FALSE,
    
    -- Mantenimiento y estado
    estado_recurso VARCHAR(15) DEFAULT 'DISPONIBLE' CHECK (estado_recurso IN (
        'DISPONIBLE', 'OCUPADO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'RESERVADO'
    )),
    fecha_ultimo_mantenimiento DATE,
    fecha_proximo_mantenimiento DATE,
    observaciones_mantenimiento TEXT,
    
    -- Responsables y contacto
    responsable_id INTEGER,
    contacto_mantenimiento VARCHAR(100),
    proveedor VARCHAR(100),
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    fecha_baja TIMESTAMP NULL,
    motivo_baja TEXT,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para RECURSOS
CREATE INDEX IF NOT EXISTS idx_recursos_tipo ON RECURSOS(tipo_recurso);
CREATE INDEX IF NOT EXISTS idx_recursos_categoria ON RECURSOS(categoria);
CREATE INDEX IF NOT EXISTS idx_recursos_estado ON RECURSOS(estado_recurso);
CREATE INDEX IF NOT EXISTS idx_recursos_ubicacion ON RECURSOS(ubicacion);
CREATE INDEX IF NOT EXISTS idx_recursos_activo ON RECURSOS(activo);
CREATE INDEX IF NOT EXISTS idx_recursos_codigo ON RECURSOS(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_recursos_responsable ON RECURSOS(responsable_id);
CREATE INDEX IF NOT EXISTS idx_recursos_mantenimiento ON RECURSOS(fecha_proximo_mantenimiento);

-- =====================================================
-- TABLA: RESERVAS_RECURSOS
-- =====================================================
CREATE TABLE IF NOT EXISTS RESERVAS_RECURSOS (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información básica de la reserva
    numero_reserva VARCHAR(20) UNIQUE NOT NULL,
    recurso_id INTEGER NOT NULL,
    cita_id INTEGER NULL,
    
    -- Información del solicitante
    solicitante_id INTEGER NOT NULL,
    departamento VARCHAR(50),
    motivo_reserva TEXT NOT NULL,
    
    -- Programación de la reserva
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    duracion_minutos INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (fecha_fin - fecha_inicio))/60) STORED,
    
    -- Configuración de la reserva
    tipo_reserva VARCHAR(15) DEFAULT 'CITA_MEDICA' CHECK (tipo_reserva IN (
        'CITA_MEDICA', 'MANTENIMIENTO', 'EVENTO', 'BLOQUEO', 'OTRO'
    )),
    prioridad VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),
    es_recurrente BOOLEAN DEFAULT FALSE,
    patron_recurrencia JSONB,
    
    -- Estado de la reserva
    estado_reserva VARCHAR(15) DEFAULT 'SOLICITADA' CHECK (estado_reserva IN (
        'SOLICITADA', 'CONFIRMADA', 'EN_USO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW'
    )),
    fecha_confirmacion TIMESTAMP NULL,
    confirmado_por INTEGER NULL,
    
    -- Información de uso real
    fecha_inicio_real TIMESTAMP NULL,
    fecha_fin_real TIMESTAMP NULL,
    tiempo_uso_real INTEGER,
    
    -- Configuración adicional
    requiere_preparacion BOOLEAN DEFAULT FALSE,
    instrucciones_preparacion TEXT,
    requiere_personal_apoyo BOOLEAN DEFAULT FALSE,
    personal_apoyo_asignado JSONB,
    
    -- Costos y facturación
    costo_calculado DECIMAL(10,2),
    costo_real DECIMAL(10,2),
    facturado BOOLEAN DEFAULT FALSE,
    numero_factura VARCHAR(50),
    
    -- Observaciones y notas
    observaciones TEXT,
    notas_uso TEXT,
    incidencias TEXT,
    
    -- Cancelación
    fecha_cancelacion TIMESTAMP NULL,
    motivo_cancelacion TEXT,
    cancelado_por INTEGER NULL,
    
    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones de integridad
    CONSTRAINT chk_reservas_fechas CHECK (fecha_fin > fecha_inicio)
);

-- Índices para RESERVAS_RECURSOS
CREATE INDEX IF NOT EXISTS idx_reservas_recurso ON RESERVAS_RECURSOS(recurso_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cita ON RESERVAS_RECURSOS(cita_id);
CREATE INDEX IF NOT EXISTS idx_reservas_solicitante ON RESERVAS_RECURSOS(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_inicio ON RESERVAS_RECURSOS(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_fin ON RESERVAS_RECURSOS(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON RESERVAS_RECURSOS(estado_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_tipo ON RESERVAS_RECURSOS(tipo_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_prioridad ON RESERVAS_RECURSOS(prioridad);
CREATE INDEX IF NOT EXISTS idx_reservas_activo ON RESERVAS_RECURSOS(activo);
CREATE INDEX IF NOT EXISTS idx_reservas_numero ON RESERVAS_RECURSOS(numero_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_recurso_fecha ON RESERVAS_RECURSOS(recurso_id, fecha_inicio, fecha_fin);

-- =====================================================
-- TABLA: DISPONIBILIDAD_RECURSOS
-- =====================================================
CREATE TABLE IF NOT EXISTS DISPONIBILIDAD_RECURSOS (
    id SERIAL PRIMARY KEY,
    
    -- Información del recurso
    recurso_id INTEGER NOT NULL,
    
    -- Configuración de disponibilidad
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    
    -- Configuración específica
    capacidad_disponible INTEGER DEFAULT 1,
    requiere_reserva_previa BOOLEAN DEFAULT TRUE,
    tiempo_minimo_reserva INTEGER DEFAULT 60,
    
    -- Vigencia
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia DATE NULL,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Excepciones
    excepciones JSONB,
    
    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(recurso_id, dia_semana, fecha_inicio_vigencia)
);

-- Índices para DISPONIBILIDAD_RECURSOS
CREATE INDEX IF NOT EXISTS idx_disponibilidad_recurso ON DISPONIBILIDAD_RECURSOS(recurso_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_dia ON DISPONIBILIDAD_RECURSOS(dia_semana);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_vigencia ON DISPONIBILIDAD_RECURSOS(fecha_inicio_vigencia, fecha_fin_vigencia);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_activo ON DISPONIBILIDAD_RECURSOS(activo);

-- =====================================================
-- CLAVES FORÁNEAS
-- =====================================================

-- RECURSOS
ALTER TABLE RECURSOS 
ADD CONSTRAINT fk_recursos_responsable 
FOREIGN KEY (responsable_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RECURSOS 
ADD CONSTRAINT fk_recursos_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RECURSOS 
ADD CONSTRAINT fk_recursos_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- RESERVAS_RECURSOS
ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_recurso 
FOREIGN KEY (recurso_id) REFERENCES RECURSOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_cita 
FOREIGN KEY (cita_id) REFERENCES CITAS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_solicitante 
FOREIGN KEY (solicitante_id) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_confirmado_por 
FOREIGN KEY (confirmado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_cancelado_por 
FOREIGN KEY (cancelado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE RESERVAS_RECURSOS 
ADD CONSTRAINT fk_reservas_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- DISPONIBILIDAD_RECURSOS
ALTER TABLE DISPONIBILIDAD_RECURSOS 
ADD CONSTRAINT fk_disponibilidad_recurso 
FOREIGN KEY (recurso_id) REFERENCES RECURSOS(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE DISPONIBILIDAD_RECURSOS 
ADD CONSTRAINT fk_disponibilidad_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TRIGGERS PARA ACTUALIZAR fecha_modificacion
-- =====================================================

-- Trigger para RECURSOS
CREATE TRIGGER tr_recursos_update_fecha_modificacion
    BEFORE UPDATE ON RECURSOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- Trigger para RESERVAS_RECURSOS
CREATE TRIGGER tr_reservas_update_fecha_modificacion
    BEFORE UPDATE ON RESERVAS_RECURSOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

-- =====================================================
-- FUNCIÓN PARA GENERAR NÚMERO DE RESERVA
-- =====================================================
CREATE OR REPLACE FUNCTION generar_numero_reserva()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_reserva IS NULL OR NEW.numero_reserva = '' THEN
        NEW.numero_reserva = 'RES-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                           LPAD(NEXTVAL('reservas_recursos_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de reserva automáticamente
CREATE TRIGGER tr_generar_numero_reserva
    BEFORE INSERT ON RESERVAS_RECURSOS
    FOR EACH ROW
    EXECUTE FUNCTION generar_numero_reserva();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de recursos con información completa
CREATE OR REPLACE VIEW v_recursos_completos AS
SELECT 
    r.id,
    r.nombre,
    r.descripcion,
    r.codigo_interno,
    r.tipo_recurso,
    r.categoria,
    r.ubicacion,
    r.capacidad_maxima,
    r.capacidad_actual,
    r.estado_recurso,
    CONCAT(u.nombres, ' ', u.apellidos) as responsable_nombre,
    r.fecha_proximo_mantenimiento,
    r.activo,
    COUNT(rr.id) as total_reservas_activas
FROM RECURSOS r
LEFT JOIN USUARIOS u ON r.responsable_id = u.id
LEFT JOIN RESERVAS_RECURSOS rr ON r.id = rr.recurso_id 
    AND rr.estado_reserva IN ('SOLICITADA', 'CONFIRMADA', 'EN_USO')
    AND rr.activo = TRUE
WHERE r.activo = TRUE
GROUP BY r.id, u.nombres, u.apellidos;

-- Vista de reservas con información completa
CREATE OR REPLACE VIEW v_reservas_completas AS
SELECT 
    rr.id,
    rr.numero_reserva,
    r.nombre as recurso_nombre,
    r.tipo_recurso,
    r.ubicacion,
    rr.fecha_inicio,
    rr.fecha_fin,
    rr.duracion_minutos,
    rr.estado_reserva,
    rr.tipo_reserva,
    rr.prioridad,
    CONCAT(u1.nombres, ' ', u1.apellidos) as solicitante_nombre,
    CONCAT(u2.nombres, ' ', u2.apellidos) as confirmado_por_nombre,
    c.numero_cita,
    rr.motivo_reserva,
    rr.observaciones,
    rr.activo
FROM RESERVAS_RECURSOS rr
JOIN RECURSOS r ON rr.recurso_id = r.id
JOIN USUARIOS u1 ON rr.solicitante_id = u1.id
LEFT JOIN USUARIOS u2 ON rr.confirmado_por = u2.id
LEFT JOIN CITAS c ON rr.cita_id = c.id
WHERE rr.activo = TRUE AND r.activo = TRUE;

-- Vista de disponibilidad de recursos
CREATE OR REPLACE VIEW v_disponibilidad_recursos AS
SELECT 
    r.id as recurso_id,
    r.nombre as recurso_nombre,
    r.tipo_recurso,
    r.ubicacion,
    dr.dia_semana,
    dr.hora_inicio,
    dr.hora_fin,
    dr.capacidad_disponible,
    dr.activo as disponibilidad_activa,
    r.estado_recurso,
    dr.fecha_inicio_vigencia,
    dr.fecha_fin_vigencia
FROM RECURSOS r
JOIN DISPONIBILIDAD_RECURSOS dr ON r.id = dr.recurso_id
WHERE r.activo = TRUE AND dr.activo = TRUE
  AND (dr.fecha_fin_vigencia IS NULL OR dr.fecha_fin_vigencia >= CURRENT_DATE);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa:

1. TABLA RECURSOS:
   - Gestión completa de recursos (salas, equipos, personal)
   - Categorización flexible por tipo y ubicación
   - Control de capacidad y disponibilidad
   - Configuración de reservas y costos
   - Seguimiento de mantenimiento
   - Soft delete con campo 'activo'

2. TABLA RESERVAS_RECURSOS:
   - Gestión de reservas de recursos
   - Integración con sistema de citas
   - Control de estados y prioridades
   - Seguimiento de uso real vs programado
   - Facturación y costos
   - Soft delete con campo 'activo'

3. TABLA DISPONIBILIDAD_RECURSOS:
   - Configuración de horarios de disponibilidad
   - Gestión por días de la semana
   - Vigencia temporal de configuraciones
   - Excepciones específicas

4. FUNCIONALIDADES ADICIONALES:
   - Generación automática de números de reserva
   - Triggers para mantener fechas actualizadas
   - Vistas útiles para consultas frecuentes
   - Validaciones de integridad de datos

5. ÍNDICES OPTIMIZADOS:
   - Consultas de disponibilidad
   - Búsquedas por tipo y ubicación
   - Rendimiento en consultas de reservas
*/