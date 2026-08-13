/**
 * PHASE 0.6 PROOF — the five claims of this round, each demonstrated against the
 * REAL shipped code, offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase06.ts
 *   npm run verify:phase06
 *
 * Every check prints its own inputs and outputs so a reader can audit the claim
 * without trusting the assertion. Exits 1 if ANY check fails.
 *
 *   A. INTAKE DRIVES THE DETECTORS — each of the five new intake answers is run
 *                                    through the REAL detector three times and
 *                                    lands in exactly one of the three states the
 *                                    contract promises: handled ⇒ suppressed,
 *                                    "we don't" ⇒ fires CONFIRMED, not sure ⇒
 *                                    fires at BENCHMARK with the kickoff hedge.
 *   B. THE VOLUME SLOTS HOLD WHAT   — monthlyEnquiries feeds the sentence that
 *      THEY SAY                       says "enquiries/mo", monthlyBookedAppointments
 *                                     feeds the one that says "booked/mo", and
 *                                     neither can be printed as the other.
 *   C. THE OVERRIDE IS REAL         — a fatal check blocks; a blank reason is
 *                                    refused; a stale acknowledgement is refused;
 *                                    a correct one ships AND leaves a governance
 *                                    record; a clean pack ships with no trace.
 *   D. THE FIXTURE IS SELF-         — the committed golden pack is synthetic, in
 *      SUFFICIENT                     git, law-compliant and wide, and NOTHING in
 *                                     verify:all reads a gitignored path.
 *   E. USD_TO_CAD IS A LABELLED     — it lives in ASSUMPTIONS, says in words that
 *      ASSUMPTION                     it is a working assumption, carries the date
 *                                     it was set, is still 1.35, and is applied
 *                                     with floor() so it can only understate.
 */

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeMathEstimate,
  buildLeakInputs,
  cad,
  USD_TO_CAD,
  KICKOFF_VERIFICATION_LINE,
} from "@/lib/leak-narrative";
import {
  ASSUMPTIONS,
  type ClientIntake,
  type ScrapeData,
  type Vertical,
} from "@/lib/leak-taxonomy";
import { getFiredLeaks, type FiredLeak } from "@/lib/leak-detection";
import {
  assertPackValid,
  evaluateOverride,
  withGovernance,
  formatOverrideLog,
  type ValidationCheck,
} from "@/lib/exporters/validate-pack";
import { buildAssetZipChecked, validateRenderedDeliverables } from "@/lib/exporters";
import type { AssetPack, PackGovernance } from "@/types";

// ── harness ───────────────────────────────────────────────────────────────────
// Identical shape to scripts/verify-phase05.ts: a counting check() that never
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

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

/* ════════════════════════════════════════════════════════════════════════════
 * A. THE FIVE INTAKE FIELDS DRIVE THE DETECTORS
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * ONE fixture for all five fields, tuned so that with NO intake at all, every one
 * of the five leaks fires on its BENCHMARK path. That is what makes the three
 * branches comparable: the ONLY thing that changes between the runs below is the
 * single intake answer, so any difference in the fired set is caused by it and
 * nothing else.
 *
 * Why each field is set the way it is:
 *   · hasContactForm PRESENT  — slow_speed_to_lead needs a CONFIRMED form to
 *                               anchor its benchmark branch.
 *   · chat + booking ABSENT   — keeps the after-hours capture path unconfirmed.
 *   · mentionsTextingOption   — false, so missed_calls_no_recovery reaches its
 *                               "phone line with no text-back path" branch.
 *   · gbp.hoursListed false   — routes no_after_hours_coverage to BENCHMARK
 *     with limitedHours false   rather than its OBSERVED branch, which is the tier
 *                               the "not sure" case is supposed to land on.
 *   · industry plumbing       — a deposit-taking vertical, so
 *                               payment_booking_friction can fire at all.
 *   · reviewTexts empty       — no review proxy, so no detector jumps to EVIDENCED
 *                               and masks what the intake answer did.
 */
function intakeFixture(intake?: ClientIntake): ScrapeData {
  return {
    business: {
      name: "Rivermark Plumbing",
      industry: "plumbing",
      city: "Hamilton",
      phone: "555-0177",
      websiteUrl: "https://rivermarkplumbing.example",
    },
    website: {
      pagesFound: ["home", "services", "contact"],
      pageText: {
        home: "Drain and sewer work across Hamilton.",
        contact: "Send us a message and we'll get back to you.",
      },
      scanConfident: true,
      hasContactForm: "PRESENT",
      formHasQualifyingFields: true,
      hasOnlineBookingLink: "ABSENT",
      hasChatWidget: "ABSENT",
      hasClickToCallOnMobile: "PRESENT",
      hasPrimaryCtaAboveFold: true,
      servicePagesHaveCtas: true,
      mentionsTextingOption: false,
      linksToFacebook: false,
      linksToInstagram: false,
    },
    pageSpeed: { mobileScore: 78, lcpSeconds: 2.4 },
    googleReviews: { rating: 4.7, count: 44, recentCount90d: 3, ownerResponseRate: -1, reviewTexts: [] },
    gbp: { hoursListed: false, limitedHours: false, hasBookingLink: false, messagingEnabled: false },
    competitors: [
      { name: "A Plumbing", rating: 4.6, reviewCount: 150 },
      { name: "B Plumbing", rating: 4.5, reviewCount: 120 },
    ],
    intake,
  };
}

/** Every answer an intake field can carry, for the probe table below. */
type IntakeValue = string | boolean | undefined;

interface IntakeProbe {
  /** The leak whose detector reads this field. */
  leakId: string;
  /** The answer that means "we already do this" → the leak must vanish. */
  handled: IntakeValue;
  /** An answer that means "we don't" → the leak fires as a CONFIRMED fact. */
  confirms: IntakeValue;
  /** "Not sure" / "we don't track it" / never asked → today's hedge, unchanged.
   *  More than one because the enum fields have BOTH an explicit unknown slug and
   *  the never-asked case, and they must behave identically. */
  unknown: IntakeValue[];
}

const INTAKE_PROBES: Record<string, IntakeProbe> = {
  afterHoursHandling: {
    leakId: "no_after_hours_coverage",
    handled: "AUTO_RESPONSE",
    confirms: "NOTHING",
    unknown: [undefined, "UNKNOWN"],
  },
  missedCallHandling: {
    leakId: "missed_calls_no_recovery",
    handled: "INSTANT_TEXT_BACK",
    confirms: "VOICEMAIL_ONLY",
    unknown: [undefined, "UNKNOWN"],
  },
  responseSpeed: {
    leakId: "slow_speed_to_lead",
    handled: "UNDER_5_MIN",
    confirms: "DAY_OR_TWO",
    unknown: [undefined, "NOT_TRACKED"],
  },
  hasCallTracking: {
    leakId: "no_call_tracking",
    handled: true,
    confirms: false,
    // A boolean column has no third slug: "not sure" and "never asked" are the
    // same absent value by the time it reaches the detector.
    unknown: [undefined],
  },
  hasOnlinePayment: {
    leakId: "payment_booking_friction",
    handled: true,
    confirms: false,
    unknown: [undefined],
  },
};

