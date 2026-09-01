// Verifies the intake screen — one screen, three groups, thirteen inputs, one
// button — and that the machinery it replaced is actually gone.
// Run: node_modules/.bin/tsx scripts/verify-intake-screen.ts
//
// The control count is asserted, not described. A screen that grows a fourteenth
// switch is the failure this file exists to catch.

import { WORKFLOWS } from "../src/lib/workflow-catalogue";
import {
  DECIDABLE_WORKFLOWS,
  ALWAYS_INSTALLED_COUNT,
  OFF_WHEN,
  readDecisions,
  suggestedDecisions,
} from "../src/lib/build-decisions";
import { LEAKS } from "../src/lib/leak-calculator";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

let pass = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
function eq(name: string, a: unknown, b: unknown): void {
  check(name, Object.is(a, b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
const ROOT = join(__dirname, "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");
const gone = (p: string): boolean => !existsSync(join(ROOT, p));

// ── A · Nine install silently, five are decisions ───────────────────────────
eq("A1 fourteen workflows total", WORKFLOWS.length, 14);
eq("A2 exactly five decisions", DECIDABLE_WORKFLOWS.length, 5);
eq("A3 exactly nine always install", ALWAYS_INSTALLED_COUNT, 9);
for (const id of ["social-dm-capture", "text-to-pay", "database-reactivation", "review-response", "webchat-capture"]) {
  check(`A4 ${id} is a decision`, DECIDABLE_WORKFLOWS.some((w) => w.id === id));
  check(`A5 ${id} states the one fact that removes it`, Boolean(OFF_WHEN[id]?.length));
}
// The nine must never appear as controls. Derived from the catalogue, so
// reclassifying a workflow moves it automatically and cannot leave the two lists
// disagreeing.
check(
  "A6 no every_build workflow is decidable",
  DECIDABLE_WORKFLOWS.every((w) => w.applicability.kind !== "every_build")
);
check(
  "A7 webchat is a decision, not an every_build with a footnote",
  WORKFLOWS.find((w) => w.id === "webchat-capture")?.applicability.kind === "operator_only",
  "it is decided at install, so a screen that shows it as settled is lying"
);

// ── B · THE CONTROL COUNT ───────────────────────────────────────────────────
// 2 numbers + 6 answers + 5 switches = 13 inputs, plus 1 button.
const INPUTS = 2 + LEAKS.length + DECIDABLE_WORKFLOWS.length;
eq("B1 thirteen inputs", INPUTS, 13);
eq("B2 six answers", LEAKS.length, 6);
check("B3 fourteen controls including the button", INPUTS + 1 === 14);
check("B4 under the fifteen-control ceiling", INPUTS + 1 <= 15, `${INPUTS + 1} controls`);

// ── C · Defaults and suggestions ────────────────────────────────────────────
{
  const d = readDecisions(null);
  check("C1 every decision defaults ON", Object.values(d).every((v) => v === true));
  eq("C2 exactly five keys", Object.keys(d).length, 5);
  const stored = readDecisions({ "text-to-pay": false, "not-a-workflow": true });
  check("C3 a stored off is honoured", stored["text-to-pay"] === false);
  check("C4 an unknown key is ignored", !("not-a-workflow" in stored));
}
{
  // The four an intake answer can speak to. Webchat is deliberately absent.
  const s = suggestedDecisions({
    socialEnquiries: "NO_ACCOUNTS", takesDeposits: "NEVER",
    pastCustomerContact: "NEVER", reviewReplyOwner: "OWNER",
  });
  eq("C5 four suggestions from intake", Object.keys(s).length, 4);
  check("C6 all four suggest OFF", Object.values(s).every((v) => v === false));
  check("C7 webchat is never suggested — nothing on a form can answer it", !("webchat-capture" in s));
  eq("C8 an ambiguous intake suggests nothing", Object.keys(suggestedDecisions({})).length, 0);
  // Only the unambiguous answer flips it: "sometimes" is not "never".
  eq("C9 SOMETIMES does not switch text-to-pay off", Object.keys(suggestedDecisions({ takesDeposits: "SOMETIMES" })).length, 0);
}

// ── D · The deleted machinery is actually gone ──────────────────────────────
for (const p of [
  "src/components/businesses/ClientDrawer.tsx",
  "src/components/businesses/IntakeGaps.tsx",
  "src/components/businesses/WorkflowPanel.tsx",
  "src/components/businesses/IntakeForm.tsx",
  "src/app/api/leak-gaps/route.ts",
  "src/app/api/workflow-toggles/route.ts",
]) {
  check(`D1 deleted: ${p}`, gone(p));
}
// And nothing still imports them.
for (const page of [
  "src/app/(dashboard)/businesses/[id]/page.tsx",
  "src/app/(dashboard)/library/page.tsx",
  "src/app/(dashboard)/studio/page.tsx",
]) {
  const src = read(page);
  check(`D2 ${page} imports no deleted component`,
    !/ClientDrawer|IntakeGaps|WorkflowPanel|IntakeForm/.test(src));
}

// ── E · The screen itself ───────────────────────────────────────────────────
{
  const page = read("src/app/(dashboard)/library/[id]/intake/page.tsx");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const code = strip(page);

  check("E1 the five switches are derived, never hand-listed",
    /DECIDABLE_WORKFLOWS\.map/.test(code),
    "a hand-written list would drift from the catalogue");
  check("E2 the six answers are derived from LEAKS", /LEAKS\.map/.test(code));
  // The lookbehind matters: DECIDABLE_WORKFLOWS.map is the five, and is correct.
  // Only a bare WORKFLOWS.map would put all fourteen on screen.
  check("E3 the always-installed nine are a count, not a list",
    /ALWAYS_INSTALLED_COUNT/.test(code) && !/(?<![A-Z_])WORKFLOWS\.map/.test(code));
  check("E4 one submit button", (code.match(/saveAndGenerate/g) ?? []).length >= 1);
  // The screen must not resurrect what was deleted.
  for (const ghost of ["Didn't ask", "didn't ask", "not asked yet", "no finding fired", "guessed"]) {
    check(`E5 no gap-hedging language: "${ghost}"`, !code.includes(ghost));
  }
  check("E6 it says the numbers come from the calculator", /From the calculator/.test(page));
}

// ── E7 · Both working screens live UNDER /library ────────────────────────────
// The sidebar marks a nav item active with pathname.startsWith(item.href), so a
// page at /businesses/[id]/intake lights up OPPORTUNITIES — the intake screen
// appeared to live in the prospecting section, and getting to it meant detouring
// through the business record page. Path placement IS the navigation here.
check(
  "E7a the intake screen is under /library",
  existsSync(join(ROOT, "src/app/(dashboard)/library/[id]/intake/page.tsx"))
);
check(
  "E7b the calculator is under /library",
  existsSync(join(ROOT, "src/app/(present)/library/[id]/calculator/page.tsx"))
);
check(
  "E7c neither is left under /businesses",
  gone("src/app/(dashboard)/businesses/[id]/intake/page.tsx") &&
    gone("src/app/(dashboard)/businesses/[id]/calculator/page.tsx"),
  "a page under /businesses highlights Opportunities in the sidebar"
);
{
  const lib = read("src/app/(dashboard)/library/page.tsx");
  check(
    "E7d the Library links at /library, never /businesses",
    /href=\{`\/library\/\$\{b\.id\}\/(intake|calculator)`\}/.test(lib) &&
      !/href=\{`\/businesses\/\$\{b\.id\}\/(intake|calculator)`\}/.test(lib)
  );
  const biz = read("src/app/(dashboard)/businesses/[id]/page.tsx");
  check(
    "E7e the business record page links to neither",
    !/\/calculator`/.test(biz) && !/\/intake`/.test(biz),
    "the work starts in the Library; the record page is not on the path"
  );
}

// ── F · One save, two destinations, one source of truth ─────────────────────
{
  const route = read("src/app/api/intake/[businessId]/route.ts");
  check("F1 answers write back to the assessment", /leakAssessment\.upsert/.test(route));
  check("F2 a corrected answer recomputes the money", /computeAssessment\(inputs\)/.test(route));
  check("F3 decisions write to the business row", /workflowToggles:/.test(route));
  check("F4 both writes are one transaction", /\$transaction\(\[/.test(route),
    "a half-saved intake would leave the money and the build disagreeing");
  check("F5 only the five decidable workflows are writable",
    /for \(const w of DECIDABLE_WORKFLOWS\)/.test(route),
    "a stray key for one of the nine must be dropped, not honoured");
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-intake-screen: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-intake-screen: ${pass} assertions passed`);
console.log(`  controls: ${INPUTS} inputs + 1 button = ${INPUTS + 1}`);
