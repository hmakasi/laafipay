import { describe, it, expect } from 'vitest';
import { ComptaJournalCode as PrismaComptaJournalCode } from '@prisma/client';

// Régression : `ComptaJournalEntry.journal` est un enum Postgres natif
// (server/prisma/schema.prisma), distinct de la liste zod `JOURNAL_CODES`
// (compta.routes.ts) et du registre `JOURNAL_META` (src/lib/comptaJournals.ts).
// Ajouter un journal côté zod/registre sans l'ajouter (+ migration) côté
// schema.prisma fait planter `prisma.comptaJournalEntry.create()` — même
// classe de bug que le pays Sénégal manquant côté CountryCode (2026-09-14).
describe('Prisma ComptaJournalCode enum — journaux supportés', () => {
  it('inclut OD, ACH, CAI, BQ, MM, RAN et IMM', () => {
    expect(Object.keys(PrismaComptaJournalCode).sort()).toEqual(['ACH', 'BQ', 'CAI', 'IMM', 'MM', 'OD', 'RAN']);
  });
});
