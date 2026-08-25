import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LeaveChannel, LeaveStatus, LeaveType } from '@/types';
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getDepartmentLeaveCalendar,
  getLeaveBalance,
  getLeaveDashboard,
  getLeaveDashboardAll,
  getLeaveRequests,
  getTeamLeaveCalendar,
  refuseLeaveRequest,
} from '@/services/api/leaves';

export function useLeaveRequestsQuery(params?: { employeeId?: string; status?: LeaveStatus; managerId?: string }) {
  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () => getLeaveRequests(params),
  });
}

export function useLeaveBalanceQuery(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['leave-balance', employeeId],
    queryFn: () => getLeaveBalance(employeeId!),
    enabled: !!employeeId,
  });
}

export function useLeaveDashboardQuery(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['leave-dashboard', employeeId],
    queryFn: () => getLeaveDashboard(employeeId!),
    enabled: !!employeeId,
  });
}

export function useLeaveDashboardAllQuery(departmentId?: string) {
  return useQuery({
    queryKey: ['leave-dashboard-all', departmentId],
    queryFn: () => getLeaveDashboardAll(departmentId),
  });
}

export function useTeamCalendarQuery(managerId: string | undefined) {
  return useQuery({
    queryKey: ['leave-team-calendar', managerId],
    queryFn: () => getTeamLeaveCalendar(managerId!),
    enabled: !!managerId,
  });
}

export function useDepartmentLeaveCalendarQuery(month: string, departmentId?: string) {
  return useQuery({
    queryKey: ['leave-department-calendar', month, departmentId],
    queryFn: () => getDepartmentLeaveCalendar(month, departmentId),
  });
}

function useInvalidateLeaves() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    queryClient.invalidateQueries({ queryKey: ['leave-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['leave-dashboard-all'] });
    queryClient.invalidateQueries({ queryKey: ['leave-team-calendar'] });
  };
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
  channel?: LeaveChannel;
}

export function useCreateLeaveRequestMutation() {
  const invalidate = useInvalidateLeaves();
  return useMutation({
    mutationFn: (data: CreateLeaveRequestInput) => createLeaveRequest(data),
    onSuccess: invalidate,
  });
}

export function useApproveLeaveRequestMutation() {
  const invalidate = useInvalidateLeaves();
  return useMutation({
    mutationFn: ({ id, reviewedBy, comment }: { id: string; reviewedBy: string; comment?: string }) =>
      approveLeaveRequest(id, reviewedBy, comment),
    onSuccess: invalidate,
  });
}

export function useRefuseLeaveRequestMutation() {
  const invalidate = useInvalidateLeaves();
  return useMutation({
    mutationFn: ({ id, reviewedBy, comment }: { id: string; reviewedBy: string; comment: string }) =>
      refuseLeaveRequest(id, reviewedBy, comment),
    onSuccess: invalidate,
  });
}

export function useCancelLeaveRequestMutation() {
  const invalidate = useInvalidateLeaves();
  return useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id),
    onSuccess: invalidate,
  });
}
