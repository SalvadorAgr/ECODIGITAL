# Módulo de Dashboard

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El módulo de Dashboard proporciona métricas y estadísticas en tiempo real para la gestión del consultorio médico, incluyendo KPIs de pacientes, citas, documentos y actividad del sistema.

---

## Esquema de Base de Datos

### Tabla METRICAS_SISTEMA

```sql
CREATE TABLE IF NOT EXISTS METRICAS_SISTEMA (
    id BIGSERIAL PRIMARY KEY,

    -- Identificación de la métrica
    nombre_metrica VARCHAR(100) NOT NULL,
    categoria VARCHAR(15) NOT NULL CHECK (categoria IN (
        'RENDIMIENTO', 'SEGURIDAD', 'USUARIOS', 'DATOS',
        'SISTEMA', 'NEGOCIO', 'CUMPLIMIENTO'
    )),

    -- Valor de la métrica
    valor_numerico DECIMAL(15,4) NULL,
    valor_texto VARCHAR(500) NULL,
    valor_json JSONB NULL,
    unidad_medida VARCHAR(20) NULL,

    -- Información temporal
    fecha_metrica TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    periodo_agregacion VARCHAR(15) NOT NULL DEFAULT 'INSTANTANEO'
        CHECK (periodo_agregacion IN ('INSTANTANEO', 'MINUTO', 'HORA', 'DIA', 'SEMANA', 'MES')),

    -- Contexto adicional
    etiquetas JSONB NULL,
    metadatos JSONB NULL,

    -- Información de origen
    origen_sistema VARCHAR(50) NOT NULL DEFAULT 'ecosecial',
    componente VARCHAR(50) NULL
);
```

---

## Métricas Principales

### Métricas de Negocio

| Métrica                  | Categoría | Descripción                                    | Unidad |
| ------------------------ | --------- | ---------------------------------------------- | ------ |
| `pacientes_total`        | NEGOCIO   | Total de pacientes registrados                 | count  |
| `pacientes_nuevos_mes`   | NEGOCIO   | Pacientes nuevos en el mes                     | count  |
| `pacientes_activos`      | NEGOCIO   | Pacientes con consultas en los últimos 6 meses | count  |
| `citas_hoy`              | NEGOCIO   | Citas programadas para hoy                     | count  |
| `citas_completadas_mes`  | NEGOCIO   | Citas completadas en el mes                    | count  |
| `citas_canceladas_mes`   | NEGOCIO   | Citas canceladas en el mes                     | count  |
| `citas_no_asistio_mes`   | NEGOCIO   | Citas donde el paciente no asistió             | count  |
| `consultas_urgentes_mes` | NEGOCIO   | Consultas de urgencia en el mes                | count  |
| `documentos_total`       | DATOS     | Total de documentos almacenados                | count  |
| `documentos_nuevos_mes`  | DATOS     | Documentos subidos en el mes                   | count  |

### Métricas de Usuarios

| Métrica                  | Categoría | Descripción                     | Unidad |
| ------------------------ | --------- | ------------------------------- | ------ |
| `usuarios_activos_total` | USUARIOS  | Total de usuarios activos       | count  |
| `usuarios_conectados`    | USUARIOS  | Usuarios conectados actualmente | count  |
| `sesiones_activas_total` | USUARIOS  | Sesiones activas en tiempo real | count  |
| `logins_exitosos_dia`    | USUARIOS  | Logins exitosos del día         | count  |
| `logins_fallidos_dia`    | SEGURIDAD | Intentos de login fallidos      | count  |

### Métricas de Sistema

| Métrica                     | Categoría   | Descripción                      | Unidad |
| --------------------------- | ----------- | -------------------------------- | ------ |
| `logs_generados_total`      | SISTEMA     | Logs generados por día           | count  |
| `alertas_activas_total`     | SEGURIDAD   | Alertas de seguridad activas     | count  |
| `tiempo_respuesta_promedio` | RENDIMIENTO | Tiempo promedio de respuesta API | ms     |
| `errores_sistema_dia`       | SISTEMA     | Errores del sistema por día      | count  |

