import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardEdit, Lock, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  useOpenReviewCycleMutation,
  useCloseReviewCycleMutation,
  useReviewCycleQuery,
  useReviewCycleStatsQuery,
  useReviewsQuery,
} from '@/hooks/useReviews';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { REVIEW_CYCLE_STATUS_VARIANT, REVIEW_STATUS_VARIANT } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { PerformanceReview } from '@/types';
import { ReviewFormDialog } from '@/pages/reviews/ReviewFormDialog';

export function ReviewCycleDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: cycle, isLoading } = useReviewCycleQuery(id);
  const { data: reviews, isLoading: loadingReviews } = useReviewsQuery({ cycleId: id });
  const { data: stats } = useReviewCycleStatsQuery(id);
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const openMutation = useOpenReviewCycleMutation();
  const closeMutation = useCloseReviewCycleMutation();
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const handleOpen = async () => {
    if (!id) return;
    try {
      await openMutation.mutateAsync(id);
      toast.success(t('reviews.openCycle'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ouverture du cycle");
    }
  };

  const handleClose = async () => {
    if (!id) return;
    try {
      await closeMutation.mutateAsync(id);
      toast.success(t('reviews.closeCycle'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la clôture du cycle');
    }
  };

  if (isLoading || !cycle) {
    return <Skeleton className="h-96 w-full" />;
  }

  const sortedReviews = [...(reviews ?? [])].sort((a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reviews')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
        <PermissionGate permission="reviews:write">
          <div className="flex gap-2">
            {cycle.status === 'brouillon' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {t('reviews.openCycle')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('reviews.openCycle')}</AlertDialogTitle>
                    <AlertDialogDescription>{cycle.name} — {cycle.year}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleOpen}>{t('app.confirm')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {cycle.status === 'ouvert' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Lock className="mr-2 h-4 w-4" />
                    {t('reviews.closeCycle')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('reviews.closeCycle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {sortedReviews.filter((r) => r.status !== 'termine').length} / {sortedReviews.length} entretiens non terminés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClose}>{t('app.confirm')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{cycle.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {cycle.year} · {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
            </p>
          </div>
          <Badge variant={REVIEW_CYCLE_STATUS_VARIANT[cycle.status]}>{t(`reviews.status_${cycle.status}`)}</Badge>
        </CardHeader>
      </Card>

      {stats && stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('reviews.stats.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md border p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('reviews.stats.completionRate')}</div>
                <div className="text-xl font-semibold text-primary">
                  {Math.round((stats.completed / stats.total) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.completed}/{stats.total}
                </div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('reviews.reviewStatus_en_cours')}</div>
                <div className="text-xl font-semibold">{stats.inProgress}</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('reviews.stats.averageSelfRating')}</div>
                <div className="text-xl font-semibold">{stats.averageSelfRating ?? '—'}</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-xs text-muted-foreground">{t('reviews.stats.averageManagerRating')}</div>
                <div className="text-xl font-semibold">{stats.averageManagerRating ?? '—'}</div>
              </div>
            </div>
            {stats.byDepartment.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t('reviews.stats.byDepartment')}</div>
                {stats.byDepartment.map((d) => (
                  <div key={d.departmentId} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">
                      {d.completed}/{d.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reviews.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReviews ? (
            <Skeleton className="h-48 w-full" />
          ) : !sortedReviews.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('reviews.noReviews')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employees.fullName')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{employeeName(review.employeeId)}</TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_STATUS_VARIANT[review.status]}>{t(`reviews.reviewStatus_${review.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingReview(review)}>
                        <ClipboardEdit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingReview && (
        <ReviewFormDialog
          review={editingReview}
          employeeName={employeeName(editingReview.employeeId)}
          open={!!editingReview}
          onOpenChange={(open) => !open && setEditingReview(null)}
        />
      )}
    </div>
  );
}
