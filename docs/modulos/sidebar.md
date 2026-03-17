# Sidebar y Navegación

**Versión:** 2.0  
**Sistema:** EcoDigital/EcosSecial  
**Última actualización:** Marzo 2026

---

## Descripción

El sidebar implementa una arquitectura de información optimizada para entornos quirúrgicos con acceso rápido a funciones críticas, siguiendo principios de diseño centrado en el humano y cumplimiento HIPAA.

---

## Estructura del Sidebar

### Estructura Actual

```
Sidebar ECOSSECIAL v2
├── 🏠 Quick Actions
│   ├── Quick Search (Búsqueda global)
│   └── Journal (Notas rápidas)
│
├── 📋 Operations (Módulos Operativos)
│   ├── Tareas (Gestión de tareas)
│   ├── Agenda (Citas y programación)
│   ├── Calendario (Vista temporal)
│   └── Métricas (Reportes y KPIs)
│
├── 🛠️ Tools (Herramientas Clínicas)
│   ├── VolView 3D (Imágenes médicas)
│   ├── AI Workflow (Asistente inteligente)
│   └── Sterling PDF (Documentos)
│
├── ⭐ Favorites (Accesos rápidos personalizados)
│   └── [Dynamic based on user]
│
├── 📁 Organize (Organización de documentos)
│   └── [Dynamic folders and tags]
│
├── 🏷️ Tags (Etiquetas de clasificación)
│   └── [Dynamic tags]
│
├── 📚 Collections (Colecciones de documentos)
│   └── [Dynamic collections]
│
├── ⚙️ System (Configuración del sistema)
│   ├── Settings (Configuración general)
│   ├── Cloud (Sincronización)
│   ├── Archivos (Gestión de archivos)
│   └── Registros (Logs y auditoría)
│
└── 🗑️ Others (Funciones adicionales)
    ├── Trash (Papelera)
    ├── Import (Importar datos)
    ├── Invite (Invitar usuarios)
    └── Templates (Plantillas)
```

### Estructura Optimizada para Entorno Quirúrgico

```
Sidebar ECOSSECIAL v2 (Optimizado)
├── 🚨 CRITICAL (Acceso Inmediato - Siempre Visible)
│   ├── Dashboard (Métricas críticas)
│   ├── Pacientes (Búsqueda rápida)
│   └── Emergencias (Alertas activas)
│
├── 📅 CLINICAL (Flujo Clínico Principal)
│   ├── Agenda Quirúrgica (Citas del día)
│   ├── Historial Clínico (Expedientes)
│   ├── VolView 3D (Imágenes)
│   └── AI Workflow (Asistencia IA)
│
├── 📊 MANAGEMENT (Gestión Administrativa)
│   ├── Tareas (Pendientes)
│   ├── Métricas (Reportes)
│   ├── Sterling PDF (Documentos)
│   └── Archivos (Gestión)
│
├── ⭐ QUICK ACCESS (Personalizado)
│   ├── Favorites
│   ├── Recent Patients
│   └── Pinned Documents
│
└── ⚙️ SYSTEM (Configuración)
    ├── Settings
    ├── Cloud
    ├── Registros
    └── Help & Support
```

---

## Módulos Principales

### Dashboard (Executive Dashboard)

| Componente          | Tipo      | Descripción                       |
| ------------------- | --------- | --------------------------------- |
| StatCard            | Átomo     | Tarjeta de estadística individual |
| TrendIndicator      | Átomo     | Indicador de tendencia (↑↓→)      |
| AlertBadge          | Átomo     | Badge de alerta con contador      |
| StatusDot           | Átomo     | Punto de estado (activo/inactivo) |
| QuickStatPanel      | Molécula  | Panel de estadísticas rápidas     |
| PatientContextCard  | Molécula  | Tarjeta de contexto de paciente   |
| NotificationPreview | Molécula  | Vista previa de notificaciones    |
| ActivityItem        | Molécula  | Elemento de actividad reciente    |
| DashboardGrid       | Organismo | Grid principal del dashboard      |
| ActivityFeed        | Organismo | Feed de actividades recientes     |
| QuickActionsBar     | Organismo | Barra de acciones rápidas         |
| MetricsOverview     | Organismo | Resumen de métricas               |

