import { useTranslation } from 'react-i18next';

// Bande de preuve sociale juste sous le hero — liste de clients réels tant
// qu'aucun logo (fichier image) n'est fourni : wordmark texte plutôt
// qu'un logo fabriqué, pour ne jamais afficher une marque qui ne lui
// appartient pas. Remplacer chaque <span> par un <img src="..." alt="..." />
// dès que les logos sont disponibles (voir Artifact "assets" ou un simple
// fichier dans public/).
//
// Défilement en continu (marquee) plutôt qu'une ligne statique, pour donner
// un signal de dynamisme/mouvement — répétition x2 du contenu pour boucler
// sans à-coup (translateX(-50%) ramène exactement sur la 2e copie), se met
// en pause au survol (lecture facilitée) et respecte prefers-reduced-motion
// (accessibilité : pas de défilement forcé pour qui le demande).
//
// Couleur volontairement neutre par défaut (gris), pas la couleur de marque :
// c'est la convention chez PayFit/Personio/Stripe — une bande de logos
// clients en couleur pleine entre en concurrence visuelle avec les CTA de la
// page et dilue l'attention. Le vert de marque n'apparaît qu'au survol,
// comme signal d'interactivité plutôt que bloc de couleur statique.
function TrustedByRow({ companies, ariaHidden }: { companies: string[]; ariaHidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={ariaHidden}>
      {companies.map((name, i) => (
        <span key={`${name}-${i}`} className="flex items-center gap-10">
          <span className="text-lg font-semibold tracking-wide text-foreground/55 transition-colors hover:text-primary">
            {name}
          </span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-border" />
        </span>
      ))}
    </div>
  );
}

export function TrustedBySection() {
  const { t } = useTranslation();
  const companies = t('landing.trustedBy.companies', { returnObjects: true }) as string[];

  return (
    <section className="border-y border-border bg-muted/20 py-8">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('landing.trustedBy.title')}
        </p>
        <div
          className="relative mt-5 overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
        >
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
            <TrustedByRow companies={companies} />
            <TrustedByRow companies={companies} ariaHidden />
          </div>
        </div>
      </div>
    </section>
  );
}