/**
 * WHERE EVERY OTHER INTAKE FIELD IS ACCOUNTED FOR.
 *
 * The coverage check below scans the shipped detector source for every intake
 * field any detector reads, and demands that each one appears either in the probe
 * table above (proved here, three branches) or in this map (proved elsewhere, or
 * explicitly not proved). Adding a sixth intake-driven detector without a probe
 * therefore fails this suite instead of quietly shipping unproven.
 */
const COVERED_ELSEWHERE: Record<string, string> = {
  hasCrm: "scripts/verify-intake.ts — run 3 proves hasCrm: true suppresses no_crm_pipeline",
  hasFollowUpSequence:
    "scripts/verify-intake.ts — run 2 proves hasFollowUpSequence: false renders 'Confirmed at intake' with no kickoff line",
  bookingMethod: "scripts/make-golden-sample.ts — the committed fixture is built with PHONE_EMAIL_ONLY",
  hasReminderSystem: "PRE-PHASE-0.6 — no three-branch probe anywhere yet",
  hasPastCustomerDatabase:
    "scripts/verify-phase2.ts — A4 proves it suppresses no_database_reactivation ahead of the dormancy answer, and A11 proves it is the BUILD's applicability fact while pastCustomerContact answers the LEAK",
  // The two Phase 1 fields that closed the last structural evidence gaps. Proved
  // in verify-phase2 rather than here because the interesting half of each is not
  // the three branches but the SPLIT: one answer drives the leak, a different
  // answer drives what gets built.
  socialEnquiries:
    "scripts/verify-phase2.ts — A1–A3 prove all three branches, and A10 proves the case that is easy to get backwards (NO suppresses the leak but does NOT switch the Social DM Capture workflow off; only NO_ACCOUNTS does both)",
  pastCustomerContact:
    "scripts/verify-phase2.ts — A4–A6 prove all three branches, including that each dormancy answer confirms the leak in its own words",
  // PHASE 3. This one could NOT go in INTAKE_PROBES above, and the reason is the
  // whole point of the field. Every probe in that table asserts a THIRD branch —
  // "not sure / never asked leaves today's benchmark hedge, unchanged". That is
  // exactly what no_review_replies must NOT do: nothing we fetch carries an
  // owner-reply signal, so a hedge off a blank would be a finding invented out of
  // an unasked question, which is why the old unanswered_reviews leak was deleted.
  // Running it through the shared table would have asserted the bug.
  reviewReplyOwner:
    "scripts/verify-phase3.ts — section B proves all three answers (NOBODY fires it disclosed, OWNER and STAFF_OR_AGENCY suppress it) AND the branch this table cannot express: unanswered/no-intake DOES NOT FIRE, so a cold pre-sale scan can never produce it",
};

/** A COVERED_ELSEWHERE entry that names a script must name one that EXISTS.
 *
 *  ADDED IN PHASE 3, AND IT IS A TIGHTENING, NOT A CONVENIENCE. This map used to
 *  be free text: a citation was a sentence somebody typed, and a renamed or
 *  deleted verify script would leave a field reading as "proved over there" with
 *  nothing over there. So the file path in each entry is now extracted and
 *  checked against the filesystem, and the ONE field with no proof anywhere has to
 *  say so in the agreed words instead of being dressed up as a citation. */
const NOT_PROVED_MARKER = "PRE-PHASE-0.6";

/** Build an intake object carrying exactly ONE answer.
 *
 *  The single cast in this file, and it is deliberate: the probe table is keyed by
 *  FIELD NAME (which is the entire point — the coverage check reads those keys),
 *  so the key is a plain string at compile time and cannot narrow to a ClientIntake
 *  property. The names themselves are proved correct by the coverage check, which
 *  compares them against the field names the shipped detectors actually read. */
function intakeWith(field: string, value: IntakeValue): ClientIntake {
  return { [field]: value } as unknown as ClientIntake;
}

const firedIds = (fired: FiredLeak[]): string[] => fired.map((f) => f.leak.id);
const firedById = (fired: FiredLeak[], id: string): FiredLeak | undefined =>
  fired.find((f) => f.leak.id === id);

/** How a single answer describes itself in the log line. `undefined` prints as
 *  "(not asked)" rather than disappearing, because "never asked" is a real branch
 *  of the contract and has to be visible in the evidence. */
const answerLabel = (v: IntakeValue): string => (v === undefined ? "(not asked)" : JSON.stringify(v));

/* ════════════════════════════════════════════════════════════════════════════
 * B. THE RENAMED VOLUME SLOTS
 * ══════════════════════════════════════════════════════════════════════════ */

// Two DELIBERATELY DIFFERENT numbers. If the slots are wired the way they are
// named, 41 can only ever appear as an enquiry count and 23 only as a booking
// count. The aliasing bug this locks down did the opposite: the enquiry count the
// operator typed in was rendered back to the client as "N booked/mo".
const ENQUIRIES = 41;
const BOOKED = 23;
const BOTH_VOLUMES: ClientIntake = {
  monthlyEnquiries: ENQUIRIES,
  monthlyBookedAppointments: BOOKED,
  avgJobValueCad: 800,
};

/** The retired ClientIntake slot names, and what each one used to render as.
 *  `monthlyLeadVolume` is the one that mattered: the operator's INBOUND ENQUIRY
 *  count went into it and came out of the no-show frame as "N booked/mo". */
const RETIRED_SLOTS = ["monthlyCallVolume", "monthlyLeadVolume"] as const;

/** The three modules that make up the leak math layer. Neither retired name may
 *  appear in ANY of them. `monthlyLeadVolume` survives ONLY as a dormant Prisma
 *  column (dropping a shipped column is destructive and this codebase does not do
 *  that). Since Phase 3 nothing reads or writes it: the two numbers live on
 *  LeakAssessment, which is the single source, and the crossing into the intake
 *  contract is asserted below against THAT source. */
const LEAK_MATH_MODULES = [
  "src/lib/leak-taxonomy.ts",
  "src/lib/leak-narrative.ts",
  "src/lib/leak-detection.ts",
] as const;

/** Every .ts/.tsx file under src/, for the repo-wide greps in section B.
 *
 *  Sourced from git (tracked + untracked-but-not-ignored) rather than from a
 *  directory walk, so a file that only exists on this laptop because it is
 *  gitignored can never be counted as proof about what is in the repo. The
 *  existsSync filter drops the other half of that: git's index still lists files
 *  that have been deleted from the working tree but not yet committed. */
function sourceFiles(): string[] {
  const out = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], {
    cwd: REPO,
    encoding: "utf8",
  });
  const listed = (out.stdout ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.endsWith(".ts") || s.endsWith(".tsx"))
    .filter((s) => existsSync(resolve(REPO, s)));
  assert(
    listed.length > 0,
    "could not enumerate src/ — `git ls-files` returned nothing.\n" +
      "  This check reads the file list FROM GIT on purpose (see the comment above): a file\n" +
      "  that exists only on one laptop because it is gitignored must never count as proof\n" +
      "  about what is in the repo. So it needs a real git checkout to run.\n" +
      "  A fresh clone has one. A source tarball, or a Docker build context with .git\n" +
      "  stripped, does NOT — run this suite from a checkout instead."
  );
  return listed;
}

