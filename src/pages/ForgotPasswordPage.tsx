import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { forgotPassword } from '@/services/api/auth';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Champ requis').email('Adresse e-mail invalide'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">{t('auth.forgotPasswordTitle')}</CardTitle>
          {!sent && <CardDescription>{t('auth.forgotPasswordSubtitle')}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {!sent && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="nom@entreprise.bf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t('auth.forgotPasswordSending') : t('auth.forgotPasswordSubmit')}
                </Button>
              </form>
            </Form>
          )}

          {sent && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="font-medium text-foreground">{t('auth.forgotPasswordSent')}</p>
              <p className="text-sm text-muted-foreground">{t('auth.forgotPasswordSentDetail')}</p>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
