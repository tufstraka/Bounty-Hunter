
import express from 'express';
import crypto from 'crypto';
const router = express.Router();
import logger from '../utils/logger.js';
import Bounty from '../models/Bounty.js';
import User from '../models/User.js';
import bountyService from '../services/bountyService.js';
import mneeService from '../services/mnee.js';
import ethereumPaymentService from '../services/ethereumPayment.js';
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

        const { data: issue } = await octokit.rest.issues.create({
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
      
      await octokit.rest.issues.createComment({
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
        
        // Generate explorer link for MNEE (BSV-based)
        const explorerUrl = `https://whatsonchain.com/tx/${tx_id}`;
        
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: bounty.issueId,
          body: `✅ **Payment Confirmed!**

🔗 **[View Transaction on WhatsOnChain](${explorerUrl})**

Transaction Hash: \`${tx_id}\`

The MNEE payment has been successfully processed.`
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
        
        await octokit.rest.issues.createComment({
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

    logger.info(`[PR-WEBHOOK] ========== PULL REQUEST EVENT ==========`);
    logger.info(`[PR-WEBHOOK] Action: ${action}`);
    logger.info(`[PR-WEBHOOK] Repository: ${repository?.full_name}`);
    logger.info(`[PR-WEBHOOK] PR Number: ${pull_request?.number}`);
    logger.info(`[PR-WEBHOOK] PR Title: ${pull_request?.title}`);
    logger.info(`[PR-WEBHOOK] PR State: ${pull_request?.state}`);
    logger.info(`[PR-WEBHOOK] PR Merged: ${pull_request?.merged}`);
    logger.info(`[PR-WEBHOOK] PR Merged By: ${pull_request?.merged_by?.login || 'N/A'}`);
    logger.info(`[PR-WEBHOOK] PR Author: ${pull_request?.user?.login}`);
    logger.info(`[PR-WEBHOOK] Installation ID: ${installation?.id || 'N/A'}`);
    logger.info(`[PR-WEBHOOK] PR Body Length: ${pull_request?.body?.length || 0} chars`);
    logger.debug(`[PR-WEBHOOK] PR Body: ${pull_request?.body?.substring(0, 500) || '(empty)'}`);

    if (action === 'closed' && pull_request.merged) {
      logger.info(`[PR-WEBHOOK] ✓ PR #${pull_request.number} was MERGED in ${repository.full_name}`);

      // Check if PR references any bounty issues
      logger.info(`[PR-WEBHOOK] Extracting referenced issues from PR body...`);
      const referencedIssues = extractReferencedIssues(pull_request.body || '');
      logger.info(`[PR-WEBHOOK] Referenced issues found: ${referencedIssues.length > 0 ? referencedIssues.join(', ') : 'NONE'}`);

      if (referencedIssues.length === 0) {
        logger.warn(`[PR-WEBHOOK] ⚠ No issue references found in PR body. PR body was: "${pull_request.body?.substring(0, 200) || '(empty)'}"`);
      }

      for (const issueNumber of referencedIssues) {
        logger.info(`[PR-WEBHOOK] Processing issue #${issueNumber}...`);
        await checkAndClaimBounty(repository.full_name, issueNumber, pull_request, installation?.id);
      }
      
      logger.info(`[PR-WEBHOOK] ========== PR EVENT PROCESSING COMPLETE ==========`);
    } else {
      logger.info(`[PR-WEBHOOK] ✗ Skipping - action=${action}, merged=${pull_request?.merged} (need action=closed AND merged=true)`);
    }
  } catch (error) {
    logger.error('[PR-WEBHOOK] Error handling pull request:', error);
    logger.error(`[PR-WEBHOOK] Error stack: ${error.stack}`);
  }
}

// Handle workflow run events
async function handleWorkflowRun(event) {
  try {
    const { action, workflow_run, installation } = event;

    logger.info(`[WORKFLOW-WEBHOOK] ========== WORKFLOW RUN EVENT ==========`);
    logger.info(`[WORKFLOW-WEBHOOK] Action: ${action}`);
    logger.info(`[WORKFLOW-WEBHOOK] Workflow Name: ${workflow_run?.name}`);
    logger.info(`[WORKFLOW-WEBHOOK] Conclusion: ${workflow_run?.conclusion}`);
    logger.info(`[WORKFLOW-WEBHOOK] Repository: ${workflow_run?.repository?.full_name}`);
    logger.info(`[WORKFLOW-WEBHOOK] Associated PRs: ${workflow_run?.pull_requests?.length || 0}`);

    if (action === 'completed' && workflow_run.conclusion === 'success') {
      logger.info(`[WORKFLOW-WEBHOOK] ✓ Workflow completed successfully`);
      
      // Check if this workflow run is associated with a PR
      if (workflow_run.pull_requests && workflow_run.pull_requests.length > 0) {
        const pr = workflow_run.pull_requests[0];
        logger.info(`[WORKFLOW-WEBHOOK] Processing PR #${pr.number} from workflow`);

        // Get Octokit instance for this installation
        logger.info(`[WORKFLOW-WEBHOOK] Getting Octokit instance...`);
        const octokit = await githubAppService.getOctokitForRepoFullName(workflow_run.repository.full_name);
        logger.info(`[WORKFLOW-WEBHOOK] ✓ Octokit instance obtained`);

        // Get full PR details
        const [owner, repo] = workflow_run.repository.full_name.split('/');
        logger.info(`[WORKFLOW-WEBHOOK] Fetching PR details for ${owner}/${repo}#${pr.number}...`);
        const { data: pullRequest } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: pr.number
        });
        logger.info(`[WORKFLOW-WEBHOOK] ✓ PR fetched - State: ${pullRequest.state}, Merged: ${pullRequest.merged}`);

        // Check referenced issues
        const referencedIssues = extractReferencedIssues(pullRequest.body || '');
        logger.info(`[WORKFLOW-WEBHOOK] Referenced issues: ${referencedIssues.length > 0 ? referencedIssues.join(', ') : 'NONE'}`);

        for (const issueNumber of referencedIssues) {
          logger.info(`[WORKFLOW-WEBHOOK] Checking bounty for issue #${issueNumber}...`);
          await checkAndClaimBounty(workflow_run.repository.full_name, issueNumber, pullRequest, installation?.id);
        }
      } else {
        logger.info(`[WORKFLOW-WEBHOOK] ✗ No PRs associated with this workflow run`);
      }
    } else {
      logger.info(`[WORKFLOW-WEBHOOK] ✗ Skipping - action=${action}, conclusion=${workflow_run?.conclusion}`);
    }
    
    logger.info(`[WORKFLOW-WEBHOOK] ========== WORKFLOW EVENT COMPLETE ==========`);
  } catch (error) {
    logger.error('[WORKFLOW-WEBHOOK] Error handling workflow run:', error);
    logger.error(`[WORKFLOW-WEBHOOK] Error stack: ${error.stack}`);
  }
}

// Handle issue events
async function handleIssues(event) {
  try {
    const { action, issue, repository, installation } = event;

    logger.info(`[ISSUE-WEBHOOK] ========== ISSUE EVENT ==========`);
    logger.info(`[ISSUE-WEBHOOK] Action: ${action}`);
    logger.info(`[ISSUE-WEBHOOK] Issue #${issue?.number}: ${issue?.title}`);
    logger.info(`[ISSUE-WEBHOOK] Repository: ${repository?.full_name}`);
    logger.info(`[ISSUE-WEBHOOK] Issue State: ${issue?.state}`);
    logger.info(`[ISSUE-WEBHOOK] Issue Labels: ${issue?.labels?.map(l => l.name).join(', ') || 'none'}`);

    if (action === 'closed') {
      logger.info(`[ISSUE-WEBHOOK] Issue #${issue.number} closed in ${repository.full_name}`);

      // Check if this issue has an active bounty
      logger.info(`[ISSUE-WEBHOOK] Checking for active bounty on issue #${issue.number}...`);
      const bounty = await Bounty.findOne({
        repository: repository.full_name,
        issueId: issue.number,
        status: 'active'
      });

      if (bounty) {
        logger.warn(`[ISSUE-WEBHOOK] ⚠ Issue #${issue.number} with ACTIVE bounty ${bounty.bountyId} was closed manually!`);
        logger.warn(`[ISSUE-WEBHOOK] Bounty amount: ${bounty.currentAmount} MNEE`);
        // Optionally cancel the bounty or keep it active
      } else {
        logger.info(`[ISSUE-WEBHOOK] No active bounty found for issue #${issue.number}`);
      }
    }
    
    logger.info(`[ISSUE-WEBHOOK] ========== ISSUE EVENT COMPLETE ==========`);
  } catch (error) {
    logger.error('[ISSUE-WEBHOOK] Error handling issue event:', error);
    logger.error(`[ISSUE-WEBHOOK] Error stack: ${error.stack}`);
  }
}

// Extract referenced issues from PR body
function extractReferencedIssues(body) {
  logger.debug(`[EXTRACT-ISSUES] Extracting issues from body (${body?.length || 0} chars)`);
  logger.debug(`[EXTRACT-ISSUES] Body content: "${body?.substring(0, 300) || '(empty)'}"`);
  
  const issues = new Set();

  // Common patterns: fixes #123, closes #123, resolves #123
  // Also handles "Fixes: #123" (with colon) variant
  const patterns = [
    /(?:fixes|closes|resolves|fix|close|resolve):?\s+#(\d+)/gi,
    /(?:fixes|closes|resolves|fix|close|resolve):?\s+(?:https?:\/\/github\.com\/[\w-]+\/[\w-]+\/issues\/)(\d+)/gi
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    let match;
    // Reset lastIndex since we're reusing patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(body)) !== null) {
      logger.info(`[EXTRACT-ISSUES] ✓ Found issue reference: #${match[1]} (pattern ${i + 1}, match: "${match[0]}")`);
      issues.add(parseInt(match[1]));
    }
  }

  const result = Array.from(issues);
  logger.info(`[EXTRACT-ISSUES] Total unique issues found: ${result.length} - [${result.join(', ')}]`);
  
  if (result.length === 0 && body && body.length > 0) {
    // Log common patterns that might be close but didn't match
    const possibleRefs = body.match(/#\d+/g);
    if (possibleRefs) {
      logger.warn(`[EXTRACT-ISSUES] ⚠ Found #N patterns that weren't prefixed with fixes/closes/resolves: ${possibleRefs.join(', ')}`);
    }
  }
  
  return result;
}

// Check and claim bounty for an issue
async function checkAndClaimBounty(repository, issueNumber, pullRequest, installationId = null) {
  logger.info(`[CLAIM-BOUNTY] ========== CLAIM BOUNTY CHECK ==========`);
  logger.info(`[CLAIM-BOUNTY] Repository: ${repository}`);
  logger.info(`[CLAIM-BOUNTY] Issue Number: ${issueNumber}`);
  logger.info(`[CLAIM-BOUNTY] PR Number: ${pullRequest?.number}`);
  logger.info(`[CLAIM-BOUNTY] PR Author: ${pullRequest?.user?.login}`);
  logger.info(`[CLAIM-BOUNTY] PR State: ${pullRequest?.state}`);
  logger.info(`[CLAIM-BOUNTY] PR Merged: ${pullRequest?.merged}`);
  logger.info(`[CLAIM-BOUNTY] Installation ID: ${installationId || 'N/A'}`);
  
  try {
    // Find active bounty for this issue
    logger.info(`[CLAIM-BOUNTY] Step 1: Looking for active bounty...`);
    logger.info(`[CLAIM-BOUNTY] Query: { repository: "${repository}", issueId: ${issueNumber}, status: "active" }`);
    
    const bounty = await Bounty.findOne({
      repository,
      issueId: issueNumber,
      status: 'active'
    });

    if (!bounty) {
      logger.warn(`[CLAIM-BOUNTY] ✗ No active bounty found for ${repository}#${issueNumber}`);
      logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (NO BOUNTY) ==========`);
      return;
    }

    logger.info(`[CLAIM-BOUNTY] ✓ Found bounty!`);
    logger.info(`[CLAIM-BOUNTY]   - Bounty ID: ${bounty.bountyId}`);
    logger.info(`[CLAIM-BOUNTY]   - Initial Amount: ${bounty.initialAmount} MNEE`);
    logger.info(`[CLAIM-BOUNTY]   - Current Amount: ${bounty.currentAmount} MNEE`);
    logger.info(`[CLAIM-BOUNTY]   - Max Amount: ${bounty.maxAmount} MNEE`);
    logger.info(`[CLAIM-BOUNTY]   - Status: ${bounty.status}`);
    logger.info(`[CLAIM-BOUNTY]   - Created: ${bounty.createdAt}`);

    // Get Octokit instance for this repository
    logger.info(`[CLAIM-BOUNTY] Step 2: Getting Octokit instance for ${repository}...`);
    const octokit = await githubAppService.getOctokitForRepoFullName(repository);
    logger.info(`[CLAIM-BOUNTY] ✓ Octokit instance obtained`);

    // Verify tests are passing
    const [owner, repo] = repository.split('/');
    logger.info(`[CLAIM-BOUNTY] Step 3: Checking CI status for PR SHA: ${pullRequest.head?.sha}...`);
    
    const { data: checkRuns } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: pullRequest.head.sha
    });

    logger.info(`[CLAIM-BOUNTY] Found ${checkRuns.check_runs.length} check runs:`);
    checkRuns.check_runs.forEach((run, i) => {
      logger.info(`[CLAIM-BOUNTY]   ${i + 1}. ${run.name}: status=${run.status}, conclusion=${run.conclusion}`);
    });

    const allPassing = checkRuns.check_runs.every(
      run => run.conclusion === 'success' || run.conclusion === 'skipped'
    );

    if (!allPassing) {
      const failingChecks = checkRuns.check_runs.filter(
        run => run.conclusion !== 'success' && run.conclusion !== 'skipped'
      );
      logger.warn(`[CLAIM-BOUNTY] ✗ Tests not passing for PR #${pullRequest.number}`);
      logger.warn(`[CLAIM-BOUNTY] Failing checks: ${failingChecks.map(c => `${c.name}(${c.conclusion})`).join(', ')}`);
      logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (TESTS FAILING) ==========`);
      return;
    }
    
    logger.info(`[CLAIM-BOUNTY] ✓ All ${checkRuns.check_runs.length} checks passing`);

    // Get PR author's payment address (from PR description or user profile)
    // Can be MNEE (Bitcoin-style) or Ethereum address when USE_BLOCKCHAIN is enabled
    const isBlockchainMode = process.env.USE_BLOCKCHAIN === 'true';
    logger.info(`[CLAIM-BOUNTY] Step 4: Extracting payment address from PR... (blockchain mode: ${isBlockchainMode})`);
    const solverAddress = await extractPaymentAddress(pullRequest, isBlockchainMode);
    logger.info(`[CLAIM-BOUNTY] Extracted address: ${solverAddress || '(none found)'}`);

    if (!solverAddress) {
      logger.warn(`[CLAIM-BOUNTY] ✗ No payment address found in PR description`);
      logger.info(`[CLAIM-BOUNTY] Posting comment to request payment address...`);
      
      // Post comment asking for payment address
      const addressInstructions = isBlockchainMode
        ? `To claim your bounty, please add your Ethereum address to your PR description in the following format:
\`\`\`
ETH: 0xYourEthereumAddressHere
\`\`\`

Or use the traditional MNEE format:
\`\`\`
MNEE: 1YourMneeAddressHere
\`\`\`

**Note:** Ethereum addresses start with \`0x\`. MNEE addresses are Bitcoin-style (start with \`1\` or \`3\`).`
        : `To claim your bounty, please add your MNEE address to your PR description in the following format:
\`\`\`
MNEE: 1YourMneeAddressHere
\`\`\`

**Note:** MNEE uses Bitcoin-style addresses. If you need help setting up an MNEE wallet, visit [docs.mnee.io](https://docs.mnee.io).`;

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: `🎉 **Congratulations!** Your PR fixes issue #${issueNumber} which has a bounty of **${bounty.currentAmount} MNEE**!

${addressInstructions}

Once you've added your payment address, the bounty will be automatically released to you.`
      });

      logger.info(`[CLAIM-BOUNTY] ✓ Comment posted, requested payment address from ${pullRequest.user.login}`);
      logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (AWAITING ADDRESS) ==========`);
      return;
    }

    // Validate payment address
    const isEthereumAddress = solverAddress.startsWith('0x') && solverAddress.length === 42;
    logger.info(`[CLAIM-BOUNTY] Step 5: Validating payment address: ${solverAddress} (Ethereum: ${isEthereumAddress})`);
    
    let isValidAddress = false;
    if (isEthereumAddress) {
      // Basic Ethereum address validation
      isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(solverAddress);
    } else {
      // MNEE Bitcoin-style address validation
      isValidAddress = await mneeService.validateAddress(solverAddress);
    }
    logger.info(`[CLAIM-BOUNTY] Address validation result: ${isValidAddress}`);
    
    if (!isValidAddress) {
      logger.warn(`[CLAIM-BOUNTY] ✗ Invalid payment address: ${solverAddress}`);
      const errorMessage = isEthereumAddress
        ? `⚠️ **Invalid Ethereum Address**

The Ethereum address you provided appears to be invalid. Please check and update it in your PR description.

Ethereum addresses should be 42 characters starting with \`0x\`, like: \`0x1234567890123456789012345678901234567890\``
        : `⚠️ **Invalid MNEE Address**

The MNEE address you provided appears to be invalid. Please check and update it in your PR description.

MNEE addresses should look like: \`1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\`

For help with MNEE wallets, visit [docs.mnee.io](https://docs.mnee.io).`;

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: errorMessage
      });
      logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (INVALID ADDRESS) ==========`);
      return;
    }
    
    logger.info(`[CLAIM-BOUNTY] ✓ Payment address is valid`);

    // Send payment (MNEE SDK or Blockchain depending on address type and mode)
    logger.info(`[CLAIM-BOUNTY] Step 6: Sending payment...`);
    logger.info(`[CLAIM-BOUNTY]   - To: ${solverAddress}`);
    logger.info(`[CLAIM-BOUNTY]   - Amount: ${bounty.currentAmount} MNEE`);
    logger.info(`[CLAIM-BOUNTY]   - Bounty ID: ${bounty.bountyId}`);
    logger.info(`[CLAIM-BOUNTY]   - Payment method: ${isEthereumAddress ? 'Blockchain (ERC-20)' : 'MNEE SDK'}`);
    
    let paymentResult;
    try {
      if (isEthereumAddress && process.env.USE_BLOCKCHAIN === 'true') {
        // Use Ethereum payment service for ERC-20 transfers
        logger.info(`[CLAIM-BOUNTY] Using Ethereum payment service for ERC-20 transfer`);
        
        // Initialize if not already
        if (!ethereumPaymentService.initialized) {
          await ethereumPaymentService.initialize();
        }
        
        paymentResult = await ethereumPaymentService.sendPayment(
          solverAddress,
          bounty.currentAmount,
          bounty.bountyId
        );
      } else {
        // Use MNEE SDK for Bitcoin-style addresses
        logger.info(`[CLAIM-BOUNTY] Using MNEE SDK for payment`);
        paymentResult = await mneeService.sendPayment(
          solverAddress,
          bounty.currentAmount,
          bounty.bountyId
        );
      }
      logger.info(`[CLAIM-BOUNTY] ✓ Payment sent successfully!`);
      logger.info(`[CLAIM-BOUNTY]   - Transaction ID: ${paymentResult.transactionId}`);
    } catch (error) {
      logger.error(`[CLAIM-BOUNTY] ✗ Failed to send payment for bounty ${bounty.bountyId}:`, error);
      logger.error(`[CLAIM-BOUNTY] Payment error details: ${error.message}`);
      logger.error(`[CLAIM-BOUNTY] Payment error stack: ${error.stack}`);

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Payment Failed**

There was an error sending your ${isEthereumAddress ? 'ERC-20 token' : 'MNEE'} payment. Our team has been notified and will resolve this issue.

Error: ${error.message}

Please contact support if this persists.`
      });
      logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (PAYMENT FAILED) ==========`);
      return;
    }

    // Mark bounty as claimed in our backend (includes PR URL and solver info)
    logger.info(`[CLAIM-BOUNTY] Step 7: Marking bounty as claimed in database...`);
    const claimResult = await bountyService.claimBounty(
      bounty.bountyId,
      solverAddress,
      paymentResult.transactionId,
      pullRequest.user.login, // Pass GitHub login
      pullRequest.html_url    // Pass PR URL
    );
    logger.info(`[CLAIM-BOUNTY] ✓ Bounty marked as claimed with status: claimed`);
    
    // Update local bounty reference to reflect claimed status
    Object.assign(bounty, claimResult.bounty);
    logger.info(`[CLAIM-BOUNTY] ✓ Local bounty object updated`);

    // Update solver's user stats
    logger.info(`[CLAIM-BOUNTY] Step 9: Updating user stats for ${pullRequest.user.login}...`);
    try {
      const solver = await User.findByGithubLogin(pullRequest.user.login);
      if (solver) {
        await solver.updateStats();
        logger.info(`[CLAIM-BOUNTY] ✓ Updated stats for user ${pullRequest.user.login}`);
      } else {
        logger.info(`[CLAIM-BOUNTY] User ${pullRequest.user.login} not found in database (stats not updated)`);
      }
    } catch (statsError) {
      logger.warn(`[CLAIM-BOUNTY] Failed to update user stats for ${pullRequest.user.login}:`, statsError.message);
    }

    // Post success comment with explorer link
    logger.info(`[CLAIM-BOUNTY] Step 10: Posting success comment...`);
    
    // Generate explorer link based on payment method
    let explorerUrl;
    let explorerName;
    if (isEthereumAddress) {
      // Determine if mainnet or testnet based on environment
      const isTestnet = process.env.ETHEREUM_RPC_URL?.includes('sepolia') ||
                        process.env.ETHEREUM_RPC_URL?.includes('goerli') ||
                        process.env.ETHEREUM_NETWORK === 'sepolia';
      if (isTestnet) {
        explorerUrl = `https://sepolia.etherscan.io/tx/${paymentResult.transactionId}`;
        explorerName = 'Sepolia Etherscan';
      } else {
        explorerUrl = `https://etherscan.io/tx/${paymentResult.transactionId}`;
        explorerName = 'Etherscan';
      }
    } else {
      // MNEE uses BSV/Bitcoin - use WhatsOnChain
      explorerUrl = `https://whatsonchain.com/tx/${paymentResult.transactionId}`;
      explorerName = 'WhatsOnChain';
    }
    
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `✅ **Bounty Claimed!**

The bounty of **${bounty.currentAmount} MNEE** has been successfully transferred to \`${solverAddress}\`.

🔗 **[View Transaction on ${explorerName}](${explorerUrl})**

Transaction Hash: \`${paymentResult.transactionId}\`
Pull Request: #${pullRequest.number}

Thank you for your contribution! 🚀`
    });
    logger.info(`[CLAIM-BOUNTY] ✓ Success comment posted`);

    // Close the issue
    logger.info(`[CLAIM-BOUNTY] Step 11: Closing issue #${issueNumber}...`);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed'
    });
    logger.info(`[CLAIM-BOUNTY] ✓ Issue closed`);

    logger.info(`[CLAIM-BOUNTY] 🎉 Successfully claimed bounty ${bounty.bountyId} for ${pullRequest.user.login}!`);
    logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (SUCCESS) ==========`);
  } catch (error) {
    logger.error(`[CLAIM-BOUNTY] ✗ Failed to claim bounty for ${repository}#${issueNumber}:`, error);
    logger.error(`[CLAIM-BOUNTY] Error stack: ${error.stack}`);
    logger.info(`[CLAIM-BOUNTY] ========== CLAIM CHECK COMPLETE (ERROR) ==========`);
  }
}

