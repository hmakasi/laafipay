import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

departmentsRouter.get(
  '/',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const departments = await prisma.department.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { name: 'asc' },
    });
    res.json(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        managerId: d.managerId ?? undefined,
        parentId: d.parentId ?? undefined,
      }))
    );
  })
);
