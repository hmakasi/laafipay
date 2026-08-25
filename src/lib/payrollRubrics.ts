// Catalogue des rubriques de bulletin — source unique partagée par
// PayrollComponentsSetup.tsx (configuration) et LivePayslipPreviewPage.tsx
// (simulation), pour qu'une rubrique activée dans la configuration soit
// résolue avec exactement le même libellé partout où elle apparaît.

// Rubriques légales, toujours actives — leurs clés sont envoyées telles
// quelles dans activeRubrics (voir services/api/payrollConfig.ts).
export const MANDATORY_RUBRIC_KEYS = ['baseSalary', 'cnss', 'its'] as const;

// Rubriques optionnelles, groupées par thème d'affichage. rubricKeys pointe
// vers payroll.componentsSetup.categories.<cat>.rubrics.<key> dans fr.json.
export const OPTIONAL_RUBRIC_CATEGORIES = [
  { key: 'housing', rubricKeys: ['housingAllowance'] },
  { key: 'health', rubricKeys: ['healthInsurance'] },
  { key: 'mobility', rubricKeys: ['transportAllowance'] },
  { key: 'performance', rubricKeys: ['performanceBonus', 'thirteenthMonth', 'benefitsInKind'] },
] as const;

export const OPTIONAL_RUBRIC_KEYS: string[] = OPTIONAL_RUBRIC_CATEGORIES.flatMap((c) => [...c.rubricKeys]);

// Clé de traduction fr.json du libellé d'une rubrique optionnelle donnée.
export function optionalRubricLabelKey(rubricKey: string): string | undefined {
  const category = OPTIONAL_RUBRIC_CATEGORIES.find((c) => (c.rubricKeys as readonly string[]).includes(rubricKey));
  return category ? `payroll.componentsSetup.categories.${category.key}.rubrics.${rubricKey}` : undefined;
}
