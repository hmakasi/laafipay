import { useTranslation } from 'react-i18next';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { COUNTRY_META } from '@/lib/constants';
import { resolveUploadUrl } from '@/lib/apiClient';

// Bloc "employeur" d'un bulletin de paie, rempli automatiquement depuis
// l'entreprise courante (useCurrentCompanyQuery — même source que le reste
// de l'app, pas de Context/store dédié : React Query fait déjà exactement
// ça). Utilisé par PayslipPreviewDialog.tsx et PayslipView.tsx pour ne pas
// dupliquer un champ "employeur" codé en dur à deux endroits.
export function PayslipEmployerHeader() {
  const { t } = useTranslation();
  const { data: company } = useCurrentCompanyQuery();

  const addressLine = [company?.address, company?.postalCode, company?.city].filter(Boolean).join(', ');
  const countryMeta = company ? COUNTRY_META[company.countryCode] : undefined;
  const logoUrl = resolveUploadUrl(company?.logo);

  const taxIdRow = company?.taxIdNumber && (
    <div key="taxId" className="text-xs text-muted-foreground">
      {countryMeta?.taxIdLabel} : {company.taxIdNumber}
    </div>
  );
  const cnssRow = company?.socialSecurityNumber && (
    <div key="cnss" className="text-xs text-muted-foreground">
      {countryMeta?.socialAgencyLabel ?? t('payslips.employerNumber')} : {company.socialSecurityNumber}
    </div>
  );
  const numberRows = countryMeta?.employerNumbersOrder.map((field) => (field === 'taxId' ? taxIdRow : cnssRow)) ?? [
    taxIdRow,
    cnssRow,
  ];

  return (
    <div className="flex items-start gap-3">
      {logoUrl && <img src={logoUrl} alt={company?.name} className="h-10 max-w-[100px] shrink-0 object-contain" />}
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">{t('payslips.employerInfo')}</div>
        <div className="font-medium">{company?.legalName ?? company?.name ?? '—'}</div>
        {addressLine && <div className="text-muted-foreground">{addressLine}</div>}
        {numberRows}
      </div>
    </div>
  );
}
