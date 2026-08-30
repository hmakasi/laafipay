import { Router } from 'express';
import { z } from 'zod';
import { LeaveRequest, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';
import { computeCongePayeAccrual } from '../lib/leaveAccrual.js';
import { createLeaveRequestRecord } from '../lib/leaveRequests.js';

export const leavesRouter = Router();
leavesRouter.use(authenticate);

const dateOnly = (d: Date) => d.toISOString().split('T')[0];

function toLeaveRequestDTO(r: LeaveRequest) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    type: r.type,
    startDate: dateOnly(r.startDate),
    endDate: dateOnly(r.endDate),
    daysCount: r.daysCount,
    reason: r.reason ?? undefined,
    status: r.status,
    channel: r.channel,
    submittedAt: r.submittedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString(),
    reviewedBy: r.reviewedBy ?? undefined,
    reviewComment: r.reviewComment ?? undefined,
  };
}

// managerId ne désigne pas un User mais l'Employee.id du manager (voir
// Employee.managerId) — c'est ce que le frontend envoie déjà (LeavesListPage
// passe user.employeeId comme managerId pour "mon équipe").
async function isInTeam(employeeId: string, managerId: string): Promise<boolean> {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, managerId } });
  return !!employee;
}

// Un manager (leaves:read_team sans leaves:write) ne voit/n'agit que sur son
// équipe directe ; un salarié self-service (self:leaves) ne voit/n'agit que
// sur ses propres demandes ; RH/admin (leaves:write) ont accès à toute
// l'entreprise. Ce triage reproduit ce que le frontend envoyait déjà comme
// filtres (employeeId/managerId) mais en le faisant respecter côté serveur —
// jusqu'ici rien n'était vérifié puisque le module entier était mocké.
function requireLeavesReadScope(req: import('express').Request): { employeeId?: string; managerId?: string } {
  const user = req.user!;
  if (hasPermission(user.role, 'leaves:write') || hasPermission(user.role, 'leaves:read')) {
    if (!hasPermission(user.role, 'leaves:write')) {
      // leaves:read seul (manager) : équipe uniquement, quoi que le client envoie.
      if (!user.employeeId) throw new ForbiddenError();
      return { managerId: user.employeeId };
    }
    return {};
  }
  if (hasPermission(user.role, 'self:leaves')) {
    if (!user.employeeId) throw new ForbiddenError();
    return { employeeId: user.employeeId };
  }
  throw new ForbiddenError();
}

const leaveTypeSchema = z.enum([
  'conge_paye',
  'maladie',
  'sans_solde',
  'evenement_familial',
  'maternite',
  'paternite',
  'recuperation',
]);
const leaveStatusSchema = z.enum(['en_attente', 'valide', 'refuse', 'annule']);

leavesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = requireLeavesReadScope(req);
    const companyId = req.user!.companyId;
    const status = typeof req.query.status === 'string' ? leaveStatusSchema.parse(req.query.status) : undefined;
    // employeeId de la query n'est honoré que si le scope n'impose rien
    // (leaves:write) — sinon la portée forcée (self ou équipe) prime toujours.
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let employeeIdFilter: string | { in: string[] } | undefined;
    if (scope.employeeId) {
      employeeIdFilter = scope.employeeId;
    } else if (scope.managerId) {
      const team = await prisma.employee.findMany({ where: { managerId: scope.managerId }, select: { id: true } });
      employeeIdFilter = { in: team.map((e) => e.id) };
    } else {
      employeeIdFilter = queryEmployeeId;
    }

    const requests = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(requests.map(toLeaveRequestDTO));
  })
);

leavesRouter.get(
  '/balance',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let employeeId: string | undefined;
    if (hasPermission(user.role, 'leaves:read') || hasPermission(user.role, 'leaves:write')) {
      employeeId = queryEmployeeId ?? user.employeeId;
    } else if (hasPermission(user.role, 'self:leaves')) {
      if (!user.employeeId) throw new ForbiddenError();
      employeeId = user.employeeId;
    } else {
      throw new ForbiddenError();
    }
    if (!employeeId) return res.json([]);

    const balances = await prisma.leaveBalance.findMany({
      where: { companyId: user.companyId, employeeId },
      orderBy: [{ year: 'desc' }, { type: 'asc' }],
    });
    res.json(
      balances.map((b) => ({
        employeeId: b.employeeId,
        year: b.year,
        type: b.type,
        acquired: b.acquired,
        taken: b.taken,
        remaining: b.remaining,
        pending: b.pending,
      }))
    );
  })
);

