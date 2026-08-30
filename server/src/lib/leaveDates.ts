// Format attendu depuis la conversation WhatsApp : JJ/MM/AAAA (voir spec
// docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md, Flux 2 étape 3).
const FRENCH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function parseFrenchDate(input: string): Date | null {
  const match = FRENCH_DATE_PATTERN.exec(input.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejette les dates impossibles (ex. 31/02) — Date corrige silencieusement
  // en débordant sur le mois suivant, donc on vérifie que le round-trip est fidèle.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

// Volontairement identique à la formule déjà utilisée par le portail
// (server/src/routes/leaves.routes.ts, POST /) : jours calendaires inclusifs,
// pas de jours ouvrés. Les deux canaux doivent produire le même
// LeaveRequest.daysCount pour les mêmes dates — voir la section
// "Corrections found while planning" du plan d'implémentation.
export function computeLeaveDaysCount(startDate: Date, endDate: Date): number {
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}
