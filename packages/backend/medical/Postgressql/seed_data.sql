-- =====================================================
-- EcoSecial - Sistema de Gestión Médica
-- Seed Data Script (PostgreSQL)
-- Descripción: Datos de prueba para desarrollo y testing
-- Autor: Sistema EcoSecial
-- Fecha: 2024
-- =====================================================

-- IMPORTANTE: Este script debe ejecutarse DESPUÉS de setup_database.sql

-- =====================================================
-- LIMPIAR DATOS EXISTENTES (SOLO PARA DESARROLLO)
-- =====================================================

-- Deshabilitar verificación de claves foráneas temporalmente
SET session_replication_role = replica;

-- Limpiar tablas en orden inverso de dependencias
TRUNCATE TABLE SLOTS_PENDIENTES_PROCESAMIENTO CASCADE;
TRUNCATE TABLE METRICAS_AUTOMATIZACION_WAITLIST CASCADE;
TRUNCATE TABLE HISTORIAL_LISTA_ESPERA CASCADE;
TRUNCATE TABLE NOTIFICACIONES_LISTA_ESPERA CASCADE;
TRUNCATE TABLE LISTA_ESPERA CASCADE;
TRUNCATE TABLE HISTORIAL_PRIORIDADES CASCADE;
TRUNCATE TABLE REGLAS_ESCALACION CASCADE;
TRUNCATE TABLE CITAS_RECURRENTES_EXCEPCIONES CASCADE;
TRUNCATE TABLE CITAS_RECURRENTES_INSTANCIAS CASCADE;
TRUNCATE TABLE CITAS_RECURRENTES CASCADE;
TRUNCATE TABLE EXCEPCIONES_HORARIO CASCADE;
TRUNCATE TABLE RESERVAS CASCADE;
TRUNCATE TABLE RECURSOS CASCADE;
TRUNCATE TABLE LOGS_AUDITORIA CASCADE;
TRUNCATE TABLE DOCUMENTOS CASCADE;
TRUNCATE TABLE HISTORIAL_CLINICO CASCADE;
TRUNCATE TABLE CITAS CASCADE;
TRUNCATE TABLE PACIENTES CASCADE;
TRUNCATE TABLE USUARIOS_ROLES CASCADE;
TRUNCATE TABLE USUARIOS CASCADE;
TRUNCATE TABLE ROLES CASCADE;

-- Reiniciar secuencias
ALTER SEQUENCE roles_id_seq RESTART WITH 1;
ALTER SEQUENCE usuarios_id_seq RESTART WITH 1;
ALTER SEQUENCE pacientes_id_seq RESTART WITH 1;
ALTER SEQUENCE citas_id_seq RESTART WITH 1;
ALTER SEQUENCE historial_clinico_id_seq RESTART WITH 1;
ALTER SEQUENCE documentos_id_seq RESTART WITH 1;
ALTER SEQUENCE logs_auditoria_id_seq RESTART WITH 1;
ALTER SEQUENCE recursos_id_seq RESTART WITH 1;
ALTER SEQUENCE reservas_id_seq RESTART WITH 1;
ALTER SEQUENCE excepciones_horario_id_seq RESTART WITH 1;
ALTER SEQUENCE citas_recurrentes_id_seq RESTART WITH 1;
ALTER SEQUENCE citas_recurrentes_instancias_id_seq RESTART WITH 1;
ALTER SEQUENCE citas_recurrentes_excepciones_id_seq RESTART WITH 1;
ALTER SEQUENCE configuracion_prioridades_id_seq RESTART WITH 1;
ALTER SEQUENCE historial_prioridades_id_seq RESTART WITH 1;
ALTER SEQUENCE reglas_escalacion_id_seq RESTART WITH 1;
ALTER SEQUENCE lista_espera_id_seq RESTART WITH 1;
ALTER SEQUENCE notificaciones_lista_espera_id_seq RESTART WITH 1;
ALTER SEQUENCE historial_lista_espera_id_seq RESTART WITH 1;
ALTER SEQUENCE configuracion_lista_espera_id_seq RESTART WITH 1;
ALTER SEQUENCE slots_pendientes_procesamiento_id_seq RESTART WITH 1;
ALTER SEQUENCE metricas_automatizacion_waitlist_id_seq RESTART WITH 1;
ALTER SEQUENCE configuracion_automatizacion_waitlist_id_seq RESTART WITH 1;

