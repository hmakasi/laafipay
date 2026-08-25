import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Landmark, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NewTreasuryAccountDialog } from '@/components/compta/NewTreasuryAccountDialog';
import { ImportStatementDialog } from '@/components/compta/ImportStatementDialog';
import { ReconcileTransactionDialog } from '@/components/compta/ReconcileTransactionDialog';
import { useTreasuryAccountsQuery, useTreasuryTransactionsQuery } from '@/hooks/useTreasury';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ReconciliationStatus, TreasuryMobileMoneyProvider } from '@/types/treasury';

const PROVIDER_LABEL: Record<TreasuryMobileMoneyProvider, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  moov_money: 'Moov Money',
  mtn_money: 'MTN Money',
  m_pesa: 'M-Pesa',
};

const STATUS_META: Record<ReconciliationStatus, { label: string; variant: 'success' | 'warning' | 'destructive'; icon: typeof Clock }> = {
  rapproche: { label: 'Rapproché', variant: 'success', icon: CheckCircle2 },
  en_attente: { label: 'En attente', variant: 'warning', icon: Clock },
  anomalie: { label: 'Anomalie', variant: 'destructive', icon: AlertCircle },
};

export function TresorerieRapprochementPage() {
  const { data: accounts, isLoading: loadingAccounts } = useTreasuryAccountsQuery();
  const { data: transactions, isLoading: loadingTransactions } = useTreasuryTransactionsQuery();

  const anomalies = transactions?.filter((t) => t.statut === 'anomalie').length ?? 0;
  const enAttente = transactions?.filter((t) => t.statut === 'en_attente').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Trésorerie &amp; Rapprochement</h1>
            <p className="text-sm text-muted-foreground">
              Comptes bancaires et Mobile Money, alimentés par import de relevé — rapprochement automatique des salaires versés.
            </p>
          </div>
        </div>
        <NewTreasuryAccountDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <Skeleton className="h-24 w-full" />
          ) : !accounts || accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun compte pour l'instant — crée un compte bancaire ou Mobile Money pour commencer à importer des relevés.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {acc.kind === 'banque' ? <Landmark className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {acc.provider ? PROVIDER_LABEL[acc.provider] : 'Banque'}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">{acc.label}</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(acc.solde, acc.currencyCode)}</div>
                  <ImportStatementDialog accountId={acc.id} accountLabel={acc.label} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">Mouvements &amp; rapprochement</CardTitle>
          <div className="flex gap-2">
            {enAttente > 0 && <Badge variant="warning">{enAttente} en attente</Badge>}
            {anomalies > 0 && <Badge variant="destructive">{anomalies} anomalie{anomalies > 1 ? 's' : ''}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <Skeleton className="h-40 w-full" />
          ) : !transactions || transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun mouvement importé pour l'instant. Importe un relevé sur un des comptes ci-dessus.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const meta = STATUS_META[tx.statut];
                const StatusIcon = meta.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                    <div
                      className={
                        tx.sens === 'encaissement'
                          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
                      }
                    >
                      {tx.sens === 'encaissement' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{tx.libelle}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.date)} · {tx.accountLabel}
                        {tx.compteApparie && ` · apparié à ${tx.compteApparie.compte} (${tx.compteApparie.libelle})`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-semibold">
                      {tx.sens === 'decaissement' ? '-' : '+'}
                      {formatCurrency(tx.montant)}
                    </div>
                    <Badge variant={meta.variant} className="shrink-0">
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {meta.label}
                    </Badge>
                    <ReconcileTransactionDialog transaction={tx} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
