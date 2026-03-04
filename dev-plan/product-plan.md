# ShipScope — Complete Development Plan

> **Purpose:** This document is the single source of truth for building ShipScope. It defines every feature, acceptance criteria, testing requirement, code convention, and design specification. Any AI coding agent (Claude Code, Cursor, etc.) should reference this document before writing any code.

---

## 1. Project Identity

- **Name:** ShipScope
- **Tagline:** "Know what to build, not just how"
- **Domain:** shipscope.dev
- **Repo:** github.com/Ship-Scope/Ship-Scope
- **License:** AGPL-3.0

---

## 2. Tech Stack (Locked — Do Not Change)

| Layer               | Technology                                       | Version               |
| ------------------- | ------------------------------------------------ | --------------------- |
| Frontend            | React + TypeScript                               | React 18, TS 5.4+     |
| Build Tool          | Vite                                             | 5.x                   |
| Styling             | Tailwind CSS                                     | 3.4+                  |
| State/Data Fetching | TanStack React Query                             | 5.x                   |
| Routing             | React Router                                     | 6.x                   |
| HTTP Client         | Axios                                            | 1.x                   |
| Backend             | Node.js + Express                                | Node 20+, Express 4.x |
| ORM                 | Prisma                                           | 5.x                   |
| Database            | PostgreSQL + pgvector                            | PG 16, pgvector 0.7+  |
| Queue               | Redis + BullMQ                                   | Redis 7, BullMQ 5.x   |
| AI Provider         | OpenAI API (gpt-4o-mini, text-embedding-3-small) | Latest                |
| Validation          | Zod                                              | 3.x                   |
| Testing             | Vitest + Supertest + vitest-mock-extended        | Latest                |
| Monorepo            | npm workspaces                                   | Built-in              |
| Container           | Docker + Docker Compose                          | Latest                |

---

## 3. Monorepo Structure

