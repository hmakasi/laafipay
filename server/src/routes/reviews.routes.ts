import { Router } from 'express';
import { z } from 'zod';
import { PerformanceReview, ReviewCycle } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize, AuthUser } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';
import { notifyEmployee } from '../lib/notifications.js';

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
    selfCompetencyRatings: (r.selfCompetencyRatings as { competency: string; rating: number }[] | null) ?? undefined,
    selfSubmittedAt: r.selfSubmittedAt?.toISOString(),
    managerAssessment: r.managerAssessment ?? undefined,
    managerRating: r.managerRating ?? undefined,
    managerCompetencyRatings:
      (r.managerCompetencyRatings as { competency: string; rating: number }[] | null) ?? undefined,
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

export function canAccessReview(review: PerformanceReview, user: AuthUser): boolean {
  return (
    hasPermission(user.role, 'reviews:write') ||
    (hasPermission(user.role, 'reviews:manage_team') && review.managerId === user.employeeId) ||
    (hasPermission(user.role, 'self:reviews') && review.employeeId === user.employeeId)
  );
}

export function canManageAsManager(review: PerformanceReview, user: AuthUser): boolean {
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

    // Un envoi par employé (son propre entretien à commencer) + un envoi par
    // manager distinct (ses entretiens d'équipe à traiter) — pas de doublon
    // si le manager est lui-même dans la liste des employés du cycle, ce
    // sont deux notifications différentes (self vs équipe).
    await Promise.all(employees.map((e) =>
      notifyEmployee({
        companyId: user.companyId,
        employeeId: e.id,
        type: 'entretien_ouvert',
        title: 'Entretien annuel disponible',
        message: `Le cycle "${cycle.name}" est ouvert — votre entretien annuel vous attend.`,
        link: '/self',
      })
    ));
    const managerIds = [...new Set(employees.map((e) => e.managerId).filter((id): id is string => !!id))];
    await Promise.all(managerIds.map((managerId) =>
      notifyEmployee({
        companyId: user.companyId,
        employeeId: managerId,
        type: 'entretien_ouvert',
        title: 'Entretiens d\'équipe à traiter',
        message: `Le cycle "${cycle.name}" est ouvert — des entretiens de votre équipe vous attendent.`,
        link: `/reviews/${cycle.id}`,
      })
    ));

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

// Agrégation en mémoire plutôt qu'un groupBy Prisma : le volume par cycle
// (un PerformanceReview par employé) reste trop faible pour le justifier.
// Réservé RH/manager (reviews:read/write/manage_team) — pas de sens pour un
// simple self:reviews de voir des stats "de cycle" sur son propre entretien.
reviewsRouter.get(
  '/cycles/:id/stats',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const scope = requireReviewsReadScope(user);
    if (scope.employeeId) throw new ForbiddenError();

    const cycle = await prisma.reviewCycle.findFirst({ where: { id: req.params.id, companyId: user.companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);

    const reviews = await prisma.performanceReview.findMany({
      where: { cycleId: cycle.id, ...(scope.managerId ? { managerId: scope.managerId } : {}) },
      include: { employee: { select: { departmentId: true } } },
    });

    const total = reviews.length;
    const completed = reviews.filter((r) => r.status === 'termine').length;
    const inProgress = reviews.filter((r) => r.status === 'en_cours').length;
    const notStarted = reviews.filter((r) => r.status === 'planifie').length;

    const selfRatings = reviews.map((r) => r.selfRating).filter((r): r is number => r != null);
    const managerRatings = reviews.map((r) => r.managerRating).filter((r): r is number => r != null);
    const average = (values: number[]) =>
      values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : undefined;

    const departmentIds = [...new Set(reviews.map((r) => r.employee.departmentId))];
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    });
    const byDepartment = departments.map((d) => {
      const deptReviews = reviews.filter((r) => r.employee.departmentId === d.id);
      return {
        departmentId: d.id,
        name: d.name,
        total: deptReviews.length,
        completed: deptReviews.filter((r) => r.status === 'termine').length,
      };
    });

    res.json({
      total,
      completed,
      inProgress,
      notStarted,
      averageSelfRating: average(selfRatings),
      averageManagerRating: average(managerRatings),
      byDepartment,
    });
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

export async function loadEditableReview(id: string, companyId: string, cycleStatusCheck = true) {
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

const competencyRatingSchema = z.object({
  competency: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

// Moyenne arrondie des notes par compétence — c'est ce qui alimente
// selfRating/managerRating (Int), la note globale conservée pour tout ce
// qui la lit déjà (dashboard de cycle, DTO) sans avoir à connaître le détail
// par compétence.
function averageRating(ratings: { rating: number }[]): number {
  return Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length);
}

const selfAssessmentSchema = z.object({
  objectives: z.string().optional(),
  selfAssessment: z.string().min(1),
  competencyRatings: z.array(competencyRatingSchema).min(1),
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
        selfRating: averageRating(body.competencyRatings),
        selfCompetencyRatings: body.competencyRatings,
        selfSubmittedAt: new Date(),
        status: review.status === 'planifie' ? 'en_cours' : review.status,
      },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });

    if (review.managerId) {
      await notifyEmployee({
        companyId: user.companyId,
        employeeId: review.managerId,
        type: 'entretien_a_completer',
        title: 'Auto-évaluation soumise',
        message: `L'auto-évaluation de ${review.cycle.name} est soumise — à votre tour de compléter l'entretien.`,
        link: `/reviews/${review.cycleId}`,
      });
    }

    res.json(toPerformanceReviewDTO(updated));
  })
);

const managerAssessmentSchema = z.object({
  managerAssessment: z.string().min(1),
  competencyRatings: z.array(competencyRatingSchema).min(1),
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
        managerRating: averageRating(body.competencyRatings),
        managerCompetencyRatings: body.competencyRatings,
        nextObjectives: body.nextObjectives,
        managerSubmittedAt: new Date(),
        status: review.status === 'planifie' ? 'en_cours' : review.status,
      },
      include: { cycle: { select: { name: true, year: true, status: true } } },
    });

    await notifyEmployee({
      companyId: user.companyId,
      employeeId: review.employeeId,
      type: 'entretien_a_completer',
      title: 'Évaluation du manager disponible',
      message: `Votre manager a soumis son évaluation pour ${review.cycle.name}.`,
      link: '/self',
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

    await notifyEmployee({
      companyId: user.companyId,
      employeeId: review.employeeId,
      type: 'entretien_termine',
      title: 'Entretien finalisé',
      message: `Votre entretien annuel pour ${review.cycle.name} est finalisé.`,
      link: '/self',
    });

    res.json(toPerformanceReviewDTO(updated));
  })
);
