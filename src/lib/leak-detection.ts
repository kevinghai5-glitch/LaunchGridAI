// ============================================================================
// LEAK DETECTION ENGINE — the runtime that turns real research into fired leaks.
// ============================================================================
//
// This module is the ONLY bridge between the research pipeline and the closed
// leak taxonomy (leak-taxonomy.ts). It:
//   1. adapts the real data model onto the taxonomy's ScrapeData contract
//      (`toScrapeData`),
//   2. runs each leak's detection rules as pure functions, first-match-wins
//      (`getFiredLeaks`),
//   3. ranks + grades + selects per RULES (ranking, grading, cold-audit).
//
// Semantics come entirely from the taxonomy. Nothing here invents a leak, a
// stat, or a fix — it only decides which taxonomy entries fired and at what
// evidence tier, with the concrete evidence that triggered them.
//
// Every detector degrades gracefully: a rule whose data is missing is skipped
// (never guessed). A leak with no matching rule simply does not fire.

import type { AuditIntelligence } from "./audit-intelligence";
import type { PlaceReview } from "./google-places";
import type { FirecrawlScrape } from "./firecrawl";
import {
  LEAKS,
  REVIEW_SIGNALS,
  TIER_MULTIPLIER,
  type Leak,
  type EvidenceTier,
  type ScrapeData,
  type ScorecardArea,
  type Tri,
  type Vertical,
} from "./leak-taxonomy";

// ── Public result shape ──────────────────────────────────────────────────────

export interface FiredLeak {
  leak: Leak;
  tier: EvidenceTier;
  /** Ranking score per RULES.ranking. */
  score: number;
  /** Concrete data points that triggered detection (cited in deliverable copy). */
  evidence: string[];
  /** The client explicitly told us (at intake) they don't have this system —
   *  the leak is a CONFIRMED fact, not an unverified benchmark. Renders as
   *  "Confirmed at intake" and drops the kickoff-verification line. */
  intakeConfirmed?: boolean;
}

// ── RawResearch: what the pipeline already assembles per business ────────────

