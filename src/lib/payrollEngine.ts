import { Employee, IutsBracket, LegalSettings, PayrollEntry, VariableElement } from '@/types';

export function computeIuts(taxableBase: number, brackets: IutsBracket[]): number {
  if (taxableBase <= 0) return 0;
  const bracket = brackets.find((b) => taxableBase >= b.min && (b.max === null || taxableBase <= b.max));
  if (!bracket || bracket.rate === 0) return 0;
  return Math.max(0, Math.round((taxableBase * bracket.rate) / 100 - bracket.deduction));
}

export interface PayrollEntryInput {
  employeeId: string;
  cycleId: string;
  baseSalary: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  primes?: VariableElement[];
  indemnites?: VariableElement[];
  avances?: VariableElement[];
  retenues?: VariableElement[];
  absenceDays?: number;
  absenceAmount?: number;
}

const sumAmounts = (items: VariableElement[] = []) => items.reduce((total, item) => total + item.amount, 0);

export function computePayrollEntry(input: PayrollEntryInput, legalSettings: LegalSettings): PayrollEntry {
  const {
    employeeId,
    cycleId,
    baseSalary,
    overtimeHours = 0,
    overtimeAmount = 0,
    primes = [],
    indemnites = [],
    avances = [],
    retenues = [],
    absenceDays = 0,
    absenceAmount = 0,
  } = input;

  const primesTotal = sumAmounts(primes);
  const indemnitesTotal = sumAmounts(indemnites);
  const avancesTotal = sumAmounts(avances);
  const retenuesTotal = sumAmounts(retenues);

  const cnssEmployee = Math.round((baseSalary * legalSettings.cnssEmployeeRate) / 100);
  const cnssEmployer = Math.round((baseSalary * legalSettings.cnssEmployerRate) / 100);

  const taxableBase = Math.max(0, baseSalary + primesTotal + overtimeAmount - cnssEmployee - absenceAmount);
  const iuts = computeIuts(taxableBase, legalSettings.iutsBrackets);

  const salaireBrut = baseSalary + primesTotal + indemnitesTotal + overtimeAmount - absenceAmount;
  const salaireNet = salaireBrut - cnssEmployee - iuts - avancesTotal - retenuesTotal;
  const coutEmployeur = baseSalary + primesTotal + indemnitesTotal + overtimeAmount + cnssEmployer;

  return {
    id: `entry-${cycleId}-${employeeId}`,
    employeeId,
    cycleId,
    baseSalary,
    overtimeHours,
    overtimeAmount,
    primes,
    indemnites,
    avances,
    retenues,
    absenceDays,
    absenceAmount,
    salaireBrut,
    cnssEmployee,
    cnssEmployer,
    iuts,
    salaireNet,
    coutEmployeur,
    status: 'brouillon',
  };
}

export function computeEmployeePayrollEntry(
  employee: Employee,
  cycleId: string,
  legalSettings: LegalSettings,
  overrides?: Partial<PayrollEntryInput>
): PayrollEntry {
  return computePayrollEntry(
    {
      employeeId: employee.id,
      cycleId,
      baseSalary: employee.baseSalary,
      indemnites: [{ id: 'ind-transport', label: 'Indemnité de transport', amount: 15_000, type: 'indemnite' }],
      ...overrides,
    },
    legalSettings
  );
}
