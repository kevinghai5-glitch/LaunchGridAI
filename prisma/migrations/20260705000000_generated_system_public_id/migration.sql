-- Add a public share id to GeneratedSystem so cold audits can be hosted at
-- /a/[publicId]. Add nullable, backfill existing rows, then enforce NOT NULL +
-- unique so pre-existing audits get a stable public link too.
ALTER TABLE "GeneratedSystem" ADD COLUMN "publicId" TEXT;

UPDATE "GeneratedSystem" SET "publicId" = gen_random_uuid()::text WHERE "publicId" IS NULL;

ALTER TABLE "GeneratedSystem" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "GeneratedSystem_publicId_key" ON "GeneratedSystem"("publicId");
