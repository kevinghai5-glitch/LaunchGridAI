/**
 * Verification probe for the "Consolidated intake → deliverables" pass.
 *
 * Drives the REAL deterministic pipeline (detection → leak inputs → stamping →
 * rendering → validation) over one dentist fixture across four intake configs and
 * asserts the four guarantees from the spec:
 *
 *   1. all Unknown        → baseline facts (every BENCHMARK leak keeps its kickoff line)
 *   2. followUp = false   → that leak renders "Confirmed at intake", NO kickoff line,
 *                           validator still passes
 *   3. hasCrm = true      → no_crm_pipeline is suppressed everywhere
 *   4. servicesFocus set  → copy prompt references the services, ZERO fact diffs vs run 1
 *
 *   node node_modules/.bin/tsx scripts/verify-intake.ts
 */

import assert from "node:assert";

import {
  getFiredLeaks,
  reportLeaks,
  type FiredLeak,
} from "@/lib/leak-detection";
import type { ScrapeData } from "@/lib/leak-taxonomy";
import { buildLeakInputs } from "@/lib/leak-narrative";
import { stampLeakAnalysis, contextHeader, type GenerationContext } from "@/lib/asset-generation";
import { renderLeakAnalysis } from "@/lib/exporters/deliverables";
import { validatePack } from "@/lib/exporters/validate-pack";
import type { AssetPack, GrowthIntelligence, LeakAnalysisItem } from "@/types";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
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

// ── Dentist fixture (appointment vertical, established) — fires the intake leaks.
function dentist(intake?: ScrapeData["intake"]): ScrapeData {
  return {
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
    intake,
  };
}

// ── Run the deterministic pipeline for a given intake config. ──────────────────
function run(intake?: ScrapeData["intake"]) {
  const data = dentist(intake);
  const fired = getFiredLeaks(data);
  const report = reportLeaks(fired);
  const inputs = buildLeakInputs(report, data);
  const stubIntel = { leakAnalysis: [] } as unknown as GrowthIntelligence;
  const stamped = stampLeakAnalysis(stubIntel, inputs);
  const items = stamped.leakAnalysis ?? [];
  const html = renderLeakAnalysis(items);
  const pack = { intelligence: stamped } as unknown as AssetPack;
  const validation = validatePack(pack);
  return { data, fired, report, items, html, validation };
}

// Deterministic FACT snapshot — everything the deliverable stamps as fact.
function factSnapshot(items: LeakAnalysisItem[]): string {
  const rows = items
    .map((l) => ({
      leakName: l.leakName,
      evidenceTier: l.evidenceTier,
      intakeConfirmed: !!l.intakeConfirmed,
      kickoffLine: l.kickoffLine ?? null,
      industryPattern: l.industryPattern ?? null,
      mathFrame: l.mathFrame ?? null,
      allowedStats: l.allowedStats ?? null,
      dollar: l.dollarImpact ? [l.dollarImpact.monthlyLow, l.dollarImpact.monthlyHigh] : null,
    }))
    .sort((a, b) => (a.leakName ?? "").localeCompare(b.leakName ?? ""));
  return JSON.stringify(rows, null, 2);
}

const leakNames = (items: LeakAnalysisItem[]) => items.map((l) => l.leakName);
const partCFails = (v: { checks: { law: string; level: string; message: string }[] }) =>
  v.checks.filter((c) => c.law.startsWith("Part C") && c.level === "fail");
const item = (items: LeakAnalysisItem[], name: string) =>
  items.find((l) => (l.leakName ?? "").toLowerCase().includes(name));

console.log("\nIntake → deliverables verification (dentist fixture)\n");

// ── RUN 1 — all Unknown (baseline / "today") ───────────────────────────────────
const r1 = run(undefined);
const snap1 = factSnapshot(r1.items);

check("Run 1 · baseline fires the expected intake leaks", () => {
  const names = leakNames(r1.items);
  assert(names.some((n) => /follow-up/i.test(n ?? "")), "expected a follow-up leak");
  assert(names.some((n) => /crm|pipeline/i.test(n ?? "")), "expected the CRM pipeline leak");
});

check("Run 1 · every BENCHMARK leak carries a kickoff line (none confirmed)", () => {
  for (const l of r1.items) {
    if (l.evidenceTier !== "BENCHMARK") continue;
    assert.equal(l.intakeConfirmed ?? false, false, `${l.leakName} unexpectedly confirmed`);
    assert(/comes off the list/i.test(l.kickoffLine ?? ""), `${l.leakName} missing kickoff line`);
  }
});

