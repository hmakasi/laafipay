import { describe, it, expect } from 'vitest';
import { parseFrenchDate, computeLeaveDaysCount } from './leaveDates.js';

describe('parseFrenchDate', () => {
  it('parses a valid DD/MM/YYYY date', () => {
    const date = parseFrenchDate('10/08/2026');
    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(2026);
    expect(date?.getUTCMonth()).toBe(7);
    expect(date?.getUTCDate()).toBe(10);
  });

  it('rejects a malformed string', () => {
    expect(parseFrenchDate('2026-08-10')).toBeNull();
    expect(parseFrenchDate('not a date')).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    expect(parseFrenchDate('31/02/2026')).toBeNull();
  });
});

describe('computeLeaveDaysCount', () => {
  it('matches the existing portal formula for the spec example (10/08 to 21/08/2026)', () => {
    const start = parseFrenchDate('10/08/2026')!;
    const end = parseFrenchDate('21/08/2026')!;
    expect(computeLeaveDaysCount(start, end)).toBe(12);
  });

  it('counts a single day as 1', () => {
    const start = parseFrenchDate('10/08/2026')!;
    expect(computeLeaveDaysCount(start, start)).toBe(1);
  });
});
