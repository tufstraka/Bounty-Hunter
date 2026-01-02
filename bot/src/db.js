
import pg from 'pg';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const { Pool } = pg;

// Parse and log connection info (without password)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (connectionString) {
    try {
        const url = new URL(connectionString);
        logger.info('Database configuration', {
            host: url.hostname,
            port: url.port || '5432',
            database: url.pathname.slice(1),
            user: url.username,
            ssl: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'
        });
    } catch (e) {
        logger.warn('Could not parse DATABASE_URL for logging');
    }
} else {
    logger.error('DATABASE_URL or POSTGRES_URL not set!');
}

// AWS RDS Aurora requires SSL - detect RDS URLs and enable SSL
const isAwsRds = connectionString?.includes('rds.amazonaws.com');
const sslConfig = isAwsRds || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false;

if (isAwsRds) {
    logger.info('AWS RDS detected - enabling SSL');
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: sslConfig,
    connectionTimeoutMillis: 30000, // 30 second timeout for remote databases
    idleTimeoutMillis: 30000,
    max: 20 // Maximum connections in pool
});

pool.on('connect', (client) => {
    logger.debug('New database client connected');
});

pool.on('acquire', (client) => {
    logger.debug('Database client acquired from pool');
});

pool.on('remove', (client) => {
    logger.debug('Database client removed from pool');
});

pool.on('error', (err, client) => {
    logger.error('Unexpected database pool error', {
        error: err.message,
        code: err.code,
        stack: err.stack
    });
    // Don't exit on pool errors - let the application handle individual query errors
});

export const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Database query executed', {
            query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: `${duration}ms`,
            rowCount: result.rowCount
        });
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('Database query failed', {
            query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: `${duration}ms`,
            error: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        throw error;
    }
};

export const getClient = async () => {
    logger.debug('Getting database client from pool');
    try {
        const client = await pool.connect();
        logger.debug('Database client obtained');
        return client;
    } catch (error) {
        logger.error('Failed to get database client', {
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

export const initDb = async () => {
    logger.info('Initializing database...');
    let client;
    try {
        client = await pool.connect();
        logger.info('Connected to database, creating tables...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS bounties (
                id SERIAL PRIMARY KEY,
                bounty_id INTEGER UNIQUE NOT NULL,
                repository VARCHAR(255) NOT NULL,
                issue_id INTEGER NOT NULL,
                issue_url TEXT NOT NULL,
                initial_amount NUMERIC NOT NULL,
                current_amount NUMERIC NOT NULL,
                max_amount NUMERIC NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                solver VARCHAR(255),
                claimed_amount NUMERIC,
                transaction_hash VARCHAR(255) NOT NULL,
                claim_transaction_hash VARCHAR(255),
                block_number INTEGER NOT NULL,
                pull_request_url TEXT,
                escalation_count INTEGER DEFAULT 0,
                last_escalation TIMESTAMP,
                metadata JSONB,
                claimed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_bounties_repository_status_created_at ON bounties(repository, status, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_bounties_status_last_escalation ON bounties(status, last_escalation);
            CREATE INDEX IF NOT EXISTS idx_bounties_repository ON bounties(repository);
            CREATE INDEX IF NOT EXISTS idx_bounties_bounty_id ON bounties(bounty_id);

            -- GitHub App Installations table
            CREATE TABLE IF NOT EXISTS github_installations (
                id SERIAL PRIMARY KEY,
                installation_id BIGINT UNIQUE NOT NULL,
                account_login VARCHAR(255) NOT NULL,
                account_type VARCHAR(50) NOT NULL,
                account_id BIGINT NOT NULL,
                repositories JSONB DEFAULT '[]',
                permissions JSONB DEFAULT '{}',
                suspended_at TIMESTAMP,
                suspended_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_github_installations_installation_id ON github_installations(installation_id);
            CREATE INDEX IF NOT EXISTS idx_github_installations_account_login ON github_installations(account_login);

            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                github_id BIGINT UNIQUE NOT NULL,
                github_login VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255),
                name VARCHAR(255),
                avatar_url TEXT,
                role VARCHAR(50) DEFAULT 'user',
                mnee_address VARCHAR(255),
                access_token TEXT,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                total_earned NUMERIC DEFAULT 0,
                bounties_claimed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
            CREATE INDEX IF NOT EXISTS idx_users_github_login ON users(github_login);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

            -- User sessions table
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

            -- Add user_id to bounties table if not exists
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='bounties' AND column_name='creator_id') THEN
                    ALTER TABLE bounties ADD COLUMN creator_id INTEGER REFERENCES users(id);
                END IF;
            END $$;

            -- Add solver_github_login column to bounties table if not exists
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='bounties' AND column_name='solver_github_login') THEN
                    ALTER TABLE bounties ADD COLUMN solver_github_login VARCHAR(255);
                    CREATE INDEX IF NOT EXISTS idx_bounties_solver_github_login ON bounties(solver_github_login);
                END IF;
            END $$;
        `);
        logger.info('Database initialized successfully - all tables created/verified');
    } catch (err) {
        logger.error('Failed to initialize database', {
            error: err.message,
            code: err.code,
            detail: err.detail,
            hint: err.hint,
            stack: err.stack
        });
        throw err;
    } finally {
        if (client) {
            client.release();
            logger.debug('Database client released');
        }
    }
};

export const resetDb = async () => {
    const client = await pool.connect();
    try {
        logger.warn('Resetting database - dropping all tables');
        await client.query(`
            DROP TABLE IF EXISTS user_sessions CASCADE;
            DROP TABLE IF EXISTS bounties CASCADE;
            DROP TABLE IF EXISTS github_installations CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `);
        logger.info('All tables dropped');
        
        // Re-initialize
        await initDb();
    } catch (err) {
        logger.error('Failed to reset database:', err);
        throw err;
    } finally {
        client.release();
    }
};

// CLI support for npm scripts
if (process.argv[1] && process.argv[1].endsWith('db.js')) {
    const args = process.argv.slice(2);
    
    if (args.includes('--init') || args.includes('--migrate')) {
        initDb()
            .then(() => {
                logger.info('Database initialization complete');
                process.exit(0);
            })
            .catch((err) => {
                logger.error('Database initialization failed:', err);
                process.exit(1);
            });
    } else if (args.includes('--reset')) {
        resetDb()
            .then(() => {
                logger.info('Database reset complete');
                process.exit(0);
            })
            .catch((err) => {
                logger.error('Database reset failed:', err);
                process.exit(1);
            });
    } else {
        console.log('Usage: node src/db.js [--init|--migrate|--reset]');
        process.exit(0);
    }
}

export default {
    query,
    getClient,
    initDb,
    resetDb
};
