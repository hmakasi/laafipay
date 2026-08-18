import { Trans, useTranslation } from 'react-i18next';
import { CheckCircle2, Quote, ShieldCheck, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Carte en classes Tailwind littérales (pas les tokens bg-card/border de
// l'app interne) : langage visuel déjà en place sur la landing page
// (voir FeaturesSection.tsx), figé en clair indépendamment du thème sombre
// de l'app. Une seule constante, réutilisée par les 4 cartes du composant —
// ce n'est pas un composant séparé, juste une chaîne de classes partagée.
const CARD = 'rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm transition-shadow hover:shadow-md';

// Mise en valeur réutilisée par les deux paragraphes formatés via <Trans>
// (vision de l'entreprise, description "conformité").
const STRONG = <strong className="font-semibold text-slate-900" />;

// Tout le contenu "À propos" de LaafiPay dans un seul fichier : en-tête,
// vision de l'entreprise + mot de la fondatrice, puis les deux engagements
// (conformité paie / gestion RH). Le Contact a été extrait dans
// ContactSection.tsx — il ne fait plus partie de cette structure.
export function AboutSection() {
  const { t } = useTranslation();
  const hrItems = t('landing.valueProps.hrManagement.items', { returnObjects: true }) as string[];

  return (
    <section className="bg-slate-50 py-16">
      <div className="container">
        <div id="a-propos" className="mx-auto max-w-5xl scroll-mt-16">
          {/* En-tête principal */}
          <div className="text-center">
            <Badge className="border-transparent bg-emerald-100 font-semibold uppercase tracking-wide text-emerald-700 hover:bg-emerald-100">
              {t('landing.about.kicker')}
            </Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{t('landing.about.title')}</h2>
          </div>

          {/* Première rangée — Vision & Fondatrice */}
          <div className="mb-12 mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Carte 1 — Notre engagement */}
            <div className={CARD}>
              <Badge className="border-transparent bg-emerald-100 font-semibold uppercase tracking-wide text-emerald-700 hover:bg-emerald-100">
                {t('landing.about.vision.kicker')}
              </Badge>
              <h3 className="mt-4 text-2xl font-bold text-slate-900">{t('landing.about.vision.title')}</h3>
              <p className="mt-4 text-slate-800">
                <Trans i18nKey="landing.about.vision.description" components={{ 1: STRONG, 2: STRONG, 3: STRONG }} />
              </p>
            </div>

            {/* Carte 2 — Le mot de la fondatrice.
               Ni nom ni photo fournis dans le contenu à intégrer : silhouette
               générique (avec libellé accessible) plutôt qu'un nom inventé sur
               une page publique réelle. Remplacer AvatarFallback par
               <AvatarImage src="..." alt="Prénom Nom" /> une fois la photo prête. */}
            <div className={CARD}>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-emerald-500 bg-emerald-100">
                  <AvatarFallback
                    className="bg-emerald-100 text-emerald-700"
                    aria-label={t('landing.about.founder.role')}
                  >
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {t('landing.about.founder.badge')}
                </Badge>
              </div>
              <h3 className="mt-5 text-2xl font-bold text-slate-900">{t('landing.about.founder.title')}</h3>
              <blockquote className="mt-4 flex gap-3 border-l-4 border-emerald-500 pl-4">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="italic text-slate-800">{t('landing.about.founder.quote')}</p>
              </blockquote>
            </div>
          </div>

          {/* Deuxième rangée — Engagements & fonctionnalités */}
          <div className="mt-12">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
              {t('landing.valueProps.title')}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Carte A — Des experts paie dédiés */}
              <div className={CARD}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="pt-4 text-lg font-semibold text-slate-900">
                  {t('landing.valueProps.compliance.title')}
                </h3>
                <p className="mt-2 text-sm text-slate-800">
                  <Trans
                    i18nKey="landing.valueProps.compliance.description"
                    components={{ 1: STRONG, 2: STRONG, 3: STRONG, 4: STRONG }}
                  />
                </p>
              </div>

              {/* Carte B — Gestion complète du personnel */}
              <div className={CARD}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="pt-4 text-lg font-semibold text-slate-900">
                  {t('landing.valueProps.hrManagement.title')}
                </h3>
                <p className="mt-2 text-sm text-slate-800">{t('landing.valueProps.hrManagement.intro')}</p>
                <ul className="mt-3 space-y-2">
                  {hrItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-800">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