```
Ship-Scope/
├── packages/
│   ├── web/                    # Frontend React app
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   │   ├── ui/         # Base primitives (Button, Input, Card, Modal, Badge, etc.)
│   │   │   │   ├── layout/     # Shell, Sidebar, Topbar, PageContainer
│   │   │   │   ├── feedback/   # FeedbackTable, FeedbackCard, ImportModal, CSVMapper
│   │   │   │   ├── themes/     # ThemeCard, ThemeCluster, ThemeDetail
│   │   │   │   ├── proposals/  # ProposalCard, ProposalDetail, EvidencePanel, RICEScore
│   │   │   │   ├── specs/      # SpecViewer, PRDPreview, AgentPromptBlock
│   │   │   │   └── charts/     # OpportunityChart, SentimentGauge, FeedbackTimeline
│   │   │   ├── pages/          # Route-level page components
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── FeedbackPage.tsx
│   │   │   │   ├── ThemesPage.tsx
│   │   │   │   ├── ProposalsPage.tsx
│   │   │   │   ├── SpecsPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   │   ├── useFeedback.ts
│   │   │   │   ├── useThemes.ts
│   │   │   │   ├── useProposals.ts
│   │   │   │   ├── useSpecs.ts
│   │   │   │   └── useSynthesis.ts
│   │   │   ├── lib/            # Utilities, API client, constants
│   │   │   │   ├── api.ts      # Axios instance + typed API functions
│   │   │   │   ├── constants.ts
│   │   │   │   └── utils.ts
│   │   │   ├── styles/
│   │   │   │   └── globals.css  # Tailwind directives + custom CSS
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/                    # Backend Express app
│   │   ├── src/
│   │   │   ├── routes/         # Express route handlers
│   │   │   │   ├── health.ts
│   │   │   │   ├── feedback.ts
│   │   │   │   ├── synthesis.ts
│   │   │   │   ├── proposals.ts
│   │   │   │   └── specs.ts
│   │   │   ├── services/       # Business logic (decoupled from routes)
│   │   │   │   ├── feedback.service.ts
│   │   │   │   ├── synthesis.service.ts
│   │   │   │   ├── proposal.service.ts
│   │   │   │   ├── spec.service.ts
│   │   │   │   └── ai.service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── errorHandler.ts
│   │   │   │   ├── validate.ts     # Zod validation middleware
│   │   │   │   └── rateLimit.ts
│   │   │   ├── lib/
│   │   │   │   ├── prisma.ts       # Singleton Prisma client
│   │   │   │   ├── redis.ts        # Redis connection
│   │   │   │   ├── queue.ts        # BullMQ queue definitions
│   │   │   │   └── openai.ts       # OpenAI client singleton
│   │   │   ├── workers/            # BullMQ worker processes
│   │   │   │   ├── embedding.worker.ts
│   │   │   │   └── synthesis.worker.ts
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── feedback.service.test.ts
│   │   │   │   ├── synthesis.service.test.ts
│   │   │   │   ├── proposal.service.test.ts
│   │   │   │   └── spec.service.test.ts
│   │   │   ├── integration/
│   │   │   │   ├── feedback.routes.test.ts
│   │   │   │   ├── synthesis.routes.test.ts
│   │   │   │   ├── proposals.routes.test.ts
│   │   │   │   └── specs.routes.test.ts
│   │   │   └── setup.ts            # Test database setup + cleanup
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── core/                   # Shared types + AI logic (used by both web and api)
│       ├── src/
│       │   ├── types/          # Shared TypeScript types/interfaces
│       │   │   ├── feedback.ts
│       │   │   ├── theme.ts
│       │   │   ├── proposal.ts
│       │   │   └── spec.ts
│       │   └── prompts/        # AI prompt templates
│       │       ├── synthesis.ts
│       │       ├── proposals.ts
│       │       └── specs.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── self-hosting.md
│   ├── api-reference.md
│   └── contributing.md
├── scripts/
│   ├── seed-sample-data.ts     # Generate realistic sample dataset
│   └── setup.sh                # First-time setup script
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json                # Root workspace config
├── tsconfig.json               # Base TS config
├── vitest.config.ts            # Root test config
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

---

## 4. Frontend Design System & Theme Definition

### 4.1 Design Philosophy

ShipScope's UI follows a **"dark professional tool"** aesthetic — similar to Linear, Vercel Dashboard, or Raycast. It should feel like a serious developer/PM tool, not a playful consumer app.

**Key principles:**

- Dark background with high contrast text
- Minimal chrome — content takes center stage
- Subtle borders, not heavy shadows
- Smooth micro-interactions (hover states, transitions)
- Information density without clutter
- Monospace for data/numbers, sans-serif for text

### 4.2 Color Palette (CSS Variables)

```css
:root {
  /* Backgrounds */
  --bg-primary: #07080a; /* Main background */
  --bg-surface: #0d0f12; /* Cards, panels */
  --bg-surface-2: #13161b; /* Nested surfaces, hover states */
  --bg-surface-3: #191d24; /* Elevated elements */

  /* Borders */
  --border-default: #1c2028; /* Default borders */
  --border-hover: #2a303c; /* Hover state borders */
  --border-active: #3b82f6; /* Active/focused borders */

  /* Text */
  --text-primary: #e8ecf1; /* Primary text — headings, important content */
  --text-secondary: #8b95a5; /* Secondary text — descriptions, labels */
  --text-muted: #5a6478; /* Muted text — timestamps, metadata */
  --text-inverse: #07080a; /* Text on light backgrounds */

  /* Brand / Accent */
  --accent-blue: #3b82f6; /* Primary actions, links, active states */
  --accent-blue-hover: #2563eb; /* Blue hover */
  --accent-blue-dim: #3b82f620; /* Blue backgrounds (low opacity) */
  --accent-indigo: #818cf8; /* Secondary accent */
  --accent-purple: #c084fc; /* Tertiary accent, gradients */

  /* Semantic */
  --color-success: #34d399; /* Green — positive, completed, good scores */
  --color-success-dim: #34d39920;
  --color-warning: #fbbf24; /* Amber — caution, medium scores */
  --color-warning-dim: #fbbf2420;
  --color-danger: #fb7185; /* Rose — errors, negative, low scores */
  --color-danger-dim: #fb718520;
  --color-info: #38bdf8; /* Sky — informational */

  /* Gradient */
  --gradient-brand: linear-gradient(135deg, #3b82f6, #818cf8, #c084fc);

  /* Spacing scale (use Tailwind classes, these are for reference) */
  /* 4px grid: 1=4px, 2=8px, 3=12px, 4=16px, 5=20px, 6=24px, 8=32px, 10=40px, 12=48px */

  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
}
```

### 4.3 Typography

```css
/* Font families */
--font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--font-serif: 'Instrument Serif', Georgia, serif; /* Used ONLY on landing page */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Font sizes (use Tailwind text-* classes) */
/* text-xs: 12px — metadata, timestamps */
/* text-sm: 14px — secondary text, table cells */
/* text-base: 16px — body text */
/* text-lg: 18px — section titles */
/* text-xl: 20px — page subtitles */
/* text-2xl: 24px — page titles */

/* Font weights */
/* font-normal (400) — body text */
/* font-medium (500) — labels, buttons, table headers */
/* font-semibold (600) — headings, emphasis */
/* font-bold (700) — rarely used, only for hero text */
```

**Rules:**

- The app dashboard uses `DM Sans` everywhere — NO serif fonts in the app
- `Instrument Serif` is ONLY for the marketing/landing page
- `JetBrains Mono` for: code blocks, RICE scores, IDs, counts, data values
- Never use font sizes below 12px
- Line height: 1.5 for body text, 1.2 for headings

### 4.4 Component Style Guide

**Buttons:**

```
Primary:   bg-white text-[#07080A] rounded-lg px-4 py-2 font-medium hover:shadow-lg transition
Secondary: bg-[#0D0F12] text-[#E8ECF1] border border-[#1C2028] rounded-lg px-4 py-2 hover:border-[#2A303C]
Ghost:     bg-transparent text-[#8B95A5] px-3 py-1.5 hover:text-[#E8ECF1] hover:bg-[#13161B] rounded-md
Danger:    bg-[#FB718520] text-[#FB7185] rounded-lg px-4 py-2 hover:bg-[#FB718530]
```

**Cards:**

```
bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5
hover: border-[#2A303C] transition-all duration-200
```

**Inputs:**

```
bg-[#0D0F12] border border-[#1C2028] rounded-lg px-3 py-2 text-sm text-[#E8ECF1]
placeholder:text-[#5A6478]
focus: border-[#3B82F6] ring-1 ring-[#3B82F6] outline-none
```

**Sidebar navigation:**

```
Item:   px-3 py-2 rounded-lg text-sm text-[#8B95A5] flex items-center gap-2.5
Active: bg-[#3B82F620] text-[#3B82F6]
Hover:  bg-[#13161B] text-[#E8ECF1]
```

**Badges/Tags:**

```
Score high:   bg-[#34D39920] text-[#34D399] text-xs font-mono font-medium px-2 py-0.5 rounded
Score medium: bg-[#FBBF2420] text-[#FBBF24] ...
Score low:    bg-[#FB718520] text-[#FB7185] ...
Status:       bg-[#3B82F620] text-[#3B82F6] ...
```

**Tables:**

```
Header:    bg-[#0D0F12] text-xs text-[#5A6478] uppercase tracking-wider font-medium
Row:       border-b border-[#1C2028] hover:bg-[#13161B] transition
Cell:      px-4 py-3 text-sm
```

### 4.5 Icons

Use `lucide-react` exclusively. Import individually:

```tsx
import {
  Upload,
  Brain,
  Lightbulb,
  FileText,
  Settings,
  ChevronRight,
  Search,
  Filter,
  Plus,
  X,
  Check,
  AlertCircle,
  BarChart3,
  Users,
  MessageSquare,
  Zap,
  ExternalLink,
  Copy,
  Download,
} from 'lucide-react';
```

Size convention: 16px for inline, 18px for buttons, 20px for navigation, 24px for empty states.

### 4.6 Layout Structure

```
┌──────────────────────────────────────────────────┐
│ Sidebar (240px, fixed)  │  Main Content Area      │
│                         │                         │
│ Logo                    │  Topbar (page title +   │
│ ────────               │   actions)              │
│ 📥 Feedback            │  ─────────────────────  │
│ 🧠 Themes              │                         │
│ 💡 Proposals            │  Page Content           │
│ 📋 Specs                │  (scrollable)           │
│ ─────────              │                         │
│ ⚙️ Settings             │                         │
│                         │                         │
│ ─────────              │                         │
│ Status: X items         │                         │
│ AI: Connected           │                         │
└──────────────────────────────────────────────────┘
```

### 4.7 Animations & Transitions

- **All interactive elements:** `transition-all duration-200 ease-out`
- **Page transitions:** None (instant, like Linear)
- **Cards appearing:** Fade in with subtle translateY (use CSS `@keyframes fadeUp`)
- **Loading states:** Skeleton loaders with shimmer animation, NOT spinners
- **Hover states:** Always have a visible hover state on clickable elements
- **No bouncy/elastic animations** — keep everything crisp and fast

### 4.8 Responsive Breakpoints

- **Desktop (default):** 1280px+ — Full sidebar + content
- **Tablet:** 768-1279px — Collapsible sidebar (icon-only mode)
- **Mobile:** <768px — Bottom navigation bar, full-width content
- **Minimum supported width:** 375px

---

## 5. Feature Specifications

### Feature 1: Feedback Ingestion

#### 1.1 CSV/JSON Import

**Description:** Users can upload CSV or JSON files containing customer feedback. The system auto-detects the content column and maps other columns to metadata fields.

**User flow:**

1. User clicks "Import" button on Feedback page
2. Modal opens with drag-and-drop zone + file picker
3. User drops/selects a CSV or JSON file
4. System parses file, shows preview of first 5 rows
5. System auto-detects content column (highlight it)
6. User can manually remap columns if auto-detection is wrong
7. User confirms import
8. Progress bar shows import status
9. Success toast with count of imported items

**Acceptance Criteria:**

- [ ] Accepts .csv, .json, .jsonl file formats
- [ ] Maximum file size: 50MB
- [ ] Auto-detects content column by checking column names against: "content", "feedback", "text", "message", "comment", "body", "description", "review", "note"
- [ ] If no column name matches, uses the column with the longest average text length
- [ ] Shows preview table with first 5 rows before import
- [ ] User can select which column maps to: content (required), author, email, channel, date
- [ ] Handles CSV edge cases: quoted fields, commas in fields, newlines in fields, UTF-8 BOM
- [ ] Shows progress indicator during import
- [ ] Displays success/error toast notification after import
- [ ] Imports run as background job (BullMQ) for files >100 rows
- [ ] Duplicate detection: skip items with identical content + author + source
- [ ] Empty rows are silently skipped
- [ ] Error rows are logged but don't block import (partial success is OK)

**API Endpoints:**

```
POST /api/feedback/import/csv     — Upload CSV file (multipart/form-data)
POST /api/feedback/import/json    — Upload JSON file (application/json)
GET  /api/feedback/import/:jobId  — Check import job status
```

**Tests Required:**

- Unit: CSV parser handles edge cases (commas in fields, UTF-8, empty rows)
- Unit: Auto-detection picks correct content column
- Unit: Duplicate detection works
- Integration: POST /api/feedback/import/csv with valid CSV returns 201
- Integration: POST /api/feedback/import/csv with empty file returns 400
- Integration: POST /api/feedback/import/csv with >50MB file returns 413
- Integration: GET /api/feedback/import/:jobId returns correct status

#### 1.2 Manual Feedback Entry

**Description:** Users can manually add individual feedback items through a form.

**Acceptance Criteria:**

- [ ] Form fields: content (required, textarea), author (optional), email (optional), channel (dropdown: support_ticket, interview, survey, slack, manual, other)
- [ ] Content field minimum 10 characters
- [ ] Submit creates feedback item immediately
- [ ] Form clears after successful submission
- [ ] Success toast notification

**API Endpoints:**

```
POST /api/feedback          — Create single feedback item
```

**Tests Required:**

- Unit: Validation rejects content <10 chars
- Unit: Validation rejects invalid email format
- Integration: POST /api/feedback with valid data returns 201
- Integration: POST /api/feedback with missing content returns 400

#### 1.3 Webhook API

**Description:** External systems can push feedback in real-time via webhook endpoint.

**Acceptance Criteria:**

- [ ] POST /api/feedback/webhook accepts JSON body
- [ ] Supports single item or array of items
- [ ] Optional API key authentication (configured in settings)
- [ ] Rate limited: 100 requests/minute per API key
- [ ] Returns 201 with created item IDs
- [ ] Webhook URL and API key displayed in Settings page

**API Endpoints:**

```
POST /api/feedback/webhook  — Receive webhook payload
```

**Tests Required:**

- Unit: Validates webhook payload schema
- Integration: POST with valid API key returns 201
- Integration: POST with invalid API key returns 401
- Integration: POST exceeding rate limit returns 429

#### 1.4 Feedback List & Management

**Description:** View, search, filter, and manage all imported feedback.

**Acceptance Criteria:**

- [ ] Table view with columns: content (truncated), author, channel, source, sentiment, date, status (processed/unprocessed)
- [ ] Pagination: 50 items per page, page navigation controls
- [ ] Search: full-text search across content field
- [ ] Filters: by source, by channel, by processed status, by date range, by sentiment range
- [ ] Sort: by date (default: newest first), by sentiment, by urgency
- [ ] Bulk actions: select multiple → delete, mark as processed
- [ ] Click row to expand and see full content + metadata + linked themes
- [ ] Total count displayed: "Showing 1-50 of 1,234 feedback items"

**API Endpoints:**

```
GET    /api/feedback              — List with pagination, search, filters, sort
GET    /api/feedback/:id          — Get single item with full details
DELETE /api/feedback/:id          — Delete single item
POST   /api/feedback/bulk-delete  — Delete multiple items
GET    /api/feedback/stats        — Aggregate statistics
```

**Tests Required:**

- Integration: GET /api/feedback returns paginated results
- Integration: GET /api/feedback?search=keyword filters correctly
- Integration: GET /api/feedback?channel=slack filters correctly
- Integration: DELETE /api/feedback/:id removes item
- Integration: GET /api/feedback/stats returns correct counts

---

### Feature 2: AI Synthesis Engine

#### 2.1 Embedding Generation

**Description:** Generate vector embeddings for all unprocessed feedback items using OpenAI's text-embedding-3-small model.

**Technical Implementation:**

1. BullMQ worker picks up unprocessed feedback items in batches of 100
2. Send batch to OpenAI embeddings API (text-embedding-3-small, 1536 dimensions)
3. Store embeddings in pgvector column on FeedbackItem
4. Mark items as embedded (new field: embeddedAt timestamp)
5. Retry failed items up to 3 times with exponential backoff

**Acceptance Criteria:**

- [ ] Processes unprocessed items in batches of 100
- [ ] Uses text-embedding-3-small model (1536 dimensions)
- [ ] Stores embeddings in pgvector column
- [ ] Handles rate limits gracefully (exponential backoff)
- [ ] Handles API errors without crashing worker
- [ ] Progress tracking: can query how many items are embedded vs total
- [ ] Cost tracking: log token usage per batch
- [ ] Batch processing: does not re-embed already embedded items

**Tests Required:**

- Unit: Batch creation splits items correctly
- Unit: Retry logic works with exponential backoff
- Unit: Already-embedded items are skipped
- Integration: Embedding worker processes items end-to-end (mock OpenAI)

#### 2.2 Feedback Clustering

**Description:** Cluster embedded feedback items into themes using a two-phase approach: vector similarity for initial grouping, then LLM for theme naming and refinement.

**Technical Implementation:**

**Phase 1 — Vector Clustering (server-side JS):**

1. Fetch all embeddings from pgvector
2. Use cosine similarity to build a similarity matrix
3. Apply agglomerative clustering with a configurable similarity threshold (default: 0.82)
4. Items below threshold go into "unclustered" group
5. Result: groups of feedback IDs

**Why not HDBSCAN:** HDBSCAN requires Python + numpy + scikit-learn which adds significant complexity to a Node.js stack. For V1, agglomerative clustering in JS is simpler and sufficient for datasets up to ~10K items. We can add HDBSCAN via a Python microservice later.

**Phase 2 — LLM Theme Generation:**

1. For each cluster, take the top 10 most representative items (closest to centroid)
2. Send to gpt-4o-mini with prompt:
   ```
   Given these customer feedback items, extract:
   1. A short theme name (3-6 words)
   2. A description of the theme (1-2 sentences)
   3. The category: bug, feature_request, ux_issue, performance, documentation, pricing, other
   4. Key pain points mentioned (list of 2-5)
   5. Suggested urgency score (0-1) based on language intensity
   ```
3. Create Theme record and link feedback items via FeedbackThemeLink
4. Calculate theme-level scores: feedbackCount, avgSentiment, avgUrgency

**Acceptance Criteria:**

- [ ] Clusters feedback items based on embedding similarity
- [ ] Configurable similarity threshold (default 0.82, range 0.7-0.95)
- [ ] Generates human-readable theme names via LLM
- [ ] Assigns category to each theme
- [ ] Extracts key pain points per theme
- [ ] Calculates aggregate scores per theme
- [ ] Handles clusters of 1 item (singleton — still creates a theme)
- [ ] Handles unclustered items (labels them as "Uncategorized")
- [ ] Re-running synthesis updates existing themes rather than duplicating
- [ ] Shows progress: "Clustering... Naming themes... Done"
- [ ] Total synthesis time <60 seconds for 1000 feedback items

**API Endpoints:**

```
POST /api/synthesis/run             — Trigger full synthesis pipeline
GET  /api/synthesis/status          — Get current synthesis job status
GET  /api/synthesis/themes          — List all themes with scores
GET  /api/synthesis/themes/:id      — Theme detail with linked feedback
```

**Tests Required:**

- Unit: Cosine similarity calculation is correct
- Unit: Agglomerative clustering produces expected groups for known data
- Unit: LLM prompt formatting is correct
- Unit: Theme score calculation (avg sentiment, avg urgency) is correct
- Integration: POST /api/synthesis/run triggers pipeline (mock OpenAI)
- Integration: GET /api/synthesis/themes returns themes after synthesis

#### 2.3 Sentiment & Urgency Scoring

**Description:** Score each feedback item for sentiment (-1 to 1) and urgency (0 to 1).

**Technical Implementation:**

- Process in batches alongside embedding generation
- Use gpt-4o-mini with a structured output prompt:

  ```
  For each feedback item, return JSON:
  { "sentiment": <float -1 to 1>, "urgency": <float 0 to 1> }

  Sentiment: -1 = very negative, 0 = neutral, 1 = very positive
  Urgency: 0 = no urgency, 1 = critical/blocking user
  ```

- Batch up to 20 items per LLM call to reduce API costs

**Acceptance Criteria:**

- [ ] Every feedback item gets a sentiment score (-1 to 1)
- [ ] Every feedback item gets an urgency score (0 to 1)
- [ ] Scores stored on FeedbackItem model
- [ ] Batch processing (20 items per LLM call)
- [ ] Scoring runs as part of synthesis pipeline (after embeddings, before clustering)

**Tests Required:**

- Unit: Score parsing handles valid JSON
- Unit: Score parsing handles malformed LLM output gracefully (default to 0)
- Unit: Batch creation groups items correctly

---

### Feature 3: Feature Proposals

#### 3.1 Proposal Generation

**Description:** Generate ranked feature proposals from synthesized themes with evidence linking.

**Technical Implementation:**

1. Take top N themes by opportunity score (default: top 20)
2. For each theme, send to gpt-4o-mini:

   ```
   Based on this customer feedback theme:
   Theme: {name}
   Description: {description}
   Pain points: {painPoints}
   Sample feedback: {top 5 feedback items}
   Feedback count: {count}
   Average sentiment: {sentiment}
   Average urgency: {urgency}

   Generate a feature proposal with:
   1. Title (concise, actionable — "Add bulk export functionality")
   2. Problem statement (2-3 sentences)
   3. Proposed solution (2-3 sentences)
   4. Impact estimate (1-10): how much this would improve user experience
   5. Effort estimate (1-10): how complex this is to build
   6. Confidence score (1-10): how confident are we this is the right solution
   7. Reach estimate (1-10): what % of users would benefit
   ```

3. Calculate RICE score: (Reach × Impact × Confidence) / Effort
4. Link top evidence (feedback items most similar to the proposal theme)
5. Store as Proposal with status "proposed"

**Acceptance Criteria:**

- [ ] Generates proposals from top themes
- [ ] Each proposal has: title, problem, solution, impact/effort/confidence/reach scores
- [ ] RICE score calculated automatically
- [ ] Each proposal linked to source theme
- [ ] Each proposal linked to evidence (top 10 feedback items from theme)
- [ ] Evidence includes a "quote" — the most relevant sentence from each feedback item
- [ ] Proposals ordered by RICE score (highest first)
- [ ] Can regenerate proposals (replaces existing "proposed" status proposals for same theme)
- [ ] Status workflow: proposed → approved → rejected → shipped

**API Endpoints:**

```
POST  /api/proposals/generate           — Generate proposals from themes
GET   /api/proposals                    — List proposals (filterable by status)
GET   /api/proposals/:id                — Proposal detail with evidence
PATCH /api/proposals/:id                — Update proposal (scores, status)
DELETE /api/proposals/:id               — Delete proposal
```

**Tests Required:**

- Unit: RICE score calculation: (R × I × C) / E
- Unit: Evidence linking selects top items from theme
- Unit: Proposal generation prompt formatting
- Integration: POST /api/proposals/generate creates proposals (mock OpenAI)
- Integration: GET /api/proposals returns sorted by RICE score
- Integration: PATCH /api/proposals/:id/status updates status correctly

#### 3.2 Proposal Management UI

**Acceptance Criteria:**

- [ ] Card-based view showing: title, problem summary, RICE score badge, evidence count, status badge
- [ ] Click card to open detail view
- [ ] Detail view shows: full description, problem, solution, all scores with visual bars, evidence panel with linked feedback quotes
- [ ] Can approve/reject proposal with one click
- [ ] Can edit scores manually (overrides AI estimates)
- [ ] Filter by status: all, proposed, approved, rejected, shipped
- [ ] Sort by: RICE score, date created, feedback count

---

### Feature 4: Spec Generation

#### 4.1 PRD Generation

**Description:** Generate a full PRD from an approved proposal.

**Technical Implementation:**

- Takes an approved proposal + its evidence
- Sends to gpt-4o-mini with comprehensive prompt:

  ```
  Generate a PRD for this feature:
  Title: {title}
  Problem: {problem}
  Solution: {solution}
  Evidence: {top feedback quotes}

  Output a complete PRD in Markdown with these sections:
  1. Overview (2-3 sentences)
  2. Problem Statement
  3. User Stories (as a user, I want... so that...)
  4. Acceptance Criteria (testable, specific)
  5. Edge Cases
  6. Data Model Changes (if any — new tables, fields, migrations)
  7. API Changes (if any — new endpoints, request/response shapes)
  8. UI/UX Requirements (key screens, interactions)
  9. Out of Scope (what this does NOT include)
  10. Open Questions
  ```

**Acceptance Criteria:**

- [ ] Generates full PRD in Markdown format
- [ ] PRD includes all 10 sections listed above
- [ ] PRD rendered in a preview panel with Markdown formatting
- [ ] Can copy PRD as Markdown
- [ ] Can download PRD as .md file
- [ ] Can regenerate PRD (replaces existing)
- [ ] PRD stored on Spec model linked to Proposal

**API Endpoints:**

```
POST /api/specs/generate/:proposalId    — Generate spec from proposal
GET  /api/specs/:id                     — Get generated spec
GET  /api/specs/:id/prd                 — Get just the PRD markdown
```

**Tests Required:**

- Unit: Prompt includes all proposal data
- Integration: POST /api/specs/generate/:proposalId creates spec (mock OpenAI)
- Integration: GET /api/specs/:id returns full spec

#### 4.2 Agent-Ready Prompt Export

**Description:** Generate a prompt formatted for Cursor or Claude Code that an engineer can paste to implement the feature.

**Technical Implementation:**

- Takes the generated PRD + proposal data
- Formats into a structured development prompt:

  ```
  ## Task
  Implement the following feature: {title}

  ## Context
  {problem statement}

  ## Requirements
  {acceptance criteria from PRD}

  ## Data Model Changes
  {schema changes}

  ## API Endpoints to Create/Modify
  {API spec}

  ## UI Changes
  {UI requirements}

  ## Edge Cases to Handle
  {edge cases}

  ## Tests to Write
  {list of test cases}
  ```

**Acceptance Criteria:**

- [ ] Generates a copy-pasteable prompt for coding agents
- [ ] Prompt includes: task summary, requirements, data model, API spec, UI spec, edge cases, test cases
- [ ] "Copy to clipboard" button
- [ ] Format toggle: "Cursor" vs "Claude Code" (slightly different formatting)
- [ ] Preview shows the formatted prompt

---

### Feature 5: Dashboard

**Description:** Overview page showing key metrics and recent activity.

**Acceptance Criteria:**

- [ ] Stat cards: Total feedback, Themes discovered, Proposals generated, Specs created
- [ ] Each stat card shows count + trend (↑12% this week)
- [ ] Recent activity feed: last 10 actions (imports, synthesis runs, proposals generated)
- [ ] Top themes chart: horizontal bar chart showing top 5 themes by feedback count
- [ ] Sentiment distribution: simple gauge or bar showing overall sentiment
- [ ] Quick actions: "Import Feedback", "Run Synthesis", "Generate Proposals"
- [ ] Empty state: when no data, show onboarding steps (1. Import feedback, 2. Run synthesis, etc.)

---

### Feature 6: Settings

**Acceptance Criteria:**

- [ ] AI Configuration: API key input (masked), model selection dropdown, test connection button
- [ ] Synthesis Settings: similarity threshold slider (0.7–0.95), minimum cluster size
- [ ] Data Management: export all data as JSON, delete all data (with confirmation)
- [ ] Webhook: display webhook URL, generate/regenerate API key
- [ ] About: version number, GitHub link, documentation link

---

## 6. Testing Strategy

### 6.1 Testing Stack

```
Framework:    Vitest
API Testing:  Supertest
Mocking:      vitest-mock-extended (for Prisma)
Coverage:     V8 coverage via Vitest
```

### 6.2 Test Types & Requirements

**Unit Tests (packages/api/tests/unit/):**

- Test all service functions in isolation
- Mock Prisma client using vitest-mock-extended
- Mock OpenAI client
- Test validation schemas
- Test utility functions
- Target: >80% code coverage on services

**Integration Tests (packages/api/tests/integration/):**

- Test each API route end-to-end
- Use a real test database (separate DB via .env.test)
- Seed test data before suites, clean up after
- Test both success and error paths
- Test pagination, filtering, sorting
- Target: Every endpoint has at least success + error test

**Frontend Tests (future — not required for V1):**

- Component tests with Vitest + React Testing Library
- Not required for MVP, add when stabilized

### 6.3 Test Setup

```typescript
// packages/api/tests/setup.ts
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Run migrations on test DB
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
});

beforeEach(async () => {
  // Clean all tables before each test
  await prisma.$transaction([
    prisma.proposalEvidence.deleteMany(),
    prisma.spec.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.feedbackThemeLink.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.feedbackItem.deleteMany(),
    prisma.feedbackSource.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### 6.4 Test Naming Convention

```
describe('FeedbackService', () => {
  describe('createFeedbackItem', () => {
    it('should create a feedback item with valid data', async () => {});
    it('should throw if content is empty', async () => {});
    it('should trim whitespace from content', async () => {});
  });
});
```

Pattern: `should [expected behavior] when [condition]`

### 6.5 Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/api/tests/**/*.test.ts'],
    setupFiles: ['packages/api/tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/api/src/services/**'],
    },
  },
});
```

---

## 7. Code Conventions

### 7.1 General Rules

- **Language:** TypeScript everywhere. No `any` types. Use `unknown` + type guards.
- **Formatting:** Prettier with defaults (2 space indent, single quotes, trailing commas)
- **Linting:** ESLint with typescript-eslint recommended rules
- **Imports:** Named imports only. No default exports except for pages and the Express app.
- **File naming:** kebab-case for files (`feedback.service.ts`), PascalCase for React components (`FeedbackTable.tsx`)
- **Variable naming:** camelCase for variables/functions, PascalCase for types/interfaces/classes, UPPER_SNAKE for constants
- **Comments:** Comment the WHY, never the WHAT. No commented-out code.
- **No console.log in production code.** Use a logger (console.log OK in development).

### 7.2 Backend Patterns

**Service Layer Pattern:**
Routes should ONLY handle HTTP concerns (parsing request, sending response). All business logic goes in service functions.

```typescript
// ❌ BAD — logic in route
router.post('/', async (req, res) => {
  const data = req.body;
  const existing = await prisma.feedbackItem.findFirst({ where: { content: data.content } });
  if (existing) return res.status(409).json({ error: 'Duplicate' });
  const item = await prisma.feedbackItem.create({ data });
  res.status(201).json(item);
});

// ✅ GOOD — logic in service, route is thin
router.post('/', validate(feedbackSchema), async (req, res) => {
  const item = await feedbackService.create(req.body);
  res.status(201).json(item);
});
```

**Prisma Singleton:**

```typescript
// packages/api/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Error Handling:**

```typescript
// Custom error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// In services — throw AppError
throw new AppError(404, 'Feedback item not found');

// In error handler middleware — catch and respond
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

**Zod Validation Middleware:**

```typescript
// packages/api/src/middleware/validate.ts
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
```

### 7.3 Frontend Patterns

**API Client:**

```typescript
// packages/web/src/lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});
```

**Custom Hooks with React Query:**

```typescript
// packages/web/src/hooks/useFeedback.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useFeedback(params?: { page?: number; search?: string }) {
  return useQuery({
    queryKey: ['feedback', params],
    queryFn: () => api.get('/feedback', { params }).then((r) => r.data),
  });
}

export function useImportCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/feedback/import/csv', form).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}
```

**Component Structure:**

```tsx
// Every component follows this structure:
// 1. Imports
// 2. Types/interfaces
// 3. Component function
// 4. Named export

import { useState } from 'react';
import { Upload } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);

  if (!isOpen) return null;

  return <div className="...">{/* content */}</div>;
}

export { ImportModal };
```

### 7.4 Git Conventions

**Branch naming:**

```
feat/feedback-import
fix/csv-parser-utf8
chore/update-dependencies
docs/api-reference
```

**Commit messages (Conventional Commits):**

```
feat: add CSV feedback import with auto-detection
fix: handle UTF-8 BOM in CSV files
test: add integration tests for feedback routes
docs: update API reference for webhook endpoint
chore: upgrade prisma to 5.15
refactor: extract embedding logic into service
```

---

## 8. AI Prompt Templates

All AI prompts are stored in `packages/core/src/prompts/` as template functions. This makes them version-controlled, testable, and tweakable without changing business logic.

### 8.1 Sentiment & Urgency Scoring

```typescript
export function buildScoringPrompt(items: { id: string; content: string }[]): string {
  return `You are analyzing customer feedback for a product team.

For each feedback item below, provide:
- sentiment: float from -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
- urgency: float from 0.0 (not urgent, suggestion) to 1.0 (critical, blocking user).

Respond ONLY with a JSON array. No explanation. No markdown.

Feedback items:
${items.map((item, i) => `[${i}] ${item.content}`).join('\n')}

Response format:
[
  { "index": 0, "sentiment": -0.7, "urgency": 0.8 },
  ...
]`;
}
```

### 8.2 Theme Extraction

```typescript
export function buildThemeExtractionPrompt(feedbackItems: string[]): string {
  return `You are analyzing a cluster of related customer feedback items.

These items were grouped by semantic similarity. Your job is to identify the common theme.

Feedback items in this cluster:
${feedbackItems.map((item, i) => `${i + 1}. "${item}"`).join('\n')}

Respond with JSON only:
{
  "name": "Short theme name (3-6 words)",
  "description": "What users are saying, in 1-2 sentences",
  "category": "bug" | "feature_request" | "ux_issue" | "performance" | "documentation" | "pricing" | "other",
  "painPoints": ["pain point 1", "pain point 2", ...],
  "suggestedUrgency": 0.0 to 1.0
}`;
}
```

### 8.3 Proposal Generation

```typescript
export function buildProposalPrompt(theme: ThemeWithEvidence): string {
  return `You are a senior product manager analyzing customer feedback themes to generate feature proposals.

Theme: ${theme.name}
Description: ${theme.description}
Category: ${theme.category}
Pain Points: ${theme.painPoints.join(', ')}
Feedback Count: ${theme.feedbackCount}
Average Sentiment: ${theme.avgSentiment}
Average Urgency: ${theme.avgUrgency}

Sample feedback (top 5 by relevance):
${theme.sampleFeedback.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

Generate a feature proposal. Respond with JSON only:
{
  "title": "Concise, actionable title (e.g., 'Add bulk export to CSV')",
  "problem": "2-3 sentence problem statement",
  "solution": "2-3 sentence proposed solution",
  "impactScore": 1-10,
  "effortScore": 1-10,
  "confidenceScore": 1-10,
  "reachScore": 1-10
}`;
}
```

### 8.4 PRD Generation

```typescript
export function buildPRDPrompt(proposal: ProposalWithEvidence): string {
  return `You are a senior product manager writing a PRD (Product Requirements Document).

Feature: ${proposal.title}
Problem: ${proposal.problem}
Solution: ${proposal.solution}

Supporting evidence from ${proposal.evidenceCount} user feedback items:
${proposal.evidence.map((e, i) => `${i + 1}. "${e.quote}" — ${e.author || 'Anonymous'} (${e.channel})`).join('\n')}

Write a complete PRD in Markdown with these exact sections:

# ${proposal.title}

## Overview
(2-3 sentence summary)

## Problem Statement
(Detailed problem with user impact)

## User Stories
(3-5 user stories in "As a [user], I want [action] so that [benefit]" format)

## Acceptance Criteria
(Numbered list of testable, specific criteria)

## Edge Cases
(List of edge cases to handle)

## Data Model Changes
(Any new tables, fields, or migrations needed. Say "None" if not applicable)

## API Changes
(Any new or modified endpoints with request/response shapes. Say "None" if not applicable)

## UI/UX Requirements
(Key screens, interactions, states)

## Out of Scope
(What this feature does NOT include)

## Open Questions
(Unresolved decisions that need discussion)`;
}
```

---

## 9. Database Seed Data

Create realistic sample data for demos and development in `packages/api/prisma/seed.ts`.

**Sample dataset theme: A fictional B2B project management tool called "TaskFlow"**

Generate 200 realistic feedback items across these channels:

- 80 support tickets (Intercom-style)
- 40 user interview excerpts
- 30 survey responses
- 30 Slack messages
- 20 app store reviews

Covering these realistic themes:

1. Bulk export functionality (high demand)
2. Real-time notifications (medium demand)
3. Mobile app performance (bugs)
4. Custom dashboard widgets (enterprise ask)
5. API rate limiting issues (developer pain)
6. Onboarding flow confusion (UX issue)
7. Pricing tier complaints (pricing)
8. Dark mode request (feature request)

---

## 10. Implementation Order

### Phase 1: Foundation (Days 1-3)

1. Set up monorepo with proper tsconfig, eslint, prettier
2. Initialize Vite + React + Tailwind frontend with layout shell
3. Set up Prisma schema + migrations + seed data
4. Set up Express with proper middleware stack
5. Implement health check endpoint with tests
6. Docker Compose working for dev (Postgres + Redis)

### Phase 2: Feedback Ingestion (Days 4-7)

7. Implement feedback CRUD service + routes
8. Implement CSV import with auto-detection
9. Build feedback list page with table, pagination, search, filters
10. Build CSV import modal UI
11. Write all unit + integration tests for feedback

### Phase 3: AI Synthesis (Days 8-12)

12. Implement OpenAI client + embedding generation worker
13. Implement clustering algorithm
14. Implement LLM theme extraction
15. Implement sentiment + urgency scoring
16. Build themes page UI
17. Write all tests for synthesis pipeline

### Phase 4: Proposals (Days 13-16)

18. Implement proposal generation service
19. Implement RICE scoring
20. Build proposals page UI with cards + detail view
21. Implement evidence linking UI
22. Write all tests for proposals

### Phase 5: Specs (Days 17-20)

23. Implement PRD generation service
24. Implement agent prompt export
25. Build spec viewer UI with Markdown rendering
26. Build copy/download functionality
27. Write all tests for specs

### Phase 6: Dashboard & Settings (Days 21-23)

28. Build dashboard page with stat cards + charts
29. Build settings page
30. Implement empty states + onboarding flow

### Phase 7: Polish & Launch Prep (Days 24-28)

31. Docker build for production deployment
32. README update with GIF demo
33. Record demo video
34. Performance optimization (lazy loading, query optimization)
35. Security audit (input sanitization, rate limiting, CORS)
36. Write self-hosting documentation

---

## 11. Definition of Done

A feature is considered "done" when:

1. All acceptance criteria are met
2. Unit tests pass with >80% coverage on the service layer
3. Integration tests pass for all endpoints
4. No TypeScript errors (`tsc --noEmit` passes)
5. No ESLint errors
6. UI matches the design system defined in Section 4
7. Works in Docker Compose deployment
8. Handles error states gracefully (loading, empty, error)
9. Accessible via keyboard navigation
10. Responsive down to 768px minimum
