import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCompanyMutation } from '@/hooks/useCompanies';
import { COUNTRY_CODES, COUNTRY_META } from '@/lib/constants';
import { Company, CountryCode, CurrencyCode } from '@/types';

const createCompanySchema = z.object({
  name: z.string().min(1, 'Champ requis'),
  countryCode: z.enum(['BF', 'BJ', 'CD']),
  currencyCode: z.enum(['XOF', 'CDF', 'USD']),
  taxIdNumber: z.string().min(1, 'Champ requis'),
  socialSecurityNumber: z.string().optional(),
});

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

const defaultValues: CreateCompanyFormValues = {
  name: '',
  countryCode: 'BF',
  currencyCode: COUNTRY_META.BF.defaultCurrency,
  taxIdNumber: '',
  socialSecurityNumber: '',
};

export function CreateCompanyModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (company: Company) => void;
}) {
  const form = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues,
  });
  const createMutation = useCreateCompanyMutation();

  const countryCode = form.watch('countryCode');
  const countryMeta = COUNTRY_META[countryCode];
  // BF et BJ n'ont qu'une devise possible (XOF) : le sélecteur de devise ne
  // sert qu'à la RDC, qui doit choisir entre CDF et USD comme devise de paie.
  const currencyIsChoosable = countryMeta.currencies.length > 1;

  const handleCountryChange = (value: string) => {
    const nextCountry = value as CountryCode;
    form.setValue('countryCode', nextCountry);
    form.setValue('currencyCode', COUNTRY_META[nextCountry].defaultCurrency);
  };

  const onSubmit = async (values: CreateCompanyFormValues) => {
    try {
      const company = await createMutation.mutateAsync(values);
      toast.success(`Entreprise « ${company.name} » créée`);
      form.reset(defaultValues);
      onOpenChange(false);
      onCreated?.(company);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création de l\'entreprise');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle entreprise</DialogTitle>
          <DialogDescription>
            Le pays sélectionné détermine la devise de paie et les règles fiscales appliquées.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'entreprise</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. SODEICO SARL" {...field} />
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
                  <FormLabel>Pays d'implantation</FormLabel>
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
              name="currencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Devise de paie</FormLabel>
                  {currencyIsChoosable ? (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as CurrencyCode)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryMeta.currencies.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      {/* BF/BJ : devise imposée par le pays, champ verrouillé plutôt que masqué
                         pour que l'utilisateur comprenne pourquoi il n'y a pas de choix. */}
                      <Input value={field.value} disabled readOnly />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxIdNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{countryMeta.taxIdLabel}</FormLabel>
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
                  <FormLabel>Numéro de sécurité sociale employeur (CNSS / INSS)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Création...' : 'Créer l\'entreprise'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
