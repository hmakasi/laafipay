import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from './rateLimit.js';

describe('createRateLimiter', () => {
  const originalVitestFlag = process.env.VITEST;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Le skip sous Vitest (pour ne pas gêner les suites d'intégration qui
    // appellent les routes sensibles bien plus souvent qu'un client
    // légitime) doit lui-même être désactivé le temps de tester le limiteur.
    delete process.env.VITEST;
  });

  afterAll(() => {
    process.env.VITEST = originalVitestFlag;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('laisse passer les requêtes sous le plafond', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 3 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }
  });

  it('bloque avec 429 au-delà du plafond dans la même fenêtre', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 3 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      await request(app).get('/test');
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
  });

  // Un déploiement preview/staging mal configuré peut définir NODE_ENV=test
  // (variable réutilisée depuis la CI, ou réglée à la main) — le skip ne
  // doit PAS s'appuyer sur NODE_ENV pour cette raison, seulement sur le
  // marqueur propre à Vitest (voir revue de code de l'audit sécurité,
  // "Important #3").
  it("NODE_ENV=test seul ne désactive plus le limiteur (seul VITEST le fait)", async () => {
    process.env.NODE_ENV = 'test';

    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 1 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    await request(app).get('/test');
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
  });
});
