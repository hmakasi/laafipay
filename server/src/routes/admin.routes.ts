import { Router } from 'express';
import { z } from 'zod';
import { CountryCode, CurrencyCode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../lib/platformAdmin.js';
import { generatePassword } from '../lib/password.js';
import { sendAccountCredentialsEmail } from '../lib/email.js';
import { HttpError, NotFoundError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();
adminRouter.use(authenticate, requirePlatformAdmin);

// ── File d'attente des demandes de création d'entreprise ─────────
// Réservé à l'équipe LaafiPay (voir lib/platformAdmin.ts) — pas scopé à
// une companyId comme le reste de l'app, volontairement : ces demandes
// n'appartiennent encore à aucune entreprise.
adminRouter.get(
  '/signup-requests',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const requests = await prisma.signupRequest.findMany({
      where: status ? { status: status as 'en_attente' | 'approuve' | 'rejete' } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      requests.map((r) => ({
        id: r.id,
        companyName: r.companyName,
        countryCode: r.countryCode,
        currencyCode: r.currencyCode,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString(),
        reviewedBy: r.reviewedBy ?? undefined,
        rejectionReason: r.rejectionReason ?? undefined,
      }))
    );
  })
);

// Génère le mot de passe, crée réellement l'entreprise + l'utilisateur
// admin (jamais avant cette étape), puis envoie les identifiants par
// e-mail. L'approbation reste valide même si l'e-mail échoue — voir
// email.ts : le mot de passe temporaire est alors renvoyé dans la
// réponse (jamais sinon) pour que l'admin puisse le transmettre
// manuellement plutôt que de perdre l'accès au compte créé.
adminRouter.post(
  '/signup-requests/:id/approve',
  asyncHandler(async (req, res) => {
    const request = await prisma.signupRequest.findUnique({ where: { id: req.params.id } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);
    if (request.status !== 'en_attente') throw new HttpError(409, 'Cette demande a déjà été traitée');

    const existingUser = await prisma.user.findUnique({ where: { email: request.email } });
    if (existingUser) throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée par un autre compte');

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const createdCompany = await prisma.company.create({
      data: {
        name: request.companyName,
        countryCode: request.countryCode as CountryCode,
        currencyCode: request.currencyCode as CurrencyCode,
      },
    });
    const createdUser = await prisma.user.create({
      data: {
        companyId: createdCompany.id,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        passwordHash,
        role: 'admin',
      },
    });

    const emailResult = await sendAccountCredentialsEmail(request.email, {
      firstName: request.firstName,
      companyName: request.companyName,
      password,
    });

    await prisma.signupRequest.update({
      where: { id: request.id },
      data: {
        status: 'approuve',
        reviewedAt: new Date(),
        reviewedBy: req.user!.email,
        createdCompanyId: createdCompany.id,
        createdUserId: createdUser.id,
      },
    });

    res.json({
      status: 'approuve',
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? undefined : emailResult.error,
      temporaryPassword: emailResult.ok ? undefined : password,
    });
  })
);

const rejectSchema = z.object({ reason: z.string().optional() });

adminRouter.post(
  '/signup-requests/:id/reject',
  asyncHandler(async (req, res) => {
    const { reason } = rejectSchema.parse(req.body ?? {});
    const request = await prisma.signupRequest.findUnique({ where: { id: req.params.id } });
    if (!request) throw new NotFoundError(`Demande ${req.params.id} introuvable`);
    if (request.status !== 'en_attente') throw new HttpError(409, 'Cette demande a déjà été traitée');

    await prisma.signupRequest.update({
      where: { id: request.id },
      data: { status: 'rejete', reviewedAt: new Date(), reviewedBy: req.user!.email, rejectionReason: reason },
    });

    res.status(204).send();
  })
);
