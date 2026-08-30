const GRAPH_API_VERSION = 'v21.0';
const REQUEST_TIMEOUT_MS = 10_000;

// Indicatifs pays pour les 3 marchés couverts par LaafiPay — nécessaires
// car Employee.phone est parfois saisi en local (8 chiffres, ex.
// "70123456") et l'API Cloud attend un numéro complet (indicatif inclus,
// sans "+", format E.164 sans le signe).
const CALLING_CODE_BY_COUNTRY: Record<string, string> = {
  BF: '226',
  BJ: '229',
  CD: '243',
};

export function normalizeWhatsAppNumber(rawPhone: string, countryCode: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  const callingCode = CALLING_CODE_BY_COUNTRY[countryCode];
  // Déjà préfixé par l'indicatif (numéro international) : on le laisse tel quel.
  if (callingCode && digits.startsWith(callingCode)) return digits;
  // Numéro local (8 chiffres pour BF/BJ/CD) : on préfixe l'indicatif du pays de l'entreprise.
  if (callingCode) return `${callingCode}${digits}`;
  return digits;
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

async function sendWhatsAppTemplate(
  toPhone: string,
  countryCode: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN non configurés' };
  }

  const to = normalizeWhatsAppNumber(toPhone, countryCode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }],
        },
      }),
    });

    const body = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (!res.ok) {
      const metaError = (body as { error?: { message?: string } }).error;
      return { ok: false, error: metaError?.message ?? `Meta a répondu ${res.status}` };
    }

    const messages = (body as { messages?: { id: string }[] }).messages;
    return { ok: true, messageId: messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

// Envoie une notification "bulletin disponible" via un message template
// Meta Cloud API — obligatoire ici : on contacte l'employé en dehors de
// toute fenêtre de conversation ouverte (il ne vient pas de nous écrire),
// donc un message texte libre serait rejeté par l'API. Le template doit
// être créé et approuvé dans Meta Business Manager au préalable (voir
// WHATSAPP_TEMPLATE_NAME) — tant qu'il ne l'est pas, cette fonction
// renvoie un échec propre (ok: false) plutôt que de planter, pour que
// l'appelant puisse l'enregistrer sur le bulletin (whatsappStatus=echoue).
export async function sendPayslipWhatsAppNotification(
  toPhone: string,
  countryCode: string,
  params: { employeeName: string; period: string; montantNet: string }
): Promise<WhatsAppSendResult> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'bulletin_disponible';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(toPhone, countryCode, templateName, languageCode, [params.employeeName, params.period, params.montantNet]);
}

// Notifie le manager d'une nouvelle demande de congé (portail ou WhatsApp).
// Le template doit être créé et approuvé dans Meta Business Manager au
// préalable (voir docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md) —
// tant qu'il ne l'est pas, renvoie un échec propre plutôt que de planter.
export async function sendLeaveManagerNotification(
  managerPhone: string,
  countryCode: string,
  params: { employeeName: string; startDate: string; endDate: string }
): Promise<WhatsAppSendResult> {
  const templateName = process.env.WHATSAPP_LEAVE_MANAGER_TEMPLATE_NAME ?? 'demande_conge_manager';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(managerPhone, countryCode, templateName, languageCode, [params.employeeName, params.startDate, params.endDate]);
}

// Notifie l'employé de la décision (validée/refusée) prise sur sa demande de
// congé, qu'elle vienne du portail ou d'un futur flux WhatsApp. Le template
// doit être créé et approuvé dans Meta Business Manager au préalable (voir
// docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md) — tant qu'il ne
// l'est pas, renvoie un échec propre plutôt que de planter.
export async function sendLeaveDecisionNotification(
  employeePhone: string,
  countryCode: string,
  decision: 'valide' | 'refuse',
  params: { startDate: string; endDate: string }
): Promise<WhatsAppSendResult> {
  const templateName =
    decision === 'valide'
      ? (process.env.WHATSAPP_LEAVE_APPROVED_TEMPLATE_NAME ?? 'conge_valide')
      : (process.env.WHATSAPP_LEAVE_REFUSED_TEMPLATE_NAME ?? 'conge_refuse');
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(employeePhone, countryCode, templateName, languageCode, [params.startDate, params.endDate]);
}
