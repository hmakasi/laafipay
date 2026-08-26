import { randomUUID } from 'node:crypto';
import { Company, PayrollCycle, PayrollEntry, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { receivePayrollComptaEvent } from './comptaReceiver.js';
import type { ComptaJournalLinePayload, PayrollComptaEventPayload } from '../types/compta.js';

const MAX_DELIVERY_ATTEMPTS = 8;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Construit l'OD de paie à partir des lignes réellement calculées par le
// moteur de paie (server/src/lib/payrollEngine.ts), pas de données
// simulées. Le crédit "421 Personnel" est calculé comme solde d'équilibre
// (coût employeur total moins CNSS et IUTS) plutôt que recopié depuis
// salaireNet : ça garantit que l'écriture reste toujours équilibrée même
// quand des avances/retenues existent, faute d'un compte SYSCOHADA dédié
// pour chacune d'elles dans ce MVP (pas de mapping rubrique → compte).
function buildJournalLines(entries: PayrollEntry[]): ComptaJournalLinePayload[] {
  const totals = entries.reduce(
    (acc, e) => {
      acc.brut += e.salaireBrut;
      acc.employerCost += e.coutEmployeur;
      acc.cnss += e.cnssEmployee + e.cnssEmployer;
      acc.iuts += e.iuts;
      return acc;
    },
    { brut: 0, employerCost: 0, cnss: 0, iuts: 0 }
  );

  const debit661 = round2(totals.brut);
  const debit664 = round2(totals.employerCost - totals.brut);
  const credit431 = round2(totals.cnss);
  const credit447 = round2(totals.iuts);
  const credit421 = round2(totals.employerCost - totals.cnss - totals.iuts);

  return [
    { compte: '661', libelleCompte: 'Rémunérations directes versées au personnel national', debit: debit661, credit: 0 },
    { compte: '664', libelleCompte: 'Charges sociales (part patronale)', debit: debit664, credit: 0 },
    { compte: '421', libelleCompte: 'Personnel — rémunérations dues', debit: 0, credit: credit421 },
    { compte: '431', libelleCompte: 'CNSS — cotisations sociales', debit: 0, credit: credit431 },
    { compte: '447', libelleCompte: 'État — impôts sur salaires (IUTS)', debit: 0, credit: credit447 },
  ];
}

function buildPayload(
  outboxEventId: string,
  cycle: PayrollCycle & { entries: PayrollEntry[] },
  company: Company
): PayrollComptaEventPayload {
  const lignes = buildJournalLines(cycle.entries);
  const totalGrossSalary = round2(cycle.entries.reduce((sum, e) => sum + e.salaireBrut, 0));
  const totalEmployerCost = round2(cycle.entries.reduce((sum, e) => sum + e.coutEmployeur, 0));
  const totalNet = round2(cycle.entries.reduce((sum, e) => sum + e.salaireNet, 0));

  return {
    eventId: outboxEventId,
    eventType: 'payroll.cycle.valide',
    emittedAt: new Date().toISOString(),
    source: 'LaafiPay',
    company: {
      id: company.id,
      name: company.name,
      countryCode: company.countryCode,
      currencyCode: company.currencyCode,
    },
    payrollCycle: {
      id: cycle.id,
      period: cycle.period,
      employeeCount: cycle.entries.length,
      totalGrossSalary,
      totalEmployerCost,
      totalNet,
      validatedAt: (cycle.validatedAt ?? new Date()).toISOString(),
      validatedBy: cycle.validatedBy ?? '',
    },
    journalEntries: [
      {
        journal: 'OD',
        piece: `OD-${cycle.period}-PAIE`,
        dateEcriture: (cycle.validatedAt ?? new Date()).toISOString().slice(0, 10),
        libelle: `OD de paie — ${cycle.period}`,
        lignes,
      },
    ],
  };
}

// Tente une livraison pour un événement de l'outbox déjà persisté. Ne
// lève jamais — l'échec est enregistré sur la ligne elle-même
// (status/attempts/lastError), à charge du job de retry (voir
// retryPendingComptaEvents ci-dessous) de reprendre.
//
// Appelle receivePayrollComptaEvent(...) directement en process plutôt que
// par un appel HTTP LaafiPay -> lui-même : les deux vivent dans le même
// repo/process tant que LaafiCompta n'a pas son propre service (voir
// comptaReceiver.ts), et un appel HTTP "fire and forget" après la réponse
// au client n'est pas fiable sur Vercel serverless (l'exécution peut être
// coupée dès que la réponse est envoyée, sans `waitUntil`). Un appel de
// fonction directe, lui, peut simplement être attendu normalement.
async function attemptDelivery(outboxEventId: string): Promise<void> {
  const event = await prisma.comptaOutboxEvent.findUnique({ where: { id: outboxEventId } });
  if (!event || event.status === 'envoye') return;

  try {
    const payload = event.payload as unknown as PayrollComptaEventPayload;
    await receivePayrollComptaEvent(payload);
    await prisma.comptaOutboxEvent.update({
      where: { id: event.id },
      data: { status: 'envoye', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
  } catch (err) {
    await prisma.comptaOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'echec',
        attempts: { increment: 1 },
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// Point d'entrée appelé depuis POST /payroll/cycles/:id/validate. La
// tentative de livraison est maintenant attendue (pas fire-and-forget) :
// depuis que c'est un appel en process plutôt qu'un aller-retour HTTP,
// c'est rapide (quelques requêtes DB) et n'a plus besoin d'être détachée
// de la réponse au client — attemptDelivery() ne lève de toute façon
// jamais, donc ça ne peut pas faire échouer la validation du cycle.
export async function dispatchComptaEvent(cycleId: string, companyId: string): Promise<void> {
  const [cycle, company] = await Promise.all([
    prisma.payrollCycle.findFirstOrThrow({ where: { id: cycleId, companyId }, include: { entries: true } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  // Idempotent par cycle ET par eventId : si "Valider le cycle" est
  // rappelé sur un cycle déjà validé (défensif — le bouton disparaît
  // normalement côté UI), on régénère le payload sur la MÊME ligne
  // d'outbox, avec le MÊME eventId — sinon une revalidation ferait
  // renvoyer un eventId différent pour un événement déjà livré, et
  // LaafiCompta ne pourrait plus le dédupliquer côté réception.
  const existing = await prisma.comptaOutboxEvent.findUnique({ where: { cycleId } });
  const eventId = existing?.id ?? randomUUID();
  const payload = buildPayload(eventId, cycle, company);

  const outboxEvent = existing
    ? await prisma.comptaOutboxEvent.update({
        where: { id: existing.id },
        data: { payload: payload as unknown as Prisma.InputJsonValue, status: 'en_attente', attempts: 0, lastError: null },
      })
    : await prisma.comptaOutboxEvent.create({
        data: { id: eventId, companyId, cycleId, payload: payload as unknown as Prisma.InputJsonValue, status: 'en_attente' },
      });

  await attemptDelivery(outboxEvent.id);
}

// Appelé par le cron Vercel (GET /compta/retry-bridge, voir vercel.json)
// en production, et par server/src/index.ts en local — filet de sécurité
// pour retenter les événements restés en_attente/échec (ex. la
// comptabilisation a échoué au moment de la validation du cycle).
export async function retryPendingComptaEvents(): Promise<void> {
  const pending = await prisma.comptaOutboxEvent.findMany({
    where: { status: { in: ['en_attente', 'echec'] }, attempts: { lt: MAX_DELIVERY_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  for (const event of pending) {
    await attemptDelivery(event.id);
  }
}

// Verrou utilisé par routes/payments.routes.ts avant de créer un ordre de
// paiement : la comptabilité doit avoir reçu l'OD ET explicitement
// autorisé le paiement (ComptaJournalEntry.paymentValidated) avant que la
// RH puisse déclencher un virement de masse pour ce cycle. Les deux tables
// vivent dans la même base (voir schema.prisma), d'où la jointure directe
// plutôt qu'un appel HTTP.
export async function getPaymentValidationForCycle(
  companyId: string,
  cycleId: string
): Promise<{ validated: boolean; reason: string | null }> {
  const outboxEvent = await prisma.comptaOutboxEvent.findFirst({ where: { cycleId, companyId } });
  if (!outboxEvent) {
    return { validated: false, reason: "Ce cycle n'a pas encore été transmis à LaafiCompta." };
  }

  const journalEntry = await prisma.comptaJournalEntry.findUnique({ where: { sourceEventId: outboxEvent.id } });
  if (!journalEntry) {
    return {
      validated: false,
      reason:
        outboxEvent.status === 'echec'
          ? "L'OD n'a pas encore pu être livrée à LaafiCompta (échec de synchronisation, nouvelle tentative automatique en cours)."
          : "L'OD est en cours de livraison à LaafiCompta.",
    };
  }

  if (!journalEntry.paymentValidated) {
    return { validated: false, reason: "La comptabilité n'a pas encore validé le paiement de ce cycle dans LaafiCompta." };
  }

  return { validated: true, reason: null };
}
