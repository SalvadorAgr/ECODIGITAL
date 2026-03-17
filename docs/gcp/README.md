# Despliegue En GCP (Cloud Run) - EcoDigital

Este repo ya incluye un servidor "all-in-one" que sirve:

- API (GraphQL + otros endpoints del server)
- Web app (assets estaticos) desde `packages/backend/server/static/`

La integracion "una sola app" en GCP se logra desplegando **un solo servicio de Cloud Run** (un contenedor) con:

- Postgres (Cloud SQL)
- Redis (Memorystore o Redis externo)
- (Opcional) Buckets (Cloud Storage) para blobs/archivos
- Secret Manager para config y llaves

## Rutas

- App web: `/`
- GraphQL: `/graphql`
- Socket.io: `/socket.io`
- (Admin UI): `/admin`

Nota sobre "mobile":

- El server puede servir un build alterno desde `static/mobile/` para ciertos modos/canales (ver `packages/backend/server/src/core/selfhost/static.ts`).
- No se expone como `/mobile` por defecto; se selecciona por logica del server (p. ej. user-agent / canal).

## Opcion Recomendada

Usar la imagen ya prevista para self-hosting y correrla en Cloud Run:

- Referencia de selfhost local: `.docker/selfhost/compose.yml`

Si necesitas construir tu propia imagen, ve `docs/gcp/build-image.md`.

## Siguiente lectura

- `docs/gcp/cloud-run.md` (paso a paso)
- `docs/gcp/env-vars.md` (variables y secretos)
- `.gcp/cloudrun/` (YAMLs ejemplo)
