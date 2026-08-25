import { Router } from 'express';
import { z } from 'zod';
import { LegalSettings, PayrollCycle, PayrollEntry, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';
import {
  computeDefaultEntryForEmployee,
  computePayrollEntry,
  ConfiguredRubrics,
  IutsBracket,
  VariableElement,
} from '../lib/payrollEngine.js';

// Miroir de MANDATORY_RUBRIC_KEYS (src/lib/payrollRubrics.ts) — ces clés
// vivent dans PayrollConfig.activeRubrics mais sont déjà couvertes par le
// calcul obligatoire (salaire de base, CNSS, impôt), donc exclues quand on
// dérive les indemnités optionnelles à générer automatiquement.
const MANDATORY_RUBRIC_KEYS = new Set(['baseSalary', 'cnss', 'its']);
import { generatePayslipsForCycle } from './payslips.routes.js';
import { dispatchComptaEvent } from '../lib/comptaBridge.js';

export const payrollRouter = Router();
payrollRouter.use(authenticate);

// ── DTO mapping ──────────────────────────────────────────────

function toLegalSettingsDTO(ls: LegalSettings) {
  return {
    id: ls.id,
    effectiveDate: ls.effectiveDate.toISOString().split('T')[0],
    smig: ls.smig,
    cnssEmployeeRate: ls.cnssEmployeeRate,
    cnssEmployerRate: ls.cnssEmployerRate,
    iutsBrackets: ls.iutsBrackets,
    createdBy: ls.createdBy,
    createdAt: ls.createdAt.toISOString(),
  };
}

function toPayrollEntryDTO(e: PayrollEntry) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    cycleId: e.cycleId,
    baseSalary: e.baseSalary,
    overtimeHours: e.overtimeHours,
    overtimeAmount: e.overtimeAmount,
    primes: e.primes,
    indemnites: e.indemnites,
    avances: e.avances,
    retenues: e.retenues,
    absenceDays: e.absenceDays,
    absenceAmount: e.absenceAmount,
    salaireBrut: e.salaireBrut,
    cnssEmployee: e.cnssEmployee,
    cnssEmployer: e.cnssEmployer,
    iuts: e.iuts,
    salaireNet: e.salaireNet,
    coutEmployeur: e.coutEmployeur,
    status: e.status,
  };
}

function toPayrollCycleDTO(c: PayrollCycle & { entries: PayrollEntry[] }) {
  const entries = c.entries.map(toPayrollEntryDTO);
  return {
    id: c.id,
    period: c.period,
    month: c.month,
    year: c.year,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    validatedAt: c.validatedAt?.toISOString(),
    validatedBy: c.validatedBy ?? undefined,
    totalBrut: entries.reduce((sum, e) => sum + e.salaireBrut, 0),
    totalNet: entries.reduce((sum, e) => sum + e.salaireNet, 0),
    totalEmployerCost: entries.reduce((sum, e) => sum + e.coutEmployeur, 0),
    employeeCount: entries.length,
    entries,
  };
}

// ── Helpers ───────────────────────────────────────────────────

