/**
 * BUILD THE COMMITTED GOLDEN SAMPLE — _fixtures/golden-pack.json.
 *
 *   npm run sample:golden
 *
 * WHY THIS EXISTS.
 * The verification suite used to run against _samples/pack.json, which is (a)
 * gitignored and (b) a REAL client's scraped data. That meant `verify:all` only
 * actually verified anything on one laptop, and the one artifact that proved the
 * deliverable laws hold could never be committed without shipping a real
 * business's name, domain, phone and review history into the repo. So the laws
 * were enforced by habit rather than by the suite.
 *
 * This script builds a substitute that IS committable: a business that does not
 * exist, at a reserved .example domain, with invented reviews and competitors.
 * Nothing here traces to anybody.
 *
 * WHY IT IS GENERATED AND NOT HAND-WRITTEN JSON.
 * A frozen 80KB blob drifts away from the code it is supposed to prove. So the
 * deterministic half of the real pipeline actually RUNS here: a synthetic site,
 * reviews, competitors and Google profile go through the same
 * buildAuditIntelligence → detectLeaks → buildLeakInputs → stampLeakAnalysis path
 * a paying client's pack goes through. Which leaks fire, at what evidence tier,
 * with what dollar math, in what rank order and with which kickoff lines is
 * decided by src/lib, not by this file. Only the slots a language model would
 * normally author are hand-written below — and those are written to satisfy the
 * validator, which is the entire point of the exercise.
 *
 * WHAT THE SAMPLE DELIBERATELY EXERCISES.
 *   · all three evidence tiers (OBSERVED, EVIDENCED, BENCHMARK)
 *   · both BENCHMARK branches: hedged (carries the kickoff-verification line) and
 *     the intake-confirmed OBSERVED/EVIDENCED findings that state a gap as fact
 *   · two CLEAN axes — Show-Rate Protection and Reputation & Social Proof — where
 *     nothing fired and the report says so plainly instead of inventing a problem
 *   · the after-hours overlap disclosure (its figure is a slice of the
 *     missed-call figure, never added on top of it)
 *   · REAL-mode dollar math off client-supplied intake numbers, capped at the
 *     two dollar-bearing math frames a document is allowed
 *
 * WHAT PHASE 3 CHANGED IN HERE, AND WHY EACH ONE MATTERS.
 * Four blocks stopped being authored in this file and started being DERIVED from
 * the same code generation runs. Each was a place the fixture had quietly written
 * its own version of something the software owns, so the suite was proving laws
 * against a pack shape no client would ever receive:
 *   · the CRM pipeline    ← PIPELINE (workflow-catalogue.ts). The old six columns
 *                           were invented here and disagreed with the build.
 *   · the roadmap windows ← stampRoadmapWindows(). The old three phases were
 *                           Setup / Stabilize / Ongoing Optimization, which is not
 *                           the engagement, and put LeadGate inside the one-time
 *                           build.
 *   · the nurture days    ← NURTURE_SEQUENCE. The old schedule stopped on day 45,
 *                           fifteen days before the workflow closes the deal out.
 *   · the D3 destinations ← stampSurfaceDestinations(). `landing` is gone with the
 *                           10th generation call; `surfaces` replaced it, and the
 *                           four standing rules are stamped constants now rather
 *                           than four sentences typed into this file.
 *   · the workflow copy   ← workflowsNeedingCopy() + stampWorkflowCopy(). The
 *                           fixture carried NO workflow copy at all, so the one
 *                           part of the pack the "generated ⇒ rendered" invariant
 *                           could not see was the part that had just broken. See
 *                           the long note above the block itself.
 * scripts/verify-phase3.ts asserts every one of those against this fixture.
 *
 * DETERMINISM IS A HARD REQUIREMENT. Re-running this must reproduce
 * _fixtures/golden-pack.json byte for byte, otherwise every regeneration shows up
 * as a diff and nobody reviews it. So: no Date.now(), no Math.random(); the
 * research-as-of clock and the generatedAt stamp are the literal constants below.
 *
 * The script fails loudly (exit 1) if the pack it just built does not pass
 * assertPackValid AND the rendered-HTML checks — a fixture that does not pass is
 * worse than no fixture, because the suite would go green on a lie.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
// The stampers are imported, never re-implemented. Every one of them is exported
// from asset-generation.ts for exactly this reason: the fixture has to be built
// by the SAME code that builds a paying client's pack, or the suite is checking a
// hand-written imitation of the product instead of the product.
import {
  NURTURE_SEQUENCE,
  nurtureMeta,
  stampLeakAnalysis,
  stampSurfaceDestinations,
  stampWorkflowCopy,
  workflowCoverage,
  workflowsNeedingCopy,
  type GenerationContext,
} from "@/lib/asset-generation";
import { PIPELINE, type PipelineStage } from "@/lib/workflow-catalogue";
import { resolveWorkflows } from "@/lib/workflow-toggles";
import { detectLeaks, SCORECARD_AREAS, SCORECARD_DISPLAY_NAMES } from "@/lib/leak-detection";
import {
  allowedNumbersFor,
  buildLeakInputs,
  cad,
  leakInputsToPromptBlock,
  type LeakInput,
} from "@/lib/leak-narrative";
import { assertPackValid, formatValidation } from "@/lib/exporters/validate-pack";
import { validateRenderedDeliverables } from "@/lib/exporters";
import { validatePack } from "@/lib/exporters/validate-pack";
import type { DataForSeoBundle } from "@/lib/dataforseo";
import type { FirecrawlPage, FirecrawlScrape } from "@/lib/firecrawl";
import type { PsiBundle } from "@/lib/pagespeed";
import type { ScrapeData } from "@/lib/leak-taxonomy";
import type {
  AssetPack,
  Difficulty,
  GrowthIntelligence,
  LeakAnalysisItem,
  Priority,
  ScorecardMetric,
  WorkflowCopyAsset,
  WorkflowMessage,
} from "@/types";

// ── The two pinned clocks ────────────────────────────────────────────────────
// RESEARCH_AS_OF freezes every date-window computation (the 90-day review
// recency count); GENERATED_AT is what the deliverable covers print. Both are
// literals so the output file never changes just because time passed.
const RESEARCH_AS_OF = "2026-06-30T12:00:00.000Z";
const GENERATED_AT = "2026-07-26T12:00:00.000Z";

const OUT_PATH = resolve(process.cwd(), "_fixtures/golden-pack.json");

/* ════════════════════════════════════════════════════════════════════════════
 * 1 · THE SYNTHETIC BUSINESS
 * Everything below is invented. The domain is on the RFC 2606 reserved
 * .example TLD so it can never resolve to a real company, and the phone sits in
 * the 555-01xx fictional block.
 * ══════════════════════════════════════════════════════════════════════════ */

const BIZ = {
  name: "Northvale Heating & Air",
  industry: "HVAC",
  city: "Kelowna",
  phone: "250-555-0164",
  website: "https://northvaleheating.example",
  rating: 4.4,
  reviewCount: 61,
} as const;

// The synthetic homepage. Written so the real detectors read it the way a
// typical trade site reads: a contact form that asks nothing useful, a clickable
// phone number, a plain "Request a quote" call to action, no scheduler, no chat
// widget. Every one of those is a signal src/lib/leak-detection.ts fingerprints.
const HOME_HTML = `<!doctype html><html lang="en"><head>
<title>Northvale Heating &amp; Air — Furnace, Heat Pump and AC Service in Kelowna</title>
<meta name="description" content="Family-run heating and cooling contractor serving Kelowna and the Central Okanagan since 2009.">
</head><body>
<header><a class="logo" href="/">Northvale Heating &amp; Air</a>
<nav><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a>
<a class="btn" href="tel:+12505550164">250-555-0164</a></nav></header>
<section class="hero"><h1>Heating and cooling that keeps working through an Okanagan winter</h1>
<p>Furnace repair, heat pump installs and air conditioning service across Kelowna, West Kelowna and Lake Country. Licensed, insured, and doing this since 2009.</p>
<a class="btn primary" href="/contact">Request a quote</a>
<a class="btn ghost" href="tel:+12505550164">Call 250-555-0164</a></section>
<section class="services"><h2>What we do</h2>
<ul><li><a href="/services">Furnace repair and replacement</a></li>
<li><a href="/services">Heat pump installation</a></li>
<li><a href="/services">Air conditioning service</a></li>
<li><a href="/services">Annual maintenance plans</a></li>
<li><a href="/services">Indoor air quality and ducting</a></li></ul></section>
<section class="proof"><h2>What our customers say</h2>
<p>Rated 4.4 stars across 61 Google reviews. Licensed, insured and certified for gas work in British Columbia.</p></section>
<section class="contact"><h2>Get in touch</h2>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form></section>
<footer><p>Northvale Heating &amp; Air, 1180 Harvey Ave, Kelowna BC</p>
<p><a href="tel:+12505550164">250-555-0164</a> &middot; <a href="mailto:office@northvaleheating.example">office@northvaleheating.example</a></p>
<p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.</p>
<p><a href="https://www.facebook.com/northvaleheatingandair">Facebook</a></p></footer>
</body></html>`;

const HOME_MARKDOWN = `# Heating and cooling that keeps working through an Okanagan winter

Furnace repair, heat pump installs and air conditioning service across Kelowna, West Kelowna and Lake Country. Licensed, insured, and doing this since 2009.

[Request a quote](/contact) · [Call 250-555-0164](tel:+12505550164)

## What we do
- Furnace repair and replacement
- Heat pump installation
- Air conditioning service
- Annual maintenance plans
- Indoor air quality and ducting

## What our customers say
Rated 4.4 stars across 61 Google reviews. Licensed, insured and certified for gas work in British Columbia.

## Get in touch
Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.
1180 Harvey Ave, Kelowna BC · office@northvaleheating.example`;

const SERVICES_HTML = `<!doctype html><html lang="en"><head><title>Services — Northvale Heating &amp; Air</title></head><body>
<h1>Heating and cooling services in Kelowna</h1>
<section><h2>Furnace repair and replacement</h2><p>Same-week diagnosis on most makes, and a written quote before any work starts. We carry common parts on the truck so a straightforward repair is usually finished the same visit.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<section><h2>Heat pump installation</h2><p>Cold-climate heat pumps sized for Okanagan winters, with the rebate paperwork handled for you.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<section><h2>Air conditioning service</h2><p>Tune-ups before the July heat and repairs during it.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<section><h2>Maintenance plans</h2><p>An annual visit that keeps the manufacturer warranty intact.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<footer><a href="tel:+12505550164">250-555-0164</a></footer></body></html>`;

const SERVICES_MARKDOWN = `# Heating and cooling services in Kelowna

## Furnace repair and replacement
Same-week diagnosis on most makes, and a written quote before any work starts.
[Request a quote](/contact)

## Heat pump installation
Cold-climate heat pumps sized for Okanagan winters.
[Request a quote](/contact)

## Air conditioning service
Tune-ups before the July heat and repairs during it.
[Request a quote](/contact)

## Maintenance plans
An annual visit that keeps the manufacturer warranty intact.
[Request a quote](/contact)`;

const CONTACT_HTML = `<!doctype html><html lang="en"><head><title>Contact — Northvale Heating &amp; Air</title></head><body>
<h1>Contact Northvale Heating &amp; Air</h1>
<p>Call <a href="tel:+12505550164">250-555-0164</a> or send the form and we will get back to you.</p>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form>
<p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends and statutory holidays.</p>
</body></html>`;

const CONTACT_MARKDOWN = `# Contact Northvale Heating & Air

Call 250-555-0164 or send the form and we will get back to you.

Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends and statutory holidays.`;

function page(
  url: string,
  title: string,
  markdown: string,
  html: string,
  links: string[]
): FirecrawlPage {
  return { url, markdown, html, rawHtml: html, title, description: "", links };
}

const SCRAPE: FirecrawlScrape = {
  used: true,
  homepage: page(
    `${BIZ.website}/`,
    "Northvale Heating & Air",
    HOME_MARKDOWN,
    HOME_HTML,
    [
      `${BIZ.website}/services`,
      `${BIZ.website}/about`,
      `${BIZ.website}/contact`,
      "https://www.facebook.com/northvaleheatingandair",
    ]
  ),
  subpages: [
    page(`${BIZ.website}/services`, "Services", SERVICES_MARKDOWN, SERVICES_HTML, []),
    page(`${BIZ.website}/contact`, "Contact", CONTACT_MARKDOWN, CONTACT_HTML, []),
  ],
};

// Invented reviews. Two of them (and only two) carry the phrases in
// REVIEW_SIGNALS.slowResponse, which is what upgrades the speed-to-lead leak from
// a benchmark hedge to EVIDENCED — the sample needs one leak at that tier.
// Nothing here matches the missed-call, follow-up or scheduling signal lists, so
// those leaks stay on their benchmark path and the report shows a real tier mix.
const REVIEWS: { rating: number; text: string; date: string }[] = [
  {
    rating: 5,
    text: "Furnace quit on the coldest night in January and they had heat back on before midnight. Professional and fair about the price.",
    date: "2026-06-18T00:00:00.000Z",
  },
  {
    rating: 5,
    text: "Booked a maintenance visit over the phone. The technician was on time and explained the whole system to me.",
    date: "2026-06-02T00:00:00.000Z",
  },
  {
    rating: 2,
    text: "I filled in the form on their site asking about a heat pump and never heard back. Ended up going with another company.",
    date: "2026-05-21T00:00:00.000Z",
  },
  {
    rating: 3,
    text: "Good work on the AC install. Only complaint is that I emailed twice about the thermostat settings and I am still waiting on a reply.",
    date: "2026-05-04T00:00:00.000Z",
  },
  {
    rating: 5,
    text: "Fair pricing on a new furnace and the crew cleaned up after themselves.",
    date: "2026-04-27T00:00:00.000Z",
  },
  {
    rating: 5,
    text: "Second time using Northvale. Honest about what needed replacing and what did not.",
    date: "2026-03-30T00:00:00.000Z",
  },
  {
    rating: 4,
    text: "Quick diagnosis of a failed capacitor and the part was on the truck. Recommend them.",
    date: "2026-02-14T00:00:00.000Z",
  },
  {
    rating: 5,
    text: "Friendly office staff and the technician wore boot covers. Small thing but I noticed.",
    date: "2026-01-22T00:00:00.000Z",
  },
];

const COMPETITORS = [
  {
    name: "Summit Ridge Climate",
    rating: 4.7,
    reviewCount: 128,
    website: "https://summitridgeclimate.example",
    category: "HVAC contractor",
    address: "Kelowna BC",
  },
  {
    name: "Okanagan Air Partners",
    rating: 4.5,
    reviewCount: 96,
    website: "https://okanaganairpartners.example",
    category: "HVAC contractor",
    address: "West Kelowna BC",
  },
  {
    name: "Cascade Comfort Heating",
    rating: 4.6,
    reviewCount: 74,
    website: "",
    category: "HVAC contractor",
    address: "Lake Country BC",
  },
];

