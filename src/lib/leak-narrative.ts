// ============================================================================
// LEAK NARRATIVE & ENFORCEMENT — Phase 4 of the governance refactor.
// ============================================================================
//
// This module turns fired leaks into the STRUCTURED, BOUNDED material the
// generator is allowed to write from, and enforces the honesty rules after the
// model runs:
//   • buildLeakInputs   — per-leak symptom / mechanism / tier phrasing / allowed
//                         stats / math estimate. The model may rephrase this and
//                         nothing else.
//   • RULES.math templates (spend-anchored pre-intake, client-number post-intake).
//   • statGuard         — every number in output must trace to an allowed STAT,
//                         a math-template result, or observed business data.
//   • voiceLint         — banned-word / hype scan.
//
// NEVER invents a number. Pre-intake output makes ZERO client-revenue claims.

import {
  STATS,
  ASSUMPTIONS,
  LEAKS,
  UNCITABLE_SCRAPE_FIELDS,
  gradeOf,
  type Checkability,
  type Stat,
  type EvidenceGrade,
  type EvidenceTier,
  type EvidenceClass,
  type ScrapeData,
  type Vertical,
} from "./leak-taxonomy";
import type { FiredLeak } from "./leak-detection";

// ── Tier phrasing (RULES.language) ───────────────────────────────────────────

export const KICKOFF_VERIFICATION_LINE =
  "We verify this together at kickoff — if you already have this covered, it comes off the list.";

// STILL HERE, AND STILL RIGHT. Grade decides how flatly a leak may be written;
// tier decides its SHAPE, and the BENCHMARK shape — acknowledge the invisibility,
// give the pattern, end with the kickoff line — is instruction the grade cannot
// carry. Both travel with every leak: GRADE_VOICE below says how honest to be,
// TIER_PHRASING says how to lay the paragraph out.
export const TIER_PHRASING: Record<EvidenceTier, string> = {
  OBSERVED:
    "State as fact and cite the observed data point. No hedging verbs — this was directly seen in the data.",
  EVIDENCED:
    "State the signal first, then the inference. Quote at most a ~10-word fragment of any review. Use hedged verbs (a strong sign, likely).",
  BENCHMARK:
    "Three-part shape, mandatory: (a) acknowledge it isn't externally visible, (b) give the industry pattern using ONLY the allowed stat or its softFraming, (c) end with the kickoff-verification line verbatim. Hedged verbs throughout (typically, most, if that's true here).",
};

// ── Grade voice — what the model is told, per grade of knowledge ─────────────
// The grade-keyed successor to TIER_PHRASING. One rule per grade, and the rule is
// about HONESTY, not layout: may this sentence be stated flatly, and if so, whose
// word is it on?
export const GRADE_VOICE: Record<EvidenceGrade, string> = {
  observed:
    "WE MEASURED THIS. Write it declaratively and name the measurement it rests on (the review counts, the PageSpeed score, the booking path that isn't there). No hedging verbs — hedging something we measured makes the whole document read as guesswork.",
  disclosed:
    "THE CLIENT TOLD US THIS. Write it declaratively AND attribute it to them, in their direction: \"You told us…\", \"Confirmed at intake…\". Two absolute rules. (1) NEVER write it as something we detected, scanned, found or observed — presenting their own answer back to them as our finding is the single failure this grade exists to prevent. (2) NEVER hedge it — no \"likely\", no \"typically\", no kickoff-verification line. They already answered the question; asking it again in the deliverable insults them.",
  inferred:
    "WE HAVE NEITHER MEASURED THIS NOR BEEN TOLD IT. Write it as an industry pattern and say so in the same breath — hedged verbs throughout (typically, most, likely, if that's true here) and an explicit note that we haven't measured theirs. Never a flat statement about how this business operates.",
};

// The same record under the name the Phase 1 spec uses for it. Two names for ONE
// object, deliberately: "GRADE_PHRASING" is what it is called where it replaces
// TIER_PHRASING, "GRADE_VOICE" is what it is called where it drives voice. An
// alias costs nothing; a second copy of these strings would eventually disagree
// with the first.
export const GRADE_PHRASING = GRADE_VOICE;

// ── Stat resolution ──────────────────────────────────────────────────────────

export function resolveStats(statIds: string[]): Stat[] {
  return statIds.map((id) => STATS[id]).filter((s): s is Stat => Boolean(s));
}

/** Compact inline citation for a stat's source (Part G). Strips parenthetical
 *  detail, quoted titles, and years, keeps the org name(s): e.g.
 *  "MIT / InsideSales (Oldroyd)" → "MIT/InsideSales",
 *  "HBR 2011 / Drift 2018" → "HBR/Drift". */
export function shortSource(source: string): string {
  const cleaned = source
    .replace(/\([^)]*\)/g, " ") // parenthetical detail
    .replace(/['"\u2018\u2019\u201c\u201d][^'"\u2018\u2019\u201c\u201d]*['"\u2018\u2019\u201c\u201d]/g, " ") // quoted titles
    .replace(/\b(19|20)\d{2}\b/g, " ") // years
    .replace(/\s+/g, " ")
    .trim();
  const beforeComma = cleaned.split(",")[0].trim();
  return beforeComma
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .join("/");
}

/** The string a leak is allowed to use for a stat: the raw claim WITH its inline
 *  source attribution for Tier A (Part G — every Tier-A stat rendered is cited),
 *  ONLY the softFraming for Tier B (never the raw percentages). */
export function allowedStatPhrase(stat: Stat): string {
  if (stat.reliability === "B") {
    return stat.softFraming ?? "(pattern language only — no raw figure)";
  }
  // THE CITATION GOES INSIDE THE SENTENCE, NOT AFTER IT. Every STATS claim ends
  // with a full stop, so appending "(Source)" used to produce "…Real Estate 9%.
  // (CallRail)" — and the moment two allowed stats are joined into one block, that
  // trailing tag reads as the opening of the NEXT sentence. The percentage and its
  // source then sit in different sentences, which is exactly what the same-sentence
  // rule (owner item 5, and E3 for dollars) exists to prevent, and it is how a
  // figure gets lifted into copy with the source left behind.
  const claim = stat.claim.trim().replace(/\.$/, "");
  return `${claim} (${shortSource(stat.source)}).`;
}

// ── Currency (A4) ────────────────────────────────────────────────────────────
// EVERYTHING client-facing is CAD. ReclaimedHQ prices in CAD ($6,500 one-time,
// $1,000/month), so a bare "$" beside a USD-sourced benchmark silently mixed two
// currencies in the same document. One convention, used everywhere in this file
// and in utils.formatCurrency: the marker goes BEFORE the figure — "CAD $1,290".

/** USD→CAD conversion for STATS figures published in USD (today: cpl_google_ads).
 *
 *  IT LIVES IN ASSUMPTIONS NOW, NOT HERE. It used to be a bare 1.35 sitting in
 *  this file — a number with no source, no date and no label, which is precisely
 *  the category the ASSUMPTIONS map exists to hold. The rate, the date it was set,
 *  where to re-check it, and why the floor() at the point of use means it can only
 *  ever understate a leak are all in its rationale (leak-taxonomy.ts SECTION 4b).
 *  The name stays exported and the value is unchanged, so every existing caller
 *  and the phase-0.5 proof keep working. */
export const USD_TO_CAD = ASSUMPTIONS.usd_to_cad.value;

/** Explicit CAD marker on every client-facing dollar string. Single convention,
 *  applied everywhere: "CAD $1,290". */
export function cad(amount: number): string {
  return `CAD $${Math.round(amount).toLocaleString()}`;
}

// ── Vertical benchmark tables (numbers sourced verbatim from STATS) ──────────
// cpl_google_ads: HVAC $129, Plumbing $129, Roofing $228, Electrical $94,
//   Dental $84, Legal $132 — published in USD. Verticals absent from the stat
//   get no CPL figure (so no dollar frame is produced — decision 4).
const VERTICAL_CPL_USD: Partial<Record<Vertical, number>> = {
  hvac: 129,
  plumbing: 129,
  roofing: 228,
  electrical: 94,
  dental: 84,
  law: 132,
};

/** The vertical's CPL benchmark converted to CAD at the point of use, rounded
 *  DOWN so the conversion can only ever understate the leak. Undefined when the
 *  stat has no figure for the vertical → no dollar frame is emitted at all.
 *  The FX rate is an ASSUMPTION, so every sentence that prints this number says so
 *  — see CPL_CONVERSION_NOTE below. */
function verticalCplCad(v: Vertical): number | undefined {
  const usd = VERTICAL_CPL_USD[v];
  if (usd === undefined) return undefined;
  return Math.floor(usd * USD_TO_CAD);
}

// missed_rate_by_industry: Healthcare 32%, Legal 28%, Home Services 14%.
function verticalMissedRatePct(v: Vertical): number {
  if (v === "dental" || v === "med_spa") return 32; // healthcare
  if (v === "law") return 28; // legal
  return 14; // home services
}

// Reader-facing label for the missed-call rate's industry bucket (A3 copy).
function verticalMissedLabel(v: Vertical): string {
  if (v === "dental" || v === "med_spa") return "healthcare";
  if (v === "law") return "legal";
  return "home-services";
}

// ── Assumption labelling (A3) ────────────────────────────────────────────────
// The 20 monthly enquiries, the 30% close rate, the 0.5 range haircut and the
// fallback no-show rate trace to NO source. They are not stats and are not
// dressed as stats: they live in ASSUMPTIONS (leak-taxonomy.ts) and every frame
// that consumes one says so in the same sentence as the number, in the owner's
// own language. This is the whole ruling — source it or label it.

/** The caveat appended in-sentence next to any ASSUMPTIONS-derived number. */
export const ASSUMPTION_CAVEAT = "our assumption, not a number we measured";

/** "~20 enquiries a month (our assumption, not a number we measured)" — the only
 *  sanctioned way to render an assumption to a client. */
export function assumptionPhrase(key: keyof typeof ASSUMPTIONS | string): string {
  const a = ASSUMPTIONS[key as string];
  if (!a) return `(${ASSUMPTION_CAVEAT})`;
  return `${a.label} (${ASSUMPTION_CAVEAT})`;
}

/** The provenance clause that must travel with EVERY rendered CPL figure. The
 *  dollar amount is a cited stat (WordStream) run through an assumed exchange
 *  rate (ASSUMPTIONS.usd_to_cad), so the sentence carrying it has to name both —
 *  a converted number is only as solid as its rate, and the rate is ours. The
 *  rate itself is never printed: it isn't a claim about the client's business,
 *  and floor() at the point of conversion means it can only understate. */
export const CPL_CONVERSION_NOTE = `an industry benchmark (WordStream), converted from USD at a rate we hold fixed (${ASSUMPTION_CAVEAT})`;

// ── Math templates (RULES.math) ──────────────────────────────────────────────

export interface MathEstimate {
  /** REAL = computed from operator-entered client numbers; BENCHMARK = computed
   *  from a stated conservative assumption + industry rates. A single document is
   *  entirely one mode (A1). */
  mode: "REAL" | "BENCHMARK";
  /** Reader-facing framing, already labeled. Safe to surface verbatim. Always an
   *  "≈ $X/mo — assuming/based on …" sentence, never a raw formula (A3). */
  frame: string;
  /** Dollar figure(s). In BENCHMARK mode low === high (a single point estimate
   *  off the assumed volume); in REAL mode they bound the client-number estimate. */
  dollarLow?: number;
  dollarHigh?: number;
  /** Structured, deterministic dollar breakdown — the ONLY source of the rendered
   *  dollarImpact. The model's integers are never used; these are stamped verbatim
   *  (Part I, determinism fix 1). Present only when the template produced a $ figure
   *  (dollarLow/dollarHigh set); null for qualitative frames. Every number here is
   *  already in `allowedNumbers`, so the range is guaranteed consistent with the
   *  frame and passes the stat guard + validator containment check. */
  impact?: MathImpact | null;
  /** Numbers this estimate legitimately introduces (for the stat guard). */
  allowedNumbers: number[];
  /** THIS FRAME IS A SUBSET OF ANOTHER LEAK'S FRAME. Names the leak id it slices
   *  out of (e.g. no_after_hours_coverage → "missed_calls_no_recovery"). Present
   *  ⇒ the figure must NEVER be added to a total alongside that leak's figure.
   *  reconcileLeakTotal() enforces this; the renderer only has to show the note. */
  overlapsWith?: string;
  /** Plain-English sentence the renderer surfaces beside the figure, e.g. "This
   *  is the after-hours share of the missed-call figure above, not additional to
   *  it." Always present when overlapsWith is. */
  overlapNote?: string;
}

/** Deterministic dollar breakdown stamped onto a leak's dollarImpact. Field
 *  shape mirrors the renderer's DollarImpact contract (whole-dollar bounds +
 *  labeled bases + visible formula). */
export interface MathImpact {
  low: number;
  high: number;
  leadVolumeBasis: string;
  effectSize: string;
  avgValueBasis: string;
  formula: string;
  usesBenchmarkValue: boolean;
}

type MathTemplate = NonNullable<import("./leak-taxonomy").Leak["mathTemplate"]>;

function round0(n: number): number {
  return Math.round(n);
}

/** The after-hours share of inbound calls, taken from after_hours_28_43 at the
 *  CONSERVATIVE end of its 28–43% range (RULES.math: always the conservative
 *  end). Used to slice the missed-call chain, never to build a second one. */
export const AFTER_HOURS_SHARE_PCT = 28;

/** Surfaced verbatim beside the after-hours figure so a reader can never add the
 *  two numbers together. The renderer shows it; this file computes it. */
export const AFTER_HOURS_OVERLAP_NOTE =
  "This is the after-hours share of the missed-call figure above, not additional to it.";

/** Build the dollar estimate for a fired leak, honoring the pre/post-intake
 *  split. Returns null when the leak has no math template or no computable,
 *  in-STATS figure is available (in which case NO dollar figure is emitted). */
