-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Schema: Waitlist Automation System (PostgreSQL)
-- Descripción: Tablas para automatización de lista de espera
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- =====================================================
-- TABLA: SLOTS_PENDIENTES_PROCESAMIENTO
-- =====================================================
CREATE TABLE IF NOT EXISTS SLOTS_PENDIENTES_PROCESAMIENTO (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información del slot disponible
    tipo VARCHAR(50) NOT NULL, -- Tipo de oportunidad: CITA_CANCELADA, CITA_REPROGRAMADA, NUEVO_HORARIO, SLOT_LIBERADO
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    duracion_minutos INTEGER NOT NULL,
    
    -- Información del proveedor y recursos
    medico_id INTEGER,
    tipo_cita VARCHAR(50),
    especialidad VARCHAR(100),
    sala VARCHAR(100),
    recursos_adicionales JSONB,
    
    -- Prioridad y origen
    prioridad_slot INTEGER DEFAULT 5, -- Prioridad del slot (1-10, 10 más prioritario)
    cita_origen_id INTEGER,
    motivo_disponibilidad TEXT,
    
    -- Fechas de control
    fecha_detectado TIMESTAMP NOT NULL,
    fecha_disponible_desde TIMESTAMP,
    fecha_expiracion TIMESTAMP,
    
    -- Estado de procesamiento
    procesado BOOLEAN DEFAULT FALSE,
    fecha_procesamiento TIMESTAMP,
    resultado_procesamiento JSONB,
    notificaciones_enviadas INTEGER DEFAULT 0,
    
    -- Información de detección automática
    detectado_automaticamente BOOLEAN DEFAULT TRUE,
    algoritmo_deteccion VARCHAR(100),
    confianza_deteccion DECIMAL(3,2) DEFAULT 1.00, -- Confianza en la detección (0.00-1.00)
    
    -- Campos de auditoría
    creado_por_sistema BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_slots_pendientes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_slots_pendientes
    BEFORE UPDATE ON SLOTS_PENDIENTES_PROCESAMIENTO
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_slots_pendientes();

-- Índices para rendimiento
CREATE UNIQUE INDEX uk_slot_unico ON SLOTS_PENDIENTES_PROCESAMIENTO(tipo, fecha, hora_inicio, medico_id, fecha_detectado);
CREATE INDEX idx_pendientes_procesamiento ON SLOTS_PENDIENTES_PROCESAMIENTO(procesado, fecha, prioridad_slot DESC);
CREATE INDEX idx_fecha_slot ON SLOTS_PENDIENTES_PROCESAMIENTO(fecha, hora_inicio);
CREATE INDEX idx_medico_fecha ON SLOTS_PENDIENTES_PROCESAMIENTO(medico_id, fecha);
CREATE INDEX idx_tipo_cita ON SLOTS_PENDIENTES_PROCESAMIENTO(tipo_cita, especialidad);
CREATE INDEX idx_limpieza ON SLOTS_PENDIENTES_PROCESAMIENTO(procesado, fecha_procesamiento);
CREATE INDEX idx_expiracion ON SLOTS_PENDIENTES_PROCESAMIENTO(fecha_expiracion);
CREATE INDEX idx_prioridad ON SLOTS_PENDIENTES_PROCESAMIENTO(prioridad_slot DESC, fecha_detectado);

-- Claves foráneas
ALTER TABLE SLOTS_PENDIENTES_PROCESAMIENTO 
ADD CONSTRAINT fk_slots_medico 
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE SLOTS_PENDIENTES_PROCESAMIENTO 
ADD CONSTRAINT fk_slots_cita_origen 
FOREIGN KEY (cita_origen_id) REFERENCES CITAS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- TABLA: METRICAS_AUTOMATIZACION_WAITLIST
-- =====================================================
CREATE TABLE IF NOT EXISTS METRICAS_AUTOMATIZACION_WAITLIST (
    id BIGSERIAL PRIMARY KEY,
    
    -- Información temporal
    fecha_reporte DATE NOT NULL,
    hora_reporte TIME NOT NULL,
    periodo_inicio TIMESTAMP NOT NULL,
    periodo_fin TIMESTAMP NOT NULL,
    
    -- Métricas de detección
    slots_detectados INTEGER DEFAULT 0,
    slots_por_tipo JSONB,
    slots_procesados INTEGER DEFAULT 0,
    slots_expirados INTEGER DEFAULT 0,
    
    -- Métricas de notificaciones
    notificaciones_enviadas INTEGER DEFAULT 0,
    notificaciones_entregadas INTEGER DEFAULT 0,
    notificaciones_respondidas INTEGER DEFAULT 0,
    notificaciones_fallidas INTEGER DEFAULT 0,
    
    -- Métricas de conversión
    conversiones_exitosas INTEGER DEFAULT 0,
    conversiones_rechazadas INTEGER DEFAULT 0,
    solicitudes_alternativas INTEGER DEFAULT 0,
    
    -- Métricas de rendimiento
    tiempo_promedio_deteccion_ms INTEGER DEFAULT 0,
    tiempo_promedio_procesamiento_ms INTEGER DEFAULT 0,
    tiempo_promedio_respuesta_paciente_min INTEGER DEFAULT 0,
    
    -- Métricas de calidad
    precision_deteccion DECIMAL(5,4) DEFAULT 0.0000, -- Precisión de la detección (slots válidos/total)
    tasa_conversion DECIMAL(5,4) DEFAULT 0.0000, -- Tasa de conversión (conversiones/notificaciones)
    tasa_respuesta DECIMAL(5,4) DEFAULT 0.0000, -- Tasa de respuesta (respuestas/notificaciones)
    
    -- Información del sistema
    version_algoritmo VARCHAR(50),
    configuracion_activa JSONB,
    errores_reportados INTEGER DEFAULT 0,
    detalles_errores JSONB,
    
    -- Campos de auditoría
    generado_automaticamente BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_fecha_reporte ON METRICAS_AUTOMATIZACION_WAITLIST(fecha_reporte, hora_reporte);
CREATE INDEX idx_periodo ON METRICAS_AUTOMATIZACION_WAITLIST(periodo_inicio, periodo_fin);
CREATE INDEX idx_metricas_conversion ON METRICAS_AUTOMATIZACION_WAITLIST(tasa_conversion, fecha_reporte);
CREATE INDEX idx_metricas_calidad ON METRICAS_AUTOMATIZACION_WAITLIST(precision_deteccion, tasa_respuesta);

-- =====================================================
-- TABLA: CONFIGURACION_AUTOMATIZACION_WAITLIST
-- =====================================================
CREATE TABLE IF NOT EXISTS CONFIGURACION_AUTOMATIZACION_WAITLIST (
    id SERIAL PRIMARY KEY,
    
    -- Información básica
    nombre_configuracion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    activo BOOLEAN DEFAULT TRUE,
    
    -- Configuración de intervalos
    intervalo_deteccion_minutos INTEGER DEFAULT 15,
    intervalo_procesamiento_minutos INTEGER DEFAULT 30,
    intervalo_limpieza_horas INTEGER DEFAULT 1,
    
    -- Límites de procesamiento
    max_oportunidades_por_ciclo INTEGER DEFAULT 20,
    max_notificaciones_por_hora INTEGER DEFAULT 50,
    max_reintentos_notificacion INTEGER DEFAULT 3,
    
    -- Horarios de operación
    horario_inicio TIME DEFAULT '08:00:00',
    horario_fin TIME DEFAULT '18:00:00',
    dias_operacion JSONB DEFAULT '[1,2,3,4,5]', -- Días de operación (1=Lunes, 7=Domingo)
    zona_horaria VARCHAR(50) DEFAULT 'America/Mexico_City',
    
    -- Configuración de algoritmos
    algoritmos_deteccion_activos JSONB,
    parametros_algoritmos JSONB,
    umbral_confianza_minimo DECIMAL(3,2) DEFAULT 0.80,
    
    -- Configuración de notificaciones
    metodos_notificacion_permitidos JSONB DEFAULT '["EMAIL","SMS"]',
    plantillas_notificacion JSONB,
    tiempo_expiracion_horas INTEGER DEFAULT 24,
    
    -- Configuración de limpieza
    dias_retencion_slots_procesados INTEGER DEFAULT 7,
    dias_retencion_metricas INTEGER DEFAULT 90,
    limpiar_notificaciones_expiradas BOOLEAN DEFAULT TRUE,
    
    -- Configuración de monitoreo
    habilitar_metricas_detalladas BOOLEAN DEFAULT TRUE,
    frecuencia_reporte_metricas INTEGER DEFAULT 60,
    alertas_errores_activas BOOLEAN DEFAULT TRUE,
    
    -- Configuración de seguridad
    requiere_aprobacion_manual BOOLEAN DEFAULT FALSE,
    usuarios_autorizados_aprobacion JSONB,
    log_todas_las_acciones BOOLEAN DEFAULT TRUE,
    
    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_activacion TIMESTAMP,
    fecha_desactivacion TIMESTAMP
);

-- Trigger para actualizar fecha_modificacion
CREATE OR REPLACE FUNCTION update_fecha_modificacion_configuracion_automatizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fecha_modificacion_configuracion_automatizacion
    BEFORE UPDATE ON CONFIGURACION_AUTOMATIZACION_WAITLIST
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion_configuracion_automatizacion();

-- Índices
CREATE INDEX idx_configuracion_activa ON CONFIGURACION_AUTOMATIZACION_WAITLIST(activo, fecha_activacion);
CREATE INDEX idx_version ON CONFIGURACION_AUTOMATIZACION_WAITLIST(version, fecha_creacion);

-- Claves foráneas
ALTER TABLE CONFIGURACION_AUTOMATIZACION_WAITLIST 
ADD CONSTRAINT fk_config_automatizacion_creado_por 
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE CONFIGURACION_AUTOMATIZACION_WAITLIST 
ADD CONSTRAINT fk_config_automatizacion_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de slots pendientes con información completa
CREATE OR REPLACE VIEW v_slots_pendientes_completos AS
SELECT 
    sp.*,
    CONCAT(u.nombres, ' ', u.apellidos) as medico_nombre,
    u.especialidad as medico_especialidad,
    c.motivo as cita_origen_motivo,
    c.estado as cita_origen_estado,
    CASE 
        WHEN sp.fecha_expiracion IS NOT NULL AND sp.fecha_expiracion < NOW() THEN 'EXPIRADO'
        WHEN sp.procesado = TRUE THEN 'PROCESADO'
        ELSE 'PENDIENTE'
    END as estado_actual,
    EXTRACT(EPOCH FROM (NOW() - sp.fecha_detectado))/60 as minutos_desde_deteccion
FROM SLOTS_PENDIENTES_PROCESAMIENTO sp
LEFT JOIN USUARIOS u ON sp.medico_id = u.id
LEFT JOIN CITAS c ON sp.cita_origen_id = c.id
WHERE sp.fecha >= CURRENT_DATE;

-- Vista de métricas diarias resumidas
CREATE OR REPLACE VIEW v_metricas_diarias_waitlist AS
SELECT 
    fecha_reporte,
    SUM(slots_detectados) as total_slots_detectados,
    SUM(slots_procesados) as total_slots_procesados,
    SUM(notificaciones_enviadas) as total_notificaciones_enviadas,
    SUM(conversiones_exitosas) as total_conversiones,
    AVG(tasa_conversion) as tasa_conversion_promedio,
    AVG(tasa_respuesta) as tasa_respuesta_promedio,
    AVG(precision_deteccion) as precision_promedio,
    COUNT(*) as reportes_generados
FROM METRICAS_AUTOMATIZACION_WAITLIST
GROUP BY fecha_reporte
ORDER BY fecha_reporte DESC;

-- Vista de rendimiento del sistema
CREATE OR REPLACE VIEW v_rendimiento_automatizacion AS
SELECT 
    DATE(periodo_inicio) as fecha,
    AVG(tiempo_promedio_deteccion_ms) as deteccion_ms_promedio,
    AVG(tiempo_promedio_procesamiento_ms) as procesamiento_ms_promedio,
    AVG(tiempo_promedio_respuesta_paciente_min) as respuesta_paciente_min_promedio,
    SUM(errores_reportados) as total_errores,
    AVG(precision_deteccion) as precision_promedio,
    COUNT(*) as ciclos_ejecutados
FROM METRICAS_AUTOMATIZACION_WAITLIST
WHERE fecha_reporte >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(periodo_inicio)
ORDER BY fecha DESC;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar configuración por defecto
INSERT INTO CONFIGURACION_AUTOMATIZACION_WAITLIST (
    nombre_configuracion, descripcion, version,
    intervalo_deteccion_minutos, intervalo_procesamiento_minutos,
    max_oportunidades_por_ciclo, max_notificaciones_por_hora,
    horario_inicio, horario_fin, dias_operacion,
    algoritmos_deteccion_activos, metodos_notificacion_permitidos,
    tiempo_expiracion_horas, umbral_confianza_minimo,
    creado_por, fecha_creacion
) VALUES (
    'Configuración por defecto', 
    'Configuración inicial del sistema de automatización de lista de espera',
    '1.0',
    15, 30,
    20, 50,
    '08:00:00', '18:00:00', '[1,2,3,4,5]',
    '["CITAS_CANCELADAS", "CITAS_REPROGRAMADAS", "NUEVOS_HORARIOS"]',
    '["EMAIL", "SMS"]',
    24, 0.80,
    1, NOW()
) ON CONFLICT DO NOTHING;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================
/*
Este schema implementa el sistema de automatización para lista de espera:

1. TABLA SLOTS_PENDIENTES_PROCESAMIENTO:
   - Almacena slots detectados pendientes de procesamiento
   - Evita procesar el mismo slot múltiples veces
   - Incluye información de prioridad y origen
   - Rastrea el estado de procesamiento

2. TABLA METRICAS_AUTOMATIZACION_WAITLIST:
   - Almacena métricas detalladas del sistema
   - Permite análisis de rendimiento y calidad
   - Facilita la optimización de algoritmos
   - Proporciona datos para reportes

3. TABLA CONFIGURACION_AUTOMATIZACION_WAITLIST:
   - Configuración flexible del sistema
   - Parámetros de intervalos y límites
   - Configuración de horarios de operación
   - Configuración de algoritmos y notificaciones

4. VISTAS:
   - Vista completa de slots pendientes
   - Métricas diarias resumidas
   - Rendimiento del sistema

5. CARACTERÍSTICAS CLAVE:
   - Prevención de duplicados
   - Métricas de calidad y rendimiento
   - Configuración flexible
   - Limpieza automática de datos antiguos
   - Auditoría completa de acciones

Conversiones PostgreSQL aplicadas:
- AUTO_INCREMENT → SERIAL/BIGSERIAL
- JSON → JSONB para mejor rendimiento
- TIMESTAMPDIFF(MINUTE, ...) → EXTRACT(EPOCH FROM (...))/60
- Triggers para fecha_modificacion automática
- ON DUPLICATE KEY UPDATE → ON CONFLICT DO NOTHING
- DATE_SUB(CURDATE(), INTERVAL 30 DAY) → CURRENT_DATE - INTERVAL '30 days'
- CURDATE() → CURRENT_DATE
- NOW() → CURRENT_TIMESTAMP
*/