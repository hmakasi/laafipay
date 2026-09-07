import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { resetPassword } from '@/services/api/auth';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Champ requis'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await resetPassword(token, values.newPassword);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.resetPasswordInvalidLink'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">{t('auth.resetPasswordTitle')}</CardTitle>
          {!done && <CardDescription>{t('auth.resetPasswordSubtitle')}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {!done && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.newPassword')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {t('auth.resetPasswordSubmit')}
                </Button>
              </form>
            </Form>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="font-medium text-foreground">{t('auth.resetPasswordSuccess')}</p>
              <p className="text-sm text-muted-foreground">{t('auth.resetPasswordSuccessDetail')}</p>
              <Button className="mt-2" onClick={() => navigate('/login', { replace: true })}>
                {t('auth.backToLogin')}
              </Button>
            </div>
          )}

          {!done && (
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
