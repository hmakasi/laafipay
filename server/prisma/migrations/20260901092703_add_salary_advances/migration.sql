-- CreateEnum
CREATE TYPE "AdvanceChannel" AS ENUM ('whatsapp', 'portail');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('en_attente', 'rejete', 'approuve', 'verse_mobile_money', 'en_remboursement', 'rembourse');

-- AlterTable
ALTER TABLE "PayrollConfig" ADD COLUMN     "maxAdvancePercent" DOUBLE PRECISION NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remainingBalance" DOUBLE PRECISION NOT NULL,
    "channel" "AdvanceChannel" NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'en_attente',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "mobileMoneyOperator" "MobileMoneyOperator",
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceDeduction" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payrollEntryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_companyId_status_idx" ON "SalaryAdvance"("companyId", "status");

-- CreateIndex
CREATE INDEX "AdvanceDeduction_advanceId_idx" ON "AdvanceDeduction"("advanceId");

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceDeduction" ADD CONSTRAINT "AdvanceDeduction_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
