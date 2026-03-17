# Módulo de Auditoría y Logs

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de auditoría implementa un sistema WORM (Write Once Read Many) para logs inmutables que cumplen con regulaciones médicas, permitiendo el registro completo de todas las acciones del sistema.

---

## Esquema de Base de Datos

### Tabla LOGS_AUDITORIA

```sql
CREATE TABLE IF NOT EXISTS LOGS_AUDITORIA (
    id BIGSERIAL PRIMARY KEY,

    -- Identificación del evento
    evento_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN (
        'LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGOUT', 'SESION_EXPIRADA',
        'CREAR_REGISTRO', 'ACTUALIZAR_REGISTRO', 'ELIMINAR_REGISTRO', 'CONSULTAR_REGISTRO',
        'SUBIR_ARCHIVO', 'DESCARGAR_ARCHIVO', 'ELIMINAR_ARCHIVO',
        'CAMBIO_PERMISOS', 'CAMBIO_ROL', 'CAMBIO_PASSWORD',
        'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO',
        'BACKUP_CREADO', 'RESTAURACION_DATOS',
        'CONFIGURACION_CAMBIADA', 'MANTENIMIENTO_SISTEMA',
        'ERROR_SISTEMA', 'ALERTA_SEGURIDAD'
    )),
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN (
        'AUTENTICACION', 'AUTORIZACION', 'DATOS_PACIENTE', 'HISTORIAL_CLINICO',
        'DOCUMENTOS', 'CITAS', 'USUARIOS', 'SISTEMA', 'SEGURIDAD', 'REPORTES'
    )),
    nivel_criticidad VARCHAR(10) NOT NULL DEFAULT 'MEDIO' CHECK (nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),

    -- Información del usuario
    usuario_id INTEGER NULL,
    username VARCHAR(50) NULL,
    rol_usuario VARCHAR(50) NULL,

    -- Información de la sesión
    sesion_id VARCHAR(100) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    dispositivo VARCHAR(100) NULL,
    ubicacion_geografica VARCHAR(200) NULL,

    -- Información del recurso afectado
    modulo VARCHAR(50) NOT NULL,
    recurso_tipo VARCHAR(50) NULL,
    recurso_id VARCHAR(36) NULL,
    recurso_nombre VARCHAR(200) NULL,

    -- Detalles de la operación
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    datos_antes JSONB NULL,
    datos_despues JSONB NULL,
    metadatos_adicionales JSONB NULL,

    -- Información temporal
    fecha_evento TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_hora TIMESTAMP(6) GENERATED ALWAYS AS (fecha_evento) STORED,
    duracion_ms INTEGER NULL,

    -- Información de integridad (WORM)
    hash_integridad VARCHAR(64) NOT NULL,
    hash_anterior VARCHAR(64) NULL,
    numero_secuencia BIGINT NOT NULL,

    -- Información de resultado
    resultado VARCHAR(10) NOT NULL DEFAULT 'EXITOSO' CHECK (resultado IN ('EXITOSO', 'FALLIDO', 'PARCIAL', 'CANCELADO')),
    codigo_error VARCHAR(20) NULL,
    mensaje_error TEXT NULL,

    -- Información de cumplimiento
    requiere_retencion BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_retencion_hasta DATE NULL,
    politica_retencion VARCHAR(50) NULL,

    -- Metadatos del sistema
    version_aplicacion VARCHAR(20) NULL,
    servidor VARCHAR(50) NULL,
    proceso_id VARCHAR(50) NULL,

    UNIQUE(evento_id)
);
```

### Tabla ALERTAS_AUDITORIA

