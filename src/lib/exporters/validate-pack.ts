// Mechanical validator for the 10 deliverable laws.
//
// Turns the structurally-checkable parts of the "ReclaimedHQ Deliverable
// Generation System Prompt (v2)" laws into assertions against an AssetPack, so
// "does this pack satisfy the laws" becomes a testable property instead of a
// manual eyeball check. Laws that need human/LLM judgement (real-data grounding,
// gut-punch quality, full voice) are covered with best-effort heuristics and
// flagged as warnings rather than hard fails.
//
// Used by scripts/gen-check.ts (CLI) and safe to call anywhere — pure, no I/O.

import type {
  AssetPack,
  EvidenceGrade,
  GovernanceBoundary,
  LeakAnalysisItem,
  PackCheckLevel,
  PackGovernance,
  PackValidationCheck,
} from "@/types";
import { PRODUCT_NAME, AGENCY_NAME } from "../brand";
import {
  hasInventedOffer,
  flatAssertionLint,
  carriesProvenanceMarker,
  attributesToClient,
  carriesStatCitation,
  fabricationLint,
  neverObservedReason,
  DISCLOSURE_MARKERS,
  ASSUMPTION_CAVEAT,
  PERCENT_FIGURE,
  type EvidenceBinding,
  type FabricationHit,
} from "../leak-narrative";
// THE ONE PIPELINE DEFINITION (E2). The six CRM stages we configure in the
// client's GoHighLevel sub-account are DATA now, in the same file as the 14
// workflows, so the validator checks a pack against the same list the deliverables
// render from. Aliased on import for one reason: `src/lib/stages.ts` also exports
// a `PIPELINE_STAGES`, and that one is ReclaimedHQ's OWN internal deal board.
// Two different things with one name is exactly how they got confused before.
import { PIPELINE_STAGES as CLIENT_CRM_PIPELINE_STAGES } from "../workflow-catalogue";

/** Aliases of the canonical declarations in src/types. They live there because a
 *  check has to be PERSISTED (in a pack's governance block and in the
 *  GeneratedSystem.overriddenChecks column), and a stored shape belongs with the
 *  other stored shapes. Aliasing rather than re-declaring means the wire format,
 *  the DB row and the live validator are the same type by construction. */
export type CheckLevel = PackCheckLevel;
export type LawCheck = PackValidationCheck;

/** Public alias. Callers outside this module (API routes, the enforcing
 *  `assertPackValid` entry point) talk about "validation checks", not "law
 *  checks" — the shape is identical, the name just reads better at the boundary. */
export type ValidationCheck = LawCheck;

// ── Stable check identity ─────────────────────────────────────────────────────
// The override handshake (see `evaluateOverride`) only honours a waiver when the
// caller echoes back the exact checks that failed. That needs a NAME for a check
// which is (a) byte-identical every time the same violation is produced, and
// (b) different the instant anything about the violation changes.
//
// Content-addressing gives both for free: the id is a hash of the law plus its
// message. Re-validating the same pack yields the same ids; a different pack —
// or the same law firing on different text — yields different ones. That is
// precisely what stops an acknowledgement collected at 11:02pm from authorising
// a DIFFERENT failure at 11:07pm.
//
// The readable law slug is kept as a prefix so a bare id in a server log or a DB
// row can be recognised without looking it up, and so a hash collision would
// additionally have to happen within the same law to matter.

function fnv1a32(input: string): number {
  // FNV-1a. Math.imul keeps the multiply in 32-bit integer space; a plain `*`
  // overflows past 2^53 and starts rounding, which would make the "same input →
  // same id" promise quietly false.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function lawSlug(law: string): string {
  return (
    law
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "check"
  );
}

/** Stable identifier for one check. Pure and deterministic — the server derives
 *  it, sends it, and re-derives it on the next request to compare. */
export function checkId(law: string, message: string): string {
  // Whitespace is normalised first so a re-wrapped or re-indented message is
  // still the SAME check: the id must track the claim, not the line breaks.
  const normalized = `${law.trim()}\u0000${message.replace(/\s+/g, " ").trim()}`;
  return `${lawSlug(law)}.${fnv1a32(normalized).toString(36)}`;
}

export interface ValidationResult {
  checks: LawCheck[];
  fails: number;
  warns: number;
  passed: boolean; // true when there are zero fails
}

// ── text helpers ──────────────────────────────────────────────────────────────

// Deep-walk every string value in an object graph (for keyword scans).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

// Find which of `needles` appear (word-boundary) anywhere in `haystack`.
function hits(haystack: string, needles: string[]): string[] {
  const lc = haystack.toLowerCase();
  return needles.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lc));
}

// Lead-gen language that violates the conversion-only scope (Law 2). The only
// allowed lead-adjacent topic is review-REQUEST automation (post-sale trust), so
// "review" / "referral" wording inside supporting assets is tolerated separately.
const LEADGEN_TERMS = [
  "seo",
  "paid ads",
  "google ads",
  "facebook ads",
  "ad campaign",
  "ad spend",
  "ppc",
  "social media marketing",
  "content marketing",
  "blog posts",
  "lead generation",
  "lead gen",
  "more traffic",
  "drive traffic",
  "buy traffic",
  "cold outreach",
  "cold email",
  // Retargeting-pixel vocabulary (owner-approved, 2026-08-01). The third
  // fabrication round shipped "Missing ad retargeting pixels" as a finding —
  // retargeting is AD infrastructure, which is traffic work, and it slipped the
  // conversion-only law because none of the terms above name it. `hits()` builds
  // word-boundary regexes from these, so "retargeting" alone also catches
  // "retargeting pixel(s)"; the ad-pixel pair needs both singular and plural
  // because the boundary after "pixel" does not match inside "pixels".
  "retargeting",
  "retargeting pixel",
  "retargeting pixels",
  "ad pixel",
  "ad pixels",
];

// Tautology / filler that Law 7 bans.
const FILLER_TERMS = [
  "leverage synergies",
  "in order to",
  "at the end of the day",
  "best practices",
  "world-class",
  "cutting-edge",
  "game-changer",
  "game changer",
  "move the needle",
  "low-hanging fruit",
  "circle back",
  "synergy",
];

// Hedge words — fine in moderation on projected outcomes, but a high density
// across the whole pack signals the "hedge-soup" Law 10 warns against.
const HEDGE_TERMS = ["may", "might", "could", "potentially", "possibly", "likely", "perhaps", "designed to"];

// Part B3 · out-of-scope recommendations. Site speed, redesign, and SEO are NOT
// part of a conversion engagement. Measured performance numbers may be shown as
// context, but the pack must NEVER prescribe a technical/SEO/redesign fix. These
// are recommendation-shaped phrases (verbs + targets), chosen to catch the PSI
// "top fixes" (reduce CSS, optimize images…) and redesign/SEO pitches without
// tripping on the measured-metric labels (Perf score, LCP, CLS).
const OUT_OF_SCOPE_RECO_TERMS = [
  "reduce css",
  "unused css",
  "minify",
  "compress images",
  "compress your images",
  "optimize images",
  "optimise images",
  "optimize your images",
  "image optimization",
  "next-gen format",
  "webp",
  "lazy load",
  "lazy-load",
  "defer offscreen",
  "render-blocking",
  "reduce javascript",
  "reduce server response",
  "improve page speed",
  "improve site speed",
  "improve your page speed",
  "speed up your site",
  "speed up the site",
  "faster load time",
  "redesign your site",
  "redesign your website",
  "redesign the site",
  "rebuild your site",
  "rebuild the site",
  "site redesign",
  "website redesign",
  "improve your seo",
  "seo optimization",
  // SEO-specific "rank higher" phrasings only — a bare "rank higher" also matches
  // legitimate lead-qualification scoring ("emergency issues rank higher in score"),
  // which is in-scope. Anchor to search context to avoid that false positive.
  "rank higher in search",
  "rank higher on google",
  "rank higher in google",
  "rank higher in search results",
  "search ranking",
  "keyword ranking",
  // ── E3 · we do not build websites ────────────────────────────────────────────
  // Site findings are ADVISORY ONLY. The one page ReclaimedHQ actually BUILDS is
  // the booking page inside GoHighLevel — so "build/rebuild the site" and
  // "landing page build" are promises of work that is not in the offer. Phrased
  // as verb+target so observational copy ("your landing page buries the CTA")
  // and the GHL booking-page copy assets never trip it.
  "website rebuild",
  "site rebuild",
  "rebuild your website",
  "rebuild the website",
  "redesign the website",
  "landing page build",
  "landing page rebuild",
  "build a landing page",
  "build you a landing page",
  "build your landing page",
  "build a new site",
  "build a new website",
  "build you a website",
  "build you a new site",
  "new website build",
];

// ── E3 · WEBSITE WORK IN D2/D3, THE DOCUMENTS THAT PROMISE ────────────────────
// The list above is a whole-pack ban on a handful of exact phrases. This is the
// narrower, sharper rule for the two documents where the words are a PROMISE
// rather than an observation:
//   D2 (Client Acquisition Infrastructure) says what gets BUILT.
//   D3 (Conversion Asset Pack) is the copy that GOES LIVE.
// ReclaimedHQ does not build or redesign websites. Findings about the client's
// own site are advisory and belong in D1, phrased as recommendations they hand to
// whoever runs the site. A "redesign" or "site rebuild" sentence inside D2 or D3
// reads as work included in the CAD $6,500 — work nobody is going to do.
//
// Written as anchored verb+target regexes, NOT bare words, because three things
// must keep passing:
//   · the booking page we DO build ("build your booking page inside GoHighLevel"),
//   · the GHL lead-capture form we DO rebuild ("we rebuild the form around the
//     qualification questions") — a form is not a site,
//   · advisory notes that MENTION their website ("hand these to whoever maintains
//     the website; the page we build and host is the booking page").
const WEBSITE_WORK_PATTERNS: { label: string; re: RegExp }[] = [
  // Any form of "redesign" inside D2/D3 is design work being offered.
  { label: "redesign", re: /\bre-?design(?:s|ed|ing)?\b/i },
  {
    label: "rebuild/revamp their site",
    re: /\b(?:re-?build|revamp|overhaul|relaunch)\w*\s+(?:your|the|their|a|an)?\s*(?:existing\s+)?(?:web\s?site|site|home\s?page|web\s?page)\b/i,
  },
  {
    label: "build them a site/page",
    re: /\bbuild(?:ing)?\s+(?:you\s+)?(?:a|your|the|their)\s+(?:new\s+)?(?:web\s?site|site|home\s?page|web\s?page|landing page)\b/i,
  },
  { label: "web/site design", re: /\b(?:web|web\s?site|site|page)\s+(?:design|redesign)\b/i },
  { label: "web development", re: /\b(?:web|web\s?site)\s+(?:development|dev)\b/i },
  { label: "a new website", re: /\bnew\s+web\s?site\b/i },
  {
    label: "site refresh/build",
    re: /\b(?:web\s?site|site)\s+(?:refresh|overhaul|revamp|makeover|rebuild|build)\b/i,
  },
];

// ── E3 · THE RETAINER IS NOT THE BUILD ───────────────────────────────────────
// The offer has two prices and they buy different things:
//   CAD $6,500 one-time — the four deliverables and the GoHighLevel build.
//   CAD $1,000/month    — the qualification engine, us running and tuning it, and
//                         the monthly report.
// A pack that lists lead qualification / lead scoring among the one-time build's
// inclusions has MISPRICED THE OFFER IN WRITING: the client has a document saying
// they already bought the thing the retainer is for, and the first invoice becomes
// an argument. This is the vocabulary that decides whether a sentence is talking
// about the qualification layer, the one-time build, or the retainer.
//
// PRODUCT_NAME is interpolated rather than hard-coded so renaming the product in
// the environment does not silently switch this rule off.
const QUALIFICATION_LAYER = new RegExp(
  `\\b${PRODUCT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b` +
    "|\\blead[- ]qualification\\b|\\bqualif\\w*\\s+(?:engine|layer|front[- ]end|system|threshold\\w*)\\b" +
    "|\\blead[- ]scoring\\b|\\bscoring\\s+(?:engine|threshold\\w*|model|rubric)\\b",
  "i"
);