export interface RawResearch {
  business: {
    name: string;
    industry?: string | null;
    category?: string | null;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  intel: AuditIntelligence;
  scrape: FirecrawlScrape;
  /** Legacy native scrape text, used when Firecrawl is unavailable. */
  fallbackText?: string;
  /** Up to 5 Google Places reviews (DFS reviews come through intel.dataForSeo). */
  placeReviews?: PlaceReview[];
  /** Post-close intake — absent pre-sale by design. */
  intake?: ScrapeData["intake"];
  /** Research-as-of clock (fix 3). The ISO timestamp the research bundle was
   *  captured; every date-window computation (e.g. 90-day review recency) measures
   *  against this frozen instant instead of wall-clock `Date.now()`, so a fact
   *  can't move between two regenerations of the same snapshot. Absent → falls back
   *  to now (pre-snapshot / test callers). */
  asOf?: string;
}

// ============================================================================
// CHEAP DETECTIONS (Phase 2, decision 3) — small parse/regex additions over
// data the pipeline already fetches. No new scraping infrastructure.
// ============================================================================

const VERTICAL_PATTERNS: Array<{ v: Vertical; re: RegExp }> = [
  { v: "dental", re: /\bdent(al|ist)|orthodont|endodont|periodont\b/i },
  { v: "med_spa", re: /med(ical)?[\s-]?spa|aesthetic|botox|dermatolog|cosmetic|laser (hair|skin)/i },
  { v: "law", re: /\b(law|lawyer|attorney|legal|solicitor)\b/i },
  { v: "roofing", re: /\broof(ing|er)?\b/i },
  { v: "hvac", re: /\bhvac\b|heating|air[\s-]?condition|furnace|cooling|refrigeration/i },
  { v: "plumbing", re: /\bplumb(ing|er)?\b|drain|sewer/i },
  { v: "electrical", re: /\belectric(al|ian)?\b/i },
  { v: "contractor_general", re: /contractor|construction|remodel|renovation|builder|handyman|general contracting/i },
];

/** Classify a Google category / industry string into the taxonomy Vertical.
 *  Unmapped → home_services_other (no vertical boost). */
export function classifyVertical(...candidates: (string | null | undefined)[]): Vertical {
  const hay = candidates.filter(Boolean).join(" ");
  for (const { v, re } of VERTICAL_PATTERNS) {
    if (re.test(hay)) return v;
  }
  return "home_services_other";
}

const CTA_RE =
  /\b(book|schedule|appointment|get a (quote|estimate)|request a (quote|estimate)|free (consultation|estimate|quote)|call (now|us|today)|get started|reserve|claim your)\b/i;

const TEXTING_RE = /\btext (us|me|now|today)\b|\bsend (us )?a text\b|\btext[\s-]?to[\s-]?/i;

const QUALIFYING_FIELD_RE =
  /\b(budget|timeline|time frame|zip ?code|postal ?code|service (needed|required|type)|type of (service|project|job|case)|project (type|details|scope)|square footage|number of|when (do|are) you|preferred (date|time)|how (soon|urgent)|reason for)\b/i;

/** Homepage above-the-fold CTA heuristic: a CTA in the first slice of the page. */
function detectPrimaryCtaAboveFold(homepageMarkdown: string): boolean {
  if (!homepageMarkdown) return false;
  return CTA_RE.test(homepageMarkdown.slice(0, 1500));
}

interface ClassifiedPages {
  pagesFound: ScrapeData["website"] extends infer W
    ? W extends { pagesFound: infer P }
      ? P
      : never
    : never;
  pageText: Record<string, string>;
  servicePageTexts: string[];
}

const PAGE_KIND_PATTERNS: Array<{ kind: "services" | "about" | "contact" | "booking"; re: RegExp }> = [
  { kind: "booking", re: /\/(book|booking|appointments?|schedule)\b/i },
  { kind: "contact", re: /\/contact\b/i },
  { kind: "services", re: /\/(services?|treatments?|pricing|prices|menu)\b/i },
  { kind: "about", re: /\/about\b/i },
];

function classifyPages(scrape: FirecrawlScrape, fallbackText: string): ClassifiedPages {
  const pagesFound = new Set<"home" | "services" | "about" | "contact" | "booking">();
  const pageText: Record<string, string> = {};
  const servicePageTexts: string[] = [];

  if (scrape.used && scrape.homepage) {
    pagesFound.add("home");
    pageText.home = scrape.homepage.markdown || scrape.homepage.html || "";
    for (const sp of scrape.subpages) {
      const text = sp.markdown || sp.html || "";
      let kind: "services" | "about" | "contact" | "booking" | null = null;
      for (const { kind: k, re } of PAGE_KIND_PATTERNS) {
        if (re.test(sp.url)) {
          kind = k;
          break;
        }
      }
      if (kind) {
        pagesFound.add(kind);
        pageText[kind] = text;
        if (kind === "services") servicePageTexts.push(text);
      }
    }
  } else if (fallbackText) {
    pagesFound.add("home");
    pageText.home = fallbackText;
  }

  return {
    pagesFound: Array.from(pagesFound) as ClassifiedPages["pagesFound"],
    pageText,
    servicePageTexts,
  };
}

/** Count reviews with a parseable timestamp within the last 90 days. */
function countRecentReviews(reviews: { date: string | null }[], now = Date.now()): number {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const r of reviews) {
    if (!r.date) continue;
    const t = Date.parse(r.date);
    if (Number.isNaN(t)) continue;
    if (t >= cutoff) n += 1;
  }
  return n;
}

// ── Tri-state proof-of-scan floor ────────────────────────────────────────────
// A "no X" leak may only be stated as fact when we have positive proof the scan
// was good. Without that proof, absence is UNKNOWN, not ABSENT.

const RAW_HTML_MIN_BYTES = 1000;

/** Positive proof of a good scan: real rawHtml retrieved that passes a
 *  non-trivial length + structural-marker check. A thin/empty/bot-wall stub
 *  fails, so its silence never hardens into a factual "no X". */
function isGoodScan(rawHtml: string): boolean {
  if (!rawHtml || rawHtml.length < RAW_HTML_MIN_BYTES) return false;
  return (
    /<\/(?:body|html|main|section|div)>/i.test(rawHtml) ||
    /<(?:form|a|button|script)\b/i.test(rawHtml)
  );
}

/** matched → PRESENT (a positive match is proof-positive, substrate-agnostic).
 *  Otherwise ABSENT only with a good scan; else UNKNOWN. */
function triState(matched: boolean, scanGood: boolean): Tri {
  if (matched) return "PRESENT";
  return scanGood ? "ABSENT" : "UNKNOWN";
}

const isPresent = (t: Tri | undefined): boolean => t === "PRESENT";
const isAbsent = (t: Tri | undefined): boolean => t === "ABSENT";

// ============================================================================
// ADAPTER — real data model → ScrapeData contract.
// ============================================================================