```sql
CREATE TABLE IF NOT EXISTS ALERTAS_AUDITORIA (
    id SERIAL PRIMARY KEY,

    -- Identificación de la alerta
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    tipo_alerta VARCHAR(30) NOT NULL CHECK (tipo_alerta IN (
        'ACCESO_NO_AUTORIZADO', 'MULTIPLES_INTENTOS_FALLIDOS', 'ACCESO_FUERA_HORARIO',
        'CAMBIOS_MASIVOS', 'ELIMINACIONES_MASIVAS', 'ACCESO_DATOS_SENSIBLES',
        'PATRON_SOSPECHOSO', 'CONFIGURACION_CRITICA', 'ERROR_SISTEMA',
        'UMBRAL_SUPERADO', 'PERSONALIZADA'
    )),

    -- Configuración de detección
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    nivel_severidad VARCHAR(15) NOT NULL DEFAULT 'ADVERTENCIA' CHECK (nivel_severidad IN ('INFORMATIVO', 'ADVERTENCIA', 'CRITICO', 'EMERGENCIA')),
    condiciones_deteccion JSONB NOT NULL,
    umbral_cantidad INTEGER NULL,
    ventana_tiempo_minutos INTEGER NULL,

    -- Configuración de notificación
    notificar_email BOOLEAN NOT NULL DEFAULT TRUE,
    notificar_sms BOOLEAN NOT NULL DEFAULT FALSE,
    notificar_sistema BOOLEAN NOT NULL DEFAULT TRUE,
    destinatarios_email JSONB NULL,
    destinatarios_sms JSONB NULL,

    -- Configuración de escalamiento
    escalar_si_no_resuelve BOOLEAN NOT NULL DEFAULT FALSE,
    tiempo_escalamiento_minutos INTEGER NULL,
    destinatarios_escalamiento JSONB NULL,

    -- Plantilla de mensaje
    plantilla_mensaje TEXT NOT NULL,
    incluir_detalles_evento BOOLEAN NOT NULL DEFAULT TRUE,
    incluir_contexto_usuario BOOLEAN NOT NULL DEFAULT TRUE,

    -- Información de creación
    creado_por INTEGER NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_por INTEGER NULL,
    fecha_modificacion TIMESTAMP NULL
);
```

### Tabla INSTANCIAS_ALERTAS

```sql
CREATE TABLE IF NOT EXISTS INSTANCIAS_ALERTAS (
    id BIGSERIAL PRIMARY KEY,

    -- Referencia a la alerta
    alerta_id INTEGER NOT NULL,

    -- Información del evento que disparó la alerta
    evento_disparador_id BIGINT NULL,
    eventos_relacionados JSONB NULL,

    -- Información de la instancia
    fecha_deteccion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nivel_severidad VARCHAR(15) NOT NULL CHECK (nivel_severidad IN ('INFORMATIVO', 'ADVERTENCIA', 'CRITICO', 'EMERGENCIA')),
    mensaje_generado TEXT NOT NULL,
    contexto_deteccion JSONB NOT NULL,

    -- Estado de la alerta
    estado VARCHAR(15) NOT NULL DEFAULT 'NUEVA' CHECK (estado IN ('NUEVA', 'NOTIFICADA', 'EN_REVISION', 'RESUELTA', 'FALSA_ALARMA', 'ESCALADA')),
    fecha_notificacion TIMESTAMP NULL,
    fecha_resolucion TIMESTAMP NULL,
    resuelto_por INTEGER NULL,
    notas_resolucion TEXT NULL,

    -- Información de notificación
    notificaciones_enviadas JSONB NULL,
    escalado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_escalamiento TIMESTAMP NULL,

    -- Métricas
    tiempo_deteccion_ms INTEGER NULL,
    tiempo_resolucion_minutos INTEGER NULL
);
```

---

## Tipos de Eventos

### Eventos de Autenticación

| Tipo            | Descripción              | Nivel |
| --------------- | ------------------------ | ----- |
| LOGIN_EXITOSO   | Inicio de sesión exitoso | BAJO  |
| LOGIN_FALLIDO   | Intento de login fallido | MEDIO |
| LOGOUT          | Cierre de sesión         | BAJO  |
| SESION_EXPIRADA | Sesión expirada          | BAJO  |
| CAMBIO_PASSWORD | Cambio de contraseña     | MEDIO |

### Eventos de Datos

| Tipo                | Descripción                | Nivel |
| ------------------- | -------------------------- | ----- |
| CREAR_REGISTRO      | Creación de nuevo registro | BAJO  |
| ACTUALIZAR_REGISTRO | Actualización de registro  | MEDIO |
| ELIMINAR_REGISTRO   | Eliminación de registro    | ALTO  |
| CONSULTAR_REGISTRO  | Consulta de registro       | BAJO  |
| SUBIR_ARCHIVO       | Subida de archivo          | MEDIO |
| DESCARGAR_ARCHIVO   | Descarga de archivo        | MEDIO |
| ELIMINAR_ARCHIVO    | Eliminación de archivo     | ALTO  |

### Eventos de Seguridad

| Tipo                         | Descripción                     | Nivel   |
| ---------------------------- | ------------------------------- | ------- |
| ACCESO_DENEGADO              | Acceso denegado                 | ALTO    |
| INTENTO_ACCESO_NO_AUTORIZADO | Intento de acceso no autorizado | CRITICO |
| CAMBIO_PERMISOS              | Cambio de permisos              | ALTO    |
| CAMBIO_ROL                   | Cambio de rol                   | ALTO    |
| ALERTA_SEGURIDAD             | Alerta de seguridad             | CRITICO |

