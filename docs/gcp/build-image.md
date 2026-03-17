# Build de Imagen (Docker) - EcoDigital (GCP)

Este repo no depende de "dos deploys": el server ya puede servir el frontend desde `packages/backend/server/static/`. La estrategia es:

1. Build de `@affine/web`, `@affine/admin`, `@affine/mobile`
2. Copiar sus `dist/` a `packages/backend/server/static/` (/, /admin, /mobile)
3. Build de `@affine/server` (y `@affine/server-native`)
4. Empaquetar todo en un contenedor para Cloud Run

El Dockerfile propuesto vive en `Dockerfile.gcp`.

Notas:

- `@affine/server-native` requiere toolchain Rust para compilar.
- Si prefieres evitar builds pesados en Cloud Build, usa la imagen selfhost existente y enfoca tu tiempo en configuracion/secretos.
