// Determinism fix 2 · Research snapshot reuse.
//
// Enrichment (native page fetch, Google Places reviews, local competitors,
// Firecrawl site scrape, DataForSeo) is LIVE — every fetch can drift run to run
// (a new review lands, a competitor's count ticks up, a widget appears, a
// transient bot-wall flips a signal). That drift used to leak straight into the
// deliverables: two regenerations of the same business could disagree on which
// leaks fired, their tiers, the grades, and the dollar math.
//
// Fix: capture the whole enrichment bundle ONCE per business, persist it, and
// reuse those exact values on every regenerate. A regenerate is therefore a
// zero-scrape, zero-API-cost operation. Fresh data is a deliberate choice —
// `forceRefresh` (the "refresh research" action) re-measures and re-persists —
// never an accident. The bundle also carries an `asOf` timestamp that freezes
// any date-window logic downstream (fix 3), so even wall-clock drift can't move
// a fact between runs.

import { prisma } from "@/lib/prisma";
import { fetchWebsitePage, type WebsitePage } from "@/lib/website-analyzer";
import {
  fetchPlaceReviews,
  findCompetitors,
  type PlaceReview,
  type CompetitorResult,
} from "@/lib/google-places";
// firecrawlSite is no longer CALLED here (see captureResearch). The type is
// still the bundle's shape, and the function is still live in owner-name.ts.
import type { FirecrawlScrape } from "@/lib/firecrawl";
import type { DataForSeoBundle } from "@/lib/dataforseo";
import { extractOwnersFromText } from "@/lib/owner-name";

// Reuse a snapshot for 30 days before re-capturing — same TTL as the PSI snapshot
// so the two research layers refresh on the same cadence.
const RESEARCH_SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** The full, reusable enrichment bundle for one business. Serialized verbatim to
 *  `Business.researchSnapshot`; cast back on read. */
export interface ResearchBundle {
  /** ISO timestamp the research was captured. The single research-as-of clock:
   *  date-window logic (e.g. 90-day review recency) measures against this, not
   *  wall-clock, so a fact can't move between runs (fix 3). */
  asOf: string;
  page: WebsitePage;
  reviews: PlaceReview[];
  competitors: CompetitorResult[];
  scrape: FirecrawlScrape;
  dfs: DataForSeoBundle;
}

/** Identity + persisted-snapshot fields the resolver needs. */
export interface ResearchSnapshotHost {
  id: string;
  name: string;
  website: string | null;
  address: string | null;
  city: string | null;
  industry: string | null;
  category: string | null;
  googlePlaceId: string | null;
  researchSnapshot: unknown;
  researchSnapshotAt: Date | null;
  /** Cached owner/decision-maker name. When already set, owner enrichment is
   *  skipped entirely so regenerate stays zero-cost. */
  ownerName: string | null;
}

/** Concatenate the scraped About/Team/Contact text (falling back to the native
 *  page) into the corpus the owner-name extractor reads.
 *
 *  SINCE THE SCRAPE WENT DORMANT this always takes the fallback branch: the
 *  corpus is the native homepage text, not the About/Team/Contact subpages. The
 *  first branch is kept because it is also the code path for a bundle captured
 *  BEFORE the scrape was retired, and those snapshots are cached for 30 days.
 *
 *  This is a narrow degradation and it does NOT touch the dial CSV. That owner
 *  name is resolved by /api/opportunities/owner and /api/opportunities/triage,
 *  which call resolveOwnerFromWebsite / resolveOwnersBatch in owner-name.ts —
 *  still fully live, still using Firecrawl. This path is the secondary one: it
 *  only runs during pack generation, and only when the row has no owner yet. */
function ownerCorpus(bundle: ResearchBundle): string {
  const parts: string[] = [];
  if (bundle.scrape.used && bundle.scrape.homepage) {
    parts.push(bundle.scrape.homepage.markdown || bundle.scrape.homepage.html);
    for (const sp of bundle.scrape.subpages) parts.push(sp.markdown || sp.html);
  } else if (bundle.page?.text) {
    parts.push(bundle.page.text);
  }
  return parts.filter(Boolean).join("\n\n");
}

/** A bundle is usable if we got at least one substantive signal — otherwise a
 *  total-outage capture shouldn't overwrite a good stored snapshot. */
function bundleIsUsable(b: ResearchBundle): boolean {
  return (
    b.scrape.used ||
    b.page.text.length > 0 ||
    b.reviews.length > 0 ||
    b.competitors.length > 0 ||
    b.dfs.available
  );
}

/** Fetch every enrichment source live, in parallel. This is the ONLY path that
 *  spends scrape/API budget. */
