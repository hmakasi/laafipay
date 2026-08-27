import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveSignupRequest,
  deleteAdminCompany,
  getAdminCompanies,
  getSignupRequests,
  rejectSignupRequest,
  updateAdminCompany,
} from '@/services/api/admin';
import { SignupRequest } from '@/types';

export function useSignupRequestsQuery(status?: SignupRequest['status']) {
  return useQuery({
    queryKey: ['admin-signup-requests', status],
    queryFn: () => getSignupRequests(status),
  });
}

export function useApproveSignupRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveSignupRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
  });
}

export function useRejectSignupRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectSignupRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signup-requests'] });
    },
  });
}

export function useAdminCompaniesQuery() {
  return useQuery({
    queryKey: ['admin-companies'],
    queryFn: getAdminCompanies,
  });
}

export function useUpdateAdminCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; legalName?: string } }) => updateAdminCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });
}

export function useDeleteAdminCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });
}
