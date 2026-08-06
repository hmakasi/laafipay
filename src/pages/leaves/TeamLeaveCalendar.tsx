import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  isWithinInterval,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDepartmentLeaveCalendarQuery } from '@/hooks/useLeaves';
import { useDepartmentsQuery, useEmployeesQuery } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';

const ALL = '__all__';

// Les congés de démo couvrent mars-mai 2024 : on démarre le calendrier sur cette période.
const DEFAULT_MONTH = new Date(2024, 3, 1);

export function TeamLeaveCalendar() {
  const { t } = useTranslation();
  const [monthDate, setMonthDate] = useState(DEFAULT_MONTH);
  const [departmentId, setDepartmentId] = useState(ALL);

  const month = format(monthDate, 'yyyy-MM');
  const { data: leaves, isLoading } = useDepartmentLeaveCalendarQuery(
    month,
    departmentId !== ALL ? departmentId : undefined
  );
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: departments } = useDepartmentsQuery();

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }),
    [monthDate]
  );

  const employeesWithLeave = useMemo(() => {
    if (!leaves || !employeesPage) return [];
    const ids = new Set(leaves.map((l) => l.employeeId));
    return employeesPage.data.filter((e) => ids.has(e.id));
  }, [leaves, employeesPage]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base capitalize">{format(monthDate, 'MMMM yyyy', { locale: fr })}</CardTitle>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="icon" onClick={() => setMonthDate((d) => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setMonthDate((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : employeesWithLeave.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('leaves.noLeaveThisMonth')}</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 200 + days.length * 28 }}>
              <div className="grid" style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(24px, 1fr))` }}>
                <div />
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-b border-border pb-1 text-center text-[10px] text-muted-foreground',
                      isWeekend(day) && 'bg-muted/40'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                ))}

                {employeesWithLeave.map((employee) => (
                  <Fragment key={employee.id}>
                    <div className="flex items-center truncate border-b border-border py-2 pr-2 text-sm font-medium text-foreground">
                      {employee.firstName} {employee.lastName}
                    </div>
                    {days.map((day) => {
                      const onLeave = leaves?.some(
                        (l) =>
                          l.employeeId === employee.id &&
                          isWithinInterval(day, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
                      );
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn('flex items-center border-b border-border py-2 px-0.5', isWeekend(day) && 'bg-muted/40')}
                        >
                          {onLeave && <div className="h-4 w-full rounded bg-primary/70" title={`${employee.firstName} ${employee.lastName}`} />}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
