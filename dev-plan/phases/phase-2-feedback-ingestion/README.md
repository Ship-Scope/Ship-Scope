# Phase 2: Feedback Ingestion

> **Timeline:** Days 4-7
> **Goal:** Build the complete feedback ingestion pipeline — CRUD service layer, CSV/JSON import with auto-detection, manual entry, webhook API, full management UI with table/filters/pagination, and comprehensive test coverage. After this phase, users can get data into ShipScope through any channel.

---

## Dependency Graph

```
Phase 1 (complete) ──> 01-feedback-service ──┬──> 02-csv-json-import ──> 05-import-modal-ui
                                              │
                                              ├──> 03-manual-entry-webhook
                                              │
                                              ├──> 04-feedback-list-ui
                                              │
                                              └──> 06-feedback-tests (depends on 01, 02, 03)

Parallelizable:
  - 02 and 03 can start simultaneously after 01
  - 04 can start after 01 (only needs list/filter endpoints)
  - 05 depends on 02 (import endpoint must exist)
  - 06 depends on 01, 02, 03 (all backend code must be complete)
```

---

## Tasks Overview

| #   | Task                       | Complexity | Dependencies     | Est. |
| --- | -------------------------- | ---------- | ---------------- | ---- |
| 01  | Feedback Service Layer     | L          | Phase 1 complete | 1d   |
| 02  | CSV/JSON Import Pipeline   | XL         | 01               | 1.5d |
| 03  | Manual Entry & Webhook API | M          | 01               | 0.5d |
| 04  | Feedback List UI           | XL         | 01               | 1.5d |
| 05  | Import Modal UI            | L          | 02               | 1d   |
| 06  | Feedback Tests             | L          | 01, 02, 03       | 1d   |

---

## Key Architectural Decisions

1. **Service layer extraction** — All existing route logic in `feedback.ts` must be extracted into `feedback.service.ts`. Routes become thin HTTP adapters. This pattern is established here and followed by all subsequent features.

2. **BullMQ for large imports** — CSV files >100 rows are processed as background jobs. The API immediately returns a `jobId`, and the client polls for status. This prevents HTTP timeout for large files.

3. **Auto-detection algorithm** — Content column detection uses a two-tier approach: (1) match column name against known keywords, (2) fallback to longest average text length. This is more robust than relying solely on column names.

4. **Duplicate detection** — Uses content + author + source composite uniqueness check. Exact match only in V1 (no fuzzy matching). Duplicates are skipped silently with a count in the response.

---

## Exit Criteria

Before moving to Phase 3, ALL of the following must be true:

- [ ] POST /api/feedback creates a single feedback item with validation
- [ ] POST /api/feedback/import/csv accepts and processes a CSV file
- [ ] POST /api/feedback/import/json accepts and processes a JSON file
- [ ] GET /api/feedback returns paginated results with search, filter, and sort
- [ ] GET /api/feedback/:id returns a single item with full details
- [ ] DELETE /api/feedback/:id removes an item
- [ ] POST /api/feedback/webhook accepts webhook payloads with API key auth
- [ ] CSV auto-detection correctly identifies the content column
- [ ] Large imports (>100 rows) process as background jobs with status tracking
- [ ] Frontend feedback page shows table with pagination, search, and filters
- [ ] Import modal supports drag-and-drop CSV upload with preview
- [ ] All unit tests pass for feedback service (>80% coverage)
- [ ] All integration tests pass for all feedback endpoints
- [ ] 200 seed feedback items display correctly in the UI
