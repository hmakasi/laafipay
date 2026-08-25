import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ImageOff, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentCompanyQuery, useUpdateCompanyMutation, useUploadCompanyLogoMutation } from '@/hooks/useCompanies';
import { COUNTRY_META } from '@/lib/constants';
import { resolveUploadUrl } from '@/lib/apiClient';
import { UpdateCompanyPayload } from '@/services/api/companies';

// Champ texte vide -> undefined, pour ne jamais envoyer une chaîne vide sur
// un champ optionnel (le schéma Zod backend attend "absent", pas "").
function emptyToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const companySettingsSchema = z.object({
  name: z.string().min(1, 'Champ requis'),
  legalName: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email('Adresse e-mail invalide'), z.literal('')]).optional(),
  taxIdNumber: z.string().optional(),
  rccm: z.string().optional(),
  socialSecurityNumber: z.string().optional(),
  activityCode: z.string().optional(),
  collectiveAgreement: z.string().optional(),
});

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

const EMPTY_VALUES: CompanySettingsFormValues = {
  name: '',
  legalName: '',
  logo: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  taxIdNumber: '',
  rccm: '',
  socialSecurityNumber: '',
  activityCode: '',
  collectiveAgreement: '',
};

export function CompanySettingsPage() {
  const { t } = useTranslation();
  const { data: company, isLoading } = useCurrentCompanyQuery();
  const updateMutation = useUpdateCompanyMutation();
  const logoMutation = useUploadCompanyLogoMutation();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de re-sélectionner le même fichier ensuite
    if (!file) return;
    try {
      await logoMutation.mutateAsync(file);
      toast.success(t('companySettings.logoUploadSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('companySettings.logoUploadError'));
    }
  };

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    // `values` (pas `defaultValues`) : le formulaire se resynchronise
    // automatiquement dès que la requête entreprise charge/rafraîchit.
    values: company
      ? {
          name: company.name,
          legalName: company.legalName ?? '',
          logo: company.logo ?? '',
          address: company.address ?? '',
          postalCode: company.postalCode ?? '',
          city: company.city ?? '',
          phone: company.phone ?? '',
          email: company.email ?? '',
          taxIdNumber: company.taxIdNumber ?? '',
          rccm: company.rccm ?? '',
          socialSecurityNumber: company.socialSecurityNumber ?? '',
          activityCode: company.activityCode ?? '',
          collectiveAgreement: company.collectiveAgreement ?? '',
        }
      : EMPTY_VALUES,
  });

  const requiredEmployerFields = company
    ? new Set(
        COUNTRY_META[company.countryCode].requiredEmployerFields.map((field) =>
          field === 'taxId' ? 'taxIdNumber' : field === 'cnss' ? 'socialSecurityNumber' : field,
        ),
      )
    : new Set<string>();

  const onSubmit = async (values: CompanySettingsFormValues) => {
    const payload: UpdateCompanyPayload = {
      name: values.name,
      legalName: emptyToUndefined(values.legalName),
      logo: emptyToUndefined(values.logo),
      address: emptyToUndefined(values.address),
      postalCode: emptyToUndefined(values.postalCode),
      city: emptyToUndefined(values.city),
      phone: emptyToUndefined(values.phone),
      email: emptyToUndefined(values.email),
      taxIdNumber: emptyToUndefined(values.taxIdNumber),
      rccm: emptyToUndefined(values.rccm),
      socialSecurityNumber: emptyToUndefined(values.socialSecurityNumber),
      activityCode: emptyToUndefined(values.activityCode),
      collectiveAgreement: emptyToUndefined(values.collectiveAgreement),
    };
    try {
      await updateMutation.mutateAsync(payload);
      toast.success(t('companySettings.saveSuccess'));
      // Rappel non bloquant : ces champs sont nécessaires pour un bulletin
      // conforme dans ce pays (COUNTRY_META.requiredEmployerFields), mais
      // doivent rester indépendants du reste du formulaire — les bloquer
      // empêchait d'enregistrer Code activité/Convention collective/Raison
      // sociale tant qu'Adresse/CNSS/IFU n'étaient pas remplis en même temps.
      const stillMissing = [...requiredEmployerFields].filter(
        (field) => !payload[field as 'address' | 'taxIdNumber' | 'socialSecurityNumber']?.trim(),
      );
      if (stillMissing.length > 0) {
        toast.warning(t('companySettings.requiredForCountry'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('companySettings.saveError'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const countryMeta = company ? COUNTRY_META[company.countryCode] : undefined;
  const taxIdLabel = countryMeta?.taxIdLabel ?? t('companySettings.rccm');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('companySettings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('companySettings.subtitle')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('companySettings.identitySection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.legalName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('companySettings.logo')}</FormLabel>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {company?.logo ? (
                          <img
                            src={resolveUploadUrl(company.logo)}
                            alt={company.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageOff className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={handleLogoFileChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={logoMutation.isPending}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {logoMutation.isPending ? t('companySettings.logoUploading') : t('companySettings.logoUpload')}
                        </Button>
                        <p className="text-xs text-muted-foreground">{t('companySettings.logoHint')}</p>
                      </div>
                    </div>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pays & devise : lecture seule, jamais modifiables depuis ce formulaire
             (server/src/routes/companies.routes.ts les refuse explicitement). */}
          {countryMeta && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('companySettings.countrySection')}</CardTitle>
                <CardDescription>{t('companySettings.countryLocked')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Pays</div>
                  <div className="font-medium text-foreground">
                    {countryMeta.flag} {countryMeta.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">Devise</div>
                  <div className="font-medium text-foreground">{company?.currencyCode}</div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('companySettings.contactSection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      {t('companySettings.address')}
                      {requiredEmployerFields.has('address') && <span className="text-destructive"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.postalCode')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.city')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.phone')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('companySettings.legalSection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="taxIdNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {taxIdLabel}
                      {requiredEmployerFields.has('taxIdNumber') && <span className="text-destructive"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rccm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.rccm')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialSecurityNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('companySettings.socialSecurityNumber')}
                      {requiredEmployerFields.has('socialSecurityNumber') && <span className="text-destructive"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="activityCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('companySettings.activityCode')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collectiveAgreement"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('companySettings.collectiveAgreement')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('companySettings.saving') : t('companySettings.save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
