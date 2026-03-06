# Phase 6: Dashboard & Settings

> **Timeline:** Days 19-21
> **Goal:** Build the dashboard overview page with stat cards, activity feed, charts, and quick actions; the settings page with AI configuration, synthesis tuning, data management, webhook management, and about info; and comprehensive empty states with guided onboarding across every page. After this phase, users have a polished home screen that summarizes their data, a settings page for configuring the entire system, and clear guidance when pages have no data.

---

## Dependency Graph

```
Phase 5 (complete) ──> 01-dashboard-page ──────────┐
                                                     │
Phase 2-5 APIs ──────> 02-settings-page ────────────┤
                                                     │
                       01 + 02 ──> 03-empty-states-onboarding
                                                     │
                       All pages updated ────────────┘

Parallelizable:
  - 01 and 02 can start simultaneously (no cross-dependency)
  - 03 depends on 01 and 02 (needs dashboard and settings pages built before adding empty states)
  - 03 also modifies pages from Phases 2-5 (FeedbackPage, ThemesPage, ProposalsPage, SpecsPage)
```

---

## Tasks Overview

| #   | Task                      | Complexity | Dependencies                                      | Est. |
| --- | ------------------------- | ---------- | ------------------------------------------------- | ---- |
| 01  | Dashboard Page            | XL         | Phase 5 complete (all entity counts available)    | 1.5d |
| 02  | Settings Page             | L          | Phase 2 webhook, Phase 3 AI config, Prisma schema | 1d   |
| 03  | Empty States & Onboarding | M          | 01, 02, all page components from Phases 2-5       | 0.5d |

---

## Key Architectural Decisions

1. **Dashboard stats computed server-side** -- The `/api/dashboard/stats` endpoint runs aggregate queries (COUNT, AVG) across all four entity tables in a single Prisma transaction. Trend percentages compare the current 7-day window against the previous 7-day window. This avoids sending raw data to the client for computation and keeps the dashboard load under 200ms even at 10K feedback items.

2. **Activity feed backed by a dedicated ActivityLog table** -- Rather than reconstructing activity from entity timestamps (fragile), we introduce a lightweight `ActivityLog` model that records discrete events: imports, synthesis runs, proposal generations, spec creations. Each entry has a `type`, `description`, `metadata` (JSON), and `createdAt`. This is append-only and never updated, making it simple and fast.

3. **Settings stored as key-value pairs** -- A `Setting` model with `key` (unique string) and `value` (JSON string) stores all configurable values. This avoids schema migrations every time a new setting is added. The service layer provides typed getters/setters that parse/validate values. Default values live in code, not in the database, so a fresh install works with zero settings rows.

4. **Charts use pure CSS (no chart library)** -- The top themes horizontal bar chart and sentiment gauge are built with Tailwind utility classes and CSS custom properties. This avoids adding a charting dependency (recharts, chart.js) for two simple visualizations. If future phases need complex charts, a library can be added then.

5. **Onboarding state derived from entity counts** -- Rather than tracking onboarding steps in a separate table, the system infers progress from existing data: feedbackCount > 0 means step 1 is complete, themeCount > 0 means step 2 is complete, etc. This is idempotent and self-healing -- deleting all data resets the onboarding state automatically.

---

## Data Flow

