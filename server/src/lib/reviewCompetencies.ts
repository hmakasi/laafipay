// Liste par défaut tant qu'une entreprise n'a pas configuré la sienne
// (voir GET /companies/review-config) — miroir léger de payrollRubrics.ts,
// juste des libellés ici (pas de champs propres comme taxable/cnssContributable).
export const DEFAULT_COMPETENCIES = [
  'Qualité du travail',
  'Communication',
  "Travail d'équipe",
  'Autonomie',
  'Ponctualité',
];
