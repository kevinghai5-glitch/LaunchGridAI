/**
 * FABRICATION PROOF — the false measured claim, demonstrated dead, offline.
 * No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-fabrication.ts
 *   npm run verify:fabrication
 *
 * And, for the half that needs the live web, one command against real URLs:
 *
 *   npm run probe:site -- https://their-site.example https://another.example
 *
 * Every check prints its inputs and outputs BEFORE it asserts, so a reader can
 * audit the claim rather than trust it. Exits 1 if any check fails.
 *
 * ── WHAT SHIPPED, AND WHICH HALF OF IT WAS THE DANGEROUS HALF ────────────────
 *
 * A real cold audit for a law firm shipped this as finding 01:
 *
 *     No clear call to action on your homepage — Critical
 *     Measured on your public pages, 7/29/2026
 *     "Visitors arrive on your homepage but face no clear direction on what to do
 *      next. There's no primary action above the fold, and your phone number is
 *      buried."
 *
 * The firm visibly has both. Two separate defects produced that sentence:
 *
 *   BUG A — the detector should not have fired. `weak_landing_cta` asked "is there
 *   a clear primary action above the fold", which is an editorial judgment; what
 *   the code computed was thirteen fixed phrases against the first 1500 characters
 *   of the homepage's MARKDOWN. Markdown has no fold.
 *
 *   BUG B — and this is the one that matters — THE SENTENCE WAS NEVER MEASURED AT
 *   ALL. Nothing in the scrape contains "buried" or "above the fold". A generic
 *   leak fired, the model invented checkable-sounding specifics, and the grade
 *   stamped them "Measured on your public pages" — because the grade certified
 *   THAT A DETECTOR FIRED, not that the sentence under it was true. The click-to-
 *   call fingerprint was PRESENT for that firm, so the document asserted the exact
 *   opposite of the one thing we had actually established.
 *
 * THE SURFACE THE FINDING SHIPPED ON IS DELETED (2026-08-01). The cold audit —
 * generator, renderer, teaser, store — was removed by ruling ("the artifact's
 * job is gone… a number cannot hallucinate"), so the sections of this file that
 * asserted on the rendered audit died with it: the audit CTA (old D), the
 * zero/one-finding documents (old F2/F3/F5), the committed-audit artifact scans
 * (old B4/G2/G3). What stays is everything protecting the layers that SURVIVE —
 * the detection contract, the evidence-binding chain, and the fabrication lint,
 * which is now a PAID-PACK gate (validatePack runs it at save and at export).
 *
 * So this file is five questions about whether a sentence on a client-facing
 * page can still say something nobody measured:
 *
 *   A. ZERO INTERPRETIVE FINDINGS   — three realistic sites that visibly have a CTA
 *      ON SITES THAT HAVE BOTH        and a phone number produce no interpretive
 *                                     finding and nothing graded `observed` off a
 *                                     judgment. The old rule is reconstructed
 *                                     beside the new one so you can see it fire.
 *   B. EVERY FINDING TRACES TO A    — the binding is PRINTED BESIDE EACH FINDING:
 *      BOUND VALUE, PRINTED           field name, actual value, provenance, and the
 *                                     one sentence that value licenses. And every
 *                                     committed PACK passes the full validator,
 *                                     fabrication gate included.
 *   C. THE INVENTED DETAIL IS       — two inventions of different shapes (one with
 *      REJECTED BY NAME               digits, one with none) are inserted into a
 *                                     VALID finding and the lint names the
 *                                     sentence. The same claim planted in a PACK is
 *                                     refused by validatePack — the gate, not just
 *                                     the function. And the lint still fires on
 *                                     inventions it has never seen.
 *   E. NO THIRD-PARTY KEY IN ANY    — every committed client-facing document, plus
 *      CLIENT-FACING DOCUMENT         every one re-rendered here, scanned for
 *                                     anything key-shaped. Zero.
 *   F/G. THE SELECTION STAYS        — a well-run business produces ZERO hard
 *      HONEST                         findings and named clean checks (F1); no
 *                                     industry pattern enters the most-provable
 *                                     top-3 even when patterns are all there is
 *                                     (F4); and the selection orders measurements
 *                                     above a higher-scoring inference (G1).
 *
 * READ THE LABELS. Some checks below prove RUNTIME behaviour (the code behaves),
 * some are a SOURCE-LEVEL scan (a string exists once, or not at all), and some
 * are an ARTIFACT scan (a committed file does not contain something). They are
 * not the same strength of promise, so each says which it is — the same
 * discipline as verify-phase3.ts and verify-phase4.ts.
 *
 * WHAT THIS FILE CANNOT DO, SAID PLAINLY. There is no API key here, so no live
 * generation runs: nothing below proves what a language model will write on a
 * Tuesday. It proves that if the model writes a fabricated specific, the gates
 * refuse it — the lint, the pack validator, the grade ceiling, and the artifact
 * scans. Section A's three sites are FIXTURES built to reproduce the reported
 * shape, not scrapes of the real business. `npm run probe:site` closes that gap
 * in one command, against whatever URLs he types.
 */

