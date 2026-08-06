// ── OBSERVED FACTS — the four measured numbers the operator reads before he dials.
//
// This is the swap target for the deleted cold audit. It is NOT a document and
// NOT a generator: it is a table row. Four values, each either measured or "—",
// each carrying a mechanical verdict from hardcoded thresholds. There is no LLM
// call anywhere in this file, no sentence about the business is composed here,
// and missing data is NEVER filled in — a number cannot hallucinate, and neither
// can a dash.
//
// THE HONESTY MODEL IS INHERITED, NOT REIMPLEMENTED. The values are read off the
// SAME adapter the paid Growth Leak Report runs on (toScrapeData in
// leak-detection.ts), fed by the same builders (buildBusinessFacts,
// buildAuditIntelligence) over the same persisted snapshots. That buys the two
// guarantees this row exists for:
//   1. The row can never disagree with the paid report about a fact.
//   2. The tri-state discipline survives: a scan that could not prove absence
//      yields UNKNOWN, and UNKNOWN renders as "—", never as "none". The
//      difference between "we could not see" and "it is not there" is the whole
//      honesty model of this codebase.
//
// IT COSTS NOTHING TO READ. Everything here is pure CPU over the snapshots
// already stored on the Business row (psiSnapshot / researchSnapshot). No
// scrape, no API call, no capture — a missing snapshot degrades to "—", it is
// never an excuse to go fetch one. (Mirrors rule 1 of /api/leak-gaps: a panel
// that bills for being looked at is a panel he stops looking at.)

import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import { toScrapeData, type PreSaleResearch } from "@/lib/leak-detection";
import type { Tri } from "@/lib/leak-taxonomy";
import type { MeasuredFacts, MeasuredPresence } from "@/lib/measure-facts";
import type { PsiBundle } from "@/lib/pagespeed";
import type { ResearchBundle } from "@/lib/research-snapshot";

// ── Thresholds ────────────────────────────────────────────────────────────────
// Hardcoded on purpose: a threshold in code is a threshold that cannot drift
// between two renders of the same row. Exported so a test can pin them and so
// the component never re-declares its own copy.

/** Mobile PageSpeed score below this is worth fixing. 70 sits inside Google's
 *  own "needs improvement" band (50–89; 90+ is "good") — deliberately MORE
 *  sensitive than the paid report's out-of-scope slow-site leak (score < 50),
 *  because this row's job is a pre-dial talking point, not a report finding. */
export const MOBILE_SCORE_WORTH_FIXING_BELOW = 70;

/** Main-content load (mobile LCP) above this many seconds is worth fixing.
 *  Google's Core Web Vitals call LCP ≤ 2.5s "good" and > 4s "poor"; 3.0s splits
 *  the "needs improvement" band the same way the score threshold above does. */
export const MOBILE_LOAD_WORTH_FIXING_ABOVE_S = 3.0;

/** Review count under this fraction of the local competitor median is worth
 *  fixing. 0.5 is EXACTLY the halving the paid report's review_deficit detector
 *  fires on (leak-detection.ts: `gr.count < median * 0.5`) — same number, same
 *  statistic, same sample, so the row and the report can never disagree. */
export const REVIEW_COUNT_WORTH_FIXING_FRACTION = 0.5;

// ── Result shape ──────────────────────────────────────────────────────────────

export type ObservedVerdict = "worth_fixing" | "fine" | "unknown";

/** found = positively fingerprinted. none = a good scan proved absence.
 *  unknown = we could not see (thin scan, bot wall, no site) — NOT "none". */
export type PresenceState = "found" | "none" | "unknown";

export interface ObservedFacts {
  /** Mobile PageSpeed performance score (0–100) and LCP seconds — the same two
   *  numbers every deliverable prints for speed ("77/100, LCP 4.1s"). Either
   *  half may be null when Lighthouse did not report it. */
  mobileSpeed: { score: number | null; loadSeconds: number | null; verdict: ObservedVerdict };
  /** Their Google review count/rating against the LOCAL MEDIAN review count.
   *  localAvg (named per the row spec) is the MEDIAN across the top-rated
   *  nearby competitors the research pulled — median, not mean, because the
   *  sample is tiny (≤3) and one 2,000-review chain would drag a mean past any
   *  honest comparison; and median because it is the exact statistic the paid
   *  report's review_deficit detector cites, so this row can never disagree
   *  with the report. The sample is the HIGHEST-RATED nearby businesses, not a
   *  market cross-section — UI copy must say "local median", never "benchmark". */
  reviews: { count: number | null; rating: number | null; localAvg: number | null; verdict: ObservedVerdict };
  /** Online booking link anywhere on their scraped pages or their Google
   *  listing (GBP is positive proof from a separate Google source). */
  bookingLink: { state: PresenceState; verdict: ObservedVerdict };
  /** A tappable tel: link on their site. */
  clickToCall: { state: PresenceState; verdict: ObservedVerdict };
  /** When the research these values came from was captured (ISO). null = never
   *  scanned. Provenance, not a fifth value — the component prints it so a
   *  stale row is stale OUT LOUD. */
  observedAt: string | null;
}

