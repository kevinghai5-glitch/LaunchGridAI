/**
 * THE UI AND COPY GUARDS FROM THE gen-2 AUDIT.
 *
 *   node_modules/.bin/tsx scripts/verify-deliverable-ui.ts
 *   npm run verify:deliverable-ui
 *
 * Exits 1 if any guard fails. Two halves, and they are different kinds of thing:
 *
 *   MARKUP  — validateRenderedMarkup() over the three documents, rendered live
 *             from the committed golden pack under several contexts. P0-1 (a
 *             class reaches the DOM with no CSS rule) and P0-2 (a leak card
 *             prints a price with nothing under it) are only visible in the
 *             HTML: the pack is fine, the words are fine, and the page renders
 *             "After hoursCAD $1,200–2,400/mo" glued together in Times New Roman.
 *
 *   COPY    — the audit's structural laws inside validatePack(): bracket tokens,
 *             bare figures in messages, workflow-copy coverage, unmeasured
 *             observations, fabricated proof, the SMS opt-out.
 *
 * WHY EVERY GUARD IS NEGATIVE-TESTED BELOW.
 * A guard that cannot fail is worse than no guard, because it reads as coverage.
 * Each one is therefore fed a deliberately broken input in this script and has to
 * REPORT that input as broken; if it stays silent, this script fails on the guard
 * rather than on the document. The injections are inline and thrown away — no
 * source file is touched — so the negative tests run on every invocation instead
 * of being something somebody did once by hand.
 *
 * WHY IT RENDERS RATHER THAN READING _fixtures/**\/*.html.
 * Those files are renders of deliverables that no longer exist. A guard checked
 * against a stale artifact proves the artifact is stale.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  DELIVERABLES,
  renderDeliverableHtml,
  deliverableContext,
  type DeliverableContext,
} from "../src/lib/exporters/deliverables";
import { validatePack, validateRenderedMarkup } from "../src/lib/exporters/validate-pack";
import type { ValidationCheck } from "../src/lib/exporters/validate-pack";
import { computeAssessment, emptyInputs, LEAKS } from "../src/lib/leak-calculator";
import { DECIDABLE_WORKFLOWS } from "../src/lib/build-decisions";
import type { AssetPack } from "../src/types";

const ROOT = join(__dirname, "..");
const GOLDEN = join(ROOT, "_fixtures/golden-pack.json");

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

if (!existsSync(GOLDEN)) {
  console.error("_fixtures/golden-pack.json is missing — run `npm run sample:golden` first.");
  process.exit(1);
}
const goldenPack = JSON.parse(readFileSync(GOLDEN, "utf8")) as AssetPack;
const clone = (p: AssetPack): AssetPack => JSON.parse(JSON.stringify(p)) as AssetPack;

// ── the renders ──────────────────────────────────────────────────────────────
// Three contexts, not one. A class emitted only inside a conditional branch is
// exactly the class most likely to have lost its rule, so the sweep has to take
// the branches: priced rows AND clean rows, every workflow in AND five taken out,
// a booked kickoff AND an unbooked one, an assessment AND none at all.

/** A real assessment, computed by the shipped model from synthetic answers. */
function assessment(worst: boolean) {
  const inputs = emptyInputs();
  inputs.monthlyEnquiries = 45;
  inputs.avgJobValue = 850;
  for (const l of LEAKS) inputs.answers[l.id] = worst ? l.options.length - 1 : 0;
  // A volunteered row exercises the second, unpriced card shape (P0-2's fix).
  inputs.customRows[0] = { label: "Quotes that never get chased", jobsPerMonth: 3 };
  return computeAssessment(inputs);
}

const CONTEXTS: { name: string; ctx: DeliverableContext }[] = [
  {
    name: "worst answers · everything installed · no kickoff",
    ctx: deliverableContext({ assessment: assessment(true), workflowToggles: null, kickoffAt: null }),
  },
  {
    name: "best answers · everything installed · kickoff booked",
    ctx: deliverableContext({
      assessment: assessment(false),
      workflowToggles: null,
      kickoffAt: new Date("2026-09-01T00:00:00Z"),
    }),
  },
  {
    name: "no assessment · every decidable workflow off",
    ctx: deliverableContext({
      assessment: null,
      workflowToggles: Object.fromEntries(DECIDABLE_WORKFLOWS.map((w) => [w.id, false])),
      kickoffAt: null,
    }),
  },
];

