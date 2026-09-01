// Port fidèle de src/lib/payrollEngine.ts (frontend) — mêmes formules, pour
// que le calcul de paie soit autoritaire côté serveur : le client n'envoie
// que les variables saisies, le serveur recalcule et persiste les montants
// dérivés (jamais l'inverse).

export interface VariableElement {
  id: string;
  label: string;
  amount: number;
  type: 'prime' | 'indemnite' | 'avance' | 'retenue';
}

export interface IutsBracket {
  min: number;
  max: number | null;
  rate: number;
  deduction: number;
}

export interface LegalSettingsInput {
  cnssEmployeeRate: number;
  cnssEmployerRate: number;
  iutsBrackets: IutsBracket[];
}

export interface PayrollEntryInput {
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

export interface PayrollEntryComputed {
  baseSalary: number;
  overtimeHours: number;
  overtimeAmount: number;
  primes: VariableElement[];
  indemnites: VariableElement[];
  avances: VariableElement[];
  retenues: VariableElement[];
  absenceDays: number;
  absenceAmount: number;
  salaireBrut: number;
  cnssEmployee: number;
  cnssEmployer: number;
  iuts: number;
  salaireNet: number;
  coutEmployeur: number;
}

export function computeIuts(taxableBase: number, brackets: IutsBracket[]): number {
  if (taxableBase <= 0) return 0;
  const bracket = brackets.find((b) => taxableBase >= b.min && (b.max === null || taxableBase <= b.max));
  if (!bracket || bracket.rate === 0) return 0;
  return Math.max(0, Math.round((taxableBase * bracket.rate) / 100 - bracket.deduction));
}

// Taux marginal appliqué à une base donnée, en fraction (0.25 = 25%) — pour
// l'affichage du bulletin officiel, qui montre le taux en plus du montant
// final déjà calculé par computeIuts. Port fidèle de findBracketRate côté
// client (src/pages/payroll/LivePayslipPreviewPage.tsx).
export function findBracketRate(base: number, brackets: IutsBracket[]): number {
  if (base <= 0) return 0;
  const bracket = brackets.find((b) => base >= b.min && (b.max === null || base <= b.max));
  return bracket ? bracket.rate / 100 : 0;
}

const sumAmounts = (items: VariableElement[] = []) => items.reduce((total, item) => total + item.amount, 0);

export function computePayrollEntry(input: PayrollEntryInput, legalSettings: LegalSettingsInput): PayrollEntryComputed {
  const {
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
  };
}

// Miroir de src/lib/payrollRubrics.ts + des libellés fr.json
// (payroll.componentsSetup.categories.*.rubrics) — le serveur n'a pas accès à
// i18next, donc les lignes générées automatiquement ci-dessous ont besoin de
// leur propre copie des libellés pour rester lisibles sur le bulletin.
const OPTIONAL_RUBRIC_LABELS: Record<string, string> = {
  housingAllowance: 'Indemnité de logement / loyer',
  healthInsurance: "Assurance santé d'entreprise",
  transportAllowance: 'Indemnité de transport',
  performanceBonus: 'Prime de rendement',
  thirteenthMonth: '13ème mois',
  benefitsInKind: 'Avantages en nature',
};

export interface ConfiguredRubrics {
  // Clés OPTIONAL_RUBRIC_KEYS cochées dans "Configuration du bulletin" pour
  // cette entreprise (PayrollConfig.activeRubrics, déjà filtré des rubriques
  // obligatoires baseSalary/cnss/its qui sont calculées séparément).
  activeOptionalKeys: string[];
  customRubrics: { label: string }[];
}

// Ligne générée automatiquement pour un employé sans saisie manuelle
// (nouvel employé synchronisé dans un cycle en cours). Avant, une seule
// "Indemnité de transport" à 15 000 était codée en dur ici quelle que soit la
// configuration de l'entreprise — les rubriques activées dans "Configuration
// du bulletin" (logement, santé, rendement, 13e mois...) n'avaient donc
// jamais aucun effet sur un bulletin réel, seulement sur le simulateur.
// Chaque rubrique optionnelle active devient maintenant une ligne du
// bulletin (montant à 0, à ajuster par employé via "Éléments variables" —
// seule "Indemnité de transport" garde un montant par défaut non nul, pour
// ne pas casser les cycles existants qui en dépendent déjà).
export function computeDefaultEntryForEmployee(
  baseSalary: number,
  legalSettings: LegalSettingsInput,
  configuredRubrics?: ConfiguredRubrics,
  outstandingAdvances: VariableElement[] = []
): PayrollEntryComputed {
  const indemnites: VariableElement[] = (configuredRubrics?.activeOptionalKeys ?? []).map((key) => ({
    id: `rubric-${key}`,
    label: OPTIONAL_RUBRIC_LABELS[key] ?? key,
    amount: key === 'transportAllowance' ? 15_000 : 0,
    type: 'indemnite',
  }));
  const primes: VariableElement[] = (configuredRubrics?.customRubrics ?? []).map((rubric, i) => ({
    id: `custom-${i}`,
    label: rubric.label,
    amount: 0,
    type: 'prime',
  }));

  return computePayrollEntry({ baseSalary, indemnites, primes, avances: outstandingAdvances }, legalSettings);
}
