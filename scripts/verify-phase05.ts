/**
 * PHASE 0.5 PROOF — the five claims of this round, each demonstrated against the
 * REAL shipped code, offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase05.ts
 *   npm run verify:phase05
 *
 * Every check prints its own inputs and outputs so a reader can audit the claim
 * without trusting the assertion. Exits 1 if ANY check fails.
 *
 *   A. THE VALIDATOR BLOCKS      — a corrupted pack is refused by the enforcing
 *                                  entry point (assertPackValid) AND by the ZIP
 *                                  boundary (buildAssetZipChecked); the committed
 *                                  golden sample passes both.
 *   B. SOFTENING IS TIER-AWARE   — a sentence that WOULD be hedged comes back
 *                                  byte-identical once its provenance is known
 *                                  (intake-confirmed / OBSERVED tier / a
 *                                  disclosure marker in the sentence), and is
 *                                  still hedged when nothing licenses it.
 *   C. NO DOUBLE-COUNT           — after-hours is a SLICE of missed calls, so the
 *                                  reconciled total is strictly below the naive
 *                                  sum, names what it dropped, and says why.
 *   D. NO USD LEAKAGE            — every dollar string the math layer emits is
 *                                  marked CAD, and no raw USD benchmark reaches a
 *                                  frame unconverted.
 *   E. ASSUMPTIONS ARE LABELLED  — every entry in ASSUMPTIONS is named as an
 *                                  assumption in the SAME SENTENCE as its number.
 */

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeMathEstimate,
  buildLeakInputs,
  reconcileLeakTotal,
  softenFlatAssertions,
  flatAssertionLint,
  cad,
  assumptionPhrase,
  ASSUMPTION_CAVEAT,
  AFTER_HOURS_SHARE_PCT,
  USD_TO_CAD,
  PROTECTED_MARKERS,
  type LeakInput,
  type MathEstimate,
} from "@/lib/leak-narrative";
import { ASSUMPTIONS, type ScrapeData, type Vertical } from "@/lib/leak-taxonomy";
import { getFiredLeaks, reportLeaks } from "@/lib/leak-detection";
import { assertPackValid } from "@/lib/exporters/validate-pack";
import { buildAssetZipChecked } from "@/lib/exporters";
import { formatCurrency } from "@/lib/utils";
import type { AssetPack } from "@/types";

// ── harness ───────────────────────────────────────────────────────────────────
// Same shape as scripts/leak-detection.test.ts / scripts/verify-intake.ts: a
// counting check() that never throws, plus an explicit PASS/FAIL word on every
// line so the output is greppable by a human and by CI alike.
let passed = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn();
    if (r instanceof Promise) throw new Error("use acheck() for async assertions");
    passed += 1;
    console.log(`  PASS ✓  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ✗  ${name}`);
    console.log(`          ${(err as Error).message}`);
  }
}

