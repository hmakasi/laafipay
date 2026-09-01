import {
  AmendmentType,
  ContractStatus,
  ContractType,
  CountryCode,
  CurrencyCode,
  EmployeeStatus,
  Gender,
  LeaveType,
  MaritalStatus,
  MobileMoneyOperator,
  PaymentMethod,
  UserRole,
} from '@/types';

// ============================================================
// Pays & devises (moteur de paie multi-pays)
// ============================================================

export interface CountryMeta {
  code: CountryCode;
  name: string;
  flag: string;
  currencies: CurrencyCode[]; // devises disponibles à la création d'entreprise
  defaultCurrency: CurrencyCode;
  taxIdLabel: string; // libellé de l'identifiant fiscal, propre au pays
  socialAgencyLabel: string; // "CNSS"/"INSS" selon le pays — jamais "URSSAF"
  // Nom de l'impôt sur salaire prélevé à la source, propre au pays (IUTS au
  // Burkina Faso, ITS au Bénin) — affiché sur la ligne "impôt" du simulateur
  // et du bulletin officiel. Seuls les libellés changent ici, jamais les
  // taux/tranches (saisis par l'entreprise dans Barèmes légaux).
  incomeTaxLabel: string;
  // Ordre d'affichage des deux identifiants employeur sur le bloc gauche du
  // bulletin officiel (PayslipOfficialTemplate) et de l'aperçu
  // (PayslipEmployerHeader). Seul le Bénin a une exigence connue à date
  // (CNSS avant IFU) ; les autres pays gardent l'ordre historique en
  // attendant leur propre spec.
  employerNumbersOrder: Array<'taxId' | 'cnss'>;
  // Champs du bloc employeur dont l'absence sur le bulletin n'est pas
  // acceptable pour ce pays — utilisé par CompanySettingsPage pour rendre
  // ces champs obligatoires. Le nom (name) est toujours requis, quel que
  // soit le pays, donc absent de cette liste.
  requiredEmployerFields: Array<'address' | 'taxId' | 'cnss'>;
}

export const COUNTRY_CODES: CountryCode[] = ['BF', 'BJ', 'CD'];

export const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  BF: {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    currencies: ['XOF'],
    defaultCurrency: 'XOF',
    taxIdLabel: "Numéro NIF (Numéro d'Identifiant Fiscal)",
    socialAgencyLabel: 'CNSS',
    incomeTaxLabel: 'IUTS',
    employerNumbersOrder: ['taxId', 'cnss'],
    requiredEmployerFields: [],
  },
  BJ: {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    currencies: ['XOF'],
    defaultCurrency: 'XOF',
    taxIdLabel: 'Numéro IFU (Identifiant Fiscal Unique)',
    socialAgencyLabel: 'CNSS',
    incomeTaxLabel: 'ITS',
    // Entête employeur bulletin béninois : nom, adresse, N° CNSS puis N° IFU.
    employerNumbersOrder: ['cnss', 'taxId'],
    requiredEmployerFields: ['address', 'cnss', 'taxId'],
  },
  CD: {
    code: 'CD',
    name: 'RDC',
    flag: '🇨🇩',
    currencies: ['CDF', 'USD'],
    defaultCurrency: 'CDF',
    taxIdLabel: 'Numéro Impôt / ID.NAT',
    socialAgencyLabel: 'INSS',
    incomeTaxLabel: 'IUTS',
    employerNumbersOrder: ['taxId', 'cnss'],
    requiredEmployerFields: [],
  },
};

// Devise d'AFFICHAGE des tarifs LaafiPay (landing page), distincte de
// COUNTRY_META.defaultCurrency qui décrit la devise de PAIE d'une entreprise.
// La RDC facture en USD même quand une entreprise choisit de payer ses
// salariés en CDF — les deux notions ne doivent pas être confondues.
export const PRICING_CURRENCY_LABEL: Record<CountryCode, string> = {
  BF: 'FCFA',
  BJ: 'FCFA',
  CD: '$ USD',
};

export const USER_ROLES: UserRole[] = ['admin', 'hr_manager', 'manager', 'accountant', 'employee'];

export const CONTRACT_TYPES: ContractType[] = ['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant'];

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'actif',
  'periode_essai',
  'en_conge',
  'suspendu',
  'offboarded',
];

export const PAYMENT_METHODS: PaymentMethod[] = ['mobile_money', 'virement', 'mixte', 'especes'];

export const MOBILE_MONEY_OPERATORS: MobileMoneyOperator[] = ['orange', 'moov', 'telecel'];

export const MARITAL_STATUSES: MaritalStatus[] = ['celibataire', 'marie', 'divorce', 'veuf'];

export const GENDERS: Gender[] = ['M', 'F'];

export const EMPLOYEE_STATUS_VARIANT: Record<EmployeeStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  actif: 'success',
  periode_essai: 'warning',
  en_conge: 'secondary',
  suspendu: 'destructive',
  offboarded: 'secondary',
};

export const CONTRACT_STATUSES: ContractStatus[] = ['actif', 'termine', 'rompu'];

export const AMENDMENT_TYPES: AmendmentType[] = [
  'renouvellement',
  'changement_poste',
  'changement_salaire',
  'changement_departement',
  'prolongation',
  'autre',
];

export const CONTRACT_STATUS_VARIANT: Record<ContractStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  actif: 'success',
  termine: 'secondary',
  rompu: 'destructive',
};

export const PAYROLL_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive' | 'default'> = {
  brouillon: 'secondary',
  en_cours: 'warning',
  valide: 'default',
  paye: 'success',
  archive: 'secondary',
};

export const PAYMENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  en_attente: 'secondary',
  en_cours: 'warning',
  reussi: 'success',
  echoue: 'destructive',
  annule: 'secondary',
};

export const ADVANCE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'accent' | 'destructive'> = {
  en_attente: 'secondary',
  approuve: 'warning',
  rejete: 'destructive',
  verse_mobile_money: 'accent',
  en_remboursement: 'warning',
  rembourse: 'success',
};

export const SEND_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  non_envoye: 'secondary',
  envoye: 'success',
  lu: 'success',
  echoue: 'destructive',
};

export const LEAVE_TYPES: LeaveType[] = [
  'conge_paye',
  'maladie',
  'sans_solde',
  'evenement_familial',
  'maternite',
  'paternite',
  'recuperation',
];

export const LEAVE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  en_attente: 'warning',
  valide: 'success',
  refuse: 'destructive',
  annule: 'secondary',
};

export const REVIEW_CYCLE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  brouillon: 'secondary',
  ouvert: 'warning',
  cloture: 'success',
};

export const REVIEW_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  planifie: 'secondary',
  en_cours: 'warning',
  termine: 'success',
};
