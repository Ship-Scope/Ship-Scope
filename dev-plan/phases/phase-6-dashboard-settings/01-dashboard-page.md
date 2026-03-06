# 01 -- Dashboard Page

## Objective

Build the main dashboard overview page that serves as the application home screen. It displays four stat cards with weekly trend percentages, a recent activity feed, a top themes horizontal bar chart, a sentiment distribution gauge, and quick action buttons. The page aggregates data from all entity tables via dedicated API endpoints, providing a single-glance summary of the user's feedback intelligence pipeline.

## Dependencies

- Phase 5 complete (Specs exist so all four entity counts are available)
- Phase 1: Frontend scaffold (Shell, Sidebar, Topbar, PageContainer, UI primitives)
- Phase 2: Feedback service (feedback count queries)
- Phase 3: Synthesis service (theme counts, sentiment data)
- Phase 4: Proposal service (proposal counts)
- Phase 5: Spec service (spec counts)
- Prisma schema: new `ActivityLog` model (created in this task)

## Files to Create

| File                                                       | Purpose                                        |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `packages/api/src/routes/dashboard.ts`                     | Dashboard API route handlers                   |
| `packages/api/src/services/dashboard.service.ts`           | Stats aggregation, activity feed, chart data   |
| `packages/api/src/services/activity.service.ts`            | ActivityLog CRUD (create entries, list recent) |
| `packages/web/src/pages/DashboardPage.tsx`                 | Main dashboard page (replace placeholder)      |
| `packages/web/src/components/dashboard/StatCard.tsx`       | Individual stat card with trend indicator      |
| `packages/web/src/components/dashboard/ActivityFeed.tsx`   | Recent activity list                           |
| `packages/web/src/components/dashboard/TopThemesChart.tsx` | Horizontal bar chart for top 5 themes          |
| `packages/web/src/components/dashboard/SentimentGauge.tsx` | Sentiment distribution visualization           |
| `packages/web/src/components/dashboard/QuickActions.tsx`   | Quick action button group                      |
| `packages/web/src/hooks/useDashboard.ts`                   | React Query hooks for dashboard data           |

## Files to Modify

| File                                             | Changes                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `packages/api/prisma/schema.prisma`              | Add `ActivityLog` model                     |
| `packages/api/src/index.ts`                      | Import and mount dashboard routes           |
| `packages/web/src/lib/api.ts`                    | Add dashboard API functions                 |
| `packages/api/src/services/feedback.service.ts`  | Add activity logging to import operations   |
| `packages/api/src/services/synthesis.service.ts` | Add activity logging to synthesis runs      |
| `packages/api/src/services/proposal.service.ts`  | Add activity logging to proposal generation |
| `packages/api/src/services/spec.service.ts`      | Add activity logging to spec generation     |

## Detailed Sub-Tasks

### 1. Add ActivityLog model to Prisma schema

Add the model and run migration. This table is append-only and stores discrete events for the activity feed.

```prisma
// packages/api/prisma/schema.prisma

model ActivityLog {
  id          String   @id @default(cuid())
  type        String   // 'import', 'synthesis', 'proposal_generation', 'spec_generation'
  description String   // "Imported 150 feedback items from CSV"
  metadata    Json?    // { count: 150, source: 'csv', durationMs: 3200 }
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@map("activity_log")
}
```

Run migration:

```bash
cd packages/api && npx prisma migrate dev --name add_activity_log
```

### 2. Build the activity service (`packages/api/src/services/activity.service.ts`)

A thin service for creating and querying activity log entries. Other services call `activityService.log()` after completing significant operations.

```typescript
import { prisma } from '../lib/prisma';

export type ActivityType = 'import' | 'synthesis' | 'proposal_generation' | 'spec_generation';

interface LogActivityInput {
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Record an activity event. Fire-and-forget — errors are logged
   * but never propagated to the caller.
   */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          type: input.type,
          description: input.description,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch (err) {
      console.error('[ActivityService] Failed to log activity:', err);
      // Swallow error — activity logging must never break the main flow
    }
  },

  /**
   * Fetch the most recent N activity entries.
   */
  async getRecent(limit: number = 10) {
    return prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });
  },
};
```

### 3. Build the dashboard service (`packages/api/src/services/dashboard.service.ts`)

This service contains all aggregation logic. Each method runs optimized Prisma queries.

**Function: `getStats()`**

