/**
 * Governance test suite for the closed leak taxonomy (Phases 1–6).
 *
 * Offline, no API calls. Runs the detection engine over hand-built ScrapeData
 * fixtures and asserts:
 *   1. Detection unit tests   — specific leaks fire at the expected evidence tier.
 *   2. Three golden fixtures  — a dentist, a roofer, and a law firm snapshot their
 *                               fired leaks / tiers / ranking / most-provable top-3
 *                               (selectColdAudit, which survives as the paid pack's
 *                               pre-call context) / deterministic grading.
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
import {
  ASSUMPTIONS,
  LEAKS,
  STATS,
  gradeOf,
  type EvidenceGrade,
  type EvidenceTier,
  type ScrapeData,
} from "@/lib/leak-taxonomy";
import {
  statGuard,
  voiceLint,
  allowedNumbersFor,
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedStatPhrase,
  shortSource,
  computeMathEstimate,
  reconcileLeakTotal,
  softenFlatAssertions,
  flatAssertionLint,
  PROTECTED_MARKERS,
  ASSUMPTION_CAVEAT,
  USD_TO_CAD,
} from "@/lib/leak-narrative";
import { formatCurrency } from "@/lib/utils";
import { validatePack } from "@/lib/exporters/validate-pack";
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

/** The evidence GRADE a fire carries — measured / told / guessed. Read off the
 *  fire rather than recomputed, because that is the property under test: the
 *  grade is derived once, in getFiredLeaks, and carried from there. */
function fireGrade(fired: FiredLeak[], id: string): EvidenceGrade | null {
  return fired.find((f) => f.leak.id === id)?.grade ?? null;
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

test("lawFirm: count near competitor median → low_review_velocity does NOT fire", () => {
  assert.ok(!fireIds(getFiredLeaks(lawFirm)).has("low_review_velocity"));
});

test("lawFirm: appointment vertical, no reminder visible → no_show_exposure BENCHMARK", () => {
  assert.strictEqual(tierOf(getFiredLeaks(lawFirm), "no_show_exposure"), "BENCHMARK");
});

// The old `unanswered_reviews` tests are gone with the leak. It could never fire
// — nothing in the pipeline supplies an owner-reply rate — so it was removed.
//
// WHAT CHANGED IN PHASE 3, AND WHY THIS TEST GOT STRONGER RATHER THAN SOFTER.
// The old comment here ended "…and the Review Response workflow now rides on
// low_review_velocity's ghlFix". That is no longer the whole truth: the subject
// came back as `no_review_replies`, sourced from the one place the fact actually
// exists — the client's own answer — and Review Response now cites both leaks.
//
// So the original assertion STAYS (a deleted id must stay deleted: reusing it
// would make a pack saved before the deletion look like it carried this finding),
// and three assertions are added around it, each one a way the reinstatement could
// quietly become the leak that had to be deleted:
//   · the new leak must not be the old id under a new name;
//   · it must NOT fire on a cold scan, on any of the three golden fixtures, none
//     of which has intake — that is the exact failure that killed the old one;
//   · and it must never be able to claim OBSERVED, because we measure nothing here.
test("unanswered_reviews is no longer a leak id at all", () => {
  assert.ok(!LEAK_IDS.has("unanswered_reviews"));
  for (const data of [dentist, roofer, lawFirm])
    assert.ok(!fireIds(getFiredLeaks(data)).has("unanswered_reviews"));
});

test("no_review_replies replaced it under a NEW id, and cannot fire off a cold scan", () => {
  assert.ok(LEAK_IDS.has("no_review_replies"), "the reinstated review finding is missing");
  assert.ok(
    !LEAK_IDS.has("unanswered_reviews"),
    "the deleted id is back — a pack saved before the deletion would now look like it carried this finding"
  );
  // None of the three golden fixtures has intake, which is what a cold pre-sale
  // scan looks like. Nothing we fetch carries an owner-reply signal, so firing
  // here would be a finding manufactured out of an unasked question.
  for (const data of [dentist, roofer, lawFirm])
    assert.ok(
      !fireIds(getFiredLeaks(data)).has("no_review_replies"),
      "no_review_replies fired with no intake — the exact defect that deleted unanswered_reviews"
    );
});

test("no_review_replies fires ONLY on the client's answer, and only ever as disclosed", () => {
  const told: ScrapeData = { ...dentist, intake: { reviewReplyOwner: "NOBODY" } };
  const fired = getFiredLeaks(told).find((f) => f.leak.id === "no_review_replies");
  assert.ok(fired, "the client told us nobody replies and the finding did not fire");
  assert.strictEqual(fired!.grade, "disclosed", "the finding claims a grade above what we know");
  assert.strictEqual(fired!.intakeConfirmed, true);
  // Somebody replying takes it off the list. Telling a client his reviews go
  // unanswered right after he told us he answers them is the insult the whole
  // intake contract exists to prevent.
  for (const answer of ["OWNER", "STAFF_OR_AGENCY"] as const) {
    const replying: ScrapeData = { ...dentist, intake: { reviewReplyOwner: answer } };
    assert.ok(
      !fireIds(getFiredLeaks(replying)).has("no_review_replies"),
      `reviewReplyOwner=${answer} did not suppress the finding`
    );
  }
  // The grade ceiling, from the taxonomy rather than from a run: INVISIBLE means
  // no code path may ever write it as something we saw.
  const leak = LEAKS.find((l) => l.id === "no_review_replies")!;
  assert.strictEqual(leak.evidenceClass, "INVISIBLE");
  assert.ok(
    !leak.deliverableTargets.includes("cold_audit"),
    "the most-provable (cold_audit-target) selection advertises a finding a pre-sale detection can never produce"
  );
});

test("the two unfireable out-of-scope leaks are deleted", () => {
  assert.ok(!LEAK_IDS.has("oos_dated_site_design"));
  assert.ok(!LEAK_IDS.has("oos_gbp_visibility_gaps"));
});

// A6b — no_call_tracking used to ignore its argument and fire for everyone.
test("no_call_tracking fires pre-intake but is suppressed by intake", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_call_tracking"), "BENCHMARK");
  const tracked: ScrapeData = { ...dentist, intake: { hasCallTracking: true } };
  assert.ok(!fireIds(getFiredLeaks(tracked)).has("no_call_tracking"));
});