// Pendant serveur de l'ancien ensureEntries() côté mock : garantit qu'un
// employé actif sans ligne dans ce cycle en obtienne une (upsert idempotent,
// ne touche jamais les lignes déjà présentes) — un employé ajouté après la
// création du cycle doit y apparaître à la prochaine consultation.
async function syncEntries(cycle: Pick<PayrollCycle, 'id' | 'companyId' | 'legalSettingsId'>) {
  const [legalSettings, activeEmployees, existingEntries, payrollConfig] = await Promise.all([
    prisma.legalSettings.findUniqueOrThrow({ where: { id: cycle.legalSettingsId } }),
    prisma.employee.findMany({ where: { companyId: cycle.companyId, status: { not: 'offboarded' } } }),
    prisma.payrollEntry.findMany({ where: { cycleId: cycle.id }, select: { employeeId: true } }),
    prisma.payrollConfig.findUnique({ where: { companyId: cycle.companyId } }),
  ]);

  const existingEmployeeIds = new Set(existingEntries.map((e) => e.employeeId));
  const missing = activeEmployees.filter((e) => !existingEmployeeIds.has(e.id));
  if (missing.length === 0) return;

  const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];
  // Entreprise n'ayant jamais ouvert "Configuration du bulletin" : aucune
  // rubrique optionnelle générée, comportement inchangé (seuls les éléments
  // obligatoires apparaissent, à ajouter manuellement via "Éléments variables").
  const configuredRubrics: ConfiguredRubrics = {
    activeOptionalKeys: ((payrollConfig?.activeRubrics as unknown as string[]) ?? []).filter(
      (key) => !MANDATORY_RUBRIC_KEYS.has(key)
    ),
    customRubrics: (payrollConfig?.customRubrics as unknown as { label: string }[]) ?? [],
  };

  await prisma.payrollEntry.createMany({
    data: missing.map((emp) => {
      const computed = computeDefaultEntryForEmployee(
        emp.baseSalary,
        {
          cnssEmployeeRate: legalSettings.cnssEmployeeRate,
          cnssEmployerRate: legalSettings.cnssEmployerRate,
          iutsBrackets,
        },
        configuredRubrics
      );
      return {
        cycleId: cycle.id,
        employeeId: emp.id,
        baseSalary: computed.baseSalary,
        overtimeHours: computed.overtimeHours,
        overtimeAmount: computed.overtimeAmount,
        primes: computed.primes as unknown as Prisma.InputJsonValue,
        indemnites: computed.indemnites as unknown as Prisma.InputJsonValue,
        avances: computed.avances as unknown as Prisma.InputJsonValue,
        retenues: computed.retenues as unknown as Prisma.InputJsonValue,
        absenceDays: computed.absenceDays,
        absenceAmount: computed.absenceAmount,
        salaireBrut: computed.salaireBrut,
        cnssEmployee: computed.cnssEmployee,
        cnssEmployer: computed.cnssEmployer,
        iuts: computed.iuts,
        salaireNet: computed.salaireNet,
        coutEmployeur: computed.coutEmployeur,
      };
    }),
  });
}

async function mostRecentLegalSettings(companyId: string) {
  const legalSettings = await prisma.legalSettings.findFirst({ where: { companyId }, orderBy: { effectiveDate: 'desc' } });
  if (!legalSettings) {
    throw new HttpError(400, 'Aucun barème CNSS/IUTS configuré pour cette entreprise');
  }
  return legalSettings;
}

// ── Cycles ────────────────────────────────────────────────────

payrollRouter.get(
  '/cycles',
  authorize('payroll:read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const cycles = await prisma.payrollCycle.findMany({ where: { companyId }, orderBy: { period: 'desc' } });
    for (const cycle of cycles) {
      await syncEntries(cycle);
    }
    const withEntries = await prisma.payrollCycle.findMany({
      where: { companyId },
      include: { entries: true },
      orderBy: { period: 'desc' },
    });
    res.json(withEntries.map(toPayrollCycleDTO));
  })
);

const createCycleSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format de période invalide (AAAA-MM)'),
});

payrollRouter.post(
  '/cycles',
  authorize('payroll:write'),
  asyncHandler(async (req, res) => {
    const { period } = createCycleSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const [year, month] = period.split('-').map(Number);

    const existing = await prisma.payrollCycle.findUnique({ where: { companyId_period: { companyId, period } } });
    if (existing) throw new HttpError(409, `Un cycle existe déjà pour la période ${period}`);

    const legalSettings = await mostRecentLegalSettings(companyId);
    const cycle = await prisma.payrollCycle.create({
      data: { companyId, period, month, year, legalSettingsId: legalSettings.id },
    });
    await syncEntries(cycle);

    const full = await prisma.payrollCycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { entries: true } });
    res.status(201).json(toPayrollCycleDTO(full));
  })
);

payrollRouter.get(
  '/cycles/:id',
  authorize('payroll:read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const cycle = await prisma.payrollCycle.findFirst({ where: { id: req.params.id, companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);
    await syncEntries(cycle);

    const full = await prisma.payrollCycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { entries: true } });
    res.json(toPayrollCycleDTO(full));
  })
);

const validateCycleSchema = z.object({ validatedBy: z.string() });

