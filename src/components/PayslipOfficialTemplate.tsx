import { formatCurrency, formatDate } from '@/lib/utils';
import { resolveUploadUrl } from '@/lib/apiClient';
import { CurrencyCode } from '@/types';

export interface PayslipOfficialRow {
  label: string;
  quantity?: string; // "Nombre" — ex. heures supplémentaires ; vide sinon, jamais inventé
  base?: number;
  rate?: number; // fraction (0.055 = 5,5 %)
  employeeAmount?: number; // positif = gain, négatif = retenue
  employerAmount?: number;
}

export interface PayslipOfficialTemplateProps {
  company: {
    name: string;
    legalName?: string;
    addressLine?: string;
    taxIdLabel: string; // "NIF"/"IFU"/"ID.NAT" selon le pays — jamais "SIRET"
    taxIdNumber?: string;
    socialAgencyLabel: string; // "CNSS"/"INSS" selon le pays — jamais "URSSAF"
    socialSecurityNumber?: string;
    employerNumbersOrder: Array<'taxId' | 'cnss'>; // ordre d'affichage IFU/NIF vs CNSS, propre au pays — voir COUNTRY_META
    activityCode?: string;
    collectiveAgreement?: string;
    logo?: string;
  };
  employee: {
    fullName: string;
    matricule: string;
    hireDate?: string;
    address?: string;
    socialSecurityNumber?: string;
  };
  period: {
    label: string; // "Juillet 2026"
    startDate?: string;
    endDate?: string;
    paymentDate?: string;
    paymentMethod?: string;
  };
  earnings: PayslipOfficialRow[];
  grossSalary: number;
  contributions: PayslipOfficialRow[];
  employeeContributionsTotal: number;
  employerContributionsTotal: number;
  incomeTax: { label: string; base: number; rate: number; amount: number };
  netBeforeTax: number;
  netToPay: number;
  employerCost: number;
  currencyCode: CurrencyCode;
  leaveBalance?: { acquired: number; taken: number; remaining: number };
}

const TH = 'border border-black bg-slate-200 px-1.5 py-1 text-left font-semibold uppercase';
const TD = 'border border-black px-1.5 py-1';
const money = (n: number | undefined, currency: CurrencyCode) => (n === undefined ? '' : formatCurrency(n, currency));
const pct = (n: number | undefined) => (n === undefined ? '' : `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`);

function RubricRows({ rows, currency }: { rows: PayslipOfficialRow[]; currency: CurrencyCode }) {
  return (
    <>
      {rows.map((row, i) => (
        <tr key={`${row.label}-${i}`}>
          <td className={TD}>{row.label}</td>
          <td className={`${TD} text-right`}>{row.quantity ?? ''}</td>
          <td className={`${TD} text-right tabular-nums`}>{money(row.base, currency)}</td>
          <td className={`${TD} text-right tabular-nums`}>{pct(row.rate)}</td>
          <td className={`${TD} text-right tabular-nums`}>
            {row.employeeAmount !== undefined
              ? `${row.employeeAmount < 0 ? '-' : ''}${money(Math.abs(row.employeeAmount), currency)}`
              : ''}
          </td>
          <td className={`${TD} text-right tabular-nums`}>
            {row.employerAmount !== undefined ? money(row.employerAmount, currency) : ''}
          </td>
        </tr>
      ))}
    </>
  );
}