/** What the compute needs off the Business row — a subset of the Prisma model,
 *  so both API routes can pass their row (or partial select) straight in. */
export interface ObservedFactsHost {
  id: string;
  name: string;
  industry?: string | null;
  category?: string | null;
  city?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  ownerName?: string | null;
  /** Serialized PsiBundle (JSON column) — parsed defensively, never trusted. */
  psiSnapshot: unknown;
  psiSnapshotAt?: Date | string | null;
  /** Serialized ResearchBundle (JSON column) — parsed defensively, never trusted. */
  researchSnapshot: unknown;
  researchSnapshotAt?: Date | string | null;
  /** Serialized MeasuredFacts from the manual "Fetch measured values" button
   *  (src/lib/measure-facts.ts). Separate from the snapshots on purpose: it
   *  records ONLY what two cheap calls actually saw, never a whole capture. */
  measuredFacts?: unknown;
  measuredFactsAt?: Date | string | null;
}

// ── Defensive snapshot parsing ────────────────────────────────────────────────
// A stored snapshot is JSON: it can predate today's shape or have been written
// by a half-failed run. A bundle that fails the check is treated exactly like
// no bundle at all — honest ("we haven't looked"), and recoverable by running
// a scan. These guards mirror asResearchBundle/asPsiBundle in
// /api/leak-gaps/route.ts, where they are module-local; EXPORTED from here so
// that route (and any third caller) can converge on one copy instead of a
// fourth being written.

export function asResearchBundle(value: unknown): ResearchBundle | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<ResearchBundle>;
  // `subpages` is spread by toScrapeData — an old bundle without it would throw
  // halfway through detection.
  if (!b.scrape || !b.page || !Array.isArray(b.scrape.subpages)) return null;
  return b as ResearchBundle;
}

export function asPsiBundle(value: unknown): PsiBundle | null {
  if (!value || typeof value !== "object") return null;
  return "available" in value ? (value as PsiBundle) : null;
}

/** Date | string | null | undefined → ISO string or null. Invalid dates → null. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Verdicts ──────────────────────────────────────────────────────────────────

function presenceOf(tri: Tri | undefined): PresenceState {
  if (tri === "PRESENT") return "found";
  if (tri === "ABSENT") return "none";
  // UNKNOWN and undefined both mean "we could not see" — never "none".
  return "unknown";
}

function presenceVerdict(state: PresenceState): ObservedVerdict {
  if (state === "found") return "fine";
  if (state === "none") return "worth_fixing";
  return "unknown";
}

function mobileVerdict(score: number | null, loadSeconds: number | null): ObservedVerdict {
  // Nothing measured → unknown, never an inference from the niche.
  if (score == null && loadSeconds == null) return "unknown";
  if (score != null && score < MOBILE_SCORE_WORTH_FIXING_BELOW) return "worth_fixing";
  if (loadSeconds != null && loadSeconds > MOBILE_LOAD_WORTH_FIXING_ABOVE_S) return "worth_fixing";
  return "fine";
}

function reviewsVerdict(count: number | null, localAvg: number | null): ObservedVerdict {
  // No count, or a count with no local sample to compare against → unknown.
  // The bare count still DISPLAYS; it just carries no judgement, because the
  // threshold is defined relative to the local median and nothing else.
  if (count == null || localAvg == null) return "unknown";
  return count < localAvg * REVIEW_COUNT_WORTH_FIXING_FRACTION ? "worth_fixing" : "fine";
}

/** The smallest competitor sample a median may be quoted from. Below this the
 *  row renders "—", not a number.
 *
 *  OWNER RULE, verbatim: "if the median is computed from fewer than ~5
 *  competitors it's meaningless and should render '—' rather than a number.
 *  That figure is the one I'd say out loud on a call, so it can't be wrong."
 *  Found the hard way: this median once rendered as 7 for a law firm because it
 *  was computed over the top-RATED-3 subsample — [1, 1, 8] — and rating-sorted
 *  sampling is biased toward tiny businesses (a 5.0★ shop with one review
 *  outranks a 4.4★ with three hundred). */