export function toScrapeData(raw: RawResearch): ScrapeData {
  const { intel, scrape } = raw;
  const dfs = intel.dataForSeo;
  const facts = intel.verifiedFacts;

  const industry = classifyVertical(
    raw.business.industry,
    raw.business.category,
    dfs?.gbp.category
  );

  // Freeze the review-recency clock to the research capture instant (fix 3). A
  // parseable asOf → that instant; otherwise wall-clock now (test / pre-snapshot).
  const asOfNow = raw.asOf ? Date.parse(raw.asOf) : Date.now();
  const nowForWindows = Number.isNaN(asOfNow) ? Date.now() : asOfNow;

  const hasWebsiteUrl = Boolean(raw.business.website);
  const { pagesFound, pageText, servicePageTexts } = classifyPages(scrape, raw.fallbackText ?? "");

  // Combined corpus + HTML for cheap regex detections. `rawHtml` is the full
  // post-JS DOM across ALL scraped pages — the substrate for absence-proof:
  // GTM-injected widgets and forms behind clicks only surface there, and a
  // signal is PRESENT if it fingerprints on ANY scraped page (multi-page OR).
  const corpusParts: string[] = [];
  const htmlParts: string[] = [];
  const rawHtmlParts: string[] = [];
  if (scrape.used && scrape.homepage) {
    corpusParts.push(scrape.homepage.markdown || "");
    htmlParts.push(scrape.homepage.html || "");
    rawHtmlParts.push(scrape.homepage.rawHtml || "");
    for (const sp of scrape.subpages) {
      corpusParts.push(sp.markdown || "");
      htmlParts.push(sp.html || "");
      rawHtmlParts.push(sp.rawHtml || "");
    }
  } else if (raw.fallbackText) {
    corpusParts.push(raw.fallbackText);
  }
  const corpus = corpusParts.join("\n\n");
  const html = htmlParts.join("\n\n");
  const rawHtml = rawHtmlParts.join("\n\n");
  // Proof-of-good-scan gates every factual "no X" absence claim. Only Firecrawl
  // rawHtml counts — the native fallback can't render JS-injected widgets, so
  // its silence is UNKNOWN, never ABSENT.
  const scanGood = isGoodScan(rawHtml);

  const socialPlatforms = new Set(
    (facts?.socialLinks.value ?? []).map((s) => s.platform.toLowerCase())
  );

  const bookingMatched =
    intel.website.bookingDetected ||
    (facts?.bookingLinks.value.length ?? 0) > 0 ||
    Boolean(dfs?.gbp.hasBookingLink);

  const website: ScrapeData["website"] = hasWebsiteUrl
    ? {
        pagesFound,
        pageText,
        scanConfident: scanGood,
        hasContactForm: triState(intel.website.formDetected, scanGood),
        formHasQualifyingFields:
          intel.website.formDetected && QUALIFYING_FIELD_RE.test(html || corpus),
        // Booking link can be corroborated by GBP (a separate Google source), so
        // a GBP booking link makes it PRESENT even on a thin site scan.
        hasOnlineBookingLink: triState(
          bookingMatched,
          scanGood || Boolean(dfs?.gbp.hasBookingLink)
        ),
        hasChatWidget: triState(intel.website.marketing.chat.length > 0, scanGood),
        hasClickToCallOnMobile: triState(intel.website.phoneClickable, scanGood),
        hasPrimaryCtaAboveFold: detectPrimaryCtaAboveFold(pageText.home ?? corpus),
        // Only claim a shortfall when we actually found service pages; absence of
        // data must not fire the leak (graceful degradation).
        servicePagesHaveCtas:
          servicePageTexts.length === 0
            ? true
            : servicePageTexts.every((t) => CTA_RE.test(t)),
        mentionsTextingOption: TEXTING_RE.test(corpus),
        linksToFacebook: socialPlatforms.has("facebook"),
        linksToInstagram: socialPlatforms.has("instagram"),
      }
    : undefined;

  const perf = intel.performance?.mobile;
  const pageSpeed: ScrapeData["pageSpeed"] =
    perf && perf.performanceScore != null && perf.metrics.lcpSeconds != null
      ? { mobileScore: perf.performanceScore, lcpSeconds: perf.metrics.lcpSeconds }
      : undefined;

  // Reviews: merge Places (≤5) + DFS (≤20) raw texts for signal matching.
  const dfsReviews = dfs?.reviews.reviews ?? [];
  const reviewTexts = Array.from(
    new Set(
      [
        ...(raw.placeReviews ?? []).map((r) => r.text),
        ...dfsReviews.map((r) => r.text),
      ].filter((t) => t && t.trim().length > 0)
    )
  );
  const count =
    raw.business.reviewCount ??
    (dfs?.reviews.available ? dfs.reviews.count : intel.reviews.count) ??
    0;
  const rating =
    raw.business.rating ?? dfs?.reviews.averageRating ?? intel.reviews.averageRating ?? 0;

  const googleReviews: ScrapeData["googleReviews"] =
    reviewTexts.length > 0 || count > 0
      ? {
          rating,
          count,
          recentCount90d: countRecentReviews(dfsReviews, nowForWindows),
          // ownerResponseRate is not fetched (documented gap) — sentinel -1 means
          // "unknown", so unanswered_reviews (OBSERVED) will not fire on a guess.
          ownerResponseRate: -1,
          reviewTexts,
        }
      : undefined;

  const gbp: ScrapeData["gbp"] = dfs?.gbp.available
    ? {
        hoursListed: dfs.gbp.hasHours,
        limitedHours: dfs.gbp.limitedHours,
        hasBookingLink: dfs.gbp.hasBookingLink,
        // GBP messaging attribute is not pulled (documented gap).
        messagingEnabled: false,
      }
    : undefined;

  const competitors: ScrapeData["competitors"] = intel.competitors.available
    ? intel.competitors.topRated.map((c) => ({
        name: c.name,
        rating: c.rating,
        reviewCount: c.reviewCount,
      }))
    : undefined;

  return {
    business: {
      name: raw.business.name,
      industry,
      city: raw.business.city ?? "",
      phone: raw.business.phone ?? undefined,
      websiteUrl: raw.business.website ?? undefined,
    },
    website,
    pageSpeed,
    googleReviews,
    gbp,
    competitors,
    intake: raw.intake,
  };
}

