# Módulo de Historial Clínico

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de historial clínico gestiona los registros médicos de las consultas de pacientes, incluyendo signos vitales, diagnósticos CIE-10, tratamientos y seguimiento médico.

---

## Esquema de Base de Datos

### Tabla HISTORIAL_CLINICO

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

    -- Estado y seguimiento
    estado_consulta VARCHAR(15) DEFAULT 'COMPLETADA' CHECK (estado_consulta IN (
        'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'
    )),
    requiere_seguimiento BOOLEAN DEFAULT FALSE,
    urgente BOOLEAN DEFAULT FALSE,

    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,

    -- Campos de auditoría
    creado_por INTEGER,
    modificado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Tipos de Consulta

| Tipo            | Descripción                   |
| --------------- | ----------------------------- |
| PRIMERA_VEZ     | Primera consulta del paciente |
| SEGUIMIENTO     | Consulta de seguimiento       |
| URGENCIA        | Consulta de urgencia          |
| CONTROL         | Consulta de control rutinario |
| CIRUGIA         | Procedimiento quirúrgico      |
| POST_OPERATORIO | Control post-operatorio       |

---

## Estructura de Signos Vitales (JSONB)

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
  },
  "glucosa": {
    "valor": 95,
    "unidad": "mg/dL"
  },
  "peso": {
    "valor": 75.5,
    "unidad": "kg"
  },
  "altura": {
    "valor": 175,
    "unidad": "cm"
  }
}
```

---

## Estructura de Medicamentos Prescritos (JSONB)

```json
{
  "medicamentos": [
    {
      "nombre": "Paracetamol",
      "principio_activo": "Acetaminofén",
      "dosis": "500mg",
      "frecuencia": "Cada 8 horas",
      "via_administracion": "Oral",
      "duracion": "7 días",
      "instrucciones": "Tomar con alimentos",
      "cantidad": 21,
      "unidad": "tabletas"
    },
    {
      "nombre": "Ibuprofeno",
      "principio_activo": "Ibuprofeno",
      "dosis": "400mg",
      "frecuencia": "Cada 12 horas",
      "via_administracion": "Oral",
      "duracion": "5 días",
      "instrucciones": "Tomar después de alimentos",
      "cantidad": 10,
      "unidad": "tabletas"
    }
  ]
}
```

---

## Estructura de Archivos Adjuntos (JSONB)

```json
{
  "imagenes": [
    {
      "id": "img_001",
      "nombre": "radiografia_torax.jpg",
      "tipo": "image/jpeg",
      "url": "/storage/pacientes/1/imagenes/img_001.jpg",
      "fecha": "2026-03-20T10:30:00Z",
      "descripcion": "Radiografía de tórax PA"
    }
  ],
  "documentos": [
    {
      "id": "doc_001",
      "nombre": "laboratorio_sangre.pdf",
      "tipo": "application/pdf",
      "url": "/storage/pacientes/1/documentos/doc_001.pdf",
      "fecha": "2026-03-20T10:35:00Z",
      "descripcion": "Resultados de laboratorio"
    }
  ]
}
```

---

## Endpoints de la API

### Listar Historial Clínico

```http
GET /api/clinical-history?patient_id=1&page=1&limit=10
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "fecha_hora": "2026-03-20T10:00:00Z",
        "tipo_consulta": "CONSULTA_GENERAL",
        "motivo_consulta": "Dolor de cabeza persistente",
        "diagnostico_principal": "Cefalea tensional",
        "codigo_cie10": "G44.2",
        "medico": {
          "id": 2,
          "nombre": "Dr. Joel Sánchez",
          "especialidad": "Medicina General"
        },
        "estado_consulta": "COMPLETADA",
        "requiere_seguimiento": true
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

### Obtener Registro por ID

```http
GET /api/clinical-history/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "id_paciente": 1,
    "fecha_hora": "2026-03-20T10:00:00Z",
    "tipo_consulta": "CONSULTA_GENERAL",
    "motivo_consulta": "Dolor de cabeza persistente",
    "signos_vitales": {
      "presion_arterial": { "sistolica": 120, "diastolica": 80 },
      "frecuencia_cardiaca": { "valor": 72 },
      "temperatura": { "valor": 36.5 }
    },
    "peso": 75.5,
    "altura": 175,
    "imc": 24.65,
    "sintomas": "Dolor de cabeza frontal, sensación de presión",
    "examen_fisico": "Paciente consciente, orientado...",
    "diagnostico_principal": "Cefalea tensional",
    "diagnosticos_secundarios": null,
    "codigo_cie10": "G44.2",
    "plan_tratamiento": "Reposo, hidratación, analgésicos",
    "medicamentos_prescritos": {
      "medicamentos": [
        {
          "nombre": "Paracetamol",
          "dosis": "500mg",
          "frecuencia": "Cada 8 horas",
          "duracion": "7 días"
        }
      ]
    },
    "recomendaciones": "Evitar estrés, mantener hidratación",
    "proxima_cita": "2026-03-27",
    "medico": {
      "id": 2,
      "nombre": "Dr. Joel Sánchez",
      "especialidad": "Medicina General"
    },
    "imagenes_adjuntas": [],
    "documentos_adjuntos": [],
    "estado_consulta": "COMPLETADA",
    "requiere_seguimiento": true,
    "urgente": false
  }
}
```

