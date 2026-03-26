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

---

## Jira Integration

### PUT /api/jira/config

Save Jira configuration settings.

**Request Body:**

| Field              | Type   | Required | Description                        |
| ------------------ | ------ | -------- | ---------------------------------- |
| `jira_host`        | string | No       | Jira instance URL (must be HTTPS)  |
| `jira_email`       | string | No       | Jira account email                 |
| `jira_api_token`   | string | No       | Jira API token                     |
| `jira_project_key` | string | No       | Default project key (max 20 chars) |
| `jira_issue_type`  | string | No       | Default issue type (max 50 chars)  |

**Response 200:**

```json
{ "data": { "saved": true } }
```

### POST /api/jira/test

Test the Jira connection with current credentials.

**Response 200:**

```json
{
  "data": {
    "success": true,
    "message": "Connected to My Jira",
    "serverTitle": "My Jira"
  }
}
```

### GET /api/jira/projects

List available Jira projects for the connected account.

**Response 200:**

```json
{ "data": [{ "id": "10000", "key": "PROJ", "name": "My Project" }] }
```

### GET /api/jira/issue-types

List issue types for the configured project (excludes subtasks).

**Response 200:**

```json
{ "data": [{ "id": "10001", "name": "Story", "subtask": false }] }
```

### POST /api/jira/export/:proposalId

