-- CreateEnum
CREATE TYPE "EmployeeInviteStatus" AS ENUM ('not_invited', 'invited', 'completed');

-- DropIndex
DROP INDEX "Employee_onboardingToken_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "onboardingStatus",
DROP COLUMN "onboardingToken",
ADD COLUMN     "inviteStatus" "EmployeeInviteStatus" NOT NULL DEFAULT 'not_invited',
ADD COLUMN     "inviteToken" TEXT;

-- DropEnum
DROP TYPE "EmployeeOnboardingStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Employee_inviteToken_key" ON "Employee"("inviteToken");

