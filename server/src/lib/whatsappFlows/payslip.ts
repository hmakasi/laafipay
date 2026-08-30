import { put } from '@vercel/blob';
import { Company, Employee, WhatsAppSession } from '@prisma/client';
import { prisma } from '../prisma.js';
import { verifyPin } from '../whatsappPin.js';
import { advanceSession, endSession } from '../whatsappSession.js';
import { sendWhatsAppTextMessage, sendWhatsAppDocument } from '../whatsapp.js';
import { generatePayslipPdf, PayslipPdfData } from '../payslipPdf.js';
import type { IncomingMessage } from '../../routes/whatsappWebhook.routes.js';

export const PAYSLIP_FLOW = 'payslip_delivery';

interface PayslipFlowData {
  payslipId: string;
}

// Construit les données du PDF à partir du même Payslip que celui déjà
// affiché dans PayslipPreviewDialog.tsx côté portail. Simplifié
// volontairement par rapport à ce dialogue (une seule ligne CNSS, pas de
// détail avances/retenues) pour rester au niveau d'information déjà présent
// sur le Payslip stocké — voir Task 12 pour le format cible.
function buildPdfDataFromPayslip(
  payslip: { period: string; baseSalary: number; salaireBrut: number; cnssEmployee: number; cnssEmployer: number; iuts: number; salaireNet: number; coutEmployeur: number },
  employee: Employee,
  company: Company
): PayslipPdfData {
  return {
    company: { name: company.name, legalName: company.legalName ?? company.name, taxIdLabel: 'IFU', socialAgencyLabel: 'CNSS' },
    employee: { fullName: `${employee.firstName} ${employee.lastName}`, matricule: employee.matricule },
    period: { label: payslip.period },
    earnings: [{ label: 'Salaire de base', employeeAmount: payslip.baseSalary }],
    grossSalary: payslip.salaireBrut,
    contributions: [{ label: 'CNSS', employeeAmount: -payslip.cnssEmployee, employerAmount: payslip.cnssEmployer }],
    employeeContributionsTotal: payslip.cnssEmployee,
    employerContributionsTotal: payslip.cnssEmployer,
    incomeTax: { label: 'IUTS', base: payslip.salaireBrut - payslip.cnssEmployee, rate: 0, amount: payslip.iuts },
    netBeforeTax: payslip.salaireBrut - payslip.cnssEmployee,
    netToPay: payslip.salaireNet,
    employerCost: payslip.coutEmployeur,
    currencyCode: company.currencyCode,
  };
}

async function deliverPayslip(phone: string, payslipId: string, employee: Employee, company: Company): Promise<void> {
  const payslip = await prisma.payslip.findFirst({ where: { id: payslipId } });
  if (!payslip) {
    await sendWhatsAppTextMessage(phone, "Votre bulletin n'est plus disponible. Contactez votre service RH.");
    return;
  }

  let pdfUrl = payslip.pdfUrl;
  if (!pdfUrl) {
    const pdfData = buildPdfDataFromPayslip(payslip, employee, company);
    const pdfBuffer = generatePayslipPdf(pdfData);
    const blob = await put(`payslips/${payslip.id}.pdf`, pdfBuffer, {
      access: 'private',
      contentType: 'application/pdf',
      token: process.env.DOCUMENTS_BLOB_READ_WRITE_TOKEN,
    });
    pdfUrl = blob.url;
    await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfUrl } });
  }

  await sendWhatsAppDocument(phone, { link: pdfUrl, filename: `Bulletin_Paie_${payslip.period}.pdf` });
}

export async function handlePayslipFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void> {
  if (session.step !== 'awaiting_pin' || incoming.kind !== 'text') {
    await sendWhatsAppTextMessage(incoming.from, 'Veuillez entrer votre code PIN à 4 chiffres.');
    return;
  }

  if (!/^\d{4}$/.test(incoming.text)) {
    await sendWhatsAppTextMessage(incoming.from, 'Le code PIN doit contenir exactement 4 chiffres. Veuillez réessayer.');
    return;
  }

  const result = await verifyPin(incoming.text, employee);

  if (result.outcome === 'no_pin_set') {
    await sendWhatsAppTextMessage(incoming.from, "Vous n'avez pas encore configuré de code PIN WhatsApp. Rendez-vous sur le portail LaafiPay, dans votre espace self-service, pour en définir un.");
    await endSession(session.id);
    return;
  }

  if (result.outcome === 'locked') {
    await sendWhatsAppTextMessage(incoming.from, `Trop de tentatives incorrectes. Réessayez après ${result.unlocksAt.toLocaleTimeString('fr-FR')}.`);
    await endSession(session.id);
    return;
  }

  await prisma.employee.update({ where: { id: employee.id }, data: result.update });

  if (result.outcome === 'incorrect') {
    await sendWhatsAppTextMessage(incoming.from, `Code PIN incorrect. Tentatives restantes : ${result.attemptsRemaining}.`);
    await advanceSession(session.id, { step: session.step, data: session.data as unknown as PayslipFlowData });
    return;
  }

  const { payslipId } = session.data as unknown as PayslipFlowData;
  await deliverPayslip(incoming.from, payslipId, employee, employee.company);
  await endSession(session.id);
}
