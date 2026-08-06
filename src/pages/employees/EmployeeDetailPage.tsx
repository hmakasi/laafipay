import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useDeleteEmployeeMutation, useDepartmentsQuery, useEmployeeQuery } from '@/hooks/useEmployees';
import { EMPLOYEE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? '—'}</div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: emp, isLoading } = useEmployeeQuery(id);
  const { data: departments } = useDepartmentsQuery();
  const deleteMutation = useDeleteEmployeeMutation();

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    toast.success(t('app.delete'));
    navigate('/employees');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!emp) {
    return <p className="text-muted-foreground">{t('app.noData')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/employees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
        <div className="flex gap-2">
          <PermissionGate permission="employees:write">
            <Button variant="outline" onClick={() => navigate(`/employees/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('employees.editEmployee')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="employees:delete">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('app.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('app.confirm')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {emp.firstName} {emp.lastName} — {t('app.delete')}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('app.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t('app.confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {getInitials(emp.firstName, emp.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {emp.firstName} {emp.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {emp.position} · {emp.matricule}
            </p>
          </div>
          <Badge variant={EMPLOYEE_STATUS_VARIANT[emp.status]}>{t(`employees.status_${emp.status}`)}</Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">{t('employees.tabs.personal')}</TabsTrigger>
          <TabsTrigger value="contract">{t('employees.tabs.contract')}</TabsTrigger>
          <TabsTrigger value="salary">{t('employees.tabs.salary')}</TabsTrigger>
          <TabsTrigger value="documents">{t('employees.tabs.documents')}</TabsTrigger>
          <TabsTrigger value="career">{t('employees.tabs.career')}</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
              <Field label={t('employees.email')} value={emp.email} />
              <Field label={t('employees.phone')} value={emp.phone} />
              <Field label="Genre" value={t(`employees.gender_${emp.gender}`)} />
              <Field label="Date de naissance" value={formatDate(emp.dateOfBirth)} />
              <Field label="Lieu de naissance" value={emp.placeOfBirth} />
              <Field label="Nationalité" value={emp.nationality} />
              <Field label="Situation familiale" value={t(`employees.marital_${emp.maritalStatus}`)} />
              <Field label="Enfants" value={emp.numberOfChildren} />
              <Field label="Adresse" value={`${emp.address}, ${emp.city}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
              <Field label={t('employees.contract')} value={t(`employees.contract_${emp.contractType}`)} />
              <Field label={t('employees.status')} value={t(`employees.status_${emp.status}`)} />
              <Field label={t('employees.hireDate')} value={formatDate(emp.hireDate)} />
              {emp.trialEndDate && <Field label="Fin de période d'essai" value={formatDate(emp.trialEndDate)} />}
              {emp.contractEndDate && <Field label="Fin de contrat" value={formatDate(emp.contractEndDate)} />}
              <Field label={t('employees.position')} value={emp.position} />
              <Field
                label={t('employees.department')}
                value={departments?.find((d) => d.id === emp.departmentId)?.name}
              />
              <Field label="Site" value={emp.siteLocation} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
              <Field label={t('employees.baseSalary')} value={formatCurrency(emp.baseSalary)} />
              <Field label={t('employees.paymentMethod')} value={t(`employees.payment_${emp.paymentMethod}`)} />
              {emp.mobileMoneyInfo && (
                <>
                  <Field label="Opérateur" value={t(`employees.operator_${emp.mobileMoneyInfo.operator}`)} />
                  <Field label="Numéro Mobile Money" value={emp.mobileMoneyInfo.phoneNumber} />
                </>
              )}
              {emp.bankInfo && (
                <>
                  <Field label="Banque" value={emp.bankInfo.bankName} />
                  <Field label="RIB" value={emp.bankInfo.rib} />
                </>
              )}
              <Field label="N° CNSS" value={emp.cnssNumber} />
              <Field label="Catégorie IUTS" value={emp.iutsCategory} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6">
              {emp.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {emp.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                      <span>{doc.name}</span>
                      <span className="text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="career">
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {emp.careerHistory.map((event) => (
                  <li key={event.id} className="border-l-2 border-primary/30 pl-4">
                    <div className="text-sm font-medium">{event.description}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(event.date)}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
