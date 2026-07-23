-- Intake system booleans (null = unknown / not asked) + services-focus copy hint.
ALTER TABLE "Business" ADD COLUMN "hasCrm" BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "hasFollowUpSequence" BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "hasReminderSystem" BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "hasPastCustomerDatabase" BOOLEAN;
ALTER TABLE "Business" ADD COLUMN "servicesFocus" TEXT;
