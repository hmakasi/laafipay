import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLANS = ['starter', 'business', 'enterprise'] as const;
const HIGHLIGHTED_PLAN = 'business';

export function PricingSection() {
  const { t } = useTranslation();

  return (
    <section id="tarifs" className="scroll-mt-16 border-t border-border bg-muted/30 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('landing.pricing.title')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.pricing.subtitle')}</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isHighlighted = plan === HIGHLIGHTED_PLAN;
            const features = t(`landing.pricing.${plan}.features`, { returnObjects: true }) as string[];
            const trial = t(`landing.pricing.${plan}.trial`, { defaultValue: '' });
            return (
              <Card
                key={plan}
                className={cn('relative flex flex-col', isHighlighted && 'border-primary shadow-lg')}
              >
                {isHighlighted && (
                  <Badge variant="accent" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    {t('landing.pricing.popular')}
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{t(`landing.pricing.${plan}.name`)}</CardTitle>
                  <CardDescription>{t(`landing.pricing.${plan}.description`)}</CardDescription>
                  <p className="pt-2 text-3xl font-bold text-foreground">
                    {t(`landing.pricing.${plan}.price`)}
                    {plan !== 'enterprise' && (
                      <span className="text-base font-normal text-muted-foreground">{t('landing.pricing.period')}</span>
                    )}
                  </p>
                  {trial && (
                    <Badge variant="success" className="w-fit">
                      {trial}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={isHighlighted ? 'default' : 'outline'} asChild>
                    <Link to="/signup">{t('landing.pricing.cta')}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
