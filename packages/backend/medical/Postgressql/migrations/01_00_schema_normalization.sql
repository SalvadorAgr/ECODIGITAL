-- =====================================================
-- EcoDigital - Schema Normalization Migration
-- Versión: 1.0
-- Descripción: Normaliza nombres de columnas y tablas
--              para cumplir con las especificaciones
-- =====================================================
-- IMPORTANTE: Este script DEBE ejecutarse después del
-- pre-migration check y ANTES de cualquier otro script
-- =====================================================

\echo '========================================'
\echo 'EcoDigital - Schema Normalization'
\echo '========================================'

-- =====================================================
-- BACKUP DE SEGURIDAD (Crear tablas de respaldo)
-- =====================================================
\echo ''
\echo '1. Creando tablas de respaldo...'

-- Crear esquema de respaldo
CREATE SCHEMA IF NOT EXISTS backup_migration;

-- Función para crear backup de tabla
CREATE OR REPLACE FUNCTION create_backup_table(table_name TEXT) RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP TABLE IF EXISTS backup_migration.%I', table_name);
    EXECUTE format('CREATE TABLE backup_migration.%I AS SELECT * FROM %I', table_name, table_name);
    RAISE NOTICE 'Backup creado para tabla: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Crear backups de tablas existentes
DO $$
DECLARE
    tablas TEXT[] := ARRAY['ROLES', 'USUARIOS', 'PACIENTES', 'CITAS', 'HISTORIAL_CLINICO', 'DOCUMENTOS'];
    tabla TEXT;
BEGIN
    FOREACH tabla IN ARRAY tablas
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tabla) THEN
            PERFORM create_backup_table(tabla);
        END IF;
    END LOOP;
END $$;

\echo '✓ Backups creados en esquema backup_migration'

-- =====================================================
-- NORMALIZACIÓN DE NOMBRES DE COLUMNAS PK
-- =====================================================
\echo ''
\echo '2. Normalizando nombres de columnas PK...'

-- =====================================================
-- ROLES: id_role -> id
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ROLES' AND column_name = 'id_role'
    ) THEN
        -- Verificar si ya existe la columna id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ROLES' AND column_name = 'id'
        ) THEN
            -- Renombrar columna
            ALTER TABLE ROLES RENAME COLUMN id_role TO id;
            RAISE NOTICE '✓ ROLES.id_role renombrado a id';
        ELSE
            RAISE NOTICE 'ROLES ya tiene columna id';
        END IF;
    ELSE
        RAISE NOTICE 'ROLES no tiene columna id_role (ya normalizado)';
    END IF;
END $$;

-- =====================================================
-- USUARIOS: id_usuario -> id
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'USUARIOS' AND column_name = 'id_usuario'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'USUARIOS' AND column_name = 'id'
        ) THEN
            ALTER TABLE USUARIOS RENAME COLUMN id_usuario TO id;
            RAISE NOTICE '✓ USUARIOS.id_usuario renombrado a id';
        ELSE
            RAISE NOTICE 'USUARIOS ya tiene columna id';
        END IF;
    ELSE
        RAISE NOTICE 'USUARIOS no tiene columna id_usuario (ya normalizado)';
    END IF;
END $$;

-- =====================================================
-- PACIENTES: id_paciente -> id
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PACIENTES' AND column_name = 'id_paciente'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'PACIENTES' AND column_name = 'id'
        ) THEN
            ALTER TABLE PACIENTES RENAME COLUMN id_paciente TO id;
            RAISE NOTICE '✓ PACIENTES.id_paciente renombrado a id';
        ELSE
            RAISE NOTICE 'PACIENTES ya tiene columna id';
        END IF;
    ELSE
        RAISE NOTICE 'PACIENTES no tiene columna id_paciente (ya normalizado)';
    END IF;
END $$;

-- =====================================================
-- NORMALIZACIÓN DE NOMBRES DE COLUMNAS EN ROLES
-- =====================================================
\echo ''
\echo '3. Normalizando nombres de columnas en ROLES...'

DO $$
BEGIN
    -- nombre_rol -> nombre
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ROLES' AND column_name = 'nombre_rol'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ROLES' AND column_name = 'nombre'
        ) THEN
            ALTER TABLE ROLES RENAME COLUMN nombre_rol TO nombre;
            RAISE NOTICE '✓ ROLES.nombre_rol renombrado a nombre';
        END IF;
    END IF;
