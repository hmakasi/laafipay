import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, authorize, signToken } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';

export const companiesRouter = Router();

const signupSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    legalName: z.string().optional(),
    ifu: z.string().optional(),
    rccm: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    cnssNumber: z.string().optional(),
  }),
  admin: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

function toCompanyDTO(c: {
  id: string;
  name: string;
  legalName: string | null;
  ifu: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
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
    country: c.country ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    cnssNumber: c.cnssNumber ?? undefined,
    logo: c.logo ?? undefined,
  };
}

companiesRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { company, admin } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: admin.email } });
    if (existing) {
      throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée');
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({ data: company });
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
  authorize('settings:read'),
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
  country: z.string().optional(),
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
