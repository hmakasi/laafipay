import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartOfAccountsQuery } from '@/hooks/useComptaLedger';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { COUNTRY_META } from '@/lib/constants';

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  );
}

export function ComptaParametresPage() {
  const { data: accounts, isLoading } = useChartOfAccountsQuery();
  const { data: company } = useCurrentCompanyQuery();
  const countryMeta = company ? COUNTRY_META[company.countryCode] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Paramètres LaafiCompta</h1>
          <p className="text-sm text-muted-foreground">Informations légales et plan comptable de l'entreprise.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations légales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {!company ? (
            <Skeleton className="h-16 w-full sm:col-span-3" />
          ) : (
            <>
              <Field label="Raison sociale" value={company.legalName} />
              <Field label={countryMeta?.taxIdLabel ?? 'Identifiant fiscal'} value={company.taxIdNumber} />
              <Field label={`N° ${countryMeta?.socialAgencyLabel ?? 'sécurité sociale'} employeur`} value={company.socialSecurityNumber} />
              <Field label="Pays" value={countryMeta?.name} />
              <Field label="Devise" value={company.currencyCode} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan comptable</CardTitle>
          <p className="text-sm text-muted-foreground">Comptes SYSCOHADA réellement mouvementés par les écritures enregistrées.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !accounts || accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun compte pour l'instant — la liste se remplira dès qu'une écriture sera enregistrée.
            </p>
          ) : (
            <ul className="divide-y">
              {accounts.map((a) => (
                <li key={a.compte} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-16 shrink-0 font-mono text-xs">{a.compte}</span>
                  <span className="text-muted-foreground">{a.libelle}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
