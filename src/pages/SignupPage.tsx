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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { COUNTRY_CODES, COUNTRY_META } from '@/lib/constants';
import { CountryCode } from '@/types';

const signupSchema = z.object({
  companyName: z.string().min(1, 'Champ requis'),
  countryCode: z.enum(['BF', 'BJ', 'CD']),
  currencyCode: z.enum(['XOF', 'CDF', 'USD']),
  firstName: z.string().min(1, 'Champ requis'),
  lastName: z.string().min(1, 'Champ requis'),
  email: z.string().min(1, 'Champ requis').email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signup = useAuthStore((s) => s.signup);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: '',
      countryCode: 'BF',
      currencyCode: COUNTRY_META.BF.defaultCurrency,
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  const countryCode = form.watch('countryCode');
  const countryMeta = COUNTRY_META[countryCode];
  // Seule la RDC propose un choix de devise (CDF/USD) — BF et BJ imposent XOF.
  const currencyIsChoosable = countryMeta.currencies.length > 1;

  const handleCountryChange = (value: string) => {
    const nextCountry = value as CountryCode;
    form.setValue('countryCode', nextCountry);
    form.setValue('currencyCode', COUNTRY_META[nextCountry].defaultCurrency);
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      await signup({
        companyName: values.companyName,
        countryCode: values.countryCode,
        currencyCode: values.currencyCode,
        admin: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        },
      });
      toast.success(t('auth.signupSuccess'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.emailAlreadyUsed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">{t('app.name')}</CardTitle>
          <CardDescription>{t('auth.createCompany')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.companyName')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme SARL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays d'implantation fiscal</FormLabel>
                    <Select value={field.value} onValueChange={handleCountryChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRY_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            <span className="mr-2">{COUNTRY_META[code].flag}</span>
                            {COUNTRY_META[code].name}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({COUNTRY_META[code].defaultCurrency})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sous-champ conditionnel : seule la RDC laisse choisir la devise
                 de gestion de la paie entre le franc congolais et le dollar. */}
              {currencyIsChoosable && (
                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem className="rounded-md border border-dashed p-3">
                      <FormLabel>Devise de gestion de la paie</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex gap-6 pt-1"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="CDF" id="currency-cdf" />
                            <Label htmlFor="currency-cdf" className="font-normal">
                              CDF — Franc Congolais
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="USD" id="currency-usd" />
                            <Label htmlFor="currency-usd" className="font-normal">
                              USD — Dollar Américain
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="relative pt-2">
                <Separator />
                <span className="absolute left-1/2 top-1 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  {t('auth.adminAccount')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('employees.firstName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('employees.lastName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={`nom@entreprise.${countryCode.toLowerCase()}`} {...field} />
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
                {isSubmitting ? t('auth.signingUp') : t('auth.signup')}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
