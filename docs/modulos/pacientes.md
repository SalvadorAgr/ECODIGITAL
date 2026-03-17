# Módulo de Pacientes

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de pacientes gestiona la información demográfica y médica básica de los pacientes del consultorio, incluyendo datos personales, información médica básica y contactos de emergencia.

---

## Esquema de Base de Datos

### Tabla PACIENTES

```sql
CREATE TABLE IF NOT EXISTS PACIENTES (
    id SERIAL PRIMARY KEY,

    -- Información personal (ENCRYPTED AT REST)
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

    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    notas_administrativas TEXT,

    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Índices

```sql
-- Índices para rendimiento y búsqueda
CREATE INDEX idx_pacientes_nombre ON PACIENTES(nombre);
CREATE INDEX idx_pacientes_apellido ON PACIENTES(apellido);
CREATE INDEX idx_pacientes_nombre_apellido ON PACIENTES(nombre, apellido);
CREATE INDEX idx_pacientes_cedula ON PACIENTES(cedula);
CREATE INDEX idx_pacientes_fecha_consulta ON PACIENTES(fecha_primera_consulta);
CREATE INDEX idx_pacientes_ultima_consulta ON PACIENTES(fecha_ultima_consulta);
CREATE INDEX idx_pacientes_activo ON PACIENTES(activo);
CREATE INDEX idx_pacientes_expediente ON PACIENTES(numero_expediente);
CREATE INDEX idx_pacientes_creado_por ON PACIENTES(creado_por);
```

---

## Endpoints de la API

### Listar Pacientes

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
        "telefono": "+1-809-555-0100",
        "email": "juan.perez@email.com",
        "tipo_sangre": "O+",
        "fecha_primera_consulta": "2024-01-15",
        "fecha_ultima_consulta": "2026-03-10"
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

### Obtener Paciente por ID

```http
GET /api/patients/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "numero_expediente": "EXP-001",
    "nombre": "Juan",
    "apellido": "Pérez",
    "cedula": "001-1234567-8",
    "fecha_nacimiento": "1985-05-15",
    "genero": "M",
    "telefono": "+1-809-555-0100",
    "email": "juan.perez@email.com",
    "direccion": "Calle Principal 123",
    "ciudad": "Santo Domingo",
    "provincia": "Distrito Nacional",
    "tipo_sangre": "O+",
    "alergias": "Penicilina",
    "medicamentos_actuales": "Ninguno",
    "condiciones_medicas": "Hipertensión controlada",
    "contacto_emergencia_nombre": "María Pérez",
    "contacto_emergencia_telefono": "+1-809-555-0101",
    "contacto_emergencia_relacion": "Esposa",
    "seguro_medico": "ARS Universal",
    "numero_poliza": "POL-123456",
    "activo": true,
    "fecha_creacion": "2024-01-15T10:00:00Z"
  }
}
```

### Crear Paciente

```http
POST /api/patients
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Juan",
  "apellido": "Pérez",
  "cedula": "001-1234567-8",
  "fecha_nacimiento": "1985-05-15",
  "genero": "M",
  "telefono": "+1-809-555-0100",
  "email": "juan.perez@email.com",
  "direccion": "Calle Principal 123",
  "ciudad": "Santo Domingo",
  "tipo_sangre": "O+",
  "alergias": "Penicilina",
  "contacto_emergencia_nombre": "María Pérez",
  "contacto_emergencia_telefono": "+1-809-555-0101",
  "contacto_emergencia_relacion": "Esposa"
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "numero_expediente": "EXP-001",
    "nombre": "Juan",
    "apellido": "Pérez"
  }
}
```

### Actualizar Paciente

```http
PUT /api/patients/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "telefono": "+1-809-555-0199",
  "email": "juan.perez.nuevo@email.com"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "telefono": "+1-809-555-0199",
    "email": "juan.perez.nuevo@email.com"
  }
}
```

### Eliminar Paciente (Soft Delete)

```http
DELETE /api/patients/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Paciente eliminado correctamente"
}
```

### Buscar Pacientes

```http
GET /api/patients/search?q=juan&field=nombre
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 1,
        "nombre_completo": "Juan Pérez",
        "cedula": "001-1234567-8",
        "telefono": "+1-809-555-0100"
      }
    ],
    "total": 1
  }
}
```

---

## Rutas del Backend

```javascript
// _backend/routes/patientRoutes.js

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const pool = require('../db');

