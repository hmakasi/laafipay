import { Router } from 'express';
import { z } from 'zod';
import { PerformanceReview, ReviewCycle } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize, AuthUser } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';

export const reviewsRouter = Router();
reviewsRouter.use(authenticate);

const dateOnly = (d: Date) => d.toISOString().split('T')[0];

function toReviewCycleDTO(c: ReviewCycle) {
  return {
    id: c.id,
    name: c.name,
    year: c.year,
    startDate: dateOnly(c.startDate),
    endDate: dateOnly(c.endDate),
    status: c.status,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
  };
}

function toPerformanceReviewDTO(
  r: PerformanceReview & { cycle: { name: string; year: number; status: ReviewCycle['status'] } }
) {
  return {
    id: r.id,
    cycleId: r.cycleId,
    cycle: { name: r.cycle.name, year: r.cycle.year, status: r.cycle.status },
    employeeId: r.employeeId,
    managerId: r.managerId ?? undefined,
    status: r.status,
    objectives: r.objectives ?? undefined,
    selfAssessment: r.selfAssessment ?? undefined,
    selfRating: r.selfRating ?? undefined,
    selfSubmittedAt: r.selfSubmittedAt?.toISOString(),
    managerAssessment: r.managerAssessment ?? undefined,
    managerRating: r.managerRating ?? undefined,
    nextObjectives: r.nextObjectives ?? undefined,
    managerSubmittedAt: r.managerSubmittedAt?.toISOString(),
    completedAt: r.completedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// reviews:read/reviews:write voient toute l'entreprise ; reviews:manage_team
// (managers, sans reviews:read/write) sont filtrés sur managerId — figé sur
// la ligne elle-même (voir schema.prisma), donc pas besoin d'une requête
// Employee supplémentaire comme isInTeam() dans leaves.routes.ts ;
// self:reviews seul est filtré sur son propre employeeId, jamais celui
// envoyé par le client.
function requireReviewsReadScope(user: AuthUser): { employeeId?: string; managerId?: string } {
  if (hasPermission(user.role, 'reviews:read') || hasPermission(user.role, 'reviews:write')) {
    return {};
  }
  if (hasPermission(user.role, 'reviews:manage_team')) {
    if (!user.employeeId) throw new ForbiddenError();
    return { managerId: user.employeeId };
  }
  if (hasPermission(user.role, 'self:reviews')) {
    if (!user.employeeId) throw new ForbiddenError();
    return { employeeId: user.employeeId };
  }
  throw new ForbiddenError();
}

function canAccessReview(review: PerformanceReview, user: AuthUser): boolean {
  return (
    hasPermission(user.role, 'reviews:write') ||
    (hasPermission(user.role, 'reviews:manage_team') && review.managerId === user.employeeId) ||
    (hasPermission(user.role, 'self:reviews') && review.employeeId === user.employeeId)
  );
}

function canManageAsManager(review: PerformanceReview, user: AuthUser): boolean {
  return (
    hasPermission(user.role, 'reviews:write') ||
    (hasPermission(user.role, 'reviews:manage_team') && review.managerId === user.employeeId)
  );
}

// ── Cycles ───────────────────────────────────────────────────

reviewsRouter.get(
  '/cycles',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (
      !hasPermission(user.role, 'reviews:read') &&
      !hasPermission(user.role, 'reviews:write') &&
      !hasPermission(user.role, 'reviews:manage_team')
    ) {
      throw new ForbiddenError();
    }
    const cycles = await prisma.reviewCycle.findMany({
      where: { companyId: user.companyId },
      orderBy: { year: 'desc' },
    });
    res.json(cycles.map(toReviewCycleDTO));
  })
);

const createCycleSchema = z.object({
  name: z.string().min(1),
  year: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
});

reviewsRouter.post(
  '/cycles',
  authorize('reviews:write'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = createCycleSchema.parse(req.body);
    const cycle = await prisma.reviewCycle.create({
      data: {
        companyId: user.companyId,
        name: body.name,
        year: body.year,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        createdBy: user.email,
      },
    });
    res.status(201).json(toReviewCycleDTO(cycle));
  })
);

reviewsRouter.get(
  '/cycles/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (
      !hasPermission(user.role, 'reviews:read') &&
      !hasPermission(user.role, 'reviews:write') &&
      !hasPermission(user.role, 'reviews:manage_team')
    ) {
      throw new ForbiddenError();
    }
    const cycle = await prisma.reviewCycle.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);
    res.json(toReviewCycleDTO(cycle));
  })
);

// Seed unique à l'ouverture (pas de re-sync continue comme les cycles de
// paie) : un employé embauché après l'ouverture n'aura pas de ligne pour ce
// cycle. managerId figé depuis Employee.managerId à cet instant précis, pour
// que l'entretien ne bouge pas si l'employé change de manager en cours de
// cycle (même logique que LegalSettings figé sur PayrollCycle).
reviewsRouter.post(
  '/cycles/:id/open',
  authorize('reviews:write'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const cycle = await prisma.reviewCycle.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);
    if (cycle.status !== 'brouillon') throw new HttpError(409, 'Ce cycle a déjà été ouvert');

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'actif' },
      select: { id: true, managerId: true },
    });

    const [, updated] = await prisma.$transaction([
      prisma.performanceReview.createMany({
        data: employees.map((e) => ({
          companyId: user.companyId,
          cycleId: cycle.id,
          employeeId: e.id,
          managerId: e.managerId,
        })),
      }),
      prisma.reviewCycle.update({ where: { id: cycle.id }, data: { status: 'ouvert' } }),
    ]);

    res.json(toReviewCycleDTO(updated));
  })
);

