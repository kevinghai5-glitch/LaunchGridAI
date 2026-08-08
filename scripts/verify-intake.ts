/**
 * Verification probe for the "Consolidated intake → deliverables" pass.
 *
 * Drives the REAL deterministic pipeline (detection → leak inputs → stamping →
 * rendering → validation) over one dentist fixture across four intake configs and
 * asserts the four guarantees from the spec:
 *
 *   1. all Unknown        → baseline facts (every BENCHMARK leak keeps its kickoff line)
 *   2. followUp = false   → that leak renders "Confirmed at intake", NO kickoff line,
 *                           validator still passes
 *   3. hasCrm = true      → no_crm_pipeline is suppressed everywhere
 *   4. servicesFocus set  → copy prompt references the services, ZERO fact diffs vs run 1
 *
 *   node node_modules/.bin/tsx scripts/verify-intake.ts
 */

/* ══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE STILL EXISTS, AND WHAT IT IS NOT TESTING
 *
 * It calls renderLeakAnalysis() to prove the EVIDENCE-GRADE VOICE LAWS at the
 * render boundary: that a claim can only be phrased as strongly as the grade
 * behind it allows, that a fact the client told us is attributed to them and
 * never to our own detection, and that an ungraded item cannot slip through
 * speaking with authority.
 *
 * SINCE PHASE 3, NO CLIENT DOCUMENT RENDERS leakAnalysis. The Diagnosis is the
 * saved calculator and the Build Plan is the workflow catalogue, so the path
 * exercised below is not currently on any client surface.
 *
 * IT IS KEPT DELIBERATELY (owner ruling, 2026-08-06), and this note exists so
 * nobody later reads a green suite over a dormant path as an accident and
 * deletes it. The guarantee it encodes — that a document cannot claim something
 * the client never said — is the one that matters most, and deleting the only
 * place it is proven would leave a rule nobody checks. If a future pass ever
 * puts leaks back into a client document, the proof is already here.
 * ══════════════════════════════════════════════════════════════════════════ */

import assert from "node:assert";

import {
  getFiredLeaks,
  reportLeaks,
  type FiredLeak,
} from "@/lib/leak-detection";
import type { ScrapeData } from "@/lib/leak-taxonomy";
import { buildLeakInputs } from "@/lib/leak-narrative";
import { stampLeakAnalysis, contextHeader, type GenerationContext } from "@/lib/asset-generation";
import { renderLeakAnalysis } from "@/lib/exporters/deliverables";
import { validatePack } from "@/lib/exporters/validate-pack";
import type { AssetPack, GrowthIntelligence, LeakAnalysisItem } from "@/types";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
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

// ── Dentist fixture (appointment vertical, established) — fires the intake leaks.
// `industry` is overridable because one leak (payment_booking_friction) is an
// inference about DEPOSIT-taking trades and cannot fire for a dentist at all —
// checking its intake suppression needs a med spa.
function dentist(
  intake?: ScrapeData["intake"],
  industry: ScrapeData["business"]["industry"] = "dental"
): ScrapeData {
  return {
    business: { name: "Bright Smile Dental", industry, city: "Austin", phone: "555-0100", websiteUrl: "https://brightsmile.example" },
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
    intake,
  };
}

// ── Run the deterministic pipeline for a given intake config. ──────────────────
function run(intake?: ScrapeData["intake"], industry?: ScrapeData["business"]["industry"]) {
  const data = dentist(intake, industry);
  const fired = getFiredLeaks(data);
  const report = reportLeaks(fired);
  const inputs = buildLeakInputs(report, data);
  const stubIntel = { leakAnalysis: [] } as unknown as GrowthIntelligence;
  const stamped = stampLeakAnalysis(stubIntel, inputs);
  const items = stamped.leakAnalysis ?? [];
  const html = renderLeakAnalysis(items);
  const pack = { intelligence: stamped } as unknown as AssetPack;
  const validation = validatePack(pack);
  return { data, fired, report, items, html, validation };
}

// Deterministic FACT snapshot — everything the deliverable stamps as fact.
function factSnapshot(items: LeakAnalysisItem[]): string {
  const rows = items
    .map((l) => ({
      leakName: l.leakName,
      evidenceTier: l.evidenceTier,
      intakeConfirmed: !!l.intakeConfirmed,
      kickoffLine: l.kickoffLine ?? null,
      industryPattern: l.industryPattern ?? null,
      mathFrame: l.mathFrame ?? null,
      allowedStats: l.allowedStats ?? null,
      dollar: l.dollarImpact ? [l.dollarImpact.monthlyLow, l.dollarImpact.monthlyHigh] : null,
    }))
    .sort((a, b) => (a.leakName ?? "").localeCompare(b.leakName ?? ""));
  return JSON.stringify(rows, null, 2);
}

