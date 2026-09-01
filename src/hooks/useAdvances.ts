import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveAdvanceRequest,
  createAdvanceRequest,
  getAdvanceEligibility,
  getAdvances,
  payAdvanceRequestViaMobileMoney,
  rejectAdvanceRequest,
} from '@/services/api/advances';

function useInvalidateAdvances() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['advances'] });
    queryClient.invalidateQueries({ queryKey: ['advance-eligibility'] });
  };
}

export function useAdvancesQuery(employeeId?: string) {
  return useQuery({
    queryKey: ['advances', employeeId],
    queryFn: () => getAdvances(employeeId),
  });
}

export function useAdvanceEligibilityQuery() {
  return useQuery({
    queryKey: ['advance-eligibility'],
    queryFn: getAdvanceEligibility,
  });
}

export function useCreateAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: (amount: number) => createAdvanceRequest(amount),
    onSuccess: invalidate,
  });
}

export function useApproveAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) => approveAdvanceRequest(id, approvedBy),
    onSuccess: invalidate,
  });
}

export function useRejectAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: ({ id, rejectedBy, reason }: { id: string; rejectedBy: string; reason?: string }) =>
      rejectAdvanceRequest(id, rejectedBy, reason),
    onSuccess: invalidate,
  });
}

export function usePayAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: (id: string) => payAdvanceRequestViaMobileMoney(id),
    onSuccess: invalidate,
  });
}
