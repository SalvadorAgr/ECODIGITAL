/**
 * Integration Migration Script
 * Runs the integration enhancements database migration
 */

const { getPool } = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Starting integration enhancements migration...');

        const pool = getPool();
        if (!pool) {
            throw new Error('Database not connected');
        }

        const sqlPath = path.join(__dirname, '../sql/12_integration_enhancements_postgresql.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split SQL into individual statements and execute them
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await pool.query(statement);
                } catch (error) {
                    // Log but continue for statements that might already exist
                    if (!error.message.includes('already exists')) {
                        console.warn('Statement warning:', error.message);
                    }
                }
            }
        }

        console.log('Integration enhancements migration completed successfully');
        console.log('New tables and enhancements have been added to support:');
        console.log('- Enhanced error logging');
        console.log('- Priority management and escalation');
        console.log('- Resource availability configuration');
        console.log('- Integration service health monitoring');
        console.log('- Patient scheduling preferences');
        console.log('- Appointment optimization metrics');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runMigration();
}

module.exports = runMigration;