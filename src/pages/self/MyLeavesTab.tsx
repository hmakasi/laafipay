import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/store/authStore';
import { useLeaveBalanceQuery, useLeaveRequestsQuery } from '@/hooks/useLeaves';
import { LEAVE_STATUS_VARIANT } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { RequestLeaveDialog } from '@/pages/leaves/RequestLeaveDialog';

export function MyLeavesTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const { data: balances, isLoading: loadingBalances } = useLeaveBalanceQuery(user?.employeeId);
  const { data: requests, isLoading: loadingRequests } = useLeaveRequestsQuery({ employeeId: user?.employeeId });

  const sorted = [...(requests ?? [])].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{user?.employeeId && <RequestLeaveDialog employeeId={user.employeeId} />}</div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('leaves.myBalance')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBalances ? (
            <Skeleton className="h-20 w-full" />
          ) : !balances?.length ? (
            <p className="py-4 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {balances.map((b) => (
                <div key={`${b.type}-${b.year}`} className="rounded-md border p-3 text-center">
                  <div className="text-xs text-muted-foreground">{t(`leaves.type_${b.type}`)}</div>
                  <div className="text-xl font-semibold text-primary">{b.remaining}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('leaves.acquired')} {b.acquired} · {t('leaves.taken')} {b.taken}
                    {b.pending > 0 && ` · ${t('leaves.pending')} ${b.pending}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('leaves.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <Skeleton className="h-32 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('leaves.noRequests')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('leaves.leaveType')}</TableHead>
                  <TableHead>{t('leaves.startDate')}</TableHead>
                  <TableHead>{t('leaves.endDate')}</TableHead>
                  <TableHead>{t('leaves.days')}</TableHead>
                  <TableHead>{t('leaves.channel')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{t(`leaves.type_${req.type}`)}</TableCell>
                    <TableCell>{formatDate(req.startDate)}</TableCell>
                    <TableCell>{formatDate(req.endDate)}</TableCell>
                    <TableCell>{req.daysCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`leaves.channel_${req.channel}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEAVE_STATUS_VARIANT[req.status]}>{t(`leaves.status_${req.status}`)}</Badge>
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
