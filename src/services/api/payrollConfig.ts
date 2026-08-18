import { apiClient } from '@/lib/apiClient';

export interface CustomRubricPayload {
  label: string;
  taxable: boolean;
  cnssContributable: boolean;
}

// activeRubrics : identifiants des rubriques du catalogue (obligatoires +
// optionnelles activées). Les rubriques sur-mesure ont besoin de champs
// supplémentaires (imposable, cotisable CNSS) qu'un simple string ne peut
// pas porter : elles voyagent séparément dans customRubrics.
export interface PayrollConfigPayload {
  activeRubrics: string[];
  customRubrics: CustomRubricPayload[];
}

export async function getPayrollConfig(): Promise<PayrollConfigPayload> {
  return apiClient.get<PayrollConfigPayload>('/companies/payroll-config');
}

export async function updatePayrollConfig(payload: PayrollConfigPayload): Promise<PayrollConfigPayload> {
  return apiClient.put<PayrollConfigPayload>('/companies/payroll-config', payload);
}
