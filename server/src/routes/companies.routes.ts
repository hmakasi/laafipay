import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, authorize, signToken } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';

export const companiesRouter = Router();

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

function toCompanyDTO(c: {
  id: string;
  name: string;
  legalName: string | null;
  ifu: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  countryCode: string;
  currencyCode: string;
  phone: string | null;
  email: string | null;
  cnssNumber: string | null;
  logo: string | null;
}) {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName ?? undefined,
    ifu: c.ifu ?? undefined,
    rccm: c.rccm ?? undefined,
    address: c.address ?? undefined,
    city: c.city ?? undefined,
    countryCode: c.countryCode,
    currencyCode: c.currencyCode,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    cnssNumber: c.cnssNumber ?? undefined,
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

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional(),
  ifu: z.string().optional(),
  rccm: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  // countryCode/currencyCode volontairement absents ici : les changer après
  // coup rouvrirait la question des paies déjà calculées dans l'ancienne
  // devise/juridiction — hors périmètre de cette mise à jour de profil.
  phone: z.string().optional(),
  email: z.string().email().optional(),
  cnssNumber: z.string().optional(),
  logo: z.string().optional(),
});

companiesRouter.patch(
  '/me',
  authenticate,
  authorize('settings:write'),
  asyncHandler(async (req, res) => {
    const data = updateCompanySchema.parse(req.body);
    const company = await prisma.company.update({ where: { id: req.user!.companyId }, data });
    res.json(toCompanyDTO(company));
  })
);