// "This is in the one-time build." Deliberately explicit phrases only — the word
// "build" on its own describes the thing we install and appears everywhere.
const ONE_TIME_BUILD =
  /\bone[- ]?time\b|\bone[- ]off\b|\bup[- ]?front fee\b|\bsetup fee\b|\bset-up fee\b|\bbuild fee\b|\$\s?6[,.]?500\b|\bincluded in the (?:build|setup|set-up|one-time|package)\b|\bpart of the (?:build|setup|set-up|one-time|package)\b/i;

// "…and this is the monthly retainer." Presence of any of these in the SAME
// sentence (or the same roadmap line) is the licence: the sentence has already
// told the reader which side of the offer the qualification layer sits on.
const RETAINER_MARKER =
  /\bretainer\b|\bmonthly\b|\bevery month\b|\beach month\b|\bper month\b|\/mo\b|\bmonth[- ]to[- ]month\b|\bongoing\b|\$\s?1[,.]?000\b/i;

// ── E3 · THE NURTURE SEQUENCE IS 60 DAYS ─────────────────────────────────────
// Workflow 8 (Lead Nurture — No Booking) runs for 60 days and then closes the
// deal out to Lost; the Lost stage in the canonical pipeline says so in as many
// words. A 7-day sequence is a different product: it abandons every lead who was
// simply going to take longer than a week to decide, which in home services and
// dental is most of them.
const NURTURE_SPAN_DAYS = 60;
const SHORT_NURTURE_CLAIM: RegExp[] = [
  /\b(?:7|seven)[-\s]day\b[^.!?]{0,40}\b(?:nurture|follow[- ]up|sequence|campaign)\b/i,
  /\b(?:nurture|follow[- ]up)\s+(?:sequence|campaign)\b[^.!?]{0,40}\b(?:7|seven)\s*days?\b/i,
  /\bover\s+(?:7|seven)\s+days\b/i,
];

// ── E3 · EVERY D3 ASSET NAMES ITS SURFACE ────────────────────────────────────
// D3 is the copy that goes live. Copy with no stated destination is copy nobody
// can install: the operator gets a page of words and has to guess whether they go
// on the booking page, in the form, in an email, or in a text. These are the
// surfaces this build actually has — the ban on website work above is the other
// half of the same rule, so a D3 asset can only ever point at something we own.
const D3_SURFACES: { label: string; re: RegExp }[] = [
  { label: "the booking page / calendar", re: /\bbooking (?:page|calendar|link|form)\b/i },
  { label: "GoHighLevel", re: /\bgo\s?high\s?level\b|\bGHL\b/i },
  {
    label: "the lead-capture form",
    re: /\b(?:lead[- ]capture|intake|enquiry|inquiry|contact|quote|request) form\b|\bform on (?:your|the) (?:site|website|page)\b/i,
  },
  { label: "the webchat widget", re: /\bweb\s?chat\b|\bchat widget\b|\blive chat\b/i },
  { label: "text / SMS", re: /\b(?:text|SMS|MMS)\s?(?:message|back)?\b/i },
  {
    label: "an email",
    re: /\b(?:confirmation|reminder|follow[- ]up|nurture|thank[- ]you|recovery|welcome) email\b|\bemail (?:sequence|nurture|goes out|is sent)\b|\bsubject line\b/i,
  },
  { label: "the thank-you page", re: /\bthank[- ]you page\b/i },
  { label: "the review request", re: /\breview request\b/i },
  { label: "the tracked number / voicemail", re: /\bvoicemail\b|\btracked number\b|\bmissed[- ]call\b/i },
];

// Forward-compatible escape hatch for the same rule. If a pack ever carries an
// EXPLICIT placement field on an asset — the right long-term fix, and the one
// `whereToUse` on a CTA already models — that field satisfies the check on its
// own, with no prose scan. Matched by KEY so a field added later works the day it
// lands, without this file changing.
const EXPLICIT_SURFACE_KEYS = new Set([
  "surface",
  "surfaces",
  "where",
  "whereitgoes",
  "wheretouse",
  "wheretoplaceit",
  "placement",
  "goesto",
  "installedon",
  "liveson",
  "destination",
]);

// ── E3 · hype / promise vocabulary the repo did NOT previously ban ────────────
// leak-narrative's BANNED_WORDS covers the marketing-verb family ("unlock",
// "supercharge", "10x"); none of these four were in ANY banned list, so a pack
// could ship "guaranteed", "skyrocket", "the secret to…" or "a quick hack"
// untouched. They are banned because each one makes a promise the deliverable
// cannot keep — the exact failure the honesty pass exists to remove.
//
// Matched at SENTENCE level (not on the whole blob) so the negation exemption
// below can look at the words actually surrounding the hit.
const HYPE_BAN_PATTERNS: { term: string; re: RegExp }[] = [
  { term: "guaranteed", re: /\bguarantee(?:d|s|ing)?\b/i },
  { term: "skyrocket", re: /\bskyrocket(?:s|ed|ing)?\b/i },
  { term: "secret", re: /\bsecrets?\b/i },
  // \bhacks?\b does NOT match "hacker"/"hacking" (the \b needs a non-word char
  // right after "hack"), so this only catches the "growth hack" sense.
  { term: "hack", re: /\bhacks?\b/i },
];

// The ONE legitimate use of the guarantee family is denying one — RULES.math
// requires exactly that ("NEVER present a projection as a guarantee", 32 chars
// between the negator and the noun). A negator within 40 characters of the word,
// with no sentence break between them, licenses it; a bare promise still fails.
// Deliberately narrow: only "guarantee" gets this exemption, because there is no
// honest sentence in a deliverable that needs "skyrocket", "secret" or "hack".
const GUARANTEE_NEGATED = /\b(?:no|not|never|non|without|isn't|aren't|can't|cannot)\b[^.!?]{0,40}\bguarantee/i;

// ── E3 · all-caps promises ────────────────────────────────────────────────────
// A run of SHOUTED words is a promise dressed as emphasis ("RESULTS GUARANTEED",
// "MORE LEADS FAST"). Legitimate all-caps in this pack is always a single
// acronym, so the rule is: 2+ consecutive all-caps words where at least one is
// not a known acronym. Single acronyms and acronym-only runs ("CRM SMS") pass.
const CAPS_RUN = /\b[A-Z]{2,}(?:['’]?[A-Z]*)?(?:[ \t]+[A-Z]{2,}(?:['’]?[A-Z]*)?)+\b/g;

// Operator-editable placeholders are written in shouting brackets ON PURPOSE —
// that is how they stay visible until someone fills them in (OFFER_PLACEHOLDER,
// "[YOUR OFFER — e.g. $X off first service]", is mandated by Defect 5). They are
// not promises to a reader, so they are removed before the caps scan rather than
// enumerated as acronyms.
const BRACKETED_PLACEHOLDER = /\[[^\]]*\]/g;
const ALLOWED_ACRONYMS = new Set([
  "CRM", "GHL", "SMS", "MMS", "CTA", "CTAS", "KPI", "KPIS", "ROI", "FAQ", "FAQS",
  "LCP", "CLS", "INP", "FCP", "TTFB", "PSI", "SEO", "PPC", "CPL", "CPA",
  "CAD", "USD", "AI", "API", "URL", "URLS", "GBP", "DFY", "NPS", "SLA", "ETA",
  "PDF", "HTML", "CSV", "ZIP", "UTM", "US", "CA", "UK", "TCPA", "CASL", "GDPR",
  "AM", "PM", "OK", "ID", "IDS", "TV", "VIP", "DIY", "B2B", "B2C", "QR",
  // Evidence-tier tokens are rendered upper-case by design.
  "OBSERVED", "EVIDENCED", "BENCHMARK", "INVISIBLE", "REAL",
]);

// ── E3 · assumption / benchmark labelling on dollar sentences ─────────────────
// A dollar figure whose backing is an ASSUMPTION or an industry benchmark must
// say so in the SAME sentence as the number (leak-taxonomy.ts SECTION 4b, and
// RULES.math: "ANY factor drawn from ASSUMPTIONS must be labelled … in the SAME
// SENTENCE as the number"). These are the labels the deterministic math frames
// actually emit — assert on the real wording, not on a wish.
const ASSUMPTION_LABELS: RegExp[] = [
  new RegExp(ASSUMPTION_CAVEAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  /\bassum\w*/i, // assuming / assumption / assumed
  /\bestimat\w*/i, // estimate / estimated / Estimated.
  /\bbenchmark\w*/i,
  /\bindustry (?:average|standard|pattern|rate|figure)/i,
  /\btypical\w*/i,
  /\bconservativ\w*/i,
  /\bproject(?:ed|ion)\b/i,
  /\bapprox\w*|≈|~/i,
  /\breplacement cost\b/i,
  /\breal numbers\b/i,
];

// A dollar figure sourced from the CLIENT needs no assumption label — it is not
// an assumption. These are the markers the REAL-mode math frames emit.
// ONE source of truth for "this came from the client", imported rather than
// re-declared. This used to be a second, separately-maintained copy that disagreed
// with leak-narrative's list in both directions — so a phrase could attribute a
// SENTENCE without attributing a FIGURE, or the reverse. Same question, same list.
const CLIENT_SOURCED_LABELS = DISCLOSURE_MARKERS;

// "CAD $1,290", "$1,290", "$1,290.50" — the shapes cad() and the model produce.
const DOLLAR_FIGURE = /(?:CAD\s*)?\$\s?\d[\d,]*(?:\.\d{1,2})?/;

// Split prose into sentences the same way flatAssertionLint does, so "the same
// sentence as the number" means the same thing in both guards.
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// The rendered PROSE fields of a leak — the ones a model authors. Deterministic
// stamped fields (mathFrame, kickoffLine, allowedStats) are excluded: they are
// generated by leak-narrative.ts and are correct by construction, so linting
// them would only produce noise about our own fixed wording.
function leakProse(l: LeakAnalysisItem): string[] {
  return [l.evidence, l.explanation, l.businessImpact, l.recommendedFix, l.industryPattern]
    .filter((s): s is string => Boolean(s?.trim()));
}

// Deep-walk an object graph collecting only the string values sitting under a key
// in `keys`. Used by the D3 surface check to honour an explicit placement field
// wherever it appears in the tree.
function valuesUnderKeys(value: unknown, keys: Set<string>, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) valuesUnderKeys(v, keys, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && keys.has(k.toLowerCase().replace(/[^a-z]/g, ""))) {
        if (v.trim()) out.push(v);
      } else {
        valuesUnderKeys(v, keys, out);
      }
    }
  }
  return out;
}

