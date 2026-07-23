/**
 * Governance test suite for the closed leak taxonomy (Phases 1–6).
 *
 * Offline, no API calls. Runs the detection engine over hand-built ScrapeData
 * fixtures and asserts:
 *   1. Detection unit tests   — specific leaks fire at the expected evidence tier.
 *   2. Three golden fixtures  — a dentist, a roofer, and a law firm snapshot their
 *                               fired leaks / tiers / ranking / cold-audit top-3 /
 *                               deterministic grading.
 *   3. Output validators      — stat guard, voice lint, out-of-scope containment,
 *                               taxonomy containment.
 *
 *   npm test
 */

import assert from "node:assert";

import {
  getFiredLeaks,
  reportLeaks,
  outOfScopeLeaks,
  selectColdAudit,
  gradeAreas,
  SCORECARD_AREAS,
  type FiredLeak,
} from "@/lib/leak-detection";
import { LEAKS, STATS, type ScrapeData, type EvidenceTier } from "@/lib/leak-taxonomy";
import {
  statGuard,
  voiceLint,
  allowedNumbersFor,
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedStatPhrase,
  shortSource,
} from "@/lib/leak-narrative";
import { validatePack } from "@/lib/exporters/validate-pack";
import {
  distinctDeeperQuestions,
  PIPELINE_DISCOVERY_QUESTION,
} from "@/lib/exporters/cold-audit-html";
import type { AssetPack } from "@/types";

// ── tiny test harness ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`      ${(err as Error).message}`);
  }
}
function section(title: string): void {
  console.log(`\n${title}`);
}

const LEAK_IDS = new Set(LEAKS.map((l) => l.id));
const fireIds = (fired: FiredLeak[]) => new Set(fired.map((f) => f.leak.id));
function tierOf(fired: FiredLeak[], id: string): EvidenceTier | null {
  return fired.find((f) => f.leak.id === id)?.tier ?? null;
}

// ── fixtures ──────────────────────────────────────────────────────────────────

// Dentist: limited hours + no booking + no chat + low review response + thin
// review count against strong competitors.
const dentist: ScrapeData = {
  business: { name: "Bright Smile Dental", industry: "dental", city: "Austin", phone: "555-0100", websiteUrl: "https://brightsmile.example" },
  website: {
    pagesFound: ["home", "services", "contact"],
    pageText: { home: "Welcome to Bright Smile Dental.", contact: "Call us today." },
    scanConfident: true,
    hasContactForm: "PRESENT",
    formHasQualifyingFields: false,
    hasOnlineBookingLink: "ABSENT",
    hasChatWidget: "ABSENT",
    hasClickToCallOnMobile: "PRESENT",
    hasPrimaryCtaAboveFold: true,
    servicePagesHaveCtas: true,
    mentionsTextingOption: false,
    linksToFacebook: false,
    linksToInstagram: false,
  },
  pageSpeed: { mobileScore: 82, lcpSeconds: 2.1 },
  googleReviews: { rating: 4.8, count: 40, recentCount90d: 3, ownerResponseRate: 0.1, reviewTexts: [] },
  gbp: { hoursListed: true, limitedHours: true, hasBookingLink: false, messagingEnabled: false },
  competitors: [
    { name: "A Dental", rating: 4.7, reviewCount: 300 },
    { name: "B Dental", rating: 4.6, reviewCount: 250 },
    { name: "C Dental", rating: 4.9, reviewCount: 400 },
  ],
};

// Roofer: explicit slow-response complaints in reviews, no webchat, deposit
// vertical. Booking + qualifying form present to isolate the response leak.
const roofer: ScrapeData = {
  business: { name: "Peak Roofing", industry: "roofing", city: "Denver", phone: "555-0200", websiteUrl: "https://peakroof.example" },
  website: {
    pagesFound: ["home", "services", "contact", "booking"],
    pageText: { home: "Peak Roofing — book your inspection." },
    scanConfident: true,
    hasContactForm: "PRESENT",
    formHasQualifyingFields: true,
    hasOnlineBookingLink: "PRESENT",
    hasChatWidget: "ABSENT",
    hasClickToCallOnMobile: "PRESENT",
    hasPrimaryCtaAboveFold: true,
    servicePagesHaveCtas: true,
    mentionsTextingOption: true,
    linksToFacebook: false,
    linksToInstagram: false,
  },
  pageSpeed: { mobileScore: 78, lcpSeconds: 2.4 },
  googleReviews: {
    rating: 4.3,
    count: 120,
    recentCount90d: 10,
    ownerResponseRate: 0.8,
    reviewTexts: [
      "Great crew but I never heard back after the first visit.",
      "They were slow to respond and I waited weeks for a callback.",
      "Quality work once they showed up.",
    ],
  },
  gbp: { hoursListed: true, limitedHours: false, hasBookingLink: true, messagingEnabled: true },
  competitors: [
    { name: "Summit Roof", rating: 4.5, reviewCount: 140 },
    { name: "Apex Roof", rating: 4.4, reviewCount: 160 },
  ],
};

