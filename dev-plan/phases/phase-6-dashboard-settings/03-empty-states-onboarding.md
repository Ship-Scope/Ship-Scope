# 03 -- Empty States & Onboarding

## Objective

Build contextual empty state components for every page in the application, and a guided onboarding flow on the dashboard that walks new users through the four-step pipeline: Import Feedback, Run Synthesis, Generate Proposals, Create Specs. Empty states transform blank pages from dead ends into actionable prompts, and the onboarding steps provide a clear path from first launch to full utilization. Onboarding state is derived from entity counts (no separate tracking table), making it self-healing and idempotent.

## Dependencies

- 01-dashboard-page (DashboardPage exists and renders, stat cards provide entity counts)
- 02-settings-page (SettingsPage exists for AI configuration prompts)
- Phase 2: FeedbackPage (page component exists, needs empty state integration)
- Phase 3: ThemesPage (page component exists, needs empty state integration)
- Phase 4: ProposalsPage (page component exists, needs empty state integration)
- Phase 5: SpecsPage (page component exists, needs empty state integration)

## Files to Create

| File                                                            | Purpose                                        |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `packages/web/src/components/ui/EmptyState.tsx`                 | Reusable generic empty state component         |
| `packages/web/src/components/ui/OnboardingSteps.tsx`            | Step-by-step onboarding progress indicator     |
| `packages/web/src/components/dashboard/DashboardEmptyState.tsx` | Dashboard-specific empty state with onboarding |

## Files to Modify

| File                                       | Changes                                                |
| ------------------------------------------ | ------------------------------------------------------ |
| `packages/web/src/pages/DashboardPage.tsx` | Integrate DashboardEmptyState when all counts are zero |
| `packages/web/src/pages/FeedbackPage.tsx`  | Add empty state when no feedback items exist           |
| `packages/web/src/pages/ThemesPage.tsx`    | Add empty state when no themes exist                   |
| `packages/web/src/pages/ProposalsPage.tsx` | Add empty state when no proposals exist                |
| `packages/web/src/pages/SpecsPage.tsx`     | Add empty state when no specs exist                    |

## Detailed Sub-Tasks

### 1. Build the generic EmptyState component (`packages/web/src/components/ui/EmptyState.tsx`)

A reusable component that renders a centered icon, title, description, and optional primary action button. This is the building block used by all page-specific empty states.

```
┌────────────────────────────────────────────────┐
│                                                 │
│                   ┌─────┐                       │
│                   │ 📥  │  (48px icon)          │
│                   └─────┘                       │
│                                                 │
│          Import your first feedback             │
│                                                 │
│  Upload a CSV or JSON file, add feedback        │
│  manually, or set up a webhook to start         │
│  collecting customer insights.                  │
│                                                 │
│            [Import Feedback]                    │
│                                                 │
└────────────────────────────────────────────────┘
```

```typescript
import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon container */}
      <div className="w-16 h-16 rounded-2xl bg-[#13161B] border border-[#1C2028]
                      flex items-center justify-center mb-5 text-[#5A6478]">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-[#E8ECF1] mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[#8B95A5] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="bg-white text-[#07080A] rounded-lg px-5 py-2.5 text-sm font-medium
                       hover:shadow-lg transition-all duration-200"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="bg-[#0D0F12] text-[#E8ECF1] border border-[#1C2028] rounded-lg
                       px-5 py-2.5 text-sm font-medium
                       hover:border-[#2A303C] transition-all duration-200"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {/* Optional children (e.g., onboarding steps) */}
      {children && <div className="mt-8 w-full max-w-lg">{children}</div>}
    </div>
  );
}
```

### 2. Build OnboardingSteps component (`packages/web/src/components/ui/OnboardingSteps.tsx`)

A vertical step indicator that shows the four pipeline stages. Each step has a status (completed, current, pending), an icon, a title, a description, and an optional action button. Completed steps show a green checkmark. The current step is highlighted with the accent blue.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Get started with ShipScope                                     │
│                                                                 │
│  ● ─── Step 1: Import Feedback                    [Import]     │
│  │     Upload CSV/JSON or add feedback manually                 │
│  │     ✓ 150 feedback items imported                           │
│  │                                                              │
│  ○ ─── Step 2: Run Synthesis                       [Run]       │
│  │     Discover themes and patterns in your feedback            │
│  │                                                              │
│  ○ ─── Step 3: Generate Proposals                               │
│  │     Create feature proposals from discovered themes          │
│  │                                                              │
│  ○ ─── Step 4: Create Specs                                     │
│        Generate PRDs and agent-ready prompts                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

