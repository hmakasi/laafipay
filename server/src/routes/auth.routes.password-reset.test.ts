import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createHash } from 'crypto';

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockSendPasswordResetEmail = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('../lib/email.js', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  sendAccountCredentialsEmail: vi.fn(),
  sendEmployeeAccountCredentialsEmail: vi.fn(),
}));

const { default: app } = await import('../app.js');

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockSendPasswordResetEmail.mockReset();
    mockSendPasswordResetEmail.mockResolvedValue({ ok: true });
  });

  it("répond avec succès et envoie un e-mail quand le compte existe", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Awa',
      isActive: true,
    });
    mockUpdate.mockResolvedValueOnce({});

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          resetTokenHash: expect.any(String),
          resetTokenExpiresAt: expect.any(Date),
        }),
      })
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("répond avec succès sans envoyer d'e-mail quand le compte n'existe pas (anti-énumération)", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'inconnu@b.com' });

    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("répond avec succès sans envoyer d'e-mail quand le compte est désactivé", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Awa',
      isActive: false,
    });

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejette un email invalide', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'pas-un-email' });
    expect(res.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // Le message générique n'a de sens anti-énumération que si les deux
  // branches (compte existant / inexistant) répondent en un temps
  // comparable — sinon la latence elle-même révèle si le compte existe.
  // La branche "compte existant" ne doit donc pas attendre l'envoi de
  // l'e-mail (appel réseau vers Resend) avant de répondre.
  it("répond sans attendre la fin de l'envoi de l'e-mail", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Awa',
      isActive: true,
    });
    mockUpdate.mockResolvedValueOnce({});
    mockSendPasswordResetEmail.mockImplementationOnce(() => new Promise(() => {})); // ne résout jamais

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
  });

  it("journalise côté serveur quand l'envoi de l'e-mail échoue", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Awa',
      isActive: true,
    });
    mockUpdate.mockResolvedValueOnce({});
    mockSendPasswordResetEmail.mockResolvedValueOnce({ ok: false, error: 'panne Resend' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
    // Laisse la microtask du sendPasswordResetEmail non-attendu se résoudre.
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('reset password'), 'panne Resend');
    errorSpy.mockRestore();
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  it('réinitialise le mot de passe avec un token valide et non expiré', async () => {
    const rawToken = 'valid-token';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    mockFindFirst.mockResolvedValueOnce({
      id: 'u1',
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    mockUpdate.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NouveauMdp1234!' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          mustChangePassword: false,
        }),
      })
    );
  });

  it('rejette un token expiré', async () => {
    const rawToken = 'expired-token';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    mockFindFirst.mockResolvedValueOnce({
      id: 'u1',
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NouveauMdp1234!' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejette un token inconnu', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'inconnu', newPassword: 'NouveauMdp1234!' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejette un mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'quelconque', newPassword: 'court' });

    expect(res.status).toBe(400);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
