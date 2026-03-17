#!/usr/bin/env node

/**
 * EcoDigital - Development Database Setup Script
 * Sets up PostgreSQL database for development environment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Prompt user for input
 */
const prompt = (question) => {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
};

/**
 * Check if PostgreSQL is installed and running
 */
const checkPostgreSQL = () => {
    log.info('Checking PostgreSQL installation...');

    try {
        // Check if psql command exists
        execSync('which psql', { stdio: 'ignore' });
        log.success('PostgreSQL client found');

        // Check if PostgreSQL server is running
        execSync('pg_isready', { stdio: 'ignore' });
        log.success('PostgreSQL server is running');

        return true;
    } catch (error) {
        log.error('PostgreSQL is not installed or not running');
        log.info('Please install PostgreSQL and ensure it is running');
        log.info('macOS: brew install postgresql && brew services start postgresql');
        log.info('Ubuntu: sudo apt-get install postgresql postgresql-contrib');
        log.info('Windows: Download from https://www.postgresql.org/download/');
        return false;
    }
};

/**
 * Get database configuration from user
 */
const getDatabaseConfig = async () => {
    log.title('Database Configuration');

    const config = {
        host: await prompt('Database host (localhost): ') || 'localhost',
        port: await prompt('Database port (5432): ') || '5432',
        adminUser: await prompt('PostgreSQL admin user (postgres): ') || 'postgres',
        adminPassword: await prompt('PostgreSQL admin password: '),
        dbName: await prompt('Database name (ecodigital_dev): ') || 'ecodigital_dev',
        appUser: await prompt('Application user (ecodigital_app): ') || 'ecodigital_app',
        appPassword: await prompt('Application password (generate random): ') || generatePassword()
    };

    return config;
};

/**
 * Generate random password
 */
const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

/**
 * Create database and user
 */
