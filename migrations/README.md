# Scripts de Migración de Base de Datos - Ecodigital

## Descripción

Este directorio contiene los scripts de migración SQL para implementar el esquema de base de datos del sistema Ecodigital, siguiendo las especificaciones definidas en `docs/infraestructura/base-datos.md`.

## Estructura de Archivos

```
migrations/
├── 00_master_migration_script.sql      # Script maestro de orquestación
├── 01_usuarios_y_roles_postgresql.sql  # Usuarios, roles, sesiones y permisos
├── 02_pacientes_y_historial_postgresql.sql # Pacientes e historial clínico
├── 03_citas_y_documentos_postgresql.sql # Citas, documentos y horarios
├── 04_auditoria_y_logs_postgresql.sql  # Auditoría WORM, alertas y reportes
├── 11_communication_system_postgresql.sql # Sistema de comunicaciones
├── 13_dashboard_principal_postgresql.sql # Dashboard y widgets
└── README.md                           # Este archivo
```

## Orden de Ejecución

Los scripts deben ejecutarse en el siguiente orden debido a las dependencias entre tablas:

| Orden | Script | Descripción | Dependencias |
|-------|--------|-------------|--------------|
| 1 | `00_master_migration_script.sql` | Tabla de control y funciones de orquestación | Ninguna |
| 2 | `01_usuarios_y_roles_postgresql.sql` | Usuarios, roles, sesiones, permisos | Ninguna |
| 3 | `02_pacientes_y_historial_postgresql.sql` | Pacientes, historial clínico, antecedentes | 01 |
| 4 | `03_citas_y_documentos_postgresql.sql` | Citas, documentos, horarios, salas | 01, 02 |
| 5 | `04_auditoria_y_logs_postgresql.sql` | Logs WORM, alertas, reportes, métricas | 01 |
| 6 | `11_communication_system_postgresql.sql` | Notificaciones, mensajes, cola de envío | 01, 02, 03 |
| 7 | `13_dashboard_principal_postgresql.sql` | Widgets, métricas, configuración | 01 |

## Estándares Implementados

### 1. Seguridad y Atomicidad
- Todas las operaciones DDL y DML están encapsuladas en transacciones explícitas (`BEGIN`/`COMMIT`)
- Implementación de `ROLLBACK` automático ante errores
- Verificación de existencia de objetos antes de crear/modificar

### 2. Idempotencia
- Uso de `IF NOT EXISTS` para creación de objetos
- Uso de `IF EXISTS` para eliminación de objetos
- Uso de `ON CONFLICT DO NOTHING` para datos iniciales
- Verificación de existencia de triggers antes de crear

### 3. Gestión de Dependencias
- Orden correcto de creación de tablas respetando claves foráneas
- Verificación de dependencias antes de cada migración
- Eliminación en orden inverso en scripts de rollback

### 4. Preservación de Datos
- Lógica de respaldo implícita en transacciones
- Soft deletes donde aplica (campos `activo`)
- Campos de auditoría (`fecha_creacion`, `fecha_modificacion`)

### 5. Reversibilidad
- Cada script incluye sección `DOWN` comentada para rollback
- El script maestro incluye funciones para gestionar rollback

## Uso

### Ejecución Manual (psql)

```bash
# Conectar a la base de datos
psql -h localhost -U postgres -d ecodigital

# Ejecutar script maestro primero
\i migrations/00_master_migration_script.sql

# Ejecutar cada migración en orden
\i migrations/01_usuarios_y_roles_postgresql.sql
\i migrations/02_pacientes_y_historial_postgresql.sql
\i migrations/03_citas_y_documentos_postgresql.sql
\i migrations/04_auditoria_y_logs_postgresql.sql
\i migrations/11_communication_system_postgresql.sql
\i migrations/13_dashboard_principal_postgresql.sql
```

### Ejecución con Script Maestro

```sql
-- Ejecutar todas las migraciones
CALL sp_ejecutar_migraciones();

-- Ejecutar hasta una versión específica
CALL sp_ejecutar_migraciones(FALSE, '04');

-- Forzar re-ejecución
CALL sp_ejecutar_migraciones(TRUE);

-- Verificar estado
CALL sp_verificar_estado_migraciones();

-- Consultar estado
SELECT * FROM v_estado_migraciones;
```

### Rollback

Para revertir una migración, ejecute la sección `DOWN` comentada al final de cada archivo:

```sql
-- Descomentar y ejecutar el bloque DOWN al final del archivo
BEGIN;
-- ... instrucciones de rollback ...
COMMIT;
```

