# Documentación Técnica - EcoDigital/EcosSecial

**Versión:** 2.0  
**Sistema:** HealthTech para Entornos Quirúrgicos Inteligentes  
**Última actualización:** Marzo 2026

---

## Índice de Documentación

### Documentación Unificada

- [Documentación Técnica Unificada](./DOCUMENTACION_TECNICA_UNIFICADA.md) - Documento completo con toda la información técnica del sistema

---

## Módulos Funcionales

| Documento                                           | Descripción                                               |
| --------------------------------------------------- | --------------------------------------------------------- |
| [Autenticación y Usuarios](./modulos/auth.md)       | Sistema de autenticación JWT, roles, permisos y sesiones  |
| [Pacientes](./modulos/pacientes.md)                 | Gestión de pacientes, datos demográficos y médicos        |
| [Citas](./modulos/citas.md)                         | Programación de citas, horarios y conflictos              |
| [Historial Clínico](./modulos/historial-clinico.md) | Registros médicos, signos vitales y diagnósticos CIE-10   |
| [Documentos](./modulos/documentos.md)               | Gestión documental, almacenamiento en la nube y versiones |
| [Dashboard](./modulos/dashboard.md)                 | Métricas, estadísticas y KPIs del sistema                 |
| [Auditoría y Logs](./modulos/auditoria.md)          | Sistema WORM de logs inmutables y alertas                 |
| [Asistente IA (AVI)](./modulos/asistente-ia.md)     | Integración con Google Cloud Vertex AI                    |
| [Sidebar y Navegación](./modulos/sidebar.md)        | Arquitectura de información y componentes UI              |

---

## Infraestructura

| Documento                                        | Descripción                                                    |
| ------------------------------------------------ | -------------------------------------------------------------- |
| [Cloud (GCP)](./infraestructura/cloud.md)        | Despliegue en Google Cloud Platform, Cloud Run, Cloud SQL      |
| [Base de Datos](./infraestructura/base-datos.md) | PostgreSQL, esquemas, funciones, triggers y vistas             |
| [Seguridad](./infraestructura/seguridad.md)      | Autenticación, autorización, encriptación y cumplimiento HIPAA |

---

## Resumen del Sistema

### Stack Tecnológico

| Componente               | Tecnología                                                  |
| ------------------------ | ----------------------------------------------------------- |
| **Backend**              | Node.js, Express.js                                         |
| **Base de Datos**        | PostgreSQL 16                                               |
| **Frontend Web**         | Vue.js, Nuxt.js                                             |
| **Frontend Desktop**     | Electron                                                    |
| **Frontend Mobile**      | React Native                                                |
| **Editor de Documentos** | BlockSuite                                                  |
| **IA**                   | Google Cloud Vertex AI (Gemini 2.0 Flash Thinking)          |
| **Cloud**                | Google Cloud Platform (Cloud Run, Cloud SQL, Cloud Storage) |
| **Autenticación**        | JWT con refresh tokens                                      |

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Web     │  │ Desktop  │  │ Mobile   │  │ BlockSuite Editor │ │
└─────────────┴──┴──────────┴──┴──────────┴──┴──────────────────┴─┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (Express.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Rate Limiter│  │    CORS     │  │   Health Check Endpoint  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    MIDDLEWARE                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │ Auth (JWT)   │  │ RBAC         │  │ Audit Logger     │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICIOS DE NEGOCIO                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Appointment │  │  Patient    │  │  Vertex AI  │              │
│  │  Service    │  │  Service    │  │  Service    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE DATOS                              │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   PostgreSQL 16     │  │    Google Cloud Storage         │  │
│  │   (Cloud SQL)       │  │    (Documentos/Archivos)        │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Módulos Principales

1. **Autenticación y Usuarios** - Sistema RBAC con JWT
2. **Pacientes** - Gestión de información demográfica y médica
3. **Citas** - Programación con detección de conflictos
4. **Historial Clínico** - Registros médicos con códigos CIE-10
5. **Documentos** - Gestión documental con Cloud Storage
6. **Dashboard** - Métricas y estadísticas en tiempo real
7. **Auditoría** - Logs inmutables WORM
8. **Asistente IA** - Integración con Gemini 2.0

---

## Guías de Inicio

### Requisitos

- Node.js LTS
- Rust toolchain
- Yarn 4.x
- PostgreSQL 16
- Redis (opcional)

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/dogmablack/ecodigital

# Instalar dependencias
corepack enable
corepack prepare yarn@stable --activate
yarn install

# Compilar dependencias nativas
yarn ecodigital @ecodigital/native build
yarn ecodigital @ecodigital/server-native build

# Configurar base de datos
psql -U postgres -f _backend/Postgressql/*.sql

# Iniciar servidor
yarn dev
```

### Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME

# JWT
JWT_SECRET=tu-secreto-jwt
JWT_REFRESH_SECRET=tu-secreto-refresh

# Google Cloud
GOOGLE_CLOUD_PROJECT=tu-proyecto-id
GOOGLE_CLOUD_LOCATION=us-central1

# Redis
REDIS_SERVER_HOST=localhost
REDIS_SERVER_PORT=6379
```

---

## Referencias

- [Documentación de GCP](./gcp/README.md)
- [Construcción del proyecto](./BUILDING.md)
- [Desarrollo del servidor](./developing-server.md)
- [Auditoría del Sidebar](./ECOSSECIAL-v2-Sidebar-Audit.md)

---

## Contacto

Para más información sobre el sistema EcoDigital/EcosSecial, consulte la documentación técnica o contacte al equipo de desarrollo.
