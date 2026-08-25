import { SalaryAdvanceRequest } from '@/types';
import { MOCK_ADVANCE_REQUESTS } from '@/mocks/advances';
import { getAllEmployees } from '@/services/api/employees';
import { delay, deepClone, generateRef } from '@/lib/utils';
import { notifyEmployee } from '@/services/api/users';

let advances = deepClone(MOCK_ADVANCE_REQUESTS);

export async function getAdvanceRequests(): Promise<SalaryAdvanceRequest[]> {
  await delay(400);
  return deepClone(advances);
}

export async function approveAdvanceRequest(id: string, approvedBy: string): Promise<SalaryAdvanceRequest> {
  await delay(500);
  const advance = advances.find((a) => a.id === id);
  if (!advance) throw new Error(`Demande d'avance ${id} introuvable`);
  advance.status = 'approuve';
  advance.approvedAt = new Date().toISOString();
  advance.approvedBy = approvedBy;

  notifyEmployee(advance.employeeId, {
    type: 'paiement_effectue',
    title: 'Avance approuvée',
    message: `Votre demande d'avance a été approuvée, le versement Mobile Money va être déclenché.`,
    link: '/self',
  });

  return deepClone(advance);
}

export async function payAdvanceRequestViaMobileMoney(id: string): Promise<SalaryAdvanceRequest> {
  await delay(1500);
  const advance = advances.find((a) => a.id === id);
  if (!advance) throw new Error(`Demande d'avance ${id} introuvable`);
  const employees = await getAllEmployees();
  const employee = employees.find((e) => e.id === advance.employeeId);

  advance.status = 'verse_mobile_money';
  advance.mobileMoneyOperator = employee?.mobileMoneyInfo?.operator ?? advance.mobileMoneyOperator ?? 'orange';
  advance.reference = generateRef('OM');
  advance.paidAt = new Date().toISOString();

  notifyEmployee(advance.employeeId, {
    type: 'paiement_effectue',
    title: 'Avance versée',
    message: `Votre avance de ${advance.amount.toLocaleString('fr-FR')} FCFA a été versée par Mobile Money (réf. ${advance.reference}).`,
    link: '/self',
  });

  return deepClone(advance);
}

export async function markAdvanceDeducted(id: string): Promise<SalaryAdvanceRequest> {
  await delay(300);
  const advance = advances.find((a) => a.id === id);
  if (!advance) throw new Error(`Demande d'avance ${id} introuvable`);
  advance.status = 'deduit';
  advance.deductedAt = new Date().toISOString();
  return deepClone(advance);
}
