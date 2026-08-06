import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useSendPayslipMutation } from '@/hooks/usePayslips';
import { SEND_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Employee, Payslip } from '@/types';

export function PayslipPreviewDialog({
  payslip,
  employee,
  open,
  onOpenChange,
}: {
  payslip: Payslip;
  employee?: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const sendMutation = useSendPayslipMutation();

  const handleSend = async (channel: 'email' | 'whatsapp' | 'sms') => {
    await sendMutation.mutateAsync({ id: payslip.id, channel });
    toast.success(t(`payslips.send${channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'Whatsapp' : 'Sms'}`));
  };

  const lines = [
    ...payslip.primes.map((p) => ({ label: p.label, amount: p.amount, sign: 1 })),
    ...payslip.indemnites.map((p) => ({ label: p.label, amount: p.amount, sign: 1 })),
    ...payslip.avances.map((p) => ({ label: p.label, amount: p.amount, sign: -1 })),
    ...payslip.retenues.map((p) => ({ label: p.label, amount: p.amount, sign: -1 })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {t('payslips.preview')} — {formatPeriod(payslip.period)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 rounded-md border p-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">{t('payslips.employerInfo')}</div>
              <div className="font-medium">LaafiPay Démo SARL</div>
              <div className="text-muted-foreground">Ouagadougou, Burkina Faso</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">{t('payslips.employeeInfo')}</div>
              <div className="font-medium">{employee ? `${employee.firstName} ${employee.lastName}` : payslip.employeeId}</div>
              <div className="text-muted-foreground">{employee?.matricule} · {employee?.position}</div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('payslips.payDetails')}</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>{t('employees.baseSalary')}</span>
                <span>{formatCurrency(payslip.baseSalary)}</span>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{l.label}</span>
                  <span>{l.sign > 0 ? '+' : '-'}{formatCurrency(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 font-medium">
                <span>{t('payroll.salaireBrut')}</span>
                <span>{formatCurrency(payslip.salaireBrut)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('payroll.cnssEmployee')}</span>
                <span>-{formatCurrency(payslip.cnssEmployee)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('payroll.iuts')}</span>
                <span>-{formatCurrency(payslip.iuts)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold text-primary">
                <span>{t('payslips.netToPay')}</span>
                <span>{formatCurrency(payslip.salaireNet)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={SEND_STATUS_VARIANT[payslip.emailStatus]}>
              E-mail : {t(`payslips.emailStatus_${payslip.emailStatus}`)}
            </Badge>
            <Badge variant={SEND_STATUS_VARIANT[payslip.whatsappStatus]}>
              WhatsApp : {t(`payslips.whatsappStatus_${payslip.whatsappStatus}`)}
            </Badge>
            <Badge variant={SEND_STATUS_VARIANT[payslip.smsStatus]}>
              SMS : {t(`payslips.smsStatus_${payslip.smsStatus}`)}
            </Badge>
          </div>
        </div>

        <PermissionGate permission="payslips:send">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSend('email')} disabled={sendMutation.isPending}>
              <Mail className="mr-2 h-4 w-4" />
              {t('payslips.sendEmail')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSend('whatsapp')} disabled={sendMutation.isPending}>
              <MessageCircle className="mr-2 h-4 w-4" />
              {t('payslips.sendWhatsapp')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSend('sms')} disabled={sendMutation.isPending}>
              <Smartphone className="mr-2 h-4 w-4" />
              {t('payslips.sendSms')}
            </Button>
          </div>
        </PermissionGate>
      </DialogContent>
    </Dialog>
  );
}