const DFS: DataForSeoBundle = {
  available: true,
  gbp: {
    available: true,
    category: "HVAC contractor",
    hasHours: true,
    // Weekdays only on the listing — this is what lets the after-hours leak fire
    // at OBSERVED rather than as an unverified industry pattern.
    limitedHours: true,
    hasWebsite: true,
    hasPhone: true,
    hasMenuLink: false,
    hasBookingLink: false,
    hasPhotos: true,
    attributesPresent: ["Onsite services", "Language assistance"],
    attributesMissing: ["No online appointment attribute", "No messaging attribute"],
  },
  reviews: {
    available: true,
    count: BIZ.reviewCount,
    averageRating: BIZ.rating,
    positive: 6,
    neutral: 1,
    negative: 1,
    positiveThemes: ["Punctual / reliable", "Fair / transparent pricing", "Professionalism / expertise"],
    negativeThemes: ["Poor communication"],
    trustGaps: ["Two reviewers describe an enquiry that was never answered"],
    recentNegativeQuote: REVIEWS[2].text,
    recentPositiveQuote: REVIEWS[0].text,
    reviews: REVIEWS.map((r) => ({ rating: r.rating, text: r.text, date: r.date })),
  },
};

// Measured, but deliberately unremarkable: 67/3.4s is below the out-of-scope
// trigger (<50 or >4s), so the sample carries real performance numbers as
// CONTEXT without the report ever prescribing a speed fix it does not sell.
const PSI: PsiBundle = {
  available: true,
  url: BIZ.website,
  mobile: {
    strategy: "mobile",
    performanceScore: 67,
    metrics: {
      lcpSeconds: 3.4,
      cls: 0.04,
      inpMs: 210,
      fcpSeconds: 2.1,
      ttfbMs: 620,
      speedIndexSeconds: 4.2,
    },
    topOpportunities: [],
  },
  desktop: {
    strategy: "desktop",
    performanceScore: 89,
    metrics: {
      lcpSeconds: 1.6,
      cls: 0.02,
      inpMs: 90,
      fcpSeconds: 0.9,
      ttfbMs: 410,
      speedIndexSeconds: 1.8,
    },
    topOpportunities: [],
  },
};

// What the client told us. Deliberately PARTIAL: the three multiple-choice
// answers and the two volume numbers are filled in, the yes/no system questions
// are not. That split is what puts some leaks on the confirmed-fact path and
// leaves the rest hedged with a kickoff-verification line — both branches in one
// document, which is the pair the validator has separate laws for.
const INTAKE: ScrapeData["intake"] = {
  avgJobValueCad: 1450,
  monthlyEnquiries: 90,
  responseSpeed: "FEW_HOURS",
  afterHoursHandling: "NOTHING",
  bookingMethod: "PHONE_EMAIL_ONLY",
  missedCallHandling: "UNKNOWN",
};

/* ════════════════════════════════════════════════════════════════════════════
 * 2 · RUN THE REAL PIPELINE
 * ══════════════════════════════════════════════════════════════════════════ */

const facts = buildBusinessFacts({
  scrape: SCRAPE,
  fallbackText: "",
  places: {
    name: BIZ.name,
    phone: BIZ.phone,
    address: "1180 Harvey Ave, Kelowna BC",
    website: BIZ.website,
  },
  ownerName: null,
});

const intel = buildAuditIntelligence({
  websiteHtml: HOME_HTML,
  hasWebsiteUrl: true,
  reviews: [],
  competitors: COMPETITORS,
  self: { rating: BIZ.rating, reviewCount: BIZ.reviewCount },
  verifiedFacts: facts,
  performance: PSI,
  dataForSeo: DFS,
  screenshots: null,
});

const detected = detectLeaks({
  business: {
    name: BIZ.name,
    industry: BIZ.industry,
    category: BIZ.industry,
    city: BIZ.city,
    phone: BIZ.phone,
    website: BIZ.website,
    rating: BIZ.rating,
    reviewCount: BIZ.reviewCount,
  },
  intel,
  scrape: SCRAPE,
  intake: INTAKE,
  asOf: RESEARCH_AS_OF,
});

const leakInputs = buildLeakInputs(detected.report, detected.data);
const allowedNumbers = allowedNumbersFor(detected.report, detected.data);
const byId = new Map(leakInputs.map((li) => [li.id, li]));

/** The deterministic dollar range for a leak, already CAD-marked. Used so the
 *  hand-written executive summary quotes the SAME figure the math layer computed
 *  instead of a number typed in here that could silently drift away from it. */
function range(leakId: string): string {
  const d = byId.get(leakId)?.dollar;
  if (!d) throw new Error(`golden sample expects a dollar estimate on "${leakId}"`);
  return d.low === d.high ? cad(d.low) : `${cad(d.low)}–${cad(d.high)}`;
}


/* ════════════════════════════════════════════════════════════════════════════
 * 3 · THE HAND-WRITTEN HALF
 * These are the slots a language model authors in production. Nothing here
 * invents a leak, a tier, a statistic or a dollar figure — those all arrive
 * stamped from the pipeline above. What is written here is the PROSE, and it is
 * written to the same rules the validator enforces: no lead-gen language, no
 * hype vocabulary, no shouted promises, no unlabelled assumption behind a
 * number, and no flat operational assertion about anything a cold scan could
 * not actually see.
 * ══════════════════════════════════════════════════════════════════════════ */

interface LeakProse {
  evidence: string;
  explanation: string;
  businessImpact: string;
  recommendedFix: string;
  difficulty: Difficulty;
  priority: Priority;
}

// Keyed by TAXONOMY LEAK ID, not by name, so a wording change in the taxonomy
// does not silently orphan a block of prose. Every fired in-scope leak must have
// an entry here — the assertion below the map enforces that, because a missing
// one would render as an empty "Recommended fix" in a client document.
//
// A note on voice for the BENCHMARK entries: those leaks were never observed on
// this business, so every sentence about the internal behaviour carries a hedge
// ("most", "typically", "if that holds") or names its own provenance. That is
// not padding — it is the difference between a defensible inference and a claim
// we cannot back up in front of the owner.
const LEAK_PROSE: Record<string, LeakProse> = {
  no_after_hours_coverage: {
    evidence:
      "Your Google listing shows evenings and weekends closed, and the scan found neither an online booking path nor a chat window anywhere on the site to catch demand outside those hours. You told us at intake that an after-hours enquiry gets nothing back until someone happens to check.",
    explanation:
      "Furnaces and air conditioners do not fail during office hours. They fail on a Friday night and on a long weekend, and that is exactly when the listing says you are shut and the site offers no way to leave a job in the queue. The homeowner is awake, uncomfortable and working down a list of three companies, and the one that answers is the one that gets the work.",
    businessImpact:
      "The hours when urgency is highest are the hours with no capture at all. Those enquiries do not politely wait until Monday morning; they go to whoever responded first.",
    recommendedFix:
      "We deploy an after-hours auto-response on both the phone line and the form, plus a booking link that stays open around the clock, so an enquiry at 11pm is acknowledged, qualified and holding a slot before your first coffee.",
    difficulty: "low",
    priority: "critical",
  },

  slow_speed_to_lead: {
    evidence:
      "Two of your recent Google reviews describe an enquiry that went nowhere: one customer filled in the site form about a heat pump and never heard back, another is still waiting on a reply about thermostat settings. You told us at intake that a new enquiry typically waits a few hours for a reply.",
    explanation:
      "The form is the one route into this business that does not require picking up a phone, and there is nothing automated behind it. Whoever is free reads it when they come off a job, which means reply time is set by that day's schedule rather than by the enquiry itself. In a trade where the homeowner is usually contacting three companies at once, the reply that lands first is the one that gets the appointment.",
    businessImpact:
      "A few hours is long enough for someone with no heat to have already booked a competitor. That enquiry was not lost on price or on reputation, it was lost on answering speed.",
    recommendedFix:
      "We put an instant auto-reply behind every form submission and route the enquiry into LeadGate for qualification inside the first minute, so whoever is on the phones receives a scored, ready-to-call lead instead of a raw message.",
    difficulty: "low",
    priority: "critical",
  },

  missed_calls_no_recovery: {
    evidence:
      "Your published number is a single line with no text-back path visible anywhere on the site, so what happens to a call nobody picks up is not something a scan can see from outside. Most owner-run heating companies let it fall through to voicemail while the crew is in a crawlspace or on a roof.",
    explanation:
      "A call that rings out is not a lost customer yet. It becomes one at the moment that homeowner dials the next company on their list, which is typically within a few minutes. Nothing on the site offers a text as a lighter alternative, so a caller who cannot get through has no second route back to you.",
    businessImpact:
      "Where this pattern holds, every call that rings out is demand you have already paid for arriving and leaving without a record. Because nothing logs it, the size of the problem stays invisible until it is measured.",
    recommendedFix:
      "We put a missed-call text-back on the line so a caller who does not reach a person receives a message within seconds, and route their reply into the same qualification flow as a form fill.",
    difficulty: "low",
    priority: "critical",
  },

  no_online_booking: {
    evidence:
      "There is no booking link on the site or on your Google Business Profile, and you confirmed at intake that jobs are booked by phone and email only.",
    explanation:
      "Every booking currently costs a phone conversation, which means it can only happen while somebody is free to have one. A homeowner who decides at 10pm to lock in a Saturday maintenance visit has to remember to call you tomorrow, and remembering is where a lot of that intent quietly dies.",
    businessImpact:
      "Booking capacity is capped by the hours someone can spend on the phone rather than by the number of trucks you can put on the road.",
    recommendedFix:
      "We build the booking page inside your GoHighLevel sub-account, wire it to real technician availability, and put it behind every call-to-action on the site so a visitor can take a slot without speaking to anyone.",
    difficulty: "medium",
    priority: "high",
  },

  no_lead_qualification: {
    evidence:
      "The contact form collects a name, an email, a phone number and a free-text message. Nothing on it establishes what the job is, where it is, or how urgent it has become.",
    explanation:
      "Every enquiry therefore arrives looking identical, so whoever reads the inbox has to phone each one back just to find out which is a furnace replacement and which is a filter question. That triage happens at whatever speed the day allows, and the replacement quote waits in line behind the filter question.",
    businessImpact:
      "The most valuable enquiry in the inbox gets exactly the same treatment as the least valuable one, which means your biggest jobs routinely wait the longest.",
    recommendedFix:
      "We rebuild the form around LeadGate so each enquiry is scored on job type, urgency and service area as it arrives, and a priority job pages the on-call technician instead of joining a queue.",
    difficulty: "low",
    priority: "high",
  },

  no_follow_up_sequence: {
    evidence:
      "What happens to a quote that goes quiet is not visible from outside, and we did not see it here. Most local trades stop after one or two attempts, which is the industry pattern being flagged rather than a finding about your business.",
    explanation:
      "A homeowner who asks for a furnace quote in October is often not ready to spend until the first hard frost. If nothing reaches them between those two moments, the decision gets made without you in the room. Where that pattern holds, the quote is not lost on price, it is lost on silence.",
    businessImpact:
      "Quotes that went quiet are the cheapest pipeline you own, because the enquiry was already earned once. If that is how it works today, most of that pipeline is expiring untouched.",
    recommendedFix:
      "We deploy a multi-touch follow-up sequence across email and SMS on every unbooked quote, spaced across the weeks a heating decision actually takes, with a longer branch for the ones who said not yet.",
    difficulty: "medium",
    priority: "critical",
  },

  no_database_reactivation: {
    evidence:
      "Sixty-one Google reviews point to years of completed jobs, so a list of past customers almost certainly exists somewhere. Whether anything is ever sent to it is not visible from outside.",
    explanation:
      "A heating customer buys again on a schedule: a maintenance visit most years, a replacement every twelve to fifteen. The households already on that list are the warmest demand in the Okanagan and the only demand you never have to compete for. Most local trades never write to them at all.",
    businessImpact:
      "A dormant list is revenue that has already chosen you once. If nothing reaches it seasonally, that demand simply goes to whichever company reaches them first.",
    recommendedFix:
      "We load the past-customer list into the pipeline and run a seasonal reactivation sequence ahead of each heating and cooling season, sent from your number so it reads as a reminder from their own technician.",
    difficulty: "low",
    priority: "high",
  },

  no_webchat: {
    evidence:
      "No chat or messaging widget was detected on any of the scanned pages.",
    explanation:
      "A visitor with one small question has two options today: telephone you, or fill in a form and wait. Both are heavier than the question deserves, and the lighter the question, the more likely that visitor is to close the tab instead of asking it.",
    businessImpact:
      "The visitors you never hear from are the cheapest ones to convert, because they are already on the page and already interested.",
    recommendedFix:
      "We install a webchat widget that hands the conversation straight to SMS, so a question asked on the site continues in the visitor's text messages and lands in the same pipeline as a phone call.",
    difficulty: "low",
    priority: "medium",
  },

  no_crm_pipeline: {
    evidence:
      "Whether enquiries are tracked in a pipeline is not something a scan can establish. In most owner-run trades they live across an inbox, a notebook and somebody's memory, which is an industry pattern rather than something we observed here.",
    explanation:
      "Without a shared record, an enquiry only really exists in the head of whoever took it. The callback promised on Tuesday then competes with Wednesday's emergency, and the one that loses is the one nobody can see.",
    businessImpact:
      "You cannot manage a number you cannot see. Where enquiries are held informally, the loss shows up as a quiet flat month rather than as anything anyone can point at.",
    recommendedFix:
      "We build the pipeline inside your GoHighLevel sub-account using the stages your business actually runs, so every enquiry has one home, one owner and one next action.",
    difficulty: "medium",
    priority: "high",
  },

  social_dm_unmanaged: {
    evidence:
      "The site links out to a Facebook page. How messages sent there get answered is not something we can see from the outside.",
    explanation:
      "A message on a social page usually lands in an app on one person's phone, separate from the phone line and separate from the inbox. Where that is the case, it typically gets answered when that person next opens the app rather than when the customer sent it.",
    businessImpact:
      "A channel nobody owns is a channel with no response time attached. Where enquiries arrive there, they are landing in a queue with no service level behind it.",
    recommendedFix:
      "We connect the Facebook page inbox into the same conversation view as calls, texts and form fills, so a direct message is answered on the same clock as everything else.",
    difficulty: "low",
    priority: "medium",
  },

  payment_booking_friction: {
    evidence:
      "We did not scan for a payment or deposit mechanism, and none of this is visible from outside. Deposit-taking trades typically collect on site or by cheque, which is the industry pattern being flagged here.",
    explanation:
      "The distance between a customer saying yes and money actually moving is where jobs quietly slip. If a deposit depends on somebody standing in the house with a card reader, the job is not really committed until the morning it happens.",
    businessImpact:
      "An uncommitted job is an easy job to postpone. Where nothing is paid up front, a cancellation costs the customer nothing and costs you the slot.",
    recommendedFix:
      "We add a text-to-pay deposit link into the booking flow, so a slot is held by a real payment and next week's schedule stops being provisional.",
    difficulty: "medium",
    priority: "medium",
  },

  no_call_tracking: {
    evidence:
      "Whether calls are tracked is not visible from outside. Most owner-run trades keep no answered-versus-missed record at all, which is an industry pattern rather than something we observed here.",
    explanation:
      "Without a record of how many calls came in and how many reached a person, the size of the capture problem is a matter of opinion. Every other fix in this report becomes easier to sequence the moment that number exists.",
    businessImpact:
      "Where call volume is not recorded, staffing and capacity decisions get made without knowing how much demand never reached anybody.",
    recommendedFix:
      "We turn on call tracking and recording across the numbers we deploy, so answered, missed and after-hours volume arrives as a number in the monthly report instead of a guess.",
    difficulty: "low",
    priority: "medium",
  },
};

