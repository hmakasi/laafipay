-- CreateEnum
CREATE TYPE "ComptaOutboxStatus" AS ENUM ('en_attente', 'envoye', 'echec');

-- CreateEnum
CREATE TYPE "ComptaJournalCode" AS ENUM ('OD', 'AC');

-- CreateTable
CREATE TABLE "ComptaOutboxEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'payroll.cycle.valide',
    "payload" JSONB NOT NULL,
    "status" "ComptaOutboxStatus" NOT NULL DEFAULT 'en_attente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "ComptaOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComptaJournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "journal" "ComptaJournalCode" NOT NULL,
    "piece" TEXT NOT NULL,
    "dateEcriture" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'LaafiPay',
    "sourceEventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComptaJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComptaJournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "compte" TEXT NOT NULL,
    "libelleCompte" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ComptaJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComptaOutboxEvent_cycleId_key" ON "ComptaOutboxEvent"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ComptaJournalEntry_sourceEventId_key" ON "ComptaJournalEntry"("sourceEventId");

-- AddForeignKey
ALTER TABLE "ComptaOutboxEvent" ADD CONSTRAINT "ComptaOutboxEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComptaOutboxEvent" ADD CONSTRAINT "ComptaOutboxEvent_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayrollCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComptaJournalEntry" ADD CONSTRAINT "ComptaJournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComptaJournalLine" ADD CONSTRAINT "ComptaJournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ComptaJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
