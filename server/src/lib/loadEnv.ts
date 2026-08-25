import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Remplace `import 'dotenv/config'` (résolution par défaut relative à
// process.cwd()) par un chemin explicite relatif à ce fichier. Nécessaire
// car `npm run dev:all` (racine du repo, via concurrently + `npm --prefix
// server run dev`) ne change PAS process.cwd() vers server/ — dotenv
// chargeait donc silencieusement le .env de la racine (qui ne contient
// que VITE_API_URL) au lieu de server/.env. Ça passait inaperçu tant que
// chaque variable lue avait un fallback en dur (JWT_SECRET, CORS_ORIGIN,
// PORT) ou était chargée indépendamment par Prisma (DATABASE_URL) — mais
// LAAFICOMPTA_API_URL/KEY n'en ont pas.
// Doit rester le tout premier import de app.ts : les imports sont évalués
// dans l'ordre, et middleware/auth.ts lit process.env.JWT_SECRET dès son
// chargement (portée module, pas dans un handler).
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(serverRoot, '.env') });
