# 06 — Feedback Tests

## Objective

Write comprehensive unit and integration tests for all feedback functionality: service layer CRUD, CSV parsing edge cases, auto-detection algorithm, import pipeline, webhook authentication, and all API route endpoints. Achieve >80% code coverage on the feedback service layer.

## Dependencies

- 01-feedback-service (service code to test)
- 02-csv-json-import (import code to test)
- 03-manual-entry-webhook (webhook code to test)
- Phase 1: Testing infrastructure (Vitest config, setup, factories, Prisma mock)

## Files to Create

| File                                                     | Purpose                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/api/tests/unit/feedback.service.test.ts`       | Unit tests for feedback service                            |
| `packages/api/tests/unit/import.service.test.ts`         | Unit tests for import service                              |
| `packages/api/tests/unit/csv-parser.test.ts`             | Unit tests for CSV parser                                  |
| `packages/api/tests/unit/column-detector.test.ts`        | Unit tests for column auto-detection                       |
| `packages/api/tests/unit/webhook.service.test.ts`        | Unit tests for webhook service                             |
| `packages/api/tests/integration/feedback.routes.test.ts` | Integration tests for feedback endpoints                   |
| `packages/api/tests/integration/import.routes.test.ts`   | Integration tests for import endpoints                     |
| `packages/api/tests/integration/webhook.routes.test.ts`  | Integration tests for webhook endpoints                    |
| `packages/api/tests/fixtures/valid.csv`                  | Test CSV file with clean data                              |
| `packages/api/tests/fixtures/bom.csv`                    | Test CSV with UTF-8 BOM                                    |
| `packages/api/tests/fixtures/quoted.csv`                 | Test CSV with quoted fields containing commas and newlines |
| `packages/api/tests/fixtures/malformed.csv`              | Test CSV with ragged rows and missing columns              |
| `packages/api/tests/fixtures/valid.json`                 | Test JSON file with feedback array                         |

## Detailed Sub-Tasks

### 1. Unit Tests: Feedback Service (`feedback.service.test.ts`)

```typescript
describe('FeedbackService', () => {
  describe('create', () => {
    it('should create a feedback item with valid data');
    it('should trim whitespace from content');
    it('should create a "Manual Entry" source if not exists');
    it('should use existing "Manual Entry" source if already exists');
    it('should default channel to "manual" when not provided');
    it('should store metadata as JSON');
  });

  describe('findById', () => {
    it('should return feedback item with source and theme links');
    it('should throw NotFound error for non-existent ID');
  });

  describe('list', () => {
    it('should return paginated results with correct pagination metadata');
    it('should default to page 1, pageSize 50, sorted by createdAt desc');
    it('should filter by search term (case-insensitive)');
    it('should filter by channel');
    it('should filter by sourceId');
    it('should filter by processed status (processedAt not null)');
    it('should filter by sentiment range');
    it('should filter by date range');
    it('should combine multiple filters');
    it('should sort by sentiment ascending');
    it('should sort by urgency descending');
    it('should return empty data array when no results match');
  });

  describe('delete', () => {
    it('should delete the item and return it');
    it('should delete associated FeedbackThemeLinks');
    it('should throw NotFound for non-existent ID');
  });

  describe('bulkDelete', () => {
    it('should delete multiple items by IDs');
    it('should return count of deleted items');
    it('should handle empty IDs array gracefully');
    it('should delete associated links and evidence');
  });

  describe('getStats', () => {
    it('should return correct total, processed, unprocessed counts');
    it('should return correct channel breakdown');
    it('should return correct average sentiment and urgency');
    it('should handle zero feedback items');
  });

  describe('checkDuplicate', () => {
    it('should return true for exact content + author + source match');
    it('should return false when no duplicate exists');
    it('should treat null author as distinct from empty string');
  });
});
```

**Approach:** Use Prisma mock for unit tests. Mock all `prisma.feedbackItem.*` calls with `vitest-mock-extended`.

### 2. Unit Tests: CSV Parser (`csv-parser.test.ts`)

```typescript
describe('parseCSV', () => {
  it('should parse a valid CSV file with headers');
  it('should handle UTF-8 BOM marker');
  it('should handle quoted fields containing commas');
  it('should handle quoted fields containing newlines');
  it('should handle escaped quotes within quoted fields');
  it('should skip empty rows');
  it('should handle rows with fewer columns than header (pad with empty)');
  it('should handle rows with more columns than header (truncate)');
  it('should handle trailing commas');
  it('should handle mixed line endings (\\r\\n, \\n, \\r)');
  it('should return error details for malformed rows without crashing');
  it('should respect maxRows option for preview');
  it('should return correct totalRows count');
  it('should reject files exceeding max record size');
});
```

**Approach:** Use test fixture CSV files. Read file as Buffer, pass to parser, assert output.

### 3. Unit Tests: Column Detector (`column-detector.test.ts`)

```typescript
describe('detectColumns', () => {
  describe('name matching (Tier 1)', () => {
    it('should detect column named "content" with high confidence');
    it('should detect column named "feedback" with high confidence');
    it('should detect column named "text" with high confidence');
    it('should detect column named "message" with high confidence');
    it('should detect "user_feedback_text" via partial match');
    it('should be case-insensitive (CONTENT, Content, content)');
    it('should prefer exact match over partial match');
  });

  describe('length heuristic (Tier 2)', () => {
    it('should pick column with longest average text when no name match');
    it('should return medium confidence for length-based detection');
  });

  describe('auto-mapping other columns', () => {
    it('should detect "author" column');
    it('should detect "email" column');
    it('should detect email column by @ symbol in values');
    it('should detect "channel" / "source" column');
    it('should detect "date" / "timestamp" / "created_at" column');
  });

  describe('edge cases', () => {
    it('should handle single-column CSV');
    it('should handle CSV with only ID and content columns');
    it('should handle columns with all empty values');
  });
});
```

### 4. Unit Tests: Import Service (`import.service.test.ts`)

```typescript
describe('ImportService', () => {
  describe('importCSV', () => {
    it('should process ≤100 rows synchronously and return results');
    it('should queue >100 row files as BullMQ jobs and return jobId');
    it('should create FeedbackSource with correct type and filename');
    it('should skip duplicate items and count them');
    it('should log error rows without failing the import');
    it('should apply custom column mapping when provided');
    it('should use auto-detected mapping when not provided');
  });

  describe('importJSON', () => {
    it('should import a valid JSON array');
    it('should handle JSONL format (newline-delimited)');
    it('should reject invalid JSON with clear error');
  });

  describe('previewImport', () => {
    it('should return first 5 rows with headers');
    it('should return auto-detected column mapping');
    it('should return total row count');
  });

  describe('getImportJobStatus', () => {
    it('should return current job status and progress');
    it('should return completed status with final counts');
    it('should return failed status with error message');
    it('should throw NotFound for non-existent jobId');
  });
});
```

### 5. Unit Tests: Webhook Service (`webhook.service.test.ts`)

```typescript
describe('WebhookService', () => {
  describe('generateApiKey', () => {
    it('should return a key starting with "sk_live_"');
    it('should store SHA-256 hash in database (not plaintext)');
    it('should store first 12 characters as keyPrefix');
    it('should never return the same key twice');
  });

  describe('validateApiKey', () => {
    it('should return true for a valid active key');
    it('should return false for an invalid key');
    it('should return false for a revoked key');
    it('should update lastUsedAt on successful validation');
  });

  describe('revokeApiKey', () => {
    it('should set isActive to false');
    it('should prevent future validation');
  });
});
```

### 6. Integration Tests: Feedback Routes (`feedback.routes.test.ts`)

```typescript
describe('Feedback Routes', () => {
  describe('POST /api/feedback', () => {
    it('should create feedback item and return 201');
    it('should return 400 when content is missing');
    it('should return 400 when content is shorter than 10 characters');
    it('should return 400 when email is invalid format');
    it('should trim whitespace from content');
  });

  describe('GET /api/feedback', () => {
    it('should return paginated feedback items');
    it('should default to page 1, 50 items, sorted by createdAt desc');
    it('should filter by search term');
    it('should filter by channel');
    it('should return correct pagination metadata');
    it('should return empty array when no items exist');
  });

  describe('GET /api/feedback/:id', () => {
    it('should return single item with full details');
    it('should return 404 for non-existent ID');
  });

  describe('DELETE /api/feedback/:id', () => {
    it('should delete item and return 204');
    it('should return 404 for non-existent ID');
  });

  describe('POST /api/feedback/bulk-delete', () => {
    it('should delete multiple items and return count');
    it('should return 400 when ids array is empty');
  });

  describe('GET /api/feedback/stats', () => {
    it('should return correct aggregate statistics');
    it('should return zero counts when no items exist');
  });
});
```

### 7. Integration Tests: Import Routes (`import.routes.test.ts`)

```typescript
describe('Import Routes', () => {
  describe('POST /api/feedback/import/csv', () => {
    it('should accept valid CSV file and return 201');
    it('should return 400 for empty file');
    it('should return 413 for file exceeding 50MB limit');
    it('should return 400 for non-CSV file');
    it('should process small files synchronously');
    it('should return jobId for large files');
  });

  describe('POST /api/feedback/import/preview', () => {
    it('should return first 5 rows with detected mapping');
    it('should return 400 for invalid file');
  });

  describe('GET /api/feedback/import/:jobId', () => {
    it('should return job status for existing job');
    it('should return 404 for non-existent job');
  });
});
```

### 8. Integration Tests: Webhook Routes (`webhook.routes.test.ts`)

```typescript
describe('Webhook Routes', () => {
  describe('POST /api/feedback/webhook', () => {
    it('should accept single item with valid API key and return 201');
    it('should accept array of items and return 201');
    it('should return 401 when X-API-Key header is missing');
    it('should return 401 when API key is invalid');
    it('should return 401 when API key is revoked');
    it('should return 400 when payload is invalid');
    it('should return 429 when rate limit exceeded');
  });
});
```

### 9. Create test fixture files

**`tests/fixtures/valid.csv`:**

```csv
feedback,author,email,channel,date
"The app is great but needs dark mode",John Doe,john@example.com,survey,2024-01-15
"Bulk export is broken for large datasets",Sarah Smith,sarah@example.com,support_ticket,2024-01-16
"Love the new dashboard feature",Mike Johnson,,slack,2024-01-17
```

**`tests/fixtures/bom.csv`:** Same as valid.csv but with UTF-8 BOM prepended

**`tests/fixtures/quoted.csv`:** Fields with commas, newlines, escaped quotes

**`tests/fixtures/malformed.csv`:** Ragged rows, extra columns, empty rows

**`tests/fixtures/valid.json`:**

```json
[
  { "content": "Need better export options for reports", "author": "Alice", "channel": "survey" },
  { "content": "The mobile app crashes on Android 14", "author": "Bob" }
]
```

### 10. Run coverage and verify thresholds

```bash
npm run test:coverage
# Verify: feedback.service.ts > 80% line coverage
# Verify: import.service.ts > 80% line coverage
# Verify: csv-parser.ts > 90% line coverage
# Verify: column-detector.ts > 90% line coverage
```

## Acceptance Criteria

- [ ] All unit tests pass (feedback service, import service, CSV parser, column detector, webhook)
- [ ] All integration tests pass (feedback routes, import routes, webhook routes)
- [ ] > 80% code coverage on `feedback.service.ts`
- [ ] > 80% code coverage on `import.service.ts`
- [ ] > 90% code coverage on `csv-parser.ts` and `column-detector.ts`
- [ ] Test fixtures cover edge cases: BOM, quoted fields, malformed rows
- [ ] Integration tests use real test database (not mocks)
- [ ] Unit tests use Prisma mock (no database required)
- [ ] Tests are isolated — run in any order, no data leaks
- [ ] `npm test` from root runs all tests and reports coverage
- [ ] All test names follow "should [behavior] when [condition]" convention

## Complexity Estimate

**L (Large)** — 8 test files, ~80 individual test cases, test fixtures, and coverage verification. Requires careful test data setup and cleanup.

## Risk Factors & Mitigations

| Risk                                     | Impact                                 | Mitigation                                                                 |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Integration tests slow (DB operations)   | Medium — CI takes too long             | Use `singleFork` pool option; batch DB cleanup; keep test data minimal     |
| Prisma mock doesn't match real behavior  | Medium — false positives in unit tests | Back unit tests with integration tests for critical paths; don't over-mock |
| Test database not cleaned between suites | High — flaky tests                     | `beforeEach` cleanup in setup.ts runs before every test                    |
| File upload in Supertest is tricky       | Medium — integration tests fail        | Use `request(app).post('/path').attach('file', buffer, 'name.csv')` syntax |
| Coverage thresholds block CI on new code | Low — development friction             | Set thresholds per-file, not globally; exclude index/barrel files          |
