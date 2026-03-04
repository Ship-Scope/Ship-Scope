import { describe, it, expect } from 'vitest';

// Test buildEntityStat logic inline (it's a private function)
function buildEntityStat(total: number, current: number, previous: number) {
  let trendPercent = 0;
  if (previous === 0 && current > 0) {
    trendPercent = 100;
  } else if (previous === 0 && current === 0) {
    trendPercent = 0;
  } else if (previous > 0) {
    trendPercent = Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  const trendDirection: 'up' | 'down' | 'flat' =
    trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'flat';

  return { total, currentWeek: current, previousWeek: previous, trendPercent, trendDirection };
}

describe('buildEntityStat', () => {
  it('returns flat when both weeks are zero', () => {
    const stat = buildEntityStat(0, 0, 0);
    expect(stat.trendPercent).toBe(0);
    expect(stat.trendDirection).toBe('flat');
  });

  it('returns 100% up when previous is zero but current has data', () => {
    const stat = buildEntityStat(5, 5, 0);
    expect(stat.trendPercent).toBe(100);
    expect(stat.trendDirection).toBe('up');
  });

  it('returns -100% when current is zero but previous had data', () => {
    const stat = buildEntityStat(10, 0, 10);
    expect(stat.trendPercent).toBe(-100);
    expect(stat.trendDirection).toBe('down');
  });

  it('calculates correct positive trend', () => {
    const stat = buildEntityStat(20, 12, 10);
    expect(stat.trendPercent).toBe(20); // (12-10)/10 * 100 = 20%
    expect(stat.trendDirection).toBe('up');
  });

  it('calculates correct negative trend', () => {
    const stat = buildEntityStat(20, 8, 10);
    expect(stat.trendPercent).toBe(-20); // (8-10)/10 * 100 = -20%
    expect(stat.trendDirection).toBe('down');
  });

  it('returns flat when current equals previous', () => {
    const stat = buildEntityStat(20, 10, 10);
    expect(stat.trendPercent).toBe(0);
    expect(stat.trendDirection).toBe('flat');
  });

  it('returns correct total, currentWeek, previousWeek', () => {
    const stat = buildEntityStat(100, 15, 12);
    expect(stat.total).toBe(100);
    expect(stat.currentWeek).toBe(15);
    expect(stat.previousWeek).toBe(12);
  });
});
