import { Company, CountryCode, CurrencyCode, User } from '@/types';
import { apiClient } from '@/lib/apiClient';

export interface CompanySignupPayload {
  companyName: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };
}

interface SignupResponse {
  token: string;
  user: User;
}

export async function signupCompany(payload: CompanySignupPayload): Promise<SignupResponse> {
  return apiClient.post<SignupResponse>('/companies/signup', payload);
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
