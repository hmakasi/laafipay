import { User, Notification, AuditLog } from '@/types';
import { MOCK_AUDIT_LOGS } from '@/mocks/users';
import { apiClient } from '@/lib/apiClient';
import { delay, deepClone } from '@/lib/utils';

// Authentification réelle : voir src/services/api/auth.ts (login/logout/getCurrentUser via l'API).
// Les utilisateurs et les notifications passent par l'API réelle
// (server/src/routes/users.routes.ts, server/src/routes/notifications.routes.ts).
// Audit reste mocké pour l'instant.

// ── Users ─────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return apiClient.get<User[]>('/users');
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: User['role'];
  employeeId?: string;
}

export async function createUser(data: CreateUserPayload): Promise<User> {
  return apiClient.post<User>('/users', data);
}

export async function updateUserRole(userId: string, role: User['role']): Promise<User> {
  return apiClient.patch<User>(`/users/${userId}`, { role });
}

export async function setUserActive(userId: string, isActive: boolean): Promise<User> {
  return apiClient.patch<User>(`/users/${userId}`, { isActive });
}

// ── Notifications ─────────────────────────────────────────────
// Créées exclusivement côté serveur (server/src/lib/notifications.ts), en
// conséquence directe d'une action déjà authentifiée ailleurs (congé
// validé, entretien ouvert...) — rien à créer depuis le frontend, seulement
// à lire/marquer comme lues.

export async function getNotifications(): Promise<Notification[]> {
  return apiClient.get<Notification[]>('/notifications');
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch<void>(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch<void>('/notifications/read-all');
}

// ── Audit ─────────────────────────────────────────────────────

export async function getAuditLogs(params?: {
  severity?: AuditLog['severity'];
  userId?: string;
  from?: string;
  to?: string;
}): Promise<AuditLog[]> {
  await delay(400);
  let logs = [...MOCK_AUDIT_LOGS];
  if (params?.severity) logs = logs.filter((l) => l.severity === params.severity);
  if (params?.userId) logs = logs.filter((l) => l.userId === params.userId);
  return deepClone(logs);
}
