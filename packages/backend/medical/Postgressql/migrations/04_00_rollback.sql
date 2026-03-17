-- =====================================================
-- EcoDigital - Rollback Script
-- Versión: 1.0
-- Descripción: Permite revertir los cambios realizados
--              por las migraciones en caso de error
-- =====================================================
-- IMPORTANTE: Este script debe ejecutarse con EXTREMA
-- precaución y solo en caso de necesidad de revertir
-- cambios. Asegúrese de tener un backup completo.
-- =====================================================

\echo '========================================'
\echo 'EcoDigital - Rollback Script'
\echo '========================================'
\echo ''
\echo '⚠ ADVERTENCIA: Este script revertirá cambios'
\echo '⚠ Asegúrese de tener un backup antes de continuar'
\echo ''
\echo '¿Está seguro de que desea continuar? (Ctrl+C para cancelar)'
\echo ''

-- =====================================================
-- 1. RESTAURAR DATOS DESDE BACKUP
-- =====================================================
\echo ''
\echo '1. Restaurando datos desde backup...'

-- Restaurar ROLES desde backup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_migration') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup_migration' AND table_name = 'ROLES') THEN
            -- Solo restaurar si hay backup
            RAISE NOTICE 'Backup de ROLES disponible en backup_migration.ROLES';
            RAISE NOTICE 'Para restaurar manualmente: TRUNCATE ROLES; INSERT INTO ROLES SELECT * FROM backup_migration.ROLES;';
        END IF;
    END IF;
END $$;

-- Restaurar USUARIOS desde backup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_migration') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup_migration' AND table_name = 'USUARIOS') THEN
            RAISE NOTICE 'Backup de USUARIOS disponible en backup_migration.USUARIOS';
            RAISE NOTICE 'Para restaurar manualmente: TRUNCATE USUARIOS CASCADE; INSERT INTO USUARIOS SELECT * FROM backup_migration.USUARIOS;';
        END IF;
    END IF;
END $$;

-- Restaurar PACIENTES desde backup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_migration') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'backup_migration' AND table_name = 'PACIENTES') THEN
            RAISE NOTICE 'Backup de PACIENTES disponible en backup_migration.PACIENTES';
            RAISE NOTICE 'Para restaurar manualmente: TRUNCATE PACIENTES CASCADE; INSERT INTO PACIENTES SELECT * FROM backup_migration.PACIENTES;';
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. ELIMINAR TRIGGERS CREADOS
-- =====================================================
\echo ''
\echo '2. Eliminando triggers creados...'

-- Triggers de fecha_modificacion
DROP TRIGGER IF EXISTS tr_usuarios_update_fecha_modificacion ON USUARIOS;
DROP TRIGGER IF EXISTS tr_roles_update_fecha_modificacion ON ROLES;
DROP TRIGGER IF EXISTS tr_pacientes_update_fecha_modificacion ON PACIENTES;
DROP TRIGGER IF EXISTS tr_citas_update_fecha_modificacion ON CITAS;
DROP TRIGGER IF EXISTS tr_historial_update_fecha_modificacion ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_documentos_update_fecha_modificacion ON DOCUMENTOS;
DROP TRIGGER IF EXISTS tr_reportes_update_fecha_modificacion ON REPORTES_PROGRAMADOS;
DROP TRIGGER IF EXISTS tr_plantillas_update_fecha_modificacion ON PLANTILLAS_REPORTES;
DROP TRIGGER IF EXISTS tr_alertas_update_fecha_modificacion ON ALERTAS_AUDITORIA;

-- Triggers de negocio
DROP TRIGGER IF EXISTS tr_historial_calcular_imc ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_actualizar_fechas_consulta ON HISTORIAL_CLINICO;
DROP TRIGGER IF EXISTS tr_validar_conflicto_citas ON CITAS;
DROP TRIGGER IF EXISTS tr_generar_numero_cita ON CITAS;

-- Triggers WORM
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_update ON LOGS_AUDITORIA;
DROP TRIGGER IF EXISTS tr_logs_auditoria_prevent_delete ON LOGS_AUDITORIA;
DROP TRIGGER IF EXISTS tr_logs_auditoria_before_insert ON LOGS_AUDITORIA;

