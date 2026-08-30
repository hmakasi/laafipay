import { Company, Employee, LeaveType, WhatsAppSession } from '@prisma/client';
import { prisma } from '../prisma.js';
import { parseFrenchDate, computeLeaveDaysCount } from '../leaveDates.js';
import { createLeaveRequestRecord } from '../leaveRequests.js';
import { startSession, advanceSession, endSession } from '../whatsappSession.js';
import { sendWhatsAppTextMessage, sendWhatsAppListMessage, sendWhatsAppReplyButtons } from '../whatsapp.js';
import type { IncomingMessage } from '../../routes/whatsappWebhook.routes.js';

export const LEAVE_FLOW = 'leave_request';

// Ordre et libellés repris tels quels du script de conversation (spec,
// Flux 2 étape 1).
export const LEAVE_TYPE_MENU: { id: LeaveType; title: string }[] = [
  { id: 'conge_paye', title: 'Congé payé légal' },
  { id: 'evenement_familial', title: 'Permission exceptionnelle' },
  { id: 'maternite', title: 'Congé de maternité / paternité' },
  { id: 'maladie', title: 'Congé maladie' },
  { id: 'examen_formation', title: 'Congé pour examen / formation' },
  { id: 'sans_solde', title: 'Congé sans solde' },
];

interface LeaveFlowData {
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  daysCount?: number;
}

export async function startLeaveFlow(employee: Employee, phone: string): Promise<void> {
  const year = new Date().getUTCFullYear();
  const balances = await prisma.leaveBalance.findMany({ where: { employeeId: employee.id, year } });
  const congePaye = balances.find((b) => b.type === 'conge_paye');
  const conge_anciennete = balances.find((b) => b.type === 'conge_anciennete');

  await sendWhatsAppTextMessage(
    phone,
    `Vos soldes actuels :\n• Congés payés principaux : ${congePaye?.remaining ?? 0} jours\n• Congés d'ancienneté : ${conge_anciennete?.remaining ?? 0} jours`
  );

  await sendWhatsAppListMessage(phone, {
    bodyText: 'Quel type de congé souhaitez-vous demander ?',
    buttonLabel: 'Choisir',
    sections: [{ title: 'Types de congé', rows: LEAVE_TYPE_MENU }],
  });

  await startSession({ phone, employeeId: employee.id, flow: LEAVE_FLOW, step: 'choosing_type' });
}

export async function handleLeaveFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void> {
  const data = session.data as unknown as LeaveFlowData;

  if (session.step === 'choosing_type') {
    if (incoming.kind !== 'list_reply') {
      await sendWhatsAppTextMessage(incoming.from, 'Veuillez choisir un type de congé dans la liste proposée.');
      return;
    }
    await advanceSession(session.id, { step: 'awaiting_start_date', data: { leaveType: incoming.id as LeaveType } });
    await sendWhatsAppTextMessage(incoming.from, 'Indiquez la date de début (format : JJ/MM/AAAA).\nExemple : 10/08/2026');
    return;
  }

  if (session.step === 'awaiting_start_date') {
    if (incoming.kind !== 'text' || !parseFrenchDate(incoming.text)) {
      await sendWhatsAppTextMessage(incoming.from, 'Format de date invalide. Merci de répondre au format JJ/MM/AAAA (ex. 10/08/2026).');
      return;
    }
    await advanceSession(session.id, { step: 'awaiting_end_date', data: { ...data, startDate: incoming.text } });
    await sendWhatsAppTextMessage(incoming.from, 'Indiquez la date de fin (inclus).');
    return;
  }

  if (session.step === 'awaiting_end_date') {
    if (incoming.kind !== 'text' || !parseFrenchDate(incoming.text)) {
      await sendWhatsAppTextMessage(incoming.from, 'Format de date invalide. Merci de répondre au format JJ/MM/AAAA (ex. 21/08/2026).');
      return;
    }
    const startDate = parseFrenchDate(data.startDate!)!;
    const endDate = parseFrenchDate(incoming.text)!;
    if (endDate < startDate) {
      await sendWhatsAppTextMessage(incoming.from, 'La date de fin doit être après la date de début. Merci de la ressaisir.');
      return;
    }

    const daysCount = computeLeaveDaysCount(startDate, endDate);
    const year = startDate.getUTCFullYear();
    const balance = await prisma.leaveBalance.findMany({ where: { employeeId: employee.id, year, type: data.leaveType } });
    const remaining = (balance[0]?.remaining ?? 0) - daysCount;

    await advanceSession(session.id, { step: 'awaiting_confirmation', data: { ...data, endDate: incoming.text, daysCount } });

    const menuEntry = LEAVE_TYPE_MENU.find((m) => m.id === data.leaveType);
    await sendWhatsAppTextMessage(
      incoming.from,
      `📝 Récapitulatif de votre demande :\n• Type : ${menuEntry?.title}\n• Du : ${data.startDate} au ${incoming.text}\n• Durée : ${daysCount} jours\n• Solde restant après validation : ${remaining} jours\n\nValidez-vous cette demande ?`
    );
    await sendWhatsAppReplyButtons(incoming.from, { bodyText: 'Confirmez-vous cette demande ?', buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] });
    return;
  }

  if (session.step === 'awaiting_confirmation') {
    if (incoming.kind !== 'button_reply') {
      await sendWhatsAppTextMessage(incoming.from, 'Merci de répondre avec les boutons "Confirmer" ou "Annuler".');
      return;
    }

    if (incoming.id === 'cancel') {
      await sendWhatsAppTextMessage(incoming.from, 'Demande annulée.');
      await endSession(session.id);
      return;
    }

    if (incoming.id === 'confirm') {
      const startDate = parseFrenchDate(data.startDate!)!;
      const endDate = parseFrenchDate(data.endDate!)!;
      await createLeaveRequestRecord({
        companyId: employee.companyId,
        employeeId: employee.id,
        type: data.leaveType!,
        startDate,
        endDate,
        daysCount: data.daysCount!,
        channel: 'whatsapp',
      });
      await sendWhatsAppTextMessage(incoming.from, '🚀 Demande envoyée avec succès ! Votre manager a été notifié. Vous recevrez un message sur WhatsApp dès qu\'elle sera validée.');
      await endSession(session.id);
      return;
    }
  }
}
