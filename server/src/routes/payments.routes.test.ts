import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockEmployeeFindMany = vi.fn();
const mockPaymentOrderCreate = vi.fn();
const mockPayrollEntryFindMany = vi.fn();
const mockGetPaymentValidationForCycle = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    employee: { findMany: (...args: unknown[]) => mockEmployeeFindMany(...args) },
    paymentOrder: { create: (...args: unknown[]) => mockPaymentOrderCreate(...args) },
    payrollEntry: { findMany: (...args: unknown[]) => mockPayrollEntryFindMany(...args) },
  },
}));

vi.mock('../lib/comptaBridge.js', () => ({
  getPaymentValidationForCycle: (...args: unknown[]) => mockGetPaymentValidationForCycle(...args),
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

describe('POST /api/payments/orders/mobile-money — cross-check du montant', () => {
  beforeEach(() => {
    mockEmployeeFindMany.mockReset();
    mockPaymentOrderCreate.mockReset();
    mockPayrollEntryFindMany.mockReset();
    mockGetPaymentValidationForCycle.mockReset();
    mockGetPaymentValidationForCycle.mockResolvedValue({ validated: true });
    mockEmployeeFindMany.mockResolvedValue([{ id: 'emp1', mobileMoneyOperator: 'orange', mobileMoneyNumber: '+22670000000' }]);
  });

  const hrToken = signToken({ id: 'u1', email: 'hr@b.com', role: 'hr_manager', companyId: 'c1' });

  // Rien ne garantissait que le montant soumis correspondait au salaire net
  // réellement calculé pour cet employé sur ce cycle — un hr_manager pouvait
  // soumettre un montant erroné ou gonflé, en comptant sur la seule
  // vigilance visuelle du comptable (voir audit sécurité, M3).
  it("rejette un montant qui ne correspond pas au salaire net du bulletin", async () => {
    mockPayrollEntryFindMany.mockResolvedValueOnce([{ employeeId: 'emp1', salaireNet: 174_000 }]);

    const res = await request(app)
      .post('/api/payments/orders/mobile-money')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc1', items: [{ employeeId: 'emp1', amount: 999_000 }] });

    expect(res.status).toBe(400);
    expect(mockPaymentOrderCreate).not.toHaveBeenCalled();
  });

  it('accepte un montant qui correspond exactement au salaire net du bulletin', async () => {
    mockPayrollEntryFindMany.mockResolvedValueOnce([{ employeeId: 'emp1', salaireNet: 174_000 }]);
    mockPaymentOrderCreate.mockResolvedValueOnce({
      id: 'order1', cycleId: 'cyc1', createdAt: new Date(), createdBy: 'hr@b.com',
      status: 'en_attente', type: 'mobile_money', totalAmount: 174_000, transactions: [],
    });

    const res = await request(app)
      .post('/api/payments/orders/mobile-money')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc1', items: [{ employeeId: 'emp1', amount: 174_000 }] });

    expect(res.status).toBe(201);
    expect(mockPaymentOrderCreate).toHaveBeenCalledTimes(1);
  });

  it("rejette si aucun bulletin de paie n'existe pour cet employé sur ce cycle", async () => {
    mockPayrollEntryFindMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/payments/orders/mobile-money')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ cycleId: 'cyc1', items: [{ employeeId: 'emp1', amount: 174_000 }] });

    expect(res.status).toBe(400);
    expect(mockPaymentOrderCreate).not.toHaveBeenCalled();
  });
});
