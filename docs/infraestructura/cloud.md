# Infraestructura Cloud

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

La infraestructura de EcoDigital está diseñada para desplegarse en Google Cloud Platform utilizando Cloud Run para el servidor de aplicaciones, con servicios gestionados para base de datos, almacenamiento y caché.

---

## Arquitectura General

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
│                     GOOGLE CLOUD PLATFORM                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    CLOUD RUN                                  ││
│  │  ┌─────────────────────────────────────────────────────────┐ ││
│  │  │              API SERVER (Express.js)                      │ ││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │ ││
│  │  │  │ Rate Limiter│  │    CORS     │  │   Health Check   │  │ ││
│  │  │  └─────────────┘  └─────────────┘  └──────────────────┘  │ ││
│  │  │  ┌─────────────────────────────────────────────────────┐ │ ││
│  │  │  │                    MIDDLEWARE                        │ │ ││
│  │  │  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │ │ ││
│  │  │  │  │ Auth (JWT)   │  │ RBAC         │  │ Audit Log  │  │ │ ││
│  │  │  │  └──────────────┘  └──────────────┘  └────────────┘  │ │ ││
│  │  │  └─────────────────────────────────────────────────────┘ │ ││
│  │  └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                           │                               │  │
│  │  ┌─────────────────┐  ┌───┴───┐  ┌────────────────────┐  │  │
│  │  │   CLOUD SQL     │  │REDIS  │  │   CLOUD STORAGE    │  │  │
│  │  │   PostgreSQL    │  │Memory │  │   (Documentos)     │  │  │
│  │  │      16         │  │ Store │  │                    │  │  │
│  │  └─────────────────┘  └───────┘  └────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─────────────────┐  ┌────────────────────────────┐  │  │
│  │  │ SECRET MANAGER  │  │      VERTEX AI            │  │  │
│  │  │  (Keys/Secrets) │  │   (Gemini 2.0 Flash)       │  │  │
│  │  └─────────────────┘  └────────────────────────────┘  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes de GCP

### Cloud Run

| Componente        | Descripción                       |
| ----------------- | --------------------------------- |
| **Servicio**      | Contenedor Node.js con Express.js |
| **Puerto**        | 3010 (inyectado por Cloud Run)    |
| **Memoria**       | 512MB - 2GB configurable          |
| **CPU**           | 1-4 vCPUs configurable            |
| **Concurrencia**  | 80 requests por contenedor        |
| **Min Instances** | 0 (scale to zero)                 |
| **Max Instances** | 100                               |

### Cloud SQL (PostgreSQL)

| Componente            | Descripción                        |
| --------------------- | ---------------------------------- |
| **Versión**           | PostgreSQL 16                      |
| **Tier**              | db-custom-2-8192 (2 vCPU, 8GB RAM) |
| **Storage**           | 100GB SSD                          |
| **Backup**            | Automático diario                  |
| **High Availability** | Configurable                       |
| **Connection Pool**   | PgBouncer recomendado              |

### Memorystore (Redis)

| Componente    | Descripción                    |
| ------------- | ------------------------------ |
| **Tier**      | Basic o Standard               |
| **Capacidad** | 1-5 GB                         |
| **Uso**       | Sesiones, caché, rate limiting |

### Cloud Storage

| Componente        | Descripción                       |
| ----------------- | --------------------------------- |
| **Bucket**        | Documentos médicos                |
| **Storage Class** | Standard                          |
| **Retention**     | Configurable por política         |
| **Encryption**    | Google-managed o Customer-managed |

### Secret Manager

| Secreto            | Descripción                     |
| ------------------ | ------------------------------- |
| `DATABASE_URL`     | URL de conexión a PostgreSQL    |
| `JWT_SECRET`       | Secreto para JWT                |
| `PRIVATE_KEY`      | Llave privada para encriptación |
| `GOOGLE_CLOUD_KEY` | Credenciales de servicio        |

---

## Variables de Entorno

### Variables Mínimas

```bash
# Configuración básica
NODE_ENV=production
DEPLOYMENT_TYPE=selfhosted
DEPLOYMENT_PLATFORM=gcp
PORT=3010
```

### Base de Datos (PostgreSQL)

```bash
# Conexión directa
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME

# Con Cloud SQL Connector
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DBNAME
# Requiere: --add-cloudsql-instances en el deploy
```

### Redis

```bash
# Memorystore
REDIS_SERVER_HOST=10.x.x.x
REDIS_SERVER_PORT=6379
```

### URL Externa

```bash
# Para links, callbacks OAuth y CORS
AFFINE_SERVER_EXTERNAL_URL=https://TU_DOMINIO
```

### Almacenamiento y Config

```bash
# El servidor usa por defecto ~/.affine/
# En Cloud Run NO hay disco persistente

# Opción 1: Montar config desde Secret Manager
# Opción 2: Usar Storage remoto para blobs
```

### Llave Privada (Self-host)