// Compteur de congés payés (acquis / en cours d'acquisition / utilisé),
// calculé à la volée depuis Employee.hireDate plutôt que stocké : ce n'est
// pas un type de congé géré manuellement comme les autres (maladie,
// sans_solde, ...), c'est une acquisition mensuelle automatique — le stocker
// obligerait à le recalculer/synchroniser à chaque mois, source de dérive.
leavesRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let employeeId: string | undefined;
    if (hasPermission(user.role, 'leaves:read') || hasPermission(user.role, 'leaves:write')) {
      employeeId = queryEmployeeId ?? user.employeeId;
    } else if (hasPermission(user.role, 'self:leaves')) {
      if (!user.employeeId) throw new ForbiddenError();
      employeeId = user.employeeId;
    } else {
      throw new ForbiddenError();
    }
    if (!employeeId) throw new NotFoundError('employeeId requis');

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId } });
    if (!employee) throw new NotFoundError(`Employé ${employeeId} introuvable`);

    const { acquired, accruing } = computeCongePayeAccrual(employee.hireDate);

    const takenAgg = await prisma.leaveRequest.aggregate({
      where: { employeeId, type: 'conge_paye', status: 'valide' },
      _sum: { daysCount: true },
    });
    const taken = takenAgg._sum.daysCount ?? 0;

    res.json({
      employeeId,
      acquired,
      accruing,
      taken,
      remaining: Math.max(0, acquired - taken),
    });
  })
);

// Vue RH : le compteur congés payés de tout l'effectif (ou de l'équipe pour
// un manager sans leaves:write) en une seule requête, pour le suivi des
// soldes — pas de N+1 : un seul groupBy pour les jours pris, le calcul
// d'acquisition étant une simple fonction pure appliquée en mémoire.
leavesRouter.get(
  '/dashboard-all',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    let employeeWhere: Prisma.EmployeeWhereInput;
    if (hasPermission(user.role, 'leaves:write')) {
      employeeWhere = { companyId: user.companyId };
    } else if (hasPermission(user.role, 'leaves:read')) {
      if (!user.employeeId) throw new ForbiddenError();
      employeeWhere = { companyId: user.companyId, managerId: user.employeeId };
    } else {
      throw new ForbiddenError();
    }

    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    if (departmentId) employeeWhere = { ...employeeWhere, departmentId };

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, hireDate: true },
    });
    const employeeIds = employees.map((e) => e.id);

    const takenRows = await prisma.leaveRequest.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: employeeIds }, type: 'conge_paye', status: 'valide' },
      _sum: { daysCount: true },
    });
    const takenMap = new Map(takenRows.map((r) => [r.employeeId, r._sum.daysCount ?? 0]));

    res.json(
      employees.map((e) => {
        const { acquired, accruing } = computeCongePayeAccrual(e.hireDate);
        const taken = takenMap.get(e.id) ?? 0;
        return { employeeId: e.id, acquired, accruing, taken, remaining: Math.max(0, acquired - taken) };
      })
    );
  })
);

leavesRouter.get(
  '/team-calendar',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const queryManagerId = typeof req.query.managerId === 'string' ? req.query.managerId : undefined;
    let managerId: string | undefined;
    if (hasPermission(user.role, 'leaves:write')) {
      managerId = queryManagerId;
    } else if (hasPermission(user.role, 'leaves:read')) {
      if (!user.employeeId) throw new ForbiddenError();
      managerId = user.employeeId;
    } else {
      throw new ForbiddenError();
    }
    if (!managerId) return res.json([]);

    const teamEmployeeIds = (
      await prisma.employee.findMany({ where: { managerId }, select: { id: true } })
    ).map((e) => e.id);

    const requests = await prisma.leaveRequest.findMany({
      where: { companyId: user.companyId, status: 'valide', employeeId: { in: teamEmployeeIds } },
    });
    res.json(requests.map(toLeaveRequestDTO));
  })
);