// A6e — payment_booking_friction is an inference, and intake can contradict it.
test("payment_booking_friction is suppressed when intake reports online payment", () => {
  const paid: ScrapeData = { ...roofer, intake: { hasOnlinePayment: true } };
  assert.ok(!fireIds(getFiredLeaks(paid)).has("payment_booking_friction"));
});

// ── The three multiple-choice intake answers ──────────────────────────────────
// Each one has to prove all three branches of the contract: the "handled" answer
// suppresses the leak entirely, a "not handled" answer confirms it (declarative,
// no kickoff hedge), and "not sure" leaves today's benchmark hedge untouched.

// Helper: the fired leak, so a test can assert on tier AND intakeConfirmed together.
const firedLeak = (data: ScrapeData, id: string): FiredLeak | undefined =>
  getFiredLeaks(data).find((f) => f.leak.id === id);
const withIntake = (base: ScrapeData, intake: ScrapeData["intake"]): ScrapeData => ({
  ...base,
  intake,
});

test("afterHoursHandling: AUTO_RESPONSE suppresses no_after_hours_coverage entirely", () => {
  // The dentist fires it OBSERVED (limited hours, no booking, no chat). An
  // after-hours auto-response is the fix, so having it takes the leak off the list
  // even though the observable absence is still there.
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_after_hours_coverage"), "OBSERVED");
  const covered = withIntake(dentist, { afterHoursHandling: "AUTO_RESPONSE" });
  assert.ok(!fireIds(getFiredLeaks(covered)).has("no_after_hours_coverage"));
});

test("afterHoursHandling: NOTHING and NEXT_MORNING both confirm it, in different words", () => {
  const nothing = firedLeak(withIntake(dentist, { afterHoursHandling: "NOTHING" }), "no_after_hours_coverage");
  const morning = firedLeak(withIntake(dentist, { afterHoursHandling: "NEXT_MORNING" }), "no_after_hours_coverage");
  assert.ok(nothing && morning, "leak did not fire on a confirming answer");
  assert.strictEqual(nothing!.intakeConfirmed, true);
  assert.strictEqual(morning!.intakeConfirmed, true);
  // The two answers are different situations and must not read identically…
  assert.notStrictEqual(nothing!.evidence[0], morning!.evidence[0]);
  assert.ok(/next morning/i.test(morning!.evidence[0]), morning!.evidence[0]);
  // …but neither invents a number: the dollar figure is byte-identical, because
  // no cited stat prices "answered next morning" against "never answered".
  const nothingMath = computeMathEstimate("after_hours_value", withIntake(dentist, { afterHoursHandling: "NOTHING" }));
  const morningMath = computeMathEstimate("after_hours_value", withIntake(dentist, { afterHoursHandling: "NEXT_MORNING" }));
  assert.deepStrictEqual(morningMath, nothingMath, "the prose difference leaked into the math");
});

