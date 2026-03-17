-- ============================================================================
-- MIGRACIÓN: 13_dashboard_principal_postgresql.sql
-- VERSIÓN: 2.0
-- SISTEMA: Ecodigital
-- DESCRIPCIÓN: Dashboard principal, widgets, métricas y configuraciones de usuario
-- FECHA: Marzo 2026
-- ============================================================================
-- ESTÁNDARES APLICADOS:
-- 1. Seguridad y Atomicidad: Transacciones explícitas con ROLLBACK automático
-- 2. Idempotencia: Uso de IF NOT EXISTS / IF EXISTS
-- 3. Gestión de Dependencias: Orden correcto de creación/eliminación
-- 4. Preservación de Datos: Lógica de respaldo cuando aplica
-- 5. Reversibilidad: Script DOWN incluido al final
-- ============================================================================
-- DEPENDENCIAS:
-- - Requiere: 01_usuarios_y_roles_postgresql.sql (tabla USUARIOS)
-- ============================================================================

-- ============================================================================
-- SECCIÓN UP: Creación de objetos
-- ============================================================================

BEGIN;

-- Verificar que las tablas dependientes existan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'usuarios' AND schemaname = 'public') THEN
        RAISE EXCEPTION 'Error: La tabla USUARIOS no existe. Ejecute primero 01_usuarios_y_roles_postgresql.sql';
    END IF;
END $$;

-- ============================================================================
-- DOMINIOS PERSONALIZADOS
-- ============================================================================

-- Dominio para tipo de widget
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_widget_type') THEN
        CREATE DOMAIN tipo_widget_type AS VARCHAR(30)
        CHECK (VALUE IN (
            'ESTADISTICA', 'GRAFICO_LINEA', 'GRAFICO_BARRA', 'GRAFICO_PASTEL',
            'TABLA', 'LISTA', 'CALENDARIO', 'MAPA', 'INDICADOR', 'CONTADOR',
            'NOTIFICACIONES', 'ACCESOS_RAPIDOS', 'ULTIMAS_ACCIONES', 'OTRO'
        ));
    END IF;
END $$;

-- Dominio para tamaño de widget
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tamano_widget_type') THEN
        CREATE DOMAIN tamano_widget_type AS VARCHAR(10)
        CHECK (VALUE IN ('PEQUENO', 'MEDIANO', 'GRANDE', 'EXTRA_GRANDE'));
    END IF;
END $$;

-- Dominio para período de tiempo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'periodo_tiempo_type') THEN
        CREATE DOMAIN periodo_tiempo_type AS VARCHAR(20)
        CHECK (VALUE IN ('HOY', 'AYER', 'SEMANA_ACTUAL', 'SEMANA_ANTERIOR', 'MES_ACTUAL', 'MES_ANTERIOR', 'TRIMESTRE', 'SEMESTRE', 'ANO_ACTUAL', 'ANO_ANTERIOR', 'PERSONALIZADO'));
    END IF;
END $$;

-- Dominio para tipo de métrica
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_metrica_type') THEN
        CREATE DOMAIN tipo_metrica_type AS VARCHAR(20)
        CHECK (VALUE IN ('CONTADOR', 'PROMEDIO', 'PORCENTAJE', 'TENDENCIA', 'COMPARATIVO'));
    END IF;
END $$;

-- Dominio para estado de widget
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_widget_type') THEN
        CREATE DOMAIN estado_widget_type AS VARCHAR(20)
        CHECK (VALUE IN ('ACTIVO', 'INACTIVO', 'OCULTO', 'ERROR'));
    END IF;
END $$;

-- Dominio para frecuencia de actualización
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frecuencia_actualizacion_type') THEN
        CREATE DOMAIN frecuencia_actualizacion_type AS VARCHAR(20)
        CHECK (VALUE IN ('TIEMPO_REAL', 'MINUTO', 'MINUTOS_5', 'MINUTOS_15', 'MINUTOS_30', 'HORA', 'DIA', 'MANUAL'));
    END IF;
END $$;

-- Dominio para tipo de gráfico
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_grafico_type') THEN
        CREATE DOMAIN tipo_grafico_type AS VARCHAR(20)
        CHECK (VALUE IN ('LINEA', 'AREA', 'BARRA', 'COLUMNA', 'PASTEL', 'DONA', 'RADAR', 'DISPERSION', 'CALOR', 'GAUGE'));
    END IF;
END $$;

-- ============================================================================
-- TABLA: WIDGETS
-- Descripción: Definición de widgets disponibles para el dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS WIDGETS (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(50) NOT NULL,
    tipo tipo_widget_type NOT NULL,
    
    -- Configuración
    tamano_default tamano_widget_type NOT NULL DEFAULT 'MEDIANO',
    icono VARCHAR(50),
    color VARCHAR(20),
    
    -- Consulta y datos
    consulta_sql TEXT,
    endpoint_api VARCHAR(255),
    parametros JSONB DEFAULT '{}',
    transformacion_datos JSONB DEFAULT '{}',
    
    -- Visualización
    configuracion_visualizacion JSONB DEFAULT '{}',
    campos_requeridos JSONB DEFAULT '[]',
    
    -- Permisos
    roles_permitidos JSONB DEFAULT '[]',
    permisos_requeridos JSONB DEFAULT '[]',
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    estado estado_widget_type NOT NULL DEFAULT 'ACTIVO',
    orden_visualizacion INTEGER DEFAULT 0,
    
    -- Actualización
    frecuencia_actualizacion frecuencia_actualizacion_type NOT NULL DEFAULT 'MINUTOS_5',
    cache_segundos INTEGER DEFAULT 300,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_widgets_codigo CHECK (LENGTH(TRIM(codigo)) >= 3),
    CONSTRAINT chk_widgets_nombre CHECK (LENGTH(TRIM(nombre)) >= 3)
);