import assert from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { buildAuditIntelligence, type AuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import {
  advisoryOnlyLeaks,
  analyzeForms,
  detectLeaks,
  selectColdAudit,
  type CleanCheck,
  type FiredLeak,
} from "@/lib/leak-detection";
import {
  LEAKS,
  UNCITABLE_SCRAPE_FIELDS,
  gradeOf,
  isInterpretive,
  type ScrapeData,
} from "@/lib/leak-taxonomy";
import {
  allowedNumbersFor,
  bindEvidence,
  buildLeakInputs,
  fabricationLint,
  siteFactClaims,
  statGuard,
  type EvidenceBinding,
  type LeakInput,
} from "@/lib/leak-narrative";
import { renderDeliverableHtml } from "@/lib/exporters/deliverables";
import { validatePack } from "@/lib/exporters/validate-pack";
import { carriesScreenshotCredential } from "@/lib/screenshotone";
import type { DataForSeoBundle } from "@/lib/dataforseo";
import type { FirecrawlPage, FirecrawlScrape } from "@/lib/firecrawl";
import type { PsiBundle } from "@/lib/pagespeed";
import type { AssetPack, LeakAnalysisItem } from "@/types";

/* ════════════════════════════════════════════════════════════════════════════
 * HARNESS — same shape as verify-phase3.ts / verify-phase4.ts
 * ══════════════════════════════════════════════════════════════════════════ */

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

/** An unindented evidence line, for the binding tables in section B. */
function line(text: string): void {
  console.log(`          ${text}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

/** The words a reader actually sees, markup removed. Same shape the pack
 *  validator and verify-phase4 use, so "on the page" means one thing. */
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

/* ════════════════════════════════════════════════════════════════════════════
 * THE THREE SITES
 *
 * SYNTHETIC, AND SAID SO OUT LOUD. Every domain is on the RFC 2606 reserved
 * `.example` TLD so it can never resolve, and every phone number is in the
 * 555-01xx fictional block. These are FIXTURES REPRODUCING THE REPORTED SHAPE —
 * not scrapes of the real business, and not evidence about it. What they are built
 * to reproduce is the exact combination that produced the false finding:
 *
 *   1 · LAW FIRM — the shape of the real incident. The phone number is a `tel:` link in the
 *       header nav. The hero call to action is "Free Case Evaluation" inside a
 *       styled `<div>` — not an `<a>`, not a `<button>`, and not one of the
 *       thirteen phrases `CTA_RE` knows. Practice areas live at /practice-areas/*,
 *       which never classify as `services`, so the service-page CTA heuristic
 *       silently passes on an empty set.
 *   2 · MED SPA — the styled-div shape again, harder: the call to action is a
 *       `<div class="cta-pill">` reading "Start your consultation", and the phone
 *       number is a `tel:` link in a floating mobile bar rather than in the nav.
 *   3 · PLUMBER — a normal service business, and the control: its call to action
 *       is a plain `<a>Request a quote</a>`, which IS one of the thirteen phrases.
 *       So the old heuristic was HAPPY here and still is, and the outcome is the
 *       same either way — which is the point.
 *
 * Nothing below hand-writes a ScrapeData field. The markup goes through
 * buildBusinessFacts → buildAuditIntelligence → detectLeaks, exactly as a paying
 * client's run does, so the fingerprints are the shipped code's and not this
 * file's opinion.
 * ══════════════════════════════════════════════════════════════════════════ */

const RESEARCH_AS_OF = "2026-07-01T12:00:00.000Z";

interface SiteFixture {
  key: string;
  label: string;
  /** What about this site reproduces the reported false-positive shape. */
  shape: string;
  name: string;
  industry: string;
  city: string;
  phone: string;
  tel: string;
  domain: string;
  rating: number;
  reviewCount: number;
  homeHtml: string;
  homeMarkdown: string;
  subpages: FirecrawlPage[];
  gbp: { limitedHours: boolean; hasBookingLink: boolean; hasHours: boolean };
  psi: { mobileScore: number; mobileLcp: number; cls: number } | null;
  competitors: { name: string; rating: number; reviewCount: number }[];
  /** Verbatim review text. Invented, and written to contain the phrases
   *  REVIEW_SIGNALS matches on, because a review proxy is the only way a leak
   *  reaches EVIDENCED — and section G needs an EVIDENCED fire to exist before it
   *  can prove that a measurement outranks one. */
  reviews: { rating: number; text: string; date: string }[];
}

const page = (url: string, title: string, markdown: string, html: string): FirecrawlPage => ({
  url,
  markdown,
  html,
  rawHtml: html,
  title,
  description: "",
  links: [],
});

/* ── 1 · the law firm: tel: in the header, CTA inside a styled div ─────────── */

const LAW_HOME_HTML = `<!doctype html><html lang="en"><head>
<title>Crandall &amp; Reeve LLP — Personal Injury Lawyers in London, Ontario</title>
<meta name="description" content="Personal injury and disability law in London and Middlesex County since 1998.">
</head><body>
<div class="cookie-banner"><p>We use cookies to make this site work. By continuing you agree to our privacy policy and terms of use.</p><button type="button">Accept</button><button type="button">Manage preferences</button></div>
<a class="skip" href="#main">Skip to main content</a>
<header class="site-header">
  <a class="logo" href="/"><img src="/logo.svg" alt="Crandall &amp; Reeve LLP"></a>
  <nav aria-label="Primary">
    <a href="/practice-areas/motor-vehicle-accidents">Motor Vehicle Accidents</a>
    <a href="/practice-areas/long-term-disability">Long-Term Disability</a>
    <a href="/practice-areas/slip-and-fall">Slip and Fall</a>
    <a href="/our-team">Our Team</a>
    <a href="/contact">Contact</a>
  </nav>
  <div class="header-phone">
    <span class="label">Speak with a lawyer</span>
    <a class="tel" href="tel:+15195550143">519-555-0143</a>
  </div>
</header>
<main id="main">
<section class="hero">
  <h1>Injured, and being told it was your fault?</h1>
  <p>We act for people in London and Middlesex County whose insurer has stopped returning their calls. No fee unless we recover.</p>
  <div class="cta-row">
    <div class="btn-primary" role="button" tabindex="0" data-open="intake">Free Case Evaluation</div>
    <div class="btn-ghost" role="button" tabindex="0" data-call="519-555-0143">Talk to an attorney</div>
  </div>
</section>
<section class="areas"><h2>How we help</h2>
  <ul>
    <li><a href="/practice-areas/motor-vehicle-accidents">Motor vehicle accidents</a></li>
    <li><a href="/practice-areas/long-term-disability">Long-term disability denials</a></li>
    <li><a href="/practice-areas/slip-and-fall">Slip and fall injuries</a></li>
  </ul>
</section>
<section class="proof"><h2>What our clients say</h2>
  <p>Rated 4.8 across 61 Google reviews. Serving London since 1998.</p>
</section>
<section class="contact"><h2>Tell us what happened</h2>
  <form action="/contact" method="post">
    <label>Name<input type="text" name="name"></label>
    <label>Email<input type="email" name="email"></label>
    <label>Phone<input type="tel" name="phone"></label>
    <label>What happened<textarea name="message"></textarea></label>
    <button type="submit">Send</button>
  </form>
</section>
</main>
<footer>
  <p>Crandall &amp; Reeve LLP, 210 Dundas Street, London ON</p>
  <p><a href="tel:+15195550143">519-555-0143</a></p>
  <p>Office hours Monday to Friday, 9am to 5pm. Closed weekends.</p>
</footer>
</body></html>`;

// The MARKDOWN is what `hasPrimaryCtaAboveFold` actually reads, and it is written
// the way Firecrawl really renders a page like this: the cookie banner, the skip
// link, the logo alt text and five nav items come first, and they alone are most of
// the 1500-character window. This is not a trick — it is the shape the manifest
// describes (docs/detector-checkability.md §4), and section A prints the window.
const LAW_HOME_MARKDOWN = `We use cookies to make this site work. By continuing you agree to our privacy policy and terms of use. Accept · Manage preferences

[Skip to main content](#main)

![Crandall & Reeve LLP](/logo.svg)

- [Motor Vehicle Accidents](/practice-areas/motor-vehicle-accidents)
- [Long-Term Disability](/practice-areas/long-term-disability)
- [Slip and Fall](/practice-areas/slip-and-fall)
- [Our Team](/our-team)
- [Contact](/contact)

Speak with a lawyer — [519-555-0143](tel:+15195550143)

# Injured, and being told it was your fault?

We act for people in London and Middlesex County whose insurer has stopped returning their calls. No fee unless we recover. Our practice is built around three areas of work, and we take a limited number of files at a time so that the people we act for can reach the lawyer handling their matter rather than an assistant. Free Case Evaluation. Talk to an attorney.

## How we help
- Motor vehicle accidents
- Long-term disability denials
- Slip and fall injuries

## What our clients say
Rated 4.8 across 61 Google reviews. Serving London since 1998.

## Tell us what happened
Name, Email, Phone, What happened.

Office hours Monday to Friday, 9am to 5pm. Closed weekends.`;

const LAW_PRACTICE_HTML = `<!doctype html><html lang="en"><head><title>Motor Vehicle Accidents — Crandall &amp; Reeve LLP</title></head><body>
<h1>Motor vehicle accident claims in London</h1>
<p>What to expect, what the insurer will do, and what the deadlines are.</p>
<div class="btn-primary" role="button">Free Case Evaluation</div>
<footer><a href="tel:+15195550143">519-555-0143</a></footer>
</body></html>`;

const LAW_SITE: SiteFixture = {
  key: "law",
  label: "Crandall & Reeve LLP (law, London ON)",
  shape:
    "the reported shape exactly: `tel:` link in the header nav, hero call to action inside a styled <div> reading \"Free Case Evaluation\" (not one of CTA_RE's thirteen phrases), practice areas at /practice-areas/* so the service-page heuristic sees an empty set",
  name: "Crandall & Reeve LLP",
  industry: "personal injury law firm",
  city: "London",
  phone: "519-555-0143",
  tel: "+15195550143",
  domain: "https://crandall-reeve.example",
  rating: 4.8,
  reviewCount: 61,
  homeHtml: LAW_HOME_HTML,
  homeMarkdown: LAW_HOME_MARKDOWN,
  subpages: [
    page(
      "https://crandall-reeve.example/practice-areas/motor-vehicle-accidents",
      "Motor Vehicle Accidents",
      "# Motor vehicle accident claims in London\n\nWhat to expect, what the insurer will do, and what the deadlines are.\n\nFree Case Evaluation",
      LAW_PRACTICE_HTML
    ),
  ],
  gbp: { limitedHours: true, hasBookingLink: false, hasHours: true },
  psi: { mobileScore: 71, mobileLcp: 3.1, cls: 0.03 },
  competitors: [
    { name: "Ashworth Injury Law", rating: 4.9, reviewCount: 140 },
    { name: "Bell & Marchetti", rating: 4.8, reviewCount: 96 },
  ],
  // Two of these carry REVIEW_SIGNALS.missedCalls phrases, which is what lifts
  // missed_calls_no_recovery to EVIDENCED. Section G needs that fire to exist:
  // on a law firm it scores 10.8 (impactWeight 10 × 0.9 × the law vertical boost),
  // HIGHER than any of this site's measurements — so it is the one case where
  // "strongest evidence first" and "highest score first" give different answers.
  reviews: [
    { rating: 5, text: "Handled my long-term disability appeal properly and explained every step.", date: "2026-05-02T00:00:00.000Z" },
    { rating: 2, text: "Left a voicemail twice about my accident file and never called back.", date: "2026-04-18T00:00:00.000Z" },
    { rating: 2, text: "Phone rang and rang during office hours. No answer, and I had a deadline.", date: "2026-03-27T00:00:00.000Z" },
  ],
};

/* ── 2 · the med spa: styled-div CTA, tel: in a floating mobile bar ────────── */

const SPA_HOME_HTML = `<!doctype html><html lang="en"><head>
<title>Larkspur Aesthetics — Injectables and Skin in Kelowna</title>
</head><body>
<div class="promo-strip"><p>Now open Thursdays until 7pm. Consultations are complimentary and there is no obligation to treat.</p></div>
<header>
  <a class="logo" href="/">Larkspur Aesthetics</a>
  <nav><a href="/treatments">Treatments</a><a href="/pricing">Pricing</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
</header>
<section class="hero">
  <h1>Injectables and skin, done conservatively</h1>
  <p>A nurse-led clinic in Kelowna. We would rather do less and have you come back than do too much once.</p>
  <div class="cta-pill" role="button" tabindex="0" data-open="enquiry">Start your consultation</div>
</section>
<section class="treatments"><h2>Treatments</h2>
  <ul><li>Neuromodulators</li><li>Dermal filler</li><li>Skin resurfacing</li><li>Medical-grade skincare</li></ul>
</section>
<section class="proof"><h2>Reviews</h2><p>Rated 4.9 across 208 Google reviews.</p></section>
<section class="contact"><h2>Enquire</h2>
  <form action="/enquiry" method="post">
    <label>Name<input type="text" name="name"></label>
    <label>Email<input type="email" name="email"></label>
    <label>Which treatment are you asking about?<input type="text" name="treatment"></label>
    <label>Anything we should know<textarea name="message"></textarea></label>
    <button type="submit">Send enquiry</button>
  </form>
</section>
<div class="mobile-call-bar"><a href="tel:+12505550188">Call 250-555-0188</a></div>
<footer><p>Larkspur Aesthetics, 1180 Bernard Avenue, Kelowna BC</p>
<p>Tuesday to Saturday, 10am to 6pm. Closed Sunday and Monday.</p></footer>
</body></html>`;

const SPA_HOME_MARKDOWN = `Now open Thursdays until 7pm. Consultations are complimentary and there is no obligation to treat.

Larkspur Aesthetics

- [Treatments](/treatments)
- [Pricing](/pricing)
- [About](/about)
- [Contact](/contact)

# Injectables and skin, done conservatively

A nurse-led clinic in Kelowna. We would rather do less and have you come back than do too much once. Our nurse injectors work to a conservative protocol, which means the first visit is usually about deciding what NOT to do, and the plan is written down before anything is touched. Start your consultation.

## Treatments
- Neuromodulators
- Dermal filler
- Skin resurfacing
- Medical-grade skincare

## Reviews
Rated 4.9 across 208 Google reviews.

## Enquire
Name, Email, Which treatment are you asking about?, Anything we should know.

Call 250-555-0188

Tuesday to Saturday, 10am to 6pm. Closed Sunday and Monday.`;

const SPA_TREATMENTS_HTML = `<!doctype html><html lang="en"><head><title>Treatments — Larkspur Aesthetics</title></head><body>
<h1>Treatments</h1>
<section><h2>Neuromodulators</h2><p>Assessed in person, priced per area, and reviewed at two weeks.</p></section>
<section><h2>Dermal filler</h2><p>Conservative volumes, and we will say no if it is not the right treatment.</p></section>
<div class="cta-pill" role="button">Start your consultation</div>
<footer><a href="tel:+12505550188">250-555-0188</a></footer>
</body></html>`;

const SPA_SITE: SiteFixture = {
  key: "spa",
  label: "Larkspur Aesthetics (med spa, Kelowna BC)",
  shape:
    "the styled-div shape, harder: the call to action is a <div class=\"cta-pill\">Start your consultation</div> and the phone number is a `tel:` link in a floating mobile bar rather than the nav, so neither the CTA scan (<a>/<button> text only) nor a nav-shaped assumption finds them",
  name: "Larkspur Aesthetics",
  industry: "med spa",
  city: "Kelowna",
  phone: "250-555-0188",
  tel: "+12505550188",
  domain: "https://larkspur-aesthetics.example",
  rating: 4.9,
  reviewCount: 208,
  homeHtml: SPA_HOME_HTML,
  homeMarkdown: SPA_HOME_MARKDOWN,
  subpages: [
    page(
      "https://larkspur-aesthetics.example/treatments",
      "Treatments",
      "# Treatments\n\nNeuromodulators, dermal filler, skin resurfacing.\n\nStart your consultation",
      SPA_TREATMENTS_HTML
    ),
  ],
  gbp: { limitedHours: false, hasBookingLink: false, hasHours: true },
  psi: { mobileScore: 84, mobileLcp: 2.2, cls: 0.02 },
  competitors: [
    { name: "Okanagan Skin Studio", rating: 4.9, reviewCount: 190 },
    { name: "Bernard Aesthetics", rating: 4.8, reviewCount: 240 },
  ],
  // No review text at all: the clinic's leaks are the ones we FINGERPRINTED, with
  // no review proxy lifting anything. One fixture with reviews and two without is
  // deliberate — it keeps "EVIDENCED exists" and "EVIDENCED is not required"
  // visible in the same run.
  reviews: [],
};

/* ── 3 · the plumber: the control, whose CTA the old heuristic DID recognise ─ */

const PLUMB_HOME_HTML = `<!doctype html><html lang="en"><head>
<title>Cedar Ridge Plumbing — Drain and Water Heater Service in Kamloops</title>
</head><body>
<header><a class="logo" href="/">Cedar Ridge Plumbing</a>
<nav><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a>
<a class="btn" href="tel:+12505550131">250-555-0131</a></nav></header>
<section class="hero"><h1>Plumbing that holds up through a Kamloops winter</h1>
<p>Repairs, replacements and planned work across Kamloops and the Thompson Valley. Licensed, insured, and doing this since 2004.</p>
<a class="btn primary" href="/contact">Request a quote</a>
<a class="btn ghost" href="tel:+12505550131">Call 250-555-0131</a></section>
<section class="services"><h2>What we do</h2>
<ul><li><a href="/services">Water heater repair and replacement</a></li>
<li><a href="/services">Drain and sewer work</a></li>
<li><a href="/services">Emergency callouts</a></li></ul></section>
<section class="proof"><h2>What our customers say</h2><p>Rated 4.6 stars across 74 Google reviews.</p></section>
<section class="contact"><h2>Get in touch</h2>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form></section>
<footer><p>Cedar Ridge Plumbing, 480 Victoria Street, Kamloops BC</p>
<p><a href="tel:+12505550131">250-555-0131</a></p>
<p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.</p></footer>
</body></html>`;

const PLUMB_HOME_MARKDOWN = `# Plumbing that holds up through a Kamloops winter

Repairs, replacements and planned work across Kamloops and the Thompson Valley. Licensed, insured, and doing this since 2004.

[Request a quote](/contact) · [Call 250-555-0131](tel:+12505550131)

## What we do
- Water heater repair and replacement
- Drain and sewer work
- Emergency callouts

## What our customers say
Rated 4.6 stars across 74 Google reviews.

## Get in touch
Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.`;

const PLUMB_SERVICES_HTML = `<!doctype html><html lang="en"><head><title>Services — Cedar Ridge Plumbing</title></head><body>
<h1>Plumbing services in Kamloops</h1>
<section><h2>Water heater repair</h2><p>Same-week diagnosis on most jobs.</p><a class="btn" href="/contact">Request a quote</a></section>
<section><h2>Drain and sewer work</h2><p>Camera inspection before anything is dug up.</p><a class="btn" href="/contact">Request a quote</a></section>
<footer><a href="tel:+12505550131">250-555-0131</a></footer></body></html>`;

const PLUMB_SITE: SiteFixture = {
  key: "plumb",
  label: "Cedar Ridge Plumbing (plumbing, Kamloops BC)",
  shape:
    "the control — a normal service business whose call to action is a plain <a>Request a quote</a>, which IS one of CTA_RE's thirteen phrases. The old heuristic was happy here and is still happy; the outcome is identical, which is what makes the other two meaningful rather than lucky",
  name: "Cedar Ridge Plumbing",
  industry: "plumbing",
  city: "Kamloops",
  phone: "250-555-0131",
  tel: "+12505550131",
  domain: "https://cedar-ridge-plumbing.example",
  rating: 4.6,
  reviewCount: 74,
  homeHtml: PLUMB_HOME_HTML,
  homeMarkdown: PLUMB_HOME_MARKDOWN,
  subpages: [
    page(
      "https://cedar-ridge-plumbing.example/services",
      "Services",
      "# Plumbing services in Kamloops\n\nWater heater repair. Drain and sewer work.\n\nRequest a quote",
      PLUMB_SERVICES_HTML
    ),
  ],
  gbp: { limitedHours: true, hasBookingLink: false, hasHours: true },
  psi: { mobileScore: 66, mobileLcp: 3.6, cls: 0.05 },
  competitors: [
    { name: "Thompson Valley Mechanical", rating: 4.7, reviewCount: 150 },
    { name: "Riverbend Plumbing", rating: 4.5, reviewCount: 120 },
  ],
  reviews: [],
};

const SITES = [LAW_SITE, SPA_SITE, PLUMB_SITE];

/* ── the real pipeline, per site ───────────────────────────────────────────── */

function scrapeOf(s: SiteFixture): FirecrawlScrape {
  return {
    used: true,
    homepage: page(`${s.domain}/`, s.name, s.homeMarkdown, s.homeHtml),
    subpages: s.subpages,
  };
}

function dfsOf(s: SiteFixture): DataForSeoBundle {
  return {
    available: true,
    gbp: {
      available: true,
      category: s.industry,
      hasHours: s.gbp.hasHours,
      limitedHours: s.gbp.limitedHours,
      hasWebsite: true,
      hasPhone: true,
      hasMenuLink: false,
      hasBookingLink: s.gbp.hasBookingLink,
      hasPhotos: true,
      attributesPresent: ["Onsite services"],
      attributesMissing: ["No online appointment attribute"],
    },
    reviews: {
      available: true,
      count: s.reviewCount,
      averageRating: s.rating,
      positive: s.reviews.filter((r) => r.rating >= 4).length,
      neutral: s.reviews.filter((r) => r.rating === 3).length,
      negative: s.reviews.filter((r) => r.rating <= 2).length,
      positiveThemes: ["Clear communication"],
      negativeThemes: s.reviews.some((r) => r.rating <= 2) ? ["Poor communication"] : [],
      trustGaps: [],
      recentNegativeQuote: s.reviews.find((r) => r.rating <= 2)?.text ?? null,
      recentPositiveQuote: s.reviews.find((r) => r.rating >= 4)?.text ?? null,
      reviews: s.reviews.map((r) => ({ rating: r.rating, text: r.text, date: r.date })),
    },
  };
}

function psiOf(s: SiteFixture): PsiBundle | null {
  if (!s.psi) return null;
  return {
    available: true,
    url: s.domain,
    mobile: {
      strategy: "mobile",
      performanceScore: s.psi.mobileScore,
      metrics: {
        lcpSeconds: s.psi.mobileLcp,
        cls: s.psi.cls,
        inpMs: 190,
        fcpSeconds: 1.8,
        ttfbMs: 540,
        speedIndexSeconds: 3.4,
      },
      topOpportunities: [],
    },
    desktop: {
      strategy: "desktop",
      performanceScore: 92,
      metrics: { lcpSeconds: 1.4, cls: 0.01, inpMs: 70, fcpSeconds: 0.8, ttfbMs: 320, speedIndexSeconds: 1.5 },
      topOpportunities: [],
    },
  };
}

interface Detected {
  site: SiteFixture;
  data: ScrapeData;
  fired: FiredLeak[];
  coldAudit: FiredLeak[];
  advisoryOnly: FiredLeak[];
  clean: CleanCheck[];
  inputs: LeakInput[];
  intel: AuditIntelligence;
}

/** One site, all the way through the REAL pipeline, pre-sale. */
function runSite(s: SiteFixture): Detected {
  const scrape = scrapeOf(s);
  const facts = buildBusinessFacts({
    scrape,
    fallbackText: "",
    places: { name: s.name, phone: s.phone, address: `${s.city}`, website: s.domain },
    ownerName: null,
  });
  const intel = buildAuditIntelligence({
    websiteHtml: s.homeHtml,
    hasWebsiteUrl: true,
    reviews: [],
    competitors: s.competitors.map((c) => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
      website: "",
      category: s.industry,
      address: s.city,
    })),
    self: { rating: s.rating, reviewCount: s.reviewCount },
    verifiedFacts: facts,
    performance: psiOf(s),
    dataForSeo: dfsOf(s),
    screenshots: null,
  });
  const out = detectLeaks({
    mode: "pre_sale",
    business: {
      name: s.name,
      industry: s.industry,
      category: s.industry,
      city: s.city,
      phone: s.phone,
      website: s.domain,
      rating: s.rating,
      reviewCount: s.reviewCount,
    },
    intel,
    scrape,
    asOf: RESEARCH_AS_OF,
  });
  return {
    site: s,
    data: out.data,
    fired: out.fired,
    coldAudit: out.coldAudit,
    advisoryOnly: out.advisoryOnly,
    clean: out.cleanChecks,
    inputs: buildLeakInputs(out.coldAudit, out.data),
    intel,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 * THE LIVE PROBE — `npm run probe:site -- <url> …`
 *
 * The half this file cannot prove offline is whether a REAL page still produces
 * zero interpretive findings. That needs the web, so it is one command rather than
 * a promise: fetch each URL, push the HTML through the same three functions the
 * pipeline uses, and print what fingerprinted plus every leak that fired, with the
 * interpretive verdict on each. Exits 1 if any interpretive finding appears.
 *
 * WHAT IT IS NOT. A single-page `fetch` is not a Firecrawl scrape: no JavaScript
 * runs, no subpages are read, and a widget injected by a tag manager is invisible
 * to it. So it can UNDERSTATE what a real run sees, and it says so on every run.
 * What it cannot do is overstate — a `tel:` link found in fetched HTML is a `tel:`
 * link, and that is the one fact the false finding contradicted.
 * ══════════════════════════════════════════════════════════════════════════ */

const PROBE_FLAG = "--probe";

interface ProbeVerdict {
  /** True when no interpretive finding survived to a pre-sale surface. */
  ok: boolean;
  /** The printable report, one line per fact. */
  lines: string[];
  /** Leak ids that made it a failure, so a caller can assert on identity. */
  offenders: string[];
}

/**
 * THE PROBE'S ENTIRE VERDICT, given a URL and its HTML. Split out from the fetch on
 * purpose: `fetch` is the only part of `npm run probe:site` that needs the network,
 * so everything that DECIDES anything is a pure function of (url, html) and is
 * proved offline by check A7 against the same fixtures section A uses. What is left
 * unexercised without a network is one call to fetch.
 */
function probeHtml(target: string, html: string): ProbeVerdict {
  const lines: string[] = [];
  const host = (() => {
    try {
      return new URL(target).host;
    } catch {
      return target;
    }
  })();
  const scrape: FirecrawlScrape = {
    used: true,
    homepage: page(target, host, "", html),
    subpages: [],
  };
  const intel = buildAuditIntelligence({
    websiteHtml: html,
    hasWebsiteUrl: true,
    reviews: [],
    competitors: [],
    self: {},
    verifiedFacts: buildBusinessFacts({
      scrape,
      fallbackText: "",
      places: { name: host, phone: null, address: null, website: target },
      ownerName: null,
    }),
    performance: null,
    dataForSeo: null,
    screenshots: null,
  });
  const out = detectLeaks({
    mode: "pre_sale",
    business: { name: host, city: null, website: target },
    intel,
    scrape,
    asOf: new Date().toISOString(),
  });
  const w = out.data.website;
  const forms = analyzeForms(html);
  lines.push(`tel: link in the HTML            : ${intel.website.phoneClickable ? "YES" : "no"}`);
  lines.push(`hasClickToCallOnMobile           : ${w?.hasClickToCallOnMobile}`);
  lines.push(
    `call-to-action text found in <a>/<button>: ${
      intel.website.ctaSamples.length
        ? intel.website.ctaSamples.join(" | ")
        : "(none — a fact about our scan, not about the page)"
    }`
  );
  lines.push(`hasPrimaryCtaAboveFold (UNCITABLE, feeds no detector): ${w?.hasPrimaryCtaAboveFold}`);
  lines.push(`form fields we could read        : ${forms.fieldsSeen.length ? forms.fieldsSeen.join(", ") : "(none)"}`);
  lines.push(
    `leaks fired                      : ${
      out.fired.length ? out.fired.map((f) => `${f.leak.id} [${f.tier}/${f.grade}]`).join(", ") : "(none)"
    }`
  );
  lines.push(
    `most-provable selection (top-3)  : ${
      out.coldAudit.length ? out.coldAudit.map((f) => f.leak.id).join(", ") : "(none — a clean scan is a valid outcome)"
    }`
  );
  for (const c of out.cleanChecks) lines.push(`clean: ${c.statement}`);

  // detectLeaks is mode-blind since 2026-08-01 (the pre-sale drop died with the
  // audit generator), so an interpretive FIRE on a site genuinely missing the
  // tel: link is correct behaviour — it routes to the paid pack's advisory
  // surface, clearly labelled. What can never be right, and what fails the
  // probe, is a judgment WEARING A MEASUREMENT: graded observed, or seated in
  // the most-provable (top-3) selection.
  const offenders = Array.from(
    new Set([
      ...out.fired.filter((f) => isInterpretive(f) && f.grade === "observed").map((f) => f.leak.id),
      ...out.coldAudit.filter((f) => isInterpretive(f)).map((f) => f.leak.id),
    ])
  );
  const advisory = out.advisoryOnly.map((f) => f.leak.id);
  if (advisory.length) {
    lines.push(
      `interpretive fire(s), routed advisory-only: ${advisory.join(", ")} — labelled advice on the paid pack, never a finding, never "measured"`
    );
  }
  lines.push(
    offenders.length
      ? `✗ INTERPRETIVE CLAIM WEARING A MEASUREMENT: ${offenders.join(", ")} — graded observed or seated in the most-provable selection.`
      : "✓ nothing graded observed off a judgment, and no judgment in the most-provable selection"
  );
  return { ok: offenders.length === 0, lines, offenders };
}

async function probeLiveUrls(urls: string[]): Promise<number> {
  console.log("\nLIVE SITE PROBE — the real pages, through the real detectors");
  console.log(
    "  A single-page fetch, no JavaScript, no subpages. It can UNDERSTATE what a Firecrawl\n" +
      "  scrape sees (a script-injected chat widget or booking link will read as absent here);\n" +
      "  it cannot overstate. Treat an ABSENT as \"not in the HTML we fetched\".\n"
  );
  let bad = 0;
  for (const url of urls) {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    console.log(`\n── ${target}`);
    let html = "";
    try {
      const res = await fetch(target, {
        headers: { "user-agent": "ReclaimedHQ-audit-probe/1.0 (+offline verification)" },
        redirect: "follow",
      });
      html = await res.text();
      console.log(`   HTTP ${res.status} · ${html.length} bytes of HTML`);
    } catch (err) {
      console.log(`   FETCH FAILED — ${(err as Error).message}`);
      bad += 1;
      continue;
    }

    const verdict = probeHtml(target, html);
    for (const l of verdict.lines) console.log(`   ${l}`);
    if (!verdict.ok) bad += 1;
  }
  console.log(
    bad
      ? `\n${bad} site(s) produced a problem. Read the lines marked ✗ above.\n`
      : "\nEvery site probed produced zero interpretive findings.\n"
  );
  return bad ? 1 : 0;
}

const probeArgs = process.argv.slice(2).filter((a) => a !== PROBE_FLAG && !a.startsWith("-"));
if (process.argv.includes(PROBE_FLAG)) {
  if (!probeArgs.length) {
    console.error(
      "\nnpm run probe:site -- <url> [<url> …]\n\n" +
        "  Runs the REAL detectors over the REAL HTML of one or more live pages and prints\n" +
        "  what fingerprinted, which leaks fired, and whether any interpretive finding\n" +
        "  survived. Exits 1 if one did.\n"
    );
    process.exit(2);
  }
  void probeLiveUrls(probeArgs).then((code) => process.exit(code));
} else {
  runOfflineProof();
}

/* ════════════════════════════════════════════════════════════════════════════
 * THE OFFLINE PROOF
 * ══════════════════════════════════════════════════════════════════════════ */

function runOfflineProof(): void {
  console.log("\nFABRICATION VERIFICATION — a sentence nobody measured cannot reach a client-facing page");

  const runs = SITES.map(runSite);

  /* ──────────────────────────────────────────────────────────────────────────
   * A · ZERO INTERPRETIVE FINDINGS ON SITES THAT VISIBLY HAVE A CTA AND A PHONE
   * ────────────────────────────────────────────────────────────────────── */
  section("A · ZERO INTERPRETIVE FINDINGS on three sites that visibly have a CTA and a phone number");

  console.log(
    "          THESE ARE FIXTURES REPRODUCING THE REPORTED SHAPE, NOT LIVE SCRAPES.\n" +
      "          Synthetic .example domains and 555-01xx numbers; no real prospect is described\n" +
      "          here and nothing below is evidence about the business the finding was sent to.\n" +
      "          For the live half, one command:  npm run probe:site -- https://their-site.com"
  );

  for (const r of runs) {
    const w = r.data.website!;
    section(`A · ${r.site.label}`);
    show("what this fixture reproduces", r.site.shape);
    show("phone number, as published  ", `${r.site.phone} — as a tel: link in the HTML: ${r.intel.website.phoneClickable}`);
    show("call to action, as published", "in the markup above; the scan's own view of it is the next two lines");
    show("ctaSamples (text inside <a>/<button> only)", r.intel.website.ctaSamples.length ? r.intel.website.ctaSamples : "(none found — a fact about our scan, not about the page)");
    show("hasClickToCallOnMobile [F, /href=[\"']tel:/i]", w.hasClickToCallOnMobile);
    show("hasPrimaryCtaAboveFold [P, UNCITABLE]       ", w.hasPrimaryCtaAboveFold);
    show("servicePagesHaveCtas   [P, UNCITABLE]       ", w.servicePagesHaveCtas);
    show("scanConfident          [P, UNCITABLE]       ", w.scanConfident);
    show("fired leaks", r.fired.map((f) => `${f.leak.id} [${f.tier}/${f.grade}]`));
    show("most-provable selection (top-3)", r.coldAudit.map((f) => f.leak.id));
  }

  check("A1 · RUNTIME — every one of the three sites fingerprints a tel: link (the fact the shipped sentence contradicted)", () => {
    for (const r of runs) {
      show(`${r.site.key.padEnd(6)} hasClickToCallOnMobile`, r.data.website?.hasClickToCallOnMobile);
      assert.equal(
        r.data.website?.hasClickToCallOnMobile,
        "PRESENT",
        `${r.site.label}: the fixture is supposed to publish a tel: link and the pipeline did not find one — ` +
          "the section below would then be proving nothing about a site that has a visible phone number"
      );
    }
  });

  check("A2 · RUNTIME — the OLD rule would have fired on two of the three; this is the non-vacuity check", () => {
    // The removed rule, reconstructed from the fields it read, because those fields
    // are still computed: `scanConfident && !hasPrimaryCtaAboveFold` fired
    // tier OBSERVED, which graded `observed`, which prints "Measured on your public
    // pages, {date}". Nothing here calls the old code — it is gone. This is the
    // arithmetic of the old guard against today's data, so the reader can see the
    // false positive happen and then see it not happen.
    const wouldHaveFired = runs.filter((r) => {
      const w = r.data.website!;
      return w.scanConfident && !w.hasPrimaryCtaAboveFold;
    });
    for (const r of runs) {
      const w = r.data.website!;
      show(
        `${r.site.key.padEnd(6)} old rule (scanConfident && !hasPrimaryCtaAboveFold)`,
        w.scanConfident && !w.hasPrimaryCtaAboveFold ? "WOULD HAVE FIRED → grade observed → \"Measured on your public pages\"" : "would not have fired"
      );
    }
    // The first 1500 characters the old heuristic actually read, so the reader can
    // see what the window was spent on.
    const lawWindow = (LAW_HOME_MARKDOWN.slice(0, 1500).match(/[^\n]+/g) ?? []).slice(0, 3).join(" ⏎ ");
    show("what the law firm's 1500-char markdown window opens with", `${lawWindow.slice(0, 150)}…`);
    assert(
      wouldHaveFired.length >= 2,
      `only ${wouldHaveFired.length} of the three fixtures would have tripped the old rule, so section A is not ` +
        "reproducing the false-positive shape any more. Rebuild the fixtures so at least two of them have a real, " +
        "visible call to action that the thirteen-phrase heuristic misses — otherwise \"no interpretive finding\" " +
        "is just luck."
    );
  });

  check("A3 · RUNTIME — ZERO interpretive findings on all three: the false-positive shape does not fire at all", () => {
    // These sites HAVE the tel: link — the exact shape the shipped false finding
    // fired on. The narrowed detector must therefore produce NO interpretive
    // fire whatsoever (not merely route one away): a fire here would mean the
    // judgment heuristics are back in the detection path.
    for (const r of runs) {
      const interpretiveFired = r.fired.filter((f) => isInterpretive(f)).map((f) => f.leak.id);
      const interpretiveNumbered = r.coldAudit.filter((f) => isInterpretive(f)).map((f) => f.leak.id);
      show(`${r.site.key.padEnd(6)} interpretive fires / in selection / advisory`, `${interpretiveFired.length} / ${interpretiveNumbered.length} / ${r.advisoryOnly.length}`);
      assert.deepEqual(interpretiveFired, [], `${r.site.label}: an interpretive leak fired on a site that visibly has the signals — the false-positive shape is back`);
      assert.deepEqual(interpretiveNumbered, [], `${r.site.label}: an interpretive leak reached the most-provable (top-3) selection`);
      assert.deepEqual(
        r.advisoryOnly.map((f) => f.leak.id),
        [],
        `${r.site.label}: a site with a visible tel: link produced advisory-only fires — the advisory surface exists for ` +
          "sites genuinely missing the fingerprint, not for this shape."
      );
      // Recomputed from the fired set rather than read off detectLeaks' own field, so
      // the routing function and the detection agree about what is advisory-only. If
      // they ever disagree, one of the two views of the same detection is wrong.
      assert.deepEqual(
        advisoryOnlyLeaks(r.fired).map((f) => f.leak.id),
        r.advisoryOnly.map((f) => f.leak.id),
        `${r.site.label}: advisoryOnlyLeaks() and detectLeaks().advisoryOnly disagree`
      );
      // And the specific leak this round is about is absent by name, not just by class.
      assert(
        !r.fired.some((f) => f.leak.id === "weak_landing_cta"),
        `${r.site.label}: weak_landing_cta fired on a site with a tel: link`
      );
    }
  });

  check("A4 · RUNTIME — and NONE of them grades observed off a judgment (the ceiling, exercised directly)", () => {
    // Two halves. First: nothing in any of the three detections is both interpretive
    // and graded observed. Second, and stronger: the ceiling itself — hand `gradeOf`
    // an OBSERVED tier on every interpretive leak in the taxonomy and prove it still
    // refuses. The first could pass because nothing fired; the second cannot.
    for (const r of runs) {
      const laundered = r.fired.filter((f) => isInterpretive(f) && f.grade === "observed");
      assert.deepEqual(laundered.map((f) => f.leak.id), [], `${r.site.label}: an interpretive fire is graded observed`);
    }
    const interpretiveLeaks = LEAKS.filter((l) => l.checkability === "INTERPRETIVE");
    show("interpretive leaks in the taxonomy", interpretiveLeaks.map((l) => l.id));
    assert(
      interpretiveLeaks.length > 0,
      "no leak is classified INTERPRETIVE any more, so the grade ceiling is untested. If that is deliberate, this check has to be rewritten to say what replaced it."
    );
    for (const l of interpretiveLeaks) {
      const cold = gradeOf({ tier: "OBSERVED", leak: l });
      const withIntake = gradeOf({ tier: "OBSERVED", intakeConfirmed: true, leak: l });
      show(`${l.id} · gradeOf(OBSERVED) / gradeOf(OBSERVED + intake)`, `${cold} / ${withIntake}`);
      assert.notEqual(cold, "observed", `gradeOf still returns "observed" for "${l.id}" — that label prints "Measured on your public pages"`);
      assert.notEqual(withIntake, "observed", `gradeOf returns "observed" for "${l.id}" when the client confirmed it — a disclosure is not a measurement`);
      assert.equal(withIntake, "disclosed", `a client-confirmed interpretive leak should stay attributed to them, not hedged; got "${withIntake}"`);
    }
  });

  check("A5 · RUNTIME — the honest half is not lost: the tel: link comes back as a CLEAN CHECK, by name", () => {
    // The failure mode of a fix like this is silence: the false claim goes away and
    // the true observation goes with it. It does not. The check that was reported as
    // a failure is now reported, by name, as clean.
    for (const r of runs) {
      const ids = r.clean.map((c) => c.id);
      const ctc = r.clean.find((c) => c.id === "click_to_call");
      show(`${r.site.key.padEnd(6)} clean checks`, ids);
      assert(ctc, `${r.site.label}: the tel: link fingerprinted PRESENT and no clean check says so`);
      show(`${r.site.key.padEnd(6)} click_to_call statement`, ctc!.statement);
      assert(
        /tap[- ]to[- ]call/i.test(ctc!.statement),
        `${r.site.label}: the clean check for the phone link does not describe it as tap-to-call`
      );
    }
  });

  check("A6 · RUNTIME — the fixtures fire REAL leaks, so \"no interpretive finding\" is not \"no finding\"", () => {
    // A detection that produced nothing at all would satisfy every assertion above.
    // At least one of the three has to carry a selected finding, and every selected
    // finding across all three has to be HARD and established. (The selection is
    // detectLeaks().coldAudit — the paid pack's most-provable top-3 context.)
    const total = runs.reduce((n, r) => n + r.coldAudit.length, 0);
    for (const r of runs) {
      show(`${r.site.key.padEnd(6)} selected findings`, r.coldAudit.map((f) => `${f.leak.id} [${f.tier}]`));
      for (const f of r.coldAudit) {
        assert.equal(f.leak.checkability, "HARD", `${r.site.label}: selected finding "${f.leak.id}" is not HARD`);
        assert(
          f.tier === "OBSERVED" || f.tier === "EVIDENCED",
          `${r.site.label}: selected finding "${f.leak.id}" fired at ${f.tier} — an industry pattern is not a finding about them`
        );
        assert(
          f.leak.deliverableTargets.includes("cold_audit"),
          `${r.site.label}: "${f.leak.id}" is in the most-provable selection but cold_audit is not one of its deliverableTargets`
        );
      }
    }
    show("selected findings across the three sites", total);
    assert(total >= 2, `the three fixtures produced ${total} selected findings between them — too few for section B to be about anything`);
  });

  check("A7 · RUNTIME — the LIVE PROBE's verdict logic is proved here; only the fetch needs the network", () => {
    // `npm run probe:site` is the command that closes the gap between these fixtures
    // and his real prospects, and a command nobody has run is a command nobody should
    // trust. Everything in it that DECIDES anything is `probeHtml(url, html)`, a pure
    // function — so it is exercised offline on the same markup section A uses, plus
    // one deliberately hostile input. What is left unproved without a network is a
    // single call to `fetch`, and that is stated rather than implied.
    for (const s of SITES) {
      const v = probeHtml(`${s.domain}/`, s.homeHtml);
      line("");
      line(`  probe · ${s.domain}`);
      for (const l of v.lines) line(`       ${l}`);
      assert(v.ok, `the probe reports an interpretive finding on ${s.label}: ${v.offenders.join(", ")}`);
      assert.deepEqual(v.offenders, [], `${s.label}: ${v.offenders.join(", ")}`);
      assert(
        v.lines.some((l) => /tel: link in the HTML\s+: YES/.test(l)),
        `${s.label}: the probe did not report the tel: link it publishes — its report would mislead him about the one fact that matters`
      );
    }
    line("");
    // A page with NOTHING on it: no phone, no CTA, no form. The probe must still
    // produce a verdict rather than throwing, and must NOT invent an interpretive
    // finding out of the emptiness — which is the exact failure mode of a heuristic
    // that reads silence as absence.
    const emptyish = "<!doctype html><html><head><title>Under construction</title></head><body><p>Back soon.</p></body></html>";
    const v = probeHtml("https://nothing-here.example/", emptyish);
    line("  probe · an almost-empty page");
    for (const l of v.lines) line(`       ${l}`);
    assert(v.ok, `the probe invented an interpretive finding on an empty page: ${v.offenders.join(", ")}`);
    assert(
      v.lines.some((l) => /tel: link in the HTML\s+: no/.test(l)),
      "the probe claims a tel: link on a page that has none"
    );
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * B · EVERY FINDING TRACEABLE TO A BOUND VALUE — WITH THE BINDING PRINTED
   * ────────────────────────────────────────────────────────────────────── */
  section("B · EVERY REMAINING FINDING TRACES TO A BOUND VALUE — printed beside the finding");

  console.log(
    "          Read this as the answer to one question: if the owner asks \"where did that\n" +
      "          sentence come from\", what do we hand him? Each finding below prints the field\n" +
      "          names and the ACTUAL values it is permitted to cite, the system that owns each\n" +
      "          value, and the one assertion that value licenses. Anything outside that list is\n" +
      "          fabrication, and section C is where the lint refuses it."
  );

  const UNCITABLE = new Set<string>(UNCITABLE_SCRAPE_FIELDS);

  function printBinding(where: string, i: number, name: string, grade: string, tier: string, b: EvidenceBinding): void {
    line("");
    line(`  ${String(i + 1).padStart(2, "0")} · ${name}   [grade: ${grade}] [tier: ${tier}] [checkability: ${b.checkability}]`);
    if (!b.values.length) {
      line("       BOUND VALUES: (none — this finding licenses NO factual claim about their public pages)");
    }
    for (const v of b.values) {
      line(`       ${v.field} = ${JSON.stringify(v.value)}   [${v.provenance}] owner: ${v.source.slice(0, 88)}`);
      line(`            licenses → ${v.licenses.slice(0, 150)}`);
    }
    line(`       figures this finding may print about them: ${b.numbers.length ? b.numbers.join(", ") : "(none)"}`);
    if (b.disputedTopics.length) line(`       disputed topics (reported, never blocking): ${b.disputedTopics.join(", ")}`);
    if (b.neverObserved) line(`       NEVER OBSERVED — ${b.neverObserved.slice(0, 140)}`);
    line(`       (${where})`);
  }

  check("B1 · RUNTIME — every selected finding on all three sites carries at least one bound value, printed above", () => {
    let printed = 0;
    for (const r of runs) {
      r.inputs.forEach((li, i) => {
        printBinding(r.site.label, i, li.name, li.grade, li.tier, li.binding);
        printed += 1;
        assert(
          li.binding.values.length > 0,
          `${r.site.label}: selected finding "${li.id}" is bound to NO value at all. The most-provable pool is ` +
            "reachable by a pre-sale detection, so a finding in it either rests on something we measured or it " +
            "does not belong there — declare its permitted values in BINDINGS (src/lib/leak-narrative.ts), or " +
            "take the leak out of cold_audit."
        );
        assert.equal(li.binding.leakId, li.id, `${r.site.label}: the binding on "${li.id}" says it belongs to "${li.binding.leakId}"`);
        // ONE CONSTRUCTOR, AND IT IS DETERMINISTIC. The binding that travels on a
        // LeakInput must be exactly what `bindEvidence` produces from the same fire
        // and the same scrape — buildLeakInputs stamps it, it does not author or
        // adjust it. A second place a binding can come from is a second place the
        // "measured" label can stop meaning anything.
        const fire = r.coldAudit.find((f) => f.leak.id === li.id)!;
        assert.deepEqual(
          bindEvidence(fire, r.data),
          li.binding,
          `${r.site.label}: the binding carried on "${li.id}" is not what bindEvidence() produces for the same fire`
        );
      });
    }
    line("");
    show("findings with their binding printed", printed);
    assert(printed >= 2, "nothing was printed, so this section proves nothing");
  });

  check("B2 · RUNTIME — no bound value cites a field that promises a measurement we do not take", () => {
    show("UNCITABLE_SCRAPE_FIELDS", Array.from(UNCITABLE));
    for (const r of runs) {
      for (const li of r.inputs) {
        for (const v of li.binding.values) {
          assert(
            !UNCITABLE.has(v.field),
            `${r.site.label}: "${li.id}" is bound to ${v.field}, which is in UNCITABLE_SCRAPE_FIELDS — ` +
              "that list is the set of names promising a measurement the code does not take"
          );
          assert(
            ["M", "F", "H", "I"].includes(v.provenance),
            `${r.site.label}: "${li.id}" binds ${v.field} at provenance "${v.provenance}". A parsed guess ("P") has no ` +
              "representation in a binding by design — see ValueProvenance in src/lib/leak-narrative.ts"
          );
        }
      }
    }
  });

  check("B3 · RUNTIME — a value is bound only when the scan RESOLVED it: no claim rests on UNKNOWN", () => {
    // "UNKNOWN" is the scan failing to answer, and a failure to answer is not a
    // reading in either direction. It is the state `scanConfident` lets through as a
    // false absence, which is how an absence claim gets made about a page nobody read.
    for (const r of runs) {
      for (const li of r.inputs) {
        for (const v of li.binding.values) {
          assert.notEqual(
            String(v.value).toUpperCase(),
            "UNKNOWN",
            `${r.site.label}: "${li.id}" is bound to ${v.field} = UNKNOWN`
          );
          assert(
            v.value !== "" && v.value !== null && v.value !== undefined,
            `${r.site.label}: "${li.id}" is bound to ${v.field} with an empty value`
          );
        }
      }
    }
    show("bound values checked", runs.reduce((n, r) => n + r.inputs.reduce((m, li) => m + li.binding.values.length, 0), 0));
  });

  // B4 — DELETED 2026-08-01. It read the binding off the committed fixture
  // cold audits (cold-audit.json / 00-cold-audit.html), which were deleted with
  // their surface. The binding-survives-to-the-artifact guarantee lives on for
  // the PAID pack: LeakAnalysisItem.binding is stamped on the saved row and B5
  // below runs the full validator — fabrication gate included — over every
  // committed pack, which is the read-back that matters now.

  check("B5 · ARTIFACT — every committed fixture PACK passes the full validator, fabrication gate included", () => {
    // NOTHING IN THE CHAIN CHECKED THIS BEFORE. `npm run fixtures:clients` refuses to
    // WRITE a pack that fails, which protects the moment of generation and nothing
    // afterwards: the three packs on disk were written by an older version of the
    // code, and when the fabrication gate landed all three began failing it while
    // every verify script stayed green (they read leak counts and grade splits, not
    // the laws). A committed fixture that fails its own laws is worse than none,
    // because the suite goes green on it.
    const dirs = fixtureClientDirs();
    assert(dirs.length >= 3, `only ${dirs.length} fixture clients on disk — run npm run fixtures:clients`);
    for (const d of dirs) {
      const pack = JSON.parse(read(`_fixtures/clients/${d}/pack.json`)) as AssetPack;
      const v = validatePack(pack);
      const fails = v.checks.filter((c) => c.level === "fail");
      show(`${d} · validatePack`, fails.length ? `${fails.length} FATAL` : `clean (${v.checks.length} checks)`);
      for (const f of fails) line(`       FATAL [${f.law}] ${f.message.slice(0, 220)}`);
      assert.equal(
        fails.length,
        0,
        `${d}/pack.json fails its own laws. Re-run npm run fixtures:clients — and if it refuses to write, the prose in ` +
          "scripts/make-fixture-clients.ts is what needs fixing, not the gate."
      );
    }
    const goldenPath = "_fixtures/golden-pack.json";
    if (existsSync(resolve(REPO, goldenPath))) {
      const golden = validatePack(JSON.parse(read(goldenPath)) as AssetPack);
      const goldenFails = golden.checks.filter((c) => c.level === "fail");
      show("_fixtures/golden-pack.json · validatePack", goldenFails.length ? `${goldenFails.length} FATAL` : `clean (${golden.checks.length} checks)`);
      assert.equal(goldenFails.length, 0, `the golden pack fails its own laws: ${goldenFails.map((f) => f.message.slice(0, 200)).join(" | ")}. Re-run npm run sample:golden.`);
    }
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * C · THE INVENTED-DETAIL FIXTURE
   * ────────────────────────────────────────────────────────────────────── */
  section("C · THE INVENTED DETAIL — inserted into a VALID finding, and refused by name");

  // The valid finding: the strongest measured one any of the three sites produced,
  // with its real binding. Everything in this section deforms THIS, so the failures
  // below are caused by the invention and by nothing else.
  const validSource = runs
    .flatMap((r) => r.inputs.map((li) => ({ site: r.site, li })))
    .find(({ li }) => li.grade === "observed" && li.binding.values.length > 0);
  assert(validSource, "no observed finding with a binding was produced, so section C has nothing valid to deform");

  const VALID_PROSE =
    "No online booking link on the site or the Google Business Profile, and none on the listing either. " +
    "Somebody who decides at 10pm has to remember to ring in the morning, and remembering is where a lot of that intent quietly dies.";

  /** The sentence that shipped, and a second invention of a different shape. */
  const INVENTION_WITH_DIGITS =
    "Your phone number is buried three scrolls down the page.";
  const INVENTION_WITHOUT_DIGITS =
    "There is no clear call to action on your homepage, so visitors face no clear direction on what to do next.";

  check("C1 · RUNTIME — \"your phone number is buried\" is REJECTED, and the failure names the sentence", () => {
    const text = `${VALID_PROSE} ${INVENTION_WITH_DIGITS}`;
    const r = fabricationLint(text, validSource!.li.binding);
    show("finding deformed", `${validSource!.li.name} (${validSource!.site.label})`);
    show("inserted sentence", INVENTION_WITH_DIGITS);
    show("lint ok", r.ok);
    show("hit kinds", r.hits.map((h) => h.kind));
    for (const h of r.hits) {
      line(`       ${h.kind} · topic ${h.topic} · matched "${h.matched}"`);
      line(`            sentence: "${h.sentence}"`);
      line(`            why: ${h.why.slice(0, 170)}`);
    }
    assert(!r.ok, "the lint accepted \"your phone number is buried\" on a finding bound to a booking-link absence");
    assert(
      r.hits.some((h) => h.sentence === INVENTION_WITH_DIGITS),
      `the lint failed but did not name the inserted sentence. It reported: ${r.hits.map((h) => `"${h.sentence}"`).join(" | ")}`
    );
    assert(
      r.unmeasurable.some((h) => h.sentence === INVENTION_WITH_DIGITS),
      "the sentence was reported at a tier other than `unmeasurable`. Position and prominence must be fatal with or " +
        "without a binding: no field in the contract can license them, so the verdict cannot depend on plumbing landing elsewhere."
    );
  });

  check("C2 · RUNTIME — a second invention with NO DIGITS in it is rejected the same way", () => {
    // Different shape on purpose. The old number guard could only ever see figures;
    // this sentence contains not one digit, and it is the other half of what shipped.
    const text = `${VALID_PROSE} ${INVENTION_WITHOUT_DIGITS}`;
    const r = fabricationLint(text, validSource!.li.binding);
    show("inserted sentence", INVENTION_WITHOUT_DIGITS);
    show("digits in it", /\d/.test(INVENTION_WITHOUT_DIGITS));
    show("lint ok", r.ok);
    for (const h of r.hits) line(`       ${h.kind} · topic ${h.topic} · matched "${h.matched}"`);
    assert(!/\d/.test(INVENTION_WITHOUT_DIGITS), "this fixture is supposed to contain no digits");
    assert(!r.ok, "the lint accepted \"no clear call to action on your homepage\"");
    assert(
      r.hits.some((h) => h.sentence === INVENTION_WITHOUT_DIGITS),
      "the lint failed but did not name the inserted sentence"
    );
    assert(
      r.unmeasurable.some((h) => h.topic === "cta_quality"),
      "the sentence was not classified as a CTA-quality claim, which is the topic that makes it unlicensable"
    );
  });

  check("C3 · RUNTIME — the NUMBER guard passes both of them, which is why a claim gate had to exist", () => {
    // The gate that was in place when the false finding shipped extracts numeric
    // tokens and checks them against an allowed set. Run it on both inventions with
    // the finding's real allowed-number set: it is happy. That is not a criticism of
    // statGuard — it is the reason a second, differently-shaped gate was needed.
    const allowed = allowedNumbersFor(
      runs.flatMap((r) => r.coldAudit),
      runs[0].data
    );
    for (const invention of [INVENTION_WITH_DIGITS, INVENTION_WITHOUT_DIGITS]) {
      const g = statGuard(invention, allowed);
      show(`statGuard("${invention.slice(0, 44)}…")`, g.ok ? "PASSES — sees nothing wrong" : `blocks: ${g.violations.join(", ")}`);
      assert(
        g.ok,
        "statGuard now blocks this sentence, which would make C3's point moot. If a number rule really does catch it, " +
          "rewrite this check to state the new truth rather than deleting it."
      );
    }
    show("and the fabrication lint on the same two", "REJECTS both (C1, C2)");
  });

  check("C4 · COMPANION — the SAME finding without the invention PASSES (the lint is not just always-red)", () => {
    const r = fabricationLint(VALID_PROSE, validSource!.li.binding);
    show("prose", `${VALID_PROSE.slice(0, 120)}…`);
    show("bound values it rests on", validSource!.li.binding.values.map((v) => `${v.field}=${JSON.stringify(v.value)}`));
    show("lint ok", r.ok);
    show("claims found in it", siteFactClaims(VALID_PROSE).map((c) => `${c.topic}:"${c.matched}"`));
    if (!r.ok) for (const h of r.hits) line(`       ${h.kind} · "${h.sentence}" — ${h.why.slice(0, 140)}`);
    assert(
      r.ok,
      "the honest version of the finding is ALSO rejected, so the lint is not discriminating between a measured claim " +
        "and an invented one — it is just blocking prose. Fix the lint, not the copy."
    );
    // And it is not passing because it makes no claim at all: the booking-path claim
    // is found, matched to a topic, and licensed by a bound value.
    const claims = siteFactClaims(VALID_PROSE);
    assert(
      claims.some((c) => c.topic === "booking_path"),
      "the honest version makes no checkable claim at all, so it passing the lint says nothing"
    );
  });

  check("C5 · COMPANION — the lint still fires on FRESH inventions it has never seen", () => {
    // Four sentences that appear nowhere in src/ or scripts/ — asserted, not assumed,
    // below. A lint that only catches the exact sentence someone wrote a pattern for
    // is a blocklist of one incident.
    const fresh = [
      "The enquiry button is tucked away underneath the testimonials.",
      "Your best offer sits below the fold on a phone.",
      "The contact details are easy to miss in that footer.",
      "Nothing on the page tells visitors what to do next.",
    ];
    // FRESH MEANS FRESH TO THE LINT. The haystack is the code that judges — the
    // detection contract, the taxonomy, the lint and the validator — and NOT this
    // file: a sentence typed here is obviously written down here, and including this
    // file would make the assertion self-defeating rather than strict. What matters
    // is that none of these sentences is a string the guard was built around: they
    // are not in the taxonomy's forbidden list, not in a symptom string, and not in
    // the shipped finding. The lint catches them because it polices SUBJECTS, not
    // vocabulary.
    const haystack = [
      read("src/lib/leak-narrative.ts"),
      read("src/lib/leak-taxonomy.ts"),
      read("src/lib/leak-detection.ts"),
      read("src/lib/exporters/validate-pack.ts"),
      read("docs/detector-checkability.md"),
    ].join("\n");
    for (const sentence of fresh) {
      assert(
        !haystack.includes(sentence),
        `"${sentence}" already appears in the guard's own sources, so it is not a sentence the lint has never seen. Pick another.`
      );
      const r = fabricationLint(`${VALID_PROSE} ${sentence}`, validSource!.li.binding);
      const hit = r.hits.find((h) => h.sentence === sentence);
      show(`fresh invention`, `"${sentence}" → ${hit ? `${hit.kind} (${hit.topic}), matched "${hit.matched}"` : "NOT CAUGHT"}`);
      assert(hit, `the lint did not catch "${sentence}". It is a claim about where something sits or how easy it is to see, and we render no page.`);
    }
  });

  check("C6 · RUNTIME — the PACK VALIDATOR refuses the invention too, not only the lint", () => {
    // The lint is a function; the gate is validatePack, and it runs at save and at
    // export on every paid pack. (It used to be proved on the cold-audit validator
    // as well; that surface is deleted, and the pack gate is the one that remains.)
    // Same invention, this time planted inside a committed pack's leak analysis,
    // judged the way a stored pack is judged.
    const goldenPath = "_fixtures/golden-pack.json";
    assert(existsSync(resolve(REPO, goldenPath)), `${goldenPath} is missing — run npm run sample:golden`);
    const clean = JSON.parse(read(goldenPath)) as AssetPack;
    const dirty = JSON.parse(read(goldenPath)) as AssetPack;
    const leaks = dirty.intelligence?.leakAnalysis ?? [];
    // A position/prominence claim is `unmeasurable`: no field in the contract can
    // license it, so the gate is FATAL whether or not the leak carries a binding
    // (validate-pack.ts states this in the fabrication-gate header). Plant it on
    // the first finding; whether that finding is bound is reported, not required.
    const target = leaks[0] as LeakAnalysisItem | undefined;
    assert(target, "the golden pack has no leak analysis at all — the pack gate would judge nothing");
    show("planted on", `${target!.leakName ?? target!.area} (binding on the row: ${Boolean((target as { binding?: unknown }).binding)})`);
    show("planted sentence", INVENTION_WITH_DIGITS);
    target!.explanation = `${target!.explanation ?? ""} ${INVENTION_WITH_DIGITS}`.trim();

    const cleanV = validatePack(clean);
    const dirtyV = validatePack(dirty);
    const cleanFails = cleanV.checks.filter((c) => c.level === "fail");
    const named = dirtyV.checks.filter((c) => c.level === "fail");
    show("clean pack · fails", cleanFails.length);
    show("dirty pack · fails", named.length);
    for (const c of named) line(`       FATAL [${c.law}] ${c.message.slice(0, 200)}`);
    assert.equal(cleanFails.length, 0, `the honest pack does not pass its own gate: ${cleanFails.map((c) => c.message.slice(0, 160)).join(" | ")}`);
    assert(named.length > 0, "the pack validator passed a pack carrying \"your phone number is buried\" beside a bound finding");
    assert(
      named.some((c) => /binding|measured value/i.test(`${c.law} ${c.message}`)),
      `the pack failed, but not on the evidence-binding law: ${named.map((c) => c.law).join(", ")}`
    );
    assert(
      named.some((c) => c.message.includes("buried")),
      "the failure message does not quote the offending sentence, so the operator cannot see which line to edit"
    );
  });

  check("C7 · ARTIFACT — not one committed client-facing document makes a position or prominence claim", () => {
    // The strongest form of the statement, and the cheapest to read: run the SHIPPED
    // claim detector over the visible words of every document on disk and count the
    // claims nothing can license. Not a private regex list in this file — the same
    // `siteFactClaims` the lint and both validators use, so "the sentence cannot be
    // on a page" and "the gate would refuse it" are one fact rather than two.
    const NEVER = new Set(["cta_position", "prominence", "cta_quality"]);
    const artifacts = clientFacingArtifacts();
    assert(artifacts.length >= 5, `only ${artifacts.length} committed documents found — run npm run fixtures:clients`);
    const offences: string[] = [];
    for (const a of artifacts) {
      const claims = siteFactClaims(visibleText(a.html)).filter((c) => NEVER.has(c.topic));
      if (claims.length) {
        for (const c of claims.slice(0, 3)) offences.push(`${a.where} → [${c.topic}] "${c.sentence.slice(0, 130)}"`);
      }
    }
    show("documents scanned", artifacts.length);
    show("position / prominence / CTA-quality claims", offences.length ? offences : 0);
    assert.deepEqual(
      offences,
      [],
      `a committed client-facing document asserts something about where an element sits or how easy it is to see:\n          ` +
        offences.join("\n          ") +
        "\n          We render no page and measure no position. Fix the prose in the generator that wrote it " +
        "(scripts/make-golden-sample.ts or scripts/make-fixture-clients.ts), then regenerate."
    );
    // Non-vacuity: the same scan over the sentence that shipped must produce a hit.
    const control = siteFactClaims(
      "Visitors arrive on your homepage but face no clear direction on what to do next. There's no primary action above the fold, and your phone number is buried."
    ).filter((c) => NEVER.has(c.topic));
    show("the same scan over the sentence that SHIPPED", control.map((c) => `${c.topic}:"${c.matched}"`));
    assert(control.length >= 2, "the scan no longer recognises the sentence that shipped, so a clean result above means nothing");
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * D — DELETED 2026-08-01 (the CTA button, and the booking-gate pin)
   *
   * D1/D4 proved the booking anchor on the rendered cold audit (configured →
   * exactly one link; unconfigured → zero links, close intact) and D2 pinned the
   * REMOVAL of the old booking gate so it could not quietly return. The renderer
   * those checks ran is deleted, the document they protected no longer exists,
   * and the gate they pinned the absence of has no surface to return to — the
   * whole booking-gate story died with its surface. Nothing here protected the
   * paid pack; the paid documents carry no booking CTA law.
   * ────────────────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────────────────────
   * E · NO THIRD-PARTY KEY IN ANY CLIENT-FACING HTML
   * ────────────────────────────────────────────────────────────────────── */
  section("E · NO THIRD-PARTY KEY IN ANY CLIENT-FACING DOCUMENT");

  console.log(
    "          A shipped audit once embedded <img src=\"https://api.screenshotone.com/take?access_key=…\">\n" +
      "          — our access key and an HMAC of it, in the source of a file emailed to strangers.\n" +
      "          This scans every committed client-facing document AND every document re-rendered\n" +
      "          here, for anything key-shaped."
  );

  /** Patterns for things that must never appear in a document we email out. */
  const KEY_SHAPES: { name: string; re: RegExp }[] = [
    { name: "access_key", re: /access[_-]?key/gi },
    { name: "api_key", re: /api[_-]?key/gi },
    { name: "apikey", re: /\bapikey\b/gi },
    { name: "client_secret", re: /client[_-]?secret/gi },
    { name: "secret", re: /\bsecret[_-]?(?:key|token)?\s*[:=]/gi },
    { name: "token=", re: /\btokens?\s*[:=]/gi },
    { name: "bearer", re: /\bBearer\s+[A-Za-z0-9._-]{8,}/g },
    { name: "signature=", re: /\bsignature\s*=/gi },
    { name: "openai-style key", re: /\bsk-[A-Za-z0-9]{16,}/g },
    { name: "google-style key", re: /\bAIza[0-9A-Za-z_-]{20,}/g },
    { name: "long hex run (32+)", re: /\b[0-9a-fA-F]{32,}\b/g },
  ];

  /** Remote hosts a client-facing document is allowed to reference. Fonts only, and
   *  they carry no credential; anything else is a finding rather than a judgment
   *  call, because a remote URL in an emailed file is a request somebody else's
   *  server sees. (booking.example left this list with the cold audit — no paid
   *  document carries a booking button, so the allowlist tightened.) */
  const ALLOWED_REMOTE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

  interface KeyScanResult {
    where: string;
    hits: string[];
    remoteHosts: string[];
    dataUris: number;
  }

  function scanForKeys(where: string, html: string): KeyScanResult {
    const hits: string[] = [];
    for (const { name, re } of KEY_SHAPES) {
      const found = html.match(new RegExp(re.source, re.flags)) ?? [];
      for (const f of found.slice(0, 3)) hits.push(`${name}: ${f.slice(0, 40)}`);
    }
    const hosts = new Set<string>();
    for (const m of html.match(/https?:\/\/[^\s"'<>)]+/g) ?? []) {
      try {
        hosts.add(new URL(m).host);
      } catch {
        hosts.add(m.slice(0, 40));
      }
    }
    return {
      where,
      hits,
      remoteHosts: Array.from(hosts),
      dataUris: (html.match(/src="data:image\//g) ?? []).length,
    };
  }

  function clientFacingArtifacts(): { where: string; html: string }[] {
    const out: { where: string; html: string }[] = [];
    // The four deliverables as committed at the repo root fixture.
    for (const f of readdirSync(resolve(REPO, "_fixtures"))) {
      if (f.endsWith(".html")) out.push({ where: `_fixtures/${f}`, html: read(`_fixtures/${f}`) });
    }
    // Every file of every committed fixture client — four paid deliverables each.
    for (const d of fixtureClientDirs()) {
      for (const f of readdirSync(resolve(REPO, `_fixtures/clients/${d}`))) {
        if (f.endsWith(".html")) out.push({ where: `_fixtures/clients/${d}/${f}`, html: read(`_fixtures/clients/${d}/${f}`) });
      }
    }
    return out;
  }

  check("E1 · ARTIFACT — every committed client-facing document is free of anything key-shaped", () => {
    const artifacts = clientFacingArtifacts();
    assert(artifacts.length >= 5, `only ${artifacts.length} committed documents found — run npm run fixtures:clients`);
    const bad: KeyScanResult[] = [];
    const hosts = new Set<string>();
    for (const a of artifacts) {
      const r = scanForKeys(a.where, a.html);
      for (const h of r.remoteHosts) hosts.add(h);
      if (r.hits.length) bad.push(r);
    }
    show("documents scanned", artifacts.length);
    show("key-shaped tokens found", bad.length ? bad.map((b) => `${b.where}: ${b.hits.join("; ")}`) : 0);
    show("every remote host referenced", Array.from(hosts).sort());
    assert.deepEqual(bad, [], `key-shaped tokens in a document we email to strangers: ${bad.map((b) => `${b.where} → ${b.hits.join("; ")}`).join(" | ")}`);
    const unexpected = Array.from(hosts).filter((h) => !ALLOWED_REMOTE_HOSTS.some((a) => h === a || h.endsWith(`.${a}`)));
    assert.deepEqual(
      unexpected,
      [],
      `these documents reach out to hosts that are not on the allowlist: ${unexpected.join(", ")}. A remote URL in an ` +
        "emailed file is a request somebody else's server sees — and it is how a signed screenshot URL carried our key out."
    );
  });

  check("E2 · RUNTIME — and the same holds for documents re-rendered here, not just the committed copies", () => {
    // A committed file can be stale. This renders the same documents from the same
    // packs through the shipped renderers, so a key that a renderer would emit today
    // cannot hide behind an artifact written last week. (The three fixture cold
    // audits used to be re-rendered beside these; the renderer and the fixtures are
    // deleted, so the paid deliverables are the whole re-renderable surface.)
    const fresh: { where: string; html: string }[] = [];
    const goldenPath = "_fixtures/golden-pack.json";
    if (existsSync(resolve(REPO, goldenPath))) {
      const pack = JSON.parse(read(goldenPath)) as AssetPack;
      for (const id of ["d1", "d2", "d3", "d4"] as const)
        fresh.push({ where: `golden ${id} (re-rendered)`, html: renderDeliverableHtml(pack, id) });
    }
    for (const d of fixtureClientDirs()) {
      const pack = JSON.parse(read(`_fixtures/clients/${d}/pack.json`)) as AssetPack;
      fresh.push({ where: `${d} d1 (re-rendered)`, html: renderDeliverableHtml(pack, "d1") });
    }
    assert(fresh.length >= 5, `only ${fresh.length} documents re-rendered — this check is not covering the deliverables`);
    const bad: string[] = [];
    for (const f of fresh) {
      const r = scanForKeys(f.where, f.html);
      show(`${f.where}`, r.hits.length ? `KEY-SHAPED: ${r.hits.join("; ")}` : `clean · ${(f.html.length / 1024).toFixed(0)}kb · remote hosts ${r.remoteHosts.length}`);
      if (r.hits.length) bad.push(`${f.where}: ${r.hits.join("; ")}`);
    }
    assert.deepEqual(bad, [], `key-shaped tokens in a freshly rendered document: ${bad.join(" | ")}`);
  });

  check("E3 · COMPANION — the scan CATCHES a planted key, and the surviving guard refuses the URL that carries one", () => {
    // Two halves, and both matter. The scanner has to be able to see a key (or E1
    // and E2 are decoration), and the shipped classification of a signed vendor
    // URL as unembeddable has to hold. (The cold-audit renderer that used to
    // consume that classification is deleted; carriesScreenshotCredential in
    // src/lib/screenshotone.ts is the machine-checkable rule that survives, and
    // the scrape layer embeds our OWN bytes as data: URIs instead of vendor URLs
    // — which is why E1/E2 find no remote screenshot host anywhere.)
    const signed =
      "https://api.screenshotone.com/take?url=https%3A%2F%2Fexample.com&access_key=abc123def456&signature=3f9c1d2b7a8e4f5061728394a5b6c7d8";
    const planted = scanForKeys("planted", `<img src="${signed}">`);
    show("planted URL", signed.slice(0, 80));
    show("scanner sees", planted.hits);
    assert(planted.hits.length >= 2, "the scanner does not recognise a signed vendor URL as key-shaped, so E1/E2 prove nothing");

    show("carriesScreenshotCredential(signed)", carriesScreenshotCredential(signed));
    assert(carriesScreenshotCredential(signed), "the surviving guard no longer classifies a signed vendor URL as unembeddable");
    // Wider than the credential: ANY URL on the vendor host is refused, so a
    // parameter rename cannot quietly re-open the hole.
    const bare = "https://api.screenshotone.com/take?url=https%3A%2F%2Fexample.com";
    show("carriesScreenshotCredential(bare vendor URL)", carriesScreenshotCredential(bare));
    assert(carriesScreenshotCredential(bare), "a credential-less vendor URL is no longer refused — a parameter rename would leak the host");
    // A data: URI of our own bytes IS allowed — that is the fix, not a bypass.
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
    show("carriesScreenshotCredential(our data: URI)", carriesScreenshotCredential(dataUri));
    assert(!carriesScreenshotCredential(dataUri), "our own embedded bytes are refused — the guard would strip the picture rather than the key");
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * F · THE ZERO-FINDINGS CASE STAYS HONEST AT THE SELECTION
   *
   * WHAT DIED HERE (2026-08-01). F2/F3 rendered the zero-finding and one-finding
   * cold-audit DOCUMENTS and F5 tracked the clean-checks-on-the-page gap; the
   * document and its renderer are deleted, so those checks died with it. What
   * remains is the half that protects the SURVIVING layer: a well-run business
   * must still produce zero hard findings and a non-empty, checkable list of
   * clean checks (F1) — the paid report prints those — and the most-provable
   * selection must never pad itself with industry patterns (F4).
   * ────────────────────────────────────────────────────────────────────── */
  section("F · ZERO HARD FINDINGS on a well-run business — and the selection never pads");

  /** The plumber's site with every capture path present and the numbers good: a
   *  booking link, a chat widget, full hours, a fast page. One fixture, one signal
   *  changed at a time, so the difference between "clean" and "leaking" is visible. */
  const CLEAN_SITE: SiteFixture = {
    ...PLUMB_SITE,
    key: "clean",
    label: "Cedar Ridge Plumbing, well-run variant (zero hard findings)",
    shape: "the same site with every capture path in place — a Calendly booking link, a chat widget, full hours, a fast page",
    homeHtml: PLUMB_HOME_HTML.replace(
      "</footer>",
      '</footer>\n<a class="btn" href="https://calendly.com/cedar-ridge/service-call">Book a service call</a>\n<script src="https://embed.tawk.to/widget.js" async></script>'
    ),
    homeMarkdown: `${PLUMB_HOME_MARKDOWN}\n\n[Book a service call](https://calendly.com/cedar-ridge/service-call)`,
    gbp: { limitedHours: false, hasBookingLink: true, hasHours: true },
    psi: { mobileScore: 93, mobileLcp: 1.6, cls: 0 },
    competitors: [
      { name: "Thompson Valley Mechanical", rating: 4.7, reviewCount: 60 },
      { name: "Riverbend Plumbing", rating: 4.5, reviewCount: 55 },
    ],
  };
  const cleanRun = runSite(CLEAN_SITE);

  check("F1 · RUNTIME — a well-run site produces ZERO hard findings and a non-empty list of clean checks", () => {
    show("site", CLEAN_SITE.label);
    show("fired leaks", cleanRun.fired.map((f) => `${f.leak.id} [${f.tier}]`));
    show("numbered cold-audit findings", cleanRun.coldAudit.map((f) => f.leak.id));
    assert.deepEqual(
      cleanRun.coldAudit.map((f) => f.leak.id),
      [],
      "the well-run fixture still produces numbered findings, so the zero case below is not the zero case"
    );
    show("clean checks, BY NAME", cleanRun.clean.map((c) => c.id));
    for (const c of cleanRun.clean) line(`       ${c.id.padEnd(18)} ${c.statement}`);
    assert(cleanRun.clean.length >= 4, `only ${cleanRun.clean.length} clean checks — a document with no findings and nothing to report is not a document`);
    for (const id of ["site_speed", "layout_stability", "online_booking", "click_to_call", "webchat"]) {
      assert(cleanRun.clean.some((c) => c.id === id), `the clean list does not name "${id}", which this fixture explicitly has`);
    }
    // Every clean statement is a measurement or a positive fingerprint — never an
    // absence, and never a judgment. So each one has to be checkable by the reader.
    for (const c of cleanRun.clean) {
      const claims = siteFactClaims(c.statement);
      const unmeasurable = claims.filter((cl) => ["cta_position", "prominence", "cta_quality"].includes(cl.topic));
      assert.deepEqual(unmeasurable, [], `clean check "${c.id}" makes an unmeasurable claim: "${c.statement}"`);
    }
  });

  // F2 · F3 — DELETED 2026-08-01. They rendered the zero-finding and one-finding
  // cold-audit documents and asserted the frame, the pivot, the CTA and the
  // grade labels on the page. The document and its renderer are deleted; the
  // honesty they proved at the page now stops at the selection (F1, F4) and at
  // the paid pack's own validator.

  check("F4 · RUNTIME — NO industry pattern is ever a numbered finding, even when patterns are all there is", () => {
    // The padding rule, at the selector rather than on the page. A thin scan fires
    // plenty of BENCHMARK leaks and nothing else; selectColdAudit must return NONE of
    // them rather than topping the list up to three.
    const thin = "<html><head><title>Thin</title></head><body><p>Coming soon.</p><script></script></body></html>";
    const thinScrape: FirecrawlScrape = { used: true, homepage: page("https://thin.example/", "Thin", "Coming soon.", thin), subpages: [] };
    const thinIntel = buildAuditIntelligence({
      websiteHtml: thin,
      hasWebsiteUrl: true,
      reviews: [],
      competitors: [],
      self: { rating: 4.4, reviewCount: 12 },
      verifiedFacts: null,
      performance: null,
      dataForSeo: null,
      screenshots: null,
    });
    const thinRun = detectLeaks({
      mode: "pre_sale",
      business: { name: "Thin Signals Ltd", industry: "plumbing", city: "Nowhere", website: "https://thin.example" },
      intel: thinIntel,
      scrape: thinScrape,
      asOf: RESEARCH_AS_OF,
    });
    const benchmarks = thinRun.fired.filter((f) => f.tier === "BENCHMARK");
    show("fired on a thin scan", thinRun.fired.map((f) => `${f.leak.id} [${f.tier}/${f.grade}]`));
    show("BENCHMARK (industry-pattern) fires", benchmarks.map((f) => f.leak.id));
    show("numbered cold-audit findings", thinRun.coldAudit.map((f) => `${f.leak.id} [${f.tier}]`));
    assert(benchmarks.length >= 2, `only ${benchmarks.length} benchmark fires on a thin scan — this check needs patterns to exclude`);
    for (const f of thinRun.coldAudit) {
      assert.notEqual(f.tier, "BENCHMARK", `"${f.leak.id}" fired as an industry pattern and became a numbered finding`);
    }
    assert(thinRun.coldAudit.length <= 3, `${thinRun.coldAudit.length} numbered findings — three is the cap`);
    // And it never throws or empties: the document degrades, it does not fail.
    assert(Array.isArray(thinRun.coldAudit), "selectColdAudit returned something other than a list on a thin scan");
    show("selection on a thin scan", thinRun.coldAudit.length === 0 ? "ZERO findings — the document becomes the clean-checks + pivot document" : `${thinRun.coldAudit.length} findings`);
  });

  // F5 (and the CLEAN_CHECKS_NOT_RENDERED record) — DELETED 2026-08-01. The
  // bounded gap it tracked — cleanChecks generated but never reaching the
  // rendered cold audit — closed the hard way: the document it never reached is
  // gone. The clean checks themselves survive in the detection layer (F1 pins
  // them by name) and the paid report is where they print.

  /* ──────────────────────────────────────────────────────────────────────────
   * G · ORDERING
   * ────────────────────────────────────────────────────────────────────── */
  section("G · ORDERING — hard measurements first, and a higher-scoring guess does not jump one");

  check("G1 · RUNTIME — the selector orders by EVIDENCE STRENGTH before score, on a case where the two DISAGREE", () => {
    // NON-VACUITY IS THE WHOLE CHECK. If every measurement also outscored every
    // inference, "strongest first" and "highest score first" would produce the same
    // list and nothing would be proved. The law-firm fixture is built so they
    // disagree, and the disagreement is REAL rather than staged: two of its reviews
    // mention calls that were never returned, which lifts missed_calls_no_recovery to
    // EVIDENCED at impactWeight 10 × 0.9 × the 1.2 law boost = 10.8 — the highest
    // score anywhere in that detection, above every OBSERVED fire on the same site.
    const law = runs.find((r) => r.site.key === "law")!;
    const evidenced = law.fired.filter((f) => f.tier === "EVIDENCED").sort((a, b) => b.score - a.score);
    const observed = law.fired.filter((f) => f.tier === "OBSERVED").sort((a, b) => b.score - a.score);
    show("law · OBSERVED fires ", observed.map((f) => `${f.leak.id} score ${f.score}`));
    show("law · EVIDENCED fires", evidenced.map((f) => `${f.leak.id} score ${f.score}`));
    assert(evidenced.length, "the law fixture produced no EVIDENCED fire — its review text no longer matches REVIEW_SIGNALS, so the disagreement case is gone");
    assert(observed.length, "the law fixture produced no OBSERVED fire — ordering cannot be tested");

    const topEvidenced = evidenced[0];
    const topObserved = observed[0];
    show(
      "the disagreement",
      `${topEvidenced.leak.id} [EVIDENCED] scores ${topEvidenced.score}, ${topObserved.leak.id} [OBSERVED] scores ${topObserved.score}`
    );
    assert(
      topEvidenced.score > topObserved.score,
      `the highest-scoring EVIDENCED fire (${topEvidenced.score}) does not outscore the highest OBSERVED one ` +
        `(${topObserved.score}), so score-order and strength-order agree here and this check proves nothing. ` +
        "Adjust the fixture until they disagree."
    );
    // Both are cold-audit eligible, so nothing but the ordering rule keeps the
    // higher-scoring inference out of slot 01.
    assert(
      topEvidenced.leak.deliverableTargets.includes("cold_audit"),
      `${topEvidenced.leak.id} is not cold-audit eligible, so its exclusion below proves nothing about ordering`
    );

    const ordered = selectColdAudit(law.fired);
    show("selectColdAudit output", ordered.map((f, i) => `${String(i + 1).padStart(2, "0")} ${f.leak.id} [${f.tier}] score ${f.score}`));
    assert.equal(
      ordered[0].tier,
      "OBSERVED",
      `finding 01 is a ${ordered[0].tier} fire while an OBSERVED one was available. Finding 01 has to be the strongest ` +
        "thing we have, not the highest-scoring guess — ranking by score alone is what put two industry patterns above a real measurement."
    );
    // Every measurement precedes every inference, not just the first one.
    const tiers = ordered.map((f) => f.tier);
    const firstEvidenced = tiers.indexOf("EVIDENCED");
    const lastObserved = tiers.lastIndexOf("OBSERVED");
    assert(
      firstEvidenced === -1 || lastObserved === -1 || firstEvidenced > lastObserved,
      `an EVIDENCED finding is ordered above an OBSERVED one: ${tiers.join(", ")}`
    );
    // The complement: raw score order WOULD have led with the inference. Printed so
    // the reader can see what the old rule produced against the same data.
    const byScore = [...law.fired]
      .filter((f) => f.leak.deliverableTargets.includes("cold_audit"))
      .filter((f) => f.tier !== "BENCHMARK")
      .sort((a, b) => b.score - a.score);
    show("what pure score order would have led with", `${byScore[0].leak.id} [${byScore[0].tier}] score ${byScore[0].score}`);
    assert.notEqual(
      byScore[0].leak.id,
      ordered[0].leak.id,
      "score order and the shipped order pick the same finding 01 here, so the fixture is not exercising the rule"
    );
    // And within one tier, score still decides.
    if (observed.length >= 2) {
      const observedOrder = ordered.filter((f) => f.tier === "OBSERVED").map((f) => f.score);
      show("scores of the OBSERVED findings, in printed order", observedOrder);
      assert.deepEqual(
        observedOrder,
        [...observedOrder].sort((a, b) => b - a),
        "within one evidence tier the findings are no longer ordered by score"
      );
    }
  });

  // G2 · G3 — DELETED 2026-08-01. G2 read the committed cold audits and proved
  // the rendered order matched the stored order; G3 demonstrated the renderer's
  // severity sort could outrank evidence strength and kept the exact edit on the
  // record. Both ran against the deleted renderer and the deleted fixtures. The
  // ordering rule itself — measurements above higher-scoring inferences — lives
  // in selectColdAudit and is proved by G1 above on data where the two orders
  // genuinely disagree.

  /* ────────────────────────────────────────────────────────────────────────── */
  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(
    "\nWHAT IS PROVED HERE AND WHAT IS NOT. Every check above runs the shipped code with no\n" +
      "network and no API key. Section A's three sites are FIXTURES reproducing the reported\n" +
      "shape, not scrapes of the real business — run `npm run probe:site -- <url>` for the live\n" +
      "half. Nothing here predicts what a language model will write; it proves that when the\n" +
      "model invents a checkable specific, the lint, the pack validator and the grade ceiling refuse it."
  );
  if (failed) process.exit(1);
}

/* ════════════════════════════════════════════════════════════════════════════
 * SHARED FIXTURE HELPERS
 * ══════════════════════════════════════════════════════════════════════════ */

/** The committed fixture-client directories, discovered rather than listed, so a
 *  fourth client is covered the day it is generated. */
function fixtureClientDirs(): string[] {
  const root = resolve(REPO, "_fixtures/clients");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((d) => statSync(resolve(root, d)).isDirectory())
    .filter((d) => existsSync(resolve(root, d, "pack.json")))
    .sort();
}

