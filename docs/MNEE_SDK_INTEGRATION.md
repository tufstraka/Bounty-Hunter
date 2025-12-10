# MNEE SDK Integration Guide

This document provides comprehensive details on how the FixFlow system integrates with the MNEE SDK for payment processing.

## Table of Contents
- [Overview](#overview)
- [Setup](#setup)
- [Core Operations](#core-operations)
- [Balance Management](#balance-management)
- [Payment Processing](#payment-processing)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

The FixFlow system uses the MNEE SDK to:
- Check bot wallet balances
- Send automatic payments to developers
- Validate MNEE addresses
- Monitor transaction status

## Setup

### 1. Install MNEE SDK

```bash
npm install @mnee/sdk
```

### 2. Environment Configuration

Configure your `.env` file with MNEE credentials:

```env
# MNEE Configuration
MNEE_ENVIRONMENT=production    # or 'sandbox' for testing
MNEE_API_KEY=your_api_key_here
MNEE_BOT_ADDRESS=1YourMNEEWalletAddress...
MNEE_BOT_WIF=LYourPrivateKeyInWIFFormat...
```

### 3. Initialize MNEE Service

The MNEE service is initialized in `bot/src/services/mnee.js`:

```javascript
const { MNEE } = require('@mnee/sdk');

class MneeService {
  constructor() {
    this.mnee = null;
    this.config = null;
  }

  async initialize() {
    const environment = process.env.MNEE_ENVIRONMENT || 'sandbox';
    const apiKey = process.env.MNEE_API_KEY;
    
    this.mnee = new MNEE({
      apiKey,
      environment
    });
    
    // Fetch configuration
    this.config = await this.mnee.config();
    
    // Verify wallet has funds
    const balance = await this.getBalance();
    console.log(`MNEE wallet balance: ${balance.decimalAmount} MNEE`);
  }
}
```

## Core Operations

### 1. Check Balance

Check the bot's MNEE wallet balance:

```javascript
async getBalance() {
  const address = process.env.MNEE_BOT_ADDRESS;
  const balance = await this.mnee.balance(address);
  
  return {
    address: balance.address,
    balance: balance.decimalAmount,
    atomicUnits: balance.amount
  };
}
```

#### Balance Response Format:
```json
{
  "address": "1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3",
  "amount": 461163,
  "decimalAmount": 4.61163
}
```

### 2. Send Payment

Send MNEE payment to a developer who fixed a bug:

```javascript
async sendPayment(recipientAddress, amountMNEE, bountyId) {
  const wif = process.env.MNEE_BOT_WIF;
  
  // Validate inputs
  if (!this.validateAddress(recipientAddress)) {
    throw new Error('Invalid MNEE address');
  }
  
  if (amountMNEE <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  // Check sufficient balance
  const balance = await this.getBalance();
  if (balance.balance < amountMNEE) {
    throw new Error(`Insufficient balance. Have ${balance.balance}, need ${amountMNEE} MNEE`);
  }
  
  // Create and send transfer
  const recipients = [{
    address: recipientAddress,
    amount: amountMNEE
  }];
  
  const response = await this.mnee.transfer(recipients, wif, {
    broadcast: true,
    callbackUrl: `${process.env.BOT_URL}/webhooks/mnee-status`
  });
  
  // Monitor transaction status
  const status = await this.waitForConfirmation(response.ticketId);
  
  return {
    ticketId: response.ticketId,
    txid: status.tx_id,
    amount: amountMNEE,
    recipient: recipientAddress,
    bountyId: bountyId
  };
}
```

### 3. Address Validation

Validate MNEE addresses before processing:

```javascript
validateAddress(address) {
  // MNEE uses Bitcoin-style addresses
  const mneeAddressRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  return mneeAddressRegex.test(address);
}
```

### 4. Transaction Status Monitoring

Monitor transaction status until confirmation:

```javascript
async waitForConfirmation(ticketId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await this.mnee.getTxStatus(ticketId);
    
    if (status.status === 'SUCCESS' || status.status === 'MINED') {
      return status;
    }
    
    if (status.status === 'FAILED') {
      throw new Error(`Transaction failed: ${status.errors}`);
    }
    
    // Wait 2 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Transaction timeout after 60 seconds');
}
```

## Balance Management

### Check Multiple Addresses

For monitoring multiple wallets or addresses:

```javascript
async checkMultipleBalances(addresses) {
  const balances = await this.mnee.balances(addresses);
  
  // Calculate total
  const totalBalance = balances.reduce((sum, b) => sum + b.decimalAmount, 0);
  
  return {
    balances: balances.map(b => ({
      address: b.address,
      balance: b.decimalAmount
    })),
    total: totalBalance
  };
}
```

### Monitor Balance Changes

Set up balance monitoring for the bot wallet:

```javascript
async monitorBalance(intervalMs = 60000) {
  let previousBalance = 0;
  
  setInterval(async () => {
    try {
      const balance = await this.getBalance();
      
      if (balance.balance !== previousBalance) {
        console.log(`Balance changed: ${previousBalance} → ${balance.balance} MNEE`);
        
        // Alert if balance is low
        if (balance.balance < 10) {
          console.warn('⚠️ Low MNEE balance! Please refill bot wallet.');
        }
        
        previousBalance = balance.balance;
      }
    } catch (error) {
      console.error('Balance check failed:', error);
    }
  }, intervalMs);
}
```

## Payment Processing

### 1. Extract MNEE Address from PR

Extract MNEE address from pull request comments:

```javascript
function extractMneeAddress(text) {
  // Look for MNEE address patterns
  const patterns = [
    /mnee:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i,
    /MNEE:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i,
    /address:\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}
```

### 2. Process Bounty Payment

Complete payment flow for a claimed bounty:

```javascript
async processBountyPayment(bounty, solverAddress) {
  try {
    // 1. Send payment
    const payment = await this.sendPayment(
      solverAddress,
      bounty.currentAmount,
      bounty.bountyId
    );
    
    // 2. Update bounty in database
    await bountyService.claimBounty(
      bounty.bountyId,
      solverAddress,
      payment.txid
    );
    
    // 3. Update database record
    await db.query(
      'UPDATE bounties SET state = $1, solver_address = $2, payment_tx_id = $3, claimed_at = $4 WHERE bounty_id = $5',
      ['claimed', solverAddress, payment.txid, new Date(), bounty.bountyId]
    );
    
    // 4. Post GitHub comment
    await githubService.postComment(bounty.repository, bounty.issueId, 
      `✅ Bounty claimed! ${bounty.currentAmount} MNEE sent to ${solverAddress}\n` +
      `Transaction: ${payment.txid}`
    );
    
    return payment;
  } catch (error) {
    // Handle payment failure
    await githubService.postComment(bounty.repository, bounty.issueId,
      `❌ Payment failed: ${error.message}\n` +
      `Please contact support with bounty ID: ${bounty.bountyId}`
    );
    
    throw error;
  }
}
```

### 3. Batch Payments

Process multiple bounty payments efficiently:

```javascript
async processBatchPayments(bounties) {
  const payments = bounties.map(b => ({
    address: b.solverAddress,
    amount: b.currentAmount
  }));
  
  const wif = process.env.MNEE_BOT_WIF;
  
  // Send all payments in one transaction
  const response = await this.mnee.transfer(payments, wif);
  
  // Wait for confirmation
  const status = await this.waitForConfirmation(response.ticketId);
  
  // Update all bounties in database
  for (const bounty of bounties) {
    await db.query(
      'UPDATE bounties SET state = $1, solver_address = $2, payment_tx_id = $3, claimed_at = $4 WHERE bounty_id = $5',
      ['claimed', bounty.solverAddress, status.tx_id, new Date(), bounty.bountyId]
    );
  }
  
  return status.tx_id;
}
```

## Error Handling

### Common MNEE Errors

Handle MNEE-specific errors gracefully:

```javascript
async handleMneeError(error) {
  const errorHandlers = {
    'Config not fetched': 'Failed to initialize MNEE configuration',
    'Invalid API key': 'MNEE API authentication failed',
    'Insufficient MNEE balance': 'Bot wallet has insufficient funds',
    'Invalid amount': 'Payment amount must be greater than 0',
    'Failed to broadcast transaction': 'Transaction rejected by network',
    'Transaction timeout': 'Transaction confirmation took too long'
  };
  
  for (const [errorPattern, message] of Object.entries(errorHandlers)) {
    if (error.message.includes(errorPattern)) {
      console.error(`MNEE Error: ${message}`);
      return { error: message, retryable: errorPattern !== 'Invalid API key' };
    }
  }
  
  console.error('Unknown MNEE error:', error);
  return { error: error.message, retryable: false };
}
```

### Retry Logic

Implement retry logic for transient failures:

```javascript
async sendPaymentWithRetry(recipientAddress, amount, bountyId, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.sendPayment(recipientAddress, amount, bountyId);
    } catch (error) {
      lastError = error;
      const { retryable } = await this.handleMneeError(error);
      
      if (!retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

## Best Practices

### 1. Security

- **Never log private keys**: Use environment variables
- **Validate all addresses**: Before sending payments
- **Implement rate limiting**: Prevent abuse
- **Use webhook authentication**: Verify webhook signatures

### 2. Reliability

- **Monitor wallet balance**: Alert when low
- **Implement retry logic**: Handle transient failures
- **Use webhooks**: For async transaction updates
- **Log all transactions**: For audit trail

### 3. Performance

- **Cache configuration**: Reduce API calls
- **Batch payments**: When possible
- **Use appropriate timeouts**: Don't wait forever
- **Monitor API rate limits**: Stay within limits

### 4. User Experience

- **Provide clear instructions**: How to add MNEE address
- **Show transaction status**: Keep users informed
- **Handle errors gracefully**: Helpful error messages
- **Provide support contact**: For payment issues

## Webhook Integration

### Setup Webhook Endpoint

```javascript
// routes/webhook.js
router.post('/mnee-status', async (req, res) => {
  try {
    const { ticketId, status, tx_id, errors } = req.body;
    
    // Find bounty by payment ticket ID
    const bounty = await db.query(
      'SELECT * FROM bounties WHERE payment_ticket_id = $1',
      [ticketId]
    );
    
    if (!bounty.rows[0]) {
      return res.status(404).json({ error: 'Bounty not found' });
    }
    
    // Update based on status
    if (status === 'SUCCESS' || status === 'MINED') {
      await db.query(
        'UPDATE bounties SET payment_status = $1, payment_tx_id = $2 WHERE id = $3',
        ['confirmed', tx_id, bounty.rows[0].id]
      );
      
      // Notify on GitHub
      await githubService.postComment(
        bounty.rows[0].repository,
        bounty.rows[0].issue_id,
        `✅ Payment confirmed! TX: ${tx_id}`
      );
    } else if (status === 'FAILED') {
      await db.query(
        'UPDATE bounties SET payment_status = $1, payment_errors = $2 WHERE id = $3',
        ['failed', errors, bounty.rows[0].id]
      );
      
      // Notify failure
      await githubService.postComment(
        bounty.rows[0].repository,
        bounty.rows[0].issue_id,
        `❌ Payment failed. Please contact support.`
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});
```

## Testing

### 1. Use Sandbox Environment

For development and testing:

```env
MNEE_ENVIRONMENT=sandbox
MNEE_API_KEY=your_sandbox_api_key
```

### 2. Test Payment Flow

```javascript
async function testPaymentFlow() {
  const testAddress = '1TestAddressFromSandbox...';
  const testAmount = 0.1; // Small amount for testing
  
  try {
    // Check balance
    const balance = await mneeService.getBalance();
    console.log('Balance:', balance);
    
    // Send payment
    const payment = await mneeService.sendPayment(
      testAddress,
      testAmount,
      'test-bounty-1'
    );
    
    console.log('Payment sent:', payment);
  } catch (error) {
    console.error('Test failed:', error);
  }
}
```

## Troubleshooting

### Common Issues

1. **Invalid API Key**
   - Verify API key in environment
   - Check environment (sandbox vs production)
   - Ensure API key has necessary permissions

2. **Insufficient Balance**
   - Check wallet balance
   - Ensure wallet is funded
   - Consider transaction fees

3. **Transaction Timeouts**
   - Increase timeout duration
   - Check network status
   - Implement proper retry logic

4. **Invalid Addresses**
   - Validate address format
   - Ensure address is for correct network
   - Check for typos

## See Also

- [MNEE SDK Documentation](https://docs.mnee.io)
- [FixFlow Architecture](./bounty-hunter-architecture.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [GitHub Integration](./GITHUB_INTEGRATION.md)