export function computeMathEstimate(
  template: MathTemplate,
  data: ScrapeData
): MathEstimate | null {
  const v = data.business.industry;
  const intake = data.intake;
  const cpl = verticalCplCad(v);
  const missedPct = verticalMissedRatePct(v);

  switch (template) {
    case "spend_anchored":
    case "missed_call_value": {
      // REAL MODE: the operator entered the client's real economics. Customer
      // value is labeled as such (A1); the frame reads as a computed figure with
      // its inputs visible, not a raw formula (A3). The close rate and the
      // low-end haircut are ASSUMPTIONS and are named as such in the sentence.
      //
      // WHAT FLIPS THE MODE IS NUMBERS, NOT CONFIRMATION. A client confirming at
      // intake that they miss calls with no recovery makes the LEAK a stated fact
      // (the detector sets intakeConfirmed, which drops the kickoff hedge and makes
      // the prose declarative) — it does not tell us how many enquiries they get.
      // Without their enquiry count there is nothing real to compute with, so a
      // confirmed leak still renders the labelled ~20-enquiry assumption below; it
      // simply stops hedging about WHETHER the gap exists. Flipping to "based on
      // the numbers you provided" off a confirmation alone would be inventing the
      // number the phrase claims they gave us.
      if (intake?.monthlyEnquiries && intake.avgJobValueCad) {
        const closeRate = ASSUMPTIONS.conservative_close_rate.value;
        const haircut = ASSUMPTIONS.range_low_haircut.value;
        const closePct = round0(closeRate * 100);
        const lost = intake.monthlyEnquiries * (missedPct / 100) * 0.85;
        const low = round0(lost * closeRate * haircut * intake.avgJobValueCad);
        const high = round0(lost * closeRate * intake.avgJobValueCad);
        return {
          mode: "REAL",
          frame: `≈ ${cad(low)}–${cad(high)}/mo — based on the numbers you provided: ${intake.monthlyEnquiries} enquiries/mo × a ${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail) × the 85% of missed callers who never call back (CallRail) × a ${closePct}% close rate on the ones you'd win back (${ASSUMPTION_CAVEAT}) × your ${cad(intake.avgJobValueCad)} average customer value, with the low end set at half the high end (${ASSUMPTION_CAVEAT}). Estimated.`,
          dollarLow: low,
          dollarHigh: high,
          impact: {
            low,
            high,
            leadVolumeBasis: `Based on your ${intake.monthlyEnquiries} enquiries/mo (estimated projection)`,
            effectSize: `${missedPct}% ${verticalMissedLabel(v)} missed-call rate × the 85% who never call back (CallRail), closed at ${closePct}% (${ASSUMPTION_CAVEAT})`,
            avgValueBasis: `${cad(intake.avgJobValueCad)} average customer value — your number`,
            formula: `${intake.monthlyEnquiries} enquiries × ${missedPct}% missed × 85% no-callback × ${closePct}% close (${ASSUMPTION_CAVEAT}) × ${cad(intake.avgJobValueCad)} = ${cad(low)}–${cad(high)}/mo`,
            usesBenchmarkValue: false,
          },
          allowedNumbers: [intake.monthlyEnquiries, missedPct, 85, closePct, intake.avgJobValueCad, low, high],
        };
      }
      // BENCHMARK MODE: no client numbers. Compute a single point estimate from
      // the assumed volume × the industry missed-call rate × the replacement cost
      // per lead. The volume is an ASSUMPTION and is labelled in-sentence; the CPL
      // is a real stat, converted USD→CAD and labeled replacement cost, NEVER
      // customer value (A4).
      if (cpl) {
        const assumed = ASSUMPTIONS.benchmark_monthly_inquiries.value;
        const monthly = round0(assumed * (missedPct / 100) * cpl);
        return {
          mode: "BENCHMARK",
          frame: `≈ ${cad(monthly)}/mo — assuming ${assumed} enquiries a month (${ASSUMPTION_CAVEAT}) × a ${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail) × ${cad(cpl)} replacement cost per lead, ${CPL_CONVERSION_NOTE}. Estimated; we run this with your real numbers at kickoff.`,
          dollarLow: monthly,
          dollarHigh: monthly,
          impact: {
            low: monthly,
            high: monthly,
            leadVolumeBasis: `Assuming ${assumed} enquiries a month (${ASSUMPTION_CAVEAT})`,
            effectSize: `${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail)`,
            avgValueBasis: `${cad(cpl)} replacement cost per lead — ${CPL_CONVERSION_NOTE}`,
            formula: `${assumed} enquiries (${ASSUMPTION_CAVEAT}) × ${missedPct}% missed × ${cad(cpl)}/lead = ${cad(monthly)}/mo`,
            usesBenchmarkValue: true,
          },
          allowedNumbers: [assumed, missedPct, cpl, monthly],
        };
      }
      // No CPL in STATS for this vertical → no dollar frame.
      return null;
    }

    case "after_hours_value": {
      // THE DOUBLE-COUNT FIX (A2). After-hours calls are a SUBSET of missed calls,
      // so this template does not compute a second, independent figure: it takes
      // the missed-call chain and slices out the after-hours share, at the
      // CONSERVATIVE 28% end of after_hours_28_43's 28–43% range (RULES.math).
      // Everything it returns carries overlapsWith/overlapNote so no total can
      // ever add it to missed_calls_no_recovery's figure.
      const base = computeMathEstimate("missed_call_value", data);
      if (!base || !base.impact) return null;

      const share = AFTER_HOURS_SHARE_PCT / 100;
      const low = round0(base.impact.low * share);
      const high = round0(base.impact.high * share);
      const range = low === high ? cad(low) : `${cad(low)}–${cad(high)}`;
      const sliceSentence = `${AFTER_HOURS_SHARE_PCT}% of inbound calls to local service businesses arrive outside business hours (NextPhone/AgentZap/RevSquared — the conservative end of a ${AFTER_HOURS_SHARE_PCT}–43% range)`;

      return {
        mode: base.mode,
        frame: `≈ ${range}/mo — ${sliceSentence}, applied to the same missed-call chain above. ${AFTER_HOURS_OVERLAP_NOTE} Estimated.`,
        dollarLow: low,
        dollarHigh: high,
        impact: {
          low,
          high,
          leadVolumeBasis: base.impact.leadVolumeBasis,
          effectSize: sliceSentence,
          avgValueBasis: base.impact.avgValueBasis,
          formula: `${cad(base.impact.low)}–${cad(base.impact.high)}/mo missed-call exposure × ${AFTER_HOURS_SHARE_PCT}% arriving after hours = ${range}/mo`,
          usesBenchmarkValue: base.impact.usesBenchmarkValue,
        },
        allowedNumbers: [
          ...base.allowedNumbers,
          AFTER_HOURS_SHARE_PCT,
          43,
          low,
          high,
        ],
        overlapsWith: "missed_calls_no_recovery",
        overlapNote: AFTER_HOURS_OVERLAP_NOTE,
      };
    }

    case "response_speed_value": {
      // Qualitative delta only — no fabricated multiplier chain (RULES.math).
      const stat = STATS.speed_close_32_vs_12;
      return {
        mode: "BENCHMARK",
        frame: `${stat.claim} The leads answered in minutes are the ones that close; every hour of silence moves them toward whoever replied first.`,
        allowedNumbers: [32, 12, 24, 5],
      };
    }

    case "follow_up_value": {
      // Conversion-gap frame (A5): NOT a CPL formula. Anchors on the vertical's
      // own inquiry→client conversion stat so it reads distinctly from the
      // missed-call leak.
      const soft = STATS.followup_stops_early.softFraming ?? "";
      const parts: string[] = [soft];
      const nums: number[] = [];
      if (v === "law") {
        parts.push(STATS.law_convert_14.claim);
        nums.push(14, 40, 50);
      } else if (v === "dental") {
        parts.push(STATS.dental_case_acceptance.claim);
        nums.push(42, 75, 10);
      }
      return { mode: "BENCHMARK", frame: parts.join(" "), allowedNumbers: nums };
    }

    case "no_show_value": {
      // REAL MODE dollar math.
      if (intake?.avgJobValueCad && intake?.monthlyBookedAppointments) {
        // The old code hard-coded 0.15 for every vertical. Two of them have a
        // CITED range in STATS, and RULES.math says take the conservative end:
        //   dental   → dental_no_show "~12–18%"            → 12%
        //   med spa  → medspa_show_rate "show rate 70–85%" → 15% no-show (100−85)
        // Only verticals with no cited range fall through to the ASSUMPTION, and
        // that fall-through is labelled in the sentence.
        const noShow =
          v === "dental"
            ? { rate: 0.12, basis: "the low end of the cited ~12–18% dental no-show range — DentRecall/ADA" }
            : v === "med_spa"
              ? { rate: 0.15, basis: "the 15% implied by the top of the cited 70–85% med-spa show rate — ClinicROI/Growth99" }
              : {
                  rate: ASSUMPTIONS.default_no_show_rate.value,
                  basis: `${ASSUMPTION_CAVEAT}; there's no published no-show range for your trade`,
                };
        const haircut = ASSUMPTIONS.range_low_haircut.value;
        const noShowPct = round0(noShow.rate * 100);
        const booked = intake.monthlyBookedAppointments;
        const low = round0(booked * noShow.rate * haircut * intake.avgJobValueCad);
        const high = round0(booked * noShow.rate * intake.avgJobValueCad);
        return {
          mode: "REAL",
          frame: `≈ ${cad(low)}–${cad(high)}/mo — based on the numbers you provided: ${booked} booked/mo × a ${noShowPct}% no-show rate (${noShow.basis}) × your ${cad(intake.avgJobValueCad)} average customer value, with the low end set at half the high end (${ASSUMPTION_CAVEAT}). Estimated.`,
          dollarLow: low,
          dollarHigh: high,
          impact: {
            low,
            high,
            leadVolumeBasis: `Based on your ${booked} booked/mo (estimated projection)`,
            effectSize: `${noShowPct}% no-show rate — ${noShow.basis}`,
            avgValueBasis: `${cad(intake.avgJobValueCad)} average customer value — your number`,
            formula: `${booked} booked × ${noShowPct}% no-show × ${cad(intake.avgJobValueCad)} = ${cad(low)}–${cad(high)}/mo`,
            usesBenchmarkValue: false,
          },
          allowedNumbers: [booked, noShowPct, intake.avgJobValueCad, low, high],
        };
      }
      // BENCHMARK MODE: quote the in-STATS vertical range, no dollar.
      if (v === "dental") {
        return { mode: "BENCHMARK", frame: STATS.dental_no_show.claim, allowedNumbers: [12, 18, 25, 30] };
      }
      if (v === "med_spa") {
        return { mode: "BENCHMARK", frame: STATS.medspa_show_rate.claim, allowedNumbers: [30, 60, 70, 85] };
      }
      return null;
    }

    default:
      return null;
  }
}

/* ============================================================================
 * EVIDENCE BINDING — the grade must certify the SENTENCE, not the FIRE
 * ==========================================================================*/
//
// WHY THIS EXISTS. A real cold audit shipped this, stamped "Measured on your
// public pages":
//
//     "There's no primary action above the fold, and your phone number is
//      buried."
//
// The business visibly had both. Two defects produced it, and this section fixes
// the second and worse one. The detector never measured either clause — the only
// string it produced was "No clear primary CTA above the fold on the homepage",
// and the click-to-call fingerprint had come back PRESENT, so the document
// asserted the OPPOSITE of what we measured. A generic leak fired, the model
// invented checkable-sounding specifics, and `gradeOf` → `gradeLabel` laundered
// them as a measurement.
//
// So the grade certified THAT A DETECTOR FIRED. It has to certify that the
// SENTENCE IS TRUE, and nothing can do that unless the specific values the
// sentence is allowed to rest on travel WITH the finding. That is what a binding
// is: the actual field paths and actual values out of the scrape, stamped at
// detection/narrative time, never authored by the model.
//
// THE CONTRACT IS docs/detector-checkability.md §2 ("Evidence binding — the
// permitted values, per leak"), leak by leak. Everything below is transcribed
// from it. Nothing here is invented: if a value is not in §2 for a leak, that
// leak cannot bind it, and a sentence resting on it is fabrication.
//
// WHAT THE MODEL MAY DO WITH A BINDING: restate the value and explain its
// consequence, in its own words. What it may NOT do is introduce any other
// factual claim about the business.

/** Provenance of a bound value — the codes in docs/detector-checkability.md
 *  §"Provenance codes", restricted to the three grades a client-facing sentence
 *  is ever allowed to rest on.
 *
 *  `M` MEASURED — an outside system owns the fact (Lighthouse, Google's review
 *      count, DataForSEO's `work_time` / `book_online_url`). State it, cite it.
 *  `F` FINGERPRINT — a named-artifact match over the post-JS DOM (`<form`,
 *      `href="tel:`, a provider host from a closed list). A PRESENT is
 *      proof-positive; an ABSENT means only "none of the things we look for were
 *      found", so an absence claim must stay scoped to the scan.
 *  `H` HEURISTIC — a regex over page prose standing in for a question about a
 *      specific element. Bindable ONLY where §2 explicitly permits it (today:
 *      `mentionsTextingOption`, `formHasQualifyingFields`), and never as a
 *      measurement — the sentence has to stay scoped to what we looked at.
 *  `I` INTAKE — the client told us. Impossible pre-sale.
 *
 *  The `P` code (parsed guess) is deliberately absent and cannot be constructed:
 *  §7 lists every `P` field as one no finding may cite, so a `P` value has no
 *  representation in a binding at all. */
export type ValueProvenance = "M" | "F" | "H" | "I";

/** The SUBJECTS a client-facing sentence can make a checkable claim about.
 *
 *  This vocabulary is the hinge of the whole lint. A claim is not policed by the
 *  words it uses but by WHAT IT IS ABOUT: a sentence asserting something about
 *  the arrangement or contents of their public surface is legitimate only when
 *  some bound value speaks to that subject. Three of these topics are backed by
 *  no field that exists — see NEVER_LICENSABLE_TOPICS — which is precisely why
 *  the Crangle sentence was unfalsifiable. */
export type ClaimTopic =
  // ── never licensable: we render no page and measure no position ────────────
  | "cta_position"
  | "prominence"
  | "cta_quality"
  // ── licensable by a fingerprint or a measurement ───────────────────────────
  | "booking_path"
  | "chat_widget"
  | "click_to_call"
  | "contact_form"
  | "form_fields"
  | "texting_path"
  | "phone_line"
  | "gbp_hours"
  | "review_volume"
  | "competitor_reviews"
  | "review_content"
  | "page_speed"
  | "social_channels"
  // ── licensable ONLY by the client's own word (see CLIENT_ATTRIBUTED_ONLY) ───
  | "after_hours_behaviour"
  | "booking_exclusivity"
  | "review_solicitation"
  | "response_time_figure"
  | "missed_call_rate"
  | "no_show_rate"
  | "database_size";

/** The three topics NO field in the contract can license, at any grade, in any
 *  deliverable (docs/detector-checkability.md §2.7).
 *
 *  Position and prominence: we render no page. `hasPrimaryCtaAboveFold` is a
 *  13-phrase regex over 1500 characters of Firecrawl MARKDOWN, and markdown has
 *  no fold — document order is not viewport position. CTA quality: "is there a
 *  clear primary action" is an editorial judgment the code never makes; it asks
 *  only whether one of thirteen phrases appears, so "Free Case Evaluation",
 *  "Request a Consultation", "Contact Us Today" and a bare phone number all read
 *  as "no CTA".
 *
 *  A claim on one of these is fatal WITH OR WITHOUT a binding, and that is the
 *  load-bearing property of this design: no plumbing has to land anywhere else
 *  in the codebase for "your phone number is buried" to stop shipping. */
export const NEVER_LICENSABLE_TOPICS: readonly ClaimTopic[] = [
  "cta_position",
  "prominence",
  "cta_quality",
] as const;

/** Claims about what happens INSIDE the operation. No scan reaches any of these,
 *  so the only thing that can license one is the client's own answer — and then
 *  the sentence has to say so.
 *
 *  EVERY ENTRY IS A LINE FROM A "Forbidden:" LIST in
 *  docs/detector-checkability.md §2, not a policy invented here:
 *    §2.1  an hours/days response figure attributed to them
 *    §2.2  a missed-call count or rate for this business
 *    §2.3  "nothing reaches an after-hours caller", "calls go unanswered at night"
 *    §2.4  "the only way to become a customer is to call"
 *    §2.9  a no-show rate for this business
 *    §2.11 a list size or a dormancy period
 *    §2.13 "nobody asks them for a review", any per-month review velocity
 *
 *  WHY ATTRIBUTION IS THE LICENCE AND NOT A HEDGE. A hedge would let the copy say
 *  "your calls probably go unanswered at night", which is still a guess about the
 *  inside of a business dressed as a finding. `attributesToClient` is the existing
 *  predicate for "this sentence credits the client", already used by the
 *  validator's attribution law, so post-sale "You told us an after-hours enquiry
 *  gets nothing back" passes and pre-sale — where nobody has told us anything —
 *  nothing can. */
export const CLIENT_ATTRIBUTED_ONLY_TOPICS: readonly ClaimTopic[] = [
  "after_hours_behaviour",
  "booking_exclusivity",
  "review_solicitation",
  "response_time_figure",
  "missed_call_rate",
  "no_show_rate",
  "database_size",
] as const;