// ============================================================================
// REVIEW-SIGNAL MATCHING (Phase 2.2)
// ============================================================================

function takeFragment(text: string, phrase: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(phrase.toLowerCase());
  if (idx < 0) return phrase;
  // ~10 words of context centred on the match.
  const start = Math.max(0, idx - 20);
  const slice = text.slice(start, idx + phrase.length + 30);
  const words = slice.trim().split(/\s+/).slice(0, 10);
  return words.join(" ");
}

interface SignalMatch {
  /** Number of DISTINCT reviews that matched at least one phrase. */
  distinctReviews: number;
  /** Up to a few short fragments for evidence. */
  fragments: string[];
}

function matchReviewSignal(
  reviewTexts: string[],
  phrases: readonly string[]
): SignalMatch {
  let distinctReviews = 0;
  const fragments: string[] = [];
  for (const text of reviewTexts) {
    const hit = phrases.find((p) => text.toLowerCase().includes(p.toLowerCase()));
    if (hit) {
      distinctReviews += 1;
      if (fragments.length < 3) fragments.push(`"${takeFragment(text, hit)}"`);
    }
  }
  return { distinctReviews, fragments };
}

// ============================================================================
// DETECTION FUNCTIONS — one per leak id, first-match-wins.
// Returns { tier, evidence } for the first matching rule, or null.
// ============================================================================

type DetectionResult = { tier: EvidenceTier; evidence: string[]; intakeConfirmed?: boolean } | null;
type Detector = (d: ScrapeData) => DetectionResult;

// A benchmark-hedged intake leak fires whenever the client hasn't confirmed the
// system is in place — i.e. undefined (not asked) OR false (told us they lack it).
const intakeNot = (v: boolean | undefined) => v !== true;
// The leak is a CONFIRMED fact only when the client explicitly answered "no".
const intakeSaysNo = (v: boolean | undefined) => v === false;

