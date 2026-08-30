import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMyPeerFeedbackRequestsQuery, useSubmitPeerFeedbackMutation } from '@/hooks/usePeerFeedback';
import { MyPeerFeedbackRequest } from '@/types';

export function PeerFeedbackTab() {
  const { t } = useTranslation();
  const { data: requests, isLoading } = useMyPeerFeedbackRequestsQuery();
  const [answering, setAnswering] = useState<MyPeerFeedbackRequest | null>(null);

  const sorted = [...(requests ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reviews.peerFeedback.myRequestsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('reviews.peerFeedback.noRequestsForMe')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reviews.peerFeedback.reviewee')}</TableHead>
                  <TableHead>{t('reviews.cycleName')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.revieweeName}</TableCell>
                    <TableCell>
                      {r.cycle.name} ({r.cycle.year})
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.submittedAt ? 'success' : 'secondary'}>
                        {r.submittedAt ? t('reviews.peerFeedback.submitted') : t('reviews.peerFeedback.pending')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!r.submittedAt && r.cycle.status === 'ouvert' && (
                        <Button variant="outline" size="sm" onClick={() => setAnswering(r)}>
                          {t('reviews.peerFeedback.respond')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {answering && <RespondDialog request={answering} onClose={() => setAnswering(null)} />}
    </div>
  );
}

function RespondDialog({ request, onClose }: { request: MyPeerFeedbackRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const submitMutation = useSubmitPeerFeedbackMutation();
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState('');

  const handleSubmit = async () => {
    if (!feedback) return;
    try {
      await submitMutation.mutateAsync({
        id: request.id,
        data: { feedback, rating: rating ? Number(rating) : undefined },
      });
      toast.success(t('reviews.peerFeedback.submitted'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('reviews.peerFeedback.respondTo')} {request.revieweeName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('reviews.peerFeedback.feedback')}</Label>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} />
          </div>
          <div className="space-y-2">
            <Label>{t('reviews.peerFeedback.ratingOptional')}</Label>
            <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} className="w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!feedback || submitMutation.isPending}>
            {t('reviews.peerFeedback.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
