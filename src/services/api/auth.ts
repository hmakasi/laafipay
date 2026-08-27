import { User } from '@/types';
import { apiClient } from '@/lib/apiClient';

interface LoginResponse {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', { email, password });
}

export async function getCurrentUser(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}

export async function logout(): Promise<void> {
  // Stateless JWT — rien à invalider côté serveur pour l'instant.
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.patch<void>('/auth/change-password', { currentPassword, newPassword });
}