test("afterHoursHandling: UNKNOWN keeps today's hedge (unconfirmed, kickoff line intact)", () => {
  const unsure = firedLeak(withIntake(dentist, { afterHoursHandling: "UNKNOWN" }), "no_after_hours_coverage");
  const noIntake = firedLeak(dentist, "no_after_hours_coverage");
  assert.ok(unsure && noIntake);
  assert.strictEqual(unsure!.tier, noIntake!.tier);
  assert.ok(!unsure!.intakeConfirmed, "'Not sure' must not confirm anything");
  assert.deepStrictEqual(unsure!.evidence, noIntake!.evidence);
});

test("missedCallHandling: INSTANT_TEXT_BACK suppresses missed_calls_no_recovery entirely", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "missed_calls_no_recovery"), "BENCHMARK");
  const covered = withIntake(dentist, { missedCallHandling: "INSTANT_TEXT_BACK" });
  assert.ok(!fireIds(getFiredLeaks(covered)).has("missed_calls_no_recovery"));
});

test("missedCallHandling: the client's answer outranks the review proxy", () => {
  // The roofer's reviews complain about response, not missed calls, so build a
  // fixture whose reviews WOULD lift this leak to EVIDENCED, then contradict it.
  const complained: ScrapeData = {
    ...dentist,
    googleReviews: {
      ...dentist.googleReviews!,
      reviewTexts: ["No one answered when I called twice.", "Left a voicemail, never heard anything."],
    },
  };
  assert.strictEqual(tierOf(getFiredLeaks(complained), "missed_calls_no_recovery"), "EVIDENCED");
  const covered = withIntake(complained, { missedCallHandling: "INSTANT_TEXT_BACK" });
  assert.ok(
    !fireIds(getFiredLeaks(covered)).has("missed_calls_no_recovery"),
    "told they lack a recovery path they told us they have"
  );
  // And when the answer AGREES with the reviews, both provenances are carried.
  const confirmed = firedLeak(withIntake(complained, { missedCallHandling: "VOICEMAIL_ONLY" }), "missed_calls_no_recovery");
  assert.strictEqual(confirmed!.tier, "EVIDENCED");
  assert.strictEqual(confirmed!.intakeConfirmed, true);
  assert.ok(/Confirmed at intake/i.test(confirmed!.evidence[0]));
});

test("missedCallHandling: VOICEMAIL_ONLY confirms it even when the site says 'text us'", () => {
  // The roofer mentions texting, so the scan-based branch stays silent — the
  // client's own answer about what happens to a missed call has to fire it.
  assert.ok(!fireIds(getFiredLeaks(roofer)).has("missed_calls_no_recovery"));
  const confirmed = firedLeak(withIntake(roofer, { missedCallHandling: "VOICEMAIL_ONLY" }), "missed_calls_no_recovery");
  assert.ok(confirmed, "a confirmed missed-call gap did not fire");
  assert.strictEqual(confirmed!.intakeConfirmed, true);
  assert.strictEqual(confirmed!.tier, "BENCHMARK");
});

test("missedCallHandling: UNKNOWN keeps today's hedge", () => {
  const unsure = firedLeak(withIntake(dentist, { missedCallHandling: "UNKNOWN" }), "missed_calls_no_recovery");
  const noIntake = firedLeak(dentist, "missed_calls_no_recovery");
  assert.ok(unsure && noIntake);
  assert.ok(!unsure!.intakeConfirmed);
  assert.deepStrictEqual(unsure!.evidence, noIntake!.evidence);
});

test("responseSpeed: UNDER_5_MIN suppresses slow_speed_to_lead entirely", () => {
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "slow_speed_to_lead"), "BENCHMARK");
  assert.strictEqual(tierOf(getFiredLeaks(roofer), "slow_speed_to_lead"), "EVIDENCED");
  for (const data of [dentist, roofer]) {
    const fast = withIntake(data, { responseSpeed: "UNDER_5_MIN" });
    assert.ok(!fireIds(getFiredLeaks(fast)).has("slow_speed_to_lead"));
  }
});

