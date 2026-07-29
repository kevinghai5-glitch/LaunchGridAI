-- Phase 2 follow-up. The two applicability facts the workflow catalogue had to
-- model as operator-set-only because no column carried them. Both additive and
-- nullable; nothing to backfill.

-- 1) TEXT-TO-PAY APPLICABILITY. "Do you take a deposit or payment before the work
--    is done?" — ALWAYS | SOMETIMES | NEVER.
--    Kept SEPARATE from hasOnlinePayment on purpose: the two look alike and point
--    opposite ways. Taking deposits with no online mechanism is the strongest
--    Text-to-Pay case, not the weakest — that business is chasing e-transfers by
--    hand. Only NEVER switches the workflow off.
ALTER TABLE "Business" ADD COLUMN "takesDeposits" TEXT;

-- 2) REVIEW RESPONSE APPLICABILITY. "Who replies to your Google reviews right
--    now?" — NOBODY | OWNER | STAFF_OR_AGENCY.
--    A process question rather than a preference question, so the answer is a fact
--    about how the business runs rather than an invitation to negotiate scope.
--    NOBODY is a finding in its own right; OWNER makes switching the workflow off
--    reasonable but never automatic.
ALTER TABLE "Business" ADD COLUMN "reviewReplyOwner" TEXT;
