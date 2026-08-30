import { Router, Request } from 'express';
import crypto from 'crypto';
import { resolveEmployeeByWhatsAppPhone, getActiveSession, startSession } from '../lib/whatsappSession.js';
import { sendWhatsAppTextMessage } from '../lib/whatsapp.js';
import { PAYSLIP_FLOW, handlePayslipFlowMessage } from '../lib/whatsappFlows/payslip.js';
import { prisma } from '../lib/prisma.js';

export const whatsappWebhookRouter = Router();

export type IncomingMessage =
  | { from: string; kind: 'text'; text: string }
  | { from: string; kind: 'list_reply'; id: string }
  | { from: string; kind: 'button_reply'; id: string };

interface WebhookMessage {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

export function extractIncomingMessage(body: unknown): IncomingMessage | null {
  const value = (body as { entry?: { changes?: { value?: { messages?: WebhookMessage[] } }[] }[] })?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  if (message.type === 'text' && message.text) {
    return { from: message.from, kind: 'text', text: message.text.body };
  }
  if (message.type === 'interactive' && message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
    return { from: message.from, kind: 'list_reply', id: message.interactive.list_reply.id };
  }
  if (message.type === 'interactive' && message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
    return { from: message.from, kind: 'button_reply', id: message.interactive.button_reply.id };
  }
  return null;
}

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

whatsappWebhookRouter.get('/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(String(challenge));
    return;
  }
  res.sendStatus(403);
});

whatsappWebhookRouter.post('/webhook', async (req: Request & { rawBody?: Buffer }, res) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = req.header('X-Hub-Signature-256');
  if (!appSecret || !req.rawBody || !verifyMetaSignature(req.rawBody, signature, appSecret)) {
    res.sendStatus(403);
    return;
  }

  const incoming = extractIncomingMessage(req.body);
  if (!incoming) {
    res.sendStatus(200);
    return;
  }

  const employee = await resolveEmployeeByWhatsAppPhone(incoming.from);
  if (!employee) {
    res.sendStatus(200);
    return;
  }

  const session = await getActiveSession(incoming.from);
  if (!session) {
    // Déclencheur : l'employé a cliqué sur "Obtenir mon bulletin" (bouton du
    // template bulletin_disponible). Le clic arrive comme un message de type
    // "button" (bouton de template, pas interactive) — voir la doc Meta sur
    // les quick-reply buttons de template.
    const latestPayslip = await prisma.payslip.findFirst({ where: { employeeId: employee.id, whatsappStatus: 'envoye' }, orderBy: { generatedAt: 'desc' } });
    if (!latestPayslip) {
      await sendWhatsAppTextMessage(incoming.from, "Aucun bulletin n'est disponible pour le moment.");
      res.sendStatus(200);
      return;
    }
    const newSession = await startSession({ phone: incoming.from, employeeId: employee.id, flow: PAYSLIP_FLOW, step: 'awaiting_pin', data: { payslipId: latestPayslip.id } });
    await handlePayslipFlowMessage(newSession, employee, { from: incoming.from, kind: 'text', text: '' });
    res.sendStatus(200);
    return;
  }

  if (session.flow === PAYSLIP_FLOW) {
    await handlePayslipFlowMessage(session, employee, incoming);
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);
});