\echo '✓ Triggers eliminados'

-- =====================================================
-- 3. ELIMINAR FUNCIONES CREADAS
-- =====================================================
\echo ''
\echo '3. Eliminando funciones creadas...'

DROP FUNCTION IF EXISTS update_fecha_modificacion() CASCADE;
DROP FUNCTION IF EXISTS calcular_imc() CASCADE;
DROP FUNCTION IF EXISTS validar_conflicto_citas() CASCADE;
DROP FUNCTION IF EXISTS generar_numero_cita() CASCADE;
DROP FUNCTION IF EXISTS actualizar_fechas_consulta_paciente() CASCADE;
DROP FUNCTION IF EXISTS sp_crear_log_auditoria(UUID, VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, INET, TEXT, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, JSONB, JSONB, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS sp_verificar_integridad_logs(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS prevent_logs_update() CASCADE;
DROP FUNCTION IF EXISTS prevent_logs_delete() CASCADE;
DROP FUNCTION IF EXISTS generate_log_integrity() CASCADE;

\echo '✓ Funciones eliminadas'

-- =====================================================
-- 4. ELIMINAR VISTAS CREADAS
-- =====================================================
\echo ''
\echo '4. Eliminando vistas creadas...'

DROP VIEW IF EXISTS v_usuarios_completo CASCADE;
DROP VIEW IF EXISTS v_sesiones_activas CASCADE;
DROP VIEW IF EXISTS v_pacientes_resumen CASCADE;
DROP VIEW IF EXISTS v_pacientes_estadisticas CASCADE;
DROP VIEW IF EXISTS v_citas_completas CASCADE;
DROP VIEW IF EXISTS v_disponibilidad_medicos CASCADE;
DROP VIEW IF EXISTS v_agenda_medicos CASCADE;
DROP VIEW IF EXISTS v_historial_completo CASCADE;
DROP VIEW IF EXISTS v_documentos_pacientes CASCADE;
DROP VIEW IF EXISTS v_dashboard_auditoria CASCADE;
DROP VIEW IF EXISTS v_eventos_seguridad_criticos CASCADE;
DROP VIEW IF EXISTS v_estadisticas_reportes CASCADE;

\echo '✓ Vistas eliminadas'

-- =====================================================
-- 5. ELIMINAR ÍNDICES CREADOS
-- =====================================================
\echo ''
\echo '5. Eliminando índices creados...'

-- Índices de usuarios
DROP INDEX IF EXISTS idx_usuarios_username;
DROP INDEX IF EXISTS idx_usuarios_email;
DROP INDEX IF EXISTS idx_usuarios_rol;
DROP INDEX IF EXISTS idx_usuarios_activo;
DROP INDEX IF EXISTS idx_usuarios_bloqueado;
DROP INDEX IF EXISTS idx_usuarios_cedula;
DROP INDEX IF EXISTS idx_usuarios_ultimo_acceso;

-- Índices de pacientes
DROP INDEX IF EXISTS idx_pacientes_nombre;
DROP INDEX IF EXISTS idx_pacientes_apellido;
DROP INDEX IF EXISTS idx_pacientes_nombre_apellido;
DROP INDEX IF EXISTS idx_pacientes_cedula;
DROP INDEX IF EXISTS idx_pacientes_fecha_consulta;
DROP INDEX IF EXISTS idx_pacientes_ultima_consulta;
DROP INDEX IF EXISTS idx_pacientes_activo;
DROP INDEX IF EXISTS idx_pacientes_expediente;

-- Índices de citas
DROP INDEX IF EXISTS idx_citas_fecha_hora;
DROP INDEX IF EXISTS idx_citas_paciente;
DROP INDEX IF EXISTS idx_citas_medico;
DROP INDEX IF EXISTS idx_citas_paciente_fecha;
DROP INDEX IF EXISTS idx_citas_medico_fecha;
DROP INDEX IF EXISTS idx_citas_estado;
DROP INDEX IF EXISTS idx_citas_tipo;
DROP INDEX IF EXISTS idx_citas_numero;
DROP INDEX IF EXISTS idx_citas_activo;

-- Índices de historial
DROP INDEX IF EXISTS idx_historial_paciente;
DROP INDEX IF EXISTS idx_historial_fecha_hora;
DROP INDEX IF EXISTS idx_historial_paciente_fecha;
DROP INDEX IF EXISTS idx_historial_medico;
DROP INDEX IF EXISTS idx_historial_tipo_consulta;
DROP INDEX IF EXISTS idx_historial_estado;
DROP INDEX IF EXISTS idx_historial_activo;
DROP INDEX IF EXISTS idx_historial_urgente;
DROP INDEX IF EXISTS idx_historial_seguimiento;

-- Índices de auditoría
DROP INDEX IF EXISTS idx_logs_fecha_evento;
DROP INDEX IF EXISTS idx_logs_fecha_hora;
DROP INDEX IF EXISTS idx_logs_usuario_fecha;
DROP INDEX IF EXISTS idx_logs_tipo_categoria;
DROP INDEX IF EXISTS idx_logs_modulo_accion;
DROP INDEX IF EXISTS idx_logs_recurso;
DROP INDEX IF EXISTS idx_logs_nivel_criticidad;
DROP INDEX IF EXISTS idx_logs_resultado;
DROP INDEX IF EXISTS idx_logs_numero_secuencia;
DROP INDEX IF EXISTS idx_logs_hash_integridad;

-- Índices de documentos
DROP INDEX IF EXISTS idx_documentos_paciente;
DROP INDEX IF EXISTS idx_documentos_tipo;
DROP INDEX IF EXISTS idx_documentos_categoria;
DROP INDEX IF EXISTS idx_documentos_historial;
DROP INDEX IF EXISTS idx_documentos_cita;
DROP INDEX IF EXISTS idx_documentos_fecha_documento;
DROP INDEX IF EXISTS idx_documentos_fecha_subida;
DROP INDEX IF EXISTS idx_documentos_estado;
DROP INDEX IF EXISTS idx_documentos_activo;
DROP INDEX IF EXISTS idx_documentos_hash;
DROP INDEX IF EXISTS idx_documentos_nombre;
DROP INDEX IF EXISTS idx_documentos_subido_por;
DROP INDEX IF EXISTS idx_documentos_version;

-- Índices de sesiones
DROP INDEX IF EXISTS idx_sesiones_usuario;
DROP INDEX IF EXISTS idx_sesiones_token;
DROP INDEX IF EXISTS idx_sesiones_refresh;
DROP INDEX IF EXISTS idx_sesiones_activa;
DROP INDEX IF EXISTS idx_sesiones_expiracion;

-- Índices de roles
DROP INDEX IF EXISTS idx_roles_nombre;
DROP INDEX IF EXISTS idx_roles_nivel_acceso;
DROP INDEX IF EXISTS idx_roles_activo;

-- Índices de log de accesos
DROP INDEX IF EXISTS idx_log_usuario;
DROP INDEX IF EXISTS idx_log_tipo;
DROP INDEX IF EXISTS idx_log_fecha;
DROP INDEX IF EXISTS idx_log_ip;

\echo '✓ Índices eliminados'

-- =====================================================
-- 6. REVERTIR CAMBIOS DE COLUMNAS
-- =====================================================
\echo ''
\echo '6. Revirtiendo cambios de columnas...'

-- Revertir ROLES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'id') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.ROLES WHERE column_name = 'id_role') THEN
            ALTER TABLE ROLES RENAME COLUMN id TO id_role;
            RAISE NOTICE '✓ ROLES.id revertido a id_role';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'nombre') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.ROLES WHERE column_name = 'nombre_rol') THEN
            ALTER TABLE ROLES RENAME COLUMN nombre TO nombre_rol;
            RAISE NOTICE '✓ ROLES.nombre revertido a nombre_rol';
        END IF;
    END IF;
