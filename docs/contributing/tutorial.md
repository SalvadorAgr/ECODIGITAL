# Tutorial para contribuidores

## Introducción

Este tutorial te guiará a través del código fuente de ECODIGITAL. Está dirigido a nuevos contribuidores.

## Compilar el proyecto

Asegúrate de saber cómo compilar el proyecto. Consulta [BUILDING](../BUILDING.md) para más información.

## Estructura del código

El código fuente está organizado de la siguiente manera:

- `packages/` — Contiene todo el código que se ejecuta en producción.
  - `backend/` — Código del servidor y base de datos.
  - `frontend/` — Código del frontend, incluyendo la app web, la app Electron y librerías de negocio.
  - `common/` — Código isomórfico o librerías base sin lógica de negocio.
- `tools/` — Herramientas para desarrollo y CI.
- `tests/` — Pruebas entre diferentes librerías, incluyendo pruebas E2E e integración.

### `@affine/env`

Configuración del entorno para el cliente. Incluye constantes globales, detección del navegador y sistema.

Este paquete debe importarse al principio del punto de entrada.

#### Principios de diseño

- Cada plugin de workspace tiene su propio estado y está aislado de los demás.
- El plugin de workspace es responsable de su propio manejo de estado, persistencia, sincronización, respaldo y recuperación de datos.

### `@affine/component`

Librería de componentes UI reutilizables. Cada componente debe ser autónomo y usable en cualquier contexto.

## Ambientes de depuración

### Desarrollo web

```shell
yarn dev
```

### Electron (escritorio)

Consulta [building-desktop-client-app.md](../building-desktop-client-app.md).
