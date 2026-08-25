import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FilePlus2 } from 'lucide-react';
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
import { useCreateContractMutation } from '@/hooks/useContracts';
import { CONTRACT_TYPES } from '@/lib/constants';
import { Department } from '@/types';

const contractFormSchema = z.object({
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']),
  startDate: z.string().min(1, 'Champ requis'),
  endDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  position: z.string().min(1, 'Champ requis'),
  departmentId: z.string().min(1, 'Champ requis'),
  baseSalary: z.coerce.number().positive('Montant invalide'),
  contractNumber: z.string().optional(),
  notes: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

export function NewContractDialog({
  employeeId,
  departments,
  defaultValues,
}: {
  employeeId: string;
  departments: Department[];
  defaultValues?: Partial<ContractFormValues>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createMutation = useCreateContractMutation(employeeId);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      contractType: 'CDI',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      trialEndDate: '',
      position: '',
      departmentId: '',
      baseSalary: 0,
      contractNumber: '',
      notes: '',
      ...defaultValues,
    },
  });

  const onSubmit = async (values: ContractFormValues) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success(t('employees.contracts.createSuccess'));
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
          <FilePlus2 className="mr-2 h-4 w-4" />
          {t('employees.contracts.newContract')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('employees.contracts.newContract')}</DialogTitle>
          <DialogDescription>{t('employees.contracts.newContractDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contract')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONTRACT_TYPES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`employees.contract_${c}`)}
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
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
              <FormField
                control={form.control}
                name="trialEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.trialEndDate')}</FormLabel>
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
                name="contractNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees.contracts.contractNumber')}</FormLabel>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.contracts.notes')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
