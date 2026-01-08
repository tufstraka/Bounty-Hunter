import db from '../db.js';

class Bounty {
  constructor(data) {
    this.bountyId = data.bountyId;
    this.repository = data.repository;
    this.issueId = data.issueId;
    this.issueUrl = data.issueUrl;
    this.initialAmount = data.initialAmount;
    this.currentAmount = data.currentAmount;
    this.maxAmount = data.maxAmount;
    this.status = data.status || 'active';
    this.solver = data.solver || null; // MNEE/Ethereum wallet address
    this.solverGithubLogin = data.solverGithubLogin || null; // GitHub username
    this.claimedAmount = data.claimedAmount || null;
    this.transactionHash = data.transactionHash;
    this.claimTransactionHash = data.claimTransactionHash || null;
    this.blockNumber = data.blockNumber;
    this.pullRequestUrl = data.pullRequestUrl || null;
    this.escalationCount = data.escalationCount || 0;
    this.lastEscalation = data.lastEscalation ? new Date(data.lastEscalation) : null;
    this.metadata = data.metadata || {};
    this.claimedAt = data.claimedAt ? new Date(data.claimedAt) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

    // Owner-funded bounty fields
    this.creatorWalletAddress = data.creatorWalletAddress || null; // Who funded the bounty
    this.fundingSource = data.fundingSource || 'platform'; // 'platform', 'owner', 'sponsor'
    this.onChainBountyId = data.onChainBountyId || null; // ID from smart contract

    // Internal ID for DB updates
    this.id = data.id;
  }

  get hoursElapsed() {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
  }

  isEligibleForEscalation() {
    if (this.status !== 'active') return false;
    if (this.currentAmount >= this.maxAmount) return false;

    const hoursElapsed = this.hoursElapsed;
    const lastEscalationHours = this.lastEscalation
      ? Math.floor((Date.now() - this.lastEscalation.getTime()) / (1000 * 60 * 60))
      : hoursElapsed;

    // Default escalation schedule
    const escalationSchedule = [24, 72, 168]; // 1 day, 3 days, 1 week

    // Check if we've passed any threshold since last escalation
    for (const threshold of escalationSchedule) {
      if (hoursElapsed >= threshold && lastEscalationHours >= 24) {
        return true;
      }
    }

    return false;
  }

  toJSON() {
    const obj = { ...this };
    delete obj.id; // Hide internal DB ID
    obj.hoursElapsed = this.hoursElapsed;
    obj.isEligibleForEscalation = this.isEligibleForEscalation();
    return obj;
  }

  toObject() {
    const obj = { ...this };
    delete obj.id;
    return obj;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Bounty({
      id: row.id,
      bountyId: row.bounty_id,
      repository: row.repository,
      issueId: row.issue_id,
      issueUrl: row.issue_url,
      initialAmount: parseFloat(row.initial_amount),
      currentAmount: parseFloat(row.current_amount),
      maxAmount: parseFloat(row.max_amount),
      status: row.status,
      solver: row.solver,
      solverGithubLogin: row.solver_github_login,
      claimedAmount: row.claimed_amount ? parseFloat(row.claimed_amount) : null,
      transactionHash: row.transaction_hash,
      claimTransactionHash: row.claim_transaction_hash,
      blockNumber: row.block_number,
      pullRequestUrl: row.pull_request_url,
      escalationCount: row.escalation_count,
      lastEscalation: row.last_escalation,
      metadata: row.metadata,
      claimedAt: row.claimed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Owner-funded bounty fields
      creatorWalletAddress: row.creator_wallet_address,
      fundingSource: row.funding_source,
      onChainBountyId: row.on_chain_bounty_id
    });
  }

  async save() {
    const now = new Date();
    this.updatedAt = now;

    if (this.id) {
      // Update
      const text = `
        UPDATE bounties SET
          initial_amount = $1,
          current_amount = $2,
          max_amount = $3,
          status = $4,
          solver = $5,
          solver_github_login = $6,
          claimed_amount = $7,
          transaction_hash = $8,
          claim_transaction_hash = $9,
          pull_request_url = $10,
          escalation_count = $11,
          last_escalation = $12,
          metadata = $13,
          claimed_at = $14,
          updated_at = $15,
          creator_wallet_address = $16,
          funding_source = $17,
          on_chain_bounty_id = $18
        WHERE id = $19
        RETURNING *
      `;
      const values = [
        this.initialAmount,
        this.currentAmount,
        this.maxAmount,
        this.status,
        this.solver,
        this.solverGithubLogin,
        this.claimedAmount,
        this.transactionHash,
        this.claimTransactionHash,
        this.pullRequestUrl,
        this.escalationCount,
        this.lastEscalation,
        this.metadata,
        this.claimedAt,
        this.updatedAt,
        this.creatorWalletAddress,
        this.fundingSource,
        this.onChainBountyId,
        this.id
      ];
      const { rows } = await db.query(text, values);
      return Bounty.fromRow(rows[0]);
    } else {
      // Insert
      const text = `
        INSERT INTO bounties (
          bounty_id, repository, issue_id, issue_url, initial_amount,
          current_amount, max_amount, status, solver, solver_github_login, claimed_amount,
          transaction_hash, claim_transaction_hash, block_number,
          pull_request_url, escalation_count, last_escalation, metadata,
          claimed_at, created_at, updated_at,
          creator_wallet_address, funding_source, on_chain_bounty_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) RETURNING *
      `;
      const values = [
        this.bountyId,
        this.repository,
        this.issueId,
        this.issueUrl,
        this.initialAmount,
        this.currentAmount,
        this.maxAmount,
        this.status,
        this.solver,
        this.solverGithubLogin,
        this.claimedAmount,
        this.transactionHash,
        this.claimTransactionHash,
        this.blockNumber,
        this.pullRequestUrl,
        this.escalationCount,
        this.lastEscalation,
        this.metadata,
        this.claimedAt,
        this.createdAt,
        this.updatedAt,
        this.creatorWalletAddress,
        this.fundingSource,
        this.onChainBountyId
      ];

      const { rows } = await db.query(text, values);
      const newBounty = Bounty.fromRow(rows[0]);
      Object.assign(this, newBounty);
      return this;
    }
  }

