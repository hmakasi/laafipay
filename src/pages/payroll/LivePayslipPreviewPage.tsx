import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useLegalSettingsQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { computePayrollEntry } from '@/lib/payrollEngine';
import { formatCurrency } from '@/lib/utils';

function VariableInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PayslipLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  // Hook appelé ici plutôt que de faire passer currencyCode en prop sur
  // chaque site d'appel : queryKey ['companies','me'] partagée avec
  // LivePayslipPreviewPage, React Query déduplique — pas de requête en plus.
  const { data: company } = useCurrentCompanyQuery();
  return (
    <div className={`flex items-center justify-between ${strong ? 'font-semibold text-foreground' : 'text-sm text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={strong ? 'text-foreground' : ''}>{formatCurrency(value, company?.currencyCode)}</span>
    </div>
  );
}

export function LivePayslipPreviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: employeesPage, isLoading: employeesLoading } = useEmployeesQuery({ perPage: 1000 });
  const { data: legalSettingsVersions, isLoading: legalLoading } = useLegalSettingsQuery();

  const employees = employeesPage?.data ?? [];
  const legalSettings = legalSettingsVersions?.[0];

  const [employeeId, setEmployeeId] = useState('');
  const [overtimeAmount, setOvertimeAmount] = useState('0');
  const [seniorityBonus, setSeniorityBonus] = useState('0');
  const [transportBonus, setTransportBonus] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [advances, setAdvances] = useState('0');

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];

  const entry = useMemo(() => {
    if (!employee || !legalSettings) return null;
    return computePayrollEntry(
      {
        employeeId: employee.id,
        cycleId: 'simulation',
        baseSalary: employee.baseSalary,
        overtimeAmount: Number(overtimeAmount) || 0,
        primes: [
          { id: 'anciennete', label: t('payroll.livePreview.seniorityBonus'), amount: Number(seniorityBonus) || 0, type: 'prime' },
          { id: 'transport', label: t('payroll.livePreview.transportBonus'), amount: Number(transportBonus) || 0, type: 'prime' },
        ],
        retenues:
          Number(deductions) > 0
            ? [{ id: 'retenue', label: t('payroll.retenues'), amount: Number(deductions), type: 'retenue' }]
            : [],
        avances:
          Number(advances) > 0
            ? [{ id: 'avance', label: t('payroll.avances'), amount: Number(advances), type: 'avance' }]
            : [],
      },
      legalSettings
    );
  }, [employee, legalSettings, overtimeAmount, seniorityBonus, transportBonus, deductions, advances, t]);

  const isLoading = employeesLoading || legalLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{t('payroll.livePreview.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('payroll.livePreview.subtitle')}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.variableElements')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('payroll.livePreview.selectEmployee')}</Label>
                <Select value={employee?.id} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <VariableInput label={t('payroll.livePreview.overtimeAmount')} value={overtimeAmount} onChange={setOvertimeAmount} />
                <VariableInput label={t('payroll.livePreview.seniorityBonus')} value={seniorityBonus} onChange={setSeniorityBonus} />
                <VariableInput label={t('payroll.livePreview.transportBonus')} value={transportBonus} onChange={setTransportBonus} />
                <VariableInput label={t('payroll.retenues')} value={deductions} onChange={setDeductions} />
                <VariableInput label={t('payroll.avances')} value={advances} onChange={setAdvances} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.livePreview.payslipPreview')}</CardTitle>
              {employee && (
                <p className="text-sm text-muted-foreground">
                  {employee.firstName} {employee.lastName} · {employee.matricule}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {entry ? (
                <div className="space-y-3 animate-fade-in" key={employee?.id}>
                  <PayslipLine label={t('payroll.livePreview.baseSalary')} value={entry.baseSalary} />
                  {entry.primes.map((p) => (
                    <PayslipLine key={p.id} label={p.label} value={p.amount} />
                  ))}
                  <PayslipLine label={t('payroll.overtimeHours')} value={entry.overtimeAmount} />
                  <Separator />
                  <PayslipLine label={t('payroll.salaireBrut')} value={entry.salaireBrut} strong />
                  <PayslipLine label={`${t('payroll.cnssEmployee')} (${legalSettings?.cnssEmployeeRate}%)`} value={-entry.cnssEmployee} />
                  <PayslipLine label={t('payroll.iuts')} value={-entry.iuts} />
                  {entry.avances.length > 0 && <PayslipLine label={t('payroll.avances')} value={-entry.avances[0].amount} />}
                  {entry.retenues.length > 0 && <PayslipLine label={t('payroll.retenues')} value={-entry.retenues[0].amount} />}
                  <Separator />
                  <div className="rounded-lg bg-primary/10 p-3">
                    <PayslipLine label={t('payroll.livePreview.netToPay')} value={entry.salaireNet} strong />
                  </div>
                  <Separator />
                  <PayslipLine label={`${t('payroll.cnssEmployer')} (${legalSettings?.cnssEmployerRate}%)`} value={entry.cnssEmployer} />
                  <PayslipLine label={t('payroll.livePreview.employerCost')} value={entry.coutEmployeur} strong />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