export const LOCAL_MEDIAN_MIN_SAMPLE = 5;

/** Median review count across the FULL competitor set the research captured —
 *  never a rating-sorted subsample (see LOCAL_MEDIAN_MIN_SAMPLE for why), and
 *  null unless at least LOCAL_MEDIAN_MIN_SAMPLE competitors have a non-zero
 *  count. Counts > 0, ascending, upper median. */
function localMedian(competitors: { reviewCount: number }[] | undefined): number | null {
  const counts = (competitors ?? [])
    .map((c) => c.reviewCount)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (counts.length < LOCAL_MEDIAN_MIN_SAMPLE) return null;
  return counts[Math.floor(counts.length / 2)];
}

/** The all-unknown row: four dashes. Used when a business has never been
 *  scanned, and as the honest fallback when a row vanished mid-read. A fresh
 *  object every call — callers may attach it to responses. */
export function unknownObservedFacts(): ObservedFacts {
  return {
    mobileSpeed: { score: null, loadSeconds: null, verdict: "unknown" },
    reviews: { count: null, rating: null, localAvg: null, verdict: "unknown" },
    bookingLink: { state: "unknown", verdict: "unknown" },
    clickToCall: { state: "unknown", verdict: "unknown" },
    observedAt: null,
  };
}

// ── The compute ───────────────────────────────────────────────────────────────

/**
 * Derive the four observed values from what the Business row already holds.
 * Pure CPU: no network, no LLM, no prisma. Degrades per-value — a business with
 * a PageSpeed snapshot but no research bundle still gets its speed numbers, and
 * everything unprovable stays "unknown"/"—".
 */
/** A stored MeasuredFacts blob, parsed defensively like the snapshots. */
function asMeasuredFacts(value: unknown): MeasuredFacts | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Partial<MeasuredFacts>;
  const ok = (p: unknown) => p === "found" || p === "none" || p === "unknown";
  if (!ok(m.bookingLink) || !ok(m.clickToCall)) return null;
  return m as MeasuredFacts;
}

/** Overlay the manual measure onto the snapshot-derived row.
 *
 *  TWO RULES, both load-bearing:
 *
 *  1. THE FRESHER SOURCE WINS. A measure taken today should beat a snapshot from
 *     three weeks ago, and a research capture run after a measure should beat the
 *     measure. Whichever was observed later describes the site as it is now.
 *
 *  2. A MEASURED "UNKNOWN" NEVER OVERWRITES SOMETHING KNOWN. If the button could
 *     not reach the site but a previous full scan proved a booking link exists,
 *     the row keeps the finding. Fresher-wins is about better information, and
 *     "we could not see" is not information — it is the absence of it.
 *
 *  Reviews are untouched: this button does not measure them. If no research
 *  bundle exists the local median stays null and reviews still render "—", which
 *  is correct — a median needs a competitor sample nobody has fetched. */
function applyMeasured(
  base: ObservedFacts,
  host: ObservedFactsHost,
  snapshotAt: string | null
): ObservedFacts {
  const measured = asMeasuredFacts(host.measuredFacts);
  const measuredAt = toIso(host.measuredFactsAt);
  if (!measured || !measuredAt) return base;

  // Rule 1. Missing snapshot date → the measure is the only dated evidence.
  const fresher = !snapshotAt || measuredAt > snapshotAt;
  if (!fresher) return base;

  // Rule 2, applied per value.
  const takePresence = (
    now: { state: PresenceState; verdict: ObservedVerdict },
    next: MeasuredPresence
  ) =>
    next === "unknown" && now.state !== "unknown"
      ? now
      : { state: next as PresenceState, verdict: presenceVerdict(next as PresenceState) };

  const score = measured.mobile?.score ?? null;
  const load = measured.mobile?.loadSeconds ?? null;
  const mobileKnown = score != null || load != null;
  const baseMobileKnown = base.mobileSpeed.score != null || base.mobileSpeed.loadSeconds != null;

  return {
    ...base,
    mobileSpeed:
      mobileKnown || !baseMobileKnown
        ? { score, loadSeconds: load, verdict: mobileVerdict(score, load) }
        : base.mobileSpeed,
    bookingLink: takePresence(base.bookingLink, measured.bookingLink),
    clickToCall: takePresence(base.clickToCall, measured.clickToCall),
    // Provenance follows the value: the row now describes what was seen at the
    // measure, so it must say so rather than quoting an older capture date.
    observedAt: measuredAt,
  };
}

