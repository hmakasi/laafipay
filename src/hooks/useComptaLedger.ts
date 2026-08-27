import { useQuery } from '@tanstack/react-query';
import { getChartOfAccounts, getJournalEntries, getTrialBalance } from '@/services/api/comptaLedger';

export function useJournalEntriesQuery(journal?: 'OD' | 'AC') {
  return useQuery({
    queryKey: ['compta-journal-entries', journal],
    queryFn: () => getJournalEntries(journal),
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
