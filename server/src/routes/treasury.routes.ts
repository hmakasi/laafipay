import { Router } from 'express';
import { z } from 'zod';
import { TreasuryAccount, TreasuryTransaction } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';
import { attemptAutoMatch } from '../lib/treasuryMatching.js';

export const treasuryRouter = Router();
treasuryRouter.use(authenticate);

// ── DTO mapping ──────────────────────────────────────────────

function toAccountDTO(a: TreasuryAccount & { transactions: { montant: number; sens: string }[] }) {
  const net = a.transactions.reduce((sum, t) => sum + (t.sens === 'encaissement' ? t.montant : -t.montant), 0);
  return {
    id: a.id,
    label: a.label,
    kind: a.kind,
    provider: a.provider ?? undefined,
    countryCode: a.countryCode,
    currencyCode: a.currencyCode,
    openingBalance: a.openingBalance,
    solde: a.openingBalance + net,
    createdAt: a.createdAt.toISOString(),
  };
}

function toTransactionDTO(t: TreasuryTransaction & { account: TreasuryAccount }) {
  return {
    id: t.id,
    accountId: t.accountId,
    accountLabel: t.account.label,
    kind: t.account.kind,
    provider: t.account.provider ?? undefined,
    date: t.date.toISOString().slice(0, 10),
    libelle: t.libelle,
    montant: t.montant,
    sens: t.sens,
    statut: t.statut,
    compteApparie:
      t.compteApparie && t.libelleCompteApparie ? { compte: t.compteApparie, libelle: t.libelleCompteApparie } : null,
    matchedPaymentTransactionId: t.matchedPaymentTransactionId ?? undefined,
    createdAt: t.createdAt.toISOString(),
  };
}

// ── Comptes de trésorerie ────────────────────────────────────

treasuryRouter.get(
  '/accounts',
  authorize('reports:read'),
  asyncHandler(async (req, res) => {
    const accounts = await prisma.treasuryAccount.findMany({
      where: { companyId: req.user!.companyId },
      include: { transactions: { select: { montant: true, sens: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(accounts.map(toAccountDTO));
  })
);

const createAccountSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(['banque', 'mobile_money']),
  provider: z.enum(['orange_money', 'wave', 'moov_money', 'mtn_money', 'm_pesa']).optional(),
  countryCode: z.enum(['BF', 'BJ', 'CD']),
  currencyCode: z.enum(['XOF', 'CDF', 'USD']),
  openingBalance: z.number().default(0),
});

treasuryRouter.post(
  '/accounts',
  authorize('payments:validate'),
  asyncHandler(async (req, res) => {
    const body = createAccountSchema.parse(req.body);
    if (body.kind === 'mobile_money' && !body.provider) {
      throw new HttpError(400, 'Un opérateur Mobile Money est requis pour ce type de compte');
    }
    const created = await prisma.treasuryAccount.create({
      data: { ...body, companyId: req.user!.companyId },
      include: { transactions: { select: { montant: true, sens: true } } },
    });
    res.status(201).json(toAccountDTO(created));
  })
);

// ── Transactions & flux de rapprochement ─────────────────────

treasuryRouter.get(
  '/transactions',
  authorize('reports:read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined;
    const transactions = await prisma.treasuryTransaction.findMany({
      where: { companyId, ...(accountId ? { accountId } : {}) },
      include: { account: true },
      orderBy: { date: 'desc' },
      take: 200,
    });
    res.json(transactions.map(toTransactionDTO));
  })
);

const importRowSchema = z.object({
  date: z.string(),
  libelle: z.string().min(1),
  montant: z.number(),
});

const importSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
});

// Import manuel d'un relevé (CSV parsé côté client — voir
// src/services/api/treasury.ts) : pas d'API bancaire/Mobile Money réelle
// disponible. Le signe de `montant` détermine le sens (positif =
// encaissement, négatif = décaissement), convention courante de relevé.
// Chaque ligne passe ensuite par le rapprochement automatique (voir
// lib/treasuryMatching.ts) — seuls les décaissements correspondant à un
// versement de salaire connu sont rapprochés automatiquement.
treasuryRouter.post(
  '/accounts/:id/import',
  authorize('payments:validate'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const account = await prisma.treasuryAccount.findFirst({ where: { id: req.params.id, companyId } });
    if (!account) throw new NotFoundError(`Compte de trésorerie ${req.params.id} introuvable`);

    const { rows } = importSchema.parse(req.body);
    const importBatch = `import-${Date.now()}`;
    const created: TreasuryTransaction[] = [];

    for (const row of rows) {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) continue;
      const sens = row.montant < 0 ? 'decaissement' : 'encaissement';
      const montant = Math.abs(row.montant);

      const match = sens === 'decaissement' ? await attemptAutoMatch(companyId, date, montant) : { matched: false as const };

      const tx = await prisma.treasuryTransaction.create({
        data: {
          accountId: account.id,
          companyId,
          date,
          libelle: row.libelle,
          montant,
          sens,
          statut: match.matched ? 'rapproche' : 'en_attente',
          compteApparie: match.matched ? match.compte : undefined,
          libelleCompteApparie: match.matched ? match.libelleCompte : undefined,
          matchedPaymentTransactionId: match.matched ? match.paymentTransactionId : undefined,
          importBatch,
        },
      });
      created.push(tx);
    }

    const withAccount = await prisma.treasuryTransaction.findMany({
      where: { id: { in: created.map((t) => t.id) } },
      include: { account: true },
      orderBy: { date: 'desc' },
    });

    res.status(201).json({
      imported: created.length,
      autoMatched: withAccount.filter((t) => t.statut === 'rapproche').length,
      transactions: withAccount.map(toTransactionDTO),
    });
  })
);

const reconcileSchema = z.discriminatedUnion('statut', [
  z.object({ statut: z.literal('rapproche'), compte: z.string().min(1), libelleCompte: z.string().min(1) }),
  z.object({ statut: z.literal('anomalie') }),
  z.object({ statut: z.literal('en_attente') }),
]);

treasuryRouter.patch(
  '/transactions/:id',
  authorize('payments:validate'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const tx = await prisma.treasuryTransaction.findFirst({ where: { id: req.params.id, companyId } });
    if (!tx) throw new NotFoundError(`Transaction ${req.params.id} introuvable`);

    const body = reconcileSchema.parse(req.body);
    const updated = await prisma.treasuryTransaction.update({
      where: { id: tx.id },
      data:
        body.statut === 'rapproche'
          ? { statut: 'rapproche', compteApparie: body.compte, libelleCompteApparie: body.libelleCompte }
          : body.statut === 'anomalie'
            ? { statut: 'anomalie', compteApparie: null, libelleCompteApparie: null, matchedPaymentTransactionId: null }
            : { statut: 'en_attente', compteApparie: null, libelleCompteApparie: null, matchedPaymentTransactionId: null },
      include: { account: true },
    });

    res.json(toTransactionDTO(updated));
  })
);
