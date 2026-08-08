-- Duplicate protection for the 10k cold-call campaign.
--
-- Dedup was application-only: the generator builds an exclude-set of every
-- placeId the operator has already seen. That works for the generator and does
-- not bind anything else — a manual add through POST /api/businesses, or two
-- generate requests racing each other, can both insert the same place. One
-- duplicate already exists in the data from exactly that path (a generated
-- "Law Firm" and a hand-added "Consultant", same Google place).
--
-- PARTIAL, on live rows only. Soft-deleted rows are excluded on purpose: a
-- declined prospect keeps its row forever (nothing here is ever hard-deleted),
-- and it must not block the same place being legitimately re-added later. The
-- application-level exclude-set is STRICTER than this index — it also holds back
-- soft-deleted and do_not_call rows — so this is a backstop, not the rule.
--
-- Verified before applying: zero live duplicate (userId, googlePlaceId) pairs.
CREATE UNIQUE INDEX IF NOT EXISTS "Business_userId_googlePlaceId_live_key"
  ON "Business" ("userId", "googlePlaceId")
  WHERE "googlePlaceId" IS NOT NULL AND "deletedAt" IS NULL;
