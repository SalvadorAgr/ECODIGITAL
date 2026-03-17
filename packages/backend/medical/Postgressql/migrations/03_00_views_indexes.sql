-- =====================================================
-- EcoDigital - Views and Indexes Migration
-- Versión: 1.0
-- Descripción: Implementa todas las vistas e índices
--              especificados en base-datos.md
-- =====================================================

\echo '========================================'
\echo 'EcoDigital - Views and Indexes Migration'
\echo '========================================'

-- =====================================================
-- 1. VISTAS DE USUARIOS
-- =====================================================
\echo ''
\echo '1. Creando vistas de usuarios...'

-- Vista de usuarios completo
CREATE OR REPLACE VIEW v_usuarios_completo AS
SELECT
    u.id,
    u.username,
    u.email,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    u.telefono,
    u.cedula,
    u.titulo_profesional,
    u.especialidad,
    u.numero_colegiado,
    r.nombre as rol_nombre,
    r.nivel_acceso,
    u.activo,
    u.verificado,
    u.bloqueado,
    u.fecha_ultimo_acceso,
    u.fecha_creacion,
    (SELECT COUNT(*) FROM SESIONES_USUARIO s WHERE s.usuario_id = u.id AND s.activa = TRUE) as sesiones_activas
FROM USUARIOS u
JOIN ROLES r ON u.rol_id = r.id;

\echo '✓ Vista v_usuarios_completo creada'

-- Vista de sesiones activas
CREATE OR REPLACE VIEW v_sesiones_activas AS
SELECT 
    s.id,
    s.usuario_id,
    u.username,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    s.ip_address,
    s.dispositivo,
    s.fecha_inicio,
    s.fecha_ultimo_uso,
    s.fecha_expiracion,
    EXTRACT(EPOCH FROM (s.fecha_expiracion - CURRENT_TIMESTAMP))/60 as minutos_restantes
FROM SESIONES_USUARIO s
JOIN USUARIOS u ON s.usuario_id = u.id
WHERE s.activa = TRUE AND s.fecha_expiracion > CURRENT_TIMESTAMP;

\echo '✓ Vista v_sesiones_activas creada'

-- =====================================================
-- 2. VISTAS DE PACIENTES
-- =====================================================
\echo ''
\echo '2. Creando vistas de pacientes...'

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
    p.fecha_primera_consulta,
    p.fecha_ultima_consulta,
    (SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente = p.id AND h.activo = TRUE) as total_consultas,
    p.activo,
    p.fecha_creacion
FROM PACIENTES p
WHERE p.activo = TRUE;

\echo '✓ Vista v_pacientes_resumen creada'

-- Vista de pacientes con estadísticas
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

\echo '✓ Vista v_pacientes_estadisticas creada'

-- =====================================================
-- 3. VISTAS DE CITAS
-- =====================================================
\echo ''
\echo '3. Creando vistas de citas...'

-- Vista de citas completas
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

\echo '✓ Vista v_citas_completas creada'

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

\echo '✓ Vista v_disponibilidad_medicos creada'

-- Vista de agenda médica
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

\echo '✓ Vista v_agenda_medicos creada'

-- =====================================================
-- 4. VISTAS DE HISTORIAL CLÍNICO
-- =====================================================
\echo ''
\echo '4. Creando vistas de historial clínico...'

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

\echo '✓ Vista v_historial_completo creada'

-- =====================================================
-- 5. VISTAS DE DOCUMENTOS
-- =====================================================
\echo ''
\echo '5. Creando vistas de documentos...'

-- Vista de documentos de pacientes
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

\echo '✓ Vista v_documentos_pacientes creada'

-- =====================================================
-- 6. VISTAS DE AUDITORÍA
-- =====================================================
\echo ''
\echo '6. Creando vistas de auditoría...'

-- Vista de dashboard de auditoría
CREATE OR REPLACE VIEW v_dashboard_auditoria AS
SELECT 
    DATE(fecha_evento) as fecha,
    categoria,
    tipo_evento,
    nivel_criticidad,
    COUNT(*) as total_eventos,
    COUNT(DISTINCT usuario_id) as usuarios_unicos,
    COUNT(DISTINCT ip_address) as ips_unicas,
    SUM(CASE WHEN resultado = 'FALLIDO' THEN 1 ELSE 0 END) as eventos_fallidos
