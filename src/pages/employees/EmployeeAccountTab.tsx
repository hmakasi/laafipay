import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdvancesQuery } from '@/hooks/useAdvances';
import { usePayslipsQuery } from '@/hooks/usePayslips';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { ADVANCE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate, formatPeriod } from '@/lib/utils';
import { Employee } from '@/types';

export function EmployeeAccountTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { data: advances, isLoading: advancesLoading } = useAdvancesQuery(employee.id);
  const { data: payslips, isLoading: payslipsLoading } = usePayslipsQuery(employee.id);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  const outstandingBalance = (advances ?? [])
    .filter((a) => a.status === 'verse_mobile_money' || a.status === 'en_remboursement')
    .reduce((sum, a) => sum + a.remainingBalance, 0);

  const sortedAdvances = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const sortedPayslips = [...(payslips ?? [])].sort((a, b) => b.period.localeCompare(a.period));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">{t('employees.baseSalary')}</div>
            <div className="text-sm font-medium">{formatCurrency(employee.baseSalary, currencyCode)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('payments.advances.remainingBalance')}</div>
            <div className="text-sm font-medium">{formatCurrency(outstandingBalance, currencyCode)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {advancesLoading ? (
            <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
          ) : sortedAdvances.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('app.amount')}</TableHead>
                  <TableHead>{t('payments.advances.requestedAt')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAdvances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{formatCurrency(advance.amount, currencyCode)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                        {t(`payments.advances.status_${advance.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payslips.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payslipsLoading ? (
            <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
          ) : sortedPayslips.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payroll.period')}</TableHead>
                  <TableHead>{t('payslips.netToPay')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium capitalize">{formatPeriod(p.period)}</TableCell>
                    <TableCell>{formatCurrency(p.salaireNet, currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
