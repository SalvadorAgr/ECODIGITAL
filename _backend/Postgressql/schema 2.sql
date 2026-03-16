-- This script defines the initial database schema.

-- Create the ROLES table to define different user access levels.
CREATE TABLE IF NOT EXISTS ROLES (
    id_role SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(100) NOT NULL UNIQUE,
    permisos JSONB -- Using JSONB for efficient permission querying.
);

-- Create the USUARIOS table to store user credentials and their assigned role.
CREATE TABLE IF NOT EXISTS USUARIOS (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    hash_password VARCHAR(255) NOT NULL,
    id_role INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_role
        FOREIGN KEY(id_role) 
        REFERENCES ROLES(id_role)
);

-- Create the PACIENTES table to store patient records.
CREATE TABLE IF NOT EXISTS PACIENTES (
    id_paciente SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255) NOT NULL,
    fecha_nac DATE NULL,
    datos_contacto JSONB NULL, -- Stores phone, email, address, etc.
    activo BOOLEAN NOT NULL DEFAULT TRUE -- For soft delete
);


-- Note: You will need to manually insert the roles into the ROLES table
-- after it's created, for example:
-- INSERT INTO ROLES (nombre_rol, permisos) VALUES ('Admin Principal', '{"admin": true}');
-- INSERT INTO ROLES (nombre_rol, permisos) VALUES ('Asistente', '{"patients": "read_write", "appointments": "read_write"}');

