# 03 — Sentiment & Urgency Scoring

## Objective

Build the batch LLM scoring system that assigns sentiment (-1 to 1) and urgency (0 to 1) scores to every feedback item using gpt-4o-mini with structured JSON output, processing 20 items per API call for cost efficiency.

## Dependencies

- 01-openai-client (aiService.chatJSON())
- Phase 1: Prisma, shared types
- Phase 2: Feedback items exist in database

## Files to Create

| File                                           | Purpose                |
| ---------------------------------------------- | ---------------------- |
| `packages/api/src/services/scoring.service.ts` | Scoring business logic |

## Files to Modify

| File                                     | Changes                                    |
| ---------------------------------------- | ------------------------------------------ |
| `packages/core/src/prompts/synthesis.ts` | Ensure buildScoringPrompt() is implemented |

## Detailed Sub-Tasks

### 1. Implement buildScoringPrompt in core package

If not already implemented in Phase 1 Task 02:

```typescript
// packages/core/src/prompts/synthesis.ts
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

### 2. Build scoring service (`packages/api/src/services/scoring.service.ts`)

**Function: `getUnscoredItems(limit?: number)`**

- Query FeedbackItems where `sentiment IS NULL OR urgency IS NULL`
- Order by `createdAt ASC`
- Return items with id and content

**Function: `scoreBatch(items: { id: string; content: string }[])`**

- Build prompt using `buildScoringPrompt(items)`
- Call `aiService.chatJSON<ScoringResponse[]>(prompt)`
- Parse response: array of `{ index, sentiment, urgency }`
- Validate each score: sentiment in [-1, 1], urgency in [0, 1]
- Clamp out-of-range values
- Update database: set sentiment and urgency on each FeedbackItem
- Return count of scored items

**Function: `scoreAllUnscored(onProgress?: (pct: number) => void)`**

- Fetch all unscored items
- Split into batches of 20
- Process each batch sequentially (respect rate limits)
- Call onProgress callback with percentage
- Return total scored count

**Function: `getScoringStats()`**

- Total items
- Scored items (sentiment is not null)
- Unscored items
- Average sentiment, average urgency across all scored items

### 3. Handle malformed LLM output

The LLM may return:

- Valid JSON array → parse and use
- JSON with extra fields → ignore extra fields
- JSON with missing items → score only returned items, log missing
- Invalid JSON → retry once with stricter prompt, then default to 0 for both scores
- Scores outside range → clamp to valid range

```typescript
function parseScoringResponse(
  raw: unknown,
): { index: number; sentiment: number; urgency: number }[] {
  const arr = Array.isArray(raw) ? raw : (raw as any)?.scores || [];

  return arr
    .map((item: any) => ({
      index: typeof item.index === 'number' ? item.index : -1,
      sentiment: clamp(parseFloat(item.sentiment) || 0, -1, 1),
      urgency: clamp(parseFloat(item.urgency) || 0, 0, 1),
    }))
    .filter((item) => item.index >= 0);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
```

### 4. Store scores in database

```typescript
async function storeScores(
  scores: { id: string; sentiment: number; urgency: number }[],
): Promise<void> {
  await prisma.$transaction(
    scores.map((score) =>
      prisma.feedbackItem.update({
        where: { id: score.id },
        data: { sentiment: score.sentiment, urgency: score.urgency },
      }),
    ),
  );
}
```

### 5. Integrate with synthesis pipeline

The scoring service is called by the synthesis orchestrator (Task 06) as Stage 2 of the pipeline. It can also be triggered independently for testing.

## Acceptance Criteria

- [ ] Every unscored feedback item gets a sentiment score (-1 to 1)
- [ ] Every unscored feedback item gets an urgency score (0 to 1)
- [ ] Scores stored on FeedbackItem model in database
- [ ] Batch processing: 20 items per LLM call
- [ ] Already-scored items are skipped (idempotent)
- [ ] Malformed LLM output handled gracefully (defaults to 0)
- [ ] Out-of-range scores clamped to valid range
- [ ] Progress callback reports percentage during batch processing
- [ ] Token usage tracked for every scoring API call
- [ ] `getScoringStats()` returns correct counts and averages
- [ ] Scoring completes for 200 items in <30 seconds (10 batches of 20)

## Complexity Estimate

**L (Large)** — LLM output parsing is the tricky part. Must handle various malformed responses gracefully without crashing the pipeline. Batch management and progress tracking add complexity.

## Risk Factors & Mitigations

| Risk                                    | Impact                          | Mitigation                                                                    |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| LLM returns wrong number of scores      | Medium — items remain unscored  | Match by index field; log and skip missing items                              |
| LLM returns non-JSON response           | Medium — batch fails            | Use `response_format: json_object`; retry once on parse failure; default to 0 |
| Scores not meaningful (all 0 or random) | Low — analytics unreliable      | Spot-check a sample; tweak prompt if scores seem random                       |
| 20 items per call = too many tokens     | Low — truncation or poor scores | Monitor prompt size; reduce batch to 10 if >4K tokens per call                |
| Rate limiting on chat API               | Medium — scoring stalls         | aiService handles retry with backoff; add delay between batches               |