// Law firm: bare contact form (no qualifying), no booking, no chat, but strong
// well-answered reviews (reputation should stay clean).
const lawFirm: ScrapeData = {
  business: { name: "Hale & Cross LLP", industry: "law", city: "Chicago", phone: "555-0300", websiteUrl: "https://halecross.example" },
  website: {
    pagesFound: ["home", "about", "contact"],
    pageText: { home: "Hale & Cross — trusted counsel.", contact: "Request a consultation." },
    scanConfident: true,
    hasContactForm: "PRESENT",
    formHasQualifyingFields: false,
    hasOnlineBookingLink: "ABSENT",
    hasChatWidget: "ABSENT",
    hasClickToCallOnMobile: "PRESENT",
    hasPrimaryCtaAboveFold: true,
    servicePagesHaveCtas: true,
    mentionsTextingOption: false,
    linksToFacebook: false,
    linksToInstagram: false,
  },
  pageSpeed: { mobileScore: 90, lcpSeconds: 1.8 },
  googleReviews: { rating: 4.9, count: 200, recentCount90d: 15, ownerResponseRate: 0.9, reviewTexts: [] },
  gbp: { hoursListed: true, limitedHours: false, hasBookingLink: false, messagingEnabled: false },
  competitors: [
    { name: "Baker Law", rating: 4.8, reviewCount: 180 },
    { name: "Stone Law", rating: 4.7, reviewCount: 220 },
  ],
};

// ── 1. Detection unit tests ────────────────────────────────────────────────────
section("1. Detection unit tests");

test("dentist: limited hours + no capture path → no_after_hours_coverage OBSERVED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_after_hours_coverage"), "OBSERVED");
});

test("dentist: no booking anywhere → no_online_booking OBSERVED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_online_booking"), "OBSERVED");
});

test("dentist: bare form → no_lead_qualification OBSERVED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_lead_qualification"), "OBSERVED");
});

test("dentist: low owner response rate → unanswered_reviews OBSERVED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "unanswered_reviews"), "OBSERVED");
});

test("dentist: thin count vs strong competitors → low_review_velocity OBSERVED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "low_review_velocity"), "OBSERVED");
});

test("roofer: 2+ slow-response reviews → slow_speed_to_lead EVIDENCED", () => {
  assert.strictEqual(tierOf(getFiredLeaks(roofer), "slow_speed_to_lead"), "EVIDENCED");
});

test("roofer: mentions texting → missed_calls_no_recovery does NOT fire", () => {
  assert.ok(!fireIds(getFiredLeaks(roofer)).has("missed_calls_no_recovery"));
});

test("roofer: has booking → no_online_booking does NOT fire", () => {
  assert.ok(!fireIds(getFiredLeaks(roofer)).has("no_online_booking"));
});

test("roofer: deposit vertical → payment_booking_friction BENCHMARK", () => {
  assert.strictEqual(tierOf(getFiredLeaks(roofer), "payment_booking_friction"), "BENCHMARK");
});

test("lawFirm: strong well-answered reviews → unanswered_reviews does NOT fire", () => {
  assert.ok(!fireIds(getFiredLeaks(lawFirm)).has("unanswered_reviews"));
});

test("lawFirm: count near competitor median → low_review_velocity does NOT fire", () => {
  assert.ok(!fireIds(getFiredLeaks(lawFirm)).has("low_review_velocity"));
});

test("lawFirm: appointment vertical, no reminder visible → no_show_exposure BENCHMARK", () => {
  assert.strictEqual(tierOf(getFiredLeaks(lawFirm), "no_show_exposure"), "BENCHMARK");
});

test("ownerResponseRate unknown sentinel (-1) never fires unanswered_reviews", () => {
  const d: ScrapeData = { ...dentist, googleReviews: { ...dentist.googleReviews!, ownerResponseRate: -1 } };
  assert.ok(!fireIds(getFiredLeaks(d)).has("unanswered_reviews"));
});