// Fail loudly rather than shipping a leak section with empty prose. A silent
// fallback here would render as a blank "Recommended fix" in a client document,
// which is exactly the class of defect the fixture exists to catch.
for (const li of leakInputs) {
  if (!LEAK_PROSE[li.id])
    throw new Error(
      `leak "${li.id}" (${li.name}) fired but has no prose in LEAK_PROSE — add it before regenerating the fixture.`
    );
}

// ── The nine conversion axes ─────────────────────────────────────────────────
// Scores are NOT written here: gradeAreas() computes them from the fired-leak
// set and they are stamped in below. Only the prose is authored.
//
// TWO OF THESE AXES ARE CLEAN. Nothing fired on Show-Rate Protection or on
// Reputation & Social Proof, so both grade 95, and a 95 that describes a problem
// is a fabricated leak. Their diagnosis, cause and evidence are written to read
// plainly positive — no "gap", no "weak", no "losing" — which is also exactly
// what the Part D validator check looks for.
interface AxisProse {
  rubric: string;
  evidence: string;
  diagnosis: string;
  whyItMatters: string;
  cause: string;
  expectedBenefit: string;
}

const AXIS_PROSE: Record<string, AxisProse> = {
  response_speed: {
    rubric:
      "Measures how long a new enquiry waits before a human or an automation replies, against the under-five-minute window where close rates hold up.",
    evidence:
      "You told us a new enquiry typically waits a few hours. Two recent reviews describe an enquiry that never got a reply at all.",
    diagnosis:
      "Reply speed is set by the day's job list rather than by the enquiry, because nothing automated sits behind the form or the phone line.",
    whyItMatters:
      "A homeowner without heat contacts several companies at once. First useful reply usually takes the job, regardless of who is cheapest.",
    cause:
      "There is no acknowledgement layer between an enquiry arriving and a person becoming free to read it.",
    expectedBenefit:
      "An instant acknowledgement on every channel puts you first in the queue on enquiries you are already receiving.",
  },
  call_capture: {
    rubric:
      "Measures how many ways a customer can reach you and what happens on each one when nobody is free, against a trade that captures calls, texts, chat and social messages into a single queue.",
    evidence:
      "One phone line with no text-back path visible on the site, no chat widget on any scanned page, and a Facebook page linked from the footer that sits outside every other channel.",
    diagnosis:
      "Capture depends entirely on somebody being free to answer at that moment, and there is no fallback on any of the three routes into the business.",
    whyItMatters:
      "Capture is the top of the whole conversion path. Everything downstream only works on enquiries that made it into the system in the first place.",
    cause:
      "Each channel was added on its own over time and none of them share a queue or a response standard.",
    expectedBenefit:
      "Calls, texts, chat and social messages landing in one place means a reply no longer depends on who happens to be holding which device.",
  },
  after_hours_coverage: {
    rubric:
      "Measures what a customer gets outside published hours, against a trade that acknowledges, qualifies and books around the clock.",
    evidence:
      "Google hours show evenings and weekends closed, with neither a booking path nor a chat window to catch demand in those hours. You told us nothing goes back to an after-hours enquiry until someone checks.",
    diagnosis:
      "The window with the highest urgency in heating and cooling has no capture behind it at all.",
    whyItMatters:
      "Equipment failures are noticed at night and at weekends, and a homeowner in that position stops shopping the moment somebody answers.",
    cause:
      "Coverage was scoped around office hours, and no automation was ever put behind the hours nobody works.",
    expectedBenefit:
      "An always-on acknowledgement plus a bookable calendar turns the quietest hours into the ones where you are the only company replying.",
  },
  online_booking: {
    rubric:
      "Measures whether a customer can commit to a time and hold it without a phone conversation, against a trade with a live calendar and a deposit path.",
    evidence:
      "No booking link on the site or on the Google Business Profile, and you confirmed jobs are taken by phone and email only. No deposit mechanism was scanned for either way.",
    diagnosis:
      "Committing to work requires a two-way conversation, which caps how much booking can happen in a day and leaves the schedule provisional until the technician arrives.",
    whyItMatters:
      "Booking friction is felt hardest by the customers who are ready to buy, which is the worst possible place to put an obstacle.",
    cause:
      "Scheduling has always run through the office, so no self-serve path was ever built alongside it.",
    expectedBenefit:
      "A live calendar with a deposit link converts intent into a held slot at the moment the customer feels it.",
  },
  lead_qualification: {
    rubric:
      "Measures how much the intake path learns about a job before a human touches it, against a form that captures job type, urgency and service area.",
    // SCRUBBED. This sentence used to end: "The homepage does carry a clear call
    // to action above the fold and a click-to-call number." Both halves of that
    // are the bug this round is about — "clear" is an editorial verdict on their
    // copy and "above the fold" is a position on a page we never render — and the
    // fabrication lint is now fatal on either, at any grade, in any deliverable
    // (leak-narrative.ts NEVER_LICENSABLE_TOPICS). What is left says what we
    // actually read: the form's own fields, and the `tel:` fingerprint, scoped to
    // the pages we scanned.
    evidence:
      "On the pages we scanned, the contact form asks for a name, an email, a phone number and a free-text message, and nothing else. The phone number is a real tap-to-call link in the HTML, so the call route works — what is missing is anything that sorts the job before somebody reads it.",
    diagnosis:
      "Enquiries arrive undifferentiated, so priority is decided by whoever reads the inbox next rather than by the value or urgency of the job.",
    whyItMatters:
      "A furnace replacement and a filter question deserve very different response times, and today they get the same one.",
    cause:
      "The form was built to be short rather than to sort, and nothing scores what comes through it.",
    expectedBenefit:
      "Scoring at the point of capture means the biggest job of the week is the first one somebody calls back.",
  },
  follow_up_nurture: {
    rubric:
      "Measures what reaches a lead that did not book immediately, and what reaches a customer who bought years ago, against a trade running structured multi-touch sequences on both.",
    evidence:
      "Neither behaviour is visible from outside. Sixty-one reviews indicate a substantial past-customer list, and most local trades stop following up after one or two attempts.",
    diagnosis:
      "Where that industry pattern holds here, the unbooked quotes and the past customers are both sitting untouched between the moment of interest and the moment of purchase.",
    whyItMatters:
      "Heating decisions are made over weeks, not minutes, and replacement cycles run over years. Both are won by whoever is still present when the customer is finally ready.",
    cause:
      "Follow-up depends on somebody remembering, and nothing automated carries it once the day gets busy.",
    expectedBenefit:
      "Sequenced follow-up and seasonal reactivation convert demand you have already paid to create, without adding a single new enquiry.",
  },
  show_rate_protection: {
    rubric:
      "Measures whether a booked appointment reliably becomes an attended one, against the reminder cadence a well-run appointment business uses.",
    evidence:
      "None of the sixty-one reviews on file describe an appointment that did not happen, and the work you described is dominated by same-week service calls where the wait between booking and arrival is short.",
    diagnosis:
      "Show-rate protection holds up. Nothing in the review record or in the scan suggests attendance is an issue for this business today.",
    whyItMatters:
      "An empty booked hour is the most expensive kind: the truck rolled, the slot was reserved and nothing was billed.",
    cause:
      "Short booking-to-arrival windows, and a customer who is usually without heating or cooling by the time they call.",
    expectedBenefit:
      "Automated reminders added during the build keep this axis where it already is once booking volume moves online and lead times lengthen.",
  },
  pipeline_tracking: {
    rubric:
      "Measures whether every enquiry has a recorded state and an owner, and whether call performance is measured at all, against a trade running a live pipeline with call reporting.",
    evidence:
      "Neither a pipeline nor call tracking is visible from outside, and most owner-run trades run without either. This is the industry pattern, not something observed on your business.",
    diagnosis:
      "Where that holds here, enquiries are held informally and there is no answered-versus-missed number to manage against.",
    whyItMatters:
      "Everything else in this report gets easier to prioritise once the volume and the drop-off points are actually visible.",
    cause:
      "The business grew on relationships and memory, which works until volume outruns the person doing the remembering.",
    expectedBenefit:
      "One pipeline plus call reporting turns the monthly conversation from impressions into numbers you can act on.",
  },
  reputation_social_proof: {
    rubric:
      "Measures Google review volume and rating against the local competitor set, since a homeowner comparing three heating companies reads the star line before anything else.",
    evidence:
      "Sixty-one Google reviews at 4.4 stars, against a local competitor median of ninety-six reviews. Your volume sits comfortably above the half-of-median line this axis measures against.",
    diagnosis:
      "Reputation holds. You rate at 4.4 with enough volume behind it to be believed, and the review text is consistently about competence, punctuality and fair pricing.",
    whyItMatters:
      "Reviews are the part of your public presence a homeowner trusts by default, and they are read immediately before somebody decides who to phone.",
    cause:
      "Consistent service quality showing up in the review text across several years of jobs.",
    expectedBenefit:
      "Holding this position as booking volume rises is mostly a matter of asking every completed job for a review on a schedule, which the build handles automatically.",
  },
};

const metrics: ScorecardMetric[] = SCORECARD_AREAS.map((area) => {
  const prose = AXIS_PROSE[area];
  if (!prose) throw new Error(`no axis prose for "${area}"`);
  return { name: SCORECARD_DISPLAY_NAMES[area], score: detected.grades[area], ...prose };
});

// One pre-stamp leak item per fired leak, in fired-rank order, titled with the
// taxonomy leak name so stampLeakAnalysis matches prose to leak one-for-one.
// Everything the model is not allowed to author (tier, stats, math frame,
// kickoff line, dollar range) is deliberately absent — stampLeakAnalysis puts it
// there from the fired taxonomy.
const authoredLeaks: LeakAnalysisItem[] = leakInputs.map((li: LeakInput) => {
  const prose = LEAK_PROSE[li.id];
  return {
    area: li.name,
    leakName: li.name,
    evidence: prose.evidence,
    explanation: prose.explanation,
    businessImpact: prose.businessImpact,
    difficulty: prose.difficulty,
    priority: prose.priority,
    recommendedFix: prose.recommendedFix,
    owner: "us",
  };
});

const MISSED_CALL_RANGE = range("missed_calls_no_recovery");
const AFTER_HOURS_RANGE = range("no_after_hours_coverage");

const intelligence: GrowthIntelligence = stampLeakAnalysis(
  {
    executiveSummary: {
      // Opens on the largest dollar-quantified finding, never on a compliment.
      // Both dollar sentences carry "estimated" in the SAME sentence as the
      // number, because the chain behind them contains assumptions we made.
      narrative: `Calls that ring out are the largest recoverable number in this report: an estimated ${MISSED_CALL_RANGE} a month, computed from the enquiry volume and average job value you gave us and the industry rates set out beside that finding. The after-hours slice of that same chain is an estimated ${AFTER_HOURS_RANGE} a month, and it is a share of the figure above rather than a second loss on top of it. Underneath both sits one pattern: every route into this business ends at a person who has to be free at that exact moment, and nothing sits behind any of them when that person is on a job. Your reputation and your show rate are not the problem here, and both hold up against the local set. What this business is missing is the layer between an enquiry arriving and somebody getting to it.`,
      biggestOpportunities: [
        "Instant acknowledgement on the phone line and the form, which is the cheapest change on this list and touches every enquiry you already receive.",
        "A bookable calendar that stays open through the evenings and weekends your listing currently shows as closed.",
        "Scoring at the point of capture, so a furnace replacement stops waiting behind a filter question.",
        "A past-customer list that has already bought from you once and is currently being contacted by nobody.",
      ],
      biggestThreats: [
        "Two published reviews already describe an enquiry that got no reply, which is the one kind of review a homeowner reads as a warning.",
        "Competitors in this market carry noticeably more review volume, which makes speed of reply the cheaper place for you to win.",
        "Peak heating demand arrives in a few short weeks each year, and capture problems cost the most in exactly those weeks.",
      ],
      mostUrgentFixes: [
        "Missed-call text-back on the main line.",
        "Instant auto-reply and qualification behind the contact form.",
        "After-hours auto-response covering evenings and weekends.",
      ],
      quickWins: [
        "Webchat that continues in SMS, so a small question does not need a phone call.",
        "The Facebook page inbox pulled into the same queue as calls and texts.",
        "Call tracking switched on, so answered-versus-missed stops being a guess.",
      ],
    },
    scorecard: {
      overallReadout:
        "This business converts well once a person is actually in the conversation. The reviews describe competent work at a fair price, the rating holds against the local set, and booked jobs get attended. Everything scoring low here sits in front of that conversation: the enquiry arriving, being acknowledged, being sorted and being followed up. That is a capture and response problem, not a reputation problem, and it is the cheaper of the two to fix.",
      metrics,
    },
    leakAnalysis: authoredLeaks,
    fastestWins: [
      {
        opportunity: "Missed-call text-back on the published line",
        impact: "Recovers the largest single dollar figure in this report, estimated beside that finding",
        difficulty: "low",
        speed: "live in under a week",
      },
      {
        opportunity: "Instant auto-reply on the contact form",
        impact: "Closes the reply delay two of your reviews already describe",
        difficulty: "low",
        speed: "live in under a week",
      },
      {
        opportunity: "After-hours auto-response on both channels",
        impact: "Covers the evenings and weekends the listing shows closed",
        difficulty: "low",
        speed: "live in under a week",
      },
      {
        opportunity: "Qualifying fields plus scoring on the form",
        impact: "Puts the highest-value job at the front of the callback queue",
        difficulty: "low",
        speed: "about a week",
      },
      {
        opportunity: "Booking page wired to technician availability",
        impact: "Turns evening intent into a held slot without a phone call",
        difficulty: "medium",
        speed: "two weeks",
      },
    ],
    strategicRecommendations: [
      "We deploy LeadGate as the qualification and routing engine in front of every channel, and we run it for you every month rather than handing you a tool to operate.",
      "We build the whole conversion path inside a GoHighLevel sub-account you own: instant response, qualification, follow-up, booking, reminders and the pipeline behind them.",
      "We treat capture as the first priority and booking as the second, because a booking page only pays for itself on enquiries that reached the system.",
      "We put a seasonal reactivation sequence on your past-customer list, which is demand you have already earned and are currently not contacting.",
      "We report monthly on answered, missed and after-hours volume, so the next round of decisions is made against numbers rather than impressions.",
    ],
  },
  leakInputs
);

