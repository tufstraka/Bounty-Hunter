import logger from '../utils/logger.js';

/**
 * Unified Payment Service
 * 
 * Switches between MNEE SDK (Bitcoin-style) and Ethereum blockchain based on
 * the USE_BLOCKCHAIN environment variable.
 * 
 * When USE_BLOCKCHAIN=true: Uses Ethereum smart contracts with MNEE ERC-20 token
 * When USE_BLOCKCHAIN=false (default): Uses MNEE SDK for Bitcoin-style payments
 */
class PaymentService {
  constructor() {
    this.mneeService = null;
    this.ethereumService = null;
    this.activeService = null;
    this.useBlockchain = false;
    this.initialized = false;
  }

  /**
   * Initialize the appropriate payment service based on configuration
   */
  async initialize() {
    this.useBlockchain = process.env.USE_BLOCKCHAIN === 'true';
    
    logger.info('Initializing payment service', {
      useBlockchain: this.useBlockchain,
      mode: this.useBlockchain ? 'Ethereum (ERC-20 MNEE)' : 'MNEE SDK (Bitcoin-style)'
    });

    try {
      if (this.useBlockchain) {
        // Use Ethereum blockchain with MNEE ERC-20 token
        const ethereumPaymentModule = await import('./ethereumPayment.js');
        this.ethereumService = ethereumPaymentModule.default;
        await this.ethereumService.initialize();
        this.activeService = this.ethereumService;
        logger.info('Payment service initialized with Ethereum blockchain');
      } else {
        // Use MNEE SDK (Bitcoin-style)
        const mneeModule = await import('./mnee.js');
        this.mneeService = mneeModule.default;
        await this.mneeService.initialize();
        this.activeService = this.mneeService;
        logger.info('Payment service initialized with MNEE SDK');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize payment service', {
        useBlockchain: this.useBlockchain,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if using blockchain mode
   */
  isBlockchainMode() {
    return this.useBlockchain;
  }

  /**
   * Get wallet balance
   * @returns {Promise<Object>} Balance information
   */
  async getBalance() {
    this._ensureInitialized();
    return this.activeService.getBalance();
  }

  /**
   * Send payment to a recipient
   * @param {string} recipientAddress - Recipient address (Ethereum or Bitcoin-style depending on mode)
   * @param {number} amount - Amount in MNEE
   * @param {string} bountyId - Bounty ID for tracking
   * @returns {Promise<Object>} Transaction result
   */
  async sendPayment(recipientAddress, amount, bountyId) {
    this._ensureInitialized();

    logger.info('Sending payment', {
      mode: this.useBlockchain ? 'Ethereum' : 'MNEE SDK',
      recipient: recipientAddress,
      amount,
      bountyId
    });

    return this.activeService.sendPayment(recipientAddress, amount, bountyId);
  }

  /**
   * Validate address format
   * @param {string} address - Address to validate
   * @returns {boolean|Promise<boolean>} True if valid
   */
  async validateAddress(address) {
    this._ensureInitialized();

    if (this.useBlockchain) {
      return this.ethereumService.validateAddress(address);
    } else {
      return this.mneeService.validateAddress(address);
    }
  }

  /**
   * Calculate fee for a given amount
   * @param {number} amount - Amount in MNEE
   * @returns {number|Promise<number>} Fee in MNEE
   */
  async calculateFee(amount) {
    this._ensureInitialized();

    if (this.useBlockchain) {
      return this.ethereumService.calculateFee(amount);
    } else {
      return this.mneeService.calculateFee(amount);
    }
  }

  // ============================================
  // Blockchain-specific methods (only available in blockchain mode)
  // ============================================

  /**
   * Create a bounty on-chain (blockchain mode only)
   * Falls back to no-op in MNEE SDK mode (bounty created in DB instead)
   */
  async createOnChainBounty(repository, issueId, issueUrl, amount, maxAmount, expiresAt = 0) {
    if (!this.useBlockchain) {
      logger.debug('createOnChainBounty called in non-blockchain mode, skipping');
      return null;
    }

    this._ensureInitialized();
    return this.ethereumService.createBounty(repository, issueId, issueUrl, amount, maxAmount, expiresAt);
  }

  /**
   * Escalate bounty on-chain (blockchain mode only)
   */
  async escalateOnChainBounty(onChainBountyId, additionalAmount) {
    if (!this.useBlockchain) {
      logger.debug('escalateOnChainBounty called in non-blockchain mode, skipping');
      return null;
    }

    this._ensureInitialized();
    return this.ethereumService.escalateBounty(onChainBountyId, additionalAmount);
  }

  /**
   * Release bounty on-chain (blockchain mode only)
   * This is called by the oracle/bot when tests pass
   */
  async releaseOnChainBounty(onChainBountyId, solverAddress, solverGithubLogin, pullRequestUrl) {
    if (!this.useBlockchain) {
      logger.debug('releaseOnChainBounty called in non-blockchain mode, using sendPayment instead');
      // In non-blockchain mode, this should be handled by sendPayment directly
      return null;
    }

    this._ensureInitialized();
    return this.ethereumService.releaseBounty(onChainBountyId, solverAddress, solverGithubLogin, pullRequestUrl);
  }

  /**
   * Get on-chain bounty details (blockchain mode only)
   */
  async getOnChainBounty(onChainBountyId) {
    if (!this.useBlockchain) {
      return null;
    }

    this._ensureInitialized();
    return this.ethereumService.getBountyDetails(onChainBountyId);
  }

  /**
   * Get on-chain bounty by issue (blockchain mode only)
   */
  async getOnChainBountyByIssue(repository, issueId) {
    if (!this.useBlockchain) {
      return null;
    }

    this._ensureInitialized();
    return this.ethereumService.getBountyByIssue(repository, issueId);
  }

  // ============================================
  // MNEE SDK specific methods (only available in non-blockchain mode)
  // ============================================

  /**
   * Request test tokens from faucet (MNEE sandbox only)
   */
  async requestFromFaucet() {
    if (this.useBlockchain) {
      logger.debug('Faucet not available in blockchain mode');
      return null;
    }

    this._ensureInitialized();
    return this.mneeService.requestFromFaucet();
  }

  // ============================================
  // Helper methods
  // ============================================

  /**
   * Ensure service is initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Payment service not initialized. Call initialize() first.');
    }
  }

  /**
   * Get the address pattern description for the current mode
   * Useful for user-facing messages
   */
  getAddressPattern() {
    if (this.useBlockchain) {
      return {
        type: 'Ethereum',
        pattern: '0x followed by 40 hex characters',
        example: '0x742d35Cc6634C0532925a3b844Bc9e7595f1c123',
        regex: /^0x[a-fA-F0-9]{40}$/
      };
    } else {
      return {
        type: 'Bitcoin-style (MNEE)',
        pattern: 'Starts with 1 or 3, 25-34 alphanumeric characters',
        example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        regex: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
      };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      mode: this.useBlockchain ? 'blockchain' : 'mnee-sdk',
      description: this.useBlockchain 
        ? 'Ethereum MNEE ERC-20 Token (0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF)'
        : 'MNEE SDK (Bitcoin-style)',
      activeService: this.activeService ? 'ready' : 'not loaded'
    };
  }
}

// Export singleton instance
export default new PaymentService();