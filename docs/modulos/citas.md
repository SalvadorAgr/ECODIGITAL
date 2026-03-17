# Módulo de Citas

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de citas gestiona la programación de consultas médicas con detección automática de conflictos de horario, recordatorios y seguimiento del ciclo de vida de las citas.

---

## Esquema de Base de Datos

### Tabla CITAS

```sql
CREATE TABLE IF NOT EXISTS CITAS (
    id SERIAL PRIMARY KEY,

    -- Información básica de la cita
    numero_cita VARCHAR(20) UNIQUE NOT NULL,
    id_paciente INTEGER NOT NULL,
    medico_id INTEGER NOT NULL,

    -- Programación de la cita
    fecha_hora TIMESTAMP NOT NULL,
    duracion_minutos INTEGER DEFAULT 30,
    fecha_hora_fin TIMESTAMP GENERATED ALWAYS AS
        (fecha_hora + INTERVAL '1 minute' * duracion_minutos) STORED,

    -- Detalles de la cita
    tipo_cita VARCHAR(20) NOT NULL CHECK (tipo_cita IN (
        'CONSULTA_GENERAL', 'PRIMERA_VEZ', 'SEGUIMIENTO', 'CONTROL',
        'CIRUGIA', 'POST_OPERATORIO', 'URGENCIA'
    )),
    especialidad VARCHAR(100),
    motivo TEXT NOT NULL,
    observaciones TEXT,

    -- Estado de la cita
    estado VARCHAR(15) DEFAULT 'PROGRAMADA' CHECK (estado IN (
        'PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA',
        'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA'
    )),
    fecha_confirmacion TIMESTAMP NULL,
    fecha_cancelacion TIMESTAMP NULL,
    motivo_cancelacion TEXT,

    -- Información de contacto y recordatorios
    telefono_contacto VARCHAR(20),
    email_contacto VARCHAR(100),
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    fecha_recordatorio TIMESTAMP NULL,

    -- Información de la consulta (si se completó)
    historial_clinico_id BIGINT NULL,
    tiempo_espera_minutos INTEGER,
    tiempo_consulta_minutos INTEGER,

    -- Información de facturación
    costo_consulta DECIMAL(10,2),
    seguro_medico VARCHAR(100),
    copago DECIMAL(10,2),
    facturado BOOLEAN DEFAULT FALSE,

    -- Sala y recursos
    sala_consulta VARCHAR(50),
    equipos_necesarios JSONB,
    preparacion_especial TEXT,

    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,

    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla HORARIOS_MEDICOS

```sql
CREATE TABLE IF NOT EXISTS HORARIOS_MEDICOS (
    id SERIAL PRIMARY KEY,

    -- Información del médico
    medico_id INTEGER NOT NULL,

    -- Configuración del horario
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_cita_minutos INTEGER DEFAULT 30,

    -- Configuración de disponibilidad
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia DATE NULL,

    -- Excepciones y pausas
    pausas JSONB,
    observaciones TEXT,

    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(medico_id, dia_semana, fecha_inicio_vigencia)
);
```

### Tabla EXCEPCIONES_HORARIO

```sql
CREATE TABLE IF NOT EXISTS EXCEPCIONES_HORARIO (
    id SERIAL PRIMARY KEY,

    -- Información del médico
    medico_id INTEGER NOT NULL,

    -- Información de la excepción
    fecha DATE NOT NULL,
    tipo_excepcion VARCHAR(15) NOT NULL CHECK (tipo_excepcion IN (
        'NO_DISPONIBLE', 'HORARIO_ESPECIAL', 'VACACIONES',
        'ENFERMEDAD', 'CONFERENCIA', 'OTRO'
    )),
    motivo TEXT,

    -- Horario especial (si aplica)
    hora_inicio_especial TIME NULL,
    hora_fin_especial TIME NULL,

    -- Estado
    activo BOOLEAN DEFAULT TRUE,

    -- Campos de auditoría
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(medico_id, fecha)
);
```

---

## Tipos de Citas

| Tipo             | Duración Default | Color   | Descripción                   |
| ---------------- | ---------------- | ------- | ----------------------------- |
| CONSULTA_GENERAL | 30 min           | #4CAF50 | Consulta médica general       |
| PRIMERA_VEZ      | 45 min           | #2196F3 | Primera consulta del paciente |
| SEGUIMIENTO      | 20 min           | #FF9800 | Consulta de seguimiento       |
| CONTROL          | 15 min           | #9C27B0 | Consulta de control           |
| CIRUGIA          | 120 min          | #F44336 | Procedimiento quirúrgico      |
| POST_OPERATORIO  | 30 min           | #795548 | Control post-operatorio       |
| URGENCIA         | 60 min           | #E91E63 | Consulta de urgencia          |

---

## Estados de Citas

| Estado       | Descripción                            | Acciones Permitidas         |
| ------------ | -------------------------------------- | --------------------------- |
| PROGRAMADA   | Cita creada, pendiente de confirmación | Editar, Cancelar, Confirmar |
| CONFIRMADA   | Cita confirmada por el paciente        | Editar, Cancelar, Iniciar   |
| EN_CURSO     | Consulta en progreso                   | Completar                   |
| COMPLETADA   | Consulta finalizada                    | Ver detalles                |
| CANCELADA    | Cita cancelada                         | Ver detalles, Reprogramar   |
| NO_ASISTIO   | Paciente no asistió                    | Ver detalles, Reprogramar   |
| REPROGRAMADA | Cita reprogramada                      | Ver detalles                |

---

## Endpoints de la API

### Listar Citas

```http
GET /api/appointments?page=1&limit=10&medico_id=1&fecha=2026-03-20&estado=PROGRAMADA
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": 1,
        "numero_cita": "CITA-20260320-000001",
        "fecha_hora": "2026-03-20T10:00:00Z",
        "duracion_minutos": 30,
        "tipo_cita": "CONSULTA_GENERAL",
        "estado": "PROGRAMADA",
        "paciente": {
          "id": 1,
          "nombre_completo": "Juan Pérez",
          "telefono": "+1-809-555-0100"
        },
        "medico": {
          "id": 2,
          "nombre_completo": "Dr. Joel Sánchez",
          "especialidad": "Cirugía Especializada"
        },
        "motivo": "Consulta de rutina"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

