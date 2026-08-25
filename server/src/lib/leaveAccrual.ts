// Règle d'acquisition des congés payés : 2 jours ouvrables par mois de
// service effectif complet depuis la date d'embauche (24 j/an), cumulés
// depuis l'embauche — pas de remise à zéro annuelle ni de report géré ici.
export const LEAVE_ACCRUAL_DAYS_PER_MONTH = 2;

function fullMonthsElapsed(hireDate: Date, asOf: Date): number {
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
