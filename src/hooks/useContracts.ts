import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateAmendmentPayload,
  CreateContractPayload,
  createAmendment,
  createContract,
  getEmployeeContracts,
} from '@/services/api/contracts';

export function useEmployeeContractsQuery(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employees', employeeId, 'contracts'],
    queryFn: () => getEmployeeContracts(employeeId!),
    enabled: !!employeeId,
  });
}

// Un nouveau contrat / avenant met aussi à jour l'instantané Employee
// (contractType/position/baseSalary/...) — on invalide les deux queries pour
// que la fiche employé et l'historique des contrats restent cohérents.
export function useCreateContractMutation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContractPayload) => createContract(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useCreateAmendmentMutation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, payload }: { contractId: string; payload: CreateAmendmentPayload }) =>
      createAmendment(employeeId, contractId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}