### Gestión de Pacientes (Master-Detail CRUD)

| Componente             | Tipo      | Descripción                           |
| ---------------------- | --------- | ------------------------------------- |
| SearchInput            | Átomo     | Campo de búsqueda con autocompletado  |
| FilterChip             | Átomo     | Chip de filtro seleccionable          |
| AvatarBadge            | Átomo     | Avatar con badge de estado            |
| StatusTag              | Átomo     | Etiqueta de estado del paciente       |
| PatientCard            | Molécula  | Tarjeta resumen de paciente           |
| SearchFilters          | Molécula  | Panel de filtros de búsqueda          |
| PatientSummary         | Molécula  | Resumen rápido del paciente           |
| EmergencyContactBadge  | Molécula  | Badge de contacto de emergencia       |
| PatientList            | Organismo | Lista de pacientes con virtualización |
| PatientProfileView     | Organismo | Vista detallada del paciente          |
| MedicalAlertsPanel     | Organismo | Panel de alertas médicas              |
| PatientHistoryTimeline | Organismo | Línea temporal del paciente           |

### Agenda Quirúrgica (Calendar-Centric Timeline)

| Componente             | Tipo      | Descripción                     |
| ---------------------- | --------- | ------------------------------- |
| TimeSlot               | Átomo     | Ranura de tiempo en calendario  |
| AppointmentBadge       | Átomo     | Badge de tipo de cita           |
| UrgencyIndicator       | Átomo     | Indicador de urgencia           |
| RoomTag                | Átomo     | Etiqueta de sala de consulta    |
| DayScheduleView        | Molécula  | Vista de día del calendario     |
| WeekCalendar           | Molécula  | Calendario semanal              |
| AppointmentCard        | Molécula  | Tarjeta de cita                 |
| ConflictWarning        | Molécula  | Advertencia de conflicto        |
| SurgicalCalendar       | Organismo | Calendario quirúrgico principal |
| AvailabilityGrid       | Organismo | Grid de disponibilidad          |
| ResourceScheduler      | Organismo | Programador de recursos         |
| AppointmentDetailPanel | Organismo | Panel de detalles de cita       |

### Historial Clínico (Timeline-Structured Record)

| Componente              | Tipo      | Descripción                 |
| ----------------------- | --------- | --------------------------- |
| DiagnosisTag            | Átomo     | Etiqueta de diagnóstico     |
| VitalSignBadge          | Átomo     | Badge de signo vital        |
| MedicationChip          | Átomo     | Chip de medicamento         |
| AttachmentIcon          | Átomo     | Icono de archivo adjunto    |
| ConsultationCard        | Molécula  | Tarjeta de consulta         |
| VitalSignsPanel         | Molécula  | Panel de signos vitales     |
| PrescriptionList        | Molécula  | Lista de prescripciones     |
| LabResultsPreview       | Molécula  | Vista previa de resultados  |
| ClinicalTimeline        | Organismo | Línea temporal de consultas |
| PatientHistoryAccordion | Organismo | Acordeón de historial       |
| DiagnosticCodeSearch    | Organismo | Búsqueda de códigos CIE-10  |

---

## Patrones de Interacción HIPAA

### Principios de Diseño

| Principio                    | Implementación en UI                               | Componentes Afectados               |
| ---------------------------- | -------------------------------------------------- | ----------------------------------- |
| **Minimización de Datos**    | Mostrar solo información esencial por defecto      | PatientCard, ClinicalTimeline       |
| **Control de Acceso**        | Indicadores visuales de permisos y restricciones   | PermissionBadge, UserRoleTag        |
| **Auditoría de Acciones**    | Registro automático de visualizaciones y ediciones | AuditLog, ActivityFeed              |
| **Encriptación Visual**      | Indicadores de datos encriptados/transmitidos      | EncryptionBadge, SecureTransferIcon |
| **Consentimiento Explícito** | Diálogos de confirmación para acciones sensibles   | ConsentDialog, ConfirmationModal    |

