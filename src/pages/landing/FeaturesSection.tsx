import { useTranslation } from 'react-i18next';
import { Users, Calculator, Calendar, Building2, type LucideIcon } from 'lucide-react';

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'employees', icon: Users },
  { key: 'payroll', icon: Calculator },
  { key: 'leaves', icon: Calendar },
  { key: 'multiCompany', icon: Building2 },
];

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section id="fonctionnalites" className="scroll-mt-16 border-t border-border bg-muted/30 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('landing.features.title')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.features.subtitle')}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ key, icon: Icon }) => (
            <div key={key} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-full flex flex-col">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="pt-4 text-base font-semibold text-foreground">{t(`landing.features.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`landing.features.${key}.description`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