### Crear Cita

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
  "motivo": "Consulta de rutina",
  "telefono_contacto": "+1-809-555-0100",
  "email_contacto": "juan.perez@email.com"
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "numero_cita": "CITA-20260320-000001",
    "estado": "PROGRAMADA",
    "fecha_hora": "2026-03-20T10:00:00Z"
  }
}
```

### Verificar Disponibilidad

```http
GET /api/appointments/availability/:doctorId?date=2026-03-20&duration=30
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "date": "2026-03-20",
    "doctor_id": 2,
    "working_hours": {
      "start": "08:00",
      "end": "18:00",
      "lunch_start": "13:00",
      "lunch_end": "14:00"
    },
    "available_slots": [
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
      "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
      "16:00", "16:30", "17:00", "17:30"
    ],
    "booked_slots": [
      { "time": "12:00", "patient": "María García", "duration": 30 }
    ]
  }
}
```

### Confirmar Cita

```http
POST /api/appointments/:id/confirm
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "CONFIRMADA",
    "fecha_confirmacion": "2026-03-18T15:30:00Z"
  }
}
```

### Cancelar Cita

```http
POST /api/appointments/:id/cancel
Authorization: Bearer {token}
Content-Type: application/json

{
  "motivo_cancelacion": "El paciente no podrá asistir"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "CANCELADA",
    "fecha_cancelacion": "2026-03-18T16:00:00Z"
  }
}
```

### Reprogramar Cita

```http
POST /api/appointments/:id/reschedule
Authorization: Bearer {token}
Content-Type: application/json

