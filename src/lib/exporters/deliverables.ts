// The deliverable composer — THREE documents, two of which the client sees.
//
//   diagnosis    THE DIAGNOSIS   · client · the saved calculator, rendered
//   build-plan   THE BUILD PLAN  · client · what we install, what we don't, when
//   asset-pack   ASSET PACK      · INTERNAL · the copy that runs the system
//
// It was four, and the four were the product. The build inside GoHighLevel is the
// product now and these are proof of work, so they stopped being written and
// started being assembled:
//
//   · The Diagnosis was the Growth Leak Intelligence Report — a model-written
//     scorecard, leak analysis, "fastest wins" and recommendations, generated from
//     scraped material. It now renders the frozen assessment from the sales call,
//     which the client has already agreed to. Same row the offer page reads.
//
//   · The Build Plan is the Blueprint and the Roadmap merged. They answered one
//     question between them and neither answered it alone: the Blueprint gave an
//     architecture with no dates, the Roadmap a schedule for something it never
//     fully listed. It is assembled from the workflow catalogue, the five build
//     decisions and one nullable kickoff date.
//
//   · The Asset Pack is unchanged and is now INTERNAL. It is the copy that runs
//     the workflows, and it is sent at go-live rather than at signing — before
//     the system exists it is a pile of text a client has no use for.

import type {
  AssetPack,
  AssetPackMeta,
  DeliverableId,
  EvidenceGrade,
  ScorecardMetric,
  LeakAnalysisItem,
  DollarImpact,
  DeployOwner,
  FunnelStage,
  CrmStage,
  LeadTier,
  RoadmapPhase,
  LandingPageIntelligence,
  LandingPageAssets,
  LandingDiagnosisPoint,
} from "@/types";
import { OWNER_US, OWNER_YOU } from "../brand";
import {
  softenFlatAssertions,
  carriesProvenanceMarker,
  attributesToClient,
  reconcileLeakTotal,
  type LeakTotalInput,
} from "../leak-narrative";
import { workflowById, PIPELINE, JOURNEY_STAGES, nounsFor } from "../workflow-catalogue";
import {
  buildPlan as assembleBuildPlan,
  type BuildPlan,
  type BuildPlanItem,
  type BuildDates,
} from "../build-plan";
import { OFF_WHEN } from "../build-decisions";
import { markCurrency, type ComputedAssessment, type ComputedRow } from "../leak-calculator";
// The two engagement prices, straight from the constants module.
//
// These used to be imported from proposal-defaults, which only re-exported them
// from here — so the deliverables depended on the proposal generator to know
// what the engagement costs. The proposal is being deleted; the price is not the
// proposal's fact to own. constants.ts is the one definition and always was.
import { SETUP_FEE_CAD, MONTHLY_RETAINER_CAD } from "../constants";
import { esc, para, list, section, slugify, shell, pill, type ShellOptions } from "./_shell";

// ── Small local presentation helpers ─────────────────────────────────────────

function gradeClass(score: number): string {
  if (score >= 80) return "grade-strong";
  if (score >= 55) return "grade-mid";
  return "grade-weak";
}

function dial(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return `<div class="score-dial ${gradeClass(
    s
  )}" style="--dial:${s}"><span>${s}</span></div>`;
}

