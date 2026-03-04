# 08 — Synthesis Tests

## Objective

Write comprehensive unit and integration tests for the entire synthesis pipeline: OpenAI client wrapper, embedding service, scoring service, clustering algorithm, theme extraction, synthesis orchestrator, and all synthesis API routes. Achieve >80% coverage on all synthesis services.

## Dependencies

- 01 through 06 (all synthesis backend code must be complete)
- Phase 1: Testing infrastructure

## Files to Create

| File                                                      | Purpose                                   |
| --------------------------------------------------------- | ----------------------------------------- |
| `packages/api/tests/unit/ai.service.test.ts`              | Unit tests for AI service wrapper         |
| `packages/api/tests/unit/embedding.service.test.ts`       | Unit tests for embedding service          |
| `packages/api/tests/unit/scoring.service.test.ts`         | Unit tests for scoring service            |
| `packages/api/tests/unit/clustering.service.test.ts`      | Unit tests for clustering algorithm       |
| `packages/api/tests/unit/theme.service.test.ts`           | Unit tests for theme extraction           |
| `packages/api/tests/unit/vector-math.test.ts`             | Unit tests for vector math utilities      |
| `packages/api/tests/integration/synthesis.routes.test.ts` | Integration tests for synthesis endpoints |

## Detailed Sub-Tasks

### 1. Unit Tests: Vector Math (`vector-math.test.ts`)

```typescript
describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors');
  it('should return 0.0 for orthogonal vectors');
  it('should return -1.0 for opposite vectors');
  it('should handle zero vectors gracefully (return 0)');
  it('should throw for vectors of different dimensions');
  it('should return correct value for known vectors');
  // Test: cosine([1,2,3], [4,5,6]) ≈ 0.9746
});

describe('centroid', () => {
  it('should return the mean of two vectors');
  it('should return the input for a single vector');
  it('should throw for empty array');
  it('should handle high-dimensional vectors (1536 dims)');
});

describe('buildSimilarityMatrix', () => {
  it('should produce NxN symmetric matrix');
  it('should have 1.0 on diagonal');
  it('should compute correct pairwise similarities');
});

describe('findRepresentativeItems', () => {
  it('should return items closest to centroid');
  it('should return at most topK items');
  it('should handle cluster with fewer items than topK');
});
```

### 2. Unit Tests: Clustering (`clustering.service.test.ts`)

```typescript
describe('agglomerativeClustering', () => {
  it('should group identical vectors into one cluster');
  it('should separate orthogonal vectors into different clusters');
  it('should respect similarity threshold');
  it('should produce more clusters with higher threshold');
  it('should produce fewer clusters with lower threshold');
  it('should handle single-item input');
  it('should handle two-item input (identical → 1 cluster)');
  it('should handle two-item input (different → 2 clusters)');
  it('should report correct stats (totalClusters, avgSize, etc.)');
  it('should identify unclustered items (below threshold for all clusters)');
  it('should compute cluster centroids');

  describe('with realistic data', () => {
    it('should cluster 3 groups of 5 similar vectors into 3 clusters');
    it('should handle mixed similarity (some close, some far)');
  });

  describe('performance', () => {
    it('should cluster 100 items in <1 second');
    it('should cluster 1000 items in <5 seconds');
  });
});
```

Use pre-computed test vectors for deterministic results:

```typescript
// 3 clusters of clearly similar vectors
const cluster1 = [
  [1, 0, 0],
  [0.95, 0.05, 0],
  [0.9, 0.1, 0],
];
const cluster2 = [
  [0, 1, 0],
  [0.05, 0.95, 0],
  [0.1, 0.9, 0],
];
const cluster3 = [
  [0, 0, 1],
  [0, 0.05, 0.95],
  [0, 0.1, 0.9],
];
const allVectors = [...cluster1, ...cluster2, ...cluster3];
```

### 3. Unit Tests: AI Service (`ai.service.test.ts`)

Mock the OpenAI client entirely:

```typescript
vi.mock('../lib/openai', () => ({
  openai: { embeddings: { create: vi.fn() }, chat: { completions: { create: vi.fn() } } },
  AI_CONFIG: {
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,
    maxTokens: 4096,
  },
}));

describe('aiService', () => {
  describe('generateEmbeddings', () => {
    it('should return array of vectors matching input length');
    it('should track token usage');
    it('should retry on 429 rate limit error');
    it('should throw after max retries exceeded');
  });

  describe('chatJSON', () => {
    it('should return parsed JSON from LLM response');
    it('should throw AppError(502) on empty response');
    it('should throw AppError(502) on invalid JSON');
    it('should track token usage');
    it('should retry on rate limit');
  });

  describe('chatText', () => {
    it('should return text string from LLM response');
    it('should handle empty response');
  });
});
```

### 4. Unit Tests: Scoring Service (`scoring.service.test.ts`)

