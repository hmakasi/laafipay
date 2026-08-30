import { describe, it, expect } from 'vitest';
import { computeAncienneteAccrual } from './leaveAccrual.js';

describe('computeAncienneteAccrual', () => {
  it('grants 0 days before 5 years of service', () => {
    const hireDate = new Date('2023-01-01T00:00:00Z');
    const asOf = new Date('2026-06-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(0);
  });

  it('grants 1 day at exactly 5 years', () => {
    const hireDate = new Date('2020-01-01T00:00:00Z');
    const asOf = new Date('2025-01-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(1);
  });

  it('grants 2 days at 10 years, cumulative', () => {
    const hireDate = new Date('2015-01-01T00:00:00Z');
    const asOf = new Date('2025-01-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(2);
  });

  it('does not grant a partial tranche (4 years and 11 months)', () => {
    const hireDate = new Date('2020-01-01T00:00:00Z');
    const asOf = new Date('2024-12-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(0);
  });
});
