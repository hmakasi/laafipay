import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockSignupRequestFindMany = vi.fn();
const mockSignupRequestFindUnique = vi.fn();
const mockSignupRequestUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockCompanyCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    signupRequest: {
      findMany: (...args: unknown[]) => mockSignupRequestFindMany(...args),
      findUnique: (...args: unknown[]) => mockSignupRequestFindUnique(...args),
      update: (...args: unknown[]) => mockSignupRequestUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    company: {
      create: (...args: unknown[]) => mockCompanyCreate(...args),
    },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

// admin@entreprise.bf est dans PLATFORM_ADMIN_EMAILS (server/.env).
const platformAdminToken = signToken({ id: 'staff1', email: 'admin@entreprise.bf', role: 'admin', companyId: 'staffco' });

describe('GET /api/admin/signup-requests — infos avant validation', () => {
  beforeEach(() => {
    mockSignupRequestFindMany.mockReset();
  });

  it('inclut employeeCount et phone dans chaque demande', async () => {
    mockSignupRequestFindMany.mockResolvedValueOnce([
      {
        id: 'r1',
        companyName: 'Acme SARL',
        countryCode: 'BF',
        currencyCode: 'XOF',
        employeeCount: 12,
        phone: '+22670000000',
        firstName: 'Awa',
        lastName: 'Traore',
        email: 'awa@acme.bf',
        status: 'en_attente',
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      },
    ]);

    const res = await request(app).get('/api/admin/signup-requests').set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ employeeCount: 12, phone: '+22670000000' });
  });
});

describe('POST /api/admin/signup-requests/:id/approve — propagation du téléphone', () => {
  beforeEach(() => {
    mockSignupRequestFindUnique.mockReset();
    mockSignupRequestUpdate.mockReset();
    mockUserFindUnique.mockReset();
    mockUserCreate.mockReset();
    mockCompanyCreate.mockReset();

    mockSignupRequestFindUnique.mockResolvedValue({
      id: 'r1',
      companyName: 'Acme SARL',
      countryCode: 'BF',
      currencyCode: 'XOF',
      employeeCount: 12,
      phone: '+22670000000',
      firstName: 'Awa',
      lastName: 'Traore',
      email: 'awa@acme.bf',
      status: 'en_attente',
    });
    mockUserFindUnique.mockResolvedValue(null);
    mockCompanyCreate.mockResolvedValue({ id: 'c1' });
    mockUserCreate.mockResolvedValue({ id: 'u1' });
    mockSignupRequestUpdate.mockResolvedValue({});
  });

  it("copie le téléphone de la demande dans l'entreprise créée", async () => {
    const res = await request(app)
      .post('/api/admin/signup-requests/r1/approve')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(mockCompanyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ phone: '+22670000000' }),
    });
  });
});
