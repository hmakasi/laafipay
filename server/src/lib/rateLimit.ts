import rateLimit from 'express-rate-limit';

// Testé en isolation (rateLimit.test.ts) via ce factory plutôt qu'à travers
// l'app complète : les instances exportées plus bas sont désactivées sous
// NODE_ENV=test (mis par Vitest par défaut) pour ne pas gêner les suites
// d'intégration existantes, qui appellent des routes comme /forgot-password
// bien plus souvent qu'un client légitime ne le ferait en production — voir
// audit sécurité, M1.
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
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
