# Módulo de Autenticación y Usuarios

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de autenticación implementa un sistema completo de gestión de usuarios con RBAC (Role-Based Access Control), sesiones JWT y auditoría de accesos.

---

## Esquema de Base de Datos

### Tabla ROLES

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

### Tabla USUARIOS

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

### Tabla SESIONES_USUARIO

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

### Tabla PERMISOS_USUARIO

```sql
CREATE TABLE IF NOT EXISTS PERMISOS_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    permitido BOOLEAN NOT NULL,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL,
    motivo TEXT,
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(usuario_id, modulo, accion)
);
```

### Tabla LOG_ACCESOS

```sql
CREATE TABLE IF NOT EXISTS LOG_ACCESOS (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    username VARCHAR(50),
    tipo_evento VARCHAR(30) NOT NULL CHECK (tipo_evento IN (
        'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA',
        'CUENTA_BLOQUEADA', 'PASSWORD_CAMBIADO'
    )),
    ip_address INET,
    user_agent TEXT,
    ubicacion VARCHAR(100),
    detalles JSONB,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla CONFIGURACION_SEGURIDAD

```sql
CREATE TABLE IF NOT EXISTS CONFIGURACION_SEGURIDAD (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    tipo VARCHAR(10) DEFAULT 'STRING' CHECK (tipo IN ('STRING', 'INTEGER', 'BOOLEAN', 'JSON')),
    descripcion TEXT,
    categoria VARCHAR(50),
    editable BOOLEAN DEFAULT TRUE,
    modificado_por INTEGER,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Roles y Permisos

### Niveles de Acceso

| Rol                  | Nivel de Acceso  | Permisos                                                                     |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| **Admin Principal**  | ADMIN_PRINCIPAL  | Acceso completo al sistema: `{"*": ["*"]}`                                   |
| **Admin Secundario** | ADMIN_SECUNDARIO | Gestión de pacientes, citas, historial, documentos; solo lectura de reportes |
| **Asistente**        | ASISTENTE        | Crear/leer/actualizar pacientes, citas y documentos                          |
| **Invitado**         | INVITADO         | Solo lectura de pacientes, citas, historial y documentos                     |

### Datos Iniciales de Roles

```sql
INSERT INTO ROLES (nombre, descripcion, permisos, nivel_acceso, es_sistema, timeout_sesion, max_sesiones_concurrentes) VALUES
('Admin Principal', 'Administrador principal con acceso completo al sistema',
 '{"*": ["*"]}', 'ADMIN_PRINCIPAL', TRUE, 7200, 5),
('Admin Secundario', 'Administrador secundario sin gestión de usuarios',
 '{"patients": ["*"], "appointments": ["*"], "clinical_history": ["*"], "documents": ["*"], "reports": ["read"]}',
 'ADMIN_SECUNDARIO', TRUE, 3600, 3),
('Asistente', 'Personal administrativo con acceso a gestión básica',
 '{"patients": ["create", "read", "update"], "appointments": ["*"], "documents": ["create", "read", "update"]}',
 'ASISTENTE', TRUE, 3600, 2),
('Invitado', 'Acceso de solo lectura para consultores externos',
 '{"patients": ["read"], "appointments": ["read"], "clinical_history": ["read"], "documents": ["read"]}',
 'INVITADO', TRUE, 1800, 1);
```

---

## Endpoints de la API

### Autenticación

| Método | Endpoint             | Descripción               |
| ------ | -------------------- | ------------------------- |
| POST   | `/api/auth/register` | Registro de nuevo usuario |
| POST   | `/api/auth/login`    | Inicio de sesión          |
| POST   | `/api/auth/refresh`  | Renovar access token      |
| POST   | `/api/auth/logout`   | Cerrar sesión             |
| GET    | `/api/auth/me`       | Obtener usuario actual    |
| PUT    | `/api/auth/password` | Cambiar contraseña        |

### Ejemplo de Login

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

---

## Middleware de Autenticación

### authenticateToken

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
```

### requireRole

```javascript
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

### requirePermission

```javascript
const requirePermission = permission => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const [module, action] = permission.split(':');

    // Verificar permisos del rol
    const roleQuery = await pool.query('SELECT permisos FROM ROLES WHERE id = $1', [req.user.role]);

    const permissions = roleQuery.rows[0].permisos;

    // Verificar si tiene permiso global
    if (permissions['*'] && permissions['*'].includes('*')) {
      return next();
    }

    // Verificar permiso específico
    if (permissions[module] && (permissions[module].includes(action) || permissions[module].includes('*'))) {
      return next();
    }

    return res.status(403).json({ error: 'Permiso denegado' });
  };
};
```

---

## Configuración de Seguridad

### Valores por Defecto

```sql
INSERT INTO CONFIGURACION_SEGURIDAD (clave, valor, tipo, descripcion, categoria, editable) VALUES
('password_min_length', '8', 'INTEGER', 'Longitud mínima de contraseña', 'password_policy', TRUE),
('password_require_uppercase', 'true', 'BOOLEAN', 'Requerir mayúsculas en contraseña', 'password_policy', TRUE),
('password_require_lowercase', 'true', 'BOOLEAN', 'Requerir minúsculas en contraseña', 'password_policy', TRUE),
('password_require_numbers', 'true', 'BOOLEAN', 'Requerir números en contraseña', 'password_policy', TRUE),
('password_require_symbols', 'false', 'BOOLEAN', 'Requerir símbolos en contraseña', 'password_policy', TRUE),
('password_expiry_days', '90', 'INTEGER', 'Días para expiración de contraseña', 'password_policy', TRUE),
('max_login_attempts', '5', 'INTEGER', 'Máximo intentos de login antes de bloqueo', 'security', TRUE),
('account_lockout_duration', '1800', 'INTEGER', 'Duración de bloqueo en segundos', 'security', TRUE),
('session_timeout_warning', '300', 'INTEGER', 'Advertencia de timeout en segundos', 'session', TRUE),
('jwt_access_token_expiry', '900', 'INTEGER', 'Expiración de access token en segundos', 'jwt', FALSE),
('jwt_refresh_token_expiry', '604800', 'INTEGER', 'Expiración de refresh token en segundos', 'jwt', FALSE),
('enable_2fa', 'false', 'BOOLEAN', 'Habilitar autenticación de dos factores', 'security', TRUE),
('force_password_change_first_login', 'true', 'BOOLEAN', 'Forzar cambio de contraseña en primer login', 'security', TRUE);
```

---

## Vistas Útiles

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

### Vista de Sesiones Activas

```sql
CREATE OR REPLACE VIEW v_sesiones_activas AS
SELECT
    s.id,
    s.usuario_id,
    u.username,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
    s.ip_address,
    s.dispositivo,
    s.fecha_inicio,
    s.fecha_ultimo_uso,
    s.fecha_expiracion,
    EXTRACT(EPOCH FROM (s.fecha_expiracion - CURRENT_TIMESTAMP))/60 as minutos_restantes
FROM SESIONES_USUARIO s
JOIN USUARIOS u ON s.usuario_id = u.id
WHERE s.activa = TRUE AND s.fecha_expiracion > CURRENT_TIMESTAMP;
```

---

## Usuario Administrador por Defecto

```sql
-- Usuario administrador por defecto
-- Contraseña temporal: EcoDigital2026! (debe cambiarse en primer login)
INSERT INTO USUARIOS (
    username, email, password_hash, salt,
    nombres, apellidos, telefono, cedula,
    titulo_profesional, especialidad, numero_colegiado,
    rol_id, activo, verificado, cambiar_password
) VALUES (
    'jsanchez', 'joel.sanchez@ecodigital.com',
    '$2b$12$LQv3c1yqBwEHFNjNJRJ3nOHSCzxwqUzaHfBvjRy4FooqQUjd2YxYO',
    'ecodigital_salt_2026',
    'Joel', 'Sánchez García', '+1-809-555-0100', '001-1234567-8',
    'Dr.', 'Cirugía Especializada', 'COL-2024-001',
    1, TRUE, TRUE, TRUE
);
```

---

## Relaciones

```
ROLES ─┬─< USUARIOS >───< SESIONES_USUARIO
       │        │
       │        ├───< PERMISOS_USUARIO
       │        │
       │        └───< LOG_ACCESOS
       │
       └───< CONFIGURACION_SEGURIDAD
```

---

## Índices

```sql
-- Índices para ROLES
CREATE INDEX idx_roles_nombre ON ROLES(nombre);
CREATE INDEX idx_roles_nivel_acceso ON ROLES(nivel_acceso);
CREATE INDEX idx_roles_activo ON ROLES(activo);

-- Índices para USUARIOS
CREATE INDEX idx_usuarios_username ON USUARIOS(username);
CREATE INDEX idx_usuarios_email ON USUARIOS(email);
CREATE INDEX idx_usuarios_rol ON USUARIOS(rol_id);
CREATE INDEX idx_usuarios_activo ON USUARIOS(activo);
CREATE INDEX idx_usuarios_bloqueado ON USUARIOS(bloqueado);
CREATE INDEX idx_usuarios_cedula ON USUARIOS(cedula);
CREATE INDEX idx_usuarios_ultimo_acceso ON USUARIOS(fecha_ultimo_acceso);

-- Índices para SESIONES_USUARIO
CREATE INDEX idx_sesiones_usuario ON SESIONES_USUARIO(usuario_id);
CREATE INDEX idx_sesiones_token ON SESIONES_USUARIO(token_sesion);
CREATE INDEX idx_sesiones_refresh ON SESIONES_USUARIO(refresh_token);
CREATE INDEX idx_sesiones_activa ON SESIONES_USUARIO(activa);
CREATE INDEX idx_sesiones_expiracion ON SESIONES_USUARIO(fecha_expiracion);

-- Índices para LOG_ACCESOS
CREATE INDEX idx_log_usuario ON LOG_ACCESOS(usuario_id);
CREATE INDEX idx_log_tipo ON LOG_ACCESOS(tipo_evento);
CREATE INDEX idx_log_fecha ON LOG_ACCESOS(fecha_evento);
CREATE INDEX idx_log_ip ON LOG_ACCESOS(ip_address);
```
