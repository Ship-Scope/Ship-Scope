# 02 — CSV/JSON Import Pipeline

## Objective

Build the complete file import pipeline: CSV and JSON parsing with edge-case handling, auto-detection of the content column, column mapping UI data flow, BullMQ background job processing for large files (>100 rows), progress tracking, duplicate skipping, and error-resilient partial imports.

## Dependencies

- 01-feedback-service (service layer for creating feedback items)
- Phase 1: BullMQ queue definitions, Prisma, error handling

## Files to Create

| File                                          | Purpose                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `packages/api/src/services/import.service.ts` | Import orchestration, parsing, auto-detection  |
| `packages/api/src/workers/import.worker.ts`   | BullMQ worker for background import processing |
| `packages/api/src/schemas/import.schema.ts`   | Zod schemas for import endpoints               |
| `packages/api/src/lib/csv-parser.ts`          | CSV parsing utility with edge-case handling    |
| `packages/api/src/lib/column-detector.ts`     | Content column auto-detection algorithm        |

## Files to Modify

| File                                  | Changes                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `packages/api/src/routes/feedback.ts` | Add import endpoints (POST /import/csv, /import/json, GET /import/:jobId) |
| `packages/api/src/index.ts`           | Start import worker process                                               |

## Detailed Sub-Tasks

### 1. Build CSV parser utility (`packages/api/src/lib/csv-parser.ts`)

Use the `csv-parse` library (already in dependencies) with these edge cases handled:

```typescript
import { parse } from 'csv-parse';

interface ParseCSVOptions {
  maxRows?: number; // Limit for preview (default: all)
  skipEmpty?: boolean; // Skip empty rows (default: true)
}

interface ParseCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: { row: number; message: string }[];
}

export async function parseCSV(buffer: Buffer, options?: ParseCSVOptions): Promise<ParseCSVResult>;
```

**Edge cases to handle:**

- UTF-8 BOM (byte order mark) — strip `\xEF\xBB\xBF` from start of buffer
- Quoted fields containing commas: `"Hello, World"` → `Hello, World`
- Quoted fields containing newlines: `"Line 1\nLine 2"` → `Line 1\nLine 2`
- Escaped quotes: `"She said ""hello"""` → `She said "hello"`
- Trailing commas (extra empty column)
- Mixed line endings (`\r\n`, `\n`, `\r`)
- Empty rows (skip silently, count them)
- Rows with fewer columns than header (pad with empty strings)
- Rows with more columns than header (truncate extras)
- Non-UTF8 encodings (detect and attempt conversion, or reject with clear error)

**Configuration:**

```typescript
const parser = parse(buffer, {
  columns: true, // Use first row as headers
  skip_empty_lines: true,
  relax_column_count: true, // Handle ragged rows
  trim: true,
  bom: true, // Handle BOM automatically
  cast: false, // Keep everything as strings
  max_record_size: 1_000_000, // 1MB per record max
});
```

### 2. Build column auto-detection (`packages/api/src/lib/column-detector.ts`)

```typescript
interface ColumnDetectionResult {
  contentColumn: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedMappings: {
    content: string;
    author?: string;
    email?: string;
    channel?: string;
    date?: string;
  };
}

export function detectColumns(
  headers: string[],
  sampleRows: Record<string, string>[],
): ColumnDetectionResult;
```

**Algorithm:**

**Tier 1 — Name matching (high confidence):**
Check column names (case-insensitive, trimmed) against known content keywords:

- Exact: `content`, `feedback`, `text`, `message`, `comment`, `body`, `description`, `review`, `note`, `response`
- Partial: column name `contains` any of the above words
- If exactly one match → return with `confidence: 'high'`
- If multiple matches → score by specificity (exact > partial), pick best

**Tier 2 — Length heuristic (medium confidence):**
If no name match found:

- Calculate average text length per column across sample rows
- Pick the column with the longest average text length
- Return with `confidence: 'medium'`

**Tier 3 — Fallback (low confidence):**

- If all columns have similar short text, pick the first non-ID column
- Return with `confidence: 'low'`

**Auto-detect other columns:**

- Author: match `author`, `name`, `user`, `username`, `from`, `submitted_by`
- Email: match `email`, `mail`, `e-mail`, or detect `@` in values
- Channel: match `channel`, `source`, `type`, `category`, `platform`
- Date: match `date`, `time`, `created`, `timestamp`, `submitted`

### 3. Build import service (`packages/api/src/services/import.service.ts`)

**Function: `importCSV(file: Buffer, filename: string, columnMapping?: CSVColumnMapping)`**

1. Parse CSV using csv-parser utility
2. If no columnMapping provided, auto-detect columns
3. Create FeedbackSource record (type: 'csv', filename, rowCount)
4. If rows <= 100: process synchronously
   - For each row: check duplicate, create FeedbackItem
   - Return result immediately
5. If rows > 100: queue BullMQ job
   - Store parsed data in Redis (temporary, TTL 1 hour)
   - Add job to importQueue with source ID and Redis key
   - Return jobId for polling

**Function: `importJSON(data: object[], filename: string)`**

1. Validate JSON structure (array of objects with 'content' field)
2. Also support JSONL (newline-delimited JSON)
3. Same flow as CSV (sync for ≤100, async for >100)

**Function: `previewImport(file: Buffer, format: 'csv' | 'json')`**

1. Parse first 5 rows only
2. Run column auto-detection
3. Return: `{ headers, preview: first5rows, suggestedMapping, totalRows }`

**Function: `getImportJobStatus(jobId: string)`**

1. Fetch job from importQueue
2. Return: `{ status, progress, totalRows, processedRows, errorRows, errors }`

