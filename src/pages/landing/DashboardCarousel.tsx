import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const SLIDE_DURATION_MS = 4000;

type BadgeTone = 'success' | 'warning' | 'info';

interface SlideRow {
  leading: { kind: 'avatar'; initials: string } | { kind: 'emoji'; icon: string };
  label: string;
  badgeText: string;
  badgeTone: BadgeTone;
}

interface Slide {
  title: string;
  amount?: string;
  meta?: string;
  accessory?: ReactNode;
  rows: SlideRow[];
}

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'status-success',
  warning: 'status-warning',
  info: 'status-info',
};

function LiveIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  );
}

function useSlides(): Slide[] {
  const { t } = useTranslation();

  return [
    {
      title: t('landing.hero.mockup.payrollLabel'),
      amount: t('landing.hero.mockup.amount'),
      accessory: <Badge variant="success">{t('landing.hero.mockup.complianceBadge')}</Badge>,
      rows: [
        {
          leading: { kind: 'avatar', initials: 'LA' },
          label: 'Laafi Aminata',
          badgeText: t('landing.hero.mockup.paidVia', { operator: 'Orange Money' }),
          badgeTone: 'success',
        },
        {
          leading: { kind: 'avatar', initials: 'LM' },
          label: 'Laafi Moussa',
          badgeText: t('landing.hero.mockup.paidVia', { operator: 'Moov Money' }),
          badgeTone: 'success',
        },
        {
          leading: { kind: 'avatar', initials: 'LF' },
          label: 'Laafi Fatimata',
          badgeText: t('landing.hero.mockup.pending'),
          badgeTone: 'warning',
        },
      ],
    },
    {
      title: t('landing.hero.mockup.whatsappTitle'),
      accessory: <LiveIndicator label={t('landing.hero.mockup.live')} />,
      rows: [
        {
          leading: { kind: 'emoji', icon: '📄' },
          label: t('landing.hero.mockup.payslipSent', { name: 'Laafi Aminata' }),
          badgeText: t('landing.hero.mockup.receivedWhatsapp'),
          badgeTone: 'success',
        },
        {
          leading: { kind: 'emoji', icon: '🌴' },
          label: t('landing.hero.mockup.leaveRequest', { name: 'Laafi Moussa', days: 3 }),
          badgeText: t('landing.hero.mockup.pendingValidation'),
          badgeTone: 'warning',
        },
        {
          leading: { kind: 'emoji', icon: '📲' },
          label: t('landing.hero.mockup.payslipSent', { name: 'Laafi Fatimata' }),
          badgeText: t('landing.hero.mockup.receivedWhatsapp'),
          badgeTone: 'success',
        },
      ],
    },
    {
      title: t('landing.hero.mockup.declarationsTitle'),
      meta: t('landing.hero.mockup.month'),
      rows: [
        {
          leading: { kind: 'emoji', icon: '🏛️' },
          label: t('landing.hero.mockup.cnssLabel'),
          badgeText: t('landing.hero.mockup.cnssReady'),
          badgeTone: 'success',
        },
        {
          leading: { kind: 'emoji', icon: '📑' },
          label: t('landing.hero.mockup.iutsLabel'),
          badgeText: t('landing.hero.mockup.iutsCompliant'),
          badgeTone: 'success',
        },
        {
          leading: { kind: 'emoji', icon: '📊' },
          label: t('landing.hero.mockup.bankOrderLabel'),
          badgeText: t('landing.hero.mockup.bankOrderGenerated'),
          badgeTone: 'info',
        },
      ],
    },
  ];
}

export function DashboardCarousel() {
  const slides = useSlides();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[activeIndex];

  return (
    <div className="animate-fade-in overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      <div className="flex">
        <div className="hidden w-14 flex-col gap-3 bg-slate-900 p-3 sm:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-2.5 w-8 rounded-full ${i === 0 ? 'bg-primary' : 'bg-white/15'}`} />
          ))}
        </div>

        <div className="min-h-[236px] flex-1 p-5">
          <div key={activeIndex} className="animate-fade-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {slide.title}
                  {slide.meta && <span className="ml-1 text-muted-foreground/70">— {slide.meta}</span>}
                </p>
                {slide.amount && <p className="mt-1 text-2xl font-bold text-foreground">{slide.amount}</p>}
              </div>
              {slide.accessory && <div className="shrink-0">{slide.accessory}</div>}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              {slide.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {row.leading.kind === 'avatar' ? (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {row.leading.initials}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                        {row.leading.icon}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                  </div>
                  <span className={cn('shrink-0 whitespace-nowrap', TONE_CLASS[row.badgeTone])}>{row.badgeText}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/30 py-3">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Vue ${i + 1}`}
            onClick={() => setActiveIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );
}
