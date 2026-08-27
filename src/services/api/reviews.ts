import { PerformanceReview, ReviewCycle, ReviewStatus } from '@/types';
import { apiClient, buildQueryString } from '@/lib/apiClient';

export async function getReviewCycles(): Promise<ReviewCycle[]> {
  return apiClient.get<ReviewCycle[]>('/reviews/cycles');
}

export async function getReviewCycle(id: string): Promise<ReviewCycle> {
  return apiClient.get<ReviewCycle>(`/reviews/cycles/${id}`);
}

export async function createReviewCycle(data: {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}): Promise<ReviewCycle> {
  return apiClient.post<ReviewCycle>('/reviews/cycles', data);
}

export async function openReviewCycle(id: string): Promise<ReviewCycle> {
  return apiClient.post<ReviewCycle>(`/reviews/cycles/${id}/open`);
}

export async function closeReviewCycle(id: string): Promise<ReviewCycle> {
  return apiClient.post<ReviewCycle>(`/reviews/cycles/${id}/close`);
}

export async function getReviews(params?: {
  cycleId?: string;
  status?: ReviewStatus;
  employeeId?: string;
}): Promise<PerformanceReview[]> {
  const qs = buildQueryString({
    cycleId: params?.cycleId,
    status: params?.status,
    employeeId: params?.employeeId,
  });
  return apiClient.get<PerformanceReview[]>(`/reviews${qs}`);
}

export async function getReview(id: string): Promise<PerformanceReview> {
  return apiClient.get<PerformanceReview>(`/reviews/${id}`);
}

export async function submitSelfAssessment(
  id: string,
  data: { objectives?: string; selfAssessment: string; selfRating: number }
): Promise<PerformanceReview> {
  return apiClient.post<PerformanceReview>(`/reviews/${id}/self-assessment`, data);
}

export async function submitManagerAssessment(
  id: string,
  data: { managerAssessment: string; managerRating: number; nextObjectives?: string }
): Promise<PerformanceReview> {
  return apiClient.post<PerformanceReview>(`/reviews/${id}/manager-assessment`, data);
}

export async function completeReview(id: string): Promise<PerformanceReview> {
  return apiClient.post<PerformanceReview>(`/reviews/${id}/complete`);
}
