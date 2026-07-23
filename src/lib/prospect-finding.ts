// Prospect finding engine — the trust layer behind the daily queue's
// "find to open with". The daily queue only has cheap Google Places signals
// (website presence, rating, review count, category) — it never scrapes the
// site or measures speed. So the ONE rule here is: a finding may only render if
// it is VERIFIABLE from that Places data and DIRECTION-CHECKED for THIS business.
//
// Everything the queue cannot see from the outside — booking widgets, load
// speed, follow-up, response time — is UNKNOWN, and UNKNOWN never renders as a
// leak. (Those are for the full cold-audit pipeline, which actually scrapes the
// rendered site and can prove absence.) A strong business gets the systems
// angle, never a manufactured leak.
//
// This is the single enforcement point: selectFinding() picks the type in code
// (the LLM never chooses), and gateAngle() validates/repairs the copy before it
// is persisted. Mirrors the tri-state + output-gate pattern the deliverable
// pipeline already uses (leak-detection.ts / validate-pack.ts).

// The only finding types the daily queue is ALLOWED to open with. Booking-path
// and site-speed are deliberately absent: they cannot be verified from Places,
// so asserting them is a guess the owner could disprove by glancing at their
// own site. They live only in the full (rendered-scrape) cold-audit pipeline.
export type ProspectFindingType = "NO_REAL_WEBSITE" | "REVIEW_GAP" | "SYSTEMS_ANGLE";

// A real, named, same-niche/same-metro competitor pulled from the batch Places
// already returned (free — no extra API call). Used to make a review gap
// defensible: a real name and a real number, or the gap does not render.
export interface Benchmark {
  name: string;
  reviews: number;
}

export interface SelectedFinding {
  type: ProspectFindingType;
  // Populated only for REVIEW_GAP — a real competitor the caller can name.
  competitor?: Benchmark;
}

// Signals available at daily-queue time — Places only. No rendered scrape.
export interface FindingSignals {
  name: string;
  hasWebsite: boolean;
  rating: number; // 0 = unknown
  reviews: number; // 0 = none/unknown
}

// --- Review-gap direction guard (ported from the deliverable pipeline) -------
// A review gap is only an opener when THIS business is genuinely BEHIND a real,
// named, same-category competitor. If the business leads or is strong in
// absolute terms, the gap is banned — citing "only N reviews" for a review
// leader is exactly the direction-blind bug (Impressions Orthodontics: 923
// reviews flagged as a gap).

// A business this strong is never opened with a review gap, regardless of the
// pool: 500+ reviews, OR an elite reputation with real volume.
export const STRONG_REVIEW_FLOOR = 500;
const ELITE_RATING = 4.7;
const ELITE_MIN_REVIEWS = 300;
// A competitor needs real presence to be worth naming.
const COMPETITOR_MIN_REVIEWS = 25;
// The target must be materially behind — under ~60% of the competitor's count.
const BEHIND_RATIO = 0.6;

function isStrongAbsolutely(s: FindingSignals): boolean {
  if (s.reviews >= STRONG_REVIEW_FLOOR) return true;
  if (s.rating >= ELITE_RATING && s.reviews >= ELITE_MIN_REVIEWS) return true;
  return false;
}

// Pick the strongest real competitor from the same-niche/same-metro pool that
// makes a defensible, direction-correct gap for THIS business. Returns null if
// no honest gap exists (which is the common case for a healthy business).
export function reviewGapCompetitor(
  s: FindingSignals,
  pool: Benchmark[]
): Benchmark | null {
  // A review leader / strong business is never "behind" — ban the gap outright.
  if (isStrongAbsolutely(s)) return null;

  // Candidate competitors: real presence, ahead of the target, not the target.
  const ahead = pool
    .filter(
      (c) =>
        c.reviews >= COMPETITOR_MIN_REVIEWS &&
        c.reviews > s.reviews &&
        c.name.trim().toLowerCase() !== s.name.trim().toLowerCase()
    )
    .sort((a, b) => b.reviews - a.reviews);

  if (ahead.length === 0) return null;

  // Target must be under ~60% of this competitor's count to call it a real gap.
  const top = ahead[0];
  if (s.reviews >= top.reviews * BEHIND_RATIO) return null;
  // If the target is itself the top of its local pool, it's not behind anyone.
  const maxInPool = Math.max(...pool.map((c) => c.reviews), s.reviews);
  if (s.reviews >= maxInPool) return null;

  return top;
}