FROM LOGS_AUDITORIA
WHERE fecha_evento >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(fecha_evento), categoria, tipo_evento, nivel_criticidad;

\echo '✓ Vista v_dashboard_auditoria creada'

-- Vista de eventos de seguridad críticos
CREATE OR REPLACE VIEW v_eventos_seguridad_criticos AS
SELECT 
    l.*,
    u.nombres,
    u.apellidos,
    r.nombre as rol_nombre
FROM LOGS_AUDITORIA l
LEFT JOIN USUARIOS u ON l.usuario_id = u.id
LEFT JOIN ROLES r ON u.rol_id = r.id
WHERE l.nivel_criticidad IN ('ALTO', 'CRITICO')
   OR l.tipo_evento IN ('LOGIN_FALLIDO', 'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO')
ORDER BY l.fecha_evento DESC;

\echo '✓ Vista v_eventos_seguridad_criticos creada'

-- Vista de estadísticas de reportes
CREATE OR REPLACE VIEW v_estadisticas_reportes AS
SELECT 
    rp.tipo_reporte,
    rp.nombre,
    COUNT(er.id) as total_ejecuciones,
    SUM(CASE WHEN er.estado = 'COMPLETADO' THEN 1 ELSE 0 END) as ejecuciones_exitosas,
    SUM(CASE WHEN er.estado = 'FALLIDO' THEN 1 ELSE 0 END) as ejecuciones_fallidas,
    AVG(er.duracion_segundos) as duracion_promedio,
    MAX(er.fecha_solicitud) as ultima_ejecucion
FROM REPORTES_PROGRAMADOS rp
LEFT JOIN EJECUCIONES_REPORTES er ON rp.id = er.reporte_programado_id
WHERE rp.activo = TRUE
GROUP BY rp.id, rp.tipo_reporte, rp.nombre;

\echo '✓ Vista v_estadisticas_reportes creada'

