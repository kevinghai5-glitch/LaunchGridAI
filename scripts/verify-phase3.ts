/**
 * PHASE 3 PROOF — the round demonstrated against the REAL shipped code, offline.
 * No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase3.ts
 *   npm run verify:phase3
 *
 * Every check prints its own inputs and outputs so a reader can audit the claim
 * without trusting the assertion. Exits 1 if ANY check fails.
 *
 * THE ROUND IN ONE SENTENCE: Phase 1 made the software honest about what it
 * KNOWS and Phase 2 honest about what it BUILDS; this round makes the four
 * DOCUMENTS say the same thing as each other — the total the report prints is
 * bounded and says so, the pipeline in the blueprint is the pipeline in the code,
 * the copy in the asset pack names the box it goes in, and the schedule prices
 * the fortnight and the months separately.
 *
 *   A. THE TWO NEW INTAKE       — takesDeposits and reviewReplyOwner, every branch
 *      FIELDS                     each, against the real resolver. Then the trap
 *                                 the owner named: a client who ALWAYS takes
 *                                 deposits and has NO online payment gets
 *                                 Text-to-Pay INSTALLED and moved UP the list —
 *                                 the opposite of what "tidying the two payment
 *                                 columns together" would do. And the other half
 *                                 of the same discipline: OWNER does not switch
 *                                 Review Response off, it raises a suggestion.
 *   B. THE REINSTATED REVIEW-   — no_review_replies fires ONLY on the client's own
 *      RESPONSE FINDING           answer, and DOES NOT FIRE on a cold pre-sale
 *                                 scan with no intake. That last one is why the
 *                                 old unanswered_reviews leak was deleted, and it
 *                                 is the one failure this reinstatement must not
 *                                 repeat.
 *   C. D1 · THE TOTAL IS        — the overlap disclosure renders BESIDE the total,
 *      BOUNDED AND SAYS SO        and the credibility cap is ONE implementation
 *                                 that always discloses which of its three things
 *                                 happened. A capped and an uncapped example are
 *                                 printed side by side.
 *   D. D2 · ONE PIPELINE, AND   — the six CRM columns come from the single shared
 *      THE RETAINER IN THE        constant, and LeadGate appears in the monthly
 *      RIGHT COLUMN               half and NOT in the one-time build.
 *   E. D3 · THE COPY KNOWS      — the nurture sequence runs the full 60 days and
 *      WHERE IT GOES              its assets map 1:1 onto the workflow's thirteen
 *                                 steps; every asset names a destination; the
 *                                 landing-page call is gone; and every REPOINT row
 *                                 in docs/landing-call-inventory.md has a live
 *                                 destination in the generated shape.
 *   F. D4 · THE SCHEDULE IS     — Days 1–14 → go-live → Days 15–90, with CAD
 *      THE ENGAGEMENT             $6,500 on the build window and CAD $1,000/month
 *                                 on the ongoing one.
 *
 * READ THE LABELS. Some checks below prove a COMPILE-TIME guarantee (the code
 * does not build), some prove RUNTIME behaviour (the code behaves), and some are
 * a SOURCE-LEVEL scan (the code does not contain a second copy of a thing that
 * must exist once). They are not the same strength of promise, so every check
 * that makes a structural claim says which it is — the same discipline as
 * section D of scripts/verify-phase1.ts and the header of verify-phase2.ts.
 */

import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  NURTURE_SEQUENCE,
  nurtureMeta,
  stampedClientStrings,
} from "@/lib/asset-generation";
import { getFiredLeaks, type FiredLeak } from "@/lib/leak-detection";
import { cad, reconcileLeakTotal, type LeakTotalInput } from "@/lib/leak-narrative";
import { PIPELINE, PIPELINE_STAGES, WORKFLOWS, workflowById } from "@/lib/workflow-catalogue";
// ReclaimedHQ's OWN prospect board — a DIFFERENT list from the client's CRM
// pipeline above, and aliased here so the two can never be confused in this file
// the way they can be confused in the codebase. Section D2 proves they are apart.
import { PIPELINE_STAGES as INTERNAL_DEAL_STAGES } from "@/lib/stages";
import { resolveWorkflows, type ResolvedWorkflow } from "@/lib/workflow-toggles";
import { renderDeliverableHtml, deliverableContext } from "@/lib/exporters/deliverables";
import { computeAssessment, emptyInputs, LEAKS as CALC_LEAKS } from "@/lib/leak-calculator";
import type { ClientIntake, ScrapeData } from "@/lib/leak-taxonomy";
import type { AssetPack } from "@/types";

// ── harness ───────────────────────────────────────────────────────────────────
// Identical shape to scripts/verify-phase1.ts and verify-phase2.ts: a counting
// check() that never throws, plus an explicit PASS/FAIL word on every line so the
// output is greppable by a human and by CI alike.
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

/**
 * Source with every comment removed, so a check about what the CODE does cannot
 * be satisfied — or defeated — by prose. Borrowed verbatim from verify-phase2.ts
 * and load-bearing for the same reason: several files in this round open with
 * long comments explaining which field must NOT appear in which function, and a
 * naive `includes()` would fail on the explanation and pass on the day somebody
 * deletes the explanation and adds the field.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, including the doc headers
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // line comments, but not "https://"
}

/** The body of one named function in a source file, comments stripped — so a
 *  claim about what ONE function reads is not answered by the rest of the file.
 *  Brace-counted rather than regexed, because the functions this is pointed at
 *  contain object literals and arrow functions. */
function functionBody(rel: string, signature: string): string {
  const src = codeOnly(rel);
  const start = src.indexOf(signature);
  assert(start >= 0, `${rel} no longer contains "${signature}" — this check is aiming at nothing`);
  const open = src.indexOf("{", start);
  assert(open >= 0, `${rel}: "${signature}" has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${rel}: "${signature}" body is unbalanced`);
}

/** Every string anywhere in an object graph. Same walk the pack validator does,
 *  so "anywhere in the pack" here means the same thing it means at the gate. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

/** Every KEY anywhere in an object graph — the other half of the walk above, and
 *  the one section E needs: `techStack` is a key whose absence is the claim. */
function collectKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

const firedIds = (fired: FiredLeak[]): string[] => fired.map((f) => f.leak.id);
const firedById = (fired: FiredLeak[], id: string): FiredLeak | undefined =>
  fired.find((f) => f.leak.id === id);

const resolvedById = (rs: ResolvedWorkflow[], id: string): ResolvedWorkflow => {
  const r = rs.find((x) => x.workflow.id === id);
  assert(r, `no workflow "${id}" in the resolved build — the catalogue id changed`);
  return r!;
};

/* ════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES
 *
 * Synthetic, like the golden pack and for the same reason: a .example domain that
 * can never resolve and a phone number in the reserved 555-01xx block, so nothing
 * in this file traces to a real prospect.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * A COLD PRE-SALE SCAN — no intake at all.
 *
 * This is the shape section B turns on: it is exactly what the free audit has to
 * work from, and the question that matters is which leaks a document built from
 * it is allowed to contain. Tuned so plenty of OTHER leaks fire (so "the review
 * finding is absent" is a real absence, not an empty detector run):
 *   · no booking path, no chat widget, limited hours — several OBSERVED fires
 *   · 44 reviews against a 150/120 competitor pair — comfortably above the
 *     half-of-median line, so low_review_velocity does NOT fire and cannot be
 *     mistaken for the review finding this section is about
 *   · reviewTexts empty — no review proxy lifting anything to EVIDENCED
 */
