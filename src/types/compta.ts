// ============================================================
// LaafiCompta — types du domaine Comptabilité Générale SYSCOHADA
// Distincts des types RH/Paie de `@/types` : ce module modélise un
// produit séparé (workspace LaafiCompta) qui *consomme* des événements
// émis par LaafiPay plutôt que de partager son modèle de données.
// ============================================================

export type ComptaCountryCode = 'BF' | 'BJ' | 'CD';

// La passerelle Paie -> Compta (OD de paie, statut d'envoi/réception) est
// maintenant branchée sur de vraies données serveur — voir
// src/types/comptaBridge.ts et GET /api/compta/bridge-events. Les types
// qui vivaient ici (payload simulé LaafiPay -> LaafiCompta, virement,
// bordereaux) ont été retirés avec le dernier mock qui les utilisait ;
// `JournalLine` reste car le module WhatsApp Accounting (encore mocké)
// s'en sert pour ses propres écritures.

export interface JournalLine {
  compte: string;
  libelleCompte: string;
  debit: number;
  credit: number;
}

// ------------------------------------------------------------
// WhatsApp Accounting Hub
// ------------------------------------------------------------

export type WhatsAppDocumentType = 'facture_achat' | 'ticket_depense';
export type OcrStatus = 'en_cours' | 'termine' | 'echec';
export type ValidationStatus = 'en_attente' | 'valide' | 'rejete';
export type SupplierAccount = '401' | '426';
export type SettlementMethod = 'especes' | 'mobile_money' | 'banque';

export interface WhatsAppDocument {
  id: string;
  senderName: string;
  senderPhone: string;
  receivedAt: string;
  type: WhatsAppDocumentType;
  ocrStatus: OcrStatus;
  suggestedAccount: { compte: string; libelle: string };
  fournisseur: string;
  fournisseurCompte: SupplierAccount;
  settlementMethod: SettlementMethod;
  description: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  validationStatus: ValidationStatus;
}

// Écriture générée à la validation d'un reçu WhatsApp (journal Achats) :
// Débit compte de charge (6xx), Débit 445 si TVA, Crédit 401/426/571/521x
// selon que le document est une facture fournisseur à payer plus tard
// (type `facture_achat`) ou une dépense déjà réglée par l'employé (type
// `ticket_depense`, crédité au compte de règlement).
export interface ExpenseJournalEntry {
  id: string;
  journal: 'AC';
  piece: string;
  dateEcriture: string;
  libelle: string;
  sourceDocumentId: string;
  lignes: JournalLine[];
}

export interface ExpenseApprovalRequest {
  id: string;
  demandeur: string;
  manager: string;
  motif: string;
  montant: number;
  envoyeAt: string;
  statut: 'en_attente' | 'approuve' | 'refuse';
}

// La Trésorerie & Rapprochement (import de relevé, rapprochement
// automatique/manuel) est maintenant branchée sur de vraies données
// serveur — voir src/types/treasury.ts et GET /api/treasury/*.

// ------------------------------------------------------------
// Copilote Fiscal & Social
// ------------------------------------------------------------

export type DeadlineSeverity = 'info' | 'warning' | 'critical';

export interface FiscalDeadline {
  id: string;
  countryCode: ComptaCountryCode;
  label: string;
  organisme: string;
  dueDate: string;
  severity: DeadlineSeverity;
  montantEstime?: number;
}

export type LegalStatementType = 'bilan' | 'compte_resultat' | 'tafire' | 'balance_generale';

export interface LegalStatementTemplate {
  type: LegalStatementType;
  label: string;
  description: string;
}

// ------------------------------------------------------------
// Synthèse tableau de bord
// ------------------------------------------------------------

export interface TreasurySalesPurchasesPoint {
  period: string;
  tresorerie: number;
  ventes: number;
  achats: number;
}
