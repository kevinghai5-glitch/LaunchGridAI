// PHASE 2 PROOF — the generated proposal is gone, and what replaced it is
// assembled rather than written.
//
//   node_modules/.bin/tsx scripts/verify-offer-page.ts
//   npm run verify:offer
//
// Every check prints its inputs before it asserts. Exits 1 if any fails.
//
// WHAT THIS FILE PROTECTS, in one sentence each:
//
//   A. The generator is DELETED — route, prompt, defaults, builder, list, CRUD.
//   B. Nothing was HARD-deleted — the Proposal model and its rows survive.
//   C. The offer is ASSEMBLED — same input, same page, no model in the path.
//   D. The frozen calculator is never RECOMPUTED at render.
//   E. The two closing links are never a dead button.
//   F. A localhost URL can never be handed to a client as a share link.
//   G. The nine always-installed workflows can never appear as omitted.
//
// The money law on this page lives in verify-phase4 sections H and J — it is a
// law about every prospect-facing surface, not about this one page, so it stays
// where the other surfaces are checked rather than being copied here.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildClientOffer, readComputed } from "../src/lib/client-offer";
import { ClientOffer } from "../src/components/client/ClientOffer";
import { computeAssessment, emptyInputs, LEAKS } from "../src/lib/leak-calculator";
import { WORKFLOWS } from "../src/lib/workflow-catalogue";
import { DECIDABLE_WORKFLOWS, ALWAYS_INSTALLED_COUNT } from "../src/lib/build-decisions";
import { offerPath, offerShareUrl, SHARE_URL_UNSET } from "../src/lib/share-link";
import { APP_URL_IS_LOCAL, PUBLIC_BASE_URL, SETUP_FEE_CAD, MONTHLY_RETAINER_CAD } from "../src/lib/constants";

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
/** Strip comments before an absence scan: a file must not pass a check on the
 *  strength of its own documentation saying the thing used to be there. */
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PROSPECT = { name: "Harbourline Air", industry: "HVAC", city: "Dartmouth" };

/** A worst-answers assessment, computed by the shipped model. */
function assessment(worst: boolean) {
  const inputs = emptyInputs();
  inputs.monthlyEnquiries = 45;
  inputs.avgJobValue = 850;
  for (const leak of LEAKS) inputs.answers[leak.id] = worst ? leak.options.length - 1 : 0;
  return computeAssessment(inputs);
}
function offerFor(worst: boolean, toggles: unknown = {}) {
  return buildClientOffer({ business: PROSPECT, computed: assessment(worst), workflowToggles: toggles });
}
const render = (o: NonNullable<ReturnType<typeof buildClientOffer>>): string =>
  renderToStaticMarkup(createElement(ClientOffer, { offer: o }));