```typescript
import { Check, Upload, Brain, Lightbulb, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
  completedText?: string;   // e.g., "150 feedback items imported"
  action?: {
    label: string;
    path: string;           // navigation target
  };
}

interface OnboardingStepsProps {
  feedbackCount: number;
  themeCount: number;
  proposalCount: number;
  specCount: number;
}

export function OnboardingSteps({
  feedbackCount,
  themeCount,
  proposalCount,
  specCount,
}: OnboardingStepsProps) {
  const navigate = useNavigate();

  // Derive step status from entity counts
  const getStatus = (count: number, prevCompleted: boolean): 'completed' | 'current' | 'pending' => {
    if (count > 0) return 'completed';
    if (prevCompleted) return 'current';
    return 'pending';
  };

  const step1Complete = feedbackCount > 0;
  const step2Complete = themeCount > 0;
  const step3Complete = proposalCount > 0;
  const step4Complete = specCount > 0;

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Import Feedback',
      description: 'Upload a CSV or JSON file, add feedback manually, or configure a webhook.',
      icon: <Upload size={18} />,
      status: getStatus(feedbackCount, true),  // Step 1 is always "current" if incomplete
      completedText: step1Complete ? `${feedbackCount.toLocaleString()} feedback items imported` : undefined,
      action: { label: 'Import', path: '/feedback?import=true' },
    },
    {
      id: 2,
      title: 'Run Synthesis',
      description: 'Analyze feedback to discover themes, sentiment patterns, and urgency signals.',
      icon: <Brain size={18} />,
      status: getStatus(themeCount, step1Complete),
      completedText: step2Complete ? `${themeCount} themes discovered` : undefined,
      action: { label: 'Run Synthesis', path: '/themes?run=true' },
    },
    {
      id: 3,
      title: 'Generate Proposals',
      description: 'Create prioritized feature proposals from discovered themes with RICE scoring.',
      icon: <Lightbulb size={18} />,
      status: getStatus(proposalCount, step2Complete),
      completedText: step3Complete ? `${proposalCount} proposals generated` : undefined,
      action: { label: 'Generate', path: '/proposals?generate=true' },
    },
    {
      id: 4,
      title: 'Create Specs',
      description: 'Generate PRDs and agent-ready development prompts from approved proposals.',
      icon: <FileText size={18} />,
      status: getStatus(specCount, step3Complete),
      completedText: step4Complete ? `${specCount} specs created` : undefined,
      action: { label: 'View Proposals', path: '/proposals' },
    },
  ];

  const completedCount = [step1Complete, step2Complete, step3Complete, step4Complete]
    .filter(Boolean).length;

  return (
    <div>
      {/* Progress summary */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-[#8B95A5] uppercase tracking-wider">
          Getting Started
        </h3>
        <span className="text-xs font-mono text-[#5A6478]">
          {completedCount}/4 completed
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#13161B] rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      {/* Step list */}
      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex gap-4">
            {/* Vertical connector line */}
            {index < steps.length - 1 && (
              <div className="absolute left-[15px] top-[32px] w-[2px] h-[calc(100%-8px)]">
                <div
                  className={`w-full h-full ${
                    step.status === 'completed' ? 'bg-[#3B82F6]' : 'bg-[#1C2028]'
                  }`}
                />
              </div>
            )}

            {/* Step circle */}
            <div className="flex-shrink-0 relative z-10">
              {step.status === 'completed' ? (
                <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center">
                  <Check size={16} className="text-white" />
                </div>
              ) : step.status === 'current' ? (
                <div className="w-8 h-8 rounded-full border-2 border-[#3B82F6] bg-[#3B82F620]
                                flex items-center justify-center">
                  <span className="text-[#3B82F6]">{step.icon}</span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-[#1C2028] bg-[#0D0F12]
                                flex items-center justify-center">
                  <span className="text-[#5A6478]">{step.icon}</span>
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 pb-8">
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-medium ${
                  step.status === 'completed' ? 'text-[#E8ECF1]' :
                  step.status === 'current' ? 'text-[#E8ECF1]' :
                  'text-[#5A6478]'
                }`}>
                  Step {step.id}: {step.title}
                </h4>
                {step.action && step.status !== 'pending' && (
                  <button
                    onClick={() => navigate(step.action!.path)}
                    className={`text-xs font-medium px-3 py-1 rounded-md transition-all ${
                      step.status === 'current'
                        ? 'bg-[#3B82F620] text-[#3B82F6] hover:bg-[#3B82F630]'
                        : 'text-[#5A6478] hover:text-[#8B95A5]'
                    }`}
                  >
                    {step.status === 'completed' ? 'View' : step.action.label}
                  </button>
                )}
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${
                step.status === 'pending' ? 'text-[#5A6478]' : 'text-[#8B95A5]'
              }`}>
                {step.description}
              </p>
              {step.completedText && (
                <p className="text-xs text-[#34D399] mt-1.5 flex items-center gap-1">
                  <Check size={12} />
                  {step.completedText}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Build DashboardEmptyState component (`packages/web/src/components/dashboard/DashboardEmptyState.tsx`)

The full dashboard empty state shown when all entity counts are zero. Combines the generic EmptyState shell with the OnboardingSteps component.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Topbar: "Dashboard"                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        ┌─────────┐                                  │
│                        │ ShipScope│  (logo/icon)                    │
│                        └─────────┘                                  │
│                                                                      │
│               Welcome to ShipScope                                   │
│                                                                      │
│    Transform customer feedback into actionable product               │
│    intelligence. Follow the steps below to get started.              │
│                                                                      │
│    ┌──────────────────────────────────────────────────────────────┐ │
│    │                                                              │ │
│    │  Getting Started                              0/4 completed  │ │
│    │  ═══════════════════════════════════════════                 │ │
│    │                                                              │ │
│    │  ⦿ ─── Step 1: Import Feedback            [Import]          │ │
│    │  │     Upload CSV/JSON or add manually                      │ │
│    │  │                                                          │ │
│    │  ○ ─── Step 2: Run Synthesis                                │ │
│    │  │     Discover themes and patterns                         │ │
│    │  │                                                          │ │
│    │  ○ ─── Step 3: Generate Proposals                           │ │
│    │  │     Create prioritized feature proposals                 │ │
│    │  │                                                          │ │
│    │  ○ ─── Step 4: Create Specs                                 │ │
│    │        Generate PRDs and dev prompts                        │ │
│    │                                                              │ │
│    └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│    ┌──────────────────────────────────────────────────────────────┐ │
│    │  Tip: Configure your OpenAI API key in Settings              │ │
│    │  before running synthesis.           [Go to Settings]        │ │
│    └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
import { Compass, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OnboardingSteps } from '../ui/OnboardingSteps';
import type { DashboardStats } from '@shipscope/core/types/dashboard';

interface DashboardEmptyStateProps {
  stats: DashboardStats;
}

export function DashboardEmptyState({ stats }: DashboardEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center py-12 px-6">
      {/* Header */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#C084FC]
                      flex items-center justify-center mb-5">
        <Compass size={28} className="text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-[#E8ECF1] mb-2">
        Welcome to ShipScope
      </h2>
      <p className="text-sm text-[#8B95A5] max-w-md text-center mb-10 leading-relaxed">
        Transform customer feedback into actionable product intelligence.
        Follow the steps below to get started.
      </p>

      {/* Onboarding Steps */}
      <div className="w-full max-w-lg bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
        <OnboardingSteps
          feedbackCount={stats.feedback.total}
          themeCount={stats.themes.total}
          proposalCount={stats.proposals.total}
          specCount={stats.specs.total}
        />
      </div>

      {/* Settings Tip */}
      <div className="w-full max-w-lg mt-4 bg-[#13161B] border border-[#1C2028]
                      rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-[#FBBF24] flex-shrink-0" />
          <p className="text-sm text-[#8B95A5]">
            <span className="text-[#E8ECF1] font-medium">Tip:</span> Configure your
            OpenAI API key in Settings before running synthesis.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex-shrink-0 text-xs font-medium text-[#3B82F6]
                     hover:text-[#2563EB] transition-colors ml-4"
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
}
```