test("responseSpeed: FEW_HOURS / DAY_OR_TWO confirm it with no form fingerprint needed", () => {
  // A site we could not confirm a form on: the scan branch cannot fire, but the
  // client told us how long an enquiry waits, which is true however it arrived.
  const noForm: ScrapeData = {
    ...dentist,
    website: { ...dentist.website!, hasContactForm: "UNKNOWN" },
  };
  assert.ok(!fireIds(getFiredLeaks(noForm)).has("slow_speed_to_lead"));
  for (const answer of ["FEW_HOURS", "DAY_OR_TWO"] as const) {
    const f = firedLeak(withIntake(noForm, { responseSpeed: answer }), "slow_speed_to_lead");
    assert.ok(f, `${answer} did not fire the leak`);
    assert.strictEqual(f!.intakeConfirmed, true, answer);
    assert.ok(/Confirmed at intake/i.test(f!.evidence[0]), f!.evidence[0]);
  }
});

test("responseSpeed: NOT_TRACKED keeps today's hedge", () => {
  const untracked = firedLeak(withIntake(dentist, { responseSpeed: "NOT_TRACKED" }), "slow_speed_to_lead");
  const noIntake = firedLeak(dentist, "slow_speed_to_lead");
  assert.ok(untracked && noIntake);
  assert.ok(!untracked!.intakeConfirmed, "'We don't track it' must not confirm anything");
  assert.deepStrictEqual(untracked!.evidence, noIntake!.evidence);
});

test("hasCallTracking / hasOnlinePayment: false CONFIRMS, null hedges", () => {
  const noTracking = firedLeak(withIntake(dentist, { hasCallTracking: false }), "no_call_tracking");
  assert.strictEqual(noTracking!.intakeConfirmed, true);
  assert.ok(!firedLeak(dentist, "no_call_tracking")!.intakeConfirmed);
  const noPayment = firedLeak(withIntake(roofer, { hasOnlinePayment: false }), "payment_booking_friction");
  assert.strictEqual(noPayment!.intakeConfirmed, true);
  assert.ok(!firedLeak(roofer, "payment_booking_friction")!.intakeConfirmed);
});

// ── The two questions that closed the last STRUCTURAL evidence gaps ───────────
// A "structural" gap was a leak that could NEVER stop being a guess, because no
// question on the form could confirm what it claims — so the deliverable hedged it
// forever however thorough the kickoff call was. These two close the last of them,
// and each is held to the same three-branch contract as the three handling
// questions above: a suppressing answer, a confirming answer, and no answer.
//
// NEITHER FIELD HAS AN EXPLICIT "not sure" SLUG, unlike the three above. That is
// deliberate, not an omission — both ask about a fact an owner knows about his own
// business — so the third branch here is the question going unasked, which is the
// state almost every client starts in.

// The dentist links to nothing social, so social_dm_unmanaged cannot fire off the
// scan alone. This is the same business with an Instagram link, which is what makes
// the SUPPRESS branch below testable: a leak that never fired cannot be suppressed.
const socialDentist: ScrapeData = {
  ...dentist,
  website: { ...dentist.website!, linksToInstagram: true },
};

test("socialEnquiries: NO and NO_ACCOUNTS BOTH suppress social_dm_unmanaged entirely", () => {
  // There is no leak in a channel that brings no enquiries — true whether the
  // accounts are quiet or absent. (The two answers are NOT interchangeable for the
  // BUILD: only NO_ACCOUNTS switches the Social DM Capture workflow off. That
  // distinction lives in the catalogue and is proved in scripts/verify-phase2.ts.)
  assert.ok(fireIds(getFiredLeaks(socialDentist)).has("social_dm_unmanaged"));
  for (const answer of ["NO", "NO_ACCOUNTS"] as const) {
    const quiet = withIntake(socialDentist, { socialEnquiries: answer });
    assert.ok(
      !fireIds(getFiredLeaks(quiet)).has("social_dm_unmanaged"),
      `socialEnquiries "${answer}" left the leak on the report`
    );
  }
});

test("socialEnquiries: YES confirms it — even with no social link anywhere on the site", () => {
  // A business can take Instagram DMs without ever linking the profile from its
  // website, and the client just told us enquiries arrive that way.
  assert.ok(!fireIds(getFiredLeaks(dentist)).has("social_dm_unmanaged"));
  const confirmed = firedLeak(withIntake(dentist, { socialEnquiries: "YES" }), "social_dm_unmanaged");
  assert.ok(confirmed, "a confirmed social-DM gap did not fire without a social link");
  assert.strictEqual(confirmed!.intakeConfirmed, true);
  assert.strictEqual(confirmed!.grade, "disclosed");
  assert.ok(/Confirmed at intake/i.test(confirmed!.evidence[0]), confirmed!.evidence[0]);
  // With the link present the scan line is kept, but the kickoff-verification tail
  // comes off: they answered the question, so there is nothing left to verify.
  const withLink = firedLeak(withIntake(socialDentist, { socialEnquiries: "YES" }), "social_dm_unmanaged");
  assert.ok(/Active on Instagram/.test(withLink!.evidence.join(" ")), withLink!.evidence.join(" "));
  assert.ok(!/verified at kickoff/i.test(withLink!.evidence.join(" ")), "the answered leak still asks to verify at kickoff");
});

