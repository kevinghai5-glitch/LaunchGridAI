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
//   3. ranks + grades + selects per RULES (ranking, grading, cold-audit),
//   4. reports what came back CLEAN (`cleanChecks`) — a check that ran and found
//      nothing wrong is a finding too, and the document says so out loud.
//
// Semantics come entirely from the taxonomy. Nothing here invents a leak, a
// stat, or a fix — it only decides which taxonomy entries fired and at what
// evidence tier, with the concrete evidence that triggered them.
//
// CHECKABILITY IS ENFORCED HERE, NOT ASSUMED. `Leak.checkability` says whether the
// person reading a claim could check it. Three places in this file act on it: the
// grade derivation cannot return "observed" for an INTERPRETIVE leak, the tier
// ceiling clamps a detector that returns OBSERVED for one anyway, and a pre-sale
// detection does not contain them at all. The reason is a shipped document that
// told a law firm "there's no primary action above the fold, and your phone number
// is buried" under the label "Measured on your public pages" — when the firm had
// both, and when our own `tel:` fingerprint had come back PRESENT. See
// docs/detector-checkability.md.
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
  isInterpretive,
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
   *  leak may be written (gradeOf in leak-taxonomy.ts), derived from the tier AND
   *  the leak's checkability, so an interpretive claim can never come out
   *  "observed" however its detector fired. Derived once, HERE, and
   *  carried from this point on: LeakInput copies it, the saved pack stamps it,
   *  the softener and the lint key on it. Never recompute it at a call site —
   *  two derivations are two chances for the voice to drift from what we know. */
  grade: EvidenceGrade;
}

// ── RawResearch: what the pipeline already assembles per business ────────────
//
// PRE-SALE IS A SEPARATE SHAPE, NOT A CONVENTION. Nothing is disclosed before the
// sale. The free cold audit — the shape's original consumer — was deleted by
// owner ruling (2026-08-01), but exactly one pre-sale surface still reads this
// adapter: the observed-facts row (src/lib/observed-facts.ts), the four measured
// numbers the operator reads before he dials. It declares `mode: "pre_sale"` so
// that `intake?: never` keeps handing intake to a pre-sale read a COMPILE ERROR,
// which is the one kind of guarantee a future edit cannot quietly skip.
//
// `mode` IS NOW A COMPILE-TIME DISCRIMINANT ONLY. detectLeaks no longer branches
// on it at runtime — the branches it selected (the pre-sale interpretive drop and
// the disclosed-fire throw) existed to police the free cold-audit generator, and
// died with it. Post-intake callers that declare `mode: "post_intake"` keep
// compiling unchanged; omitting `mode` still falls to the post-intake variant so
// callers that predate the split keep compiling.

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

/** BEFORE THE SALE — the observed-facts row. A scan and nothing else. */
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

/** ADVISORY HEURISTIC — NO DETECTOR READS WHAT THIS RETURNS.
 *
 *  It asks "is one of thirteen phrases inside the first 1500 characters of the
 *  homepage markdown", and that is not the question its old field name promised.
 *  Markdown has no fold, so nothing about POSITION is measured; the window is
 *  routinely spent on nav, logo alt text and a cookie banner before the hero; and
 *  a hero button reading "Free Case Evaluation" or "Talk to an attorney" is not on
 *  the list, so it scores as no call to action at all. That combination produced a
 *  finding telling a law firm it had "no primary action above the fold" and a
 *  "buried" phone number, under a measurement label, when it had both.
 *
 *  IMPROVING THE PARSE WAS CONSIDERED AND REJECTED, because there is no parse to
 *  improve: the fold is a property of a RENDERED viewport, and we render nothing.
 *  Adding more phrases to the regex would only move the false-negative boundary
 *  around. So this stopped being treated as ground truth — it feeds no detector,
 *  it is in UNCITABLE_SCRAPE_FIELDS, and it survives only because the contract
 *  field does. The one landing-page signal that IS checkable — whether a `tel:`
 *  link exists in the HTML — is a fingerprint, and that is what weak_landing_cta
 *  now fires on. */
function detectPrimaryCtaAboveFold(homepageMarkdown: string): boolean {
  if (!homepageMarkdown) return false;
  return CTA_RE.test(homepageMarkdown.slice(0, 1500));
}

