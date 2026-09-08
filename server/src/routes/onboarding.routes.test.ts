import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockEmployeeFindFirst = vi.fn();
const mockEmployeeUpdate = vi.fn();
const mockDocumentCreate = vi.fn();
const mockBlobPut = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    employee: {
      findFirst: (...args: unknown[]) => mockEmployeeFindFirst(...args),
      update: (...args: unknown[]) => mockEmployeeUpdate(...args),
    },
    employeeDocument: { create: (...args: unknown[]) => mockDocumentCreate(...args) },
  },
}));

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
  get: vi.fn(),
  del: vi.fn(),
}));

const { default: app } = await import('../app.js');

describe('PATCH /api/onboarding/:token — stockage du document', () => {
  beforeEach(() => {
    mockEmployeeFindFirst.mockReset();
    mockEmployeeUpdate.mockReset();
    mockDocumentCreate.mockReset();
    mockBlobPut.mockReset();
    mockEmployeeFindFirst.mockResolvedValue({
      id: 'emp1',
      inviteToken: 'tok1',
      inviteStatus: 'invited',
      company: { name: 'Acme' },
    });
    mockEmployeeUpdate.mockResolvedValue({});
  });

  // os.tmpdir() n'est pas persistant entre invocations sur Vercel
  // (serverless) — un document "uploadé" à l'onboarding disparaissait donc
  // silencieusement, tout en laissant un enregistrement EmployeeDocument
  // qui prétend le contraire (voir audit sécurité, M4). Vercel Blob (déjà
  // utilisé pour les documents employé, voir employees.routes.ts) est la
  // seule option qui persiste réellement.
  it('stocke le document sur Vercel Blob plutôt que sur disque local', async () => {
    mockBlobPut.mockResolvedValueOnce({ url: 'https://blob.vercel-storage.com/documents/emp1-123.pdf' });
    mockDocumentCreate.mockResolvedValueOnce({ id: 'doc1' });

    const res = await request(app)
      .patch('/api/onboarding/tok1')
      .attach('document', Buffer.from('contenu-du-fichier'), 'piece-identite.pdf');

    expect(res.status).toBe(200);
    expect(mockBlobPut).toHaveBeenCalledTimes(1);
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: 'https://blob.vercel-storage.com/documents/emp1-123.pdf' }),
      })
    );
  });
});
