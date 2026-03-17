/**
 * EcoDigital - Dashboard Principal Schema Migration
 * Script to apply dashboard principal database schema
 */

const { runSqlFile, checkConnection } = require('../db');
const path = require('path');

async function migrateDashboardSchema() {
    console.log('🚀 Starting Dashboard Principal schema migration...');

    try {
        // Check database connection
        console.log('📡 Checking database connection...');
        const isConnected = await checkConnection();
        
        if (!isConnected) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connection successful');

        // Run dashboard schema migration
        console.log('📊 Applying Dashboard Principal schema...');
        await runSqlFile('13_dashboard_principal_postgresql.sql');
        console.log('✅ Dashboard Principal schema applied successfully');

        console.log('🎉 Dashboard Principal migration completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   • patient_context table created');
        console.log('   • user_notes table created');
        console.log('   • ai_conversations table created');
        console.log('   • file_metadata table created');
        console.log('   • dashboard_stats_cache table created');
        console.log('   • Views and functions created');
        console.log('   • Permissions configured');

    } catch (error) {
        console.error('❌ Dashboard migration failed:', error.message);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('Full error:', error);
        }
        
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDashboardSchema()
        .then(() => {
            console.log('✨ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateDashboardSchema };