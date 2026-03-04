import { describe, it, expect } from 'vitest';
import { calculateRICE } from '../../src/services/proposal.service';

describe('calculateRICE', () => {
  it('calculates RICE score correctly', () => {
    // (5 * 5 * 5) / 5 = 25
    expect(calculateRICE(5, 5, 5, 5)).toBe(25);
  });

  it('returns high score for high reach/impact/confidence and low effort', () => {
    // (10 * 10 * 10) / 1 = 1000
    expect(calculateRICE(10, 10, 10, 1)).toBe(1000);
  });

  it('returns low score for low values and high effort', () => {
    // (1 * 1 * 1) / 10 = 0.1
    expect(calculateRICE(1, 1, 1, 10)).toBeCloseTo(0.1);
  });

  it('handles asymmetric scores', () => {
    // (8 * 6 * 7) / 3 = 112
    expect(calculateRICE(8, 6, 7, 3)).toBeCloseTo(112);
  });

  it('throws when effort is zero', () => {
    expect(() => calculateRICE(5, 5, 5, 0)).toThrow('Effort score cannot be zero');
  });

  it('returns a float for non-integer results', () => {
    // (7 * 8 * 6) / 4 = 84
    expect(calculateRICE(7, 8, 6, 4)).toBe(84);
    // (3 * 7 * 5) / 4 = 26.25
    expect(calculateRICE(3, 7, 5, 4)).toBeCloseTo(26.25);
  });
});
