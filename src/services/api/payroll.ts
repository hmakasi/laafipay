import { LegalSettings, PayrollCycle, PayrollEntry } from '@/types';
import { apiClient } from '@/lib/apiClient';
import { PayrollEntryInput } from '@/lib/payrollEngine';

export async function getPayrollCycles(): Promise<PayrollCycle[]> {
  return apiClient.get<PayrollCycle[]>('/payroll/cycles');
}

export async function getPayrollCycle(id: string): Promise<PayrollCycle> {
  return apiClient.get<PayrollCycle>(`/payroll/cycles/${id}`);
}

export async function createPayrollCycle(period: string): Promise<PayrollCycle> {
  return apiClient.post<PayrollCycle>('/payroll/cycles', { period });
}

export async function validatePayrollCycle(id: string, validatedBy: string): Promise<PayrollCycle> {
  return apiClient.post<PayrollCycle>(`/payroll/cycles/${id}/validate`, { validatedBy });
}

export async function updatePayrollEntry(
  cycleId: string,
  entryId: string,
  data: Partial<PayrollEntryInput>
): Promise<PayrollEntry> {
  return apiClient.patch<PayrollEntry>(`/payroll/cycles/${cycleId}/entries/${entryId}`, data);
}

export async function getLegalSettings(): Promise<LegalSettings[]> {
  return apiClient.get<LegalSettings[]>('/payroll/legal-settings');
}

export async function createLegalSettings(data: Omit<LegalSettings, 'id' | 'createdAt'>): Promise<LegalSettings> {
  return apiClient.post<LegalSettings>('/payroll/legal-settings', data);
}

export async function getAuditTrail(cycleId: string) {
  return apiClient.get(`/payroll/cycles/${cycleId}/audit-trail`);
}
