import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  useAdvanceRequestsQuery,
  useApproveAdvanceMutation,
  useMarkAdvanceDeductedMutation,
  usePayAdvanceMutation,
} from '@/hooks/useAdvances';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/authStore';
import { ADVANCE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';

export function AdvancesTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: advances, isLoading } = useAdvanceRequestsQuery();
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const approveMutation = useApproveAdvanceMutation();
  const payMutation = usePayAdvanceMutation();
  const deductMutation = useMarkAdvanceDeductedMutation();

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const sorted = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const handleApprove = async (id: string) => {
    if (!user) return;
    await approveMutation.mutateAsync({ id, approvedBy: user.email });
    toast.success(t('payments.advances.approved'));
  };

  const handlePay = async (id: string) => {
    await payMutation.mutateAsync(id);
    toast.success(t('payments.advances.paid'));
  };

  const handleDeduct = async (id: string) => {
    await deductMutation.mutateAsync(id);
    toast.success(t('payments.advances.deducted'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('payments.advances.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                <TableHead>{t('app.amount')}</TableHead>
                <TableHead>{t('payments.advances.requestedAt')}</TableHead>
                <TableHead>{t('app.status')}</TableHead>
                <PermissionGate permission="payments:initiate">
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </PermissionGate>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t('app.noResults')}
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell className="font-medium">{employeeName(advance.employeeId)}</TableCell>
                  <TableCell>{formatCurrency(advance.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                      {t(`payments.advances.status_${advance.status}`)}
                    </Badge>
                    {advance.reference && (
                      <p className="mt-1 text-xs text-muted-foreground">{advance.reference}</p>
                    )}
                  </TableCell>
                  <PermissionGate permission="payments:initiate">
                    <TableCell className="text-right">
                      {advance.status === 'demande_whatsapp' && (
                        <Button size="sm" variant="outline" onClick={() => handleApprove(advance.id)} disabled={approveMutation.isPending}>
                          {t('payments.advances.approve')}
                        </Button>
                      )}
                      {advance.status === 'approuve' && (
                        <Button size="sm" onClick={() => handlePay(advance.id)} disabled={payMutation.isPending}>
                          <Smartphone className="mr-2 h-4 w-4" />
                          {payMutation.isPending ? t('payments.advances.paying') : t('payments.advances.payViaMobileMoney')}
                        </Button>
                      )}
                      {advance.status === 'verse_mobile_money' && (
                        <Button size="sm" variant="outline" onClick={() => handleDeduct(advance.id)} disabled={deductMutation.isPending}>
                          {t('payments.advances.markDeducted')}
                        </Button>
                      )}
                    </TableCell>
                  </PermissionGate>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