/* ── Deliverable 2 · the acquisition infrastructure ───────────────────────── */
// Six conversion-path stages, exactly one of which is the ongoing retainer.
// Owners are "us" everywhere except the two steps that genuinely need a human
// with a van and a licence.

/** Who runs each pipeline column day to day, and how often it is looked at.
 *  Keyed by the CANONICAL stage name so a rename in the catalogue is a compile
 *  error here rather than a silently missing sentence in a client document. */
const CRM_STAGE_OPERATIONS: Record<PipelineStage, { ownership: string; reviewProcess: string }> = {
  "New Lead": {
    ownership: "Automation, with the office notified on priority scores.",
    reviewProcess:
      "Anything sitting here more than fifteen minutes during business hours raises an alert.",
  },
  Qualified: {
    ownership: "Office, working from the score and the answers behind it.",
    reviewProcess: "Reviewed daily; anything over two days without a quote gets chased.",
  },
  Booked: {
    ownership: "Automation for the reminders, dispatch for the scheduling.",
    reviewProcess: "Checked each morning against the day's route.",
  },
  Showed: {
    ownership: "The technician on site, with the office picking up the paperwork.",
    reviewProcess: "Reviewed at the end of each day against what was on the calendar that morning.",
  },
  Won: {
    ownership: "Office.",
    reviewProcess: "Review request fires automatically once the job is marked complete.",
  },
  Lost: {
    ownership: "Automation.",
    reviewProcess:
      "Nothing is deleted — the record stays with its history and the seasonal reactivation run picks it up again.",
  },
};
const infrastructure: AssetPack["infrastructure"] = {
  funnel: {
    overview:
      "This is the path an enquiry takes from the moment it arrives to the moment the technician is standing at the door, and the version below is the one we build for you. Every stage that can run without a person waiting on it does. The two that cannot are the ones where judgement or a licensed trade is the whole point.",
    stages: [
      {
        stage: "Capture",
        role: "Get every enquiry into one system regardless of which channel it arrived on.",
        currentWeakness:
          "Three separate routes into the business today, none of which share a queue: a phone line with no fallback, a form with nothing behind it, and a Facebook page sitting on its own.",
        whatWeDeploy:
          "One tracked number with missed-call text-back, a webchat widget that continues in SMS, the Facebook inbox connected, and the site form rewritten to feed the same queue.",
        owner: "us",
        isRetainer: false,
        kpi: "Share of inbound enquiries that reach the system with a timestamp on them.",
      },
      {
        stage: "Qualify",
        role: "Score and sort every enquiry before a human spends a minute on it. This is the stage we run for you every month.",
        currentWeakness:
          "The form collects a name, an email, a phone number and a message, so every enquiry looks identical and triage happens by phone.",
        whatWeDeploy:
          "LeadGate scoring on job type, urgency and service area at the point of capture, with routing rules that page the on-call technician for priority work and hold the rest for the office.",
        owner: "us",
        isRetainer: true,
        kpi: "Median time from enquiry to a scored, routed lead.",
      },
      {
        stage: "Speed to Lead",
        role: "Make sure the first reply is ours, on every channel, every time.",
        currentWeakness:
          "You told us a new enquiry typically waits a few hours, and two reviews describe one that waited longer than that.",
        whatWeDeploy:
          "Instant auto-reply on form and chat, missed-call text-back on the phone, and an after-hours response that covers the evenings and weekends your listing shows as closed.",
        owner: "us",
        isRetainer: false,
        kpi: "Median first-response time, measured in minutes rather than hours.",
      },
      {
        stage: "Nurture",
        role: "Stay present between the quote and the decision, and between one job and the next.",
        currentWeakness:
          "What reaches an unbooked quote is not visible from outside, and most local trades stop after one or two attempts.",
        whatWeDeploy:
          "A multi-touch email and SMS sequence on every unbooked quote, a longer branch for the not-yet leads, and a seasonal reactivation run at the past-customer list.",
        owner: "us",
        isRetainer: false,
        kpi: "Share of quoted jobs that book within ninety days.",
      },
      {
        stage: "Book",
        role: "Let a ready customer hold a real slot without needing a phone conversation.",
        currentWeakness:
          "Booking runs through phone and email only, so it can only happen while somebody in the office is free.",
        whatWeDeploy:
          "The booking page inside your GoHighLevel sub-account, wired to technician availability, with a text-to-pay deposit link that turns a held slot into a committed one.",
        owner: "us",
        isRetainer: false,
        kpi: "Share of bookings taken without a phone call.",
      },
      {
        stage: "Show-Up and Recovery",
        role: "Protect the booked slot and pick up the ones that fall over.",
        currentWeakness:
          "Nothing here is currently automated, though the review record shows attendance is not a problem for this business today.",
        whatWeDeploy:
          "Confirmation and reminder messages on every booking, a same-day text before arrival, and a two-step recovery sequence on any appointment that does not happen.",
        owner: "us",
        isRetainer: false,
        kpi: "Share of booked appointments attended.",
      },
    ],
  },
  // THE SIX COLUMNS ARE NOT AUTHORED HERE. They are read from PIPELINE in
  // src/lib/workflow-catalogue.ts — the one canonical definition of the board we
  // configure in the client's GoHighLevel sub-account — and only the operating
  // detail (who owns the column, how often it is reviewed) is written by hand.
  //
  // WHY IT CHANGED: this fixture used to name its own six columns (New Lead →
  // Contacted → Quoted → Booked → Won → Lost or Nurture). That list was invented
  // in this file and disagreed with the catalogue, so the fixture was proving a
  // pipeline the software does not build. The validator now reads the catalogue
  // too (Structure · CRM pipeline), which is what caught it.
  crmPipeline: {
    overview:
      "One pipeline, six stages, and a rule for what moves an enquiry between them. The point is that at any moment you can see how many jobs are sitting at each stage and who owes the next action, which is the thing an inbox can never tell you.",
    stages: PIPELINE.map((s) => ({
      stage: s.stage,
      entryCriteria: s.howALeadArrives,
      exitCriteria: s.howALeadLeaves,
      ownership: CRM_STAGE_OPERATIONS[s.stage].ownership,
      reviewProcess: CRM_STAGE_OPERATIONS[s.stage].reviewProcess,
    })),
    leadTiers: [
      {
        tier: "Priority Lead",
        range: "90–100",
        meaning: "No heat or no cooling, or a replacement-sized job, inside the service area.",
        action: "Page the on-call technician and call back immediately.",
        responseTime: "Under five minutes, day or night.",
        owner: "On-call technician, with the office copied.",
        followUpMethod: "Phone first, SMS as the fallback if the call is not picked up.",
      },
      {
        tier: "Qualified Lead",
        range: "70–89",
        meaning: "A real job in the service area with no immediate urgency behind it.",
        action: "Call back the same business day and put a quote in writing.",
        responseTime: "Within one hour during business hours.",
        owner: "Office.",
        followUpMethod: "Phone, then the standard quote follow-up sequence.",
      },
      {
        tier: "Nurture Lead",
        range: "40–69",
        meaning: "Interested but not ready, or planning work for a future season.",
        action: "Send the information they asked for and place them in the longer sequence.",
        responseTime: "Same day, automated.",
        owner: "Automation.",
        followUpMethod: "Email and SMS, spaced across the weeks the decision actually takes.",
      },
      {
        tier: "Low Fit Lead",
        range: "0–39",
        meaning: "Outside the service area, or asking about work you do not take on.",
        action: "Reply honestly, point them somewhere useful, and keep the record.",
        responseTime: "Same day, automated.",
        owner: "Automation.",
        followUpMethod: "A single courteous email; no sequence.",
      },
    ],
  },
};

/* ── Deliverable 4 · the timeline ─────────────────────────────────────────── */
// THE SHAPE OF THE SCHEDULE IS NOT AUTHORED HERE. Phase names, windows, the
// price on each window and the retainer flag are stamped by stampRoadmapWindows()
// — the same function generation uses — so this fixture cannot drift from the
// engagement the software actually sells. Only the parts a model would write
// (objective, actions, "done", the go-live detail) are hand-written below.
//
// WHY IT CHANGED. The old fixture wrote its own three phases: Setup / Week 1–2,
// Stabilize / Month 2, Ongoing Optimization / Ongoing, monthly. That is not the
// engagement — it is Build (Days 1–14) → Go-Live → Ongoing (Days 15–90) — and it
// put LeadGate tuning inside the one-time build, which sells the CAD $1,000/month
// engine inside the CAD $6,500 fee. Both are now fatal validator checks
// (Structure · roadmap shape, E3 · retainer is not the build), and both are what
// caught it.
//
// READ THE BUILD-PHASE ACTIONS CAREFULLY. Not one of them claims the
// qualification engine as something the fortnight delivers. The single line that
// has to mention it at all — connecting the form to it — says in the SAME
// sentence that the monthly service runs and tunes it, which is the one form the
// validator accepts.
const workflowResolutions = resolveWorkflows({
  intake: detected.data.intake ?? null,
  firedLeaks: detected.report,
});

/* ── Deliverable 3 · supporting assets ────────────────────────────────────── */
// Law 2 allows exactly one review touch: a single request after a completed job.
// No review strategy, no staff scripts, no campaign.
const supportingAssets: AssetPack["supportingAssets"] = {
  reviewAssets: {
    postJobRequest:
      "Hi [First name], thanks for having Northvale out today. If the work was up to standard, a short Google review helps other Kelowna homeowners work out who to call when their furnace quits. Here is the link: [Google review link]. If anything was not right, reply to this message and we will sort it out first.",
  },
  thankYouAssets: {
    thankYouPageCopy:
      "Thanks — that is booked. You will get a confirmation text within a minute with your time slot and the name of the technician coming out. If you need to move it, reply to that text and we will find another slot.",
    nextStepMessaging:
      "Two things happen next. You will get a reminder the day before, and another on the morning of the visit once the technician is on the way. Nothing else is needed from you.",
    postPurchaseSequence: [
      "Immediately: confirmation text with the slot, the technician's name and a reply-to-reschedule line.",
      "Day before: reminder with the arrival window and a note about clearing access to the equipment.",
      "Morning of: a text when the technician leaves the previous job, with a live arrival estimate.",
      "Same evening: a short thank-you and the review request, once the job is marked complete.",
      "Eleven months later: a maintenance reminder timed to the season the equipment was last serviced.",
    ],
  },
};

