import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPayrollConfig, PayrollConfigPayload, updatePayrollConfig } from '@/services/api/payrollConfig';

export function usePayrollConfigQuery() {
  return useQuery({
    queryKey: ['payrollConfig'],
    queryFn: getPayrollConfig,
  });
}

export function useUpdatePayrollConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PayrollConfigPayload) => updatePayrollConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['payrollConfig'], data);
    },
  });
}
