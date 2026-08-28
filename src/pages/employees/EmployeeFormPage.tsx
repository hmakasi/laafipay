import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateEmployeeMutation,
  useDepartmentsQuery,
  useEmployeeQuery,
  useInviteEmployeeMutation,
  useUpdateEmployeeMutation,
} from '@/hooks/useEmployees';
import { InviteResultDialog } from '@/pages/employees/InviteResultDialog';
import { CreateDepartmentDialog } from '@/pages/employees/CreateDepartmentDialog';
import {
  CONTRACT_TYPES,
  EMPLOYEE_STATUSES,
  GENDERS,
  MARITAL_STATUSES,
  MOBILE_MONEY_OPERATORS,
  PAYMENT_METHODS,
} from '@/lib/constants';

const employeeSchema = z
  .object({
    matricule: z.string().min(1, 'Champ requis'),
    firstName: z.string().min(1, 'Champ requis'),
    lastName: z.string().min(1, 'Champ requis'),
    gender: z.enum(['M', 'F']),
    dateOfBirth: z.string().min(1, 'Champ requis'),
    placeOfBirth: z.string().min(1, 'Champ requis'),
    nationality: z.string().min(1, 'Champ requis'),
    maritalStatus: z.enum(['celibataire', 'marie', 'divorce', 'veuf']),
    numberOfChildren: z.coerce.number().int().min(0),
    email: z.string().email('Adresse e-mail invalide'),
    phone: z.string().min(1, 'Champ requis'),
    address: z.string().min(1, 'Champ requis'),
    city: z.string().min(1, 'Champ requis'),
    contractType: z.enum(['CDI', 'CDD', 'Stage', 'Journalier', 'Consultant']),
    status: z.enum(['actif', 'periode_essai', 'en_conge', 'suspendu', 'offboarded']),
    hireDate: z.string().min(1, 'Champ requis'),
    position: z.string().min(1, 'Champ requis'),
    departmentId: z.string().min(1, 'Champ requis'),
    siteLocation: z.string().min(1, 'Champ requis'),
    baseSalary: z.coerce.number().positive('Montant invalide'),
    paymentMethod: z.enum(['mobile_money', 'virement', 'mixte', 'especes']),
    mobileMoneyOperator: z.enum(['orange', 'moov', 'telecel']).optional(),
    mobileMoneyNumber: z.string().optional(),
    bankName: z.string().optional(),
    bankRib: z.string().optional(),
    cnssNumber: z.string().optional(),
    iutsCategory: z.coerce.number().int().min(1).max(8),
  })
  .refine(
    (data) =>
      data.paymentMethod !== 'mobile_money' && data.paymentMethod !== 'mixte'
        ? true
        : !!data.mobileMoneyOperator && !!data.mobileMoneyNumber,
    { message: 'Opérateur et numéro Mobile Money requis', path: ['mobileMoneyNumber'] }
  )
  .refine(
    (data) => (data.paymentMethod !== 'virement' && data.paymentMethod !== 'mixte' ? true : !!data.bankRib),
    { message: 'RIB requis', path: ['bankRib'] }
  );

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const defaultValues: EmployeeFormValues = {
  matricule: '',
  firstName: '',
  lastName: '',
  gender: 'F',
  dateOfBirth: '',
  placeOfBirth: '',
  nationality: 'Burkinabè',
  maritalStatus: 'celibataire',
  numberOfChildren: 0,
  email: '',
  phone: '',
  address: '',
  city: 'Ouagadougou',
  contractType: 'CDI',
  status: 'periode_essai',
  hireDate: new Date().toISOString().split('T')[0],
  position: '',
  departmentId: '',
  siteLocation: 'Siège social',
  baseSalary: 0,
  paymentMethod: 'mobile_money',
  mobileMoneyOperator: 'orange',
  mobileMoneyNumber: '',
  bankName: '',
  bankRib: '',
  cnssNumber: '',
  iutsCategory: 1,
};

