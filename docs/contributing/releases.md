# Proceso de Release — ECODIGITAL

## ¿Quién puede hacer un release?

El equipo de ECODIGITAL gestiona los releases. Se requiere acceso de commit al repositorio y acceso a GitHub Actions.

## Cómo hacer un release

Antes de lanzar, asegúrate de tener la última versión de la rama `canary` y revisar la especificación [SemVer](https://semver.org).

### 1. Actualizar la versión en `package.json`

```shell
./scripts/set-version.sh 0.1.0-canary.1
```

### 2. Hacer commit y push a `canary`

```shell
git add .
git commit -m "v0.1.0-canary.1"
git push origin canary
```

### 3. Crear la acción de release

Accede a la pestaña **Actions** de tu repositorio y ejecuta el workflow `release-desktop-app`.

Selecciona la rama correspondiente, completa el formulario y haz clic en **Run workflow**.

### 4. Publicar el release

Una vez completada la acción, un borrador del release aparecerá en la sección **Releases** del repositorio.

Edita las notas del release si es necesario y publícalo.

Asegúrate de que:

- El tag y título del release coincidan con la versión en `package.json`.
- El release apunte al commit que acabas de hacer.
