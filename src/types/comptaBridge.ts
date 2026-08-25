// Formes réellement renvoyées par GET /api/compta/bridge-events —
// distinct de src/types/compta.ts (types du domaine LaafiCompta au
// sens large, encore mockés pour les autres modules). Ici tout vient du
// backend réel (server/src/routes/compta.routes.ts).

export type ComptaOutboxStatus = 'en_attente' | 'envoye' | 'echec';

export interface ComptaBridgeJournalLine {
  compte: string;
  libelleCompte: string;
  debit: number;
  credit: number;
}

export interface ComptaBridgeJournalEntry {
  id: string;
  journal: 'OD' | 'AC';
  piece: string;
  dateEcriture: string;
  libelle: string;
  receivedAt: string;
  lignes: ComptaBridgeJournalLine[];
  paymentValidated: boolean;
  paymentValidatedAt: string | null;
  paymentValidatedBy: string | null;
}

export interface ComptaBridgeEvent {
  id: string;
  cycleId: string;
  period: string;
  currencyCode: 'XOF' | 'CDF' | 'USD';
  status: ComptaOutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  journalEntry: ComptaBridgeJournalEntry | null;
}
