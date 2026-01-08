# FixFlow Smart Contracts

Ethereum smart contracts for the FixFlow bounty escrow system using the MNEE ERC-20 token.

## Overview

The `BountyEscrow` contract manages bounty payments on the Ethereum blockchain:

- **Create Bounties**: Lock MNEE tokens for GitHub issues
- **Escalate Bounties**: Increase bounty amounts over time
- **Release Bounties**: Pay solvers when tests pass (oracle-controlled)
- **Cancel/Expire**: Return funds if bounty is not claimed

## MNEE Token

| Network | Address | Explorer |
|---------|---------|----------|
| Ethereum Mainnet | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` | [Etherscan](https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF) |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# RPC URLs (get from Alchemy or Infura)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Deployer private key (without 0x prefix)
DEPLOYER_PRIVATE_KEY=your_private_key

# Oracle address (bot wallet that releases bounties)
ORACLE_ADDRESS=0xYourBotWallet

# Fee recipient
FEE_RECIPIENT_ADDRESS=0xYourTreasuryWallet

# Etherscan API for verification
ETHERSCAN_API_KEY=your_etherscan_key
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Run Tests

```bash
npm test
```

## Deployment

📖 **For comprehensive deployment instructions, see [SMART_CONTRACT_DEPLOYMENT.md](../docs/SMART_CONTRACT_DEPLOYMENT.md)**

### Quick Deploy to Sepolia (Testing)

```bash
# Step 1: Deploy test MNEE token
npm run deploy:test-token

# Step 2: Add token address to .env
# MNEE_TOKEN_ADDRESS=0x...

# Step 3: Deploy escrow contract
npm run deploy:sepolia

# Step 4: Verify on Etherscan
npm run verify:sepolia -- 0xContractAddress "arg1" "arg2" "arg3" "arg4"
```

### Quick Deploy to Mainnet (Production)

```bash
# Ensure .env has:
# MNEE_TOKEN_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF

npm run deploy:mainnet
npm run verify:mainnet -- 0xContractAddress "arg1" "arg2" "arg3" "arg4"
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile contracts |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run deploy:local` | Deploy to local Hardhat network |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm run deploy:mainnet` | Deploy to Ethereum mainnet |
| `npm run deploy:test-token` | Deploy test MNEE token (Sepolia only) |
| `npm run verify:sepolia` | Verify contract on Sepolia Etherscan |
| `npm run verify:mainnet` | Verify contract on Mainnet Etherscan |
| `npm run node` | Start local Hardhat node |
| `npm run clean` | Clean build artifacts |

## Contract Architecture

```
contracts/
├── BountyEscrow.sol      # Main escrow contract
└── mocks/
    └── MockERC20.sol     # Test token for testnets
scripts/
├── deploy.js             # Main deployment script
└── deploy-test-token.js  # Test token deployment
deployments/              # Deployment artifacts (auto-generated)
└── sepolia.json
└── mainnet.json
```

## Roles

| Role | Description |
|------|-------------|
| `DEFAULT_ADMIN_ROLE` | Full admin, can grant/revoke roles |
| `ADMIN_ROLE` | Can update config, pause, emergency withdraw |
| `ORACLE_ROLE` | Can release bounties to solvers (assigned to bot) |

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minBountyAmount` | 1 MNEE | Minimum bounty |
| `maxBountyAmount` | 1M MNEE | Maximum bounty |
| `platformFeeBps` | 250 | Platform fee (2.5%) |

## Contract Functions

### For Bounty Creators

```solidity
// Create a new bounty
function createBounty(
    string repository,
    uint256 issueId,
    string issueUrl,
    uint256 amount,
    uint256 maxAmount,
    uint256 expiresAt
) returns (uint256 bountyId)

// Add more funds to a bounty
function escalateBounty(uint256 bountyId, uint256 additionalAmount)

// Cancel and get refund
function cancelBounty(uint256 bountyId)

// Claim expired bounty refund
function claimExpiredBounty(uint256 bountyId)
```

### For Oracle (Bot)

```solidity
// Release payment to solver
function releaseBounty(
    uint256 bountyId,
    address solver,
    string solverGithubLogin,
    string pullRequestUrl
)
```

### View Functions

```solidity
function getBounty(uint256 bountyId) returns (Bounty)
function getBountyByIssue(string repository, uint256 issueId) returns (Bounty)
function getCreatorBounties(address creator) returns (uint256[])
function getSolverBounties(address solver) returns (uint256[])
```

## Events

```solidity
event BountyCreated(bountyId, creator, repository, issueId, amount, maxAmount)
event BountyEscalated(bountyId, oldAmount, newAmount, escalationCount)
event BountyClaimed(bountyId, solver, solverGithubLogin, amount, platformFee, pullRequestUrl)
event BountyCancelled(bountyId, creator, refundedAmount)
event BountyExpired(bountyId, refundedAmount)
```

## Security Features

- ✅ OpenZeppelin battle-tested contracts
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Pausable for emergency situations
- ✅ Role-based access control
- ✅ SafeERC20 for token transfers
- ✅ Input validation and bounds checking

## Gas Estimates

| Operation | Estimated Gas | Cost @ 30 gwei |
|-----------|--------------|----------------|
| Deploy Contract | ~2,500,000 | ~0.075 ETH |
| Create Bounty | ~150,000 | ~0.0045 ETH |
| Escalate | ~80,000 | ~0.0024 ETH |
| Release | ~100,000 | ~0.003 ETH |
| Cancel | ~70,000 | ~0.0021 ETH |

## Testing

Run the full test suite:

```bash
npm test
```

Run with gas reporting:

```bash
REPORT_GAS=true npm test
```

Run with coverage:

```bash
npm run test:coverage
```

## Documentation

- [Smart Contract Deployment Guide](../docs/SMART_CONTRACT_DEPLOYMENT.md) - Detailed deployment instructions
- [Blockchain Integration](../docs/BLOCKCHAIN_INTEGRATION.md) - How the bot interacts with contracts
- [API Reference](../docs/API_REFERENCE.md) - Full API documentation

## License

MIT