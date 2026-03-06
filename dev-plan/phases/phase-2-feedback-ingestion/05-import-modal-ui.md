# 05 — Import Modal UI

## Objective

Build the CSV/JSON import modal with drag-and-drop file upload, file format validation, preview table showing first 5 rows, auto-detected column mapping with manual override capability, import confirmation, progress indicator for background jobs, and success/error feedback via toast notifications.

## Dependencies

- 02-csv-json-import (backend import endpoints)
- Phase 1: Modal, Button, Toast, Table UI components

## Files to Create

| File                                                      | Purpose                                     |
| --------------------------------------------------------- | ------------------------------------------- |
| `packages/web/src/components/feedback/ImportModal.tsx`    | Main import modal component                 |
| `packages/web/src/components/feedback/FileDropzone.tsx`   | Drag-and-drop file upload area              |
| `packages/web/src/components/feedback/ColumnMapper.tsx`   | Column mapping interface                    |
| `packages/web/src/components/feedback/ImportProgress.tsx` | Progress bar for background imports         |
| `packages/web/src/hooks/useImport.ts`                     | React Query mutations for import operations |

## Files to Modify

| File                                      | Changes                              |
| ----------------------------------------- | ------------------------------------ |
| `packages/web/src/pages/FeedbackPage.tsx` | Add "Import" button that opens modal |
| `packages/web/src/lib/api.ts`             | Add import API functions             |

## Detailed Sub-Tasks

### 1. Create import API functions

```typescript
export const importApi = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportPreviewResponse>('/feedback/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  importCSV: (file: File, columnMapping?: CSVColumnMapping) => {
    const form = new FormData();
    form.append('file', file);
    if (columnMapping) form.append('mapping', JSON.stringify(columnMapping));
    return api
      .post<ImportResponse>('/feedback/import/csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  importJSON: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportResponse>('/feedback/import/json', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  jobStatus: (jobId: string) =>
    api.get<ImportJobStatus>(`/feedback/import/${jobId}`).then((r) => r.data),
};
```

### 2. Create import hooks (`packages/web/src/hooks/useImport.ts`)

```typescript
export function useImportPreview() {
  return useMutation({
    mutationFn: (file: File) => importApi.preview(file),
  });
}

export function useImportCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping?: CSVColumnMapping }) =>
      importApi.importCSV(file, mapping),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useImportJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => importApi.jobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000; // Poll every 2 seconds while active
    },
  });
}
```

### 3. Build ImportModal — Multi-step flow

The modal follows a 3-step wizard:

**Step 1: File Upload**

```
┌──────────────────────────────────────────────┐
│ Import Feedback                          [X] │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          ↑ Upload                      │  │
│  │                                        │  │
│  │   Drag & drop your file here           │  │
│  │   or click to browse                   │  │
│  │                                        │  │
│  │   Supports: .csv, .json, .jsonl        │  │
│  │   Max size: 50MB                       │  │
│  └────────────────────────────────────────┘  │
│                                              │
├──────────────────────────────────────────────┤
│                                    [Cancel]  │
└──────────────────────────────────────────────┘
```

**Step 2: Preview & Map**

```
┌──────────────────────────────────────────────┐
│ Import Feedback — Map Columns            [X] │
├──────────────────────────────────────────────┤
│ File: customer_feedback.csv (342 rows)       │
│                                              │
│ Column Mapping:                              │
│ Content* ──── [feedback_text ▼] ✓ detected   │
│ Author  ──── [user_name ▼]                   │
│ Email   ──── [email ▼]                       │
│ Channel ──── [source ▼]                      │
│ Date    ──── [created_at ▼]                  │
│                                              │
│ Preview (first 5 rows):                      │
│ ┌──────────────────┬────────┬───────────┐   │
│ │ feedback_text     │ user   │ email     │   │
│ ├──────────────────┼────────┼───────────┤   │
│ │ "App crashes..." │ John   │ j@ex.com  │   │
│ │ "Need export..." │ Sarah  │ s@ex.com  │   │
│ │ "Great tool..."  │ Mike   │ (empty)   │   │
│ └──────────────────┴────────┴───────────┘   │
│                                              │
├──────────────────────────────────────────────┤
│ [← Back]                     [Import 342 →] │
└──────────────────────────────────────────────┘
```

**Step 3: Progress / Result**

