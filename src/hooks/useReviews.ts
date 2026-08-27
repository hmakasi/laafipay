import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReviewStatus } from '@/types';
import {
  closeReviewCycle,
  completeReview,
  createReviewCycle,
  getReview,
  getReviewCycle,
  getReviewCycles,
  getReviews,
  openReviewCycle,
  submitManagerAssessment,
  submitSelfAssessment,
} from '@/services/api/reviews';

export function useReviewCyclesQuery() {
  return useQuery({
    queryKey: ['review-cycles'],
    queryFn: getReviewCycles,
  });
}

export function useReviewCycleQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['review-cycles', id],
    queryFn: () => getReviewCycle(id!),
    enabled: !!id,
  });
}

export function useCreateReviewCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; year: number; startDate: string; endDate: string }) => createReviewCycle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
    },
  });
}

export function useOpenReviewCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => openReviewCycle(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['review-cycles', id] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useCloseReviewCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeReviewCycle(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['review-cycles', id] });
    },
  });
}

export function useReviewsQuery(params?: { cycleId?: string; status?: ReviewStatus; employeeId?: string }) {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => getReviews(params),
  });
}

export function useReviewQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['reviews', 'detail', id],
    queryFn: () => getReview(id!),
    enabled: !!id,
  });
}

function useInvalidateReviews() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['reviews'] });
    queryClient.invalidateQueries({ queryKey: ['review-cycles'] });
  };
}

export function useSubmitSelfAssessmentMutation() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { objectives?: string; selfAssessment: string; selfRating: number } }) =>
      submitSelfAssessment(id, data),
    onSuccess: invalidate,
  });
}

export function useSubmitManagerAssessmentMutation() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { managerAssessment: string; managerRating: number; nextObjectives?: string };
    }) => submitManagerAssessment(id, data),
    onSuccess: invalidate,
  });
}

export function useCompleteReviewMutation() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: (id: string) => completeReview(id),
    onSuccess: invalidate,
  });
}
