import { useTranslation } from 'react-i18next';

const STEPS = ['step1', 'step2', 'step3'] as const;

export function HowItWorksSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('landing.howItWorks.title')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.howItWorks.subtitle')}</p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t(`landing.howItWorks.${step}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`landing.howItWorks.${step}.description`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