END $$;

-- =====================================================
-- NORMALIZACIÓN DE NOMBRES DE COLUMNAS EN USUARIOS
-- =====================================================
\echo ''
\echo '4. Normalizando nombres de columnas en USUARIOS...'

DO $$
BEGIN
    -- nombre -> nombres (si existe nombre pero no nombres)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'USUARIOS' AND column_name = 'nombre'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'USUARIOS' AND column_name = 'nombres'
    ) THEN
        ALTER TABLE USUARIOS RENAME COLUMN nombre TO nombres;
        RAISE NOTICE '✓ USUARIOS.nombre renombrado a nombres';
    END IF;
END $$;

-- =====================================================
-- ACTUALIZACIÓN DE CLAVES FORÁNEAS
-- =====================================================
\echo ''
\echo '5. Actualizando referencias de claves foráneas...'

-- Eliminar y recrear constraints con nuevos nombres de columnas
-- Esto se hace de forma segura verificando existencia

-- SESIONES_USUARIO
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SESIONES_USUARIO') THEN
        -- Verificar si tiene columna usuario_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'SESIONES_USUARIO' AND column_name = 'usuario_id'
        ) THEN
            RAISE NOTICE 'SESIONES_USUARIO ya tiene columna usuario_id correcta';
        END IF;
    END IF;
END $$;

-- =====================================================
-- CREAR SECUENCIAS FALTANTES
-- =====================================================
\echo ''
\echo '6. Verificando y creando secuencias...'

-- Verificar y crear secuencias para tablas con SERIAL
DO $$
DECLARE
    seq_name TEXT;
BEGIN
    -- Verificar secuencia para ROLES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ROLES') THEN
        SELECT pg_get_serial_sequence('ROLES', 'id') INTO seq_name;
        IF seq_name IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS roles_id_seq;
            ALTER TABLE ROLES ALTER COLUMN id SET DEFAULT nextval('roles_id_seq'::regclass);
            RAISE NOTICE '✓ Secuencia creada para ROLES';
        END IF;
    END IF;
    
    -- Verificar secuencia para USUARIOS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        SELECT pg_get_serial_sequence('USUARIOS', 'id') INTO seq_name;
        IF seq_name IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS usuarios_id_seq;
            ALTER TABLE USUARIOS ALTER COLUMN id SET DEFAULT nextval('usuarios_id_seq'::regclass);
            RAISE NOTICE '✓ Secuencia creada para USUARIOS';
        END IF;
    END IF;
    
    -- Verificar secuencia para PACIENTES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PACIENTES') THEN
        SELECT pg_get_serial_sequence('PACIENTES', 'id') INTO seq_name;
        IF seq_name IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS pacientes_id_seq;
            ALTER TABLE PACIENTES ALTER COLUMN id SET DEFAULT nextval('pacientes_id_seq'::regclass);
            RAISE NOTICE '✓ Secuencia creada para PACIENTES';
        END IF;
    END IF;
END $$;

-- =====================================================
-- VERIFICAR Y AGREGAR COLUMNAS FALTANTES
-- =====================================================
\echo ''
\echo '7. Verificando y agregando columnas faltantes...'

