import { MyPeerFeedbackRequest, PeerFeedbackRequest } from '@/types';
import { apiClient } from '@/lib/apiClient';

export async function requestPeerFeedback(reviewId: string, peerEmployeeId: string): Promise<PeerFeedbackRequest> {
  return apiClient.post<PeerFeedbackRequest>(`/reviews/${reviewId}/peer-feedback-requests`, { peerEmployeeId });
}

export async function getPeerFeedbackRequests(reviewId: string): Promise<PeerFeedbackRequest[]> {
  return apiClient.get<PeerFeedbackRequest[]>(`/reviews/${reviewId}/peer-feedback-requests`);
}

export async function getMyPeerFeedbackRequests(): Promise<MyPeerFeedbackRequest[]> {
  return apiClient.get<MyPeerFeedbackRequest[]>('/reviews/peer-feedback-requests/mine');
}

export async function submitPeerFeedback(
  id: string,
  data: { feedback: string; rating?: number }
): Promise<PeerFeedbackRequest> {
  return apiClient.post<PeerFeedbackRequest>(`/reviews/peer-feedback-requests/${id}/submit`, data);
}
