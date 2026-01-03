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
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
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
    logger.debug('Initializing Ethereum payment service...');

    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
    const escrowAddress = process.env.BOUNTY_ESCROW_ADDRESS;

    if (!rpcUrl) {
      throw new Error('ETHEREUM_RPC_URL not set in environment variables');
    }
    if (!privateKey) {
      throw new Error('ETHEREUM_PRIVATE_KEY not set in environment variables');
    }
    if (!escrowAddress) {
      throw new Error('BOUNTY_ESCROW_ADDRESS not set in environment variables');
    }

    try {
      // Initialize provider and wallet
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // Initialize contracts
      this.escrowContract = new ethers.Contract(
        escrowAddress,
        BOUNTY_ESCROW_ABI,
        this.wallet
      );

      // Get MNEE token address from escrow contract
      const mneeAddress = process.env.MNEE_TOKEN_ADDRESS || await this.escrowContract.mneeToken();
      this.mneeToken = new ethers.Contract(
        mneeAddress,
        ERC20_ABI,
        this.wallet
      );

      // Get token decimals
      this.decimals = await this.mneeToken.decimals();

      // Log connection info
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(this.wallet.address);

      logger.info('Ethereum payment service initialized', {
        network: network.name,
        chainId: network.chainId.toString(),
        walletAddress: this.wallet.address,
        ethBalance: ethers.formatEther(balance),
        escrowContract: escrowAddress,
        mneeToken: mneeAddress
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize Ethereum payment service', {
        error: error.message,
        stack: error.stack
      });
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
    if (!this.initialized) {
      throw new Error('Ethereum payment service not initialized');
    }

    try {
      logger.info(`Sending ${amount} MNEE to ${recipientAddress} for bounty ${bountyId}`);

      const atomicAmount = this.toAtomicUnits(amount);

      // Direct ERC20 transfer
      const tx = await this.mneeToken.transfer(recipientAddress, atomicAmount);
      const receipt = await tx.wait();

      logger.info('MNEE payment sent', {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        amount,
        recipient: recipientAddress
      });

      return {
        success: true,
        transactionId: tx.hash,
        amount,
        recipient: recipientAddress,
        bountyId
      };
    } catch (error) {
      logger.error('Failed to send MNEE payment', {
        error: error.message,
        recipientAddress,
        amount
      });
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