---

## Endpoints de la API

### Obtener Dashboard Principal

```http
GET /api/dashboard
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "pacientes": {
      "total": 1250,
      "nuevos_mes": 45,
      "activos": 890,
      "crecimiento": 12.5
    },
    "citas": {
      "hoy": 15,
      "semana": 78,
      "mes": 312,
      "completadas_mes": 285,
      "canceladas_mes": 18,
      "no_asistio_mes": 9,
      "tasa_completacion": 91.3
    },
    "documentos": {
      "total": 5420,
      "nuevos_mes": 156,
      "tamano_total_mb": 12500
    },
    "usuarios": {
      "activos": 12,
      "conectados": 5,
      "sesiones_activas": 8
    },
    "alertas": {
      "citas_hoy": 15,
      "seguimientos_pendientes": 8,
      "alertas_seguridad": 0
    }
  }
}
```

### Obtener Métricas por Período

```http
GET /api/dashboard/metrics?period=month&category=NEGOCIO
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "period": "month",
    "category": "NEGOCIO",
    "metrics": [
      {
        "nombre_metrica": "pacientes_nuevos_mes",
        "valor": 45,
        "unidad": "count",
        "fecha": "2026-03-01"
      },
      {
        "nombre_metrica": "citas_completadas_mes",
        "valor": 285,
        "unidad": "count",
        "fecha": "2026-03-01"
      }
    ]
  }
}
```

### Obtener Estadísticas de Citas

```http
GET /api/dashboard/appointments/stats?from=2026-03-01&to=2026-03-31
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "total": 312,
    "by_status": {
      "PROGRAMADA": 15,
      "CONFIRMADA": 8,
      "EN_CURSO": 2,
      "COMPLETADA": 285,
      "CANCELADA": 18,
      "NO_ASISTIO": 9
    },
    "by_type": {
      "CONSULTA_GENERAL": 180,
      "PRIMERA_VEZ": 45,
      "SEGUIMIENTO": 52,
      "CONTROL": 20,
      "CIRUGIA": 5,
      "POST_OPERATORIO": 8,
      "URGENCIA": 2
    },
    "by_day": [
      { "date": "2026-03-01", "count": 12 },
      { "date": "2026-03-02", "count": 15 }
    ]
  }
}
```

### Obtener Actividad Reciente

```http
GET /api/dashboard/activity?limit=20
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": 1,
        "tipo": "CITA_CREADA",
        "descripcion": "Nueva cita creada para Juan Pérez",
        "usuario": "Dr. Joel Sánchez",
        "fecha": "2026-03-20T10:30:00Z"
      },
      {
        "id": 2,
        "tipo": "PACIENTE_ACTUALIZADO",
        "descripcion": "Información de paciente actualizada",
        "usuario": "Asistente María",
        "fecha": "2026-03-20T10:25:00Z"
      }
    ]
  }
}
```

---

## Componentes del Dashboard

### Estructura de Componentes

```typescript
interface DashboardComponents {
  atoms: {
    StatCard: 'Tarjeta de estadística individual';
    TrendIndicator: 'Indicador de tendencia (↑↓→)';
    AlertBadge: 'Badge de alerta con contador';
    StatusDot: 'Punto de estado (activo/inactivo)';
  };
  molecules: {
    QuickStatPanel: 'Panel de estadísticas rápidas';
    PatientContextCard: 'Tarjeta de contexto de paciente';
    NotificationPreview: 'Vista previa de notificaciones';
    ActivityItem: 'Elemento de actividad reciente';
  };
  organisms: {
    DashboardGrid: 'Grid principal del dashboard';
    ActivityFeed: 'Feed de actividades recientes';
    QuickActionsBar: 'Barra de acciones rápidas';
    MetricsOverview: 'Resumen de métricas';
  };
}
```

### Componente StatCard

