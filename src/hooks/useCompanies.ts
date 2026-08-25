import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCompany,
  CreateCompanyPayload,
  getCurrentCompany,
  updateCompany,
  UpdateCompanyPayload,
  uploadCompanyLogo,
} from '@/services/api/companies';

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

export function useUpdateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCompanyPayload) => updateCompany(payload),
    onSuccess: (data) => {
      // Toutes les cartes de bulletin (PayslipEmployerHeader) et montants
      // (formatCurrency) partagent cette même queryKey — les mettre à jour
      // ici les rafraîchit partout sans re-fetch.
      queryClient.setQueryData(['companies', 'me'], data);
    },
  });
}

export function useUploadCompanyLogoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: (data) => {
      queryClient.setQueryData(['companies', 'me'], data);
    },
  });
}
