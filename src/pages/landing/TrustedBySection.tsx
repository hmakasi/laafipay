import { useTranslation } from 'react-i18next';

// Bande de preuve sociale juste sous le hero — liste de clients réels tant
// qu'aucun logo (fichier image) n'est fourni : wordmark texte plutôt
// qu'un logo fabriqué, pour ne jamais afficher une marque qui ne lui
// appartient pas. Remplacer chaque <span> par un <img src="..." alt="..." />
// dès que les logos sont disponibles (voir Artifact "assets" ou un simple
// fichier dans public/).
export function TrustedBySection() {
  const { t } = useTranslation();
  const companies = t('landing.trustedBy.companies', { returnObjects: true }) as string[];

  return (
    <section className="border-y border-border bg-muted/20 py-8">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('landing.trustedBy.title')}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {companies.map((name) => (
            <span key={name} className="text-lg font-bold tracking-tight text-foreground/60 transition hover:text-foreground">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
