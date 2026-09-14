import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
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
import { useCreateJournalEntryMutation } from '@/hooks/useComptaLedger';
import { JOURNAL_CODES, JOURNAL_META } from '@/lib/comptaJournals';
import { formatCurrency } from '@/lib/utils';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';

const ligneSchema = z.object({
  compte: z.string().min(1, 'Champ requis'),
  libelleCompte: z.string().min(1, 'Champ requis'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
});

const formSchema = z.object({
  journal: z.enum(JOURNAL_CODES as [string, ...string[]]),
  piece: z.string().min(1, 'Champ requis'),
  dateEcriture: z.string().min(1, 'Champ requis'),
  libelle: z.string().min(1, 'Champ requis'),
  lignes: z.array(ligneSchema).min(2, 'Au moins deux lignes (débit + crédit)'),
});

type FormValues = z.infer<typeof formSchema>;

const today = () => new Date().toISOString().slice(0, 10);

export function NewJournalEntryDialog() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateJournalEntryMutation();
  const { data: company } = useCurrentCompanyQuery();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journal: 'CAI',
      piece: '',
      dateEcriture: today(),
      libelle: '',
      lignes: [
        { compte: '', libelleCompte: '', debit: 0, credit: 0 },
        { compte: '', libelleCompte: '', debit: 0, credit: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lignes' });
  const journal = form.watch('journal') as keyof typeof JOURNAL_META;
  const lignes = form.watch('lignes');
  const totalDebit = lignes.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lignes.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const onSubmit = async (values: FormValues) => {
    try {
      await mutation.mutateAsync(values as FormValues & { journal: (typeof JOURNAL_CODES)[number] });
      toast.success('Écriture enregistrée');
      form.reset({
        journal: values.journal,
        piece: '',
        dateEcriture: today(),
        libelle: '',
        lignes: [
          { compte: '', libelleCompte: '', debit: 0, credit: 0 },
          { compte: '', libelleCompte: '', debit: 0, credit: 0 },
        ],
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'écriture");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nouvelle écriture
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle écriture</DialogTitle>
          <DialogDescription>Saisie manuelle — la partie double doit être équilibrée (débit = crédit).</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="journal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JOURNAL_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code} — {JOURNAL_META[code].libelle}
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
                name="piece"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° de pièce</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. CAI-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {journal && JOURNAL_META[journal] && (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {JOURNAL_META[journal].perimetre} · Contrepartie habituelle : {JOURNAL_META[journal].compteContrepartieDefaut}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dateEcriture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="libelle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Libellé</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. Achat fournitures de bureau" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Lignes</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ compte: '', libelleCompte: '', debit: 0, credit: 0 })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`lignes.${index}.compte`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Compte</FormLabel>
                        <FormControl>
                          <Input placeholder="5711" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lignes.${index}.libelleCompte`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Libellé compte</FormLabel>
                        <FormControl>
                          <Input placeholder="Caisse" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lignes.${index}.debit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Débit</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lignes.${index}.credit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Crédit</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length <= 2}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.lignes?.message && (
                <p className="text-sm text-destructive">{form.formState.errors.lignes.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 rounded-md border px-3 py-2 text-sm">
              <span>
                Débit : <span className="font-semibold tabular-nums">{formatCurrency(totalDebit, company?.currencyCode)}</span>
              </span>
              <span>
                Crédit : <span className="font-semibold tabular-nums">{formatCurrency(totalCredit, company?.currencyCode)}</span>
              </span>
              {!balanced && <span className="text-destructive">Non équilibrée</span>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!balanced || mutation.isPending}>
                {mutation.isPending ? 'Enregistrement...' : "Enregistrer l'écriture"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
