const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * Analyzes test failure using Amazon Bedrock AI model
 * @param {Object} bedrockClient - AWS Bedrock client
 * @param {string} modelId - Bedrock model ID
 * @param {string} logs - Workflow logs to analyze
 * @param {Object} failedJob - Failed job information
 * @param {Array} failedSteps - Failed steps information
 * @returns {Object} AI analysis with root cause, explanation, and suggested fixes
 */
async function analyzeFailureWithBedrock(bedrockClient, modelId, logs, failedJob, failedSteps) {
  const prompt = `You are an expert software engineer analyzing a CI/CD test failure. Analyze the following workflow failure and provide specific, actionable insights.

## Failed Job Information
- Job Name: ${failedJob?.name || 'Unknown'}
- Failed Steps: ${failedSteps?.map(s => s.name).join(', ') || 'Unknown'}

## Workflow Logs
\`\`\`
${logs.substring(0, 15000)}
\`\`\`

Based on this information, provide a detailed analysis in the following JSON format:
{
  "rootCause": "A clear, specific description of what caused the failure (not generic)",
  "errorType": "The type of error (e.g., 'Assertion Error', 'Syntax Error', 'Dependency Issue', 'Timeout', 'Network Error', etc.)",
  "affectedFiles": ["List of files that likely need to be modified to fix this issue"],
  "detailedExplanation": "A thorough explanation of why this failure occurred, including the chain of events that led to it",
  "suggestedFixes": [
    {
      "description": "Specific fix description",
      "codeExample": "Example code snippet if applicable",
      "confidence": "high/medium/low"
    }
  ],
  "relatedDocumentation": ["Links or references to relevant documentation that might help"],
  "estimatedComplexity": "easy/medium/hard",
  "additionalContext": "Any other relevant observations about the failure"
}

Respond ONLY with the JSON object, no additional text.`;

  try {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract the content from Claude's response
    let analysisText = responseBody.content[0].text;
    
    // Sanitize the response - remove control characters that break JSON parsing
    // Remove characters 0x00-0x1F except tab (0x09), newline (0x0A), carriage return (0x0D)
    analysisText = analysisText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisText = jsonMatch[0];
    }
    
    // Parse the JSON response
    const analysis = JSON.parse(analysisText);
    return analysis;
  } catch (error) {
    core.warning(`Bedrock analysis failed: ${error.message}`);
    // Return a fallback analysis if Bedrock fails
    return {
      rootCause: 'Unable to determine specific root cause - AI analysis unavailable',
      errorType: 'Unknown',
      affectedFiles: [],
      detailedExplanation: 'The AI-powered analysis could not be completed. Please review the workflow logs manually.',
      suggestedFixes: [],
      relatedDocumentation: [],
      estimatedComplexity: 'unknown',
      additionalContext: `Analysis error: ${error.message}`
    };
  }
}

/**
 * Fetches workflow logs for analysis
 * @param {Object} octokit - GitHub API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} runId - Workflow run ID
 * @param {number} jobId - Job ID
 * @returns {string} Combined logs from the workflow
 */
async function fetchWorkflowLogs(octokit, owner, repo, runId, jobId) {
  try {
    // Try to get job-specific logs first
    if (jobId) {
      try {
        const { data: logData } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
          owner,
          repo,
          job_id: jobId
        });
        return logData;
      } catch (jobLogError) {
        core.warning(`Could not fetch job-specific logs: ${jobLogError.message}`);
      }
    }

    // Fallback to workflow run logs
    const { data: logsData } = await octokit.rest.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId
    });
    
    return logsData;
  } catch (error) {
    core.warning(`Could not fetch workflow logs: ${error.message}`);
    return 'Logs unavailable';
  }
}

/**
 * Formats the AI analysis into a readable markdown section
 * @param {Object} analysis - AI analysis object
 * @returns {string} Formatted markdown string
 */
