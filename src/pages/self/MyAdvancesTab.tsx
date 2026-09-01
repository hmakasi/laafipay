import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdvanceEligibilityQuery, useAdvancesQuery, useCreateAdvanceMutation } from '@/hooks/useAdvances';
import { useAuthStore } from '@/store/authStore';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { ADVANCE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';

export function MyAdvancesTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: advances, isLoading } = useAdvancesQuery(user?.employeeId);
  const { data: eligibility } = useAdvanceEligibilityQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const createMutation = useCreateAdvanceMutation();
  const [amount, setAmount] = useState('');

  const sorted = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    try {
      await createMutation.mutateAsync(parsed);
      toast.success(t('payments.advances.requestSubmitted'));
      setAmount('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la demande');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.requestTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {eligibility?.hasActiveAdvance ? (
            <p className="text-sm text-muted-foreground">{t('payments.advances.hasActiveAdvance')}</p>
          ) : (
            <>
              {eligibility && (
                <p className="text-sm text-muted-foreground">
                  {t('payments.advances.maxAmount')} : {formatCurrency(eligibility.maxAdvanceAmount, currencyCode)}
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">{t('payments.advances.amount')}</label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} />
                </div>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || !amount}>
                  {t('payments.advances.submit')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('app.noData')}</p>
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
                {sorted.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{formatCurrency(advance.amount, currencyCode)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                        {t(`payments.advances.status_${advance.status}`)}
                      </Badge>
                      {(advance.status === 'en_remboursement' || advance.status === 'verse_mobile_money') && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('payments.advances.remainingBalance')} : {formatCurrency(advance.remainingBalance, currencyCode)}
                        </p>
                      )}
                    </TableCell>
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