```
┌──────────────────────────────────────────────┐
│ Import Feedback — Importing...           [X] │
├──────────────────────────────────────────────┤
│                                              │
│  ████████████████████░░░░░  78%              │
│  Processing 265 of 342 rows...               │
│                                              │
│  ✓ 260 imported                              │
│  ⊘ 3 duplicates skipped                      │
│  ✗ 2 errors                                  │
│                                              │
├──────────────────────────────────────────────┤
│                                     [Done]   │
└──────────────────────────────────────────────┘
```

### 4. Build FileDropzone component

Use `react-dropzone` (already in dependencies):

```typescript
import { useDropzone } from 'react-dropzone';

function FileDropzone({ onFile }: { onFile: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/x-ndjson': ['.jsonl'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
    onDropAccepted: (files) => onFile(files[0]),
  });
  // Render dropzone with upload icon, text, and drag-active state
}
```

**Visual states:**

- Default: Dashed border, upload icon, "Drag & drop" text
- Drag active: Border becomes accent-blue, background becomes accent-blue-dim
- File selected: Show filename, size, and "Change file" link
- Error: Red border, error message (too large, wrong format)

### 5. Build ColumnMapper component

- Receives `headers` (string[]) and `suggestedMapping` from preview API
- Renders 5 mapping rows: Content (required), Author, Email, Channel, Date
- Each row has a dropdown with all column headers + "— Skip —" option
- Auto-detected column pre-selected with green "✓ Auto-detected" indicator
- Content column is required — show error if not selected
- Changing a mapping updates the preview highlight

### 6. Build ImportProgress component

- Shows progress bar (0-100%)
- Status text: "Importing...", "Processing row 265 of 342..."
- Result counters: imported (green), duplicates skipped (yellow), errors (red)
- For sync imports (≤100 rows): show loading spinner, then results
- For async imports (>100 rows): poll jobStatus every 2s, update progress bar
- On completion: show "Done" button that closes modal and triggers toast

### 7. Wire up to FeedbackPage

Add "Import" button to Topbar actions:

```tsx
<Topbar
  title="Feedback"
  actions={
    <>
      <Button variant="secondary" onClick={() => setImportOpen(true)}>
        <Upload size={16} /> Import
      </Button>
      <Button onClick={() => setManualOpen(true)}>
        <Plus size={16} /> Add
      </Button>
    </>
  }
/>
<ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
```

### 8. Handle error states

- File too large: Show inline error on dropzone, don't proceed
- Parse failure: Show error with "Try a different file" suggestion
- No content column detected: Allow manual selection, warn about low confidence
- Import partial failure: Show success count + error count, list first 5 error messages
- Network error: Show retry button

## Acceptance Criteria

- [ ] "Import" button in Topbar opens the import modal
- [ ] Drag-and-drop zone accepts .csv, .json, .jsonl files
- [ ] Drag-and-drop visual feedback (border color change on drag over)
- [ ] Files >50MB rejected with clear error message
- [ ] Non-supported file types rejected with clear message
- [ ] Preview shows first 5 rows in a table after file upload
- [ ] Auto-detected content column highlighted with "✓" indicator
- [ ] All 5 mapping dropdowns populated with file headers
- [ ] User can change column mapping before importing
- [ ] "Import N rows" button shows correct count
- [ ] Sync import (≤100 rows) shows results immediately
- [ ] Async import (>100 rows) shows progress bar with polling
- [ ] Progress bar updates every 2 seconds during async import
- [ ] Result shows: imported count, duplicates skipped, errors
- [ ] "Done" button closes modal and shows success toast
- [ ] Feedback table refreshes after successful import
- [ ] Modal can be closed at any step (import continues in background)
- [ ] Keyboard: Escape closes modal, Tab navigates inputs

## Complexity Estimate

**L (Large)** — Multi-step modal with file handling, preview, dynamic column mapping, and progress tracking. Complex UI state management across 3 steps.

## Risk Factors & Mitigations

| Risk                                            | Impact                          | Mitigation                                                                        |
| ----------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Large file uploads timeout                      | Medium — user sees error        | Use streaming upload for files >10MB; show upload progress                        |
| Preview API slow for large files                | Medium — modal feels stuck      | Show skeleton loader for preview table, limit preview to first 5 rows server-side |
| Column mapper confusing for non-technical users | Medium — wrong data imported    | Pre-select auto-detected columns, show confidence indicator, preview updates live |
| Poll interval causes too many requests          | Low — server load               | Start at 2s, increase to 5s after 10 polls (backoff)                              |
| User closes modal during async import           | Low — import continues silently | Import runs server-side regardless; show toast when complete (if still on page)   |
