# Módulo de Documentos

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de documentos gestiona el almacenamiento y organización de archivos médicos, incluyendo imágenes, PDFs y archivos DICOM, con integración a Google Cloud Storage.

---

## Esquema de Base de Datos

### Tabla DOCUMENTOS

```sql
CREATE TABLE IF NOT EXISTS DOCUMENTOS (
    id BIGSERIAL PRIMARY KEY,

    -- Información básica del documento
    nombre_archivo VARCHAR(255) NOT NULL,
    nombre_interno VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(25) NOT NULL CHECK (tipo_documento IN (
        'HISTORIA_CLINICA', 'RECETA_MEDICA', 'ORDEN_EXAMENES', 'RESULTADO_LABORATORIO',
        'IMAGEN_RADIOLOGICA', 'CONSENTIMIENTO', 'FACTURA', 'SEGURO',
        'IDENTIFICACION', 'REFERENCIA', 'INFORME_MEDICO', 'OTRO'
    )),

    -- Clasificación y categorización
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

    -- Almacenamiento en Cloud Storage
    ruta_storage VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    url_publica VARCHAR(500),
    fecha_expiracion_url TIMESTAMP NULL,

    -- Metadatos del documento
    fecha_documento DATE,
    autor_documento VARCHAR(100),
    institucion_origen VARCHAR(100),
    numero_documento VARCHAR(50),

    -- Seguridad y acceso
    nivel_confidencialidad VARCHAR(15) DEFAULT 'CONFIDENCIAL' CHECK (nivel_confidencialidad IN (
        'PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO'
    )),
    cifrado BOOLEAN DEFAULT TRUE,
    clave_cifrado VARCHAR(255),
    requiere_autorizacion BOOLEAN DEFAULT TRUE,

    -- Control de versiones
    version INTEGER DEFAULT 1,
    documento_padre_id BIGINT NULL,
    es_version_actual BOOLEAN DEFAULT TRUE,

    -- Estado y procesamiento
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

    -- Soft delete y auditoría
    activo BOOLEAN DEFAULT TRUE,
    fecha_eliminacion TIMESTAMP NULL,
    motivo_eliminacion TEXT,

    -- Campos de auditoría
    subido_por INTEGER NOT NULL,
    modificado_por INTEGER,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Tipos de Documentos

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
| REFERENCIA            | Cartas de referencia          | CONFIDENCIAL              |
| INFORME_MEDICO        | Informes médicos              | CONFIDENCIAL              |
| OTRO                  | Otros documentos              | CONFIDENCIAL              |

---

## Niveles de Confidencialidad

| Nivel        | Descripción          | Acceso                    |
| ------------ | -------------------- | ------------------------- |
| PUBLICO      | Documento público    | Todos los usuarios        |
| INTERNO      | Uso interno          | Usuarios autenticados     |
| CONFIDENCIAL | Información sensible | Usuarios con permiso      |
| RESTRINGIDO  | Alta sensibilidad    | Solo usuarios autorizados |

---

## Estados de Procesamiento

| Estado     | Descripción                               |
| ---------- | ----------------------------------------- |
| SUBIENDO   | El archivo se está subiendo               |
| PROCESANDO | El archivo se está procesando (OCR, etc.) |
| DISPONIBLE | El archivo está disponible para descarga  |
| ERROR      | Error en el procesamiento                 |
| ARCHIVADO  | El archivo ha sido archivado              |

---

## Endpoints de la API

### Subir Documento

```http
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [archivo]
id_paciente: 1
tipo_documento: RESULTADO_LABORATORIO
descripcion: Resultados de hemograma completo
categoria: Laboratorio
subcategoria: Hematología

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "nombre_archivo": "hemograma_20260320.pdf",
    "nombre_interno": "doc_abc123.pdf",
    "tipo_documento": "RESULTADO_LABORATORIO",
    "estado_procesamiento": "PROCESANDO",
    "tamaño_bytes": 245760,
    "mime_type": "application/pdf",
    "url_publica": "https://storage.googleapis.com/..."
  }
}
```

### Listar Documentos

```http
GET /api/documents?patient_id=1&type=RESULTADO_LABORATORIO&page=1&limit=10
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": 1,
        "nombre_archivo": "hemograma_20260320.pdf",
        "tipo_documento": "RESULTADO_LABORATORIO",
        "categoria": "Laboratorio",
        "subcategoria": "Hematología",
        "fecha_documento": "2026-03-20",
        "tamaño_bytes": 245760,
        "estado_procesamiento": "DISPONIBLE",
        "subido_por": "Dr. Joel Sánchez",
        "total_descargas": 5
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

### Obtener Documento