```bash
# Generada por packages/backend/server/scripts/self-host-predeploy.js
# Guardar como Secret Manager y montar en:
# /root/.affine/config/private.key
```

---

## Rutas del Servidor

| Ruta         | Descripción                 |
| ------------ | --------------------------- |
| `/`          | Aplicación web principal    |
| `/api/*`     | API REST                    |
| `/graphql`   | Endpoint GraphQL            |
| `/socket.io` | WebSockets para tiempo real |
| `/admin`     | Interfaz de administración  |
| `/health`    | Health check endpoint       |

---

## Despliegue

### Construir Imagen

```bash
# Usar imagen existente para self-hosting
# Referencia: .docker/selfhost/compose.yml

# O construir imagen propia
# Ver: docs/gcp/build-image.md
```

### Desplegar en Cloud Run

```bash
# Desplegar servicio
gcloud run deploy ecodigital \
  --image gcr.io/PROJECT_ID/ecodigital \
  --platform managed \
  --region us-central1 \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --set-env-vars-file env.yaml \
  --set-secrets PRIVATE_KEY=private-key:latest \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 100 \
  --concurrency 80
```

### Configurar Dominio

```bash
# Mapear dominio personalizado
gcloud run domain-mappings create \
  --service ecodigital \
  --domain TU_DOMINIO \
  --region us-central1
```

---

## Configuración del Servidor

### CORS

```javascript
// _backend/server.js
const corsOptions = {
  origin: ['http://localhost:3010', 'http://127.0.0.1:3010', process.env.AFFINE_SERVER_EXTERNAL_URL],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Forwarded-For', 'X-Real-IP'],
  credentials: true,
  maxAge: 86400,
};
```

### Rate Limiting

```javascript
// _backend/server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
  message: {
    error: 'Demasiadas solicitudes, intente más tarde',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

### Health Check

```javascript
// _backend/server.js
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});
```

---

## Monitoreo y Logging

### Cloud Logging

```javascript
// Configuración de logging
const { Logging } = require('@google-cloud/logging');

const logging = new Logging({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const log = logging.log('ecodigital');

// Escribir log
const entry = log.entry(
  {
    severity: 'INFO',
    service: 'api',
    timestamp: new Date(),
  },
  {
    message: 'Request processed',
    method: 'GET',
    path: '/api/patients',
  }
);

log.write(entry);
```

### Cloud Monitoring

```javascript
// Métricas personalizadas
const { Monitoring } = require('@google-cloud/monitoring');

const monitoring = new Monitoring({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

// Crear métrica personalizada
const metricDescriptor = {
  type: 'custom.googleapis.com/ecodigital/requests',
  metricKind: 'CUMULATIVE',
  valueType: 'INT64',
  description: 'Número de requests por endpoint',
};
```

---

## Escalado

### Configuración de Escalado

```yaml
# .gcp/cloudrun/service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ecodigital
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: '0'
        autoscaling.knative.dev/maxScale: '100'
        autoscaling.knative.dev/target: '80'
    spec:
      containers:
        - image: gcr.io/PROJECT_ID/ecodigital
          resources:
            limits:
              memory: '1Gi'
              cpu: '2'
            requests:
              memory: '512Mi'
              cpu: '1'
          env:
            - name: NODE_ENV
              value: 'production'
```

### Conexión a Cloud SQL

```bash
# Usar Cloud SQL Auth Proxy
# El proxy se ejecuta como sidecar o usa la conexión automática de Cloud Run

# Configuración de conexión
DATABASE_URL=postgresql://USER:PASSWORD@/DBNAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

---

## Seguridad

### IAM y Service Accounts

```bash
# Crear service account
gcloud iam service-accounts create ecodigital-sa \
  --display-name="EcoDigital Service Account"

# Asignar roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ecodigital-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ecodigital-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:ecodigital-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Network Security

```bash
# Configurar VPC Connector para Memorystore
gcloud compute networks vpc-access connectors create ecodigital-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28

# Asignar connector al servicio
gcloud run deploy ecodigital \
  --vpc-connector=ecodigital-connector \
  --vpc-egress=private-ranges-only
```

---

## Costos Estimados

| Servicio       | Configuración          | Costo Mensual Estimado |
| -------------- | ---------------------- | ---------------------- |
| Cloud Run      | 2 vCPU, 1GB, 100 req/s | $50-100                |
| Cloud SQL      | 2 vCPU, 8GB, 100GB     | $100-200               |
| Memorystore    | 1GB Basic              | $30-50                 |
| Cloud Storage  | 100GB Standard         | $2-5                   |
| Secret Manager | 5 secrets              | $0-1                   |
| Network Egress | 100GB                  | $8-15                  |
| **Total**      |                        | **$190-370/mes**       |

---

## Referencias

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Memorystore for Redis](https://cloud.google.com/memorystore/docs/redis)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Vertex AI](https://cloud.google.com/vertex-ai/docs)
