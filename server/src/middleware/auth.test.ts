import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('JWT_SECRET startup guard', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it("refuse de démarrer si JWT_SECRET n'est pas défini", async () => {
    delete process.env.JWT_SECRET;
    await expect(import('./auth.js')).rejects.toThrow(/JWT_SECRET/);
  });

  it('démarre normalement si JWT_SECRET est défini', async () => {
    process.env.JWT_SECRET = 'un-secret-de-test-suffisamment-long';
    await expect(import('./auth.js')).resolves.toBeDefined();
  });
});