/** Every `file:line` in src/ where `needle` appears. Printed, not just counted,
 *  so a failure names the exact place the retired slot came back. */
function grepSrc(needle: string, files: string[]): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = read(f).split("\n");
    lines.forEach((line, i) => {
      if (line.includes(needle)) hits.push(`${f}:${i + 1}`);
    });
  }
  return hits;
}

/* ════════════════════════════════════════════════════════════════════════════
 * C. THE OVERRIDE
 * ══════════════════════════════════════════════════════════════════════════ */

const GOLDEN_PATH = "_fixtures/golden-pack.json";
const cleanPack = JSON.parse(read(GOLDEN_PATH)) as AssetPack;
const clone = (p: AssetPack): AssetPack => JSON.parse(JSON.stringify(p)) as AssetPack;

// The same corruption verify-phase05 uses for its block test: nobody can promise
// an outcome, so "guaranteed" is a fatal claim. Reused on purpose — the override
// has to be exercised against a real law failure, not a synthetic one.
const HYPE_SENTENCE = "Bookings are guaranteed within 30 days.";
// THE CORRUPTION MUST LAND ON RENDERED COPY (2026-08-13).
//
// Both corruptions used to go into intelligence.executiveSummary, which D1
// rendered. D1 is gone — the Diagnosis renders the saved calculator — and the
// text laws now judge the RENDERED documents rather than the whole pack blob, so
// prose buried in an unrendered section is invisible to them. That is correct
// behaviour (a law about client-facing copy reads the client-facing copy), and
// it made this fixture stop corrupting anything.
//
// surfaces.bookingPage.reassuranceLine is client copy that DOES render, in the
// Asset Pack — verify-phase3 G1/G2 prove that section reaches a document. Break
// that and the gate has something real to catch.
const brokenPack = clone(cleanPack);
if (brokenPack.surfaces?.bookingPage)
  brokenPack.surfaces.bookingPage.reassuranceLine = `${HYPE_SENTENCE} ${brokenPack.surfaces.bookingPage.reassuranceLine}`;

const brokenBoundary = validateRenderedDeliverables(brokenPack);
const FATALS: ValidationCheck[] = brokenBoundary.fatals;

// A SECOND, DIFFERENT corruption — lead-gen language, which is a scope violation
// (ReclaimedHQ does not sell traffic) rather than a hype claim. It exists so the
// stale-acknowledgement test can be run with two sets of REAL check ids from two
// real failures, which is the actual attack the handshake exists to stop: an
// acknowledgement collected while looking at failure A being replayed to wave
// through failure B.
const LEADGEN_SENTENCE = "We will run paid ads to drive traffic to the new page.";
const otherBrokenPack = clone(cleanPack);
if (otherBrokenPack.surfaces?.bookingPage)
  otherBrokenPack.surfaces.bookingPage.proofLine = `${LEADGEN_SENTENCE} ${otherBrokenPack.surfaces.bookingPage.proofLine}`;
const OTHER_FATALS: ValidationCheck[] = validateRenderedDeliverables(otherBrokenPack).fatals;

const REAL_REASON =
  "Reviewed with the client on the call — the sentence is quoting their own guarantee back to them, not a promise we made. Shipping tonight, regenerating tomorrow.";

/** A correctly-formed override: a real reason plus every currently-failing id
 *  echoed back exactly. */
const goodOverride = () => ({
  reason: REAL_REASON,
  acknowledgedChecks: FATALS.map((c) => c.id),
});

/* ════════════════════════════════════════════════════════════════════════════
 * D. THE COMMITTED FIXTURE
 * ══════════════════════════════════════════════════════════════════════════ */

/** `git check-ignore` verdict for a repo-relative path.
 *  exit 0 = the path IS ignored, exit 1 = it is not, anything else = git failed
 *  and we must not silently read that as "fine". */
function isGitIgnored(rel: string): boolean {
  const r = spawnSync("git", ["check-ignore", "-q", "--", rel], { cwd: REPO, encoding: "utf8" });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  // Status 128 is git's "not a git repository". Never read that as "not ignored" —
  // that would turn the whole fresh-clone guarantee into a silent pass.
  throw new Error(
    `git check-ignore failed for ${rel} (status ${r.status}): ${r.stderr ?? ""}\n` +
      "  This section proves the verification suite reads no gitignored path, which is\n" +
      "  only answerable inside a git checkout. Run it from one."
  );
}

const PKG = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

/** Every shell command verify:all actually runs, in order. Read from package.json
 *  rather than listed here, so a script added to the chain is scanned for
 *  gitignored paths automatically instead of being forgotten. */
function verifyAllCommands(): string[] {
  const chain = PKG.scripts["verify:all"] ?? "";
  const names = Array.from(chain.matchAll(/npm run ([\w:-]+)/g), (m) => m[1]);
  return names.map((n) => PKG.scripts[n]).filter(Boolean);
}

