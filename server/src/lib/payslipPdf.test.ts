import { describe, it, expect } from 'vitest';
import { buildPayslipPdfRows, generatePayslipPdf, PayslipPdfData } from './payslipPdf.js';

const sampleData: PayslipPdfData = {
  company: { name: 'LaafiPay SARL', legalName: 'LaafiPay SARL', addressLine: 'Ouagadougou', taxIdLabel: 'IFU', taxIdNumber: '00012345', socialAgencyLabel: 'CNSS', socialSecurityNumber: '998877' },
  employee: { fullName: 'Awa Ouédraogo', matricule: 'EMP-001', address: 'Secteur 15, Ouagadougou' },
  period: { label: 'Juillet 2026' },
  earnings: [{ label: 'Salaire de base', employeeAmount: 200000 }],
  grossSalary: 200000,
  contributions: [{ label: 'CNSS', base: 200000, rate: 5.5, employeeAmount: -11000, employerAmount: 16000 }],
  employeeContributionsTotal: 11000,
  employerContributionsTotal: 16000,
  incomeTax: { label: 'IUTS', base: 189000, rate: 10, amount: 12000 },
  netBeforeTax: 189000,
  netToPay: 177000,
  employerCost: 216000,
  currencyCode: 'XOF',
};

describe('buildPayslipPdfRows', () => {
  it('formats earnings rows as [label, amount] pairs', () => {
    const rows = buildPayslipPdfRows(sampleData);
    expect(rows.earningsRows).toEqual([['Salaire de base', '200 000']]);
  });

  it('formats contributions rows as [label, base, rate, amount]', () => {
    const rows = buildPayslipPdfRows(sampleData);
    expect(rows.contributionsRows).toEqual([['CNSS', '200 000', '5.5%', '-11 000']]);
  });
});

describe('generatePayslipPdf', () => {
  it('produces a non-empty valid PDF buffer', () => {
    const buffer = generatePayslipPdf(sampleData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