Returns counts and trend data for all four entity types:

```typescript
import { prisma } from '../lib/prisma';

interface EntityStat {
  total: number;
  currentWeek: number;
  previousWeek: number;
  trendPercent: number; // e.g., 12.5 means +12.5%
  trendDirection: 'up' | 'down' | 'flat';
}

interface DashboardStats {
  feedback: EntityStat;
  themes: EntityStat;
  proposals: EntityStat;
  specs: EntityStat;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Run all 12 queries in parallel via Promise.all for minimum latency
    const [
      feedbackTotal,
      feedbackCurrent,
      feedbackPrevious,
      themesTotal,
      themesCurrent,
      themesPrevious,
      proposalsTotal,
      proposalsCurrent,
      proposalsPrevious,
      specsTotal,
      specsCurrent,
      specsPrevious,
    ] = await Promise.all([
      prisma.feedbackItem.count(),
      prisma.feedbackItem.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.feedbackItem.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
      prisma.theme.count(),
      prisma.theme.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.theme.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
      prisma.proposal.count(),
      prisma.proposal.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.proposal.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
      prisma.spec.count(),
      prisma.spec.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.spec.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    ]);

    return {
      feedback: buildEntityStat(feedbackTotal, feedbackCurrent, feedbackPrevious),
      themes: buildEntityStat(themesTotal, themesCurrent, themesPrevious),
      proposals: buildEntityStat(proposalsTotal, proposalsCurrent, proposalsPrevious),
      specs: buildEntityStat(specsTotal, specsCurrent, specsPrevious),
    };
  },

  async getTopThemes(limit: number = 5) {
    return prisma.theme.findMany({
      orderBy: { feedbackCount: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        feedbackCount: true,
        category: true,
      },
    });
  },

  async getSentimentDistribution() {
    // Use raw query for bucketed aggregation
    const [stats] = await prisma.$queryRaw<
      { avg_sentiment: number; negative: bigint; neutral: bigint; positive: bigint }[]
    >`
      SELECT
        COALESCE(AVG(sentiment), 0) as avg_sentiment,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment < -0.3) as negative,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment >= -0.3 AND sentiment <= 0.3) as neutral,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment > 0.3) as positive
      FROM "FeedbackItem"
      WHERE sentiment IS NOT NULL
    `;

    return {
      average: Number(stats.avg_sentiment),
      negative: Number(stats.negative),
      neutral: Number(stats.neutral),
      positive: Number(stats.positive),
      total: Number(stats.negative) + Number(stats.neutral) + Number(stats.positive),
    };
  },
};

/**
 * Calculate trend percentage from current vs previous week counts.
 *
 * Formula: ((current - previous) / previous) * 100
 * Edge cases:
 *   - previous = 0, current > 0 → +100% (new growth from zero)
 *   - previous = 0, current = 0 → 0% (flat)
 *   - previous > 0, current = 0 → -100% (complete drop-off)
 */
function buildEntityStat(total: number, current: number, previous: number): EntityStat {
  let trendPercent = 0;
  if (previous === 0 && current > 0) {
    trendPercent = 100;
  } else if (previous === 0 && current === 0) {
    trendPercent = 0;
  } else if (previous > 0) {
    trendPercent = Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  const trendDirection: EntityStat['trendDirection'] =
    trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'flat';

  return { total, currentWeek: current, previousWeek: previous, trendPercent, trendDirection };
}
```

### 4. Build dashboard routes (`packages/api/src/routes/dashboard.ts`)

Thin route handlers that call the dashboard and activity services.

```typescript
import { Router } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { activityService } from '../services/activity.service';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await dashboardService.getStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/activity
router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const activity = await activityService.getRecent(limit);
    res.json({ data: activity });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/top-themes
router.get('/top-themes', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const themes = await dashboardService.getTopThemes(limit);
    res.json({ data: themes });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/sentiment
router.get('/sentiment', async (_req, res, next) => {
  try {
    const sentiment = await dashboardService.getSentimentDistribution();
    res.json({ data: sentiment });
  } catch (err) {
    next(err);
  }
});

export { router as dashboardRouter };
```

Mount in `packages/api/src/index.ts`:

```typescript
import { dashboardRouter } from './routes/dashboard';
app.use('/api/dashboard', dashboardRouter);
```

### 5. Integrate activity logging into existing services

