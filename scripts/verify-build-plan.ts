// PHASE 3 PROOF — the two client documents.
//
//   node_modules/.bin/tsx scripts/verify-build-plan.ts
//   npm run verify:build-plan
//
// Every check prints its inputs before it asserts. Exits 1 if any fails.
//
// WHAT THIS PROTECTS:
//
//   A. ONE SOURCE FOR THE MONEY — the Diagnosis and the offer page print the
//      same total, because they read the same frozen row. Never recomputed.
//   B. NO SILENT OMISSION — every workflow is in exactly one of three states,
//      each stated, and "nothing was left out" is said in words when true.
//   C. NO IMPLIED START DATE — an unbooked kickoff renders relative windows and
//      a visible note, never an invented date and never a hidden section.
//   D. THE TWO DOCUMENTS ARE THE CLIENT BUNDLE — the Asset Pack is internal.

import assert from "node:assert";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import {
  buildPlan,
  buildDates,
  BUILD_DAYS,
  PENDING_WORKFLOW_ID,
  type BuildPlanItem,
} from "../src/lib/build-plan";
import {
  DELIVERABLES,
  CLIENT_DELIVERABLES,
  renderDeliverableHtml,
  deliverableContext,
} from "../src/lib/exporters/deliverables";
import { WORKFLOWS } from "../src/lib/workflow-catalogue";
import { DECIDABLE_WORKFLOWS, ALWAYS_INSTALLED_COUNT } from "../src/lib/build-decisions";
import { computeAssessment, emptyInputs, LEAKS } from "../src/lib/leak-calculator";
import { buildClientOffer } from "../src/lib/client-offer";
import { ClientOffer } from "../src/components/client/ClientOffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssetPack } from "../src/types";

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
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const text = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

const GOLDEN = "_fixtures/golden-pack.json";
const goldenPack = existsSync(join(ROOT, GOLDEN))
  ? (JSON.parse(read(GOLDEN)) as AssetPack)
  : null;

const BUSINESS = { name: "Harbourline Air", industry: "HVAC", city: "Dartmouth" };

/** A real assessment, computed by the shipped model from synthetic answers. */
function assessment(worst: boolean) {
  const inputs = emptyInputs();
  inputs.monthlyEnquiries = 45;
  inputs.avgJobValue = 850;
  for (const l of LEAKS) inputs.answers[l.id] = worst ? l.options.length - 1 : 0;
  return computeAssessment(inputs);
}