END $$;

-- Revertir USUARIOS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'id') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.USUARIOS WHERE column_name = 'id_usuario') THEN
            ALTER TABLE USUARIOS RENAME COLUMN id TO id_usuario;
            RAISE NOTICE '✓ USUARIOS.id revertido a id_usuario';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'nombres') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.USUARIOS WHERE column_name = 'nombre') THEN
            ALTER TABLE USUARIOS RENAME COLUMN nombres TO nombre;
            RAISE NOTICE '✓ USUARIOS.nombres revertido a nombre';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'password_hash') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.USUARIOS WHERE column_name = 'hash_password') THEN
            ALTER TABLE USUARIOS RENAME COLUMN password_hash TO hash_password;
            RAISE NOTICE '✓ USUARIOS.password_hash revertido a hash_password';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'rol_id') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.USUARIOS WHERE column_name = 'id_role') THEN
            ALTER TABLE USUARIOS RENAME COLUMN rol_id TO id_role;
            RAISE NOTICE '✓ USUARIOS.rol_id revertido a id_role';
        END IF;
    END IF;
END $$;

-- Revertir PACIENTES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PACIENTES' AND column_name = 'id') THEN
        IF EXISTS (SELECT 1 FROM backup_migration.PACIENTES WHERE column_name = 'id_paciente') THEN
            ALTER TABLE PACIENTES RENAME COLUMN id TO id_paciente;
            RAISE NOTICE '✓ PACIENTES.id revertido a id_paciente';
        END IF;
    END IF;
