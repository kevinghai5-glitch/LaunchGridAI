-- The "Fetch measured values" button: an operator-triggered, deliberately cheap
-- measure run during Zoom prep for businesses that actually booked.
--
-- Two calls only: one MOBILE-ONLY PageSpeed run and one plain homepage GET (the
-- already-unbilled fetchWebsitePage) for the booking-link and tel: booleans.
-- No Firecrawl, no desktop PSI, no DataForSEO — those exist to feed the paid
-- report's prose and leak detection, not these three values.
--
-- Stored SEPARATELY from researchSnapshot on purpose. A research capture implies
-- Firecrawl + DataForSEO + competitor search ran; this button runs none of them,
-- and a half-filled ResearchBundle would make an unrun scan indistinguishable
-- from a scan that came back empty. Each value here carries its own
-- found/none/unknown state instead.
--
-- Additive and nullable: every existing row stays valid, and a business with no
-- manual measure simply keeps rendering "—" for these values.
ALTER TABLE "Business" ADD COLUMN "measuredFacts"   JSONB;
ALTER TABLE "Business" ADD COLUMN "measuredFactsAt" TIMESTAMP(3);
