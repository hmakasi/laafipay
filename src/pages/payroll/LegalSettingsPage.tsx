import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthStore } from '@/store/authStore';
import { useCreateLegalSettingsMutation, useLegalSettingsQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { formatCurrency, formatDate } from '@/lib/utils';

const bracketSchema = z.object({
  min: z.coerce.number().min(0),
  max: z.coerce.number().nullable(),
  rate: z.coerce.number().min(0).max(100),
  deduction: z.coerce.number().min(0),
});

const legalSettingsSchema = z.object({
  effectiveDate: z.string().min(1, 'Champ requis'),
  smig: z.coerce.number().positive(),
  cnssEmployeeRate: z.coerce.number().min(0).max(100),
  cnssEmployerRate: z.coerce.number().min(0).max(100),
  iutsBrackets: z.array(bracketSchema).min(1),
});

type LegalSettingsFormValues = z.infer<typeof legalSettingsSchema>;

export function LegalSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: settings, isLoading } = useLegalSettingsQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const createMutation = useCreateLegalSettingsMutation();
  const [open, setOpen] = useState(false);

  const current = settings?.[0];

  const form = useForm<LegalSettingsFormValues>({
    resolver: zodResolver(legalSettingsSchema),
    // Une tranche vide par défaut : sans elle, une première entreprise (sans
    // barème existant) ouvrait le dialogue avec 0 tranche et devait deviner
    // qu'il fallait cliquer "Ajouter une tranche" avant de pouvoir enregistrer.
    defaultValues: { effectiveDate: '', smig: 0, cnssEmployeeRate: 0, cnssEmployerRate: 0, iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }] },
    values: current
      ? {
          effectiveDate: new Date().toISOString().split('T')[0],
          smig: current.smig,
          cnssEmployeeRate: current.cnssEmployeeRate,
          cnssEmployerRate: current.cnssEmployerRate,
          iutsBrackets: current.iutsBrackets.map((b) => ({ ...b, max: b.max })),
        }
      : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'iutsBrackets' });

  const onSubmit = async (values: LegalSettingsFormValues) => {
    if (!user) return;
    try {
      await createMutation.mutateAsync({ ...values, createdBy: user.email });
      toast.success(t('app.save'));
      setOpen(false);
    } catch (err) {
      // Sans ce catch, un rejet (ex. 403 "Permission refusée" pour un rôle
      // sans payroll:settings, ou une erreur de validation) ne remontait
      // nulle part : le clic sur Enregistrer semblait ne rien faire.
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement du barème légal');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('app.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('payroll.legalSettings')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <FormField control={form.control} name="effectiveDate" render={({ field }) => (
                    <FormItem><FormLabel>Date d'effet</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="smig" render={({ field }) => (
                    <FormItem><FormLabel>{t('payroll.smig')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cnssEmployeeRate" render={({ field }) => (
                    <FormItem><FormLabel>{t('payroll.cnssEmployee')} (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cnssEmployerRate" render={({ field }) => (
                    <FormItem><FormLabel>{t('payroll.cnssEmployer')} (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <FormLabel>Tranches IUTS</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ min: 0, max: null, rate: 0, deduction: 0 })}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Ajouter une tranche
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-5 items-end gap-2">
                        <FormField control={form.control} name={`iutsBrackets.${index}.min`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Min</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`iutsBrackets.${index}.max`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Max</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`iutsBrackets.${index}.rate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Taux %</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`iutsBrackets.${index}.deduction`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Abattement</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {/* Erreur "au moins une tranche requise" (z.array().min(1)) —
                     sans ce message, un clic sur Enregistrer sans avoir jamais
                     cliqué "Ajouter une tranche" échouait la validation côté
                     client en silence : le bouton semblait ne rien faire, la
                     requête n'était même pas envoyée au serveur. */}
                  {form.formState.errors.iutsBrackets?.message && (
                    <p className="mt-2 text-sm font-medium text-destructive">
                      {form.formState.errors.iutsBrackets.message as string}
                    </p>
                  )}
                  {fields.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ajoutez au moins une tranche d'imposition avant d'enregistrer.
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {t('app.save')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.legalSettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date d'effet</TableHead>
                  <TableHead>{t('payroll.smig')}</TableHead>
                  <TableHead>{t('payroll.cnssEmployee')}</TableHead>
                  <TableHead>{t('payroll.cnssEmployer')}</TableHead>
                  <TableHead>Tranches IUTS</TableHead>
                  <TableHead>Créé par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.effectiveDate)}</TableCell>
                    <TableCell>{formatCurrency(s.smig, currencyCode)}</TableCell>
                    <TableCell>{s.cnssEmployeeRate}%</TableCell>
                    <TableCell>{s.cnssEmployerRate}%</TableCell>
                    <TableCell>{s.iutsBrackets.length}</TableCell>
                    <TableCell className="text-muted-foreground">{s.createdBy}</TableCell>
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
