import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateDepartmentMutation } from '@/hooks/useEmployees';
import { Department } from '@/types';

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Champ requis'),
  code: z.string().min(1, 'Champ requis'),
});

type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>;

// Dialogue de création rapide, ouvert depuis le sélecteur "Département" du
// formulaire employé (EmployeeFormPage.tsx) — évite un aller-retour vers une
// page de gestion dédiée pour le cas courant "ce département n'existe pas
// encore". `onCreated` permet à l'appelant de présélectionner le nouveau
// département sans que l'utilisateur ait à le rechercher dans la liste.
export function CreateDepartmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (department: Department) => void;
}) {
  const { t } = useTranslation();
  const createMutation = useCreateDepartmentMutation();

  const form = useForm<CreateDepartmentFormValues>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: { name: '', code: '' },
  });

  const onSubmit = async (values: CreateDepartmentFormValues) => {
    try {
      const department = await createMutation.mutateAsync(values);
      toast.success(t('employees.newDepartment.success'));
      form.reset({ name: '', code: '' });
      onOpenChange(false);
      onCreated?.(department);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('employees.newDepartment.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('employees.newDepartment.title')}</DialogTitle>
          <DialogDescription>{t('employees.newDepartment.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.newDepartment.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. Ressources humaines" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.newDepartment.code')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex. RH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('employees.newDepartment.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('employees.newDepartment.creating') : t('employees.newDepartment.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
