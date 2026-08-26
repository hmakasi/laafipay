import { apiClient } from '@/lib/apiClient';
import { FiscalDeadline } from '@/types/compta';

export async function getFiscalDeadlines(): Promise<FiscalDeadline[]> {
  return apiClient.get<FiscalDeadline[]>('/compta/fiscal-deadlines');
}
