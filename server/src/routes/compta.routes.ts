import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authorizeComptaApiKey } from '../middleware/comptaAuth.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, UnauthorizedError } from '../lib/errors.js';
import { FISCAL_DEADLINE_RULES, nextOccurrence, severityForDueDate } from '../lib/fiscalCalendar.js';
import { receivePayrollComptaEvent } from '../lib/comptaReceiver.js';
import { retryPendingComptaEvents } from '../lib/comptaBridge.js';

export const comptaRouter = Router();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const journalLineSchema = z.object({
  compte: z.string(),
  libelleCompte: z.string(),
  debit: z.number(),
  credit: z.number(),
});

const journalEntrySchema = z.object({
  journal: z.enum(['OD', 'AC']),
  piece: z.string(),
  dateEcriture: z.string(),
  libelle: z.string(),
  lignes: z.array(journalLineSchema).min(1),
});

const payrollComptaEventSchema = z.object({
  eventId: z.string(),
  eventType: z.literal('payroll.cycle.valide'),
  emittedAt: z.string(),
  source: z.literal('LaafiPay'),
  company: z.object({
    id: z.string(),
    name: z.string(),
    countryCode: z.string(),
    currencyCode: z.string(),
  }),
  payrollCycle: z.object({
    id: z.string(),
    period: z.string(),
    employeeCount: z.number(),
    totalGrossSalary: z.number(),
    totalEmployerCost: z.number(),
    totalNet: z.number(),
    validatedAt: z.string(),
    validatedBy: z.string(),
  }),
  journalEntries: z.array(journalEntrySchema).min(1),
});

// Récepteur minimal LaafiCompta pour l'événement "cycle de paie validé"
// émis par LaafiPay (server/src/lib/comptaBridge.ts). Idempotent par
// `eventId` : un même événement rejoué par le job de retry de l'outbox
// ne crée jamais de doublon, il renvoie simplement l'écriture déjà
// enregistrée.
comptaRouter.post(
  '/payroll-events',
  authorizeComptaApiKey,
  asyncHandler(async (req, res) => {
    const body = payrollComptaEventSchema.parse(req.body);
    const result = await receivePayrollComptaEvent(body);
    res.status(result.status === 'deja_recu' ? 200 : 201).json(result);
  })
);

// ── Cron de retry (Vercel Cron) ─────────────────────────────────
// server/src/index.ts a bien un setInterval de retry, mais Vercel exécute
// l'app via api/index.ts (l'app Express seule) sans jamais lancer
// index.ts — sur ce déploiement, aucun setInterval ne tourne jamais. Cette
// route est donc le seul filet de sécurité en production pour les
// événements restés "en_attente"/"echec" ; déclenchée par vercel.json
// (crons), authentifiée par le header que Vercel envoie automatiquement
// quand CRON_SECRET est configuré.
comptaRouter.get(
  '/retry-bridge',
  asyncHandler(async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Secret de cron invalide ou non configuré');
    }
    await retryPendingComptaEvents();
    res.status(200).json({ status: 'ok' });
  })
);