-- Comentarios descriptivos
COMMENT ON TABLE WIDGETS IS 'Definición de widgets disponibles para el dashboard';
COMMENT ON COLUMN WIDGETS.consulta_sql IS 'Consulta SQL para obtener datos del widget';
COMMENT ON COLUMN WIDGETS.endpoint_api IS 'Endpoint de API alternativa para obtener datos';
COMMENT ON COLUMN WIDGETS.parametros IS 'JSONB con parámetros configurables del widget';
COMMENT ON COLUMN WIDGETS.configuracion_visualizacion IS 'JSONB con configuración de visualización (colores, ejes, etc.)';

-- ============================================================================
-- TABLA: DASHBOARD_USUARIO
-- Descripción: Configuración de dashboard por usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS DASHBOARD_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL,
    
    -- Configuración general
    nombre VARCHAR(100) DEFAULT 'Mi Dashboard',
    descripcion TEXT,
    tema VARCHAR(20) DEFAULT 'CLARO' CHECK (tema IN ('CLARO', 'OSCURO', 'AUTO')),
    layout VARCHAR(20) DEFAULT 'GRID' CHECK (layout IN ('GRID', 'FLEX', 'FREE')),
    
    -- Configuración de columnas
    columnas INTEGER DEFAULT 3,
    ancho_columna INTEGER DEFAULT 400,
    
    -- Filtros globales
    filtros_globales JSONB DEFAULT '{}',
    periodo_default periodo_tiempo_type NOT NULL DEFAULT 'MES_ACTUAL',
    
    -- Configuración de actualización
    actualizacion_automatica BOOLEAN DEFAULT TRUE,
    intervalo_actualizacion INTEGER DEFAULT 300,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    es_default BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dashboard_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT chk_dashboard_columnas CHECK (columnas >= 1 AND columnas <= 6)
);

-- Comentarios descriptivos
COMMENT ON TABLE DASHBOARD_USUARIO IS 'Configuración personalizada de dashboard por usuario';
COMMENT ON COLUMN DASHBOARD_USUARIO.filtros_globales IS 'JSONB con filtros aplicados a todos los widgets';

