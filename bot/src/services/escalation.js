import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import bountyService from './bountyService.js';
import githubAppService from './githubApp.js';

class EscalationService {
  constructor() {
    // No longer using personal access tokens
    // GitHub App service handles authentication
  }

  async checkAndEscalateBounties() {
    try {
      logger.info('Starting bounty escalation check...');
      
      // Find all active bounties that might be eligible for escalation
      const activeBounties = await Bounty.find({
        status: 'active'
      }).where('currentAmount').lt('maxAmount');

      logger.info(`Found ${activeBounties.length} active bounties to check`);

      let escalatedCount = 0;
      let failedCount = 0;

      for (const bounty of activeBounties) {
        try {
          if (bounty.isEligibleForEscalation()) {
            logger.info(`Bounty ${bounty.bountyId} is eligible for escalation`);
            
            // Escalate using bounty service
            const result = await bountyService.escalateBounty(bounty.bountyId);
            
            if (result.success) {
              // Post comment on GitHub issue
              await this.postEscalationComment(bounty, result);
              
              escalatedCount++;
              logger.info(`Successfully escalated bounty ${bounty.bountyId} from ${result.oldAmount} to ${result.newAmount} MNEE`);
            }
          }
        } catch (error) {
          logger.error(`Failed to escalate bounty ${bounty.bountyId}:`, error);
          failedCount++;
        }
      }

      logger.info(`Escalation check complete. Escalated: ${escalatedCount}, Failed: ${failedCount}`);
      
      return {
        checked: activeBounties.length,
        escalated: escalatedCount,
        failed: failedCount
      };
    } catch (error) {
      logger.error('Error during escalation check:', error);
      throw error;
    }
  }

  async postEscalationComment(bounty, escalationResult) {
    try {
      const [owner, repo] = bounty.repository.split('/');
      
      const comment = `🚀 **Bounty Escalated!**

The bounty for this issue has increased from **${escalationResult.oldAmount} MNEE** to **${escalationResult.newAmount} MNEE** (+${this.calculatePercentageIncrease(escalationResult.oldAmount, escalationResult.newAmount)}%).

This issue has been open for ${bounty.hoursElapsed} hours. ${this.getNextEscalationMessage(bounty)}

**Current bounty:** ${escalationResult.newAmount} MNEE
**Maximum possible bounty:** ${bounty.maxAmount} MNEE

---
*Escalation ${bounty.escalationCount} triggered by [FixFlow](https://github.com/tufstraka/fix-flow)*`;

      // Use GitHub App authentication instead of personal token
      const octokit = await githubAppService.getOctokitForRepo(owner, repo);
      
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: bounty.issueId,
        body: comment
      });

      logger.info(`Posted escalation comment on ${bounty.repository}#${bounty.issueId}`);
    } catch (error) {
      logger.error(`Failed to post escalation comment for bounty ${bounty.bountyId}:`, error);
      // Don't throw - this is not critical
    }
  }

  calculatePercentageIncrease(oldAmount, newAmount) {
    const old = parseFloat(oldAmount);
    const current = parseFloat(newAmount);
    const increase = ((current - old) / old) * 100;
    return Math.round(increase);
  }

  getNextEscalationMessage(bounty) {
    if (bounty.currentAmount >= bounty.maxAmount) {
      return 'This bounty has reached its maximum value.';
    }

    // Calculate next escalation time based on default schedule
    const hoursElapsed = bounty.hoursElapsed;
    const escalationSchedule = [24, 72, 168]; // 1 day, 3 days, 1 week
    
    for (const threshold of escalationSchedule) {
      if (hoursElapsed < threshold) {
        const hoursUntilNext = threshold - hoursElapsed;
        const daysUntilNext = Math.floor(hoursUntilNext / 24);
        const remainingHours = hoursUntilNext % 24;
        
        if (daysUntilNext > 0) {
          return `The bounty will increase again in ${daysUntilNext} day${daysUntilNext > 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}.`;
        } else {
          return `The bounty will increase again in ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}.`;
        }
      }
    }

    return 'The bounty may increase again if not claimed soon.';
  }

  // Manual escalation for a specific bounty
  async escalateSingleBounty(bountyId) {
    try {
      const bounty = await Bounty.findOne({ bountyId });
      if (!bounty) {
        throw new Error('Bounty not found');
      }

      if (bounty.status !== 'active') {
        throw new Error('Bounty is not active');
      }

      const result = await bountyService.escalateBounty(bountyId);
      
      if (result.success) {
        // Post comment on GitHub issue
        await this.postEscalationComment(bounty, result);
        
        logger.info(`Manually escalated bounty ${bountyId}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to manually escalate bounty ${bountyId}:`, error);
      throw error;
    }
  }

  // Get bounties eligible for escalation
  async getEligibleBounties() {
    try {
      const activeBounties = await Bounty.find({
        status: 'active'
      });

      const eligible = activeBounties.filter(bounty => bounty.isEligibleForEscalation());
      
      return eligible.map(bounty => ({
        bountyId: bounty.bountyId,
        repository: bounty.repository,
        issueId: bounty.issueId,
        currentAmount: bounty.currentAmount,
        maxAmount: bounty.maxAmount,
        hoursElapsed: bounty.hoursElapsed,
        lastEscalation: bounty.lastEscalation,
        escalationCount: bounty.escalationCount
      }));
    } catch (error) {
      logger.error('Failed to get eligible bounties:', error);
      throw error;
    }
  }
}

export default new EscalationService();