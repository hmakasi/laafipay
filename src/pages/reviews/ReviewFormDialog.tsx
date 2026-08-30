import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/lib/permissions';
import { REVIEW_STATUS_VARIANT } from '@/lib/constants';
import {
  useCompleteReviewMutation,
  useReviewConfigQuery,
  useReviewQuery,
  useSubmitManagerAssessmentMutation,
  useSubmitSelfAssessmentMutation,
} from '@/hooks/useReviews';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { usePeerFeedbackRequestsQuery, useRequestPeerFeedbackMutation } from '@/hooks/usePeerFeedback';
import { CompetencyRating, PerformanceReview } from '@/types';

function CompetencyRatingInputs({
  competencies,
  ratings,
  onChange,
  disabled,
}: {
  competencies: string[];
  ratings: Record<string, string>;
  onChange: (competency: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {competencies.map((competency) => (
        <div key={competency} className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">{competency}</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={ratings[competency] ?? ''}
            onChange={(e) => onChange(competency, e.target.value)}
            disabled={disabled}
            className="w-20"
          />
        </div>
      ))}
    </div>
  );
}

// Convertit competencyRatings (déjà soumis) en Record<competency, string> pour
// hydrater les inputs contrôlés ; competencies (config entreprise, source de
// vérité pour ce qui doit être noté) fournit les clés manquantes à vide.
function hydrateRatings(competencies: string[], saved: CompetencyRating[] | undefined): Record<string, string> {
  const byCompetency = new Map((saved ?? []).map((r) => [r.competency, String(r.rating)]));
  return Object.fromEntries(competencies.map((c) => [c, byCompetency.get(c) ?? '']));
}

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
  const { data: reviewConfig } = useReviewConfigQuery();
  const competencies = reviewConfig?.competencies ?? [];

  const [objectives, setObjectives] = useState(review.objectives ?? '');
  const [selfAssessment, setSelfAssessment] = useState(review.selfAssessment ?? '');
  const [selfRatings, setSelfRatings] = useState<Record<string, string>>(
    hydrateRatings(competencies, review.selfCompetencyRatings)
  );
  const [managerAssessment, setManagerAssessment] = useState(review.managerAssessment ?? '');
  const [managerRatings, setManagerRatings] = useState<Record<string, string>>(
    hydrateRatings(competencies, review.managerCompetencyRatings)
  );
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

  // Même contrôle d'accès que canAccessReview/canManageAsManager côté
  // serveur (server/src/routes/reviews.routes.ts + peerFeedback.routes.ts) —
  // ici seulement pour l'affichage, le serveur reste la seule autorité réelle.
  const canRequestPeer = cycleOpen && (canEditSelf || canEditManager);
  const canViewPeer = canEditManager || (!!role && hasPermission(role, 'reviews:write'));

  const ratingsToArray = (ratings: Record<string, string>): CompetencyRating[] =>
    competencies
      .map((competency) => ({ competency, rating: Number(ratings[competency]) }))
      .filter((r) => r.rating >= 1 && r.rating <= 5);

  const selfRatingsComplete = ratingsToArray(selfRatings).length === competencies.length && competencies.length > 0;
  const managerRatingsComplete = ratingsToArray(managerRatings).length === competencies.length && competencies.length > 0;

  const handleSubmitSelf = async () => {
    if (!selfAssessment || !selfRatingsComplete) return;
    try {
      await submitSelf.mutateAsync({
        id: review.id,
        data: { objectives: objectives || undefined, selfAssessment, competencyRatings: ratingsToArray(selfRatings) },
      });
      toast.success(t('reviews.submitSelfAssessment'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleSubmitManager = async () => {
    if (!managerAssessment || !managerRatingsComplete) return;
    try {
      await submitManager.mutateAsync({
        id: review.id,
        data: {
          managerAssessment,
          competencyRatings: ratingsToArray(managerRatings),
          nextObjectives: nextObjectives || undefined,
        },
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
              <Label>{t('reviews.competencyRatings')}</Label>
              <CompetencyRatingInputs
                competencies={competencies}
                ratings={selfRatings}
                onChange={(c, v) => setSelfRatings((prev) => ({ ...prev, [c]: v }))}
                disabled={!canEditSelf}
              />
            </div>
            {canEditSelf && (
              <Button size="sm" onClick={handleSubmitSelf} disabled={!selfAssessment || !selfRatingsComplete || submitSelf.isPending}>
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
              <Label>{t('reviews.competencyRatings')}</Label>
              <CompetencyRatingInputs
                competencies={competencies}
                ratings={managerRatings}
                onChange={(c, v) => setManagerRatings((prev) => ({ ...prev, [c]: v }))}
                disabled={!canEditManager}
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
                disabled={!managerAssessment || !managerRatingsComplete || submitManager.isPending}
              >
                {t('reviews.submitManagerAssessment')}
              </Button>
            )}
          </div>

          {(canRequestPeer || canViewPeer) && (
            <PeerFeedbackSection review={current} canRequest={canRequestPeer} canView={canViewPeer} />
          )}
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

function PeerFeedbackSection({
  review,
  canRequest,
  canView,
}: {
  review: PerformanceReview;
  canRequest: boolean;
  canView: boolean;
}) {
  const { t } = useTranslation();
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: requests } = usePeerFeedbackRequestsQuery(canView ? review.id : undefined);
  const requestMutation = useRequestPeerFeedbackMutation();
  const [selectedPeerId, setSelectedPeerId] = useState<string>('');

  const candidates = (employeesPage?.data ?? []).filter((e) => e.id !== review.employeeId);
  const employeeName_ = (id: string) => {
    const emp = employeesPage?.data.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

  const handleRequest = async () => {
    if (!selectedPeerId) return;
    try {
      await requestMutation.mutateAsync({ reviewId: review.id, peerEmployeeId: selectedPeerId });
      toast.success(t('reviews.peerFeedback.requested'));
      setSelectedPeerId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la demande d'avis");
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{t('reviews.peerFeedback.title')}</h3>
      {!canView && (
        <p className="text-xs text-muted-foreground">{t('reviews.peerFeedback.hiddenFromReviewee')}</p>
      )}

      {canRequest && (
        <div className="flex gap-2">
          <Select value={selectedPeerId} onValueChange={setSelectedPeerId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('reviews.peerFeedback.selectPeer')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleRequest} disabled={!selectedPeerId || requestMutation.isPending}>
            {t('reviews.peerFeedback.request')}
          </Button>
        </div>
      )}

      {canView && (
        <div className="space-y-2">
          {!requests?.length ? (
            <p className="text-xs text-muted-foreground">{t('reviews.peerFeedback.none')}</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{employeeName_(r.peerEmployeeId)}</span>
                  <Badge variant={r.submittedAt ? 'success' : 'secondary'}>
                    {r.submittedAt ? t('reviews.peerFeedback.submitted') : t('reviews.peerFeedback.pending')}
                  </Badge>
                </div>
                {r.feedback && <p className="mt-1 text-muted-foreground">{r.feedback}</p>}
                {r.rating && <p className="mt-1 text-xs text-muted-foreground">{t('reviews.peerFeedback.rating')}: {r.rating}/5</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
