import { apiClient } from '@/lib/apiClient';
import { AdminCompany, SignupRequest } from '@/types';

export async function getSignupRequests(status?: SignupRequest['status']): Promise<SignupRequest[]> {
  const qs = status ? `?status=${status}` : '';
  return apiClient.get<SignupRequest[]>(`/admin/signup-requests${qs}`);
}

export interface ApproveSignupRequestResult {
  status: 'approuve';
  emailSent: boolean;
  emailError?: string;
  // Uniquement présent si l'e-mail n'a pas pu être envoyé — à transmettre
  // manuellement dans ce cas (voir server/src/routes/admin.routes.ts).
  temporaryPassword?: string;
}

export async function approveSignupRequest(id: string): Promise<ApproveSignupRequestResult> {
  return apiClient.post<ApproveSignupRequestResult>(`/admin/signup-requests/${id}/approve`);
}

export async function rejectSignupRequest(id: string, reason?: string): Promise<void> {
  return apiClient.post<void>(`/admin/signup-requests/${id}/reject`, { reason });
}

export async function getAdminCompanies(archived = false): Promise<AdminCompany[]> {
  return apiClient.get<AdminCompany[]>(`/admin/companies?archived=${archived}`);
}

export async function updateAdminCompany(id: string, data: { name?: string; legalName?: string }): Promise<AdminCompany> {
  return apiClient.patch<AdminCompany>(`/admin/companies/${id}`, data);
}

export async function archiveAdminCompany(id: string): Promise<void> {
  return apiClient.post<void>(`/admin/companies/${id}/archive`);
}

export async function restoreAdminCompany(id: string): Promise<void> {
  return apiClient.post<void>(`/admin/companies/${id}/restore`);
}
