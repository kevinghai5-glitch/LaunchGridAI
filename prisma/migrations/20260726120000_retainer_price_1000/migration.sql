-- Retainer price correction: the LeadGate monthly is CAD $1,000/mo, not $700.
-- Default only — existing Proposal rows keep whatever price they were sent at,
-- because a proposal already in a prospect's inbox must not silently reprice.
ALTER TABLE "Proposal" ALTER COLUMN "monthlyPrice" SET DEFAULT 1000;
