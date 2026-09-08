import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

const { sendPasswordResetEmail, sendAccountCredentialsEmail } = await import('./email.js');

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

  // firstName vient d'un formulaire (signup public / saisie RH) — sans
  // échappement, un nom contenant du HTML permettrait d'injecter un faux
  // lien qui recouvre visuellement le vrai lien de réinitialisation dans
  // un client mail qui rend le HTML (voir audit sécurité, M2).
  it('échappe le HTML dans firstName', async () => {
    await sendPasswordResetEmail('a@b.com', {
      firstName: '<img src=x onerror=alert(1)>',
      resetUrl: 'https://laafipay.com/reset-password/tok1',
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('sendAccountCredentialsEmail', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@laafipay.com';
  });

  // companyName vient du formulaire d'inscription public, non authentifié
  // (voir audit sécurité, M2).
  it('échappe le HTML dans companyName', async () => {
    await sendAccountCredentialsEmail('a@b.com', {
      firstName: 'Awa',
      companyName: '<a href="https://evil.example">Cliquez ici</a>',
      password: 'temp1234',
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;a href=');
  });
});
