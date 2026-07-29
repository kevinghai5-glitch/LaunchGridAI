-- Phase 0.6. Two additions, both purely additive and all-nullable, so every
-- existing row stays valid and nothing needs backfilling.

-- 1) INTAKE: the five facts the leak detectors were already typed for and
--    consuming, but which had no column to read. Until now three leaks
--    (after-hours, missed calls, speed-to-lead) could only ever sit at benchmark
--    tier, because nothing in the schema could confirm or suppress them.
ALTER TABLE "Business" ADD COLUMN "hasCallTracking"    BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "hasOnlinePayment"   BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "afterHoursHandling" TEXT;
ALTER TABLE "Business" ADD COLUMN "missedCallHandling" TEXT;
ALTER TABLE "Business" ADD COLUMN "responseSpeed"      TEXT;

-- 2) GOVERNANCE OVERRIDE PAPER TRAIL: a fatal validator check blocks save and
--    export. When the operator overrides that block, these record which checks
--    were fatal, why they went ahead anyway, and when. Null on every normally
--    validated row, so "was this pack shipped with a known violation?" is
--    answerable later by a single IS NOT NULL.
ALTER TABLE "GeneratedSystem" ADD COLUMN "overrideReason"   TEXT;
ALTER TABLE "GeneratedSystem" ADD COLUMN "overriddenChecks" JSONB;
ALTER TABLE "GeneratedSystem" ADD COLUMN "overriddenAt"     TIMESTAMP(3);