END $$;

\echo '✓ Cambios de columnas revertidos'

-- =====================================================
-- 7. ELIMINAR COLUMNAS AGREGADAS
-- =====================================================
\echo ''
\echo '7. Eliminando columnas agregadas...'

-- Eliminar columnas agregadas a ROLES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ROLES') THEN
        ALTER TABLE ROLES DROP COLUMN IF EXISTS descripcion;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS nivel_acceso;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS es_sistema;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS timeout_sesion;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS max_sesiones_concurrentes;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS activo;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS creado_por;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS modificado_por;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS fecha_creacion;
        ALTER TABLE ROLES DROP COLUMN IF EXISTS fecha_modificacion;
        RAISE NOTICE '✓ Columnas eliminadas de ROLES';
    END IF;
END $$;

-- Eliminar columnas agregadas a USUARIOS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS salt;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS apellidos;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS telefono;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS cedula;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS foto_perfil;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS titulo_profesional;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS especialidad;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS numero_colegiado;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS firma_digital;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS verificado;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS bloqueado;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS intentos_fallidos;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS fecha_bloqueo;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS fecha_ultimo_acceso;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS cambiar_password;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS fecha_expiracion_password;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS token_recuperacion;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS fecha_expiracion_token;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS two_factor_enabled;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS two_factor_secret;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS preferencias;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS timezone;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS idioma;
        ALTER TABLE USUARIOS DROP COLUMN IF EXISTS tema;
        RAISE NOTICE '✓ Columnas eliminadas de USUARIOS';
    END IF;
END $$;

\echo '✓ Columnas agregadas eliminadas'

-- =====================================================
-- 8. ELIMINAR SCHEMA DE BACKUP
-- =====================================================
\echo ''
\echo '8. Eliminando schema de backup...'

-- ADVERTENCIA: Esto eliminará permanentemente los backups
-- Descomentar solo si está seguro de que ya no necesita los backups
-- DROP SCHEMA IF EXISTS backup_migration CASCADE;

\echo '⚠ Schema backup_migration conservado (elimine manualmente si es necesario)'

\echo ''
\echo '========================================'
\echo 'Rollback Completado'
\echo '========================================'
\echo ''
\echo 'NOTA: Los datos originales están disponibles en'
\echo 'el schema backup_migration. Para restaurarlos'
\echo 'completamente, ejecute los comandos manuales'
\echo 'indicados en los mensajes anteriores.'
\echo ''
\echo 'Para eliminar el schema de backup:'
\echo 'DROP SCHEMA IF EXISTS backup_migration CASCADE;'
\echo '========================================'