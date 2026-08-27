import { Construction, FileBarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrialBalanceQuery } from '@/hooks/useComptaLedger';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { formatCurrency } from '@/lib/utils';

const COMING_SOON = [
  { label: 'Bilan', description: 'Situation patrimoniale SYSCOHADA (actif / passif)' },
  { label: 'Compte de résultat', description: 'Charges et produits de l’exercice' },
  { label: 'TAFIRE', description: 'Tableau financier des ressources et emplois' },
];

export function ComptaRapportsPage() {
  const { data: balance, isLoading } = useTrialBalanceQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileBarChart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">États financiers</h1>
          <p className="text-sm text-muted-foreground">
            Balance générale calculée depuis les écritures réelles. Les autres états nécessitent un grand livre complet (achats/ventes),
            pas encore disponible.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance générale</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !balance || balance.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune écriture pour l'instant — la balance se remplira dès qu'un cycle de paie sera validé.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Compte</th>
                    <th className="px-3 py-2 text-left font-medium">Libellé</th>
                    <th className="px-3 py-2 text-right font-medium">Débit</th>
                    <th className="px-3 py-2 text-right font-medium">Crédit</th>
                    <th className="px-3 py-2 text-right font-medium">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.rows.map((row) => (
                    <tr key={row.compte} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{row.compte}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.libelleCompte}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.debit, currencyCode)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.credit, currencyCode)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {row.solde < 0 ? '-' : ''}
                        {formatCurrency(Math.abs(row.solde), currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(balance.totals.debit, currencyCode)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(balance.totals.credit, currencyCode)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COMING_SOON.map((item) => (
          <Card key={item.label} className="opacity-60">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Construction className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm font-medium">{item.label}</div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <p className="text-xs text-muted-foreground">Bientôt disponible</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