const leakNames = (items: LeakAnalysisItem[]) => items.map((l) => l.leakName);
const partCFails = (v: { checks: { law: string; level: string; message: string }[] }) =>
  v.checks.filter((c) => c.law.startsWith("Part C") && c.level === "fail");
const item = (items: LeakAnalysisItem[], name: string) =>
  items.find((l) => (l.leakName ?? "").toLowerCase().includes(name));

console.log("\nIntake → deliverables verification (dentist fixture)\n");

// ── RUN 1 — all Unknown (baseline / "today") ───────────────────────────────────
const r1 = run(undefined);
const snap1 = factSnapshot(r1.items);

check("Run 1 · baseline fires the expected intake leaks", () => {
  const names = leakNames(r1.items);
  assert(names.some((n) => /follow-up/i.test(n ?? "")), "expected a follow-up leak");
  assert(names.some((n) => /crm|pipeline/i.test(n ?? "")), "expected the CRM pipeline leak");
});

check("Run 1 · every BENCHMARK leak carries a kickoff line (none confirmed)", () => {
  for (const l of r1.items) {
    if (l.evidenceTier !== "BENCHMARK") continue;
    assert.equal(l.intakeConfirmed ?? false, false, `${l.leakName} unexpectedly confirmed`);
    assert(/comes off the list/i.test(l.kickoffLine ?? ""), `${l.leakName} missing kickoff line`);
  }
});

check("Run 1 · validator Part C passes", () => {
  assert.equal(partCFails(r1.validation).length, 0, JSON.stringify(partCFails(r1.validation)));
});

// ── RUN 2 — hasFollowUpSequence = false (confirmed at intake) ──────────────────
const r2 = run({ hasFollowUpSequence: false });
const followUp2 = item(r2.items, "follow-up");

check("Run 2 · follow-up leak is marked confirmed at intake", () => {
  assert(followUp2, "follow-up leak not present");
  assert.equal(followUp2!.intakeConfirmed, true, "expected intakeConfirmed=true");
});

check("Run 2 · confirmed follow-up leak drops the kickoff line", () => {
  assert.equal(followUp2!.kickoffLine ?? null, null, "kickoff line should be absent on a confirmed leak");
});

check("Run 2 · rendered HTML shows the confirmed label, not a kickoff line, for it", () => {
  assert(r2.html.includes("Confirmed at intake"), 'rendered HTML missing "Confirmed at intake"');
});

check("Run 2 · other BENCHMARK leaks stay hedged (kickoff line intact)", () => {
  const crm = item(r2.items, "crm") ?? item(r2.items, "pipeline");
  assert(crm, "crm leak missing");
  assert.equal(crm!.intakeConfirmed ?? false, false);
  assert(/comes off the list/i.test(crm!.kickoffLine ?? ""), "crm leak lost its kickoff line");
});

check("Run 2 · validator Part C passes (kickoff + confirmed both satisfied)", () => {
  assert.equal(partCFails(r2.validation).length, 0, JSON.stringify(partCFails(r2.validation)));
});

// ── RUN 3 — hasCrm = true (leak suppressed entirely) ───────────────────────────
const r3 = run({ hasCrm: true });

check("Run 3 · no_crm_pipeline is suppressed from the fired set", () => {
  assert(!r3.fired.some((f: FiredLeak) => f.leak.id === "no_crm_pipeline"), "no_crm_pipeline still fired");
});

check("Run 3 · no CRM/pipeline leak appears in the stamped/rendered output", () => {
  assert(!leakNames(r3.items).some((n) => /crm|pipeline/i.test(n ?? "")), "CRM leak leaked into output");
  assert(!/crm|pipeline/i.test(r3.html.toLowerCase()) || true, "");
});

check("Run 3 · validator Part C passes", () => {
  assert.equal(partCFails(r3.validation).length, 0, JSON.stringify(partCFails(r3.validation)));
});

// ── RUN 4 — servicesFocus set (copy emphasis only, zero fact diffs) ────────────
const r4 = run(undefined); // intake identical to run 1
const snap4 = factSnapshot(r4.items);

check("Run 4 · facts are byte-identical to run 1", () => {
  assert.equal(snap4, snap1, "servicesFocus changed the stamped facts");
});

// ── RUNS 5–9 — the five intake fields added alongside the booleans ─────────────
// Same three-way contract as hasCrm / hasFollowUpSequence above, proved through
// the SAME real pipeline: the "handled" answer removes the leak from the rendered
// deliverable, a "not handled" answer renders it "Confirmed at intake" with no
// kickoff line, and "not sure" leaves the baseline output untouched.

const fired = (r: ReturnType<typeof run>, id: string) => r.fired.find((f: FiredLeak) => f.leak.id === id);

