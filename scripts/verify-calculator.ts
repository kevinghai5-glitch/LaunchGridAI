// Verifies the leak calculator — the arithmetic and the five behaviours the
// owner named as non-negotiable when the standalone HTML was ported.
// Run: node_modules/.bin/tsx scripts/verify-calculator.ts
//
// Hermetic: pure functions only, no DB, no network. Runs on a fresh clone.

import {
  LEAKS,
  computeAssessment,
  emptyInputs,
  roundFigure,
  rangeText,
  money,
  CUSTOM_ROW_COUNT,
  type CalculatorInputs,
} from "../src/lib/leak-calculator";
import { readFileSync } from "fs";
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

/** A filled sheet: 60 enquiries, $3,000 a job, all six answered at the WORST
 *  option. Deliberately extreme — this one trips the plausibility cap, which
 *  makes it the right fixture for proving the ledger still reconciles once the
 *  cap has compressed every row. */
function filled(over: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    ...emptyInputs(),
    monthlyEnquiries: 60,
    avgJobValue: 3000,
    answers: { after: 2, missed: 2, speed: 2, quote: 2, noshow: 2, reactivate: 2 },
    ...over,
  };
}

/** The same business answering mildly — a leak in every area, but a credible
 *  one, so the cap does NOT fire. Use this to test the overlap discount on its
 *  own: under the cap, k is whatever the cap computes and the overlap setting no
 *  longer moves the total. */
function mild(over: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    ...filled(),
    answers: { after: 1, missed: 1, speed: 1, quote: 1, noshow: 1, reactivate: 1 },
    ...over,
  };
}

// ── A · The model is the six questions, ported intact ────────────────────────
eq("A1 exactly six questions", LEAKS.length, 6);
for (const id of ["after", "missed", "speed", "quote", "noshow", "reactivate"]) {
  check(`A2 ${id} present`, LEAKS.some((l) => l.id === id));
}
eq("A3 exactly two custom rows", CUSTOM_ROW_COUNT, 2);
check("A4 every option carries a consequence line", LEAKS.every((l) => l.options.every((o) => o.consequence.length > 0)));
check("A5 every leak carries a fix line", LEAKS.every((l) => l.fix.length > 0));
check("A6 the first option of every leak is the clean one", LEAKS.every((l) => {
  const o = l.options[0];
  const band = o.band ?? o.jobsPerYear ?? [0, 0];
  return band[0] === 0 && band[1] === 0;
}));
// The no-show row prices off a show factor, not the close rate — an already
// booked job does not get re-filtered through the enquiry close rate.
eq("A7 the no-show row overrides the close rate", LEAKS.find((l) => l.id === "noshow")?.showFactor, 0.5);
check("A8 the reactivation row is stock-based, not flow-based", LEAKS.find((l) => l.id === "reactivate")?.stock === true);

// ── B · ROWS RECONCILE WITH THE TOTAL (the ledger law) ───────────────────────
// A prospect who adds the column must land exactly on the bottom line. This is
// the reason the total is summed from the ROUNDED row figures rather than
// computed from unrounded ones and rounded at the end.
{
  const r = computeAssessment(filled());
  const sumLow = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyLow ?? 0), 0);
  const sumHigh = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyHigh ?? 0), 0);
  eq("B1 rows sum EXACTLY to the total (low)", sumLow, r.totalLow);
  eq("B2 rows sum EXACTLY to the total (high)", sumHigh, r.totalHigh);
  check("B3 the total is non-zero on a filled sheet", r.totalHigh > 0, `total ${r.totalLow}–${r.totalHigh}`);
}
// Same law with custom rows in play, and at a different scale.
{
  const r = computeAssessment(filled({
    monthlyEnquiries: 200, avgJobValue: 7500,
    customRows: [{ label: "Van wraps", jobsPerMonth: 1 }, { label: "Referrals", jobsPerMonth: 0.5 }],
  }));
  const sumLow = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyLow ?? 0), 0);
  const sumHigh = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyHigh ?? 0), 0);
  eq("B4 rows still sum exactly with custom rows (low)", sumLow, r.totalLow);
  eq("B5 rows still sum exactly with custom rows (high)", sumHigh, r.totalHigh);
  check("B6 custom rows are priced", (r.customRows[0].monthlyHigh ?? 0) > 0);
}
// And across a spread of shapes, because rounding drift is the failure mode.
{
  let allReconcile = true;
  for (const vol of [7, 23, 60, 140, 400]) {
    for (const jv of [450, 900, 3000, 12000]) {
      const r = computeAssessment(filled({ monthlyEnquiries: vol, avgJobValue: jv }));
      const s = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyLow ?? 0), 0);
      const h = [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyHigh ?? 0), 0);
      if (s !== r.totalLow || h !== r.totalHigh) allReconcile = false;
    }
  }
  check("B7 reconciles across 20 different business shapes", allReconcile);
}

