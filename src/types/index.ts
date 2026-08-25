// ============================================================
// Roles & Permissions
// ============================================================

export type UserRole =
  | 'admin'
  | 'hr_manager'
  | 'manager'
  | 'accountant'
  | 'employee';

export type Permission =
  // Employees
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  // Payroll
  | 'payroll:read'
  | 'payroll:write'
  | 'payroll:approve'
  | 'payroll:settings'
  // Payments
  | 'payments:read'
  | 'payments:initiate'
  | 'payments:validate'
  // Payslips
  | 'payslips:read'
  | 'payslips:generate'
  | 'payslips:send'
  // Leaves
  | 'leaves:read'
  | 'leaves:write'
  | 'leaves:approve'
  | 'leaves:read_team'
  // Reviews (entretiens annuels)
  | 'reviews:read'
  | 'reviews:write'
  | 'reviews:manage_team'
  // Reports
  | 'reports:read'
  | 'reports:export'
  // Admin
  | 'users:read'
  | 'users:write'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read'
  // Self-service
  | 'self:payslips'
  | 'self:leaves'
  | 'self:profile'
  | 'self:reviews';

// ============================================================
// User & Auth
// ============================================================

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  avatar?: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ============================================================
// Company / Organisation
// ============================================================

// Pays supportés par le moteur de paie multi-pays (BF/BJ/CD pour l'instant —
// voir server/src/payroll/strategy-factory.ts côté backend).
export type CountryCode = 'BF' | 'BJ' | 'CD';
export type CurrencyCode = 'XOF' | 'CDF' | 'USD';

export interface Company {
  id: string;
  name: string;
  legalName: string;
  rccm: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  taxIdNumber: string; // NIF (BF) / IFU (BJ) / ID.NAT (CD) — libellé résolu via COUNTRY_META
  socialSecurityNumber: string; // N° immatriculation employeur — CNSS (BF/BJ) / INSS (CD)
  address: string;
  postalCode?: string;
  city: string;
  activityCode?: string; // Code APE / secteur d'activité
  collectiveAgreement?: string; // Convention collective applicable
  phone: string;
  email: string;
  logo?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  managerId?: string;
  parentId?: string;
}

// ============================================================
// Employee
// ============================================================

export type ContractType = 'CDI' | 'CDD' | 'Stage' | 'Journalier' | 'Consultant';
export type EmployeeStatus = 'actif' | 'periode_essai' | 'en_conge' | 'suspendu' | 'offboarded';
export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf';
export type Gender = 'M' | 'F';
export type PaymentMethod = 'mobile_money' | 'virement' | 'mixte' | 'especes';
export type MobileMoneyOperator = 'orange' | 'moov' | 'telecel';

export interface MobileMoneyInfo {
  operator: MobileMoneyOperator;
  phoneNumber: string;
  accountName: string;
}

export interface BankInfo {
  bankName: string;
  iban: string;
  rib: string;
  accountHolder: string;
}

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  maritalStatus: MaritalStatus;
  numberOfChildren: number;
  email: string;
  phone: string;
  address: string;
  city: string;
  // Contract
  contractType: ContractType;
  status: EmployeeStatus;
  hireDate: string;
  trialEndDate?: string;
  contractEndDate?: string;
  // Position
  position: string;
  departmentId: string;
  managerId?: string;
  siteLocation: string;
  // Salary
  baseSalary: number;
  paymentMethod: PaymentMethod;
  mobileMoneyInfo?: MobileMoneyInfo;
  bankInfo?: BankInfo;
  // CNSS
  cnssNumber?: string;
  iutsCategory: number; // 1-8
  // Meta
  avatar?: string;
  documents: EmployeeDocument[];
  careerHistory: CareerEvent[];
  onboardingStatus?: OnboardingStatus;
}

export interface EmployeeDocument {
  id: string;
  type: 'contrat' | 'avenant' | 'piece_identite' | 'diplome' | 'attestation' | 'autre';
  name: string;
  uploadedAt: string;
  url: string;
  size: number;
}

