import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useGeneratePayslipsMutation, usePayslipsQuery, useSendAllPayslipsMutation } from '@/hooks/usePayslips';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { usePayrollCyclesQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { SEND_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Payslip } from '@/types';
import { PayslipPreviewDialog } from '@/pages/payslips/PayslipPreviewDialog';

export function PayslipsListPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [cycleId, setCycleId] = useState(searchParams.get('cycleId') ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<Payslip | null>(null);

  const { data: cycles } = usePayrollCyclesQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const eligibleCycles = useMemo(
    () => (cycles ?? []).filter((c) => c.status === 'valide' || c.status === 'paye').sort((a, b) => b.period.localeCompare(a.period)),
    [cycles]
  );

  const { data: payslips, isLoading } = usePayslipsQuery(undefined, cycleId || undefined);
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });

  const generateMutation = useGeneratePayslipsMutation();
  const sendAllMutation = useSendAllPayslipsMutation();

  const employee = (employeeId: string) => employeesPage?.data.find((e) => e.id === employeeId);

  const allSelected = !!payslips?.length && payslips.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(payslips?.map((p) => p.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleGenerate = async () => {
    if (!cycleId) return;
    try {
      await generateMutation.mutateAsync(cycleId);
      toast.success(t('payslips.generate'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération des bulletins');
    }
  };

  const handleSendAll = async (channel: 'email' | 'whatsapp' | 'sms') => {
    if (!cycleId) return;
    try {
      await sendAllMutation.mutateAsync({ cycleId, channel });
      toast.success(t('payslips.sendSelected'));
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi des bulletins');
    }
  };

  const alreadyGenerated = !!payslips?.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('payslips.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cycleId} onValueChange={(v) => { setCycleId(v); setSelected(new Set()); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('payroll.period')} />
            </SelectTrigger>
            <SelectContent>
              {eligibleCycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatPeriod(c.period)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PermissionGate permission="payslips:generate">
            <Button onClick={handleGenerate} disabled={!cycleId || generateMutation.isPending}>
              {alreadyGenerated ? t('payslips.alreadyGenerated') : t('payslips.generate')}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {!cycleId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">{t('payslips.noCycleSelected')}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{formatPeriod(cycleId ? eligibleCycles.find((c) => c.id === cycleId)?.period ?? '' : '')}</CardTitle>
            <PermissionGate permission="payslips:send">
              {selected.size > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSendAll('email')} disabled={sendAllMutation.isPending}>
                    <Mail className="mr-2 h-4 w-4" />
                    {t('payslips.sendEmail')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSendAll('whatsapp')} disabled={sendAllMutation.isPending}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {t('payslips.sendWhatsapp')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSendAll('sms')} disabled={sendAllMutation.isPending}>
                    <Smartphone className="mr-2 h-4 w-4" />
                    {t('payslips.sendSms')}
                  </Button>
                </div>
              )}
            </PermissionGate>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !payslips?.length ? (
              <p className="py-8 text-center text-muted-foreground">{t('app.noData')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <PermissionGate permission="payslips:send">
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                    </PermissionGate>
                    <TableHead>{t('employees.fullName')}</TableHead>
                    <TableHead>{t('payslips.netToPay')}</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>SMS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => {
                    const emp = employee(p.employeeId);
                    return (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => setPreviewing(p)}>
                        <PermissionGate permission="payslips:send">
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                          </TableCell>
                        </PermissionGate>
                        <TableCell className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : p.employeeId}</TableCell>
                        <TableCell>{formatCurrency(p.salaireNet, currencyCode)}</TableCell>
                        <TableCell>
                          <Badge variant={SEND_STATUS_VARIANT[p.emailStatus]}>{t(`payslips.emailStatus_${p.emailStatus}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEND_STATUS_VARIANT[p.whatsappStatus]}>{t(`payslips.whatsappStatus_${p.whatsappStatus}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEND_STATUS_VARIANT[p.smsStatus]}>{t(`payslips.smsStatus_${p.smsStatus}`)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {previewing && (
        <PayslipPreviewDialog
          payslip={previewing}
          employee={employee(previewing.employeeId)}
          open={!!previewing}
          onOpenChange={(open) => !open && setPreviewing(null)}
        />
      )}
    </div>
  );
}