// --- Deterministic finding selection (the fallback ladder) -------------------
// Order: (1) NO_REAL_WEBSITE — the strongest thing verifiable from Places;
// (2) REVIEW_GAP — only if direction-checked against a real named competitor;
// (3) SYSTEMS_ANGLE — the strength/systems opener. Never a manufactured leak.
export function selectFinding(s: FindingSignals, pool: Benchmark[]): SelectedFinding {
  if (!s.hasWebsite) return { type: "NO_REAL_WEBSITE" };

  const competitor = reviewGapCompetitor(s, pool);
  if (competitor) return { type: "REVIEW_GAP", competitor };

  return { type: "SYSTEMS_ANGLE" };
}

// --- Deterministic copy templates (the verifiable-or-silent floor) -----------
// Every template makes only claims that are true by construction: no-website is
// proven by Places; the review gap names a real competitor with a real number;
// the systems angle explicitly says the leaks are invisible from outside and
// claims nothing about anything unseen. If the LLM copy fails the gate, THIS is
// what renders — so the worst case is still fully defensible.
export function templateAngle(
  s: FindingSignals,
  finding: SelectedFinding
): { painPoint: string; outreachAngle: string } {
  switch (finding.type) {
    case "NO_REAL_WEBSITE":
      return {
        painPoint:
          `When someone searches ${s.name} there's no real website to find or book on — ` +
          `so anyone interested has to phone during business hours or moves on to whoever they can book instantly.`,
        outreachAngle:
          `Noticed there's no real site to book on when people look you up — ` +
          `that's customers slipping to whoever shows up next. Worth a quick look at where they're going?`,
      };
    case "REVIEW_GAP": {
      const c = finding.competitor!;
      return {
        painPoint:
          `You show ${s.reviews} Google reviews while ${c.name} nearby shows ${c.reviews} — ` +
          `side by side, that gap quietly decides a lot of calls before anyone gets to a quote.`,
        outreachAngle:
          `Saw ${c.name} sitting at ${c.reviews} reviews to your ${s.reviews} — ` +
          `that gap is picking off people comparing you two. Worth showing you where those go?`,
      };
    }
    case "SYSTEMS_ANGLE":
    default:
      return {
        painPoint:
          `From the outside ${s.name} looks strong` +
          (s.reviews ? ` — ${s.reviews} reviews${s.rating ? `, ${s.rating}★` : ""}` : "") +
          `. The expensive leaks aren't visible from the curb: how fast a new lead gets a response, ` +
          `whether anyone follows up, and how many booked appointments quietly no-show.`,
        outreachAngle:
          `You look solid online — which is exactly why the leaks worth money are the invisible ones: ` +
          `response speed, follow-up, no-shows. Worth 10 minutes to see where they are?`,
      };
  }
}

// --- Output gate (Defect C) --------------------------------------------------
// Validates LLM-written copy against the selected finding. A row's copy renders
// only if it is verifiable, direction-checked, and defensible; any violation
// falls back to the deterministic template above. This is where "verifiable or
// silent" is mechanically enforced — prompt wording is not trusted on its own.

