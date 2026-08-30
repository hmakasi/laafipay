-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('bulletin_disponible', 'conge_valide', 'conge_refuse', 'paiement_effectue', 'paiement_echoue', 'contrat_expire', 'essai_termine', 'action_requise', 'entretien_ouvert', 'entretien_a_completer', 'entretien_termine', 'avis_pair_demande', 'avis_pair_soumis');

-- AlterTable
ALTER TABLE "PerformanceReview" ADD COLUMN     "managerCompetencyRatings" JSONB,
ADD COLUMN     "selfCompetencyRatings" JSONB;

-- CreateTable
CREATE TABLE "ReviewConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competencies" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerFeedbackRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "peerEmployeeId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback" TEXT,
    "rating" INTEGER,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PeerFeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewConfig_companyId_key" ON "ReviewConfig"("companyId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "PeerFeedbackRequest_companyId_idx" ON "PeerFeedbackRequest"("companyId");

-- CreateIndex
CREATE INDEX "PeerFeedbackRequest_peerEmployeeId_idx" ON "PeerFeedbackRequest"("peerEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PeerFeedbackRequest_reviewId_peerEmployeeId_key" ON "PeerFeedbackRequest"("reviewId", "peerEmployeeId");

-- AddForeignKey
ALTER TABLE "ReviewConfig" ADD CONSTRAINT "ReviewConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerFeedbackRequest" ADD CONSTRAINT "PeerFeedbackRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerFeedbackRequest" ADD CONSTRAINT "PeerFeedbackRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerFeedbackRequest" ADD CONSTRAINT "PeerFeedbackRequest_peerEmployeeId_fkey" FOREIGN KEY ("peerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