```typescript
describe('ScoringService', () => {
  describe('scoreBatch', () => {
    it('should return sentiment and urgency scores for each item');
    it('should clamp sentiment to [-1, 1] range');
    it('should clamp urgency to [0, 1] range');
    it('should handle malformed LLM output (default to 0)');
    it('should handle partial responses (some items missing)');
    it('should process batch of 20 items');
  });

  describe('scoreAllUnscored', () => {
    it('should skip already-scored items');
    it('should call onProgress callback with percentage');
    it('should handle empty input (no unscored items)');
  });
});
```

### 5. Unit Tests: Theme Service (`theme.service.test.ts`)

```typescript
describe('ThemeService', () => {
  describe('extractThemeForCluster', () => {
    it('should return theme with name, description, category, painPoints');
    it('should validate category against allowed values');
    it('should handle malformed LLM output gracefully');
    it('should truncate long theme names to 100 chars');
    it('should limit pain points to 5 items');
  });

  describe('calculateThemeScores', () => {
    it('should calculate correct feedbackCount');
    it('should calculate correct avgSentiment');
    it('should calculate correct avgUrgency');
    it('should calculate opportunityScore as count * urgency * (1 - sentiment)');
    it('should handle items with null scores');
  });

  describe('listThemes', () => {
    it('should return all themes sorted by opportunityScore desc');
    it('should support sorting by feedbackCount');
    it('should support sorting by name');
  });

  describe('clearExistingThemes', () => {
    it('should delete all themes and links');
    it('should not delete feedback items');
  });
});
```

### 6. Integration Tests: Synthesis Routes (`synthesis.routes.test.ts`)

```typescript
describe('Synthesis Routes', () => {
  describe('POST /api/synthesis/run', () => {
    it('should trigger synthesis pipeline and return jobId');
    it('should accept custom similarityThreshold');
    it('should return 409 if synthesis is already running');
    it('should return 400 for invalid threshold (out of range)');
  });

  describe('GET /api/synthesis/status', () => {
    it('should return idle status when no synthesis has run');
    it('should return running status during synthesis');
    it('should return completed status after synthesis');
  });

  describe('GET /api/synthesis/themes', () => {
    it('should return empty array before synthesis');
    it('should return themes after synthesis');
    it('should sort by opportunityScore desc by default');
    it('should support filtering by category');
  });

  describe('GET /api/synthesis/themes/:id', () => {
    it('should return theme with linked feedback items');
    it('should return 404 for non-existent theme');
  });
});
```

**Note for integration tests:** Mock the OpenAI API calls (embedding + chat) to return deterministic results. Use test vectors that produce known clusters.

### 7. Create mock OpenAI responses for testing

```typescript
// packages/api/tests/helpers/openai-mock.ts
export function mockEmbeddingResponse(count: number): {
  data: { embedding: number[] }[];
  usage: { prompt_tokens: number };
} {
  return {
    data: Array.from({ length: count }, () => ({
      embedding: Array.from({ length: 1536 }, () => Math.random()),
    })),
    usage: { prompt_tokens: count * 10 },
  };
}

export function mockScoringResponse(
  count: number,
): { index: number; sentiment: number; urgency: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    sentiment: Math.random() * 2 - 1,
    urgency: Math.random(),
  }));
}
```

## Acceptance Criteria

- [ ] All vector math unit tests pass
- [ ] All clustering unit tests pass with deterministic test vectors
- [ ] Clustering performance tests pass (100 items <1s, 1000 items <5s)
- [ ] All AI service unit tests pass with mocked OpenAI client
- [ ] All scoring service unit tests pass
- [ ] All theme service unit tests pass
- [ ] All synthesis integration tests pass with mocked AI
- [ ] > 80% code coverage on all synthesis service files
- [ ] > 90% code coverage on vector-math.ts and clustering-service.ts
- [ ] Tests are deterministic (same input always produces same output)
- [ ] Tests clean up database state between runs
- [ ] `npm test` runs all synthesis tests and reports results

## Complexity Estimate

**L (Large)** — 7 test files, ~70 individual test cases. Requires mock setup for OpenAI API, deterministic test vectors for clustering, and integration test data seeding.

## Risk Factors & Mitigations

| Risk                                                | Impact                   | Mitigation                                                                            |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Clustering tests non-deterministic (random vectors) | High — flaky tests       | Use fixed test vectors that produce known clusters; avoid randomness                  |
| OpenAI mock doesn't match real API shape            | Medium — false positives | Keep mocks up-to-date with OpenAI SDK types; use vitest-mock-extended for type safety |
| Integration tests require full pipeline setup       | Medium — slow, fragile   | Seed minimal data; mock AI; focus on API contract, not AI quality                     |
| Performance tests vary by machine                   | Low — CI failures        | Set generous thresholds; skip performance tests in CI if needed                       |
