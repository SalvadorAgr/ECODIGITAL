# Construyendo Ecodigital Web

> **Nota:** Para construir la app de escritorio, consulta [building-desktop-client-app.md](./building-desktop-client-app.md).

## Tabla de Contenidos

- [Requisitos](#requisitos)
- [Configurar el entorno](#configurar-el-entorno)
- [Iniciar el servidor de desarrollo](#iniciar-el-servidor-de-desarrollo)
- [Pruebas](#pruebas)

## Requisitos

Ecodigital requiere toolchains de **Node.js** y **Rust**.

### Instalar Node.js

Se recomienda usar la versión LTS de Node.js. Descarga desde [nodejs.org](https://nodejs.org/en/download).

O instala [fnm](https://github.com/Schniz/fnm) y ejecuta:

```sh
fnm use
```

### Instalar Rust

Sigue la guía oficial en https://www.rust-lang.org/tools/install.

### Configurar Node.js

Este proyecto requiere Yarn `4.x`:

```sh
corepack enable
corepack prepare yarn@stable --activate
```

```sh
# Instalar dependencias
yarn install
```

### Clonar el repositorio

```sh
git clone https://github.com/dogmablack/ecodigital
```

#### En Windows

Activa el modo desarrollador y ejecuta con privilegios de administrador:

```sh
git config --global core.symlinks true
git clone https://github.com/dogmablack/ecodigital
```

### Compilar dependencias nativas

```sh
yarn ecodigital @ecodigital/native build
```

### Compilar dependencias del servidor

```sh
yarn ecodigital @ecodigital/server-native build
```

## Pruebas

Usamos [Playwright](https://playwright.dev/) para pruebas E2E y [vitest](https://vitest.dev/) para pruebas unitarias.

Instala los navegadores necesarios:

```sh
npx playwright install
```

Inicia el servidor antes de ejecutar las pruebas (ver [`docs/developing-server.md`](./developing-server.md)).

### Prueba unitaria

```sh
yarn test
```

### Prueba E2E

```shell
yarn workspace @ecodigital-test/ecodigital-local e2e
```

---

© 2026 dogma.black — Ecodigital
