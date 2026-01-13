# FixFlow Setup Guide

## Overview

This guide will walk you through setting up the FixFlow system for your GitHub repositories.

## Prerequisites

- Node.js 18+ and npm
- GitHub account with admin access to target repositories
- PostgreSQL database (local or cloud)
- MNEE account with API credentials

## Step 1: Set Up PostgreSQL Database

### 1.1 Install PostgreSQL

For Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

For macOS:
```bash
brew install postgresql
brew services start postgresql
```

### 1.2 Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE FixFlow;
CREATE USER bounty_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE FixFlow TO bounty_user;
\q
```

## Step 2: Set Up GitHub App

### 2.1 Create GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Configure with these settings:

**Basic Information:**
- Name: `FixFlow Bot`
- Homepage URL: `https://github.com/fix-flow/fix-flow`
- Webhook URL: `https://your-bot-server.com/webhook`
- Webhook secret: Generate a secure random string

**Permissions:**
- Repository permissions:
  - Actions: Read
  - Issues: Write
  - Pull requests: Read
  - Contents: Read
  - Metadata: Read

**Subscribe to events:**
- Workflow run
- Pull request
- Issues

### 2.2 Generate Private Key

After creating the app:
1. Generate a private key
2. Save it as `github-app-private-key.pem`
3. Note your App ID

## Step 3: Configure Bot Server

### 3.1 Set Up Environment

```bash
cd fix-flow/bot
cp .env.example .env
```

Configure `.env`:
```
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://bounty_user:your_password@localhost:5432/FixFlow

# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# ===========================================
# AWS Bedrock AI Configuration
# ===========================================
# Used for AI-powered test failure analysis
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# ===========================================
# MNEE Payment Configuration (Ethereum Mainnet)
# ===========================================
# MNEE Token Contract: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
# Etherscan: https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Enable blockchain mode (recommended)
USE_BLOCKCHAIN=true

# Ethereum RPC URL (Alchemy/Infura)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Bot's Ethereum private key
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key

# BountyEscrow contract address
BOUNTY_ESCROW_ADDRESS=0x_your_deployed_escrow_contract

# MNEE Token address (mainnet)
MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Security
JWT_SECRET=generate_secure_secret
API_KEY=generate_secure_api_key
```

### 3.2 Fund Bot Wallet

1. **Get MNEE tokens**: Acquire MNEE on Ethereum mainnet
2. **Fund the bot wallet**: Transfer MNEE to your bot's Ethereum address
3. **Fund with ETH**: The bot needs ETH for gas fees to execute transactions
4. Recommended starting balance:
   - 500-1000 MNEE for bounty payments
   - 0.1 ETH for gas fees

> **MNEE Token Address (Mainnet):** `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
>
> Verify on [Etherscan](https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF)

### 3.3 Install and Start

```bash
npm install

# Initialize database
npm run db:init

# Start server
npm start
```

## Step 4: Configure Repository

### 4.1 Install GitHub App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select repositories to install on

### 4.2 Add FixFlow Action

Create `.github/workflows/fix-flow.yml`:

```yaml
name: FixFlow

on:
  workflow_run:
    workflows: ["Tests", "CI"]  # Your test workflow names
    types:
      - completed

jobs:
  create-bounty:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Create Bounty
        uses: fixflow/fixflow-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          bot_server_url: https://api.fixflow.io  # Or your self-hosted instance
          bounty_amount: 50
          max_bounty: 150
```

> **Note:** No secrets required! The action uses your repository's built-in GITHUB_TOKEN
> for authentication. AWS credentials for AI analysis are configured on the server side.

### 4.3 Repository Secrets (Optional)

For the hosted FixFlow service, **no secrets are required**!

For self-hosted instances, optionally set:
- `FIXFLOW_SERVER_URL`: Your self-hosted bot server URL (if not using the default)

### 4.4 (Optional) Add Configuration File

Create `.fix-flow.yml` in repository root:

```yaml
bounty_config:
  default_amount: 50
  max_bounty: 200
  
  severity_multipliers:
    critical: 4.0
    high: 2.0
    medium: 1.0
    low: 0.5
  
  test_type_amounts:
    unit: 30
    integration: 50
    e2e: 75
    security: 150
  
  escalation:
    enabled: true
    schedule:
      - after_hours: 24
        increase_percent: 20
      - after_hours: 72
        increase_percent: 50
      - after_hours: 168
        increase_percent: 100
```

## Step 5: Test the System

### 5.1 Create a Failing Test

Add a test that will fail:

```javascript
// test/example.test.js
describe('Bounty Test', () => {
  it('should fail to trigger bounty', () => {
    expect(true).toBe(false);
  });
});
```

### 5.2 Push and Verify

1. Push the failing test
2. Wait for CI to fail
3. Check that:
   - GitHub issue is created
   - Bounty is stored in PostgreSQL
   - Bot posts confirmation comment

### 5.3 Fix and Claim

1. Create a PR fixing the test
2. Add your MNEE address in PR comment:
   ```
   Fixed the failing test! 🎉
   MNEE: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
   ```
3. Once merged and tests pass:
   - Bounty is released to PR author
   - Issue is closed

## Troubleshooting

### Bot Not Creating Bounties

1. Check bot server logs
2. Verify GitHub App permissions
3. Ensure bot wallet has MNEE funds
4. Check API key in GitHub Action

### Payment Failures

1. Verify MNEE credentials in `.env`
2. Check bot wallet balance
3. Ensure valid MNEE address in PR
4. Review payment logs

### Database Connection Issues

1. Check PostgreSQL is running
2. Verify connection string
3. Ensure database exists
4. Check user permissions

### Escalation Not Working

1. Check cron job is running
2. Verify time thresholds
3. Review escalation logs
4. Ensure bot has MNEE for increases

## Security Considerations

1. **Private Keys**: Never commit private keys
2. **API Keys**: Rotate regularly
3. **Webhook Secret**: Use strong random values
4. **Bot Wallet**: Only fund with necessary amounts
5. **Database**: Use strong passwords and SSL connections

## Monitoring

### Bot Health

- Health endpoint: `GET /health`
- Metrics endpoint: `GET /api/admin/metrics`
- Logs: Check `combined.log` and `error.log`

### Database Monitoring

- Query performance: Monitor slow queries
- Connection pool: Check active connections
- Disk usage: Monitor database size

### MNEE Wallet Monitoring

- Balance alerts: Set up low balance notifications
- Transaction history: Track all payments
- Failed payments: Monitor and retry

## Support

- GitHub Issues: [fix-flow/fix-flow](https://github.com/fix-flow/fix-flow/issues)
- Documentation: [docs/](https://github.com/fix-flow/fix-flow/tree/main/docs)
- Discord: [Join our server](https://discord.gg/fix-flow)