// ── Lecture pour l'onglet "Passerelle Paie" (LaafiCompta) ──────
// Auth JWT utilisateur normale (pas la clé API service-à-service ci-dessus)
// : c'est un humain connecté à LaafiCompta qui consulte, pas LaafiPay qui
// pousse un événement. Combine les deux faces de la passerelle par
// événement : l'outbox (côté émetteur, LaafiPay) et l'écriture reçue
// (côté récepteur, LaafiCompta), reliées par eventId === sourceEventId —
// possible ici car les deux tables vivent dans la même base tant que
// LaafiCompta n'a pas son propre service (voir schema.prisma).
comptaRouter.get(
  '/bridge-events',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    const outboxEvents = await prisma.comptaOutboxEvent.findMany({
      where: { companyId },
      include: { cycle: { select: { period: true } }, company: { select: { currencyCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const journalEntries = await prisma.comptaJournalEntry.findMany({
      where: { sourceEventId: { in: outboxEvents.map((e) => e.id) } },
      include: { lignes: true },
    });
    const journalByEventId = new Map(journalEntries.map((j) => [j.sourceEventId, j]));

    res.json(
      outboxEvents.map((event) => {
        const journal = journalByEventId.get(event.id);
        return {
          id: event.id,
          cycleId: event.cycleId,
          period: event.cycle.period,
          currencyCode: event.company.currencyCode,
          status: event.status,
          attempts: event.attempts,
          lastError: event.lastError,
          createdAt: event.createdAt.toISOString(),
          sentAt: event.sentAt?.toISOString() ?? null,
          journalEntry: journal
            ? {
                id: journal.id,
                journal: journal.journal,
                piece: journal.piece,
                dateEcriture: journal.dateEcriture.toISOString().slice(0, 10),
                libelle: journal.libelle,
                receivedAt: journal.receivedAt.toISOString(),
                lignes: journal.lignes.map((l) => ({
                  compte: l.compte,
                  libelleCompte: l.libelleCompte,
                  debit: l.debit,
                  credit: l.credit,
                })),
                paymentValidated: journal.paymentValidated,
                paymentValidatedAt: journal.paymentValidatedAt?.toISOString() ?? null,
                paymentValidatedBy: journal.paymentValidatedBy,
              }
            : null,
        };
      })
    );
  })
);

// ── Validation du paiement par la comptabilité ──────────────────
// Contrôle interne distinct de la clôture du cycle côté LaafiPay :
// `payments:initiate` (RH/hr_manager) prépare côté LaafiPay, la validation
// comptable ici est réservée à `compta:access` (accountant/admin — voir
// lib/permissions.ts). On ne fait pas confiance à un `validatedBy` envoyé
// par le client : l'identité vient du JWT de la personne qui appelle, pas
// d'un champ de formulaire.
const paymentValidationSchema = z.object({ validated: z.boolean() });

comptaRouter.patch(
  '/journal-entries/:id/payment-validation',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const { validated } = paymentValidationSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const entry = await prisma.comptaJournalEntry.findFirst({ where: { id: req.params.id, companyId } });
    if (!entry) throw new NotFoundError(`Écriture ${req.params.id} introuvable`);

    const updated = await prisma.comptaJournalEntry.update({
      where: { id: entry.id },
      data: validated
        ? { paymentValidated: true, paymentValidatedAt: new Date(), paymentValidatedBy: req.user!.email }
        : { paymentValidated: false, paymentValidatedAt: null, paymentValidatedBy: null },
      include: { lignes: true },
    });

    res.json({
      id: updated.id,
      paymentValidated: updated.paymentValidated,
      paymentValidatedAt: updated.paymentValidatedAt?.toISOString() ?? null,
      paymentValidatedBy: updated.paymentValidatedBy,
    });
  })
);

// ── Copilote Fiscal — échéances réelles ─────────────────────────
// Calendrier fixe par pays (voir lib/fiscalCalendar.ts) ; les montants
// estimés des échéances liées à la paie (IUTS/IPTS/IPR, CNSS) sont
// calculés depuis le dernier cycle de paie réellement validé de
// l'entreprise, pas inventés. Une échéance dont l'entreprise n'a pas
// encore de cycle validé (ou dont le pays n'a pas de source de montant,
// ex. TVA) n'affiche pas de montant plutôt qu'un chiffre fictif.
comptaRouter.get(
  '/fiscal-deadlines',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { countryCode: true } });
    if (!company) throw new NotFoundError(`Entreprise ${companyId} introuvable`);

    const rules = FISCAL_DEADLINE_RULES.filter((r) => r.countryCode === company.countryCode);

    const latestCycle = await prisma.payrollCycle.findFirst({
      where: { companyId, status: { in: ['valide', 'paye'] } },
      orderBy: { period: 'desc' },
      include: { entries: { select: { iuts: true, cnssEmployee: true, cnssEmployer: true } } },
    });

    const amountBySource = latestCycle
      ? {
          iuts: latestCycle.entries.reduce((sum, e) => sum + e.iuts, 0),
          cnss: latestCycle.entries.reduce((sum, e) => sum + e.cnssEmployee + e.cnssEmployer, 0),
        }
      : null;

    const today = new Date();
    const deadlines = rules
      .map((rule) => {
        const dueDate = nextOccurrence(rule.dayOfMonth, today);
        return {
          id: rule.id,
          countryCode: rule.countryCode,
          label: rule.label,
          organisme: rule.organisme,
          dueDate: dueDate.toISOString().slice(0, 10),
          severity: severityForDueDate(dueDate, today),
          montantEstime: rule.amountSource && amountBySource ? amountBySource[rule.amountSource] : undefined,
          basePeriod: rule.amountSource && amountBySource ? latestCycle!.period : undefined,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    res.json(deadlines);
  })
);