test("socialEnquiries: not asked keeps today's hedge", () => {
  const unasked = firedLeak(socialDentist, "social_dm_unmanaged");
  const empty = firedLeak(withIntake(socialDentist, {}), "social_dm_unmanaged");
  assert.ok(unasked && empty);
  assert.ok(!unasked!.intakeConfirmed, "an unasked question confirmed something");
  assert.strictEqual(unasked!.grade, "inferred");
  assert.ok(/verified at kickoff/i.test(unasked!.evidence.join(" ")));
  assert.deepStrictEqual(empty!.evidence, unasked!.evidence);
});

test("pastCustomerContact: SYSTEMATIC suppresses no_database_reactivation entirely", () => {
  // A list contacted within the last month, systematically, IS the campaign this
  // leak sells. Selling it to them anyway is selling something they already run.
  assert.strictEqual(tierOf(getFiredLeaks(dentist), "no_database_reactivation"), "BENCHMARK");
  const worked = withIntake(dentist, { pastCustomerContact: "SYSTEMATIC" });
  assert.ok(!fireIds(getFiredLeaks(worked)).has("no_database_reactivation"));
});

test("pastCustomerContact: the three dormancy answers confirm it, in three different sentences", () => {
  const lines = new Set<string>();
  for (const answer of ["OCCASIONAL", "OVER_A_YEAR", "NEVER"] as const) {
    const f = firedLeak(withIntake(dentist, { pastCustomerContact: answer }), "no_database_reactivation");
    assert.ok(f, `${answer} did not fire the leak`);
    assert.strictEqual(f!.intakeConfirmed, true, answer);
    assert.strictEqual(f!.grade, "disclosed", answer);
    assert.ok(/Confirmed at intake/i.test(f!.evidence[0]), f!.evidence[0]);
    lines.add(f!.evidence[0]);
  }
  // A list contacted "occasionally" is not a list nobody has ever touched. Each
  // answer says back to the client exactly what they told us happens.
  assert.strictEqual(lines.size, 3, "two dormancy answers read identically back at the client");
});

test("pastCustomerContact: not asked keeps today's hedge", () => {
  const unasked = firedLeak(dentist, "no_database_reactivation");
  const empty = firedLeak(withIntake(dentist, {}), "no_database_reactivation");
  assert.ok(unasked && empty);
  assert.ok(!unasked!.intakeConfirmed, "an unasked question confirmed something");
  assert.strictEqual(unasked!.grade, "inferred");
  assert.ok(/verified at kickoff/i.test(unasked!.evidence.join(" ")));
  assert.deepStrictEqual(empty!.evidence, unasked!.evidence);
});

test("pastCustomerContact vs hasPastCustomerDatabase: no list at all outranks 'the list is cold'", () => {
  // TWO QUESTIONS, TWO JOBS. hasPastCustomerDatabase asks "is there a list?" — the
  // applicability fact — and has INVERSE polarity: `false` suppresses the leak and
  // `true` is what makes it fire, so it could only ever take the leak OFF the
  // report and could never confirm the claim it actually makes. pastCustomerContact
  // asks "is that list going cold?", which IS the claim. A list that does not exist
  // cannot be dormant, so "no list" has to win.
  const noList = withIntake(dentist, { hasPastCustomerDatabase: false, pastCustomerContact: "NEVER" });
  assert.ok(!fireIds(getFiredLeaks(noList)).has("no_database_reactivation"));
  const hasList = withIntake(dentist, { hasPastCustomerDatabase: true, pastCustomerContact: "NEVER" });
  assert.strictEqual(firedLeak(hasList, "no_database_reactivation")!.grade, "disclosed");
});

