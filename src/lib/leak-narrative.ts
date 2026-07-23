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
  type Stat,
  type EvidenceTier,
  type EvidenceClass,
  type ScrapeData,
  type Vertical,
} from "./leak-taxonomy";
import type { FiredLeak } from "./leak-detection";

// ── Tier phrasing (RULES.language) ───────────────────────────────────────────

export const KICKOFF_VERIFICATION_LINE =
  "We verify this together at kickoff — if you already have this covered, it comes off the list.";

export const TIER_PHRASING: Record<EvidenceTier, string> = {
  OBSERVED:
    "State as fact and cite the observed data point. No hedging verbs — this was directly seen in the data.",
  EVIDENCED:
    "State the signal first, then the inference. Quote at most a ~10-word fragment of any review. Use hedged verbs (a strong sign, likely).",
  BENCHMARK:
    "Three-part shape, mandatory: (a) acknowledge it isn't externally visible, (b) give the industry pattern using ONLY the allowed stat or its softFraming, (c) end with the kickoff-verification line verbatim. Hedged verbs throughout (typically, most, if that's true here).",
};

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

// ── Vertical benchmark tables (numbers sourced verbatim from STATS) ──────────
// cpl_google_ads: HVAC $129, Plumbing $129, Roofing $228, Electrical $94,
//   Dental $84, Legal $132 (USD). Verticals absent from the stat get no CPL
//   figure (so no dollar frame is produced — decision 4).
const VERTICAL_CPL: Partial<Record<Vertical, number>> = {
  hvac: 129,
  plumbing: 129,
  roofing: 228,
  electrical: 94,
  dental: 84,
  law: 132,
};

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

// BENCHMARK MODE assumed inbound volume. Stated explicitly as a conservative
// assumption everywhere it's used, and held to ONE value so a single document
// stays internally consistent (A7). Never presented as the client's real number.
const BENCHMARK_ASSUMED_MONTHLY_INQUIRIES = 20;

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

/** Build the dollar estimate for a fired leak, honoring the pre/post-intake
 *  split. Returns null when the leak has no math template or no computable,
 *  in-STATS figure is available (in which case NO dollar figure is emitted). */
