import { Router } from 'express';
import { z } from 'zod';
import { LegalSettings, Payslip, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { findBracketRate, IutsBracket } from '../lib/payrollEngine.js';
import { hasPermission } from '../lib/permissions.js';
import { sendPayslipWhatsAppNotification } from '../lib/whatsapp.js';

const MONTH_NAMES_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatPeriodFr(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const name = MONTH_NAMES_FR[month - 1];
  return name ? `${name} ${year}` : period;
}

function formatAmountFr(amount: number, currencyCode: string): string {
  const decimals = currencyCode === 'CDF' ? 2 : 0;
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
  return `${formatted} ${currencyCode === 'CDF' ? 'CDF' : currencyCode === 'USD' ? 'USD' : 'FCFA'}`;
}

export const payslipsRouter = Router();
payslipsRouter.use(authenticate);

const payslipInclude = { cycle: { include: { legalSettings: true } } } as const;
type PayslipWithLegalSettings = Payslip & { cycle: { legalSettings: LegalSettings } };

// Le taux CNSS/IUTS n'est pas dupliqué sur le Payslip : il est dérivé, à la
// lecture, du barème figé sur le cycle (cycle.legalSettings) — jamais du
// barème "actuel", pour rester fidèle à ce qui a réellement été appliqué.
// Même formule simplifiée que la page de simulation
// (LivePayslipPreviewPage.tsx : iutsBase = salaireBrut - cnssEmployee) —
// délibérément gardée identique pour que bulletin réel et simulation
// affichent le même contenu.
function toPayslipDTO(p: PayslipWithLegalSettings) {
  const legalSettings = p.cycle.legalSettings;
  const iutsBase = Math.max(0, p.salaireBrut - p.cnssEmployee);
  const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];

  return {
    id: p.id,
    employeeId: p.employeeId,
    cycleId: p.cycleId,
    period: p.period,
    generatedAt: p.generatedAt.toISOString(),
    generatedBy: p.generatedBy,
    emailStatus: p.emailStatus,
    whatsappStatus: p.whatsappStatus,
    smsStatus: p.smsStatus,
    emailSentAt: p.emailSentAt?.toISOString(),
    whatsappSentAt: p.whatsappSentAt?.toISOString(),
    smsSentAt: p.smsSentAt?.toISOString(),
    whatsappError: p.whatsappError ?? undefined,
    baseSalary: p.baseSalary,
    overtimeAmount: p.overtimeAmount,
    salaireBrut: p.salaireBrut,
    cnssEmployee: p.cnssEmployee,
    cnssEmployer: p.cnssEmployer,
    cnssEmployeeRate: legalSettings.cnssEmployeeRate / 100,
    cnssEmployerRate: legalSettings.cnssEmployerRate / 100,
    iuts: p.iuts,
    iutsBase,
    iutsRate: findBracketRate(iutsBase, iutsBrackets),
    coutEmployeur: p.coutEmployeur,
    salaireNet: p.salaireNet,
    primes: p.primes,
    indemnites: p.indemnites,
    avances: p.avances,
    retenues: p.retenues,
  };
}

// Régénère les bulletins d'un cycle depuis ses PayrollEntry (source de
// vérité) — remplace les bulletins existants du cycle, comme le faisait le
// mock. Exportée pour être appelée aussi depuis payroll.routes.ts au moment
// de la validation du cycle (déclenchement automatique), pas seulement
// depuis la route /generate ci-dessous.
export async function generatePayslipsForCycle(cycleId: string, companyId: string, generatedBy: string) {
  const cycle = await prisma.payrollCycle.findFirst({
    where: { id: cycleId, companyId },
    include: { entries: true },
  });
  if (!cycle) throw new NotFoundError(`Cycle ${cycleId} introuvable`);

  await prisma.payslip.deleteMany({ where: { cycleId } });
  if (cycle.entries.length > 0) {
    await prisma.payslip.createMany({
      data: cycle.entries.map((entry) => ({
        companyId,
        cycleId,
        employeeId: entry.employeeId,
        period: cycle.period,
        generatedBy,
        baseSalary: entry.baseSalary,
        overtimeAmount: entry.overtimeAmount,
        salaireBrut: entry.salaireBrut,
        cnssEmployee: entry.cnssEmployee,
        cnssEmployer: entry.cnssEmployer,
        iuts: entry.iuts,
        coutEmployeur: entry.coutEmployeur,
        salaireNet: entry.salaireNet,
        primes: entry.primes as Prisma.InputJsonValue,
        indemnites: entry.indemnites as Prisma.InputJsonValue,
        avances: entry.avances as Prisma.InputJsonValue,
        retenues: entry.retenues as Prisma.InputJsonValue,
      })),
    });
  }

  return prisma.payslip.findMany({
    where: { cycleId },
    include: payslipInclude,
    orderBy: { employeeId: 'asc' },
  });
}