### 4. Integrate empty state into DashboardPage

Update `DashboardPage.tsx` to conditionally render the empty state:

```typescript
// In DashboardPage.tsx — already scaffolded in 01-dashboard-page.md
// The key conditional is:

if (stats && !hasData) {
  return <DashboardEmptyState stats={stats} />;
}

// Where hasData is:
const hasData = stats && (
  stats.feedback.total > 0 ||
  stats.themes.total > 0 ||
  stats.proposals.total > 0 ||
  stats.specs.total > 0
);
```

When the user is partially through onboarding (e.g., has feedback but no themes), the dashboard shows the normal stat cards AND the onboarding steps below them. The partial-progress case:

```typescript
// Show onboarding as a banner when some steps are incomplete
const allStepsComplete = stats &&
  stats.feedback.total > 0 &&
  stats.themes.total > 0 &&
  stats.proposals.total > 0 &&
  stats.specs.total > 0;

// In the JSX, after the stat cards grid:
{!allStepsComplete && (
  <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5">
    <OnboardingSteps
      feedbackCount={stats?.feedback.total ?? 0}
      themeCount={stats?.themes.total ?? 0}
      proposalCount={stats?.proposals.total ?? 0}
      specCount={stats?.specs.total ?? 0}
    />
  </div>
)}
```

