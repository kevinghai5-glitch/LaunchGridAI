// The offer, ASSEMBLED — not generated.
//
// This replaced the proposal generator. That route asked a model to write prose
// about a business, which meant the same client could be described two different
// ways on two different days and nothing could tell you which was true. Nothing
// here is written by a model. Every figure is read from the frozen calculator
// output, every build line is read from the catalogue, and the two prices come
// from constants. Run it twice, get the same page.
//
// THE FROZEN COMPUTATION IS NEVER RE-RUN. LeakAssessment.computed is the
// ComputedAssessment that was on screen when the operator saved it on the call.
// If the model in leak-calculator.ts changes tomorrow, this page still shows the
// client the numbers he was actually quoted. Recomputing here would silently
// requote a signed client, so this file imports the TYPES from the calculator
// and deliberately not `computeAssessment`.
//
// PURE. No Prisma, no fetch, no React.

import { WORKFLOWS } from "./workflow-catalogue";
import { DECIDABLE_WORKFLOWS, OFF_WHEN, readDecisions } from "./build-decisions";
import {
  AGREEMENT_URL,
  AGREEMENT_URL_ENV_VAR,
  MONTHLY_RETAINER_CAD,
  PAYMENT_URL,
  PAYMENT_URL_ENV_VAR,
  SETUP_FEE_CAD,
} from "./constants";
// markCurrency is the ONLY thing imported from the calculator as a VALUE, and
// deliberately so: it changes no digits. computeAssessment is absent on purpose
// (see the header) and scripts/verify-offer-page.ts D1 asserts its absence.
import { markCurrency } from "./leak-calculator";
import type { ComputedAssessment, ComputedRow } from "./leak-calculator";

/** One workflow, as the client reads it. */
export interface OfferBuildItem {
  id: string;
  name: string;
  whatItDoes: string;
  /** The single fact that took it out. Present ONLY on omitted items — an
   *  omission with no stated reason reads as something we forgot. */
  omittedBecause?: string;
}

/** A closing button. Exactly one of `href` / `missingEnvVar` is set. */
export interface OfferLink {
  label: string;
  href?: string;
  /** Which variable supplies it. Rendered in place of a dead button. */
  missingEnvVar?: string;
}

export interface ClientOffer {
  business: { name: string; industry: string | null; city: string | null };

  /** Both of their numbers were entered. Nothing is priced until they are. */
  priced: boolean;
  /** Every area they answered came back covered. A real outcome, not a failure. */
  allClean: boolean;

  /** The rows carrying money, in calculator order. */
  leakRows: ComputedRow[];
  /** The areas that came back covered. Shown, because "we checked and you are
   *  fine here" is worth more than silence. */
  cleanRows: ComputedRow[];

  totalLow: number;
  totalHigh: number;
  annualLow: number;
  annualHigh: number;

  /** The method sentence, verbatim from the calculator the client watched. */
  derivation: string;
  overlapAppliedPct: number;
  capped: boolean;
  assumedCount: number;

  installed: OfferBuildItem[];
  omitted: OfferBuildItem[];
  /** installed.length — stated, because "26 of 27" is the wrong frame. */
  installedCount: number;

  setupFeeCad: number;
  monthlyRetainerCad: number;

  agreement: OfferLink;
  payment: OfferLink;
}

/** Narrow the stored JSON back to a ComputedAssessment.
 *
 *  A row saved before a field existed is possible, so this checks the shape
 *  rather than trusting the cast. Returns null when the blob cannot be read —
 *  the caller then shows "run the calculator" rather than a page of zeroes,
 *  because a zero and an absence look identical to a client and mean opposite
 *  things. */
export function readComputed(stored: unknown): ComputedAssessment | null {
  if (!stored || typeof stored !== "object") return null;
  const c = stored as Partial<ComputedAssessment>;
  if (!Array.isArray(c.rows)) return null;
  if (typeof c.totalLow !== "number" || typeof c.totalHigh !== "number") return null;
  if (typeof c.derivation !== "string") return null;
  return c as ComputedAssessment;
}

export interface OfferSource {
  business: { name: string; industry: string | null; city: string | null };
  /** LeakAssessment.computed — the frozen ComputedAssessment. */
  computed: unknown;
  /** Business.workflowToggles — the operator's five decisions. */
  workflowToggles: unknown;
}

export function buildClientOffer(src: OfferSource): ClientOffer | null {
  const computed = readComputed(src.computed);
  if (!computed) return null;

  // ── The money ─────────────────────────────────────────────────────────────
  // Split, never re-derived. `clean` is a tri-state on the row: a clean area has
  // no figure because there is nothing to price, which is NOT the same as a row
  // that was never answered (monthlyHigh === null on both, so the flag decides).
  const answered = computed.rows.filter((r) => r.answerText !== null);
  const cleanRows = answered.filter((r) => r.clean);
  const leakRows = answered.filter((r) => !r.clean && r.monthlyHigh !== null);
  const customRows = (computed.customRows ?? []).filter(
    (r) => r.monthlyHigh !== null && r.label.trim().length > 0
  );

  // ── The build ─────────────────────────────────────────────────────────────
  // Derived from the catalogue and the five decisions. The nine `every_build`
  // workflows are never in the omitted list, because there is no switch that can
  // remove them — asserted below rather than assumed.
  const decisions = readDecisions(src.workflowToggles);
  const installed: OfferBuildItem[] = [];
  const omitted: OfferBuildItem[] = [];

  for (const w of WORKFLOWS) {
    const isDecidable = DECIDABLE_WORKFLOWS.some((d) => d.id === w.id);
    const on = isDecidable ? decisions[w.id] !== false : true;
    if (on) {
      installed.push({ id: w.id, name: w.name, whatItDoes: w.whatItDoes });
    } else {
      omitted.push({
        id: w.id,
        name: w.name,
        whatItDoes: w.whatItDoes,
        // Always a reason. OFF_WHEN covers every decidable workflow (checked by
        // verify-intake-screen A5), so the fallback is unreachable — it exists so
        // a new workflow added without a reason still renders something honest.
        omittedBecause: OFF_WHEN[w.id] ?? "Not needed for this build",
      });
    }
  }

  return {
    business: src.business,
    priced: computed.ready === true,
    allClean: computed.allClean === true,
    leakRows: [...leakRows, ...customRows],
    cleanRows,
    totalLow: computed.totalLow,
    totalHigh: computed.totalHigh,
    annualLow: computed.annualLow ?? computed.totalLow * 12,
    annualHigh: computed.annualHigh ?? computed.totalHigh * 12,
    // Marker-repaired, digits untouched. The sentence was frozen when the
    // operator saved it, so a row written before the money law carries an
    // unmarked figure that would otherwise print under a marked total.
    derivation: markCurrency(computed.derivation),
    overlapAppliedPct: computed.overlapAppliedPct ?? 0,
    capped: computed.capped === true,
    assumedCount: computed.assumedCount ?? 0,
    installed,
    omitted,
    installedCount: installed.length,
    setupFeeCad: SETUP_FEE_CAD,
    monthlyRetainerCad: MONTHLY_RETAINER_CAD,
    agreement: AGREEMENT_URL
      ? { label: "Sign the agreement", href: AGREEMENT_URL }
      : { label: "Sign the agreement", missingEnvVar: AGREEMENT_URL_ENV_VAR },
    payment: PAYMENT_URL
      ? { label: "Pay now", href: PAYMENT_URL }
      : { label: "Pay now", missingEnvVar: PAYMENT_URL_ENV_VAR },
  };
}
