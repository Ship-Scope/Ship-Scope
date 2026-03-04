import { describe, it, expect, beforeEach } from 'vitest';
import { tokenTracker } from '../../src/lib/token-tracker';

describe('TokenTracker', () => {
  beforeEach(() => {
    tokenTracker.reset();
  });

  it('starts with zero stats', () => {
    const stats = tokenTracker.getSessionStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalCost).toBe(0);
  });

  it('tracks a chat completion call', () => {
    tokenTracker.track('gpt-4o-mini', 'chat', {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });

    const stats = tokenTracker.getSessionStats();
    expect(stats.totalCalls).toBe(1);
    expect(stats.totalPromptTokens).toBe(1000);
    expect(stats.totalCompletionTokens).toBe(500);
    expect(stats.totalTokens).toBe(1500);
    // gpt-4o-mini: $0.15/1M input + $0.60/1M output
    // (1000/1M) * 0.15 + (500/1M) * 0.60 = 0.00015 + 0.0003 = 0.00045
    expect(stats.totalCost).toBeCloseTo(0.00045, 6);
  });

  it('tracks an embedding call', () => {
    tokenTracker.track('text-embedding-3-small', 'embedding', {
      promptTokens: 5000,
      completionTokens: 0,
      totalTokens: 5000,
    });

    const stats = tokenTracker.getSessionStats();
    expect(stats.totalCalls).toBe(1);
    // text-embedding-3-small: $0.02/1M input
    expect(stats.totalCost).toBeCloseTo((5000 / 1_000_000) * 0.02, 8);
  });

  it('accumulates multiple calls', () => {
    tokenTracker.track('gpt-4o-mini', 'chat', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    tokenTracker.track('gpt-4o-mini', 'chat', {
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
    });

    const stats = tokenTracker.getSessionStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.totalPromptTokens).toBe(300);
    expect(stats.totalCompletionTokens).toBe(150);
  });

  it('groups stats by model', () => {
    tokenTracker.track('gpt-4o-mini', 'chat', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    tokenTracker.track('text-embedding-3-small', 'embedding', {
      promptTokens: 1000,
      completionTokens: 0,
      totalTokens: 1000,
    });

    const stats = tokenTracker.getSessionStats();
    expect(stats.byModel['gpt-4o-mini'].calls).toBe(1);
    expect(stats.byModel['text-embedding-3-small'].calls).toBe(1);
  });

  it('uses zero cost for unknown models', () => {
    const entry = tokenTracker.track('unknown-model', 'chat', {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });
    expect(entry.cost).toBe(0);
  });

  it('reset clears all data', () => {
    tokenTracker.track('gpt-4o-mini', 'chat', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    tokenTracker.reset();

    const stats = tokenTracker.getSessionStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.totalCost).toBe(0);
  });
});
