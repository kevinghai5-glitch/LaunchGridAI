-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "closedReason" TEXT,
ADD COLUMN     "followUpUntil" TIMESTAMP(3),
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'QUEUED';

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "note" TEXT,
    "durationSec" INTEGER,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallLog_businessId_idx" ON "CallLog"("businessId");

-- CreateIndex
CREATE INDEX "CallLog_userId_idx" ON "CallLog"("userId");

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
