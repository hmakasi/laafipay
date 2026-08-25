-- CreateEnum
CREATE TYPE "PayslipSendStatus" AS ENUM ('non_envoye', 'envoye', 'lu', 'echoue');

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "emailStatus" "PayslipSendStatus" NOT NULL DEFAULT 'non_envoye',
    "whatsappStatus" "PayslipSendStatus" NOT NULL DEFAULT 'non_envoye',
    "smsStatus" "PayslipSendStatus" NOT NULL DEFAULT 'non_envoye',
    "emailSentAt" TIMESTAMP(3),
    "whatsappSentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "salaireBrut" DOUBLE PRECISION NOT NULL,
    "salaireNet" DOUBLE PRECISION NOT NULL,
    "cnssEmployee" DOUBLE PRECISION NOT NULL,
    "iuts" DOUBLE PRECISION NOT NULL,
    "primes" JSONB NOT NULL,
    "indemnites" JSONB NOT NULL,
    "avances" JSONB NOT NULL,
    "retenues" JSONB NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_cycleId_employeeId_key" ON "Payslip"("cycleId", "employeeId");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayrollCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
