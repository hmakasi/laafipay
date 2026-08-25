import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLeaveDashboardAllQuery } from '@/hooks/useLeaves';
import { useDepartmentsQuery, useEmployeesQuery } from '@/hooks/useEmployees';

const ALL = '__all__';

export function LeaveBalanceTracking() {
  const { t } = useTranslation();
  const [departmentId, setDepartmentId] = useState(ALL);

  const { data: dashboards, isLoading } = useLeaveDashboardAllQuery(departmentId !== ALL ? departmentId : undefined);
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: departments } = useDepartmentsQuery();

  const rows = useMemo(() => {
    if (!dashboards || !employeesPage) return [];
    return dashboards
      .map((d) => {
        const emp = employeesPage.data.find((e) => e.id === d.employeeId);
        return {
          ...d,
          name: emp ? `${emp.firstName} ${emp.lastName}` : d.employeeId,
          departmentName: departments?.find((dep) => dep.id === emp?.departmentId)?.name ?? '—',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboards, employeesPage, departments]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('leaves.balanceTracking')}</CardTitle>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('leaves.allDepartments')}</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !rows.length ? (
          <p className="py-8 text-center text-muted-foreground">{t('app.noData')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                <TableHead>{t('employees.department')}</TableHead>
                <TableHead className="text-right">{t('leaves.acquired')}</TableHead>
                <TableHead className="text-right">{t('leaves.accruing')}</TableHead>
                <TableHead className="text-right">{t('leaves.taken')}</TableHead>
                <TableHead className="text-right">{t('leaves.remaining')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.departmentName}</TableCell>
                  <TableCell className="text-right">{r.acquired}</TableCell>
                  <TableCell className="text-right">{r.accruing}</TableCell>
                  <TableCell className="text-right">{r.taken}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{r.remaining}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
