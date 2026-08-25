// app.js importe lib/loadEnv.js en tout premier — inutile de charger
// dotenv une deuxième fois ici (voir loadEnv.ts pour pourquoi le
// `import 'dotenv/config'` par défaut ne suffisait pas).
import app from './app.js';
import { retryPendingComptaEvents } from './lib/comptaBridge.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const COMPTA_RETRY_INTERVAL_MS = 5 * 60_000;

app.listen(PORT, () => {
  console.log(`LaafiPay API listening on http://localhost:${PORT}`);
});

// Filet de sécurité pour la passerelle Paie -> Compta : retente les
// événements restés "en_attente"/"echec" (LaafiCompta injoignable au
// moment de la validation du cycle) sans qu'aucune action manuelle ne
// soit nécessaire.
setInterval(() => {
  retryPendingComptaEvents().catch((err) => {
    console.error('[comptaBridge] échec du job de retry périodique', err);
  });
}, COMPTA_RETRY_INTERVAL_MS);
