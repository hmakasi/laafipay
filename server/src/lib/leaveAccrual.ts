// Règle d'acquisition des congés payés : 2 jours ouvrables par mois de
// service effectif complet depuis la date d'embauche (24 j/an), cumulés
// depuis l'embauche — pas de remise à zéro annuelle ni de report géré ici.
export const LEAVE_ACCRUAL_DAYS_PER_MONTH = 2;

export function fullMonthsElapsed(hireDate: Date, asOf: Date): number {
  let months =
    (asOf.getUTCFullYear() - hireDate.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - hireDate.getUTCMonth());
  if (asOf.getUTCDate() < hireDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function computeCongePayeAccrual(hireDate: Date, asOf: Date = new Date()) {
  const monthsElapsed = fullMonthsElapsed(hireDate, asOf);
  return {
    acquired: monthsElapsed * LEAVE_ACCRUAL_DAYS_PER_MONTH,
    // Le mois en cours (non encore complet) : ses jours sont en cours
    // d'acquisition, pas encore disponibles tant que le mois n'est pas clos.
    accruing: LEAVE_ACCRUAL_DAYS_PER_MONTH,
  };
}

// Congé supplémentaire pour ancienneté (Code du travail burkinabè, Loi
// n°028-2008/AN) : 1 jour ouvrable par tranche complète de 5 années de
// service continu, cumulatif, sans plafond.
export const ANCIENNETE_YEARS_PER_TRANCHE = 5;

export function computeAncienneteAccrual(hireDate: Date, asOf: Date = new Date()) {
  const monthsElapsed = fullMonthsElapsed(hireDate, asOf);
  const fullYears = Math.floor(monthsElapsed / 12);
  const tranches = Math.floor(fullYears / ANCIENNETE_YEARS_PER_TRANCHE);
  return { acquired: tranches };
}
