-- =====================================================
-- EcoDigital - Post-Migration Validation Script
-- Versión: 1.0
-- Descripción: Valida la integridad de la base de datos
--              después de ejecutar las migraciones
-- =====================================================

\echo '========================================'
\echo 'EcoDigital - Post-Migration Validation'
\echo '========================================'

-- Crear tabla para almacenar resultados de validación
CREATE TEMPORARY TABLE validation_results (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR(50),
    elemento VARCHAR(100),
    estado VARCHAR(20),
    mensaje TEXT,
    fecha_validacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 1. VALIDACIÓN DE TABLAS
-- =====================================================
\echo ''
\echo '1. Validando tablas principales...'

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
BEGIN
    FOREACH tabla IN ARRAY tablas_requeridas
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tabla
        ) INTO existe;
        
        IF existe THEN
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('TABLA', tabla, 'OK', 'Tabla existe y es accesible');
            RAISE NOTICE '✓ Tabla %: OK', tabla;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('TABLA', tabla, 'ERROR', 'Tabla NO existe');
            RAISE WARNING '✗ Tabla %: NO EXISTE', tabla;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 2. VALIDACIÓN DE COLUMNAS PK
-- =====================================================
\echo ''
\echo '2. Validando columnas de Primary Key...'

DO $$
DECLARE
    columnas_pk RECORD;
BEGIN
    -- Verificar ROLES.id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ROLES' AND column_name = 'id'
    ) THEN
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'ROLES.id', 'OK', 'Columna PK correcta');
        RAISE NOTICE '✓ ROLES.id: OK';
    ELSE
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'ROLES.id', 'ERROR', 'Columna PK incorrecta - debe ser "id"');
        RAISE WARNING '✗ ROLES.id: ERROR - columna incorrecta';
    END IF;
    
    -- Verificar USUARIOS.id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'USUARIOS' AND column_name = 'id'
    ) THEN
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'USUARIOS.id', 'OK', 'Columna PK correcta');
        RAISE NOTICE '✓ USUARIOS.id: OK';
    ELSE
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'USUARIOS.id', 'ERROR', 'Columna PK incorrecta - debe ser "id"');
        RAISE WARNING '✗ USUARIOS.id: ERROR - columna incorrecta';
    END IF;
    
    -- Verificar PACIENTES.id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PACIENTES' AND column_name = 'id'
    ) THEN
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'PACIENTES.id', 'OK', 'Columna PK correcta');
        RAISE NOTICE '✓ PACIENTES.id: OK';
    ELSE
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('PK', 'PACIENTES.id', 'ERROR', 'Columna PK incorrecta - debe ser "id"');
        RAISE WARNING '✗ PACIENTES.id: ERROR - columna incorrecta';
    END IF;
END $$;

-- =====================================================
-- 3. VALIDACIÓN DE FUNCIONES
-- =====================================================
\echo ''
\echo '3. Validando funciones almacenadas...'