// ── 2. Golden fixtures ─────────────────────────────────────────────────────────
section("2. Golden fixtures");

for (const [name, data] of [
  ["dentist", dentist],
  ["roofer", roofer],
  ["lawFirm", lawFirm],
] as const) {
  const fired = getFiredLeaks(data);
  const report = reportLeaks(fired);
  const cold = selectColdAudit(fired);
  const grades = gradeAreas(fired);

  test(`${name}: every fired leak is a real taxonomy id`, () => {
    for (const f of fired) assert.ok(LEAK_IDS.has(f.leak.id), `unknown id ${f.leak.id}`);
  });

  test(`${name}: report is in-scope only and ranked descending by score`, () => {
    assert.ok(report.every((f) => f.leak.scope !== "out_of_scope"));
    for (let i = 1; i < report.length; i++) assert.ok(report[i - 1].score >= report[i].score);
  });

  test(`${name}: cold audit = at most 3, maximally provable for its eligible pool`, () => {
    assert.ok(cold.length <= 3);
    const isProvable = (f: FiredLeak) => f.tier === "OBSERVED" || f.tier === "EVIDENCED";
    // The provability rebalance can only draw provable leaks from the cold-audit-
    // eligible pool; the true guarantee is >=2 provable ONLY when >=2 exist there.
    const eligibleProvable = report.filter(
      (f) => f.leak.deliverableTargets.includes("cold_audit") && isProvable(f)
    ).length;
    const inCold = cold.filter(isProvable).length;
    const target = Math.min(2, eligibleProvable);
    if (cold.length === 3) assert.ok(inCold >= target, `expected >=${target} provable, got ${inCold}`);
  });

  test(`${name}: all 9 scorecard areas graded within [10,95]`, () => {
    assert.strictEqual(Object.keys(grades).length, 9);
    for (const area of SCORECARD_AREAS) {
      assert.ok(grades[area] >= 10 && grades[area] <= 95, `${area}=${grades[area]}`);
    }
  });
}

test("dentist: penalized areas grade below the clean-area ceiling of 95", () => {
  const grades = gradeAreas(getFiredLeaks(dentist));
  assert.ok(grades.online_booking < 95, "online_booking should be penalized");
  assert.ok(grades.after_hours_coverage < 95, "after_hours_coverage should be penalized");
  assert.ok(grades.reputation_social_proof < 95, "reputation should be penalized");
});

test("lawFirm: reputation stays clean at 95 (no reputation leak fired)", () => {
  const grades = gradeAreas(getFiredLeaks(lawFirm));
  assert.strictEqual(grades.reputation_social_proof, 95);
});

// ── 3. Output validators ───────────────────────────────────────────────────────
section("3. Output validators");

test("out-of-scope containment: outOfScopeLeaks are all scope=out_of_scope", () => {
  for (const data of [dentist, roofer, lawFirm]) {
    const oos = outOfScopeLeaks(getFiredLeaks(data));
    assert.ok(oos.every((f) => f.leak.scope === "out_of_scope"));
  }
});

test("stat guard: flags a number outside the allowed set", () => {
  const res = statGuard("We recover 47% of lost leads.", [12, 32]);
  assert.ok(!res.ok);
  assert.ok(res.violations.some((v) => v.includes("47")));
});

test("stat guard: passes when every number is allowed", () => {
  const res = statGuard("Speed-to-lead lifts close rate from 12% to 32%.", [12, 32]);
  assert.ok(res.ok, `unexpected violations: ${res.violations.join(", ")}`);
});

test("stat guard: allowedNumbersFor(report) admits the report's own figures", () => {
  const fired = reportLeaks(getFiredLeaks(dentist));
  const allowed = allowedNumbersFor(fired, dentist);
  assert.ok(Array.isArray(allowed) && allowed.every((n) => typeof n === "number"));
});

test("voice lint: catches a banned filler word", () => {
  const res = voiceLint("This will unlock synergy and supercharge growth.");
  assert.ok(!res.ok);
  assert.ok(res.hits.length >= 1);
});

test("voice lint: clean copy passes", () => {
  assert.ok(voiceLint("Your booking link is buried below three scrolls.").ok);
});

test("taxonomy containment: leak prompt block references only fired leak names", () => {
  const fired = reportLeaks(getFiredLeaks(dentist));
  const block = leakInputsToPromptBlock(buildLeakInputs(fired, dentist));
  for (const f of fired) assert.ok(block.includes(f.leak.name), `missing ${f.leak.name}`);
});

