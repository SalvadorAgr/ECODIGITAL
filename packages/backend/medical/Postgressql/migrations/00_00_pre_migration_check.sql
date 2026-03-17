-- =====================================================
-- EcoDigital - Pre-Migration Check Script
-- Versión: 1.0
-- Descripción: Verifica el estado actual de la base de datos
--              antes de ejecutar las migraciones
-- =====================================================

-- Este script debe ejecutarse ANTES de cualquier migración
-- para verificar que la base de datos está en un estado consistente

\echo '========================================'
\echo 'EcoDigital - Pre-Migration Check'
\echo '========================================'

-- =====================================================
-- 1. VERIFICAR VERSION DE POSTGRESQL
-- =====================================================
\echo ''
\echo '1. Verificando versión de PostgreSQL...'

DO $$
DECLARE
    pg_version TEXT;
    min_version TEXT := '16.0';
BEGIN
    SELECT version() INTO pg_version;
    RAISE NOTICE 'PostgreSQL Version: %', pg_version;
    
    -- Verificar que sea PostgreSQL 16 o superior
    IF current_setting('server_version_num')::int < 160000 THEN
        RAISE EXCEPTION 'Se requiere PostgreSQL 16 o superior. Versión actual: %', pg_version;
    END IF;
    
    RAISE NOTICE '✓ Versión de PostgreSQL compatible';
END $$;

-- =====================================================
-- 2. VERIFICAR EXTENSIONES NECESARIAS
-- =====================================================
\echo ''
\echo '2. Verificando extensiones necesarias...'

-- Verificar extensión uuid-ossp o pgcrypto para UUID
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') 
       AND NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        -- Intentar crear uuid-ossp
        BEGIN
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            RAISE NOTICE '✓ Extensión uuid-ossp instalada';
        EXCEPTION WHEN OTHERS THEN
            -- Intentar pgcrypto como alternativa
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pgcrypto;
                RAISE NOTICE '✓ Extensión pgcrypto instalada';
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Se requiere la extensión uuid-ossp o pgcrypto para generar UUIDs';
            END;
        END;
    ELSE
        RAISE NOTICE '✓ Extensiones UUID disponibles';
    END IF;
END $$;

-- =====================================================
-- 3. VERIFICAR TABLAS EXISTENTES
-- =====================================================
\echo ''
\echo '3. Verificando tablas existentes...'

-- Crear tabla temporal para almacenar resultados
CREATE TEMPORARY TABLE migration_check_results (
    tabla VARCHAR(100),
    existe BOOLEAN,
    columnas INTEGER,
    tiene_datos BOOLEAN
);

-- Verificar cada tabla principal
DO $$
DECLARE
    tablas_requeridas TEXT[] := ARRAY[
        'ROLES', 'USUARIOS', 'SESIONES_USUARIO', 'PERMISOS_USUARIO', 'LOG_ACCESOS',
        'CONFIGURACION_SEGURIDAD', 'PACIENTES', 'HISTORIAL_CLINICO', 'CITAS', 
        'DOCUMENTOS', 'HORARIOS_MEDICOS', 'EXCEPCIONES_HORARIO', 'LOGS_AUDITORIA',
        'REPORTES_PROGRAMADOS', 'EJECUCIONES_REPORTES', 'PLANTILLAS_REPORTES',
        'ALERTAS_AUDITORIA', 'INSTANCIAS_ALERTAS', 'METRICAS_SISTEMA'
    ];
    tabla TEXT;
    existe BOOLEAN;
    col_count INTEGER;
    tiene_datos BOOLEAN;
BEGIN
    FOREACH tabla IN ARRAY tablas_requeridas
    LOOP
        -- Verificar si existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tabla
        ) INTO existe;
        
        IF existe THEN
            -- Contar columnas
            SELECT COUNT(*) INTO col_count
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tabla;
            
            -- Verificar si tiene datos
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I LIMIT 1)', tabla) INTO tiene_datos;
            
            RAISE NOTICE 'Tabla %: EXISTE (% columnas, datos: %)', tabla, col_count, CASE WHEN tiene_datos THEN 'SÍ' ELSE 'NO' END;
        ELSE
            RAISE NOTICE 'Tabla %: NO EXISTE', tabla;
        END IF;
        
        INSERT INTO migration_check_results VALUES (tabla, existe, col_count, tiene_datos);
    END LOOP;
