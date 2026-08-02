/**
 * PHASE 1 PROOF — the five claims of this round, each demonstrated against the
 * REAL shipped code, offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase1.ts
 *   npm run verify:phase1
 *
 * Every check prints its own inputs and outputs so a reader can audit the claim
 * without trusting the assertion. Exits 1 if ANY check fails.
 *
 * THE ROUND IN ONE SENTENCE: there are three grades of knowledge about a client
 * — we measured it, they told us, we are guessing — and until now all three
 * sounded the same in the finished document. This script proves the difference is
 * now carried in the DATA and enforced in CODE, not asked for in a prompt.
 *
 *   A. THE GRADE IS DERIVED,     — gradeOf() over the FULL cross-product of
 *      NOT GUESSED                 tier × intakeConfirmed, with the precedence
 *                                  (measured > told > guessed) asserted case by
 *                                  case, and a missing grade landing on
 *                                  "inferred" at every place that consumes one.
 *   B. GRADE DRIVES VOICE,       — the same sentence through softenFlatAssertions
 *      AUTOMATICALLY               comes back BYTE-IDENTICAL for observed and
 *                                  disclosed and hedged for inferred; the lint
 *                                  agrees in all three directions; the old
 *                                  {tier, intakeConfirmed} call shape still
 *                                  behaves identically (verify-phase05 needs it).
 *   C. THE VALIDATOR BLOCKS THE  — an inferred leak written as flat fact is
 *      TWO NEW FAILURES            FATAL; a disclosed leak with no attribution is
 *                                  FATAL; the same leak WITH attribution ships;
 *                                  the committed fixture trips neither.
 *   D. PRE-SALE CANNOT CONTAIN   — the compiler itself refuses to build a
 *      A DISCLOSURE                pre-sale detection carrying intake, and the
 *                                  runtime backstops behind it are shown firing.
 *                                  Every check below says which of the two it is.
 *   E. THE GAP LIST IS REAL      — inferredGaps() names, per still-guessed leak,
 *      AND COMPLETE                the question we never asked; one intake answer
 *                                  removes exactly one leak from the list; and
 *                                  the leaks no question could ever resolve are
 *                                  reported as structural, not as to-dos.
 */

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  gradeOf,
  inferredGaps,
  intakeFieldsForZeroInferred,
  LEAKS,
  type ClientIntake,
  type EvidenceGrade,
  type EvidenceTier,
  type ScrapeData,
} from "@/lib/leak-taxonomy";
import {
  detectLeaks,
  getFiredLeaks,
  type PreSaleResearch,
} from "@/lib/leak-detection";
import {
  carriesProvenanceMarker,
  flatAssertionLint,
  softenFlatAssertions,
  GRADE_VOICE,
} from "@/lib/leak-narrative";
import { assertPackValid } from "@/lib/exporters/validate-pack";
import { renderLeakAnalysis } from "@/lib/exporters/deliverables";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import type { AssetPack, LeakAnalysisItem } from "@/types";

// ── harness ───────────────────────────────────────────────────────────────────
// Identical shape to scripts/verify-phase05.ts and scripts/verify-phase06.ts: a
// counting check() that never throws, plus an explicit PASS/FAIL word on every
// line so the output is greppable by a human and by CI alike.
let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
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

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

/** The first source line matching `re`, with its 1-based line number — so a
 *  source-level claim ("the type says `never`") can be PRINTED and read, not just
 *  asserted about. Returns null when nothing matches, which is always a failure
 *  at the call site: these checks exist to notice the line disappearing. */
function sourceLine(rel: string, re: RegExp): { line: number; text: string } | null {
  const lines = read(rel).split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (re.test(lines[i])) return { line: i + 1, text: lines[i].trim() };
  }
  return null;
}

/** Frequency table, for printing a grade spread without a bar chart's worth of code. */
function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/** Source with comments removed, so a scan cannot be satisfied — or tripped —
 *  by prose. Same stripper the other verify scripts use. */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Every .ts/.tsx file under src/, repo-relative — walked with fs so D6b covers
 *  a new file the day it is created. */
function allSrcTsFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(resolve(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(resolve(REPO, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
    }
  };
  walk("src");
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES — one synthetic business, in the three shapes the checks need.
 *
 * Invented, like the golden pack and for the same reason: a .example domain that
 * can never resolve and a phone number in the reserved 555-01xx block, so nothing
 * in this file traces to a real prospect.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Enough missing that most of the taxonomy fires: no booking path, no chat
 *  widget, a bare contact form, limited hours, thin review volume against its
 *  competitors. Sections A and E both run off this one fixture, so the grade a
 *  leak is stamped with and the gap list that reports it come from the same fire. */
const PROBE_SCRAPE: ScrapeData = {
  business: {
    name: "Probe Heating Co",
    industry: "hvac",
    city: "Kelowna",
    phone: "555-0199",
    websiteUrl: "https://probe-heating.example",
  },
  website: {
    pagesFound: ["home", "contact"],
    pageText: { home: "We service furnaces and heat pumps.", contact: "Call us during business hours." },
    scanConfident: true,
    hasContactForm: "PRESENT",
    formHasQualifyingFields: false,
    hasOnlineBookingLink: "ABSENT",
    hasChatWidget: "ABSENT",
    hasClickToCallOnMobile: "PRESENT",
    hasPrimaryCtaAboveFold: true,
    servicePagesHaveCtas: true,
    mentionsTextingOption: false,
    linksToFacebook: true,
    linksToInstagram: false,
  },
  pageSpeed: { mobileScore: 80, lcpSeconds: 2.2 },
  googleReviews: { rating: 4.4, count: 60, recentCount90d: 6, ownerResponseRate: 0.5, reviewTexts: [] },
  gbp: { hoursListed: true, limitedHours: true, hasBookingLink: false, messagingEnabled: false },
  competitors: [
    { name: "Okanagan Comfort", rating: 4.5, reviewCount: 90 },
    { name: "Valley Air", rating: 4.6, reviewCount: 110 },
  ],
};

/** Every intake answer that CONFIRMS a gap rather than suppressing it. Used by E6
 *  to show what is left over once the operator collected everything the form asks. */
const CONFIRM_EVERYTHING: ClientIntake = {
  responseSpeed: "DAY_OR_TWO",
  missedCallHandling: "VOICEMAIL_ONLY",
  afterHoursHandling: "NOTHING",
  bookingMethod: "PHONE_EMAIL_ONLY",
  hasFollowUpSequence: false,
  hasReminderSystem: false,
  hasCrm: false,
  hasCallTracking: false,
  hasOnlinePayment: false,
  // The two questions added after Phase 1 shipped, which closed the last two
  // STRUCTURAL gaps. "Everything the form asks" has to keep meaning everything, so
  // a new question must be added here too — otherwise E6 quietly stops being an
  // end-to-end statement and starts being a statement about an old form.
  socialEnquiries: "YES",
  pastCustomerContact: "NEVER",
};

/** The committed golden pack — a real, law-passing, fully graded deliverable set.
 *  Sections B and C both run off it: B renders it, C corrupts clones of it. */
const GOLDEN_PATH = "_fixtures/golden-pack.json";
const goldenPack = JSON.parse(read(GOLDEN_PATH)) as AssetPack;
const clonePack = (p: AssetPack): AssetPack => JSON.parse(JSON.stringify(p)) as AssetPack;

/** The same business as a PRE-SALE research bundle — the shape the free cold audit
 *  runs on. Note what is absent and, per D1, CANNOT be added: `intake`. */
const PRE_SALE_RESEARCH: PreSaleResearch = {
  mode: "pre_sale",
  business: {
    name: "Probe Heating Co",
    industry: "hvac",
    category: "hvac",
    city: "Kelowna",
    phone: "555-0199",
    website: "https://probe-heating.example",
    rating: 4.4,
    reviewCount: 60,
  },
  intel: buildAuditIntelligence({
    websiteHtml:
      '<!doctype html><html lang="en"><head><title>Probe Heating Co</title></head><body>' +
      "<h1>Furnace and heat pump service in Kelowna</h1><p>Call 555-0199 during business hours.</p>" +
      '<form action="/contact"><input name="name"><input name="email"></form></body></html>',
    hasWebsiteUrl: true,
    reviews: [],
    competitors: [
      {
        name: "Okanagan Comfort",
        rating: 4.5,
        reviewCount: 90,
        website: "https://okanagan-comfort.example",
        category: "hvac_contractor",
        address: "220 Water St, Kelowna BC",
      },
      {
        name: "Valley Air",
        rating: 4.6,
        reviewCount: 110,
        website: "https://valley-air.example",
        category: "hvac_contractor",
        address: "980 Springfield Rd, Kelowna BC",
      },
    ],
    self: { rating: 4.4, reviewCount: 60 },
  }),
  scrape: { used: false, homepage: null, subpages: [] },
  fallbackText: "Furnace and heat pump service in Kelowna. Call 555-0199 during business hours.",
  asOf: "2026-06-30T12:00:00.000Z",
};

/* ════════════════════════════════════════════════════════════════════════════
 * A. THE GRADE IS DERIVED, NOT GUESSED
 * ══════════════════════════════════════════════════════════════════════════ */

section("A · THE GRADE IS DERIVED, NOT GUESSED — one function, one precedence");

// The full input space of gradeOf(), spelled out rather than sampled. `null` and
// `undefined` are both here on purpose: a leak read back off a saved pack can
// carry either, and the two must not disagree.
const ALL_TIERS: (EvidenceTier | null | undefined)[] = [
  "OBSERVED",
  "EVIDENCED",
  "BENCHMARK",
  null,
  undefined,
];
const ALL_CONFIRMED: (boolean | null | undefined)[] = [true, false, null, undefined];

/** THE RULE, RESTATED LONGHAND — measured > told > guessed.
 *
 *  Deliberately written out again here instead of imported. Comparing gradeOf()
 *  to itself would prove nothing; this is an independent statement of the spec
 *  that the shipped function has to agree with, so a change to the precedence in
 *  leak-taxonomy.ts shows up as a failure here rather than as a silently updated
 *  expectation. */
function expectedGrade(
  tier: EvidenceTier | null | undefined,
  intakeConfirmed: boolean | null | undefined
): EvidenceGrade {
  if (tier === "OBSERVED") return "observed"; // MEASURED wins outright
  if (intakeConfirmed === true) return "disclosed"; // then TOLD
  return "inferred"; // otherwise it is a guess
}

check("A1 · the full tier × intakeConfirmed cross-product derives the expected grade", () => {
  const rows: string[] = [];
  const wrong: string[] = [];
  for (const tier of ALL_TIERS) {
    for (const intakeConfirmed of ALL_CONFIRMED) {
      const actual = gradeOf({ tier, intakeConfirmed });
      const want = expectedGrade(tier, intakeConfirmed);
      rows.push(`tier=${String(tier).padEnd(9)} intakeConfirmed=${String(intakeConfirmed).padEnd(9)}`);
      show(rows[rows.length - 1], actual);
      if (actual !== want)
        wrong.push(`tier=${String(tier)} confirmed=${String(intakeConfirmed)}: got ${actual}, expected ${want}`);
    }
  }
  show("cases driven", rows.length);
  assert.equal(
    rows.length,
    ALL_TIERS.length * ALL_CONFIRMED.length,
    "the cross-product is not being driven in full"
  );
  assert.equal(wrong.length, 0, `gradeOf disagrees with measured > told > guessed:\n          ${wrong.join("\n          ")}`);
});

check("A2 · MEASURED BEATS TOLD — OBSERVED + intakeConfirmed ⇒ observed, not disclosed", () => {
  // The first case a reader questions. They told us AND we measured it; the
  // measurement is the more defensible of the two, so it is the one we claim.
  const g = gradeOf({ tier: "OBSERVED", intakeConfirmed: true });
  show("input ", { tier: "OBSERVED", intakeConfirmed: true });
  show("output", g);
  show("why   ", "we measured it ourselves — that is the most defensible thing we can say about it");
  assert.strictEqual(
    g,
    "observed",
    'an OBSERVED leak the client also confirmed came back as "disclosed" — the precedence has been inverted, and the document would now attribute our own measurement to the client'
  );
});

check("A3 · TOLD BEATS GUESSED — BENCHMARK + intakeConfirmed ⇒ disclosed", () => {
  const g = gradeOf({ tier: "BENCHMARK", intakeConfirmed: true });
  show("input ", { tier: "BENCHMARK", intakeConfirmed: true });
  show("output", g);
  assert.strictEqual(g, "disclosed", "an answered intake question is still being treated as a guess");
});

check("A4 · EVIDENCED, UNCONFIRMED ⇒ inferred — the signal is observed, the conclusion is not", () => {
  // The second case a reader questions, and it grades DOWN on purpose. EVIDENCED
  // means we inferred from a real signal (two reviews mentioning calls that were
  // never returned). The SIGNAL is observed; the CONCLUSION ("they miss calls")
  // is not — nobody measured their phone system.
  const g = gradeOf({ tier: "EVIDENCED", intakeConfirmed: false });
  show("input ", { tier: "EVIDENCED", intakeConfirmed: false });
  show("output", g);
  show("why   ", "the review is the observation; 'they miss calls' is our inference from it");
  assert.strictEqual(
    g,
    "inferred",
    'an unconfirmed EVIDENCED leak came back as "observed" — a conclusion drawn from a signal would now be printed as a measurement'
  );
});

check("A5 · a MISSING grade falls to inferred at every place a grade is consumed", () => {
  // Not one assertion but four, because "safe default" is only true if it is true
  // everywhere. Every consumer of a grade is driven with the field absent.

  // (i) the derivation itself — no tier, no confirmation, nothing.
  show("gradeOf({})", gradeOf({}));
  assert.strictEqual(gradeOf({}), "inferred", "an empty input produced something other than inferred");

  // (ii) the softener / lint, called with no provenance context at all. Not
  //      protected ⇒ the sentence is still hedged.
  const bare = "There is no follow-up after the first call.";
  show("softenFlatAssertions(bare, undefined)", softenFlatAssertions(bare));
  show("flatAssertionLint(bare, undefined).ok", flatAssertionLint(bare).ok);
  assert.notStrictEqual(softenFlatAssertions(bare), bare, "a claim with no stated provenance was left unhedged");
  assert.equal(flatAssertionLint(bare).ok, false, "the lint let an ungrounded flat assertion through");

  // (iii) the PACK VALIDATOR. Driven properly in section C; here we only prove the
  //       source default exists and is "inferred" rather than the tier.
  const gate = sourceLine("src/lib/exporters/validate-pack.ts", /evidenceGrade \?\? "inferred"/);
  show("validate-pack.ts", gate ? `L${gate.line}  ${gate.text}` : "(NOT FOUND)");
  assert(gate, "the pack validator no longer defaults a missing grade to inferred");

  // (iv) the RENDER boundary.
  const render = sourceLine("src/lib/exporters/deliverables.ts", /evidenceGrade \?\? "inferred"/);
  show("deliverables.ts ", render ? `L${render.line}  ${render.text}` : "(NOT FOUND)");
  assert(render, "the render boundary no longer defaults a missing grade to inferred");
});

check("A6 · a leak rendered with NO grade is hedged — the default is real, not decorative", () => {
  // The render boundary, driven rather than read. A leak carrying flat-assertion
  // prose and no evidenceGrade at all (every pack saved before Phase 1) must come
  // out of the renderer hedged.
  const FLAT = "There is no follow-up after the first call.";
  const ungraded: LeakAnalysisItem = {
    area: "Follow-Up & Nurture",
    leakName: "No structured follow-up on unbooked leads",
    evidence: FLAT,
    explanation: FLAT,
    businessImpact: FLAT,
    difficulty: "low",
    priority: "high",
    recommendedFix: "",
    owner: "us",
  } as LeakAnalysisItem;
  const html = renderLeakAnalysis([ungraded]);
  show("leak.evidenceGrade", ungraded.evidenceGrade ?? "(absent)");
  show("prose in          ", FLAT);
  show("rendered unhedged (must be false)", html.includes(FLAT));
  show("rendered with a hedge           ", html.includes("Likely, there is no follow-up"));
  assert(
    html.includes("Likely, there is no follow-up"),
    "an ungraded leak rendered its flat assertion unhedged — a field nobody stamped is licensing a statement of fact"
  );
});

check("A7 · EVERY fire out of the real engine is graded, and the grade matches its own inputs", () => {
  // getFiredLeaks is the only place a fire is constructed, which is what makes it
  // the only place a grade is derived. This proves there is no path out of it that
  // produces an ungraded fire, and that nothing downstream needs to recompute one.
  const fired = getFiredLeaks(PROBE_SCRAPE);
  const ungraded = fired.filter((f) => !f.grade);
  const drifted = fired.filter(
    (f) => f.grade !== gradeOf({ tier: f.tier, intakeConfirmed: f.intakeConfirmed })
  );
  show("fired leaks", fired.length);
  show("grade spread", countBy(fired.map((f) => f.grade)));
  show("ungraded fires", ungraded.length ? ungraded.map((f) => f.leak.id) : "none");
  assert(fired.length > 0, "the probe fixture fired nothing — this check would be vacuous");
  assert.equal(ungraded.length, 0, `fires left the engine with no grade: ${ungraded.map((f) => f.leak.id).join(", ")}`);
  assert.equal(
    drifted.length,
    0,
    `a stamped grade disagrees with gradeOf() on its own tier/confirmation: ${drifted.map((f) => f.leak.id).join(", ")}`
  );
});

check("A8 · there is exactly ONE honesty rule per grade, and all three are declared", () => {
  const grades: EvidenceGrade[] = ["observed", "disclosed", "inferred"];
  for (const g of grades) show(g, `${GRADE_VOICE[g].slice(0, 96)}…`);
  assert.equal(Object.keys(GRADE_VOICE).length, 3, "GRADE_VOICE no longer covers exactly the three grades");
  for (const g of grades) assert(GRADE_VOICE[g]?.trim(), `no voice rule declared for grade "${g}"`);
  // The disclosed rule is the one the owner named, so it is asserted by content:
  // it must tell the writer to attribute, and forbid presenting it as our finding.
  assert(
    /attribute/i.test(GRADE_VOICE.disclosed) && /never/i.test(GRADE_VOICE.disclosed),
    'the "disclosed" voice rule no longer demands attribution — this is the failure the grade exists to prevent'
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * B. GRADE DRIVES VOICE, AUTOMATICALLY
 * ══════════════════════════════════════════════════════════════════════════ */

section("B · GRADE DRIVES VOICE — the same sentence, three grades, three outcomes");

// ONE sentence for all three grades, so the only variable between the runs below
// is the grade. It matches FLAT_ASSERTION_PATTERNS ("there is no follow-up"),
// carries no hedge qualifier and states no provenance of its own — so with
// nothing licensing it, it MUST be softened. It is the same sentence
// verify-phase05 section B uses, deliberately: the two harnesses are then
// provably talking about the same behaviour.
const SENTENCE = "There is no follow-up after the first call.";

check("B1 · observed ⇒ BYTE-IDENTICAL", () => {
  const out = softenFlatAssertions(SENTENCE, { grade: "observed" });
  show("in ", SENTENCE);
  show("out", out);
  assert.strictEqual(out, SENTENCE, "something we measured came back hedged");
});

check("B2 · disclosed ⇒ BYTE-IDENTICAL", () => {
  const out = softenFlatAssertions(SENTENCE, { grade: "disclosed" });
  show("in ", SENTENCE);
  show("out", out);
  assert.strictEqual(
    out,
    SENTENCE,
    'a client\'s own answer came back hedged — "Likely, you told us…" is the insult this pass removes'
  );
});

check("B3 · inferred ⇒ SOFTENED", () => {
  const out = softenFlatAssertions(SENTENCE, { grade: "inferred" });
  show("in ", SENTENCE);
  show("out", out);
  assert.notStrictEqual(out, SENTENCE, "the guard is off — a guess is being stated as fact");
  assert(/^Likely, /.test(out), `expected a leading hedge, got: ${out}`);
});

check("B4 · byte-identity is LITERAL (===), not 'looks similar'", () => {
  // Spelled out because "unchanged" is the whole promise: callers rely on the
  // early return leaving the string untouched, whitespace and all. A softener that
  // re-joined sentences would pass a loose comparison and still corrupt copy.
  const spaced = "  There is no follow-up after the first call.   And nothing after that.  ";
  const observed = softenFlatAssertions(spaced, { grade: "observed" });
  const disclosed = softenFlatAssertions(spaced, { grade: "disclosed" });
  show("in  (leading/trailing/double spaces preserved)", JSON.stringify(spaced));
  show("out observed ", JSON.stringify(observed));
  show("out disclosed", JSON.stringify(disclosed));
  assert.strictEqual(observed, spaced, "observed text was re-joined or trimmed — it is no longer byte-identical");
  assert.strictEqual(disclosed, spaced, "disclosed text was re-joined or trimmed — it is no longer byte-identical");
});

check("B5 · the LINT agrees with the softener in all three directions", () => {
  const observed = flatAssertionLint(SENTENCE, { grade: "observed" });
  const disclosed = flatAssertionLint(SENTENCE, { grade: "disclosed" });
  const inferred = flatAssertionLint(SENTENCE, { grade: "inferred" });
  show("lint(observed).ok ", observed.ok);
  show("lint(disclosed).ok", disclosed.ok);
  show("lint(inferred).ok ", inferred.ok);
  show("lint(inferred).hits", inferred.hits);
  assert.equal(observed.ok, true, "the lint flags something we measured");
  assert.equal(disclosed.ok, true, "the lint flags something the client told us");
  assert.equal(inferred.ok, false, "the lint passes an unhedged guess");
  assert.deepEqual(inferred.hits, [SENTENCE], "the lint did not name the offending sentence");
});

check("B6 · softener and lint never disagree, across all three grades", () => {
  // The pair is the point: the lint runs at generation, the softener at render.
  // If they ever disagreed, a sentence could be linted clean and then hedged (or
  // linted dirty and then shipped bare).
  const grades: EvidenceGrade[] = ["observed", "disclosed", "inferred"];
  for (const grade of grades) {
    const lintOk = flatAssertionLint(SENTENCE, { grade }).ok;
    const untouched = softenFlatAssertions(SENTENCE, { grade }) === SENTENCE;
    show(`${grade.padEnd(9)} lint.ok / softener left it untouched`, `${lintOk} / ${untouched}`);
    assert.strictEqual(
      lintOk,
      untouched,
      `lint and softener disagree at grade "${grade}" — the generation boundary and the render boundary would print different documents`
    );
  }
});

check("B7 · the OLD {tier, intakeConfirmed} call shape still behaves identically", () => {
  // verify-phase05 section B calls softenFlatAssertions with the legacy pair and
  // asserts byte-identity. That must keep working, and — more importantly — it
  // must land on exactly what the grade it derives would have done, or there are
  // two definitions of "measured / told / guessed" in the codebase again.
  const mismatches: string[] = [];
  for (const tier of ALL_TIERS) {
    for (const intakeConfirmed of ALL_CONFIRMED) {
      if (tier === undefined && intakeConfirmed === undefined) continue; // no context at all — belt (b)'s job, not belt (a)'s
      const legacy = softenFlatAssertions(SENTENCE, {
        tier: tier ?? undefined,
        intakeConfirmed: intakeConfirmed ?? undefined,
      });
      const viaGrade = softenFlatAssertions(SENTENCE, { grade: gradeOf({ tier, intakeConfirmed }) });
      if (legacy !== viaGrade)
        mismatches.push(`tier=${String(tier)} confirmed=${String(intakeConfirmed)}`);
    }
  }
  show("pairs compared", ALL_TIERS.length * ALL_CONFIRMED.length - 1);
  show("mismatches    ", mismatches.length ? mismatches : "none");
  assert.equal(mismatches.length, 0, `the legacy pair and the grade it derives no longer agree: ${mismatches.join(", ")}`);

  // The two exact calls verify-phase05 makes, asserted here too so a change that
  // breaks that script fails in this one as well, with the reason spelled out.
  show('softenFlatAssertions(s, { intakeConfirmed: true })', softenFlatAssertions(SENTENCE, { intakeConfirmed: true }));
  show('softenFlatAssertions(s, { tier: "OBSERVED" })     ', softenFlatAssertions(SENTENCE, { tier: "OBSERVED" }));
  assert.strictEqual(
    softenFlatAssertions(SENTENCE, { intakeConfirmed: true }),
    SENTENCE,
    "verify-phase05 B1 would now fail: an intake-confirmed fact is being hedged"
  );
  assert.strictEqual(
    softenFlatAssertions(SENTENCE, { tier: "OBSERVED" }),
    SENTENCE,
    "verify-phase05 B2 would now fail: an OBSERVED-tier finding is being hedged"
  );
});

check("B8 · an explicit grade OVERRIDES the legacy pair when both are passed", () => {
  // A half-migrated caller can supply both. The grade has to win, or the pair
  // becomes a second, quieter source of truth about how honest to be.
  const out = softenFlatAssertions(SENTENCE, { grade: "inferred", tier: "OBSERVED" });
  show("in  ", { grade: "inferred", tier: "OBSERVED" });
  show("out ", out);
  assert(/^Likely, /.test(out), "the legacy tier overrode the explicit grade — the grade is no longer the single source of truth");
});

check("B9 · a sentence that states its OWN provenance is protected with no context at all", () => {
  // Belt (b), and it is what the disclosed-attribution rule in section C is built
  // on: the same PROTECTED_MARKERS vocabulary the validator demands is what the
  // softener already refuses to hedge.
  const attributed = "You told us there is no follow-up after the first call.";
  show("in  (no opts)", attributed);
  show("out          ", softenFlatAssertions(attributed));
  show("carriesProvenanceMarker", carriesProvenanceMarker(attributed));
  assert.strictEqual(softenFlatAssertions(attributed), attributed, "a self-attributing sentence was hedged");
  assert.equal(carriesProvenanceMarker(attributed), true, "the validator would not recognise this as attribution");
  assert.equal(carriesProvenanceMarker(SENTENCE), false, "the bare sentence is being read as attributed — the marker list matches too much");
});

check("B10 · the RENDERED evidence label is chosen by GRADE, not by tier", () => {
  // The most visible expression of the grade, on the real committed deliverable:
  // the little label above each finding. The case that matters is the EVIDENCED
  // leak the client confirmed at intake — before this round it was labelled
  // "Signal in your reviews", handing the client their own answer back as our
  // finding. It has to read "You told us".
  // "What we observed and you confirmed" must come BEFORE "What we observed" in
  // any prefix-sensitive matching, and is listed first here for the same reason.
  const EVIDENCE_LABELS = [
    "You told us",
    "Confirmed at intake",
    "Industry pattern",
    "Signal in your reviews",
    "What we observed and you confirmed",
    "What we observed",
  ];
  const leaks = goldenPack.intelligence?.leakAnalysis ?? [];
  const wrong: string[] = [];
  let sawDisclosed = false;

  for (const l of leaks) {
    const html = renderLeakAnalysis([l]);
    const rendered =
      Array.from(html.matchAll(/<div class="k">([^<]+)<\/div>/g), (m) => m[1]).find((k) =>
        EVIDENCE_LABELS.includes(k)
      ) ?? "(no evidence label rendered)";
    // The rule, restated: grade first, tier second.
    const expected =
      l.evidenceGrade === "disclosed"
        ? "You told us"
        : // MEASURED **AND** ADMITTED — the strongest framing the document can
          // carry, and literally true. A leak we measured that the client also
          // confirmed gets both halves; observed alone keeps the plain label.
          l.evidenceGrade === "observed" && l.intakeConfirmed
          ? "What we observed and you confirmed"
          : l.evidenceTier === "BENCHMARK"
            ? l.intakeConfirmed
              ? "Confirmed at intake"
              : "Industry pattern"
            : l.evidenceTier === "EVIDENCED"
              ? "Signal in your reviews"
              : "What we observed";
    if (l.evidenceGrade === "disclosed") sawDisclosed = true;
    show(
      `${String(l.leakName ?? l.area).slice(0, 38).padEnd(38)} ${String(l.evidenceGrade).padEnd(9)} / ${String(l.evidenceTier).padEnd(9)}`,
      rendered === expected ? rendered : `${rendered}  (expected ${expected})`
    );
    if (rendered !== expected) wrong.push(`${l.leakName ?? l.area}: got "${rendered}", expected "${expected}"`);
  }

  assert(leaks.length > 0, "the fixture has no leaks to render");
  assert(
    sawDisclosed,
    "the fixture carries no disclosed leak, so the one case this check exists for is not being exercised"
  );
  assert.equal(wrong.length, 0, `the rendered label disagrees with the grade:\n          ${wrong.join("\n          ")}`);

  // Named explicitly, because it is the regression this whole round is about.
  const evidencedDisclosed = leaks.find((l) => l.evidenceGrade === "disclosed" && l.evidenceTier === "EVIDENCED");
  if (evidencedDisclosed) {
    const html = renderLeakAnalysis([evidencedDisclosed]);
    show("the case this exists for", `${evidencedDisclosed.leakName} — EVIDENCED tier, disclosed grade`);
    show("renders as              ", 'You told us (NOT "Signal in your reviews")');
    assert(
      html.includes("You told us") && !html.includes(">Signal in your reviews<"),
      "an EVIDENCED leak the client confirmed is still labelled as our own review signal — their answer is being handed back to them as our finding"
    );
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * C. THE VALIDATOR REALLY BLOCKS THE TWO NEW FAILURES
 *
 * Driven through assertPackValid — the real enforcing entry point the export
 * routes call — against the committed fixture. Every corruption below is a
 * one-field edit to a clone of that fixture, so the A/B is exact: nothing differs
 * between the passing and failing pack except the thing under test.
 * ══════════════════════════════════════════════════════════════════════════ */

section("C · THE VALIDATOR BLOCKS — an unhedged guess, and a disclosure with no attribution");

const INFERRED_CHECK = "Evidence grade · no declarative inference";
const DISCLOSED_CHECK = "Evidence grade · disclosure is attributed";

/** The level the named check reported on this pack, or "(absent)" when it did not
 *  run at all — which is itself a finding worth printing, because a check that
 *  silently stops running looks exactly like a check that passes. */
function levelOf(pack: AssetPack, law: string): string {
  const verdict = assertPackValid(pack);
  if (verdict.fails.some((c) => c.law === law)) return "fail";
  if (verdict.warns.some((c) => c.law === law)) return "warn";
  // assertPackValid only returns fails/warns, so a check that fired at "pass" is
  // not in either list. Re-read it from the full report text, which does carry it.
  return verdict.report.includes(law) ? "pass" : "(absent)";
}

function leakByGrade(pack: AssetPack, grade: EvidenceGrade): LeakAnalysisItem {
  const found = (pack.intelligence?.leakAnalysis ?? []).find((l) => l.evidenceGrade === grade);
  if (!found) throw new Error(`the fixture carries no "${grade}" leak — this check cannot be run against it`);
  return found;
}

// The flat assertion planted into the packs below — deliberately the SAME string
// section B ran through the softener, so the sentence proved un-shippable there is
// literally the sentence the validator is shown here. It matches
// FLAT_ASSERTION_PATTERNS, carries no hedge and states no provenance: exactly what
// an unguarded model writes about a leak nobody has measured or been told about.
const PLANTED_FLAT = SENTENCE;

check("C1 · the committed fixture PASSES, and both new checks ran and passed", () => {
  const verdict = assertPackValid(goldenPack);
  const leaks = goldenPack.intelligence?.leakAnalysis ?? [];
  show("fixture           ", GOLDEN_PATH);
  show("leaks             ", leaks.length);
  show("grade spread      ", countBy(leaks.map((l) => l.evidenceGrade ?? "(unstamped)")));
  show("assertPackValid.ok", verdict.ok);
  show(`${INFERRED_CHECK} `, levelOf(goldenPack, INFERRED_CHECK));
  show(`${DISCLOSED_CHECK}`, levelOf(goldenPack, DISCLOSED_CHECK));
  assert.equal(verdict.ok, true, `the committed fixture fails its own laws: ${verdict.fails.map((c) => c.law).join(", ")}`);
  // "Absent" would mean the fixture has no inferred (or no disclosed) leak at all,
  // which would make every corruption below meaningless.
  assert.equal(levelOf(goldenPack, INFERRED_CHECK), "pass", "the inferred-voice check did not run on the fixture");
  assert.equal(levelOf(goldenPack, DISCLOSED_CHECK), "pass", "the disclosure-attribution check did not run on the fixture");
});

check("C2 · an INFERRED leak written as flat fact ⇒ FATAL", () => {
  const corrupted = clonePack(goldenPack);
  const leak = leakByGrade(corrupted, "inferred");
  leak.explanation = `${leak.explanation ?? ""} ${PLANTED_FLAT}`.trim();
  const verdict = assertPackValid(corrupted);
  const fired = verdict.fails.find((c) => c.law === INFERRED_CHECK);
  show("leak            ", leak.leakName ?? leak.area);
  show("evidenceGrade   ", leak.evidenceGrade);
  show("planted sentence", PLANTED_FLAT);
  show("verdict.ok      ", verdict.ok);
  show("check name      ", fired?.law ?? "(did not fire)");
  show("check level     ", "fail (fatal — blocks the export)");
  show("message         ", fired?.message?.slice(0, 180) ?? "(none)");
  assert.equal(verdict.ok, false, "a guess stated as fact was allowed to ship");
  assert(fired, `expected "${INFERRED_CHECK}" to fire; got: ${verdict.fails.map((c) => c.law).join(", ") || "no failures at all"}`);
});

check("C3 · a DISCLOSED leak with NO provenance marker in its prose ⇒ FATAL", () => {
  // Surgical: the disclosed leak keeps every word it had except the sentences that
  // said whose fact it was. The finding is still right — it is the ATTRIBUTION
  // that has gone, which is exactly the failure the owner named.
  const corrupted = clonePack(goldenPack);
  const leak = leakByGrade(corrupted, "disclosed");
  const before = leak.evidence ?? "";
  stripProvenance(leak);
  const verdict = assertPackValid(corrupted);
  const fired = verdict.fails.find((c) => c.law === DISCLOSED_CHECK);
  show("leak         ", leak.leakName ?? leak.area);
  show("evidence BEFORE", before);
  show("evidence AFTER ", leak.evidence);
  show("prose still carries a marker", leakProseOf(leak).some((f) => carriesProvenanceMarker(f)));
  show("verdict.ok   ", verdict.ok);
  show("check name   ", fired?.law ?? "(did not fire)");
  show("check level  ", "fail (fatal — blocks the export)");
  show("message      ", fired?.message?.slice(0, 200) ?? "(none)");
  assert.equal(
    leakProseOf(leak).some((f) => carriesProvenanceMarker(f)),
    false,
    "the strip left a provenance marker behind — this check would be testing nothing"
  );
  assert.equal(verdict.ok, false, "a client's own answer was allowed to ship as our discovery");
  assert(fired, `expected "${DISCLOSED_CHECK}" to fire; got: ${verdict.fails.map((c) => c.law).join(", ") || "no failures at all"}`);
});

check("C4 · the SAME disclosed leak WITH its marker passes", () => {
  // The untouched fixture. Same leak, same grade, same prose minus the one edit
  // above — so the difference between C3 and C4 is precisely the attribution.
  const leak = leakByGrade(goldenPack, "disclosed");
  const attributed = leakProseOf(leak).filter((f) => carriesProvenanceMarker(f));
  show("leak            ", leak.leakName ?? leak.area);
  show("attributed prose", attributed[0]?.slice(0, 160) ?? "(none)");
  show(`${DISCLOSED_CHECK}`, levelOf(goldenPack, DISCLOSED_CHECK));
  show("assertPackValid.ok", assertPackValid(goldenPack).ok);
  assert(attributed.length > 0, "the fixture's disclosed leak states no provenance — C3's A/B is not a real pair");
  assert.equal(levelOf(goldenPack, DISCLOSED_CHECK), "pass", "the attributed disclosure was blocked");
});

check("C5 · an UNSTAMPED leak is held to the INFERRED rule, whatever its tier says", () => {
  // The strictest reading, and it is deliberate. Take an OBSERVED leak — exempt by
  // grade — plant the flat assertion, and confirm it ships. Then delete the grade
  // field alone. The tier still says OBSERVED, but nobody recorded a grade, and
  // "nobody recorded it" must never be the reason a sentence reads as measured.
  const withGrade = clonePack(goldenPack);
  const a = leakByGrade(withGrade, "observed");
  a.explanation = `${a.explanation ?? ""} ${PLANTED_FLAT}`.trim();
  const gradedLevel = levelOf(withGrade, INFERRED_CHECK);

  const ungraded = clonePack(withGrade);
  const b = (ungraded.intelligence?.leakAnalysis ?? []).find((l) => (l.leakName ?? l.area) === (a.leakName ?? a.area));
  if (!b) throw new Error("could not locate the same leak in the second clone");
  delete b.evidenceGrade;
  const ungradedVerdict = assertPackValid(ungraded);

  show("leak                     ", a.leakName ?? a.area);
  show("evidenceTier             ", a.evidenceTier);
  show("with evidenceGrade       ", `"${a.evidenceGrade}" ⇒ ${INFERRED_CHECK} = ${gradedLevel}`);
  show("with the grade DELETED   ", `(absent) ⇒ ${INFERRED_CHECK} = ${levelOf(ungraded, INFERRED_CHECK)}`);
  show("ungraded verdict.ok      ", ungradedVerdict.ok);
  assert.equal(gradedLevel, "pass", "an OBSERVED-graded leak was blocked — the exemption by grade is gone");
  assert.equal(
    levelOf(ungraded, INFERRED_CHECK),
    "fail",
    "deleting the grade let the flat assertion through — a missing field is licensing a statement of fact"
  );
});

check("C6 · the two new checks are FATAL, not advisory", () => {
  // A check that only warns is a check the export boundary walks straight past.
  const c2 = clonePack(goldenPack);
  const l2 = leakByGrade(c2, "inferred");
  l2.explanation = `${l2.explanation ?? ""} ${PLANTED_FLAT}`.trim();
  const c3 = clonePack(goldenPack);
  stripProvenance(leakByGrade(c3, "disclosed"));

  for (const [law, pack] of [[INFERRED_CHECK, c2], [DISCLOSED_CHECK, c3]] as const) {
    const verdict = assertPackValid(pack);
    show(`${law} → level`, verdict.fails.some((c) => c.law === law) ? "fail (blocks)" : "NOT FATAL");
    show(`${law} → ok   `, verdict.ok);
    assert(
      verdict.fails.some((c) => c.law === law),
      `"${law}" is not returning at level "fail", so the export boundary would ship over it`
    );
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * D. PRE-SALE CANNOT CONTAIN A DISCLOSURE, STRUCTURALLY
 *
 * READ THE LABELS. Two of these checks are COMPILE-TIME guarantees — the code
 * does not build — and the rest are RUNTIME backstops behind them. They are not
 * the same strength of promise and this section never lets them blur: a runtime
 * throw catches a mistake once it is running, a compile error stops it existing.
 *
 * WHAT DIED HERE (2026-08-01, cold-audit deletion). D3, D4 and D7 proved the
 * same discipline on the cold-audit GENERATION path (PreSaleGenerationContext,
 * the pipeline's mode declaration, assertNoDisclosedFindings on a stored
 * report). That entire surface was deleted by ruling, so those checks died with
 * their subject. D6 — the runtime throw inside detectLeaks — also died, because
 * detectLeaks went MODE-BLIND when its one pre-sale caller was deleted; D6b is
 * its structural replacement. D1/D2/D5 stay, and they are not history: the
 * pre_sale variant of RawResearch SURVIVES as the contract behind the
 * observed-facts row (src/lib/observed-facts.ts declares `mode: "pre_sale"` for
 * exactly this guarantee), so "a pre-sale surface cannot carry intake" is still
 * a live law with a live consumer.
 * ══════════════════════════════════════════════════════════════════════════ */

section("D · PRE-SALE CANNOT CONTAIN A DISCLOSURE — nothing is disclosed before the sale");

check("D1 · [COMPILE-TIME] the pre-sale input variant declares `intake?: never`", () => {
  const src = read("src/lib/leak-detection.ts");
  const start = src.indexOf("export interface PreSaleResearch");
  assert(start >= 0, "PreSaleResearch no longer exists — the pre-sale shape has been merged back into the general one");
  const body = src.slice(start, src.indexOf("\n}", start));
  const declaredAt = src.slice(0, start).split("\n").length; // 1-based line of the interface
  const offset = body.split("\n").findIndex((l) => /intake\?:\s*never/.test(l));
  const line = offset >= 0 ? body.split("\n")[offset].trim() : null;
  show("declaration", `L${declaredAt}  export interface PreSaleResearch extends RawResearchBase`);
  show("matched line", line ? `L${declaredAt + offset}  ${line}` : "(NOT FOUND)");
  show("mode discriminator", /mode:\s*"pre_sale"/.test(body) ? 'mode: "pre_sale"' : "(NOT FOUND)");
  show("guarantee  ", "COMPILE-TIME — `never` means no value at all typechecks, so intake cannot be supplied");
  assert(line, "PreSaleResearch no longer types `intake` as `never` — a pre-sale caller can pass intake again");
  assert(/mode:\s*"pre_sale"/.test(body), "PreSaleResearch lost its `mode: \"pre_sale\"` discriminator, so the variant can no longer be selected");
});

check("D2 · [COMPILE-TIME] the REAL compiler refuses a pre-sale detection carrying intake", () => {
  // The strongest form of this proof, and the reason it is worth the extra second:
  // everything else in this section is a string match or a runtime throw. This runs
  // tsc over the shipped types and shows the actual error, with a CONTROL probe
  // beside it so a broken environment cannot masquerade as a passing check.
  const probe = compileProbe();
  show("control probe (no intake)   ", probe.controlSource);
  show("control errors              ", probe.controlErrors.length ? probe.controlErrors : "none — it compiles");
  show("disclosure probe (+ intake) ", probe.disclosureSource);
  show("disclosure errors           ", probe.disclosureErrors.length ? probe.disclosureErrors : "NONE — IT COMPILED");
  show("guarantee                   ", "COMPILE-TIME — this code cannot be built, so it cannot be shipped");
  assert.equal(
    probe.controlErrors.length,
    0,
    `the CONTROL probe failed to compile, so the check below proves nothing about intake:\n          ${probe.controlErrors.join("\n          ")}`
  );
  assert(
    probe.disclosureErrors.length > 0,
    "a pre-sale detectLeaks call carrying intake COMPILES — the structural guarantee is gone and only the runtime backstop remains"
  );
  assert(
    probe.disclosureErrors.some((e) => /intake/.test(e)),
    `the probe failed to compile, but not because of \`intake\`: ${probe.disclosureErrors.join(" | ")}`
  );
});

// D3 · D4 — DELETED 2026-08-01. They pinned PreSaleGenerationContext
// (src/lib/cold-audit.ts) and the cold-audit pipeline's `mode: "pre_sale"`
// declaration (src/lib/cold-audit-pipeline.ts). Both files were deleted with the
// pre-sale generative surface; the checks died with their subject. The surviving
// consumer of the pre_sale discriminator is src/lib/observed-facts.ts, and D3b
// below pins THAT declaration so the compile-time story keeps a live anchor.

check("D3b · [COMPILE-TIME] the observed-facts row declares mode: \"pre_sale\" — the surviving consumer", () => {
  // The cold audit's replacement is a row of four measured numbers, and it reads
  // the SAME pre-sale variant D1/D2 prove. This anchors the declaration so the
  // guarantee cannot quietly become a type nobody instantiates.
  const line = sourceLine("src/lib/observed-facts.ts", /^\s*mode:\s*"pre_sale",\s*$/);
  const typed = read("src/lib/observed-facts.ts").includes("PreSaleResearch");
  show("file        ", "src/lib/observed-facts.ts");
  show("matched line", line ? `L${line.line}  ${line.text}` : "(NOT FOUND)");
  show("typed as PreSaleResearch", typed);
  show("guarantee   ", "COMPILE-TIME — this is what selects PreSaleResearch at the row's call site");
  assert(line, "observed-facts.ts no longer declares mode: \"pre_sale\" — the row now compiles under the unguaranteed variant");
  assert(typed, "observed-facts.ts no longer types its research as PreSaleResearch — the compile gate has no live consumer");
});

check("D5 · [RUNTIME] a real pre-sale detection produces NO disclosed leak", () => {
  const detected = detectLeaks(PRE_SALE_RESEARCH);
  const disclosed = detected.fired.filter((f) => f.grade === "disclosed");
  show("mode           ", "pre_sale");
  show("fired leaks    ", detected.fired.length);
  show("grade spread   ", countBy(detected.fired.map((f) => f.grade)));
  show("disclosed fires", disclosed.length ? disclosed.map((f) => f.leak.id) : "none");
  show("guarantee      ", "RUNTIME — this is the behaviour, not the structural promise");
  assert(detected.fired.length > 0, "the pre-sale fixture fired nothing — this check would be vacuous");
  assert.equal(disclosed.length, 0, `a pre-sale scan produced disclosed leak(s): ${disclosed.map((f) => f.leak.id).join(", ")}`);
});

// D6 (the runtime throw on smuggled pre-sale intake) — DELETED 2026-08-01. The
// backstop lived inside detectLeaks and policed the cold-audit generator, the
// one surface that ran pre-sale detections; detectLeaks is deliberately
// MODE-BLIND now (its own doc comment records the ruling) and the generator is
// gone. D6b below is the replacement, and it is structural rather than
// behavioural: with no runtime drop left, the guarantee is that no pre-sale
// detectLeaks CALLER exists at all.

check("D6b · [SOURCE] detectLeaks is mode-blind by ruling, and NO src call site passes pre_sale", () => {
  // Two halves. The mode-blind state is pinned so a future "helpful" restoration
  // of a silent pre-sale branch fails loudly here and gets decided on purpose;
  // and the absence of pre-sale callers is scanned across all of src/, because
  // that absence is now the entire runtime story — the compile gate (D1/D2)
  // stops intake reaching a pre-sale call, and this stops a pre-sale call
  // existing to receive an interpretive fire.
  const detection = read("src/lib/leak-detection.ts");
  const modeBlind = /MODE-BLIND SINCE 2026-08-01/.test(detection);
  show("detectLeaks documents itself mode-blind", modeBlind);
  assert(
    modeBlind,
    "leak-detection.ts no longer records the mode-blind ruling — if runtime mode branches are being reintroduced, " +
      "this check is where that reversal gets decided out loud"
  );

  const srcFiles = allSrcTsFiles();
  const preSaleCallers = srcFiles.filter((rel) =>
    /detectLeaks\(\s*\{[^}]*mode:\s*"pre_sale"/.test(codeOnly(rel))
  );
  show("src files scanned", srcFiles.length);
  show("pre-sale detectLeaks call sites", preSaleCallers.length ? preSaleCallers : "(none)");
  show("guarantee ", "SOURCE — the pre-sale variant's only consumer is the observed-facts row, which composes no findings");
  assert.deepEqual(
    preSaleCallers,
    [],
    `a pre-sale detectLeaks call site exists again (${preSaleCallers.join(", ")}) — with the runtime drop deleted, ` +
      "nothing would keep an interpretive fire out of whatever that surface renders"
  );
});

// D7 — DELETED 2026-08-01. It read a stored cold audit back through
// assertNoDisclosedFindings / assertColdAuditValid, both of which were deleted
// with the pre-sale surface. There is no stored pre-sale document any more to
// read back (COLD_AUDIT rows are soft-deleted and never rendered), so the
// read-back gate has no surface to guard. The paid pack's read-back gate —
// validatePack on the saved artifact — is exercised in section C above and in
// verify-fabrication's artifact checks.

/* ════════════════════════════════════════════════════════════════════════════
 * E. THE GAP LIST IS REAL AND COMPLETE
 *
 * The operator-facing half of the round: not "the document hedges correctly" but
 * "here is what you failed to collect, and here is the question that would fix
 * it". A list produced BY THE CODE from the taxonomy — a hand-maintained one
 * would drift the first time a leak was added.
 * ══════════════════════════════════════════════════════════════════════════ */

section("E · THE GAP LIST — what we still don't know, and which question would fix it");

const NO_INTAKE_GAPS = inferredGaps(getFiredLeaks(PROBE_SCRAPE));

check("E1 · a business with NO intake ⇒ every still-guessed leak is listed with its question", () => {
  const fired = getFiredLeaks(PROBE_SCRAPE);
  const stillInferred = fired.filter((f) => f.grade === "inferred").map((f) => f.leak.id).sort();
  const listed = NO_INTAKE_GAPS.map((g) => g.leakId).sort();
  show("fired leaks        ", fired.length);
  show("grade spread       ", countBy(fired.map((f) => f.grade)));
  show("still inferred     ", stillInferred);
  show("inferredGaps() says", listed);
  for (const g of NO_INTAKE_GAPS)
    show(`  ${g.leakId.padEnd(26)}`, g.ask ? `ask ${String(g.ask.field)} — "${g.ask.question}"` : "STRUCTURAL — no question we ask can resolve it");
  assert(NO_INTAKE_GAPS.length > 0, "no gaps reported for a business we know nothing about — the list cannot be right");
  assert.deepEqual(
    listed,
    stillInferred,
    "the gap list and the fired set disagree about which leaks are still guesses — one of them is recomputing the grade instead of reading it"
  );
});

check("E2 · answering ONE intake field removes exactly that leak from the list", () => {
  // missedCallHandling is the cleanest single-variable test: the answer CONFIRMS
  // the gap rather than suppressing it, so the leak still fires — it just stops
  // being a guess. A field that suppressed the leak would prove the wrong thing.
  const answered: ClientIntake = { missedCallHandling: "VOICEMAIL_ONLY" };
  const firedAfter = getFiredLeaks({ ...PROBE_SCRAPE, intake: answered });
  const after = inferredGaps(firedAfter);
  const before = NO_INTAKE_GAPS.map((g) => g.leakId);
  const afterIds = after.map((g) => g.leakId);
  const removed = before.filter((id) => !afterIds.includes(id));
  const target = firedAfter.find((f) => f.leak.id === "missed_calls_no_recovery");

  show("intake answered   ", answered);
  show("BEFORE — gaps     ", `${before.length}: ${before.join(", ")}`);
  show("AFTER  — gaps     ", `${afterIds.length}: ${afterIds.join(", ")}`);
  show("left the list     ", removed);
  show("that leak still fires", Boolean(target));
  show("its grade before/after", `inferred → ${target?.grade}`);
  assert.deepEqual(removed, ["missed_calls_no_recovery"], `expected exactly the answered leak to leave the list, got: ${removed.join(", ")}`);
  assert(target, "the answered leak stopped firing — the intake suppressed it instead of confirming it, which tests the wrong thing");
  assert.strictEqual(target.grade, "disclosed", `the answered leak is graded "${target.grade}" — an answered question is still being treated as a guess`);
  assert.equal(afterIds.length, before.length - 1, "more than one leak moved — the two runs differ by more than the single answer");
});

check("E3 · intakeFieldsForZeroInferred() is non-empty and every field is a REAL ClientIntake key", () => {
  const fields = intakeFieldsForZeroInferred();
  const real = clientIntakeKeysFromSource();
  show("ClientIntake keys, read from src/lib/leak-taxonomy.ts", real);
  show("questions returned", fields.length);
  for (const f of fields) show(`  ${String(f.field).padEnd(22)}`, `upgrades ${f.upgrades.join(", ")} — "${f.question}"`);

  // Anti-vacuity: if the parse ever returned nothing (or everything), the
  // membership test below would pass for free. Both directions are checked.
  assert(real.length >= 10, `only ${real.length} ClientIntake key(s) parsed out of the interface — the source read is broken, not the list`);
  assert(!real.includes("notAClientIntakeField"), "the parsed key set matches things that are not in the interface");
  assert(fields.length > 0, "the complete question set is empty — the operator gets no list at all");

  const bogus = fields.filter((f) => !real.includes(String(f.field)));
  show("fields not present on ClientIntake", bogus.length ? bogus.map((f) => String(f.field)) : "none");
  assert.equal(bogus.length, 0, `the gap list asks about fields the intake form has no slot for: ${bogus.map((f) => String(f.field)).join(", ")}`);

  // De-duplicated, in taxonomy order, and each answer says what it upgrades.
  const seen = new Set<string>();
  for (const f of fields) {
    assert(!seen.has(String(f.field)), `field "${String(f.field)}" is listed twice — the operator would ask the same question twice`);
    seen.add(String(f.field));
    assert(f.question.trim().length > 0, `field "${String(f.field)}" carries no question — the operator cannot ask a blank`);
    assert(f.upgrades.length > 0, `field "${String(f.field)}" upgrades nothing — it should not be on the list`);
  }
});

check("E4 · every ask is quoted from the taxonomy and can only ever upgrade to 'disclosed'", () => {
  const withAsk = LEAKS.filter((l) => l.intakeAsk);
  show("leaks carrying an intakeAsk", withAsk.length);
  for (const l of withAsk) show(`  ${l.id.padEnd(26)}`, `${String(l.intakeAsk?.field)} ⇒ ${l.intakeAsk?.upgradesTo}`);
  const wrong = withAsk.filter((l) => l.intakeAsk?.upgradesTo !== "disclosed");
  assert(withAsk.length > 0, "no leak carries an intake question at all");
  assert.equal(
    wrong.length,
    0,
    `an intake answer claims to upgrade a leak to something other than "disclosed": ${wrong.map((l) => l.id).join(", ")}. An answer can only ever turn a guess into something they told us — never into something we measured.`
  );
});

check("E5 · the honest split — leaks no question can resolve are STRUCTURAL, not to-dos", () => {
  const structural = NO_INTAKE_GAPS.filter((g) => g.ask === null);
  const collectible = NO_INTAKE_GAPS.filter((g) => g.ask !== null);
  show("gaps total       ", NO_INTAKE_GAPS.length);
  show("collectible (a question exists)", collectible.map((g) => g.leakId));
  show("structural (no question exists)", structural.map((g) => g.leakId));
  for (const g of structural) {
    const leak = LEAKS.find((l) => l.id === g.leakId);
    show(`  ${g.leakId.padEnd(26)}`, `taxonomy declares intakeAsk: ${leak?.intakeAsk ? "PRESENT" : "absent"} — the null is a fact, not a lookup miss`);
    assert(leak, `gap "${g.leakId}" names a leak that is not in the taxonomy`);
    assert(!leak.intakeAsk, `gap "${g.leakId}" is reported as structural but the taxonomy DOES carry a question for it — the operator is being told to give up on something he could just ask`);
  }
  assert.equal(structural.length + collectible.length, NO_INTAKE_GAPS.length, "a gap is neither collectible nor structural");

  // THE SPLIT IS COMPUTED FROM THE TAXONOMY, NOT FROM A COUNT. This used to assert
  // structural.length > 0, which was right when two leaks had no question that
  // could ever confirm them. Both have since been given one (socialEnquiries and
  // pastCustomerContact), so ZERO structural gaps is now the SUCCESS state — the
  // form can, in principle, resolve every leak it fires. Asserting a non-zero
  // count would now be asserting the old world, and would punish the very fix it
  // was written to motivate.
  //
  // What still has to hold — and is the thing worth proving — is that each gap
  // lands on the correct side for a REAL reason: ask === null exactly when the
  // taxonomy carries no question. That is checked per-gap below, in both
  // directions, so the split stays honest at any count.
  for (const g of NO_INTAKE_GAPS) {
    const leak = LEAKS.find((l) => l.id === g.leakId);
    assert(leak, `gap "${g.leakId}" names a leak that is not in the taxonomy`);
    assert.equal(
      g.ask === null,
      !leak.intakeAsk,
      `gap "${g.leakId}" is sorted onto the wrong side of the split: the panel says ask=${
        g.ask === null ? "null" : "present"
      } but the taxonomy says intakeAsk=${leak.intakeAsk ? "present" : "absent"}`
    );
  }
  show(
    "split check",
    `all ${NO_INTAKE_GAPS.length} gap(s) sorted correctly; ${structural.length} structural (0 is the goal — every fired leak is now askable)`
  );

  // THE HONEST CAVEAT, MADE MECHANICAL. Answering every question on the complete
  // list clears every leak that CAN be cleared — and these ones stay inferred no
  // matter how good the call was. If a structural gap ever appeared in the
  // upgrade set, the list would be promising something it cannot deliver.
  const upgradable = new Set(intakeFieldsForZeroInferred().flatMap((f) => f.upgrades));
  const overclaimed = structural.filter((g) => upgradable.has(g.leakId));
  show("leaks the complete question set claims to upgrade", Array.from(upgradable));
  show("structural gaps wrongly claimed as upgradable    ", overclaimed.length ? overclaimed.map((g) => g.leakId) : "none");
  assert.equal(
    overclaimed.length,
    0,
    `the complete question set claims to resolve leaks nothing on the intake form can: ${overclaimed.map((g) => g.leakId).join(", ")}`
  );
});

check("E6 · answering EVERY collectible question leaves only the structural gaps", () => {
  // The end-to-end statement of the caveat above, driven rather than argued: fill
  // in every answer that CONFIRMS a gap, and what is left over is exactly the set
  // of leaks no question we ask could ever have resolved.
  const fired = getFiredLeaks({ ...PROBE_SCRAPE, intake: CONFIRM_EVERYTHING });
  const remaining = inferredGaps(fired);
  const structuralIds = NO_INTAKE_GAPS.filter((g) => g.ask === null).map((g) => g.leakId).sort();
  const remainingIds = remaining.map((g) => g.leakId).sort();
  show("intake answered      ", CONFIRM_EVERYTHING);
  show("gaps before          ", NO_INTAKE_GAPS.length);
  show("gaps after           ", remaining.length);
  show("remaining            ", remainingIds);
  show("expected (structural)", structuralIds);
  assert(remaining.every((g) => g.ask === null), `a gap with a question survived a fully answered intake: ${remaining.filter((g) => g.ask).map((g) => g.leakId).join(", ")}`);
  assert.deepEqual(remainingIds, structuralIds, "the leftover set is not the structural set — a question is either not being asked or not being read");
});

/* ════════════════════════════════════════════════════════════════════════════
 * HELPERS
 * Inputs and small utilities for the checks above. Kept at the bottom so the
 * claims read first — these are all hoisted `function` declarations, so calling
 * them from a check() callback further up is safe.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The rendered PROSE fields of a leak — the same five the pack validator lints.
 *  Kept in step with leakProse() in validate-pack.ts; if that list grows, C3's
 *  strip has to grow with it or the check would stop being airtight. */
function leakProseOf(l: LeakAnalysisItem): string[] {
  return [l.evidence, l.explanation, l.businessImpact, l.recommendedFix, l.industryPattern].filter(
    (s): s is string => Boolean(s?.trim())
  );
}

/** Remove every sentence that states its own provenance, leaving the finding
 *  itself intact. Done by CONSULTING carriesProvenanceMarker rather than by
 *  deleting a hard-coded sentence, so the corruption stays correct if the marker
 *  vocabulary changes. */
function stripProvenance(l: LeakAnalysisItem): void {
  const scrub = (text: string | undefined): string | undefined => {
    if (!text) return text;
    const kept = text
      .split(/(?<=[.!?])\s+/)
      .filter((s) => !carriesProvenanceMarker(s))
      .join(" ")
      .trim();
    return kept;
  };
  l.evidence = scrub(l.evidence) ?? "";
  l.explanation = scrub(l.explanation) ?? "";
  l.businessImpact = scrub(l.businessImpact) ?? "";
  l.recommendedFix = scrub(l.recommendedFix) ?? "";
  if (l.industryPattern) l.industryPattern = scrub(l.industryPattern);
}

/** The property names actually declared on ClientIntake, parsed out of the
 *  interface itself.
 *
 *  WHY PARSE RATHER THAN LIST. `keyof ClientIntake` is erased at runtime, so a
 *  script can only compare against a list typed in by hand — and a hand-typed list
 *  is exactly what goes stale when a field is renamed, quietly turning "every ask
 *  points at a real intake field" into "every ask points at a field somebody wrote
 *  down here in July". Reading the declaration keeps the check honest. */
function clientIntakeKeysFromSource(): string[] {
  const src = read("src/lib/leak-taxonomy.ts");
  const start = src.indexOf("export interface ClientIntake {");
  if (start < 0)
    throw new Error(
      "ClientIntake is no longer declared in src/lib/leak-taxonomy.ts — this check reads the real interface and must not fall back to a list typed in here"
    );
  const end = src.indexOf("\n}", start);
  const body = src.slice(start, end);
  // Property lines only: two spaces of indent, a name, then `?:` or `:`. Doc
  // comments start with `/` or `*`, and union members continue at four spaces —
  // neither can match.
  return Array.from(body.matchAll(/^ {2}(\w+)\??:/gm), (m) => m[1]);
}

/**
 * RUN THE REAL COMPILER over two probe files and report what it said.
 *
 * The control probe is a valid pre-sale detection; the disclosure probe is the
 * same call with `intake` added. Both are compiled in ONE pass against the repo's
 * own tsconfig, so the two results come from an identical environment — that is
 * what makes the control meaningful. Without it, a missing dependency or a broken
 * path mapping would make the disclosure probe "fail to compile" for the wrong
 * reason and this check would go green on nothing.
 *
 * The probes are written to a temp directory rather than into the repo because a
 * file that is SUPPOSED to fail typecheck cannot live under a tsconfig `include`
 * that `npm run typecheck` also reads — it would break the very suite it is here
 * to defend.
 */
function compileProbe(): {
  controlSource: string;
  controlErrors: string[];
  disclosureSource: string;
  disclosureErrors: string[];
} {
  const CONTROL = [
    'import { detectLeaks } from "@/lib/leak-detection";',
    "declare const intel: never;",
    "declare const scrape: never;",
    'detectLeaks({ mode: "pre_sale", business: { name: "Probe" }, intel, scrape });',
  ].join("\n");
  const DISCLOSURE = [
    'import { detectLeaks } from "@/lib/leak-detection";',
    "declare const intel: never;",
    "declare const scrape: never;",
    'detectLeaks({ mode: "pre_sale", business: { name: "Probe" }, intel, scrape, intake: { avgJobValueCad: 1200 } });',
  ].join("\n");

  const tsc = resolve(REPO, "node_modules/typescript/bin/tsc");
  if (!existsSync(tsc))
    throw new Error(
      `the TypeScript compiler is not installed at ${tsc} — this check compiles real code and cannot be approximated by reading the source`
    );

  const dir = mkdtempSync(join(tmpdir(), "verify-phase1-compile-"));
  try {
    writeFileSync(join(dir, "control.ts"), `${CONTROL}\n`);
    writeFileSync(join(dir, "disclosure.ts"), `${DISCLOSURE}\n`);
    writeFileSync(
      join(dir, "tsconfig.json"),
      `${JSON.stringify(
        {
          // The repo's real config, so the probes are checked under exactly the
          // settings `npm run typecheck` uses. `incremental` is off because this
          // config has no build info of its own to reuse.
          extends: resolve(REPO, "tsconfig.json"),
          compilerOptions: {
            noEmit: true,
            incremental: false,
            // The probes live outside the repo, so type-root discovery would walk
            // up from /tmp and find no @types at all — every `process` reference in
            // the imported graph would then error for an unrelated reason.
            typeRoots: [resolve(REPO, "node_modules/@types")],
          },
          include: ["control.ts", "disclosure.ts"],
        },
        null,
        2
      )}\n`
    );

    const r = spawnSync(process.execPath, [tsc, "-p", join(dir, "tsconfig.json")], {
      cwd: dir,
      encoding: "utf8",
    });
    if (r.error) throw r.error;

    // Diagnostics are matched on the FILE NAME, not on a path prefix: tsc reports
    // paths relative to the project root it inferred (the repo, because that is
    // where the extended tsconfig lives), so the probes come back as a long
    // "../../../..//tmp/…/disclosure.ts" and a prefix test would silently match
    // nothing — which reads exactly like "it compiled".
    const diagnostics: { file: string; text: string }[] = [];
    for (const line of `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n")) {
      if (!line.trim()) continue;
      const m = /^(?:.*[/\\])?([\w.-]+\.tsx?)\(\d+,\d+\):/.exec(line);
      // The leading path is a temp directory nobody needs to read; the file name,
      // the position and the reason are the evidence.
      if (m) diagnostics.push({ file: m[1], text: line.trim().slice(line.trim().indexOf(m[1])) });
      // TS wraps the "why" of an error onto indented continuation lines. They are
      // the most useful part of this particular error, so they are kept attached
      // to the diagnostic they explain rather than dropped.
      else if (diagnostics.length && /^\s/.test(line))
        diagnostics[diagnostics.length - 1].text += ` ${line.trim()}`;
    }
    const errorsIn = (file: string): string[] =>
      diagnostics.filter((d) => d.file === file).map((d) => d.text);

    return {
      controlSource: CONTROL.split("\n").slice(-1)[0],
      controlErrors: errorsIn("control.ts"),
      disclosureSource: DISCLOSURE.split("\n").slice(-1)[0],
      disclosureErrors: errorsIn("disclosure.ts"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
