import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePaymentOrder,
  createBankTransferPayment,
  createMobileMoneyPayment,
  generateBankTransferFile,
  getPaymentOrder,
  getPaymentOrders,
  PaymentItem,
  rejectPaymentOrder,
  retryFailedTransactions,
} from '@/services/api/payments';

const ACTIVE_STATUSES = new Set(['en_attente', 'en_cours']);

export function usePaymentOrdersQuery(cycleId?: string) {
  return useQuery({
    queryKey: ['payment-orders', cycleId],
    queryFn: () => getPaymentOrders(cycleId),
  });
}

export function usePaymentOrderQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['payment-orders', 'detail', id],
    queryFn: () => getPaymentOrder(id!),
    enabled: !!id,
    refetchInterval: (query) => (ACTIVE_STATUSES.has(query.state.data?.status ?? '') ? 1500 : false),
  });
}

function useInvalidatePayments() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['payment-orders'] });
  };
}

export function useCreateMobileMoneyPaymentMutation() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: ({ cycleId, items, createdBy }: { cycleId: string; items: PaymentItem[]; createdBy: string }) =>
      createMobileMoneyPayment(cycleId, items, createdBy),
    onSuccess: invalidate,
  });
}

export function useCreateBankTransferPaymentMutation() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: ({ cycleId, items, createdBy }: { cycleId: string; items: PaymentItem[]; createdBy: string }) =>
      createBankTransferPayment(cycleId, items, createdBy),
    onSuccess: invalidate,
  });
}

export function useApprovePaymentOrderMutation() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: ({ id, validatedBy }: { id: string; validatedBy: string }) => approvePaymentOrder(id, validatedBy),
    onSuccess: invalidate,
  });
}

export function useRejectPaymentOrderMutation() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: ({ id, rejectedBy }: { id: string; rejectedBy: string }) => rejectPaymentOrder(id, rejectedBy),
    onSuccess: invalidate,
  });
}

export function useRetryFailedTransactionsMutation() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: (orderId: string) => retryFailedTransactions(orderId),
    onSuccess: invalidate,
  });
}

export function useGenerateBankTransferFileMutation() {
  return useMutation({
    mutationFn: (orderId: string) => generateBankTransferFile(orderId),
  });
}
