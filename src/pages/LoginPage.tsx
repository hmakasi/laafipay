import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { DEMO_USERS } from '@/mocks/users';
import { getInitials } from '@/lib/utils';

// Mot de passe des comptes de démonstration seedés côté serveur (server/prisma/seed.ts).
const DEMO_PASSWORD = 'Demo1234!';

const loginSchema = z.object({
  email: z.string().min(1, 'Champ requis').email('Adresse e-mail invalide'),
  password: z.string().min(4, 'Le mot de passe doit contenir au moins 4 caractères'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      toast.success(t('auth.loginSuccess'));
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error(t('auth.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (userId: string) => {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) return;
    try {
      await login(user.email, DEMO_PASSWORD);
      toast.success(t('auth.loginSuccess'));
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error(t('auth.invalidCredentials'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">{t('app.name')}</CardTitle>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('auth.signingIn') : t('auth.login')}
              </Button>
            </form>
          </Form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              {t('auth.demoRole')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {DEMO_USERS.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleDemoLogin(user.id)}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {getInitials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span className="block font-medium leading-none">
                    {user.firstName} {user.lastName}
                  </span>
                  <Badge variant="accent">{t(`roles.${user.role}`)}</Badge>
                </span>
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              {t('auth.createCompany')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
