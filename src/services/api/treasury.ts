import { apiClient, buildQueryString } from '@/lib/apiClient';
import { CreateTreasuryAccountInput, ImportResult, ImportRow, TreasuryAccount, TreasuryTransaction } from '@/types/treasury';

export async function getTreasuryAccounts(): Promise<TreasuryAccount[]> {
  return apiClient.get<TreasuryAccount[]>('/treasury/accounts');
}

export async function createTreasuryAccount(input: CreateTreasuryAccountInput): Promise<TreasuryAccount> {
  return apiClient.post<TreasuryAccount>('/treasury/accounts', input);
}

export async function getTreasuryTransactions(accountId?: string): Promise<TreasuryTransaction[]> {
  return apiClient.get<TreasuryTransaction[]>(`/treasury/transactions${buildQueryString({ accountId })}`);
}

export async function importTreasuryStatement(accountId: string, rows: ImportRow[]): Promise<ImportResult> {
  return apiClient.post<ImportResult>(`/treasury/accounts/${accountId}/import`, { rows });
}

export type ReconcileAction =
  | { statut: 'rapproche'; compte: string; libelleCompte: string }
  | { statut: 'anomalie' }
  | { statut: 'en_attente' };

export async function reconcileTreasuryTransaction(id: string, action: ReconcileAction): Promise<TreasuryTransaction> {
  return apiClient.patch<TreasuryTransaction>(`/treasury/transactions/${id}`, action);
}