// ── The form, read as a form ─────────────────────────────────────────────────
//
// WHAT WAS WRONG. `formHasQualifyingFields` used to be
// `QUALIFYING_FIELD_RE.test(html || corpus)` — a prose regex over the joined
// cleaned HTML of EVERY scraped page. It was never scoped to the form it claimed
// to describe, so "we work within your budget" in a paragraph of marketing copy
// suppressed a real gap, and a genuine `<select name="budget">` whose options load
// after render could leave it false. The finding built on it — "your contact form
// collects no qualifying fields (job type / budget / timeline / service area)" —
// was graded `observed`, i.e. printed as a measurement, about a form nothing had
// read.
//
// WHAT IT IS NOW. Each `<form>` block is extracted from the post-JS DOM and its
// OWN fields are read: the `name`, `id`, `placeholder` and `aria-label` of every
// `<input|select|textarea>` inside it, plus the text of the `<label>`s in the same
// block. QUALIFYING_FIELD_RE runs against THAT. Three consequences worth stating:
//   · the claim becomes checkable in ten seconds by the person reading it, and the
//     finding can quote the field names back rather than characterising them;
//   · a site-search box, a newsletter signup and a login form stop counting as
//     "the contact form" (SEARCH_FORM_RE + the lead-capture test below);
//   · when no form's fields can be read, the answer is UNKNOWN rather than false.
//     Absence of a parse is not evidence of a bare form, and the detector hedges
//     instead of asserting.

const FORM_BLOCK_RE = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
const FIELD_TAG_RE = /<(input|select|textarea)\b([^>]*)>/gi;
const LABEL_TEXT_RE = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
/** A `<select>`'s options are values, not the question. They are stripped out of
 *  label text so a field reads back as "What's your budget?" rather than as the
 *  question with every price bracket trailing behind it. */
const OPTION_BLOCK_RE = /<option\b[\s\S]*?<\/option>/gi;
/** How much of a field's own wording is quoted back. Long enough for a real
 *  question, short enough that a field list stays a list. */
const FIELD_LABEL_MAX = 48;

/** A form that exists to search, subscribe or log in is not lead capture. Matched
 *  against the form's own attributes and, for the single-input case, its field
 *  names — `name="s"` / `name="q"` is the WordPress/Shopify search convention. */
const SEARCH_FORM_RE =
  /role\s*=\s*["']?search|\b(id|class|name|action)\s*=\s*["'][^"']*(search|newsletter|subscribe|signup|sign-up|login|log-in|signin|sign-in|cart|checkout|coupon|currency|language)/i;
const SEARCH_FIELD_NAME_RE = /^(s|q|k|query|search|keyword|keywords|term|email_address_?\d*)$/i;
/** Field types that are not something a human fills in. */
const NON_INPUT_TYPES = new Set(["hidden", "submit", "button", "image", "reset"]);

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim() || null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A field descriptor, in the words the markup itself uses. */
interface ParsedField {
  /** Best human-readable name we have: label text, else placeholder / aria-label,
   *  else the raw `name` / `id`. Used verbatim in the finding's evidence. */
  label: string;
  /** Everything the field says about itself, joined — the surface the qualifying
   *  regex is matched against. */
  surface: string;
}

export interface FormAnalysis {
  /** How many `<form>` blocks were found at all. 0 = nothing to read. */
  formsFound: number;
  /** Does the form itself ask a qualifying question? PRESENT / ABSENT come from a
   *  form we actually read; UNKNOWN means no lead-capture form with readable field
   *  descriptors was found, so no claim may be made about what any form asks. */
  qualifying: Tri;
  /** True when at least one form looks like lead capture rather than a search box,
   *  a newsletter signup or a login. */
  hasLeadCaptureForm: boolean;
  /** The lead-capture form's own field names, de-duplicated, capped at 8. Empty
   *  when nothing was parsed. */
  fieldsSeen: string[];
}

const EMPTY_FORM_ANALYSIS: FormAnalysis = {
  formsFound: 0,
  qualifying: "UNKNOWN",
  hasLeadCaptureForm: false,
  fieldsSeen: [],
};

/** Read every `<form>` in the scraped HTML and report what its fields ask.
 *  Exported so a verification script can assert on the parse directly, against
 *  real markup, without needing a scrape. */