async function acheck(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS ✓  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ✗  ${name}`);
    console.log(`          ${(err as Error).message}`);
  }
}

/** Evidence line — the inputs/outputs a reader needs to audit the claim above. */
function show(label: string, value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  console.log(`          · ${label}: ${text}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

// ── fixtures ──────────────────────────────────────────────────────────────────

/** A plumbing prospect with limited Google hours and neither booking nor chat on
 *  the site — the shape that fires missed_calls_no_recovery AND
 *  no_after_hours_coverage together, which is exactly the pair that used to be
 *  double-counted. Verticals with a CPL in STATS get a dollar frame; plumbing has
 *  one, so both leaks carry a figure. */
function plumber(intake?: ScrapeData["intake"]): ScrapeData {
  return {
    business: {
      name: "Stonebrook Plumbing",
      industry: "plumbing",
      city: "Toronto",
      phone: "555-0142",
      websiteUrl: "https://stonebrookplumbing.example",
    },
    website: {
      pagesFound: ["home", "services", "contact"],
      pageText: { home: "Emergency plumbing in Toronto.", contact: "Call us today." },
      scanConfident: true,
      hasContactForm: "ABSENT",
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
    pageSpeed: { mobileScore: 71, lcpSeconds: 2.8 },
    googleReviews: { rating: 4.6, count: 38, recentCount90d: 2, ownerResponseRate: 0, reviewTexts: [] },
    gbp: { hoursListed: true, limitedHours: true, hasBookingLink: false, messagingEnabled: false },
    competitors: [
      { name: "A Plumbing", rating: 4.7, reviewCount: 220 },
      { name: "B Plumbing", rating: 4.5, reviewCount: 180 },
    ],
    intake,
  } as ScrapeData;
}

/** The same fixture with only the industry swapped — used to sweep every vertical
 *  through the math layer for the currency audit. */
function forVertical(v: Vertical, intake?: ScrapeData["intake"]): ScrapeData {
  const d = plumber(intake);
  return { ...d, business: { ...d.business, industry: v } };
}

const ALL_VERTICALS: Vertical[] = [
  "dental",
  "med_spa",
  "law",
  "roofing",
  "hvac",
  "plumbing",
  "electrical",
  "contractor_general",
  "home_services_other",
];

const ALL_TEMPLATES = [
  "missed_call_value",
  "after_hours_value",
  "response_speed_value",
  "follow_up_value",
  "no_show_value",
  "spend_anchored",
] as const;

/** Client numbers, so the REAL-mode branch of every template is exercised too.
 *  The two volume slots are DIFFERENT quantities and are named as such: enquiries
 *  arriving drive the missed-call chain, appointments actually booked drive the
 *  no-show chain, and one is not derivable from the other. */
const REAL_INTAKE: ScrapeData["intake"] = {
  monthlyEnquiries: 40,
  monthlyBookedAppointments: 25,
  avgJobValueCad: 900,
};

/** Every client-facing string a MathEstimate can put in front of an owner. The
 *  `allowedNumbers` array is deliberately excluded — those are bare integers for
 *  the stat guard, never rendered. */
function clientFacingStrings(m: MathEstimate | null): string[] {
  if (!m) return [];
  const out = [m.frame, m.overlapNote ?? ""];
  if (m.impact)
    out.push(
      m.impact.leadVolumeBasis,
      m.impact.effectSize,
      m.impact.avgValueBasis,
      m.impact.formula
    );
  return out.filter(Boolean);
}

/** Sentence split, identical to flatAssertionLint's and validate-pack's, so
 *  "the same sentence as the number" means the same thing here as it does there. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

console.log("\nPHASE 0.5 VERIFICATION — offline proof of the round's five claims");

/* ════════════════════════════════════════════════════════════════════════════
 * A. THE VALIDATOR BLOCKS
 * ══════════════════════════════════════════════════════════════════════════ */
section("A · THE VALIDATOR BLOCKS — a failing pack is refused, the golden sample is not");

// THE COMMITTED FIXTURE, not _samples/pack.json. _samples/ is gitignored and
// holds a real client's scraped data, so pointing this suite at it meant the
// checks below only ever ran on one machine — and could never run in a fresh
// clone or in CI. _fixtures/golden-pack.json is a synthetic business, committed,
// and regenerated by `npm run sample:golden`.
const SAMPLE_PATH = resolve(process.cwd(), "_fixtures/golden-pack.json");
const cleanPack = JSON.parse(readFileSync(SAMPLE_PATH, "utf8")) as AssetPack;
const clone = (p: AssetPack): AssetPack => JSON.parse(JSON.stringify(p)) as AssetPack;

const cleanVerdict = assertPackValid(cleanPack);

check("A1 · the committed golden sample passes the enforcing entry point (ok: true)", () => {
  show("pack", SAMPLE_PATH);
  show("assertPackValid(pack).ok", cleanVerdict.ok);
  show("fatal checks", cleanVerdict.fails.map((c) => c.law));
  show("warnings", cleanVerdict.warns.map((c) => c.law));
  assert.equal(
    cleanVerdict.ok,
    true,
    `golden sample is not law-compliant:\n${cleanVerdict.fails.map((c) => `${c.law}: ${c.message}`).join("\n")}`
  );
  assert.equal(cleanVerdict.fails.length, 0);
});

// Corruption 1 — a hype promise. Nobody can promise an outcome, so "guaranteed"
// is a fatal claim, not a style warning.
const hypePack = clone(cleanPack);
const HYPE_SENTENCE = "Bookings are guaranteed within 30 days.";
// THE CORRUPTION HAS TO LAND ON RENDERED COPY (2026-08-13). It used to go into
// intelligence.executiveSummary, which D1 rendered — and D1 is gone. The text
// laws now judge the RENDERED documents rather than the whole pack blob, so
// prose in an unrendered section is invisible to them. Correct behaviour, and it
// silently made this fixture stop corrupting anything: A2 still passed (it calls
// assertPackValid with no rendered text, which scans the blob) while A5, which
// goes through the real ZIP path, stopped blocking.
//
// surfaces.bookingPage.reassuranceLine is client copy that DOES reach a document
// (the Asset Pack — verify-phase3 G1/G2 prove that section renders), so the gate
// has something real to catch at both boundaries.
if (hypePack.surfaces?.bookingPage)
  hypePack.surfaces.bookingPage.reassuranceLine = `${HYPE_SENTENCE} ${hypePack.surfaces.bookingPage.reassuranceLine}`;
const hypeVerdict = assertPackValid(hypePack);

check("A2 · an injected hype promise is a FATAL block (ok: false, law named)", () => {
  show("injected", HYPE_SENTENCE);
  show("assertPackValid(pack).ok", hypeVerdict.ok);
  show("fatal checks", hypeVerdict.fails.map((c) => c.law));
  assert.equal(hypeVerdict.ok, false, "corrupted pack was accepted");
  assert(
    hypeVerdict.fails.some((c) => c.law.includes("no hype promises")),
    `expected the hype law to fire, got: ${hypeVerdict.fails.map((c) => c.law).join(", ")}`
  );
});

// Corruption 2 — lead-gen language. ReclaimedHQ does not sell traffic, so a
// promise of ads/SEO in client copy is a scope violation, not a wording nit.
const leadgenPack = clone(cleanPack);
const LEADGEN_SENTENCE = "We will run paid ads to drive traffic to the new page.";
leadgenPack.intelligence?.executiveSummary?.biggestOpportunities?.push(LEADGEN_SENTENCE);
const leadgenVerdict = assertPackValid(leadgenPack);

check("A3 · injected lead-gen language is a FATAL block (Law 2 · conversion-only)", () => {
  show("injected", LEADGEN_SENTENCE);
  show("assertPackValid(pack).ok", leadgenVerdict.ok);
  show("fatal checks", leadgenVerdict.fails.map((c) => c.law));
  assert.equal(leadgenVerdict.ok, false, "lead-gen copy was accepted");
  assert(
    leadgenVerdict.fails.some((c) => c.law.includes("conversion-only")),
    `expected Law 2 to fire, got: ${leadgenVerdict.fails.map((c) => c.law).join(", ")}`
  );
});

// Corruption 3 — a model-authored integer replacing a stamped one. This is the
// determinism guard: the rendered dollar figure must appear in its own mathFrame.
const driftPack = clone(cleanPack);
const drifted = (driftPack.intelligence?.leakAnalysis ?? []).find((l) => l.dollarImpact);
if (drifted?.dollarImpact) drifted.dollarImpact.monthlyHigh = 99999;
const driftVerdict = assertPackValid(driftPack);

check("A4 · a dollar figure absent from its own mathFrame is a FATAL block", () => {
  show("leak", drifted?.leakName ?? "(none)");
  show("monthlyHigh forced to", 99999);
  show("assertPackValid(pack).ok", driftVerdict.ok);
  show("fatal checks", driftVerdict.fails.map((c) => c.law));
  assert(drifted, "golden sample carries no dollarImpact to corrupt");
  assert.equal(driftVerdict.ok, false, "a model-authored integer was accepted");
  assert(
    driftVerdict.fails.some((c) => c.law.includes("dollar determinism")),
    `expected the determinism guard to fire, got: ${driftVerdict.fails.map((c) => c.law).join(", ")}`
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * B. SOFTENING IS TIER-AWARE
 * ══════════════════════════════════════════════════════════════════════════ */
section("B · SOFTENING IS TIER-AWARE — a disclosed fact is never hedged, an inference still is");

// Matches FLAT_ASSERTION_PATTERNS ("there is no follow-up") and carries no hedge
// qualifier, so with NO provenance it must be softened. Every belt below must
// return it BYTE-IDENTICAL.
const BARE = "There is no follow-up after the first call.";
const DISCLOSED = "You told us there is no follow-up after the first call.";

check("B1 · intake-confirmed → byte-identical (belt a, caller context)", () => {
  const out = softenFlatAssertions(BARE, { intakeConfirmed: true });
  show("in ", BARE);
  show("out", out);
  assert.strictEqual(out, BARE, "an intake-confirmed fact was hedged");
});

check("B2 · OBSERVED tier → byte-identical (belt a, caller context)", () => {
  const out = softenFlatAssertions(BARE, { tier: "OBSERVED" });
  show("in ", BARE);
  show("out", out);
  assert.strictEqual(out, BARE, "an OBSERVED-tier finding was hedged");
});

check('B3 · "you told us" in the sentence → byte-identical with NO context (belt b)', () => {
  const out = softenFlatAssertions(DISCLOSED);
  show("in  (no opts)", DISCLOSED);
  show("out", out);
  assert.strictEqual(out, DISCLOSED, "a self-disclosing sentence was hedged");
});

check("B4 · EVERY protected marker licenses the same sentence with no context", () => {
  // The list is exported precisely so this can be asserted directly rather than
  // spot-checked: each marker, planted in front of the same flat assertion,
  // must come back untouched.
  const samples = [
    "You told us there is no follow-up after the first call.",
    "Confirmed at intake: there is no follow-up after the first call.",
    "You confirmed there is no follow-up after the first call.",
    "We measured it: there is no follow-up after the first call.",
    "Based on the numbers you provided, there is no follow-up after the first call.",
    // The two that arrived when CLIENT_SOURCED_LABELS was folded into
    // DISCLOSURE_MARKERS — see leak-narrative.ts. They were only ever used to
    // license a DOLLAR FIGURE as the client's own; now that one list answers both
    // "is this figure theirs?" and "is this sentence attributed?", they have to
    // license a sentence too, and this is where that gets proved.
    "Based on your 40 enquiries a month, there is no follow-up after the first call.",
    "That is your number, and there is no follow-up after the first call.",
  ];
  assert.equal(
    samples.length,
    PROTECTED_MARKERS.length,
    `PROTECTED_MARKERS has ${PROTECTED_MARKERS.length} entries but this check covers ${samples.length} — add the new marker's sample here`
  );
  for (const s of samples) {
    const out = softenFlatAssertions(s);
    show("out", out);
    assert.strictEqual(out, s, `marker sentence was hedged: ${s}`);
  }
});

check("B5 · NO tier and NO marker → the SAME sentence IS still softened", () => {
  const out = softenFlatAssertions(BARE);
  show("in  (no opts, no marker)", BARE);
  show("out", out);
  assert.notStrictEqual(out, BARE, "the guard has been disabled — nothing is softened any more");
  assert(/^Likely, /.test(out), `expected a leading hedge, got: ${out}`);
});

check("B6 · the LINT agrees with the softener in both directions", () => {
  const bare = flatAssertionLint(BARE);
  const observed = flatAssertionLint(BARE, { tier: "OBSERVED" });
  const confirmed = flatAssertionLint(BARE, { intakeConfirmed: true });
  const disclosed = flatAssertionLint(DISCLOSED);
  show("lint(bare).ok", bare.ok);
  show("lint(bare).hits", bare.hits);
  show("lint(bare, OBSERVED).ok", observed.ok);
  show("lint(bare, intakeConfirmed).ok", confirmed.ok);
  show("lint(disclosed).ok", disclosed.ok);
  assert.equal(bare.ok, false, "an unhedged inferred claim no longer fails the lint");
  assert.equal(observed.ok, true);
  assert.equal(confirmed.ok, true);
  assert.equal(disclosed.ok, true);
});

/* ════════════════════════════════════════════════════════════════════════════
 * C. NO DOUBLE-COUNT
 * ══════════════════════════════════════════════════════════════════════════ */
section("C · NO DOUBLE-COUNT — after-hours is a slice of missed calls, not a second loss");

const cData = plumber();
const cFired = getFiredLeaks(cData);
const cInputs: LeakInput[] = buildLeakInputs(reportLeaks(cFired), cData);
const byId = (id: string) => cInputs.find((i) => i.id === id);
const missed = byId("missed_calls_no_recovery");
const afterHours = byId("no_after_hours_coverage");

// The naive total is what the report used to print: every figure added together.
const naiveLow = cInputs.reduce((n, i) => n + (i.dollar?.low ?? 0), 0);
const naiveHigh = cInputs.reduce((n, i) => n + (i.dollar?.high ?? 0), 0);
const total = reconcileLeakTotal(cInputs);

check("C1 · both overlapping leaks fire on the fixture and both carry a figure", () => {
  show("fired leak ids", cInputs.map((i) => i.id));
  show("missed_calls_no_recovery $", missed?.dollar ? [missed.dollar.low, missed.dollar.high] : null);
  show("no_after_hours_coverage $", afterHours?.dollar ? [afterHours.dollar.low, afterHours.dollar.high] : null);
  assert(missed, "missed_calls_no_recovery did not fire");
  assert(afterHours, "no_after_hours_coverage did not fire");
  assert(missed!.dollar, "missed_calls_no_recovery carries no dollar figure");
  assert(afterHours!.dollar, "no_after_hours_coverage carries no dollar figure");
});

check("C2 · the after-hours frame declares its parent and its overlap note", () => {
  show("overlapsWith", afterHours?.overlapsWith);
  show("overlapNote", afterHours?.overlapNote);
  assert.equal(afterHours?.overlapsWith, "missed_calls_no_recovery");
  assert(afterHours?.overlapNote?.trim(), "no plain-English overlap note on the after-hours frame");
});

check("C3 · the reconciled total is NOT the naive sum (the slice is dropped)", () => {
  show("naive sum      ", `${cad(naiveLow)}–${cad(naiveHigh)}/mo`);
  show("reconciled     ", `${cad(total.low)}–${cad(total.high)}/mo`);
  show("difference     ", `${cad(naiveHigh - total.high)}/mo removed from the high end`);
  show("after-hours pct", `${AFTER_HOURS_SHARE_PCT}% of the missed-call chain`);
  assert(total.high < naiveHigh, `reconciled high ${total.high} is not below naive ${naiveHigh}`);
  assert.equal(
    total.high,
    naiveHigh - (afterHours?.dollar?.high ?? 0),
    "the reconciled total did not drop exactly the after-hours figure"
  );
});

check("C4 · the excluded leak is NAMED, not silently dropped", () => {
  show("excluded ids", total.excluded);
  assert(
    total.excluded.includes("no_after_hours_coverage"),
    `expected no_after_hours_coverage in excluded, got: ${total.excluded.join(", ")}`
  );
});

check("C5 · a plain-English disclosure is produced for the reader", () => {
  show("disclosure", total.disclosure);
  assert(total.disclosure.trim().length > 0, "no disclosure sentence produced");
  assert(
    total.disclosure.includes(afterHours?.name ?? " "),
    "the disclosure does not name the leak it left out"
  );
  assert(
    /not additional to it|not added to this total/i.test(total.disclosure),
    `the disclosure does not say why in plain English: ${total.disclosure}`
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * D. NO USD LEAKAGE
 * ══════════════════════════════════════════════════════════════════════════ */
section("D · NO USD LEAKAGE — every emitted dollar string is marked CAD");

// Mirrors the PRIVATE VERTICAL_CPL_USD table in leak-narrative.ts (cpl_google_ads
// is published in USD). Kept here as the independent expectation: if the table
// changes without the conversion changing, D2 fails.
const CPL_USD: Partial<Record<Vertical, number>> = {
  hvac: 129,
  plumbing: 129,
  roofing: 228,
  electrical: 94,
  dental: 84,
  law: 132,
};

// Every string the math layer can put in front of an owner, across every
// vertical × every template × both intake modes (BENCHMARK and REAL).
const emitted: { where: string; text: string }[] = [];
for (const v of ALL_VERTICALS) {
  for (const t of ALL_TEMPLATES) {
    for (const [mode, intake] of [
      ["BENCHMARK", undefined],
      ["REAL", REAL_INTAKE],
    ] as const) {
      const est = computeMathEstimate(t, forVertical(v, intake));
      for (const text of clientFacingStrings(est))
        emitted.push({ where: `${v}/${t}/${mode}`, text });
    }
  }
}

check("D1 · every $ in every emitted math string is preceded by the CAD marker", () => {
  show("strings swept", `${emitted.length} across ${ALL_VERTICALS.length} verticals × ${ALL_TEMPLATES.length} templates × 2 modes`);
  const bare: string[] = [];
  for (const { where, text } of emitted) {
    // Walk every "$" and require the four characters before it to be "CAD ".
    for (let i = text.indexOf("$"); i !== -1; i = text.indexOf("$", i + 1)) {
      if (text.slice(Math.max(0, i - 4), i) !== "CAD ")
        bare.push(`${where}: …${text.slice(Math.max(0, i - 30), i + 12)}…`);
    }
  }
  show("unmarked $ found", bare.length);
  bare.slice(0, 5).forEach((b) => show("  offender", b));
  assert.equal(bare.length, 0, `${bare.length} dollar figure(s) reach a client without a CAD marker`);
});

check("D2 · the USD CPL benchmark is CONVERTED, never printed raw", () => {
  for (const [v, usd] of Object.entries(CPL_USD) as [Vertical, number][]) {
    const expectedCad = Math.floor(usd * USD_TO_CAD);
    const est = computeMathEstimate("missed_call_value", forVertical(v));
    const text = clientFacingStrings(est).join("\n");
    show(`${v}`, `USD $${usd} → ${cad(expectedCad)} (floor, so conversion can only understate)`);
    assert(
      text.includes(cad(expectedCad)),
      `${v}: converted CPL ${cad(expectedCad)} missing from the frame`
    );
    // The raw USD figure must not appear as a dollar amount anywhere.
    assert(
      !new RegExp(`\\$\\s?${usd}\\b`).test(text),
      `${v}: raw USD figure $${usd} reached the frame unconverted`
    );
  }
});

check("D3 · the rounding direction can only UNDERSTATE the leak", () => {
  show("USD_TO_CAD", USD_TO_CAD);
  for (const [v, usd] of Object.entries(CPL_USD) as [Vertical, number][]) {
    const exact = usd * USD_TO_CAD;
    const printed = Math.floor(exact);
    assert(printed <= exact, `${v}: conversion rounded UP (${printed} > ${exact})`);
  }
  show("checked", `${Object.keys(CPL_USD).length} verticals, all floor()`);
});

check("D4 · the UI currency formatter uses the same CAD convention", () => {
  const out = formatCurrency(1000);
  show("formatCurrency(1000)", out);
  assert.strictEqual(out, "CAD $1,000", "utils.formatCurrency drifted from the CAD convention");
  assert.strictEqual(cad(1000), "CAD $1,000", "leak-narrative.cad() drifted from the CAD convention");
});

/* ════════════════════════════════════════════════════════════════════════════
 * E. ASSUMPTIONS ARE LABELLED
 * ══════════════════════════════════════════════════════════════════════════ */
section("E · ASSUMPTIONS ARE LABELLED — every assumed number says so beside itself");

// One probe per ASSUMPTIONS entry: the frames that actually consume it, plus the
// needle that locates the number in the prose. Matching on the RENDERED number
// (not on Assumption.label) is deliberate — the label is the map's own wording,
// and the point of the check is what a client reads.
const ASSUMPTION_PROBES: Record<string, { needle: RegExp; produce: () => string[] }> = {
  benchmark_monthly_inquiries: {
    needle: /20 enquiries a month/i,
    // Pre-intake missed-call frame: the assumed inbound volume is the only thing
    // holding the whole dollar chain up, so it is the most important label here.
    produce: () => clientFacingStrings(computeMathEstimate("missed_call_value", plumber())),
  },
  conservative_close_rate: {
    needle: /30% close rate/i,
    // REAL mode: even with the client's own call volume and job value, the close
    // rate on a RECOVERED call is still ours, not theirs.
    produce: () => clientFacingStrings(computeMathEstimate("missed_call_value", plumber(REAL_INTAKE))),
  },
  range_low_haircut: {
    needle: /low end set at half the high end/i,
    produce: () => clientFacingStrings(computeMathEstimate("missed_call_value", plumber(REAL_INTAKE))),
  },
  default_no_show_rate: {
    needle: /15% no-show rate/i,
    // Only verticals with NO cited no-show range fall through to the assumption;
    // plumbing is one (dental and med spa use their cited conservative ends).
    produce: () => clientFacingStrings(computeMathEstimate("no_show_value", plumber(REAL_INTAKE))),
  },
  usd_to_cad: {
    // THE ONE PROBE WHOSE NEEDLE IS A PHRASE, NOT A NUMBER — deliberately. The
    // exchange rate is never printed to a client (it is not a claim about their
    // business, and floor() at the point of use means it can only understate the
    // leak), so there is no rendered "1.35" to anchor on. What IS rendered is the
    // converted CPL figure, and the rule this check exists to hold is that the
    // sentence carrying that converted number must admit the rate behind it is
    // ours. So the needle finds the conversion clause and the assertion below
    // still demands the caveat in that same sentence.
    needle: /converted from USD/i,
    produce: () => clientFacingStrings(computeMathEstimate("missed_call_value", plumber())),
  },
};

check("E0 · every ASSUMPTIONS entry has a probe (a new one cannot slip past unchecked)", () => {
  const declared = Object.keys(ASSUMPTIONS).sort();
  const probed = Object.keys(ASSUMPTION_PROBES).sort();
  show("ASSUMPTIONS", declared);
  show("probed     ", probed);
  assert.deepStrictEqual(
    probed,
    declared,
    "ASSUMPTIONS and the probe table have diverged — add the missing probe above"
  );
});

for (const [key, probe] of Object.entries(ASSUMPTION_PROBES)) {
  check(`E · "${key}" is labelled an assumption in the SAME sentence as its number`, () => {
    const a = ASSUMPTIONS[key];
    assert(a, `${key} is not in ASSUMPTIONS`);
    show("value    ", a.value);
    show("label    ", a.label);

    const strings = probe.produce();
    assert(strings.length, `${key}: the producing template emitted nothing`);

    // Find every sentence that renders this assumption's number, and require the
    // caveat in that same sentence — not merely somewhere in the paragraph.
    let found = 0;
    for (const text of strings) {
      for (const sentence of sentencesOf(text)) {
        if (!probe.needle.test(sentence)) continue;
        found += 1;
        show("sentence ", sentence);
        assert(
          sentence.includes(ASSUMPTION_CAVEAT) ||
            /\((?:[^)]*?)(?:our assumption|no published[^)]*range)[^)]*\)/i.test(sentence),
          `${key}: the number appears with NO in-sentence assumption label → "${sentence}"`
        );
      }
    }
    assert(found > 0, `${key}: needle ${probe.needle} matched no emitted sentence`);
    show("sentences carrying it", found);
  });

  check(`E · "${key}" rationale states in words that it is not measured or cited`, () => {
    const a = ASSUMPTIONS[key];
    show("rationale", a.rationale);
    assert(
      /not measured/i.test(a.rationale) && /not cited/i.test(a.rationale),
      `${key}: the rationale does not say plainly that it is neither measured nor cited`
    );
  });
}

check("E · assumptionPhrase() cannot render an assumption without the caveat", () => {
  for (const key of Object.keys(ASSUMPTIONS)) {
    const phrase = assumptionPhrase(key);
    show(key, phrase);
    assert(phrase.includes(ASSUMPTION_CAVEAT), `${key}: assumptionPhrase dropped the caveat`);
  }
  // Even an unknown key degrades to the caveat rather than to a bare number.
  const unknown = assumptionPhrase("not_a_real_assumption");
  show("unknown key", unknown);
  assert(unknown.includes(ASSUMPTION_CAVEAT));
});

/* ════════════════════════════════════════════════════════════════════════════
 * A (continued) — the ZIP boundary, which is async and must run last.
 * ══════════════════════════════════════════════════════════════════════════ */
async function main(): Promise<void> {
  section("A · THE ZIP BOUNDARY — the last gate, on the RENDERED deliverables");

  await acheck("A5 · buildAssetZipChecked BLOCKS the corrupted pack and returns no zip", async () => {
    const built = await buildAssetZipChecked(hypePack);
    show("ok", built.ok);
    show("has zip", "zip" in built);
    if (!built.ok) show("fails", built.fails.map((c) => c.law));
    assert.equal(built.ok, false, "a law-breaking pack was bundled into a ZIP anyway");
    assert(!("zip" in built), "a ZIP was produced for a blocked pack");
  });

  await acheck("A6 · buildAssetZipChecked SHIPS the clean golden sample", async () => {
    const built = await buildAssetZipChecked(cleanPack);
    show("ok", built.ok);
    if (!built.ok) show("fails", built.fails.map((c) => `${c.law}: ${c.message}`));
    assert.equal(built.ok, true, "the golden sample was blocked at the ZIP boundary");
    assert(built.ok && built.zip.length > 0, "an empty ZIP was produced");
    if (built.ok) {
      show("filename", built.filename);
      show("bytes", built.zip.length);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verify-phase05 crashed:", err);
  process.exit(1);
});