### 5. Add empty state to FeedbackPage

```
┌────────────────────────────────────────────────┐
│                                                 │
│                   ┌─────┐                       │
│                   │ 📥  │                       │
│                   └─────┘                       │
│                                                 │
│         Import your first feedback              │
│                                                 │
│  Upload a CSV or JSON file containing customer  │
│  feedback, add entries manually, or set up a    │
│  webhook for real-time ingestion.               │
│                                                 │
│       [Import File]    [Add Manually]           │
│                                                 │
└────────────────────────────────────────────────┘
```

```typescript
// In FeedbackPage.tsx — wrap the table in a conditional:
import { Upload } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

// In the render:
if (feedbackQuery.data?.total === 0 && !hasActiveFilters) {
  return (
    <EmptyState
      icon={<Upload size={28} />}
      title="Import your first feedback"
      description="Upload a CSV or JSON file containing customer feedback, add entries manually, or set up a webhook for real-time ingestion."
      action={{ label: 'Import File', onClick: () => setShowImportModal(true) }}
      secondaryAction={{ label: 'Add Manually', onClick: () => setShowManualEntry(true) }}
    />
  );
}

// Important: only show empty state when there are NO filters active.
// If filters are active and results are empty, show a "no results" state instead:
if (feedbackQuery.data?.total === 0 && hasActiveFilters) {
  return (
    <EmptyState
      icon={<Search size={28} />}
      title="No results match your filters"
      description="Try adjusting your search terms or clearing some filters."
      action={{ label: 'Clear Filters', onClick: resetFilters }}
    />
  );
}
```

### 6. Add empty state to ThemesPage

```
┌────────────────────────────────────────────────┐
│                                                 │
│                   ┌─────┐                       │
│                   │ 🧠  │                       │
│                   └─────┘                       │
│                                                 │
│       Run synthesis to discover themes          │
│                                                 │
│  Import feedback first, then run the AI         │
│  synthesis engine to automatically group        │
│  feedback into themes and identify patterns.    │
│                                                 │
│            [Run Synthesis]                       │
│                                                 │
└────────────────────────────────────────────────┘
```

```typescript
// In ThemesPage.tsx:
import { Brain } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

if (themes.length === 0) {
  const hasFeedback = feedbackCount > 0; // from a separate count query or dashboard stats

  return (
    <EmptyState
      icon={<Brain size={28} />}
      title={hasFeedback ? 'Run synthesis to discover themes' : 'Import feedback first'}
      description={
        hasFeedback
          ? 'Run the AI synthesis engine to automatically group feedback into themes, analyze sentiment, and identify patterns.'
          : 'You need feedback data before synthesis can discover themes. Import a CSV file or add feedback manually.'
      }
      action={
        hasFeedback
          ? { label: 'Run Synthesis', onClick: handleRunSynthesis }
          : { label: 'Import Feedback', onClick: () => navigate('/feedback?import=true') }
      }
    />
  );
}
```

