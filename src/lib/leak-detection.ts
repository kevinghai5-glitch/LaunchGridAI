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
  gradeOf,
  type ClientIntake,
  type EvidenceGrade,
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
  /** MEASURED / TOLD / GUESSED — the honesty gate that decides how flatly this
   *  leak may be written (gradeOf in leak-taxonomy.ts). Derived once, HERE, and
   *  carried from this point on: LeakInput copies it, the saved pack stamps it,
   *  the softener and the lint key on it. Never recompute it at a call site —
   *  two derivations are two chances for the voice to drift from what we know. */
  grade: EvidenceGrade;
}

// ── RawResearch: what the pipeline already assembles per business ────────────
//
// PRE-SALE IS A SEPARATE SHAPE, NOT A CONVENTION. Nothing is disclosed before the
// sale: the free cold audit and the public teaser run on a scan and nothing else.
// That used to be a rule people remembered, enforced by every caller happening to
// leave `intake` out. It is now the type system's job — `intake?: never` on the
// pre-sale variant makes handing intake to a pre-sale detection a COMPILE ERROR,
// which is the one kind of guarantee a future edit cannot quietly skip.
//
// WHY `mode` IS REQUIRED ON ONE SIDE AND OPTIONAL ON THE OTHER. Declaring pre-sale
// has to be explicit — that is the declaration being enforced. Omitting `mode`
// falls to the post-intake variant, which carries NO guarantee, purely so callers
// that predate this split keep compiling. That is a real limitation, stated
// plainly: a new pre-sale caller that forgets `mode: "pre_sale"` gets no
// compile-time protection. The runtime assertion in detectLeaks is the backstop.

interface RawResearchBase {
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
  /** Research-as-of clock (fix 3). The ISO timestamp the research bundle was
   *  captured; every date-window computation (e.g. 90-day review recency) measures
   *  against this frozen instant instead of wall-clock `Date.now()`, so a fact
   *  can't move between two regenerations of the same snapshot. Absent → falls back
   *  to now (pre-snapshot / test callers). */
  asOf?: string;
}

/** BEFORE THE SALE — cold audit, public teaser. A scan and nothing else. */
export interface PreSaleResearch extends RawResearchBase {
  mode: "pre_sale";
  /** Not "leave this empty": it CANNOT be filled. `never` means any value at all
   *  fails to typecheck, so a pre-sale surface is structurally incapable of
   *  carrying something the client told us. */
  intake?: never;
}

/** AFTER THE SALE — the four paid deliverables, which may use what they told us. */
export interface PostIntakeResearch extends RawResearchBase {
  mode?: "post_intake";
  /** Still optional: every deliverable must render with no intake at all. */
  intake?: ClientIntake;
}

export type RawResearch = PreSaleResearch | PostIntakeResearch;

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
          // ownerResponseRate is NOT obtainable from what we fetch: the DataForSEO
          // reviews response we parse (DfsReviewItem) exposes rating / review_text /
          // timestamp only — there is no owner-reply field anywhere in the shape,
          // and Places reviews carry none either. Sentinel -1 = "unknown". No leak
          // consumes it any more (the old unanswered_reviews leak was removed
          // rather than left permanently unfireable); the field stays as a contract
          // slot for if/when the scraping layer starts supplying replies.
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