---

## Categorías de Auditoría

| Categoría         | Descripción                         |
| ----------------- | ----------------------------------- |
| AUTENTICACION     | Eventos de autenticación y sesiones |
| AUTORIZACION      | Eventos de autorización y permisos  |
| DATOS_PACIENTE    | Acceso a datos de pacientes         |
| HISTORIAL_CLINICO | Acceso a historial clínico          |
| DOCUMENTOS        | Gestión de documentos               |
| CITAS             | Gestión de citas                    |
| USUARIOS          | Gestión de usuarios                 |
| SISTEMA           | Eventos del sistema                 |
| SEGURIDAD         | Eventos de seguridad                |
| REPORTES          | Generación de reportes              |

---

## Triggers de Inmutabilidad

### Prevenir Actualizaciones

```sql
CREATE OR REPLACE FUNCTION prevent_logs_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser modificados';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_logs_auditoria_prevent_update
    BEFORE UPDATE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_update();
```

### Prevenir Eliminaciones

```sql
CREATE OR REPLACE FUNCTION prevent_logs_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los logs de auditoría son inmutables y no pueden ser eliminados';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_logs_auditoria_prevent_delete
    BEFORE DELETE ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logs_delete();
```

### Generar Hash de Integridad

```sql
CREATE OR REPLACE FUNCTION generate_log_integrity()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_numero_secuencia BIGINT DEFAULT 0;
    ultimo_hash VARCHAR(64) DEFAULT '';
    datos_hash TEXT;
BEGIN
    -- Obtener último número de secuencia y hash
    SELECT COALESCE(MAX(numero_secuencia), 0), COALESCE(MAX(hash_integridad), '')
    INTO ultimo_numero_secuencia, ultimo_hash
    FROM LOGS_AUDITORIA;

    -- Asignar número de secuencia
    NEW.numero_secuencia = ultimo_numero_secuencia + 1;
    NEW.hash_anterior = ultimo_hash;

    -- Preparar datos para hash
    datos_hash = CONCAT(
        COALESCE(NEW.evento_id::TEXT, ''), '|',
        COALESCE(NEW.tipo_evento, ''), '|',
        COALESCE(NEW.categoria, ''), '|',
        COALESCE(NEW.usuario_id::TEXT, ''), '|',
        COALESCE(NEW.modulo, ''), '|',
        COALESCE(NEW.accion, ''), '|',
        COALESCE(NEW.descripcion, ''), '|',
        COALESCE(NEW.fecha_evento::TEXT, ''), '|',
        COALESCE(NEW.numero_secuencia::TEXT, ''), '|',
        COALESCE(NEW.hash_anterior, '')
    );

    -- Generar hash de integridad
    NEW.hash_integridad = encode(digest(datos_hash, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_logs_auditoria_before_insert
    BEFORE INSERT ON LOGS_AUDITORIA
    FOR EACH ROW
    EXECUTE FUNCTION generate_log_integrity();
```

---

## Procedimiento de Log

```sql
CREATE OR REPLACE FUNCTION sp_crear_log_auditoria(
    p_evento_id UUID DEFAULT NULL,
    p_tipo_evento VARCHAR(50) DEFAULT NULL,
    p_categoria VARCHAR(50) DEFAULT NULL,
    p_nivel_criticidad VARCHAR(10) DEFAULT 'MEDIO',
    p_usuario_id INTEGER DEFAULT NULL,
    p_username VARCHAR(50) DEFAULT NULL,
    p_rol_usuario VARCHAR(50) DEFAULT NULL,
    p_sesion_id VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_modulo VARCHAR(50) DEFAULT NULL,
    p_accion VARCHAR(50) DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_recurso_tipo VARCHAR(50) DEFAULT NULL,
    p_recurso_id VARCHAR(36) DEFAULT NULL,
    p_datos_antes JSONB DEFAULT NULL,
    p_datos_despues JSONB DEFAULT NULL,
    p_resultado VARCHAR(20) DEFAULT 'EXITOSO',
    p_duracion_ms INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO LOGS_AUDITORIA (
        evento_id, tipo_evento, categoria, nivel_criticidad,
        usuario_id, username, rol_usuario, sesion_id,
        ip_address, user_agent, modulo, accion, descripcion,
        recurso_tipo, recurso_id, datos_antes, datos_despues,
        resultado, duracion_ms, requiere_retencion
    ) VALUES (
        COALESCE(p_evento_id, gen_random_uuid()),
        p_tipo_evento, p_categoria, p_nivel_criticidad,
        p_usuario_id, p_username, p_rol_usuario, p_sesion_id,
        p_ip_address, p_user_agent, p_modulo, p_accion, p_descripcion,
        p_recurso_tipo, p_recurso_id, p_datos_antes, p_datos_despues,
        p_resultado, p_duracion_ms, TRUE
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Verificación de Integridad

```sql
CREATE OR REPLACE FUNCTION sp_verificar_integridad_logs(
    p_fecha_desde DATE,
    p_fecha_hasta DATE,
    OUT p_total_logs INTEGER,
    OUT p_logs_validos INTEGER,
    OUT p_logs_invalidos INTEGER
)
AS $$
DECLARE
    rec RECORD;
    v_hash_calculado VARCHAR(64);
    datos_hash TEXT;
