import { Router } from 'express';
import { z } from 'zod';
import { PaymentOrder, PaymentOrderType, PaymentTransaction } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError, NotFoundError } from '../lib/errors.js';
import { getPaymentValidationForCycle } from '../lib/comptaBridge.js';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

const SETTLEMENT_DELAY_MS = 3_000;
const SUCCESS_RATE = 0.9;

// ── DTO mapping ──────────────────────────────────────────────

function toTransactionDTO(t: PaymentTransaction) {
  return {
    id: t.id,
    orderId: t.orderId,
    employeeId: t.employeeId,
    amount: t.amount,
    status: t.status,
    type: t.type,
    operator: t.operator ?? undefined,
    phoneNumber: t.phoneNumber ?? undefined,
    reference: t.reference ?? undefined,
    processedAt: t.processedAt?.toISOString(),
    errorMessage: t.errorMessage ?? undefined,
    retryCount: t.retryCount,
  };
}

function toOrderDTO(o: PaymentOrder & { transactions: PaymentTransaction[] }) {
  return {
    id: o.id,
    cycleId: o.cycleId,
    createdAt: o.createdAt.toISOString(),
    createdBy: o.createdBy,
    validatedAt: o.validatedAt?.toISOString(),
    validatedBy: o.validatedBy ?? undefined,
    status: o.status,
    type: o.type,
    totalAmount: o.totalAmount,
    transactions: o.transactions.map(toTransactionDTO),
  };
}

function generateRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000).toString().padStart(4, '0')}`;
}

// ── Règlement simulé ─────────────────────────────────────────
// Pas d'intégration réelle avec un opérateur Mobile Money ou une banque
// (hors périmètre — nécessiterait un vrai contrat prestataire). On
// reproduit ici, côté serveur et avec une vraie persistance, exactement
// la simulation qui vivait auparavant dans le mock frontend (délai de
// règlement + 90% de succès) pour que le front (qui poll déjà le statut
// de l'ordre) continue de fonctionner sans changement.
function settleOrderAsync(orderId: string) {
  setTimeout(() => {
    void (async () => {
      const order = await prisma.paymentOrder.findUnique({ where: { id: orderId }, include: { transactions: true } });
      if (!order) return;

      for (const t of order.transactions) {
        const success = Math.random() < SUCCESS_RATE;
        await prisma.paymentTransaction.update({
          where: { id: t.id },
          data: success
            ? { status: 'reussi', reference: generateRef(order.type === 'mobile_money' ? 'OM' : 'VIR'), processedAt: new Date() }
            : {
                status: 'echoue',
                processedAt: new Date(),
                errorMessage: order.type === 'mobile_money' ? 'Solde insuffisant' : 'Compte introuvable',
              },
        });
      }

      const settled = await prisma.paymentTransaction.findMany({ where: { orderId } });
      const failedCount = settled.filter((t) => t.status === 'echoue').length;
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: failedCount === settled.length ? 'echoue' : 'reussi' },
      });
    })().catch((err) => console.error(`[payments] échec du règlement simulé de l'ordre ${orderId}`, err));
  }, SETTLEMENT_DELAY_MS);
}

// ── Lecture ──────────────────────────────────────────────────

paymentsRouter.get(
  '/orders',
  authorize('payments:read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const cycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId : undefined;
    const orders = await prisma.paymentOrder.findMany({
      where: { companyId, ...(cycleId ? { cycleId } : {}) },
      include: { transactions: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(toOrderDTO));
  })
);

paymentsRouter.get(
  '/orders/:id',
  authorize('payments:read'),
  asyncHandler(async (req, res) => {
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: { transactions: true },
    });
    if (!order) throw new NotFoundError(`Ordre de paiement ${req.params.id} introuvable`);
    res.json(toOrderDTO(order));
  })
);

// ── Création (RH — payments:initiate) ───────────────────────────

const createOrderSchema = z.object({
  cycleId: z.string(),
  items: z.array(z.object({ employeeId: z.string(), amount: z.number().positive() })).min(1),
});

