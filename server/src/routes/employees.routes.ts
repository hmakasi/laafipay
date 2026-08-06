import { randomBytes } from 'crypto';
import os from 'os';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DocumentType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toEmployeeDTO } from '../lib/dto.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const employeesRouter = Router();
employeesRouter.use(authenticate);

// os.tmpdir() : seul répertoire inscriptible en serverless (Vercel). Non persistant entre
// invocations — un vrai stockage objet (Supabase Storage / Vercel Blob) sera nécessaire
// pour conserver les fichiers uploadés en production.
const upload = multer({ dest: path.join(os.tmpdir(), 'laafipay-documents') });

const include = { documents: true, careerHistory: true };

employeesRouter.get(
  '/',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    const contractType = typeof req.query.contractType === 'string' ? req.query.contractType : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.perPage ? Number(req.query.perPage) : 20;

    const where: Prisma.EmployeeWhereInput = {
      companyId: req.user!.companyId,
      ...(departmentId ? { departmentId } : {}),
      ...(contractType ? { contractType: contractType as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { matricule: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include,
        orderBy: { lastName: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    res.json({
      data: employees.map(toEmployeeDTO),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  })
);

employeesRouter.get(
  '/:id',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include,
    });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);
    res.json(toEmployeeDTO(employee));
  })
);

const employeeInputSchema = z.object({
  matricule: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.enum(['M', 'F']),
  dateOfBirth: z.string(),
  placeOfBirth: z.string(),
  nationality: z.string(),
  maritalStatus: z.enum(['celibataire', 'marie', 'divorce', 'veuf']),
  numberOfChildren: z.number().int().min(0),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']),
  status: z.enum(['actif', 'periode_essai', 'en_conge', 'suspendu', 'offboarded']),
  hireDate: z.string(),
  trialEndDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  position: z.string(),
  departmentId: z.string(),
  managerId: z.string().optional(),
  siteLocation: z.string(),
  baseSalary: z.number().positive(),
  paymentMethod: z.enum(['mobile_money', 'virement', 'mixte', 'especes']),
  mobileMoneyInfo: z
    .object({ operator: z.enum(['orange', 'moov', 'telecel']), phoneNumber: z.string(), accountName: z.string() })
    .optional(),
  bankInfo: z
    .object({ bankName: z.string(), iban: z.string(), rib: z.string(), accountHolder: z.string() })
    .optional(),
  cnssNumber: z.string().optional(),
  iutsCategory: z.number().int().min(1).max(8),
});

employeesRouter.post(
  '/',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const body = employeeInputSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const department = await prisma.department.findFirst({ where: { id: body.departmentId, companyId } });
    if (!department) throw new NotFoundError(`Département ${body.departmentId} introuvable`);
    if (body.managerId) {
      const manager = await prisma.employee.findFirst({ where: { id: body.managerId, companyId } });
      if (!manager) throw new NotFoundError(`Manager ${body.managerId} introuvable`);
    }

    const employee = await prisma.employee.create({
      data: {
        company: { connect: { id: companyId } },
        matricule: body.matricule,
        firstName: body.firstName,
        lastName: body.lastName,
        gender: body.gender,
        dateOfBirth: new Date(body.dateOfBirth),
        placeOfBirth: body.placeOfBirth,
        nationality: body.nationality,
        maritalStatus: body.maritalStatus,
        numberOfChildren: body.numberOfChildren,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        contractType: body.contractType,
        status: body.status,
        hireDate: new Date(body.hireDate),
        trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
        contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : undefined,
        position: body.position,
        department: { connect: { id: body.departmentId } },
        manager: body.managerId ? { connect: { id: body.managerId } } : undefined,
        siteLocation: body.siteLocation,
        baseSalary: body.baseSalary,
        paymentMethod: body.paymentMethod,
        mobileMoneyOperator: body.mobileMoneyInfo?.operator,
        mobileMoneyNumber: body.mobileMoneyInfo?.phoneNumber,
        mobileMoneyAccount: body.mobileMoneyInfo?.accountName,
        bankName: body.bankInfo?.bankName,
        bankIban: body.bankInfo?.iban,
        bankRib: body.bankInfo?.rib,
        bankAccountHolder: body.bankInfo?.accountHolder,
        cnssNumber: body.cnssNumber,
        iutsCategory: body.iutsCategory,
        careerHistory: {
          create: [
            {
              date: new Date(),
              type: 'embauche',
              description: `Recrutement au poste de ${body.position}`,
              newValue: body.position,
              changedBy: req.user!.email,
            },
          ],
        },
      },
      include,
    });
    res.status(201).json(toEmployeeDTO(employee));
  })
);

employeesRouter.patch(
  '/:id',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const body = employeeInputSchema.partial().parse(req.body);
    const {
      departmentId,
      managerId,
      mobileMoneyInfo,
      bankInfo,
      dateOfBirth,
      hireDate,
      trialEndDate,
      contractEndDate,
      ...rest
    } = body;

    if (departmentId) {
      const department = await prisma.department.findFirst({ where: { id: departmentId, companyId } });
      if (!department) throw new NotFoundError(`Département ${departmentId} introuvable`);
    }
    if (managerId) {
      const manager = await prisma.employee.findFirst({ where: { id: managerId, companyId } });
      if (!manager) throw new NotFoundError(`Manager ${managerId} introuvable`);
    }

    const data: Prisma.EmployeeUpdateInput = {
      ...rest,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      trialEndDate: trialEndDate ? new Date(trialEndDate) : undefined,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
      department: departmentId ? { connect: { id: departmentId } } : undefined,
      manager: managerId ? { connect: { id: managerId } } : undefined,
      mobileMoneyOperator: mobileMoneyInfo?.operator,
      mobileMoneyNumber: mobileMoneyInfo?.phoneNumber,
      mobileMoneyAccount: mobileMoneyInfo?.accountName,
      bankName: bankInfo?.bankName,
      bankIban: bankInfo?.iban,
      bankRib: bankInfo?.rib,
      bankAccountHolder: bankInfo?.accountHolder,
    };

    const employee = await prisma.employee.update({ where: { id: existing.id }, data, include });
    res.json(toEmployeeDTO(employee));
  })
);

employeesRouter.delete(
  '/:id',
  authorize('employees:delete'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!existing) throw new NotFoundError(`Employé ${req.params.id} introuvable`);
    await prisma.employee.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

employeesRouter.post(
  '/:id/documents',
  authorize('employees:write'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new NotFoundError('Aucun fichier reçu');
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const validTypes: DocumentType[] = ['contrat', 'avenant', 'piece_identite', 'diplome', 'attestation', 'autre'];
    const requestedType = req.body.type as DocumentType | undefined;
    const type: DocumentType = requestedType && validTypes.includes(requestedType) ? requestedType : 'autre';

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        type,
        name: req.file.originalname,
        url: `/uploads/documents/${req.file.filename}`,
        size: req.file.size,
      },
    });
    res.status(201).json({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      uploadedAt: doc.uploadedAt.toISOString(),
      url: doc.url,
      size: doc.size,
    });
  })
);

employeesRouter.post(
  '/:id/invite',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const token = randomBytes(24).toString('hex');
    await prisma.employee.update({
      where: { id: employee.id },
      data: { inviteToken: token, inviteStatus: 'invited' },
    });

    res.status(201).json({ token });
  })
);
