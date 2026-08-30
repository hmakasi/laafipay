import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyPeerFeedbackRequests,
  getPeerFeedbackRequests,
  requestPeerFeedback,
  submitPeerFeedback,
} from '@/services/api/peerFeedback';

export function usePeerFeedbackRequestsQuery(reviewId: string | undefined) {
  return useQuery({
    queryKey: ['peer-feedback', reviewId],
    queryFn: () => getPeerFeedbackRequests(reviewId!),
    enabled: !!reviewId,
  });
}

export function useMyPeerFeedbackRequestsQuery() {
  return useQuery({
    queryKey: ['peer-feedback', 'mine'],
    queryFn: getMyPeerFeedbackRequests,
  });
}

export function useRequestPeerFeedbackMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, peerEmployeeId }: { reviewId: string; peerEmployeeId: string }) =>
      requestPeerFeedback(reviewId, peerEmployeeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['peer-feedback', variables.reviewId] });
    },
  });
}

export function useSubmitPeerFeedbackMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { feedback: string; rating?: number } }) =>
      submitPeerFeedback(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peer-feedback'] });
    },
  });
}