### Patrón de Confirmación Doble para Eliminación

```
[DELETE ACTION] → [CONFIRMATION DIALOG] → [TYPE CONFIRMATION TEXT] → [FINAL CONFIRM]
```

**Aplicación:** Eliminación de pacientes, historial clínico, citas

**Justificación:** Previene pérdida accidental de datos médicos críticos

### Patrón de Búsqueda con Autocompletado

```
[SEARCH INPUT] → [SUGGESTIONS DROPDOWN] → [QUICK PREVIEW] → [SELECTION]
```

**Aplicación:** Búsqueda de pacientes, médicos, códigos CIE-10

**Justificación:** Reduce errores de entrada y acelera selección en situaciones de presión

### Patrón de Alerta Médica Prominente

```
[ALERT ICON] + [COLOR CODE] + [BRIEF TEXT] + [EXPANDABLE DETAILS]
```

**Aplicación:** Alergias, condiciones médicas críticas, medicamentos incompatibles

**Justificación:** Visibilidad inmediata de información crítica para seguridad del paciente

### Patrón de Guardado Automático con Indicador

```
[EDIT] → [AUTO-SAVE TRIGGER] → [SAVING INDICATOR] → [SAVED CONFIRMATION]
```

**Aplicación:** Formularios de historial clínico, notas médicas

**Justificación:** Previene pérdida de datos en interrupciones (emergencias, cortes de energía)

---

## Mitigación de Carga Cognitiva

| Estrategia                    | Implementación                                                             | Impacto Esperado                                      |
| ----------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Agrupación Lógica**         | Módulos organizados por contexto de uso (crítico, clínico, administrativo) | Reduce tiempo de búsqueda de funciones en 40%         |
| **Progresión de Información** | Resumen → Detalle → Acción en cada módulo                                  | Facilita toma de decisiones en situaciones de presión |
| **Consistencia Visual**       | Patrones de color y tipografía uniformes                                   | Reduce curva de aprendizaje para nuevos usuarios      |
| **Feedback Inmediato**        | Indicadores de estado en tiempo real                                       | Previene errores por incertidumbre del sistema        |
| **Atajos de Teclado**         | Comandos rápidos para acciones frecuentes                                  | Acelera operaciones en 60% para usuarios avanzados    |

---

## Usabilidad Bajo Presión

| Escenario             | Solución de UI                                                 | Componente                          |
| --------------------- | -------------------------------------------------------------- | ----------------------------------- |
| **Emergencia Médica** | Botón de emergencia siempre visible, acceso directo a paciente | EmergencyButton, QuickPatientAccess |
| **Cita Urgente**      | Indicadores visuales de urgencia (color rojo, icono de alerta) | UrgencyIndicator, PriorityBadge     |
| **Error de Sistema**  | Mensajes claros con opciones de recuperación                   | ErrorRecoveryDialog, RetryButton    |
| **Interrupción**      | Guardado automático con indicador de progreso                  | AutoSaveIndicator, DraftRecovery    |
| **Múltiples Tareas**  | Vista dividida y cambio rápido de contexto                     | SplitView, ContextSwitcher          |

---

## Accesibilidad y Cumplimiento

| Requisito                  | Implementación                               | Estándar         |
| -------------------------- | -------------------------------------------- | ---------------- |
| **Contraste de Color**     | Ratio mínimo 4.5:1 para texto, 3:1 para UI   | WCAG 2.1 AA      |
| **Navegación por Teclado** | Todos los elementos accesibles con Tab/Enter | WCAG 2.1 AA      |
| **Lectores de Pantalla**   | Etiquetas ARIA descriptivas                  | WCAG 2.1 AA      |
| **Tamaño de Fuente**       | Mínimo 16px, escalable hasta 200%            | WCAG 2.1 AA      |
| **Tiempo de Respuesta**    | Indicadores de carga para operaciones > 1s   | UX Best Practice |