/* ── Deliverable 3 · the conversion surfaces ──────────────────────────────── */
// THIS REPLACED THE LANDING MODULE. The fixture used to carry a `landing` block:
// a nine-section landing-page specification, a page order, a CTA inventory, four
// "implementation notes" and a tech stack. ReclaimedHQ does not build, host,
// redesign or deploy websites — the ONE page we build is the booking page inside
// the client's GoHighLevel sub-account — so that block was copy for a surface the
// offer does not contain. The 10th generation call that wrote it is gone.
//
// NOTHING VANISHED. Every REPOINT row in docs/landing-call-inventory.md has a
// live destination below, and scripts/verify-phase3.ts checks that mechanically
// rather than by eye:
//   headlines / subheads / buttons / reassurance / proof / page order / FAQ
//                                                → bookingPage
//   the form's words, and everything after the submit, including the emergency
//   route out of the automation                  → leadCaptureForm
//   the words wrapped around the qualifying questions
//                                                → leadGate
//   the launcher, greeting, details ask and away-message
//                                                → webchat
//   the diagnosis of their OWN site, and the four standing rules verbatim
//                                                → siteAdvisory
//
// THE `where`, `honestyNote`, `scopeNote` AND `standingRules` FIELDS ARE LEFT
// EMPTY ON PURPOSE. stampSurfaceDestinations() fills all four from constants in
// asset-generation.ts, exactly as it does on a real run — the model is told not
// to emit them, and neither does this fixture. Writing them out here would be a
// second copy of the scope language that could silently drift from the real one.
const surfaces: AssetPack["surfaces"] = stampSurfaceDestinations({
  bookingPage: {
    where: "",
    honestyNote: "",
    headlineOptions: [
      "No heat in Kelowna? We can usually be there the same day.",
      "Furnace, heat pump and air conditioning service across the Central Okanagan.",
      "Heating and cooling that gets answered, not just advertised.",
    ],
    subheadlineOptions: [
      "Licensed, insured and working in Kelowna since 2009. Tell us what is happening and we will tell you when we can be there.",
      "Same-week service on most makes, a written price before any work starts, and an answer whatever time you send this.",
      "Furnace repair, heat pump installs and air conditioning across Kelowna, West Kelowna and Lake Country.",
    ],
    primaryButton: "Book a service visit",
    secondaryButton: "Request a written quote",
    reassuranceLine:
      "4.4 stars across 61 Google reviews. Licensed and insured for gas work in British Columbia.",
    proofLine:
      "Rated 4.4 by 61 Kelowna homeowners, and answering after hours since this system went in.",
    sectionOrder: [
      {
        name: "Hero",
        purpose: "Answer the question the visitor arrived with in one line.",
        copy:
          "No heat in Kelowna? We can usually be there the same day. Licensed, insured and working across the Central Okanagan since 2009 — tell us what is happening and we will tell you when we can be there.",
      },
      {
        name: "The problem, in their words",
        purpose: "Show that you understand the situation the visitor is actually in.",
        copy:
          "A furnace does not fail at a convenient hour. It fails on the coldest night of the year, or on the Saturday of a long weekend, and by then the question is not who is cheapest but who picks up. The frustrating part for most homeowners is not the repair bill. It is ringing three companies, leaving three messages, and waiting to see which one calls back.",
      },
      {
        name: "How the work actually goes",
        purpose: "Remove the uncertainty about what happens after they book.",
        copy:
          "Send us what is happening and you get an answer within minutes, whatever time it is. If it is urgent, the on-call technician is paged straight away. If it can wait until Tuesday, you get a written price and a slot you can hold online without another phone call. Either way you know where you stand before you have finished checking the other tabs.",
      },
      {
        name: "Proof",
        purpose: "Let real customers do the persuading.",
        copy:
          "Northvale has been working on Okanagan heating systems since 2009, licensed and insured for gas work in British Columbia. The rating is 4.4 across 61 Google reviews, and they consistently mention punctuality, honesty about what does and does not need replacing, and a fair price. [Paste three real Google reviews here, first name and neighbourhood only — never write one that nobody left.]",
      },
      {
        name: "Book a time",
        purpose: "Give a ready customer a way to hold a slot without a phone call.",
        copy:
          "Pick a window that suits you. You will get a written confirmation within a minute, a reminder the day before, and a text on the morning of the visit when the technician leaves the previous job.",
      },
      {
        name: "Questions",
        purpose: "Answer the objections that otherwise become a phone call or a closed tab.",
        copy:
          "Cost, timing, service area and what happens out of hours — answered plainly below, with no hedging.",
      },
      {
        name: "Close",
        purpose: "Repeat the offer to act for anybody who read the whole page.",
        copy:
          "Book a service visit, request a written quote, or call 250-555-0164. Whichever you choose, you get an acknowledgement within a minute.",
      },
    ],
    faq: [
      {
        question: "How quickly can somebody get here?",
        answer:
          "Urgent no-heat and no-cooling calls are usually same day. Everything else is normally within the same week, and you will be given a real window rather than a vague morning or afternoon.",
      },
      {
        question: "What does it cost to have somebody look at it?",
        answer:
          "There is a diagnostic fee for the visit, quoted to you before it is booked, and it comes off the bill if you go ahead with the repair. No work starts without a written price you have agreed to.",
      },
      {
        question: "What happens if I message you in the evening?",
        answer:
          "You get an acknowledgement within a minute confirming we have it, and a real reply first thing. If it is an emergency, the message routes to the on-call technician rather than waiting for the office to open.",
      },
      {
        question: "Which areas do you cover?",
        answer:
          "Kelowna, West Kelowna and Lake Country. If you are outside that we will say so straight away rather than leaving you waiting on a callback.",
      },
      {
        question: "Should I repair this furnace or replace it?",
        answer:
          "That depends on age, the part that has failed and what the repair costs against a replacement. The technician will give you both numbers and tell you honestly which one they would choose, which is what most of the reviews are about.",
      },
      {
        question: "Do you work on heat pumps as well as furnaces?",
        answer:
          "Yes, including cold-climate heat pumps sized for Okanagan winters, and the rebate paperwork is handled for you as part of the install.",
      },
    ],
  },
  leadCaptureForm: {
    where: "",
    formHeadline: "Tell us what is happening",
    formIntro:
      "Four lines is plenty. The more we know about the system and the urgency, the faster the right person calls you back.",
    submitButton: "Send it to Northvale",
    postSubmitHeadline: "Got it — this is with us now",
    postSubmitCopy:
      "A confirmation is on its way to your phone. A person will follow it within the hour during office hours, or first thing tomorrow if you sent this overnight. You do not need to send it again.",
    emergencyRoute:
      "If it is an emergency, call 250-555-0164 — it will route straight to the on-call technician instead of waiting on a sequence.",
  },
  leadGate: {
    where: "",
    openingLine:
      "Five quick questions so the right person calls you back with the right answer, instead of phoning to work out what the job is.",
    questionIntros: [
      "This one decides whether it goes to the on-call technician tonight or to the office in the morning.",
      "Knowing the make and rough age means the technician arrives carrying the likely part.",
      "The postal area tells us straight away whether you are inside the service area — if you are not, we will say so rather than leave you waiting.",
    ],
    priorityAcknowledgement:
      "That sounds like it cannot wait. The on-call technician has been paged and will call you on this number — if it is a full outage in this weather, ring 250-555-0164 as well rather than waiting.",
    standardAcknowledgement:
      "Thanks — that is everything we need. Somebody from the office will call you back within the hour during business hours, or first thing tomorrow if you sent this overnight.",
  },
  webchat: {
    where: "",
    launcherLabel: "Ask a quick question",
    greeting:
      "Hi — this is Northvale. Ask away and somebody will answer. If your heat or cooling is out altogether, say so and it goes to the on-call technician.",
    detailsAsk:
      "Can I take a name and a mobile number? That way we can carry on by text if you have to close the tab, and nothing gets lost.",
    awayMessage:
      "The office is closed but this is monitored. Send it through and you will get a real reply first thing. If you have no heat, call 250-555-0164 and it routes straight to the on-call technician. You can also grab a slot now: [booking link]",
  },
  siteAdvisory: {
    where: "",
    scopeNote: "",
    standingRules: [],
    // THE ADVISORY SURFACE IS THE HONEST HOME FOR A JUDGMENT ABOUT A PAGE — AND IT
    // IS STILL NOT A HOME FOR A POSITION CLAIM. docs/detector-checkability.md §2.7
    // forbids "above the fold", "buried" and "no clear call to action" outright, in
    // ANY deliverable, because we render no page and measure no position. The
    // advisory surface is exempt from being read as a MEASUREMENT, not from being
    // true. So these strings now describe what the fingerprints found (a `tel:`
    // link, two routes in the HTML, the form's own fields) and keep the judgment in
    // the RECOMMENDATION, where it is advice somebody can take or leave.
    summary:
      "The page does the honest things well: the headline says what you do and where, and the phone number is a real tap-to-call link in the HTML rather than typed-out digits. What it does not do is give a visitor any way to act outside the hours your office is open, or any reason to choose you over the two companies with more reviews. Measured on mobile the page scores 67 with a largest contentful paint of 3.4 seconds, and 89 at 1.6 seconds on desktop — real numbers, worth knowing, and context rather than a recommendation. The conversion read is that the page is quick enough that nothing on this list is being caused by load time.",
    notes: [
      {
        area: "Buttons",
        whatWeSaw:
          "The two routes into the business we can find in the page HTML are a request-a-quote link to the contact form and a tap-to-call link to the main line. We found no third option on any page we scanned, and both of those routes need the office to be open.",
        recommendation:
          "Point the existing buttons at the booking page and keep one visible at every scroll position. This is the cheapest change on the list and the one with the most behind it.",
        priority: "critical",
      },
      {
        area: "Hero",
        whatWeSaw:
          "The headline describes the trade and the service area accurately, with the licensing and the year of founding directly beneath it. It does not answer the question a visitor arrives with, which is how quickly somebody can be there.",
        recommendation:
          "Lead with response and availability, and move the licensing line down to the proof row where it still does its job.",
        priority: "high",
      },
      {
        area: "Proof placement",
        whatWeSaw:
          "The proof section states the rating and the review count in a sentence. There is no review text on the page and no named customer anywhere.",
        recommendation:
          "Pull three real Google reviews onto the page verbatim, each with a first name and a neighbourhood, and place one immediately under the hero.",
        priority: "high",
      },
      {
        area: "The form",
        whatWeSaw:
          "The form asks four generic questions — name, email, phone and a message box — so every submission looks identical until somebody phones back to find out what it is.",
        recommendation:
          "Add job type, urgency and postal area to the form. It is what lets an enquiry be sorted before anybody picks up a phone.",
        priority: "high",
      },
      {
        area: "Response expectations",
        whatWeSaw:
          "Nothing beside either button tells a visitor when to expect an answer, and your listing shows evenings and weekends closed.",
        recommendation:
          "State the response commitment next to the button — and only a commitment the automation behind it actually keeps.",
        priority: "medium",
      },
      {
        area: "Measurement",
        whatWeSaw:
          "Form submissions and tap-to-call clicks are not recorded as separate events, so there is no way to tell which route people actually take.",
        recommendation:
          "Track the two as separate conversion events and tag every enquiry with the hour it arrived. That is the only way to size the after-hours question with real data rather than a benchmark.",
        priority: "medium",
      },
    ],
  },
});

/* ── Deliverable 3 · the copy every workflow in the build actually sends ──── */
// WHY THIS BLOCK EXISTS, AND IT IS NOT "COMPLETENESS".
// verify-phase3 check G1 asserts that everything a pack carries reaches a
// rendered document. That invariant was written because the booking-page copy
// was once generated, saved, validated — and then quietly dropped at render
// time, with 342 assertions still green. Until now G1 reported "workflowCopy:
// not on this pack — nothing to render", because this fixture never built one.
// So the single part of the pack the invariant could not see was the part that
// had most recently broken, and the only proof it renders was somebody checking
// by hand. An invariant nothing exercises is exactly the failure this phase was
// spent removing.
//
// THE LIST OF WORKFLOWS IS NOT TYPED HERE. workflowsNeedingCopy() decides it
// from the catalogue, the same way a paying client's run decides it: the
// fourteen workflows, minus any this client's intake answers took out of the
// build, minus the five whose copy already lives elsewhere in the pack (booking
// and reminders, no-show recovery, the review request, the 60-day nurture, the
// webchat). Add a fifteenth workflow to workflow-catalogue.ts and it appears
// here on the next regeneration — and if nobody writes its messages, the guard
// below refuses to write the fixture rather than shipping a workflow with an
// empty message table.
//
// ONLY THE MESSAGE BODIES ARE HAND-WRITTEN. The workflow's name, its trigger and
// its destination inside GoHighLevel are STAMPED by stampWorkflowCopy() from the
// catalogue — which is why the assets handed to it below carry empty strings in
// those three slots, exactly as the surfaces block above leaves `where` empty. A
// paraphrased workflow name is a document that does not match the sub-account the
// operator has open; a guessed destination is a customer message pasted into an
// internal step.

/** The generation context the copy step reads. Three of its fields decide which
 *  workflows need copy — the intake answers, the fired-leak report and the
 *  operator's toggles — and it is assembled honestly rather than cast, so this
 *  fixture asks the question in the same words the live engine asks it. */
const genContext: GenerationContext = {
  business: {
    name: BIZ.name,
    industry: BIZ.industry,
    category: BIZ.industry,
    city: BIZ.city,
    rating: BIZ.rating,
    reviewCount: BIZ.reviewCount,
    website: BIZ.website,
    description: null,
  },
  intel,
  websiteText: HOME_MARKDOWN,
  // The client answered the intake form, so this is a real client pack rather
  // than the pre-intake testing path that stamps "INTERNAL TEST" on every cover.
  intakePresent: true,
  intake: detected.data.intake ?? null,
  leaks: {
    report: detected.report,
    coldAudit: detected.coldAudit,
    outOfScope: detected.outOfScope,
    grades: detected.grades,
    promptBlock: leakInputsToPromptBlock(leakInputs),
    allowedNumbers,
    inputs: leakInputs,
  },
  // No operator has overridden anything on this synthetic client, so every
  // workflow resolves on the catalogue's own rule.
  workflowToggles: null,
};

