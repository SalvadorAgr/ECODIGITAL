-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Migration Script from MySQL to PostgreSQL
-- Descripción: Script para migrar datos de MySQL a PostgreSQL
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- IMPORTANTE: Este script debe ejecutarse DESPUÉS de crear la estructura
-- con setup_database.sql y DESPUÉS de exportar los datos de MySQL

-- =====================================================
-- PREPARACIÓN PARA MIGRACIÓN
-- =====================================================

-- Deshabilitar triggers temporalmente para mejorar rendimiento
SET session_replication_role = replica;

-- Configurar parámetros para migración
SET maintenance_work_mem = '1GB';
SET checkpoint_completion_target = 0.9;

-- =====================================================
-- FUNCIONES DE MIGRACIÓN
-- =====================================================

-- Función para convertir fechas MySQL a PostgreSQL
CREATE OR REPLACE FUNCTION convert_mysql_datetime(mysql_datetime TEXT)
RETURNS TIMESTAMP AS $$
BEGIN
    -- Manejar valores NULL o vacíos
    IF mysql_datetime IS NULL OR mysql_datetime = '' OR mysql_datetime = '0000-00-00 00:00:00' THEN
        RETURN NULL;
    END IF;
    
    -- Convertir formato MySQL a PostgreSQL
    RETURN mysql_datetime::TIMESTAMP;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Función para convertir fechas MySQL a DATE
CREATE OR REPLACE FUNCTION convert_mysql_date(mysql_date TEXT)
RETURNS DATE AS $$
BEGIN
    -- Manejar valores NULL o vacíos
    IF mysql_date IS NULL OR mysql_date = '' OR mysql_date = '0000-00-00' THEN
        RETURN NULL;
    END IF;
    
    -- Convertir formato MySQL a PostgreSQL
    RETURN mysql_date::DATE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar y validar JSON
CREATE OR REPLACE FUNCTION clean_json_field(json_text TEXT)
RETURNS JSONB AS $$
BEGIN
    -- Manejar valores NULL o vacíos
    IF json_text IS NULL OR json_text = '' OR json_text = 'null' THEN
        RETURN NULL;
    END IF;
    
    -- Intentar convertir a JSONB
    RETURN json_text::JSONB;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRACIÓN DE DATOS PRINCIPALES
-- =====================================================

-- NOTA: Los siguientes comandos asumen que los datos de MySQL
-- han sido exportados a archivos CSV o que existe una conexión
-- directa usando foreign data wrapper (FDW)

-- Ejemplo de migración usando COPY desde archivos CSV:
/*
-- 1. Migrar ROLES
COPY ROLES(id, nombre_rol, descripcion, permisos, activo, fecha_creacion, fecha_modificacion)
FROM '/path/to/mysql_export/roles.csv'
DELIMITER ','
CSV HEADER;

-- 2. Migrar USUARIOS
COPY USUARIOS(id, username, email, password_hash, nombres, apellidos, telefono, especialidad, numero_licencia, activo, fecha_creacion, fecha_modificacion)
FROM '/path/to/mysql_export/usuarios.csv'
DELIMITER ','
CSV HEADER;

-- 3. Migrar PACIENTES
COPY PACIENTES(id, numero_expediente, nombre, apellido, fecha_nacimiento, genero, telefono, email, direccion, activo, fecha_creacion, fecha_modificacion)
FROM '/path/to/mysql_export/pacientes.csv'
DELIMITER ','
CSV HEADER;

-- Continuar con las demás tablas...
*/

-- =====================================================
-- MIGRACIÓN USANDO FOREIGN DATA WRAPPER (FDW)
-- =====================================================

-- Ejemplo usando mysql_fdw (requiere instalación previa)
/*
-- Crear extensión FDW para MySQL
CREATE EXTENSION IF NOT EXISTS mysql_fdw;

-- Crear servidor remoto MySQL
CREATE SERVER mysql_server
FOREIGN DATA WRAPPER mysql_fdw
OPTIONS (host 'localhost', port '3306');

-- Crear mapeo de usuario
CREATE USER MAPPING FOR CURRENT_USER
SERVER mysql_server
OPTIONS (username 'mysql_user', password 'mysql_password');

-- Crear tablas foráneas para cada tabla MySQL
CREATE FOREIGN TABLE mysql_usuarios (
    id INTEGER,
    username VARCHAR(50),
    email VARCHAR(100),
    password_hash VARCHAR(255),
    nombres VARCHAR(100),
    apellidos VARCHAR(100),
    telefono VARCHAR(20),
    especialidad VARCHAR(100),
    numero_licencia VARCHAR(50),
    activo BOOLEAN,
    fecha_creacion TIMESTAMP,
    fecha_modificacion TIMESTAMP
) SERVER mysql_server
OPTIONS (dbname 'ecodigital_mysql', table_name 'USUARIOS');

-- Migrar datos de MySQL a PostgreSQL
INSERT INTO USUARIOS (
    id, username, email, password_hash, nombres, apellidos,
    telefono, especialidad, numero_licencia, activo,
    fecha_creacion, fecha_modificacion
)
SELECT 
    id, username, email, password_hash, nombres, apellidos,
    telefono, especialidad, numero_licencia, activo,
    convert_mysql_datetime(fecha_creacion::TEXT),
    convert_mysql_datetime(fecha_modificacion::TEXT)
FROM mysql_usuarios
WHERE activo = TRUE;
*/

-- =====================================================
-- CORRECCIÓN DE SECUENCIAS
-- =====================================================