export interface CareerEvent {
  id: string;
  date: string;
  type:
    | 'embauche'
    | 'promotion'
    | 'mutation'
    | 'augmentation'
    | 'avertissement'
    | 'fin_essai'
    | 'nouveau_contrat'
    | 'avenant';
  description: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
}

export type ContractStatus = 'actif' | 'termine' | 'rompu';
export type AmendmentType =
  | 'renouvellement'
  | 'changement_poste'
  | 'changement_salaire'
  | 'changement_departement'
  | 'prolongation'
  | 'autre';

export interface ContractAmendment {
  id: string;
  type: AmendmentType;
  effectiveDate: string;
  description: string;
  previousValue?: string;
  newValue?: string;
  createdBy: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  employeeId: string;
  contractNumber?: string;
  contractType: ContractType;
  startDate: string;
  endDate?: string;
  trialEndDate?: string;
  position: string;
  departmentId: string;
  baseSalary: number;
  status: ContractStatus;
  isCurrent: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  amendments: ContractAmendment[];
}

export interface OnboardingStatus {
  contractSigned: boolean;
  cnssRegistered: boolean;
  equipmentProvided: boolean;
  accessGranted: boolean;
  trainingCompleted: boolean;
  bankInfoProvided: boolean;
  photoTaken: boolean;
}

// ============================================================
// Payroll
// ============================================================

export type PayrollStatus = 'brouillon' | 'en_cours' | 'valide' | 'paye' | 'archive';

export interface PayrollCycle {
  id: string;
  period: string; // "2025-07"
  month: number;
  year: number;
  status: PayrollStatus;
  createdAt: string;
  validatedAt?: string;
  validatedBy?: string;
  totalBrut: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  entries: PayrollEntry[];
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  cycleId: string;
  baseSalary: number;
  // Variables
  overtimeHours: number;
  overtimeAmount: number;
  primes: VariableElement[];
  indemnites: VariableElement[];
  avances: VariableElement[];
  retenues: VariableElement[];
  absenceDays: number;
  absenceAmount: number;
  // Computed
  salaireBrut: number;
  cnssEmployee: number;  // 5.5%
  cnssEmployer: number;  // 16%
  iuts: number;
  salaireNet: number;
  coutEmployeur: number;
  // Status
  status: 'brouillon' | 'valide';
}

export interface VariableElement {
  id: string;
  label: string;
  amount: number;
  type: 'prime' | 'indemnite' | 'avance' | 'retenue';
}

export interface LegalSettings {
  id: string;
  effectiveDate: string;
  smig: number;              // Salaire Minimum Interprofessionnel Garanti
  cnssEmployeeRate: number;  // % employee contribution
  cnssEmployerRate: number;  // % employer contribution
  iutsBrackets: IutsBracket[];
  createdBy: string;
  createdAt: string;
}

export interface IutsBracket {
  min: number;
  max: number | null;
  rate: number;
  deduction: number;
}

// ============================================================
// Payments
// ============================================================

export type PaymentStatus = 'en_attente' | 'en_cours' | 'reussi' | 'echoue' | 'annule';
export type PaymentType = 'mobile_money' | 'virement' | 'especes';

export interface PaymentOrder {
  id: string;
  cycleId: string;
  createdAt: string;
  createdBy: string;
  validatedAt?: string;
  validatedBy?: string;
  status: PaymentStatus;
  type: PaymentType;
  totalAmount: number;
  transactions: PaymentTransaction[];
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  employeeId: string;
  amount: number;
  status: PaymentStatus;
  type: PaymentType;
  operator?: MobileMoneyOperator;
  phoneNumber?: string;
  reference?: string;
  processedAt?: string;
  errorMessage?: string;
  retryCount: number;
}

// ============================================================
// Salary Advances
// ============================================================

export type AdvanceStatus = 'demande_whatsapp' | 'approuve' | 'verse_mobile_money' | 'deduit';

export interface SalaryAdvanceRequest {
  id: string;
  employeeId: string;
  amount: number;
  requestedAt: string;
  channel: 'whatsapp' | 'portail';
  status: AdvanceStatus;
  approvedAt?: string;
  approvedBy?: string;
  mobileMoneyOperator?: MobileMoneyOperator;
  reference?: string;
  paidAt?: string;
  deductedAt?: string;
}