// Stage names are compared on their WORDS, not their punctuation: "New Lead",
// "new lead" and "New  Lead" are the same column, "Lost or Nurture" is not "Lost".
function normalizeStage(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// `framing` is the 4-section wrapper (overview / implementation guide / expected
// impact) that D4's fallback renders — it is NOT part of the asset, and D3 never
// prints it. It is dropped before the D3 surface scan for one reason: a surface
// named only in the wrapper is a surface the reader of D3 never sees, and letting
// it satisfy the check would make the check pass on documents that still leave
// the operator guessing. (Bans keep scanning it; a ban that over-reaches is safe,
// a REQUIREMENT that over-reaches is just vacuous.)
function withoutFraming(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { framing: _framing, ...rest } = value as Record<string, unknown>;
  return rest;
}

// ── E1 · THE ROADMAP SHAPE D4 NOW SELLS ──────────────────────────────────────
// The old check asserted "3 phases" and named them in its failure message
// (Setup · Stabilize · Ongoing Optimization) without ever checking the names, so
// the only thing it really enforced was the count. D4 is now the schedule of the
// actual engagement — two weeks of build, a go-live, then the retainer running to
// day 90 — and the point of the check is unchanged: the roadmap must match what
// was sold. So the new shape is encoded properly, window by window, in order.
//
// WHY BOTH "Days 1–14" AND "Weeks 1–2" PASS THE FIRST WINDOW: they denote the
// identical fortnight. Rejecting one spelling of the same promise would be
// pedantry that blocks a correct roadmap at 11pm. Anything that is NOT that
// fortnight — "Week 1", "Month 1", "Days 1–30" — is a different promise and fails.
const ROADMAP_SHAPE: {
  name: string;
  window: string;
  match: RegExp;
  isRetainerPhase: boolean;
}[] = [
  {
    name: "Build",
    window: "Days 1–14",
    match:
      /\bdays?\s*1\s*(?:–|—|-|to|through)\s*14\b|\bweeks?\s*1\s*(?:–|—|-|to|through)\s*2\b|\bfirst\s+(?:two weeks|14 days|fortnight)\b/i,
    isRetainerPhase: false,
  },
  {
    name: "Go-live",
    window: "go-live",
    match: /\bgo[-\s]?live\b|\blaunch(?:es|ed|ing)?\b|\bswitch[-\s]?on\b/i,
    isRetainerPhase: false,
  },
  {
    name: "Ongoing",
    window: "Days 15–90",
    match: /\bdays?\s*15\s*(?:–|—|-|to|through)\s*90\b|\bday\s*15\b[^.!?]{0,24}\bday\s*90\b/i,
    isRetainerPhase: true,
  },
];

// ── The evidence grade, as the validator reads it (Phase 1) ───────────────────
// Measured / told / guessed — the coarse honesty gate that decides how flatly a
// leak may be written. It is DERIVED at detection (gradeOf) and STAMPED onto the
// leak at generation; the validator only reads it back.
//
// A MISSING GRADE IS "inferred", with no fallback to the tier. That is the strict
// reading on purpose. This function feeds the two FATAL grade checks, and a gate
// must under-claim: an unstamped leak (every pack written before Phase 1) is a
// leak whose provenance nobody recorded, and "nobody recorded it" must never be
// the reason a sentence is allowed to read like a measured fact. The render-time
// softener in deliverables.ts deliberately does the opposite for legacy packs —
// it still honours their {tier, intakeConfirmed} pair — because it is a backstop
// on an already-shipped document, not the gate. Stricter here, kinder there.
function gradeOfLeak(l: LeakAnalysisItem): EvidenceGrade {
  return l.evidenceGrade ?? "inferred";
}

/* ============================================================================
 * THE FABRICATION GATE — read the binding off a saved artifact
 * ==========================================================================*/
//
// A fabricated MEASUREMENT is strictly worse than a hype word, so it blocks
// wherever a hype word blocks: generation, save and export, on both the paid pack
// and the free cold audit. The rule itself lives in `fabricationLint`
// (leak-narrative.ts) with the reasoning behind the detection strategy; this file
// only decides WHERE each tier of failure is fatal, and says which line to edit.
//
// WHY THE BINDING IS READ STRUCTURALLY RATHER THAN OFF A TYPED FIELD.
// `LeakAnalysisItem.binding` and `ColdAuditFinding.binding` are the right home for
// it and the exact edits are in this session's handoff — src/types/index.ts has
// another owner. Reading it structurally means this gate works on the day it is
// written, on every artifact that already carries a binding, and gets stronger for
// free when the field lands. It also has to tolerate a saved row from before the
// field existed, which is the same problem, so there is one code path for both.
//
// THE TIERS ARE NOT EQUALLY FATAL, AND THAT IS THE ESCAPE HATCH SHIPPED WITH THE
// GATE (feedback: never ship a block that can strand him at 11pm):
//
//   · unmeasurable → FATAL ALWAYS. Position, prominence, CTA quality. No field in
//     the contract can license one, so whether a binding exists changes nothing
//     about the verdict. This is the tier that catches the sentence that shipped,
//     and it needs no plumbing anywhere else to do it.
//   · internal → FATAL ALWAYS, for the same reason from the other direction: no
//     scan reaches the inside of an operation, so a claim about what happens to an
//     after-hours caller is licensed only by the client saying so in the sentence.
//   · unbound / unscoped / number → FATAL when the artifact CARRIES a binding
//     (then the claim is checked against the values it was actually written from),
//     WARNING when it does not (an un-upgraded or legacy row: the right answer is
//     "regenerate so the binding is stamped", not "block the document").
//   · disputed → WARNING, always. The two contracts disagree about whether one
//     field may be cited; that is a decision to make, not a defect to block on.

/** Every string field of a saved leak a MODEL wrote.
 *
 *  Narrower than `leakProse` on purpose: `industryPattern` is excluded because it
 *  is not model prose at all — it is `allowedStats.join(" ")`, stamped by
 *  leak-narrative and already carrying its own citations. Linting our own fixed
 *  wording produces noise about strings the model never touched. */
function modelAuthoredLeakProse(l: LeakAnalysisItem): { where: string; text: string }[] {
  const at = l.leakName ?? l.area;
  return (
    [
      ["evidence", l.evidence],
      ["explanation", l.explanation],
      ["what it's costing", l.businessImpact],
      ["recommended fix", l.recommendedFix],
    ] as [string, string | undefined][]
  )
    .filter((e): e is [string, string] => Boolean(e[1]?.trim()))
    .map(([field, text]) => ({ where: `${at} (${field})`, text }));
}

/** The evidence binding stamped on a saved leak or finding, or null.
 *
 *  Structural and defensive: it validates the shape it finds rather than trusting
 *  it, because a binding is only worth reading if it really is one. A malformed
 *  binding reads as ABSENT, which routes to the warning tier — the same place a
 *  missing one goes. */
function bindingOn(carrier: unknown): EvidenceBinding | null {
  const raw = (carrier as { binding?: unknown } | null | undefined)?.binding;
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<EvidenceBinding>;
  if (typeof b.leakId !== "string" || !Array.isArray(b.values)) return null;
  return {
    leakId: b.leakId,
    checkability: b.checkability === "INTERPRETIVE" ? "INTERPRETIVE" : "HARD",
    neverObserved: typeof b.neverObserved === "string" ? b.neverObserved : null,
    values: b.values.filter(
      (v): v is EvidenceBinding["values"][number] =>
        Boolean(v) && typeof v === "object" && typeof (v as { field?: unknown }).field === "string"
    ),
    disputedTopics: Array.isArray(b.disputedTopics) ? b.disputedTopics : [],
    numbers: Array.isArray(b.numbers) ? b.numbers.filter((n) => typeof n === "number") : [],
  };
}

/** One line of a failure message: where to go, and the sentence to edit. */
function quoteHit(where: string, h: FabricationHit): string {
  return `${where}: "${snip(h.sentence, 100)}" — ${h.why}`;
}

/** Run the lint over a set of labelled passages that share one binding. */
function fabricationHits(
  passages: { where: string; text: string }[],
  binding: EvidenceBinding | null,
  allowedStatNumbers?: number[]
): { where: string; hit: FabricationHit }[] {
  return passages.flatMap(({ where, text }) => {
    const r = fabricationLint(text, binding, { allowedStatNumbers });
    // `disputed` is appended here rather than inside `hits` because the lint keeps
    // "must be fixed" and "must be decided" apart; the callers below sort them
    // back out by `kind`.
    return [...r.hits, ...r.disputed].map((hit) => ({ where, hit }));
  });
}

/** A percentage stated with no source and no hedge (owner item 5).
 *
 *  The dollar rule (E3) has always been "say in the SAME SENTENCE where the number
 *  came from". A percentage is the same kind of claim and had no rule at all,
 *  which is how "85% of callers who reach voicemail never call back" shipped
 *  asserted flat inside a finding whose own grade label said it was not measured
 *  for this business. Three ways to be legitimate, and they are the ones the
 *  existing machinery already emits: CITED (an inline source tag, the same one
 *  `allowedStatPhrase` stamps), HEDGED (an ASSUMPTION_LABELS phrase — "typically",
 *  "industry average", the ASSUMPTIONS caveat), or ABSENT. */
function unlabelledPercentSentences(
  passages: { where: string; text: string }[]
): { where: string; sentence: string }[] {
  const out: { where: string; sentence: string }[] = [];
  for (const { where, text } of passages) {
    for (const sentence of sentencesOf(text)) {
      if (!PERCENT_FIGURE.test(sentence)) continue;
      if (carriesStatCitation(sentence)) continue;
      if (ASSUMPTION_LABELS.some((re) => re.test(sentence))) continue;
      out.push({ where, sentence });
    }
  }
  return out;
}

// ── the validator ─────────────────────────────────────────────────────────────

export function validatePack(
  pack: AssetPack,
  allowedNumbers?: number[]
): ValidationResult {
  const checks: LawCheck[] = [];
  const add = (law: string, level: CheckLevel, message: string) =>
    checks.push({ id: checkId(law, message), law, level, message });

  const intel = pack.intelligence;
  const infra = pack.infrastructure;
  const roadmap = pack.roadmap;

  // The governance block is OUR record, never client copy — and it carries the
  // operator's free-text override reason. Scanning it would be self-poisoning: a
  // reason like "the SEO check false-positived" would itself trip Law 2 on the
  // very next run, so one override would make the pack permanently unshippable
  // and un-overridable at the same time. Strip it before ANY string walk.
  const { governance: _governance, ...scannable } = pack;
  const packText = collectStrings(scannable);
  const allText = packText.join("\n");

  // ── Structure (is this a v2 pack at all?) ────────────────────────────────────
  if (!intel) add("Structure", "fail", "Missing `intelligence` — this is a pre-v2 (stale) pack. Regenerate.");
  if (!infra) add("Structure", "fail", "Missing `infrastructure` — pre-v2 (stale) pack. Regenerate.");

  const metrics = intel?.scorecard?.metrics ?? [];
  if (intel) {
    if (metrics.length !== 9)
      add("Structure", metrics.length ? "warn" : "fail", `Scorecard has ${metrics.length} metrics, expected 9 conversion axes.`);
    if (!intel.leakAnalysis?.length)
      add("Structure", "fail", "No leakAnalysis items.");
  }

  // ── Structure · the conversion FUNNEL (six stages) ───────────────────────────
  // READ THE NEXT SENTENCE BEFORE CHANGING THIS CHECK. These six are the
  // CONVERSION PATH we describe in D2 — Capture, Qualify, Speed-to-Lead, Nurture,
  // Book, Show-Up & No-Show Recovery. They are NOT the client's CRM pipeline,
  // which is also six long and is checked separately immediately below. Same
  // count, different thing: the funnel is how a lead moves through the SYSTEM, the
  // pipeline is the columns on their BOARD. Merging them breaks both documents.
  const stages = infra?.funnel?.stages ?? [];
  if (infra) {
    if (stages.length !== 6)
      add(
        "Structure · conversion funnel",
        stages.length ? "warn" : "fail",
        `The D2 conversion funnel has ${stages.length} stages, expected 6 (Capture · Qualify · Speed-to-Lead · Nurture · Book · Show-Up & No-Show Recovery). This is the conversion path, not the CRM pipeline — do not reconcile the two.`
      );
    else
      add("Structure · conversion funnel", "pass", "The D2 conversion funnel has its 6 conversion-path stages.");
  }

  // ── E2 · Structure · the client's CRM pipeline, against the ONE definition ────
  // The six columns we configure in the client's GoHighLevel sub-account. The list
  // lives in src/lib/workflow-catalogue.ts beside the 14 workflows, and this check
  // reads it from there rather than restating it, so the pipeline the deliverables
  // render and the pipeline the validator demands cannot drift apart again.
  //
  // Order matters as much as membership: a board whose columns are in the wrong
  // order is a board nobody can read left-to-right, and Lost must be last because
  // the 60-day nurture ends by moving the deal there.
  const crmStages = infra?.crmPipeline?.stages ?? [];
  if (infra && crmStages.length) {
    const actual = crmStages.map((s) => (s.stage ?? "").trim());
    const expected = Array.from(CLIENT_CRM_PIPELINE_STAGES);
    const matches =
      actual.length === expected.length &&
      actual.every((s, i) => normalizeStage(s) === normalizeStage(expected[i]));
    if (!matches)
      add(
        "Structure · CRM pipeline",
        "fail",
        `The CRM pipeline in D2 reads "${actual.join(" → ") || "(empty)"}" — it must be exactly "${expected.join(
          " → "
        )}", in that order. This is the pipeline we build in their GoHighLevel sub-account and it is defined once, in src/lib/workflow-catalogue.ts (PIPELINE_STAGES). Regenerate the Blueprint against that list; do not rename a column to make this pass.`
      );
    else
      add(
        "Structure · CRM pipeline",
        "pass",
        `The CRM pipeline matches the canonical six: ${expected.join(" → ")}.`
      );
  }

  // ── E1 · the roadmap shape check — RETIRED (Phase 5, 2026-08-06) ───────────
  // It checked that a MODEL-AUTHORED phase list matched the engagement: Build
  // (Days 1–14) → go-live → Ongoing (Days 15–90), with the retainer flag on the
  // last phase only. That check existed because the schedule was generated and
  // could therefore be wrong.
  //
  // The schedule is no longer generated. src/lib/build-plan.ts derives all four
  // windows from one kickoff date and a fixed BUILD_DAYS, so the shape cannot
  // drift and there is nothing left to validate — a check over a constant is a
  // check that can only ever pass. What replaced it: verify-build-plan section C
  // asserts the windows directly, including the unbooked case.
  //
  // `pack.roadmap` survives as an OPTIONAL field for packs saved before this, and
  // nothing renders it (verify-phase3 G3 asserts it cannot reach a document).
  //
  // `phases` stays bound because three laws below still walk it — owner framing
  // (Law 3), retainer positioning (Law 4) and retainer misplacement (E3). On a
  // newly generated pack it is EMPTY, so those loops are no-ops; on a pack saved
  // before the retirement they still hold the roadmap to the same rules. That is
  // the point of keeping it: a legacy pack does not get a free pass.
  const phases = roadmap?.phases ?? [];

  // ── Law 2 · conversion-only scope ────────────────────────────────────────────
  // WIDENED (E3). This used to scan only infrastructure + roadmap + intelligence,
  // on the theory that the supporting review/thank-you assets were an exempt
  // "lead-adjacent" surface. That exemption leaked: file1..file5, supportingAssets
  // and the landing module are ALL client-facing (they render into D2 and D3), so
  // lead-gen language reached the buyer unchecked in exactly the documents that
  // pitch the engagement. Every surface in the pack is now scanned. The narrow
  // review-REQUEST carve-out survives on its own terms: LEADGEN_TERMS contains no
  // review/referral word, so post-sale review automation was never in scope here.
  const leakgen = hits(allText, LEADGEN_TERMS);
  if (leakgen.length)
    add("Law 2 · conversion-only", "fail", `Lead-gen language in client-facing copy: ${Array.from(new Set(leakgen)).join(", ")}.`);
  else add("Law 2 · conversion-only", "pass", "No lead-gen language anywhere in the pack.");

  // ── Law 2 (v3) · forbidden sections, by name ─────────────────────────────────
  // "Local Market Positioning Gap" and "Review Generation" sections are banned
  // outright (v3). The only allowed review touch is a single post-job review
  // request — so a populated localPositioningGap or a "review generation" heading
  // is a hard fail.
  const forbiddenSections: string[] = [];
  const lcAll = allText.toLowerCase();
  if (lcAll.includes("local market positioning gap")) forbiddenSections.push('"Local Market Positioning Gap" heading');
  if (lcAll.includes("review generation")) forbiddenSections.push('"Review Generation" heading');
  if (lcAll.includes("positioning gap")) forbiddenSections.push('"Positioning Gap" content');
  if (forbiddenSections.length)
    add("Law 2 · forbidden sections", "fail", `Banned section present: ${forbiddenSections.join("; ")}.`);
  else add("Law 2 · forbidden sections", "pass", "No banned (positioning-gap / review-generation) sections.");

  // ── Part B3 · no out-of-scope (speed / redesign / SEO) recommendations ────────
  // Measured PSI numbers are allowed; prescriptions are not.
  const outOfScopeRecos = hits(allText, OUT_OF_SCOPE_RECO_TERMS);
  if (outOfScopeRecos.length)
    add(
      "Part B · scope",
      "fail",
      `Out-of-scope recommendation(s) present (site speed / redesign / SEO are not in a conversion engagement): ${Array.from(
        new Set(outOfScopeRecos)
      ).join(", ")}. Keep measured data; drop the fix.`
    );
  else add("Part B · scope", "pass", "No site-speed / redesign / SEO recommendations.");

  // ── Part C2 · every BENCHMARK leak carries the kickoff-verification line ──────
  // A benchmark-tier leak isn't externally visible, so it must invite the client
  // to confirm it at kickoff. Signature: the "…comes off the list" tail of the
  // kickoff line survives minor wording drift.
  // Two disjoint groups of BENCHMARK leaks:
  //  · hedged (not confirmed at intake) → MUST carry the kickoff-verification line.
  //  · intake-confirmed → the client told us they lack the system, so it's stated
  //    as fact and MUST carry the confirmed framing INSTEAD of the kickoff line.
  const KICKOFF_SIGNATURE = /comes off the list|verify (this|it)(?: together)? at kickoff/i;
  const CONFIRMED_SIGNATURE = /confirmed at intake|you told us/i;
  const benchmarkLeaks = (intel?.leakAnalysis ?? []).filter(
    (l) => l.evidenceTier === "BENCHMARK"
  );
  const confirmedLeaks = benchmarkLeaks.filter((l) => l.intakeConfirmed);
  const hedgedLeaks = benchmarkLeaks.filter((l) => !l.intakeConfirmed);
  const missingKickoff = hedgedLeaks.filter(
    (l) => !KICKOFF_SIGNATURE.test(collectStrings(l).join("\n"))
  );
  const missingConfirmed = confirmedLeaks.filter(
    (l) => !CONFIRMED_SIGNATURE.test(collectStrings(l).join("\n"))
  );
  if (hedgedLeaks.length) {
    if (missingKickoff.length)
      add(
        "Part C · kickoff line",
        "fail",
        `${missingKickoff.length}/${hedgedLeaks.length} hedged BENCHMARK leak(s) miss the kickoff-verification line ("…comes off the list"): ${missingKickoff
          .map((l) => l.area)
          .join(", ")}.`
      );
    else add("Part C · kickoff line", "pass", "Every hedged BENCHMARK leak carries the kickoff-verification line.");
  }
  if (confirmedLeaks.length) {
    if (missingConfirmed.length)
      add(
        "Part C · intake-confirmed",
        "fail",
        `${missingConfirmed.length}/${confirmedLeaks.length} intake-confirmed leak(s) miss the confirmed framing ("Confirmed at intake" / "you told us"): ${missingConfirmed
          .map((l) => l.area)
          .join(", ")}.`
      );
    else add("Part C · intake-confirmed", "pass", "Every intake-confirmed leak carries the confirmed framing (no kickoff line).");
  }

  // ── Evidence grade · nothing INFERRED is ever written declaratively ──────────
  // FATAL. Retargeted from tier to GRADE (Phase 1). This check used to key on
  // `evidenceTier === "BENCHMARK"`; it now keys on the honesty gate itself, which
  // makes it both wider and safer:
  //   · WIDER — an EVIDENCED leak grades to "inferred" too, and its prose was
  //     never checked before. EVIDENCED means we inferred from a real signal (two
  //     reviews mentioning unreturned calls): the SIGNAL is observed, the
  //     CONCLUSION ("they miss calls") is not. Nobody measured their phone system,
  //     so that conclusion may not be stated flatly either.
  //   · SAFER — a leak with NO stamped grade (every pack written before Phase 1)
  //     counts as inferred, so a missing field can never license a flat assertion.
  // Observed and disclosed leaks are exempt BY GRADE: one we measured, the other
  // they told us. Hedging either is the insult this whole pass removes — and a
  // disclosed leak is not let off the hook, it is held to the attribution rule
  // immediately below instead.
  //
  // flatAssertionLint is the same deterministic guard the generator runs, so the
  // render boundary and the generation boundary can never disagree about what
  // counts as declarative.
  const gradedLeaks = intel?.leakAnalysis ?? [];
  const inferredLeaks = gradedLeaks.filter((l) => gradeOfLeak(l) === "inferred");
  if (inferredLeaks.length) {
    const declarative: string[] = [];
    for (const l of inferredLeaks) {
      for (const field of leakProse(l)) {
        // The grade IS the context — one source of truth, not the {tier,
        // intakeConfirmed} pair this used to reconstruct. Passing it explicitly
        // also documents the exemption that is NOT in play here.
        const lint = flatAssertionLint(field, { grade: "inferred" });
        if (!lint.ok)
          declarative.push(`${l.leakName ?? l.area}: "${lint.hits[0]}"`);
      }
    }
    if (declarative.length)
      add(
        "Evidence grade · no declarative inference",
        "fail",
        `${declarative.length} passage(s) on a leak we have neither measured nor been told about state an internal behaviour as flat fact: ${Array.from(
          new Set(declarative)
        )
          .slice(0, 3)
          .join(
            " | "
          )}. An inferred leak must read as pattern + visible absence + conditional ("typically…", "if that's how it works today"), or attribute the claim to its source.`
      );
    else
      add(
        "Evidence grade · no declarative inference",
        "pass",
        `All ${inferredLeaks.length} inferred leak(s) read as inference, not observation.`
      );
  }

  // ── Evidence grade · a DISCLOSURE is ATTRIBUTED ──────────────────────────────
  // FATAL, and it is the owner's own sentence made mechanical: "Never dress a
  // disclosure up as something we detected."
  //
  // A disclosed leak is a fact — the client told us at intake — so the check above
  // rightly lets it read declaratively. That exemption has a price: the sentence
  // has to say WHOSE fact it is. A disclosure written as our own finding ("we
  // found there's no follow-up sequence") hands the client their own answer back
  // as if we had discovered it, which is the single failure this grade exists to
  // prevent, and the one that makes a $6,500 report read like generic AI output.
  //
  // The attribution vocabulary is DISCLOSURE_MARKERS, via attributesToClient — a
  // STRICT SUBSET of the PROTECTED_MARKERS the softener consults, and the subset
  // is the point. PROTECTED_MARKERS also contains the MEASUREMENT vocabulary
  // ("we measured", "our scan observed"), because a sentence stating either
  // provenance may be written flatly. But measurement is not attribution: a
  // disclosed leak reading "our scan observed you have no CRM" states a
  // provenance AND commits precisely the offence described above. Checking the
  // combined list here would have let that through — the two lists are split in
  // leak-narrative.ts for exactly this reason, and share one definition each.
  const disclosedLeaks = gradedLeaks.filter((l) => gradeOfLeak(l) === "disclosed");
  if (disclosedLeaks.length) {
    const unattributed = disclosedLeaks.filter(
      (l) => !leakProse(l).some((field) => attributesToClient(field))
    );
    if (unattributed.length)
      add(
        "Evidence grade · disclosure is attributed",
        "fail",
        `${unattributed.length}/${disclosedLeaks.length} leak(s) the client TOLD us about are written without saying so: ${unattributed
          .map((l) => l.leakName ?? l.area)
          .slice(0, 3)
          .join(
            ", "
          )}. The finding is right — this is a WORDING fix, not a regeneration. Put the attribution in the prose ("You told us…", "Confirmed at intake…") so their own answer isn't handed back to them as our discovery.`
      );
    else
      add(
        "Evidence grade · disclosure is attributed",
        "pass",
        `All ${disclosedLeaks.length} client-disclosed leak(s) attribute themselves ("you told us" / "confirmed at intake").`
      );
  }

  // ── Part D1 · clean axes read neutral (no fabricated problem) ─────────────────
  // A scorecard axis with no fired leak grades to exactly 95 (gradeAreas special-
  // cases zero-leak areas). Its diagnosis must NOT assert a problem, gap, or loss —
  // that would be inventing a leak the taxonomy never fired (Part D).
  const PROBLEM_VOCAB =
    /\b(losing|lose|lost|bleed(?:ing)?|hemorrhag\w*|missing|missed|gap|weak(?:ness)?|leak(?:ing|s)?|broken|failing|fails|poor|hurting|costing|costs you|slipping|drop-?off|dropping|underperform\w*|deficien\w*|struggl\w*)\b/i;
  const cleanAxisViolations: string[] = [];
  for (const m of metrics) {
    if (m.score !== 95) continue; // only the deterministically-clean axes
    const diag = [m.diagnosis, m.cause, m.evidence].filter(Boolean).join(" ");
    if (PROBLEM_VOCAB.test(diag)) cleanAxisViolations.push(m.name);
  }
  if (metrics.length) {
    if (cleanAxisViolations.length)
      add(
        "Part D · clean axis",
        "fail",
        `${cleanAxisViolations.length} clean axis(es) (grade 95, no leak fired) assert a fabricated problem in their diagnosis: ${cleanAxisViolations.join(
          ", "
        )}. Clean axes must read neutral/positive.`
      );
    else add("Part D · clean axis", "pass", "Clean (grade-95) axes read neutral — no fabricated problems.");
  }

  // ── Law 11 · never print the scaffold ────────────────────────────────────────
  // Prompt scaffolding leaks as slash-delimited analysis-dimension lists in copy
  // (e.g. "headline clarity / subheadline strength / CTA visibility / ..."). A
  // value with 3+ " / "-joined short fragments is almost certainly scaffolding.
  const scaffoldHits: string[] = [];
  for (const s of packText) {
    // Match the renderer's stripScaffold separator: " / " or a spaced en/em-dash.
    const segs = s.split(/\s+[/\u2013\u2014]\s+/);
    // 3+ slash-joined fragments where most are short noun-phrases = a leaked
    // checklist. Allowing one longer fragment catches scaffolds the strict
    // "every segment ≤5 words" rule used to miss.
    const shortSegs = segs.filter((seg) => seg.trim().split(/\s+/).length <= 5).length;
    if (segs.length >= 3 && shortSegs >= 3) {
      scaffoldHits.push(s.length > 80 ? `${s.slice(0, 80)}…` : s);
    }
  }
  if (scaffoldHits.length)
    add("Law 11 · no scaffold", "fail", `${scaffoldHits.length} value(s) look like leaked scaffold checklists: ${Array.from(new Set(scaffoldHits)).slice(0, 2).join(" | ")}.`);
  else add("Law 11 · no scaffold", "pass", "No leaked scaffold checklists detected.");

  // ── Law 12 · reconcile every dollar figure ───────────────────────────────────
  // The exec-summary total (if stated) must equal the sum of itemized leaks.
  // We can at least surface the itemized rolled-up total so a human/CLI sees it,
  // and flag if any single leak's number contradicts itself (low > high).
  const leaks = intel?.leakAnalysis ?? [];
  let sumLow = 0;
  let sumHigh = 0;
  let inverted = 0;
  for (const l of leaks) {
    const d = l.dollarImpact;
    if (!d) continue;
    sumLow += d.monthlyLow || 0;
    sumHigh += d.monthlyHigh || 0;
    if ((d.monthlyLow || 0) > (d.monthlyHigh || 0) && (d.monthlyHigh || 0) > 0) inverted++;
  }
  if (leaks.length) {
    if (inverted)
      add("Law 12 · reconcile $", "fail", `${inverted} leak(s) have monthlyLow > monthlyHigh — internally inconsistent.`);
    else
      add("Law 12 · reconcile $", "pass", `Itemized leaks roll up to $${Math.round(sumLow).toLocaleString()}–$${Math.round(sumHigh).toLocaleString()}/mo — any exec-summary total should match this.`);
  }

  // ── Law 13 · label every assumption, including volume ────────────────────────
  // A leadVolumeBasis that cites a number but no assumption language ("assum…",
  // "estimate", "replace with", "benchmark") risks presenting an invented volume
  // as fact.
  // Prefix match (no trailing \b) so "assum" catches "assuming/assumption",
  // "estimat" catches "estimate/estimated", etc. A trailing \b would fail to
  // match "Assuming" (no boundary between "assum" and "ing") — a false negative.
  const ASSUME_WORDS = /\b(assum|estimat|replace with|benchmark|typical|conservativ|industry)/i;
  let volumeUnlabeled = 0;
  for (const l of leaks) {
    const basis = l.dollarImpact?.leadVolumeBasis ?? "";
    if (/\d/.test(basis) && !ASSUME_WORDS.test(basis)) volumeUnlabeled++;
  }
  if (leaks.length) {
    if (volumeUnlabeled)
      add("Law 13 · label volume", "fail", `${volumeUnlabeled}/${leaks.length} leaks cite a lead volume without assumption language ("assuming…/estimate/replace with your actual number") — an invented volume is being presented as fact.`);
    else add("Law 13 · label volume", "pass", "Lead-volume bases read as labeled assumptions, not invented facts.");
  }

  // ── E3 · every assumption/benchmark-backed dollar figure is labelled in-sentence
  // Law 13 above only inspects `leadVolumeBasis`. This is the general rule the
  // ASSUMPTIONS construct (leak-taxonomy.ts SECTION 4b) exists to enforce: if a
  // number is OUR assumption or an industry benchmark rather than the client's own
  // figure, the sentence carrying the number must say so — RULES.math, "in the
  // SAME SENTENCE as the number".
  //
  // Backing is decided per-leak from deterministic stamps, never from prose. The
  // test is DEFAULT-DENY: a figure counts as client-supplied only when the leak
  // says so. Four ways in:
  //   · dollarImpact.usesBenchmarkValue === true  → the customer value is a benchmark
  //   · evidenceTier === "BENCHMARK"              → nothing about it was measured here
  //   · ASSUMPTION_CAVEAT anywhere in the leak    → an ASSUMPTIONS factor is in the chain
  //     (true even in REAL mode: the close rate and the low-end haircut are assumptions)
  //   · it quantifies at all but carries NO client-sourced marker anywhere — if the
  //     leak never says the number came from the client, it did not come from the
  //     client. This is the case the first three miss: an OBSERVED-tier leak whose
  //     dollar figure was still built from industry rates.
  // A sentence is then licensed by EITHER an assumption/benchmark label OR a
  // client-sourced marker ("based on the numbers you provided", "your number") —
  // the latter because a client's own figure is not an assumption to label.
  const unlabeledDollar: string[] = [];
  const benchmarkBackedLeaks: LeakAnalysisItem[] = [];
  for (const l of leaks) {
    const leakText = collectStrings(l).join("\n");
    const quantifies = Boolean(l.dollarImpact || l.mathFrame?.trim());
    const clientSourced = CLIENT_SOURCED_LABELS.some((re) => re.test(leakText));
    const backedByAssumption =
      l.dollarImpact?.usesBenchmarkValue === true ||
      l.evidenceTier === "BENCHMARK" ||
      leakText.includes(ASSUMPTION_CAVEAT) ||
      (quantifies && !clientSourced);
    if (!backedByAssumption) continue;
    benchmarkBackedLeaks.push(l);
    for (const sentence of sentencesOf(leakText)) {
      if (!DOLLAR_FIGURE.test(sentence)) continue;
      const labeled =
        ASSUMPTION_LABELS.some((re) => re.test(sentence)) ||
        CLIENT_SOURCED_LABELS.some((re) => re.test(sentence));
      if (!labeled)
        unlabeledDollar.push(
          `${l.leakName ?? l.area}: "${sentence.length > 110 ? sentence.slice(0, 110) + "…" : sentence}"`
        );
    }
  }
  // The exec summary is where a naive TOTAL lands. It inherits the backing of the
  // leaks it totals, so once any dollar-bearing leak is assumption/benchmark-backed
  // the summary's own dollar sentences need the same label.
  if (benchmarkBackedLeaks.length && intel?.executiveSummary) {
    for (const sentence of sentencesOf(collectStrings(intel.executiveSummary).join("\n"))) {
      if (!DOLLAR_FIGURE.test(sentence)) continue;
      const labeled =
        ASSUMPTION_LABELS.some((re) => re.test(sentence)) ||
        CLIENT_SOURCED_LABELS.some((re) => re.test(sentence));
      if (!labeled)
        unlabeledDollar.push(
          `Executive summary: "${sentence.length > 110 ? sentence.slice(0, 110) + "…" : sentence}"`
        );
    }
  }
  if (benchmarkBackedLeaks.length) {
    if (unlabeledDollar.length)
      add(
        "E3 · label assumed $",
        "fail",
        `${unlabeledDollar.length} dollar sentence(s) rest on an assumption or industry benchmark but carry no label in the same sentence: ${Array.from(
          new Set(unlabeledDollar)
        )
          .slice(0, 3)
          .join(" | ")}. Say "${ASSUMPTION_CAVEAT}" (or name the benchmark) beside the number.`
      );
    else
      add(
        "E3 · label assumed $",
        "pass",
        `Every dollar figure across ${benchmarkBackedLeaks.length} assumption/benchmark-backed leak(s) is labelled in its own sentence.`
      );
  }

  // ── E3b · label assumed % (owner item 5) ─────────────────────────────────────
  // FATAL, at the same level as the dollar rule it extends. Scanned over the
  // MODEL-AUTHORED fields only: the stamped `industryPattern` is
  // `allowedStats.join(" ")` and carries its own citations, so linting it would
  // report our own wording back to us.
  const percentLeakProse = leaks.flatMap(modelAuthoredLeakProse);
  const unlabelledPercent = unlabelledPercentSentences(percentLeakProse);
  if (unlabelledPercent.length)
    add(
      "E3b · label assumed %",
      "fail",
      `${unlabelledPercent.length} sentence(s) state a percentage with no source and no hedge: ${unlabelledPercent
        .slice(0, 3)
        .map(({ where, sentence }) => `${where}: "${snip(sentence, 90)}"`)
        .join(
          " | "
        )}. Every percentage we print is somebody else's measurement of an industry, not ours of this client — so it is CITED (keep the inline source tag the allowed stat already carries, e.g. "(CallRail)"), HEDGED ("typically", "industry average", "${ASSUMPTION_CAVEAT}"), or taken out. A grade that hedges beside a cost line that asserts is the pairing this rule exists to stop.`
    );
  else if (percentLeakProse.some(({ text }) => PERCENT_FIGURE.test(text)))
    add(
      "E3b · label assumed %",
      "pass",
      "Every percentage in the leak prose names its source or hedges itself, in the same sentence."
    );

  // ── Evidence binding · the grade certifies the SENTENCE ──────────────────────
  // See "THE FABRICATION GATE" above for the tiers and why they differ.
  const bindingFails: string[] = [];
  const bindingWarns: string[] = [];
  const bindingNotes: string[] = [];
  let boundLeaks = 0;
  // THE SCORECARD'S `evidence` FIELD IS SCANNED TOO, and it earns its place: its
  // own type comment calls it "the specific real data behind the score", so it is
  // model prose sitting under a number that reads as a measurement — the same
  // laundering the grade label does on a finding, one section over. It belongs to
  // no single leak, so it is judged against the union of every leak's binding.
  const scorecardPassages = (intel?.scorecard?.metrics ?? [])
    .map((m, i) => ({
      where: `scorecard metric ${i + 1} (${m.name || "unnamed"}) evidence`,
      text: m.evidence ?? "",
    }))
    .filter(({ text }) => Boolean(text.trim()));
  const packUnion: EvidenceBinding | null = leaks.some((l) => bindingOn(l))
    ? {
        leakId: "(whole pack)",
        checkability: "HARD",
        neverObserved: null,
        values: leaks.flatMap((l) => bindingOn(l)?.values ?? []),
        disputedTopics: leaks.flatMap((l) => bindingOn(l)?.disputedTopics ?? []),
        numbers: leaks.flatMap((l) => bindingOn(l)?.numbers ?? []),
      }
    : null;
  for (const { where, hit } of fabricationHits(scorecardPassages, packUnion, allowedNumbers)) {
    const line = quoteHit(where, hit);
    if (hit.kind === "unmeasurable" || hit.kind === "internal") bindingFails.push(line);
    else if (hit.kind === "disputed") bindingNotes.push(line);
    else if (packUnion) bindingFails.push(line);
    else bindingWarns.push(line);
  }
  for (const l of leaks) {
    const binding = bindingOn(l);
    if (binding) boundLeaks++;
    for (const { where, hit } of fabricationHits(
      modelAuthoredLeakProse(l),
      binding,
      allowedNumbers
    )) {
      const line = quoteHit(where, hit);
      // `unmeasurable` and `internal` are fatal with or without a binding: no
      // field in the contract can license a page position, and no scan reaches
      // the inside of an operation, so the absence of a binding changes nothing.
      if (hit.kind === "unmeasurable" || hit.kind === "internal") bindingFails.push(line);
      else if (hit.kind === "disputed") bindingNotes.push(line);
      else if (binding) bindingFails.push(line);
      else bindingWarns.push(line);
    }
  }
  if (bindingFails.length)
    add(
      "Evidence binding · every claim traces to a measured value",
      "fail",
      `${bindingFails.length} sentence(s) assert something about this business that no measured value stands behind: ${Array.from(
        new Set(bindingFails)
      )
        .slice(0, 3)
        .join(
          " | "
        )}. Rewrite each one to restate a value the finding is actually bound to and what it costs, or delete the claim. Do NOT add the field to the binding to silence this: the binding says what we measured, and a sentence is not evidence for itself.`
    );
  else if (leaks.length)
    add(
      "Evidence binding · every claim traces to a measured value",
      "pass",
      `No leak asserts an unmeasurable fact about their pages${
        boundLeaks ? ` (${boundLeaks} of ${leaks.length} leak(s) carry an evidence binding)` : ""
      }.`
    );
  if (bindingWarns.length)
    add(
      "Evidence binding · every claim traces to a measured value",
      "warn",
      `${bindingWarns.length} sentence(s) make a checkable claim about their site on a leak that carries NO evidence binding, so nothing can confirm the claim was written from a measurement: ${Array.from(
        new Set(bindingWarns)
      )
        .slice(0, 3)
        .join(
          " | "
        )}. Nothing is blocked — this pack predates the binding — but regenerate it so each finding carries the values it may reference, and this becomes an enforced check rather than a note.`
    );
  if (bindingNotes.length)
    add(
      "Evidence binding · every claim traces to a measured value",
      "warn",
      `${bindingNotes.length} sentence(s) rest on a field the two contracts disagree about: ${Array.from(
        new Set(bindingNotes)
      )
        .slice(0, 2)
        .join(" | ")}. Decide it once, in UNCITABLE_SCRAPE_FIELDS.`
    );

  // ── Evidence grade · an INTERPRETIVE leak is never "observed" ─────────────────
  // FATAL, and INDEPENDENT of the taxonomy's own ceiling on purpose. `gradeOf`
  // refuses the combination at detection from `Leak.checkability`; this refuses it
  // on the SAVED ROW, from the leak's stamped name and from its binding. Neither
  // guard can be switched off by editing the other, which is the property that
  // matters for the one rule this whole fix is about: "observed" prints "Measured
  // on your public pages" beside the sentence, and there is no measurement under an
  // editorial judgment.
  const interpretiveObserved: string[] = [];
  for (const l of leaks) {
    if (gradeOfLeak(l) !== "observed") continue;
    const byName = l.leakName ? neverObservedReason(l.leakName) : null;
    const byBinding = bindingOn(l)?.neverObserved ?? null;
    const reason = byName ?? byBinding;
    if (reason) interpretiveObserved.push(`${l.leakName ?? l.area}: ${reason}`);
  }
  if (interpretiveObserved.length)
    add(
      "Evidence grade · no interpretive measurement",
      "fail",
      `${interpretiveObserved.length} leak(s) are graded "observed" on a claim nobody measured: ${Array.from(
        new Set(interpretiveObserved)
      )
        .slice(0, 2)
        .join(
          " | "
        )}. Regenerate the pack — the grade is derived at detection and stamped, so a stored "observed" here means either the row predates the checkability ceiling or something wrote the grade by hand. Do not edit the grade in the JSON: fix why it was derived.`
    );
  else if (leaks.length)
    add(
      "Evidence grade · no interpretive measurement",
      "pass",
      "No leak claims a measurement for something that can only be judged."
    );

  // ── Facts · dollar determinism ───────────────────────────────────────────────
  // The dollarImpact range is STAMPED from the deterministic math estimate, never
  // authored by the model (determinism fix 1). Two guards prove it stayed that way:
  //  (a) always-on — each monthlyLow/High must appear verbatim in the SAME leak's
  //      mathFrame, so the gold-callout range can never contradict the frame text.
  //  (b) belt-and-suspenders — when the fired-leak allowedNumbers set is threaded
  //      in, every stamped integer must be a member of it. Either failing means a
  //      model integer leaked into rendered output.
  const inSet = (n: number): boolean => {
    if (!allowedNumbers?.length) return true; // set not provided → guard (a) only
    return allowedNumbers.some((a) => a === n || (a !== 0 && Math.abs(a - n) / a < 0.01));
  };
  const inFrame = (n: number, frame: string | undefined): boolean => {
    if (!frame) return false;
    return frame.includes(n.toLocaleString("en-US")) || frame.includes(String(n));
  };
  let dollarMismatch = 0;
  let dollarOutOfSet = 0;
  for (const l of leaks) {
    const d = l.dollarImpact;
    if (!d) continue;
    for (const n of [d.monthlyLow, d.monthlyHigh]) {
      if (!n) continue;
      if (!inFrame(n, l.mathFrame)) dollarMismatch++;
      if (!inSet(n)) dollarOutOfSet++;
    }
  }
  if (leaks.some((l) => l.dollarImpact)) {
    if (dollarMismatch || dollarOutOfSet)
      add(
        "Facts · dollar determinism",
        "fail",
        `${dollarMismatch} dollar figure(s) not present in their own mathFrame` +
          (allowedNumbers?.length ? ` and ${dollarOutOfSet} outside the allowed-number set` : "") +
          " — a model-authored integer leaked into rendered output."
      );
    else
      add(
        "Facts · dollar determinism",
        "pass",
        `Every stamped dollar figure matches its mathFrame${allowedNumbers?.length ? " and the allowed-number set" : ""}.`
      );
  }

  // ── Law 3 · done-for-you framing + no agency name ────────────────────────────
  const badOwners: string[] = [];
  for (const s of stages) if (s.owner !== "us" && s.owner !== "you") badOwners.push(`funnel:${s.stage}`);
  for (const p of phases) if (p.owner !== "us" && p.owner !== "you") badOwners.push(`phase:${p.phase}`);
  for (const l of intel?.leakAnalysis ?? []) if (l.owner !== "us" && l.owner !== "you") badOwners.push(`leak:${l.area}`);
  if (badOwners.length)
    add("Law 3 · done-for-you", "fail", `Invalid owners (must be "us"/"you"): ${badOwners.join(", ")}.`);
  else add("Law 3 · done-for-you", "pass", "All owners are us/you.");

  // Agency name must never surface in client-facing copy (unless it's the generic
  // default "our team", which is allowed).
  if (AGENCY_NAME.toLowerCase() !== "our team" && allText.toLowerCase().includes(AGENCY_NAME.toLowerCase()))
    add("Law 3 · no agency name", "fail", `Agency name "${AGENCY_NAME}" appears in client copy.`);
  else add("Law 3 · no agency name", "pass", "Agency name not exposed in copy.");

  // ── Law 4 · retainer positioned + product named ──────────────────────────────
  const retainerStages = stages.filter((s) => s.isRetainer);
  const retainerPhases = phases.filter((p) => p.isRetainerPhase);
  if (infra && retainerStages.length !== 1)
    add("Law 4 · retainer", "fail", `Expected exactly 1 retainer funnel stage, found ${retainerStages.length}.`);
  // The roadmap half of this is retired with the roadmap (see E1 above); the
  // FUNNEL half below still runs and is where the retainer is now positioned.
  if (!allText.includes(PRODUCT_NAME))
    add("Law 4 · retainer", "fail", `Product name "${PRODUCT_NAME}" is never mentioned anywhere in the pack.`);
  else if ((infra && retainerStages.length === 1) || (roadmap && retainerPhases.length === 1))
    add("Law 4 · retainer", "pass", `"${PRODUCT_NAME}" retainer positioned in funnel and/or roadmap.`);

  // ── E3 · the retainer is NOT part of the one-time build ──────────────────────
  // FATAL, and it is a PRICING rule wearing a wording rule's clothes. Law 4 above
  // only asks that the retainer is positioned SOMEWHERE. This asks the harder
  // question: does any sentence in this pack tell the client that the CAD $6,500
  // one-time build includes the qualification engine? If one does, the document
  // itself has sold the retainer for free, and the first monthly invoice is an
  // argument the client can win by pointing at page four.
  //
  // Three places the mistake actually happens, so all three are checked:
  //   1. the funnel — a Qualify stage flagged isRetainer=false,
  //   2. the roadmap — a build/go-live phase whose deploy actions install or tune
  //      the qualification engine,
  //   3. the prose — one sentence naming both the qualification layer and the
  //      one-time fee.
  // Each has the SAME escape valve: say "monthly" (or "retainer", or "ongoing") in
  // the same sentence. That is not a loophole — it is the sentence being correct.
  const retainerMisplacements: string[] = [];

  for (const s of stages) {
    // stage/role/whatWeDeploy only — NOT `currentWeakness`. currentWeakness says
    // what is broken in the client's operation TODAY ("nothing qualifies a lead
    // before it reaches you"), so reading it here would flag the stage for
    // correctly diagnosing the absence of the very thing the stage installs.
    const named = QUALIFICATION_LAYER.test(`${s.stage ?? ""} ${s.role ?? ""} ${s.whatWeDeploy ?? ""}`);
    if (named && !s.isRetainer)
      retainerMisplacements.push(
        `funnel stage "${s.stage}" is the qualification layer but carries isRetainer=false — set it true so D2 badges it as the monthly engine`
      );
  }

  for (const p of phases) {
    if (p.isRetainerPhase) continue; // the retainer phase is where it belongs
    const lines = [
      ...(p.deployActions ?? []),
      ...(p.doneDefinition ?? []),
      p.objective ?? "",
    ].filter((s) => s.trim());
    for (const line of lines) {
      if (!QUALIFICATION_LAYER.test(line)) continue;
      if (RETAINER_MARKER.test(line)) continue; // the line already says it's monthly
      retainerMisplacements.push(
        `roadmap phase "${p.phase}" is inside the one-time build and claims the qualification layer: "${
          line.length > 100 ? line.slice(0, 100) + "…" : line
        }"`
      );
    }
  }

  for (const sentence of sentencesOf(allText)) {
    if (!QUALIFICATION_LAYER.test(sentence)) continue;
    if (!ONE_TIME_BUILD.test(sentence)) continue;
    if (RETAINER_MARKER.test(sentence)) continue;
    retainerMisplacements.push(
      `copy: "${sentence.length > 120 ? sentence.slice(0, 120) + "…" : sentence}"`
    );
  }

  if (infra || roadmap) {
    if (retainerMisplacements.length)
      add(
        "E3 · retainer is not the build",
        "fail",
        `${retainerMisplacements.length} place(s) present ${PRODUCT_NAME} / lead qualification / lead scoring as part of the one-time build: ${Array.from(
          new Set(retainerMisplacements)
        )
          .slice(0, 4)
          .join(
            " | "
          )}. Move it to the Days 15–90 retainer phase, or say in the same sentence that the monthly retainer runs it. Leaving it as written sells the CAD $1,000/month engine inside the CAD $6,500 fee.`
      );
    else
      add(
        "E3 · retainer is not the build",
        "pass",
        `Nothing presents ${PRODUCT_NAME} / lead qualification as included in the one-time build.`
      );
  }

  // ── E3 · no website work promised in D2 or D3 ────────────────────────────────
  // FATAL. Scoped to the two documents that promise: D2 says what gets built, D3
  // is the copy that goes live. The two lists below are the components each
  // document draws from in deliverables.ts — including D3's landing fallback, so
  // whichever of the two landing sources actually renders is the one checked.
  // Whole components are scanned rather than the exact rendered subfields: this
  // is a BAN, and a promise to rebuild someone's website is wrong wherever in the
  // component it is sitting, including in a field a later renderer starts showing.
  const d2Text = collectStrings([
    infra,
    pack.file2,
    pack.file3,
    pack.file4,
    pack.file5,
  ]);
  // D3 renders the dedicated landing module when it exists and the file1 landing
  // copy only when it does not — same ?? the renderer uses.
  const d3Text = collectStrings([
    pack.landing?.assets ?? pack.file1?.landingPage,
    pack.file3,
    pack.file4,
    pack.file5,
    pack.supportingAssets,
  ]);
  const websiteWork: string[] = [];
  for (const [doc, strings] of [
    ["D2", d2Text],
    ["D3", d3Text],
  ] as const) {
    for (const s of strings) {
      for (const { label, re } of WEBSITE_WORK_PATTERNS) {
        if (!re.test(s)) continue;
        websiteWork.push(`${doc} (${label}): "${s.length > 90 ? s.slice(0, 90) + "…" : s}"`);
      }
    }
  }
  if (d2Text.length || d3Text.length) {
    if (websiteWork.length)
      add(
        "E3 · no website work in D2/D3",
        "fail",
        `${websiteWork.length} passage(s) in the Blueprint or the Asset Pack promise website work we do not do: ${Array.from(
          new Set(websiteWork)
        )
          .slice(0, 3)
          .join(
            " | "
          )}. We build ONE page — the booking page inside GoHighLevel. Either delete the promise, or move the finding into D1 as an advisory recommendation the client hands to whoever runs their site.`
      );
    else
      add(
        "E3 · no website work in D2/D3",
        "pass",
        "Neither D2 nor D3 promises a website build, rebuild or redesign."
      );
  }

  // ── E3 · the nurture sequence spans 60 days ──────────────────────────────────
  // FATAL. Two halves, because the sequence can be wrong in two ways: the emails
  // themselves can stop early, or the copy can DESCRIBE it as a 7-day sequence
  // while the emails run longer. The structural half is the one that bites.
  const nurtureEmails = pack.file3?.emails ?? [];
  const nurtureFaults: string[] = [];
  if (nurtureEmails.length) {
    const lastDay = nurtureEmails.reduce((max, e) => Math.max(max, Number(e.day) || 0), 0);
    if (lastDay < NURTURE_SPAN_DAYS)
      nurtureFaults.push(
        `the last email lands on day ${lastDay}, so the sequence stops ${
          NURTURE_SPAN_DAYS - lastDay
        } days early`
      );
  }
  for (const s of packText)
    for (const re of SHORT_NURTURE_CLAIM)
      if (re.test(s))
        nurtureFaults.push(`copy calls it a 7-day sequence: "${s.length > 90 ? s.slice(0, 90) + "…" : s}"`);
  if (nurtureEmails.length) {
    if (nurtureFaults.length)
      add(
        "E3 · 60-day nurture",
        "fail",
        `The nurture sequence does not run the full ${NURTURE_SPAN_DAYS} days: ${Array.from(
          new Set(nurtureFaults)
        )
          .slice(0, 3)
          .join(
            " | "
          )}. Extend the emails so the last one lands on or after day ${NURTURE_SPAN_DAYS} — that is when the workflow closes the deal out to Lost, and a lead who was going to take two months to decide has to still be hearing from them at day 45.`
      );
    else
      add(
        "E3 · 60-day nurture",
        "pass",
        `The nurture sequence runs the full ${NURTURE_SPAN_DAYS} days.`
      );
  }

  // ── E3 · every D3 asset names the surface it goes to ─────────────────────────
  // FATAL. D3 is the copy that goes live, and copy with no stated destination
  // cannot be installed — the operator is handed a page of words and has to guess
  // whether they belong on the booking page, in the form, in an email or in a
  // text. The groups below are exactly the sections renderDeliverable3 emits.
  const d3Groups: { name: string; value: unknown }[] = [
    { name: "Landing Page Conversion Assets", value: pack.landing?.assets ?? pack.file1?.landingPage },
    { name: "Email Nurture Assets", value: withoutFraming(pack.file3) },
    { name: "SMS Follow-Up Assets", value: withoutFraming(pack.file4) },
    { name: "Booking & Reminder Assets", value: withoutFraming(pack.file5) },
    { name: "Thank-You & Post-Purchase Assets", value: withoutFraming(pack.supportingAssets) },
  ];
  const surfaceless: string[] = [];
  let d3GroupsPresent = 0;
  for (const g of d3Groups) {
    const strings = collectStrings(g.value);
    if (!strings.length) continue; // the section will not render at all
    d3GroupsPresent += 1;
    // An explicit placement field settles it outright; otherwise the group has to
    // name one of the surfaces this build actually installs.
    if (valuesUnderKeys(g.value, EXPLICIT_SURFACE_KEYS).length) continue;
    if (D3_SURFACES.some(({ re }) => strings.some((s) => re.test(s)))) continue;
    surfaceless.push(g.name);
  }
  // Per-asset teeth where the shape already provides a slot: every CTA carries its
  // own placement, so an empty `whereToUse` is a surfaceless asset on its own.
  for (const c of pack.landing?.assets?.ctaOptions ?? [])
    if (!c.whereToUse?.trim())
      surfaceless.push(`CTA "${c.label || "(unlabelled)"}" (no "where to place it")`);
  if (d3GroupsPresent) {
    if (surfaceless.length)
      add(
        "E3 · D3 assets name their surface",
        "fail",
        `${surfaceless.length} asset(s) in the Conversion Asset Pack never say where the copy goes: ${Array.from(
          new Set(surfaceless)
        ).join(
          ", "
        )}. Name the surface in the asset's own words — the booking page, the lead-capture form, the webchat widget, an email, a text from the tracked number, or the thank-you page — so whoever installs it does not have to guess.`
      );
    else
      add(
        "E3 · D3 assets name their surface",
        "pass",
        `All ${d3GroupsPresent} asset group(s) in D3 name the surface they go to.`
      );
  }

  // ── Law 5 · dollar impact with visible math + assumptions ────────────────────
  // Governance model: pre-intake BENCHMARK leaks make NO client-revenue claim, so
  // they carry a stamped `mathFrame` (labeled "≈ $X/mo — assuming…") and/or cited
  // stats instead of a full structured dollarImpact. A leak is quantified when it
  // has EITHER a complete structured dollarImpact OR a stamped math frame OR cited
  // stats. But some leaks are QUALITATIVE BY DESIGN — the taxonomy gives them no
  // statIds and no mathTemplate (e.g. CRM pipeline, call-tracking, payment
  // friction). Those carry `quantifiable: false` and must NOT be forced to invent
  // a number. Only a QUANTIFIABLE leak that still shows nothing is a real gap.
  let leaksUnquantified = 0;
  for (const l of intel?.leakAnalysis ?? []) {
    // Leaks stamped before this field, or with no quantification path, are
    // qualitative — skip. (undefined = legacy/unstamped, treat as qualitative.)
    if (l.quantifiable !== true) continue;
    const d = l.dollarImpact;
    const structured =
      d &&
      d.formula?.trim() &&
      d.leadVolumeBasis?.trim() &&
      d.effectSize?.trim() &&
      d.avgValueBasis?.trim() &&
      (d.monthlyLow > 0 || d.monthlyHigh > 0);
    const stamped = Boolean(l.mathFrame?.trim() || (l.allowedStats ?? []).length);
    if (!structured && !stamped) leaksUnquantified++;
  }
  if (intel?.leakAnalysis?.length) {
    if (leaksUnquantified)
      add("Law 5 · dollar math", "fail", `${leaksUnquantified} quantifiable leak(s) carry no quantification at all (no structured dollar impact, no computed math frame, no cited stat).`);
    else add("Law 5 · dollar math", "pass", "Every quantifiable leak carries visible math and/or cited industry stats; qualitative leaks correctly assert no invented figure.");
  }

  // ── Defect 1 · quantification is not gone ────────────────────────────────────
  // A report WITH fired leaks that renders ZERO stat references AND zero computed
  // math is the overcorrection we're guarding against. At least one fired leak
  // must surface a whitelisted stat or a computed dollar frame.
  const analysisLeaks = intel?.leakAnalysis ?? [];
  if (analysisLeaks.length) {
    const withStats = analysisLeaks.filter((l) => (l.allowedStats ?? []).length).length;
    const withMath = analysisLeaks.filter((l) => l.mathFrame?.trim()).length;
    if (withStats === 0 && withMath === 0)
      add("Defect 1 · quantification", "fail", `Report has ${analysisLeaks.length} fired leak(s) but ZERO cited stats and ZERO computed math frames — quantification was stripped.`);
    else add("Defect 1 · quantification", "pass", `${withStats} leak(s) cite stats; ${withMath} carry a computed math frame.`);
    // ≤2 dollar-bearing math frames per document (spend-anchored CPL leaks only).
    const dollarFrames = analysisLeaks.filter((l) => /\$\s?\d/.test(l.mathFrame ?? "") && /\/mo\b/.test(l.mathFrame ?? "")).length;
    if (dollarFrames > 2)
      add("Defect 1 · math cap", "fail", `${dollarFrames} leaks carry a dollar math frame — cap is 2 per document.`);
    else add("Defect 1 · math cap", "pass", `${dollarFrames} dollar math frame(s) (≤2).`);
  }

  // ── Defect 2 · leak section identity ─────────────────────────────────────────
  // Every leak section must be titled by a fired taxonomy leak name (stamped
  // `leakName`), not a free-text axis label. And no "critical" leak may sit on an
  // axis the scorecard rates 90+ (self-contradiction: bleeding vs. clean).
  if (analysisLeaks.length) {
    const untitled = analysisLeaks.filter((l) => !l.leakName?.trim()).length;
    if (untitled)
      add("Defect 2 · leak identity", "fail", `${untitled}/${analysisLeaks.length} leak section(s) lack a stamped taxonomy leak name (title falls back to a free-text axis label).`);
    else add("Defect 2 · leak identity", "pass", "Every leak section is titled by its taxonomy leak name.");

    const contradictions: string[] = [];
    for (const l of analysisLeaks) {
      if (l.priority !== "critical" || !l.scorecardArea) continue;
      const m = metrics.find((x) => x.name === l.scorecardArea);
      if (m && m.score >= 90) contradictions.push(`${l.leakName} (${l.scorecardArea} scores ${m.score})`);
    }
    if (contradictions.length)
      add("Defect 2 · axis coherence", "fail", `Critical leak(s) share an axis the scorecard rates 90+: ${contradictions.join(", ")}.`);
    else add("Defect 2 · axis coherence", "pass", "No critical leak contradicts a 90+ axis score.");
  }

  // ── Defect 5 · no invented offers ────────────────────────────────────────────
  // A fabricated "$N off"/"N% off" promotion anywhere in the pack is a hard fail;
  // real offers must be operator-supplied, else an editable placeholder.
  const offenders = packText.filter((s) => hasInventedOffer(s));
  if (offenders.length)
    add("Defect 5 · no invented offers", "fail", `${offenders.length} string(s) contain a fabricated discount amount: ${offenders.slice(0, 2).map((s) => (s.length > 60 ? s.slice(0, 60) + "…" : s)).join(" | ")}.`);
  else add("Defect 5 · no invented offers", "pass", "No invented discount/offer amounts.");

  // ── Law 6 · defensible scores (rubric + evidence) ────────────────────────────
  let metricsMissing = 0;
  for (const m of metrics) if (!m.rubric?.trim() || !m.evidence?.trim()) metricsMissing++;
  if (metrics.length) {
    if (metricsMissing)
      add("Law 6 · defensible scores", "fail", `${metricsMissing}/${metrics.length} scorecard metrics lack a rubric and/or evidence.`);
    else add("Law 6 · defensible scores", "pass", "Every score carries a rubric + evidence.");
  }

  // ── Law 7 · no tautologies / filler ──────────────────────────────────────────
  const filler = hits(allText, FILLER_TERMS);
  if (filler.length)
    add("Law 7 · no filler", "warn", `Filler/tautology phrases found: ${Array.from(new Set(filler)).join(", ")}.`);
  else add("Law 7 · no filler", "pass", "No banned filler phrases.");

  // ── E3 · hype / promise vocabulary (hard fail, not a warning) ────────────────
  // Filler above is a warning because it is merely bad writing. These four are a
  // FAIL because each one is a claim: "guaranteed" promises an outcome nobody can
  // promise, "skyrocket" invents a magnitude, and "secret"/"hack" sell insider
  // knowledge instead of measured findings. None of them appeared in ANY existing
  // banned list (leak-narrative's BANNED_WORDS, FILLER_TERMS, LEADGEN_TERMS).
  const hypeHits: string[] = [];
  for (const sentence of sentencesOf(allText)) {
    for (const { term, re } of HYPE_BAN_PATTERNS) {
      if (!re.test(sentence)) continue;
      // The only honest use of the guarantee family is refusing to give one.
      if (term === "guaranteed" && GUARANTEE_NEGATED.test(sentence)) continue;
      hypeHits.push(`${term} → "${sentence.length > 90 ? sentence.slice(0, 90) + "…" : sentence}"`);
    }
  }
  if (hypeHits.length)
    add(
      "E3 · no hype promises",
      "fail",
      `${hypeHits.length} hype/promise term(s) present (guaranteed / skyrocket / secret / hack): ${Array.from(
        new Set(hypeHits)
      )
        .slice(0, 3)
        .join(" | ")}.`
    );
  else add("E3 · no hype promises", "pass", "No guaranteed/skyrocket/secret/hack promises.");

  // All-caps promises. Shouting is how a promise sneaks past a vocabulary ban
  // ("MORE CALLS FAST"), so a multi-word caps run is a fail on its own. A run made
  // entirely of known acronyms ("CRM SMS") is normal typography and passes.
  const capsHits: string[] = [];
  for (const s of packText) {
    for (const run of s.replace(BRACKETED_PLACEHOLDER, " ").match(CAPS_RUN) ?? []) {
      const tokens = run.split(/[ \t]+/).filter(Boolean);
      if (tokens.every((t) => ALLOWED_ACRONYMS.has(t.replace(/['’]/g, "")))) continue;
      capsHits.push(run);
    }
  }
  if (capsHits.length)
    add(
      "E3 · no all-caps promises",
      "fail",
      `${capsHits.length} all-caps run(s) in client copy — shouted emphasis reads as a promise: ${Array.from(
        new Set(capsHits)
      )
        .slice(0, 4)
        .map((r) => `"${r}"`)
        .join(", ")}.`
    );
  else add("E3 · no all-caps promises", "pass", "No shouted (all-caps) promises.");

  // ── Law 8 · lead with the gut-punch (heuristic) ──────────────────────────────
  const opener = (intel?.executiveSummary?.narrative ?? "").trim();
  if (opener) {
    const firstSentence = opener.split(/(?<=[.!?])\s/)[0].toLowerCase();
    const complimentOpeners = ["great", "you have a strong", "you've built", "impressive", "well done", "congratulations", "your business is doing", "kudos", "nice"];
    if (complimentOpeners.some((c) => firstSentence.startsWith(c)))
      add("Law 8 · gut-punch opening", "warn", `Exec summary may open with a compliment: "${opener.slice(0, 80)}…"`);
    else add("Law 8 · gut-punch opening", "pass", "Exec summary does not open with a compliment.");
  }

  // ── Law 10 · voice (hedge-soup density, heuristic) ───────────────────────────
  const words = allText.split(/\s+/).length || 1;
  const hedgeCount = HEDGE_TERMS.reduce((n, t) => n + (allText.toLowerCase().match(new RegExp(`\\b${t}\\b`, "g"))?.length ?? 0), 0);
  const hedgePer1k = (hedgeCount / words) * 1000;
  if (hedgePer1k > 12)
    add("Law 10 · voice", "warn", `High hedge-word density (${hedgePer1k.toFixed(1)}/1k words) — risk of hedge-soup.`);
  else add("Law 10 · voice", "pass", `Hedge density acceptable (${hedgePer1k.toFixed(1)}/1k words).`);

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  return { checks, fails, warns, passed: fails === 0 };
}

// ── The enforcing entry point (E2) ────────────────────────────────────────────
// POLICY REVERSAL. The old rule was "a validation gap must not block a paying
// operator's export", so index.ts console.warn'd and shipped the ZIP anyway. That
// is now inverted by the owner: a FATAL violation blocks. A pack that fails its
// own laws is worse than a missing export — it goes to a prospect with our name
// on it.
//
// Two entry points, deliberately:
//   · validatePack()    — PURE. Returns checks, never throws, never decides. The
//                         CLI (check-pack, gen-check), the test suite and
//                         verify-intake all depend on getting the full picture
//                         back including failures, so it must stay judgement-free.
//   · assertPackValid() — the POLICY. Same checks, but it states the verdict.
//
// It still does not throw: the caller is an API route that has to turn this into
// an operator-facing message, and an exception at that boundary becomes a generic
// 500 with nothing useful in it. WARNINGS ARE RETURNED, NEVER FATAL — a route can
// surface them beside a successful export without blocking anything.

/** Verdict from the enforcing validator. `fails` is empty when `ok` is true; the
 *  shape is identical on both branches so a route can read `warns`/`report`
 *  without narrowing first. */
export type PackAssertion =
  | { ok: true; fails: ValidationCheck[]; warns: ValidationCheck[]; report: string }
  | { ok: false; fails: ValidationCheck[]; warns: ValidationCheck[]; report: string };

/**
 * Enforcing wrapper around validatePack. Fatal = any check at level "fail".
 *
 *   const verdict = assertPackValid(pack);
 *   if (!verdict.ok) return NextResponse.json({ error: verdict.report }, { status: 422 });
 *   // verdict.warns is safe to surface alongside a successful export
 *
 * @param pack           the pack about to be exported/shipped
 * @param allowedNumbers optional fired-leak number whitelist, threaded straight
 *                       through to validatePack's dollar-determinism guard
 */
export function assertPackValid(
  pack: AssetPack,
  allowedNumbers?: number[]
): PackAssertion {
  const result = validatePack(pack, allowedNumbers);
  const fails = result.checks.filter((c) => c.level === "fail");
  const warns = result.checks.filter((c) => c.level === "warn");
  return {
    ok: fails.length === 0,
    fails,
    warns,
    report: formatValidation(result),
  } as PackAssertion;
}

// ── (removed) The pre-sale cold-audit validator ───────────────────────────────
// `validateColdAudit`, `assertColdAuditValid` and `assertStoredColdAuditSafe`
// lived here until 2026-08-01, when the free cold audit was deleted by owner
// ruling: no pre-sale generative surface exists any more, so there is no
// pre-sale document left to validate. The PAID pack suite above is untouched —
// every law, the evidence grades, the fabrication lint and the override
// machinery below still police the four paid deliverables.

/** Trim a quoted passage so a failure message stays readable in a log line. */
function snip(s: string, n = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// ── The escape hatch (Phase 0.6) ──────────────────────────────────────────────
// Blocking on a fatal check is the right policy, but it has one failure mode: at
// 11pm with a client waiting, a rule false-positives on something harmless and
// the operator physically cannot deliver. That situation ends with the gate
// commented out — and then enforcement is off permanently and SILENTLY, which is
// far worse than any single bad export. So the hatch is built properly instead:
// it stays shut by default, it costs a deliberate act, and it leaves a trail.
//
// HOW "THE OPERATOR SAW THE FAILING CHECKS" IS ENFORCED SERVER-SIDE.
// An API cannot see anyone's screen, so a naive `force: true` would be a lie —
// it proves nothing about what was read. The honest mechanism is a CONFIRMATION
// HANDSHAKE: the caller must echo back the id of every check that is failing on
// THIS request, and the server grants the override only if the echoed set
// matches the real one EXACTLY. The ids are content-derived (see `checkId`), so
// the only way to produce them is to have received the actual failure list — and
// the only way to receive it is to have been shown it. Two consequences follow,
// and both are the point:
//   · a blind force cannot work: there is nothing to guess.
//   · an acknowledgement collected against an EARLIER failure cannot authorise a
//     later, different one — different violation, different ids, no match. The
//     operator is re-shown the current set and has to look at it again.
//
// Set EQUALITY, not "covers", is deliberate. An id the caller sent that is not
// failing now is exactly the fingerprint of a stale list, so it rejects too.

/** Hard cap on the stored reason: long enough for a paragraph of real context,
 *  short enough that nobody pastes a stack trace into an audit column. */
export const MAX_OVERRIDE_REASON_LENGTH = 2000;

/** The override, as it arrives on the wire. */
export interface OverrideRequest {
  /** Free text, written by the operator. Whitespace is not a reason. */
  reason: string;
  /** `checkId` of every check that is fatal right now — the handshake. */
  acknowledgedChecks: string[];
}

export type OverrideRejectionCode =
  /** The `override` field was present but not an object with the right fields. */
  | "MALFORMED"
  /** Missing, empty, or whitespace-only reason. */
  | "NO_REASON"
  /** The echoed set does not match the checks that are failing now. */
  | "STALE_ACKNOWLEDGEMENT";

export type OverrideDecision =
  /** No override was supplied — the caller gets the normal block. */
  | { status: "absent" }
  | {
      status: "rejected";
      code: OverrideRejectionCode;
      /** Operator-facing sentence, safe to put straight in a 422 body. */
      message: string;
      /** Fatal checks the caller did NOT acknowledge. These are what must be
       *  rendered before a second attempt is worth making. */
      unacknowledged: ValidationCheck[];
      /** Ids the caller sent that are not failing now — the stale half. */
      unrecognized: string[];
    }
  | { status: "granted"; governance: PackGovernance };

/**
 * Decide whether a supplied override may unlock a blocked boundary.
 *
 * Pure: it reads the current fatal set and the request, and returns a verdict.
 * Persisting the trail is the caller's job, because only the route knows which
 * row and which business it belongs to.
 *
 * @param fatals   every check that is blocking RIGHT NOW, on this request
 * @param input    the raw `override` value off the request body (untrusted)
 * @param boundary which gate is being forced — recorded in the trail
 */
export function evaluateOverride(
  fatals: ValidationCheck[],
  input: unknown,
  boundary: GovernanceBoundary,
  now: Date = new Date()
): OverrideDecision {
  if (input === undefined || input === null) return { status: "absent" };

  if (typeof input !== "object" || Array.isArray(input))
    return {
      status: "rejected",
      code: "MALFORMED",
      message:
        'Override must be an object: { reason: "...", acknowledgedChecks: ["..."] }.',
      unacknowledged: fatals,
      unrecognized: [],
    };

  const raw = input as { reason?: unknown; acknowledgedChecks?: unknown };

  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (!reason)
    return {
      status: "rejected",
      code: "NO_REASON",
      message:
        "An override needs a written reason. Say what is wrong with the check or why shipping over it is the right call — it is stored on the record and read later.",
      unacknowledged: fatals,
      unrecognized: [],
    };

  if (!Array.isArray(raw.acknowledgedChecks))
    return {
      status: "rejected",
      code: "MALFORMED",
      message:
        "Override must list `acknowledgedChecks` — the id of every check being waived, exactly as returned by this endpoint.",
      unacknowledged: fatals,
      unrecognized: [],
    };

  const acknowledged = new Set(
    raw.acknowledgedChecks
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean)
  );
  const currentIds = new Set(fatals.map((c) => c.id));
  const unacknowledged = fatals.filter((c) => !acknowledged.has(c.id));
  const unrecognized = Array.from(acknowledged).filter((id) => !currentIds.has(id));

  if (unacknowledged.length || unrecognized.length)
    return {
      status: "rejected",
      code: "STALE_ACKNOWLEDGEMENT",
      message:
        `This override does not match what is failing now (${unacknowledged.length} check(s) not acknowledged` +
        (unrecognized.length ? `, ${unrecognized.length} acknowledged check(s) no longer failing` : "") +
        "). The pack has changed since the list was shown. Read the current failures and confirm again.",
      unacknowledged,
      unrecognized,
    };

  return {
    status: "granted",
    governance: {
      overridden: true,
      reason: reason.slice(0, MAX_OVERRIDE_REASON_LENGTH),
      checks: fatals,
      at: now.toISOString(),
      boundary,
    },
  };
}

/** Stamp (or clear) the governance block on a pack, without mutating the input.
 *
 *  Clearing on the clean path matters as much as stamping on the forced one: the
 *  block's PRESENCE is the signal, so a pack that came back from a browser tab
 *  still carrying an old override marker must not re-save itself as "shipped
 *  over a violation" when it now passes cleanly. */
export function withGovernance(
  pack: AssetPack,
  governance: PackGovernance | undefined
): AssetPack {
  if (!governance) {
    const { governance: _stale, ...clean } = pack;
    return clean;
  }
  return { ...pack, governance };
}

/** One-line summary for the server log. An overridden export must be LOUD:
 *  `console.error` is deliberate even though nothing crashed, because this is the
 *  line someone greps for when asking "did we ever ship a known violation?". */
export function formatOverrideLog(
  businessId: string,
  governance: PackGovernance
): string {
  const laws = Array.from(new Set(governance.checks.map((c) => c.law)));
  return (
    `GOVERNANCE OVERRIDE · ${governance.boundary} forced for business ${businessId} ` +
    `over ${governance.checks.length} fatal check(s) [${laws.join(", ")}] ` +
    `at ${governance.at} — reason: "${governance.reason}"`
  );
}

// Pretty one-line-per-check report for CLI output.
export function formatValidation(r: ValidationResult): string {
  const icon = { pass: "✓", warn: "!", fail: "✗" } as const;
  const lines = r.checks.map((c) => `  ${icon[c.level]} [${c.law}] ${c.message}`);
  const head = r.passed
    ? `PASSED — ${r.warns} warning(s), 0 failures`
    : `FAILED — ${r.fails} failure(s), ${r.warns} warning(s)`;
  return `${head}\n${lines.join("\n")}`;
}