/** One value a finding is permitted to reference, with everything needed to
 *  judge a sentence written from it. Stamped, never authored. */
export interface BoundValue {
  /** Dotted path on `ScrapeData`, verbatim: "website.hasChatWidget". */
  field: string;
  /** The ACTUAL value out of the scrape. */
  value: string | number | boolean;
  provenance: ValueProvenance;
  /** Who owns the fact — named so a failure message can say where to check it. */
  source: string;
  /** The permitted assertion, verbatim from docs/detector-checkability.md §2.
   *  The model may restate this and explain its consequence; it may not go past
   *  it. Rendered into the prompt block, and quoted back in a lint failure. */
  licenses: string;
  /** Which claim subjects this value licenses. */
  topics: ClaimTopic[];
}

/** The evidence envelope that rides with a finding from detection to the
 *  rendered page. Carried on `LeakInput`, stamped onto the persisted finding, and
 *  read back by the validator — so the gate that judges a sentence and the fire
 *  that licensed it can never disagree about what was measured. */
export interface EvidenceBinding {
  /** Taxonomy leak id, so the validator can key on identity rather than prose. */
  leakId: string;
  /** Read off `Leak.checkability` — never a second copy of that verdict. */
  checkability: Checkability;
  /** Non-null ⇒ this leak may never be graded `observed`, and this is the reason
   *  to print. `gradeOf` enforces the same rule from the taxonomy side; this is
   *  the copy that travels WITH the finding, so the validator can refuse the
   *  combination on a stored row without re-deriving anything. Two guards on one
   *  rule, and no single edit switches both off. */
  neverObserved: string | null;
  /** The permitted values. Empty is meaningful: it says this leak licenses NO
   *  factual claim about their public surface. */
  values: BoundValue[];
  /** Topics this leak's contract WOULD license, suppressed because the only field
   *  behind them is in `UNCITABLE_SCRAPE_FIELDS`. See DISPUTED, below. */
  disputedTopics: ClaimTopic[];
  /** Every figure the finding may print about THIS business, from the bound
   *  numeric values plus the detector's own evidence strings (which are
   *  deterministic output, not model prose). Industry stats are NOT in here —
   *  they travel with their citation through `allowedStats`. */
  numbers: number[];
}

/** The taxonomy leak behind an id or a client-facing name, or undefined.
 *
 *  Two lookups because the three artifacts identify a leak differently: a
 *  `LeakInput` carries the id, a saved `LeakAnalysisItem` carries `leakName`, and
 *  a `ColdAuditFinding` carries neither (its leak tag is deliberately dropped
 *  before saving) and is judged through its binding instead. */
function findLeak(leakIdOrName: string): (typeof LEAKS)[number] | undefined {
  const key = leakIdOrName.trim();
  const byId = LEAKS.find((l) => l.id === key);
  if (byId) return byId;
  const norm = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return LEAKS.find((l) => l.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm);
}

/** Why this leak may never be graded `observed`, or null when it may.
 *
 *  THE VERDICT IS NOT DUPLICATED HERE. `Leak.checkability` in leak-taxonomy.ts is
 *  the one place the classification lives (it mirrors
 *  docs/detector-checkability.md, and `gradeOf` reads it); this function only
 *  turns INTERPRETIVE into the sentence a failure message prints. An unknown
 *  leak name returns null rather than guessing — the binding is what judges a
 *  finding whose leak cannot be resolved. */
export function neverObservedReason(leakIdOrName: string): string | null {
  const leak = findLeak(leakIdOrName);
  if (!leak || leak.checkability !== "INTERPRETIVE") return null;
  return (
    `${leak.name} is classified INTERPRETIVE in the taxonomy: at least one of its ` +
    `detection reasons is an editorial judgment with no ground truth behind it ` +
    `(docs/detector-checkability.md §3.7). "observed" is what prints "Measured on ` +
    `your public pages" beside the sentence, and a judgment about a page is not a ` +
    `measurement of it.`
  );
}

// ── The permitted values, leak by leak (docs/detector-checkability.md §2) ─────

type ValuePicker = (d: ScrapeData, f: FiredLeak) => BoundValue | null;

/** Declare one permitted value. Returns null when the field is absent from this
 *  scrape, so a binding only ever contains values we actually hold. */
function permit(
  field: string,
  provenance: ValueProvenance,
  source: string,
  licenses: string,
  topics: ClaimTopic[],
  get: (d: ScrapeData, f: FiredLeak) => string | number | boolean | null | undefined
): ValuePicker {
  return (d, f) => {
    const value = get(d, f);
    if (value === null || value === undefined || value === "") return null;
    return { field, value, provenance, source, licenses, topics };
  };
}

/** `website.<key>` tri-state values: bound only when the scan RESOLVED them.
 *  UNKNOWN is not a value a sentence may rest on in either direction — it is the
 *  scan failing to answer, which is exactly the state `scanConfident` lets
 *  through as a false absence (§4). */
function permitTri(
  key: "hasOnlineBookingLink" | "hasChatWidget" | "hasClickToCallOnMobile" | "hasContactForm",
  source: string,
  licenses: string,
  topics: ClaimTopic[]
): ValuePicker {
  return permit(`website.${key}`, "F", source, licenses, topics, (d) => {
    const v = d.website?.[key];
    return v && v !== "UNKNOWN" ? v : null;
  });
}

const BOOKING_ABSENCE_SOURCE =
  "our booking fingerprint: 16 scheduler hosts + 15 provider substrings (Zenoti, NexHealth, Weave, Dentrix and any custom booking page are NOT on either list)";
const CHAT_ABSENCE_SOURCE =
  "our chat fingerprint: a closed list of 12 provider hosts (Olark, Freshchat, Chatra, Smartsupp, JivoChat, Weave, Hatch, Chatwoot and LeadConnector's own widget are NOT on it)";

const BINDINGS: Record<string, ValuePicker[]> = {
  // §2.1 — the review count + fragments are already in FiredLeak.evidence.
  slow_speed_to_lead: [
    permit(
      "googleReviews.reviewTexts",
      "M",
      "verbatim Google review text",
      "N reviews mention slow or no response, plus fragments of ≤10 words. NEVER an hours/days figure attributed to them — that is speed_avg_response_42h, an industry average.",
      ["review_content"],
      // ONLY WHEN THERE ARE REVIEWS TO QUOTE. Binding a length of 0 would license
      // "N reviews mention…" for a business with none — the shape of the original
      // bug, in miniature: a value that exists is not the same as a value that
      // says anything.
      (d) => d.googleReviews?.reviewTexts?.length || null
    ),
    permitTri(
      "hasContactForm",
      "a /<form\\b/i match over the joined rawHtml — proof a form EXISTS, not proof it is a contact form",
      "A contact form is present.",
      ["contact_form"]
    ),
    permitTri("hasChatWidget", CHAT_ABSENCE_SOURCE, "No chat widget detected.", ["chat_widget"]),
  ],

  // §2.2 — "visible" is load-bearing on the texting clause and must survive
  // rephrasing. Never a missed-call count or rate for THIS business.
  missed_calls_no_recovery: [
    permit(
      "googleReviews.reviewTexts",
      "M",
      "verbatim Google review text",
      "N reviews mention unanswered or missed calls, plus fragments.",
      ["review_content"],
      // ONLY WHEN THERE ARE REVIEWS TO QUOTE. Binding a length of 0 would license
      // "N reviews mention…" for a business with none — the shape of the original
      // bug, in miniature: a value that exists is not the same as a value that
      // says anything.
      (d) => d.googleReviews?.reviewTexts?.length || null
    ),
    permit(
      "business.phone",
      "M",
      "Google Places",
      "A published phone line exists (presence only).",
      ["phone_line"],
      (d) => (d.business.phone ? true : null)
    ),
    permit(
      "website.mentionsTextingOption",
      "H",
      "a TEXTING_RE regex over the markdown corpus — prose, not a mechanism",
      "No VISIBLE text-back or missed-call recovery path on the pages we scanned. The scoping word is mandatory: this never establishes what happens to a missed call.",
      ["texting_path"],
      (d) => (d.website ? d.website.mentionsTextingOption : null)
    ),
  ],

  // §2.3 — the two halves have different provenance and the sentence must keep
  // them apart: the hours are Google's data, the absence is bounded by us.
  no_after_hours_coverage: [
    permit(
      "gbp.limitedHours",
      "M",
      "DataForSEO work_time.work_hours.timetable",
      "Your Google hours show evenings and weekends closed.",
      ["gbp_hours"],
      (d) => (d.gbp ? d.gbp.limitedHours : null)
    ),
    permit(
      "gbp.hoursListed",
      "M",
      "DataForSEO work_time",
      "Whether hours are listed on the Google profile at all.",
      ["gbp_hours"],
      (d) => (d.gbp ? d.gbp.hoursListed : null)
    ),
    permitTri(
      "hasOnlineBookingLink",
      BOOKING_ABSENCE_SOURCE,
      "We found no booking link on the pages we scanned.",
      ["booking_path"]
    ),
    permitTri(
      "hasChatWidget",
      CHAT_ABSENCE_SOURCE,
      "We found no chat widget on the pages we scanned.",
      ["chat_widget"]
    ),
  ],

  // §2.4 — present tense, scoped. NOT "the only way to become a customer is to
  // call": the leak fires happily on sites that have a working contact form.
  no_online_booking: [
    permitTri(
      "hasOnlineBookingLink",
      BOOKING_ABSENCE_SOURCE,
      "No online booking link on the site or the Google Business Profile.",
      ["booking_path"]
    ),
    permit(
      "gbp.hasBookingLink",
      "M",
      "DataForSEO book_online_url",
      "No booking link on the Google Business Profile.",
      ["booking_path"],
      (d) => (d.gbp ? d.gbp.hasBookingLink : null)
    ),
  ],

  // §2.5 — "detected" is load-bearing: CHAT_PROVIDERS is a closed list of 12.
  no_webchat: [
    permitTri(
      "hasChatWidget",
      CHAT_ABSENCE_SOURCE,
      "No live-chat or webchat widget DETECTED on the pages we scanned.",
      ["chat_widget"]
    ),
  ],

  // §2.6 — `formHasQualifyingFields` is a prose regex over the whole cleaned-HTML
  // corpus and never inspects the form, so it binds at H and must not be
  // described as measured. See §3.6: fixing the measurement is a product call.
  no_lead_qualification: [
    permitTri(
      "hasContactForm",
      "a /<form\\b/i match over the joined rawHtml — a site-search box or a login form satisfies it",
      "A form is present somewhere on the scanned pages.",
      ["contact_form"]
    ),
    permit(
      "website.formHasQualifyingFields",
      "H",
      "QUALIFYING_FIELD_RE over the JOINED cleaned HTML of every scraped page — NOT scoped to the form element",
      "The qualifying vocabulary (job type / budget / timeline / service area) does not appear anywhere on the pages we scanned. This does NOT establish what the form asks — we never read the form.",
      ["form_fields"],
      (d) => (d.website ? d.website.formHasQualifyingFields : null)
    ),
    permitTri("hasChatWidget", CHAT_ABSENCE_SOURCE, "No chat capture detected.", ["chat_widget"]),
  ],

  // §2.7 — THE BUG. One permitted value, one permitted sentence. Everything the
  // shipped finding said about position and prominence is forbidden outright, at
  // any grade, in any deliverable, and is unreachable through this binding.
  weak_landing_cta: [
    permitTri(
      "hasClickToCallOnMobile",
      'a /href=["\']tel:/i match over the rawHtml corpus',
      "No tel: link found anywhere in the HTML of the pages we scanned. Falsifiable in one browser inspection — and it is the ONLY thing this leak may say.",
      ["click_to_call"]
    ),
  ],

  // §2.8 — unconfirmed, the shipped evidence string names itself an industry
  // pattern and that clause must not be compressed away.
  no_follow_up_sequence: [
    permit(
      "googleReviews.reviewTexts",
      "M",
      "verbatim Google review text",
      "N reviews mention no follow-up or a promised quote that never arrived, plus fragments.",
      ["review_content"],
      // ONLY WHEN THERE ARE REVIEWS TO QUOTE. Binding a length of 0 would license
      // "N reviews mention…" for a business with none — the shape of the original
      // bug, in miniature: a value that exists is not the same as a value that
      // says anything.
      (d) => d.googleReviews?.reviewTexts?.length || null
    ),
  ],

  // §2.9 — never a no-show rate for this business.
  no_show_exposure: [
    permit(
      "googleReviews.reviewTexts",
      "M",
      "verbatim Google review text",
      "N reviews mention scheduling friction, plus fragments.",
      ["review_content"],
      // ONLY WHEN THERE ARE REVIEWS TO QUOTE. Binding a length of 0 would license
      // "N reviews mention…" for a business with none — the shape of the original
      // bug, in miniature: a value that exists is not the same as a value that
      // says anything.
      (d) => d.googleReviews?.reviewTexts?.length || null
    ),
  ],

  // §2.10 / §2.12 / §2.16 — the intake answer or nothing at all. Each ships a
  // BENCHMARK string that states out loud it is a pattern; that IS the sentence.
  no_crm_pipeline: [],
  no_long_cycle_nurture: [],
  no_call_tracking: [],

  // §2.11 — the count evidences OPERATING HISTORY only. Never a list size, a
  // dormancy period, or any figure about their database.
  no_database_reactivation: [
    permit(
      "googleReviews.count",
      "M",
      "Google",
      "N reviews point to years of completed jobs — evidence of operating history and nothing more.",
      ["review_volume"],
      (d) => d.googleReviews?.count ?? null
    ),
  ],

  // §2.13 — the numbers are real and the LABEL on them is wrong. `competitors`
  // is the top 3 BY RATING (audit-intelligence.ts:382), not a market sample, so
  // the sample has to be named. Never a per-month velocity figure.
  low_review_velocity: [
    permit(
      "googleReviews.count",
      "M",
      "Google",
      "Your Google review count.",
      ["review_volume"],
      (d) => d.googleReviews?.count ?? null
    ),
    permit(
      "googleReviews.rating",
      "M",
      "Google",
      "Your Google rating.",
      ["review_volume"],
      (d) => d.googleReviews?.rating ?? null
    ),
    permit(
      "competitors[].reviewCount (median)",
      "M",
      "Google, via the three HIGHEST-RATED nearby businesses we pulled — not a market cross-section",
      "N reviews, against a median of ~M across the highest-rated nearby businesses we pulled. The sample must be named; it is not 'the local benchmark'.",
      ["competitor_reviews", "review_volume"],
      // THE MEDIAN, COMPUTED THE WAY THE DETECTOR COMPUTES IT — including the upper
      // median on an even-length array (§3.13). Binding the array LENGTH here (as a
      // first cut did) put "2" into the allowed figures for a two-competitor
      // comparison, which is a number about our sample masquerading as a number
      // about their market. The individual counts reach the figure set through the
      // detector's own evidence string, which prints both sides of the comparison.
      (d) => {
        const counts = (d.competitors ?? [])
          .map((c) => c.reviewCount)
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        return counts.length ? counts[Math.floor(counts.length / 2)] : null;
      }
    ),
  ],

  // §2.14 / §2.15 / §2.17 — intake answers, plus channel PRESENCE for social.
  // Never reply rates, DM response times, or deposit-handling descriptions.
  no_review_replies: [],
  payment_booking_friction: [],
  social_dm_unmanaged: [
    permit(
      "website.linksToFacebook",
      "M",
      "host-matched links from Firecrawl's link map",
      "A Facebook profile is linked from the site — channel PRESENCE only, never response behaviour.",
      ["social_channels"],
      (d) => (d.website ? d.website.linksToFacebook : null)
    ),
    permit(
      "website.linksToInstagram",
      "M",
      "host-matched links from Firecrawl's link map",
      "An Instagram profile is linked from the site — channel PRESENCE only.",
      ["social_channels"],
      (d) => (d.website ? d.website.linksToInstagram : null)
    ),
  ],

  // §2.18 — the cleanest observed leak in the file. CLS is fetched and dropped
  // before ScrapeData, so it cannot be cited without widening the contract.
  oos_slow_site_speed: [
    permit(
      "pageSpeed.mobileScore",
      "M",
      "Lighthouse, mobile strategy, per run",
      "Mobile PageSpeed N/100, with the date of the run.",
      ["page_speed"],
      (d) => d.pageSpeed?.mobileScore ?? null
    ),
    permit(
      "pageSpeed.lcpSeconds",
      "M",
      "Lighthouse, mobile strategy, per run",
      "Largest Contentful Paint X seconds, with the date of the run.",
      ["page_speed"],
      (d) => d.pageSpeed?.lcpSeconds ?? null
    ),
  ],
};

