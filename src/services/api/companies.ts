import { User } from '@/types';
import { apiClient } from '@/lib/apiClient';

export interface CompanySignupPayload {
  company: {
    name: string;
    legalName?: string;
    ifu?: string;
    rccm?: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    cnssNumber?: string;
  };
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