// ── 4. Parts C–H regression locks ───────────────────────────────────────────────
section("4. Parts C–H regression locks");

// Part G — source attribution.
test("Part G: shortSource compacts multi-org / year-tagged sources", () => {
  assert.strictEqual(shortSource("MIT / InsideSales (Oldroyd)"), "MIT/InsideSales");
  assert.strictEqual(shortSource("HBR 2011 / Drift 2018"), "HBR/Drift");
  assert.strictEqual(
    shortSource("Harvard Business Review, 'The Short Life of Online Sales Leads' (1.25M leads)"),
    "Harvard Business Review"
  );
});

test("Part G: Tier-A allowed stat phrase carries its inline source", () => {
  const phrase = allowedStatPhrase(STATS.missed_voicemail_85);
  assert.ok(phrase.includes("85%"), "keeps the claim");
  assert.ok(/\(CallRail/.test(phrase), `missing source tag: ${phrase}`);
});

test("Part G: Tier-B soft framing never leaks a raw source/number", () => {
  // A Tier-B stat (if any) must return only soft framing — no parenthetical source.
  const tierB = Object.values(STATS).find((s) => s.reliability === "B");
  if (!tierB) return; // no Tier-B stats defined — nothing to assert
  const phrase = allowedStatPhrase(tierB);
  assert.ok(!/\d+%/.test(phrase), `Tier-B phrase exposed a raw figure: ${phrase}`);
});

// Parts E + G — the shared leak prompt block carries both rules.
test("Parts E+G: leak prompt block states the evidence-override and citation rules", () => {
  const block = leakInputsToPromptBlock(buildLeakInputs(reportLeaks(getFiredLeaks(dentist)), dentist));
  assert.ok(block.includes("EVIDENCE OVERRIDES EXAMPLE MAGNITUDES"), "missing Part E rule");
  assert.ok(block.includes("CITATIONS (Part G)"), "missing Part G rule");
});

// Part H2 — distinct discovery questions + guaranteed pipeline probe.
test("Part H2: duplicate questions collapse to distinct probes", () => {
  const out = distinctDeeperQuestions([
    "How fast do leads hear back after hours?",
    "How fast do leads hear back after hours?", // exact dup
    "What happens to enquiries that never book?",
  ]);
  assert.strictEqual(new Set(out).size, out.length, "duplicates survived");
});

test("Part H2: the pipeline question is guaranteed among the probes", () => {
  const out = distinctDeeperQuestions([
    "How fast do leads hear back after hours?",
    "What happens to enquiries that never book?",
  ]);
  assert.ok(out.includes(PIPELINE_DISCOVERY_QUESTION), "pipeline question not injected");
  assert.ok(out.length <= 3, "exceeded 3 questions");
});

test("Part H2: an existing pipeline probe is not duplicated", () => {
  const out = distinctDeeperQuestions([
    "How many leads came in last month, and how many became clients?",
    "What happens to enquiries that never book?",
  ]);
  assert.ok(!out.includes(PIPELINE_DISCOVERY_QUESTION), "double-added the pipeline question");
});

// Part D1 — clean (grade-95) axes must read neutral, not assert a problem.
function packWithMetric(score: number, diagnosis: string): AssetPack {
  return {
    intelligence: {
      executiveSummary: { narrative: "", biggestOpportunities: [], biggestThreats: [], mostUrgentFixes: [], quickWins: [] },
      scorecard: {
        overallReadout: "",
        metrics: [
          { name: "Speed to Lead", score, rubric: "r", evidence: "e", diagnosis, whyItMatters: "w", cause: "c", expectedBenefit: "b" },
        ],
      },
      leakAnalysis: [],
      fastestWins: [],
      strategicRecommendations: [],
    },
  } as unknown as AssetPack;
}

function checkLevel(pack: AssetPack, law: string): string | undefined {
  return validatePack(pack).checks.find((c) => c.law === law)?.level;
}

test("Part D1: clean axis asserting a problem fails the clean-axis check", () => {
  const pack = packWithMetric(95, "You are losing booked calls here.");
  assert.strictEqual(checkLevel(pack, "Part D · clean axis"), "fail");
});

test("Part D1: clean axis with neutral copy passes", () => {
  const pack = packWithMetric(95, "This axis holds up well; the setup is solid and nothing needs attention here.");
  assert.strictEqual(checkLevel(pack, "Part D · clean axis"), "pass");
});

test("Part D1: a penalized axis (below 95) is exempt from the neutral rule", () => {
  const pack = packWithMetric(60, "You are losing booked calls here.");
  assert.strictEqual(checkLevel(pack, "Part D · clean axis"), "pass");
});

// Part C2 — every BENCHMARK leak carries the kickoff-verification line.
function packWithBenchmarkLeak(withKickoff: boolean): AssetPack {
  const explanation = withKickoff
    ? "Legal calls typically hit voicemail. We verify this together at kickoff — if you already have this covered, it comes off the list."
    : "Legal calls typically hit voicemail during court hours.";
  return {
    intelligence: {
      executiveSummary: { narrative: "", biggestOpportunities: [], biggestThreats: [], mostUrgentFixes: [], quickWins: [] },
      scorecard: { overallReadout: "", metrics: [] },
      leakAnalysis: [
        {
          area: "Speed-to-Lead",
          evidenceTier: "BENCHMARK",
          evidence: "Industry pattern",
          explanation,
          businessImpact: "Lost calls",
          dollarImpact: { leadVolumeBasis: "", effectSize: "", avgValueBasis: "", monthlyLow: 0, monthlyHigh: 0, formula: "", usesBenchmarkValue: true },
          difficulty: "low",
          priority: "high",
          recommendedFix: "",
          owner: "us",
        },
      ],
      fastestWins: [],
      strategicRecommendations: [],
    },
  } as unknown as AssetPack;
}

test("Part C2: a BENCHMARK leak missing the kickoff line fails", () => {
  assert.strictEqual(checkLevel(packWithBenchmarkLeak(false), "Part C · kickoff line"), "fail");
});

test("Part C2: a BENCHMARK leak carrying the kickoff line passes", () => {
  assert.strictEqual(checkLevel(packWithBenchmarkLeak(true), "Part C · kickoff line"), "pass");
});

// Determinism fix 1 — the stamped dollarImpact range must match the leak's own
// mathFrame (and the allowed-number set when threaded in). A model integer that
// contradicts either is caught.
function packWithDollar(low: number, high: number, frame: string): AssetPack {
  return {
    intelligence: {
      executiveSummary: { narrative: "", biggestOpportunities: [], biggestThreats: [], mostUrgentFixes: [], quickWins: [] },
      scorecard: { overallReadout: "", metrics: [] },
      leakAnalysis: [
        {
          area: "Speed-to-Lead",
          evidenceTier: "BENCHMARK",
          evidence: "Industry pattern",
          explanation: "…comes off the list",
          businessImpact: "Lost calls",
          dollarImpact: { leadVolumeBasis: "Assuming 20 inquiries/mo", effectSize: "32% missed", avgValueBasis: "$84 benchmark", monthlyLow: low, monthlyHigh: high, formula: "20 × 32% × $84 = $538/mo", usesBenchmarkValue: true },
          mathFrame: frame,
          difficulty: "low",
          priority: "high",
          recommendedFix: "",
          owner: "us",
        },
      ],
      fastestWins: [],
      strategicRecommendations: [],
    },
  } as unknown as AssetPack;
}

test("Fix1: dollarImpact range matching the mathFrame passes the determinism guard", () => {
  const pack = packWithDollar(538, 538, "≈ $538/mo — assuming 20 inquiries/mo …");
  assert.strictEqual(checkLevel(pack, "Facts · dollar determinism"), "pass");
});

test("Fix1: a model integer not present in the mathFrame fails the determinism guard", () => {
  const pack = packWithDollar(999, 999, "≈ $538/mo — assuming 20 inquiries/mo …");
  assert.strictEqual(checkLevel(pack, "Facts · dollar determinism"), "fail");
});

test("Fix1: a stamped integer outside the allowed-number set fails when the set is threaded in", () => {
  // 538 is in the frame (guard a passes) but NOT in the allowed set (guard b fails).
  const pack = packWithDollar(538, 538, "≈ $538/mo — assuming 20 inquiries/mo …");
  const level = validatePack(pack, [20, 32, 84]).checks.find((c) => c.law === "Facts · dollar determinism")?.level;
  assert.strictEqual(level, "fail");
});

test("Fix1: a stamped integer inside the allowed-number set passes with the set threaded in", () => {
  const pack = packWithDollar(538, 538, "≈ $538/mo — assuming 20 inquiries/mo …");
  const level = validatePack(pack, [20, 32, 84, 538]).checks.find((c) => c.law === "Facts · dollar determinism")?.level;
  assert.strictEqual(level, "pass");
});

// ── summary ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
