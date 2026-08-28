import { Resend } from 'resend';

export interface EmailSendResult {
  ok: boolean;
  error?: string;
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
        <p>Bonjour ${params.firstName},</p>
        <p>Votre demande de création d'entreprise <strong>${params.companyName}</strong> sur LaafiPay a été approuvée.</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li>Identifiant : <strong>${toEmail}</strong></li>
          <li>Mot de passe temporaire : <strong>${params.password}</strong></li>
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
        <p>Bonjour ${params.firstName},</p>
        <p>Un compte LaafiPay vient d'être créé pour vous chez <strong>${params.companyName}</strong>, pour accéder à votre espace salarié (bulletins de paie, congés, entretiens annuels).</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li>Identifiant : <strong>${toEmail}</strong></li>
          <li>Mot de passe temporaire : <strong>${params.password}</strong></li>
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
