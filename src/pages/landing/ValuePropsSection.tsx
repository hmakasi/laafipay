import { useTranslation } from 'react-i18next';
import { ShieldCheck, Users2, type LucideIcon } from 'lucide-react';

const VALUE_PROPS: { key: string; icon: LucideIcon }[] = [
  { key: 'compliance', icon: ShieldCheck },
  { key: 'hrManagement', icon: Users2 },
];

// Reprend le style de carte déjà utilisé par FeaturesSection.tsx sur cette
// même landing page (bg-white/border-slate-200 en dur plutôt que les tokens
// sémantiques bg-card/border utilisés ailleurs dans l'app) — c'est le
// vocabulaire visuel déjà en place pour les blocs "icône + titre + texte"
// de la page publique, on ne l'invente pas ici.
export function ValuePropsSection() {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('landing.valueProps.title')}</h2>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {VALUE_PROPS.map(({ key, icon: Icon }) => (
            <div key={key} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="pt-4 text-lg font-semibold text-foreground">{t(`landing.valueProps.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`landing.valueProps.${key}.description`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
