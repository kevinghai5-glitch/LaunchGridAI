-- LeakAssessment — the leak calculator, saved against a business.
--
-- The first of the two sources of truth about a client: what they told us live
-- on the sales call, priced against their own two numbers. Everything
-- client-facing downstream reads this row.
--
-- WHY `computed` IS STORED RATHER THAN DERIVED ON READ: the inputs alone would
-- be enough to recompute, but then a later change to a band or a default would
-- silently restate figures a client has already been shown and signed against.
-- Freezing the computed result is what makes the shareable page and the
-- Diagnosis document agree by construction instead of by coincidence.
--
-- One row per business (businessId UNIQUE), updated in place — this is a live
-- working figure meant to change while the operator is on the call, not an
-- audit record.
CREATE TABLE "LeakAssessment" (
    "id"               TEXT NOT NULL,
    "businessId"       TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "monthlyEnquiries" INTEGER,
    "avgJobValue"      INTEGER,
    "answers"          JSONB NOT NULL,
    "customRows"       JSONB NOT NULL,
    "closeRatePct"     INTEGER NOT NULL DEFAULT 30,
    "overlapPct"       INTEGER NOT NULL DEFAULT 30,
    "capPct"           INTEGER NOT NULL DEFAULT 20,
    "computed"         JSONB NOT NULL,
    "computedAt"       TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeakAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeakAssessment_businessId_key" ON "LeakAssessment"("businessId");
CREATE INDEX "LeakAssessment_userId_idx" ON "LeakAssessment"("userId");

ALTER TABLE "LeakAssessment"
    ADD CONSTRAINT "LeakAssessment_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeakAssessment"
    ADD CONSTRAINT "LeakAssessment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
