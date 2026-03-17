-- =====================================================
-- EcoDigital - Functions and Triggers Migration
-- Versión: 1.0
-- Descripción: Implementa todas las funciones y triggers
--              especificados en base-datos.md
-- =====================================================

\echo '========================================'
\echo 'EcoDigital - Functions and Triggers'
\echo '========================================'

-- =====================================================
-- 1. FUNCIÓN: update_fecha_modificacion
-- =====================================================
\echo ''
\echo '1. Creando función update_fecha_modificacion...'

CREATE OR REPLACE FUNCTION update_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función update_fecha_modificacion creada/actualizada'

-- =====================================================
-- 2. FUNCIÓN: calcular_imc
-- =====================================================
\echo ''
\echo '2. Creando función calcular_imc...'

CREATE OR REPLACE FUNCTION calcular_imc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.peso IS NOT NULL AND NEW.altura IS NOT NULL AND NEW.altura > 0 THEN
        NEW.imc = NEW.peso / POWER(NEW.altura / 100, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función calcular_imc creada/actualizada'

-- =====================================================
-- 3. FUNCIÓN: validar_conflicto_citas
-- =====================================================
\echo ''
\echo '3. Creando función validar_conflicto_citas...'

CREATE OR REPLACE FUNCTION validar_conflicto_citas()
RETURNS TRIGGER AS $$
DECLARE
    conflictos INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO conflictos
    FROM CITAS
    WHERE medico_id = NEW.medico_id
    AND activo = TRUE
    AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
    AND id != COALESCE(NEW.id, 0)
    AND (
        (NEW.fecha_hora BETWEEN fecha_hora AND fecha_hora_fin) OR
        (NEW.fecha_hora + INTERVAL '1 minute' * NEW.duracion_minutos
            BETWEEN fecha_hora AND fecha_hora_fin) OR
        (fecha_hora BETWEEN NEW.fecha_hora AND
            NEW.fecha_hora + INTERVAL '1 minute' * NEW.duracion_minutos)
    );

    IF conflictos > 0 THEN
        RAISE EXCEPTION 'Conflicto de horario: El médico ya tiene una cita programada';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función validar_conflicto_citas creada/actualizada'

-- =====================================================
-- 4. FUNCIÓN: generar_numero_cita
-- =====================================================
\echo ''
\echo '4. Creando función generar_numero_cita...'

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

\echo '✓ Función generar_numero_cita creada/actualizada'

-- =====================================================
-- 5. FUNCIÓN: actualizar_fechas_consulta_paciente
-- =====================================================
\echo ''
\echo '5. Creando función actualizar_fechas_consulta_paciente...'

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

\echo '✓ Función actualizar_fechas_consulta_paciente creada/actualizada'

-- =====================================================
-- 6. FUNCIÓN: sp_crear_log_auditoria
-- =====================================================
\echo ''
\echo '6. Creando función sp_crear_log_auditoria...'

CREATE OR REPLACE FUNCTION sp_crear_log_auditoria(
    p_evento_id UUID DEFAULT NULL,
    p_tipo_evento VARCHAR(50) DEFAULT NULL,
    p_categoria VARCHAR(50) DEFAULT NULL,
    p_nivel_criticidad VARCHAR(10) DEFAULT 'MEDIO',
    p_usuario_id INTEGER DEFAULT NULL,
    p_username VARCHAR(50) DEFAULT NULL,
    p_rol_usuario VARCHAR(50) DEFAULT NULL,
    p_sesion_id VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_modulo VARCHAR(50) DEFAULT NULL,
    p_accion VARCHAR(50) DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_recurso_tipo VARCHAR(50) DEFAULT NULL,
    p_recurso_id VARCHAR(36) DEFAULT NULL,
    p_datos_antes JSONB DEFAULT NULL,
    p_datos_despues JSONB DEFAULT NULL,
    p_resultado VARCHAR(20) DEFAULT 'EXITOSO',
    p_duracion_ms INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO LOGS_AUDITORIA (
        evento_id, tipo_evento, categoria, nivel_criticidad,
        usuario_id, username, rol_usuario, sesion_id,
        ip_address, user_agent, modulo, accion, descripcion,
        recurso_tipo, recurso_id, datos_antes, datos_despues,
        resultado, duracion_ms, requiere_retencion
    ) VALUES (
        COALESCE(p_evento_id, gen_random_uuid()),
        p_tipo_evento, p_categoria, p_nivel_criticidad,
        p_usuario_id, p_username, p_rol_usuario, p_sesion_id,
        p_ip_address, p_user_agent, p_modulo, p_accion, p_descripcion,
        p_recurso_tipo, p_recurso_id, p_datos_antes, p_datos_despues,
        p_resultado, p_duracion_ms, TRUE
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función sp_crear_log_auditoria creada/actualizada'

-- =====================================================
-- 7. FUNCIONES WORM (Inmutabilidad de logs)
-- =====================================================
\echo ''
\echo '7. Creando funciones WORM para logs...'

-- Función para prevenir actualizaciones en logs
CREATE OR REPLACE FUNCTION prevent_logs_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser modificados';
END;
$$ LANGUAGE plpgsql;

-- Función para prevenir eliminaciones en logs
CREATE OR REPLACE FUNCTION prevent_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser eliminados';
END;
$$ LANGUAGE plpgsql;

-- Función para generar hash de integridad
CREATE OR REPLACE FUNCTION generate_log_integrity()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_numero_secuencia BIGINT DEFAULT 0;
    ultimo_hash VARCHAR(64) DEFAULT '';
    datos_hash TEXT;
BEGIN
    -- Obtener último número de secuencia y hash
    SELECT COALESCE(MAX(numero_secuencia), 0), COALESCE(MAX(hash_integridad), '')
    INTO ultimo_numero_secuencia, ultimo_hash
    FROM LOGS_AUDITORIA;
    
    -- Asignar número de secuencia
    NEW.numero_secuencia = ultimo_numero_secuencia + 1;
    NEW.hash_anterior = ultimo_hash;
    
    -- Preparar datos para hash
    datos_hash = CONCAT(
        COALESCE(NEW.evento_id::TEXT, ''), '|',
        COALESCE(NEW.tipo_evento, ''), '|',
        COALESCE(NEW.categoria, ''), '|',
        COALESCE(NEW.usuario_id::TEXT, ''), '|',
        COALESCE(NEW.modulo, ''), '|',
        COALESCE(NEW.accion, ''), '|',
        COALESCE(NEW.descripcion, ''), '|',
        COALESCE(NEW.fecha_evento::TEXT, ''), '|',
        COALESCE(NEW.numero_secuencia::TEXT, ''), '|',
        COALESCE(NEW.hash_anterior, '')
    );
    
    -- Generar hash de integridad
    NEW.hash_integridad = encode(digest(datos_hash, 'sha256'), 'hex');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Funciones WORM creadas/actualizadas'

-- =====================================================
-- 8. FUNCIÓN: sp_verificar_integridad_logs
-- =====================================================
\echo ''
\echo '8. Creando función sp_verificar_integridad_logs...'

CREATE OR REPLACE FUNCTION sp_verificar_integridad_logs(
    p_fecha_desde DATE,
    p_fecha_hasta DATE,
    OUT p_total_logs INTEGER,
    OUT p_logs_validos INTEGER,
    OUT p_logs_invalidos INTEGER
)
AS $$
DECLARE
    rec RECORD;
    v_hash_calculado VARCHAR(64);
    datos_hash TEXT;
BEGIN
    p_total_logs := 0;
    p_logs_validos := 0;
    p_logs_invalidos := 0;
    
    FOR rec IN
        SELECT id, hash_integridad, evento_id, tipo_evento, categoria, usuario_id,
               modulo, accion, descripcion, fecha_evento, numero_secuencia, hash_anterior
        FROM LOGS_AUDITORIA
        WHERE DATE(fecha_evento) BETWEEN p_fecha_desde AND p_fecha_hasta
        ORDER BY numero_secuencia
    LOOP
        p_total_logs := p_total_logs + 1;
        
        datos_hash := CONCAT(
            COALESCE(rec.evento_id::TEXT, ''), '|',
            COALESCE(rec.tipo_evento, ''), '|',
            COALESCE(rec.categoria, ''), '|',
            COALESCE(rec.usuario_id::TEXT, ''), '|',
            COALESCE(rec.modulo, ''), '|',
            COALESCE(rec.accion, ''), '|',
            COALESCE(rec.descripcion, ''), '|',
            COALESCE(rec.fecha_evento::TEXT, ''), '|',
            COALESCE(rec.numero_secuencia::TEXT, ''), '|',
            COALESCE(rec.hash_anterior, '')
        );
        
        v_hash_calculado := encode(digest(datos_hash, 'sha256'), 'hex');
        
        IF v_hash_calculado = rec.hash_integridad THEN
            p_logs_validos := p_logs_validos + 1;
        ELSE
            p_logs_invalidos := p_logs_invalidos + 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función sp_verificar_integridad_logs creada/actualizada'

-- =====================================================
-- 9. TRIGGERS: Actualizar fecha_modificacion
-- =====================================================
\echo ''
\echo '9. Creando triggers para actualizar fecha_modificacion...'

-- USUARIOS
DROP TRIGGER IF EXISTS tr_usuarios_update_fecha_modificacion ON USUARIOS;
CREATE TRIGGER tr_usuarios_update_fecha_modificacion
    BEFORE UPDATE ON USUARIOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_usuarios_update_fecha_modificacion creado'

-- ROLES
DROP TRIGGER IF EXISTS tr_roles_update_fecha_modificacion ON ROLES;
CREATE TRIGGER tr_roles_update_fecha_modificacion
    BEFORE UPDATE ON ROLES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_roles_update_fecha_modificacion creado'

-- PACIENTES
DROP TRIGGER IF EXISTS tr_pacientes_update_fecha_modificacion ON PACIENTES;
CREATE TRIGGER tr_pacientes_update_fecha_modificacion
    BEFORE UPDATE ON PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_pacientes_update_fecha_modificacion creado'

-- CITAS
DROP TRIGGER IF EXISTS tr_citas_update_fecha_modificacion ON CITAS;
CREATE TRIGGER tr_citas_update_fecha_modificacion
    BEFORE UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_citas_update_fecha_modificacion creado'

-- HISTORIAL_CLINICO
DROP TRIGGER IF EXISTS tr_historial_update_fecha_modificacion ON HISTORIAL_CLINICO;
CREATE TRIGGER tr_historial_update_fecha_modificacion
    BEFORE UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_historial_update_fecha_modificacion creado'

-- DOCUMENTOS
DROP TRIGGER IF EXISTS tr_documentos_update_fecha_modificacion ON DOCUMENTOS;
CREATE TRIGGER tr_documentos_update_fecha_modificacion
    BEFORE UPDATE ON DOCUMENTOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_documentos_update_fecha_modificacion creado'

-- =====================================================
-- 10. TRIGGERS: Cálculo de IMC
-- =====================================================
\echo ''
\echo '10. Creando triggers para cálculo de IMC...'

DROP TRIGGER IF EXISTS tr_historial_calcular_imc ON HISTORIAL_CLINICO;
CREATE TRIGGER tr_historial_calcular_imc
    BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION calcular_imc();
\echo '✓ Trigger tr_historial_calcular_imc creado'

-- =====================================================
-- 11. TRIGGERS: Actualizar fechas de consulta en pacientes
-- =====================================================
\echo ''
\echo '11. Creando triggers para actualizar fechas de consulta...'

DROP TRIGGER IF EXISTS tr_actualizar_fechas_consulta ON HISTORIAL_CLINICO;
CREATE TRIGGER tr_actualizar_fechas_consulta
    AFTER INSERT ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fechas_consulta_paciente();
\echo '✓ Trigger tr_actualizar_fechas_consulta creado'

-- =====================================================
-- 12. TRIGGERS: Validar conflictos de citas
-- =====================================================
\echo ''
\echo '12. Creando triggers para validar conflictos de citas...'

DROP TRIGGER IF EXISTS tr_validar_conflicto_citas ON CITAS;
CREATE TRIGGER tr_validar_conflicto_citas
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION validar_conflicto_citas();
\echo '✓ Trigger tr_validar_conflicto_citas creado'

-- =====================================================
-- 13. TRIGGERS: Generar número de cita
-- =====================================================
\echo ''
\echo '13. Creando triggers para generar número de cita...'

DROP TRIGGER IF EXISTS tr_generar_numero_cita ON CITAS;
CREATE TRIGGER tr_generar_numero_cita
    BEFORE INSERT ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION generar_numero_cita();
\echo '✓ Trigger tr_generar_numero_cita creado'

-- =====================================================
-- 14. TRIGGERS WORM: Prevenir modificaciones en logs
-- =====================================================
\echo ''
\echo '14. Creando triggers WORM para logs de auditoría...'

-- Prevenir actualizaciones
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_update ON LOGS_AUDITORIA;
CREATE TRIGGER tr_logs_auditoria_prevent_update
    BEFORE UPDATE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_update();
\echo '✓ Trigger tr_logs_auditoria_prevent_update creado'

-- Prevenir eliminaciones
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_delete ON LOGS_AUDITORIA;
CREATE TRIGGER tr_logs_auditoria_prevent_delete
    BEFORE DELETE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_delete();
\echo '✓ Trigger tr_logs_auditoria_prevent_delete creado'

-- Generar hash de integridad
DROP TRIGGER IF EXISTS tr_logs_auditoria_before_insert ON LOGS_AUDITORIA;
CREATE TRIGGER tr_logs_auditoria_before_insert
    BEFORE INSERT ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION generate_log_integrity();
\echo '✓ Trigger tr_logs_auditoria_before_insert creado'

-- =====================================================
-- 15. TRIGGERS ADICIONALES: Reportes y Alertas
-- =====================================================
\echo ''
\echo '15. Creando triggers adicionales...'

-- REPORTES_PROGRAMADOS
DROP TRIGGER IF EXISTS tr_reportes_update_fecha_modificacion ON REPORTES_PROGRAMADOS;
CREATE TRIGGER tr_reportes_update_fecha_modificacion
    BEFORE UPDATE ON REPORTES_PROGRAMADOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_reportes_update_fecha_modificacion creado'

-- PLANTILLAS_REPORTES
DROP TRIGGER IF EXISTS tr_plantillas_update_fecha_modificacion ON PLANTILLAS_REPORTES;
CREATE TRIGGER tr_plantillas_update_fecha_modificacion
    BEFORE UPDATE ON PLANTILLAS_REPORTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_plantillas_update_fecha_modificacion creado'

-- ALERTAS_AUDITORIA
DROP TRIGGER IF EXISTS tr_alertas_update_fecha_modificacion ON ALERTAS_AUDITORIA;
CREATE TRIGGER tr_alertas_update_fecha_modificacion
    BEFORE UPDATE ON ALERTAS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
\echo '✓ Trigger tr_alertas_update_fecha_modificacion creado'

\echo ''
\echo '========================================'
\echo 'Functions and Triggers Migration Completado'
\echo '========================================'