/** Every figure a finding may print about THIS business.
 *
 *  Two sources, both deterministic: the bound numeric VALUES, and the numbers
 *  inside the detector's own evidence strings (which is where a matched-review
 *  count like "3 reviews mention…" lives — produced by `matchReviewSignal`, not
 *  by a model). Industry statistics are deliberately NOT here: they travel with
 *  their citation through `allowedStats`, and conflating the two is how an
 *  industry rate gets printed as this business's number. */
function bindingNumbers(values: BoundValue[], fired: FiredLeak): number[] {
  const nums = new Set<number>();
  for (const v of values) if (typeof v.value === "number") nums.add(v.value);
  for (const line of fired.evidence) {
    for (const tok of extractNumbers(line)) {
      const n = normalizeNumericToken(tok);
      if (n !== null) nums.add(n);
    }
  }
  return Array.from(nums);
}

/** Fields no finding may cite, as leak-taxonomy.ts declares them. Read, never
 *  re-listed: the moment this file carried its own copy the two would disagree
 *  about which measurements are real, and the disagreement would show up as a
 *  document that passes one gate and fails the other. */
const UNCITABLE = new Set<string>(UNCITABLE_SCRAPE_FIELDS);

/** DISPUTED TOPICS — the one place the two contracts do not agree, made visible
 *  instead of silently resolved.
 *
 *  docs/detector-checkability.md §2.2 permits `missed_calls_no_recovery` to
 *  reference `website.mentionsTextingOption`, with the word "visible" declared
 *  load-bearing ("no VISIBLE text-back path"). Its own §7 then lists that field
 *  among the ones no finding may cite, and leak-taxonomy.ts's
 *  UNCITABLE_SCRAPE_FIELDS follows §7. Both readings are defensible: the regex is
 *  a real fingerprint for the phrase "text us" and a reader can check it in ten
 *  seconds, but an empty or bot-walled corpus also yields `false`, which reads as
 *  an absence we never established.
 *
 *  So the rule is mechanical and self-maintaining rather than a judgment I make
 *  here: a permitted value whose field is UNCITABLE is DROPPED from the binding
 *  (the taxonomy's list wins, always), and the topic it would have licensed is
 *  recorded as disputed. A claim on a disputed topic is reported at WARNING with
 *  the disagreement named — never fatal, because blocking his best sentence over
 *  an unresolved contract is how a gate gets commented out. If the field is ever
 *  taken off the uncitable list, the value binds and the claim is properly
 *  licensed with no edit here; if another field is added to it, that topic becomes
 *  disputed the same way. */
function partitionByCitability(
  candidates: BoundValue[]
): { values: BoundValue[]; disputedTopics: ClaimTopic[] } {
  const values: BoundValue[] = [];
  const disputed = new Set<ClaimTopic>();
  for (const v of candidates) {
    if (UNCITABLE.has(v.field)) {
      for (const t of v.topics) disputed.add(t);
      continue;
    }
    values.push(v);
  }
  // A topic that some OTHER citable value also licenses is not disputed.
  for (const v of values) for (const t of v.topics) disputed.delete(t);
  return { values, disputedTopics: Array.from(disputed) };
}

/** Build the evidence binding for one fired leak. PURE, deterministic, and the
 *  only place a binding is constructed.
 *
 *  An unknown leak id yields an EMPTY binding, which is the safe direction: a leak
 *  with no declared permitted values licenses no claim about their public surface
 *  until somebody declares them. */
export function bindEvidence(fired: FiredLeak, data: ScrapeData): EvidenceBinding {
  const id = fired.leak.id;
  const candidates = (BINDINGS[id] ?? [])
    .map((pick) => pick(data, fired))
    .filter((v): v is BoundValue => v !== null);
  const { values, disputedTopics } = partitionByCitability(candidates);
  return {
    leakId: id,
    checkability: fired.leak.checkability,
    neverObserved: neverObservedReason(id),
    values,
    disputedTopics,
    numbers: bindingNumbers(values, fired),
  };
}

/** THE GRADE DEPENDS ON CHECKABILITY, not only on the tier.
 *
 *  An INTERPRETIVE leak may never be graded `observed`, whatever its detector
 *  said, because "observed" is what prints "Measured on your public pages" and
 *  there is no measurement under an editorial judgment.
 *
 *  WHY THIS EXISTS WHEN `gradeOf` ALREADY REFUSES THE COMBINATION. Deliberate
 *  redundancy on the one rule this fix is about. `gradeOf` applies the ceiling at
 *  DETECTION, from the taxonomy's `checkability`; this applies it again on the way
 *  into the deliverable, from the fired leak in hand; the two validators refuse it
 *  a third time on the saved artifact. Three independent guards, so no single edit
 *  can switch the rule off — and if this one is ever a no-op, that is the proof
 *  the first one is still working, not an argument for deleting it.
 *
 *  IT IS A CLAMP, NOT A RECOMPUTATION — the distinction matters, because
 *  `FiredLeak.grade` is carried and never recomputed on purpose (buildLeakInputs
 *  below says so). This never RAISES a grade and never reads the tier: it lowers
 *  `observed` to the honest grade for a leak whose measurement does not exist, and
 *  touches nothing else. `disclosed` when the client confirmed the gap themselves
 *  (their own word still stands), `inferred` otherwise. */
export function clampGradeToCheckability(
  leak: { checkability: Checkability },
  grade: EvidenceGrade,
  intakeConfirmed: boolean | undefined
): EvidenceGrade {
  if (grade !== "observed") return grade;
  if (leak.checkability !== "INTERPRETIVE") return grade;
  return intakeConfirmed === true ? "disclosed" : "inferred";
}

// ── Structured leak input for the generator ──────────────────────────────────

export interface LeakInput {
  id: string;
  name: string;
  /** Raw taxonomy scorecard axis key (null for out-of-scope leaks). */
  scorecardArea: string | null;
  symptom: string;
  revenueMechanism: string;
  tier: EvidenceTier;
  /** MEASURED / TOLD / GUESSED — copied from the fired leak, never recomputed
   *  here. This is what decides whether the copy may read declaratively, and it is
   *  what gets stamped onto the saved pack (LeakAnalysisItem.evidenceGrade). */
  grade: EvidenceGrade;
  /** Is the LEAK itself externally observable, or internal to the operation?
   *  INVISIBLE leaks may only be written as pattern + visible-absence +
   *  conditional — never a flat operational assertion — regardless of tier. */
  evidenceClass: EvidenceClass;
  tierPhrasingRule: string;
  /** The honesty instruction for this leak's grade (GRADE_VOICE). Travels beside
   *  tierPhrasingRule: that one is the paragraph's shape, this one is how much
   *  the paragraph is allowed to claim. */
  gradeVoiceRule: string;
  evidence: string[];
  /** Allowed stat phrases (Tier A claim; Tier B softFraming only). */
  allowedStats: string[];
  /** BENCHMARK-slot body: the industry pattern expressed via the allowed
   *  stat/softFraming. Null for OBSERVED/EVIDENCED leaks (they show real
   *  evidence instead of a pattern). */
  industryPattern: string | null;
  /** Pre-computed, labeled dollar/spend frame — or null (then emit no figure). */
  mathFrame: string | null;
  /** Deterministic dollar breakdown stamped into dollarImpact (determinism fix 1).
   *  Null when the frame is qualitative (no $ figure). Its low/high are guaranteed
   *  consistent with `mathFrame` and present in `allowedNumbersFor`. */
  dollar: MathImpact | null;
  /** REAL vs BENCHMARK for the dollar frame, or null when there's no frame.
   *  A whole document runs one mode; this lets copy pick the right framing. */
  mathMode: "REAL" | "BENCHMARK" | null;
  /** Set when this leak's dollar figure is a SUBSET of another leak's: the id it
   *  slices out of. Non-null ⇒ excluded from every total (reconcileLeakTotal). */
  overlapsWith: string | null;
  /** The plain-English overlap sentence to render beside the figure. Null when
   *  the figure stands alone. */
  overlapNote: string | null;
  /** The kickoff-verification line, present only for BENCHMARK leaks that were
   *  NOT confirmed at intake. */
  requiresKickoffLine: boolean;
  /** The client told us at intake they lack this system → state it as a
   *  confirmed fact ("Confirmed at intake"), no kickoff line. */
  intakeConfirmed: boolean;
  /** THE SPECIFIC MEASURED VALUES THIS FINDING MAY REFERENCE — actual field paths
   *  and actual values out of the scrape, stamped here and never authored by the
   *  model (see the EVIDENCE BINDING section above). It rides from this point to
   *  the persisted finding and back out to the validator, which is what makes the
   *  grade certify that a SENTENCE is true rather than that a detector fired. */
  binding: EvidenceBinding;
}

export function buildLeakInputs(fired: FiredLeak[], data: ScrapeData): LeakInput[] {
  return fired.map((f) => {
    const math = f.leak.mathTemplate
      ? computeMathEstimate(f.leak.mathTemplate, data)
      : null;
    const allowedStats = resolveStats(f.leak.statIds).map(allowedStatPhrase);
    const binding = bindEvidence(f, data);
    // CARRIED, NOT RECOMPUTED — then CLAMPED. getFiredLeaks derived the grade once
    // from what the detector actually found, and deriving it a second time here is
    // how the deliverable's voice and the detection's honesty drift apart. The
    // clamp is not a second derivation: it reads no tier and can only ever LOWER
    // `observed` on a leak whose "measurement" is an editorial judgment
    // (clampGradeToCheckability). Every rule below keys off this one value, so the
    // voice, the prompt and the stamped grade all move together.
    const grade = clampGradeToCheckability(f.leak, f.grade, f.intakeConfirmed);
    return {
      id: f.leak.id,
      name: f.leak.name,
      scorecardArea: f.leak.scorecardArea,
      symptom: f.leak.symptom,
      revenueMechanism: f.leak.revenueMechanism,
      tier: f.tier,
      grade,
      evidenceClass: f.leak.evidenceClass,
      tierPhrasingRule: TIER_PHRASING[f.tier],
      gradeVoiceRule: GRADE_VOICE[grade],
      evidence: f.evidence,
      allowedStats,
      // A BENCHMARK leak's "Industry pattern" slot is exactly its allowed
      // stat/softFraming — never the symptom (Defect 4). Null for other tiers.
      industryPattern:
        f.tier === "BENCHMARK" && allowedStats.length
          ? allowedStats.join(" ")
          : null,
      mathFrame: math?.frame ?? null,
      dollar: math?.impact ?? null,
      mathMode: math?.mode ?? null,
      overlapsWith: math?.overlapsWith ?? null,
      overlapNote: math?.overlapNote ?? null,
      // Intake-confirmed BENCHMARK leaks are stated as fact, so they carry the
      // confirmed framing INSTEAD of the kickoff-verification line.
      requiresKickoffLine: f.tier === "BENCHMARK" && !f.intakeConfirmed,
      intakeConfirmed: f.intakeConfirmed ?? false,
      binding,
    };
  });
}

// ── Non-double-counted total (A2) ────────────────────────────────────────────
// The report used to sum every leak's dollar frame. Two of those frames were the
// same lost calls counted twice (after-hours calls ARE missed calls), which is
// indefensible in front of an owner with a calculator. The arithmetic lives here
// so there is exactly ONE place a total can be computed; the renderer only
// prints what this returns, including the disclosure sentence.

export interface LeakTotal {
  /** Sum of the low bounds of every NON-overlapping frame, AFTER the credibility
   *  cap below. This is the only number a document may print as the total. */
  low: number;
  /** Sum of the high bounds of every NON-overlapping frame, AFTER the cap. */
  high: number;
  /** Leak ids deliberately left out of the sum because they are subsets. */
  excluded: string[];
  /** Plain-English statement of what was excluded and why. Safe to render
   *  verbatim; empty string when nothing overlapped (nothing to disclose). */
  disclosure: string;
  /** What the credibility cap did to the figure, and the sentence that says so.
   *  ALWAYS present — the cap either bound, or held and was checked, or could not
   *  be applied at all, and each of those three is something the reader is told. */
  cap: LeakTotalCap;
}

// ── The credibility cap (D2) ─────────────────────────────────────────────────
// A recovery figure bigger than the business is a credibility bomb in front of an
// owner with a calculator: the moment the headline looks larger than what he
// actually bills, every other number in the report stops being believed — including
// the ones that are right. So the reconciled total is held under a ceiling built
// from the owner's OWN two numbers, and the page says which of the three things
// happened.
//
// ONE IMPLEMENTATION, HERE, BESIDE THE OVERLAP RECONCILIATION. It is the same
// arithmetic pipeline — the total is computed in exactly one place, so the thing
// that bounds the total belongs in that same place. A second cap applied somewhere
// downstream would be worse than no cap: two ceilings that disagree is how a
// document ends up printing a number no code path can explain.

/** The share of the client's own implied monthly billing that this report will
 *  print as recoverable, at most.
 *
 *  HALF, and not something tighter, because this is a guard against ABSURD
 *  arithmetic — not a second opinion on the leak math. Ordinary output lands far
 *  under it (the committed sample sits around a tenth of the ceiling), so it only
 *  binds when something upstream has gone wrong, which is precisely when a reader
 *  needs to be told rather than quietly served a trimmed number.
 *
 *  It is a PRESENTATION CHOICE, not a measurement, and it is labelled as one
 *  everywhere it reaches a client — same rule as every other ASSUMPTIONS entry. */
export const RECOVERY_CAP_SHARE = 0.5;

export interface LeakTotalCap {
  /** Did we have the client's own numbers to bound the figure against at all?
   *  False on every pre-intake (BENCHMARK-mode) pack — and that is disclosed too,
   *  because "we could not size this against your revenue" is itself a fact the
   *  reader is entitled to. */
  applicable: boolean;
  /** Did the cap actually BIND — i.e. is the printed figure the ceiling rather
   *  than the sum? A silently capped number is its own dishonesty, so this is what
   *  the renderer keys the louder disclosure off. */
  binding: boolean;
  /** The ceiling in CAD/mo, or null when it could not be computed. */
  ceiling: number | null;
  /** The pre-cap reconciled bounds, kept so the page can show its working when
   *  the cap bound ("added up they came to X; we are showing Y"). */
  uncappedLow: number;
  uncappedHigh: number;
  /** The sentence the page must render. NEVER empty — there is always something
   *  honest to say about the ceiling, including that we had nothing to build it
   *  from. Safe to render verbatim. */
  note: string;
}

