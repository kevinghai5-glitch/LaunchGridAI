/**
 * OBSERVED-FACTS PROOF — the cold audit's replacement is a table row, and a
 * table row cannot hallucinate. Offline: no network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-facts.ts
 *   npm run verify:facts
 *
 * THE RULING THIS PINS (2026-07-29): "Four measured numbers on a screen do it
 * better, because a number cannot hallucinate." That is only true while the row
 * stays THRESHOLD-PURE — values read off stored snapshots, verdicts from
 * hardcoded thresholds, missing data rendered as "—" and never filled in, and
 * no model anywhere in the file. This suite is what keeps a generative "helpful
 * improvement" out of the one surface that replaced a generative document.
 *
 *   A. THRESHOLD-PURE, AT THE SOURCE — src/lib/observed-facts.ts and
 *      ObservedFactsRow.tsx contain no LLM import, no LLM call, no fetch, no
 *      prisma. The thresholds are literals, pinned by value, and the review
 *      threshold is byte-for-byte the paid detector's statistic.
 *   B. FULL DATA RENDERS ALL FOUR VALUES — a business with both snapshots
 *      produces four measured values with mechanical verdicts, and the rendered
 *      row prints them.
 *   C. PARTIAL DATA RENDERS "—" — an unscanned business is four dashes and
 *      verdict `unknown`, never "none", never an inference; a PSI-only business
 *      shows exactly the half that was measured.
 *   D. THE EMAIL IS EXACTLY THREE SENTENCES — every non-empty variant of the
 *      owner-approved "just email me" note is three sentences, carries no
 *      dollar sign, and an unset booking URL yields a VISIBLE "{booking link}"
 *      placeholder rather than a silent omission. Nothing measured yields ""
 *      (the button disables — a template must not claim a look that never
 *      happened).
 *
 * READ THE LABELS: A is SOURCE-LEVEL, B–D are RUNTIME on the shipped functions.
 */

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ObservedFactsRow.tsx is written for Next's automatic JSX runtime (no React
// import of its own). tsx compiles JSX with the classic transform under this
// repo's `"jsx": "preserve"` tsconfig, so the classic global has to exist here.
// Harness accommodation only — nothing about the component changes.
(globalThis as { React?: unknown }).React = React;

import {
  MOBILE_LOAD_WORTH_FIXING_ABOVE_S,
  MOBILE_SCORE_WORTH_FIXING_BELOW,
  REVIEW_COUNT_WORTH_FIXING_FRACTION,
  computeObservedFacts,
  unknownObservedFacts,
  type ObservedFacts,
  type ObservedFactsHost,
} from "@/lib/observed-facts";
import {
  ObservedFactsRow,
  buildObservedEmail,
  buildObservedLine,
} from "@/components/businesses/ObservedFactsRow";
import type { PsiBundle } from "@/lib/pagespeed";
import type { ResearchBundle } from "@/lib/research-snapshot";

// ── harness — same shape as the other verify scripts ──────────────────────────

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

/** Source with comments removed, so a scan cannot be satisfied — or tripped —
 *  by prose. Same stripper the other verify scripts use. */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ════════════════════════════════════════════════════════════════════════════
 * FIXTURES — synthetic, committed-safe: .example domain, 555-01xx phone.
 * The snapshots are shaped exactly as the write paths persist them (PsiBundle /
 * ResearchBundle), because computeObservedFacts parses them defensively and a
 * fixture in a private shape would be testing the parser against nothing real.
 * ══════════════════════════════════════════════════════════════════════════ */

const AS_OF = "2026-07-01T12:00:00.000Z";

/** A slow mobile page: score under the threshold, LCP over it. */
const PSI_SLOW: PsiBundle = {
  available: true,
  url: "https://harbourline-air.example",
  mobile: {
    strategy: "mobile",
    performanceScore: 62,
    metrics: { lcpSeconds: 4.1, cls: 0.05, inpMs: 210, fcpSeconds: 2.1, ttfbMs: 640, speedIndexSeconds: 4.0 },
    topOpportunities: [],
  },
  desktop: {
    strategy: "desktop",
    performanceScore: 91,
    metrics: { lcpSeconds: 1.5, cls: 0.01, inpMs: 80, fcpSeconds: 0.9, ttfbMs: 350, speedIndexSeconds: 1.6 },
    topOpportunities: [],
  },
};