-- =====================================================
-- INSERTAR ROLES DEL SISTEMA
-- =====================================================

INSERT INTO ROLES (nombre_rol, descripcion, permisos, activo, fecha_creacion) VALUES
('SUPER_ADMIN', 'Administrador del sistema con acceso completo', 
 '{"usuarios": ["create", "read", "update", "delete"], "pacientes": ["create", "read", "update", "delete"], "citas": ["create", "read", "update", "delete"], "reportes": ["read"], "configuracion": ["create", "read", "update", "delete"]}', 
 TRUE, CURRENT_TIMESTAMP),

('ADMIN', 'Administrador con permisos de gestión', 
 '{"usuarios": ["create", "read", "update"], "pacientes": ["create", "read", "update", "delete"], "citas": ["create", "read", "update", "delete"], "reportes": ["read"], "configuracion": ["read", "update"]}', 
 TRUE, CURRENT_TIMESTAMP),

('MEDICO', 'Médico con acceso a pacientes y citas', 
 '{"pacientes": ["create", "read", "update"], "citas": ["create", "read", "update"], "historial": ["create", "read", "update"], "documentos": ["create", "read", "update"]}', 
 TRUE, CURRENT_TIMESTAMP),

('ENFERMERA', 'Enfermera con acceso limitado', 
 '{"pacientes": ["read", "update"], "citas": ["read", "update"], "historial": ["read"]}', 
 TRUE, CURRENT_TIMESTAMP),

('RECEPCIONISTA', 'Recepcionista para gestión de citas', 
 '{"pacientes": ["create", "read", "update"], "citas": ["create", "read", "update"]}', 
 TRUE, CURRENT_TIMESTAMP),

('PACIENTE', 'Paciente con acceso a su información', 
 '{"perfil": ["read", "update"], "citas": ["read"], "historial": ["read"], "documentos": ["read"]}', 
 TRUE, CURRENT_TIMESTAMP);

-- =====================================================
-- INSERTAR USUARIOS DE PRUEBA
-- =====================================================

INSERT INTO USUARIOS (username, email, password_hash, nombres, apellidos, telefono, especialidad, numero_licencia, activo, fecha_creacion) VALUES
-- Administradores
('admin', 'admin@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Administrador', 'Sistema', '+52-555-0001', NULL, NULL, TRUE, CURRENT_TIMESTAMP),
('superadmin', 'superadmin@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Super', 'Administrador', '+52-555-0002', NULL, NULL, TRUE, CURRENT_TIMESTAMP),