/** The client's own monthly volume, as the REAL-mode math frames write it:
 *  "Based on your 90 enquiries/mo (estimated projection)" /
 *  "Based on your 25 booked/mo (estimated projection)". */
const CLIENT_VOLUME_RE = /\b(\d[\d,]*)\s+(enquiries|booked)\b/i;
/** The client's own average job value, as the REAL-mode frames write it:
 *  "CAD $1,450 average customer value — your number". */
const CLIENT_VALUE_RE = /CAD\s*\$\s*(\d[\d,]*)\s+average customer value/i;

function toInt(s: string): number {
  return Number(s.replace(/,/g, ""));
}

interface RecoveryCeiling {
  /** The most this report may print as a monthly total, in CAD. */
  ceiling: number;
  /** What the ceiling RESTS ON, in the owner's own language. Never a revenue
   *  figure we invented — only his two numbers and the named assumption that
   *  turns them into a billing estimate. */
  basis: string;
}

/**
 * Build the ceiling from the client's OWN numbers, or return null.
 *
 * WHY IT PARSES STRINGS AND WHY THAT IS SAFE HERE. A saved pack carries the
 * labelled bases, not the raw intake integers, so at render time the strings are
 * the only place those numbers still exist. Crucially it is parsing OUR OWN fixed
 * wording — the two regexes above match exactly what computeMathEstimate writes a
 * hundred lines up in this same file — so the writer and the reader change
 * together. It never parses model prose.
 *
 * THREE GUARDS BEFORE A NUMBER IS TRUSTED: the frame must not be benchmark-valued,
 * and BOTH the volume line and the value line must attribute themselves to the
 * client (attributesToClient — the same list the validator's dollar-provenance
 * guard uses). That is what stops the pre-intake assumption ("~20 enquiries a
 * month") and the industry cost-per-lead benchmark from being laundered into a
 * revenue figure the client never gave us.
 */
function clientRecoveryCeiling(inputs: LeakTotalInput[]): RecoveryCeiling | null {
  let enquiries = 0;
  let booked = 0;
  let avgValue = 0;

  for (const li of inputs) {
    const d = li.dollar;
    if (!d || d.usesBenchmarkValue) continue;
    if (!attributesToClient(d.avgValueBasis) || !attributesToClient(d.leadVolumeBasis)) continue;
    const value = CLIENT_VALUE_RE.exec(d.avgValueBasis);
    const volume = CLIENT_VOLUME_RE.exec(d.leadVolumeBasis);
    if (!value || !volume) continue;
    avgValue = Math.max(avgValue, toInt(value[1]));
    if (/booked/i.test(volume[2])) booked = Math.max(booked, toInt(volume[1]));
    else enquiries = Math.max(enquiries, toInt(volume[1]));
  }

  if (!avgValue || (!enquiries && !booked)) return null;
  const sharePct = round0(RECOVERY_CAP_SHARE * 100);

  // BOOKED JOBS FIRST. Booked jobs × their average job value IS roughly what the
  // business bills in a month — no close-rate assumption needed — so when we have
  // it, it is the honest basis. Enquiries are only demand, which is why the
  // fallback below has to spend an assumption to turn them into billing.
  if (booked) {
    return {
      ceiling: round0(booked * avgValue * RECOVERY_CAP_SHARE),
      basis: `${sharePct}% of what your own numbers say you bill in a month — your ${booked} booked jobs a month at your ${cad(
        avgValue
      )} average job (the ${sharePct}% ceiling is ${ASSUMPTION_CAVEAT})`,
    };
  }

  const close = ASSUMPTIONS.conservative_close_rate.value;
  return {
    ceiling: round0(enquiries * avgValue * close * RECOVERY_CAP_SHARE),
    basis: `${sharePct}% of what your own numbers imply you bill in a month — your ${enquiries} enquiries a month at your ${cad(
      avgValue
    )} average job, closed at ${round0(close * 100)}% (that close rate and the ${sharePct}% ceiling are both ${ASSUMPTION_CAVEAT})`,
  };
}

/** The line the page shows when there is nothing to bound the figure against.
 *  Says what is missing and what happens next — never a made-up revenue figure,
 *  and never silence. */
const CAP_NOT_APPLICABLE_NOTE =
  "We have not sized this figure against what you bill. That needs two numbers we do not have yet — how many enquiries you get in a month, and what an average job is worth — so this stays an estimate built from industry rates until you give us those at kickoff, when we re-run it against your own numbers.";

/** The subset of a LeakInput this function actually reads. Declared as a Pick so
 *  the RENDERER can call it: a saved pack carries only LeakAnalysisItem, not the
 *  generation-time material (evidence strings, phrasing rules, allowed stats), so
 *  demanding a full LeakInput would force a lying cast at the render boundary. */
export type LeakTotalInput = Pick<
  LeakInput,
  "id" | "name" | "dollar" | "overlapsWith" | "overlapNote"
>;

/** Sum only the frames that stand on their own, then hold the result under the
 *  credibility ceiling.
 *
 *  TWO ADJUSTMENTS, ONE FUNCTION, BOTH DISCLOSED:
 *    1. OVERLAP — any input carrying overlapsWith is a slice of another leak's
 *       figure. It keeps its own displayed number but is excluded from the total,
 *       and the reason is stated in `disclosure`.
 *    2. CAP — the surviving sum is held under a share of what the client's own
 *       numbers say they bill in a month, and `cap.note` says whether that bound,
 *       held, or could not be applied.
 *
 *  Both are the same act: printing a total a reader can check. Neither is ever
 *  applied silently. */
export function reconcileLeakTotal(inputs: LeakTotalInput[]): LeakTotal {
  let low = 0;
  let high = 0;
  const excluded: string[] = [];
  const notes: string[] = [];
  const nameById = new Map(inputs.map((i) => [i.id, i.name]));

  for (const li of inputs) {
    if (!li.dollar) continue; // qualitative frame — nothing to add
    if (li.overlapsWith) {
      excluded.push(li.id);
      const parent = nameById.get(li.overlapsWith) ?? li.overlapsWith;
      notes.push(
        `"${li.name}" is not added to this total. ${
          li.overlapNote ?? `It is a share of "${parent}", not additional to it.`
        }`
      );
      continue;
    }
    low += li.dollar.low;
    high += li.dollar.high;
  }

  const uncappedLow = round0(low);
  const uncappedHigh = round0(high);
  const bound = clientRecoveryCeiling(inputs);

  // NO BASIS ⇒ NO CAP, AND SAY SO. Inventing a revenue figure to cap against
  // would be the exact dishonesty the cap exists to prevent, so the pre-intake
  // case gets the plain admission instead of a silently uncapped number.
  if (!bound) {
    return {
      low: uncappedLow,
      high: uncappedHigh,
      excluded,
      disclosure: notes.join(" "),
      cap: {
        applicable: false,
        binding: false,
        ceiling: null,
        uncappedLow,
        uncappedHigh,
        note: CAP_NOT_APPLICABLE_NOTE,
      },
    };
  }

  const binding = uncappedHigh > bound.ceiling;
  // SCALED, NOT CLAMPED. Clamping each end at the ceiling collapses a range into
  // "CAD $X–CAD $X" the moment both ends exceed it, which reads like a fabricated
  // point estimate. Scaling both by the same factor keeps the shape of the range
  // the itemized math produced and moves both ends DOWN, so the result can only
  // ever understate.
  const factor = binding && uncappedHigh > 0 ? bound.ceiling / uncappedHigh : 1;

  return {
    low: round0(uncappedLow * factor),
    high: round0(uncappedHigh * factor),
    excluded,
    disclosure: notes.join(" "),
    cap: {
      applicable: true,
      binding,
      ceiling: bound.ceiling,
      uncappedLow,
      uncappedHigh,
      note: binding
        ? `This figure has been capped. Added up, the leaks below came to ${cad(
            uncappedLow
          )}–${cad(uncappedHigh)} a month, which is more than ${
            bound.basis
          }. We show the ceiling instead of the larger number, because a recovery figure bigger than the business is not a figure you can act on.`
        : `Sense-checked against your own numbers. This report caps its monthly total at ${bound.basis}. The figure above sits under that ceiling, so nothing has been trimmed.`,
    },
  };
}

/** Render the leak inputs as a bounded prompt block: "write ONLY from this". */
export function leakInputsToPromptBlock(inputs: LeakInput[]): string {
  const lines: string[] = [
    "FIRED LEAKS — the ONLY leaks you may write about. For each, use ONLY the material below.",
    "You may rephrase for flow; you may NOT add facts, numbers, competitors, or claims not present here.",
    "EVIDENCE OVERRIDES EXAMPLE MAGNITUDES (Part E): the 'why it costs money' line may contain a generic example magnitude (e.g. \"triple the reviews\"). When THIS business's evidence gives the real numbers, substitute them (e.g. \"16 vs the competitor's 344\") — describe the actual observed gap. NEVER state a magnitude that contradicts the evidence numbers below.",
    "CITATIONS (Part G): each allowed stat already carries its source in parentheses, e.g. \"(CallRail)\". Whenever you cite an industry statistic, KEEP that inline source tag exactly. Apply this to EVERY statistic, consistently — never cite a figure without its source, never invent a source.",
    "",
  ];
  inputs.forEach((li, i) => {
    lines.push(
      `${i + 1}. ${li.name}  [grade: ${li.grade}] [tier: ${li.tier}] [class: ${li.evidenceClass}]`
    );
    lines.push(`   symptom: ${li.symptom}`);
    lines.push(`   why it costs money (substitute the real evidence magnitudes below for any generic example figure — Part E): ${li.revenueMechanism}`);
    lines.push(`   evidence you may cite: ${li.evidence.length ? li.evidence.join(" · ") : "(none — do not fabricate)"}`);
    // THE BINDING, SPELLED OUT. The evidence line above is prose we wrote; this is
    // the list of VALUES behind it, with the exact sentence each one licenses. The
    // model may restate a value and explain what it costs; anything else it says
    // about their public pages is a fact it invented, and the lint fails on it.
    if (li.binding.values.length) {
      lines.push(
        "   MEASURED VALUES YOU MAY REFERENCE — each line is field = value, then the ONLY assertion that value supports:"
      );
      for (const v of li.binding.values)
        lines.push(
          `     · ${v.field} = ${JSON.stringify(v.value)}  [${v.provenance}, from ${v.source}]  →  ${v.licenses}`
        );
    } else {
      lines.push(
        "   MEASURED VALUES YOU MAY REFERENCE: (none — this leak rests on NO observation of their public pages. Make no factual claim about their site, form, phone, booking path, hours or reviews in this finding.)"
      );
    }
    lines.push(
      "   FORBIDDEN IN THIS FINDING, AT ANY GRADE: anything about where something sits on a page or how easy it is to see — \"above the fold\", \"below the fold\", \"buried\", \"hidden\", \"hard to find\", \"in the footer\", \"three scrolls down\", \"no clear call to action\", \"the page doesn't tell visitors what to do\", \"generic contact us\". We render no page and measure no position, so none of that is checkable and none of it may appear."
    );
    lines.push(`   allowed stats (use verbatim meaning, no other numbers): ${li.allowedStats.length ? li.allowedStats.map((s) => `"${s}"`).join(" | ") : "(none — cite no statistics)"}`);
    lines.push(`   dollar/spend framing: ${li.mathFrame ? li.mathFrame : "(no dollar figure — do NOT invent one)"}`);
    if (li.overlapNote)
      lines.push(
        `   OVERLAPPING FIGURE — this leak's dollar figure is a SUBSET of another leak's, not a separate loss. You MUST include this sentence beside the figure: "${li.overlapNote}" Never add this number to another leak's number, and never roll it into a total.`
      );
    // Voice first, shape second: how much this leak may claim outranks how the
    // paragraph is laid out, and the model reads these in order.
    lines.push(`   how much you may claim (grade ${li.grade}): ${li.gradeVoiceRule}`);
    lines.push(`   phrasing rule: ${li.tierPhrasingRule}`);
    if (li.evidenceClass === "INVISIBLE")
      lines.push(
        `   INVISIBLE LEAK — this happens INSIDE their operation and CANNOT be seen from a cold scan. Write it ONLY as pattern + visible-absence + conditional. NEVER assert it as an operational fact about THEM ("they receive no follow-up", "your team doesn't return calls", "there is no reminder system"). Allowed shape: name the visible ABSENCE you can see (no public booking path, no "text us" option, a review pattern), then the industry pattern, then a conditional ("if that's how it works today…"). Even when a review lifts this to EVIDENCED, attribute the operational claim to the review signal — do not state it as flat fact.`
      );
    if (li.intakeConfirmed)
      lines.push(
        `   CONFIRMED AT INTAKE — the client told us they do NOT have this in place. State it as an established fact: drop the "not externally visible" hedging and do NOT add the kickoff-verification line. Frame it as "You told us you don't currently have this — here's what it costs," then give the cost using ONLY the allowed stat/math above.`
      );
    else if (li.requiresKickoffLine) lines.push(`   MUST end with: "${KICKOFF_VERIFICATION_LINE}"`);
    lines.push("");
  });
  return lines.join("\n");
}

// ── Stat guard ───────────────────────────────────────────────────────────────

/** Extract every numeric token (%, x-multiplier, $, plain number) from text. */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\$?\d[\d,]*(?:\.\d+)?\s?(?:%|x|×)?/gi) ?? [];
  return matches.map((m) => m.trim()).filter((m) => /\d/.test(m));
}

