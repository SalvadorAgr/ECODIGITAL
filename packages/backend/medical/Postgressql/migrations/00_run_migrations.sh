#!/bin/bash
# =====================================================
# EcoDigital - Database Migration Runner
# Versión: 1.0
# Descripción: Ejecuta todas las migraciones en orden
#              garantizando la integridad de la base de datos
# =====================================================

set -e  # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración de base de datos
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ecodigital}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

# Directorio de migraciones
MIGRATION_DIR="$(dirname "$0")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EcoDigital - Database Migration Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Función para verificar conexión
check_connection() {
    echo -e "${YELLOW}Verificando conexión a la base de datos...${NC}"
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Conexión exitosa${NC}"
        return 0
    else
        echo -e "${RED}✗ Error: No se puede conectar a la base de datos${NC}"
        echo -e "${YELLOW}Verifique las siguientes variables de entorno:${NC}"
        echo "  DB_HOST: $DB_HOST"
        echo "  DB_PORT: $DB_PORT"
        echo "  DB_NAME: $DB_NAME"
        echo "  DB_USER: $DB_USER"
        return 1
    fi
}

# Función para crear backup
create_backup() {
    echo -e "${YELLOW}Creando backup de seguridad...${NC}"
    BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).dump"
    
    if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE"; then
        echo -e "${GREEN}✓ Backup creado: $BACKUP_FILE${NC}"
        return 0
    else
        echo -e "${RED}✗ Error al crear backup${NC}"
        return 1
    fi
}

# Función para ejecutar migración
run_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file")
    
    echo ""
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}Ejecutando: $migration_name${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration_file"; then
        echo -e "${GREEN}✓ $migration_name completado exitosamente${NC}"
        return 0
    else
        echo -e "${RED}✗ Error en $migration_name${NC}"
        return 1
    fi
}

# Función para verificar estado post-migración
verify_migration() {
    echo ""
    echo -e "${YELLOW}Verificando estado de la base de datos...${NC}"
    
    # Verificar tablas principales
    local tables=("ROLES" "USUARIOS" "PACIENTES" "CITAS" "HISTORIAL_CLINICO" "DOCUMENTOS" "LOGS_AUDITORIA")
    local all_ok=true
    
    for table in "${tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM $table LIMIT 1" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Tabla $table accesible${NC}"
        else
            echo -e "${RED}✗ Error: Tabla $table no accesible${NC}"
            all_ok=false
        fi
    done
    
    # Verificar funciones
    local functions=("update_fecha_modificacion" "calcular_imc" "validar_conflicto_citas" "generar_numero_cita" "sp_crear_log_auditoria")
    
    for func in "${functions[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT proname FROM pg_proc WHERE proname = '$func'" | grep -q "$func"; then
            echo -e "${GREEN}✓ Función $func existe${NC}"
        else
            echo -e "${RED}✗ Error: Función $func no existe${NC}"
            all_ok=false
        fi
    done
    
    # Verificar triggers
    local triggers=("tr_usuarios_update_fecha_modificacion" "tr_pacientes_update_fecha_modificacion" "tr_citas_update_fecha_modificacion" "tr_logs_auditoria_prevent_update")
    
    for trig in "${triggers[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tgname FROM pg_trigger WHERE tgname = '$trig'" | grep -q "$trig"; then
            echo -e "${GREEN}✓ Trigger $trig existe${NC}"
        else
            echo -e "${RED}✗ Error: Trigger $trig no existe${NC}"
            all_ok=false
        fi
    done
    
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}✓ Verificación completada exitosamente${NC}"
        return 0
    else
        echo -e "${RED}✗ Verificación falló - revise los errores anteriores${NC}"
        return 1
    fi
}

# Función principal
main() {
    echo -e "${YELLOW}Iniciando proceso de migración...${NC}"
    echo ""
    
    # Paso 1: Verificar conexión
    if ! check_connection; then
        exit 1
    fi
    
    # Paso 2: Crear backup
    echo ""
    read -p "¿Desea crear un backup antes de continuar? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! create_backup; then
            echo -e "${YELLOW}Continuando sin backup...${NC}"
        fi
    fi
    
    # Paso 3: Ejecutar pre-migration check
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 1: Pre-Migration Check${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! run_migration "$MIGRATION_DIR/00_00_pre_migration_check.sql"; then
        echo -e "${RED}Error en pre-migration check. Revise los problemas reportados.${NC}"
        exit 1
    fi
    
    # Paso 4: Ejecutar schema normalization
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 2: Schema Normalization${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! run_migration "$MIGRATION_DIR/01_00_schema_normalization.sql"; then
        echo -e "${RED}Error en schema normalization. Ejecute el script de rollback si es necesario.${NC}"
        exit 1
    fi
    
    # Paso 5: Ejecutar functions and triggers
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 3: Functions and Triggers${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! run_migration "$MIGRATION_DIR/02_00_functions_triggers.sql"; then
        echo -e "${RED}Error en functions and triggers. Ejecute el script de rollback si es necesario.${NC}"
        exit 1
    fi
    
    # Paso 6: Ejecutar views and indexes
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 4: Views and Indexes${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! run_migration "$MIGRATION_DIR/03_00_views_indexes.sql"; then
        echo -e "${RED}Error en views and indexes. Ejecute el script de rollback si es necesario.${NC}"
        exit 1
    fi
    
    # Paso 7: Ejecutar post-migration validation
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 5: Post-Migration Validation${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! run_migration "$MIGRATION_DIR/05_00_post_migration_validation.sql"; then
        echo -e "${RED}Error en post-migration validation. Revise los errores reportados.${NC}"
        exit 1
    fi
    
    # Paso 8: Verificar estado final
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Paso 6: Verificación Final${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if ! verify_migration; then
        echo -e "${RED}La verificación final falló. Revise los errores y considere ejecutar el rollback.${NC}"
        exit 1
    fi
    
    # Completado
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ MIGRACIÓN COMPLETADA EXITOSAMENTE${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Resumen de cambios:${NC}"
    echo "  - Nombres de columnas normalizados (id_role -> id, etc.)"
    echo "  - Funciones y triggers implementados"
    echo "  - Vistas creadas para consultas frecuentes"
    echo "  - Índices optimizados para rendimiento"
    echo ""
    echo -e "${YELLOW}Para revertir cambios, ejecute:${NC}"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MIGRATION_DIR/04_00_rollback.sql"
    echo ""
}

# Ejecutar función principal
main "$@"