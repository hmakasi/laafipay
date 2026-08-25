import { ExpenseJournalEntry, JournalLine, SettlementMethod, SupplierAccount, WhatsAppDocument } from '@/types/compta';

export const SYSCOHADA_EXPENSE_ACCOUNTS: { compte: string; libelle: string }[] = [
  { compte: '605', libelle: 'Autres achats' },
  { compte: '606', libelle: 'Achats non stockés de matières et fournitures' },
  { compte: '624', libelle: 'Entretien, réparations et maintenance' },
  { compte: '625', libelle: 'Déplacements, missions et réceptions' },
  { compte: '628', libelle: 'Services extérieurs divers' },
  { compte: '646', libelle: 'Cotisations et dons' },
];

export const SUPPLIER_ACCOUNTS: { compte: SupplierAccount; libelle: string }[] = [
  { compte: '401', libelle: 'Fournisseurs' },
  { compte: '426', libelle: 'Personnel — frais à rembourser' },
];

export const SETTLEMENT_ACCOUNTS: Record<SettlementMethod, { compte: string; libelle: string }> = {
  especes: { compte: '571', libelle: 'Caisse' },
  mobile_money: { compte: '5211', libelle: 'Mobile Money' },
  banque: { compte: '521', libelle: 'Banques' },
};

export const SETTLEMENT_LABELS: Record<SettlementMethod, string> = {
  especes: 'Espèces / Caisse',
  mobile_money: 'Mobile Money',
  banque: 'Banque',
};

// Construit l'écriture d'achat/OD générée à la validation d'un reçu :
// - Débit du compte de charge SYSCOHADA suggéré (ex. 606, 625)
// - Débit 445 (TVA récupérable) si le document porte de la TVA
// - Crédit du compte de règlement si la dépense est déjà payée par
//   l'employé (`ticket_depense`), sinon crédit du compte fournisseur
//   choisi (401/426) pour une facture à régler plus tard.
export function buildExpenseJournalEntry(doc: WhatsAppDocument): ExpenseJournalEntry {
  const lignes: JournalLine[] = [
    { compte: doc.suggestedAccount.compte, libelleCompte: doc.suggestedAccount.libelle, debit: doc.montantHT, credit: 0 },
  ];

  if (doc.tva > 0) {
    lignes.push({ compte: '445', libelleCompte: 'État — TVA récupérable', debit: doc.tva, credit: 0 });
  }

  const creditAccount =
    doc.type === 'ticket_depense'
      ? SETTLEMENT_ACCOUNTS[doc.settlementMethod]
      : SUPPLIER_ACCOUNTS.find((a) => a.compte === doc.fournisseurCompte) ?? SUPPLIER_ACCOUNTS[0];

  lignes.push({ compte: creditAccount.compte, libelleCompte: creditAccount.libelle, debit: 0, credit: doc.montantTTC });

  return {
    id: `exp_${doc.id}`,
    journal: 'AC',
    piece: `AC-${doc.id.toUpperCase()}`,
    dateEcriture: doc.receivedAt.slice(0, 10),
    libelle: `${doc.type === 'facture_achat' ? 'Facture' : 'Ticket'} ${doc.fournisseur} — WhatsApp`,
    sourceDocumentId: doc.id,
    lignes,
  };
}