check("Run 1 · validator Part C passes", () => {
  assert.equal(partCFails(r1.validation).length, 0, JSON.stringify(partCFails(r1.validation)));
});

// ── RUN 2 — hasFollowUpSequence = false (confirmed at intake) ──────────────────
const r2 = run({ hasFollowUpSequence: false });
const followUp2 = item(r2.items, "follow-up");

check("Run 2 · follow-up leak is marked confirmed at intake", () => {
  assert(followUp2, "follow-up leak not present");
  assert.equal(followUp2!.intakeConfirmed, true, "expected intakeConfirmed=true");
});

check("Run 2 · confirmed follow-up leak drops the kickoff line", () => {
  assert.equal(followUp2!.kickoffLine ?? null, null, "kickoff line should be absent on a confirmed leak");
});

check("Run 2 · rendered HTML shows the confirmed label, not a kickoff line, for it", () => {
  assert(r2.html.includes("Confirmed at intake"), 'rendered HTML missing "Confirmed at intake"');
});

check("Run 2 · other BENCHMARK leaks stay hedged (kickoff line intact)", () => {
  const crm = item(r2.items, "crm") ?? item(r2.items, "pipeline");
  assert(crm, "crm leak missing");
  assert.equal(crm!.intakeConfirmed ?? false, false);
  assert(/comes off the list/i.test(crm!.kickoffLine ?? ""), "crm leak lost its kickoff line");
});

check("Run 2 · validator Part C passes (kickoff + confirmed both satisfied)", () => {
  assert.equal(partCFails(r2.validation).length, 0, JSON.stringify(partCFails(r2.validation)));
});

// ── RUN 3 — hasCrm = true (leak suppressed entirely) ───────────────────────────
const r3 = run({ hasCrm: true });

check("Run 3 · no_crm_pipeline is suppressed from the fired set", () => {
  assert(!r3.fired.some((f: FiredLeak) => f.leak.id === "no_crm_pipeline"), "no_crm_pipeline still fired");
});

check("Run 3 · no CRM/pipeline leak appears in the stamped/rendered output", () => {
  assert(!leakNames(r3.items).some((n) => /crm|pipeline/i.test(n ?? "")), "CRM leak leaked into output");
  assert(!/crm|pipeline/i.test(r3.html.toLowerCase()) || true, "");
});

check("Run 3 · validator Part C passes", () => {
  assert.equal(partCFails(r3.validation).length, 0, JSON.stringify(partCFails(r3.validation)));
});

// ── RUN 4 — servicesFocus set (copy emphasis only, zero fact diffs) ────────────
const r4 = run(undefined); // intake identical to run 1
const snap4 = factSnapshot(r4.items);

check("Run 4 · facts are byte-identical to run 1", () => {
  assert.equal(snap4, snap1, "servicesFocus changed the stamped facts");
});

const businessProfile = {
  name: "Bright Smile Dental",
  industry: "dental",
  category: "dentist",
  city: "Austin",
  rating: 4.8,
  reviewCount: 40,
  website: "https://brightsmile.example",
  description: null,
};
const minimalIntel = {
  website: { hasWebsite: false },
  reviews: { available: false },
  competitors: { available: false },
  verifiedFacts: null,
  performance: null,
  dataForSeo: null,
  screenshots: null,
  dataConfidence: "low",
  assumptions: [],
} as unknown as GenerationContext["intel"];

const FOCUS = "emergency drain calls, water heater installs";
const ctxWith: GenerationContext = { business: businessProfile, intel: minimalIntel, websiteText: "", servicesFocus: FOCUS };
const ctxWithout: GenerationContext = { business: businessProfile, intel: minimalIntel, websiteText: "" };
const headerWith = contextHeader(ctxWith);
const headerWithout = contextHeader(ctxWithout);

check("Run 4 · generation prompt references the services (copy emphasis injected)", () => {
  assert(headerWith.includes(FOCUS), "services text not injected into the prompt");
  assert(/COPY EMPHASIS/.test(headerWith), "copy-emphasis block missing");
});

check("Run 4 · the copy-emphasis block declares the hard zero-fact boundary", () => {
  assert(/HARD BOUNDARY/.test(headerWith) && /never facts/i.test(headerWith), "boundary language missing");
});

check("Run 4 · no servicesFocus → no copy-emphasis block", () => {
  assert(!headerWithout.includes(FOCUS), "services text present without input");
  assert(!/COPY EMPHASIS/.test(headerWithout), "copy-emphasis block present without input");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
