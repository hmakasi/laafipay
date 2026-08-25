import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PayslipEmployerHeader } from '@/components/PayslipEmployerHeader';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PayslipResult } from '@/types';

// Bulletin de paie générique, mis en page "tableau" (rubrique / base / taux /
// part salariale / part patronale) plutôt qu'en liste de lignes empilées —
// aucun libellé de retenue ("IUTS", "CNSS"...) n'est câblé en dur : tout
// vient de payslip.lineItems, produit par la stratégie fiscale du pays de
// l'entreprise (voir server/src/payroll). Un même composant affiche donc
// indifféremment un bulletin BF, BJ ou RDC.
export function PayslipView({
  payslip,
  employeeName,
  matricule,
  period,
}: {
  payslip: PayslipResult;
  employeeName?: string;
  matricule?: string;
  period?: string;
}) {
  const money = (amount: number) => formatCurrency(amount, payslip.currencyCode);
  const employerCost = payslip.grossSalary + payslip.employerContributions;

  return (
    <Card className="max-w-2xl overflow-hidden p-0">
      {/* En-tête : employeur (auto-rempli, voir CompanySettingsPage) à gauche,
         salarié et période à droite — même disposition qu'un bulletin papier. */}
      <div className="grid grid-cols-1 gap-4 border-b bg-muted/30 p-5 text-sm sm:grid-cols-2">
        <PayslipEmployerHeader />
        <div className="sm:text-right">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Salarié</div>
          <div className="font-medium text-foreground">{employeeName ?? '—'}</div>
          {matricule && <div className="text-muted-foreground">Matricule {matricule}</div>}
          {period && <div className="mt-1 text-xs text-muted-foreground">Période : {period}</div>}
        </div>
      </div>

      <CardContent className="space-y-4 p-5 text-sm">
        {/* Corps : un tableau, pas des lignes empilées — chaque rubrique
           affiche sa base et son taux en plus des montants, comme un vrai
           bulletin (colonnes Base/Taux tirées de PayslipLineItem). */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rubrique</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">Part salariale</TableHead>
                <TableHead className="text-right">Part patronale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Salaire brut</TableCell>
                <TableCell className="text-right tabular-nums">—</TableCell>
                <TableCell className="text-right tabular-nums">—</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(payslip.grossSalary)}</TableCell>
                <TableCell className="text-right tabular-nums">—</TableCell>
              </TableRow>
              {payslip.lineItems.map((item) => (
                <TableRow key={item.code}>
                  <TableCell className="text-muted-foreground">{item.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money(item.baseAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {(item.rateApplied * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.employeeAmount > 0 ? `-${money(item.employeeAmount)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.employerAmount > 0 ? money(item.employerAmount) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pied de page : récapitulatif + mentions légales, comme le bas
           d'un bulletin papier. */}
        <div className="space-y-2 rounded-md bg-primary/10 p-4">
          <div className="flex justify-between text-base font-semibold text-primary">
            <span>Net à payer</span>
            <span className="tabular-nums">{money(payslip.netSalary)}</span>
          </div>
          <Separator className="bg-primary/20" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total retenues salariales</span>
            <span className="tabular-nums">-{money(payslip.employeeContributions)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total charges patronales</span>
            <span className="tabular-nums">{money(payslip.employerContributions)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Coût employeur total</span>
            <span className="tabular-nums">{money(employerCost)}</span>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Bulletin édité le {formatDate(new Date().toISOString())} — à conserver sans limitation de durée.
        </p>
      </CardContent>
    </Card>
  );
}
