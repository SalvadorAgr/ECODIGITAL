# Cloud Run - Despliegue "Una Sola App" (Server + Web)

El server de este repo ya soporta servir assets estaticos para self-hosting desde `packages/backend/server/static/` y exponer API en el mismo origen. En Cloud Run eso se traduce en **un servicio**.

## 1) Infra en GCP

1. Proyecto + billing habilitado
2. Cloud SQL (Postgres)
3. Redis (Memorystore) si lo usas
4. (Opcional) Buckets (Cloud Storage) para archivos grandes
5. Secret Manager (config/keys)
6. (Si Redis/DB por IP privada) Serverless VPC Access + reglas de firewall

## 2) Imagen del contenedor

Tienes 2 caminos:

### A) Usar imagen selfhost existente (mas rapido)

La referencia local esta en `.docker/selfhost/compose.yml`. En Cloud Run desplegas la misma imagen y solo cambias:

- `DATABASE_URL` a Cloud SQL
- `REDIS_SERVER_HOST` a Memorystore/Redis
- `AFFINE_SERVER_EXTERNAL_URL` al dominio final
- Montajes/config via Secret Manager

### B) Construir tu imagen (cuando quieres control total)

Ve `docs/gcp/build-image.md` y usa el `Dockerfile.gcp`.

## 3) Migraciones / predeploy (muy importante)

En selfhost, se corre un job aparte (`affine_migration`) con:

- `node ./scripts/self-host-predeploy.js`

En Cloud Run replica el mismo patron:

- Cloud Run Job "migration" (ver `.gcp/cloudrun/migrate-job.yaml`)
- Cloud Run Service "app" (ver `.gcp/cloudrun/service.yaml`)

## 4) Dominio y TLS

Recomendado: un solo dominio para evitar CORS y simplificar cookies:

- `https://app.tudominio.com/` (web)
- `https://app.tudominio.com/graphql` (API)

Puedes usar:

- Cloud Run custom domains, o
- HTTPS Load Balancer apuntando a Cloud Run

## 5) Checklist de smoke test

- `GET /` carga HTML (debe ser `selfhost.html` cuando `DEPLOYMENT_TYPE=selfhosted`)
- `GET /graphql` responde (GraphQL playground depende de config)
- `GET /api/healthz` si existe endpoint de health (si no existe, usa `/graphql` como probe)
- Login, crear workspace local, navegar