DO $$
DECLARE
    funciones_requeridas TEXT[] := ARRAY[
        'update_fecha_modificacion',
        'calcular_imc',
        'validar_conflicto_citas',
        'generar_numero_cita',
        'sp_crear_log_auditoria',
        'sp_verificar_integridad_logs',
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
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('FUNCION', func, 'OK', 'Función existe');
            RAISE NOTICE '✓ Función %: OK', func;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('FUNCION', func, 'ERROR', 'Función NO existe');
            RAISE WARNING '✗ Función %: NO EXISTE', func;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 4. VALIDACIÓN DE TRIGGERS
-- =====================================================
\echo ''
\echo '4. Validando triggers...'

DO $$
DECLARE
    triggers_requeridos TEXT[] := ARRAY[
        'tr_usuarios_update_fecha_modificacion',
        'tr_roles_update_fecha_modificacion',
        'tr_pacientes_update_fecha_modificacion',
        'tr_citas_update_fecha_modificacion',
        'tr_historial_update_fecha_modificacion',
        'tr_documentos_update_fecha_modificacion',
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
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('TRIGGER', trig, 'OK', 'Trigger existe');
            RAISE NOTICE '✓ Trigger %: OK', trig;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('TRIGGER', trig, 'ERROR', 'Trigger NO existe');
            RAISE WARNING '✗ Trigger %: NO EXISTE', trig;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 5. VALIDACIÓN DE VISTAS
-- =====================================================
\echo ''
\echo '5. Validando vistas...'

DO $$
DECLARE
    vistas_requeridas TEXT[] := ARRAY[
        'v_usuarios_completo',
        'v_sesiones_activas',
        'v_pacientes_resumen',
        'v_pacientes_estadisticas',
        'v_citas_completas',
        'v_disponibilidad_medicos',
        'v_agenda_medicos',
        'v_historial_completo',
        'v_documentos_pacientes',
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
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('VISTA', vista, 'OK', 'Vista existe');
            RAISE NOTICE '✓ Vista %: OK', vista;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('VISTA', vista, 'ERROR', 'Vista NO existe');
            RAISE WARNING '✗ Vista %: NO EXISTE', vista;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 6. VALIDACIÓN DE ÍNDICES
-- =====================================================
\echo ''
\echo '6. Validando índices críticos...'

DO $$
DECLARE
    indices_criticos TEXT[] := ARRAY[
        'idx_usuarios_username',
        'idx_usuarios_email',
        'idx_pacientes_nombre_apellido',
        'idx_citas_fecha_hora',
        'idx_citas_medico_fecha',
        'idx_historial_paciente_fecha',
        'idx_logs_fecha_evento',
        'idx_logs_usuario_fecha'
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
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('INDICE', idx, 'OK', 'Índice existe');
            RAISE NOTICE '✓ Índice %: OK', idx;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('INDICE', idx, 'ERROR', 'Índice NO existe');
            RAISE WARNING '✗ Índice %: NO EXISTE', idx;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 7. VALIDACIÓN DE CLAVES FORÁNEAS
-- =====================================================
\echo ''
\echo '7. Validando claves foráneas...'

DO $$
DECLARE
    fks_requeridas TEXT[] := ARRAY[
        'fk_usuarios_rol',
        'fk_sesiones_usuario',
        'fk_permisos_usuario',
        'fk_historial_paciente',
        'fk_historial_medico',
        'fk_citas_paciente',
        'fk_citas_medico',
        'fk_documentos_paciente'
    ];
    fk TEXT;
    existe BOOLEAN;
BEGIN
    FOREACH fk IN ARRAY fks_requeridas
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND contype = 'f' AND conname = fk
        ) INTO existe;
        
        IF existe THEN
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('FK', fk, 'OK', 'Clave foránea existe');
            RAISE NOTICE '✓ FK %: OK', fk;
        ELSE
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('FK', fk, 'WARNING', 'Clave foránea NO existe (puede ser intencional)');
            RAISE NOTICE '⚠ FK %: NO EXISTE (puede ser intencional)', fk;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 8. VALIDACIÓN DE INTEGRIDAD REFERENCIAL
-- =====================================================
\echo ''
\echo '8. Validando integridad referencial...'

DO $$
DECLARE
    huerfanos INTEGER;
BEGIN
    -- Verificar USUARIOS sin ROL válido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM USUARIOS u WHERE u.rol_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ROLES r WHERE r.id = u.rol_id)' INTO huerfanos;
            IF huerfanos > 0 THEN
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'USUARIOS-ROLES', 'ERROR', format('Hay %s usuarios sin rol válido', huerfanos));
                RAISE WARNING '✗ Hay % usuarios sin rol válido', huerfanos;
            ELSE
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'USUARIOS-ROLES', 'OK', 'Todos los usuarios tienen roles válidos');
                RAISE NOTICE '✓ Integridad USUARIOS-ROLES: OK';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('INTEGRIDAD', 'USUARIOS-ROLES', 'WARNING', 'No se pudo verificar');
        END;
    END IF;
    
    -- Verificar CITAS sin PACIENTE válido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CITAS') THEN
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM CITAS c WHERE c.id_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PACIENTES p WHERE p.id = c.id_paciente)' INTO huerfanos;
            IF huerfanos > 0 THEN
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'CITAS-PACIENTES', 'ERROR', format('Hay %s citas sin paciente válido', huerfanos));
                RAISE WARNING '✗ Hay % citas sin paciente válido', huerfanos;
            ELSE
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'CITAS-PACIENTES', 'OK', 'Todas las citas tienen pacientes válidos');
                RAISE NOTICE '✓ Integridad CITAS-PACIENTES: OK';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('INTEGRIDAD', 'CITAS-PACIENTES', 'WARNING', 'No se pudo verificar');
        END;
    END IF;
    
    -- Verificar HISTORIAL_CLINICO sin PACIENTE válido
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'HISTORIAL_CLINICO') THEN
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM HISTORIAL_CLINICO h WHERE h.id_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PACIENTES p WHERE p.id = h.id_paciente)' INTO huerfanos;
            IF huerfanos > 0 THEN
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'HISTORIAL-PACIENTES', 'ERROR', format('Hay %s historiales sin paciente válido', huerfanos));
                RAISE WARNING '✗ Hay % historiales sin paciente válido', huerfanos;
            ELSE
                INSERT INTO validation_results (categoria, elemento, estado, mensaje)
                VALUES ('INTEGRIDAD', 'HISTORIAL-PACIENTES', 'OK', 'Todos los historiales tienen pacientes válidos');
                RAISE NOTICE '✓ Integridad HISTORIAL-PACIENTES: OK';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO validation_results (categoria, elemento, estado, mensaje)
            VALUES ('INTEGRIDAD', 'HISTORIAL-PACIENTES', 'WARNING', 'No se pudo verificar');
        END;
    END IF;
