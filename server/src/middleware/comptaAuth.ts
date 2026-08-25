import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

// Auth service-à-service pour la passerelle LaafiPay → LaafiCompta —
// distincte de `authenticate` (middleware/auth.ts) qui vérifie un JWT
// utilisateur. Ici l'appelant est LaafiPay lui-même, pas une personne
// connectée : une clé API partagée suffit pour ce premier lot (voir
// LAAFICOMPTA_API_KEY dans .env). À remplacer par un mécanisme plus
// robuste (JWT signé, mTLS...) si LaafiCompta expose un jour cette route
// au-delà de LaafiPay.
export function authorizeComptaApiKey(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.LAAFICOMPTA_API_KEY;
  const provided = req.headers['x-api-key'];

  if (!expected) {
    throw new UnauthorizedError('LAAFICOMPTA_API_KEY non configurée côté serveur');
  }
  if (provided !== expected) {
    throw new UnauthorizedError('Clé API invalide');
  }
  next();
}
