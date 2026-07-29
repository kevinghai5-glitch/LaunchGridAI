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
  ColdAuditFinding,
  ColdAuditReport,
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
  DISCLOSURE_MARKERS,
  ASSUMPTION_CAVEAT,
} from "../leak-narrative";
// Whether a booking link exists at all is a matter of CONFIGURATION, not of
// document quality, and the cold-audit CTA check has to know the difference —
// see "Close · one booking CTA" below.
import { BOOKING_URL } from "../constants";
// ── THE PHASE 4 COLD-AUDIT LAWS LIVE IN THE RENDERER, AND ARE IMPORTED ────────
// The frame, the six invisible leaks in the owner's own phone words, the section
// labels and the scope sweep are all STAMPED CONSTANTS in cold-audit-html.ts.
// They are imported here and never retyped, for the reason Phase 0.5 taught us
// the hard way: the moment a validator carries its own copy of a sanctioned
// sentence, the two copies drift and the gate starts failing documents that are
// correct. One copy, in the file that prints it; this file only reads it back.
//
// `enforceColdAuditLaws` and `renderColdAuditHtml` are imported for the same
// reason: this validator judges THE DOCUMENT A PROSPECT READS, and the only
// honest way to know what that says is to build it the way every surface does.
// (No import cycle: cold-audit-html.ts imports the narrative helpers and the
// constants, and never this file.)
import {
  OUTSIDE_INSIDE_FRAME,
  PIVOT_LEAK_PHRASES,
  PIVOT_SECTION_LABEL,
  SCAN_SECTION_LABEL,
  countCallsToAction,
  enforceColdAuditLaws,
  outOfScopeHits,
  renderColdAuditHtml,
  scopeViolations,
} from "./cold-audit-html";
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
  if (!roadmap) add("Structure", "fail", "Missing `roadmap` — pre-v2 (stale) pack. Regenerate.");

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

  // ── E1 · Structure · the roadmap matches the offer ───────────────────────────
  // D4 is the schedule the client is buying: two weeks of build, a go-live, then
  // the retainer running to day 90. Each window is checked by position, and the
  // retainer flag is checked with it — "which phase is the monthly one" is the
  // single most expensive thing for a deliverable to get wrong.
  const phases = roadmap?.phases ?? [];
  if (roadmap) {
    if (phases.length !== ROADMAP_SHAPE.length)
      add(
        "Structure · roadmap shape",
        phases.length ? "warn" : "fail",
        `The D4 roadmap has ${phases.length} phases, expected ${ROADMAP_SHAPE.length}: ${ROADMAP_SHAPE.map(
          (p) => `${p.name} (${p.window})`
        ).join(" → ")}. Regenerate D4 against the engagement we actually sell.`
      );
    else {
      const wrongShape: string[] = [];
      phases.forEach((p, i) => {
        const spec = ROADMAP_SHAPE[i];
        const naming = `${p.phase ?? ""} ${p.window ?? ""}`.trim();
        if (!spec.match.test(naming))
          wrongShape.push(
            `phase ${i + 1} reads "${naming || "(unnamed)"}" but must be the ${spec.name} window (${spec.window})`
          );
        if (Boolean(p.isRetainerPhase) !== spec.isRetainerPhase)
          wrongShape.push(
            `phase ${i + 1} ("${p.phase}") has isRetainerPhase=${Boolean(p.isRetainerPhase)}; ${
              spec.isRetainerPhase
                ? "the Days 15–90 phase IS the monthly retainer and must be true"
                : "this phase is inside the one-time build and must be false"
            }`
          );
      });
      if (wrongShape.length)
        add(
          "Structure · roadmap shape",
          "fail",
          `The D4 roadmap does not match the engagement: ${wrongShape.join(
            "; "
          )}. Fix the phase window (and the retainer flag) so the schedule reads Build Days 1–14 → go-live → Ongoing Days 15–90.`
        );
      else
        add(
          "Structure · roadmap shape",
          "pass",
          "D4 runs Build (Days 1–14) → go-live → Ongoing (Days 15–90), with the retainer on the last phase only."
        );
    }
  }

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
  if (roadmap && retainerPhases.length !== 1)
    add("Law 4 · retainer", "fail", `Expected exactly 1 retainer roadmap phase, found ${retainerPhases.length}.`);
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