// ── The same three-way contract, for the multiple-choice intake answers ──────
// The booleans above are two-valued, so "they have it" and "they told us they
// don't" fall out of true/false. The multiple-choice questions have one or more
// answers that mean handled and one or more that mean not handled (the social-DM
// question has TWO that suppress, for two different reasons), so each detector
// spells out which is which:
//   · the handled slug     → the detector returns null (leak suppressed entirely)
//   · a confirming slug    → fires with intakeConfirmed (declarative, no kickoff line)
//   · "Not sure" / "We don't track it" / not asked → today's benchmark hedge
//
// WHY THE CONFIRMING ANSWERS DIFFER IN WORDS BUT NOT IN DOLLARS.
// "Someone gets back to them next morning" is plainly a smaller gap than "nothing
// until someone checks", and "we call back when we're free" is smaller than
// "voicemail only". Nothing in STATS prices that difference: the dollar chains
// these leaks use are built from cited rates (the 28% of calls that arrive after
// hours, the 85% of voicemail callers who never ring back) and no source anywhere
// puts a number on "answered next morning" versus "never answered". So the figure
// is identical for both answers and the difference lives entirely in the PROSE —
// each answer says back to the client exactly what they told us happens. Inventing
// a percentage to make the distinction look rigorous is the defect this whole file
// exists to prevent, so the maps below hold sentences, not multipliers.
type AfterHoursAnswer = NonNullable<ClientIntake["afterHoursHandling"]>;
type MissedCallAnswer = NonNullable<ClientIntake["missedCallHandling"]>;
type ResponseSpeedAnswer = NonNullable<ClientIntake["responseSpeed"]>;
type SocialEnquiriesAnswer = NonNullable<ClientIntake["socialEnquiries"]>;
type PastCustomerContactAnswer = NonNullable<ClientIntake["pastCustomerContact"]>;
type ReviewReplyOwnerAnswer = NonNullable<ClientIntake["reviewReplyOwner"]>;

const AFTER_HOURS_CONFIRMED: Partial<Record<AfterHoursAnswer, string>> = {
  NEXT_MORNING:
    "Confirmed at intake: an after-hours enquiry waits until the next morning for a reply — nothing reaches them overnight",
  NOTHING:
    "Confirmed at intake: an after-hours enquiry gets nothing back until someone happens to check",
};

const MISSED_CALL_CONFIRMED: Partial<Record<MissedCallAnswer, string>> = {
  CALL_BACK_WHEN_FREE:
    "Confirmed at intake: a missed call is returned when someone is free — nothing reaches the caller while they're still choosing who to hire",
  VOICEMAIL_ONLY:
    "Confirmed at intake: a missed call goes to voicemail and nothing else happens",
};

const RESPONSE_SPEED_CONFIRMED: Partial<Record<ResponseSpeedAnswer, string>> = {
  FEW_HOURS: "Confirmed at intake: a new enquiry typically waits a few hours for a reply",
  DAY_OR_TWO: "Confirmed at intake: a new enquiry typically waits a day or two for a reply",
};

// ONE confirming answer, TWO suppressing ones — and the two that suppress are not
// interchangeable outside this file. "No, not really" and "We don't have social
// accounts" both mean the same thing to THIS leak (no enquiries arrive there, so
// nothing is being lost there), but only NO_ACCOUNTS switches the Social DM
// Capture workflow off in the build. See socialEnquiries in leak-taxonomy.ts.
const SOCIAL_ENQUIRIES_CONFIRMED: Partial<Record<SocialEnquiriesAnswer, string>> = {
  YES: "Confirmed at intake: enquiries do come in through Instagram and Facebook messages — a channel with no missed-call log and no voicemail behind it",
};

// The DORMANCY answers. Only the first option ("Within the last month,
// systematically") means the list is being worked; the other three each describe a
// list going cold in the client's own words, which is precisely the claim this
// leak makes and precisely what the old "do you have a past-customer list?"
// question could never establish.
const PAST_CUSTOMER_CONTACT_CONFIRMED: Partial<Record<PastCustomerContactAnswer, string>> = {
  OCCASIONAL:
    "Confirmed at intake: past customers and old quotes are contacted only occasionally, when someone remembers — nothing runs on a schedule",
  OVER_A_YEAR:
    "Confirmed at intake: past customers and old quotes were last contacted over a year ago",
  NEVER:
    "Confirmed at intake: past customers and old quotes have never been contacted since their job finished",
};

// THE ONLY ANSWER THAT CAN EVER ESTABLISH THIS ONE. Every other map above has a
// benchmark path behind it: if the client says nothing, some outside signal (a
// review pattern, a missing booking link, an industry rate) still lets the leak
// fire hedged. There is no such signal for review REPLIES — the reviews response
// we parse carries rating, text and timestamp and nothing else — so this map is
// the entire detector. No answer, no fire. See no_review_replies in the taxonomy.
const REVIEW_REPLY_CONFIRMED: Partial<Record<ReviewReplyOwnerAnswer, string>> = {
  NOBODY:
    "Confirmed at intake: nobody replies to their Google reviews today — good ones and complaints alike sit there unanswered",
};

