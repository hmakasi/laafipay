import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';
import { DEFAULT_COMPETENCIES } from '../lib/reviewCompetencies.js';

export const companiesRouter = Router();

// Stocké sur Vercel Blob (stockage objet, accès public) plutôt que sur
// disque local : le système de fichiers de Vercel est en lecture seule
// hors /tmp, et /tmp n'y est ni servi ni persistant entre invocations —
// un `multer.diskStorage` ne fonctionne donc jamais en production sur ce
// déploiement. En mémoire ici (memoryStorage), le buffer part directement
// vers Blob sans jamais toucher le disque. Même limite non résolue côté
// upload de documents employé (employees.routes.ts).
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.mimetype)) {
      cb(new HttpError(400, 'Format non supporté (PNG, JPG, SVG ou WEBP uniquement)'));
      return;
    }
    cb(null, true);
  },
});

const COUNTRY_CODES = ['BF', 'BJ', 'CD'] as const;
const CURRENCY_CODES = ['XOF', 'CDF', 'USD'] as const;

// Devises acceptées par pays — garde-fou contre une paire countryCode/
// currencyCode incohérente (ex. BF + USD), au-delà de ce qu'un simple enum
// Zod peut vérifier indépendamment sur chaque champ.
const CURRENCIES_BY_COUNTRY: Record<(typeof COUNTRY_CODES)[number], readonly string[]> = {
  BF: ['XOF'],
  BJ: ['XOF'],
  CD: ['CDF', 'USD'],
};

// Payload à plat envoyée par SignupPage.tsx (src/pages/SignupPage.tsx).
const signupSchema = z
  .object({
    companyName: z.string().min(1),
    countryCode: z.enum(COUNTRY_CODES),
    currencyCode: z.enum(CURRENCY_CODES),
    admin: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
    }),
  })
  .refine((data) => CURRENCIES_BY_COUNTRY[data.countryCode].includes(data.currencyCode), {
    message: 'Devise incompatible avec le pays sélectionné',
    path: ['currencyCode'],
  });

function toCompanyDTO(c: any) {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName ?? undefined,
    taxIdNumber: c.ifu ?? undefined,
    rccm: c.rccm ?? undefined,
    address: c.address ?? undefined,
    postalCode: c.postalCode ?? undefined,
    city: c.city ?? undefined,
    activityCode: c.activityCode ?? undefined,
    collectiveAgreement: c.collectiveAgreement ?? undefined,
    countryCode: c.countryCode,
    currencyCode: c.currencyCode,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    socialSecurityNumber: c.cnssNumber ?? undefined,
    logo: c.logo ?? undefined,
  };
}

// Plus de création immédiate de compte : la demande est mise en attente
// (SignupRequest), sans mot de passe choisi par le demandeur — voir
// routes/admin.routes.ts pour l'approbation par un admin LaafiPay, qui
// génère le mot de passe et crée réellement l'entreprise + l'utilisateur.
companiesRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { companyName, countryCode, currencyCode, admin } = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: admin.email } });
    if (existingUser) {
      throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée');
    }
    const existingRequest = await prisma.signupRequest.findFirst({
      where: { email: admin.email, status: 'en_attente' },
    });
    if (existingRequest) {
      throw new HttpError(409, 'Une demande est déjà en attente pour cette adresse e-mail');
    }

    await prisma.signupRequest.create({
      data: {
        companyName,
        countryCode,
        currencyCode,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
      },
    });

    res.status(201).json({ status: 'en_attente' });
  })
);

companiesRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } });
    if (!company) throw new NotFoundError('Entreprise introuvable');
    res.json(toCompanyDTO(company));
  })
);

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional(),
  taxIdNumber: z.string().optional(),
  rccm: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  activityCode: z.string().optional(),
  collectiveAgreement: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  socialSecurityNumber: z.string().optional(),
  logo: z.string().optional(),
});

