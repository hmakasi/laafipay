import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Lock, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { usePayrollConfigQuery, useUpdatePayrollConfigMutation } from '@/hooks/usePayrollConfig';
import { MANDATORY_RUBRIC_KEYS, OPTIONAL_RUBRIC_CATEGORIES as OPTIONAL_CATEGORIES } from '@/lib/payrollRubrics';

interface CustomRubric {
  id: string;
  label: string;
  taxable: boolean;
  cnssContributable: boolean;
}

const customRubricSchema = z.object({
  label: z.string().min(1, 'Champ requis'),
  taxable: z.boolean(),
  cnssContributable: z.boolean(),
});

type CustomRubricFormValues = z.infer<typeof customRubricSchema>;

export function PayrollComponentsSetup() {
  const { t } = useTranslation();
  const { data: savedConfig, isLoading } = usePayrollConfigQuery();
  const [activeOptional, setActiveOptional] = useState<Set<string>>(new Set());
  const [customRubrics, setCustomRubrics] = useState<CustomRubric[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const saveMutation = useUpdatePayrollConfigMutation();
  const hydrated = useRef(false);

  // Hydrate une seule fois depuis la config déjà enregistrée (GET) — sans
  // ce garde, un refetch en arrière-plan écraserait les cases à peine
  // cochées par l'utilisateur pendant qu'il configure l'écran.
  useEffect(() => {
    if (hydrated.current || !savedConfig) return;
    hydrated.current = true;
    const mandatoryKeys: readonly string[] = MANDATORY_RUBRIC_KEYS;
    setActiveOptional(new Set(savedConfig.activeRubrics.filter((key) => !mandatoryKeys.includes(key))));
    setCustomRubrics(savedConfig.customRubrics.map((r, i) => ({ id: `saved-${i}`, ...r })));
  }, [savedConfig]);

  const form = useForm<CustomRubricFormValues>({
    resolver: zodResolver(customRubricSchema),
    defaultValues: { label: '', taxable: true, cnssContributable: true },
  });

  const toggleOptional = (key: string) => {
    setActiveOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAddCustomRubric = (values: CustomRubricFormValues) => {
    setCustomRubrics((prev) => [...prev, { id: `custom-${Date.now()}`, ...values }]);
    form.reset({ label: '', taxable: true, cnssContributable: true });
    setDialogOpen(false);
  };

  const removeCustomRubric = (id: string) => {
    setCustomRubrics((prev) => prev.filter((r) => r.id !== id));
  };

  // Rubriques du catalogue actives (obligatoires + optionnelles cochées),
  // sous la forme exacte attendue par l'API : activeRubrics: string[].
  const activeRubrics: string[] = [...MANDATORY_RUBRIC_KEYS, ...Array.from(activeOptional)];

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        activeRubrics,
        customRubrics: customRubrics.map(({ label, taxable, cnssContributable }) => ({
          label,
          taxable,
          cnssContributable,
        })),
      });
      toast.success(t('payroll.componentsSetup.saveSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('payroll.componentsSetup.saveError'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('payroll.componentsSetup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('payroll.componentsSetup.subtitle')}</p>
      </div>

      {/* Section 1 — Éléments obligatoires (verrouillés) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payroll.componentsSetup.mandatorySection.title')}</CardTitle>
          <CardDescription>{t('payroll.componentsSetup.mandatorySection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {MANDATORY_RUBRIC_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t(`payroll.componentsSetup.mandatoryRubrics.${key}`)}
                </span>
              </div>
              <Badge variant="secondary">{t('payroll.componentsSetup.mandatorySection.badge')}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 2 — Avantages & primes optionnels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payroll.componentsSetup.optionalSection.title')}</CardTitle>
          <CardDescription>{t('payroll.componentsSetup.optionalSection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {OPTIONAL_CATEGORIES.map((category) => (
            <div key={category.key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`payroll.componentsSetup.categories.${category.key}.title`)}
              </h3>
              <div className="space-y-2">
                {category.rubricKeys.map((rubricKey) => {
                  const inputId = `rubric-${rubricKey}`;
                  return (
                    <div key={rubricKey} className="flex items-center justify-between rounded-md border px-4 py-3">
                      <div>
                        <Label htmlFor={inputId} className="text-sm font-medium text-foreground">
                          {t(`payroll.componentsSetup.categories.${category.key}.rubrics.${rubricKey}`)}
                        </Label>
                        {rubricKey === 'healthInsurance' && (
                          <p className="text-xs text-muted-foreground">
                            {t('payroll.componentsSetup.healthInsuranceHint')}
                          </p>
                        )}
                      </div>
                      <Switch
                        id={inputId}
                        checked={activeOptional.has(rubricKey)}
                        onCheckedChange={() => toggleOptional(rubricKey)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3 — Création de rubrique sur-mesure */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('payroll.componentsSetup.customSection.title')}</CardTitle>
            <CardDescription>{t('payroll.componentsSetup.customSection.description')}</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t('payroll.componentsSetup.customSection.addButton')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('payroll.componentsSetup.customDialog.title')}</DialogTitle>
                <DialogDescription>{t('payroll.componentsSetup.customDialog.description')}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddCustomRubric)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('payroll.componentsSetup.customDialog.labelField')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('payroll.componentsSetup.customDialog.labelPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between space-y-0 rounded-md border px-4 py-3">
                        <FormLabel>{t('payroll.componentsSetup.customDialog.taxable')}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cnssContributable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between space-y-0 rounded-md border px-4 py-3">
                        <FormLabel>{t('payroll.componentsSetup.customDialog.cnssContributable')}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      {t('payroll.componentsSetup.customDialog.cancel')}
                    </Button>
                    <Button type="submit">{t('payroll.componentsSetup.customDialog.submit')}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {customRubrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('payroll.componentsSetup.customSection.empty')}</p>
          ) : (
            <div className="space-y-2">
              {customRubrics.map((rubric) => (
                <div key={rubric.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-foreground">{rubric.label}</span>
                    <div className="mt-1 flex gap-2">
                      <Badge variant={rubric.taxable ? 'default' : 'secondary'}>
                        {rubric.taxable
                          ? t('payroll.componentsSetup.customSection.taxableYes')
                          : t('payroll.componentsSetup.customSection.taxableNo')}
                      </Badge>
                      <Badge variant={rubric.cnssContributable ? 'default' : 'secondary'}>
                        {rubric.cnssContributable
                          ? t('payroll.componentsSetup.customSection.cnssYes')
                          : t('payroll.componentsSetup.customSection.cnssNo')}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomRubric(rubric.id)}
                    aria-label={t('payroll.componentsSetup.customSection.remove')}
                  >
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
          {saveMutation.isPending ? t('payroll.componentsSetup.saving') : t('payroll.componentsSetup.save')}
        </Button>
      </div>
    </div>
  );
}
