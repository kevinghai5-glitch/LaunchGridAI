/**
 * PHASE 4 PROOF — the last round, demonstrated against the REAL shipped code,
 * offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase4.ts
 *   npm run verify:phase4
 *
 * Every check prints its own inputs and outputs before it asserts, so a reader
 * can audit the claim without trusting the assertion. Exits 1 if ANY check fails.
 *
 * THE ROUND IN ONE SENTENCE: the cold audit stopped being the thing that closes
 * the deal. The sale now runs cold call → the prospect books a 15-minute Zoom →
 * this document lands in their inbox BEFORE the Zoom → on the Zoom it gets two or
 * three minutes as a credibility beat → and then the conversation moves inside
 * the business, where the leaks are priced live from the owner's own answers.
 * So the document's whole job is to prove we looked, prove we can count, and EARN
 * THE RIGHT TO ASK QUESTIONS. It is not trying to close anybody, and the eight
 * sections below are the eight ways that could quietly stop being true.
 *
 *   A. THE FRAME IS ON THE      — "everything here was read from the outside…
 *      PAGE, BEFORE ANY FINDING   that is the smaller half", printed before the
 *                                 first finding lands, on the document AND on the
 *                                 public teaser, from ONE constant.
 *   B. THE SIX INVISIBLE LEAKS  — the six phrases he says out loud on the Zoom
 *      ARE ONE SET OF STRINGS     are the six phrases the prospect read in the
 *                                 email. Asserted as IDENTITY, not similarity:
 *                                 one copy of each string exists in the codebase,
 *                                 and the teaser imports it rather than retyping
 *                                 it. A divergence between the document and what
 *                                 he says on the phone is the failure this guards.
 *   C. ONE ASK, AND IT BOOKS    — exactly one call to action on the document and
 *      THE CALL                   exactly one on the teaser, counted on the
 *                                 rendered markup rather than promised in a
 *                                 comment, with every "just reply to this email"
 *                                 shape swapped at the boundary.
 *   D. NOTHING IS DISCLOSED     — already a COMPILE ERROR (twice). Said plainly,
 *      BEFORE THE SALE            then the three runtime backstops are fired one
 *                                 at a time so the guarantee is not resting on a
 *                                 type nobody has tested.
 *   E. AN INFERRED LEAK NEVER   — in BOTH artifacts. What we did not measure is
 *      READS AS A MEASUREMENT     hedged and labelled a pattern; what we DID
 *                                 measure is left alone, because hedging a
 *                                 measurement makes the whole document read as
 *                                 guesswork.
 *   F. EVERY DOLLAR FIGURE      — a figure on a cold audit is an industry
 *      SAYS IT IS A BENCHMARK     benchmark over an ASSUMED volume, and it says
 *                                 so in the same breath as the number.
 *   G. NOTHING RECOMMENDS ADS,  — he sells conversion of demand that already
 *      SEO, LEAD GEN OR A         exists, and he does not build websites. A
 *      WEBSITE REBUILD            NEGATED mention ("we don't rebuild websites")
 *                                 is his best line and must survive the sweep.
 *   H. THE MONEY LAW HOLDS ON   — "CAD $6,500", never a bare "$6,500", anywhere a
 *      THE PUBLIC PROPOSAL        prospect can see. Proved by rendering the real
 *                                 component and reading the visible words.
 *
 * READ THE LABELS. Some checks below prove a COMPILE-TIME guarantee (the code
 * does not build), some prove RUNTIME behaviour (the code behaves), and some are
 * a SOURCE-LEVEL scan (the code does not contain a second copy of a string that
 * must exist once). They are not the same strength of promise, so every check
 * that makes a structural claim says which it is — the same discipline as
 * section D of scripts/verify-phase1.ts and the header of verify-phase3.ts.
 */

import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BENCHMARK_FIGURE_LABEL,
  BOOKING_CTA_LABEL,
  COLD_AUDIT_CTA_FALLBACK,
  OUTSIDE_INSIDE_FRAME,
  PIPELINE_DISCOVERY_QUESTION,
  PIVOT_LEAK_PHRASES,
  PIVOT_QUESTIONS,
  PIVOT_SECTION_INTRO,
  PIVOT_SECTION_LABEL,
  SCAN_SECTION_LABEL,
  countCallsToAction,
  ctaOffersCompetingChannel,
  enforceColdAuditLaws,
  outOfScopeHits,
  pivotQuestionLines,
  renderColdAuditHtml,
  scopeViolations,
} from "@/lib/exporters/cold-audit-html";
import { assertNoDisclosedFindings, gradeColdAuditFindings } from "@/lib/cold-audit";
import {
  assertStoredColdAuditSafe,
  validateColdAudit,
} from "@/lib/exporters/validate-pack";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { detectLeaks } from "@/lib/leak-detection";
import { intakeFieldsForZeroInferred, LEAKS } from "@/lib/leak-taxonomy";
import { NURTURE_SEQUENCE } from "@/lib/asset-generation";
import {
  ASSUMPTION_CAVEAT,
  buildLeakInputs,
  cad,
  flatAssertionLint,
  type LeakInput,
} from "@/lib/leak-narrative";
import { BOOKING_URL } from "@/lib/constants";
import { buildProposalDefaults } from "@/lib/proposal-defaults";
import { PublicProposal } from "@/components/proposals/PublicProposal";
import type { AuditIntelligence } from "@/lib/audit-intelligence";
import type { FirecrawlScrape } from "@/lib/firecrawl";
import type { ColdAuditFinding, ColdAuditReport, ProposalContent } from "@/types";

/* ════════════════════════════════════════════════════════════════════════════
 * THE CTA PROBE — a child process, and it is not an affectation.
 *
 * BOOKING_URL is read from the environment ONCE, when src/lib/constants.ts is
 * first imported. This repo runs with it unset, which is a real and correct
 * state (the close renders as plain text rather than shipping a dead button to a
 * prospect) — but it means a check run in THIS process can only ever see the
 * unconfigured branch, and the rule we actually care about is "when a booking URL
 * IS configured, there is exactly one link and it is that one".
 *
 * So section C re-runs this same file as a child with the variable set and reads
 * back one line of JSON. Same code, same renderer, both branches proved.
 * ══════════════════════════════════════════════════════════════════════════ */

const CTA_PROBE_FLAG = "--cta-probe";
const PROBE_BOOKING_URL = "https://booking.example/reclaimedhq/15-minute-call";

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
 * be satisfied — or defeated — by prose. Borrowed verbatim from verify-phase2 and
 * verify-phase3, and load-bearing here for a specific reason: several files in
 * this round open with long comments quoting the very strings whose SINGLE copy
 * this file is asserting, and a naive `includes()` would count the explanation.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, including doc headers
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // line comments, but not "https://"
}

/** JSX comments too — the teaser page is a React component and half its rules are
 *  explained inside `{/* … *\/}` blocks, which the TypeScript stripper above
 *  leaves behind as ordinary block comments only when they are not wrapped in
 *  braces. Strip both forms so "is this string in the code" means the code. */
function jsxCodeOnly(rel: string): string {
  return codeOnly(rel).replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");
}

/** The words a reader actually sees, markup removed. Same shape the pack
 *  validator uses (visibleText), so "on the page" means the same thing here as it
 *  does at the gate. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dollar amounts written WITHOUT the currency marker in front of them. The money
 *  law is "CAD $1,290" — marker first, everywhere, no exceptions. */
function bareDollarFigures(text: string): string[] {
  const out: string[] = [];
  const re = /\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    // "CAD $1,290" is the law; "US$84" is a different currency somebody wrote on
    // purpose and is left alone by the guard, so it is left alone here too.
    if (!/CAD\s*$/.test(before) && !/[A-Za-z]$/.test(before)) out.push(m[0]);
  }
  return out;
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Every model-authored passage of a cold audit, tagged with where it lives. */
function auditPassages(r: ColdAuditReport): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const push = (where: string, text: string | null | undefined) => {
    if (text && text.trim()) out.push({ where, text });
  };
  push("headline", r.headline);
  push("intro", r.intro);
  push("headlineCost", r.headlineCost);
  (r.findings ?? []).forEach((f, i) => {
    push(`finding ${i + 1} title`, f.title);
    push(`finding ${i + 1} problem`, f.problem);
    push(`finding ${i + 1} cost`, f.whyItCosts);
  });
  (r.deeperLeakQuestions ?? []).forEach((q, i) => push(`question ${i + 1}`, q));
  push("close", r.closingCta?.message);
  push("performance readout", r.performance?.readout);
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES
 *
 * Synthetic, like the golden pack and for the same reason: a .example domain that
 * can never resolve and a phone number in the reserved 555-01xx block, so nothing
 * in this file traces to a real prospect.
 * ══════════════════════════════════════════════════════════════════════════ */

const SCAN_DATE = "2026-07-01T12:00:00.000Z";

// A synthetic trade site with the signals a typical owner-run business shows: a
// four-field contact form, a tappable phone number, no scheduler and no chat.
// Every one of those is something src/lib/leak-detection.ts fingerprints.
const COLD_HTML = `<!doctype html><html lang="en"><head>
<title>Harbourline Air — Furnace and Heat Pump Service in Dartmouth</title></head><body>
<header><a class="logo" href="/">Harbourline Air</a>
<nav><a href="/services">Services</a><a href="/contact">Contact</a>
<a class="btn" href="tel:+19025550117">902-555-0117</a></nav></header>
<section class="hero"><h1>Furnace and heat pump service across Dartmouth</h1>
<p>Licensed and insured, working in the Halifax Regional Municipality since 2011.</p>
<a class="btn primary" href="/contact">Request a quote</a></section>
<section class="contact"><h2>Get in touch</h2>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form></section>
<footer><p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.</p></footer>
</body></html>`;

