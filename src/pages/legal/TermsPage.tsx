import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { LandingHeader } from '@/pages/landing/LandingHeader';
import { LandingFooter } from '@/pages/landing/LandingFooter';

// Sections dans l'ordre d'affichage — chaque clé pointe vers
// legal.terms.<key>.{heading,body} dans fr.json.
const SECTIONS = ['purpose', 'access', 'account', 'billing', 'liability', 'termination', 'jurisdiction', 'contact'] as const;

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="container max-w-3xl py-12 md:py-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('legal.backToSite')}
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{t('legal.terms.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('legal.lastUpdated', { date: new Date().toLocaleDateString('fr-FR') })}
        </p>
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t('legal.placeholderNotice')}
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((key) => (
            <section key={key}>
              <h2 className="text-lg font-semibold text-foreground">{t(`legal.terms.${key}.heading`)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`legal.terms.${key}.body`)}</p>
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
