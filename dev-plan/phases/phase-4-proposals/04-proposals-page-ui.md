# 04 — Proposals Page UI

## Objective

Build the complete proposals frontend: a card-based list view with RICE score badges, status pills, and evidence counts; a detail view with full proposal description, visual RICE score bars, editable score sliders, and an evidence panel showing linked feedback quotes; one-click approve/reject actions; and filtering/sorting controls. The page follows the established dark theme design system and uses TanStack React Query for all server state.

## Dependencies

- 02-rice-scoring-crud (all proposal API endpoints must be functional)
- 03-evidence-linking (evidence data populated for proposals)
- Phase 1: UI primitives (Button, Card, Badge, Modal), layout shell, routing
- Phase 3: ThemesPage patterns (card grid, detail view, filter bar)

## Files to Create

| File                                                         | Purpose                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `packages/web/src/pages/ProposalsPage.tsx`                   | Main page component with list and detail views |
| `packages/web/src/components/proposals/ProposalCard.tsx`     | Card component for list view                   |
| `packages/web/src/components/proposals/ProposalDetail.tsx`   | Full detail view with evidence panel           |
| `packages/web/src/components/proposals/EvidencePanel.tsx`    | Evidence list with quotes and feedback links   |
| `packages/web/src/components/proposals/RICEScoreDisplay.tsx` | Visual RICE score bars and badge               |
| `packages/web/src/components/proposals/RICEScoreEditor.tsx`  | Score editing with sliders                     |
| `packages/web/src/components/proposals/StatusBadge.tsx`      | Status pill component with color coding        |
| `packages/web/src/components/proposals/ProposalFilters.tsx`  | Filter bar (status, sort)                      |
| `packages/web/src/hooks/useProposals.ts`                     | React Query hooks for proposal data            |

## Files to Modify

| File                          | Changes                    |
| ----------------------------- | -------------------------- |
| `packages/web/src/lib/api.ts` | Add proposal API functions |
| `packages/web/src/App.tsx`    | Add /proposals route       |

## Detailed Sub-Tasks

### 1. Add proposal API functions (`packages/web/src/lib/api.ts`)

Typed API functions that match the backend endpoints.

```typescript
import axios from './axios'; // Pre-configured Axios instance
import type {
  ProposalWithEvidence,
  ProposalGenerationResult,
} from '@shipscope/core/types/proposal';

// ─── Types ───────────────────────────────────────────────
interface ProposalListItem {
  id: string;
  title: string;
  problem: string;
  solution: string;
  description: string;
  impactScore: number | null;
  effortScore: number | null;
  confidenceScore: number | null;
  reachScore: number | null;
  riceScore: number | null;
  status: string;
  evidenceCount: number;
  theme: { id: string; name: string; category: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ProposalQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface UpdateProposalInput {
  title?: string;
  problem?: string;
  solution?: string;
  status?: string;
  impactScore?: number;
  effortScore?: number;
  confidenceScore?: number;
  reachScore?: number;
}

// ─── API Functions ───────────────────────────────────────
export const proposalApi = {
  generate: (topN: number = 20) =>
    axios.post<{ data: ProposalGenerationResult }>('/api/proposals/generate', { topN }),

  list: (params: ProposalQueryParams = {}) =>
    axios.get<PaginatedResponse<ProposalListItem>>('/api/proposals', { params }),

  getById: (id: string) => axios.get<{ data: ProposalWithEvidence }>(`/api/proposals/${id}`),

  update: (id: string, data: UpdateProposalInput) =>
    axios.patch<{ data: ProposalListItem }>(`/api/proposals/${id}`, data),

  delete: (id: string) => axios.delete(`/api/proposals/${id}`),
};
```

### 2. Create React Query hooks (`packages/web/src/hooks/useProposals.ts`)

Custom hooks that wrap all proposal API interactions with caching, invalidation, and optimistic updates.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalApi } from '../lib/api';
import type { ProposalQueryParams, UpdateProposalInput } from '../lib/api';

const PROPOSALS_KEY = 'proposals';
const PROPOSAL_KEY = 'proposal';

export function useProposals(params: ProposalQueryParams = {}) {
  return useQuery({
    queryKey: [PROPOSALS_KEY, params],
    queryFn: () => proposalApi.list(params).then((res) => res.data),
    keepPreviousData: true, // Smooth pagination transitions
  });
}

export function useProposal(id: string | null) {
  return useQuery({
    queryKey: [PROPOSAL_KEY, id],
    queryFn: () => proposalApi.getById(id!).then((res) => res.data.data),
    enabled: !!id,
  });
}

