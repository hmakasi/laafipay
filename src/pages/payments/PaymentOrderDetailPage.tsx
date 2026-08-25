import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  useApprovePaymentOrderMutation,
  useGenerateBankTransferFileMutation,
  usePaymentOrderQuery,
  useRejectPaymentOrderMutation,
  useRetryFailedTransactionsMutation,
} from '@/hooks/usePayments';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { usePayrollCycleQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { useAuthStore } from '@/store/authStore';
import { PAYMENT_STATUS_VARIANT } from '@/lib/constants';
import { downloadBlob, formatCurrency, formatDate, formatPeriod } from '@/lib/utils';

export function PaymentOrderDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: order, isLoading } = usePaymentOrderQuery(id);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: cycle } = usePayrollCycleQuery(order?.cycleId);

  const approveMutation = useApprovePaymentOrderMutation();
  const rejectMutation = useRejectPaymentOrderMutation();
  const retryMutation = useRetryFailedTransactionsMutation();
  const downloadMutation = useGenerateBankTransferFileMutation();

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const handleApprove = async () => {
    if (!id || !user) return;
    try {
      await approveMutation.mutateAsync({ id, validatedBy: user.email });
      toast.success(t('payments.approveOrder'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'approbation');
    }
  };

  const handleReject = async () => {
    if (!id || !user) return;
    try {
      await rejectMutation.mutateAsync({ id, rejectedBy: user.email });
      toast.success(t('payments.rejectOrder'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du rejet');
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      await retryMutation.mutateAsync(id);
      toast.success(t('payments.retryFailed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la relance');
    }
  };

  const handleDownload = async () => {
    if (!id || !order) return;
    try {
      const blob = await downloadMutation.mutateAsync(id);
      downloadBlob(blob, `ordre-paiement-${order.id}.csv`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération du fichier');
    }
  };

  if (isLoading || !order) {
    return <Skeleton className="h-96 w-full" />;
  }

  const failedCount = order.transactions.filter((t) => t.status === 'echoue').length;
  const isPending = order.status === 'en_attente';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloadMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {t('payments.downloadOrder')}
          </Button>
          <PermissionGate permission="payments:initiate">
            {failedCount > 0 && (
              <Button variant="outline" onClick={handleRetry} disabled={retryMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('payments.retryFailed')}
              </Button>
            )}
          </PermissionGate>
          <PermissionGate permission="payments:validate">
            {isPending && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <XCircle className="mr-2 h-4 w-4" />
                      {t('payments.rejectOrder')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('payments.rejectOrder')}</AlertDialogTitle>
                      <AlertDialogDescription>{formatCurrency(order.totalAmount, currencyCode)} — {order.transactions.length} bénéficiaires</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReject}>{t('app.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t('payments.approveOrder')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('payments.doubleValidation')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {formatCurrency(order.totalAmount, currencyCode)} — {order.transactions.length} bénéficiaires — préparé par{' '}
                        {order.createdBy}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleApprove}>{t('app.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="capitalize">{cycle ? formatPeriod(cycle.period) : order.cycleId}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {order.type === 'mobile_money' ? t('payments.massPayment') : t('payments.bankTransfer')} ·{' '}
              {order.transactions.length} bénéficiaires
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <Badge variant="warning">{t('payments.pendingValidation')}</Badge>
            )}
            <Badge variant={PAYMENT_STATUS_VARIANT[order.status]}>{t(`payments.status_${order.status}`)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-muted-foreground">{t('app.amount')}</div>
            <div className="text-lg font-semibold">{formatCurrency(order.totalAmount, currencyCode)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Préparé par</div>
            <div className="font-medium">{order.createdBy}</div>
          </div>
          {order.validatedBy && (
            <div>
              <div className="text-muted-foreground">Validé par</div>
              <div className="font-medium">{order.validatedBy}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">{t('app.date')}</div>
            <div className="font-medium">{formatDate(order.createdAt, 'dd/MM/yyyy HH:mm')}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                {order.type === 'mobile_money' && <TableHead>{t('payments.operator')}</TableHead>}
                <TableHead>{t('app.amount')}</TableHead>
                <TableHead>{t('payments.transactionRef')}</TableHead>
                <TableHead>{t('app.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-medium">{employeeName(txn.employeeId)}</TableCell>
                  {order.type === 'mobile_money' && (
                    <TableCell>
                      {txn.operator ? t(`employees.operator_${txn.operator}`) : '—'} · {txn.phoneNumber}
                    </TableCell>
                  )}
                  <TableCell>{formatCurrency(txn.amount, currencyCode)}</TableCell>
                  <TableCell className="text-muted-foreground">{txn.reference ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_VARIANT[txn.status]}>{t(`payments.status_${txn.status}`)}</Badge>
                    {txn.errorMessage && <div className="mt-0.5 text-xs text-destructive">{txn.errorMessage}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