-- ROLES: Agregar columnas faltantes según especificación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ROLES') THEN
        -- descripcion
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'descripcion') THEN
            ALTER TABLE ROLES ADD COLUMN descripcion TEXT;
            RAISE NOTICE '✓ Columna descripcion agregada a ROLES';
        END IF;
        
        -- nivel_acceso
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'nivel_acceso') THEN
            ALTER TABLE ROLES ADD COLUMN nivel_acceso VARCHAR(20) NOT NULL DEFAULT 'ASISTENTE' CHECK (nivel_acceso IN ('ADMIN_PRINCIPAL', 'ADMIN_SECUNDARIO', 'ASISTENTE', 'INVITADO'));
            RAISE NOTICE '✓ Columna nivel_acceso agregada a ROLES';
        END IF;
        
        -- es_sistema
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'es_sistema') THEN
            ALTER TABLE ROLES ADD COLUMN es_sistema BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✓ Columna es_sistema agregada a ROLES';
        END IF;
        
        -- timeout_sesion
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'timeout_sesion') THEN
            ALTER TABLE ROLES ADD COLUMN timeout_sesion INTEGER DEFAULT 3600;
            RAISE NOTICE '✓ Columna timeout_sesion agregada a ROLES';
        END IF;
        
        -- max_sesiones_concurrentes
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'max_sesiones_concurrentes') THEN
            ALTER TABLE ROLES ADD COLUMN max_sesiones_concurrentes INTEGER DEFAULT 3;
            RAISE NOTICE '✓ Columna max_sesiones_concurrentes agregada a ROLES';
        END IF;
        
        -- activo
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'activo') THEN
            ALTER TABLE ROLES ADD COLUMN activo BOOLEAN DEFAULT TRUE;
            RAISE NOTICE '✓ Columna activo agregada a ROLES';
        END IF;
        
        -- Campos de auditoría
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'creado_por') THEN
            ALTER TABLE ROLES ADD COLUMN creado_por INTEGER;
            RAISE NOTICE '✓ Columna creado_por agregada a ROLES';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'modificado_por') THEN
            ALTER TABLE ROLES ADD COLUMN modificado_por INTEGER;
            RAISE NOTICE '✓ Columna modificado_por agregada a ROLES';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'fecha_creacion') THEN
            ALTER TABLE ROLES ADD COLUMN fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE '✓ Columna fecha_creacion agregada a ROLES';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ROLES' AND column_name = 'fecha_modificacion') THEN
            ALTER TABLE ROLES ADD COLUMN fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE '✓ Columna fecha_modificacion agregada a ROLES';
        END IF;
    END IF;
END $$;