Add `activityService.log()` calls to the services from Phases 2-5. These are fire-and-forget calls placed after the main operation succeeds.

```typescript
// In feedback.service.ts — after successful CSV/JSON import:
await activityService.log({
  type: 'import',
  description: `Imported ${count} feedback items from ${format.toUpperCase()}`,
  metadata: { count, format, duplicatesSkipped, durationMs },
});

// In synthesis.service.ts (orchestrator) — after synthesis completes:
await activityService.log({
  type: 'synthesis',
  description: `Synthesis complete: ${themeCount} themes discovered from ${feedbackCount} items`,
  metadata: { themeCount, feedbackCount, durationMs, tokensUsed },
});

// In proposal.service.ts — after generation completes:
await activityService.log({
  type: 'proposal_generation',
  description: `Generated ${result.proposalsCreated} proposals (${result.proposalsSkipped} skipped)`,
  metadata: {
    created: result.proposalsCreated,
    skipped: result.proposalsSkipped,
    errors: result.errors.length,
  },
});

// In spec.service.ts — after spec generation:
await activityService.log({
  type: 'spec_generation',
  description: `Generated spec "${spec.title}" from proposal`,
  metadata: { specId: spec.id, proposalId, tokensUsed },
});
```

### 6. Create frontend API functions and hooks

**API functions (`packages/web/src/lib/api.ts`):**

```typescript
export const dashboardApi = {
  stats: () => api.get<{ data: DashboardStats }>('/dashboard/stats').then((r) => r.data.data),

  activity: (limit = 10) =>
    api
      .get<{ data: ActivityEntry[] }>('/dashboard/activity', { params: { limit } })
      .then((r) => r.data.data),

  topThemes: (limit = 5) =>
    api
      .get<{ data: TopTheme[] }>('/dashboard/top-themes', { params: { limit } })
      .then((r) => r.data.data),

  sentiment: () =>
    api.get<{ data: SentimentDistribution }>('/dashboard/sentiment').then((r) => r.data.data),
};
```

**React Query hooks (`packages/web/src/hooks/useDashboard.ts`):**

```typescript
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 30_000, // Stats are reasonably fresh for 30s
    refetchOnWindowFocus: true, // Refresh when user returns to tab
  });
}

export function useActivityFeed(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => dashboardApi.activity(limit),
    staleTime: 15_000, // Activity can change more frequently
  });
}

export function useTopThemes(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-themes', limit],
    queryFn: () => dashboardApi.topThemes(limit),
    staleTime: 60_000, // Theme rankings change infrequently
  });
}

export function useSentimentDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'sentiment'],
    queryFn: () => dashboardApi.sentiment(),
    staleTime: 60_000,
  });
}
```

### 7. Build StatCard component (`packages/web/src/components/dashboard/StatCard.tsx`)

Each stat card shows a label, a large count in JetBrains Mono, and a trend indicator.

```
┌──────────────────────────────┐
│  📥  Total Feedback          │
│                              │
│  1,234           ↑ 12%      │
│  ▔▔▔▔▔           this week  │
│  (font-mono 3xl)             │
└──────────────────────────────┘
```

```typescript
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  trendPercent: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export function StatCard({ label, icon, value, trendPercent, trendDirection }: StatCardProps) {
  const trendColor = {
    up: 'text-[#34D399]',       // success green
    down: 'text-[#FB7185]',     // danger rose
    flat: 'text-[#8B95A5]',     // secondary text
  }[trendDirection];

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
  }[trendDirection];

  return (
    <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5
                    hover:border-[#2A303C] transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#8B95A5] font-medium">{label}</span>
        <span className="text-[#5A6478]">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-semibold font-mono text-[#E8ECF1]">
          {value.toLocaleString()}
        </span>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon size={14} />
          <span>{Math.abs(trendPercent)}%</span>
        </div>
      </div>
      <p className="text-xs text-[#5A6478] mt-1">this week</p>
    </div>
  );
}
```

### 8. Build ActivityFeed component (`packages/web/src/components/dashboard/ActivityFeed.tsx`)

Displays the 10 most recent activity log entries with type-specific icons and relative timestamps.

```
┌──────────────────────────────────────────────────────┐
│  Recent Activity                                      │
│──────────────────────────────────────────────────────│
│  📥  Imported 150 feedback items from CSV    2h ago   │
│  🧠  Synthesis complete: 12 themes discovered 1d ago  │
│  💡  Generated 8 proposals (2 skipped)        1d ago  │
│  📋  Generated spec "Bulk Export" from proposal 3d ago│
│  ...                                                  │
└──────────────────────────────────────────────────────┘
```

