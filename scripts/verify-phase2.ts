/**
 * PHASE 2 PROOF — the build, as data, demonstrated against the REAL shipped code,
 * offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase2.ts
 *   npm run verify:phase2
 *
 * Every check prints its own inputs and outputs so a reader can audit the claim
 * without trusting the assertion. Exits 1 if ANY check fails.
 *
 * THE ROUND IN ONE SENTENCE: Phase 1 made the software honest about what it KNOWS;
 * this round makes it honest about what it BUILDS — the fourteen workflows are
 * written down once, they are installed unless a fact about the client takes one
 * out, and a workflow the client's own report calls a measured finding cannot be
 * switched off behind his back.
 *
 *   A. THE TWO NEW INTAKE      — socialEnquiries and pastCustomerContact, all three
 *      FIELDS CLOSE THEIR        branches each (suppress / confirm / hedge) against
 *      GAPS                      the real detectors; then the payoff — the two
 *                                leaks that could never stop being guesses are now
 *                                COLLECTIBLE, and one answer moves each from
 *                                "inferred" to "disclosed". Includes the one case
 *                                that is easy to get backwards: "NO" and
 *                                "NO_ACCOUNTS" are the same answer to the LEAK and
 *                                different answers to the BUILD.
 *   B. THE DUAL LABEL          — a leak we MEASURED that they ALSO confirmed renders
 *                                both facts; either half alone renders its own
 *                                label. Driven through the real renderer on the
 *                                real committed fixture.
 *   C. THE CATALOGUE IS        — fourteen workflows, exact names, stable ids, every
 *      COMPLETE AND HONEST      cited leak real; and THE RULE THAT MATTERS — a
 *                                workflow with no fired leak is still installed.
 *                                The leak is optional evidence, never a
 *                                precondition.
 *   D. TOGGLE RESOLUTION AND   — operator > rule > default, an applicability fact
 *      THE EVIDENCE LOCK        switching a workflow out and back in, and the
 *                                subtle one: an OBSERVED leak locks its workflow ON
 *                                and a stored `false` is IGNORED (not deleted).
 *                                Disclosed and inferred deliberately do not lock.
 *   E. SCOPE HYGIENE           — the toggle layer never reads servicesFocus. Copy
 *                                emphasis must never change what gets built.
 *
 * READ THE LABELS. Some checks below prove a COMPILE-TIME guarantee (the code does
 * not build) and some prove RUNTIME behaviour (the code behaves). They are not the
 * same strength of promise, so every check that makes a structural claim says which
 * it is — the same discipline as section D of scripts/verify-phase1.ts.
 */

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  inferredGaps,
  intakeFieldsForZeroInferred,
  LEAKS,
  type ClientIntake,
  type ScrapeData,
} from "@/lib/leak-taxonomy";
import { getFiredLeaks, reportLeaks, type FiredLeak } from "@/lib/leak-detection";
import { renderLeakAnalysis } from "@/lib/exporters/deliverables";
import {
  WORKFLOWS,
  verifyWorkflowCatalogue,
  workflowById,
  type WorkflowToggles,
} from "@/lib/workflow-catalogue";
import {
  readStoredToggles,
  resolveWorkflows,
  resolvedWorkflowById,
  toToggleRow,
  withOverride,
  type ResolvedWorkflow,
} from "@/lib/workflow-toggles";
import type { AssetPack, LeakAnalysisItem } from "@/types";

// ── harness ───────────────────────────────────────────────────────────────────
// Identical shape to scripts/verify-phase1.ts: a counting check() that never
// throws, plus an explicit PASS/FAIL word on every line so the output is greppable
// by a human and by CI alike.
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
 *  source-level claim ("the catalogue imports nothing from detection") can be
 *  PRINTED and read, not just asserted about. Returns null when nothing matches,
 *  which is always meaningful at the call site. */
function sourceLine(rel: string, re: RegExp): { line: number; text: string } | null {
  const lines = read(rel).split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (re.test(lines[i])) return { line: i + 1, text: lines[i].trim() };
  }
  return null;
}

/**
 * Source with every comment removed, so a check about what the CODE does cannot be
 * satisfied — or defeated — by prose.
 *
 * This matters more here than anywhere else in the suite: section E asserts the
 * toggle layer never reads `servicesFocus`, and the file that must not read it
 * opens with four paragraphs explaining why it must not read it. A naive
 * `includes("servicesFocus")` would fail on the explanation and pass on the day
 * somebody deletes the explanation and adds the field.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, including the doc headers
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // line comments, but not "https://"
}

/** Frequency table, for printing a grade spread without a bar chart's worth of code. */
function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

const firedById = (fired: FiredLeak[], id: string): FiredLeak | undefined =>
  fired.find((f) => f.leak.id === id);
const firedIds = (fired: FiredLeak[]): string[] => fired.map((f) => f.leak.id);

/* ════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES — one synthetic business, in the shapes the checks need.
 *
 * Invented, like the golden pack and for the same reason: a .example domain that
 * can never resolve and a phone number in the reserved 555-01xx block, so nothing
 * in this file traces to a real prospect.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Tuned so BOTH new fields have something to act on and both lock-grades exist in
 * one fired set:
 *   · linksToFacebook true   — social_dm_unmanaged fires on its benchmark path with
 *                              no intake at all, so the hedge branch is real and the
 *                              suppress/confirm branches are comparable against it.
 *   · 40 reviews vs a 110    — an ESTABLISHED business (≥20 reviews), so
 *     competitor median        no_database_reactivation reaches its benchmark path;
 *                              and under half the local median, so
 *                              low_review_velocity fires OBSERVED, which is what
 *                              gives section D a real lock to test.
 *   · no booking, no chat,   — several more OBSERVED fires (booking, webchat,
 *     limited hours            after-hours, qualification) so the lock is not
 *                              resting on one detector.
 *   · reviewTexts empty      — no review proxy, so no detector jumps to EVIDENCED
 *                              and masks what an intake answer did.
 */
