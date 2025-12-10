# FixFlow Deployment Guide

This guide walks you through deploying the FixFlow system to production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Bot Server Deployment](#bot-server-deployment)
- [GitHub App Setup](#github-app-setup)
- [MNEE Configuration](#mnee-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Security Checklist](#security-checklist)

## Prerequisites

Before deploying, ensure you have:

1. **PostgreSQL Database**
   - Production PostgreSQL instance
   - Secure connection credentials
   - Backup strategy in place

2. **MNEE Account**
   - Production API key
   - Funded MNEE wallet
   - Wallet private key (WIF format)

3. **GitHub App**
   - Created and configured
   - App ID and private key

4. **Infrastructure**
   - Node.js server (v18+)
   - Domain with SSL
   - Minimum 2GB RAM

## Database Setup

### 1. Create Production Database

```bash
# For cloud providers (e.g., AWS RDS, Google Cloud SQL)
# Follow provider-specific instructions

# For self-hosted PostgreSQL
sudo -u postgres psql
CREATE DATABASE bounty_hunter_prod;
CREATE USER bounty_prod WITH ENCRYPTED PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE bounty_hunter_prod TO bounty_prod;
\q
```

### 2. Configure SSL Connection

```bash
# Download SSL certificate from provider
# Update connection string with SSL parameters
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&sslcert=client-cert.pem"
```

### 3. Run Migrations

```bash
cd bounty-hunter/bot
npm run db:migrate:prod
```

## Bot Server Deployment

### 1. Server Requirements

- **CPU**: 2+ cores
- **RAM**: 4GB minimum
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ or similar

### 2. Setup Environment

```bash
# Clone repository
git clone https://github.com/bounty-hunter/bounty-hunter.git
cd bounty-hunter/bot

# Install dependencies
npm install --production

# Setup environment
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` with production values:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
BOT_URL=https://api.bounty-hunter.io

# Database
DATABASE_URL=postgresql://bounty_prod:password@db.example.com:5432/bounty_hunter_prod?sslmode=require

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# MNEE
MNEE_ENVIRONMENT=production
MNEE_API_KEY=your_production_api_key
MNEE_BOT_ADDRESS=1YourMNEEWalletAddress...
MNEE_BOT_WIF=LYourPrivateKeyInWIFFormat...

# Security
API_SECRET=your_api_secret
JWT_SECRET=your_jwt_secret
ALLOWED_ORIGINS=https://bounty-hunter-dashboard.vercel.app
```

### 4. Setup Process Manager

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Create ecosystem config
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'bounty-hunter-bot',
    script: './src/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### 5. Configure Nginx

```nginx
server {
    listen 80;
    server_name api.bounty-hunter.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.bounty-hunter.io;

    ssl_certificate /etc/letsencrypt/live/api.bounty-hunter.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bounty-hunter.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhooks {
        proxy_pass http://localhost:3000/webhooks;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }
}
```

### 6. Setup SSL

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.bounty-hunter.io

# Auto-renewal
sudo certbot renew --dry-run
```

## GitHub App Setup

### 1. Create GitHub App

Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App

**Settings:**
- **Name**: FixFlow Bot
- **Homepage URL**: https://bounty-hunter.io
- **Webhook URL**: https://api.bounty-hunter.io/webhooks/github
- **Webhook secret**: Generate a secure secret

**Permissions:**
- **Repository permissions:**
  - Issues: Read & Write
  - Pull requests: Read & Write
  - Actions: Read
  - Contents: Read
  - Checks: Read

- **Organization permissions:**
  - Members: Read

**Subscribe to events:**
- Pull request
- Pull request review
- Check run
- Check suite
- Issues

### 2. Install App

After creating the app:
1. Generate a private key
2. Note the App ID
3. Install on target repositories

### 3. Configure Webhook

Ensure webhook URL is accessible and returns 200 OK:
```bash
curl -X POST https://api.bounty-hunter.io/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## MNEE Configuration

### 1. Production Setup

1. **Get Production API Key**
   - Login to MNEE dashboard
   - Create production API key
   - Set appropriate permissions

2. **Fund Wallet**
   - Transfer MNEE to bot wallet
   - Recommended: 1000+ MNEE initial funding
   - Setup low balance alerts

3. **Configure Webhooks**
   - Add webhook URL in MNEE dashboard
   - URL: `https://api.bounty-hunter.io/webhooks/mnee-status`
   - Events: Transaction status updates

### 2. Test Configuration

```bash
# Test MNEE connection
curl http://localhost:3000/api/bounties/wallet/balance \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

Expected response:
```json
{
  "balance": 1000.50,
  "address": "1YourMNEEWalletAddress...",
  "currency": "MNEE"
}
```

## Monitoring Setup

### 1. Application Monitoring

**PM2 Monitoring:**
```bash
# View logs
pm2 logs bounty-hunter-bot

# Monitor resources
pm2 monit

# Setup web dashboard
pm2 install pm2-web
```

**Health Checks:**
```bash
# Add health endpoint
curl https://api.bounty-hunter.io/health
```

### 2. Database Monitoring

**Connection Pool Monitoring:**
```javascript
// Add to db.js
setInterval(async () => {
  const pool = await pgPool.query('SELECT count(*) FROM pg_stat_activity');
  console.log('Active connections:', pool.rows[0].count);
}, 60000);
```

**Query Performance:**
```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 3. Error Tracking

Setup Sentry for error tracking:

```javascript
// In bot/.env
SENTRY_DSN=your_sentry_dsn

// In src/index.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### 4. Metrics Dashboard

Setup Grafana + Prometheus:

1. **Install Prometheus:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'bounty-hunter'
    static_configs:
      - targets: ['localhost:3000']
```

2. **Add metrics endpoint:**
```javascript
// src/routes/metrics.js
const promClient = require('prom-client');
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const bountiesCreated = new promClient.Counter({
  name: 'bounties_created_total',
  help: 'Total number of bounties created'
});

register.registerMetric(bountiesCreated);
```

### 5. Alerts

Setup alerts for:
- Low MNEE wallet balance (< 100 MNEE)
- High error rate (> 1% of requests)
- Database connection issues
- GitHub webhook failures
- Failed payment transactions

## Security Checklist

### 1. Environment Variables
- [ ] All secrets in environment variables
- [ ] No hardcoded credentials
- [ ] Secure secret generation
- [ ] Regular key rotation

### 2. Network Security
- [ ] SSL/TLS enabled
- [ ] Firewall configured
- [ ] Only necessary ports open
- [ ] DDoS protection enabled

### 3. Application Security
- [ ] Input validation on all endpoints
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Authentication on all routes
- [ ] SQL injection prevention

### 4. Database Security
- [ ] Strong passwords
- [ ] SSL connections required
- [ ] Regular backups
- [ ] Access controls configured

### 5. MNEE Security
- [ ] Private keys encrypted at rest
- [ ] Wallet balance monitoring
- [ ] Transaction validation
- [ ] Webhook signature verification

### 6. Monitoring
- [ ] Error tracking enabled
- [ ] Performance monitoring
- [ ] Security alerts configured
- [ ] Regular log reviews

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Backup procedures in place

### Deployment
- [ ] Database migrated and seeded
- [ ] Bot server configured and running
- [ ] GitHub App installed on repositories
- [ ] MNEE wallet funded
- [ ] Monitoring systems active

### Post-deployment
- [ ] Health checks passing
- [ ] Test bounty creation
- [ ] Test payment flow
- [ ] Monitor for 24 hours
- [ ] Document any issues

## Rollback Procedure

If issues occur:

1. **Immediate Actions:**
   ```bash
   # Stop bot server
   pm2 stop bounty-hunter-bot
   
   # Disable GitHub webhooks
   # (In GitHub App settings)
   ```

2. **Investigate Issues:**
   - Check logs: `pm2 logs bounty-hunter-bot`
   - Review error tracking
   - Check database state

3. **Fix and Redeploy:**
   ```bash
   # Apply fixes
   git pull origin main
   npm install
   
   # Run migrations if needed
   npm run db:migrate:prod
   
   # Restart services
   pm2 restart bounty-hunter-bot
   ```

## Maintenance

### Regular Tasks

**Daily:**
- Check wallet balance
- Review error logs
- Monitor active bounties

**Weekly:**
- Review security alerts
- Check for dependency updates
- Backup database

**Monthly:**
- Rotate API keys
- Review access logs
- Update documentation
- Security patches

### Scaling Considerations

As usage grows:

1. **Database**: Consider connection pooling and read replicas
2. **API Server**: Add load balancer and multiple instances
3. **MNEE**: Setup multiple wallets for parallel processing
4. **Monitoring**: Implement distributed tracing

## Support

For deployment issues:
- Documentation: https://docs.bounty-hunter.io
- GitHub Issues: https://github.com/bounty-hunter/bounty-hunter/issues
- Discord: https://discord.gg/bounty-hunter
- Email: support@bounty-hunter.io