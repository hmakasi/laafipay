import { apiClient, buildQueryString } from '@/lib/apiClient';
import { SalaryAdvance } from '@/types';

export async function getAdvances(employeeId?: string): Promise<SalaryAdvance[]> {
  return apiClient.get<SalaryAdvance[]>(`/advances${buildQueryString({ employeeId })}`);
}

export interface AdvanceEligibility {
  maxAdvanceAmount: number;
  hasActiveAdvance: boolean;
}

export async function getAdvanceEligibility(): Promise<AdvanceEligibility> {
  return apiClient.get<AdvanceEligibility>('/advances/eligibility');
}

export async function createAdvanceRequest(amount: number): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>('/advances', { amount });
}

// `approvedBy`/`rejectedBy` restent dans ces signatures pour ne pas devoir
// toucher les hooks/pages qui les fournissent déjà (ex. user.email), mais
// le serveur ignore ces valeurs : l'identité vient du JWT authentifié,
// jamais d'un champ envoyé par le client (voir server/src/routes/advances.routes.ts).
export async function approveAdvanceRequest(id: string, _approvedBy: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/approve`);
}

export async function rejectAdvanceRequest(id: string, _rejectedBy: string, reason?: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/reject`, { reason });
}

export async function payAdvanceRequestViaMobileMoney(id: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/pay`);
}
