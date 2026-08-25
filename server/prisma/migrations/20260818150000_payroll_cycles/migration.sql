-- CreateEnum
CREATE TYPE "PayrollCycleStatus" AS ENUM ('brouillon', 'en_cours', 'valide', 'paye', 'archive');

-- CreateEnum
CREATE TYPE "PayrollEntryStatus" AS ENUM ('brouillon', 'valide');

-- CreateTable
CREATE TABLE "LegalSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "smig" DOUBLE PRECISION NOT NULL,
    "cnssEmployeeRate" DOUBLE PRECISION NOT NULL,
    "cnssEmployerRate" DOUBLE PRECISION NOT NULL,
    "iutsBrackets" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCycle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollCycleStatus" NOT NULL DEFAULT 'brouillon',
    "legalSettingsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,

    CONSTRAINT "PayrollCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "primes" JSONB NOT NULL,
    "indemnites" JSONB NOT NULL,
    "avances" JSONB NOT NULL,
    "retenues" JSONB NOT NULL,
    "absenceDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absenceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaireBrut" DOUBLE PRECISION NOT NULL,
    "cnssEmployee" DOUBLE PRECISION NOT NULL,
    "cnssEmployer" DOUBLE PRECISION NOT NULL,
    "iuts" DOUBLE PRECISION NOT NULL,
    "salaireNet" DOUBLE PRECISION NOT NULL,
    "coutEmployeur" DOUBLE PRECISION NOT NULL,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'brouillon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCycle_companyId_period_key" ON "PayrollCycle"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_cycleId_employeeId_key" ON "PayrollEntry"("cycleId", "employeeId");

-- AddForeignKey
ALTER TABLE "LegalSettings" ADD CONSTRAINT "LegalSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCycle" ADD CONSTRAINT "PayrollCycle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCycle" ADD CONSTRAINT "PayrollCycle_legalSettingsId_fkey" FOREIGN KEY ("legalSettingsId") REFERENCES "LegalSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayrollCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: un barème CNSS/IUTS par entreprise existante (valeurs légales
-- burkinabè 2024 réelles, déjà utilisées dans les mocks — pas de données
-- inventées), pour que le calcul de paie fonctionne dès la première création
-- de cycle sans configuration manuelle préalable.
INSERT INTO "LegalSettings" ("id", "companyId", "effectiveDate", "smig", "cnssEmployeeRate", "cnssEmployerRate", "iutsBrackets", "createdBy", "createdAt")
SELECT
    substr(md5(random()::text || clock_timestamp()::text || c."id"), 1, 25),
    c."id",
    '2024-01-01T00:00:00Z'::timestamp,
    34898,
    5.5,
    16,
    '[
        {"min": 0, "max": 30000, "rate": 0, "deduction": 0},
        {"min": 30001, "max": 50000, "rate": 10, "deduction": 3000},
        {"min": 50001, "max": 80000, "rate": 15, "deduction": 5500},
        {"min": 80001, "max": 120000, "rate": 20, "deduction": 9500},
        {"min": 120001, "max": 180000, "rate": 25, "deduction": 15500},
        {"min": 180001, "max": 280000, "rate": 30, "deduction": 24500},
        {"min": 280001, "max": 480000, "rate": 35, "deduction": 38500},
        {"min": 480001, "max": null, "rate": 40, "deduction": 62500}
    ]'::jsonb,
    'system-backfill',
    now()
FROM "Company" c;