```typescript
import { Upload, Brain, Lightbulb, FileText } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  import: <Upload size={16} className="text-[#3B82F6]" />,
  synthesis: <Brain size={16} className="text-[#C084FC]" />,
  proposal_generation: <Lightbulb size={16} className="text-[#FBBF24]" />,
  spec_generation: <FileText size={16} className="text-[#34D399]" />,
};

interface ActivityEntry {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-[#5A6478] text-sm">
        No activity yet. Import some feedback to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg
                     hover:bg-[#13161B] transition-colors duration-150"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#13161B]
                          flex items-center justify-center">
            {TYPE_ICONS[activity.type] ?? <FileText size={16} className="text-[#5A6478]" />}
          </div>
          <p className="flex-1 text-sm text-[#E8ECF1] truncate">
            {activity.description}
          </p>
          <time className="flex-shrink-0 text-xs text-[#5A6478] font-mono">
            {formatRelativeTime(activity.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
```

### 9. Build TopThemesChart component (`packages/web/src/components/dashboard/TopThemesChart.tsx`)

A pure-CSS horizontal bar chart showing the top 5 themes by feedback count. The longest bar fills 100% of the available width; others scale proportionally.

```
┌──────────────────────────────────────────────────────┐
│  Top Themes                                           │
│──────────────────────────────────────────────────────│
│  Bulk Export Issues     ████████████████████████  30  │
│  Mobile Performance     ██████████████████████   25  │
│  Search UX              ████████████████          18  │
│  Onboarding Flow        ██████████████            15  │
│  Pricing Confusion      ████████                   9  │
└──────────────────────────────────────────────────────┘
```

```typescript
interface TopTheme {
  id: string;
  name: string;
  feedbackCount: number;
  category: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  bug: '#FB7185',
  feature_request: '#3B82F6',
  ux_issue: '#FBBF24',
  performance: '#F97316',
  integration: '#818CF8',
  default: '#8B95A5',
};

export function TopThemesChart({ themes }: { themes: TopTheme[] }) {
  const maxCount = Math.max(...themes.map(t => t.feedbackCount), 1);

  return (
    <div className="space-y-3">
      {themes.map((theme) => {
        const widthPercent = (theme.feedbackCount / maxCount) * 100;
        const color = CATEGORY_COLORS[theme.category ?? 'default'] ?? CATEGORY_COLORS.default;

        return (
          <div key={theme.id} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#E8ECF1] truncate max-w-[70%]">
                {theme.name}
              </span>
              <span className="text-xs font-mono text-[#8B95A5]">
                {theme.feedbackCount}
              </span>
            </div>
            <div className="h-2 bg-[#13161B] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: color,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 10. Build SentimentGauge component (`packages/web/src/components/dashboard/SentimentGauge.tsx`)

A horizontal stacked bar showing the proportion of negative, neutral, and positive feedback, with the average sentiment displayed prominently.

```
┌──────────────────────────────────────────────────────┐
│  Sentiment Distribution                               │
│──────────────────────────────────────────────────────│
│                                                       │
│     Average:  +0.12                                   │
│                                                       │
│  ████████░░░░░░░░░░░░░░░░░░░████████████████████     │
│  Negative(18%)    Neutral(42%)     Positive(40%)      │
│                                                       │
│  🔴 85     ⚪ 198     🟢 189                          │
└──────────────────────────────────────────────────────┘
```

```typescript
interface SentimentDistribution {
  average: number;
  negative: number;
  neutral: number;
  positive: number;
  total: number;
}

