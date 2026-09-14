import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createJournalEntry,
  CreateJournalEntryInput,
  getChartOfAccounts,
  getJournalEntries,
  getTrialBalance,
} from '@/services/api/comptaLedger';
import { JournalCode } from '@/types/compta';

export function useJournalEntriesQuery(journal?: JournalCode) {
  return useQuery({
    queryKey: ['compta-journal-entries', journal],
    queryFn: () => getJournalEntries(journal),
  });
}

export function useCreateJournalEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJournalEntryInput) => createJournalEntry(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compta-journal-entries'] }),
  });
}

export function useTrialBalanceQuery() {
  return useQuery({
    queryKey: ['compta-trial-balance'],
    queryFn: getTrialBalance,
  });
}

export function useChartOfAccountsQuery() {
  return useQuery({
    queryKey: ['compta-chart-of-accounts'],
    queryFn: getChartOfAccounts,
  });
}
