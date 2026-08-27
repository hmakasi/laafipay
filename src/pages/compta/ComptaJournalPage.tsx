import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJournalEntriesQuery } from '@/hooks/useComptaLedger';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { formatCurrency, formatDate } from '@/lib/utils';

const JOURNAL_LABEL: Record<'OD' | 'AC', string> = { OD: 'OD — Opérations diverses', AC: 'AC — Achats' };

export function ComptaJournalPage() {
  const [journal, setJournal] = useState<'OD' | 'AC' | 'all'>('all');
  const { data: entries, isLoading } = useJournalEntriesQuery(journal === 'all' ? undefined : journal);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Journal &amp; Écritures</h1>
            <p className="text-sm text-muted-foreground">
              Écritures comptables réellement enregistrées, alimentées automatiquement par la passerelle paie.
            </p>
          </div>
        </div>
        <Select value={journal} onValueChange={(v) => setJournal(v as typeof journal)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les journaux</SelectItem>
            <SelectItem value="OD">{JOURNAL_LABEL.OD}</SelectItem>
            <SelectItem value="AC">{JOURNAL_LABEL.AC}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aucune écriture pour l'instant — la première apparaîtra dès qu'un cycle de paie sera validé.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const totalDebit = entry.lignes.reduce((sum, l) => sum + l.debit, 0);
            return (
              <Card key={entry.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {entry.piece} — {entry.libelle}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {JOURNAL_LABEL[entry.journal]} · {formatDate(entry.dateEcriture)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(totalDebit, currencyCode)}</span>
                </CardHeader>
                <CardContent>
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
                        {entry.lignes.map((l, i) => (
                          <tr key={`${entry.id}-${i}`} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{l.compte}</td>
                            <td className="px-3 py-2 text-muted-foreground">{l.libelleCompte}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.debit ? formatCurrency(l.debit, currencyCode) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.credit ? formatCurrency(l.credit, currencyCode) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