// Phrases that assert something the daily queue never observed. If copy contains
// these AND the finding type doesn't license them, it's a violation.
const BOOKING_CLAIM = /\bbook(?:ing)?\s+(?:path|link|button|online|widget)\b|no\s+(?:online\s+)?booking|can'?t\s+book|no\s+way\s+to\s+book|obvious\s+way\s+to\s+book/i;
const SPEED_CLAIM = /\b(?:slow|sluggish|laggy)\b|load(?:s|ing)?\s+(?:slow|time)|\b\d+(?:\.\d+)?\s*seconds?\b|mobile\s+site\s+(?:is\s+)?(?:slow|weak)/i;
const COMPETITOR_MENTION = /\bcompetitor|down\s+the\s+(?:road|street)|nearby\b|rival\b/i;
// "only 923 reviews" style — an absolute-count belittling.
const ONLY_REVIEWS = /\bonly\s+[\d,]+\s+(?:google\s+)?reviews?\b/i;
const REVIEW_MENTION = /\breviews?\b/i;
const NO_WEBSITE_CLAIM = /\bno\s+(?:real\s+)?website|without\s+a\s+website|no\s+site\b/i;

export interface AngleCandidate {
  painPoint: string;
  outreachAngle: string;
}

export interface GateResult {
  angle: AngleCandidate;
  passed: boolean; // false → template substituted
  reason?: string; // why the LLM copy was rejected (for verification logs)
}

// Returns the copy to persist. If the LLM copy violates the finding contract,
// the deterministic template is substituted so the row is still a good, honest
// opener — never a manufactured or disprovable leak.
export function gateAngle(
  s: FindingSignals,
  finding: SelectedFinding,
  candidate: AngleCandidate | null | undefined
): GateResult {
  const template = templateAngle(s, finding);
  const c: AngleCandidate = {
    painPoint: (candidate?.painPoint ?? "").trim(),
    outreachAngle: (candidate?.outreachAngle ?? "").trim(),
  };
  const text = `${c.painPoint} ${c.outreachAngle}`;

  const fail = (reason: string): GateResult => ({ angle: template, passed: false, reason });

  // Empty / too-thin copy → template.
  if (!c.painPoint || c.painPoint.length < 12) return fail("empty-or-thin");

  // Booking-path and speed are NEVER verifiable at this stage — banned for every
  // type. This is the root fix for the "NO BOOKING PATH" false positives.
  if (BOOKING_CLAIM.test(text)) return fail("unverifiable-booking-claim");
  if (SPEED_CLAIM.test(text)) return fail("unverifiable-speed-claim");

  // A competitor may only be named for a valid REVIEW_GAP, and the copy must use
  // the real competitor name + the real number — never a vague "a competitor".
  if (finding.type === "REVIEW_GAP") {
    const comp = finding.competitor!;
    if (!c.painPoint.includes(comp.name)) return fail("review-gap-missing-competitor-name");
    if (!new RegExp(`\\b${comp.reviews}\\b`).test(c.painPoint))
      return fail("review-gap-missing-competitor-number");
  } else {
    // Non-review-gap findings must not imply a comparison or belittle counts.
    if (COMPETITOR_MENTION.test(text)) return fail("comparison-without-valid-gap");
    if (ONLY_REVIEWS.test(text)) return fail("belittles-review-count");
    // A review leader must never be told they have "only N reviews".
    if (s.reviews >= STRONG_REVIEW_FLOOR && ONLY_REVIEWS.test(text))
      return fail("belittles-strong-review-count");
  }

  // Never claim "no website" unless that's actually the finding.
  if (finding.type !== "NO_REAL_WEBSITE" && s.hasWebsite && NO_WEBSITE_CLAIM.test(text))
    return fail("false-no-website-claim");

  // Global copy rule: never "only [N] reviews" where N is high, in any copy.
  if (ONLY_REVIEWS.test(c.painPoint)) {
    const n = Number((c.painPoint.match(/only\s+([\d,]+)\s+(?:google\s+)?reviews?/i)?.[1] ?? "0").replace(/,/g, ""));
    if (REVIEW_MENTION.test(c.painPoint) && n >= 200) return fail("belittles-high-review-count");
  }

  return { angle: c, passed: true };
}