const renders: { name: string; docs: Record<string, string> }[] = CONTEXTS.map(({ name, ctx }) => {
  const docs: Record<string, string> = {};
  for (const d of DELIVERABLES) docs[d.id] = renderDeliverableHtml(goldenPack, d.id, ctx);
  return { name, docs };
});

const allDocs: Record<string, string> = {};
for (const { name, docs } of renders)
  for (const [id, html] of Object.entries(docs)) allDocs[`${id} (${name})`] = html;

// ── report helpers ───────────────────────────────────────────────────────────

const fails = (checks: ValidationCheck[]) => checks.filter((c) => c.level === "fail");
const byLaw = (checks: ValidationCheck[], prefix: string) =>
  checks.filter((c) => c.law.startsWith(prefix));
const firesOn = (checks: ValidationCheck[], prefix: string) =>
  fails(byLaw(checks, prefix)).length > 0;

function report(title: string, checks: ValidationCheck[]): void {
  console.log(`\n${title}`);
  for (const c of checks) {
    const mark = c.level === "fail" ? "FAIL" : c.level === "warn" ? "warn" : "ok  ";
    console.log(`  ${mark}  ${c.law} — ${c.message}`);
  }
}

// ── 1 · MARKUP, over the live renders ────────────────────────────────────────

const markup = validateRenderedMarkup(allDocs);
report("MARKUP · 9 documents (3 contexts × 3 deliverables)", markup);
for (const c of fails(markup)) failures.push(`${c.law}: ${c.message}`);
if (!fails(markup).length) pass += 2;

// ── 2 · COPY, over the golden pack with the rendered text supplied ───────────
// The rendered text is what P1-1's phrase scan reads, for the same reason
// validateRenderedDeliverables supplies it at the export boundary: a law about
// what a client reads has to read the client-facing copy.

const renderedText = Object.values(allDocs)
  .join("\n")
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ");

const packChecks = validatePack(goldenPack, undefined, { renderedText }).checks;
// Only the audit's laws. Every other law in that file is already asserted by
// `npm run check:pack:sample`, and reporting them twice makes one failure look
// like two.
const auditChecks = packChecks.filter((c) => /^P[01]-/.test(c.law));
report("COPY · the golden pack", auditChecks);
for (const c of fails(auditChecks)) failures.push(`${c.law}: ${c.message}`);
if (!fails(auditChecks).length) pass += auditChecks.length;

// ── 3 · NEGATIVE TESTS · prove every guard can fail ──────────────────────────
// Each one breaks a copy of the input in exactly the way the audit describes and
// asserts the guard names it. The `must` helper reads the right way round: the
// guard MUST fire on this.

console.log("\nNEGATIVE TESTS · each guard is handed the regression it exists to catch");

function must(name: string, fired: boolean): void {
  check(`NEG ${name}`, fired, "the guard stayed silent on an injected regression");
  console.log(`  ${fired ? "caught" : "MISSED"}  ${name}`);
}

const diagnosis = renders[0].docs.diagnosis;

// P0-1 · a component renamed in the composer, its stylesheet rule left behind.
must(
  "P0-1 unstyled class — .leak-card renamed to .leak-kard in the markup only",
  firesOn(validateRenderedMarkup({ diagnosis: diagnosis.split('class="leak-card"').join('class="leak-kard"') }), "P0-1 · every")
);

// P0-1 reverse · a rule nothing emits. A warning, never a failure — the shell
// still styles components that a pack saved last year renders.
{
  // Asserted on the COUNT rather than the name: the failure message lists only
  // the first dozen, and the shell legitimately carries more dead selectors than
  // that, so looking for "zz-orphan" in the text would pass or fail by luck.
  const deadCount = (docs: Record<string, string>) =>
    Number(/^(\d+) class selector/.exec(byLaw(validateRenderedMarkup(docs), "P0-1 · dead CSS")[0]?.message ?? "")?.[1] ?? 0);
  const before = deadCount({ diagnosis });
  const after = deadCount({ diagnosis: diagnosis.replace("</style>", ".zz-orphan{color:red}</style>") });
  must(`P0-1 dead CSS — one orphan rule raises the warning count (${before} → ${after})`, after === before + 1);
}

// P0-2 · the audit's leak card 7: a title, a price, and nothing else.
must(
  "P0-2 priced leak card — the answer, consequence and fix stripped out of one card",
  firesOn(
    validateRenderedMarkup({
      diagnosis: diagnosis.replace(
        /(<div class="leak-card"><div class="lc-head">[\s\S]*?<\/div>)[\s\S]*?(<\/div>)/,
        "$1$2"
      ),
    }),
    "P0-2"
  )
);