```http
GET /api/documents/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "nombre_archivo": "hemograma_20260320.pdf",
    "tipo_documento": "RESULTADO_LABORATORIO",
    "categoria": "Laboratorio",
    "subcategoria": "Hematología",
    "descripcion": "Resultados de hemograma completo",
    "id_paciente": 1,
    "extension": "pdf",
    "tamaño_bytes": 245760,
    "mime_type": "application/pdf",
    "url_publica": "https://storage.googleapis.com/...",
    "fecha_documento": "2026-03-20",
    "autor_documento": "Laboratorio Clínico ABC",
    "nivel_confidencialidad": "CONFIDENCIAL",
    "version": 1,
    "estado_procesamiento": "DISPONIBLE",
    "ocr_procesado": true,
    "texto_extraido": "Hemograma completo...",
    "total_descargas": 5,
    "ultima_descarga": "2026-03-21T10:00:00Z"
  }
}
```

### Descargar Documento

```http
GET /api/documents/:id/download
Authorization: Bearer {token}

Response 200:
Content-Type: application/pdf
Content-Disposition: attachment; filename="hemograma_20260320.pdf"

[binary data]
```

### Actualizar Documento

```http
PUT /api/documents/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "descripcion": "Resultados de hemograma completo - actualizado",
  "categoria": "Laboratorio",
  "subcategoria": "Hematología",
  "palabras_clave": ["hemograma", "sangre", "laboratorio"]
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "descripcion": "Resultados de hemograma completo - actualizado"
  }
}
```

### Eliminar Documento (Soft Delete)

```http
DELETE /api/documents/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "motivo_eliminacion": "Documento duplicado"
}

Response 200:
{
  "success": true,
  "message": "Documento eliminado correctamente"
}
```

### Buscar Documentos

```http
GET /api/documents/search?q=hemograma&patient_id=1
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 1,
        "nombre_archivo": "hemograma_20260320.pdf",
        "tipo_documento": "RESULTADO_LABORATORIO",
        "descripcion": "Resultados de hemograma completo",
        "relevance": 0.95
      }
    ],
    "total": 1
  }
}
```

---

## Almacenamiento en Google Cloud Storage

### Estructura de Buckets

```
bucket-name/
├── pacientes/
│   └── {patient_id}/
│       ├── documentos/
│       │   └── {document_id}.{extension}
│       └── imagenes/
│           └── {document_id}.{extension}
├── temp/
│   └── uploads/
│       └── {temp_id}.{extension}
└── archived/
    └── {patient_id}/
        └── {document_id}_v{version}.{extension}
```

### Configuración de Storage

```javascript
// Configuración de Google Cloud Storage
const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Subir archivo
async function uploadDocument(file, patientId, documentId) {
  const fileName = `pacientes/${patientId}/documentos/${documentId}${path.extname(file.originalname)}`;

  const blob = bucket.file(fileName);
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: file.mimetype,
      metadata: {
        patientId: patientId.toString(),
        documentId: documentId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', reject);
    blobStream.on('finish', () => {
      resolve({
        fileName,
        url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
      });
    });
    blobStream.end(file.buffer);
  });
}

// Generar URL firmada
async function generateSignedUrl(fileName, expirationMinutes = 60) {
  const [url] = await bucket.file(fileName).getSignedUrl({
    action: 'read',
    expires: Date.now() + expirationMinutes * 60 * 1000,
  });

  return url;
}
```

---

## Procesamiento OCR

```javascript
// Servicio de OCR para documentos
async function processDocumentOCR(documentId) {
  const document = await getDocument(documentId);

  if (!document.ocr_procesado) {
    // Descargar archivo de Cloud Storage
    const fileContent = await downloadDocument(document.ruta_storage);

    // Procesar con OCR
    const extractedText = await extractText(fileContent);

    // Actualizar documento
    await pool.query(
      `
      UPDATE DOCUMENTOS 
      SET ocr_procesado = TRUE,
          texto_extraido = $1,
          estado_procesamiento = 'DISPONIBLE'
      WHERE id = $2
    `,
      [extractedText, documentId]
    );

    return extractedText;
  }

  return document.texto_extraido;
}
```

---

## Control de Versiones