function normalizeNumericToken(token: string): number | null {
  const cleaned = token.replace(/[$,%x×\s]/gi, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface StatGuardResult {
  ok: boolean;
  violations: string[];
}

/**
 * Scan generated text for numeric claims and verify each against the allowed
 * set: STATS numbers for the fired leaks, math-template results, and the
 * business's own observed data. Small numbers (years, list counts, step
 * numbers) below `ignoreBelow` are not treated as statistical claims.
 */
export function statGuard(
  text: string,
  allowed: number[],
  opts: { ignoreBelow?: number } = {}
): StatGuardResult {
  const ignoreBelow = opts.ignoreBelow ?? 3;
  const allowedSet = new Set(allowed.map((n) => Math.round(n * 100) / 100));
  const violations: string[] = [];

  for (const token of extractNumbers(text)) {
    const n = normalizeNumericToken(token);
    if (n === null) continue;
    if (n < ignoreBelow && !/[%x×$]/.test(token)) continue; // ignore small bare ints
    // Allow if within 1% of any permitted number (rounding tolerance) or exact.
    const hit = Array.from(allowedSet).some((a) => a === n || (a !== 0 && Math.abs(a - n) / a < 0.01));
    if (!hit) violations.push(token);
  }
  return { ok: violations.length === 0, violations: Array.from(new Set(violations)) };
}

/** Assemble the full allowed-number set for a set of fired leaks + observed data. */
export function allowedNumbersFor(fired: FiredLeak[], data: ScrapeData): number[] {
  const nums = new Set<number>();
  const add = (n: number | null | undefined) => {
    if (typeof n === "number" && Number.isFinite(n)) nums.add(Math.round(n * 100) / 100);
  };

  // Stats numbers.
  for (const f of fired) {
    for (const stat of resolveStats(f.leak.statIds)) {
      if (stat.reliability === "B") continue; // Tier B: no raw numbers allowed
      for (const tok of extractNumbers(stat.claim)) add(normalizeNumericToken(tok));
    }
    if (f.leak.mathTemplate) {
      const est = computeMathEstimate(f.leak.mathTemplate, data);
      est?.allowedNumbers.forEach(add);
      add(est?.dollarLow);
      add(est?.dollarHigh);
    }
  }

  // Observed business data.
  add(data.googleReviews?.count);
  add(data.googleReviews?.rating);
  // `googleReviews.recentCount90d` IS DELIBERATELY NOT HERE ANY MORE.
  // It used to be, and it was a fabrication channel with no detector behind it
  // (docs/detector-checkability.md §5.3). The field is a FLOOR, not a count: the
  // 90-day window runs over DataForSEO reviews only, capped at 20, and Places
  // reviews carry relative dates ("2 weeks ago") so they are excluded entirely.
  // No detector reads it. Allowing it meant statGuard would happily pass "only 3
  // reviews in the last 90 days" for a business with thirty — a checkable,
  // falsifiable, wrong number, printed under a measured label. Removing it costs
  // nothing (nothing was licensed to print it) and closes the channel.
  add(data.pageSpeed?.mobileScore);
  add(data.pageSpeed?.lcpSeconds);
  for (const c of data.competitors ?? []) {
    add(c.reviewCount);
    add(c.rating);
  }
  return Array.from(nums);
}

/* ============================================================================
 * THE FABRICATION LINT — a CLAIM gate, not a number gate
 * ==========================================================================*/
//
// WHY A NUMBER GATE CANNOT DO THIS JOB. `statGuard` above extracts numeric tokens
// and checks them against an allowed set. The sentence that shipped was:
//
//     "There's no primary action above the fold, and your phone number is buried."
//
// There is not a digit in it. Neither is there one in "nobody asks them for a
// review", "the competitor down the street adds ten a month" (a word, not a
// numeral) or "three scrolls down". Every one of those is a CHECKABLE-SOUNDING
// CLAIM about the business, and a number gate is structurally blind to all of
// them. Whatever catches them has to be a claim gate.
//
// THE STRATEGY, AND WHY THIS ONE.
// A claim is policed by WHAT IT IS ABOUT, not by the words it uses. Each pattern
// below detects an assertion about the client's public surface and tags it with a
// CLAIM TOPIC — the subject of the assertion. The topic is then cross-checked
// against the finding's evidence binding: some bound value must speak to that
// subject, or the sentence is a fact nobody measured. Three tiers of verdict fall
// out of the contract in docs/detector-checkability.md, and they are different
// failures with different fixes:
//
//   1. UNMEASURABLE — the topic is one NO field can license (position, prominence,
//      CTA quality). Fatal at any grade, on any document, WITH OR WITHOUT a
//      binding. This is the tier that catches the sentence that shipped, and it
//      needs no new plumbing anywhere to do it.
//   2. UNBOUND — the topic is licensable in principle, but nothing in THIS
//      finding's binding speaks to it. "Your form asks for nothing but a name" on
//      a finding that only bound the chat fingerprint.
//   3. UNSCOPED — a bound value backs the topic, but it is an `H` heuristic and
//      the sentence states it flatly. `formHasQualifyingFields` never reads the
//      form and `mentionsTextingOption` is a regex over prose, so the claim is
//      only true of WHAT WE LOOKED AT and has to say so ("we found no…", "no
//      visible…", "on the pages we scanned").
//
// WHAT WAS CONSIDERED AND REJECTED:
//   · "every number must be in the bound set" — necessary, and it is here (see
//     `numberClaims`), but it catches literally none of the real fabrication.
//   · a flat ban list over the whole document — this file's own history is the
//     argument against it: a blunter word list flags his best sentences. "No
//     online booking link on the site or Google Business Profile" is an absence
//     claim about their site AND it is the honest, shipped, correct wording. A ban
//     cannot tell those apart; a licence check can.
//   · an LLM judge — not deterministic, not offline, cannot run in verify:all.
//   · "quote a bound value verbatim" — too strict. The model is explicitly allowed
//     to restate a value and explain its consequence, and forcing verbatim quotes
//     would produce robotic copy and fail honest paraphrase.
//
// TWO ASYMMETRIES, BOTH DELIBERATE.
// (a) PRESENCE/ABSENCE topics are policed only on DEFICIENCY claims. Being told
//     something good about your site is not the failure this exists to stop, and
//     the opening positive about their reviews is a fixed requirement of the
//     document. Position and prominence are policed in BOTH directions, because
//     we measure position in neither.
// (b) A sentence that explicitly GENERALISES ("most owner-run trades…", "where
//     that pattern holds…") makes no claim about them and is exempt — unless it
//     also points at them, which is the "most sites bury the number, and yours
//     does too" dodge. Generalising phrases are stripped before that test so
//     "businesses like yours" does not count as pointing.

/** One assertion found in model prose, with the subject it is about. */
export interface SiteFactClaim {
  topic: ClaimTopic;
  /** The whole sentence, so a failure message can quote the line to edit. */
  sentence: string;
  /** The fragment that made it a claim about this topic. */
  matched: string;
}

/** Page elements an ambiguous prominence word has to be paired with before it
 *  counts as a claim about their page.
 *
 *  IT EXISTS BECAUSE OF A REAL FALSE POSITIVE. "What happens to a quote that goes
 *  quiet is not visible from outside" is the HONEST hedge the invisible leaks are
 *  required to carry, and an unscoped /not visible/ pattern flags it. "Not
 *  visible" said of a BEHAVIOUR is the correct disclosure; said of a BUTTON it is
 *  a measurement we never took. The element list is what separates them. */
const PAGE_ELEMENT =
  /\b(phone number|phone|number|cta|call[- ]to[- ]action|calls to action|button|link|form|booking|address|hours|menu|nav|navigation|headline|hero|logo|offer|price|pricing|contact details?|contact info(?:rmation)?|testimonials?|reviews?)\b/i;

/** Sentence-level assertion patterns, per claim topic.
 *
 *  `needsElement` patterns only count when PAGE_ELEMENT also appears in the
 *  sentence; the rest are unambiguous on their own. Every pattern here is either
 *  a position/prominence claim (any polarity) or a deficiency claim. */
const CLAIM_PATTERNS: { topic: ClaimTopic; re: RegExp; needsElement?: boolean }[] = [
  // ── cta_position — page geometry. We have no viewport, no render, no fold. ──
  { topic: "cta_position", re: /\babove the fold\b/i },
  { topic: "cta_position", re: /\bbelow the fold\b/i },
  { topic: "cta_position", re: /\bfirst screen\b/i },
  { topic: "cta_position", re: /\bfirst thing (?:visitors|people|they|anyone|you) sees?\b/i },
  { topic: "cta_position", re: /\bbefore (?:they|you|anyone|visitors) (?:have to |has to |even |ever )?scroll/i },
  { topic: "cta_position", re: /\b(?:one|two|three|four|five|\d+)\s+scrolls?\b/i },
  { topic: "cta_position", re: /\b(?:has|have|had|having|needs?|need) to scroll\b/i },
  { topic: "cta_position", re: /\bafter scrolling\b/i },
  { topic: "cta_position", re: /\bscrolls? down\b/i },
  { topic: "cta_position", re: /\bhalfway down\b/i },
  { topic: "cta_position", re: /\bfurther down the (?:page|site|homepage)\b/i },
  { topic: "cta_position", re: /\bat the (?:very )?(?:top|bottom) of the (?:page|homepage|home page|site|screen)\b/i },
  { topic: "cta_position", re: /\btop of the (?:page|homepage|home page|screen)\b/i, needsElement: true },
  { topic: "cta_position", re: /\bin the footer\b/i, needsElement: true },
  { topic: "cta_position", re: /\bin the header\b/i, needsElement: true },

  // ── prominence — how easy something is to see. Never measured, either way. ──
  { topic: "prominence", re: /\bburied\b/i, needsElement: true },
  { topic: "prominence", re: /\bhidden\b/i, needsElement: true },
  { topic: "prominence", re: /\bhiding\b/i, needsElement: true },
  { topic: "prominence", re: /\bhard to (?:find|spot|see|locate|notice)\b/i, needsElement: true },
  { topic: "prominence", re: /\beas(?:y|ily) to miss\b/i, needsElement: true },
  { topic: "prominence", re: /\beasily missed\b/i, needsElement: true },
  { topic: "prominence", re: /\btucked away\b/i, needsElement: true },
  { topic: "prominence", re: /\bnot (?:very |especially )?prominent(?:ly)?\b/i, needsElement: true },
  { topic: "prominence", re: /\b(?:more|most|very) prominent(?:ly)?\b/i, needsElement: true },
  { topic: "prominence", re: /\bfront and cent(?:er|re)\b/i, needsElement: true },
  { topic: "prominence", re: /\bbarely visible\b/i, needsElement: true },
  { topic: "prominence", re: /\bsmall (?:text|print|link|button|type)\b/i },

  // ── cta_quality — an editorial verdict on their copy. ──────────────────────
  {
    topic: "cta_quality",
    re: /\bno (?:clear |single |strong |obvious |real |proper )?(?:primary |main )?call[- ]to[- ]action\b/i,
  },
  { topic: "cta_quality", re: /\bno (?:clear |obvious |single )?primary action\b/i },
  { topic: "cta_quality", re: /\bweak (?:cta|call[- ]to[- ]action|hero|headline|messaging)\b/i },
  { topic: "cta_quality", re: /\bno clear (?:direction|next step|path|instruction)\b/i },
  {
    topic: "cta_quality",
    re: /\b(?:doesn't|does not|never|fails to|don't) tell (?:visitors|people|anyone|them|you|the visitor) what to do\b/i,
  },
  {
    topic: "cta_quality",
    re: /\b(?:no|nothing|never|not|without|unclear|isn't|is not)\b[^.!?]{0,40}\bwhat to do next\b/i,
  },
  { topic: "cta_quality", re: /\bgeneric ["'‘’“”]?contact us\b/i },
  { topic: "cta_quality", re: /\bunclear (?:cta|call[- ]to[- ]action|next step)\b/i },
  { topic: "cta_quality", re: /\bcompeting (?:ctas|calls to action)\b/i },

  // ── licensable: presence/absence of a NAMED artifact, deficiency side only ──
  { topic: "booking_path", re: /\bno (?:online |public )?(?:booking|scheduling) (?:link|path|page|option|tool|system)\b/i },
  { topic: "booking_path", re: /\bno (?:online )?scheduler\b/i },
  { topic: "booking_path", re: /\bno way to book\b/i },
  { topic: "booking_path", re: /\bcan(?:'t|not) book\b/i },
  { topic: "booking_path", re: /\bnothing to book (?:with|through|on)\b/i },
  { topic: "booking_path", re: /\bneither\b[^.!?]{0,80}\bbooking\b/i },
  { topic: "booking_path", re: /\bno online booking\b/i },

  { topic: "chat_widget", re: /\bno (?:live[- ])?chat\b/i },
  { topic: "chat_widget", re: /\bno (?:chat|messaging) (?:widget|window|window\b)\b/i },
  { topic: "chat_widget", re: /\bno chat or messaging\b/i },
  { topic: "chat_widget", re: /\b(?:chat|messaging) widget\b[^.!?]{0,30}\b(?:was|is|were)\s+(?:not\s+)?(?:detected|found)\b/i },

  { topic: "click_to_call", re: /\bnot click[- ]to[- ]call\b/i },
  { topic: "click_to_call", re: /\bno (?:tap|click)[- ]to[- ]call\b/i },
  { topic: "click_to_call", re: /\bno tel: ?link\b/i },
  // NEGATED ONLY. "the phone number is tappable" is a PRESENCE claim and a
  // compliment; the asymmetry is stated in the section header and this is where it
  // bites — an unnegated pattern here flagged the site advisory's opening positive.
  { topic: "click_to_call", re: /\b(?:isn't|is not|was not|wasn't|not) tappable\b/i },

  { topic: "contact_form", re: /\bno (?:contact|enquiry|inquiry|lead|web) form\b/i },
  { topic: "contact_form", re: /\bno form (?:on|anywhere)\b/i },

  // A SHORT GAP IS TOLERATED between the noun and the verb, because "the form we
  // found asks for a name" is the same claim as "the form asks for a name" and an
  // adjacent-words-only pattern lets the paraphrase through. Twenty characters is
  // enough for a qualifier and short enough not to reach across a clause.
  {
    topic: "form_fields",
    re: /\b(?:the|your|a|that) (?:contact |enquiry |inquiry |web )?form\b[^.!?]{0,20}\b(?:collects|asks|captures|gathers|takes|requests|wants)\b/i,
  },
  { topic: "form_fields", re: /\bno qualifying (?:fields|questions|information)\b/i },
  { topic: "form_fields", re: /\bnothing on it (?:establishes|says|asks|tells|captures|records)\b/i },
  { topic: "form_fields", re: /\bform (?:doesn't|does not|never|fails to) (?:ask|collect|capture|record)\b/i },
  { topic: "form_fields", re: /\bfour[- ]field form\b|\b(?:three|four|five|\d+)[- ]field form\b/i },

  { topic: "texting_path", re: /\bno text[- ]?back\b/i },
  { topic: "texting_path", re: /\bno ["'‘’“”]?text us\b/i },
  { topic: "texting_path", re: /\bno (?:texting|sms|text) (?:option|path|route|alternative)\b/i },

  { topic: "phone_line", re: /\bno phone number\b/i },
  { topic: "phone_line", re: /\bnumber (?:isn't|is not) (?:shown|listed|published|anywhere)\b/i },

  { topic: "gbp_hours", re: /\b(?:evenings?|weekends?)[^.!?]{0,24}\bclosed\b/i },
  { topic: "gbp_hours", re: /\bclosed (?:on )?(?:evenings?|weekends?|the weekend)\b/i },
  { topic: "gbp_hours", re: /\bno (?:opening )?hours (?:listed|shown|published|on)\b/i },
  { topic: "gbp_hours", re: /\bhours[^.!?]{0,20}\b(?:show|shows|listed as)\b[^.!?]{0,20}\bclosed\b/i },

  { topic: "review_volume", re: /\b\d[\d,]*\s+(?:google )?reviews?\b/i },
  { topic: "review_volume", re: /\bfewer reviews\b/i },
  // NOT a bare /review count/: "the proof section states the rating and the review
  // count in a sentence" is a description of a deliverable, not a claim about the
  // business. The claims all carry the figure, and the figure is what the patterns
  // above match.
  { topic: "review_volume", re: /\b\d[\d,]*(?:\.\d)?\s*(?:★|stars?)\b/i },

  { topic: "competitor_reviews", re: /\bcompetitor (?:median|average|count)\b/i },
  { topic: "competitor_reviews", re: /\bnearby (?:shows?|has|carries)\b/i },
  { topic: "competitor_reviews", re: /\bversus\b[^.!?]{0,40}\breviews?\b/i },
  { topic: "competitor_reviews", re: /\bvs\.?\b[^.!?]{0,40}\breviews?\b/i },

  { topic: "review_content", re: /\b(?:\d+|two|three|four|five|several) (?:of your )?(?:recent )?reviews? (?:mention|describe|say|talk about|complain)/i },

  { topic: "page_speed", re: /\bpagespeed\b/i },
  { topic: "page_speed", re: /\bLCP\b/ },
  { topic: "page_speed", re: /\b\d+(?:\.\d+)?\s*seconds? to load\b/i },
  { topic: "page_speed", re: /\bloads? in \d/i },
  { topic: "page_speed", re: /\bmobile (?:page )?(?:speed|score)\b/i },

  { topic: "social_channels", re: /\bnot on (?:facebook|instagram)\b/i },
  { topic: "social_channels", re: /\bno (?:facebook|instagram) (?:page|profile|link|account)\b/i },

  // ── inside the operation: the "Forbidden:" lines from §2, one pattern each ──
  // §2.3. Scoped to the after-hours subject so "nothing catches a form fill" (a
  // visible-absence claim) is not swept up with "nothing reaches a caller".
  {
    topic: "after_hours_behaviour",
    re: /\bnothing (?:reaches|answers|catches|responds to|gets back to)\b[^.!?]{0,40}\b(?:after[- ]hours|overnight|at night|caller|enquir|inquir)/i,
  },
  { topic: "after_hours_behaviour", re: /\bcalls? (?:go|goes|going|are going) unanswered\b/i },
  { topic: "after_hours_behaviour", re: /\b(?:gets?|get) nothing back\b/i },
  { topic: "after_hours_behaviour", re: /\bwaits? until (?:the )?morning\b/i },
  // §2.4 — "become a customer" and "reach you" are false the moment a working
  // contact form exists, and this leak fires happily on sites that have one.
  // "no way to BOOK you" is deliberately NOT here: a contact form is not a
  // booking, so that one is true and is licensed by the booking fingerprint.
  {
    topic: "booking_exclusivity",
    re: /\b(?:the )?only way to (?:become a customer|reach you|contact you|get in touch|hire you|get a quote|get help)\b/i,
  },
  {
    topic: "booking_exclusivity",
    re: /\bevery (?:enquiry|inquiry|lead|customer|client) (?:has to|must|needs to) (?:call|phone|ring)\b/i,
  },
  // §2.13
  { topic: "review_solicitation", re: /\bnobody (?:ever )?asks\b[^.!?]{0,30}\breview/i },
  { topic: "review_solicitation", re: /\byou (?:don't|do not|never|aren't|are not) ask(?:ing)?\b[^.!?]{0,30}\breview/i },
  { topic: "review_solicitation", re: /\badds? \d+ (?:reviews? )?(?:a|per|each) (?:month|week)\b/i },
  { topic: "review_solicitation", re: /\badds? (?:ten|twenty|thirty|a dozen)\b[^.!?]{0,20}\b(?:a|per|each) month\b/i },
  // §2.1
  {
    topic: "response_time_figure",
    re: /\b(?:you|your team|your office|your staff)\b[^.!?]{0,24}\b(?:take|takes|taking|reply|replies|respond|responds)\b[^.!?]{0,20}\b\d+(?:[–—-]\d+)?\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/i,
  },
  { topic: "response_time_figure", re: /\byour (?:average )?response time is\b/i },
  // §2.2
  { topic: "missed_call_rate", re: /\byou (?:miss|are missing|missed)\b[^.!?]{0,24}\b\d[\d,]*\s*%/i },
  { topic: "missed_call_rate", re: /\b\d[\d,]*\s*% of your calls\b/i },
  // §2.9
  { topic: "no_show_rate", re: /\b\d[\d,]*\s*% of your (?:appointments|bookings|patients|clients|consults)\b/i },
  { topic: "no_show_rate", re: /\byour no[- ]show rate\b/i },
  // §2.11
  {
    topic: "database_size",
    re: /\b\d[\d,]*\s+(?:past |former |old )?(?:customers?|clients?|patients?|contacts?)\b[^.!?]{0,24}\b(?:list|database|crm)\b/i,
  },
  { topic: "database_size", re: /\byour (?:list|database) (?:of|has|holds|contains)\b[^.!?]{0,16}\b\d/i },
  { topic: "database_size", re: /\b(?:dormant|untouched|cold) for \d+ (?:months?|years?)\b/i },
];

/** Sentences that explicitly generalise make no claim about THIS business. */
const GENERALISING: RegExp[] = [
  /\bmost\b/i,
  /\btypical(?:ly)?\b/i,
  /\bon average\b/i,
  /\bindustry\b/i,
  /\bbenchmark\b/i,
  /\bbusinesses like (?:yours|this)\b/i,
  /\bin (?:this|the) (?:trade|industry|sector|market)\b/i,
  /\bmany (?:local )?(?:businesses|owners|firms|companies|practices)\b/i,
  /\bwhere (?:that|this) pattern holds\b/i,
  /\bvery few\b/i,
  /\bcommonly\b/i,
  /\bacross the (?:trade|industry)\b/i,
];

/** …unless the same sentence ALSO points at them. Generalising phrases are
 *  stripped first so "businesses like yours" is not read as pointing. */
function pointsAtThem(sentence: string): boolean {
  let s = sentence;
  for (const re of GENERALISING) s = s.replace(new RegExp(re.source, "gi"), " ");
  return /\byou\b|\byour\b|\byours\b|\byou're\b/i.test(s);
}

/** The vocabulary that BOUNDS an absence claim to what we actually looked at.
 *  An `H`-provenance value licenses a topic only in this voice — the claim is
 *  true of the pages we scanned, and it does not establish a mechanism. */
export const SCAN_SCOPE_MARKERS: RegExp[] = [
  /\bvisibl[ey]\b/i,
  /\bdetected\b/i,
  /\bwe (?:found|saw|could n?o?t? ?find|couldn't find|did not find|didn't find)\b/i,
  /\bthe scan (?:found|saw|shows?)\b/i,
  /\bon (?:the|your) (?:site|website|pages?|homepage|home page|profile|listing)\b/i,
  /\banywhere on\b/i,
  /\bscanned pages?\b/i,
  /\bfrom (?:the )?outside\b/i,
  /\bout here\b/i,
  /\bnot something a scan can see\b/i,
  /\bpublicly\b/i,
  /\bcould n?o?t? ?be confirmed\b/i,
  /\bcouldn't be confirmed\b/i,
];

function carriesScanScope(sentence: string): boolean {
  return SCAN_SCOPE_MARKERS.some((re) => re.test(sentence));
}

/** Split prose into sentences the same way `flatAssertionLint` and the pack
 *  validator do, so "the same sentence" means one thing across every guard. */
function claimSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Every site-fact assertion in a passage. PURE — no binding involved, so it is
 *  usable on its own (a prompt-time preview, a test, an operator warning). */
export function siteFactClaims(text: string): SiteFactClaim[] {
  const out: SiteFactClaim[] = [];
  for (const sentence of claimSentences(text)) {
    // A question asserts nothing. The pivot section exists precisely so the
    // invisible leaks are ASKED, and `flatAssertionLint` skips interrogatives for
    // the same reason.
    if (sentence.endsWith("?")) continue;
    if (GENERALISING.some((re) => re.test(sentence)) && !pointsAtThem(sentence)) continue;
    const hasElement = PAGE_ELEMENT.test(sentence);
    // ONE HIT PER (topic, sentence). Several patterns describe the same claim from
    // different angles — "no clear direction" and "no clear direction on what to do
    // next" are one assertion — and a failure message that quotes the same sentence
    // three times reads as three problems to fix.
    const seen = new Set<ClaimTopic>();
    for (const { topic, re, needsElement } of CLAIM_PATTERNS) {
      if (seen.has(topic)) continue;
      if (needsElement && !hasElement) continue;
      const m = re.exec(sentence);
      if (m) {
        seen.add(topic);
        out.push({ topic, sentence, matched: m[0] });
      }
    }
  }
  return out;
}

export type FabricationKind =
  | "unmeasurable"
  | "internal"
  | "unbound"
  | "unscoped"
  | "number"
  | "disputed";

export interface FabricationHit {
  kind: FabricationKind;
  topic: ClaimTopic | null;
  sentence: string;
  matched: string;
  /** Plain-English reason, ready to print in a failure message. */
  why: string;
}

export interface FabricationLintResult {
  ok: boolean;
  /** Fatal regardless of whether a binding exists — no field can back these. */
  unmeasurable: FabricationHit[];
  /** A claim about the inside of the operation that does not credit the client. */
  internal: FabricationHit[];
  /** The binding does not speak to the subject (or does not exist). */
  unbound: FabricationHit[];
  /** Backed only by an `H` heuristic and stated without scoping it to the scan. */
  unscoped: FabricationHit[];
  /** A figure about this business that no bound value establishes. */
  numbers: FabricationHit[];
  /** The two contracts disagree about whether the backing field may be cited —
   *  reported, never blocking. See partitionByCitability. */
  disputed: FabricationHit[];
  /** Everything that must be acted on. `disputed` is deliberately NOT in here:
   *  it is a note to the operator, not a defect in the document. */
  hits: FabricationHit[];
}

/** Topics whose claims carry a figure about the business, so the figure itself
 *  has to trace to a bound number. */
const NUMERIC_TOPICS: ReadonlySet<ClaimTopic> = new Set<ClaimTopic>([
  "review_volume",
  "competitor_reviews",
  "page_speed",
  "review_content",
]);

/** Bare integers below this are list positions, years and step numbers, not
 *  claims — the same threshold `statGuard` uses, for the same reason. */
const NUMBER_CLAIM_FLOOR = 3;

/**
 * THE LINT. Judge one finding's prose against the values it is bound to.
 *
 * @param text     the model-authored prose (title / problem / cost, or one leak's
 *                 evidence / explanation / impact — never our own stamped strings).
 * @param binding  the finding's evidence binding, or null when nothing was
 *                 stamped. NULL DOES NOT DISABLE THE LINT: the `unmeasurable`
 *                 tier is unaffected, because no binding could have licensed
 *                 those claims anyway. It only means the caller has to decide how
 *                 loudly to report `unbound` — see the two validators.
 */
export function fabricationLint(
  text: string,
  binding: EvidenceBinding | null,
  opts: { allowedStatNumbers?: number[] } = {}
): FabricationLintResult {
  const unmeasurable: FabricationHit[] = [];
  const internal: FabricationHit[] = [];
  const unbound: FabricationHit[] = [];
  const unscoped: FabricationHit[] = [];
  const numbers: FabricationHit[] = [];
  const disputed: FabricationHit[] = [];

  // Which topics does the binding license, and at what provenance?
  const licensed = new Map<ClaimTopic, BoundValue[]>();
  for (const v of binding?.values ?? [])
    for (const t of v.topics) licensed.set(t, [...(licensed.get(t) ?? []), v]);
  const disputedTopics = new Set(binding?.disputedTopics ?? []);

  const boundNumbers = new Set<number>([
    ...(binding?.numbers ?? []),
    ...(opts.allowedStatNumbers ?? []),
  ]);

  for (const claim of siteFactClaims(text)) {
    if (NEVER_LICENSABLE_TOPICS.includes(claim.topic)) {
      unmeasurable.push({
        kind: "unmeasurable",
        topic: claim.topic,
        sentence: claim.sentence,
        matched: claim.matched,
        why:
          claim.topic === "cta_quality"
            ? 'whether a call to action is "clear" or "primary" is an editorial judgment nothing in the pipeline makes — the only check that exists asks whether one of thirteen fixed phrases appears in the first 1500 characters of the page\'s markdown'
            : "we render no page and measure no position, so nothing in the scrape can establish where an element sits or how easy it is to see",
      });
      continue;
    }
    if (CLIENT_ATTRIBUTED_ONLY_TOPICS.includes(claim.topic)) {
      if (attributesToClient(claim.sentence)) continue;
      internal.push({
        kind: "internal",
        topic: claim.topic,
        sentence: claim.sentence,
        matched: claim.matched,
        why:
          "this describes what happens INSIDE the operation, and no scan reaches it — the only thing that can license it is the client's own answer, said out loud in the sentence (\"You told us…\", \"Confirmed at intake…\")",
      });
      continue;
    }
    const backing = licensed.get(claim.topic);
    if (!backing?.length && disputedTopics.has(claim.topic)) {
      disputed.push({
        kind: "disputed",
        topic: claim.topic,
        sentence: claim.sentence,
        matched: claim.matched,
        why: `the only field that could back this is in UNCITABLE_SCRAPE_FIELDS (leak-taxonomy.ts) while docs/detector-checkability.md §2 lists it as a permitted value. Until that is resolved the sentence is reported, not blocked — keep it scoped to the scan ("no visible…", "we found no…")`,
      });
      continue;
    }
    if (!backing?.length) {
      unbound.push({
        kind: "unbound",
        topic: claim.topic,
        sentence: claim.sentence,
        matched: claim.matched,
        why: binding
          ? `nothing this finding is bound to speaks to ${claim.topic} (bound: ${
              binding.values.map((v) => v.field).join(", ") || "no values at all"
            })`
          : `this finding carries no evidence binding at all, so no measured value stands behind a claim about ${claim.topic}`,
      });
      continue;
    }
    // Backed — but an H heuristic only backs the claim in the scan's voice.
    if (backing.every((v) => v.provenance === "H") && !carriesScanScope(claim.sentence)) {
      unscoped.push({
        kind: "unscoped",
        topic: claim.topic,
        sentence: claim.sentence,
        matched: claim.matched,
        why: `the only value behind this is ${backing[0].field} = ${JSON.stringify(
          backing[0].value
        )}, which is ${backing[0].source} — true of what we looked at, not of the thing the sentence describes. Bound it to the scan ("we found no…", "no visible…", "on the pages we scanned")`,
      });
      continue;
    }
    // Numeric topics: the figure itself has to trace to a bound number.
    //
    // A CITED figure is exempt, and that is not a loophole. "82% of consumers
    // expect an immediate response (Drift)" is somebody else's measurement of an
    // industry, openly attributed — it is not a claim about this business at all,
    // and it is already governed by the percentage and dollar rules in the
    // validator. Without this the two guards would contradict each other: one
    // demanding the source tag, the other failing the number beside it.
    if (NUMERIC_TOPICS.has(claim.topic) && !carriesStatCitation(claim.sentence)) {
      for (const tok of extractNumbers(claim.sentence)) {
        const n = normalizeNumericToken(tok);
        if (n === null) continue;
        if (n < NUMBER_CLAIM_FLOOR && !/[%x×$]/.test(tok)) continue;
        const hit = Array.from(boundNumbers).some(
          (a) => a === n || (a !== 0 && Math.abs(a - n) / a < 0.01)
        );
        if (!hit)
          numbers.push({
            kind: "number",
            topic: claim.topic,
            sentence: claim.sentence,
            matched: tok,
            why: `${tok} is not among the values measured for this business (${
              Array.from(boundNumbers).slice(0, 8).join(", ") || "none"
            })`,
          });
      }
    }
  }

  const hits = [...unmeasurable, ...internal, ...unbound, ...unscoped, ...numbers];
  return {
    ok: hits.length === 0,
    unmeasurable,
    internal,
    unbound,
    unscoped,
    numbers,
    disputed,
    hits,
  };
}

/* ============================================================================
 * PERCENTAGES GET DOLLAR DISCIPLINE (owner item 5)
 * ==========================================================================*/
//
// "85% of callers who reach voicemail never call back" shipped asserted flat and
// unsourced INSIDE a finding whose own grade label read "Industry pattern — not
// measured for you". The grade hedged and the cost line asserted, in the same
// block, which reads to an owner as us hedging the part we cannot prove and
// asserting the part we want him to believe.
//
// A dollar figure has had to name its backing in the SAME SENTENCE since E3. A
// percentage is the same kind of claim and gets the same rule: CITED, HEDGED, or
// ABSENT. The machinery is the one that already exists — the ASSUMPTIONS caveat
// and the inline source tags `allowedStatPhrase` stamps — rather than a parallel
// caveat system that would drift from it.

/** "85%", "28–43%", "12.5 %" — the shapes both the frames and a model produce. */
export const PERCENT_FIGURE = /\d[\d,]*(?:\.\d+)?\s?%/;

/** Every source tag a cited stat can carry, derived from STATS through the SAME
 *  `shortSource` the citation itself is built with — so "is this cited" and "this
 *  is the citation" can never disagree about the wording. */
export const STAT_SOURCE_TAGS: string[] = Array.from(
  new Set(
    Object.values(STATS)
      .map((s) => shortSource(s.source))
      .filter((s) => s.length > 1)
  )
);

/** Does this passage carry an inline source attribution for a statistic?
 *  Either one of our own stat sources by name, or any parenthesised
 *  organisation-looking tag (a source we have not catalogued is still a source,
 *  and this guard's job is to catch the UNSOURCED figure). */
export function carriesStatCitation(text: string): boolean {
  if (STAT_SOURCE_TAGS.some((tag) => text.includes(tag))) return true;
  return /\((?:[A-Z][A-Za-z.&'’-]*)(?:[\s/][A-Za-z.&'’-]+){0,4}\)/.test(text);
}

// ── Voice / banned-word lint ────────────────────────────────────────────────
// NOTE: the refactor spec references `words_to_avoid.md`, which is not present
// in the repo. This list is codified here from the existing STYLE_RULES /
// COLD_AUDIT_RULES bans so the guard is enforceable now; swap in the canonical
// file's contents if/when it lands.

export const BANNED_WORDS: string[] = [
  "unlock",
  "supercharge",
  "revolutionary",
  "game-changing",
  "game changer",
  "10x",
  "leverage",
  "synergy",
  "seamless",
  "cutting-edge",
  "cutting edge",
  "world-class",
  "best-in-class",
  "turnkey",
  "elevate",
  "unleash",
  "empower",
  "streamline",
  "streamlined",
  "streamlining",
  "robust",
  "actionable",
  "mobile-optimized",
  "mobile optimized",
  "optimize the",
  "optimize your",
  "boost your visibility",
  "quick wins",
  "quick win",
  "i hope this email finds you well",
  "in today's fast-paced",
  "take it to the next level",
  "move the needle",
  "low-hanging fruit",
];

export interface VoiceLintResult {
  ok: boolean;
  hits: string[];
}

export function voiceLint(text: string): VoiceLintResult {
  const lower = text.toLowerCase();
  const hits = BANNED_WORDS.filter((w) => lower.includes(w));
  return { ok: hits.length === 0, hits };
}

// ── Flat-assertion lint (Evidence-class honesty for INVISIBLE leaks) ──────────
// A cold scan cannot see inside the operation, so the audit must never state an
// INVISIBLE-leak mechanism as a flat operational FACT ("they receive no
// follow-up", "your team doesn't return calls", "there is no reminder system").
// Those claims are only defensible as pattern + visible-absence + conditional.
// This lint flags any sentence that asserts an internal behavior WITHOUT a
// hedge/evidence qualifier somewhere in the same sentence — the deterministic
// backstop behind the prompt rule, run at the generation boundary (to trigger a
// corrective regen) and at render (last-resort guard).

// Operational claims about internal, non-observable behavior. Each is scoped so
// it can't catch an OBSERVED gap (a missing booking link, a weak CTA): the
// objects are follow-up / reminders / pipeline / call-answering / recovery.
const FLAT_ASSERTION_PATTERNS: RegExp[] = [
  /\b(calls?|inquir(?:y|ies)|leads?)\s+(?:go|going|are|get|gets)\s+(?:unanswered|unreturned|ignored|missed|to voicemail)\b/i,
  /\b(?:you|they|your team|your staff|the (?:front )?desk|no one|nobody)\s+(?:miss|misses|are missing|don't answer|doesn't answer|do not answer|never answer)\b/i,
  /\b(?:receive|receives|get|gets)\s+no\s+(?:follow[-\s]?up|second (?:call|touch)|reply|response|callback|call[-\s]?back)\b/i,
  /\b(?:you|they|your team|your staff|no one|nobody)\s+(?:don't|doesn't|do not|never|fail to|fails to|aren't|isn't|are not|is not)\s+(?:follow(?:ing)?[-\s]?up|following up)\b/i,
  /\bthere\s+(?:is|'s)\s+no\s+(?:follow[-\s]?up|reminder|nurture|pipeline|crm|recovery|second (?:touch|call)|reactivation)\b/i,
  /\b(?:you|they)\s+(?:don't|doesn't|do not)\s+(?:send|use|have)\s+(?:a\s+)?(?:reminders?|appointment reminders?|follow[-\s]?ups?|a follow[-\s]?up (?:system|sequence)|a crm|a pipeline)\b/i,
  /\bno one\s+(?:follows up|calls back|responds|reminds)\b/i,
];

// A hedge / evidence qualifier ANYWHERE in the sentence licenses the claim —
// it signals inference, not asserted fact.
const ASSERTION_QUALIFIERS: RegExp[] = [
  /\b(?:likely|probably|typically|usually|often|most|many)\b/i,
  // Claim-level conditionals only ("if that's how it works today") — a bare
  // temporal "when the team is on a job" does NOT license a flat assertion.
  /\bif (?:that|this|it'?s|they|you'?re|there'?s)\b/i,
  /\b(?:may|might|could|would)\b/i,
  /\bchances are\b/i,
  /\balmost certainly\b/i,
  /\bno (?:visible|clear) (?:sign|signal|evidence)\b/i,
  /\bfrom (?:the )?outside\b/i,
  /\b(?:can't|cannot|couldn't) see\b/i,
  /\breviews?\s+(?:mention|suggest|say|point|describe|report)/i,
  /\b(?:appears?|seems?|looks like|reads? as)\b/i,
  // GENERIC-PATTERN HEDGING. A sentence that explicitly scopes itself to the whole
  // trade is not asserting anything about THIS business — "unanswered calls happen
  // in every local business" is a pattern claim, which is exactly what an inferred
  // leak is supposed to say. Without this the lint flagged the taxonomy's own
  // pattern prose as a flat assertion, so the honest fix was to teach the lint this
  // vocabulary rather than to hedge an already-hedged sentence twice over.
  /\bin every (?:local )?business\b/i,
  /\bacross the (?:industry|trade)\b/i,
  /\bindustry[- ]wide\b/i,
  /\ba meaningful share\b/i,
];

// DISCLOSURE / MEASUREMENT MARKERS (A1, belt b). A hedge qualifier says "we're
// inferring". These say the opposite and are just as licensing: the sentence
// carries its OWN provenance — the client told us, or we measured it. Hedging
// those is the exact failure this project exists to remove ("Likely, you told us
// nobody follows up" is an insult to a client who answered the question).
//
// Consulted by BOTH flatAssertionLint and softenFlatAssertions so the lint and
// the render-time backstop can never disagree about what is protected. Exported
// so the verification script can assert on the list directly.
//
// WHY THIS IS TWO LISTS AND NOT ONE. Both vocabularies license a flat assertion,
// so for SOFTENING they are interchangeable and the combined list is what gets
// consulted. But they are not interchangeable for ATTRIBUTION. The disclosed
// grade exists to enforce one rule — "never dress a disclosure up as something we
// detected" — and a single list defeats it exactly: a client-told leak writing
// "our scan observed you have no CRM" would satisfy an attribution check that
// accepted any provenance marker, while committing the precise offence the grade
// was created to prevent. So the attribution check reads DISCLOSURE_MARKERS only.

/** "The client told us." The ONE vocabulary for client-sourced material, used by
 *  every guard that needs to answer "did this come from them or from us?".
 *
 *  TWO GUARDS SHARE IT, and they used to keep separate lists that quietly
 *  disagreed — the same defect as the PROTECTED_MARKERS conflation below, one
 *  layer up:
 *    · the ATTRIBUTION law — a `disclosed` leak must say whose fact it is;
 *    · the DOLLAR-PROVENANCE guard in validate-pack.ts — a figure is either the
 *      client's own number or an assumption that must be labelled as one.
 *  Those are the same question, so a phrase that attributes a sentence must also
 *  attribute a figure. The list below is the UNION of what the two carried: each
 *  had entries the other lacked ("your number", "based on your", the wider
 *  said/provided/gave-us verb set), and neither was wrong — they were just
 *  separately maintained, which is the thing that had to stop. */
export const DISCLOSURE_MARKERS: RegExp[] = [
  /\byou told us\b/i,
  /\bconfirmed at intake\b/i,
  /\byou (?:said|confirmed|mentioned|provided|gave us)\b/i,
  /\bbased on (?:the )?numbers you provided\b/i,
  /\bbased on your\b/i,
  /\byour number\b/i,
];

/** "We measured it." Licenses a flat assertion, but is NOT attribution of a
 *  disclosure — saying this about something the client told us is the lie. */
export const MEASUREMENT_MARKERS: RegExp[] = [
  /\b(?:we|our tooling|our scan) (?:measured|observed|recorded)\b/i,
];

/** Either provenance — the union the softener and the lint consult, because both
 *  kinds of sentence state where they came from and neither may be hedged. */
export const PROTECTED_MARKERS: RegExp[] = [...DISCLOSURE_MARKERS, ...MEASUREMENT_MARKERS];

/** Provenance context a caller can supply.
 *
 *  GRADE IS THE ANSWER; the other two are how a caller who hasn't been migrated
 *  yet spells it. Pass `grade` where you have it (every FiredLeak and LeakInput
 *  carries one). The `{ tier, intakeConfirmed }` pair is the pre-Phase-1 call
 *  shape and still works: when no grade is given, the same gradeOf() the rest of
 *  the system uses derives it, so both shapes land on identical behaviour and
 *  there is still exactly one definition of "measured / told / guessed". */
export interface AssertionContext {
  grade?: EvidenceGrade;
  tier?: EvidenceTier;
  intakeConfirmed?: boolean;
}

/** The grade this context implies, or undefined when the caller supplied no
 *  provenance at all (the common case at render time — belt (b) then decides,
 *  sentence by sentence). An explicit grade always wins over the legacy pair. */
function contextGrade(opts?: AssertionContext): EvidenceGrade | undefined {
  if (!opts) return undefined;
  if (opts.grade) return opts.grade;
  if (opts.tier === undefined && opts.intakeConfirmed === undefined) return undefined;
  return gradeOf({ tier: opts.tier, intakeConfirmed: opts.intakeConfirmed });
}

/** True when the caller's context puts the whole text beyond hedging: we measured
 *  it, or they told us. Only "inferred" — the guess — may be softened. */
function isProtectedContext(opts?: AssertionContext): boolean {
  const grade = contextGrade(opts);
  return grade === "observed" || grade === "disclosed";
}

/** True when the sentence carries its own provenance and must not be hedged. */
function carriesProvenance(sentence: string): boolean {
  return PROTECTED_MARKERS.some((re) => re.test(sentence));
}

/** Exported for the validator: does this text state ANY provenance? Used where
 *  the only question is "may this be stated flatly" — measured or told both do. */
export function carriesProvenanceMarker(text: string): boolean {
  return carriesProvenance(text);
}

/** Exported for the validator's attribution law: does this text attribute itself
 *  TO THE CLIENT?
 *
 *  DISCLOSURE_MARKERS only, deliberately. A `disclosed` leak is one the client
 *  told us, and the one thing it may never do is claim we found it ourselves —
 *  so "our scan observed…" must FAIL this check even though it passes
 *  carriesProvenanceMarker. That difference is the whole point of the split. */
export function attributesToClient(text: string): boolean {
  return DISCLOSURE_MARKERS.some((re) => re.test(text));
}

export interface FlatAssertionResult {
  ok: boolean;
  hits: string[]; // the offending sentence fragments
}

/** Flag flat operational assertions about invisible internal behavior that lack
 *  a hedge/evidence qualifier. Questions (the sanctioned vehicle for invisible
 *  leaks, Law 3) are skipped, and so is anything whose provenance is stated —
 *  either by the caller (grade "observed" / "disclosed", however it was spelled)
 *  or by the sentence itself ("you told us…"). An unhedged INFERRED claim still
 *  fails, unchanged. */
export function flatAssertionLint(
  text: string,
  opts?: AssertionContext
): FlatAssertionResult {
  if (isProtectedContext(opts)) return { ok: true, hits: [] };
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hits: string[] = [];
  for (const sentence of sentences) {
    if (sentence.endsWith("?")) continue; // questions are allowed to probe
    const asserts = FLAT_ASSERTION_PATTERNS.some((re) => re.test(sentence));
    if (!asserts) continue;
    const hedged =
      ASSERTION_QUALIFIERS.some((re) => re.test(sentence)) || carriesProvenance(sentence);
    if (!hedged) hits.push(sentence.slice(0, 120));
  }
  return { ok: hits.length === 0, hits };
}

// Render-time backstop: soften a flat assertion by injecting a leading hedge, so
// a stale/non-regenerable finding can't ship a bare operational claim. Only used
// when a corrective regen isn't available (e.g. HTML render of a saved audit).
// Conservative and grammar-safe: prefixes the sentence with "Likely, " which
// reads correctly in front of every FLAT_ASSERTION_PATTERN subject.
//
// GRADE-AWARE (Phase 1; was tier-aware). Two independent belts stop it hedging a
// fact:
//   (a) the caller's context — a grade of "observed" or "disclosed" (passed
//       directly, or derived from the legacy {tier, intakeConfirmed} pair)
//       returns the text UNTOUCHED, byte for byte (we don't even normalize
//       whitespace, so callers can rely on identity);
//   (b) the sentence's own provenance — PROTECTED_MARKERS ("you told us",
//       "confirmed at intake", "we measured") license it even with no context
//       passed, which is the common case at render time.
export function softenFlatAssertions(text: string, opts?: AssertionContext): string {
  // Belt (a): never hedge what we measured or what they told us. Early return
  // keeps the string byte-identical — no join/whitespace normalization applied.
  if (isProtectedContext(opts)) return text;

  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed || trimmed.endsWith("?")) return sentence;
      const asserts = FLAT_ASSERTION_PATTERNS.some((re) => re.test(trimmed));
      // Belt (b): a hedge qualifier OR the sentence's own stated provenance.
      const hedged =
        ASSERTION_QUALIFIERS.some((re) => re.test(trimmed)) || carriesProvenance(trimmed);
      if (asserts && !hedged) {
        return sentence.replace(
          trimmed,
          `Likely, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
        );
      }
      return sentence;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Invented-offer scrub (Defect 5) ──────────────────────────────────────────
// The generator must NEVER fabricate a discount/offer amount (e.g. "$50 Off Your
// First Plumbing Service"). Unless a real offer is provided as input, every
// dollar/percent "off" promotion is replaced with an editable placeholder so the
// operator fills in the real offer before sending.

export const OFFER_PLACEHOLDER = "[YOUR OFFER — e.g. $X off first service]";

// "$50 off", "$1,000 off", "$50.00 off", "20% off", "15 % off". The "off" tail is
// what marks it as a promotion — a bare "$129 replacement cost" never matches, so
// grounded leak math is untouched.
const OFFER_PATTERN =
  /(?:\$\s?\d[\d,]*(?:\.\d{1,2})?|\b\d{1,3}\s?%)\s*off\b/gi;

/** Replace any fabricated dollar/percent "off" promotion with the placeholder.
 *  A string that already contains the placeholder is left as-is. */
export function scrubInventedOffer(text: string): string {
  return text.replace(OFFER_PATTERN, OFFER_PLACEHOLDER);
}

/** True when the text still carries a non-placeholder "$N off"/"N% off"
 *  promotion — used by the validator to fail invented offers. */
export function hasInventedOffer(text: string): boolean {
  const stripped = text.split(OFFER_PLACEHOLDER).join(" ");
  return OFFER_PATTERN.test(stripped);
}

/** Deep-walk any value graph and scrub invented offers from every string,
 *  preserving structure. Applied to the whole AssetPack post-generation so no
 *  deliverable can ship a fabricated discount. */
export function sanitizeInventedOffers<T>(value: T): T {
  if (typeof value === "string") return scrubInventedOffer(value) as unknown as T;
  if (Array.isArray(value))
    return value.map((v) => sanitizeInventedOffers(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeInventedOffers(v);
    return out as unknown as T;
  }
  return value;
}
