import { Contract } from '@/types';
import { apiClient } from '@/lib/apiClient';

export interface CreateContractPayload {
  contractType: Contract['contractType'];
  startDate: string;
  endDate?: string;
  trialEndDate?: string;
  position: string;
  departmentId: string;
  baseSalary: number;
  contractNumber?: string;
  notes?: string;
}

export interface CreateAmendmentPayload {
  type: Contract['amendments'][number]['type'];
  effectiveDate: string;
  description: string;
  position?: string;
  departmentId?: string;
  baseSalary?: number;
  endDate?: string;
  trialEndDate?: string;
  contractType?: Contract['contractType'];
  previousValue?: string;
  newValue?: string;
}

export async function getEmployeeContracts(employeeId: string): Promise<Contract[]> {
  return apiClient.get<Contract[]>(`/employees/${employeeId}/contracts`);
}

export async function createContract(employeeId: string, payload: CreateContractPayload): Promise<Contract> {
  return apiClient.post<Contract>(`/employees/${employeeId}/contracts`, payload);
}

export async function createAmendment(
  employeeId: string,
  contractId: string,
  payload: CreateAmendmentPayload
): Promise<Contract> {
  return apiClient.post<Contract>(`/employees/${employeeId}/contracts/${contractId}/amendments`, payload);
}
