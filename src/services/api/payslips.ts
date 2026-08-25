import { Payslip } from '@/types';
import { apiClient, buildQueryString } from '@/lib/apiClient';

export async function getPayslips(employeeId?: string, cycleId?: string): Promise<Payslip[]> {
  const qs = buildQueryString({ employeeId, cycleId });
  return apiClient.get<Payslip[]>(`/payslips${qs}`);
}

export async function getPayslip(id: string): Promise<Payslip> {
  return apiClient.get<Payslip>(`/payslips/${id}`);
}

// Régénère les bulletins d'un cycle (idempotent). Ils sont déjà générés
// automatiquement à la validation du cycle (server/src/routes/payroll.routes.ts) —
// ce bouton reste utile pour forcer un rafraîchissement.
export async function generatePayslips(cycleId: string): Promise<Payslip[]> {
  return apiClient.post<Payslip[]>(`/payslips/generate/${cycleId}`);
}

export async function sendPayslipByEmail(id: string): Promise<void> {
  return apiClient.post<void>(`/payslips/${id}/send/email`);
}

export async function sendPayslipByWhatsApp(id: string): Promise<void> {
  return apiClient.post<void>(`/payslips/${id}/send/whatsapp`);
}

export async function sendPayslipBySms(id: string): Promise<void> {
  return apiClient.post<void>(`/payslips/${id}/send/sms`);
}

export interface SendAllPayslipsResult {
  sent: number;
  failed: number;
}

export async function sendAllPayslips(cycleId: string, channel: 'email' | 'whatsapp' | 'sms'): Promise<SendAllPayslipsResult> {
  return apiClient.post<SendAllPayslipsResult>(`/payslips/send-all/${cycleId}`, { channel });
}