export function SentimentGauge({ data }: { data: SentimentDistribution }) {
  const { negative, neutral, positive, total, average } = data;
  if (total === 0) {
    return (
      <div className="text-center py-8 text-[#5A6478] text-sm">
        No sentiment data yet. Run synthesis to analyze feedback.
      </div>
    );
  }

  const negPct = Math.round((negative / total) * 100);
  const neuPct = Math.round((neutral / total) * 100);
  const posPct = 100 - negPct - neuPct; // Avoid rounding drift

  // Average sentiment color: red for negative, yellow for neutral, green for positive
  const avgColor =
    average < -0.3 ? 'text-[#FB7185]' :
    average > 0.3 ? 'text-[#34D399]' :
    'text-[#FBBF24]';

  return (
    <div>
      {/* Average display */}
      <div className="text-center mb-4">
        <span className="text-xs text-[#5A6478] uppercase tracking-wider">Average</span>
        <p className={`text-2xl font-mono font-semibold ${avgColor}`}>
          {average >= 0 ? '+' : ''}{average.toFixed(2)}
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-3 flex rounded-full overflow-hidden bg-[#13161B]">
        {negPct > 0 && (
          <div
            className="h-full bg-[#FB7185] transition-all duration-500"
            style={{ width: `${negPct}%` }}
          />
        )}
        {neuPct > 0 && (
          <div
            className="h-full bg-[#FBBF24] transition-all duration-500"
            style={{ width: `${neuPct}%` }}
          />
        )}
        {posPct > 0 && (
          <div
            className="h-full bg-[#34D399] transition-all duration-500"
            style={{ width: `${posPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-between mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FB7185]" />
          <span className="text-[#8B95A5]">Negative</span>
          <span className="font-mono text-[#E8ECF1]">{negative}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
          <span className="text-[#8B95A5]">Neutral</span>
          <span className="font-mono text-[#E8ECF1]">{neutral}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#34D399]" />
          <span className="text-[#8B95A5]">Positive</span>
          <span className="font-mono text-[#E8ECF1]">{positive}</span>
        </div>
      </div>
    </div>
  );
}
```

### 11. Build QuickActions component (`packages/web/src/components/dashboard/QuickActions.tsx`)

Three action buttons that shortcut to the most common operations. Each button navigates to the relevant page or opens a modal.

```
┌──────────────────────────────────────────────────────┐
│  Quick Actions                                        │
│──────────────────────────────────────────────────────│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  📥           │ │  🧠           │ │  💡           │ │
│  │  Import       │ │  Run          │ │  Generate     │ │
│  │  Feedback     │ │  Synthesis    │ │  Proposals    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────────┘
```

```typescript
import { useNavigate } from 'react-router-dom';
import { Upload, Brain, Lightbulb } from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function QuickActions() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      label: 'Import Feedback',
      description: 'Upload CSV or JSON file',
      icon: <Upload size={20} />,
      onClick: () => navigate('/feedback?import=true'),
    },
    {
      label: 'Run Synthesis',
      description: 'Discover themes from feedback',
      icon: <Brain size={20} />,
      onClick: () => navigate('/themes?run=true'),
    },
    {
      label: 'Generate Proposals',
      description: 'Create proposals from themes',
      icon: <Lightbulb size={20} />,
      onClick: () => navigate('/proposals?generate=true'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
          className="flex flex-col items-center gap-2 p-4 rounded-xl
                     bg-[#0D0F12] border border-[#1C2028]
                     hover:border-[#3B82F6] hover:bg-[#3B82F620]
                     transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed
                     group"
        >
          <div className="text-[#8B95A5] group-hover:text-[#3B82F6] transition-colors">
            {action.icon}
          </div>
          <span className="text-sm font-medium text-[#E8ECF1]">{action.label}</span>
          <span className="text-xs text-[#5A6478]">{action.description}</span>
        </button>
      ))}
    </div>
  );
}
```

### 12. Assemble DashboardPage (`packages/web/src/pages/DashboardPage.tsx`)

The main page component orchestrates all dashboard sub-components in a responsive grid layout.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Topbar: "Dashboard"                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ Feedback  │ │ Themes   │ │ Proposals│ │ Specs    │               │
│ │   1,234   │ │     12   │ │      8   │ │      3   │               │
│ │  ↑ 12%   │ │  ↑ 100% │ │  ↑ 100% │ │  ↑ 50%  │               │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                      │
│ ┌──────────────────────────────┐ ┌──────────────────────────────┐  │
│ │  Recent Activity              │ │  Top Themes                   │  │
│ │                               │ │                               │  │
│ │  📥 Imported 150 items  2h   │ │  Bulk Export ███████████ 30  │  │
│ │  🧠 12 themes found    1d   │ │  Mobile Perf █████████  25  │  │
│ │  💡 8 proposals gen     1d   │ │  Search UX   ███████    18  │  │
│ │  📋 Spec generated      3d   │ │  Onboarding  ██████     15  │  │
│ │  ...                         │ │  Pricing     ████        9  │  │
│ └──────────────────────────────┘ └──────────────────────────────┘  │
│                                                                      │
│ ┌──────────────────────────────┐ ┌──────────────────────────────┐  │
│ │  Sentiment Distribution       │ │  Quick Actions                │  │
│ │                               │ │                               │  │
│ │  Average: +0.12               │ │  [Import] [Synthesis] [Props] │  │
│ │  ████░░░░░░░░██████████████  │ │                               │  │
│ │  Neg(18%) Neu(42%) Pos(40%)  │ │                               │  │
│ └──────────────────────────────┘ └──────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
import { MessageSquare, Brain, Lightbulb, FileText } from 'lucide-react';
import { useDashboardStats, useActivityFeed, useTopThemes, useSentimentDistribution } from '../hooks/useDashboard';
import { StatCard } from '../components/dashboard/StatCard';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TopThemesChart } from '../components/dashboard/TopThemesChart';
import { SentimentGauge } from '../components/dashboard/SentimentGauge';
import { QuickActions } from '../components/dashboard/QuickActions';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useActivityFeed();
  const { data: topThemes, isLoading: themesLoading } = useTopThemes();
  const { data: sentiment, isLoading: sentimentLoading } = useSentimentDistribution();

  // If all totals are zero, render onboarding (handled in 03-empty-states)
  const hasData = stats && (
    stats.feedback.total > 0 ||
    stats.themes.total > 0 ||
    stats.proposals.total > 0 ||
    stats.specs.total > 0
  );

  if (statsLoading) return <DashboardSkeleton />;
  if (stats && !hasData) return <DashboardEmptyState stats={stats} />;

  return (
    <div className="space-y-6">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Feedback"
          icon={<MessageSquare size={18} />}
          value={stats?.feedback.total ?? 0}
          trendPercent={stats?.feedback.trendPercent ?? 0}
          trendDirection={stats?.feedback.trendDirection ?? 'flat'}
        />
        <StatCard
          label="Themes Discovered"
          icon={<Brain size={18} />}
          value={stats?.themes.total ?? 0}
          trendPercent={stats?.themes.trendPercent ?? 0}
          trendDirection={stats?.themes.trendDirection ?? 'flat'}
        />
        <StatCard
          label="Proposals Generated"
          icon={<Lightbulb size={18} />}
          value={stats?.proposals.total ?? 0}
          trendPercent={stats?.proposals.trendPercent ?? 0}
          trendDirection={stats?.proposals.trendDirection ?? 'flat'}
        />
        <StatCard
          label="Specs Created"
          icon={<FileText size={18} />}
          value={stats?.specs.total ?? 0}
          trendPercent={stats?.specs.trendPercent ?? 0}
          trendDirection={stats?.specs.trendDirection ?? 'flat'}
        />
      </div>

      {/* Middle Row: Activity + Top Themes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#8B95A5] uppercase tracking-wider mb-4">
            Recent Activity
          </h3>
          {activityLoading ? <ActivitySkeleton /> : <ActivityFeed activities={activity ?? []} />}
        </div>
        <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#8B95A5] uppercase tracking-wider mb-4">
            Top Themes
          </h3>
          {themesLoading ? <ChartSkeleton /> : <TopThemesChart themes={topThemes ?? []} />}
        </div>
      </div>

      {/* Bottom Row: Sentiment + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#8B95A5] uppercase tracking-wider mb-4">
            Sentiment Distribution
          </h3>
          {sentimentLoading ? <ChartSkeleton /> : <SentimentGauge data={sentiment!} />}
        </div>
        <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#8B95A5] uppercase tracking-wider mb-4">
            Quick Actions
          </h3>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
```

### 13. Implement skeleton loading states

Each section has a dedicated skeleton that renders shimmer blocks matching the expected content shape. Skeletons use the same grid layout as the real content so the page does not shift when data loads.

```typescript
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5 h-28">
            <div className="h-3 bg-[#13161B] rounded w-24 mb-4" />
            <div className="h-8 bg-[#13161B] rounded w-20" />
          </div>
        ))}
      </div>
      {/* Panel skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5 h-64" />
        ))}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#13161B] rounded-lg" />
          <div className="h-3 bg-[#13161B] rounded flex-1" />
          <div className="h-3 bg-[#13161B] rounded w-12" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i}>
          <div className="h-3 bg-[#13161B] rounded w-32 mb-2" />
          <div className="h-2 bg-[#13161B] rounded" style={{ width: `${100 - i * 15}%` }} />
        </div>
      ))}
    </div>
  );
}
```

### 14. Add `formatRelativeTime` utility

If not already present in `packages/web/src/lib/utils.ts`, add a relative time formatter that avoids external dependencies:

```typescript
/**
 * Format a date as a human-readable relative time string.
 * e.g., "2 hours ago", "3 days ago", "just now"
 */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

### 15. Define shared TypeScript types

Add types to `packages/core/src/types/dashboard.ts`:

```typescript
export interface EntityStat {
  total: number;
  currentWeek: number;
  previousWeek: number;
  trendPercent: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export interface DashboardStats {
  feedback: EntityStat;
  themes: EntityStat;
  proposals: EntityStat;
  specs: EntityStat;
}

export interface ActivityEntry {
  id: string;
  type: 'import' | 'synthesis' | 'proposal_generation' | 'spec_generation';
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TopTheme {
  id: string;
  name: string;
  feedbackCount: number;
  category: string | null;
}

export interface SentimentDistribution {
  average: number;
  negative: number;
  neutral: number;
  positive: number;
  total: number;
}
```

## Acceptance Criteria

- [ ] `GET /api/dashboard/stats` returns counts and trend data for all four entity types
- [ ] Trend percentage correctly compares current 7-day window to previous 7-day window
- [ ] Edge cases handled: zero previous count (100% or 0%), negative trends show as negative
- [ ] `GET /api/dashboard/activity` returns the 10 most recent ActivityLog entries
- [ ] ActivityLog entries are created by import, synthesis, proposal, and spec generation flows
- [ ] `GET /api/dashboard/top-themes` returns top 5 themes by feedbackCount
- [ ] `GET /api/dashboard/sentiment` returns average, negative, neutral, and positive counts
- [ ] Sentiment buckets use thresholds: negative (<-0.3), neutral (-0.3 to 0.3), positive (>0.3)
- [ ] DashboardPage renders 4 stat cards in a responsive grid (4 cols desktop, 2 tablet, 1 mobile)
- [ ] Stat cards display formatted count (thousands separator), trend arrow, and percentage
- [ ] Activity feed displays type icon, description text, and relative timestamp
- [ ] Top themes chart shows horizontal bars proportional to feedback count
- [ ] Category colors applied to theme bars (bug=red, feature_request=blue, etc.)
- [ ] Sentiment gauge shows stacked bar with negative/neutral/positive segments
- [ ] Average sentiment displayed with sign prefix and color-coded (red/yellow/green)
- [ ] Quick action buttons navigate to Import, Synthesis, and Proposal Generation flows
- [ ] Loading state shows skeleton placeholders matching the real layout
- [ ] All dashboard API calls use React Query with appropriate staleTime values
- [ ] Dashboard loads in <300ms with 1000 feedback items (parallel aggregate queries)
- [ ] Prisma migration for ActivityLog model applied successfully

## Complexity Estimate

**XL (Extra Large)** -- New Prisma model, new service layer (dashboard + activity), four API endpoints, six frontend components with chart visualizations, responsive grid layout, skeleton states, integration with four existing services for activity logging, shared types package update.

## Risk Factors & Mitigations

| Risk                                                                | Impact                             | Mitigation                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Aggregate queries slow on large datasets (10K+ items)               | Medium -- dashboard feels sluggish | All counts use indexed `createdAt` column; parallel Promise.all reduces total latency; add `staleTime` caching on frontend |
| Sentiment raw SQL query may not work across all PostgreSQL versions | Low -- query failure               | Use standard SQL FILTER clause (PG 9.4+); fallback to Prisma groupBy if raw query fails                                    |
| Activity logging adds writes to every service operation             | Low -- minor overhead              | Activity service uses fire-and-forget (swallows errors); append-only table with no indexes beyond createdAt                |
| ActivityLog table grows unbounded                                   | Low -- storage concern at scale    | Add a cron job or migration in Phase 7 to prune entries older than 90 days; table is small (one row per operation)         |
| Trend percentages misleading with small data                        | Medium -- user confusion           | Show "new" badge instead of percentage when previous week count is 0; tooltip explains the calculation window              |
| Top themes chart empty when no synthesis has run                    | Low -- blank section               | Handled by empty state in task 03; chart component returns "Run synthesis" message when themes array is empty              |
