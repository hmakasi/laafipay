import { describe, it, expect } from 'vitest';
import { computeDefaultEntryForEmployee } from './payrollEngine.js';

const legalSettings = {
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('computeDefaultEntryForEmployee avec avances en cours', () => {
  it('sans avance en cours, avances reste vide (comportement existant inchangé)', () => {
    const result = computeDefaultEntryForEmployee(200_000, legalSettings);
    expect(result.avances).toEqual([]);
  });

  it('pré-remplit la ligne avances avec les avances en cours passées en paramètre', () => {
    const outstandingAdvances = [{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' as const }];
    const result = computeDefaultEntryForEmployee(200_000, legalSettings, undefined, outstandingAdvances);
    expect(result.avances).toEqual(outstandingAdvances);
    expect(result.salaireNet).toBe(200_000 - 11_000 - 15_000); // cnss 5.5% = 11000, iuts = 0
  });
});
