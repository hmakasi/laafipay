// server/src/lib/leaveRequests.ts
import { LeaveRequest, LeaveType } from '@prisma/client';
import { prisma } from './prisma.js';
import { sendLeaveManagerNotification } from './whatsapp.js';

function dateOnlyFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

export interface CreateLeaveRequestParams {
  companyId: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  reason?: string;
  channel: 'portail' | 'whatsapp';
}

export async function createLeaveRequestRecord(params: CreateLeaveRequestParams): Promise<LeaveRequest> {
  const request = await prisma.leaveRequest.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: params.type,
      startDate: params.startDate,
      endDate: params.endDate,
      daysCount: params.daysCount,
      reason: params.reason,
      channel: params.channel,
    },
  });

  await prisma.leaveBalance.upsert({
    where: { employeeId_year_type: { employeeId: params.employeeId, year: params.startDate.getUTCFullYear(), type: params.type } },
    create: { companyId: params.companyId, employeeId: params.employeeId, year: params.startDate.getUTCFullYear(), type: params.type, pending: params.daysCount },
    update: { pending: { increment: params.daysCount } },
  });

  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId },
    include: { manager: { select: { phone: true } }, company: { select: { countryCode: true } } },
  });

  if (employee?.managerId && employee.manager) {
    // Best-effort : un échec d'envoi WhatsApp (template pas encore approuvé,
    // manager sans numéro valide...) ne doit jamais faire échouer la
    // création de la demande de congé elle-même.
    await sendLeaveManagerNotification(employee.manager.phone, employee.company.countryCode, {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      startDate: dateOnlyFr(params.startDate),
      endDate: dateOnlyFr(params.endDate),
    });
  }

  return request;
}
