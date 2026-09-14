import { describe, it, expect } from 'vitest';
import { CountryCode as PrismaCountryCode } from '@prisma/client';

// Régression : `Company.countryCode`/`TreasuryAccount.countryCode` sont un
// enum Postgres natif (server/prisma/schema.prisma), distinct des unions
// TypeScript/zod `['BF','BJ','CD',...]` répétées dans les routes. Ajouter un
// pays côté zod sans l'ajouter (+ migration) côté schema.prisma fait planter
// `prisma.company.create()` avec une PrismaClientValidationError — 500 à
// l'approbation d'une demande d'inscription (voir 2026-09-14).
describe('Prisma CountryCode enum — pays supportés', () => {
  it('inclut BF, BJ, CD et SN', () => {
    expect(Object.keys(PrismaCountryCode).sort()).toEqual(['BF', 'BJ', 'CD', 'SN']);
  });
});
