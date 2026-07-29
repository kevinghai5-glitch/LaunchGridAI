// Cold Audit HTML renderer.
//
// WHAT THIS DOCUMENT IS NOW (Phase 4). It used to be the thing that closed the
// deal. It isn't any more. The order of the sale is: cold call → the prospect
// books a 15-minute Zoom → this document lands in their inbox BEFORE the Zoom →
// on the Zoom it is a 2-3 MINUTE CREDIBILITY BEAT, and then the conversation
// moves to how enquiries are actually handled inside the business, where the
// money really is.
//
// So this document has exactly one job: prove we looked, prove we can count, and
// EARN THE RIGHT TO ASK QUESTIONS. It is not trying to close anybody. Everything
// below follows from that — the outside/inside frame near the top, the fixed
// question set in the owner's own phone words, and the single booking CTA.
//
// It matches the paid deliverable design system so free and paid feel like one
// brand: restrained, premium, light / consulting-grade. No external assets — CSS
// is inlined. The embedded screenshot (signed ScreenshotOne URL) loads from the
// network when opened online; if it fails it gracefully hides.
//
// HARD RESTRAINT BUDGET: only the tokens below; no color outside this list (no
// blue); ZERO gradients; ONE subtle shadow token; hairline borders preferred;
// exactly ONE reveal-on-scroll animation (this is presented live), reduced-motion
// safe; no hover-lift.

import type { ColdAuditReport, ColdAuditFinding, EvidenceGrade } from "@/types";
import {
  softenFlatAssertions,
  attributesToClient,
  ASSUMPTION_CAVEAT,
} from "../leak-narrative";
import { BOOKING_URL } from "../constants";

// ── Law enforcement (deterministic, not prompt-dependent) ───────────────────
// The generation prompt asks the model to follow the cold-audit laws, but a
// prompt can't GUARANTEE compliance — the model drifts and older saved audits
// predate the rules. So we hard-enforce the laws that are mechanically checkable
// on the data itself, at every output boundary (HTML render, plaintext copy,
// and generation). This is what makes a forbidden line impossible to ship.

// ── C1 · THE OUTSIDE/INSIDE FRAME ────────────────────────────────────────────
//
// THE HONESTY MOVE, AND IT GOES NEAR THE TOP. A cold scan reads public pages.
// That is genuinely the smaller half of why a local business loses work — the
// bigger half happens after someone gets in touch, inside an operation we have
// never seen and have not been told anything about.
//
// Saying so plainly, early, and before any finding lands is what makes the pivot
// on the call feel like the point of the document rather than a bait-and-switch.
// If the reader gets to the questions section without having been told the scan
// is the small half, the questions read as us moving the goalposts. Told up
// front, they read as the obvious next step — which is what they are.
//
// Written without "I" or "we" doing the seeing (it is "a scan" that looked), so
// the same words work on the emailed deliverable, the public teaser page, and the
// plaintext copy without three versions of the same paragraph drifting apart.
export const OUTSIDE_INSIDE_FRAME = {
  label: "Before you read any of this",
  lead: "Everything in this document was read from the outside — your public pages, on a scan, without anyone speaking to you. That is the smaller half of the problem.",
  body: "The bigger half sits inside how enquiries get handled once they arrive: how fast someone gets back, who chases the ones that go quiet, what happens to the people who never book. A scan cannot see any of that, and this document is not going to pretend it can. Those are the questions for the call.",
} as const;

// ── C2 · THE PIVOT — HIS SIX QUESTIONS, IN HIS OWN PHONE WORDS ───────────────
//
// THIS IS THE HIGHEST-VALUE STRING SET IN THE DOCUMENT, and the reason it is a
// hard-coded constant rather than something the model writes: the prospect reads
// these words here, and then HEARS THE SAME WORDS out of his mouth on the Zoom.
// That match is the whole effect. A model that rewords "quotes that go quiet"
// into "your proposal follow-up cadence" breaks it, and a model rewords
// something every single run.
//
// Two rules hold this together:
//   1. The six names below are the plain-language naming of the invisible leaks.
//      Not leak ids, not taxonomy names, not paraphrases — the words he says on
//      the phone. They are the only copy of these strings in the codebase.
//   2. They are printed as QUESTIONS HE WILL ASK, never as findings. We have
//      measured none of them. Asserting any of them on a document sent to
//      someone we have never spoken to would be inventing a fact about the
//      inside of their business.
export const PIVOT_LEAK_PHRASES = [
  "what happens to enquiries after hours",
  "missed calls nobody chases",
  "how fast someone actually gets back",
  "quotes that go quiet",
  "no-shows nobody rebooks",
  "past customers nobody contacts again",
] as const;

/** Each invisible leak paired with the question he actually asks about it. The
 *  `leak` side is taken from PIVOT_LEAK_PHRASES so there is exactly one copy of
 *  those six strings; the `ask` side is the same plain, owner-language question,
 *  never a diagnosis. */