payrollRouter.post(
  '/cycles/:id/validate',
  authorize('payroll:approve'),
  asyncHandler(async (req, res) => {
    const { validatedBy } = validateCycleSchema.parse(req.body);
    const companyId = req.user!.companyId;
    const cycle = await prisma.payrollCycle.findFirst({ where: { id: req.params.id, companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);
    await syncEntries(cycle);

    await prisma.payrollEntry.updateMany({ where: { cycleId: cycle.id }, data: { status: 'valide' } });
    const updated = await prisma.payrollCycle.update({
      where: { id: cycle.id },
      data: { status: 'valide', validatedAt: new Date(), validatedBy },
      include: { entries: true },
    });

    // Déclenchement automatique : les bulletins doivent être disponibles
    // dans "Bulletin de paie" dès la validation, sans action manuelle
    // supplémentaire (bouton "Générer" conservé pour une régénération
    // idempotente si besoin).
    await generatePayslipsForCycle(cycle.id, companyId, validatedBy);

    // Passerelle Paie -> Compta : construit l'OD de paie et l'écrit dans
    // l'outbox (rapide, transactionnel) avant de répondre — la tentative
    // d'envoi HTTP vers LaafiCompta elle-même tourne en arrière-plan et
    // ne retarde/ne bloque jamais la clôture du cycle (voir comptaBridge.ts).
    await dispatchComptaEvent(cycle.id, companyId);

    res.json(toPayrollCycleDTO(updated));
  })
);

// ── Entries ───────────────────────────────────────────────────

const variableElementSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  amount: z.number(),
  type: z.enum(['prime', 'indemnite', 'avance', 'retenue']),
});

const updateEntrySchema = z.object({
  overtimeHours: z.number().optional(),
  overtimeAmount: z.number().optional(),
  primes: z.array(variableElementSchema).optional(),
  indemnites: z.array(variableElementSchema).optional(),
  avances: z.array(variableElementSchema).optional(),
  retenues: z.array(variableElementSchema).optional(),
  absenceDays: z.number().optional(),
  absenceAmount: z.number().optional(),
});

function withGeneratedIds(items: z.infer<typeof variableElementSchema>[] | undefined): VariableElement[] | undefined {
  return items?.map((item, i) => ({ ...item, id: item.id ?? `${item.type}-${Date.now()}-${i}` }));
}

