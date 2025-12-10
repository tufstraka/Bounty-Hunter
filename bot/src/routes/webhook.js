import express from 'express';
import crypto from 'crypto';
const router = express.Router();
import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import bountyService from '../services/bountyService.js';
import mneeService from '../services/mnee.js';
import githubAppService from '../services/githubApp.js';

// Verify GitHub webhook signature
function verifyWebhookSignature(payload, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// GitHub webhook endpoint
router.post('/', async (req, res) => {
  try {
    // Verify signature
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const payload = JSON.stringify(req.body);
    if (!verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = req.headers['x-github-event'];
    const event = req.body;

    logger.info(`Received GitHub webhook: ${eventType}`);

    // Handle different event types
    switch (eventType) {
      case 'installation':
        await handleInstallation(event);
        break;
      case 'installation_repositories':
        await handleInstallationRepositories(event);
        break;
      case 'pull_request':
        await handlePullRequest(event);
        break;
      case 'workflow_run':
        await handleWorkflowRun(event);
        break;
      case 'issues':
        await handleIssues(event);
        break;
      default:
        logger.info(`Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle installation webhook events
async function handleInstallation(event) {
  try {
    const { action, installation, repositories } = event;
    logger.info(`Installation event: ${action} for ${installation.account.login}`);
    
    await githubAppService.handleInstallationWebhook(action, installation, repositories);
  } catch (error) {
    logger.error('Error handling installation event:', error);
  }
}

// Handle installation_repositories webhook events
async function handleInstallationRepositories(event) {
  try {
    const { action, installation, repositories_added, repositories_removed } = event;
    logger.info(`Installation repositories event: ${action} for ${installation.account.login}`);
    
    await githubAppService.handleInstallationRepositoriesWebhook(
      action,
      installation,
      repositories_added || [],
      repositories_removed || []
    );
  } catch (error) {
    logger.error('Error handling installation_repositories event:', error);
  }
}

// Handle pull request events
async function handlePullRequest(event) {
  try {
    const { action, pull_request, repository, installation } = event;

    if (action === 'closed' && pull_request.merged) {
      logger.info(`PR #${pull_request.number} merged in ${repository.full_name}`);

      // Check if PR references any bounty issues
      const referencedIssues = extractReferencedIssues(pull_request.body || '');

      for (const issueNumber of referencedIssues) {
        await checkAndClaimBounty(repository.full_name, issueNumber, pull_request, installation?.id);
      }
    }
  } catch (error) {
    logger.error('Error handling pull request:', error);
  }
}

// Handle workflow run events
async function handleWorkflowRun(event) {
  try {
    const { action, workflow_run, installation } = event;

    if (action === 'completed' && workflow_run.conclusion === 'success') {
      // Check if this workflow run is associated with a PR
      if (workflow_run.pull_requests && workflow_run.pull_requests.length > 0) {
        const pr = workflow_run.pull_requests[0];
        logger.info(`Workflow succeeded for PR #${pr.number}`);

        // Get Octokit instance for this installation
        const octokit = await githubAppService.getOctokitForRepoFullName(workflow_run.repository.full_name);

        // Get full PR details
        const [owner, repo] = workflow_run.repository.full_name.split('/');
        const { data: pullRequest } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: pr.number
        });

        // Check referenced issues
        const referencedIssues = extractReferencedIssues(pullRequest.body || '');

        for (const issueNumber of referencedIssues) {
          await checkAndClaimBounty(workflow_run.repository.full_name, issueNumber, pullRequest, installation?.id);
        }
      }
    }
  } catch (error) {
    logger.error('Error handling workflow run:', error);
  }
}

// Handle issue events
async function handleIssues(event) {
  try {
    const { action, issue, repository, installation } = event;

    if (action === 'closed') {
      logger.info(`Issue #${issue.number} closed in ${repository.full_name}`);

      // Check if this issue has an active bounty
      const bounty = await Bounty.findOne({
        repository: repository.full_name,
        issueId: issue.number,
        status: 'active'
      });

      if (bounty) {
        logger.info(`Issue #${issue.number} with bounty ${bounty.bountyId} was closed manually`);
        // Optionally cancel the bounty or keep it active
      }
    }
  } catch (error) {
    logger.error('Error handling issue event:', error);
  }
}

// Extract referenced issues from PR body
function extractReferencedIssues(body) {
  const issues = new Set();

  // Common patterns: fixes #123, closes #123, resolves #123
  const patterns = [
    /(?:fixes|closes|resolves|fix|close|resolve)\s+#(\d+)/gi,
    /(?:fixes|closes|resolves|fix|close|resolve)\s+(?:https?:\/\/github\.com\/[\w-]+\/[\w-]+\/issues\/)(\d+)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      issues.add(parseInt(match[1]));
    }
  }

  return Array.from(issues);
}

// Check and claim bounty for an issue
async function checkAndClaimBounty(repository, issueNumber, pullRequest, installationId = null) {
  try {
    // Find active bounty for this issue
    const bounty = await Bounty.findOne({
      repository,
      issueId: issueNumber,
      status: 'active'
    });

    if (!bounty) {
      logger.info(`No active bounty found for ${repository}#${issueNumber}`);
      return;
    }

    logger.info(`Found bounty ${bounty.bountyId} for ${repository}#${issueNumber}`);

    // Get Octokit instance for this repository
    const octokit = await githubAppService.getOctokitForRepoFullName(repository);

    // Verify tests are passing
    const [owner, repo] = repository.split('/');
    const { data: checkRuns } = await octokit.checks.listForRef({
      owner,
      repo,
      ref: pullRequest.head.sha
    });

    const allPassing = checkRuns.check_runs.every(
      run => run.conclusion === 'success' || run.conclusion === 'skipped'
    );

    if (!allPassing) {
      logger.info(`Tests not passing for PR #${pullRequest.number}, bounty not claimed`);
      return;
    }

    // Get PR author's MNEE address (from PR description or user profile)
    const solverAddress = await extractMneeAddress(pullRequest);

    if (!solverAddress) {
      // Post comment asking for MNEE address
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: `🎉 **Congratulations!** Your PR fixes issue #${issueNumber} which has a bounty of **${bounty.currentAmount} MNEE**!

To claim your bounty, please add your MNEE address to your PR description in the following format:
\`\`\`
MNEE: 1YourMneeAddressHere
\`\`\`

Once you've added your MNEE address, the bounty will be automatically released to you.

**Note:** MNEE uses Bitcoin-style addresses. If you need help setting up an MNEE wallet, visit [docs.mnee.io](https://docs.mnee.io).`
      });

      logger.info(`Requested MNEE address from PR author ${pullRequest.user.login}`);
      return;
    }

    // Validate MNEE address
    const isValidAddress = await mneeService.validateAddress(solverAddress);
    if (!isValidAddress) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: `⚠️ **Invalid MNEE Address**

The MNEE address you provided appears to be invalid. Please check and update it in your PR description.

MNEE addresses should look like: \`1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\`

For help with MNEE wallets, visit [docs.mnee.io](https://docs.mnee.io).`
      });
      return;
    }

    // Send MNEE payment
    let paymentResult;
    try {
      paymentResult = await mneeService.sendPayment(
        solverAddress,
        bounty.currentAmount,
        bounty.bountyId
      );
    } catch (error) {
      logger.error(`Failed to send MNEE payment for bounty ${bounty.bountyId}:`, error);

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Payment Failed**

There was an error sending your MNEE payment. Our team has been notified and will resolve this issue.

Error: ${error.message}

Please contact support if this persists.`
      });
      return;
    }

    // Mark bounty as claimed in our backend
    await bountyService.claimBounty(
      bounty.bountyId,
      solverAddress,
      paymentResult.transactionId
    );

    // Update database
    bounty.pullRequestUrl = pullRequest.html_url;
    await bounty.save();

    // Post success comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `✅ **Bounty Claimed!**

The bounty of **${bounty.currentAmount} MNEE** has been successfully transferred to ${solverAddress}.

MNEE Transaction ID: \`${paymentResult.transactionId}\`
Pull Request: #${pullRequest.number}

Thank you for your contribution! 🚀

The payment should appear in your MNEE wallet shortly.`
    });

    // Close the issue
    await octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed'
    });

    logger.info(`Successfully claimed bounty ${bounty.bountyId} for ${pullRequest.user.login}`);
  } catch (error) {
    logger.error(`Failed to claim bounty for ${repository}#${issueNumber}:`, error);
  }
}

// Extract MNEE address from PR description
async function extractMneeAddress(pullRequest) {
  const body = pullRequest.body || '';

  // Look for MNEE address in PR description
  // MNEE uses Bitcoin-style addresses
  const mneePattern = /mnee:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i;
  const match = body.match(mneePattern);

  if (match) {
    return match[1];
  }

  // Also check for common variations
  const altPatterns = [
    /mnee\s+address:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i,
    /payment\s+address:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i
  ];

  for (const pattern of altPatterns) {
    const altMatch = body.match(pattern);
    if (altMatch) {
      return altMatch[1];
    }
  }

  return null;
}

export default router;