const PROBE_SCRAPE: ScrapeData = {
  business: {
    name: "Probe Air Systems",
    industry: "hvac",
    city: "Kelowna",
    phone: "555-0143",
    websiteUrl: "https://probe-air.example",
  },
  website: {
    pagesFound: ["home", "services", "contact"],
    pageText: {
      home: "Furnace and heat pump service across the valley.",
      contact: "Call us during business hours.",
    },
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
  googleReviews: { rating: 4.4, count: 40, recentCount90d: 5, ownerResponseRate: 0.5, reviewTexts: [] },
  gbp: { hoursListed: true, limitedHours: true, hasBookingLink: false, messagingEnabled: false },
  competitors: [
    { name: "Okanagan Comfort", rating: 4.5, reviewCount: 90 },
    { name: "Valley Air", rating: 4.6, reviewCount: 110 },
  ],
};

/** The same business with a strong review profile, so low_review_velocity does NOT
 *  fire. This is Kevin's own worked example for Review Response: a client with
 *  great reviews still gets the reply workflow. */
const STRONG_REVIEWS: ScrapeData = {
  ...PROBE_SCRAPE,
  googleReviews: { ...PROBE_SCRAPE.googleReviews!, count: 300 },
};

const withIntake = (base: ScrapeData, intake: ClientIntake): ScrapeData => ({ ...base, intake });

/** Detection → the set a client's REPORT actually prints. The lock resolves against
 *  this, not against every raw fire, so every fixture below uses the same path the
 *  API uses. */
const reportFor = (data: ScrapeData): FiredLeak[] => reportLeaks(getFiredLeaks(data));

const BASE_FIRED = getFiredLeaks(PROBE_SCRAPE);
const BASE_REPORT = reportLeaks(BASE_FIRED);

/** The committed golden pack — a real, law-passing, fully graded deliverable set.
 *  Section B runs entirely off it: all three label cases already exist in it, so
 *  the dual label is proved on the artifact that actually ships. */
const GOLDEN_PATH = "_fixtures/golden-pack.json";
const goldenPack = JSON.parse(read(GOLDEN_PATH)) as AssetPack;
const goldenLeaks: LeakAnalysisItem[] = goldenPack.intelligence?.leakAnalysis ?? [];

console.log("PHASE 2 VERIFICATION — offline proof of the build layer");

/* ════════════════════════════════════════════════════════════════════════════
 * A. THE TWO NEW INTAKE FIELDS CLOSE THEIR GAPS
 *
 * Before these two questions existed, `social_dm_unmanaged` and
 * `no_database_reactivation` were STRUCTURAL gaps: leaks that could never stop
 * being guesses, however thorough the kickoff call was, because no answer on the
 * form could confirm what they claim. The operator saw them on his gap list as a
 * blank rather than as something he could go and ask.
 *
 * Each field is proved through all three branches of the contract, exactly as
 * verify-phase06 proves the first five:
 *   · a SUPPRESSING answer  → the leak vanishes entirely
 *   · a CONFIRMING answer   → it fires attributed, graded "disclosed"
 *   · unanswered            → today's benchmark hedge, byte-identical
 *
 * NEITHER NEW FIELD HAS AN EXPLICIT "not sure" SLUG, unlike the three handling
 * questions. That is not an omission: "Do enquiries come in through Instagram or
 * Facebook messages?" and "When did you last contact past customers?" are facts an
 * owner knows about his own business. The third branch is reached by leaving the
 * question unasked, which is the state almost every client starts in.
 * ══════════════════════════════════════════════════════════════════════════ */

section("A · THE TWO NEW INTAKE FIELDS — suppress / confirm / hedge, and the gap they close");

check("A1 · socialEnquiries — BOTH \"NO\" and \"NO_ACCOUNTS\" SUPPRESS social_dm_unmanaged", () => {
  // There is no leak in a channel that brings no enquiries. Nothing is being lost
  // in an inbox nobody checks if nothing arrives there — which is true whether the
  // accounts are quiet or absent.
  const baseline = firedById(BASE_FIRED, "social_dm_unmanaged");
  show("baseline (not asked) fires", Boolean(baseline));
  show("baseline grade            ", baseline?.grade ?? "(did not fire)");
  assert(baseline, "social_dm_unmanaged does not fire on the bare fixture — the suppression below would prove nothing");

  for (const answer of ["NO", "NO_ACCOUNTS"] as const) {
    const fired = getFiredLeaks(withIntake(PROBE_SCRAPE, { socialEnquiries: answer }));
    const hit = firedById(fired, "social_dm_unmanaged");
    const lost = firedIds(BASE_FIRED).filter((id) => !firedIds(fired).includes(id));
    show(`socialEnquiries "${answer}"`, hit ? `STILL FIRES (${hit.grade})` : "suppressed");
    show("  other leaks lost", lost.filter((id) => id !== "social_dm_unmanaged"));
    assert(!hit, `socialEnquiries "${answer}" left social_dm_unmanaged on the report — a client who told us no enquiries arrive there is being sold a fix for a channel he does not use`);
    assert.deepEqual(
      lost.filter((id) => id !== "social_dm_unmanaged"),
      [],
      `socialEnquiries "${answer}" removed leaks it has nothing to do with: ${lost.join(", ")}`
    );
  }
});

check("A2 · socialEnquiries = \"YES\" CONFIRMS it — graded disclosed, in the client's own words", () => {
  const fired = getFiredLeaks(withIntake(PROBE_SCRAPE, { socialEnquiries: "YES" }));
  const hit = firedById(fired, "social_dm_unmanaged");
  show("fired ids       ", firedIds(fired));
  show("tier            ", hit?.tier ?? "(did not fire)");
  show("grade           ", hit?.grade ?? "(did not fire)");
  show("intakeConfirmed ", hit?.intakeConfirmed ?? false);
  show("evidence[0]     ", hit?.evidence[0] ?? "(none)");
  assert(hit, "socialEnquiries \"YES\" did not fire social_dm_unmanaged — the confirming answer suppressed it instead");
  assert.strictEqual(hit.intakeConfirmed, true, "a client who told us DMs bring enquiries is still being hedged at");
  assert.strictEqual(hit.grade, "disclosed", `grade is "${hit.grade}" — an answered question is still being treated as a guess`);
  assert(/^Confirmed at intake:/.test(hit.evidence[0]), `the client's own answer is not the first evidence line: ${hit.evidence[0]}`);
  // The kickoff-verification tail comes OFF once they have answered. Re-asking a
  // question they already answered, in a document they paid for, reads as
  // boilerplate — it is the exact insult the grade system exists to remove.
  const tail = hit.evidence.join(" ");
  show("still says 'verified at kickoff'", /verified at kickoff/i.test(tail));
  assert(!/verified at kickoff/i.test(tail), "the answered leak still carries the kickoff-verification line");
});

check("A3 · socialEnquiries unanswered ⇒ today's hedge, byte-identical to no intake at all", () => {
  const baseline = firedById(BASE_FIRED, "social_dm_unmanaged")!;
  const empty = firedById(getFiredLeaks(withIntake(PROBE_SCRAPE, {})), "social_dm_unmanaged");
  const other = firedById(
    getFiredLeaks(withIntake(PROBE_SCRAPE, { hasCrm: false })),
    "social_dm_unmanaged"
  );
  show("no intake at all      ", { tier: baseline.tier, grade: baseline.grade, evidence: baseline.evidence });
  show("empty intake object   ", { tier: empty?.tier, grade: empty?.grade });
  show("intake answering something else", { tier: other?.tier, grade: other?.grade });
  assert(empty && other, "the leak stopped firing when an unrelated intake object was present");
  assert.strictEqual(baseline.grade, "inferred", "an unasked question is not producing a guess");
  assert(!baseline.intakeConfirmed, "an unasked question confirmed something");
  assert.deepStrictEqual(empty.evidence, baseline.evidence, "an empty intake object changed the hedged wording");
  assert.deepStrictEqual(other.evidence, baseline.evidence, "an unrelated intake answer changed this leak's wording");
});

check("A4 · pastCustomerContact = \"SYSTEMATIC\" SUPPRESSES no_database_reactivation", () => {
  // A list contacted within the last month, systematically, IS the campaign this
  // leak sells. Selling it to them anyway is selling something they already run.
  const baseline = firedById(BASE_FIRED, "no_database_reactivation");
  const fired = getFiredLeaks(withIntake(PROBE_SCRAPE, { pastCustomerContact: "SYSTEMATIC" }));
  const lost = firedIds(BASE_FIRED).filter((id) => !firedIds(fired).includes(id));
  show("baseline (not asked) fires", Boolean(baseline));
  show("baseline grade            ", baseline?.grade ?? "(did not fire)");
  show("after \"SYSTEMATIC\"        ", firedById(fired, "no_database_reactivation") ? "STILL FIRES" : "suppressed");
  show("leaks lost                ", lost);
  assert(baseline, "no_database_reactivation does not fire on the bare fixture — the suppression below would prove nothing");
  assert(!firedById(fired, "no_database_reactivation"), "a client who works his list every month is still being sold a reactivation campaign");
  assert.deepEqual(lost, ["no_database_reactivation"], `the answer removed leaks it has nothing to do with: ${lost.join(", ")}`);
});

check("A5 · the three dormancy answers CONFIRM it, each in its own words", () => {
  const seen = new Map<string, string>();
  for (const answer of ["OCCASIONAL", "OVER_A_YEAR", "NEVER"] as const) {
    const hit = firedById(
      getFiredLeaks(withIntake(PROBE_SCRAPE, { pastCustomerContact: answer })),
      "no_database_reactivation"
    );
    show(`pastCustomerContact "${answer}"`, hit ? `${hit.tier} / ${hit.grade} / confirmed=${hit.intakeConfirmed}` : "(did not fire)");
    show("  evidence[0]", hit?.evidence[0] ?? "(none)");
    assert(hit, `"${answer}" did not fire no_database_reactivation — a confirming answer suppressed it`);
    assert.strictEqual(hit.intakeConfirmed, true, `"${answer}" did not confirm the gap`);
    assert.strictEqual(hit.grade, "disclosed", `"${answer}" produced grade "${hit.grade}"`);
    assert(/^Confirmed at intake:/.test(hit.evidence[0]), `"${answer}" does not lead with the client's own words: ${hit.evidence[0]}`);
    seen.set(answer, hit.evidence[0]);
  }
  // Three different situations must not read identically back at the client — a
  // list contacted "occasionally" is not a list nobody has ever touched.
  const lines = Array.from(seen.values());
  assert.equal(new Set(lines).size, 3, `two dormancy answers produce the SAME sentence:\n          ${lines.join("\n          ")}`);
});

check("A6 · pastCustomerContact unanswered ⇒ today's hedge, byte-identical to no intake at all", () => {
  const baseline = firedById(BASE_FIRED, "no_database_reactivation")!;
  const empty = firedById(getFiredLeaks(withIntake(PROBE_SCRAPE, {})), "no_database_reactivation");
  show("no intake at all   ", { tier: baseline.tier, grade: baseline.grade, evidence: baseline.evidence });
  show("empty intake object", { tier: empty?.tier, grade: empty?.grade });
  assert(empty, "the leak stopped firing when an empty intake object was present");
  assert.strictEqual(baseline.grade, "inferred", "an unasked question is not producing a guess");
  assert(!baseline.intakeConfirmed, "an unasked question confirmed something");
  assert(/verified at kickoff/i.test(baseline.evidence.join(" ")), "the hedged branch lost its kickoff-verification line");
  assert.deepStrictEqual(empty.evidence, baseline.evidence, "an empty intake object changed the hedged wording");
});

/* ── THE PAYOFF ───────────────────────────────────────────────────────────────
 * Two leaks that used to be reported to the operator as "nothing you can ask will
 * settle this" are now reported as "here is the question". That is the difference
 * between a gap list he can work and a gap list he learns to ignore.
 * ────────────────────────────────────────────────────────────────────────── */

check("A7 · [THE PAYOFF] both leaks have MOVED from the STRUCTURAL list to the COLLECTIBLE one", () => {
  const gaps = inferredGaps(BASE_FIRED);
  const collectible = gaps.filter((g) => g.ask !== null).map((g) => g.leakId);
  const structural = gaps.filter((g) => g.ask === null).map((g) => g.leakId);
  show("still-guessed leaks", gaps.length);
  show("collectible (a question exists)", collectible);
  show("structural (no question exists)", structural.length ? structural : "none");

  for (const leakId of ["social_dm_unmanaged", "no_database_reactivation"] as const) {
    const gap = gaps.find((g) => g.leakId === leakId);
    assert(gap, `${leakId} is not on the gap list at all — this fixture no longer exercises it`);
    show(`  ${leakId.padEnd(26)}`, gap.ask ? `ask ${String(gap.ask.field)} — "${gap.ask.question}"` : "STRUCTURAL");
    assert(gap.ask, `${leakId} is STILL reported as structural — the operator is being told to give up on something he could just ask`);
    assert.strictEqual(gap.ask.upgradesTo, "disclosed", "an answer claims to upgrade this leak to something other than a disclosure");
  }
  assert.strictEqual(gaps.find((g) => g.leakId === "social_dm_unmanaged")!.ask!.field, "socialEnquiries");
  assert.strictEqual(gaps.find((g) => g.leakId === "no_database_reactivation")!.ask!.field, "pastCustomerContact");

  // THE "BEFORE", DRIVEN RATHER THAN ARGUED. inferredGaps() derives `ask` from the
  // leak's own intakeAsk, so removing that entry reproduces exactly the state these
  // two leaks were in before the questions existed. Running the REAL function over a
  // clone with the ask stripped is what makes "moved" a demonstration instead of a
  // claim about history nobody can check.
  const asBefore = BASE_FIRED.filter((f) =>
    ["social_dm_unmanaged", "no_database_reactivation"].includes(f.leak.id)
  ).map((f) => ({ ...f, leak: { ...f.leak, intakeAsk: undefined } }));
  const before = inferredGaps(asBefore);
  show("SIMULATED pre-change taxonomy (intakeAsk removed)", before.map((g) => `${g.leakId}: ${g.ask ? "collectible" : "STRUCTURAL"}`));
  assert(before.every((g) => g.ask === null), "the simulation is not reproducing the old state — this comparison proves nothing");
  assert.equal(before.length, 2, "the simulation lost a leak");
});

check("A8 · one answer moves each leak from \"inferred\" to \"disclosed\" — without suppressing it", () => {
  // The whole point of a CONFIRMING answer as opposed to a suppressing one: the
  // leak must still be on the report, just no longer written as a guess. A field
  // that removed the leak would prove the wrong thing.
  const cases: Array<{ leakId: string; intake: ClientIntake; label: string }> = [
    { leakId: "social_dm_unmanaged", intake: { socialEnquiries: "YES" }, label: "socialEnquiries = YES" },
    { leakId: "no_database_reactivation", intake: { pastCustomerContact: "NEVER" }, label: "pastCustomerContact = NEVER" },
  ];
  for (const c of cases) {
    const beforeGrade = firedById(BASE_FIRED, c.leakId)?.grade;
    const after = getFiredLeaks(withIntake(PROBE_SCRAPE, c.intake));
    const hit = firedById(after, c.leakId);
    const gapsBefore = inferredGaps(BASE_FIRED).map((g) => g.leakId);
    const gapsAfter = inferredGaps(after).map((g) => g.leakId);
    const removed = gapsBefore.filter((id) => !gapsAfter.includes(id));
    show(c.label, `${c.leakId}: ${beforeGrade} → ${hit?.grade ?? "(stopped firing)"}`);
    show("  left the gap list", removed);
    show("  gaps before/after", `${gapsBefore.length} → ${gapsAfter.length}`);
    assert.strictEqual(beforeGrade, "inferred", `${c.leakId} was not a guess to begin with`);
    assert(hit, `${c.leakId} stopped firing — the answer suppressed it instead of confirming it`);
    assert.strictEqual(hit.grade, "disclosed", `${c.leakId} is graded "${hit.grade}" after being answered`);
    assert.deepEqual(removed, [c.leakId], `expected exactly ${c.leakId} to leave the gap list, got: ${removed.join(", ")}`);
  }
});

check("A9 · intakeFieldsForZeroInferred() — the complete question set, produced BY THE CODE", () => {
  // The list the owner asked for, printed in full. It is a QUERY over the taxonomy,
  // not a second hand-maintained list beside it: a list like that rots the first
  // time a leak is added and nobody remembers it exists.
  const fields = intakeFieldsForZeroInferred();
  show("questions returned", fields.length);
  for (const f of fields)
    show(`  ${String(f.field).padEnd(22)}`, `upgrades ${f.upgrades.join(", ")} — "${f.question}"`);

  assert(fields.length > 0, "the complete question set is empty — the operator gets no list at all");

  const byField = new Map(fields.map((f) => [String(f.field), f]));
  for (const [field, leakId] of [
    ["socialEnquiries", "social_dm_unmanaged"],
    ["pastCustomerContact", "no_database_reactivation"],
  ] as const) {
    const entry = byField.get(field);
    assert(entry, `"${field}" is not on the complete question set — the gap it closes is not being reported as collectible`);
    assert(
      entry.upgrades.includes(leakId),
      `"${field}" is on the list but does not claim to upgrade ${leakId}: ${entry.upgrades.join(", ")}`
    );
  }

  // Every question is quoted verbatim from the intake form the operator reads off,
  // and de-duplicated, so he never asks the same thing twice.
  const seen = new Set<string>();
  for (const f of fields) {
    assert(!seen.has(String(f.field)), `field "${String(f.field)}" is listed twice`);
    seen.add(String(f.field));
    assert(f.question.trim().length > 0, `field "${String(f.field)}" carries no question — the operator cannot ask a blank`);
    assert(f.upgrades.length > 0, `field "${String(f.field)}" upgrades nothing — it should not be on the list`);
  }

  // Anti-vacuity: the two new entries must be the taxonomy's own wording, not a
  // second phrasing invented here.
  const taxonomySocial = LEAKS.find((l) => l.id === "social_dm_unmanaged")?.intakeAsk;
  const taxonomyDormant = LEAKS.find((l) => l.id === "no_database_reactivation")?.intakeAsk;
  show("taxonomy wording · socialEnquiries    ", taxonomySocial?.question ?? "(absent)");
  show("taxonomy wording · pastCustomerContact", taxonomyDormant?.question ?? "(absent)");
  assert.strictEqual(byField.get("socialEnquiries")!.question, taxonomySocial?.question);
  assert.strictEqual(byField.get("pastCustomerContact")!.question, taxonomyDormant?.question);
});

check("A10 · THE CASE THAT IS EASY TO GET BACKWARDS — \"NO\" ≠ \"NO_ACCOUNTS\" for the BUILD", () => {
  // ONE FIELD, TWO CONSUMERS, AND THEY READ IT DIFFERENTLY.
  //
  //   the LEAK  — "NO" and "NO_ACCOUNTS" are the SAME answer. Nothing is being lost
  //               in an inbox nobody checks if nothing arrives there.
  //   the BUILD — they are DIFFERENT answers. "NO" means they HAVE the accounts and
  //               they are quiet, so the capture workflow still installs and sits
  //               there until the first DM arrives. "NO_ACCOUNTS" means there is no
  //               account to connect, and only then is the workflow left out.
  //
  // Collapsing the two would silently drop a paid-for workflow from the build of
  // every client who just does not get many DMs today — and the first message they
  // ever receive would go unanswered.
  const rows: Record<string, { leakFires: boolean; workflowOn: boolean; source: string }> = {};
  for (const answer of ["YES", "NO", "NO_ACCOUNTS"] as const) {
    const intake: ClientIntake = { socialEnquiries: answer };
    const fired = getFiredLeaks(withIntake(PROBE_SCRAPE, intake));
    const resolved = resolveWorkflows({ intake, firedLeaks: reportLeaks(fired) });
    const row = resolvedWorkflowById(resolved, "social-dm-capture")!;
    rows[answer] = {
      leakFires: Boolean(firedById(fired, "social_dm_unmanaged")),
      workflowOn: row.on,
      source: row.source,
    };
    show(`socialEnquiries "${answer}"`, `leak fires = ${rows[answer].leakFires}   ·   Social DM Capture = ${row.on ? "IN THE BUILD" : "left out"} (${row.source})`);
    show("  because", row.because);
  }

  // The leak: NO and NO_ACCOUNTS agree.
  assert.strictEqual(rows.NO.leakFires, false, "\"NO\" left the leak on the report");
  assert.strictEqual(rows.NO_ACCOUNTS.leakFires, false, "\"NO_ACCOUNTS\" left the leak on the report");
  // The build: they must NOT agree. This is the whole check.
  assert.strictEqual(
    rows.NO.workflowOn,
    true,
    "socialEnquiries \"NO\" switched Social DM Capture OFF. They HAVE the accounts — the client paid for this workflow and the first DM that arrives will go unanswered."
  );
  assert.strictEqual(
    rows.NO_ACCOUNTS.workflowOn,
    false,
    "socialEnquiries \"NO_ACCOUNTS\" left Social DM Capture in the build — there is no account to connect it to"
  );
  assert.strictEqual(rows.NO_ACCOUNTS.source, "rule", `the workflow went out for the wrong reason: source "${rows.NO_ACCOUNTS.source}"`);
  assert.strictEqual(rows.YES.workflowOn, true, "the confirming answer took the workflow out of the build");
});

check("A11 · THE TWIN CASE — pastCustomerContact answers the LEAK, hasPastCustomerDatabase answers the BUILD", () => {
  // The same shape of mistake, one field over. The dormancy question can never
  // remove the Database Reactivation workflow, and the list question can never
  // confirm the leak — they are two questions, not one asked twice.
  const dormant: ClientIntake = { pastCustomerContact: "NEVER" };
  const noList: ClientIntake = { hasPastCustomerDatabase: false };
  const bothWays: ClientIntake = { hasPastCustomerDatabase: false, pastCustomerContact: "NEVER" };

  const rowFor = (intake: ClientIntake) => {
    const fired = getFiredLeaks(withIntake(PROBE_SCRAPE, intake));
    const resolved = resolveWorkflows({ intake, firedLeaks: reportLeaks(fired) });
    const row = resolvedWorkflowById(resolved, "database-reactivation")!;
    return { leakFires: Boolean(firedById(fired, "no_database_reactivation")), on: row.on, source: row.source, because: row.because };
  };

  const a = rowFor(dormant);
  const b = rowFor(noList);
  const c = rowFor(bothWays);
  show("pastCustomerContact = NEVER      ", `leak fires = ${a.leakFires}   ·   Database Reactivation = ${a.on ? "IN THE BUILD" : "left out"} (${a.source})`);
  show("hasPastCustomerDatabase = false  ", `leak fires = ${b.leakFires}   ·   Database Reactivation = ${b.on ? "IN THE BUILD" : "left out"} (${b.source})`);
  show("  because                        ", b.because);
  show("both answers together            ", `leak fires = ${c.leakFires}   ·   Database Reactivation = ${c.on ? "IN THE BUILD" : "left out"} (${c.source})`);

  assert.strictEqual(a.leakFires, true, "the dormancy answer did not confirm the leak");
  assert.strictEqual(a.on, true, "the dormancy answer switched the Database Reactivation workflow off — it says the list is COLD, not that there is no list");
  assert.strictEqual(b.on, false, "\"there is no past-customer list\" left the reactivation campaign in the build — there is nobody to send to");
  assert.strictEqual(b.source, "rule", `the workflow went out for the wrong reason: source "${b.source}"`);
  assert.strictEqual(b.leakFires, false, "no list at all, and the leak still fired");
  // "No list" wins over "the list is cold", because a list that does not exist
  // cannot be dormant. Reading them the other way round would put a campaign with
  // nobody to send to into a client's build.
  assert.strictEqual(c.leakFires, false, "\"no list\" did not outrank the dormancy answer in the detector");
  assert.strictEqual(c.on, false, "\"no list\" did not outrank the dormancy answer in the build");
});

/* ════════════════════════════════════════════════════════════════════════════
 * B. THE DUAL LABEL
 *
 * The strongest line a deliverable can carry, and it is literally true: our own
 * tooling found the gap AND the client confirmed it. The GRADE alone cannot say
 * that — gradeOf's precedence (measured > told) collapses the pair down to
 * "observed" and the confirmation disappears — so both facts survive on the item
 * and the label reads both of them back.
 *
 * Every check below runs the REAL renderer over the REAL committed fixture. All
 * three cases already exist in it, so nothing here is a hand-built shape that
 * proves the renderer works on inputs no document ever contains.
 * ══════════════════════════════════════════════════════════════════════════ */

section("B · THE DUAL LABEL — measured, told, or both, and the label says which");

/** The evidence label the renderer actually emitted for one leak. Read out of the
 *  HTML rather than recomputed, because the rendered string IS the claim under
 *  test: a label computed here and compared to itself would prove nothing. */
const EVIDENCE_LABELS = [
  "What we observed and you confirmed",
  "What we observed",
  "You told us",
  "Confirmed at intake",
  "Industry pattern",
  "Signal in your reviews",
];
function renderedLabel(item: LeakAnalysisItem): string {
  const html = renderLeakAnalysis([item]);
  return (
    Array.from(html.matchAll(/<div class="k">([^<]+)<\/div>/g), (m) => m[1]).find((k) =>
      EVIDENCE_LABELS.includes(k)
    ) ?? "(no evidence label rendered)"
  );
}

const dualLeaks = goldenLeaks.filter((l) => l.evidenceGrade === "observed" && l.intakeConfirmed);
const observedOnly = goldenLeaks.filter((l) => l.evidenceGrade === "observed" && !l.intakeConfirmed);
const disclosedOnly = goldenLeaks.filter((l) => l.evidenceGrade === "disclosed");

check("B1 · MEASURED **AND** CONFIRMED ⇒ \"What we observed and you confirmed\"", () => {
  show("fixture        ", GOLDEN_PATH);
  show("grade spread   ", countBy(goldenLeaks.map((l) => String(l.evidenceGrade))));
  show("observed + confirmed leaks", dualLeaks.map((l) => l.leakName ?? l.area));
  assert(
    dualLeaks.length > 0,
    "the committed fixture carries no leak that is both measured and confirmed, so the case this check exists for is not being exercised"
  );
  for (const l of dualLeaks) {
    const label = renderedLabel(l);
    show(`  ${String(l.leakName ?? l.area).slice(0, 40).padEnd(40)}`, `${l.evidenceGrade} / ${l.evidenceTier} / confirmed=${l.intakeConfirmed} ⇒ "${label}"`);
    assert.strictEqual(
      label,
      "What we observed and you confirmed",
      `"${l.leakName ?? l.area}" renders "${label}". We measured it AND they confirmed it — flattening that to one of the two throws away a fact the document is entitled to state.`
    );
  }
});

check("B2 · MEASURED ALONE ⇒ \"What we observed\"", () => {
  show("observed, NOT confirmed", observedOnly.map((l) => l.leakName ?? l.area));
  assert(observedOnly.length > 0, "the fixture carries no measured-only leak — the contrast in B1 is unproved");
  for (const l of observedOnly) {
    const label = renderedLabel(l);
    show(`  ${String(l.leakName ?? l.area).slice(0, 40).padEnd(40)}`, `${l.evidenceGrade} / ${l.evidenceTier} / confirmed=${l.intakeConfirmed ?? false} ⇒ "${label}"`);
    assert.strictEqual(
      label,
      "What we observed",
      `"${l.leakName ?? l.area}" renders "${label}" — the document is claiming the client confirmed something he was never asked`
    );
  }
});

check("B3 · TOLD ALONE ⇒ the attributed label, never dressed up as our finding", () => {
  show("disclosed leaks", disclosedOnly.map((l) => `${l.leakName ?? l.area} (${l.evidenceTier})`));
  assert(disclosedOnly.length > 0, "the fixture carries no disclosed leak — the attributed label is unproved");
  for (const l of disclosedOnly) {
    const label = renderedLabel(l);
    const html = renderLeakAnalysis([l]);
    show(`  ${String(l.leakName ?? l.area).slice(0, 40).padEnd(40)}`, `${l.evidenceGrade} / ${l.evidenceTier} ⇒ "${label}"`);
    assert.strictEqual(
      label,
      "You told us",
      `"${l.leakName ?? l.area}" renders "${label}" — their own answer is being handed back to them as something we detected`
    );
    // The regression this ordering exists to stop: an EVIDENCED-tier leak the
    // client confirmed used to be labelled "Signal in your reviews".
    assert(
      !html.includes(">Signal in your reviews<"),
      `"${l.leakName ?? l.area}" still carries the review-signal label alongside the disclosure`
    );
  }
});

check("B4 · the dual label is not reachable by accident — dropping either half changes it", () => {
  // A/B on the SAME item, one field at a time, so nothing differs between the runs
  // except the thing under test. Without this, a renderer that returned the dual
  // label for everything would pass B1.
  const item = dualLeaks[0];
  assert(item, "no dual-label leak in the fixture to corrupt");
  const clone = (patch: Partial<LeakAnalysisItem>): LeakAnalysisItem =>
    ({ ...JSON.parse(JSON.stringify(item)), ...patch }) as LeakAnalysisItem;

  const both = renderedLabel(item);
  const noConfirmation = renderedLabel(clone({ intakeConfirmed: false }));
  const notMeasured = renderedLabel(clone({ evidenceGrade: "disclosed" }));
  const neither = renderedLabel(clone({ intakeConfirmed: false, evidenceGrade: "inferred", evidenceTier: "BENCHMARK" }));

  show("leak under test            ", item.leakName ?? item.area);
  show("as shipped (both facts)    ", both);
  show("− intakeConfirmed          ", noConfirmation);
  show("− measurement (⇒ disclosed)", notMeasured);
  show("− both (⇒ inferred)        ", neither);
  assert.strictEqual(both, "What we observed and you confirmed");
  assert.strictEqual(noConfirmation, "What we observed", "the confirmation half of the label survived removing the confirmation");
  assert.strictEqual(notMeasured, "You told us", "the measurement half of the label survived removing the measurement");
  assert.strictEqual(neither, "Industry pattern", "a leak with neither fact still claims one");
});

check("B5 · the BODY agrees with the label — both facts are stated, in that order", () => {
  // A header that claims two things and a body that carries one is a document that
  // reads as boilerplate. The measurement leads (it is the more defensible of the
  // two), the attribution follows.
  for (const l of dualLeaks) {
    const html = renderLeakAnalysis([l]);
    const attributed = /you told us|confirmed at intake/i.test(html);
    show(`${String(l.leakName ?? l.area).slice(0, 40).padEnd(40)}`, `attribution present in body = ${attributed}`);
    assert(
      attributed,
      `"${l.leakName ?? l.area}" is labelled "and you confirmed" but nothing in the body says they did — the second half of the label is unsupported`
    );
  }
  assert(dualLeaks.length > 0, "nothing to check — see B1");
});

/* ════════════════════════════════════════════════════════════════════════════
 * C. THE CATALOGUE IS COMPLETE AND HONEST
 *
 * The build Kevin sells is fourteen named workflows and a six-stage pipeline. Until
 * it was written down as data it lived as prose, retyped into a different
 * generation prompt every time it was needed — so the proposal, the Blueprint and
 * the roadmap could each describe a slightly different build and nothing could
 * check them against each other.
 *
 * THE RULE THIS SECTION EXISTS FOR, in Kevin's own words about Review Response:
 *   "It's one of the 14 workflows I install in every build. low_review_velocity is
 *    supporting evidence when present, not a precondition — a client with great
 *    reviews still gets the reply workflow, because unanswered reviews look
 *    inattentive regardless of volume."
 * ══════════════════════════════════════════════════════════════════════════ */

section("C · THE CATALOGUE — fourteen workflows, and a leak is evidence, never a precondition");

/** The build, verbatim. Written out HERE rather than read from the catalogue: a
 *  list compared against itself proves nothing. This is the independent statement
 *  of what ReclaimedHQ sells, in order, that the shipped catalogue has to agree
 *  with — so a name edited over there surfaces as a failed check rather than as a
 *  client document quietly describing a different build. */
const THE_FOURTEEN: readonly string[] = [
  "Instant Lead Response",
  "Missed Call Text-Back",
  "After-Hours Auto-Reply",
  "Booking Confirmation + Reminders",
  "Appointment Cancelled — Stop Reminders",
  "No-Show Recovery",
  "Review Request",
  "Lead Nurture — No Booking",
  "Owner Hot-Lead Notification",
  "Webchat Capture",
  "Social DM Capture",
  "Text-to-Pay",
  "Database Reactivation",
  "Review Response",
];

/** The stable slugs, in the same order. These are written into
 *  Business.workflowToggles the moment an operator flips a switch, so renaming one
 *  silently throws that client's decision away and the workflow reverts to its
 *  default. Ids are append-only: never rename, never reuse — and this list is what
 *  makes a rename fail loudly instead of quietly. */
const THE_FOURTEEN_IDS: readonly string[] = [
  "instant-lead-response",
  "missed-call-text-back",
  "after-hours-auto-reply",
  "booking-confirmation-reminders",
  "appointment-cancelled-stop-reminders",
  "no-show-recovery",
  "review-request",
  "lead-nurture-no-booking",
  "owner-hot-lead-notification",
  "webchat-capture",
  "social-dm-capture",
  "text-to-pay",
  "database-reactivation",
  "review-response",
];

/** The four the catalogue marks CONDITIONAL — see C4 for what that does and does
 *  not mean. */
const THE_FOUR_CONDITIONAL: readonly string[] = [
  "social-dm-capture",
  "text-to-pay",
  "database-reactivation",
  "review-response",
];

check("C1 · all fourteen are present, with the exact names from the build", () => {
  const names = WORKFLOWS.map((w) => w.name);
  show("workflows in the catalogue", WORKFLOWS.length);
  names.forEach((n, i) => show(`  ${String(i + 1).padStart(2)}`, n));
  assert.equal(WORKFLOWS.length, 14, `expected 14 workflows, found ${WORKFLOWS.length}`);
  assert.deepStrictEqual(
    names,
    THE_FOURTEEN,
    "the catalogue no longer describes the build ReclaimedHQ sells — a name here reaches a client document verbatim"
  );
});

check("C2 · ids are unique and STABLE — a rename throws away an operator's decision", () => {
  const ids = WORKFLOWS.map((w) => w.id);
  show("ids", ids);
  show("duplicates", ids.filter((id, i) => ids.indexOf(id) !== i));
  assert.equal(new Set(ids).size, ids.length, `duplicate workflow id: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`);
  assert.deepStrictEqual(
    ids,
    THE_FOURTEEN_IDS,
    "a workflow id changed. Ids are the key of Business.workflowToggles, so every operator decision stored against the old one is now orphaned and that workflow has silently reverted to its default."
  );
  // The lookup the API uses to refuse an unknown id must agree with the list.
  for (const id of THE_FOURTEEN_IDS) assert(workflowById(id), `workflowById("${id}") returns nothing`);
  assert(!workflowById("not-a-workflow"), "workflowById accepts an id that is not in the catalogue");
});

check("C3 · every cited leak resolves to a real, in-scope taxonomy leak", () => {
  const taxonomy = new Map(LEAKS.map((l) => [l.id, l]));
  const problems = verifyWorkflowCatalogue();
  for (const w of WORKFLOWS)
    show(`  ${w.id.padEnd(38)}`, w.justifyingLeaks.length ? w.justifyingLeaks.join(", ") : "(none — evidence is optional)");
  show("verifyWorkflowCatalogue()", problems.length ? problems : "no problems");
  assert.deepEqual(problems, [], `the catalogue's own integrity check reports: ${problems.join(" | ")}`);

  for (const w of WORKFLOWS) {
    for (const leakId of w.justifyingLeaks) {
      const leak = taxonomy.get(leakId);
      assert(leak, `workflow "${w.id}" cites leak "${leakId}", which is not in the taxonomy — a document would cite a finding that points at nothing`);
      assert.notStrictEqual(
        leak.scope,
        "out_of_scope",
        `workflow "${w.id}" cites "${leakId}", which is out of scope — a workflow may only ever support something ReclaimedHQ actually fixes`
      );
    }
  }
});

check("C4 · exactly four are CONDITIONAL — and conditional does NOT mean left out", () => {
  // READ THIS BEFORE USING defaultOn. `false` means "a fact about the client
  // decides this one", not "it is off". All four rules are OFF-SWITCHES: the answer
  // that removes the workflow is named in applicability.offWhen, and every other
  // answer — including "we never asked" — leaves it in.
  const conditional = WORKFLOWS.filter((w) => !w.defaultOn);
  show("defaultOn = false", conditional.map((w) => w.id));
  for (const w of conditional) show(`  ${w.id.padEnd(38)}`, `${w.applicability.kind} — ${w.applicability.kind === "every_build" ? "(no rule)" : w.applicability.offWhen}`);
  assert.equal(conditional.length, 4, `expected exactly 4 conditional workflows, found ${conditional.length}`);
  assert.deepStrictEqual(conditional.map((w) => w.id), THE_FOUR_CONDITIONAL, "the conditional four are not the four named");

  // The flag and the rule must agree, or the toggles screen shows the wrong thing.
  for (const w of WORKFLOWS) {
    const hasRule = w.applicability.kind !== "every_build";
    assert.notStrictEqual(
      hasRule,
      w.defaultOn,
      `workflow "${w.id}": defaultOn=${w.defaultOn} disagrees with applicability "${w.applicability.kind}"`
    );
  }

  // THE HONEST HALF. With nothing on file, all four are still in the build.
  const resolved = resolveWorkflows({ intake: null, firedLeaks: null, overrides: null });
  for (const id of THE_FOUR_CONDITIONAL) {
    const row = resolvedWorkflowById(resolved, id)!;
    show(`  ${id.padEnd(38)} with NOTHING on file`, `${row.on ? "IN THE BUILD" : "LEFT OUT"} (${row.source})`);
    assert.strictEqual(row.on, true, `"${id}" is defaultOn:false and resolves OFF with no client facts at all — an unanswered question has removed a workflow the client paid for`);
  }
});

/* ── THE RULE THAT MATTERS ────────────────────────────────────────────────────
 * A WORKFLOW IS INSTALLED ALWAYS; ITS LEAK IS ONLY SOMETIMES EVIDENCED.
 * If installation were gated on a detector firing, a client whose scan came back
 * thin would silently lose part of the build he paid for — and nobody would
 * notice until the workflow he needed was not there.
 * ────────────────────────────────────────────────────────────────────────── */

const STRONG_REPORT = reportFor(STRONG_REVIEWS);
const STRONG_RESOLVED = resolveWorkflows({ intake: null, firedLeaks: STRONG_REPORT, overrides: null });

check("C5 · REVIEW RESPONSE — a client with great reviews still gets the reply workflow", () => {
  // Kevin's own worked example, driven. The strong-reviews fixture is the SAME
  // business with a healthy review count, so low_review_velocity — the only leak
  // Review Response cites — does not fire at all.
  const velocity = firedById(STRONG_REPORT, "low_review_velocity");
  const row = resolvedWorkflowById(STRONG_RESOLVED, "review-response")!;
  show("reviews                 ", `${STRONG_REVIEWS.googleReviews!.count} vs a competitor median of ~110`);
  show("low_review_velocity fires", Boolean(velocity));
  show("justifying evidence     ", row.justification.length ? row.justification.map((f) => f.leak.id) : "none — no leak fired for this workflow");
  show("Review Response         ", `${row.on ? "IN THE BUILD" : "LEFT OUT"} (${row.source})`);
  show("because                 ", row.because);
  assert(!velocity, "low_review_velocity still fires on the strong-reviews fixture — the worked example is not being exercised");
  assert.equal(row.justification.length, 0, "the workflow found justifying evidence — this check is measuring the wrong thing");
  assert.strictEqual(
    row.on,
    true,
    "Review Response was left out because no leak fired for it. Unanswered reviews look inattentive regardless of volume, and the client paid for fourteen workflows — the leak is supporting evidence when present, not a precondition."
  );
  assert.strictEqual(row.locked, false, "a workflow with no evidence behind it came back locked");
});

check("C6 · …and EVERY other workflow in the same state, for the same client", () => {
  // Not just the named example: every workflow this client's scan produced no
  // evidence for. If any one of them can be dropped for want of a fire, the rule is
  // not a rule.
  const unevidenced = STRONG_RESOLVED.filter((r) => r.justification.length === 0);
  const off = unevidenced.filter((r) => !r.on);
  show("leaks on this client's report", firedIds(STRONG_REPORT));
  show("workflows with NO fired leak ", unevidenced.map((r) => r.workflow.id));
  for (const r of unevidenced) show(`  ${r.workflow.id.padEnd(38)}`, `${r.on ? "IN THE BUILD" : "LEFT OUT"} (${r.source})`);
  show("left out for want of evidence", off.length ? off.map((r) => r.workflow.id) : "none");
  assert(unevidenced.length > 0, "every workflow found evidence — this check would be vacuous");
  assert.deepEqual(
    off.map((r) => r.workflow.id),
    [],
    `workflow(s) left out because no leak fired: ${off.map((r) => r.workflow.id).join(", ")}`
  );

  // The permanent case, which proves the rule on its own: one workflow can NEVER
  // be evidenced, because no leak in the taxonomy fires for it — and it ships in
  // every build, because a reminder for a visit the customer already cancelled
  // undoes the trust the other thirteen just built.
  const cancelled = WORKFLOWS.find((w) => w.id === "appointment-cancelled-stop-reminders")!;
  show("permanently unevidenced      ", `${cancelled.name} — justifyingLeaks: ${JSON.stringify(cancelled.justifyingLeaks)}`);
  assert.equal(cancelled.justifyingLeaks.length, 0, "Appointment Cancelled — Stop Reminders now cites a leak; the proof-by-example is gone");
  assert.strictEqual(resolvedWorkflowById(STRONG_RESOLVED, cancelled.id)!.on, true, "the one workflow no detector can ever see was left out");
});

check("C7 · nothing measured at all ⇒ all fourteen are still in the build", () => {
  // The state every client is in before their first scan, and the one where a
  // leak-gated build would be at its most wrong: an unscanned client would be
  // quoted nothing.
  const resolved = resolveWorkflows({ intake: null, firedLeaks: null, overrides: null });
  const off = resolved.filter((r) => !r.on);
  show("firedLeaks       ", "null — no scan has been run for this client");
  show("workflows resolved", resolved.length);
  show("in the build      ", resolved.filter((r) => r.on).length);
  show("left out          ", off.length ? off.map((r) => r.workflow.id) : "none");
  show("locked            ", resolved.filter((r) => r.locked).length);
  assert.equal(resolved.length, 14, `resolved ${resolved.length} workflows, not 14`);
  assert.deepEqual(off.map((r) => r.workflow.id), [], `an unscanned client is missing workflows: ${off.map((r) => r.workflow.id).join(", ")}`);
  assert.equal(resolved.filter((r) => r.locked).length, 0, "something locked with nothing measured — a lock must rest on a measurement");
});

check("C8 · [COMPILE-TIME] the catalogue CANNOT see a fired leak", () => {
  // The structural half of the rule. `resolveWorkflow` — the only function that
  // answers "is this workflow in this client's build?" — takes the intake answers
  // and the operator's overrides, and there is no parameter that can carry a fire.
  // It is not a matter of discipline: the file imports nothing from the detection
  // layer at all, so a fired leak is not a value that exists in that scope.
  const code = codeOnly("src/lib/workflow-catalogue.ts");
  const imports = Array.from(code.matchAll(/^\s*import[\s\S]*?from\s+"([^"]+)";/gm), (m) => m[1]);
  const signature = sourceLine("src/lib/workflow-catalogue.ts", /^export function resolveWorkflow\(/);
  const gated = Array.from(code.matchAll(/gatedOnALeak:\s*(\w+)/g), (m) => m[1]);
  show("imports              ", imports);
  show("imports from detection", imports.filter((i) => /leak-detection/.test(i)).length ? imports.filter((i) => /leak-detection/.test(i)) : "NONE");
  show("resolver signature   ", signature ? `L${signature.line}  ${signature.text}` : "(NOT FOUND)");
  show("gatedOnALeak values  ", countBy(gated));
  show("guarantee            ", "COMPILE-TIME — a FiredLeak is not a type this module can name, so installation cannot depend on one");
  assert(signature, "resolveWorkflow is no longer declared in workflow-catalogue.ts — this check is reading the wrong file");
  assert.equal(
    imports.filter((i) => /leak-detection/.test(i)).length,
    0,
    "workflow-catalogue.ts now imports from the detection layer — the wall between 'what we sell' and 'what we found' has a door in it"
  );
  assert(gated.length > 0, "no gatedOnALeak declarations found — the check is reading the wrong file");
  assert(gated.every((v) => v === "false"), `a workflow declares gatedOnALeak: ${gated.filter((v) => v !== "false").join(", ")}`);
});

check("C9 · [COMPILE-TIME] the REAL compiler refuses a workflow that declares itself leak-gated", () => {
  // The strongest form of C8, and the reason it is worth the extra seconds:
  // everything above is a string match. This runs tsc over the shipped types and
  // shows the actual error, with a CONTROL probe beside it so a broken environment
  // cannot masquerade as a passing check.
  //
  // `gatedOnALeak` is typed as the literal `false`, not `boolean`. "Yes, this one
  // is gated" is not a sentence the type system will let anyone write — so a future
  // author who genuinely needs leak-gated behaviour has to widen the type and
  // answer for it, which is exactly the conversation that should happen before a
  // client loses a workflow because a cold scan came back thin.
  const probe = compileProbe();
  show("control probe (gatedOnALeak: false)", probe.controlSource);
  show("control errors                     ", probe.controlErrors.length ? probe.controlErrors : "none — it compiles");
  show("gated probe   (gatedOnALeak: true) ", probe.violationSource);
  show("gated errors                       ", probe.violationErrors.length ? probe.violationErrors : "NONE — IT COMPILED");
  show("guarantee                          ", "COMPILE-TIME — this code cannot be built, so it cannot be shipped");
  assert.equal(
    probe.controlErrors.length,
    0,
    `the CONTROL probe failed to compile, so the check below proves nothing about gatedOnALeak:\n          ${probe.controlErrors.join("\n          ")}`
  );
  assert(
    probe.violationErrors.length > 0,
    "a workflow declaring `gatedOnALeak: true` COMPILES — installation can now be made to depend on a detector firing"
  );
  assert(
    probe.violationErrors.some((e) => /gatedOnALeak|false/.test(e)),
    `the probe failed to compile, but not because of gatedOnALeak: ${probe.violationErrors.join(" | ")}`
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * D. TOGGLE RESOLUTION AND THE EVIDENCE LOCK
 *
 *      operator override  >  applicability rule  >  default
 *
 * …except a LOCKED workflow, which nothing can switch off.
 *
 * THE LOCK, IN KEVIN'S WORDS: "an observed leak's toggle is disabled with a
 * tooltip." The reason is not tidiness. The client's report will carry that
 * measurement as a finding, and handing a paying client a document that says "we
 * measured that you have no online booking" next to a build that leaves the
 * booking workflow out is a contradiction somebody has to explain on a call.
 *
 * The other two grades deliberately do NOT lock. A client who TOLD us a thing can
 * also tell us he will handle it himself, and we are not going to argue with him
 * about his own business; and a GUESS must never overrule the operator, which is
 * the whole reason the grades exist.
 * ══════════════════════════════════════════════════════════════════════════ */

section("D · RESOLUTION — operator beats rule beats default, and a measurement beats all three");

check("D1 · PRECEDENCE — the resolved source for each of the three cases", () => {
  // No evidence anywhere in this check, so nothing can lock and the ordinary
  // precedence is what is on show. Each row differs from the one above it by
  // exactly one input.
  const noEvidence = { firedLeaks: null } as const;

  const bare = resolvedWorkflowById(resolveWorkflows({ ...noEvidence }), "social-dm-capture")!;
  const ruled = resolvedWorkflowById(
    resolveWorkflows({ ...noEvidence, intake: { socialEnquiries: "NO_ACCOUNTS" } }),
    "social-dm-capture"
  )!;
  const overridden = resolvedWorkflowById(
    resolveWorkflows({
      ...noEvidence,
      intake: { socialEnquiries: "NO_ACCOUNTS" },
      overrides: { "social-dm-capture": true },
    }),
    "social-dm-capture"
  )!;
  const switchedOff = resolvedWorkflowById(
    resolveWorkflows({ ...noEvidence, overrides: { "no-show-recovery": false } }),
    "no-show-recovery"
  )!;

  show("DEFAULT  · nothing on file          ", `on=${bare.on} source=${bare.source}`);
  show("RULE     · socialEnquiries NO_ACCOUNTS", `on=${ruled.on} source=${ruled.source}  — ${ruled.because}`);
  show("OPERATOR · same rule + override true ", `on=${overridden.on} source=${overridden.source}  — ${overridden.because}`);
  show("OPERATOR · override false, no rule   ", `on=${switchedOff.on} source=${switchedOff.source}  — ${switchedOff.because}`);

  assert.strictEqual(bare.source, "default", `nothing on file resolved as "${bare.source}"`);
  assert.strictEqual(bare.on, true, "a workflow with nothing on file is not in the build");
  assert.strictEqual(ruled.source, "rule", `an applicability answer resolved as "${ruled.source}"`);
  assert.strictEqual(ruled.on, false, "the applicability rule did not take the workflow out");
  assert.strictEqual(overridden.source, "operator", `the operator's decision resolved as "${overridden.source}"`);
  assert.strictEqual(
    overridden.on,
    true,
    "the operator switched it back on over the rule and lost. He is in the room with the client and knows things no column on the form can hold."
  );
  assert.strictEqual(switchedOff.source, "operator", `an explicit switch-off resolved as "${switchedOff.source}"`);
  assert.strictEqual(switchedOff.on, false, "the operator switched a workflow off and it stayed in the build");
});

check("D2 · an applicability FACT switches its workflow off — and a different answer switches it back on", () => {
  const cases: Array<{ id: string; off: ClientIntake; on: ClientIntake; offLabel: string; onLabel: string }> = [
    {
      id: "social-dm-capture",
      off: { socialEnquiries: "NO_ACCOUNTS" },
      on: { socialEnquiries: "NO" },
      offLabel: "socialEnquiries = NO_ACCOUNTS",
      onLabel: "socialEnquiries = NO",
    },
    {
      id: "database-reactivation",
      off: { hasPastCustomerDatabase: false },
      on: { hasPastCustomerDatabase: true },
      offLabel: "hasPastCustomerDatabase = false",
      onLabel: "hasPastCustomerDatabase = true",
    },
  ];
  for (const c of cases) {
    const offRow = resolvedWorkflowById(
      resolveWorkflows({ intake: c.off, firedLeaks: reportFor(withIntake(PROBE_SCRAPE, c.off)) }),
      c.id
    )!;
    const onRow = resolvedWorkflowById(
      resolveWorkflows({ intake: c.on, firedLeaks: reportFor(withIntake(PROBE_SCRAPE, c.on)) }),
      c.id
    )!;
    show(`${c.id} · ${c.offLabel}`, `${offRow.on ? "IN THE BUILD" : "LEFT OUT"} (${offRow.source})`);
    show(`${c.id} · ${c.onLabel}`, `${onRow.on ? "IN THE BUILD" : "LEFT OUT"} (${onRow.source})`);
    assert.strictEqual(offRow.on, false, `${c.offLabel} did not take "${c.id}" out of the build`);
    assert.strictEqual(offRow.source, "rule", `${c.offLabel} took it out but credited "${offRow.source}"`);
    assert.strictEqual(onRow.on, true, `${c.onLabel} did not put "${c.id}" back in the build`);
    assert.strictEqual(offRow.locked, false, "an off workflow came back locked — a lock always means ON");
  }

  // Symmetry check: an UNANSWERED question must never remove a workflow the client
  // is paying for. Both rules are strict equality against one answer, not a falsy
  // test, and this is what notices that changing.
  for (const c of cases) {
    const unasked = resolvedWorkflowById(resolveWorkflows({ intake: {}, firedLeaks: null }), c.id)!;
    show(`${c.id} · question never asked`, `${unasked.on ? "IN THE BUILD" : "LEFT OUT"} (${unasked.source})`);
    assert.strictEqual(unasked.on, true, `an unasked question removed "${c.id}" from the build`);
  }
});

check("D3 · [THE SUBTLE ONE] an OBSERVED leak LOCKS the workflow ON — a stored `false` is IGNORED", () => {
  // The case most likely to be broken by a later edit, so it is proved on its own.
  // The lock is computed from the EVIDENCE, before the stored override is even
  // looked at, and it wins outright: a stale `false` written before the scan that
  // found this, or by a UI bug, or by a tab left open, cannot defeat it.
  const measured = firedById(BASE_REPORT, "no_after_hours_coverage")!;
  const overrides: WorkflowToggles = { "after-hours-auto-reply": false };
  const row = resolvedWorkflowById(
    resolveWorkflows({ intake: null, firedLeaks: BASE_REPORT, overrides }),
    "after-hours-auto-reply"
  )!;

  show("justifying leak    ", `${measured.leak.id} — tier ${measured.tier}, grade ${measured.grade}`);
  show("stored override    ", overrides);
  show("resolved on        ", row.on);
  show("resolved locked    ", row.locked);
  show("resolved source    ", row.source);
  show("lockReason         ", row.lockReason ?? "(none)");
  show("guarantee          ", "RUNTIME — the resolver ignores the stored value; the API refuses the write behind it");

  assert.strictEqual(measured.grade, "observed", `the justifying leak is graded "${measured.grade}" — this check needs a measured one`);
  assert.strictEqual(row.on, true, "an override of false switched off a workflow held on by our own measurement. The client's report carries that finding; the build would now contradict it.");
  assert.strictEqual(row.locked, true, "the workflow resolved unlocked despite a measured leak justifying it");
  assert(row.lockReason && row.lockReason.length > 0, "a locked switch with no tooltip — the operator gets a disabled control and no reason");
  // The tooltip has to name the measurement AND the way out. A gate with no way out
  // is a gate that strands him on a call at 11pm; the way out is never the switch,
  // because the resolver would ignore the stored value anyway.
  assert(/re-run the scan|change what we know/i.test(row.lockReason), `the lock reason does not say how to get out of it: ${row.lockReason}`);
  assert.strictEqual(row.source, "rule", `his decision was overruled and the screen still credits him with it: source "${row.source}"`);
});

check("D4 · IGNORED IS NOT DELETED — the operator's decision survives, and applies again when the lock lifts", () => {
  // The only reading of "an absent key means no opinion" that does not quietly
  // throw away something he said on purpose. His `false` sits in the JSON exactly
  // as he left it; when the measurement goes away — a re-scan, or an intake answer
  // that contradicts it — it applies again.
  const overrides: WorkflowToggles = { "after-hours-auto-reply": false };
  const locked = resolvedWorkflowById(resolveWorkflows({ firedLeaks: BASE_REPORT, overrides }), "after-hours-auto-reply")!;

  // The intake answer that contradicts the measurement: they DO have an
  // after-hours auto-response, so the leak is suppressed and nothing locks.
  const answered: ClientIntake = { afterHoursHandling: "AUTO_RESPONSE" };
  const rescanned = reportFor(withIntake(PROBE_SCRAPE, answered));
  const unlocked = resolvedWorkflowById(
    resolveWorkflows({ intake: answered, firedLeaks: rescanned, overrides }),
    "after-hours-auto-reply"
  )!;

  show("stored decision              ", overrides);
  show("while the measurement stands ", `on=${locked.on} locked=${locked.locked} source=${locked.source}`);
  show("after the answer contradicts it", `no_after_hours_coverage fires = ${Boolean(firedById(rescanned, "no_after_hours_coverage"))}`);
  show("his decision now applies     ", `on=${unlocked.on} locked=${unlocked.locked} source=${unlocked.source}`);
  show("stored decision, afterwards  ", overrides);

  assert.strictEqual(locked.on, true, "the lock did not hold in the first place");
  assert.strictEqual(unlocked.on, false, "the lock lifted and his decision was NOT honoured — it was thrown away rather than ignored");
  assert.strictEqual(unlocked.locked, false, "the workflow is still locked after the measurement went away");
  assert.strictEqual(unlocked.source, "operator", `his restored decision is credited to "${unlocked.source}"`);
  assert.deepStrictEqual(overrides, { "after-hours-auto-reply": false }, "resolving MUTATED the stored decisions");
});

check("D5 · a DISCLOSED leak does NOT lock — a client may tell us he will handle it himself", () => {
  const intake: ClientIntake = { missedCallHandling: "VOICEMAIL_ONLY" };
  const report = reportFor(withIntake(PROBE_SCRAPE, intake));
  const leak = firedById(report, "missed_calls_no_recovery")!;
  const unlocked = resolvedWorkflowById(resolveWorkflows({ intake, firedLeaks: report }), "missed-call-text-back")!;
  const overridden = resolvedWorkflowById(
    resolveWorkflows({ intake, firedLeaks: report, overrides: { "missed-call-text-back": false } }),
    "missed-call-text-back"
  )!;
  show("justifying leak", `${leak.leak.id} — tier ${leak.tier}, grade ${leak.grade}, confirmed=${leak.intakeConfirmed}`);
  show("resolved       ", `on=${unlocked.on} locked=${unlocked.locked} source=${unlocked.source}`);
  show("with override false", `on=${overridden.on} locked=${overridden.locked} source=${overridden.source}`);
  assert.strictEqual(leak.grade, "disclosed", `the justifying leak is graded "${leak.grade}" — this check needs a disclosed one`);
  assert.strictEqual(unlocked.locked, false, "a leak the CLIENT told us about locked the operator out. They told us; they can also tell us they will handle it.");
  assert.strictEqual(overridden.on, false, "the operator's decision was not honoured on an unlocked workflow");
  assert.strictEqual(overridden.source, "operator", `his decision is credited to "${overridden.source}"`);
});

check("D6 · an INFERRED leak does NOT lock — a guess must never overrule the operator", () => {
  const leak = firedById(BASE_REPORT, "no_follow_up_sequence")!;
  const unlocked = resolvedWorkflowById(resolveWorkflows({ firedLeaks: BASE_REPORT }), "lead-nurture-no-booking")!;
  const overridden = resolvedWorkflowById(
    resolveWorkflows({ firedLeaks: BASE_REPORT, overrides: { "lead-nurture-no-booking": false } }),
    "lead-nurture-no-booking"
  )!;
  show("justifying leak", `${leak.leak.id} — tier ${leak.tier}, grade ${leak.grade}`);
  show("resolved       ", `on=${unlocked.on} locked=${unlocked.locked} source=${unlocked.source}`);
  show("with override false", `on=${overridden.on} locked=${overridden.locked} source=${overridden.source}`);
  show("grade spread on this client's report", countBy(BASE_REPORT.map((f) => f.grade)));
  assert.strictEqual(leak.grade, "inferred", `the justifying leak is graded "${leak.grade}" — this check needs a guess`);
  assert.strictEqual(unlocked.locked, false, "a GUESS locked the operator out of his own build — that is the exact thing the grades exist to prevent");
  assert.strictEqual(overridden.on, false, "the operator's decision lost to a guess");

  // And the whole set, so "only observed locks" is stated over every workflow at
  // once rather than one at a time.
  const resolved = resolveWorkflows({ firedLeaks: BASE_REPORT });
  const wrong = resolved.filter((r) => r.locked !== r.justification.some((f) => f.grade === "observed"));
  for (const r of resolved)
    show(`  ${r.workflow.id.padEnd(38)}`, `locked=${String(r.locked).padEnd(5)} grades=${r.justification.map((f) => f.grade).join(",") || "-"}`);
  assert.deepEqual(wrong.map((r) => r.workflow.id), [], `lock state disagrees with the grades for: ${wrong.map((r) => r.workflow.id).join(", ")}`);
});

check("D7 · ONLY OVERRIDES ARE PERSISTED — never the resolved set", () => {
  // Business.workflowToggles holds DECISIONS, not answers. An absent key means "no
  // opinion, use the rule", which is the state almost every workflow stays in for
  // almost every client — and it is what lets a rule change, a re-scan or a new
  // intake answer reach a client who was configured months ago. Persisting the
  // resolved fourteen would freeze today's answer into the database and quietly
  // stop every one of those from ever applying again.
  const stored = withOverride({}, "webchat-capture", false);
  const twice = withOverride(stored, "text-to-pay", true);
  const resolved = resolveWorkflows({ firedLeaks: BASE_REPORT, overrides: twice });

  show("after ONE decision  ", stored);
  show("after TWO decisions ", twice);
  show("keys stored         ", Object.keys(twice).length);
  show("workflows resolved  ", resolved.length);
  show("if the RESOLVED SET were stored instead", Object.fromEntries(resolved.map((r) => [r.workflow.id, r.on])));

  assert.deepStrictEqual(stored, { "webchat-capture": false }, "one decision did not produce exactly one stored key");
  assert.equal(Object.keys(twice).length, 2, `two decisions produced ${Object.keys(twice).length} stored keys`);
  assert(
    Object.keys(twice).length < resolved.length,
    "the stored shape is as large as the resolved set — the answer is being frozen into the database instead of the decisions"
  );
  // Values are two-state booleans and nothing else. `on` is a two-state fact, and a
  // third state ("null", "maybe") would be honoured by nothing.
  for (const [k, v] of Object.entries(twice))
    assert.strictEqual(typeof v, "boolean", `stored key "${k}" holds a ${typeof v}, not a boolean`);
  // None of the DERIVED properties may reach the column. They are recomputed on
  // every read, which is the only way a rule change can ever reach an old client.
  for (const derived of ["on", "source", "locked", "lockReason", "because", "justification", "workflow"])
    assert(!(derived in twice), `the derived property "${derived}" is in the stored shape — the resolution is being persisted`);

  // A new object every time, never a mutation of what came out of the database: a
  // caller cannot half-write a column by handing the same reference to two places.
  assert.notStrictEqual(twice, stored, "withOverride mutated the stored decisions instead of returning a new object");
  assert.deepStrictEqual(stored, { "webchat-capture": false }, "withOverride mutated its input");

  // Read-back is defensive, because a Json column holds whatever was last written:
  // an older format, a half-finished write, hand-edited data.
  const readBack = readStoredToggles({
    "webchat-capture": false,
    "text-to-pay": "yes",
    "a-workflow-from-another-branch": true,
    nested: { on: true },
  });
  show("readStoredToggles(messy column)", readBack);
  assert.deepStrictEqual(
    readBack,
    { "webchat-capture": false, "a-workflow-from-another-branch": true },
    "the defensive read is not dropping non-boolean values, or is dropping an unknown id"
  );
  assert.deepStrictEqual(readStoredToggles(null), {}, "a null column did not read as no decisions");
  assert.deepStrictEqual(readStoredToggles(["webchat-capture"]), {}, "an array column did not read as no decisions");

  // [SOURCE-LEVEL] the write path. The route stores the value withOverride returned
  // and nothing else — this is the line that would have to change for a resolved
  // row to reach the column.
  const write = sourceLine("src/app/api/workflow-toggles/route.ts", /data:\s*\{\s*workflowToggles:/);
  const built = sourceLine("src/app/api/workflow-toggles/route.ts", /const next = withOverride\(/);
  show("[SOURCE-LEVEL] write         ", write ? `L${write.line}  ${write.text}` : "(NOT FOUND)");
  show("[SOURCE-LEVEL] what it writes", built ? `L${built.line}  ${built.text}` : "(NOT FOUND)");
  assert(write && built, "the PATCH route no longer writes withOverride(...) into workflowToggles — check what it writes now");
});

check("D8 · DETERMINISM — the same inputs resolve identically, twice", () => {
  // Pure: same four inputs, same answer, every time. No database, no clock, no
  // scraping, no randomness — which is what lets the toggles screen, the API and a
  // regenerated deliverable agree about what this client is getting. Two callers
  // that disagree about the build is a client finding out on a call.
  const intake: ClientIntake = { socialEnquiries: "YES", pastCustomerContact: "OVER_A_YEAR", hasCrm: false };
  const overrides: WorkflowToggles = { "text-to-pay": false, "webchat-capture": true };

  const run = (): ResolvedWorkflow[] =>
    resolveWorkflows({ intake, firedLeaks: reportFor(withIntake(PROBE_SCRAPE, intake)), overrides });

  // Compared through the WIRE shape, which is the flat, JSON-safe projection the
  // screen actually receives — comparing the resolutions directly would compare
  // shared object references and prove less than it looks.
  const first = run().map(toToggleRow);
  const second = run().map(toToggleRow);
  show("workflows      ", first.length);
  show("on / off / locked", `${first.filter((r) => r.on).length} / ${first.filter((r) => !r.on).length} / ${first.filter((r) => r.locked).length}`);
  show("first run bytes ", JSON.stringify(first).length);
  show("second run bytes", JSON.stringify(second).length);
  assert.deepStrictEqual(second, first, "two resolutions of identical inputs disagree");
  assert.strictEqual(JSON.stringify(second), JSON.stringify(first), "the two resolutions differ in key order — the wire payload is not byte-stable");

  // Justification order is TOTAL, not just stable-by-luck: score descending, ties
  // broken by leak id. A tooltip that quotes a different leak between two page
  // loads is a tooltip nobody trusts.
  for (const r of first) {
    const scores = r.justification.map((j) => j.leakId);
    show(`  ${r.id.padEnd(38)}`, scores.length ? scores.join(" > ") : "-");
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * E. SCOPE HYGIENE — copy emphasis is not scope
 *
 * `servicesFocus` ("which services do you want more of?") and its neighbour
 * `buildPriorities` ("which of these do you want prioritized in your build?") shape
 * WORDING and ORDERING in a document — which service gets named first, which phase
 * leads the roadmap. Neither may add, remove or reweight a workflow.
 *
 * Conflating the two is a specific, easy, expensive mistake, because the priorities
 * question reads exactly like a question about scope and is not one. A client who
 * says he cares most about after-hours calls has told us how to write the document,
 * not that the other thirteen workflows are cancelled. He paid for fourteen.
 * ══════════════════════════════════════════════════════════════════════════ */

section("E · SCOPE HYGIENE — the toggle layer never reads servicesFocus");

check("E1 · [SOURCE-LEVEL] neither copy-emphasis field appears in the toggle layer's CODE", () => {
  // A SOURCE-LEVEL check, and it is worth saying so plainly: it proves the
  // identifier is absent from the code as written today, not that the compiler
  // would reject it. E2 is the structural half.
  //
  // Comments are stripped before matching, because the file that must not read
  // these fields opens with four paragraphs explaining why it must not — a naive
  // substring search would fail on the explanation and pass on the day somebody
  // deletes the explanation and adds the field.
  const FILES = ["src/lib/workflow-toggles.ts", "src/lib/workflow-catalogue.ts"];
  const BANNED = ["servicesFocus", "buildPriorities"];
  for (const file of FILES) {
    const code = codeOnly(file);
    const raw = read(file);
    for (const field of BANNED) {
      const inCode = code.includes(field);
      const inProse = raw.includes(field);
      show(`${file} · ${field}`, `code: ${inCode ? "PRESENT" : "absent"}   ·   comments: ${inProse ? "explained" : "not mentioned"}`);
      assert(
        !inCode,
        `${file} reads ${field}. That field is COPY EMPHASIS — it decides which service gets named first in a document, not what gets built. Reading it here silently cancels workflows the client paid for.`
      );
    }
  }
  // Anti-vacuity: the comment stripper must not be eating the whole file.
  const stripped = codeOnly("src/lib/workflow-toggles.ts");
  show("stripped source still contains resolveWorkflows", stripped.includes("export function resolveWorkflows"));
  assert(stripped.includes("export function resolveWorkflows"), "the comment stripper removed real code — this check would pass on anything");
});

check("E2 · [COMPILE-TIME] nothing the resolver takes could carry copy emphasis anyway", () => {
  // The structural half of E1. resolveWorkflows takes exactly four things, and
  // servicesFocus / buildPriorities are Business columns — they are not declared on
  // ClientIntake at all, so there is no route by which one could reach this layer
  // even if somebody wanted it to.
  const inputFields = resolveWorkflowsInputFields();
  const intakeKeys = clientIntakeKeysFromSource();
  show("ResolveWorkflowsInput fields", inputFields);
  show("ClientIntake keys           ", intakeKeys);
  show("copy-emphasis fields on ClientIntake", intakeKeys.filter((k) => ["servicesFocus", "buildPriorities"].includes(k)));
  show("guarantee                   ", "COMPILE-TIME — neither name is a property of any type the resolver accepts");
  assert(inputFields.length >= 4, `only ${inputFields.length} field(s) parsed off ResolveWorkflowsInput — the source read is broken, not the type`);
  assert(intakeKeys.length >= 10, `only ${intakeKeys.length} ClientIntake key(s) parsed — the source read is broken, not the interface`);
  assert.deepEqual(
    inputFields.filter((f) => ["servicesFocus", "buildPriorities"].includes(f)),
    [],
    "the resolver now takes a copy-emphasis field as a parameter"
  );
  assert.deepEqual(
    intakeKeys.filter((k) => ["servicesFocus", "buildPriorities"].includes(k)),
    [],
    "a copy-emphasis field is now declared on ClientIntake, so it can reach the resolver through the intake argument"
  );
  // And the field the toggles API deliberately does NOT copy across from the row.
  const note = sourceLine("src/app/api/workflow-toggles/route.ts", /NOT READ, ON PURPOSE: servicesFocus/);
  const routeCode = codeOnly("src/app/api/workflow-toggles/route.ts");
  show("[SOURCE-LEVEL] the route's own note", note ? `L${note.line}  ${note.text}` : "(NOT FOUND)");
  show("[SOURCE-LEVEL] route CODE reads servicesFocus", routeCode.includes("servicesFocus"));
  assert(!routeCode.includes("servicesFocus"), "the toggles route now copies servicesFocus into the intake it resolves against");
});

/* ════════════════════════════════════════════════════════════════════════════
 * HELPERS
 * Inputs and small utilities for the checks above. Kept at the bottom so the
 * claims read first — these are all hoisted `function` declarations, so calling
 * them from a check() callback further up is safe.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The property names declared on ClientIntake, parsed out of the interface itself.
 *
 *  WHY PARSE RATHER THAN LIST. `keyof ClientIntake` is erased at runtime, so a
 *  script can only compare against a list typed in by hand — and a hand-typed list
 *  is exactly what goes stale when a field is added, quietly turning "no
 *  copy-emphasis field can reach the resolver" into "no copy-emphasis field was on
 *  the interface in July". Reading the declaration keeps the check honest. */
function clientIntakeKeysFromSource(): string[] {
  const src = read("src/lib/leak-taxonomy.ts");
  const start = src.indexOf("export interface ClientIntake {");
  if (start < 0)
    throw new Error(
      "ClientIntake is no longer declared in src/lib/leak-taxonomy.ts — this check reads the real interface and must not fall back to a list typed in here"
    );
  const body = src.slice(start, src.indexOf("\n}", start));
  // Property lines only: two spaces of indent, a name, then `?:` or `:`. Doc
  // comments start with `/` or `*`, and union members continue at four spaces —
  // neither can match.
  return Array.from(body.matchAll(/^ {2}(\w+)\??:/gm), (m) => m[1]);
}

/** The same trick for the resolver's single argument: the four things it is allowed
 *  to see. Parsed for the same reason — a fifth one added here is exactly the edit
 *  section E exists to notice. */
function resolveWorkflowsInputFields(): string[] {
  const src = read("src/lib/workflow-toggles.ts");
  const start = src.indexOf("export interface ResolveWorkflowsInput {");
  if (start < 0)
    throw new Error(
      "ResolveWorkflowsInput is no longer declared in src/lib/workflow-toggles.ts — this check reads the real interface"
    );
  const body = src.slice(start, src.indexOf("\n}", start));
  return Array.from(body.matchAll(/^ {2}(\w+)\??:/gm), (m) => m[1]);
}

/**
 * RUN THE REAL COMPILER over two probe files and report what it said.
 *
 * The control probe is a valid WorkflowDefinition; the violation probe is the same
 * literal with `gatedOnALeak: true`. Both are compiled in ONE pass against the
 * repo's own tsconfig, so the two results come from an identical environment — that
 * is what makes the control meaningful. Without it, a missing dependency or a
 * broken path mapping would make the violation probe "fail to compile" for the
 * wrong reason and this check would go green on nothing.
 *
 * The probes are written to a temp directory rather than into the repo because a
 * file that is SUPPOSED to fail typecheck cannot live under a tsconfig `include`
 * that `npm run typecheck` also reads — it would break the very suite it is here to
 * defend.
 *
 * (Deliberately the same shape as compileProbe() in scripts/verify-phase1.ts. The
 * two were not extracted into a shared helper because a verification script that
 * imports its own machinery from somewhere else is one indirection away from
 * proving nothing; each file's proof stands up on its own.)
 */
function compileProbe(): {
  controlSource: string;
  controlErrors: string[];
  violationSource: string;
  violationErrors: string[];
} {
  const literal = (gated: string): string =>
    [
      'import type { WorkflowDefinition } from "@/lib/workflow-catalogue";',
      "const probe: WorkflowDefinition = {",
      '  id: "probe", name: "Probe", whatItDoes: "x", trigger: "x", whatTheClientSees: "x",',
      `  justifyingLeaks: [], gatedOnALeak: ${gated},`,
      '  applicability: { kind: "every_build" }, defaultOn: true,',
      "};",
      "void probe;",
    ].join("\n");
  const CONTROL = literal("false");
  const VIOLATION = literal("true");

  const tsc = resolve(REPO, "node_modules/typescript/bin/tsc");
  if (!existsSync(tsc))
    throw new Error(
      `the TypeScript compiler is not installed at ${tsc} — this check compiles real code and cannot be approximated by reading the source`
    );

  const dir = mkdtempSync(join(tmpdir(), "verify-phase2-compile-"));
  try {
    writeFileSync(join(dir, "control.ts"), `${CONTROL}\n`);
    writeFileSync(join(dir, "violation.ts"), `${VIOLATION}\n`);
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
          include: ["control.ts", "violation.ts"],
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
    // "../../../..//tmp/…/violation.ts" and a prefix test would silently match
    // nothing — which reads exactly like "it compiled".
    const diagnostics: { file: string; text: string }[] = [];
    for (const line of `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n")) {
      if (!line.trim()) continue;
      const m = /^(?:.*[/\\])?([\w.-]+\.tsx?)\(\d+,\d+\):/.exec(line);
      if (m) diagnostics.push({ file: m[1], text: line.trim().slice(line.trim().indexOf(m[1])) });
      // TS wraps the "why" of an error onto indented continuation lines. They are
      // the most useful part of this particular error, so they are kept attached to
      // the diagnostic they explain rather than dropped.
      else if (diagnostics.length && /^\s/.test(line))
        diagnostics[diagnostics.length - 1].text += ` ${line.trim()}`;
    }
    const errorsIn = (file: string): string[] =>
      diagnostics.filter((d) => d.file === file).map((d) => d.text);

    return {
      controlSource: "gatedOnALeak: false  (the only value the type admits)",
      controlErrors: errorsIn("control.ts"),
      violationSource: "gatedOnALeak: true   (a workflow declaring itself leak-gated)",
      violationErrors: errorsIn("violation.ts"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
