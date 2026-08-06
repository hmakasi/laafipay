import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateLeaveRequestMutation } from '@/hooks/useLeaves';
import { LEAVE_TYPES } from '@/lib/constants';
import { daysBetween } from '@/lib/utils';
import { useState } from 'react';

const leaveRequestSchema = z
  .object({
    type: z.enum(['conge_paye', 'maladie', 'sans_solde', 'evenement_familial', 'maternite', 'paternite', 'recuperation']),
    startDate: z.string().min(1, 'Champ requis'),
    endDate: z.string().min(1, 'Champ requis'),
    reason: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'La date de fin doit être après la date de début',
    path: ['endDate'],
  });

type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export function RequestLeaveDialog({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createMutation = useCreateLeaveRequestMutation();

  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { type: 'conge_paye', startDate: '', endDate: '', reason: '' },
  });

  const submit = async (values: LeaveRequestFormValues, channel: 'portail' | 'whatsapp') => {
    const daysCount = daysBetween(values.startDate, values.endDate);
    await createMutation.mutateAsync({
      employeeId,
      type: values.type,
      startDate: values.startDate,
      endDate: values.endDate,
      reason: values.reason,
      daysCount,
      channel,
    });
    toast.success(t('leaves.requestLeave'));
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('leaves.requestLeave')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leaves.requestLeave')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('leaves.leaveType')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPES.map((lt) => (
                        <SelectItem key={lt} value={lt}>
                          {t(`leaves.type_${lt}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('leaves.startDate')}</FormLabel>
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
                    <FormLabel>{t('leaves.endDate')}</FormLabel>
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('leaves.reason')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={form.handleSubmit((v) => submit(v, 'whatsapp'))}
            disabled={createMutation.isPending}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {t('leaves.simulateWhatsapp')}
          </Button>
          <Button type="button" onClick={form.handleSubmit((v) => submit(v, 'portail'))} disabled={createMutation.isPending}>
            {t('leaves.requestLeave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
