import { ethers } from 'ethers';
import logger from '../utils/logger.js';

// BountyEscrow ABI - minimal interface for the functions we need
const BOUNTY_ESCROW_ABI = [
  "function createBounty(string repository, uint256 issueId, string issueUrl, uint256 amount, uint256 maxAmount, uint256 expiresAt) returns (uint256)",
  "function escalateBounty(uint256 bountyId, uint256 additionalAmount)",
  "function releaseBounty(uint256 bountyId, address solver, string solverGithubLogin, string pullRequestUrl)",
  "function cancelBounty(uint256 bountyId)",
  "function getBounty(uint256 bountyId) view returns (tuple(uint256 id, address creator, uint256 initialAmount, uint256 currentAmount, uint256 maxAmount, string repository, uint256 issueId, string issueUrl, uint8 status, address solver, string solverGithubLogin, string pullRequestUrl, uint256 createdAt, uint256 claimedAt, uint256 expiresAt, uint8 escalationCount))",
  "function getBountyByIssue(string repository, uint256 issueId) view returns (tuple(uint256 id, address creator, uint256 initialAmount, uint256 currentAmount, uint256 maxAmount, string repository, uint256 issueId, string issueUrl, uint8 status, address solver, string solverGithubLogin, string pullRequestUrl, uint256 createdAt, uint256 claimedAt, uint256 expiresAt, uint8 escalationCount))",
  "function mneeToken() view returns (address)",
  "function platformFeeBps() view returns (uint256)",
  "event BountyCreated(uint256 indexed bountyId, address indexed creator, string repository, uint256 issueId, uint256 amount, uint256 maxAmount)",
  "event BountyClaimed(uint256 indexed bountyId, address indexed solver, string solverGithubLogin, uint256 amount, uint256 platformFee, string pullRequestUrl)",
  "event BountyEscalated(uint256 indexed bountyId, uint256 oldAmount, uint256 newAmount, uint8 escalationCount)"
];

// ERC20 ABI for MNEE token interactions
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// MNEE Token address on Ethereum mainnet
const MNEE_TOKEN_MAINNET = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";

// Bounty status enum mapping
const BountyStatus = {
  0: 'Active',
  1: 'Claimed',
  2: 'Cancelled',
  3: 'Expired'
};

