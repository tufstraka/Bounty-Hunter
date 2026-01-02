const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput('github_token', { required: true });
    const botServerUrl = core.getInput('bot_server_url', { required: true });
    const botApiKey = core.getInput('bot_api_key', { required: true });
    const configFile = core.getInput('config_file');
    const defaultBountyAmount = parseInt(core.getInput('bounty_amount'));
    const maxBounty = parseInt(core.getInput('max_bounty'));
    const onFailureOnly = core.getInput('on_failure_only') === 'true';

    // Get context
    const { context } = github;
    const octokit = github.getOctokit(githubToken);

    // Check if this is a failed workflow (for workflow_run trigger)
    const workflowRunConclusion = context.payload.workflow_run?.conclusion;
    if (onFailureOnly && workflowRunConclusion !== 'failure') {
      core.info(`Workflow did not fail (conclusion: ${workflowRunConclusion || 'not a workflow_run event'}), skipping bounty creation`);
      core.setOutput('bounty_created', 'false');
      return;
    }

    core.info(`Workflow run failed! Creating bounty...`);

    // Load configuration
    let config = {
      default_amount: defaultBountyAmount,
      max_bounty: maxBounty,
      severity_multipliers: {
        critical: 4.0,
        high: 2.0,
        medium: 1.0,
        low: 0.5
      }
    };

    if (fs.existsSync(configFile)) {
      try {
        const configContent = fs.readFileSync(configFile, 'utf8');
        const loadedConfig = yaml.load(configContent);
        config = { ...config, ...loadedConfig.bounty_config };
        core.info(`Loaded configuration from ${configFile}`);
      } catch (error) {
        core.warning(`Failed to load config file: ${error.message}`);
      }
    }

    // Get workflow run details
    const workflowRun = context.payload.workflow_run || {};
    const runId = workflowRun.id || context.runId;
    const runNumber = workflowRun.run_number || context.runNumber;

    // Get job logs to analyze failure
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: runId
    });

    // Find failed job
    const failedJob = jobs.jobs.find(job => job.conclusion === 'failure');
    if (!failedJob && onFailureOnly) {
      core.info('No failed jobs found');
      core.setOutput('bounty_created', 'false');
      return;
    }

    // Extract error information
    let errorSummary = 'Test failure detected';
    let errorDetails = '';

    if (failedJob) {
      errorSummary = `Failed job: ${failedJob.name}`;

      // Get failed steps
      const failedSteps = failedJob.steps.filter(step => step.conclusion === 'failure');
      if (failedSteps.length > 0) {
        errorDetails = failedSteps.map(step =>
          `- Step "${step.name}" failed`
        ).join('\n');
      }
    }

    // Determine bounty amount based on configuration
    let bountyAmount = config.default_amount;

    // Check for severity labels (would be added by maintainers)
    const labels = [];
    if (context.payload.issue?.labels) {
      labels.push(...context.payload.issue.labels.map(l => l.name));
    }

    // Apply severity multipliers
    for (const label of labels) {
      if (label.startsWith('bounty:')) {
        const severity = label.replace('bounty:', '');
        if (config.severity_multipliers[severity]) {
          bountyAmount = Math.floor(config.default_amount * config.severity_multipliers[severity]);
          break;
        }
      }
    }

    // Create issue title and body
    const issueTitle = `🐛 [Bounty ${bountyAmount} MNEE] ${errorSummary}`;
    const issueBody = `## Automated Bounty Created! 🎯

A test failure has been detected and a bounty of **${bountyAmount} MNEE** has been placed on fixing this issue.

### Error Details
\`\`\`
${errorSummary}
${errorDetails}
\`\`\`

### Workflow Information
- **Workflow Run:** [#${runNumber}](${workflowRun.html_url || `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${runId}`})
- **Commit:** ${context.sha.substring(0, 7)}
- **Branch:** ${context.ref.replace('refs/heads/', '')}

### How to Claim This Bounty
1. Fork this repository
2. Create a fix for the failing tests
3. Submit a pull request referencing this issue
4. Once your PR is merged and tests pass, the bounty will be automatically released to you

### Bounty Details
- **Initial Amount:** ${bountyAmount} MNEE
- **Maximum Amount (with escalation):** ${config.max_bounty || bountyAmount * 3} MNEE
- **Escalation Schedule:** +20% after 24h, +50% after 72h, +100% after 1 week

---
*This bounty was automatically created by [FixFlow](https://github.com/tufstraka/fixflow)*
`;

    // Create GitHub issue
    const { data: issue } = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: issueTitle,
      body: issueBody,
      labels: ['bounty', 'bug', 'automated']
    });

    core.info(`Created issue #${issue.number}: ${issue.html_url}`);

    // Call bot API to create bounty (MNEE stablecoin payment system)
    try {
      const response = await fetch(`${botServerUrl}/api/bounties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': botApiKey
        },
        body: JSON.stringify({
          repository: `${context.repo.owner}/${context.repo.repo}`,
          issueId: issue.number,
          issueUrl: issue.html_url,
          amount: bountyAmount,
          maxAmount: config.max_bounty || bountyAmount * 3,
          metadata: {
            workflowRunId: runId,
            commit: context.sha,
            errorSummary
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bot API returned ${response.status}: ${errorText}`);
      }

      const bountyData = await response.json();
      core.info(`Created bounty: ${bountyData.bountyId}`);

      // Set outputs
      core.setOutput('bounty_created', 'true');
      core.setOutput('bounty_id', bountyData.bountyId.toString());
      core.setOutput('issue_number', issue.number.toString());
      core.setOutput('issue_url', issue.html_url);

      // Add comment to issue with bounty details
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.number,
        body: `✅ **Bounty Created!**

**Bounty ID:** \`${bountyData.bountyId}\`
**Amount:** ${bountyAmount} MNEE (USD-pegged stablecoin)
**Maximum (with escalation):** ${config.max_bounty || bountyAmount * 3} MNEE

The bounty is now active and will be paid automatically when a valid fix is merged.

**To claim this bounty:**
1. Fix the failing test
2. Create a PR that references this issue (e.g., "Fixes #${issue.number}")
3. Add your MNEE address to your PR description: \`MNEE: your_address\`

Good luck! 🚀`
      });

    } catch (error) {
      core.error(`Failed to create bounty: ${error.message}`);

      // Update issue to indicate bounty creation failed
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.number,
        body: `⚠️ **Note:** The automated bounty creation failed. This is now a traditional bug report. The FixFlow team has been notified.

Error: \`${error.message}\`

You can still fix this issue, and a bounty may be manually added later.`
      });
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

// Run the action
run();