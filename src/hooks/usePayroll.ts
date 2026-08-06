import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LegalSettings } from '@/types';
import { PayrollEntryInput } from '@/lib/payrollEngine';
import {
  createLegalSettings,
  createPayrollCycle,
  getAuditTrail,
  getLegalSettings,
  getPayrollCycle,
  getPayrollCycles,
  updatePayrollEntry,
  validatePayrollCycle,
} from '@/services/api/payroll';

export function usePayrollCyclesQuery() {
  return useQuery({
    queryKey: ['payroll-cycles'],
    queryFn: getPayrollCycles,
  });
}

export function usePayrollCycleQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['payroll-cycles', id],
    queryFn: () => getPayrollCycle(id!),
    enabled: !!id,
  });
}

export function useCreatePayrollCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => createPayrollCycle(period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-cycles'] });
    },
  });
}

export function useValidatePayrollCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, validatedBy }: { id: string; validatedBy: string }) =>
      validatePayrollCycle(id, validatedBy),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-cycles', variables.id] });
    },
  });
}

export function useUpdatePayrollEntryMutation(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: Partial<PayrollEntryInput> }) =>
      updatePayrollEntry(cycleId, entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-cycles', cycleId] });
    },
  });
}

export function useLegalSettingsQuery() {
  return useQuery({
    queryKey: ['legal-settings'],
    queryFn: getLegalSettings,
  });
}

export function useCreateLegalSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<LegalSettings, 'id' | 'createdAt'>) => createLegalSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-settings'] });
    },
  });
}

export function useAuditTrailQuery(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['payroll-audit', cycleId],
    queryFn: () => getAuditTrail(cycleId!),
    enabled: !!cycleId,
  });
}