{
  "nueva_fecha_hora": "2026-03-22T11:00:00Z",
  "motivo": "Solicitud del paciente"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "estado": "REPROGRAMADA",
    "nueva_fecha_hora": "2026-03-22T11:00:00Z"
  }
}
```

---

## Servicio de Citas

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

      const insertQuery = `
                INSERT INTO CITAS (
                    numero_cita, id_paciente, medico_id, fecha_hora, 
                    duracion_minutos, tipo_cita, motivo, estado, creado_por
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROGRAMADA', $8)
                RETURNING *
            `;

      const numeroCita = await this.generateAppointmentNumber();
      const values = [numeroCita, appointmentData.id_paciente, appointmentData.medico_id, appointmentData.fecha_hora, appointmentData.duracion_minutos || 30, appointmentData.tipo_cita, appointmentData.motivo, userId];

      const result = await client.query(insertQuery, values);

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
            SELECT id, numero_cita, fecha_hora, duracion_minutos
            FROM CITAS
            WHERE medico_id = $1
            AND activo = TRUE
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            AND ($2 BETWEEN fecha_hora AND fecha_hora + INTERVAL '1 minute' * duracion_minutos
                OR $2 + INTERVAL '1 minute' * $3 BETWEEN fecha_hora AND fecha_hora + INTERVAL '1 minute' * duracion_minutos
                OR fecha_hora BETWEEN $2 AND $2 + INTERVAL '1 minute' * $3)
        `;

    const { rows } = await pool.query(query, [doctorId, dateTime, duration]);

    return {
      hasConflicts: rows.length > 0,
      conflicts: rows,
    };
  }

  async getDoctorAvailability(doctorId, date, duration = 30) {
    const workingHours = {
      start: '08:00',
      end: '18:00',
      lunchStart: '13:00',
      lunchEnd: '14:00',
    };

    // Obtener citas existentes
    const query = `
            SELECT fecha_hora, duracion_minutos
            FROM CITAS
            WHERE medico_id = $1
            AND DATE(fecha_hora) = $2
            AND activo = TRUE
            AND estado NOT IN ('CANCELADA', 'NO_ASISTIO')
            ORDER BY fecha_hora
        `;

    const { rows } = await pool.query(query, [doctorId, date]);

    // Generar slots disponibles
    const slots = this.generateAvailableSlots(date, workingHours, rows, duration);

    return {
      success: true,
      data: {
        date,
        doctor_id: doctorId,
        working_hours: workingHours,
        available_slots: slots.available,
        booked_slots: rows,
      },
    };
  }

  generateAvailableSlots(date, workingHours, existingAppointments, duration) {
    const available = [];
    const booked = existingAppointments.map(apt => ({
      start: new Date(apt.fecha_hora),
      end: new Date(apt.fecha_hora.getTime() + apt.duracion_minutos * 60000),
    }));

    // Generar slots cada duración minutos
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const lunchStartHour = parseInt(workingHours.lunchStart.split(':')[0]);
    const lunchEndHour = parseInt(workingHours.lunchEnd.split(':')[0]);

    for (let hour = startHour; hour < endHour; hour++) {
      // Saltar hora de almuerzo
      if (hour >= lunchStartHour && hour < lunchEndHour) continue;

      for (let min = 0; min < 60; min += duration) {
        const slotTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

        // Verificar si está disponible
        const slotStart = new Date(`${date}T${slotTime}:00`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        const isBooked = booked.some(b => (slotStart >= b.start && slotStart < b.end) || (slotEnd > b.start && slotEnd <= b.end));

        if (!isBooked) {
          available.push(slotTime);
        }
      }
    }

    return { available, booked };
  }

  validateAppointmentData(data) {
    const errors = [];

    if (!data.id_paciente) {
      errors.push('El paciente es requerido');
    }
    if (!data.medico_id) {
      errors.push('El médico es requerido');
    }
    if (!data.fecha_hora) {
      errors.push('La fecha y hora son requeridas');
    }
    if (!data.tipo_cita) {
      errors.push('El tipo de cita es requerido');
    }
    if (!data.motivo) {
      errors.push('El motivo es requerido');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async cancelAppointment(appointmentId, reason, userId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = `
                UPDATE CITAS 
                SET estado = 'CANCELADA', 
                    motivo_cancelacion = $1,
                    fecha_cancelacion = CURRENT_TIMESTAMP,
                    modificado_por = $2
                WHERE id = $3 AND activo = TRUE
                RETURNING *
            `;

      const result = await client.query(updateQuery, [reason, userId, appointmentId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Cita no encontrada' };
      }

      await client.query('COMMIT');
      return { success: true, data: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rescheduleAppointment(appointmentId, newDateTime, reason, userId = null) {
    // Verificar conflictos con nueva fecha
    const conflicts = await this.checkSchedulingConflicts(appointmentId.medico_id, newDateTime, appointmentId.duracion_minutos);

    if (conflicts.hasConflicts) {
      return { success: false, errors: conflicts.conflicts };
    }

    // Actualizar cita
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = `
                UPDATE CITAS 
                SET estado = 'REPROGRAMADA',
                    fecha_hora = $1,
                    observaciones = COALESCE(observaciones, '') || $2,
                    modificado_por = $3
                WHERE id = $4 AND activo = TRUE
                RETURNING *
            `;

      const result = await client.query(updateQuery, [newDateTime, `\nReprogramado: ${reason}`, userId, appointmentId]);

      await client.query('COMMIT');
      return { success: true, data: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new AppointmentService();
```

---

## Validación de Conflictos

```sql
-- Función para validar conflictos de citas
CREATE OR REPLACE FUNCTION validar_conflicto_citas()
RETURNS TRIGGER AS $$
DECLARE
    conflictos INTEGER;
BEGIN
    -- Verificar conflictos con otras citas del mismo médico
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
        RAISE EXCEPTION 'Conflicto de horario: El médico ya tiene una cita programada en ese horario';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar conflictos
CREATE TRIGGER tr_validar_conflicto_citas
    BEFORE INSERT OR UPDATE ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION validar_conflicto_citas();
```

---

## Generación de Número de Cita

```sql
-- Función para generar número de cita
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

-- Trigger para generar número de cita
CREATE TRIGGER tr_generar_numero_cita
    BEFORE INSERT ON CITAS
    FOR EACH ROW
    EXECUTE FUNCTION generar_numero_cita();
```

---

## Vistas Útiles

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

### Vista de Disponibilidad de Médicos

```sql
CREATE OR REPLACE VIEW v_disponibilidad_medicos AS
SELECT
    u.id as medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    u.especialidad,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.duracion_cita_minutos,
    h.activo as horario_activo,
    h.fecha_inicio_vigencia,
    h.fecha_fin_vigencia
FROM USUARIOS u
JOIN HORARIOS_MEDICOS h ON u.id = h.medico_id
WHERE u.activo = TRUE AND h.activo = TRUE
  AND (h.fecha_fin_vigencia IS NULL OR h.fecha_fin_vigencia >= CURRENT_DATE);
```

### Vista de Agenda Médica

```sql
CREATE OR REPLACE VIEW v_agenda_medicos AS
SELECT
    c.medico_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_medico,
    DATE(c.fecha_hora) as fecha,
    c.id as cita_id,
    c.numero_cita,
    c.fecha_hora,
    c.duracion_minutos,
    c.tipo_cita,
    c.estado,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.telefono as telefono_paciente,
    c.motivo,
    c.sala_consulta
FROM CITAS c
JOIN USUARIOS u ON c.medico_id = u.id
JOIN PACIENTES p ON c.id_paciente = p.id
WHERE c.activo = TRUE
  AND c.estado NOT IN ('CANCELADA', 'NO_ASISTIO')
  AND DATE(c.fecha_hora) >= CURRENT_DATE
ORDER BY c.medico_id, c.fecha_hora;
```

---

## Índices

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
CREATE INDEX idx_citas_fecha_creacion ON CITAS(fecha_creacion);

CREATE INDEX idx_horarios_medico ON HORARIOS_MEDICOS(medico_id);
CREATE INDEX idx_horarios_dia ON HORARIOS_MEDICOS(dia_semana);
CREATE INDEX idx_horarios_vigencia ON HORARIOS_MEDICOS(fecha_inicio_vigencia, fecha_fin_vigencia);
CREATE INDEX idx_horarios_activo ON HORARIOS_MEDICOS(activo);

CREATE INDEX idx_excepciones_medico ON EXCEPCIONES_HORARIO(medico_id);
CREATE INDEX idx_excepciones_fecha ON EXCEPCIONES_HORARIO(fecha);
CREATE INDEX idx_excepciones_tipo ON EXCEPCIONES_HORARIO(tipo_excepcion);
```

---

## Relaciones

```
PACIENTES ────< CITAS >───< USUARIOS (médicos)
    │              │
    │              └───< HISTORIAL_CLINICO
    │
    └───< DOCUMENTOS

USUARIOS ────< HORARIOS_MEDICOS
     │
     └───< EXCEPCIONES_HORARIO
```

---

## Notas de Implementación

1. **Conflictos**: Se validan automáticamente antes de crear o actualizar citas
2. **Número de Cita**: Se genera automáticamente con formato `CITA-YYYYMMDD-XXXXXX`
3. **Soft Delete**: Las citas canceladas no se eliminan, cambian de estado
4. **Horarios**: Los médicos pueden tener horarios diferentes por día de la semana
5. **Excepciones**: Se pueden registrar excepciones para vacaciones, días libres, etc.
6. **Duración**: La duración por defecto es 30 minutos, configurable por tipo de cita
