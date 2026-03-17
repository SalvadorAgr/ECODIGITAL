# Seguridad

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El sistema implementa múltiples capas de seguridad para cumplir con regulaciones médicas (HIPAA) y proteger datos sensibles de pacientes.

---

## Autenticación

### JWT (JSON Web Tokens)

```javascript
// Configuración de JWT
const jwtConfig = {
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m', // 15 minutos
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d', // 7 días
  },
};

// Generar tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.rol_id,
    },
    jwtConfig.accessToken.secret,
    { expiresIn: jwtConfig.accessToken.expiresIn }
  );

  const refreshToken = jwt.sign({ userId: user.id }, jwtConfig.refreshToken.secret, { expiresIn: jwtConfig.refreshToken.expiresIn });

  return { accessToken, refreshToken };
}
```

### Flujo de Autenticación

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────>│   API       │────>│  Database   │
│             │     │   Server    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  1. Login         │                   │
       │  (email/password) │                   │
       │ ─────────────────>│                   │
       │                   │  2. Verify        │
       │                   │ ─────────────────>│
       │                   │                   │
       │                   │  3. User data     │
       │                   │ <─────────────────│
       │                   │                   │
       │  4. Tokens         │                   │
       │ <─────────────────│                   │
       │                   │                   │
       │  5. API Request   │                   │
       │  + Access Token   │                   │
       │ ─────────────────>│                   │
       │                   │  6. Verify token  │
       │                   │                   │
       │  7. Response      │                   │
       │ <─────────────────│                   │
```

### Refresh Token

```javascript
// Endpoint de refresh
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token requerido' });
  }

  try {
    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verificar que el token está en la base de datos
    const sessionQuery = await pool.query('SELECT * FROM SESIONES_USUARIO WHERE refresh_token = $1 AND activa = TRUE', [refreshToken]);

    if (sessionQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    // Generar nuevo access token
    const userQuery = await pool.query('SELECT id, username, rol_id FROM USUARIOS WHERE id = $1', [decoded.userId]);

    const accessToken = jwt.sign(
      {
        userId: userQuery.rows[0].id,
        username: userQuery.rows[0].username,
        role: userQuery.rows[0].rol_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
});
```

---

## Autorización (RBAC)

### Roles y Permisos

| Rol                  | Nivel de Acceso  | Permisos                                                          |
| -------------------- | ---------------- | ----------------------------------------------------------------- |
| **Admin Principal**  | ADMIN_PRINCIPAL  | Acceso completo: `{"*": ["*"]}`                                   |
| **Admin Secundario** | ADMIN_SECUNDARIO | Pacientes, citas, historial, documentos; solo lectura de reportes |
| **Asistente**        | ASISTENTE        | Crear/leer/actualizar pacientes, citas y documentos               |
| **Invitado**         | INVITADO         | Solo lectura de pacientes, citas, historial y documentos          |

### Middleware de Autorización

```javascript
// Middleware de autenticación
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

    if (!userQuery.rows[0].activo) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    req.user = {
      id: userQuery.rows[0].id,
      username: userQuery.rows[0].username,
      email: userQuery.rows[0].email,
      role: userQuery.rows[0].rol_id,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware de rol requerido
const requireRole = allowedRoles => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const userRole = await pool.query('SELECT nombre, permisos FROM ROLES WHERE id = $1', [req.user.role]);

    if (userRole.rows.length === 0) {
      return res.status(403).json({ error: 'Rol no encontrado' });
    }

    if (!allowedRoles.includes(userRole.rows[0].nombre)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    next();
  };
};

// Middleware de permiso requerido
const requirePermission = permission => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const [module, action] = permission.split(':');

    // Obtener permisos del rol
    const roleQuery = await pool.query('SELECT permisos FROM ROLES WHERE id = $1', [req.user.role]);

    const permissions = roleQuery.rows[0].permisos;

    // Verificar permiso global
    if (permissions['*'] && permissions['*'].includes('*')) {
      return next();
    }

    // Verificar permiso específico
    if (permissions[module] && (permissions[module].includes(action) || permissions[module].includes('*'))) {
      return next();
    }

    // Verificar permisos específicos del usuario
    const userPermissionQuery = await pool.query('SELECT permitido FROM PERMISOS_USUARIO WHERE usuario_id = $1 AND modulo = $2 AND accion = $3', [req.user.id, module, action]);

    if (userPermissionQuery.rows.length > 0 && userPermissionQuery.rows[0].permitido) {
      return next();
    }

    return res.status(403).json({ error: 'Permiso denegado' });
  };
};
```

### Uso en Rutas

```javascript
// Rutas protegidas por rol
router.get('/patients', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario', 'Asistente']), getPatients);
router.post('/patients', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario', 'Asistente']), createPatient);
router.delete('/patients/:id', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario']), deletePatient);

// Rutas protegidas por permiso
router.get('/reports', authenticateToken, requirePermission('reports:read'), getReports);
router.post('/users', authenticateToken, requirePermission('users:create'), createUser);
```

---

## Rate Limiting

### Configuración

```javascript
const rateLimit = require('express-rate-limit');

// Rate limiter general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
  message: {
    error: 'Demasiadas solicitudes, intente más tarde',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: {
    error: 'Demasiados intentos de login, intente más tarde',
  },
});

// Rate limiter para API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 solicitudes por minuto
  message: {
    error: 'Límite de solicitudes excedido',
  },
});

