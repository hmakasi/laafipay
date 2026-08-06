import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toUserDTO } from '../lib/dto.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

const roleSchema = z.enum(['admin', 'hr_manager', 'manager', 'accountant', 'employee']);

usersRouter.get(
  '/',
  authorize('users:read'),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { lastName: 'asc' },
    });
    res.json(users.map(toUserDTO));
  })
);

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema,
});

usersRouter.post(
  '/',
  authorize('users:write'),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        companyId: req.user!.companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        passwordHash,
        role: body.role,
      },
    });
    res.status(201).json(toUserDTO(user));
  })
);

const updateUserSchema = z.object({
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

usersRouter.patch(
  '/:id',
  authorize('users:write'),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!existing) throw new NotFoundError(`Utilisateur ${req.params.id} introuvable`);

    const user = await prisma.user.update({ where: { id: existing.id }, data });
    res.json(toUserDTO(user));
  })
);
