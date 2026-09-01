import { AdvanceStatus, PayrollEntry } from '@prisma/client';
import { prisma } from './prisma.js';
import { computePayrollEntry, LegalSettingsInput, VariableElement } from './payrollEngine.js';

export const ACTIVE_ADVANCE_STATUSES: AdvanceStatus[] = [
  'en_attente',
  'approuve',
  'verse_mobile_money',
  'en_remboursement',
];

// Sous-ensemble d'ACTIVE_ADVANCE_STATUSES : avances déjà versées à
// l'employé et donc éligibles à un pré-remplissage sur un futur cycle de
// paie ("en_attente"/"approuve" n'ont pas encore d'argent à rembourser).
export const OUTSTANDING_ADVANCE_STATUSES: AdvanceStatus[] = ['verse_mobile_money', 'en_remboursement'];

// Simplification volontaire : plafond calculé sur le salaire net de base
// (baseSalary - CNSS - IUTS), sans primes/indemnités/heures sup du cycle en
// cours — ces éléments varient d'un cycle à l'autre et ne sont pas connus
// au moment d'une demande d'avance. Cohérent avec computeDefaultEntryForEmployee
// qui fait la même approximation pour les lignes générées automatiquement.
export function computeMaxAdvanceAmount(
  baseSalary: number,
  legalSettings: LegalSettingsInput,
  maxAdvancePercent: number
): number {
  const { salaireNet } = computePayrollEntry({ baseSalary }, legalSettings);
  return Math.floor((salaireNet * maxAdvancePercent) / 100);
}

// Une entrée par employé ayant au moins une avance versée non soldée —
// consommé par syncEntries (payroll.routes.ts) pour pré-remplir la ligne
// "avances" d'un nouveau PayrollEntry.
export async function fetchOutstandingAdvancesByEmployee(companyId: string): Promise<Map<string, VariableElement[]>> {
  const advances = await prisma.salaryAdvance.findMany({
    where: { companyId, status: { in: OUTSTANDING_ADVANCE_STATUSES }, remainingBalance: { gt: 0 } },
  });

  const map = new Map<string, VariableElement[]>();
  for (const advance of advances) {
    const list = map.get(advance.employeeId) ?? [];
    list.push({
      id: advance.id,
      label: 'Avance sur salaire',
      amount: advance.remainingBalance,
      type: 'avance',
    });
    map.set(advance.employeeId, list);
  }
  return map;
}

// Appelé à la validation d'un cycle de paie (payroll.routes.ts). Pour
// chaque ligne "avances" d'un PayrollEntry dont l'id correspond à une
// SalaryAdvance existante, crée l'AdvanceDeduction et décrémente le solde.
// Idempotent (vérifie qu'une déduction n'existe pas déjà pour ce couple
// avance/entrée) pour tolérer un second appel de validation.
export async function applyAdvanceDeductionsForCycle(entries: PayrollEntry[]): Promise<void> {
  for (const entry of entries) {
    const avances = entry.avances as unknown as VariableElement[];
    for (const item of avances) {
      if (item.type !== 'avance') continue;

      const advance = await prisma.salaryAdvance.findUnique({ where: { id: item.id } });
      // Avance supprimée entre la génération du cycle et sa validation
      // (cas improbable) — le montant reste dans le calcul du salaire net
      // (déjà soustrait par payrollEngine) mais aucune trace de
      // remboursement n'est créée, voir spec "Erreurs & cas limites".
      if (!advance) continue;

      const alreadyDeducted = await prisma.advanceDeduction.findFirst({
        where: { advanceId: advance.id, payrollEntryId: entry.id },
      });
      if (alreadyDeducted) continue;

      const amount = Math.min(item.amount, advance.remainingBalance);
      if (amount <= 0) continue;

      const remainingBalance = advance.remainingBalance - amount;
      await prisma.$transaction([
        prisma.advanceDeduction.create({ data: { advanceId: advance.id, payrollEntryId: entry.id, amount } }),
        prisma.salaryAdvance.update({
          where: { id: advance.id },
          data: { remainingBalance, status: remainingBalance <= 0 ? 'rembourse' : 'en_remboursement' },
        }),
      ]);
    }
  }
}