// ── The PRE-SALE validator (Phase 1) ──────────────────────────────────────────
// NEW ENTRY POINT — SAY IT PLAINLY: before this, the free cold audit had NO
// validator. Everything above validates the paid pack; the document we send to a
// stranger before they have paid us anything was checked only at generation time,
// inside cold-audit.ts.
//
// NOTHING IS DISCLOSED BEFORE THE SALE. A cold audit is a scan and nothing else:
// no intake form has been filled in, no kickoff call has happened, so there is
// nothing the client could have told us. A finding that arrives here carrying the
// grade "disclosed" is therefore not a wording problem — it is a leak in the
// pipeline (post-sale intake data reaching a pre-sale surface), and it would show
// a prospect a "you told us…" sentence about a conversation that never happened.
//
// THREE BELTS, DELIBERATELY, because this is the one boundary where being wrong
// is unrecoverable — the document has already left the building:
//   1. COMPILE TIME — PreSaleResearch declares `intake?: never`, so a pre-sale
//      detection is structurally incapable of carrying intake (leak-detection.ts).
//   2. GENERATION — a runtime assertion in the cold-audit pipeline.
//   3. HERE — anything ALREADY STORED. Belts 1 and 2 protect documents generated
//      from now on; a cold audit saved yesterday is only caught by reading it back
//      and checking, which is what this does.
//
// WHY THIS IS NO LONGER A ONE-RULE VALIDATOR (Phase 4).
// Phase 1 shipped this with a single rule and a comment saying that copying the
// pack's law suite in here would only create two lists that eventually disagree.
// That reasoning was right about the PACK's laws and it still holds — not one of
// them has been copied below. What changed is that the cold audit acquired laws
// OF ITS OWN, because its job changed. It is no longer the thing that closes the
// deal; it is emailed before a 15-minute Zoom, gets two or three minutes of
// airtime as proof we looked, and then hands off to the questions. Five rules
// follow from that job and from nothing else:
//
//   · the outside/inside frame is on the page, before any finding;
//   · the six invisible leaks are ASKED, in his own phone words, never asserted;
//   · there is exactly ONE ask, and it books the call;
//   · every dollar figure reads as an industry benchmark, labelled in-sentence;
//   · nothing anywhere recommends ads, SEO, lead gen or a new website.
//
// Every one of those is checked against the constants the RENDERER stamps
// (imported at the top of this file, never retyped), so the words the document
// prints and the words the gate demands are the same string by construction.
//
// WHICH DOCUMENT EACH CHECK JUDGES — this is the part worth reading twice.
// There are two documents at this point: the ROW IN THE DATABASE, and the
// DOCUMENT A PROSPECT ACTUALLY READS, which is that row after
// `enforceColdAuditLaws` has lifted out-of-scope sentences, hedged unmeasured
// claims, stamped the six questions and repaired the close. Picking the wrong one
// breaks the gate in one of two ways:
//   · judge honesty on the REPAIRED copy only, and the checks go vacuous — the
//     repair is the thing making them pass, so they can never fire;
//   · judge it on the RAW row, and a perfectly good document gets blocked over a
//     sentence no reader will ever see. At 11pm that is a gate that gets
//     commented out, and then nothing is enforced at all.
// So the split is:
//   · FATAL is reserved for what SURVIVES the repair — what the prospect reads.
//     Finding TITLES are the sharp end: the repair never touches them.
//   · A row that merely NEEDED repairing earns ONE WARNING that says "regenerate
//     this audit so the saved row matches the document", and blocks nothing.
// The one exception is the disclosure grade, which is judged on the raw row: a
// grade is not prose, no renderer repairs it, and it is the single fact that
// cannot be allowed through.

/** Same verdict shape as `assertPackValid`, deliberately: a route that already
 *  renders one verdict can render the other with no new code. */
export type ValidationAssertion = PackAssertion;

// ── pre-sale helpers ──────────────────────────────────────────────────────────

/** The prose fields of one cold-audit finding — the pre-sale twin of leakProse().
 *  All three are model-authored and all three are printed, so all three are held
 *  to the same rules. `title` matters most: it is the only one the render-time
 *  repair leaves alone, which makes it the place a violation actually survives. */
function findingProse(f: ColdAuditFinding): string[] {
  return [f.title, f.problem, f.whyItCosts].filter((s): s is string => Boolean(s?.trim()));
}

/** Every model-authored passage in a cold audit, each tagged with a plain-English
 *  location so a failure message can say WHERE to go and fix it — "finding 2" is
 *  an instruction, "somewhere in the report" is a scavenger hunt. */
function coldAuditProse(r: ColdAuditReport): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const push = (where: string, text: string | null | undefined) => {
    if (text && text.trim()) out.push({ where, text });
  };
  push("the headline", r.headline);
  push("the intro", r.intro);
  push("the headline-cost block", r.headlineCost);
  (r.findings ?? []).forEach((f, i) => {
    const at = `finding ${i + 1}`;
    push(`${at} (title)`, f.title);
    push(`${at} (problem)`, f.problem);
    push(`${at} (what it's costing)`, f.whyItCosts);
  });
  (r.deeperLeakQuestions ?? []).forEach((q, i) => push(`question ${i + 1}`, q));
  push("the close", r.closingCta?.message);
  push("the performance readout", r.performance?.readout);
  return out;
}

