-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('BF', 'BJ', 'CD');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('XOF', 'CDF', 'USD');

-- AlterTable
-- Ajoutées nullable d'abord : 6 entreprises existent déjà en base et
-- violeraient un NOT NULL immédiat (voir backfill ci-dessous).
ALTER TABLE "Company" ADD COLUMN "countryCode" "CountryCode";
ALTER TABLE "Company" ADD COLUMN "currencyCode" "CurrencyCode";

-- Backfill : LaafiPay n'a servi que le Burkina Faso jusqu'à cette migration,
-- l'ancienne colonne "country" (texte libre) était d'ailleurs vide pour
-- toutes les entreprises sauf la démo ("Burkina Faso").
UPDATE "Company" SET "countryCode" = 'BF', "currencyCode" = 'XOF' WHERE "countryCode" IS NULL;

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "countryCode" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "currencyCode" SET NOT NULL;

-- AlterTable
-- Supprime l'ancienne colonne "country" (texte libre, jamais renseignée par
-- le frontend), remplacée par "countryCode".
ALTER TABLE "Company" DROP COLUMN "country";
