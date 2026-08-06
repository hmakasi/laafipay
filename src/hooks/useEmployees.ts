import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Employee, FilterParams } from '@/types';
import {
  createEmployee,
  deleteEmployee,
  getDepartments,
  getEmployee,
  getEmployees,
  inviteEmployee,
  updateEmployee,
} from '@/services/api/employees';

export function useEmployeesQuery(params?: FilterParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => getEmployees(params),
  });
}

export function useEmployeeQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => getEmployee(id!),
    enabled: !!id,
  });
}

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: 5 * 60_000,
  });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Employee, 'id' | 'documents' | 'careerHistory'>) => createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) => updateEmployee(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', variables.id] });
    },
  });
}

export function useInviteEmployeeMutation() {
  return useMutation({
    mutationFn: (employeeId: string) => inviteEmployee(employeeId),
  });
}

export function useDeleteEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
