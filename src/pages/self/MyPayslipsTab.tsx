import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/store/authStore';
import { usePayslipsQuery } from '@/hooks/usePayslips';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { SEND_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Payslip } from '@/types';
import { PayslipPreviewDialog } from '@/pages/payslips/PayslipPreviewDialog';

export function MyPayslipsTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [previewing, setPreviewing] = useState<Payslip | null>(null);

  const { data: payslips, isLoading } = usePayslipsQuery(user?.employeeId);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const sorted = user?.employeeId ? [...(payslips ?? [])].sort((a, b) => b.period.localeCompare(a.period)) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('payslips.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : sorted.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t('app.noData')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payroll.period')}</TableHead>
                <TableHead>{t('payslips.netToPay')}</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>WhatsApp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setPreviewing(p)}>
                  <TableCell className="font-medium capitalize">{formatPeriod(p.period)}</TableCell>
                  <TableCell>{formatCurrency(p.salaireNet, currencyCode)}</TableCell>
                  <TableCell>
                    <Badge variant={SEND_STATUS_VARIANT[p.emailStatus]}>{t(`payslips.emailStatus_${p.emailStatus}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={SEND_STATUS_VARIANT[p.whatsappStatus]}>{t(`payslips.whatsappStatus_${p.whatsappStatus}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {previewing && (
        <PayslipPreviewDialog payslip={previewing} open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)} />
      )}
    </Card>
  );
}
