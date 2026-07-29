-- Phase 1 follow-up. Two intake questions that close the two STRUCTURAL gaps the
-- Phase 1 gap list surfaced — leaks that could never reach "disclosed" because no
-- question we asked could confirm them. Both additive and nullable; nothing to
-- backfill, every existing row stays valid.

-- 1) SOCIAL ENQUIRIES. Closes social_dm_unmanaged, which had no intake field at
--    all. Also carries double duty: "NO_ACCOUNTS" is the applicability fact that
--    switches the Social DM Capture workflow off in the build.
ALTER TABLE "Business" ADD COLUMN "socialEnquiries" TEXT;

-- 2) DATABASE DORMANCY. Closes no_database_reactivation. hasPastCustomerDatabase
--    stays (it answers "is there a list?", the applicability fact for the Database
--    Reactivation workflow) but it could only ever SUPPRESS the leak — "no list"
--    removes it and "yes" is what fires it — so it could not speak to the claim
--    the leak actually makes, which is that the list is going cold. This one can:
--    "SYSTEMATIC" suppresses, and OCCASIONAL / OVER_A_YEAR / NEVER confirm.
ALTER TABLE "Business" ADD COLUMN "pastCustomerContact" TEXT;
