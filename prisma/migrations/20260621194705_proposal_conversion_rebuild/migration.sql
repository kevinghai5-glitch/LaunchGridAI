-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "agencyName" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "problem" JSONB,
ADD COLUMN     "proof" JSONB,
ADD COLUMN     "roi" JSONB,
ADD COLUMN     "scope" JSONB,
ADD COLUMN     "setupFee" INTEGER NOT NULL DEFAULT 6500,
ADD COLUMN     "timeline" JSONB,
ALTER COLUMN "monthlyPrice" SET DEFAULT 700,
ALTER COLUMN "benefits" SET DEFAULT '[]';
