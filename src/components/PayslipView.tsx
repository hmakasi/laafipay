import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { PayslipResult } from '@/types';

// Bulletin de paie générique : aucun libellé de retenue ("IUTS", "CNSS"...)
// n'est câblé en dur ici — tout vient de payslip.lineItems, produit par la
// stratégie fiscale du pays de l'entreprise (voir server/src/payroll).
// Un même composant affiche donc indifféremment un bulletin BF, BJ ou RDC.
export function PayslipView({
  payslip,
  employeeName,
  period,
}: {
  payslip: PayslipResult;
  employeeName?: string;
  period?: string;
}) {
  const money = (amount: number) => formatCurrency(amount, payslip.currencyCode);
  const employerLines = payslip.lineItems.filter((item) => item.employerAmount > 0);

  return (
    <Card className="max-w-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Bulletin de paie</CardTitle>
        {(employeeName || period) && (
          <p className="text-sm text-muted-foreground">
            {employeeName}
            {employeeName && period ? ' — ' : ''}
            {period}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between font-medium">
          <span>Salaire brut</span>
          <span>{money(payslip.grossSalary)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Base imposable</span>
          <span>{money(payslip.taxableGross)}</span>
        </div>

        <Separator />

        {/* Retenues salariales : une ligne par élément de payslip.lineItems,
           quel que soit le pays (IUTS+CNSS pour BF, IPR+CNSS pour RDC, ...). */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Retenues salariales
          </div>
          {payslip.lineItems.map((item) => (
            <div key={item.code} className="flex items-baseline justify-between text-muted-foreground">
              <span>
                {item.label}
                <span className="ml-1.5 text-xs tabular-nums">
                  ({(item.rateApplied * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %)
                </span>
              </span>
              <span className="tabular-nums">-{money(item.employeeAmount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1.5 font-medium">
            <span>Total retenues salariales</span>
            <span>-{money(payslip.employeeContributions)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between border-t pt-2 text-base font-semibold text-primary">
          <span>Net à payer</span>
          <span>{money(payslip.netSalary)}</span>
        </div>

        {employerLines.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Charges patronales (informatif — non déduites du net)
              </div>
              {employerLines.map((item) => (
                <div key={item.code} className="flex justify-between text-muted-foreground">
                  <span>{item.label}</span>
                  <span className="tabular-nums">{money(item.employerAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <span>Total charges patronales</span>
                <span>{money(payslip.employerContributions)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Coût employeur total</span>
                <span>{money(payslip.grossSalary + payslip.employerContributions)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