// P0-3 · the bracket syntax that GoHighLevel sends literally.
{
  const p = clone(goldenPack);
  if (p.workflowCopy?.assets[0]?.messages[0])
    p.workflowCopy.assets[0].messages[0].body = "Hi [Client Name], we got your message.";
  must("P0-3 bracket token — \"[Client Name]\" in a workflow message", firesOn(validatePack(p).checks, "P0-3"));
}

// P0-4 · both directions: a workflow in the build with an empty message table,
// and a copy block for a workflow this client's answers took out.
{
  const emptied = clone(goldenPack);
  if (emptied.workflowCopy) emptied.workflowCopy.assets[0].messages = [];
  must("P0-4 coverage — a workflow in the build with an empty message table", firesOn(validatePack(emptied).checks, "P0-4"));

  const orphaned = clone(goldenPack);
  if (orphaned.workflowCopy) {
    const id = orphaned.workflowCopy.assets[0].workflowId;
    const c = orphaned.workflowCopy.coverage.find((x) => x.workflowId === id);
    if (c) c.inThisBuild = false;
  }
  must("P0-4 coverage — a copy block for a workflow that is NOT in the build", firesOn(validatePack(orphaned).checks, "P0-4"));
}

// P0-5 · the fabricated $50 deposit and the hardcoded 9:00 AM.
{
  const money = clone(goldenPack);
  if (money.file5) money.file5.dayOfReminderSms = "Please pay the deposit of $50 here before we arrive.";
  must("P0-5 bare figure — \"$50\" in a text", firesOn(validatePack(money).checks, "P0-5"));

  const clock = clone(goldenPack);
  if (clock.file5) clock.file5.confirmationEmail.body = "We open again at 9:00 AM and will call you then.";
  must("P0-5 bare figure — \"9:00 AM\" in an email", firesOn(validatePack(clock).checks, "P0-5"));
}

// P1-1 · the cold-audit fabrication: four observations about a site nobody saw.
{
  const p = clone(goldenPack);
  p.meta.signals = {
    websiteScraped: false,
    performanceMeasured: false,
    screenshotsCaptured: false,
    reviewsAnalyzed: true,
    competitorsAnalyzed: true,
    gbpProfilePulled: true,
    verifiedFactsExtracted: true,
  };
  must(
    "P1-1 unmeasured observation — \"What we saw\" notes with every measurement signal off",
    firesOn(validatePack(p, undefined, { renderedText: "What we saw on the homepage." }).checks, "P1-1")
  );
}

// P1-2 · the two republished Google reviews, and the bracketed instruction that
// stood in for a third.
{
  const quoted = clone(goldenPack);
  if (quoted.file3?.emails[0])
    quoted.file3.emails[0].body = 'One of ours put it this way: "The results of my treatment were amazing."';
  must("P1-2 fabricated proof — a quoted testimonial in a nurture email", firesOn(validatePack(quoted).checks, "P1-2"));

  const instructed = clone(goldenPack);
  if (instructed.surfaces?.bookingPage) instructed.surfaces.bookingPage.proofLine = "[Insert verified customer review]";
  must("P1-2 fabricated proof — \"[Insert verified customer review]\" on the booking page", firesOn(validatePack(instructed).checks, "P1-2"));
}

// P1-4 · first contact with no way out of it.
{
  const p = clone(goldenPack);
  if (p.file5) p.file5.dayOfReminderSms = "See you tomorrow — reply here if anything has changed.";
  must("P1-4 SMS opt-out — the opening text of a sequence with no STOP", firesOn(validatePack(p).checks, "P1-4 · SMS opt-out"));

  const long = clone(goldenPack);
  if (long.file5) long.file5.noShowRecoverySms2 = `${"x".repeat(200)} Reply STOP to opt out.`;
  const seg = byLaw(validatePack(long).checks, "P1-4 · SMS segment")[0];
  must("P1-4 SMS segment — a 220-character text is flagged (warning, not a failure)", Boolean(seg && seg.level === "warn"));
}

// ── verdict ──────────────────────────────────────────────────────────────────

console.log(`\n${pass} check(s) passed.`);
if (failures.length) {
  console.error(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log("verify:deliverable-ui — clean.");
