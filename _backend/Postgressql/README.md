# EcoDigital Database Setup

This directory contains all the SQL scripts and utilities needed to set up and manage the PostgreSQL database for the EcoDigital medical management system.

## 📁 File Structure

```
backend/sql/
├── README.md                                    # This file
├── setup_database.sql                          # Main setup script
├── migrate_from_mysql.sql                      # Migration script from MySQL
├── seed_data.sql                              # Test data for development
├── 01_usuarios_y_roles_postgresql.sql         # Users and roles schema
├── 02_pacientes_y_historial_postgresql.sql    # Patients and clinical history
├── 03_citas_y_documentos_postgresql.sql       # Appointments and documents
├── 04_auditoria_y_logs_postgresql.sql         # Audit logs and system logs
├── 05_recursos_y_reservas_postgresql.sql      # Resources and reservations
├── 06_enhanced_schedule_exceptions_postgresql.sql # Schedule exceptions
├── 07_citas_recurrentes_postgresql.sql        # Recurring appointments
├── 08_priority_system_postgresql.sql          # Priority system for appointments
├── 09_waitlist_management_postgresql.sql      # Waitlist management system
└── 10_waitlist_automation_postgresql.sql      # Waitlist automation system
```

## 🚀 Quick Start

### Prerequisites

1. **PostgreSQL 12+** installed and running
2. **Node.js 16+** for running setup scripts
3. **npm** for package management

### Automated Setup (Recommended)

Run the interactive setup script:

```bash
cd backend
npm run db:setup
```

This script will:
- Check PostgreSQL installation
- Create database and user
- Run all schema migrations
- Optionally seed test data
- Create `.env` configuration file
- Test the database connection

### Manual Setup

If you prefer manual setup or need more control:

1. **Create Database and User**
   ```sql
   -- Connect as PostgreSQL superuser
   CREATE DATABASE ecodigital_dev;
   CREATE USER ecodigital_app WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE ecodigital_dev TO ecodigital_app;
   ```

2. **Run Setup Script**
   ```bash
   psql -d ecodigital_dev -f sql/setup_database.sql
   ```

3. **Seed Test Data (Optional)**
   ```bash
   psql -d ecodigital_dev -f sql/seed_data.sql
   ```

## 📊 Database Schema Overview

### Core Tables

- **USUARIOS** - System users (doctors, nurses, admins, etc.)
- **ROLES** - User roles and permissions
- **PACIENTES** - Patient information
- **CITAS** - Medical appointments
- **HISTORIAL_CLINICO** - Clinical history records
- **DOCUMENTOS** - Medical documents and files

### Advanced Features

- **LISTA_ESPERA** - Waitlist management for appointments
- **CITAS_RECURRENTES** - Recurring appointment patterns
- **CONFIGURACION_PRIORIDADES** - Priority system configuration
- **LOGS_AUDITORIA** - Complete audit trail
- **RECURSOS** - Medical resources and equipment
- **EXCEPCIONES_HORARIO** - Schedule exceptions and holidays

## 🔧 Available Scripts

From the `backend` directory:

```bash
# Interactive database setup
npm run db:setup

# Run migrations only
npm run db:migrate

# Seed test data only
npm run db:seed

# Reset database (migrate + seed)
npm run db:reset

# Get database statistics
npm run db:stats
```

## 🔄 Migration from MySQL

If you're migrating from an existing MySQL database:

1. **Export MySQL Data**
   ```bash
   mysqldump -u user -p --no-create-info --complete-insert ecodigital > mysql_data.sql
   ```

2. **Run Migration Script**
   ```bash
   psql -d ecodigital_dev -f sql/migrate_from_mysql.sql
   ```

3. **Follow Migration Instructions**
   The migration script contains detailed instructions for different migration methods.

## 🧪 Test Data

The seed data includes:

- **6 User Roles**: Super Admin, Admin, Doctor, Nurse, Receptionist, Patient
- **10 Test Users**: Including doctors, nurses, and administrative staff
- **10 Test Patients**: With realistic demographic data
- **10 Sample Appointments**: Past, present, and future appointments
- **5 Clinical Records**: Sample medical history entries
- **5 Documents**: Sample medical documents
- **8 Resources**: Medical equipment and rooms

### Default Credentials

After seeding, you can log in with:

- **Admin**: admin@ecodigital.com / password123
- **Super Admin**: superadmin@ecodigital.com / password123
- **Doctor**: garcia@ecodigital.com / password123

## 🔒 Security Considerations

### Development Environment

- Default passwords are used for convenience
- Database user has full permissions
- SSL is disabled for local connections

### Production Environment

- **Change all default passwords**
- Use environment variables for sensitive data
- Enable SSL/TLS for database connections
- Restrict database user permissions
- Enable audit logging
- Regular security updates

## 📈 Performance Optimization

The setup includes several performance optimizations:

### Indexes

- Primary keys on all tables
- Foreign key indexes for joins
- Composite indexes for common queries
- Partial indexes for filtered queries

### Configuration

- Optimized PostgreSQL settings for development
- Connection pooling configuration
- Query timeout settings
- Memory allocation tuning

## 🔍 Monitoring and Maintenance

### Database Statistics

```bash
# Get table statistics
npm run db:stats

# Check connection status
node -e "require('./db').checkConnection()"

# Get detailed performance metrics
SELECT * FROM pg_stat_user_tables;
```

### Maintenance Tasks

```sql
-- Update table statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE ecodigital_dev;

-- Clean up unused space
VACUUM FULL;
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if PostgreSQL is running: `pg_isready`
   - Verify connection parameters in `.env`
   - Check firewall settings

2. **Permission Denied**
   - Verify user permissions: `\du` in psql
   - Check database ownership: `\l` in psql
   - Ensure user has necessary grants

3. **Schema Errors**
   - Check PostgreSQL version compatibility
   - Verify all dependencies are installed
   - Review error logs for specific issues

### Debug Mode

Enable debug logging by setting:
```bash
export LOG_LEVEL=debug
npm run dev
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [EcoDigital API Documentation](../docs/API_DOCUMENTATION.md)

## 🤝 Contributing

When adding new database features:

1. Create migration scripts in numbered order
2. Update the main setup script
3. Add corresponding seed data if needed
4. Update this README with new tables/features
5. Test with both fresh installs and migrations

## 📝 License

This database schema is part of the EcoDigital project and follows the same license terms.