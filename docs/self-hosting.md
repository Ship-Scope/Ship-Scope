# Self-Hosting ShipScope

This guide walks you through deploying ShipScope on your own infrastructure using Docker.

## Prerequisites

- **Docker** >= 24.0 and **Docker Compose** >= 2.20
- **OpenAI API Key** with access to `gpt-4o-mini` and `text-embedding-3-small`
- At least **2GB RAM** and **10GB disk space** available
- A domain name (optional, but recommended for HTTPS)

## Quick Start (5 minutes)

### 1. Clone the repository

```bash
git clone https://github.com/Ship-Scope/Ship-Scope.git
cd Ship-Scope
```

### 2. Create environment file

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and fill in the required values:

```env
POSTGRES_PASSWORD=<generate-a-strong-random-password>
REDIS_PASSWORD=<generate-another-strong-random-password>
OPENAI_API_KEY=sk-your-openai-api-key
API_KEY_HASH_SECRET=<64-character-hex-string>
CORS_ORIGIN=https://your-domain.com
VITE_API_URL=https://your-domain.com/api
```

To generate secure random values:

```bash
# Generate a strong password
openssl rand -base64 32

# Generate a 64-char hex string for API_KEY_HASH_SECRET
openssl rand -hex 32
```

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 4. Verify

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl http://localhost:4000/api/health

# Open the web UI
open http://localhost:3000
```

### 5. Seed demo data (optional)

```bash
docker compose -f docker-compose.prod.yml exec api \
  npx prisma db seed --schema=packages/api/prisma/schema.prisma
```

## Configuration Reference

| Variable              | Required | Default                 | Description                               |
| --------------------- | -------- | ----------------------- | ----------------------------------------- |
| `POSTGRES_USER`       | No       | `shipscope`             | PostgreSQL username                       |
| `POSTGRES_PASSWORD`   | **Yes**  | —                       | PostgreSQL password                       |
| `POSTGRES_DB`         | No       | `shipscope`             | PostgreSQL database name                  |
| `REDIS_PASSWORD`      | **Yes**  | —                       | Redis password                            |
| `OPENAI_API_KEY`      | **Yes**  | —                       | OpenAI API key (sk-...)                   |
| `API_KEY_HASH_SECRET` | **Yes**  | —                       | Secret for hashing API keys (64-char hex) |
| `CORS_ORIGIN`         | No       | `http://localhost:3000` | Allowed CORS origins (comma-separated)    |
| `VITE_API_URL`        | No       | `http://localhost:4000` | API URL accessible from the browser       |
| `API_PORT`            | No       | `4000`                  | Host port for the API                     |
| `WEB_PORT`            | No       | `3000`                  | Host port for the web UI                  |
| `LOG_LEVEL`           | No       | `info`                  | Log level: debug, info, warn, error       |

## Jira Integration (Optional)

Jira is configured through the Settings UI after deployment — no environment variables needed.

### Setup

1. Go to **Settings → Jira Integration** in the ShipScope UI
2. Enter your Jira Cloud host URL (e.g. `https://yourcompany.atlassian.net`)
3. Enter your Jira account email and [API token](https://id.atlassian.com/manage-profile/security/api-tokens)
4. Click **Test Connection** to verify credentials
5. Select your default project and issue type from the dropdowns
6. Click **Save**

### Real-Time Sync via Webhooks

To receive instant status updates when Jira issues change:

1. In Jira, go to **Settings → System → Webhooks**
2. Create a new webhook pointing to:
   ```
   https://your-domain.com/api/jira/webhook
   ```
3. Select the **Issue updated** event
4. Save the webhook

When a Jira issue reaches Done/Closed/Resolved, ShipScope will automatically mark the linked proposal as "shipped".

## Trello Integration (Optional)

Trello is configured through the Settings UI after deployment — no environment variables needed.

### Setup

1. Go to **Settings → Trello Integration** in the ShipScope UI
2. Get your API key from [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
3. Generate a token using the link on the API key page
4. Enter both values in settings and click **Test Connection**
5. Select your default board and list from the dropdowns
6. Click **Save**

### Real-Time Sync via Webhooks

Trello webhooks are registered via the API (not through the Trello UI). The callback URL is:

```
https://your-domain.com/api/trello/webhook
```

When a Trello card moves to a Done/Complete/Shipped/Released/Closed list, ShipScope will automatically mark the linked proposal as "shipped".

## Linear Integration (Optional)

Linear is configured through the Settings UI after deployment — no environment variables needed.

### Setup

1. Go to **Settings → Linear Integration** in the ShipScope UI
2. Create a personal API key from [linear.app/settings/api](https://linear.app/settings/api)
3. Enter the API key in settings and click **Test Connection**
4. Select your default team from the dropdown
5. Optionally select a project, labels, and cycle
6. Click **Save**

### Real-Time Sync via Webhooks

To receive instant status updates when Linear issues change:

1. In Linear, go to **Settings → API → Webhooks**
2. Create a new webhook pointing to:
   ```
   https://your-domain.com/api/linear/webhook
   ```
3. Select the **Issues** resource and **Data change** event
4. Save the webhook

When a Linear issue reaches a configured "Done" state, ShipScope will automatically mark the linked proposal as "shipped".

## Updating

```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database migrations run automatically on API container startup.

## Backup & Restore

### Create backup

```bash
./scripts/backup.sh
# Or manually:
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U shipscope shipscope > backup-$(date +%Y%m%d).sql
```

### Restore from backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U shipscope shipscope < backup-20240101.sql
```

## Reverse Proxy (HTTPS)

ShipScope does not handle TLS directly. Use a reverse proxy for HTTPS.

### Caddy (recommended — auto-HTTPS)

```
shipscope.example.com {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name shipscope.example.com;

    ssl_certificate /etc/ssl/certs/shipscope.pem;
    ssl_certificate_key /etc/ssl/private/shipscope.key;

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

| Symptom                                   | Cause                    | Fix                                                              |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| API health returns `"db": "disconnected"` | PostgreSQL not ready     | Wait 30s for health check; check `docker logs shipscope-db-prod` |
| Web shows blank page                      | `VITE_API_URL` incorrect | Rebuild web container with correct `VITE_API_URL`                |
| AI features return 502                    | Invalid OpenAI API key   | Verify key at https://platform.openai.com/api-keys               |
| Rate limit errors (429)                   | Too many requests        | Wait 15 minutes; adjust rate limits via env vars                 |
| "Query engine not found"                  | Prisma binary mismatch   | Rebuild API container: `docker compose build api --no-cache`     |
