import express from 'express';
import crypto from 'crypto';
const router = express.Router();
import logger from '../utils/logger.js';
import User from '../models/User.js';
import Bounty from '../models/Bounty.js';
import db from '../db.js';

// Middleware to authenticate user via session token
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionToken = authHeader.substring(7);
    const user = await User.findBySessionToken(sessionToken);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin()) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GitHub OAuth login initiation
router.get('/auth/github', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const redirectUri = `${process.env.BOT_URL}/api/user/auth/github/callback`;
  
  const scope = 'read:user user:email';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  res.json({ authUrl, state });
});

// GitHub OAuth callback
router.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error('OAuth token exchange failed:', tokenData.error);
      return res.status(400).json({
        error: 'OAuth token exchange failed',
        details: tokenData.error_description
      });
    }

    // Get user profile from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const githubProfile = await userResponse.json();

    // Get user email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const emails = await emailResponse.json();
    const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email;

    // Create or update user
    const user = await User.findOrCreateByGithub({
      ...githubProfile,
      email: primaryEmail
    });

    // Store access token
    user.accessToken = tokenData.access_token;
    user.refreshToken = tokenData.refresh_token;
    if (tokenData.expires_in) {
      user.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    }
    await user.save();

    // Create session
    const session = await user.createSession();

    logger.info(`User ${user.githubLogin} logged in`);

    // Redirect to frontend with session token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${session.sessionToken}`);
  } catch (error) {
    logger.error('GitHub OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', authenticateUser, async (req, res) => {
  try {
    res.json(req.user.toJSON());
  } catch (error) {
    logger.error('Failed to get user:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Update current user profile
router.patch('/me', authenticateUser, async (req, res) => {
  try {
    const { mneeAddress, name, email } = req.body;

    if (mneeAddress !== undefined) req.user.mneeAddress = mneeAddress;
    if (name !== undefined) req.user.name = name;
    if (email !== undefined) req.user.email = email;

    await req.user.save();
    
    res.json(req.user.toJSON());
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user's bounties (claimed by user)
router.get('/me/bounties', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = 'SELECT * FROM bounties WHERE solver_github_login = $1';
    const values = [req.user.githubLogin];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const { rows } = await db.query(query, values);
    const bounties = rows.map(row => Bounty.fromRow(row));

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM bounties WHERE solver_github_login = $1';
    const countValues = [req.user.githubLogin];
    if (status && status !== 'all') {
      countQuery += ' AND status = $2';
      countValues.push(status);
    }
    const countResult = await db.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      bounties: bounties.map(b => b.toJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to get user bounties:', error);
    res.status(500).json({ error: 'Failed to get bounties' });
  }
});

// Get user's repositories (from GitHub installations)
router.get('/me/repositories', authenticateUser, async (req, res) => {
  try {
    // Get repositories from GitHub installations associated with user
    const { rows } = await db.query(`
      SELECT gi.repositories, gi.account_login
      FROM github_installations gi
      WHERE gi.account_login = $1
         OR gi.account_login IN (
           SELECT jsonb_array_elements_text(gi2.repositories)::text 
           FROM github_installations gi2
         )
    `, [req.user.githubLogin]);

    // Flatten and deduplicate repositories
    const repositories = new Set();
    rows.forEach(row => {
      if (row.repositories) {
        row.repositories.forEach(repo => repositories.add(repo));
      }
    });

    // Get bounty stats for each repository
    const repoList = Array.from(repositories);
    const repoStats = [];

    for (const repo of repoList) {
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
          SUM(CASE WHEN status = 'active' THEN current_amount ELSE 0 END) as total_locked
        FROM bounties
        WHERE repository = $1
      `, [repo]);

      const stats = statsResult.rows[0];
      repoStats.push({
        repository: repo,
        totalBounties: parseInt(stats.total) || 0,
        activeBounties: parseInt(stats.active) || 0,
        claimedBounties: parseInt(stats.claimed) || 0,
        totalLocked: parseFloat(stats.total_locked) || 0
      });
    }

    res.json({ repositories: repoStats });
  } catch (error) {
    logger.error('Failed to get user repositories:', error);
    res.status(500).json({ error: 'Failed to get repositories' });
  }
});

// Get bounties for a specific repository (user must have access)
router.get('/repositories/:owner/:repo/bounties', authenticateUser, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { repository };
    if (status && status !== 'all') {
      query.status = status;
    }

    const bounties = await Bounty.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Bounty.countDocuments(query);

    res.json({
      bounties: bounties.map(b => b.toJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to get repository bounties:', error);
    res.status(500).json({ error: 'Failed to get bounties' });
  }
});

// Get user stats
router.get('/me/stats', authenticateUser, async (req, res) => {
  try {
    // Update user stats from bounties
    await req.user.updateStats();

    const { rows } = await db.query(`
      SELECT
        COUNT(*) as total_claimed,
        COALESCE(SUM(claimed_amount), 0) as total_earned,
        COUNT(DISTINCT repository) as repositories_contributed
      FROM bounties
      WHERE solver_github_login = $1 AND status = 'claimed'
    `, [req.user.githubLogin]);

    const stats = rows[0];

    res.json({
      totalClaimed: parseInt(stats.total_claimed) || 0,
      totalEarned: parseFloat(stats.total_earned) || 0,
      repositoriesContributed: parseInt(stats.repositories_contributed) || 0,
      memberSince: req.user.createdAt
    });
  } catch (error) {
    logger.error('Failed to get user stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Logout
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader.substring(7);
    
    await User.deleteSession(sessionToken);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ============ Admin Routes ============

// Get all users (admin only)
router.get('/admin/users', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;

    const users = await User.findAll({ page: parseInt(page), limit: parseInt(limit), role });
    const total = await User.count({ role });

    res.json({
      users: users.map(u => u.toJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get specific user (admin only)
router.get('/admin/users/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.toJSON());
  } catch (error) {
    logger.error('Failed to get user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user role (admin only)
router.patch('/admin/users/:id/role', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findById(parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = role;
    await user.save();

    logger.info(`User ${user.githubLogin} role changed to ${role} by ${req.user.githubLogin}`);

    res.json(user.toJSON());
  } catch (error) {
    logger.error('Failed to update user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Get top contributors (public)
router.get('/contributors', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const contributors = await User.getTopContributors(parseInt(limit));
    
    res.json(contributors.map(u => u.toPublicJSON()));
  } catch (error) {
    logger.error('Failed to get contributors:', error);
    res.status(500).json({ error: 'Failed to get contributors' });
  }
});

export { authenticateUser, requireAdmin };
export default router;