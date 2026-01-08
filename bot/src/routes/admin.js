import express from 'express';
const router = express.Router();
import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import db from '../db.js';
import mneeService from '../services/mnee.js';
import escalationService from '../services/escalation.js';
import ethereumPaymentService from '../services/ethereumPayment.js';
import User from '../models/User.js';

/**
 * Admin authentication middleware
 * Supports both API key authentication and session-based admin authentication
 *
 * For API key: X-API-Key header matches API_KEY env variable
 * For session: Bearer token in Authorization header is a valid session for an admin user
 */
const adminAuth = async (req, res, next) => {
  try {
    // Check for API key first (for automated systems/GitHub Actions)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
      req.authType = 'api-key';
      logger.debug('[Admin Auth] Authenticated via API key');
      return next();
    }

    // Check for Bearer token (session-based authentication)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[Admin Auth] No valid auth credentials provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionToken = authHeader.substring(7);
    
    // Find user by session token
    const user = await User.findBySessionToken(sessionToken);
    
    if (!user) {
      logger.warn('[Admin Auth] Invalid or expired session token');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Check if user is admin
    if (!user.isAdmin()) {
      logger.warn(`[Admin Auth] User ${user.githubLogin} is not an admin`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    req.authType = 'session';
    logger.debug(`[Admin Auth] Authenticated admin user: ${user.githubLogin}`);
    next();
  } catch (error) {
    logger.error('[Admin Auth] Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Apply admin authentication to all routes
router.use(adminAuth);

// Get system metrics
router.get('/metrics', async (req, res) => {
  try {
    // Check if blockchain mode is enabled
    const useBlockchain = process.env.USE_BLOCKCHAIN === 'true';
    
    // Fetch all metrics in parallel
    const promises = [
      Bounty.countDocuments(),
      Bounty.countDocuments({ status: 'active' }),
      Bounty.countDocuments({ status: 'claimed' }),
      db.query("SELECT SUM(current_amount) as total FROM bounties WHERE status = 'active'"),
      db.query("SELECT SUM(claimed_amount) as total FROM bounties WHERE status = 'claimed'"),
      db.query("SELECT COUNT(*) as count FROM bounties WHERE funding_source = 'owner' AND on_chain_bounty_id IS NOT NULL"),
    ];

    // Add escrow stats if blockchain mode is enabled
    let escrowStats = null;
    if (useBlockchain) {
      try {
        escrowStats = await ethereumPaymentService.getEscrowStats();
      } catch (escrowError) {
        logger.warn('Failed to get escrow stats:', escrowError.message);
        escrowStats = { enabled: false, error: escrowError.message };
      }
    }

    // Get MNEE service balance (legacy)
    let mneeBalance = { balance: 0, address: 'N/A' };
    try {
      mneeBalance = await mneeService.getBalance();
    } catch (mneeError) {
      logger.warn('Failed to get MNEE balance:', mneeError.message);
    }

    const [
      totalBounties,
      activeBounties,
      claimedBounties,
      totalLockedRes,
      totalClaimedRes,
      onChainBountiesRes
    ] = await Promise.all(promises);

    const totalLocked = totalLockedRes.rows[0]?.total || 0;
    const totalClaimed = totalClaimedRes.rows[0]?.total || 0;
    const onChainBounties = parseInt(onChainBountiesRes.rows[0]?.count || 0);

    const metrics = {
      bounties: {
        total: totalBounties,
        active: activeBounties,
        claimed: claimedBounties,
        on_chain: onChainBounties,
        success_rate: totalBounties > 0 ? (claimedBounties / totalBounties * 100).toFixed(2) + '%' : '0%'
      },
      tokens: {
        // Database totals (from bounties table)
        locked: parseFloat(totalLocked),
        claimed: parseFloat(totalClaimed),
        // Legacy MNEE SDK wallet
        wallet_balance: mneeBalance.balance,
        wallet_address: mneeBalance.address
      },
      // On-chain escrow contract stats
      escrow: escrowStats ? {
        enabled: escrowStats.enabled,
        contract_address: escrowStats.escrowAddress || null,
        balance: escrowStats.escrowBalance || 0,
        platform_fee_bps: escrowStats.platformFeeBps || 0,
        token_address: escrowStats.tokenAddress || null,
        error: escrowStats.error || null
      } : {
        enabled: false,
        message: 'Blockchain mode not enabled'
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        blockchain_mode: useBlockchain
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get all bounties with pagination
router.get('/bounties', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, repository } = req.query;

    const query = {};
    if (status) query.status = status;
    if (repository) query.repository = repository;

    const bounties = await Bounty.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bounty.countDocuments(query);

    res.json({
      bounties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to list bounties:', error);
    res.status(500).json({ error: 'Failed to list bounties' });
  }
});

// Get bounties by repository
router.get('/repositories', async (req, res) => {
  try {
    const query = `
      SELECT
        repository,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
        SUM(CASE WHEN status = 'active' THEN current_amount ELSE 0 END) as "totalLocked",
        SUM(CASE WHEN status = 'claimed' THEN claimed_amount ELSE 0 END) as "totalClaimed"
      FROM bounties
      GROUP BY repository
      ORDER BY total DESC
    `;

    const { rows } = await db.query(query);

    const repositories = rows.map(row => ({
      repository: row.repository,
      total: parseInt(row.total),
      active: parseInt(row.active),
      claimed: parseInt(row.claimed),
      totalLocked: parseFloat(row.totalLocked || 0),
      totalClaimed: parseFloat(row.totalClaimed || 0),
      success_rate: parseInt(row.total) > 0 ? (parseInt(row.claimed) / parseInt(row.total) * 100) : 0
    }));

    res.json(repositories);
  } catch (error) {
    logger.error('Failed to get repository stats:', error);
    res.status(500).json({ error: 'Failed to get repository stats' });
  }
});

// Get eligible bounties for escalation
router.get('/escalation/eligible', async (req, res) => {
  try {
    const eligible = await escalationService.getEligibleBounties();
    res.json(eligible);
  } catch (error) {
    logger.error('Failed to get eligible bounties:', error);
    res.status(500).json({ error: 'Failed to get eligible bounties' });
  }
});

// Manually trigger escalation check
router.post('/escalation/check', async (req, res) => {
  try {
    const result = await escalationService.checkAndEscalateBounties();
    res.json(result);
  } catch (error) {
    logger.error('Failed to run escalation check:', error);
    res.status(500).json({ error: 'Failed to run escalation check' });
  }
});

// Manually escalate a specific bounty
router.post('/bounties/:bountyId/escalate', async (req, res) => {
  try {
    const { bountyId } = req.params;
    const result = await escalationService.escalateSingleBounty(parseInt(bountyId));
    res.json(result);
  } catch (error) {
    logger.error('Failed to escalate bounty:', error);
    res.status(500).json({ error: 'Failed to escalate bounty' });
  }
});

// Get top contributors
router.get('/contributors', async (req, res) => {
  try {
    const query = `
      SELECT
        solver,
        COUNT(*) as bounties_claimed,
        SUM(claimed_amount) as total_earned,
        array_agg(DISTINCT repository) as repositories
      FROM bounties
      WHERE status = 'claimed' AND solver IS NOT NULL
      GROUP BY solver
      ORDER BY total_earned DESC
      LIMIT 50
    `;

    const { rows } = await db.query(query);

    const contributors = rows.map(row => ({
      solver: row.solver,
      bounties_claimed: parseInt(row.bounties_claimed),
      total_earned: parseFloat(row.total_earned),
      repositories_count: row.repositories ? row.repositories.length : 0
    }));

    res.json(contributors);
  } catch (error) {
    logger.error('Failed to get contributors:', error);
    res.status(500).json({ error: 'Failed to get contributors' });
  }
});

// Export bounty data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', status } = req.query;

    const query = {};
    if (status) query.status = status;

    // Use .exec() to get plain objects from QueryBuilder if I added it, but await works.
    // However, await returns Bounty instances.
    const bounties = await Bounty.find(query);
    // Convert to plain objects
    const plainBounties = bounties.map(b => b.toJSON());

    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'BountyID,Repository,IssueID,Status,InitialAmount,CurrentAmount,Solver,ClaimedAmount,CreatedAt,ClaimedAt',
        ...plainBounties.map(b =>
          `${b.bountyId},${b.repository},${b.issueId},${b.status},${b.initialAmount},${b.currentAmount},${b.solver || ''},${b.claimedAmount || ''},${b.createdAt},${b.claimedAt || ''}`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bounties.csv');
      res.send(csv);
    } else {
      res.json(plainBounties);
    }
  } catch (error) {
    logger.error('Failed to export bounties:', error);
    res.status(500).json({ error: 'Failed to export bounties' });
  }
});

export default router;