// Keyed by CATALOGUE WORKFLOW ID for the same reason LEAK_PROSE is keyed by leak
// id: renaming a workflow must not silently orphan its messages.
//
// HOW MANY MESSAGES EACH ONE GETS is set by the shape the real prompt asks for —
// two for the instant response (a text and its matching email), two after hours,
// three for the reactivation campaign, three public review replies, one
// everywhere else. The copy is written for the synthetic business the rest of
// this file invents: an owner-run heating and cooling company in Kelowna. It is
// deliberately written the way the product writes: no promise the automation
// does not keep, one next step per message and it is the booking link, no
// invented discount or deadline, and merge fields rather than square brackets,
// because an unknown placeholder renders as empty text in front of a customer.
const WORKFLOW_MESSAGES: Record<string, WorkflowMessage[]> = {
  "instant-lead-response": [
    {
      step: "Step 1 · text, within a minute",
      channel: "Text",
      timing: "Within about a minute of the form arriving, day or night",
      body:
        "Hi {{contact.first_name}}, this is {{location.name}}. We have your enquiry and somebody is on it. If you would rather not wait for the phone to ring, the open times are here: {{custom_values.booking_link}}. If you have no heat or no cooling right now, call {{location.phone}} and tell us it is urgent.",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
        "{{location.phone}}",
      ],
    },
    {
      step: "Step 2 · email, same minute",
      channel: "Email",
      timing: "Sent alongside the text, within about a minute of the form arriving",
      subject: "We have your enquiry, {{contact.first_name}}",
      body:
        "Hi {{contact.first_name}},\n\nThanks for getting in touch with {{location.name}}. Your details are with us and somebody will call you back on the number you left.\n\nIf it is easier, you can take a time straight off the calendar here: {{custom_values.booking_link}}\n\nThree things help us arrive with the right parts: what the equipment is doing, roughly how old it is, and whether you are without heating or cooling right now. Reply with whatever you know.\n\n{{location.name}}\n{{location.phone}}",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
        "{{location.phone}}",
      ],
    },
  ],

  "missed-call-text-back": [
    {
      step: "The text back",
      channel: "Text",
      timing: "Within seconds of a call ringing out or dropping into voicemail",
      body:
        "Sorry we missed you, this is {{location.name}}. Tell us what you need and we will pick it up from here, or take a time straight off the calendar: {{custom_values.booking_link}}. If you have no heat or no cooling, say so in your reply and you go to the front of the callbacks.",
      mergeFields: ["{{location.name}}", "{{custom_values.booking_link}}"],
    },
  ],

  "after-hours-auto-reply": [
    {
      step: "The out-of-hours text",
      channel: "Text",
      timing: "Immediately, on any call or message that arrives outside opening hours",
      body:
        "Thanks for reaching {{location.name}}. The office is closed right now and opens again at 8am on the next working day. Send us your address and what the system is doing, and we will call you first thing. The calendar stays open overnight if you would rather hold a time now: {{custom_values.booking_link}}",
      mergeFields: ["{{location.name}}", "{{custom_values.booking_link}}"],
    },
    {
      step: "The matching out-of-hours email",
      channel: "Email",
      timing: "Sent with the text, on any message that arrives outside opening hours",
      subject: "We are closed right now, but your message is with us",
      body:
        "Hi {{contact.first_name}},\n\nThanks for writing to {{location.name}}. The office is closed at the moment and opens again at 8am on the next working day. Your message is already in the queue for the morning, so there is nothing you need to send twice.\n\nIf you would rather not wait, you can hold a time yourself here: {{custom_values.booking_link}}\n\nIf you have no heat or no cooling and it will not keep until morning, reply with the word urgent and your address, and the on-call technician is paged instead.\n\n{{location.name}}",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
      ],
    },
  ],

  // The whole job of this workflow is silence about the old slot, so the one
  // message it sends says the reminders have stopped and gives a way back in.
  "appointment-cancelled-stop-reminders": [
    {
      step: "The one note that goes out when the slot is cancelled",
      channel: "Text",
      timing: "Within a minute of the appointment being cancelled or moved, by the customer or by the office",
      body:
        "Hi {{contact.first_name}}, your visit on {{appointment.start_time}} is cancelled and the reminders for it have stopped. You will not hear anything further about that slot. Whenever you want another one, the open times are here: {{custom_values.booking_link}}",
      mergeFields: [
        "{{contact.first_name}}",
        "{{appointment.start_time}}",
        "{{custom_values.booking_link}}",
      ],
    },
  ],

  // THE ONLY MESSAGE IN THE PACK NOT ADDRESSED TO A CUSTOMER. It goes to the
  // owner's phone, which is why stampWorkflowCopy gives this workflow a
  // destination line that says so in as many words — pasted into a customer-facing
  // step it would send the lead their own score.
  "owner-hot-lead-notification": [
    {
      step: "The notification that goes to the owner's phone",
      channel: "Owner notification",
      timing: "The second a new enquiry scores as high intent, ahead of every other alert",
      body:
        "Priority lead. {{contact.name}}, {{contact.phone}}. No heat, replacement-sized job, inside the service area, came in through the form on the site. Nobody has spoken to them yet. Tap the number to call now. If it is not picked up in five minutes the office gets the same alert.",
      mergeFields: ["{{contact.name}}", "{{contact.phone}}"],
    },
  ],

  "social-dm-capture": [
    {
      step: "The first reply, sent inside Facebook or Instagram",
      channel: "Direct message",
      timing: "Within a minute of the message landing in the page inbox",
      body:
        "Thanks for messaging {{location.name}}. We have it and somebody is looking at it now. Send us your address and what the equipment is doing and we will come back with a time, or take one straight off the calendar here: {{custom_values.booking_link}}",
      mergeFields: ["{{location.name}}", "{{custom_values.booking_link}}"],
    },
  ],

  // Sent to somebody who has already said yes. It confirms what they are paying
  // for and what happens once it clears, and it never suggests the slot is at
  // risk beyond the plain fact that the deposit is what holds it.
  "text-to-pay": [
    {
      step: "The payment text, once the job is agreed",
      channel: "Text",
      timing: "When the job is marked agreed, or when a booking needs a deposit before the slot is held",
      body:
        "Hi {{contact.first_name}}, thanks for going ahead with {{location.name}}. Here is the deposit link for the work we agreed: {{custom_values.payment_link}}. It takes a card on your phone and the receipt comes through straight after. Once it clears, your slot on {{appointment.start_time}} is held and the confirmation and reminders start.",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.payment_link}}",
        "{{appointment.start_time}}",
      ],
    },
  ],

  // Every one of the three carries a one-tap way to hear nothing further, because
  // these go to people who have not heard from the business in a long time.
  "database-reactivation": [
    {
      step: "Message 1 · the opening text to the list",
      channel: "Text",
      timing: "Batch one, sent ahead of the heating season once the list is handed over",
      body:
        "Hi {{contact.first_name}}, this is {{location.name}} in Kelowna. We looked after your heating and cooling a while back, and we are booking the autumn service visits now. If you would like yours on the list, the open times are here: {{custom_values.booking_link}}. Reply STOP and we will not text you again.",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
      ],
    },
    {
      step: "Message 2 · one gentle follow-up, a week later",
      channel: "Text",
      timing: "Seven days after message 1, only to the people who neither replied nor booked",
      body:
        "Hi {{contact.first_name}}, {{location.name}} again, and this is the last note about the autumn visits. If you would like the system looked at before the cold arrives, the calendar is here: {{custom_values.booking_link}}. If not, no problem at all. Reply STOP and we will leave you be.",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
      ],
    },
    {
      step: "Message 3 · the seasonal re-send",
      channel: "Text",
      timing: "Next season, to the same list, before the cooling season starts",
      body:
        "Hi {{contact.first_name}}, this is {{location.name}}. Cooling season is coming round again and we are booking tune-ups for the customers we have worked with before. If you would like a slot, they are here: {{custom_values.booking_link}}. Reply STOP to hear nothing further.",
      mergeFields: [
        "{{contact.first_name}}",
        "{{location.name}}",
        "{{custom_values.booking_link}}",
      ],
    },
  ],

  // Posted in public, under the review, in the business name. The one-star reply
  // never argues, never mentions money, never restates the complaint back at the
  // customer, and moves it to a phone call.
  "review-response": [
    {
      step: "Four or five stars",
      channel: "Public review reply",
      timing: "Posted under the review, usually the same day",
      body:
        "Thanks for taking the time to write this. It means a lot to a local crew when somebody says the work held up. We will pass it on to the technician who was out with you, and we are here whenever the system needs looking at again.\n\n{{location.name}}",
      mergeFields: ["{{location.name}}"],
    },
    {
      step: "Three stars",
      channel: "Public review reply",
      timing: "Posted under the review, usually the same day",
      body:
        "Thanks for the honest write-up. We would rather know where we came up short than guess at it. If you have a minute, tell us what would have made it a better job and we will use it, whether or not you have us back.\n\n{{location.name}}",
      mergeFields: ["{{location.name}}"],
    },
    {
      step: "One or two stars",
      channel: "Public review reply",
      timing: "Posted under the review, usually the same day, with the wording run past the owner first",
      body:
        "Thank you for telling us. This is not the standard we hold ourselves to and we would like to understand properly what happened. Please call the office on {{location.phone}} and ask for the owner, and we will go through it with you directly.\n\n{{location.name}}",
      mergeFields: ["{{location.phone}}", "{{location.name}}"],
    },
  ],
};

const workflowsToWrite = workflowsNeedingCopy(genContext);

// Fail loudly rather than shipping a workflow whose message table is empty. An
// empty table renders as a heading with nothing under it, which on go-live day
// means the operator writes that workflow's copy by hand inside the client's
// account while the client watches — the exact unbilled work this part of the
// pack exists to remove.
for (const r of workflowsToWrite)
  if (!WORKFLOW_MESSAGES[r.workflow.id]?.length)
    throw new Error(
      `workflow "${r.workflow.id}" (${r.workflow.name}) is in the build and needs copy, but WORKFLOW_MESSAGES has none for it — write its messages before regenerating the fixture.`
    );

const workflowCopy: AssetPack["workflowCopy"] = {
  assets: stampWorkflowCopy(
    workflowsToWrite,
    // The three empty strings are the point: workflowName, trigger and where are
    // overwritten from the catalogue by the stamp, exactly as they overwrite the
    // model's output on a real run.
    workflowsToWrite.map<WorkflowCopyAsset>((r) => ({
      workflowId: r.workflow.id,
      workflowName: "",
      trigger: "",
      where: "",
      messages: WORKFLOW_MESSAGES[r.workflow.id],
    }))
  ),
  // The anti-drift record: every workflow in the build with a pointer to where
  // its words come from, including the five written elsewhere in the pack.
  coverage: workflowCoverage(genContext),
};

/* ── file1 · the internal growth-audit module ─────────────────────────────── */
const file1: AssetPack["file1"] = {
  framing: {
    overview:
      "This module is the diagnostic layer behind the report: where enquiries reach Northvale, what happens to them on each route, and which of those routes is costing the most. It looks only at converting demand that already exists, because that is the part we can fix without changing what you spend on anything.",
    implementationGuide: [
      "Read the leak sections in the order they are printed; they are ranked by what they cost, not by how easy they are.",
      "Confirm the four findings marked as industry patterns at kickoff, since those were not observed on your business.",
      "Approve the capture fixes first, because everything downstream only works on enquiries that reached the system.",
      "Give us the past-customer list and the technician availability so the second phase can be scheduled.",
      "Hold the response commitment: the page can only promise what the automation behind it keeps.",
    ],
    expectedImpact:
      "The realistic outcome is more of the enquiries you already receive turning into booked jobs, particularly the ones arriving in the evenings and at weekends where nothing currently catches them.",
  },
  executiveSummary:
    "Northvale converts well once somebody is actually in the conversation, and the review record says so: competent work, honest advice, fair prices, and appointments that get attended. Everything scoring badly in this report happens before that conversation starts. A call that rings out has no fallback, a form fill has nothing automated behind it, an evening enquiry has nowhere to land, and a quote that goes quiet depends on somebody remembering it. The largest recoverable figure sits on the phone line, and the cheapest fix sits on the same line.",
  growthAudit: {
    overview:
      "The audit covers the routes an enquiry can take into this business and what each one does when nobody is free. It does not cover how to get more enquiries, which is out of scope for this engagement by design.",
    findings: [
      {
        area: "Phone",
        finding:
          "One published line with no visible text-back path, and no record anywhere of how many calls are answered against how many are not.",
        severity: "high",
      },
      {
        area: "Website form",
        finding:
          "The form collects four generic fields and has nothing automated behind it, so reply speed depends on the day's job list.",
        severity: "high",
      },
      {
        area: "After hours",
        finding:
          "Google hours show evenings and weekends closed, with no booking path and no chat to catch demand in those hours.",
        severity: "high",
      },
      {
        area: "Booking",
        finding:
          "No online scheduler on the site or the Google profile; you confirmed bookings are taken by phone and email only.",
        severity: "medium",
      },
      {
        area: "Social",
        finding:
          "A Facebook page is linked from the footer and sits outside every other channel, with no shared response standard.",
        severity: "low",
      },
      {
        area: "Reputation",
        finding:
          "4.4 stars across 61 reviews, comfortably above half the local competitor median. This one holds up.",
        severity: "low",
      },
    ],
  },
  technicalUx: {
    available: true,
    mobile: { score: 67, lcpSeconds: 3.4, cls: 0.04, inpMs: 210 },
    desktop: { score: 89, lcpSeconds: 1.6, cls: 0.02, inpMs: 90 },
    businessImpactSummary:
      "The page loads quickly enough that nothing in this report is being caused by it: 3.4 seconds to the main content on mobile and 1.6 on desktop. These numbers are context, not a work item, since site performance is not part of a conversion engagement.",
    topFixes: [],
  },
  visuals: {
    available: false,
    shots: [],
    competitiveRead:
      "No screenshots were captured for this run, so nothing here rests on a visual comparison.",
  },
  revenueLeaks: [
    {
      issue: "Calls that ring out have no automated recovery behind them.",
      whyItMatters:
        "A caller who cannot reach a person typically dials the next company within minutes, and nothing brings them back.",
      impact: 10,
      urgency: 9,
      difficulty: 2,
      recommendedFix: "Missed-call text-back on the published line, replying within seconds.",
      expectedImpact: "The largest single dollar figure in this report, estimated beside that finding.",
    },
    {
      issue: "An after-hours enquiry has nowhere to land.",
      whyItMatters:
        "Heating and cooling failures are noticed at night and at weekends, which is exactly when the listing shows you closed.",
      impact: 9,
      urgency: 9,
      difficulty: 2,
      recommendedFix: "After-hours auto-response plus a booking page that stays open around the clock.",
      expectedImpact: "Turns the highest-urgency hours into hours where you are the company that replied.",
    },
    {
      issue: "Reply speed on the form is set by the day's schedule.",
      whyItMatters:
        "Two published reviews already describe an enquiry that waited, and one of them went to a competitor.",
      impact: 9,
      urgency: 8,
      difficulty: 2,
      recommendedFix: "Instant auto-reply and qualification behind every submission.",
      expectedImpact: "First useful reply becomes yours on enquiries you are already receiving.",
    },
    {
      issue: "Every enquiry arrives looking identical.",
      whyItMatters:
        "A replacement-sized job and a filter question get the same treatment, so the valuable one waits longest.",
      impact: 7,
      urgency: 7,
      difficulty: 3,
      recommendedFix: "Job type, urgency and service area captured and scored at the point of entry.",
      expectedImpact: "The biggest job of the week is the first one somebody calls back.",
    },
    {
      issue: "Quotes that go quiet depend on somebody remembering them.",
      whyItMatters:
        "Heating decisions are made across weeks, and the company still present when the customer is ready usually gets the work.",
      impact: 8,
      urgency: 7,
      difficulty: 4,
      recommendedFix: "A multi-touch follow-up sequence on every unbooked quote, with a longer seasonal branch.",
      expectedImpact: "Converts demand already earned, without adding a single new enquiry.",
    },
  ],
  conversionBottlenecks: [
    {
      stage: "Call to conversation",
      problem: "No fallback when nobody is free to pick up.",
      fix: "Missed-call text-back, with the reply landing in the same queue as everything else.",
    },
    {
      stage: "Form fill to callback",
      problem: "Nothing acknowledges the submission and nothing sorts it.",
      fix: "Instant auto-reply plus scoring on job type, urgency and area.",
    },
    {
      stage: "Ready customer to held slot",
      problem: "Committing to a time needs a phone conversation during office hours.",
      fix: "A booking page wired to real availability, with a deposit link behind it.",
    },
  ],
  localMarketIntelligence: {
    customerPsychology:
      "Most people contacting a heating company are already uncomfortable and slightly anxious about the bill. They are not researching, they are triaging, and they read speed of reply as a proxy for competence.",
    buyingBehavior:
      "Emergency work is decided in under an hour and usually by phone. Replacement work is decided over several weeks, often with two or three written quotes, and frequently stalls until the weather forces the issue.",
    trustExpectations:
      "Licensing and insurance are assumed rather than persuasive. What actually moves a homeowner is another homeowner in their own neighbourhood saying the technician was honest about what did not need replacing.",
    competitiveSaturation:
      "The Central Okanagan has a dense field of heating contractors, and the three nearest competitors carry review counts between seventy-four and one hundred and twenty-eight. Nobody in that set is visibly answering after hours.",
    seasonalDemand:
      "Two sharp peaks: the first hard frost, and the first stretch above thirty-five degrees. Capture problems cost several times more inside those windows than they do in the shoulder months.",
    priceSensitivity:
      "Diagnostic fees are compared closely; replacement quotes are compared on trust and timing more than on the bottom line. A written price given quickly beats a slightly lower one that took three days.",
    credibilityMarkers:
      "Years in the Okanagan, gas certification, named technicians, and reviews that mention specific streets or neighbourhoods rather than generic praise.",
  },
  competitorPositioning: {
    commonWeakMessaging: [
      "Homepages that lead with how long the company has existed rather than with what happens when you contact them.",
      "Service lists written in trade language a homeowner has to translate.",
      "Contact pages that ask for a message and set no expectation about a reply.",
    ],
    overusedClaims: [
      "Family owned and operated",
      "Fast, friendly, reliable",
      "Serving the Okanagan for over twenty years",
      "Free estimates",
    ],
    trustGapsIgnored: [
      "Nobody in the local set publishes what happens to an enquiry sent at 9pm.",
      "Nobody states a response time on the page, let alone keeps one.",
      "Review text is summarised as a star rating rather than shown in the customer's own words.",
    ],
    opportunitiesToStandOut: [
      "Be the company that answers within a minute at any hour, and say so on the page.",
      "Publish a real arrival window instead of a vague morning or afternoon.",
      "Show three verbatim reviews with a neighbourhood attached to each.",
      "Let a homeowner hold a Saturday slot on a Tuesday evening without a phone call.",
    ],
    recommendedAngle:
      "The heating company in Kelowna that actually answers. Not the oldest, not the cheapest, the one that replies while you are still deciding who to call.",
  },
  trustGapAnalysis: [
    {
      gap: "The rating is stated but never shown.",
      impact:
        "A visitor comparing you against companies with more reviews has nothing specific to weigh you on.",
      fix: "Place three verbatim Google reviews on the page, first name and neighbourhood attached.",
    },
    {
      gap: "No response commitment appears anywhere.",
      impact:
        "The visitor cannot tell whether sending the form means an hour or three days, so they hedge by contacting somebody else too.",
      fix: "State the commitment beside the button and let the automation keep it.",
    },
  ],
  fastestWins: [
    "Missed-call text-back on the published line.",
    "Instant auto-reply behind the contact form.",
    "After-hours auto-response covering evenings and weekends.",
    "Three verbatim reviews added to the homepage.",
  ],
  positioningStrategy:
    "Position Northvale on responsiveness rather than on longevity. The market is saturated with companies claiming experience and nobody claiming, or keeping, an answer time. Every asset in this pack is built to make that claim true first and visible second.",
  // WHAT IS NO LONGER HERE, AND WHY IT IS NOT A LOSS.
  //   landingPage / landingStructure — a whole landing-page spec for a page we
  //     do not build. Its words now live on `surfaces` below, addressed to the
  //     booking page, the form, LeadGate and the webchat.
  //   socialProofRecommendations / urgencyStrategy — never rendered anywhere,
  //     and urgencyStrategy in particular invites invented urgency.
  //   implementationNotes — "how to deploy this page". We do not deploy pages.
  //     The advisory scope sentence it half-carried is now a stamped constant on
  //     surfaces.siteAdvisory.standingRules, so it cannot be regenerated away.
  //   techStack — recommended a tool for building a website. Naming one implies
  //     a site build is in scope. It is not, and we would not advise on it.
  // None of the six is produced by generateFile1() any more (see the Return JSON
  // shape in src/lib/asset-generation.ts). A fixture that kept them would be
  // proving laws against a pack shape no client will ever receive.
  ctaStrategy:
    "Three routes, always in the same order, repeated at the hero and at the close: book, quote, call. The booking route leads because it is the only one that works outside office hours, and the phone route stays visible because some people will always want a person.",
  trackingAnalytics: [
    "Form submissions and tap-to-call clicks recorded as separate conversion events.",
    "Hour of arrival tagged on every enquiry, so the after-hours question can be sized with real data.",
    "Booking source recorded, so the booking page is judged on jobs rather than clicks.",
    "Answered, missed and after-hours call volume reported monthly.",
  ],
  loomTalkingPoints: [
    "Two of your published reviews describe an enquiry that never got a reply. Start there.",
    "Your listing says closed evenings and weekends, and there is nothing on the site to catch those enquiries.",
    "The form asks four generic questions, so the biggest job of the week waits behind the smallest.",
    "Your rating and your show rate are fine. This is a capture problem, and it is the cheaper kind.",
  ],
  beforeAfterAngles: [
    {
      before: "A call rings out at 7pm and nothing happens.",
      after: "A text goes back within seconds, the enquiry is scored, and a slot is held before morning.",
    },
    {
      before: "A form fill sits in an inbox until somebody comes off a job.",
      after: "An acknowledgement lands in a minute and the office gets a scored lead instead of a raw message.",
    },
    {
      before: "A quote goes quiet and depends on somebody remembering it.",
      after: "A sequence carries it across the weeks the decision actually takes.",
    },
  ],
  salesEnablement: {
    coldOutreachAngle:
      "Two of their own published reviews describe an enquiry that got no reply. That is a specific, verifiable problem, and it is cheaper to fix than any of them expect.",
    personalizedOpener:
      "Noticed your Google hours show evenings and weekends closed, and there is no way on the site to leave a job in the queue. In heating, that is the window where the urgent calls actually happen.",
    loomScriptBullets: [
      "Open on the two reviews that mention an enquiry going unanswered.",
      "Show the Google listing hours next to the site with no booking path.",
      "Walk the form: four fields, nothing behind it.",
      "Close on the estimated missed-call figure and say plainly that it is an estimate.",
    ],
    proposalPositioning:
      "This is not a website project. It is the layer between an enquiry arriving and somebody getting to it, built inside a GoHighLevel sub-account they own, with the qualification engine run monthly.",
    discoveryCallPoints: [
      "How many calls come in on a January Saturday, and what happens to them?",
      "Who reads the form submissions, and when in the day does that happen?",
      "What happens to a replacement quote that goes quiet for a month?",
      "Is there a list of past customers anywhere, and has anything ever been sent to it?",
    ],
    objectionHandling: [
      {
        objection: "We already answer the phone.",
        response:
          "During the day, almost certainly. The question is the Saturday afternoon when both technicians are on jobs, and nothing currently tells you how often that happens.",
      },
      {
        objection: "We do not need a new website.",
        response:
          "Agreed, and we do not build them. The website notes in the report are advisory; the only page we build is the booking page inside your own sub-account.",
      },
      {
        objection: "Our customers prefer to phone.",
        response:
          "Many will. This keeps the phone exactly as it is and adds a fallback for the calls that ring out and the enquiries that arrive after five.",
      },
      {
        objection: "That estimate looks optimistic.",
        response:
          "It is an estimate, built from your enquiry count and average job value with the industry rates shown beside it. Turn on call tracking for a month and we will replace it with your real numbers.",
      },
    ],
  },
};

