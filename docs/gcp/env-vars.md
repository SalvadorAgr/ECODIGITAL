# Variables y Secretos (Cloud Run) - EcoDigital

## Variables minimas

- `NODE_ENV=production`
- `DEPLOYMENT_TYPE=selfhosted` (sirve `selfhost.html` y rutas selfhost)
- `DEPLOYMENT_PLATFORM=gcp` (activa comportamiento especifico si existe)
- `PORT=3010` (Cloud Run inyecta `PORT`; el server debe escuchar ese puerto)

## Base de datos (Postgres)

- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME`

En Cloud SQL (recomendado), usa Cloud SQL Connector (Cloud Run) y configura:

- Instancia Cloud SQL adjunta al servicio (UI o `gcloud run deploy --add-cloudsql-instances ...`)
- `DATABASE_URL` con host `127.0.0.1` y el puerto del proxy, o el formato recomendado por tu setup.

## Redis

El docker compose selfhost usa:

- `REDIS_SERVER_HOST=redis`

En Cloud Run apunta a Memorystore o Redis manejado:

- `REDIS_SERVER_HOST=10.x.x.x` (IP privada via Serverless VPC Access)
- (si aplica) `REDIS_SERVER_PORT=6379`

## URL externa (importante)

Para links, callbacks OAuth y CORS/Origin:

- `AFFINE_SERVER_EXTERNAL_URL=https://TU_DOMINIO`

## Almacenamiento / Config

El server usa por defecto `~/.affine/`:

- `~/.affine/config/` (config JSON y llaves)
- `~/.affine/storage/` (blobs/archivos)

En Cloud Run NO hay disco persistente. Opciones:

1. Montar config desde Secret Manager (recommended) y usar Storage remoto para blobs.
2. Usar un volumen (si tu region/plan lo soporta) para storage y/o config.

## Llave privada (selfhost)

El script `packages/backend/server/scripts/self-host-predeploy.js` genera:

- `~/.affine/config/private.key`

En GCP, sugerido:

- Guardar `private.key` como Secret Manager y montarlo como archivo en `/root/.affine/config/private.key`
