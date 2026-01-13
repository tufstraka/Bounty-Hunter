import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import logger from '../utils/logger.js';

/**
 * AI Analysis Service
 * 
 * This service provides AI-powered analysis of test failures using Amazon Bedrock.
 * It analyzes workflow logs, identifies root causes, and suggests fixes.
 */
class AIAnalysisService {
  constructor() {
    this.bedrockClient = null;
    this.modelId = null;
    this.initialized = false;
    this.enabled = false;
  }

  /**
   * Initialize the Bedrock client with AWS credentials
   */
  async initialize() {
    try {
      const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const awsRegion = process.env.AWS_REGION || 'us-east-1';
      this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

      if (!awsAccessKeyId || !awsSecretAccessKey) {
        logger.warn('[AI-SERVICE] AWS credentials not configured - AI analysis will be disabled');
        this.enabled = false;
        this.initialized = true;
        return;
      }

      this.bedrockClient = new BedrockRuntimeClient({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey
        }
      });

      this.enabled = true;
      this.initialized = true;
      
      logger.info('[AI-SERVICE] ✓ AI Analysis service initialized', {
        region: awsRegion,
        modelId: this.modelId
      });
    } catch (error) {
      logger.error('[AI-SERVICE] Failed to initialize AI Analysis service:', error);
      this.enabled = false;
      this.initialized = true;
    }
  }

  /**
   * Check if AI analysis is available
   */
  isEnabled() {
    return this.enabled && this.initialized;
  }

  /**
   * Analyzes test failure using Amazon Bedrock AI model
   * @param {string} logs - Workflow logs to analyze
   * @param {Object} failedJob - Failed job information
   * @param {Array} failedSteps - Failed steps information
   * @param {Object} context - Additional context (repository, commit, etc.)
   * @returns {Object} AI analysis with root cause, explanation, and suggested fixes
   */
  async analyzeFailure(logs, failedJob = {}, failedSteps = [], context = {}) {
    if (!this.isEnabled()) {
      logger.warn('[AI-SERVICE] AI analysis requested but service is not enabled');
      return this.getFallbackAnalysis('AI service not configured');
    }

    logger.info('[AI-SERVICE] Starting failure analysis...', {
      logsLength: logs?.length || 0,
      jobName: failedJob?.name,
      stepsCount: failedSteps?.length || 0
    });

    const prompt = `You are an expert software engineer analyzing a CI/CD test failure. Analyze the following workflow failure and provide specific, actionable insights.

## Failed Job Information
- Job Name: ${failedJob?.name || 'Unknown'}
- Failed Steps: ${failedSteps?.map(s => s.name || s).join(', ') || 'Unknown'}

## Repository Context
- Repository: ${context.repository || 'Unknown'}
- Branch: ${context.branch || 'Unknown'}
- Commit: ${context.commit || 'Unknown'}

## Workflow Logs
\`\`\`
${(logs || 'No logs available').substring(0, 15000)}
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
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });

      logger.debug('[AI-SERVICE] Sending request to Bedrock...');
      const response = await this.bedrockClient.send(command);
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
      
      logger.info('[AI-SERVICE] ✓ Analysis completed successfully', {
        errorType: analysis.errorType,
        complexity: analysis.estimatedComplexity,
        suggestedFixesCount: analysis.suggestedFixes?.length || 0
      });

      return analysis;
    } catch (error) {
      logger.error('[AI-SERVICE] Bedrock analysis failed:', error);
      return this.getFallbackAnalysis(error.message);
    }
  }

  /**
   * Returns a fallback analysis when AI is unavailable
   * @param {string} reason - Reason for fallback
   * @returns {Object} Fallback analysis object
   */
  getFallbackAnalysis(reason = 'Unknown error') {
    return {
      rootCause: 'Unable to determine specific root cause - AI analysis unavailable',
      errorType: 'Unknown',
      affectedFiles: [],
      detailedExplanation: 'The AI-powered analysis could not be completed. Please review the workflow logs manually.',
      suggestedFixes: [],
      relatedDocumentation: [],
      estimatedComplexity: 'unknown',
      additionalContext: `Analysis unavailable: ${reason}`,
      isAIGenerated: false
    };
  }

  /**
   * Formats the AI analysis into a readable markdown section for GitHub issues
   * @param {Object} analysis - AI analysis object
   * @returns {string} Formatted markdown string
   */
  formatAnalysisForIssue(analysis) {
    if (!analysis) {
      return '### 🔍 Analysis\n\nNo analysis available.\n\n';
    }

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
      const complexity = analysis.estimatedComplexity.toLowerCase();
      markdown += `${complexityEmoji[complexity] || '⚪'} ${complexity.charAt(0).toUpperCase() + complexity.slice(1)}\n\n`;
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

  /**
   * Generate a complete issue body with AI analysis
   * @param {Object} analysis - AI analysis object
   * @param {Object} bountyInfo - Bounty amount and max amount
   * @param {Object} workflowInfo - Workflow run details
   * @param {Object} errorInfo - Error summary and failed steps
   * @returns {string} Complete issue body markdown
   */
  generateIssueBody(analysis, bountyInfo, workflowInfo, errorInfo) {
    const analysisMarkdown = this.formatAnalysisForIssue(analysis);

    const failedStepsDetails = errorInfo.failedSteps?.length > 0
      ? errorInfo.failedSteps.map(step => `- Step "${typeof step === 'string' ? step : step.name}" failed`).join('\n')
      : 'No specific step information available';

    const issueBody = `## 🎯 Bounty Created!

A test failure has been detected and a bounty of **${bountyInfo.amount} MNEE** has been placed on fixing this issue.

---

## 🤖 AI-Powered Failure Analysis

${analysisMarkdown}

---

## 📋 Workflow Details

### Error Summary
\`\`\`
${errorInfo.summary || 'Test failure detected'}
${failedStepsDetails}
\`\`\`

### Workflow Information
- **Workflow Run:** ${workflowInfo.url ? `[#${workflowInfo.runNumber || 'N/A'}](${workflowInfo.url})` : `#${workflowInfo.runId || 'N/A'}`}
- **Commit:** ${workflowInfo.commit ? workflowInfo.commit.substring(0, 7) : 'Unknown'}
- **Branch:** ${workflowInfo.branch || 'Unknown'}
- **Job:** ${workflowInfo.jobName || 'Unknown'}

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
| **Initial Amount** | ${bountyInfo.amount} MNEE |
| **Maximum (with escalation)** | ${bountyInfo.maxAmount || bountyInfo.amount * 3} MNEE |
| **Escalation Schedule** | +20% after 24h, +50% after 72h, +100% after 1 week |
| **Estimated Complexity** | ${analysis?.estimatedComplexity || 'Unknown'} |

---

*This bounty was automatically created and analyzed by [FixFlow](https://github.com/tufstraka/fixflow)*
`;

    return issueBody;
  }

  /**
   * Generate the issue title with AI-derived error type
   * @param {Object} analysis - AI analysis object
   * @param {string} errorSummary - Basic error summary
   * @param {number} bountyAmount - Bounty amount
   * @returns {string} Issue title
   */
  generateIssueTitle(analysis, errorSummary, bountyAmount) {
    const errorType = analysis?.errorType !== 'Unknown' ? `${analysis.errorType}: ` : '';
    return `🐛 [Bounty ${bountyAmount} MNEE] ${errorType}${errorSummary}`;
  }

  /**
   * Generate the success comment for a created bounty
   * @param {string} bountyId - Bounty ID
   * @param {number} bountyAmount - Bounty amount
   * @param {number} maxAmount - Maximum bounty amount
   * @param {Object} analysis - AI analysis object
   * @param {number} issueNumber - Issue number
   * @returns {string} Comment markdown
   */
  generateBountyCreatedComment(bountyId, bountyAmount, maxAmount, analysis, issueNumber) {
    const topFix = analysis?.suggestedFixes?.[0];
    
    return `## ✅ Bounty Created Successfully!

| Detail | Value |
|--------|-------|
| **Bounty ID** | \`${bountyId}\` |
| **Amount** | ${bountyAmount} MNEE (USD-pegged stablecoin) |
| **Maximum** | ${maxAmount} MNEE |
| **Root Cause** | ${analysis?.rootCause || 'See analysis above'} |
| **Complexity** | ${analysis?.estimatedComplexity || 'Unknown'} |

### 🚀 Quick Start Guide

1. **Understand the issue:** Review the AI analysis in the issue description above
2. **Fix the code:** Focus on the identified root cause${analysis?.affectedFiles?.length > 0 ? ` in \`${analysis.affectedFiles[0]}\`` : ''}
3. **Create a PR:** Reference this issue (e.g., "Fixes #${issueNumber}")
4. **Add payment address:** Include \`MNEE: your_address\` in your PR description

${topFix ? `### 💡 Top Suggested Fix\n${topFix.description}` : ''}

Good luck! 🍀`;
  }
}

// Export singleton instance
const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService;