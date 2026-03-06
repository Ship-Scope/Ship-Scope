# 04 — Clustering Engine

## Objective

Implement the agglomerative clustering algorithm in pure TypeScript: cosine similarity calculation, similarity matrix construction, hierarchical agglomerative clustering with average linkage, configurable similarity threshold, centroid calculation, and cluster assignment. This is the core algorithm that groups similar feedback items into themes.

## Dependencies

- None (pure algorithm — no API or database dependencies for the core logic)
- Phase 1: Prisma (for fetching embeddings when integrated)

## Files to Create

| File                                              | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `packages/api/src/services/clustering.service.ts` | Clustering algorithm and related functions                |
| `packages/api/src/lib/vector-math.ts`             | Vector math utilities (cosine similarity, centroid, etc.) |

## Detailed Sub-Tasks

### 1. Build vector math utilities (`packages/api/src/lib/vector-math.ts`)

```typescript
/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same dimensions');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Calculate centroid (mean vector) of a set of vectors
 */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new Error('Cannot calculate centroid of empty set');
  const dims = vectors[0].length;
  const result = new Array(dims).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * Build a full similarity matrix for N vectors
 * Returns NxN matrix where matrix[i][j] = cosineSimilarity(vectors[i], vectors[j])
 */
export function buildSimilarityMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0; // Self-similarity is always 1
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

/**
 * Find the most representative items in a cluster (closest to centroid)
 */
export function findRepresentativeItems(
  vectors: number[][],
  indices: number[],
  topK: number = 10,
): number[] {
  const clusterVectors = indices.map((i) => vectors[i]);
  const center = centroid(clusterVectors);

  const scored = indices.map((idx) => ({
    idx,
    similarity: cosineSimilarity(vectors[idx], center),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK).map((s) => s.idx);
}
```

### 2. Implement agglomerative clustering (`packages/api/src/services/clustering.service.ts`)

**Algorithm: Agglomerative Hierarchical Clustering with Average Linkage**

```
Input: N vectors, similarity threshold T (default 0.82)
Output: Array of clusters (each cluster = array of item indices)

1. Initialize N clusters, each containing one item
2. Build NxN similarity matrix
3. Repeat:
   a. Find the pair of clusters (A, B) with highest average similarity
   b. If similarity < T → stop (no more merges)
   c. Merge A and B into a single cluster
   d. Update similarity matrix (average linkage: sim(new, C) = avg of all pairwise sims)
4. Return all clusters
```

```typescript
interface ClusterResult {
  clusters: number[][];           // Array of clusters, each cluster is array of item indices
  unclustered: number[];          // Items that didn't fit any cluster
  clusterCentroids: number[][];   // Centroid vector for each cluster
  stats: {
    totalItems: number;
    totalClusters: number;
    avgClusterSize: number;
    minClusterSize: number;
    maxClusterSize: number;
    unclusteredCount: number;
  };
}

export function agglomerativeClustering(
  vectors: number[][],
  threshold: number = 0.82,
  minClusterSize: number = 1,
): ClusterResult { ... }
```

**Implementation steps:**

Step 1: Initialize — create N singleton clusters

```typescript
let clusters: Set<number>[] = vectors.map((_, i) => new Set([i]));
let activeClusters = new Set(clusters.map((_, i) => i));
```

Step 2: Build similarity matrix

```typescript
const simMatrix = buildSimilarityMatrix(vectors);
```

Step 3: Iterative merging loop

```typescript
while (activeClusters.size > 1) {
  // Find most similar pair
  let bestSim = -Infinity;
  let bestI = -1,
    bestJ = -1;

  const active = [...activeClusters];
  for (let ai = 0; ai < active.length; ai++) {
    for (let aj = ai + 1; aj < active.length; aj++) {
      const i = active[ai],
        j = active[aj];
      const sim = averageLinkage(clusters[i], clusters[j], simMatrix);
      if (sim > bestSim) {
        bestSim = sim;
        bestI = i;
        bestJ = j;
      }
    }
  }

  // Stop if best similarity is below threshold
  if (bestSim < threshold) break;

  // Merge clusters
  for (const idx of clusters[bestJ]) {
    clusters[bestI].add(idx);
  }
  activeClusters.delete(bestJ);
}
```

