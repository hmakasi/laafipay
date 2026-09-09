import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockUserFindUnique = vi.fn();
const mockSignupRequestFindFirst = vi.fn();
const mockSignupRequestCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    signupRequest: {
      findFirst: (...args: unknown[]) => mockSignupRequestFindFirst(...args),
      create: (...args: unknown[]) => mockSignupRequestCreate(...args),
    },
  },
}));

const { default: app } = await import('../app.js');

const validPayload = {
  companyName: 'Acme SARL',
  countryCode: 'BF',
  currencyCode: 'XOF',
  employeeCount: 12,
  phone: '+22670000000',
  admin: { firstName: 'Awa', lastName: 'Traore', email: 'existe-deja@b.com' },
};

describe('POST /api/companies/signup — anti-énumération', () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockSignupRequestFindFirst.mockReset();
    mockSignupRequestCreate.mockReset();
    mockSignupRequestCreate.mockResolvedValue({});
  });

  // Une réponse différente (409) selon qu'un compte existe déjà pour cet
  // e-mail permettrait à un attaquant non authentifié d'énumérer tous les
  // e-mails admin enregistrés sur la plateforme (voir audit sécurité, H3).
  // Le conflit réel est géré en privé, côté admin, à l'approbation.
  it("répond 201 même quand un compte existe déjà pour cet e-mail (pas d'énumération)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'u1', email: 'existe-deja@b.com' });

    const res = await request(app).post('/api/companies/signup').send(validPayload);

    expect(res.status).toBe(201);
    expect(mockSignupRequestCreate).toHaveBeenCalledTimes(1);
  });

  it("répond 201 quand l'e-mail n'a encore aucun compte", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/companies/signup').send(validPayload);

    expect(res.status).toBe(201);
    expect(mockSignupRequestCreate).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/companies/signup — nombre de salariés et téléphone', () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserFindUnique.mockResolvedValue(null);
    mockSignupRequestFindFirst.mockReset();
    mockSignupRequestCreate.mockReset();
    mockSignupRequestCreate.mockResolvedValue({});
  });

  it('rejette la demande sans employeeCount', async () => {
    const { employeeCount, ...payload } = validPayload;
    const res = await request(app).post('/api/companies/signup').send(payload);
    expect(res.status).toBe(400);
    expect(mockSignupRequestCreate).not.toHaveBeenCalled();
  });

  it('rejette la demande sans phone', async () => {
    const { phone, ...payload } = validPayload;
    const res = await request(app).post('/api/companies/signup').send(payload);
    expect(res.status).toBe(400);
    expect(mockSignupRequestCreate).not.toHaveBeenCalled();
  });

  it('enregistre employeeCount et phone dans la demande créée', async () => {
    const res = await request(app).post('/api/companies/signup').send(validPayload);

    expect(res.status).toBe(201);
    expect(mockSignupRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ employeeCount: 12, phone: '+22670000000' }),
    });
  });
});
