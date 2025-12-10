import express from 'express';
import logger from '../utils/logger.js';
import githubAppService from '../services/githubApp.js';

const router = express.Router();

/**
 * GitHub App Installation Setup Callback
 * 
 * This endpoint is called when a user installs the GitHub App.
 * GitHub redirects here after installation with the installation_id.
 * 
 * URL: GET /github/setup
 * Query params: 
 *   - installation_id: The GitHub App installation ID
 *   - setup_action: 'install', 'update', or 'request'
 */
router.get('/setup', async (req, res) => {
  try {
    const { installation_id, setup_action } = req.query;

    if (!installation_id) {
      logger.warn('GitHub setup callback called without installation_id');
      return res.status(400).json({
        error: 'Missing installation_id'
      });
    }

    logger.info(`GitHub App setup callback: action=${setup_action}, installation_id=${installation_id}`);

    // Ensure the GitHub App service is initialized
    if (!githubAppService.initialized) {
      await githubAppService.initialize();
    }

    // Get installation details from GitHub
    const octokit = await githubAppService.getInstallationOctokit(parseInt(installation_id));
    
    // Get the installation details
    const { data: installation } = await octokit.rest.apps.getAuthenticated();
    
    // Get repositories accessible to this installation
    const { data: repoData } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100
    });

    // Store installation info
    const installationInfo = {
      id: parseInt(installation_id),
      account: {
        login: repoData.repositories[0]?.owner?.login || 'unknown',
        type: repoData.repositories[0]?.owner?.type || 'User',
        id: repoData.repositories[0]?.owner?.id || 0
      },
      permissions: installation.permissions || {}
    };

    await githubAppService.saveInstallation(installationInfo);

    // Save repository list
    const repoNames = repoData.repositories.map(r => r.full_name);
    await githubAppService.updateInstallationRepositories(parseInt(installation_id), repoNames);

    logger.info(`Successfully processed GitHub App installation ${installation_id}`);

    // Redirect to success page or return success response
    const redirectUrl = process.env.GITHUB_APP_SETUP_REDIRECT_URL;
    if (redirectUrl) {
      return res.redirect(`${redirectUrl}?success=true&installation_id=${installation_id}`);
    }

    res.json({
      success: true,
      message: 'GitHub App installed successfully',
      installationId: installation_id,
      repositories: repoNames.length,
      setup_action
    });
  } catch (error) {
    logger.error('GitHub setup callback error:', error);

    const redirectUrl = process.env.GITHUB_APP_SETUP_REDIRECT_URL;
    if (redirectUrl) {
      return res.redirect(`${redirectUrl}?success=false&error=${encodeURIComponent(error.message)}`);
    }

    res.status(500).json({
      error: 'Failed to process installation',
      message: error.message
    });
  }
});

/**
 * GitHub App OAuth Callback
 * 
 * This endpoint handles the OAuth callback for user authorization.
 * Used when the app needs user-level permissions in addition to installation.
 * 
 * URL: GET /github/callback
 * Query params:
 *   - code: OAuth authorization code
 *   - state: CSRF protection state
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code'
      });
    }

    logger.info('GitHub OAuth callback received');

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

    // Return success - in a real app, you'd save the user token and create a session
    logger.info('GitHub OAuth successful');

    const redirectUrl = process.env.GITHUB_APP_OAUTH_REDIRECT_URL;
    if (redirectUrl) {
      return res.redirect(`${redirectUrl}?success=true`);
    }

    res.json({
      success: true,
      message: 'GitHub OAuth completed successfully'
    });
  } catch (error) {
    logger.error('GitHub OAuth callback error:', error);
    res.status(500).json({
      error: 'OAuth callback failed',
      message: error.message
    });
  }
});

/**
 * Get list of installations
 * 
 * URL: GET /github/installations
 * Headers: x-api-key or Authorization
 */
router.get('/installations', async (req, res) => {
  try {
    // Simple API key check for admin operations
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const installations = await githubAppService.listInstallations();
    
    res.json({
      success: true,
      installations: installations.map(i => ({
        installationId: i.installation_id,
        account: i.account_login,
        accountType: i.account_type,
        repositories: i.repositories?.length || 0,
        suspended: !!i.suspended_at,
        createdAt: i.created_at
      }))
    });
  } catch (error) {
    logger.error('Failed to list installations:', error);
    res.status(500).json({
      error: 'Failed to list installations',
      message: error.message
    });
  }
});

/**
 * Get installation details
 * 
 * URL: GET /github/installations/:id
 * Headers: x-api-key
 */
router.get('/installations/:id', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const installation = await githubAppService.getInstallation(parseInt(req.params.id));
    
    if (!installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    res.json({
      success: true,
      installation: {
        installationId: installation.installation_id,
        account: installation.account_login,
        accountType: installation.account_type,
        accountId: installation.account_id,
        repositories: installation.repositories,
        permissions: installation.permissions,
        suspended: !!installation.suspended_at,
        suspendedAt: installation.suspended_at,
        createdAt: installation.created_at,
        updatedAt: installation.updated_at
      }
    });
  } catch (error) {
    logger.error(`Failed to get installation ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to get installation',
      message: error.message
    });
  }
});

/**
 * Installation manifest endpoint
 * 
 * Returns the GitHub App installation URL for users to install the app.
 * 
 * URL: GET /github/install
 */
router.get('/install', (req, res) => {
  const appName = process.env.GITHUB_APP_NAME || 'bounty-hunter-bot';
  const installUrl = `https://github.com/apps/${appName}/installations/new`;
  
  res.json({
    success: true,
    installUrl,
    message: 'Visit the install URL to add FixFlow Bot to your repositories'
  });
});

export default router;