reviewsRouter.post(
  '/cycles/:id/close',
  authorize('reviews:write'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const cycle = await prisma.reviewCycle.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);
    if (cycle.status !== 'ouvert') throw new HttpError(409, 'Seul un cycle ouvert peut être clôturé');

    const incompleteCount = await prisma.performanceReview.count({
      where: { cycleId: cycle.id, status: { not: 'termine' } },
    });

    const updated = await prisma.reviewCycle.update({ where: { id: cycle.id }, data: { status: 'cloture' } });
    res.json({ ...toReviewCycleDTO(updated), incompleteCount });
  })
);

// ── Entretiens ───────────────────────────────────────────────

const reviewStatusSchema = z.enum(['planifie', 'en_cours', 'termine']);

reviewsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const scope = requireReviewsReadScope(user);
    const cycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId : undefined;
    const status = typeof req.query.status === 'string' ? reviewStatusSchema.parse(req.query.status) : undefined;
    // employeeId de la query n'est honoré que si le scope n'impose rien
    // (reviews:read/write) — sinon la portée forcée (self ou équipe) prime.
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    let employeeIdFilter: string | undefined;
    if (scope.employeeId) {
      employeeIdFilter = scope.employeeId;
    } else if (!scope.managerId) {
      employeeIdFilter = queryEmployeeId;
    }

    const reviews = await prisma.performanceReview.findMany({
      where: {
        companyId: user.companyId,
        ...(cycleId ? { cycleId } : {}),
        ...(status ? { status } : {}),
        ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
        ...(scope.managerId ? { managerId: scope.managerId } : {}),
      },
      include: { cycle: { select: { name: true, year: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews.map(toPerformanceReviewDTO));
  })
);

reviewsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const review = await prisma.performanceReview.findFirst({
      where: { id: req.params.id, companyId: user.companyId },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });
    if (!review) throw new NotFoundError(`Entretien ${req.params.id} introuvable`);
    if (!canAccessReview(review, user)) throw new ForbiddenError();
    res.json(toPerformanceReviewDTO(review));
  })
);

async function loadEditableReview(id: string, companyId: string, cycleStatusCheck = true) {
  const review = await prisma.performanceReview.findFirst({
    where: { id, companyId },
    include: { cycle: true },
  });
  if (!review) throw new NotFoundError(`Entretien ${id} introuvable`);
  if (cycleStatusCheck && review.cycle.status === 'cloture') {
    throw new HttpError(409, 'Ce cycle est clôturé, impossible de modifier cet entretien');
  }
  return review;
}

const selfAssessmentSchema = z.object({
  objectives: z.string().optional(),
  selfAssessment: z.string().min(1),
  selfRating: z.number().int().min(1).max(5),
});

reviewsRouter.post(
  '/:id/self-assessment',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!hasPermission(user.role, 'self:reviews')) throw new ForbiddenError();
    const body = selfAssessmentSchema.parse(req.body);

    const review = await loadEditableReview(req.params.id, user.companyId);
    if (review.employeeId !== user.employeeId) throw new ForbiddenError();
    // Verrouillé une fois que le manager a soumis sa partie, pour ne pas
    // modifier l'auto-évaluation sous les yeux d'une évaluation déjà rendue.
    if (review.managerSubmittedAt) throw new HttpError(409, "Le manager a déjà soumis son évaluation, l'auto-évaluation est verrouillée");

    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        objectives: body.objectives,
        selfAssessment: body.selfAssessment,
        selfRating: body.selfRating,
        selfSubmittedAt: new Date(),
        status: review.status === 'planifie' ? 'en_cours' : review.status,
      },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });
    res.json(toPerformanceReviewDTO(updated));
  })
);

const managerAssessmentSchema = z.object({
  managerAssessment: z.string().min(1),
  managerRating: z.number().int().min(1).max(5),
  nextObjectives: z.string().optional(),
});

reviewsRouter.post(
  '/:id/manager-assessment',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = managerAssessmentSchema.parse(req.body);

    const review = await loadEditableReview(req.params.id, user.companyId);
    if (!canManageAsManager(review, user)) throw new ForbiddenError();

    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        managerAssessment: body.managerAssessment,
        managerRating: body.managerRating,
        nextObjectives: body.nextObjectives,
        managerSubmittedAt: new Date(),
        status: review.status === 'planifie' ? 'en_cours' : review.status,
      },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });
    res.json(toPerformanceReviewDTO(updated));
  })
);

reviewsRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const review = await loadEditableReview(req.params.id, user.companyId);
    if (!canManageAsManager(review, user)) throw new ForbiddenError();
    if (!review.selfSubmittedAt || !review.managerSubmittedAt) {
      throw new HttpError(400, "L'auto-évaluation et l'évaluation du manager doivent être soumises avant de clôturer l'entretien");
    }

    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: { status: 'termine', completedAt: new Date() },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });
    res.json(toPerformanceReviewDTO(updated));
  })
);
