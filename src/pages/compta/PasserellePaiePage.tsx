import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentValidationPanel } from '@/components/compta/PaymentValidationPanel';
import { useComptaBridgeEventsQuery } from '@/hooks/useComptaBridge';
import { formatCurrency, formatDate, formatPeriod } from '@/lib/utils';
import type { ComptaBridgeEvent, ComptaOutboxStatus } from '@/types/comptaBridge';

const STATUS_META: Record<ComptaOutboxStatus, { label: string; variant: 'warning' | 'success' | 'destructive'; icon: typeof Clock }> = {
  en_attente: { label: 'Livraison en cours', variant: 'warning', icon: Clock },
  envoye: { label: 'Reçu par LaafiCompta', variant: 'success', icon: CheckCircle2 },
  echec: { label: 'Échec de livraison', variant: 'destructive', icon: AlertTriangle },
};

function totalDebit(event: ComptaBridgeEvent): number {
  if (!event.journalEntry) return 0;
  return event.journalEntry.lignes.reduce((sum, l) => sum + l.debit, 0);
}

function BridgeEventCard({ event }: { event: ComptaBridgeEvent }) {
  const meta = STATUS_META[event.status];
  const StatusIcon = meta.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base capitalize">{formatPeriod(event.period)}</CardTitle>
          <CardDescription>
            {event.journalEntry ? `${event.journalEntry.piece} · reçu le ${formatDate(event.journalEntry.receivedAt.slice(0, 10))}` : `Cycle validé le ${formatDate(event.createdAt.slice(0, 10))}`}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={meta.variant}>
            <StatusIcon className="mr-1 h-3 w-3" /> {meta.label}
          </Badge>
          {event.status === 'echec' && (
            <span className="text-[11px] text-muted-foreground">{event.attempts} tentative{event.attempts > 1 ? 's' : ''} · nouvelle tentative automatique</span>
          )}
        </div>
      </CardHeader>

      {event.journalEntry ? (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{event.journalEntry.libelle}</span>
            <span className="font-medium text-foreground">{formatCurrency(totalDebit(event), event.currencyCode)}</span>
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
                {event.journalEntry.lignes.map((line) => (
                  <tr key={line.compte} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{line.compte}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.libelleCompte}</td>
                    <td className="px-3 py-2 text-right">{line.debit ? formatCurrency(line.debit, event.currencyCode) : '—'}</td>
                    <td className="px-3 py-2 text-right">{line.credit ? formatCurrency(line.credit, event.currencyCode) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaymentValidationPanel journalEntry={event.journalEntry} />
        </CardContent>
      ) : (
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {event.status === 'echec' && event.lastError ? event.lastError : 'En attente de confirmation de LaafiCompta…'}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export function PasserellePaiePage() {
  const { data: events, isLoading } = useComptaBridgeEventsQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Passerelle Paie &amp; Charges Sociales</h1>
          <p className="text-sm text-muted-foreground">
            OD de paie générées automatiquement à chaque « Valider le cycle » côté LaafiPay. La comptabilité autorise
            ensuite le paiement des salaires correspondant.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !events || events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aucun cycle de paie validé pour l'instant. Dès qu'un cycle est clôturé dans LaafiPay, son OD apparaît ici automatiquement.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <BridgeEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