Export a proposal to Jira as a new issue. The description is formatted in ADF with problem, solution, RICE scores, and customer evidence.

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "jiraKey": "PROJ-42",
    "jiraUrl": "https://your-jira.atlassian.net/browse/PROJ-42"
  }
}
```

### POST /api/jira/sync/:proposalId

Sync the Jira issue status back to the local record.

**Response 200:**

```json
{ "data": { "jiraKey": "PROJ-42", "status": "In Progress" } }
```

### GET /api/jira/issues

List all exported Jira issues with linked proposal data.

### GET /api/jira/issues/:proposalId

Get the Jira issue linked to a specific proposal. Returns `null` if no link exists.

### DELETE /api/jira/issues/:proposalId

Unlink a Jira issue from a proposal (does not delete the Jira issue). Returns `204`.

### POST /api/jira/export-theme/:themeId

Export a theme as a Jira Epic with all its proposals as child Stories.

**Response 201:**

```json
{
  "data": {
    "epicKey": "PROJ-100",
    "epicUrl": "https://your-jira.atlassian.net/browse/PROJ-100",
    "storiesCreated": 3,
    "storiesSkipped": 1
  }
}
```

### POST /api/jira/attach-spec/:proposalId

Attach the generated PRD spec as a formatted comment on the linked Jira issue.

**Response 200:**

```json
{ "data": { "jiraKey": "PROJ-42", "commented": true } }
```

### POST /api/jira/import-feedback

Import Jira issues as ShipScope feedback items.

**Request Body:**

| Field        | Type   | Required | Description                                      |
| ------------ | ------ | -------- | ------------------------------------------------ |
| `jql`        | string | No       | Custom JQL query (default: project bugs/stories) |
| `maxResults` | number | No       | Max items to import (capped at 100)              |

**Response 201:**

```json
{ "data": { "imported": 12, "skipped": 3, "sourceId": "uuid" } }
```

### POST /api/jira/sync-all

Sync status for all linked Jira issues. Automatically marks proposals as "shipped" when the Jira issue status reaches Done/Closed/Resolved.

**Response 200:**

```json
{ "data": { "synced": 10, "autoShipped": 2, "errors": 0 } }
```

### POST /api/jira/webhook

Receive Jira webhook events for real-time status sync. Configure in Jira under Settings > System > Webhooks.

**Response 200:**

```json
{ "data": { "processed": true, "jiraKey": "PROJ-42" } }
```

### GET /api/jira/dashboard

Get Jira integration summary for the dashboard widget.

**Response 200:**

```json
{
  "data": {
    "totalExported": 15,
    "byStatus": { "To Do": 5, "In Progress": 8, "Done": 2 },
    "recentExports": [],
    "epicCount": 3
  }
}
```

---

## Trello Integration

### PUT /api/trello/config

Save Trello configuration settings.

**Request Body:**

| Field             | Type   | Required | Description      |
| ----------------- | ------ | -------- | ---------------- |
| `trello_api_key`  | string | No       | Trello API key   |
| `trello_token`    | string | No       | Trello token     |
| `trello_board_id` | string | No       | Default board ID |
| `trello_list_id`  | string | No       | Default list ID  |

**Response 200:**

```json
{ "data": { "saved": true } }
```

### POST /api/trello/test

Test the Trello connection with current credentials.

**Response 200:**

```json
{
  "data": {
    "success": true,
    "message": "Connected as Test User",
    "username": "testuser"
  }
}
```

### GET /api/trello/boards

List Trello boards for the authenticated user.

**Response 200:**

```json
{ "data": [{ "id": "board123", "name": "My Board", "url": "https://trello.com/b/board123" }] }
```

### GET /api/trello/lists

List open lists for the configured board.

**Response 200:**

```json
{ "data": [{ "id": "list456", "name": "To Do", "closed": false }] }
```

### POST /api/trello/export/:proposalId

Export a proposal to Trello as a new card. The description includes problem, solution, RICE scores, and customer evidence in Markdown.

**Response 201:**

```json
{
  "data": {
    "id": "uuid",
    "cardId": "card123",
    "cardUrl": "https://trello.com/c/card123"
  }
}
```

### POST /api/trello/sync/:proposalId

Sync the Trello card status (list name) back to the local record.

**Response 200:**

```json
{ "data": { "cardId": "card123", "listName": "In Progress" } }
```

### GET /api/trello/cards

List all exported Trello cards with linked proposal data.

### GET /api/trello/cards/:proposalId

Get the Trello card linked to a specific proposal. Returns `null` if no link exists.

### DELETE /api/trello/cards/:proposalId

Unlink a Trello card from a proposal (does not delete the Trello card). Returns `204`.

### POST /api/trello/export-theme/:themeId

Export a theme as a Trello list with all its proposals as cards.

**Response 201:**

```json
{
  "data": {
    "listName": "[ShipScope] Onboarding Friction",
    "cardsCreated": 3,
    "cardsSkipped": 1
  }
}
```

### POST /api/trello/attach-spec/:proposalId

Attach the generated PRD spec as a comment on the linked Trello card.

**Response 200:**

```json
{ "data": { "cardId": "card123", "commented": true } }
```

### POST /api/trello/import-feedback

Import Trello cards as ShipScope feedback items.

**Request Body:**

| Field        | Type   | Required | Description                               |
| ------------ | ------ | -------- | ----------------------------------------- |
| `listId`     | string | No       | Trello list ID (default: configured list) |
| `maxResults` | number | No       | Max items to import (capped at 100)       |

**Response 201:**

```json
{ "data": { "imported": 12, "skipped": 3, "sourceId": "uuid" } }
```

### POST /api/trello/sync-all

Sync status for all linked Trello cards. Automatically marks proposals as "shipped" when the card moves to a Done/Complete list.

**Response 200:**

```json
{ "data": { "synced": 10, "autoShipped": 2, "errors": 0 } }
```

### POST /api/trello/webhook

Receive Trello webhook events for real-time card movement sync.

**Response 200:**

```json
{ "data": { "processed": true, "cardId": "card123" } }
```

### HEAD /api/trello/webhook

Trello verifies webhook URLs with a HEAD request. Returns `200`.

### GET /api/trello/dashboard

Get Trello integration summary for the dashboard widget.

**Response 200:**

```json
{
  "data": {
    "totalExported": 15,
    "byList": { "To Do": 5, "In Progress": 8, "Done": 2 },
    "recentExports": []
  }
}
```

---

## Linear Integration

All Linear endpoints are prefixed with `/api/linear`.

### PUT /api/linear/config

Save Linear integration configuration.

**Request Body:**

```json
{
  "linear_api_key": "lin_api_...",
  "linear_team_id": "team-uuid",
  "linear_project_id": "project-uuid",
  "linear_done_states": "Done,Cancelled",
  "linear_default_label_id": "label-uuid",
  "linear_cycle_id": "cycle-uuid"
}
```

All fields are optional. Provide only the fields you want to update.

**Response 200:**

```json
{ "data": { "saved": true } }
```

### POST /api/linear/test

Test the Linear connection with current credentials.

**Response 200:**

```json
{
  "data": {
    "success": true,
    "message": "Connected as User Name (user@email.com)",
    "userName": "User Name"
  }
}
```

### GET /api/linear/teams

List teams the authenticated user belongs to.

**Response 200:**

```json
{ "data": [{ "id": "team-uuid", "name": "Engineering", "key": "ENG" }] }
```

### GET /api/linear/projects

List projects for the configured team.

**Response 200:**

```json
{
  "data": [
    { "id": "proj-uuid", "name": "Q1 Roadmap", "url": "https://linear.app/...", "state": "started" }
  ]
}
```

### GET /api/linear/labels

List labels for the configured team.

**Response 200:**

```json
{ "data": [{ "id": "label-uuid", "name": "Feature", "color": "#5E6AD2" }] }
```

### GET /api/linear/states

List workflow states for the configured team.

**Response 200:**

```json
{ "data": [{ "id": "state-uuid", "name": "In Progress", "type": "started", "color": "#F2C94C" }] }
```

### GET /api/linear/cycles

List cycles (sprints) for the configured team.

**Response 200:**

```json
{
  "data": [
    {
      "id": "cycle-uuid",
      "name": null,
      "number": 12,
      "startsAt": "2025-01-01T00:00:00.000Z",
      "endsAt": "2025-01-14T00:00:00.000Z"
    }
  ]
}
```

### POST /api/linear/export/:proposalId

Export an approved proposal as a Linear issue.

**Response 201:**

```json
{
  "data": {
    "identifier": "ENG-42",
    "linearUrl": "https://linear.app/team/issue/ENG-42",
    "linearId": "issue-uuid",
    "status": "Backlog",
    "priority": 3
  }
}
```

### POST /api/linear/sync/:proposalId

Sync the status of a linked Linear issue back to ShipScope.

**Response 200:**

```json
{ "data": { "status": "In Progress", "priority": 2 } }
```

### GET /api/linear/issues

List all proposals exported to Linear.

**Response 200:**

```json
{
  "data": [
    {
      "id": "record-uuid",
      "proposalId": "proposal-uuid",
      "identifier": "ENG-42",
      "linearUrl": "https://linear.app/team/issue/ENG-42",
      "status": "In Progress",
      "priority": 2,
      "issueTitle": "Add dark mode support",
      "proposal": { "id": "...", "title": "...", "status": "approved" }
    }
  ]
}
```

### GET /api/linear/issues/:proposalId

Get the linked Linear issue for a specific proposal.

**Response 200:** Same shape as individual items in the list above.

**Response 404:** When no linked issue exists.

### DELETE /api/linear/issues/:proposalId

Unlink a Linear issue from a proposal. The issue in Linear is **not** deleted.

**Response 200:**

```json
{ "data": { "unlinked": true } }
```

### POST /api/linear/export-theme/:themeId

Export all proposals under a theme as a Linear project with individual issues.

**Response 201:**

```json
{
  "data": {
    "projectName": "Dark Mode",
    "projectUrl": "https://linear.app/team/project/dark-mode",
    "issuesCreated": 5,
    "issuesSkipped": 1
  }
}
```

### POST /api/linear/attach-spec/:proposalId

Attach the generated PRD spec as a comment on the linked Linear issue.

**Response 200:**

```json
{ "data": { "attached": true } }
```

### POST /api/linear/import-feedback

Import Linear issues as feedback items for AI analysis.

**Request Body (optional):**

```json
{
  "projectId": "project-uuid",
  "stateType": "started",
  "maxResults": 50
}
```

**Response 200:**

```json
{ "data": { "imported": 25, "skipped": 3, "sourceId": "source-uuid" } }
```

### POST /api/linear/sync-all

Sync status for all exported Linear issues at once.

**Response 200:**

```json
{ "data": { "synced": 10, "autoShipped": 2, "errors": 0 } }
```

### POST /api/linear/webhook

Receive Linear webhook events for real-time issue state sync.

**Response 200:**

```json
{ "data": { "received": true } }
```

### GET /api/linear/dashboard

Get Linear integration summary for the dashboard widget.

**Response 200:**

```json
{
  "data": {
    "total": 15,
    "byStatus": [
      { "status": "In Progress", "count": 8 },
      { "status": "Done", "count": 5 }
    ],
    "byPriority": [
      { "priority": 1, "count": 3 },
      { "priority": 2, "count": 7 }
    ],
    "recentExports": []
  }
}
```
