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

// `validatedBy` reste dans cette signature pour ne pas devoir toucher les
// hooks/pages qui le fournissent déjà (ex. user.email), mais le serveur
// ignore cette valeur : l'identité vient du JWT authentifié, jamais d'un
// champ envoyé par le client (voir server/src/routes/payroll.routes.ts).
export async function validatePayrollCycle(id: string, _validatedBy: string): Promise<PayrollCycle> {
  return apiClient.post<PayrollCycle>(`/payroll/cycles/${id}/validate`);
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

export async function deleteLegalSettings(id: string): Promise<void> {
  return apiClient.delete<void>(`/payroll/legal-settings/${id}`);
}

export async function getAuditTrail(cycleId: string) {
  return apiClient.get(`/payroll/cycles/${cycleId}/audit-trail`);
}
