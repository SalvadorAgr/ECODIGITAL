# Base de Datos

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

La base de datos utiliza PostgreSQL 16 con características avanzadas como JSONB, triggers, funciones almacenadas y el patrón WORM para auditoría.

---

## Configuración de Conexión

### Parámetros de Conexión

```javascript
// _backend/db.js

const getDbConfig = () => {
  const configs = {
    development: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ecodigital',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20, // máximo de conexiones en el pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    test: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ecodigital_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 1000,
    },
    production: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 50,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: false,
      },
    },
  };

  return configs[process.env.NODE_ENV || 'development'];
};
```

### Pool de Conexiones

```javascript
const { Pool } = require('pg');

let pool;

const createPool = () => {
  if (!pool) {
    pool = new Pool(getDbConfig());

    pool.on('connect', client => {
      console.log('Nueva conexión establecida');
    });

    pool.on('error', (err, client) => {
      console.error('Error inesperado en cliente idle:', err);
    });
  }
  return pool;
};

const getPool = () => {
  if (!pool) {
    createPool();
  }
  return pool;
};
```

---

## Esquemas de Base de Datos

### Archivos SQL

| Archivo                                   | Descripción                         |
| ----------------------------------------- | ----------------------------------- |
| `01_usuarios_y_roles_postgresql.sql`      | Usuarios, roles, sesiones, permisos |
| `02_pacientes_y_historial_postgresql.sql` | Pacientes e historial clínico       |
| `03_citas_y_documentos_postgresql.sql`    | Citas, documentos, horarios         |
| `04_auditoria_y_logs_postgresql.sql`      | Logs de auditoría WORM, reportes    |
| `11_communication_system_postgresql.sql`  | Sistema de comunicaciones           |
| `13_dashboard_principal_postgresql.sql`   | Tablas del dashboard                |

---

## Tablas Principales

### Usuarios y Roles

```
ROLES ─┬─< USUARIOS >───< SESIONES_USUARIO
       │        │
       │        ├───< PERMISOS_USUARIO
       │        │
       │        └───< LOG_ACCESOS
       │
       └───< CONFIGURACION_SEGURIDAD
```

### Pacientes y Citas

```
PACIENTES ────< HISTORIAL_CLINICO >───< DOCUMENTOS
     │              │
     │              └───< CITAS
     │
     └───< CITAS >───< USUARIOS (médicos)
```

### Auditoría

```
LOGS_AUDITORIA (inmutable)
ALERTAS_AUDITORIA >───< INSTANCIAS_ALERTAS
REPORTES_PROGRAMADOS >───< EJECUCIONES_REPORTES
PLANTILLAS_REPORTES
METRICAS_SISTEMA
```

---

## Tipos de Datos Personalizados

### JSONB para Signos Vitales

```json
{
  "presion_arterial": {
    "sistolica": 120,
    "diastolica": 80,
    "unidad": "mmHg"
  },
  "frecuencia_cardiaca": {
    "valor": 72,
    "unidad": "lpm"
  },
  "temperatura": {
    "valor": 36.5,
    "unidad": "°C"
  }
}
```

### JSONB para Medicamentos

```json
{
  "medicamentos": [
    {
      "nombre": "Paracetamol",
      "dosis": "500mg",
      "frecuencia": "Cada 8 horas",
      "duracion": "7 días"
    }
  ]
}
```

---

## Funciones Almacenadas

### Actualizar fecha_modificacion

