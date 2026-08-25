import { PaymentOrder } from '@/types';
import { apiClient, buildQueryString } from '@/lib/apiClient';

export interface PaymentItem {
  employeeId: string;
  amount: number;
}

// `createdBy`/`validatedBy`/`rejectedBy` restent dans ces signatures pour
// ne pas devoir toucher les hooks/pages qui les fournissent déjà (ex.
// user.email), mais le serveur ignore ces valeurs : l'identité vient du
// JWT authentifié, jamais d'un champ envoyé par le client (voir
// server/src/routes/payments.routes.ts).

export async function getPaymentOrders(cycleId?: string): Promise<PaymentOrder[]> {
  return apiClient.get<PaymentOrder[]>(`/payments/orders${buildQueryString({ cycleId })}`);
}

export async function getPaymentOrder(id: string): Promise<PaymentOrder> {
  return apiClient.get<PaymentOrder>(`/payments/orders/${id}`);
}

export async function createMobileMoneyPayment(cycleId: string, items: PaymentItem[], _createdBy: string): Promise<PaymentOrder> {
  return apiClient.post<PaymentOrder>('/payments/orders/mobile-money', { cycleId, items });
}

export async function createBankTransferPayment(cycleId: string, items: PaymentItem[], _createdBy: string): Promise<PaymentOrder> {
  return apiClient.post<PaymentOrder>('/payments/orders/bank-transfer', { cycleId, items });
}

export async function approvePaymentOrder(id: string, _validatedBy: string): Promise<PaymentOrder> {
  return apiClient.post<PaymentOrder>(`/payments/orders/${id}/approve`);
}

export async function retryFailedTransactions(orderId: string): Promise<PaymentOrder> {
  return apiClient.post<PaymentOrder>(`/payments/orders/${orderId}/retry`);
}

export async function rejectPaymentOrder(id: string, _rejectedBy: string): Promise<PaymentOrder> {
  return apiClient.post<PaymentOrder>(`/payments/orders/${id}/reject`);
}

export async function generateBankTransferFile(orderId: string): Promise<Blob> {
  return apiClient.getBlob(`/payments/orders/${orderId}/bank-transfer-file`);
}