// A repo-relative file path: something with a directory separator and a real file
// extension. Requiring the quotes is what keeps prose in comments (e.g. a usage
// example in a header block) out of the scan — only actual string literals count.
const PATH_LITERAL = /["'`]((?:\.\/)?[\w.-]+(?:\/[\w.-]+)+\.[a-z]{2,5})["'`]/g;

/** Every repo-relative path the verify:all suite can actually open: the script
 *  files themselves, any path arguments on their command lines, and every path
 *  literal inside their source. Paths that don't exist on disk are dropped — they
 *  are import specifiers or examples, not files the suite reads. */
function suitePaths(): string[] {
  const found = new Set<string>();
  const scriptFiles: string[] = [];

  for (const cmd of verifyAllCommands()) {
    for (const token of cmd.split(/\s+/)) {
      if (!token.includes("/") || !/\.[a-z]{2,5}$/.test(token)) continue;
      found.add(token);
      if (token.endsWith(".ts")) scriptFiles.push(token);
    }
  }

  for (const f of scriptFiles) {
    if (!existsSync(resolve(REPO, f))) continue;
    // Array.from rather than `for…of` over the iterator: this repo's tsconfig sets
    // no `target`, so iterating a matchAll result directly fails typecheck.
    for (const p of Array.from(read(f).matchAll(PATH_LITERAL), (m) => m[1]))
      found.add(p.replace(/^\.\//, ""));
  }

  return Array.from(found)
    .filter((p) => existsSync(resolve(REPO, p)))
    .sort();
}

/* ════════════════════════════════════════════════════════════════════════════
 * E. USD_TO_CAD
 * ══════════════════════════════════════════════════════════════════════════ */

// Mirrors the PRIVATE VERTICAL_CPL_USD table in leak-narrative.ts (cpl_google_ads
// is published in USD). Kept here as the independent expectation — the same trick
// verify-phase05 uses, so a change to the table without a change to the conversion
// fails loudly instead of silently agreeing with itself.
const CPL_USD: Partial<Record<Vertical, number>> = {
  hvac: 129,
  plumbing: 129,
  roofing: 228,
  electrical: 94,
  dental: 84,
  law: 132,
};

/** The same fixture with only the industry swapped, for the currency sweep. */
function forVertical(v: Vertical): ScrapeData {
  const d = intakeFixture();
  return { ...d, business: { ...d.business, industry: v } };
}

/** Every client-facing string a MathEstimate can put in front of an owner. */
function clientFacingStrings(m: ReturnType<typeof computeMathEstimate>): string[] {
  if (!m) return [];
  const out = [m.frame, m.overlapNote ?? ""];
  if (m.impact)
    out.push(m.impact.leadVolumeBasis, m.impact.effectSize, m.impact.avgValueBasis, m.impact.formula);
  return out.filter(Boolean);
}

/* ════════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  console.log("\nPHASE 0.6 VERIFICATION — offline proof of the round's five claims");

  /* ──────────────────────────────────────────────────────────────────────────
   * A · INTAKE DRIVES THE DETECTORS
   * ────────────────────────────────────────────────────────────────────── */
  section("A · THE FIVE INTAKE FIELDS DRIVE THE DETECTORS — handled / confirmed / not sure");

  // The baseline every branch is compared against: no intake at all.
  const baselineFired = getFiredLeaks(intakeFixture());
  const baselineIds = firedIds(baselineFired);

  check("A0 · with NO intake, all five gated leaks fire at BENCHMARK (the branches are comparable)", () => {
    show("fired leak ids", baselineIds);
    for (const [field, probe] of Object.entries(INTAKE_PROBES)) {
      const f = firedById(baselineFired, probe.leakId);
      assert(f, `${field}: ${probe.leakId} did not fire on the no-intake fixture — the fixture no longer exercises it`);
      show(`${probe.leakId} (${field})`, { tier: f!.tier, intakeConfirmed: f!.intakeConfirmed ?? false });
      assert.equal(
        f!.tier,
        "BENCHMARK",
        `${probe.leakId} fires at ${f!.tier} on the bare fixture, so the "not sure" branch below cannot prove the benchmark tier`
      );
    }
  });

  check("A0b · EVERY intake field a detector reads is accounted for (a new one cannot slip past)", () => {
    // Scanned from the SHIPPED detector source, not from a list maintained here —
    // that is what makes this check able to notice a field nobody told it about.
    const src = read("src/lib/leak-detection.ts");
    const readByDetectors = Array.from(
      new Set(Array.from(src.matchAll(/\bintake\?\.([A-Za-z0-9_]+)/g), (m) => m[1]))
    ).sort();
    const accountedFor = [...Object.keys(INTAKE_PROBES), ...Object.keys(COVERED_ELSEWHERE)].sort();
    show("read by detectors", readByDetectors);
    show("probed here      ", Object.keys(INTAKE_PROBES).sort());
    show("covered elsewhere", Object.keys(COVERED_ELSEWHERE).sort());
    for (const [f, where] of Object.entries(COVERED_ELSEWHERE)) show(`  ${f}`, where);
    assert.deepStrictEqual(
      accountedFor,
      readByDetectors,
      "leak-detection.ts reads an intake field this suite knows nothing about — add a three-branch probe to INTAKE_PROBES, or an entry to COVERED_ELSEWHERE saying where it is proved"
    );
  });

  check("A0c · every 'covered elsewhere' citation points at a script that EXISTS", () => {
    // THE STRONGER HALF OF A0b. A0b proves every field is ACCOUNTED FOR; on its own
    // that is satisfied by any sentence at all. This proves the account is real:
    // the script named in the citation has to be on disk, so renaming or deleting
    // a verify script cannot leave an intake field silently unproven behind a
    // citation that no longer resolves.
    const dangling: string[] = [];
    const unproven: string[] = [];
    for (const [field, where] of Object.entries(COVERED_ELSEWHERE)) {
      const cited = where.match(/scripts\/[A-Za-z0-9._-]+\.ts/g) ?? [];
      if (!cited.length) {
        // No script named at all. The only acceptable form of that is an explicit
        // admission that nothing proves it — never a vague reassurance.
        if (!where.includes(NOT_PROVED_MARKER)) dangling.push(`${field}: cites no script and does not say it is unproven`);
        else unproven.push(field);
        continue;
      }
      for (const path of cited) {
        const ok = existsSync(resolve(REPO, path));
        show(`${field} → ${path}`, ok ? "exists" : "MISSING");
        if (!ok) dangling.push(`${field}: cites ${path}, which does not exist`);
      }
    }
    show("fields with no proof anywhere (declared)", unproven);
    assert.equal(
      dangling.length,
      0,
      `COVERED_ELSEWHERE citation(s) do not resolve: ${dangling.join(" | ")}`
    );
  });

  for (const [field, probe] of Object.entries(INTAKE_PROBES)) {
    // ── branch 1 — handled: the leak must vanish entirely ─────────────────
    check(`A · ${field} = ${answerLabel(probe.handled)} (handled) ⇒ ${probe.leakId} does NOT fire`, () => {
      const fired = getFiredLeaks(intakeFixture(intakeWith(field, probe.handled)));
      const ids = firedIds(fired);
      show("intake     ", intakeWith(field, probe.handled));
      show("fired ids  ", ids);
      show("suppressed ", probe.leakId);
      assert(
        !ids.includes(probe.leakId),
        `${probe.leakId} still fired after the client told us they already have it — we would be selling them a fix for something they have`
      );
      // Suppression must be TARGETED. If everything else vanished too, the check
      // above would pass for entirely the wrong reason.
      const collateral = baselineIds.filter((id) => id !== probe.leakId && !ids.includes(id));
      show("other leaks lost", collateral);
      assert.equal(collateral.length, 0, `one answer suppressed unrelated leaks: ${collateral.join(", ")}`);
    });

    // ── branch 2 — confirmed: fires, and stops hedging ────────────────────
    check(`A · ${field} = ${answerLabel(probe.confirms)} (they told us they don't) ⇒ ${probe.leakId} fires CONFIRMED`, () => {
      const data = intakeFixture(intakeWith(field, probe.confirms));
      const fired = getFiredLeaks(data);
      const f = firedById(fired, probe.leakId);
      show("intake   ", intakeWith(field, probe.confirms));
      show("fired ids", firedIds(fired));
      assert(f, `${probe.leakId} did not fire even though the client confirmed the gap`);
      show("tier            ", f!.tier);
      show("intakeConfirmed ", f!.intakeConfirmed);
      show("evidence        ", f!.evidence);
      assert.strictEqual(
        f!.intakeConfirmed,
        true,
        `${probe.leakId} fired without intakeConfirmed — the deliverable will hedge about a gap the client already told us about, and ask them the same question twice`
      );
      // The confirmed framing REPLACES the kickoff line — asking a client to
      // verify at kickoff what they answered at intake is the insult this flag
      // exists to prevent.
      const [input] = buildLeakInputs([f!], data);
      show("requiresKickoffLine", input.requiresKickoffLine);
      assert.equal(
        input.requiresKickoffLine,
        false,
        `${probe.leakId} still demands the kickoff-verification line after being confirmed at intake`
      );
      assert(
        f!.evidence.some((e) => /confirmed at intake/i.test(e)),
        `${probe.leakId} carries no "Confirmed at intake" evidence line: ${f!.evidence.join(" · ")}`
      );
    });

    // ── branch 3 — not sure / not asked: today's hedge, unchanged ──────────
    check(`A · ${field} = not sure / not asked ⇒ ${probe.leakId} fires at BENCHMARK with the kickoff hedge`, () => {
      for (const value of probe.unknown) {
        const intake = value === undefined ? undefined : intakeWith(field, value);
        const data = intakeFixture(intake);
        const fired = getFiredLeaks(data);
        const f = firedById(fired, probe.leakId);
        show("answer   ", answerLabel(value));
        assert(f, `${probe.leakId} did not fire for ${answerLabel(value)} — an unanswered question silently removed a leak`);
        show("  tier           ", f!.tier);
        show("  intakeConfirmed", f!.intakeConfirmed ?? false);
        assert.equal(
          f!.tier,
          "BENCHMARK",
          `${probe.leakId} at ${answerLabel(value)} fired at ${f!.tier}, not BENCHMARK — an unanswered question was treated as proof`
        );
        assert(
          !f!.intakeConfirmed,
          `${probe.leakId} at ${answerLabel(value)} claims to be confirmed at intake, but nobody confirmed anything`
        );
        const [input] = buildLeakInputs([f!], data);
        show("  requiresKickoffLine", input.requiresKickoffLine);
        assert.equal(
          input.requiresKickoffLine,
          true,
          `${probe.leakId} at ${answerLabel(value)} dropped its kickoff-verification hedge on an unanswered question`
        );
      }
      show("kickoff line", KICKOFF_VERIFICATION_LINE);
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * B · THE RENAMED VOLUME SLOTS
   * ────────────────────────────────────────────────────────────────────── */
  section("B · THE VOLUME SLOTS HOLD WHAT THEY SAY — enquiries are not bookings");

  const enquiryFrames = clientFacingStrings(
    computeMathEstimate("missed_call_value", intakeFixture(BOTH_VOLUMES))
  ).join("\n");
  const bookedFrames = clientFacingStrings(
    computeMathEstimate("no_show_value", intakeFixture(BOTH_VOLUMES))
  ).join("\n");

  check("B1 · monthlyEnquiries reaches ONLY the sentence that says 'enquiries/mo'", () => {
    show("monthlyEnquiries          ", ENQUIRIES);
    show("monthlyBookedAppointments ", BOOKED);
    show("missed-call frame", enquiryFrames);
    assert(
      enquiryFrames.includes(`${ENQUIRIES} enquiries/mo`),
      `the enquiry count ${ENQUIRIES} is not rendered as "${ENQUIRIES} enquiries/mo"`
    );
    assert(
      !enquiryFrames.includes(`${BOOKED} enquiries`),
      `the BOOKING count ${BOOKED} is being printed to the client as an enquiry count`
    );
    assert(
      !enquiryFrames.includes("booked/mo"),
      "the missed-call frame is talking about bookings — the two slots have been crossed"
    );
  });

  check("B2 · monthlyBookedAppointments reaches ONLY the sentence that says 'booked/mo'", () => {
    show("no-show frame", bookedFrames);
    assert(
      bookedFrames.includes(`${BOOKED} booked/mo`),
      `the booking count ${BOOKED} is not rendered as "${BOOKED} booked/mo"`
    );
    assert(
      !bookedFrames.includes(`${ENQUIRIES} booked`),
      `THE ALIASING BUG IS BACK: the enquiry count ${ENQUIRIES} is being printed back to the client as their booking count`
    );
    assert(
      !bookedFrames.includes("enquiries/mo"),
      "the no-show frame is talking about enquiries — the two slots have been crossed"
    );
  });

  check("B3 · an enquiry count alone CANNOT produce a booking figure", () => {
    // The shape of the real bug: we know their enquiry volume and nothing else.
    // A booking figure derived from it would be an invented number wearing the
    // client's own data as a disguise, so no figure may be emitted at all.
    const enquiriesOnly: ClientIntake = { monthlyEnquiries: ENQUIRIES, avgJobValueCad: 800 };
    const est = computeMathEstimate("no_show_value", intakeFixture(enquiriesOnly));
    show("intake            ", enquiriesOnly);
    show("no_show_value → ", est ? est.frame : "(no figure emitted)");
    assert.equal(
      est,
      null,
      `a no-show dollar frame was built from an enquiry count: ${est?.frame ?? ""}`
    );
  });

  const files = sourceFiles();

  check("B4 · the retired slot names are gone from the leak math layer", () => {
    show("modules scanned", LEAK_MATH_MODULES);
    for (const name of RETIRED_SLOTS) {
      const hits = grepSrc(name, [...LEAK_MATH_MODULES]);
      show(`${name} hits`, hits.length ? hits : "none");
      assert.equal(hits.length, 0, `retired slot ${name} is back in the leak math layer at ${hits.join(", ")}`);
    }
  });

  check("B5 · no retired slot survives anywhere in src/ as an INTAKE field", () => {
    // monthlyCallVolume must be gone outright.
    const callVolume = grepSrc("monthlyCallVolume", files);
    show("monthlyCallVolume anywhere in src/", callVolume.length ? callVolume : "none");
    assert.equal(callVolume.length, 0, `monthlyCallVolume is back at ${callVolume.join(", ")}`);

    for (const needle of ["intake.monthlyLeadVolume", "intake?.monthlyLeadVolume"]) {
      const hits = grepSrc(needle, files);
      show(`${needle}`, hits.length ? hits : "none");
      assert.equal(hits.length, 0, `${needle} is back at ${hits.join(", ")} — the dormant column is an intake slot again`);
    }

    // ── ONE WRITABLE HOME FOR THE TWO NUMBERS (Phase 3) ──────────────────────
    // The legacy Business columns are now DORMANT: the intake screen used to
    // mirror every save onto them so the generation path (which read them) kept
    // working mid-rebuild. Both halves of that arrangement are gone. Asserted in
    // both directions, because either half surviving alone is a silent bug —
    // a live writer with no reader strands data, a live reader with no writer
    // drops every client back to the ~20-enquiry benchmark.
    for (const col of ["monthlyLeadVolume", "avgClientValueCad"]) {
      const writes = grepSrc(`${col}: inputs.`, files).concat(grepSrc(`${col}: assessment`, files));
      show(`writes to Business.${col}`, writes.length ? writes : "none");
      assert.equal(writes.length, 0, `Business.${col} is being written again at ${writes.join(", ")} — the assessment is the one home`);
      const reads = grepSrc(`business.${col}`, files);
      show(`reads of Business.${col}`, reads.length ? reads : "none");
      assert.equal(reads.length, 0, `Business.${col} is read again at ${reads.join(", ")} — read the assessment instead`);
    }

    // The one sanctioned crossing point, asserted positively so a silent removal
    // of the mapping (which would drop every client's real enquiry volume back to
    // the ~20 benchmark) shows up here. Now sourced from the assessment.
    const bridge = grepSrc("monthlyEnquiries: enquiries", files);
    show("assessment → intake slot mapping", bridge.length ? bridge : "MISSING");
    assert.equal(bridge.length, 1, "the LeakAssessment → intake.monthlyEnquiries mapping is missing or duplicated");

    // And the enquiry count must STILL never reach the booking slot — the exact
    // aliasing this section was written to stop. It survives the change of source.
    const aliased = grepSrc("monthlyBookedAppointments: enquiries", files)
      .concat(grepSrc("monthlyBookedAppointments: business.", files));
    show("enquiry count aliased into the booking slot", aliased.length ? aliased : "none");
    assert.equal(aliased.length, 0, `the enquiry count is being printed back as a booking count at ${aliased.join(", ")}`);
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * C · THE OVERRIDE
   * ────────────────────────────────────────────────────────────────────── */
  section("C · THE OVERRIDE IS REAL — and cannot be exercised silently");

  check("C0 · the corrupted pack really is blocked (there is something to override)", () => {
    show("injected", HYPE_SENTENCE);
    show("boundary ok", brokenBoundary.ok);
    show("fatal checks", FATALS.map((c) => `${c.law} [${c.id}]`));
    assert.equal(brokenBoundary.ok, false, "the corrupted pack passed — the rest of section C proves nothing");
    assert(FATALS.length > 0, "no fatal checks to acknowledge");
  });

  await acheck("C1 · NO override ⇒ blocked, no ZIP, and no overrideError", async () => {
    const built = await buildAssetZipChecked(brokenPack);
    show("override supplied", "(none)");
    show("ok", built.ok);
    show("has zip", "zip" in built);
    assert.equal(built.ok, false, "a law-breaking pack was bundled into a ZIP anyway");
    assert(!("zip" in built), "a ZIP was produced for a blocked pack");
    if (!built.ok) {
      show("report", built.report.split("\n")[0]);
      show("overrideError", built.overrideError ?? "(none — this is the ordinary block)");
      assert.equal(built.overrideError, undefined, "an override error was reported when no override was sent");
    }
    const decision = evaluateOverride(FATALS, undefined, "export");
    show("evaluateOverride(…, undefined).status", decision.status);
    assert.equal(decision.status, "absent");
  });

  check("C2 · an EMPTY or whitespace-only reason is REJECTED", () => {
    for (const reason of ["", "   ", "\n\t  \n"]) {
      const input = { reason, acknowledgedChecks: FATALS.map((c) => c.id) };
      const decision = evaluateOverride(FATALS, input, "export");
      show("payload", { reason: JSON.stringify(reason), acknowledgedChecks: `${input.acknowledgedChecks.length} ids (all correct)` });
      show("  status", decision.status);
      assert.equal(decision.status, "rejected", `a blank reason (${JSON.stringify(reason)}) unlocked the gate`);
      if (decision.status === "rejected") {
        show("  code   ", decision.code);
        show("  message", decision.message);
        assert.equal(decision.code, "NO_REASON");
      }
    }
  });

  check("C3 · an acknowledgement that does NOT match the current fatal set is REJECTED", () => {
    // Three ways to be wrong, and each is the fingerprint of a stale list rather
    // than of someone reading the failures in front of them.
    const correct = FATALS.map((c) => c.id);
    const cases: { name: string; acknowledgedChecks: string[] }[] = [
      { name: "empty list (blind force)", acknowledgedChecks: [] },
      { name: "a guessed id", acknowledgedChecks: ["law-5-dollar-math.deadbeef"] },
      { name: "the real ids PLUS one that is no longer failing", acknowledgedChecks: [...correct, "law-2-conversion-only.stale01"] },
    ];
    for (const c of cases) {
      const decision = evaluateOverride(FATALS, { reason: REAL_REASON, acknowledgedChecks: c.acknowledgedChecks }, "export");
      show("payload", { case: c.name, acknowledgedChecks: c.acknowledgedChecks });
      show("  status", decision.status);
      assert.equal(decision.status, "rejected", `${c.name} was accepted — a stale acknowledgement can authorise a later, different failure`);
      if (decision.status === "rejected") {
        show("  code          ", decision.code);
        show("  unacknowledged", decision.unacknowledged.map((x) => x.id));
        show("  unrecognized  ", decision.unrecognized);
        assert.equal(decision.code, "STALE_ACKNOWLEDGEMENT");
      }
    }
  });

  await acheck("C3b · an acknowledgement collected against an EARLIER failure cannot authorise a LATER, different one", async () => {
    // Both sets are real check ids off real law failures — no invented tokens.
    // This is the 11pm scenario the handshake is built for: the operator waives
    // failure A, the pack changes, failure B appears, and the browser still holds
    // the old confirmation. It must not go through.
    show("failure A (hype)   ", FATALS.map((c) => `${c.law} [${c.id}]`));
    show("failure B (lead-gen)", OTHER_FATALS.map((c) => `${c.law} [${c.id}]`));
    assert(OTHER_FATALS.length > 0, "the second corruption did not break anything — nothing to prove");
    assert.notDeepStrictEqual(
      FATALS.map((c) => c.id).sort(),
      OTHER_FATALS.map((c) => c.id).sort(),
      "the two corruptions produce the same check ids, so this proves nothing about staleness"
    );

    const staleAck = { reason: REAL_REASON, acknowledgedChecks: FATALS.map((c) => c.id) };
    const decision = evaluateOverride(OTHER_FATALS, staleAck, "export");
    show("replaying A's acknowledgement against B", staleAck.acknowledgedChecks);
    show("  status", decision.status);
    assert.equal(decision.status, "rejected", "an acknowledgement of a DIFFERENT failure unlocked this one");
    if (decision.status === "rejected") {
      show("  code          ", decision.code);
      show("  unacknowledged", decision.unacknowledged.map((x) => `${x.law} [${x.id}]`));
      show("  unrecognized  ", decision.unrecognized);
      assert.equal(decision.code, "STALE_ACKNOWLEDGEMENT");
    }

    // And the same replay at the real boundary, not just against the pure function.
    const built = await buildAssetZipChecked(otherBrokenPack, staleAck);
    show("buildAssetZipChecked(B, ackOfA).ok", built.ok);
    assert.equal(built.ok, false, "the ZIP boundary shipped a pack on a stale acknowledgement");
    if (!built.ok) {
      show("overrideErrorCode", built.overrideErrorCode);
      show("overrideError    ", built.overrideError);
      assert.equal(built.overrideErrorCode, "STALE_ACKNOWLEDGEMENT");
    }
  });

  const FROZEN_NOW = new Date("2026-07-26T18:30:00.000Z");
  const grant = evaluateOverride(FATALS, goodOverride(), "export", FROZEN_NOW);

  check("C4 · a real reason + correctly echoed checks SUCCEEDS and stamps the governance block", () => {
    show("payload", { reason: REAL_REASON, acknowledgedChecks: goodOverride().acknowledgedChecks });
    show("status", grant.status);
    assert.equal(grant.status, "granted", "a correct override was refused");
    if (grant.status !== "granted") return;
    const g: PackGovernance = grant.governance;
    show("governance.reason  ", g.reason);
    show("governance.checks  ", g.checks.map((c) => `${c.law} [${c.id}]`));
    show("governance.at      ", g.at);
    show("governance.boundary", g.boundary);
    show("server log line    ", formatOverrideLog("biz_synthetic", g));
    assert.equal(g.overridden, true);
    assert.equal(g.reason, REAL_REASON, "the operator's own words were not stored verbatim");
    assert.deepStrictEqual(
      g.checks.map((c) => c.id).sort(),
      FATALS.map((c) => c.id).sort(),
      "the record does not name exactly the checks that were fatal at the moment of the override"
    );
    assert.equal(g.at, FROZEN_NOW.toISOString(), "the timestamp is not the moment the override was granted");
    assert.equal(g.boundary, "export", "the record does not say which gate was forced");
  });

  check("C5 · the timestamp is real on the DEFAULT path too (not just the injected clock)", () => {
    const before = Date.now();
    const live = evaluateOverride(FATALS, goodOverride(), "save");
    const after = Date.now();
    assert.equal(live.status, "granted");
    if (live.status !== "granted") return;
    const t = Date.parse(live.governance.at);
    show("governance.at", live.governance.at);
    show("within        ", `${new Date(before).toISOString()} … ${new Date(after).toISOString()}`);
    assert(!Number.isNaN(t), "the stored timestamp is not a parseable ISO date");
    assert(t >= before && t <= after, "the stored timestamp is not the moment the override was granted");
    assert.equal(live.governance.boundary, "save", "the boundary is hard-coded instead of recorded");
  });

  await acheck("C6 · the override actually SHIPS the blocked pack, and the shipped copy carries the record", async () => {
    const built = await buildAssetZipChecked(brokenPack, goodOverride());
    show("ok", built.ok);
    assert.equal(built.ok, true, "a correct override did not unlock the export");
    if (!built.ok) return;
    show("zip bytes", built.zip.length);
    show("filename ", built.filename);
    show("governance.reason", built.governance?.reason);
    show("governance.checks", built.governance?.checks.map((c) => c.law));
    show("governance.at    ", built.governance?.at);
    assert(built.zip.length > 0, "an empty ZIP was produced");
    assert(built.governance, "the export was forced but returned no governance record");
    assert.equal(built.pack.governance?.reason, REAL_REASON, "the pack that shipped does not carry the reason it shipped");
    assert(built.pack.governance?.at, "the pack that shipped carries no timestamp");
  });

  await acheck("C7 · the CLEAN golden fixture exports with NO override and NO governance block", async () => {
    const verdict = assertPackValid(cleanPack);
    show("pack", GOLDEN_PATH);
    show("assertPackValid(pack).ok", verdict.ok);
    assert.equal(verdict.ok, true, `the golden fixture is not law-compliant:\n${verdict.fails.map((c) => `${c.law}: ${c.message}`).join("\n")}`);

    const built = await buildAssetZipChecked(cleanPack);
    show("built.ok        ", built.ok);
    assert.equal(built.ok, true, "the golden fixture was blocked at the ZIP boundary");
    if (!built.ok) return;
    show("built.governance", built.governance ?? "(absent — the normal path)");
    show("pack.governance ", built.pack.governance ?? "(absent — the normal path)");
    assert.equal(built.governance, undefined, "a clean export produced a governance record");
    assert.equal(built.pack.governance, undefined, "a clean export stamped an override marker on the pack");
    assert(!("governance" in built.pack), "the governance KEY survives on a clean pack — its presence is the signal, so it must be absent, not undefined");
  });

  await acheck("C8 · a stale governance block from an earlier attempt is CLEARED, not carried forward", async () => {
    // The browser-tab case: a pack that was forced through once, fixed, and
    // re-exported must not re-save itself as "shipped over a violation".
    const stale = clone(cleanPack);
    if (grant.status === "granted") stale.governance = grant.governance;
    show("input pack.governance", stale.governance?.reason ?? "(none)");
    show("withGovernance(pack, undefined).governance", withGovernance(stale, undefined).governance ?? "(cleared)");
    const built = await buildAssetZipChecked(stale);
    show("built.ok                ", built.ok);
    assert.equal(built.ok, true, "a clean pack carrying a stale marker was blocked");
    if (!built.ok) return;
    show("shipped pack.governance ", built.pack.governance ?? "(cleared)");
    assert.equal(built.pack.governance, undefined, "a stale override marker survived a clean export");
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * D · THE COMMITTED FIXTURE
   * ────────────────────────────────────────────────────────────────────── */
  section("D · THE FIXTURE IS SELF-SUFFICIENT — a fresh clone runs verify:all and exits 0");

  check("D1 · the golden pack exists, is NOT gitignored, and passes the validator", () => {
    const abs = resolve(REPO, GOLDEN_PATH);
    show("path        ", abs);
    show("exists      ", existsSync(abs));
    const ignored = isGitIgnored(GOLDEN_PATH);
    show("git check-ignore", ignored ? "IGNORED" : "not ignored");
    assert(existsSync(abs), `${GOLDEN_PATH} is missing — regenerate it with \`npm run sample:golden\``);
    assert.equal(ignored, false, `${GOLDEN_PATH} is gitignored, so verify:all can only ever pass on the machine that generated it`);
    const verdict = assertPackValid(cleanPack);
    show("assertPackValid(pack).ok", verdict.ok);
    show("fatal checks", verdict.fails.map((c) => c.law));
    assert.equal(verdict.ok, true, "the committed fixture fails its own laws");
  });

  check("D2 · the fixture is SYNTHETIC — no real prospect's data is committed", () => {
    // This is the check that makes committing the fixture safe at all. Everything
    // under _samples/ is a real prospect's scraped site, reviews and phone number
    // and is deliberately gitignored; the moment one of those packs gets copied in
    // here as a convenient fixture, a real business's data is in git forever.
    const json = read(GOLDEN_PATH);
    const generator = read("scripts/make-golden-sample.ts");
    const name = cleanPack.meta.businessName;

    // PROVENANCE, not vibes: the committed pack's business name must be the
    // invented one hard-coded in the generator. A real client's pack would not
    // match, and this is what notices.
    show("businessName", name);
    show("city        ", cleanPack.meta.city);
    show("named verbatim in scripts/make-golden-sample.ts", generator.includes(`"${name}"`));
    assert(
      generator.includes(`"${name}"`),
      `"${name}" is not the invented business scripts/make-golden-sample.ts builds — this fixture did not come from the synthetic generator`
    );

    // Phone numbers must sit in the reserved 555-01xx fictional block. A real
    // prospect's number is the single most damaging thing that could ride in here.
    const phones = Array.from(new Set(json.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g) ?? []));
    const realPhones = phones.filter((p) => !/555[-.\s]?01\d\d/.test(p));
    show("phone numbers in the pack", phones.length ? phones : "none");
    show("outside the reserved 555-01xx block", realPhones.length ? realPhones : "none");
    assert.equal(
      realPhones.length,
      0,
      `the fixture carries a real-looking phone number (${realPhones.join(", ")})`
    );

    // Same for domains: .example is reserved and can never resolve.
    const urls = Array.from(new Set(json.match(/https?:\/\/[^"\\ ]+/g) ?? []));
    const live = urls.filter((u) => !/\.example\b/i.test(u));
    show("URLs in the pack", urls.length ? urls.slice(0, 8) : "none");
    show("on a domain that could resolve", live.length ? live : "none");
    assert.equal(
      live.length,
      0,
      `the fixture carries a live-looking URL (${live.join(", ")}) — it must stay an invented business, because it is committed to git`
    );
  });

  const leaks = cleanPack.intelligence?.leakAnalysis ?? [];

  check("D3 · the fixture exercises a WIDE leak spread", () => {
    // A floor, not a target: it exists so a regeneration that quietly collapses to
    // two or three leaks stops being accepted as proof that the pipeline works.
    const MIN_LEAKS = 8;
    show("leak count", leaks.length);
    show("leak ids  ", leaks.map((l) => l.leakName ?? l.area));
    show("floor     ", MIN_LEAKS);
    assert(
      leaks.length >= MIN_LEAKS,
      `the fixture exercises only ${leaks.length} leak(s) — below the ${MIN_LEAKS} floor, it stops being evidence the pipeline works`
    );
  });

  check("D4 · the fixture carries at least one BENCHMARK (inferred-tier) leak", () => {
    const benchmark = leaks.filter((l) => l.evidenceTier === "BENCHMARK");
    const tiers = leaks.reduce<Record<string, number>>((acc, l) => {
      const t = l.evidenceTier ?? "(none)";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    show("tier spread", tiers);
    show("BENCHMARK leaks", benchmark.map((l) => l.leakName ?? l.area));
    assert(
      benchmark.length > 0,
      "no BENCHMARK leak in the fixture — the hedged/inferred path (the one most likely to regress) is not being validated at all"
    );
  });

  check("D5 · the fixture carries at least one CLEAN finding (a scored axis with no leak)", () => {
    // A pack that says everything is broken is not a diagnosis, it is a pitch. The
    // fixture has to contain at least one axis the report rates healthy and files
    // NO leak against, or the validator is only ever exercised on bad news.
    const HEALTHY = 70;
    const metrics = cleanPack.intelligence?.scorecard?.metrics ?? [];
    const leaking = new Set(leaks.map((l) => l.scorecardArea).filter(Boolean));
    const clean = metrics.filter((m) => m.score >= HEALTHY && !leaking.has(m.name));
    show("scored axes    ", metrics.map((m) => `${m.name} = ${m.score}`));
    show("axes with leaks", Array.from(leaking));
    show("CLEAN findings ", clean.map((m) => `${m.name} = ${m.score}`));
    for (const m of clean) show(`  ${m.name}`, m.evidence ?? m.diagnosis ?? "");
    assert(
      clean.length > 0,
      `no axis scores ${HEALTHY}+ without a leak filed against it — the fixture reads as an all-bad-news pitch, not a diagnosis`
    );
  });

  check("D6 · NOTHING in verify:all reads a gitignored path", () => {
    const commands = verifyAllCommands();
    const paths = suitePaths();
    show("verify:all runs", commands);
    show("paths the suite touches", paths);
    assert(commands.length > 0, "verify:all is empty or unparseable in package.json");
    assert(paths.length > 0, "no paths enumerated — the scan is broken, not the suite");
    const ignored = paths.filter((p) => isGitIgnored(p));
    show("gitignored among them", ignored.length ? ignored : "none");
    assert.equal(
      ignored.length,
      0,
      `verify:all reads ${ignored.join(", ")}, which git ignores — a fresh clone would not have ${ignored.length > 1 ? "those files" : "that file"}, so the suite would fail on any machine but this one`
    );
  });

  check("D7 · verify:all actually runs THIS script (the proof is wired in)", () => {
    const chain = PKG.scripts["verify:all"] ?? "";
    show("verify:all", chain);
    show("verify:phase06", PKG.scripts["verify:phase06"] ?? "(missing)");
    assert(PKG.scripts["verify:phase06"], "package.json has no verify:phase06 script");
    assert(
      /npm run verify:phase06\b/.test(chain),
      "verify:phase06 is not in the verify:all chain — this proof would never run"
    );
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * E · USD_TO_CAD
   * ────────────────────────────────────────────────────────────────────── */
  section("E · USD_TO_CAD IS A LABELLED ASSUMPTION — dated, held, and floored");

  check("E1 · USD_TO_CAD lives in ASSUMPTIONS and is still 1.35", () => {
    const a = ASSUMPTIONS.usd_to_cad;
    show("ASSUMPTIONS keys", Object.keys(ASSUMPTIONS));
    show("usd_to_cad.value", a?.value);
    show("usd_to_cad.label", a?.label);
    show("exported USD_TO_CAD", USD_TO_CAD);
    assert(a, "usd_to_cad is not in the ASSUMPTIONS map — it is a bare number again, with no label, date or rationale");
    assert.strictEqual(a.value, 1.35, "the held rate moved without the rationale's date moving with it");
    assert.strictEqual(USD_TO_CAD, a.value, "the exported constant has drifted from the ASSUMPTIONS entry");
  });

  check("E2 · its rationale says IN WORDS that it is a working assumption", () => {
    const a = ASSUMPTIONS.usd_to_cad;
    show("rationale", a.rationale);
    assert(
      /working assumption/i.test(a.rationale),
      "the rationale does not call it a working assumption in plain words"
    );
    assert(
      /not measured/i.test(a.rationale) && /not cited/i.test(a.rationale),
      "the rationale does not say plainly that it is neither measured nor cited"
    );
    assert(
      /not a live rate/i.test(a.rationale),
      "the rationale does not warn that it is a held rate, not a live one"
    );
  });

  check("E3 · it carries the DATE it was set, and where to re-check it", () => {
    const a = ASSUMPTIONS.usd_to_cad;
    const dates = a.rationale.match(/\b20\d\d-\d\d-\d\d\b/g) ?? [];
    show("dates in rationale", dates);
    show("source named      ", /bankofcanada\.ca/i.test(a.rationale));
    assert(
      dates.length > 0,
      "the rationale carries no date — nobody can tell whether the held rate is a week old or two years old"
    );
    assert(
      /bankofcanada\.ca/i.test(a.rationale),
      "the rationale names no source to re-check the rate against"
    );
  });

  check("E4 · conversion is applied with floor(), so it can only UNDERSTATE", () => {
    for (const [v, usd] of Object.entries(CPL_USD) as [Vertical, number][]) {
      const exact = usd * USD_TO_CAD;
      const floored = Math.floor(exact);
      const rounded = Math.ceil(exact);
      const text = clientFacingStrings(computeMathEstimate("missed_call_value", forVertical(v))).join("\n");
      show(`${v}`, `USD $${usd} × ${USD_TO_CAD} = ${exact.toFixed(2)} → rendered ${cad(floored)} (not ${cad(rounded)})`);
      assert(
        text.includes(cad(floored)),
        `${v}: the floored CPL ${cad(floored)} is missing from the frame — the conversion is no longer floor()`
      );
      if (rounded !== floored)
        assert(
          !text.includes(cad(rounded)),
          `${v}: ${cad(rounded)} reached the frame — the conversion rounded UP, which INFLATES the leak`
        );
      assert(floored <= exact, `${v}: conversion rounded up (${floored} > ${exact})`);
    }
    // The behavioural checks above prove the OUTPUT is floored. This one proves the
    // MECHANISM is still floor() rather than a coincidence of the current rate — a
    // rate change that made round() and floor() agree would otherwise hide a switch.
    const narrative = read("src/lib/leak-narrative.ts");
    show("source", "Math.floor(usd * USD_TO_CAD) in leak-narrative.ts");
    assert(
      narrative.includes("Math.floor(usd * USD_TO_CAD)"),
      "the CPL conversion no longer uses Math.floor at the point of use"
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verify-phase06 crashed:", err);
  process.exit(1);
});