const DETECTORS: Record<string, Detector> = {
  // ── Cluster A — response speed ──────────────────────────────────────────
  slow_speed_to_lead: (d) => {
    const w = d.website;
    // Requires a CONFIRMED form — the leak is "slow reply to a form fill". An
    // unconfirmed (UNKNOWN) form can't anchor this claim.
    if (!w || !isPresent(w.hasContactForm)) return null;
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.slowResponse);
    if (m.distinctReviews >= 2) {
      return { tier: "EVIDENCED", evidence: [`${m.distinctReviews} reviews mention slow/no response`, ...m.fragments] };
    }
    // BENCHMARK: form present, no confirmed chat, no visible instant-response promise.
    const promisesInstant = /reply (in|within) \d|respond (in|within) \d|\d[\s-]?(min|minute|hour) response/i.test(
      w.pageText.contact ?? w.pageText.home ?? ""
    );
    if (!isPresent(w.hasChatWidget) && !promisesInstant) {
      return { tier: "BENCHMARK", evidence: ["Contact form present with no chat widget or visible response-time commitment"] };
    }
    return null;
  },

  missed_calls_no_recovery: (d) => {
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.missedCalls);
    if (m.distinctReviews >= 2) {
      return { tier: "EVIDENCED", evidence: [`${m.distinctReviews} reviews mention unanswered/missed calls`, ...m.fragments] };
    }
    if (d.business.phone && d.website && !d.website.mentionsTextingOption) {
      return { tier: "BENCHMARK", evidence: ["Phone line with no visible text-back / missed-call recovery path"] };
    }
    return null;
  },

  no_after_hours_coverage: (d) => {
    const w = d.website;
    // OBSERVED asserts "no capture path" as fact → requires CONFIRMED absence
    // (no site at all, or a good scan that found neither booking nor chat).
    const captureConfirmedAbsent =
      !w || (isAbsent(w.hasOnlineBookingLink) && isAbsent(w.hasChatWidget));
    if (d.gbp?.limitedHours && captureConfirmedAbsent) {
      return { tier: "OBSERVED", evidence: ["Google hours show evenings + weekends closed, with no online booking or chat to catch after-hours demand"] };
    }
    // BENCHMARK is already hedged, so a not-confirmed-present path is enough
    // (covers ABSENT and UNKNOWN alike).
    const captureNotConfirmed =
      !w || (!isPresent(w.hasOnlineBookingLink) && !isPresent(w.hasChatWidget));
    if (d.gbp && !d.gbp.hoursListed && captureNotConfirmed) {
      return { tier: "BENCHMARK", evidence: ["No hours listed on Google and no 24/7 capture path detected"] };
    }
    return null;
  },

  // ── Cluster B — capture & qualification ─────────────────────────────────
  no_online_booking: (d) => {
    const w = d.website;
    if (!w || d.gbp?.hasBookingLink) return null; // PRESENT via GBP → no leak
    const link = w.hasOnlineBookingLink;
    const bm = d.intake?.bookingMethod;

    // A scheduler is visibly present on the site → not a leak, regardless of intake.
    if (!isAbsent(link) && link !== "UNKNOWN") return null;

    // INTAKE CONTRADICTS: they book through a scheduling tool (even if it isn't
    // linked on the public site) → they HAVE booking. Suppress the gap; the
    // opportunity is to connect + optimize the named tool, handled in copy.
    if (bm === "BOOKING_TOOL") return null;

    // INTAKE CONFIRMS: phone/email only → CONFIRMED gap. Declarative + dollars.
    if (bm === "PHONE_EMAIL_ONLY") {
      return {
        tier: "OBSERVED",
        evidence: ["Confirmed at intake: they take bookings by phone/email only — no online scheduler"],
        intakeConfirmed: true,
      };
    }

    // No decisive intake (OTHER / null / not asked) → fall back to the scan.
    if (isAbsent(link)) {
      // Scan positively saw no booking path → observed gap (pre-intake behavior).
      return { tier: "OBSERVED", evidence: ["No online booking link on the site or Google Business Profile"] };
    }
    // link === "UNKNOWN": scan couldn't confirm a scheduler → BENCHMARK hedge + kickoff.
    return { tier: "BENCHMARK", evidence: ["An online booking path couldn't be confirmed from the outside — verified at kickoff"] };
  },

  no_webchat: (d) => {
    const w = d.website;
    if (!w) return null;
    if (isAbsent(w.hasChatWidget)) {
      return { tier: "OBSERVED", evidence: ["No live-chat / webchat widget detected on the site"] };
    }
    // UNKNOWN: widgets are commonly script-injected and may be missed on a thin
    // scan → reuse the BENCHMARK hedge rather than asserting absence.
    if (w.hasChatWidget === "UNKNOWN") {
      return { tier: "BENCHMARK", evidence: ["A website chat/messaging widget couldn't be confirmed from the outside — verified at kickoff"] };
    }
    return null;
  },

  no_lead_qualification: (d) => {
    const w = d.website;
    if (!w) return null;
    // OBSERVED: a CONFIRMED form that collects no qualifying fields.
    if (isPresent(w.hasContactForm) && !w.formHasQualifyingFields) {
      return { tier: "OBSERVED", evidence: ["Contact form collects no qualifying fields (job type / budget / timeline / service area)"] };
    }
    // Neither form nor chat confirmed present → hedged BENCHMARK (covers ABSENT
    // and UNKNOWN — intake likely runs through the phone, verified at kickoff).
    if (!isPresent(w.hasContactForm) && !isPresent(w.hasChatWidget)) {
      return { tier: "BENCHMARK", evidence: ["No confirmed form or chat capture — intake likely runs through the phone, qualified only by whoever answers; verified at kickoff"] };
    }
    return null;
  },

  weak_landing_cta: (d) => {
    const w = d.website;
    if (!w) return null;
    const reasons: string[] = [];
    // Copy-quality reasons are read off page text — only assert them when we
    // actually read the page (scanConfident), else a thin scan reads as "no CTA".
    if (w.scanConfident && !w.hasPrimaryCtaAboveFold)
      reasons.push("no clear primary CTA above the fold on the homepage");
    if (w.scanConfident && !w.servicePagesHaveCtas)
      reasons.push("service pages missing a distinct CTA");
    // Click-to-call is a fingerprint signal → only assert when CONFIRMED absent.
    if (isAbsent(w.hasClickToCallOnMobile))
      reasons.push("phone number is not click-to-call");
    if (reasons.length) {
      return { tier: "OBSERVED", evidence: reasons.map((r) => r[0].toUpperCase() + r.slice(1)) };
    }
    return null;
  },

  // ── Cluster C — follow-through ──────────────────────────────────────────
  no_follow_up_sequence: (d) => {
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.noFollowUp);
    if (m.distinctReviews >= 2) {
      return { tier: "EVIDENCED", evidence: [`${m.distinctReviews} reviews mention no follow-up / never received a promised quote`, ...m.fragments] };
    }
    if (intakeNot(d.intake?.hasFollowUpSequence)) {
      const confirmed = intakeSaysNo(d.intake?.hasFollowUpSequence);
      return {
        tier: "BENCHMARK",
        evidence: [
          confirmed
            ? "Confirmed at intake: no automated follow-up sequence in place"
            : "Follow-up process is not externally visible — verified at kickoff",
        ],
        intakeConfirmed: confirmed,
      };
    }
    return null;
  },

  no_show_exposure: (d) => {
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.schedulingFriction);
    if (m.distinctReviews >= 2) {
      return { tier: "EVIDENCED", evidence: [`${m.distinctReviews} reviews mention scheduling friction / no-shows`, ...m.fragments] };
    }
    const apptVerticals: Vertical[] = ["dental", "med_spa", "law"];
    if (apptVerticals.includes(d.business.industry) && intakeNot(d.intake?.hasReminderSystem)) {
      const confirmed = intakeSaysNo(d.intake?.hasReminderSystem);
      return {
        tier: "BENCHMARK",
        evidence: [
          confirmed
            ? "Confirmed at intake: no appointment reminder system in place"
            : "Appointment-driven vertical with no externally visible reminder system — verified at kickoff",
        ],
        intakeConfirmed: confirmed,
      };
    }
    return null;
  },

  no_crm_pipeline: (d) => {
    if (d.intake?.hasCrm === true) return null; // suppressed entirely
    const confirmed = intakeSaysNo(d.intake?.hasCrm);
    return {
      tier: "BENCHMARK",
      evidence: [
        confirmed
          ? "Confirmed at intake: no CRM / pipeline to track leads"
          : "No pipeline visible from outside — lead tracking verified at kickoff",
      ],
      intakeConfirmed: confirmed,
    };
  },

  no_database_reactivation: (d) => {
    // INVERSE polarity vs the other intake booleans: here `false` means "no past-
    // customer list exists" → nothing to reactivate → suppressed. So there is no
    // "confirmed you lack it" path; this leak only ever fires as a benchmark hedge
    // (true or unknown = a list likely exists but is dormant).
    const established = (d.googleReviews?.count ?? 0) >= 20;
    if (established && d.intake?.hasPastCustomerDatabase !== false) {
      return { tier: "BENCHMARK", evidence: ["Established operating history implies a past-customer list that is likely dormant — verified at kickoff"] };
    }
    return null;
  },

  no_long_cycle_nurture: (d) => {
    if (intakeNot(d.intake?.hasFollowUpSequence)) {
      const confirmed = intakeSaysNo(d.intake?.hasFollowUpSequence);
      return {
        tier: "BENCHMARK",
        evidence: [
          confirmed
            ? "Confirmed at intake: no long-cycle nurture for 'not yet' leads"
            : "Long-cycle nurture for 'not yet' leads is not externally visible — verified at kickoff",
        ],
        intakeConfirmed: confirmed,
      };
    }
    return null;
  },

  // ── Cluster D — reputation & social proof ───────────────────────────────
  low_review_velocity: (d) => {
    const gr = d.googleReviews;
    const comps = d.competitors ?? [];
    if (!gr || comps.length === 0) return null;
    const counts = comps.map((c) => c.reviewCount).filter((n) => n > 0).sort((a, b) => a - b);
    if (counts.length === 0) return null;
    const median = counts[Math.floor(counts.length / 2)];
    if (median > 0 && gr.count < median * 0.5) {
      return {
        tier: "OBSERVED",
        evidence: [`${gr.count} reviews vs a competitor median of ~${median} — under half the local benchmark`],
      };
    }
    return null;
  },

  unanswered_reviews: (d) => {
    const gr = d.googleReviews;
    // ownerResponseRate < 0 is the "unknown" sentinel → do not fire (gap).
    if (gr && gr.ownerResponseRate >= 0 && gr.ownerResponseRate < 0.3 && gr.count >= 10) {
      return {
        tier: "OBSERVED",
        evidence: [`Owner responds to ~${Math.round(gr.ownerResponseRate * 100)}% of reviews`],
      };
    }
    return null;
  },

  // ── Cluster E — channel & measurement ───────────────────────────────────
  social_dm_unmanaged: (d) => {
    const w = d.website;
    if (w && (w.linksToFacebook || w.linksToInstagram)) {
      const channels = [w.linksToFacebook && "Facebook", w.linksToInstagram && "Instagram"].filter(Boolean);
      return { tier: "BENCHMARK", evidence: [`Active on ${channels.join(" + ")}; DM response handling not visible externally — verified at kickoff`] };
    }
    return null;
  },

  no_call_tracking: () => {
    return { tier: "BENCHMARK", evidence: ["Call performance (answered vs missed, after-hours share) is not measured pre-engagement"] };
  },

  payment_booking_friction: (d) => {
    const depositVerticals: Vertical[] = ["roofing", "contractor_general", "hvac", "plumbing", "med_spa"];
    if (depositVerticals.includes(d.business.industry)) {
      return { tier: "BENCHMARK", evidence: ["Deposit-taking vertical with no visible text-to-pay / online deposit path — verified at kickoff"] };
    }
    return null;
  },

  // ── Out of scope ────────────────────────────────────────────────────────
  oos_slow_site_speed: (d) => {
    const ps = d.pageSpeed;
    if (ps && (ps.mobileScore < 50 || ps.lcpSeconds > 4)) {
      return { tier: "OBSERVED", evidence: [`Mobile PageSpeed ${ps.mobileScore}/100, LCP ${ps.lcpSeconds}s`] };
    }
    return null;
  },

  oos_dated_site_design: () => {
    // Screenshot comparison is not analyzed programmatically (documented gap) —
    // conservative: never fire on a guess.
    return null;
  },

  oos_gbp_visibility_gaps: (d) => {
    // Uses only signals we actually have (photos). Conservative.
    if (d.gbp && d.gbp.hoursListed && d.competitors && d.competitors.length > 0) {
      // We surface this only when there is a concrete photo gap; otherwise skip.
    }
    return null;
  },
};