-- Función para actualizar secuencias después de la migración
CREATE OR REPLACE FUNCTION actualizar_secuencias()
RETURNS VOID AS $$
DECLARE
    tabla_record RECORD;
    max_id INTEGER;
    seq_name TEXT;
BEGIN
    -- Actualizar secuencias para todas las tablas con SERIAL
    FOR tabla_record IN 
        SELECT table_name, column_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_default LIKE 'nextval%'
    LOOP
        -- Obtener el nombre de la secuencia
        SELECT pg_get_serial_sequence('public.' || tabla_record.table_name, tabla_record.column_name) INTO seq_name;
        
        -- Obtener el máximo ID actual
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', tabla_record.column_name, tabla_record.table_name) INTO max_id;
        
        -- Actualizar la secuencia
        IF seq_name IS NOT NULL AND max_id > 0 THEN
            EXECUTE format('SELECT setval(%L, %s)', seq_name, max_id + 1);
            RAISE NOTICE 'Secuencia % actualizada a %', seq_name, max_id + 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VALIDACIÓN POST-MIGRACIÓN
-- =====================================================

-- Función para validar la migración
CREATE OR REPLACE FUNCTION validar_migracion()
RETURNS TABLE(tabla VARCHAR, registros_migrados BIGINT, estado VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'USUARIOS'::VARCHAR as tabla,
        COUNT(*)::BIGINT as registros_migrados,
        CASE WHEN COUNT(*) > 0 THEN 'OK'::VARCHAR ELSE 'VACÍA'::VARCHAR END as estado
    FROM USUARIOS
    UNION ALL
    SELECT 
        'PACIENTES'::VARCHAR,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'OK'::VARCHAR ELSE 'VACÍA'::VARCHAR END
    FROM PACIENTES
    UNION ALL
    SELECT 
        'CITAS'::VARCHAR,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'OK'::VARCHAR ELSE 'VACÍA'::VARCHAR END
    FROM CITAS
    UNION ALL
    SELECT 
        'HISTORIAL_CLINICO'::VARCHAR,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'OK'::VARCHAR ELSE 'VACÍA'::VARCHAR END
    FROM HISTORIAL_CLINICO
    UNION ALL
    SELECT 
        'DOCUMENTOS'::VARCHAR,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'OK'::VARCHAR ELSE 'VACÍA'::VARCHAR END
    FROM DOCUMENTOS;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- LIMPIEZA Y OPTIMIZACIÓN POST-MIGRACIÓN
-- =====================================================

-- Función para optimizar después de la migración
CREATE OR REPLACE FUNCTION optimizar_post_migracion()
RETURNS VOID AS $$
BEGIN
    -- Actualizar estadísticas de todas las tablas
    ANALYZE;
    
    -- Reindexar todas las tablas
    REINDEX DATABASE ecodigital_dev;
    
    -- Limpiar espacio no utilizado
    VACUUM FULL;
    
    RAISE NOTICE 'Optimización post-migración completada';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCRIPT DE EJECUCIÓN COMPLETA
-- =====================================================

-- Función principal para ejecutar toda la migración
CREATE OR REPLACE FUNCTION ejecutar_migracion_completa()
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Iniciando migración de MySQL a PostgreSQL...';
    
    -- 1. Aquí iría la lógica de migración específica
    -- (dependiendo del método elegido: CSV, FDW, etc.)
    
    -- 2. Actualizar secuencias
    PERFORM actualizar_secuencias();
    
    -- 3. Habilitar triggers nuevamente
    SET session_replication_role = DEFAULT;
    
    -- 4. Optimizar base de datos
    PERFORM optimizar_post_migracion();
    
    -- 5. Mostrar resumen de validación
    RAISE NOTICE 'Migración completada. Ejecute SELECT * FROM validar_migracion(); para ver el resumen.';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INSTRUCCIONES DE USO
-- =====================================================

/*
INSTRUCCIONES PARA EJECUTAR LA MIGRACIÓN:

1. Preparar el entorno:
   - Asegúrese de que PostgreSQL esté instalado y configurado
   - Ejecute setup_database.sql primero para crear la estructura

2. Exportar datos de MySQL:
   Opción A - Usando mysqldump:
   mysqldump -u usuario -p --no-create-info --complete-insert ecodigital_mysql > mysql_data.sql
   
   Opción B - Exportar a CSV:
   SELECT * INTO OUTFILE '/tmp/usuarios.csv' 
   FIELDS TERMINATED BY ',' ENCLOSED BY '"' 
   LINES TERMINATED BY '\n' 
   FROM USUARIOS;

3. Importar datos a PostgreSQL:
   Opción A - Modificar el dump de MySQL y ejecutarlo
   Opción B - Usar COPY para importar CSVs
   Opción C - Usar Foreign Data Wrapper (FDW)

4. Ejecutar validación:
   SELECT * FROM validar_migracion();

5. Ejecutar optimización:
   SELECT optimizar_post_migracion();

NOTAS IMPORTANTES:
- Haga backup de sus datos antes de migrar
- Pruebe la migración en un entorno de desarrollo primero
- Verifique que todos los datos críticos se hayan migrado correctamente
- Actualice las cadenas de conexión en su aplicación
*/

-- =====================================================
-- MENSAJE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Script de Migración MySQL -> PostgreSQL';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Script preparado. Lea las instrucciones en los comentarios.';
    RAISE NOTICE 'Ejecute las funciones según su método de migración preferido.';
    RAISE NOTICE '==============================================';
END
$$;