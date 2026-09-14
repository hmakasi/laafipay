import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockEntryCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    comptaJournalEntry: {
      create: (...args: unknown[]) => mockEntryCreate(...args),
    },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

const accountantToken = signToken({ id: 'u1', email: 'compta@b.com', role: 'accountant', companyId: 'c1' });

const validPayload = {
  journal: 'CAI',
  piece: 'CAI-0001',
  dateEcriture: '2026-09-14',
  libelle: 'Achat fournitures de bureau en espèces',
  lignes: [
    { compte: '6064', libelleCompte: 'Fournitures de bureau', debit: 15_000, credit: 0 },
    { compte: '5711', libelleCompte: 'Caisse', debit: 0, credit: 15_000 },
  ],
};

describe('POST /api/compta/journal-entries — saisie manuelle', () => {
  beforeEach(() => {
    mockEntryCreate.mockReset();
  });

  it('crée une écriture équilibrée dans le journal demandé', async () => {
    mockEntryCreate.mockResolvedValueOnce({
      id: 'je1',
      journal: 'CAI',
      piece: 'CAI-0001',
      dateEcriture: new Date('2026-09-14'),
      libelle: validPayload.libelle,
      sourceSystem: 'Manuel',
      receivedAt: new Date('2026-09-14'),
      lignes: validPayload.lignes,
    });

    const res = await request(app)
      .post('/api/compta/journal-entries')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(mockEntryCreate).toHaveBeenCalledTimes(1);
    const data = mockEntryCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ companyId: 'c1', journal: 'CAI', sourceSystem: 'Manuel' });
  });

  it("rejette une écriture non équilibrée (débit total ≠ crédit total)", async () => {
    const res = await request(app)
      .post('/api/compta/journal-entries')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ ...validPayload, lignes: [{ compte: '6064', libelleCompte: 'Fournitures', debit: 15_000, credit: 0 }] });

    expect(res.status).toBe(400);
    expect(mockEntryCreate).not.toHaveBeenCalled();
  });

  it('rejette un code journal inconnu', async () => {
    const res = await request(app)
      .post('/api/compta/journal-entries')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ ...validPayload, journal: 'XXX' });

    expect(res.status).toBe(400);
    expect(mockEntryCreate).not.toHaveBeenCalled();
  });
});
