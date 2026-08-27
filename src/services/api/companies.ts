import { Company, CountryCode, CurrencyCode } from '@/types';
import { apiClient } from '@/lib/apiClient';

export interface CompanySignupPayload {
  companyName: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Plus de compte créé ni de token renvoyé : la demande est mise en attente,
// un admin LaafiPay l'approuve depuis /admin/signup-requests, ce qui génère
// le mot de passe et envoie les identifiants par e-mail.
export async function signupCompany(payload: CompanySignupPayload): Promise<{ status: 'en_attente' }> {
  return apiClient.post<{ status: 'en_attente' }>('/companies/signup', payload);
}

// Création d'une entreprise supplémentaire par un utilisateur déjà authentifié
// (à distinguer de signupCompany, qui crée le tout premier compte admin).
export interface CreateCompanyPayload {
  name: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  taxIdNumber: string;
  socialSecurityNumber?: string;
}

export async function createCompany(payload: CreateCompanyPayload): Promise<Company> {
  return apiClient.post<Company>('/companies', payload);
}

// Entreprise de l'utilisateur connecté — accessible à tous les rôles
// authentifiés côté serveur (server/src/routes/companies.routes.ts), pas
// seulement à settings:read : c'est un contexte d'affichage (nom, pays,
// devise), pas un réglage privilégié.
export async function getCurrentCompany(): Promise<Company> {
  return apiClient.get<Company>('/companies/me');
}

// Champs de profil éditables — countryCode/currencyCode volontairement
// exclus : server/src/routes/companies.routes.ts les refuse aussi (les
// changer rouvrirait la question des paies déjà calculées dans l'ancien
// pays/l'ancienne devise).
export type UpdateCompanyPayload = Partial<
  Pick<
    Company,
    | 'name'
    | 'legalName'
    | 'taxIdNumber'
    | 'rccm'
    | 'address'
    | 'postalCode'
    | 'city'
    | 'activityCode'
    | 'collectiveAgreement'
    | 'socialSecurityNumber'
    | 'phone'
    | 'email'
    | 'logo'
  >
>;

export async function updateCompany(payload: UpdateCompanyPayload): Promise<Company> {
  return apiClient.patch<Company>('/companies/me', payload);
}

export async function uploadCompanyLogo(file: File): Promise<Company> {
  const formData = new FormData();
  formData.append('logo', file);
  return apiClient.post<Company>('/companies/me/logo', formData);
}
