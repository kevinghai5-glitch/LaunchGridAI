-- Soft delete: never hard-delete. Every "clear/remove/delete" sets deletedAt and
-- the row stays in the DB, filtered out of reads via deletedAt IS NULL.
ALTER TABLE "Business" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "GeneratedSystem" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CallLog" ADD COLUMN "deletedAt" TIMESTAMP(3);
