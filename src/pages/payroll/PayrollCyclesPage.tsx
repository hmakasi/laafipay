import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Scale, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useCreatePayrollCycleMutation, usePayrollCyclesQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { PAYROLL_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatPeriod } from '@/lib/utils';

export function PayrollCyclesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: cycles, isLoading } = usePayrollCyclesQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const createMutation = useCreatePayrollCycleMutation();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('');

  const sorted = [...(cycles ?? [])].sort((a, b) => b.period.localeCompare(a.period));

  const handleCreate = async () => {
    if (!period) return;
    if (cycles?.some((c) => c.period === period)) {
      toast.error('Un cycle existe déjà pour cette période');
      return;
    }
    const created = await createMutation.mutateAsync(period);
    setOpen(false);
    setPeriod('');
    navigate(`/payroll/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('payroll.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('payroll.cycles')}</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="settings:write">
            <Button variant="outline" onClick={() => navigate('/payroll/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              {t('payroll.componentsSetupCta')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="payroll:write">
            <Button variant="outline" onClick={() => navigate('/payroll/apercu-direct')}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t('payroll.livePreview.cta')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="settings:write">
            <Button variant="outline" onClick={() => navigate('/payroll/legal-settings')}>
              <Scale className="mr-2 h-4 w-4" />
              {t('payroll.legalSettings')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="payroll:write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('payroll.prepareCycle')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('payroll.prepareCycle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="period">{t('payroll.period')}</Label>
                  <Input
                    id="period"
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={!period || createMutation.isPending}>
                    {t('app.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payroll.cycles')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payroll.period')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <TableHead>{t('employees.totalEmployees')}</TableHead>
                  <TableHead>{t('payroll.salaireBrut')}</TableHead>
                  <TableHead>{t('payroll.salaireNet')}</TableHead>
                  <TableHead>{t('payroll.coutEmployeur')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((cycle) => (
                  <TableRow key={cycle.id} className="cursor-pointer" onClick={() => navigate(`/payroll/${cycle.id}`)}>
                    <TableCell className="font-medium capitalize">{formatPeriod(cycle.period)}</TableCell>
                    <TableCell>
                      <Badge variant={PAYROLL_STATUS_VARIANT[cycle.status]}>{t(`payroll.status_${cycle.status}`)}</Badge>
                    </TableCell>
                    <TableCell>{cycle.employeeCount}</TableCell>
                    <TableCell>{formatCurrency(cycle.totalBrut, currencyCode)}</TableCell>
                    <TableCell>{formatCurrency(cycle.totalNet, currencyCode)}</TableCell>
                    <TableCell>{formatCurrency(cycle.totalEmployerCost, currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
