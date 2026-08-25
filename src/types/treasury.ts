// Formes réellement renvoyées par /api/treasury/* (server/src/routes/treasury.routes.ts).
// Remplace les types mock équivalents dans src/types/compta.ts.

import type { CurrencyCode } from '@/types';
import type { ComptaCountryCode } from '@/types/compta';

export type TreasuryAccountKind = 'banque' | 'mobile_money';
export type TreasuryMobileMoneyProvider = 'orange_money' | 'wave' | 'moov_money' | 'mtn_money' | 'm_pesa';
export type TreasuryTransactionSens = 'encaissement' | 'decaissement';
export type ReconciliationStatus = 'en_attente' | 'rapproche' | 'anomalie';

export interface TreasuryAccount {
  id: string;
  label: string;
  kind: TreasuryAccountKind;
  provider?: TreasuryMobileMoneyProvider;
  countryCode: ComptaCountryCode;
  currencyCode: CurrencyCode;
  openingBalance: number;
  solde: number;
  createdAt: string;
}

export interface TreasuryTransaction {
  id: string;
  accountId: string;
  accountLabel: string;
  kind: TreasuryAccountKind;
  provider?: TreasuryMobileMoneyProvider;
  date: string;
  libelle: string;
  montant: number;
  sens: TreasuryTransactionSens;
  statut: ReconciliationStatus;
  compteApparie: { compte: string; libelle: string } | null;
  matchedPaymentTransactionId?: string;
  createdAt: string;
}

export interface CreateTreasuryAccountInput {
  label: string;
  kind: TreasuryAccountKind;
  provider?: TreasuryMobileMoneyProvider;
  countryCode: ComptaCountryCode;
  currencyCode: CurrencyCode;
  openingBalance: number;
}

export interface ImportRow {
  date: string;
  libelle: string;
  montant: number;
}

export interface ImportResult {
  imported: number;
  autoMatched: number;
  transactions: TreasuryTransaction[];
}
