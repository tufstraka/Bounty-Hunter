import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cron from 'node-cron';

import logger from './utils/logger.js';
import authMiddleware, { adminAuth } from './middleware/auth.js';
import bountyRoutes from './routes/bounty.js';
import webhookRoutes from './routes/webhook.js';
import adminRoutes from './routes/admin.js';
import githubRoutes from './routes/github.js';
import userRoutes from './routes/user.js';
import escalationService from './services/escalation.js';
import bountyService from './services/bountyService.js';
import mneeService from './services/mnee.js';
import githubAppService from './services/githubApp.js';
import db from './db.js';

logger.info('='.repeat(60));
logger.info('Starting FixFlow Bot Server...');
logger.info('='.repeat(60));
logger.info('Environment', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug'
});

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
    logger.log(logLevel, `${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  next();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Public API Routes (no authentication required)
// These must be defined BEFORE the authenticated routes
import { publicBountyRoutes } from './routes/bounty.js';
app.use('/api/bounties', publicBountyRoutes);

// Authenticated API Routes
app.use('/api/bounties', authMiddleware, bountyRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/user', userRoutes); // User authentication and profile routes
app.use('/webhooks', webhookRoutes); // Webhook endpoints (GitHub, MNEE status, create-bounty)
app.use('/github', githubRoutes); // GitHub App OAuth and installation callbacks

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Database connection
async function connectDatabase() {
  logger.info('Step 1/4: Connecting to database...');
  try {
    await db.initDb();
    logger.info('✓ Database initialized successfully');
  } catch (error) {
    logger.error('✗ Database initialization failed', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Initialize bounty service
async function initializeBountyService() {
  logger.info('Step 2/4: Initializing bounty service...');
  try {
    await bountyService.initialize();
    logger.info('✓ Bounty service initialized');
  } catch (error) {
    logger.error('✗ Bounty service initialization failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Initialize GitHub App service
async function initializeGitHubAppService() {
  logger.info('Step 3/4: Initializing GitHub App service...');
  logger.debug('GitHub App config', {
    appId: process.env.GITHUB_APP_ID,
    appName: process.env.GITHUB_APP_NAME,
    privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH,
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY
  });
  try {
    await githubAppService.initialize();
    logger.info('✓ GitHub App service initialized');
  } catch (error) {
    logger.error('✗ GitHub App service initialization failed', {
      error: error.message,
      stack: error.stack
    });
    // Don't exit - the app can still function with manual token if needed
    logger.warn('⚠ GitHub App features may be limited');
  }
}

// Initialize MNEE payment service
async function initializeMneeService() {
  logger.info('Step 4/4: Initializing MNEE payment service...');
  logger.debug('MNEE config', {
    environment: process.env.MNEE_ENVIRONMENT,
    hasApiKey: !!process.env.MNEE_API_KEY,
    botAddress: process.env.MNEE_BOT_ADDRESS,
    hasWif: !!process.env.MNEE_BOT_WIF
  });
  try {
    await mneeService.initialize();

    // Try to get initial balance (may fail with invalid address)
    try {
      const balance = await mneeService.getBalance();
      logger.info('✓ MNEE wallet connected', {
        balance: balance.balance,
        address: balance.address
      });

      // Request from faucet if in sandbox mode and balance is low
      if (process.env.MNEE_ENVIRONMENT === 'sandbox' && balance.balance < 10) {
        logger.info('Low MNEE balance in sandbox, requesting from faucet...');
        try {
          await mneeService.requestFromFaucet();
          logger.info('Faucet request successful');
        } catch (error) {
          logger.warn('Faucet request failed', { error: error.message });
        }
      }
    } catch (balanceError) {
      logger.warn('⚠ Could not fetch MNEE balance - check MNEE_BOT_ADDRESS format', {
        error: balanceError.message,
        hint: 'MNEE uses Bitcoin-style addresses (starting with 1 or 3), not Ethereum addresses'
      });
    }

    logger.info('✓ MNEE payment service initialized');
  } catch (error) {
    logger.error('✗ MNEE service initialization failed', {
      error: error.message,
      stack: error.stack
    });
    // Don't exit - allow server to run without MNEE for development
    logger.warn('⚠ MNEE payment features will be unavailable');
  }
}

// Start escalation scheduler
function startEscalationScheduler() {
  // Run every hour to check for bounties that need escalation
  cron.schedule('0 * * * *', async () => {
    logger.info('Running bounty escalation check...');
    try {
      await escalationService.checkAndEscalateBounties();
    } catch (error) {
      logger.error('Escalation check error:', error);
    }
  });

  logger.info('Escalation scheduler started');
}

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');

  // Close server
  global.server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connection
  // await db.close(); // If we implemented close. Pool closes when process exits usually, but explicit is good.
  // pg pool.end() is what we'd want but we exported query and getClient.
  // We didn't export pool logic for shutdown, which is okay for now.

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  const startTime = Date.now();
  
  try {
    // Connect to database
    await connectDatabase();

    // Initialize bounty service
    await initializeBountyService();

    // Initialize GitHub App service
    await initializeGitHubAppService();

    // Initialize MNEE service
    await initializeMneeService();

    // Start escalation scheduler
    startEscalationScheduler();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      const duration = Date.now() - startTime;
      logger.info('='.repeat(60));
      logger.info(`✓ FixFlow Bot Server started successfully`);
      logger.info('='.repeat(60));
      logger.info('Server details', {
        port: PORT,
        environment: process.env.NODE_ENV,
        startupTime: `${duration}ms`
      });
      logger.info('Available endpoints', {
        health: `GET /health`,
        api: `GET /api/*`,
        webhooks: `POST /webhooks/*`,
        github: `GET /github/*`
      });
      logger.info('GitHub App authentication enabled - users grant permissions via OAuth');
      logger.info('All bounty state managed in PostgreSQL (no smart contracts)');
      logger.info('='.repeat(60));
    });

    // Store server reference for graceful shutdown
    global.server = server;

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the application
startServer();

export default app;