# Smart Contract Deployment Guide

This comprehensive guide covers deploying the FixFlow BountyEscrow smart contract to both testing (Sepolia) and production (Ethereum Mainnet) environments.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Sepolia Testnet Deployment](#sepolia-testnet-deployment)
5. [Mainnet Production Deployment](#mainnet-production-deployment)
6. [Contract Verification](#contract-verification)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Security Checklist](#security-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What Gets Deployed

| Contract | Purpose |
|----------|---------|
| `BountyEscrow` | Main escrow contract that holds bounty funds and manages payouts |
| `MockERC20` (testnet only) | Test token to simulate MNEE on testnets |

### MNEE Token Addresses

| Network | Address | Explorer |
|---------|---------|----------|
| Ethereum Mainnet | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` | [Etherscan](https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF) |
| Sepolia (Test Token) | Deployed by you | Will be generated |

---

## Prerequisites

### Required Software

```bash
# Node.js 18+ required
node --version
# v18.0.0 or higher

# npm or yarn
npm --version
```

### Required Accounts

1. **Ethereum Wallet**: A wallet with ETH for gas fees
   - Sepolia: Get free testnet ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
   - Mainnet: Actual ETH required

2. **RPC Provider Account**: 
   - [Alchemy](https://www.alchemy.com/) (recommended)
   - [Infura](https://infura.io/)
   - Or any other Ethereum RPC provider

3. **Etherscan API Key** (for contract verification):
   - Register at [Etherscan](https://etherscan.io/apis)

### Wallet Requirements

| Network | Estimated Gas | Recommended Balance |
|---------|--------------|---------------------|
| Sepolia | ~0.01 ETH | 0.05 ETH |
| Mainnet | ~0.02 ETH (varies) | 0.1 ETH |

---

## Environment Setup

### Step 1: Install Dependencies

```bash
cd bounty-hunter/contracts
npm install
```

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

### Step 3: Edit `.env` File

```bash
# Open .env and fill in your values
nano .env
```

**Required Configuration:**

```env
# ==================================
# RPC URLS (Get from Alchemy/Infura)
# ==================================

# Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Ethereum Mainnet (only needed for mainnet deployment)
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# ==================================
# DEPLOYER WALLET
# ==================================

# Private key of the deployer wallet (WITHOUT 0x prefix)
# ⚠️ NEVER COMMIT THIS FILE OR SHARE THIS KEY
DEPLOYER_PRIVATE_KEY=your_private_key_here_without_0x

# ==================================
# CONTRACT CONFIGURATION
# ==================================

# Oracle address - the bot wallet that releases bounties
# If not set, deployer address is used
ORACLE_ADDRESS=0xYourBotWalletAddress

# Fee recipient - receives platform fees
# If not set, deployer address is used
FEE_RECIPIENT_ADDRESS=0xYourFeeWalletAddress

# MNEE Token address (leave empty for Sepolia - will deploy test token)
# Mainnet: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
MNEE_TOKEN_ADDRESS=

# ==================================
# VERIFICATION
# ==================================

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### How to Export Private Key from MetaMask

1. Open MetaMask
2. Click the three dots menu on your account
3. Select "Account Details"
4. Click "Show Private Key"
5. Enter your password
6. Copy the key (remove the `0x` prefix for the .env file)

⚠️ **SECURITY WARNING**: Never share your private key. Never commit `.env` files to git.

---

## Sepolia Testnet Deployment

Sepolia is the recommended testnet for testing before mainnet deployment.

### Step 1: Get Sepolia ETH

1. Visit [Sepolia Faucet](https://sepoliafaucet.com/)
2. Or use [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
3. Enter your wallet address
4. Wait for the ETH to arrive (usually instant)

### Step 2: Deploy Test MNEE Token

Since the real MNEE token only exists on mainnet, deploy a test token first:

```bash
npm run deploy:test-token
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║           Test MNEE Token Deployment                       ║
╚════════════════════════════════════════════════════════════╝

Network: sepolia
Chain ID: 11155111
Deployer: 0xYourAddress
Balance: 0.05 ETH

📋 Token Configuration:
─────────────────────────────────────────────────────────────
  Name:            Test MNEE
  Symbol:          tMNEE
  Initial Supply:  1000000000.0 tMNEE
  Decimals:        18
─────────────────────────────────────────────────────────────

📦 Deploying MockERC20 token...
⏳ Waiting for deployment confirmation...

✅ Test Token deployed successfully!
   Address: 0xTestTokenAddress

💾 Deployment info saved to: deployments/sepolia.json
```

### Step 3: Update Environment with Test Token

Add the test token address to your `.env`:

```env
MNEE_TOKEN_ADDRESS=0xTestTokenAddressFromStep2
```

### Step 4: Deploy BountyEscrow Contract

```bash
npm run deploy:sepolia
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║            FixFlow BountyEscrow Deployment                 ║
╚════════════════════════════════════════════════════════════╝

Network: sepolia
Chain ID: 11155111
Deployer: 0xYourAddress
Balance: 0.04 ETH

📋 Deployment Parameters:
─────────────────────────────────────────────────────────────
  MNEE Token:       0xTestTokenAddress
  Admin:            0xYourAddress
  Oracle:           0xOracleAddress
  Fee Recipient:    0xFeeRecipientAddress
─────────────────────────────────────────────────────────────

📦 Deploying BountyEscrow contract...
⏳ Waiting for deployment confirmation...

✅ BountyEscrow deployed successfully!
   Address: 0xEscrowContractAddress

⏳ Waiting for 5 block confirmations...
   Confirmed!

💾 Deployment info saved to: deployments/sepolia.json

📝 To verify on Etherscan, run:
─────────────────────────────────────────────────────────────
npx hardhat verify --network sepolia 0xEscrowContractAddress "0xTestTokenAddress" "0xYourAddress" "0xOracleAddress" "0xFeeRecipientAddress"
─────────────────────────────────────────────────────────────

📋 Add to your .env files:
─────────────────────────────────────────────────────────────
# SEPOLIA Deployment
BOUNTY_ESCROW_ADDRESS=0xEscrowContractAddress
MNEE_TOKEN_ADDRESS=0xTestTokenAddress
─────────────────────────────────────────────────────────────

🎉 Deployment complete!
```

### Step 5: Verify on Etherscan (Optional but Recommended)

```bash
npm run verify:sepolia -- 0xEscrowContractAddress \
  "0xTestTokenAddress" \
  "0xYourAddress" \
  "0xOracleAddress" \
  "0xFeeRecipientAddress"
```

### Step 6: Update Bot Configuration

Add to `bounty-hunter/bot/.env`:

```env
# Blockchain Configuration
USE_BLOCKCHAIN=true
ETHEREUM_NETWORK=sepolia
BOUNTY_ESCROW_ADDRESS=0xEscrowContractAddress
MNEE_TOKEN_ADDRESS=0xTestTokenAddress
ETHEREUM_PRIVATE_KEY=your_bot_wallet_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Step 7: Update Frontend Configuration

Add to `bounty-hunter/frontend/.env.local`:

```env
NEXT_PUBLIC_USE_BLOCKCHAIN=true
NEXT_PUBLIC_ETHEREUM_NETWORK=sepolia
NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0xEscrowContractAddress
NEXT_PUBLIC_MNEE_TOKEN_ADDRESS=0xTestTokenAddress
```

---

## Mainnet Production Deployment

⚠️ **PRODUCTION DEPLOYMENT CHECKLIST**

Before deploying to mainnet, ensure:

- [ ] Contract has been thoroughly tested on Sepolia
- [ ] All unit tests pass
- [ ] Security audit completed (recommended)
- [ ] Multi-sig wallet configured for admin role (recommended)
- [ ] Oracle wallet is secure and backed up
- [ ] Fee recipient wallet is correct
- [ ] Sufficient ETH for gas fees
- [ ] Team has reviewed deployment parameters

### Step 1: Configure for Mainnet

Update your `.env`:

```env
# Use the real MNEE token
MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# Oracle wallet (bot) - must be secure and backed up
ORACLE_ADDRESS=0xYourProductionBotWallet

# Fee recipient - treasury or multi-sig wallet
FEE_RECIPIENT_ADDRESS=0xYourTreasuryWallet
```

### Step 2: Final Pre-Deployment Verification

```bash
# Run tests one more time
npm test

# Verify compilation
npm run compile
```

### Step 3: Deploy to Mainnet

```bash
npm run deploy:mainnet
```

The script will:
1. Display deployment parameters
2. Wait 5 seconds for confirmation (cancel with Ctrl+C if incorrect)
3. Deploy the contract
4. Wait for 5 block confirmations
5. Save deployment info

### Step 4: Verify on Mainnet Etherscan

```bash
npm run verify:mainnet -- 0xMainnetEscrowAddress \
  "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF" \
  "0xAdminAddress" \
  "0xOracleAddress" \
  "0xFeeRecipientAddress"
```

### Step 5: Update Production Configuration

**Bot `.env`:**
```env
USE_BLOCKCHAIN=true
ETHEREUM_NETWORK=mainnet
BOUNTY_ESCROW_ADDRESS=0xMainnetEscrowAddress
MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
ETHEREUM_PRIVATE_KEY=your_production_bot_private_key
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_USE_BLOCKCHAIN=true
NEXT_PUBLIC_ETHEREUM_NETWORK=mainnet
NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0xMainnetEscrowAddress
NEXT_PUBLIC_MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
```

---

## Contract Verification

### Automated Verification

The deployment script provides the exact verification command. Example:

```bash
npx hardhat verify --network sepolia 0xContractAddress \
  "0xTokenAddress" \
  "0xAdminAddress" \
  "0xOracleAddress" \
  "0xFeeRecipientAddress"
```

### Manual Verification

If automated verification fails:

1. Go to [Etherscan](https://etherscan.io/) (or [Sepolia Etherscan](https://sepolia.etherscan.io/))
2. Find your contract address
3. Click "Contract" tab → "Verify and Publish"
4. Select:
   - Compiler Type: Solidity (Single file)
   - Compiler Version: v0.8.20
   - License Type: MIT
5. Paste the flattened source code:
   ```bash
   npx hardhat flatten contracts/BountyEscrow.sol > BountyEscrow_flattened.sol
   ```
6. Enter constructor arguments (ABI-encoded)

---

## Post-Deployment Configuration

### 1. Grant Oracle Role (if needed)

If deploying from a different wallet than the bot:

```javascript
// Using ethers.js
const escrow = await ethers.getContractAt("BountyEscrow", escrowAddress);
const ORACLE_ROLE = await escrow.ORACLE_ROLE();
await escrow.grantRole(ORACLE_ROLE, botWalletAddress);
```

### 2. Update Platform Fee (Optional)

Default is 2.5% (250 basis points). To change:

```javascript
// Set to 3% (300 basis points)
await escrow.updateConfig(
  minBountyAmount,
  maxBountyAmount,
  300, // platformFeeBps
  feeRecipientAddress
);
```

### 3. Test a Bounty

After deployment, create a test bounty:

```javascript
// Approve MNEE tokens
const mnee = await ethers.getContractAt("IERC20", mneeTokenAddress);
await mnee.approve(escrowAddress, ethers.parseUnits("100", 18));

// Create bounty
await escrow.createBounty(
  "owner/repo",
  123, // issue ID
  "https://github.com/owner/repo/issues/123",
  ethers.parseUnits("100", 18), // amount
  ethers.parseUnits("200", 18), // max amount
  Math.floor(Date.now() / 1000) + 86400 * 30 // expires in 30 days
);
```

---

## Security Checklist

### Before Deployment

- [ ] Private keys stored securely (never in code)
- [ ] `.env` files added to `.gitignore`
- [ ] Contract code reviewed for vulnerabilities
- [ ] Unit tests all passing
- [ ] Gas estimates acceptable

### After Deployment

- [ ] Contract verified on Etherscan
- [ ] Admin role secured (consider multi-sig)
- [ ] Oracle role assigned to correct address
- [ ] Fee recipient configured correctly
- [ ] Test transaction successful
- [ ] Monitoring set up for contract events

### Production Recommendations

1. **Multi-Sig Admin**: Use a multi-sig wallet (e.g., Gnosis Safe) for admin role
2. **Hardware Wallet**: Use hardware wallet for oracle/bot operations
3. **Rate Limiting**: Implement rate limiting in the bot
4. **Monitoring**: Set up alerts for contract events
5. **Backup**: Secure backup of all private keys

---

## Troubleshooting

### Common Issues

#### "Insufficient funds for gas"

```
Error: insufficient funds for intrinsic transaction cost
```

**Solution**: Add more ETH to your deployer wallet.

#### "Nonce too low"

```
Error: nonce has already been used
```

**Solution**: 
- Wait for pending transactions to complete
- Or reset nonce in MetaMask (Settings → Advanced → Reset Account)

#### "Contract verification failed"

**Solutions**:
1. Ensure compiler version matches exactly (v0.8.20)
2. Check constructor arguments are correct
3. Wait a few minutes after deployment before verifying
4. Try manual verification on Etherscan

#### "Cannot estimate gas"

**Solutions**:
1. Check if MNEE_TOKEN_ADDRESS is valid
2. Ensure all addresses are valid Ethereum addresses
3. Verify you have approve() for the token

### Getting Help

1. Check [Hardhat documentation](https://hardhat.org/docs)
2. Check [Ethers.js documentation](https://docs.ethers.org/)
3. Open an issue in the repository

---

## Deployment Checklist Summary

### Sepolia (Testing)

```bash
# 1. Install dependencies
cd bounty-hunter/contracts && npm install

# 2. Configure .env
cp .env.example .env
# Edit .env with your keys

# 3. Deploy test token
npm run deploy:test-token

# 4. Update .env with test token address
# MNEE_TOKEN_ADDRESS=0x...

# 5. Deploy escrow contract
npm run deploy:sepolia

# 6. Verify contract
npm run verify:sepolia -- 0xAddress "arg1" "arg2" "arg3" "arg4"

# 7. Update bot and frontend configs
```

### Mainnet (Production)

```bash
# 1. Complete all Sepolia testing first!

# 2. Configure .env for mainnet
# MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

# 3. Run final tests
npm test

# 4. Deploy to mainnet
npm run deploy:mainnet

# 5. Verify contract
npm run verify:mainnet -- 0xAddress "arg1" "arg2" "arg3" "arg4"

# 6. Update production configs

# 7. Test with small bounty first
```

---

## Reference

### Contract Addresses Template

| Environment | Contract | Address |
|-------------|----------|---------|
| Mainnet | BountyEscrow | `0x...` |
| Mainnet | MNEE Token | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` |
| Sepolia | BountyEscrow | `0x...` |
| Sepolia | Test MNEE | `0x...` |

### Gas Estimates

| Operation | Estimated Gas | Cost @ 30 gwei |
|-----------|--------------|----------------|
| Deploy Escrow | ~2,500,000 | ~0.075 ETH |
| Deploy Test Token | ~1,500,000 | ~0.045 ETH |
| Create Bounty | ~150,000 | ~0.0045 ETH |
| Release Bounty | ~100,000 | ~0.003 ETH |

### Useful Links

- [MNEE Token on Etherscan](https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Alchemy Dashboard](https://dashboard.alchemy.com/)
- [Hardhat Documentation](https://hardhat.org/docs)