// ============================================================================
// getFiredLeaks — the single accessor the rest of the codebase uses.
// ============================================================================

export function scoreLeak(leak: Leak, tier: EvidenceTier, data: ScrapeData): number {
  const boost = leak.verticalBoost?.[data.business.industry] ? 1.2 : 1.0;
  return Math.round(leak.impactWeight * TIER_MULTIPLIER[tier] * boost * 100) / 100;
}

/** Run every leak's detection against the data. Returns ALL fired leaks
 *  (in-scope + out-of-scope), unranked. Suppression is applied inline. */
export function getFiredLeaks(data: ScrapeData): FiredLeak[] {
  const fired: FiredLeak[] = [];
  for (const leak of LEAKS) {
    const detector = DETECTORS[leak.id];
    if (!detector) continue;
    const result = detector(data);
    if (!result) continue;
    fired.push({
      leak,
      tier: result.tier,
      score: scoreLeak(leak, result.tier, data),
      evidence: result.evidence,
      intakeConfirmed: result.intakeConfirmed,
    });
  }
  return fired;
}

// ============================================================================
// SELECTION, RANKING & GRADING (Phase 3, RULES + decision 2)
// ============================================================================

/** In-scope fired leaks, ranked by score descending, with the
 *  no_long_cycle_nurture fold-in applied (it drops out of the report when
 *  no_follow_up_sequence fired — no double-counting). */
