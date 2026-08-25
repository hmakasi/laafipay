-- AlterTable
ALTER TABLE "ComptaJournalEntry" ADD COLUMN     "paymentValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentValidatedAt" TIMESTAMP(3),
ADD COLUMN     "paymentValidatedBy" TEXT;
