-- Migration: Add support for project owner-funded bounties
-- Project owners can fund bounties from their own wallets

-- Add creator wallet address to bounties table
ALTER TABLE bounties 
ADD COLUMN IF NOT EXISTS creator_wallet_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS funding_source VARCHAR(20) DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS on_chain_bounty_id BIGINT;

-- funding_source can be: 'platform' (bot pays), 'owner' (project owner pays), 'sponsor' (third party)

COMMENT ON COLUMN bounties.creator_wallet_address IS 'Ethereum address of the wallet that funded this bounty';
COMMENT ON COLUMN bounties.funding_source IS 'Who funded the bounty: platform, owner, or sponsor';
COMMENT ON COLUMN bounties.on_chain_bounty_id IS 'Bounty ID from the smart contract (if created on-chain)';

-- Add ethereum address to users table for project owners
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ethereum_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS eth_address_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS eth_verification_nonce VARCHAR(64);

COMMENT ON COLUMN users.ethereum_address IS 'Linked Ethereum wallet address for funding bounties';
COMMENT ON COLUMN users.eth_address_verified IS 'Whether the address has been verified via signature';
COMMENT ON COLUMN users.eth_verification_nonce IS 'Nonce used for signature verification';

-- Create table for project funding settings
CREATE TABLE IF NOT EXISTS project_settings (
    id SERIAL PRIMARY KEY,
    repository VARCHAR(255) NOT NULL UNIQUE,
    owner_github_login VARCHAR(255) NOT NULL,
    funding_mode VARCHAR(20) DEFAULT 'owner',  -- 'owner', 'platform', 'disabled'
    default_bounty_amount DECIMAL(20, 8) DEFAULT 50,
    max_bounty_amount DECIMAL(20, 8) DEFAULT 500,
    auto_create_bounties BOOLEAN DEFAULT TRUE,
    escalation_enabled BOOLEAN DEFAULT TRUE,
    escalation_schedule JSONB DEFAULT '[24, 72, 168]',
    escalation_multipliers JSONB DEFAULT '[1.2, 1.5, 2.0]',
    funding_wallet_address VARCHAR(42),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE project_settings IS 'Per-project bounty and funding configuration';
COMMENT ON COLUMN project_settings.funding_mode IS 'How bounties are funded: owner (project owner), platform (FixFlow), disabled';
COMMENT ON COLUMN project_settings.funding_wallet_address IS 'Ethereum address that funds bounties for this project';

-- Create table for tracking on-chain events
CREATE TABLE IF NOT EXISTS blockchain_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    bounty_id BIGINT,
    data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_type ON blockchain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_processed ON blockchain_events(processed);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_block ON blockchain_events(block_number);

COMMENT ON TABLE blockchain_events IS 'Log of blockchain events for bounty sync';

-- Create table for pending bounty funding requests
CREATE TABLE IF NOT EXISTS pending_bounty_funding (
    id SERIAL PRIMARY KEY,
    repository VARCHAR(255) NOT NULL,
    issue_id INTEGER NOT NULL,
    issue_url TEXT,
    requested_amount DECIMAL(20, 8) NOT NULL,
    max_amount DECIMAL(20, 8),
    funder_github_login VARCHAR(255) NOT NULL,
    funder_wallet_address VARCHAR(42),
    funding_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'funded', 'expired', 'cancelled'
    funding_deadline TIMESTAMP,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(repository, issue_id)
);

COMMENT ON TABLE pending_bounty_funding IS 'Bounties waiting for on-chain funding by project owners';

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for project_settings
DROP TRIGGER IF EXISTS update_project_settings_updated_at ON project_settings;
CREATE TRIGGER update_project_settings_updated_at
    BEFORE UPDATE ON project_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for pending_bounty_funding
DROP TRIGGER IF EXISTS update_pending_bounty_funding_updated_at ON pending_bounty_funding;
CREATE TRIGGER update_pending_bounty_funding_updated_at
    BEFORE UPDATE ON pending_bounty_funding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();