/** A site that visibly HAS the two presence signals: a tel: link and a booking
 *  provider link, in the post-JS DOM the detection reads. */
const SITE_HTML = `<!doctype html><html lang="en"><head>
<title>Harbourline Air — Furnace and Heat Pump Service in Dartmouth</title></head><body>
<header><a class="logo" href="/">Harbourline Air</a>
<nav><a href="/services">Services</a><a href="/contact">Contact</a>
<a class="btn" href="tel:+19025550117">902-555-0117</a></nav></header>
<section class="hero"><h1>Furnace and heat pump service across Dartmouth</h1>
<a class="btn primary" href="https://calendly.com/harbourline/service-call">Book a service call</a></section>
<footer><p><a href="tel:+19025550117">902-555-0117</a></p></footer>
</body></html>`;

function researchBundle(): ResearchBundle {
  return {
    asOf: AS_OF,
    page: { text: "Furnace and heat pump service across Dartmouth.", html: SITE_HTML },
    reviews: [
      { author: "A homeowner", rating: 5, text: "Fast, tidy, explained everything.", when: "2 months ago" },
    ],
    // SIX competitors, deliberately ≥ LOCAL_MEDIAN_MIN_SAMPLE (5): the median may
    // only be quoted from a real market cross-section (owner rule — "if the
    // median is computed from fewer than ~5 competitors it's meaningless").
    // Counts [80, 90, 105, 120, 150, 310] → upper median 120, so every
    // "local median 120" pin below stays byte-true. The 310 outlier and the
    // 5.0★-with-80 row also encode WHY it is the FULL set, not top-rated-3:
    // rating-sorted top-3 here would be [80, 105, 310] → median 105 ≠ 120.
    competitors: [
      { name: "Ridgeline Mechanical", rating: 4.6, reviewCount: 150, website: "", category: "HVAC contractor", address: "Halifax NS" },
      { name: "Two Rivers Comfort", rating: 4.5, reviewCount: 120, website: "", category: "HVAC contractor", address: "Dartmouth NS" },
      { name: "Basinview Heat Pumps", rating: 4.4, reviewCount: 90, website: "", category: "HVAC contractor", address: "Dartmouth NS" },
      { name: "Northport Climate", rating: 5.0, reviewCount: 80, website: "", category: "HVAC contractor", address: "Dartmouth NS" },
      { name: "Cobequid Heating", rating: 4.8, reviewCount: 105, website: "", category: "HVAC contractor", address: "Halifax NS" },
      { name: "Atlantic Air Co", rating: 4.3, reviewCount: 310, website: "", category: "HVAC contractor", address: "Halifax NS" },
    ],
    scrape: {
      used: true,
      homepage: {
        url: "https://harbourline-air.example/",
        title: "Harbourline Air",
        description: "",
        markdown: "# Furnace and heat pump service across Dartmouth",
        html: SITE_HTML,
        rawHtml: SITE_HTML,
        links: [],
      },
      subpages: [],
    },
    dfs: {
      available: true,
      gbp: {
        available: true,
        category: "HVAC contractor",
        hasHours: true,
        limitedHours: true,
        hasWebsite: true,
        hasPhone: true,
        hasMenuLink: false,
        hasBookingLink: false,
        hasPhotos: true,
        attributesPresent: [],
        attributesMissing: [],
      },
      reviews: {
        available: true,
        count: 16,
        averageRating: 4.3,
        positive: 1,
        neutral: 0,
        negative: 0,
        positiveThemes: [],
        negativeThemes: [],
        trustGaps: [],
        recentNegativeQuote: null,
        recentPositiveQuote: "Fast, tidy, explained everything.",
        reviews: [{ rating: 5, text: "Fast, tidy, explained everything.", date: AS_OF }],
      },
    },
  };
}

