# Ecodocs (fuente externa)

La documentacion maestra del proyecto vive fuera del repo (por ejemplo en:
`/Users/salvadoraguilar/Documents/Nueva carpeta con ítems/Ecodocs`).

Para no "romper" el repo con PDFs pesados ni duplicar contenido manualmente, este repo incluye un script opcional para sincronizar **solo texto** (md/txt) a `docs/ecodocs/`.

## Sync (opcional)

```bash
ECODOCS_SRC="/Users/salvadoraguilar/Documents/Nueva carpeta con ítems/Ecodocs" \
  node scripts/sync-ecodocs.mjs
```

El script:

- Copia `.md` y `.txt`
- Omite PDFs/imagenes y archivos binarios
- Mantiene la estructura de carpetas