export function computeObservedFacts(host: ObservedFactsHost): ObservedFacts {
  const psi = asPsiBundle(host.psiSnapshot);
  const bundle = asResearchBundle(host.researchSnapshot);

  // Mobile speed comes straight off the persisted PSI bundle — the same
  // mobile.performanceScore / metrics.lcpSeconds pair toScrapeData carries as
  // pageSpeed.{mobileScore,lcpSeconds}. Read directly (not via the adapter) so
  // a HALF-measurement still shows the half that exists: the adapter drops the
  // pair unless both halves are present, and hiding a real measured score
  // because its sibling metric failed would be less honest, not more.
  const score = psi?.mobile?.performanceScore ?? null;
  const loadSeconds = psi?.mobile?.metrics.lcpSeconds ?? null;
  const mobileSpeed = { score, loadSeconds, verdict: mobileVerdict(score, loadSeconds) };

  // Research-as-of clock: prefer the row's capture timestamp, fall back to the
  // bundle's own asOf; a PSI-only business dates the row off its PSI capture.
  const researchAt = toIso(host.researchSnapshotAt) ?? bundle?.asOf ?? null;
  const psiOnlyAt = psi ? toIso(host.psiSnapshotAt) : null;

  if (!bundle) {
    // Never scanned (or the stored bundle is unusable). Reviews degrade to the
    // row's own Places-pull columns — reviewCount null means "never saw", while
    // an explicit 0 is an observed zero and displays as one. No competitor
    // sample exists, so the verdict stays unknown either way.
    const count = host.reviewCount ?? null;
    const ratingRaw = host.rating ?? null;
    return applyMeasured({
      mobileSpeed,
      reviews: {
        count,
        // Google ratings run 1.0–5.0; a 0/negative here is a sentinel, not a rating.
        rating: ratingRaw != null && ratingRaw > 0 ? ratingRaw : null,
        localAvg: null,
        verdict: reviewsVerdict(count, null),
      },
      bookingLink: { state: "unknown", verdict: "unknown" },
      clickToCall: { state: "unknown", verdict: "unknown" },
      observedAt: researchAt ?? psiOnlyAt,
    }, host, researchAt ?? psiOnlyAt);
  }

  // ── Canonical assembly — mirrors /api/leak-gaps (which mirrors the paid
  // generator), minus screenshots: toScrapeData never reads them, and this row
  // renders no image. Old bundles may predate a field, hence the `?? []` /
  // `?? null` guards on everything the shape check above does not pin.
  const { page, scrape } = bundle;
  const reviews = bundle.reviews ?? [];
  const competitors = bundle.competitors ?? [];
  const dfs = bundle.dfs ?? null;

  const verifiedFacts = buildBusinessFacts({
    scrape,
    fallbackText: page.text,
    places: {
      name: host.name,
      phone: host.phone ?? null,
      address: host.address ?? null,
      website: host.website ?? null,
    },
    ownerName: host.ownerName ?? null,
  });

  // Signal detection runs over the FULL post-JS DOM (rawHtml) across every
  // scraped page — GTM-injected booking widgets and tel: links only surface
  // there. Cleaned `html` strips scripts and causes confident false negatives.
  const websiteHtmlForSignals =
    scrape.used && scrape.homepage
      ? [scrape.homepage, ...scrape.subpages]
          .map((p) => p.rawHtml || p.html)
          .filter(Boolean)
          .join("\n\n") || page.html
      : page.html;

  const intel = buildAuditIntelligence({
    websiteHtml: websiteHtmlForSignals,
    hasWebsiteUrl: Boolean(host.website),
    reviews,
    competitors,
    self: { rating: host.rating ?? null, reviewCount: host.reviewCount ?? null },
    verifiedFacts,
    performance: psi,
    dataForSeo: dfs,
    screenshots: null,
  });

  // PRE-SALE, declared. This row is read BEFORE the dial — nothing has been
  // disclosed, and the pre-sale variant makes handing intake in a COMPILE error
  // rather than a convention. The tri-states (incl. the proof-of-good-scan
  // floor that keeps a thin scan from hardening into "none") all come from this
  // one adapter — the single place that logic lives.
  const raw: PreSaleResearch = {
    mode: "pre_sale",
    business: {
      name: host.name,
      industry: host.industry ?? null,
      category: host.category ?? null,
      city: host.city ?? null,
      phone: host.phone ?? null,
      website: host.website ?? null,
      rating: host.rating ?? null,
      reviewCount: host.reviewCount ?? null,
    },
    intel,
    scrape,
    fallbackText: page.text,
    placeReviews: reviews,
    asOf: bundle.asOf,
  };
  const data = toScrapeData(raw);

  // Reviews: the adapter's merged count/rating when it has review data at all;
  // otherwise the row's own columns, where an explicit 0 stays an observed 0
  // and null stays "never saw". rating 0 is the adapter's "no rating" sentinel.
  const gr = data.googleReviews;
  const count = gr ? gr.count : host.reviewCount ?? null;
  const ratingRaw = gr ? gr.rating : host.rating ?? null;
  const rating = ratingRaw != null && ratingRaw > 0 ? ratingRaw : null;
  // The FULL competitor set the research captured — deliberately NOT
  // data.competitors, which is the top-rated-3 subsample the detector uses.
  // Rating-sorted top-3 is fine for firing a leak (its threshold was tuned to
  // it) and wrong for a number said out loud on a call: sorting by rating
  // surfaces tiny businesses, and a median over [1, 1, 8] told the operator
  // "local median 7" about a market whose full set medianed 5× higher. The
  // detector keeps its sample; the ROW quotes the whole market or nothing
  // (localMedian returns null under LOCAL_MEDIAN_MIN_SAMPLE → renders "—").
  const localAvg = localMedian(competitors.map((c) => ({ reviewCount: c.reviewCount ?? 0 })));

  const w = data.website;
  // No website block (no URL on record): the site cannot be spoken about, but a
  // booking link on their GOOGLE LISTING is still positive proof — the same GBP
  // corroboration toScrapeData applies inside the website block. Absence stays
  // unknown: with no scan there is nothing to prove absence against.
  const bookingState: PresenceState = w
    ? presenceOf(w.hasOnlineBookingLink)
    : dfs?.gbp.hasBookingLink
      ? "found"
      : "unknown";
  const clickToCallState: PresenceState = w ? presenceOf(w.hasClickToCallOnMobile) : "unknown";

  return applyMeasured(
    {
      mobileSpeed,
      reviews: { count, rating, localAvg, verdict: reviewsVerdict(count, localAvg) },
      bookingLink: { state: bookingState, verdict: presenceVerdict(bookingState) },
      clickToCall: { state: clickToCallState, verdict: presenceVerdict(clickToCallState) },
      observedAt: researchAt ?? psiOnlyAt,
    },
    host,
    researchAt ?? psiOnlyAt
  );
}

