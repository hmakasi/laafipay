import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockLegalSettingsFindUnique = vi.fn();
const mockEmployeeFindMany = vi.fn();
const mockEntryFindMany = vi.fn();
const mockPayrollConfigFindUnique = vi.fn();
const mockAdvanceFindMany = vi.fn();
const mockEntryCreateMany = vi.fn();
const mockCycleFindFirst = vi.fn();
const mockCycleFindUniqueOrThrow = vi.fn();
const mockEntryUpdateMany = vi.fn();
const mockCycleUpdate = vi.fn();
const mockAdvanceFindUnique = vi.fn();
const mockDeductionFindFirst = vi.fn();
const mockDeductionCreate = vi.fn();
const mockAdvanceUpdate = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    legalSettings: { findUniqueOrThrow: (...a: unknown[]) => mockLegalSettingsFindUnique(...a) },
    employee: { findMany: (...a: unknown[]) => mockEmployeeFindMany(...a) },
    payrollEntry: {
      findMany: (...a: unknown[]) => mockEntryFindMany(...a),
      createMany: (...a: unknown[]) => mockEntryCreateMany(...a),
      updateMany: (...a: unknown[]) => mockEntryUpdateMany(...a),
    },
    payrollConfig: { findUnique: (...a: unknown[]) => mockPayrollConfigFindUnique(...a) },
    salaryAdvance: {
      findMany: (...a: unknown[]) => mockAdvanceFindMany(...a),
      findUnique: (...a: unknown[]) => mockAdvanceFindUnique(...a),
      update: (...a: unknown[]) => mockAdvanceUpdate(...a),
    },
    advanceDeduction: {
      findFirst: (...a: unknown[]) => mockDeductionFindFirst(...a),
      create: (...a: unknown[]) => mockDeductionCreate(...a),
    },
    payrollCycle: {
      findFirst: (...a: unknown[]) => mockCycleFindFirst(...a),
      findUniqueOrThrow: (...a: unknown[]) => mockCycleFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => mockCycleUpdate(...a),
    },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

vi.mock('./payslips.routes.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./payslips.routes.js')>();
  return { ...actual, generatePayslipsForCycle: vi.fn() };
});
vi.mock('../lib/comptaBridge.js', () => ({ dispatchComptaEvent: vi.fn() }));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

const legalSettings = {
  id: 'ls1', cnssEmployeeRate: 5.5, cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('Intégration avances ↔ cycle de paie', () => {
  beforeEach(() => {
    [
      mockLegalSettingsFindUnique, mockEmployeeFindMany, mockEntryFindMany, mockPayrollConfigFindUnique,
      mockAdvanceFindMany, mockEntryCreateMany, mockCycleFindFirst, mockCycleFindUniqueOrThrow,
      mockEntryUpdateMany, mockCycleUpdate, mockAdvanceFindUnique, mockDeductionFindFirst,
      mockDeductionCreate, mockAdvanceUpdate,
    ].forEach((m) => m.mockReset());
    mockTransaction.mockClear();
  });

  const hrToken = signToken({ id: 'u1', email: 'hr@b.com', role: 'hr_manager', companyId: 'c1', employeeId: 'e2' });

  it('pré-remplit la ligne avances à la génération du cycle pour un employé avec solde restant', async () => {
    mockCycleFindFirst.mockResolvedValueOnce({ id: 'cyc1', companyId: 'c1', legalSettingsId: 'ls1' });
    mockLegalSettingsFindUnique.mockResolvedValueOnce(legalSettings);
    mockEmployeeFindMany.mockResolvedValueOnce([{ id: 'emp1', baseSalary: 200_000 }]);
    mockEntryFindMany.mockResolvedValueOnce([]);
    mockPayrollConfigFindUnique.mockResolvedValueOnce(null);
    mockAdvanceFindMany.mockResolvedValueOnce([{ id: 'adv1', employeeId: 'emp1', remainingBalance: 15_000 }]);
    // Re-fetch après syncEntries (GET /cycles/:id) — contenu sans importance
    // pour ce test (on n'asserte que sur l'appel à createMany ci-dessous),
    // juste assez complet pour que toPayrollCycleDTO ne plante pas.
    mockCycleFindUniqueOrThrow.mockResolvedValueOnce({
      id: 'cyc1', period: '2026-09', month: 9, year: 2026, status: 'brouillon',
      createdAt: new Date(), validatedAt: null, validatedBy: null, entries: [],
    });

    const res = await request(app).get('/api/payroll/cycles/cyc1').set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(mockEntryCreateMany).toHaveBeenCalledTimes(1);
    const data = mockEntryCreateMany.mock.calls[0][0].data;
    expect(data[0].avances).toEqual([{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' }]);
  });

  it('applique le décompte automatique à la validation du cycle', async () => {
    mockCycleFindFirst.mockResolvedValueOnce({ id: 'cyc1', companyId: 'c1', legalSettingsId: 'ls1' });
    mockLegalSettingsFindUnique.mockResolvedValueOnce(legalSettings);
    mockEmployeeFindMany.mockResolvedValueOnce([]);
    mockEntryFindMany.mockResolvedValueOnce([{ employeeId: 'emp1' }]);
    mockPayrollConfigFindUnique.mockResolvedValueOnce(null);
    mockAdvanceFindMany.mockResolvedValueOnce([]);
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 1 });
    // Objet complet requis par toPayrollCycleDTO/toPayrollEntryDTO (appelés
    // sur la valeur de retour de payrollCycle.update pour construire la
    // réponse JSON) — un objet partiel ferait planter res.json(...).
    const entryWithAdvance = {
      id: 'entry1', employeeId: 'emp1', cycleId: 'cyc1',
      baseSalary: 200_000, overtimeHours: 0, overtimeAmount: 0,
      primes: [], indemnites: [], avances: [{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' }], retenues: [],
      absenceDays: 0, absenceAmount: 0,
      salaireBrut: 200_000, cnssEmployee: 11_000, cnssEmployer: 32_000, iuts: 0,
      salaireNet: 174_000, coutEmployeur: 232_000, status: 'valide',
    };
    mockCycleUpdate.mockResolvedValueOnce({
      id: 'cyc1', period: '2026-09', month: 9, year: 2026, status: 'valide',
      createdAt: new Date(), validatedAt: new Date(), validatedBy: 'hr@b.com',
      entries: [entryWithAdvance],
    });
    mockAdvanceFindUnique.mockResolvedValueOnce({ id: 'adv1', remainingBalance: 15_000 });
    mockDeductionFindFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/payroll/cycles/cyc1/validate')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ validatedBy: 'hr@b.com' });

    expect(res.status).toBe(200);
    expect(mockDeductionCreate).toHaveBeenCalledWith({ data: { advanceId: 'adv1', payrollEntryId: 'entry1', amount: 15_000 } });
    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 0, status: 'rembourse' } });
  });
});
