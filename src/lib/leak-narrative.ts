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
  gradeOf,
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
  return `${stat.claim} (${shortSource(stat.source)})`;
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
}

export function buildLeakInputs(fired: FiredLeak[], data: ScrapeData): LeakInput[] {
  return fired.map((f) => {
    const math = f.leak.mathTemplate
      ? computeMathEstimate(f.leak.mathTemplate, data)
      : null;
    const allowedStats = resolveStats(f.leak.statIds).map(allowedStatPhrase);
    return {
      id: f.leak.id,
      name: f.leak.name,
      scorecardArea: f.leak.scorecardArea,
      symptom: f.leak.symptom,
      revenueMechanism: f.leak.revenueMechanism,
      tier: f.tier,
      // CARRIED, NOT RECOMPUTED. getFiredLeaks derived it once from what the
      // detector actually found; deriving it a second time here is how the
      // deliverable's voice and the detection's honesty drift apart.
      grade: f.grade,
      evidenceClass: f.leak.evidenceClass,
      tierPhrasingRule: TIER_PHRASING[f.tier],
      gradeVoiceRule: GRADE_VOICE[f.grade],
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
  add(data.googleReviews?.recentCount90d);
  add(data.pageSpeed?.mobileScore);
  add(data.pageSpeed?.lcpSeconds);
  for (const c of data.competitors ?? []) {
    add(c.reviewCount);
    add(c.rating);
  }
  return Array.from(nums);
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
