# FixFlow Deployment Guide

This guide walks you through deploying the FixFlow system to production using Docker on an EC2 instance with Nginx and SSL.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Docker Deployment (Recommended)](#docker-deployment-recommended)
  - [EC2 Server Setup](#ec2-server-setup)
  - [Docker Installation](#docker-installation)
  - [AWS RDS Database Setup](#aws-rds-database-setup)
  - [Environment Configuration](#environment-configuration)
  - [Building and Running Containers](#building-and-running-containers)
  - [Nginx Setup as Reverse Proxy](#nginx-setup-as-reverse-proxy)
  - [SSL Setup with Let's Encrypt](#ssl-setup-with-lets-encrypt)
- [Traditional Deployment](#traditional-deployment)
- [GitHub App Setup](#github-app-setup)
- [MNEE Configuration](#mnee-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Security Checklist](#security-checklist)

## Prerequisites

Before deploying, ensure you have:

1. **EC2 Instance**
   - Ubuntu 22.04 LTS or Amazon Linux 2023
   - Minimum t3.small (2 vCPU, 2GB RAM)
   - At least 20GB storage
   - Security group with ports 22, 80, 443 open

2. **AWS RDS PostgreSQL**
   - PostgreSQL 14+ instance
   - Security group allowing access from EC2
   - Database credentials

3. **Domain Name**
   - Domain pointing to EC2 public IP
   - Separate subdomains for API and frontend (optional)

4. **GitHub App**
   - Created and configured
   - App ID and private key downloaded

5. **MNEE Account**
   - Production API key
   - Funded MNEE wallet
   - Wallet private key (WIF format)

---

## Docker Deployment (Recommended)

### EC2 Server Setup

#### 1. Connect to Your EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### 2. Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

#### 3. Install Required Packages

```bash
sudo apt install -y git curl wget
```

### Docker Installation

#### 1. Install Docker

```bash
# Add Docker's official GPG key
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. Verify Docker Installation

```bash
docker --version
docker compose version
```

### AWS RDS Database Setup

#### 1. Create RDS PostgreSQL Instance

1. Go to AWS Console > RDS > Create database
2. Select PostgreSQL (version 14+)
3. Choose appropriate instance size (db.t3.micro for testing, db.t3.small+ for production)
4. Configure:
   - **DB instance identifier**: fixflow-db
   - **Master username**: fixflow
   - **Master password**: (generate a strong password)
   - **Database name**: fixflow

#### 2. Configure Security Group

Ensure your RDS security group allows inbound connections on port 5432 from your EC2 instance:

```bash
# Example: Allow from EC2 security group or specific IP
Inbound Rule:
  Type: PostgreSQL
  Port: 5432
  Source: sg-xxxxxx (your EC2 security group)
```

#### 3. Get Connection Details

After RDS is available, note the endpoint:
```
Endpoint: fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
Port: 5432
```

Your connection string will be:
```
postgresql://fixflow:your_password@fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/fixflow?sslmode=require
```

### Environment Configuration

#### 1. Clone the Repository

```bash
cd /home/ubuntu
git clone < repo >
cd fix-flow
```

#### 2. Create Production Environment File

Create a `.env` file in the `fix-flow` directory:

```bash
nano .env
```

Add the following configuration:

```env
# ============================================
# FixFlow Production Environment Configuration
# ============================================

# Server Configuration
NODE_ENV=production
PORT=3000

# Bot Server URLs
BOT_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database (AWS RDS PostgreSQL)
DATABASE_URL=postgresql://fixflow:your_password@fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/fixflow?sslmode=require

# Security Keys (generate with: openssl rand -hex 32)
API_KEY=your_api_key_for_github_actions
JWT_SECRET=your_jwt_secret_here
ADMIN_API_KEY=your_admin_api_key_here

# GitHub App Configuration
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_NAME=fixflow-bot
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_CLIENT_ID=your_github_app_client_id
GITHUB_APP_CLIENT_SECRET=your_github_app_client_secret
GITHUB_APP_SETUP_REDIRECT_URL=https://yourdomain.com/dashboard
GITHUB_APP_OAUTH_REDIRECT_URL=https://yourdomain.com/auth/callback

# GitHub App Private Key (raw with \n for newlines)
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"

# ===========================================
# MNEE Payment Configuration
# ===========================================
# FixFlow uses MNEE (ERC-20 token) on Ethereum mainnet
# Contract: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Enable blockchain mode for Ethereum MNEE token (recommended)
USE_BLOCKCHAIN=true

# Ethereum RPC URL (use Alchemy, Infura, or your own node)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Bot's Ethereum private key (for signing transactions)
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key_here

# Deployed BountyEscrow contract address
BOUNTY_ESCROW_ADDRESS=0x_your_escrow_contract_address

# MNEE Token address (mainnet)
MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Legacy MNEE SDK configuration (if USE_BLOCKCHAIN=false)
# MNEE_ENVIRONMENT=production
# MNEE_API_KEY=your_mnee_api_key
# MNEE_BOT_ADDRESS=your_mnee_wallet_address
# MNEE_BOT_WIF=your_mnee_wallet_private_key_wif

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Logging
LOG_LEVEL=info

# Escalation (check every hour)
ESCALATION_CHECK_INTERVAL=3600000
```

#### 3. Create GitHub App Private Key File (Alternative Method)

If you prefer using a file for the private key:

```bash
# Create secrets directory
mkdir -p secrets

# Copy your private key
nano secrets/github-app.pem
# Paste your private key content

# Update docker-compose to mount the file
```

### Building and Running Containers

#### 1. Build Docker Images

```bash
cd /home/ubuntu/fix-flow

# Build all services
docker compose build
```

#### 2. Start Services

```bash
# Start all services in detached mode
docker compose up -d
```

#### 3. Verify Services are Running

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Check specific service logs
docker compose logs bot -f
docker compose logs frontend -f
```

#### 4. Run Database Migrations

```bash
# Execute migration inside bot container
docker compose exec bot npm run db:migrate:prod
```

### Nginx and SSL Setup

**IMPORTANT**: You must obtain SSL certificates BEFORE enabling the HTTPS Nginx config. Follow these steps in order.

#### 1. Install Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. Create ACME Challenge Directory

```bash
sudo mkdir -p /var/www/certbot
```

#### 3. Create Initial HTTP-Only Config (For Certificate Acquisition)

First, create a simple HTTP-only config to obtain certificates:

```bash
sudo nano /etc/nginx/sites-available/fixflow
```

Add this **temporary HTTP-only configuration**:

```nginx
# ============================================
# FixFlow Nginx Configuration - HTTP Only
# Use this first to obtain SSL certificates
# ============================================

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com api.yourdomain.com;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Temporary: return OK for all other requests
    location / {
        return 200 'FixFlow - Obtaining SSL certificates...';
        add_header Content-Type text/plain;
    }
}
```

#### 4. Enable the Site and Test

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/fixflow /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 5. Obtain SSL Certificates

Now get certificates using certbot:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
    -d yourdomain.com \
    -d api.yourdomain.com \
    --email your-email@example.com \
    --agree-tos \
    --non-interactive
```

Verify certificates were created:
```bash
sudo ls -la /etc/letsencrypt/live/yourdomain.com/
```

#### 6. Update Nginx to Full HTTPS Config

Now that certificates exist, update the Nginx config with full HTTPS support:

```bash
sudo nano /etc/nginx/sites-available/fixflow
```

Replace the contents with the **full HTTPS configuration**:

```nginx
# ============================================
# FixFlow Nginx Configuration - Full HTTPS
# Use after SSL certificates are obtained
# ============================================

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=30r/s;

# Upstream definitions
upstream fixflow_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream fixflow_frontend {
    server 127.0.0.1:3001;
    keepalive 32;
}

# HTTP - Redirect all to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com api.yourdomain.com;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# API Server (api.yourdomain.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/fixflow-api-access.log;
    error_log /var/log/nginx/fixflow-api-error.log;

    # Client body size for webhooks
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # API endpoints
    location / {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://fixflow_api;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # GitHub Webhooks (higher rate limit)
    location /webhooks/github {
        limit_req zone=webhook_limit burst=50 nodelay;

        proxy_pass http://fixflow_api/webhooks/github;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-GitHub-Event $http_x_github_event;
        proxy_set_header X-GitHub-Delivery $http_x_github_delivery;
        proxy_set_header X-Hub-Signature $http_x_hub_signature;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://fixflow_api/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}

# Frontend Server (yourdomain.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.yourdomain.com;" always;

    # Logging
    access_log /var/log/nginx/fixflow-frontend-access.log;
    error_log /var/log/nginx/fixflow-frontend-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_disable "MSIE [1-6]\.";

    location / {
        proxy_pass http://fixflow_frontend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_cache_bypass $http_upgrade;
    }

    # Static file caching
    location /_next/static {
        proxy_pass http://fixflow_frontend/_next/static;
        proxy_http_version 1.1;
        
        # Cache static assets for 1 year
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

#### 7. Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 8. Configure SSL Auto-Renewal

#### 4. Configure Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically adds a systemd timer for renewal
# Verify it's active
sudo systemctl status certbot.timer
```

#### 5. Create Post-Renewal Hook (Reload Nginx)

```bash
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

```bash
#!/bin/bash
systemctl reload nginx
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### Verifying the Deployment

#### 1. Check All Services

```bash
# Docker containers
docker compose ps

# Nginx status
sudo systemctl status nginx

# Check API health
curl https://api.yourdomain.com/health

# Check frontend
curl -I https://yourdomain.com
```

#### 2. Check SSL Certificates

```bash
# Test SSL configuration
curl -vI https://api.yourdomain.com 2>&1 | grep -A5 "SSL certificate"

# Online SSL test
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

#### 3. Test GitHub Webhook

```bash
curl -X POST https://api.yourdomain.com/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "test"}'
```

---

## Traditional Deployment

If you prefer not to use Docker, follow these steps:

### 1. Server Requirements

- **CPU**: 2+ cores
- **RAM**: 4GB minimum
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ or similar

### 2. Setup Environment

```bash
# Clone repository
git clone < repo >
cd fix-flow/bot

# Install dependencies
npm install --production

# Setup environment
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` with production values (see Environment Configuration section above).

### 4. Setup Process Manager

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Create ecosystem config
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'fixflow-bot',
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

---

## GitHub App Setup

### 1. Create GitHub App

Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App

**Settings:**
- **Name**: FixFlow Bot
- **Homepage URL**: https://yourdomain.com
- **Webhook URL**: https://api.yourdomain.com/webhooks/github
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
curl -X POST https://api.yourdomain.com/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

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
   - URL: `https://api.yourdomain.com/webhooks/mnee-status`
   - Events: Transaction status updates

### 2. Test Configuration

```bash
# Test MNEE connection
curl https://api.yourdomain.com/api/bounties/wallet/balance \
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

---

## Monitoring Setup

### 1. Docker Monitoring

```bash
# View container stats
docker stats

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs bot -f --tail 100
```

### 2. Health Checks

```bash
# API health
curl https://api.yourdomain.com/health

# Database health (via API)
curl https://api.yourdomain.com/api/admin/health \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

### 3. Log Rotation

Create a logrotate config for Nginx:

```bash
sudo nano /etc/logrotate.d/fixflow
```

```
/var/log/nginx/fixflow-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### 4. Setup Alerts

Monitor for:
- Low MNEE wallet balance (< 100 MNEE)
- High error rate (> 1% of requests)
- Database connection issues
- GitHub webhook failures
- Container health status

---

## Security Checklist

### 1. Environment Variables
- [ ] All secrets in environment variables
- [ ] No hardcoded credentials
- [ ] Secure secret generation
- [ ] Regular key rotation

### 2. Network Security
- [ ] SSL/TLS enabled with strong ciphers
- [ ] Firewall configured (only 22, 80, 443 open)
- [ ] Rate limiting configured
- [ ] DDoS protection enabled (CloudFlare/AWS Shield)

### 3. Application Security
- [ ] Input validation on all endpoints
- [ ] CORS properly configured
- [ ] Authentication on all routes
- [ ] SQL injection prevention

### 4. Database Security
- [ ] Strong passwords
- [ ] SSL connections required
- [ ] Regular backups configured
- [ ] Access controls configured

### 5. Docker Security
- [ ] Non-root users in containers
- [ ] Read-only file systems where possible
- [ ] Resource limits set
- [ ] Regular image updates

### 6. MNEE Security
- [ ] Private keys encrypted at rest
- [ ] Wallet balance monitoring
- [ ] Transaction validation
- [ ] Webhook signature verification

---

## Common Operations

### Updating the Application

```bash
cd /home/ubuntu/fix-flow

# Pull latest changes
git pull origin main

# Rebuild containers
docker compose build

# Restart services
docker compose down
docker compose up -d

# Run any new migrations
docker compose exec bot npm run db:migrate:prod
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs bot -f
docker compose logs frontend -f

# Nginx logs
sudo tail -f /var/log/nginx/fixflow-api-access.log
sudo tail -f /var/log/nginx/fixflow-api-error.log
```

### Backup Database (AWS RDS)

```bash
# Create manual snapshot in AWS Console
# Or use AWS CLI:
aws rds create-db-snapshot \
  --db-instance-identifier fixflow-db \
  --db-snapshot-identifier fixflow-backup-$(date +%Y%m%d)

# For local backup using pg_dump (from EC2):
PGPASSWORD='your_password' pg_dump -h fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com \
  -U fixflow -d fixflow > backup_$(date +%Y%m%d).sql

# Restore from backup:
PGPASSWORD='your_password' psql -h fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com \
  -U fixflow -d fixflow < backup_20240101.sql
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart bot
docker compose restart frontend

# Full restart (down + up)
docker compose down && docker compose up -d
```

---

## Troubleshooting

### Container Issues

```bash
# Check container status
docker compose ps

# View container logs
docker compose logs bot --tail 100

# Enter container shell
docker compose exec bot sh

# Check container resource usage
docker stats
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Reload configuration
sudo systemctl reload nginx
```

### SSL Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Database Issues (AWS RDS)

```bash
# Connect to RDS database from EC2
PGPASSWORD='your_password' psql -h fixflow-db.xxxxxxxxx.us-east-1.rds.amazonaws.com \
  -U fixflow -d fixflow

# Check connections
SELECT * FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('fixflow'));

# Check RDS metrics in AWS Console:
# - CPU Utilization
# - Database Connections
# - Free Storage Space
```

---

## Support

For deployment issues:
- Documentation: https://docs.fixflow.io
- GitHub Issues: https://github.com/tufstraka/fixflow/issues
- Discord: https://discord.gg/fixflow
- Email: support@locsafe.org