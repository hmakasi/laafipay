import { Resend } from 'resend';
import { randomBytes } from 'crypto';

export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

// firstName/companyName viennent de formulaires utilisateur (inscription
// publique, saisie RH) et sont interpolés tels quels dans du HTML brut —
// sans échappement, un nom contenant du HTML permettrait d'injecter un lien
// trompeur qui recouvre visuellement le vrai lien, depuis le domaine de
// confiance de LaafiPay (voir audit sécurité, M2).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Ne lève jamais — même échec "gracieux" que sendPayslipWhatsAppNotification
// (whatsapp.ts) : l'appelant décide quoi faire si l'envoi échoue (ici,
// l'approbation de la demande reste valide même si l'e-mail ne part pas —
// voir routes/admin.routes.ts).
export async function sendAccountCredentialsEmail(
  toEmail: string,
  params: { firstName: string; companyName: string; password: string }
): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'RESEND_API_KEY / RESEND_FROM_EMAIL non configurés' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Votre compte LaafiPay — ${params.companyName}`,
      html: `
        <p>Bonjour ${escapeHtml(params.firstName)},</p>
        <p>Votre demande de création d'entreprise <strong>${escapeHtml(params.companyName)}</strong> sur LaafiPay a été approuvée.</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li>Identifiant : <strong>${escapeHtml(toEmail)}</strong></li>
          <li>Mot de passe temporaire : <strong>${escapeHtml(params.password)}</strong></li>
        </ul>
        <p>Connectez-vous sur <a href="https://laafipay.com/login">laafipay.com</a> puis changez ce mot de passe dès votre première connexion, depuis Paramètres.</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Même dégradation gracieuse que sendAccountCredentialsEmail — voir
// routes/auth.routes.ts, qui répond succès même si l'envoi échoue (pas de
// signal côté client permettant de distinguer un échec d'envoi d'un compte
// inexistant, cf. anti-énumération).
export async function sendPasswordResetEmail(
  toEmail: string,
  params: { firstName: string; resetUrl: string }
): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'RESEND_API_KEY / RESEND_FROM_EMAIL non configurés' };
  }

  try {
    const resend = new Resend(apiKey);
    // Réf. courte (aléatoire, sans lien avec le token de reset lui-même)
    // pour que deux demandes successives n'aient pas le même sujet — sinon
    // Gmail/Yahoo les regroupent dans une même conversation, et l'utilisateur
    // peut se retrouver à cliquer sur un lien plus ancien déjà invalidé
    // (un seul token actif à la fois par compte).
    const ref = randomBytes(3).toString('hex');
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Réinitialisation de votre mot de passe LaafiPay (réf. ${ref})`,
      html: `
        <p>Bonjour ${escapeHtml(params.firstName)},</p>
        <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte LaafiPay.</p>
        <p><a href="${params.resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Même dégradation gracieuse que sendAccountCredentialsEmail (l'appelant
// décide quoi faire si l'envoi échoue — voir routes/employees.routes.ts, qui
// renvoie alors le mot de passe généré dans la réponse pour transmission
// manuelle plutôt que de perdre l'accès à un compte déjà créé).
export async function sendEmployeeAccountCredentialsEmail(
  toEmail: string,
  params: { firstName: string; companyName: string; password: string }
): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'RESEND_API_KEY / RESEND_FROM_EMAIL non configurés' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Votre accès LaafiPay — ${params.companyName}`,
      html: `
        <p>Bonjour ${escapeHtml(params.firstName)},</p>
        <p>Un compte LaafiPay vient d'être créé pour vous chez <strong>${escapeHtml(params.companyName)}</strong>, pour accéder à votre espace salarié (bulletins de paie, congés, entretiens annuels).</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li>Identifiant : <strong>${escapeHtml(toEmail)}</strong></li>
          <li>Mot de passe temporaire : <strong>${escapeHtml(params.password)}</strong></li>
        </ul>
        <p>Connectez-vous sur <a href="https://laafipay.com/login">laafipay.com</a> — un nouveau mot de passe vous sera demandé dès la première connexion.</p>
      `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
