import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, PIN_MAX_ATTEMPTS } from './whatsappPin.js';

describe('hashPin/verifyPin', () => {
  it('reports no_pin_set when the employee has never configured a PIN', async () => {
    const result = await verifyPin('4821', { whatsappPinHash: null, whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('no_pin_set');
  });

  it('reports correct and resets the attempt counter on a matching PIN', async () => {
    const hash = await hashPin('4821');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: 2, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('correct');
    if (result.outcome === 'correct') {
      expect(result.update).toEqual({ whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    }
  });

  it('reports incorrect with the remaining attempt count on a wrong PIN', async () => {
    const hash = await hashPin('4821');
    const result = await verifyPin('0000', { whatsappPinHash: hash, whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('incorrect');
    if (result.outcome === 'incorrect') {
      expect(result.attemptsRemaining).toBe(PIN_MAX_ATTEMPTS - 1);
      expect(result.update.whatsappPinFailedAttempts).toBe(1);
      expect(result.update.whatsappPinLockedUntil).toBeNull();
    }
  });

  it('locks the account on the 3rd consecutive wrong attempt', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:00:00Z');
    const result = await verifyPin('0000', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS - 1, whatsappPinLockedUntil: null }, now);
    expect(result.outcome).toBe('incorrect');
    if (result.outcome === 'incorrect') {
      expect(result.attemptsRemaining).toBe(0);
      expect(result.update.whatsappPinLockedUntil).toEqual(new Date('2026-08-30T10:15:00Z'));
    }
  });

  it('reports locked with the unlock time when still within the lockout window', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:05:00Z');
    const lockedUntil = new Date('2026-08-30T10:15:00Z');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS, whatsappPinLockedUntil: lockedUntil }, now);
    expect(result.outcome).toBe('locked');
    if (result.outcome === 'locked') {
      expect(result.unlocksAt).toEqual(lockedUntil);
    }
  });

  it('allows a fresh attempt once the lockout window has passed', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:16:00Z');
    const lockedUntil = new Date('2026-08-30T10:15:00Z');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS, whatsappPinLockedUntil: lockedUntil }, now);
    expect(result.outcome).toBe('correct');
  });
});
