import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Employee, EmployeeDocument, FilterParams } from '@/types';
import {
  createDepartment,
  createEmployee,
  deleteDocument,
  deleteEmployee,
  getDepartments,
  getEmployee,
  getEmployees,
  inviteEmployee,
  updateEmployee,
  uploadDocument,
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

export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code: string }) => createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
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

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, file, type }: { employeeId: string; file: File; type: EmployeeDocument['type'] }) =>
      uploadDocument(employeeId, file, type),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.employeeId] });
    },
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, documentId }: { employeeId: string; documentId: string }) =>
      deleteDocument(employeeId, documentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.employeeId] });
    },
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