// A confirmed leak states the gap as fact. It does NOT invent the volume needed to
// price it: the REAL/BENCHMARK switch tracks the client's NUMBERS, nothing else.
test("a confirmed leak with no volume number still uses the labelled assumption", () => {
  const confirmedNoNumbers = withIntake(dentist, { missedCallHandling: "VOICEMAIL_ONLY" });
  const est = computeMathEstimate("missed_call_value", confirmedNoNumbers)!;
  assert.strictEqual(est.mode, "BENCHMARK");
  assert.ok(est.frame.includes(ASSUMPTION_CAVEAT), est.frame);
  assert.ok(!/based on the numbers you provided/i.test(est.frame), est.frame);
  // Same confirmation, plus their real numbers → the "your numbers" path.
  const confirmedWithNumbers = withIntake(dentist, {
    missedCallHandling: "VOICEMAIL_ONLY",
    monthlyEnquiries: 60,
    avgJobValueCad: 900,
  });
  const real = computeMathEstimate("missed_call_value", confirmedWithNumbers)!;
  assert.strictEqual(real.mode, "REAL");
  assert.ok(/based on the numbers you provided/i.test(real.frame), real.frame);
});

// F4/A4 — the two volume slots hold what their names say. Feeding one must never
// print its number under the other's label; that aliasing is how a client's
// enquiry count once got read back to them as their booking count.
test("renamed volume slots feed the template whose label matches them", () => {
  const enquiriesOnly = withIntake(dentist, { monthlyEnquiries: 60, avgJobValueCad: 900 });
  const missed = computeMathEstimate("missed_call_value", enquiriesOnly)!;
  assert.strictEqual(missed.mode, "REAL");
  assert.ok(missed.frame.includes("60 enquiries/mo"), missed.frame);
  // No booking count was given, so no_show_value must NOT quantify — least of all
  // by reusing the enquiry count.
  const noShow = computeMathEstimate("no_show_value", enquiriesOnly);
  assert.ok(!noShow?.dollarHigh, "no_show_value invented a booked-appointment count");
  assert.ok(!(noShow?.frame ?? "").includes("60 booked"), noShow?.frame);

  const bookedOnly = withIntake(dentist, { monthlyBookedAppointments: 25, avgJobValueCad: 900 });
  const noShowReal = computeMathEstimate("no_show_value", bookedOnly)!;
  assert.strictEqual(noShowReal.mode, "REAL");
  assert.ok(noShowReal.frame.includes("25 booked/mo"), noShowReal.frame);
  // …and the booking count must never be spent as an enquiry count.
  const missedFromBooked = computeMathEstimate("missed_call_value", bookedOnly)!;
  assert.strictEqual(missedFromBooked.mode, "BENCHMARK");
  assert.ok(!missedFromBooked.frame.includes("25 enquiries"), missedFromBooked.frame);
});

// A6 — the FX rate is a labelled ASSUMPTION now, not a bare constant.
test("the USD→CAD rate is an ASSUMPTIONS entry and every CPL sentence says so", () => {
  assert.strictEqual(USD_TO_CAD, ASSUMPTIONS.usd_to_cad.value);
  assert.strictEqual(USD_TO_CAD, 1.35);
  assert.ok(/not measured/i.test(ASSUMPTIONS.usd_to_cad.rationale));
  assert.ok(/not cited/i.test(ASSUMPTIONS.usd_to_cad.rationale));
  assert.ok(/2026-07-26/.test(ASSUMPTIONS.usd_to_cad.rationale), "the date it was set is missing");
  // Dental CPL is USD $84 → floor(84 × 1.35) = CAD $113: the conversion rounds
  // DOWN, so it can only ever understate the leak.
  const est = computeMathEstimate("missed_call_value", dentist)!;
  assert.ok(est.frame.includes(`CAD $${Math.floor(84 * USD_TO_CAD)}`), est.frame);
  for (const sentence of est.frame.split(/(?<=[.!?])\s+/)) {
    if (!/replacement cost per lead/.test(sentence)) continue;
    assert.ok(sentence.includes(ASSUMPTION_CAVEAT), `converted CPL rendered unlabelled: ${sentence}`);
  }
});

