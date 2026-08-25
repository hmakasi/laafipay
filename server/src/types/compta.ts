// Contrat JSON de la passerelle LaafiPay → LaafiCompta. Vit des deux
// côtés (émetteur dans comptaBridge.ts, récepteur dans compta.routes.ts)
// tant que les deux produits partagent le même process/repo — le jour où
// LaafiCompta devient un service séparé, ce fichier est ce qui doit être
// publié/partagé entre les deux dépôts (ou versionné en JSON Schema).

export interface ComptaJournalLinePayload {
  compte: string;
  libelleCompte: string;
  debit: number;
  credit: number;
}

export interface ComptaJournalEntryPayload {
  journal: 'OD' | 'AC';
  piece: string;
  dateEcriture: string;
  libelle: string;
}

export interface PayrollComptaEventPayload {
  eventId: string;
  eventType: 'payroll.cycle.valide';
  emittedAt: string;
  source: 'LaafiPay';
  company: {
    id: string;
    name: string;
    countryCode: string;
    currencyCode: string;
  };
  payrollCycle: {
    id: string;
    period: string;
    employeeCount: number;
    totalGrossSalary: number;
    totalEmployerCost: number;
    totalNet: number;
    validatedAt: string;
    validatedBy: string;
  };
  journalEntries: Array<ComptaJournalEntryPayload & { lignes: ComptaJournalLinePayload[] }>;
}