// Extract payment address from PR description
// Supports both MNEE (Bitcoin-style) and Ethereum addresses
async function extractPaymentAddress(pullRequest, isBlockchainMode = false) {
  const body = pullRequest.body || '';
  logger.debug(`[EXTRACT-ADDRESS] Extracting payment address from PR body (${body.length} chars)`);
  logger.debug(`[EXTRACT-ADDRESS] Body preview: "${body.substring(0, 200)}"`);
  logger.debug(`[EXTRACT-ADDRESS] Blockchain mode: ${isBlockchainMode}`);

  // First, check for Ethereum addresses (when blockchain mode is enabled)
  if (isBlockchainMode) {
    // Look for ETH: 0x... pattern
    const ethPattern = /(?:eth|ethereum):\s*(0x[a-fA-F0-9]{40})/i;
    const ethMatch = body.match(ethPattern);
    if (ethMatch) {
      logger.info(`[EXTRACT-ADDRESS] ✓ Found Ethereum address: ${ethMatch[1]}`);
      return ethMatch[1];
    }

    // Also check for MNEE: 0x... pattern (user may use MNEE prefix with ETH address)
    const mneeEthPattern = /mnee:\s*(0x[a-fA-F0-9]{40})/i;
    const mneeEthMatch = body.match(mneeEthPattern);
    if (mneeEthMatch) {
      logger.info(`[EXTRACT-ADDRESS] ✓ Found Ethereum address with MNEE prefix: ${mneeEthMatch[1]}`);
      return mneeEthMatch[1];
    }
  }

  // Look for MNEE address in PR description (Bitcoin-style addresses)
  const mneePattern = /mnee:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i;
  const match = body.match(mneePattern);

  if (match) {
    logger.info(`[EXTRACT-ADDRESS] ✓ Found MNEE address with pattern 1: ${match[1]}`);
    return match[1];
  }

  // Also check for common variations
  const altPatterns = [
    /mnee\s+address:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i,
    /payment\s+address:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i
  ];

  for (let i = 0; i < altPatterns.length; i++) {
    const pattern = altPatterns[i];
    const altMatch = body.match(pattern);
    if (altMatch) {
      logger.info(`[EXTRACT-ADDRESS] ✓ Found MNEE address with alt pattern ${i + 1}: ${altMatch[1]}`);
      return altMatch[1];
    }
  }

  logger.info(`[EXTRACT-ADDRESS] ✗ No payment address found in PR body`);
  return null;
}

export default router;