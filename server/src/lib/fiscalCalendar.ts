// Calendrier des échéances fiscales/sociales récurrentes par pays — mêmes
// obligations que celles déjà décidées pour le mock LaafiCompta (voir
// src/mocks/compta.ts) : IUTS/IPTS/IPR (impôt sur salaires) + CNSS (BF) +
// TVA (BF), pas d'extension à d'autres obligations BJ/CD faute de date
// réglementaire vérifiée pour celles-ci.
export type FiscalDeadlineAmountSource = 'iuts' | 'cnss' | null;

export interface FiscalDeadlineRule {
  id: string;
  countryCode: 'BF' | 'BJ' | 'CD';
  label: string;
  organisme: string;
  dayOfMonth: number;
  amountSource: FiscalDeadlineAmountSource;
}

export const FISCAL_DEADLINE_RULES: FiscalDeadlineRule[] = [
  { id: 'bf_iuts', countryCode: 'BF', label: 'Déclaration et paiement IUTS', organisme: 'DGI', dayOfMonth: 10, amountSource: 'iuts' },
  { id: 'bf_cnss', countryCode: 'BF', label: 'Cotisations CNSS', organisme: 'CNSS', dayOfMonth: 15, amountSource: 'cnss' },
  { id: 'bf_tva', countryCode: 'BF', label: 'TVA — déclaration mensuelle', organisme: 'DGI', dayOfMonth: 20, amountSource: null },
  { id: 'bj_ipts', countryCode: 'BJ', label: 'Déclaration IPTS', organisme: 'DGI Bénin', dayOfMonth: 12, amountSource: 'iuts' },
  { id: 'cd_ipr', countryCode: 'CD', label: 'Déclaration IPR', organisme: 'DGI RDC', dayOfMonth: 7, amountSource: 'iuts' },
];

// Prochaine occurrence à venir (ou aujourd'hui même) du jour du mois donné —
// jamais une date déjà passée, pour rester "prédictif" : une échéance
// manquée ne traîne pas indéfiniment, elle bascule sur le mois suivant.
export function nextOccurrence(dayOfMonth: number, today: Date = new Date()): Date {
  const candidate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
  }
  return candidate;
}

export function severityForDueDate(dueDate: Date, today: Date = new Date()): 'critical' | 'warning' | 'info' {
  const days = Math.round((dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  if (days <= 5) return 'critical';
  if (days <= 15) return 'warning';
  return 'info';
}
