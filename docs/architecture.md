# ShipScope Architecture

## System Overview

ShipScope is a monorepo with three packages:

```mermaid
graph TD
    ROOT[shipscope/] --> PKG[packages/]
    PKG --> CORE[core/]
    PKG --> API[api/]
    PKG --> WEB[web/]
    CORE -.- CORE_DESC[Shared TypeScript types and Zod schemas]
    API -.- API_DESC[Express REST API + BullMQ workers]
    WEB -.- WEB_DESC[React SPA — Vite + Tailwind]

    style CORE_DESC fill:none,stroke:none
    style API_DESC fill:none,stroke:none
    style WEB_DESC fill:none,stroke:none
```

## Architecture Diagram

```mermaid
graph TB
    subgraph "Browser"
        WEB[React SPA<br/>React 18 + Vite + Tailwind]
    end

    subgraph "API Server"
        EXPRESS[Express API<br/>Routes + Middleware]
        SERVICES[Service Layer<br/>Business Logic]
        WORKERS[BullMQ Workers<br/>Background Jobs]
    end

    subgraph "AI Layer"
        OPENAI[OpenAI API<br/>gpt-4o-mini + text-embedding-3-small]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16<br/>+ pgvector)]
        REDIS[(Redis 7<br/>Queue + Cache)]
    end

    subgraph "External Integrations"
        JIRA[Jira Cloud<br/>REST API v3]
    end

    WEB -->|REST API| EXPRESS
    EXPRESS --> SERVICES
    SERVICES --> PG
    SERVICES --> REDIS
    SERVICES -->|Enqueue jobs| REDIS
    SERVICES -->|Export / Import / Sync| JIRA
    JIRA -->|Webhooks| EXPRESS
    WORKERS -->|Process jobs| REDIS
    WORKERS --> OPENAI
    WORKERS --> PG
```

## Data Flow

### 1. Feedback Ingestion

```mermaid
graph LR
    A[User Upload / Webhook] --> B[Express Route]
    B --> C[Zod Validation]
    C --> D[Sanitization]
    D --> E[Feedback Service]
    E --> F[Prisma INSERT]
    F --> G[(PostgreSQL)]
    E --> H[Enqueue embedding job]
    H --> I[(Redis / BullMQ)]
```

### 2. AI Synthesis Pipeline

```mermaid
graph TD
    A[Synthesis Trigger] --> B[BullMQ Job Queue]
    B --> C[Worker picks up job]
    C --> D["Step 1: Generate embeddings
    (OpenAI text-embedding-3-small)"]
    D --> E["Step 2: Store embeddings
    in pgvector"]
    E --> F["Step 3: Cluster similar feedback
    (cosine similarity)"]
    F --> G["Step 4: Extract themes
    (OpenAI gpt-4o-mini)"]
    G --> H["Step 5: Generate proposals
    with RICE scores (OpenAI gpt-4o-mini)"]
    H --> I["Step 6: Store results
    in PostgreSQL"]
```

### 3. Dashboard Data Flow

```mermaid
graph TD
    A[React Component mounts] --> B["TanStack Query fetches
    /api/dashboard/stats"]
    B --> C[Express Route]
    C --> D[Dashboard Service]
    D --> E{Check Redis cache}
    E -->|Cache HIT| F["Return cached data (< 5ms)"]
    E -->|Cache MISS| G[Query PostgreSQL]
    G --> H["Cache result (60s TTL)"]
    H --> F
    F --> I[React Query caches in browser]
    I --> J[Re-render with data]
```

## Component Responsibilities

| Component        | Responsibility                                  | Does NOT do                                  |
| ---------------- | ----------------------------------------------- | -------------------------------------------- |
| `packages/core`  | TypeScript types, Zod schemas, shared constants | Business logic, I/O, database access         |
| Express Routes   | HTTP parsing, validation, response formatting   | Business logic, direct DB queries            |
| Service Layer    | Business logic, orchestration, caching          | HTTP concerns, direct Prisma calls in routes |
| Jira Service     | Jira API integration, export/import/sync        | UI rendering, HTTP concerns                  |
| Prisma ORM       | Database queries, migrations, type-safe access  | Business logic, HTTP concerns                |
| BullMQ Workers   | Background job processing, AI pipeline          | Serving HTTP requests                        |
| React Components | UI rendering, user interaction                  | Direct API calls (uses TanStack Query)       |
| TanStack Query   | API data fetching, caching, sync                | UI rendering, business logic                 |

## Database Schema (simplified)

```mermaid
erDiagram
    FeedbackItem ||--o{ FeedbackThemeLink : "has"
    FeedbackThemeLink }o--|| Theme : "belongs to"
    Theme ||--o{ Proposal : "has"
    Proposal ||--o| Spec : "generates"
    FeedbackItem {
        vector embedding "pgvector"
    }
    Theme {
        int feedbackCount "denormalized"
    }
```

Key tables: FeedbackItem, Theme, Proposal, Spec, JiraIssue, ApiKey, Setting, ActivityLog

## Security Layers

1. **Input sanitization** — HTML tags stripped from all string inputs
2. **CORS** — Whitelist-only origin validation
3. **Helmet** — CSP, X-Frame-Options, HSTS headers
4. **Rate limiting** — Per-IP and per-API-key limits
5. **API key hashing** — HMAC-SHA256 with timing-safe comparison
6. **HTTPS redirect** — Enforced in production via X-Forwarded-Proto
7. **Non-root containers** — API and Web run as unprivileged users
