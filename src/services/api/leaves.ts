import { LeaveChannel, LeaveRequest, LeaveBalance, LeaveDashboard, LeaveStatus } from '@/types';
import { apiClient, buildQueryString } from '@/lib/apiClient';

// ── API Functions ─────────────────────────────────────────────
// Persistées côté serveur (server/src/routes/leaves.routes.ts) — avant, ce
// module gardait tout en mémoire dans le processus JS du navigateur
// (aucune table Postgres), donc une demande soumise par un salarié
// n'apparaissait jamais chez qui que ce soit d'autre (autre onglet, autre
// session RH). Les notifications (manager prévenu d'une nouvelle demande,
// employé prévenu de la décision) sont désormais créées côté serveur, dans
// le même handler que la mutation — voir leaves.routes.ts.

export async function getLeaveRequests(params?: {
  employeeId?: string;
  status?: LeaveStatus;
  managerId?: string;
}): Promise<LeaveRequest[]> {
  const qs = buildQueryString({
    employeeId: params?.employeeId,
    status: params?.status,
    managerId: params?.managerId,
  });
  return apiClient.get<LeaveRequest[]>(`/leaves${qs}`);
}

export async function getLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiClient.get<LeaveRequest>(`/leaves/${id}`);
}

export async function createLeaveRequest(
  data: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt' | 'channel'> & { channel?: LeaveChannel }
): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>('/leaves', data);
}

export async function approveLeaveRequest(id: string, _reviewedBy: string, comment?: string): Promise<LeaveRequest> {
  // reviewedBy est ignoré : le serveur l'établit lui-même depuis le token
  // (req.user.email), pour ne jamais faire confiance à une valeur cliente.
  return apiClient.post<LeaveRequest>(`/leaves/${id}/approve`, { comment });
}

export async function refuseLeaveRequest(id: string, _reviewedBy: string, comment: string): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>(`/leaves/${id}/refuse`, { comment });
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiClient.post<LeaveRequest>(`/leaves/${id}/cancel`);
}

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance[]> {
  const qs = buildQueryString({ employeeId });
  return apiClient.get<LeaveBalance[]>(`/leaves/balance${qs}`);
}

export async function getLeaveDashboard(employeeId: string): Promise<LeaveDashboard> {
  const qs = buildQueryString({ employeeId });
  return apiClient.get<LeaveDashboard>(`/leaves/dashboard${qs}`);
}

/** Vue RH : compteur congés payés de tout l'effectif visible (équipe pour un manager, entreprise pour RH/admin). */
export async function getLeaveDashboardAll(departmentId?: string): Promise<LeaveDashboard[]> {
  const qs = buildQueryString({ departmentId });
  return apiClient.get<LeaveDashboard[]>(`/leaves/dashboard-all${qs}`);
}

export async function getTeamLeaveCalendar(managerId: string): Promise<LeaveRequest[]> {
  const qs = buildQueryString({ managerId });
  return apiClient.get<LeaveRequest[]>(`/leaves/team-calendar${qs}`);
}

/** Congés approuvés qui chevauchent le mois donné ("YYYY-MM"), pour la vue calendrier d'équipe par département. */
export async function getDepartmentLeaveCalendar(month: string, departmentId?: string): Promise<LeaveRequest[]> {
  const qs = buildQueryString({ month, departmentId });
  return apiClient.get<LeaveRequest[]>(`/leaves/department-calendar${qs}`);
}
