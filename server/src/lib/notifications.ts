import { NotificationType } from '@prisma/client';
import { prisma } from './prisma.js';

interface NotifyParams {
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function notifyUser(params: NotifyParams & { userId: string }): Promise<void> {
  await prisma.notification.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });
}

// Résout un Employee.id vers son compte de connexion — pas de compte,
// pas de notification, silencieusement (même sémantique que l'ancien mock
// MOCK_USERS.find(u => u.employeeId === employeeId)) : un employé sans
// compte portail (créé avant l'auto-provisionnement, ou dont l'e-mail était
// déjà pris — voir employees.routes.ts) ne doit jamais faire échouer
// l'action qui déclenche la notification.
export async function notifyEmployee(params: NotifyParams & { employeeId: string }): Promise<void> {
  const user = await prisma.user.findUnique({ where: { employeeId: params.employeeId } });
  if (!user) return;
  await notifyUser({ ...params, userId: user.id });
}
