import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useReviewConfigQuery, useUpdateReviewConfigMutation } from '@/hooks/useReviews';

export function ReviewCompetenciesSetupPage() {
  const { t } = useTranslation();
  const { data: savedConfig, isLoading } = useReviewConfigQuery();
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [newCompetency, setNewCompetency] = useState('');
  const saveMutation = useUpdateReviewConfigMutation();
  const hydrated = useRef(false);

  // Hydrate une seule fois depuis la config enregistrée — même garde que
  // PayrollComponentsSetup.tsx, sinon un refetch en arrière-plan écraserait
  // les modifications en cours pendant que l'utilisateur édite l'écran.
  useEffect(() => {
    if (hydrated.current || !savedConfig) return;
    hydrated.current = true;
    setCompetencies(savedConfig.competencies);
  }, [savedConfig]);

  const addCompetency = () => {
    const label = newCompetency.trim();
    if (!label || competencies.includes(label)) return;
    setCompetencies((prev) => [...prev, label]);
    setNewCompetency('');
  };

  const removeCompetency = (label: string) => {
    setCompetencies((prev) => prev.filter((c) => c !== label));
  };

  const handleSave = async () => {
    if (!competencies.length) {
      toast.error(t('reviews.competenciesSetup.emptyError'));
      return;
    }
    try {
      await saveMutation.mutateAsync(competencies);
      toast.success(t('reviews.competenciesSetup.saveSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reviews.competenciesSetup.saveError'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('reviews.competenciesSetup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('reviews.competenciesSetup.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('reviews.competenciesSetup.listTitle')}</CardTitle>
          <CardDescription>{t('reviews.competenciesSetup.listDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCompetency}
              onChange={(e) => setNewCompetency(e.target.value)}
              placeholder={t('reviews.competenciesSetup.addPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCompetency())}
            />
            <Button type="button" variant="outline" onClick={addCompetency}>
              <Plus className="mr-2 h-4 w-4" />
              {t('reviews.competenciesSetup.addButton')}
            </Button>
          </div>

          {competencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('reviews.competenciesSetup.empty')}</p>
          ) : (
            <div className="space-y-2">
              {competencies.map((c) => (
                <div key={c} className="flex items-center justify-between rounded-md border px-4 py-3">
                  <span className="text-sm font-medium text-foreground">{c}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeCompetency(c)} aria-label={t('app.delete')}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('reviews.competenciesSetup.saving') : t('reviews.competenciesSetup.save')}
        </Button>
      </div>
    </div>
  );
}
