# FixFlow Troubleshooting Guide

## Table of Contents
- [Common Issues](#common-issues)
- [MNEE Payment Issues](#mnee-payment-issues)
- [Database Issues](#database-issues)
- [GitHub Integration Issues](#github-integration-issues)
- [Debugging Tools](#debugging-tools)

## Common Issues

### Bot Not Starting

**Symptoms:**
- Bot crashes on startup
- "Module not found" errors
- Connection errors

**Solutions:**

1. **Check Node.js version:**
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Verify environment variables:**
   ```bash
   # Check all required variables are set
   node -e "console.log(require('dotenv').config())"
   ```

4. **Check PostgreSQL connection:**
   ```bash
   # Test connection
   psql "postgresql://user:pass@host:5432/FixFlow"
   ```

### API Endpoints Not Responding

**Symptoms:**
- 404 errors on API calls
- Timeouts
- Empty responses

**Solutions:**

1. **Check server status:**
   ```bash
   pm2 status
   pm2 logs fix-flow-bot
   ```

2. **Verify port availability:**
   ```bash
   lsof -i :3000
   ```

3. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

## MNEE Payment Issues

### Payment Failed - Insufficient Balance

**Error:**
```
Insufficient MNEE balance. Have X, need Y MNEE
```

**Solutions:**

1. **Check wallet balance:**
   ```javascript
   const balance = await mneeService.getBalance();
   console.log(`Balance: ${balance.balance} MNEE`);
   ```

2. **Fund the wallet:**
   - Transfer MNEE to bot address
   - Wait for confirmation
   - Retry payment

3. **Monitor balance:**
   ```javascript
   // Add to startup routine
   setInterval(async () => {
     const balance = await mneeService.getBalance();
     if (balance.balance < 100) {
       logger.warn('Low MNEE balance!');
     }
   }, 3600000); // Check hourly
   ```

### Payment Failed - Invalid Address

**Error:**
```
Invalid MNEE address
```

**Solutions:**

1. **Validate address format:**
   ```javascript
   const isValid = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
   ```

2. **Common issues:**
   - Extra whitespace
   - Wrong network address
   - Typos in address

3. **Test with known address:**
   ```javascript
   // Sandbox test address
   const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
   ```

### Transaction Timeout

**Error:**
```
Transaction timeout after 60 seconds
```

**Solutions:**

1. **Check MNEE network status:**
   ```javascript
   const config = await mnee.config();
   console.log('MNEE network:', config);
   ```

2. **Increase timeout:**
   ```javascript
   // In mneeService.js
   async waitForConfirmation(ticketId, maxAttempts = 60) {
     // Increased from 30 to 60 attempts
   }
   ```

3. **Check ticket status manually:**
   ```javascript
   const status = await mnee.getTxStatus(ticketId);
   console.log('Status:', status);
   ```

### API Key Issues

**Error:**
```
Invalid API key (401/403)
```

**Solutions:**

1. **Verify API key:**
   - Check environment matches key (sandbox/production)
   - Ensure no extra spaces in .env
   - Regenerate if necessary

2. **Test API key:**
   ```javascript
   const mnee = new MNEE({ 
     apiKey: process.env.MNEE_API_KEY,
     environment: process.env.MNEE_ENVIRONMENT 
   });
   const config = await mnee.config();
   ```

## Database Issues

### Connection Timeout

**Error:**
```
Error: connect ETIMEDOUT
```

**Solutions:**

1. **Check connection string:**
   ```javascript
   // Test connection
   const { Pool } = require('pg');
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL
   });
   await pool.query('SELECT NOW()');
   console.log('Connected successfully');
   ```

2. **Check PostgreSQL service:**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Restart if needed
   sudo systemctl restart postgresql
   ```

3. **Check network:**
   ```bash
   # Test connectivity
   nc -zv your-database-host 5432
   ```

### Database Performance

**Symptoms:**
- Slow queries
- High memory usage

**Solutions:**

1. **Check indexes:**
   ```sql
   -- List all indexes
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public';
   
   -- Create missing indexes
   CREATE INDEX idx_bounties_state ON bounties(state);
   CREATE INDEX idx_bounties_repository ON bounties(repository);
   CREATE INDEX idx_bounties_created_at ON bounties(created_at);
   ```

2. **Analyze query performance:**
   ```sql
   -- Enable query timing
   \timing
   
   -- Explain query plan
   EXPLAIN ANALYZE SELECT * FROM bounties WHERE state = 'active';
   ```

3. **Vacuum database:**
   ```sql
   -- Clean up dead rows
   VACUUM ANALYZE bounties;
   ```

### Migration Issues

**Error:**
```
Migration failed: relation already exists
```

**Solutions:**

1. **Check migration status:**
   ```bash
   npm run db:migrate:status
   ```

2. **Reset migrations (development only):**
   ```bash
   # WARNING: This will drop all data
   npm run db:reset
   npm run db:migrate
   ```

## GitHub Integration Issues

### Webhook Not Receiving Events

**Symptoms:**
- No webhook calls logged
- Bounties not created automatically

**Solutions:**

1. **Verify webhook URL:**
   - Check GitHub App settings
   - Ensure URL is publicly accessible
   - Test with curl

2. **Check webhook secret:**
   ```javascript
   // Verify signature
   const signature = req.headers['x-hub-signature-256'];
   const verified = verifyWebhookSignature(payload, signature, secret);
   ```

3. **Review GitHub App permissions:**
   - Issues: Read & Write
   - Pull requests: Read & Write
   - Actions: Read

4. **Check recent deliveries:**
   - GitHub App settings > Advanced > Recent Deliveries
   - Look for failed deliveries
   - Redeliver if needed

### Cannot Create Issues

**Error:**
```
Resource not accessible by integration
```

**Solutions:**

1. **Check App installation:**
   - Ensure App is installed on repository
   - Verify repository permissions

2. **Test with GitHub API:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/repos/OWNER/REPO/issues
   ```

### PR Status Not Updating

**Symptoms:**
- Tests pass but bounty not claimed
- Status checks not appearing

**Solutions:**

1. **Check webhook events:**
   ```javascript
   // Log all webhook events
   logger.info(`Webhook event: ${req.headers['x-github-event']}`);
   logger.info(`Action: ${req.body.action}`);
   ```

2. **Verify PR has MNEE address:**
   ```javascript
   const address = extractMneeAddress(prBody + '\n' + comments.join('\n'));
   if (!address) {
     logger.warn('No MNEE address found in PR');
   }
   ```

## Debugging Tools

### Enable Debug Logging

```javascript
// In .env
DEBUG=fix-flow:*
LOG_LEVEL=debug

// In code
const debug = require('debug')('fix-flow:service');
debug('Detailed debugging info');
```

### MNEE SDK Debugging

```javascript
// Enable verbose logging
const mnee = new MNEE({
  apiKey: process.env.MNEE_API_KEY,
  environment: process.env.MNEE_ENVIRONMENT,
  debug: true  // Enables detailed logging
});
```

### Database Query Debugging

```javascript
// Log all SQL queries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  log: (msg) => console.log(msg)
});

// Or use event listeners
pool.on('query', (query) => {
  console.log('Query:', query.text, query.values);
});
```

### HTTP Request Debugging

```javascript
// Log all HTTP requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body,
    query: req.query
  });
  next();
});
```

## Performance Monitoring

### Memory Leaks

```javascript
// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}, 60000);
```

### Response Time Monitoring

```javascript
// Add response time logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});
```

## Emergency Procedures

### Stop All Payments

```bash
# 1. Stop the bot
pm2 stop fix-flow-bot

# 2. Disable GitHub webhooks
# Go to GitHub App settings and disable webhooks

# 3. Transfer remaining MNEE to secure wallet
# Use MNEE wallet UI or SDK
```

### Rollback Deployment

```bash
# 1. Checkout previous version
git checkout [previous-commit-hash]

# 2. Reinstall dependencies
npm install

# 3. Run migrations if needed
npm run db:migrate

# 4. Restart services
pm2 restart fix-flow-bot
```

### Data Recovery

```bash
# 1. Export current data
pg_dump -h localhost -U user -d FixFlow > backup.sql

# 2. Restore from backup
psql -h localhost -U user -d FixFlow < backup.sql
```

## Getting Help

If you're still experiencing issues:

1. **Check logs thoroughly:**
   ```bash
   pm2 logs fix-flow-bot --lines 1000
   ```

2. **Search existing issues:**
   https://github.com/fix-flow/fix-flow/issues

3. **Create detailed bug report:**
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant logs

4. **Contact support:**
   - Discord: https://discord.gg/fix-flow
   - Email: support@locsafe.org

## Common Environment Variables

Ensure all required environment variables are set:

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# GitHub
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_WEBHOOK_SECRET=secret

# MNEE
MNEE_ENVIRONMENT=production
MNEE_API_KEY=your_api_key
MNEE_BOT_ADDRESS=1YourAddress...
MNEE_BOT_WIF=LYourPrivateKey...

# Security
JWT_SECRET=secret
API_KEY=key