function coldScrape(intake?: ClientIntake): ScrapeData {
  return {
    business: {
      name: "Probe Air Systems",
      industry: "hvac",
      city: "Kelowna",
      phone: "250-555-0142",
      websiteUrl: "https://probe-air.example",
    },
    website: {
      pagesFound: ["home", "services", "contact"],
      pageText: {
        home: "Furnace and heat pump service across the Central Okanagan.",
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
      linksToFacebook: false,
      linksToInstagram: false,
    },
    pageSpeed: { mobileScore: 74, lcpSeconds: 2.6 },
    googleReviews: {
      rating: 4.5,
      count: 44,
      recentCount90d: 4,
      // -1 is the "unknown" sentinel the adapters write. NOTHING in the pipeline
      // has ever supplied a real owner-response rate, which is the whole reason
      // section B exists — see the no_review_replies comment in leak-taxonomy.ts.
      ownerResponseRate: -1,
      reviewTexts: [],
    },
    gbp: { hoursListed: true, limitedHours: true, hasBookingLink: false, messagingEnabled: false },
    competitors: [
      { name: "A Plumbing", rating: 4.6, reviewCount: 150 },
      { name: "B Plumbing", rating: 4.5, reviewCount: 120 },
    ],
    intake,
  };
}

/**
 * The committed golden pack. Sections C–F run against THIS rather than against a
 * pack built here, and that is the point: it is the artifact `npm run
 * sample:golden` produces through the real generation stampers, so a check that
 * passes on it is a check that passes on what a client receives.
 *
 * The guard is for the actionable message, not the existence: a raw ENOENT here
 * reads as "the verify script is broken" when the real answer is one command.
 */
const GOLDEN_PATH = "_fixtures/golden-pack.json";
if (!existsSync(resolve(REPO, GOLDEN_PATH))) {
  console.error(
    `\n${GOLDEN_PATH} is missing. Sections C–F of this proof run against the committed fixture.\n` +
      "  Rebuild it with:  npm run sample:golden\n"
  );
  process.exit(1);
}
const goldenPack = JSON.parse(read(GOLDEN_PATH)) as AssetPack;

/* ── DOCUMENT CONTEXT FOR THE TWO CLIENT DOCUMENTS ──────────────────────────
 * The Diagnosis and the Build Plan are NOT rendered from the pack alone. The
 * Diagnosis reads the frozen assessment; the Build Plan reads the build
 * decisions and the kickoff date. Both come from the business row, threaded in
 * at render, which is what stops the Diagnosis and the offer page ever showing a
 * client two different totals.
 *
 * The assessment below is computed by the REAL model from synthetic answers, so
 * these checks cannot pass against a blob the shipped code would never produce.
 */
const SAMPLE_ASSESSMENT = (() => {
  const inputs = emptyInputs();
  inputs.monthlyEnquiries = 45;
  inputs.avgJobValue = 850;
  // Worst answer on every question — the page with the most figures on it.
  for (const leak of CALC_LEAKS) inputs.answers[leak.id] = leak.options.length - 1;
  return computeAssessment(inputs);
})();

function ctxFor(
  assessment: ReturnType<typeof computeAssessment> | null = SAMPLE_ASSESSMENT,
  kickoffAt: Date | null = null,
  workflowToggles: unknown = null
) {
  return deliverableContext({ assessment, workflowToggles, kickoffAt });
}

/* ════════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

console.log("\nPHASE 3 VERIFICATION — offline proof of the round's six claims");

/* ──────────────────────────────────────────────────────────────────────────
 * A · THE TWO NEW INTAKE FIELDS
 * ────────────────────────────────────────────────────────────────────── */
section("A · THE TWO NEW INTAKE FIELDS — every branch, and the trap in the pair");

const TEXT_TO_PAY = "text-to-pay";
const REVIEW_RESPONSE = "review-response";

/** Resolve the real fourteen against one intake object. No fired leaks: this
 *  section is about intake, and threading a lock in would make it impossible to
 *  tell whether an answer or a measurement decided the outcome. */
function buildWith(intake: ClientIntake): ResolvedWorkflow[] {
  return resolveWorkflows({ intake, firedLeaks: null });
}

const DEPOSIT_BRANCHES: { answer: ClientIntake["takesDeposits"]; on: boolean; why: string }[] = [
  { answer: "ALWAYS", on: true, why: "there is a moment for the link every time" },
  { answer: "SOMETIMES", on: true, why: "an occasional deposit is still a deposit" },
  { answer: "NEVER", on: false, why: "the ONE answer that takes it out of a build" },
  { answer: undefined, on: true, why: "an unasked question never removes a paid-for workflow" },
];

for (const b of DEPOSIT_BRANCHES) {
  check(
    `A1 · takesDeposits = ${b.answer ?? "(not asked)"} ⇒ Text-to-Pay ${b.on ? "INSTALLED" : "OFF"}`,
    () => {
      const r = resolvedById(buildWith({ takesDeposits: b.answer }), TEXT_TO_PAY);
      show("intake  ", { takesDeposits: b.answer ?? null });
      show("on      ", r.on);
      show("source  ", r.source);
      show("because ", r.because);
      show("reason  ", b.why);
      assert.equal(r.on, b.on, `takesDeposits=${b.answer} resolved Text-to-Pay to on=${r.on}`);
    }
  );
}

check("A2 · THE TRAP — deposits ALWAYS + no online payment ⇒ INSTALLED, and moved UP the list", () => {
  // The case that inverts if somebody "tidies up" the two payment-shaped columns.
  // This client takes a deposit on every job and has no online way to collect one,
  // so today that money is chased by e-transfer and cheque. That is the BEST
  // Text-to-Pay candidate in the book, not the worst.
  const intake: ClientIntake = { takesDeposits: "ALWAYS", hasOnlinePayment: false };
  const r = resolvedById(buildWith(intake), TEXT_TO_PAY);
  show("intake        ", intake);
  show("on            ", r.on);
  show("priority      ", r.priority);
  show("priorityReason", r.priorityReason ?? "(none)");
  assert.equal(r.on, true, "the hand-chasing client LOST the workflow that helps him most");
  assert.equal(r.priority, "high", "the hand-chasing client's Text-to-Pay was not raised up the list");
  assert(r.priorityReason, "priority was raised with no reason for the operator to read");
});

check("A3 · priority is ORDERING, not inclusion — hasOnlinePayment true still installs", () => {
  const withPay = resolvedById(buildWith({ takesDeposits: "ALWAYS", hasOnlinePayment: true }), TEXT_TO_PAY);
  const withoutPay = resolvedById(buildWith({ takesDeposits: "ALWAYS", hasOnlinePayment: false }), TEXT_TO_PAY);
  show("hasOnlinePayment true  → on/priority", { on: withPay.on, priority: withPay.priority });
  show("hasOnlinePayment false → on/priority", { on: withoutPay.on, priority: withoutPay.priority });
  assert.equal(withPay.on, true, "an existing payment mechanism removed the workflow");
  assert.equal(withoutPay.on, true, "no payment mechanism removed the workflow");
  assert.notEqual(
    withPay.priority,
    withoutPay.priority,
    "hasOnlinePayment changed nothing at all — the priority rule is not wired"
  );
});

check("A4 · takesDeposits=NEVER wins whatever hasOnlinePayment says (both directions)", () => {
  for (const hasOnlinePayment of [true, false]) {
    const r = resolvedById(buildWith({ takesDeposits: "NEVER", hasOnlinePayment }), TEXT_TO_PAY);
    show(`NEVER + hasOnlinePayment ${hasOnlinePayment}`, { on: r.on, because: r.because });
    assert.equal(r.on, false, `takesDeposits=NEVER + hasOnlinePayment=${hasOnlinePayment} left it installed`);
  }
});

check("A5 · SOURCE-LEVEL — hasOnlinePayment cannot reach the Text-to-Pay on/off decision", () => {
  // A SOURCE-LEVEL CHECK, and it is labelled one deliberately: it reads the
  // catalogue's own `isOff` function rather than exercising behaviour, because the
  // failure it guards against is a future edit, not today's output. A4 above is
  // the runtime half; this is the half that fails the moment somebody merges the
  // two columns, before any client sees the result.
  //
  // Comments are stripped first. The function it is aiming at sits directly under
  // a thirty-line comment that says "NOTE WHAT IS NOT IN THIS FUNCTION:
  // hasOnlinePayment", so a naive text search would find the warning and pass.
  const src = codeOnly("src/lib/workflow-catalogue.ts");
  const start = src.indexOf(`id: "${TEXT_TO_PAY}"`);
  assert(start >= 0, "the text-to-pay entry is no longer in the catalogue");
  const end = src.indexOf("priorityRule", start);
  assert(end > start, "text-to-pay no longer declares a priorityRule — the split has been undone");
  const applicability = src.slice(start, end);
  const priority = src.slice(end, src.indexOf("defaultOn", end));
  show("applicability block reads takesDeposits ", /takesDeposits/.test(applicability));
  show("applicability block reads hasOnlinePayment", /hasOnlinePayment/.test(applicability));
  show("priorityRule block reads hasOnlinePayment", /hasOnlinePayment/.test(priority));
  assert(
    /takesDeposits/.test(applicability),
    "the on/off rule no longer reads takesDeposits"
  );
  assert(
    !/hasOnlinePayment/.test(applicability),
    "hasOnlinePayment has reached the Text-to-Pay on/off rule — every client who takes deposits with no online payment now LOSES the workflow that helps him most. It belongs in priorityRule and nowhere else."
  );
  assert(
    /hasOnlinePayment/.test(priority),
    "hasOnlinePayment is not read by priorityRule either, so the hand-chasing client is no longer surfaced"
  );
});

const REPLY_BRANCHES: { answer: ClientIntake["reviewReplyOwner"]; suggestion: boolean }[] = [
  { answer: "NOBODY", suggestion: false },
  { answer: "OWNER", suggestion: true },
  { answer: "STAFF_OR_AGENCY", suggestion: false },
  { answer: undefined, suggestion: false },
];

for (const b of REPLY_BRANCHES) {
  check(
    `A6 · reviewReplyOwner = ${b.answer ?? "(not asked)"} ⇒ Review Response stays INSTALLED${
      b.suggestion ? " (with a suggestion)" : ""
    }`,
    () => {
      const r = resolvedById(buildWith({ reviewReplyOwner: b.answer }), REVIEW_RESPONSE);
      show("intake    ", { reviewReplyOwner: b.answer ?? null });
      show("on        ", r.on);
      show("suggestion", r.suggestion ?? "(none)");
      assert.equal(
        r.on,
        true,
        `reviewReplyOwner=${b.answer} switched Review Response OFF. It is one of the fourteen installed in every build; "I write my own replies" is a reason for the OPERATOR to remove it by hand, not a rule.`
      );
      assert.equal(
        Boolean(r.suggestion),
        b.suggestion,
        `reviewReplyOwner=${b.answer} produced suggestion=${JSON.stringify(r.suggestion)}`
      );
    }
  );
}

check("A7 · OWNER raises a SUGGESTION, and the suggestion says it is the operator's call", () => {
  const r = resolvedById(buildWith({ reviewReplyOwner: "OWNER" }), REVIEW_RESPONSE);
  show("suggestion", r.suggestion ?? "(none)");
  assert(r.suggestion, "OWNER raised no suggestion at all — the answer is being thrown away");
  assert(
    /your call|not the software|switch it off here/i.test(r.suggestion!),
    "the suggestion does not tell the operator it is his decision, which is what makes it a suggestion rather than a rule"
  );
});

check("A8 · SOURCE-LEVEL — Review Response declares an offSuggestion, never an intake_rule", () => {
  // Same labelling as A5: this is a SOURCE-LEVEL scan of the catalogue entry, not
  // a behavioural test. Turning `offSuggestion` into `applicability: intake_rule`
  // is a one-word edit that would strip the workflow from the build of every proud
  // owner who answered the question honestly.
  const src = codeOnly("src/lib/workflow-catalogue.ts");
  const start = src.indexOf(`id: "${REVIEW_RESPONSE}"`);
  assert(start >= 0, "the review-response entry is no longer in the catalogue");
  const entry = src.slice(start, src.indexOf("defaultOn", start));
  const kind = entry.match(/kind:\s*"([a-z_]+)"/)?.[1];
  show("applicability.kind", kind ?? "(none)");
  show("declares offSuggestion", /offSuggestion/.test(entry));
  assert.equal(kind, "operator_only", `Review Response's applicability is "${kind}", not operator_only`);
  assert(/offSuggestion/.test(entry), "Review Response no longer carries an offSuggestion");
  assert(
    !/isOff/.test(entry.slice(0, entry.indexOf("offSuggestion"))),
    "Review Response's applicability has grown an isOff rule — the answer must never flip the state on its own"
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * B · THE REINSTATED REVIEW-RESPONSE FINDING
 * ────────────────────────────────────────────────────────────────────── */
section("B · no_review_replies — fires on the client's answer, and on NOTHING else");

const REVIEW_LEAK = "no_review_replies";

check("B0 · the cold pre-sale fixture fires plenty of OTHER leaks (the absence below is real)", () => {
  const fired = getFiredLeaks(coldScrape());
  show("fired leak ids", firedIds(fired));
  show("count         ", fired.length);
  assert(
    fired.length >= 5,
    "the cold fixture barely fires anything, so 'no_review_replies is absent' proves nothing"
  );
});

check("B1 · reviewReplyOwner = NOBODY ⇒ FIRES, and it is DISCLOSED, never observed", () => {
  const fired = getFiredLeaks(coldScrape({ reviewReplyOwner: "NOBODY" }));
  const f = firedById(fired, REVIEW_LEAK);
  show("fired leak ids ", firedIds(fired));
  assert(f, "the client told us nobody replies and the finding did not fire");
  show("tier           ", f!.tier);
  show("grade          ", f!.grade);
  show("intakeConfirmed", f!.intakeConfirmed ?? false);
  show("evidence       ", f!.evidence);
  assert.equal(f!.grade, "disclosed", `the finding fired at grade "${f!.grade}" — we measured nothing here`);
  assert.equal(f!.intakeConfirmed, true, "the fire is not marked as confirmed at intake");
  assert(
    f!.evidence.some((e) => /you told us|confirmed at intake|you (?:said|confirmed)/i.test(e)),
    "the evidence line does not attribute the fact to the client, so it reads as our own finding"
  );
});

for (const answer of ["OWNER", "STAFF_OR_AGENCY"] as const) {
  check(`B2 · reviewReplyOwner = ${answer} ⇒ SUPPRESSED (somebody is replying)`, () => {
    const fired = getFiredLeaks(coldScrape({ reviewReplyOwner: answer }));
    show("intake        ", { reviewReplyOwner: answer });
    show("fired leak ids", firedIds(fired));
    assert(
      !firedIds(fired).includes(REVIEW_LEAK),
      `we told a client his reviews go unanswered after he told us ${
        answer === "OWNER" ? "he answers them himself" : "his staff or agency answers them"
      }`
    );
  });
}

check("B3 · THE ONE THAT DELETED THE OLD LEAK — no intake at all ⇒ DOES NOT FIRE", () => {
  // The failure this reinstatement exists not to repeat. `unanswered_reviews` was
  // deleted because it claimed an OBSERVED detection off googleReviews
  // .ownerResponseRate, and nothing in the pipeline has ever supplied that number.
  // A benchmark hedge off a blank would be the same defect wearing a hedge: a
  // finding manufactured out of an unasked question.
  const fired = getFiredLeaks(coldScrape());
  show("intake                ", "(none — a cold pre-sale scan)");
  show("googleReviews.ownerResponseRate", coldScrape().googleReviews?.ownerResponseRate);
  show("fired leak ids        ", firedIds(fired));
  assert(
    !firedIds(fired).includes(REVIEW_LEAK),
    "no_review_replies fired with NO intake. There is no outside signal for owner replies anywhere in what we fetch, so this is a finding invented out of a blank — exactly why the old unanswered_reviews leak had to be deleted."
  );
});

check("B4 · an explicitly EMPTY intake object is still 'not asked' — it does not fire", () => {
  // The shape a saved client with a half-finished intake form actually has. It is
  // a different code path from `intake: undefined` and it must land in the same
  // place: an unanswered question is unanswered however it is spelled.
  const fired = getFiredLeaks(coldScrape({}));
  show("intake        ", {});
  show("fired leak ids", firedIds(fired));
  assert(
    !firedIds(fired).includes(REVIEW_LEAK),
    "an empty intake object fired the finding — a client who started the form and stopped now gets a finding we cannot stand behind"
  );
});

check("B5 · SOURCE-LEVEL — the detector reads intake and NOTHING else", () => {
  // SOURCE-LEVEL. The old leak's mistake was reachable only because its detector
  // had a scan branch. This one must not grow one: no ownerResponseRate, no
  // benchmark fallback, no review-text proxy.
  const body = functionBody("src/lib/leak-detection.ts", `${REVIEW_LEAK}: (d) =>`);
  show("reads intake         ", /d\.intake/.test(body));
  show("reads ownerResponseRate", /ownerResponseRate/.test(body));
  show("reads googleReviews  ", /googleReviews/.test(body));
  show("reads website        ", /d\.website/.test(body));
  assert(/d\.intake/.test(body), "the detector no longer reads intake at all");
  assert(
    !/ownerResponseRate/.test(body),
    "the detector reads ownerResponseRate — the field nothing in the pipeline supplies, and the exact reason the old leak was deleted"
  );
  assert(
    !/googleReviews|d\.website|d\.competitors|d\.gbp/.test(body),
    "the detector has grown a scan branch. It may only report what the client told us; anything else is a measurement we do not take."
  );
});

check("B6 · the taxonomy marks it INVISIBLE, so it can never be written as a flat observation", () => {
  const src = read("src/lib/leak-taxonomy.ts");
  const start = src.indexOf(`id: "${REVIEW_LEAK}"`);
  assert(start >= 0, "no_review_replies is not in the taxonomy");
  const entry = src.slice(start, src.indexOf("mathTemplate", start));
  const evidenceClass = entry.match(/evidenceClass:\s*"([A-Z_]+)"/)?.[1];
  const upgradesTo = entry.match(/upgradesTo:\s*"([a-z]+)"/)?.[1];
  show("evidenceClass ", evidenceClass ?? "(none)");
  show("intakeAsk.field", entry.match(/field:\s*"([A-Za-z]+)"/)?.[1] ?? "(none)");
  show("upgradesTo    ", upgradesTo ?? "(none)");
  assert.equal(evidenceClass, "INVISIBLE", `evidenceClass is "${evidenceClass}" — OBSERVED would licence "we saw that nobody replies", which we never did`);
  assert.equal(upgradesTo, "disclosed", "the intake ask no longer upgrades to disclosed");
});

check("B7 · it is NOT in the most-provable (cold_audit-target) pool — a pre-sale selection cannot produce it by construction", () => {
  // `cold_audit` survives in the taxonomy as the paid pack's most-provable
  // top-3 selection (selectColdAudit → LeakContext.coldAudit); the free document
  // it was named for is deleted. The law is unchanged: this leak fires off an
  // intake answer, a pre-sale detection can never carry intake, so listing it in
  // the pre-sale-capable pool would advertise a finding that pool cannot hold.
  const src = read("src/lib/leak-taxonomy.ts");
  const start = src.indexOf(`id: "${REVIEW_LEAK}"`);
  const entry = src.slice(start, src.indexOf("mathTemplate", start));
  const targets = entry.match(/deliverableTargets:\s*\[([^\]]*)\]/)?.[1] ?? "";
  show("deliverableTargets", targets.replace(/\s+/g, " ").trim());
  assert(
    !/cold_audit/.test(targets),
    "no_review_replies lists cold_audit as a target. That pool must stay reachable by a pre-sale detection, which can never carry the intake answer this leak fires on."
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * C · D1 — THE TOTAL IS BOUNDED, AND IT SAYS SO
 * ────────────────────────────────────────────────────────────────────── */
section("C · D1 — the overlap disclosure and the ONE credibility cap");

/** A dollar frame written the way computeMathEstimate writes a REAL-mode one, so
 *  clientRecoveryCeiling's three guards (not benchmark-valued, both bases
 *  attributed to the client) actually pass. Its wording is not decorative: the
 *  ceiling is parsed out of these exact strings. */
function clientFrame(low: number, high: number, volume: string, avgValue: number) {
  return {
    low,
    high,
    leadVolumeBasis: `Based on your ${volume}`,
    effectSize: "a 14% home-services missed-call rate (CallRail)",
    avgValueBasis: `your CAD $${avgValue} average customer value — your number`,
    formula: "volume × rate × value",
    usesBenchmarkValue: false,
  };
}

const OVERLAP_NOTE =
  "This is the after-hours share of the missed-call figure above, not additional to it.";

/** Under the ceiling: 25 booked × CAD $900 × 50% = CAD $11,250, and the frames
 *  sum to CAD $3,000. Ordinary output. */
const UNCAPPED_INPUTS: LeakTotalInput[] = [
  {
    id: "missed_calls_no_recovery",
    name: "Missed calls with no recovery",
    dollar: clientFrame(1000, 2000, "25 booked/mo", 900),
    overlapsWith: null,
    overlapNote: null,
  },
  {
    id: "no_online_booking",
    name: "No online booking path",
    dollar: clientFrame(500, 1000, "25 booked/mo", 900),
    overlapsWith: null,
    overlapNote: null,
  },
  {
    id: "no_after_hours_coverage",
    name: "No after-hours capture",
    dollar: clientFrame(200, 400, "25 booked/mo", 900),
    overlapsWith: "missed_calls_no_recovery",
    overlapNote: OVERLAP_NOTE,
  },
];

/** Over the ceiling: same client numbers, a frame that has gone wrong upstream and
 *  is claiming CAD $40,000/mo out of a business billing CAD $22,500/mo. */
const CAPPED_INPUTS: LeakTotalInput[] = [
  {
    id: "missed_calls_no_recovery",
    name: "Missed calls with no recovery",
    dollar: clientFrame(20000, 40000, "25 booked/mo", 900),
    overlapsWith: null,
    overlapNote: null,
  },
  {
    id: "no_after_hours_coverage",
    name: "No after-hours capture",
    dollar: clientFrame(5000, 9000, "25 booked/mo", 900),
    overlapsWith: "missed_calls_no_recovery",
    overlapNote: OVERLAP_NOTE,
  },
];

check("C1 · the overlapping leak is EXCLUDED from the total and NAMED in the disclosure", () => {
  const total = reconcileLeakTotal(UNCAPPED_INPUTS);
  const naiveHigh = UNCAPPED_INPUTS.reduce((s, i) => s + (i.dollar?.high ?? 0), 0);
  show("naive sum (high)", naiveHigh);
  show("reconciled high ", total.high);
  show("excluded ids    ", total.excluded);
  show("disclosure      ", total.disclosure);
  assert.deepStrictEqual(total.excluded, ["no_after_hours_coverage"], "the subset was not excluded");
  assert.notEqual(total.high, naiveHigh, "the total is still the naive sum — the slice is being double-counted");
  assert(total.disclosure.includes("No after-hours capture"), "the excluded leak is not NAMED in the disclosure");
  assert(total.disclosure.includes(OVERLAP_NOTE), "the disclosure does not carry the leak's own overlap sentence");
});

check("C2 · a rendered total is never rendered without its derivation, and the derivation reads forwards", () => {
  // SAME LAW, THIRD HOME. The reader who adds the itemised figures himself and
  // finds they do not match has already decided the report is padded, so the
  // document may never print the total without explaining it. What changed is
  // WHERE the explanation sits, twice:
  //
  //   · Phase 3 moved it off the pack's dollar-callout onto computeAssessment.
  //   · P2-2/P2-3 (this round) inverted the Diagnosis. The total leads in §01
  //     `.sec--key` as the `.headline` panel; the derivation, the overlap
  //     discount and the cap disclosure are §03 `.sec--method` at the end,
  //     because "nobody opens a $6,500 deliverable by explaining what they
  //     couldn't see". So "directly beneath the band" is no longer the law and
  //     `.total-band` is no longer emitted at all.
  //
  // The law that survives the move is the implication: total ⇒ derivation, in
  // the same document. That is asserted below in the direction that matters —
  // if the headline renders, the method section must too.
  //
  // P3-3 also found the overlap sentence stated BACKWARDS (overlap is the reason
  // the rows would not sum, not the reason they do). The corrected wording is
  // asserted, and the backwards wording is asserted absent — a repair that only
  // adds the new sentence while the old one still ships is not a repair.
  //
  // The pack-side mechanism (reconcileLeakTotal) is still asserted by C1 and C3
  // below — it is the math, and it did not move.
  const html = renderDeliverableHtml(goldenPack, "diagnosis", ctxFor(SAMPLE_ASSESSMENT));
  const total = html.match(/<div class="hl-amount">([^<]+)<\/div>/)?.[1];
  assert(total, "the Diagnosis no longer renders a total at all");
  show("total (headline panel)", total!);
  assert(/^CAD \$/.test(total!), `the total renders as "${total}" — the money law is CAD-marker-first`);

  const method = html.match(/<section class="sec sec--method"[^>]*>([\s\S]*?)<\/section>/)?.[0];
  assert(
    method,
    "the Diagnosis prints a total and no .sec--method section. The derivation is the only thing standing between the number and a reader who thinks it was padded — it may move down the page, it may not leave it."
  );
  const methodText = method!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  show("method section", methodText.slice(0, 150));

  show("states the overlap cut", /already reduced by \d+%/.test(methodText));
  assert(
    /already reduced by \d+%/.test(methodText),
    "the overlap disclosure is not in the method section — the total is now unexplained anywhere in the document"
  );
  assert(
    /rows sum to the total/.test(methodText),
    "the disclosure no longer says the column reconciles with the bottom line"
  );
  // The defect P3-3 named, asserted gone rather than assumed gone.
  show("backwards wording still shipping", /already cut \d+%|rows add up to the total/.test(html));
  assert(
    !/already cut \d+%|rows add up to the total/.test(html),
    "the backwards overlap sentence still reaches the page — it claims overlap is the reason the rows sum, which is the opposite of true"
  );
});

check("C3 · the cap ALWAYS discloses — one of exactly three things, never silence", () => {
  const held = reconcileLeakTotal(UNCAPPED_INPUTS);
  const bound = reconcileLeakTotal(CAPPED_INPUTS);
  const noBasis = reconcileLeakTotal([
    {
      id: "missed_calls_no_recovery",
      name: "Missed calls with no recovery",
      // A pre-intake BENCHMARK frame: no client numbers to bound anything against.
      dollar: {
        low: 400,
        high: 800,
        leadVolumeBasis: "assuming 20 enquiries a month (our assumption, not a number we measured)",
        effectSize: "a 14% home-services missed-call rate (CallRail)",
        avgValueBasis: "CAD $174 replacement cost per lead, an industry benchmark (WordStream)",
        formula: "volume × rate × value",
        usesBenchmarkValue: true,
      },
      overlapsWith: null,
      overlapNote: null,
    },
  ]);
  for (const [label, t] of [["held", held], ["bound", bound], ["no basis", noBasis]] as const) {
    show(`${label} → applicable/binding`, { applicable: t.cap.applicable, binding: t.cap.binding });
    show(`${label} → note`, t.cap.note);
    assert(t.cap.note.trim(), `the ${label} case produced an EMPTY cap note — a silently capped or silently uncapped number is its own dishonesty`);
  }
  assert.equal(held.cap.applicable, true, "the held case had no basis to check against");
  assert.equal(held.cap.binding, false, "the held case bound when it should not have");
  assert.equal(bound.cap.binding, true, "a figure larger than the whole business was NOT capped");
  assert.equal(noBasis.cap.applicable, false, "a pre-intake benchmark pack invented a revenue figure to cap against");
});

check("C4 · a CAPPED example and an UNCAPPED example, side by side", () => {
  const held = reconcileLeakTotal(UNCAPPED_INPUTS);
  const bound = reconcileLeakTotal(CAPPED_INPUTS);
  // cad() is the system's own formatter — marker before the figure, thousands
  // separated. Used here so the numbers this check PRINTS are spelled the way the
  // document spells them, and so the assertion below can look for the exact string.
  show("UNCAPPED · client numbers", `25 booked/mo × ${cad(900)} → ceiling ${cad(11250)}/mo`);
  show("UNCAPPED · frames sum to ", `${cad(held.cap.uncappedLow)}–${cad(held.cap.uncappedHigh)}/mo`);
  show("UNCAPPED · printed       ", `${cad(held.low)}–${cad(held.high)}/mo`);
  show("UNCAPPED · note          ", held.cap.note);
  show("CAPPED   · frames sum to ", `${cad(bound.cap.uncappedLow)}–${cad(bound.cap.uncappedHigh)}/mo`);
  show("CAPPED   · ceiling       ", `${cad(bound.cap.ceiling!)}/mo`);
  show("CAPPED   · printed       ", `${cad(bound.low)}–${cad(bound.high)}/mo`);
  show("CAPPED   · note          ", bound.cap.note);
  assert.equal(held.high, held.cap.uncappedHigh, "the uncapped case was trimmed anyway");
  assert(bound.high <= bound.cap.ceiling!, "the capped case still prints above its own ceiling");
  assert(
    bound.low < bound.high,
    "the capped range collapsed to a single point. Clamping each end at the ceiling reads as a fabricated point estimate; both ends are scaled by the same factor so the shape of the range survives."
  );
  assert(
    /capped|ceiling/i.test(bound.cap.note) && bound.cap.note.includes(cad(bound.cap.uncappedHigh)),
    `the capped note does not show its working — the reader is entitled to the pre-cap number (${cad(
      bound.cap.uncappedHigh
    )}) the ceiling replaced`
  );
});

check("C5 · SOURCE-LEVEL — there is EXACTLY ONE cap, and no renderer applies a second", () => {
  // SOURCE-LEVEL, and labelled one: it is a scan for a thing that must not exist.
  // Two ceilings that disagree is how a document ends up printing a number no code
  // path can explain, and the failure would be invisible in any single output.
  const files = [
    "src/lib/leak-narrative.ts",
    "src/lib/exporters/deliverables.ts",
    "src/lib/exporters/validate-pack.ts",
    "src/lib/asset-generation.ts",
    // src/lib/cold-audit.ts was on this list until the pre-sale surface was
    // deleted (2026-08-01); a deleted file cannot declare a second ceiling.
  ];
  const declares: string[] = [];
  const applies: string[] = [];
  for (const f of files) {
    const src = codeOnly(f);
    if (/(?:const|let|var)\s+RECOVERY_CAP_SHARE\b/.test(src)) declares.push(f);
    if (/\bRECOVERY_CAP_SHARE\b/.test(src)) applies.push(f);
  }
  show("declares RECOVERY_CAP_SHARE", declares);
  show("reads RECOVERY_CAP_SHARE   ", applies);
  assert.deepStrictEqual(
    declares,
    ["src/lib/leak-narrative.ts"],
    "RECOVERY_CAP_SHARE is declared in more than one place (or has moved) — there must be exactly one ceiling"
  );
  assert.deepStrictEqual(
    applies,
    ["src/lib/leak-narrative.ts"],
    "a second file reads RECOVERY_CAP_SHARE. The cap belongs beside the arithmetic it bounds; applying it again downstream produces two ceilings that can disagree."
  );

  // And the renderer must PRINT what reconcileLeakTotal returns, never adjust it.
  const renderer = functionBody("src/lib/exporters/deliverables.ts", "function reconciledTotal(");
  const arithmetic = renderer.match(/total\.(?:low|high)\s*[*/+-]|Math\.(?:min|max)\s*\(\s*total\./g) ?? [];
  show("arithmetic on total.low/high in reconciledTotal()", arithmetic.length ? arithmetic : "(none)");
  assert.equal(
    arithmetic.length,
    0,
    `the D1 renderer performs arithmetic on the reconciled total (${arithmetic.join(", ")}). It may only print what reconcileLeakTotal returned.`
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * D · D2 — ONE PIPELINE, AND THE RETAINER IN THE RIGHT COLUMN
 * ────────────────────────────────────────────────────────────────────── */
section("D · D2 — the pipeline is one shared constant, and LeadGate is the monthly half");

check("D1 · PIPELINE and PIPELINE_STAGES are the same six, in the same order (compile-time typed)", () => {
  // COMPILE-TIME half: PipelineStageDef.stage is typed `PipelineStage`, which is
  // derived from PIPELINE_STAGES — so a column name that is not on the canonical
  // list does not build. This check proves the RUNTIME half the type cannot: that
  // the two lists are the same length and in the same ORDER.
  show("PIPELINE_STAGES", Array.from(PIPELINE_STAGES));
  show("PIPELINE       ", PIPELINE.map((s) => s.stage));
  assert.deepStrictEqual(
    PIPELINE.map((s) => s.stage),
    Array.from(PIPELINE_STAGES),
    "PIPELINE and PIPELINE_STAGES describe different pipelines"
  );
  assert.equal(PIPELINE_STAGES.length, 6, `the pipeline has ${PIPELINE_STAGES.length} stages, expected 6`);
  assert.equal(
    PIPELINE_STAGES[PIPELINE_STAGES.length - 1],
    "Lost",
    "Lost is not the last stage. The 60-day nurture ends by moving the deal there, so a pipeline without it has nowhere to put the leads that never booked."
  );
});

check("D2 · the CLIENT pipeline and ReclaimedHQ's OWN deal board are different lists", () => {
  // TWO FILES EXPORT A `PIPELINE_STAGES` AND THEY ARE NOT THE SAME THING. One is
  // the six columns we configure in the CLIENT's GoHighLevel sub-account; the
  // other is Kevin's OWN prospect board (Saved → Systems Ready → Proposal Sent →
  // Negotiating → Won). The names overlap enough — both end at Won — that somebody
  // will eventually "reconcile" them, and that breaks both screens at once.
  //
  // Word overlap is NOT the test, because "Won" legitimately appears on both. The
  // test is that the LISTS differ and that neither file imports the other's.
  const internalLabels = INTERNAL_DEAL_STAGES.map((s) => s.label);
  const clientColumns = Array.from(PIPELINE_STAGES);
  show("client pipeline (workflow-catalogue)", clientColumns);
  show("internal board  (stages.ts)         ", internalLabels);
  assert.notDeepStrictEqual(
    internalLabels,
    clientColumns,
    "the internal deal board and the client's CRM pipeline are now the same list — they are different boards for different people"
  );
  assert(
    !clientColumns.every((c) => internalLabels.includes(c)),
    "every client column now exists on the internal board — the two are being merged"
  );
  const catalogue = codeOnly("src/lib/workflow-catalogue.ts");
  const internal = codeOnly("src/lib/stages.ts");
  show("workflow-catalogue imports stages.ts", /from\s+"\.\/stages"/.test(catalogue));
  show("stages.ts imports workflow-catalogue", /workflow-catalogue/.test(internal));
  assert(!/from\s+"\.\/stages"/.test(catalogue), "the client pipeline now reads the internal deal board");
  assert(!/workflow-catalogue/.test(internal), "the internal deal board now reads the client pipeline");
});

check("D3 · the D2 blueprint renders the canonical six, from the constant (real fixture)", () => {
  const stages = (goldenPack.infrastructure?.crmPipeline?.stages ?? []).map((s) => s.stage);
  const html = renderDeliverableHtml(goldenPack, "build-plan");
  show("pack crmPipeline.stages", stages);
  assert.deepStrictEqual(stages, Array.from(PIPELINE_STAGES), "the fixture's blueprint pipeline is not the canonical six");
  for (const stage of PIPELINE_STAGES)
    assert(html.includes(stage), `the rendered D2 never prints the "${stage}" column`);
  show("all six columns present in rendered D2", true);
});

check("D4 · LeadGate is the MONTHLY half — named in the retainer funnel stage", () => {
  // NARROWED (Phase 5): this also asserted the retainer ROADMAP PHASE. The roadmap
  // is retired, so that half is gone with it. The funnel half — which is what
  // actually reaches a client, in the Build Plan's pipeline — is unchanged, and
  // the retainer's position in the SCHEDULE is now asserted deterministically by
  // verify-build-plan section C rather than against model-authored phases.
  const retainerStages = (goldenPack.infrastructure?.funnel?.stages ?? []).filter((s) => s.isRetainer);
  show("funnel stages flagged isRetainer", retainerStages.map((s) => s.stage));
  assert.equal(retainerStages.length, 1, `${retainerStages.length} funnel stages are flagged as the retainer, expected exactly 1`);
  const retainerText = collectStrings([retainerStages]).join("\n");
  assert(/LeadGate/i.test(retainerText), "LeadGate is not named anywhere in the retainer funnel stage");
});

check("D5 · LeadGate is NOT sold inside the one-time build (every non-retainer phase and stage)", () => {
  // The pricing rule wearing a wording rule's clothes. If a build-phase line claims
  // the qualification engine, the document has sold the CAD $1,000/month engine
  // inside the CAD $6,500 fee, and the first monthly invoice is an argument the
  // client can win by pointing at page four.
  //
  // The escape valve is the same one the validator allows and it is not a loophole:
  // a line may mention the engine if the SAME sentence says the monthly service
  // runs it.
  const QUALIFICATION = /LeadGate|lead[- ]qualification|qualification (?:engine|layer)|lead scoring|scoring threshold/i;
  const RETAINER_MARKER = /monthly|retainer|ongoing|every month/i;
  const offenders: string[] = [];

  for (const s of goldenPack.infrastructure?.funnel?.stages ?? []) {
    if (s.isRetainer) continue;
    // `currentWeakness` is deliberately not read: it describes what is BROKEN today
    // ("nothing qualifies a lead before it reaches you"), so reading it would flag
    // a stage for correctly diagnosing the absence of the thing it installs.
    const text = `${s.stage ?? ""} ${s.role ?? ""} ${s.whatWeDeploy ?? ""}`;
    if (QUALIFICATION.test(text) && !RETAINER_MARKER.test(text))
      offenders.push(`funnel stage "${s.stage}": ${text.trim().slice(0, 90)}…`);
  }
  for (const p of goldenPack.roadmap?.phases ?? []) {
    if (p.isRetainerPhase) continue;
    for (const line of [p.objective ?? "", ...(p.deployActions ?? []), ...(p.doneDefinition ?? [])]) {
      if (!line.trim() || !QUALIFICATION.test(line)) continue;
      if (RETAINER_MARKER.test(line)) {
        show(`allowed (says monthly) · ${p.phase}`, line);
        continue;
      }
      offenders.push(`roadmap phase "${p.phase}": ${line.slice(0, 90)}…`);
    }
  }
  show("one-time-build offenders", offenders.length ? offenders : "(none)");
  assert.equal(
    offenders.length,
    0,
    `${offenders.length} place(s) present the qualification engine as part of the one-time build: ${offenders.join(" | ")}`
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * E · D3 — THE COPY KNOWS WHERE IT GOES
 * ────────────────────────────────────────────────────────────────────── */
section("E · D3 — 60 days, a 1:1 step map, a destination on every asset, and nothing vanished");

const emailSteps = NURTURE_SEQUENCE.filter((s) => s.channel === "Email");
const textSteps = NURTURE_SEQUENCE.filter((s) => s.channel === "Text");

check("E1 · the nurture canvas IS 60 days, thirteen steps, no gaps and no duplicates", () => {
  const days = NURTURE_SEQUENCE.map((s) => s.day);
  const stepNumbers = NURTURE_SEQUENCE.map((s) => s.step);
  show("steps      ", NURTURE_SEQUENCE.length);
  show("emails/texts", `${emailSteps.length} / ${textSteps.length}`);
  show("days       ", days);
  show("last day   ", days[days.length - 1]);
  assert.equal(days[days.length - 1], 60, `the canvas ends on day ${days[days.length - 1]}, not day 60`);
  assert.deepStrictEqual(
    stepNumbers,
    NURTURE_SEQUENCE.map((_, i) => i + 1),
    "the step numbers are not 1..N in order — the operator is pasting into numbered boxes"
  );
  assert.deepStrictEqual(
    days,
    [...days].sort((a, b) => a - b),
    "the days are not monotonically increasing"
  );
  assert.equal(new Set(stepNumbers).size, stepNumbers.length, "two steps share a step number");
  const meta = nurtureMeta("Email");
  show("nurtureMeta.lengthDays/totalSteps", { lengthDays: meta.lengthDays, totalSteps: meta.totalSteps });
  assert.equal(meta.lengthDays, 60, "the stamped metadata disagrees with the canvas about the length");
  assert.equal(meta.totalSteps, NURTURE_SEQUENCE.length, "the stamped metadata disagrees about the step count");
});

check("E2 · the fixture's emails map 1:1 onto the canvas's EMAIL steps (asserted, not eyeballed)", () => {
  const emails = goldenPack.file3?.emails ?? [];
  const actual = emails.map((e) => ({ step: e.step, day: e.day, purpose: e.purpose }));
  const expected = emailSteps.map((s) => ({ step: s.step, day: s.day, purpose: s.purpose }));
  show("expected (canvas)", expected.map((e) => `#${e.step}/day ${e.day}`));
  show("actual (fixture) ", actual.map((e) => `#${e.step}/day ${e.day}`));
  assert.deepStrictEqual(actual, expected, "the email half does not match the canvas step for step");
});

check("E3 · the fixture's texts map 1:1 onto the canvas's TEXT steps", () => {
  const messages = goldenPack.file4?.messages ?? [];
  const actual = messages.map((m) => ({ step: m.step, day: m.day, order: m.order }));
  const expected = textSteps.map((s) => ({ step: s.step, day: s.day, order: s.index }));
  show("expected (canvas)", expected.map((m) => `#${m.step}/day ${m.day}`));
  show("actual (fixture) ", actual.map((m) => `#${m.step}/day ${m.day}`));
  assert.deepStrictEqual(actual, expected, "the text half does not match the canvas step for step");
});

check("E4 · the two halves reassemble into ONE workflow — thirteen steps, ending on day 60", () => {
  const combined = [
    ...(goldenPack.file3?.emails ?? []).map((e) => ({ step: e.step!, day: e.day, channel: "Email" })),
    ...(goldenPack.file4?.messages ?? []).map((m) => ({ step: m.step!, day: m.day!, channel: "Text" })),
  ].sort((a, b) => a.step - b.step);
  show("reassembled", combined.map((s) => `${s.step}·d${s.day}·${s.channel[0]}`).join(" → "));
  assert.deepStrictEqual(
    combined,
    NURTURE_SEQUENCE.map((s) => ({ step: s.step, day: s.day, channel: s.channel })),
    "the two documents do not reassemble into the single canvas — read separately they would disagree about which message is 'the fourth one'"
  );
  const both = [goldenPack.file3?.sequence, goldenPack.file4?.sequence];
  for (const meta of both) {
    assert(meta, "a nurture half ships with no sequence metadata, so read on its own it does not say which workflow it belongs to");
    show("sequence.where", meta!.where);
    assert(meta!.where.trim(), "the sequence metadata carries no destination");
    assert(/Lead Nurture/i.test(meta!.workflowName), `the sequence names workflow "${meta!.workflowName}"`);
  }
  assert.notEqual(
    goldenPack.file3!.sequence!.where,
    goldenPack.file4!.sequence!.where,
    "both halves claim the same destination — the emails and the texts are installed in different steps"
  );
});

check("E5 · EVERY nurture asset renders under the workflow that sends it, on its own day", () => {
  // THE SAME FEAR, RE-AIMED AT THE NEW LAYOUT. The failure this guards is a
  // day-45 email landing in the missed-call flow, and it used to be guarded by
  // counting destination lines: thirteen assets, thirteen lines naming the
  // nurture workflow.
  //
  // P0-4/P2-4 dissolved the per-asset sections into one block per workflow, so
  // there is now exactly ONE destination line for the nurture workflow with all
  // thirteen messages in a table beneath it. Counting lines against assets would
  // now fail on a document that is strictly easier to paste from — but the
  // literal count was never the law, it was a proxy for "the operator can tell
  // which message this is and where it goes".
  //
  // So the proxy is replaced by the thing itself, and it is a stronger claim
  // than the count was: every message is under the destination that names its
  // workflow, and every message carries its own day, off the pack's own numbers
  // rather than a transcription.
  const html = renderDeliverableHtml(goldenPack, "asset-pack");
  const nurtureName = workflowById("lead-nurture-no-booking")?.name ?? "Lead Nurture — No Booking";
  const dests = Array.from(html.matchAll(/Where this goes<\/span>([^<]*)/g), (m) => m[1]);
  const nurtureDests = dests.filter((d) => d.includes(nurtureName));
  show("destination lines rendered in D3", dests.length);
  show("naming the nurture workflow     ", nurtureDests.length);
  for (const d of nurtureDests) show("  ", d);
  assert.equal(
    nurtureDests.length,
    1,
    `the nurture messages are spread across ${nurtureDests.length} destinations. They are one workflow — more than one home for them is how a day-45 email ends up in the missed-call flow.`
  );

  // The block is everything from that destination line to the next label, which
  // is where the next workflow starts.
  const at = html.indexOf(nurtureDests[0]);
  const nextLabel = html.indexOf('<div class="label">', at);
  const block = html.slice(at, nextLabel > at ? nextLabel : html.length);
  const rows = Array.from(block.matchAll(/<td class="msg-when">([\s\S]*?)<\/td>/g), (m) =>
    m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );

  // The days the pack itself says these messages run on. Not a transcription:
  // E2/E3 above already pin these to the canvas, so this reads the same numbers
  // one layer further along and proves they survived the render.
  const packDays = [
    ...(goldenPack.file3?.emails ?? []).map((e) => e.day),
    ...(goldenPack.file4?.messages ?? []).map((m) => m.day),
  ]
    .filter((d): d is number => typeof d === "number")
    .sort((a, b) => a - b);
  const renderedDays = rows
    .map((r) => Number(/Day (\d+)/.exec(r)?.[1]))
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => a - b);

  show("nurture assets in the pack      ", packDays.length);
  show("message rows under that block   ", rows.length);
  show("days on the pack                ", packDays.join(", "));
  show("days rendered                   ", renderedDays.join(", "));
  assert.equal(
    rows.length,
    packDays.length,
    `${packDays.length} nurture assets on the pack but ${rows.length} rows under the workflow that sends them — the difference is copy that was generated and dropped at render`
  );
  assert.deepStrictEqual(
    renderedDays,
    packDays,
    "a nurture message renders without its day, or on a day the pack does not have. The day is the only thing telling the operator which of thirteen boxes this one goes in."
  );
});

check("E6 · every rendered D3 asset group carries a destination line (nothing lands homeless)", () => {
  const html = renderDeliverableHtml(goldenPack, "asset-pack");
  const groups = Array.from(html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g), (m) => m[1].trim()).filter(Boolean);
  const dests = (html.match(/Where this goes<\/span>/g) ?? []).length;
  show("D3 sections     ", groups);
  show("destination lines", dests);
  assert(groups.length >= 3, `D3 rendered only ${groups.length} sections — the document has lost content`);
  assert(dests >= groups.length, `${groups.length} sections but only ${dests} destination lines`);
});

check("E7 · the five conversion surfaces each name a DISTINCT destination (stamped, not authored)", () => {
  const surfaces = goldenPack.surfaces;
  assert(surfaces, "the fixture carries no `surfaces` block — the D3 copy has no destinations at all");
  const wheres = [
    ["bookingPage", surfaces!.bookingPage?.where],
    ["leadCaptureForm", surfaces!.leadCaptureForm?.where],
    ["leadGate", surfaces!.leadGate?.where],
    ["webchat", surfaces!.webchat?.where],
    ["siteAdvisory", surfaces!.siteAdvisory?.where],
  ] as const;
  for (const [name, where] of wheres) {
    show(name, where ?? "(none)");
    assert(where?.trim(), `${name} carries no destination`);
  }
  const values = wheres.map(([, w]) => w!);
  assert.equal(new Set(values).size, values.length, "two surfaces claim the same destination");
  // The `where` strings are stamped from constants in asset-generation.ts, so they
  // are identical in every pack. stampedClientStrings() is that same set, exported
  // for the validator — if a fixture's destination is not in it, the fixture wrote
  // its own and the two can drift.
  const stamped = new Set(stampedClientStrings());
  for (const [name, where] of wheres)
    assert(
      stamped.has(where!),
      `${name}'s destination is not one of the stamped constants — it was authored into the fixture and will drift from what generation produces`
    );
  show("all five are stamped constants", true);
});

// ── The landing-page call is gone, and nothing it wrote vanished with it ──────

/** Site-builder tools. Naming one implies a website build is in scope; it is not,
 *  and it is not something ReclaimedHQ would advise on either. */
const SITE_BUILDERS = /\b(?:Framer|Webflow|Squarespace|Wix|WordPress|Elementor|Shopify)\b/i;
/** "How to deploy this page" — instructions for work outside the offer.
 *
 *  TWO NARROWINGS, BOTH DELIBERATE, because a ban that fires on correct copy is a
 *  ban somebody comments out:
 *    · it is about deploying a PAGE or a SITE, so the roadmap's legitimate
 *      `deployActions` ("we deploy missed-call text-back") are not caught;
 *    · and it EXEMPTS the one page we really do build and host — the GoHighLevel
 *      booking page. "Host the page inside the GoHighLevel sub-account" is a true
 *      sentence about work inside the offer, and the standing rule that says
 *      "the page we build and host is the GoHighLevel booking page" is the scope
 *      sentence itself. Flagging either would mean deleting the sentence that
 *      protects the offer in order to satisfy a check that exists to protect it. */
const DEPLOYMENT_NOTES =
  /\b(?:deploy|deployment|publish|launch|host)\w*\b[^.!?]{0,40}\b(?:page|site|website|landing)\b|\b(?:page|site|website|landing)\b[^.!?]{0,40}\b(?:deployment notes|deploy(?:ed|ing)? (?:it|this))\b/i;
/** The one surface we DO build and host. A deployment sentence naming it is in
 *  scope; every other one is instructions for work we do not do. */
const OUR_OWN_PAGE = /GoHighLevel|booking page/i;

check("E8 · the 10th generation call is GONE from the engine (source-level)", () => {
  const src = codeOnly("src/lib/asset-generation.ts");
  show("generateLandingModule defined", /function\s+generateLandingModule/.test(src));
  show("returns a `landing` key       ", /\blanding,/.test(functionBody("src/lib/asset-generation.ts", "export async function generateAssetPack(")));
  assert(
    !/function\s+generateLandingModule/.test(src),
    "generateLandingModule is back. It writes a landing-page specification for a surface the offer does not contain."
  );
  const assembly = functionBody("src/lib/asset-generation.ts", "export async function generateAssetPack(");
  assert(
    !/\blanding,/.test(assembly),
    "generateAssetPack still puts a `landing` key on the pack it returns"
  );
  assert(
    /\bsurfaces,/.test(assembly) && /\bworkflowCopy,/.test(assembly),
    "the pack no longer carries `surfaces` / `workflowCopy` — the copy the landing call used to write has nowhere to live"
  );
});

check("E9 · no techStack and no deployment notes ANYWHERE in the generated pack", () => {
  const keys = collectKeys(goldenPack);
  const banned = ["techStack", "landing", "landingStructure", "landingPage", "implementationNote"].filter((k) =>
    keys.has(k)
  );
  show("banned keys present in the pack", banned.length ? banned : "(none)");
  assert.equal(
    banned.length,
    0,
    `the pack still carries ${banned.join(", ")}. We do not build, host, redesign or deploy websites, so a tool for building one and instructions for deploying one are copy for work outside the offer.`
  );

  const strings = collectStrings(goldenPack);
  const tools = strings.filter((s) => SITE_BUILDERS.test(s));
  const deployAll = strings.filter((s) => DEPLOYMENT_NOTES.test(s));
  const deploys = deployAll.filter((s) => !OUR_OWN_PAGE.test(s));
  show("strings naming a site builder      ", tools.length ? tools.slice(0, 3) : "(none)");
  show("deployment sentences, total        ", deployAll.length);
  show("…about OUR booking page (in scope) ", deployAll.length - deploys.length);
  show("…about a page we do not build      ", deploys.length ? deploys.slice(0, 3) : "(none)");
  assert.equal(tools.length, 0, `${tools.length} string(s) name a website-building tool: ${tools.slice(0, 2).join(" | ")}`);
  assert.equal(deploys.length, 0, `${deploys.length} string(s) read as deployment instructions for a page we do not build: ${deploys.slice(0, 2).join(" | ")}`);
});

/**
 * WHERE EVERY REPOINTED ASSET ACTUALLY LANDED.
 *
 * THIS IS THE OWNER'S "NOTHING VANISHED" CHECK, and it is mechanical on purpose.
 * docs/landing-call-inventory.md is the pre-deletion inventory: every asset the
 * 10th call produced, with a verdict. REPOINT means "it has a real home in the
 * build" — a promise made in a document, which is the kind of promise that
 * quietly stops being true.
 *
 * So the doc is PARSED, not read. Every row whose verdict says REPOINT must have
 * an entry below, every entry must name a row that exists, and every probe has to
 * find real content in the committed pack. Delete a repointed asset and the row is
 * still in the doc, the probe comes back empty, and this fails.
 */
type RowProbe = { row: string; lands: string; find: (p: AssetPack) => unknown };

const advisoryNote = (p: AssetPack, area: RegExp) =>
  (p.surfaces?.siteAdvisory?.notes ?? []).find((n) => area.test(n.area ?? ""));

const REPOINT_DESTINATIONS: RowProbe[] = [
  // ── section 1 · the diagnosis half, which fed D1 ────────────────────────────
  { row: "1.1", lands: "surfaces.siteAdvisory.summary + the stamped scope sentence", find: (p) => p.surfaces?.siteAdvisory?.summary && p.surfaces?.siteAdvisory?.scopeNote },
  { row: "1.2", lands: "surfaces.siteAdvisory — the Hero note", find: (p) => advisoryNote(p, /hero/i) },
  { row: "1.3", lands: "surfaces.siteAdvisory — the Buttons note", find: (p) => advisoryNote(p, /button/i) },
  { row: "1.4", lands: "surfaces.siteAdvisory — the Proof placement note", find: (p) => advisoryNote(p, /proof/i) },
  { row: "1.5", lands: "surfaces.siteAdvisory (on-page) + file1.conversionBottlenecks (post-submit)", find: (p) => advisoryNote(p, /form/i) && (p.file1?.conversionBottlenecks ?? []).length },
  { row: "1.7", lands: "file1.fastestWins, and every advisory note carries its own priority", find: (p) => (p.file1?.fastestWins ?? []).length && (p.surfaces?.siteAdvisory?.notes ?? []).every((n) => Boolean(n.priority)) },
  { row: "1.8", lands: "file1.trackingAnalytics + surfaces.siteAdvisory — the Measurement note", find: (p) => (p.file1?.trackingAnalytics ?? []).length && advisoryNote(p, /measurement/i) },

  // ── section 2 · the assets half, which fed D3 ───────────────────────────────
  { row: "2.1", lands: "surfaces.bookingPage.headlineOptions — all three", find: (p) => (p.surfaces?.bookingPage?.headlineOptions ?? []).length === 3 },
  { row: "2.2", lands: "surfaces.bookingPage.subheadlineOptions — all three", find: (p) => (p.surfaces?.bookingPage?.subheadlineOptions ?? []).length === 3 },
  { row: "2.3", lands: "surfaces.bookingPage.primaryButton", find: (p) => p.surfaces?.bookingPage?.primaryButton },
  { row: "2.4", lands: "surfaces.bookingPage.secondaryButton", find: (p) => p.surfaces?.bookingPage?.secondaryButton },
  { row: "2.5", lands: "surfaces.bookingPage.reassuranceLine", find: (p) => p.surfaces?.bookingPage?.reassuranceLine },
  { row: "2.6", lands: "surfaces.bookingPage.proofLine", find: (p) => p.surfaces?.bookingPage?.proofLine },
  { row: "2.10", lands: "the buttons, split across the four surfaces that actually have them", find: (p) => p.surfaces?.bookingPage?.primaryButton && p.surfaces?.bookingPage?.secondaryButton && p.surfaces?.leadCaptureForm?.submitButton && p.surfaces?.webchat?.launcherLabel },
  { row: "2.11", lands: "every surface's stamped `where` — the placement instruction, in build terms", find: (p) => [p.surfaces?.bookingPage, p.surfaces?.leadCaptureForm, p.surfaces?.leadGate, p.surfaces?.webchat, p.surfaces?.siteAdvisory].every((s) => Boolean((s as { where?: string } | undefined)?.where)) },
  { row: "2.13", lands: "surfaces.bookingPage.faq, with the webchat and LeadGate entries split out", find: (p) => (p.surfaces?.bookingPage?.faq ?? []).length >= 5 && p.surfaces?.webchat?.awayMessage && (p.surfaces?.leadGate?.questionIntros ?? []).length },
  { row: "2.14", lands: "surfaces.leadCaptureForm.postSubmitCopy — INCLUDING the emergency route", find: (p) => p.surfaces?.leadCaptureForm?.postSubmitCopy && p.surfaces?.leadCaptureForm?.emergencyRoute },
  { row: "2.15a", lands: "surfaces.bookingPage.sectionOrder — now carrying the finished words, not a brief", find: (p) => (p.surfaces?.bookingPage?.sectionOrder ?? []).length >= 5 && (p.surfaces?.bookingPage?.sectionOrder ?? []).every((s) => Boolean(s.copy?.trim())) },
  { row: "2.16", lands: "surfaces.siteAdvisory.standingRules — all four, verbatim", find: (p) => (p.surfaces?.siteAdvisory?.standingRules ?? []).length === 4 },
];

/** The four standing rules, verbatim. They are the scope language of the whole
 *  engagement — the sentence that says we do not build websites is in here — and
 *  the inventory marks all four "REPOINT — VERBATIM". Written out so this check
 *  ties the DOC and the PACK together: both must carry the same words. */
const STANDING_RULES_VERBATIM: Record<string, string> = {
  "2.16a":
    "These are advisory notes for whoever maintains the website; the page we build and host is the GoHighLevel booking page.",
  "2.16b":
    "The fastest version of all of this is repointing the existing buttons at the booking page and leaving the rest of the site alone.",
  "2.16c":
    "Never publish a review, a name or a photo that did not come from a real customer, however good the placeholder reads.",
  "2.16d":
    "Any response time promised on the page has to match what the automation actually does, or the page becomes a liability.",
};

const INVENTORY = "docs/landing-call-inventory.md";

/** Row ids whose verdict cell says REPOINT, read out of the inventory's tables. */
function repointRows(): string[] {
  const rows: string[] = [];
  for (const line of read(INVENTORY).split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is the empty string before the leading pipe.
    const id = cells[1]?.replace(/\*/g, "").trim();
    if (!/^\d+\.\d+[a-z]?$/.test(id ?? "")) continue;
    if (!cells.some((c) => /\bREPOINT\b/.test(c))) continue;
    rows.push(id!);
  }
  return rows;
}

check("E10 · the inventory is parsed, and EVERY REPOINT row has a destination declared", () => {
  assert(existsSync(resolve(REPO, INVENTORY)), `${INVENTORY} is missing — the "nothing vanished" check has nothing to read`);
  const doc = repointRows().sort();
  const declared = [...REPOINT_DESTINATIONS.map((d) => d.row), ...Object.keys(STANDING_RULES_VERBATIM)].sort();
  show("REPOINT rows in the doc", doc);
  show("rows with a destination", declared);
  assert(doc.length >= 20, `only ${doc.length} REPOINT rows parsed out of ${INVENTORY} — the table format changed and this check is reading nothing`);
  assert.deepStrictEqual(
    declared,
    doc,
    "the inventory and this file disagree about which assets were repointed. A row in the doc with no destination here is an asset nobody checked survived; a destination here with no row is a check aimed at nothing."
  );
});

for (const d of REPOINT_DESTINATIONS) {
  check(`E11 · row ${d.row} is live in the generated shape — ${d.lands}`, () => {
    const found = d.find(goldenPack);
    show("probe result", found ? (typeof found === "object" ? JSON.stringify(found).slice(0, 140) : found) : "(EMPTY)");
    assert(found, `row ${d.row} of ${INVENTORY} is marked REPOINT, but its destination is empty in the committed pack — that asset vanished`);
  });
}

check("E12 · rows 2.16a–d survived VERBATIM, in both the inventory and the pack", () => {
  const doc = read(INVENTORY);
  const rules = goldenPack.surfaces?.siteAdvisory?.standingRules ?? [];
  for (const [row, sentence] of Object.entries(STANDING_RULES_VERBATIM)) {
    const inDoc = doc.includes(sentence);
    const inPack = rules.includes(sentence);
    show(`${row} in doc / in pack`, `${inDoc} / ${inPack}`);
    assert(inDoc, `${row}: the inventory no longer quotes this sentence — the doc and the pack have drifted apart`);
    assert(inPack, `${row} did NOT survive verbatim: "${sentence.slice(0, 60)}…". These four sentences are the scope language of the engagement; dropping one deletes the sentence that protects the offer.`);
  }
  assert.equal(rules.length, 4, `the pack carries ${rules.length} standing rules, expected exactly the four`);
});

/* ──────────────────────────────────────────────────────────────────────────
 * F · D4 — THE SCHEDULE IS THE ENGAGEMENT
 * ────────────────────────────────────────────────────────────────────── */
section("F · D4 — Days 1–14 → go-live → Days 15–90, priced window by window");

/** The three windows, in order, as the engagement is actually sold. Both
 *  spellings of the first fortnight pass ("Days 1–14" and "Weeks 1–2" denote the
 *  identical promise); anything that is NOT that fortnight is a different one. */
const D4_SHAPE = [
  {
    name: "Build",
    window: /\bdays?\s*1\s*(?:–|—|-|to|through)\s*14\b|\bweeks?\s*1\s*(?:–|—|-|to|through)\s*2\b/i,
    isRetainerPhase: false,
    investment: /CAD \$6,500/,
  },
  {
    name: "Go-live",
    window: /\bgo[-\s]?live\b|\blaunch|\bday\s*14\b/i,
    isRetainerPhase: false,
    investment: /included/i,
  },
  {
    name: "Ongoing",
    window: /\bdays?\s*15\s*(?:–|—|-|to|through)\s*90\b/i,
    isRetainerPhase: true,
    investment: /CAD \$1,000\s*(?:per month|\/mo|a month)/i,
  },
];

/* F1 · F2 · F4 — RETIRED (Phase 5, 2026-08-06).
 *
 * All three asserted the SHAPE of a model-authored roadmap on the pack: three
 * phases in order, the retainer flag on the last one only, and exactly one
 * go-live block. They existed because the schedule was generated and could
 * therefore come back wrong.
 *
 * The schedule is no longer generated. src/lib/build-plan.ts derives all four
 * windows from one kickoff date and a fixed BUILD_DAYS, so there is no shape left
 * to get wrong — and a check over a constant only ever passes. What replaced
 * them, asserting the same promises against the RENDERED document instead of the
 * pack: verify-build-plan section C (windows booked and unbooked, go-live exactly
 * BUILD_DAYS after kickoff, no invented date) and F3/F5 below (both prices on the
 * right windows, in the document a client opens).
 */

check("F3 · CAD $6,500 sits on the BUILD window and CAD $1,000/month on the ONGOING one", () => {
  const phases = goldenPack.roadmap?.phases ?? [];
  phases.forEach((p, i) => {
    show(`${p.phase} (${p.window})`, p.investment ?? "(no price)");
    assert(p.investment?.trim(), `phase "${p.phase}" carries no price — the reader cannot tell what the window costs`);
    assert(
      D4_SHAPE[i].investment.test(p.investment!),
      `phase "${p.phase}" is priced "${p.investment}" but must read as the ${D4_SHAPE[i].name} window's cost`
    );
  });
  // The marker BEFORE the figure, everywhere. "$6,500 CAD" is a different
  // convention and two conventions in one document is how a client asks which
  // currency the other number was in.
  for (const p of phases) {
    const bare = (p.investment ?? "").match(/(?<!CAD )\$[\d,]+/g) ?? [];
    assert.equal(bare.length, 0, `phase "${p.phase}" prints an unmarked dollar figure: ${bare.join(", ")}`);
  }
  show("every figure carries the CAD marker before it", true);
});

check("F5 · the Build Plan prints every window and both prices, booked or not", () => {
  // "Days 15–90" is gone on purpose: the retainer does not stop at day 90, and a
  // window that implies it does is a commercial claim we do not make. The running
  // window is now expressed from go-live.
  const unbooked = renderDeliverableHtml(goldenPack, "build-plan", ctxFor(null, null));
  for (const w of ["Days 1–14 from kickoff", "14 days after kickoff", "From go-live", "CAD $6,500", "CAD $1,000"]) {
    show(`unbooked renders "${w}"`, unbooked.includes(w));
    assert(unbooked.includes(w), `the Build Plan with no kickoff never prints "${w}"`);
  }

  // And with a kickoff date, real dates replace the relative wording everywhere.
  const booked = renderDeliverableHtml(goldenPack, "build-plan", ctxFor(null, new Date("2026-09-01T00:00:00Z")));
  for (const w of ["September 1, 2026", "September 15, 2026", "CAD $6,500", "CAD $1,000"]) {
    show(`booked renders "${w}"`, booked.includes(w));
    assert(booked.includes(w), `the Build Plan with a kickoff date never prints "${w}"`);
  }
  assert(
    !booked.includes("from kickoff"),
    "a booked plan still carries relative wording — the two must never appear together"
  );

  for (const [label, html] of [["unbooked", unbooked], ["booked", booked]] as const) {
    const bare = html.match(/(?<!CAD )(?<!&#36;)\$[\d,]{3,}/g) ?? [];
    show(`unmarked $ figures (${label})`, bare.length ? bare.slice(0, 5) : "(none)");
    assert.equal(bare.length, 0, `the ${label} Build Plan prints ${bare.length} unmarked dollar figure(s): ${bare.slice(0, 3).join(", ")}`);
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * G. GENERATED ⇒ RENDERED
 *
 * THE BUG THIS EXISTS FOR, because it actually happened and 342 assertions
 * missed it. Phase 3 moved the booking-page / capture-form / LeadGate / webchat
 * copy off `pack.landing` and onto `pack.surfaces`. The generator was updated;
 * the RENDERER was not. So D3 quietly lost an entire section — the copy was
 * produced, persisted, validated, and then dropped on the floor at render time.
 * Every existing check stayed green, because each one asked "is what is rendered
 * correct?" and none asked "is everything that exists rendered at all?".
 *
 * That is the "I don't want to discover in three weeks that the booking-page
 * headline copy vanished" failure, displaced one layer down from generation into
 * rendering — which is exactly where an inventory of the GENERATOR cannot see it.
 *
 * The invariant: every client-facing part present on a pack must reach a rendered
 * document. It is checked by CONTENT, not by section title, so a renderer that
 * prints a heading and no copy still fails.
 * ══════════════════════════════════════════════════════════════════════════ */

section("G · GENERATED ⇒ RENDERED — nothing produced may be silently dropped");

check("G1 · every client-facing pack part that EXISTS reaches a rendered document", () => {
  const docs = (["diagnosis", "build-plan", "asset-pack"] as const).map((id) => renderDeliverableHtml(goldenPack, id));
  const all = docs.join("\n");

  // part → a distinctive string from its CONTENT (never its heading), so a
  // heading rendered over an empty body cannot pass.
  const parts: { name: string; present: boolean; needle: string | undefined }[] = [
    {
      name: "surfaces.bookingPage",
      present: Boolean(goldenPack.surfaces?.bookingPage),
      needle: goldenPack.surfaces?.bookingPage?.primaryButton,
    },
    {
      name: "surfaces.leadCaptureForm",
      present: Boolean(goldenPack.surfaces?.leadCaptureForm),
      needle: goldenPack.surfaces?.leadCaptureForm?.formHeadline,
    },
    {
      name: "surfaces.leadGate",
      present: Boolean(goldenPack.surfaces?.leadGate),
      needle: goldenPack.surfaces?.leadGate?.openingLine,
    },
    {
      name: "surfaces.webchat",
      present: Boolean(goldenPack.surfaces?.webchat),
      needle: goldenPack.surfaces?.webchat?.greeting,
    },
    {
      name: "surfaces.siteAdvisory",
      present: Boolean(goldenPack.surfaces?.siteAdvisory),
      needle: goldenPack.surfaces?.siteAdvisory?.summary,
    },
    {
      name: "workflowCopy",
      present: Boolean(goldenPack.workflowCopy?.assets?.length),
      needle: goldenPack.workflowCopy?.assets?.[0]?.messages?.[0]?.body,
    },
  ];

  // P3-5 asked for genuinely per-recipient tokens to render as a styled chip
  // rather than as raw brackets, so a message body that reads
  //   "Hi {{contact.first_name}}, this is {{location.name}}."
  // on the pack reaches the page as
  //   "Hi <code class="mf">{{contact.first_name}}</code>, this is …"
  // and stops being one contiguous string. Unwrapping the chip is the ONLY
  // normalisation applied — the needle is still matched whole, so a renderer
  // that prints half a message still fails. Written out rather than imported for
  // the same reason the escaper below is: a proof that reuses the implementation
  // it is checking proves less.
  const unchip = (s: string): string => s.replace(/<code class="mf">|<\/code>/g, "");

  const missing: string[] = [];
  for (const p of parts) {
    if (!p.present) {
      show(`${p.name.padEnd(26)}`, "not on this pack — nothing to render");
      continue;
    }
    // Compare on escaped and unescaped forms: the renderer escapes for HTML.
    const raw = (p.needle ?? "").trim();
    // The renderer HTML-escapes, so compare against both forms. Written out
    // rather than imported: the escaper is internal to the exporter, and a proof
    // that reuses the implementation it is checking proves less.
    const escaped = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const flat = unchip(all);
    const rendered = raw !== "" && (flat.includes(raw) || flat.includes(escaped));
    show(`${p.name.padEnd(26)}`, rendered ? "PRESENT and RENDERED" : "PRESENT but NOT RENDERED");
    if (!rendered) missing.push(p.name);
  }

  assert.equal(
    missing.length,
    0,
    `these pack parts are generated and persisted but never reach a document: ${missing.join(
      ", "
    )}. Copy that exists and is not rendered is the same as copy that vanished — wire the renderer, do not delete the part.`
  );
});

check("G2 · the invariant is not vacuous — it FAILS on a part that is present but unrendered", () => {
  // Prove the check above can actually fail, by asking it the same question about
  // a pack whose surfaces the renderer is given no chance to print. Without this,
  // G1 would keep passing if every part quietly became absent.
  const stripped = JSON.parse(JSON.stringify(goldenPack)) as AssetPack;
  const marker = "ZZ-UNRENDERABLE-SENTINEL-ZZ";
  if (stripped.surfaces?.bookingPage) stripped.surfaces.bookingPage.primaryButton = marker;
  const d3 = renderDeliverableHtml(stripped, "asset-pack");
  show("sentinel injected into surfaces.bookingPage.primaryButton", marker);
  show("sentinel appears in the rendered D3", d3.includes(marker));
  assert(
    d3.includes(marker),
    "the renderer does not print bookingPage.primaryButton at all, so G1's needle proves nothing about that part"
  );
});

/**
 * G3 · THE INVENTORY G1 KEEPS IS NOT THE WHOLE PACK, AND THE GAP IS NAMED.
 *
 * ADDED IN PHASE 4, AND IT IS A STRENGTHENING RATHER THAN A REPAIR — G1 was not
 * wrong, it was incomplete, and building the three fixture clients is what made
 * the hole visible. G1 keeps a hand-written inventory of client-facing pack parts
 * (`surfaces.*`, `workflowCopy`) and proves each one reaches a document. Anything
 * NOT on that list is outside the invariant entirely, and something is:
 *
 *   roadmap.phases[].workflowsInThisWindow — stamped onto every pack by
 *   stampRoadmapWindows(), twenty-five entries on a real client, and printed
 *   nowhere in D4.
 *
 * That list is precisely what makes a SMALLER build visible in the schedule: a
 * client whose operator switched three workflows off gets eleven names in those
 * windows instead of fourteen, and the document he actually reads shows neither
 * number. It is the same shape of defect G1 was written for — generated,
 * persisted, validated, dropped at render — one field further along.
 *
 * WHY THIS CHECK PASSES INSTEAD OF FAILING. The renderer is not this agent's file
 * to edit, and a red suite that nobody can turn green gets ignored, then deleted.
 * So the gap is BOUNDED rather than asserted away: the set of stamped-but-
 * unrendered roadmap fields must be a SUBSET of the one known gap below. It goes
 * green today, it goes green the day somebody wires the renderer, and it goes RED
 * the moment a SECOND roadmap field starts being dropped — which is the failure
 * worth catching. The known gap itself is written up in docs/final-verification.md.
 */
/* ── THE ROADMAP IS RETIRED (Phase 3, 2026-08-06) ───────────────────────────
 * G3 used to police a KNOWN-GAPS list: roadmap fields that were generated and
 * then dropped at render, each written up with why. Two of them were genuine
 * content loss.
 *
 * The gap is closed by removing the thing that leaked, not by rendering it. The
 * Roadmap and the Blueprint merged into the Build Plan, whose schedule is
 * DETERMINISTIC — four windows derived from one kickoff date and a fixed
 * fourteen-day build, in src/lib/build-plan.ts. A model-authored phase list
 * cannot be checked against anything, and the two fields that were being lost
 * (`goLive`, `workflowsInThisWindow`) are now rendered from the catalogue and the
 * five build decisions instead, where they are verifiable.
 *
 * So the invariant flips. It is no longer "every roadmap field must render"; it
 * is "no roadmap field may render, because a document that mixes a deterministic
 * schedule with model-authored phases has two schedules in it." Asserted in both
 * directions below so this cannot rot into silence either way.
 *
 * pack.roadmap is STILL GENERATED and still costs a model call (10,240 max
 * tokens per pack). Nothing renders it. Deleting generateRoadmap /
 * stampRoadmapWindows and their validator checks is the first task of Phase 5 —
 * flagged rather than done here, because it reaches into asset-generation.ts and
 * validate-pack.ts and is a generation-retirement job, not a document job.
 */

check("G3 · the retired roadmap does not leak into the Build Plan, and the schedule replaces it", () => {
  const html = renderDeliverableHtml(goldenPack, "build-plan", ctxFor(null, null));

  // SYNTHETIC, not read off the fixture. The roadmap generator is deleted, so the
  // fixtures no longer carry one — and a check that depended on the fixture
  // carrying retired data would have quietly stopped checking anything the moment
  // the fixture was rebuilt. This is the shape stampRoadmapWindows() used to
  // produce, written out here, so the scan below has real prose to hunt for.
  const phases = [
    {
      phase: "Build",
      window: "Days 1-14",
      objective:
        "Close the capture and response gaps, in the order the dollar figures in this report put them.",
      deployActions: [
        "Stand up the sub-account, port a tracked number and turn on call recording.",
        "Deploy missed-call text-back on the published line.",
      ],
      doneDefinition: [
        "A test enquiry outside opening hours gets an answer within a minute.",
      ],
      workflowsInThisWindow: ["Instant Lead Response", "Missed Call Text-Back"],
    },
  ];

  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // 1 · NOTHING model-authored from the roadmap reaches the page.
  //
  // NARROWED, AND THE NARROWING IS LOAD-BEARING. A first pass at this flagged
  // ten "leaks" that were nothing of the kind: roadmap.workflowsInThisWindow
  // holds WORKFLOW NAMES, and the Build Plan renders those names from the
  // catalogue — its own source — so the string matches without anything having
  // leaked. Comparing raw strings cannot tell "the roadmap put this here" from
  // "the catalogue did".
  //
  // So anything the catalogue can account for is excluded. What remains is
  // genuinely model-authored prose (an `objective`, a `doneDefinition` line),
  // which has no other way onto the page. G3b below proves the narrowing did not
  // gut the check.
  const catalogueText = WORKFLOWS.flatMap((w) => [w.name, w.whatItDoes, w.whatTheClientSees, w.trigger])
    .concat(PIPELINE.flatMap((s) => [s.stage, s.whatItMeans, s.howALeadArrives, s.howALeadLeaves]))
    .join("\n");

  const leaked: string[] = [];
  for (const phase of phases) {
    for (const [field, value] of Object.entries(phase)) {
      for (const str of collectStrings(value).filter((x) => x.trim().length > 20)) {
        if (catalogueText.includes(str)) continue; // the catalogue's, not the roadmap's
        if (html.includes(str) || html.includes(esc(str))) leaked.push(`${field}: ${str.slice(0, 50)}…`);
      }
    }
  }
  show("roadmap phases on the pack", phases.length);
  show("roadmap strings reaching the Build Plan", leaked.length ? leaked.slice(0, 4) : "(none)");
  assert.equal(
    leaked.length,
    0,
    `${leaked.length} model-authored roadmap string(s) reached the Build Plan. The schedule is deterministic; a document carrying both has two schedules in it:\n  ${leaked.slice(0, 4).join("\n  ")}`
  );

  // 2 · …and the deterministic schedule that replaced it IS there. Without this
  //     half, deleting the whole schedule section would pass the check above.
  for (const w of ["Kickoff", "The build", "Go-live", "Running it"]) {
    show(`schedule renders "${w}"`, html.includes(w));
    assert(html.includes(w), `the deterministic schedule is missing its "${w}" window`);
  }
});

check("G3b · the leak scan is not vacuous — it CATCHES roadmap prose wired back in", () => {
  // The exclusion above skips anything the catalogue can account for. Prove that
  // exclusion did not swallow the check: feed it a phase objective the catalogue
  // has never heard of, render it, and confirm the same predicate flags it.
  const sentinel =
    "ZZ-ROADMAP-PROSE-SENTINEL stabilise the pipeline and review the intake cadence weekly";
  const catalogueText = WORKFLOWS.flatMap((w) => [w.name, w.whatItDoes, w.whatTheClientSees, w.trigger])
    .concat(PIPELINE.flatMap((s) => [s.stage, s.whatItMeans, s.howALeadArrives, s.howALeadLeaves]))
    .join("\n");
  const html = `<div class="sched-row"><p>${sentinel}</p></div>`;
  const wouldFlag = !catalogueText.includes(sentinel) && html.includes(sentinel);
  show("sentinel excluded by the catalogue filter", catalogueText.includes(sentinel));
  show("sentinel flagged as a leak", wouldFlag);
  assert(wouldFlag, "the catalogue exclusion now swallows model-authored prose — G3 proves nothing");
});

// G4 — DELETED 2026-08-01. It asserted the booking button on the rendered cold
// audit (configured → exactly one cta-book anchor; unconfigured → zero links,
// close intact). The cold audit — renderer, generator, teaser and all — was
// deleted by ruling on 2026-07-29 ("do not improve the cold audit instead of
// deleting it"), so there is no pre-sale artifact left for the close law to run
// on. The paid pack's generated ⇒ rendered discipline is G1–G3 above, untouched.

/* ────────────────────────────────────────────────────────────────────────── */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
