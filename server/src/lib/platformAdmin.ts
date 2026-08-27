import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from './errors.js';

// "Admin LaafiPay" (équipe interne, distincte des admins d'entreprise) —
// liste d'e-mails autorisés à approuver/rejeter les demandes de création
// d'entreprise (voir routes/admin.routes.ts). Basé sur une variable d'env
// plutôt qu'un rôle en base : pas de notion de "staff plateforme"
// multi-tenant ailleurs dans l'app, et une poignée de personnes de
// confiance suffit pour ce premier lot.
export function isPlatformAdminEmail(email: string): boolean {
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !isPlatformAdminEmail(req.user.email)) {
    throw new ForbiddenError();
  }
  next();
}
