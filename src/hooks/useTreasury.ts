import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTreasuryAccount,
  getTreasuryAccounts,
  getTreasuryTransactions,
  importTreasuryStatement,
  reconcileTreasuryTransaction,
  ReconcileAction,
} from '@/services/api/treasury';
import { CreateTreasuryAccountInput, ImportRow } from '@/types/treasury';

export function useTreasuryAccountsQuery() {
  return useQuery({ queryKey: ['treasury-accounts'], queryFn: getTreasuryAccounts });
}

export function useTreasuryTransactionsQuery(accountId?: string) {
  return useQuery({
    queryKey: ['treasury-transactions', accountId],
    queryFn: () => getTreasuryTransactions(accountId),
  });
}

function useInvalidateTreasury() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
  };
}

export function useCreateTreasuryAccountMutation() {
  const invalidate = useInvalidateTreasury();
  return useMutation({
    mutationFn: (input: CreateTreasuryAccountInput) => createTreasuryAccount(input),
    onSuccess: invalidate,
  });
}

export function useImportTreasuryStatementMutation() {
  const invalidate = useInvalidateTreasury();
  return useMutation({
    mutationFn: ({ accountId, rows }: { accountId: string; rows: ImportRow[] }) => importTreasuryStatement(accountId, rows),
    onSuccess: invalidate,
  });
}

export function useReconcileTreasuryTransactionMutation() {
  const invalidate = useInvalidateTreasury();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReconcileAction }) => reconcileTreasuryTransaction(id, action),
    onSuccess: invalidate,
  });
}