BEGIN
    p_total_logs := 0;
    p_logs_validos := 0;
    p_logs_invalidos := 0;

    FOR rec IN
        SELECT id, hash_integridad, evento_id, tipo_evento, categoria, usuario_id,
               modulo, accion, descripcion, fecha_evento, numero_secuencia, hash_anterior
        FROM LOGS_AUDITORIA
        WHERE DATE(fecha_evento) BETWEEN p_fecha_desde AND p_fecha_hasta
        ORDER BY numero_secuencia
    LOOP
        p_total_logs := p_total_logs + 1;

        datos_hash := CONCAT(
            COALESCE(rec.evento_id::TEXT, ''), '|',
            COALESCE(rec.tipo_evento, ''), '|',
            COALESCE(rec.categoria, ''), '|',
            COALESCE(rec.usuario_id::TEXT, ''), '|',
            COALESCE(rec.modulo, ''), '|',
            COALESCE(rec.accion, ''), '|',
            COALESCE(rec.descripcion, ''), '|',
            COALESCE(rec.fecha_evento::TEXT, ''), '|',
            COALESCE(rec.numero_secuencia::TEXT, ''), '|',
            COALESCE(rec.hash_anterior, '')
        );

        v_hash_calculado := encode(digest(datos_hash, 'sha256'), 'hex');

        IF v_hash_calculado = rec.hash_integridad THEN
            p_logs_validos := p_logs_validos + 1;
        ELSE
            p_logs_invalidos := p_logs_invalidos + 1;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## Endpoints de la API

### Consultar Logs

```http
GET /api/audit/logs?from=2026-03-01&to=2026-03-20&category=DATOS_PACIENTE
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "evento_id": "550e8400-e29b-41d4-a716-446655440000",
        "tipo_evento": "CONSULTAR_REGISTRO",
        "categoria": "DATOS_PACIENTE",
        "nivel_criticidad": "BAJO",
        "usuario": {
          "id": 2,
          "username": "jsanchez",
          "rol": "Admin Principal"
        },
        "modulo": "pacientes",
        "accion": "consultar",
        "descripcion": "Consulta de paciente ID: 1",
        "recurso": {
          "tipo": "paciente",
          "id": "1",
          "nombre": "Juan Pérez"
        },
        "fecha_evento": "2026-03-20T10:30:00Z",
        "resultado": "EXITOSO"
      }
    ],
    "pagination": {
      "total": 1500,
      "page": 1,
      "limit": 50,
      "totalPages": 30
    }
  }
}
```

### Verificar Integridad

```http
POST /api/audit/verify-integrity
Authorization: Bearer {token}
Content-Type: application/json

{
  "from": "2026-03-01",
  "to": "2026-03-20"
}

Response 200:
{
  "success": true,
  "data": {
    "total_logs": 1500,
    "valid_logs": 1500,
    "invalid_logs": 0,
    "integrity_percentage": 100
  }
}
```

### Exportar Logs

```http
GET /api/audit/export?from=2026-03-01&to=2026-03-20&format=CSV
Authorization: Bearer {token}

Response 200:
Content-Type: text/csv
Content-Disposition: attachment; filename="audit_logs_20260301_20260320.csv"

id,evento_id,tipo_evento,categoria,usuario_id,modulo,accion,descripcion,fecha_evento,resultado
1,550e8400-e29b-41d4-a716-446655440000,CONSULTAR_REGISTRO,DATOS_PACIENTE,2,pacientes,consultar,Consulta de paciente ID: 1,2026-03-20T10:30:00Z,EXITOSO
...
```

---

## Vistas Útiles

### Vista de Dashboard de Auditoría

