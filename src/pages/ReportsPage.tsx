import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Users, Wallet, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useDepartmentsQuery, useEmployeesQuery } from '@/hooks/useEmployees';
import { usePayrollCycleQuery, usePayrollCyclesQuery } from '@/hooks/usePayroll';
import { arrayToCSV, downloadBlob, formatPeriod } from '@/lib/utils';

export function ReportsPage() {
  const { t } = useTranslation();
  const [cycleId, setCycleId] = useState('');

  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: departments } = useDepartmentsQuery();
  const { data: cycles } = usePayrollCyclesQuery();
  const { data: cycle } = usePayrollCycleQuery(cycleId || undefined);

  const sortedCycles = [...(cycles ?? [])].sort((a, b) => b.period.localeCompare(a.period));

  const exportEmployees = () => {
    const employees = employeesPage?.data ?? [];
    const csv = arrayToCSV(
      employees.map((e) => ({
        matricule: e.matricule,
        firstName: e.firstName,
        lastName: e.lastName,
        position: e.position,
        department: departments?.find((d) => d.id === e.departmentId)?.name ?? '',
        contractType: e.contractType,
        status: e.status,
      })),
      {
        matricule: 'Matricule',
        firstName: 'Prénom',
        lastName: 'Nom',
        position: 'Poste',
        department: 'Département',
        contractType: 'Contrat',
        status: 'Statut',
      }
    );
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'effectifs.csv');
    toast.success(t('reports.exportEmployees'));
  };

  const exportPayroll = () => {
    if (!cycle) return;
    const employeeName = (id: string) => {
      const emp = employeesPage?.data.find((e) => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : id;
    };
    const csv = arrayToCSV(
      cycle.entries.map((entry) => ({
        employee: employeeName(entry.employeeId),
        baseSalary: entry.baseSalary,
        salaireBrut: entry.salaireBrut,
        cnssEmployee: entry.cnssEmployee,
        iuts: entry.iuts,
        salaireNet: entry.salaireNet,
        coutEmployeur: entry.coutEmployeur,
      })),
      {
        employee: 'Employé',
        baseSalary: 'Salaire de base',
        salaireBrut: 'Salaire brut',
        cnssEmployee: 'CNSS salarié',
        iuts: 'IUTS',
        salaireNet: 'Salaire net',
        coutEmployeur: 'Coût employeur',
      }
    );
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `masse-salariale-${cycle.period}.csv`);
    toast.success(t('reports.exportPayroll'));
  };

  const exportCnss = () => {
    if (!cycle) return;
    const csv = arrayToCSV(
      cycle.entries.map((entry) => {
        const emp = employeesPage?.data.find((e) => e.id === entry.employeeId);
        return {
          matricule: emp?.matricule ?? '',
          employee: emp ? `${emp.firstName} ${emp.lastName}` : entry.employeeId,
          cnssNumber: emp?.cnssNumber ?? '',
          baseCotisable: entry.baseSalary,
          partSalariale: entry.cnssEmployee,
          partPatronale: entry.cnssEmployer,
        };
      }),
      {
        matricule: 'Matricule',
        employee: 'Employé',
        cnssNumber: 'N° CNSS',
        baseCotisable: 'Base cotisable',
        partSalariale: 'Part salariale',
        partPatronale: 'Part patronale',
      }
    );
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `declaration-cnss-${cycle.period}.csv`);
    toast.success(t('reports.exportCnss'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('reports.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {t('reports.exportEmployees')}
          </CardTitle>
          <CardDescription>{employeesPage?.total ?? 0} employés</CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionGate permission="reports:export">
            <Button onClick={exportEmployees}>
              <Download className="mr-2 h-4 w-4" />
              {t('reports.download')}
            </Button>
          </PermissionGate>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reports.selectCycle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('payroll.period')} />
            </SelectTrigger>
            <SelectContent>
              {sortedCycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatPeriod(c.period)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              {t('reports.exportPayroll')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PermissionGate permission="reports:export">
              <Button onClick={exportPayroll} disabled={!cycle}>
                <Download className="mr-2 h-4 w-4" />
                {t('reports.download')}
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              {t('reports.exportCnss')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PermissionGate permission="reports:export">
              <Button onClick={exportCnss} disabled={!cycle}>
                <Download className="mr-2 h-4 w-4" />
                {t('reports.download')}
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
