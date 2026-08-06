import { useTranslation } from 'react-i18next';

export function LandingFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container flex flex-col gap-8 py-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <span className="text-lg font-bold text-primary">{t('app.name')}</span>
          <p className="mt-2 text-sm text-muted-foreground">{t('landing.footer.tagline')}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('landing.footer.product')}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#fonctionnalites" className="hover:text-foreground">
                  {t('landing.nav.features')}
                </a>
              </li>
              <li>
                <a href="#tarifs" className="hover:text-foreground">
                  {t('landing.nav.pricing')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('landing.footer.legal')}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground">
                  {t('landing.footer.legalNotice')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  {t('landing.footer.terms')}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6">
        <p className="container text-center text-xs text-muted-foreground">
          © {year} {t('app.name')}. {t('landing.footer.rights')}
        </p>
      </div>
    </footer>
  );
}
