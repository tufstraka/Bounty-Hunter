# FixFlow API Reference

## Table of Contents
- [Authentication](#authentication)
- [Bounty Endpoints](#bounty-endpoints)
- [Webhook Endpoints](#webhook-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Error Responses](#error-responses)

## Authentication

All API endpoints require authentication using a bearer token:

```bash
Authorization: Bearer YOUR_API_TOKEN
```

## Bounty Endpoints

### Create Bounty

Creates a new bounty for a failed test.

**POST** `/api/bounties`

#### Request Body
```json
{
  "repository": "owner/repo",
  "issueId": 123,
  "issueUrl": "https://github.com/owner/repo/issues/123",
  "amount": 50,
  "maxAmount": 150,
  "metadata": {
    "testName": "test_user_authentication",
    "errorType": "AssertionError",
    "severity": "high"
  }
}
```

#### Response
```json
{
  "success": true,
  "bountyId": 1,
  "amount": 50,
  "maxAmount": 150
}
```

### Get Bounty Details

Retrieves details for a specific bounty.

**GET** `/api/bounties/:bountyId`

#### Response
```json
{
  "bountyId": 1,
  "repository": "owner/repo",
  "issueId": 123,
  "issueUrl": "https://github.com/owner/repo/issues/123",
  "initialAmount": 50,
  "currentAmount": 60,
  "maxAmount": 150,
  "state": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "lastEscalation": "2024-01-02T00:00:00Z",
  "escalationCount": 1,
  "claimed": false,
  "solver": null,
  "paymentTxId": null
}
```

### List Repository Bounties

Lists all bounties for a specific repository.

**GET** `/api/bounties/repository/:owner/:repo`

#### Query Parameters
- `status` (optional): Filter by status (`active`, `claimed`, `all`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

#### Response
```json
{
  "bounties": [
    {
      "bountyId": 1,
      "repository": "owner/repo",
      "issueId": 123,
      "currentAmount": 60,
      "state": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Claim Bounty (Internal Use)

Claims a bounty after tests pass. This is typically called internally by the webhook system.

**POST** `/api/bounties/:bountyId/claim`

#### Request Body
```json
{
  "solver": "1MNEEAddress...",
  "pullRequestUrl": "https://github.com/owner/repo/pull/456"
}
```

#### Response
```json
{
  "success": true,
  "amount": 60,
  "paymentTxId": "mnee_tx_123abc",
  "solver": "1MNEEAddress..."
}
```

### Escalate Bounty

Manually escalates a bounty amount.

**POST** `/api/bounties/:bountyId/escalate`

#### Response
```json
{
  "success": true,
  "oldAmount": 50,
  "newAmount": 60,
  "escalationCount": 1
}
```

### Get Wallet Balance

Gets the current MNEE balance of the bot wallet.

**GET** `/api/bounties/wallet/balance`

#### Response
```json
{
  "balance": 1000.50,
  "address": "1BotWalletAddress...",
  "currency": "MNEE"
}
```

## Webhook Endpoints

### GitHub Webhook

Receives events from GitHub for PR monitoring.

**POST** `/webhooks/github`

#### Headers
- `X-GitHub-Event`: Event type (e.g., `pull_request`)
- `X-Hub-Signature-256`: HMAC signature for verification

#### Request Body
Standard GitHub webhook payload for pull request events.

### Create Bounty Webhook

Called by GitHub Actions to create a bounty for failed tests.

**POST** `/webhooks/create-bounty`

#### Request Body
```json
{
  "repository": "owner/repo",
  "runId": 123456789,
  "jobName": "test",
  "failureUrl": "https://github.com/owner/repo/actions/runs/123456789",
  "issueNumber": 123,
  "issueUrl": "https://github.com/owner/repo/issues/123",
  "errorLog": "Test output...",
  "testFile": "tests/test_auth.py",
  "testName": "test_user_login",
  "bountyAmount": 50,
  "maxAmount": 150
}
```

### MNEE Status Webhook

Receives transaction status updates from MNEE.

**POST** `/webhooks/mnee-status`

#### Request Body
```json
{
  "ticketId": "abc123",
  "status": "SUCCESS",
  "tx_id": "transaction123",
  "errors": null
}
```

## Admin Endpoints

### Get System Metrics

Retrieves overall system metrics.

**GET** `/api/admin/metrics`

#### Response
```json
{
  "bounties": {
    "total": 150,
    "active": 25,
    "claimed": 125,
    "success_rate": "83.33%"
  },
  "tokens": {
    "totalPaid": 12500,
    "pendingBounties": 2500,
    "wallet_balance": 5000.75,
    "wallet_address": "1BotWalletAddress..."
  },
  "database": {
    "bountyCount": 150,
    "totalValue": 15000,
    "avgBountyValue": 100
  },
  "system": {
    "uptime": 864000,
    "memory": {
      "rss": 104857600,
      "heapTotal": 73728000,
      "heapUsed": 45678900
    },
    "node_version": "v18.0.0"
  }
}
```

### List All Bounties

Lists all bounties with admin details.

**GET** `/api/admin/bounties`

#### Query Parameters
- `state`: Filter by state
- `repository`: Filter by repository
- `page`: Page number
- `limit`: Items per page

### Get Repository Statistics

Gets detailed statistics for each repository.

**GET** `/api/admin/repositories`

#### Response
```json
[
  {
    "repository": "owner/repo",
    "total": 50,
    "active": 5,
    "claimed": 45,
    "totalPaid": 2250,
    "pendingValue": 250,
    "success_rate": 90
  }
]
```

### Get Eligible Bounties for Escalation

Lists bounties eligible for escalation.

**GET** `/api/admin/escalation/eligible`

#### Response
```json
[
  {
    "bountyId": 1,
    "repository": "owner/repo",
    "issueId": 123,
    "currentAmount": 50,
    "maxAmount": 150,
    "hoursElapsed": 25,
    "lastEscalation": null,
    "escalationCount": 0
  }
]
```

### Trigger Escalation Check

Manually triggers the escalation check process.

**POST** `/api/admin/escalation/check`

#### Response
```json
{
  "checked": 10,
  "escalated": 3,
  "failed": 0
}
```

### Manually Escalate Bounty

Manually escalates a specific bounty.

**POST** `/api/admin/bounties/:bountyId/escalate`

### Get Top Contributors

Lists top contributors by MNEE earned.

**GET** `/api/admin/contributors`

#### Response
```json
[
  {
    "solver": "1ContributorAddress...",
    "bounties_claimed": 15,
    "total_earned": 750.50,
    "repositories_count": 5
  }
]
```

### Export Bounty Data

Exports bounty data in JSON or CSV format.

**GET** `/api/admin/export`

#### Query Parameters
- `format`: Export format (`json` or `csv`)
- `state`: Filter by state

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "Missing required fields: repository, issueId"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or missing authorization token"
}
```

### 404 Not Found
```json
{
  "error": "Bounty not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to create bounty",
  "message": "Detailed error message"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Standard endpoints**: 100 requests per minute
- **Admin endpoints**: 50 requests per minute
- **Webhook endpoints**: 1000 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

## CORS

The API supports CORS for the admin dashboard. Allowed origins:
- `http://localhost:3000` (development)
- `https://fixflow.locsafe.org` (production)

## Webhooks Security

### GitHub Webhooks
- Verify `X-Hub-Signature-256` header
- Use webhook secret from environment

### MNEE Webhooks
- Verify source IP is from MNEE
- Validate transaction data

## Example Usage

### Create a Bounty (GitHub Action)
```bash
curl -X POST https://fixflow-api.locsafe.org/webhooks/create-bounty \
  -H "Authorization: Bearer ${{ secrets.BOUNTY_HUNTER_TOKEN }}" \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "owner/repo",
    "runId": 123456789,
    "issueNumber": 123,
    "bountyAmount": 50
  }'
```

### Check Bounty Status
```bash
curl https://fixflow-api.locsafe.org/api/bounties/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Monitor System Health
```bash
curl https://fixflow-api.locsafe.org/api/admin/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"