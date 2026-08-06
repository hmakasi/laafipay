-- CreateEnum
CREATE TYPE "EmployeeOnboardingStatus" AS ENUM ('not_invited', 'invited', 'completed');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "onboardingStatus" "EmployeeOnboardingStatus" NOT NULL DEFAULT 'not_invited',
ADD COLUMN     "onboardingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_onboardingToken_key" ON "Employee"("onboardingToken");

