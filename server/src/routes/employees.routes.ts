import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { put, get } from '@vercel/blob';
import { z } from 'zod';
import { AmendmentType, CareerEventType, Contract, ContractAmendment, DocumentType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { toEmployeeDTO } from '../lib/dto.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';

export const employeesRouter = Router();
employeesRouter.use(authenticate);

// Stocké sur Vercel Blob (accès privé — pièces d'identité, diplômes,
// contrats...) plutôt que sur disque : le système de fichiers de Vercel
// est en lecture seule hors /tmp, et /tmp n'y est ni servi ni persistant
// entre invocations (même limite déjà corrigée pour le logo d'entreprise,
// voir companies.routes.ts). En mémoire ici (memoryStorage), le buffer
// part directement vers Blob sans jamais toucher le disque. Contrairement
// au logo, l'accès est privé : le fichier n'est jamais exposé par une URL
// publique, seulement via GET /:id/documents/:documentId/download (voir
// plus bas), qui vérifie les mêmes permissions que la fiche employé.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 Mo

const include = { documents: true, careerHistory: true };

function toAmendmentDTO(a: ContractAmendment) {
  return {
    id: a.id,
    type: a.type,
    effectiveDate: a.effectiveDate.toISOString().split('T')[0],
    description: a.description,
    previousValue: a.previousValue ?? undefined,
    newValue: a.newValue ?? undefined,
    createdBy: a.createdBy,
    createdAt: a.createdAt.toISOString(),
  };
}

function toContractDTO(c: Contract & { amendments: ContractAmendment[] }) {
  return {
    id: c.id,
    employeeId: c.employeeId,
    contractNumber: c.contractNumber ?? undefined,
    contractType: c.contractType,
    startDate: c.startDate.toISOString().split('T')[0],
    endDate: c.endDate?.toISOString().split('T')[0],
    trialEndDate: c.trialEndDate?.toISOString().split('T')[0],
    position: c.position,
    departmentId: c.departmentId,
    baseSalary: c.baseSalary,
    status: c.status,
    isCurrent: c.isCurrent,
    notes: c.notes ?? undefined,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    amendments: c.amendments.map(toAmendmentDTO),
  };
}

// Mappe un type d'avenant vers le CareerEventType le plus proche pour que
// l'onglet Carrière (déjà fonctionnel, timeline sur emp.careerHistory)
// affiche l'historique des avenants sans nouvelle UI dédiée.
const AMENDMENT_CAREER_EVENT: Record<AmendmentType, CareerEventType> = {
  changement_salaire: 'augmentation',
  changement_poste: 'promotion',
  changement_departement: 'mutation',
  renouvellement: 'avenant',
  prolongation: 'avenant',
  autre: 'avenant',
};

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
  asyncHandler(async (req, res) => {
    // Un salarié self-service (self:profile) peut lire sa propre fiche
    // (ex. MyPayslipsTab, RequestLeaveDialog) sans avoir employees:read,
    // réservé aux rôles RH/managériaux.
    const user = req.user!;
    const isOwnRecord = req.params.id === user.employeeId;
    if (!hasPermission(user.role, 'employees:read') && !(hasPermission(user.role, 'self:profile') && isOwnRecord)) {
      throw new ForbiddenError();
    }

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
        // Premier contrat créé de façon transparente — même valeurs que le
        // formulaire de création, aucun champ supplémentaire requis. Point de
        // départ de l'historique contrats/avenants pour cet employé.
        contracts: {
          create: [
            {
              contractType: body.contractType,
              startDate: new Date(body.hireDate),
              endDate: body.contractEndDate ? new Date(body.contractEndDate) : undefined,
              trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
              position: body.position,
              department: { connect: { id: body.departmentId } },
              baseSalary: body.baseSalary,
              status: 'actif',
              isCurrent: true,
              createdBy: req.user!.email,
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

    // Garde-fou minimal : ce formulaire reste une édition directe sans passer
    // par le parcours contrat/avenant (employees/:id/contracts...), mais une
    // modification d'un champ contractuel laisse au moins une trace dans
    // l'onglet Carrière plutôt que d'écraser silencieusement la valeur.
    const careerEvents: Prisma.CareerEventCreateWithoutEmployeeInput[] = [];
    if (rest.baseSalary !== undefined && rest.baseSalary !== existing.baseSalary) {
      careerEvents.push({
        date: new Date(),
        type: 'augmentation',
        description: `Salaire modifié : ${existing.baseSalary} → ${rest.baseSalary}`,
        previousValue: String(existing.baseSalary),
        newValue: String(rest.baseSalary),
        changedBy: req.user!.email,
      });
    }
    if (rest.position !== undefined && rest.position !== existing.position) {
      careerEvents.push({
        date: new Date(),
        type: 'promotion',
        description: `Poste modifié : ${existing.position} → ${rest.position}`,
        previousValue: existing.position,
        newValue: rest.position,
        changedBy: req.user!.email,
      });
    }
    if (departmentId !== undefined && departmentId !== existing.departmentId) {
      careerEvents.push({
        date: new Date(),
        type: 'mutation',
        description: 'Département modifié',
        previousValue: existing.departmentId,
        newValue: departmentId,
        changedBy: req.user!.email,
      });
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
      careerHistory: careerEvents.length > 0 ? { create: careerEvents } : undefined,
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

    const ext = path.extname(req.file.originalname);
    const blob = await put(`documents/${employee.id}-${Date.now()}${ext}`, req.file.buffer, {
      access: 'private',
      contentType: req.file.mimetype,
      token: process.env.DOCUMENTS_BLOB_READ_WRITE_TOKEN,
    });

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        type,
        name: req.file.originalname,
        url: blob.url,
        size: req.file.size,
      },
    });
    res.status(201).json({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      uploadedAt: doc.uploadedAt.toISOString(),
      url: `/employees/${employee.id}/documents/${doc.id}/download`,
      size: doc.size,
    });
  })
);

employeesRouter.get(
  '/:id/documents/:documentId/download',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const doc = await prisma.employeeDocument.findFirst({
      where: { id: req.params.documentId, employeeId: employee.id },
    });
    if (!doc) throw new NotFoundError(`Document ${req.params.documentId} introuvable`);

    const blob = await get(doc.url, { access: 'private', token: process.env.DOCUMENTS_BLOB_READ_WRITE_TOKEN });
    if (!blob) throw new NotFoundError('Fichier introuvable dans le stockage');
    if (blob.statusCode !== 200) throw new HttpError(502, 'Échec de la récupération du fichier');

    res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}"`);
    Readable.fromWeb(blob.stream).pipe(res);
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

// ── Contrats & avenants ──────────────────────────────────────

employeesRouter.get(
  '/:id/contracts',
  authorize('employees:read'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const contracts = await prisma.contract.findMany({
      where: { employeeId: employee.id },
      include: { amendments: { orderBy: { effectiveDate: 'desc' } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(contracts.map(toContractDTO));
  })
);

const contractInputSchema = z.object({
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']),
  startDate: z.string(),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  position: z.string(),
  departmentId: z.string(),
  baseSalary: z.number().positive(),
  contractNumber: z.string().optional(),
  notes: z.string().optional(),
});

employeesRouter.post(
  '/:id/contracts',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const employee = await prisma.employee.findFirst({ where: { id: req.params.id, companyId } });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);

    const body = contractInputSchema.parse(req.body);
    const department = await prisma.department.findFirst({ where: { id: body.departmentId, companyId } });
    if (!department) throw new NotFoundError(`Département ${body.departmentId} introuvable`);

    // $transaction en tableau (batché en une seule requête réseau), pas la
    // forme interactive `async (tx) => ...` : cette dernière garde une
    // session ouverte entre plusieurs aller-retours, ce que le pooler
    // Supabase (PgBouncer en mode transaction, voir DATABASE_URL) ne
    // supporte pas de façon fiable en prod — plantait systématiquement en
    // 500 alors que ça marchait en local contre Postgres direct (même bug
    // que server/src/routes/companies.routes.ts, POST /signup). Aucune de
    // ces trois écritures n'a besoin du résultat d'une autre : la forme
    // tableau suffit et reste atomique.
    const [, created] = await prisma.$transaction([
      // Clôt le contrat courant s'il existe — un avenant modifie en place,
      // un nouveau contrat en ouvre un autre (CDD renouvelé, passage CDI...).
      prisma.contract.updateMany({
        where: { employeeId: employee.id, isCurrent: true },
        data: { isCurrent: false, status: 'termine' },
      }),
      prisma.contract.create({
        data: {
          employeeId: employee.id,
          contractNumber: body.contractNumber,
          contractType: body.contractType,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
          position: body.position,
          departmentId: body.departmentId,
          baseSalary: body.baseSalary,
          status: 'actif',
          isCurrent: true,
          notes: body.notes,
          createdBy: req.user!.email,
        },
        include: { amendments: true },
      }),
      // Instantané Employee synchronisé — hireDate n'est jamais touché ici.
      prisma.employee.update({
        where: { id: employee.id },
        data: {
          contractType: body.contractType,
          contractEndDate: body.endDate ? new Date(body.endDate) : null,
          trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : null,
          position: body.position,
          department: { connect: { id: body.departmentId } },
          baseSalary: body.baseSalary,
          careerHistory: {
            create: [
              {
                date: new Date(body.startDate),
                type: 'nouveau_contrat',
                description: `Nouveau contrat ${body.contractType} à partir du ${body.startDate}`,
                newValue: body.contractType,
                changedBy: req.user!.email,
              },
            ],
          },
        },
      }),
    ]);

    res.status(201).json(toContractDTO(created));
  })
);

const amendmentInputSchema = z.object({
  type: z.enum(['renouvellement', 'changement_poste', 'changement_salaire', 'changement_departement', 'prolongation', 'autre']),
  effectiveDate: z.string(),
  description: z.string(),
  position: z.string().optional(),
  departmentId: z.string().optional(),
  baseSalary: z.number().positive().optional(),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']).optional(),
  previousValue: z.string().optional(),
  newValue: z.string().optional(),
});

employeesRouter.post(
  '/:id/contracts/:contractId/amendments',
  authorize('employees:write'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const employee = await prisma.employee.findFirst({ where: { id: req.params.id, companyId } });
    if (!employee) throw new NotFoundError(`Employé ${req.params.id} introuvable`);
    const existingContract = await prisma.contract.findFirst({
      where: { id: req.params.contractId, employeeId: employee.id },
    });
    if (!existingContract) throw new NotFoundError(`Contrat ${req.params.contractId} introuvable`);

    const body = amendmentInputSchema.parse(req.body);
    if (body.departmentId) {
      const department = await prisma.department.findFirst({ where: { id: body.departmentId, companyId } });
      if (!department) throw new NotFoundError(`Département ${body.departmentId} introuvable`);
    }

    // $transaction en tableau plutôt que la forme interactive `async (tx)
    // => ...` — même raison que ci-dessus (POST /:id/contracts) et que
    // companies.routes.ts POST /signup : incompatible avec le pooler
    // Supabase en prod. La relecture finale (avec les amendments) se fait
    // après coup, hors transaction — lecture seule, aucun enjeu d'atomicité.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.contract.update({
        where: { id: existingContract.id },
        data: {
          position: body.position,
          department: body.departmentId ? { connect: { id: body.departmentId } } : undefined,
          baseSalary: body.baseSalary,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
          contractType: body.contractType,
        },
      }),
      prisma.contractAmendment.create({
        data: {
          contractId: existingContract.id,
          type: body.type,
          effectiveDate: new Date(body.effectiveDate),
          description: body.description,
          previousValue: body.previousValue,
          newValue: body.newValue,
          createdBy: req.user!.email,
        },
      }),
    ];

    // Ne répercute sur l'instantané Employee que si ce contrat est le
    // contrat courant — un avenant sur un contrat déjà clos (historique)
    // ne doit pas modifier les champs actuels de l'employé.
    if (existingContract.isCurrent) {
      ops.push(
        prisma.employee.update({
          where: { id: employee.id },
          data: {
            position: body.position,
            department: body.departmentId ? { connect: { id: body.departmentId } } : undefined,
            baseSalary: body.baseSalary,
            contractEndDate: body.endDate ? new Date(body.endDate) : undefined,
            trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
            contractType: body.contractType,
            careerHistory: {
              create: [
                {
                  date: new Date(body.effectiveDate),
                  type: AMENDMENT_CAREER_EVENT[body.type],
                  description: body.description,
                  previousValue: body.previousValue,
                  newValue: body.newValue,
                  changedBy: req.user!.email,
                },
              ],
            },
          },
        })
      );
    }

    await prisma.$transaction(ops);

    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: existingContract.id },
      include: { amendments: { orderBy: { effectiveDate: 'desc' } } },
    });

    res.status(201).json(toContractDTO(contract));
  })
);