/** The words a reader sees, with the markup taken out. Used ONLY to ask "is this
 *  sanctioned sentence on the page" — the CTA rule itself lives in agent C's
 *  `countCallsToAction`, and is called rather than reimplemented. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Dollar amounts written WITHOUT the currency marker in front of them.
 *
 *  The money law is "CAD $1,290" — the marker leads the figure, everywhere. The
 *  governed math frames already comply (they are built by `cad()`); this catches
 *  a bare "$1,290" typed by the model. Warning-level, because an unmarked figure
 *  is ambiguous rather than untrue, and a document is not worth blocking over a
 *  three-letter prefix at 11pm. */
function unmarkedDollarFigures(text: string): string[] {
  const out: string[] = [];
  const re = /\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Five characters is enough to hold "CAD" plus the space(s) `cad()` emits.
    if (!/CAD\s*$/.test(text.slice(Math.max(0, m.index - 5), m.index))) out.push(m[0]);
  }
  return out;
}

/** Trim a quoted passage so a failure message stays readable in a log line. */
function snip(s: string, n = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Validate a cold audit (the free, pre-sale document). PURE — returns checks,
 *  never throws, never decides; `assertColdAuditValid` states the verdict.
 *
 *  @param report   the stored/generated audit
 *  @param rendered the HTML deliverable, if the caller has already built it.
 *                  Optional purely to save the work: when it is omitted this
 *                  renders the document itself, so the frame / pivot / CTA rules
 *                  are checked at every entry point rather than only where
 *                  somebody remembered to pass the page in. Pass the output of
 *                  `renderColdAuditHtml` and nothing else — the link count is
 *                  read off it, and another surface's markup would be counted as
 *                  if it were this document's. */
export function validateColdAudit(
  report: ColdAuditReport,
  rendered?: string
): ValidationResult {
  const checks: LawCheck[] = [];
  const add = (law: string, level: CheckLevel, message: string) =>
    checks.push({ id: checkId(law, message), law, level, message });

  const findings = report.findings ?? [];
  const disclosed = findings.filter((f) => f.evidenceGrade === "disclosed");

  // Note the test is `=== "disclosed"`, not a defaulted grade: a MISSING grade on
  // a pre-Phase-1 cold audit means nobody stamped one, which is the normal state
  // of every audit written before this existed — not evidence of a disclosure.
  // The default-to-inferred rule the pack validator applies is about how flatly a
  // sentence may be WRITTEN; this check is about where a fact CAME FROM, and an
  // absent field is not a claim that the client told us anything.
  if (disclosed.length)
    add(
      "Evidence grade · nothing disclosed pre-sale",
      "fail",
      `${disclosed.length}/${findings.length} cold-audit finding(s) are graded "disclosed": ${disclosed
        .map((f) => f.title)
        .slice(0, 3)
        .join(
          ", "
        )}. Nothing has been disclosed before the sale — no intake form, no kickoff call — so this is post-sale data on a pre-sale document, not a wording problem. Regenerate the audit from the scan alone.`
    );
  else
    add(
      "Evidence grade · nothing disclosed pre-sale",
      "pass",
      `All ${findings.length} finding(s) rest on the scan — nothing is presented as client-disclosed.`
    );

  // ── Build the document the prospect will actually read ──────────────────────
  // `enforceColdAuditLaws` is what every surface runs before printing — the HTML
  // deliverable, the plaintext copy button and the public teaser page all call it.
  // So this is not "a repaired copy for the validator's convenience": it is the
  // document, and judging anything else would be judging something nobody sends.
  let shipped = report;
  let renderFault = "";
  try {
    shipped = enforceColdAuditLaws(report);
  } catch (err) {
    renderFault = err instanceof Error ? err.message : String(err);
  }

  // The rendered page, for the three rules that are properties of the DOCUMENT
  // rather than of the data: is the frame on it, are the six questions on it, and
  // how many ways does it give the reader to respond. Rendered here when the
  // caller has not already done it, so those rules are checked at EVERY entry
  // point rather than only on the export path.
  let html = rendered ?? "";
  if (!rendered && !renderFault) {
    try {
      html = renderColdAuditHtml(report);
    } catch (err) {
      renderFault = err instanceof Error ? err.message : String(err);
    }
  }

  if (renderFault) {
    // A caller-supplied page is dropped too. `renderColdAuditHtml` runs the same
    // enforcement that just threw, so whatever was passed in cannot have come
    // from this report — checking against it would be checking the wrong page.
    html = "";
    add(
      "Render · the document builds at all",
      "fail",
      `This audit cannot be turned into a document — the renderer threw "${snip(
        renderFault
      )}". The rules that read the page (the frame, the six questions, the calls to action) could not run at all, so a clean result below does NOT mean the rest is clean. Regenerate the audit for this business; if a regenerated one throws the same way, the stored JSON is malformed and the row should be replaced rather than patched.`
    );
  } else
    add(
      "Render · the document builds at all",
      "pass",
      "The audit renders, so the frame, the questions and the calls to action were checked against the page a prospect would actually receive."
    );

  const page = html ? visibleText(html) : "";
  const shippedFindings = shipped.findings ?? [];
  const shippedQuestions = shipped.deeperLeakQuestions ?? [];

  // ── E2 · Evidence grade · nothing INFERRED is written declaratively ──────────
  // FATAL, and the pre-sale half of the rule the paid pack has carried since
  // Phase 1 (see "Evidence grade · no declarative inference" above). Both
  // artifacts are now held to it, and both read a MISSING grade as "inferred":
  // an unstamped finding is one whose provenance nobody recorded, and "nobody
  // recorded it" must never be the reason a sentence gets to sound measured. A
  // gate has to under-claim.
  //
  // NOT A CONTRADICTION OF THE DISCLOSURE CHECK ABOVE, which deliberately tests
  // `=== "disclosed"` rather than a defaulted grade. Two different questions:
  // that one asks where a fact CAME FROM (an absent field is not a claim that the
  // client told us anything), this one asks how flatly it may be WRITTEN (an
  // absent field is not permission to write it as fact). Do not "reconcile" them.
  //
  // Observed and disclosed findings are exempt by grade — hedging something we
  // measured makes the whole document read as guesswork. A disclosed finding is
  // not being let off: it is already fatal on the check above.
  const inferredFindings = shippedFindings
    .map((f, i) => ({ f, at: `finding ${i + 1}` }))
    .filter(({ f }) => (f.evidenceGrade ?? "inferred") === "inferred");
  if (inferredFindings.length) {
    const declarative: string[] = [];
    for (const { f, at } of inferredFindings) {
      // Labelled per field, so the failure names the line to edit rather than
      // making him search three fields of five findings for a quoted fragment.
      const fields: [string, string][] = [
        [`${at} (title)`, f.title],
        [`${at} (problem)`, f.problem],
        [`${at} (what it's costing)`, f.whyItCosts],
      ];
      for (const [where, text] of fields) {
        if (!text?.trim()) continue;
        const lint = flatAssertionLint(text, { grade: "inferred" });
        if (!lint.ok) declarative.push(`${where}: "${snip(lint.hits[0], 80)}"`);
      }
    }
    if (declarative.length)
      add(
        "Evidence grade · no declarative inference",
        "fail",
        `${declarative.length} passage(s) on a finding we never measured state an internal behaviour as flat fact: ${Array.from(
          new Set(declarative)
        )
          .slice(0, 3)
          .join(
            " | "
          )}. Anything listed as a TITLE is there because the render-time softener does not touch titles — rewrite it as a pattern rather than a verdict ("Nothing visible catches a call you can't take", not "Nobody calls them back"). Anything else means the softener was bypassed, so regenerate the audit. Do not stamp the finding "observed" to silence this: that grade says we measured it, and we did not.`
      );
    else
      add(
        "Evidence grade · no declarative inference",
        "pass",
        `All ${inferredFindings.length} unmeasured finding(s) read as a pattern, not as something we observed.`
      );
  }

  // ── Frame · the outside is the smaller half, and the page says so ────────────
  // FATAL. The frame is the honesty move the whole Phase 4 document rests on: a
  // scan reads public pages, which is the smaller half of why a local business
  // loses work, and the reader is told that BEFORE any finding lands. Without it
  // the six questions later read as us moving the goalposts; with it they read as
  // the obvious next step. It is rendered from a constant, so a failure here means
  // a surface stopped printing that constant — not that a word got reworded.
  if (page) {
    const missing = [OUTSIDE_INSIDE_FRAME.lead, OUTSIDE_INSIDE_FRAME.body].filter(
      (s) => !page.includes(s)
    );
    if (missing.length)
      add(
        "Frame · the outside is the smaller half",
        "fail",
        `The outside/inside frame is missing from the document (${missing.length} of its 2 sentences absent). Without it the six questions further down read as a bait-and-switch instead of the obvious next step. The frame is stamped as OUTSIDE_INSIDE_FRAME in src/lib/exporters/cold-audit-html.ts and printed near the top of the page — restore the block that prints it. Do not retype the sentences anywhere else; there is meant to be exactly one copy.`
      );
    else
      add(
        "Frame · the outside is the smaller half",
        "pass",
        "The document says the scan is the smaller half of the problem, before the first finding."
      );

    // The scan section's own heading is the other half of the same argument —
    // what follows is what a SCAN can see. Warning rather than fatal: its absence
    // costs the reader a signpost, not the truth.
    if (!page.includes(SCAN_SECTION_LABEL))
      add(
        "Frame · the outside is the smaller half",
        "warn",
        `The findings are not introduced by their heading ("${SCAN_SECTION_LABEL}"). The frame promises a smaller half and this is the label that delivers it — restore SCAN_SECTION_LABEL above the findings.`
      );
  }

  // ── Pivot · the invisible six are ASKED, never asserted ──────────────────────
  // FATAL, and this is the highest-value string set in the document. The prospect
  // reads these six phrases here and then HEARS THE SAME WORDS out of his mouth on
  // the Zoom; that match is the entire effect, and it is why they are constants
  // rather than something a model writes.
  //
  // Two halves, both mechanical:
  //   (a) all six are ON the document — in the question list every surface prints
  //       (deeperLeakQuestions) AND on the rendered page;
  //   (b) none of the six appears inside a FINDING. We have measured none of them.
  //       Asserting one on a document sent to someone we have never spoken to is
  //       inventing a fact about the inside of their business.
  const absentFromQuestions = PIVOT_LEAK_PHRASES.filter(
    (p) => !shippedQuestions.some((q) => q.toLowerCase().includes(p))
  );
  const absentFromPage = page ? PIVOT_LEAK_PHRASES.filter((p) => !page.toLowerCase().includes(p)) : [];
  const assertedAsFinding = shippedFindings.flatMap((f) =>
    findingProse(f).flatMap((text) =>
      PIVOT_LEAK_PHRASES.filter((p) => text.toLowerCase().includes(p)).map(
        (p) => `"${p}" in "${snip(f.title, 50)}"`
      )
    )
  );
  if (absentFromQuestions.length || absentFromPage.length || assertedAsFinding.length) {
    const parts: string[] = [];
    if (absentFromQuestions.length)
      parts.push(
        `${absentFromQuestions.length} of the six are missing from the question list every surface prints (${absentFromQuestions
          .map((p) => `"${p}"`)
          .join(", ")})`
      );
    if (absentFromPage.length)
      parts.push(
        `${absentFromPage.length} are missing from the rendered page (${absentFromPage
          .map((p) => `"${p}"`)
          .join(", ")})`
      );
    if (assertedAsFinding.length)
      parts.push(
        `${assertedAsFinding.length} are stated as a FINDING rather than asked as a question (${Array.from(
          new Set(assertedAsFinding)
        )
          .slice(0, 3)
          .join(", ")})`
      );
    add(
      "Pivot · the invisible six are asked, never asserted",
      "fail",
      `${parts.join(
        "; "
      )}. He says these six out loud on the Zoom and the prospect has to have read the same words here — that match is the whole point of the section. They are stamped as PIVOT_LEAK_PHRASES in src/lib/exporters/cold-audit-html.ts. If one is missing, restore the block that prints "${PIVOT_SECTION_LABEL}"; if one is stated as a finding, move it back into the question list, because we have measured none of them.`
    );
  } else
    add(
      "Pivot · the invisible six are asked, never asserted",
      "pass",
      "All six invisible leaks are on the document in his own words, and every one of them is a question."
    );

  // ── Close · one booking CTA, and no second way to respond ────────────────────
  // FATAL. Two ways a close breaks the handoff, and both are counted rather than
  // assumed: a SECOND link, or a second ASK in the prose ("just reply", "give me a
  // call"). The second one is not a friendlier close — it is a way for the
  // prospect not to book.
  //
  // WHY A MISSING BUTTON IS A WARNING AND NOT A FAILURE. Whether a link renders at
  // all is decided by NEXT_PUBLIC_BOOKING_URL, not by the document: with no URL
  // configured the renderer deliberately prints the close as plain text, because
  // shipping a dead button to a prospect is worse than shipping none. Blocking on
  // a config value would take out every audit in every environment where it isn't
  // set — including the verification suite — over something no regeneration can
  // fix. So an unconfigured booking URL is reported loudly, once, and blocks
  // nothing; everything the DOCUMENT controls stays fatal.
  if (html) {
    const cta = countCallsToAction(html);
    const closeText = shipped.closingCta?.message?.trim() ?? "";
    const ctaFails: string[] = [];
    if (cta.secondaryAsks.length) {
      // countCallsToAction reads the whole visible page, so it finds a competing
      // ask wherever it is — and it is usually NOT in the close, because the close
      // is the one field the render-time repair replaces outright. Locating it
      // here turns "somewhere on the page" into a field name.
      const prose = coldAuditProse(shipped);
      const located = cta.secondaryAsks.map((ask) => {
        const home = prose.find(({ text }) => text.includes(ask.trim()));
        return `${home ? home.where : "the page"}: "${snip(ask, 70)}"`;
      });
      ctaFails.push(
        `${cta.secondaryAsks.length} other way(s) to respond appear on the page — ${located
          .slice(0, 2)
          .join(", ")}`
      );
    }
    if (!closeText) ctaFails.push("the close has no message at all, so the button has no reason to be pressed");
    if (BOOKING_URL) {
      if (cta.links !== 1 || cta.bookingLinks !== 1)
        ctaFails.push(
          `the page carries ${cta.links} link(s), ${cta.bookingLinks} of them pointing at the booking URL — it must carry exactly one, and that one must book the call`
        );
    } else if (cta.links > 0) {
      ctaFails.push(
        `the page carries ${cta.links} link(s) even though no booking URL is configured — a link that is not the booking link is a way not to book`
      );
    }
    if (ctaFails.length)
      add(
        "Close · one booking CTA",
        "fail",
        `${ctaFails.join(
          "; "
        )}. One ask, one link, one next step: this document's only job is to earn the 15-minute call, and a second way to answer is not a friendlier close — it is a way for the prospect not to book. Delete the alternative ask from the field named above (the sanctioned close is COLD_AUDIT_CTA_FALLBACK in src/lib/exporters/cold-audit-html.ts), and leave exactly one booking button on the page.`
      );
    else if (!BOOKING_URL)
      add(
        "Close · one booking CTA",
        "warn",
        `The document has no booking button, because NEXT_PUBLIC_BOOKING_URL is not configured in this environment. The close still reads correctly and nothing is blocked, but every audit sent from here asks the prospect to book the call and then gives them nowhere to do it. Set NEXT_PUBLIC_BOOKING_URL to the GoHighLevel booking page before sending one.`
      );
    else
      add(
        "Close · one booking CTA",
        "pass",
        "Exactly one call to action, it points at the booking page, and nothing else on the page offers another way to respond."
      );
  }

  // ── Scope · no lead gen, ads, SEO or website rebuild, anywhere ───────────────
  // FATAL. He sells conversion of demand that already exists, and he does not
  // build websites — every site finding in this document is advisory. A single
  // sentence recommending SEO or a redesign reframes the whole thing as a
  // web-design pitch and costs him the call.
  //
  // The test is agent C's `outOfScopeHits`, called and never re-implemented. It is
  // recommendation-shaped and negation-aware on purpose: "we do not rebuild
  // websites" and "that is out of scope by design" are his positioning and must
  // survive, while "you should invest in SEO" must not. A second, blunter word
  // list in here would flag his best sentences — which is exactly the failure this
  // whole file exists to avoid.
  // `outOfScopeHits` (the RULE) applied over `coldAuditProse` (this file's field
  // list, which is a superset of the one agent C's `scopeViolations` walks — it
  // adds the performance readout, so "anywhere" means anywhere). The rule itself
  // is never re-implemented here; only the field labels are ours, so a failure can
  // say which line to open.
  const strays = coldAuditProse(shipped).flatMap(({ where, text }) =>
    outOfScopeHits(text).map((sentence) => ({ where, sentence }))
  );
  if (strays.length)
    add(
      "Scope · no lead gen, ads, SEO or website work",
      "fail",
      `${strays.length} sentence(s) recommend work we do not sell: ${strays
        .slice(0, 3)
        .map(({ where, sentence }) => `${where}: "${snip(sentence, 90)}"`)
        .join(
          " | "
        )}. Anything listed as a TITLE is there because the render-time sweep strips out-of-scope sentences from the body but not from titles. Rewrite it so it describes what is happening rather than prescribing traffic or a rebuild, or regenerate the audit. Do not soften the rule: he sells conversion of demand that already exists, and a prospect who reads one of these sentences thinks he is being pitched a website.`
    );
  else
    add(
      "Scope · no lead gen, ads, SEO or website work",
      "pass",
      "Nothing in the document recommends ads, SEO, lead generation or a new website."
    );

  // ── Money · every figure is a labelled benchmark ─────────────────────────────
  // FATAL. We have never seen this business's books. Every dollar figure on a cold
  // audit is therefore an industry rate applied to an ASSUMED volume, and it has
  // to say so beside the number — in the same sentence, not in a footnote nobody
  // reads. The governed math frames already do ("assuming 20 enquiries a month —
  // our assumption, not a number we measured"); this is what catches a figure the
  // model typed itself.
  //
  // ASSUMPTION_LABELS is the SAME list the paid pack's dollar check uses, a few
  // hundred lines above. One document may not have a looser idea of "labelled"
  // than the other, so there is one list and both read it.
  const dollarSentences = coldAuditProse(shipped).flatMap(({ where, text }) =>
    sentencesOf(text)
      .filter((s) => DOLLAR_FIGURE.test(s))
      .map((s) => ({ where, sentence: s }))
  );
  const unlabelled = dollarSentences.filter(
    ({ sentence }) => !ASSUMPTION_LABELS.some((re) => re.test(sentence))
  );
  // A figure credited to the CLIENT is its own, worse failure: pre-sale there is
  // no client number to credit. It is separated out because the fix is different —
  // you cannot label your way out of it, the sentence describes a conversation
  // that never happened.
  const clientCredited = dollarSentences.filter(({ sentence }) =>
    CLIENT_SOURCED_LABELS.some((re) => re.test(sentence))
  );
  if (!dollarSentences.length)
    add(
      "Money · every figure is a labelled benchmark",
      "pass",
      "The document prints no dollar figure, so there is nothing to mislabel."
    );
  else if (unlabelled.length)
    add(
      "Money · every figure is a labelled benchmark",
      "fail",
      `${unlabelled.length} of ${dollarSentences.length} dollar sentence(s) print a figure without saying in the same sentence where it came from: ${unlabelled
        .slice(0, 2)
        .map(({ where, sentence }) => `${where}: "${snip(sentence, 90)}"`)
        .join(
          " | "
        )}. A cold audit has never seen their books, so every figure on it is an industry benchmark over an assumed volume and must say so beside the number ("assuming 20 enquiries a month — ${ASSUMPTION_CAVEAT}"). Put the assumption in the same sentence as the number, or take the number out.`
    );
  else
    add(
      "Money · every figure is a labelled benchmark",
      "pass",
      `All ${dollarSentences.length} dollar sentence(s) name the assumption or benchmark behind the figure, in the same sentence.`
    );

  if (clientCredited.length)
    add(
      "Money · no figure is credited to the client",
      "fail",
      `${clientCredited.length} dollar sentence(s) credit the figure to the prospect ("based on the numbers you provided" or similar): ${clientCredited
        .slice(0, 2)
        .map(({ where, sentence }) => `${where}: "${snip(sentence, 90)}"`)
        .join(
          " | "
        )}. Nobody has given us a number — there has been no intake form and no kickoff call — so this sentence describes a conversation that never happened, and the prospect knows it did not. This cannot be fixed by relabelling: regenerate the audit, and check why a REAL-mode math frame reached a pre-sale document.`
    );
  else if (dollarSentences.length)
    add(
      "Money · no figure is credited to the client",
      "pass",
      "No figure is presented as something the prospect told us."
    );

  // ── Money · the CAD marker leads the figure ──────────────────────────────────
  // WARNING. The house rule is "CAD $1,290" — marker first, everywhere. `cad()`
  // already complies, so a hit here is a figure the model typed. An unmarked
  // figure is ambiguous rather than untrue, and this document is not worth
  // blocking over three missing letters at 11pm — but he should know before he
  // sends it, because a Canadian owner reading a bare "$" assumes US dollars.
  const unmarked = coldAuditProse(shipped).flatMap(({ where, text }) =>
    unmarkedDollarFigures(text).map((fig) => `${where}: "${fig}"`)
  );
  if (unmarked.length)
    add(
      "Money · the CAD marker leads the figure",
      "warn",
      `${unmarked.length} figure(s) are written without the currency marker in front: ${Array.from(
        new Set(unmarked)
      )
        .slice(0, 3)
        .join(
          ", "
        )}. Every figure we quote is Canadian and says so before the number — write "CAD $1,290", not "$1,290". Regenerate, or fix the wording before sending.`
    );

  // ── Stored row · matches the document it renders ─────────────────────────────
  // WARNING, ALWAYS, AND DELIBERATELY NEVER FATAL. Everything above judges what a
  // prospect reads. This one judges the ROW, and reports the gap between the two:
  // repairs the render boundary had to make on the way out. The document that gets
  // sent is already correct, so blocking would be blocking over a problem the
  // reader will never encounter — but a row that needs repairing every time it is
  // opened is a row that should be regenerated, and nobody would ever find that
  // out without being told.
  if (!renderFault) {
    const repairs: string[] = [];
    if (scopeViolations(report).length && !scopeViolations(shipped).length)
      repairs.push(
        `${scopeViolations(report).length} out-of-scope sentence(s) were lifted out at render`
      );
    if (PIVOT_LEAK_PHRASES.some((p) => !(report.deeperLeakQuestions ?? []).some((q) => q.toLowerCase().includes(p))))
      repairs.push("the six invisible leaks were stamped in at render — the row predates them");
    if ((report.closingCta?.message ?? "") !== (shipped.closingCta?.message ?? ""))
      repairs.push("the close was replaced at render");
    if ((report.headline ?? "") !== shipped.headline || (report.intro ?? "") !== shipped.intro)
      repairs.push("the header was replaced at render");
    if ((report.headlineCost ?? "") !== shipped.headlineCost)
      // Two different repairs land on this branch — a missing/out-of-scope block
      // gets swapped for the fallback, and a bare figure gets its benchmark label
      // appended — so the wording covers both rather than guessing which.
      repairs.push("the headline-cost block was replaced or relabelled at render");
    const prosePatched = (report.findings ?? []).filter((f, i) => {
      const after = shippedFindings[i];
      return after && (f.problem !== after.problem || f.whyItCosts !== after.whyItCosts);
    }).length;
    if (prosePatched) repairs.push(`${prosePatched} finding(s) had claims softened at render`);
    if (repairs.length)
      add(
        "Stored row · matches the document it renders",
        "warn",
        `The saved audit is not what gets sent — ${repairs.join(
          "; "
        )}. Nothing is blocked: the document a prospect receives is already correct. But the row is stale, and anything reading the JSON directly (an export, a copy-paste, a future surface) would get the unrepaired version. Regenerate this audit so the two agree.`
      );
    else
      add(
        "Stored row · matches the document it renders",
        "pass",
        "The saved row and the document it renders are the same thing — no repairs were needed on the way out."
      );
  }

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  return { checks, fails, warns, passed: fails === 0 };
}

/**
 * Enforcing wrapper around validateColdAudit — the pre-sale twin of
 * `assertPackValid`. Fatal = any check at level "fail"; like its twin it returns
 * the verdict rather than throwing, so a route can turn it into an
 * operator-facing message instead of a generic 500.
 *
 *   const verdict = assertColdAuditValid(report);
 *   if (!verdict.ok) return NextResponse.json({ error: verdict.report }, { status: 422 });
 *
 * @param rendered same optional page as `validateColdAudit` — pass it on the
 *                 export path, where it has already been built.
 */
export function assertColdAuditValid(
  report: ColdAuditReport,
  rendered?: string
): ValidationAssertion {
  const result = validateColdAudit(report, rendered);
  const fails = result.checks.filter((c) => c.level === "fail");
  const warns = result.checks.filter((c) => c.level === "warn");
  return {
    ok: fails.length === 0,
    fails,
    warns,
    report: formatValidation(result),
  } as ValidationAssertion;
}

/** THE READ-PATH GATE. Run this wherever a STORED cold audit is loaded back out
 *  of the database and shown to anyone — including the public /a/<publicId>
 *  teaser a prospect opens.
 *
 *  WHY IT IS SCOPED, AND WHY THAT IS NOT A WEAKENING. An unscoped throw here
 *  would judge rows written before evidence grades existed — audits whose
 *  findings carry no grade at all — against a rule they predate, and take out
 *  pages that were fine. So the gate only engages once there is something to
 *  judge: if ANY finding carries a grade, the row was generated post-Phase-1 and
 *  is held to the full rule. If none do, it is a legacy row and we skip, silently
 *  and by design.
 *
 *  THE SCOPING STILL EARNS ITS KEEP AFTER PHASE 4, and the reason is worth
 *  writing down. The pre-sale suite now reads a MISSING evidence grade as
 *  "inferred", which is the right strictness for a gate — but an ungraded row is
 *  every audit written before grades existed, and holding those to the
 *  no-declarative-inference rule would fail a page that was fine on the day it
 *  was written. The Phase 4 reframe rules are still enforced on every audit at
 *  the generation and export boundaries, where a failure costs a regeneration
 *  instead of a dead link a prospect is holding.
 *
 *  The alternative was leaving assertColdAuditValid exported and uncalled, which
 *  is how a guarantee rots: it reads like enforcement, it passes review, and it
 *  has never once run. A scoped live gate is worth more than an unscoped dormant
 *  one.
 *
 *  Throws rather than filtering the offending finding out: a pre-sale document
 *  containing something the prospect supposedly disclosed is a breach of the
 *  Phase 1 guarantee, and quietly repairing it at render time would hide the bug
 *  from the only person who can fix it. */
export function assertStoredColdAuditSafe(report: ColdAuditReport, at: string): void {
  const graded = (report.findings ?? []).some((f) => f.evidenceGrade !== undefined);
  if (!graded) return; // pre-Phase-1 row — nothing to judge, skip silently

  const verdict = assertColdAuditValid(report);
  if (verdict.ok) return;

  // The FIRST failing check's message leads the error, because that message is the
  // one written to be acted on. A bare list of law names tells the operator that
  // something is wrong and nothing about what to do next, and this error surfaces
  // on a page a prospect may be waiting on.
  throw new Error(
    `Stored cold audit (${at}) fails ${verdict.fails.length} governance check(s) on read: ` +
      `${verdict.fails.map((f) => f.law).join(", ")}. This row carries evidence grades, so it ` +
      `was generated after the Phase 1 rules landed and is held to them. Regenerate the audit ` +
      `for this business — do not strip the grade to silence this.\n\nFirst failure — ` +
      `${verdict.fails[0].law}: ${verdict.fails[0].message}\n\n${verdict.report}`
  );
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
