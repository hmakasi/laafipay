import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Routeur PUBLIC (pas de `authenticate`) : le recruté accède à ce lien sans compte.
 * L'accès est sécurisé par le token à usage unique généré via POST /api/employees/:id/invite.
 */
export const onboardingRouter = Router();

// Stocké sur Vercel Blob (accès privé, même pattern que employees.routes.ts)
// plutôt que sur disque : os.tmpdir() n'est pas persistant entre invocations
// sur Vercel serverless — un document "uploadé" à l'onboarding disparaissait
// silencieusement, tout en laissant un EmployeeDocument qui prétend le
// contraire (voir audit sécurité, M4). En mémoire ici (memoryStorage), le
// buffer part directement vers Blob sans jamais toucher le disque.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 Mo

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
      const ext = path.extname(req.file.originalname);
      const blob = await put(`documents/${employee.id}-${Date.now()}${ext}`, req.file.buffer, {
        access: 'private',
        contentType: req.file.mimetype,
        token: process.env.DOCUMENTS_BLOB_READ_WRITE_TOKEN,
      });

      await prisma.employeeDocument.create({
        data: {
          employeeId: employee.id,
          type: 'piece_identite',
          name: req.file.originalname,
          url: blob.url,
          size: req.file.size,
        },
      });
    }

    res.json({ success: true });
  })
);
