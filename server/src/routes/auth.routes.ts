import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { UnauthorizedError } from '../lib/errors.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email }, include: { company: { select: { archivedAt: true } } } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('E-mail ou mot de passe incorrect');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('E-mail ou mot de passe incorrect');
    }

    // Vérifié après le mot de passe, pas avant : ne pas laisser un
    // attaquant qui ne connaît pas le mot de passe apprendre qu'une
    // entreprise est archivée.
    if (user.company.archivedAt) {
      throw new UnauthorizedError('Ce compte est archivé. Contactez LaafiPay pour le réactiver.');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId ?? undefined,
    });

    res.json({ token, user: toUserDTO(user) });
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new UnauthorizedError();
    res.json(toUserDTO(user));
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Utile en particulier après une première connexion avec le mot de passe
// temporaire généré à l'approbation d'une demande d'inscription (voir
// routes/admin.routes.ts) — currentPassword exigé même ici, pas de
// contournement pour "premier changement".
authRouter.patch(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new UnauthorizedError();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Mot de passe actuel incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.status(204).send();
  })
);