// ── C · The overlap discount is applied AND disclosed ────────────────────────
{
  const r = computeAssessment(mild());
  check("C0 the mild fixture is below the cap", !r.capped);
  eq("C1 the default overlap is applied at 30%", r.overlapAppliedPct, 30);
  check("C2 the overlap is stated in the derivation the prospect reads",
    /cut 30%/.test(r.derivation) && /more than one/.test(r.derivation), r.derivation);
  // Removing the overlap must raise the total — proof it is actually applied.
  const less = computeAssessment(mild({ overlapPct: 0 }));
  check("C3 removing the overlap raises the total", less.totalHigh > r.totalHigh,
    `0% → ${less.totalHigh}, 30% → ${r.totalHigh}`);
  eq("C4 no overlap means no cut disclosed", less.overlapAppliedPct, 0);
  // And the ledger law holds at every overlap setting.
  const s = [...less.rows, ...less.customRows].reduce((a, x) => a + (x.monthlyLow ?? 0), 0);
  eq("C5 reconciles with the overlap off", s, less.totalLow);
}

// ── D · The plausibility cap fires and is labelled ───────────────────────────
{
  // A small shop with a huge job value: the raw leak would exceed a credible
  // share of revenue, so the cap must compress it and say so.
  const r = computeAssessment(filled({ monthlyEnquiries: 8, avgJobValue: 20000, capPct: 20 }));
  check("D1 the cap fires on an implausible total", r.capped, `capped=${r.capped}`);
  check("D2 the capped total still reconciles",
    [...r.rows, ...r.customRows].reduce((a, x) => a + (x.monthlyLow ?? 0), 0) === r.totalLow);
  const uncapped = computeAssessment(mild());
  check("D3 a plausible total is NOT capped", !uncapped.capped);
  // The cap is a ceiling, not a floor: it only ever reduces.
  check("D4 the cap only compresses", r.overlapAppliedPct >= 30,
    `cut ${r.overlapAppliedPct}% — a fired cap must cut at least as hard as the overlap alone`);
}

// ── E · Clean answers, and the all-clean outcome ─────────────────────────────
{
  const r = computeAssessment(filled({ answers: { after: 0, missed: 0, speed: 0, quote: 0, noshow: 0, reactivate: 0 } }));
  check("E1 every row reads clean", r.rows.every((x) => x.clean));
  eq("E2 the total is zero", r.totalHigh, 0);
  check("E3 allClean is set", r.allClean);
  // The honest-disqualify path: a specific, deliberate message — not an empty
  // page and not an error.
  check("E4 the all-clean state says so plainly",
    /came back covered/.test(r.derivation) && /nothing is leaking/.test(r.derivation), r.derivation);
  check("E5 a clean row carries no figure", r.rows.every((x) => x.monthlyLow === null));
}
// Mixed: some clean, some leaking.
{
  const r = computeAssessment(filled({ answers: { after: 0, missed: 2, speed: 0, quote: 2, noshow: 0, reactivate: 2 } }));
  eq("E6 three areas clean", r.cleanCount, 3);
  check("E7 not flagged all-clean when something leaks", !r.allClean);
  check("E8 the clean count is disclosed", /3 areas came back clean/.test(r.derivation), r.derivation);
}

