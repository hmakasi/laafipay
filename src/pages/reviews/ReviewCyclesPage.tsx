import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useCreateReviewCycleMutation, useReviewCyclesQuery } from '@/hooks/useReviews';
import { REVIEW_CYCLE_STATUS_VARIANT } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export function ReviewCyclesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: cycles, isLoading } = useReviewCyclesQuery();
  const createMutation = useCreateReviewCycleMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const sorted = [...(cycles ?? [])].sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));

  const resetForm = () => {
    setName('');
    setYear(String(new Date().getFullYear()));
    setStartDate('');
    setEndDate('');
  };

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) return;
    try {
      const created = await createMutation.mutateAsync({ name, year: Number(year), startDate, endDate });
      setOpen(false);
      resetForm();
      navigate(`/reviews/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création du cycle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('reviews.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reviews.cycles')}</p>
        </div>
        <PermissionGate permission="reviews:write">
          <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('reviews.createCycle')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('reviews.createCycle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="review-cycle-name">{t('reviews.cycleName')}</Label>
                  <Input id="review-cycle-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-cycle-year">{t('reviews.year')}</Label>
                  <Input
                    id="review-cycle-year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="review-cycle-start">{t('reviews.startDate')}</Label>
                    <Input
                      id="review-cycle-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-cycle-end">{t('reviews.endDate')}</Label>
                    <Input id="review-cycle-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!name || !startDate || !endDate || createMutation.isPending}>
                  {t('app.confirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reviews.cycles')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('reviews.noCycles')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reviews.cycleName')}</TableHead>
                  <TableHead>{t('reviews.year')}</TableHead>
                  <TableHead>{t('reviews.startDate')}</TableHead>
                  <TableHead>{t('reviews.endDate')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((cycle) => (
                  <TableRow key={cycle.id} className="cursor-pointer" onClick={() => navigate(`/reviews/${cycle.id}`)}>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell>{cycle.year}</TableCell>
                    <TableCell>{formatDate(cycle.startDate)}</TableCell>
                    <TableCell>{formatDate(cycle.endDate)}</TableCell>
                    <TableCell>
                      <Badge variant={REVIEW_CYCLE_STATUS_VARIANT[cycle.status]}>{t(`reviews.status_${cycle.status}`)}</Badge>
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
