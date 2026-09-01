import { beforeEach, describe, it, expect, vi } from 'vitest';
import { computeMaxAdvanceAmount } from './salaryAdvances.js';

const legalSettings = {
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('computeMaxAdvanceAmount', () => {
  it('calcule le plafond comme un pourcentage du salaire net estimé', () => {
    // baseSalary 200000, cnss 5.5% = 11000, salaireNet = 200000 - 11000 = 189000
    // plafond 30% = 56700
    const result = computeMaxAdvanceAmount(200_000, legalSettings, 30);
    expect(result).toBe(56_700);
  });

  it('arrondit vers le bas', () => {
    const result = computeMaxAdvanceAmount(100_000, legalSettings, 33);
    // salaireNet = 100000 - 5500 = 94500, 33% = 31185
    expect(result).toBe(31_185);
    expect(Number.isInteger(result)).toBe(true);
  });
});

const mockFindUnique = vi.fn();
const mockDeductionFindFirst = vi.fn();
const mockDeductionCreate = vi.fn();
const mockAdvanceUpdate = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

vi.mock('./prisma.js', () => ({
  prisma: {
    salaryAdvance: { findUnique: (...args: unknown[]) => mockFindUnique(...args), update: (...args: unknown[]) => mockAdvanceUpdate(...args) },
    advanceDeduction: { findFirst: (...args: unknown[]) => mockDeductionFindFirst(...args), create: (...args: unknown[]) => mockDeductionCreate(...args) },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

const { applyAdvanceDeductionsForCycle } = await import('./salaryAdvances.js');

function fakeEntry(id: string, avances: unknown[]) {
  return { id, avances } as unknown as import('@prisma/client').PayrollEntry;
}

describe('applyAdvanceDeductionsForCycle', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockDeductionFindFirst.mockReset();
    mockDeductionCreate.mockReset();
    mockAdvanceUpdate.mockReset();
    mockTransaction.mockClear();
  });

  it("ignore les lignes qui ne sont pas de type 'avance'", async () => {
    const entry = fakeEntry('e1', [{ id: 'p1', label: 'Prime', amount: 5000, type: 'prime' }]);
    await applyAdvanceDeductionsForCycle([entry]);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('déduit et solde une avance quand le montant couvre tout le restant', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeductionCreate).toHaveBeenCalledWith({ data: { advanceId: 'adv1', payrollEntryId: 'e1', amount: 20_000 } });
    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 0, status: 'rembourse' } });
  });

  it('laisse le statut en_remboursement quand le solde n\'est pas épuisé', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 12_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 8_000, status: 'en_remboursement' } });
  });

  it('est idempotent : ne redéduit pas si une AdvanceDeduction existe déjà pour ce couple', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue({ id: 'already' });
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('ignore une ligne "avance" dont l\'id ne correspond à aucune SalaryAdvance', async () => {
    mockFindUnique.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'deleted-adv', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
