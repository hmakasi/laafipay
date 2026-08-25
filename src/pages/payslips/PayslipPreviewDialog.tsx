import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useSendPayslipMutation } from '@/hooks/usePayslips';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { PayslipOfficialTemplate, PayslipOfficialRow } from '@/components/PayslipOfficialTemplate';
import { COUNTRY_META, SEND_STATUS_VARIANT } from '@/lib/constants';
import { formatPeriod } from '@/lib/utils';
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
  const { data: company } = useCurrentCompanyQuery();

  const handleSend = async (channel: 'email' | 'whatsapp' | 'sms') => {
    try {
      await sendMutation.mutateAsync({ id: payslip.id, channel });
      toast.success(t(`payslips.send${channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'Whatsapp' : 'Sms'}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi du bulletin');
    }
  };

  // Même construction de données que la page "Simuler un bulletin"
  // (LivePayslipPreviewPage.tsx) — le format et le contenu du bulletin réel
  // doivent être identiques à ceux de la simulation, y compris les
  // simplifications qu'elle applique (ex. un seul élément avances/retenues
  // affiché, iutsBase approximé par salaireBrut - cnssEmployee).
  const officialTemplateData = useMemo(() => {
    if (!company) return null;
    const countryMeta = COUNTRY_META[company.countryCode];

    const earnings: PayslipOfficialRow[] = [
      { label: t('payroll.livePreview.baseSalary'), employeeAmount: payslip.baseSalary },
      ...payslip.primes.map((p) => ({ label: p.label, employeeAmount: p.amount })),
      // Rubriques du catalogue (logement, transport, santé...) activées dans
      // "Configuration du bulletin" — stockées en indemnites, pas primes.
      // Leur absence ici faisait qu'un bulletin validé/généré ne montrait
      // jamais que le salaire de base + CNSS/impôt, même quand ces rubriques
      // apparaissaient bien sur la ligne de paie (Éléments variables).
      ...payslip.indemnites.map((i) => ({ label: i.label, employeeAmount: i.amount })),
      ...(payslip.overtimeAmount > 0
        ? [{ label: t('payroll.overtimeHours'), employeeAmount: payslip.overtimeAmount }]
        : []),
    ];

    const contributions: PayslipOfficialRow[] = [
      {
        label: countryMeta.socialAgencyLabel,
        base: payslip.baseSalary,
        rate: payslip.cnssEmployeeRate,
        employeeAmount: -payslip.cnssEmployee,
        employerAmount: payslip.cnssEmployer,
      },
      ...(payslip.avances.length > 0 ? [{ label: t('payroll.avances'), employeeAmount: -payslip.avances[0].amount }] : []),
      ...(payslip.retenues.length > 0 ? [{ label: t('payroll.retenues'), employeeAmount: -payslip.retenues[0].amount }] : []),
    ];

    const employeeContributionsTotal =
      payslip.cnssEmployee + (payslip.avances[0]?.amount ?? 0) + (payslip.retenues[0]?.amount ?? 0);

    return {
      company: {
        name: company.name,
        legalName: company.legalName,
        addressLine: [company.address, company.postalCode, company.city].filter(Boolean).join(', ') || undefined,
        taxIdLabel: countryMeta.taxIdLabel,
        taxIdNumber: company.taxIdNumber,
        socialAgencyLabel: countryMeta.socialAgencyLabel,
        socialSecurityNumber: company.socialSecurityNumber,
        employerNumbersOrder: countryMeta.employerNumbersOrder,
        activityCode: company.activityCode,
        collectiveAgreement: company.collectiveAgreement,
        logo: company.logo,
      },
      employee: {
        fullName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : payslip.employeeId,
        matricule: employee?.matricule ?? '—',
        hireDate: employee?.hireDate,
        address: employee ? [employee.address, employee.city].filter(Boolean).join(', ') : undefined,
        socialSecurityNumber: employee?.cnssNumber,
      },
      period: { label: formatPeriod(payslip.period) },
      earnings,
      grossSalary: payslip.salaireBrut,
      contributions,
      employeeContributionsTotal,
      employerContributionsTotal: payslip.cnssEmployer,
      incomeTax: { label: countryMeta.incomeTaxLabel, base: payslip.iutsBase, rate: payslip.iutsRate, amount: payslip.iuts },
      netBeforeTax: payslip.salaireBrut - payslip.cnssEmployee,
      netToPay: payslip.salaireNet,
      employerCost: payslip.coutEmployeur,
      currencyCode: company.currencyCode,
    };
  }, [company, employee, payslip, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {t('payslips.preview')} — {formatPeriod(payslip.period)}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-md border bg-muted/20 p-4">
          {officialTemplateData ? (
            <PayslipOfficialTemplate {...officialTemplateData} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{t('app.loading')}</div>
          )}
        </div>

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