class EthereumPaymentService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.escrowContract = null;
    this.mneeToken = null;
    this.initialized = false;
    this.decimals = 18;
  }

  async initialize() {
    logger.info('[ETH-PAYMENT] ========== INITIALIZING ETHEREUM PAYMENT SERVICE ==========');

    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
    const escrowAddress = process.env.BOUNTY_ESCROW_ADDRESS;
    const mneeTokenAddress = process.env.MNEE_TOKEN_ADDRESS;

    logger.info('[ETH-PAYMENT] Configuration check:');
    logger.info(`[ETH-PAYMENT]   - ETHEREUM_RPC_URL: ${rpcUrl ? `✓ Set (${rpcUrl.substring(0, 30)}...)` : '✗ NOT SET'}`);
    logger.info(`[ETH-PAYMENT]   - ETHEREUM_PRIVATE_KEY: ${privateKey ? '✓ Set (hidden)' : '✗ NOT SET'}`);
    logger.info(`[ETH-PAYMENT]   - BOUNTY_ESCROW_ADDRESS: ${escrowAddress || '✗ NOT SET (will try without escrow)'}`);
    logger.info(`[ETH-PAYMENT]   - MNEE_TOKEN_ADDRESS: ${mneeTokenAddress || '✗ NOT SET (will use default)'}`);

    if (!rpcUrl) {
      logger.error('[ETH-PAYMENT] ✗ ETHEREUM_RPC_URL not set in environment variables');
      throw new Error('ETHEREUM_RPC_URL not set in environment variables');
    }
    if (!privateKey) {
      logger.error('[ETH-PAYMENT] ✗ ETHEREUM_PRIVATE_KEY not set in environment variables');
      throw new Error('ETHEREUM_PRIVATE_KEY not set in environment variables');
    }

    try {
      // Initialize provider
      logger.info('[ETH-PAYMENT] Step 1: Connecting to Ethereum RPC...');
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test provider connection
      const blockNumber = await this.provider.getBlockNumber();
      logger.info(`[ETH-PAYMENT] ✓ Connected to RPC. Current block: ${blockNumber}`);

      // Initialize wallet
      logger.info('[ETH-PAYMENT] Step 2: Initializing wallet...');
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      logger.info(`[ETH-PAYMENT] ✓ Wallet address: ${this.wallet.address}`);

      // Get network info
      const network = await this.provider.getNetwork();
      logger.info(`[ETH-PAYMENT] ✓ Network: ${network.name} (chainId: ${network.chainId})`);

      // Check ETH balance
      const ethBalance = await this.provider.getBalance(this.wallet.address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);
      logger.info(`[ETH-PAYMENT] ✓ ETH balance: ${ethBalanceFormatted} ETH`);

      if (parseFloat(ethBalanceFormatted) < 0.001) {
        logger.warn('[ETH-PAYMENT] ⚠ Low ETH balance! May not have enough for gas fees');
      }

      // Initialize escrow contract if address is provided
      if (escrowAddress) {
        logger.info('[ETH-PAYMENT] Step 3: Initializing escrow contract...');
        this.escrowContract = new ethers.Contract(
          escrowAddress,
          BOUNTY_ESCROW_ABI,
          this.wallet
        );
        logger.info(`[ETH-PAYMENT] ✓ Escrow contract: ${escrowAddress}`);
      } else {
        logger.info('[ETH-PAYMENT] Step 3: No escrow contract address provided, skipping');
        this.escrowContract = null;
      }

      // Initialize MNEE token contract
      logger.info('[ETH-PAYMENT] Step 4: Initializing MNEE token contract...');
      let mneeAddress;
      
      if (mneeTokenAddress) {
        mneeAddress = mneeTokenAddress;
        logger.info(`[ETH-PAYMENT]   Using configured MNEE address: ${mneeAddress}`);
      } else if (this.escrowContract) {
        try {
          mneeAddress = await this.escrowContract.mneeToken();
          logger.info(`[ETH-PAYMENT]   Got MNEE address from escrow contract: ${mneeAddress}`);
        } catch (err) {
          logger.warn(`[ETH-PAYMENT]   Failed to get MNEE from escrow: ${err.message}`);
          mneeAddress = MNEE_TOKEN_MAINNET;
          logger.info(`[ETH-PAYMENT]   Using default mainnet MNEE address: ${mneeAddress}`);
        }
      } else {
        mneeAddress = MNEE_TOKEN_MAINNET;
        logger.info(`[ETH-PAYMENT]   Using default mainnet MNEE address: ${mneeAddress}`);
      }

      this.mneeToken = new ethers.Contract(
        mneeAddress,
        ERC20_ABI,
        this.wallet
      );

      // Get token info
      logger.info('[ETH-PAYMENT] Step 5: Fetching token info...');
      try {
        this.decimals = await this.mneeToken.decimals();
        const symbol = await this.mneeToken.symbol();
        const tokenBalance = await this.mneeToken.balanceOf(this.wallet.address);
        const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, this.decimals);
        
        logger.info(`[ETH-PAYMENT] ✓ Token symbol: ${symbol}`);
        logger.info(`[ETH-PAYMENT] ✓ Token decimals: ${this.decimals}`);
        logger.info(`[ETH-PAYMENT] ✓ Token balance: ${tokenBalanceFormatted} ${symbol}`);

        if (parseFloat(tokenBalanceFormatted) === 0) {
          logger.warn('[ETH-PAYMENT] ⚠ Token balance is 0! Cannot make payments until funded');
        }
      } catch (tokenError) {
        logger.error(`[ETH-PAYMENT] ✗ Failed to fetch token info: ${tokenError.message}`);
        logger.error('[ETH-PAYMENT]   This may indicate:');
        logger.error('[ETH-PAYMENT]   1. Invalid token address');
        logger.error('[ETH-PAYMENT]   2. Token contract not deployed on this network');
        logger.error('[ETH-PAYMENT]   3. RPC connection issues');
        throw tokenError;
      }

      this.initialized = true;
      logger.info('[ETH-PAYMENT] ========== INITIALIZATION COMPLETE ==========');
      logger.info('[ETH-PAYMENT] Summary:');
      logger.info(`[ETH-PAYMENT]   - Network: ${network.name} (chainId: ${network.chainId})`);
      logger.info(`[ETH-PAYMENT]   - Wallet: ${this.wallet.address}`);
      logger.info(`[ETH-PAYMENT]   - ETH Balance: ${ethBalanceFormatted} ETH`);
      logger.info(`[ETH-PAYMENT]   - MNEE Token: ${mneeAddress}`);
      logger.info(`[ETH-PAYMENT]   - Escrow Contract: ${escrowAddress || 'Not configured'}`);
      logger.info('[ETH-PAYMENT] ================================================');

    } catch (error) {
      logger.error('[ETH-PAYMENT] ========== INITIALIZATION FAILED ==========');
      logger.error(`[ETH-PAYMENT] Error: ${error.message}`);
      logger.error(`[ETH-PAYMENT] Stack: ${error.stack}`);
      logger.error('[ETH-PAYMENT] ============================================');
      throw error;
    }
  }

  /**
   * Convert MNEE amount to atomic units (wei-like)
   */
  toAtomicUnits(amount) {
    return ethers.parseUnits(amount.toString(), this.decimals);
  }

  /**
   * Convert atomic units to MNEE amount
   */
  fromAtomicUnits(atomicAmount) {
    return parseFloat(ethers.formatUnits(atomicAmount, this.decimals));
  }

  /**
   * Get MNEE balance of the bot wallet
   */
  async getBalance() {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      const balance = await this.mneeToken.balanceOf(this.wallet.address);
      const ethBalance = await this.provider.getBalance(this.wallet.address);

      return {
        address: this.wallet.address,
        balance: this.fromAtomicUnits(balance),
        ethBalance: parseFloat(ethers.formatEther(ethBalance)),
        pending: 0,
        total: this.fromAtomicUnits(balance)
      };
    } catch (error) {
      logger.error('Failed to get Ethereum balance', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure the escrow contract has sufficient allowance
   */
  async ensureAllowance(amount) {
    const escrowAddress = await this.escrowContract.getAddress();
    const currentAllowance = await this.mneeToken.allowance(
      this.wallet.address,
      escrowAddress
    );

    if (currentAllowance < amount) {
      logger.info('Approving MNEE tokens for escrow contract...', {
        currentAllowance: this.fromAtomicUnits(currentAllowance),
        requiredAmount: this.fromAtomicUnits(amount)
      });

      // Approve max uint256 for convenience
      const tx = await this.mneeToken.approve(escrowAddress, ethers.MaxUint256);
      await tx.wait();
      logger.info('MNEE approval confirmed', { txHash: tx.hash });
    }
  }

  /**
   * Create a bounty on-chain
   */
  async createBounty(repository, issueId, issueUrl, amount, maxAmount, expiresAt = 0) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      const atomicAmount = this.toAtomicUnits(amount);
      const atomicMaxAmount = this.toAtomicUnits(maxAmount);

      // Ensure we have enough allowance
      await this.ensureAllowance(atomicAmount);

      logger.info('Creating on-chain bounty...', {
        repository,
        issueId,
        amount,
        maxAmount
      });

      const tx = await this.escrowContract.createBounty(
        repository,
        issueId,
        issueUrl,
        atomicAmount,
        atomicMaxAmount,
        expiresAt
      );

      const receipt = await tx.wait();

      // Parse the BountyCreated event to get the bounty ID
      const event = receipt.logs
        .map(log => {
          try {
            return this.escrowContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(e => e && e.name === 'BountyCreated');

      const bountyId = event ? event.args.bountyId.toString() : null;

      logger.info('On-chain bounty created', {
        bountyId,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      });

      return {
        success: true,
        bountyId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      logger.error('Failed to create on-chain bounty', {
        error: error.message,
        repository,
        issueId
      });
      throw error;
    }
  }

  /**
   * Escalate a bounty on-chain
   */
  async escalateBounty(bountyId, additionalAmount) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      const atomicAmount = this.toAtomicUnits(additionalAmount);

      // Ensure we have enough allowance if adding funds
      if (additionalAmount > 0) {
        await this.ensureAllowance(atomicAmount);
      }

      logger.info('Escalating on-chain bounty...', {
        bountyId,
        additionalAmount
      });

      const tx = await this.escrowContract.escalateBounty(bountyId, atomicAmount);
      const receipt = await tx.wait();

      // Parse event to get new amount
      const event = receipt.logs
        .map(log => {
          try {
            return this.escrowContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(e => e && e.name === 'BountyEscalated');

      const newAmount = event ? this.fromAtomicUnits(event.args.newAmount) : null;

      logger.info('On-chain bounty escalated', {
        bountyId,
        newAmount,
        txHash: tx.hash
      });

      return {
        success: true,
        newAmount,
        transactionHash: tx.hash
      };
    } catch (error) {
      logger.error('Failed to escalate on-chain bounty', {
        error: error.message,
        bountyId
      });
      throw error;
    }
  }

  /**
   * Release a bounty to the solver (called by oracle/bot)
   */
  async releaseBounty(bountyId, solverAddress, solverGithubLogin, pullRequestUrl) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      logger.info('Releasing on-chain bounty...', {
        bountyId,
        solverAddress,
        solverGithubLogin
      });

      const tx = await this.escrowContract.releaseBounty(
        bountyId,
        solverAddress,
        solverGithubLogin,
        pullRequestUrl
      );

      const receipt = await tx.wait();

      // Parse the BountyClaimed event
      const event = receipt.logs
        .map(log => {
          try {
            return this.escrowContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(e => e && e.name === 'BountyClaimed');

      const amount = event ? this.fromAtomicUnits(event.args.amount) : null;
      const platformFee = event ? this.fromAtomicUnits(event.args.platformFee) : null;

      logger.info('On-chain bounty released', {
        bountyId,
        amount,
        platformFee,
        txHash: tx.hash
      });

      return {
        success: true,
        transactionId: tx.hash,
        amount,
        platformFee,
        recipient: solverAddress
      };
    } catch (error) {
      logger.error('Failed to release on-chain bounty', {
        error: error.message,
        bountyId,
        solverAddress
      });
      throw error;
    }
  }

  /**
   * Send direct MNEE payment (for compatibility with non-escrow flow)
   * This transfers tokens directly without the escrow contract
   */
  async sendPayment(recipientAddress, amount, bountyId) {
    logger.info('[ETH-PAYMENT] ========== SEND PAYMENT ==========');
    logger.info(`[ETH-PAYMENT] Bounty ID: ${bountyId}`);
    logger.info(`[ETH-PAYMENT] Recipient: ${recipientAddress}`);
    logger.info(`[ETH-PAYMENT] Amount: ${amount} MNEE`);

    // Check initialization
    if (!this.initialized) {
      logger.error('[ETH-PAYMENT] ✗ Service not initialized!');
      logger.info('[ETH-PAYMENT] Attempting to initialize...');
      try {
        await this.initialize();
      } catch (initError) {
        logger.error(`[ETH-PAYMENT] ✗ Auto-initialization failed: ${initError.message}`);
        throw new Error(`Ethereum payment service not initialized: ${initError.message}`);
      }
    }

    try {
      // Validate recipient address
      logger.info('[ETH-PAYMENT] Step 1: Validating recipient address...');
      if (!ethers.isAddress(recipientAddress)) {
        logger.error(`[ETH-PAYMENT] ✗ Invalid Ethereum address: ${recipientAddress}`);
        throw new Error(`Invalid Ethereum address: ${recipientAddress}`);
      }
      logger.info('[ETH-PAYMENT] ✓ Recipient address is valid');

      // Check current balance
      logger.info('[ETH-PAYMENT] Step 2: Checking balances...');
      const tokenBalance = await this.mneeToken.balanceOf(this.wallet.address);
      const tokenBalanceFormatted = this.fromAtomicUnits(tokenBalance);
      logger.info(`[ETH-PAYMENT]   - Current MNEE balance: ${tokenBalanceFormatted}`);
      logger.info(`[ETH-PAYMENT]   - Amount to send: ${amount}`);

      // Convert amount to atomic units
      const atomicAmount = this.toAtomicUnits(amount);
      logger.info(`[ETH-PAYMENT]   - Atomic amount: ${atomicAmount.toString()} (${this.decimals} decimals)`);

      // Check if we have enough balance
      if (tokenBalance < atomicAmount) {
        logger.error(`[ETH-PAYMENT] ✗ Insufficient balance!`);
        logger.error(`[ETH-PAYMENT]   Have: ${tokenBalanceFormatted} MNEE`);
        logger.error(`[ETH-PAYMENT]   Need: ${amount} MNEE`);
        throw new Error(`Insufficient MNEE balance. Have: ${tokenBalanceFormatted}, Need: ${amount}`);
      }
      logger.info('[ETH-PAYMENT] ✓ Sufficient balance confirmed');

      // Check ETH for gas
      const ethBalance = await this.provider.getBalance(this.wallet.address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);
      logger.info(`[ETH-PAYMENT]   - ETH balance for gas: ${ethBalanceFormatted} ETH`);

      if (parseFloat(ethBalanceFormatted) < 0.0001) {
        logger.error('[ETH-PAYMENT] ✗ Insufficient ETH for gas!');
        throw new Error(`Insufficient ETH for gas. Have: ${ethBalanceFormatted} ETH`);
      }
      logger.info('[ETH-PAYMENT] ✓ Sufficient ETH for gas');

      // Estimate gas
      logger.info('[ETH-PAYMENT] Step 3: Estimating gas...');
      let gasEstimate;
      try {
        gasEstimate = await this.mneeToken.transfer.estimateGas(recipientAddress, atomicAmount);
        logger.info(`[ETH-PAYMENT]   - Estimated gas: ${gasEstimate.toString()}`);
      } catch (gasError) {
        logger.error(`[ETH-PAYMENT] ✗ Gas estimation failed: ${gasError.message}`);
        logger.error('[ETH-PAYMENT]   This usually means the transaction will fail');
        logger.error('[ETH-PAYMENT]   Possible reasons:');
        logger.error('[ETH-PAYMENT]   1. Insufficient token balance');
        logger.error('[ETH-PAYMENT]   2. Contract paused or restricted');
        logger.error('[ETH-PAYMENT]   3. Recipient address blacklisted');
        throw new Error(`Gas estimation failed: ${gasError.message}`);
      }

      // Get gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      logger.info(`[ETH-PAYMENT]   - Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
      const estimatedCost = gasPrice * gasEstimate;
      logger.info(`[ETH-PAYMENT]   - Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`);

      // Send transaction
      logger.info('[ETH-PAYMENT] Step 4: Sending transaction...');
      logger.info(`[ETH-PAYMENT]   - From: ${this.wallet.address}`);
      logger.info(`[ETH-PAYMENT]   - To (token): ${await this.mneeToken.getAddress()}`);
      logger.info(`[ETH-PAYMENT]   - Transfer to: ${recipientAddress}`);
      logger.info(`[ETH-PAYMENT]   - Amount: ${amount} MNEE`);

      const tx = await this.mneeToken.transfer(recipientAddress, atomicAmount);
      logger.info(`[ETH-PAYMENT] ✓ Transaction submitted!`);
      logger.info(`[ETH-PAYMENT]   - TX Hash: ${tx.hash}`);
      logger.info(`[ETH-PAYMENT]   - Nonce: ${tx.nonce}`);

      // Wait for confirmation
      logger.info('[ETH-PAYMENT] Step 5: Waiting for confirmation...');
      const receipt = await tx.wait();
      
      logger.info('[ETH-PAYMENT] ✓ Transaction confirmed!');
      logger.info(`[ETH-PAYMENT]   - Block number: ${receipt.blockNumber}`);
      logger.info(`[ETH-PAYMENT]   - Gas used: ${receipt.gasUsed.toString()}`);
      logger.info(`[ETH-PAYMENT]   - Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);

      if (receipt.status !== 1) {
        logger.error('[ETH-PAYMENT] ✗ Transaction failed on-chain!');
        throw new Error('Transaction failed on-chain');
      }

      // Verify the transfer
      logger.info('[ETH-PAYMENT] Step 6: Verifying transfer...');
      const newBalance = await this.mneeToken.balanceOf(this.wallet.address);
      const newBalanceFormatted = this.fromAtomicUnits(newBalance);
      logger.info(`[ETH-PAYMENT]   - New balance: ${newBalanceFormatted} MNEE`);
      logger.info(`[ETH-PAYMENT]   - Deducted: ${tokenBalanceFormatted - newBalanceFormatted} MNEE`);

      logger.info('[ETH-PAYMENT] ========== PAYMENT SUCCESSFUL ==========');
      logger.info(`[ETH-PAYMENT] Summary:`);
      logger.info(`[ETH-PAYMENT]   - TX Hash: ${tx.hash}`);
      logger.info(`[ETH-PAYMENT]   - Recipient: ${recipientAddress}`);
      logger.info(`[ETH-PAYMENT]   - Amount: ${amount} MNEE`);
      logger.info(`[ETH-PAYMENT]   - Gas used: ${receipt.gasUsed.toString()}`);
      logger.info(`[ETH-PAYMENT]   - Block: ${receipt.blockNumber}`);
      logger.info('[ETH-PAYMENT] ==========================================');

      return {
        success: true,
        transactionId: tx.hash,
        transactionHash: tx.hash,
        amount,
        recipient: recipientAddress,
        bountyId,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      logger.error('[ETH-PAYMENT] ========== PAYMENT FAILED ==========');
      logger.error(`[ETH-PAYMENT] Error: ${error.message}`);
      logger.error(`[ETH-PAYMENT] Bounty ID: ${bountyId}`);
      logger.error(`[ETH-PAYMENT] Recipient: ${recipientAddress}`);
      logger.error(`[ETH-PAYMENT] Amount: ${amount} MNEE`);
      
      // Parse common error types
      if (error.message.includes('insufficient funds')) {
        logger.error('[ETH-PAYMENT] Diagnosis: Insufficient ETH for gas');
      } else if (error.message.includes('nonce')) {
        logger.error('[ETH-PAYMENT] Diagnosis: Nonce issue - pending transaction?');
      } else if (error.message.includes('execution reverted')) {
        logger.error('[ETH-PAYMENT] Diagnosis: Contract execution reverted');
        logger.error('[ETH-PAYMENT]   - Check token balance');
        logger.error('[ETH-PAYMENT]   - Check if token is paused');
        logger.error('[ETH-PAYMENT]   - Check for transfer restrictions');
      } else if (error.message.includes('network')) {
        logger.error('[ETH-PAYMENT] Diagnosis: Network connectivity issue');
      }

      logger.error(`[ETH-PAYMENT] Stack: ${error.stack}`);
      logger.error('[ETH-PAYMENT] ==========================================');
      throw error;
    }
  }

  /**
   * Get bounty details from chain
   */
  async getBountyDetails(bountyId) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      const bounty = await this.escrowContract.getBounty(bountyId);
      
      return {
        id: bounty.id.toString(),
        creator: bounty.creator,
        initialAmount: this.fromAtomicUnits(bounty.initialAmount),
        currentAmount: this.fromAtomicUnits(bounty.currentAmount),
        maxAmount: this.fromAtomicUnits(bounty.maxAmount),
        repository: bounty.repository,
        issueId: Number(bounty.issueId),
        issueUrl: bounty.issueUrl,
        status: BountyStatus[bounty.status] || 'Unknown',
        solver: bounty.solver,
        solverGithubLogin: bounty.solverGithubLogin,
        pullRequestUrl: bounty.pullRequestUrl,
        createdAt: new Date(Number(bounty.createdAt) * 1000),
        claimedAt: bounty.claimedAt > 0 ? new Date(Number(bounty.claimedAt) * 1000) : null,
        expiresAt: bounty.expiresAt > 0 ? new Date(Number(bounty.expiresAt) * 1000) : null,
        escalationCount: Number(bounty.escalationCount)
      };
    } catch (error) {
      logger.error('Failed to get on-chain bounty', {
        error: error.message,
        bountyId
      });
      throw error;
    }
  }

  /**
   * Get bounty by repository and issue
   */
  async getBountyByIssue(repository, issueId) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      const bounty = await this.escrowContract.getBountyByIssue(repository, issueId);
      
      if (!bounty.id || bounty.id === 0n) {
        return null;
      }

      return {
        id: bounty.id.toString(),
        creator: bounty.creator,
        initialAmount: this.fromAtomicUnits(bounty.initialAmount),
        currentAmount: this.fromAtomicUnits(bounty.currentAmount),
        maxAmount: this.fromAtomicUnits(bounty.maxAmount),
        repository: bounty.repository,
        issueId: Number(bounty.issueId),
        status: BountyStatus[bounty.status] || 'Unknown',
        solver: bounty.solver
      };
    } catch (error) {
      logger.error('Failed to get bounty by issue', {
        error: error.message,
        repository,
        issueId
      });
      throw error;
    }
  }

  /**
   * Validate Ethereum address
   */
  validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Calculate fee for a given amount
   */
  async calculateFee(amount) {
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    const feeBps = await this.escrowContract.platformFeeBps();
    return (amount * Number(feeBps)) / 10000;
  }
}

export default new EthereumPaymentService();