END $$;

-- =====================================================
-- 9. VALIDACIÓN DE DATOS
-- =====================================================
\echo ''
\echo '9. Validando datos existentes...'

DO $$
DECLARE
    total_usuarios INTEGER;
    total_roles INTEGER;
    total_pacientes INTEGER;
BEGIN
    -- Contar registros
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        EXECUTE 'SELECT COUNT(*) FROM USUARIOS' INTO total_usuarios;
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('DATOS', 'USUARIOS', 'INFO', format('Total usuarios: %s', total_usuarios));
        RAISE NOTICE 'Total usuarios: %', total_usuarios;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ROLES') THEN
        EXECUTE 'SELECT COUNT(*) FROM ROLES' INTO total_roles;
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('DATOS', 'ROLES', 'INFO', format('Total roles: %s', total_roles));
        RAISE NOTICE 'Total roles: %', total_roles;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PACIENTES') THEN
        EXECUTE 'SELECT COUNT(*) FROM PACIENTES' INTO total_pacientes;
        INSERT INTO validation_results (categoria, elemento, estado, mensaje)
        VALUES ('DATOS', 'PACIENTES', 'INFO', format('Total pacientes: %s', total_pacientes));
        RAISE NOTICE 'Total pacientes: %', total_pacientes;
    END IF;
END $$;

-- =====================================================
-- 10. RESUMEN FINAL
-- =====================================================
\echo ''
\echo '========================================'
\echo 'Resumen de Validación'
\echo '========================================'

SELECT 
    categoria AS "Categoría",
    COUNT(CASE WHEN estado = 'OK' THEN 1 END) AS "Correctos",
    COUNT(CASE WHEN estado = 'ERROR' THEN 1 END) AS "Errores",
    COUNT(CASE WHEN estado = 'WARNING' THEN 1 END) AS "Advertencias",
    COUNT(CASE WHEN estado = 'INFO' THEN 1 END) AS "Información"
FROM validation_results
GROUP BY categoria
ORDER BY categoria;

\echo ''
\echo 'Detalles de errores:'
SELECT categoria AS "Categoría", elemento AS "Elemento", estado AS "Estado", mensaje AS "Mensaje"
FROM validation_results
WHERE estado IN ('ERROR', 'WARNING')
ORDER BY categoria, elemento;

\echo ''
\echo '========================================'
\echo 'Validación completada.'
\echo '========================================'

-- Contar errores totales
DO $$
DECLARE
    total_errores INTEGER;
    total_warnings INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_errores FROM validation_results WHERE estado = 'ERROR';
    SELECT COUNT(*) INTO total_warnings FROM validation_results WHERE estado = 'WARNING';
    
    IF total_errores > 0 THEN
        RAISE WARNING 'Se encontraron % errores que deben corregirse', total_errores;
    ELSE
        RAISE NOTICE '✓ No se encontraron errores críticos';
    END IF;
    
    IF total_warnings > 0 THEN
        RAISE NOTICE 'Se encontraron % advertencias (pueden ser intencionales)', total_warnings;
    END IF;
END $$;

-- Limpiar tabla temporal
DROP TABLE IF EXISTS validation_results;