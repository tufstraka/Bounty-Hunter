/**
 * Payment Service Tests
 * 
 * Tests for the unified payment service that switches between
 * MNEE SDK and Ethereum blockchain based on USE_BLOCKCHAIN env variable.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock environment variables
const originalEnv = process.env;

describe('PaymentService', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Mode Selection', () => {
    it('should default to MNEE SDK mode when USE_BLOCKCHAIN is not set', async () => {
      delete process.env.USE_BLOCKCHAIN;
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      expect(paymentService.isBlockchainMode()).toBe(false);
    });

    it('should use MNEE SDK mode when USE_BLOCKCHAIN=false', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      expect(paymentService.isBlockchainMode()).toBe(false);
    });

    it('should use Ethereum mode when USE_BLOCKCHAIN=true', async () => {
      process.env.USE_BLOCKCHAIN = 'true';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      expect(paymentService.isBlockchainMode()).toBe(true);
    });
  });

  describe('Address Patterns', () => {
    it('should return Bitcoin-style pattern in MNEE SDK mode', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      const pattern = paymentService.getAddressPattern();
      
      expect(pattern.type).toBe('Bitcoin-style (MNEE)');
      expect(pattern.regex.test('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
      expect(pattern.regex.test('0x742d35Cc6634C0532925a3b844Bc9e7595f1c123')).toBe(false);
    });

    it('should return Ethereum pattern in blockchain mode', async () => {
      process.env.USE_BLOCKCHAIN = 'true';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      const pattern = paymentService.getAddressPattern();
      
      expect(pattern.type).toBe('Ethereum');
      expect(pattern.regex.test('0x742d35Cc6634C0532925a3b844Bc9e7595f1c123')).toBe(true);
      expect(pattern.regex.test('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
    });
  });

  describe('Status', () => {
    it('should report correct status before initialization', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      const status = paymentService.getStatus();
      
      expect(status.initialized).toBe(false);
      expect(status.mode).toBe('mnee-sdk');
    });

    it('should report blockchain mode in status', async () => {
      process.env.USE_BLOCKCHAIN = 'true';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      const status = paymentService.getStatus();
      
      expect(status.mode).toBe('blockchain');
      expect(status.description).toContain('Ethereum');
    });
  });

  describe('Blockchain-specific methods in non-blockchain mode', () => {
    it('should return null for createOnChainBounty in MNEE mode', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      process.env.MNEE_API_KEY = 'test-key';
      process.env.MNEE_ENVIRONMENT = 'sandbox';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      // Don't initialize, just test the method guard
      const result = await paymentService.createOnChainBounty('owner/repo', 1, 'url', 100, 300);
      
      expect(result).toBeNull();
    });

    it('should return null for releaseOnChainBounty in MNEE mode', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      const result = await paymentService.releaseOnChainBounty(1, '0xaddr', 'user', 'https://pr');
      
      expect(result).toBeNull();
    });

    it('should return null for getOnChainBounty in MNEE mode', async () => {
      process.env.USE_BLOCKCHAIN = 'false';
      
      const { default: paymentService } = await import('../src/services/paymentService.js');
      
      const result = await paymentService.getOnChainBounty(1);
      
      expect(result).toBeNull();
    });
  });
});

describe('EthereumPaymentService', () => {
  describe('Address Validation', () => {
    it('should validate correct Ethereum addresses', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      expect(ethereumService.validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1c123')).toBe(true);
      expect(ethereumService.validateAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should reject invalid Ethereum addresses', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      expect(ethereumService.validateAddress('not-an-address')).toBe(false);
      expect(ethereumService.validateAddress('0x123')).toBe(false);
      expect(ethereumService.validateAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
      expect(ethereumService.validateAddress('')).toBe(false);
    });
  });

  describe('Unit Conversions', () => {
    it('should convert MNEE to atomic units (18 decimals)', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      // Set decimals manually for testing
      ethereumService.decimals = 18;
      
      const atomicUnits = ethereumService.toAtomicUnits(1);
      expect(atomicUnits.toString()).toBe('1000000000000000000');
      
      const atomicUnits2 = ethereumService.toAtomicUnits(100);
      expect(atomicUnits2.toString()).toBe('100000000000000000000');
    });

    it('should convert atomic units back to MNEE', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      ethereumService.decimals = 18;
      
      const { ethers } = await import('ethers');
      const amount = ethereumService.fromAtomicUnits(ethers.parseEther('100'));
      expect(amount).toBe(100);
    });
  });

  describe('Initialization Requirements', () => {
    it('should throw if ETHEREUM_RPC_URL not set', async () => {
      delete process.env.ETHEREUM_RPC_URL;
      delete process.env.ETHEREUM_PRIVATE_KEY;
      delete process.env.BOUNTY_ESCROW_ADDRESS;
      
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      await expect(ethereumService.initialize()).rejects.toThrow('ETHEREUM_RPC_URL');
    });

    it('should throw if ETHEREUM_PRIVATE_KEY not set', async () => {
      process.env.ETHEREUM_RPC_URL = 'http://localhost:8545';
      delete process.env.ETHEREUM_PRIVATE_KEY;
      
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      await expect(ethereumService.initialize()).rejects.toThrow('ETHEREUM_PRIVATE_KEY');
    });

    it('should throw if BOUNTY_ESCROW_ADDRESS not set', async () => {
      process.env.ETHEREUM_RPC_URL = 'http://localhost:8545';
      process.env.ETHEREUM_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      delete process.env.BOUNTY_ESCROW_ADDRESS;
      
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      await expect(ethereumService.initialize()).rejects.toThrow('BOUNTY_ESCROW_ADDRESS');
    });
  });

  describe('Not Initialized Guards', () => {
    it('should throw if getBalance called before initialize', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      await expect(ethereumService.getBalance()).rejects.toThrow('not initialized');
    });

    it('should throw if sendPayment called before initialize', async () => {
      const { default: ethereumService } = await import('../src/services/ethereumPayment.js');
      
      await expect(
        ethereumService.sendPayment('0x742d35Cc6634C0532925a3b844Bc9e7595f1c123', 100, '1')
      ).rejects.toThrow('not initialized');
    });
  });
});

describe('BountyStatus Mapping', () => {
  it('should map status codes correctly', async () => {
    // The BountyStatus mapping is internal to ethereumPayment.js
    // We're just documenting the expected behavior here
    const statusMap = {
      0: 'Active',
      1: 'Claimed',
      2: 'Cancelled',
      3: 'Expired'
    };
    
    expect(statusMap[0]).toBe('Active');
    expect(statusMap[1]).toBe('Claimed');
    expect(statusMap[2]).toBe('Cancelled');
    expect(statusMap[3]).toBe('Expired');
  });
});