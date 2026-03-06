# 04 — Feedback List UI

## Objective

Build the complete Feedback page UI: a data table showing all feedback items with pagination, full-text search, multi-criteria filtering (channel, source, status, date range, sentiment), sorting, bulk selection with actions (delete, mark processed), and expandable rows showing full content and linked themes.

## Dependencies

- 01-feedback-service (API endpoints for list, stats, delete, bulk operations)
- Phase 1: Frontend scaffold (Shell, Topbar, PageContainer, UI components)

## Files to Create

| File                                                       | Purpose                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/web/src/pages/FeedbackPage.tsx`                  | Main feedback page (replace placeholder)                   |
| `packages/web/src/components/feedback/FeedbackTable.tsx`   | Table component with rows and columns                      |
| `packages/web/src/components/feedback/FeedbackRow.tsx`     | Single row with expandable detail                          |
| `packages/web/src/components/feedback/FeedbackFilters.tsx` | Filter bar: search, channel, status, date range, sentiment |
| `packages/web/src/components/feedback/FeedbackStats.tsx`   | Stats bar showing total, processed, avg sentiment          |
| `packages/web/src/components/feedback/FeedbackDetail.tsx`  | Expanded row detail showing full content, metadata, themes |
| `packages/web/src/hooks/useFeedback.ts`                    | React Query hooks for feedback data                        |

## Files to Modify

| File                          | Changes                          |
| ----------------------------- | -------------------------------- |
| `packages/web/src/lib/api.ts` | Add feedback API typed functions |

## Detailed Sub-Tasks

### 1. Create feedback API functions (`packages/web/src/lib/api.ts`)

```typescript
export const feedbackApi = {
  list: (params: FeedbackQueryParams) =>
    api.get<PaginatedResponse<FeedbackItem>>('/feedback', { params }).then((r) => r.data),

  get: (id: string) => api.get<{ data: FeedbackItem }>(`/feedback/${id}`).then((r) => r.data.data),

  create: (data: CreateFeedbackInput) =>
    api.post<{ data: FeedbackItem }>('/feedback', data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/feedback/${id}`),

  bulkDelete: (ids: string[]) =>
    api
      .post<{ data: { deleted: number } }>('/feedback/bulk-delete', { ids })
      .then((r) => r.data.data),

  stats: () => api.get<{ data: FeedbackStats }>('/feedback/stats').then((r) => r.data.data),
};
```

### 2. Create React Query hooks (`packages/web/src/hooks/useFeedback.ts`)

```typescript
export function useFeedbackList(params: FeedbackQueryParams) {
  return useQuery({
    queryKey: ['feedback', 'list', params],
    queryFn: () => feedbackApi.list(params),
    placeholderData: keepPreviousData, // Keep showing old data while new page loads
  });
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: ['feedback', 'stats'],
    queryFn: () => feedbackApi.stats(),
    staleTime: 60_000, // Stats change less frequently
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedbackApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useBulkDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => feedbackApi.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
```

### 3. Build FeedbackPage layout

```
┌─────────────────────────────────────────────────────┐
│ Topbar: "Feedback"                [Import] [+ Add]  │
├─────────────────────────────────────────────────────┤
│ Stats: 1,234 total │ 890 processed │ Avg ★ 0.3     │
├─────────────────────────────────────────────────────┤
│ 🔍 Search...  │ Channel ▼ │ Status ▼ │ Date ▼ │ ⟳  │
├─────────────────────────────────────────────────────┤
│ ☐ │ Content (truncated)    │ Author │ Ch │ Sent │ ↕ │
│───│──────────────────────────│────────│────│──────│───│
│ ☐ │ "App crashes when I..."│ John   │ 🎫 │ -0.7 │ 2h│
│ ☐ │ "Need bulk export..."  │ Sarah  │ 📧 │ -0.3 │ 3h│
│ ☐ │ "Love the new feat..." │ Mike   │ 💬 │  0.8 │ 5h│
│   │ ▼ (expanded detail)    │        │    │      │   │
│   │ Full content text here │        │    │      │   │
│   │ Themes: [Bulk Export]  │        │    │      │   │
├─────────────────────────────────────────────────────┤
│ Showing 1-50 of 1,234  │  ◀ 1 2 3 ... 25 ▶       │
├─────────────────────────────────────────────────────┤
│ Selected: 3 items  │  [Delete] [Mark Processed]    │ ← bulk action bar
└─────────────────────────────────────────────────────┘
```

### 4. Build FeedbackFilters component

- **Search input**: Debounced (300ms) text input that updates URL query param `?search=`
- **Channel dropdown**: Multi-select dropdown with all channel options
- **Status filter**: "All" | "Processed" | "Unprocessed" toggle
- **Date range**: Two date pickers (from/to) using native `<input type="date">`
- **Sentiment range**: Simple dropdown "All" | "Positive (>0.3)" | "Neutral (-0.3 to 0.3)" | "Negative (<-0.3)"
- **Reset button**: Clears all filters
- All filters sync to URL search params (shareable URLs, survives refresh)

### 5. Build FeedbackTable component

- **Columns**: Checkbox (selection), Content (truncated to 100 chars), Author, Channel (icon+label), Sentiment (color-coded badge), Date (relative: "2h ago")
- **Sorting**: Click column header to sort (createdAt, sentiment, urgency). Show sort indicator arrow.
- **Selection**: Checkbox in header selects all on current page. Individual row checkboxes.
- **Row hover**: `bg-bg-surface-2` background transition
- **Row click**: Expands/collapses row detail (not the checkbox area)

### 6. Build FeedbackRow component

Each row renders:

- Checkbox (stops propagation to prevent expand/collapse)
- Content truncated with `truncate(content, 100)` utility
- Author name or "Anonymous" in muted text
- Channel as color-coded badge icon
- Sentiment as color badge: green (>0.3), yellow (-0.3 to 0.3), red (<-0.3), gray (unscored)
- Relative time: "2 hours ago", "3 days ago" using `formatDate` utility

### 7. Build FeedbackDetail (expanded row)

When a row is clicked, show expanded section below:

- Full content text (no truncation)
- Metadata grid: author, email, channel, source, created date, processed date
- Sentiment and urgency scores with visual bars
- Linked themes (if any): clickable badges that navigate to theme detail
- Action buttons: "Delete", "View Source"

### 8. Build pagination component

- Shows "Showing 1-50 of 1,234 feedback items"
- Page navigation: Previous, page numbers (with ellipsis for large ranges), Next
- Syncs to URL param `?page=`
- `keepPreviousData` in React Query prevents flash of empty during page change

### 9. Build bulk action bar

- Appears as sticky bar at bottom when 1+ rows selected
- Shows "X items selected"
- Actions: "Delete Selected" (with confirmation modal), "Mark as Processed"
- Disappears when selection cleared

### 10. Implement URL state management

All filter/sort/pagination state lives in URL search params:

```
/feedback?page=2&search=export&channel=support_ticket&sortBy=sentiment&sortOrder=desc
```

Use a custom hook `useFeedbackParams()` that reads/writes URL params:

```typescript
function useFeedbackParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Parse all params with defaults
  // Return { params, setParam, resetParams }
}
```

### 11. Handle loading, error, and empty states

- **Loading**: Show skeleton table (8 rows of shimmer)
- **Error**: Show error message with retry button
- **Empty (no data)**: Show EmptyState with "No feedback yet — Import your first feedback"
- **Empty (filtered)**: Show "No results match your filters" with reset button

## Acceptance Criteria

- [ ] Feedback page shows all feedback items in a table with correct columns
- [ ] Pagination works: 50 items per page, page navigation controls
- [ ] "Showing 1-50 of 1,234" count is accurate
- [ ] Search filters results as user types (debounced 300ms)
- [ ] Channel filter shows only items from selected channel
- [ ] Status filter shows processed/unprocessed items
- [ ] Date range filter works correctly
- [ ] Sort by clicking column headers (createdAt, sentiment, urgency)
- [ ] Sort indicator shows current sort column and direction
- [ ] Clicking a row expands to show full content and metadata
- [ ] Expanded row shows linked themes as clickable badges
- [ ] Checkbox selection works: individual and select-all
- [ ] Bulk delete confirms before deleting, then refreshes table
- [ ] Bulk "Mark Processed" updates items and refreshes
- [ ] All filters sync to URL params (refresh preserves filters)
- [ ] Loading state shows skeleton table
- [ ] Empty state shows onboarding message
- [ ] Filtered empty state shows "no results" with reset
- [ ] Responsive: table scrolls horizontally on mobile

## Complexity Estimate

**XL (Extra Large)** — Most complex frontend component in Phase 2. Combines table rendering, pagination, search, multi-filter, sorting, selection, expand/collapse, bulk actions, URL state sync, and multiple data states (loading, error, empty, filtered-empty).

## Risk Factors & Mitigations

| Risk                                             | Impact                             | Mitigation                                                                           |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Table re-renders on every filter change          | Medium — UI jank                   | Use `keepPreviousData` in React Query, debounce search input, memoize table rows     |
| URL param parsing edge cases                     | Medium — broken links              | Use Zod to parse URL params with defaults; invalid params fall back to defaults      |
| Bulk delete on large selection (500 items)       | Medium — slow API call             | Show loading state on bulk action bar, batch deletes if needed                       |
| Sentiment/urgency columns empty before synthesis | Low — confusing UI                 | Show "—" for null scores, add tooltip explaining "Run synthesis to generate scores"  |
| Mobile table too wide                            | Medium — unusable on small screens | Hide less important columns (channel, sentiment) on mobile; show only content + date |