// ============================================================
// Payslip
// ============================================================

// Contrat générique renvoyé par le moteur de paie multi-pays (une ligne par
// retenue/charge produite par la stratégie du pays — IUTS+CNSS pour le BF,
// IRPP+CNSS pour le BJ, IPR+CNSS+INPP+ONEM+Taxe d'apprentissage pour la RDC).
// Distinct du type `Payslip` ci-dessous, qui reste la forme actuellement
// renvoyée par l'API/les mocks (champs BF figés : iuts, cnssEmployee...).
// PayslipView.tsx consomme PayslipResult ; le brancher sur les pages
// existantes (PayslipPreviewDialog, MyPayslipsTab...) suppose que l'API
// renvoie déjà ce nouveau format, ce qui n'est pas encore le cas ici.
export interface PayslipLineItem {
  code: string; // 'IUTS' | 'IRPP' | 'IPR' | 'CNSS' | 'INPP' | 'ONEM' | 'TAXE_APPRENTISSAGE' | ...
  label: string;
  baseAmount: number;
  rateApplied: number; // fraction, ex. 0.055 = 5,5%
  employeeAmount: number;
  employerAmount: number;
}

export interface PayslipResult {
  currencyCode: CurrencyCode;
  grossSalary: number;
  taxableGross: number;
  employeeContributions: number; // IUTS/IRPP/IPR + part salariale CNSS
  employerContributions: number; // part patronale CNSS + INPP + ONEM + Taxe Apprentissage
  netSalary: number;
  lineItems: PayslipLineItem[];
}

export type PayslipSendStatus = 'non_envoye' | 'envoye' | 'lu' | 'echoue';

export interface Payslip {
  id: string;
  employeeId: string;
  cycleId: string;
  period: string;
  generatedAt: string;
  generatedBy: string;
  emailStatus: PayslipSendStatus;
  whatsappStatus: PayslipSendStatus;
  smsStatus: PayslipSendStatus;
  emailSentAt?: string;
  whatsappSentAt?: string;
  smsSentAt?: string;
  // Financial data (denormalized)
  baseSalary: number;
  overtimeAmount: number;
  salaireBrut: number;
  cnssEmployee: number;
  cnssEmployer: number;
  cnssEmployeeRate: number; // fraction, ex. 0.055 = 5,5% — dérivé du barème figé sur le cycle
  cnssEmployerRate: number; // fraction
  iuts: number;
  iutsBase: number;
  iutsRate: number; // fraction
  coutEmployeur: number;
  salaireNet: number;
  primes: VariableElement[];
  indemnites: VariableElement[];
  avances: VariableElement[];
  retenues: VariableElement[];
}

// ============================================================
// Leaves
// ============================================================

export type LeaveType =
  | 'conge_paye'
  | 'maladie'
  | 'sans_solde'
  | 'evenement_familial'
  | 'maternite'
  | 'paternite'
  | 'recuperation';

export type LeaveStatus = 'en_attente' | 'valide' | 'refuse' | 'annule';
export type LeaveChannel = 'portail' | 'whatsapp';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
  status: LeaveStatus;
  channel: LeaveChannel;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  type: LeaveType;
  acquired: number;
  taken: number;
  remaining: number;
  pending: number;
}

/** Compteur de congés payés (2 j ouvrables/mois de service, cumulés depuis l'embauche). */
export interface LeaveDashboard {
  employeeId: string;
  acquired: number;
  accruing: number;
  taken: number;
  remaining: number;
}

// ============================================================
// Notifications
// ============================================================

export type NotificationType =
  | 'bulletin_disponible'
  | 'conge_valide'
  | 'conge_refuse'
  | 'paiement_effectue'
  | 'paiement_echoue'
  | 'contrat_expire'
  | 'essai_termine'
  | 'action_requise';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// ============================================================
// Audit
// ============================================================

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

// ============================================================
// Common / Pagination
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface FilterParams {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}