export const PIVOT_QUESTIONS = [
  {
    leak: PIVOT_LEAK_PHRASES[0],
    ask: "When an enquiry lands at 9pm, what happens to it before morning?",
  },
  {
    leak: PIVOT_LEAK_PHRASES[1],
    ask: "When a call gets missed, who calls that person back — and how long do they wait?",
  },
  {
    leak: PIVOT_LEAK_PHRASES[2],
    ask: "From the moment someone reaches out, how long before a real person gets back to them?",
  },
  {
    leak: PIVOT_LEAK_PHRASES[3],
    ask: "When a quote goes out and you hear nothing back, what happens next?",
  },
  {
    leak: PIVOT_LEAK_PHRASES[4],
    ask: "When someone books and doesn't show up, who gets them back on the calendar?",
  },
  {
    leak: PIVOT_LEAK_PHRASES[5],
    ask: "When did the customers you looked after last year last hear from you?",
  },
] as const;

/** The heading over the findings. Exported for the same reason the pivot strings
 *  are: the emailed document, the plaintext copy and the public teaser page all
 *  print this heading, and three surfaces naming the same section three different
 *  ways read as three products. It is also half of the argument — what follows is
 *  what a SCAN can see, which is the half the frame above just called smaller. */
export const SCAN_SECTION_LABEL = "What a scan can see from out here";

export const PIVOT_SECTION_LABEL = "The half a scan can't see";
export const PIVOT_SECTION_INTRO =
  "Six things decide most of it, and not one of them is visible from out here. We have not measured any of them for your business — these are the questions for the call.";

/** The six pivot questions flattened to one line each: the leak in his words,
 *  then the question he asks about it. This is the form that travels to every
 *  non-HTML surface (the plaintext copy, the public teaser list), so all three
 *  surfaces ask the same six questions in the same words. */
export function pivotQuestionLines(): string[] {
  return PIVOT_QUESTIONS.map((q) => `${q.leak} — ${q.ask}`);
}

// ── C3 · ONE CALL TO ACTION, AND IT BOOKS THE CALL ───────────────────────────
//
// The close must PIVOT to the call. Two ways a document breaks that rule, and
// both are enforced below rather than asked for in a prompt:
//   · it offers FREE help instead of the call (the old Law 10), or
//   · it offers a SECOND way to respond — "just reply to this email", "give me a
//     call", "let me know" — which is not a friendlier close, it is a way for the
//     prospect not to book. One ask, one link, one next step.
export const COLD_AUDIT_CTA_FALLBACK =
  "That is the half a scan can see. The other half is six questions I can only ask you — that's what the call is for.";

/** The single booking button's label. Matches the public teaser page word for
 *  word so the emailed document and the link in it read as one thing. */
export const BOOKING_CTA_LABEL = "Book the call";

// Patterns that signal an offer of FREE help (forbidden). Carefully scoped so
// the compliant pivot ("...what it would take to fix it") is never flagged —
// we only catch the act of OFFERING to give fixes/tips/wins away.
const CTA_FREEBIE_PATTERNS: RegExp[] = [
  /\bquick (fix|fixes|win|wins|tip|tips)\b/i,
  /\bfree (fix|fixes|tip|tips|audit|sample|guide|advice|help|pointers|checklist|report)\b/i,
  /\b(share|send|give|show|hand|shoot|drop)\s+(you\s+|over\s+|you\s+over\s+)?(a\s+|some\s+|the\s+|a\s+few\s+|a\s+couple\s+(of\s+)?)?(quick\s+)?(fix|fixes|tip|tips|win|wins|advice|pointers|steps|ideas|suggestions|how-?to|walkthrough|guide|checklist)\b/i,
  /\bshow you how\b/i,
  /\bhow to (fix|improve|speed up|fix it)\b/i,
  /\b(a few|some|a couple of|a handful of)\s+(quick\s+)?(fixes|tips|pointers|ideas|suggestions|tweaks)\b/i,
  /\b(let me|i can|i'?ll|i will|happy to)\s+(fix|send|share|give|show|put together|throw together)\b/i,
];

export function ctaViolatesLaw10(message: string | null | undefined): boolean {
  if (!message) return false;
  return CTA_FREEBIE_PATTERNS.some((re) => re.test(message));
}

// A SECOND way to respond is a way not to book. These catch the polite
// alternatives a model reaches for — an email reply, a phone number, "let me
// know" — each of which quietly competes with the one button on the page.
const CTA_COMPETING_CHANNEL_PATTERNS: RegExp[] = [
  /\b(reply|replying|respond)\b[^.?!]{0,30}\b(this (email|message)|email|message|back)\b/i,
  /\bhit reply\b/i,
  /\b(email|e-mail|text|message|dm|whatsapp|ring)\s+me\b/i,
  /\bcall me\b/i,
  /\bgive me a (call|ring|shout|buzz)\b/i,
  /\bget in touch\b/i,
  /\blet me know\b/i,
  /\bfeel free to\b/i,
  /\breach out to me\b/i,
];

/** True when the close offers a way to respond OTHER than booking the call. */
export function ctaOffersCompetingChannel(message: string | null | undefined): boolean {
  if (!message) return false;
  return CTA_COMPETING_CHANNEL_PATTERNS.some((re) => re.test(message));
}

// ── C6 · WE DO NOT SELL TRAFFIC, AND WE DO NOT REBUILD WEBSITES ──────────────
//
// He sells conversion of demand that already exists. No ads, no SEO, no "more
// leads", and he does not build or rebuild websites — every site finding in here
// is ADVISORY, the place where an acquisition-system leak happens to be visible.
// A single sentence recommending SEO or a redesign re-frames the whole document
// as a web-design pitch and costs him the call.
//
// The patterns are RECOMMENDATION-SHAPED on purpose. "This isn't an SEO problem"
// is a good sentence and must survive; "you should invest in SEO" must not. So a
// bare mention never matches — only a mention someone is being told to act on.
const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // being told to buy/do traffic work
  /\b(invest in|spend (more )?on|run|running|start|starting|launch|launching|consider|look into|try|need|needs|should get|get)\s+(some\s+|more\s+|a\s+)?(google\s+|facebook\s+|paid\s+)?(ads?|adwords|ppc|paid search|seo|search engine optimi[sz]ation|lead gen(eration)?|lead-gen)\b/i,
  // being told to go get more demand
  /\b(drive|generate|get|bring in|attract|boost|increase)\s+(more\s+|new\s+)?(traffic|visitors|leads|enquiries|inquiries|visibility|rankings?|impressions)\b/i,
  // being told to rebuild the site
  /\b(redesign|re-?design|rebuild|re-?build|redo|revamp|overhaul|refresh|moderni[sz]e)\s+(your\s+|the\s+|their\s+)?(website|web ?site|site|homepage|home page|pages?)\b/i,
  /\b(a\s+)?(new|fresh)\s+(website|web ?site|homepage)\b/i,
  /\bwebsite (redesign|rebuild|refresh|overhaul)\b/i,
  /\b(rank|ranking) (higher|better)\b/i,
];

