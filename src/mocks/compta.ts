import {
  ExpenseApprovalRequest,
  FiscalDeadline,
  LegalStatementTemplate,
  TreasurySalesPurchasesPoint,
  WhatsAppDocument,
} from '@/types/compta';

// La passerelle Paie -> Compta (OD de paie simulée ici auparavant) est
// désormais branchée sur GET /api/compta/bridge-events — voir
// PasserellePaieWidget.tsx / PasserellePaiePage.tsx et
// src/services/api/comptaBridge.ts. Le payload d'exemple qui vivait ici
// a été retiré avec son dernier consommateur.

// ============================================================
// Synthèse : Trésorerie / Ventes / Achats (6 derniers mois)
// ============================================================

export const mockSynthesisTrend: TreasurySalesPurchasesPoint[] = [
  { period: 'Mars', tresorerie: 28_400_000, ventes: 14_200_000, achats: 8_600_000 },
  { period: 'Avril', tresorerie: 31_100_000, ventes: 16_800_000, achats: 9_950_000 },
  { period: 'Mai', tresorerie: 29_700_000, ventes: 15_300_000, achats: 11_200_000 },
  { period: 'Juin', tresorerie: 34_500_000, ventes: 19_100_000, achats: 10_400_000 },
  { period: 'Juillet', tresorerie: 33_900_000, ventes: 17_650_000, achats: 12_800_000 },
  { period: 'Août', tresorerie: 37_200_000, ventes: 20_400_000, achats: 11_950_000 },
];

// ============================================================
// WhatsApp Accounting Hub
// ============================================================

export const mockWhatsAppDocuments: WhatsAppDocument[] = [
  {
    id: 'wa_doc_1',
    senderName: 'Aïssata Compaoré',
    senderPhone: '+226 70 12 34 56',
    receivedAt: '2026-08-24T08:14:00Z',
    type: 'facture_achat',
    ocrStatus: 'termine',
    suggestedAccount: { compte: '606', libelle: 'Achats non stockés de matières et fournitures' },
    fournisseur: 'Fournitures Bureau Plus',
    fournisseurCompte: '401',
    settlementMethod: 'banque',
    description: 'Fournitures de bureau — réassort trimestriel',
    montantHT: 185_000,
    tva: 33_300,
    montantTTC: 218_300,
    validationStatus: 'en_attente',
  },
  {
    id: 'wa_doc_2',
    senderName: 'Boureima Sawadogo',
    senderPhone: '+226 76 88 21 09',
    receivedAt: '2026-08-24T07:52:00Z',
    type: 'ticket_depense',
    ocrStatus: 'termine',
    suggestedAccount: { compte: '625', libelle: 'Déplacements, missions et réceptions' },
    fournisseur: 'Station Total Ouaga 2000',
    fournisseurCompte: '426',
    settlementMethod: 'especes',
    description: 'Carburant — mission client Bobo-Dioulasso',
    montantHT: 45_762,
    tva: 8_238,
    montantTTC: 54_000,
    validationStatus: 'en_attente',
  },
  {
    id: 'wa_doc_3',
    senderName: 'Fatimata Ouédraogo',
    senderPhone: '+226 65 40 17 82',
    receivedAt: '2026-08-23T16:30:00Z',
    type: 'facture_achat',
    ocrStatus: 'en_cours',
    suggestedAccount: { compte: '605', libelle: 'Autres achats' },
    fournisseur: 'Imprimerie Faso Print',
    fournisseurCompte: '401',
    settlementMethod: 'mobile_money',
    description: 'Impression supports commerciaux',
    montantHT: 92_000,
    tva: 16_560,
    montantTTC: 108_560,
    validationStatus: 'en_attente',
  },
  {
    id: 'wa_doc_4',
    senderName: 'Ismaël Kaboré',
    senderPhone: '+226 78 05 63 41',
    receivedAt: '2026-08-23T11:05:00Z',
    type: 'ticket_depense',
    ocrStatus: 'termine',
    suggestedAccount: { compte: '625', libelle: 'Déplacements, missions et réceptions' },
    fournisseur: 'Restaurant Le Verdoyant',
    fournisseurCompte: '426',
    settlementMethod: 'especes',
    description: 'Déjeuner d’affaires — prospect Sonabel',
    montantHT: 28_814,
    tva: 5_186,
    montantTTC: 34_000,
    validationStatus: 'valide',
  },
];

export const mockExpenseApprovals: ExpenseApprovalRequest[] = [
  { id: 'appr_1', demandeur: 'Boureima Sawadogo', manager: 'Mariam Zongo', motif: 'Carburant — mission client', montant: 54_000, envoyeAt: '2026-08-24T07:53:00Z', statut: 'en_attente' },
  { id: 'appr_2', demandeur: 'Fatimata Ouédraogo', manager: 'Mariam Zongo', motif: 'Impression supports commerciaux', montant: 108_560, envoyeAt: '2026-08-23T16:31:00Z', statut: 'en_attente' },
  { id: 'appr_3', demandeur: 'Ismaël Kaboré', manager: 'Salif Traoré', motif: 'Déjeuner d’affaires', montant: 34_000, envoyeAt: '2026-08-23T11:06:00Z', statut: 'approuve' },
];

// ============================================================
// Moteur de rapprochement Mobile Money & Banque
// Branché sur de vraies données serveur — voir src/types/treasury.ts et
// GET /api/treasury/*. Le payload d'exemple qui vivait ici a été retiré
// avec son dernier consommateur.
// ============================================================

// ============================================================
// Copilote Fiscal & Social SYSCOHADA
// ============================================================

export const mockFiscalDeadlines: FiscalDeadline[] = [
  { id: 'dl_1', countryCode: 'BF', label: 'Déclaration et paiement IUTS', organisme: 'DGI', dueDate: '2026-09-10', severity: 'critical', montantEstime: 1_664_500 },
  { id: 'dl_2', countryCode: 'BF', label: 'Cotisations CNSS', organisme: 'CNSS', dueDate: '2026-09-15', severity: 'warning', montantEstime: 4_912_600 },
  { id: 'dl_3', countryCode: 'BJ', label: 'Déclaration IPTS', organisme: 'DGI Bénin', dueDate: '2026-09-12', severity: 'warning', montantEstime: 612_000 },
  { id: 'dl_4', countryCode: 'CD', label: 'Déclaration IPR', organisme: 'DGI RDC', dueDate: '2026-09-07', severity: 'critical', montantEstime: 890 },
  { id: 'dl_5', countryCode: 'BF', label: 'TVA — déclaration mensuelle', organisme: 'DGI', dueDate: '2026-09-20', severity: 'info', montantEstime: 2_180_000 },
];

export const mockLegalStatementTemplates: LegalStatementTemplate[] = [
  { type: 'bilan', label: 'Bilan', description: 'Situation patrimoniale SYSCOHADA (actif / passif)' },
  { type: 'compte_resultat', label: 'Compte de résultat', description: 'Charges et produits de l’exercice' },
  { type: 'tafire', label: 'TAFIRE', description: 'Tableau financier des ressources et emplois' },
  { type: 'balance_generale', label: 'Balance générale', description: 'Balance des comptes, tous journaux confondus' },
];