// ── Journal & Écritures ──────────────────────────────────────────
// Liste toutes les écritures réellement enregistrées (aujourd'hui,
// uniquement celles reçues via la passerelle paie — le hub WhatsApp
// Accounting reste mocké et n'écrit pas encore ici). Pas de pagination :
// volume attendu faible tant qu'un seul journal (OD) alimente la table.
comptaRouter.get(
  '/journal-entries',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const journal = typeof req.query.journal === 'string' ? req.query.journal : undefined;

    const entries = await prisma.comptaJournalEntry.findMany({
      where: { companyId, ...(journal ? { journal: journal as 'OD' | 'AC' } : {}) },
      include: { lignes: true },
      orderBy: { dateEcriture: 'desc' },
    });

    res.json(
      entries.map((e) => ({
        id: e.id,
        journal: e.journal,
        piece: e.piece,
        dateEcriture: e.dateEcriture.toISOString().slice(0, 10),
        libelle: e.libelle,
        sourceSystem: e.sourceSystem,
        receivedAt: e.receivedAt.toISOString(),
        lignes: e.lignes.map((l) => ({ compte: l.compte, libelleCompte: l.libelleCompte, debit: l.debit, credit: l.credit })),
      }))
    );
  })
);

// ── États financiers — Balance générale ──────────────────────────
// Agrégation réelle débit/crédit par compte à partir des écritures
// existantes. Bilan / Compte de résultat / TAFIRE nécessiteraient de
// classer chaque compte par nature (actif/passif/charge/produit) et un
// grand livre complet (achats/ventes, pas seulement la paie) — non
// construits ici, volontairement absents plutôt qu'approximés.
comptaRouter.get(
  '/trial-balance',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    const lignes = await prisma.comptaJournalLine.findMany({
      where: { entry: { companyId } },
      select: { compte: true, libelleCompte: true, debit: true, credit: true },
    });

    const byAccount = new Map<string, { compte: string; libelleCompte: string; debit: number; credit: number }>();
    for (const l of lignes) {
      const existing = byAccount.get(l.compte);
      if (existing) {
        existing.debit += l.debit;
        existing.credit += l.credit;
      } else {
        byAccount.set(l.compte, { compte: l.compte, libelleCompte: l.libelleCompte, debit: l.debit, credit: l.credit });
      }
    }

    const rows = [...byAccount.values()]
      .map((r) => ({ ...r, solde: round2(r.debit - r.credit) }))
      .sort((a, b) => a.compte.localeCompare(b.compte));

    res.json({
      rows,
      totals: {
        debit: round2(rows.reduce((sum, r) => sum + r.debit, 0)),
        credit: round2(rows.reduce((sum, r) => sum + r.credit, 0)),
      },
    });
  })
);

// ── Paramètres — Plan comptable utilisé ──────────────────────────
// Comptes réellement mouvementés (dérivés des écritures existantes),
// pas un plan comptable SYSCOHADA générique complet qu'on n'utilise pas.
comptaRouter.get(
  '/chart-of-accounts',
  authenticate,
  authorize('compta:access'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;

    const lignes = await prisma.comptaJournalLine.findMany({
      where: { entry: { companyId } },
      select: { compte: true, libelleCompte: true },
      distinct: ['compte'],
      orderBy: { compte: 'asc' },
    });

    res.json(lignes.map((l) => ({ compte: l.compte, libelle: l.libelleCompte })));
  })
);