const COLD_MARKDOWN = `# Furnace and heat pump service across Dartmouth

Licensed and insured, working in the Halifax Regional Municipality since 2011.

[Request a quote](/contact) · [Call 902-555-0117](tel:+19025550117)

## Get in touch
Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.`;

const COLD_SCRAPE: FirecrawlScrape = {
  used: true,
  homepage: {
    url: "https://harbourline-air.example/",
    title: "Harbourline Air",
    description: "",
    markdown: COLD_MARKDOWN,
    html: COLD_HTML,
    rawHtml: COLD_HTML,
    links: [],
  },
  subpages: [],
};

/** Built by the REAL intelligence layer rather than hand-shaped, so the leaks
 *  that fire below fire for the same reasons they fire for a paying client. */
const COLD_INTEL: AuditIntelligence = buildAuditIntelligence({
  websiteHtml: COLD_HTML,
  hasWebsiteUrl: true,
  reviews: [],
  competitors: [
    { name: "Ridgeline Mechanical", rating: 4.6, reviewCount: 150, website: "", category: "HVAC contractor", address: "Halifax NS" },
    { name: "Two Rivers Comfort", rating: 4.5, reviewCount: 120, website: "", category: "HVAC contractor", address: "Dartmouth NS" },
  ],
  self: { rating: 4.3, reviewCount: 38 },
  verifiedFacts: null,
  performance: null,
  dataForSeo: null,
  screenshots: null,
});

/** A COLD PRE-SALE DETECTION. `mode: "pre_sale"` is the declaration the compiler
 *  enforces — see section D1. Nothing here can carry intake, by construction. */
const preSale = detectLeaks({
  mode: "pre_sale",
  business: {
    name: "Harbourline Air",
    industry: "HVAC",
    category: "HVAC contractor",
    city: "Dartmouth",
    phone: "902-555-0117",
    website: "https://harbourline-air.example",
    rating: 4.3,
    reviewCount: 38,
  },
  intel: COLD_INTEL,
  scrape: COLD_SCRAPE,
  asOf: SCAN_DATE,
});

const preSaleInputs: LeakInput[] = buildLeakInputs(preSale.report, preSale.data);

/** The model's output for this business, hand-written to the shape the generator
 *  asks for. Written the way a GOOD draft reads — this is the baseline every
 *  section below deforms in one specific way to prove the boundary repairs it. */
function modelFindings(): Parameters<typeof gradeColdAuditFindings>[0] {
  return [
    {
      leak: "No online booking path",
      title: "There is no way to book you without a phone call",
      problem:
        "Neither the site nor the Google profile carries a booking link, so every appointment has to go through a conversation during office hours.",
      whyItCosts:
        "A homeowner who decides at 10pm has to remember to ring in the morning, and remembering is where a lot of that intent quietly dies.",
      severity: "high",
    },
    {
      leak: "No webchat / messaging capture",
      title: "A visitor with one small question has no light way to ask it",
      problem:
        "No chat or messaging widget was found on any scanned page, so the only routes are a phone call or a form and a wait.",
      whyItCosts:
        "The lighter the question, the more likely the visitor closes the tab instead of asking it.",
      severity: "medium",
    },
    {
      leak: "Missed calls with no recovery",
      title: "A call that rings out has nothing behind it",
      problem:
        "The published number is a single line with no text-back path anywhere on the site. Most owner-run trades let it fall through to voicemail while the crew is on a job.",
      whyItCosts:
        "Where that pattern holds, a caller who cannot get through typically dials the next company within minutes.",
      severity: "high",
    },
  ];
}

function baseReport(): ColdAuditReport {
  return {
    businessName: "Harbourline Air",
    city: "Dartmouth",
    industry: "HVAC",
    websiteUrl: "https://harbourline-air.example",
    screenshotUrl: null,
    headline: "Where Harbourline Air is quietly losing clients",
    intro:
      "The site is honest about what you do and where you do it — but here is where enquiries are going missing before they ever reach you.",
    headlineCost:
      "You already pay to get these leads. Every one that hits this gap is money you spent to earn somebody who now slips away before they reach you.",
    findings: gradeColdAuditFindings(modelFindings(), preSaleInputs),
    deeperLeakQuestions: [
      "When a lead reaches out after hours, how fast do they actually hear back?",
    ],
    closingCta: {
      tiedToFinding: "There is no way to book you without a phone call",
      message: COLD_AUDIT_CTA_FALLBACK,
    },
    agencyName: "our team",
    generatedAt: SCAN_DATE,
    dataConfidence: "medium",
  };
}

/** The enforced document — what a prospect actually reads. Every section that
 *  makes a claim about "the document" runs against THIS, never the raw row. */
const enforced = enforceColdAuditLaws(baseReport());
const documentHtml = renderColdAuditHtml(baseReport());
const documentVisible = visibleText(documentHtml);

const TEASER_PAGE = "src/app/a/[publicId]/page.tsx";
const AUDIT_RENDERER = "src/lib/exporters/cold-audit-html.ts";
const teaserSource = jsxCodeOnly(TEASER_PAGE);

/* ════════════════════════════════════════════════════════════════════════════
 * THE CTA PROBE CHILD — runs first and exits, when asked.
 * ══════════════════════════════════════════════════════════════════════════ */

interface CtaProbe {
  bookingUrl: string;
  links: number;
  bookingLinks: number;
  secondaryAsks: string[];
  buttonLabelOnPage: boolean;
}

if (process.argv.includes(CTA_PROBE_FLAG)) {
  const counts = countCallsToAction(documentHtml);
  const probe: CtaProbe = {
    bookingUrl: BOOKING_URL ?? "",
    links: counts.links,
    bookingLinks: counts.bookingLinks,
    secondaryAsks: counts.secondaryAsks,
    buttonLabelOnPage: documentVisible.includes(BOOKING_CTA_LABEL),
  };
  console.log(`__CTA_PROBE__${JSON.stringify(probe)}`);
  process.exit(0);
}

/** Run this file again with a booking URL configured and read back the counts. */
function ctaProbeWithBookingUrl(): CtaProbe {
  const out = execFileSync(
    process.execPath,
    [resolve(REPO, "node_modules/.bin/tsx"), resolve(REPO, "scripts/verify-phase4.ts"), CTA_PROBE_FLAG],
    {
      cwd: REPO,
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_BOOKING_URL: PROBE_BOOKING_URL },
    }
  );
  const line = out.split("\n").find((l) => l.startsWith("__CTA_PROBE__"));
  assert(line, `the CTA probe child printed no result. Its output was:\n${out}`);
  return JSON.parse(line!.slice("__CTA_PROBE__".length)) as CtaProbe;
}

/* ════════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

console.log("\nPHASE 4 VERIFICATION — the cold audit is no longer the persuasion instrument");
console.log(
  `  fired pre-sale leaks: ${preSale.report.length} · grades: ` +
    `${JSON.stringify(
      preSaleInputs.reduce<Record<string, number>>((acc, li) => {
        acc[li.grade] = (acc[li.grade] ?? 0) + 1;
        return acc;
      }, {})
    )}`
);

/* ──────────────────────────────────────────────────────────────────────────
 * A · THE OUTSIDE/INSIDE FRAME
 * ────────────────────────────────────────────────────────────────────── */
section("A · THE FRAME — the outside is the smaller half, and the document says so first");

check("A1 · RUNTIME — the frame's exact words are on the rendered document", () => {
  show("label", OUTSIDE_INSIDE_FRAME.label);
  show("lead ", OUTSIDE_INSIDE_FRAME.lead);
  show("body ", `${OUTSIDE_INSIDE_FRAME.body.slice(0, 90)}…`);
  for (const [name, text] of Object.entries(OUTSIDE_INSIDE_FRAME)) {
    assert(
      documentVisible.includes(text),
      `OUTSIDE_INSIDE_FRAME.${name} is not on the rendered page — the frame was reworded or dropped`
    );
  }
});

check("A2 · RUNTIME — the frame lands BEFORE the first finding, not after it", () => {
  const frameAt = documentVisible.indexOf(OUTSIDE_INSIDE_FRAME.lead);
  const scanSectionAt = documentVisible.indexOf(SCAN_SECTION_LABEL);
  const firstFindingAt = documentVisible.indexOf(enforced.findings[0].title);
  show("frame at        ", frameAt);
  show("scan heading at ", scanSectionAt);
  show("first finding at", firstFindingAt);
  assert(frameAt >= 0, "the frame is not on the page at all");
  assert(
    frameAt < scanSectionAt && frameAt < firstFindingAt,
    "a finding lands before the frame — the reader meets the evidence before being told it is the small half, " +
      "which is what makes the pivot on the call feel like moving the goalposts"
  );
});

check("A3 · RUNTIME — the frame renders even when the stored row has never heard of it", () => {
  // A cold audit saved before Phase 4 carries no frame anywhere in its JSON. The
  // renderer stamps it from the constant rather than reading it off the report,
  // so there is no report state in which the honesty move goes missing.
  const stale = baseReport();
  const staleJson = JSON.stringify(stale);
  show("frame text anywhere in the stored row", staleJson.includes(OUTSIDE_INSIDE_FRAME.lead));
  assert(
    !staleJson.includes(OUTSIDE_INSIDE_FRAME.lead),
    "the fixture already contains the frame — this check is proving nothing"
  );
  assert(
    visibleText(renderColdAuditHtml(stale)).includes(OUTSIDE_INSIDE_FRAME.lead),
    "the frame did not render from a report that does not contain it"
  );
});

