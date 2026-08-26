import { useQuery } from '@tanstack/react-query';
import { getFiscalDeadlines } from '@/services/api/fiscalDeadlines';

export function useFiscalDeadlinesQuery() {
  return useQuery({ queryKey: ['fiscal-deadlines'], queryFn: getFiscalDeadlines });
}
