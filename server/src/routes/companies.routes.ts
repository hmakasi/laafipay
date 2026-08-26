import path from 'path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, authorize, signToken } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';

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
      password: z.string().min(8),
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

companiesRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { companyName, countryCode, currencyCode, admin } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: admin.email } });
    if (existing) {
      throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée');
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);

    // Pas de `$transaction(async (tx) => ...)` ici : une transaction
    // interactive garde une session ouverte entre deux requêtes, ce que le
    // pooler Supabase (PgBouncer en mode transaction, voir DATABASE_URL)
    // ne supporte pas de façon fiable en prod — ça plantait systématiquement
    // (500 générique) alors que ça marchait en local contre Postgres direct.
    // Deux créations indépendantes à la place : l'id de la société est
    // généré ici pour que la seconde requête n'ait pas besoin du résultat
    // de la première dans la même session.
    const createdCompany = await prisma.company.create({
      data: { name: companyName, countryCode, currencyCode },
    });

    const user = await prisma.user.create({
      data: {
        companyId: createdCompany.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        passwordHash,
        role: 'admin',
      },
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId ?? undefined,
    });

    res.status(201).json({ token, user: toUserDTO(user) });
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
});

const EMPTY_PAYROLL_CONFIG = { activeRubrics: [] as string[], customRubrics: [] as unknown[] };

companiesRouter.get(
  '/payroll-config',
  authenticate,
  asyncHandler(async (req, res) => {
    const config = await prisma.payrollConfig.findUnique({ where: { companyId: req.user!.companyId } });
    res.json(
      config ? { activeRubrics: config.activeRubrics, customRubrics: config.customRubrics } : EMPTY_PAYROLL_CONFIG
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
      },
      update: {
        activeRubrics: data.activeRubrics,
        customRubrics: data.customRubrics as any,
      },
    });
    res.json({ activeRubrics: config.activeRubrics, customRubrics: config.customRubrics });
  })
);