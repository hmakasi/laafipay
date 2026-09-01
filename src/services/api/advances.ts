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

export async function approveAdvanceRequest(id: string, approvedBy: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/approve`, { approvedBy });
}

export async function rejectAdvanceRequest(id: string, rejectedBy: string, reason?: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/reject`, { rejectedBy, reason });
}

export async function payAdvanceRequestViaMobileMoney(id: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/pay`);
}