### 4. Build import worker (`packages/api/src/workers/import.worker.ts`)

```typescript
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { feedbackService } from '../services/feedback.service';

const importWorker = new Worker(
  'import',
  async (job: Job) => {
    const { sourceId, redisKey, columnMapping } = job.data;

    // Fetch parsed rows from Redis
    const rawData = await redis.get(redisKey);
    const rows = JSON.parse(rawData);

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const row of rows) {
      try {
        const content = row[columnMapping.content];
        if (!content || content.trim().length < 10) {
          errors++;
          continue;
        }

        // Check duplicate
        const isDuplicate = await feedbackService.checkDuplicate(
          content,
          row[columnMapping.author] || null,
          sourceId,
        );
        if (isDuplicate) {
          processed++;
          continue;
        }

        // Create item
        await feedbackService.create({
          content: content.trim(),
          author: row[columnMapping.author] || null,
          email: row[columnMapping.email] || null,
          channel: mapChannel(row[columnMapping.channel]) || 'other',
          metadata: row,
        });

        processed++;
      } catch (err) {
        errors++;
        errorDetails.push(`Row ${processed + errors}: ${err.message}`);
      }

      // Update progress every 10 rows
      if ((processed + errors) % 10 === 0) {
        await job.updateProgress(Math.round(((processed + errors) / rows.length) * 100));
      }
    }

    // Clean up Redis
    await redis.del(redisKey);

    // Update source rowCount
    await prisma.feedbackSource.update({
      where: { id: sourceId },
      data: { rowCount: processed },
    });

    return { processed, errors, errorDetails };
  },
  { connection: redis, concurrency: 2 },
);
```

**Worker features:**

- Concurrency: 2 (process 2 imports simultaneously)
- Progress updates every 10 rows
- Error rows logged but don't block import
- Redis cleanup after completion
- Source rowCount updated on completion

### 5. Create import Zod schemas (`packages/api/src/schemas/import.schema.ts`)

```typescript
export const importCSVSchema = z.object({
  columnMapping: z
    .object({
      content: z.string(),
      author: z.string().optional(),
      email: z.string().optional(),
      channel: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
});

export const importJSONSchema = z.object({
  items: z
    .array(
      z.object({
        content: z.string().min(10),
        author: z.string().optional(),
        email: z.string().email().optional(),
        channel: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(10000),
});
```

### 6. Add import routes to feedback router

```typescript
// POST /api/feedback/import/csv
// Accepts multipart/form-data with 'file' field
// Optional JSON body for column mapping
// Returns: { jobId } for async or { data: { imported, skipped, errors } } for sync

// POST /api/feedback/import/json
// Accepts JSON body with items array
// Returns same as above

// POST /api/feedback/import/preview
// Accepts multipart/form-data with 'file' field
// Returns: { headers, preview, suggestedMapping, totalRows }

// GET /api/feedback/import/:jobId
// Returns: ImportJobStatus
```

**File upload handling with Multer:**

```typescript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.json', '.jsonl'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .csv, .json, and .jsonl files are allowed'));
  },
});

router.post('/import/csv', upload.single('file'), async (req, res, next) => { ... });
```

### 7. Start worker in app initialization

Update `packages/api/src/index.ts` to import and start the import worker when the app starts. Worker runs in the same process (for simplicity in V1) but could be extracted to a separate process later.

## Acceptance Criteria

- [ ] CSV parsing handles: BOM, quoted fields, commas in fields, newlines in fields, empty rows
- [ ] Column auto-detection correctly identifies "content" column by name matching
- [ ] Column auto-detection falls back to longest-text-length heuristic
- [ ] Auto-detection suggests mappings for author, email, channel, date columns
- [ ] POST /api/feedback/import/csv accepts multipart upload and returns 201
- [ ] POST /api/feedback/import/csv rejects files >50MB with 413
- [ ] POST /api/feedback/import/csv rejects non-CSV/JSON files with 400
- [ ] Files ≤100 rows are processed synchronously (response contains results)
- [ ] Files >100 rows return jobId and process in background
- [ ] GET /api/feedback/import/:jobId returns correct job status and progress
- [ ] Duplicate items are silently skipped (counted in response)
- [ ] Error rows are logged but don't block import (partial success)
- [ ] POST /api/feedback/import/preview returns first 5 rows with suggested mapping
- [ ] JSON import supports both array-of-objects and JSONL format
- [ ] FeedbackSource record created with correct rowCount after import
- [ ] Worker processes at most 2 imports concurrently

## Complexity Estimate

**XL (Extra Large)** — Most complex backend task in Phase 2. Involves file parsing, auto-detection algorithms, background job processing, progress tracking, and error-resilient import. Many edge cases in CSV parsing.

## Risk Factors & Mitigations

| Risk                                               | Impact                         | Mitigation                                                                             |
| -------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| CSV parsing hangs on malformed files               | High — worker blocks           | Set max record size (1MB per row), timeout per file (5 min), wrap in try/catch         |
| Memory exhaustion on large files                   | High — process crash           | Stream parsing for files >10MB; for V1, memoryStorage with 50MB limit is acceptable    |
| Redis data expires before worker processes it      | Medium — import fails silently | Set TTL to 1 hour (generous), log warning if key missing                               |
| BullMQ job stuck in active state                   | Medium — import appears hung   | Set job timeout (10 min), implement stalled job cleanup                                |
| Encoding detection fails for non-UTF8              | Medium — garbled content       | Default to UTF-8, strip BOM, reject files that fail validation with clear error        |
| Column mapping mismatch between preview and import | Medium — wrong data imported   | Return column mapping in preview response, require explicit confirmation before import |
