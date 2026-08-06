import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generatePayslips,
  getPayslip,
  getPayslips,
  sendAllPayslips,
  sendPayslipByEmail,
  sendPayslipBySms,
  sendPayslipByWhatsApp,
} from '@/services/api/payslips';

export type PayslipChannel = 'email' | 'whatsapp' | 'sms';

export function usePayslipsQuery(employeeId?: string, cycleId?: string) {
  return useQuery({
    queryKey: ['payslips', employeeId, cycleId],
    queryFn: () => getPayslips(employeeId, cycleId),
  });
}

export function usePayslipQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['payslips', 'detail', id],
    queryFn: () => getPayslip(id!),
    enabled: !!id,
  });
}

function useInvalidatePayslips() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['payslips'] });
  };
}

export function useGeneratePayslipsMutation() {
  const invalidate = useInvalidatePayslips();
  return useMutation({
    mutationFn: (cycleId: string) => generatePayslips(cycleId),
    onSuccess: invalidate,
  });
}

const SEND_BY_CHANNEL: Record<PayslipChannel, (id: string) => Promise<void>> = {
  email: sendPayslipByEmail,
  whatsapp: sendPayslipByWhatsApp,
  sms: sendPayslipBySms,
};

export function useSendPayslipMutation() {
  const invalidate = useInvalidatePayslips();
  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: PayslipChannel }) => SEND_BY_CHANNEL[channel](id),
    onSuccess: invalidate,
  });
}

export function useSendAllPayslipsMutation() {
  const invalidate = useInvalidatePayslips();
  return useMutation({
    mutationFn: ({ cycleId, channel }: { cycleId: string; channel: PayslipChannel }) =>
      sendAllPayslips(cycleId, channel),
    onSuccess: invalidate,
  });
}
