-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "psiSnapshot" JSONB,
ADD COLUMN     "psiSnapshotAt" TIMESTAMP(3);
