import { Router } from 'express';
import { z } from 'zod';
import { Department } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

function toDepartmentDTO(d: Department) {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    managerId: d.managerId ?? undefined,
    parentId: d.parentId ?? undefined,
  };
}

departmentsRouter.get(
  '/',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const departments = await prisma.department.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { name: 'asc' },
    });
    res.json(departments.map(toDepartmentDTO));
  })
);

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

departmentsRouter.post(
  '/',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const body = createDepartmentSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const existing = await prisma.department.findFirst({ where: { companyId, code: body.code } });
    if (existing) throw new HttpError(409, `Le code "${body.code}" est déjà utilisé par un autre département`);

    const department = await prisma.department.create({
      data: { companyId, name: body.name, code: body.code },
    });
    res.status(201).json(toDepartmentDTO(department));
  })
);