// Aplicar rate limiters
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/', apiLimiter);
```

---

## Bloqueo de Cuenta

### Configuración

```sql
-- Configuración de seguridad
INSERT INTO CONFIGURACION_SEGURIDAD (clave, valor, tipo, descripcion, categoria) VALUES
('max_login_attempts', '5', 'INTEGER', 'Máximo intentos de login antes de bloqueo', 'security'),
('account_lockout_duration', '1800', 'INTEGER', 'Duración de bloqueo en segundos', 'security');
```

### Implementación

```javascript
// Verificar intentos fallidos
async function checkLoginAttempts(username) {
  const query = await pool.query('SELECT intentos_fallidos, bloqueado, fecha_bloqueo FROM USUARIOS WHERE username = $1', [username]);

  if (query.rows.length === 0) {
    return { canLogin: false, reason: 'Usuario no encontrado' };
  }

  const user = query.rows[0];

  if (user.bloqueado) {
    const lockoutDuration = await getConfig('account_lockout_duration');
    const lockoutExpiry = new Date(user.fecha_bloqueo.getTime() + lockoutDuration * 1000);

    if (new Date() < lockoutExpiry) {
      return { canLogin: false, reason: 'Cuenta bloqueada' };
    }

    // Desbloquear cuenta
    await pool.query('UPDATE USUARIOS SET bloqueado = FALSE, intentos_fallidos = 0, fecha_bloqueo = NULL WHERE username = $1', [username]);
  }

  return { canLogin: true };
}

// Registrar intento fallido
async function recordFailedAttempt(username) {
  const maxAttempts = await getConfig('max_login_attempts');

  await pool.query('UPDATE USUARIOS SET intentos_fallidos = intentos_fallidos + 1 WHERE username = $1', [username]);

  const query = await pool.query('SELECT intentos_fallidos FROM USUARIOS WHERE username = $1', [username]);

  if (query.rows[0].intentos_fallidos >= maxAttempts) {
    await pool.query('UPDATE USUARIOS SET bloqueado = TRUE, fecha_bloqueo = CURRENT_TIMESTAMP WHERE username = $1', [username]);
  }
}

// Resetear intentos después de login exitoso
async function resetFailedAttempts(username) {
  await pool.query('UPDATE USUARIOS SET intentos_fallidos = 0, bloqueado = FALSE, fecha_bloqueo = NULL WHERE username = $1', [username]);
}
```

---

## Protección de Datos

### Encriptación

```javascript
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