## Características por Script

### 01 - Usuarios y Roles
- Tablas: `ROLES`, `USUARIOS`, `SESIONES_USUARIO`, `PERMISOS_USUARIO`, `LOG_ACCESOS`, `CONFIGURACION_SEGURIDAD`
- Funciones: Hash de contraseñas, verificación de bloqueo
- Triggers: Actualización automática de `fecha_modificacion`
- Vistas: `v_usuarios_completo`, `v_sesiones_activas`

### 02 - Pacientes e Historial
- Tablas: `PACIENTES`, `HISTORIAL_CLINICO`, `ANTECEDENTES_MEDICOS`, `VACUNAS_PACIENTE`, `ARCHIVOS_ADJUNTOS`
- Funciones: Cálculo de IMC, generación de expedientes
- Triggers: Actualización de fechas de consulta
- Vistas: `v_pacientes_resumen`, `v_historial_completo`

### 03 - Citas y Documentos
- Tablas: `HORARIOS_MEDICOS`, `BLOQUEOS_HORARIO`, `CITAS`, `DOCUMENTOS`, `PLANTILLAS_DOCUMENTOS`, `SALAS_CONSULTA`
- Funciones: Validación de conflictos, verificación de disponibilidad
- Triggers: Generación de números de cita
- Vistas: `v_citas_completas`, `v_citas_hoy`

### 04 - Auditoría y Logs
- Tablas: `LOGS_AUDITORIA`, `ALERTAS_AUDITORIA`, `INSTANCIAS_ALERTAS`, `REPORTES_PROGRAMADOS`, `EJECUCIONES_REPORTES`, `PLANTILLAS_REPORTES`, `METRICAS_SISTEMA`, `CONFIGURACION_AUDITORIA`
- Funciones: Generación de hash de integridad, prevención de modificación WORM
- Triggers: Integridad de logs, prevención de updates/deletes
- Vistas: `v_logs_auditoria_resumen`, `v_alertas_activas`

### 11 - Sistema de Comunicaciones
- Tablas: `PLANTILLAS_COMUNICACION`, `NOTIFICACIONES`, `MENSAJES`, `MENSAJES_DESTINATARIOS`, `COLA_ENVIO`, `CONFIGURACION_NOTIFICACIONES`, `REGISTRO_ENVIOS`, `RECORDATORIOS_CITAS`
- Funciones: Envío de notificaciones, procesamiento de cola
- Triggers: Actualización de estados
- Vistas: `v_notificaciones_usuario`, `v_cola_pendiente`

### 13 - Dashboard Principal
- Tablas: `WIDGETS`, `DASHBOARD_USUARIO`, `WIDGETS_DASHBOARD`, `METRICAS_DASHBOARD`, `VALORES_METRICAS`, `GRAFICOS_DASHBOARD`, `DATOGRAFICOS_DASHBOARD`, `ACCESOS_RAPIDOS`, `FAVORITOS_USUARIO`, `CONFIGURACION_DASHBOARD`, `HISTORIAL_ACTIVIDADES`
- Funciones: Cálculo de métricas, obtención de widgets
- Triggers: Actualización de configuraciones
- Vistas: `v_widgets_activos`, `v_metricas_con_valores`

## Mantenimiento

### Backup

```bash
# Backup completo antes de migrar
pg_dump -h localhost -U postgres -d ecodigital -F c -f backup_$(date +%Y%m%d).dump

# Backup solo esquema
pg_dump -h localhost -U postgres -d ecodigital -s -F c -f schema_$(date +%Y%m%d).dump
```

### Vacuum y Analyze

```sql
-- Ejecutar después de migraciones grandes
VACUUM ANALYZE;
```

### Verificación de Integridad

```sql
-- Verificar integridad de logs de auditoría
SELECT * FROM verificar_integridad_logs();

-- Verificar estado de migraciones
SELECT * FROM v_estado_migraciones;
```

## Notas Importantes

1. **Backup**: Siempre realice un backup antes de ejecutar las migraciones en producción
2. **Orden**: Ejecute los scripts en el orden especificado
3. **Transacciones**: Cada script está encapsulado en transacciones para rollback automático
4. **Idempotencia**: Los scripts pueden ejecutarse múltiples veces sin causar errores
5. **Dependencias**: Verifique que las tablas dependientes existan antes de ejecutar
6. **Pruebas**: Ejecute primero en un ambiente de pruebas

## Contacto

Para soporte o preguntas sobre las migraciones, consulte la documentación en `docs/infraestructura/base-datos.md`.