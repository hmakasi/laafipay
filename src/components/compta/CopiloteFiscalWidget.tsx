import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, FileBarChart, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { mockFiscalDeadlines, mockLegalStatementTemplates } from '@/mocks/compta';
import type { ComptaCountryCode, DeadlineSeverity } from '@/types/compta';

const COUNTRY_FLAG: Record<ComptaCountryCode, string> = { BF: '🇧🇫', BJ: '🇧🇯', CD: '🇨🇩' };

const SEVERITY_VARIANT: Record<DeadlineSeverity, 'destructive' | 'warning' | 'accent'> = {
  critical: 'destructive',
  warning: 'warning',
  info: 'accent',
};

export function CopiloteFiscalWidget() {
  const today = new Date();
  const sorted = [...mockFiscalDeadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Copilote Fiscal &amp; Social SYSCOHADA</CardTitle>
            <CardDescription>Alertes prédictives anti-pénalités · Burkina Faso, Bénin, RDC</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sorted.map((dl) => {
            const days = differenceInDays(parseISO(dl.dueDate), today);
            return (
              <div key={dl.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="text-lg" aria-hidden="true">{COUNTRY_FLAG[dl.countryCode]}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{dl.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {dl.organisme} · échéance {formatDate(dl.dueDate)}
                    {dl.montantEstime !== undefined && ` · ${formatCurrency(dl.montantEstime)} est.`}
                  </div>
                </div>
                <Badge variant={SEVERITY_VARIANT[dl.severity]} className="shrink-0">
                  {dl.severity === 'critical' && <AlertTriangle className="mr-1 h-3 w-3" />}
                  {days >= 0 ? `J-${days}` : 'En retard'}
                </Badge>
              </div>
            );
          })}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            États financiers &amp; bordereaux légaux — génération en 1 clic
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {mockLegalStatementTemplates.map((tpl) => (
              <Button key={tpl.type} variant="outline" size="sm" className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left">
                <span className="font-medium">{tpl.label}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{tpl.description}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
