# 07 — Themes Page UI

## Objective

Build the Themes page showing all discovered themes as cards with feedback count, category badge, sentiment/urgency indicators, and opportunity score. Include a theme detail view showing linked feedback items, pain points, and a "Run Synthesis" action button with real-time status display.

## Dependencies

- 06-synthesis-orchestrator (API endpoints for themes and synthesis status)
- Phase 1: Frontend scaffold (Shell, layout components, UI primitives)

## Files to Create

| File                                                     | Purpose                                |
| -------------------------------------------------------- | -------------------------------------- |
| `packages/web/src/pages/ThemesPage.tsx`                  | Main themes page (replace placeholder) |
| `packages/web/src/components/themes/ThemeCard.tsx`       | Individual theme card                  |
| `packages/web/src/components/themes/ThemeDetail.tsx`     | Expanded theme detail panel            |
| `packages/web/src/components/themes/ThemeCluster.tsx`    | Visual cluster indicator (size bubble) |
| `packages/web/src/components/themes/SynthesisStatus.tsx` | Real-time synthesis progress display   |
| `packages/web/src/hooks/useThemes.ts`                    | React Query hooks for themes           |
| `packages/web/src/hooks/useSynthesis.ts`                 | React Query hooks for synthesis status |

## Files to Modify

| File                          | Changes                                |
| ----------------------------- | -------------------------------------- |
| `packages/web/src/lib/api.ts` | Add themes and synthesis API functions |

## Detailed Sub-Tasks

### 1. Create API functions and hooks

```typescript
// API functions
export const synthesisApi = {
  run: (config?) => api.post('/synthesis/run', config).then((r) => r.data),
  status: () => api.get('/synthesis/status').then((r) => r.data),
  cancel: () => api.post('/synthesis/cancel').then((r) => r.data),
};

export const themesApi = {
  list: (params?) => api.get('/synthesis/themes', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/synthesis/themes/${id}`).then((r) => r.data),
};

// Hooks
export function useThemesList(params?) {
  return useQuery({ queryKey: ['themes', params], queryFn: () => themesApi.list(params) });
}

export function useThemeDetail(id: string | null) {
  return useQuery({
    queryKey: ['themes', id],
    queryFn: () => themesApi.get(id!),
    enabled: !!id,
  });
}

export function useSynthesisStatus() {
  return useQuery({
    queryKey: ['synthesis', 'status'],
    queryFn: () => synthesisApi.status(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'idle' || status === 'completed' || status === 'failed') return false;
      return 2000; // Poll every 2s while running
    },
  });
}

export function useRunSynthesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config?) => synthesisApi.run(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['synthesis'] });
      qc.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}
```

### 2. Build ThemesPage layout

```
┌─────────────────────────────────────────────────────┐
│ Topbar: "Themes"               [Run Synthesis]      │
├─────────────────────────────────────────────────────┤
│ ┌─ Synthesis Status ──────────────────────────────┐ │  ← Only shown when running
│ │ ████████████░░░░  68% — Clustering feedback...  │ │
│ │ ✓ Embedded 200 items  ✓ Scored 200 items        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Sort: [Opportunity ▼] [Category ▼]   8 themes found │
│                                                     │
│ ┌──────────────────┐ ┌──────────────────┐          │
│ │ 🟣 Bulk Export    │ │ 🟡 Mobile Perf   │          │
│ │ Functionality     │ │ Issues           │          │
│ │                   │ │                   │          │
│ │ 30 feedback items │ │ 25 feedback items │          │
│ │ Sentiment: -0.6   │ │ Sentiment: -0.8   │          │
│ │ Urgency: 0.7      │ │ Urgency: 0.9      │          │
│ │ ────────────────  │ │ ────────────────  │          │
│ │ feature_request   │ │ bug              │          │
│ │ Score: ████░ 42   │ │ Score: █████ 56  │          │
│ └──────────────────┘ └──────────────────┘          │
│                                                     │
│ ┌──────────────────┐ ┌──────────────────┐          │
│ │ ...more cards     │ │ ...more cards     │          │
│ └──────────────────┘ └──────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### 3. Build ThemeCard component