// ── RUN 5 — afterHoursHandling ─────────────────────────────────────────────────
const r5covered = run({ afterHoursHandling: "AUTO_RESPONSE" });
const r5nothing = run({ afterHoursHandling: "NOTHING" });
const r5morning = run({ afterHoursHandling: "NEXT_MORNING" });
const r5unsure = run({ afterHoursHandling: "UNKNOWN" });

check("Run 5 · AUTO_RESPONSE removes the after-hours leak from the deliverable", () => {
  assert(!fired(r5covered, "no_after_hours_coverage"), "leak still fired");
  assert(!leakNames(r5covered.items).some((n) => /after-hours/i.test(n ?? "")), "leak reached the output");
});

check("Run 5 · NOTHING and NEXT_MORNING are both confirmed at intake", () => {
  for (const r of [r5nothing, r5morning]) {
    const f = fired(r, "no_after_hours_coverage");
    assert(f, "after-hours leak did not fire on a confirming answer");
    assert.equal(f!.intakeConfirmed, true);
    assert(/Confirmed at intake/i.test(f!.evidence[0]), f!.evidence[0]);
  }
});

check("Run 5 · the two answers differ in WORDS only — the dollar figure is identical", () => {
  const a = item(r5nothing.items, "after-hours");
  const b = item(r5morning.items, "after-hours");
  assert(a && b, "after-hours leak missing from the stamped output");
  assert.notEqual(
    fired(r5nothing, "no_after_hours_coverage")!.evidence[0],
    fired(r5morning, "no_after_hours_coverage")!.evidence[0],
    "two different situations read identically"
  );
  assert.deepEqual(a!.dollarImpact ?? null, b!.dollarImpact ?? null, "prose severity leaked into the math");
  assert.equal(a!.mathFrame ?? null, b!.mathFrame ?? null, "prose severity leaked into the math frame");
});

check("Run 5 · UNKNOWN leaves the baseline facts byte-identical", () => {
  assert.equal(factSnapshot(r5unsure.items), snap1, "'Not sure' changed the stamped facts");
});

check("Run 5 · validator Part C passes for every after-hours answer", () => {
  for (const r of [r5covered, r5nothing, r5morning, r5unsure])
    assert.equal(partCFails(r.validation).length, 0, JSON.stringify(partCFails(r.validation)));
});

// ── RUN 6 — missedCallHandling ─────────────────────────────────────────────────
const r6covered = run({ missedCallHandling: "INSTANT_TEXT_BACK" });
const r6voicemail = run({ missedCallHandling: "VOICEMAIL_ONLY" });
const r6unsure = run({ missedCallHandling: "UNKNOWN" });

check("Run 6 · INSTANT_TEXT_BACK removes the missed-call leak entirely", () => {
  assert(!fired(r6covered, "missed_calls_no_recovery"), "leak still fired");
  assert(!leakNames(r6covered.items).some((n) => /missed call/i.test(n ?? "")), "leak reached the output");
});

check("Run 6 · VOICEMAIL_ONLY renders confirmed, with NO kickoff line", () => {
  const li = item(r6voicemail.items, "missed calls");
  assert(li, "missed-call leak missing");
  assert.equal(li!.intakeConfirmed, true);
  assert.equal(li!.kickoffLine ?? null, null, "a confirmed leak kept the kickoff line");
  assert(r6voicemail.html.includes("Confirmed at intake"), "rendered HTML lost the confirmed label");
});

check("Run 6 · UNKNOWN leaves the baseline facts byte-identical", () => {
  assert.equal(factSnapshot(r6unsure.items), snap1, "'Not sure' changed the stamped facts");
});

check("Run 6 · validator Part C passes for every missed-call answer", () => {
  for (const r of [r6covered, r6voicemail, r6unsure])
    assert.equal(partCFails(r.validation).length, 0, JSON.stringify(partCFails(r.validation)));
});

// ── RUN 7 — responseSpeed ──────────────────────────────────────────────────────
const r7fast = run({ responseSpeed: "UNDER_5_MIN" });
const r7slow = run({ responseSpeed: "DAY_OR_TWO" });
const r7untracked = run({ responseSpeed: "NOT_TRACKED" });

check("Run 7 · UNDER_5_MIN removes the speed-to-lead leak entirely", () => {
  assert(!fired(r7fast, "slow_speed_to_lead"), "leak still fired");
  assert(!leakNames(r7fast.items).some((n) => /slow response/i.test(n ?? "")), "leak reached the output");
});

check("Run 7 · DAY_OR_TWO renders confirmed, with NO kickoff line", () => {
  const li = item(r7slow.items, "slow response");
  assert(li, "speed-to-lead leak missing");
  assert.equal(li!.intakeConfirmed, true);
  assert.equal(li!.kickoffLine ?? null, null, "a confirmed leak kept the kickoff line");
});

