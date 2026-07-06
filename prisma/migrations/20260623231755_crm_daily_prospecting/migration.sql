-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';
