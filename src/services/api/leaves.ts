import { LeaveChannel, LeaveRequest, LeaveBalance, LeaveDashboard, LeaveStatus } from '@/types';
import { getEmployee } from '@/services/api/employees';
import { apiClient, buildQueryString } from '@/lib/apiClient';
import { notifyEmployee } from '@/services/api/users';

// ── API Functions ─────────────────────────────────────────────
// Persistées côté serveur (server/src/routes/leaves.routes.ts) — avant, ce
// module gardait tout en mémoire dans le processus JS du navigateur
// (aucune table Postgres), donc une demande soumise par un salarié
// n'apparaissait jamais chez qui que ce soit d'autre (autre onglet, autre
// session RH).

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
  const created = await apiClient.post<LeaveRequest>('/leaves', data);

  // getEmployee (fiche unique) plutôt que getAllEmployees (liste complète) :
  // le demandeur est en général un salarié self-service qui n'a le droit de
  // lire que sa propre fiche (self:profile), pas l'effectif entier
  // (employees:read, réservé RH/managers).
  const emp = await getEmployee(created.employeeId);
  if (emp?.managerId) {
    notifyEmployee(emp.managerId, {
      type: 'action_requise',
      title: 'Nouvelle demande de congé',
      message: `${emp.firstName} ${emp.lastName} a demandé un congé du ${created.startDate} au ${created.endDate}.`,
      link: '/leaves',
    });
  }

  return created;
}

export async function approveLeaveRequest(id: string, _reviewedBy: string, comment?: string): Promise<LeaveRequest> {
  // reviewedBy est ignoré : le serveur l'établit lui-même depuis le token
  // (req.user.email), pour ne jamais faire confiance à une valeur cliente.
  const req = await apiClient.post<LeaveRequest>(`/leaves/${id}/approve`, { comment });

  notifyEmployee(req.employeeId, {
    type: 'conge_valide',
    title: 'Demande de congé validée',
    message: `Votre demande de congé du ${req.startDate} au ${req.endDate} a été validée.`,
    link: '/self',
  });

  return req;
}

export async function refuseLeaveRequest(id: string, _reviewedBy: string, comment: string): Promise<LeaveRequest> {
  const req = await apiClient.post<LeaveRequest>(`/leaves/${id}/refuse`, { comment });

  notifyEmployee(req.employeeId, {
    type: 'conge_refuse',
    title: 'Demande de congé refusée',
    message: `Votre demande de congé du ${req.startDate} au ${req.endDate} a été refusée : ${comment}`,
    link: '/self',
  });

  return req;
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