  static async findOne(query) {
    const { text, values } = Bounty.buildQuery(query, 1);
    const { rows } = await db.query(text, values);
    return Bounty.fromRow(rows[0]);
  }

  static find(query = {}) {
    // Returns a chainable QueryBuilder that can be awaited
    // Supports: .sort(), .limit(), .skip(), .where()
    return new QueryBuilder(query);
  }

  static async countDocuments(query = {}) {
    const { text, values } = Bounty.buildQuery(query, null, true);
    const { rows } = await db.query(text, values);
    return parseInt(rows[0].count);
  }

  static buildQuery(query, limit = null, isCount = false) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (query.bountyId) {
      conditions.push(`bounty_id = $${paramIndex++}`);
      values.push(query.bountyId);
    }
    if (query.repository) {
      conditions.push(`repository = $${paramIndex++}`);
      values.push(query.repository);
    }
    if (query.issueId) {
      conditions.push(`issue_id = $${paramIndex++}`);
      values.push(query.issueId);
    }
    if (query.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(query.status);
    }

    // Support basic mongoose operators if simple
    // .where('currentAmount').lt('maxAmount') is used in escalation.js
    // We'll handle that in the QueryBuilder or simple custom logic there.
    // For now, simple equality checks are handled here.

    let text = isCount ? 'SELECT COUNT(*) as count FROM bounties' : 'SELECT * FROM bounties';

    if (conditions.length > 0) {
      text += ' WHERE ' + conditions.join(' AND ');
    }

    if (!isCount && limit) {
      text += ` LIMIT ${limit}`;
    }

    return { text, values, paramIndex }; // Return paramIndex to continue
  }
}

class QueryBuilder {
  constructor(query) {
    this.queryObj = query;
    this.sortObj = {};
    this.limitVal = null;
    this.skipVal = 0;
    this.customWhere = []; // For .where()
    this.customValues = [];
  }

  sort(sortObj) {
    this.sortObj = sortObj;
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  skip(val) {
    this.skipVal = val;
    return this;
  }

  where(field) {
    const self = this;
    return {
      lt: (val) => {
        // simplistic mapping: field is typically camelCase, map to snake_case
        const dbField = field === 'currentAmount' ? 'current_amount' : field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        // If field is maxAmount, same logic
        const dbValField = val === 'maxAmount' ? 'max_amount' : null;

        if (dbValField) {
          self.customWhere.push(`${dbField} < ${dbValField}`);
        } else {
          self.customWhere.push(`${dbField} < ${val}`);
        }
        return self;
      }
    }
  }

  async then(resolve, reject) {
    // Execute query
    try {
      const { text, values } = this.buildSql();
      const { rows } = await db.query(text, values);
      const results = rows.map(r => Bounty.fromRow(r));
      resolve(results);
    } catch (err) {
      reject(err);
    }
  }

  // To support await directly
  async exec() {
    const { text, values } = this.buildSql();
    const { rows } = await db.query(text, values);
    return rows.map(r => Bounty.fromRow(r));
  }

  buildSql() {
    let { text, values, paramIndex } = Bounty.buildQuery(this.queryObj);

    // Add custom wheres (naive implementation)
    if (this.customWhere.length > 0) {
      if (text.includes('WHERE')) {
        text += ' AND ' + this.customWhere.join(' AND ');
      } else {
        text += ' WHERE ' + this.customWhere.join(' AND ');
      }
    }

    // Sort
    if (Object.keys(this.sortObj).length > 0) {
      const sortParts = [];
      for (const [key, dir] of Object.entries(this.sortObj)) {
        let dbKey = key;
        if (key === 'createdAt') dbKey = 'created_at';
        // add other mappings as needed
        sortParts.push(`${dbKey} ${dir === -1 || dir === 'desc' ? 'DESC' : 'ASC'}`);
      }
      text += ' ORDER BY ' + sortParts.join(', ');
    }

    if (this.limitVal) {
      text += ` LIMIT ${this.limitVal}`;
    }
    if (this.skipVal) {
      text += ` OFFSET ${this.skipVal}`;
    }

    return { text, values };
  }
}

export default Bounty;