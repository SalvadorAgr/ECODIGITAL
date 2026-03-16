-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Database Setup Script (PostgreSQL)
-- Descripción: Script completo para configurar la base de datos
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- Crear la base de datos si no existe (ejecutar como superusuario)
-- CREATE DATABASE ecodigital_dev;
-- CREATE DATABASE ecodigital_test;
-- CREATE DATABASE ecodigital_prod;

-- Conectar a la base de datos
-- \c ecodigital_dev;

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- EJECUTAR SCHEMAS EN ORDEN CORRECTO
-- =====================================================

-- 1. Usuarios y Roles (base del sistema)
\i 01_usuarios_y_roles_postgresql.sql

-- 2. Pacientes y Historial Clínico
\i 02_pacientes_y_historial_postgresql.sql

-- 3. Citas y Documentos
\i 03_citas_y_documentos_postgresql.sql

-- 4. Auditoría y Logs
\i 04_auditoria_y_logs_postgresql.sql

-- 5. Recursos y Reservas
\i 05_recursos_y_reservas_postgresql.sql

-- 6. Excepciones de Horario Mejoradas
\i 06_enhanced_schedule_exceptions_postgresql.sql

-- 7. Citas Recurrentes
\i 07_citas_recurrentes_postgresql.sql

-- 8. Sistema de Prioridades
\i 08_priority_system_postgresql.sql

-- 9. Gestión de Lista de Espera
\i 09_waitlist_management_postgresql.sql

-- 10. Automatización de Lista de Espera
\i 10_waitlist_automation_postgresql.sql

-- =====================================================
-- CONFIGURACIONES ADICIONALES
-- =====================================================

-- Configurar timezone por defecto
SET timezone = 'America/Mexico_City';

-- Configurar formato de fecha
SET datestyle = 'ISO, MDY';

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para generar números de expediente únicos
CREATE OR REPLACE FUNCTION generar_numero_expediente()
RETURNS VARCHAR(20) AS $$
DECLARE
    nuevo_numero VARCHAR(20);
    existe BOOLEAN;
BEGIN
    LOOP
        -- Generar número con formato: EXP-YYYY-NNNNNN
        nuevo_numero := 'EXP-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || 
                       LPAD((FLOOR(RANDOM() * 999999) + 1)::TEXT, 6, '0');
        
        -- Verificar si ya existe
        SELECT EXISTS(SELECT 1 FROM PACIENTES WHERE numero_expediente = nuevo_numero) INTO existe;
        
        -- Si no existe, salir del loop
        IF NOT existe THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- Función para generar números de cita únicos
CREATE OR REPLACE FUNCTION generar_numero_cita()
RETURNS VARCHAR(20) AS $$
DECLARE
    nuevo_numero VARCHAR(20);
    existe BOOLEAN;
BEGIN
    LOOP
        -- Generar número con formato: CITA-YYYY-NNNNNN
        nuevo_numero := 'CITA-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || 
                       LPAD((FLOOR(RANDOM() * 999999) + 1)::TEXT, 6, '0');
        
        -- Verificar si ya existe
        SELECT EXISTS(SELECT 1 FROM CITAS WHERE numero_cita = nuevo_numero) INTO existe;
        
        -- Si no existe, salir del loop
        IF NOT existe THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- Función para generar números de lista de espera únicos
CREATE OR REPLACE FUNCTION generar_numero_lista_espera()
RETURNS VARCHAR(20) AS $$
DECLARE
    nuevo_numero VARCHAR(20);
    existe BOOLEAN;
BEGIN
    LOOP
        -- Generar número con formato: LE-YYYY-NNNNNN
        nuevo_numero := 'LE-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || 
                       LPAD((FLOOR(RANDOM() * 999999) + 1)::TEXT, 6, '0');
        
        -- Verificar si ya existe
        SELECT EXISTS(SELECT 1 FROM LISTA_ESPERA WHERE numero_lista = nuevo_numero) INTO existe;
        
        -- Si no existe, salir del loop
        IF NOT existe THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS PARA GENERAR NÚMEROS AUTOMÁTICAMENTE
-- =====================================================

-- Trigger para generar número de expediente automáticamente
CREATE OR REPLACE FUNCTION trigger_generar_numero_expediente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_expediente IS NULL OR NEW.numero_expediente = '' THEN
        NEW.numero_expediente := generar_numero_expediente();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pacientes_numero_expediente
    BEFORE INSERT ON PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generar_numero_expediente();

