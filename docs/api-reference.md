# ShipScope API Reference

Base URL: `http://localhost:4000/api`

All endpoints return JSON. Errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

## Authentication

Most endpoints do not require authentication (single-tenant deployment).
Webhook endpoints require an API key via the `X-API-Key` header.

---

## Health

### GET /api/health

Check API and dependency status.

**Response 200:**

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "db": { "status": "connected", "latencyMs": 2 },
    "redis": { "status": "connected", "latencyMs": 1 }
  }
}
```

---

## Feedback

### GET /api/feedback

List feedback items with pagination and filtering.

**Query Parameters:**

| Param       | Type   | Default     | Description                 |
| ----------- | ------ | ----------- | --------------------------- |
| `limit`     | number | 50          | Items per page (max 100)    |
| `offset`    | number | 0           | Pagination offset           |
| `channel`   | string | —           | Filter by channel           |
| `sentiment` | string | —           | Filter by sentiment range   |
| `search`    | string | —           | Full-text search in content |
| `sort`      | string | `createdAt` | Sort field                  |
| `order`     | string | `desc`      | Sort order (asc, desc)      |

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "content": "The onboarding flow is confusing",
      "channel": "support_ticket",
      "sentiment": -0.6,
      "urgency": 0.8,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Example:**

```bash
curl "http://localhost:4000/api/feedback?limit=10&sort=urgency&order=desc"
```

### POST /api/feedback

Create a single feedback item.

**Request Body:**

```json
{
  "content": "I wish there was a dark mode option",
  "channel": "manual",
  "metadata": {
    "customer": "user@example.com"
  }
}
```

**Response 201:**

```json
{
  "data": {
    "id": "clx...",
    "content": "I wish there was a dark mode option",
    "channel": "manual",
    "sentiment": null,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /api/feedback/import/csv

Import feedback from a CSV file.

**Request:** `multipart/form-data`

| Field  | Type | Description         |
| ------ | ---- | ------------------- |
| `file` | File | CSV file (max 10MB) |

**Response 200:**

```json
{
  "data": {
    "imported": 150,
    "sourceId": "clx..."
  }
}
```

---

## Themes

### GET /api/synthesis/themes

List AI-generated themes sorted by feedback count.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Onboarding Friction",
      "description": "Users report confusion during initial setup...",
      "feedbackCount": 23,
      "avgSentiment": -0.45,
      "category": "ux_issue",
      "opportunityScore": 85.2,
      "createdAt": "2024-01-15T12:00:00.000Z"
    }
  ],
  "total": 8
}
```

### GET /api/synthesis/themes/:id

Get a single theme with linked feedback items.

---

## Proposals

### GET /api/proposals

List feature proposals sorted by RICE score.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Simplify onboarding wizard",
      "problem": "...",
      "solution": "...",
      "riceScore": 85.5,
      "reachScore": 90,
      "impactScore": 3,
      "confidenceScore": 80,
      "effortScore": 2,
      "status": "proposed",
      "themeId": "clx...",
      "createdAt": "2024-01-15T13:00:00.000Z"
    }
  ],
  "total": 5
}
```

### POST /api/proposals/generate

Generate proposals from the top themes.

**Response 201:**

```json
{
  "data": {
    "generated": 5,
    "proposals": [...]
  }
}
```

### PATCH /api/proposals/:id

Update a proposal's RICE scores or status.

**Request Body:**

```json
{
  "reachScore": 95,
  "impactScore": 3,
  "confidenceScore": 85,
  "effortScore": 2,
  "status": "approved"
}
```

---

## Specs

### POST /api/specs/generate/:proposalId

Generate a PRD spec from an approved proposal.

**Response 201:**

```json
{
  "data": {
    "id": "clx...",
    "proposalId": "clx...",
    "prdMarkdown": "# PRD: Simplify Onboarding...",
    "version": 1
  }
}
```

### GET /api/specs/:id/agent-prompt

Get an agent-ready prompt for a spec.

**Query Parameters:**

| Param    | Type   | Default  | Description               |
| -------- | ------ | -------- | ------------------------- |
| `format` | string | `cursor` | `cursor` or `claude_code` |

---

## Synthesis

### POST /api/synthesis/run

Trigger the AI synthesis pipeline (embedding, clustering, theme extraction, proposals).

**Response 202:**

```json
{
  "data": {
    "jobId": "bull-job-123",
    "status": "queued"
  }
}
```

**Rate Limit:** 5 requests per hour.

### GET /api/synthesis/status

Check synthesis pipeline status.

---

## Webhook

### POST /api/feedback/webhook

Ingest feedback via webhook (requires API key).

**Headers:**

```
X-API-Key: sk_live_your_api_key_here
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "Your product is amazing but needs better docs",
  "source": "intercom",
  "metadata": { "ticket_id": "12345" }
}
```

**Response 201:**

```json
{
  "data": {
    "id": "clx...",
    "status": "pending"
  }
}
```

---

## Dashboard

### GET /api/dashboard/stats

Get overview statistics with trend data.

### GET /api/dashboard/activity

Get recent activity feed.

| Param   | Type   | Default | Description                |
| ------- | ------ | ------- | -------------------------- |
| `limit` | number | 20      | Max entries (capped at 50) |

### GET /api/dashboard/top-themes

Get themes sorted by feedback count.

### GET /api/dashboard/sentiment

Get sentiment distribution (positive, neutral, negative counts).

---

## Settings

### GET /api/settings

Get current settings (API key masked).

### PUT /api/settings

Update settings.

**Request Body:**

```json
{
  "ai_model": "gpt-4o",
  "similarity_threshold": "0.85"
}
```

### POST /api/settings/test-ai

Test the OpenAI API connection.

### POST /api/settings/export

Export all data as JSON.

### DELETE /api/settings/data

Delete all application data (irreversible).

### POST /api/settings/api-keys

Generate a new API key (returned once, then only the prefix is stored).

### GET /api/settings/api-keys

List API keys (prefix only).

### DELETE /api/settings/api-keys/:id

Revoke an API key.
