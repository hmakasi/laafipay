import { apiClient } from '@/lib/apiClient';
import { ChartOfAccountsEntry, ComptaJournalEntryDTO, JournalCode, TrialBalance } from '@/types/compta';
import { JournalLine } from '@/types/compta';

export async function getJournalEntries(journal?: JournalCode): Promise<ComptaJournalEntryDTO[]> {
  const qs = journal ? `?journal=${journal}` : '';
  return apiClient.get<ComptaJournalEntryDTO[]>(`/compta/journal-entries${qs}`);
}

export interface CreateJournalEntryInput {
  journal: JournalCode;
  piece: string;
  dateEcriture: string;
  libelle: string;
  lignes: JournalLine[];
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<ComptaJournalEntryDTO> {
  return apiClient.post<ComptaJournalEntryDTO>('/compta/journal-entries', input);
}

export async function getTrialBalance(): Promise<TrialBalance> {
  return apiClient.get<TrialBalance>('/compta/trial-balance');
}

export async function getChartOfAccounts(): Promise<ChartOfAccountsEntry[]> {
  return apiClient.get<ChartOfAccountsEntry[]>('/compta/chart-of-accounts');
}