function priorityClass(priority: string | undefined): string {
  const p = String(priority ?? "").toLowerCase();
  if (p === "critical") return "crit";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function kv(label: string, value: string | undefined): string {
  if (!value) return "";
  return `<div class="kv"><div class="k">${esc(label)}</div><div>${esc(value)}</div></div>`;
}

// Owner tag — done-for-you framing (Law 3). "us" → "Deployed by us",
// "you" → "You (owner)". Never names the agency.
function ownerLabel(owner: DeployOwner | undefined): string {
  return owner === "you" ? OWNER_YOU : OWNER_US;
}
function ownerTag(owner: DeployOwner | undefined): string {
  const us = owner !== "you";
  return `<span class="owner-tag ${us ? "owner-us" : "owner-you"}">${esc(
    ownerLabel(owner)
  )}</span>`;
}

// A4 · ONE CURRENCY CONVENTION, MARKER FIRST. ReclaimedHQ prices and quotes in
// CAD, and every dollar string the math layer emits already reads "CAD $1,290"
// (leak-narrative.cad). This used to print a bare "$2,329" for the headline
// amounts, so the same document showed "CAD $2,329" in the formula line and
// "$2,329" in the big number directly above it — two currencies on one card as far
// as a reader can tell. Same shape as cad(), with the locale pinned so the
// rendered HTML is byte-identical wherever it is generated.
function money(n: number): string {
  if (!Number.isFinite(n)) return "CAD $0";
  return "CAD $" + Math.round(n).toLocaleString("en-US");
}

// ── Section weight ───────────────────────────────────────────────────────────
// A document with five identically-weighted sections tells the reader nothing
// about which one matters. Three weights exist: the standard one section()
// emits, the KEY section that carries the money, and the recessed METHOD
// section that carries the basis and always comes last.
//
// THE WEIGHT RIDES ALONGSIDE `sec`, NEVER INSTEAD OF IT. buildToc() in _shell.ts
// finds sections by `class="sec…"` and drops the whole rail below three entries,
// so a weight that replaced the base class would take the section out of the
// contents — and on a three-section Diagnosis carrying two of them, would take
// the rail with it.
type SectionWeight = "sec--key" | "sec--method";

function weightedSection(
  num: number,
  title: string,
  weight: SectionWeight,
  inner: string
): string {
  if (!inner) return "";
  const id = `sec-${num.toString().padStart(2, "0")}-${slugify(title)}`;
  return `<section class="sec ${weight}" id="${id}"><div class="sec-head"><div class="sec-num">${num
    .toString()
    .padStart(2, "0")}</div><h2>${esc(title)}</h2></div><div class="sec-inner">${inner}</div></section>`;
}

// ── The methodology note (P2-3) ──────────────────────────────────────────────
// shell() renders meta.assumptions directly under the cover on every document.
// Every clause written today disclaims scraped material — no site URL, no
// page-speed reading, no reviews — and none of the three documents carries a
// finding of that kind any more. Nobody opens a deliverable by explaining what
// they could not see, so the note is handed nothing to say: shell() reads
// meta.assumptions, and the way to say "there is nothing here to disclaim" is to
// pass a meta with none.
function withoutAssumptions(meta: AssetPackMeta): AssetPackMeta {
  return { ...meta, assumptions: [] };
}

// A clause earns its place only when the document contains the thing it
// disclaims. The Diagnosis is built from the saved calculator alone, so anything
// about the website, the landing page, page speed or the reviews is disclaiming
// content that is not there — and today that empties the note completely, which
// is the correct outcome rather than a missing feature.
const DISCLAIMS_WHAT_THE_DIAGNOSIS_DOES_NOT_CONTAIN =
  /web ?site|landing[- ]page|page ?speed|review/i;

function diagnosisAssumptions(meta: AssetPackMeta): string[] {
  return meta.assumptions.filter(
    (a) => !DISCLAIMS_WHAT_THE_DIAGNOSIS_DOES_NOT_CONTAIN.test(a)
  );
}

// ── Merge fields, rendered as merge fields ───────────────────────────────────
// A GoHighLevel token is not prose and must not read like it. Wrapping each one
// in a code chip is also the only thing that tells an operator, at a glance,
// which parts of a message resolve at send time and which are literal text.
//
// Runs on ALREADY-ESCAPED text: esc() leaves {{ and }} alone, so escaping first
// and wrapping second keeps the body safe without the wrapper being escaped away.
function mergeChips(escaped: string): string {
  return escaped.replace(/\{\{[^{}]+\}\}/g, (t) => `<code class="mf">${t}</code>`);
}

/** The channel chip. Four tones exist because four kinds of message behave
 *  differently: one goes to the customer's phone, one to their inbox, one to the
 *  owner and one is published in public where anybody can read it. */
function chanChip(channel: string): string {
  const c = channel.toLowerCase();
  if (c.includes("owner") || c.includes("notification"))
    return `<span class="chan is-alert">Owner</span>`;
  if (c.includes("review") || c.includes("public"))
    return `<span class="chan is-public">Review reply</span>`;
  if (c.includes("email")) return `<span class="chan is-email">Email</span>`;
  if (c.includes("direct") || c.includes("dm")) return `<span class="chan is-text">DM</span>`;
  return `<span class="chan is-text">Text</span>`;
}

// Defect 4 / Law 11: prompt scaffolding sometimes leaks into copy as a
// slash-delimited list of analysis dimensions (e.g. "headline clarity /
// subheadline strength / CTA visibility / above-the-fold trust / local
// relevance"). The prompts forbid this, but stale or drifting output can still
// carry it, so we strip it deterministically at render. A fragment is treated as
// leaked scaffold when 3+ " / "-joined pieces are each short noun-phrases
// (≤5 words) — matching the validator's Law 11 heuristic.
// A leaked scaffold list joins its dimensions with " / " or a spaced en/em-dash
// (e.g. "booking-vs-contact / urgency specificity — diagnose the intent
// mismatch"). 3+ such fragments where 3+ are short noun-phrases (≤5 words) is a
// checklist, not prose. Hyphens inside a single token ("booking-vs-contact",
// "above-the-fold") are NOT separators — only spaced slashes/dashes are.
const SCAFFOLD_SEP = /\s+[/\u2013\u2014]\s+/;
function isScaffoldFragment(s: string): boolean {
  const segs = s.split(SCAFFOLD_SEP);
  if (segs.length < 3) return false;
  const shortSegs = segs.filter((seg) => seg.trim().split(/\s+/).length <= 5).length;
  return shortSegs >= 3;
}

// Removes leaked scaffold from a prose value: splits into SENTENCE-level chunks
// (so a real finding glued onto a dimension list survives), drops any chunk that
// is itself a scaffold list, and rejoins the survivors. We do NOT split on
// dashes here — the dash is a scaffold separator handled inside
// isScaffoldFragment, not a sentence boundary. If every chunk is scaffold the
// result is "" and the caller omits the field.
function stripScaffold(text: string | undefined | null): string {
  if (!text) return "";
  const chunks = text.split(/(?<=[.!?])\s+|\n+/);
  const kept = chunks.filter((c) => c.trim() && !isScaffoldFragment(c));
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

// Defect 5 / Law 12: dollar figures live in exactly one place per leak (the
// structured dollarCallout) and the rolled-up reconciledTotal. A figure typed
// freely into narrative prose creates a total that contradicts the computed source
// of truth, which is the thing an owner with a calculator catches first.
//
// RECONCILE, DON'T DELETE. This used to remove EVERY money expression from D1
// prose, which broke honest copy in front of the client: the committed sample's
// executive summary reads "an estimated CAD $2,329–CAD $4,659 a month, computed
// from the enquiry volume and average job value you gave us" — the exact figure
// the structured math produced — and it shipped as "an estimated CAD –CAD,
// computed from…". A mangled sentence is worse than the risk being guarded
// against, and it was guarding against nothing here, because the numbers agreed.
//
// So the rule is now: a money expression SURVIVES when every figure in it is one
// the pack's own structured math produced (`authorised`), and its whole sentence
// goes when it is not. A contradicting number still cannot ship; a correct one is
// left alone. Passing no set authorises nothing, so every sentence carrying a
// figure is dropped — the strict reading, for a caller that has no computed
// figures to reconcile against and therefore stands behind none.
const MONEY_EXPR =
  /(?:of\s+|roughly\s+|around\s+|about\s+|approximately\s+|an?\s+estimated\s+|up\s+to\s+|between\s+)?(?:CAD\s*)?\$\s?\d[\d,]*(?:\.\d+)?(?:\s*[kKmM]\b)?(?:\s*[–—-]\s*(?:CAD\s*)?\$?\s?\d[\d,]*(?:\.\d+)?(?:\s*[kKmM]\b)?)?(?:\s*(?:\/\s*mo\b|\/\s*month\b|per\s+month|a\s+month|each\s+month|monthly|annually|per\s+year|a\s+year))?/g;

/** The set of dollar amounts a document is allowed to say out loud: exactly the
 *  ones its own structured math produced. */
export type AuthorisedAmounts = ReadonlySet<number>;

// A k/M suffix ("$2.5k") is never a figure our math emits, so an expression
// carrying one can never be authorised — it is somebody rounding by hand.
function moneyExprIsAuthorised(expr: string, authorised: AuthorisedAmounts): boolean {
  if (/\d\s*[kKmM]\b/.test(expr)) return false;
  const figures = expr.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  if (!figures.length) return false;
  return figures.every((f) => authorised.has(Math.round(Number(f.replace(/,/g, "")))));
}

// THE WHOLE SENTENCE GOES, NOT JUST THE NUMBER. Cutting a figure out of the
// middle of a sentence leaves a hole nobody can read — "the largest recoverable
// number in this report:, computed from the enquiry volume you gave us" — and no
// amount of punctuation tidying repairs a clause whose subject has been deleted.
// A sentence built around a figure this document no longer stands behind is a
// sentence about nothing, so it is dropped whole and the prose around it stays
// exactly as written.
function scrubMoney(text: string | undefined | null, authorised?: AuthorisedAmounts): string {
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const kept = sentences.filter((sentence) => {
    // .match (not .test) — MONEY_EXPR is global, and a global regex's lastIndex
    // makes .test stateful across calls.
    const found = sentence.match(MONEY_EXPR);
    if (!found) return true; // no money in it — nothing to reconcile
    return Boolean(authorised) && found.every((m) => moneyExprIsAuthorised(m, authorised!));
  });
  if (kept.length === sentences.length) return text; // nothing dropped — untouched
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

// Defect 4 + 5 combined cleaner for D1 landing/exec prose: strip scaffold lists
// AND reconcile money against the pack's own figures, so no leaked checklist and
// no contradicting total survives.
function cleanD1Prose(text: string | undefined | null, authorised?: AuthorisedAmounts): string {
  return scrubMoney(stripScaffold(text), authorised);
}

/** Every dollar amount this pack's structured math actually produced — each
 *  leak's own bounds plus the reconciled (post-cap) total. Prose may repeat these
 *  and nothing else.
 *
 *  NOTE the total is taken POST-cap on purpose: when the credibility cap binds,
 *  the pre-cap sum becomes a number this document no longer stands behind, so a
 *  narrative still quoting it gets scrubbed exactly as any other stale figure
 *  would be. */
function authorisedAmounts(pack: AssetPack): AuthorisedAmounts {
  const out = new Set<number>();
  for (const l of pack.intelligence?.leakAnalysis ?? []) {
    const d = l.dollarImpact;
    if (!d) continue;
    if (Number.isFinite(d.monthlyLow)) out.add(Math.round(d.monthlyLow));
    if (Number.isFinite(d.monthlyHigh)) out.add(Math.round(d.monthlyHigh));
  }
  const total = reconcileLeakTotal((pack.intelligence?.leakAnalysis ?? []).map(toTotalInput));
  if (total.low) out.add(total.low);
  if (total.high) out.add(total.high);
  // The two engagement prices are figures the document stands behind everywhere —
  // D4 prints them itself. Without them here, a sentence that legitimately named
  // the fee would be treated as a stray number and dropped.
  out.add(SETUP_FEE_CAD);
  out.add(MONTHLY_RETAINER_CAD);
  return out;
}

// Gold-bordered dollar-impact callout (Law 5): the headline range, the visible
// math, and the stated assumptions — with a benchmark flag when the customer
// value is an industry benchmark rather than the business's real number.
// `overlapNote` (A2) is the plain-English sentence that stops a reader adding
// this figure to the one above it — e.g. "This is the after-hours share of the
// missed-call figure above, not additional to it." It renders INSIDE the callout,
// right under the amount, because that is the only place a reader can see the
// number and the caveat in one glance.
function dollarCallout(d: DollarImpact | undefined, overlapNote?: string): string {
  if (!d) return "";
  const range =
    d.monthlyLow || d.monthlyHigh
      ? `${money(d.monthlyLow)}–${money(d.monthlyHigh)}<span class="per">/mo lost</span>`
      : "";
  // A6: a leak with no computable figure (mathTemplate null) gets NO revenue-leak
  // slot — an "Estimated revenue leak" header with a blank amount is an empty box.
  if (!range) return "";
  const assume = [
    d.leadVolumeBasis ? `<li><span>Lead volume</span> ${esc(d.leadVolumeBasis)}</li>` : "",
    d.effectSize ? `<li><span>Conversion effect</span> ${esc(d.effectSize)}</li>` : "",
    d.avgValueBasis ? `<li><span>Customer value</span> ${esc(d.avgValueBasis)}</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  const bench = d.usesBenchmarkValue
    ? `<div class="bench-flag">Uses an industry-benchmark customer value (erring low). Plug in your real average customer value to make this figure exact.</div>`
    : "";
  const overlap = overlapNote?.trim()
    ? `<div class="bench-flag">${esc(
        overlapNote.trim()
      )} It is left out of the total above so it is never counted twice.</div>`
    : "";
  return `<div class="dollar-callout"><div class="dc-head"><span class="dc-label">Estimated revenue leak</span><span class="dc-amount">${range}</span></div>${
    d.formula ? `<div class="dc-formula">${esc(d.formula)}</div>` : ""
  }${overlap}${assume ? `<ul class="dc-assume">${assume}</ul>` : ""}${bench}</div>`;
}

// ── D1 · Growth Leak Intelligence Report ──────────────────────────────────────

// reconcileLeakTotal only reads a leak's id, name, dollar bounds and its overlap
// fields; the rest of LeakInput is generation-time material (evidence strings,
// phrasing rules, allowed stats) that a SAVED pack no longer carries. It takes
// exactly that subset (LeakTotalInput), so this projection needs no cast.
function toTotalInput(l: LeakAnalysisItem, i: number): LeakTotalInput {
  const d = l.dollarImpact;
  return {
    id: l.leakName || l.area || `leak-${i}`,
    name: l.leakName || l.area || "",
    dollar: d
      ? {
          low: d.monthlyLow || 0,
          high: d.monthlyHigh || 0,
          leadVolumeBasis: d.leadVolumeBasis,
          effectSize: d.effectSize,
          avgValueBasis: d.avgValueBasis,
          formula: d.formula,
          usesBenchmarkValue: d.usesBenchmarkValue,
        }
      : null,
    // Stamped in asset-generation from the math estimate. Absent on pre-A2 packs,
    // which then behave exactly as before (nothing overlaps, nothing excluded).
    // NOTE: overlapsWith is a taxonomy leak ID while `id` above is the display
    // name, so reconcileLeakTotal's id→name lookup will not resolve it. That is
    // harmless: the lookup only feeds its FALLBACK sentence, and overlapNote is
    // guaranteed present whenever overlapsWith is, so the real note always wins.
    overlapsWith: l.overlapsWith ?? null,
    overlapNote: l.overlapNote ?? null,
  };
}

// Law 12 + A2: the exec-summary total is COMPUTED from the itemized leaks, never
// a free-typed number — and it is NOT a naive sum. Two of the frames describe the
// same lost calls (after-hours calls ARE missed calls), so adding them would
// inflate the total in front of an owner with a calculator. reconcileLeakTotal in
// leak-narrative is the single place that arithmetic lives; here we only print
// what it returns, INCLUDING its disclosure sentence. Silently dropping a figure
// would be its own dishonesty — the reader is told a figure was left out and why.
function reconciledTotal(pack: AssetPack): string {
  const leaks = pack.intelligence?.leakAnalysis ?? [];
  const inputs = leaks.map(toTotalInput);
  const total = reconcileLeakTotal(inputs);
  // Leaks that actually contributed to the sum — the excluded subsets keep their
  // own figure on the page but must not be described as part of this total.
  const counted = inputs.filter(
    (li) => li.dollar && !li.overlapsWith && (li.dollar.low || li.dollar.high)
  ).length;
  if (!counted || (!total.low && !total.high)) return "";

  // THE TWO ADJUSTMENTS RENDER ABOVE THE MATH, NOT UNDER IT. Both of these say
  // the itemized figures below will NOT add up to this headline, and a reader who
  // reaches that conclusion on their own before we say it has already decided the
  // report is padded. So they sit directly beneath the number — the only place a
  // reader can take in the figure and its caveat in one glance — and the working
  // ("sum of the N leaks below") comes after them.
  const overlap = total.disclosure
    ? `<div class="dc-note"><span class="dcn-k">What is not in this number</span>${esc(
        total.disclosure
      )} It is shown with its own leak below, but counted once — not twice.</div>`
    : "";

  // The credibility cap (D2). It always has something to say: it bound, it was
  // checked and held, or there was nothing to check it against. A capped figure
  // presented without the caveat would be its own dishonesty, so the binding case
  // gets the loud treatment and the other two get the quiet one.
  const cap = `<div class="dc-note ${total.cap.binding ? "is-capped" : "is-checked"}"><span class="dcn-k">${
    total.cap.binding
      ? "Capped on purpose"
      : total.cap.applicable
        ? "Checked against your numbers"
        : "Not yet sized against your numbers"
  }</span>${esc(total.cap.note)}</div>`;

  // Order on the card: the number, the one line saying where it came from, then
  // the two things that stop a reader mis-reading it. Both notes stay ABOVE the
  // fold of the callout and carry their own headings, because a reader who adds
  // the itemized figures himself and finds they don't match has already decided
  // the report is padded — by then the explanation is too late.
  return `<div class="dollar-callout dc-total"><div class="dc-head"><span class="dc-label">Total recoverable revenue leak</span><span class="dc-amount">${money(
    total.low
  )}–${money(total.high)}<span class="per">/mo</span></span></div><div class="dc-formula">Sum of the ${counted} itemized conversion leak${
    counted === 1 ? "" : "s"
  } below — fix the leaks and this is the monthly upside in play.</div>${overlap}${cap}</div>`;
}

function renderExecutiveSummary(pack: AssetPack, authorised: AuthorisedAmounts): string {
  const intel = pack.intelligence;
  const summary = intel?.executiveSummary;
  if (!summary) {
    // Fallback to file1 executive summary.
    return para(pack.file1.executiveSummary);
  }
  const callout = (title: string, cls: string, items: string[] | undefined) =>
    items?.length
      ? `<div class="exec-card ${cls}"><div class="h">${esc(title)}</div>${list(items)}</div>`
      : "";
  return `${para(cleanD1Prose(summary.narrative, authorised))}${reconciledTotal(pack)}<div class="exec-grid">${callout(
    "Biggest Opportunities",
    "win",
    summary.biggestOpportunities
  )}${callout("Biggest Threats", "threat", summary.biggestThreats)}${callout(
    "Most Urgent Fixes",
    "urgent",
    summary.mostUrgentFixes
  )}${callout("Quick Wins", "win", summary.quickWins)}</div>`;
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Strong foundation";
  if (score >= 55) return "Mixed — clear upside";
  return "High leakage — urgent upside";
}

function scoreHero(metrics: ScorecardMetric[], readout?: string): string {
  const avg = Math.round(
    metrics.reduce((sum, m) => sum + (m.score || 0), 0) / metrics.length
  );
  const ringClass = gradeClass(avg);
  return `<div class="score-hero"><div class="ring ${ringClass}" style="--ring:${avg}"><span class="rv">${avg}</span><span class="rl">Overall</span></div><div><div class="sh-grade">${esc(
    gradeLabel(avg)
  )}</div><p class="muted" style="margin:0">${esc(
    readout || "A read across the nine conversion surfaces an enquiry crosses on the way to becoming a customer — higher is healthier, lower is where revenue quietly escapes."
  )}</p></div></div>`;
}

// A score of 95 with no finding behind it is a PASS, and the document has to say
// so in as many words. Left implicit, a nine-row grid of numbers reads as nine
// problems of differing size — which quietly turns the two axes this business is
// genuinely good at into more bad news, and makes the report look like it went
// looking for faults everywhere.
//
// The threshold and the leak check are BOTH required. No mapped finding on its own
// is not evidence of health (it can equally mean nothing was detectable), so an
// axis only earns the clean marker when nothing fired against it AND its own score
// says it is healthy. An axis with no finding and a poor score gets no marker at
// all — we do not know enough about it to make either claim.
const CLEAN_AXIS_SCORE = 80;

function axisLeaks(metricName: string, leaks: LeakAnalysisItem[]): LeakAnalysisItem[] {
  const want = metricName.trim().toLowerCase();
  return leaks.filter((l) => (l.scorecardArea ?? "").trim().toLowerCase() === want);
}

// The strongest thing we know about this axis, shown in the same vocabulary the
// findings use. Precedence mirrors gradeOf() in the taxonomy: measured beats told
// beats guessed — the axis is described by the best evidence behind it, never by
// the weakest.
function axisEvidenceChip(mapped: LeakAnalysisItem[]): string {
  if (!mapped.length) return "";
  const best =
    mapped.find((l) => leakGrade(l) === "observed") ??
    mapped.find((l) => leakGrade(l) === "disclosed") ??
    mapped[0];
  return gradeChip(best);
}

function renderScorecard(
  metrics: ScorecardMetric[] | undefined,
  leaks: LeakAnalysisItem[],
  readout?: string
): string {
  if (!metrics?.length) return "";
  const rows = metrics
    .map((m) => {
      const mapped = axisLeaks(m.name, leaks);
      const clean = !mapped.length && (m.score ?? 0) >= CLEAN_AXIS_SCORE;
      const marker = clean
        ? `<span class="ev-chip is-clean">Holding — nothing to fix here</span>`
        : axisEvidenceChip(mapped);
      return `<div class="score-row${clean ? " is-clean" : ""}">${dial(
        m.score
      )}<div class="score-body"><div class="name">${esc(m.name)} <span class="pct">${esc(
        m.score
      )}/100</span>${marker}</div><div class="diag">${esc(
        m.diagnosis
      )}</div><div class="score-kv">${kv("Rubric", m.rubric)}${kv(
        "Evidence",
        m.evidence
      )}${kv("Why it matters", m.whyItMatters)}${kv("Likely cause", m.cause)}${kv(
        "Expected benefit",
        m.expectedBenefit
      )}</div></div></div>`;
    })
    .join("");
  return `${scoreHero(metrics, readout)}<div class="scorecard">${rows}</div>`;
}

// Law 13 backstop for the PAID pack, exactly as cold-audit-html.ts does it for
// the free audit: a saved pack cannot be regenerated at render, so any flat
// operational assertion about an INVISIBLE internal behavior that survived
// generation (or predates the rule) is hedged deterministically here.
//
// GRADE-AWARE, and that is non-negotiable: a leak we measured, or one the client
// told us about, is a FACT. softenFlatAssertions returns those byte-for-byte
// untouched when it is given the context, so we always give it the context. Only
// an inference can ever be hedged.
//
// WHY THE LEGACY PAIR STILL TRAVELS BESIDE THE GRADE. The stamped grade wins
// whenever it is present (softenFlatAssertions prefers it). When it is NOT — a
// pack saved before Phase 1 — the {tier, intakeConfirmed} pair is the only
// provenance that pack has, and dropping it would start hedging OBSERVED prose in
// documents that already shipped, over a field that did not exist when they were
// written. The VALIDATOR treats an unstamped leak as inferred on purpose (it is
// the gate; it must under-claim). This is the render-time backstop on a document
// that can no longer be regenerated, so it uses the best provenance the pack has
// rather than the worst.
function leakAssertionCtx(l: LeakAnalysisItem) {
  return {
    grade: l.evidenceGrade,
    tier: l.evidenceTier,
    intakeConfirmed: l.intakeConfirmed,
  };
}
function softenLeakProse(l: LeakAnalysisItem, text: string | undefined): string {
  return softenFlatAssertions(text ?? "", leakAssertionCtx(l));
}

// ── The evidence grade at the render boundary (Phase 1) ──────────────────────
// The grade is the coarse honesty gate: measured / told / guessed. It is stamped
// deterministically at generation (stampLeakAnalysis), so the renderer only READS
// it — it never decides a grade for itself.
//
// A MISSING GRADE IS "inferred". Every pack saved before Phase 1 carries no grade
// at all, and a missing field must never be the reason a passage gets to read as
// a measured fact, so the absent case falls to the hedged end.
function leakGrade(l: LeakAnalysisItem): EvidenceGrade {
  return l.evidenceGrade ?? "inferred";
}

// A DISCLOSURE, ATTRIBUTED. The one sentence that says whose fact this is. It
// carries two PROTECTED_MARKERS phrases on purpose ("confirmed at intake", "you
// told us") — the same vocabulary the softener and the pack validator look for —
// so the rendered document, the render-time backstop and the fatal check all
// agree that this passage states its own provenance.
const DISCLOSED_ATTRIBUTION =
  "Confirmed at intake — you told us this isn't in place, so this isn't a maybe.";

// MEASURED AND ADMITTED — the strongest line this document can carry, and it is
// literally true: our own tooling found the gap AND the client confirmed it. The
// grade alone can't say that, because gradeOf's precedence (measured > told)
// collapses the pair down to "observed" and the confirmation disappears from the
// label. Both facts survive on the item, so the label reads both of them back.
const OBSERVED_AND_CONFIRMED_LABEL = "What we observed and you confirmed";

/** The pair that earns the dual label: we measured it AND they confirmed it.
 *  Grade first (the honesty gate), with the legacy tier as the fallback for packs
 *  saved before the grade existed — same tolerance the BENCHMARK branch below
 *  already gives them. */
function observedAndConfirmed(l: LeakAnalysisItem): boolean {
  if (!l.intakeConfirmed) return false;
  return leakGrade(l) === "observed" || (!l.evidenceGrade && l.evidenceTier === "OBSERVED");
}

// Part C1 + Phase 1: the evidence label must match what we actually KNOW.
// GRADE FIRST, tier second. An industry benchmark is never presented as something
// "observed" on this business — and, the failure this ordering exists to stop, a
// fact the CLIENT gave us is never presented as something we detected. Before
// this, an EVIDENCED leak the client had confirmed at intake was labelled "Signal
// in your reviews": their own answer handed back to them as our finding.
// ONE SWITCH, TWO STRINGS. The finding shows its provenance twice — a chip on the
// card header (visible at a glance, and in print) and the full label above the
// evidence itself. Those two must never disagree, and the only way to guarantee
// that is for one branch to produce both. A second function mirroring these
// branches would drift the first time somebody edits one and not the other.
interface EvidenceLabels {
  /** The heading above the evidence body. */
  full: string;
  /** The badge on the card header — same claim, fewer words. */
  short: string;
  /** Styling hook only: observed / disclosed / inferred. */
  grade: EvidenceGrade;
}
function evidenceLabels(l: LeakAnalysisItem): EvidenceLabels {
  const grade = leakGrade(l);
  if (grade === "disclosed") return { full: "You told us", short: "You told us", grade };
  // Checked BEFORE the plain observed case: a leak that is both must not be
  // flattened into the weaker of the two things we know about it.
  if (observedAndConfirmed(l))
    return { full: OBSERVED_AND_CONFIRMED_LABEL, short: "Measured + confirmed", grade };
  if (l.evidenceTier === "BENCHMARK")
    // Confirmed at intake → stated as fact, not an unverified benchmark. Reached
    // only by legacy (ungraded) packs now — a graded one takes the branch above.
    return l.intakeConfirmed
      ? { full: "Confirmed at intake", short: "Confirmed at intake", grade }
      : { full: "Industry pattern", short: "Industry pattern", grade };
  if (l.evidenceTier === "EVIDENCED")
    return { full: "Signal in your reviews", short: "From your reviews", grade };
  return { full: "What we observed", short: "Measured", grade }; // OBSERVED, or unlabeled legacy
}

function evidenceLabel(l: LeakAnalysisItem): string {
  return evidenceLabels(l).full;
}

// THE GRADE, ON THE FRONT OF THE CARD. Before this it lived only inside the
// Evidence tab, which is closed by default — so a reader skimming D1 on screen saw
// a dollar figure, a "critical" pill and a confident sentence, with nothing telling
// them whether we measured the thing, were told it, or are quoting a pattern.
// That is precisely the distinction the grade exists to make, so it belongs where
// the eye lands first rather than one click away.
function gradeChip(l: LeakAnalysisItem): string {
  const e = evidenceLabels(l);
  // "ev-" and not "grade-": _shell.ts already owns .grade-strong/.grade-mid/
  // .grade-weak for the SCORE dials, and two unrelated meanings sharing a class
  // prefix is how a later stylesheet edit breaks the wrong thing.
  return `<span class="ev-chip ev-${esc(e.grade)}">${esc(e.short)}</span>`;
}

// The whitelisted industry stats + the computed benchmark/real dollar math for a
// leak, rendered deterministically (Defect 1). Stats carry their inline source
// citation already (shortSource, via allowedStatPhrase); the math frame is the
// pre-computed, labeled "≈ $X/mo — assuming…" sentence.
function statsBlock(l: LeakAnalysisItem): string {
  const stats = (l.allowedStats ?? []).filter(Boolean);
  const frame = l.mathFrame?.trim();
  if (!stats.length && !frame) return "";
  // For BENCHMARK leaks the stats already appear in the Industry-pattern body,
  // so we only surface the computed math here to avoid duplicating them.
  const showStats = l.evidenceTier !== "BENCHMARK" && stats.length > 0;
  const statList = showStats
    ? `<ul class="lk-stats">${stats.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
    : "";
  const mathHtml = frame
    ? `<div class="lk-math"><span class="lk-math-label">Estimated impact</span>${esc(
        frame
      )}</div>`
    : "";
  if (!statList && !mathHtml) return "";
  // NO HEADING OVER AN EMPTY LIST. A BENCHMARK leak shows its stats in the
  // Industry-pattern body instead, so this block is left holding only the math —
  // and it was still printing "Industry benchmarks" above a box labelled
  // "Estimated impact", which reads on the page as a heading whose content went
  // missing. The math block carries its own label, so it stands alone.
  if (!statList) return `<div class="kv">${mathHtml}</div>`;
  return `<div class="kv"><div class="k">Industry benchmarks</div>${statList}${mathHtml}</div>`;
}

// The evidence / industry-pattern pane body (Defect 4). A DISCLOSED leak leads
// with the attribution. A leak we MEASURED that they ALSO confirmed leads with the
// measurement and closes with the attribution, so it reads in the same order as
// its label. BENCHMARK leaks show the industry pattern (its stat/softFraming) +
// the kickoff-verification line — NEVER the symptom, which lives in the summary
// slot. Everything else shows the real evidence.
function leakEvidencePane(l: LeakAnalysisItem): string {
  const label = `<div class="k">${esc(evidenceLabel(l))}</div>`;
  let body: string;
  if (leakGrade(l) === "disclosed") {
    // THE CLIENT TOLD US THIS. State it as fact, attributed to them, and NEVER a
    // kickoff-verification line: they already answered the question, and asking it
    // again in a document they paid for insults them.
    //
    // A BENCHMARK-tier disclosure shows the industry pattern underneath for cost
    // context (unchanged from Phase 0.6); any other tier shows its real evidence.
    // The attribution sentence is added only when that detail does not already
    // state its own provenance — the stamped intake evidence lines already open
    // with "Confirmed at intake: …", and saying it twice reads like a template.
    const pattern = l.industryPattern?.trim();
    const detail = pattern ? para(pattern) : para(softenLeakProse(l, l.evidence));
    const stated = carriesProvenanceMarker(pattern ?? l.evidence ?? "");
    body = `${stated ? "" : para(DISCLOSED_ATTRIBUTION)}${detail}`;
  } else if (observedAndConfirmed(l)) {
    // HEADER AND BODY HAVE TO AGREE. The label now claims two things — we measured
    // it and they confirmed it — so the body has to carry both, in that order.
    // The measurement is already in `evidence`; the confirmation is added only
    // when the prose doesn't attribute itself to the client already (the stamped
    // intake evidence lines open with "Confirmed at intake: …", and saying it
    // twice reads like a template).
    //
    // attributesToClient, NOT carriesProvenanceMarker: the question here is
    // specifically "does the body say THEY confirmed it?", and this passage is
    // guaranteed to carry a measurement marker — which would satisfy the looser
    // check while leaving the second half of the label unsupported.
    const detail = para(softenLeakProse(l, l.evidence));
    const attributed = attributesToClient(l.evidence ?? "");
    body = `${detail}${attributed ? "" : para(DISCLOSED_ATTRIBUTION)}`;
  } else if (l.evidenceTier === "BENCHMARK") {
    const pattern = l.industryPattern?.trim();
    if (l.intakeConfirmed) {
      // LEGACY (ungraded) PACKS ONLY — a graded intake-confirmed leak is disclosed
      // and took the branch above. Confirmed at intake: state it as fact + the cost
      // context, with NO kickoff line (nothing left to verify).
      body = `${para(DISCLOSED_ATTRIBUTION)}${pattern ? para(pattern) : ""}`;
    } else {
      const kickoff = l.kickoffLine?.trim();
      body = `${pattern ? para(pattern) : ""}${kickoff ? `<p class="kickoff-line">${esc(kickoff)}</p>` : ""}`;
      // Fall back to any real evidence only when no pattern/kickoff was stamped.
      if (!pattern && !kickoff) body = para(softenLeakProse(l, l.evidence));
    }
  } else {
    body = para(softenLeakProse(l, l.evidence));
  }
  return `<div class="kv">${label}${body}${statsBlock(l)}</div>`;
}

export function renderLeakAnalysis(items: LeakAnalysisItem[] | undefined): string {
  if (!items?.length) return "";
  return items
    .map((l) => {
      const cls = priorityClass(l.priority);
      // Title = the taxonomy leak name (Defect 2), tagged with its scorecard axis.
      const title = l.leakName || l.area;
      const areaTag = l.scorecardArea
        ? `<span class="lk-area">${esc(l.scorecardArea)}</span>`
        : "";
      // Law 13 backstop on the diagnosis prose. recommendedFix is deliberately
      // NOT softened — it describes what WE deploy, not a claim about them.
      const summary = `<div class="kv"><div class="k">Business impact</div>${para(
        softenLeakProse(l, l.businessImpact)
      )}</div><div class="kv"><div class="k">Strategic explanation</div>${para(
        softenLeakProse(l, l.explanation)
      )}</div>`;
      const evidence = leakEvidencePane(l);
      const fix = `<div class="fix"><div class="k">Recommended fix</div>${para(
        l.recommendedFix
      )}<div class="fix-owner">${ownerTag(l.owner)}</div></div>`;
      const impact = dollarCallout(l.dollarImpact, l.overlapNote);
      return `<div class="leak ${cls}" data-priority="${cls}"><div class="rail"></div><div class="lk-body"><div class="lh"><div class="lt">${esc(
        title
      )}${areaTag}</div><div class="badges">${gradeChip(l)}${pill(l.priority, `${l.priority} priority`)}${pill(
        l.difficulty,
        `${l.difficulty} effort`
      )}${ownerTag(l.owner)}</div></div>${impact}<div class="leak-tabs" role="tablist"><button class="leak-tab is-on" type="button" data-tab="summary">Summary</button><button class="leak-tab" type="button" data-tab="evidence">Evidence</button><button class="leak-tab" type="button" data-tab="fix">Recommendation</button></div><div class="leak-pane" data-pane="summary">${summary}</div><div class="leak-pane" data-pane="evidence" hidden>${evidence}</div><div class="leak-pane" data-pane="fix" hidden>${fix}</div></div></div>`;
    })
    .join("");
}

// ── Landing Page Conversion Intelligence (D1 diagnosis half) ──────────────────

function diagPoint(
  title: string,
  p: LandingDiagnosisPoint | undefined,
  authorised: AuthorisedAmounts
): string {
  if (!p) return "";
  const row = (k: string, v: string | undefined, cls = "") => {
    const cv = cleanD1Prose(v, authorised);
    return cv ? `<div class="diag-row ${cls}"><div class="dk">${esc(k)}</div>${para(cv)}</div>` : "";
  };
  return `<div class="diag-card"><div class="dt">${esc(title)}</div>${row(
    "Problem",
    p.problem
  )}${row("What we observed", p.evidence)}${row("Why it matters", p.whyItMatters)}${row(
    "Recommended fix",
    p.recommendedFix,
    "fix"
  )}${row("Expected improvement", p.expectedImprovement)}</div>`;
}

function renderLandingIntelligence(
  li: LandingPageIntelligence,
  authorised: AuthorisedAmounts
): string {
  const parts: string[] = [];

  if (li.executiveDiagnosis)
    parts.push(
      `<div class="label">Landing Page Executive Diagnosis</div><div class="strategy-block">${para(
        cleanD1Prose(li.executiveDiagnosis, authorised)
      )}</div>`
    );

  const diags = [
    diagPoint("Hero Section Diagnosis", li.heroDiagnosis, authorised),
    diagPoint("CTA Strategy Diagnosis", li.ctaDiagnosis, authorised),
    diagPoint("Trust Placement Diagnosis", li.trustDiagnosis, authorised),
  ]
    .filter(Boolean)
    .join("");
  if (diags) parts.push(`<div class="label">Hero · CTA · Trust Diagnosis</div>${diags}`);

  if (li.conversionBottlenecks?.length) {
    const cards = li.conversionBottlenecks
      .map(
        (b) =>
          `<div class="diag-card"><div class="dt">${esc(b.stage)}${pill(
            b.priority,
            `${b.priority} priority`
          )}</div><div class="diag-row"><div class="dk">Current friction</div>${para(
            cleanD1Prose(b.currentFriction, authorised)
          )}</div><div class="diag-row"><div class="dk">Likely visitor behavior</div>${para(
            cleanD1Prose(b.likelyVisitorBehavior, authorised)
          )}</div><div class="diag-row"><div class="dk">Business impact</div>${para(
            cleanD1Prose(b.businessImpact, authorised)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(b.recommendedFix, authorised)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Conversion Bottleneck Analysis</div>${cards}`);
  }

  if (li.technicalUxDiagnosis)
    parts.push(
      `<div class="label">Landing Page Technical UX Diagnosis</div>${para(
        cleanD1Prose(li.technicalUxDiagnosis, authorised)
      )}`
    );

  if (li.fastestWins?.length) {
    const rows = li.fastestWins
      .map(
        (w) =>
          `<tr><td><strong>${esc(stripScaffold(w.fix))}</strong></td><td>${esc(
            cleanD1Prose(w.whyItMatters, authorised)
          )}</td><td>${pill(w.priority, w.priority)}</td><td>${pill(
            w.difficulty,
            w.difficulty
          )}</td><td>${esc(scrubMoney(w.expectedOutcome, authorised))}</td></tr>`
      )
      .join("");
    parts.push(
      `<div class="label">Fastest Landing Page Wins</div><table><thead><tr><th>Fix</th><th>Why it matters</th><th>Priority</th><th>Difficulty</th><th>Expected outcome</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  if (li.trackingRecommendations?.length)
    parts.push(
      `<div class="label">Landing Page Tracking Recommendations</div>${list(
        li.trackingRecommendations.map((t) => stripScaffold(t)).filter(Boolean)
      )}`
    );

  return parts.join("");
}

// Fallback when no dedicated landing module exists (pre-module packs): compose a
// lighter Landing Page Conversion Intelligence section from the file1 audit.
function renderLandingIntelligenceFallback(
  f: AssetPack["file1"],
  authorised: AuthorisedAmounts
): string {
  const parts: string[] = [];

  if (f.ctaStrategy)
    parts.push(
      `<div class="label">CTA Strategy Diagnosis</div>${para(cleanD1Prose(f.ctaStrategy, authorised))}`
    );

  if (f.conversionBottlenecks?.length) {
    const cards = f.conversionBottlenecks
      .map(
        (b) =>
          `<div class="diag-card"><div class="dt">${esc(
            b.stage
          )}</div><div class="diag-row"><div class="dk">Problem</div>${para(
            cleanD1Prose(b.problem, authorised)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(b.fix, authorised)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Conversion Bottleneck Analysis</div>${cards}`);
  }

  if (f.trustGapAnalysis?.length) {
    const cards = f.trustGapAnalysis
      .map(
        (t) =>
          `<div class="diag-card"><div class="dt">${esc(
            t.gap
          )}</div><div class="diag-row"><div class="dk">Impact</div>${para(
            cleanD1Prose(t.impact, authorised)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(t.fix, authorised)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Trust Placement Diagnosis</div>${cards}`);
  }

  if (f.trackingAnalytics?.length)
    parts.push(
      `<div class="label">Landing Page Tracking Recommendations</div>${list(
        f.trackingAnalytics.map((t) => stripScaffold(t)).filter(Boolean)
      )}`
    );

  return parts.join("");
}

// ── THE DIAGNOSIS · reads the saved calculator, never recomputes ──────────────
//
// This replaced the Growth Leak Intelligence Report, which was assembled from
// model-written prose: a scorecard, a leak analysis, a list of "fastest wins" and
// a set of strategic recommendations, all generated from scraped material. The
// client had already been shown a number on the call, and this document quietly
// produced a different one from a different method.
//
// It now renders the assessment the client watched being filled in — the same
// frozen ComputedAssessment the offer page reads, from the same row. Not a copy
// of it, not a recomputation of it: the identical object. verify-build-plan
// asserts the two surfaces print the same total from one source.
//
// When there is no assessment the document says so and stops. It does not fall
// back to generated prose — the fallback IS the failure this rewrite removes.

/** The monthly range as it is printed: the marker once, at the front. */
function rowFigure(r: ComputedRow): string {
  if (r.monthlyLow === null || r.monthlyHigh === null) return "";
  return `${money(r.monthlyLow)}–${money(r.monthlyHigh).replace("CAD $", "")}/mo`;
}

// COST DESCENDING, not catalogue order. The rows used to print in the order the
// six questions are asked, which puts a CAD $200 row above a CAD $2,400 one and
// leaves the reader to work out the ranking for himself.
function byCostDescending(rows: ComputedRow[]): ComputedRow[] {
  return [...rows].sort((a, b) => (b.monthlyHigh ?? 0) - (a.monthlyHigh ?? 0));
}

function renderAssessmentRows(rows: ComputedRow[]): string {
  return byCostDescending(rows)
    .map((r) => {
      const figure = rowFigure(r);
      // .lc-said carries the answer and NOTHING else — the stylesheet prints
      // "In your words" above it, and a "You told us:" prefix inside it says the
      // same thing twice.
      return `<div class="leak-card"><div class="lc-head"><span class="lc-title">${esc(r.label)}${
        r.assumed ? `<span class="pill medium" style="margin-left:8px">Assumed</span>` : ""
      }</span>${figure ? `<span class="lc-cost">${esc(figure)}</span>` : ""}</div>${
        r.answerText ? `<p class="lc-said">${esc(r.answerText)}</p>` : ""
      }${r.consequence ? `<p>${esc(r.consequence)}</p>` : ""}${
        r.fix ? `<p class="lc-fix"><strong>What closes it</strong>${esc(r.fix)}</p>` : ""
      }</div>`;
    })
    .join("");
}

// ── The rows the client volunteered (P0-2) ───────────────────────────────────
// A custom row is a thing the prospect raised that the six questions do not
// cover, and CustomRowInput is `{ label, jobsPerMonth }` — nothing else. So
// computeAssessment writes answerText: null, consequence: null and fix: "" for
// every one of them, and this renderer has no disclosed answer, no consequence
// and no fix to print, nor anything to derive one from.
//
// SO IT PRINTS NO PRICE EITHER. That is the whole decision. A title and a dollar
// figure over an empty card is a priced claim with no reasoning under it, which
// is the single most damaging thing this document can carry — worse than the row
// reading as unpriced. The money is still inside the frozen total (the total is
// the sum of the rounded rows, custom ones included) and the card says so out
// loud rather than letting the arithmetic quietly disagree with the page.
//
// The real fix is upstream and is not the renderer's to make: give CustomRowInput
// the same three strings a LEAKS row carries and collect them on the call.
function renderVolunteeredRows(rows: ComputedRow[]): string {
  return rows
    .map(
      (r) =>
        `<div class="leak-card"><div class="lc-head"><span class="lc-title">${esc(
          r.label
        )}</span></div><p>You raised this one yourself on the call rather than it coming out of the six questions, and you put a rough size on it there and then. It is inside the total at that size. What closes it is something we agree with you at kickoff rather than assume here, so it carries no figure of its own on this page.</p></div>`
    )
    .join("");
}

// A covered area gets the generic card and the existing pill rather than a
// vocabulary of its own. It had five classes — clean-grid, clean-card, cc-head,
// cc-title, cc-flag — and not one of them had a rule in the stylesheet, so the
// whole section rendered unstyled the first time a client answered all six.
function renderCleanRows(rows: ComputedRow[]): string {
  return rows
    .map(
      (r) =>
        `<div class="card"><strong>${esc(r.label)}</strong> ${pill("low", "No leak")}${
          r.answerText ? para(r.answerText) : ""
        }</div>`
    )
    .join("");
}

// ── §01 · the headline panel (P2-2) ──────────────────────────────────────────
// The client's only question is how much this is costing him, and the document
// used to answer it in §02, under seven cards. It now opens with the answer.

/** The three numbers the total was built from.
 *
 *  READ BACK OUT OF THE BASIS SENTENCE, because that is the only place they
 *  survive: computeAssessment consumes monthlyEnquiries, avgJobValue and
 *  closeRatePct and keeps none of them on ComputedAssessment, and threading the
 *  raw inputs through DeliverableContext would mean touching every caller of it.
 *  A tile that does not parse simply does not render — a headline missing an
 *  input is honest, an invented one is not — which is also what keeps this safe
 *  against a saved row whose sentence was written before today's wording. */
function headlineInputs(derivation: string): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  const vol = /([\d,]+)\s+(?:enquir|inquir)\w*\s+a month/i.exec(derivation);
  if (vol) out.push({ k: "Enquiries a month", v: vol[1] });
  const jv = /at\s+((?:CAD\s*)?\$[\d,]+)\s+a job/i.exec(derivation);
  if (jv) out.push({ k: "What a job is worth", v: markCurrency(jv[1]) });
  const close = /(\d+)%\s+close rate/i.exec(derivation);
  if (close) out.push({ k: "Close rate", v: `${close[1]}%` });
  return out;
}

function headlinePanel(a: ComputedAssessment): string {
  const amount = `${money(a.totalLow)}–${money(a.totalHigh).replace("CAD $", "")}`;
  const annual = `${money(a.annualLow)}–${money(a.annualHigh).replace("CAD $", "")} across a year`;
  const inputs = headlineInputs(a.derivation);
  const money_ = `<div><div class="hl-k">Estimated monthly recoverable</div><div class="hl-amount">${esc(
    amount
  )}</div><div class="hl-annual">${esc(annual)}</div></div>`;
  if (!inputs.length) return money_;
  return `<div class="headline">${money_}<div class="hl-inputs">${inputs
    .map(
      (i) =>
        `<div class="hl-input"><div class="k">${esc(i.k)}</div><div class="v">${esc(i.v)}</div></div>`
    )
    .join("")}</div></div>`;
}

/** The three biggest leaks as a share of the total. No chart library: the bar is
 *  a CSS pseudo-element sized from --share.
 *
 *  Only rows that PRINT a figure are ranked. A volunteered row is inside the
 *  total but shows no cost of its own (see renderVolunteeredRows), and ranking a
 *  figure the reader is never shown would put the contradiction back. */
function rankRows(rows: ComputedRow[], totalHigh: number): string {
  const top = byCostDescending(rows).slice(0, 3);
  if (!top.length || totalHigh <= 0) return "";
  return `<div class="rank">${top
    .map((r, i) => {
      const share = Math.round(((r.monthlyHigh ?? 0) / totalHigh) * 100);
      return `<div class="rank-row"><div class="rank-n">${String(i + 1).padStart(
        2,
        "0"
      )}</div><div><div class="rank-name">${esc(
        r.label
      )}</div><div class="rank-bar" style="--share:${share}"></div></div><div class="rank-cost">${esc(
        rowFigure(r)
      )}</div></div>`;
    })
    .join("")}</div>`;
}

// ── §04 · how this was calculated (P2-2, P3-3) ───────────────────────────────

// The basis sentence is computed once and FROZEN on the assessment row — a saved
// assessment is never recomputed, so the client is shown the numbers he was
// actually quoted. That makes the render boundary the only place a wording
// defect in it can be corrected, which is the same reason markCurrency() repairs
// a missing currency marker here rather than upstream.
//
// The defect: the sentence states the overlap discount backwards. Overlap is the
// reason the rows would NOT sum, not the reason they do. The percentage is left
// exactly as computed — it is derived (the overlap cut, plus the plausibility cap
// when that binds), which is why it moves between generations — so it is read
// back out of the sentence rather than restated here.
const BACKWARDS_OVERLAP =
  /Every row is already cut (\d+)% — the same lost lead can show up in more than one, so the rows add up to the total\./;

function repairOverlapSentence(derivation: string): string {
  return derivation.replace(
    BACKWARDS_OVERLAP,
    (_m, pct: string) =>
      `Each row is already reduced by ${pct}% before it's counted, because the same lost lead can show up in more than one leak. That's why the rows sum to the total instead of double-counting it.`
  );
}

function renderMethod(a: ComputedAssessment, meta: AssetPackMeta): string {
  // The cap is disclosed only when it actually bound. Naming it otherwise
  // implies a compression that never happened. The PRE-cap figure is not on the
  // assessment — computeAssessment keeps the adjusted rows and nothing else — so
  // it is not claimed either.
  const cap = a.capped
    ? para(
        "The plausibility cap fired on this one: the figures were compressed so the total stays inside a conservative share of what your own numbers say you turn over. Every row above is already the capped figure, and the percentage in the line above includes that compression."
      )
    : "";
  return `${para(markCurrency(repairOverlapSentence(a.derivation)))}${cap}${diagnosisAssumptions(
    meta
  )
    .map((s) => para(s))
    .join("")}`;
}

function renderDiagnosis(pack: AssetPack, ctx: DeliverableContext): string {
  const a = ctx.assessment;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  if (!a || !a.ready) {
    // No saved calculator. Say exactly that. A diagnosis with no diagnosis in it
    // must not be padded out with generated prose to look complete.
    parts.push(
      section(
        next(),
        "No assessment on file",
        para(
          "This document is built from the assessment we filled in together on the call. " +
            "That assessment has not been saved for this business yet, so there is nothing to report here. " +
            "Once it is saved, this document carries the same figures you were shown, unchanged."
        )
      )
    );
    return shell(
      withoutAssumptions(pack.meta),
      "The Diagnosis",
      parts.join("\n"),
      shellOpts("diagnosis")
    );
  }

  const answered = a.rows.filter((r) => r.answerText !== null);
  const leakRows = answered.filter((r) => !r.clean && r.monthlyHigh !== null);
  const cleanRows = answered.filter((r) => r.clean);
  const customRows = (a.customRows ?? []).filter(
    (r) => r.monthlyHigh !== null && r.label.trim().length > 0
  );

  if (a.allClean) {
    // Nothing is priced, so there is no total to lead with and no basis to
    // explain. One section says the whole of it.
    parts.push(
      section(
        next(),
        "What We Found",
        `${para(
          "Every area we asked about came back covered — after hours, missed calls, response speed, quote follow-up, no-shows, and past customers. On these questions nothing is leaking, so nothing here is priced."
        )}${para(
          "That is a real result, not an empty one. What the build changes is that the coverage you already have stops depending on somebody being free to provide it."
        )}${renderCleanRows(cleanRows)}`
      )
    );
  } else {
    // THE ANSWER FIRST. The money, what it is a year, the three numbers it was
    // built from, and the three biggest rows — before a single leak card.
    parts.push(
      weightedSection(
        next(),
        "What This Is Costing You",
        "sec--key",
        `${headlinePanel(a)}${rankRows(leakRows, a.totalHigh)}`
      )
    );

    parts.push(
      section(
        next(),
        "What We Found",
        `${para(
          "Each of these is an answer you gave on the call, priced against your own two numbers — how many enquiries you get and what a job is worth. The percentages come from published benchmarks, not from guesses about your business."
        )}${renderAssessmentRows(leakRows)}${renderVolunteeredRows(customRows)}`
      )
    );

    if (cleanRows.length) {
      parts.push(
        section(
          next(),
          "Areas That Came Back Covered",
          `${para(
            "We asked about these too. Nothing is priced against them, and they are listed so the report shows everything we checked rather than only what we found."
          )}${renderCleanRows(cleanRows)}`
        )
      );
    }

    // Recessed, and last. The basis belongs to the reader who wants to check the
    // arithmetic; it is not what the document opens with.
    parts.push(
      weightedSection(next(), "How This Was Calculated", "sec--method", renderMethod(a, pack.meta))
    );
  }

  return shell(
    withoutAssumptions(pack.meta),
    "The Diagnosis",
    parts.join("\n"),
    shellOpts("diagnosis")
  );
}

// ── THE BUILD PLAN · the Blueprint and the Roadmap, merged ───────────────────
//
// They were two documents answering one question between them. The Blueprint
// described an architecture without saying when it arrived; the Roadmap gave a
// schedule for something it never fully listed. A client had to hold both open.

// ── Every workflow's copy, gathered from wherever it was generated ───────────
// A workflow's messages are written in four different places: the dedicated
// workflowCopy block, the 60-day nurture emails and texts (file3 / file4), the
// booking and no-show messages (file5) and the thank-you / review copy
// (supportingAssets). Only the first of those recorded WHICH workflow it belonged
// to, so five of the fourteen had their copy filed under a different vocabulary
// in a different section of the Asset Pack, and the Build Plan could not say what
// channels a workflow even used.
//
// One shape, keyed by catalogue id. The Asset Pack renders one block per workflow
// from it, and a Build Plan card derives its channel chips from exactly the
// messages that will ship — not from a second list that can disagree.

interface CopyLine {
  /** When it fires, in the words the message itself carries. */
  when: string;
  /** The generator's own channel word; chanChip() maps it to a tone. */
  channel: string;
  subject?: string;
  body: string;
}

/** The 60-day sequence — emails and texts interleaved back into one order.
 *  `step` is the position across both halves and is the only field that can put
 *  a text between two emails; without it the two halves stay in their own order,
 *  which is what a pack saved before `step` existed carries. */
function nurtureLines(pack: AssetPack): CopyLine[] {
  const emails = (pack.file3.emails ?? []).map((e) => ({
    at: e.step ?? 100 + e.day,
    line: { when: `Day ${e.day}`, channel: "Email", subject: e.subject, body: e.body },
  }));
  const texts = (pack.file4.messages ?? []).map((m) => ({
    at: m.step ?? 200 + m.order,
    line: { when: m.timing || `Text ${m.order}`, channel: "Text", body: m.message },
  }));
  return [...emails, ...texts].sort((a, b) => a.at - b.at).map((x) => x.line);
}

function bookingLines(pack: AssetPack): CopyLine[] {
  const f5 = pack.file5;
  const ty = pack.supportingAssets?.thankYouAssets;
  const out: CopyLine[] = [];
  if (f5.confirmationEmail?.body)
    out.push({
      when: "The moment they book",
      channel: "Email",
      subject: f5.confirmationEmail.subject,
      body: f5.confirmationEmail.body,
    });
  if (ty?.nextStepMessaging)
    out.push({ when: "Straight after the confirmation", channel: "Text", body: ty.nextStepMessaging });
  for (const m of ty?.postPurchaseSequence ?? [])
    out.push({ when: "In the run-up to the visit", channel: "Text", body: m });
  if (f5.reminderEmail24h?.body)
    out.push({
      when: "24 hours before",
      channel: "Email",
      subject: f5.reminderEmail24h.subject,
      body: f5.reminderEmail24h.body,
    });
  if (f5.dayOfReminderSms)
    out.push({ when: "The morning of the visit", channel: "Text", body: f5.dayOfReminderSms });
  return out;
}

// The two recovery texts carry no timing field of their own, so they are
// described by their POSITION rather than by an hour nobody wrote down.
function noShowLines(pack: AssetPack): CopyLine[] {
  const f5 = pack.file5;
  const out: CopyLine[] = [];
  if (f5.noShowRecoveryEmail?.body)
    out.push({
      when: "After a missed visit",
      channel: "Email",
      subject: f5.noShowRecoveryEmail.subject,
      body: f5.noShowRecoveryEmail.body,
    });
  if (f5.noShowRecoverySms1)
    out.push({ when: "First text after the miss", channel: "Text", body: f5.noShowRecoverySms1 });
  if (f5.noShowRecoverySms2)
    out.push({
      when: "Second text, if nothing comes back",
      channel: "Text",
      body: f5.noShowRecoverySms2,
    });
  return out;
}

function reviewLines(pack: AssetPack): CopyLine[] {
  const msg = pack.supportingAssets?.reviewAssets?.postJobRequest;
  // The trigger in this vertical's word for it, same as the card that describes
  // the workflow — a clinic's own copy should not be filed under "the job".
  const when = `Once the ${nounsFor(pack.meta.industry).job} is marked complete`;
  return msg ? [{ when, channel: "Text", body: msg }] : [];
}

/** Copy that was generated OUTSIDE the workflowCopy block, filed under the
 *  workflow that actually sends it. */
const COPY_FILED_ELSEWHERE: Record<string, (pack: AssetPack) => CopyLine[]> = {
  "lead-nurture-no-booking": nurtureLines,
  "booking-confirmation-reminders": bookingLines,
  "no-show-recovery": noShowLines,
  "review-request": reviewLines,
};

function copyLinesFor(id: string, pack: AssetPack): CopyLine[] {
  const stamped = (pack.workflowCopy?.assets ?? []).find((a) => a.workflowId === id);
  const own: CopyLine[] = (stamped?.messages ?? []).map((m) => ({
    when: m.timing || m.step,
    channel: m.channel,
    subject: m.subject,
    body: m.body,
  }));
  return [...own, ...(COPY_FILED_ELSEWHERE[id]?.(pack) ?? [])];
}

// ── Build Plan cards ─────────────────────────────────────────────────────────

/** The chips on a card header. Derived from the messages the workflow will
 *  actually send, so a workflow whose copy is not in this pack shows none rather
 *  than a guess. */
function channelChips(id: string, pack: AssetPack): string {
  const chips: string[] = [];
  for (const line of copyLinesFor(id, pack)) {
    const chip = chanChip(line.channel);
    if (!chips.includes(chip)) chips.push(chip);
  }
  return chips.length ? `<div class="wf-ch">${chips.join("")}</div>` : "";
}

// P3-5 / P3-6 · THE BRACKET TOKENS IN THE CATALOGUE'S PROSE.
// The catalogue writes its example messages with square-bracket shorthand because
// they were written for a human reader. In a client's Build Plan they read as
// unfinished text — and one of them, "since we [job] for you", is not even
// grammatical. Three different things are hiding in that shorthand and they are
// resolved three different ways: a fact we hold (the business name) is
// substituted outright, a word that depends on the vertical comes from the noun
// map, and a value that differs per recipient becomes the merge field that fills
// it, rendered as a chip so it reads as a field rather than as a gap.
//
// [time] means two things across the fourteen — the hour a closed business opens
// again, and the slot a customer missed — so it resolves per workflow rather than
// to one token that would be wrong in the other place.
//
// NO ARTICLE EVER PRECEDES A WORD FROM THE NOUN MAP. The first pass at this wrote
// `a ${nouns.visit}`, and med_spa.visit and dental.visit are both "appointment" —
// so a clinic's Build Plan read "since we saw you for a appointment". Every branch
// below is phrased so the noun follows a possessive and no a/an is ever needed;
// adding one back reintroduces the defect the moment a vowel-initial noun does.
function resolveBracketTokens(escaped: string, id: string, meta: AssetPackMeta): string {
  const nouns = nounsFor(meta.industry);
  const chip = (token: string) => `<code class="mf">${token}</code>`;
  const timeToken =
    id === "after-hours-auto-reply"
      ? "{{custom_values.opening_time}}"
      : "{{appointment.start_time}}";
  return escaped
    .replace(/\[Business\]/g, esc(meta.businessName))
    .replace(
      /we \[job\] for you/g,
      nouns.customerComesToUs
        ? `we saw you for your last ${nouns.visit}`
        : `we did your last ${nouns.job}`
    )
    // The whole of what customerComesToUs decides, in one substitution: a clinic
    // or a firm never went out to anybody, so it may not thank them for it.
    .replace(
      /\[thanks\]/g,
      nouns.customerComesToUs ? "Thanks for coming in" : "Thanks for having us out"
    )
    .replace(/\[jobs\]/g, nouns.jobPlural)
    .replace(/\[job\]/g, nouns.job)
    .replace(/\[name\]/g, chip("{{contact.first_name}}"))
    .replace(/\[booking link\]/g, chip("{{custom_values.booking_link}}"))
    .replace(/\[review link\]/g, chip("{{custom_values.review_link}}"))
    .replace(/\[time\]/g, chip(timeToken));
}

/** The one workflow-level fact that answers "when does this happen". It is
 *  generated for the Asset Pack already; the client reads the Build Plan. */
function firesLine(item: BuildPlanItem, meta: AssetPackMeta): string {
  if (!item.trigger) return "";
  return `<div class="wf-fires"><b>Fires when</b> ${resolveBracketTokens(
    esc(item.trigger),
    item.id,
    meta
  )}</div>`;
}

// FIVE OF THE FOURTEEN ARE DECISIONS, and the document gave the client no way to
// tell which. OFF_WHEN carries the single fact that takes each of them out, so an
// installed one can say that it was decided rather than defaulted — and quote the
// fact, rather than claim an intake answer this renderer does not hold.
function decisionMarker(item: BuildPlanItem): string {
  const offWhen = OFF_WHEN[item.id];
  if (item.state !== "installed" || !offWhen) return "";
  // Quoted verbatim rather than reworded into the sentence: the five reasons are
  // written as standalone facts, and bending them mid-clause is how one of them
  // ends up ungrammatical the day a sixth is added.
  // A LABELLED ROW like every other line in the card, not a full-width paragraph.
  // It was bare prose, which put its text hard against the card's left edge while
  // FIRES WHEN / WHAT IT DOES / WHAT YOU WILL SEE all started in the value column
  // — one line breaking the alignment of every card it appeared in. The <strong>
  // is the label cell, so no wording changed, only where it sits.
  return `<p class="wf-incl"><strong>Included by decision</strong>This one is a choice rather than a default — it comes out when this is true: ${esc(
    offWhen
  )}. That is not you, so it is in.</p>`;
}

function workflowCard(item: BuildPlanItem, pack: AssetPack, meta: AssetPackMeta): string {
  const body = resolveBracketTokens(esc(item.whatItDoes), item.id, meta);
  const tail =
    item.state === "installed"
      ? `<p class="wf-sees"><strong>What you will see</strong>${resolveBracketTokens(
          esc(item.whatTheClientSees),
          item.id,
          meta
        )}</p>`
      : `<p class="wf-why"><strong>${
          item.state === "pending" ? "Confirmed during the build." : "Not installed."
        }</strong> ${esc(item.note ?? "")}</p>`;
  // No `is-off` marker class: it never had a rule, and .wf-why already carries
  // the warn stripe with "Not installed." in words directly underneath it.
  return `<div class="wf-card${
    item.state === "pending" ? " is-pending" : ""
  }"><div class="wf-head"><div class="wf-name">${esc(item.name)}</div>${channelChips(
    item.id,
    pack
  )}</div>${firesLine(item, meta)}<p>${body}</p>${decisionMarker(item)}${tail}</div>`;
}

/** The strip that explains the purchase: five moments, and what fires at each.
 *  Only workflows that are in THIS build are listed — naming one that was
 *  switched off would show the client a journey he is not getting. */
function renderFlow(inBuild: BuildPlanItem[]): string {
  const present = new Set(inBuild.map((w) => w.id));
  return `<div class="flow">${JOURNEY_STAGES.map((s) => {
    const names = s.workflowIds
      .filter((id) => present.has(id))
      .map((id) => workflowById(id)?.name)
      .filter((name): name is string => Boolean(name));
    return `<div class="flow-node${names.length ? " is-live" : ""}"><div class="flow-n">${String(
      s.n
    ).padStart(2, "0")}</div><div class="flow-t">${esc(s.title)}</div><ul class="flow-wf">${names
      .map((name) => `<li>${esc(name)}</li>`)
      .join("")}</ul></div>`;
  }).join("")}</div>`;
}

/** Fourteen near-identical cards in one grid read as a wall. The same fourteen
 *  under the five moments read as a system. */
function renderStageGroups(items: BuildPlanItem[], pack: AssetPack, meta: AssetPackMeta): string {
  const byId = new Map(items.map((w) => [w.id, w]));
  return JOURNEY_STAGES.map((s) => {
    const cards = s.workflowIds
      .map((id) => byId.get(id))
      .filter((w): w is BuildPlanItem => Boolean(w))
      .map((w) => workflowCard(w, pack, meta))
      .join("");
    if (!cards) return "";
    return `<div class="wf-stage"><div class="wf-stage-h"><div class="wf-stage-n">${String(
      s.n
    ).padStart(2, "0")}</div><div class="wf-stage-t">${esc(
      s.title
    )}</div><p class="wf-stage-d">${esc(s.description)}</p></div><div class="wf-grid">${cards}</div></div>`;
  }).join("");
}

// The six columns are catalogue prose too, and two of them named the unit of work
// ("The job is yours"), so a clinic's own pipeline was described to it in trade
// words. Same resolver as the cards — there is one place that knows what this
// vertical calls a job. The workflow id is empty because no stage carries [time].
function renderPipeline(meta: AssetPackMeta): string {
  const cell = (s: string) => resolveBracketTokens(esc(s), "", meta);
  return `<table><thead><tr><th>Stage</th><th>What it means</th><th>A lead arrives when</th><th>A lead leaves when</th></tr></thead><tbody>${PIPELINE.map(
    (s) =>
      `<tr><td><strong>${esc(s.stage)}</strong></td><td>${cell(s.whatItMeans)}</td><td>${cell(
        s.howALeadArrives
      )}</td><td>${cell(s.howALeadLeaves)}</td></tr>`
  ).join("")}</tbody></table>`;
}

// ── The schedule and the money, as one object (P3-4) ─────────────────────────
// They were two sections and three of the schedule's four rows restated a spine
// band — the build paragraph twice, the go-live paragraph verbatim twice. The
// spine bands already carry a WHEN, so the timeline and the price are the same
// object and the only row the schedule owned outright was kickoff. That row stays
// as a row; everything else is the spine.
function renderScheduleAndCosts(dates: BuildDates): string {
  // The note renders ONLY when there is no kickoff date, and it comes FIRST so a
  // reader meets the caveat before the dates rather than after them.
  const caveat = dates.note
    ? `<div class="sched-note"><strong>Dates are not set yet.</strong> ${esc(dates.note)}</div>`
    : "";
  const kickoff = `<div class="schedule"><div class="sched-row"><div class="sr-when">${esc(
    dates.kickoff
  )}</div><div class="sr-main"><div class="sr-title">Kickoff</div><p>We take everything we need from you in one session — access, your numbers, how you want calls handled — and the build starts from there.</p></div></div></div>`;
  return `${caveat}${kickoff}${renderEngagementSpine(dates)}`;
}

function renderBuildPlan(pack: AssetPack, ctx: DeliverableContext): string {
  const plan = ctx.plan;
  const meta = pack.meta;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  // ONE RESOLVED SET, ONE COUNT (P3-1). The document used to say "13 of 14" in
  // §01 and "all 14 are installed" in §02, from two different fields of the same
  // plan: installed.length ignored the pending one, nothingOff ignored it too.
  // Everything below counts the workflows that are IN the build — installed plus
  // pending — and the pending caveat is stated in the same breath as the number
  // rather than contradicted two sections later.
  const inBuild = [...plan.installed, ...plan.pending];

  const pendingNote = plan.pending.length
    ? para(
        `${
          plan.pending.length === 1 ? "One of them is" : `${plan.pending.length} of them are`
        } marked below as confirmed during the build: in your build, and dependent on something on your side we cannot check from here. We tell you either way.`
      )
    : "";

  parts.push(
    section(
      next(),
      "What We Install",
      `${para(
        `${inBuild.length} of ${plan.totalWorkflows} automations are in your build, stood up, tested and live inside your account. Each one runs on its own — none of them depends on somebody remembering.`
      )}${pendingNote}${renderFlow(inBuild)}${renderStageGroups(inBuild, pack, meta)}`
    )
  );

  // NO SILENT OMISSION, WITHOUT SAYING IT TWICE. A client who cannot tell whether
  // anything was left out will assume something was — so anything switched off is
  // named here with its reason. When nothing is off there is nothing to name, and
  // the section suppresses itself: §01 has already accounted for all fourteen.
  if (plan.off.length) {
    parts.push(
      section(
        next(),
        "What Is Not Installed, and Why",
        `${para(
          `${plan.off.length} of the ${plan.totalWorkflows} workflows are not in your build, and each one is listed with the reason. They are named rather than quietly dropped so you can see exactly what was decided and tell us if we got it wrong.`
        )}<h3 class="sub-h">Not installed for you</h3><div class="wf-grid">${plan.off
          .map((w) => workflowCard(w, pack, meta))
          .join("")}</div>`
      )
    );
  }

  parts.push(
    section(
      next(),
      "Your Pipeline",
      `${para(
        "Every enquiry lands in one of six columns and moves through them as it progresses. This is the board you open to see where the work is."
      )}${renderPipeline(meta)}`
    )
  );

  parts.push(
    weightedSection(
      next(),
      "The Schedule, and What It Costs",
      "sec--key",
      renderScheduleAndCosts(plan.dates)
    )
  );

  return shell(
    withoutAssumptions(meta),
    "The Build Plan",
    parts.join("\n"),
    shellOpts("build-plan")
  );
}

// ── D3 · Conversion Asset Pack · INTERNAL ─────────────────────────────────────
//
// The "Used: … / Purpose: …" frame that used to head each section is gone with
// the client framing (P3-8). It was selling the section back to its reader —
// "Purpose: reduce buyer's remorse" — on a document only an operator opens, and
// every asset underneath already carries the one line that operator needs, which
// is where it goes.

// ── Where each asset actually goes (D4) ───────────────────────────────────────
// D3 is the only deliverable a client is expected to ACT on, and until now it told
// them what the copy said without telling them where to put it. A section-level
// "Used: booking page copy" is not an instruction: an owner holding six SMS
// messages still has to work out which automation each one belongs to. So every
// asset now carries its own destination — the exact surface, or the named
// workflow step that sends it.
//
// The workflow names are READ FROM THE CATALOGUE, never retyped. workflow-catalogue
// is the single source of truth for the fourteen workflows in the build; a name
// copied into this file would be a fifteenth version of it that drifts silently.

/** One destination line on an asset. */
function destination(where: string): string {
  if (!where) return "";
  return `<div class="dest"><span class="dest-k">Where this goes</span>${esc(where)}</div>`;
}

/** The GoHighLevel path a workflow's copy is pasted into. It mirrors
 *  WORKFLOW_WHERE_PREFIX in asset-generation.ts, which stamps the same string
 *  onto a generated workflowCopy asset — this is the FALLBACK for a workflow
 *  whose copy the pack filed somewhere else and therefore never stamped. */
const GHL_WORKFLOW_PATH = "GoHighLevel → Automation → Workflows → ";

/** The key names an asset may carry its own destination under. Deliberately the
 *  same vocabulary as EXPLICIT_SURFACE_KEYS in validate-pack.ts, so the field that
 *  SATISFIES the "every D3 asset names its surface" law is the same field that
 *  gets RENDERED — a pack could otherwise pass the gate carrying a destination no
 *  reader ever sees.
 *
 *  `whereToUse` / `whereToPlaceIt` are excluded on purpose: they already render
 *  under their own "Where to place it" heading, and reading them here would print
 *  the same sentence twice on the same card. */
const CARRIED_DESTINATION_KEYS = [
  "destination",
  "goesTo",
  "installedOn",
  "livesOn",
  "placement",
  "surface",
  "whereItGoes",
] as const;

/** Read a destination the GENERATION side has attached to an asset, if it is
 *  there. Structural (not typed) on purpose: the generation-side field is landing
 *  separately, and a renderer that hard-required it would either fail to compile
 *  before that lands or drop the destination on every pack already saved without
 *  it. Present ⇒ it wins; absent ⇒ the deterministic map below answers. */
function carriedDestination(asset: unknown): string | undefined {
  if (!asset || typeof asset !== "object") return undefined;
  const bag = asset as Record<string, unknown>;
  for (const key of CARRIED_DESTINATION_KEYS) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** The surfaces the build actually has. Written once so every destination line in
 *  D3 uses the same words for the same place.
 *
 *  These are SENTENCE-LEADING strings — a destination line starts with one. Do not
 *  .toLowerCase() them to drop one mid-sentence: it turns "GoHighLevel" into
 *  "gohighlevel" and "LeadGate" into "leadgate" in front of a client. Write the
 *  mid-sentence wording out instead. */
const SURFACE = {
  bookingPage: "The booking page we build inside your GoHighLevel sub-account",
  captureForm: "Your lead-capture form",
  leadGate: "The LeadGate qualification screen",
  webchat: "The webchat launcher",
  trackedNumber: "Your dedicated tracked phone number",
  advisory: "Advisory — hand to whoever looks after your website",
} as const;

/** Route one call-to-action label to the surface it belongs on, from the `type`
 *  the generator already assigns it (Primary / Secondary / Phone / Booking /
 *  Low-friction / Final). These six are not six buttons on one page — they are
 *  buttons on four different surfaces, which is the whole reason the type exists. */
function ctaDestination(type: string | undefined): string {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("phone") || t.includes("call")) return SURFACE.trackedNumber;
  if (t.includes("low") || t.includes("chat")) return SURFACE.webchat;
  if (t.includes("secondary")) return `${SURFACE.captureForm} — the alternate route`;
  if (t.includes("booking")) return `${SURFACE.bookingPage} — the calendar block`;
  if (t.includes("final") || t.includes("close"))
    return `${SURFACE.bookingPage} — the closing block`;
  if (t.includes("primary")) return `${SURFACE.bookingPage} — primary button`;
  return SURFACE.bookingPage;
}

// ── Landing Page Conversion Assets (D3 assets half) ───────────────────────────

function renderLandingAssets(la: LandingPageAssets): string {
  // Lead with the actual ready-to-paste copy (spec 03 / Law: D3 is COPY, not a
  // structure lecture). The recommended-structure reference is demoted to a
  // compact appendix at the very end.
  const parts: string[] = [];

  const h = la.heroCopy;
  if (h) {
    let hero = "";
    if (h.headlineOptions?.length)
      hero += `<div class="label">Headline options — paste one</div>${destination(
        `${SURFACE.bookingPage} — the headline`
      )}<ol class="opt-list">${h.headlineOptions
        .map((o) => `<li>${esc(o)}</li>`)
        .join("")}</ol>`;
    if (h.subheadlineOptions?.length)
      hero += `<div class="label">Subheadline options</div>${destination(
        `${SURFACE.bookingPage} — the line under the headline`
      )}<ol class="opt-list">${h.subheadlineOptions
        .map((o) => `<li>${esc(o)}</li>`)
        .join("")}</ol>`;
    // Each micro-asset names its own slot: these four go to four different places,
    // and the two button labels are ALSO the labels on the lead-capture form.
    const micro = [
      h.primaryCta
        ? `<div class="diag-row"><div class="dk">Primary button</div><p>${esc(
            h.primaryCta
          )}</p>${destination(`${SURFACE.bookingPage} — primary button, and the submit button on your lead-capture form`)}</div>`
        : "",
      h.secondaryCta
        ? `<div class="diag-row"><div class="dk">Secondary button</div><p>${esc(
            h.secondaryCta
          )}</p>${destination(`${SURFACE.bookingPage} — secondary button, and the alternate route on your lead-capture form`)}</div>`
        : "",
      h.trustMicrocopy
        ? `<div class="diag-row"><div class="dk">Trust line under the button</div><p>${esc(
            h.trustMicrocopy
          )}</p>${destination(`${SURFACE.bookingPage} — the reassurance line directly under the button`)}</div>`
        : "",
      // Same ban as the proof-line label further down: page geometry may not
      // reach a document, and this legacy path emitted it twice. The pack FIELD
      // keeps its name — renaming it would migrate every stored pack to fix a
      // string nobody reads — but what renders names the neighbouring slot.
      h.aboveFoldProofLine
        ? `<div class="diag-row"><div class="dk">Proof line — under the trust line</div><p>${esc(
            h.aboveFoldProofLine
          )}</p>${destination(`${SURFACE.bookingPage} — under the trust line`)}</div>`
        : "",
    ]
      .filter(Boolean)
      .join("");
    if (micro) hero += `<div class="diag-card">${micro}</div>`;
    // "first thing visitors see" is the same forbidden claim in a heading: it
    // describes a viewport we never rendered. The section is the hero; saying
    // what is in it is enough.
    if (hero) parts.push(`<div class="label">Hero — the headline and the buttons</div>${hero}`);
  }

  // The three long-form paragraphs have no slot on a short booking page, so they
  // are ADVISORY copy the client hands to their own web person — the honest
  // default, because it keeps the words and promises nothing about a page we have
  // not agreed to build.
  if (la.problemCopy)
    parts.push(
      `<div class="label">Problem section — paste as written</div>${destination(
        SURFACE.advisory
      )}${para(la.problemCopy)}`
    );
  if (la.solutionCopy)
    parts.push(
      `<div class="label">Value / solution section — paste as written</div>${destination(
        SURFACE.advisory
      )}${para(la.solutionCopy)}`
    );
  if (la.trustCopy)
    parts.push(
      `<div class="label">Trust / proof section — paste as written</div>${destination(
        SURFACE.advisory
      )}${para(la.trustCopy)}`
    );

  if (la.ctaOptions?.length) {
    const cards = la.ctaOptions
      .map(
        (c) =>
          // Destination FIRST — the surface this label is installed on, decided by
          // its own type — then the generator's finer placement note. The other
          // order reads as a contradiction: a placement written in generic
          // landing-page terms ("hero, sticky header") lands before the reader
          // knows which surface is being talked about.
          `<div class="diag-card"><div class="dt">${esc(c.label)}${
            c.type ? `<span class="chip">${esc(c.type)}</span>` : ""
          }</div>${destination(carriedDestination(c) ?? ctaDestination(c.type))}${
            c.whereToUse
              ? `<div class="diag-row"><div class="dk">Where to place it</div><p>${esc(c.whereToUse)}</p></div>`
              : ""
          }</div>`
      )
      .join("");
    parts.push(`<div class="label">Call-to-action buttons — paste these</div>${cards}`);
  }

  if (la.faq?.length) {
    const cards = la.faq
      .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
      .join("");
    parts.push(
      `<div class="label">FAQ / objection handling — paste as written</div>${destination(
        `${SURFACE.bookingPage} — the questions block, and the same answers feed the LeadGate qualification screen`
      )}${cards}`
    );
  }

  if (la.thankYouPageCopy)
    parts.push(
      `<div class="label">Thank-you page copy — paste as written</div>${destination(
        `${SURFACE.captureForm} — the page shown the moment somebody submits it`
      )}${para(la.thankYouPageCopy)}`
    );

  // Compact structure reference (appendix) — a brief note is allowed, but it is
  // not the substance of the deliverable.
  if (la.recommendedStructure?.length) {
    const rows = la.recommendedStructure
      .map(
        (s, i) =>
          `<tr><td><span class="struct-num">${String(i + 1).padStart(2, "0")}</span>${esc(
            s.name
          )}</td><td>${esc(s.purpose)}</td></tr>`
      )
      .join("");
    parts.push(
      `<div class="label">Page order — for whoever assembles the page</div>${destination(
        SURFACE.advisory
      )}<table><thead><tr><th>Section</th><th>What it does</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  // NOT deployment instructions — this array carries the scope language that says
  // we do not build websites. It is the sentence that protects the offer, so it
  // renders under a heading that says what it is.
  if (la.implementationNotes?.length)
    parts.push(
      `<div class="label">Standing rules for whoever applies this</div>${destination(
        SURFACE.advisory
      )}${list(la.implementationNotes)}`
    );

  return parts.join("");
}

/** THE CURRENT D3 COPY SECTION — the five surfaces the build actually has.
 *
 *  WHY THIS EXISTS AT ALL. Deleting the landing-page call moved this copy from
 *  `pack.landing` to `pack.surfaces`, and for a while the renderer read only the
 *  two OLD shapes. Both are absent on a newly generated pack, so the booking-page,
 *  capture-form, LeadGate and webchat copy was being generated and then silently
 *  dropped on the floor — the exact "it vanished" failure the inventory was
 *  written to prevent, displaced one layer down from generation into rendering.
 *  The committed fixture hid it, because the fixture builder still writes the old
 *  `file1.landingPage`, so every check stayed green while a real pack lost a
 *  section. Any future move of this copy has to move this reader with it.
 *
 *  Every group prints its own stamped `where`, because an operator pasting into
 *  GoHighLevel must never have to guess which box a string belongs in. */
function renderConversionSurfaces(
  s: NonNullable<AssetPack["surfaces"]>,
  siteMeasured: boolean
): string {
  const parts: string[] = [];

  const bp = s.bookingPage;
  if (bp) {
    const opts = (label: string, xs: string[]) =>
      xs?.length ? `<div class="label">${label}</div>${list(xs)}` : "";
    const sections = bp.sectionOrder?.length
      ? `<div class="label">Section order — top to bottom</div><table><thead><tr><th>Section</th><th>What it does</th><th>Copy</th></tr></thead><tbody>${bp.sectionOrder
          .map(
            (x) =>
              `<tr><td>${esc(x.name)}</td><td>${esc(x.purpose)}</td><td>${esc(x.copy)}</td></tr>`
          )
          .join("")}</tbody></table>`
      : "";
    const faq = bp.faq?.length
      ? `<div class="label">FAQ</div>${bp.faq
          .map((f) => `<p><strong>${esc(f.question)}</strong><br>${esc(f.answer)}</p>`)
          .join("")}`
      : "";
    parts.push(
      `<div class="label">Booking page — the one page we build for you</div>${destination(
        bp.where
      )}${opts("Headline — pick one", bp.headlineOptions)}${opts(
        "Subheadline — pick one",
        bp.subheadlineOptions
      )}<div class="dest"><span class="dest-k">Primary button</span>${esc(bp.primaryButton)}</div><div class="dest"><span class="dest-k">Secondary button</span>${esc(
        bp.secondaryButton
      )}</div>${
        // Both of these used to render as floating paragraphs under the buttons —
        // "5-star rating from happy clients." with nothing saying what it was or
        // where it went. They are two different slots on the page and each says so.
        bp.reassuranceLine
          ? `<div class="label">Reassurance line — directly under the button</div>${para(
              bp.reassuranceLine
            )}`
          : ""
      }${
        // This label read "Proof line — above the fold" until 2026-08-13, and page
        // geometry is forbidden vocabulary in a document we ship. The ban is not
        // about findings only: we render no page and measure no position, so a
        // reader has no way to tell a placement instruction for OUR booking page
        // from a claim about THEIRS. verify-fabrication C7 runs the shipped claim
        // detector over every committed document and refuses the phrase wherever
        // it lands. Naming the neighbouring slot — the way the reassurance line
        // above already does — tells the operator the same thing and asserts
        // nothing about anybody's page.
        bp.proofLine
          ? `<div class="label">Proof line — under the reassurance line</div>${para(bp.proofLine)}`
          : ""
      }${sections}${faq}${
        bp.honestyNote ? para(bp.honestyNote) : ""
      }`
    );
  }

  const cf = s.leadCaptureForm;
  if (cf)
    parts.push(
      `<div class="label">Lead capture form</div>${destination(cf.where)}<p><strong>Heading:</strong> ${esc(
        cf.formHeadline
      )}</p>${para(cf.formIntro)}<p><strong>Submit button:</strong> ${esc(
        cf.submitButton
      )}</p><p><strong>After they send it:</strong> ${esc(cf.postSubmitHeadline)}</p>${para(
        cf.postSubmitCopy
      )}${cf.emergencyRoute ? para(cf.emergencyRoute) : ""}`
    );

  // "If it's urgent" pairs with the "Otherwise" under it, and what it labels is
  // an URGENT LEAD rather than a kind of work — so it needs no trade noun and now
  // has none. It read "If they're a priority job" in a clinic's document.
  const lg = s.leadGate;
  if (lg)
    parts.push(
      `<div class="label">Qualifying questions — what the caller sees</div>${destination(
        lg.where
      )}${para(lg.openingLine)}${
        lg.questionIntros?.length ? list(lg.questionIntros) : ""
      }<p><strong>If it's urgent:</strong> ${esc(
        lg.priorityAcknowledgement
      )}</p><p><strong>Otherwise:</strong> ${esc(lg.standardAcknowledgement)}</p>`
    );

  const wc = s.webchat;
  if (wc)
    parts.push(
      `<div class="label">Website chat</div>${destination(wc.where)}<p><strong>Bubble label:</strong> ${esc(
        wc.launcherLabel
      )}</p>${para(wc.greeting)}${para(wc.detailsAsk)}<p><strong>Outside hours:</strong> ${esc(
        wc.awayMessage
      )}</p>`
    );

  // ADVISORY, and it has to look advisory. These are notes the client hands to
  // whoever runs their website. We do not touch the site, and a reader must never
  // finish this section thinking we did.
  //
  // AND IT ONLY EXISTS WHEN SOMEBODY LOOKED (P1-1). The generator writes these
  // notes whether or not there was a site to look at, so for a business with no
  // URL on record this block rendered a table headed "What we saw" with four
  // specific observations about a page nobody opened — the cold-audit fabrication
  // failure, with the pack's own "no website URL on record" note sitting above it.
  // `siteMeasured` is the caller's answer to "was this site actually measured".
  // When it is false the block does not render: not hedged, not disclaimed, gone.
  const ad = siteMeasured ? s.siteAdvisory : undefined;
  if (ad) {
    const notes = ad.notes?.length
      ? `<table><thead><tr><th>Area</th><th>What we saw</th><th>What we'd suggest</th></tr></thead><tbody>${ad.notes
          .map(
            (n) =>
              `<tr><td>${esc(n.area)}</td><td>${esc(n.whatWeSaw)}</td><td>${esc(
                n.recommendation
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      : "";
    parts.push(
      `<div class="label">Your own website — advisory only</div>${destination(ad.where)}${para(
        ad.scopeNote
      )}${para(ad.summary)}${notes}${
        ad.standingRules?.length
          ? `<div class="label">Standing rules for whoever applies this</div>${list(ad.standingRules)}`
          : ""
      }`
    );
  }

  return parts.join("");
}

// ── §02 · one block per workflow, and every workflow's copy in it (P0-4) ─────
//
// The section header said "every automation's messages" over nine of the
// fourteen. The other five had their copy generated — it was in the same file —
// filed under a different destination vocabulary in three other sections, so an
// operator pasting the build into GoHighLevel had to reassemble it by reading.
// Now the fourteen are the structure: one block each, in the same order the
// Build Plan puts them, each naming its GoHighLevel path and what fires it.
//
// TWO COLUMNS, NOT FOUR. Step / Channel / Timing were three columns carrying one
// fact between them, leaving a 40-word SMS and a merge-field list to share what
// was left of the width. The channel is a chip on the WHEN, and the merge fields
// are chips inside the message where they actually appear — so the trailing
// "Merge fields: …" line is gone with the columns.

function msgTable(lines: CopyLine[]): string {
  if (!lines.length) return "";
  const rows = lines
    .map(
      (l) =>
        `<tr><td class="msg-when">${esc(l.when)}${chanChip(l.channel)}</td><td>${
          l.subject ? `<span class="msg-subj">${mergeChips(esc(l.subject))}</span>` : ""
        }${mergeChips(esc(l.body))}</td></tr>`
    )
    .join("");
  return `<table class="msg-table"><thead><tr><th>When</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderWorkflowCopy(pack: AssetPack, plan: BuildPlan): string {
  const stamped = pack.workflowCopy?.assets ?? [];
  const coverage = pack.workflowCopy?.coverage ?? [];
  const inBuild = [...plan.installed, ...plan.pending];
  const order = new Map(inBuild.map((w) => [w.id, w]));

  return JOURNEY_STAGES.flatMap((s) => s.workflowIds)
    .map((id) => {
      const item = order.get(id);
      if (!item) return ""; // switched off for this client — no copy to paste
      const asset = stamped.find((a) => a.workflowId === id);
      const lines = copyLinesFor(id, pack);
      const where = asset?.where || `${GHL_WORKFLOW_PATH}${item.name}`;
      const fires = asset?.trigger || item.trigger;
      // A workflow in the build with no copy anywhere is the failure this
      // section exists to make impossible, so it is stated rather than skipped.
      // coverage[] is the generation side's own record of where a workflow's
      // words live; when it has an answer, print it instead of a bare gap.
      const body = lines.length
        ? msgTable(lines)
        : para(
            coverage.find((c) => c.workflowId === id)?.copyLivesIn ??
              "No copy for this workflow in this pack — write it before go-live."
          );
      // Same resolver as the Build Plan card: the trigger is catalogue prose and
      // carries the same [job] shorthand, so escaping it alone would print the
      // brackets into the one document an operator pastes from.
      return `<div class="label">${esc(item.name)}</div>${destination(where)}${
        fires
          ? `<div class="wf-fires"><b>Fires when</b> ${resolveBracketTokens(
              esc(fires),
              id,
              pack.meta
            )}</div>`
          : ""
      }${body}`;
    })
    .join("");
}

// Fallback when no dedicated landing module exists: render the file1 landing copy.
function renderLandingAssetsFallback(lp: AssetPack["file1"]["landingPage"] | undefined): string {
  if (!lp) return "";
  return `<div class="hero-quote">${esc(lp.heroHeadline)}</div>${para(
    lp.heroSubheadline
  )}<div class="label">CTA block</div>${para(lp.ctaBlock)}<div class="label">Problem</div>${para(
    lp.problemSection
  )}<div class="label">Solution</div>${para(lp.solutionSection)}<div class="label">Offer</div>${para(
    lp.offerSection
  )}<div class="label">Benefits</div>${list(lp.benefits)}<div class="label">Trust / proof</div>${para(
    lp.trustSection
  )}${
    lp.faq?.length
      ? `<div class="label">FAQ / Objection Handling</div>${lp.faq
          .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
          .join("")}`
      : ""
  }<div class="label">Final CTA</div>${para(lp.finalCta)}`;
}

function renderDeliverable3(pack: AssetPack, ctx: DeliverableContext): string {
  const f1 = pack.file1;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  // ── THE OPERATOR HEADER (P3-8) ────────────────────────────────────────────
  // This document is read by one person, once, with GoHighLevel open beside it.
  // It was built as a client deliverable, and none of that framing helps somebody
  // pasting copy into a sub-account. What he needs is which account he is in and
  // what order to work through.
  //
  // The cover above it still comes from shell() and still reads "Prepared for",
  // with a confidentiality footer under it. Replacing those is a _shell.ts
  // change, not one this file can make.
  // en-CA to match the cover. These disagreed: the cover said "August 13, 2026"
  // and this said "13 August 2026", in the same document.
  const generatedOn = new Date(pack.meta.generatedAt).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  parts.push(
    section(
      next(),
      "Before You Paste Anything",
      `<div class="dest"><span class="dest-k">Target sub-account</span>${esc(
        pack.meta.businessName
      )} — GoHighLevel</div><div class="dest"><span class="dest-k">Generated</span>${esc(
        generatedOn
      )}</div>${list(
        [
          "Open the sub-account above and confirm you are in the right one before pasting anything.",
          "Surfaces first — the booking page, the lead-capture form, the qualifying questions and the webchat. Each block names the exact screen.",
          "Then the workflows, in the order they are listed. Each block names its GoHighLevel path and what fires it.",
          "Send one real lead through before go-live and confirm every merge field resolved to a value rather than to blank text.",
        ],
        true
      )}`
    )
  );

  // Landing Page Conversion Assets — the actual recommended page copy/assets,
  // absorbed from the old Landing Page Growth Audit. Prefer the dedicated landing
  // module; fall back to the file1 landing copy for pre-module packs.
  // THREE SHAPES, NEWEST FIRST. `surfaces` is what a pack generated today
  // carries; `landing` is the deleted 10th call, still present on packs saved
  // before it went; `file1.landingPage` is older still. Packs are never deleted,
  // so a document made last month has to keep rendering exactly as it did — which
  // is why the two legacy readers stay rather than being cleaned away.
  // BOTH FACTS, NOT EITHER (P1-1). `websiteScraped` is set from the analysis of
  // HTML actually fetched from the business's own URL — no URL on the row means
  // no fetch, means false — and `performanceMeasured` from a page-speed run
  // against that same page. A site advisory needs both: without the fetch there
  // is no page to describe, and without the timing there is no "how it performs".
  // An older pack carries no signals at all, which is not evidence that anybody
  // looked, so it reads as false and the block stays out.
  const signals = pack.meta.signals;
  const siteMeasured = Boolean(signals?.websiteScraped && signals?.performanceMeasured);
  const surfacesBody = pack.surfaces
    ? renderConversionSurfaces(pack.surfaces, siteMeasured)
    : "";
  const landingBody =
    surfacesBody ||
    (pack.landing?.assets
      ? renderLandingAssets(pack.landing.assets)
      : renderLandingAssetsFallback(f1.landingPage));

  // The two screens that are page copy rather than workflow copy: the show-up
  // framing carried on the booking page, and the confirmation screen a completed
  // booking lands on. They belong with the surfaces, not with the messages.
  const f5 = pack.file5;
  const ty = pack.supportingAssets?.thankYouAssets;
  const bookingScreens = `${
    f5.headline
      ? `<div class="label">Booking page — the show-up framing</div>${destination(
          `${SURFACE.bookingPage} — the headline and the line under it`
        )}<div class="hero-quote">${esc(f5.headline)}</div>${para(f5.subheadline)}`
      : ""
  }${
    ty?.thankYouPageCopy
      ? `<div class="label">Thank-you screen</div>${destination(
          `${SURFACE.bookingPage} — the confirmation screen shown the moment somebody books`
        )}${para(ty.thankYouPageCopy)}`
      : ""
  }`;

  if (landingBody || bookingScreens) {
    parts.push(
      section(
        next(),
        surfacesBody ? "Conversion Surfaces — the copy that goes live" : "Landing Page Conversion Assets",
        `${landingBody}${bookingScreens}`
      )
    );
  }

  // Every workflow in the build, with its messages. Without this the operator
  // writes the owner notification, the review replies and the reactivation
  // campaign by hand inside the client's account on go-live day — unbilled work
  // in an inconsistent voice, at the moment the client is watching.
  const workflowBody = renderWorkflowCopy(pack, ctx.plan);
  if (workflowBody) {
    parts.push(section(next(), "Workflow Copy — every automation's messages", workflowBody));
  }

  return shell(
    withoutAssumptions(pack.meta),
    "Conversion Asset Pack",
    parts.join("\n"),
    shellOpts("asset-pack")
  );
}

// ── The engagement spine ─────────────────────────────────────────────────────
// The two prices, attached to the two WINDOWS the commercials actually define.
//
// DETERMINISTIC, AND DELIBERATELY SO. Every word and both figures come from the
// engagement itself (constants.ts is the single source of the two prices), never
// from the model. What we charge is not something a generation gets to
// paraphrase.
//
// It reads the SAME BuildDates the schedule above does, so the money and the
// calendar can never disagree — and when kickoff is unbooked both render
// relative to it rather than one of them inventing a date.
// Go-live prints its window in BOTH states. It used to render bare — "Go-live." —
// whenever there was no kickoff date, which dropped the one thing the client is
// reading this section to find out. buildDates() already writes an honest
// unanchored form ("14 days after kickoff"): it invents no calendar date, so
// there was nothing to protect the reader from. The two spine bands were already
// printing their unanchored windows either side of it.
function renderEngagementSpine(dates: BuildDates): string {
  const band = (
    cls: string,
    when: string,
    title: string,
    price: string,
    priceNote: string,
    body: string
  ) =>
    `<div class="spine-band ${cls}"><div class="sb-when">${esc(when)}</div><div class="sb-main"><div class="sb-title">${esc(
      title
    )}</div><p>${esc(body)}</p></div><div class="sb-price"><div class="sb-amount">${esc(
      price
    )}</div><div class="sb-note">${esc(priceNote)}</div></div></div>`;

  return `<div class="spine">${band(
    "is-build",
    dates.buildWindow,
    "The build",
    money(SETUP_FEE_CAD),
    "one-time",
    "Your GoHighLevel sub-account, the tracked number, the booking page, the lead-capture form, the pipeline and the workflows \u2014 stood up, tested and live. This document and the Diagnosis are part of it. This is the window we work to, and anything that slips gets told to you rather than absorbed quietly."
  )}<div class="spine-golive"><span class="sg-dot"></span><div><strong>Go-live \u2014 ${esc(
    dates.goLive
  )}.</strong> The system is switched on and every enquiry from that moment runs through it. Nothing is charged monthly until this point.</div></div>${band(
    "is-run",
    dates.runningFrom,
    "Running it",
    `${money(MONTHLY_RETAINER_CAD)}/month`,
    "monthly, from go-live",
    "LeadGate qualifying every enquiry, us running and tuning the system against what actually arrives, and a written monthly report on answered, missed and booked. It continues month to month on the same terms."
  )}</div>`;
}


// ── Metadata + dispatcher ─────────────────────────────────────────────────────

export const DELIVERABLES: {
  id: DeliverableId;
  title: string;
  subtitle: string;
  filename: string;
  /** Who it is for. `internal` documents are excluded from the client bundle —
   *  the Asset Pack goes out at go-live, not at signing. */
  audience: "client" | "internal";
}[] = [
  {
    id: "diagnosis",
    title: "The Diagnosis",
    subtitle: "What we found on the call, priced against your own numbers",
    filename: "01-the-diagnosis.html",
    audience: "client",
  },
  {
    id: "build-plan",
    title: "The Build Plan",
    subtitle: "What we install, what we don't, and when it goes live",
    filename: "02-the-build-plan.html",
    audience: "client",
  },
  {
    id: "asset-pack",
    title: "Conversion Asset Pack",
    subtitle: "Assets — the copy and messaging that runs the system",
    filename: "03-conversion-asset-pack.html",
    audience: "internal",
  },
];

/** The two the client is sent at signing. Derived, so moving a document between
 *  audiences moves it everywhere at once. */
export const CLIENT_DELIVERABLES = DELIVERABLES.filter((d) => d.audience === "client");

function shellOpts(id: DeliverableId): ShellOptions {
  // Numbered within the CLIENT set, so the two documents a client receives read
  // "01 / 02" and "02 / 02". The internal Asset Pack carries no index — a
  // document nobody outside the company opens does not need a place in a series.
  const idx = CLIENT_DELIVERABLES.findIndex((d) => d.id === id);
  const d = DELIVERABLES.find((x) => x.id === id);
  return {
    subtitle: d?.subtitle,
    docIndex:
      idx === -1
        ? undefined
        : `${String(idx + 1).padStart(2, "0")} / ${String(CLIENT_DELIVERABLES.length).padStart(2, "0")}`,
  };
}

/** Everything the two client documents need that is NOT in the AssetPack.
 *
 *  It is threaded in rather than baked into the pack at generation time, and that
 *  is the whole point: the Diagnosis must read the LIVE frozen assessment — the
 *  same row the offer page reads — so the two can never show a client different
 *  totals. A copy taken at generation would drift the moment the calculator was
 *  corrected. */
export interface DeliverableContext {
  /** LeakAssessment.computed. Null when no calculator has been saved. */
  assessment: ComputedAssessment | null;
  /** Derived from Business.workflowToggles + Business.kickoffAt. */
  plan: BuildPlan;
}

/** Build the context from the two raw column values. One place that knows how a
 *  business row becomes document input. */
export function deliverableContext(input: {
  assessment: ComputedAssessment | null;
  workflowToggles: unknown;
  kickoffAt: Date | null;
}): DeliverableContext {
  return {
    assessment: input.assessment,
    plan: assembleBuildPlan(input.workflowToggles, input.kickoffAt),
  };
}

/** A context for a pack with no business behind it (fixtures, previews of an
 *  old pack). Everything defaults ON and kickoff is unbooked, which is the
 *  honest reading of "we do not know yet" rather than a silent best case. */
export function emptyDeliverableContext(): DeliverableContext {
  return deliverableContext({ assessment: null, workflowToggles: null, kickoffAt: null });
}

export function renderDeliverableHtml(
  pack: AssetPack,
  id: DeliverableId,
  ctx: DeliverableContext = emptyDeliverableContext()
): string {
  switch (id) {
    case "diagnosis":
      return renderDiagnosis(pack, ctx);
    case "build-plan":
      return renderBuildPlan(pack, ctx);
    case "asset-pack":
      return renderDeliverable3(pack, ctx);
  }
}