// Listar pacientes (paginado)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, numero_expediente, nombre, apellido, 
             fecha_nacimiento, genero, telefono, email,
             tipo_sangre, activo, fecha_creacion
      FROM PACIENTES
      WHERE activo = TRUE
    `;
    const params = [];

    if (search) {
      query += ` AND (nombre ILIKE $1 OR apellido ILIKE $1 OR cedula ILIKE $1)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY fecha_creacion DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Contar total
    const countQuery = `SELECT COUNT(*) FROM PACIENTES WHERE activo = TRUE`;
    const { rows: countRows } = await pool.query(countQuery);

    res.status(200).json({
      success: true,
      data: {
        patients: rows,
        pagination: {
          total: parseInt(countRows[0].count),
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(countRows[0].count / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener paciente por ID
router.get('/:id', authenticateToken, async (req, res) => {
  // Implementación...
});

// Crear paciente
router.post('/', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario', 'Asistente']), async (req, res) => {
  // Implementación...
});

// Actualizar paciente
router.put('/:id', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario', 'Asistente']), async (req, res) => {
  // Implementación...
});

// Eliminar paciente (soft delete)
router.delete('/:id', authenticateToken, requireRole(['Admin Principal', 'Admin Secundario']), async (req, res) => {
  // Implementación...
});

module.exports = router;
```

---

## Vistas Útiles

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

### Vista de Pacientes con Estadísticas

```sql
CREATE OR REPLACE VIEW v_pacientes_estadisticas AS
SELECT
    p.id,
    p.numero_expediente,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_completo,
    p.fecha_nacimiento,
    EXTRACT(YEAR FROM AGE(p.fecha_nacimiento)) as edad,
    p.genero,
    p.tipo_sangre,
    p.fecha_primera_consulta,
    p.fecha_ultima_consulta,
    COUNT(h.id) as total_consultas,
    COUNT(CASE WHEN h.urgente = TRUE THEN 1 END) as consultas_urgentes,
    COUNT(CASE WHEN h.requiere_seguimiento = TRUE THEN 1 END) as consultas_seguimiento,
    MAX(h.fecha_hora) as ultima_consulta_fecha,
    COUNT(DISTINCT h.medico_id) as medicos_diferentes
FROM PACIENTES p
LEFT JOIN HISTORIAL_CLINICO h ON p.id = h.id_paciente AND h.activo = TRUE
WHERE p.activo = TRUE
GROUP BY p.id, p.numero_expediente, p.nombre, p.apellido, p.fecha_nacimiento,
         p.genero, p.tipo_sangre, p.fecha_primera_consulta, p.fecha_ultima_consulta;
```

---

## Claves Foráneas

```sql
-- PACIENTES
ALTER TABLE PACIENTES
ADD CONSTRAINT fk_pacientes_creado_por
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE PACIENTES
ADD CONSTRAINT fk_pacientes_modificado_por
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Triggers

```sql
-- Trigger para actualizar fecha_modificacion
CREATE TRIGGER tr_pacientes_update_fecha_modificacion
    BEFORE UPDATE ON PACIENTES
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_modificacion();
```

---

## Tipos de Sangre Soportados

| Tipo | Descripción |
| ---- | ----------- |
| A+   | A positivo  |
| A-   | A negativo  |
| B+   | B positivo  |
| B-   | B negativo  |
| AB+  | AB positivo |
| AB-  | AB negativo |
| O+   | O positivo  |
| O-   | O negativo  |

---

## Géneros Soportados

| Código | Descripción |
| ------ | ----------- |
| M      | Masculino   |
| F      | Femenino    |
| O      | Otro        |

---

## Relaciones

```
USUARIOS ────< PACIENTES >───< HISTORIAL_CLINICO
                              │
                              └───< DOCUMENTOS
                              │
                              └───< CITAS
```

---

## Notas de Implementación

1. **Soft Delete**: Los pacientes no se eliminan físicamente, se marca `activo = FALSE`
2. **Encriptación**: Los campos sensibles deben encriptarse en reposo
3. **Auditoría**: Todos los cambios quedan registrados en `LOGS_AUDITORIA`
4. **Índices**: Optimizados para búsquedas por nombre, apellido, cédula y fechas de consulta
5. **Expediente**: El número de expediente se genera automáticamente con formato `EXP-XXXXX`
