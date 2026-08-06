import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingContextQuery, useSubmitOnboardingMutation } from '@/hooks/useOnboarding';
import { MOBILE_MONEY_OPERATORS } from '@/lib/constants';

const onboardingSchema = z.object({
  cnssNumber: z.string().min(1, 'Champ requis'),
  mobileMoneyOperator: z.enum(['orange', 'moov', 'telecel']),
  mobileMoneyNumber: z.string().min(1, 'Champ requis'),
  mobileMoneyAccount: z.string().min(1, 'Champ requis'),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export function OnboardingPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { data: context, isLoading, isError } = useOnboardingContextQuery(token);
  const submitMutation = useSubmitOnboardingMutation(token ?? '');
  const [document, setDocument] = useState<File | null>(null);
  const [completed, setCompleted] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { cnssNumber: '', mobileMoneyOperator: 'orange', mobileMoneyNumber: '', mobileMoneyAccount: '' },
  });

  const onSubmit = async (values: OnboardingFormValues) => {
    try {
      await submitMutation.mutateAsync({ ...values, document: document ?? undefined });
      setCompleted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('app.error'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">{t('app.name')}</CardTitle>
          <CardDescription>{t('onboarding.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full" />}

          {!isLoading && isError && (
            <p className="text-center text-sm text-destructive">{t('onboarding.invalidLink')}</p>
          )}

          {!isLoading && context && !completed && (
            <div className="space-y-6">
              <p className="text-center text-sm text-muted-foreground">
                {t('onboarding.greeting', { name: `${context.firstName} ${context.lastName}`, company: context.companyName })}
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cnssNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('onboarding.cnssNumber')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobileMoneyOperator"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('onboarding.mobileMoneyOperator')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MOBILE_MONEY_OPERATORS.map((o) => (
                              <SelectItem key={o} value={o}>
                                {t(`employees.operator_${o}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobileMoneyNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('onboarding.mobileMoneyNumber')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobileMoneyAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('onboarding.mobileMoneyAccount')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <FormLabel>{t('onboarding.idDocument')}</FormLabel>
                    <Input type="file" accept="image/*,.pdf" onChange={(e) => setDocument(e.target.files?.[0] ?? null)} />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? t('app.loading') : t('onboarding.submit')}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {completed && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="font-medium text-foreground">{t('onboarding.successTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('onboarding.successDescription')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
