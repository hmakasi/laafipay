import { Router } from 'express';
import { z } from 'zod';
import { CountryCode, CurrencyCode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { isPlatformAdminEmail, requirePlatformAdmin } from '../lib/platformAdmin.js';
import { generatePassword } from '../lib/password.js';
import { sendAccountCredentialsEmail } from '../lib/email.js';
import { HttpError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();

// ── Amorçage du tout premier admin LaafiPay ──────────────────────
// Cas particulier volontairement en dehors de authenticate/requirePlatformAdmin
// ci-dessous : approuver une demande exige déjà un admin LaafiPay connecté,
// donc le tout premier ne peut pas passer par ce même circuit (œuf et
// poule). Protégé par un secret séparé plutôt que par une session, comme
// /compta/retry-bridge (CRON_SECRET) — et par le même allow-list que le
// reste (isPlatformAdminEmail) : impossible de créer un admin pour une
// adresse qui n'est pas déjà dans PLATFORM_ADMIN_EMAILS. Idempotent :
// si un compte existe déjà pour cet e-mail, renvoie une erreur plutôt que
// d'en créer un second.
const bootstrapSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  countryCode: z.enum(['BF', 'BJ', 'CD']),
  currencyCode: z.enum(['XOF', 'CDF', 'USD']),
});

adminRouter.post(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const secret = process.env.BOOTSTRAP_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedError('Secret de bootstrap invalide ou non configuré');
    }

    const body = bootstrapSchema.parse(req.body);
    if (!isPlatformAdminEmail(body.email)) {
      throw new HttpError(403, "Cette adresse n'est pas dans PLATFORM_ADMIN_EMAILS");
    }
    const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (existingUser) throw new HttpError(409, 'Un compte existe déjà pour cette adresse e-mail');

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: { name: body.companyName, countryCode: body.countryCode, currencyCode: body.currencyCode },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        passwordHash,
        role: 'admin',
      },
    });

    res.status(201).json({ email: body.email, password });
  })
);

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

// ── Entreprises créées ────────────────────────────────────────────
// Vue multi-tenant réservée à l'équipe LaafiPay — le reste de l'app ne
// permet à personne de voir/gérer une entreprise autre que la sienne.
adminRouter.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const archived = req.query.archived === 'true';
    const companies = await prisma.company.findMany({
      where: archived ? { archivedAt: { not: null } } : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        users: { where: { role: 'admin' }, select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { employees: true } },
      },
    });
    res.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        legalName: c.legalName ?? undefined,
        countryCode: c.countryCode,
        currencyCode: c.currencyCode,
        createdAt: c.createdAt.toISOString(),
        archivedAt: c.archivedAt?.toISOString(),
        employeeCount: c._count.employees,
        admins: c.users,
      }))
    );
  })
);

// Champs volontairement limités à name/legalName — countryCode/currencyCode
// exclus ici aussi (même raison que PATCH /companies/me : les rouvrir
// remettrait en cause des paies déjà calculées dans l'ancien pays/l'ancienne
// devise).
const updateCompanyAdminSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional(),
});

adminRouter.patch(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const data = updateCompanyAdminSchema.parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) throw new NotFoundError(`Entreprise ${req.params.id} introuvable`);
    const updated = await prisma.company.update({ where: { id: company.id }, data });
    res.json({ id: updated.id, name: updated.name, legalName: updated.legalName ?? undefined });
  })
);

// Archive plutôt que supprime : les données restent intactes, seule la
// connexion des utilisateurs de cette entreprise est bloquée (voir
// routes/auth.routes.ts) tant qu'elle n'est pas restaurée. C'est
// l'action déclenchée par le bouton "Archiver" de l'onglet "Entreprises
// créées" — DELETE ci-dessous reste un vrai effacement (cascade),
// conservé mais non exposé dans l'UI pour l'instant.
adminRouter.post(
  '/companies/:id/archive',
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) throw new NotFoundError(`Entreprise ${req.params.id} introuvable`);
    if (company.archivedAt) throw new HttpError(409, 'Cette entreprise est déjà archivée');
    await prisma.company.update({ where: { id: company.id }, data: { archivedAt: new Date() } });
    res.status(204).send();
  })
);

adminRouter.post(
  '/companies/:id/restore',
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) throw new NotFoundError(`Entreprise ${req.params.id} introuvable`);
    if (!company.archivedAt) throw new HttpError(409, "Cette entreprise n'est pas archivée");
    await prisma.company.update({ where: { id: company.id }, data: { archivedAt: null } });
    res.status(204).send();
  })
);

// Supprime l'entreprise et tout ce qui en dépend (employés, paies,
// bulletins...) via les `onDelete: Cascade` du schéma — irréversible,
// pas de confirmation supplémentaire côté serveur au-delà de
// requirePlatformAdmin : le frontend doit confirmer avant d'appeler ceci.
// Non exposé dans l'UI pour l'instant, gardé pour un usage ponctuel.
adminRouter.delete(
  '/companies/:id',
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) throw new NotFoundError(`Entreprise ${req.params.id} introuvable`);
    await prisma.company.delete({ where: { id: company.id } });
    res.status(204).send();
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
