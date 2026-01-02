import db from '../db.js';

class User {
  constructor(data) {
    this.id = data.id;
    this.githubId = data.githubId;
    this.githubLogin = data.githubLogin;
    this.email = data.email;
    this.name = data.name;
    this.avatarUrl = data.avatarUrl;
    this.role = data.role || 'user';
    this.mneeAddress = data.mneeAddress;
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.tokenExpiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null;
    this.totalEarned = data.totalEarned || 0;
    this.bountiesClaimed = data.bountiesClaimed || 0;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromRow(row) {
    if (!row) return null;
    return new User({
      id: row.id,
      githubId: row.github_id,
      githubLogin: row.github_login,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      role: row.role,
      mneeAddress: row.mnee_address,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
      totalEarned: parseFloat(row.total_earned || 0),
      bountiesClaimed: parseInt(row.bounties_claimed || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  toJSON() {
    return {
      id: this.id,
      githubId: this.githubId,
      githubLogin: this.githubLogin,
      email: this.email,
      name: this.name,
      avatarUrl: this.avatarUrl,
      role: this.role,
      mneeAddress: this.mneeAddress,
      totalEarned: this.totalEarned,
      bountiesClaimed: this.bountiesClaimed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      githubLogin: this.githubLogin,
      name: this.name,
      avatarUrl: this.avatarUrl,
      totalEarned: this.totalEarned,
      bountiesClaimed: this.bountiesClaimed,
      createdAt: this.createdAt
    };
  }

  isAdmin() {
    return this.role === 'admin';
  }

  async save() {
    const now = new Date();
    this.updatedAt = now;

    if (this.id) {
      const text = `
        UPDATE users SET
          github_login = $1,
          email = $2,
          name = $3,
          avatar_url = $4,
          role = $5,
          mnee_address = $6,
          access_token = $7,
          refresh_token = $8,
          token_expires_at = $9,
          total_earned = $10,
          bounties_claimed = $11,
          updated_at = $12
        WHERE id = $13
        RETURNING *
      `;
      const values = [
        this.githubLogin,
        this.email,
        this.name,
        this.avatarUrl,
        this.role,
        this.mneeAddress,
        this.accessToken,
        this.refreshToken,
        this.tokenExpiresAt,
        this.totalEarned,
        this.bountiesClaimed,
        this.updatedAt,
        this.id
      ];
      const { rows } = await db.query(text, values);
      return User.fromRow(rows[0]);
    } else {
      const text = `
        INSERT INTO users (
          github_id, github_login, email, name, avatar_url, role,
          mnee_address, access_token, refresh_token, token_expires_at,
          total_earned, bounties_claimed, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const values = [
        this.githubId,
        this.githubLogin,
        this.email,
        this.name,
        this.avatarUrl,
        this.role,
        this.mneeAddress,
        this.accessToken,
        this.refreshToken,
        this.tokenExpiresAt,
        this.totalEarned,
        this.bountiesClaimed,
        this.createdAt,
        this.updatedAt
      ];
      const { rows } = await db.query(text, values);
      const newUser = User.fromRow(rows[0]);
      Object.assign(this, newUser);
      return this;
    }
  }

  static async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return User.fromRow(rows[0]);
  }

  static async findByGithubId(githubId) {
    const { rows } = await db.query('SELECT * FROM users WHERE github_id = $1', [githubId]);
    return User.fromRow(rows[0]);
  }

  static async findByGithubLogin(githubLogin) {
    const { rows } = await db.query('SELECT * FROM users WHERE github_login = $1', [githubLogin]);
    return User.fromRow(rows[0]);
  }

  static async findBySessionToken(sessionToken) {
    const { rows } = await db.query(`
      SELECT u.* FROM users u
      INNER JOIN user_sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `, [sessionToken]);
    return User.fromRow(rows[0]);
  }

  static async findOrCreateByGithub(profile) {
    let user = await User.findByGithubId(profile.id);
    
    if (user) {
      user.githubLogin = profile.login;
      user.name = profile.name || profile.login;
      user.email = profile.email;
      user.avatarUrl = profile.avatar_url;
      await user.save();
    } else {
      user = new User({
        githubId: profile.id,
        githubLogin: profile.login,
        name: profile.name || profile.login,
        email: profile.email,
        avatarUrl: profile.avatar_url
      });
      await user.save();
    }

    return user;
  }

  async createSession() {
    const crypto = await import('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(`
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES ($1, $2, $3)
    `, [this.id, sessionToken, expiresAt]);

    return { sessionToken, expiresAt };
  }

  static async deleteSession(sessionToken) {
    await db.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
  }

  static async deleteExpiredSessions() {
    await db.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
  }

  static async findAll(options = {}) {
    const { page = 1, limit = 20, role } = options;
    let query = 'SELECT * FROM users';
    const values = [];
    let paramIndex = 1;

    if (role) {
      query += ` WHERE role = $${paramIndex++}`;
      values.push(role);
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, (page - 1) * limit);

    const { rows } = await db.query(query, values);
    return rows.map(User.fromRow);
  }

  static async count(options = {}) {
    const { role } = options;
    let query = 'SELECT COUNT(*) as count FROM users';
    const values = [];

    if (role) {
      query += ' WHERE role = $1';
      values.push(role);
    }

    const { rows } = await db.query(query, values);
    return parseInt(rows[0].count);
  }

  static async getTopContributors(limit = 10) {
    const { rows } = await db.query(`
      SELECT * FROM users
      WHERE bounties_claimed > 0
      ORDER BY total_earned DESC
      LIMIT $1
    `, [limit]);
    return rows.map(User.fromRow);
  }

  async updateStats() {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) as bounties_claimed,
        COALESCE(SUM(claimed_amount), 0) as total_earned
      FROM bounties
      WHERE solver_github_login = $1 AND status = 'claimed'
    `, [this.githubLogin]);

    this.bountiesClaimed = parseInt(rows[0].bounties_claimed);
    this.totalEarned = parseFloat(rows[0].total_earned);
    await this.save();
  }
}

export default User;