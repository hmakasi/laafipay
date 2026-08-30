import { SalaryAdvanceRequest } from '@/types';
import { MOCK_ADVANCE_REQUESTS } from '@/mocks/advances';
import { getAllEmployees } from '@/services/api/employees';
import { delay, deepClone, generateRef } from '@/lib/utils';

// Module encore entièrement mocké (aucune route serveur, aucune table
// Postgres) — contrairement aux congés, les avances n'ont pas encore été
// migrées vers le backend réel, donc pas de notification possible ici tant
// que ça reste le cas (les notifications ne sont plus créées que
// côté serveur, voir server/src/lib/notifications.ts). Pas de régression :
// la notification émise ici était déjà fictive, jamais vue par personne
// d'autre que l'onglet qui l'a déclenchée.
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