// ── Memoization ───────────────────────────────────────────────────────────────
// The research bundle is deliberately immutable-until-refresh (that is its whole
// design), so (id + the two snapshot timestamps + the row inputs that feed the
// values) is a complete cache key: any write path that changes an input also
// changes the key. This is what lets the Library compute the row for every
// business without re-scanning megabytes of stored HTML on every open. Results
// must be treated as immutable by callers — they are shared.

/** The exact fields the cache key is built from. A phase-1 query can select just
 *  these (cheap columns, no JSON blobs) and only fetch the blobs for misses. */
export interface ObservedFactsKeyFields {
  id: string;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  psiSnapshotAt?: Date | string | null;
  researchSnapshotAt?: Date | string | null;
  /** Part of the key: a manual measure changes the row's inputs, so it must
   *  change the row's cache key too. */
  measuredFactsAt?: Date | string | null;
}

const CACHE_MAX = 400;
const cache = new Map<string, ObservedFacts>();

function cacheKey(k: ObservedFactsKeyFields): string {
  return [
    k.id,
    toIso(k.psiSnapshotAt) ?? "",
    toIso(k.researchSnapshotAt) ?? "",
    // WITHOUT THIS a click of the measure button changes nothing on screen until
    // the server restarts: the inputs differ but the key does not, so the cache
    // keeps serving the pre-measure row. Pinned in verify-facts.
    toIso(k.measuredFactsAt) ?? "",
    k.rating ?? "",
    k.reviewCount ?? "",
    k.website ?? "",
  ].join("|");
}

/** Cached facts for this key, or null if this process hasn't computed them yet.
 *  Lets a feed route skip pulling the multi-MB snapshot columns for businesses
 *  already computed since the last input change. */
export function peekObservedFacts(k: ObservedFactsKeyFields): ObservedFacts | null {
  return cache.get(cacheKey(k)) ?? null;
}

/** Compute-with-cache. Same result as computeObservedFacts, paid at most once
 *  per (inputs) per server process. */
export function observedFactsFor(host: ObservedFactsHost): ObservedFacts {
  const key = cacheKey(host);
  const hit = cache.get(key);
  if (hit) return hit;
  const facts = computeObservedFacts(host);
  if (cache.size >= CACHE_MAX) {
    // Drop the oldest insertion — a bounded map beats a leaking one, and the
    // recompute cost on a rare evicted row is milliseconds.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, facts);
  return facts;
}
