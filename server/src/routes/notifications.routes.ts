import { Router } from 'express';
import { Notification } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

function toNotificationDTO(n: Notification) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? undefined,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

// Pas de POST ici — la création passe exclusivement par lib/notifications.ts,
// appelé côté serveur depuis d'autres routes juste après une mutation
// réussie (voir leaves.routes.ts, reviews.routes.ts) : jamais à la demande
// d'un client.
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications.map(toNotificationDTO));
  })
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) throw new NotFoundError(`Notification ${req.params.id} introuvable`);
    if (notification.userId !== req.user!.id) throw new ForbiddenError();

    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
    res.json(toNotificationDTO(updated));
  })
);

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.status(204).send();
  })
);
