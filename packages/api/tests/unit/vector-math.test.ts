import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  buildSimilarityMatrix,
  computeCentroid,
  normalize,
} from '../../src/lib/vector-math';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('handles high-dimensional vectors', () => {
    const dim = 1536;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
    const b = Array.from({ length: dim }, (_, i) => Math.sin(i + 0.1));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99);
    expect(sim).toBeLessThanOrEqual(1.0);
  });

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });
});

describe('buildSimilarityMatrix', () => {
  it('returns correct matrix for known vectors', () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
    ];
    const matrix = buildSimilarityMatrix(vectors);

    expect(matrix.length).toBe(3);
    expect(matrix[0][0]).toBeCloseTo(1.0);
    expect(matrix[0][1]).toBeCloseTo(0.0);
    expect(matrix[0][2]).toBeCloseTo(1.0);
    expect(matrix[1][0]).toBeCloseTo(0.0);
    expect(matrix[1][2]).toBeCloseTo(0.0);
  });

  it('produces symmetric matrix', () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const matrix = buildSimilarityMatrix(vectors);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 10);
      }
    }
  });

  it('returns empty for no vectors', () => {
    expect(buildSimilarityMatrix([])).toEqual([]);
  });
});

describe('computeCentroid', () => {
  it('computes mean of vectors', () => {
    const vectors = [
      [2, 4, 6],
      [4, 6, 8],
    ];
    const centroid = computeCentroid(vectors);
    expect(centroid).toEqual([3, 5, 7]);
  });

  it('returns the same vector for a single vector', () => {
    const vectors = [[1, 2, 3]];
    expect(computeCentroid(vectors)).toEqual([1, 2, 3]);
  });

  it('throws on empty input', () => {
    expect(() => computeCentroid([])).toThrow('empty set');
  });
});

describe('normalize', () => {
  it('normalizes to unit length', () => {
    const v = [3, 4];
    const n = normalize(v);
    expect(n[0]).toBeCloseTo(0.6, 5);
    expect(n[1]).toBeCloseTo(0.8, 5);
  });

  it('returns copy of zero vector', () => {
    const v = [0, 0, 0];
    const n = normalize(v);
    expect(n).toEqual([0, 0, 0]);
    expect(n).not.toBe(v); // different reference
  });
});