check("A4 · SOURCE — the teaser IMPORTS the frame; there is no second copy of it", () => {
  const imports =
    /import\s*\{[^}]*\bOUTSIDE_INSIDE_FRAME\b[^}]*\}\s*from\s*"@\/lib\/exporters\/cold-audit-html"/.test(
      teaserSource
    );
  const literal = teaserSource.includes(OUTSIDE_INSIDE_FRAME.lead);
  show("teaser imports OUTSIDE_INSIDE_FRAME", imports);
  show("teaser retypes the lead sentence  ", literal);
  assert(imports, `${TEASER_PAGE} no longer imports OUTSIDE_INSIDE_FRAME`);
  assert(
    !literal,
    `${TEASER_PAGE} contains a literal copy of the frame — two copies drift, and a drift here is a drift ` +
      "between the pre-call email and what he says on the Zoom"
  );
});

check("A5 · SOURCE — the frame is defined exactly once in src/", () => {
  const files = ["src/lib/exporters/cold-audit-html.ts", TEASER_PAGE, "src/components/businesses/ColdAuditView.tsx"];
  const copies = files.filter((f) => jsxCodeOnly(f).includes(OUTSIDE_INSIDE_FRAME.lead));
  show("files containing the lead sentence verbatim", copies);
  assert.deepEqual(
    copies,
    ["src/lib/exporters/cold-audit-html.ts"],
    "the frame sentence exists in more than one file"
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * B · THE SIX SANCTIONED PHRASES
 * ────────────────────────────────────────────────────────────────────── */
section("B · THE SIX INVISIBLE LEAKS — one set of strings, IDENTITY not similarity");

check("B1 · RUNTIME — the six questions name the six phrases by reference, not by retyping", () => {
  show("phrases", PIVOT_LEAK_PHRASES);
  assert.equal(PIVOT_QUESTIONS.length, 6, "the pivot set is no longer six questions");
  assert.equal(PIVOT_LEAK_PHRASES.length, 6, "the phrase set is no longer six phrases");
  PIVOT_QUESTIONS.forEach((q, i) => {
    // Identity, not equality-by-value: `q.leak` IS `PIVOT_LEAK_PHRASES[i]`, the
    // same string, because the questions are built from the phrase array. A
    // second copy that happened to match today would pass an equality check and
    // fail the day one of them is edited.
    assert.strictEqual(
      q.leak,
      PIVOT_LEAK_PHRASES[i],
      `question ${i + 1} names "${q.leak}" but phrase ${i + 1} is "${PIVOT_LEAK_PHRASES[i]}"`
    );
  });
});

check("B2 · RUNTIME — all six phrases render VERBATIM on the document", () => {
  for (const phrase of PIVOT_LEAK_PHRASES) {
    show("on the page", `"${phrase}"`);
    assert(documentVisible.includes(phrase), `"${phrase}" is not on the rendered document`);
  }
  for (const q of PIVOT_QUESTIONS) {
    assert(documentVisible.includes(q.ask), `the question "${q.ask}" is not on the rendered document`);
  }
});

check("B3 · RUNTIME — they are printed as QUESTIONS, never asserted as findings", () => {
  const findingProse = enforced.findings
    .flatMap((f) => [f.title, f.problem, f.whyItCosts])
    .join("\n")
    .toLowerCase();
  for (const phrase of PIVOT_LEAK_PHRASES) {
    assert(
      !findingProse.includes(phrase.toLowerCase()),
      `"${phrase}" turned up inside a FINDING. We have measured none of the six — asserting one on a ` +
        "document sent to somebody we have never spoken to is inventing a fact about the inside of their business"
    );
  }
  show("every pivot row ends in a question mark", PIVOT_QUESTIONS.every((q) => q.ask.trim().endsWith("?")));
  assert(PIVOT_QUESTIONS.every((q) => q.ask.trim().endsWith("?")), "a pivot row is not written as a question");
});

check("B4 · RUNTIME — the enforcer REPLACES the model's own questions with the fixed six", () => {
  const drifting = baseReport();
  drifting.deeperLeakQuestions = [
    "What is your current lead-response cadence?",
    "How mature is your follow-up motion?",
  ];
  const out = enforceColdAuditLaws(drifting);
  show("model wrote  ", drifting.deeperLeakQuestions);
  show("document asks", out.deeperLeakQuestions.slice(0, 2));
  assert.deepEqual(
    out.deeperLeakQuestions,
    [...pivotQuestionLines(), PIPELINE_DISCOVERY_QUESTION],
    "the model's consultant-vocabulary questions survived to the page"
  );
});

check("B5 · SOURCE — the teaser IMPORTS the six; not one of them is retyped there", () => {
  const imports = /import\s*\{[^}]*\bPIVOT_QUESTIONS\b[^}]*\}\s*from\s*"@\/lib\/exporters\/cold-audit-html"/.test(
    teaserSource
  );
  const retyped = PIVOT_LEAK_PHRASES.filter((p) => teaserSource.includes(p));
  show("teaser imports PIVOT_QUESTIONS", imports);
  show("phrases retyped on the teaser ", retyped);
  assert(imports, `${TEASER_PAGE} no longer imports PIVOT_QUESTIONS`);
  assert.deepEqual(retyped, [], "the teaser carries its own copy of a pivot phrase");
});

check("B6 · SOURCE — each phrase exists exactly ONCE in the whole codebase", () => {
  // The single copy is PIVOT_LEAK_PHRASES. Anything else — a renderer, a page, a
  // prompt, a fixture — reaches it by name. This is the check that makes "he
  // reads it in the email and then hears it on the Zoom" a property of the code
  // rather than a thing somebody remembered to keep in sync.
  const files = [
    "src/lib/exporters/cold-audit-html.ts",
    "src/lib/cold-audit.ts",
    "src/lib/exporters/validate-pack.ts",
    TEASER_PAGE,
    "src/components/businesses/ColdAuditView.tsx",
  ];
  for (const phrase of PIVOT_LEAK_PHRASES) {
    const where = files.filter((f) => jsxCodeOnly(f).includes(phrase));
    show(`"${phrase}"`, where);
    assert.deepEqual(
      where,
      ["src/lib/exporters/cold-audit-html.ts"],
      `"${phrase}" appears in ${where.length} files — a second copy is a copy that drifts`
    );
  }
});

check("B7 · SOURCE+RUNTIME — every heading the two surfaces share is the SAME string", () => {
  // PIVOT_SECTION_LABEL, PIVOT_SECTION_INTRO, the pipeline question and the button
  // label are all imported by the teaser. SCAN_SECTION_LABEL is the exception and
  // it is called out rather than waved through: the page still declares its own
  // `const SCAN_SECTION_LABEL`, so this check reads that literal out of the source
  // and asserts it is byte-identical to the exported constant. It fails the day
  // one of the two is edited — which is the only failure mode that matters.
  const imported = ["PIVOT_SECTION_LABEL", "PIVOT_SECTION_INTRO", "PIPELINE_DISCOVERY_QUESTION", "BOOKING_CTA_LABEL"];
  for (const name of imported) {
    assert(
      new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"@/lib/exporters/cold-audit-html"`).test(
        teaserSource
      ),
      `${TEASER_PAGE} no longer imports ${name}`
    );
  }
  show("imported by the teaser", imported);
  const m = teaserSource.match(/const\s+SCAN_SECTION_LABEL\s*=\s*"([^"]+)"/);
  show("teaser's own SCAN_SECTION_LABEL", m ? m[1] : "(imported — the duplicate is gone)");
  show("document's SCAN_SECTION_LABEL  ", SCAN_SECTION_LABEL);
  if (m) {
    assert.strictEqual(
      m[1],
      SCAN_SECTION_LABEL,
      "the teaser's copy of the findings heading no longer matches the document's"
    );
  }
  assert(documentVisible.includes(SCAN_SECTION_LABEL), "the findings heading is not on the document");
  assert(documentVisible.includes(PIVOT_SECTION_LABEL), "the pivot heading is not on the document");
  assert(documentVisible.includes(PIVOT_SECTION_INTRO), "the pivot intro is not on the document");
});

/* ──────────────────────────────────────────────────────────────────────────
 * C · ONE ASK
 * ────────────────────────────────────────────────────────────────────── */
section("C · ONE CALL TO ACTION — counted on the markup, on both surfaces");

const unconfigured = countCallsToAction(documentHtml);

check("C1 · RUNTIME — with no booking URL configured the document ships ZERO links", () => {
  show("BOOKING_URL   ", BOOKING_URL ?? "(not configured)");
  show("links on page ", unconfigured.links);
  show("secondary asks", unconfigured.secondaryAsks);
  assert.equal(BOOKING_URL, undefined, "this repo has a booking URL configured — the probe below covers that branch");
  assert.equal(unconfigured.links, 0, "a link rendered with no booking URL configured — that is a dead button to a prospect");
  assert.deepEqual(unconfigured.secondaryAsks, [], "the page offers a second way to respond");
  assert(documentVisible.includes("Where this goes next"), "the close block did not render at all");
});

check("C2 · RUNTIME (child process) — with a booking URL, EXACTLY ONE link and it is the booking link", () => {
  const probe = ctaProbeWithBookingUrl();
  show("child booking URL", probe.bookingUrl);
  show("links            ", probe.links);
  show("booking links    ", probe.bookingLinks);
  show("secondary asks   ", probe.secondaryAsks);
  show("button label     ", probe.buttonLabelOnPage ? BOOKING_CTA_LABEL : "(missing)");
  assert.equal(probe.bookingUrl, PROBE_BOOKING_URL, "the child did not pick up the configured booking URL");
  assert.equal(probe.links, 1, `the document rendered ${probe.links} links — the rule is exactly one`);
  assert.equal(probe.bookingLinks, 1, "the one link on the page is not the booking link");
  assert.deepEqual(probe.secondaryAsks, [], "the page offers a second way to respond alongside the button");
  assert(probe.buttonLabelOnPage, "the booking button rendered without its label");
});

check("C3 · SOURCE — the teaser emits exactly one anchor, and nothing else clickable", () => {
  const anchors = teaserSource.match(/<a\b/g) ?? [];
  const buttons = teaserSource.match(/<button\b/g) ?? [];
  const forms = teaserSource.match(/<form\b/g) ?? [];
  show("<a> in the teaser     ", anchors.length);
  show("<button> in the teaser", buttons.length);
  show("<form> in the teaser  ", forms.length);
  assert.equal(anchors.length, 1, `${TEASER_PAGE} emits ${anchors.length} anchors — every extra option is a way not to book`);
  assert.equal(buttons.length, 0, `${TEASER_PAGE} emits a <button>`);
  assert.equal(forms.length, 0, `${TEASER_PAGE} emits a <form>`);
  // The one thing we must never link is the site we just told them is leaking.
  assert(
    /meta\.websiteUrl \|\| meta\.businessName/.test(teaserSource),
    "the business's own URL is no longer printed as plain text in the screenshot caption"
  );
});

check("C4 · RUNTIME — a close that offers a second way to respond is swapped at the boundary", () => {
  const competing = [
    "Have a read and just reply to this email if anything stands out.",
    "Give me a call if you want to talk it through.",
    "Let me know what you think and we can go from there.",
    "Feel free to reach out to me any time.",
  ];
  for (const message of competing) {
    const drifting = baseReport();
    drifting.closingCta = { tiedToFinding: "", message };
    const out = enforceColdAuditLaws(drifting);
    show("model wrote", `"${message}"`);
    show("shipped    ", `"${out.closingCta.message}"`);
    assert(ctaOffersCompetingChannel(message), `"${message}" was not recognised as a competing ask`);
    assert.equal(
      out.closingCta.message,
      COLD_AUDIT_CTA_FALLBACK,
      "a second way to respond survived onto a prospect's page"
    );
  }
});

check("C5 · RUNTIME — the pre-sale validator FAILS a document carrying a second ask", () => {
  // The enforcer repairs the close, so the only place a second ask can survive is
  // somewhere the repair does not reach — a finding title. That is exactly where
  // the validator looks, and it is fatal there.
  const bad = baseReport();
  bad.findings = [
    { ...bad.findings[0], title: "Just reply to this email and I will send the fixes over" },
    ...bad.findings.slice(1),
  ];
  const result = validateColdAudit(bad);
  const fails = result.checks.filter((c) => c.level === "fail");
  show("fail count", fails.length);
  show("laws      ", Array.from(new Set(fails.map((c) => c.law))));
  assert(fails.length > 0, "a finding title offering a second way to respond passed the gate");
});

/* ──────────────────────────────────────────────────────────────────────────
 * D · NOTHING IS DISCLOSED BEFORE THE SALE
 * ────────────────────────────────────────────────────────────────────── */
section("D · NOTHING DISCLOSED PRE-SALE — a compile error first, three runtime backstops after");

check("D1 · COMPILE-TIME — a pre-sale detection cannot carry intake at all", () => {
  // This is the strongest guarantee in the round and it is NOT enforced by this
  // script: `intake?: never` means `detectLeaks({ mode: "pre_sale", intake: {…} })`
  // does not compile, so `npm run typecheck` is what proves it. What this check
  // does is make sure the declaration is still there — a check that says "the
  // compiler is doing the work" is worthless if somebody deleted the type.
  const src = codeOnly("src/lib/leak-detection.ts");
  const preSaleDecl = /interface PreSaleResearch extends RawResearchBase \{[^}]*mode: "pre_sale";[^}]*intake\?: never;/;
  show("PreSaleResearch declares `intake?: never`", preSaleDecl.test(src));
  assert(preSaleDecl.test(src), "PreSaleResearch no longer declares `intake?: never` — the compile-time gate is gone");
});

check("D1b · COMPILE-TIME — a pre-sale generation context cannot carry an intake-derived field", () => {
  const src = codeOnly("src/lib/cold-audit.ts");
  const fields = ["servicesFocus", "intakePresent", "bookingToolName", "gbpManagement", "buildPriorities"];
  const decl = src.slice(src.indexOf("PreSaleGenerationContext"), src.indexOf("PreSaleGenerationContext") + 400);
  for (const f of fields) {
    show(`${f}?: never`, new RegExp(`${f}\\?:\\s*never`).test(decl));
    assert(
      new RegExp(`${f}\\?:\\s*never`).test(decl),
      `PreSaleGenerationContext no longer declares ${f}?: never — a copy-paste from the paid pack would compile`
    );
  }
});

check("D2 · RUNTIME backstop 1 — detectLeaks THROWS if intake reaches a pre-sale run", () => {
  // Reachable only by defeating the type system, which is exactly why it is here.
  let threw = "";
  try {
    detectLeaks({
      mode: "pre_sale",
      business: { name: "Harbourline Air", industry: "HVAC", city: "Dartmouth" },
      intel: COLD_INTEL,
      scrape: COLD_SCRAPE,
      asOf: SCAN_DATE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      intake: { reviewReplyOwner: "NOBODY", hasCrm: false } as any,
    });
  } catch (err) {
    threw = (err as Error).message;
  }
  show("threw", threw ? `${threw.slice(0, 140)}…` : "(nothing — the backstop did not fire)");
  assert(threw, "a cast pushed intake into a pre-sale detection and nothing stopped it");
});

check("D3 · RUNTIME backstop 2 — assertNoDisclosedFindings THROWS on the way out of generation", () => {
  const smuggled = baseReport();
  smuggled.findings = [
    { ...smuggled.findings[0], evidenceGrade: "disclosed" as ColdAuditFinding["evidenceGrade"] },
    ...smuggled.findings.slice(1),
  ];
  let threw = "";
  try {
    assertNoDisclosedFindings(smuggled, "verify-phase4");
  } catch (err) {
    threw = (err as Error).message;
  }
  show("threw", threw ? `${threw.slice(0, 140)}…` : "(nothing)");
  assert(threw.includes("disclosed"), "a disclosed finding left the generator for a prospect's inbox");
  // And it does NOT throw on the honest document — a gate that always fires is a
  // gate somebody comments out.
  assertNoDisclosedFindings(enforced, "verify-phase4 clean");
});

check("D4 · RUNTIME backstop 3 — the READ path throws on an already-stored disclosure", () => {
  // Backstops 1 and 2 protect documents generated from now on. A cold audit saved
  // yesterday is only caught by reading it back, which is what the teaser's
  // loadReport does on every request.
  const stored = baseReport();
  stored.findings = stored.findings.map((f) => ({ ...f, evidenceGrade: "disclosed" as const }));
  let threw = "";
  try {
    assertStoredColdAuditSafe(stored, "public teaser /a/probe");
  } catch (err) {
    threw = (err as Error).message;
  }
  show("threw", threw ? `${threw.slice(0, 140)}…` : "(nothing)");
  assert(threw, "a stored disclosure rendered straight onto the public teaser");
  assertStoredColdAuditSafe(enforced, "public teaser clean");
});

check("D4b · SOURCE — the teaser actually CALLS the read-path gate before rendering", () => {
  show("imports assertStoredColdAuditSafe", /assertStoredColdAuditSafe/.test(teaserSource));
  assert(
    /assertStoredColdAuditSafe\(\s*raw\s*,/.test(teaserSource),
    `${TEASER_PAGE} loads a stored audit without running the disclosure gate on it`
  );
  assert(
    /enforceColdAuditLaws\(\s*raw\s*\)/.test(teaserSource),
    `${TEASER_PAGE} renders the raw stored row instead of the law-enforced document`
  );
});

check("D5 · RUNTIME — the pre-sale validator marks a disclosure FATAL, on the raw row", () => {
  const stored = baseReport();
  stored.findings = [{ ...stored.findings[0], evidenceGrade: "disclosed" }, ...stored.findings.slice(1)];
  const fails = validateColdAudit(stored).checks.filter((c) => c.level === "fail");
  show("fatal laws", fails.map((c) => c.law));
  assert(
    fails.some((c) => /disclos/i.test(c.law) || /disclos/i.test(c.message)),
    "the validator did not treat a disclosed grade as fatal"
  );
});

check("D6 · RUNTIME — a real pre-sale run produces NO disclosed leak in either artifact", () => {
  const grades = preSaleInputs.map((li) => li.grade);
  const findingGrades = enforced.findings.map((f) => f.evidenceGrade ?? "(unstamped)");
  show("leak grades from the scan", Array.from(new Set(grades)));
  show("finding grades on the doc", findingGrades);
  assert(!grades.includes("disclosed"), "a pre-sale scan produced a disclosed leak");
  assert(!findingGrades.includes("disclosed"), "a pre-sale document carries a disclosed finding");
  // The teaser reads the same enforced report through the same gate, so the same
  // absence holds there — proved by D4/D4b rather than re-asserted here.
  assert.equal(validateColdAudit(enforced, documentHtml).fails, 0, "the honest document does not pass its own gate");
});

/* ──────────────────────────────────────────────────────────────────────────
 * E · AN INFERRED LEAK NEVER READS AS A MEASUREMENT
 * ────────────────────────────────────────────────────────────────────── */
section("E · EVIDENCE VOICE — hedged where we guessed, flat where we measured, in BOTH artifacts");

check("E1 · RUNTIME — the fired set actually contains both grades (this section is not vacuous)", () => {
  const byGrade = preSaleInputs.reduce<Record<string, string[]>>((acc, li) => {
    (acc[li.grade] ??= []).push(li.id);
    return acc;
  }, {});
  show("observed", byGrade.observed ?? []);
  show("inferred", byGrade.inferred ?? []);
  assert((byGrade.observed ?? []).length > 0, "no observed leak fired — the 'left alone' half proves nothing");
  assert((byGrade.inferred ?? []).length > 0, "no inferred leak fired — the 'hedged' half proves nothing");
});

check("E2 · RUNTIME — a flat claim on an INFERRED finding is softened before it renders", () => {
  const flat = baseReport();
  const inferredIdx = flat.findings.findIndex((f) => f.evidenceGrade === "inferred");
  assert(inferredIdx >= 0, "the fixture has no inferred finding to deform");
  const before = "You receive no follow-up on a quote, and your team does not return calls after five.";
  flat.findings = flat.findings.map((f, i) => (i === inferredIdx ? { ...f, problem: before } : f));
  const after = enforceColdAuditLaws(flat).findings[inferredIdx].problem;
  show("grade ", flat.findings[inferredIdx].evidenceGrade);
  show("before", before);
  show("after ", after);
  assert.notEqual(after, before, "a flat operational assertion about an unmeasured business rendered untouched");
  assert.equal(
    flatAssertionLint(after, { grade: "inferred" }).hits.length,
    0,
    "the softened sentence still asserts an internal behaviour as fact"
  );
});

check("E3 · RUNTIME — an OBSERVED finding is left alone (hedging a measurement is the other failure)", () => {
  const measured = baseReport();
  const observedIdx = measured.findings.findIndex((f) => f.evidenceGrade === "observed");
  assert(observedIdx >= 0, "the fixture has no observed finding");
  const before = measured.findings[observedIdx].problem;
  const after = enforceColdAuditLaws(measured).findings[observedIdx].problem;
  show("grade ", measured.findings[observedIdx].evidenceGrade);
  show("before", before);
  show("after ", after);
  assert.equal(after, before, "a measured finding was hedged — the whole document then reads as guesswork");
});

check("E4 · RUNTIME — every finding on the rendered DOCUMENT passes the lint at its own grade", () => {
  for (const f of enforced.findings) {
    const grade = f.evidenceGrade ?? "inferred";
    for (const [field, text] of [
      ["problem", f.problem],
      ["whyItCosts", f.whyItCosts],
    ] as const) {
      if (!text?.trim()) continue;
      const lint = flatAssertionLint(text, { grade });
      show(`${grade} · ${f.title.slice(0, 42)}… (${field})`, lint.ok ? "clean" : lint.hits[0]);
      assert(lint.ok, `"${lint.hits[0]}" on a ${grade} finding`);
    }
  }
});

check("E5 · RUNTIME+SOURCE — the TEASER renders the same enforced prose, and says so per finding", () => {
  // The teaser calls the same enforceColdAuditLaws (proved at D4b), so E2–E4 hold
  // there by construction — the page never sees an unsoftened sentence. What the
  // page adds on top is the per-finding admission, and that IS page-local, so it
  // is checked here at source level.
  const stamps = [
    'stamp: "Pattern — we have not measured yours"',
    "We have not measured this at ",
    "Measured — ",
  ];
  for (const s of stamps) {
    show("teaser carries", `"${s}"`);
    assert(teaserSource.includes(s), `${TEASER_PAGE} no longer carries the evidence stamp "${s}"`);
  }
  // "disclosed" is unreachable on this page (D4 throws first) and is mapped onto
  // the INFERRED treatment anyway, so a future hole fails towards under-claiming
  // rather than towards a "you told us…" sentence about a conversation that
  // never happened.
  assert(
    /grade === "inferred" \|\| grade === "disclosed"/.test(teaserSource),
    `${TEASER_PAGE} no longer maps a disclosed grade onto the unmeasured treatment`
  );
  // And the document's own equivalent: a per-finding provenance line.
  assert(
    documentVisible.includes("Industry pattern — not measured for you"),
    "the document dropped the per-finding provenance line for inferred findings"
  );
  assert(
    /Measured on your public pages/.test(documentVisible),
    "the document dropped the per-finding measurement citation for observed findings"
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * F · EVERY DOLLAR FIGURE READS AS A BENCHMARK
 * ────────────────────────────────────────────────────────────────────── */
section("F · MONEY ON THE AUDIT — benchmark-derived, over a labelled assumption, in the same breath");

/** Wording that tells the reader a figure is an estimate over an assumption. Same
 *  set the renderer's backstop uses, read from the same constant. */
const BENCHMARK_MARKERS: RegExp[] = [
  new RegExp(ASSUMPTION_CAVEAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  /\bassum(e|es|ing|ption)\b/i,
  /\bbenchmark\b/i,
  /\bindustry (average|rate|figure|number|estimate)\b/i,
  /\bestimate[ds]?\b/i,
];

check("F1 · RUNTIME — a bare figure gets the benchmark label appended, in the same block", () => {
  const bare = baseReport();
  bare.headlineCost = `Missed calls are costing you around ${cad(1290)} a month.`;
  const out = enforceColdAuditLaws(bare);
  show("model wrote", bare.headlineCost);
  show("shipped    ", out.headlineCost);
  assert(out.headlineCost.includes(BENCHMARK_FIGURE_LABEL), "a bare dollar figure shipped with nothing qualifying it");
  assert(
    BENCHMARK_MARKERS.some((re) => re.test(out.headlineCost)),
    "the labelled figure still does not read as an estimate"
  );
});

check("F2 · RUNTIME — the label is idempotent (running the enforcer twice does not stack it)", () => {
  const bare = baseReport();
  bare.headlineCost = `Missed calls are costing you around ${cad(1290)} a month.`;
  const once = enforceColdAuditLaws(bare);
  const twice = enforceColdAuditLaws(once);
  show("once ", `${once.headlineCost.length} chars`);
  show("twice", `${twice.headlineCost.length} chars`);
  assert.equal(twice.headlineCost, once.headlineCost, "the benchmark label stacked on a second pass");
});

check("F3 · RUNTIME — a governed math frame is left ALONE (it already labels itself)", () => {
  const governed = baseReport();
  governed.headlineCost =
    `Missed calls: about ${cad(860)} a month in paid-for demand going unanswered, assuming 20 enquiries a month ` +
    `(${ASSUMPTION_CAVEAT}) — benchmark figures, not your books.`;
  const out = enforceColdAuditLaws(governed);
  show("in ", governed.headlineCost);
  show("out", out.headlineCost);
  assert.equal(out.headlineCost, governed.headlineCost, "the backstop re-labelled a frame that already labels itself");
});

check("F4 · RUNTIME — EVERY dollar-bearing block on the document says what kind of number it is", () => {
  // THE GRANULARITY IS THE BLOCK, NOT THE SENTENCE, and that is the honest
  // statement of the law rather than a weaker one. A governed math frame labels
  // itself IN the sentence ("assuming 20 enquiries a month (our assumption…)").
  // A bare figure the model typed gets BENCHMARK_FIGURE_LABEL appended as the
  // next sentence — same paragraph, same box on the page, directly under the
  // reader's eye. Both are "beside the number"; only a footnote somewhere else
  // in the document would not be, and there is no such thing here. So the sweep
  // asks the question the reader's eye asks: does the block I am looking at tell
  // me this is an estimate?
  // Run against a document deliberately STUFFED with money, in every slot a
  // figure can legitimately reach: the headline block (a governed frame that
  // labels itself), a finding's problem (a bare figure the backstop must label),
  // and a finding's cost line (an already-labelled one). A version of this check
  // run against the baseline document is vacuous — it quotes no figures at all —
  // so the fixture is loaded on purpose and the count is asserted below.
  const moneyed = baseReport();
  moneyed.headlineCost =
    `Missed calls: about ${cad(860)} a month in paid-for demand going unanswered, assuming 20 enquiries a month ` +
    `(${ASSUMPTION_CAVEAT}) — benchmark figures, not your books.`;
  moneyed.findings = moneyed.findings.map((f, i) =>
    i === 0
      ? {
          ...f,
          problem: `${f.problem} At the trade benchmark that is roughly ${cad(430)} a month.`,
          whyItCosts: `Every one of those is ${cad(215)} of demand you already paid for.`,
        }
      : f
  );
  const out = enforceColdAuditLaws(moneyed);
  const moneyBlocks = auditPassages(out).filter((p) => /\$\s?\d/.test(p.text));
  const unlabelled = moneyBlocks
    .filter((p) => !BENCHMARK_MARKERS.some((re) => re.test(p.text)))
    .map((p) => `${p.where}: "${p.text}"`);
  // How far the label sits from the figure, in characters, worst case. A number
  // in the hundreds means "same paragraph"; a footnote would be thousands away.
  const worstGap = Math.max(
    ...moneyBlocks.map((p) => {
      const fig = p.text.search(/\$\s?\d/);
      const marker = Math.min(
        ...BENCHMARK_MARKERS.map((re) => {
          const m = re.exec(p.text);
          return m ? Math.abs(m.index - fig) : Number.POSITIVE_INFINITY;
        })
      );
      return marker;
    })
  );
  show("dollar-bearing blocks", moneyBlocks.map((p) => p.where));
  show("sample               ", moneyBlocks[0]?.text ?? "(none)");
  show("unlabelled           ", unlabelled);
  show("worst figure→label gap", `${worstGap} characters`);
  assert(moneyBlocks.length >= 3, "the money fixture did not produce figures — this check would be vacuous");
  assert.deepEqual(unlabelled, [], "a figure on a cold audit reads as a measurement of their books");
  assert(
    worstGap < 400,
    `the qualifying wording sits ${worstGap} characters from its figure — that is a footnote, not a label`
  );
  // And the same sweep over the BASELINE document, which quotes nothing: the rule
  // is "no unlabelled figure", not "there must be a figure". A spend-anchored
  // audit with no figure at all is the correct pre-intake shape.
  const baselineUnlabelled = auditPassages(enforced)
    .filter((p) => /\$\s?\d/.test(p.text) && !BENCHMARK_MARKERS.some((re) => re.test(p.text)))
    .map((p) => p.where);
  assert.deepEqual(baselineUnlabelled, [], "the spend-anchored baseline document quotes an unlabelled figure");
});

check("F5 · RUNTIME — a figure on the document sets the eyebrow to 'industry estimate'", () => {
  const withFigure = baseReport();
  withFigure.headlineCost = `Missed calls are costing you around ${cad(1290)} a month.`;
  const html = visibleText(renderColdAuditHtml(withFigure));
  const withoutFigure = visibleText(renderColdAuditHtml(baseReport()));
  show("with a figure   ", /Your single biggest leak · industry estimate/.test(html));
  show("without a figure", /Your single biggest leak(?! · industry estimate)/.test(withoutFigure));
  assert(
    html.includes("Your single biggest leak · industry estimate"),
    "the figure renders with no eyebrow saying what kind of number it is"
  );
  assert(
    !withoutFigure.includes("industry estimate"),
    "the estimate eyebrow renders on a document that quotes no figure"
  );
});

check("F6 · RUNTIME — the money law holds INSIDE the audit: no bare '$' the prospect can see", () => {
  const withFigure = baseReport();
  withFigure.headlineCost = `Missed calls: about ${cad(1290)} a month, ${ASSUMPTION_CAVEAT}.`;
  const bare = bareDollarFigures(visibleText(renderColdAuditHtml(withFigure)));
  show("figures on the page", (visibleText(renderColdAuditHtml(withFigure)).match(/CAD \$[\d,]+/g) ?? []).join(", "));
  show("bare figures       ", bare);
  assert.deepEqual(bare, [], "a bare dollar figure reached the audit — 'CAD' goes BEFORE the figure, everywhere");
});

/* ──────────────────────────────────────────────────────────────────────────
 * G · NOTHING RECOMMENDS TRAFFIC WORK OR A WEBSITE REBUILD
 * ────────────────────────────────────────────────────────────────────── */
section("G · SCOPE — we fix conversion of demand that already exists, and we do not build websites");

check("G1 · RUNTIME — the clean document contains ZERO out-of-scope recommendations", () => {
  const hits = scopeViolations(enforced);
  show("passages scanned", auditPassages(enforced).length);
  show("hits            ", hits);
  assert.deepEqual(hits, [], "the baseline document already recommends work we do not sell");
  assert.deepEqual(outOfScopeHits(documentVisible), [], "the RENDERED page carries an out-of-scope recommendation");
});

check("G2 · RUNTIME — a prescription is lifted out sentence by sentence, and the rest survives", () => {
  const straying = baseReport();
  const keep = "Neither the site nor the Google profile carries a booking link.";
  const drop = "You should invest in SEO and redesign your website to fix it.";
  straying.findings = straying.findings.map((f, i) =>
    i === 0 ? { ...f, problem: `${keep} ${drop}` } : f
  );
  const out = enforceColdAuditLaws(straying);
  show("in ", `${keep} ${drop}`);
  show("out", out.findings[0].problem);
  assert(out.findings[0].problem.includes(keep), "the sweep took the good sentence with the bad one");
  assert(!out.findings[0].problem.includes("invest in SEO"), "an SEO recommendation reached the page");
  assert(!/redesign your website/i.test(out.findings[0].problem), "a rebuild recommendation reached the page");
});

check("G3 · RUNTIME — the ESCAPE HATCH: a document is never emptied of findings", () => {
  // Every problem statement is a recommendation we do not make. Stripping them
  // all would leave a "findings" heading with nothing under it. A cold audit with
  // a bad sentence in it is recoverable at 11pm; one with no findings is not a
  // document, so the findings stay and the operator sees the problem.
  const allBad = baseReport();
  allBad.findings = allBad.findings.map((f) => ({
    ...f,
    problem: "You should run Google Ads and rebuild the website.",
  }));
  const out = enforceColdAuditLaws(allBad);
  show("findings in ", allBad.findings.length);
  show("findings out", out.findings.length);
  assert.equal(out.findings.length, allBad.findings.length, "the sweep emptied the document of findings");
});

check("G4 · RUNTIME — a NEGATED mention survives, because it is his best line", () => {
  const negations = [
    "We do not need a new website.",
    "It does not cover how to get more enquiries, which is out of scope for this engagement by design.",
    "This is not a website redesign.",
    "We never rebuild your site.",
  ];
  for (const s of negations) {
    show("survives", `"${s}"`);
    assert.deepEqual(
      outOfScopeHits(s),
      [],
      `"${s}" was flagged as out of scope — it is the sentence that stops a prospect reading this as a web-design pitch`
    );
  }
});

check("G5 · RUNTIME — the prescriptions that MUST be caught, one shape at a time", () => {
  const prescriptions = [
    "You should invest in SEO to fix this.",
    "Consider running Google Ads to bring in more leads.",
    "You need to drive more traffic to the site.",
    "Redesign your website so it converts.",
    "A new website would solve this.",
    "This will help you rank higher on Google.",
  ];
  for (const s of prescriptions) {
    const hits = outOfScopeHits(s);
    show("caught", `"${s}" → ${hits.length}`);
    assert.equal(hits.length, 1, `"${s}" was not caught by the scope sweep`);
  }
});

check("G6 · RUNTIME — a header that strays is REPLACED, not trimmed to nothing", () => {
  const strayHeader = baseReport();
  strayHeader.headline = "Rebuild your website and rank higher on Google";
  strayHeader.intro = "You need to drive more traffic to this page.";
  const out = enforceColdAuditLaws(strayHeader);
  show("headline out", out.headline);
  show("intro out   ", out.intro);
  assert(out.headline.includes("Harbourline Air"), "the replacement headline lost the business name");
  assert.deepEqual(outOfScopeHits(out.headline), [], "the headline still strays");
  assert.deepEqual(outOfScopeHits(out.intro), [], "the intro still strays");
  assert(out.intro.trim().length > 0, "the intro was emptied rather than replaced");
});

/* ──────────────────────────────────────────────────────────────────────────
 * H · THE MONEY LAW ON THE PUBLIC PROPOSAL PAGE
 * ────────────────────────────────────────────────────────────────────── */
section("H · THE MONEY LAW — 'CAD $6,500', never a bare '$6,500', on the page a prospect decides on");

const PROSPECT = { name: "Harbourline Air", industry: "HVAC", city: "Dartmouth" };

function renderProposal(content: ProposalContent): string {
  return renderToStaticMarkup(
    createElement(PublicProposal, { business: PROSPECT, content })
  );
}

check("H1 · RUNTIME — the default proposal renders with no bare dollar figure anywhere visible", () => {
  const html = renderProposal(buildProposalDefaults(PROSPECT));
  const visible = visibleText(html);
  const bare = bareDollarFigures(visible);
  show("marked figures", Array.from(new Set(visible.match(/CAD \$[\d,]+/g) ?? [])).slice(0, 6));
  show("bare figures  ", bare);
  assert.deepEqual(bare, [], "the proposal a prospect opens carries a bare dollar figure");
});

check("H2 · RUNTIME — a hand-edited proposal carrying bare figures is repaired at the page", () => {
  // The prose is SAVED on the proposal row and editable afterwards, so a proposal
  // written before the convention was fixed can still reach this page carrying a
  // bare "$2,400" or a trailing "$18,500 CAD". The component is the last thing
  // between that text and the buyer.
  const content = buildProposalDefaults(PROSPECT);
  const dirty: ProposalContent = {
    ...content,
    packageOverview: "The build is $6,500 one-time and the retainer is $1,000 CAD a month.",
    problem: {
      summary: "Roughly $2,400 a month is leaking out before it converts.",
      basis: "Estimated at $2,400–$4,100 a month from the audit.",
      leaks: [
        {
          title: "Missed calls",
          monthlyCost: "$1,290 / mo",
          detail: "About $1,290 a month of demand you already paid for, going unanswered.",
        },
      ],
    },
    roi: { ...content.roi, summary: "Recovering $18,500 CAD over a year.", points: ["$860 a month, conservatively."] },
  };
  const visible = visibleText(renderProposal(dirty));
  show("input carried", ["$6,500", "$1,000 CAD", "$2,400", "$1,290", "$18,500 CAD", "$860"]);
  show("bare on page ", bareDollarFigures(visible));
  assert.deepEqual(bareDollarFigures(visible), [], "a hand-edited bare figure reached the buyer");
  for (const fig of ["CAD $6,500", "CAD $2,400", "CAD $1,290", "CAD $18,500", "CAD $860"]) {
    assert(visible.includes(fig), `"${fig}" is not on the rendered page — the guard changed the digits or dropped one`);
  }
  assert(!/\$18,500\s*CAD/.test(visible), "the now-redundant trailing CAD survived beside a marked figure");
});

check("H3 · RUNTIME — the two headline prices are the offer's prices, CAD-marked", () => {
  const visible = visibleText(renderProposal(buildProposalDefaults(PROSPECT)));
  show("one-time", /CAD\s*\$6,500/.test(visible));
  show("monthly ", /CAD\s*\$1,000/.test(visible));
  assert(/CAD\s*\$6,500/.test(visible), "the one-time fee is not rendered as CAD $6,500");
  assert(/CAD\s*\$1,000/.test(visible), "the monthly retainer is not rendered as CAD $1,000");
});

check("H4 · RUNTIME — a foreign-currency figure somebody wrote on purpose is left alone", () => {
  // "US$84" is not the money law being broken, it is a different currency. A guard
  // that rewrote it would be inventing a number, which is worse than the ambiguity
  // it is trying to remove.
  const content = buildProposalDefaults(PROSPECT);
  const withUsd: ProposalContent = {
    ...content,
    roi: { ...content.roi, points: ["Industry cost per lead runs US$84 before conversion."] },
  };
  const visible = visibleText(renderProposal(withUsd));
  show("on the page", /US\$84/.test(visible));
  assert(visible.includes("US$84"), "a deliberately foreign figure was rewritten as CAD");
  assert.deepEqual(bareDollarFigures(visible), [], "the foreign figure was counted as a bare one");
});

/* ──────────────────────────────────────────────────────────────────────────
 * I · THE OWNER'S DOCUMENT IS KEPT TRUE BY THE CODE
 * ────────────────────────────────────────────────────────────────────── */
section("I · docs/final-verification.md — every list in it is re-derived and compared, not trusted");

const DOC_PATH = "docs/final-verification.md";
const doc = read(DOC_PATH);

/** The cells of every pipe-table row in the document, trimmed. Header and
 *  separator rows are dropped. Reading the doc as DATA is the point: a list
 *  somebody hand-edited into it stops matching the code and this section fails. */
function docTableRows(): string[][] {
  return doc
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
}
const docRows = docTableRows();

check("I1 · the twelve intake questions in the doc ARE intakeFieldsForZeroInferred()", () => {
  const fields = intakeFieldsForZeroInferred();
  // The doc's question table is the one whose rows carry a backticked field name
  // that is a real ClientIntake key from the generated set.
  const wanted = new Map(fields.map((f) => [f.field as string, f]));
  const rows = docRows.filter((r) => r.length >= 4 && /^`[a-zA-Z]+`$/.test(r[2]) && wanted.has(r[2].replace(/`/g, "")));
  show("questions produced by the code", fields.length);
  show("question rows found in the doc ", rows.length);
  assert.equal(rows.length, fields.length, "the doc lists a different number of intake questions than the code produces");
  fields.forEach((f, i) => {
    const row = rows[i];
    show(`${i + 1}. ${f.field}`, `"${f.question}" → ${f.upgrades.join(", ")}`);
    assert.equal(row[2].replace(/`/g, ""), f.field, `row ${i + 1} names field "${row[2]}", the code says "${f.field}"`);
    assert.equal(row[1], f.question, `row ${i + 1} quotes the question differently from the intake form`);
    assert.equal(
      row[3],
      f.upgrades.join(", "),
      `row ${i + 1} lists the wrong leaks for "${f.field}" — the doc says "${row[3]}", the code says "${f.upgrades.join(", ")}"`
    );
  });
});

check("I2 · the doc's 'no question asked' list IS the taxonomy's, and every one of them is MEASURED", () => {
  const noAsk = LEAKS.filter((l) => !l.intakeAsk);
  const inScope = noAsk.filter((l) => l.scope !== "out_of_scope");
  show("leaks with no intake question", noAsk.map((l) => l.id));
  show("of those, in scope           ", inScope.map((l) => l.id));
  for (const l of noAsk) {
    assert(
      doc.includes(`\`${l.id}\``),
      `${DOC_PATH} does not mention "${l.id}", which has no intake question behind it — the owner would not know it exists`
    );
  }
  // The claim the document makes out loud: nothing is left with NO evidence
  // source. That is only true because every question-less in-scope leak is one
  // we measure ourselves.
  for (const l of inScope) {
    assert.equal(
      l.evidenceClass,
      "OBSERVED",
      `"${l.id}" has no intake question AND is not something we observe — the doc's claim that no leak is left without an evidence source is now false`
    );
  }
  assert(
    doc.includes("the answer to “which leaks still have no evidence source” is: none") ||
      doc.includes("is: none"),
    "the doc no longer states the conclusion this check verifies"
  );
});

check("I3 · the 60-day mapping printed in the doc IS NURTURE_SEQUENCE, step for step", () => {
  const rows = docRows.filter((r) => r.length === 4 && /^\d+$/.test(r[0]) && /^(Email|Text) \d+$/.test(r[1]));
  show("steps in the canvas", NURTURE_SEQUENCE.length);
  show("rows in the doc    ", rows.length);
  assert.equal(rows.length, NURTURE_SEQUENCE.length, "the doc prints a different number of nurture steps than the workflow has");
  NURTURE_SEQUENCE.forEach((s, i) => {
    const row = rows[i];
    assert.equal(Number(row[0]), s.step, `row ${i + 1} is step ${row[0]}, the canvas says ${s.step}`);
    assert.equal(row[1], `${s.channel} ${s.index}`, `row ${i + 1} names "${row[1]}", the canvas says "${s.channel} ${s.index}"`);
    assert.equal(Number(row[2]), s.day, `row ${i + 1} is day ${row[2]}, the canvas says ${s.day}`);
    assert.equal(row[3], s.purpose, `row ${i + 1} describes step ${s.step} differently from the canvas`);
  });
  const emails = NURTURE_SEQUENCE.filter((s) => s.channel === "Email").length;
  const texts = NURTURE_SEQUENCE.filter((s) => s.channel === "Text").length;
  const lastDay = Math.max(...NURTURE_SEQUENCE.map((s) => s.day));
  show("emails / texts / last day", `${emails} / ${texts} / ${lastDay}`);
  assert(
    doc.includes(`${NURTURE_SEQUENCE.length} steps, ${NURTURE_SEQUENCE.length} assets, ${lastDay} days`) ||
      doc.includes("Thirteen steps, thirteen assets, sixty days"),
    "the doc's summary sentence no longer matches the canvas"
  );
  assert.equal(emails, 7, "the email half is no longer seven messages — update the doc's summary sentence");
  assert.equal(texts, 6, "the text half is no longer six messages — update the doc's summary sentence");
  assert.equal(lastDay, 60, "the sequence no longer runs the full sixty days");
});

check("I4 · every command the doc tells the owner to run actually exists", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  const commands = Array.from(new Set(doc.match(/`npm run [a-z0-9:._-]+`/g) ?? [])).map((c) =>
    c.replace(/`|npm run /g, "")
  );
  show("commands named in the doc", commands);
  for (const c of commands) {
    assert(pkg.scripts[c], `${DOC_PATH} tells the owner to run "npm run ${c}", which is not in package.json`);
  }
  // And the one that matters most is wired into the chain.
  assert(
    pkg.scripts["verify:all"].includes("verify:phase4"),
    "verify:phase4 is not in the verify:all chain — the acceptance test does not run this file"
  );
  assert(pkg.scripts["fixtures:clients"], "the fixture-clients script is not wired into package.json");
});

check("I5 · the three fixture clients described in the doc are the ones on disk", () => {
  const dirs = [
    "01-pre-sale-cedar-ridge-plumbing",
    "02-full-intake-harbourline-electric",
    "03-toggled-pinecrest-roofing",
  ];
  for (const d of dirs) {
    assert(doc.includes(d), `${DOC_PATH} does not describe the fixture client "${d}"`);
    const path = `_fixtures/clients/${d}/pack.json`;
    if (!existsSync(resolve(REPO, path))) {
      // Not a failure of the document — a failure to have run the generator. Say
      // which command fixes it rather than leaving a bare ENOENT.
      throw new Error(`${path} is missing. Rebuild the fixtures with: npm run fixtures:clients`);
    }
    const pack = JSON.parse(read(path)) as {
      intelligence?: { leakAnalysis?: { evidenceGrade?: string }[] };
      meta: { internalTest?: boolean };
    };
    const leaks = pack.intelligence?.leakAnalysis ?? [];
    const count = (g: string) => leaks.filter((l) => (l.evidenceGrade ?? "inferred") === g).length;
    show(d, `${leaks.length} leaks · observed ${count("observed")} · disclosed ${count("disclosed")} · inferred ${count("inferred")}`);
    // Byte-for-byte against the sentence the owner reads. No fallback branch: a
    // check that passes when EITHER the leak count OR the grade split matches is
    // a check that goes quiet exactly when the two disagree.
    assert(
      doc.includes(
        `${leaks.length} leaks: **${count("observed")} observed, ${count("disclosed")} disclosed, ${count("inferred")} inferred**`
      ),
      `${DOC_PATH} quotes different figures for "${d}" than the committed pack carries ` +
        `(pack: ${leaks.length} leaks, ${count("observed")}/${count("disclosed")}/${count("inferred")}). ` +
        "Re-run npm run fixtures:clients, then update the table in section 4."
    );
    // The pre-sale client is the one claim in the doc that is a promise rather
    // than a description, so it is asserted rather than merely quoted.
    if (d.startsWith("01-")) {
      assert.equal(count("disclosed"), 0, "the pre-sale fixture carries a disclosed leak — nothing has been disclosed");
      assert.equal(pack.meta.internalTest, true, "the pre-sale fixture is not flagged as generated without intake");
    } else {
      assert(count("disclosed") > 0, `"${d}" answered the intake form and nothing came back disclosed`);
      assert.notEqual(pack.meta.internalTest, true, `"${d}" has intake but is flagged as generated without it`);
    }
  }
});

check("I6 · sections A–G hold on the COMMITTED fixture cold audits, not only on this file's fixture", () => {
  // The loop closed. Everything above runs against a report built in this file,
  // which is a fair test of the code but not of the artifacts. These are the
  // documents `npm run fixtures:clients` actually wrote to disk — the ones a
  // reader opens — and the whole of Phase 4 is re-asserted on their rendered
  // markup. If a fixture is regenerated with a different shape, this fails.
  const dirs = [
    "01-pre-sale-cedar-ridge-plumbing",
    "02-full-intake-harbourline-electric",
    "03-toggled-pinecrest-roofing",
  ];
  for (const d of dirs) {
    const html = read(`_fixtures/clients/${d}/00-cold-audit.html`);
    const visible = visibleText(html);
    const stored = JSON.parse(read(`_fixtures/clients/${d}/cold-audit.json`)) as ColdAuditReport;
    const counts = countCallsToAction(html);
    const money = bareDollarFigures(visible);
    show(
      d,
      `findings ${stored.findings.length} · links ${counts.links} · secondary asks ${counts.secondaryAsks.length} · bare $ ${money.length}`
    );

    // A — the frame, before any finding.
    assert(visible.includes(OUTSIDE_INSIDE_FRAME.lead), `${d}: the outside/inside frame is not on the page`);
    assert(
      visible.indexOf(OUTSIDE_INSIDE_FRAME.lead) < visible.indexOf(stored.findings[0].title),
      `${d}: a finding lands before the frame`
    );
    // B — the six, verbatim.
    for (const phrase of PIVOT_LEAK_PHRASES)
      assert(visible.includes(phrase), `${d}: "${phrase}" is not on the page`);
    // C — one ask. BOOKING_URL is unset in this repo, so the correct link count
    // here is zero; the configured branch is proved by the child probe at C2.
    assert.equal(counts.links, BOOKING_URL ? 1 : 0, `${d}: wrong number of links on the page`);
    assert.deepEqual(counts.secondaryAsks, [], `${d}: the page offers a second way to respond`);
    // D — nothing disclosed, on a document emailed before the Zoom. Note this
    // holds for the two clients who HAVE filled in the intake form: their audit
    // is written from a separate pre-sale detection.
    assert(
      !stored.findings.some((f) => f.evidenceGrade === "disclosed"),
      `${d}: the cold audit carries a disclosed finding`
    );
    // E — voice matches grade, per finding.
    for (const f of stored.findings) {
      const grade = f.evidenceGrade ?? "inferred";
      for (const text of [f.problem, f.whyItCosts]) {
        if (!text?.trim()) continue;
        const lint = flatAssertionLint(text, { grade });
        assert(lint.ok, `${d}: "${lint.hits[0]}" on a ${grade} finding`);
      }
    }
    // F — the money law inside the audit.
    assert.deepEqual(money, [], `${d}: a bare dollar figure reached the audit`);
    // G — nothing recommends work we do not sell.
    assert.deepEqual(scopeViolations(stored), [], `${d}: the stored audit carries an out-of-scope recommendation`);
    assert.deepEqual(outOfScopeHits(visible), [], `${d}: the rendered page carries an out-of-scope recommendation`);
    // And the whole pre-sale gate, on the artifact.
    assert.equal(validateColdAudit(stored, html).fails, 0, `${d}: the written cold audit does not pass its own gate`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
 * J. THE MONEY LAW, MECHANICALLY — the SOURCE, not just the rendered page.
 *
 * Section H already proves the RENDERED proposal carries no bare figure. This is
 * the complement: it reads the SOURCE of the prospect-facing files, so a new bare
 * "$" cannot be typed in the first place. H catches a bad value; J catches a bad
 * habit.
 *
 * WHY A SOURCE-LEVEL SCAN AND NOT ANOTHER SWEEP. Three separately hand-rolled
 * money formatters survived several deliberate passes over this codebase. They
 * survived for one reason: a literal "$" written in JSX text reads as PROSE, so
 * anything looking for a formatter CALL walks straight past it. That is how a
 * public proposal came to render "$6,500 CAD" beside an audit rendering
 * "CAD $1,290" — two documents, apparently from two companies, on the page where
 * a prospect decides to pay.
 *
 * The audit's math strings are already locked (verify-phase05 D1). This locks the
 * other half: the UI files a PROSPECT sees.
 *
 * SCOPE IS DELIBERATE AND NARROW, and the exclusions are stated rather than
 * silent. Kevin's own internal playbook page is excluded: it is his reading
 * material, and it legitimately contains prose ranges like "$300k–$3M revenue"
 * which are market sizing, not prices. Prompt strings are excluded for the same
 * reason — they instruct a model, they are not rendered. If either ever becomes
 * client-facing, add it here.
 * ══════════════════════════════════════════════════════════════════════════ */

section("J · THE MONEY LAW, MECHANICALLY — the SOURCE, not just the rendered page");

check("J1 · every rendered dollar figure a prospect can see carries the CAD marker", () => {
  // The two genuinely public surfaces, plus the operator screens that print a
  // price beside an audit figure — the exact place a mismatch is noticed.
  const FILES = [
    "src/components/proposals/PublicProposal.tsx",
    "src/app/a/[publicId]/page.tsx",
    "src/app/(dashboard)/proposals/page.tsx",
    "src/app/(dashboard)/library/page.tsx",
    "src/app/(dashboard)/businesses/[id]/page.tsx",
    "src/app/(dashboard)/crm/page.tsx",
  ];
  const offenders: string[] = [];
  for (const rel of FILES) {
    const abs = resolve(REPO, rel);
    if (!existsSync(abs)) {
      offenders.push(`${rel}: file not found — the scan cannot vouch for a path that moved`);
      continue;
    }
    const lines = readFileSync(abs, "utf8").split("\n");

    // A trailing "$" whose figure sits on the NEXT line is invisible to a
    // line-by-line scan, and one real violation was written exactly that way:
    // JSX wrapping left `· $` at the end of one line and `{stats.pipelineMRR}`
    // at the start of the next. It CANNOT be closed by joining the lines first —
    // that produces `${`, which is exactly the template-placeholder form the scan
    // is meant to skip, so the join would hide the bug instead of finding it. It
    // is its own rule: in JSX, a line ending in a bare "$" with an expression
    // opening the next line is always this mistake.
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
      if (/\$$/.test(t) && /^\{/.test((lines[i + 1] ?? "").trim())) {
        offenders.push(`${rel}:${i + 1} → (figure wraps to the next line) ${t.slice(-60)}`);
      }
    });

    lines
      .forEach((line, i) => {
        // Skip comment lines — including JSX comments, which is how a line
        // EXPLAINING a past violation ("this printed a raw $1000/mo") gets
        // flagged as one. The comment is the fix's own documentation.
        const t = line.trim();
        if (
          t.startsWith("//") ||
          t.startsWith("*") ||
          t.startsWith("/*") ||
          t.startsWith("{/*")
        )
          return;
        for (let j = 0; j < line.length; j++) {
          if (line[j] !== "$") continue;
          if (line[j + 1] === "{") continue; // a template placeholder, not a sign
          if (line[j - 1] === "\\") continue; // escaped
          if (line.slice(Math.max(0, j - 4), j) === "CAD ") continue; // already marked
          // Only a "$" immediately followed by a digit or an interpolation is a
          // rendered figure. A lone "$" in prose is not money.
          if (!/^\$\s*(\d|\$\{)/.test(line.slice(j))) continue;
          offenders.push(`${rel}:${i + 1} → ${t.slice(0, 78)}`);
        }
      });
  }
  show("files scanned", FILES.length);
  show("unmarked figures", offenders.length ? offenders.slice(0, 8) : "(none)");
  assert.equal(
    offenders.length,
    0,
    `${offenders.length} unmarked dollar figure(s) on a prospect-facing surface:\n  ${offenders
      .slice(0, 8)
      .join("\n  ")}\nRoute it through formatCurrency (src/lib/utils.ts). The marker goes BEFORE the figure.`
  );
});

check("J2 · the scan is not vacuous — it CATCHES an unmarked figure", () => {
  // Same predicate, run over a line that is deliberately wrong. Without this, H1
  // would keep passing if the matcher silently stopped matching anything.
  const bad = `          <KpiCard label="Closed MRR" value={\`$\${closedMRR.toLocaleString()}\`} />`;
  const good = `          <KpiCard label="Closed MRR" value={formatCurrency(closedMRR)} />`;
  const flags = (line: string): boolean => {
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== "$") continue;
      if (line[j + 1] === "{") continue;
      if (line[j - 1] === "\\") continue;
      if (line.slice(Math.max(0, j - 4), j) === "CAD ") continue;
      if (!/^\$\s*(\d|\$\{)/.test(line.slice(j))) continue;
      return true;
    }
    return false;
  };
  show("flags the hand-built form", flags(bad));
  show("passes the formatter form ", !flags(good));
  assert(flags(bad), "the matcher no longer catches a hand-built money string — H1 proves nothing");
  assert(!flags(good), "the matcher flags a correct formatCurrency call — it would block the fix");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    "\nThis suite is the Phase 4 acceptance test: the cold audit earns the right to ask questions and\n" +
      "hands off. A failure here means a document is back to trying to close somebody, or is claiming\n" +
      "something we cannot stand behind in front of the owner.\n"
  );
  process.exit(1);
}
console.log("\nALL CHECKS PASSED\n");
