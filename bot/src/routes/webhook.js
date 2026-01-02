import express from 'express';
import crypto from 'crypto';
const router = express.Router();
import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import User from '../models/User.js';
import bountyService from '../services/bountyService.js';
import mneeService from '../services/mnee.js';
import githubAppService from '../services/githubApp.js';
import db from '../db.js';

// Verify GitHub webhook signature
function verifyWebhookSignature(payload, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

// Verify API key for GitHub Actions
function verifyApiKey(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  return apiKey && apiKey === process.env.API_KEY;
}

// GitHub webhook endpoint - receives events from GitHub
router.post('/github', async (req, res) => {
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

/**
 * Create Bounty Webhook - Called by GitHub Actions to create a bounty for failed tests
 *
 * POST /webhooks/create-bounty
 *
 * Request Body:
 * {
 *   "repository": "owner/repo",
 *   "runId": 123456789,
 *   "jobName": "test",
 *   "failureUrl": "https://github.com/owner/repo/actions/runs/123456789",
 *   "issueNumber": 123,
 *   "issueUrl": "https://github.com/owner/repo/issues/123",
 *   "errorLog": "Test output...",
 *   "testFile": "tests/test_auth.py",
 *   "testName": "test_user_login",
 *   "bountyAmount": 50,
 *   "maxAmount": 150
 * }
 */
router.post('/create-bounty', async (req, res) => {
  try {
    // Verify API key
    if (!verifyApiKey(req)) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const {
      repository,
      runId,
      jobName,
      failureUrl,
      issueNumber,
      issueUrl,
      errorLog,
      testFile,
      testName,
      bountyAmount,
      maxAmount
    } = req.body;

    // Validate required fields
    if (!repository || !bountyAmount) {
      return res.status(400).json({
        error: 'Missing required fields: repository, bountyAmount'
      });
    }

    logger.info(`Create bounty request for ${repository} - amount: ${bountyAmount} MNEE`);

    let finalIssueUrl = issueUrl;
    let finalIssueNumber = issueNumber;

    // If no issue exists, create one via GitHub App
    if (!issueNumber || !issueUrl) {
      try {
        const [owner, repo] = repository.split('/');
        const octokit = await githubAppService.getOctokitForRepo(owner, repo);
        
        // Create issue for the failing test
        const issueTitle = testName
          ? `🐛 Failing Test: ${testName}`
          : `🐛 CI/CD Failure in ${jobName || 'workflow'}`;
        
        const issueBody = `## Automated Bounty Issue

A failing test has been detected and a bounty has been created.

**Repository:** ${repository}
**Workflow Run:** ${runId ? `[View Run](${failureUrl})` : 'N/A'}
**Test File:** ${testFile || 'N/A'}
**Test Name:** ${testName || 'N/A'}

### Bounty Details
- **Initial Amount:** ${bountyAmount} MNEE
- **Maximum Amount:** ${maxAmount || bountyAmount * 3} MNEE
- **Escalation:** Amount increases over time until fixed

### Error Log
\`\`\`
${errorLog ? errorLog.slice(0, 2000) : 'No error log provided'}
\`\`\`

### How to Claim
1. Fork this repository
2. Fix the failing test
3. Create a PR that references this issue (e.g., "Fixes #${'{issueNumber}'}")
4. Add your MNEE address to the PR description: \`MNEE: youraddress\`
5. Once merged and tests pass, payment is automatic!

---
*This issue was created by [FixFlow Bot](https://github.com/bounty-hunter/bounty-hunter)*`;

        const { data: issue } = await octokit.issues.create({
          owner,
          repo,
          title: issueTitle,
          body: issueBody,
          labels: ['bounty', 'bug', 'help wanted']
        });

        finalIssueNumber = issue.number;
        finalIssueUrl = issue.html_url;

        logger.info(`Created issue #${issue.number} for bounty in ${repository}`);
      } catch (error) {
        logger.error('Failed to create GitHub issue:', error);
        return res.status(500).json({
          error: 'Failed to create GitHub issue',
          message: error.message
        });
      }
    }

    // Create the bounty
    const result = await bountyService.createBounty({
      repository,
      issueId: finalIssueNumber,
      amount: bountyAmount,
      maxAmount: maxAmount || bountyAmount * 3,
      issueUrl: finalIssueUrl,
      metadata: {
        runId,
        jobName,
        failureUrl,
        errorLog: errorLog?.slice(0, 5000), // Limit stored error log
        testFile,
        testName
      }
    });

    // Post comment on the issue announcing the bounty
    try {
      const [owner, repo] = repository.split('/');
      const octokit = await githubAppService.getOctokitForRepo(owner, repo);
      
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: finalIssueNumber,
        body: `💰 **Bounty Created!**

A bounty of **${bountyAmount} MNEE** has been placed on this issue.

**How to claim:**
1. Fix the issue and create a PR
2. Reference this issue in your PR (e.g., "Fixes #${finalIssueNumber}")
3. Add your MNEE address: \`MNEE: your_address_here\`

The bounty will increase over time if not claimed. Maximum: ${maxAmount || bountyAmount * 3} MNEE.

Good luck! 🚀`
      });
    } catch (error) {
      logger.warn('Failed to post bounty comment:', error.message);
      // Don't fail the request for this
    }

    logger.info(`Bounty created: ${result.bountyId} for ${repository}#${finalIssueNumber}`);

    res.status(201).json({
      success: true,
      bountyId: result.bountyId,
      issueNumber: finalIssueNumber,
      issueUrl: finalIssueUrl,
      amount: bountyAmount,
      maxAmount: maxAmount || bountyAmount * 3
    });
  } catch (error) {
    logger.error('Failed to create bounty via webhook:', error);
    res.status(500).json({
      error: 'Failed to create bounty',
      message: error.message
    });
  }
});

/**
 * MNEE Status Webhook - Receives transaction status updates from MNEE
 *
 * POST /webhooks/mnee-status
 *
 * Request Body:
 * {
 *   "ticketId": "abc123",
 *   "status": "SUCCESS",
 *   "tx_id": "transaction123",
 *   "errors": null
 * }
 */
router.post('/mnee-status', async (req, res) => {
  try {
    const { ticketId, status, tx_id, errors } = req.body;

    logger.info(`MNEE status webhook: ticketId=${ticketId}, status=${status}`);

    if (!ticketId) {
      return res.status(400).json({ error: 'Missing ticketId' });
    }

    // Find bounty by payment ticket ID
    const { rows } = await db.query(
      'SELECT * FROM bounties WHERE claim_transaction_hash LIKE $1',
      [`%${ticketId}%`]
    );

    if (!rows[0]) {
      logger.warn(`No bounty found for ticketId: ${ticketId}`);
      return res.status(404).json({ error: 'Bounty not found for this ticket' });
    }

    const bounty = Bounty.fromRow(rows[0]);

    // Update based on status
    if (status === 'SUCCESS' || status === 'MINED') {
      await db.query(
        'UPDATE bounties SET claim_transaction_hash = $1, updated_at = $2 WHERE id = $3',
        [tx_id, new Date(), rows[0].id]
      );

      // Notify on GitHub
      try {
        const [owner, repo] = bounty.repository.split('/');
        const octokit = await githubAppService.getOctokitForRepo(owner, repo);
        
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: bounty.issueId,
          body: `✅ **Payment Confirmed!**\n\nTransaction ID: \`${tx_id}\`\n\nThe MNEE payment has been successfully processed.`
        });
      } catch (error) {
        logger.warn('Failed to post payment confirmation comment:', error.message);
      }

      logger.info(`Payment confirmed for bounty ${bounty.bountyId}: ${tx_id}`);
    } else if (status === 'FAILED') {
      await db.query(
        'UPDATE bounties SET metadata = metadata || $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify({ payment_error: errors }), new Date(), rows[0].id]
      );

      // Notify failure on GitHub
      try {
        const [owner, repo] = bounty.repository.split('/');
        const octokit = await githubAppService.getOctokitForRepo(owner, repo);
        
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: bounty.issueId,
          body: `❌ **Payment Failed**\n\nThere was an issue processing the MNEE payment. Our team has been notified.\n\nError: ${errors || 'Unknown error'}\n\nPlease contact support if this persists.`
        });
      } catch (error) {
        logger.warn('Failed to post payment failure comment:', error.message);
      }

      logger.error(`Payment failed for bounty ${bounty.bountyId}: ${errors}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('MNEE status webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
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
      paymentResult.transactionId,
      pullRequest.user.login // Pass GitHub login
    );

    // Update database
    bounty.pullRequestUrl = pullRequest.html_url;
    bounty.solverGithubLogin = pullRequest.user.login;
    await bounty.save();

    // Update solver's user stats
    try {
      const solver = await User.findByGithubLogin(pullRequest.user.login);
      if (solver) {
        await solver.updateStats();
        logger.info(`Updated stats for user ${pullRequest.user.login}`);
      }
    } catch (statsError) {
      logger.warn(`Failed to update user stats for ${pullRequest.user.login}:`, statsError.message);
    }

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