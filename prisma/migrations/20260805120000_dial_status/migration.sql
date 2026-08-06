-- Dial status: the do-not-call / compliance axis (see src/lib/dial-status.ts).
--
-- WHY a new axis rather than reusing "Business"."status": that column runs the
-- CRM/call-queue pipeline and only advances when a call outcome is logged IN THE
-- APP. Dialing 10k businesses from a GoHighLevel CSV means outcomes are never
-- logged in-app, so "status" cannot answer "have I already dialed this one?".
-- "dialStatus" answers exactly that and is set without any in-app logging — the
-- CSV export flips it to 'dialed' automatically. The generator consults it as the
-- single authority on eligibility: only 'fresh' businesses are ever served.
--
-- Additive with a DEFAULT, so every existing row is backfilled to 'fresh' in the
-- same statement. That is safe: the generator ALSO dedupes by googlePlaceId, so
-- existing rows stay excluded regardless; the campaign this exists for is going
-- forward, where dialStatus is authoritative.
ALTER TABLE "Business" ADD COLUMN "dialStatus"   TEXT NOT NULL DEFAULT 'fresh';
ALTER TABLE "Business" ADD COLUMN "dialStatusAt" TIMESTAMP(3);

-- Append-only history of every dial-status transition. No soft-delete column on
-- purpose: this is an audit record for the do-not-call obligation, and deleting a
-- row would be rewriting the very history it exists to preserve.
CREATE TABLE "DialStatusEvent" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "status"     TEXT NOT NULL,
    "source"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DialStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DialStatusEvent_businessId_idx" ON "DialStatusEvent"("businessId");
CREATE INDEX "DialStatusEvent_userId_idx" ON "DialStatusEvent"("userId");

ALTER TABLE "DialStatusEvent"
    ADD CONSTRAINT "DialStatusEvent_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DialStatusEvent"
    ADD CONSTRAINT "DialStatusEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
