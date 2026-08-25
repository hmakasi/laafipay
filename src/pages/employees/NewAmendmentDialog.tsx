import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useCreateAmendmentMutation } from '@/hooks/useContracts';
import { AMENDMENT_TYPES } from '@/lib/constants';
import { Contract, Department } from '@/types';

const amendmentFormSchema = z.object({
  type: z.enum(['renouvellement', 'changement_poste', 'changement_salaire', 'changement_departement', 'prolongation', 'autre']),
  effectiveDate: z.string().min(1, 'Champ requis'),
  description: z.string().min(1, 'Champ requis'),
  position: z.string().optional(),
  departmentId: z.string().optional(),
  baseSalary: z.coerce.number().positive('Montant invalide').optional(),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']).optional(),
});

type AmendmentFormValues = z.infer<typeof amendmentFormSchema>;

export function NewAmendmentDialog({
  employeeId,
  contract,
  departments,
}: {
  employeeId: string;
  contract: Contract;
  departments: Department[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createMutation = useCreateAmendmentMutation(employeeId);

  const form = useForm<AmendmentFormValues>({
    resolver: zodResolver(amendmentFormSchema),
    defaultValues: {
      type: 'autre',
      effectiveDate: new Date().toISOString().split('T')[0],
      description: '',
      position: contract.position,
      departmentId: contract.departmentId,
      baseSalary: contract.baseSalary,
      endDate: contract.endDate ?? '',
      trialEndDate: contract.trialEndDate ?? '',
      contractType: contract.contractType,
    },
  });

  const onSubmit = async (values: AmendmentFormValues) => {
    try {
      await createMutation.mutateAsync({ contractId: contract.id, payload: values });
      toast.success(t('employees.contracts.amendmentSuccess'));
      setOpen(false);
      form.reset();
    } catch {
      toast.error(t('app.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileEdit className="mr-2 h-4 w-4" />
          {t('employees.contracts.newAmendment')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('employees.contracts.newAmendment')}</DialogTitle>
          <DialogDescription>{t('employees.contracts.newAmendmentDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.amendmentType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AMENDMENT_TYPES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {t(`employees.contracts.amendmentType_${a}`)}
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
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.effectiveDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.position')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.department')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
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
                name="baseSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.baseSalary')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.contracts.description')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {t('app.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
