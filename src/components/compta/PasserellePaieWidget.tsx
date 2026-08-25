import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock, FileText, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentValidationPanel } from '@/components/compta/PaymentValidationPanel';
import { useComptaBridgeEventsQuery } from '@/hooks/useComptaBridge';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { formatCurrency, formatDate, formatPeriod } from '@/lib/utils';
import type { ComptaOutboxStatus } from '@/types/comptaBridge';

const STATUS_META: Record<ComptaOutboxStatus, { label: string; variant: 'warning' | 'success' | 'destructive'; icon: typeof Clock }> = {
  en_attente: { label: 'Livraison en cours', variant: 'warning', icon: Clock },
  envoye: { label: 'Synchronisé', variant: 'success', icon: CheckCircle2 },
  echec: { label: 'Échec de livraison', variant: 'destructive', icon: AlertTriangle },
};

export function PasserellePaieWidget() {
  const navigate = useNavigate();
  const { data: company } = useCurrentCompanyQuery();
  const { data: events, isLoading } = useComptaBridgeEventsQuery();
  const latest = events?.[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Passerelle Paie &amp; Charges Sociales</CardTitle>
            <CardDescription>
              {company?.name}
              {latest && ` · cycle ${formatPeriod(latest.period)}`}
            </CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {latest && (
            <Badge variant={STATUS_META[latest.status].variant}>
              {(() => {
                const Icon = STATUS_META[latest.status].icon;
                return <Icon className="mr-1 h-3 w-3" />;
              })()}
              {STATUS_META[latest.status].label}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate('/compta/passerelle-paie')}>
            Voir tout l'historique
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !latest ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun cycle de paie validé pour l'instant. Son OD apparaîtra ici dès la clôture d'un cycle dans LaafiPay.
          </p>
        ) : latest.journalEntry ? (
          <div className="space-y-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              OD de paie injectée — {latest.journalEntry.piece}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Compte</th>
                    <th className="px-3 py-2 text-left font-medium">Libellé</th>
                    <th className="px-3 py-2 text-right font-medium">Débit</th>
                    <th className="px-3 py-2 text-right font-medium">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.journalEntry.lignes.map((line) => (
                    <tr key={line.compte} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{line.compte}</td>
                      <td className="px-3 py-2 text-muted-foreground">{line.libelleCompte}</td>
                      <td className="px-3 py-2 text-right">{line.debit ? formatCurrency(line.debit, latest.currencyCode) : '—'}</td>
                      <td className="px-3 py-2 text-right">{line.credit ? formatCurrency(line.credit, latest.currencyCode) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Reçu par LaafiCompta le {formatDate(latest.journalEntry.receivedAt.slice(0, 10))}</p>
            <PaymentValidationPanel journalEntry={latest.journalEntry} />
          </div>
        ) : (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {latest.status === 'echec' && latest.lastError ? latest.lastError : 'En attente de confirmation de LaafiCompta…'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
