-- CreateEnum
CREATE TYPE "TreasuryAccountKind" AS ENUM ('banque', 'mobile_money');

-- CreateEnum
CREATE TYPE "TreasuryMobileMoneyProvider" AS ENUM ('orange_money', 'wave', 'moov_money', 'mtn_money', 'm_pesa');

-- CreateEnum
CREATE TYPE "TreasuryTransactionSens" AS ENUM ('encaissement', 'decaissement');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('en_attente', 'rapproche', 'anomalie');

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "TreasuryAccountKind" NOT NULL,
    "provider" "TreasuryMobileMoneyProvider",
    "countryCode" "CountryCode" NOT NULL,
    "currencyCode" "CurrencyCode" NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "sens" "TreasuryTransactionSens" NOT NULL,
    "statut" "ReconciliationStatus" NOT NULL DEFAULT 'en_attente',
    "compteApparie" TEXT,
    "libelleCompteApparie" TEXT,
    "matchedPaymentTransactionId" TEXT,
    "importBatch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryTransaction" ADD CONSTRAINT "TreasuryTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