-- ============================================================================
-- TABLA: WIDGETS_DASHBOARD
-- Descripción: Relación entre widgets y dashboards de usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS WIDGETS_DASHBOARD (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL,
    widget_id INTEGER NOT NULL,
    
    -- Posición
    posicion_x INTEGER NOT NULL DEFAULT 0,
    posicion_y INTEGER NOT NULL DEFAULT 0,
    ancho INTEGER NOT NULL DEFAULT 1,
    alto INTEGER NOT NULL DEFAULT 1,
    
    -- Configuración específica
    titulo VARCHAR(100),
    configuracion JSONB DEFAULT '{}',
    filtros JSONB DEFAULT '{}',
    
    -- Estado
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    colapsado BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER DEFAULT 0,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_widgets_dashboard_dashboard FOREIGN KEY (dashboard_id) 
        REFERENCES DASHBOARD_USUARIO(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT fk_widgets_dashboard_widget FOREIGN KEY (widget_id) 
        REFERENCES WIDGETS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT uq_widgets_dashboard UNIQUE (dashboard_id, widget_id),
    CONSTRAINT chk_widgets_dashboard_posicion CHECK (posicion_x >= 0 AND posicion_y >= 0),
    CONSTRAINT chk_widgets_dashboard_tamano CHECK (ancho >= 1 AND alto >= 1)
);

-- Comentarios descriptivos
COMMENT ON TABLE WIDGETS_DASHBOARD IS 'Relación entre widgets y dashboards de usuario con configuración específica';

-- ============================================================================
-- TABLA: METRICAS_DASHBOARD
-- Descripción: Métricas predefinidas para el dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS METRICAS_DASHBOARD (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(50) NOT NULL,
    
    -- Tipo y cálculo
    tipo tipo_metrica_type NOT NULL,
    consulta_sql TEXT NOT NULL,
    parametros JSONB DEFAULT '{}',
    
    -- Formato
    formato VARCHAR(20) DEFAULT 'NUMERO' CHECK (formato IN ('NUMERO', 'MONEDA', 'PORCENTAJE', 'TIEMPO', 'FECHA')),
    decimales INTEGER DEFAULT 0,
    prefijo VARCHAR(10),
    sufijo VARCHAR(10),
    
    -- Comparación
    mostrar_comparacion BOOLEAN DEFAULT TRUE,
    periodo_comparacion periodo_tiempo_type DEFAULT 'MES_ANTERIOR',
    
    -- Tendencia
    mostrar_tendencia BOOLEAN DEFAULT TRUE,
    periodo_tendencia INTEGER DEFAULT 7,
    
    -- Umbrales
    umbral_warning DECIMAL(20,6),
    umbral_critical DECIMAL(20,6),
    umbral_warning_porcentaje DECIMAL(5,2),
    umbral_critical_porcentaje DECIMAL(5,2),
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_metricas_codigo CHECK (LENGTH(TRIM(codigo)) >= 3)
);

-- Comentarios descriptivos
COMMENT ON TABLE METRICAS_DASHBOARD IS 'Métricas predefinidas para mostrar en el dashboard';
COMMENT ON COLUMN METRICAS_DASHBOARD.consulta_sql IS 'Consulta SQL para calcular la métrica';
COMMENT ON COLUMN METRICAS_DASHBOARD.umbral_warning IS 'Umbral para mostrar advertencia';

-- ============================================================================
-- TABLA: VALORES_METRICAS
-- Descripción: Valores calculados de métricas (cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS VALORES_METRICAS (
    id BIGSERIAL PRIMARY KEY,
    metrica_id INTEGER NOT NULL,
    
    -- Valores
    valor_actual DECIMAL(20,6) NOT NULL,
    valor_anterior DECIMAL(20,6),
    valor_tendencia DECIMAL(20,6),
    variacion_porcentaje DECIMAL(10,4),
    
    -- Período
    periodo_inicio TIMESTAMP WITH TIME ZONE,
    periodo_fin TIMESTAMP WITH TIME ZONE,
    periodo_referencia VARCHAR(20),
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'OK' CHECK (estado IN ('OK', 'WARNING', 'CRITICAL', 'ERROR')),
    
    -- Cache
    fecha_calculo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_valores_metrica FOREIGN KEY (metrica_id) 
        REFERENCES METRICAS_DASHBOARD(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE VALORES_METRICAS IS 'Valores calculados de métricas con cache para rendimiento';

-- ============================================================================
-- TABLA: GRAFICOS_DASHBOARD
-- Descripción: Configuración de gráficos para el dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS GRAFICOS_DASHBOARD (
    id SERIAL PRIMARY KEY,
    
    -- Identificación
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(50) NOT NULL,
    
    -- Tipo de gráfico
    tipo_grafico tipo_grafico_type NOT NULL,
    
    -- Consulta
    consulta_sql TEXT NOT NULL,
    parametros JSONB DEFAULT '{}',
    
    -- Configuración de ejes
    eje_x VARCHAR(100),
    eje_y VARCHAR(100),
    eje_y_secundario VARCHAR(100),
    
    -- Configuración de series
    series JSONB DEFAULT '[]',
    colores JSONB DEFAULT '[]',
    
    -- Configuración de leyenda
    mostrar_leyenda BOOLEAN DEFAULT TRUE,
    posicion_leyenda VARCHAR(20) DEFAULT 'BOTTOM' CHECK (posicion_leyenda IN ('TOP', 'BOTTOM', 'LEFT', 'RIGHT')),
    
    -- Configuración de tooltip
    mostrar_tooltip BOOLEAN DEFAULT TRUE,
    formato_tooltip TEXT,
    
    -- Configuración de zoom
    zoom_habilitado BOOLEAN DEFAULT FALSE,
    scroll_habilitado BOOLEAN DEFAULT FALSE,
    
    -- Animación
    animacion_habilitada BOOLEAN DEFAULT TRUE,
    duracion_animacion INTEGER DEFAULT 1000,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_graficos_codigo CHECK (LENGTH(TRIM(codigo)) >= 3)
);

-- Comentarios descriptivos
COMMENT ON TABLE GRAFICOS_DASHBOARD IS 'Configuración de gráficos para el dashboard';
COMMENT ON COLUMN GRAFICOS_DASHBOARD.series IS 'Array JSONB con configuración de series del gráfico';
COMMENT ON COLUMN GRAFICOS_DASHBOARD.colores IS 'Array JSONB con colores para las series';

-- ============================================================================
-- TABLA: DATOGRAFICOS_DASHBOARD
-- Descripción: Datos cacheados para gráficos
-- ============================================================================

CREATE TABLE IF NOT EXISTS DATOGRAFICOS_DASHBOARD (
    id BIGSERIAL PRIMARY KEY,
    grafico_id INTEGER NOT NULL,
    
    -- Datos
    datos JSONB NOT NULL,
    etiquetas JSONB DEFAULT '[]',
    
    -- Período
    periodo_inicio TIMESTAMP WITH TIME ZONE,
    periodo_fin TIMESTAMP WITH TIME ZONE,
    
    -- Cache
    fecha_calculo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_datosgraficos_grafico FOREIGN KEY (grafico_id) 
        REFERENCES GRAFICOS_DASHBOARD(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE DATOGRAFICOS_DASHBOARD IS 'Datos cacheados para gráficos del dashboard';

-- ============================================================================
-- TABLA: ACCESOS_RAPIDOS
-- Descripción: Accesos rápidos personalizados por usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS ACCESOS_RAPIDOS (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    
    -- Información del acceso
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    url VARCHAR(500) NOT NULL,
    icono VARCHAR(50),
    color VARCHAR(20),
    
    -- Configuración
    orden INTEGER DEFAULT 0,
    abrir_nueva_ventana BOOLEAN DEFAULT FALSE,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_accesos_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE ACCESOS_RAPIDOS IS 'Accesos rápidos personalizados por usuario';

-- ============================================================================
-- TABLA: FAVORITOS_USUARIO
-- Descripción: Elementos favoritos del usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS FAVORITOS_USUARIO (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    
    -- Referencia
    tipo_elemento VARCHAR(30) NOT NULL CHECK (tipo_elemento IN ('PACIENTE', 'CITA', 'DOCUMENTO', 'REPORTE', 'WIDGET', 'OTRO')),
    elemento_id VARCHAR(36) NOT NULL,
    
    -- Información adicional
    nombre VARCHAR(200),
    datos JSONB DEFAULT '{}',
    
    -- Estado
    orden INTEGER DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_favoritos_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    CONSTRAINT uq_favoritos_usuario UNIQUE (usuario_id, tipo_elemento, elemento_id)
);

-- Comentarios descriptivos
COMMENT ON TABLE FAVORITOS_USUARIO IS 'Elementos marcados como favoritos por el usuario';

-- ============================================================================
-- TABLA: CONFIGURACION_DASHBOARD
-- Descripción: Configuración global del dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS CONFIGURACION_DASHBOARD (
    id SERIAL PRIMARY KEY,
    
    -- Configuración general
    nombre_sistema VARCHAR(100) DEFAULT 'Ecodigital',
    logo VARCHAR(255),
    favicon VARCHAR(255),
    
    -- Colores del tema
    color_primario VARCHAR(20) DEFAULT '#1976D2',
    color_secundario VARCHAR(20) DEFAULT '#424242',
    color_acento VARCHAR(20) DEFAULT '#FF4081',
    color_fondo VARCHAR(20) DEFAULT '#FAFAFA',
    
    -- Configuración de widgets
    widgets_por_fila INTEGER DEFAULT 3,
    alto_widget INTEGER DEFAULT 300,
    margen_widget INTEGER DEFAULT 16,
    
    -- Configuración de actualización
    actualizacion_automatica BOOLEAN DEFAULT TRUE,
    intervalo_actualizacion INTEGER DEFAULT 300,
    
    -- Configuración de notificaciones
    mostrar_notificaciones BOOLEAN DEFAULT TRUE,
    posicion_notificaciones VARCHAR(20) DEFAULT 'TOP_RIGHT' CHECK (posicion_notificaciones IN ('TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT')),
    
    -- Configuración de accesos rápidos
    mostrar_accesos_rapidos BOOLEAN DEFAULT TRUE,
    max_accesos_rapidos INTEGER DEFAULT 10,
    
    -- Configuración de métricas
    mostrar_tendencias BOOLEAN DEFAULT TRUE,
    mostrar_comparaciones BOOLEAN DEFAULT TRUE,
    
    -- Estado
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios descriptivos
COMMENT ON TABLE CONFIGURACION_DASHBOARD IS 'Configuración global del dashboard del sistema';

-- ============================================================================
-- TABLA: HISTORIAL_ACTIVIDADES
-- Descripción: Historial de actividades del usuario
-- ============================================================================

CREATE TABLE IF NOT EXISTS HISTORIAL_ACTIVIDADES (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    
    -- Información de la actividad
    tipo_actividad VARCHAR(50) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    -- Referencia
    referencia_tipo VARCHAR(50),
    referencia_id VARCHAR(36),
    
    -- Datos adicionales
    datos JSONB DEFAULT '{}',
    
    -- Contexto
    ip_address INET,
    user_agent TEXT,
    dispositivo VARCHAR(100),
    
    -- Timestamps
    fecha_actividad TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id) 
        REFERENCES USUARIOS(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE
);

-- Comentarios descriptivos
COMMENT ON TABLE HISTORIAL_ACTIVIDADES IS 'Historial de actividades del usuario para el dashboard';

-- ============================================================================
-- FUNCIONES ALMACENADAS
-- ============================================================================

-- Función para calcular métrica
CREATE OR REPLACE FUNCTION calcular_metrica(
    p_metrica_codigo VARCHAR(50),
    p_parametros JSONB DEFAULT '{}'
)
RETURNS DECIMAL(20,6) AS $$
DECLARE
    v_consulta TEXT;
    v_result DECIMAL(20,6);
    v_metrica RECORD;
BEGIN
    -- Obtener definición de la métrica
    SELECT * INTO v_metrica
    FROM METRICAS_DASHBOARD
    WHERE codigo = p_metrica_codigo
    AND activo = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Métrica no encontrada: %', p_metrica_codigo;
    END IF;
    
    -- Reemplazar parámetros en la consulta
    v_consulta := v_metrica.consulta_sql;
    
    -- Ejecutar consulta
    EXECUTE v_consulta INTO v_result;
    
    -- Guardar valor cacheado
    INSERT INTO VALORES_METRICAS (
        metrica_id, valor_actual, periodo_referencia,
        fecha_calculo, fecha_expiracion
    ) VALUES (
        v_metrica.id, v_result, 'ACTUAL',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_metrica IS 'Función para calcular el valor de una métrica';

-- Función para obtener widgets de usuario
CREATE OR REPLACE FUNCTION obtener_widgets_usuario(
    p_usuario_id INTEGER
)
RETURNS TABLE (
    id INTEGER,
    codigo VARCHAR(50),
    nombre VARCHAR(100),
    tipo tipo_widget_type,
    tamano_default tamano_widget_type,
    posicion_x INTEGER,
    posicion_y INTEGER,
    ancho INTEGER,
    alto INTEGER,
    titulo VARCHAR(100),
    configuracion JSONB,
    visible BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.codigo,
        w.nombre,
        w.tipo,
        w.tamano_default,
        wd.posicion_x,
        wd.posicion_y,
        wd.ancho,
        wd.alto,
        wd.titulo,
        wd.configuracion,
        wd.visible
    FROM WIDGETS w
    JOIN WIDGETS_DASHBOARD wd ON w.id = wd.widget_id
    JOIN DASHBOARD_USUARIO du ON wd.dashboard_id = du.id
    WHERE du.usuario_id = p_usuario_id
    AND du.activo = TRUE
    AND w.activo = TRUE
    AND wd.visible = TRUE
    ORDER BY wd.orden, wd.posicion_y, wd.posicion_x;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_widgets_usuario IS 'Función para obtener los widgets configurados de un usuario';

-- Función para agregar widget a dashboard
CREATE OR REPLACE FUNCTION agregar_widget_dashboard(
    p_usuario_id INTEGER,
    p_widget_codigo VARCHAR(50),
    p_posicion_x INTEGER DEFAULT 0,
    p_posicion_y INTEGER DEFAULT 0,
    p_configuracion JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    v_dashboard_id INTEGER;
    v_widget_id INTEGER;
    v_widget_dashboard_id INTEGER;
BEGIN
    -- Obtener o crear dashboard del usuario
    SELECT id INTO v_dashboard_id
    FROM DASHBOARD_USUARIO
    WHERE usuario_id = p_usuario_id;
    
    IF NOT FOUND THEN
        INSERT INTO DASHBOARD_USUARIO (usuario_id)
        VALUES (p_usuario_id)
        RETURNING id INTO v_dashboard_id;
    END IF;
    
    -- Obtener widget
    SELECT id INTO v_widget_id
    FROM WIDGETS
    WHERE codigo = p_widget_codigo
    AND activo = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Widget no encontrado: %', p_widget_codigo;
    END IF;
    
    -- Verificar si ya existe
    IF EXISTS (
        SELECT 1 FROM WIDGETS_DASHBOARD
        WHERE dashboard_id = v_dashboard_id
        AND widget_id = v_widget_id
    ) THEN
        RAISE EXCEPTION 'El widget ya está agregado al dashboard';
    END IF;
    
    -- Agregar widget
    INSERT INTO WIDGETS_DASHBOARD (
        dashboard_id, widget_id, posicion_x, posicion_y, configuracion
    ) VALUES (
        v_dashboard_id, v_widget_id, p_posicion_x, p_posicion_y, p_configuracion
    ) RETURNING id INTO v_widget_dashboard_id;
    
    RETURN v_widget_dashboard_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION agregar_widget_dashboard IS 'Función para agregar un widget al dashboard de un usuario';

-- Función para registrar actividad
CREATE OR REPLACE FUNCTION registrar_actividad(
    p_usuario_id INTEGER,
    p_tipo_actividad VARCHAR(50),
    p_modulo VARCHAR(50),
    p_accion VARCHAR(100),
    p_descripcion TEXT DEFAULT NULL,
    p_referencia_tipo VARCHAR(50) DEFAULT NULL,
    p_referencia_id VARCHAR(36) DEFAULT NULL,
    p_datos JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO HISTORIAL_ACTIVIDADES (
        usuario_id, tipo_actividad, modulo, accion, descripcion,
        referencia_tipo, referencia_id, datos, ip_address, user_agent
    ) VALUES (
        p_usuario_id, p_tipo_actividad, p_modulo, p_accion, p_descripcion,
        p_referencia_tipo, p_referencia_id, p_datos, p_ip_address, p_user_agent
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_actividad IS 'Función para registrar una actividad del usuario';

-- Función para obtener estadísticas del dashboard
CREATE OR REPLACE FUNCTION obtener_estadisticas_dashboard(
    p_usuario_id INTEGER,
    p_periodo periodo_tiempo_type DEFAULT 'MES_ACTUAL'
)
RETURNS JSONB AS $$
DECLARE
    v_fecha_inicio TIMESTAMP WITH TIME ZONE;
    v_fecha_fin TIMESTAMP WITH TIME ZONE;
    v_resultado JSONB;
BEGIN
    -- Calcular fechas según período
    CASE p_periodo
        WHEN 'HOY' THEN
            v_fecha_inicio := CURRENT_DATE;
            v_fecha_fin := CURRENT_DATE + INTERVAL '1 day';
        WHEN 'AYER' THEN
            v_fecha_inicio := CURRENT_DATE - INTERVAL '1 day';
            v_fecha_fin := CURRENT_DATE;
        WHEN 'SEMANA_ACTUAL' THEN
            v_fecha_inicio := DATE_TRUNC('week', CURRENT_DATE);
            v_fecha_fin := CURRENT_DATE + INTERVAL '1 day';
        WHEN 'MES_ACTUAL' THEN
            v_fecha_inicio := DATE_TRUNC('month', CURRENT_DATE);
            v_fecha_fin := CURRENT_DATE + INTERVAL '1 day';
        WHEN 'MES_ANTERIOR' THEN
            v_fecha_inicio := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
            v_fecha_fin := DATE_TRUNC('month', CURRENT_DATE);
        ELSE
            v_fecha_inicio := DATE_TRUNC('month', CURRENT_DATE);
            v_fecha_fin := CURRENT_DATE + INTERVAL '1 day';
    END CASE;
    
    -- Construir resultado
    SELECT jsonb_build_object(
        'periodo', p_periodo,
        'fecha_inicio', v_fecha_inicio,
        'fecha_fin', v_fecha_fin,
        'citas_total', (SELECT COUNT(*) FROM CITAS WHERE medico_id = p_usuario_id AND fecha_hora >= v_fecha_inicio AND fecha_hora < v_fecha_fin),
        'citas_completadas', (SELECT COUNT(*) FROM CITAS WHERE medico_id = p_usuario_id AND estado = 'COMPLETADA' AND fecha_hora >= v_fecha_inicio AND fecha_hora < v_fecha_fin),
        'pacientes_atendidos', (SELECT COUNT(DISTINCT id_paciente) FROM HISTORIAL_CLINICO WHERE medico_id = p_usuario_id AND fecha_hora >= v_fecha_inicio AND fecha_hora < v_fecha_fin),
        'documentos_generados', (SELECT COUNT(*) FROM DOCUMENTOS WHERE medico_id = p_usuario_id AND fecha_creacion >= v_fecha_inicio AND fecha_creacion < v_fecha_fin)
    ) INTO v_resultado;
    
    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_estadisticas_dashboard IS 'Función para obtener estadísticas del dashboard por período';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para actualizar fecha_modificacion en WIDGETS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_widgets_update_fecha_modificacion'
    ) THEN
        CREATE TRIGGER tr_widgets_update_fecha_modificacion
            BEFORE UPDATE ON WIDGETS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en DASHBOARD_USUARIO
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_dashboard_usuario_update_fecha'
    ) THEN
        CREATE TRIGGER tr_dashboard_usuario_update_fecha
            BEFORE UPDATE ON DASHBOARD_USUARIO
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en WIDGETS_DASHBOARD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_widgets_dashboard_update_fecha'
    ) THEN
        CREATE TRIGGER tr_widgets_dashboard_update_fecha
            BEFORE UPDATE ON WIDGETS_DASHBOARD
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en METRICAS_DASHBOARD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_metricas_dashboard_update_fecha'
    ) THEN
        CREATE TRIGGER tr_metricas_dashboard_update_fecha
            BEFORE UPDATE ON METRICAS_DASHBOARD
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en GRAFICOS_DASHBOARD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_graficos_dashboard_update_fecha'
    ) THEN
        CREATE TRIGGER tr_graficos_dashboard_update_fecha
            BEFORE UPDATE ON GRAFICOS_DASHBOARD
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en ACCESOS_RAPIDOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_accesos_rapidos_update_fecha'
    ) THEN
        CREATE TRIGGER tr_accesos_rapidos_update_fecha
            BEFORE UPDATE ON ACCESOS_RAPIDOS
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- Trigger para actualizar fecha_modificacion en CONFIGURACION_DASHBOARD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'tr_config_dashboard_update_fecha'
    ) THEN
        CREATE TRIGGER tr_config_dashboard_update_fecha
            BEFORE UPDATE ON CONFIGURACION_DASHBOARD
            FOR EACH ROW
            EXECUTE FUNCTION update_fecha_modificacion();
    END IF;
END $$;

-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Índices para WIDGETS
CREATE INDEX IF NOT EXISTS idx_widgets_codigo ON WIDGETS(codigo);
CREATE INDEX IF NOT EXISTS idx_widgets_tipo ON WIDGETS(tipo);
CREATE INDEX IF NOT EXISTS idx_widgets_categoria ON WIDGETS(categoria);
CREATE INDEX IF NOT EXISTS idx_widgets_activo ON WIDGETS(activo);
CREATE INDEX IF NOT EXISTS idx_widgets_orden ON WIDGETS(orden_visualizacion);

-- Índices para DASHBOARD_USUARIO
CREATE INDEX IF NOT EXISTS idx_dashboard_usuario ON DASHBOARD_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_activo ON DASHBOARD_USUARIO(activo);

-- Índices para WIDGETS_DASHBOARD
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_dashboard ON WIDGETS_DASHBOARD(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_widget ON WIDGETS_DASHBOARD(widget_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_visible ON WIDGETS_DASHBOARD(visible);

-- Índices para METRICAS_DASHBOARD
CREATE INDEX IF NOT EXISTS idx_metricas_codigo ON METRICAS_DASHBOARD(codigo);
CREATE INDEX IF NOT EXISTS idx_metricas_categoria ON METRICAS_DASHBOARD(categoria);
CREATE INDEX IF NOT EXISTS idx_metricas_activo ON METRICAS_DASHBOARD(activo);

-- Índices para VALORES_METRICAS
CREATE INDEX IF NOT EXISTS idx_valores_metrica ON VALORES_METRICAS(metrica_id);
CREATE INDEX IF NOT EXISTS idx_valores_fecha ON VALORES_METRICAS(fecha_calculo);
CREATE INDEX IF NOT EXISTS idx_valores_expiracion ON VALORES_METRICAS(fecha_expiracion);

-- Índices para GRAFICOS_DASHBOARD
CREATE INDEX IF NOT EXISTS idx_graficos_codigo ON GRAFICOS_DASHBOARD(codigo);
CREATE INDEX IF NOT EXISTS idx_graficos_tipo ON GRAFICOS_DASHBOARD(tipo_grafico);
CREATE INDEX IF NOT EXISTS idx_graficos_categoria ON GRAFICOS_DASHBOARD(categoria);
CREATE INDEX IF NOT EXISTS idx_graficos_activo ON GRAFICOS_DASHBOARD(activo);

-- Índices para DATOGRAFICOS_DASHBOARD
CREATE INDEX IF NOT EXISTS idx_datosgraficos_grafico ON DATOGRAFICOS_DASHBOARD(grafico_id);
CREATE INDEX IF NOT EXISTS idx_datosgraficos_fecha ON DATOGRAFICOS_DASHBOARD(fecha_calculo);

-- Índices para ACCESOS_RAPIDOS
CREATE INDEX IF NOT EXISTS idx_accesos_usuario ON ACCESOS_RAPIDOS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_accesos_orden ON ACCESOS_RAPIDOS(usuario_id, orden);
CREATE INDEX IF NOT EXISTS idx_accesos_activo ON ACCESOS_RAPIDOS(activo);

-- Índices para FAVORITOS_USUARIO
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON FAVORITOS_USUARIO(usuario_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_tipo ON FAVORITOS_USUARIO(tipo_elemento);
CREATE INDEX IF NOT EXISTS idx_favoritos_elemento ON FAVORITOS_USUARIO(tipo_elemento, elemento_id);

-- Índices para HISTORIAL_ACTIVIDADES
CREATE INDEX IF NOT EXISTS idx_historial_usuario ON HISTORIAL_ACTIVIDADES(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON HISTORIAL_ACTIVIDADES(fecha_actividad);
CREATE INDEX IF NOT EXISTS idx_historial_tipo ON HISTORIAL_ACTIVIDADES(tipo_actividad);
CREATE INDEX IF NOT EXISTS idx_historial_modulo ON HISTORIAL_ACTIVIDADES(modulo);
CREATE INDEX IF NOT EXISTS idx_historial_referencia ON HISTORIAL_ACTIVIDADES(referencia_tipo, referencia_id);

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Vista de widgets activos
CREATE OR REPLACE VIEW v_widgets_activos AS
SELECT
    w.id,
    w.codigo,
    w.nombre,
    w.descripcion,
    w.categoria,
    w.tipo,
    w.tamano_default,
    w.icono,
    w.color,
    w.frecuencia_actualizacion,
    w.cache_segundos,
    w.activo,
    w.orden_visualizacion
FROM WIDGETS w
WHERE w.activo = TRUE
ORDER BY w.orden_visualizacion, w.nombre;

COMMENT ON VIEW v_widgets_activos IS 'Vista de widgets activos ordenados';

-- Vista de métricas con valores
CREATE OR REPLACE VIEW v_metricas_con_valores AS
SELECT
    m.id,
    m.codigo,
    m.nombre,
    m.descripcion,
    m.categoria,
    m.tipo,
    m.formato,
    m.decimales,
    m.prefijo,
    m.sufijo,
    vm.valor_actual,
    vm.valor_anterior,
    vm.variacion_porcentaje,
    vm.estado,
    vm.fecha_calculo
FROM METRICAS_DASHBOARD m
LEFT JOIN LATERAL (
    SELECT valor_actual, valor_anterior, variacion_porcentaje, estado, fecha_calculo
    FROM VALORES_METRICAS vm
    WHERE vm.metrica_id = m.id
    ORDER BY vm.fecha_calculo DESC
    LIMIT 1
) vm ON TRUE
WHERE m.activo = TRUE;

COMMENT ON VIEW v_metricas_con_valores IS 'Vista de métricas con sus últimos valores calculados';

-- Vista de actividades recientes
CREATE OR REPLACE VIEW v_actividades_recientes AS
SELECT
    ha.id,
    ha.usuario_id,
    CONCAT(u.nombres, ' ', u.apellidos) as nombre_usuario,
    ha.tipo_actividad,
    ha.modulo,
    ha.accion,
    ha.descripcion,
    ha.referencia_tipo,
    ha.referencia_id,
    ha.fecha_actividad,
    ha.ip_address
FROM HISTORIAL_ACTIVIDADES ha
JOIN USUARIOS u ON ha.usuario_id = u.id
ORDER BY ha.fecha_actividad DESC
LIMIT 100;

COMMENT ON VIEW v_actividades_recientes IS 'Vista de las últimas 100 actividades registradas';

-- Vista de accesos rápidos por usuario
CREATE OR REPLACE VIEW v_accesos_rapidos_usuario AS
SELECT
    ar.id,
    ar.usuario_id,
    ar.nombre,
    ar.descripcion,
    ar.url,
    ar.icono,
    ar.color,
    ar.orden,
    ar.abrir_nueva_ventana
FROM ACCESOS_RAPIDOS ar
WHERE ar.activo = TRUE
ORDER BY ar.usuario_id, ar.orden;

COMMENT ON VIEW v_accesos_rapidos_usuario IS 'Vista de accesos rápidos activos por usuario';

-- ============================================================================
-- DATOS INICIALES (SEEDS)
-- ============================================================================

-- Insertar configuración de dashboard por defecto
INSERT INTO CONFIGURACION_DASHBOARD (
    nombre_sistema, widgets_por_fila, alto_widget, margen_widget,
    actualizacion_automatica, intervalo_actualizacion, activo
) VALUES (
    'Ecodigital', 3, 300, 16, TRUE, 300, TRUE
) ON CONFLICT DO NOTHING;

-- Insertar widgets por defecto
INSERT INTO WIDGETS (codigo, nombre, descripcion, categoria, tipo, tamano_default, icono, color, frecuencia_actualizacion, activo, orden_visualizacion)
VALUES 
    ('WID-CITAS-HOY', 'Citas del Día', 'Muestra las citas programadas para hoy', 'CITAS', 'LISTA', 'MEDIANO', 'calendar', '#1976D2', 'MINUTOS_5', TRUE, 1),
    ('WID-PACIENTES-TOTAL', 'Total Pacientes', 'Contador de pacientes registrados', 'PACIENTES', 'CONTADOR', 'PEQUENO', 'people', '#4CAF50', 'HORA', TRUE, 2),
    ('WID-CITAS-ESTADO', 'Citas por Estado', 'Distribución de citas por estado', 'CITAS', 'GRAFICO_PASTEL', 'MEDIANO', 'pie-chart', '#FF9800', 'MINUTOS_15', TRUE, 3),
    ('WID-ULTIMAS-ACTIVIDADES', 'Últimas Actividades', 'Lista de últimas actividades del sistema', 'SISTEMA', 'ULTIMAS_ACCIONES', 'GRANDE', 'activity', '#9C27B0', 'MINUTOS_5', TRUE, 4),
    ('WID-NOTIFICACIONES', 'Notificaciones', 'Notificaciones pendientes del usuario', 'SISTEMA', 'NOTIFICACIONES', 'PEQUENO', 'bell', '#F44336', 'TIEMPO_REAL', TRUE, 5),
    ('WID-ACCESOS-RAPIDOS', 'Accesos Rápidos', 'Enlaces de acceso rápido', 'SISTEMA', 'ACCESOS_RAPIDOS', 'MEDIANO', 'link', '#607D8B', 'MANUAL', TRUE, 6)
ON CONFLICT (codigo) DO NOTHING;

-- Insertar métricas por defecto
INSERT INTO METRICAS_DASHBOARD (codigo, nombre, descripcion, categoria, tipo, consulta_sql, formato, mostrar_comparacion, mostrar_tendencia, activo)
VALUES 
    ('MET-CITAS-HOY', 'Citas Hoy', 'Número de citas programadas para hoy', 'CITAS', 'CONTADOR', 
     'SELECT COUNT(*) FROM CITAS WHERE DATE(fecha_hora) = CURRENT_DATE AND activo = TRUE', 'NUMERO', TRUE, TRUE, TRUE),
    ('MET-PACIENTES-NUEVOS', 'Pacientes Nuevos', 'Pacientes registrados este mes', 'PACIENTES', 'CONTADOR',
     'SELECT COUNT(*) FROM PACIENTES WHERE DATE_TRUNC(''month'', fecha_creacion) = DATE_TRUNC(''month'', CURRENT_DATE) AND activo = TRUE', 'NUMERO', TRUE, TRUE, TRUE),
    ('MET-CONSULTAS-MES', 'Consultas del Mes', 'Total de consultas realizadas este mes', 'CONSULTAS', 'CONTADOR',
     'SELECT COUNT(*) FROM HISTORIAL_CLINICO WHERE DATE_TRUNC(''month'', fecha_hora) = DATE_TRUNC(''month'', CURRENT_DATE) AND activo = TRUE', 'NUMERO', TRUE, TRUE, TRUE),
    ('MET-DOCUMENTOS-GEN', 'Documentos Generados', 'Documentos generados este mes', 'DOCUMENTOS', 'CONTADOR',
     'SELECT COUNT(*) FROM DOCUMENTOS WHERE DATE_TRUNC(''month'', fecha_creacion) = DATE_TRUNC(''month'', CURRENT_DATE) AND activo = TRUE', 'NUMERO', TRUE, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- CONFIRMACIÓN DE TRANSACCIÓN
-- ============================================================================

-- Verificar que todas las tablas se crearon correctamente
DO $$
DECLARE
    tablas_creadas INTEGER;
BEGIN
    SELECT COUNT(*) INTO tablas_creadas
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('widgets', 'dashboard_usuario', 'widgets_dashboard', 'metricas_dashboard',
                       'valores_metricas', 'graficos_dashboard', 'datograficos_dashboard',
                       'accesos_rapidos', 'favoritos_usuario', 'configuracion_dashboard', 'historial_actividades');
    
    IF tablas_creadas = 11 THEN
        RAISE NOTICE 'Migración 13 completada exitosamente. 11 tablas creadas/verificadas.';
    ELSE
        RAISE EXCEPTION 'Error: No todas las tablas fueron creadas correctamente. Esperadas: 11, Encontradas: %', tablas_creadas;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIN DEL SCRIPT UP
-- ============================================================================

-- ============================================================================
-- SCRIPT DOWN: Reversión de la migración
-- ============================================================================
-- Para revertir esta migración, ejecutar el siguiente bloque:
/*
BEGIN;

-- ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS
-- Asegúrese de tener un respaldo antes de ejecutar

-- Eliminar vistas
DROP VIEW IF EXISTS v_accesos_rapidos_usuario CASCADE;
DROP VIEW IF EXISTS v_actividades_recientes CASCADE;
DROP VIEW IF EXISTS v_metricas_con_valores CASCADE;
DROP VIEW IF EXISTS v_widgets_activos CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS obtener_estadisticas_dashboard(INTEGER, periodo_tiempo_type);
DROP FUNCTION IF EXISTS registrar_actividad(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, JSONB, INET, TEXT);
DROP FUNCTION IF EXISTS agregar_widget_dashboard(INTEGER, VARCHAR, INTEGER, INTEGER, JSONB);
DROP FUNCTION IF EXISTS obtener_widgets_usuario(INTEGER);
DROP FUNCTION IF EXISTS calcular_metrica(VARCHAR, JSONB);

-- Eliminar triggers
DROP TRIGGER IF EXISTS tr_config_dashboard_update_fecha ON CONFIGURACION_DASHBOARD;
DROP TRIGGER IF EXISTS tr_accesos_rapidos_update_fecha ON ACCESOS_RAPIDOS;
DROP TRIGGER IF EXISTS tr_graficos_dashboard_update_fecha ON GRAFICOS_DASHBOARD;
DROP TRIGGER IF EXISTS tr_metricas_dashboard_update_fecha ON METRICAS_DASHBOARD;
DROP TRIGGER IF EXISTS tr_widgets_dashboard_update_fecha ON WIDGETS_DASHBOARD;
DROP TRIGGER IF EXISTS tr_dashboard_usuario_update_fecha ON DASHBOARD_USUARIO;
DROP TRIGGER IF EXISTS tr_widgets_update_fecha_modificacion ON WIDGETS;

-- Eliminar tablas (en orden inverso a dependencias)
DROP TABLE IF EXISTS HISTORIAL_ACTIVIDADES CASCADE;
DROP TABLE IF EXISTS CONFIGURACION_DASHBOARD CASCADE;
DROP TABLE IF EXISTS FAVORITOS_USUARIO CASCADE;
DROP TABLE IF EXISTS ACCESOS_RAPIDOS CASCADE;
DROP TABLE IF EXISTS DATOGRAFICOS_DASHBOARD CASCADE;
DROP TABLE IF EXISTS GRAFICOS_DASHBOARD CASCADE;
DROP TABLE IF EXISTS VALORES_METRICAS CASCADE;
DROP TABLE IF EXISTS METRICAS_DASHBOARD CASCADE;
DROP TABLE IF EXISTS WIDGETS_DASHBOARD CASCADE;
DROP TABLE IF EXISTS DASHBOARD_USUARIO CASCADE;
DROP TABLE IF EXISTS WIDGETS CASCADE;

-- Eliminar dominios
DROP DOMAIN IF EXISTS tipo_grafico_type;
DROP DOMAIN IF EXISTS frecuencia_actualizacion_type;
DROP DOMAIN IF EXISTS estado_widget_type;
DROP DOMAIN IF EXISTS tipo_metrica_type;
DROP DOMAIN IF EXISTS periodo_tiempo_type;
DROP DOMAIN IF EXISTS tamano_widget_type;
DROP DOMAIN IF EXISTS tipo_widget_type;

COMMIT;
*/