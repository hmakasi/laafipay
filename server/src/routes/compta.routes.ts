import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authorizeComptaApiKey } from '../middleware/comptaAuth.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const comptaRouter = Router();

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

    const existing = await prisma.comptaJournalEntry.findUnique({
      where: { sourceEventId: body.eventId },
      include: { lignes: true },
    });
    if (existing) {
      res.status(200).json({ status: 'deja_recu', journalEntryId: existing.id });
      return;
    }

    const [entryPayload] = body.journalEntries;
    const created = await prisma.comptaJournalEntry.create({
      data: {
        companyId: body.company.id,
        journal: entryPayload.journal,
        piece: entryPayload.piece,
        dateEcriture: new Date(entryPayload.dateEcriture),
        libelle: entryPayload.libelle,
        sourceSystem: body.source,
        sourceEventId: body.eventId,
        lignes: {
          create: entryPayload.lignes.map((l) => ({
            compte: l.compte,
            libelleCompte: l.libelleCompte,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      include: { lignes: true },
    });

    res.status(201).json({ status: 'enregistre', journalEntryId: created.id });
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
  authorize('payroll:read'),
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
// `payments:initiate` (RH/hr_manager) prépare, `payments:validate`
// (accountant/admin — voir lib/permissions.ts) autorise. On ne fait pas
// confiance à un `validatedBy` envoyé par le client : l'identité vient du
// JWT de la personne qui appelle, pas d'un champ de formulaire.
const paymentValidationSchema = z.object({ validated: z.boolean() });

comptaRouter.patch(
  '/journal-entries/:id/payment-validation',
  authenticate,
  authorize('payments:validate'),
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