/** The confirming answer's sentence, or null when the answer doesn't confirm the
 *  gap (handled, "not sure", or never asked). Non-null IS the confirmation — the
 *  map's keys are the list of answers that confirm, so there is exactly one place
 *  to change if an answer moves between the two groups. */
function confirmedIntakeEvidence<K extends string>(
  answer: K | undefined,
  lines: Partial<Record<K, string>>
): string | null {
  return (answer && lines[answer]) || null;
}

/** Prepend the client's own words to scan-derived evidence, so a reader sees the
 *  strongest provenance first. No confirmation → the evidence is unchanged. */
function withConfirmation(confirmedLine: string | null, evidence: string[]): string[] {
  return confirmedLine ? [confirmedLine, ...evidence] : evidence;
}

const DETECTORS: Record<string, Detector> = {
  // ── Cluster A — response speed ──────────────────────────────────────────
  slow_speed_to_lead: (d) => {
    // UNDER_5_MIN is the window this leak exists to close. If they already answer
    // inside it there is no leak to sell — the same suppression hasCrm gives
    // no_crm_pipeline. It outranks the review proxy below on purpose: a review
    // describes one customer's experience, the intake answer describes the system,
    // and we do not tell a client they lack what they told us they have.
    if (d.intake?.responseSpeed === "UNDER_5_MIN") return null;
    const confirmedLine = confirmedIntakeEvidence(d.intake?.responseSpeed, RESPONSE_SPEED_CONFIRMED);
    const confirmed = confirmedLine !== null;

    const w = d.website;
    // Requires a CONFIRMED form — the leak is "slow reply to a form fill". An
    // unconfirmed (UNKNOWN) form can't anchor this claim.
    const formConfirmed = Boolean(w && isPresent(w.hasContactForm));
    if (w && formConfirmed) {
      const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.slowResponse);
      if (m.distinctReviews >= 2) {
        return {
          tier: "EVIDENCED",
          evidence: withConfirmation(confirmedLine, [
            `${m.distinctReviews} reviews mention slow/no response`,
            ...m.fragments,
          ]),
          intakeConfirmed: confirmed,
        };
      }
    }
    // CONFIRMED AT INTAKE: they told us how long a new enquiry waits. That answer
    // stands on its own — it needs no form fingerprint, because the delay they
    // described applies to every enquiry however it arrives.
    if (confirmedLine) {
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
    }
    if (!w || !formConfirmed) return null;
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
    // INSTANT_TEXT_BACK is literally the workflow this leak sells, so it suppresses
    // the leak outright — including over the review signal below. Reviews are an
    // outside proxy for an inside system; the client's answer describes the system.
    if (d.intake?.missedCallHandling === "INSTANT_TEXT_BACK") return null;
    const confirmedLine = confirmedIntakeEvidence(d.intake?.missedCallHandling, MISSED_CALL_CONFIRMED);
    const confirmed = confirmedLine !== null;

    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.missedCalls);
    if (m.distinctReviews >= 2) {
      return {
        tier: "EVIDENCED",
        evidence: withConfirmation(confirmedLine, [
          `${m.distinctReviews} reviews mention unanswered/missed calls`,
          ...m.fragments,
        ]),
        intakeConfirmed: confirmed,
      };
    }
    // CONFIRMED AT INTAKE fires even when the site says "text us". A texting option
    // on a website is a way to start a conversation, not a workflow that fires on a
    // missed call — and the client just told us what actually happens to one.
    if (confirmedLine) {
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
    }
    if (d.business.phone && d.website && !d.website.mentionsTextingOption) {
      return { tier: "BENCHMARK", evidence: ["Phone line with no visible text-back / missed-call recovery path"] };
    }
    return null;
  },

  no_after_hours_coverage: (d) => {
    // An after-hours auto-response IS the fix this leak sells. They have it → gone.
    if (d.intake?.afterHoursHandling === "AUTO_RESPONSE") return null;
    const confirmedLine = confirmedIntakeEvidence(d.intake?.afterHoursHandling, AFTER_HOURS_CONFIRMED);
    const confirmed = confirmedLine !== null;

    const w = d.website;
    // OBSERVED asserts "no capture path" as fact → requires CONFIRMED absence
    // (no site at all, or a good scan that found neither booking nor chat).
    const captureConfirmedAbsent =
      !w || (isAbsent(w.hasOnlineBookingLink) && isAbsent(w.hasChatWidget));
    if (d.gbp?.limitedHours && captureConfirmedAbsent) {
      return {
        tier: "OBSERVED",
        evidence: withConfirmation(confirmedLine, [
          "Google hours show evenings + weekends closed, with no online booking or chat to catch after-hours demand",
        ]),
        intakeConfirmed: confirmed,
      };
    }
    // BENCHMARK is already hedged, so a not-confirmed-present path is enough
    // (covers ABSENT and UNKNOWN alike).
    const captureNotConfirmed =
      !w || (!isPresent(w.hasOnlineBookingLink) && !isPresent(w.hasChatWidget));
    if (d.gbp && !d.gbp.hoursListed && captureNotConfirmed) {
      return {
        tier: "BENCHMARK",
        evidence: withConfirmation(confirmedLine, [
          "No hours listed on Google and no 24/7 capture path detected",
        ]),
        intakeConfirmed: confirmed,
      };
    }
    // CONFIRMED AT INTAKE with nothing visible to point at: the gap is still real
    // and still stated as fact — they told us what an after-hours caller gets.
    if (confirmedLine) {
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
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
    //
    // WHICH TIER DEPENDS ON WHETHER WE ALSO SAW IT. The tier says how the fire was
    // established, and the grade derived from it decides whether the write-up may
    // claim we detected this:
    //   · scan CONFIRMED absent → we measured it AND they confirmed it. OBSERVED,
    //     which grades to "observed" — the strongest, most defensible framing.
    //   · scan UNKNOWN (thin / bot-walled site) → we measured NOTHING. The only
    //     thing holding this leak up is what the client said, so it fires the way
    //     every other told-us-at-intake leak fires: BENCHMARK + intakeConfirmed,
    //     which grades to "disclosed" and is written declaratively but ATTRIBUTED.
    // Stamping OBSERVED on the second case (as this used to) would have the
    // deliverable present the client's own answer as something our tooling found.
    if (bm === "PHONE_EMAIL_ONLY") {
      const confirmedLine =
        "Confirmed at intake: they take bookings by phone/email only — no online scheduler";
      if (isAbsent(link)) {
        return {
          tier: "OBSERVED",
          evidence: [
            "No online booking link on the site or Google Business Profile",
            confirmedLine,
          ],
          intakeConfirmed: true,
        };
      }
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
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
    // The client's own "no" travels with the review signal too. It used to be read
    // only on the benchmark path, so a business whose reviews mention unreturned
    // quotes AND who told us at intake they run no follow-up came out graded as a
    // guess — hedged back at a client who had already answered the question. The
    // three multiple-choice detectors above have always carried the confirmation
    // through their EVIDENCED branch; these two now match them.
    const confirmedLine = intakeSaysNo(d.intake?.hasFollowUpSequence)
      ? "Confirmed at intake: no automated follow-up sequence in place"
      : null;
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.noFollowUp);
    if (m.distinctReviews >= 2) {
      return {
        tier: "EVIDENCED",
        evidence: withConfirmation(confirmedLine, [
          `${m.distinctReviews} reviews mention no follow-up / never received a promised quote`,
          ...m.fragments,
        ]),
        intakeConfirmed: confirmedLine !== null,
      };
    }
    if (intakeNot(d.intake?.hasFollowUpSequence)) {
      const confirmed = intakeSaysNo(d.intake?.hasFollowUpSequence);
      return {
        tier: "BENCHMARK",
        evidence: [
          confirmed
            ? "Confirmed at intake: no automated follow-up sequence in place"
            // Pre-intake this is an INDUSTRY PATTERN, not an observation. Say so
            // in the evidence itself so no downstream copy can read it as a fact
            // we established about this business.
            : "What happens after a lead goes quiet isn't visible from outside — most local businesses stop after one or two touches, which is the industry pattern we're flagging, not something we saw here. Verified at kickoff",
        ],
        intakeConfirmed: confirmed,
      };
    }
    return null;
  },

  no_show_exposure: (d) => {
    // Same fix as no_follow_up_sequence: a client who told us they have no
    // reminder system has DISCLOSED it, whether or not their reviews also show it.
    const confirmedLine = intakeSaysNo(d.intake?.hasReminderSystem)
      ? "Confirmed at intake: no appointment reminder system in place"
      : null;
    const m = matchReviewSignal(d.googleReviews?.reviewTexts ?? [], REVIEW_SIGNALS.schedulingFriction);
    if (m.distinctReviews >= 2) {
      return {
        tier: "EVIDENCED",
        evidence: withConfirmation(confirmedLine, [
          `${m.distinctReviews} reviews mention scheduling friction / no-shows`,
          ...m.fragments,
        ]),
        intakeConfirmed: confirmedLine !== null,
      };
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
          : "Whether leads are tracked in a pipeline isn't visible from outside — most owner-run local businesses keep them in an inbox or a notebook, which is an industry pattern rather than something we observed here. Verified at kickoff",
      ],
      intakeConfirmed: confirmed,
    };
  },

  no_database_reactivation: (d) => {
    // TWO QUESTIONS, TWO DIFFERENT JOBS — and reading them in this order is the
    // whole fix. hasPastCustomerDatabase has INVERSE polarity: `false` means "no
    // past-customer list exists" → nothing to reactivate → suppressed, while
    // `true` is what makes the leak fire. So it could only ever take this leak OFF
    // the report and could never confirm the claim the leak actually makes, which
    // is that the list is going COLD. pastCustomerContact answers that one:
    //   · no list at all              → suppressed (nothing to reactivate)
    //   · SYSTEMATIC                  → suppressed. A list worked within the last
    //                                   month IS the campaign we would be selling.
    //   · OCCASIONAL/OVER_A_YEAR/NEVER→ CONFIRMED. They described a dormant list
    //                                   in their own words, so it needs no
    //                                   review-count proxy standing behind it.
    //   · unanswered                  → today's benchmark hedge, unchanged.
    if (d.intake?.hasPastCustomerDatabase === false) return null;
    const contact = d.intake?.pastCustomerContact;
    if (contact === "SYSTEMATIC") return null;
    const confirmedLine = confirmedIntakeEvidence(contact, PAST_CUSTOMER_CONTACT_CONFIRMED);
    if (confirmedLine) {
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
    }
    const established = (d.googleReviews?.count ?? 0) >= 20;
    if (established) {
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
            : "What happens to a 'not right now' lead months later isn't visible from outside — very few local businesses run a long-cycle drip at all, which is the industry pattern we're flagging, not something we saw here. Verified at kickoff",
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

  // NOTE: there is deliberately no `unanswered_reviews` detector. The leak was
  // removed from the taxonomy because nothing in the pipeline can feed it — see
  // the ownerResponseRate comment in toScrapeData. The Review Response workflow
  // it used to justify now rides on low_review_velocity's ghlFix, which fires on
  // observed review counts.
  //
  // WHAT CAME BACK, AND WHY IT IS NOT THAT. `no_review_replies` below reports the
  // same subject — reviews nobody answers — from the one source that actually
  // exists for it: the client's own answer. It reads intake and NOTHING ELSE, so
  // it cannot repeat the old leak's mistake of advertising a measurement we never
  // take. Note the shape of the detector: no scan branch, no benchmark fallback,
  // no ownerResponseRate.
  no_review_replies: (d) => {
    const answer = d.intake?.reviewReplyOwner;
    // Somebody is replying — the owner himself or a staff member / agency. Either
    // way there is no gap to report, and telling a client his reviews go unanswered
    // when he just told us he answers them is the insult the whole intake contract
    // exists to prevent.
    if (answer === "OWNER" || answer === "STAFF_OR_AGENCY") return null;
    const confirmedLine = confirmedIntakeEvidence(answer, REVIEW_REPLY_CONFIRMED);
    // UNANSWERED DOES NOT FIRE, and this is the deliberate difference from every
    // other detector in this file. Elsewhere a blank leaves today's benchmark
    // hedge, because some outside signal still stands behind the claim. Here
    // nothing does: we fetch no owner-reply data from anywhere. Firing hedged off a
    // blank would be manufacturing a finding out of an unasked question — which is
    // precisely why the old unanswered_reviews leak had to be deleted, and the one
    // failure this reinstatement must not repeat.
    if (!confirmedLine) return null;
    return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
  },

  // ── Cluster E — channel & measurement ───────────────────────────────────
  social_dm_unmanaged: (d) => {
    // NO and NO_ACCOUNTS BOTH suppress this leak, and for the same reason: there
    // is no leak in a channel that brings no enquiries. Nothing is being lost in
    // an inbox nobody checks if nothing arrives there.
    //
    // THEY ARE STILL NOT THE SAME ANSWER. Only NO_ACCOUNTS switches the Social DM
    // Capture workflow off in the build — "NO" means they have the accounts, so
    // the capture workflow still installs and simply sits quiet. That difference
    // lives in the build catalogue, not here; this detector only needs to know
    // that neither answer leaves a leak to report.
    const answer = d.intake?.socialEnquiries;
    if (answer === "NO" || answer === "NO_ACCOUNTS") return null;
    const confirmedLine = confirmedIntakeEvidence(answer, SOCIAL_ENQUIRIES_CONFIRMED);

    const w = d.website;
    if (w && (w.linksToFacebook || w.linksToInstagram)) {
      const channels = [w.linksToFacebook && "Facebook", w.linksToInstagram && "Instagram"].filter(Boolean);
      // The kickoff-verification tail comes OFF once they've answered: they told
      // us enquiries arrive there, so there is nothing left to verify at kickoff
      // and re-asking in a document they paid for reads as boilerplate.
      const seen = confirmedLine
        ? `Active on ${channels.join(" + ")}`
        : `Active on ${channels.join(" + ")}; DM response handling not visible externally — verified at kickoff`;
      return {
        tier: "BENCHMARK",
        evidence: withConfirmation(confirmedLine, [seen]),
        intakeConfirmed: confirmedLine !== null,
      };
    }
    // CONFIRMED AT INTAKE with no social link to point at: still a real gap. A
    // business can take Instagram DMs without ever linking the profile from its
    // website, and the client just told us enquiries arrive that way.
    if (confirmedLine) {
      return { tier: "BENCHMARK", evidence: [confirmedLine], intakeConfirmed: true };
    }
    return null;
  },

  // A measurement FINDING, not one of the sold workflows. It used to ignore its
  // argument entirely and fire for 100% of businesses with no way to switch it
  // off — so a client who already runs call tracking still got told they don't.
  // Now it reads intake and suppresses on a "yes", exactly like no_crm_pipeline.
  no_call_tracking: (d) => {
    if (d.intake?.hasCallTracking === true) return null; // suppressed entirely
    const confirmed = intakeSaysNo(d.intake?.hasCallTracking);
    return {
      tier: "BENCHMARK",
      evidence: [
        confirmed
          ? "Confirmed at intake: call performance (answered vs missed, after-hours share) isn't tracked today"
          : "Whether calls are tracked isn't visible from outside — most owner-run local businesses have no answered-vs-missed record, which is an industry pattern rather than something we observed here. Verified at kickoff",
      ],
      intakeConfirmed: confirmed,
    };
  },

  // INFERENCE ONLY. We do not scan for a payment/deposit mechanism anywhere, so
  // this fires on vertical membership and nothing else — the evidence string says
  // so plainly, and intake is the only thing that can contradict it.
  payment_booking_friction: (d) => {
    if (d.intake?.hasOnlinePayment === true) return null; // suppressed entirely
    const depositVerticals: Vertical[] = ["roofing", "contractor_general", "hvac", "plumbing", "med_spa"];
    if (!depositVerticals.includes(d.business.industry)) return null;
    const confirmed = intakeSaysNo(d.intake?.hasOnlinePayment);
    return {
      tier: "BENCHMARK",
      evidence: [
        confirmed
          ? "Confirmed at intake: no online payment or deposit link — deposits are collected manually"
          : "Deposit-taking trade: how deposits get collected isn't something we can see from outside, and we didn't scan for it. Industry pattern only — verified at kickoff",
      ],
      intakeConfirmed: confirmed,
    };
  },

  // ── Out of scope ────────────────────────────────────────────────────────
  oos_slow_site_speed: (d) => {
    const ps = d.pageSpeed;
    if (ps && (ps.mobileScore < 50 || ps.lcpSeconds > 4)) {
      return { tier: "OBSERVED", evidence: [`Mobile PageSpeed ${ps.mobileScore}/100, LCP ${ps.lcpSeconds}s`] };
    }
    return null;
  },

  // REMOVED with their taxonomy entries: oos_dated_site_design (screenshots are
  // never analyzed programmatically) and oos_gbp_visibility_gaps (we don't pull
  // photo/post counts). Both returned null unconditionally, so the "Also worth
  // knowing" section was advertising two checks that never ran.
};

// ============================================================================
// getFiredLeaks — the single accessor the rest of the codebase uses.
// ============================================================================

export function scoreLeak(leak: Leak, tier: EvidenceTier, data: ScrapeData): number {
  const boost = leak.verticalBoost?.[data.business.industry] ? 1.2 : 1.0;
  return Math.round(leak.impactWeight * TIER_MULTIPLIER[tier] * boost * 100) / 100;
}

/** Run every leak's detection against the data. Returns ALL fired leaks
 *  (in-scope + out-of-scope), unranked. Suppression is applied inline.
 *
 *  THIS IS THE ONLY PLACE A FIRE IS CONSTRUCTED, which is what makes it the only
 *  place a grade is derived. Every fire leaves here graded — there is no path
 *  that can produce an ungraded one, and nothing downstream needs to guess. */
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
      grade: gradeOf({ tier: result.tier, intakeConfirmed: result.intakeConfirmed }),
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

/** Which half of the funnel this detection is running in. An un-migrated caller
 *  declares nothing, so we read it off the data: intake present means the sale
 *  already happened. A caller with neither is treated as pre-sale — the safe end,
 *  because it is the end that gets asserted against below. */
function effectiveMode(raw: RawResearch): "pre_sale" | "post_intake" {
  if (raw.mode) return raw.mode;
  return raw.intake ? "post_intake" : "pre_sale";
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

  // BELT AND BRACES. The type above already makes `mode: "pre_sale"` + intake a
  // compile error, so this can only fire if something bypassed the types — an
  // `any`, a JSON body, a cast. It throws rather than continuing because the thing
  // it caught is a disclosure about to be printed on a FREE, PRE-SALE document to
  // someone who has told us nothing: not a degraded output, a wrong one. The fix is
  // always the same and is named in the message — drop `intake` from the pre-sale
  // call, or run it as post_intake.
  if (effectiveMode(raw) === "pre_sale") {
    const disclosed = fired.filter((f) => f.grade === "disclosed");
    if (disclosed.length > 0) {
      throw new Error(
        `Pre-sale detection produced ${disclosed.length} disclosed leak(s): ` +
          `${disclosed.map((f) => f.leak.id).join(", ")}. Nothing is disclosed before the sale — ` +
          `remove \`intake\` from this detectLeaks call, or declare mode: "post_intake" if the sale has closed.`
      );
    }
  }

  return {
    data,
    fired,
    report: reportLeaks(fired),
    outOfScope: outOfScopeLeaks(fired),
    coldAudit: selectColdAudit(fired),
    grades: gradeAreas(fired),
  };
}
