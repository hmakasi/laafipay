import rateLimit from 'express-rate-limit';

// Protection à granularité grossière, pas une garantie dure : le store par
// défaut d'express-rate-limit est en mémoire, propre à un seul process — sur
// Vercel (fonctions serverless), plusieurs instances concurrentes de la même
// route ont chacune leur propre compteur, donc le plafond réel encaissable
// par un attaquant qui répartit ses requêtes peut dépasser sensiblement le
// max nominal ci-dessous. Un store partagé (Vercel KV/Upstash) serait
// nécessaire pour un plafond dur — voir revue de code de l'audit sécurité.
// Suppose aussi `app.set('trust proxy', ...)` configuré (voir app.ts) pour
// que `req.ip` reflète le vrai client plutôt que le proxy Vercel.
//
// Testé en isolation (rateLimit.test.ts) via ce factory plutôt qu'à travers
// l'app complète : les instances exportées plus bas sont désactivées sous
// Vitest (voir `skip`) pour ne pas gêner les suites d'intégration existantes,
// qui appellent des routes comme /forgot-password bien plus souvent qu'un
// client légitime ne le ferait en production. Vérifie spécifiquement
// process.env.VITEST (mis par Vitest lui-même) plutôt que NODE_ENV === 'test'
// — un déploiement preview/staging mal configuré peut définir NODE_ENV=test
// (variable réutilisée depuis la CI) sans jamais tourner sous Vitest ; s'appuyer
// sur NODE_ENV désactiverait alors silencieusement la protection en ligne.
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.VITEST === 'true',
    message: { message: 'Trop de tentatives. Réessayez plus tard.' },
  });
}

// Bourrage d'identifiants : large mais borné, pour ne pas gêner un
// utilisateur légitime qui se trompe plusieurs fois de mot de passe.
export const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// Routes non authentifiées à fort potentiel d'abus (bombardement d'e-mails,
// énumération de comptes, martelage du secret de bootstrap) — plafond
// nettement plus strict.
export const sensitiveActionRateLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
