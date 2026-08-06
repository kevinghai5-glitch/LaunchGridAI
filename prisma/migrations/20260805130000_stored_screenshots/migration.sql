-- StoredScreenshot: screenshots fetched ONCE at generation and stored as bytes,
-- so the delivered document serves our own copy instead of a signed ScreenshotOne
-- URL. Fixes two things at once: ScreenshotOne bills per render (a signed URL in
-- the pack re-billed on every client open), and a signed URL leaks our access_key
-- in the document source. Served by id (unguessable cuid) with no auth, because
-- the client who opens the deliverable is not a logged-in user.
CREATE TABLE "StoredScreenshot" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "businessId"  TEXT,
    "contentType" TEXT NOT NULL,
    "bytes"       BYTEA NOT NULL,
    "byteSize"    INTEGER NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredScreenshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoredScreenshot_userId_idx" ON "StoredScreenshot"("userId");

ALTER TABLE "StoredScreenshot"
    ADD CONSTRAINT "StoredScreenshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