END $$;

-- =====================================================
-- 4. VERIFICAR FUNCIONES EXISTENTES
-- =====================================================
\echo ''
\echo '4. Verificando funciones existentes...'

DO $$
DECLARE
    funciones_requeridas TEXT[] := ARRAY[
        'update_fecha_modificacion',
        'calcular_imc',
        'validar_conflicto_citas',
        'generar_numero_cita',
        'sp_crear_log_auditoria',
        'prevent_logs_update',
        'prevent_logs_delete',
        'generate_log_integrity',
        'actualizar_fechas_consulta_paciente'
    ];
    func TEXT;
    existe BOOLEAN;
BEGIN
    FOREACH func IN ARRAY funciones_requeridas
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = func
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE 'Función %: EXISTE', func;
        ELSE
            RAISE NOTICE 'Función %: NO EXISTE', func;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 5. VERIFICAR VISTAS EXISTENTES
-- =====================================================
\echo ''
\echo '5. Verificando vistas existentes...'

DO $$
DECLARE
    vistas_requeridas TEXT[] := ARRAY[
        'v_usuarios_completo',
        'v_pacientes_resumen',
        'v_citas_completas',
        'v_historial_completo',
        'v_sesiones_activas',
        'v_pacientes_estadisticas',
        'v_documentos_pacientes',
        'v_disponibilidad_medicos',
        'v_agenda_medicos',
        'v_dashboard_auditoria',
        'v_eventos_seguridad_criticos',
        'v_estadisticas_reportes'
    ];
    vista TEXT;
    existe BOOLEAN;
BEGIN
    FOREACH vista IN ARRAY vistas_requeridas
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' AND table_name = vista
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE 'Vista %: EXISTE', vista;
        ELSE
            RAISE NOTICE 'Vista %: NO EXISTE', vista;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 6. VERIFICAR ÍNDICES EXISTENTES
-- =====================================================
\echo ''
\echo '6. Verificando índices críticos...'

DO $$
DECLARE
    indices_criticos TEXT[] := ARRAY[
        'idx_usuarios_username',
        'idx_usuarios_email',
        'idx_pacientes_nombre_apellido',
        'idx_citas_fecha_hora',
        'idx_citas_medico_fecha',
        'idx_historial_paciente_fecha',
        'idx_logs_fecha_evento'
    ];
    idx TEXT;
    existe BOOLEAN;
BEGIN
    FOREACH idx IN ARRAY indices_criticos
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = idx
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE 'Índice %: EXISTE', idx;
        ELSE
            RAISE NOTICE 'Índice %: NO EXISTE', idx;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 7. VERIFICAR TRIGGERS EXISTENTES
-- =====================================================
\echo ''
\echo '7. Verificando triggers existentes...'

DO $$
DECLARE
    triggers_requeridos TEXT[] := ARRAY[
        'tr_usuarios_update_fecha_modificacion',
        'tr_pacientes_update_fecha_modificacion',
        'tr_citas_update_fecha_modificacion',
        'tr_historial_update_fecha_modificacion',
        'tr_historial_calcular_imc',
        'tr_actualizar_fechas_consulta',
        'tr_validar_conflicto_citas',
        'tr_generar_numero_cita',
        'tr_logs_auditoria_prevent_update',
        'tr_logs_auditoria_prevent_delete',
        'tr_logs_auditoria_before_insert'
    ];
    trig TEXT;
    existe BOOLEAN;