async function createOrder(companyId: string, createdBy: string, type: PaymentOrderType, body: z.infer<typeof createOrderSchema>) {
  const { validated, reason } = await getPaymentValidationForCycle(companyId, body.cycleId);
  if (!validated) {
    throw new HttpError(409, reason ?? "Le paiement de ce cycle n'est pas encore autorisé par la comptabilité.");
  }

  const employees = await prisma.employee.findMany({
    where: { companyId, id: { in: body.items.map((i) => i.employeeId) } },
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const totalAmount = body.items.reduce((sum, i) => sum + i.amount, 0);

  const order = await prisma.paymentOrder.create({
    data: {
      companyId,
      cycleId: body.cycleId,
      type,
      status: 'en_attente',
      totalAmount,
      createdBy,
      transactions: {
        create: body.items.map((item) => {
          const emp = employeeById.get(item.employeeId);
          return {
            employeeId: item.employeeId,
            amount: item.amount,
            status: 'en_attente',
            type,
            operator: type === 'mobile_money' ? emp?.mobileMoneyOperator ?? undefined : undefined,
            phoneNumber: type === 'mobile_money' ? emp?.mobileMoneyNumber ?? undefined : undefined,
          };
        }),
      },
    },
    include: { transactions: true },
  });

  return order;
}

paymentsRouter.post(
  '/orders/mobile-money',
  authorize('payments:initiate'),
  asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body);
    const order = await createOrder(req.user!.companyId, req.user!.email, 'mobile_money', body);
    res.status(201).json(toOrderDTO(order));
  })
);

paymentsRouter.post(
  '/orders/bank-transfer',
  authorize('payments:initiate'),
  asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body);
    const order = await createOrder(req.user!.companyId, req.user!.email, 'virement', body);
    res.status(201).json(toOrderDTO(order));
  })
);

// ── Approbation / rejet (comptabilité — payments:validate) ──────

paymentsRouter.post(
  '/orders/:id/approve',
  authorize('payments:validate'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const order = await prisma.paymentOrder.findFirst({ where: { id: req.params.id, companyId } });
    if (!order) throw new NotFoundError(`Ordre de paiement ${req.params.id} introuvable`);
    if (order.status !== 'en_attente') throw new HttpError(409, 'Cet ordre de paiement a déjà été traité.');

    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'en_cours', validatedAt: new Date(), validatedBy: req.user!.email },
      include: { transactions: true },
    });

    settleOrderAsync(order.id);

    res.json(toOrderDTO(updated));
  })
);

paymentsRouter.post(
  '/orders/:id/reject',
  authorize('payments:validate'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const order = await prisma.paymentOrder.findFirst({ where: { id: req.params.id, companyId } });
    if (!order) throw new NotFoundError(`Ordre de paiement ${req.params.id} introuvable`);
    if (order.status !== 'en_attente') throw new HttpError(409, 'Cet ordre de paiement a déjà été traité.');

    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'annule' },
      include: { transactions: true },
    });

    res.json(toOrderDTO(updated));
  })
);

// ── Relance des transactions en échec (RH — payments:initiate) ──

paymentsRouter.post(
  '/orders/:id/retry',
  authorize('payments:initiate'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, companyId },
      include: { transactions: true },
    });
    if (!order) throw new NotFoundError(`Ordre de paiement ${req.params.id} introuvable`);

    const failed = order.transactions.filter((t) => t.status === 'echoue');
    if (failed.length === 0) throw new HttpError(409, 'Aucune transaction en échec à relancer.');

    for (const t of failed) {
      await prisma.paymentTransaction.update({
        where: { id: t.id },
        data: {
          status: 'reussi',
          reference: generateRef(order.type === 'mobile_money' ? 'OM' : 'VIR'),
          processedAt: new Date(),
          retryCount: { increment: 1 },
          errorMessage: null,
        },
      });
    }

    const settled = await prisma.paymentTransaction.findMany({ where: { orderId: order.id } });
    const allSuccess = settled.every((t) => t.status === 'reussi');
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: allSuccess ? { status: 'reussi' } : {},
      include: { transactions: true },
    });

    res.json(toOrderDTO(updated));
  })
);

// ── Export du fichier de virement (RH/compta — payments:read) ───

paymentsRouter.get(
  '/orders/:id/bank-transfer-file',
  authorize('payments:read'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, companyId },
      include: { transactions: true },
    });
    if (!order) throw new NotFoundError(`Ordre de paiement ${req.params.id} introuvable`);

    const employees = await prisma.employee.findMany({
      where: { companyId, id: { in: order.transactions.map((t) => t.employeeId) } },
    });
    const employeeById = new Map(employees.map((e) => [e.id, e]));

    const rows = [
      'Référence;Bénéficiaire;RIB/IBAN;Montant;Devise',
      ...order.transactions.map((t) => {
        const emp = employeeById.get(t.employeeId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId;
        const rib = emp?.bankIban ?? emp?.bankRib ?? '—';
        return `${t.reference ?? '—'};${name};${rib};${t.amount};XOF`;
      }),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ordre-paiement-${order.id}.csv"`);
    res.send(rows.join('\n'));
  })
);