// Un salarié self-service (permission self:payslips uniquement) ne peut voir
// que ses propres bulletins : on force employeeId à req.user.employeeId
// (en ignorant toute valeur passée en query) plutôt que de rejeter la
// requête, pour que l'onglet "Mes bulletins" fonctionne sans droit
// payslips:read (réservé aux rôles RH/compta).
function requirePayslipsAccess(req: import('express').Request): { companyId: string; employeeId?: string } {
  const user = req.user!;
  if (hasPermission(user.role, 'payslips:read')) {
    return { companyId: user.companyId };
  }
  if (hasPermission(user.role, 'self:payslips') && user.employeeId) {
    return { companyId: user.companyId, employeeId: user.employeeId };
  }
  throw new ForbiddenError();
}

payslipsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const access = requirePayslipsAccess(req);
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const employeeId = access.employeeId ?? queryEmployeeId;
    const cycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId : undefined;

    const payslips = await prisma.payslip.findMany({
      where: { companyId: access.companyId, ...(employeeId ? { employeeId } : {}), ...(cycleId ? { cycleId } : {}) },
      include: payslipInclude,
      orderBy: { generatedAt: 'desc' },
    });
    res.json(payslips.map(toPayslipDTO));
  })
);

payslipsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const access = requirePayslipsAccess(req);
    const payslip = await prisma.payslip.findFirst({
      where: { id: req.params.id, companyId: access.companyId, ...(access.employeeId ? { employeeId: access.employeeId } : {}) },
      include: payslipInclude,
    });
    if (!payslip) throw new NotFoundError(`Bulletin ${req.params.id} introuvable`);
    res.json(toPayslipDTO(payslip));
  })
);

payslipsRouter.post(
  '/generate/:cycleId',
  authorize('payslips:generate'),
  asyncHandler(async (req, res) => {
    const generated = await generatePayslipsForCycle(req.params.cycleId, req.user!.companyId, req.user!.email);
    res.status(201).json(generated.map(toPayslipDTO));
  })
);

const sendChannelSchema = z.enum(['email', 'whatsapp', 'sms']);
const statusField = { email: 'emailStatus', whatsapp: 'whatsappStatus', sms: 'smsStatus' } as const;
const sentAtField = { email: 'emailSentAt', whatsapp: 'whatsappSentAt', sms: 'smsSentAt' } as const;

// Seul WhatsApp a un vrai envoi (API Meta Cloud) — email/sms restent des
// stubs qui se marquent "envoyé" immédiatement, faute d'intégration
// équivalente pour l'instant (hors périmètre de ce lot).
async function sendPayslipViaWhatsApp(payslipId: string, companyId: string): Promise<{ ok: boolean; error?: string }> {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, companyId },
    include: { employee: { select: { firstName: true, lastName: true, phone: true } }, company: { select: { countryCode: true, currencyCode: true } } },
  });
  if (!payslip) throw new NotFoundError(`Bulletin ${payslipId} introuvable`);

  const result = await sendPayslipWhatsAppNotification(payslip.employee.phone, payslip.company.countryCode, {
    employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
    period: formatPeriodFr(payslip.period),
    montantNet: formatAmountFr(payslip.salaireNet, payslip.company.currencyCode),
  });

  await prisma.payslip.update({
    where: { id: payslip.id },
    data: result.ok
      ? { whatsappStatus: 'envoye', whatsappSentAt: new Date(), whatsappError: null }
      : { whatsappStatus: 'echoue', whatsappError: result.error },
  });

  return { ok: result.ok, error: result.error };
}

payslipsRouter.post(
  '/:id/send/:channel',
  authorize('payslips:send'),
  asyncHandler(async (req, res) => {
    const channel = sendChannelSchema.parse(req.params.channel);
    const companyId = req.user!.companyId;

    if (channel === 'whatsapp') {
      const result = await sendPayslipViaWhatsApp(req.params.id, companyId);
      if (!result.ok) throw new HttpError(502, result.error ?? "Échec de l'envoi WhatsApp");
      res.status(204).send();
      return;
    }

    const payslip = await prisma.payslip.findFirst({ where: { id: req.params.id, companyId } });
    if (!payslip) throw new NotFoundError(`Bulletin ${req.params.id} introuvable`);

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { [statusField[channel]]: 'envoye', [sentAtField[channel]]: new Date() },
    });
    res.status(204).send();
  })
);

const sendAllSchema = z.object({ channel: sendChannelSchema });

payslipsRouter.post(
  '/send-all/:cycleId',
  authorize('payslips:send'),
  asyncHandler(async (req, res) => {
    const { channel } = sendAllSchema.parse(req.body);
    const companyId = req.user!.companyId;

    if (channel === 'whatsapp') {
      const payslips = await prisma.payslip.findMany({
        where: { cycleId: req.params.cycleId, companyId },
        select: { id: true },
      });
      let sent = 0;
      let failed = 0;
      for (const p of payslips) {
        const result = await sendPayslipViaWhatsApp(p.id, companyId);
        if (result.ok) sent += 1;
        else failed += 1;
      }
      res.json({ sent, failed });
      return;
    }

    const { count } = await prisma.payslip.updateMany({
      where: { cycleId: req.params.cycleId, companyId },
      data: { [statusField[channel]]: 'envoye', [sentAtField[channel]]: new Date() },
    });
    res.json({ sent: count, failed: 0 });
  })
);
