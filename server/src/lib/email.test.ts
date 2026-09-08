import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

const { sendPasswordResetEmail } = await import('./email.js');

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@laafipay.com';
  });

  // Gmail/Yahoo regroupent les e-mails de sujet identique dans une même
  // conversation — une demande de reset répétée pour le même compte
  // pouvait alors ramener l'utilisateur sur un e-mail plus ancien dont le
  // lien est déjà invalidé (un seul token actif à la fois par compte).
  it('utilise un sujet différent à chaque envoi pour éviter le regroupement en conversation', async () => {
    await sendPasswordResetEmail('a@b.com', { firstName: 'Awa', resetUrl: 'https://laafipay.com/reset-password/tok1' });
    await sendPasswordResetEmail('a@b.com', { firstName: 'Awa', resetUrl: 'https://laafipay.com/reset-password/tok2' });

    const firstSubject = mockSend.mock.calls[0][0].subject;
    const secondSubject = mockSend.mock.calls[1][0].subject;
    expect(firstSubject).not.toBe(secondSubject);
  });
});
