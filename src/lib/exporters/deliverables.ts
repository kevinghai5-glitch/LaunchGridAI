// V2 flagship deliverable composer.
//
// Reorganizes the underlying file1..file5 content PLUS the V2 strategic
// components (intelligence, infrastructure, supportingAssets, roadmap) into the
// FOUR client-facing flagship deliverables the platform now sells:
//
//   D1  Growth Leak Intelligence Report          (diagnosis)
//   D2  Client Acquisition Infrastructure Blueprint (architecture)
//   D3  Conversion Asset Pack                     (supporting assets)
//   D4  90-Day Growth Execution Roadmap           (execution guidance)
//
// All V2 components are optional on AssetPack — when missing (pre-V2 packs),
// every renderer falls back to the underlying file content so old packs still
// produce a complete, premium document.

import type {
  AssetPack,
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
import { workflowById } from "../workflow-catalogue";
import { DEFAULT_SETUP_FEE, DEFAULT_MONTHLY } from "../proposal-defaults";
import {
  esc,
  para,
  list,
  section,
  shell,
  pill,
  renderTechnicalUx,
  renderVisuals,
  emailBlock,
  type ShellOptions,
} from "./_shell";

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

function checklist(items: string[] | undefined): string {
  if (!items?.length) return "";
  return `<ul class="checklist">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
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
  out.add(DEFAULT_SETUP_FEE);
  out.add(DEFAULT_MONTHLY);
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

// THE SCOPE BAND. Everything in this D1 section is a recommendation about a
// website we neither build nor host, and that has to be visible without reading a
// paragraph first. Rendered deterministically at the top of the section rather
// than relying on the model to have written the scope sentence into its prose —
// a promise this important cannot be left to whether a generation remembered it.
const SITE_ADVISORY_BAND =
  `<div class="advisory-band"><span class="ab-tag">Advisory</span><div><strong>These are notes for whoever looks after your website — not work we are delivering.</strong> ` +
  `We do not build or host websites. Hand this section to whoever runs your site; the fastest version of all of it is repointing your existing buttons at the booking page and leaving the rest alone. ` +
  `The one page we build and brand for you is the booking page inside your GoHighLevel sub-account.</div></div>`;

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

function renderDeliverable1(pack: AssetPack): string {
  const intel = pack.intelligence;
  const f = pack.file1;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  // Computed ONCE per document and threaded down: every dollar figure this pack's
  // own math produced. Prose anywhere in D1 may repeat these and nothing else.
  const authorised = authorisedAmounts(pack);

  parts.push(section(next(), "Executive Summary", renderExecutiveSummary(pack, authorised)));

  const visuals = renderVisuals(f.visuals);
  if (visuals)
    parts.push(section(next(), "Visual Intelligence (Target vs. Local Competitors)", visuals));

  const tux = renderTechnicalUx(f.technicalUx);
  if (tux) parts.push(section(next(), "Technical UX & Performance", tux));

  // Landing Page Conversion Intelligence — diagnoses the landing page as a
  // conversion system (absorbed from the old Landing Page Growth Audit). Sits
  // between Technical UX and the Growth Leak Scorecard.
  const landingIntel = pack.landing?.intelligence
    ? renderLandingIntelligence(pack.landing.intelligence, authorised)
    : renderLandingIntelligenceFallback(f, authorised);
  if (landingIntel)
    parts.push(
      section(
        next(),
        "Website Conversion Intelligence — Advisory",
        `${SITE_ADVISORY_BAND}${landingIntel}`
      )
    );

  const scorecard = renderScorecard(
    intel?.scorecard.metrics,
    intel?.leakAnalysis ?? [],
    intel?.scorecard.overallReadout
  );
  if (scorecard) parts.push(section(next(), "Conversion Leak Scorecard", scorecard));

  const leaks = renderLeakAnalysis(intel?.leakAnalysis);
  if (leaks) {
    parts.push(section(next(), "Growth Leak Analysis", leaks));
  } else if (f.revenueLeaks?.length) {
    // Fallback to file1 revenue leaks table.
    parts.push(
      section(
        next(),
        "Growth Leak Analysis",
        `<table><thead><tr><th>Issue</th><th>Why it matters</th><th>Impact</th><th>Fix</th></tr></thead><tbody>${f.revenueLeaks
          .map(
            (l) =>
              `<tr><td><strong>${esc(l.issue)}</strong></td><td>${esc(
                l.whyItMatters
              )}</td><td class="score">${esc(l.impact)}/10</td><td>${esc(
                l.recommendedFix
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      )
    );
  }

  // Fastest Revenue Wins
  const wins = intel?.fastestWins;
  if (wins?.length) {
    parts.push(
      section(
        next(),
        "Fastest Revenue Wins",
        `<table><thead><tr><th>Opportunity</th><th>Impact</th><th>Effort</th><th>Speed</th></tr></thead><tbody>${wins
          .map(
            (w) =>
              `<tr><td><strong>${esc(w.opportunity)}</strong></td><td>${esc(
                w.impact
              )}</td><td>${pill(w.difficulty, w.difficulty)}</td><td>${esc(
                w.speed
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      )
    );
  } else if (f.fastestWins?.length) {
    parts.push(section(next(), "Fastest Revenue Wins", list(f.fastestWins)));
  }

  const recs = intel?.strategicRecommendations;
  parts.push(
    section(
      next(),
      "What We Deploy",
      recs?.length ? list(recs) : para(f.positioningStrategy)
    )
  );

  const summary = intel?.executiveSummary;
  const keyActions: NonNullable<ShellOptions["keyActions"]> = [];
  if (summary?.mostUrgentFixes?.length)
    keyActions.push({ title: "Fix now", tone: "urgent", items: summary.mostUrgentFixes });
  if (summary?.quickWins?.length)
    keyActions.push({ title: "Quick wins", tone: "win", items: summary.quickWins });
  if (summary?.biggestThreats?.length)
    keyActions.push({ title: "Watch-outs", tone: "threat", items: summary.biggestThreats });

  return shell(pack.meta, "Growth Leak Intelligence Report", parts.join("\n"), {
    ...shellOpts("d1"),
    keyActions: keyActions.length ? keyActions : undefined,
  });
}

// ── D2 · Client Acquisition Infrastructure Blueprint ──────────────────────────

function renderFunnel(stages: FunnelStage[] | undefined): string {
  if (!stages?.length) return "";
  const blocks = stages
    .map(
      (s, i) =>
        `<div class="funnel-row"><div class="fn-node">${String(i + 1).padStart(
          2,
          "0"
        )}</div><div class="fn-card${s.isRetainer ? " is-retainer" : ""}"><div class="st">${esc(
          s.stage
        )}${
          s.isRetainer ? `<span class="retainer-badge">Monthly retainer · runs continuously</span>` : ""
        }</div>${
          s.role ? `<p><strong>Role.</strong> ${esc(s.role)}</p>` : ""
        }${
          s.currentWeakness
            ? `<p><strong>Current break point.</strong> ${esc(s.currentWeakness)}</p>`
            : ""
        }${
          s.whatWeDeploy
            ? `<p><strong>What we deploy.</strong> ${esc(s.whatWeDeploy)}</p>`
            : ""
        }<div class="fn-meta">${ownerTag(s.owner)}${
          s.kpi ? `<span class="chip">KPI · ${esc(s.kpi)}</span>` : ""
        }</div></div></div>`
    )
    .join("");
  return `<div class="funnel">${blocks}</div>`;
}

function renderLeadTiers(tiers: LeadTier[] | undefined): string {
  if (!tiers?.length) return "";
  const cards = tiers
    .map(
      (t) =>
        `<div class="tier"><div class="tn">${esc(t.tier)}</div><div class="rng">${esc(
          t.range
        )}</div><p>${esc(t.meaning)}</p><p><strong>Action.</strong> ${esc(
          t.action
        )}</p><p class="muted"><strong>Response.</strong> ${esc(
          t.responseTime
        )} · <strong>Owner.</strong> ${esc(t.owner)} · <strong>Method.</strong> ${esc(
          t.followUpMethod
        )}</p></div>`
    )
    .join("");
  return `<div class="tiers">${cards}</div>`;
}

function renderCrmStages(stages: CrmStage[] | undefined): string {
  if (!stages?.length) return "";
  return `<table><thead><tr><th>Stage</th><th>Entry criteria</th><th>Exit criteria</th><th>Ownership</th><th>Review</th></tr></thead><tbody>${stages
    .map(
      (s) =>
        `<tr><td><strong>${esc(s.stage)}</strong></td><td>${esc(
          s.entryCriteria
        )}</td><td>${esc(s.exitCriteria)}</td><td>${esc(s.ownership)}</td><td>${esc(
          s.reviewProcess
        )}</td></tr>`
    )
    .join("")}</tbody></table>`;
}

function renderDeliverable2(pack: AssetPack): string {
  const infra = pack.infrastructure;
  const f2 = pack.file2;
  const f3 = pack.file3;
  const f4 = pack.file4;
  const f5 = pack.file5;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  if (infra?.funnel.overview)
    parts.push(
      section(next(), "Infrastructure Overview", `<div class="strategy-block">${para(
        infra.funnel.overview
      )}</div>`)
    );

  const funnel = renderFunnel(infra?.funnel.stages);
  if (funnel) parts.push(section(next(), "The Conversion Path", funnel));

  // Lead Qualification Framework: tiers + file2 intake/scoring/routing.
  const tiers = renderLeadTiers(infra?.crmPipeline.leadTiers);
  const intake = (f2.questions ?? []).length
    ? `<div class="label">Intake & scoring questions</div>${(f2.questions ?? [])
        .map(
          (q, i) =>
            `<div class="card"><strong>${i + 1}. ${esc(q.question)}</strong><p class="muted">${esc(
              q.purpose
            )} · ${esc(q.scoringImpact)}</p></div>`
        )
        .join("")}`
    : "";
  const routing = f2.routingLogic?.length
    ? `<div class="label">Routing logic</div><table><thead><tr><th>Tier</th><th>Timing</th><th>Action</th></tr></thead><tbody>${f2.routingLogic
        .map(
          (r) =>
            `<tr><td><strong>${esc(r.tier)}</strong></td><td>${esc(r.timing)}</td><td>${esc(
              r.action
            )}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "";
  const crmFields = f2.crmFields?.length
    ? `<div class="label">CRM fields to capture</div>${list(f2.crmFields)}`
    : "";
  parts.push(
    section(
      next(),
      "Lead Qualification Framework",
      `${tiers}${intake}${routing}${crmFields}`
    )
  );

  // Follow-Up Operating System: SMS (file4) + email (file3) + reply strategy.
  const sms = (f4.messages ?? []).length
    ? `<div class="label">SMS follow-up framework</div>${(f4.messages ?? [])
        .map(
          (m) =>
            `<div class="card"><div class="label">Send ${esc(m.timing)}</div><p><strong>${esc(
              m.message
            )}</strong></p><p class="muted">${esc(m.psychology)} · On reply: ${esc(
              m.replyStrategy
            )}</p></div>`
        )
        .join("")}`
    : "";
  const emailRhythm = (f3.emails ?? []).length
    ? `<div class="label">Email nurture rhythm</div><table><thead><tr><th>Day</th><th>Purpose</th><th>Subject</th></tr></thead><tbody>${(
        f3.emails ?? []
      )
        .map(
          (e) =>
            `<tr><td>${esc(e.day)}</td><td>${esc(e.purpose)}</td><td>${esc(
              e.subject
            )}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "";
  parts.push(
    section(next(), "Follow-Up Operating System", `${sms}${emailRhythm}`)
  );

  // Booking & Show-Up System (file5).
  parts.push(
    section(
      next(),
      "Booking & Show-Up System",
      `${f5.whatToExpect?.length ? `<div class="label">What to expect</div>${list(f5.whatToExpect)}` : ""}${
        f5.appointmentPositioning
          ? `<div class="label">Appointment positioning</div>${para(f5.appointmentPositioning)}`
          : ""
      }${
        f5.showUpQualityNotes
          ? `<div class="label">Show-up quality</div>${para(f5.showUpQualityNotes)}`
          : ""
      }${
        f5.rescheduleFraming
          ? `<div class="label">Reschedule framing</div>${para(f5.rescheduleFraming)}`
          : ""
      }`
    )
  );

  // CRM / Pipeline Blueprint.
  const crm = renderCrmStages(infra?.crmPipeline.stages);
  if (crm) {
    parts.push(
      section(
        next(),
        "CRM & Pipeline Blueprint",
        `${
          infra?.crmPipeline.overview
            ? `<div class="strategy-block">${para(infra.crmPipeline.overview)}</div>`
            : ""
        }${crm}`
      )
    );
  }

  return shell(
    pack.meta,
    "Client Acquisition Infrastructure Blueprint",
    parts.join("\n"),
    shellOpts("d2")
  );
}

// ── D3 · Conversion Asset Pack ────────────────────────────────────────────────

function assetFrame(where: string, purpose: string): string {
  return `<div class="asset-frame"><span class="chip where">Used: ${esc(
    where
  )}</span><span class="chip">Purpose: ${esc(purpose)}</span></div>`;
}

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

/** A destination naming a real workflow from the build, plus which step of it.
 *  Falls back to the raw step text if the id is ever removed from the catalogue,
 *  so a catalogue edit degrades to a vaguer line rather than to "undefined". */
function workflowStep(id: string, step: string): string {
  const w = workflowById(id);
  return w ? `${w.name} workflow · ${step}` : step;
}

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

/** Route one SMS to the workflow that sends it, from the timing line the message
 *  already carries ("Within seconds of a missed call"). Keyword-matched against the
 *  trigger vocabulary the generator writes, most specific first.
 *
 *  The fallback names the sub-account rather than guessing a workflow: a message
 *  attributed to the wrong automation is worse than one attributed to none, because
 *  the operator would wire it there. */
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

function smsDestination(timing: string): string {
  const t = timing.toLowerCase();
  if (/missed call|no answer|rings out|unanswered/.test(t))
    return workflowStep("missed-call-text-back", "the text that goes back to the caller");
  if (/after hours|out of hours|evening|weekend|overnight|closed/.test(t))
    return workflowStep("after-hours-auto-reply", "the out-of-hours acknowledgement");
  if (/no.?show|missed appointment|could not get access|couldn't get access|did not attend/.test(t))
    return workflowStep("no-show-recovery", "the message after a missed visit");
  if (/reminder|day before|before a booked|before the visit|day of|on the way/.test(t))
    return workflowStep("booking-confirmation-reminders", "the reminder text");
  if (/quote|proposal|estimate|unbooked|did not book|didn't book/.test(t))
    return workflowStep("lead-nurture-no-booking", "the follow-up text on an unbooked quote");
  if (/form|enquiry|inquiry|new lead|submission|web lead/.test(t))
    return workflowStep("instant-lead-response", "the instant acknowledgement text");
  return "Sent from your GoHighLevel sub-account on the trigger named above";
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
      h.aboveFoldProofLine
        ? `<div class="diag-row"><div class="dk">Above-the-fold proof line</div><p>${esc(
            h.aboveFoldProofLine
          )}</p>${destination(`${SURFACE.bookingPage} — above the fold`)}</div>`
        : "",
    ]
      .filter(Boolean)
      .join("");
    if (micro) hero += `<div class="diag-card">${micro}</div>`;
    if (hero) parts.push(`<div class="label">Hero — first thing visitors see</div>${hero}`);
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
function renderConversionSurfaces(s: NonNullable<AssetPack["surfaces"]>): string {
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
      )}<p><strong>Primary button:</strong> ${esc(bp.primaryButton)}<br><strong>Secondary button:</strong> ${esc(
        bp.secondaryButton
      )}</p>${para(bp.reassuranceLine)}${para(bp.proofLine)}${sections}${faq}${
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

  const lg = s.leadGate;
  if (lg)
    parts.push(
      `<div class="label">Qualifying questions — what the caller sees</div>${destination(
        lg.where
      )}${para(lg.openingLine)}${
        lg.questionIntros?.length ? list(lg.questionIntros) : ""
      }<p><strong>If they're a priority job:</strong> ${esc(
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
  const ad = s.siteAdvisory;
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

/** Copy for every workflow in the build, so nothing has to be written by hand
 *  inside the client's account on go-live day with the client watching. */
function renderWorkflowCopy(wc: NonNullable<AssetPack["workflowCopy"]>): string {
  const assets = wc.assets ?? [];
  if (!assets.length) return "";
  return assets
    .map((a) => {
      const rows = (a.messages ?? [])
        .map(
          (m) =>
            `<tr><td>${esc(m.step)}</td><td>${esc(m.channel)}</td><td>${esc(m.timing)}</td><td>${
              m.subject ? `<strong>${esc(m.subject)}</strong><br>` : ""
            }${esc(m.body)}${
              m.mergeFields?.length
                ? `<br><em>Merge fields: ${esc(m.mergeFields.join(", "))}</em>`
                : ""
            }</td></tr>`
        )
        .join("");
      return `<div class="label">${esc(a.workflowName)}</div>${destination(a.where)}<p><em>Fires when: ${esc(
        a.trigger
      )}</em></p><table><thead><tr><th>Step</th><th>Channel</th><th>Timing</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`;
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

function renderDeliverable3(pack: AssetPack): string {
  const f1 = pack.file1;
  const f3 = pack.file3;
  const f4 = pack.file4;
  const f5 = pack.file5;
  const sa = pack.supportingAssets;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  // Landing Page Conversion Assets — the actual recommended page copy/assets,
  // absorbed from the old Landing Page Growth Audit. Prefer the dedicated landing
  // module; fall back to the file1 landing copy for pre-module packs.
  // THREE SHAPES, NEWEST FIRST. `surfaces` is what a pack generated today
  // carries; `landing` is the deleted 10th call, still present on packs saved
  // before it went; `file1.landingPage` is older still. Packs are never deleted,
  // so a document made last month has to keep rendering exactly as it did — which
  // is why the two legacy readers stay rather than being cleaned away.
  const surfacesBody = pack.surfaces ? renderConversionSurfaces(pack.surfaces) : "";
  const landingBody =
    surfacesBody ||
    (pack.landing?.assets
      ? renderLandingAssets(pack.landing.assets)
      : renderLandingAssetsFallback(f1.landingPage));
  if (landingBody) {
    parts.push(
      section(
        next(),
        surfacesBody ? "Conversion Surfaces — the copy that goes live" : "Landing Page Conversion Assets",
        // Scope: this is the copy for the booking page WE build and brand inside
        // GoHighLevel, plus advisory notes on their existing site. It is not a
        // "paid-traffic destination" — we neither run nor manage traffic.
        // The section is BOTH halves and says so: the copy for the page we build,
        // and the copy that is only ever advice about the site we do not. Every
        // asset below carries its own "Where this goes" line saying which it is.
        `${assetFrame(
          "Booking page copy we build for you, plus advisory copy for your own site",
          "Turn the enquiries you already get into booked, qualified calls"
        )}${landingBody}`
      )
    );
  }

  // Copy for every workflow in the build. Without this the operator writes the
  // owner notification, the review replies and the reactivation campaign by hand
  // inside the client's account on go-live day — unbilled work in an inconsistent
  // voice, at the moment the client is watching.
  const workflowBody = pack.workflowCopy ? renderWorkflowCopy(pack.workflowCopy) : "";
  if (workflowBody) {
    parts.push(
      section(
        next(),
        "Workflow Copy — every automation's messages",
        `${assetFrame(
          "The words each workflow sends, ready to paste",
          "Nothing in the build goes live without its copy already written"
        )}${workflowBody}`
      )
    );
  }

  // Email assets (file3).
  if ((f3.emails ?? []).length) {
    parts.push(
      section(
        next(),
        "Email Nurture Assets",
        `${assetFrame(
          "Post-opt-in nurture sequence",
          "Build trust and pull unconverted leads back to booking"
        )}${(f3.emails ?? [])
          .map(
            (e) =>
              `<div class="email"><div class="label">Day ${esc(e.day)} · ${esc(
                e.purpose
              )}</div>${destination(
                carriedDestination(e) ??
                  workflowStep(
                    "lead-nurture-no-booking",
                    `the email that sends on day ${String(e.day)}`
                  )
              )}<div class="subj">${esc(e.subject)}</div>${para(e.body)}</div>`
          )
          .join("")}`
      )
    );
  }

  // SMS assets (file4).
  if ((f4.messages ?? []).length) {
    parts.push(
      section(
        next(),
        "SMS Follow-Up Assets",
        `${assetFrame(
          "Speed-to-lead and re-engagement texting",
          "Recover no-responses with timely, human messages"
        )}${(f4.messages ?? [])
          .map(
            (m) =>
              `<div class="card"><div class="label">Send ${esc(m.timing)}</div>${destination(
                carriedDestination(m) ?? smsDestination(m.timing)
              )}<p><strong>${esc(m.message)}</strong></p></div>`
          )
          .join("")}`
      )
    );
  }

  // Booking assets (file5).
  parts.push(
    section(
      next(),
      "Booking & Reminder Assets",
      `${assetFrame(
        "Booking page + confirmation / reminder automations",
        "Maximize show-up rate and reduce no-shows"
      )}${destination(`${SURFACE.bookingPage} — the headline and the line under it`)}<div class="hero-quote">${esc(
        f5.headline
      )}</div>${para(f5.subheadline)}${emailBlock(
        "Confirmation email",
        f5.confirmationEmail,
        destination(
          workflowStep("booking-confirmation-reminders", "the confirmation that sends on booking")
        )
      )}${emailBlock(
        "24-hour reminder email",
        f5.reminderEmail24h,
        destination(workflowStep("booking-confirmation-reminders", "the reminder 24 hours out"))
      )}<div class="label">Day-of reminder SMS</div>${destination(
        workflowStep("booking-confirmation-reminders", "the text on the morning of the visit")
      )}<div class="card">${esc(f5.dayOfReminderSms)}</div>${emailBlock(
        "No-show recovery email",
        f5.noShowRecoveryEmail,
        destination(workflowStep("no-show-recovery", "the email after a missed visit"))
      )}`
    )
  );

  // Thank-you & post-purchase assets (supportingAssets.thankYouAssets). The only
  // permitted review touch (Law 2) is a single review-REQUEST automation fired
  // after a completed job — folded in here, not a standalone review section.
  const ty = sa?.thankYouAssets;
  const reviewMsg = sa?.reviewAssets?.postJobRequest;
  if (ty || reviewMsg) {
    parts.push(
      section(
        next(),
        "Thank-You & Post-Purchase Assets",
        `${assetFrame(
          "Confirmation / thank-you page and post-job messaging",
          "Set next steps, reduce buyer's remorse, and confirm the win"
        )}${
          ty?.thankYouPageCopy
            ? // The BOOKING confirmation, not the form confirmation — this copy is
              // written for somebody who has just held a slot. The landing pack's
              // own thank-you copy covers the form-submit screen, and pointing both
              // at both surfaces would leave the operator installing the wrong one.
              `<div class="label">Thank-you page copy</div>${destination(
                `${SURFACE.bookingPage} — the confirmation screen shown the moment somebody books`
              )}${para(ty.thankYouPageCopy)}`
            : ""
        }${
          ty?.nextStepMessaging
            ? `<div class="label">Next-step messaging</div>${destination(
                workflowStep(
                  "booking-confirmation-reminders",
                  "the first message after a booking is taken"
                )
              )}${para(ty.nextStepMessaging)}`
            : ""
        }${
          ty?.postPurchaseSequence?.length
            ? `<div class="label">Post-purchase sequence</div>${destination(
                `${workflowStep("booking-confirmation-reminders", "the run-up to the visit")}, then ${workflowStep("review-request", "the message once the job is marked complete")}`
              )}${ty.postPurchaseSequence
                .map((m) => `<div class="card">${esc(m)}</div>`)
                .join("")}`
            : ""
        }${
          reviewMsg
            ? `<div class="label">Review request — sent automatically after a completed job</div>${destination(
                workflowStep("review-request", "the message that asks for the review")
              )}<div class="card">${esc(reviewMsg)}</div>`
            : ""
        }`
      )
    );
  }

  return shell(pack.meta, "Conversion Asset Pack", parts.join("\n"), shellOpts("d3"));
}

// ── D4 · 90-Day Growth Execution Roadmap ──────────────────────────────────────

function renderPhases(phases: RoadmapPhase[] | undefined): string {
  if (!phases?.length) return "";
  const blocks = phases
    .map(
      (p, i) =>
        `<div class="phase-row"><div class="phase-node">${i + 1}</div><div class="phase-card${
          p.isRetainerPhase ? " is-retainer" : ""
        }"><div class="ph-h"><span class="ph-n">${esc(p.phase)}${
          p.isRetainerPhase
            ? `<span class="retainer-badge">Monthly retainer</span>`
            : ""
        }</span><span class="ph-w">${esc(p.window)}</span></div><p class="ph-obj"><strong>Objective.</strong> ${esc(
          p.objective
        )}</p>${
          p.deployActions?.length || p.doneDefinition?.length
            ? `<div class="phase-cols">${
                p.deployActions?.length
                  ? `<div><div class="label">What we deploy</div>${list(p.deployActions)}</div>`
                  : ""
              }${
                p.doneDefinition?.length
                  ? `<div><div class="label">Done means</div>${checklist(p.doneDefinition)}</div>`
                  : ""
              }</div>`
            : ""
        }<div class="fn-meta" style="margin-top:14px">${ownerTag(p.owner)}</div></div></div>`
    )
    .join("");
  return `<div class="timeline">${blocks}</div>`;
}

// ── The engagement spine (D5) ─────────────────────────────────────────────────
// D4 used to show three phases and no money at all, which meant the one document
// that answers "when does this happen" never answered "and what am I paying for
// it". An owner reading the timeline should be able to see the two-week build he
// paid a one-time fee for, the moment it goes live, and the ongoing month he pays
// a monthly fee for — without opening the proposal again.
//
// DETERMINISTIC, AND DELIBERATELY SO. Every word and both figures come from the
// engagement itself (proposal-defaults is the single source of the two prices),
// never from the model. What we charge is not something a generation gets to
// paraphrase, and it must render identically on a pack where the roadmap came back
// thin.
//
// It attaches the fees to the two WINDOWS, not to individual phases, because that
// is the only split the commercials actually define. Guessing which fee covers a
// model-authored phase called "Stabilize · Month 2" would be inventing a billing
// claim, so the spine states the two windows and points at the retainer badge
// already on the phases below.
function renderEngagementSpine(roadmap: AssetPack["roadmap"]): string {
  const hasRetainerPhase = (roadmap?.phases ?? []).some((p) => p.isRetainerPhase);
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
    "Days 1–14",
    "The build",
    money(DEFAULT_SETUP_FEE),
    "one-time",
    "Your GoHighLevel sub-account, the tracked number, the booking page, the lead-capture form, the pipeline and the workflows — stood up, tested and handed over. The four documents in this pack are part of it. This is the window we work to, and anything that slips gets told to you rather than absorbed quietly."
  )}<div class="spine-golive"><span class="sg-dot"></span><div><strong>Go-live.</strong> The system is switched on and every enquiry from that moment runs through it. Nothing is charged monthly until this point.</div></div>${band(
    "is-run",
    "Days 15–90",
    "Running it",
    `${money(DEFAULT_MONTHLY)}/month`,
    "monthly, from go-live",
    `LeadGate qualifying every enquiry, us running and tuning the system against what actually arrives, and a written monthly report on answered, missed and booked. It continues past day 90 on the same terms.${
      hasRetainerPhase
        ? " Anything marked Monthly retainer below is what this covers."
        : ""
    }`
  )}</div>`;
}

function renderDeliverable4(pack: AssetPack): string {
  const roadmap = pack.roadmap;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  parts.push(
    section(next(), "What You Are Paying For, and When", renderEngagementSpine(roadmap))
  );

  if (roadmap?.overview)
    parts.push(
      section(next(), "Roadmap Overview", `<div class="strategy-block">${para(
        roadmap.overview
      )}</div>`)
    );

  const phases = renderPhases(roadmap?.phases);
  if (phases) {
    parts.push(section(next(), "Implementation & Optimization Plan", phases));
  } else {
    // Fallback: derive a lightweight plan from each file's implementation guide.
    const guides = [
      pack.file1.framing?.implementationGuide,
      pack.file2.framing?.implementationGuide,
      pack.file5.framing?.implementationGuide,
    ]
      .filter((g): g is string[] => Boolean(g?.length))
      .flat();
    if (guides.length) {
      parts.push(
        section(next(), "Execution Checklist", checklist(guides))
      );
    }
  }

  return shell(
    pack.meta,
    "Implementation & Optimization Timeline",
    parts.join("\n"),
    shellOpts("d4")
  );
}

// ── Metadata + dispatcher ─────────────────────────────────────────────────────

export const DELIVERABLES: {
  id: DeliverableId;
  title: string;
  subtitle: string;
  filename: string;
}[] = [
  {
    id: "d1",
    title: "Growth Leak Intelligence Report",
    subtitle: "Diagnosis — where revenue is quietly leaking and why",
    filename: "01-growth-leak-intelligence-report.html",
  },
  {
    id: "d2",
    title: "Client Acquisition Infrastructure Blueprint",
    subtitle: "Architecture — the conversion path we build to turn your leads into customers",
    filename: "02-client-acquisition-infrastructure-blueprint.html",
  },
  {
    id: "d3",
    title: "Conversion Asset Pack",
    subtitle: "Assets — the copy and messaging that runs the system",
    filename: "03-conversion-asset-pack.html",
  },
  {
    id: "d4",
    title: "Implementation & Optimization Timeline",
    subtitle: "Execution — what we deploy, then the ongoing retainer cadence",
    filename: "04-implementation-optimization-timeline.html",
  },
];

function shellOpts(id: DeliverableId): ShellOptions {
  const idx = DELIVERABLES.findIndex((d) => d.id === id);
  const d = DELIVERABLES[idx];
  return {
    subtitle: d?.subtitle,
    docIndex: `${String(idx + 1).padStart(2, "0")} / ${String(DELIVERABLES.length).padStart(2, "0")}`,
  };
}

export function renderDeliverableHtml(pack: AssetPack, id: DeliverableId): string {
  switch (id) {
    case "d1":
      return renderDeliverable1(pack);
    case "d2":
      return renderDeliverable2(pack);
    case "d3":
      return renderDeliverable3(pack);
    case "d4":
      return renderDeliverable4(pack);
  }
}
