import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useDepartmentsQuery, useEmployeesQuery } from '@/hooks/useEmployees';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, EMPLOYEE_STATUS_VARIANT } from '@/lib/constants';
import { getInitials } from '@/lib/utils';
import { FilterParams } from '@/types';

const ALL = '__all__';

export function EmployeesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(ALL);
  const [contractType, setContractType] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const params: FilterParams = {
    search: search || undefined,
    departmentId: departmentId !== ALL ? departmentId : undefined,
    contractType: contractType !== ALL ? contractType : undefined,
    status: status !== ALL ? status : undefined,
    perPage: 50,
  };

  const { data, isLoading } = useEmployeesQuery(params);
  const { data: departments } = useDepartmentsQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('employees.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('employees.subtitle')}</p>
        </div>
        <PermissionGate permission="employees:write">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/employees/new?invite=1')}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('employees.inviteEmployee')}
            </Button>
            <Button onClick={() => navigate('/employees/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('employees.addEmployee')}
            </Button>
          </div>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t('employees.totalEmployees')}: {data?.total ?? '—'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('employees.search')}
                className="pl-9"
              />
            </div>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder={t('employees.filterByDepartment')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('employees.filterByDepartment')}</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder={t('employees.filterByContract')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('employees.filterByContract')}</SelectItem>
                {CONTRACT_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`employees.contract_${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder={t('employees.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('employees.filterByStatus')}</SelectItem>
                {EMPLOYEE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`employees.status_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employees.fullName')}</TableHead>
                  <TableHead>{t('employees.matricule')}</TableHead>
                  <TableHead>{t('employees.position')}</TableHead>
                  <TableHead>{t('employees.department')}</TableHead>
                  <TableHead>{t('employees.contract')}</TableHead>
                  <TableHead>{t('employees.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t('app.noResults')}
                    </TableCell>
                  </TableRow>
                )}
                {data?.data.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(emp.firstName, emp.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{emp.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{emp.matricule}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{departments?.find((d) => d.id === emp.departmentId)?.name ?? '—'}</TableCell>
                    <TableCell>{t(`employees.contract_${emp.contractType}`)}</TableCell>
                    <TableCell>
                      <Badge variant={EMPLOYEE_STATUS_VARIANT[emp.status]}>
                        {t(`employees.status_${emp.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