```typescript
interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

// Ejemplo de uso
<StatCard
  title="Pacientes Hoy"
  value={15}
  unit="citas"
  trend="up"
  trendValue={12.5}
  icon="calendar"
  color="primary"
/>
```

### Componente QuickStatPanel

```typescript
interface QuickStatPanelProps {
  stats: Array<{
    label: string;
    value: number;
    icon: string;
    color: string;
  }>;
  columns?: 2 | 3 | 4;
}

// Ejemplo de uso
<QuickStatPanel
  stats={[
    { label: 'Pacientes', value: 1250, icon: 'users', color: '#4CAF50' },
    { label: 'Citas Hoy', value: 15, icon: 'calendar', color: '#2196F3' },
    { label: 'Documentos', value: 5420, icon: 'file', color: '#FF9800' },
    { label: 'Alertas', value: 3, icon: 'bell', color: '#F44336' }
  ]}
  columns={4}
/>
```

---

## Servicio de Dashboard

```javascript
// _backend/services/dashboardService.js

class DashboardService {
  async getMainDashboard() {
    const [pacientesTotal, pacientesNuevosMes, pacientesActivos, citasHoy, citasCompletadasMes, documentosTotal, usuariosActivos, alertasPendientes] = await Promise.all([this.getPacientesTotal(), this.getPacientesNuevosMes(), this.getPacientesActivos(), this.getCitasHoy(), this.getCitasCompletadasMes(), this.getDocumentosTotal(), this.getUsuariosActivos(), this.getAlertasPendientes()]);

    return {
      pacientes: {
        total: pacientesTotal,
        nuevos_mes: pacientesNuevosMes,
        activos: pacientesActivos,
      },
      citas: {
        hoy: citasHoy.total,
        completadas_mes: citasCompletadasMes,
      },
      documentos: {
        total: documentosTotal,
      },
      usuarios: {
        activos: usuariosActivos,
      },
      alertas: alertasPendientes,
    };
  }

  async getPacientesTotal() {
    const { rows } = await pool.query('SELECT COUNT(*) as total FROM PACIENTES WHERE activo = TRUE');
    return parseInt(rows[0].total);
  }

  async getPacientesNuevosMes() {
    const { rows } = await pool.query(`
            SELECT COUNT(*) as total 
            FROM PACIENTES 
            WHERE activo = TRUE 
            AND DATE_TRUNC('month', fecha_creacion) = DATE_TRUNC('month', CURRENT_DATE)
        `);
    return parseInt(rows[0].total);
  }

  async getPacientesActivos() {
    const { rows } = await pool.query(`
            SELECT COUNT(DISTINCT p.id) as total
            FROM PACIENTES p
            JOIN HISTORIAL_CLINICO h ON p.id = h.id_paciente
            WHERE p.activo = TRUE
            AND h.fecha_hora >= CURRENT_DATE - INTERVAL '6 months'
        `);
    return parseInt(rows[0].total);
  }

  async getCitasHoy() {
    const { rows } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'PROGRAMADA' THEN 1 END) as programadas,
                COUNT(CASE WHEN estado = 'CONFIRMADA' THEN 1 END) as confirmadas,
                COUNT(CASE WHEN estado = 'EN_CURSO' THEN 1 END) as en_curso,
                COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) as completadas
            FROM CITAS
            WHERE DATE(fecha_hora) = CURRENT_DATE
            AND activo = TRUE
        `);
    return rows[0];
  }

  async getCitasCompletadasMes() {
    const { rows } = await pool.query(`
            SELECT COUNT(*) as total
            FROM CITAS
            WHERE estado = 'COMPLETADA'
            AND DATE_TRUNC('month', fecha_hora) = DATE_TRUNC('month', CURRENT_DATE)
            AND activo = TRUE
        `);
    return parseInt(rows[0].total);
  }

  async getDocumentosTotal() {
    const { rows } = await pool.query('SELECT COUNT(*) as total FROM DOCUMENTOS WHERE activo = TRUE');
    return parseInt(rows[0].total);
  }

  async getUsuariosActivos() {
    const { rows } = await pool.query(`
            SELECT COUNT(DISTINCT usuario_id) as total
            FROM SESIONES_USUARIO
            WHERE activa = TRUE
            AND fecha_expiracion > CURRENT_TIMESTAMP
        `);
    return parseInt(rows[0].total);
  }

  async getAlertasPendientes() {
    const { rows } = await pool.query(`
            SELECT 
                COUNT(CASE WHEN requiere_seguimiento = TRUE THEN 1 END) as seguimientos,
                COUNT(CASE WHEN urgente = TRUE THEN 1 END) as urgentes
            FROM HISTORIAL_CLINICO
            WHERE activo = TRUE
            AND (requiere_seguimiento = TRUE OR urgente = TRUE)
        `);
    return rows[0];
  }

  async getAppointmentStats(from, to) {
    const { rows } = await pool.query(
      `
            SELECT 
                estado,
                tipo_cita,
                DATE(fecha_hora) as fecha,
                COUNT(*) as total
            FROM CITAS
            WHERE DATE(fecha_hora) BETWEEN $1 AND $2
            AND activo = TRUE
            GROUP BY estado, tipo_cita, DATE(fecha_hora)
            ORDER BY DATE(fecha_hora)
        `,
      [from, to]
    );

    return this.aggregateStats(rows);
  }

  aggregateStats(rows) {
    const byStatus = {};
    const byType = {};
    const byDay = [];

    rows.forEach(row => {
      // Por estado
      byStatus[row.estado] = (byStatus[row.estado] || 0) + parseInt(row.total);

      // Por tipo
      byType[row.tipo_cita] = (byType[row.tipo_cita] || 0) + parseInt(row.total);

      // Por día
      const dayEntry = byDay.find(d => d.date === row.fecha);
      if (dayEntry) {
        dayEntry.count += parseInt(row.total);
      } else {
        byDay.push({ date: row.fecha, count: parseInt(row.total) });
      }
    });

    return {
      total: rows.reduce((sum, row) => sum + parseInt(row.total), 0),
      by_status: byStatus,
      by_type: byType,
      by_day: byDay,
    };
  }
}