// Encriptar datos sensibles
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Desencriptar datos
function decrypt(encrypted, ivHex, authTagHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Hash de Contraseñas

```javascript
const bcrypt = require('bcrypt');
const saltRounds = 12;

// Hash de contraseña
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

// Verificar contraseña
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

---

## CORS

### Configuración

```javascript
const corsOptions = {
  origin: ['http://localhost:3010', 'http://127.0.0.1:3010', process.env.AFFINE_SERVER_EXTERNAL_URL],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Forwarded-For', 'X-Real-IP'],
  credentials: true,
  maxAge: 86400, // 24 horas
};

app.use(cors(corsOptions));
```

---

## Headers de Seguridad

```javascript
const helmet = require('helmet');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.googleapis.com'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);
```

---

## Validación de Entrada

```javascript
const { body, validationResult } = require('express-validator');

// Validación de login
const loginValidation = [body('email').isEmail().normalizeEmail().withMessage('Email inválido'), body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')];

// Validación de paciente
const patientValidation = [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('apellido').trim().isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('fecha_nacimiento').isDate().withMessage('Fecha de nacimiento inválida'),
  body('genero').isIn(['M', 'F', 'O']).withMessage('Género inválido'),
  body('telefono')
    .optional()
    .matches(/^\+?[0-9\s-]+$/)
    .withMessage('Teléfono inválido'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
];

// Middleware de validación
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// Uso en rutas
router.post('/auth/login', loginValidation, validate, login);
router.post('/patients', patientValidation, validate, createPatient);
```

---

## Auditoría de Seguridad

### Registro de Eventos

```javascript
// Middleware de auditoría
async function auditLog(req, res, next) {
  const startTime = Date.now();

  // Interceptar respuesta
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Registrar en log de auditoría
    pool
      .query('SELECT sp_crear_log_auditoria($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)', [
        null, // evento_id
        getEventType(req.method, res.statusCode),
        getCategory(req.path),
        getSeverity(res.statusCode),
        req.user?.id || null,
        req.user?.username || null,
        req.user?.role || null,
        req.session?.id || null,
        req.ip,
        req.headers['user-agent'],
        getModule(req.path),
        getAction(req.method),
        `${req.method} ${req.path}`,
        getResourceType(req.path),
        req.params?.id || null,
        null, // datos_antes
        null, // datos_despues
        res.statusCode < 400 ? 'EXITOSO' : 'FALLIDO',
        duration,
      ])
      .catch(err => console.error('Error en auditoría:', err));

    originalSend.call(this, data);
  };

  next();
}
```

### Tipos de Eventos

| Tipo                         | Categoría      | Severidad |
| ---------------------------- | -------------- | --------- |
| LOGIN_EXITOSO                | AUTENTICACION  | BAJO      |
| LOGIN_FALLIDO                | AUTENTICACION  | MEDIO     |
| LOGOUT                       | AUTENTICACION  | BAJO      |
| CREAR_REGISTRO               | DATOS_PACIENTE | MEDIO     |
| ACTUALIZAR_REGISTRO          | DATOS_PACIENTE | MEDIO     |
| ELIMINAR_REGISTRO            | DATOS_PACIENTE | ALTO      |
| ACCESO_DENEGADO              | SEGURIDAD      | ALTO      |
| INTENTO_ACCESO_NO_AUTORIZADO | SEGURIDAD      | CRITICO   |

---

## Cumplimiento HIPAA

### Principios Implementados

| Principio                    | Implementación                                     |
| ---------------------------- | -------------------------------------------------- |
| **Minimización de Datos**    | Mostrar solo información esencial por defecto      |
| **Control de Acceso**        | Indicadores visuales de permisos y restricciones   |
| **Auditoría de Acciones**    | Registro automático de visualizaciones y ediciones |
| **Encriptación**             | Datos encriptados en reposo y en tránsito          |
| **Consentimiento Explícito** | Diálogos de confirmación para acciones sensibles   |
| **Integridad de Datos**      | Logs WORM con hash de integridad                   |
| **Retención de Datos**       | Políticas de retención configurables               |

### Checklist de Cumplimiento

- [x] Autenticación con JWT y refresh tokens
- [x] Autorización basada en roles (RBAC)
- [x] Rate limiting para prevenir ataques
- [x] Bloqueo de cuenta después de intentos fallidos
- [x] Encriptación de datos sensibles
- [x] Hash de contraseñas con bcrypt
- [x] CORS configurado correctamente
- [x] Headers de seguridad con Helmet
- [x] Validación de entrada
- [x] Auditoría de todas las acciones
- [x] Logs inmutables (WORM)
- [x] Soft delete para datos críticos
- [x] Conexión SSL/TLS obligatoria
- [x] Variables de entorno para secretos
- [x] Secret Manager para claves