Each card displays:

- **Category color dot**: bug=red, feature_request=blue, ux_issue=yellow, performance=orange, etc.
- **Theme name**: Bold, text-lg
- **Feedback count**: "30 feedback items" with font-mono number
- **Sentiment bar**: Horizontal bar from red (-1) through yellow (0) to green (+1), marker at position
- **Urgency indicator**: Low (green) / Medium (yellow) / High (red) badge
- **Opportunity score**: Font-mono number with progress bar visualization
- **Category badge**: Colored badge at bottom
- Hover: border becomes border-hover, subtle scale transform
- Click: opens theme detail

Card styling per design system:

```
bg-bg-surface border border-border rounded-xl p-5
hover:border-border-hover transition-all duration-200
```

### 4. Build ThemeDetail panel

Opens as a slide-over panel from the right (or full page on mobile):

- **Header**: Theme name, category badge, close button
- **Description**: 1-2 sentence description
- **Pain Points**: Numbered list
- **Stats grid**: Feedback count, avg sentiment, avg urgency, opportunity score
- **Linked Feedback**: Table of feedback items belonging to this theme
  - Sorted by similarity score (most relevant first)
  - Shows: content (truncated), sentiment badge, urgency badge, similarity score
  - Click to expand individual feedback item
- **Actions**: "View in Feedback" (navigate to Feedback page filtered by this theme)

### 5. Build SynthesisStatus component

- Shows real-time progress when synthesis is running
- Stage indicators: ✓ Embedded | ✓ Scored | ⟳ Clustering | ○ Naming
- Progress bar with percentage
- Current action text: "Clustering feedback by similarity..."
- Stats: items processed, clusters found
- "Cancel" button to abort synthesis
- Auto-hides when synthesis is idle/complete

### 6. Handle empty and loading states

- **No themes (never synthesized)**: EmptyState with Brain icon, "No themes yet", description "Import feedback and run synthesis to discover themes", action button "Run Synthesis"
- **Synthesis running**: Show SynthesisStatus component, disable "Run Synthesis" button
- **Loading**: Show skeleton cards (grid of shimmer blocks)
- **Error**: Error message with retry button

### 7. Add sorting and filtering

- **Sort by**: Opportunity Score (default), Feedback Count, Avg Urgency, Name
- **Filter by category**: Dropdown with all categories or "All"
- Sort and filter state in URL params

## Acceptance Criteria

- [ ] Themes page shows all themes as cards in a responsive grid
- [ ] Each card shows: name, category, feedback count, sentiment, urgency, opportunity score
- [ ] Cards sorted by opportunity score by default
- [ ] Clicking a card opens the detail panel with full information
- [ ] Detail panel shows linked feedback items sorted by similarity
- [ ] "Run Synthesis" button triggers synthesis and shows progress
- [ ] SynthesisStatus component updates in real-time (polling every 2s)
- [ ] All 4 stages shown with checkmarks/spinners
- [ ] "Cancel" button stops running synthesis
- [ ] Empty state shown when no themes exist
- [ ] Loading state shows skeleton cards
- [ ] Sort and filter controls work correctly
- [ ] Category badges use correct colors
- [ ] Opportunity score displayed with progress bar
- [ ] Responsive: 2 columns on desktop, 1 on mobile

## Complexity Estimate

**L (Large)** — Multiple components with real-time status polling, card grid layout, detail panel, and state management for synthesis progress. Design-heavy with score visualizations.

## Risk Factors & Mitigations

| Risk                                                        | Impact             | Mitigation                                                        |
| ----------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| Polling causes flickering during synthesis                  | Medium — poor UX   | Use `keepPreviousData` in React Query; only update changed fields |
| Too many themes overwhelm the page                          | Low — scrolling    | Pagination or "show more" for >20 themes; top themes shown first  |
| Theme detail panel slow for themes with 100+ feedback items | Medium — slow load | Paginate feedback items within detail panel; show first 20        |
| Opportunity score not intuitive to users                    | Low — confusion    | Add tooltip explaining the formula; show component scores         |