export function EmployeeFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const isInviteFlow = !isEdit && searchParams.get('invite') === '1';

  const { data: existing, isLoading } = useEmployeeQuery(id);
  const { data: departments } = useDepartmentsQuery();
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const inviteMutation = useInviteEmployeeMutation();
  const [inviteResult, setInviteResult] = useState<{
    employeeId: string;
    employeeName: string;
    phone?: string;
    email?: string;
    link: string;
  } | null>(null);
  const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        ...defaultValues,
        ...existing,
        mobileMoneyOperator: existing.mobileMoneyInfo?.operator ?? 'orange',
        mobileMoneyNumber: existing.mobileMoneyInfo?.phoneNumber ?? '',
        bankName: existing.bankInfo?.bankName ?? '',
        bankRib: existing.bankInfo?.rib ?? '',
      });
    }
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMethod = form.watch('paymentMethod');

  const onSubmit = async (values: EmployeeFormValues) => {
    const { mobileMoneyOperator, mobileMoneyNumber, bankName, bankRib, ...rest } = values;
    const payload = {
      ...rest,
      mobileMoneyInfo:
        values.paymentMethod === 'mobile_money' || values.paymentMethod === 'mixte'
          ? {
              operator: mobileMoneyOperator!,
              phoneNumber: mobileMoneyNumber!,
              accountName: `${values.firstName} ${values.lastName}`,
            }
          : undefined,
      bankInfo:
        values.paymentMethod === 'virement' || values.paymentMethod === 'mixte'
          ? {
              bankName: bankName ?? '',
              rib: bankRib!,
              iban: bankRib ?? '',
              accountHolder: `${values.firstName} ${values.lastName}`,
            }
          : undefined,
    };

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, data: payload });
        toast.success(t('app.save'));
        navigate(`/employees/${id}`);
      } else {
        const created = await createMutation.mutateAsync(payload);
        toast.success(t('app.save'));
        if (created.accountProvisioning.created) {
          if (created.accountProvisioning.emailSent) {
            toast.success(t('employees.account.createdEmailSent', { email: created.email }));
          } else {
            toast.warning(
              t('employees.account.createdEmailFailed', { password: created.accountProvisioning.temporaryPassword }),
              { duration: 30_000 }
            );
          }
        } else {
          toast.info(t('employees.account.skippedEmailInUse', { email: created.email }));
        }
        if (isInviteFlow) {
          const { token } = await inviteMutation.mutateAsync(created.id);
          setInviteResult({
            employeeId: created.id,
            employeeName: `${created.firstName} ${created.lastName}`,
            phone: created.phone,
            email: created.email,
            link: `${window.location.origin}/onboard/${token}`,
          });
        } else {
          navigate(`/employees/${created.id}`);
        }
      }
    } catch (err) {
      // t('app.error') masquait systématiquement la vraie raison du rejet
      // (ex. matricule déjà utilisé, département invalide) derrière un
      // message générique "Une erreur est survenue" — impossible de
      // diagnostiquer un échec de création sans le message réel du serveur.
      toast.error(err instanceof Error ? err.message : t('app.error'));
    }
  };

  if (isEdit && isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('app.back')}
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('employees.tabs.personal')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField control={form.control} name="matricule" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.matricule')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.firstName')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.lastName')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Genre</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g} value={g}>{t(`employees.gender_${g}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem><FormLabel>Date de naissance</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="placeOfBirth" render={({ field }) => (
                <FormItem><FormLabel>Lieu de naissance</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nationality" render={({ field }) => (
                <FormItem><FormLabel>Nationalité</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Situation familiale</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MARITAL_STATUSES.map((m) => <SelectItem key={m} value={m}>{t(`employees.marital_${m}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="numberOfChildren" render={({ field }) => (
                <FormItem><FormLabel>Nombre d'enfants</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.email')}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.phone')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>Ville</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="md:col-span-3"><FormLabel>Adresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('employees.tabs.contract')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField control={form.control} name="contractType" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.contract')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CONTRACT_TYPES.map((c) => <SelectItem key={c} value={c}>{t(`employees.contract_${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.status')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EMPLOYEE_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`employees.status_${s}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hireDate" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.hireDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.position')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.department')}</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('employees.filterByDepartment')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('employees.newDepartment.title')}
                      onClick={() => setCreateDepartmentOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="siteLocation" render={({ field }) => (
                <FormItem><FormLabel>Site</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('employees.tabs.salary')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField control={form.control} name="baseSalary" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.baseSalary')} (XOF)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cnssNumber" render={({ field }) => (
                <FormItem><FormLabel>N° CNSS</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="iutsCategory" render={({ field }) => (
                <FormItem><FormLabel>Catégorie IUTS (1-8)</FormLabel><FormControl><Input type="number" min={1} max={8} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees.paymentMethod')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{t(`employees.payment_${p}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {(paymentMethod === 'mobile_money' || paymentMethod === 'mixte') && (
                <>
                  <FormField control={form.control} name="mobileMoneyOperator" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opérateur Mobile Money</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {MOBILE_MONEY_OPERATORS.map((o) => <SelectItem key={o} value={o}>{t(`employees.operator_${o}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mobileMoneyNumber" render={({ field }) => (
                    <FormItem><FormLabel>Numéro Mobile Money</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </>
              )}

              {(paymentMethod === 'virement' || paymentMethod === 'mixte') && (
                <>
                  <FormField control={form.control} name="bankName" render={({ field }) => (
                    <FormItem><FormLabel>Banque</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="bankRib" render={({ field }) => (
                    <FormItem><FormLabel>RIB</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              {t('app.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {t('app.save')}
            </Button>
          </div>
        </form>
      </Form>

      {inviteResult && (
        <InviteResultDialog
          open
          onClose={() => navigate(`/employees/${inviteResult.employeeId}`)}
          employeeName={inviteResult.employeeName}
          phone={inviteResult.phone}
          email={inviteResult.email}
          link={inviteResult.link}
        />
      )}

      <CreateDepartmentDialog
        open={createDepartmentOpen}
        onOpenChange={setCreateDepartmentOpen}
        onCreated={(department) => form.setValue('departmentId', department.id, { shouldValidate: true })}
      />
    </div>
  );
}