payrollRouter.patch(
  '/cycles/:cycleId/entries/:entryId',
  authorize('payroll:write'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const body = updateEntrySchema.parse(req.body);

    const cycle = await prisma.payrollCycle.findFirst({ where: { id: req.params.cycleId, companyId } });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.cycleId} introuvable`);
    const entry = await prisma.payrollEntry.findFirst({ where: { id: req.params.entryId, cycleId: cycle.id } });
    if (!entry) throw new NotFoundError(`Ligne de paie ${req.params.entryId} introuvable`);

    // Barème figé à la création du cycle — jamais celui "actuel" au moment de
    // l'édition, pour que deux lignes du même cycle ne dérivent pas si un
    // nouveau barème est créé entre-temps.
    const legalSettings = await prisma.legalSettings.findUniqueOrThrow({ where: { id: cycle.legalSettingsId } });
    const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];

    const computed = computePayrollEntry(
      {
        baseSalary: entry.baseSalary,
        overtimeHours: body.overtimeHours ?? entry.overtimeHours,
        overtimeAmount: body.overtimeAmount ?? entry.overtimeAmount,
        primes: withGeneratedIds(body.primes) ?? (entry.primes as unknown as VariableElement[]),
        indemnites: withGeneratedIds(body.indemnites) ?? (entry.indemnites as unknown as VariableElement[]),
        avances: withGeneratedIds(body.avances) ?? (entry.avances as unknown as VariableElement[]),
        retenues: withGeneratedIds(body.retenues) ?? (entry.retenues as unknown as VariableElement[]),
        absenceDays: body.absenceDays ?? entry.absenceDays,
        absenceAmount: body.absenceAmount ?? entry.absenceAmount,
      },
      {
        cnssEmployeeRate: legalSettings.cnssEmployeeRate,
        cnssEmployerRate: legalSettings.cnssEmployerRate,
        iutsBrackets,
      }
    );

    const updated = await prisma.payrollEntry.update({
      where: { id: entry.id },
      data: {
        overtimeHours: computed.overtimeHours,
        overtimeAmount: computed.overtimeAmount,
        primes: computed.primes as unknown as Prisma.InputJsonValue,
        indemnites: computed.indemnites as unknown as Prisma.InputJsonValue,
        avances: computed.avances as unknown as Prisma.InputJsonValue,
        retenues: computed.retenues as unknown as Prisma.InputJsonValue,
        absenceDays: computed.absenceDays,
        absenceAmount: computed.absenceAmount,
        salaireBrut: computed.salaireBrut,
        cnssEmployee: computed.cnssEmployee,
        cnssEmployer: computed.cnssEmployer,
        iuts: computed.iuts,
        salaireNet: computed.salaireNet,
        coutEmployeur: computed.coutEmployeur,
      },
    });

    res.json(toPayrollEntryDTO(updated));
  })
);

// ── Legal settings ────────────────────────────────────────────

payrollRouter.get(
  '/legal-settings',
  authorize('payroll:read'),
  asyncHandler(async (req, res) => {
    const settings = await prisma.legalSettings.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { effectiveDate: 'desc' },
    });
    res.json(settings.map(toLegalSettingsDTO));
  })
);

const iutsBracketSchema = z.object({
  min: z.number(),
  max: z.number().nullable(),
  rate: z.number(),
  deduction: z.number(),
});

const createLegalSettingsSchema = z.object({
  effectiveDate: z.string(),
  smig: z.number(),
  cnssEmployeeRate: z.number(),
  cnssEmployerRate: z.number(),
  iutsBrackets: z.array(iutsBracketSchema),
  createdBy: z.string(),
});

payrollRouter.post(
  '/legal-settings',
  authorize('payroll:settings'),
  asyncHandler(async (req, res) => {
    const body = createLegalSettingsSchema.parse(req.body);
    const created = await prisma.legalSettings.create({
      data: {
        companyId: req.user!.companyId,
        effectiveDate: new Date(body.effectiveDate),
        smig: body.smig,
        cnssEmployeeRate: body.cnssEmployeeRate,
        cnssEmployerRate: body.cnssEmployerRate,
        iutsBrackets: body.iutsBrackets,
        createdBy: body.createdBy,
      },
    });
    res.status(201).json(toLegalSettingsDTO(created));
  })
);

// Pas de suppression si le barème a déjà servi à un cycle : PayrollCycle.
// legalSettingsId est figé à la création du cycle précisément pour qu'un
// changement de barème ultérieur ne modifie jamais rétroactivement un
// cycle déjà calculé (voir syncEntries plus haut) — le supprimer casserait
// cette référence. Seule une erreur de saisie jamais utilisée peut être
// retirée.
payrollRouter.delete(
  '/legal-settings/:id',
  authorize('payroll:settings'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const settings = await prisma.legalSettings.findFirst({ where: { id: req.params.id, companyId } });
    if (!settings) throw new NotFoundError(`Barème ${req.params.id} introuvable`);

    const usageCount = await prisma.payrollCycle.count({ where: { legalSettingsId: settings.id } });
    if (usageCount > 0) {
      throw new HttpError(
        409,
        `Ce barème a déjà été utilisé par ${usageCount} cycle${usageCount > 1 ? 's' : ''} de paie et ne peut plus être supprimé.`
      );
    }

    await prisma.legalSettings.delete({ where: { id: settings.id } });
    res.status(204).send();
  })
);

// ── Audit trail (dérivé, aucun journal dédié — endpoint non consommé par l'UI actuelle) ──

payrollRouter.get(
  '/cycles/:id/audit-trail',
  authorize('payroll:read'),
  asyncHandler(async (req, res) => {
    const cycle = await prisma.payrollCycle.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!cycle) throw new NotFoundError(`Cycle ${req.params.id} introuvable`);

    const trail = [
      {
        id: `audit-${cycle.id}-created`,
        action: 'CYCLE_CREATED',
        user: 'system',
        timestamp: cycle.createdAt.toISOString(),
        details: `Cycle ${cycle.period} créé`,
      },
    ];
    if (cycle.validatedAt) {
      trail.push({
        id: `audit-${cycle.id}-validated`,
        action: 'CYCLE_VALIDATED',
        user: cycle.validatedBy ?? 'system',
        timestamp: cycle.validatedAt.toISOString(),
        details: `Cycle ${cycle.period} validé`,
      });
    }
    res.json(trail);
  })
);