BEGIN
    FOREACH trig IN ARRAY triggers_requeridos
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_trigger tg
            JOIN pg_class c ON tg.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND tg.tgname = trig
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE 'Trigger %: EXISTE', trig;
        ELSE
            RAISE NOTICE 'Trigger %: NO EXISTE', trig;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 8. VERIFICAR INCONSISTENCIAS DE NOMBRES
-- =====================================================
\echo ''
\echo '8. Verificando inconsistencias de nombres de columnas...'

-- Verificar si existen columnas con nombres inconsistentes
DO $$
DECLARE
    inconsistencias INTEGER := 0;
BEGIN
    -- Verificar si USUARIOS tiene id_usuario en lugar de id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'USUARIOS' 
        AND column_name = 'id_usuario'
    ) THEN
        RAISE NOTICE '⚠ INCONSISTENCIA: USUARIOS tiene columna id_usuario (debería ser id)';
        inconsistencias := inconsistencias + 1;
    END IF;
    
    -- Verificar si PACIENTES tiene id_paciente en lugar de id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'PACIENTES' 
        AND column_name = 'id_paciente'
    ) THEN
        RAISE NOTICE '⚠ INCONSISTENCIA: PACIENTES tiene columna id_paciente (debería ser id)';
        inconsistencias := inconsistencias + 1;
    END IF;
    
    -- Verificar si ROLES tiene id_role en lugar de id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ROLES' 
        AND column_name = 'id_role'
    ) THEN
        RAISE NOTICE '⚠ INCONSISTENCIA: ROLES tiene columna id_role (debería ser id)';
        inconsistencias := inconsistencias + 1;
    END IF;
    
    IF inconsistencias = 0 THEN
        RAISE NOTICE '✓ No se encontraron inconsistencias de nombres';
    ELSE
        RAISE WARNING 'Se encontraron % inconsistencias de nombres que deben corregirse', inconsistencias;
    END IF;
END $$;

-- =====================================================
-- 9. VERIFICAR CLAVES FORÁNEAS HUÉRFANAS
-- =====================================================
\echo ''
\echo '9. Verificando integridad referencial...'

-- Verificar si hay registros huérfanos
DO $$
DECLARE
    huerfanos INTEGER;
BEGIN
    -- Verificar USUARIOS sin ROL válido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM USUARIOS u WHERE u.rol_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ROLES r WHERE r.id = u.rol_id)' INTO huerfanos;
            IF huerfanos > 0 THEN
                RAISE WARNING '⚠ Hay % usuarios sin rol válido', huerfanos;
            ELSE
                RAISE NOTICE '✓ Todos los usuarios tienen roles válidos';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo verificar usuarios (tabla puede no existir)';
        END;
    END IF;
    
    -- Verificar CITAS sin PACIENTE válido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CITAS') THEN
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM CITAS c WHERE c.id_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PACIENTES p WHERE p.id = c.id_paciente)' INTO huerfanos;
            IF huerfanos > 0 THEN
                RAISE WARNING '⚠ Hay % citas sin paciente válido', huerfanos;
            ELSE
                RAISE NOTICE '✓ Todas las citas tienen pacientes válidos';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo verificar citas (tabla puede no existir)';
        END;
    END IF;
END $$;

-- =====================================================
-- 10. RESUMEN FINAL
-- =====================================================
\echo ''
\echo '========================================'
\echo 'Resumen de Verificación Pre-Migración'
\echo '========================================'

SELECT 
    tabla AS "Tabla",
    CASE WHEN existe THEN '✓' ELSE '✗' END AS "Existe",
    COALESCE(columnas::TEXT, 'N/A') AS "Columnas",
    CASE WHEN tiene_datos THEN 'Sí' ELSE 'No' END AS "Tiene Datos"
FROM migration_check_results
ORDER BY tabla;

\echo ''
\echo '========================================'
\echo 'Verificación completada.'
\echo 'Revise los mensajes anteriores para identificar'
\echo 'posibles problemas antes de ejecutar las migraciones.'
\echo '========================================'

-- Limpiar tabla temporal
DROP TABLE IF EXISTS migration_check_results;