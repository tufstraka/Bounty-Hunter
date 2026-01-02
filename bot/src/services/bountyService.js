import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import db from '../db.js';

class BountyService {
  constructor() {
    this.bountyCounter = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Get the current max bounty ID from database
      const result = await db.query('SELECT MAX(bounty_id) as max_id FROM bounties');
      this.bountyCounter = (result.rows[0].max_id || 0) + 1;
      this.initialized = true;
      logger.info('Bounty service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bounty service:', error);
      throw error;
    }
  }

  async createBounty({ repository, issueId, amount, maxAmount, issueUrl, metadata }) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`Creating bounty for issue ${issueId} with amount ${amount} MNEE`);

      const bountyId = this.bountyCounter++;
      const now = new Date();

      // Create bounty directly in database
      const bounty = new Bounty({
        bountyId,
        repository,
        issueId,
        issueUrl,
        initialAmount: amount,
        currentAmount: amount,
        maxAmount: maxAmount || amount * 3,
        transactionHash: `INTERNAL-${bountyId}-${Date.now()}`, // Internal reference
        blockNumber: 0, // No longer needed, but kept for compatibility
        metadata,
        status: 'active',
        createdAt: now,
        updatedAt: now
      });

      await bounty.save();

      logger.info(`Bounty created successfully. ID: ${bountyId}`);

      return {
        success: true,
        bountyId,
        transactionHash: bounty.transactionHash,
        contractAddress: null, // No contract anymore
        blockNumber: 0
      };
    } catch (error) {
      logger.error('Failed to create bounty:', error);
      throw error;
    }
  }

  async escalateBounty(bountyId) {
    try {
      logger.info(`Escalating bounty ${bountyId}`);

      const bounty = await Bounty.findOne({ bountyId });
      if (!bounty) {
        throw new Error('Bounty not found');
      }

      if (!bounty.isEligibleForEscalation()) {
        logger.info(`Bounty ${bountyId} not yet eligible for escalation`);
        return { success: false, reason: 'not_eligible' };
      }

      // Calculate new amount based on escalation count
      let escalationPercentage;
      const escalationCount = bounty.escalationCount || 0;
      
      // Escalation schedule: 20% -> 50% -> 100%
      if (escalationCount === 0) {
        escalationPercentage = 0.2; // 20%
      } else if (escalationCount === 1) {
        escalationPercentage = 0.5; // 50%
      } else {
        escalationPercentage = 1.0; // 100%
      }

      const oldAmount = bounty.currentAmount;
      const newAmount = Math.min(
        bounty.initialAmount * (1 + escalationPercentage),
        bounty.maxAmount
      );

      // Update bounty
      bounty.currentAmount = newAmount;
      bounty.lastEscalation = new Date();
      bounty.escalationCount = escalationCount + 1;
      await bounty.save();

      logger.info(`Bounty ${bountyId} escalated from ${oldAmount} to ${newAmount} MNEE`);

      return {
        success: true,
        oldAmount,
        newAmount,
        transactionHash: `ESCALATION-${bountyId}-${Date.now()}`
      };
    } catch (error) {
      logger.error(`Failed to escalate bounty ${bountyId}:`, error);
      throw error;
    }
  }

  async claimBounty(bountyId, solverAddress, paymentTxId, solverGithubLogin = null) {
    try {
      logger.info(`Marking bounty ${bountyId} as claimed for solver ${solverAddress} (${solverGithubLogin || 'unknown'})`);

      const bounty = await Bounty.findOne({ bountyId });
      if (!bounty) {
        throw new Error('Bounty not found');
      }

      if (bounty.status !== 'active') {
        throw new Error('Bounty is not active');
      }

      // Update bounty status
      bounty.status = 'claimed';
      bounty.solver = solverAddress;
      bounty.solverGithubLogin = solverGithubLogin;
      bounty.claimedAmount = bounty.currentAmount;
      bounty.claimTransactionHash = paymentTxId || `CLAIM-${bountyId}-${Date.now()}`;
      bounty.claimedAt = new Date();
      await bounty.save();

      logger.info(`Bounty ${bountyId} marked as claimed successfully`);

      return {
        success: true,
        transactionHash: bounty.claimTransactionHash,
        amount: bounty.claimedAmount
      };
    } catch (error) {
      logger.error(`Failed to claim bounty ${bountyId}:`, error);
      throw error;
    }
  }

  async getBountyDetails(bountyId) {
    try {
      const bounty = await Bounty.findOne({ bountyId });
      if (!bounty) {
        throw new Error('Bounty not found');
      }

      return {
        initialAmount: bounty.initialAmount,
        currentAmount: bounty.currentAmount,
        maxAmount: bounty.maxAmount,
        createdAt: bounty.createdAt,
        repository: bounty.repository,
        issueId: bounty.issueId,
        solver: bounty.solver,
        claimed: bounty.status === 'claimed',
        issueUrl: bounty.issueUrl,
        paymentTxId: bounty.claimTransactionHash
      };
    } catch (error) {
      logger.error(`Failed to get bounty ${bountyId} details:`, error);
      throw error;
    }
  }

  async getStats() {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_bounties,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bounties,
          COUNT(CASE WHEN status = 'claimed' THEN 1 END) as claimed_bounties,
          SUM(CASE WHEN status = 'active' THEN current_amount ELSE 0 END) as total_locked,
          SUM(CASE WHEN status = 'claimed' THEN claimed_amount ELSE 0 END) as total_claimed
        FROM bounties
      `);

      const result = stats.rows[0];
      return {
        totalBounties: parseInt(result.total_bounties) || 0,
        activeBounties: parseInt(result.active_bounties) || 0,
        claimedBounties: parseInt(result.claimed_bounties) || 0,
        totalLocked: parseFloat(result.total_locked) || 0,
        totalClaimed: parseFloat(result.total_claimed) || 0
      };
    } catch (error) {
      logger.error('Failed to get bounty stats:', error);
      throw error;
    }
  }
}

export default new BountyService();