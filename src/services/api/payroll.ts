import { LegalSettings, PayrollCycle, PayrollEntry } from '@/types';
import { MOCK_PAYROLL_CYCLES, MOCK_LEGAL_SETTINGS } from '@/mocks/payroll';
import { MOCK_EMPLOYEES } from '@/mocks/employees';
import { delay, deepClone } from '@/lib/utils';
import { computeEmployeePayrollEntry, PayrollEntryInput } from '@/lib/payrollEngine';

let cycles = deepClone(MOCK_PAYROLL_CYCLES);
const legalSettings = deepClone(MOCK_LEGAL_SETTINGS);

// ── Helpers ───────────────────────────────────────────────────

function currentLegalSettings() {
  return legalSettings[0];
}

function ensureEntries(cycle: PayrollCycle): PayrollEntry[] {
  if (cycle.entries.length === 0) {
    cycle.entries = MOCK_EMPLOYEES.filter((e) => e.status !== 'offboarded').map((e) =>
      computeEmployeePayrollEntry(e, cycle.id, currentLegalSettings())
    );
  }
  return cycle.entries;
}

function recomputeTotals(cycle: PayrollCycle) {
  cycle.totalBrut = cycle.entries.reduce((sum, e) => sum + e.salaireBrut, 0);
  cycle.totalNet = cycle.entries.reduce((sum, e) => sum + e.salaireNet, 0);
  cycle.totalEmployerCost = cycle.entries.reduce((sum, e) => sum + e.coutEmployeur, 0);
  cycle.employeeCount = cycle.entries.length;
}

// ── API Functions ─────────────────────────────────────────────

export async function getPayrollCycles(): Promise<PayrollCycle[]> {
  await delay(400);
  return deepClone(cycles);
}

export async function getPayrollCycle(id: string): Promise<PayrollCycle> {
  await delay(300);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) throw new Error(`Cycle ${id} introuvable`);

  ensureEntries(cycle);
  recomputeTotals(cycle);
  return deepClone(cycle);
}

export async function createPayrollCycle(period: string): Promise<PayrollCycle> {
  await delay(600);
  const [year, month] = period.split('-').map(Number);
  const newCycle: PayrollCycle = {
    id: `cycle-${period}`,
    period,
    month,
    year,
    status: 'brouillon',
    createdAt: new Date().toISOString(),
    totalBrut: 0,
    totalNet: 0,
    totalEmployerCost: 0,
    employeeCount: 0,
    entries: [],
  };
  cycles.push(newCycle);
  return deepClone(newCycle);
}

export async function validatePayrollCycle(id: string, validatedBy: string): Promise<PayrollCycle> {
  await delay(500);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) throw new Error(`Cycle ${id} introuvable`);
  ensureEntries(cycle);
  cycle.entries.forEach((e) => (e.status = 'valide'));
  recomputeTotals(cycle);
  cycle.status = 'valide';
  cycle.validatedAt = new Date().toISOString();
  cycle.validatedBy = validatedBy;
  return deepClone(cycle);
}

export async function updatePayrollEntry(
  cycleId: string,
  entryId: string,
  data: Partial<PayrollEntryInput>
): Promise<PayrollEntry> {
  await delay(400);
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error(`Cycle ${cycleId} introuvable`);
  ensureEntries(cycle);

  const index = cycle.entries.findIndex((e) => e.id === entryId);
  if (index === -1) throw new Error(`Ligne de paie ${entryId} introuvable`);
  const current = cycle.entries[index];
  const emp = MOCK_EMPLOYEES.find((e) => e.id === current.employeeId);
  if (!emp) throw new Error('Employé introuvable');

  const updated = computeEmployeePayrollEntry(emp, cycleId, currentLegalSettings(), {
    overtimeHours: current.overtimeHours,
    overtimeAmount: current.overtimeAmount,
    primes: current.primes,
    indemnites: current.indemnites,
    avances: current.avances,
    retenues: current.retenues,
    absenceDays: current.absenceDays,
    absenceAmount: current.absenceAmount,
    ...data,
  });
  updated.id = entryId;
  cycle.entries[index] = updated;
  recomputeTotals(cycle);

  return deepClone(updated);
}

export async function getLegalSettings(): Promise<LegalSettings[]> {
  await delay(300);
  return deepClone(legalSettings);
}

export async function createLegalSettings(data: Omit<LegalSettings, 'id' | 'createdAt'>): Promise<LegalSettings> {
  await delay(600);
  const newSettings: LegalSettings = {
    ...data,
    id: `ls-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  legalSettings.unshift(newSettings);
  return deepClone(newSettings);
}

export async function getAuditTrail(cycleId: string) {
  await delay(300);
  return [
    {
      id: `audit-payroll-${cycleId}`,
      action: 'CYCLE_CREATED',
      user: 'a.ouedraogo@entreprise.bf',
      timestamp: new Date().toISOString(),
      details: `Cycle ${cycleId} créé`,
    },
  ];
}
