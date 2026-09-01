import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockEmployeeFindFirstOrThrow = vi.fn();
const mockLegalSettingsFindFirst = vi.fn();
const mockPayrollConfigFindUnique = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    salaryAdvance: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    employee: { findFirstOrThrow: (...args: unknown[]) => mockEmployeeFindFirstOrThrow(...args) },
    legalSettings: { findFirst: (...args: unknown[]) => mockLegalSettingsFindFirst(...args) },
    payrollConfig: { findUnique: (...args: unknown[]) => mockPayrollConfigFindUnique(...args) },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

const legalSettings = {
  id: 'ls1',
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('POST /api/advances', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockEmployeeFindFirstOrThrow.mockReset();
    mockLegalSettingsFindFirst.mockReset();
    mockPayrollConfigFindUnique.mockReset();
  });

  const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });

  it('rejette une demande sans employeeId lié', async () => {
    const noEmployeeToken = signToken({ id: 'u2', email: 'x@y.com', role: 'employee', companyId: 'c1' });
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${noEmployeeToken}`).send({ amount: 10_000 });
    expect(res.status).toBe(403);
  });

  it('rejette si une avance active existe déjà', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'existing' });
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 10_000 });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejette un montant qui dépasse le plafond', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockEmployeeFindFirstOrThrow.mockResolvedValueOnce({ id: 'e1', baseSalary: 100_000 });
    mockLegalSettingsFindFirst.mockResolvedValueOnce(legalSettings);
    mockPayrollConfigFindUnique.mockResolvedValueOnce({ maxAdvancePercent: 30 });
    // salaireNet = 100000 - 5500 = 94500, plafond 30% = 28350
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 50_000 });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('crée une avance en_attente quand la demande respecte le plafond', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockEmployeeFindFirstOrThrow.mockResolvedValueOnce({ id: 'e1', baseSalary: 100_000 });
    mockLegalSettingsFindFirst.mockResolvedValueOnce(legalSettings);
    mockPayrollConfigFindUnique.mockResolvedValueOnce({ maxAdvancePercent: 30 });
    mockCreate.mockResolvedValueOnce({
      id: 'adv1', employeeId: 'e1', amount: 20_000, remainingBalance: 20_000,
      channel: 'portail', status: 'en_attente', requestedAt: new Date(),
    });

    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 20_000 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('en_attente');
    expect(mockCreate).toHaveBeenCalledWith({
      data: { companyId: 'c1', employeeId: 'e1', amount: 20_000, remainingBalance: 20_000, channel: 'portail', status: 'en_attente' },
    });
  });

  it('convertit une violation de contrainte unique (P2002) en 400 — course entre deux requêtes concurrentes', async () => {
    // findFirst ne voit rien (fast-path passé) mais create échoue quand même :
    // simule deux requêtes concurrentes qui passent toutes les deux le check
    // applicatif avant que la première n'ait committé — c'est l'index unique
    // partiel en base (voir schema.prisma) qui tranche, pas le findFirst.
    mockFindFirst.mockResolvedValueOnce(null);
    mockEmployeeFindFirstOrThrow.mockResolvedValueOnce({ id: 'e1', baseSalary: 100_000 });
    mockLegalSettingsFindFirst.mockResolvedValueOnce(legalSettings);
    mockPayrollConfigFindUnique.mockResolvedValueOnce({ maxAdvancePercent: 30 });
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`employeeId`)', {
        code: 'P2002',
        clientVersion: '6.19.3',
      })
    );

    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 20_000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/déjà une avance en cours/);
  });
});

describe('POST /api/advances/:id/approve', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  const hrToken = signToken({ id: 'u3', email: 'hr@b.com', role: 'hr_manager', companyId: 'c1', employeeId: 'e2' });

  it("refuse d'approuver une avance qui n'est pas en_attente", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'adv1', status: 'approuve' });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${hrToken}`).send({ approvedBy: 'hr@b.com' });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('approuve une avance en_attente', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'adv1', status: 'en_attente' });
    mockUpdate.mockResolvedValueOnce({
      id: 'adv1', status: 'approuve', requestedAt: new Date(), approvedAt: new Date(), approvedBy: 'hr@b.com',
    });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${hrToken}`).send({ approvedBy: 'hr@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approuve');
  });

  it('refuse un employé simple (sans advances:approve)', async () => {
    const employeeToken = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${employeeToken}`).send({ approvedBy: 'a@b.com' });
    expect(res.status).toBe(403);
  });
});
