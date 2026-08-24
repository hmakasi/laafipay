import app from '../server/src/app.js';

// Vercel : une app Express est directement une fonction (req, res) => void,
// donc exportable telle quelle comme handler serverless — pas besoin de serverless-http.
// Fonction unique et sans ambiguïté (api/index.ts), routée explicitement par la règle
// "/api/:path* -> /api" dans vercel.json plutôt que de compter sur la convention de
// nommage catch-all "[...all].ts" : cette dernière ne matchait fiablement que
// /api/<un-segment> en production — tout ce qui avait un second segment de chemin
// (ex. /api/auth/login) tombait sur le 404 générique de Vercel avant même d'atteindre
// la fonction. C'est Express (via son propre routeur monté sur /api/...) qui se charge
// ensuite du sous-routing.
export default app;
