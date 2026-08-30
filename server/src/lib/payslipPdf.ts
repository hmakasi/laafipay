import { jsPDF } from 'jspdf';

export interface PayslipPdfRow {
  label: string;
  base?: number;
  rate?: number;
  employeeAmount: number;
  employerAmount?: number;
}

export interface PayslipPdfData {
  company: { name: string; legalName: string; addressLine?: string; taxIdLabel: string; taxIdNumber?: string; socialAgencyLabel: string; socialSecurityNumber?: string };
  employee: { fullName: string; matricule: string; address?: string };
  period: { label: string };
  earnings: PayslipPdfRow[];
  grossSalary: number;
  contributions: PayslipPdfRow[];
  employeeContributionsTotal: number;
  employerContributionsTotal: number;
  incomeTax: { label: string; base: number; rate: number; amount: number };
  netBeforeTax: number;
  netToPay: number;
  employerCost: number;
  currencyCode: string;
}

function formatAmount(amount: number): string {
  // Node's fr-FR ICU data groups thousands with a narrow no-break space
  // (U+202F), not a regular space. jsPDF's default fonts are WinAnsi-encoded
  // (Helvetica) and don't have a glyph for U+202F, so left as-is the amount
  // would render with a missing/garbled separator in the actual PDF. Normalize
  // to a plain space, which is also what the test fixtures below expect.
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/[  ]/g, ' ');
}

export function buildPayslipPdfRows(data: PayslipPdfData) {
  const earningsRows: [string, string][] = data.earnings.map((row) => [row.label, formatAmount(row.employeeAmount)]);
  const contributionsRows: [string, string, string, string][] = data.contributions.map((row) => [
    row.label,
    row.base !== undefined ? formatAmount(row.base) : '',
    row.rate !== undefined ? `${row.rate}%` : '',
    formatAmount(row.employeeAmount),
  ]);
  return { earningsRows, contributionsRows };
}

// Reproduit la structure de PayslipOfficialTemplate.tsx (en-tête entreprise,
// identité employé, tableau des éléments de rémunération, tableau des
// cotisations, net à payer) — voir la section "Corrections found while
// planning" du plan : ce n'est pas un port du composant React (qui n'exporte
// aucun PDF aujourd'hui), c'est une nouvelle implémentation jsPDF construite
// à partir des mêmes données. Toute évolution visuelle du bulletin officiel
// doit être répercutée ici aussi.
export function generatePayslipPdf(data: PayslipPdfData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { earningsRows, contributionsRows } = buildPayslipPdfRows(data);
  let y = 15;

  doc.setFontSize(14);
  doc.text(data.company.name, 15, y);
  doc.setFontSize(9);
  y += 6;
  if (data.company.addressLine) {
    doc.text(data.company.addressLine, 15, y);
    y += 5;
  }
  doc.text(`${data.company.taxIdLabel} : ${data.company.taxIdNumber ?? '—'}`, 15, y);
  y += 5;
  doc.text(`${data.company.socialAgencyLabel} : ${data.company.socialSecurityNumber ?? '—'}`, 15, y);

  y += 10;
  doc.setFontSize(12);
  doc.text(`Bulletin de paie — ${data.period.label}`, 15, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`${data.employee.fullName} (${data.employee.matricule})`, 15, y);
  y += 5;
  if (data.employee.address) {
    doc.text(data.employee.address, 15, y);
    y += 5;
  }

  y += 8;
  doc.setFontSize(11);
  doc.text('Éléments de rémunération', 15, y);
  y += 6;
  doc.setFontSize(9);
  for (const [label, amount] of earningsRows) {
    doc.text(label, 15, y);
    doc.text(`${amount} ${data.currencyCode}`, 150, y, { align: 'right' });
    y += 5;
  }
  y += 3;
  doc.setFontSize(10);
  doc.text('Salaire brut', 15, y);
  doc.text(`${formatAmount(data.grossSalary)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(11);
  doc.text('Cotisations', 15, y);
  y += 6;
  doc.setFontSize(9);
  for (const [label, base, rate, amount] of contributionsRows) {
    doc.text(`${label} (base ${base}, ${rate})`, 15, y);
    doc.text(`${amount} ${data.currencyCode}`, 150, y, { align: 'right' });
    y += 5;
  }

  y += 5;
  doc.setFontSize(10);
  doc.text(`${data.incomeTax.label} (base ${formatAmount(data.incomeTax.base)}, ${data.incomeTax.rate}%)`, 15, y);
  doc.text(`-${formatAmount(data.incomeTax.amount)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(12);
  doc.text('Net à payer', 15, y);
  doc.text(`${formatAmount(data.netToPay)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(9);
  doc.text(`Coût employeur total : ${formatAmount(data.employerCost)} ${data.currencyCode}`, 15, y);

  return Buffer.from(doc.output('arraybuffer'));
}
