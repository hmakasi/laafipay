import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveAdvanceRequest,
  getAdvanceRequests,
  markAdvanceDeducted,
  payAdvanceRequestViaMobileMoney,
} from '@/services/api/advances';

function useInvalidateAdvances() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['advance-requests'] });
}

export function useAdvanceRequestsQuery() {
  return useQuery({
    queryKey: ['advance-requests'],
    queryFn: getAdvanceRequests,
  });
}

export function useApproveAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) => approveAdvanceRequest(id, approvedBy),
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

export function useMarkAdvanceDeductedMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: (id: string) => markAdvanceDeducted(id),
    onSuccess: invalidate,
  });
}
