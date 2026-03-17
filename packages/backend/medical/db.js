/**
 * EcoDigital - Database Connection Utilities
 * PostgreSQL connection and query utilities for Node.js backend
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Database configuration based on environment
 * Optimized for Google Cloud SQL and local development
 */
const getDbConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  // Check if running on Cloud Run (has Cloud SQL socket)
  const isCloudRun = process.env.K_SERVICE !== undefined;

  const configs = {
    development: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ecodigital_dev',
      user: process.env.DB_USER || 'ecodigital_app',
      password: process.env.DB_PASSWORD || 'change_me_in_production',
      ssl: false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    test: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ecodigital_test',
      user: process.env.DB_USER || 'ecodigital_app',
      password: process.env.DB_PASSWORD || 'change_me_in_production',
      ssl: false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    production: {
      // Cloud SQL connection configuration
      host: isCloudRun
        ? `/cloudsql/${process.env.GOOGLE_CLOUD_PROJECT_ID}:${process.env.GOOGLE_CLOUD_REGION || 'us-central1'}:ecodigital-backend-database-postgresql`
        : process.env.DB_HOST,
      port: isCloudRun ? undefined : (process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'ecodigital',
      user: process.env.DB_USER || 'ecodigital_app',
      password: process.env.DB_PASSWORD,
      ssl: isCloudRun ? false : {
        rejectUnauthorized: false,
      },
      max: 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  };

  return configs[env];
};

/**
 * Create database connection pool
 */
const createPool = () => {
  const config = getDbConfig();

  if (!config.host || !config.database || !config.user || !config.password) {
    throw new Error('Database configuration is incomplete. Please check environment variables.');
  }

  const pool = new Pool(config);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Log successful connection
  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
  });

  return pool;
};

/**
 * Global pool instance
 */
let pool = null;

/**
 * Get database pool instance (singleton)
 */
const getPool = () => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params = []) => {
  const start = Date.now();
  const client = getPool();

  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('Database query error:', {
      query: text.substring(0, 100),
      params: params,
      error: error.message
    });
    throw error;
  }
};

/**
 * Execute a transaction
 * @param {Function} callback - Function that receives client and executes queries
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple queries in a transaction
 * @param {Array} queries - Array of {text, params} objects
 * @returns {Promise<Array>} Array of query results
 */
const multiQuery = async (queries) => {
  return transaction(async (client) => {
    const results = [];
    for (const { text, params = [] } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    return results;
  });
};

/**
 * Check database connection
 * @returns {Promise<boolean>} Connection status
 */
const checkConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('Database connection successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

/**
 * Initialize database (run migrations, seed data, etc.)
 * @param {Object} options - Initialization options
 */
const initializeDatabase = async (options = {}) => {
  const { runMigrations = false, seedData = false, force = false } = options;

  try {
    console.log('Initializing database...');

    // Check connection first
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database');
    }

    // Run setup script if requested
    if (runMigrations || force) {
      console.log('Running database setup...');
      await runSqlFile('setup_database.sql');
    }

    // Seed data if requested
    if (seedData || force) {
      console.log('Seeding database with test data...');
      await runSqlFile('seed_data.sql');
    }

    console.log('Database initialization completed successfully');

  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
};

/**
 * Run SQL file
 * @param {string} filename - SQL file name in sql directory
 */
const runSqlFile = async (filename) => {
  const sqlPath = path.join(__dirname, 'sql', filename);

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await query(statement);
      } catch (error) {
        console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
        throw error;
      }
    }
  }
};

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
const getStats = async () => {
  try {
    const queries = [
      {
        name: 'tables',
        query: `
          SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes
          FROM pg_stat_user_tables 
          ORDER BY schemaname, tablename
        `
      },
      {
        name: 'connections',
        query: `
          SELECT count(*) as active_connections, 
                 max_conn, 
                 max_conn - count(*) as available_connections
          FROM pg_stat_activity, 
               (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') mc
          WHERE state = 'active'
          GROUP BY max_conn
        `
      },
      {
        name: 'database_size',
        query: `
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `
      }
    ];

    const stats = {};

    for (const { name, query: queryText } of queries) {
      const result = await query(queryText);
      stats[name] = result.rows;
    }

    return stats;

  } catch (error) {
    console.error('Error getting database stats:', error.message);
    throw error;
  }
};

/**
 * Close database connections
 */
const close = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connections closed');
  }
};

/**
 * Utility functions for common database operations
 */
const utils = {
  /**
   * Build WHERE clause from filters
   * @param {Object} filters - Filter object
   * @param {number} startIndex - Starting parameter index
   * @returns {Object} {clause, params, nextIndex}
   */
  buildWhereClause: (filters, startIndex = 1) => {
    const conditions = [];
    const params = [];
    let paramIndex = startIndex;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          // IN clause for arrays
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        } else if (typeof value === 'string' && value.includes('%')) {
          // LIKE clause for patterns
          conditions.push(`${key} ILIKE $${paramIndex++}`);
          params.push(value);
        } else {
          // Equality clause
          conditions.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    });

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return {
      clause,
      params,
      nextIndex: paramIndex
    };
  },

  /**
   * Build pagination clause
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @param {number} paramIndex - Starting parameter index
   * @returns {Object} {clause, params, nextIndex}
   */
  buildPaginationClause: (page = 1, limit = 20, paramIndex = 1) => {
    const offset = (page - 1) * limit;
    return {
      clause: `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params: [limit, offset],
      nextIndex: paramIndex + 2
    };
  },

  /**
   * Build ORDER BY clause
   * @param {string} sortBy - Column to sort by
   * @param {string} sortOrder - ASC or DESC
   * @returns {string} ORDER BY clause
   */
  buildOrderClause: (sortBy = 'id', sortOrder = 'ASC') => {
    const validOrders = ['ASC', 'DESC'];
    const order = validOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    return `ORDER BY ${sortBy} ${order}`;
  }
};

module.exports = {
  getPool,
  query,
  transaction,
  multiQuery,
  checkConnection,
  initializeDatabase,
  runSqlFile,
  getStats,
  close,
  utils
};