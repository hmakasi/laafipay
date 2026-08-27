import { apiClient } from '@/lib/apiClient';
import { ChartOfAccountsEntry, ComptaJournalEntryDTO, TrialBalance } from '@/types/compta';

export async function getJournalEntries(journal?: 'OD' | 'AC'): Promise<ComptaJournalEntryDTO[]> {
  const qs = journal ? `?journal=${journal}` : '';
  return apiClient.get<ComptaJournalEntryDTO[]>(`/compta/journal-entries${qs}`);
}

export async function getTrialBalance(): Promise<TrialBalance> {
  return apiClient.get<TrialBalance>('/compta/trial-balance');
}

export async function getChartOfAccounts(): Promise<ChartOfAccountsEntry[]> {
  return apiClient.get<ChartOfAccountsEntry[]>('/compta/chart-of-accounts');
}
