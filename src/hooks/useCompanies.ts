import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCompany, CreateCompanyPayload, getCurrentCompany } from '@/services/api/companies';

export function useCreateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompanyPayload) => createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

// Entreprise de l'utilisateur connecté (nom, pays, devise...). staleTime
// long : le pays/la devise d'une entreprise ne change quasiment jamais une
// fois créée, inutile de la re-fetcher à chaque navigation.
export function useCurrentCompanyQuery() {
  return useQuery({
    queryKey: ['companies', 'me'],
    queryFn: getCurrentCompany,
    staleTime: 30 * 60_000,
  });
}