---

## Métricas de Éxito

### Métricas de Usabilidad

| Métrica                            | Objetivo      | Método de Medición     |
| ---------------------------------- | ------------- | ---------------------- |
| **Tiempo de Búsqueda de Paciente** | < 5 segundos  | Analytics de búsqueda  |
| **Tiempo de Creación de Cita**     | < 30 segundos | Tracking de flujo      |
| **Tasa de Error en Formularios**   | < 2%          | Logs de validación     |
| **Satisfacción del Usuario (SUS)** | > 85/100      | Encuesta trimestral    |
| **Tiempo de Capacitación**         | < 2 horas     | Registro de onboarding |

### Métricas de Eficiencia Clínica

| Métrica                                | Objetivo                  | Impacto                |
| -------------------------------------- | ------------------------- | ---------------------- |
| **Reducción de Errores de Medicación** | 50% menos                 | Seguridad del paciente |
| **Tiempo de Acceso a Historial**       | < 3 segundos              | Eficiencia clínica     |
| **Detección de Conflictos de Cita**    | 100% en tiempo real       | Optimización de agenda |
| **Completitud de Registros**           | > 95% campos obligatorios | Calidad de datos       |

---

## Componentes TypeScript

### Dashboard Components

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

### Patient Management Components

```typescript
interface PatientManagementComponents {
  atoms: {
    SearchInput: 'Campo de búsqueda con autocompletado';
    FilterChip: 'Chip de filtro seleccionable';
    AvatarBadge: 'Avatar con badge de estado';
    StatusTag: 'Etiqueta de estado del paciente';
  };
  molecules: {
    PatientCard: 'Tarjeta resumen de paciente';
    SearchFilters: 'Panel de filtros de búsqueda';
    PatientSummary: 'Resumen rápido del paciente';
    EmergencyContactBadge: 'Badge de contacto de emergencia';
  };
  organisms: {
    PatientList: 'Lista de pacientes con virtualización';
    PatientProfileView: 'Vista detallada del paciente';
    MedicalAlertsPanel: 'Panel de alertas médicas';
    PatientHistoryTimeline: 'Línea temporal del paciente';
  };
}
```

### Surgical Agenda Components

```typescript
interface SurgicalAgendaComponents {
  atoms: {
    TimeSlot: 'Ranura de tiempo en calendario';
    AppointmentBadge: 'Badge de tipo de cita';
    UrgencyIndicator: 'Indicador de urgencia';
    RoomTag: 'Etiqueta de sala de consulta';
  };
  molecules: {
    DayScheduleView: 'Vista de día del calendario';
    WeekCalendar: 'Calendario semanal';
    AppointmentCard: 'Tarjeta de cita';
    ConflictWarning: 'Advertencia de conflicto';
  };
  organisms: {
    SurgicalCalendar: 'Calendario quirúrgico principal';
    AvailabilityGrid: 'Grid de disponibilidad';
    ResourceScheduler: 'Programador de recursos';
    AppointmentDetailPanel: 'Panel de detalles de cita';
  };
}
```

---

## Referencias de Diseño

- Nielsen Norman Group: Medical Interface Design Guidelines
- HIPAA Security Rule: Technical Safeguards
- Material Design: Data Tables & Forms
- Human Interface Guidelines: HealthKit

---

## Glosario de Términos

| Término    | Definición                                                |
| ---------- | --------------------------------------------------------- |
| **CIE-10** | Clasificación Internacional de Enfermedades, 10ª revisión |
| **DICOM**  | Digital Imaging and Communications in Medicine            |
| **HIPAA**  | Health Insurance Portability and Accountability Act       |
| **SUS**    | System Usability Scale                                    |
| **WCAG**   | Web Content Accessibility Guidelines                      |
| **WORM**   | Write Once Read Many                                      |
| **RBAC**   | Role-Based Access Control                                 |
