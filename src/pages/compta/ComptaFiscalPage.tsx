import { ShieldAlert } from 'lucide-react';
import { CopiloteFiscalWidget } from '@/components/compta/CopiloteFiscalWidget';

export function ComptaFiscalPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Copilote Fiscal &amp; Social</h1>
          <p className="text-sm text-muted-foreground">
            Échéances fiscales et sociales à venir, calculées depuis les données réelles de paie de l'entreprise.
          </p>
        </div>
      </div>

      <CopiloteFiscalWidget />
    </div>
  );
}