// ── A · ONE SOURCE FOR THE MONEY ────────────────────────────────────────────
// His verification point 6: prove the Diagnosis and the offer page show an
// identical total, from one source. Not "two code paths that agree today" — the
// SAME object, threaded to both, so they cannot diverge.
if (!goldenPack) {
  failures.push("A0 the golden pack fixture is missing — section A cannot run");
} else {
  const a = assessment(true);

  const offer = buildClientOffer({ business: BUSINESS, computed: a, workflowToggles: {} })!;
  const offerHtml = text(renderToStaticMarkup(createElement(ClientOffer, { offer })));

  const diagHtml = text(
    renderDeliverableHtml(goldenPack, "diagnosis", deliverableContext({
      assessment: a,
      workflowToggles: null,
      kickoffAt: null,
    }))
  );

  // The exact string a client reads on each surface.
  const wantTotal = `CAD $${a.totalLow.toLocaleString("en-CA")}`;
  check("A1 the offer page prints the total", offerHtml.includes(wantTotal), wantTotal);
  check("A2 the Diagnosis prints the SAME total", diagHtml.includes(wantTotal), wantTotal);

  // Every row figure too, not just the headline — a total that agrees while the
  // rows disagree is the ledger bug the calculator was built to end.
  const rowFigures = a.rows
    .filter((r) => r.monthlyLow !== null && r.monthlyHigh !== null && !r.clean)
    .map((r) => `CAD $${(r.monthlyLow as number).toLocaleString("en-CA")}`);
  const missingOnOffer = rowFigures.filter((f) => !offerHtml.includes(f));
  const missingOnDiag = rowFigures.filter((f) => !diagHtml.includes(f));
  eq("A3 every row figure reaches the offer page", missingOnOffer.length, 0);
  eq("A4 every row figure reaches the Diagnosis", missingOnDiag.length, 0);

  // And the Diagnosis never recomputes: the assembler it uses imports no
  // computeAssessment, and the renderer reads ctx.assessment rather than the pack.
  const src = strip(read("src/lib/exporters/deliverables.ts"));
  check(
    "A5 the Diagnosis renderer reads the threaded assessment",
    /ctx\.assessment/.test(src),
    "it must read the live frozen row, not a copy baked into the pack"
  );
  check(
    "A6 the deliverables module never recomputes an assessment",
    !/computeAssessment\(/.test(src),
    "recomputing would requote a client who already agreed a number"
  );

  // The identical-source claim, made structurally: change the assessment and
  // BOTH surfaces move together.
  const b = assessment(false);
  const offer2 = buildClientOffer({ business: BUSINESS, computed: b, workflowToggles: {} })!;
  const offerHtml2 = text(renderToStaticMarkup(createElement(ClientOffer, { offer: offer2 })));
  const diagHtml2 = text(
    renderDeliverableHtml(goldenPack, "diagnosis", deliverableContext({
      assessment: b, workflowToggles: null, kickoffAt: null,
    }))
  );
  check("A7 an all-clean assessment reads as no leak on the offer page", /No leak/i.test(offerHtml2));
  check("A8 an all-clean assessment reads as no leak on the Diagnosis", /No leak/i.test(diagHtml2));
  check(
    "A9 neither surface prints the priced total when the assessment is clean",
    !offerHtml2.includes(wantTotal) && !diagHtml2.includes(wantTotal)
  );

  // No assessment at all: the Diagnosis says so rather than padding.
  const none = text(
    renderDeliverableHtml(goldenPack, "diagnosis", deliverableContext({
      assessment: null, workflowToggles: null, kickoffAt: null,
    }))
  );
  check("A10 with no assessment the Diagnosis says so", /has not been saved/i.test(none));
  check(
    "A11 …and invents no figure to fill the space",
    (none.match(/CAD \$[\d,]+/g) ?? []).length === 0,
    (none.match(/CAD \$[\d,]+/g) ?? []).join(" ")
  );
}

// ── B · NO SILENT OMISSION ──────────────────────────────────────────────────
{
  // Default: nothing switched off.
  const all = buildPlan(null, null);
  eq("B1 every workflow is in exactly one state",
    all.installed.length + all.pending.length + all.off.length, WORKFLOWS.length);
  eq("B2 nothing is off by default", all.off.length, 0);
  check("B3 nothingOff is true", all.nothingOff);
  eq("B4 webchat is the only pending one", all.pending.length, 1);
  eq("B5 …and it is webchat", all.pending[0]?.id, PENDING_WORKFLOW_ID);

  // Every non-installed item carries a reason. This is the law.
  const nonInstalled: BuildPlanItem[] = [...all.pending, ...all.off];
  check("B6 every non-installed item states a reason",
    nonInstalled.every((i) => Boolean(i.note && i.note.trim().length > 10)),
    nonInstalled.filter((i) => !i.note?.trim()).map((i) => i.id).join(" "));
  check("B7 installed items carry no reason (there is nothing to explain)",
    all.installed.every((i) => i.note === undefined));

  // Switch everything decidable off.
  const offAll: Record<string, boolean> = {};
  for (const w of DECIDABLE_WORKFLOWS) offAll[w.id] = false;
  const stripped = buildPlan(offAll, null);
  eq("B8 only the five can be switched off", stripped.off.length, DECIDABLE_WORKFLOWS.length);
  eq("B9 the nine always survive", stripped.installed.length, ALWAYS_INSTALLED_COUNT);
  check("B10 nothingOff is false", !stripped.nothingOff);
  eq("B11 webchat switched off is OFF, not pending", stripped.pending.length, 0);
  check("B12 every off item states its reason",
    stripped.off.every((i) => Boolean(i.note?.trim())));

  // A forged toggle for one of the nine is ignored.
  const forged = buildPlan({ "instant-lead-response": false }, null);
  eq("B13 a forged toggle for an always-installed workflow is ignored", forged.off.length, 0);

  if (goldenPack) {
    // THE RENDERED PAGE — all three states must be visible, in words.
    const render = (toggles: Record<string, boolean> | null): string =>
      renderDeliverableHtml(goldenPack, "build-plan",
        deliverableContext({ assessment: null, workflowToggles: toggles, kickoffAt: null }));
    const titles = (html: string): string[] =>
      Array.from(html.matchAll(/<h2>([^<]+)<\/h2>/g), (m) => m[1]);

    const allOn = text(render(null));
    const allOnTitles = titles(render(null));

    // B14/B15 REWRITTEN 2026-08-13 (P3-1). They used to assert an unconditional
    // block reading "Nothing has been left out. All 14 workflows are installed"
    // — a completeness claim printed even when the page underneath it showed a
    // workflow that was NOT installed. P3-1 deleted the block and made the
    // exclusion section conditional, so there is no fixed sentence left to look
    // for. What replaces it is the rule the block was a bad proxy for: the
    // document may only claim an exclusion when it HAS one, and every count it
    // prints must come off the same resolved set.
    //
    // The audit words the title rule in three states. Two of them ship as
    // written; the third does not, and the deviation is deliberate:
    //   off > 0                 → "What Is Not Installed, and Why"
    //   off = 0, pending > 0    → no exclusion section. The audit's title for
    //                             this state, "One Thing We Confirm During the
    //                             Build", was written when §02 WAS the workflow
    //                             list. §01 now carries every in-build workflow,
    //                             so a section here would print the pending card
    //                             a second time (P3-4's defect). The state's
    //                             content ships instead as §01's caveat
    //                             paragraph and the card's own "Confirmed during
    //                             the build" marker — both asserted below, so
    //                             moving it did not lose it.
    //   off = 0, pending = 0    → no section. Unreachable today and asserted as
    //                             unreachable, because webchat is always in one
    //                             of the two states above.
    const EXCLUSION_TITLE = "What Is Not Installed, and Why";
    check("B14 no exclusion section when nothing is excluded",
      !allOnTitles.includes(EXCLUSION_TITLE), allOnTitles.join(" | "));
    check("B14b …and the state is the one the audit calls pending-only",
      all.off.length === 0 && all.pending.length > 0);
    check("B14c …so the caveat is said in §01 instead of being dropped",
      /confirmed during the build/i.test(allOn));
    check("B14d 'nothing left out' is never claimed, in any state",
      !/Nothing has been left out/i.test(allOn));
    check("B14e the third state — nothing off AND nothing pending — cannot be reached",
      all.pending.length + all.off.filter((i) => i.id === PENDING_WORKFLOW_ID).length === 1,
      "webchat is pending or off; a build with neither would suppress the section untested");

    // B15 · every count printed on the page comes off the resolved set. The old
    // check pinned one sentence; this pins all of them, which is the thing that
    // actually went wrong (13 in one section, 14 in another).
    const printedCounts = Array.from(
      allOn.matchAll(/(\d+) of (?:the )?(\d+)\b/g),
      (m) => `${m[1]}/${m[2]}`
    );
    const inBuildCount = all.installed.length + all.pending.length;
    check("B15 the count on the page is installed+pending out of the whole catalogue",
      printedCounts.length > 0 &&
        printedCounts.every((c) => c === `${inBuildCount}/${WORKFLOWS.length}`),
      `printed ${JSON.stringify(printedCounts)}, resolved ${inBuildCount}/${WORKFLOWS.length}`);
    check("B15b …and the pending one is inside that count, not excluded from it",
      inBuildCount === WORKFLOWS.length);

    check("B16 the pending one is named on the page",
      allOn.includes(WORKFLOWS.find((w) => w.id === PENDING_WORKFLOW_ID)!.name));
    check("B17 …with its reason", /needs a small snippet/i.test(allOn));

    const someOff = text(render(offAll));
    const someOffTitles = titles(render(offAll));
    check("B18 the not-installed heading appears when something IS off",
      /Not installed for you/i.test(someOff));
    check("B18b …under the conditional section title, which only this state gets",
      someOffTitles.includes(EXCLUSION_TITLE), someOffTitles.join(" | "));
    check("B18c …and its counts come off the same resolved set",
      someOff.includes(`${stripped.installed.length + stripped.pending.length} of ${WORKFLOWS.length}`) &&
        someOff.includes(`${stripped.off.length} of the ${WORKFLOWS.length}`));
    check("B19 'nothing left out' is NOT claimed when something is off",
      !/Nothing has been left out/i.test(someOff));
    for (const w of stripped.off) {
      check(`B20 ${w.id} is named on the page`, someOff.includes(w.name));
      check(`B21 ${w.id}'s reason is on the page`, someOff.includes(w.note!));
    }
  }
}

// ── C · NO IMPLIED START DATE ───────────────────────────────────────────────
{
  const unbooked = buildDates(null);
  check("C1 unbooked is not anchored", !unbooked.anchored);
  check("C2 unbooked carries a visible note", unbooked.note.length > 40);
  check("C3 the note says dates are not set", /not booked yet/i.test(unbooked.note));
  check("C4 windows are relative to kickoff", unbooked.buildWindow.includes("from kickoff"));
  // The WHEN column must not repeat the row title beside it — an unbooked plan
  // rendered "Kickoff Kickoff" until this was pinned.
  check("C4b the kickoff column does not repeat the row title", unbooked.kickoff !== "Kickoff", unbooked.kickoff);
  check("C5 no calendar date is invented",
    !/\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/.test(
      [unbooked.kickoff, unbooked.buildWindow, unbooked.goLive, unbooked.runningFrom, unbooked.note].join(" ")
    ));

  const booked = buildDates(new Date("2026-09-01T00:00:00Z"));
  check("C6 booked is anchored", booked.anchored);
  eq("C7 kickoff is the given date", booked.kickoff, "1 September 2026");
  eq("C8 go-live is exactly BUILD_DAYS later", booked.goLive, "15 September 2026");
  eq("C9 …and BUILD_DAYS is the fourteen quoted everywhere", BUILD_DAYS, 14);
  eq("C10 a booked plan shows no note", booked.note, "");
  check("C11 a booked plan carries no relative wording",
    ![booked.kickoff, booked.buildWindow, booked.goLive, booked.runningFrom].some((s) =>
      /from kickoff|after kickoff/i.test(s)));

  if (goldenPack) {
    const html = text(renderDeliverableHtml(goldenPack, "build-plan",
      deliverableContext({ assessment: null, workflowToggles: null, kickoffAt: null })));
    check("C12 the unbooked page SHOWS the schedule section", /The Schedule/i.test(html));
    check("C13 …and the caveat is on it", /Dates are not set yet/i.test(html));
    check("C14 …and it still prints both prices",
      html.includes("CAD $6,500") && html.includes("CAD $1,000"));
  }
}

// ── D · THE CLIENT BUNDLE IS THE TWO ────────────────────────────────────────
{
  eq("D1 three documents exist", DELIVERABLES.length, 3);
  eq("D2 two go to the client", CLIENT_DELIVERABLES.length, 2);
  check("D3 the Asset Pack is the internal one",
    DELIVERABLES.find((d) => d.id === "asset-pack")?.audience === "internal");
  check("D4 the two client documents are the Diagnosis and the Build Plan",
    CLIENT_DELIVERABLES.map((d) => d.id).join(",") === "diagnosis,build-plan");
  const idx = read("src/lib/exporters/index.ts");
  // ALL THREE ship in the ZIP. The ZIP is the operator's download; he decides
  // what to forward. Bundling only the two meant the Asset Pack — which is meant
  // to go out at go-live — never reached him at all.
  check("D5 the ZIP bundles every document", /for \(const d of DELIVERABLES\) \{\n\s*const name =/.test(idx),
    "the operator cannot send at go-live what he was never given");
  check("D6 the internal one is prefixed so it cannot be forwarded by accident",
    /INTERNAL-\$\{d\.filename\}/.test(idx));
  check("D7 all three are rendered and validated",
    /for \(const d of DELIVERABLES\) html\[d\.id\] = renderDeliverableHtml/.test(idx),
    "the Asset Pack reaches the client at go-live, so it is held to the same laws");
}

// ── E · NO STALE DOCUMENT ID CAN CRASH A VIEW ───────────────────────────────
// The bug this section exists for, because it actually happened: renaming the
// deliverable ids (d1..d4 -> diagnosis/build-plan/asset-pack) left a third
// hand-written copy of the document list in the Library, which kept linking
// ?deliverable=d1. Studio cast that string straight to a DeliverableId, the tab
// lookup found nothing, and the preview died on `activeTab.subtitle`.
{
  // Comments stripped FIRST. The doc comment above the fix quotes the broken
  // expression verbatim ("TABS.find(...)! turned that into a crash"), and a scan
  // that reads it flags the fix as the bug — a check must not fail on its own
  // documentation.
  const view = strip(read("src/components/businesses/AssetPackView.tsx"));
  const lib = strip(read("src/app/(dashboard)/library/page.tsx"));
  const studio = strip(read("src/app/(dashboard)/studio/page.tsx"));

  // Line-based, not a paren regex: `TABS.find((t) => t.id === tab)` contains a
  // nested ")" so `[^)]*` stops at the arrow's own paren and matches nothing.
  const tabLine = view.split("\n").find((l) => l.includes("TABS.find(")) ?? "";
  check("E1 the tab lookup cannot dereference undefined",
    tabLine.length > 0 && !tabLine.includes(")!") && tabLine.includes("??"),
    `a stale id must fall back to a tab, not crash the pack view — found: ${tabLine.trim() || "(no TABS.find at all)"}`);

  check("E2 the Library's document list is DERIVED, not hand-written",
    /DELIVERABLES\.map\(/.test(lib) && !/id: "d1"/.test(lib),
    "a second list of the documents will drift from the first");

  check("E3 the deep-link param is validated before it is used as an id",
    /DELIVERABLES\.some\(\(d\) => d\.id === rawDeliverable\)/.test(studio),
    "casting a URL string to DeliverableId is what crashed the preview");

  // And no old id survives anywhere a link or a tab could carry it.
  const stale: string[] = [];
  for (const [rel, src] of [["library", lib], ["studio", studio], ["AssetPackView", view]] as const) {
    if (/["'`](d1|d2|d3|d4)["'`]/.test(src)) stale.push(rel);
  }
  check("E4 no d1..d4 id remains in the three surfaces that carry one",
    stale.length === 0, stale.join(", "));
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-build-plan: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-build-plan: ${pass} assertions passed`);
console.log(`  documents: ${CLIENT_DELIVERABLES.map((d) => d.title).join(" + ")} (client) · ${
  DELIVERABLES.filter((d) => d.audience === "internal").map((d) => d.title).join(", ")} (internal)`);
console.log(`  build: ${ALWAYS_INSTALLED_COUNT} always + ${DECIDABLE_WORKFLOWS.length} decisions = ${WORKFLOWS.length}, go-live at kickoff + ${BUILD_DAYS} days`);
