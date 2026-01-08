import express from 'express';
import { authenticateUser } from './user.js';
import ProjectSettings from '../models/ProjectSettings.js';
import User from '../models/User.js';
import Bounty from '../models/Bounty.js';
import logger from '../utils/logger.js';
import { ethers } from 'ethers';

const router = express.Router();

/**
 * Get project settings for a repository
 * GET /api/projects/:owner/:repo/settings
 */
router.get('/:owner/:repo/settings', authenticateUser, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    
    const settings = await ProjectSettings.findByRepository(repository);
    
    if (!settings) {
      return res.status(404).json({
        error: 'Project not configured',
        message: 'No settings found for this repository'
      });
    }

    // Check if user has permission to view settings
    if (settings.ownerGithubLogin !== req.user.githubLogin && !req.user.isAdmin()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view these settings'
      });
    }

    res.json(settings.toJSON());
  } catch (error) {
    logger.error('Error fetching project settings:', error);
    res.status(500).json({ error: 'Failed to fetch project settings' });
  }
});

/**
 * Create or update project settings
 * PUT /api/projects/:owner/:repo/settings
 */
router.put('/:owner/:repo/settings', authenticateUser, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    const {
      fundingMode,
      defaultBountyAmount,
      maxBountyAmount,
      autoCreateBounties,
      escalationEnabled,
      escalationSchedule,
      escalationMultipliers,
      fundingWalletAddress
    } = req.body;

    // Verify user is the owner or admin
    let settings = await ProjectSettings.findByRepository(repository);
    
    if (settings && settings.ownerGithubLogin !== req.user.githubLogin && !req.user.isAdmin()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to modify these settings'
      });
    }

    // Validate funding wallet address if provided
    if (fundingWalletAddress && !ethers.isAddress(fundingWalletAddress)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'The provided wallet address is not a valid Ethereum address'
      });
    }

    if (!settings) {
      settings = new ProjectSettings({
        repository,
        ownerGithubLogin: req.user.githubLogin
      });
    }

    // Update settings
    if (fundingMode !== undefined) settings.fundingMode = fundingMode;
    if (defaultBountyAmount !== undefined) settings.defaultBountyAmount = defaultBountyAmount;
    if (maxBountyAmount !== undefined) settings.maxBountyAmount = maxBountyAmount;
    if (autoCreateBounties !== undefined) settings.autoCreateBounties = autoCreateBounties;
    if (escalationEnabled !== undefined) settings.escalationEnabled = escalationEnabled;
    if (escalationSchedule !== undefined) settings.escalationSchedule = escalationSchedule;
    if (escalationMultipliers !== undefined) settings.escalationMultipliers = escalationMultipliers;
    if (fundingWalletAddress !== undefined) settings.fundingWalletAddress = fundingWalletAddress;

    await settings.save();

    logger.info(`Project settings updated for ${repository}`);
    res.json(settings.toJSON());
  } catch (error) {
    logger.error('Error updating project settings:', error);
    res.status(500).json({ error: 'Failed to update project settings' });
  }
});

/**
 * Get all projects for the authenticated user
 * GET /api/projects
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const projects = await ProjectSettings.findByOwner(req.user.githubLogin);
    res.json({ projects: projects.map(p => p.toJSON()) });
  } catch (error) {
    logger.error('Error fetching user projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * Get bounties for a specific project
 * GET /api/projects/:owner/:repo/bounties
 */
router.get('/:owner/:repo/bounties', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const repository = `${owner}/${repo}`;

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
    logger.error('Error fetching project bounties:', error);
    res.status(500).json({ error: 'Failed to fetch bounties' });
  }
});

/**
 * Get project stats
 * GET /api/projects/:owner/:repo/stats
 */
