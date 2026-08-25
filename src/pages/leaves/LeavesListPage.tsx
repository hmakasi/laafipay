import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { TeamLeaveCalendar } from '@/pages/leaves/TeamLeaveCalendar';
import { LeaveBalanceTracking } from '@/pages/leaves/LeaveBalanceTracking';
import {
  useApproveLeaveRequestMutation,
  useLeaveRequestsQuery,
  useRefuseLeaveRequestMutation,
  useTeamCalendarQuery,
} from '@/hooks/useLeaves';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/lib/permissions';
import { LEAVE_STATUS_VARIANT } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { LeaveStatus } from '@/types';

const ALL = '__all__';

function RefuseDialog({ requestId }: { requestId: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const refuseMutation = useRefuseLeaveRequestMutation();

  const handleRefuse = async () => {
    if (!user || !comment.trim()) return;
    try {
      await refuseMutation.mutateAsync({ id: requestId, reviewedBy: user.email, comment });
      toast.success(t('leaves.refuseRequest'));
      setOpen(false);
      setComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du refus');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leaves.refuseRequest')}</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder={t('leaves.validationComment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <DialogFooter>
          <Button variant="destructive" onClick={handleRefuse} disabled={!comment.trim() || refuseMutation.isPending}>
            {t('app.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeavesListPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState(ALL);

  const isCompanyWide = user ? hasPermission(user.role, 'leaves:write') : false;
  const listParams = useMemo(
    () => ({
      status: status !== ALL ? (status as LeaveStatus) : undefined,
      managerId: !isCompanyWide ? user?.employeeId : undefined,
    }),
    [status, isCompanyWide, user?.employeeId]
  );

  const { data: requests, isLoading } = useLeaveRequestsQuery(listParams);
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: teamCalendar } = useTeamCalendarQuery(user?.employeeId);
  const approveMutation = useApproveLeaveRequestMutation();

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      await approveMutation.mutateAsync({ id, reviewedBy: user.email });
      toast.success(t('leaves.validateRequest'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation');
    }
  };

  const sorted = [...(requests ?? [])].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('leaves.title')}</h1>
          {!isCompanyWide && <p className="text-sm text-muted-foreground">{t('leaves.teamCalendar')}</p>}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('app.status')}</SelectItem>
            <SelectItem value="en_attente">{t('leaves.status_en_attente')}</SelectItem>
            <SelectItem value="valide">{t('leaves.status_valide')}</SelectItem>
            <SelectItem value="refuse">{t('leaves.status_refuse')}</SelectItem>
            <SelectItem value="annule">{t('leaves.status_annule')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t('leaves.pendingRequests')}</TabsTrigger>
          <TabsTrigger value="tracking">{t('leaves.balanceTracking')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('leaves.departmentCalendar')}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('leaves.pendingRequests')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('leaves.noRequests')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employees.fullName')}</TableHead>
                  <TableHead>{t('leaves.leaveType')}</TableHead>
                  <TableHead>{t('leaves.startDate')}</TableHead>
                  <TableHead>{t('leaves.endDate')}</TableHead>
                  <TableHead>{t('leaves.days')}</TableHead>
                  <TableHead>{t('leaves.channel')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <PermissionGate permission="leaves:approve">
                    <TableHead className="text-right">{t('app.actions')}</TableHead>
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{employeeName(req.employeeId)}</TableCell>
                    <TableCell>{t(`leaves.type_${req.type}`)}</TableCell>
                    <TableCell>{formatDate(req.startDate)}</TableCell>
                    <TableCell>{formatDate(req.endDate)}</TableCell>
                    <TableCell>{req.daysCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`leaves.channel_${req.channel}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEAVE_STATUS_VARIANT[req.status]}>{t(`leaves.status_${req.status}`)}</Badge>
                    </TableCell>
                    <PermissionGate permission="leaves:approve">
                      <TableCell className="text-right">
                        {req.status === 'en_attente' && (
                          <div className="flex justify-end gap-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Check className="h-4 w-4 text-primary" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('leaves.validateRequest')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {employeeName(req.employeeId)} — {t(`leaves.type_${req.type}`)} — {req.daysCount}{' '}
                                    {t('leaves.days')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleApprove(req.id)}>
                                    {t('app.confirm')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <RefuseDialog requestId={req.id} />
                          </div>
                        )}
                      </TableCell>
                    </PermissionGate>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!!teamCalendar?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('leaves.teamCalendar')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamCalendar.map((req) => (
              <div key={req.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <span className="font-medium">{employeeName(req.employeeId)}</span>
                <span className="text-muted-foreground">{t(`leaves.type_${req.type}`)}</span>
                <span>
                  {formatDate(req.startDate)} → {formatDate(req.endDate)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="tracking">
          <LeaveBalanceTracking />
        </TabsContent>

        <TabsContent value="calendar">
          <TeamLeaveCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