### Crear Registro de Historial

```http
POST /api/clinical-history
Authorization: Bearer {token}
Content-Type: application/json

{
  "id_paciente": 1,
  "tipo_consulta": "CONSULTA_GENERAL",
  "motivo_consulta": "Dolor de cabeza persistente",
  "signos_vitales": {
    "presion_arterial": { "sistolica": 120, "diastolica": 80 },
    "frecuencia_cardiaca": { "valor": 72 },
    "temperatura": { "valor": 36.5 }
  },
  "peso": 75.5,
  "altura": 175,
  "sintomas": "Dolor de cabeza frontal, sensación de presión",
  "examen_fisico": "Paciente consciente, orientado...",
  "diagnostico_principal": "Cefalea tensional",
  "codigo_cie10": "G44.2",
  "plan_tratamiento": "Reposo, hidratación, analgésicos",
  "medicamentos_prescritos": {
    "medicamentos": [
      {
        "nombre": "Paracetamol",
        "dosis": "500mg",
        "frecuencia": "Cada 8 horas",
        "duracion": "7 días"
      }
    ]
  },
  "recomendaciones": "Evitar estrés, mantener hidratación",
  "proxima_cita": "2026-03-27",
  "requiere_seguimiento": true
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "fecha_hora": "2026-03-20T10:00:00Z",
    "imc": 24.65
  }
}
```

### Buscar por Código CIE-10

```http
GET /api/clinical-history/search/cie10?code=G44
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "paciente": "Juan Pérez",
        "fecha_hora": "2026-03-20T10:00:00Z",
        "diagnostico": "Cefalea tensional",
        "codigo_cie10": "G44.2"
      }
    ],
    "total": 5
  }
}
```

---

## Trigger para Cálculo de IMC

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

---

## Trigger para Actualizar Fechas de Consulta en Pacientes

```sql
CREATE OR REPLACE FUNCTION actualizar_fechas_consulta_paciente()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar fecha_primera_consulta si es NULL
    UPDATE PACIENTES
    SET fecha_primera_consulta = NEW.fecha_hora
    WHERE id = NEW.id_paciente
    AND fecha_primera_consulta IS NULL;

    -- Actualizar fecha_ultima_consulta
    UPDATE PACIENTES
    SET fecha_ultima_consulta = NEW.fecha_hora
    WHERE id = NEW.id_paciente
    AND (fecha_ultima_consulta IS NULL OR fecha_ultima_consulta < NEW.fecha_hora);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_actualizar_fechas_consulta
    AFTER INSERT ON HISTORIAL_CLINICO
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fechas_consulta_paciente();
```

---

## Vistas Útiles

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

### Vista de Consultas por Paciente

```sql
CREATE OR REPLACE VIEW v_consultas_paciente AS
SELECT
    h.id,
    h.id_paciente,
    h.fecha_hora,
    h.tipo_consulta,
    h.motivo_consulta,
    h.diagnostico_principal,
    h.codigo_cie10,
    CONCAT(u.nombres, ' ', u.apellidos) as medico,
    h.estado_consulta,
    h.proxima_cita
FROM HISTORIAL_CLINICO h
JOIN USUARIOS u ON h.medico_id = u.id
WHERE h.activo = TRUE
ORDER BY h.fecha_hora DESC;
```

### Vista de Estadísticas de Paciente

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

## Índices

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
CREATE INDEX idx_historial_cie10 ON HISTORIAL_CLINICO(codigo_cie10);
```

---

## Claves Foráneas

```sql
ALTER TABLE HISTORIAL_CLINICO
ADD CONSTRAINT fk_historial_paciente
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO
ADD CONSTRAINT fk_historial_medico
FOREIGN KEY (medico_id) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO
ADD CONSTRAINT fk_historial_creado_por
FOREIGN KEY (creado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE HISTORIAL_CLINICO
ADD CONSTRAINT fk_historial_modificado_por
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Códigos CIE-10 Comunes

| Código | Descripción                            |
| ------ | -------------------------------------- |
| G44.2  | Cefalea tensional                      |
| J06.9  | Infección respiratoria aguda           |
| K21    | Enfermedad por reflujo gastroesofágico |
| E11    | Diabetes mellitus tipo 2               |
| I10    | Hipertensión esencial                  |
| M54.5  | Lumbago no especificado                |
| R51    | Dolor de cabeza                        |
| J18.9  | Neumonía no especificada               |
| N39.0  | Infección del tracto urinario          |
| A09    | Diarrea y gastroenteritis              |

---

## Relaciones

```
PACIENTES ────< HISTORIAL_CLINICO >───< USUARIOS (médicos)
                   │
                   ├───< DOCUMENTOS
                   │
                   └───< CITAS
```

---

## Notas de Implementación

1. **IMC Automático**: Se calcula automáticamente a partir del peso y altura
2. **Fechas de Consulta**: Se actualizan automáticamente en la tabla PACIENTES
3. **Soft Delete**: Los registros no se eliminan físicamente, se marca `activo = FALSE`
4. **Auditoría**: Todos los cambios quedan registrados en `LOGS_AUDITORIA`
5. **CIE-10**: Los códigos CIE-10 permiten clasificar diagnósticos de manera estandarizada
6. **Archivos Adjuntos**: Se almacenan como JSONB con referencias a documentos en Cloud Storage
