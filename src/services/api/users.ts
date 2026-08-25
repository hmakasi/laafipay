import { User, Notification, AuditLog } from '@/types';
import { MOCK_NOTIFICATIONS, MOCK_AUDIT_LOGS, MOCK_USERS } from '@/mocks/users';
import { apiClient } from '@/lib/apiClient';
import { delay, deepClone } from '@/lib/utils';

let notifications = deepClone(MOCK_NOTIFICATIONS);

// Authentification réelle : voir src/services/api/auth.ts (login/logout/getCurrentUser via l'API).
// Les utilisateurs passent par l'API réelle (server/src/routes/users.routes.ts).
// Notifications/audit restent mockés pour l'instant.

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

export async function getNotifications(userId: string): Promise<Notification[]> {
  await delay(300);
  return deepClone(notifications.filter((n) => n.userId === userId));
}

export async function markNotificationRead(id: string): Promise<void> {
  await delay(200);
  const notif = notifications.find((n) => n.id === id);
  if (notif) notif.read = true;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await delay(300);
  notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
}

export function createNotification(data: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
  const notif: Notification = {
    ...data,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.push(notif);
  return notif;
}

export function notifyEmployee(
  employeeId: string,
  data: Omit<Notification, 'id' | 'read' | 'createdAt' | 'userId'>
): void {
  const user = MOCK_USERS.find((u) => u.employeeId === employeeId);
  if (!user) return;
  createNotification({ ...data, userId: user.id });
}

export function notifyByEmail(
  email: string,
  data: Omit<Notification, 'id' | 'read' | 'createdAt' | 'userId'>
): void {
  const user = MOCK_USERS.find((u) => u.email === email);
  if (!user) return;
  createNotification({ ...data, userId: user.id });
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