companiesRouter.patch(
  '/me',
  authenticate,
  authorize('settings:write'),
  asyncHandler(async (req, res) => {
    const { taxIdNumber, socialSecurityNumber, ...rest } = updateCompanySchema.parse(req.body);
    const company = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: { ...rest, ifu: taxIdNumber, cnssNumber: socialSecurityNumber },
    });
    res.json(toCompanyDTO(company));
  })
);

companiesRouter.post(
  '/me/logo',
  authenticate,
  authorize('settings:write'),
  logoUpload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Fichier logo manquant');
    const ext = path.extname(req.file.originalname) || '.png';
    const blob = await put(`logos/${req.user!.companyId}-${Date.now()}${ext}`, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    const company = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: { logo: blob.url },
    });
    res.json(toCompanyDTO(company));
  })
);

const customRubricSchema = z.object({
  label: z.string().min(1),
  taxable: z.boolean(),
  cnssContributable: z.boolean(),
});

const payrollConfigSchema = z.object({
  activeRubrics: z.array(z.string()),
  customRubrics: z.array(customRubricSchema),
  // Optionnel : un appelant qui ne l'envoie pas ne réinitialise pas la
  // valeur existante en base (voir upsert ci-dessous) — cohérent avec le
  // fait que ce champ a été ajouté après coup, sans écran dédié encore.
  maxAdvancePercent: z.number().min(0).max(100).optional(),
});

const EMPTY_PAYROLL_CONFIG = { activeRubrics: [] as string[], customRubrics: [] as unknown[], maxAdvancePercent: 30 };

companiesRouter.get(
  '/payroll-config',
  authenticate,
  asyncHandler(async (req, res) => {
    const config = await prisma.payrollConfig.findUnique({ where: { companyId: req.user!.companyId } });
    res.json(
      config
        ? {
            activeRubrics: config.activeRubrics,
            customRubrics: config.customRubrics,
            maxAdvancePercent: config.maxAdvancePercent,
          }
        : EMPTY_PAYROLL_CONFIG
    );
  })
);

companiesRouter.put(
  '/payroll-config',
  authenticate,
  authorize('settings:write'),
  asyncHandler(async (req, res) => {
    const data = payrollConfigSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const config = await prisma.payrollConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        activeRubrics: data.activeRubrics,
        customRubrics: data.customRubrics as any,
        ...(data.maxAdvancePercent !== undefined ? { maxAdvancePercent: data.maxAdvancePercent } : {}),
      },
      update: {
        activeRubrics: data.activeRubrics,
        customRubrics: data.customRubrics as any,
        ...(data.maxAdvancePercent !== undefined ? { maxAdvancePercent: data.maxAdvancePercent } : {}),
      },
    });
    res.json({
      activeRubrics: config.activeRubrics,
      customRubrics: config.customRubrics,
      maxAdvancePercent: config.maxAdvancePercent,
    });
  })
);

// Compétences évaluées lors des entretiens annuels (ReviewCompetenciesSetupPage.tsx) —
// même forme que /payroll-config : upsert, liste par défaut tant que rien n'est enregistré.
const reviewConfigSchema = z.object({ competencies: z.array(z.string().min(1)).min(1) });

companiesRouter.get(
  '/review-config',
  authenticate,
  asyncHandler(async (req, res) => {
    const config = await prisma.reviewConfig.findUnique({ where: { companyId: req.user!.companyId } });
    res.json({ competencies: config ? (config.competencies as string[]) : DEFAULT_COMPETENCIES });
  })
);

companiesRouter.put(
  '/review-config',
  authenticate,
  authorize('reviews:write'),
  asyncHandler(async (req, res) => {
    const data = reviewConfigSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const config = await prisma.reviewConfig.upsert({
      where: { companyId },
      create: { companyId, competencies: data.competencies },
      update: { competencies: data.competencies },
    });
    res.json({ competencies: config.competencies as string[] });
  })
);