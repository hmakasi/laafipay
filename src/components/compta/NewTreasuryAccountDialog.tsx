import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTreasuryAccountMutation } from '@/hooks/useTreasury';
import { COUNTRY_CODES, COUNTRY_META } from '@/lib/constants';
import { ComptaCountryCode } from '@/types/compta';
import { TreasuryMobileMoneyProvider } from '@/types/treasury';

const MOBILE_MONEY_PROVIDERS: { value: TreasuryMobileMoneyProvider; label: string }[] = [
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'wave', label: 'Wave' },
  { value: 'moov_money', label: 'Moov Money' },
  { value: 'mtn_money', label: 'MTN Money' },
  { value: 'm_pesa', label: 'M-Pesa' },
];

const formSchema = z
  .object({
    label: z.string().min(1, 'Champ requis'),
    kind: z.enum(['banque', 'mobile_money']),
    provider: z.enum(['orange_money', 'wave', 'moov_money', 'mtn_money', 'm_pesa']).optional(),
    countryCode: z.enum(['BF', 'BJ', 'CD']),
    currencyCode: z.enum(['XOF', 'CDF', 'USD']),
    openingBalance: z.coerce.number(),
  })
  .refine((v) => v.kind !== 'mobile_money' || !!v.provider, {
    message: 'Choisis un opérateur',
    path: ['provider'],
  });

type FormValues = z.infer<typeof formSchema>;

export function NewTreasuryAccountDialog() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateTreasuryAccountMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: '',
      kind: 'banque',
      countryCode: 'BF',
      currencyCode: COUNTRY_META.BF.defaultCurrency,
      openingBalance: 0,
    },
  });

  const kind = form.watch('kind');
  const countryCode = form.watch('countryCode') as ComptaCountryCode;
  const countryMeta = COUNTRY_META[countryCode];

  const onSubmit = async (values: FormValues) => {
    try {
      await mutation.mutateAsync(values);
      toast.success('Compte de trésorerie créé');
      form.reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création du compte');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nouveau compte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau compte de trésorerie</DialogTitle>
          <DialogDescription>Banque ou Mobile Money — le solde se calcule ensuite depuis les relevés importés.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Libellé</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. Coris Bank — Compte courant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de compte</FormLabel>
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as FormValues['kind'])}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="banque">Banque</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {kind === 'mobile_money' && (
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opérateur</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un opérateur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOBILE_MONEY_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue('currencyCode', COUNTRY_META[v as ComptaCountryCode].defaultCurrency);
                      }}
                    >
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
                    <FormLabel>Devise</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="openingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solde d'ouverture</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                Créer le compte
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
