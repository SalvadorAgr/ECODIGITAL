# Plan: Funciones Nativas EcoDigital (sin romper lo actual)

Este plan asume que **EcoDigital es toda la app** y que las nuevas funciones deben sentirse **nativas**, no como "integraciones". La estrategia para no sacrificar nada es: **agregar** (no reemplazar) un conjunto de modulos y endpoints, aislados por feature-flag y con rutas/UI fijas (no removibles).

La base tecnica del repo ya es "una sola app":

- `@affine/server` (NestJS + Prisma) sirve API y tambien sirve el frontend desde `packages/backend/server/static/`.
- `@affine/web` es el frontend principal.

## Objetivo

Agregar un "Core Clinico" (ej. pacientes/citas/documentos) como parte del producto EcoDigital:

- Visible como secciones fijas (sidebar + rutas)
- Datos persistidos en la misma DB (Postgres) con soft delete
- Auditoria y trazabilidad (logs)
- Lista para despliegue en GCP con un solo dominio

## Cambios propuestos (alto nivel)

### 1) Frontend (web)

- Agregar un modulo `ecodigital` en `packages/frontend/core/src/modules/` que registre:
  - Rutas `/clinic/patients`, `/clinic/appointments`, `/clinic/documents`
  - Entradas fijas en sidebar (no removibles)
  - Pantallas CRUD basicas con estados de carga/errores (UX "fantasma" cuando no hay red)
- Mantener el editor/documentos existente intacto (no se toca Blocksuite/AFFiNE core).

### 2) Backend (server)

- Agregar un plugin `ecodigital` en `packages/backend/server/src/plugins/` con:
  - REST API bajo `/api/v1/*` (alineado a `Ecodocs/API_DOCUMENTACION.md`), o alternativamente GraphQL + un thin REST gateway.
  - RBAC: roles (admin/doctor/asistente/invitado) y permisos por recurso.
  - Soft delete: campos `deletedAt` o `isDeleted` y exclusiones por defecto en listados.
  - Auditoria: tabla `AuditLog` + logs estructurados (Cloud Logging en GCP).

### 3) Data model (Prisma / Postgres)

- Tablas/entidades iniciales:
  - `Patient`
  - `Appointment`
  - `MedicalDocument` (metadatos + referencia a blob)
  - `AuditLog` (WORM a nivel app: no updates/deletes)
- Indices:
  - `Patient(email)`, `Patient(phone)` (busqueda rapida)
  - `Appointment(date,status)`
  - `ClinicalHistory(patientId,consultationDate)` si se agrega en fase 2

### 4) Storage (archivos)

- Mantener el modelo de blobs del server para adjuntos, o:
  - Guardar metadatos en DB y blobs en Cloud Storage (pre-signed URLs).

## Feature flag y compatibilidad

- Nuevo feature flag: `ECODIGITAL_CLINIC_ENABLED` (default: `false`).
- El frontend oculta sidebar/rutas si el flag esta apagado.
- El backend no registra controllers/routes del plugin si el flag esta apagado.
- Con el flag `true`, todo lo existente sigue funcionando igual; solo aparecen nuevas secciones.

## Criterios de aceptacion

- Con `ECODIGITAL_CLINIC_ENABLED=false`: comportamiento identico al actual.
- Con `ECODIGITAL_CLINIC_ENABLED=true`:
  - Sidebar muestra seccion Clinica fija.
  - CRUD Pacientes funciona (create/list/update/soft-delete).
  - RBAC bloquea acciones segun rol.
  - Auditoria registra create/update/delete (soft) y se puede consultar.
  - Deploy "una sola app" en Cloud Run funciona con un dominio.

## Plan de pruebas

- Unit tests (backend): servicios + validaciones + RBAC.
- Integration tests (backend): endpoints `/api/v1/patients` + soft delete.
- E2E (web): flujo crear paciente -> editar -> archivar -> no aparece en listados.
- Smoke test (GCP): `/` sirve app y `/graphql` responde.

## Entregables

- UI Clinica (frontend) + flag
- Plugin Clinica (backend) + flag
- Migraciones Prisma
- Docs actualizadas de despliegue (ya en `docs/gcp/`)
