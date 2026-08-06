import os from 'os';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Routeur PUBLIC (pas de `authenticate`) : le recruté accède à ce lien sans compte.
 * L'accès est sécurisé par le token à usage unique généré via POST /api/employees/:id/invite.
 */
export const onboardingRouter = Router();

// os.tmpdir() : seul répertoire inscriptible en serverless (Vercel). Non persistant entre
// invocations — un vrai stockage objet (Supabase Storage / Vercel Blob) sera nécessaire
// pour conserver les fichiers uploadés en production.
const upload = multer({ dest: path.join(os.tmpdir(), 'laafipay-documents') });

async function findInvitedEmployee(token: string) {
  return prisma.employee.findFirst({
    where: { inviteToken: token, inviteStatus: 'invited' },
    include: { company: { select: { name: true } } },
  });
}

onboardingRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const employee = await findInvitedEmployee(req.params.token);
    if (!employee) throw new NotFoundError('Lien invalide, expiré ou déjà utilisé');

    res.json({
      firstName: employee.firstName,
      lastName: employee.lastName,
      companyName: employee.company.name,
    });
  })
);

const completeOnboardingSchema = z.object({
  cnssNumber: z.string().min(1).optional(),
  mobileMoneyOperator: z.enum(['orange', 'moov', 'telecel']).optional(),
  mobileMoneyNumber: z.string().min(1).optional(),
  mobileMoneyAccount: z.string().min(1).optional(),
});

onboardingRouter.patch(
  '/:token',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const employee = await findInvitedEmployee(req.params.token);
    if (!employee) throw new NotFoundError('Lien invalide, expiré ou déjà utilisé');

    const body = completeOnboardingSchema.parse(req.body);

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        cnssNumber: body.cnssNumber,
        mobileMoneyOperator: body.mobileMoneyOperator,
        mobileMoneyNumber: body.mobileMoneyNumber,
        mobileMoneyAccount: body.mobileMoneyAccount,
        inviteStatus: 'completed',
        inviteToken: null,
      },
    });

    if (req.file) {
      await prisma.employeeDocument.create({
        data: {
          employeeId: employee.id,
          type: 'piece_identite',
          name: req.file.originalname,
          url: `/uploads/documents/${req.file.filename}`,
          size: req.file.size,
        },
      });
    }

    res.json({ success: true });
  })
);