export function computeMathEstimate(
  template: MathTemplate,
  data: ScrapeData
): MathEstimate | null {
  const v = data.business.industry;
  const intake = data.intake;
  const cpl = VERTICAL_CPL[v];
  const missedPct = verticalMissedRatePct(v);

  switch (template) {
    case "spend_anchored":
    case "missed_call_value": {
      // REAL MODE: the operator entered the client's real economics. Customer
      // value is labeled as such (A1); the frame reads as a computed figure with
      // its inputs visible, not a raw formula (A3).
      if (intake?.monthlyCallVolume && intake.avgJobValueCad) {
        const lost = intake.monthlyCallVolume * (missedPct / 100) * 0.85;
        const low = round0(lost * 0.3 * 0.5 * intake.avgJobValueCad);
        const high = round0(lost * 0.3 * intake.avgJobValueCad);
        return {
          mode: "REAL",
          frame: `≈ $${low.toLocaleString()}–$${high.toLocaleString()}/mo — based on the numbers you provided: ${intake.monthlyCallVolume} inquiries/mo × a ${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail) × the 85% of missed callers who never call back (CallRail) × a conservative close rate × your $${intake.avgJobValueCad.toLocaleString()} average customer value. Estimated.`,
          dollarLow: low,
          dollarHigh: high,
          impact: {
            low,
            high,
            leadVolumeBasis: `Based on your ${intake.monthlyCallVolume} inquiries/mo (estimated projection)`,
            effectSize: `${missedPct}% ${verticalMissedLabel(v)} missed-call rate × the 85% who never call back (CallRail)`,
            avgValueBasis: `$${intake.avgJobValueCad.toLocaleString()} average customer value — your number`,
            formula: `${intake.monthlyCallVolume} inquiries × ${missedPct}% missed × 85% no-callback × conservative close × $${intake.avgJobValueCad.toLocaleString()} = $${low.toLocaleString()}–$${high.toLocaleString()}/mo`,
            usesBenchmarkValue: false,
          },
          allowedNumbers: [intake.monthlyCallVolume, missedPct, 85, intake.avgJobValueCad, low, high],
        };
      }
      // BENCHMARK MODE: no client numbers. Compute a single point estimate from a
      // stated conservative assumed volume × the industry missed-call rate × the
      // replacement cost per lead (A3). CPL is labeled replacement cost, NEVER
      // customer value (A4).
      if (cpl) {
        const assumed = BENCHMARK_ASSUMED_MONTHLY_INQUIRIES;
        const monthly = round0(assumed * (missedPct / 100) * cpl);
        return {
          mode: "BENCHMARK",
          frame: `≈ $${monthly.toLocaleString()}/mo — assuming ${assumed} inquiries/mo (a conservative assumption) × a ${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail) × $${cpl} replacement cost per lead, an industry benchmark (WordStream). Estimated; we run this with your real numbers at kickoff.`,
          dollarLow: monthly,
          dollarHigh: monthly,
          impact: {
            low: monthly,
            high: monthly,
            leadVolumeBasis: `Assuming ${assumed} inquiries/mo (a conservative assumption)`,
            effectSize: `${missedPct}% ${verticalMissedLabel(v)} missed-call rate (CallRail)`,
            avgValueBasis: `$${cpl} replacement cost per lead — an industry benchmark (WordStream)`,
            formula: `${assumed} inquiries × ${missedPct}% missed × $${cpl}/lead = $${monthly.toLocaleString()}/mo`,
            usesBenchmarkValue: true,
          },
          allowedNumbers: [assumed, missedPct, cpl, monthly],
        };
      }
      // No CPL in STATS for this vertical → no dollar frame.
      return null;
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
      if (intake?.avgJobValueCad && intake?.monthlyLeadVolume) {
        const noShowRate = v === "dental" ? 0.15 : v === "med_spa" ? 0.2 : 0.15;
        const noShowPct = round0(noShowRate * 100);
        const low = round0(intake.monthlyLeadVolume * noShowRate * 0.5 * intake.avgJobValueCad);
        const high = round0(intake.monthlyLeadVolume * noShowRate * intake.avgJobValueCad);
        return {
          mode: "REAL",
          frame: `≈ $${low.toLocaleString()}–$${high.toLocaleString()}/mo — based on the numbers you provided: ${intake.monthlyLeadVolume} booked/mo × a ${noShowPct}% no-show rate × your $${intake.avgJobValueCad.toLocaleString()} average customer value. Estimated.`,
          dollarLow: low,
          dollarHigh: high,
          impact: {
            low,
            high,
            leadVolumeBasis: `Based on your ${intake.monthlyLeadVolume} booked/mo (estimated projection)`,
            effectSize: `${noShowPct}% no-show rate`,
            avgValueBasis: `$${intake.avgJobValueCad.toLocaleString()} average customer value — your number`,
            formula: `${intake.monthlyLeadVolume} booked × ${noShowPct}% no-show × $${intake.avgJobValueCad.toLocaleString()} = $${low.toLocaleString()}–$${high.toLocaleString()}/mo`,
            usesBenchmarkValue: false,
          },
          allowedNumbers: [intake.monthlyLeadVolume, noShowPct, intake.avgJobValueCad, low, high],
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
  /** Is the LEAK itself externally observable, or internal to the operation?
   *  INVISIBLE leaks may only be written as pattern + visible-absence +
   *  conditional — never a flat operational assertion — regardless of tier. */
  evidenceClass: EvidenceClass;
  tierPhrasingRule: string;
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
      evidenceClass: f.leak.evidenceClass,
      tierPhrasingRule: TIER_PHRASING[f.tier],
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
      // Intake-confirmed BENCHMARK leaks are stated as fact, so they carry the
      // confirmed framing INSTEAD of the kickoff-verification line.
      requiresKickoffLine: f.tier === "BENCHMARK" && !f.intakeConfirmed,
      intakeConfirmed: f.intakeConfirmed ?? false,
    };
  });
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
    lines.push(`${i + 1}. ${li.name}  [tier: ${li.tier}] [class: ${li.evidenceClass}]`);
    lines.push(`   symptom: ${li.symptom}`);
    lines.push(`   why it costs money (substitute the real evidence magnitudes below for any generic example figure — Part E): ${li.revenueMechanism}`);
    lines.push(`   evidence you may cite: ${li.evidence.length ? li.evidence.join(" · ") : "(none — do not fabricate)"}`);
    lines.push(`   allowed stats (use verbatim meaning, no other numbers): ${li.allowedStats.length ? li.allowedStats.map((s) => `"${s}"`).join(" | ") : "(none — cite no statistics)"}`);
    lines.push(`   dollar/spend framing: ${li.mathFrame ? li.mathFrame : "(no dollar figure — do NOT invent one)"}`);
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
];

export interface FlatAssertionResult {
  ok: boolean;
  hits: string[]; // the offending sentence fragments
}

/** Flag flat operational assertions about invisible internal behavior that lack
 *  a hedge/evidence qualifier. Questions (the sanctioned vehicle for invisible
 *  leaks, Law 3) are skipped. */
export function flatAssertionLint(text: string): FlatAssertionResult {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hits: string[] = [];
  for (const sentence of sentences) {
    if (sentence.endsWith("?")) continue; // questions are allowed to probe
    const asserts = FLAT_ASSERTION_PATTERNS.some((re) => re.test(sentence));
    if (!asserts) continue;
    const hedged = ASSERTION_QUALIFIERS.some((re) => re.test(sentence));
    if (!hedged) hits.push(sentence.slice(0, 120));
  }
  return { ok: hits.length === 0, hits };
}

// Render-time backstop: soften a flat assertion by injecting a leading hedge, so
// a stale/non-regenerable finding can't ship a bare operational claim. Only used
// when a corrective regen isn't available (e.g. HTML render of a saved audit).
// Conservative and grammar-safe: prefixes the sentence with "Likely, " which
// reads correctly in front of every FLAT_ASSERTION_PATTERN subject.
export function softenFlatAssertions(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed || trimmed.endsWith("?")) return sentence;
      const asserts = FLAT_ASSERTION_PATTERNS.some((re) => re.test(trimmed));
      const hedged = ASSERTION_QUALIFIERS.some((re) => re.test(trimmed));
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