/* ── file2 · lead qualification ───────────────────────────────────────────── */
const file2: AssetPack["file2"] = {
  framing: {
    overview:
      "The intake form that replaces the four generic fields on the contact page. Every question here exists to answer one thing before a human spends a minute on the enquiry: how urgent is this, how big is it, and is it in the service area.",
    implementationGuide: [
      "Replace the existing contact form with this one and keep it to a single screen on mobile.",
      "Wire each answer to the scoring weights below so a submission arrives already sorted.",
      "Point priority scores at the on-call technician and everything else at the office queue.",
      "Send the instant acknowledgement before any human sees the submission.",
      "Review the thresholds after the first month against jobs that actually booked.",
    ],
    expectedImpact:
      "The largest job in the inbox stops waiting behind the smallest, and nobody has to phone an enquiry back just to find out what it is.",
  },
  formHeadline: "Tell us what is happening",
  formSubheadline: "Six questions, about a minute, and you get an answer straight back.",
  questions: [
    {
      question: "What is going on with the system?",
      inputType: "select",
      options: [
        "No heat at all",
        "No cooling at all",
        "Working, but not properly",
        "Making a noise or a smell",
        "Planning a replacement",
        "Booking a maintenance visit",
      ],
      purpose: "Separates an emergency from a planned job in one answer.",
      scoringImpact: "No heat or no cooling scores highest; maintenance scores lowest.",
    },
    {
      question: "When did it start?",
      inputType: "select",
      options: ["Right now", "Today", "This week", "Longer than a week", "Nothing is wrong yet"],
      purpose: "Distinguishes a live failure from a tolerated one.",
      scoringImpact: "Right now and today add the urgency weight; the rest add none.",
    },
    {
      question: "What kind of equipment is it?",
      inputType: "select",
      options: ["Gas furnace", "Heat pump", "Air conditioner", "Boiler", "Not sure"],
      purpose: "Lets dispatch send somebody carrying the right parts.",
      scoringImpact: "Neutral on score; used entirely for routing and parts.",
    },
    {
      question: "Roughly how old is the system?",
      inputType: "select",
      options: ["Under 5 years", "5 to 10 years", "10 to 15 years", "Over 15 years", "No idea"],
      purpose: "Signals whether this is heading towards a repair or a replacement conversation.",
      scoringImpact: "Over fifteen years lifts the value weight.",
    },
    {
      question: "Where is the property?",
      inputType: "text",
      options: [],
      purpose: "Confirms the job is inside the service area before anybody is dispatched.",
      scoringImpact: "Outside Kelowna, West Kelowna or Lake Country drops the score to low fit.",
    },
    {
      question: "Is this a home or a commercial property?",
      inputType: "select",
      options: ["Home", "Commercial", "Strata or rental"],
      purpose: "Sets who needs to authorise the work and who receives the invoice.",
      scoringImpact: "Strata and rental add a small handling weight, not an urgency one.",
    },
    {
      question: "Best number to reach you on right now",
      inputType: "tel",
      options: [],
      purpose: "Gives the technician a direct route back without a second round trip.",
      scoringImpact: "No score; a missing number holds the enquiry out of the priority lane.",
    },
  ],
  leadScoring: {
    rubric:
      "Urgency carries the most weight, then job value, then service area. A no-heat call at fifteen years old inside Kelowna is the highest score the form can produce; a maintenance question from outside the area is the lowest.",
    hot: "90–100. No heat or no cooling, live now, inside the service area.",
    warm: "70–89. A real job in the area with no immediate urgency behind it.",
    cold: "40–69. Planning work, comparing prices, or booking routine maintenance.",
  },
  routingLogic: [
    { tier: "Priority Lead", action: "Page the on-call technician and call back immediately.", timing: "Under five minutes, any hour." },
    { tier: "Qualified Lead", action: "Office calls back and puts a written price in writing the same day.", timing: "Within one hour during business hours." },
    { tier: "Nurture Lead", action: "Send what they asked for and enter the longer sequence.", timing: "Same day, automated." },
  ],
  automationWorkflow: [
    "Submission arrives and the acknowledgement text sends within seconds.",
    "LeadGate scores the answers and writes the tier onto the record.",
    "Priority scores page the on-call technician; everything else queues for the office.",
    "The record is created in the pipeline at New Lead with a timestamp and an owner.",
    "Anything untouched after fifteen minutes in business hours raises an alert.",
  ],
  thankYouPage:
    "Got it — that is with us. You will have a text on your phone within a minute confirming what you sent. If you told us there is no heat, the on-call technician has it already.",
  crmFields: [
    "Problem type",
    "Onset",
    "Equipment type",
    "Equipment age",
    "Service area",
    "Property type",
    "Lead score and tier",
    "Hour of arrival",
    "Source channel",
  ],
  followUpTiming:
    "Priority leads are called back inside five minutes at any hour. Qualified leads inside the hour during business hours. Nurture leads receive the automated reply the same day and then enter the sequence.",
  implementation: [
    "Build the form in the GoHighLevel sub-account so the answers land natively on the record.",
    "Keep the whole form on one mobile screen; every extra scroll costs completions.",
    "Send the acknowledgement before any human is notified, so nobody waits on staff availability.",
    "Set the alert threshold at fifteen minutes and let it page rather than email.",
    "Revisit the scoring weights after thirty days against jobs that actually booked.",
  ],
};

/* ── file3 · the EMAIL half of the 60-day nurture workflow ────────────────── */
// FILE 3 AND FILE 4 ARE ONE WORKFLOW, NOT TWO SEQUENCES. Seven emails and six
// texts interleave on a single 60-day canvas — workflow 8 in the catalogue, "Lead
// Nurture — No Booking" — and the canvas is defined ONCE, in NURTURE_SEQUENCE in
// src/lib/asset-generation.ts.
//
// SO THE DAYS AND THE STEP NUMBERS ARE NOT TYPED HERE. They are read off that
// constant. The old fixture wrote its own schedule (days 0, 2, 5, 9, 14, 21, 45),
// which ended fifteen days before the workflow does — a lead who takes two months
// to decide stopped hearing from them at day 45 while the workflow was still
// running, and the sequence's own close-out email did not exist. That is now a
// fatal validator check (E3 · 60-day nurture) and this is what it caught.
//
// nurtureStep() below fails loudly if the canvas ever renumbers underneath this
// file, which is the whole point of reading it rather than copying it.
const NURTURE_EMAILS = NURTURE_SEQUENCE.filter((s) => s.channel === "Email");
const NURTURE_TEXTS = NURTURE_SEQUENCE.filter((s) => s.channel === "Text");

/** The canvas entry for one email/text, by its number within its own half.
 *  Throws rather than defaulting: a missing step would render as "Day undefined"
 *  in a document somebody is pasting into thirteen boxes. */
function nurtureStep(channel: "Email" | "Text", index: number) {
  const step = (channel === "Email" ? NURTURE_EMAILS : NURTURE_TEXTS).find(
    (s) => s.index === index
  );
  if (!step)
    throw new Error(
      `NURTURE_SEQUENCE has no ${channel} ${index}. The 60-day canvas in src/lib/asset-generation.ts changed; renumber this fixture against it.`
    );
  return step;
}

/** One email, with step/day/purpose taken from the canvas and only the words
 *  written here. `timing` names the workflow step so the destination line in D3
 *  routes to the workflow that sends it rather than to a generic fallback. */
function nurtureEmail(
  index: number,
  subject: string,
  subjectB: string,
  previewText: string,
  body: string,
  cta: string
) {
  const s = nurtureStep("Email", index);
  return {
    step: s.step,
    day: s.day,
    timing: `Day ${s.day} — step ${s.step} of the 60-day sequence on an unbooked quote`,
    subject,
    subjectB,
    previewText,
    body,
    cta,
    purpose: s.purpose,
  };
}

const file3: AssetPack["file3"] = {
  framing: {
    overview:
      "The email half of the 60-day follow-up: seven messages that carry an unbooked quote across the weeks a heating decision actually takes. Six texts land between them, so read the two documents together. They are written to be sent from your address and to sound like the office, because that is what gets replies.",
    implementationGuide: [
      "Load these against the Lead Nurture — No Booking workflow, in the step numbers shown, not as a separate campaign.",
      "Stop every message the moment the customer books or replies.",
      "Send from the office address rather than a marketing sender.",
      "Rotate the seasonal references twice a year so nothing reads out of date.",
      "Review reply rates each quarter and cut anything that never earns one.",
    ],
    expectedImpact:
      "More of the quotes you already wrote turn into booked work, without a single new enquiry entering the business.",
  },
  sequence: nurtureMeta("Email"),
  emails: [
    nurtureEmail(
      1,
      "Your quote from Northvale",
      "The numbers we talked about",
      "Everything in one place, plus what happens next.",
      "Hi [First name],\n\nHere is the written quote we discussed, with the price and what it covers on one page.\n\nTwo things worth knowing. The price holds for thirty days. And if you would rather just get it booked, you can pick a slot yourself at [booking link] without phoning anybody.\n\nIf anything in it does not make sense, reply to this and I will explain it properly.\n\n— The team at Northvale",
      "See available times"
    ),
    nurtureEmail(
      2,
      "What the visit actually looks like",
      "How the install day runs",
      "Access, timing, and how long the heat is off.",
      "Hi [First name],\n\nIn case it helps to picture it: the crew arrives inside a two-hour window, the system is down for most of the working day, and everything is cleared out before we leave.\n\nWe handle the rebate paperwork on heat pump installs, so there is nothing for you to file.\n\n— The team at Northvale",
      "See available times"
    ),
    nurtureEmail(
      3,
      "From a customer in [Neighbourhood]",
      "What other homeowners said",
      "Their words, not ours.",
      "Hi [First name],\n\nRather than tell you we are good at this, here is what a customer wrote after a job like yours:\n\n[Paste a real Google review verbatim — never write one that nobody left.]\n\nThe quote is still open if you want to move on it.\n\n— The team at Northvale",
      "See available times"
    ),
    nurtureEmail(
      4,
      "What actually drives the price",
      "Where the money goes on a job like this",
      "No mystery, just the four things that move the number.",
      "Hi [First name],\n\nWorth knowing what sits behind the figure, because it is not one number with a margin on top.\n\nFour things move it: the size of the unit your house actually needs, how much of the existing ductwork can be kept, whether the electrical panel can carry the load, and how long the crew is on site. Nothing else.\n\nIf you want me to walk through which of those applied to yours, reply and I will.\n\n— The team at Northvale",
      "Reply with your questions"
    ),
    nurtureEmail(
      5,
      "Repair it or replace it?",
      "The question most people are actually stuck on",
      "The honest answer for your system, not the general one.",
      "Hi [First name],\n\nMost people sitting on a quote like this are stuck on the same question: is it worth repairing this one, or putting the money towards a replacement.\n\nIt depends on the age of the unit and what has already been changed on it, so there is no general answer worth giving. Reply with the model number off the label and I will tell you what I would do if it were my house.\n\n— The team at Northvale",
      "Reply with your model number"
    ),
    nurtureEmail(
      6,
      "Still worth doing?",
      "The quote is still on file",
      "One line back is enough.",
      "Hi [First name],\n\nThe quote is still on file and slots are open at [booking link].\n\nIf the timing is wrong, say so and I will park it until it suits you. If the price is the problem, tell me and I will show you what a smaller version of the job looks like.\n\n— The team at Northvale",
      "See available times"
    ),
    nurtureEmail(
      7,
      "I will stop here",
      "Leaving this with you",
      "No more emails from me on this one.",
      "Hi [First name],\n\nThis is the last one from me on this quote — I do not want to keep landing in your inbox when it has clearly moved down the list.\n\nThe file stays with us, so if you get in touch in a month or in a year we pick up where we left off rather than starting again. And if the heat goes out in the meantime, call [phone] and somebody will answer.\n\n— The team at Northvale",
      "See available times"
    ),
  ],
};

