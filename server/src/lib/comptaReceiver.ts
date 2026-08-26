import { prisma } from './prisma.js';
import type { PayrollComptaEventPayload } from '../types/compta.js';

export type ReceivePayrollEventResult =
  | { status: 'deja_recu'; journalEntryId: string }
  | { status: 'enregistre'; journalEntryId: string };

// Logique de réception côté LaafiCompta, appelée en process direct depuis
// comptaBridge.ts (voir son en-tête pour pourquoi) et depuis la route HTTP
// POST /compta/payroll-events (conservée pour le jour où LaafiCompta
// devient un service externe qui appellera cette même route). Idempotente
// par sourceEventId : un événement rejoué (retry) ne crée jamais de
// doublon, il renvoie simplement l'écriture déjà enregistrée.
export async function receivePayrollComptaEvent(payload: PayrollComptaEventPayload): Promise<ReceivePayrollEventResult> {
  const existing = await prisma.comptaJournalEntry.findUnique({ where: { sourceEventId: payload.eventId } });
  if (existing) return { status: 'deja_recu', journalEntryId: existing.id };

  const [entryPayload] = payload.journalEntries;
  const created = await prisma.comptaJournalEntry.create({
    data: {
      companyId: payload.company.id,
      journal: entryPayload.journal,
      piece: entryPayload.piece,
      dateEcriture: new Date(entryPayload.dateEcriture),
      libelle: entryPayload.libelle,
      sourceSystem: payload.source,
      sourceEventId: payload.eventId,
      lignes: {
        create: entryPayload.lignes.map((l) => ({
          compte: l.compte,
          libelleCompte: l.libelleCompte,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });

  return { status: 'enregistre', journalEntryId: created.id };
}