### 7. Add empty state to ProposalsPage

```
┌────────────────────────────────────────────────┐
│                                                 │
│                   ┌─────┐                       │
│                   │ 💡  │                       │
│                   └─────┘                       │
│                                                 │
│      Generate proposals from your themes        │
│                                                 │
│  Once synthesis has discovered themes, you can  │
│  generate AI-powered feature proposals with     │
│  RICE scoring and evidence from real feedback.  │
│                                                 │
│          [Generate Proposals]                    │
│                                                 │
└────────────────────────────────────────────────┘
```

```typescript
// In ProposalsPage.tsx:
import { Lightbulb } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

if (proposals.length === 0) {
  const hasThemes = themeCount > 0;

  return (
    <EmptyState
      icon={<Lightbulb size={28} />}
      title={hasThemes ? 'Generate proposals from your themes' : 'Discover themes first'}
      description={
        hasThemes
          ? 'Generate AI-powered feature proposals with RICE scoring and evidence linked to real customer feedback.'
          : 'Run synthesis to discover themes from your feedback before generating proposals.'
      }
      action={
        hasThemes
          ? { label: 'Generate Proposals', onClick: handleGenerateProposals }
          : { label: 'Go to Themes', onClick: () => navigate('/themes') }
      }
    />
  );
}
```

### 8. Add empty state to SpecsPage

```
┌────────────────────────────────────────────────┐
│                                                 │
│                   ┌─────┐                       │
│                   │ 📋  │                       │
│                   └─────┘                       │
│                                                 │
│      Approve a proposal to generate specs       │
│                                                 │
│  Specs are generated from approved proposals.   │
│  Review your proposals, approve the ones you    │
│  want to build, then generate PRDs and          │
│  agent-ready development prompts.               │
│                                                 │
│          [View Proposals]                        │
│                                                 │
└────────────────────────────────────────────────┘
```

```typescript
// In SpecsPage.tsx:
import { FileText } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

if (specs.length === 0) {
  const hasProposals = proposalCount > 0;

  return (
    <EmptyState
      icon={<FileText size={28} />}
      title={hasProposals ? 'Approve a proposal to generate specs' : 'Generate proposals first'}
      description={
        hasProposals
          ? 'Specs are generated from approved proposals. Review and approve proposals, then generate detailed PRDs and agent-ready development prompts.'
          : 'You need feature proposals before generating specs. Go to the Proposals page to generate them from your themes.'
      }
      action={
        hasProposals
          ? { label: 'View Proposals', onClick: () => navigate('/proposals') }
          : { label: 'Go to Proposals', onClick: () => navigate('/proposals') }
      }
    />
  );
}
```

### 9. Determine prerequisite counts without extra API calls

Each page needs to know whether the prerequisite step has been completed (e.g., ThemesPage needs to know if feedback exists). Rather than adding count queries to every page, use a shared hook that fetches dashboard stats (which are already cached by React Query):

```typescript
// packages/web/src/hooks/usePipelineStatus.ts

import { useDashboardStats } from './useDashboard';

interface PipelineStatus {
  hasFeedback: boolean;
  hasThemes: boolean;
  hasProposals: boolean;
  hasSpecs: boolean;
  feedbackCount: number;
  themeCount: number;
  proposalCount: number;
  specCount: number;
  isLoading: boolean;
}

export function usePipelineStatus(): PipelineStatus {
  const { data: stats, isLoading } = useDashboardStats();

  return {
    hasFeedback: (stats?.feedback.total ?? 0) > 0,
    hasThemes: (stats?.themes.total ?? 0) > 0,
    hasProposals: (stats?.proposals.total ?? 0) > 0,
    hasSpecs: (stats?.specs.total ?? 0) > 0,
    feedbackCount: stats?.feedback.total ?? 0,
    themeCount: stats?.themes.total ?? 0,
    proposalCount: stats?.proposals.total ?? 0,
    specCount: stats?.specs.total ?? 0,
    isLoading,
  };
}
```

This hook reuses the cached `['dashboard', 'stats']` query. Since `staleTime` is 30 seconds, navigating between pages does not trigger redundant API calls.