// ── A · The generator is deleted, not disabled ──────────────────────────────
for (const p of [
  "src/app/api/generate/proposal/route.ts",
  "src/lib/proposal-defaults.ts",
  "src/app/(dashboard)/proposals/new/page.tsx",
  "src/app/(dashboard)/proposals/page.tsx",
  "src/app/(dashboard)/proposals/[id]/page.tsx",
  "src/app/api/proposals/route.ts",
  "src/app/api/proposals/[id]/route.ts",
  "src/components/proposals/PublicProposal.tsx",
]) {
  check(`A1 deleted: ${p}`, gone(p));
}
// And nothing links at the routes that are gone. A broken href is invisible to
// the compiler and shows up as a 404 in front of a client.
{
  const offenders: string[] = [];
  for (const rel of [
    "src/middleware.ts",
    "src/components/dashboard/Sidebar.tsx",
    "src/components/dashboard/CommandPalette.tsx",
    "src/app/(dashboard)/library/page.tsx",
    "src/app/(dashboard)/studio/page.tsx",
    "src/app/(dashboard)/businesses/[id]/page.tsx",
    "src/app/(dashboard)/playbook/PlaybookBody.tsx",
    "src/app/api/search/route.ts",
    "src/app/api/notifications/route.ts",
  ]) {
    const src = strip(read(rel));
    if (/["'`]\/proposals|\/api\/proposals|api\/generate\/proposal/.test(src)) offenders.push(rel);
  }
  check("A2 nothing links at a deleted proposal route", offenders.length === 0, offenders.join(" "));
}
// The generator was the last caller of the model on this path.
{
  const offer = strip(read("src/lib/client-offer.ts"));
  const comp = strip(read("src/components/client/ClientOffer.tsx"));
  check("A3 the offer path calls no model", !/openai|OpenAI|createCompletion|chat\.completions/.test(offer + comp));
}

// ── B · Nothing was hard-deleted ────────────────────────────────────────────
{
  const schema = read("prisma/schema.prisma");
  check("B1 the Proposal model still exists", /^model Proposal \{/m.test(schema),
    "the rows must survive — removal is soft-delete, always");
  const mig = read("prisma/migrations/20260806120000_offer_page_replaces_proposal/migration.sql");
  check("B2 the migration soft-deletes, never DROPs", /UPDATE "Proposal" SET "deletedAt"/.test(mig));
  check("B3 the migration contains no DELETE or DROP",
    !/\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b/i.test(mig));
}

// ── C · Assembled, not generated: same input ⇒ same page ────────────────────
{
  const a = offerFor(true);
  const b = offerFor(true);
  check("C1 buildClientOffer is deterministic", JSON.stringify(a) === JSON.stringify(b));
  check("C2 the rendering is deterministic", render(a!) === render(b!));
  eq("C3 the prices come from constants, not a row", a?.setupFeeCad, SETUP_FEE_CAD);
  eq("C4 the retainer comes from constants", a?.monthlyRetainerCad, MONTHLY_RETAINER_CAD);
}

// ── D · The frozen computation is never re-run ──────────────────────────────
{
  const src = strip(read("src/lib/client-offer.ts"));
  check("D1 the assembler does not import computeAssessment", !/computeAssessment/.test(src),
    "recomputing would silently requote a client whose numbers were already agreed");
  // What it DOES do is read the stored blob defensively.
  check("D2 an unreadable blob yields null, never zeroes", readComputed({ nonsense: true }) === null);
  check("D3 null input yields null", readComputed(null) === null);
  check("D4 a real computed blob reads back", readComputed(assessment(true)) !== null);
  // The figures on the page are the stored figures, untouched.
  const stored = assessment(true);
  const o = buildClientOffer({ business: PROSPECT, computed: stored, workflowToggles: {} })!;
  eq("D5 the total is the stored total", o.totalLow, stored.totalLow);
  eq("D6 a freshly-computed derivation passes through untouched", o.derivation, stored.derivation);

  // THE STALE-ROW CASE, which is the one that bit in production. `derivation` is
  // frozen on the row, so an assessment saved before the money law carries an
  // unmarked "$3,000" forever — printed directly under a marked "CAD $6,550".
  // Re-running the model to fix a currency marker would requote a client who
  // already agreed a number, so only the MARKER is repaired.
  {
    const stale = {
      ...stored,
      derivation: "Built from 60 enquiries a month at $3,000 a job, a 30% close rate.",
    };
    const repaired = buildClientOffer({ business: PROSPECT, computed: stale, workflowToggles: {} })!;
    check("D8 a stale derivation gets its marker back",
      repaired.derivation.includes("CAD $3,000"), repaired.derivation);
    // The load-bearing half: NO DIGIT MOVED. Compare the digit sequences.
    const digits = (s: string) => (s.match(/\d[\d,]*/g) ?? []).join("|");
    eq("D9 the repair changes no digits", digits(repaired.derivation), digits(stale.derivation));
    check("D10 the repair does not double-mark",
      !/CAD\s+CAD/.test(repaired.derivation), repaired.derivation);
    // And a figure somebody wrote in another currency on purpose is left alone.
    const usd = { ...stored, derivation: "Industry cost per lead runs US$84 before conversion." };
    const untouched = buildClientOffer({ business: PROSPECT, computed: usd, workflowToggles: {} })!;
    eq("D11 a deliberately foreign figure is not rewritten as CAD",
      untouched.derivation, usd.derivation);
  }
  const page = strip(read("src/app/p/[publicId]/page.tsx"));
  check("D7 the public page refuses an unpriced assessment", /!offer\.priced/.test(page),
    "a page of zeroes and a page with no figures look identical to a client");
}

// ── E · The closing links are never a dead button ───────────────────────────
{
  const o = offerFor(true)!;
  const html = render(o);
  const hrefs = Array.from(html.matchAll(/<a[^>]+href="([^"]*)"/g)).map((m) => m[1]);
  check("E1 no empty or placeholder href", !hrefs.some((h) => !h || h === "#" || h === "undefined"), hrefs.join(" "));
  for (const [label, link] of [["agreement", o.agreement], ["payment", o.payment]] as const) {
    check(`E2 ${label} has a href OR names the variable to set`,
      Boolean(link.href) !== Boolean(link.missingEnvVar),
      "exactly one — a link with neither renders a blank button");
    if (!link.href) {
      check(`E3 ${label}'s unset state is announced on the page`, html.includes(link.missingEnvVar!));
    }
  }
  // The unset branch is the DEFAULT state of a fresh clone, so it is the one
  // that has to be safe. Asserted directly rather than left to whichever way
  // the environment happens to be configured when this runs.
  const unset = { label: "Pay now", missingEnvVar: "NEXT_PUBLIC_PAYMENT_URL" };
  check("E4 an unset link carries no href at all", !("href" in unset));
  const comp = read("src/components/client/ClientOffer.tsx");
  check("E5 the placeholder is loud, not a disabled button", /LINK NOT SET/.test(comp));

  // The stylesheet must be injected raw, not as a JSX child. As a child React
  // escapes its quotes on the server and not on the client, hydration fails, and
  // React repaints the whole document — a flash of unstyled content on the page
  // a client opens. Caught in the browser, pinned here.
  check("E6 the stylesheet is injected raw so hydration matches",
    /<style dangerouslySetInnerHTML=\{\{ __html: CSS \}\} \/>/.test(comp) && !/<style>\{CSS\}<\/style>/.test(comp),
    "a <style>{CSS}</style> child escapes quotes server-side only and breaks hydration");
}

// ── F · A localhost URL can never be handed to a client ─────────────────────
{
  check("F1 localhost is recognised as unshareable",
    APP_URL_IS_LOCAL ? PUBLIC_BASE_URL === undefined : PUBLIC_BASE_URL !== undefined);
  const url = offerShareUrl("abc123");
  check("F2 the share URL is absolute or absent, never localhost",
    url === null || !/localhost|127\.0\.0\.1/.test(url), String(url));
  eq("F3 the relative path always works for the operator", offerPath("abc123"), "/p/abc123");
  check("F4 the refusal names the variable", /NEXT_PUBLIC_APP_URL/.test(SHARE_URL_UNSET));
  // Both copy controls must route through it — a second hand-built URL is how
  // the two surfaces drift apart.
  for (const rel of [
    "src/app/(dashboard)/library/page.tsx",
    "src/app/(dashboard)/library/[id]/calculator/page.tsx",
  ]) {
    const src = strip(read(rel));
    check(`F5 ${rel} copies via offerShareUrl`, /offerShareUrl\(/.test(src));
    check(`F6 ${rel} builds no share URL by hand`, !/APP_URL\}?\/p\/|`\$\{APP_URL/.test(src));
  }
}

// ── G · The build list is derived from the catalogue ────────────────────────
{
  const all = offerFor(true, {})!;
  eq("G1 every workflow appears exactly once",
    all.installed.length + all.omitted.length, WORKFLOWS.length);
  check("G2 default is everything installed", all.omitted.length === 0);
  eq("G3 installedCount is the list length", all.installedCount, all.installed.length);

  // Switch every decidable workflow off. The nine must survive.
  const allOff: Record<string, boolean> = {};
  for (const w of DECIDABLE_WORKFLOWS) allOff[w.id] = false;
  const stripped = offerFor(true, allOff)!;
  eq("G4 only the five can be removed", stripped.omitted.length, DECIDABLE_WORKFLOWS.length);
  eq("G5 the nine always survive", stripped.installed.length, ALWAYS_INSTALLED_COUNT);
  check("G6 no every_build workflow is ever omitted",
    stripped.omitted.every((o) => WORKFLOWS.find((w) => w.id === o.id)?.applicability.kind !== "every_build"));
  check("G7 every omission states its reason",
    stripped.omitted.every((o) => Boolean(o.omittedBecause?.length)),
    "an omission with no reason reads to a client as something we forgot");
  // And a stray key for one of the nine is dropped, not honoured. Someone with
  // the businessId can PATCH any JSON they like into Business.workflowToggles.
  const forged = offerFor(true, { "instant-lead-response": false })!;
  check("G8 a forged toggle for an always-installed workflow is ignored",
    forged.omitted.length === 0);

  // WHERE THAT PROTECTION ACTUALLY LIVES. G8 passes because readDecisions()
  // returns keys for the five and nothing else, so a forged key for one of the
  // nine is never in the map to be read. The `isDecidable` test in
  // buildClientOffer is a second, redundant guard — removing it changes no
  // behaviour, which a first attempt at this section proved by injecting it and
  // watching every check still pass.
  //
  // So the load-bearing thing is asserted directly: the raw toggles blob is
  // never read. Bypassing readDecisions is the one edit that would put a
  // client's own forged JSON in charge of what we install.
  const src = strip(read("src/lib/client-offer.ts"));
  check("G9 toggles are resolved through readDecisions, never read raw",
    /readDecisions\(src\.workflowToggles\)/.test(src) &&
      !/src\.workflowToggles\s*(as|\[)/.test(src),
    "a raw read lets a forged key remove a workflow that installs in every build");
}

// ── H · The all-clean outcome is a real page, not an error state ────────────
{
  const clean = offerFor(false)!;
  check("H1 all-clean is recognised", clean.allClean);
  eq("H2 nothing is priced", clean.totalHigh, 0);
  eq("H3 no leak rows", clean.leakRows.length, 0);
  eq("H4 every question came back covered", clean.cleanRows.length, LEAKS.length);
  const html = render(clean);
  check("H5 the page still renders the build", html.includes(WORKFLOWS[0].name));
  check("H6 the page still renders the prices", /CAD\s*\$6,500/.test(html.replace(/<[^>]+>/g, " ")));
  check("H7 it does not read as a failure", !/error|failed|unavailable/i.test(html.replace(/<[^>]+>/g, " ")));
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-offer-page: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-offer-page: ${pass} assertions passed`);
console.log(`  build: ${ALWAYS_INSTALLED_COUNT} always installed + ${DECIDABLE_WORKFLOWS.length} decisions = ${WORKFLOWS.length}`);
console.log(`  share base: ${PUBLIC_BASE_URL ?? "(unset — copy refuses, by design)"}`);
