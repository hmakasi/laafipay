import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    payrollConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

describe('GET/PUT /api/companies/payroll-config — maxAdvancePercent', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
  });

  const adminToken = signToken({ id: 'u1', email: 'admin@b.com', role: 'admin', companyId: 'c1' });

  it("GET renvoie 30 par défaut quand aucune config n'existe encore", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/companies/payroll-config').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.maxAdvancePercent).toBe(30);
  });

  it('PUT avec maxAdvancePercent le persiste et GET le renvoie ensuite', async () => {
    mockUpsert.mockResolvedValueOnce({
      activeRubrics: ['base'],
      customRubrics: [],
      maxAdvancePercent: 20,
    });

    const putRes = await request(app)
      .put('/api/companies/payroll-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activeRubrics: ['base'], customRubrics: [], maxAdvancePercent: 20 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.maxAdvancePercent).toBe(20);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      create: { companyId: 'c1', activeRubrics: ['base'], customRubrics: [], maxAdvancePercent: 20 },
      update: { activeRubrics: ['base'], customRubrics: [], maxAdvancePercent: 20 },
    });

    // GET reflète ensuite la valeur stockée (simulée ici via le mock findUnique).
    mockFindUnique.mockResolvedValueOnce({
      activeRubrics: ['base'],
      customRubrics: [],
      maxAdvancePercent: 20,
    });
    const getRes = await request(app).get('/api/companies/payroll-config').set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.maxAdvancePercent).toBe(20);
  });

  it("PUT sans maxAdvancePercent n'écrase pas la valeur existante en base", async () => {
    mockUpsert.mockResolvedValueOnce({
      activeRubrics: ['base'],
      customRubrics: [],
      maxAdvancePercent: 20, // valeur déjà en base, non touchée par cet appel
    });

    const res = await request(app)
      .put('/api/companies/payroll-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activeRubrics: ['base'], customRubrics: [] });

    expect(res.status).toBe(200);
    // La clé maxAdvancePercent ne doit pas apparaître dans les payloads envoyés à Prisma
    // quand l'appelant ne l'a pas fournie — sinon on écraserait la valeur existante par le défaut.
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create).not.toHaveProperty('maxAdvancePercent');
    expect(call.update).not.toHaveProperty('maxAdvancePercent');
  });
});
