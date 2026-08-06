import {
  ContractType,
  EmployeeStatus,
  Gender,
  LeaveType,
  MaritalStatus,
  MobileMoneyOperator,
  PaymentMethod,
  UserRole,
} from '@/types';

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

export const ADVANCE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'accent'> = {
  demande_whatsapp: 'secondary',
  approuve: 'warning',
  verse_mobile_money: 'success',
  deduit: 'accent',
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