export function reportLeaks(fired: FiredLeak[]): FiredLeak[] {
  const followUpFired = fired.some((f) => f.leak.id === "no_follow_up_sequence");
  return fired
    .filter((f) => f.leak.scope !== "out_of_scope")
    .filter((f) => !(followUpFired && f.leak.id === "no_long_cycle_nurture"))
    .sort((a, b) => b.score - a.score);
}

/** Fired out-of-scope flags → "Also worth knowing" only. */
export function outOfScopeLeaks(fired: FiredLeak[]): FiredLeak[] {
  return fired.filter((f) => f.leak.scope === "out_of_scope");
}

/** Cold audit = top 3 by score, with the provability constraint:
 *  at least 2 of the 3 must be OBSERVED or EVIDENCED. */
export function selectColdAudit(fired: FiredLeak[]): FiredLeak[] {
  const ranked = reportLeaks(fired).filter((f) =>
    f.leak.deliverableTargets.includes("cold_audit")
  );
  const provable = (f: FiredLeak) => f.tier === "OBSERVED" || f.tier === "EVIDENCED";

  const top3 = ranked.slice(0, 3);
  const provableCount = top3.filter(provable).length;
  if (provableCount >= 2 || ranked.length < 3) return top3;

  // Rebalance: guarantee >=2 provable leaks, keep highest-scoring otherwise.
  const provables = ranked.filter(provable);
  const nonProvables = ranked.filter((f) => !provable(f));
  const chosen: FiredLeak[] = [];
  chosen.push(...provables.slice(0, 2));
  for (const f of [...provables.slice(2), ...nonProvables]) {
    if (chosen.length >= 3) break;
    chosen.push(f);
  }
  return chosen.sort((a, b) => b.score - a.score).slice(0, 3);
}

