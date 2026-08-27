import { randomBytes } from 'crypto';

// Alphabet sans caractères ambigus (0/O, 1/l/I) — le mot de passe généré
// est lu/retapé par une personne à partir d'un e-mail, pas collé.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('');
}