/* ── file4 · SMS follow-up ────────────────────────────────────────────────── */
// charCount is derived from the message rather than typed, so the two can never
// disagree in a document somebody is reading on a phone.
// The step number, the day and the purpose come from the SAME canvas file3 reads.
// `timing` names the workflow step so D3's destination line routes each text to
// the workflow that actually sends it.
function sms(
  order: number,
  message: string,
  psychology: string,
  replyStrategy: string
) {
  const s = nurtureStep("Text", order);
  return {
    step: s.step,
    order,
    day: s.day,
    timing: `Day ${s.day} — step ${s.step} of the 60-day sequence on an unbooked quote`,
    message,
    charCount: message.length,
    psychology,
    replyStrategy,
  };
}

const file4: AssetPack["file4"] = {
  framing: {
    overview:
      "The text half of the same 60-day follow-up: six short messages that land between the emails. They are short on purpose and every one of them invites a reply, because a reply is what turns a sequence into a conversation.",
    implementationGuide: [
      "Load these into the Lead Nurture — No Booking workflow at the step numbers shown, interleaved with the emails.",
      "Send from the same tracked number the missed-call text-back uses, so the thread stays in one place.",
      "Stop the sequence the instant somebody replies or books.",
      "Keep each message under two segments so it lands as one text.",
      "Never send between 9pm and 8am unless the customer messaged first.",
      "Route every reply into the pipeline rather than into a personal phone.",
    ],
    expectedImpact:
      "Faster replies on the enquiries that are already in the system, and a route back for the quotes that would otherwise go quiet.",
  },
  sequence: nurtureMeta("Text"),
  messages: [
    sms(
      1,
      "Hi [First name], it is Northvale. Just checking the quote reached you okay. Happy to talk it through, or you can pick a slot yourself here: [booking link]",
      "Picks the conversation back up the day after, while it is still the thing they were thinking about.",
      "Replies route to the office queue; a booking closes the sequence automatically."
    ),
    sms(
      2,
      "Quick one [First name] — is the unit still running, or is it out altogether? Changes what I would suggest doing first.",
      "One question that takes four words to answer, which is what restarts a thread that has gone quiet.",
      "Any reply reopens the conversation with the office; the words no heat page the on-call technician."
    ),
    sms(
      3,
      "Hi [First name], is there one thing about the quote holding this up? Tell me which and I will answer it straight rather than guessing.",
      "Names the real blocker instead of asking for a decision they have not made yet.",
      "Replies go to the office; a booking or a reply stops the rest of the sequence."
    ),
    sms(
      4,
      "Hi [First name], still on the list for this season, or has it moved to next year? Either is a fine answer — it just tells me when to check back.",
      "A genuine permission check that also sorts the list into now and later.",
      "Later parks the record until the seasonal run; done stops everything."
    ),
    sms(
      5,
      "Hi [First name], we have space in the calendar over the next fortnight if you want it done before the cold sets in. Slots are here: [booking link]",
      "Real availability stated plainly, with no invented deadline attached to it.",
      "A booking closes the sequence; anything else leaves the last two steps to run."
    ),
    sms(
      6,
      "Last one from me [First name] — do you want this booked in? One word back and I will either sort it or leave you to it.",
      "A direct, warm ask at the point where anything less direct gets ignored.",
      "Yes routes straight to the office to book; anything else lets the final email close it out."
    ),
  ],
};

/* ── file5 · booking and show-up ──────────────────────────────────────────── */
const file5: AssetPack["file5"] = {
  framing: {
    overview:
      "The booking page and everything that protects the slot once it is taken. This is the one page in the pack we actually build and host, inside your own GoHighLevel sub-account.",
    implementationGuide: [
      "Wire the calendar to real technician availability rather than to a fixed grid.",
      "Point every call to action on the website at this page.",
      "Turn on the confirmation, reminder and arrival messages together; each one is weaker alone.",
      "Attach the deposit link to replacement work only, not to diagnostic visits.",
      "Check the arrival windows against actual route times after the first month.",
    ],
    expectedImpact:
      "Bookings taken outside office hours, and fewer wasted trips on slots nobody is home for.",
  },
  headline: "Pick a time that suits you",
  subheadline: "Real availability, confirmed instantly, no phone call needed.",
  whatToExpect: [
    "You choose a window rather than being given a whole morning.",
    "A confirmation text arrives within a minute with the technician's name.",
    "A reminder lands the day before with what to clear access to.",
    "You get a message when the technician leaves the previous job.",
    "Nothing is charged beyond the diagnostic fee without a written price you agreed.",
  ],
  threeStepBreakdown: [
    { step: "Choose your window", description: "Live availability across the next fourteen days." },
    { step: "Confirm the details", description: "Address, equipment and the best number to reach you." },
    { step: "Get it confirmed", description: "A text within a minute, and a reminder the day before." },
  ],
  appointmentPositioning:
    "The visit is a diagnosis, not a sales call. The technician tells you what has failed, what it costs to fix, and whether they would fix it or replace it in your position. You decide after that, with the price in writing.",
  microSocialProof: [
    "Rated 4.4 across 61 Google reviews from Kelowna, West Kelowna and Lake Country.",
    "Licensed and insured for gas work in British Columbia, working in the Okanagan since 2009.",
  ],
  confirmationEmail: {
    subject: "Booked: [date] between [window]",
    body:
      "Hi [First name],\n\nThat is confirmed. [Technician] will be with you on [date] between [window].\n\nBefore they arrive, please clear access to the unit — that is the single thing that most often turns a visit into a second visit.\n\nNeed to move it? Reply to this email or to the text you just received and we will find another slot.\n\n— The team at Northvale",
  },
  reminderEmail24h: {
    subject: "Tomorrow between [window]",
    body:
      "Hi [First name],\n\nA quick reminder that [Technician] is booked to visit tomorrow between [window].\n\nTwo things that help: clear access to the unit, and have the model number handy if you can find it on the label.\n\nIf tomorrow no longer works, reply and we will move it.\n\n— The team at Northvale",
  },
  dayOfReminderSms:
    "Northvale here — [Technician] is on the way and should reach you inside your [window] slot. Reply if anything has changed.",
  noShowRecoveryEmail: {
    subject: "We came by today",
    body:
      "Hi [First name],\n\n[Technician] came out today but could not get access, so the visit did not go ahead.\n\nNo problem at all. Reply with a day that suits you this week, or pick a new slot yourself at [booking link], and we will get you back in the calendar.\n\n— The team at Northvale",
  },
  noShowRecoverySms1:
    "We came by today and could not get access. Reply with a day that works and we will get you booked back in this week.",
  noShowRecoverySms2:
    "Still happy to get this sorted whenever it suits. Pick any slot here and it is confirmed straight away: [booking link]",
  rescheduleFraming:
    "Rescheduling is offered as a one-word reply on every message, because a customer who cannot easily move an appointment tends to simply not be home for it.",
  showUpQualityNotes:
    "Attendance is not currently a problem for this business, and the review record supports that. The reminders exist to keep it that way as booking volume moves online and the wait between booking and visit gets longer.",
  implementation: [
    "Host the page inside the GoHighLevel sub-account so bookings write straight to the pipeline.",
    "Sync availability with the dispatch calendar rather than maintaining a second one.",
    "Send the confirmation within sixty seconds; a slow confirmation reads as a failed booking.",
    "Keep the reschedule reply to a single character on SMS.",
  ],
};

/* ════════════════════════════════════════════════════════════════════════════
 * 4 · ASSEMBLE, VALIDATE, WRITE
 * ══════════════════════════════════════════════════════════════════════════ */

// Mirrors buildMeta() in src/lib/asset-generation.ts, except that generatedAt is
// the pinned constant rather than the wall clock — otherwise every regeneration
// of this fixture would produce a diff on one line and nobody would review it.
const pack: AssetPack = {
  meta: {
    businessName: BIZ.name,
    city: BIZ.city,
    industry: BIZ.industry,
    generatedAt: GENERATED_AT,
    dataConfidence: intel.dataConfidence,
    assumptions: intel.assumptions,
    signals: {
      websiteScraped: intel.website.hasWebsite,
      reviewsAnalyzed: intel.reviews.available || Boolean(intel.dataForSeo?.reviews.available),
      competitorsAnalyzed: intel.competitors.available,
      performanceMeasured: Boolean(intel.performance?.available),
      gbpProfilePulled: Boolean(intel.dataForSeo?.gbp.available),
      screenshotsCaptured: Boolean(intel.screenshots?.available),
      verifiedFactsExtracted: Boolean(
        intel.verifiedFacts &&
          (intel.verifiedFacts.phones.value.length ||
            intel.verifiedFacts.services.value.length ||
            intel.verifiedFacts.bookingLinks.value.length)
      ),
    },
  },
  file1,
  file2,
  file3,
  file4,
  file5,
  intelligence,
  infrastructure,
  supportingAssets,
  surfaces,
  workflowCopy,
};

// The allowed-number set is threaded in here (it is NOT at the other call sites,
// which only get guard (a)), so regeneration also proves every stamped integer
// traces back to a number the math layer actually produced.
const report = validatePack(pack, allowedNumbers);
console.log(formatValidation(report));

const verdict = assertPackValid(pack);
const rendered = validateRenderedDeliverables(pack);

const tiers = (pack.intelligence?.leakAnalysis ?? []).reduce<Record<string, number>>((acc, l) => {
  const t = l.evidenceTier ?? "UNTIERED";
  acc[t] = (acc[t] ?? 0) + 1;
  return acc;
}, {});
// The EVIDENCE GRADE spread (Phase 1) — measured / told / guessed. Stamped by
// stampLeakAnalysis from the grade each fire already carries, so it is reported
// here rather than computed: this line is how a regeneration diff gets reviewed
// for the thing that actually decides the document's voice.
const grades = (pack.intelligence?.leakAnalysis ?? []).reduce<Record<string, number>>((acc, l) => {
  const g = l.evidenceGrade ?? "UNGRADED";
  acc[g] = (acc[g] ?? 0) + 1;
  return acc;
}, {});
const cleanAxes = (pack.intelligence?.scorecard.metrics ?? [])
  .filter((m) => m.score === 95)
  .map((m) => m.name);

console.log(`\nGolden sample — ${pack.meta.businessName} (${pack.meta.industry}, ${pack.meta.city})`);
console.log(`  leaks:      ${pack.intelligence?.leakAnalysis?.length ?? 0}`);
console.log(`  tiers:      ${Object.entries(tiers).map(([t, n]) => `${t}×${n}`).join(", ")}`);
console.log(`  grades:     ${Object.entries(grades).map(([g, n]) => `${g}×${n}`).join(", ")}`);
console.log(`  clean axes: ${cleanAxes.length ? cleanAxes.join(", ") : "(none)"}`);
console.log(`  dollar frames: ${(pack.intelligence?.leakAnalysis ?? []).filter((l) => l.dollarImpact).length}`);
// Printed so a regeneration diff can be reviewed for the thing that matters here:
// if the catalogue gains or loses a workflow, these two counts move and the
// reviewer sees it, rather than discovering it in a client's document.
console.log(
  `  workflow copy: ${pack.workflowCopy?.assets.length ?? 0} workflow(s), ` +
    `${(pack.workflowCopy?.assets ?? []).reduce((n, a) => n + a.messages.length, 0)} message(s); ` +
    `coverage lists ${pack.workflowCopy?.coverage.length ?? 0} of the build`
);

// EVERY LEAK MUST CARRY A GRADE, and it is worth its own refusal rather than
// being left to the validator. The validator treats a missing grade as "inferred"
// on purpose — that is the right thing to do to a pack saved before Phase 1
// existed, and it means an UNGRADED fixture would quietly validate clean. But
// this fixture is the artifact verify-phase1 runs its inferred/disclosed A/B
// against, so an ungraded one would make those checks fail somewhere far away
// from the cause. Fail here, where the cause is.
const ungraded = (pack.intelligence?.leakAnalysis ?? []).filter((l) => !l.evidenceGrade);
if (ungraded.length) {
  console.error(
    `\nREFUSING TO WRITE — ${ungraded.length} leak(s) left the generator with no evidence grade: ` +
      `${ungraded.map((l) => l.leakName ?? l.area).join(", ")}. The grade is stamped by ` +
      `stampLeakAnalysis from the fired leak's own grade; if it is missing, the stamp broke.`
  );
  process.exit(1);
}

if (!verdict.ok || !rendered.ok) {
  console.error("\nREFUSING TO WRITE — the generated pack does not pass its own laws.");
  if (!verdict.ok) console.error(verdict.report);
  for (const v of rendered.violations) console.error(`  ${v}`);
  process.exit(1);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
// Trailing newline so the committed file is POSIX-clean and diffs on the last
// line read normally.
writeFileSync(OUT_PATH, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`\n✓ wrote ${OUT_PATH}`);
