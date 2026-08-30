import { Router } from 'express';
import { z } from 'zod';
import { PeerFeedbackRequest } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { notifyEmployee } from '../lib/notifications.js';
import { canAccessReview, canManageAsManager, loadEditableReview } from './reviews.routes.js';

export const peerFeedbackRouter = Router();
peerFeedbackRouter.use(authenticate);

// canRequestPeerFeedback est exactement canAccessReview (write entreprise,
// manage_team sur son équipe, ou self:reviews propriétaire) ; canViewPeerFeedback
// est exactement canManageAsManager (write entreprise, ou manage_team sur son
// équipe) — volontairement sans self:reviews : la personne évaluée n'a pas
// accès au feedback de ses pairs en v1 (candeur du feedback 360°, évite
// l'auto-censure des pairs sollicités).

function toPeerFeedbackDTO(r: PeerFeedbackRequest) {
  return {
    id: r.id,
    reviewId: r.reviewId,
    peerEmployeeId: r.peerEmployeeId,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt.toISOString(),
    feedback: r.feedback ?? undefined,
    rating: r.rating ?? undefined,
    submittedAt: r.submittedAt?.toISOString(),
  };
}

const createRequestSchema = z.object({ peerEmployeeId: z.string() });

peerFeedbackRouter.post(
  '/:reviewId/peer-feedback-requests',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = createRequestSchema.parse(req.body);
    const review = await loadEditableReview(req.params.reviewId, user.companyId);
    if (!canAccessReview(review, user)) throw new ForbiddenError();
    if (body.peerEmployeeId === review.employeeId) {
      throw new HttpError(400, 'Impossible de demander un avis à la personne évaluée elle-même');
    }

    const peer = await prisma.employee.findFirst({ where: { id: body.peerEmployeeId, companyId: user.companyId } });
    if (!peer) throw new NotFoundError(`Employé ${body.peerEmployeeId} introuvable`);

    const existing = await prisma.peerFeedbackRequest.findUnique({
      where: { reviewId_peerEmployeeId: { reviewId: review.id, peerEmployeeId: body.peerEmployeeId } },
    });
    if (existing) throw new HttpError(409, 'Un avis a déjà été demandé à cet employé pour cet entretien');

    const request = await prisma.peerFeedbackRequest.create({
      data: {
        companyId: user.companyId,
        reviewId: review.id,
        peerEmployeeId: body.peerEmployeeId,
        requestedBy: user.email,
      },
    });

    await notifyEmployee({
      companyId: user.companyId,
      employeeId: body.peerEmployeeId,
      type: 'avis_pair_demande',
      title: 'Avis demandé pour un entretien',
      message: `${user.email} vous demande votre avis pour l'entretien annuel d'un collègue.`,
      link: '/self',
    });

    res.status(201).json(toPeerFeedbackDTO(request));
  })
);

peerFeedbackRouter.get(
  '/:reviewId/peer-feedback-requests',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const review = await loadEditableReview(req.params.reviewId, user.companyId, false);
    if (!canManageAsManager(review, user)) throw new ForbiddenError();

    const requests = await prisma.peerFeedbackRequest.findMany({
      where: { reviewId: review.id },
      orderBy: { requestedAt: 'desc' },
    });
    res.json(requests.map(toPeerFeedbackDTO));
  })
);

peerFeedbackRouter.get(
  '/peer-feedback-requests/mine',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) return res.json([]);

    const requests = await prisma.peerFeedbackRequest.findMany({
      where: { peerEmployeeId: user.employeeId },
      include: {
        review: {
          select: {
            employee: { select: { firstName: true, lastName: true } },
            cycle: { select: { name: true, year: true, status: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
    res.json(
      requests.map((r) => ({
        ...toPeerFeedbackDTO(r),
        revieweeName: `${r.review.employee.firstName} ${r.review.employee.lastName}`,
        cycle: { name: r.review.cycle.name, year: r.review.cycle.year, status: r.review.cycle.status },
      }))
    );
  })
);

const submitFeedbackSchema = z.object({
  feedback: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
});

peerFeedbackRouter.post(
  '/peer-feedback-requests/:id/submit',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = submitFeedbackSchema.parse(req.body);

    const request = await prisma.peerFeedbackRequest.findFirst({
      where: { id: req.params.id, companyId: user.companyId },
      include: { review: { include: { cycle: true } } },
    });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);
    if (request.peerEmployeeId !== user.employeeId) throw new ForbiddenError();
    if (request.submittedAt) throw new HttpError(409, 'Cet avis a déjà été soumis');
    if (request.review.cycle.status === 'cloture') {
      throw new HttpError(409, 'Ce cycle est clôturé, impossible de soumettre un avis');
    }

    const updated = await prisma.peerFeedbackRequest.update({
      where: { id: request.id },
      data: { feedback: body.feedback, rating: body.rating, submittedAt: new Date() },
    });

    const requester = await prisma.user.findUnique({ where: { email: request.requestedBy } });
    if (requester?.employeeId) {
      await notifyEmployee({
        companyId: user.companyId,
        employeeId: requester.employeeId,
        type: 'avis_pair_soumis',
        title: 'Avis de pair soumis',
        message: `Un avis demandé pour un entretien a été soumis.`,
        link: `/reviews/${request.review.cycleId}`,
      });
    }
    if (request.review.managerId && request.review.managerId !== requester?.employeeId) {
      await notifyEmployee({
        companyId: user.companyId,
        employeeId: request.review.managerId,
        type: 'avis_pair_soumis',
        title: 'Avis de pair soumis',
        message: `Un avis de pair a été soumis pour un entretien de votre équipe.`,
        link: `/reviews/${request.review.cycleId}`,
      });
    }

    res.json(toPeerFeedbackDTO(updated));
  })
);