// A NEGATED MENTION IS THE OPPOSITE OF A VIOLATION, AND WE NEARLY DELETED HIS
// BEST LINE OVER IT. Running the patterns above across the committed golden pack
// produced exactly two hits, and both were sentences saying we DON'T do the
// thing: "We do not need a new website." and "It does not cover how to get more
// enquiries, which is out of scope for this engagement by design." Those
// sentences are his positioning — they are the reason a prospect stops worrying
// that this is a web-design pitch — and a sweep that removes them does more
// damage than the sweep prevents.
//
// So a sentence only counts as out of scope when it PRESCRIBES the thing. Say it
// is not what we do, say it is not needed, say it is out of scope: all fine.
const SCOPE_NEGATION_PATTERNS: RegExp[] = [
  /\b\w+n['’]t\b/i, // don't, doesn't, isn't, won't, can't, shouldn't
  /\b(do|does|did|is|are|was|were|will|would|can|could|should|need|needs)\s+not\b/i,
  /\bno need (for|to)\b/i,
  /\bnot (a|an|the|about|what|how|your|our|something|going|here)\b/i,
  /\bnever\b/i,
  /\bout of scope\b/i,
  /\b(instead of|rather than|as opposed to)\b/i,
  /\bnothing to do with\b/i,
];

/** Sentences in this text that recommend lead gen, ads, SEO, or a site rebuild.
 *  A sentence that NEGATES the thing ("we don't rebuild websites") is not a hit —
 *  see SCOPE_NEGATION_PATTERNS.
 *
 *  Exported so the verification script can assert on it directly, and so the
 *  generator can be told exactly which sentence to rewrite. */
export function outOfScopeHits(text: string | null | undefined): string[] {
  if (!text) return [];
  return splitSentences(text).filter(
    (s) =>
      OUT_OF_SCOPE_PATTERNS.some((re) => re.test(s)) &&
      !SCOPE_NEGATION_PATTERNS.some((re) => re.test(s))
  );
}

/** Every out-of-scope sentence anywhere in a report. Empty on a clean audit. */
export function scopeViolations(report: ColdAuditReport): string[] {
  const parts = [
    report.headline,
    report.intro,
    report.headlineCost,
    ...(report.findings ?? []).flatMap((f) => [f.title, f.problem, f.whyItCosts]),
    ...(report.deeperLeakQuestions ?? []),
    report.closingCta?.message,
  ];
  return parts.flatMap((p) => outOfScopeHits(p));
}

/** Split on sentence boundaries, keeping the terminator. Used by the scope
 *  sweep so a single stray recommendation can be lifted out without taking the
 *  surrounding paragraph with it. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Drop the out-of-scope sentences and keep the rest. Returns "" when the whole
 *  passage was out of scope — the caller decides what that means. Reads the same
 *  hit list the detection does, so what gets flagged and what gets removed can
 *  never come apart. */
function stripOutOfScope(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const bad = new Set(outOfScopeHits(text));
  if (!bad.size) return text;
  return splitSentences(text)
    .filter((s) => !bad.has(s))
    .join(" ")
    .trim();
}

// ── C5 · EVERY DOLLAR FIGURE READS AS A BENCHMARK, NOT A MEASUREMENT ─────────
//
// The headline figure stays — it is what makes the leak feel like money rather
// than a website note. But we have never seen this business's books, so every
// figure on a cold audit is an industry benchmark run over an ASSUMED volume,
// and it has to say so beside the number, not in a footnote nobody reads.
//
// The assumption vocabulary is NOT re-invented here. leak-taxonomy's ASSUMPTIONS
// map already owns the wording (ASSUMPTION_CAVEAT — "our assumption, not a number
// we measured"), and the benchmark math frames already carry it in-sentence. This
// is only the backstop for a figure that arrived without it.

/** Any dollar amount, with or without the CAD marker. */
const MONEY_PATTERN = /(?:CAD\s*)?\$\s?\d/;

/** Wording that already tells the reader the figure is a benchmark estimate over
 *  an assumption. A frame built by computeMathEstimate always matches (it prints
 *  "assuming N enquiries a month (our assumption, not a number we measured)"),
 *  so the backstop below leaves governed figures completely untouched. */
const BENCHMARK_MARKERS: RegExp[] = [
  new RegExp(ASSUMPTION_CAVEAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  /\bassum(e|es|ing|ption)\b/i,
  /\bbenchmark\b/i,
  /\bindustry (average|rate|figure|number)\b/i,
];

/** The label appended to a bare dollar figure. Says three things in one breath:
 *  it is an industry benchmark, it is not a measurement of THEIR business, and
 *  the real number gets worked out with them on the call. */
export const BENCHMARK_FIGURE_LABEL = `That is an industry benchmark applied to a typical business of this size (${ASSUMPTION_CAVEAT}), not a measurement of yours — we run it with your real numbers on the call.`;

/** Guarantee a dollar figure reads as benchmark-derived. Idempotent: once the
 *  label is on, the text carries ASSUMPTION_CAVEAT and is skipped forever after.
 *
 *  Skips anything the client is quoted as having told us — a figure attributed to
 *  them is theirs, and relabelling it "industry benchmark" would be a lie. (That
 *  cannot legitimately occur pre-sale; the check is here so the repair can never
 *  be the thing that introduces the falsehood.) */
function labelBenchmarkFigure(text: string | null | undefined): string {
  const t = text?.trim() ?? "";
  if (!t || !MONEY_PATTERN.test(t)) return text ?? "";
  if (BENCHMARK_MARKERS.some((re) => re.test(t))) return text ?? "";
  if (attributesToClient(t)) return text ?? "";
  const terminated = /[.!?]$/.test(t) ? t : `${t}.`;
  return `${terminated} ${BENCHMARK_FIGURE_LABEL}`;
}

// Generic, on-spec deeper-leak questions used only as a fallback when the model
// returns none. They invent no business-specific data (Law 1 safe) and mirror
// the Law 3 examples: response time, follow-up, no-shows.
const DEEPER_LEAK_FALLBACK: string[] = [
  "When a lead reaches out after hours, how fast do they actually hear back? If it's the next day, you're handing them to whoever called first.",
  "What happens to the people who enquire but don't book? If no one follows up, that's revenue quietly walking out the door.",
];

// Part H2: the pipeline discovery question — always a distinct, high-value probe
// that surfaces the inquiry→client gap where the money hides. Guaranteed present
// among the deeper-leak questions so duplicated questions are replaced by it.
export const PIPELINE_DISCOVERY_QUESTION =
  "How many inquiries came in last month — and how many actually became clients? The gap between those two numbers is usually where the money is.";

// Matches a question already probing the inquiry→client pipeline, so we don't
// double up when the model already asked it.
const PIPELINE_QUESTION_SIGNATURE =
  /how many.*(inquir|enquir|lead|call).*(became|turn|convert|client|customer|book)/i;

// Part H2: dedupe deeper-leak questions to DISTINCT probes and guarantee the
// pipeline question is one of them (replacing a duplicate slot when needed).
//
// PHASE 4 NOTE — this no longer decides what the document asks. The document now
// asks the SIX FIXED QUESTIONS above (PIVOT_QUESTIONS), in his own phone words,
// because the prospect has to read the same words he then says out loud on the
// Zoom. The model still writes its own probes during generation — they are the
// sanctioned place to put an invisible leak so it stays out of the findings — and
// this is still how that free-typed set is cleaned up. It just isn't what ships.
export function distinctDeeperQuestions(raw: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const q of raw) {
    const t = q?.trim();
    if (!t) continue;
    const key = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(t);
  }
  const base = distinct.length ? distinct : [...DEEPER_LEAK_FALLBACK];
  if (base.some((q) => PIPELINE_QUESTION_SIGNATURE.test(q))) return base.slice(0, 3);
  // No pipeline probe yet: keep up to two of the strongest existing questions,
  // then append the pipeline question so it always earns a slot (cap 3).
  return [...base.slice(0, 2), PIPELINE_DISCOVERY_QUESTION].slice(0, 3);
}

// Law 6 (voice) + Defect 1: the visible header must lead with the bleed, not a
// soft "quick note / quick wins / boost visibility" opener. The page <title> is
// already loss-framed, so a stale or off-voice headline/intro contradicts it.
// These patterns catch the banned soft openers; matches are replaced with the
// loss-framed fallbacks below so the header can never ship soft.
const HEADER_SOFT_PATTERNS: RegExp[] = [
  /\bquick note\b/i,
  /\b(a\s+)?(few\s+)?quick (win|wins|fix|fixes|tip|tips)\b/i,
  /\bboost(ing)? your (visibility|presence|online presence|rankings?)\b/i,
  /\b(potential )?opportunit(y|ies) to (improve|optimi[sz]e|grow|boost)\b/i,
  /\ba (quick|brief|short) (note|look|review|thought)\b/i,
  /\b(some|a few) (opportunities|improvements|optimi[sz]ations)\b/i,
  /\bjust (a|wanted to)\b/i,
];

export function headerViolatesVoice(text: string | null | undefined): boolean {
  if (!text) return false;
  return HEADER_SOFT_PATTERNS.some((re) => re.test(text));
}

// Loss-framed header fallbacks. The intro acknowledges effort in a single clause
// WITHOUT inventing a specific metric/competitor (Law 1 safe), then pivots to the
// bleed (Law 6). businessName is interpolated by the caller.
function fallbackHeadline(businessName: string): string {
  const name = businessName?.trim() || "your business";
  return `Where ${name} is quietly losing clients`;
}
const FALLBACK_INTRO =
  "You've clearly put real work into this business — but here's where you're quietly losing clients before they ever reach out.";

// Law 2 (spend-anchored, pre-intake): the headline-cost block must ALWAYS render
// a gut-punch, but pre-intake we make ZERO claims about the client's revenue and
// never invent a lead volume or customer value. When the model returns none, fall
// back to a spend-anchored line with no fabricated figures.
const HEADLINE_COST_FALLBACK =
  "You already pay to get these leads — through ads, referrals, and the time you put into being found. Every lead that hits this gap is money you've already spent to earn someone who now slips away before they ever reach you.";

// Defect 3 + Law 6: strip hedge-STACKS from observed facts. We only collapse
// redundant double-hedges ("may potentially", "could possibly") — removing a
// single hedge risks breaking grammar, but a doubled hedge is always safe to
// thin and reads as confident once collapsed.
function dehedge(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text
    .replace(/\b(may|might|could|can)\s+(potentially|possibly|perhaps)\b/gi, "$1")
    .replace(/\b(potentially|possibly|perhaps)\s+(may|might|could|can)\b/gi, "$2")
    .replace(/\b(may|might|could)\s+(may|might|could)\b/gi, "$1")
    .replace(/\s{2,}/g, " ");
}

// Returns a corrected copy of the report with the mechanically-enforceable laws
// applied. Idempotent and non-mutating. Run at every output boundary.
//
// EVERY SURFACE ALREADY CALLS THIS — the HTML deliverable, the plaintext copy
// button, and the public teaser page — which is why the Phase 4 rules are
// enforced here rather than in the renderer. A rule that lives in one renderer is
// a rule the other two surfaces break.
export function enforceColdAuditLaws(report: ColdAuditReport): ColdAuditReport {
  const cta = report.closingCta ?? { tiedToFinding: "", message: "" };
  // C3/C6: the close must be ONE ask that hands off to the call. It gets replaced
  // when it is missing, when it offers free help, when it offers a second way to
  // respond, or when it wanders into traffic/website work we do not sell. A blank
  // close counts as missing: a booking button under a bare heading is a button
  // with no reason to press it.
  const ctaStrays =
    !cta.message?.trim() ||
    ctaViolatesLaw10(cta.message) ||
    ctaOffersCompetingChannel(cta.message) ||
    outOfScopeHits(cta.message).length > 0;
  const message = ctaStrays ? COLD_AUDIT_CTA_FALLBACK : cta.message;

  // C2: the document asks HIS six questions, always, in his words — plus the one
  // that opens the pricing conversation on the call (how many enquiries came in
  // versus how many became clients). The model's own probes are discarded here on
  // purpose: they varied every run, and a question the prospect read in a
  // different wording than the one he asks out loud is a question that lands
  // twice as weakly.
  const questions = [...pivotQuestionLines(), PIPELINE_DISCOVERY_QUESTION];

  // Defect 1 / Law 6: never let a soft or empty header reach the page.
  //
  // C6: a header that strays out of scope is REPLACED rather than trimmed. These
  // are one-liners — lifting a sentence out of a one-sentence intro leaves
  // nothing — and both already have a compliant, business-safe fallback sitting
  // right here, so the swap costs nothing.
  const headline =
    !report.headline?.trim() ||
    headerViolatesVoice(report.headline) ||
    outOfScopeHits(report.headline).length > 0
      ? fallbackHeadline(report.businessName)
      : report.headline;
  const intro =
    !report.intro?.trim() ||
    headerViolatesVoice(report.intro) ||
    outOfScopeHits(report.intro).length > 0
      ? FALLBACK_INTRO
      : report.intro;

  // Defect 2 / Law 2+8: the dollar gut-punch always renders — and C5: whatever
  // renders, if it carries a dollar figure, says in the same breath that the
  // figure is an industry benchmark rather than a measurement of this business.
  const headlineCost = labelBenchmarkFigure(
    report.headlineCost?.trim() && outOfScopeHits(report.headlineCost).length === 0
      ? report.headlineCost
      : HEADLINE_COST_FALLBACK
  );

  // Defect 3 / Law 6: thin redundant hedge-stacks in observed-fact prose.
  // Law 13 backstop: soften any flat operational assertion about an invisible
  // internal behavior that survived generation (or predates the rule) — a saved
  // audit can't be regenerated at render, so we hedge it deterministically.
  //
  // C4 · THE HEDGE IS NOW GRADE-AWARE, and that is the fix that matters. Hedging
  // runs on the grade the finding was stamped with at generation: something we
  // MEASURED is left alone (hedging a measurement makes the whole document read
  // as guesswork), something we only INFERRED gets its flat operational claims
  // softened. A finding with no grade — every audit written before grades existed
  // — is treated as inferred, which is the cheap mistake rather than the
  // expensive one.
  //
  // C6: any sentence recommending ads, SEO, lead gen or a site rebuild is lifted
  // out here. Sentence-level, so the rest of a good finding survives.
  const findings = (report.findings ?? []).map((f) => {
    const grade: EvidenceGrade = f.evidenceGrade ?? "inferred";
    return {
      ...f,
      problem: labelBenchmarkFigure(
        stripOutOfScope(softenFlatAssertions(dehedge(f.problem), { grade }))
      ),
      whyItCosts: labelBenchmarkFigure(
        stripOutOfScope(softenFlatAssertions(dehedge(f.whyItCosts), { grade }))
      ),
    };
  });

  // A finding whose whole problem statement was a recommendation we do not make
  // has nothing left to say, so it does not ship. The stored report is untouched
  // — this only decides what renders. THE ESCAPE HATCH: if that would empty the
  // document completely, the findings stay. A cold audit with a bad sentence in
  // it is recoverable at 11pm; one with no findings at all is not a document.
  const inScope = findings.filter((f) => f.problem.trim().length > 0);
  const keptFindings = inScope.length ? inScope : findings;

  return {
    ...report,
    headline,
    intro,
    headlineCost,
    findings: keptFindings,
    closingCta: { ...cta, message },
    deeperLeakQuestions: questions,
  };
}

// ── C3 · COUNTING THE CALLS TO ACTION, RATHER THAN ASSERTING THERE IS ONE ────
//
// The rule is "exactly one CTA and it books the call". This is how that gets
// PROVED on the rendered page instead of promised in a comment: count the links,
// and scan the visible words for a second way to respond. The verification script
// asserts on what this returns.

export interface CtaCount {
  /** Every <a href> on the page. The document is allowed exactly one. */
  links: number;
  /** How many of those point at the booking URL. */
  bookingLinks: number;
  /** Visible sentences offering some OTHER way to respond ("just reply", "call
   *  me"). Any hit here is a competing ask even with only one link on the page. */
  secondaryAsks: string[];
}

export function countCallsToAction(html: string): CtaCount {
  const links = html.match(/<a\s[^>]*href\s*=/gi) ?? [];
  const bookingLinks = BOOKING_URL
    ? (html.match(new RegExp(`href\\s*=\\s*"${BOOKING_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "gi")) ?? [])
    : [];
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ");
  return {
    links: links.length,
    bookingLinks: bookingLinks.length,
    secondaryAsks: splitSentences(visible).filter((s) =>
      CTA_COMPETING_CHANNEL_PATTERNS.some((re) => re.test(s))
    ),
  };
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(s: string | null | undefined): string {
  if (!s) return "";
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function severityRank(sev: ColdAuditFinding["severity"]): number {
  return sev === "high" ? 0 : sev === "medium" ? 1 : 2;
}

function sevLabel(sev: ColdAuditFinding["severity"]): string {
  return sev === "high" ? "Critical" : sev === "medium" ? "Costly" : "Worth fixing";
}

// C4 · SAY WHERE EACH FINDING CAME FROM, ON THE FINDING.
//
// The reader is entitled to know, per finding, whether we measured the thing or
// are describing a pattern we expect. The grade is stamped at generation from the
// leak the finding was written from; this is it in plain English, printed beside
// the finding so nobody has to infer provenance from how confident a sentence
// happens to sound.
//
// "disclosed" cannot legitimately occur here — nothing has been disclosed before
// the sale, and three separate gates make it a bug rather than a wording choice.
// It is still labelled truthfully rather than dressed as a pattern: if one ever
// reaches a page, the page should not lie about it on top of everything else.
// OBSERVED CITES THE MEASUREMENT, INFERRED NAMES ITSELF AS A PATTERN. An
// observed finding gets the date we looked, because "we measured it" without
// saying when is not a citation, and a scan two months old deserves the reader's
// scepticism. An inferred finding says out loud that we did not measure theirs.
function gradeLabel(f: ColdAuditFinding, scanDate: string): string {
  switch (f.evidenceGrade ?? "inferred") {
    case "observed":
      return `Measured on your public pages, ${scanDate}`;
    case "disclosed":
      return "From what you told us";
    default:
      return "Industry pattern — not measured for you";
  }
}

function renderFinding(f: ColdAuditFinding, i: number, scanDate: string): string {
  return `<div class="finding reveal">
    <div class="f-head">
      <span class="f-num">${(i + 1).toString().padStart(2, "0")}</span>
      <h3>${esc(f.title)}</h3>
      <span class="tag ${esc(f.severity)}">${sevLabel(f.severity)}</span>
    </div>
    <p class="f-grade">${esc(gradeLabel(f, scanDate))}</p>
    <p class="f-problem">${esc(f.problem)}</p>
    ${
      // The cost block only renders when there is a cost to state. It can come
      // back empty if the scope sweep lifted the only sentence in it, and a
      // "What it's costing you" heading with nothing under it looks like the
      // document broke rather than like the sentence was pulled.
      f.whyItCosts?.trim()
        ? `<div class="f-cost"><span class="f-cost-label">What it's costing you</span>${esc(
            f.whyItCosts
          )}</div>`
        : ""
    }
  </div>`;
}

export function renderColdAuditHtml(rawReport: ColdAuditReport): string {
  // Enforce the laws on the data before rendering — guarantees a forbidden CTA
  // or missing deeper-leak block can never reach the page, even for stale audits.
  const report = enforceColdAuditLaws(rawReport);
  const findings = [...(report.findings ?? [])].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );

  const screenshotBlock = report.screenshotUrl
    ? `<figure class="shot reveal">
        <img src="${esc(report.screenshotUrl)}" alt="${esc(
          report.businessName
        )} website" onerror="this.closest('figure').style.display='none'">
        <figcaption>${esc(report.websiteUrl || report.businessName)} — as it looks today</figcaption>
      </figure>`
    : "";

  // C1: the outside/inside frame, before a single finding or figure lands.
  // Always rendered — there is no report state in which it stops being true.
  const frameBlock = `<div class="frame reveal">
        <div class="frame-label">${esc(OUTSIDE_INSIDE_FRAME.label)}</div>
        <p class="frame-lead">${esc(OUTSIDE_INSIDE_FRAME.lead)}</p>
        <p class="frame-body">${esc(OUTSIDE_INSIDE_FRAME.body)}</p>
      </div>`;

  // Frame the figure as ONE leak (the worst), so the much-larger paid-deliverable
  // total reads as expected upside, not a contradiction. The count is the number
  // of findings actually rendered below — deterministic, never free-typed.
  const leakCount = findings.length;
  const oneLeakNote =
    leakCount > 1
      ? `<p class="hc-note">Just one of ${leakCount} leaks we found below — and the most expensive of them.</p>`
      : "";

  // C5: when the headline carries a dollar figure, the eyebrow says what kind of
  // number it is before the reader reaches the number itself. The in-sentence
  // labelling (the ASSUMPTIONS caveat that travels with every benchmark frame)
  // still does the real work — this just stops the figure being read as a
  // measurement of their books for the second and a half before they get there.
  const costLabel = MONEY_PATTERN.test(report.headlineCost ?? "")
    ? "Your single biggest leak · industry estimate"
    : "Your single biggest leak";

  const costBlock = report.headlineCost
    ? `<div class="headline-cost reveal">
        <span class="hc-label">${esc(costLabel)}</span>
        <p class="hc-figure">${esc(report.headlineCost)}</p>
        ${oneLeakNote}
      </div>`
    : "";

  const perf = report.performance;
  const perfBlock =
    perf && perf.available
      ? `<div class="perf reveal">
          <div class="perf-metrics">
            ${
              perf.mobileScore != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.mobileScore
                  )}<span class="u">/100</span></div><div class="k">Mobile speed</div></div>`
                : ""
            }
            ${
              perf.lcpSeconds != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.lcpSeconds
                  )}<span class="u">s</span></div><div class="k">Load time</div></div>`
                : ""
            }
            ${
              perf.clsValue != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.clsValue
                  )}</div><div class="k">Layout shift</div></div>`
                : ""
            }
          </div>
          <p class="perf-read">${esc(perf.readout)}</p>
        </div>`
      : "";

  // C2: the pivot. Fixed six, in his words, printed as questions he will ask —
  // never as findings, because we have measured none of them. Rendered straight
  // from the constants rather than from the report, so no regeneration and no
  // hand-edit of a saved audit can reword what he is about to say out loud.
  const pivotBlock = `<div class="pivot reveal">
        <div class="section-label">${esc(PIVOT_SECTION_LABEL)}</div>
        <p class="pivot-intro">${esc(PIVOT_SECTION_INTRO)}</p>
        <ul class="pq-list">
          ${PIVOT_QUESTIONS.map(
            (q) =>
              `<li><span class="pq-leak">${esc(q.leak)}</span><span class="pq-ask">${esc(
                q.ask
              )}</span></li>`
          ).join("\n")}
        </ul>
        <p class="pivot-close">${esc(PIPELINE_DISCOVERY_QUESTION)}</p>
      </div>`;

  // C3: ONE call to action. The message, then — only when a booking URL is
  // configured — the single link on the page. No booking URL means the close
  // stays plain text; shipping a dead button to a prospect is worse than no
  // button, and a second link would just be a way for them not to book.
  const bookingButton = BOOKING_URL
    ? `<a class="cta-book" href="${esc(BOOKING_URL)}">${esc(BOOKING_CTA_LABEL)}</a>`
    : "";
  const ctaBlock =
    report.closingCta?.message || bookingButton
      ? `<div class="cta reveal">
        <div class="cta-eyebrow">Where this goes next</div>
        ${
          report.closingCta?.message
            ? `<p class="cta-msg">${para(report.closingCta.message).replace(
                /^<p>|<\/p>$/g,
                ""
              )}</p>`
            : ""
        }
        ${bookingButton}
      </div>`
      : "";

  const date = new Date(report.generatedAt).toLocaleDateString();
  const footerParts = [esc(report.businessName), esc(date)];
  if (report.agencyName && report.agencyName !== "our team") {
    footerParts.push(esc(report.agencyName));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Where ${esc(report.businessName)} is losing clients</title>
<style>
  :root {
    --bg: #FBFAF7; --surface: #FFFFFF; --surface-2: #F4F2EC;
    --ink: #1A1814; --ink-muted: #6B6659; --accent: #9A7B3F; --border: #E7E3D8;
    --high: #A8443B; --med: #B5862F; --low: #3F7D5A;
    --shadow: 0 1px 2px rgba(26,24,20,.05);
    --serif: Georgia, "Times New Roman", serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: var(--serif); font-weight: 600; letter-spacing: -.01em; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 56px 24px 96px; }

  header.doc { margin-bottom: 30px; }
  header.doc .eyebrow { text-transform: uppercase; letter-spacing: .16em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 16px; }
  header.doc h1 { margin: 0 0 14px; font-size: 30px; line-height: 1.2; color: var(--ink); }
  header.doc .intro { font-size: 17px; line-height: 1.55; color: var(--ink-muted); margin: 0; max-width: 60ch; }

  figure.shot { margin: 0 0 28px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
  figure.shot img { display: block; width: 100%; height: auto; }
  figure.shot figcaption { background: var(--surface-2); color: var(--ink-muted); padding: 10px 16px; font-size: 12.5px; border-top: 1px solid var(--border); }

  .headline-cost { background: var(--surface-2); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 12px; padding: 24px 26px; margin-bottom: 30px; }
  .headline-cost .hc-label { display: block; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }
  .headline-cost .hc-figure { margin: 0; font-family: var(--serif); font-size: 22px; line-height: 1.4; color: var(--ink); font-variant-numeric: tabular-nums; }
  .headline-cost .hc-note { margin: 12px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-muted); }

  .section-label { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin: 0 2px 14px; }

  .frame { background: var(--surface); border: 1px dashed var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 28px; }
  .frame .frame-label { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 12px; }
  .frame .frame-lead { margin: 0; font-family: var(--serif); font-size: 17px; line-height: 1.5; color: var(--ink); }
  .frame .frame-body { margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--ink-muted); }

  .finding { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .f-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .f-num { font-family: var(--serif); font-size: 13px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .f-head h3 { margin: 0; font-size: 18px; line-height: 1.3; flex: 1; color: var(--ink); }
  .f-grade { margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-muted); }
  .f-problem { margin: 0 0 14px; color: var(--ink-muted); }
  .f-cost { background: var(--surface-2); border-radius: 8px; padding: 13px 16px; font-size: 14.5px; color: var(--ink); }
  .f-cost-label { display: block; text-transform: uppercase; letter-spacing: .08em; font-size: 10.5px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }

  .tag { display: inline-block; padding: 2px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border: 1px solid currentColor; }
  .tag.high { color: var(--high); }
  .tag.medium { color: var(--med); }
  .tag.low { color: var(--low); }

  .perf { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .perf-metrics { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .metric { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; min-width: 116px; }
  .metric .v { font-family: var(--serif); font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .metric .v .u { font-size: 14px; color: var(--ink-muted); font-weight: 600; margin-left: 2px; }
  .metric .k { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-muted); margin-top: 2px; font-weight: 600; }
  .perf-read { margin: 0; color: var(--ink-muted); font-size: 14.5px; }

  .pivot { margin: 28px 0 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px 26px; box-shadow: var(--shadow); }
  .pivot-intro { margin: 0 0 16px; color: var(--ink-muted); font-size: 14.5px; line-height: 1.55; }
  .pq-list { margin: 0; padding: 0; list-style: none; }
  .pq-list li { position: relative; padding: 0 0 0 22px; margin-bottom: 14px; }
  .pq-list li:last-child { margin-bottom: 0; }
  .pq-list li::before { content: "?"; position: absolute; left: 0; top: 0; font-family: var(--serif); font-weight: 700; color: var(--accent); }
  .pq-leak { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); margin-bottom: 3px; }
  .pq-ask { display: block; color: var(--ink); font-size: 16px; line-height: 1.5; }
  .pivot-close { margin: 18px 0 0; padding-top: 16px; border-top: 1px solid var(--border); font-family: var(--serif); font-size: 17px; line-height: 1.45; color: var(--ink); }

  .cta { margin-top: 28px; background: var(--surface-2); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 12px; padding: 26px 28px; }
  .cta-eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }
  .cta-msg { margin: 0; font-family: var(--serif); font-size: 20px; line-height: 1.45; color: var(--ink); }
  .cta-book { display: inline-block; margin-top: 20px; padding: 13px 26px; border-radius: 999px; background: var(--accent); color: var(--bg); font-size: 15px; font-weight: 700; letter-spacing: .01em; text-decoration: none; }

  footer.doc { text-align: center; color: var(--ink-muted); font-size: 12.5px; margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--border); }

  .reveal { opacity: 0; transform: translateY(10px); transition: opacity .5s ease, transform .5s ease; }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } html { scroll-behavior: auto; } }

  @media (max-width: 640px) {
    .wrap { padding: 36px 16px 64px; }
    header.doc h1 { font-size: 25px; }
    .finding, .perf, .cta, .headline-cost, .pivot, .frame { padding: 18px 18px; }
  }
  @media print {
    body { background: #fff; }
    .finding, .perf, .cta, .headline-cost, .pivot, .frame, figure.shot { break-inside: avoid; box-shadow: none; }
    .reveal { opacity: 1; transform: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      <div class="eyebrow">Conversion audit</div>
      <h1>${esc(report.headline)}</h1>
      ${report.intro ? `<p class="intro">${esc(report.intro)}</p>` : ""}
    </header>
    ${frameBlock}
    ${screenshotBlock}
    ${costBlock}
    <div class="section-label">${esc(SCAN_SECTION_LABEL)}</div>
    ${findings.map((f, i) => renderFinding(f, i, date)).join("\n")}
    ${perfBlock}
    ${pivotBlock}
    ${ctaBlock}
    <footer class="doc">${footerParts.join(" · ")}</footer>
  </div>
  <script>
    (function () {
      if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
      document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    })();
  </script>
</body>
</html>`;
}