function formatAnalysisForIssue(analysis) {
  let markdown = '';

  // Root Cause Section
  markdown += `### 🔍 Root Cause Analysis\n`;
  markdown += `**Error Type:** ${analysis.errorType || 'Unknown'}\n\n`;
  markdown += `**Root Cause:** ${analysis.rootCause}\n\n`;

  // Detailed Explanation
  if (analysis.detailedExplanation) {
    markdown += `### 📝 Detailed Explanation\n`;
    markdown += `${analysis.detailedExplanation}\n\n`;
  }

  // Affected Files
  if (analysis.affectedFiles && analysis.affectedFiles.length > 0) {
    markdown += `### 📁 Affected Files\n`;
    analysis.affectedFiles.forEach(file => {
      markdown += `- \`${file}\`\n`;
    });
    markdown += '\n';
  }

  // Suggested Fixes
  if (analysis.suggestedFixes && analysis.suggestedFixes.length > 0) {
    markdown += `### 💡 Suggested Fixes\n`;
    analysis.suggestedFixes.forEach((fix, index) => {
      markdown += `\n**${index + 1}. ${fix.description}** `;
      markdown += `(Confidence: ${fix.confidence || 'medium'})\n`;
      if (fix.codeExample) {
        markdown += `\`\`\`\n${fix.codeExample}\n\`\`\`\n`;
      }
    });
    markdown += '\n';
  }

  // Complexity Estimate
  if (analysis.estimatedComplexity) {
    const complexityEmoji = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
      unknown: '⚪'
    };
    markdown += `### ⏱️ Estimated Complexity\n`;
    markdown += `${complexityEmoji[analysis.estimatedComplexity] || '⚪'} ${analysis.estimatedComplexity.charAt(0).toUpperCase() + analysis.estimatedComplexity.slice(1)}\n\n`;
  }

  // Related Documentation
  if (analysis.relatedDocumentation && analysis.relatedDocumentation.length > 0) {
    markdown += `### 📚 Related Documentation\n`;
    analysis.relatedDocumentation.forEach(doc => {
      markdown += `- ${doc}\n`;
    });
    markdown += '\n';
  }

  // Additional Context
  if (analysis.additionalContext) {
    markdown += `### ℹ️ Additional Context\n`;
    markdown += `${analysis.additionalContext}\n\n`;
  }

  return markdown;
}

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
    
    // AWS Bedrock configuration
    const awsAccessKeyId = core.getInput('aws_access_key_id', { required: true });
    const awsSecretAccessKey = core.getInput('aws_secret_access_key', { required: true });
    const awsRegion = core.getInput('aws_region') || 'us-east-1';
    const bedrockModelId = core.getInput('bedrock_model_id') || 'anthropic.claude-3-sonnet-20240229-v1:0';

    // Initialize Bedrock client
    const bedrockClient = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });

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
    let failedSteps = [];

    if (failedJob) {
      errorSummary = `Failed job: ${failedJob.name}`;

      // Get failed steps
      failedSteps = failedJob.steps.filter(step => step.conclusion === 'failure');
    }

    // Fetch workflow logs for AI analysis
    core.info('Fetching workflow logs for AI analysis...');
    const logs = await fetchWorkflowLogs(
      octokit,
      context.repo.owner,
      context.repo.repo,
      runId,
      failedJob?.id
    );

    // Analyze failure with Amazon Bedrock
    core.info('Analyzing failure with Amazon Bedrock...');
    const aiAnalysis = await analyzeFailureWithBedrock(
      bedrockClient,
      bedrockModelId,
      typeof logs === 'string' ? logs : 'Logs in binary format - unable to extract text',
      failedJob,
      failedSteps
    );
    core.info('AI analysis complete');

    // Format the AI analysis for the issue
    const analysisMarkdown = formatAnalysisForIssue(aiAnalysis);

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

    // Create issue title with specific error type
    const issueTitle = `🐛 [Bounty ${bountyAmount} MNEE] ${aiAnalysis.errorType !== 'Unknown' ? `${aiAnalysis.errorType}: ` : ''}${errorSummary}`;
    
    // Build failed steps details
    const failedStepsDetails = failedSteps.length > 0
      ? failedSteps.map(step => `- Step "${step.name}" failed`).join('\n')
      : 'No specific step information available';

    const issueBody = `## 🎯 Bounty Created!

A test failure has been detected and a bounty of **${bountyAmount} MNEE** has been placed on fixing this issue.

---

## 🤖 AI-Powered Failure Analysis

${analysisMarkdown}

---

## 📋 Workflow Details

### Error Summary
\`\`\`
${errorSummary}
${failedStepsDetails}
\`\`\`

### Workflow Information
- **Workflow Run:** [#${runNumber}](${workflowRun.html_url || `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${runId}`})
- **Commit:** ${context.sha.substring(0, 7)}
- **Branch:** ${context.ref.replace('refs/heads/', '')}
- **Job:** ${failedJob?.name || 'Unknown'}

---

## 💰 How to Claim This Bounty

1. **Fork** this repository
2. **Analyze** the AI insights above for guidance on the fix
3. **Create** a fix addressing the root cause identified
4. **Test** your fix locally to ensure tests pass
5. **Submit** a pull request referencing this issue (e.g., "Fixes #[issue_number]")
6. Once your PR is merged and tests pass, the bounty will be **automatically released** to you

### Bounty Details
| Property | Value |
|----------|-------|
| **Initial Amount** | ${bountyAmount} MNEE |
| **Maximum (with escalation)** | ${config.max_bounty || bountyAmount * 3} MNEE |
| **Escalation Schedule** | +20% after 24h, +50% after 72h, +100% after 1 week |
| **Estimated Complexity** | ${aiAnalysis.estimatedComplexity || 'Unknown'} |

---

*This bounty was automatically created and analyzed by [FixFlow](https://github.com/tufstraka/fixflow) using Amazon Bedrock AI*
`;

    // Create GitHub issue
    const { data: issue } = await octokit.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: issueTitle,
      body: issueBody,
      labels: ['bounty', 'bug']
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
            errorSummary,
            aiAnalysis: {
              rootCause: aiAnalysis.rootCause,
              errorType: aiAnalysis.errorType,
              estimatedComplexity: aiAnalysis.estimatedComplexity,
              affectedFiles: aiAnalysis.affectedFiles
            }
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

      // Add comment to issue with bounty details and quick summary
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.number,
        body: `## ✅ Bounty Created Successfully!

| Detail | Value |
|--------|-------|
| **Bounty ID** | \`${bountyData.bountyId}\` |
| **Amount** | ${bountyAmount} MNEE (USD-pegged stablecoin) |
| **Maximum** | ${config.max_bounty || bountyAmount * 3} MNEE |
| **Root Cause** | ${aiAnalysis.rootCause || 'See analysis above'} |
| **Complexity** | ${aiAnalysis.estimatedComplexity || 'Unknown'} |

### 🚀 Quick Start Guide

1. **Understand the issue:** Review the AI analysis in the issue description above
2. **Fix the code:** Focus on the identified root cause${aiAnalysis.affectedFiles?.length > 0 ? ` in \`${aiAnalysis.affectedFiles[0]}\`` : ''}
3. **Create a PR:** Reference this issue (e.g., "Fixes #${issue.number}")
4. **Add payment address:** Include \`MNEE: your_address\` in your PR description

${aiAnalysis.suggestedFixes?.length > 0 ? `### 💡 Top Suggested Fix\n${aiAnalysis.suggestedFixes[0].description}` : ''}

Good luck! 🍀`
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