// A2 — the after-hours frame is a labelled SUBSET, never a second figure.
test("after-hours math declares its overlap and is excluded from the total", () => {
  const withIntake: ScrapeData = {
    ...dentist,
    intake: { monthlyEnquiries: 100, avgJobValueCad: 1000 },
  };
  const missed = computeMathEstimate("missed_call_value", withIntake)!;
  const after = computeMathEstimate("after_hours_value", withIntake)!;
  assert.strictEqual(after.overlapsWith, "missed_calls_no_recovery");
  assert.ok(after.overlapNote && after.overlapNote.length > 0);
  assert.notStrictEqual(after.dollarHigh, missed.dollarHigh); // not the same figure
  assert.ok(after.dollarHigh! < missed.dollarHigh!); // a slice of it

  const inputs = buildLeakInputs(reportLeaks(getFiredLeaks(withIntake)), withIntake);
  const total = reconcileLeakTotal(inputs);
  const naive = inputs.reduce((s, i) => s + (i.dollar?.high ?? 0), 0);
  if (inputs.some((i) => i.overlapsWith)) {
    assert.ok(total.excluded.includes("no_after_hours_coverage"));
    assert.ok(total.high < naive, "overlapping frame was still summed");
    assert.ok(total.disclosure.length > 0, "no overlap disclosure produced");
  }
});

// A3 — an assumption-backed number is labelled in the SAME sentence.
test("benchmark math labels its assumed volume in-sentence", () => {
  const est = computeMathEstimate("missed_call_value", dentist)!;
  assert.ok(est.frame.includes("20 enquiries a month"), est.frame);
  assert.ok(est.frame.includes(ASSUMPTION_CAVEAT), est.frame);
});

// A4 — every client-facing dollar string carries the CAD marker.
test("math frames render CAD, never a bare $", () => {
  const est = computeMathEstimate("missed_call_value", dentist)!;
  const bareDollars = est.frame.match(/(?<!CAD )\$\d/g) ?? [];
  assert.strictEqual(bareDollars.length, 0, `un-marked dollar figure: ${est.frame}`);
  assert.strictEqual(formatCurrency(1000), "CAD $1,000");
});

// A1 — tier-awareness and provenance markers must never hedge a stated fact.
test("softenFlatAssertions leaves OBSERVED / intake-confirmed text byte-identical", () => {
  const flat = "There is no follow-up after the first call.";
  assert.notStrictEqual(softenFlatAssertions(flat), flat); // still softens by default
  assert.strictEqual(softenFlatAssertions(flat, { tier: "OBSERVED" }), flat);
  assert.strictEqual(softenFlatAssertions(flat, { intakeConfirmed: true }), flat);
});

test("softenFlatAssertions never hedges a sentence carrying its own provenance", () => {
  for (const marker of [
    "You told us there is no follow-up after the first call.",
    "Confirmed at intake: there is no follow-up after the first call.",
    "You said there is no follow-up after the first call.",
    "We measured it — there is no follow-up after the first call.",
    "Based on the numbers you provided, there is no follow-up after the first call.",
  ]) {
    assert.strictEqual(softenFlatAssertions(marker), marker, marker);
    assert.ok(flatAssertionLint(marker).ok, marker);
  }
});

test("flatAssertionLint still catches a genuinely unhedged inferred claim", () => {
  const res = flatAssertionLint("There is no follow-up after the first call.");
  assert.ok(!res.ok && res.hits.length === 1);
});

test("PROTECTED_MARKERS is exported and covers the mandated disclosures", () => {
  assert.ok(Array.isArray(PROTECTED_MARKERS) && PROTECTED_MARKERS.length >= 5);
  for (const probe of [
    "you told us",
    "confirmed at intake",
    "you confirmed",
    "we measured",
    "based on the numbers you provided",
  ]) {
    assert.ok(PROTECTED_MARKERS.some((re) => re.test(probe)), probe);
  }
});

// ── Phase 1 · THE EVIDENCE GRADE ──────────────────────────────────────────────
// measured / told / guessed — the coarse honesty gate that decides how flatly a
// leak may be written. Every fire leaves getFiredLeaks carrying one, derived by
// gradeOf and never hand-set, so a leak's voice cannot drift away from what we
// actually know about it. The three paths below are the three grades, driven
// through the real detectors rather than asserted about gradeOf in isolation.

test("Grade: a leak we MEASURED ourselves is graded observed", () => {
  // No booking link on the site, none in the GBP profile — we looked, so we can
  // say so flatly.
  const fired = getFiredLeaks(dentist);
  assert.strictEqual(tierOf(fired, "no_online_booking"), "OBSERVED");
  assert.strictEqual(fireGrade(fired, "no_online_booking"), "observed");
});

test("Grade: a leak the client TOLD us about is graded disclosed", () => {
  // Same fixture, same leak, one answer added. Nothing about the scan changed.
  const fired = getFiredLeaks({ ...dentist, intake: { missedCallHandling: "VOICEMAIL_ONLY" } });
  assert.strictEqual(fireGrade(fired, "missed_calls_no_recovery"), "disclosed");
});

