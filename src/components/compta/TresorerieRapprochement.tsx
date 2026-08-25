import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTreasuryAccountsQuery, useTreasuryTransactionsQuery } from '@/hooks/useTreasury';
import { formatCurrency } from '@/lib/utils';
import type { ReconciliationStatus, TreasuryMobileMoneyProvider } from '@/types/treasury';

const PROVIDER_LABEL: Record<TreasuryMobileMoneyProvider, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  moov_money: 'Moov Money',
  mtn_money: 'MTN Money',
  m_pesa: 'M-Pesa',
};

const STATUS_META: Record<ReconciliationStatus, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  rapproche: { label: 'Rapproché', variant: 'success' },
  en_attente: { label: 'En attente', variant: 'warning' },
  anomalie: { label: 'Anomalie', variant: 'destructive' },
};

export function TresorerieRapprochement() {
  const navigate = useNavigate();
  const { data: accounts, isLoading: loadingAccounts } = useTreasuryAccountsQuery();
  const { data: transactions, isLoading: loadingTransactions } = useTreasuryTransactionsQuery();

  const totalSolde = (accounts ?? []).reduce((sum, a) => (a.currencyCode === 'XOF' ? sum + a.solde : sum), 0);
  const anomalies = (transactions ?? []).filter((t) => t.statut === 'anomalie').length;
  const recentTransactions = (transactions ?? []).slice(0, 5);
  const isLoading = loadingAccounts || loadingTransactions;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Moteur de Rapprochement Mobile Money &amp; Banque</CardTitle>
            <CardDescription>Trésorerie unifiée · {formatCurrency(totalSolde)} (comptes XOF)</CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {anomalies > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" /> {anomalies} anomalie{anomalies > 1 ? 's' : ''}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate('/compta/tresorerie')}>
            Ouvrir le module
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {!accounts || accounts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucun compte de trésorerie pour l'instant — crée-en un et importe un relevé depuis le module complet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {accounts.map((acc) => (
                  <div key={acc.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {acc.kind === 'banque' ? <Landmark className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                      {acc.provider ? PROVIDER_LABEL[acc.provider] : 'Banque'}
                    </div>
                    <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{acc.label}</div>
                    <div className="mt-1 text-sm font-semibold">{formatCurrency(acc.solde, acc.currencyCode)}</div>
                  </div>
                ))}
              </div>
            )}

            {recentTransactions.length > 0 && (
              <div className="space-y-2">
                {recentTransactions.map((tx) => {
                  const meta = STATUS_META[tx.statut];
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
                          {tx.kind === 'mobile_money' && tx.provider ? PROVIDER_LABEL[tx.provider] : 'Virement bancaire'}
                          {tx.compteApparie && ` · apparié à ${tx.compteApparie.compte} (${tx.compteApparie.libelle})`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-semibold">
                        {tx.sens === 'decaissement' ? '-' : '+'}
                        {formatCurrency(tx.montant)}
                      </div>
                      <Badge variant={meta.variant} className="shrink-0">
                        {meta.variant === 'success' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {meta.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
