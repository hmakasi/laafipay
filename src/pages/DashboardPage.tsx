import { differenceInDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Building2, Users, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { useDepartmentsQuery, useEmployeesQuery } from '@/hooks/useEmployees';
import { usePayrollCyclesQuery } from '@/hooks/usePayroll';
import { usePaymentOrdersQuery } from '@/hooks/usePayments';
import { useLeaveRequestsQuery } from '@/hooks/useLeaves';
import { formatCurrency, formatPeriod } from '@/lib/utils';

const HEADCOUNT_HUE = '#059669';
const COST_HUE = '#2a78d6';

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-1 h-6 w-24" /> : <p className="text-xl font-semibold">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: company } = useCurrentCompanyQuery();
  // `formatCurrency` retombe sur XOF/FCFA par défaut tant que la requête
  // n'a pas résolu — comportement inchangé pour les entreprises BF/BJ.
  const currencyCode = company?.currencyCode;
  const { data: employeesPage, isLoading: loadingEmployees } = useEmployeesQuery({ perPage: 1000 });
  const { data: departments } = useDepartmentsQuery();
  const { data: cycles, isLoading: loadingCycles } = usePayrollCyclesQuery();
  const { data: paymentOrders } = usePaymentOrdersQuery();
  const { data: pendingLeaves } = useLeaveRequestsQuery({ status: 'en_attente' });

  const employees = employeesPage?.data ?? [];
  const activeEmployees = employees.filter((e) => e.status === 'actif');

  const sortedCycles = [...(cycles ?? [])].sort((a, b) => b.period.localeCompare(a.period));
  const latestCycle = sortedCycles[0];
  const costTrend = [...sortedCycles].slice(0, 6).reverse().map((c) => ({
    period: formatPeriod(c.period).split(' ')[0].slice(0, 3),
    cout: c.totalEmployerCost,
  }));

  const byDepartment = (departments ?? []).map((d) => ({
    name: d.code,
    count: employees.filter((e) => e.departmentId === d.id).length,
  }));

  const contractLabels: Record<string, string> = { CDI: 'CDI', CDD: 'CDD', Stage: 'Stage', Journalier: 'Journ.', Consultant: 'Consult.' };
  const byContract = Object.entries(contractLabels).map(([type, label]) => ({
    name: label,
    count: employees.filter((e) => e.contractType === type).length,
  }));

  const today = new Date();
  const trialAlerts = employees.filter(
    (e) => e.trialEndDate && differenceInDays(parseISO(e.trialEndDate), today) >= 0 && differenceInDays(parseISO(e.trialEndDate), today) <= 30
  );
  const contractAlerts = employees.filter(
    (e) =>
      e.contractType === 'CDD' &&
      e.contractEndDate &&
      differenceInDays(parseISO(e.contractEndDate), today) >= 0 &&
      differenceInDays(parseISO(e.contractEndDate), today) <= 60
  );

  const allTransactions = (paymentOrders ?? []).flatMap((o) => o.transactions);
  const processed = allTransactions.filter((t) => t.status === 'reussi' || t.status === 'echoue');
  const successRate = processed.length ? Math.round((processed.filter((t) => t.status === 'reussi').length / processed.length) * 100) : null;
  const failedCount = processed.filter((t) => t.status === 'echoue').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {t('app.name')}
          {user && <span className="ml-2 text-lg font-normal text-muted-foreground">— {t('dashboard.hrDashboard')}</span>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.firstName}, {t(`roles.${user?.role}`)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label={t('dashboard.totalHeadcount')} value={String(activeEmployees.length)} loading={loadingEmployees} />
        <StatCard icon={Building2} label={t('dashboard.byDepartment')} value={String(departments?.length ?? 0)} loading={loadingEmployees} />
        <StatCard
          icon={Wallet}
          label={t('dashboard.totalPayroll')}
          value={latestCycle ? formatCurrency(latestCycle.totalNet, currencyCode) : '—'}
          loading={loadingCycles}
        />
        <StatCard icon={AlertTriangle} label={t('dashboard.pendingLeaves')} value={String(pendingLeaves?.length ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.byDepartment')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {loadingEmployees ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDepartment} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" fill={HEADCOUNT_HUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.byContract')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {loadingEmployees ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byContract} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" fill={HEADCOUNT_HUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.alerts')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trialAlerts.length === 0 && contractAlerts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <>
              {trialAlerts.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <span className="font-medium">{e.firstName} {e.lastName}</span>
                  <Badge variant="warning">{t('dashboard.trialEnding')} · {e.trialEndDate}</Badge>
                </div>
              ))}
              {contractAlerts.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <span className="font-medium">{e.firstName} {e.lastName}</span>
                  <Badge variant="destructive">{t('dashboard.contractExpiring')} · {e.contractEndDate}</Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('dashboard.payrollDashboard')}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.coutEmployeur')}</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {loadingCycles ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={costTrend} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v), currencyCode)} />
                    <Line type="monotone" dataKey="cout" stroke={COST_HUE} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.successRate')}</CardTitle>
            </CardHeader>
            <CardContent className="flex h-56 flex-col items-center justify-center gap-3">
              {successRate === null ? (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              ) : (
                <>
                  <div className="text-4xl font-bold text-primary">{successRate}%</div>
                  <div className="flex gap-2">
                    <Badge variant="success">{processed.length - failedCount} {t('payments.status_reussi').toLowerCase()}</Badge>
                    {failedCount > 0 && <Badge variant="destructive">{failedCount} {t('dashboard.failedPayments').toLowerCase()}</Badge>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.payrollCycles')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCycles ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-2">
              {sortedCycles.slice(0, 5).map((cycle) => (
                <div key={cycle.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <span className="font-medium capitalize">{formatPeriod(cycle.period)}</span>
                  <span className="text-muted-foreground">{cycle.employeeCount} employés</span>
                  <span>{formatCurrency(cycle.totalNet, currencyCode)}</span>
                  <span className="capitalize text-muted-foreground">{t(`payroll.status_${cycle.status}`)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
