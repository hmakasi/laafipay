import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { hasPermission, Permission, UserRole } from '../lib/permissions.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string;
  employeeId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Pas de repli codé en dur : contrairement à CRON_SECRET/BOOTSTRAP_SECRET/
// LAAFICOMPTA_API_KEY (qui échouent chacun proprement par requête si non
// configurés), un JWT_SECRET manquant ou laissé à une valeur d'exemple
// permettrait de forger un token pour n'importe quel rôle/entreprise —
// on préfère un crash net au démarrage à un contournement d'authentification
// silencieux en production.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET doit être défini (voir server/.env.example)');
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    next();
  } catch {
    throw new UnauthorizedError('Session invalide ou expirée');
  }
}

export function authorize(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !hasPermission(req.user.role, permission)) {
      throw new ForbiddenError();
    }
    next();
  };
}
