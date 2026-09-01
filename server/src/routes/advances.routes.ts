import { Router } from 'express';
import { Request } from 'express';
import { z } from 'zod';
import { Prisma, SalaryAdvance } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';
import { ACTIVE_ADVANCE_STATUSES, computeMaxAdvanceAmount } from '../lib/salaryAdvances.js';
import { IutsBracket } from '../lib/payrollEngine.js';
import { mostRecentLegalSettings } from './payroll.routes.js';

export const advancesRouter = Router();
advancesRouter.use(authenticate);

// ── DTO mapping ──────────────────────────────────────────────

function toAdvanceDTO(a: SalaryAdvance) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    amount: a.amount,
    remainingBalance: a.remainingBalance,
    channel: a.channel,
    status: a.status,
    requestedAt: a.requestedAt.toISOString(),
    approvedAt: a.approvedAt?.toISOString(),
    approvedBy: a.approvedBy ?? undefined,
    rejectedAt: a.rejectedAt?.toISOString(),
    rejectedBy: a.rejectedBy ?? undefined,
    rejectionReason: a.rejectionReason ?? undefined,
    mobileMoneyOperator: a.mobileMoneyOperator ?? undefined,
    reference: a.reference ?? undefined,
    paidAt: a.paidAt?.toISOString(),
  };
}

// Même triage que requireLeavesReadScope (leaves.routes.ts) : RH/compta
// (advances:read) voient toute l'entreprise, un salarié self-service
// (self:advances) ne voit que ses propres avances.
function requireAdvancesReadScope(req: Request): { employeeId?: string } {
  const user = req.user!;
  if (hasPermission(user.role, 'advances:read')) return {};
  if (hasPermission(user.role, 'self:advances')) {
    if (!user.employeeId) throw new ForbiddenError();
    return { employeeId: user.employeeId };
  }
  throw new ForbiddenError();
}

async function computeEmployeeMaxAdvance(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId } });
  const [legalSettings, payrollConfig] = await Promise.all([
    mostRecentLegalSettings(companyId),
    prisma.payrollConfig.findUnique({ where: { companyId } }),
  ]);
  const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];
  const maxAdvancePercent = payrollConfig?.maxAdvancePercent ?? 30;
  const maxAdvanceAmount = computeMaxAdvanceAmount(
    employee.baseSalary,
    { cnssEmployeeRate: legalSettings.cnssEmployeeRate, cnssEmployerRate: legalSettings.cnssEmployerRate, iutsBrackets },
    maxAdvancePercent
  );
  return maxAdvanceAmount;
}

// ── Lecture ──────────────────────────────────────────────────

advancesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = requireAdvancesReadScope(req);
    const companyId = req.user!.companyId;
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const employeeId = scope.employeeId ?? queryEmployeeId;

    const advances = await prisma.salaryAdvance.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { requestedAt: 'desc' },
    });
    res.json(advances.map(toAdvanceDTO));
  })
);

advancesRouter.get(
  '/eligibility',
  authorize('self:advances'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) throw new ForbiddenError();

    const [maxAdvanceAmount, activeAdvance] = await Promise.all([
      computeEmployeeMaxAdvance(user.companyId, user.employeeId),
      prisma.salaryAdvance.findFirst({ where: { employeeId: user.employeeId, status: { in: ACTIVE_ADVANCE_STATUSES } } }),
    ]);

    res.json({ maxAdvanceAmount, hasActiveAdvance: !!activeAdvance });
  })
);

// ── Écriture ─────────────────────────────────────────────────

const createAdvanceSchema = z.object({ amount: z.number().positive() });

advancesRouter.post(
  '/',
  authorize('self:advances'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) throw new ForbiddenError();
    const { amount } = createAdvanceSchema.parse(req.body);

    const existing = await prisma.salaryAdvance.findFirst({
      where: { employeeId: user.employeeId, status: { in: ACTIVE_ADVANCE_STATUSES } },
    });
    if (existing) throw new HttpError(400, 'Vous avez déjà une avance en cours');

    const maxAdvanceAmount = await computeEmployeeMaxAdvance(user.companyId, user.employeeId);
    if (amount > maxAdvanceAmount) {
      throw new HttpError(400, `Le montant demandé dépasse le plafond autorisé (${maxAdvanceAmount})`);
    }

    // Le findFirst ci-dessus est le chemin rapide pour le message utilisateur
    // dans le cas courant ; la vraie garantie sous concurrence (double-clic,
    // deux onglets, retry) est l'index unique partiel en base — voir le
    // commentaire sur SalaryAdvance dans schema.prisma. P2002 = violation de
    // cet index, convertie ici dans le même message 400 que le fast-path.
    let created: SalaryAdvance;
    try {
      created = await prisma.salaryAdvance.create({
        data: {
          companyId: user.companyId,
          employeeId: user.employeeId,
          amount,
          remainingBalance: amount,
          channel: 'portail',
          status: 'en_attente',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(400, 'Vous avez déjà une avance en cours');
      }
      throw err;
    }
    res.status(201).json(toAdvanceDTO(created));
  })
);

const approveSchema = z.object({ approvedBy: z.string() });
const rejectSchema = z.object({ rejectedBy: z.string(), reason: z.string().optional() });

advancesRouter.post(
  '/:id/approve',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'en_attente') {
      throw new HttpError(409, `Impossible d'approuver une avance au statut "${advance.status}"`);
    }

    const { approvedBy } = approveSchema.parse(req.body);
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: { status: 'approuve', approvedAt: new Date(), approvedBy },
    });
    res.json(toAdvanceDTO(updated));
  })
);

advancesRouter.post(
  '/:id/reject',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'en_attente') {
      throw new HttpError(409, `Impossible de rejeter une avance au statut "${advance.status}"`);
    }

    const { rejectedBy, reason } = rejectSchema.parse(req.body);
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: { status: 'rejete', rejectedAt: new Date(), rejectedBy, rejectionReason: reason },
    });
    res.json(toAdvanceDTO(updated));
  })
);

advancesRouter.post(
  '/:id/pay',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'approuve') {
      throw new HttpError(409, `Impossible de verser une avance au statut "${advance.status}"`);
    }

    const employee = await prisma.employee.findFirstOrThrow({ where: { id: advance.employeeId } });
    const reference = `OM-${Date.now().toString(36).toUpperCase()}`;
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: {
        status: 'verse_mobile_money',
        mobileMoneyOperator: employee.mobileMoneyOperator ?? 'orange',
        reference,
        paidAt: new Date(),
      },
    });
    res.json(toAdvanceDTO(updated));
  })
);