// ── F · "Don't know" prices at the second-worst band and is labelled ─────────
for (const id of ["after", "missed", "speed", "noshow"]) {
  const leak = LEAKS.find((l) => l.id === id)!;
  const assumedIdx = leak.options.findIndex((o) => o.assumed);
  check(`F1 ${id} has a "don't know" option`, assumedIdx >= 0);
  const bands = leak.options.map((o) => (o.band ?? [0, 0])[1]);
  const sorted = [...bands].sort((a, b) => b - a);
  eq(`F2 ${id} prices "don't know" at the second-worst band`, bands[assumedIdx], sorted[1]);
}
{
  const r = computeAssessment(filled({ answers: { after: 3, missed: 3, speed: 3, quote: 2, noshow: 3, reactivate: 2 } }));
  eq("F3 four assumed answers counted", r.assumedCount, 4);
  check("F4 assumed rows are flagged for the screen", r.rows.filter((x) => x.assumed).length === 4);
  check("F5 the assumed count is disclosed", /4 rows marked assumed/.test(r.derivation), r.derivation);
}

// ── G · Nothing is priced until both numbers are present ─────────────────────
{
  const r = computeAssessment({ ...emptyInputs(), answers: { after: 2, missed: 2, speed: 2, quote: 2, noshow: 2, reactivate: 2 } });
  check("G1 not ready without the two numbers", !r.ready);
  eq("G2 no total without them", r.totalHigh, 0);
  check("G3 it asks for them plainly", /Add your two numbers/.test(r.derivation), r.derivation);
  check("G4 no row carries a figure", r.rows.every((x) => x.monthlyLow === null));
}
{
  const r = computeAssessment(filled({ avgJobValue: null }));
  check("G5 one number alone is not enough", !r.ready && r.totalHigh === 0);
}

// ── H · Rounding reads as an estimate ────────────────────────────────────────
eq("H1 under 800 rounds to 50", roundFigure(437), 450);
eq("H2 800–4000 rounds to 100", roundFigure(1234), 1200);
eq("H3 over 4000 rounds to 500", roundFigure(7340), 7500);
eq("H4 range formatting drops the second dollar sign", rangeText(1200, 2400), "$1,200–2,400");
eq("H5 money is CAD-grouped", money(18500), "$18,500");

// ── I · The page is written for the prospect ─────────────────────────────────
// Screen-shared live, so a single operator-facing phrase is a real defect.
{
  const page = read("src/app/(dashboard)/library/[id]/calculator/page.tsx");
  const lib = read("src/lib/leak-calculator.ts");
  // Only the rendered strings matter — comments explain the rule and legitimately
  // name it. Strip them before scanning.
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const rendered = strip(page) + strip(lib);
  for (const phrase of ["their answers", "the operator", "the prospect", "Kevin", "sales call", "screen-share"]) {
    check(`I1 no operator-facing phrase: "${phrase}"`, !new RegExp(phrase, "i").test(rendered));
  }
  // The four measured values carry no money and no severity.
  check("I2 the measured block states no dollar figure",
    /No dollar figures on these/.test(page));
  for (const severity of ["worth_fixing", "severity", "critical", "urgent"]) {
    check(`I3 no severity language on the page: "${severity}"`, !new RegExp(severity, "i").test(strip(page)));
  }
}

// ── J · The saved figure is what downstream reads ────────────────────────────
{
  const route = read("src/app/api/leak-assessment/[businessId]/route.ts");
  check("J1 saving computes server-side", /computeAssessment\(inputs\)/.test(route));
  check("J2 the computed result is frozen onto the row", /computed:\s*computed as unknown as object/.test(route));
  check("J3 reads return the FROZEN result, not a recomputation",
    /computed:\s*row\.computed/.test(route),
    "a read must not re-run the maths — that is what makes the documents agree");
  const schema = read("prisma/schema.prisma");
  check("J4 one assessment per business", /businessId String @unique/.test(schema));
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-calculator: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-calculator: ${pass} assertions passed`);
