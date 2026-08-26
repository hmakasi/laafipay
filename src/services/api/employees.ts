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

export async function createDepartment(data: { name: string; code: string }): Promise<Department> {
  return apiClient.post<Department>('/departments', data);
}

// Employés réels (Postgres), pour les modules qui doivent joindre/filtrer
// sur l'effectif complet (congés, avances, paiements, bulletins) au lieu de
// piocher dans un mock déconnecté (MOCK_EMPLOYEES) — un employé créé après
// coup doit apparaître partout, pas seulement dans la liste employés.
export async function getAllEmployees(): Promise<Employee[]> {
  const { data } = await getEmployees({ perPage: 1000 });
  return data;
}

export async function uploadDocument(employeeId: string, file: File, type: EmployeeDocument['type']): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiClient.post<EmployeeDocument>(`/employees/${employeeId}/documents`, formData);
}

// doc.url est un chemin API relatif (/employees/:id/documents/:id/download),
// pas une URL de fichier statique — le document est stocké en privé sur
// Vercel Blob, il faut passer par cette route authentifiée pour le lire.
export async function downloadDocument(documentUrl: string): Promise<Blob> {
  return apiClient.getBlob(documentUrl);
}

export async function inviteEmployee(employeeId: string): Promise<{ token: string }> {
  return apiClient.post<{ token: string }>(`/employees/${employeeId}/invite`);
}
