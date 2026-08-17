import { COUNTRY_META } from '@/lib/constants';
import { Company } from '@/types';

// Badge de contexte entreprise pour la barre d'en-tête, ex. :
// [ 🇨🇩 RDC | SODEICO SARL (USD) ]
//
// Purement présentationnel : reçoit l'entreprise active en prop plutôt que
// de la lire d'un store. Aujourd'hui `useAuthStore` n'expose que `user`
// (pas de company/entreprise active) — brancher ce badge dans Topbar.tsx
// suppose d'abord d'exposer l'entreprise courante (réponse de connexion
// enrichie, ou un futur useActiveCompanyQuery()).
export function CompanyHeaderBadge({ company }: { company: Company }) {
  const meta = COUNTRY_META[company.countryCode];

  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
      <span aria-hidden="true">{meta.flag}</span>
      <span className="font-medium text-muted-foreground">{meta.code}</span>
      <span className="text-muted-foreground">|</span>
      <span className="font-semibold">{company.name}</span>
      <span className="text-muted-foreground">({company.currencyCode})</span>
    </div>
  );
}