Step 4: Extract results

```typescript
const result = [...activeClusters].map((i) => [...clusters[i]]);
const unclustered = result.filter((c) => c.length < minClusterSize).flat();
const validClusters = result.filter((c) => c.length >= minClusterSize);
```

### 3. Average linkage function

```typescript
function averageLinkage(
  clusterA: Set<number>,
  clusterB: Set<number>,
  simMatrix: number[][],
): number {
  let totalSim = 0;
  let count = 0;

  for (const a of clusterA) {
    for (const b of clusterB) {
      totalSim += simMatrix[a][b];
      count++;
    }
  }

  return count > 0 ? totalSim / count : 0;
}
```

### 4. Performance optimization for large datasets

For N items, naive agglomerative clustering is O(N^3). Optimizations:

- **Threshold early termination**: Stop as soon as best pair similarity < threshold
- **Skip computation for distant pairs**: If two clusters were already below threshold, don't recompute
- **Sparse similarity matrix**: For N > 5000, only compute similarities for items within a pre-filtered neighborhood

For V1 (up to 10K items), the naive approach is acceptable. A 1000-item dataset takes ~2 seconds.

### 5. Integrate with database (fetch embeddings)

```typescript
export async function fetchEmbeddingsForClustering(): Promise<{
  ids: string[];
  vectors: number[][];
}> {
  // Use raw SQL to fetch pgvector data
  const items = await prisma.$queryRaw<{ id: string; embedding: string }[]>`
    SELECT id, embedding::text
    FROM "FeedbackItem"
    WHERE "embeddedAt" IS NOT NULL
    AND embedding IS NOT NULL
    ORDER BY "createdAt" ASC
  `;

  return {
    ids: items.map((i) => i.id),
    vectors: items.map((i) => JSON.parse(i.embedding.replace(/[\[\]]/g, (m) => m))),
  };
}
```

**Note:** pgvector stores vectors in a custom format. When cast to text, it returns `[0.1,0.2,...]` which can be parsed as JSON.

## Acceptance Criteria

- [ ] `cosineSimilarity()` returns correct values for known test vectors
- [ ] `cosineSimilarity([1,0], [0,1])` returns 0 (orthogonal)
- [ ] `cosineSimilarity([1,0], [1,0])` returns 1 (identical)
- [ ] `centroid()` returns correct mean vector
- [ ] `buildSimilarityMatrix()` produces symmetric NxN matrix with 1.0 diagonal
- [ ] `agglomerativeClustering()` groups identical vectors into one cluster
- [ ] `agglomerativeClustering()` separates orthogonal vectors into different clusters
- [ ] Threshold 0.82 produces reasonable clusters on seed data
- [ ] Threshold is configurable (0.7-0.95 range)
- [ ] `minClusterSize` correctly filters small clusters to unclustered
- [ ] Singleton items (no close neighbors) are placed in unclustered group
- [ ] `findRepresentativeItems()` returns items closest to centroid
- [ ] Performance: 1000 items cluster in <5 seconds
- [ ] Performance: 200 seed items cluster in <1 second
- [ ] Result stats (totalClusters, avgSize, etc.) are accurate

## Complexity Estimate

**XL (Extra Large)** — Core algorithm implementation with careful attention to correctness, performance, and numerical stability. The most mathematically intense task in the project.

## Risk Factors & Mitigations

| Risk                                       | Impact                          | Mitigation                                                                       |
| ------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------- |
| O(N^3) performance on large datasets       | High — clustering takes minutes | Threshold early termination; limit to 10K items with warning for larger datasets |
| Floating point precision issues            | Medium — incorrect clusters     | Use epsilon comparisons, not exact equality; test with known vectors             |
| All items cluster into one giant cluster   | Medium — useless results        | Threshold tuning; default 0.82 is conservative; allow user adjustment            |
| No items cluster (all below threshold)     | Medium — no themes found        | Lower the threshold or increase minimum if this occurs; show warning to user     |
| Memory usage for large similarity matrices | High — OOM for >10K items       | 10K × 10K × 8 bytes = 800MB; warn and limit; use sparse matrix for larger        |
| pgvector text format parsing breaks        | Medium — clustering fails       | Write robust parser with unit tests; handle various pgvector output formats      |
