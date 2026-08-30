import bcrypt from 'bcryptjs';

export const PIN_MAX_ATTEMPTS = 3;
export const PIN_LOCKOUT_MINUTES = 15;

export type PinCheckResult =
  | { outcome: 'no_pin_set' }
  | { outcome: 'locked'; unlocksAt: Date }
  | { outcome: 'incorrect'; attemptsRemaining: number; update: { whatsappPinFailedAttempts: number; whatsappPinLockedUntil: Date | null } }
  | { outcome: 'correct'; update: { whatsappPinFailedAttempts: 0; whatsappPinLockedUntil: null } };

export interface EmployeePinState {
  whatsappPinHash: string | null;
  whatsappPinFailedAttempts: number;
  whatsappPinLockedUntil: Date | null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, employee: EmployeePinState, now: Date = new Date()): Promise<PinCheckResult> {
  if (!employee.whatsappPinHash) {
    return { outcome: 'no_pin_set' };
  }

  if (employee.whatsappPinLockedUntil && employee.whatsappPinLockedUntil > now) {
    return { outcome: 'locked', unlocksAt: employee.whatsappPinLockedUntil };
  }

  const valid = await bcrypt.compare(pin, employee.whatsappPinHash);
  if (valid) {
    return { outcome: 'correct', update: { whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null } };
  }

  // Le verrou a expiré depuis le dernier échec : on repart d'un compteur à zéro,
  // pas du compteur figé au moment du verrouillage.
  const previousAttempts = employee.whatsappPinLockedUntil && employee.whatsappPinLockedUntil <= now ? 0 : employee.whatsappPinFailedAttempts;
  const failedAttempts = previousAttempts + 1;
  const locked = failedAttempts >= PIN_MAX_ATTEMPTS;

  return {
    outcome: 'incorrect',
    attemptsRemaining: Math.max(0, PIN_MAX_ATTEMPTS - failedAttempts),
    update: {
      whatsappPinFailedAttempts: failedAttempts,
      whatsappPinLockedUntil: locked ? new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60_000) : null,
    },
  };
}
