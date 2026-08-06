import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardCarousel } from './DashboardCarousel';

function ReassuranceItem({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Check className="h-4 w-4 shrink-0 text-primary" />
      {children}
    </span>
  );
}

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="container grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
      <div className="animate-fade-in space-y-6">
        <Badge variant="accent">{t('landing.hero.badge')}</Badge>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {t('landing.hero.title')}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t('landing.hero.subtitle')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/signup">
              {t('landing.hero.ctaPrimary')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#contact">{t('landing.hero.ctaSecondary')}</a>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ReassuranceItem>{t('landing.hero.reassurance.trial')}</ReassuranceItem>
          <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
          <ReassuranceItem>{t('landing.hero.reassurance.whatsapp')}</ReassuranceItem>
          <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
          <ReassuranceItem>{t('landing.hero.reassurance.compliance')}</ReassuranceItem>
        </div>
      </div>

      <div className="space-y-2">
        <DashboardCarousel />
        <p className="text-center text-xs text-muted-foreground">{t('landing.hero.mockupCaption')}</p>
      </div>
    </section>
  );
}
