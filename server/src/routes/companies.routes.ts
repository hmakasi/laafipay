import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, authorize, signToken } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';

export const companiesRouter = Router();

// Écrit directement dans le dossier que `app.use('/uploads', express.static('uploads'))`
// sert réellement — contrairement à l'upload de documents employé
// (employees.routes.ts), qui écrit dans os.tmpdir() alors qu'Express sert
// depuis ./uploads : ses URLs renvoyées sont des liens morts, y compris en
// local. Ici le fichier est immédiatement accessible à l'URL renvoyée.
// ⚠️ Ne fonctionnera pas sur le déploiement Vercel actuel : le système de
// fichiers y est en lecture seule hors /tmp, et /tmp n'y est ni servi ni
// persistant entre invocations. Un vrai stockage objet (Supabase Storage,
// Vercel Blob...) sera nécessaire avant la mise en production de cette
// fonctionnalité — même limite que les documents employé, non résolue ici.
const LOGO_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'logos');
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
    cb(null, LOGO_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${req.user!.companyId}-${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
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
    // ifu/cnssNumber (colonnes DB historiques, nommées avant le moteur
    // multi-pays) exposées sous leur nom générique côté API — c.types/index.ts
    // Company.taxIdNumber / socialSecurityNumber, jamais ifu/cnssNumber.
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

    const user = await prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: { name: companyName, countryCode, currencyCode },
      });
      return tx.user.create({
        data: {
          companyId: createdCompany.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          passwordHash,
          role: 'admin',
        },
      });
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
  // Pas de authorize('settings:read') ici : le nom/pays/devise de l'entreprise
  // n'est pas une donnée de réglage privilégiée, c'est un contexte d'affichage
  // dont TOUS les rôles ont besoin (ex. formater les montants du tableau de
  // bord dans la bonne devise). Seule la modification (PATCH ci-dessous) doit
  // rester réservée à settings:write.
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } });
    if (!company) throw new NotFoundError('Entreprise introuvable');
    res.json(toCompanyDTO(company));
  })
);

// Noms de champs alignés sur l'API (taxIdNumber/socialSecurityNumber), pas
// sur les colonnes DB historiques (ifu/cnssNumber) — voir toCompanyDTO.
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
  // countryCode/currencyCode volontairement absents ici : les changer après
  // coup rouvrirait la question des paies déjà calculées dans l'ancienne
  // devise/juridiction — hors périmètre de cette mise à jour de profil.
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
    const logo = `/uploads/logos/${req.file.filename}`;
    const company = await prisma.company.update({
      where: { id: req.user!.companyId },
      data: { logo },
    });
    res.json(toCompanyDTO(company));
  })
);

// Rubriques de bulletin (PayrollComponentsSetup.tsx).
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
  // Comme /me : lecture ouverte à tous les rôles authentifiés, ce n'est
  // qu'un réglage d'affichage des bulletins, pas une donnée sensible.
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