```javascript
// Crear nueva versión de documento
async function createDocumentVersion(documentId, newFile) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener documento actual
    const {
      rows: [currentDoc],
    } = await client.query('SELECT * FROM DOCUMENTOS WHERE id = $1 AND activo = TRUE', [documentId]);

    if (!currentDoc) {
      throw new Error('Documento no encontrado');
    }

    // Marcar versión actual como no actual
    await client.query('UPDATE DOCUMENTOS SET es_version_actual = FALSE WHERE id = $1', [documentId]);

    // Crear nueva versión
    const newVersion = currentDoc.version + 1;
    const newDocumentId = await uploadNewVersion(newFile, currentDoc, newVersion);

    // Crear registro de nueva versión
    const {
      rows: [newDoc],
    } = await client.query(
      `
      INSERT INTO DOCUMENTOS (
        nombre_archivo, nombre_interno, tipo_documento, categoria,
        subcategoria, descripcion, id_paciente, historial_clinico_id,
        cita_id, extension, tamaño_bytes, mime_type, hash_archivo,
        ruta_storage, bucket_name, version, documento_padre_id,
        es_version_actual, subido_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18)
      RETURNING *
    `,
      [currentDoc.nombre_archivo, generateInternalName(), currentDoc.tipo_documento, currentDoc.categoria, currentDoc.subcategoria, currentDoc.descripcion, currentDoc.id_paciente, currentDoc.historial_clinico_id, currentDoc.cita_id, path.extname(newFile.originalname), newFile.size, newFile.mimetype, calculateHash(newFile.buffer), newFile.storagePath, process.env.GCS_BUCKET_NAME, newVersion, documentId, currentDoc.subido_por]
    );

    await client.query('COMMIT');
    return newDoc;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Vistas Útiles

### Vista de Documentos de Paciente

```sql
CREATE OR REPLACE VIEW v_documentos_pacientes AS
SELECT
    d.id,
    d.nombre_archivo,
    d.tipo_documento,
    d.categoria,
    d.subcategoria,
    d.descripcion,
    CONCAT(p.nombre, ' ', p.apellido) as nombre_paciente,
    p.numero_expediente,
    d.fecha_documento,
    d.fecha_subida,
    d.tamaño_bytes,
    d.estado_procesamiento,
    CONCAT(u.nombres, ' ', u.apellidos) as subido_por_nombre,
    d.total_descargas,
    d.activo
FROM DOCUMENTOS d
JOIN PACIENTES p ON d.id_paciente = p.id
JOIN USUARIOS u ON d.subido_por = u.id
WHERE d.activo = TRUE AND p.activo = TRUE;
```

### Vista de Versiones de Documento

```sql
CREATE OR REPLACE VIEW v_documento_versiones AS
SELECT
    d.id,
    d.nombre_archivo,
    d.version,
    d.es_version_actual,
    d.fecha_subida,
    CONCAT(u.nombres, ' ', u.apellidos) as subido_por,
    d.documento_padre_id
FROM DOCUMENTOS d
JOIN USUARIOS u ON d.subido_por = u.id
WHERE d.activo = TRUE
ORDER BY d.documento_padre_id, d.version DESC;
```

---

## Índices

```sql
CREATE INDEX idx_documentos_paciente ON DOCUMENTOS(id_paciente);
CREATE INDEX idx_documentos_tipo ON DOCUMENTOS(tipo_documento);
CREATE INDEX idx_documentos_categoria ON DOCUMENTOS(categoria);
CREATE INDEX idx_documentos_historial ON DOCUMENTOS(historial_clinico_id);
CREATE INDEX idx_documentos_cita ON DOCUMENTOS(cita_id);
CREATE INDEX idx_documentos_fecha_documento ON DOCUMENTOS(fecha_documento);
CREATE INDEX idx_documentos_fecha_subida ON DOCUMENTOS(fecha_subida);
CREATE INDEX idx_documentos_estado ON DOCUMENTOS(estado_procesamiento);
CREATE INDEX idx_documentos_activo ON DOCUMENTOS(activo);
CREATE INDEX idx_documentos_hash ON DOCUMENTOS(hash_archivo);
CREATE INDEX idx_documentos_nombre ON DOCUMENTOS(nombre_archivo);
CREATE INDEX idx_documentos_subido_por ON DOCUMENTOS(subido_por);
CREATE INDEX idx_documentos_version ON DOCUMENTOS(documento_padre_id, version);
```

---

## Claves Foráneas

```sql
ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_paciente
FOREIGN KEY (id_paciente) REFERENCES PACIENTES(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_historial
FOREIGN KEY (historial_clinico_id) REFERENCES HISTORIAL_CLINICO(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_cita
FOREIGN KEY (cita_id) REFERENCES CITAS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_padre
FOREIGN KEY (documento_padre_id) REFERENCES DOCUMENTOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_subido_por
FOREIGN KEY (subido_por) REFERENCES USUARIOS(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_modificado_por
FOREIGN KEY (modificado_por) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE DOCUMENTOS
ADD CONSTRAINT fk_documentos_ultimo_acceso
FOREIGN KEY (ultimo_acceso_usuario) REFERENCES USUARIOS(id) ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Relaciones

```
PACIENTES ────< DOCUMENTOS
     │
     └───< HISTORIAL_CLINICO >───< DOCUMENTOS
     │                              │
     └───< CITAS >─────────────────┘

DOCUMENTOS >───< DOCUMENTOS (versiones)
```

---

## Notas de Implementación

1. **Almacenamiento**: Los archivos se almacenan en Google Cloud Storage
2. **URLs Firmadas**: Las URLs de descarga son temporales (1 hora por defecto)
3. **Hash**: Se calcula hash SHA-256 para integridad
4. **Versiones**: Cada documento puede tener múltiples versiones
5. **OCR**: Procesamiento automático de OCR para documentos de texto
6. **Soft Delete**: Los documentos no se eliminan físicamente
7. **Confidencialidad**: Control de acceso basado en nivel de confidencialidad
8. **Auditoría**: Registro de todas las descargas y accesos
