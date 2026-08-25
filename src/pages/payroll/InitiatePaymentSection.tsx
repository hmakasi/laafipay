import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Landmark, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useCreateBankTransferPaymentMutation, useCreateMobileMoneyPaymentMutation, usePaymentOrdersQuery } from '@/hooks/usePayments';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { useComptaBridgeEventsQuery } from '@/hooks/useComptaBridge';
import { useAuthStore } from '@/store/authStore';
import { PAYMENT_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Employee, PayrollCycle } from '@/types';

function EligibleEmployeesDialog({
  type,
  cycle,
  employees,
}: {
  type: 'mobile_money' | 'virement';
  cycle: PayrollCycle;
  employees: Employee[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const mobileMoneyMutation = useCreateMobileMoneyPaymentMutation();
  const bankTransferMutation = useCreateBankTransferPaymentMutation();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  const eligible = useMemo(
    () =>
      cycle.entries
        .map((entry) => ({ entry, emp: employees.find((e) => e.id === entry.employeeId) }))
        .filter(({ emp }) => {
          if (!emp) return false;
          if (type === 'mobile_money') return emp.paymentMethod === 'mobile_money' || emp.paymentMethod === 'mixte';
          return emp.paymentMethod === 'virement' || emp.paymentMethod === 'mixte';
        }),
    [cycle.entries, employees, type]
  );

  const allSelected = eligible.length > 0 && eligible.every(({ entry }) => selected.has(entry.employeeId));
  const total = eligible
    .filter(({ entry }) => selected.has(entry.employeeId))
    .reduce((sum, { entry }) => sum + entry.salaireNet, 0);

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(eligible.map(({ entry }) => entry.employeeId)));
  };

  const toggleOne = (employeeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!user || selected.size === 0) return;
    const items = eligible
      .filter(({ entry }) => selected.has(entry.employeeId))
      .map(({ entry }) => ({ employeeId: entry.employeeId, amount: entry.salaireNet }));

    try {
      const order =
        type === 'mobile_money'
          ? await mobileMoneyMutation.mutateAsync({ cycleId: cycle.id, items, createdBy: user.email })
          : await bankTransferMutation.mutateAsync({ cycleId: cycle.id, items, createdBy: user.email });

      toast.success(t('payments.launchPayment'));
      setOpen(false);
      navigate(`/payments/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du lancement du paiement');
    }
  };

  const isPending = mobileMoneyMutation.isPending || bankTransferMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {type === 'mobile_money' ? <Smartphone className="mr-2 h-4 w-4" /> : <Landmark className="mr-2 h-4 w-4" />}
          {type === 'mobile_money' ? t('payments.massPayment') : t('payments.bankTransfer')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('payments.selectEmployees')}</DialogTitle>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('app.noResults')}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b pb-2">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span className="text-sm text-muted-foreground">{t('app.selectAll')}</span>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {eligible.map(({ entry, emp }) => (
                <label
                  key={entry.employeeId}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <Checkbox checked={selected.has(entry.employeeId)} onCheckedChange={() => toggleOne(entry.employeeId)} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {emp!.firstName} {emp!.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {type === 'mobile_money'
                        ? `${emp!.mobileMoneyInfo ? t(`employees.operator_${emp!.mobileMoneyInfo.operator}`) : '—'} · ${emp!.mobileMoneyInfo?.phoneNumber ?? '—'}`
                        : `${emp!.bankInfo?.bankName ?? '—'} · ${emp!.bankInfo?.rib ?? '—'}`}
                    </span>
                  </span>
                  <span className="text-sm font-medium">{formatCurrency(entry.salaireNet, currencyCode)}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{selected.size} sélectionné(s)</span>
              <span className="font-semibold">{formatCurrency(total, currencyCode)}</span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={selected.size === 0 || isPending}>
            {t('payments.launchPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// L'initiation du paiement est bloquée côté serveur tant que la
// comptabilité n'a pas validé le paiement de l'OD correspondante dans
// LaafiCompta (voir server/src/routes/payments.routes.ts). Ce calcul ne
// fait que refléter côté UI la même règle — le serveur la réapplique
// systématiquement, ce n'est pas une barrière de sécurité en soi.
function usePaymentAuthorization(cycleId: string) {
  const { data: bridgeEvents, isLoading } = useComptaBridgeEventsQuery();
  const event = bridgeEvents?.find((e) => e.cycleId === cycleId);

  if (isLoading) return { authorized: false, loading: true, reason: null as string | null };
  if (!event) return { authorized: false, loading: false, reason: "Ce cycle n'a pas encore été transmis à LaafiCompta." };
  if (!event.journalEntry) {
    return {
      authorized: false,
      loading: false,
      reason:
        event.status === 'echec'
          ? "L'OD n'a pas pu être livrée à LaafiCompta pour l'instant (nouvelle tentative automatique en cours)."
          : "L'OD est en cours de livraison à LaafiCompta.",
    };
  }
  if (!event.journalEntry.paymentValidated) {
    return { authorized: false, loading: false, reason: "La comptabilité n'a pas encore validé le paiement de ce cycle dans LaafiCompta." };
  }
  return { authorized: true, loading: false, reason: null };
}

export function InitiatePaymentSection({ cycle, employees }: { cycle: PayrollCycle; employees: Employee[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: orders } = usePaymentOrdersQuery(cycle.id);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const { authorized, loading, reason } = usePaymentAuthorization(cycle.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('payments.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionGate permission="payments:initiate">
          {loading ? null : authorized ? (
            <div className="flex gap-2">
              <EligibleEmployeesDialog type="mobile_money" cycle={cycle} employees={employees} />
              <EligibleEmployeesDialog type="virement" cycle={cycle} employees={employees} />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reason} Le paiement pourra être déclenché dès que la comptabilité l'aura validé dans LaafiCompta.</span>
            </div>
          )}
        </PermissionGate>

        {orders && orders.length > 0 && (
          <div className="space-y-2">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/payments/${order.id}`)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span>
                  {order.type === 'mobile_money' ? t('payments.massPayment') : t('payments.bankTransfer')} ·{' '}
                  {formatPeriod(cycle.period)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatCurrency(order.totalAmount, currencyCode)}</span>
                  <Badge variant={PAYMENT_STATUS_VARIANT[order.status]}>{t(`payments.status_${order.status}`)}</Badge>
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