test("Grade: a leak we only GUESSED at is graded inferred", () => {
  const fired = getFiredLeaks(dentist);
  assert.strictEqual(tierOf(fired, "missed_calls_no_recovery"), "BENCHMARK");
  assert.strictEqual(fireGrade(fired, "missed_calls_no_recovery"), "inferred");
});

test("Grade: an EVIDENCED leak grades to inferred — the signal is observed, the conclusion is not", () => {
  // Two reviews describe an enquiry that got no reply. The REVIEWS are observed;
  // "they are slow to respond" is our inference from them, and nobody measured
  // this firm's reply time — so it may not be stated as a fact.
  const fired = getFiredLeaks(roofer);
  assert.strictEqual(tierOf(fired, "slow_speed_to_lead"), "EVIDENCED");
  assert.strictEqual(fireGrade(fired, "slow_speed_to_lead"), "inferred");
});

test("Grade: MEASURED BEATS TOLD — an OBSERVED leak the client also confirmed stays observed", () => {
  // They told us they only take bookings by phone AND we saw no booking path.
  // The measurement is the more defensible of the two, so it is the one we claim.
  const fired = getFiredLeaks({ ...dentist, intake: { bookingMethod: "PHONE_EMAIL_ONLY" } });
  const fire = fired.find((f) => f.leak.id === "no_online_booking");
  assert.strictEqual(fire?.intakeConfirmed, true);
  assert.strictEqual(fire?.grade, "observed");
});

test("Grade: one intake answer moves a leak from inferred to disclosed, without suppressing it", () => {
  // The whole point of the grade, in one test: the leak still fires, the tier is
  // unchanged, and the only thing that moved is how honestly we may write it.
  const before = getFiredLeaks(dentist);
  const after = getFiredLeaks({ ...dentist, intake: { missedCallHandling: "VOICEMAIL_ONLY" } });
  assert.strictEqual(fireGrade(before, "missed_calls_no_recovery"), "inferred");
  assert.strictEqual(fireGrade(after, "missed_calls_no_recovery"), "disclosed");
  assert.strictEqual(tierOf(after, "missed_calls_no_recovery"), "BENCHMARK", "the answer changed the tier, not just the grade");
  assert.strictEqual(after.length, before.length, "the answer suppressed or added a leak — the grade is not the only thing that moved");
});

test("Grade: every fire is graded, and the grade matches gradeOf on its own inputs", () => {
  // getFiredLeaks is the only place a fire is built, which makes it the only place
  // a grade is derived. Nothing downstream may recompute one.
  for (const data of [dentist, roofer, lawFirm]) {
    for (const f of getFiredLeaks(data)) {
      assert.ok(f.grade, `${f.leak.id} left the engine with no grade`);
      assert.strictEqual(
        f.grade,
        gradeOf({ tier: f.tier, intakeConfirmed: f.intakeConfirmed }),
        `${f.leak.id}: stamped grade disagrees with gradeOf on its own tier/confirmation`
      );
    }
  }
});

test("Grade: a missing grade is inferred — the safe default for every pre-Phase-1 pack", () => {
  assert.strictEqual(gradeOf({}), "inferred");
  assert.strictEqual(gradeOf({ tier: null, intakeConfirmed: null }), "inferred");
  assert.strictEqual(gradeOf({ intakeConfirmed: false }), "inferred");
});

test("Grade: the grade drives the softener — observed and disclosed are byte-identical, inferred is hedged", () => {
  const flat = "There is no follow-up after the first call.";
  assert.strictEqual(softenFlatAssertions(flat, { grade: "observed" }), flat);
  assert.strictEqual(softenFlatAssertions(flat, { grade: "disclosed" }), flat);
  assert.notStrictEqual(softenFlatAssertions(flat, { grade: "inferred" }), flat);
  assert.ok(flatAssertionLint(flat, { grade: "observed" }).ok);
  assert.ok(flatAssertionLint(flat, { grade: "disclosed" }).ok);
  assert.ok(!flatAssertionLint(flat, { grade: "inferred" }).ok);
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

// Part H2 (distinct discovery questions / pipeline probe) — DELETED 2026-08-01.
// `distinctDeeperQuestions` and `PIPELINE_DISCOVERY_QUESTION` lived in the
// cold-audit renderer, which was deleted with the whole pre-sale generative
// surface. The tests died with their subject; nothing surviving reads them.

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
