import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveSignupRequest,
  archiveAdminCompany,
  getAdminCompanies,
  getSignupRequests,
  rejectSignupRequest,
  restoreAdminCompany,
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

export function useAdminCompaniesQuery(archived = false) {
  return useQuery({
    queryKey: ['admin-companies', archived],
    queryFn: () => getAdminCompanies(archived),
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

export function useArchiveAdminCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveAdminCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });
}

export function useRestoreAdminCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreAdminCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
  });
}
