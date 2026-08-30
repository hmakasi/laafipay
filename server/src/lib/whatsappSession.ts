import { Company, Employee, WhatsAppSession } from '@prisma/client';
import { prisma } from './prisma.js';

export const SESSION_TTL_MINUTES = 10;

// Le webhook Meta reçoit un numéro déjà international sans "+" (ex.
// "22670123456"). Employee.phone est parfois saisi en local (8 chiffres,
// voir normalizeWhatsAppNumber dans whatsapp.ts) — on matche donc sur le
// numéro complet OU sur ses 8 derniers chiffres, sans avoir à connaître
// l'indicatif pays à l'avance (l'employé n'a pas encore d'entreprise résolue
// à ce stade).
export async function resolveEmployeeByWhatsAppPhone(from: string): Promise<(Employee & { company: Company }) | null> {
  const localSuffix = from.slice(-8);
  return prisma.employee.findFirst({
    where: { OR: [{ phone: from }, { phone: localSuffix }, { phone: { endsWith: localSuffix } }] },
    include: { company: true },
  }) as Promise<(Employee & { company: Company }) | null>;
}

export async function getActiveSession(phone: string, now: Date = new Date()): Promise<WhatsAppSession | null> {
  const session = await prisma.whatsAppSession.findUnique({ where: { phone } });
  if (!session) return null;
  if (session.expiresAt <= now) return null;
  return session;
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);
}

export async function startSession(
  params: { phone: string; employeeId: string; flow: string; step: string; data?: object },
  now: Date = new Date()
): Promise<WhatsAppSession> {
  const data = params.data ?? {};
  const expiresAt = expiryFrom(now);
  return prisma.whatsAppSession.upsert({
    where: { phone: params.phone },
    create: { phone: params.phone, employeeId: params.employeeId, flow: params.flow, step: params.step, data, expiresAt },
    update: { employeeId: params.employeeId, flow: params.flow, step: params.step, data, expiresAt },
  });
}

export async function advanceSession(sessionId: string, params: { step: string; data?: object }, now: Date = new Date()): Promise<WhatsAppSession> {
  return prisma.whatsAppSession.update({
    where: { id: sessionId },
    data: { step: params.step, data: params.data ?? {}, expiresAt: expiryFrom(now) },
  });
}

export async function endSession(sessionId: string): Promise<void> {
  await prisma.whatsAppSession.delete({ where: { id: sessionId } });
}
