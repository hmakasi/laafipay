import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { usePayrollCycleQuery, useUpdatePayrollEntryMutation, useValidatePayrollCycleMutation } from '@/hooks/usePayroll';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/authStore';
import { PAYROLL_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { PayrollEntry } from '@/types';
import { InitiatePaymentSection } from '@/pages/payroll/InitiatePaymentSection';

function EditEntryDialog({
  cycleId,
  entry,
  employeeName,
  open,
  onOpenChange,
}: {
  cycleId: string;
  entry: PayrollEntry;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const updateMutation = useUpdatePayrollEntryMutation(cycleId);
  const [primes, setPrimes] = useState(String(entry.primes[0]?.amount ?? 0));
  const [avances, setAvances] = useState(String(entry.avances[0]?.amount ?? 0));
  const [retenues, setRetenues] = useState(String(entry.retenues[0]?.amount ?? 0));
  const [absenceDays, setAbsenceDays] = useState(String(entry.absenceDays));
  const [absenceAmount, setAbsenceAmount] = useState(String(entry.absenceAmount));

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      entryId: entry.id,
      data: {
        primes: Number(primes) > 0 ? [{ id: 'prime-1', label: 'Prime', amount: Number(primes), type: 'prime' }] : [],
        avances:
          Number(avances) > 0 ? [{ id: 'avance-1', label: 'Avance sur salaire', amount: Number(avances), type: 'avance' }] : [],
        retenues:
          Number(retenues) > 0 ? [{ id: 'retenue-1', label: 'Retenue', amount: Number(retenues), type: 'retenue' }] : [],
        absenceDays: Number(absenceDays),
        absenceAmount: Number(absenceAmount),
      },
    });
    toast.success(t('app.save'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('payroll.variableElements')} — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('payroll.primes')}</Label>
            <Input type="number" min={0} value={primes} onChange={(e) => setPrimes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('payroll.avances')}</Label>
            <Input type="number" min={0} value={avances} onChange={(e) => setAvances(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('payroll.retenues')}</Label>
            <Input type="number" min={0} value={retenues} onChange={(e) => setRetenues(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('payroll.absenceDays')}</Label>
            <Input type="number" min={0} value={absenceDays} onChange={(e) => setAbsenceDays(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Montant absence</Label>
            <Input type="number" min={0} value={absenceAmount} onChange={(e) => setAbsenceAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {t('app.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollCycleDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: cycle, isLoading } = usePayrollCycleQuery(id);
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const validateMutation = useValidatePayrollCycleMutation();
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const handleValidate = async () => {
    if (!id || !user) return;
    await validateMutation.mutateAsync({ id, validatedBy: user.email });
    toast.success(t('payroll.validateCycle'));
  };

  if (isLoading || !cycle) {
    return <Skeleton className="h-96 w-full" />;
  }

  const isValidated = cycle.status !== 'brouillon' && cycle.status !== 'en_cours';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
        <div className="flex gap-2">
        {isValidated && (
          <PermissionGate permission="payslips:read">
            <Button variant="outline" onClick={() => navigate(`/payslips?cycleId=${id}`)}>
              <FileText className="mr-2 h-4 w-4" />
              {t('payslips.title')}
            </Button>
          </PermissionGate>
        )}
        <PermissionGate permission="payroll:approve">
          {!isValidated && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('payroll.validateCycle')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('payroll.validateCycle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {formatPeriod(cycle.period)} · {cycle.entries.length} employés · {formatCurrency(cycle.totalNet)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleValidate}>{t('app.confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="capitalize">{formatPeriod(cycle.period)}</CardTitle>
            <p className="text-sm text-muted-foreground">{cycle.entries.length} employés</p>
          </div>
          <Badge variant={PAYROLL_STATUS_VARIANT[cycle.status]}>{t(`payroll.status_${cycle.status}`)}</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">{t('payroll.salaireBrut')}</div>
            <div className="text-lg font-semibold">{formatCurrency(cycle.totalBrut)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('payroll.salaireNet')}</div>
            <div className="text-lg font-semibold">{formatCurrency(cycle.totalNet)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('payroll.coutEmployeur')}</div>
            <div className="text-lg font-semibold">{formatCurrency(cycle.totalEmployerCost)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payroll.variableElements')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                <TableHead>{t('employees.baseSalary')}</TableHead>
                <TableHead>{t('payroll.salaireBrut')}</TableHead>
                <TableHead>{t('payroll.cnssEmployee')}</TableHead>
                <TableHead>{t('payroll.iuts')}</TableHead>
                <TableHead>{t('payroll.salaireNet')}</TableHead>
                <TableHead>{t('payroll.coutEmployeur')}</TableHead>
                <PermissionGate permission="payroll:write">
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </PermissionGate>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycle.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{employeeName(entry.employeeId)}</TableCell>
                  <TableCell>{formatCurrency(entry.baseSalary)}</TableCell>
                  <TableCell>{formatCurrency(entry.salaireBrut)}</TableCell>
                  <TableCell>{formatCurrency(entry.cnssEmployee)}</TableCell>
                  <TableCell>{formatCurrency(entry.iuts)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(entry.salaireNet)}</TableCell>
                  <TableCell>{formatCurrency(entry.coutEmployeur)}</TableCell>
                  <PermissionGate permission="payroll:write">
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" disabled={isValidated} onClick={() => setEditingEntry(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </PermissionGate>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isValidated && employeesPage && <InitiatePaymentSection cycle={cycle} employees={employeesPage.data} />}

      {editingEntry && id && (
        <EditEntryDialog
          cycleId={id}
          entry={editingEntry}
          employeeName={employeeName(editingEntry.employeeId)}
          open={!!editingEntry}
          onOpenChange={(open) => !open && setEditingEntry(null)}
        />
      )}
    </div>
  );
}
