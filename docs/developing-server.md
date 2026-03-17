Este documento explica cómo iniciar el servidor localmente con Docker.

> **Warning**:
>
> This document is not guaranteed to be up-to-date.
> If you find any outdated information, please feel free to open an issue or submit a PR.

## Run required dev services in docker compose

El servidor requiere que los siguientes servicios de desarrollo estén corriendo:

- postgres
- redis
- mailhog

You can run these services in docker compose by running the following command:

```sh
cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
cp ./.docker/dev/.env.example ./.docker/dev/.env

docker compose -f ./.docker/dev/compose.yml up
```

### Notify

> La imagen de base de datos por defecto es `pgvector/pgvector:pg16`. Si usas otra versión mayor de Postgres, cambia el número después de `pgvector/pgvector:pg` por tu versión.

## Build native packages (you need to setup rust toolchain first)

Server also requires native packages to be built, you can build them by running the following command:

```sh
# build native
yarn ecodigital @ecodigital/server-native build
```

## Prepare dev environment

```sh
# uncomment all env variables here
cp packages/backend/server/.env.example packages/backend/server/.env

# everytime there are new migrations, init command should runned again
yarn ecodigital server init
```

## Start server

```sh
# at project root
yarn ecodigital server dev
```

when server started, it will created a default user and a pro user for testing:

### default user

Workspace members up to 3

- email: dev@ecodigital.local
- name: Dev User
- password: dev

### pro user

Workspace members up to 10

- email: pro@ecodigital.local
- name: Pro User
- password: pro

### team user

Include a default `Team Workspace` and the members up to 10

- email: team@ecodigital.local
- name: Team User
- password: team

## Start frontend

```sh
# at project root
yarn dev
```

Puedes iniciar sesión con el usuario (dev@ecodigital.local / dev) para probar el servidor.

## Done

Ahora deberías poder comenzar a desarrollar ECODIGITAL con el servidor habilitado.

## Bonus

### Enable prisma studio (Database GUI)

```sh
# available at http://localhost:5555
yarn ecodigital server prisma studio
```

### Seed the db

```sh
yarn ecodigital server seed -h
```
