
import pg from 'pg';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();

export const initDb = async () => {
    const client = await pool.connect();
    try {
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
        `);
        logger.info('Database initialized - bounties and github_installations tables created/verified');
    } catch (err) {
        logger.error('Failed to initialize database:', err);
        throw err;
    } finally {
        client.release();
    }
};

export default {
    query,
    getClient,
    initDb
};