export function useGenerateProposals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topN: number = 20) => proposalApi.generate(topN).then((res) => res.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProposalInput }) =>
      proposalApi.update(id, data).then((res) => res.data.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROPOSAL_KEY, variables.id] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => proposalApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] });
    },
  });
}
```

### 3. Build the Proposals Page (`packages/web/src/pages/ProposalsPage.tsx`)

The page manages two views: the card list and the detail panel. The detail panel opens as a right-side drawer or a full-width section below the card grid, depending on screen size.

```typescript
import { useState } from 'react';
import { useProposals, useGenerateProposals } from '../hooks/useProposals';
import { ProposalCard } from '../components/proposals/ProposalCard';
import { ProposalDetail } from '../components/proposals/ProposalDetail';
import { ProposalFilters } from '../components/proposals/ProposalFilters';
import { Button } from '../components/ui/Button';
import { Sparkles, Plus, Loader2 } from 'lucide-react';

export default function ProposalsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    sortBy: 'riceScore' as string,
    sortOrder: 'desc' as 'asc' | 'desc',
    search: '',
    page: 1,
  });

  const { data, isLoading, isError } = useProposals(filters);
  const generateMutation = useGenerateProposals();

  const handleGenerate = () => {
    generateMutation.mutate(20);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-semibold text-[#E8ECF1]">Proposals</h1>
          <p className="text-sm text-[#8B95A5] mt-0.5">
            AI-generated feature proposals ranked by RICE score
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            icon={generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Proposals'}
          </Button>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────── */}
      <ProposalFilters filters={filters} onChange={setFilters} />

      {/* ─── Content ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Card Grid */}
        <div className={`flex-1 overflow-y-auto p-6 ${selectedId ? 'hidden lg:block lg:w-1/2' : ''}`}>
          {isLoading && <LoadingSkeleton />}
          {isError && <ErrorState onRetry={() => {}} />}
          {data && data.data.length === 0 && <EmptyState onGenerate={handleGenerate} />}
          {data && (
            <>
              <div className="grid gap-4">
                {data.data.map(proposal => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    isSelected={proposal.id === selectedId}
                    onClick={() => setSelectedId(proposal.id)}
                  />
                ))}
              </div>
              {/* Pagination */}
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onChange={(page) => setFilters(prev => ({ ...prev, page }))}
              />
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedId && (
          <div className="w-full lg:w-1/2 border-l border-[#1C2028] overflow-y-auto">
            <ProposalDetail
              proposalId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. Build the Proposal Card (`packages/web/src/components/proposals/ProposalCard.tsx`)

Each card shows: title, problem summary (2 lines truncated), RICE score badge, evidence count, status badge, and theme name.

```typescript
import { StatusBadge } from './StatusBadge';
import { RICEScoreDisplay } from './RICEScoreDisplay';
import { MessageSquareQuote, Tag } from 'lucide-react';

interface ProposalCardProps {
  proposal: {
    id: string;
    title: string;
    problem: string;
    riceScore: number | null;
    status: string;
    evidenceCount: number;
    theme: { name: string; category: string | null } | null;
    createdAt: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

export function ProposalCard({ proposal, isSelected, onClick }: ProposalCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-lg border transition-all duration-150
        ${isSelected
          ? 'bg-[#13161B] border-[#3B82F6]'
          : 'bg-[#0D0F12] border-[#1C2028] hover:border-[#2A303C] hover:bg-[#13161B]'
        }
      `}
    >
      {/* Top row: Title + RICE badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-[#E8ECF1] leading-tight line-clamp-1">
          {proposal.title}
        </h3>
        <RICEScoreDisplay score={proposal.riceScore} size="sm" />
      </div>

      {/* Problem summary (2 lines) */}
      <p className="mt-2 text-sm text-[#8B95A5] line-clamp-2">
        {proposal.problem}
      </p>

      {/* Bottom row: Status + Evidence count + Theme */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <StatusBadge status={proposal.status} />

        <span className="flex items-center gap-1 text-xs text-[#5A6478]">
          <MessageSquareQuote size={12} />
          <span className="font-mono">{proposal.evidenceCount}</span> evidence
        </span>

        {proposal.theme && (
          <span className="flex items-center gap-1 text-xs text-[#5A6478]">
            <Tag size={12} />
            {proposal.theme.name}
          </span>
        )}
      </div>
    </button>
  );
}
```

### 5. Build the Status Badge (`packages/web/src/components/proposals/StatusBadge.tsx`)

Color-coded pill for each status. Uses the design system accent colors.

```typescript
interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  proposed: {
    label: 'Proposed',
    bgColor: 'bg-[#3B82F6]/10',
    textColor: 'text-[#3B82F6]',
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-[#10B981]/10',
    textColor: 'text-[#10B981]',
  },
  rejected: {
    label: 'Rejected',
    bgColor: 'bg-[#EF4444]/10',
    textColor: 'text-[#EF4444]',
  },
  shipped: {
    label: 'Shipped',
    bgColor: 'bg-[#8B5CF6]/10',
    textColor: 'text-[#8B5CF6]',
  },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.proposed;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium
      ${config.bgColor} ${config.textColor} ${sizeClasses}
    `}>
      {config.label}
    </span>
  );
}
```

### 6. Build RICE Score Display (`packages/web/src/components/proposals/RICEScoreDisplay.tsx`)

Two modes:

- **Badge (sm):** Compact score number used in card view
- **Full (lg):** Score with four visual bars for each RICE component

```typescript
interface RICEScoreDisplayProps {
  score: number | null;
  size?: 'sm' | 'lg';
  reach?: number | null;
  impact?: number | null;
  confidence?: number | null;
  effort?: number | null;
}

export function RICEScoreDisplay({
  score,
  size = 'sm',
  reach,
  impact,
  confidence,
  effort,
}: RICEScoreDisplayProps) {
  if (size === 'sm') {
    return (
      <span className={`
        inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold
        ${getScoreColor(score)}
      `}>
        {score !== null ? score.toFixed(1) : '--'}
      </span>
    );
  }

  // Full display with bars
  const components = [
    { label: 'Reach', value: reach, color: '#3B82F6' },
    { label: 'Impact', value: impact, color: '#10B981' },
    { label: 'Confidence', value: confidence, color: '#F59E0B' },
    { label: 'Effort', value: effort, color: '#EF4444' },
  ];

  return (
    <div className="space-y-3">
      {/* Total RICE score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#8B95A5]">RICE Score</span>
        <span className="font-mono text-2xl font-bold text-[#E8ECF1]">
          {score !== null ? score.toFixed(1) : '--'}
        </span>
      </div>

      {/* Component bars */}
      {components.map(({ label, value, color }) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5A6478]">{label}</span>
            <span className="font-mono text-xs text-[#8B95A5]">
              {value ?? '--'}/10
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#1C2028]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: value ? `${(value / 10) * 100}%` : '0%',
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-[#1C2028] text-[#5A6478]';
  if (score >= 100) return 'bg-[#10B981]/10 text-[#10B981]';
  if (score >= 50) return 'bg-[#3B82F6]/10 text-[#3B82F6]';
  if (score >= 20) return 'bg-[#F59E0B]/10 text-[#F59E0B]';
  return 'bg-[#EF4444]/10 text-[#EF4444]';
}
```

### 7. Build RICE Score Editor (`packages/web/src/components/proposals/RICEScoreEditor.tsx`)

Slider-based score editing. Each slider updates a single RICE component, and the RICE score recalculates locally for immediate feedback before the PATCH request fires.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useUpdateProposal } from '../../hooks/useProposals';
import { debounce } from '../../lib/utils';

interface RICEScoreEditorProps {
  proposalId: string;
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
}

export function RICEScoreEditor({
  proposalId,
  reach: initialReach,
  impact: initialImpact,
  confidence: initialConfidence,
  effort: initialEffort,
}: RICEScoreEditorProps) {
  const [scores, setScores] = useState({
    reach: initialReach ?? 5,
    impact: initialImpact ?? 5,
    confidence: initialConfidence ?? 5,
    effort: initialEffort ?? 5,
  });

  const updateMutation = useUpdateProposal();

  // Calculate local RICE for immediate feedback
  const localRICE = scores.effort > 0
    ? (scores.reach * scores.impact * scores.confidence) / scores.effort
    : 0;

  // Debounced API call - fires 500ms after last slider change
  const debouncedSave = useCallback(
    debounce((id: string, data: Record<string, number>) => {
      updateMutation.mutate({ id, data: {
        reachScore: data.reach,
        impactScore: data.impact,
        confidenceScore: data.confidence,
        effortScore: data.effort,
      }});
    }, 500),
    [updateMutation],
  );

  const handleChange = (field: keyof typeof scores, value: number) => {
    const newScores = { ...scores, [field]: value };
    setScores(newScores);
    debouncedSave(proposalId, newScores);
  };

  const sliders = [
    { key: 'reach' as const, label: 'Reach', description: 'Users affected', color: '#3B82F6' },
    { key: 'impact' as const, label: 'Impact', description: 'UX improvement', color: '#10B981' },
    { key: 'confidence' as const, label: 'Confidence', description: 'Evidence strength', color: '#F59E0B' },
    { key: 'effort' as const, label: 'Effort', description: 'Build complexity', color: '#EF4444' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#E8ECF1]">RICE Scores</h3>
        <span className="font-mono text-lg font-bold text-[#E8ECF1]">
          {localRICE.toFixed(1)}
        </span>
      </div>

      {sliders.map(({ key, label, description, color }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-[#E8ECF1]">{label}</span>
              <span className="ml-2 text-xs text-[#5A6478]">{description}</span>
            </div>
            <span className="font-mono text-sm text-[#8B95A5] w-8 text-right">
              {scores[key]}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={scores[key]}
            onChange={(e) => handleChange(key, parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${color} ${((scores[key] - 1) / 9) * 100}%, #1C2028 ${((scores[key] - 1) / 9) * 100}%)`,
            }}
          />
        </div>
      ))}

      <p className="text-xs text-[#5A6478] mt-2">
        RICE = (Reach x Impact x Confidence) / Effort
      </p>
    </div>
  );
}
```

### 8. Build the Evidence Panel (`packages/web/src/components/proposals/EvidencePanel.tsx`)

Displays the linked evidence as a scrollable list of feedback quotes with author, channel, and sentiment.

```typescript
import { MessageSquareQuote, User, Tag, ArrowUpRight } from 'lucide-react';

interface EvidenceItem {
  id: string;
  quote: string | null;
  relevance: number;
  feedback: {
    id: string;
    content: string;
    author: string | null;
    channel: string | null;
    sentiment: number | null;
    urgency: number | null;
    createdAt: string;
  };
}

interface EvidencePanelProps {
  evidence: EvidenceItem[];
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <div className="text-center py-8 text-[#5A6478]">
        <MessageSquareQuote size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No evidence linked to this proposal</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[#E8ECF1] flex items-center gap-2">
        <MessageSquareQuote size={16} />
        Evidence ({evidence.length})
      </h3>

      {evidence.map((item) => (
        <div
          key={item.id}
          className="p-3 rounded-lg bg-[#13161B] border border-[#1C2028]"
        >
          {/* Quote */}
          <p className="text-sm text-[#E8ECF1] leading-relaxed">
            &ldquo;{item.quote || item.feedback.content.slice(0, 200)}&rdquo;
          </p>

          {/* Metadata row */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {item.feedback.author && (
              <span className="flex items-center gap-1 text-xs text-[#5A6478]">
                <User size={10} />
                {item.feedback.author}
              </span>
            )}

            {item.feedback.channel && (
              <span className="flex items-center gap-1 text-xs text-[#5A6478]">
                <Tag size={10} />
                {item.feedback.channel.replace('_', ' ')}
              </span>
            )}

            <span className="flex items-center gap-1 text-xs text-[#5A6478] font-mono">
              {(item.relevance * 100).toFixed(0)}% match
            </span>

            {item.feedback.sentiment !== null && (
              <SentimentIndicator value={item.feedback.sentiment} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SentimentIndicator({ value }: { value: number }) {
  const color = value > 0.2 ? '#10B981' : value < -0.2 ? '#EF4444' : '#F59E0B';
  const label = value > 0.2 ? 'Positive' : value < -0.2 ? 'Negative' : 'Neutral';

  return (
    <span className="text-xs font-mono" style={{ color }}>
      {label}
    </span>
  );
}
```

### 9. Build the Proposal Detail (`packages/web/src/components/proposals/ProposalDetail.tsx`)

The detail view brings together all sub-components: header with status actions, problem/solution text, RICE editor, and evidence panel.

```typescript
import { useProposal, useUpdateProposal, useDeleteProposal } from '../../hooks/useProposals';
import { StatusBadge } from './StatusBadge';
import { RICEScoreEditor } from './RICEScoreEditor';
import { EvidencePanel } from './EvidencePanel';
import { Button } from '../ui/Button';
import { X, Check, Ban, Rocket, Trash2, Loader2 } from 'lucide-react';

interface ProposalDetailProps {
  proposalId: string;
  onClose: () => void;
}

export function ProposalDetail({ proposalId, onClose }: ProposalDetailProps) {
  const { data: proposal, isLoading } = useProposal(proposalId);
  const updateMutation = useUpdateProposal();
  const deleteMutation = useDeleteProposal();

  if (isLoading) return <DetailSkeleton />;
  if (!proposal) return null;

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ id: proposalId, data: { status: newStatus } });
  };

  const handleDelete = () => {
    if (confirm('Delete this proposal? This action cannot be undone.')) {
      deleteMutation.mutate(proposalId, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C2028]">
        <div className="flex items-center gap-3">
          <StatusBadge status={proposal.status} size="md" />
          {proposal.theme && (
            <span className="text-xs text-[#5A6478]">
              from: {proposal.theme.name}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-[#5A6478] hover:text-[#E8ECF1]">
          <X size={20} />
        </button>
      </div>

      {/* ─── Scrollable Content ──────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[#E8ECF1]">{proposal.title}</h2>

        {/* Problem */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#5A6478] mb-2">
            Problem
          </h3>
          <p className="text-sm text-[#8B95A5] leading-relaxed">{proposal.problem}</p>
        </div>

        {/* Solution */}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#5A6478] mb-2">
            Solution
          </h3>
          <p className="text-sm text-[#8B95A5] leading-relaxed">{proposal.solution}</p>
        </div>

        {/* RICE Scores */}
        <div className="p-4 rounded-lg bg-[#0D0F12] border border-[#1C2028]">
          <RICEScoreEditor
            proposalId={proposal.id}
            reach={proposal.reachScore}
            impact={proposal.impactScore}
            confidence={proposal.confidenceScore}
            effort={proposal.effortScore}
          />
        </div>

        {/* Evidence */}
        <EvidencePanel evidence={proposal.evidence} />
      </div>

      {/* ─── Action Bar ──────────────────────────────── */}
      <div className="px-6 py-3 border-t border-[#1C2028] flex items-center gap-2">
        {proposal.status === 'proposed' && (
          <>
            <Button
              variant="success"
              size="sm"
              onClick={() => handleStatusChange('approved')}
              disabled={updateMutation.isPending}
              icon={<Check size={14} />}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleStatusChange('rejected')}
              disabled={updateMutation.isPending}
              icon={<Ban size={14} />}
            >
              Reject
            </Button>
          </>
        )}

        {proposal.status === 'approved' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleStatusChange('shipped')}
            disabled={updateMutation.isPending}
            icon={<Rocket size={14} />}
          >
            Mark Shipped
          </Button>
        )}

        {proposal.status === 'rejected' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusChange('proposed')}
            disabled={updateMutation.isPending}
          >
            Re-open
          </Button>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          icon={<Trash2 size={14} />}
          className="text-[#EF4444] hover:bg-[#EF4444]/10"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
```

### 10. Build the Filter Bar (`packages/web/src/components/proposals/ProposalFilters.tsx`)

Horizontal bar with status filter tabs, sort dropdown, and search input.

```typescript
import { Search, ArrowUpDown } from 'lucide-react';

interface ProposalFiltersProps {
  filters: {
    status?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search: string;
  };
  onChange: (filters: any) => void;
}

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'shipped', label: 'Shipped' },
];

const SORT_OPTIONS = [
  { value: 'riceScore', label: 'RICE Score' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'impactScore', label: 'Impact' },
  { value: 'effortScore', label: 'Effort' },
];

export function ProposalFilters({ filters, onChange }: ProposalFiltersProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-[#1C2028]">
      {/* Status tabs */}
      <div className="flex gap-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.label}
            onClick={() => onChange({ ...filters, status: tab.value, page: 1 })}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${filters.status === tab.value
                ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                : 'text-[#5A6478] hover:text-[#8B95A5] hover:bg-[#13161B]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-[#5A6478]" />
        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ ...filters, sortBy: e.target.value, page: 1 })}
          className="bg-[#13161B] border border-[#1C2028] rounded-md px-2 py-1 text-xs text-[#8B95A5]
                     focus:border-[#3B82F6] focus:outline-none"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => onChange({
            ...filters,
            sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc',
          })}
          className="text-xs text-[#5A6478] hover:text-[#8B95A5]"
        >
          {filters.sortOrder === 'desc' ? 'High-Low' : 'Low-High'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6478]" />
        <input
          type="text"
          placeholder="Search proposals..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="bg-[#13161B] border border-[#1C2028] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#E8ECF1]
                     placeholder:text-[#5A6478] focus:border-[#3B82F6] focus:outline-none w-48"
        />
      </div>
    </div>
  );
}
```

### 11. Register the route (`packages/web/src/App.tsx`)

```typescript
import ProposalsPage from './pages/ProposalsPage';

// Inside the router configuration:
{ path: '/proposals', element: <ProposalsPage /> },
```

### 12. Empty state and loading states

**Empty State** (no proposals generated yet):

```typescript
function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Sparkles size={40} className="text-[#3B82F6] mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-[#E8ECF1]">No proposals yet</h3>
      <p className="text-sm text-[#8B95A5] mt-1 max-w-md">
        Generate feature proposals from your synthesized themes. Each proposal
        includes a RICE score, problem statement, and evidence from customer feedback.
      </p>
      <Button variant="primary" onClick={onGenerate} className="mt-6" icon={<Sparkles />}>
        Generate Proposals
      </Button>
    </div>
  );
}
```

**Loading Skeleton** (while data fetches):

```typescript
function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg bg-[#0D0F12] border border-[#1C2028] animate-pulse">
          <div className="h-4 bg-[#1C2028] rounded w-3/4 mb-3" />
          <div className="h-3 bg-[#1C2028] rounded w-full mb-2" />
          <div className="h-3 bg-[#1C2028] rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Proposals page renders at `/proposals` route
- [ ] Card grid displays all proposals with title, problem summary (2-line truncation), RICE badge, status pill, evidence count, theme name
- [ ] Clicking a card opens the detail panel (right side on desktop, full-width on mobile)
- [ ] Detail view shows: problem, solution, RICE score editor, evidence panel
- [ ] RICE score editor shows sliders for all four components (Reach, Impact, Confidence, Effort)
- [ ] Moving a slider updates the local RICE score immediately (optimistic)
- [ ] Slider changes are debounced (500ms) and saved via PATCH API
- [ ] Evidence panel lists all linked feedback quotes with author, channel, relevance %, and sentiment
- [ ] Evidence items with no extracted quote fall back to first 200 chars of content
- [ ] Status badge shows correct color: proposed (blue), approved (green), rejected (red), shipped (purple)
- [ ] Approve button visible only for "proposed" proposals, calls PATCH with `{ status: "approved" }`
- [ ] Reject button visible only for "proposed" proposals, calls PATCH with `{ status: "rejected" }`
- [ ] Ship button visible only for "approved" proposals
- [ ] Re-open button visible only for "rejected" proposals
- [ ] Delete button shows confirmation dialog, then calls DELETE endpoint
- [ ] Status filter tabs (All, Proposed, Approved, Rejected, Shipped) filter the list
- [ ] Sort dropdown supports: RICE Score, Date Created, Impact, Effort
- [ ] Sort order toggle (High-Low / Low-High) works
- [ ] Search input filters proposals by title, problem, or solution text
- [ ] Generate Proposals button triggers POST /api/proposals/generate with loading state
- [ ] Empty state shown when no proposals exist, with prominent generate button
- [ ] Loading skeleton shown while data is being fetched
- [ ] Pagination renders when results exceed pageSize
- [ ] All data fetching uses TanStack React Query with proper cache invalidation

## Complexity Estimate

**XL (Extra Large)** -- 9 new component files, complex state management (selected proposal, filters, debounced score editing), responsive layout with detail panel, multiple visual sub-components (RICE bars, status badges, evidence cards), and integration with 5 API endpoints.

## Risk Factors & Mitigations

| Risk                                                          | Impact                           | Mitigation                                                                                         |
| ------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Slider debounce causes stale data (old PATCH overwrites new)  | Medium -- scores jump back       | Use latest-value-wins pattern in debounce; disable slider during pending mutation                  |
| Detail panel layout breaks on narrow screens                  | Medium -- unusable on mobile     | Full-width detail on screens < 1024px; hide card grid when detail is open                          |
| Large evidence panels slow down rendering                     | Low -- minor jank                | Limit to 10 evidence items (already enforced by backend); virtualize if needed later               |
| Status action buttons fire duplicate requests on double-click | Low -- state corruption          | Disable buttons while mutation is pending; check isPending flag                                    |
| Generate button fires while previous generation is running    | Medium -- duplicate proposals    | Show loading state; disable button during mutation; backend can also guard against concurrent runs |
| React Query cache stale after score edit                      | Medium -- old RICE shown in list | Invalidate both proposal list and detail queries on mutation success                               |