```sql
CREATE OR REPLACE VIEW v_dashboard_auditoria AS
SELECT
    DATE(fecha_evento) as fecha,
    categoria,
    tipo_evento,
    nivel_criticidad,
    COUNT(*) as total_eventos,
    COUNT(DISTINCT usuario_id) as usuarios_unicos,
    COUNT(DISTINCT ip_address) as ips_unicas,
    SUM(CASE WHEN resultado = 'FALLIDO' THEN 1 ELSE 0 END) as eventos_fallidos
FROM LOGS_AUDITORIA
WHERE fecha_evento >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(fecha_evento), categoria, tipo_evento, nivel_criticidad;
```

### Vista de Eventos de Seguridad Críticos

```sql
CREATE OR REPLACE VIEW v_eventos_seguridad_criticos AS
SELECT
    l.*,
    u.nombres,
    u.apellidos,
    r.nombre as rol_nombre
FROM LOGS_AUDITORIA l
LEFT JOIN USUARIOS u ON l.usuario_id = u.id
LEFT JOIN ROLES r ON u.rol_id = r.id
WHERE l.nivel_criticidad IN ('ALTO', 'CRITICO')
   OR l.tipo_evento IN ('LOGIN_FALLIDO', 'ACCESO_DENEGADO', 'INTENTO_ACCESO_NO_AUTORIZADO')
ORDER BY l.fecha_evento DESC;
```

---

## Alertas Predefinidas

```sql
INSERT INTO ALERTAS_AUDITORIA (
    nombre, descripcion, tipo_alerta, nivel_severidad,
    condiciones_deteccion, umbral_cantidad, ventana_tiempo_minutos,
    plantilla_mensaje, creado_por
) VALUES
(
    'Múltiples Intentos de Login Fallidos',
    'Detecta múltiples intentos de login fallidos desde la misma IP',
    'MULTIPLES_INTENTOS_FALLIDOS',
    'ADVERTENCIA',
    '{"tipo_evento": "LOGIN_FALLIDO", "agrupar_por": "ip_address"}',
    5,
    15,
    'Se han detectado {cantidad} intentos de login fallidos desde la IP {ip_address} en los últimos {tiempo} minutos.',
    1
),
(
    'Acceso Fuera de Horario',
    'Detecta accesos al sistema fuera del horario laboral',
    'ACCESO_FUERA_HORARIO',
    'INFORMATIVO',
    '{"tipo_evento": "LOGIN_EXITOSO", "horario_inicio": "07:00", "horario_fin": "20:00"}',
    1,
    NULL,
    'Usuario {usuario} accedió al sistema fuera del horario laboral a las {hora}.',
    1
),
(
    'Cambios Masivos de Datos',
    'Detecta cuando un usuario realiza muchas modificaciones en poco tiempo',
    'CAMBIOS_MASIVOS',
    'CRITICO',
    '{"tipo_evento": "ACTUALIZAR_REGISTRO", "agrupar_por": "usuario_id"}',
    20,
    30,
    'El usuario {usuario} ha realizado {cantidad} modificaciones en los últimos {tiempo} minutos.',
    1
);
```

---

## Índices

```sql
CREATE INDEX idx_logs_fecha_evento ON LOGS_AUDITORIA(fecha_evento);
CREATE INDEX idx_logs_fecha_hora ON LOGS_AUDITORIA(fecha_hora);
CREATE INDEX idx_logs_usuario_fecha ON LOGS_AUDITORIA(usuario_id, fecha_evento);
CREATE INDEX idx_logs_tipo_categoria ON LOGS_AUDITORIA(tipo_evento, categoria);
CREATE INDEX idx_logs_modulo_accion ON LOGS_AUDITORIA(modulo, accion);
CREATE INDEX idx_logs_recurso ON LOGS_AUDITORIA(recurso_tipo, recurso_id);
CREATE INDEX idx_logs_nivel_criticidad ON LOGS_AUDITORIA(nivel_criticidad);
CREATE INDEX idx_logs_resultado ON LOGS_AUDITORIA(resultado);
CREATE INDEX idx_logs_numero_secuencia ON LOGS_AUDITORIA(numero_secuencia);
CREATE INDEX idx_logs_hash_integridad ON LOGS_AUDITORIA(hash_integridad);
```

---

## Notas de Implementación

1. **Inmutabilidad**: Los logs no pueden ser modificados ni eliminados
2. **Integridad**: Cada log tiene un hash que depende del hash anterior (cadena de bloques)
3. **Verificación**: Se puede verificar la integridad de los logs en cualquier momento
4. **Retención**: Los logs se retienen según políticas de cumplimiento
5. **Alertas**: El sistema genera alertas automáticas basadas en patrones
6. **Rendimiento**: Índices optimizados para consultas frecuentes
7. **Cumplimiento**: Diseñado para cumplir con regulaciones médicas (HIPAA)
