-- GitHub Marketplace Subscriptions Table
-- Tracks subscription status for GitHub Marketplace customers

CREATE TABLE IF NOT EXISTS marketplace_subscriptions (
    id SERIAL PRIMARY KEY,
    
    -- GitHub Account Info
    github_account_id BIGINT UNIQUE NOT NULL,
    github_account_login VARCHAR(255) NOT NULL,
    github_account_type VARCHAR(50) NOT NULL, -- 'User' or 'Organization'
    
    -- Current Plan Info
    plan_id INTEGER NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'free'
    unit_count INTEGER DEFAULT 1,
    
    -- Trial Info
    on_free_trial BOOLEAN DEFAULT FALSE,
    free_trial_ends_on TIMESTAMP WITH TIME ZONE,
    
    -- Billing Info
    next_billing_date TIMESTAMP WITH TIME ZONE,
    
    -- Pending Changes (for scheduled upgrades/downgrades)
    pending_plan_id INTEGER,
    pending_plan_name VARCHAR(255),
    pending_change_effective_date TIMESTAMP WITH TIME ZONE,
    
    -- Subscription Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'pending', 'suspended'
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_effective_date TIMESTAMP WITH TIME ZONE,
    
    -- Audit Info
    purchased_by VARCHAR(255), -- GitHub login of who made the purchase
    effective_date TIMESTAMP WITH TIME ZONE,
    
    -- Additional Metadata (plan details, features, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_status ON marketplace_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_plan_id ON marketplace_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_github_login ON marketplace_subscriptions(github_account_login);

-- Add comment to describe the table
COMMENT ON TABLE marketplace_subscriptions IS 'Tracks GitHub Marketplace subscription status for FixFlow app';
COMMENT ON COLUMN marketplace_subscriptions.status IS 'Current subscription status: active, cancelled, pending, suspended';
COMMENT ON COLUMN marketplace_subscriptions.metadata IS 'JSON object containing plan details: description, price, features, etc.';