router.get('/:owner/:repo/stats', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;

    const bounties = await Bounty.find({ repository });
    
    const stats = {
      totalBounties: bounties.length,
      activeBounties: bounties.filter(b => b.status === 'active').length,
      claimedBounties: bounties.filter(b => b.status === 'claimed').length,
      totalLocked: bounties.filter(b => b.status === 'active').reduce((sum, b) => sum + b.currentAmount, 0),
      totalPaid: bounties.filter(b => b.status === 'claimed').reduce((sum, b) => sum + (b.claimedAmount || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * Link Ethereum wallet to user account
 * POST /api/projects/link-wallet
 */
router.post('/link-wallet', authenticateUser, async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Address, signature, and message are required'
      });
    }

    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'The provided address is not a valid Ethereum address'
      });
    }

    // Verify the signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({
          error: 'Invalid signature',
          message: 'The signature does not match the provided address'
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'Could not verify the signature'
      });
    }

    // Check if the message contains the expected nonce
    // Message format: "Link wallet to FixFlow\nNonce: {nonce}\nTimestamp: {timestamp}"
    if (!message.includes('Link wallet to FixFlow')) {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Message format is incorrect'
      });
    }

    // Update user with ethereum address
    const user = await User.findById(req.user.id);
    user.ethereumAddress = address;
    user.ethAddressVerified = true;
    await user.save();

    logger.info(`User ${user.githubLogin} linked Ethereum wallet: ${address}`);

    res.json({
      success: true,
      message: 'Wallet linked successfully',
      ethereumAddress: address
    });
  } catch (error) {
    logger.error('Error linking wallet:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

/**
 * Get nonce for wallet linking
 * GET /api/projects/wallet-nonce
 */
router.get('/wallet-nonce', authenticateUser, async (req, res) => {
  try {
    const crypto = await import('crypto');
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    // Store nonce in user for verification
    const user = await User.findById(req.user.id);
    user.ethVerificationNonce = nonce;
    await user.save();

    res.json({
      nonce,
      timestamp,
      message: `Link wallet to FixFlow\nNonce: ${nonce}\nTimestamp: ${timestamp}`
    });
  } catch (error) {
    logger.error('Error generating wallet nonce:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

/**
 * Get funding info for creating a bounty on-chain
 * Returns the contract address and token address needed for frontend
 * GET /api/projects/funding-info
 */
router.get('/funding-info', async (req, res) => {
  try {
    const escrowAddress = process.env.BOUNTY_ESCROW_ADDRESS;
    const mneeTokenAddress = process.env.MNEE_TOKEN_ADDRESS || '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF';
    const useBlockchain = process.env.USE_BLOCKCHAIN === 'true';

    res.json({
      escrowContractAddress: escrowAddress || null,
      mneeTokenAddress,
      useBlockchain,
      chainId: process.env.ETHEREUM_CHAIN_ID || '1',
      network: process.env.ETHEREUM_NETWORK || 'mainnet'
    });
  } catch (error) {
    logger.error('Error fetching funding info:', error);
    res.status(500).json({ error: 'Failed to fetch funding info' });
  }
});

/**
 * Record on-chain bounty creation
 * Called by frontend after user creates bounty via smart contract
 * POST /api/projects/:owner/:repo/bounties/on-chain
 *
 * This endpoint handles two scenarios:
 * 1. New bounty: Creates a new bounty record in the database
 * 2. Existing unfunded bounty: Updates an existing bounty (e.g., from GitHub Actions) with on-chain funding info
 */
router.post('/:owner/:repo/bounties/on-chain', authenticateUser, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repository = `${owner}/${repo}`;
    const {
      issueId,
      issueUrl,
      amount,
      maxAmount,
      transactionHash,
      onChainBountyId,
      creatorWalletAddress
    } = req.body;

    logger.info(`[On-Chain Bounty] Recording bounty for ${repository}#${issueId}`);
    logger.info(`[On-Chain Bounty] Request data:`, {
      issueId,
      amount,
      maxAmount,
      transactionHash,
      onChainBountyId,
      creatorWalletAddress
    });

    // Validate required fields
    if (!issueId || !amount || !transactionHash) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'issueId, amount, and transactionHash are required'
      });
    }

    // Check if bounty already exists for this issue
    const existingBounty = await Bounty.findOne({ repository, issueId });
    
    if (existingBounty) {
      logger.info(`[On-Chain Bounty] Found existing bounty:`, {
        bountyId: existingBounty.bountyId,
        onChainBountyId: existingBounty.onChainBountyId,
        status: existingBounty.status,
        fundingSource: existingBounty.fundingSource,
        transactionHash: existingBounty.transactionHash
      });
      
      // If existing bounty already has an onChainBountyId with a different ID, it's a duplicate
      if (existingBounty.onChainBountyId && onChainBountyId &&
          existingBounty.onChainBountyId !== onChainBountyId) {
        logger.warn(`[On-Chain Bounty] Duplicate: existing has onChainBountyId ${existingBounty.onChainBountyId}, new has ${onChainBountyId}`);
        return res.status(400).json({
          error: 'Bounty exists',
          message: `A bounty already exists for this issue with on-chain ID ${existingBounty.onChainBountyId}`
        });
      }
      
      // If existing bounty has the same transaction hash, this is a retry - return success
      if (existingBounty.transactionHash === transactionHash) {
        logger.info(`[On-Chain Bounty] Same transaction hash - returning existing bounty`);
        return res.json({
          success: true,
          message: 'Bounty already recorded with this transaction',
          bounty: existingBounty.toJSON()
        });
      }
      
      // If existing bounty doesn't have on-chain funding info, update it
      if (!existingBounty.onChainBountyId) {
        logger.info(`[On-Chain Bounty] Updating existing bounty with on-chain info`);
        
        existingBounty.onChainBountyId = onChainBountyId;
        existingBounty.transactionHash = transactionHash;
        existingBounty.fundingSource = 'owner';
        existingBounty.creatorWalletAddress = creatorWalletAddress || req.user.ethereumAddress;
        existingBounty.initialAmount = amount;
        existingBounty.currentAmount = amount;
        existingBounty.maxAmount = maxAmount || amount * 3;
        existingBounty.metadata = {
          ...existingBounty.metadata,
          createdBy: req.user.githubLogin,
          fundedOnChain: true,
          fundedAt: new Date().toISOString()
        };
        
        await existingBounty.save();
        
        logger.info(`[On-Chain Bounty] Updated existing bounty ${existingBounty.bountyId} with on-chain info`);
        
        return res.json({
          success: true,
          message: 'Existing bounty updated with on-chain funding',
          bounty: existingBounty.toJSON()
        });
      }
      
      // Existing bounty already has on-chain info
      logger.warn(`[On-Chain Bounty] Bounty already funded on-chain`);
      return res.status(400).json({
        error: 'Bounty already funded',
        message: 'This bounty is already funded on-chain',
        existingBounty: {
          bountyId: existingBounty.bountyId,
          onChainBountyId: existingBounty.onChainBountyId,
          status: existingBounty.status
        }
      });
    }

    // Create new bounty record
    logger.info(`[On-Chain Bounty] Creating new bounty record`);
    
    const bounty = new Bounty({
      bountyId: onChainBountyId || Date.now(),
      repository,
      issueId,
      issueUrl: issueUrl || `https://github.com/${repository}/issues/${issueId}`,
      initialAmount: amount,
      currentAmount: amount,
      maxAmount: maxAmount || amount * 3,
      status: 'active',
      transactionHash,
      fundingSource: 'owner',
      creatorWalletAddress: creatorWalletAddress || req.user.ethereumAddress,
      onChainBountyId,
      metadata: {
        createdBy: req.user.githubLogin,
        fundedOnChain: true
      }
    });

    await bounty.save();

    logger.info(`[On-Chain Bounty] Created: ${repository}#${issueId} with tx ${transactionHash}`);

    res.json({
      success: true,
      bounty: bounty.toJSON()
    });
  } catch (error) {
    logger.error('[On-Chain Bounty] Error recording bounty:', error);
    res.status(500).json({ error: 'Failed to record bounty' });
  }
});

export default router;