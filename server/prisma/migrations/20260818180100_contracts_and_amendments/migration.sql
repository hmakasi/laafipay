-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('actif', 'termine', 'rompu');

-- CreateEnum
CREATE TYPE "AmendmentType" AS ENUM ('renouvellement', 'changement_poste', 'changement_salaire', 'changement_departement', 'prolongation', 'autre');

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "contractType" "ContractType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "position" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'actif',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "AmendmentType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : un contrat "courant" par employé existant, reprenant ses champs
-- plats actuels — pour que chaque employé déjà en base (démo + comptes
-- réels) ait un historique de contrat dès le lancement de la fonctionnalité.
INSERT INTO "Contract" ("id", "employeeId", "contractType", "startDate", "endDate", "trialEndDate", "position", "departmentId", "baseSalary", "status", "isCurrent", "createdBy", "createdAt", "updatedAt")
SELECT
    substr(md5(random()::text || clock_timestamp()::text || e."id"), 1, 25),
    e."id",
    e."contractType",
    e."hireDate",
    e."contractEndDate",
    e."trialEndDate",
    e."position",
    e."departmentId",
    e."baseSalary",
    'actif',
    true,
    'system-backfill',
    now(),
    now()
FROM "Employee" e;
