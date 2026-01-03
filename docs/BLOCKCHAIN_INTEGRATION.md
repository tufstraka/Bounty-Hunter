# Blockchain Integration Guide

This document explains how to use the Ethereum blockchain integration for FixFlow bounty payments using the MNEE ERC-20 token.

## Overview

FixFlow supports two payment modes:

1. **MNEE SDK Mode** (default): Uses the MNEE SDK for Bitcoin-style payments
2. **Blockchain Mode**: Uses Ethereum smart contracts with the MNEE ERC-20 token

The mode is controlled by the `USE_BLOCKCHAIN` environment variable.

## MNEE Token Information

**Ethereum Mainnet:**
- Contract: `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
- Etherscan: https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
- Standard: ERC-20

## Architecture

### Smart Contracts

The `BountyEscrow` contract handles:
- Creating bounties with MNEE token deposits
- Escalating bounty amounts over time
- Releasing payments to solvers when tests pass
- Cancelling bounties and refunding creators
- Platform fee collection

### Payment Flow (Blockchain Mode)

```
1. Bounty Creator approves MNEE tokens to BountyEscrow
2. Creator calls createBounty() - tokens transferred to escrow
3. Developer fixes issue and creates PR
4. CI tests pass → Bot (Oracle) verifies
5. Bot calls releaseBounty() → Tokens sent to solver (minus platform fee)
```

### Payment Flow (MNEE SDK Mode)

```
1. Bounty created in database
2. Developer fixes issue and creates PR
3. CI tests pass → Bot verifies
4. Bot sends MNEE payment via SDK directly to solver
```

## Setup Instructions

### 1. Environment Configuration

Add these to your `.env` file:

```bash
# Enable blockchain mode
USE_BLOCKCHAIN=true

# Ethereum RPC URL (Alchemy, Infura, etc.)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Bot's Ethereum private key (acts as oracle)
ETHEREUM_PRIVATE_KEY=your_private_key_here

# Deployed BountyEscrow contract address
BOUNTY_ESCROW_ADDRESS=0x...

# MNEE Token address (mainnet)
MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
```

### 2. Deploy Smart Contracts

```bash
cd bounty-hunter/contracts

# Install dependencies
npm install

# Copy and configure .env
cp .env.example .env
# Edit .env with your RPC URL, private key, etc.

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Or deploy to mainnet
npm run deploy:mainnet
```

### 3. Verify Contract on Etherscan

After deployment, verify the contract:

```bash
npx hardhat verify --network mainnet <CONTRACT_ADDRESS> \
  "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF" \
  "<ADMIN_ADDRESS>" \
  "<ORACLE_ADDRESS>" \
  "<FEE_RECIPIENT_ADDRESS>"
```

## Contract Roles

The BountyEscrow contract uses role-based access control:

| Role | Description | Permissions |
|------|-------------|-------------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke roles | Full admin access |
| `ADMIN_ROLE` | Contract administrators | Update config, pause, emergency withdraw |
| `ORACLE_ROLE` | Bot/verification service | Release bounties to solvers |

## API Reference

### Unified Payment Service

The `paymentService` automatically switches between modes:

```javascript
import paymentService from './services/paymentService.js';

// Initialize (auto-detects mode from USE_BLOCKCHAIN)
await paymentService.initialize();

// Check current mode
paymentService.isBlockchainMode(); // true or false

// Get balance (works in both modes)
const balance = await paymentService.getBalance();

// Send payment (works in both modes)
const result = await paymentService.sendPayment(
  recipientAddress,
  amount,
  bountyId
);

// Validate address (pattern differs by mode)
const isValid = await paymentService.validateAddress(address);

// Get address pattern for current mode
const pattern = paymentService.getAddressPattern();
// Returns { type, pattern, example, regex }
```

### Blockchain-Only Methods

These methods only work when `USE_BLOCKCHAIN=true`:

```javascript
// Create on-chain bounty
await paymentService.createOnChainBounty(
  'owner/repo',
  issueNumber,
  issueUrl,
  amount,
  maxAmount,
  expiresAt // 0 for no expiry
);

// Escalate bounty
await paymentService.escalateOnChainBounty(bountyId, additionalAmount);

// Release bounty to solver (oracle only)
await paymentService.releaseOnChainBounty(
  bountyId,
  solverAddress,
  solverGithubLogin,
  pullRequestUrl
);

// Query on-chain bounty
const bounty = await paymentService.getOnChainBounty(bountyId);
const bounty = await paymentService.getOnChainBountyByIssue('owner/repo', issueNumber);
```

## Address Formats

| Mode | Format | Example |
|------|--------|---------|
| MNEE SDK | Bitcoin-style | `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` |
| Blockchain | Ethereum | `0x742d35Cc6634C0532925a3b844Bc9e7595f1c123` |

## Configuration Options

### BountyEscrow Contract

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minBountyAmount` | 1 MNEE | Minimum bounty size |
| `maxBountyAmount` | 1,000,000 MNEE | Maximum bounty size |
| `platformFeeBps` | 250 (2.5%) | Platform fee in basis points |

These can be updated by admins via `updateConfig()`.

## Gas Considerations

When using blockchain mode, the bot's wallet needs ETH for gas:

| Operation | Estimated Gas |
|-----------|--------------|
| Create Bounty | ~150,000 |
| Escalate Bounty | ~80,000 |
| Release Bounty | ~100,000 |
| Cancel Bounty | ~70,000 |

Monitor your bot's ETH balance and fund it as needed.

## Security Considerations

1. **Private Key Security**: Store the oracle's private key securely
2. **Role Management**: Only grant ORACLE_ROLE to trusted addresses
3. **Amount Limits**: Configure min/max bounty amounts appropriately
4. **Emergency Pause**: Admins can pause the contract if issues arise

## Testing

### Smart Contract Tests

```bash
cd bounty-hunter/contracts
npm test
```

### Payment Service Tests

```bash
cd bounty-hunter/bot
npm test -- test/paymentService.test.js
```

## Troubleshooting

### "ETHEREUM_RPC_URL not set"
Ensure your `.env` file has the RPC URL configured.

### "Insufficient gas"
Fund the bot's Ethereum wallet with ETH.

### "BountyAlreadyExists"
A bounty already exists for this repository/issue combination.

### "BountyNotActive"
The bounty has already been claimed, cancelled, or expired.

### "UnauthorizedCaller"
Only the oracle role can release bounties. Ensure the bot's address has the ORACLE_ROLE.

## Switching Modes

To switch from MNEE SDK mode to blockchain mode:

1. Deploy the BountyEscrow contract
2. Update `.env` with blockchain configuration
3. Set `USE_BLOCKCHAIN=true`
4. Restart the bot

To switch back:
1. Set `USE_BLOCKCHAIN=false`
2. Restart the bot

Note: Existing bounties in one mode won't be accessible from the other mode. Each mode maintains its own bounty state.