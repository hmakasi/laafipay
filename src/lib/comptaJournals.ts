export type JournalCode = 'OD' | 'ACH' | 'CAI' | 'BQ' | 'MM' | 'RAN' | 'IMM';

export interface JournalMeta {
  code: JournalCode;
  libelle: string;
  // Périmètre d'application — à quoi sert ce journal, affiché en aide à la
  // saisie sur le formulaire de nouvelle écriture.
  perimetre: string;
  // Compte(s) de contrepartie habituels pour ce journal — une famille de
  // comptes (ex. "60xx"), pas un code unique : affiché comme aide, jamais
  // pré-rempli automatiquement dans une ligne d'écriture.
  compteContrepartieDefaut: string;
}

export const JOURNAL_CODES: JournalCode[] = ['OD', 'ACH', 'CAI', 'BQ', 'MM', 'RAN', 'IMM'];

export const JOURNAL_META: Record<JournalCode, JournalMeta> = {
  OD: {
    code: 'OD',
    libelle: 'Journal des Opérations Diverses',
    perimetre: 'Écritures de paie générées automatiquement par la passerelle',
    compteContrepartieDefaut: 'Variable selon le cycle de paie',
  },
  ACH: {
    code: 'ACH',
    libelle: 'Journal des Achats',
    perimetre: 'Factures fournisseurs (services, matières premières, fournitures)',
    compteContrepartieDefaut: '60xx (Charges) / 401x (Fournisseurs)',
  },
  CAI: {
    code: 'CAI',
    libelle: 'Journal de Caisse',
    perimetre: 'Encaissements et décaissements exclusivement en espèces',
    compteContrepartieDefaut: '571x (Caisse)',
  },
  BQ: {
    code: 'BQ',
    libelle: 'Journal Banque',
    perimetre: 'Virements, chèques, encaissements, agios et frais bancaires',
    compteContrepartieDefaut: '521x / 512x (Banque)',
  },
  MM: {
    code: 'MM',
    libelle: 'Journal Mobile Money',
    perimetre: 'Transactions via Orange Money, MTN, Wave, Moov, etc.',
    compteContrepartieDefaut: '52x ou 57x (Compte dédié Mobile Money)',
  },
  RAN: {
    code: 'RAN',
    libelle: 'Journal Report à Nouveau',
    perimetre: 'Reprise des soldes de l’exercice N-1 vers N',
    compteContrepartieDefaut: '110x / 119x ou comptes de bilan 1 à 5',
  },
  IMM: {
    code: 'IMM',
    libelle: 'Journal Immobilisations',
    perimetre: 'Acquisitions d’actifs amortissables et dotations aux amortissements',
    compteContrepartieDefaut: '2xx (Immo) / 28xx (Amortissements) / 68xx (Dotations)',
  },
};