-- Trigger para generar número de cita automáticamente
CREATE OR REPLACE FUNCTION trigger_generar_numero_cita()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_cita IS NULL OR NEW.numero_cita = '' THEN
        NEW.numero_cita := generar_numero_cita();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_citas_numero_cita
    BEFORE INSERT ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generar_numero_cita();

-- Trigger para generar número de lista de espera automáticamente
CREATE OR REPLACE FUNCTION trigger_generar_numero_lista_espera()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_lista IS NULL OR NEW.numero_lista = '' THEN
        NEW.numero_lista := generar_numero_lista_espera();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lista_espera_numero_lista
    BEFORE INSERT ON LISTA_ESPERA
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generar_numero_lista_espera();

-- =====================================================
-- ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =====================================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_pacientes_busqueda ON PACIENTES(nombre, apellido) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_consulta) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_documentos_paciente_tipo ON DOCUMENTOS(id_paciente, tipo_documento) WHERE activo = TRUE;

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_logs_fecha_usuario ON LOGS_AUDITORIA(fecha_hora, id_usuario_autor);
CREATE INDEX IF NOT EXISTS idx_logs_tabla_operacion ON LOGS_AUDITORIA(tabla_afectada, tipo_operacion);

-- =====================================================
-- CONFIGURACIONES DE SEGURIDAD
-- =====================================================

-- Crear roles de base de datos
DO $$
BEGIN
    -- Rol para aplicación (lectura/escritura limitada)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ecodigital_app') THEN
        CREATE ROLE ecodigital_app LOGIN PASSWORD 'change_me_in_production';
    END IF;
    
    -- Rol para solo lectura (reportes)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ecodigital_readonly') THEN
        CREATE ROLE ecodigital_readonly LOGIN PASSWORD 'change_me_in_production';
    END IF;
    
    -- Rol para administración
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ecodigital_admin') THEN
        CREATE ROLE ecodigital_admin LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

-- Asignar permisos al rol de aplicación
GRANT CONNECT ON DATABASE ecodigital_dev TO ecodigital_app;
GRANT USAGE ON SCHEMA public TO ecodigital_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ecodigital_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecodigital_app;

-- Asignar permisos al rol de solo lectura
GRANT CONNECT ON DATABASE ecodigital_dev TO ecodigital_readonly;
GRANT USAGE ON SCHEMA public TO ecodigital_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ecodigital_readonly;

-- Asignar permisos al rol de administración
GRANT ALL PRIVILEGES ON DATABASE ecodigital_dev TO ecodigital_admin;

-- =====================================================
-- CONFIGURACIONES DE RENDIMIENTO
-- =====================================================

-- Configurar parámetros de rendimiento para desarrollo
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Recargar configuración (requiere privilegios de superusuario)
-- SELECT pg_reload_conf();

-- =====================================================
-- VERIFICACIÓN DE INTEGRIDAD
-- =====================================================

-- Función para verificar la integridad de la base de datos
CREATE OR REPLACE FUNCTION verificar_integridad_bd()
RETURNS TABLE(tabla VARCHAR, estado VARCHAR, mensaje TEXT) AS $$
BEGIN
    -- Verificar que todas las tablas principales existen
    RETURN QUERY
    SELECT 
        t.table_name::VARCHAR as tabla,
        CASE WHEN t.table_name IS NOT NULL THEN 'OK'::VARCHAR ELSE 'ERROR'::VARCHAR END as estado,
        CASE WHEN t.table_name IS NOT NULL 
             THEN 'Tabla existe correctamente'::TEXT 
             ELSE 'Tabla no encontrada'::TEXT 
        END as mensaje
    FROM (VALUES 
        ('USUARIOS'), ('ROLES'), ('PACIENTES'), ('CITAS'), 
        ('HISTORIAL_CLINICO'), ('DOCUMENTOS'), ('LOGS_AUDITORIA'),
        ('RECURSOS'), ('RESERVAS'), ('EXCEPCIONES_HORARIO'),
        ('CITAS_RECURRENTES'), ('CONFIGURACION_PRIORIDADES'),
        ('LISTA_ESPERA'), ('SLOTS_PENDIENTES_PROCESAMIENTO')
    ) AS expected(table_name)
    LEFT JOIN information_schema.tables t 
        ON t.table_name = expected.table_name 
        AND t.table_schema = 'public';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MENSAJE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'EcoDigital Database Setup Completado';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Base de datos configurada exitosamente.';
    RAISE NOTICE 'Ejecute SELECT * FROM verificar_integridad_bd(); para verificar.';
    RAISE NOTICE 'Recuerde cambiar las contraseñas por defecto en producción.';
    RAISE NOTICE '==============================================';
END
$$;