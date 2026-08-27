import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/store/authStore';
import { useReviewsQuery } from '@/hooks/useReviews';
import { REVIEW_STATUS_VARIANT } from '@/lib/constants';
import { PerformanceReview } from '@/types';
import { ReviewFormDialog } from '@/pages/reviews/ReviewFormDialog';

export function MyReviewsTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: reviews, isLoading } = useReviewsQuery({ employeeId: user?.employeeId });
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);

  const sorted = [...(reviews ?? [])].sort((a, b) => b.cycle.year - a.cycle.year);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('nav.myReviews')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('reviews.noReviews')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reviews.cycleName')}</TableHead>
                  <TableHead>{t('reviews.year')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.cycle.name}</TableCell>
                    <TableCell>{review.cycle.year}</TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_STATUS_VARIANT[review.status]}>{t(`reviews.reviewStatus_${review.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditingReview(review)}>
                        {t('reviews.fillReview')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingReview && user && (
        <ReviewFormDialog
          review={editingReview}
          employeeName={`${user.firstName} ${user.lastName}`}
          open={!!editingReview}
          onOpenChange={(open) => !open && setEditingReview(null)}
        />
      )}
    </div>
  );
}
