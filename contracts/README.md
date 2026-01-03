# FixFlow Smart Contracts

Ethereum smart contracts for the FixFlow bounty escrow system using the MNEE ERC-20 token.

## Overview

The `BountyEscrow` contract manages bounty payments on the Ethereum blockchain:

- **Create Bounties**: Lock MNEE tokens for GitHub issues
- **Escalate Bounties**: Increase bounty amounts over time
- **Release Bounties**: Pay solvers when tests pass (oracle-controlled)
- **Cancel/Expire**: Return funds if bounty is not claimed

## MNEE Token

| Network | Address |
|---------|---------|
| Ethereum Mainnet | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` |

[View on Etherscan](https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF)

## Quick Start

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your RPC URLs and private keys
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Deploy

```bash
# Sepolia testnet
npm run deploy:sepolia

# Mainnet
npm run deploy:mainnet
```

## Contract Architecture

```
contracts/
├── BountyEscrow.sol      # Main escrow contract
└── mocks/
    └── MockERC20.sol     # Mock token for testing
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

## Functions

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

## Security

- Uses OpenZeppelin's battle-tested contracts
- ReentrancyGuard on all state-changing functions
- Pausable for emergency situations
- Role-based access control
- SafeERC20 for token transfers

## Gas Estimates

| Operation | Estimated Gas |
|-----------|--------------|
| Create Bounty | ~150,000 |
| Escalate | ~80,000 |
| Release | ~100,000 |
| Cancel | ~70,000 |

## License

MIT