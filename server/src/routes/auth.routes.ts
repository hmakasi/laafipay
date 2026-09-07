import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { UnauthorizedError, HttpError } from '../lib/errors.js';
import { sendPasswordResetEmail } from '../lib/email.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// Répond toujours 200 avec le même message, que le compte existe, soit
// désactivé, ou reçoive bien l'e-mail — sinon la réponse elle-même
// permettrait à un attaquant de tester quels e-mails ont un compte
// LaafiPay (anti-énumération). Pour la même raison, on n'attend PAS la fin
// de l'envoi (appel réseau vers Resend) avant de répondre : sinon la
// latence de réponse elle-même distinguerait un compte existant d'un
// compte inexistant, même avec un corps de réponse identique.
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      const rawToken = randomBytes(32).toString('hex');
      const resetTokenHash = createHash('sha256').update(rawToken).digest('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      sendPasswordResetEmail(user.email, {
        firstName: user.firstName,
        resetUrl: `https://laafipay.com/reset-password/${rawToken}`,
      }).then((result) => {
        if (!result.ok) console.error("[auth] échec de l'envoi de l'e-mail reset password", result.error);
      });
    }

    res.json({ message: 'Si un compte existe avec cet e-mail, un lien de réinitialisation vient de lui être envoyé.' });
  })
);

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const resetTokenHash = createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({ where: { resetTokenHash } });
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new HttpError(400, 'Lien de réinitialisation invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, resetTokenHash: null, resetTokenExpiresAt: null },
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
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
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    res.json(toUserDTO(updated));
  })
);
