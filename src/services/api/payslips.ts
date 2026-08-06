import { Payslip, PayslipSendStatus } from '@/types';
import { MOCK_EMPLOYEES } from '@/mocks/employees';
import { MOCK_PAYROLL_CYCLES, MOCK_LEGAL_SETTINGS } from '@/mocks/payroll';
import { delay, deepClone } from '@/lib/utils';
import { computeEmployeePayrollEntry } from '@/lib/payrollEngine';
import { getPayrollCycle } from '@/services/api/payroll';
import { notifyEmployee } from '@/services/api/users';

// Generate payslips from cycles (seed data, uses the current legal settings at load time)
function generateMockPayslips(): Payslip[] {
  const payslips: Payslip[] = [];
  const completedCycles = MOCK_PAYROLL_CYCLES.filter(
    (c) => c.status === 'paye' || c.status === 'valide'
  );

  completedCycles.forEach((cycle) => {
    MOCK_EMPLOYEES.filter((e) => e.status !== 'offboarded').forEach((emp) => {
      const entry = computeEmployeePayrollEntry(emp, cycle.id, MOCK_LEGAL_SETTINGS[0]);
      const sent = cycle.status === 'paye';

      payslips.push({
        id: `payslip-${cycle.id}-${emp.id}`,
        employeeId: emp.id,
        cycleId: cycle.id,
        period: cycle.period,
        generatedAt: cycle.validatedAt || cycle.createdAt,
        generatedBy: cycle.validatedBy || 'system',
        emailStatus: sent ? 'envoye' : 'non_envoye',
        whatsappStatus: sent ? 'envoye' : 'non_envoye',
        smsStatus: 'non_envoye',
        emailSentAt: sent ? cycle.validatedAt : undefined,
        whatsappSentAt: sent ? cycle.validatedAt : undefined,
        baseSalary: entry.baseSalary,
        salaireBrut: entry.salaireBrut,
        salaireNet: entry.salaireNet,
        cnssEmployee: entry.cnssEmployee,
        iuts: entry.iuts,
        primes: entry.primes,
        indemnites: entry.indemnites,
        avances: entry.avances,
        retenues: entry.retenues,
      });
    });
  });

  return payslips;
}

let payslips = generateMockPayslips();

// ── API Functions ─────────────────────────────────────────────

export async function getPayslips(employeeId?: string, cycleId?: string): Promise<Payslip[]> {
  await delay(400);
  let filtered = [...payslips];
  if (employeeId) filtered = filtered.filter((p) => p.employeeId === employeeId);
  if (cycleId) filtered = filtered.filter((p) => p.cycleId === cycleId);
  return deepClone(filtered);
}

export async function getPayslip(id: string): Promise<Payslip> {
  await delay(300);
  const payslip = payslips.find((p) => p.id === id);
  if (!payslip) throw new Error(`Bulletin ${id} introuvable`);
  return deepClone(payslip);
}

export async function generatePayslips(cycleId: string): Promise<Payslip[]> {
  await delay(1000);
  // Reuse the payroll cycle's own entries (already validated / possibly manually adjusted)
  // instead of recomputing independently, so payslip amounts never drift from the payroll cycle.
  const cycle = await getPayrollCycle(cycleId);

  const newPayslips: Payslip[] = cycle.entries.map((entry) => ({
    id: `payslip-${cycleId}-${entry.employeeId}`,
    employeeId: entry.employeeId,
    cycleId,
    period: cycle.period,
    generatedAt: new Date().toISOString(),
    generatedBy: 'current-user',
    emailStatus: 'non_envoye' as PayslipSendStatus,
    whatsappStatus: 'non_envoye' as PayslipSendStatus,
    smsStatus: 'non_envoye' as PayslipSendStatus,
    baseSalary: entry.baseSalary,
    salaireBrut: entry.salaireBrut,
    salaireNet: entry.salaireNet,
    cnssEmployee: entry.cnssEmployee,
    iuts: entry.iuts,
    primes: entry.primes,
    indemnites: entry.indemnites,
    avances: entry.avances,
    retenues: entry.retenues,
  }));

  // Replace existing payslips for this cycle
  payslips = payslips.filter((p) => p.cycleId !== cycleId);
  payslips.push(...newPayslips);

  newPayslips.forEach((p) => {
    notifyEmployee(p.employeeId, {
      type: 'bulletin_disponible',
      title: 'Bulletin de paie disponible',
      message: `Votre bulletin de paie pour ${cycle.period} est disponible.`,
      link: '/self',
    });
  });

  return deepClone(newPayslips);
}

export async function sendPayslipByEmail(id: string): Promise<void> {
  await delay(700);
  const payslip = payslips.find((p) => p.id === id);
  if (payslip) {
    payslip.emailStatus = 'envoye';
    payslip.emailSentAt = new Date().toISOString();
  }
}

export async function sendPayslipByWhatsApp(id: string): Promise<void> {
  await delay(800);
  const payslip = payslips.find((p) => p.id === id);
  if (payslip) {
    payslip.whatsappStatus = 'envoye';
    payslip.whatsappSentAt = new Date().toISOString();
  }
}

export async function sendPayslipBySms(id: string): Promise<void> {
  await delay(600);
  const payslip = payslips.find((p) => p.id === id);
  if (payslip) {
    payslip.smsStatus = 'envoye';
    payslip.smsSentAt = new Date().toISOString();
  }
}

export async function sendAllPayslips(cycleId: string, channel: 'email' | 'whatsapp' | 'sms'): Promise<void> {
  await delay(1200);
  payslips
    .filter((p) => p.cycleId === cycleId)
    .forEach((p) => {
      if (channel === 'email') {
        p.emailStatus = 'envoye';
        p.emailSentAt = new Date().toISOString();
      } else if (channel === 'whatsapp') {
        p.whatsappStatus = 'envoye';
        p.whatsappSentAt = new Date().toISOString();
      } else {
        p.smsStatus = 'envoye';
        p.smsSentAt = new Date().toISOString();
      }
    });
}
