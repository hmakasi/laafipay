import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/lib/permissions';
import { REVIEW_STATUS_VARIANT } from '@/lib/constants';
import {
  useCompleteReviewMutation,
  useReviewQuery,
  useSubmitManagerAssessmentMutation,
  useSubmitSelfAssessmentMutation,
} from '@/hooks/useReviews';
import { PerformanceReview } from '@/types';

export function ReviewFormDialog({
  review,
  open,
  onOpenChange,
  employeeName,
}: {
  review: PerformanceReview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const submitSelf = useSubmitSelfAssessmentMutation();
  const submitManager = useSubmitManagerAssessmentMutation();
  const complete = useCompleteReviewMutation();
  // Suit les mutations (soumettre son auto-évaluation puis, dans la même
  // session de dialogue, voir "Marquer terminé" s'activer) — la prop
  // `review` initiale ne bouge pas toute seule après une invalidation
  // react-query, seul ce hook le fait.
  const { data: liveReview } = useReviewQuery(review.id);
  const current = liveReview ?? review;

  const [objectives, setObjectives] = useState(review.objectives ?? '');
  const [selfAssessment, setSelfAssessment] = useState(review.selfAssessment ?? '');
  const [selfRating, setSelfRating] = useState(String(review.selfRating ?? ''));
  const [managerAssessment, setManagerAssessment] = useState(review.managerAssessment ?? '');
  const [managerRating, setManagerRating] = useState(String(review.managerRating ?? ''));
  const [nextObjectives, setNextObjectives] = useState(review.nextObjectives ?? '');

  const cycleOpen = current.cycle.status === 'ouvert';
  const role = user?.role;

  const canEditSelf =
    !!role &&
    hasPermission(role, 'self:reviews') &&
    current.employeeId === user?.employeeId &&
    cycleOpen &&
    !current.managerSubmittedAt;

  const canEditManager =
    !!role &&
    (hasPermission(role, 'reviews:write') ||
      (hasPermission(role, 'reviews:manage_team') && current.managerId === user?.employeeId)) &&
    cycleOpen;

  const canComplete = canEditManager && !!current.selfSubmittedAt && !!current.managerSubmittedAt && current.status !== 'termine';

  const handleSubmitSelf = async () => {
    const rating = Number(selfRating);
    if (!selfAssessment || !rating) return;
    try {
      await submitSelf.mutateAsync({ id: review.id, data: { objectives: objectives || undefined, selfAssessment, selfRating: rating } });
      toast.success(t('reviews.submitSelfAssessment'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleSubmitManager = async () => {
    const rating = Number(managerRating);
    if (!managerAssessment || !rating) return;
    try {
      await submitManager.mutateAsync({
        id: review.id,
        data: { managerAssessment, managerRating: rating, nextObjectives: nextObjectives || undefined },
      });
      toast.success(t('reviews.submitManagerAssessment'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleComplete = async () => {
    try {
      await complete.mutateAsync(review.id);
      toast.success(t('reviews.markComplete'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la clôture de l\'entretien');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>
              {t('reviews.fillReview')} — {employeeName}
            </span>
            <Badge variant={REVIEW_STATUS_VARIANT[current.status]}>{t(`reviews.reviewStatus_${current.status}`)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-sm font-semibold">{t('reviews.selfAssessment')}</h3>
            <div className="space-y-2">
              <Label>{t('reviews.objectives')}</Label>
              <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} disabled={!canEditSelf} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t('reviews.selfAssessment')}</Label>
              <Textarea
                value={selfAssessment}
                onChange={(e) => setSelfAssessment(e.target.value)}
                disabled={!canEditSelf}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reviews.selfRating')}</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={selfRating}
                onChange={(e) => setSelfRating(e.target.value)}
                disabled={!canEditSelf}
                className="w-24"
              />
            </div>
            {canEditSelf && (
              <Button size="sm" onClick={handleSubmitSelf} disabled={!selfAssessment || !selfRating || submitSelf.isPending}>
                {t('reviews.submitSelfAssessment')}
              </Button>
            )}
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-sm font-semibold">{t('reviews.managerAssessment')}</h3>
            <div className="space-y-2">
              <Label>{t('reviews.managerAssessment')}</Label>
              <Textarea
                value={managerAssessment}
                onChange={(e) => setManagerAssessment(e.target.value)}
                disabled={!canEditManager}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reviews.managerRating')}</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={managerRating}
                onChange={(e) => setManagerRating(e.target.value)}
                disabled={!canEditManager}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reviews.nextObjectives')}</Label>
              <Textarea
                value={nextObjectives}
                onChange={(e) => setNextObjectives(e.target.value)}
                disabled={!canEditManager}
                rows={3}
              />
            </div>
            {canEditManager && (
              <Button
                size="sm"
                onClick={handleSubmitManager}
                disabled={!managerAssessment || !managerRating || submitManager.isPending}
              >
                {t('reviews.submitManagerAssessment')}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          {canComplete && (
            <Button onClick={handleComplete} disabled={complete.isPending}>
              {t('reviews.markComplete')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
