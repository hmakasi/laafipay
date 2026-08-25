import { apiClient } from '@/lib/apiClient';
import { ComptaBridgeEvent } from '@/types/comptaBridge';

export async function getComptaBridgeEvents(): Promise<ComptaBridgeEvent[]> {
  return apiClient.get<ComptaBridgeEvent[]>('/compta/bridge-events');
}

interface PaymentValidationResult {
  id: string;
  paymentValidated: boolean;
  paymentValidatedAt: string | null;
  paymentValidatedBy: string | null;
}

export async function setJournalEntryPaymentValidation(journalEntryId: string, validated: boolean): Promise<PaymentValidationResult> {
  return apiClient.patch<PaymentValidationResult>(`/compta/journal-entries/${journalEntryId}/payment-validation`, { validated });
}
