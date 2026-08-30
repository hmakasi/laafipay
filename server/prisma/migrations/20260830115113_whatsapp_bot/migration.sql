-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeaveType" ADD VALUE 'conge_anciennete';
ALTER TYPE "LeaveType" ADD VALUE 'examen_formation';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "whatsappPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappPinHash" TEXT,
ADD COLUMN     "whatsappPinLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "pdfUrl" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_phone_key" ON "WhatsAppSession"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppSession_employeeId_idx" ON "WhatsAppSession"("employeeId");

-- AddForeignKey
ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