```sql
CREATE OR REPLACE FUNCTION update_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Calcular IMC

```sql
CREATE OR REPLACE FUNCTION calcular_imc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.peso IS NOT NULL AND NEW.altura IS NOT NULL AND NEW.altura > 0 THEN
        NEW.imc = NEW.peso / POWER(NEW.altura / 100, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Validar Conflicto de Citas

```sql
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
```

### Generar Número de Cita

```sql
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
```

### Crear Log de Auditoría

```sql
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
```

---

## Triggers

### Triggers de Auditoría

```sql
-- Actualizar fecha_modificacion en todas las tablas
CREATE TRIGGER tr_usuarios_update_fecha_modificacion
    BEFORE UPDATE ON USUARIOS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

CREATE TRIGGER tr_pacientes_update_fecha_modificacion
    BEFORE UPDATE ON PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

CREATE TRIGGER tr_citas_update_fecha_modificacion
    BEFORE UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();

CREATE TRIGGER tr_historial_update_fecha_modificacion
    BEFORE UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
```

### Triggers de Negocio

```sql
-- Calcular IMC automáticamente
CREATE TRIGGER tr_historial_calcular_imc
    BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION calcular_imc();

-- Actualizar fechas de consulta en pacientes
CREATE TRIGGER tr_actualizar_fechas_consulta
    AFTER INSERT ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fechas_consulta_paciente();

-- Validar conflictos de citas
CREATE TRIGGER tr_validar_conflicto_citas
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION validar_conflicto_citas();

-- Generar número de cita
CREATE TRIGGER tr_generar_numero_cita
    BEFORE INSERT ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION generar_numero_cita();
```

### Triggers WORM (Inmutabilidad)

```sql
-- Prevenir actualizaciones en logs
CREATE TRIGGER tr_logs_auditoria_prevent_update
    BEFORE UPDATE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_update();

-- Prevenir eliminaciones en logs
CREATE TRIGGER tr_logs_auditoria_prevent_delete
    BEFORE DELETE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_delete();

-- Generar hash de integridad
CREATE TRIGGER tr_logs_auditoria_before_insert
    BEFORE INSERT ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION generate_log_integrity();
```

---

## Vistas

### Vista de Usuarios Completo

```sql
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
```

### Vista de Pacientes Resumen

```sql
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
```

### Vista de Citas Completas

```sql
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
```

### Vista de Historial Completo

```sql
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
```

---

## Índices

### Índices de Usuarios

```sql
CREATE INDEX idx_usuarios_username ON USUARIOS(username);
CREATE INDEX idx_usuarios_email ON USUARIOS(email);
CREATE INDEX idx_usuarios_rol ON USUARIOS(rol_id);
CREATE INDEX idx_usuarios_activo ON USUARIOS(activo);
CREATE INDEX idx_usuarios_bloqueado ON USUARIOS(bloqueado);
CREATE INDEX idx_usuarios_cedula ON USUARIOS(cedula);
CREATE INDEX idx_usuarios_ultimo_acceso ON USUARIOS(fecha_ultimo_acceso);
```

### Índices de Pacientes

```sql
CREATE INDEX idx_pacientes_nombre ON PACIENTES(nombre);
CREATE INDEX idx_pacientes_apellido ON PACIENTES(apellido);
CREATE INDEX idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX idx_pacientes_cedula ON PACIENTES(cedula);
CREATE INDEX idx_pacientes_fecha_consulta ON PACIENTES(fecha_primera_consulta);
CREATE INDEX idx_pacientes_ultima_consulta ON PACIENTES(fecha_ultima_consulta);
CREATE INDEX idx_pacientes_activo ON PACIENTES(activo);
CREATE INDEX idx_pacientes_expediente ON PACIENTES(numero_expediente);
```

### Índices de Citas

```sql
CREATE INDEX idx_citas_fecha_hora ON CITAS(fecha_hora);
CREATE INDEX idx_citas_paciente ON CITAS(id_paciente);
CREATE INDEX idx_citas_medico ON CITAS(medico_id);
CREATE INDEX idx_citas_paciente_fecha ON CITAS(id_paciente, fecha_hora);
CREATE INDEX idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX idx_citas_estado ON CITAS(estado);
CREATE INDEX idx_citas_tipo ON CITAS(tipo_cita);
CREATE INDEX idx_citas_numero ON CITAS(numero_cita);
CREATE INDEX idx_citas_activo ON CITAS(activo);
```

### Índices de Historial

```sql
CREATE INDEX idx_historial_paciente ON HISTORIAL_CLINICO(id_paciente);
CREATE INDEX idx_historial_fecha_hora ON HISTORIAL_CLINICO(fecha_hora);
CREATE INDEX idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_hora);
CREATE INDEX idx_historial_medico ON HISTORIAL_CLINICO(medico_id);
CREATE INDEX idx_historial_tipo_consulta ON HISTORIAL_CLINICO(tipo_consulta);
CREATE INDEX idx_historial_estado ON HISTORIAL_CLINICO(estado_consulta);
CREATE INDEX idx_historial_activo ON HISTORIAL_CLINICO(activo);
CREATE INDEX idx_historial_urgente ON HISTORIAL_CLINICO(urgente);
CREATE INDEX idx_historial_seguimiento ON HISTORIAL_CLINICO(requiere_seguimiento);
```

### Índices de Auditoría

```sql
CREATE INDEX idx_logs_fecha_evento ON LOGS_AUDITORIA(fecha_evento);
CREATE INDEX idx_logs_fecha_hora ON LOGS_AUDITORIA(fecha_hora);
CREATE INDEX idx_logs_usuario_fecha ON LOGS_AUDITORIA(usuario_id, fecha_evento);
CREATE INDEX idx_logs_tipo_categoria ON LOGS_AUDITORIA(tipo_evento, categoria);
CREATE INDEX idx_logs_modulo_accion ON LOGS_AUDITORIA(modulo, accion);
CREATE INDEX idx_logs_recurso ON LOGS_AUDITORIA(recurso_tipo, recurso_id);
CREATE INDEX idx_logs_nivel_criticidad ON LOGS_AUDITORIA(nivel_criticidad);
CREATE INDEX idx_logs_resultado ON LOGS_AUDITORIA(resultado);
CREATE INDEX idx_logs_numero_secuencia ON LOGS_AUDITORIA(numero_secuencia);
CREATE INDEX idx_logs_hash_integridad ON LOGS_AUDITORIA(hash_integridad);
```

---

## Utilidades de Base de Datos

### Consulta con Paginación

```javascript
const query = async (text, params = []) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  console.log('Database query:', {
    text: text.substring(0, 100),
    duration: `${duration}ms`,
    rows: result.rowCount,
  });

  return result;
};
```

### Transacción

```javascript
const transaction = async callback => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Consulta Múltiple

```javascript
const multiQuery = async queries => {
  const results = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Verificar Conexión

```javascript
const checkConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    return {
      connected: true,
      timestamp: result.rows[0].now,
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};
```

---

## Estadísticas

```javascript
const getStats = async () => {
  const queries = [
    {
      name: 'total_connections',
      text: 'SELECT count(*) as value FROM pg_stat_activity',
    },
    {
      name: 'active_connections',
      text: 'SELECT count(*) as value FROM pg_stat_activity WHERE state = $1',
      params: ['active'],
    },
    {
      name: 'database_size',
      text: 'SELECT pg_database_size(current_database()) as value',
    },
  ];

  const stats = {};

  for (const query of queries) {
    const result = await pool.query(query.text, query.params || []);
    stats[query.name] = result.rows[0].value;
  }

  return stats;
};
```

---

## Mantenimiento

### Vacuum y Analyze

```sql
-- Ejecutar vacuum analyze en tablas principales
VACUUM ANALYZE USUARIOS;
VACUUM ANALYZE PACIENTES;
VACUUM ANALYZE CITAS;
VACUUM ANALYZE HISTORIAL_CLINICO;
VACUUM ANALYZE DOCUMENTOS;
VACUUM ANALYZE LOGS_AUDITORIA;
```

### Reindex

```sql
-- Reconstruir índices fragmentados
REINDEX INDEX idx_usuarios_email;
REINDEX INDEX idx_pacientes_nombre_apellido;
REINDEX INDEX idx_citas_medico_fecha;
REINDEX INDEX idx_logs_fecha_evento;
```

### Backup

```bash
# Backup completo
pg_dump -h localhost -U postgres -d ecodigital -F c -f backup_$(date +%Y%m%d).dump

# Backup solo esquema
pg_dump -h localhost -U postgres -d ecodigital -s -F c -f schema_$(date +%Y%m%d).dump

# Backup solo datos
pg_dump -h localhost -U postgres -d ecodigital -a -F c -f data_$(date +%Y%m%d).dump
```

---

## Notas de Implementación

1. **Soft Delete**: Todas las tablas principales usan `activo = TRUE/FALSE`
2. **Auditoría**: Campos `creado_por`, `modificado_por`, `fecha_creacion`, `fecha_modificacion`
3. **Triggers**: Actualización automática de `fecha_modificacion`
4. **Índices**: Optimizados para consultas frecuentes
5. **JSONB**: Para datos flexibles (signos vitales, medicamentos)
6. **WORM**: Logs de auditoría inmutables con hash de integridad
7. **Pool**: Conexiones gestionadas por pg Pool
8. **Transacciones**: Soporte completo para operaciones atómicas