-- =====================================================
-- 7. ÍNDICES DE USUARIOS
-- =====================================================
\echo ''
\echo '7. Creando índices de usuarios...'

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON USUARIOS(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON USUARIOS(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON USUARIOS(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON USUARIOS(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado ON USUARIOS(bloqueado);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON USUARIOS(cedula);
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acceso ON USUARIOS(fecha_ultimo_acceso);

\echo '✓ Índices de usuarios creados'

-- =====================================================
-- 8. ÍNDICES DE PACIENTES
-- =====================================================
\echo ''
\echo '8. Creando índices de pacientes...'

CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON PACIENTES(nombre);
CREATE INDEX IF NOT EXISTS idx_pacientes_apellido ON PACIENTES(apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_cedula ON PACIENTES(cedula);
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_consulta ON PACIENTES(fecha_primera_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_ultima_consulta ON PACIENTES(fecha_ultima_consulta);
CREATE INDEX IF NOT EXISTS idx_pacientes_activo ON PACIENTES(activo);
CREATE INDEX IF NOT EXISTS idx_pacientes_expediente ON PACIENTES(numero_expediente);

\echo '✓ Índices de pacientes creados'

-- =====================================================
-- 9. ÍNDICES DE CITAS
-- =====================================================
\echo ''
\echo '9. Creando índices de citas...'

CREATE INDEX IF NOT EXISTS idx_citas_fecha_hora ON CITAS(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON CITAS(id_paciente);
CREATE INDEX IF NOT EXISTS idx_citas_medico ON CITAS(medico_id);
CREATE INDEX IF NOT EXISTS idx_citas_paciente_fecha ON CITAS(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON CITAS(estado);
CREATE INDEX IF NOT EXISTS idx_citas_tipo ON CITAS(tipo_cita);
CREATE INDEX IF NOT EXISTS idx_citas_numero ON CITAS(numero_cita);
CREATE INDEX IF NOT EXISTS idx_citas_activo ON CITAS(activo);

\echo '✓ Índices de citas creados'

-- =====================================================
-- 10. ÍNDICES DE HISTORIAL
-- =====================================================
\echo ''
\echo '10. Creando índices de historial clínico...'

CREATE INDEX IF NOT EXISTS idx_historial_paciente ON HISTORIAL_CLINICO(id_paciente);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_hora ON HISTORIAL_CLINICO(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_historial_medico ON HISTORIAL_CLINICO(medico_id);
CREATE INDEX IF NOT EXISTS idx_historial_tipo_consulta ON HISTORIAL_CLINICO(tipo_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_estado ON HISTORIAL_CLINICO(estado_consulta);
CREATE INDEX IF NOT EXISTS idx_historial_activo ON HISTORIAL_CLINICO(activo);
CREATE INDEX IF NOT EXISTS idx_historial_urgente ON HISTORIAL_CLINICO(urgente);
CREATE INDEX IF NOT EXISTS idx_historial_seguimiento ON HISTORIAL_CLINICO(requiere_seguimiento);

\echo '✓ Índices de historial creados'

-- =====================================================
-- 11. ÍNDICES DE AUDITORÍA
-- =====================================================
\echo ''
\echo '11. Creando índices de auditoría...'

CREATE INDEX IF NOT EXISTS idx_logs_fecha_evento ON LOGS_AUDITORIA(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_logs_fecha_hora ON LOGS_AUDITORIA(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_fecha ON LOGS_AUDITORIA(usuario_id, fecha_evento);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_categoria ON LOGS_AUDITORIA(tipo_evento, categoria);
CREATE INDEX IF NOT EXISTS idx_logs_modulo_accion ON LOGS_AUDITORIA(modulo, accion);
CREATE INDEX IF NOT EXISTS idx_logs_recurso ON LOGS_AUDITORIA(recurso_tipo, recurso_id);
CREATE INDEX IF NOT EXISTS idx_logs_nivel_criticidad ON LOGS_AUDITORIA(nivel_criticidad);
CREATE INDEX IF NOT EXISTS idx_logs_resultado ON LOGS_AUDITORIA(resultado);
CREATE INDEX IF NOT EXISTS idx_logs_numero_secuencia ON LOGS_AUDITORIA(numero_secuencia);
CREATE INDEX IF NOT EXISTS idx_logs_hash_integridad ON LOGS_AUDITORIA(hash_integridad);

\echo '✓ Índices de auditoría creados'

-- =====================================================
-- 12. ÍNDICES DE DOCUMENTOS
-- =====================================================
\echo ''
\echo '12. Creando índices de documentos...'

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

\echo '✓ Índices de documentos creados'

-- =====================================================
-- 13. ÍNDICES DE SESIONES
-- =====================================================
\echo ''
\echo '13. Creando índices de sesiones...'

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON SESIONES_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON SESIONES_USUARIO(token_sesion);
CREATE INDEX IF NOT EXISTS idx_sesiones_refresh ON SESIONES_USUARIO(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sesiones_activa ON SESIONES_USUARIO(activa);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON SESIONES_USUARIO(fecha_expiracion);

\echo '✓ Índices de sesiones creados'

-- =====================================================
-- 14. ÍNDICES DE ROLES
-- =====================================================
\echo ''
\echo '14. Creando índices de roles...'

CREATE INDEX IF NOT EXISTS idx_roles_nombre ON ROLES(nombre);
CREATE INDEX IF NOT EXISTS idx_roles_nivel_acceso ON ROLES(nivel_acceso);
CREATE INDEX IF NOT EXISTS idx_roles_activo ON ROLES(activo);

\echo '✓ Índices de roles creados'

-- =====================================================
-- 15. ÍNDICES DE LOG DE ACCESOS
-- =====================================================
\echo ''
\echo '15. Creando índices de log de accesos...'

CREATE INDEX IF NOT EXISTS idx_log_usuario ON LOG_ACCESOS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_tipo ON LOG_ACCESOS(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_log_fecha ON LOG_ACCESOS(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_log_ip ON LOG_ACCESOS(ip_address);

\echo '✓ Índices de log de accesos creados'

\echo ''
\echo '========================================'
\echo 'Views and Indexes Migration Completado'
\echo '========================================'