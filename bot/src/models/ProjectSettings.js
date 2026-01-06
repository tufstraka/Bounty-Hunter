import db from '../db.js';

class ProjectSettings {
  constructor(data) {
    this.id = data.id;
    this.repository = data.repository;
    this.ownerGithubLogin = data.ownerGithubLogin;
    this.fundingMode = data.fundingMode || 'owner'; // 'owner', 'platform', 'disabled'
    this.defaultBountyAmount = data.defaultBountyAmount || 50;
    this.maxBountyAmount = data.maxBountyAmount || 500;
    this.autoCreateBounties = data.autoCreateBounties !== false;
    this.escalationEnabled = data.escalationEnabled !== false;
    this.escalationSchedule = data.escalationSchedule || [24, 72, 168];
    this.escalationMultipliers = data.escalationMultipliers || [1.2, 1.5, 2.0];
    this.fundingWalletAddress = data.fundingWalletAddress;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromRow(row) {
    if (!row) return null;
    return new ProjectSettings({
      id: row.id,
      repository: row.repository,
      ownerGithubLogin: row.owner_github_login,
      fundingMode: row.funding_mode,
      defaultBountyAmount: parseFloat(row.default_bounty_amount),
      maxBountyAmount: parseFloat(row.max_bounty_amount),
      autoCreateBounties: row.auto_create_bounties,
      escalationEnabled: row.escalation_enabled,
      escalationSchedule: row.escalation_schedule,
      escalationMultipliers: row.escalation_multipliers,
      fundingWalletAddress: row.funding_wallet_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  toJSON() {
    return {
      id: this.id,
      repository: this.repository,
      ownerGithubLogin: this.ownerGithubLogin,
      fundingMode: this.fundingMode,
      defaultBountyAmount: this.defaultBountyAmount,
      maxBountyAmount: this.maxBountyAmount,
      autoCreateBounties: this.autoCreateBounties,
      escalationEnabled: this.escalationEnabled,
      escalationSchedule: this.escalationSchedule,
      escalationMultipliers: this.escalationMultipliers,
      fundingWalletAddress: this.fundingWalletAddress,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    this.updatedAt = new Date();

    if (this.id) {
      const text = `
        UPDATE project_settings SET
          owner_github_login = $1,
          funding_mode = $2,
          default_bounty_amount = $3,
          max_bounty_amount = $4,
          auto_create_bounties = $5,
          escalation_enabled = $6,
          escalation_schedule = $7,
          escalation_multipliers = $8,
          funding_wallet_address = $9,
          updated_at = $10
        WHERE id = $11
        RETURNING *
      `;
      const values = [
        this.ownerGithubLogin,
        this.fundingMode,
        this.defaultBountyAmount,
        this.maxBountyAmount,
        this.autoCreateBounties,
        this.escalationEnabled,
        JSON.stringify(this.escalationSchedule),
        JSON.stringify(this.escalationMultipliers),
        this.fundingWalletAddress,
        this.updatedAt,
        this.id
      ];
      const { rows } = await db.query(text, values);
      return ProjectSettings.fromRow(rows[0]);
    } else {
      const text = `
        INSERT INTO project_settings (
          repository, owner_github_login, funding_mode, default_bounty_amount,
          max_bounty_amount, auto_create_bounties, escalation_enabled,
          escalation_schedule, escalation_multipliers, funding_wallet_address,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (repository) DO UPDATE SET
          owner_github_login = EXCLUDED.owner_github_login,
          funding_mode = EXCLUDED.funding_mode,
          default_bounty_amount = EXCLUDED.default_bounty_amount,
          max_bounty_amount = EXCLUDED.max_bounty_amount,
          auto_create_bounties = EXCLUDED.auto_create_bounties,
          escalation_enabled = EXCLUDED.escalation_enabled,
          escalation_schedule = EXCLUDED.escalation_schedule,
          escalation_multipliers = EXCLUDED.escalation_multipliers,
          funding_wallet_address = EXCLUDED.funding_wallet_address,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      const values = [
        this.repository,
        this.ownerGithubLogin,
        this.fundingMode,
        this.defaultBountyAmount,
        this.maxBountyAmount,
        this.autoCreateBounties,
        this.escalationEnabled,
        JSON.stringify(this.escalationSchedule),
        JSON.stringify(this.escalationMultipliers),
        this.fundingWalletAddress,
        this.createdAt,
        this.updatedAt
      ];
      const { rows } = await db.query(text, values);
      const saved = ProjectSettings.fromRow(rows[0]);
      Object.assign(this, saved);
      return this;
    }
  }

  static async findByRepository(repository) {
    const { rows } = await db.query(
      'SELECT * FROM project_settings WHERE repository = $1',
      [repository]
    );
    return ProjectSettings.fromRow(rows[0]);
  }

  static async findByOwner(ownerGithubLogin) {
    const { rows } = await db.query(
      'SELECT * FROM project_settings WHERE owner_github_login = $1 ORDER BY repository',
      [ownerGithubLogin]
    );
    return rows.map(ProjectSettings.fromRow);
  }

  static async getOrCreateForRepository(repository, ownerGithubLogin) {
    let settings = await ProjectSettings.findByRepository(repository);
    if (!settings) {
      settings = new ProjectSettings({
        repository,
        ownerGithubLogin
      });
      await settings.save();
    }
    return settings;
  }

  /**
   * Check if this project uses owner funding
   */
  isOwnerFunded() {
    return this.fundingMode === 'owner' && this.fundingWalletAddress;
  }

  /**
   * Check if this project uses platform funding
   */
  isPlatformFunded() {
    return this.fundingMode === 'platform';
  }

  /**
   * Check if bounty creation is disabled
   */
  isDisabled() {
    return this.fundingMode === 'disabled' || !this.autoCreateBounties;
  }
}

export default ProjectSettings;