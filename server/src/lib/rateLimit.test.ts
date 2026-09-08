import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from './rateLimit.js';

describe('createRateLimiter', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Le skip sous NODE_ENV=test (pour ne pas gêner les suites d'intégration
    // qui appellent les routes sensibles bien plus souvent qu'un client
    // légitime) doit lui-même être désactivé le temps de tester le limiteur.
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
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
});