leavesRouter.get(
  '/department-calendar',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!hasPermission(user.role, 'leaves:read') && !hasPermission(user.role, 'leaves:write')) {
      throw new ForbiddenError();
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    if (!month) throw new NotFoundError('Paramètre month requis');
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;

    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    const employeeIds = departmentId
      ? (await prisma.employee.findMany({ where: { companyId: user.companyId, departmentId }, select: { id: true } })).map(
          (e) => e.id
        )
      : undefined;

    const requests = await prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        status: 'valide',
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });
    res.json(requests.map(toLeaveRequestDTO));
  })
);

leavesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const request = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);

    const allowed =
      hasPermission(user.role, 'leaves:write') ||
      (hasPermission(user.role, 'leaves:read') && !!user.employeeId && (await isInTeam(request.employeeId, user.employeeId))) ||
      (hasPermission(user.role, 'self:leaves') && request.employeeId === user.employeeId);
    if (!allowed) throw new ForbiddenError();

    res.json(toLeaveRequestDTO(request));
  })
);

const createLeaveSchema = z.object({
  employeeId: z.string(),
  type: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  channel: z.enum(['portail', 'whatsapp']).optional(),
});

leavesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = createLeaveSchema.parse(req.body);

    let employeeId = body.employeeId;
    if (hasPermission(user.role, 'leaves:write')) {
      // RH peut soumettre pour n'importe quel employé de l'entreprise.
    } else if (hasPermission(user.role, 'self:leaves')) {
      if (!user.employeeId) throw new ForbiddenError();
      employeeId = user.employeeId; // ignore toute valeur usurpée dans le body
    } else {
      throw new ForbiddenError();
    }

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId } });
    if (!employee) throw new NotFoundError(`Employé ${employeeId} introuvable`);

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

    const request = await createLeaveRequestRecord({
      companyId: user.companyId,
      employeeId,
      type: body.type,
      startDate,
      endDate,
      daysCount,
      reason: body.reason,
      channel: body.channel ?? 'portail',
    });

    res.status(201).json(toLeaveRequestDTO(request));
  })
);

const reviewSchema = z.object({ comment: z.string().optional() });

leavesRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!hasPermission(user.role, 'leaves:approve')) throw new ForbiddenError();
    const body = reviewSchema.parse(req.body);

    const request = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);
    if (!hasPermission(user.role, 'leaves:write')) {
      if (!user.employeeId || !(await isInTeam(request.employeeId, user.employeeId))) throw new ForbiddenError();
    }

    const [updated] = await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id: request.id },
        data: { status: 'valide', reviewedAt: new Date(), reviewedBy: user.email, reviewComment: body.comment },
      }),
      prisma.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year: request.startDate.getUTCFullYear(), type: request.type },
        data: { taken: { increment: request.daysCount }, pending: { decrement: request.daysCount } },
      }),
    ]);

    res.json(toLeaveRequestDTO(updated));
  })
);

const refuseSchema = z.object({ comment: z.string().min(1) });

leavesRouter.post(
  '/:id/refuse',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!hasPermission(user.role, 'leaves:approve')) throw new ForbiddenError();
    const body = refuseSchema.parse(req.body);

    const request = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);
    if (!hasPermission(user.role, 'leaves:write')) {
      if (!user.employeeId || !(await isInTeam(request.employeeId, user.employeeId))) throw new ForbiddenError();
    }

    const [updated] = await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id: request.id },
        data: { status: 'refuse', reviewedAt: new Date(), reviewedBy: user.email, reviewComment: body.comment },
      }),
      prisma.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year: request.startDate.getUTCFullYear(), type: request.type },
        data: { pending: { decrement: request.daysCount } },
      }),
    ]);

    res.json(toLeaveRequestDTO(updated));
  })
);

leavesRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const request = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);

    const isOwner = hasPermission(user.role, 'self:leaves') && request.employeeId === user.employeeId;
    if (!hasPermission(user.role, 'leaves:write') && !isOwner) throw new ForbiddenError();

    const [updated] = await prisma.$transaction([
      prisma.leaveRequest.update({ where: { id: request.id }, data: { status: 'annule' } }),
      prisma.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, year: request.startDate.getUTCFullYear(), type: request.type },
        data: { pending: { decrement: request.daysCount } },
      }),
    ]);

    res.json(toLeaveRequestDTO(updated));
  })
);
