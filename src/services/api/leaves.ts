import { LeaveChannel, LeaveRequest, LeaveBalance, LeaveStatus } from '@/types';
import { MOCK_LEAVE_REQUESTS, MOCK_LEAVE_BALANCES } from '@/mocks/leaves';
import { MOCK_EMPLOYEES } from '@/mocks/employees';
import { delay, deepClone } from '@/lib/utils';
import { notifyEmployee } from '@/services/api/users';

let requests = deepClone(MOCK_LEAVE_REQUESTS);
let balances = deepClone(MOCK_LEAVE_BALANCES);

function adjustPending(employeeId: string, type: LeaveRequest['type'], deltaDays: number) {
  const balance = balances.find((b) => b.employeeId === employeeId && b.type === type);
  if (balance) balance.pending += deltaDays;
}

// ── API Functions ─────────────────────────────────────────────

export async function getLeaveRequests(params?: {
  employeeId?: string;
  status?: LeaveStatus;
  managerId?: string;
}): Promise<LeaveRequest[]> {
  await delay(400);
  let filtered = [...requests];
  if (params?.employeeId) {
    filtered = filtered.filter((r) => r.employeeId === params.employeeId);
  }
  if (params?.status) {
    filtered = filtered.filter((r) => r.status === params.status);
  }
  if (params?.managerId) {
    const teamIds = new Set(
      MOCK_EMPLOYEES.filter((e) => e.managerId === params.managerId).map((e) => e.id)
    );
    filtered = filtered.filter((r) => teamIds.has(r.employeeId));
  }
  return deepClone(filtered);
}

export async function getLeaveRequest(id: string): Promise<LeaveRequest> {
  await delay(300);
  const req = requests.find((r) => r.id === id);
  if (!req) throw new Error(`Demande ${id} introuvable`);
  return deepClone(req);
}

export async function createLeaveRequest(
  data: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt' | 'channel'> & { channel?: LeaveChannel }
): Promise<LeaveRequest> {
  await delay(500);
  const newReq: LeaveRequest = {
    ...data,
    channel: data.channel ?? 'portail',
    id: `leave-${Date.now()}`,
    status: 'en_attente',
    submittedAt: new Date().toISOString(),
  };
  requests.push(newReq);
  adjustPending(newReq.employeeId, newReq.type, newReq.daysCount);

  const emp = MOCK_EMPLOYEES.find((e) => e.id === newReq.employeeId);
  if (emp?.managerId) {
    notifyEmployee(emp.managerId, {
      type: 'action_requise',
      title: 'Nouvelle demande de congé',
      message: `${emp.firstName} ${emp.lastName} a demandé un congé du ${newReq.startDate} au ${newReq.endDate}.`,
      link: '/leaves',
    });
  }

  return deepClone(newReq);
}

export async function approveLeaveRequest(
  id: string,
  reviewedBy: string,
  comment?: string
): Promise<LeaveRequest> {
  await delay(500);
  const req = requests.find((r) => r.id === id);
  if (!req) throw new Error(`Demande ${id} introuvable`);
  req.status = 'valide';
  req.reviewedAt = new Date().toISOString();
  req.reviewedBy = reviewedBy;
  req.reviewComment = comment;

  const balance = balances.find(
    (b) => b.employeeId === req.employeeId && b.type === req.type
  );
  if (balance) {
    balance.taken += req.daysCount;
    balance.remaining -= req.daysCount;
    balance.pending -= req.daysCount;
  }

  notifyEmployee(req.employeeId, {
    type: 'conge_valide',
    title: 'Demande de congé validée',
    message: `Votre demande de congé du ${req.startDate} au ${req.endDate} a été validée.`,
    link: '/self',
  });

  return deepClone(req);
}

export async function refuseLeaveRequest(
  id: string,
  reviewedBy: string,
  comment: string
): Promise<LeaveRequest> {
  await delay(500);
  const req = requests.find((r) => r.id === id);
  if (!req) throw new Error(`Demande ${id} introuvable`);
  req.status = 'refuse';
  req.reviewedAt = new Date().toISOString();
  req.reviewedBy = reviewedBy;
  req.reviewComment = comment;
  adjustPending(req.employeeId, req.type, -req.daysCount);

  notifyEmployee(req.employeeId, {
    type: 'conge_refuse',
    title: 'Demande de congé refusée',
    message: `Votre demande de congé du ${req.startDate} au ${req.endDate} a été refusée : ${comment}`,
    link: '/self',
  });

  return deepClone(req);
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  await delay(400);
  const req = requests.find((r) => r.id === id);
  if (!req) throw new Error(`Demande ${id} introuvable`);
  req.status = 'annule';
  adjustPending(req.employeeId, req.type, -req.daysCount);
  return deepClone(req);
}

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance[]> {
  await delay(300);
  return deepClone(balances.filter((b) => b.employeeId === employeeId));
}

export async function getTeamLeaveCalendar(managerId: string): Promise<LeaveRequest[]> {
  await delay(400);
  const teamEmployeeIds = new Set(
    MOCK_EMPLOYEES.filter((e) => e.managerId === managerId).map((e) => e.id)
  );
  return deepClone(requests.filter((r) => r.status === 'valide' && teamEmployeeIds.has(r.employeeId)));
}

/** Congés approuvés qui chevauchent le mois donné ("YYYY-MM"), pour la vue calendrier d'équipe par département. */
export async function getDepartmentLeaveCalendar(month: string, departmentId?: string): Promise<LeaveRequest[]> {
  await delay(400);
  const monthStart = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const monthEnd = new Date(year, monthNum, 0).toISOString().split('T')[0];

  const employeeIds = departmentId
    ? new Set(MOCK_EMPLOYEES.filter((e) => e.departmentId === departmentId).map((e) => e.id))
    : null;

  return deepClone(
    requests.filter((r) => {
      if (r.status !== 'valide') return false;
      if (employeeIds && !employeeIds.has(r.employeeId)) return false;
      return r.startDate <= monthEnd && r.endDate >= monthStart;
    })
  );
}