export const SCORECARD_AREAS: ScorecardArea[] = [
  "response_speed",
  "call_capture",
  "after_hours_coverage",
  "online_booking",
  "lead_qualification",
  "follow_up_nurture",
  "show_rate_protection",
  "pipeline_tracking",
  "reputation_social_proof",
];

/** Decision 1: the 9 client-facing scorecard axis labels, in SCORECARD_AREAS order. */
export const SCORECARD_DISPLAY_NAMES: Record<ScorecardArea, string> = {
  response_speed: "Speed to Lead",
  call_capture: "Call & Message Capture",
  after_hours_coverage: "After-Hours Coverage",
  online_booking: "Online Booking",
  lead_qualification: "Lead Qualification & On-Page Conversion",
  follow_up_nurture: "Follow-Up & Nurture",
  show_rate_protection: "Show-Rate Protection",
  pipeline_tracking: "Pipeline & Tracking",
  reputation_social_proof: "Reputation & Social Proof",
};

/** Deterministic per-area grade (decision 2):
 *    areaScore = clamp(100 − Σ(firedLeakScore × 6), 10, 95)
 *  Areas with zero fired leaks score 95 (never 100 pre-intake). */
export function gradeAreas(fired: FiredLeak[]): Record<ScorecardArea, number> {
  const inScope = fired.filter((f) => f.leak.scope !== "out_of_scope" && f.leak.scorecardArea);
  const grades = {} as Record<ScorecardArea, number>;
  for (const area of SCORECARD_AREAS) {
    const areaLeaks = inScope.filter((f) => f.leak.scorecardArea === area);
    if (areaLeaks.length === 0) {
      grades[area] = 95;
      continue;
    }
    const penalty = areaLeaks.reduce((sum, f) => sum + f.score * 6, 0);
    grades[area] = Math.max(10, Math.min(95, Math.round(100 - penalty)));
  }
  return grades;
}

/** Convenience: run the whole engine from raw research. */
export function detectLeaks(raw: RawResearch): {
  data: ScrapeData;
  fired: FiredLeak[];
  report: FiredLeak[];
  outOfScope: FiredLeak[];
  coldAudit: FiredLeak[];
  grades: Record<ScorecardArea, number>;
} {
  const data = toScrapeData(raw);
  const fired = getFiredLeaks(data);
  return {
    data,
    fired,
    report: reportLeaks(fired),
    outOfScope: outOfScopeLeaks(fired),
    coldAudit: selectColdAudit(fired),
    grades: gradeAreas(fired),
  };
}