-- Médicos
('dr.garcia', 'garcia@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Carlos', 'García López', '+52-555-1001', 'Medicina General', 'MED-001-2020', TRUE, CURRENT_TIMESTAMP),
('dra.martinez', 'martinez@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'María', 'Martínez Ruiz', '+52-555-1002', 'Cardiología', 'MED-002-2019', TRUE, CURRENT_TIMESTAMP),
('dr.rodriguez', 'rodriguez@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Luis', 'Rodríguez Pérez', '+52-555-1003', 'Pediatría', 'MED-003-2021', TRUE, CURRENT_TIMESTAMP),
('dra.lopez', 'lopez@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Ana', 'López Hernández', '+52-555-1004', 'Ginecología', 'MED-004-2018', TRUE, CURRENT_TIMESTAMP),

-- Enfermeras
('enf.gonzalez', 'gonzalez@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Carmen', 'González Morales', '+52-555-2001', 'Enfermería', 'ENF-001-2020', TRUE, CURRENT_TIMESTAMP),
('enf.sanchez', 'sanchez@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Patricia', 'Sánchez Vega', '+52-555-2002', 'Enfermería', 'ENF-002-2019', TRUE, CURRENT_TIMESTAMP),

-- Recepcionistas
('recep.torres', 'torres@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Isabel', 'Torres Jiménez', '+52-555-3001', NULL, NULL, TRUE, CURRENT_TIMESTAMP),
('recep.morales', 'morales@ecodigital.com', '$2b$10$rOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQjQjQjQjOzJqQnQjQjQjQ', 'Rosa', 'Morales Castro', '+52-555-3002', NULL, NULL, TRUE, CURRENT_TIMESTAMP);

-- =====================================================
-- ASIGNAR ROLES A USUARIOS
-- =====================================================

INSERT INTO USUARIOS_ROLES (usuario_id, rol_id, fecha_asignacion) VALUES
-- Administradores
(1, 2, CURRENT_TIMESTAMP), -- admin -> ADMIN
(2, 1, CURRENT_TIMESTAMP), -- superadmin -> SUPER_ADMIN

-- Médicos
(3, 3, CURRENT_TIMESTAMP), -- dr.garcia -> MEDICO
(4, 3, CURRENT_TIMESTAMP), -- dra.martinez -> MEDICO
(5, 3, CURRENT_TIMESTAMP), -- dr.rodriguez -> MEDICO
(6, 3, CURRENT_TIMESTAMP), -- dra.lopez -> MEDICO

-- Enfermeras
(7, 4, CURRENT_TIMESTAMP), -- enf.gonzalez -> ENFERMERA
(8, 4, CURRENT_TIMESTAMP), -- enf.sanchez -> ENFERMERA

-- Recepcionistas
(9, 5, CURRENT_TIMESTAMP), -- recep.torres -> RECEPCIONISTA
(10, 5, CURRENT_TIMESTAMP); -- recep.morales -> RECEPCIONISTA

-- =====================================================
-- INSERTAR PACIENTES DE PRUEBA
-- =====================================================

INSERT INTO PACIENTES (nombre, apellido, fecha_nacimiento, genero, telefono, email, direccion, contacto_emergencia, activo, fecha_creacion) VALUES
('Juan', 'Pérez González', '1985-03-15', 'M', '+52-555-4001', 'juan.perez@email.com', 'Av. Principal 123, Col. Centro, Ciudad de México', '{"nombre": "María Pérez", "telefono": "+52-555-4002", "relacion": "Esposa"}', TRUE, CURRENT_TIMESTAMP),
('María', 'López Martínez', '1990-07-22', 'F', '+52-555-4003', 'maria.lopez@email.com', 'Calle Secundaria 456, Col. Roma Norte, Ciudad de México', '{"nombre": "Carlos López", "telefono": "+52-555-4004", "relacion": "Esposo"}', TRUE, CURRENT_TIMESTAMP),
('Carlos', 'Rodríguez Sánchez', '1978-11-08', 'M', '+52-555-4005', 'carlos.rodriguez@email.com', 'Av. Insurgentes 789, Col. Condesa, Ciudad de México', '{"nombre": "Ana Rodríguez", "telefono": "+52-555-4006", "relacion": "Esposa"}', TRUE, CURRENT_TIMESTAMP),
('Ana', 'García Hernández', '1995-02-14', 'F', '+52-555-4007', 'ana.garcia@email.com', 'Calle Reforma 321, Col. Juárez, Ciudad de México', '{"nombre": "Luis García", "telefono": "+52-555-4008", "relacion": "Padre"}', TRUE, CURRENT_TIMESTAMP),
('Luis', 'Martínez Torres', '1982-09-30', 'M', '+52-555-4009', 'luis.martinez@email.com', 'Av. Universidad 654, Col. Del Valle, Ciudad de México', '{"nombre": "Carmen Martínez", "telefono": "+52-555-4010", "relacion": "Madre"}', TRUE, CURRENT_TIMESTAMP),
('Carmen', 'Hernández Flores', '1988-12-05', 'F', '+52-555-4011', 'carmen.hernandez@email.com', 'Calle Revolución 987, Col. San Rafael, Ciudad de México', '{"nombre": "Pedro Hernández", "telefono": "+52-555-4012", "relacion": "Esposo"}', TRUE, CURRENT_TIMESTAMP),
('Pedro', 'Flores Morales', '1975-06-18', 'M', '+52-555-4013', 'pedro.flores@email.com', 'Av. Chapultepec 147, Col. Doctores, Ciudad de México', '{"nombre": "Rosa Flores", "telefono": "+52-555-4014", "relacion": "Esposa"}', TRUE, CURRENT_TIMESTAMP),
('Rosa', 'Morales Vega', '1992-04-25', 'F', '+52-555-4015', 'rosa.morales@email.com', 'Calle Hidalgo 258, Col. Centro Histórico, Ciudad de México', '{"nombre": "Miguel Morales", "telefono": "+52-555-4016", "relacion": "Hermano"}', TRUE, CURRENT_TIMESTAMP),
('Miguel', 'Vega Castro', '1987-01-12', 'M', '+52-555-4017', 'miguel.vega@email.com', 'Av. Patriotismo 369, Col. San Pedro de los Pinos, Ciudad de México', '{"nombre": "Laura Vega", "telefono": "+52-555-4018", "relacion": "Esposa"}', TRUE, CURRENT_TIMESTAMP),
('Laura', 'Castro Jiménez', '1993-08-07', 'F', '+52-555-4019', 'laura.castro@email.com', 'Calle Madero 741, Col. Tabacalera, Ciudad de México', '{"nombre": "Roberto Castro", "telefono": "+52-555-4020", "relacion": "Padre"}', TRUE, CURRENT_TIMESTAMP);

-- =====================================================
-- INSERTAR CITAS DE PRUEBA
-- =====================================================

INSERT INTO CITAS (id_paciente, medico_id, fecha_hora, duracion_minutos, tipo_cita, motivo, estado, prioridad, activo, fecha_creacion) VALUES
-- Citas para hoy y próximos días
(1, 3, CURRENT_DATE + INTERVAL '1 day' + TIME '09:00', 30, 'CONSULTA_GENERAL', 'Consulta de rutina', 'PROGRAMADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP),
(2, 4, CURRENT_DATE + INTERVAL '1 day' + TIME '10:00', 45, 'PRIMERA_VEZ', 'Primera consulta cardiológica', 'PROGRAMADA', 'ALTA', TRUE, CURRENT_TIMESTAMP),
(3, 5, CURRENT_DATE + INTERVAL '1 day' + TIME '11:00', 30, 'SEGUIMIENTO', 'Control pediátrico', 'PROGRAMADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP),
(4, 6, CURRENT_DATE + INTERVAL '2 days' + TIME '09:30', 60, 'CONSULTA_GENERAL', 'Consulta ginecológica', 'PROGRAMADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP),
(5, 3, CURRENT_DATE + INTERVAL '2 days' + TIME '14:00', 30, 'CONTROL', 'Control post-tratamiento', 'PROGRAMADA', 'BAJA', TRUE, CURRENT_TIMESTAMP),

-- Citas pasadas (completadas)
(6, 4, CURRENT_DATE - INTERVAL '1 day' + TIME '10:00', 45, 'CONSULTA_GENERAL', 'Revisión cardiológica', 'COMPLETADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(7, 5, CURRENT_DATE - INTERVAL '2 days' + TIME '15:00', 30, 'SEGUIMIENTO', 'Control pediátrico mensual', 'COMPLETADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP - INTERVAL '3 days'),
(8, 3, CURRENT_DATE - INTERVAL '3 days' + TIME '11:30', 30, 'PRIMERA_VEZ', 'Primera consulta', 'COMPLETADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP - INTERVAL '4 days'),

-- Citas canceladas
(9, 6, CURRENT_DATE + INTERVAL '3 days' + TIME '16:00', 60, 'CONSULTA_GENERAL', 'Consulta programada', 'CANCELADA', 'NORMAL', TRUE, CURRENT_TIMESTAMP),
(10, 4, CURRENT_DATE + INTERVAL '4 days' + TIME '12:00', 45, 'SEGUIMIENTO', 'Control cardiológico', 'CANCELADA', 'ALTA', TRUE, CURRENT_TIMESTAMP);

-- =====================================================
-- INSERTAR HISTORIAL CLÍNICO DE PRUEBA
-- =====================================================

INSERT INTO HISTORIAL_CLINICO (id_paciente, medico_id, fecha_consulta, motivo_consulta, sintomas, diagnostico, tratamiento, observaciones, activo, fecha_creacion) VALUES
(1, 3, CURRENT_DATE - INTERVAL '30 days', 'Consulta de rutina', 'Dolor de cabeza ocasional', 'Cefalea tensional', 'Paracetamol 500mg cada 8 horas por 3 días', 'Paciente en buen estado general', TRUE, CURRENT_TIMESTAMP - INTERVAL '30 days'),
(2, 4, CURRENT_DATE - INTERVAL '15 days', 'Dolor en el pecho', 'Dolor precordial, palpitaciones', 'Arritmia sinusal leve', 'Betabloqueador 25mg diario, control en 1 mes', 'ECG muestra arritmia leve, ecocardiograma normal', TRUE, CURRENT_TIMESTAMP - INTERVAL '15 days'),
(3, 5, CURRENT_DATE - INTERVAL '7 days', 'Control de crecimiento', 'Ninguno', 'Desarrollo normal para la edad', 'Continuar con alimentación balanceada', 'Peso y talla dentro de percentiles normales', TRUE, CURRENT_TIMESTAMP - INTERVAL '7 days'),
(4, 6, CURRENT_DATE - INTERVAL '20 days', 'Consulta ginecológica', 'Irregularidades menstruales', 'Síndrome premenstrual', 'Anticonceptivos orales, control en 3 meses', 'Examen físico normal, se solicitan estudios hormonales', TRUE, CURRENT_TIMESTAMP - INTERVAL '20 days'),
(5, 3, CURRENT_DATE - INTERVAL '45 days', 'Dolor abdominal', 'Dolor epigástrico, náuseas', 'Gastritis aguda', 'Omeprazol 20mg en ayunas por 14 días, dieta blanda', 'Se recomienda evitar irritantes gástricos', TRUE, CURRENT_TIMESTAMP - INTERVAL '45 days');

-- =====================================================
-- INSERTAR DOCUMENTOS DE PRUEBA
-- =====================================================

INSERT INTO DOCUMENTOS (id_paciente, tipo_documento, nombre_archivo, ruta_archivo, tamaño_bytes, mime_type, descripcion, activo, fecha_creacion) VALUES
(1, 'LABORATORIO', 'analisis_sangre_juan_perez.pdf', '/documentos/2024/01/analisis_sangre_juan_perez.pdf', 245760, 'application/pdf', 'Análisis de sangre completo', TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days'),
(2, 'IMAGEN', 'ekg_maria_lopez.pdf', '/documentos/2024/01/ekg_maria_lopez.pdf', 512000, 'application/pdf', 'Electrocardiograma', TRUE, CURRENT_TIMESTAMP - INTERVAL '15 days'),
(3, 'RECETA', 'receta_carlos_rodriguez.pdf', '/documentos/2024/01/receta_carlos_rodriguez.pdf', 128000, 'application/pdf', 'Receta médica - Control pediátrico', TRUE, CURRENT_TIMESTAMP - INTERVAL '7 days'),
(4, 'LABORATORIO', 'estudios_hormonales_ana_garcia.pdf', '/documentos/2024/01/estudios_hormonales_ana_garcia.pdf', 198400, 'application/pdf', 'Estudios hormonales completos', TRUE, CURRENT_TIMESTAMP - INTERVAL '20 days'),
(5, 'IMAGEN', 'radiografia_torax_luis_martinez.pdf', '/documentos/2024/01/radiografia_torax_luis_martinez.pdf', 1024000, 'application/pdf', 'Radiografía de tórax', TRUE, CURRENT_TIMESTAMP - INTERVAL '30 days');

-- =====================================================
-- INSERTAR RECURSOS DE PRUEBA
-- =====================================================

INSERT INTO RECURSOS (nombre, tipo, descripcion, capacidad, ubicacion, activo, fecha_creacion) VALUES
('Consultorio 1', 'CONSULTORIO', 'Consultorio de medicina general', 1, 'Planta baja, ala este', TRUE, CURRENT_TIMESTAMP),
('Consultorio 2', 'CONSULTORIO', 'Consultorio de cardiología', 1, 'Planta baja, ala oeste', TRUE, CURRENT_TIMESTAMP),
('Consultorio 3', 'CONSULTORIO', 'Consultorio de pediatría', 1, 'Primer piso, ala norte', TRUE, CURRENT_TIMESTAMP),
('Consultorio 4', 'CONSULTORIO', 'Consultorio de ginecología', 1, 'Primer piso, ala sur', TRUE, CURRENT_TIMESTAMP),
('Sala de Rayos X', 'EQUIPO', 'Equipo de radiografía digital', 1, 'Planta baja, área de diagnóstico', TRUE, CURRENT_TIMESTAMP),
('Electrocardiógrafo', 'EQUIPO', 'Equipo de electrocardiografía', 1, 'Consultorio 2', TRUE, CURRENT_TIMESTAMP),
('Sala de Espera Principal', 'AREA_COMUN', 'Sala de espera general', 20, 'Planta baja, recepción', TRUE, CURRENT_TIMESTAMP),
('Laboratorio', 'LABORATORIO', 'Laboratorio de análisis clínicos', 5, 'Planta baja, ala sur', TRUE, CURRENT_TIMESTAMP);

-- =====================================================
-- INSERTAR CONFIGURACIONES DE LISTA DE ESPERA
-- =====================================================

INSERT INTO CONFIGURACION_LISTA_ESPERA (
    nombre_configuracion, descripcion, activo,
    puntuacion_base_baja, puntuacion_base_normal, puntuacion_base_alta, puntuacion_base_urgente,
    escalacion_automatica_activa, horas_para_escalacion_normal, horas_para_escalacion_alta, horas_para_escalacion_urgente,
    notificaciones_automaticas_activas, tiempo_respuesta_default_horas, max_intentos_notificacion,
    expiracion_automatica_activa, dias_expiracion_default, notificar_expiracion_proxima, dias_aviso_expiracion,
    creado_por, fecha_creacion
) VALUES (
    'Configuración por defecto',
    'Configuración inicial del sistema de lista de espera para desarrollo',
    TRUE,
    10, 50, 100, 200,
    TRUE, 72, 168, 336,
    TRUE, 24, 3,
    TRUE, 30, TRUE, 7,
    1, CURRENT_TIMESTAMP
);

-- =====================================================
-- HABILITAR VERIFICACIÓN DE CLAVES FORÁNEAS
-- =====================================================

SET session_replication_role = DEFAULT;

-- =====================================================
-- CREAR ALGUNAS ENTRADAS EN LISTA DE ESPERA
-- =====================================================

INSERT INTO LISTA_ESPERA (
    id_paciente, medico_preferido_id, tipo_cita, especialidad, motivo,
    fecha_preferida_inicio, fecha_preferida_fin, prioridad, estado,
    acepta_cualquier_horario, metodo_notificacion_preferido,
    creado_por, fecha_creacion
) VALUES
(1, 3, 'SEGUIMIENTO', 'Medicina General', 'Control post-tratamiento', 
 CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '14 days', 'NORMAL', 'ACTIVA',
 TRUE, 'EMAIL', 9, CURRENT_TIMESTAMP),

(2, 4, 'CONSULTA_GENERAL', 'Cardiología', 'Revisión de presión arterial',
 CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '10 days', 'ALTA', 'ACTIVA',
 FALSE, 'SMS', 9, CURRENT_TIMESTAMP),

(3, 5, 'PRIMERA_VEZ', 'Pediatría', 'Primera consulta pediátrica',
 CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '12 days', 'NORMAL', 'ACTIVA',
 TRUE, 'EMAIL', 10, CURRENT_TIMESTAMP);

-- =====================================================
-- FUNCIÓN PARA GENERAR DATOS ADICIONALES
-- =====================================================

CREATE OR REPLACE FUNCTION generar_datos_adicionales(num_pacientes INTEGER DEFAULT 50, num_citas INTEGER DEFAULT 100)
RETURNS VOID AS $$
DECLARE
    i INTEGER;
    paciente_id INTEGER;
    medico_id INTEGER;
    fecha_cita TIMESTAMP;
    nombres_masculinos TEXT[] := ARRAY['Juan', 'Carlos', 'Luis', 'Miguel', 'Pedro', 'José', 'Antonio', 'Francisco', 'Alejandro', 'Rafael'];
    nombres_femeninos TEXT[] := ARRAY['María', 'Ana', 'Carmen', 'Rosa', 'Patricia', 'Laura', 'Isabel', 'Sofía', 'Gabriela', 'Valentina'];
    apellidos TEXT[] := ARRAY['García', 'Rodríguez', 'López', 'Hernández', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Cruz', 'Torres'];
    genero CHAR(1);
    nombre TEXT;
BEGIN
    -- Generar pacientes adicionales
    FOR i IN 1..num_pacientes LOOP
        genero := CASE WHEN RANDOM() > 0.5 THEN 'M' ELSE 'F' END;
        
        IF genero = 'M' THEN
            nombre := nombres_masculinos[FLOOR(RANDOM() * array_length(nombres_masculinos, 1)) + 1];
        ELSE
            nombre := nombres_femeninos[FLOOR(RANDOM() * array_length(nombres_femeninos, 1)) + 1];
        END IF;
        
        INSERT INTO PACIENTES (
            nombre, apellido, fecha_nacimiento, genero, telefono, email, direccion, activo, fecha_creacion
        ) VALUES (
            nombre,
            apellidos[FLOOR(RANDOM() * array_length(apellidos, 1)) + 1] || ' ' || apellidos[FLOOR(RANDOM() * array_length(apellidos, 1)) + 1],
            CURRENT_DATE - INTERVAL '1 day' * (FLOOR(RANDOM() * 25550) + 6570), -- Entre 18 y 88 años
            genero,
            '+52-555-' || LPAD((FLOOR(RANDOM() * 9999) + 1000)::TEXT, 4, '0'),
            LOWER(nombre) || '.' || LOWER(SPLIT_PART(apellidos[FLOOR(RANDOM() * array_length(apellidos, 1)) + 1], ' ', 1)) || '@email.com',
            'Dirección generada ' || i || ', Col. Ejemplo, Ciudad de México',
            TRUE,
            CURRENT_TIMESTAMP - INTERVAL '1 day' * FLOOR(RANDOM() * 365)
        );
    END LOOP;
    
    -- Generar citas adicionales
    FOR i IN 1..num_citas LOOP
        -- Seleccionar paciente y médico aleatorio
        SELECT id INTO paciente_id FROM PACIENTES WHERE activo = TRUE ORDER BY RANDOM() LIMIT 1;
        SELECT id INTO medico_id FROM USUARIOS WHERE id BETWEEN 3 AND 6 ORDER BY RANDOM() LIMIT 1;
        
        -- Generar fecha aleatoria (pasada o futura)
        fecha_cita := CURRENT_TIMESTAMP + INTERVAL '1 day' * (FLOOR(RANDOM() * 60) - 30) + 
                     INTERVAL '1 hour' * FLOOR(RANDOM() * 10 + 8); -- Entre 8 AM y 6 PM
        
        INSERT INTO CITAS (
            id_paciente, medico_id, fecha_hora, duracion_minutos, tipo_cita, motivo, estado, prioridad, activo, fecha_creacion
        ) VALUES (
            paciente_id,
            medico_id,
            fecha_cita,
            CASE FLOOR(RANDOM() * 3) WHEN 0 THEN 30 WHEN 1 THEN 45 ELSE 60 END,
            CASE FLOOR(RANDOM() * 4) 
                WHEN 0 THEN 'CONSULTA_GENERAL'
                WHEN 1 THEN 'SEGUIMIENTO'
                WHEN 2 THEN 'PRIMERA_VEZ'
                ELSE 'CONTROL'
            END,
            'Motivo generado automáticamente para pruebas',
            CASE 
                WHEN fecha_cita < CURRENT_TIMESTAMP THEN 'COMPLETADA'
                WHEN RANDOM() > 0.9 THEN 'CANCELADA'
                ELSE 'PROGRAMADA'
            END,
            CASE FLOOR(RANDOM() * 4)
                WHEN 0 THEN 'BAJA'
                WHEN 1 THEN 'NORMAL'
                WHEN 2 THEN 'ALTA'
                ELSE 'URGENTE'
            END,
            TRUE,
            CURRENT_TIMESTAMP - INTERVAL '1 day' * FLOOR(RANDOM() * 30)
        );
    END LOOP;
    
    RAISE NOTICE 'Generados % pacientes y % citas adicionales', num_pacientes, num_citas;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN PARA LIMPIAR DATOS DE PRUEBA
-- =====================================================

CREATE OR REPLACE FUNCTION limpiar_datos_prueba()
RETURNS VOID AS $$
BEGIN
    -- Deshabilitar verificación de claves foráneas temporalmente
    SET session_replication_role = replica;
    
    -- Limpiar datos en orden inverso de dependencias
    DELETE FROM SLOTS_PENDIENTES_PROCESAMIENTO;
    DELETE FROM HISTORIAL_LISTA_ESPERA;
    DELETE FROM NOTIFICACIONES_LISTA_ESPERA;
    DELETE FROM LISTA_ESPERA;
    DELETE FROM HISTORIAL_PRIORIDADES;
    DELETE FROM CITAS_RECURRENTES_EXCEPCIONES;
    DELETE FROM CITAS_RECURRENTES_INSTANCIAS;
    DELETE FROM CITAS_RECURRENTES;
    DELETE FROM RESERVAS;
    DELETE FROM LOGS_AUDITORIA;
    DELETE FROM DOCUMENTOS;
    DELETE FROM HISTORIAL_CLINICO;
    DELETE FROM CITAS;
    DELETE FROM PACIENTES;
    DELETE FROM USUARIOS_ROLES;
    DELETE FROM USUARIOS;
    DELETE FROM ROLES;
    
    -- Habilitar verificación de claves foráneas
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE 'Datos de prueba eliminados correctamente';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MENSAJE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Datos de Prueba Insertados Correctamente';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Usuarios creados:';
    RAISE NOTICE '- admin/admin@ecodigital.com (Administrador)';
    RAISE NOTICE '- superadmin/superadmin@ecodigital.com (Super Admin)';
    RAISE NOTICE '- dr.garcia/garcia@ecodigital.com (Médico)';
    RAISE NOTICE '- dra.martinez/martinez@ecodigital.com (Cardióloga)';
    RAISE NOTICE '- Contraseña por defecto: password123';
    RAISE NOTICE '';
    RAISE NOTICE 'Pacientes: 10 pacientes de prueba';
    RAISE NOTICE 'Citas: 10 citas de ejemplo';
    RAISE NOTICE 'Historial: 5 registros clínicos';
    RAISE NOTICE '';
    RAISE NOTICE 'Funciones disponibles:';
    RAISE NOTICE '- generar_datos_adicionales(num_pacientes, num_citas)';
    RAISE NOTICE '- limpiar_datos_prueba()';
    RAISE NOTICE '==============================================';
END
$$;