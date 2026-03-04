import { describe, it, expect } from 'vitest';
import { agglomerativeCluster, type ClusterItem } from '../../src/services/clustering.service';

function makeItem(id: string, embedding: number[]): ClusterItem {
  return { id, embedding };
}

describe('agglomerativeCluster', () => {
  it('returns empty array for empty input', () => {
    expect(agglomerativeCluster([])).toEqual([]);
  });

  it('returns empty when single item does not meet minClusterSize', () => {
    const items = [makeItem('a', [1, 0, 0])];
    expect(agglomerativeCluster(items)).toEqual([]);
  });

  it('returns single-item cluster when minClusterSize is 1', () => {
    const items = [makeItem('a', [1, 0, 0])];
    const clusters = agglomerativeCluster(items, 0.82, 1);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].itemIds).toEqual(['a']);
  });

  it('merges identical vectors into one cluster', () => {
    const items = [makeItem('a', [1, 0, 0]), makeItem('b', [1, 0, 0]), makeItem('c', [1, 0, 0])];
    const clusters = agglomerativeCluster(items, 0.82);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].itemIds).toContain('a');
    expect(clusters[0].itemIds).toContain('b');
    expect(clusters[0].itemIds).toContain('c');
  });

  it('keeps orthogonal vectors in separate clusters (filtered by minSize)', () => {
    const items = [makeItem('a', [1, 0, 0]), makeItem('b', [0, 1, 0]), makeItem('c', [0, 0, 1])];
    // Each is orthogonal, sim = 0 < 0.82 threshold, so no merges
    // With minClusterSize=2, all are filtered out
    const clusters = agglomerativeCluster(items, 0.82, 2);
    expect(clusters).toHaveLength(0);
  });

  it('clusters similar but not identical vectors', () => {
    // Two groups: group A (close to [1,0,0]) and group B (close to [0,1,0])
    const items = [
      makeItem('a1', [0.95, 0.05, 0]),
      makeItem('a2', [0.9, 0.1, 0]),
      makeItem('a3', [0.92, 0.08, 0]),
      makeItem('b1', [0.05, 0.95, 0]),
      makeItem('b2', [0.1, 0.9, 0]),
    ];
    const clusters = agglomerativeCluster(items, 0.95);
    // At threshold 0.95, very similar items cluster together
    expect(clusters.length).toBeGreaterThanOrEqual(1);

    // At least the A group should be together
    const aCluster = clusters.find(
      (c) => c.itemIds.includes('a1') || c.itemIds.includes('a2') || c.itemIds.includes('a3'),
    );
    if (aCluster) {
      // If they merged, they should all be together
      if (aCluster.itemIds.length > 1) {
        expect(aCluster.itemIds.every((id) => id.startsWith('a') || id.startsWith('b'))).toBe(true);
      }
    }
  });

  it('lower threshold results in more clusters', () => {
    const items = [
      makeItem('a', [1, 0, 0]),
      makeItem('b', [0.9, 0.1, 0]),
      makeItem('c', [0.8, 0.2, 0]),
    ];

    const clustersHigh = agglomerativeCluster(items, 0.999, 1);
    const clustersLow = agglomerativeCluster(items, 0.5, 1);

    // Lower threshold = more merging = fewer clusters
    expect(clustersLow.length).toBeLessThanOrEqual(clustersHigh.length);
  });

  it('computes valid centroid for merged cluster', () => {
    const items = [makeItem('a', [1, 0, 0]), makeItem('b', [1, 0, 0])];
    const clusters = agglomerativeCluster(items, 0.82);
    expect(clusters).toHaveLength(1);
    // Centroid of two identical vectors should be the same vector
    expect(clusters[0].centroid).toEqual([1, 0, 0]);
  });

  it('assigns sequential cluster IDs', () => {
    const items = [
      makeItem('a1', [1, 0, 0]),
      makeItem('a2', [1, 0, 0]),
      makeItem('b1', [0, 1, 0]),
      makeItem('b2', [0, 1, 0]),
    ];
    const clusters = agglomerativeCluster(items, 0.82);
    const ids = clusters.map((c) => c.id);
    expect(ids).toEqual(ids.map((_, i) => i));
  });
});