### 10. Handle the partial-progress dashboard

When a user has some data but not all steps complete, the dashboard should show both the normal dashboard content AND the onboarding steps. The logic:

```
- All counts = 0    → Full empty state (DashboardEmptyState)
- Some counts > 0   → Normal dashboard + onboarding banner at bottom
- All 4 counts > 0  → Normal dashboard only (onboarding hidden)
```

This is implemented in the DashboardPage component (see sub-task 4 above). The onboarding banner is placed after the quick actions section and uses the same OnboardingSteps component, but rendered inline rather than centered.

### 11. Add CSS animation for onboarding step transitions

When a step transitions from "current" to "completed" (e.g., the user imports feedback and returns to the dashboard), the checkmark should animate in smoothly:

```css
/* In packages/web/src/styles/globals.css */

@keyframes checkmarkIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.onboarding-check {
  animation: checkmarkIn 0.3s ease-out;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state-enter {
  animation: fadeSlideUp 0.4s ease-out;
}
```

Apply the `empty-state-enter` class to the EmptyState wrapper div, and the `onboarding-check` class to the completed step circle.

## Acceptance Criteria

- [ ] Generic EmptyState component renders icon, title, description, and action button
- [ ] EmptyState supports optional secondary action button
- [ ] EmptyState supports optional children (for onboarding steps)
- [ ] OnboardingSteps component renders 4 steps with correct status (completed/current/pending)
- [ ] Completed steps show blue checkmark circle with green completed text
- [ ] Current step is highlighted with blue border and icon
- [ ] Pending steps are grayed out with muted text
- [ ] Progress bar at top of onboarding shows N/4 completion
- [ ] Action buttons on steps navigate to the correct pages
- [ ] Dashboard shows full empty state (DashboardEmptyState) when all counts are zero
- [ ] Dashboard shows partial onboarding banner when some but not all steps are complete
- [ ] Dashboard hides onboarding completely when all 4 steps are complete
- [ ] Settings tip appears in dashboard empty state suggesting API key configuration
- [ ] FeedbackPage shows "Import your first feedback" empty state when no items exist
- [ ] FeedbackPage shows "No results match your filters" when filters produce zero results
- [ ] ThemesPage shows context-aware empty state (different message if feedback exists vs not)
- [ ] ProposalsPage shows context-aware empty state (different message if themes exist vs not)
- [ ] SpecsPage shows context-aware empty state (different message if proposals exist vs not)
- [ ] `usePipelineStatus` hook provides entity counts from cached dashboard stats
- [ ] Empty state animations play smoothly (fade-slide-up on enter, checkmark scale on complete)
- [ ] All empty states are responsive (centered on all screen sizes)
- [ ] Clicking action buttons in empty states navigates to the correct pages/modals

## Complexity Estimate

**M (Medium)** -- Three new reusable components (EmptyState, OnboardingSteps, DashboardEmptyState), one new hook (usePipelineStatus), modifications to five existing page components. No new API endpoints needed. Logic is straightforward (conditional rendering based on counts). Design-heavy with step indicator and animation work.

## Risk Factors & Mitigations

| Risk                                                   | Impact                               | Mitigation                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding steps flicker when stats refetch            | Low -- momentary visual jank         | Use `keepPreviousData` on dashboard stats query; completed steps never regress                                                   |
| Empty state shown briefly during initial load          | Medium -- flash of empty before data | Show skeleton loader until stats query resolves; empty state only shown when `isLoading === false` and counts are zero           |
| Page-specific empty states inconsistent in style       | Low -- UX fragmentation              | All pages use the same EmptyState component; only icon, title, description, and action differ                                    |
| Onboarding completed text stale if data deleted        | Low -- misleading count              | Counts come from live dashboard stats (30s cache); deleting data via settings invalidates all caches immediately                 |
| Mobile layout of OnboardingSteps connector line        | Low -- visual alignment issue        | Use absolute positioning with left offset; test on 375px width; connector line is decorative (no content loss if misaligned)     |
| Context-aware messages require extra data on each page | Low -- additional complexity         | usePipelineStatus hook centralizes all counts; pages read from a single cached query rather than making their own count requests |
