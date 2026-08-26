import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Download, Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useDeleteEmployeeMutation, useDepartmentsQuery, useEmployeeQuery, useUploadDocumentMutation } from '@/hooks/useEmployees';
import { useEmployeeContractsQuery } from '@/hooks/useContracts';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { downloadDocument } from '@/services/api/employees';
import { CONTRACT_STATUS_VARIANT, EMPLOYEE_STATUS_VARIANT } from '@/lib/constants';
import { downloadBlob, formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { NewContractDialog } from '@/pages/employees/NewContractDialog';
import { NewAmendmentDialog } from '@/pages/employees/NewAmendmentDialog';
import { EmployeeDocument } from '@/types';

const DOCUMENT_TYPE_LABEL: Record<EmployeeDocument['type'], string> = {
  contrat: 'Contrat',
  avenant: 'Avenant',
  piece_identite: "Pièce d'identité",
  diplome: 'Diplôme',
  attestation: 'Attestation',
  autre: 'Autre',
};

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
  const { data: contracts } = useEmployeeContractsQuery(id);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const deleteMutation = useDeleteEmployeeMutation();
  const uploadDocumentMutation = useUploadDocumentMutation();
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<EmployeeDocument['type']>('autre');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDocumentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !id) return;
    try {
      await uploadDocumentMutation.mutateAsync({ employeeId: id, file, type: documentType });
      toast.success('Document importé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import du document");
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    setDownloadingId(doc.id);
    try {
      const blob = await downloadDocument(doc.url);
      downloadBlob(blob, doc.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('app.delete'));
      navigate('/employees');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
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

  const currentContract = contracts?.find((c) => c.isCurrent);

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

        <TabsContent value="contract" className="space-y-4">
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

          <PermissionGate permission="employees:write">
            <div className="flex flex-wrap gap-2">
              {departments && <NewContractDialog employeeId={emp.id} departments={departments} />}
              {departments && currentContract && (
                <NewAmendmentDialog employeeId={emp.id} contract={currentContract} departments={departments} />
              )}
            </div>
          </PermissionGate>

          <Card>
            <CardContent className="p-6">
              <div className="mb-4 text-xs font-semibold uppercase text-muted-foreground">
                {t('employees.contracts.history')}
              </div>
              {!contracts?.length ? (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {t(`employees.contract_${contract.contractType}`)} — {formatDate(contract.startDate)}
                          {contract.endDate ? ` → ${formatDate(contract.endDate)}` : ''}
                        </div>
                        <Badge variant={CONTRACT_STATUS_VARIANT[contract.status]}>
                          {t(`employees.contracts.status_${contract.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {contract.position} · {departments?.find((d) => d.id === contract.departmentId)?.name} ·{' '}
                        {formatCurrency(contract.baseSalary, currencyCode)}
                      </div>
                      {contract.amendments.length > 0 && (
                        <ul className="mt-3 space-y-2 border-t pt-3">
                          {contract.amendments.map((amendment) => (
                            <li key={amendment.id} className="border-l-2 border-primary/30 pl-3">
                              <div className="text-sm">{amendment.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {t(`employees.contracts.amendmentType_${amendment.type}`)} ·{' '}
                                {formatDate(amendment.effectiveDate)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
              <Field label={t('employees.baseSalary')} value={formatCurrency(emp.baseSalary, currencyCode)} />
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
            <CardContent className="space-y-4 p-6">
              <PermissionGate permission="employees:write">
                <div className="flex items-center gap-2">
                  <Select value={documentType} onValueChange={(v) => setDocumentType(v as EmployeeDocument['type'])}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    ref={documentInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleDocumentFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadDocumentMutation.isPending}
                    onClick={() => documentInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadDocumentMutation.isPending ? 'Import...' : 'Importer un document'}
                  </Button>
                </div>
              </PermissionGate>

              {emp.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {emp.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                      <div className="min-w-0">
                        <div className="truncate">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{DOCUMENT_TYPE_LABEL[doc.type]}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={downloadingId === doc.id}
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                      </div>
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
