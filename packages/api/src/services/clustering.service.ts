import { cosineSimilarity } from '../lib/vector-math';

export interface ClusterItem {
  id: string;
  embedding: number[];
}

export interface Cluster {
  id: number;
  itemIds: string[];
  centroid: number[];
}

interface MergeCandidate {
  i: number;
  j: number;
  similarity: number;
}

/**
 * Agglomerative hierarchical clustering with average linkage.
 *
 * Each item starts in its own cluster. At each step, the two most similar
 * clusters are merged until no pair exceeds the similarity threshold.
 *
 * @param items - Items with embeddings to cluster
 * @param threshold - Minimum average cosine similarity to merge (default 0.82)
 * @param minClusterSize - Minimum items to form a valid cluster (default 2)
 * @returns Array of clusters meeting the minimum size
 */
export function agglomerativeCluster(
  items: ClusterItem[],
  threshold = 0.82,
  minClusterSize = 2,
): Cluster[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return minClusterSize <= 1
      ? [{ id: 0, itemIds: [items[0].id], centroid: items[0].embedding }]
      : [];
  }

  // Initialize: each item is its own cluster
  const clusters: { itemIds: string[]; embeddings: number[][] }[] = items.map((item) => ({
    itemIds: [item.id],
    embeddings: [item.embedding],
  }));

  // Pre-compute pairwise similarity cache for average linkage
  // We'll recompute inter-cluster similarity on merge
  while (clusters.length > 1) {
    const best = findBestMerge(clusters);
    if (!best || best.similarity < threshold) break;

    // Merge cluster j into cluster i
    const merged = {
      itemIds: [...clusters[best.i].itemIds, ...clusters[best.j].itemIds],
      embeddings: [...clusters[best.i].embeddings, ...clusters[best.j].embeddings],
    };

    // Remove j first (higher index), then replace i
    clusters.splice(best.j, 1);
    clusters[best.i] = merged;
  }

  // Compute centroids and filter by min size
  return clusters
    .filter((c) => c.itemIds.length >= minClusterSize)
    .map((c, idx) => ({
      id: idx,
      itemIds: c.itemIds,
      centroid: computeCentroidFromEmbeddings(c.embeddings),
    }));
}

/** Find the pair of clusters with highest average linkage similarity. */
function findBestMerge(
  clusters: { itemIds: string[]; embeddings: number[][] }[],
): MergeCandidate | null {
  let best: MergeCandidate | null = null;

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const sim = averageLinkage(clusters[i].embeddings, clusters[j].embeddings);
      if (!best || sim > best.similarity) {
        best = { i, j, similarity: sim };
      }
    }
  }

  return best;
}

/** Average linkage: mean of all pairwise similarities between two clusters. */
function averageLinkage(a: number[][], b: number[][]): number {
  let sum = 0;
  let count = 0;

  for (const va of a) {
    for (const vb of b) {
      sum += cosineSimilarity(va, vb);
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/** Compute centroid from a list of embeddings. */
function computeCentroidFromEmbeddings(embeddings: number[][]): number[] {
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}
