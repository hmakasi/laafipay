-- Renomme le journal Achats existant (AC -> ACH) puis ajoute les nouveaux
-- journaux : Caisse (CAI), Banque (BQ), Mobile Money (MM), Report à
-- Nouveau (RAN), Immobilisations (IMM).
ALTER TYPE "ComptaJournalCode" RENAME VALUE 'AC' TO 'ACH';
ALTER TYPE "ComptaJournalCode" ADD VALUE 'CAI';
ALTER TYPE "ComptaJournalCode" ADD VALUE 'BQ';
ALTER TYPE "ComptaJournalCode" ADD VALUE 'MM';
ALTER TYPE "ComptaJournalCode" ADD VALUE 'RAN';
ALTER TYPE "ComptaJournalCode" ADD VALUE 'IMM';
