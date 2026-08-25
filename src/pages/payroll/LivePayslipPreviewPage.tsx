import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Download, Printer, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useLegalSettingsQuery } from '@/hooks/usePayroll';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { usePayrollConfigQuery } from '@/hooks/usePayrollConfig';
import { computePayrollEntry } from '@/lib/payrollEngine';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { optionalRubricLabelKey, OPTIONAL_RUBRIC_KEYS } from '@/lib/payrollRubrics';
import { COUNTRY_META } from '@/lib/constants';
import { PayslipOfficialTemplate, PayslipOfficialRow } from '@/components/PayslipOfficialTemplate';
import { CurrencyCode, IutsBracket, PayrollEntry } from '@/types';

// Tranche IUTS correspondant à une base donnée — le moteur (computePayrollEntry)
// ne renvoie pas le taux marginal appliqué, seulement le montant final ; on le
// retrouve ici pour l'afficher dans le tableau "Impôt sur le revenu".
function findBracketRate(base: number, brackets: IutsBracket[] | undefined): number {
  if (!brackets) return 0;
  const bracket = brackets.find((b) => base >= b.min && (b.max === null || base <= b.max));
  return bracket ? bracket.rate / 100 : 0;
}

const DEMO_BASE_SALARY = 250_000;

function VariableInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PayslipLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  // Hook appelé ici plutôt que de faire passer currencyCode en prop sur
  // chaque site d'appel : queryKey ['companies','me'] partagée avec
  // LivePayslipPreviewPage, React Query déduplique — pas de requête en plus.
  const { data: company } = useCurrentCompanyQuery();
  return (
    <div className={`flex items-center justify-between ${strong ? 'font-semibold text-foreground' : 'text-sm text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={strong ? 'text-foreground' : ''}>{formatCurrency(value, company?.currencyCode)}</span>
    </div>
  );
}

// Génère le PDF du bulletin simulé — ledger à deux colonnes (libellé / montant),
// mêmes lignes que l'aperçu à l'écran. Fonction pure (aucun hook) pour rester
// appelable directement depuis le clic du bouton Télécharger.
function downloadPayslipSimulationPdf(params: {
  employee: { firstName: string; lastName: string; matricule: string };
  entry: PayrollEntry;
  currencyCode: CurrencyCode | undefined;
  companyName: string;
  companyAddress?: string;
  companyTaxId?: string;
  companyTaxIdLabel?: string;
  companySocialSecurityNumber?: string;
  labels: {
    documentTitle: string;
    baseSalary: string;
    overtimeHours: string;
    salaireBrut: string;
    cnssEmployee: string;
    iuts: string;
    avances: string;
    retenues: string;
    netToPay: string;
    cnssEmployer: string;
    employerCost: string;
  };
}) {
  const {
    employee,
    entry,
    currencyCode,
    companyName,
    companyAddress,
    companyTaxId,
    companyTaxIdLabel,
    companySocialSecurityNumber,
    labels,
  } = params;
  const doc = new jsPDF();
  const left = 14;
  const right = 196;
  let y = 20;

  // En-tête : identité complète de l'employeur (nom, adresse, identifiant
  // fiscal, n° employeur — auto-remplis depuis CompanySettingsPage), pas
  // seulement le nom comme avant.
  doc.setFontSize(16);
  doc.text(companyName, left, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(120);
  if (companyAddress) {
    doc.text(companyAddress, left, y);
    y += 5;
  }
  if (companyTaxId) {
    doc.text(`${companyTaxIdLabel ?? 'NIF'} : ${companyTaxId}`, left, y);
    y += 5;
  }
  if (companySocialSecurityNumber) {
    doc.text(`N° employeur : ${companySocialSecurityNumber}`, left, y);
    y += 5;
  }
  y += 2;
  doc.setFontSize(11);
  doc.text(labels.documentTitle, left, y);
  y += 10;

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`${employee.firstName} ${employee.lastName}`, left, y);
  doc.text(employee.matricule, right, y, { align: 'right' });
  y += 10;

  const line = (label: string, amount: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, left, y);
    doc.text(formatCurrency(amount, currencyCode), right, y, { align: 'right' });
    y += 7;
  };
  const rule = () => {
    y += 1;
    doc.setDrawColor(200);
    doc.line(left, y, right, y);
    y += 6;
  };

  line(labels.baseSalary, entry.baseSalary);
  entry.primes.forEach((p) => line(p.label, p.amount));
  line(labels.overtimeHours, entry.overtimeAmount);
  rule();
  line(labels.salaireBrut, entry.salaireBrut, true);
  line(labels.cnssEmployee, -entry.cnssEmployee);
  line(labels.iuts, -entry.iuts);
  if (entry.avances.length > 0) line(labels.avances, -entry.avances[0].amount);
  if (entry.retenues.length > 0) line(labels.retenues, -entry.retenues[0].amount);
  rule();
  line(labels.netToPay, entry.salaireNet, true);
  y += 4;
  line(labels.cnssEmployer, entry.cnssEmployer);
  line(labels.employerCost, entry.coutEmployeur, true);

  // Pied de page : date d'édition + mention légale, ancré en bas de page
  // (pageHeight - marge) plutôt qu'à la suite du contenu.
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.setDrawColor(220);
  doc.line(left, pageHeight - 18, right, pageHeight - 18);
  doc.text(
    `Bulletin édité le ${new Date().toLocaleDateString('fr-FR')} — à conserver sans limitation de durée.`,
    (left + right) / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  doc.save(`bulletin-simulation-${employee.matricule}.pdf`);
}

export function LivePayslipPreviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: employeesPage, isLoading: employeesLoading } = useEmployeesQuery({ perPage: 1000 });
  const { data: legalSettingsVersions, isLoading: legalLoading } = useLegalSettingsQuery();
  const { data: company } = useCurrentCompanyQuery();
  const { data: payrollConfig } = usePayrollConfigQuery();

  const employees = employeesPage?.data ?? [];
  const legalSettings = legalSettingsVersions?.[0];
  const incomeTaxLabel = company ? COUNTRY_META[company.countryCode].incomeTaxLabel : t('payroll.iuts');

  // Rubriques optionnelles activées dans "Configuration du bulletin"
  // (PayrollComponentsSetup.tsx) — jusqu'ici la simulation les ignorait
  // complètement et n'affichait que 2 primes codées en dur (ancienneté,
  // transport), sans lien avec ce qui avait été configuré et enregistré.
  const activeOptionalRubrics = useMemo(
    () => (payrollConfig?.activeRubrics ?? []).filter((key) => OPTIONAL_RUBRIC_KEYS.includes(key)),
    [payrollConfig]
  );
  const customRubrics = useMemo(() => payrollConfig?.customRubrics ?? [], [payrollConfig]);
  const hasConfiguredRubrics = activeOptionalRubrics.length > 0 || customRubrics.length > 0;

  const [employeeId, setEmployeeId] = useState('');
  const [overtimeAmount, setOvertimeAmount] = useState('0');
  const [seniorityBonus, setSeniorityBonus] = useState('0');
  const [transportBonus, setTransportBonus] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [advances, setAdvances] = useState('0');
  // Une saisie par rubrique configurée, clé = rubricKey optionnel ou
  // "custom-<index>" pour les rubriques sur-mesure.
  const [rubricAmounts, setRubricAmounts] = useState<Record<string, string>>({});
  const setRubricAmount = (key: string, value: string) =>
    setRubricAmounts((prev) => ({ ...prev, [key]: value }));

  const hasEmployees = employees.length > 0;
  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];

  // Sans employé réel, on simule quand même avec des valeurs par défaut
  // (SMIG en vigueur, à défaut une valeur ronde) plutôt que de bloquer
  // l'aperçu — un aperçu toujours visible était explicitement l'alternative
  // demandée à "calculer dès la sélection d'un employé".
  const previewBaseSalary = employee?.baseSalary ?? legalSettings?.smig ?? DEMO_BASE_SALARY;
  const previewIdentity = useMemo(
    () =>
      employee ?? {
        firstName: t('payroll.livePreview.demoLabel'),
        lastName: '',
        matricule: t('payroll.livePreview.demoBadge'),
      },
    [employee, t]
  );

  // Rubriques optionnelles + sur-mesure actives, avec le montant saisi par
  // l'utilisateur — mêmes id/label/amount/type qu'une prime "classique", donc
  // elles s'affichent automatiquement partout où entry.primes est parcouru
  // (aperçu à l'écran, PDF) sans code supplémentaire à ces deux endroits.
  // Limite connue : le moteur (computePayrollEntry) traite toute prime de
  // façon uniforme — les indicateurs "imposable"/"cotisable CNSS" saisis sur
  // une rubrique sur-mesure ne sont pas encore appliqués différemment ici.
  const configuredRubricPrimes = useMemo(() => {
    const optional = activeOptionalRubrics.map((key) => ({
      id: key,
      label: t(optionalRubricLabelKey(key) ?? key),
      amount: Number(rubricAmounts[key]) || 0,
      type: 'prime' as const,
    }));
    const custom = customRubrics.map((rubric, index) => ({
      id: `custom-${index}`,
      label: rubric.label,
      amount: Number(rubricAmounts[`custom-${index}`]) || 0,
      type: 'prime' as const,
    }));
    return [...optional, ...custom];
  }, [activeOptionalRubrics, customRubrics, rubricAmounts, t]);

  const entry = useMemo(() => {
    if (!legalSettings) return null;
    return computePayrollEntry(
      {
        employeeId: employee?.id ?? 'demo',
        cycleId: 'simulation',
        baseSalary: previewBaseSalary,
        overtimeAmount: Number(overtimeAmount) || 0,
        primes: [
          { id: 'anciennete', label: t('payroll.livePreview.seniorityBonus'), amount: Number(seniorityBonus) || 0, type: 'prime' },
          { id: 'transport', label: t('payroll.livePreview.transportBonus'), amount: Number(transportBonus) || 0, type: 'prime' },
          ...configuredRubricPrimes,
        ],
        retenues:
          Number(deductions) > 0
            ? [{ id: 'retenue', label: t('payroll.retenues'), amount: Number(deductions), type: 'retenue' }]
            : [],
        avances:
          Number(advances) > 0
            ? [{ id: 'avance', label: t('payroll.avances'), amount: Number(advances), type: 'avance' }]
            : [],
      },
      legalSettings
    );
  }, [
    employee,
    previewBaseSalary,
    legalSettings,
    overtimeAmount,
    seniorityBonus,
    transportBonus,
    configuredRubricPrimes,
    deductions,
    advances,
    t,
  ]);

  const isLoading = employeesLoading || legalLoading;

  // Alimente PayslipOfficialTemplate (mise en page "bulletin officiel") à
  // partir des mêmes entry/legalSettings/company que l'aperçu compact
  // ci-dessus — même calcul, juste une présentation différente.
  const officialTemplateData = useMemo(() => {
    if (!entry || !legalSettings || !company) return null;
    const countryMeta = COUNTRY_META[company.countryCode];
    const iutsBase = Math.max(0, entry.salaireBrut - entry.cnssEmployee);

    const earnings: PayslipOfficialRow[] = [
      { label: t('payroll.livePreview.baseSalary'), employeeAmount: entry.baseSalary },
      ...entry.primes.map((p) => ({ label: p.label, employeeAmount: p.amount })),
      // entry.indemnites reste vide côté simulateur (les rubriques du
      // catalogue y sont injectées comme "primes", voir configuredRubricPrimes
      // ci-dessus) — gardé pour rester symétrique avec PayslipPreviewDialog.tsx,
      // où indemnites porte réellement ces rubriques sur un bulletin généré.
      ...entry.indemnites.map((i) => ({ label: i.label, employeeAmount: i.amount })),
      ...(entry.overtimeAmount > 0
        ? [{ label: t('payroll.overtimeHours'), employeeAmount: entry.overtimeAmount }]
        : []),
    ];

    const contributions: PayslipOfficialRow[] = [
      {
        label: countryMeta.socialAgencyLabel,
        base: entry.baseSalary,
        rate: (legalSettings.cnssEmployeeRate ?? 0) / 100,
        employeeAmount: -entry.cnssEmployee,
        employerAmount: entry.cnssEmployer,
      },
      ...(entry.avances.length > 0
        ? [{ label: t('payroll.avances'), employeeAmount: -entry.avances[0].amount }]
        : []),
      ...(entry.retenues.length > 0
        ? [{ label: t('payroll.retenues'), employeeAmount: -entry.retenues[0].amount }]
        : []),
    ];

    const now = new Date();
    const employeeContributionsTotal =
      entry.cnssEmployee + (entry.avances[0]?.amount ?? 0) + (entry.retenues[0]?.amount ?? 0);

    return {
      company: {
        name: company.name,
        legalName: company.legalName,
        addressLine: [company.address, company.postalCode, company.city].filter(Boolean).join(', ') || undefined,
        taxIdLabel: countryMeta.taxIdLabel,
        taxIdNumber: company.taxIdNumber,
        socialAgencyLabel: countryMeta.socialAgencyLabel,
        socialSecurityNumber: company.socialSecurityNumber,
        employerNumbersOrder: countryMeta.employerNumbersOrder,
        activityCode: company.activityCode,
        collectiveAgreement: company.collectiveAgreement,
        logo: company.logo,
      },
      employee: {
        fullName: `${previewIdentity.firstName} ${previewIdentity.lastName}`.trim(),
        matricule: previewIdentity.matricule,
        hireDate: employee?.hireDate,
        address: employee ? [employee.address, employee.city].filter(Boolean).join(', ') : undefined,
        socialSecurityNumber: employee?.cnssNumber,
      },
      period: { label: formatPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`) },
      earnings,
      grossSalary: entry.salaireBrut,
      contributions,
      employeeContributionsTotal,
      employerContributionsTotal: entry.cnssEmployer,
      incomeTax: { label: countryMeta.incomeTaxLabel, base: iutsBase, rate: findBracketRate(iutsBase, legalSettings.iutsBrackets), amount: entry.iuts },
      netBeforeTax: entry.salaireBrut - entry.cnssEmployee,
      netToPay: entry.salaireNet,
      employerCost: entry.coutEmployeur,
      currencyCode: company.currencyCode,
    };
  }, [entry, legalSettings, company, previewIdentity, employee, t]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = () => {
    if (!entry) return;
    const companyAddress = [company?.address, company?.postalCode, company?.city].filter(Boolean).join(', ');
    downloadPayslipSimulationPdf({
      employee: previewIdentity,
      entry,
      currencyCode: company?.currencyCode,
      companyName: company?.name ?? t('app.name'),
      companyAddress: companyAddress || undefined,
      companyTaxId: company?.taxIdNumber,
      companyTaxIdLabel: company ? COUNTRY_META[company.countryCode].taxIdLabel : undefined,
      companySocialSecurityNumber: company?.socialSecurityNumber,
      labels: {
        documentTitle: t('payroll.livePreview.payslipPreview'),
        baseSalary: t('payroll.livePreview.baseSalary'),
        overtimeHours: t('payroll.overtimeHours'),
        salaireBrut: t('payroll.salaireBrut'),
        cnssEmployee: `${t('payroll.cnssEmployee')} (${legalSettings?.cnssEmployeeRate}%)`,
        iuts: incomeTaxLabel,
        avances: t('payroll.avances'),
        retenues: t('payroll.retenues'),
        netToPay: t('payroll.livePreview.netToPay'),
        cnssEmployer: `${t('payroll.cnssEmployer')} (${legalSettings?.cnssEmployerRate}%)`,
        employerCost: t('payroll.livePreview.employerCost'),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('app.back')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{t('payroll.livePreview.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('payroll.livePreview.subtitle')}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.variableElements')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('payroll.livePreview.selectEmployee')}</Label>
                {hasEmployees ? (
                  <Select value={employee?.id} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // Pas de blocage : l'aperçu à droite tourne déjà avec des
                  // valeurs par défaut, ce lien est juste une suggestion.
                  <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    <span>{t('payroll.livePreview.noEmployees')}</span>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/employees/new')}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                      {t('payroll.livePreview.addEmployeeCta')}
                    </Button>
                  </div>
                )}
                {!hasEmployees && (
                  <p className="text-xs text-muted-foreground">{t('payroll.livePreview.noEmployeesHint')}</p>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <VariableInput label={t('payroll.livePreview.overtimeAmount')} value={overtimeAmount} onChange={setOvertimeAmount} />
                <VariableInput label={t('payroll.livePreview.seniorityBonus')} value={seniorityBonus} onChange={setSeniorityBonus} />
                <VariableInput label={t('payroll.livePreview.transportBonus')} value={transportBonus} onChange={setTransportBonus} />
                <VariableInput label={t('payroll.retenues')} value={deductions} onChange={setDeductions} />
                <VariableInput label={t('payroll.avances')} value={advances} onChange={setAdvances} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('payroll.livePreview.configuredRubrics')}</Label>
                {hasConfiguredRubrics ? (
                  <div className="grid grid-cols-2 gap-4">
                    {activeOptionalRubrics.map((key) => (
                      <VariableInput
                        key={key}
                        label={t(optionalRubricLabelKey(key) ?? key)}
                        value={rubricAmounts[key] ?? '0'}
                        onChange={(value) => setRubricAmount(key, value)}
                      />
                    ))}
                    {customRubrics.map((rubric, index) => (
                      <VariableInput
                        key={`custom-${index}`}
                        label={rubric.label}
                        value={rubricAmounts[`custom-${index}`] ?? '0'}
                        onChange={(value) => setRubricAmount(`custom-${index}`, value)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    <span>{t('payroll.livePreview.noConfiguredRubrics')}</span>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/payroll/settings')}>
                      {t('payroll.componentsSetupCta')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.livePreview.payslipPreview')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {employee ? (
                  <>
                    {previewIdentity.firstName} {previewIdentity.lastName} · {previewIdentity.matricule}
                  </>
                ) : (
                  <span className="italic">
                    {previewIdentity.firstName} · {t('payroll.livePreview.noEmployeesHint')}
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              {entry ? (
                <div className="space-y-3 animate-fade-in" key={employee?.id}>
                  <PayslipLine label={t('payroll.livePreview.baseSalary')} value={entry.baseSalary} />
                  {entry.primes.map((p) => (
                    <PayslipLine key={p.id} label={p.label} value={p.amount} />
                  ))}
                  <PayslipLine label={t('payroll.overtimeHours')} value={entry.overtimeAmount} />
                  <Separator />
                  <PayslipLine label={t('payroll.salaireBrut')} value={entry.salaireBrut} strong />
                  <PayslipLine label={`${t('payroll.cnssEmployee')} (${legalSettings?.cnssEmployeeRate}%)`} value={-entry.cnssEmployee} />
                  <PayslipLine label={incomeTaxLabel} value={-entry.iuts} />
                  {entry.avances.length > 0 && <PayslipLine label={t('payroll.avances')} value={-entry.avances[0].amount} />}
                  {entry.retenues.length > 0 && <PayslipLine label={t('payroll.retenues')} value={-entry.retenues[0].amount} />}
                  <Separator />
                  <div className="rounded-lg bg-primary/10 p-3">
                    <PayslipLine label={t('payroll.livePreview.netToPay')} value={entry.salaireNet} strong />
                  </div>
                  <Separator />
                  <PayslipLine label={`${t('payroll.cnssEmployer')} (${legalSettings?.cnssEmployerRate}%)`} value={entry.cnssEmployer} />
                  <PayslipLine label={t('payroll.livePreview.employerCost')} value={entry.coutEmployeur} strong />
                  <Separator />
                  <Button variant="outline" className="w-full" onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('payroll.livePreview.downloadPdf')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('app.noData')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {officialTemplateData ? (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 print:hidden">
              <CardTitle className="text-base">Aperçu officiel du bulletin</CardTitle>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer / Enregistrer en PDF
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto bg-muted/30 p-6">
              {/* id="print-area" : voir @media print dans src/index.css —
                 Ctrl+P/"Enregistrer en PDF" n'imprime que ce bloc, pas le
                 reste de l'app (sidebar, formulaire de saisie...). */}
              <div id="print-area">
                <PayslipOfficialTemplate {...officialTemplateData} />
              </div>
            </CardContent>
          </Card>
        ) : (
          // Le bloc ci-dessus disparaissait silencieusement tant qu'aucun
          // barème légal n'était enregistré pour l'entreprise (cas de toute
          // entreprise nouvellement créée, quel que soit son pays) — sans ce
          // message, rien n'indique pourquoi le bulletin officiel n'apparaît
          // pas.
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between p-6 text-sm text-muted-foreground">
              <span>{t('payroll.livePreview.noLegalSettings')}</span>
              <Button variant="outline" size="sm" onClick={() => navigate('/payroll/legal-settings')}>
                {t('payroll.legalSettings')}
              </Button>
            </CardContent>
          </Card>
        )}
        </>
      )}
    </div>
  );
}