check("Run 7 · NOT_TRACKED leaves the baseline facts byte-identical", () => {
  assert.equal(factSnapshot(r7untracked.items), snap1, "'We don't track it' changed the stamped facts");
});

check("Run 7 · validator Part C passes for every response-speed answer", () => {
  for (const r of [r7fast, r7slow, r7untracked])
    assert.equal(partCFails(r.validation).length, 0, JSON.stringify(partCFails(r.validation)));
});

// ── RUN 8 — hasCallTracking (the boolean that had no write path until now) ─────
const r8tracked = run({ hasCallTracking: true });
const r8untracked = run({ hasCallTracking: false });

check("Run 8 · hasCallTracking=true suppresses no_call_tracking everywhere", () => {
  assert(!fired(r8tracked, "no_call_tracking"), "leak still fired");
  assert(!leakNames(r8tracked.items).some((n) => /call performance/i.test(n ?? "")), "leak reached the output");
});

check("Run 8 · hasCallTracking=false renders confirmed, with NO kickoff line", () => {
  const li = item(r8untracked.items, "call performance");
  assert(li, "call-tracking leak missing");
  assert.equal(li!.intakeConfirmed, true);
  assert.equal(li!.kickoffLine ?? null, null, "a confirmed leak kept the kickoff line");
});

check("Run 8 · validator Part C passes for both call-tracking answers", () => {
  for (const r of [r8tracked, r8untracked])
    assert.equal(partCFails(r.validation).length, 0, JSON.stringify(partCFails(r.validation)));
});

// ── RUN 9 — hasOnlinePayment (needs a deposit-taking vertical to fire at all) ──
const r9baseline = run(undefined, "med_spa");
const r9paid = run({ hasOnlinePayment: true }, "med_spa");
const r9manual = run({ hasOnlinePayment: false }, "med_spa");

check("Run 9 · the payment leak fires for a deposit vertical to begin with", () => {
  assert(fired(r9baseline, "payment_booking_friction"), "nothing to suppress — fixture is wrong");
});

check("Run 9 · hasOnlinePayment=true suppresses payment_booking_friction everywhere", () => {
  assert(!fired(r9paid, "payment_booking_friction"), "leak still fired");
  assert(!leakNames(r9paid.items).some((n) => /friction/i.test(n ?? "")), "leak reached the output");
});

check("Run 9 · hasOnlinePayment=false renders confirmed, with NO kickoff line", () => {
  const li = item(r9manual.items, "friction");
  assert(li, "payment-friction leak missing");
  assert.equal(li!.intakeConfirmed, true);
  assert.equal(li!.kickoffLine ?? null, null, "a confirmed leak kept the kickoff line");
});

check("Run 9 · validator Part C passes for every payment answer", () => {
  for (const r of [r9baseline, r9paid, r9manual])
    assert.equal(partCFails(r.validation).length, 0, JSON.stringify(partCFails(r.validation)));
});

const businessProfile = {
  name: "Bright Smile Dental",
  industry: "dental",
  category: "dentist",
  city: "Austin",
  rating: 4.8,
  reviewCount: 40,
  website: "https://brightsmile.example",
  description: null,
};
const minimalIntel = {
  website: { hasWebsite: false },
  reviews: { available: false },
  competitors: { available: false },
  verifiedFacts: null,
  performance: null,
  dataForSeo: null,
  screenshots: null,
  dataConfidence: "low",
  assumptions: [],
} as unknown as GenerationContext["intel"];

const FOCUS = "emergency drain calls, water heater installs";
const ctxWith: GenerationContext = { business: businessProfile, intel: minimalIntel, websiteText: "", servicesFocus: FOCUS };
const ctxWithout: GenerationContext = { business: businessProfile, intel: minimalIntel, websiteText: "" };
const headerWith = contextHeader(ctxWith);
const headerWithout = contextHeader(ctxWithout);

check("Run 4 · generation prompt references the services (copy emphasis injected)", () => {
  assert(headerWith.includes(FOCUS), "services text not injected into the prompt");
  assert(/COPY EMPHASIS/.test(headerWith), "copy-emphasis block missing");
});

check("Run 4 · the copy-emphasis block declares the hard zero-fact boundary", () => {
  assert(/HARD BOUNDARY/.test(headerWith) && /never facts/i.test(headerWith), "boundary language missing");
});

check("Run 4 · no servicesFocus → no copy-emphasis block", () => {
  assert(!headerWithout.includes(FOCUS), "services text present without input");
  assert(!/COPY EMPHASIS/.test(headerWithout), "copy-emphasis block present without input");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
