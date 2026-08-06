import app from '../server/src/app.js';

// Vercel : une app Express est directement une fonction (req, res) => void,
// donc exportable telle quelle comme handler serverless — pas besoin de serverless-http.
// Le nom de fichier "[...all]" est la convention "catch-all" de Vercel : toutes les requêtes
// sous /api/* arrivent ici, et c'est Express (via son propre routeur monté sur /api/...) qui
// se charge du sous-routing — pas besoin de règle de rewrite supplémentaire pour l'API.
export default app;