```
Dashboard Page
  │
  ├─[01] GET /api/dashboard/stats
  │       ├── Feedback: COUNT(*), COUNT(WHERE createdAt > 7d ago), COUNT(WHERE createdAt > 14d ago AND < 7d ago)
  │       ├── Themes: COUNT(*), same windowed counts
  │       ├── Proposals: COUNT(*), same windowed counts
  │       ├── Specs: COUNT(*), same windowed counts
  │       └── Returns: { feedback: { total, current, previous, trend }, ... }
  │
  ├─[01] GET /api/dashboard/activity
  │       ├── ActivityLog.findMany({ orderBy: createdAt desc, take: 10 })
  │       └── Returns: [{ type, description, metadata, createdAt }]
  │
  ├─[01] GET /api/dashboard/top-themes
  │       ├── Theme.findMany({ orderBy: feedbackCount desc, take: 5 })
  │       └── Returns: [{ name, feedbackCount, category }]
  │
  └─[01] GET /api/dashboard/sentiment
          ├── FeedbackItem.aggregate({ _avg: { sentiment } })
          ├── COUNT by sentiment bucket: negative (<-0.3), neutral, positive (>0.3)
          └── Returns: { avg, negative, neutral, positive }

Settings Page
  │
  ├─[02] GET /api/settings
  │       └── Setting.findMany() → parse into typed object
  │
  ├─[02] PUT /api/settings
  │       └── Upsert key-value pairs
  │
  ├─[02] POST /api/settings/test-ai
  │       └── Call OpenAI with a trivial prompt, return latency + model info
  │
  ├─[02] POST /api/settings/export
  │       └── Stream all data as JSON (feedback, themes, proposals, specs)
  │
  └─[02] DELETE /api/settings/data
          └── Truncate all entity tables in correct order (respecting FK constraints)

Empty States & Onboarding
  │
  └─[03] Derived from GET /api/dashboard/stats
          ├── feedback.total === 0 → Step 1 incomplete
          ├── themes.total === 0 → Step 2 incomplete
          ├── proposals.total === 0 → Step 3 incomplete
          └── specs.total === 0 → Step 4 incomplete
```

---

## New Database Models

### ActivityLog

```prisma
model ActivityLog {
  id          String   @id @default(cuid())
  type        String   // 'import', 'synthesis', 'proposal_generation', 'spec_generation'
  description String   // Human-readable: "Imported 150 feedback items from CSV"
  metadata    Json?    // { count: 150, source: 'csv', duration: 3200 }
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@map("activity_log")
}
```

### Setting

```prisma
model Setting {
  key       String   @id
  value     String   // JSON-encoded value
  updatedAt DateTime @updatedAt

  @@map("settings")
}
```

---

## Exit Criteria

Before moving to Phase 7, ALL of the following must be true:

- [ ] Dashboard page loads and displays 4 stat cards (feedback, themes, proposals, specs)
- [ ] Each stat card shows total count and weekly trend percentage with directional indicator
- [ ] Trend is calculated by comparing current 7-day count to previous 7-day count
- [ ] Recent activity feed displays last 10 actions with type icon, description, and relative time
- [ ] Top themes chart shows horizontal bars for top 5 themes by feedback count
- [ ] Sentiment gauge displays average sentiment and distribution buckets
- [ ] Quick action buttons navigate to Import, Synthesis, and Proposal Generation flows
- [ ] Dashboard loads in <300ms with 1000 feedback items (server-side aggregation)
- [ ] Settings page displays all 5 sections: AI Config, Synthesis, Data, Webhook, About
- [ ] AI API key input is masked (shows last 4 chars), can be updated
- [ ] Model selection dropdown lists available models, persists selection
- [ ] "Test Connection" button sends test request and shows success/failure status
- [ ] Similarity threshold slider adjusts between 0.70 and 0.95 with 0.01 step
- [ ] Minimum cluster size accepts integer input between 2 and 50
- [ ] Export button downloads all data as JSON file
- [ ] "Delete All Data" shows double confirmation modal before executing
- [ ] Webhook section displays the webhook URL for the current instance
- [ ] API key generation creates a new key, displays it once, allows copy
- [ ] About section shows version from package.json and links to GitHub/docs
- [ ] All settings persist across page reloads (stored in database)
- [ ] Dashboard shows onboarding steps when no data exists (empty state)
- [ ] Onboarding progress indicator shows completed/pending steps
- [ ] Each page (Feedback, Themes, Proposals, Specs) has a contextual empty state
- [ ] Empty states include relevant icon, message, and primary action button
- [ ] Completing onboarding step 1 (import) automatically advances the dashboard indicator
- [ ] All new API endpoints have Zod validation on inputs
- [ ] ActivityLog entries created for imports, synthesis runs, proposal generation, spec generation