const createDatabase = async (config) => {
    log.title('Creating Database and User');

    try {
        // Set PGPASSWORD environment variable
        process.env.PGPASSWORD = config.adminPassword;

        // Create database
        log.info(`Creating database: ${config.dbName}`);
        try {
            execSync(`createdb -h ${config.host} -p ${config.port} -U ${config.adminUser} ${config.dbName}`, { stdio: 'ignore' });
            log.success(`Database ${config.dbName} created`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                log.warning(`Database ${config.dbName} already exists`);
            } else {
                throw error;
            }
        }

        // Create user and grant permissions
        log.info(`Creating user: ${config.appUser}`);
        const createUserSQL = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${config.appUser}') THEN
          CREATE ROLE ${config.appUser} LOGIN PASSWORD '${config.appPassword}';
        END IF;
      END
      $$;
      
      GRANT CONNECT ON DATABASE ${config.dbName} TO ${config.appUser};
      GRANT USAGE ON SCHEMA public TO ${config.appUser};
      GRANT CREATE ON SCHEMA public TO ${config.appUser};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${config.appUser};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${config.appUser};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${config.appUser};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${config.appUser};
    `;

        execSync(`psql -h ${config.host} -p ${config.port} -U ${config.adminUser} -d ${config.dbName} -c "${createUserSQL}"`, { stdio: 'ignore' });
        log.success(`User ${config.appUser} created and permissions granted`);

        return true;
    } catch (error) {
        log.error(`Failed to create database: ${error.message}`);
        return false;
    } finally {
        delete process.env.PGPASSWORD;
    }
};

/**
 * Run database setup scripts
 */
const runSetupScripts = async (config) => {
    log.title('Running Database Setup Scripts');

    try {
        // Set connection environment variables
        process.env.PGHOST = config.host;
        process.env.PGPORT = config.port;
        process.env.PGDATABASE = config.dbName;
        process.env.PGUSER = config.appUser;
        process.env.PGPASSWORD = config.appPassword;

        const sqlDir = path.join(__dirname, '..', 'sql');

        // Run setup script
        log.info('Running database setup script...');
        const setupScript = path.join(sqlDir, 'setup_database.sql');
        if (fs.existsSync(setupScript)) {
            execSync(`psql -f "${setupScript}"`, { stdio: 'inherit' });
            log.success('Database setup completed');
        } else {
            log.warning('Setup script not found, skipping...');
        }

        // Ask if user wants to seed data
        const seedData = await prompt('Do you want to seed the database with test data? (y/N): ');
        if (seedData.toLowerCase() === 'y' || seedData.toLowerCase() === 'yes') {
            log.info('Seeding database with test data...');
            const seedScript = path.join(sqlDir, 'seed_data.sql');
            if (fs.existsSync(seedScript)) {
                execSync(`psql -f "${seedScript}"`, { stdio: 'inherit' });
                log.success('Test data seeded successfully');
            } else {
                log.warning('Seed script not found, skipping...');
            }
        }

        return true;
    } catch (error) {
        log.error(`Failed to run setup scripts: ${error.message}`);
        return false;
    } finally {
        // Clean up environment variables
        delete process.env.PGHOST;
        delete process.env.PGPORT;
        delete process.env.PGDATABASE;
        delete process.env.PGUSER;
        delete process.env.PGPASSWORD;
    }
};

/**
 * Create .env file
 */
const createEnvFile = (config) => {
    log.title('Creating Environment File');

    const envContent = `# EcoDigital Database Configuration
# Generated by setup-dev-db.js on ${new Date().toISOString()}

NODE_ENV=development

# Database Configuration
DB_HOST=${config.host}
DB_PORT=${config.port}
DB_NAME=${config.dbName}
DB_USER=${config.appUser}
DB_PASSWORD=${config.appPassword}

# JWT Configuration
JWT_SECRET=${generatePassword()}
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=8080
CORS_ORIGIN=http://localhost:3000

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf

# Logging Configuration
LOG_LEVEL=debug
LOG_FILE=logs/app.log
`;

    const envPath = path.join(__dirname, '..', '.env');

    try {
        // Check if .env already exists
        if (fs.existsSync(envPath)) {
            const overwrite = await prompt('.env file already exists. Overwrite? (y/N): ');
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                log.info('Skipping .env file creation');
                return true;
            }
        }

        fs.writeFileSync(envPath, envContent);
        log.success('.env file created successfully');

        // Create .env.example
        const envExampleContent = envContent.replace(/=.+$/gm, '=');
        const envExamplePath = path.join(__dirname, '..', '.env.example');
        fs.writeFileSync(envExamplePath, envExampleContent);
        log.success('.env.example file created');

        return true;
    } catch (error) {
        log.error(`Failed to create .env file: ${error.message}`);
        return false;
    }
};

/**
 * Test database connection
 */
const testConnection = async (config) => {
    log.title('Testing Database Connection');

    try {
        // Use the database utilities to test connection
        process.env.DB_HOST = config.host;
        process.env.DB_PORT = config.port;
        process.env.DB_NAME = config.dbName;
        process.env.DB_USER = config.appUser;
        process.env.DB_PASSWORD = config.appPassword;

        const db = require('../db');
        const isConnected = await db.checkConnection();

        if (isConnected) {
            log.success('Database connection test successful');

            // Get some basic stats
            const stats = await db.getStats();
            log.info(`Database size: ${stats.database_size[0]?.size || 'Unknown'}`);
            log.info(`Active connections: ${stats.connections[0]?.active_connections || 0}`);

            await db.close();
            return true;
        } else {
            log.error('Database connection test failed');
            return false;
        }
    } catch (error) {
        log.error(`Connection test failed: ${error.message}`);
        return false;
    }
};

/**
 * Main setup function
 */
const main = async () => {
    try {
        log.title('🏥 EcoDigital Database Setup');
        log.info('This script will set up PostgreSQL database for development');

        // Check PostgreSQL
        if (!checkPostgreSQL()) {
            process.exit(1);
        }

        // Get configuration
        const config = await getDatabaseConfig();

        // Confirm setup
        console.log('\n📋 Configuration Summary:');
        console.log(`   Host: ${config.host}:${config.port}`);
        console.log(`   Database: ${config.dbName}`);
        console.log(`   App User: ${config.appUser}`);
        console.log(`   Password: ${'*'.repeat(config.appPassword.length)}`);

        const confirm = await prompt('\nProceed with setup? (y/N): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            log.info('Setup cancelled');
            process.exit(0);
        }

        // Create database and user
        if (!await createDatabase(config)) {
            process.exit(1);
        }

        // Run setup scripts
        if (!await runSetupScripts(config)) {
            process.exit(1);
        }

        // Create .env file
        if (!await createEnvFile(config)) {
            process.exit(1);
        }

        // Test connection
        if (!await testConnection(config)) {
            process.exit(1);
        }

        // Success message
        log.title('🎉 Setup Complete!');
        log.success('Database setup completed successfully');
        log.info('You can now start the development server with: npm run dev');
        log.info('Default admin credentials:');
        log.info('  Username: admin');
        log.info('  Email: admin@ecodigital.com');
        log.info('  Password: password123');

    } catch (error) {
        log.error(`Setup failed: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
};

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    checkPostgreSQL,
    getDatabaseConfig,
    createDatabase,
    runSetupScripts,
    createEnvFile,
    testConnection
};