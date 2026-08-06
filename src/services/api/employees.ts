import { Department, Employee, EmployeeDocument, FilterParams, PaginatedResponse } from '@/types';
import { apiClient, buildQueryString } from '@/lib/apiClient';

export async function getEmployees(params?: FilterParams): Promise<PaginatedResponse<Employee>> {
  const qs = buildQueryString({
    search: params?.search,
    departmentId: params?.departmentId as string | undefined,
    contractType: params?.contractType as string | undefined,
    status: params?.status as string | undefined,
    page: params?.page,
    perPage: params?.perPage,
  });
  return apiClient.get<PaginatedResponse<Employee>>(`/employees${qs}`);
}

export async function getEmployee(id: string): Promise<Employee> {
  return apiClient.get<Employee>(`/employees/${id}`);
}

export async function createEmployee(data: Omit<Employee, 'id' | 'documents' | 'careerHistory'>): Promise<Employee> {
  return apiClient.post<Employee>('/employees', data);
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
  return apiClient.patch<Employee>(`/employees/${id}`, data);
}

export async function deleteEmployee(id: string): Promise<void> {
  return apiClient.delete<void>(`/employees/${id}`);
}

export async function getDepartments(): Promise<Department[]> {
  return apiClient.get<Department[]>('/departments');
}

export async function uploadDocument(employeeId: string, file: File): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post<EmployeeDocument>(`/employees/${employeeId}/documents`, formData);
}

export async function inviteEmployee(employeeId: string): Promise<{ token: string }> {
  return apiClient.post<{ token: string }>(`/employees/${employeeId}/invite`);
}