async function captureResearch(host: ResearchSnapshotHost): Promise<ResearchBundle> {
  // ── TWO SOURCES ARE DORMANT (Phase 5, 2026-08-06) ─────────────────────────
  // They are not deleted and their modules are untouched — they are simply not
  // CALLED here any more. Both already had a well-defined "off" shape for the
  // no-API-key case, so every downstream consumer has always handled it: this is
  // the documented "Firecrawl-disabled run", now the only run.
  //
  //   FIRECRAWL multi-page scrape. It fed richer markdown into the generation
  //   prompt for documents that no longer exist — the Diagnosis is the saved
  //   calculator and the Build Plan is the catalogue, and neither reads scraped
  //   prose. firecrawlSite() and firecrawlSearch() STAY EXPORTED and stay live in
  //   src/lib/owner-name.ts, which feeds the owner name into the dial CSV.
  //
  //   DATAFORSEO in full. Its GBP profile and review intel fed the same generated
  //   prose. It is NOT where the local review median comes from — that is
  //   findCompetitors + localMedian in observed-facts.ts, which is untouched and
  //   still needs the full competitor set.
  //
  // WHAT THIS COSTS, stated rather than discovered later: a business with NO
  // website on record used to get its booking-link verdict from the GBP profile
  // (observed-facts.ts: `dfs?.gbp.hasBookingLink`). That fallback now yields
  // "unknown", which renders as "—". Honest, and narrower than it sounds: with a
  // website on record the verdict comes from the scan and is unaffected.
  const [page, reviews, competitors] = await Promise.all([
    fetchWebsitePage(host.website),
    fetchPlaceReviews(host.googlePlaceId),
    // STAYS. The review median is quoted from the whole local set.
    findCompetitors(host.industry ?? host.category, host.city, host.googlePlaceId),
  ]);
  return {
    asOf: new Date().toISOString(),
    page,
    reviews,
    competitors,
    scrape: DORMANT_SCRAPE,
    dfs: DORMANT_DFS,
  };
}

/** The inert shapes. Identical to what firecrawlSite() / runDataForSeo() return
 *  with no API key, so nothing downstream can tell the difference between
 *  "dormant" and "unconfigured" — which is the point: both mean "we did not
 *  look", and every consumer already branches on exactly these flags. */
const DORMANT_SCRAPE: FirecrawlScrape = { used: false, homepage: null, subpages: [] };
const DORMANT_DFS: DataForSeoBundle = {
  available: false,
  gbp: { available: false } as DataForSeoBundle["gbp"],
  reviews: { available: false } as DataForSeoBundle["reviews"],
};

/**
 * Return the business's research bundle, capturing + persisting it on the first
 * run and reusing the identical stored values on every run after (until the TTL
 * lapses or a refresh is forced). This guarantees regenerate produces the same
 * facts with no scraping.
 *
 * @param forceRefresh  The deliberate "refresh research" action — re-measure and
 *                      re-persist even if a fresh snapshot exists. Fresh data is
 *                      always an explicit choice, never a side effect of regen.
 */
export async function resolveResearchSnapshot(
  host: ResearchSnapshotHost,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): Promise<ResearchBundle> {
  const fresh =
    host.researchSnapshotAt != null &&
    Date.now() - host.researchSnapshotAt.getTime() < RESEARCH_SNAPSHOT_TTL_MS;

  // Reuse path: zero scrape, zero API cost.
  if (!forceRefresh && fresh && host.researchSnapshot) {
    return host.researchSnapshot as ResearchBundle;
  }

  const bundle = await captureResearch(host);

  // Only persist a usable capture — never overwrite a good snapshot with a
  // total-outage one (mirrors the PSI snapshot's "don't clobber good with
  // unavailable" rule). Persistence failures degrade gracefully to the fresh
  // bundle.
  if (bundleIsUsable(bundle)) {
    // Owner-name enrichment rides this single spend path: resolve once when we
    // freshly capture research, cache it on the row, and never re-run on
    // regenerate (which reuses the stored snapshot above and never reaches here).
    let resolvedOwner: string | null = null;
    if (!host.ownerName) {
      resolvedOwner = await extractOwnersFromText(ownerCorpus(bundle), host.name);
    }
    await prisma.business
      .update({
        where: { id: host.id },
        data: {
          researchSnapshot: bundle as unknown as object,
          researchSnapshotAt: new Date(),
          // Guarded: only write a found name, never clobber an existing one.
          ...(resolvedOwner ? { ownerName: resolvedOwner } : {}),
        },
      })
      .catch(() => {});
  } else if (host.researchSnapshot) {
    return host.researchSnapshot as ResearchBundle;
  }

  return bundle;
}