// Réplique la structure/densité d'un bulletin de paie officiel (bandeau
// titre, bloc employeur/salarié, tableau de rubriques, totaux encadrés,
// format A4) — mais avec les rubriques réellement calculées par le moteur
// LaafiPay (CNSS/INPP/ONEM, IUTS/IRPP/IPR selon le pays de l'entreprise),
// pas le découpage par branche URSSAF (Santé/AT/Retraite/Famille/Chômage)
// d'un bulletin français, qui n'a pas d'équivalent dans les données
// calculées ici. Pas de "Montant Net Social" (notion propre au droit
// français, aucun calcul défini pour ce pays) ni de cumul annuel d'impôt
// (nécessiterait un suivi inter-cycles que le moteur ne fait pas encore).
export function PayslipOfficialTemplate({
  company,
  employee,
  period,
  earnings,
  grossSalary,
  contributions,
  employeeContributionsTotal,
  employerContributionsTotal,
  incomeTax,
  netBeforeTax,
  netToPay,
  employerCost,
  currencyCode,
  leaveBalance,
}: PayslipOfficialTemplateProps) {
  return (
    <div className="mx-auto min-h-[297mm] w-[210mm] bg-white p-8 font-sans text-[10px] leading-tight text-black">
      {/* 1. Bandeau supérieur */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-2">
        {company.logo ? (
          <img src={resolveUploadUrl(company.logo)} alt={company.name} className="h-10 max-w-[120px] object-contain" />
        ) : (
          <div className="h-10 w-[120px] border border-dashed border-slate-300" aria-hidden="true" />
        )}
        <h1 className="text-base font-bold uppercase">Bulletin de paye</h1>
      </div>

      {/* Bloc employeur (gauche) / salarié + période (droite) */}
      <div className="mt-2 grid grid-cols-2 gap-4 border-b border-primary pb-3">
        <div>
          <div className="font-bold">{company.legalName ?? company.name}</div>
          {company.addressLine && <div>{company.addressLine}</div>}
          {company.employerNumbersOrder.map((field) =>
            field === 'taxId' ? (
              company.taxIdNumber && (
                <div key="taxId">
                  {company.taxIdLabel} : {company.taxIdNumber}
                </div>
              )
            ) : (
              company.socialSecurityNumber && (
                <div key="cnss">
                  {company.socialAgencyLabel} employeur : {company.socialSecurityNumber}
                </div>
              )
            ),
          )}
          {company.activityCode && <div>Code activité : {company.activityCode}</div>}
          {company.collectiveAgreement && <div>Convention collective : {company.collectiveAgreement}</div>}
        </div>

        <div className="text-right">
          <div className="mb-1 inline-block border border-black px-2 py-0.5 font-semibold">
            Période : {period.label}
          </div>
          {period.paymentDate && (
            <div>
              Paiement le {formatDate(period.paymentDate)}
              {period.paymentMethod ? ` — ${period.paymentMethod}` : ''}
            </div>
          )}
          <div className="mt-1 text-base font-bold">{employee.fullName}</div>
          <div>Matricule : {employee.matricule}</div>
          {employee.hireDate && (
            <div>
              Embauché(e) le {formatDate(employee.hireDate)}
              {' — '}ancienneté {seniorityLabel(employee.hireDate)}
            </div>
          )}
          {employee.socialSecurityNumber && (
            <div>
              {company.socialAgencyLabel} : {employee.socialSecurityNumber}
            </div>
          )}
          {employee.address && <div>{employee.address}</div>}
        </div>
      </div>

      {/* 2. Congés & absences */}
      {leaveBalance && (
        <table className="mt-3 w-64 border-collapse">
          <thead>
            <tr>
              <th className={TH}>Congés payés</th>
              <th className={`${TH} text-right`}>Acquis</th>
              <th className={`${TH} text-right`}>Pris</th>
              <th className={`${TH} text-right`}>Restant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>Solde</td>
              <td className={`${TD} text-right tabular-nums`}>{leaveBalance.acquired}</td>
              <td className={`${TD} text-right tabular-nums`}>{leaveBalance.taken}</td>
              <td className={`${TD} text-right tabular-nums`}>{leaveBalance.remaining}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 3. Tableau central des rubriques */}
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>Libellé</th>
            <th className={`${TH} text-right`}>Nombre</th>
            <th className={`${TH} text-right`}>Base</th>
            <th className={`${TH} text-right`}>Taux</th>
            <th className={`${TH} text-right`}>Part salariale</th>
            <th className={`${TH} text-right`}>Part patronale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className={`${TD} bg-slate-100 font-bold uppercase`}>
              Rémunération
            </td>
          </tr>
          <RubricRows rows={earnings} currency={currencyCode} />
          <tr>
            <td className={`${TD} font-bold`}>Montant brut</td>
            <td className={TD} />
            <td className={TD} />
            <td className={TD} />
            <td className={`${TD} text-right font-bold tabular-nums`} colSpan={2}>
              {money(grossSalary, currencyCode)}
            </td>
          </tr>

          <tr>
            <td colSpan={6} className={`${TD} bg-slate-100 font-bold uppercase`}>
              Cotisations et retenues
            </td>
          </tr>
          <RubricRows rows={contributions} currency={currencyCode} />
          <tr>
            <td className={`${TD} font-bold uppercase`}>Total des cotisations et contributions</td>
            <td className={TD} />
            <td className={TD} />
            <td className={TD} />
            <td className={`${TD} text-right font-bold tabular-nums`}>
              -{money(employeeContributionsTotal, currencyCode)}
            </td>
            <td className={`${TD} text-right font-bold tabular-nums`}>{money(employerContributionsTotal, currencyCode)}</td>
          </tr>
        </tbody>
      </table>

      {/* 4. Totalisations & pied de page */}
      <div className="mt-3 flex justify-between border border-black bg-slate-50 p-2 font-semibold">
        <span>Net avant impôt</span>
        <span className="tabular-nums">{money(netBeforeTax, currencyCode)}</span>
      </div>

      <table className="mt-2 w-72 border-collapse">
        <thead>
          <tr>
            <th className={TH}>Impôt sur le revenu</th>
            <th className={`${TH} text-right`}>Base</th>
            <th className={`${TH} text-right`}>Taux</th>
            <th className={`${TH} text-right`}>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>{incomeTax.label}</td>
            <td className={`${TD} text-right tabular-nums`}>{money(incomeTax.base, currencyCode)}</td>
            <td className={`${TD} text-right tabular-nums`}>{pct(incomeTax.rate)}</td>
            <td className={`${TD} text-right tabular-nums`}>-{money(incomeTax.amount, currencyCode)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex justify-between border-4 border-black bg-slate-200 p-3 text-sm font-bold">
        <span>Net à payer ({currencyCode})</span>
        <span className="tabular-nums">{money(netToPay, currencyCode)}</span>
      </div>

      <div className="mt-2 flex justify-between border border-black p-2 font-semibold">
        <span>Total versé par l'employeur</span>
        <span className="tabular-nums">{money(employerCost, currencyCode)}</span>
      </div>

      <p className="mt-4 text-center text-[9px] text-slate-500">
        Bulletin édité le {formatDate(new Date().toISOString())} — à conserver sans limitation de durée.
      </p>
    </div>
  );
}

function seniorityLabel(hireDateIso: string): string {
  const hire = new Date(hireDateIso);
  const now = new Date();
  let months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const remMonths = Math.max(0, months % 12);
  return years > 0 ? `${years} an${years > 1 ? 's' : ''} ${remMonths} mois` : `${remMonths} mois`;
}