function host(overrides: Partial<ObservedFactsHost>): ObservedFactsHost {
  return {
    id: "fixture-observed-facts",
    name: "Harbourline Air",
    industry: "HVAC",
    category: "HVAC contractor",
    city: "Dartmouth",
    phone: "902-555-0117",
    address: "Dartmouth NS",
    website: "https://harbourline-air.example",
    rating: 4.3,
    reviewCount: 16,
    ownerName: null,
    psiSnapshot: null,
    psiSnapshotAt: null,
    researchSnapshot: null,
    researchSnapshotAt: null,
    ...overrides,
  };
}

const FULL = computeObservedFacts(
  host({ psiSnapshot: PSI_SLOW, psiSnapshotAt: AS_OF, researchSnapshot: researchBundle(), researchSnapshotAt: AS_OF })
);
const NEVER_SCANNED = computeObservedFacts(host({ reviewCount: null, rating: null }));
const PSI_ONLY = computeObservedFacts(host({ psiSnapshot: PSI_SLOW, psiSnapshotAt: AS_OF, reviewCount: null, rating: null }));

function renderRow(facts: ObservedFacts | null): string {
  return renderToStaticMarkup(createElement(ObservedFactsRow, { facts }));
}

/* ════════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

console.log("\nOBSERVED-FACTS VERIFICATION — four measured numbers, thresholds in code, dashes where we could not see");

/* ──────────────────────────────────────────────────────────────────────────
 * A · THRESHOLD-PURE, AT THE SOURCE
 * ────────────────────────────────────────────────────────────────────── */
section("A · THRESHOLD-PURE — no model, no network, no database, thresholds pinned");

const LIB = "src/lib/observed-facts.ts";
const ROW = "src/components/businesses/ObservedFactsRow.tsx";