export function analyzeForms(html: string): FormAnalysis {
  if (!html) return EMPTY_FORM_ANALYSIS;

  let formsFound = 0;
  let hasLeadCaptureForm = false;
  let qualifyingHit = false;
  let readableFields = false;
  const fieldsSeen: string[] = [];

  for (const block of Array.from(html.matchAll(FORM_BLOCK_RE))) {
    formsFound += 1;
    const openTag = block[1] ?? "";
    const body = block[2] ?? "";

    const fields: ParsedField[] = [];
    const labels: string[] = [];
    let hasTextarea = false;
    let hasEmail = false;

    /** Read the fields in one fragment of the form, carrying down the label text
     *  that wraps them (if any). A field's DISPLAY name prefers the human wording
     *  in this order — the label that wraps it, its placeholder, its aria-label,
     *  then the raw `name`/`id` — because the point of quoting the fields back is
     *  that the owner recognises his own form. Its MATCH surface is all of them
     *  joined: "What's your budget?" and `name="budget"` should both count. */
    const readFields = (fragment: string, labelText: string | null): void => {
      for (const f of Array.from(fragment.matchAll(FIELD_TAG_RE))) {
        const tagName = (f[1] ?? "").toLowerCase();
        const tag = f[0] ?? "";
        const type = (attr(tag, "type") ?? "").toLowerCase();
        if (NON_INPUT_TYPES.has(type)) continue;
        if (tagName === "textarea") hasTextarea = true;
        if (type === "email") hasEmail = true;
        const name = attr(tag, "name") ?? attr(tag, "id");
        const placeholder = attr(tag, "placeholder");
        const aria = attr(tag, "aria-label");
        const label = labelText ?? placeholder ?? aria ?? name;
        if (!label) continue;
        fields.push({
          label,
          surface: [name, placeholder, aria, labelText].filter(Boolean).join(" "),
        });
      }
    };

    // A wrapping <label> is usually the only human-readable description a field
    // has ("<label>What's your budget?<select name="b">…"), so labels are read
    // first and their text is attached to the fields inside them. Whatever sits
    // outside a label is then read on its own.
    for (const l of Array.from(body.matchAll(LABEL_TEXT_RE))) {
      const inner = l[1] ?? "";
      const text = stripTags(inner.replace(OPTION_BLOCK_RE, " "))
        .replace(/[:*]\s*$/, "")
        .trim()
        .slice(0, FIELD_LABEL_MAX);
      if (text) labels.push(text);
      readFields(inner, text || null);
    }
    readFields(body.replace(LABEL_TEXT_RE, " "), null);

    // Is this lead capture, or furniture? A search box is one text input named
    // s/q/search; a newsletter signup announces itself in the form's attributes.
    // Anything with a free-text message box, an email field, or two or more
    // human-filled inputs is treated as capture.
    const searchLike =
      SEARCH_FORM_RE.test(openTag) ||
      (fields.length <= 1 && fields.every((f) => SEARCH_FIELD_NAME_RE.test(f.label)));
    const looksLikeCapture =
      !searchLike && (hasTextarea || hasEmail || fields.length >= 2);
    if (!looksLikeCapture) continue;

    hasLeadCaptureForm = true;
    // The qualifying question can be worded on the field or on its label, so both
    // are searched — but only ever within THIS form block.
    const formSurface = [...fields.map((f) => f.surface), ...labels].join(" \n ");
    if (fields.length > 0 || labels.length > 0) readableFields = true;
    if (QUALIFYING_FIELD_RE.test(formSurface)) qualifyingHit = true;
    for (const f of fields) {
      const clean = f.label.replace(/\s+/g, " ").trim();
      if (!clean) continue;
      if (fieldsSeen.length >= 8) break;
      if (!fieldsSeen.some((seen) => seen.toLowerCase() === clean.toLowerCase())) {
        fieldsSeen.push(clean);
      }
    }
  }

  const qualifying: Tri = qualifyingHit
    ? "PRESENT"
    : hasLeadCaptureForm && readableFields
      ? "ABSENT"
      : "UNKNOWN";

  return { formsFound, qualifying, hasLeadCaptureForm, fieldsSeen };
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

/** Google's own "good" ceiling for Cumulative Layout Shift. At or below it, the
 *  page is stable and we say so out loud (cleanChecks); above it, the number is
 *  worth printing beside the speed evidence. Not a threshold we invented: it is the
 *  Core Web Vitals boundary Lighthouse itself reports against. */
export const CLS_GOOD_MAX = 0.1;

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

  // The form, read as a form rather than as prose on a page. rawHtml first: it is
  // the post-JS DOM, so a form rendered by a script is in it. Cleaned `html` is the
  // fallback for a native-fetch scrape.
  const forms = analyzeForms(rawHtml || html);

  const website: ScrapeData["website"] = hasWebsiteUrl
    ? {
        pagesFound,
        pageText,
        scanConfident: scanGood,
        hasContactForm: triState(intel.website.formDetected, scanGood),
        // LEGACY BOOLEAN, now derived from the form-scoped parse. It falls back to
        // the old page-wide regex ONLY when no form could be read at all, so a
        // caller still reading the boolean keeps its previous behaviour on a thin
        // scan while every real parse comes off the form itself. The detector reads
        // the tri-state below, which is the one that can say "we don't know".
        formHasQualifyingFields:
          forms.qualifying === "PRESENT"
            ? true
            : forms.qualifying === "ABSENT"
              ? false
              : intel.website.formDetected && QUALIFYING_FIELD_RE.test(html || corpus),
        formQualifyingFields: forms.qualifying,
        formFieldsSeen: forms.fieldsSeen.length ? forms.fieldsSeen : undefined,
        // Booking link can be corroborated by GBP (a separate Google source), so
        // a GBP booking link makes it PRESENT even on a thin site scan.
        hasOnlineBookingLink: triState(
          bookingMatched,
          scanGood || Boolean(dfs?.gbp.hasBookingLink)
        ),
        hasChatWidget: triState(intel.website.marketing.chat.length > 0, scanGood),
        hasClickToCallOnMobile: triState(intel.website.phoneClickable, scanGood),
        // THE NEXT TWO FEED NO DETECTOR AND MAY NOT BE CITED (see the field comments
        // in leak-taxonomy.ts and UNCITABLE_SCRAPE_FIELDS). They are still computed
        // because the contract field is required and the operator can use the hint
        // when he writes site advisory by hand — never because a finding may read
        // them. weak_landing_cta used to fire on both; it no longer does.
        hasPrimaryCtaAboveFold: detectPrimaryCtaAboveFold(pageText.home ?? corpus),
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
      ? {
          mobileScore: perf.performanceScore,
          lcpSeconds: perf.metrics.lcpSeconds,
          // CARRIED THROUGH AT LAST. Lighthouse has always reported it and this
          // adapter has always dropped it, which is why a layout shift of 0 could
          // only ever be printed as a bare number in a metrics strip. It is a real
          // measurement, so a good one is stated as good news (cleanChecks) and a
          // bad one rides along in the slow-site evidence. `?? undefined` because
          // the metric is nullable upstream and the contract slot is optional.
          cls: perf.metrics.cls ?? undefined,
        }
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
        // TWO HALVES, TWO PROVENANCES, KEPT APART IN ONE SENTENCE. The hours are
        // Google's own timetable — state them flatly. The absence is bounded by the
        // booking and chat provider lists we fingerprint on the pages we scanned, so
        // it says exactly that and no more. It must not become "nothing reaches an
        // after-hours caller": what happens to one is intake, and pre-sale there is
        // no intake.
        evidence: withConfirmation(confirmedLine, [
          "Google hours show evenings and weekends closed, and we found no booking link or chat widget on the pages we scanned",
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
      // "DETECTED" AND "THE PAGES WE SCANNED" ARE BOTH LOAD-BEARING. CHAT_PROVIDERS
      // is a closed list of twelve hosts — Olark, Freshchat, Chatra, Smartsupp,
      // JivoChat, Weave, Hatch, Chatwoot and LeadConnector's own widget are not on
      // it and all read ABSENT. This sentence claims the fingerprint came back
      // empty, which is true, rather than that no widget exists, which we don't know.
      return {
        tier: "OBSERVED",
        evidence: ["No live-chat / webchat widget detected on the pages we scanned"],
      };
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
    // OBSERVED REQUIRES THAT WE ACTUALLY READ THE FORM. `formQualifyingFields` is
    // ABSENT only when a lead-capture form was parsed and none of ITS OWN fields
    // asks a qualifying question (analyzeForms). The old branch fired on a boolean
    // computed from a prose regex across every page, which is how "your contact
    // form collects no qualifying fields" got printed as a measurement about a form
    // nothing had read — and sometimes about a site-search box.
    //
    // The legacy boolean is still honoured for callers and fixtures that set it
    // directly and carry no tri-state; when the tri-state IS present it wins.
    const qualifying = w.formQualifyingFields;
    const readNoQualifiers = qualifying
      ? isAbsent(qualifying)
      : !w.formHasQualifyingFields;
    if (isPresent(w.hasContactForm) && readNoQualifiers) {
      // QUOTE THE FORM BACK. Naming the fields it does collect is what makes this
      // checkable in ten seconds by the person reading it — and it is the difference
      // between describing a form and characterising one.
      const seen = w.formFieldsSeen?.length
        ? ` — it asks: ${w.formFieldsSeen.join(", ")}`
        : "";
      return {
        tier: "OBSERVED",
        evidence: [
          `We read the form's own fields: nothing asks job type, budget, timeline or service area${seen}`,
        ],
      };
    }
    // A form is there and we could NOT read what it asks → hedge. Absence of a
    // parse is not evidence of a bare form, and this is the branch that used to be
    // missing: without it, an unreadable form fell through to no finding at all.
    if (isPresent(w.hasContactForm) && qualifying === "UNKNOWN") {
      return {
        tier: "BENCHMARK",
        evidence: [
          "A form is on the site, but what it asks before an enquiry reaches the owner couldn't be read from the outside — verified at kickoff",
        ],
      };
    }
    // Neither form nor chat confirmed present → hedged BENCHMARK (covers ABSENT
    // and UNKNOWN — intake likely runs through the phone, verified at kickoff).
    if (!isPresent(w.hasContactForm) && !isPresent(w.hasChatWidget)) {
      return { tier: "BENCHMARK", evidence: ["No confirmed form or chat capture — intake likely runs through the phone, qualified only by whoever answers; verified at kickoff"] };
    }
    return null;
  },

  // ── THE DETECTOR THAT SHIPPED A FALSE CLAIM, NARROWED TO WHAT IT CAN PROVE ──
  //
  // It used to build a reasons[] array from three tests, and ANY of them fired the
  // leak at OBSERVED — which graded to `observed`, which printed "Measured on your
  // public pages, {date}" beside whatever the model then wrote. Two of the three had
  // no ground truth behind them at all:
  //
  //   ✗ "no clear primary CTA above the fold on the homepage"
  //     = CTA_RE over the first 1500 characters of MARKDOWN. No fold exists in
  //       markdown; thirteen closed phrases; the window is spent on nav and cookie
  //       banners on most real sites. Deleted.
  //   ✗ "service pages missing a distinct CTA"
  //     = the same thirteen phrases over URL-classified "service" pages, with
  //       every() so one page out of five drags it false — and "distinct" is a
  //       judgment the code never makes. Deleted.
  //   ✓ "phone number is not click-to-call"
  //     = /href=["']tel:/i over the rawHtml corpus, behind proof-of-scan. Checkable
  //       in one browser inspection. KEPT, and it is now the whole detector.
  //
  // For the business this bug shipped against, the `tel:` link was PRESENT — so
  // this detector's own honest reason did NOT fire, and the document asserted the
  // opposite of the only thing we had fingerprinted. Deleting the other two is what
  // makes that impossible rather than unlikely.
  //
  // TIER IS EVIDENCED, DELIBERATELY, AND IT IS THE CEILING. Not OBSERVED: the
  // signal is real but the leak's subject — how well a page converts — is an
  // inference, and EVIDENCED is exactly "state the signal, then the inference". Not
  // BENCHMARK either: this is not an industry pattern, it is a thing we found. The
  // leak's checkability (INTERPRETIVE) independently bars `observed`, so two
  // mechanisms have to fail before a judgment can be printed as a measurement.
  weak_landing_cta: (d) => {
    const w = d.website;
    if (!w) return null;
    if (isAbsent(w.hasClickToCallOnMobile)) {
      return {
        tier: "EVIDENCED",
        evidence: ["No tel: link found anywhere in the HTML of the pages we scanned"],
      };
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
        // THE NUMBERS WERE ALWAYS RIGHT; THE LABEL ON THEM WAS WRONG. This used to
        // end "— under half the local benchmark". `competitors` is
        // intel.competitors.topRated: the three HIGHEST-RATED nearby businesses,
        // sorted by rating then review count. That is a deliberately unflattering
        // comparison set, not a market cross-section, so calling its median "the
        // local benchmark" describes a number nobody computed. Name the sample and
        // the comparison survives intact — it is still a real gap, honestly stated,
        // and it holds up when the owner checks it in front of us.
        evidence: [
          `${gr.count} reviews, against a median of ~${median} across the highest-rated nearby businesses we pulled`,
        ],
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
      // Layout shift rides along when it is measured AND poor. It does not open the
      // leak — speed does — and a GOOD layout shift is reported as a clean check
      // instead of being buried in a metrics strip (cleanChecks, below).
      const shift =
        ps.cls != null && ps.cls > CLS_GOOD_MAX ? `, layout shift ${ps.cls}` : "";
      return {
        tier: "OBSERVED",
        evidence: [`Mobile PageSpeed ${ps.mobileScore}/100, LCP ${ps.lcpSeconds}s${shift}`],
      };
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
    const tier = ceilingTier(leak, result.tier);
    fired.push({
      leak,
      tier,
      score: scoreLeak(leak, tier, data),
      evidence: result.evidence,
      intakeConfirmed: result.intakeConfirmed,
      // THE GRADE NOW KNOWS WHAT KIND OF CLAIM IT IS GRADING. Passing the leak
      // itself, rather than just the tier, is what makes "observed" unreachable for
      // an interpretive leak — the grade used to certify only that a detector had
      // fired, and "a detector fired" is not the same fact as "the sentence printed
      // under this label is true".
      grade: gradeOf({ tier, intakeConfirmed: result.intakeConfirmed, leak }),
    });
  }
  return fired;
}

/** The tier a fire is allowed to carry, given what kind of claim the leak makes.
 *
 *  BELT AND BRACES, AND IT SHOULD NEVER FIRE. The interpretive detectors have had
 *  their OBSERVED branches removed at source, so an INTERPRETIVE leak returning
 *  OBSERVED means someone added one back — which would put a judgment about a web
 *  page under "Measured on your public pages, {date}" on a document sent to a
 *  stranger. It CLAMPS AND WARNS rather than throwing: this runs on the path that
 *  generates a document at whatever hour he happens to be working, and a hard stop
 *  here would leave him with nothing over a defect that the clamp has already made
 *  harmless. The warning is the record; the fix is a detector edit in the morning. */
function ceilingTier(leak: Leak, tier: EvidenceTier): EvidenceTier {
  if (tier !== "OBSERVED" || !isInterpretive(leak)) return tier;
  console.warn(
    `[leak-detection] "${leak.id}" is checkability INTERPRETIVE but its detector returned ` +
      `tier OBSERVED. Clamped to EVIDENCED so nothing prints it as a measurement. ` +
      `An interpretive claim is a judgment, not something we measured — narrow the ` +
      `detector to the checkable assertion (see docs/detector-checkability.md §3.7).`
  );
  return "EVIDENCED";
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

/* ============================================================================
 * THE COLD AUDIT'S NUMBERED FINDINGS — HARD ONLY, STRONGEST FIRST, NEVER PADDED
 *
 * SURVIVES THE COLD AUDIT'S DELETION (2026-08-01), and here is exactly why: the
 * paid pack's LeakContext (src/lib/asset-generation.ts) declares a required
 * `coldAudit` field and the paid generation route fills it from detectLeaks'
 * return — both files are out of scope to change, so the selection stays. It is
 * a pure subtractive filter over already-fired leaks; nothing pre-sale reads it.
 * ==========================================================================*/

/** Strength of what stands behind a fire, for ordering. Lower sorts first. */
function evidenceRank(f: FiredLeak): number {
  if (f.tier === "OBSERVED") return 0; // we measured it
  if (f.tier === "EVIDENCED") return 1; // we saw a real signal and inferred from it
  return 2; // BENCHMARK — an industry pattern; never a numbered cold-audit finding
}

/** True when this fire is something we ESTABLISHED about this business, not a
 *  pattern we expect of businesses like them. */
const isEstablished = (f: FiredLeak): boolean =>
  f.tier === "OBSERVED" || f.tier === "EVIDENCED";

/**
 * THE COLD AUDIT'S NUMBERED FINDINGS. Up to three, and every one of them a fact
 * that cannot be wrong.
 *
 * WHAT THIS USED TO DO, AND WHY IT CHANGED. It took the top 3 by score and enforced
 * "at least 2 of the 3 must be OBSERVED or EVIDENCED" — which licensed one padded
 * slot, filled by whichever industry pattern happened to score highest, and a
 * rebalance branch that deliberately topped the list up to three from the
 * non-provable pool. A real audit shipped with two of its three numbered findings
 * being industry patterns while the one hard measurement sat underneath in an
 * unnumbered block. The padding is not a presentation flaw; it is what created the
 * room a fabricated measured claim walked into.
 *
 * THREE RULES NOW, ALL OF THEM SUBTRACTIVE:
 *   1. INTERPRETIVE leaks are excluded outright. Pre-sale carries only claims the
 *      reader can check — this is the second of three places that is enforced (the
 *      leak's own deliverableTargets is the first, detectLeaks' pre-sale drop the
 *      third), because a stranger's free document is not the place to be relying on
 *      one filter.
 *   2. Only ESTABLISHED fires (OBSERVED / EVIDENCED). A BENCHMARK fire is an
 *      industry pattern, and a pattern is not a finding about them — it belongs in
 *      the pivot section as one of the six questions, which is where it already is.
 *   3. NO PADDING. Three is a cap, not a quota. Two is fine. One is fine. Zero is
 *      fine and is handled deliberately — see cleanChecks() and DELIVERABLE_ROUTING.
 *      One fabricated claim destroys every true claim printed beside it, so a
 *      shorter document is strictly stronger than a padded one.
 *
 * Ordered by EVIDENCE STRENGTH first and score second, so finding 01 is the
 * strongest measurement we have rather than the highest-scoring guess.
 *
 * IT STILL CANNOT STRAND ANYONE. It never throws and it has no failure mode: it
 * returns what it has, including nothing. The document generates either way.
 */
export function selectColdAudit(fired: FiredLeak[]): FiredLeak[] {
  return reportLeaks(fired)
    .filter((f) => f.leak.deliverableTargets.includes("cold_audit"))
    .filter((f) => !isInterpretive(f))
    .filter(isEstablished)
    .sort((a, b) => evidenceRank(a) - evidenceRank(b) || b.score - a.score)
    .slice(0, 3);
}

/**
 * The fires that may NOT be written as findings, only as clearly-labelled advice.
 *
 * Paid pack only — pre-sale never sees them at all. They route to the site-advisory
 * surface (surfaces.siteAdvisory: "hand this to whoever looks after your website —
 * it is advice, not work we do"), which is the only honest home for a judgment about
 * a page we have never rendered. Their grade can never be `observed`, so nothing
 * downstream can stamp them with a measurement date even if one is rendered beside
 * a finding by mistake.
 */
export function advisoryOnlyLeaks(fired: FiredLeak[]): FiredLeak[] {
  return fired.filter((f) => isInterpretive(f));
}

/* ============================================================================
 * THE CHECKS THAT CAME BACK CLEAN
 * ==========================================================================*/

/**
 * A check that ran and found nothing wrong, in the exact words it may be printed in.
 *
 * WHY THIS EXISTS AT ALL — two owner notes that turn out to be the same note.
 *
 *   · A WELL-RUN BUSINESS PRODUCES ZERO FINDINGS, and that is a common and valuable
 *     prospect rather than an error state. Fast site, good reviews, booking link
 *     present: the audit must still generate, and what it has to say is what it
 *     CHECKED and what came back clean. A document that opens by telling a prospect
 *     their public presence is in good shape is more disarming than one that opens
 *     with criticism, and it is the honest reading of the scan.
 *   · A MEASUREMENT THAT CAME BACK FINE IS GOOD NEWS AND MUST BE SAID AS GOOD NEWS.
 *     Layout shift of 0 used to be printed as a bare number in a metrics strip,
 *     which reads as a third problem sitting beside two problems. It is not. It is
 *     "that's fine, not where you're leaking".
 *
 * And the reason it matters even when there ARE findings: a clean check stated by
 * name is what makes the finding beside it credible. "Your phone number is a tap
 * on mobile, your layout is stable, and here is the one thing that isn't working"
 * is a scan someone believes. Three problems and no clean checks is a sales pitch.
 *
 * EVERY STATEMENT HERE IS A MEASUREMENT OR A POSITIVE FINGERPRINT — never an
 * absence, never a judgment. A positive fingerprint is proof-positive (we found the
 * thing), which is precisely why the clean side can be stated flatly while the
 * absent side has to be scoped to what we looked for.
 */
export interface CleanCheck {
  /** Stable key so a renderer can order or select without matching on prose. */
  id:
    | "site_speed"
    | "layout_stability"
    | "review_volume"
    | "review_rating"
    | "online_booking"
    | "click_to_call"
    | "webchat"
    | "form_qualifies"
    | "open_hours";
  /** The sentence, ready to print. Second person, plain, no hedge — these are the
   *  things we are surest about in the whole document. */
  statement: string;
}

/** The owner-facing framing for the clean section. ONE COPY OF THESE STRINGS, here,
 *  so the emailed document, the plaintext copy and the public teaser cannot drift
 *  into three different ways of saying the same thing. */
export const CLEAN_SECTION_LABEL = "What we checked that came back clean";
export const CLEAN_SCAN_LEAD =
  "Publicly, you're in better shape than most businesses I look at.";
/** The bridge from a clean scan to the questions. It is the whole argument of the
 *  document in one sentence, and it is why zero findings is not a dead end. */
export const CLEAN_SCAN_BRIDGE =
  "Which is why the interesting questions are the ones a scan can't answer.";
/** The tail that turns a neutral metric into good news. Appended to measurements
 *  only — a fingerprint ("there's a booking link") already reads as positive. */
const NOT_WHERE_YOU_LEAK = "that's fine, not where you're leaking";

/**
 * Every check that ran on this business and came back clean, in print-ready words.
 *
 * Order is deliberate: measurements first (they are the strongest and the easiest
 * to verify), then the capture paths that exist, then the listing. Empty is a valid
 * return — a business with no website and no PSI run has had nothing checked.
 */
export function cleanChecks(data: ScrapeData): CleanCheck[] {
  const out: CleanCheck[] = [];
  const w = data.website;
  const ps = data.pageSpeed;

  // ── Measured, and good ─────────────────────────────────────────────────────
  if (ps && ps.mobileScore >= 50 && ps.lcpSeconds <= 4) {
    out.push({
      id: "site_speed",
      statement: `Your site loads in ${ps.lcpSeconds}s on a phone and scores ${ps.mobileScore}/100 for speed — ${NOT_WHERE_YOU_LEAK}.`,
    });
  }
  if (ps && ps.cls != null && ps.cls <= CLS_GOOD_MAX) {
    // OWNER'S NOTE, IN THE OWNER'S WORDS. A layout shift of 0 used to be printed as
    // a bare number in a strip of metrics beside two problems, which reads as a
    // third problem. It is the opposite of a problem, and it now says so.
    out.push({
      id: "layout_stability",
      statement: `Layout shift measures ${ps.cls}: nothing moves around while the page loads — ${NOT_WHERE_YOU_LEAK}.`,
    });
  }

  // ── Review volume, against the sample we actually pulled ───────────────────
  const gr = data.googleReviews;
  const counts = (data.competitors ?? [])
    .map((c) => c.reviewCount)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (gr && gr.count > 0 && counts.length > 0) {
    const median = counts[Math.floor(counts.length / 2)];
    if (median > 0 && gr.count >= median * 0.5) {
      out.push({
        id: "review_volume",
        statement: `You have ${gr.count} Google reviews, against a median of ~${median} across the highest-rated nearby businesses we pulled — ${NOT_WHERE_YOU_LEAK}.`,
      });
    }
  }
  if (gr && gr.count >= 10 && gr.rating >= 4.5) {
    out.push({
      id: "review_rating",
      statement: `You're rated ${gr.rating} across ${gr.count} reviews — people who hire you are happy, and that is the hard part.`,
    });
  }

  // ── Capture paths that are actually there (positive fingerprints) ───────────
  if (w && isPresent(w.hasOnlineBookingLink)) {
    out.push({
      id: "online_booking",
      statement: "There's a booking link on your pages — somebody can pick a time without waiting for the office to open.",
    });
  } else if (data.gbp?.hasBookingLink) {
    out.push({
      id: "online_booking",
      statement: "Your Google listing carries a booking link — somebody can pick a time straight off the search result.",
    });
  }
  if (w && isPresent(w.hasClickToCallOnMobile)) {
    // THE ANTIDOTE TO THE BUG THIS WHOLE PASS IS ABOUT. The audit that shipped told
    // a business its phone number was "buried" when this exact check had come back
    // PRESENT. The check that was falsely reported as a failure is now reported, by
    // name, as clean.
    out.push({
      id: "click_to_call",
      statement: "Your phone number is a tap-to-call link in the page itself — on a phone, calling you is one thumb.",
    });
  }
  if (w && isPresent(w.hasChatWidget)) {
    out.push({
      id: "webchat",
      statement: "There's a chat widget live on your site, so a visitor with one small question has a light way to ask it.",
    });
  }
  if (w && isPresent(w.hasContactForm) && w.formQualifyingFields === "PRESENT") {
    out.push({
      id: "form_qualifies",
      statement: "Your enquiry form asks more than a name and an email — it's already sorting the job before it reaches you.",
    });
  }
  if (data.gbp?.hoursListed && !data.gbp.limitedHours) {
    out.push({
      id: "open_hours",
      statement: "Your Google hours are filled in and they aren't office-hours-only, so the listing isn't turning evening searches away.",
    });
  }

  return out;
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

/** Convenience: run the whole engine from raw research.
 *
 *  MODE-BLIND SINCE 2026-08-01. The two runtime branches `mode` used to select —
 *  dropping interpretive fires pre-sale, and throwing when a pre-sale detection
 *  produced a disclosed leak — policed the free cold-audit generator, and were
 *  deleted with it: no pre-sale surface calls detectLeaks any more (the
 *  observed-facts row reads `toScrapeData` directly and composes no findings).
 *  Every remaining caller is post-intake, and detection now behaves for all
 *  input exactly as it always did for post-intake input. `mode` survives on the
 *  input type purely as the compile-time discriminant that keeps
 *  `intake?: never` enforceable for pre-sale reads of the adapter. */
export function detectLeaks(raw: RawResearch): {
  data: ScrapeData;
  fired: FiredLeak[];
  report: FiredLeak[];
  outOfScope: FiredLeak[];
  /** Top-3 most-provable selection (selectColdAudit). The free cold audit it was
   *  built for is deleted; the field survives because the paid pack's
   *  LeakContext (asset-generation.ts) declares it and the paid generation
   *  route threads it through — both out of scope to change. */
  coldAudit: FiredLeak[];
  /** Interpretive fires — advisory-only, paid pack only. */
  advisoryOnly: FiredLeak[];
  /** The checks that ran and came back clean, print-ready. Stated alongside the
   *  findings, and the substance of the document when nothing fired. */
  cleanChecks: CleanCheck[];
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
    advisoryOnly: advisoryOnlyLeaks(fired),
    cleanChecks: cleanChecks(data),
    grades: gradeAreas(fired),
  };
}
