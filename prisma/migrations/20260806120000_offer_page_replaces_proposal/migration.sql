-- The generated proposal is replaced by the client-facing offer page, which is
-- assembled from the saved calculator. Two changes, both additive.

-- 1 · The offer's share id. Added nullable, backfilled, then constrained, so an
--     existing assessment keeps working and nothing needs a default at the DB.
ALTER TABLE "LeakAssessment" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
UPDATE "LeakAssessment" SET "publicId" = gen_random_uuid()::text WHERE "publicId" IS NULL;
ALTER TABLE "LeakAssessment" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "LeakAssessment_publicId_key" ON "LeakAssessment"("publicId");

-- 2 · Retire every existing proposal. SOFT DELETE ONLY — the rows, their public
--     ids, their prices and their timestamps all stay in the database forever.
--     Nothing reads them any more; nothing has destroyed them either.
UPDATE "Proposal" SET "deletedAt" = NOW() WHERE "deletedAt" IS NULL;
