import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import logger from '../utils/logger.js';
import db from '../db.js';

class GitHubAppService {
  constructor() {
    this.app = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const appId = process.env.GITHUB_APP_ID;
      const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!appId || !privateKeyPath) {
        throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_PATH');
      }

      // Read private key from file
      let privateKey;
      if (fs.existsSync(privateKeyPath)) {
        privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
      } else if (process.env.GITHUB_APP_PRIVATE_KEY) {
        // Alternatively, allow inline private key via env var
        privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
      } else {
        throw new Error(`Private key file not found: ${privateKeyPath}`);
      }

      this.app = new App({
        appId,
        privateKey,
        webhooks: {
          secret: webhookSecret || 'development-secret'
        }
      });

      this.initialized = true;
      logger.info('GitHub App service initialized');
    } catch (error) {
      logger.error('Failed to initialize GitHub App service:', error);
      throw error;
    }
  }

  /**
   * Get an Octokit instance authenticated as the GitHub App installation
   * @param {number} installationId - The GitHub App installation ID
   * @returns {Promise<Octokit>} Authenticated Octokit instance
   */
  async getInstallationOctokit(installationId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const octokit = await this.app.getInstallationOctokit(installationId);
      return octokit;
    } catch (error) {
      logger.error(`Failed to get Octokit for installation ${installationId}:`, error);
      throw error;
    }
  }

  /**
   * Get Octokit for a repository by looking up its installation
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Octokit>} Authenticated Octokit instance
   */
  async getOctokitForRepo(owner, repo) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // First, try to find the installation in our database
      const { rows } = await db.query(
        'SELECT installation_id FROM github_installations WHERE account_login = $1',
        [owner]
      );

      if (rows.length > 0) {
        return await this.getInstallationOctokit(rows[0].installation_id);
      }

      // If not in database, try to get it from GitHub API
      // This requires app-level authentication
      const appOctokit = new Octokit({
        auth: this.app.getSignedJsonWebToken()
      });

      // Get installation for the repository
      const { data: installation } = await appOctokit.apps.getRepoInstallation({
        owner,
        repo
      });

      // Store installation in database
      await this.saveInstallation(installation);

      return await this.getInstallationOctokit(installation.id);
    } catch (error) {
      logger.error(`Failed to get Octokit for repo ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Get Octokit by repository full name (owner/repo format)
   * @param {string} fullName - Repository full name (e.g., "owner/repo")
   * @returns {Promise<Octokit>} Authenticated Octokit instance
   */
  async getOctokitForRepoFullName(fullName) {
    const [owner, repo] = fullName.split('/');
    return this.getOctokitForRepo(owner, repo);
  }

  /**
   * Save or update an installation in the database
   * @param {object} installation - GitHub installation object
   */
  async saveInstallation(installation) {
    try {
      const now = new Date();
      const { rows: existing } = await db.query(
        'SELECT id FROM github_installations WHERE installation_id = $1',
        [installation.id]
      );

      if (existing.length > 0) {
        // Update existing
        await db.query(`
          UPDATE github_installations SET
            account_login = $1,
            account_type = $2,
            account_id = $3,
            permissions = $4,
            suspended_at = $5,
            suspended_by = $6,
            updated_at = $7
          WHERE installation_id = $8
        `, [
          installation.account.login,
          installation.account.type,
          installation.account.id,
          JSON.stringify(installation.permissions || {}),
          installation.suspended_at,
          installation.suspended_by?.login,
          now,
          installation.id
        ]);
        logger.info(`Updated installation for ${installation.account.login}`);
      } else {
        // Insert new
        await db.query(`
          INSERT INTO github_installations (
            installation_id, account_login, account_type, account_id,
            permissions, suspended_at, suspended_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          installation.id,
          installation.account.login,
          installation.account.type,
          installation.account.id,
          JSON.stringify(installation.permissions || {}),
          installation.suspended_at,
          installation.suspended_by?.login,
          now,
          now
        ]);
        logger.info(`Saved new installation for ${installation.account.login}`);
      }
    } catch (error) {
      logger.error('Failed to save installation:', error);
      throw error;
    }
  }

  /**
   * Update the repositories list for an installation
   * @param {number} installationId - Installation ID
   * @param {string[]} repositories - List of repository full names
   */
  async updateInstallationRepositories(installationId, repositories) {
    try {
      await db.query(`
        UPDATE github_installations
        SET repositories = $1, updated_at = $2
        WHERE installation_id = $3
      `, [JSON.stringify(repositories), new Date(), installationId]);
      
      logger.info(`Updated repositories for installation ${installationId}`);
    } catch (error) {
      logger.error(`Failed to update repos for installation ${installationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an installation from the database
   * @param {number} installationId - Installation ID to delete
   */
  async deleteInstallation(installationId) {
    try {
      await db.query(
        'DELETE FROM github_installations WHERE installation_id = $1',
        [installationId]
      );
      logger.info(`Deleted installation ${installationId}`);
    } catch (error) {
      logger.error(`Failed to delete installation ${installationId}:`, error);
      throw error;
    }
  }

  /**
   * Get installation by ID
   * @param {number} installationId - Installation ID
   * @returns {Promise<object|null>} Installation data or null
   */
  async getInstallation(installationId) {
    try {
      const { rows } = await db.query(
        'SELECT * FROM github_installations WHERE installation_id = $1',
        [installationId]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error(`Failed to get installation ${installationId}:`, error);
      throw error;
    }
  }

  /**
   * Get installation by account login
   * @param {string} login - GitHub account login
   * @returns {Promise<object|null>} Installation data or null
   */
  async getInstallationByLogin(login) {
    try {
      const { rows } = await db.query(
        'SELECT * FROM github_installations WHERE account_login = $1',
        [login]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error(`Failed to get installation for ${login}:`, error);
      throw error;
    }
  }

  /**
   * List all installations
   * @returns {Promise<object[]>} List of installations
   */
  async listInstallations() {
    try {
      const { rows } = await db.query(
        'SELECT * FROM github_installations ORDER BY created_at DESC'
      );
      return rows;
    } catch (error) {
      logger.error('Failed to list installations:', error);
      throw error;
    }
  }

  /**
   * Handle installation webhook events
   * @param {string} action - Webhook action
   * @param {object} installation - Installation data from webhook
   * @param {object} repositories - Repositories data from webhook (optional)
   */
  async handleInstallationWebhook(action, installation, repositories = null) {
    try {
      switch (action) {
        case 'created':
          await this.saveInstallation(installation);
          if (repositories) {
            const repoNames = repositories.map(r => r.full_name);
            await this.updateInstallationRepositories(installation.id, repoNames);
          }
          break;

        case 'deleted':
          await this.deleteInstallation(installation.id);
          break;

        case 'suspend':
          await db.query(`
            UPDATE github_installations
            SET suspended_at = $1, updated_at = $2
            WHERE installation_id = $3
          `, [new Date(), new Date(), installation.id]);
          break;

        case 'unsuspend':
          await db.query(`
            UPDATE github_installations
            SET suspended_at = NULL, updated_at = $1
            WHERE installation_id = $2
          `, [new Date(), installation.id]);
          break;

        default:
          logger.info(`Unhandled installation action: ${action}`);
      }
    } catch (error) {
      logger.error(`Failed to handle installation webhook (${action}):`, error);
      throw error;
    }
  }

  /**
   * Handle installation_repositories webhook events
   * @param {string} action - Webhook action (added/removed)
   * @param {object} installation - Installation data
   * @param {object[]} repositoriesAdded - Repositories added
   * @param {object[]} repositoriesRemoved - Repositories removed
   */
  async handleInstallationRepositoriesWebhook(action, installation, repositoriesAdded = [], repositoriesRemoved = []) {
    try {
      const existing = await this.getInstallation(installation.id);
      if (!existing) {
        // Installation doesn't exist, save it first
        await this.saveInstallation(installation);
        const repoNames = repositoriesAdded.map(r => r.full_name);
        await this.updateInstallationRepositories(installation.id, repoNames);
        return;
      }

      let repos = existing.repositories || [];
      
      // Add new repositories
      for (const repo of repositoriesAdded) {
        if (!repos.includes(repo.full_name)) {
          repos.push(repo.full_name);
        }
      }

      // Remove old repositories
      for (const repo of repositoriesRemoved) {
        repos = repos.filter(r => r !== repo.full_name);
      }

      await this.updateInstallationRepositories(installation.id, repos);
    } catch (error) {
      logger.error('Failed to handle installation_repositories webhook:', error);
      throw error;
    }
  }
}

export default new GitHubAppService();