check("A1 · SOURCE — neither file imports or calls anything LLM-shaped, and the lib does no I/O", () => {
  // The row's whole argument is "a number cannot hallucinate". One import of the
  // model client — or one fetch to go get fresher data mid-render — and that
  // argument is gone. Comment-stripped, so prose ABOUT the rule cannot trip it.
  const FORBIDDEN: { name: string; re: RegExp; files: string[] }[] = [
    { name: 'the openai client (module or wrapper)', re: /from\s+["'](openai|@\/lib\/openai)["']/, files: [LIB, ROW] },
    { name: "an LLM completion call", re: /chat\.completions|completions\.create|responses\.create|\banthropic\b/i, files: [LIB, ROW] },
    { name: "a generation route or generator lib", re: /["'][^"']*\/generate\/[^"']*["']|@\/lib\/asset-generation/, files: [LIB, ROW] },
    // The lib documents itself as pure CPU over stored snapshots. Hold it to that.
    { name: "a network call", re: /\bfetch\s*\(/, files: [LIB, ROW] },
    { name: "a database read", re: /\bprisma\b/i, files: [LIB] },
  ];
  for (const f of FORBIDDEN) {
    for (const rel of f.files) {
      const hit = f.re.exec(codeOnly(rel));
      show(`${rel} · ${f.name}`, hit ? `FOUND: ${hit[0]}` : "absent");
      assert(!hit, `${rel} now contains ${f.name} ("${hit?.[0]}") — the observed-facts surface must stay threshold-pure`);
    }
  }
});

check("A2 · SOURCE+RUNTIME — the three thresholds are the pinned values, declared as literals", () => {
  // Pinned by VALUE through the import (so a re-derivation breaks here) and by
  // LITERAL in the source (so the value cannot become a computed expression that
  // drifts between renders — "a threshold in code is a threshold that cannot
  // drift" is the file's own contract).
  show("MOBILE_SCORE_WORTH_FIXING_BELOW", MOBILE_SCORE_WORTH_FIXING_BELOW);
  show("MOBILE_LOAD_WORTH_FIXING_ABOVE_S", MOBILE_LOAD_WORTH_FIXING_ABOVE_S);
  show("REVIEW_COUNT_WORTH_FIXING_FRACTION", REVIEW_COUNT_WORTH_FIXING_FRACTION);
  assert.equal(MOBILE_SCORE_WORTH_FIXING_BELOW, 70, "the mobile-score threshold moved");
  assert.equal(MOBILE_LOAD_WORTH_FIXING_ABOVE_S, 3.0, "the mobile-load threshold moved");
  assert.equal(REVIEW_COUNT_WORTH_FIXING_FRACTION, 0.5, "the review-fraction threshold moved");
  const src = codeOnly(LIB);
  for (const literal of [
    /MOBILE_SCORE_WORTH_FIXING_BELOW\s*=\s*70\b/,
    /MOBILE_LOAD_WORTH_FIXING_ABOVE_S\s*=\s*3\.0\b/,
    /REVIEW_COUNT_WORTH_FIXING_FRACTION\s*=\s*0\.5\b/,
  ]) {
    assert(literal.test(src), `${LIB} no longer declares ${literal} as a literal`);
  }
});

check("A3 · SOURCE — the review threshold is the PAID detector's own statistic, not a second opinion", () => {
  // 0.5 is exactly the halving review_deficit fires on. Same number, same
  // statistic, same sample — which is what makes it impossible for the row and
  // the paid report to disagree about a fact. If the detector's line changes,
  // this fails and the threshold has to be reconciled ON PURPOSE.
  const detector = codeOnly("src/lib/leak-detection.ts");
  const fires = /gr\.count\s*<\s*median\s*\*\s*0\.5/.test(detector);
  show("leak-detection.ts fires on `gr.count < median * 0.5`", fires);
  assert(fires, "review_deficit no longer fires on `count < median * 0.5` — reconcile REVIEW_COUNT_WORTH_FIXING_FRACTION deliberately");
  assert.equal(
    REVIEW_COUNT_WORTH_FIXING_FRACTION,
    0.5,
    "the row's fraction and the detector's 0.5 have diverged — the row can now disagree with the paid report"
  );
});

check("A4 · RUNTIME — the verdicts flip exactly AT the thresholds, in the directions documented", () => {
  const at = (score: number | null, load: number | null) =>
    computeObservedFacts(
      host({
        psiSnapshot: {
          ...PSI_SLOW,
          mobile: { ...PSI_SLOW.mobile!, performanceScore: score, metrics: { ...PSI_SLOW.mobile!.metrics, lcpSeconds: load } },
        },
        psiSnapshotAt: AS_OF,
      })
    ).mobileSpeed.verdict;
  show("score 70 / load 2.5", at(70, 2.5));
  show("score 69 / load 2.5", at(69, 2.5));
  show("score 90 / load 3.0", at(90, 3.0));
  show("score 90 / load 3.1", at(90, 3.1));
  assert.equal(at(70, 2.5), "fine", "score AT the threshold should be fine (the rule is strictly below)");
  assert.equal(at(69, 2.5), "worth_fixing", "score one under the threshold should be worth fixing");
  assert.equal(at(90, 3.0), "fine", "load AT the threshold should be fine (the rule is strictly above)");
  assert.equal(at(90, 3.1), "worth_fixing", "load over the threshold should be worth fixing");
  show("reviews 16 vs local median 120", FULL.reviews.verdict);
  assert.equal(
    FULL.reviews.localAvg,
    120,
    `the local median should be the upper median of [80,90,105,120,150,310], got ${FULL.reviews.localAvg}`
  );
  assert.equal(FULL.reviews.verdict, "worth_fixing", "16 reviews against a local median of 120 should be worth fixing");
});

check("A5 · RUNTIME — the median is quoted from ≥5 competitors or NOT AT ALL, and never from a rating-sorted subsample", () => {
  // OWNER RULE, verbatim: "if the median is computed from fewer than ~5
  // competitors it's meaningless and should render '—' rather than a number.
  // That figure is the one I'd say out loud on a call, so it can't be wrong."
  // The bug this pins against was real: a law firm's row said "local median 7"
  // because the number came from the top-RATED-3 subsample — [1, 1, 8] — while
  // the full set told a different story. Both halves are pinned here.
  const withCompetitors = (counts: number[]) =>
    computeObservedFacts(
      host({
        researchSnapshot: {
          ...researchBundle(),
          competitors: counts.map((n, i) => ({
            name: `Competitor ${i + 1}`,
            // Inverse ratings: the SMALLEST review counts get the HIGHEST
            // ratings, so a top-rated-3 subsample would median over the tiny
            // ones — the exact shape that produced "local median 7".
            rating: 5 - i * 0.1,
            reviewCount: n,
            website: "",
            category: "HVAC contractor",
            address: "Dartmouth NS",
          })),
        },
        researchSnapshotAt: AS_OF,
      })
    ).reviews;

  const thin = withCompetitors([1, 1, 8]);
  show("3 competitors [1,1,8] → localAvg", thin.localAvg ?? "(null — renders as —)");
  assert.equal(thin.localAvg, null, "a median was quoted from 3 competitors — under the floor it must be null");
  assert.equal(thin.verdict, "unknown", "with no quotable median the verdict must be unknown, not a judgment");

  const four = withCompetitors([1, 1, 8, 40]);
  show("4 competitors → localAvg", four.localAvg ?? "(null — renders as —)");
  assert.equal(four.localAvg, null, "4 usable competitors is still under the floor");

  // Five usable counts, tiny ones top-rated: full-set upper median of
  // [2, 9, 80, 120, 300] is 80. A rating-sorted top-3 would median [2, 9, 80]
  // → 9, so the assertion below fails if anyone reintroduces the subsample.
  const five = withCompetitors([2, 9, 80, 120, 300]);
  show("5 competitors [2,9,80,120,300] → localAvg", five.localAvg);
  assert.equal(five.localAvg, 80, "at the floor, the median must be over the FULL set (a top-rated-3 sample would say 9)");

  // Zero-review competitors do not count toward the floor — an unreviewed
  // listing is not evidence about the market.
  const padded = withCompetitors([0, 0, 1, 1, 8]);
  show("5 competitors but only 3 with reviews → localAvg", padded.localAvg ?? "(null)");
  assert.equal(padded.localAvg, null, "zero-review competitors padded the sample past the floor");
});

/* ──────────────────────────────────────────────────────────────────────────
 * B · FULL DATA — all four values, measured
 * ────────────────────────────────────────────────────────────────────── */
section("B · FULL DATA — a scanned business renders all four values with verdicts");

check("B1 · RUNTIME — all four values are present and carry mechanical verdicts", () => {
  show("mobileSpeed", FULL.mobileSpeed);
  show("reviews    ", FULL.reviews);
  show("bookingLink", FULL.bookingLink);
  show("clickToCall", FULL.clickToCall);
  show("observedAt ", FULL.observedAt);
  assert.equal(FULL.mobileSpeed.score, 62);
  assert.equal(FULL.mobileSpeed.loadSeconds, 4.1);
  assert.equal(FULL.mobileSpeed.verdict, "worth_fixing");
  assert.equal(FULL.reviews.count, 16, "the review count did not come through the adapter");
  assert.equal(FULL.bookingLink.state, "found", "the Calendly link in the DOM did not fingerprint");
  assert.equal(FULL.bookingLink.verdict, "fine");
  assert.equal(FULL.clickToCall.state, "found", "the tel: link in the DOM did not fingerprint");
  assert.equal(FULL.clickToCall.verdict, "fine");
  assert.equal(FULL.observedAt, AS_OF, "the row lost its provenance timestamp");
});

check("B2 · RUNTIME — the row prints the four VALUES and provenance, and NO verdict ever renders", () => {
  // OWNER RULE (2026-08-01): "These four values are PROOF I LOOKED, not a
  // diagnosis — 'worth fixing' is a judgment and it reintroduces the severity
  // framing we just deleted." Verdicts stay computed in the lib (B1 pins that);
  // this check pins that they never reach the screen or the clipboard.
  const html = renderRow(FULL);
  for (const fragment of ["62/100", "4.1s", "16", "local median 120", "found", "seen "]) {
    show(`row carries "${fragment}"`, html.includes(fragment));
    assert(html.includes(fragment), `the rendered row is missing "${fragment}"`);
  }
  for (const judgment of ["worth fixing", "worth_fixing", ">fine<", "Critical"]) {
    show(`row free of "${judgment}"`, !html.includes(judgment));
    assert(!html.includes(judgment), `a verdict rendered: "${judgment}" — the row is proof he looked, not a diagnosis`);
  }
  assert(!html.includes("—"), "a fully-measured row still renders a dash somewhere");
});

/* ──────────────────────────────────────────────────────────────────────────
 * C · PARTIAL DATA — dashes, not inferences
 * ────────────────────────────────────────────────────────────────────── */
section("C · PARTIAL DATA — what was not seen renders as “—” with verdict unknown, never as “none”");

check("C1 · RUNTIME — a never-scanned business is four unknowns, and renders four dashes", () => {
  show("verdicts", [
    NEVER_SCANNED.mobileSpeed.verdict,
    NEVER_SCANNED.reviews.verdict,
    NEVER_SCANNED.bookingLink.verdict,
    NEVER_SCANNED.clickToCall.verdict,
  ]);
  assert.deepEqual(
    [NEVER_SCANNED.mobileSpeed.verdict, NEVER_SCANNED.reviews.verdict, NEVER_SCANNED.bookingLink.verdict, NEVER_SCANNED.clickToCall.verdict],
    ["unknown", "unknown", "unknown", "unknown"],
    "an unscanned business carries a verdict it has no data for"
  );
  assert.equal(NEVER_SCANNED.bookingLink.state, "unknown", '"could not see" hardened into a presence claim');
  const html = renderRow(NEVER_SCANNED);
  const dashes = (html.match(/—/g) ?? []).length;
  show("dashes rendered", dashes);
  show('renders "none" anywhere', html.includes(">none<"));
  show('renders a verdict label', html.includes("worth fixing") || html.includes(">fine<"));
  assert(dashes >= 4, `expected four “—” cells, found ${dashes}`);
  assert(!html.includes(">none<"), 'an unscanned value rendered as "none" — that is a different fact from "we could not see"');
  assert(!html.includes("worth fixing") && !html.includes(">fine<"), "an unknown value carries a verdict label");
});

check("C2 · RUNTIME — a PSI-only business shows exactly the measured half", () => {
  show("mobileSpeed", PSI_ONLY.mobileSpeed);
  show("bookingLink", PSI_ONLY.bookingLink);
  assert.equal(PSI_ONLY.mobileSpeed.score, 62, "the real measured score was hidden because its neighbours are missing");
  assert.equal(PSI_ONLY.mobileSpeed.verdict, "worth_fixing");
  assert.equal(PSI_ONLY.bookingLink.state, "unknown");
  assert.equal(PSI_ONLY.reviews.verdict, "unknown", "a review verdict appeared with no local sample to compare against");
  const html = renderRow(PSI_ONLY);
  assert(html.includes("62/100"), "the measured half is not on the rendered row");
  assert((html.match(/—/g) ?? []).length >= 3, "the unmeasured half is not rendered as dashes");
});

check("C3 · RUNTIME — a null/absent facts object renders the honest all-unknown row, and the copy buttons disable", () => {
  const html = renderRow(null);
  show("dashes", (html.match(/—/g) ?? []).length);
  show("buttons disabled", (html.match(/disabled=""/g) ?? []).length);
  assert((html.match(/—/g) ?? []).length >= 4, "a missing facts object did not degrade to four dashes");
  assert((html.match(/disabled=""/g) ?? []).length >= 2, "the copy buttons stayed enabled with nothing measured — they would copy an empty claim");
  assert.deepEqual(unknownObservedFacts(), NEVER_SCANNED, "unknownObservedFacts() and a never-scanned compute disagree about the honest default");
});

/* ──────────────────────────────────────────────────────────────────────────
 * D · THE EMAIL — exactly three sentences, placeholder behaviour, no money
 * ────────────────────────────────────────────────────────────────────── */
section("D · THE EMAIL — exactly three sentences in every variant, visible placeholder, no dollar sign");

check("D1 · RUNTIME — two worth-fixing numbers → three sentences carrying both numbers", () => {
  const email = buildObservedEmail(FULL, undefined);
  const sentences = sentencesOf(email);
  show("email", email);
  show("sentences", sentences.length);
  assert.equal(sentences.length, 3, `the owner approved EXACTLY three sentences; this variant has ${sentences.length}`);
  assert(email.includes("16 Google reviews"), "the review number is not in the email");
  assert(email.includes("typically have 120"), "the local median is not in the email (plain-English median phrasing)");
  assert(email.includes("62/100"), "the speed score is not in the email");
  assert(email.includes("{booking link}"), "an unset booking URL must yield a VISIBLE placeholder, never a silent omission");
  assert(!email.includes("$"), "money appeared in the email template — it never does (and if it ever did, it would be CAD)");
});

check("D2 · RUNTIME — one worth-fixing number → the one-number variant, still three sentences", () => {
  const oneNumber: ObservedFacts = {
    ...FULL,
    mobileSpeed: { score: 88, loadSeconds: 1.9, verdict: "fine" },
  };
  const email = buildObservedEmail(oneNumber, "https://booking.example/reclaimedhq/15-minute-call");
  const sentences = sentencesOf(email);
  show("email", email);
  show("sentences", sentences.length);
  assert.equal(sentences.length, 3, `expected three sentences, got ${sentences.length}`);
  assert(email.startsWith("One number"), "the one-number variant does not announce itself as one number");
  assert(email.includes("https://booking.example/reclaimedhq/15-minute-call"), "a configured booking URL is not in the close");
  assert(!email.includes("{booking link}"), "the placeholder rendered beside a configured URL");
});

check("D3 · RUNTIME — measured but nothing urgent → the hedged industry-pattern variant, three sentences", () => {
  const email = buildObservedEmail(
    {
      mobileSpeed: { score: 92, loadSeconds: 1.4, verdict: "fine" },
      reviews: { count: 120, rating: 4.8, localAvg: 100, verdict: "fine" },
      bookingLink: { state: "found", verdict: "fine" },
      clickToCall: { state: "found", verdict: "fine" },
      observedAt: AS_OF,
    },
    undefined
  );
  const sentences = sentencesOf(email);
  show("email", email);
  show("sentences", sentences.length);
  assert.equal(sentences.length, 3, `expected three sentences, got ${sentences.length}`);
  assert(email.includes("didn't turn up anything urgent"), "the clean variant no longer says the scan came back clean");
  assert(email.includes("most local businesses"), "the middle sentence is not hedged as an industry pattern — it would read as a claim about THIS business");
});

check("D4 · RUNTIME — nothing measured → the empty string, and the one-line summary agrees", () => {
  const email = buildObservedEmail(NEVER_SCANNED, undefined);
  const line = buildObservedLine(NEVER_SCANNED);
  show("email", JSON.stringify(email));
  show("line ", JSON.stringify(line));
  assert.equal(email, "", "an email was composed for a business nobody has looked at — a template must not claim a look that never happened");
  assert.equal(line, "", "a call-notes line was composed with nothing measured");
  const full = buildObservedLine(FULL);
  show("full line", full);
  // Values only — the verdict parentheticals were removed by the same owner
  // rule B2 cites. He reads this line out on a call; the judging is his.
  for (const fragment of ["Mobile 62/100 4.1s", "Reviews 16 vs local 120", "Booking link found", "Click-to-call found"]) {
    assert(full.includes(fragment), `the call-notes line is missing "${fragment}"`);
  }
  assert(!full.includes("(worth fixing)") && !full.includes("(fine)"),
    "a verdict parenthetical is back in the call-notes line");
});

/* ────────────────────────────────────────────────────────────────────────── */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    "\nThis suite pins the cold audit's replacement: a threshold-pure row of measured values.\n" +
      "A failure here means the row started composing, inferring or fetching — which is the\n" +
      "exact behaviour the deletion ruling exists to keep out of pre-sale.\n"
  );
  process.exit(1);
}