-- USUARIOS: Agregar columnas faltantes según especificación
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        -- Verificar columnas esenciales
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'salt') THEN
            ALTER TABLE USUARIOS ADD COLUMN salt VARCHAR(32);
            RAISE NOTICE '✓ Columna salt agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'apellidos') THEN
            ALTER TABLE USUARIOS ADD COLUMN apellidos VARCHAR(100);
            RAISE NOTICE '✓ Columna apellidos agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'telefono') THEN
            ALTER TABLE USUARIOS ADD COLUMN telefono VARCHAR(20);
            RAISE NOTICE '✓ Columna telefono agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'cedula') THEN
            ALTER TABLE USUARIOS ADD COLUMN cedula VARCHAR(20) UNIQUE;
            RAISE NOTICE '✓ Columna cedula agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'foto_perfil') THEN
            ALTER TABLE USUARIOS ADD COLUMN foto_perfil VARCHAR(255);
            RAISE NOTICE '✓ Columna foto_perfil agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'titulo_profesional') THEN
            ALTER TABLE USUARIOS ADD COLUMN titulo_profesional VARCHAR(100);
            RAISE NOTICE '✓ Columna titulo_profesional agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'especialidad') THEN
            ALTER TABLE USUARIOS ADD COLUMN especialidad VARCHAR(100);
            RAISE NOTICE '✓ Columna especialidad agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'numero_colegiado') THEN
            ALTER TABLE USUARIOS ADD COLUMN numero_colegiado VARCHAR(50);
            RAISE NOTICE '✓ Columna numero_colegiado agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'firma_digital') THEN
            ALTER TABLE USUARIOS ADD COLUMN firma_digital VARCHAR(255);
            RAISE NOTICE '✓ Columna firma_digital agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'verificado') THEN
            ALTER TABLE USUARIOS ADD COLUMN verificado BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✓ Columna verificado agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'bloqueado') THEN
            ALTER TABLE USUARIOS ADD COLUMN bloqueado BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✓ Columna bloqueado agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'intentos_fallidos') THEN
            ALTER TABLE USUARIOS ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;
            RAISE NOTICE '✓ Columna intentos_fallidos agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'fecha_bloqueo') THEN
            ALTER TABLE USUARIOS ADD COLUMN fecha_bloqueo TIMESTAMP NULL;
            RAISE NOTICE '✓ Columna fecha_bloqueo agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'fecha_ultimo_acceso') THEN
            ALTER TABLE USUARIOS ADD COLUMN fecha_ultimo_acceso TIMESTAMP NULL;
            RAISE NOTICE '✓ Columna fecha_ultimo_acceso agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'cambiar_password') THEN
            ALTER TABLE USUARIOS ADD COLUMN cambiar_password BOOLEAN DEFAULT TRUE;
            RAISE NOTICE '✓ Columna cambiar_password agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'fecha_expiracion_password') THEN
            ALTER TABLE USUARIOS ADD COLUMN fecha_expiracion_password TIMESTAMP NULL;
            RAISE NOTICE '✓ Columna fecha_expiracion_password agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'token_recuperacion') THEN
            ALTER TABLE USUARIOS ADD COLUMN token_recuperacion VARCHAR(255) NULL;
            RAISE NOTICE '✓ Columna token_recuperacion agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'fecha_expiracion_token') THEN
            ALTER TABLE USUARIOS ADD COLUMN fecha_expiracion_token TIMESTAMP NULL;
            RAISE NOTICE '✓ Columna fecha_expiracion_token agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'two_factor_enabled') THEN
            ALTER TABLE USUARIOS ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✓ Columna two_factor_enabled agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'two_factor_secret') THEN
            ALTER TABLE USUARIOS ADD COLUMN two_factor_secret VARCHAR(32) NULL;
            RAISE NOTICE '✓ Columna two_factor_secret agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'preferencias') THEN
            ALTER TABLE USUARIOS ADD COLUMN preferencias JSONB;
            RAISE NOTICE '✓ Columna preferencias agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'timezone') THEN
            ALTER TABLE USUARIOS ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Santo_Domingo';
            RAISE NOTICE '✓ Columna timezone agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'idioma') THEN
            ALTER TABLE USUARIOS ADD COLUMN idioma VARCHAR(5) DEFAULT 'es';
            RAISE NOTICE '✓ Columna idioma agregada a USUARIOS';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'tema') THEN
            ALTER TABLE USUARIOS ADD COLUMN tema VARCHAR(10) DEFAULT 'dark' CHECK (tema IN ('dark', 'light', 'auto'));
            RAISE NOTICE '✓ Columna tema agregada a USUARIOS';
        END IF;
        
        -- Renombrar password_hash si es necesario
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'hash_password') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'password_hash') THEN
                ALTER TABLE USUARIOS RENAME COLUMN hash_password TO password_hash;
                RAISE NOTICE '✓ USUARIOS.hash_password renombrado a password_hash';
            END IF;
        END IF;
        
        -- Renombrar nombre a nombres si es necesario
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'nombre') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'nombres') THEN
                ALTER TABLE USUARIOS RENAME COLUMN nombre TO nombres;
                RAISE NOTICE '✓ USUARIOS.nombre renombrado a nombres';
            END IF;
        END IF;
        
        -- Renombrar id_role a rol_id si es necesario
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'id_role') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'USUARIOS' AND column_name = 'rol_id') THEN
                ALTER TABLE USUARIOS RENAME COLUMN id_role TO rol_id;
                RAISE NOTICE '✓ USUARIOS.id_role renombrado a rol_id';
            END IF;
        END IF;
    END IF;
END $$;

-- =====================================================
-- ACTUALIZAR CONSTRAINTS Y FKs
-- =====================================================
\echo ''
\echo '8. Actualizando constraints y claves foráneas...'

-- Eliminar constraints antiguos si existen y crear nuevos
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- USUARIOS -> ROLES FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'USUARIOS') THEN
        -- Buscar constraint FK existente
        SELECT conname INTO constraint_name
        FROM pg_constraint 
        WHERE conrelid = 'USUARIOS'::regclass 
        AND contype = 'f' 
        AND conname LIKE '%role%';
        
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE USUARIOS DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Constraint FK antiguo eliminado: %', constraint_name;
        END IF;
        
        -- Crear nuevo constraint
        BEGIN
            EXECUTE 'ALTER TABLE USUARIOS ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES ROLES(id) ON DELETE RESTRICT ON UPDATE CASCADE';
            RAISE NOTICE '✓ Constraint fk_usuarios_rol creado';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Constraint fk_usuarios_rol ya existe o no se pudo crear: %', SQLERRM;
        END;
    END IF;
END $$;

\echo ''
\echo '========================================'
\echo 'Schema Normalization Completado'
\echo '========================================'
\echo ''
\echo 'Los backups están disponibles en el esquema backup_migration'
\echo 'Para revertir cambios, use el script de rollback'
\echo '========================================'