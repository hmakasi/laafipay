import { PaymentOrder, PaymentStatus, PaymentTransaction, PaymentType } from '@/types';
import { MOCK_PAYMENT_ORDERS } from '@/mocks/payments';
import { MOCK_EMPLOYEES } from '@/mocks/employees';
import { delay, deepClone, generateRef } from '@/lib/utils';
import { notifyByEmail, notifyEmployee } from '@/services/api/users';

let orders = deepClone(MOCK_PAYMENT_ORDERS);

export interface PaymentItem {
  employeeId: string;
  amount: number;
}

// ── Helpers ───────────────────────────────────────────────────

function buildTransactions(items: PaymentItem[], type: PaymentType, orderId: string): PaymentTransaction[] {
  return items.map((item) => {
    const emp = MOCK_EMPLOYEES.find((e) => e.id === item.employeeId);
    return {
      id: `txn-${Date.now()}-${item.employeeId}`,
      orderId,
      employeeId: item.employeeId,
      amount: item.amount,
      status: 'en_attente' as PaymentStatus,
      type,
      operator: type === 'mobile_money' ? emp?.mobileMoneyInfo?.operator : undefined,
      phoneNumber: type === 'mobile_money' ? emp?.mobileMoneyInfo?.phoneNumber : undefined,
      retryCount: 0,
    };
  });
}

function processOrderAsync(order: PaymentOrder) {
  setTimeout(() => {
    order.transactions = order.transactions.map((t) =>
      Math.random() > 0.1
        ? {
            ...t,
            status: 'reussi' as PaymentStatus,
            reference: generateRef(order.type === 'mobile_money' ? 'OM' : 'VIR'),
            processedAt: new Date().toISOString(),
          }
        : {
            ...t,
            status: 'echoue' as PaymentStatus,
            processedAt: new Date().toISOString(),
            errorMessage: order.type === 'mobile_money' ? 'Solde insuffisant' : 'Compte introuvable',
          }
    );
    const successCount = order.transactions.filter((t) => t.status === 'reussi').length;
    const failedCount = order.transactions.length - successCount;
    order.status = failedCount === order.transactions.length ? 'echoue' : 'reussi';

    order.transactions.forEach((t) => {
      notifyEmployee(t.employeeId, {
        type: t.status === 'reussi' ? 'paiement_effectue' : 'paiement_echoue',
        title: t.status === 'reussi' ? 'Salaire versé' : 'Échec du versement',
        message:
          t.status === 'reussi'
            ? `Votre salaire a été versé avec succès (réf. ${t.reference}).`
            : `Le versement de votre salaire a échoué : ${t.errorMessage}`,
        link: '/self',
      });
    });

    notifyByEmail(order.createdBy, {
      type: failedCount > 0 ? 'paiement_echoue' : 'paiement_effectue',
      title: 'Paiement de masse terminé',
      message: `${successCount} paiement(s) réussi(s), ${failedCount} échec(s) sur l'ordre ${order.id}.`,
      link: `/payments/${order.id}`,
    });
  }, 3000);
}

// ── API Functions ─────────────────────────────────────────────

export async function getPaymentOrders(cycleId?: string): Promise<PaymentOrder[]> {
  await delay(400);
  if (cycleId) return deepClone(orders.filter((o) => o.cycleId === cycleId));
  return deepClone(orders);
}

export async function getPaymentOrder(id: string): Promise<PaymentOrder> {
  await delay(300);
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`Ordre de paiement ${id} introuvable`);
  return deepClone(order);
}

export async function createMobileMoneyPayment(
  cycleId: string,
  items: PaymentItem[],
  createdBy: string
): Promise<PaymentOrder> {
  await delay(600);
  const id = `po-${Date.now()}`;
  const newOrder: PaymentOrder = {
    id,
    cycleId,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'en_attente',
    type: 'mobile_money',
    totalAmount: items.reduce((acc, i) => acc + i.amount, 0),
    transactions: buildTransactions(items, 'mobile_money', id),
  };
  orders.push(newOrder);
  return deepClone(newOrder);
}

export async function createBankTransferPayment(
  cycleId: string,
  items: PaymentItem[],
  createdBy: string
): Promise<PaymentOrder> {
  await delay(600);
  const id = `po-${Date.now()}`;
  const newOrder: PaymentOrder = {
    id,
    cycleId,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'en_attente',
    type: 'virement',
    totalAmount: items.reduce((acc, i) => acc + i.amount, 0),
    transactions: buildTransactions(items, 'virement', id),
  };
  orders.push(newOrder);
  return deepClone(newOrder);
}

export async function approvePaymentOrder(id: string, validatedBy: string): Promise<PaymentOrder> {
  await delay(800);
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`Ordre ${id} introuvable`);
  order.status = 'en_cours';
  order.validatedAt = new Date().toISOString();
  order.validatedBy = validatedBy;

  processOrderAsync(order);

  return deepClone(order);
}

export async function retryFailedTransactions(orderId: string): Promise<PaymentOrder> {
  await delay(600);
  const order = orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Ordre ${orderId} introuvable`);

  order.transactions = order.transactions.map((t) =>
    t.status === 'echoue'
      ? {
          ...t,
          status: 'reussi' as PaymentStatus,
          reference: generateRef(order.type === 'mobile_money' ? 'OM' : 'VIR'),
          processedAt: new Date().toISOString(),
          retryCount: t.retryCount + 1,
          errorMessage: undefined,
        }
      : t
  );
  order.status = order.transactions.every((t) => t.status === 'reussi') ? 'reussi' : order.status;

  order.transactions
    .filter((t) => t.retryCount > 0)
    .forEach((t) => {
      notifyEmployee(t.employeeId, {
        type: 'paiement_effectue',
        title: 'Salaire versé',
        message: `Votre salaire a été versé avec succès après relance (réf. ${t.reference}).`,
        link: '/self',
      });
    });

  return deepClone(order);
}

export async function rejectPaymentOrder(id: string, rejectedBy: string): Promise<PaymentOrder> {
  await delay(400);
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`Ordre ${id} introuvable`);
  order.status = 'annule';

  notifyByEmail(order.createdBy, {
    type: 'paiement_echoue',
    title: 'Ordre de paiement rejeté',
    message: `L'ordre de paiement ${order.id} a été rejeté par ${rejectedBy}.`,
    link: `/payments/${order.id}`,
  });

  return deepClone(order);
}

export async function pollTransactionStatus(orderId: string) {
  await delay(200);
  const order = orders.find((o) => o.id === orderId);
  return deepClone(order?.transactions ?? []);
}

export async function generateBankTransferFile(orderId: string): Promise<Blob> {
  await delay(400);
  const order = orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Ordre ${orderId} introuvable`);

  const csvContent = [
    'Référence;Bénéficiaire;RIB/IBAN;Montant;Devise',
    ...order.transactions.map((t) => {
      const emp = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : t.employeeId;
      const rib = emp?.bankInfo?.rib ?? emp?.bankInfo?.iban ?? '—';
      return `${t.reference ?? generateRef('VIR')};${name};${rib};${t.amount};XOF`;
    }),
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv' });
}