module.exports = new DashboardService();
```

---

## Vista de Dashboard de Auditoría

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

---

## Índices

```sql
CREATE INDEX idx_metricas_nombre_fecha ON METRICAS_SISTEMA(nombre_metrica, fecha_metrica);
CREATE INDEX idx_metricas_categoria_fecha ON METRICAS_SISTEMA(categoria, fecha_metrica);
CREATE INDEX idx_metricas_periodo_fecha ON METRICAS_SISTEMA(periodo_agregacion, fecha_metrica);
CREATE INDEX idx_metricas_origen_componente ON METRICAS_SISTEMA(origen_sistema, componente);
```

---

## Datos Iniciales de Métricas

```sql
INSERT INTO METRICAS_SISTEMA (
    nombre_metrica, categoria, valor_numerico, unidad_medida,
    periodo_agregacion, origen_sistema
) VALUES
('usuarios_activos_total', 'USUARIOS', 0, 'count', 'DIA', 'ecosecial'),
('sesiones_activas_total', 'USUARIOS', 0, 'count', 'INSTANTANEO', 'ecosecial'),
('logs_generados_total', 'SISTEMA', 0, 'count', 'DIA', 'ecosecial'),
('alertas_activas_total', 'SEGURIDAD', 0, 'count', 'INSTANTANEO', 'ecosecial');
```

---

## Notas de Implementación

1. **Caché**: Las métricas se cachean por 5 minutos para mejorar rendimiento
2. **Actualización**: Las métricas se actualizan mediante triggers en las tablas principales
3. **Agregación**: Los datos históricos se agregan por día, semana y mes
4. **Tiempo Real**: Las métricas de usuarios conectados se actualizan en tiempo real
5. **Exportación**: Los datos del dashboard pueden exportarse a PDF/Excel
6. **Permisos**: El acceso al dashboard requiere permisos de lectura
