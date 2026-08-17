import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smartphone, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentOrdersQuery } from '@/hooks/usePayments';
import { usePayrollCyclesQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { PAYMENT_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate, formatPeriod } from '@/lib/utils';
import { AdvancesTab } from '@/pages/payments/AdvancesTab';

export function PaymentsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: orders, isLoading } = usePaymentOrdersQuery();
  const { data: cycles } = usePayrollCyclesQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  const sorted = [...(orders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('payments.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('payments.paymentHistory')}</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t('payments.paymentHistory')}</TabsTrigger>
          <TabsTrigger value="advances">{t('payments.advances.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payments.paymentHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payroll.period')}</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>{t('app.status')}</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>{t('app.amount')}</TableHead>
                      <TableHead>{t('app.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          {t('app.noResults')}
                        </TableCell>
                      </TableRow>
                    )}
                    {sorted.map((order) => {
                      const cycle = cycles?.find((c) => c.id === order.cycleId);
                      return (
                        <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/payments/${order.id}`)}>
                          <TableCell className="font-medium capitalize">
                            {cycle ? formatPeriod(cycle.period) : order.cycleId}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {order.type === 'mobile_money' ? (
                                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              {order.type === 'mobile_money' ? t('payments.massPayment') : t('payments.bankTransfer')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PAYMENT_STATUS_VARIANT[order.status]}>{t(`payments.status_${order.status}`)}</Badge>
                          </TableCell>
                          <TableCell>{order.transactions.length}</TableCell>
                          <TableCell>{formatCurrency(order.totalAmount, currencyCode)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.createdAt, 'dd/MM/yyyy HH:mm')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <AdvancesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
