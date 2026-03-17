# Documentación Técnica Unificada - EcoDigital/EcosSecial

**Versión:** 2.0  
**Fecha:** Marzo 2026  
**Sistema:** HealthTech para Entornos Quirúrgicos Inteligentes

---

## Tabla de Contenidos

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Arquitectura General](#2-arquitectura-general)
3. [Módulo de Autenticación y Usuarios](#3-módulo-de-autenticación-y-usuarios)
4. [Módulo de Pacientes](#4-módulo-de-pacientes)
5. [Módulo de Citas](#5-módulo-de-citas)
6. [Módulo de Historial Clínico](#6-módulo-de-historial-clínico)
7. [Módulo de Documentos](#7-módulo-de-documentos)
8. [Módulo de Dashboard](#8-módulo-de-dashboard)
9. [Módulo de Comunicaciones](#9-módulo-de-comunicaciones)
10. [Módulo de Asistente IA](#10-módulo-de-asistente-ia)
11. [Módulo de Auditoría y Logs](#11-módulo-de-auditoría-y-logs)
12. [Infraestructura Cloud](#12-infraestructura-cloud)
13. [Base de Datos](#13-base-de-datos)
14. [Frontend](#14-frontend)
15. [BlockSuite](#15-blocksuite)
16. [Sidebar y Navegación](#16-sidebar-y-navegación)
17. [Seguridad](#17-seguridad)
18. [API Reference](#18-api-reference)

---

## 1. Resumen del Sistema

### 1.1 Descripción General

EcoDigital (también conocido como EcosSecial) es una plataforma HealthTech diseñada para entornos quirúrgicos inteligentes. El sistema proporciona gestión integral de consultorios médicos, incluyendo:

- Gestión de pacientes y expedientes clínicos
- Programación de citas médicas con detección de conflictos
- Historial clínico electrónico con códigos CIE-10
- Gestión documental con almacenamiento en la nube
- Dashboard con métricas en tiempo real
- Asistente IA (AVI) basado en Google Cloud Vertex AI
- Sistema de auditoría WORM (Write Once Read Many)

### 1.2 Stack Tecnológico

| Componente               | Tecnología                                                  |
| ------------------------ | ----------------------------------------------------------- |
| **Backend**              | Node.js, Express.js                                         |
| **Base de Datos**        | PostgreSQL 16                                               |
| **Frontend Web**         | Vue.js, Nuxt.js                                             |
| **Frontend Desktop**     | Electron                                                    |
| **Frontend Mobile**      | React Native                                                |
| **Editor de Documentos** | BlockSuite                                                  |
| **IA**                   | Google Cloud Vertex AI (Gemini 2.0 Flash Thinking)          |
| **Cloud**                | Google Cloud Platform (Cloud Run, Cloud SQL, Cloud Storage) |
| **Autenticación**        | JWT con refresh tokens                                      |
| **Almacenamiento**       | Cloud Storage, IndexedDB, SQLite                            |

### 1.3 Estructura del Proyecto

```
ECODIGITAL/
├── _backend/                 # API REST (Node.js/Express)
│   ├── Postgressql/          # Esquemas de base de datos
│   ├── routes/               # Rutas de la API
│   ├── services/             # Lógica de negocio
│   ├── middleware/           # Middleware de autenticación
│   ├── db.js                 # Conexión PostgreSQL
│   └── server.js             # Servidor Express
├── packages/                  # Monorepo frontend
│   ├── common/               # Paquetes compartidos
│   │   ├── debug/            # Utilidades de depuración
│   │   ├── error/            # Manejo de errores
│   │   ├── graphql/          # Cliente GraphQL
│   │   ├── infra/            # Infraestructura
│   │   ├── native/           # Módulos nativos (Rust)
│   │   ├── nbstore/          # Almacenamiento
│   │   ├── s3-compat/        # Compatibilidad S3
│   │   └── y-octo/           # CRDTs
│   └── blocksuite/            # Editor de bloques
├── blocksuite/               # Framework BlockSuite
├── docs/                     # Documentación
└── tests/                    # Pruebas E2E
```

---

## 2. Arquitectura General

### 2.1 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Web     │  │ Desktop  │  │ Mobile   │  │ BlockSuite Editor │ │
│  │ (Nuxt)   │  │(Electron)│  │(React N) │  │    (Framework)    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
        └─────────────┴─────────────┴─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (Express.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Rate Limiter│  │    CORS     │  │   Health Check Endpoint  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    MIDDLEWARE                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │ Auth (JWT)   │  │ RBAC         │  │ Audit Logger     │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICIOS DE NEGOCIO                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Appointment │  │  Patient    │  │  Vertex AI  │              │
│  │  Service    │  │  Service    │  │  Service    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │Notification │  │  Document   │  │   Audit     │              │
│  │  Service    │  │  Service    │  │  Service    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE DATOS                              │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   PostgreSQL 16     │  │    Google Cloud Storage         │  │
│  │   (Cloud SQL)       │  │    (Documentos/Archivos)        │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   Redis/Memorystore │  │    Secret Manager                │  │
│  │   (Cache/Sessions)  │  │    (Keys/Secrets)               │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Configuración del Servidor

El servidor Express está configurado en [`_backend/server.js`](_backend/server.js):

```javascript
// Configuración de CORS
const corsOptions = {
  origin: [
    'http://localhost:3010',
    'http://127.0.0.1:3010',
    // ... más orígenes
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    // ... más headers
  ],
};

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
```

### 2.3 Conexión a Base de Datos

La conexión PostgreSQL se gestiona en [`_backend/db.js`](_backend/db.js):

```javascript
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
    production: {
      // Configuración para Cloud SQL
    },
  };
};

// Pool de conexiones
const createPool = () => {
  return new Pool(getDbConfig());
};

// Utilidades de consulta
const query = async (text, params = []) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  // Log de rendimiento
  return result;
};

// Soporte de transacciones
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

---

## 3. Módulo de Autenticación y Usuarios

### 3.1 Descripción

El módulo de autenticación implementa un sistema completo de gestión de usuarios con RBAC (Role-Based Access Control), sesiones JWT y auditoría de accesos.

### 3.2 Esquema de Base de Datos

#### Tabla ROLES

```sql
CREATE TABLE IF NOT EXISTS ROLES (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSONB,
    nivel_acceso VARCHAR(20) NOT NULL CHECK (nivel_acceso IN (
        'ADMIN_PRINCIPAL', 'ADMIN_SECUNDARIO', 'ASISTENTE', 'INVITADO'
    )),
    activo BOOLEAN DEFAULT TRUE,
    es_sistema BOOLEAN DEFAULT FALSE,
    timeout_sesion INTEGER DEFAULT 3600,
    max_sesiones_concurrentes INTEGER DEFAULT 3,
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabla USUARIOS

```sql
CREATE TABLE IF NOT EXISTS USUARIOS (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(32) NOT NULL,

    -- Información personal
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    cedula VARCHAR(20) UNIQUE,
    foto_perfil VARCHAR(255),

    -- Información profesional
    titulo_profesional VARCHAR(100),
    especialidad VARCHAR(100),
    numero_colegiado VARCHAR(50),
    firma_digital VARCHAR(255),

    -- Configuración de cuenta
    rol_id INTEGER NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    verificado BOOLEAN DEFAULT FALSE,
    bloqueado BOOLEAN DEFAULT FALSE,
    intentos_fallidos INTEGER DEFAULT 0,

    -- Seguridad
    cambiar_password BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    preferencias JSONB,
    timezone VARCHAR(50) DEFAULT 'America/Santo_Domingo',
    idioma VARCHAR(5) DEFAULT 'es',
    tema VARCHAR(10) DEFAULT 'dark'
);
```

#### Tabla SESIONES_USUARIO

```sql
CREATE TABLE IF NOT EXISTS SESIONES_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    token_sesion VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    ubicacion VARCHAR(100),
    activa BOOLEAN DEFAULT TRUE,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    fecha_ultimo_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 Roles y Permisos

| Rol                  | Nivel de Acceso  | Permisos                                                                     |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| **Admin Principal**  | ADMIN_PRINCIPAL  | Acceso completo al sistema: `{"*": ["*"]}`                                   |
| **Admin Secundario** | ADMIN_SECUNDARIO | Gestión de pacientes, citas, historial, documentos; solo lectura de reportes |
| **Asistente**        | ASISTENTE        | Crear/leer/actualizar pacientes, citas y documentos                          |
| **Invitado**         | INVITADO         | Solo lectura de pacientes, citas, historial y documentos                     |

### 3.4 Endpoints de Autenticación

| Método | Endpoint             | Descripción               |
| ------ | -------------------- | ------------------------- |
| POST   | `/api/auth/register` | Registro de nuevo usuario |
| POST   | `/api/auth/login`    | Inicio de sesión          |
| POST   | `/api/auth/refresh`  | Renovar access token      |
| POST   | `/api/auth/logout`   | Cerrar sesión             |
| GET    | `/api/auth/me`       | Obtener usuario actual    |
| PUT    | `/api/auth/password` | Cambiar contraseña        |

### 3.5 Middleware de Autenticación

```javascript
// _backend/middleware/authMiddleware.js

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = { id: null, role: 'guest' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userQuery = await pool.query('SELECT id, username, email, rol_id, activo FROM USUARIOS WHERE id = $1', [decoded.userId]);

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = {
      id: userQuery.rows[0].id,
      username: userQuery.rows[0].username,
      role: userQuery.rows[0].rol_id,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireRole = allowedRoles => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const userRole = await pool.query('SELECT nombre, permisos FROM ROLES WHERE id = $1', [req.user.role]);

    if (!allowedRoles.includes(userRole.rows[0].nombre)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
};
```

### 3.6 Configuración de Seguridad

```sql
-- Valores por defecto en CONFIGURACION_SEGURIDAD
INSERT INTO CONFIGURACION_SEGURIDAD (clave, valor, tipo, descripcion, categoria) VALUES
('password_min_length', '8', 'INTEGER', 'Longitud mínima de contraseña', 'password_policy'),
('password_require_uppercase', 'true', 'BOOLEAN', 'Requerir mayúsculas', 'password_policy'),
('password_require_lowercase', 'true', 'BOOLEAN', 'Requerir minúsculas', 'password_policy'),
('password_require_numbers', 'true', 'BOOLEAN', 'Requerir números', 'password_policy'),
('max_login_attempts', '5', 'INTEGER', 'Máximo intentos de login', 'security'),
('account_lockout_duration', '1800', 'INTEGER', 'Duración de bloqueo (segundos)', 'security'),
('jwt_access_token_expiry', '900', 'INTEGER', 'Expiración access token (segundos)', 'jwt'),
('jwt_refresh_token_expiry', '604800', 'INTEGER', 'Expiración refresh token (segundos)', 'jwt');
```

---

## 4. Módulo de Pacientes

### 4.1 Descripción

El módulo de pacientes gestiona la información demográfica y médica básica de los pacientes del consultorio.

### 4.2 Esquema de Base de Datos

#### Tabla PACIENTES

```sql
CREATE TABLE IF NOT EXISTS PACIENTES (
    id SERIAL PRIMARY KEY,

    -- Información personal
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    genero CHAR(1) NOT NULL CHECK (genero IN ('M', 'F', 'O')),
    telefono VARCHAR(20),
    email VARCHAR(100),

    -- Dirección
    direccion TEXT,
    ciudad VARCHAR(100),
    provincia VARCHAR(100),
    codigo_postal VARCHAR(10),
    pais VARCHAR(50) DEFAULT 'República Dominicana',

    -- Información médica básica
    tipo_sangre VARCHAR(3) CHECK (tipo_sangre IN (
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    )),
    alergias TEXT,
    medicamentos_actuales TEXT,
    condiciones_medicas TEXT,

    -- Contacto de emergencia
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_telefono VARCHAR(20),
    contacto_emergencia_relacion VARCHAR(50),

    -- Información administrativa
    numero_expediente VARCHAR(50) UNIQUE,
    seguro_medico VARCHAR(100),
    numero_poliza VARCHAR(50),
    fecha_primera_consulta TIMESTAMP NULL,
    fecha_ultima_consulta TIMESTAMP NULL,

    -- Soft delete
    activo BOOLEAN DEFAULT TRUE,

    -- Auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3 Índices

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

### 4.4 Endpoints de Pacientes

| Método | Endpoint               | Descripción                     |
| ------ | ---------------------- | ------------------------------- |
| GET    | `/api/patients`        | Listar pacientes (paginado)     |
| GET    | `/api/patients/:id`    | Obtener paciente por ID         |
| POST   | `/api/patients`        | Crear nuevo paciente            |
| PUT    | `/api/patients/:id`    | Actualizar paciente             |
| DELETE | `/api/patients/:id`    | Eliminar paciente (soft delete) |
| GET    | `/api/patients/search` | Buscar pacientes                |

### 4.5 Vista de Pacientes Resumen

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

---

## 5. Módulo de Citas

### 5.1 Descripción

El módulo de citas gestiona la programación de consultas médicas con detección automática de conflictos de horario.

### 5.2 Esquema de Base de Datos

#### Tabla CITAS

```sql
CREATE TABLE IF NOT EXISTS CITAS (
    id SERIAL PRIMARY KEY,

    -- Información básica
    numero_cita VARCHAR(20) UNIQUE NOT NULL,
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,

    -- Programación
    fecha_hora TIMESTAMP NOT NULL,
    duracion_minutos INTEGER DEFAULT 30,
    fecha_hora_fin TIMESTAMP GENERATED ALWAYS AS
        (fecha_hora + INTERVAL '1 minute' * duracion_minutos) STORED,

    -- Detalles
    tipo_cita VARCHAR(20) NOT NULL CHECK (tipo_cita IN (
        'CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL',
        'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'
    )),
    especialidad VARCHAR(100),
    motivo TEXT NOT NULL,
    observaciones TEXT,

    -- Estado
    estado VARCHAR(15) DEFAULT 'PROGRAMADA' CHECK (estado IN (
        'PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA',
        'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'
    )),
    fecha_confirmacion TIMESTAMP NULL,
    fecha_cancelacion TIMESTAMP NULL,
    motivo_cancelacion TEXT,

    -- Recordatorios
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    fecha_recordatorio TIMESTAMP NULL,

    -- Información de consulta
    historial_clinico_id BIGINT NULL,
    tiempo_espera_minutos INTEGER,
    tiempo_consulta_minutos INTEGER,

    -- Facturación
    costo_consulta DECIMAL(10,2),
    seguro_medico VARCHAR(100),
    copago DECIMAL(10,2),
    facturado BOOLEAN DEFAULT FALSE,

    -- Recursos
    sala_consulta VARCHAR(50),
    equipos_necesarios JSONB,
    preparacion_especial TEXT,

    -- Soft delete
    activo BOOLEAN DEFAULT TRUE,

    -- Auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabla HORARIOS_MEDICOS

```sql
CREATE TABLE IF NOT EXISTS HORARIOS_MEDICOS (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_cita_minutos INTEGER DEFAULT 30,
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia DATE NULL,
    pausas JSONB,
    observaciones TEXT,
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(medico_id, dia_semana, fecha_inicio_vigencia)
);
```

#### Tabla EXCEPCIONES_HORARIO

```sql
CREATE TABLE IF NOT EXISTS EXCEPCIONES_HORARIO (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    tipo_excepcion VARCHAR(15) NOT NULL CHECK (tipo_excepcion IN (
        'NO_DISPONIBLE', 'HORARIO_ESPECIAL', 'VACACIONES',
        'ENFERMEDAD', 'CONFERENCIA', 'OTRO'
    )),
    motivo TEXT,
    hora_inicio_especial TIME NULL,
    hora_fin_especial TIME NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(medico_id, fecha)
);
```

### 5.3 Validación de Conflictos

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

### 5.4 Servicio de Citas

```javascript
// _backend/services/appointmentService.js

class AppointmentService {
  constructor() {
    this.appointmentTypes = {
      CONSULTA_GENERAL: { duration: 30, color: '#4CAF50' },
      PRIMERA_VEZ: { duration: 45, color: '#2196F3' },
      SEGUIMIENTO: { duration: 20, color: '#FF9800' },
      CONTROL: { duration: 15, color: '#9C27B0' },
      CIRUGIA: { duration: 120, color: '#F44336' },
      POST_OPERATORIO: { duration: 30, color: '#795548' },
      URGENCIA: { duration: 60, color: '#E91E63' },
    };

    this.appointmentStates = {
      PROGRAMADA: { canEdit: true, canCancel: true },
      CONFIRMADA: { canEdit: true, canCancel: true },
      EN_CURSO: { canEdit: false, canCancel: false },
      COMPLETADA: { canEdit: false, canCancel: false },
      CANCELADA: { canEdit: false, canCancel: false },
      NO_ASISTIO: { canEdit: false, canCancel: false },
      REPROGRAMADA: { canEdit: false, canCancel: true },
    };
  }

  async createAppointment(appointmentData, userId = null) {
    // Validación de datos
    const validation = this.validateAppointmentData(appointmentData);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    // Verificar conflictos
    const conflicts = await this.checkSchedulingConflicts(appointmentData.medico_id, appointmentData.fecha_hora, appointmentData.duracion_minutos || 30);

    if (conflicts.hasConflicts) {
      return { success: false, errors: conflicts.conflicts };
    }

    // Crear cita
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // ... lógica de creación
      await client.query('COMMIT');
      return { success: true, data: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkSchedulingConflicts(doctorId, dateTime, duration, excludeAppointmentId = null) {
    const query = `
            SELECT id, numero_cita, fecha_hora, duracion_minutos, 
                   fecha_hora + INTERVAL '1 minute' * duracion_minutos as fecha_hora_fin
            FROM CITAS
            WHERE medico_id = $1
            AND activo = TRUE
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            AND ($2 BETWEEN fecha_hora AND fecha_hora + INTERVAL '1 minute' * duracion_minutos
                OR $2 + INTERVAL '1 minute' * $3 BETWEEN fecha_hora AND fecha_hora + INTERVAL '1 minute' * duracion_minutos
                OR fecha_hora BETWEEN $2 AND $2 + INTERVAL '1 minute' * $3)
        `;
    // ... implementación
  }

  async getDoctorAvailability(doctorId, date, duration = 30) {
    const workingHours = {
      start: '08:00',
      end: '18:00',
      lunchStart: '13:00',
      lunchEnd: '14:00',
    };
    // ... implementación
  }
}
```

### 5.5 Endpoints de Citas

| Método | Endpoint                                   | Descripción                       |
| ------ | ------------------------------------------ | --------------------------------- |
| GET    | `/api/appointments`                        | Listar citas (paginado, filtrado) |
| GET    | `/api/appointments/:id`                    | Obtener cita por ID               |
| POST   | `/api/appointments`                        | Crear nueva cita                  |
| PUT    | `/api/appointments/:id`                    | Actualizar cita                   |
| DELETE | `/api/appointments/:id`                    | Cancelar cita                     |
| GET    | `/api/appointments/availability/:doctorId` | Disponibilidad del médico         |
| POST   | `/api/appointments/:id/confirm`            | Confirmar cita                    |
| POST   | `/api/appointments/:id/reschedule`         | Reprogramar cita                  |

---

## 6. Módulo de Historial Clínico

### 6.1 Descripción

El módulo de historial clínico gestiona los registros médicos de las consultas de pacientes, incluyendo signos vitales, diagnósticos CIE-10 y tratamientos.

### 6.2 Esquema de Base de Datos

#### Tabla HISTORIAL_CLINICO

```sql
CREATE TABLE IF NOT EXISTS HISTORIAL_CLINICO (
    id BIGSERIAL PRIMARY KEY,

    -- Relación con paciente
    id_paciente INTEGER NOT NULL,

    -- Información de la consulta
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_consulta VARCHAR(20) NOT NULL CHECK (tipo_consulta IN (
        'PRIMERA_VEZ', 'SEGUIMIENTO', 'URGENCIA', 'CONTROL', 'CIRUGIA', 'POST_OPERATORIO'
    )),
    motivo_consulta TEXT NOT NULL,

    -- Examen físico
    signos_vitales JSONB,
    peso DECIMAL(5,2),
    altura DECIMAL(5,2),
    imc DECIMAL(4,2),

    -- Evaluación médica
    sintomas TEXT,
    examen_fisico TEXT,
    diagnostico_principal TEXT NOT NULL,
    diagnosticos_secundarios TEXT,
    codigo_cie10 VARCHAR(10),

    -- Tratamiento
    plan_tratamiento TEXT,
    medicamentos_prescritos JSONB,
    examenes_solicitados TEXT,
    procedimientos_realizados TEXT,

    -- Seguimiento
    recomendaciones TEXT,
    proxima_cita DATE,
    observaciones TEXT,

    -- Información del médico
    medico_id INTEGER NOT NULL,
    especialidad_consulta VARCHAR(100),

    -- Archivos adjuntos
    imagenes_adjuntas JSONB,
    documentos_adjuntos JSONB,

    -- Estado
    estado_consulta VARCHAR(15) DEFAULT 'COMPLETADA' CHECK (estado_consulta IN (
        'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'
    )),
    requiere_seguimiento BOOLEAN DEFAULT FALSE,
    urgente BOOLEAN DEFAULT FALSE,

    -- Soft delete
    activo BOOLEAN DEFAULT TRUE,

    -- Auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 Estructura de Signos Vitales (JSONB)

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
  },
  "saturacion_oxigeno": {
    "valor": 98,
    "unidad": "%"
  },
  "frecuencia_respiratoria": {
    "valor": 16,
    "unidad": "rpm"
  }
}
```

### 6.4 Estructura de Medicamentos Prescritos (JSONB)

```json
{
  "medicamentos": [
    {
      "nombre": "Paracetamol",
      "dosis": "500mg",
      "frecuencia": "Cada 8 horas",
      "duracion": "7 días",
      "instrucciones": "Tomar con alimentos",
      "cantidad": 21
    }
  ]
}
```

### 6.5 Trigger para Cálculo de IMC

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

CREATE TRIGGER tr_historial_calcular_imc
    BEFORE INSERT OR UPDATE ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION calcular_imc();
```

### 6.6 Vista de Historial Completo

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

## 7. Módulo de Documentos

### 7.1 Descripción

El módulo de documentos gestiona el almacenamiento y organización de archivos médicos, incluyendo imágenes, PDFs y archivos DICOM.

### 7.2 Esquema de Base de Datos

#### Tabla DOCUMENTOS

```sql
CREATE TABLE IF NOT EXISTS DOCUMENTOS (
    id BIGSERIAL PRIMARY KEY,

    -- Información básica
    nombre_archivo VARCHAR(255) NOT NULL,
    nombre_interno VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(25) NOT NULL CHECK (tipo_documento IN (
        'HISTORIA_CLINICA', 'RECETA_MEDICA', 'ORDEN_EXAMENES', 'RESULTADO_LABORATORIO',
        'IMAGEN_RADIOLOGICA', 'CONSENTIMIENTO', 'FACTURA', 'SEGURO',
        'IDENTIFICACION', 'REFERENCIA', 'INFORME_MEDICO', 'OTRO'
    )),

    -- Clasificación
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    descripcion TEXT,
    palabras_clave JSONB,

    -- Relaciones
    id_paciente INTEGER NOT NULL,
    historial_clinico_id BIGINT NULL,
    cita_id INTEGER NULL,

    -- Información del archivo
    extension VARCHAR(10) NOT NULL,
    tamaño_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    hash_archivo VARCHAR(64) NOT NULL,

    -- Almacenamiento Cloud
    ruta_storage VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    url_publica VARCHAR(500),
    fecha_expiracion_url TIMESTAMP NULL,

    -- Metadatos
    fecha_documento DATE,
    autor_documento VARCHAR(100),
    institucion_origen VARCHAR(100),
    numero_documento VARCHAR(50),

    -- Seguridad
    nivel_confidencialidad VARCHAR(15) DEFAULT 'CONFIDENCIAL' CHECK (nivel_confidencialidad IN (
        'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO'
    )),
    cifrado BOOLEAN DEFAULT TRUE,
    requiere_autorizacion BOOLEAN DEFAULT TRUE,

    -- Control de versiones
    version INTEGER DEFAULT 1,
    documento_padre_id BIGINT NULL,
    es_version_actual BOOLEAN DEFAULT TRUE,

    -- Estado
    estado_procesamiento VARCHAR(15) DEFAULT 'SUBIENDO' CHECK (estado_procesamiento IN (
        'SUBIENDO', 'PROCESANDO', 'DISPONIBLE', 'ERROR', 'ARCHIVADO'
    )),
    ocr_procesado BOOLEAN DEFAULT FALSE,
    texto_extraido TEXT,
    metadatos_extraidos JSONB,

    -- Auditoría de acceso
    total_descargas INTEGER DEFAULT 0,
    ultima_descarga TIMESTAMP NULL,
    ultimo_acceso_usuario INTEGER NULL,

    -- Soft delete
    activo BOOLEAN DEFAULT TRUE,
    fecha_eliminacion TIMESTAMP NULL,
    motivo_eliminacion TEXT,

    -- Auditoría
    subido_por INTEGER NOT NULL,
    modificado_por INTEGER,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7.3 Tipos de Documentos

| Tipo                  | Descripción                   | Nivel de Confidencialidad |
| --------------------- | ----------------------------- | ------------------------- |
| HISTORIA_CLINICA      | Historial médico del paciente | CONFIDENCIAL              |
| RECETA_MEDICA         | Prescripción de medicamentos  | CONFIDENCIAL              |
| ORDEN_EXAMENES        | Solicitud de estudios         | CONFIDENCIAL              |
| RESULTADO_LABORATORIO | Resultados de laboratorio     | CONFIDENCIAL              |
| IMAGEN_RADIOLOGICA    | Imágenes médicas (DICOM)      | RESTRINGIDO               |
| CONSENTIMIENTO        | Formularios de consentimiento | CONFIDENCIAL              |
| FACTURA               | Documentos de facturación     | INTERNO                   |
| SEGURO                | Documentación de seguros      | CONFIDENCIAL              |
| IDENTIFICACION        | Documentos de identidad       | RESTRINGIDO               |

### 7.4 Almacenamiento en la Nube

Los documentos se almacenan en Google Cloud Storage con la siguiente estructura:

```
bucket-name/
├── pacientes/
│   └── {patient_id}/
│       ├── documentos/
│       │   └── {document_id}.{extension}
│       └── imagenes/
│           └── {document_id}.{extension}
└── temp/
    └── uploads/
```

---

## 8. Módulo de Dashboard

### 8.1 Descripción

El módulo de Dashboard proporciona métricas y estadísticas en tiempo real para la gestión del consultorio médico.

### 8.2 Esquema de Base de Datos

#### Tabla METRICAS_SISTEMA

```sql
CREATE TABLE IF NOT EXISTS METRICAS_SISTEMA (
    id BIGSERIAL PRIMARY KEY,

    -- Identificación
    nombre_metrica VARCHAR(100) NOT NULL,
    categoria VARCHAR(15) NOT NULL CHECK (categoria IN (
        'RENDIMIENTO', 'SEGURIDAD', 'USUARIOS', 'DATOS',
        'SISTEMA', 'NEGOCIO', 'CUMPLIMIENTO'
    )),

    -- Valor
    valor_numerico DECIMAL(15,4) NULL,
    valor_texto VARCHAR(500) NULL,
    valor_json JSONB NULL,
    unidad_medida VARCHAR(20) NULL,

    -- Información temporal
    fecha_metrica TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    periodo_agregacion VARCHAR(15) NOT NULL DEFAULT 'INSTANTANEO'
        CHECK (periodo_agregacion IN ('INSTANTANEO', 'MINUTO', 'HORA', 'DIA', 'SEMANA', 'MES')),

    -- Contexto
    etiquetas JSONB NULL,
    metadatos JSONB NULL,

    -- Origen
    origen_sistema VARCHAR(50) NOT NULL DEFAULT 'ecosecial',
    componente VARCHAR(50) NULL
);
```

### 8.3 Métricas Principales

| Métrica                  | Categoría | Descripción                     |
| ------------------------ | --------- | ------------------------------- |
| `usuarios_activos_total` | USUARIOS  | Total de usuarios activos       |
| `sesiones_activas_total` | USUARIOS  | Sesiones activas en tiempo real |
| `logs_generados_total`   | SISTEMA   | Logs generados por día          |
| `alertas_activas_total`  | SEGURIDAD | Alertas de seguridad activas    |
| `pacientes_total`        | NEGOCIO   | Total de pacientes registrados  |
| `citas_hoy`              | NEGOCIO   | Citas programadas para hoy      |
| `citas_completadas_mes`  | NEGOCIO   | Citas completadas en el mes     |
| `documentos_total`       | DATOS     | Total de documentos almacenados |

### 8.4 Componentes del Dashboard

```typescript
// Estructura de componentes recomendada
interface DashboardComponents {
  atoms: {
    StatCard: 'Tarjeta de estadística individual';
    TrendIndicator: 'Indicador de tendencia (↑↓→)';
    AlertBadge: 'Badge de alerta con contador';
    StatusDot: 'Punto de estado (activo/inactivo)';
  };
  molecules: {
    QuickStatPanel: 'Panel de estadísticas rápidas';
    PatientContextCard: 'Tarjeta de contexto de paciente';
    NotificationPreview: 'Vista previa de notificaciones';
    ActivityItem: 'Elemento de actividad reciente';
  };
  organisms: {
    DashboardGrid: 'Grid principal del dashboard';
    ActivityFeed: 'Feed de actividades recientes';
    QuickActionsBar: 'Barra de acciones rápidas';
    MetricsOverview: 'Resumen de métricas';
  };
}
```

---

## 9. Módulo de Comunicaciones

### 9.1 Descripción

El módulo de comunicaciones gestiona las notificaciones y mensajes del sistema.

### 9.2 Esquema de Base de Datos

#### Tabla COMUNICACIONES

```sql
CREATE TABLE IF NOT EXISTS COMUNICACIONES (
    id BIGSERIAL PRIMARY KEY,

    -- Identificación
    tipo_comunicacion VARCHAR(20) NOT NULL CHECK (tipo_comunicacion IN (
        'NOTIFICACION', 'MENSAJE', 'ALERTA', 'RECORDATORIO', 'SISTEMA'
    )),
    canal VARCHAR(15) NOT NULL CHECK (canal IN (
        'IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WEBHOOK'
    )),

    -- Contenido
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos_adicionales JSONB,

    -- Remitente
    remitente_id INTEGER NULL,
    remitente_tipo VARCHAR(20) DEFAULT 'SISTEMA' CHECK (remitente_tipo IN (
        'SISTEMA', 'USUARIO', 'AUTOMATICO'
    )),

    -- Destinatarios
    destinatario_id INTEGER NOT NULL,
    destinatario_tipo VARCHAR(20) DEFAULT 'USUARIO' CHECK (destinatario_tipo IN (
        'USUARIO', 'ROL', 'GRUPO', 'TODOS'
    )),

    -- Estado
    estado VARCHAR(15) DEFAULT 'PENDIENTE' CHECK (estado IN (
        'PENDIENTE', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'ERROR', 'CANCELADO'
    )),
    fecha_envio TIMESTAMP NULL,
    fecha_entrega TIMESTAMP NULL,
    fecha_lectura TIMESTAMP NULL,

    -- Prioridad
    prioridad VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN (
        'BAJA', 'NORMAL', 'ALTA', 'URGENTE'
    )),

    -- Programación
    fecha_programada TIMESTAMP NULL,
    recurrente BOOLEAN DEFAULT FALSE,
    patron_recurrencia VARCHAR(50) NULL,

    -- Acciones
    accion_requerida BOOLEAN DEFAULT FALSE,
    tipo_accion VARCHAR(50) NULL,
    datos_accion JSONB NULL,
    fecha_respuesta TIMESTAMP NULL,
    respuesta TEXT NULL,

    -- Auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 9.3 Tipos de Notificaciones

| Tipo         | Canal         | Prioridad | Descripción                            |
| ------------ | ------------- | --------- | -------------------------------------- |
| NOTIFICACION | IN_APP        | NORMAL    | Notificaciones dentro de la aplicación |
| MENSAJE      | IN_APP, EMAIL | NORMAL    | Mensajes entre usuarios                |
| ALERTA       | IN_APP, SMS   | ALTA      | Alertas del sistema                    |
| RECORDATORIO | IN_APP, EMAIL | NORMAL    | Recordatorios de citas                 |
| SISTEMA      | IN_APP        | BAJA      | Notificaciones del sistema             |

---

## 10. Módulo de Asistente IA

### 10.1 Descripción

El módulo de Asistente IA (AVI - Asistente Virtual Inteligente) integra Google Cloud Vertex AI con el modelo Gemini 2.0 Flash Thinking para proporcionar asistencia médica inteligente.

### 10.2 Configuración del Servicio

```javascript
// _backend/services/vertexAiService.js

class VertexAiService {
  constructor() {
    this.vertexAi = null;
    this.generativeModel = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.vertexAi = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      });

      this.generativeModel = this.vertexAi.getGenerativeModel({
        model: 'gemini-2.0-flash-thinking-exp',
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        },
        systemInstruction: {
          parts: [
            {
              text: `Eres AVI (Asistente Virtual Inteligente), una IA médica avanzada 
                               potenciada por arquitectura de razonamiento profundo (Thinking Model).
                               Tu propósito es asistir a profesionales de la salud en:
                               - Análisis de síntomas y diagnósticos diferenciales
                               - Interpretación de resultados de laboratorio
                               - Recomendaciones de tratamiento basadas en evidencia
                               - Generación de documentación médica
                               - Consultas sobre medicamentos y dosis`,
            },
          ],
        },
      });

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error('Error initializing Vertex AI:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 10.3 Funcionalidades Principales

#### Chat Virtual

```javascript
async virtualAssistantChat(message, userId, context = {}) {
    this.checkInitialization();

    try {
        const chatHistory = await this.getChatHistory(userId);

        const result = await this.generativeModel.generateContent({
            contents: [
                ...chatHistory,
                { role: 'user', parts: [{ text: message }] }
            ],
            systemInstruction: {
                parts: [{ text: this.getSystemPrompt(context) }]
            }
        });

        const response = result.response.candidates[0].content.parts[0].text;

        return {
            success: true,
            response: response,
            actions: this.detectRequiredActions(message, response)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

#### Generación de Borradores de Email

```javascript
async generateEmailDraft(emailData) {
    const prompt = `Genera un borrador de email médico profesional con los siguientes datos:
        - Destinatario: ${emailData.recipient}
        - Asunto: ${emailData.subject}
        - Contexto: ${emailData.context}
        - Tono: ${emailData.tone || 'profesional'}

        El email debe ser claro, conciso y mantener confidencialidad médica.`;

    const result = await this.generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    return {
        success: true,
        draft: result.response.candidates[0].content.parts[0].text
    };
}
```

#### Resumen Médico

```javascript
async generateMedicalSummary(patientData, consultations) {
    const prompt = `Genera un resumen médico profesional basado en:
        - Datos del paciente: ${JSON.stringify(patientData)}
        - Consultas: ${JSON.stringify(consultations)}

        Incluye:
        1. Antecedentes relevantes
        2. Diagnósticos principales
        3. Tratamientos actuales
        4. Recomendaciones de seguimiento`;

    const result = await this.generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    return {
        success: true,
        summary: result.response.candidates[0].content.parts[0].text
    };
}
```

### 10.4 Detección de Acciones Requeridas

```javascript
detectRequiredActions(userMessage, assistantResponse) {
    const actions = [];

    // Detectar si se necesita crear una cita
    if (assistantResponse.includes('programar cita') ||
        assistantResponse.includes('agendar consulta')) {
        actions.push({
            type: 'CREATE_APPOINTMENT',
            confidence: 0.85,
            data: this.extractAppointmentData(assistantResponse)
        });
    }

    // Detectar si se necesita crear un paciente
    if (assistantResponse.includes('registrar paciente') ||
        assistantResponse.includes('nuevo paciente')) {
        actions.push({
            type: 'CREATE_PATIENT',
            confidence: 0.90,
            data: this.extractPatientData(assistantResponse)
        });
    }

    // Detectar si se necesita generar un documento
    if (assistantResponse.includes('generar documento') ||
        assistantResponse.includes('crear receta')) {
        actions.push({
            type: 'GENERATE_DOCUMENT',
            confidence: 0.88,
            data: this.extractDocumentData(assistantResponse)
        });
    }

    return actions;
}
```

---

## 11. Módulo de Auditoría y Logs

### 11.1 Descripción

El módulo de auditoría implementa un sistema WORM (Write Once Read Many) para logs inmutables que cumplen con regulaciones médicas.

### 11.2 Esquema de Base de Datos

#### Tabla LOGS_AUDITORIA

```sql
CREATE TABLE IF NOT EXISTS LOGS_AUDITORIA (
    id BIGSERIAL PRIMARY KEY,

    -- Identificación del evento
    evento_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN (
        'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA',
        'CREAR_REGISTRO', 'ACTUALIZAR_REGISTRO', 'ELIMINAR_REGISTRO', 'CONSULTAR_REGISTRO',
        'SUBIR_ARCHIVO', 'DESCARGAR_ARCHIVO', 'ELIMINAR_ARCHIVO',
        'CAMBIO_PERMISOS', 'CAMBIO_ROL', 'CAMBIO_PASSWORD',
        'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO',
        'BACKUP_CREADO', 'RESTAURACION_DATOS',
        'CONFIGURACION_CAMBIADA', 'MANTENIMIENTO_SISTEMA',
        'ERROR_SISTEMA', 'ALERTA_SEGURIDAD'
    )),
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN (
        'AUTENTICACION', 'AUTORIZACION', 'DATOS_PACIENTE', 'HISTORIAL_CLINICO',
        'DOCUMENTOS', 'CITAS', 'USUARIOS', 'SISTEMA', 'SEGURIDAD', 'REPORTES'
    )),
    nivel_criticidad VARCHAR(10) NOT NULL DEFAULT 'MEDIO'
        CHECK (nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),

    -- Información del usuario
    usuario_id INTEGER NULL,
    username VARCHAR(50) NULL,
    rol_usuario VARCHAR(50) NULL,

    -- Información de la sesión
    sesion_id VARCHAR(100) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    dispositivo VARCHAR(100) NULL,
    ubicacion_geografica VARCHAR(200) NULL,

    -- Información del recurso
    modulo VARCHAR(50) NOT NULL,
    recurso_tipo VARCHAR(50) NULL,
    recurso_id VARCHAR(36) NULL,
    recurso_nombre VARCHAR(200) NULL,

    -- Detalles de la operación
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    datos_antes JSONB NULL,
    datos_despues JSONB NULL,
    metadatos_adicionales JSONB NULL,

    -- Información temporal
    fecha_evento TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duracion_ms INTEGER NULL,

    -- Integridad WORM
    hash_integridad VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64) NULL,
    numero_secuencia BIGINT NOT NULL,

    -- Resultado
    resultado VARCHAR(10) NOT NULL DEFAULT 'EXITOSO'
        CHECK (resultado IN ('EXITOSO', 'FALLIDO', 'PARCIAL', 'CANCELADO')),
    codigo_error VARCHAR(20) NULL,
    mensaje_error TEXT NULL,

    -- Cumplimiento
    requiere_retencion BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_retencion_hasta DATE NULL,
    politica_retencion VARCHAR(50) NULL
);
```

### 11.3 Triggers de Inmutabilidad

```sql
-- Función para prevenir actualizaciones
CREATE OR REPLACE FUNCTION prevent_logs_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser modificados';
END;
$$ LANGUAGE plpgsql;

-- Función para prevenir eliminaciones
CREATE OR REPLACE FUNCTION prevent_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser eliminados';
END;
$$ LANGUAGE plpgsql;

-- Función para generar hash de integridad
CREATE OR REPLACE FUNCTION generate_log_integrity()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_numero_secuencia BIGINT DEFAULT 0;
    ultimo_hash VARCHAR(64) DEFAULT '';
    datos_hash TEXT;
BEGIN
    -- Obtener último número de secuencia y hash
    SELECT COALESCE(MAX(numero_secuencia), 0), COALESCE(MAX(hash_integridad), '')
    INTO ultimo_numero_secuencia, ultimo_hash
    FROM LOGS_AUDITORIA;

    -- Asignar número de secuencia
    NEW.numero_secuencia = ultimo_numero_secuencia + 1;
    NEW.hash_anterior = ultimo_hash;

    -- Preparar datos para hash
    datos_hash = CONCAT(
        COALESCE(NEW.evento_id::TEXT, ''), '|',
        COALESCE(NEW.tipo_evento, ''), '|',
        COALESCE(NEW.categoria, ''), '|',
        COALESCE(NEW.usuario_id::TEXT, ''), '|',
        COALESCE(NEW.modulo, ''), '|',
        COALESCE(NEW.accion, ''), '|',
        COALESCE(NEW.descripcion, ''), '|',
        COALESCE(NEW.fecha_evento::TEXT, ''), '|',
        COALESCE(NEW.numero_secuencia::TEXT, ''), '|',
        COALESCE(NEW.hash_anterior, '')
    );

    -- Generar hash de integridad
    NEW.hash_integridad = encode(digest(datos_hash, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers
CREATE TRIGGER tr_logs_auditoria_prevent_update
    BEFORE UPDATE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_update();

CREATE TRIGGER tr_logs_auditoria_prevent_delete
    BEFORE DELETE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_delete();

CREATE TRIGGER tr_logs_auditoria_before_insert
    BEFORE INSERT ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION generate_log_integrity();
```

### 11.4 Procedimiento de Log

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

## 12. Infraestructura Cloud

### 12.1 Descripción

La infraestructura está diseñada para desplegarse en Google Cloud Platform utilizando Cloud Run para el servidor de aplicaciones.

### 12.2 Componentes de GCP

| Componente   | Servicio GCP              | Descripción                             |
| ------------ | ------------------------- | --------------------------------------- |
| **Compute**  | Cloud Run                 | Servidor de aplicaciones containerizado |
| **Database** | Cloud SQL (PostgreSQL 16) | Base de datos relacional                |
| **Cache**    | Memorystore (Redis)       | Cache y sesiones                        |
| **Storage**  | Cloud Storage             | Almacenamiento de archivos              |
| **Secrets**  | Secret Manager            | Gestión de secretos y llaves            |
| **AI**       | Vertex AI                 | Asistente virtual inteligente           |

### 12.3 Variables de Entorno

```bash
# Variables mínimas
NODE_ENV=production
DEPLOYMENT_TYPE=selfhosted
DEPLOYMENT_PLATFORM=gcp
PORT=3010

# Base de datos
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME

# Redis
REDIS_SERVER_HOST=10.x.x.x
REDIS_SERVER_PORT=6379

# URL externa
AFFINE_SERVER_EXTERNAL_URL=https://TU_DOMINIO

# Google Cloud
GOOGLE_CLOUD_PROJECT=tu-proyecto-id
GOOGLE_CLOUD_LOCATION=us-central1
```

### 12.4 Rutas del Servidor

| Ruta         | Descripción                 |
| ------------ | --------------------------- |
| `/`          | Aplicación web              |
| `/graphql`   | Endpoint GraphQL            |
| `/socket.io` | WebSockets para tiempo real |
| `/admin`     | Interfaz de administración  |
| `/api/*`     | API REST                    |
| `/health`    | Health check                |

### 12.5 Despliegue

```bash
# Construir imagen
gcloud builds submit --tag gcr.io/PROJECT_ID/ecodigital

# Desplegar en Cloud Run
gcloud run deploy ecodigital \
  --image gcr.io/PROJECT_ID/ecodigital \
  --platform managed \
  --region us-central1 \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --set-env-vars-file env.yaml \
  --set-secrets PRIVATE_KEY=private-key:latest
```

---

## 13. Base de Datos

### 13.1 Descripción

La base de datos utiliza PostgreSQL 16 con características avanzadas como JSONB, triggers y funciones almacenadas.

### 13.2 Tablas Principales

| Tabla                     | Descripción                      |
| ------------------------- | -------------------------------- |
| `ROLES`                   | Roles del sistema con permisos   |
| `USUARIOS`                | Usuarios del sistema             |
| `SESIONES_USUARIO`        | Sesiones activas                 |
| `PERMISOS_USUARIO`        | Permisos específicos por usuario |
| `LOG_ACCESOS`             | Registro de accesos              |
| `CONFIGURACION_SEGURIDAD` | Políticas de seguridad           |
| `PACIENTES`               | Información de pacientes         |
| `HISTORIAL_CLINICO`       | Registros médicos                |
| `CITAS`                   | Citas médicas                    |
| `DOCUMENTOS`              | Archivos médicos                 |
| `HORARIOS_MEDICOS`        | Horarios de médicos              |
| `LOGS_AUDITORIA`          | Logs inmutables WORM             |

### 13.3 Relaciones

```
ROLES ─┬─< USUARIOS >───< SESIONES_USUARIO
       │        │
       │        ├───< PERMISOS_USUARIO
       │        │
       │        └───< LOG_ACCESOS
       │
       └───< PACIENTES >───< HISTORIAL_CLINICO
                    │              │
                    │              └───< DOCUMENTOS
                    │
                    └───< CITAS >───< DOCUMENTOS
```

### 13.4 Índices Optimizados

```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX idx_citas_medico_fecha ON CITAS(medico_id, fecha_hora);
CREATE INDEX idx_historial_paciente_fecha ON HISTORIAL_CLINICO(id_paciente, fecha_hora);
CREATE INDEX idx_logs_fecha_evento ON LOGS_AUDITORIA(fecha_evento);
CREATE INDEX idx_documentos_paciente ON DOCUMENTOS(id_paciente);
```

### 13.5 Soft Delete

Todas las tablas principales implementan soft delete mediante el campo `activo`:

```sql
-- Ejemplo de consulta con soft delete
SELECT * FROM PACIENTES WHERE activo = TRUE;

-- Ejemplo de eliminación lógica
UPDATE PACIENTES SET activo = FALSE WHERE id = $1;
```

---

## 14. Frontend

### 14.1 Descripción

El frontend está construido como un monorepo utilizando Yarn Workspaces, con múltiples aplicaciones:

- **Web App**: Vue.js + Nuxt.js
- **Desktop App**: Electron
- **Mobile App**: React Native

### 14.2 Estructura del Monorepo

```
packages/
├── common/
│   ├── debug/           # Utilidades de depuración
│   ├── error/           # Manejo de errores
│   ├── graphql/         # Cliente GraphQL
│   ├── infra/           # Infraestructura
│   ├── native/          # Módulos nativos (Rust)
│   ├── nbstore/         # Almacenamiento
│   ├── s3-compat/       # Compatibilidad S3
│   └── y-octo/          # CRDTs
├── blocksuite/           # Editor de bloques
└── frontend/            # Aplicaciones frontend
```

### 14.3 BlockSuite

BlockSuite es el framework de edición de documentos basado en bloques:

```typescript
// Estructura de almacenamiento nbstore
interface StorageComponents {
  connection: {
    // Conexión a backend
    shared: SharedConnection;
    broadcast: BroadcastChannel;
  };
  frontend: {
    // Almacenamiento frontend
    awareness: Awareness;
    blob: BlobStorage;
    doc: DocStorage;
    indexer: Indexer;
  };
  impls: {
    // Implementaciones
    cloud: CloudStorage;
    idb: IndexedDBStorage;
    sqlite: SQLiteStorage;
  };
}
```

### 14.4 Compilación

```bash
# Instalar dependencias
yarn install

# Compilar dependencias nativas
yarn ecodigital @ecodigital/native build

# Compilar servidor
yarn ecodigital @ecodigital/server-native build

# Desarrollo
yarn dev

# Producción
yarn build
```

---

## 15. BlockSuite

### 15.1 Descripción

BlockSuite es un framework de edición de documentos basado en bloques que permite crear documentos ricos con diferentes tipos de contenido.

### 15.2 Tipos de Bloques

| Bloque      | Descripción                     |
| ----------- | ------------------------------- |
| `paragraph` | Párrafo de texto                |
| `heading`   | Títulos (h1-h6)                 |
| `list`      | Listas ordenadas y no ordenadas |
| `code`      | Bloques de código               |
| `image`     | Imágenes                        |
| `table`     | Tablas                          |
| `database`  | Base de datos embebida          |
| `divider`   | Separador                       |

### 15.3 Almacenamiento

```typescript
// packages/common/nbstore/src/storage/doc.ts

interface DocStorage {
  // Operaciones de documentos
  createDoc(id: string): Promise<Doc>;
  getDoc(id: string): Promise<Doc | null>;
  updateDoc(id: string, update: Uint8Array): Promise<void>;
  deleteDoc(id: string): Promise<void>;

  // Sincronización
  syncDoc(id: string): Promise<SyncState>;
  getPendingUpdates(id: string): Promise<Uint8Array[]>;
}
```

### 15.4 Sincronización

```typescript
// packages/common/nbstore/src/sync/doc/index.ts

interface DocSync {
  // Estado de sincronización
  state: SyncState;

  // Operaciones
  pushUpdate(update: Uint8Array): Promise<void>;
  pullUpdates(since: number): Promise<Uint8Array[]>;

  // Conflictos
  resolveConflict(local: Uint8Array, remote: Uint8Array): Uint8Array;
}
```

---

## 16. Sidebar y Navegación

### 16.1 Descripción

El sidebar implementa una arquitectura de información optimizada para entornos quirúrgicos con acceso rápido a funciones críticas.

### 16.2 Estructura del Sidebar

```
Sidebar ECOSSECIAL v2
├── 🏠 Quick Actions
│   ├── Quick Search (Búsqueda global)
│   └── Journal (Notas rápidas)
│
├── 📋 Operations (Módulos Operativos)
│   ├── Tareas (Gestión de tareas)
│   ├── Agenda (Citas y programación)
│   ├── Calendario (Vista temporal)
│   └── Métricas (Reportes y KPIs)
│
├── 🛠️ Tools (Herramientas Clínicas)
│   ├── VolView 3D (Imágenes médicas)
│   ├── AI Workflow (Asistente inteligente)
│   └── Sterling PDF (Documentos)
│
├── ⭐ Favorites (Accesos rápidos personalizados)
│   └── [Dynamic based on user]
│
├── 📁 Organize (Organización de documentos)
│   └── [Dynamic folders and tags]
│
├── 🏷️ Tags (Etiquetas de clasificación)
│   └── [Dynamic tags]
│
├── 📚 Collections (Colecciones de documentos)
│   └── [Dynamic collections]
│
├── ⚙️ System (Configuración del sistema)
│   ├── Settings (Configuración general)
│   ├── Cloud (Sincronización)
│   ├── Archivos (Gestión de archivos)
│   └── Registros (Logs y auditoría)
│
└── 🗑️ Others (Funciones adicionales)
    ├── Trash (Papelera)
    ├── Import (Importar datos)
    ├── Invite (Invitar usuarios)
    └── Templates (Plantillas)
```

### 16.3 Módulos Principales

| #   | Módulo                    | Arquetipo UI               | Componentes Clave                                       |
| --- | ------------------------- | -------------------------- | ------------------------------------------------------- |
| 1   | **Dashboard**             | Executive Dashboard        | StatCard, TrendIndicator, AlertBadge                    |
| 2   | **Gestión de Pacientes**  | Master-Detail CRUD         | PatientCard, SearchFilters, MedicalAlertsPanel          |
| 3   | **Agenda Quirúrgica**     | Calendar-Centric Timeline  | DayScheduleView, AppointmentCard, ConflictWarning       |
| 4   | **Historial Clínico**     | Timeline-Structured Record | ConsultationCard, VitalSignsPanel, DiagnosticCodeSearch |
| 5   | **Reportes y Métricas**   | Analytics Dashboard        | StatChart, TrendGraph, ExportWizard                     |
| 6   | **Configuración**         | Settings Hierarchy         | SettingsGroup, UserPermissionPanel, SystemConfigForm    |
| 7   | **Archivos y Documentos** | File Management Grid       | FileCard, UploadZone, DocumentViewer                    |

### 16.4 Patrones de Interacción HIPAA

#### Confirmación Doble para Eliminación

```
[DELETE ACTION] → [CONFIRMATION DIALOG] → [TYPE CONFIRMATION TEXT] → [FINAL CONFIRM]
```

#### Búsqueda con Autocompletado

```
[SEARCH INPUT] → [SUGGESTIONS DROPDOWN] → [QUICK PREVIEW] → [SELECTION]
```

#### Alerta Médica Prominente

```
[ALERT ICON] + [COLOR CODE] + [BRIEF TEXT] + [EXPANDABLE DETAILS]
```

#### Guardado Automático con Indicador

```
[EDIT] → [AUTO-SAVE TRIGGER] → [SAVING INDICATOR] → [SAVED CONFIRMATION]
```

---

## 17. Seguridad

### 17.1 Autenticación

- **JWT**: Access tokens con expiración de 15 minutos
- **Refresh Tokens**: Tokens de refresco con expiración de 7 días
- **Rate Limiting**: 100 requests por 15 minutos por IP
- **Bloqueo de Cuenta**: Después de 5 intentos fallidos

### 17.2 Autorización

- **RBAC**: Role-Based Access Control con 4 niveles
- **Permisos Granulares**: Permisos específicos por módulo y acción
- **Middleware**: Verificación en cada endpoint protegido

### 17.3 Protección de Datos

- **Encriptación at Rest**: Datos sensibles encriptados en base de datos
- **Encriptación in Transit**: HTTPS obligatorio
- **Soft Delete**: Eliminación lógica de registros
- **Auditoría WORM**: Logs inmutables con hash de integridad

### 17.4 Cumplimiento HIPAA

| Principio                | Implementación                                     |
| ------------------------ | -------------------------------------------------- |
| Minimización de Datos    | Mostrar solo información esencial por defecto      |
| Control de Acceso        | Indicadores visuales de permisos y restricciones   |
| Auditoría de Acciones    | Registro automático de visualizaciones y ediciones |
| Encriptación Visual      | Indicadores de datos encriptados/transmitidos      |
| Consentimiento Explícito | Diálogos de confirmación para acciones sensibles   |

---

## 18. API Reference

### 18.1 Autenticación

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "contraseña"
}

Response 200:
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "jsanchez",
      "email": "usuario@ejemplo.com",
      "nombres": "Joel",
      "apellidos": "Sánchez García",
      "rol": "Admin Principal"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

### 18.2 Pacientes

```http
GET /api/patients?page=1&limit=10&search=juan
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": 1,
        "numero_expediente": "EXP-001",
        "nombre_completo": "Juan Pérez",
        "fecha_nacimiento": "1985-05-15",
        "genero": "M",
        "telefono": "+1-809-555-0100"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
}
```

### 18.3 Citas

```http
POST /api/appointments
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_paciente": 1,
  "medico_id": 2,
  "fecha_hora": "2026-03-20T10:00:00Z",
  "duracion_minutos": 30,
  "tipo_cita": "CONSULTA_GENERAL",
  "motivo": "Consulta de rutina"
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "numero_cita": "CITA-20260320-000001",
    "estado": "PROGRAMADA"
  }
}
```

### 18.4 Códigos de Estado HTTP

| Código | Descripción                                       |
| ------ | ------------------------------------------------- |
| 200    | OK - Solicitud exitosa                            |
| 201    | Created - Recurso creado                          |
| 400    | Bad Request - Error de validación                 |
| 401    | Unauthorized - No autenticado                     |
| 403    | Forbidden - Sin permisos                          |
| 404    | Not Found - Recurso no encontrado                 |
| 409    | Conflict - Conflicto (ej: cita duplicada)         |
| 500    | Internal Server Error - Error del servidor        |
| 503    | Service Unavailable - Base de datos no disponible |

---

## Anexos

### A. Glosario de Términos

| Término    | Definición                                                |
| ---------- | --------------------------------------------------------- |
| **CIE-10** | Clasificación Internacional de Enfermedades, 10ª revisión |
| **DICOM**  | Digital Imaging and Communications in Medicine            |
| **HIPAA**  | Health Insurance Portability and Accountability Act       |
| **RBAC**   | Role-Based Access Control                                 |
| **WORM**   | Write Once Read Many                                      |
| **CRDT**   | Conflict-free Replicated Data Type                        |
| **JWT**    | JSON Web Token                                            |

### B. Referencias

- PostgreSQL 16 Documentation: https://www.postgresql.org/docs/16/
- Google Cloud Vertex AI: https://cloud.google.com/vertex-ai
- BlockSuite Framework: https://blocksuite.io/
- HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/

---

**Documento preparado por:** Sistema de Documentación Automática  
**Versión:** 2.0  
**Estado:** Completado  
**Última actualización:** Marzo 2026
