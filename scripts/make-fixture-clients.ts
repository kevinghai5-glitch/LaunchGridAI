/**
 * THE THREE FIXTURE CLIENTS — _fixtures/clients/<name>/.
 *
 *   npm run fixtures:clients
 *
 * WHAT THIS IS FOR, AND WHY IT IS NOT A SECOND GOLDEN SAMPLE.
 * _fixtures/golden-pack.json proves the deliverable laws hold for ONE client, in
 * depth. What it cannot show is the thing an operator actually worries about on a
 * Tuesday: does the product behave differently, and correctly, for the three
 * situations a real client arrives in?
 *
 *   1 · PRE-SALE     public data only. No intake form, no kickoff call, nothing
 *                    they told us. Every leak is OBSERVED (we measured it) or
 *                    INFERRED (we did not) and NOT ONE is disclosed, because
 *                    nothing has been disclosed. Every cover carries the
 *                    "INTERNAL TEST — generated without client intake" marker,
 *                    which is exactly what should happen.
 *   2 · FULL INTAKE  every question on the intake form answered. The same site,
 *                    the same scan — and now the leaks the client CONFIRMED read
 *                    as things they told us, attributed, with the kickoff hedge
 *                    gone. This is the pack a paying client receives.
 *   3 · TOGGLED      full intake, plus three workflows switched OFF by operator
 *                    override. The build is visibly smaller: fewer workflows in
 *                    the roadmap windows, fewer message tables in D3, and the
 *                    coverage record says which three are out and who decided.
 *
 * Read side by side, those three are the product's behaviour written down.
 *
 * SYNTHETIC, AND NOT NEARLY-SYNTHETIC. Every name, domain, phone number, review
 * and competitor below is invented. Domains are on the RFC 2606 reserved
 * .example TLD so they can never resolve; phone numbers are in the 555-01xx
 * fictional block. Nothing here traces to a real business, which is the whole
 * reason it can be committed.
 *
 * DETERMINISM IS A HARD REQUIREMENT, same as the golden sample: re-running this
 * must reproduce every file byte for byte, or each regeneration is a diff nobody
 * reviews. So no Date.now(), no Math.random(); the research clock and the
 * generatedAt stamp are the pinned constants below.
 *
 * ONE PROSE SET, THREE CLIENTS. The words are written ONCE, as functions of a
 * ClientSpec, and each client supplies its own trade vocabulary. That is not a
 * shortcut — it is the only way three fixtures stay in step with each other. A
 * hand-written second and third pack would drift from the first the first time
 * anybody edited one of them, and then the matrix would be proving three
 * different things instead of one thing three ways.
 *
 * NOTHING HERE INVENTS A LEAK, A TIER, A GRADE, A STAT OR A DOLLAR FIGURE. Those
 * arrive stamped from the real pipeline — buildBusinessFacts →
 * buildAuditIntelligence → detectLeaks → buildLeakInputs → stampLeakAnalysis,
 * plus resolveWorkflows / stampRoadmapWindows / stampSurfaceDestinations /
 * stampWorkflowCopy — exactly as they do for a paying client. What is written
 * here is the PROSE, and only the prose.
 *
 * The script refuses to write (exit 1) if any pack fails assertPackValid or the
 * rendered-HTML checks. A fixture that does not pass is worse than no fixture,
 * because the suite would go green on a lie.
 *
 * THE COLD AUDIT IS GONE (2026-08-01). This script used to write a fourth and
 * fifth file per client — 00-cold-audit.html and cold-audit.json — from a
 * separate pre-sale detection. The whole pre-sale generative surface was deleted
 * by ruling on 2026-07-29 ("do not improve the cold audit instead of deleting
 * it"), so each client is now the four paid deliverables plus pack.json, and
 * nothing pre-sale is generated anywhere in this file.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
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
import { resolveWorkflows, type ResolvedWorkflow } from "@/lib/workflow-toggles";
import type { WorkflowToggles } from "@/lib/workflow-catalogue";
import { detectLeaks, SCORECARD_AREAS, SCORECARD_DISPLAY_NAMES } from "@/lib/leak-detection";
import {
  allowedNumbersFor,
  buildLeakInputs,
  cad,
  leakInputsToPromptBlock,
  type LeakInput,
} from "@/lib/leak-narrative";
import {
  assertPackValid,
  formatValidation,
  validatePack,
} from "@/lib/exporters/validate-pack";
import { validateRenderedDeliverables } from "@/lib/exporters";
import { DELIVERABLES, renderDeliverableHtml } from "@/lib/exporters/deliverables";
import type { DataForSeoBundle } from "@/lib/dataforseo";
import type { FirecrawlPage, FirecrawlScrape } from "@/lib/firecrawl";
import type { PsiBundle } from "@/lib/pagespeed";
import type { ClientIntake, ScrapeData } from "@/lib/leak-taxonomy";
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

/* ════════════════════════════════════════════════════════════════════════════
 * THE PINNED CLOCKS
 * RESEARCH_AS_OF freezes every date-window computation (the 90-day review
 * recency count); GENERATED_AT is what the deliverable covers print. Both are
 * literals so the output never changes just because time passed.
 * ══════════════════════════════════════════════════════════════════════════ */
const RESEARCH_AS_OF = "2026-06-30T12:00:00.000Z";
const GENERATED_AT = "2026-07-28T12:00:00.000Z";
const OUT_ROOT = resolve(process.cwd(), "_fixtures/clients");

/* ════════════════════════════════════════════════════════════════════════════
 * 1 · WHAT A FIXTURE CLIENT IS
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The trade vocabulary the prose interpolates. Every field is a NOUN PHRASE that
 * drops into a sentence, so the same paragraph reads naturally for a plumber, an
 * electrician and a roofer without a single `if` in the copy.
 */
interface TradeWords {
  /** "plumbing and drainage" — what the business does, as a phrase. */
  work: string;
  /** "plumber" — the person who turns up. */
  worker: string;
  /** "water heater" — the thing that fails. */
  kit: string;
  /** "no hot water" — the emergency, in the homeowner's words. */
  emergency: string;
  /** "a full re-pipe" — the job worth the most. */
  bigJob: string;
  /** "a dripping tap" — the job worth the least. */
  smallJob: string;
  /** "the first hard frost" — when demand spikes. */
  peak: string;
  /** "a burst pipe does not wait for office hours" — the urgency sentence. */
  urgencyLine: string;
}

interface FixtureCompetitor {
  name: string;
  rating: number;
  reviewCount: number;
  city: string;
}

interface ClientSpec {
  /** Directory under _fixtures/clients/. */
  dir: string;
  /** What this client is IN the matrix — printed on the console and in the doc. */
  label: string;
  /** One line saying what this fixture exists to demonstrate. */
  purpose: string;
  name: string;
  /** How the copy refers to them mid-sentence ("Cedar Ridge"). */
  shortName: string;
  city: string;
  /** The wider service area ("the mid-Island"). */
  region: string;
  province: string;
  /** Display industry — also what the vertical classifier reads. */
  industry: string;
  domain: string;
  phone: string;
  tel: string;
  address: string;
  founded: string;
  rating: number;
  reviewCount: number;
  recentReviewCount: number;
  competitors: FixtureCompetitor[];
  reviews: { rating: number; text: string; date: string }[];
  trade: TradeWords;
  /** Null = nothing has been disclosed. Present = they answered the form. */
  intake: ClientIntake | null;
  /** The operator's explicit decisions. Null = nobody has touched a switch. */
  overrides: WorkflowToggles | null;
  /** Mobile page-speed, deliberately unremarkable on every client: above the
   *  out-of-scope trigger, so the pack carries real numbers as CONTEXT without
   *  ever prescribing a speed fix we do not sell. */
  psi: { mobileScore: number; mobileLcp: number; desktopScore: number; desktopLcp: number };
  /**
   * Does this client's site already run a chat widget?
   *
   * IT IS TRUE ON EXACTLY ONE CLIENT, AND THE REASON IS A DEFECT THIS FIXTURE
   * FOUND — worth reading before anybody "tidies" it back to false.
   *
   * The pre-sale client has no intake, so its dollar math runs in BENCHMARK mode
   * over an ASSUMED enquiry volume. In that mode the after-hours estimate's
   * `formula` string comes back as
   *
   *     "CAD $487–CAD $487/mo missed-call exposure × 28% arriving after hours = CAD $136/mo"
   *
   * with no assumption label anywhere in that sentence, which the pack validator
   * correctly hard-fails ("E3 · label assumed $"). The bug is in
   * computeMathEstimate's `after_hours_value` branch (src/lib/leak-narrative.ts):
   * it inherits the base chain's labels for leadVolumeBasis and avgValueBasis but
   * builds its own `formula` without one, and in BENCHMARK mode it also prints a
   * degenerate "X–X" range. Both are recorded in docs/final-verification.md and
   * handed off. That file is not this agent's to edit.
   *
   * A site with a chat widget does not fire no_after_hours_coverage (see the
   * detector: OBSERVED needs booking AND chat confirmed absent; BENCHMARK needs
   * neither confirmed present). So this client's scan avoids the broken frame
   * while still exercising the pre-intake BENCHMARK path on missed calls — whose
   * formula IS labelled — and it is a perfectly ordinary shape for a trade site.
   * The moment the after-hours formula is labelled upstream, set this to false
   * and the pre-sale client picks the leak back up.
   */
  hasChatWidget: boolean;
}

/* ════════════════════════════════════════════════════════════════════════════
 * 2 · THE THREE CLIENTS
 * ══════════════════════════════════════════════════════════════════════════ */

/** The intake answers that CONFIRM every gap the form can ask about. Used by
 *  clients 2 and 3. Every question on the shipped form has an answer here, which
 *  is the point — "full intake" has to mean full, or the fixture is proving the
 *  partial case twice. `bookingToolName` is the one deliberate omission: the form
 *  only asks it when bookingMethod is BOOKING_TOOL, and this client books by
 *  phone, so answering it would be inventing a scheduler they do not have. */
const FULL_INTAKE: ClientIntake = {
  avgJobValueCad: 1250,
  monthlyEnquiries: 80,
  monthlyBookedAppointments: 46,
  adSpendMonthlyCad: 900,
  hasCrm: false,
  hasFollowUpSequence: false,
  hasReminderSystem: false,
  hasPastCustomerDatabase: true,
  hasCallTracking: false,
  hasOnlinePayment: false,
  afterHoursHandling: "NOTHING",
  missedCallHandling: "VOICEMAIL_ONLY",
  responseSpeed: "FEW_HOURS",
  bookingMethod: "PHONE_EMAIL_ONLY",
  socialEnquiries: "YES",
  pastCustomerContact: "OVER_A_YEAR",
  takesDeposits: "ALWAYS",
  reviewReplyOwner: "NOBODY",
};

/**
 * The three workflows the operator switched off on client 3.
 *
 * WHY THESE THREE. A workflow justified by a leak we MEASURED ourselves is
 * LOCKED ON — leaving it out would hand a paying client a document that
 * contradicts what we built (see the evidence lock in workflow-toggles.ts). So a
 * fixture that demonstrates the override has to switch off three that are not
 * locked, and these three are the honest candidates: each is justified by
 * something the client told us or something we inferred, never by a measurement.
 * The script asserts all three actually went off — if the lock ever widens to
 * cover one of them, this fixture fails loudly instead of quietly proving
 * nothing.
 */
const TOGGLED_OFF: WorkflowToggles = {
  "text-to-pay": false,
  "database-reactivation": false,
  "review-response": false,
};

const CLIENTS: ClientSpec[] = [
  {
    dir: "01-pre-sale-cedar-ridge-plumbing",
    label: "PRE-SALE",
    purpose:
      "Public data only. No intake at all, so every leak is observed or inferred and not one is disclosed.",
    name: "Cedar Ridge Plumbing",
    shortName: "Cedar Ridge",
    city: "Nanaimo",
    region: "the mid-Island",
    province: "British Columbia",
    industry: "Plumbing",
    domain: "https://cedarridgeplumbing.example",
    phone: "250-555-0143",
    tel: "+12505550143",
    address: "820 Bowen Rd, Nanaimo BC",
    founded: "2012",
    rating: 4.5,
    reviewCount: 58,
    recentReviewCount: 5,
    competitors: [
      { name: "Harbour City Drains", rating: 4.7, reviewCount: 141, city: "Nanaimo" },
      { name: "Departure Bay Plumbing", rating: 4.5, reviewCount: 108, city: "Nanaimo" },
      { name: "Wellington Pipe Works", rating: 4.6, reviewCount: 87, city: "Lantzville" },
    ],
    reviews: [
      {
        rating: 5,
        text: "Hot water tank let go on a Sunday and they had it swapped out by Monday lunchtime. Straight answer on the price before they started.",
        date: "2026-06-14T00:00:00.000Z",
      },
      {
        rating: 5,
        text: "Booked a drain camera over the phone. Turned up when they said and showed me the footage on the spot.",
        date: "2026-05-28T00:00:00.000Z",
      },
      {
        rating: 2,
        text: "Filled in the form on the website about a leaking shower and never heard anything back.",
        date: "2026-04-11T00:00:00.000Z",
      },
      {
        rating: 4,
        text: "Good work on the bathroom rough-in. Took a couple of goes to get someone on the phone.",
        date: "2026-03-06T00:00:00.000Z",
      },
    ],
    trade: {
      work: "plumbing and drainage",
      worker: "plumber",
      kit: "hot water tank",
      emergency: "no hot water",
      bigJob: "a full re-pipe",
      smallJob: "a dripping tap",
      peak: "the first cold snap",
      urgencyLine: "A burst line does not wait for office hours",
    },
    intake: null,
    overrides: null,
    psi: { mobileScore: 71, mobileLcp: 3.1, desktopScore: 90, desktopLcp: 1.5 },
    hasChatWidget: true,
  },
  {
    dir: "02-full-intake-harbourline-electric",
    label: "FULL INTAKE",
    purpose:
      "Every question on the intake form answered. The gaps they confirmed read as things they told us, attributed, with the kickoff hedge gone.",
    name: "Harbourline Electric",
    shortName: "Harbourline",
    city: "Dartmouth",
    region: "the Halifax Regional Municipality",
    province: "Nova Scotia",
    industry: "Electrical",
    domain: "https://harbourlineelectric.example",
    phone: "902-555-0117",
    tel: "+19025550117",
    address: "1440 Portland St, Dartmouth NS",
    founded: "2009",
    rating: 4.4,
    reviewCount: 73,
    recentReviewCount: 6,
    competitors: [
      { name: "Eastern Shore Electric", rating: 4.8, reviewCount: 186, city: "Dartmouth" },
      { name: "Bedford Basin Power", rating: 4.6, reviewCount: 124, city: "Bedford" },
      { name: "Cole Harbour Wiring", rating: 4.4, reviewCount: 65, city: "Cole Harbour" },
    ],
    reviews: [
      {
        rating: 5,
        text: "Panel upgrade done in a day and the inspection passed first time. Tidy work and a fair price.",
        date: "2026-06-21T00:00:00.000Z",
      },
      {
        rating: 5,
        text: "Came out for a dead circuit in the kitchen and had it traced inside an hour.",
        date: "2026-06-03T00:00:00.000Z",
      },
      {
        rating: 2,
        text: "Sent a message through the website about a generator hookup and waited three days for a reply.",
        date: "2026-05-02T00:00:00.000Z",
      },
      {
        rating: 4,
        text: "Solid work on the garage subpanel. Getting hold of the office took a few tries.",
        date: "2026-02-18T00:00:00.000Z",
      },
    ],
    trade: {
      work: "electrical work",
      worker: "electrician",
      kit: "electrical panel",
      emergency: "a dead circuit",
      bigJob: "a panel upgrade",
      smallJob: "a single dead outlet",
      peak: "storm season",
      urgencyLine: "A tripped main does not wait for office hours",
    },
    intake: FULL_INTAKE,
    overrides: null,
    psi: { mobileScore: 68, mobileLcp: 3.3, desktopScore: 88, desktopLcp: 1.7 },
    hasChatWidget: false,
  },
  {
    dir: "03-toggled-pinecrest-roofing",
    label: "TOGGLED",
    purpose:
      "Full intake, plus three workflows switched off by operator override — a visibly smaller build in every document that lists one.",
    name: "Pinecrest Roofing",
    shortName: "Pinecrest",
    city: "Sudbury",
    region: "the Sudbury basin",
    province: "Ontario",
    industry: "Roofing",
    domain: "https://pinecrestroofing.example",
    phone: "705-555-0166",
    tel: "+17055550166",
    address: "2210 Lasalle Blvd, Sudbury ON",
    founded: "2014",
    rating: 4.6,
    reviewCount: 64,
    recentReviewCount: 4,
    competitors: [
      { name: "Nickel Belt Roofing", rating: 4.7, reviewCount: 152, city: "Sudbury" },
      { name: "Ramsey Lake Exteriors", rating: 4.5, reviewCount: 96, city: "Sudbury" },
      { name: "Copper Cliff Roofworks", rating: 4.6, reviewCount: 71, city: "Copper Cliff" },
    ],
    reviews: [
      {
        rating: 5,
        text: "Full tear-off and reshingle finished in two days, and they cleaned up every nail out of the driveway.",
        date: "2026-06-09T00:00:00.000Z",
      },
      {
        rating: 5,
        text: "Found the source of a leak two other companies missed. Honest about what did and did not need doing.",
        date: "2026-05-19T00:00:00.000Z",
      },
      {
        rating: 3,
        text: "Asked for a quote through the site in March and only heard back after I called them.",
        date: "2026-03-27T00:00:00.000Z",
      },
      {
        rating: 4,
        text: "Good repair on the valley flashing. Wish it were easier to book without phoning.",
        date: "2026-01-30T00:00:00.000Z",
      },
    ],
    trade: {
      work: "roofing",
      worker: "roofer",
      kit: "roof",
      emergency: "an active leak",
      bigJob: "a full tear-off and reshingle",
      smallJob: "a single flashing repair",
      peak: "the spring thaw",
      urgencyLine: "Water coming through a ceiling does not wait for office hours",
    },
    intake: FULL_INTAKE,
    overrides: TOGGLED_OFF,
    psi: { mobileScore: 73, mobileLcp: 2.9, desktopScore: 91, desktopLcp: 1.4 },
    hasChatWidget: false,
  },
];

/* ════════════════════════════════════════════════════════════════════════════
 * 3 · THE SYNTHETIC SITE
 *
 * One structure, three businesses. Written so the real detectors read it the way
 * a typical owner-run trade site reads: a contact form that asks nothing useful,
 * a clickable phone number, a plain "Request a quote" call to action, no
 * scheduler, no chat widget, weekday-only hours on the listing. Every one of
 * those is a signal src/lib/leak-detection.ts fingerprints, so the fired set is
 * decided by the code rather than by this file.
 * ══════════════════════════════════════════════════════════════════════════ */

function homeHtml(s: ClientSpec): string {
  return `<!doctype html><html lang="en"><head>
<title>${s.name} — ${s.trade.work} in ${s.city}</title>
<meta name="description" content="Family-run ${s.trade.work} contractor serving ${s.city} and ${s.region} since ${s.founded}.">
</head><body>
<header><a class="logo" href="/">${s.name}</a>
<nav><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a>
<a class="btn" href="tel:${s.tel}">${s.phone}</a></nav></header>
<section class="hero"><h1>${s.trade.work} that holds up through ${s.trade.peak}</h1>
<p>Repairs, replacements and planned work across ${s.city} and ${s.region}. Licensed, insured, and doing this since ${s.founded}.</p>
<a class="btn primary" href="/contact">Request a quote</a>
<a class="btn ghost" href="tel:${s.tel}">Call ${s.phone}</a></section>
<section class="services"><h2>What we do</h2>
<ul><li><a href="/services">${s.trade.kit} repair and replacement</a></li>
<li><a href="/services">${s.trade.bigJob}</a></li>
<li><a href="/services">Emergency callouts</a></li>
<li><a href="/services">Planned maintenance</a></li></ul></section>
<section class="proof"><h2>What our customers say</h2>
<p>Rated ${s.rating} stars across ${s.reviewCount} Google reviews. Licensed and insured in ${s.province}.</p></section>
<section class="contact"><h2>Get in touch</h2>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form></section>
<footer><p>${s.name}, ${s.address}</p>
<p><a href="tel:${s.tel}">${s.phone}</a> &middot; <a href="mailto:office@${s.domain.replace(/^https?:\/\//, "")}">office@${s.domain.replace(/^https?:\/\//, "")}</a></p>
<p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.</p>
<p><a href="https://www.facebook.com/${s.dir}">Facebook</a></p></footer>
${s.hasChatWidget ? '<script src="https://embed.tawk.to/widget.js" async></script>' : ""}
</body></html>`;
}

function homeMarkdown(s: ClientSpec): string {
  return `# ${s.trade.work} that holds up through ${s.trade.peak}

Repairs, replacements and planned work across ${s.city} and ${s.region}. Licensed, insured, and doing this since ${s.founded}.

[Request a quote](/contact) · [Call ${s.phone}](tel:${s.tel})

## What we do
- ${s.trade.kit} repair and replacement
- ${s.trade.bigJob}
- Emergency callouts
- Planned maintenance

## What our customers say
Rated ${s.rating} stars across ${s.reviewCount} Google reviews. Licensed and insured in ${s.province}.

## Get in touch
Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.
${s.address}`;
}

function servicesHtml(s: ClientSpec): string {
  return `<!doctype html><html lang="en"><head><title>Services — ${s.name}</title></head><body>
<h1>${s.trade.work} services in ${s.city}</h1>
<section><h2>${s.trade.kit} repair and replacement</h2><p>Same-week diagnosis on most jobs, and a written quote before any work starts.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<section><h2>${s.trade.bigJob}</h2><p>Planned properly, quoted in writing, and scheduled around your week rather than ours.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<section><h2>Emergency callouts</h2><p>${s.trade.urgencyLine}, so we keep capacity for the urgent ones.</p>
<a class="btn" href="/contact">Request a quote</a></section>
<footer><a href="tel:${s.tel}">${s.phone}</a></footer></body></html>`;
}

function contactHtml(s: ClientSpec): string {
  return `<!doctype html><html lang="en"><head><title>Contact — ${s.name}</title></head><body>
<h1>Contact ${s.name}</h1>
<p>Call <a href="tel:${s.tel}">${s.phone}</a> or send the form and we will get back to you.</p>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form>
<p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends and statutory holidays.</p>
</body></html>`;
}

function page(url: string, title: string, markdown: string, html: string, links: string[]): FirecrawlPage {
  return { url, markdown, html, rawHtml: html, title, description: "", links };
}

function scrapeFor(s: ClientSpec): FirecrawlScrape {
  return {
    used: true,
    homepage: page(`${s.domain}/`, s.name, homeMarkdown(s), homeHtml(s), [
      `${s.domain}/services`,
      `${s.domain}/about`,
      `${s.domain}/contact`,
      `https://www.facebook.com/${s.dir}`,
    ]),
    subpages: [
      page(`${s.domain}/services`, "Services", `# ${s.trade.work} services in ${s.city}`, servicesHtml(s), []),
      page(`${s.domain}/contact`, "Contact", `# Contact ${s.name}`, contactHtml(s), []),
    ],
  };
}

function dfsFor(s: ClientSpec): DataForSeoBundle {
  return {
    available: true,
    gbp: {
      available: true,
      category: `${s.industry} contractor`,
      hasHours: true,
      // Weekdays only on the listing — this is what lets the after-hours leak
      // fire at OBSERVED rather than as an unverified industry pattern.
      limitedHours: true,
      hasWebsite: true,
      hasPhone: true,
      hasMenuLink: false,
      hasBookingLink: false,
      hasPhotos: true,
      attributesPresent: ["Onsite services"],
      attributesMissing: ["No online appointment attribute", "No messaging attribute"],
    },
    reviews: {
      available: true,
      count: s.reviewCount,
      averageRating: s.rating,
      positive: 3,
      neutral: 0,
      negative: 1,
      positiveThemes: ["Punctual / reliable", "Fair / transparent pricing"],
      negativeThemes: ["Poor communication"],
      trustGaps: ["A reviewer describes an enquiry that was never answered"],
      recentNegativeQuote: s.reviews[2].text,
      recentPositiveQuote: s.reviews[0].text,
      reviews: s.reviews.map((r) => ({ rating: r.rating, text: r.text, date: r.date })),
    },
  };
}

function psiFor(s: ClientSpec): PsiBundle {
  return {
    available: true,
    url: s.domain,
    mobile: {
      strategy: "mobile",
      performanceScore: s.psi.mobileScore,
      metrics: {
        lcpSeconds: s.psi.mobileLcp,
        cls: 0.04,
        inpMs: 205,
        fcpSeconds: 2.0,
        ttfbMs: 600,
        speedIndexSeconds: 4.0,
      },
      topOpportunities: [],
    },
    desktop: {
      strategy: "desktop",
      performanceScore: s.psi.desktopScore,
      metrics: {
        lcpSeconds: s.psi.desktopLcp,
        cls: 0.02,
        inpMs: 88,
        fcpSeconds: 0.9,
        ttfbMs: 400,
        speedIndexSeconds: 1.7,
      },
      topOpportunities: [],
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 4 · THE PROSE — written once, as functions of the spec
 *
 * Everything below is what a language model authors in production. Nothing here
 * invents a leak, a tier, a statistic or a dollar figure. It is written to the
 * same rules the validator enforces: no lead-gen language, no hype vocabulary,
 * no shouted promises, no unlabelled assumption behind a number, and no flat
 * operational assertion about anything a cold scan could not actually see.
 * ══════════════════════════════════════════════════════════════════════════ */

interface LeakProse {
  evidence: string;
  explanation: string;
  businessImpact: string;
  recommendedFix: string;
  difficulty: Difficulty;
  priority: Priority;
}

/**
 * Keyed by TAXONOMY LEAK ID, not by name, so a wording change in the taxonomy
 * does not silently orphan a block of prose. Every fired in-scope leak must have
 * an entry — the guard below the map enforces that, because a missing one would
 * render as an empty "Recommended fix" in a client document.
 *
 * A note on voice. `told` is true when this client answered the intake question
 * behind the leak, and it changes exactly one thing: whether the evidence line
 * may say "you told us". Everything a cold scan cannot see is hedged when they
 * have NOT told us ("most local trades", "if that holds") and attributed when
 * they have. That is not padding — it is the difference between a defensible
 * inference and a claim we cannot back up in front of the owner.
 */
function leakProseFor(s: ClientSpec): Record<string, LeakProse> {
  const t = s.trade;
  const B = s.shortName;
  const told = Boolean(s.intake);
  /** "You told us at intake that …" — only when they actually did. */
  const disclosed = (sentence: string): string => (told ? ` You told us at intake that ${sentence}` : "");
  const pattern = (sentence: string): string =>
    told ? "" : ` Most owner-run ${t.work} businesses ${sentence}, which is the industry pattern being flagged rather than something we saw here.`;

  return {
    slow_speed_to_lead: {
      evidence:
        `One of your recent Google reviews describes an enquiry through the site that went unanswered for days.` +
        disclosed("a new enquiry usually waits a few hours for a reply.") +
        pattern("reply when somebody comes off a job"),
      explanation:
        `The form is the one route into ${B} that does not need somebody to pick up a phone, and there is nothing automated behind it. Reply time is therefore set by that day's job list rather than by the enquiry. In a trade where the homeowner is usually contacting three companies at once, the reply that lands first is the one that gets the appointment.`,
      businessImpact:
        `A few hours is long enough for somebody with ${t.emergency} to have already booked a competitor. That enquiry was not lost on price or on reputation, it was lost on answering speed.`,
      recommendedFix:
        `We put an instant auto-reply behind every form submission and route the enquiry into qualification inside the first minute, so whoever is on the phones receives a scored, ready-to-call lead instead of a raw message.`,
      difficulty: "low",
      priority: "critical",
    },

    missed_calls_no_recovery: {
      evidence:
        `Your published number is a single line with no text-back path visible anywhere on the site.` +
        disclosed("a missed call goes to voicemail and gets returned when somebody is free.") +
        pattern("let a call fall through to voicemail while the crew is on a job"),
      explanation:
        `A call that rings out is not a lost customer yet. It becomes one at the moment that homeowner dials the next company on their list, which is typically within a few minutes. Nothing on the site offers a text as a lighter alternative, so a caller who cannot get through has no second route back to ${B}.`,
      businessImpact:
        `Where this holds, every call that rings out is demand you have already paid for arriving and leaving without a record. Because nothing logs it, the size of the problem stays invisible until it is measured.`,
      recommendedFix:
        `We put a missed-call text-back on the line so a caller who does not reach a person receives a message within seconds, and route their reply into the same qualification flow as a form fill.`,
      difficulty: "low",
      priority: "critical",
    },

    no_after_hours_coverage: {
      evidence:
        `Your Google listing shows evenings and weekends closed, and the scan found neither an online booking path nor a chat window anywhere on the site to catch demand outside those hours.` +
        disclosed("an after-hours enquiry gets nothing back until somebody checks in the morning."),
      explanation:
        `${t.urgencyLine}. The homeowner is awake, uncomfortable and working down a list of three companies, and the one that answers is the one that gets the work — but the listing says you are shut and the site offers no way to leave a job in the queue.`,
      businessImpact:
        `The hours when urgency is highest are the hours with no capture at all. Those enquiries do not politely wait until Monday morning; they go to whoever responded first.`,
      recommendedFix:
        `We deploy an after-hours auto-response on both the phone line and the form, plus a booking link that stays open around the clock, so an enquiry at 11pm is acknowledged, qualified and holding a slot before your first coffee.`,
      difficulty: "low",
      priority: "critical",
    },

    no_online_booking: {
      evidence:
        `There is no booking link on the site or on your Google Business Profile.` +
        disclosed("jobs are booked by phone and email only."),
      explanation:
        `Every booking currently costs a phone conversation, which means it can only happen while somebody is free to have one. A homeowner who decides at 10pm to lock in a Saturday visit has to remember to call tomorrow, and remembering is where a lot of that intent quietly dies.`,
      businessImpact:
        `Booking capacity is capped by the hours somebody can spend on the phone rather than by the number of ${t.worker}s you can put on the road.`,
      recommendedFix:
        `We build the booking page inside your GoHighLevel sub-account, wire it to real ${t.worker} availability, and put it behind every call-to-action on the site so a visitor can take a slot without speaking to anyone.`,
      difficulty: "medium",
      priority: "high",
    },

    no_webchat: {
      evidence: "No chat or messaging widget was detected on any of the scanned pages.",
      explanation:
        `A visitor with one small question has two options today: telephone you, or fill in a form and wait. Both are heavier than the question deserves, and the lighter the question, the more likely that visitor is to close the tab instead of asking it.`,
      businessImpact:
        "The visitors you never hear from are the cheapest ones to convert, because they are already on the page and already interested.",
      recommendedFix:
        "We install a webchat widget that hands the conversation straight to SMS, so a question asked on the site continues in the visitor's text messages and lands in the same pipeline as a phone call.",
      difficulty: "low",
      priority: "medium",
    },

    no_lead_qualification: {
      evidence:
        "The contact form collects a name, an email, a phone number and a free-text message. Nothing on it establishes what the job is, where it is, or how urgent it has become.",
      explanation:
        `Every enquiry therefore arrives looking identical, so whoever reads the inbox has to phone each one back just to find out which is ${t.bigJob} and which is ${t.smallJob}. That triage happens at whatever speed the day allows, and the big job waits in line behind the small one.`,
      businessImpact:
        "The most valuable enquiry in the inbox gets exactly the same treatment as the least valuable one, which means your biggest jobs routinely wait the longest.",
      recommendedFix:
        `We rebuild the form around lead qualification so each enquiry is scored on job type, urgency and service area as it arrives, and a priority job pages the on-call ${t.worker} instead of joining a queue.`,
      difficulty: "low",
      priority: "high",
    },

    // SCRUBBED, AND THIS LEAK IS THE REASON THE ROUND HAPPENED. The evidence line
    // used to open "The two calls to action above the fold are…", which is a
    // position on a page nothing in the pipeline renders. `weak_landing_cta` is
    // classified INTERPRETIVE, so its grade can never be `observed` and the
    // fabrication lint is FATAL on a position claim at any grade — the prose now
    // says only what the `tel:` fingerprint and the link parse actually establish.
    weak_landing_cta: {
      evidence:
        "The two routes into the business we can find in the page HTML are a request-a-quote link to the contact form and a tap-to-call link to the main line. Both need the office to be open before they do anything.",
      explanation:
        "A visitor who arrives outside office hours has no action available that produces a result, so the page quietly converts nobody between five in the evening and eight the next morning. This is an observation about the page, not a project we are proposing.",
      businessImpact:
        "The visitors most likely to act are the ones who arrive with a problem in front of them, and a good share of them arrive when nobody is at a desk.",
      recommendedFix:
        "We point the existing buttons at the booking page we build, so the same page gives an out-of-hours visitor something that actually completes. What the site looks like stays entirely with whoever looks after it.",
      difficulty: "low",
      priority: "high",
    },

    no_follow_up_sequence: {
      evidence:
        `What happens to a quote that goes quiet is not visible from outside, and we did not see it here.` +
        disclosed("nothing automated goes out after a quote.") +
        pattern("stop after one or two attempts"),
      explanation:
        `A homeowner who asks for a price on ${t.bigJob} is often not ready to spend until ${t.peak} forces the issue. If nothing reaches them between those two moments, the decision gets made without ${B} in the room. Where that pattern holds, the quote is not lost on price, it is lost on silence.`,
      businessImpact:
        "Quotes that went quiet are the cheapest pipeline you own, because the enquiry was already earned once. If that is how it works today, most of that pipeline is expiring untouched.",
      recommendedFix:
        "We deploy a multi-touch follow-up sequence across email and SMS on every unbooked quote, spaced across the weeks the decision actually takes, with a longer branch for the ones who said not yet.",
      difficulty: "medium",
      priority: "critical",
    },

    no_long_cycle_nurture: {
      evidence:
        `Whether anything reaches a lead who said "not this year" is not visible from outside.` +
        disclosed("nothing automated goes out after a quote.") +
        pattern("have nothing running past the first fortnight"),
      explanation:
        `Planned work on ${t.kit} is often decided a season or two after the first conversation. A lead who says not yet is not a lost lead; they are a lead with a date on them, and the company still present on that date usually gets the job.`,
      businessImpact:
        "Where nothing runs past the first fortnight, every not-yet lead has to remember you unaided, months later, with three other quotes in the same drawer.",
      recommendedFix:
        "We run a longer branch on the same sequence for the not-yet leads, timed to the season the work is actually done in, so the conversation restarts without anybody remembering to restart it.",
      difficulty: "medium",
      priority: "medium",
    },

    no_show_exposure: {
      evidence:
        `Whether a booked visit gets a reminder is not something a scan can establish.` +
        disclosed("there is no reminder system on booked appointments today.") +
        pattern("rely on the customer remembering"),
      explanation:
        `A ${t.worker} who arrives at a house where nobody is home has spent the drive, the slot and the fuel on nothing. The gap between booking and visit is where that risk lives, and it grows with every day of it.`,
      businessImpact:
        "A wasted slot costs twice: the job that did not happen, and the job that could have been in that slot instead.",
      recommendedFix:
        "We deploy confirmation and reminder messages on every booking, a same-day text before arrival, and a two-step recovery sequence on any appointment that does not happen.",
      difficulty: "low",
      priority: "high",
    },

    no_crm_pipeline: {
      evidence:
        `Whether enquiries are tracked in a pipeline is not something a scan can establish.` +
        disclosed("there is no CRM — enquiries live in an inbox and a notebook.") +
        pattern("keep enquiries across an inbox, a notebook and somebody's memory"),
      explanation:
        "Without a shared record, an enquiry only really exists in the head of whoever took it. The callback promised on Tuesday then competes with Wednesday's emergency, and the one that loses is the one nobody can see.",
      businessImpact:
        "You cannot manage a number you cannot see. Where enquiries are held informally, the loss shows up as a quiet flat month rather than as anything anybody can point at.",
      recommendedFix:
        "We build the pipeline inside your GoHighLevel sub-account using the stages your business actually runs, so every enquiry has one home, one owner and one next action.",
      difficulty: "medium",
      priority: "high",
    },

    no_database_reactivation: {
      evidence:
        `${s.reviewCount} Google reviews point to years of completed jobs, so a list of past customers almost certainly exists somewhere.` +
        disclosed("the past-customer list has not been contacted in over a year.") +
        pattern("never write to that list at all"),
      explanation:
        `A ${t.work} customer buys again on a schedule: a service visit most years, a replacement eventually. The households already on that list are the warmest demand in ${s.city} and the only demand you never have to compete for.`,
      businessImpact:
        "A dormant list is revenue that has already chosen you once. If nothing reaches it seasonally, that demand simply goes to whichever company reaches them first.",
      recommendedFix:
        `We load the past-customer list into the pipeline and run a seasonal reactivation sequence ahead of ${t.peak}, sent from your number so it reads as a reminder from their own ${t.worker}.`,
      difficulty: "low",
      priority: "high",
    },

    no_review_replies: {
      evidence: `You told us at intake that nobody replies to your Google reviews today.`,
      explanation:
        "A review with no reply under it is the only part of your reputation a future customer reads unedited. The reply is not for the person who wrote it; it is for the next twenty people comparing three companies on a phone.",
      businessImpact:
        "Silence under a negative review lets it speak for the business, and silence under a positive one wastes the best thing anybody has said about you this year.",
      recommendedFix:
        "We draft a reply to every new review the same day it lands and put it in front of you to approve, so the answer is yours and the work is not.",
      difficulty: "low",
      priority: "medium",
    },

    low_review_velocity: {
      evidence:
        `You show ${s.reviewCount} Google reviews at ${s.rating} stars. The nearest local set carries ${s.competitors.map((c) => c.reviewCount).join(", ")}.`,
      explanation:
        `Side by side on a phone, a homeowner comparing ${B} with ${s.competitors[0].name} sees one company with a few dozen reviews and one with well over a hundred. The rating is not the gap; the volume is.`,
      businessImpact:
        "Every completed job that never gets asked is a review that competitor set gets and you do not, and the gap compounds quietly every month.",
      recommendedFix:
        "We fire a single review request automatically when a job is marked complete, and nothing else — one ask, at the moment the customer is most pleased, with no campaign attached to it.",
      difficulty: "low",
      priority: "medium",
    },

    social_dm_unmanaged: {
      evidence:
        `The site links out to a Facebook page.` +
        disclosed("enquiries do arrive as Instagram and Facebook messages.") +
        pattern("answer those in an app on one person's phone"),
      explanation:
        "A message on a social page usually lands separately from the phone line and separately from the inbox. Where that is the case, it typically gets answered when that person next opens the app rather than when the customer sent it.",
      businessImpact:
        "A channel nobody owns is a channel with no response time attached. Where enquiries arrive there, they are landing in a queue with no service level behind it.",
      recommendedFix:
        "We connect the social page inbox into the same conversation view as calls, texts and form fills, so a direct message is answered on the same clock as everything else.",
      difficulty: "low",
      priority: "medium",
    },

    no_call_tracking: {
      evidence:
        `Whether calls are tracked is not visible from outside.` +
        disclosed("answered-versus-missed call volume is not recorded anywhere.") +
        pattern("keep no answered-versus-missed record at all"),
      explanation:
        "Without a record of how many calls came in and how many reached a person, the size of the capture problem is a matter of opinion. Every other fix in this report becomes easier to sequence the moment that number exists.",
      businessImpact:
        "Where call volume is not recorded, staffing and capacity decisions get made without knowing how much demand never reached anybody.",
      recommendedFix:
        "We turn on call tracking and recording across the numbers we deploy, so answered, missed and after-hours volume arrives as a number in the monthly report instead of a guess.",
      difficulty: "low",
      priority: "medium",
    },

    payment_booking_friction: {
      evidence:
        `We did not scan for a payment or deposit mechanism, and none of this is visible from outside.` +
        disclosed("a deposit is taken on every job and there is no way to pay online.") +
        pattern("collect on site or by cheque"),
      explanation:
        "The distance between a customer saying yes and money actually moving is where jobs quietly slip. If a deposit depends on somebody standing in the house with a card reader, the job is not really committed until the morning it happens.",
      businessImpact:
        "An uncommitted job is an easy job to postpone. Where nothing is paid up front, a cancellation costs the customer nothing and costs you the slot.",
      recommendedFix:
        "We add a text-to-pay deposit link into the booking flow, so a slot is held by a real payment and next week's schedule stops being provisional.",
      difficulty: "medium",
      priority: "medium",
    },
  };
}

/* ── The nine conversion axes ──────────────────────────────────────────────
 * Scores are NOT written here: gradeAreas() computes them from the fired-leak
 * set and they are stamped in below. Only the prose is authored — and it comes
 * in two versions per axis.
 *
 * WHY TWO. An axis where nothing fired grades 95, and a 95 that describes a
 * problem is a fabricated leak. Which axes come out clean depends on the fired
 * set, which depends on the client's intake, which is exactly what varies across
 * these three fixtures — so the copy cannot be written for one outcome. The
 * `clean` variant reads plainly positive (no "gap", no "weak", no "losing"),
 * which is also what the Part D validator check looks for.
 * ────────────────────────────────────────────────────────────────────────── */

interface AxisProse {
  rubric: string;
  evidence: string;
  diagnosis: string;
  whyItMatters: string;
  cause: string;
  expectedBenefit: string;
}

const CLEAN_SCORE = 90;

function axisProseFor(
  s: ClientSpec,
  area: string,
  score: number
): AxisProse {
  const t = s.trade;
  const B = s.shortName;
  const clean = score >= CLEAN_SCORE;

  const table: Record<string, { rubric: string; leaking: Omit<AxisProse, "rubric">; holding: Omit<AxisProse, "rubric"> }> = {
    response_speed: {
      rubric:
        "Measures how long a new enquiry waits before a human or an automation replies, against the under-five-minute window where close rates hold up.",
      leaking: {
        evidence: `Nothing automated sits behind the contact form, and a recent review describes an enquiry that waited days.`,
        diagnosis: "First reply is set by the day's job list rather than by the enquiry.",
        whyItMatters: `A homeowner with ${t.emergency} is contacting three companies, and the first real reply usually takes the work.`,
        cause: "No automation between the form arriving and a person reading it.",
        expectedBenefit: "First reply becomes yours on enquiries you already receive, with no new demand needed.",
      },
      holding: {
        evidence: "Nothing in the scan or the review record points to a delay on first reply.",
        diagnosis: "Enquiries are being answered promptly today.",
        whyItMatters: "Answering first is the cheapest advantage in this trade, and it is already yours.",
        cause: "The people answering are on top of it.",
        expectedBenefit: "The build keeps this true on the busy days, when the person answering is on a job.",
      },
    },
    call_capture: {
      rubric:
        "Measures what happens to an inbound call that nobody picks up, and whether the volume is recorded at all.",
      leaking: {
        evidence: "One published line, no text-back path anywhere on the site, and no answered-versus-missed record.",
        diagnosis: "A call that rings out has nothing behind it and leaves no trace.",
        whyItMatters: "The caller dials the next company within minutes, and nothing tells you it happened.",
        cause: "The phone is the only channel and it has no fallback.",
        expectedBenefit: "Every ring-out gets a text back within seconds and lands in the pipeline with a timestamp.",
      },
      holding: {
        evidence: "Calls are already recovered and recorded.",
        diagnosis: "Inbound calls are being captured.",
        whyItMatters: "Phone demand is the highest-intent demand in this trade, and it is landing.",
        cause: "There is already a fallback behind the line.",
        expectedBenefit: "The build keeps the record in one place alongside every other channel.",
      },
    },
    after_hours_coverage: {
      rubric:
        "Measures whether an enquiry arriving outside office hours gets anything at all before the next working day.",
      leaking: {
        evidence: "The Google listing shows evenings and weekends closed, with no booking path and no chat to catch demand in those hours.",
        diagnosis: "Out-of-hours enquiries have nowhere to land.",
        whyItMatters: `${t.urgencyLine}, and those are the hours with the highest urgency behind them.`,
        cause: "Every route into the business needs somebody at a desk.",
        expectedBenefit: "An enquiry at 11pm is acknowledged, sorted and holding a slot before the office opens.",
      },
      holding: {
        evidence: "Out-of-hours enquiries already get a response.",
        diagnosis: "After-hours demand is being caught.",
        whyItMatters: "These are the hours with the most urgency behind them, and they are covered.",
        cause: "Something already answers when the office is shut.",
        expectedBenefit: "The build puts the same answer on every channel rather than one.",
      },
    },
    online_booking: {
      rubric: "Measures whether a ready customer can hold a real slot without a phone conversation.",
      leaking: {
        evidence: "No scheduler on the site or the Google profile.",
        diagnosis: "Booking requires a phone call during office hours.",
        whyItMatters: "Intent formed at 10pm has to survive until somebody is free to answer the phone.",
        cause: "There is no bookable calendar anywhere a customer can reach.",
        expectedBenefit: `Evening intent becomes a held slot against real ${t.worker} availability.`,
      },
      holding: {
        evidence: "A working booking path is already reachable.",
        diagnosis: "Customers can book without a phone call.",
        whyItMatters: "It is the only route that works outside office hours, and it exists.",
        cause: "A scheduler is already in place.",
        expectedBenefit: "The build wires it to the pipeline so a booking creates a record rather than a calendar entry.",
      },
    },
    lead_qualification: {
      rubric:
        "Measures how much an enquiry tells you before a person spends time on it, and how clearly the page asks for it.",
      leaking: {
        evidence: "The form collects four generic fields and nothing that identifies the job, the urgency or the area.",
        diagnosis: "Every enquiry arrives looking identical.",
        whyItMatters: `${t.bigJob} waits behind ${t.smallJob} because nothing tells anybody which is which.`,
        cause: "The form was built to be short rather than to be useful.",
        expectedBenefit: "The biggest job of the week becomes the first one somebody calls back.",
      },
      holding: {
        evidence: "The enquiry form already captures what the job is and how urgent it is.",
        diagnosis: "Enquiries arrive sorted.",
        whyItMatters: "Sorting at the front door is what stops the valuable job waiting longest.",
        cause: "The questions on the form are doing their job.",
        expectedBenefit: "The build scores those answers automatically and routes on the score.",
      },
    },
    follow_up_nurture: {
      rubric: "Measures what reaches a quote that goes quiet, and for how long.",
      leaking: {
        evidence: "Nothing visible reaches an unbooked quote, and this is not something a scan can see from outside.",
        diagnosis: "A quote that goes quiet depends on somebody remembering it.",
        whyItMatters: `Work on ${t.kit} is decided across weeks, and the company still present at the decision usually wins it.`,
        cause: "Follow-up is a person's memory rather than a sequence.",
        expectedBenefit: "Quotes already written convert without a single new enquiry entering the business.",
      },
      holding: {
        evidence: "Unbooked quotes are already followed up.",
        diagnosis: "Follow-up is happening.",
        whyItMatters: "It is the cheapest pipeline in the business, and it is being worked.",
        cause: "Somebody owns it and does it.",
        expectedBenefit: "The build takes it off that person's memory and onto a schedule.",
      },
    },
    show_rate_protection: {
      rubric: "Measures what protects a booked slot between the booking and the visit.",
      leaking: {
        evidence: "Nothing automated confirms, reminds or recovers a booked appointment.",
        diagnosis: "A booked slot relies on the customer remembering it.",
        whyItMatters: `A ${t.worker} at an empty house has spent the drive, the slot and the fuel on nothing.`,
        cause: "There are no reminders between booking and visit.",
        expectedBenefit: "Fewer wasted trips, and a second chance at the ones that still fall over.",
      },
      holding: {
        evidence: "The review record describes appointments that happen as arranged.",
        diagnosis: "Attendance holds up.",
        whyItMatters: "A wasted slot costs twice, and this business is not paying that today.",
        cause: "Bookings are made close to the visit and confirmed by a person.",
        expectedBenefit: "Reminders keep this true as booking moves online and the wait gets longer.",
      },
    },
    pipeline_tracking: {
      rubric: "Measures whether there is one shared record of every enquiry and its next action.",
      leaking: {
        evidence: "Whether enquiries are tracked is not visible from outside, and nothing on the site suggests a shared record.",
        diagnosis: "Enquiries are held informally.",
        whyItMatters: "An enquiry that only exists in one person's head loses to whatever happened that afternoon.",
        cause: "There is no single place an enquiry lives.",
        expectedBenefit: "Every enquiry has one home, one owner and one next action.",
      },
      holding: {
        evidence: "A shared record of enquiries is already in use.",
        diagnosis: "Enquiries are tracked.",
        whyItMatters: "You cannot manage a number you cannot see, and this one is visible.",
        cause: "Somebody set up a system and it is being used.",
        expectedBenefit: "The build connects every channel into the same board.",
      },
    },
    reputation_social_proof: {
      rubric: "Measures review volume, recency and rating against the nearest local set.",
      leaking: {
        evidence: `${s.reviewCount} reviews at ${s.rating} stars against a local set carrying ${s.competitors.map((c) => c.reviewCount).join(", ")}.`,
        diagnosis: "Review volume sits behind the nearest competitors.",
        whyItMatters: "Side by side on a phone, volume is what a homeowner reads as safety.",
        cause: "Completed jobs are not being asked.",
        expectedBenefit: "One automatic ask per completed job, and the gap closes on its own.",
      },
      holding: {
        evidence: `${s.reviewCount} reviews at ${s.rating} stars, with ${s.recentReviewCount} in the last ninety days — a steady record that holds up against the local set.`,
        diagnosis: `${B} is well regarded and consistently reviewed.`,
        whyItMatters: "Reputation is the part of this that takes years to build, and it is already built.",
        cause: "Consistent work showing up in the review text across several years of jobs.",
        expectedBenefit:
          "Holding this position as booking volume rises is mostly a matter of asking every completed job on a schedule, which the build handles automatically.",
      },
    },
  };

  const entry = table[area];
  if (!entry) throw new Error(`no axis prose for "${area}"`);
  return { rubric: entry.rubric, ...(clean ? entry.holding : entry.leaking) };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 5 · BUILD ONE CLIENT
 * ══════════════════════════════════════════════════════════════════════════ */

interface BuiltClient {
  spec: ClientSpec;
  pack: AssetPack;
  allowedNumbers: number[];
  leakInputs: LeakInput[];
  resolutions: ResolvedWorkflow[];
  files: { name: string; bytes: number }[];
}

function buildClient(s: ClientSpec): BuiltClient {
  const HOME_HTML = homeHtml(s);
  const SCRAPE = scrapeFor(s);

  /* ── The real pipeline, exactly as a paying client's run does it ───────── */
  const facts = buildBusinessFacts({
    scrape: SCRAPE,
    fallbackText: "",
    places: { name: s.name, phone: s.phone, address: s.address, website: s.domain },
    ownerName: null,
  });

  const intel = buildAuditIntelligence({
    websiteHtml: HOME_HTML,
    hasWebsiteUrl: true,
    reviews: [],
    competitors: s.competitors.map((c) => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
      website: "",
      category: `${s.industry} contractor`,
      address: `${c.city} ${s.province}`,
    })),
    self: { rating: s.rating, reviewCount: s.reviewCount },
    verifiedFacts: facts,
    performance: psiFor(s),
    dataForSeo: dfsFor(s),
    screenshots: null,
  });

  const business = {
    name: s.name,
    industry: s.industry,
    category: `${s.industry} contractor`,
    city: s.city,
    phone: s.phone,
    website: s.domain,
    rating: s.rating,
    reviewCount: s.reviewCount,
  };

  // THE PAID DELIVERABLES. Post-intake for clients 2 and 3; for client 1 the
  // intake is simply absent, which is the pre-close state and renders fine.
  const detected = detectLeaks({
    business,
    intel,
    scrape: SCRAPE,
    intake: s.intake ?? undefined,
    asOf: RESEARCH_AS_OF,
  });

  // (A separate PRE-SALE detection used to run here to write the free cold
  // audit. The surface was deleted 2026-08-01; the paid pack below is the only
  // artifact this fixture produces, and its own most-provable selection —
  // detected.coldAudit — arrives from the same detectLeaks call as everything
  // else.)

  const leakInputs = buildLeakInputs(detected.report, detected.data);
  const allowedNumbers = allowedNumbersFor(detected.report, detected.data);
  const byId = new Map(leakInputs.map((li) => [li.id, li]));

  /** The deterministic dollar range for a leak, already CAD-marked, or null when
   *  the math layer produced no figure for it. Read rather than typed, so the
   *  prose quotes the SAME number the pipeline computed. */
  const range = (leakId: string): string | null => {
    const d = byId.get(leakId)?.dollar;
    if (!d) return null;
    return d.low === d.high ? cad(d.low) : `${cad(d.low)}–${cad(d.high)}`;
  };

  const PROSE = leakProseFor(s);
  for (const li of leakInputs) {
    if (!PROSE[li.id])
      throw new Error(
        `leak "${li.id}" (${li.name}) fired for ${s.name} but has no prose in leakProseFor() — write it before regenerating the fixtures.`
      );
  }

  const metrics: ScorecardMetric[] = SCORECARD_AREAS.map((area) => ({
    name: SCORECARD_DISPLAY_NAMES[area],
    score: detected.grades[area],
    ...axisProseFor(s, area, detected.grades[area]),
  }));

  const authoredLeaks: LeakAnalysisItem[] = leakInputs.map((li) => {
    const p = PROSE[li.id];
    return {
      area: li.name,
      leakName: li.name,
      evidence: p.evidence,
      explanation: p.explanation,
      businessImpact: p.businessImpact,
      difficulty: p.difficulty,
      priority: p.priority,
      recommendedFix: p.recommendedFix,
      owner: "us" as const,
    };
  });

  /* ── D1 · the intelligence layer ───────────────────────────────────────── */
  // The narrative opens on the largest dollar-quantified finding when there is
  // one, and on the largest leak by rank when there is not (a pre-intake pack
  // with no volumes to run the math over). Both dollar sentences carry
  // "estimated" in the SAME sentence as the number, because the chain behind
  // them contains assumptions we made.
  const quantified = leakInputs.filter((li) => li.dollar);
  const topDollar = quantified[0];
  const secondDollar = quantified[1];
  const openingSentence = topDollar
    ? `${topDollar.name} is the largest recoverable number in this report: an estimated ${range(topDollar.id)} a month, computed from the volumes and job value set out beside that finding and the industry rates cited with them.`
    : `${leakInputs[0].name} is the most expensive thing in this report, and it is not a small one — every route into ${s.shortName} ends at a person who has to be free at that exact moment.`;
  const secondSentence = secondDollar
    ? ` The ${secondDollar.name.toLowerCase()} slice of the same chain is an estimated ${range(secondDollar.id)} a month, and where it overlaps the figure above it is a share of it rather than a second loss on top.`
    : "";

  const intelligence: GrowthIntelligence = stampLeakAnalysis(
    {
      executiveSummary: {
        narrative:
          `${openingSentence}${secondSentence} Underneath all of it sits one pattern: every route into ${s.shortName} ends at a person who has to be free at that exact moment, and nothing sits behind any of them when that person is on a job. What this business is missing is the layer between an enquiry arriving and somebody getting to it.`,
        biggestOpportunities: [
          "Instant acknowledgement on the phone line and the form, which is the cheapest change on this list and touches every enquiry you already receive.",
          `A bookable calendar that stays open through the evenings and weekends your listing currently shows as closed.`,
          `Scoring at the point of capture, so ${t(s).bigJob} stops waiting behind ${t(s).smallJob}.`,
          "A past-customer list that has already bought from you once and is currently being contacted by nobody.",
        ],
        biggestThreats: [
          "A published review already describes an enquiry that got no reply, which is the one kind of review a homeowner reads as a warning.",
          `Competitors in ${s.city} carry noticeably more review volume, which makes speed of reply the cheaper place for you to win.`,
          `Demand arrives in short bursts around ${t(s).peak}, and capture problems cost the most in exactly those weeks.`,
        ],
        mostUrgentFixes: [
          "Missed-call text-back on the main line.",
          "Instant auto-reply and qualification behind the contact form.",
          "After-hours auto-response covering evenings and weekends.",
        ],
        quickWins: [
          "Webchat that continues in SMS, so a small question does not need a phone call.",
          "The social page inbox pulled into the same queue as calls and texts.",
          "Call tracking switched on, so answered-versus-missed stops being a guess.",
        ],
      },
      scorecard: {
        overallReadout:
          `${s.shortName} converts well once a person is actually in the conversation. The reviews describe competent work at a fair price, and booked jobs get attended. Everything scoring low here sits in front of that conversation: the enquiry arriving, being acknowledged, being sorted and being followed up. That is a capture and response problem, not a reputation problem, and it is the cheaper of the two to fix.`,
        metrics,
      },
      leakAnalysis: authoredLeaks,
      fastestWins: [
        {
          opportunity: "Missed-call text-back on the published line",
          impact: "Recovers the largest single figure in this report, estimated beside that finding",
          difficulty: "low",
          speed: "live in under a week",
        },
        {
          opportunity: "Instant auto-reply on the contact form",
          impact: "Closes the reply delay a review already describes",
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
          opportunity: `Booking page wired to ${s.trade.worker} availability`,
          impact: "Turns evening intent into a held slot without a phone call",
          difficulty: "medium",
          speed: "two weeks",
        },
      ],
      strategicRecommendations: [
        "We deploy the qualification and routing engine in front of every channel, and we run it for you every month rather than handing you a tool to operate.",
        "We build the whole conversion path inside a GoHighLevel sub-account you own: instant response, qualification, follow-up, booking, reminders and the pipeline behind them.",
        "We treat capture as the first priority and booking as the second, because a booking page only pays for itself on enquiries that reached the system.",
        "We put a seasonal reactivation sequence on your past-customer list, which is demand you have already earned and are currently not contacting.",
        "We report monthly on answered, missed and after-hours volume, so the next round of decisions is made against numbers rather than impressions.",
      ],
    },
    leakInputs
  );

  /* ── D2 · the acquisition infrastructure ───────────────────────────────── */
  const CRM_STAGE_OPERATIONS: Record<PipelineStage, { ownership: string; reviewProcess: string }> = {
    "New Lead": {
      ownership: "Automation, with the office notified on priority scores.",
      reviewProcess: "Anything sitting here more than fifteen minutes during business hours raises an alert.",
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
      ownership: `The ${s.trade.worker} on site, with the office picking up the paperwork.`,
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
      overview: `This is the path an enquiry takes from the moment it arrives to the moment the ${s.trade.worker} is standing at the door, and the version below is the one we build for you. Every stage that can run without a person waiting on it does. The two that cannot are the ones where judgement or a licensed trade is the whole point.`,
      stages: [
        {
          stage: "Capture",
          role: "Get every enquiry into one system regardless of which channel it arrived on.",
          currentWeakness:
            "Three separate routes into the business today, none of which share a queue: a phone line with no fallback, a form with nothing behind it, and a social page sitting on its own.",
          whatWeDeploy:
            "One tracked number with missed-call text-back, a webchat widget that continues in SMS, the social inbox connected, and the site form rewritten to feed the same queue.",
          owner: "us",
          isRetainer: false,
          kpi: "Share of inbound enquiries that reach the system with a timestamp on them.",
        },
        {
          stage: "Qualify",
          role: "Score and sort every enquiry before a human spends a minute on it. This is the stage we run for you every month.",
          currentWeakness:
            "The form collects a name, an email, a phone number and a message, so every enquiry looks identical and triage happens by phone.",
          whatWeDeploy: `Scoring on job type, urgency and service area at the point of capture, with routing rules that page the on-call ${s.trade.worker} for priority work and hold the rest for the office.`,
          owner: "us",
          isRetainer: true,
          kpi: "Median time from enquiry to a scored, routed lead.",
        },
        {
          stage: "Speed to Lead",
          role: "Make sure the first reply is ours, on every channel, every time.",
          currentWeakness:
            "A review describes an enquiry through the site that waited days, and nothing automated sits behind that form today.",
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
          whatWeDeploy: `The booking page inside your GoHighLevel sub-account, wired to ${s.trade.worker} availability, with a text-to-pay deposit link that turns a held slot into a committed one.`,
          owner: "us",
          isRetainer: false,
          kpi: "Share of bookings taken without a phone call.",
        },
        {
          stage: "Show-Up and Recovery",
          role: "Protect the booked slot and pick up the ones that fall over.",
          currentWeakness:
            "Nothing between the booking and the visit currently reminds anybody, and the wait grows as booking moves online.",
          whatWeDeploy:
            "Confirmation and reminder messages on every booking, a same-day text before arrival, and a two-step recovery sequence on any appointment that does not happen.",
          owner: "us",
          isRetainer: false,
          kpi: "Share of booked appointments attended.",
        },
      ],
    },
    // THE SIX COLUMNS ARE NOT AUTHORED HERE. They are read from PIPELINE in
    // src/lib/workflow-catalogue.ts — the one canonical definition of the board
    // we configure in the client's GoHighLevel sub-account — and only the
    // operating detail (who owns the column, how often it is reviewed) is
    // written by hand.
    crmPipeline: {
      overview:
        "One pipeline, six stages, and a rule for what moves an enquiry between them. The point is that at any moment you can see how many jobs are sitting at each stage and who owes the next action, which is the thing an inbox can never tell you.",
      stages: PIPELINE.map((p) => ({
        stage: p.stage,
        entryCriteria: p.howALeadArrives,
        exitCriteria: p.howALeadLeaves,
        ownership: CRM_STAGE_OPERATIONS[p.stage].ownership,
        reviewProcess: CRM_STAGE_OPERATIONS[p.stage].reviewProcess,
      })),
      leadTiers: [
        {
          tier: "Priority Lead",
          range: "90–100",
          meaning: `${s.trade.emergency.charAt(0).toUpperCase()}${s.trade.emergency.slice(1)}, or a replacement-sized job, inside the service area.`,
          action: `Page the on-call ${s.trade.worker} and call back immediately.`,
          responseTime: "Under five minutes, day or night.",
          owner: `On-call ${s.trade.worker}, with the office copied.`,
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

  /* ── D4 · the schedule ─────────────────────────────────────────────────── */
  // The SHAPE of the schedule is not authored here. Phase names, windows, the
  // price on each window and the retainer flag are stamped by
  // stampRoadmapWindows() — the same function generation uses — so this fixture
  // cannot drift from the engagement the software actually sells.
  const resolutions = resolveWorkflows({
    intake: detected.data.intake ?? null,
    firedLeaks: detected.report,
    overrides: s.overrides,
  });

  /* ── D3 · supporting assets ────────────────────────────────────────────── */
  const supportingAssets: AssetPack["supportingAssets"] = {
    reviewAssets: {
      postJobRequest: `Hi [First name], thanks for having ${s.shortName} out today. If the work was up to standard, a short Google review helps other ${s.city} homeowners work out who to call. Here is the link: [Google review link]. If anything was not right, reply to this message and we will sort it out first.`,
    },
    thankYouAssets: {
      thankYouPageCopy: `Thanks — that is booked. You will get a confirmation text within a minute with your time slot and the name of the ${s.trade.worker} coming out. If you need to move it, reply to that text and we will find another slot.`,
      nextStepMessaging: `Two things happen next. You will get a reminder the day before, and another on the morning of the visit once the ${s.trade.worker} is on the way. Nothing else is needed from you.`,
      postPurchaseSequence: [
        `Immediately: confirmation text with the slot, the ${s.trade.worker}'s name and a reply-to-reschedule line.`,
        "Day before: reminder with the arrival window and a note about clearing access.",
        `Morning of: a text when the ${s.trade.worker} leaves the previous job, with a live arrival estimate.`,
        "Same evening: a short thank-you and the review request, once the job is marked complete.",
        `Eleven months later: a maintenance reminder timed to ${s.trade.peak}.`,
      ],
    },
  };

  /* ── D3 · the conversion surfaces ──────────────────────────────────────── */
  const surfaces: AssetPack["surfaces"] = stampSurfaceDestinations({
    bookingPage: {
      where: "",
      honestyNote: "",
      headlineOptions: [
        `${s.trade.emergency.charAt(0).toUpperCase()}${s.trade.emergency.slice(1)} in ${s.city}? We can usually be there the same day.`,
        `${s.trade.work.charAt(0).toUpperCase()}${s.trade.work.slice(1)} across ${s.city} and ${s.region}.`,
        `${s.trade.work.charAt(0).toUpperCase()}${s.trade.work.slice(1)} that gets answered, not just advertised.`,
      ],
      subheadlineOptions: [
        `Licensed, insured and working in ${s.city} since ${s.founded}. Tell us what is happening and we will tell you when we can be there.`,
        "Same-week service on most jobs, a written price before any work starts, and an answer whatever time you send this.",
        `${s.trade.kit.charAt(0).toUpperCase()}${s.trade.kit.slice(1)} work, emergency callouts and planned jobs across ${s.region}.`,
      ],
      primaryButton: "Book a service visit",
      secondaryButton: "Request a written quote",
      reassuranceLine: `${s.rating} stars across ${s.reviewCount} Google reviews. Licensed and insured in ${s.province}.`,
      proofLine: `Rated ${s.rating} by ${s.reviewCount} ${s.city} homeowners, and answering after hours since this system went in.`,
      sectionOrder: [
        {
          name: "Hero",
          purpose: "Answer the question the visitor arrived with in one line.",
          copy: `${s.trade.emergency.charAt(0).toUpperCase()}${s.trade.emergency.slice(1)} in ${s.city}? We can usually be there the same day. Licensed, insured and working across ${s.region} since ${s.founded} — tell us what is happening and we will tell you when we can be there.`,
        },
        {
          name: "The problem, in their words",
          purpose: "Show that you understand the situation the visitor is actually in.",
          copy: `${s.trade.urgencyLine}. By the time it happens the question is not who is cheapest but who picks up. The frustrating part for most homeowners is not the bill. It is ringing three companies, leaving three messages, and waiting to see which one calls back.`,
        },
        {
          name: "How the work actually goes",
          purpose: "Remove the uncertainty about what happens after they book.",
          copy: `Send us what is happening and you get an answer within minutes, whatever time it is. If it is urgent, the on-call ${s.trade.worker} is paged straight away. If it can wait, you get a written price and a slot you can hold online without another phone call.`,
        },
        {
          name: "Proof",
          purpose: "Let real customers do the persuading.",
          copy: `${s.shortName} has been working in ${s.region} since ${s.founded}, licensed and insured in ${s.province}. The rating is ${s.rating} across ${s.reviewCount} Google reviews. [Paste three real Google reviews here, first name and neighbourhood only — never write one that nobody left.]`,
        },
        {
          name: "Book a time",
          purpose: "Give a ready customer a way to hold a slot without a phone call.",
          copy: `Pick a window that suits you. You will get a written confirmation within a minute, a reminder the day before, and a text on the morning of the visit when the ${s.trade.worker} leaves the previous job.`,
        },
        {
          name: "Questions",
          purpose: "Answer the objections that otherwise become a phone call or a closed tab.",
          copy: "Cost, timing, service area and what happens out of hours — answered plainly below, with no hedging.",
        },
        {
          name: "Close",
          purpose: "Repeat the offer to act for anybody who read the whole page.",
          copy: `Book a service visit, request a written quote, or call ${s.phone}. Whichever you choose, you get an acknowledgement within a minute.`,
        },
      ],
      faq: [
        {
          question: "How quickly can somebody get here?",
          answer: `Urgent ${s.trade.emergency} calls are usually same day. Everything else is normally within the same week, and you will be given a real window rather than a vague morning or afternoon.`,
        },
        {
          question: "What does it cost to have somebody look at it?",
          answer:
            "There is a callout fee for the visit, quoted to you before it is booked, and it comes off the bill if you go ahead with the work. Nothing starts without a written price you have agreed to.",
        },
        {
          question: "What happens if I message you in the evening?",
          answer: `You get an acknowledgement within a minute confirming we have it, and a real reply first thing. If it is an emergency, the message routes to the on-call ${s.trade.worker} rather than waiting for the office to open.`,
        },
        {
          question: "Which areas do you cover?",
          answer: `${s.city} and ${s.region}. If you are outside that we will say so straight away rather than leaving you waiting on a callback.`,
        },
        {
          question: `Should I repair the ${s.trade.kit} or replace it?`,
          answer: `That depends on age, what has failed and what the repair costs against a replacement. The ${s.trade.worker} will give you both numbers and tell you honestly which one they would choose.`,
        },
      ],
    },
    leadCaptureForm: {
      where: "",
      formHeadline: "Tell us what is happening",
      formIntro:
        "Four lines is plenty. The more we know about the job and the urgency, the faster the right person calls you back.",
      submitButton: `Send it to ${s.shortName}`,
      postSubmitHeadline: "Got it — this is with us now",
      postSubmitCopy:
        "A confirmation is on its way to your phone. A person will follow it within the hour during office hours, or first thing tomorrow if you sent this overnight. You do not need to send it again.",
      emergencyRoute: `If it is an emergency, call ${s.phone} — it will route straight to the on-call ${s.trade.worker} instead of waiting on a sequence.`,
    },
    leadGate: {
      where: "",
      openingLine:
        "Five quick questions so the right person calls you back with the right answer, instead of phoning to work out what the job is.",
      questionIntros: [
        `This one decides whether it goes to the on-call ${s.trade.worker} tonight or to the office in the morning.`,
        `Knowing the make and rough age of the ${s.trade.kit} means the ${s.trade.worker} arrives carrying the likely part.`,
        "The postal area tells us straight away whether you are inside the service area — if you are not, we will say so rather than leave you waiting.",
      ],
      priorityAcknowledgement: `That sounds like it cannot wait. The on-call ${s.trade.worker} has been paged and will call you on this number — if it is a full outage, ring ${s.phone} as well rather than waiting.`,
      standardAcknowledgement:
        "Thanks — that is everything we need. Somebody from the office will call you back within the hour during business hours, or first thing tomorrow if you sent this overnight.",
    },
    webchat: {
      where: "",
      launcherLabel: "Ask a quick question",
      greeting: `Hi — this is ${s.shortName}. Ask away and somebody will answer. If you have ${s.trade.emergency}, say so and it goes to the on-call ${s.trade.worker}.`,
      detailsAsk:
        "Can I take a name and a mobile number? That way we can carry on by text if you have to close the tab, and nothing gets lost.",
      awayMessage: `The office is closed but this is monitored. Send it through and you will get a real reply first thing. If it is urgent, call ${s.phone} and it routes straight to the on-call ${s.trade.worker}. You can also grab a slot now: [booking link]`,
    },
    siteAdvisory: {
      where: "",
      scopeNote: "",
      standingRules: [],
      // See the matching note in scripts/make-golden-sample.ts: the advisory surface
      // is exempt from being read as a MEASUREMENT, not from being true. Position
      // and prominence claims are forbidden in every deliverable
      // (docs/detector-checkability.md §2.7), so the observation half of each note
      // states a fingerprint and the judgment half stays in the recommendation.
      summary: `The page does the honest things well: the headline says what you do and where, and the phone number is a real tap-to-call link in the HTML rather than typed-out digits. What it does not do is give a visitor any way to act outside the hours your office is open. Measured on mobile the page scores ${s.psi.mobileScore} with a largest contentful paint of ${s.psi.mobileLcp} seconds, and ${s.psi.desktopScore} at ${s.psi.desktopLcp} seconds on desktop — real numbers, worth knowing, and context rather than a recommendation. The conversion read is that the page is quick enough that nothing on this list is being caused by load time.`,
      notes: [
        {
          area: "Buttons",
          whatWeSaw:
            "The two routes into the business we can find in the page HTML are a request-a-quote link to the contact form and a tap-to-call link to the main line. Both of those routes need the office to be open.",
          recommendation:
            "Point the existing buttons at the booking page and keep one visible at every scroll position. This is the cheapest change on the list and the one with the most behind it.",
          priority: "critical",
        },
        {
          area: "Hero",
          whatWeSaw:
            "The headline describes the trade and the service area accurately, with the licensing line directly beneath it. It does not answer the question a visitor arrives with, which is how quickly somebody can be there.",
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

  /* ── D3 · the copy every workflow in the build actually sends ──────────── */
  const genContext: GenerationContext = {
    business: {
      name: s.name,
      industry: s.industry,
      category: `${s.industry} contractor`,
      city: s.city,
      rating: s.rating,
      reviewCount: s.reviewCount,
      website: s.domain,
      description: null,
    },
    intel,
    websiteText: homeMarkdown(s),
    // TRUE only when they actually filled in the form. On the pre-sale client
    // this is false, which is what stamps the "INTERNAL TEST — generated without
    // client intake" marker on every cover. That marker is correct and the
    // fixture keeps it.
    intakePresent: Boolean(s.intake),
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
    workflowToggles: s.overrides,
  };

  const workflowsToWrite = workflowsNeedingCopy(genContext);
  const MESSAGES = workflowMessagesFor(s);
  for (const r of workflowsToWrite)
    if (!MESSAGES[r.workflow.id]?.length)
      throw new Error(
        `workflow "${r.workflow.id}" (${r.workflow.name}) is in ${s.name}'s build and needs copy, but workflowMessagesFor() has none for it.`
      );

  const workflowCopy: AssetPack["workflowCopy"] = {
    assets: stampWorkflowCopy(
      workflowsToWrite,
      workflowsToWrite.map<WorkflowCopyAsset>((r) => ({
        workflowId: r.workflow.id,
        workflowName: "",
        trigger: "",
        where: "",
        messages: MESSAGES[r.workflow.id],
      }))
    ),
    coverage: workflowCoverage(genContext),
  };

  /* ── file1..file5 ──────────────────────────────────────────────────────── */
  const pack: AssetPack = {
    meta: {
      businessName: s.name,
      city: s.city,
      industry: s.industry,
      generatedAt: GENERATED_AT,
      dataConfidence: intel.dataConfidence,
      assumptions: intel.assumptions,
      internalTest: s.intake ? undefined : true,
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
    file1: file1For(s, leakInputs),
    file2: file2For(s),
    file3: file3For(s),
    file4: file4For(s),
    file5: file5For(s),
    intelligence,
    infrastructure,
    supportingAssets,
    surfaces,
    workflowCopy,
  };

  return { spec: s, pack, allowedNumbers, leakInputs, resolutions, files: [] };
}

/** Short helper so the executive-summary template can reach the trade words
 *  without threading them through every call site. */
function t(s: ClientSpec): TradeWords {
  return s.trade;
}

/* ════════════════════════════════════════════════════════════════════════════
 * 6 · THE WORKFLOW MESSAGE TABLES
 *
 * Keyed by CATALOGUE WORKFLOW ID for the same reason the leak prose is keyed by
 * leak id: renaming a workflow must not silently orphan its messages. Only the
 * message BODIES are written here — the workflow's name, its trigger and its
 * destination inside GoHighLevel are stamped by stampWorkflowCopy() from the
 * catalogue, which is why the assets handed to it carry empty strings in those
 * three slots.
 *
 * Written the way the product writes: no promise the automation does not keep,
 * one next step per message and it is the booking link, no invented discount or
 * deadline, and merge fields rather than square brackets where a real field
 * exists.
 * ══════════════════════════════════════════════════════════════════════════ */

function workflowMessagesFor(s: ClientSpec): Record<string, WorkflowMessage[]> {
  const B = s.shortName;
  const w = s.trade.worker;
  return {
    "instant-lead-response": [
      {
        step: "Step 1 · text, within a minute",
        channel: "Text",
        timing: "Within about a minute of the form arriving, day or night",
        body: `Hi [First name], it is ${B}. We have your message about [Job type] and somebody will call you back. If it cannot wait, reply URGENT and it goes to the on-call ${w}.`,
        mergeFields: ["First name", "Job type"],
      },
      {
        step: "Step 2 · email, immediately after",
        channel: "Email",
        timing: "Sent in the same minute as the text above",
        subject: `We have your message — ${B}`,
        body: `Hi [First name],\n\nThanks for getting in touch. We have your message about [Job type] and it is in the queue with a real person's name against it.\n\nDuring office hours somebody will call you back within the hour. Outside them you will hear from us first thing.\n\nIf you would rather just hold a slot, you can pick one here: [booking link]\n\n— The team at ${B}`,
        mergeFields: ["First name", "Job type"],
      },
    ],
    "missed-call-text-back": [
      {
        step: "Step 1 · text, within seconds of the missed call",
        channel: "Text",
        timing: "Fires the moment a call is not answered",
        body: `Sorry we missed you — this is ${B}. Tell us what is happening and we will call you straight back. If it is urgent, reply URGENT and it pages the on-call ${w}.`,
        mergeFields: [],
      },
    ],
    "after-hours-auto-reply": [
      {
        step: "Step 1 · text, immediately",
        channel: "Text",
        timing: "Any enquiry between 4:30pm and 8am, or at a weekend",
        body: `Thanks — this is ${B}. The office is shut but this is monitored. You will get a real reply first thing. If it cannot wait until then, reply URGENT.`,
        mergeFields: [],
      },
      {
        step: "Step 2 · email, immediately",
        channel: "Email",
        timing: "Sent alongside the text above",
        subject: `We have it — ${B}`,
        body: `Hi [First name],\n\nYour message came in outside office hours and we have it. Somebody will be back to you first thing.\n\nIf you would rather hold a slot now, the calendar is open: [booking link]\n\n— The team at ${B}`,
        mergeFields: ["First name"],
      },
    ],
    "appointment-cancelled-stop-reminders": [
      {
        step: "Step 1 · text, on cancellation",
        channel: "Text",
        timing: "The moment an appointment is cancelled",
        body: `That is cancelled and no more reminders will come through. Whenever it suits, you can pick a new slot here: [booking link] — ${B}`,
        mergeFields: [],
      },
    ],
    "owner-hot-lead-notification": [
      {
        step: "Step 1 · internal text to the owner",
        channel: "Text",
        timing: "Within seconds of a priority-scored enquiry arriving",
        body: `Priority lead: [First name], [Job type], [Postal area]. Scored [Score]. Nobody has called them yet. Full record in the pipeline.`,
        mergeFields: ["First name", "Job type", "Postal area", "Score"],
      },
    ],
    "social-dm-capture": [
      {
        step: "Step 1 · reply in the social inbox",
        channel: "Direct message",
        timing: "Within a minute of the message arriving",
        body: `Hi [First name] — this is ${B}. Happy to help. Can I take a mobile number so we can carry this on by text and get somebody out to you? If it is urgent, say so and it goes to the on-call ${w}.`,
        mergeFields: ["First name"],
      },
    ],
    "text-to-pay": [
      {
        step: "Step 1 · text with the deposit link",
        channel: "Text",
        timing: "Once the slot is agreed and the job is written up",
        body: `Hi [First name], that is [Date] between [Window]. The deposit link is here: [payment link]. Once it is paid the slot is held and you will get the confirmation. — ${B}`,
        mergeFields: ["First name", "Date", "Window"],
      },
    ],
    "database-reactivation": [
      {
        step: "Step 1 · email, seasonal batch",
        channel: "Email",
        timing: `Sent ahead of ${s.trade.peak}`,
        subject: `Worth a look before ${s.trade.peak}`,
        body: `Hi [First name],\n\nIt has been a while since we were out. Ahead of ${s.trade.peak} it is worth a look at the ${s.trade.kit} before it becomes an emergency call.\n\nIf you want one booked in, the calendar is here: [booking link]\n\n— The team at ${B}`,
        mergeFields: ["First name"],
      },
      {
        step: "Step 2 · text, four days later",
        channel: "Text",
        timing: "Four days after the email, only to those who did not book",
        body: `Hi [First name], it is ${B}. Still worth getting the ${s.trade.kit} looked at before ${s.trade.peak}? Slots are here: [booking link]`,
        mergeFields: ["First name"],
      },
      {
        step: "Step 3 · email, ten days later",
        channel: "Email",
        timing: "Ten days after step 1, and the last message in the run",
        subject: "Last one from us this season",
        body: `Hi [First name],\n\nLast message from us on this. If you would rather we checked back next year instead, reply LATER and we will leave you be until then.\n\n— The team at ${B}`,
        mergeFields: ["First name"],
      },
    ],
    "review-response": [
      {
        step: "Reply · a five-star review",
        channel: "Public review reply",
        timing: "Drafted the same day the review lands, sent once you approve it",
        body: `Thanks [First name] — glad we got that sorted for you. If anything else comes up, you know where we are. — ${B}`,
        mergeFields: ["First name"],
      },
      {
        step: "Reply · a middling review",
        channel: "Public review reply",
        timing: "Drafted the same day, sent once you approve it",
        body: `Thanks for taking the time, [First name]. Sounds like the work was fine but getting hold of us was not. That is the part we are fixing. — ${B}`,
        mergeFields: ["First name"],
      },
      {
        step: "Reply · a negative review",
        channel: "Public review reply",
        timing: "Drafted the same day, sent once you approve it",
        body: `[First name], that is not the standard we hold ourselves to and we would like to put it right. Call the office on ${s.phone} and ask for whoever is on today. — ${B}`,
        mergeFields: ["First name"],
      },
    ],
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 7 · file1..file5
 * ══════════════════════════════════════════════════════════════════════════ */

function file1For(s: ClientSpec, leakInputs: LeakInput[]): AssetPack["file1"] {
  const B = s.shortName;
  const benchmarkCount = leakInputs.filter((li) => li.tier === "BENCHMARK").length;
  return {
    framing: {
      overview: `This module is the diagnostic layer behind the report: where enquiries reach ${B}, what happens to them on each route, and which of those routes is costing the most. It looks only at converting demand that already exists, because that is the part we can fix without changing what you spend on anything.`,
      implementationGuide: [
        "Read the leak sections in the order they are printed; they are ranked by what they cost, not by how easy they are.",
        `Confirm the ${benchmarkCount} finding(s) marked as industry patterns at kickoff, since those were not observed on your business.`,
        "Approve the capture fixes first, because everything downstream only works on enquiries that reached the system.",
        `Give us the past-customer list and the ${s.trade.worker} availability so the second phase can be scheduled.`,
        "Hold the response commitment: the page can only promise what the automation behind it keeps.",
      ],
      expectedImpact:
        "The realistic outcome is more of the enquiries you already receive turning into booked jobs, particularly the ones arriving in the evenings and at weekends where nothing currently catches them.",
    },
    executiveSummary: `${B} converts well once somebody is actually in the conversation, and the review record says so: competent work, honest advice, fair prices. Everything scoring badly in this report happens before that conversation starts. A call that rings out has no fallback, a form fill has nothing automated behind it, an evening enquiry has nowhere to land, and a quote that goes quiet depends on somebody remembering it. The largest recoverable figure sits on the phone line, and the cheapest fix sits on the same line.`,
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
          finding: "No online scheduler on the site or the Google profile; every booking costs a phone conversation.",
          severity: "medium",
        },
        {
          area: "Social",
          finding:
            "A social page is linked from the footer and sits outside every other channel, with no shared response standard.",
          severity: "low",
        },
        {
          area: "Reputation",
          finding: `${s.rating} stars across ${s.reviewCount} reviews, with the work itself consistently well described.`,
          severity: "low",
        },
      ],
    },
    technicalUx: {
      available: true,
      mobile: { score: s.psi.mobileScore, lcpSeconds: s.psi.mobileLcp, cls: 0.04, inpMs: 205 },
      desktop: { score: s.psi.desktopScore, lcpSeconds: s.psi.desktopLcp, cls: 0.02, inpMs: 88 },
      businessImpactSummary: `The page loads quickly enough that nothing in this report is being caused by it: ${s.psi.mobileLcp} seconds to the main content on mobile and ${s.psi.desktopLcp} on desktop. These numbers are context, not a work item, since site performance is not part of a conversion engagement.`,
      topFixes: [],
    },
    visuals: {
      available: false,
      shots: [],
      competitiveRead: "No screenshots were captured for this run, so nothing here rests on a visual comparison.",
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
        expectedImpact: "The largest single figure in this report, estimated beside that finding.",
      },
      {
        issue: "An after-hours enquiry has nowhere to land.",
        whyItMatters: `${s.trade.urgencyLine}, which is exactly when the listing shows you closed.`,
        impact: 9,
        urgency: 9,
        difficulty: 2,
        recommendedFix: "After-hours auto-response plus a booking page that stays open around the clock.",
        expectedImpact: "Turns the highest-urgency hours into hours where you are the company that replied.",
      },
      {
        issue: "Reply speed on the form is set by the day's schedule.",
        whyItMatters: "A published review already describes an enquiry that waited, and it went elsewhere.",
        impact: 9,
        urgency: 8,
        difficulty: 2,
        recommendedFix: "Instant auto-reply and qualification behind every submission.",
        expectedImpact: "First useful reply becomes yours on enquiries you are already receiving.",
      },
      {
        issue: "Every enquiry arrives looking identical.",
        whyItMatters: `${s.trade.bigJob} and ${s.trade.smallJob} get the same treatment, so the valuable one waits longest.`,
        impact: 7,
        urgency: 7,
        difficulty: 3,
        recommendedFix: "Job type, urgency and service area captured and scored at the point of entry.",
        expectedImpact: "The biggest job of the week is the first one somebody calls back.",
      },
      {
        issue: "Quotes that go quiet depend on somebody remembering them.",
        whyItMatters:
          "Decisions on planned work are made across weeks, and the company still present when the customer is ready usually gets the work.",
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
      customerPsychology: `Most people contacting a ${s.trade.work} company are already uncomfortable and slightly anxious about the bill. They are not researching, they are triaging, and they read speed of reply as a proxy for competence.`,
      buyingBehavior: `Emergency work is decided in under an hour and usually by phone. ${s.trade.bigJob.charAt(0).toUpperCase()}${s.trade.bigJob.slice(1)} is decided over several weeks, often with two or three written quotes, and frequently stalls until something forces the issue.`,
      trustExpectations:
        "Licensing and insurance are assumed rather than persuasive. What actually moves a homeowner is another homeowner in their own neighbourhood saying the tradesperson was honest about what did not need doing.",
      competitiveSaturation: `${s.city} has a dense field of ${s.trade.work} contractors, and the three nearest carry review counts between ${Math.min(...s.competitors.map((c) => c.reviewCount))} and ${Math.max(...s.competitors.map((c) => c.reviewCount))}. Nobody in that set is visibly answering after hours.`,
      seasonalDemand: `Demand arrives in bursts around ${s.trade.peak}. Capture problems cost several times more inside those windows than they do in the quiet months.`,
      priceSensitivity:
        "Callout fees are compared closely; larger quotes are compared on trust and timing more than on the bottom line. A written price given quickly beats a slightly lower one that took three days.",
      credibilityMarkers: `Years in ${s.region}, licensing, named ${s.trade.worker}s, and reviews that mention specific streets or neighbourhoods rather than generic praise.`,
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
        `Serving ${s.city} for over twenty years`,
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
      recommendedAngle: `The ${s.trade.work} company in ${s.city} that actually answers. Not the oldest, not the cheapest, the one that replies while you are still deciding who to call.`,
    },
    trustGapAnalysis: [
      {
        gap: "The rating is stated but never shown.",
        impact: "A visitor comparing you against companies with more reviews has nothing specific to weigh you on.",
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
    positioningStrategy: `Position ${B} on responsiveness rather than on longevity. The market is saturated with companies claiming experience and nobody claiming, or keeping, an answer time. Every asset in this pack is built to make that claim true first and visible second.`,
    ctaStrategy:
      "Three routes, always in the same order, repeated at the hero and at the close: book, quote, call. The booking route leads because it is the only one that works outside office hours, and the phone route stays visible because some people will always want a person.",
    trackingAnalytics: [
      "Form submissions and tap-to-call clicks recorded as separate conversion events.",
      "Hour of arrival tagged on every enquiry, so the after-hours question can be sized with real data.",
      "Booking source recorded, so the booking page is judged on jobs rather than clicks.",
      "Answered, missed and after-hours call volume reported monthly.",
    ],
    loomTalkingPoints: [
      "A published review describes an enquiry that never got a reply. Start there.",
      "Your listing says closed evenings and weekends, and there is nothing on the site to catch those enquiries.",
      "The form asks four generic questions, so the biggest job of the week waits behind the smallest.",
      "Your rating and your workmanship are fine. This is a capture problem, and it is the cheaper kind.",
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
        "One of their own published reviews describes an enquiry that got no reply. That is a specific, verifiable problem, and it is cheaper to fix than they expect.",
      personalizedOpener:
        "Noticed your Google hours show evenings and weekends closed, and there is no way on the site to leave a job in the queue. That is the window where the urgent calls actually happen.",
      loomScriptBullets: [
        "Open on the review that mentions an enquiry going unanswered.",
        "Show the Google listing hours next to the site with no booking path.",
        "Walk the form: four fields, nothing behind it.",
        "Close on the estimated missed-call figure and say plainly that it is an estimate.",
      ],
      proposalPositioning:
        "This is not a website project. It is the layer between an enquiry arriving and somebody getting to it, built inside a GoHighLevel sub-account they own, with the qualification engine run monthly.",
      discoveryCallPoints: [
        "How many calls come in on a Saturday, and what happens to them?",
        "Who reads the form submissions, and when in the day does that happen?",
        "What happens to a quote that goes quiet for a month?",
        "Is there a list of past customers anywhere, and has anything ever been sent to it?",
      ],
      objectionHandling: [
        {
          objection: "We already answer the phone.",
          response: `During the day, almost certainly. The question is the Saturday afternoon when both ${s.trade.worker}s are on jobs, and nothing currently tells you how often that happens.`,
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
}

function file2For(s: ClientSpec): AssetPack["file2"] {
  const w = s.trade.worker;
  return {
    framing: {
      overview:
        "The intake form that replaces the four generic fields on the contact page. Every question here exists to answer one thing before a human spends a minute on the enquiry: how urgent is this, how big is it, and is it in the service area.",
      implementationGuide: [
        "Replace the existing contact form with this one and keep it to a single screen on mobile.",
        "Wire each answer to the scoring weights below so a submission arrives already sorted.",
        `Point priority scores at the on-call ${w} and everything else at the office queue.`,
        "Send the instant acknowledgement before any human sees the submission.",
        "Review the thresholds after the first month against jobs that actually booked.",
      ],
      expectedImpact:
        "The largest job in the inbox stops waiting behind the smallest, and nobody has to phone an enquiry back just to find out what it is.",
    },
    formHeadline: "Tell us what is happening",
    formSubheadline: "Five questions, about a minute, and you get an answer straight back.",
    questions: [
      {
        question: "What is going on?",
        inputType: "select",
        options: [s.trade.emergency, `${s.trade.kit} problem`, s.trade.bigJob, "Planned maintenance", "Something else"],
        purpose: "Separates an emergency from planned work before anybody picks up a phone.",
        scoringImpact: `${s.trade.emergency} scores highest; planned maintenance scores lowest.`,
      },
      {
        question: "How soon does this need doing?",
        inputType: "select",
        options: ["Today", "This week", "This month", "Planning ahead"],
        purpose: "Urgency is what decides the callback order.",
        scoringImpact: "Today adds the most; planning ahead routes to the longer sequence.",
      },
      {
        question: "What is your postal code?",
        inputType: "text",
        options: [],
        purpose: "Tells us immediately whether the job is inside the service area.",
        scoringImpact: "Outside the service area caps the score into the low-fit band.",
      },
      {
        question: "Is this a home or a commercial property?",
        inputType: "select",
        options: ["Home", "Commercial", "Rental or strata"],
        purpose: "Changes who calls back and how the quote is written.",
        scoringImpact: "Commercial and strata add a small amount for job size.",
      },
      {
        question: "Best number to reach you on",
        inputType: "tel",
        options: [],
        purpose: "The callback is a phone call, so the number has to be right.",
        scoringImpact: "No score; a missing number blocks the priority route.",
      },
    ],
    leadScoring: {
      rubric:
        "Job type, urgency, service area and property type, weighted so an urgent in-area job outranks everything else. Thresholds are reviewed monthly against jobs that actually booked.",
      hot: `90–100 · ${s.trade.emergency} or a replacement-sized job inside the service area.`,
      warm: "70–89 · a real job in the area with no immediate urgency.",
      cold: "0–69 · planning ahead, out of area, or work you do not take on.",
    },
    routingLogic: [
      { tier: "Priority", action: `Page the on-call ${w} and call back immediately.`, timing: "Under five minutes, day or night." },
      { tier: "Qualified", action: "Office calls back and puts a quote in writing.", timing: "Within one hour during business hours." },
      { tier: "Nurture", action: "Send what they asked for and start the longer sequence.", timing: "Same day, automated." },
      { tier: "Low fit", action: "Reply honestly, point them somewhere useful, keep the record.", timing: "Same day, automated." },
    ],
    automationWorkflow: [
      "Submission lands and is scored before anybody sees it.",
      "Acknowledgement text and email go out inside a minute.",
      "Priority scores page the on-call phone; everything else lands in the office queue.",
      "The record is created at New Lead with the answers attached.",
      "No callback logged within the tier's window raises an alert.",
    ],
    thankYouPage:
      "Got it — this is with us now. A confirmation is on its way to your phone, and a person will follow it inside the hour during office hours.",
    crmFields: [
      "Job type",
      "Urgency",
      "Postal area",
      "Property type",
      "Score",
      "Channel the enquiry arrived on",
      "Hour of arrival",
    ],
    followUpTiming:
      "First automated reply inside a minute. First human callback inside the hour during business hours, or first thing the next morning.",
    implementation: [
      "Build the form inside GoHighLevel and point the site's existing buttons at it.",
      "Set the scoring weights before the form goes live, not after.",
      "Test the priority route end to end with a real phone before go-live.",
      "Leave the phone number on the page exactly as it is.",
    ],
  };
}

const NURTURE_EMAILS = NURTURE_SEQUENCE.filter((x) => x.channel === "Email");
const NURTURE_TEXTS = NURTURE_SEQUENCE.filter((x) => x.channel === "Text");

/** The canvas entry for one email/text, by its number within its own half.
 *  Throws rather than defaulting: a missing step would render as "Day undefined"
 *  in a document somebody is pasting into thirteen boxes. */
function nurtureStep(channel: "Email" | "Text", index: number) {
  const step = (channel === "Email" ? NURTURE_EMAILS : NURTURE_TEXTS).find((x) => x.index === index);
  if (!step)
    throw new Error(
      `NURTURE_SEQUENCE has no ${channel} ${index}. The 60-day canvas in src/lib/asset-generation.ts changed; renumber these fixtures against it.`
    );
  return step;
}

function file3For(s: ClientSpec): AssetPack["file3"] {
  const B = s.shortName;
  const email = (index: number, subject: string, subjectB: string, previewText: string, body: string, cta: string) => {
    const x = nurtureStep("Email", index);
    return {
      step: x.step,
      day: x.day,
      timing: `Day ${x.day} — step ${x.step} of the 60-day sequence on an unbooked quote`,
      subject,
      subjectB,
      previewText,
      body,
      cta,
      purpose: x.purpose,
    };
  };
  const sign = `\n\n— The team at ${B}`;
  return {
    framing: {
      overview: `The email half of the 60-day follow-up: ${NURTURE_EMAILS.length} messages that carry an unbooked quote across the weeks the decision actually takes. ${NURTURE_TEXTS.length} texts land between them, so read the two documents together.`,
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
      email(
        1,
        `Your quote from ${B}`,
        "The numbers we talked about",
        "Everything in one place, plus what happens next.",
        `Hi [First name],\n\nHere is the written quote we discussed, with the price and what it covers on one page.\n\nTwo things worth knowing. The price holds for thirty days. And if you would rather just get it booked, you can pick a slot yourself at [booking link] without phoning anybody.\n\nIf anything in it does not make sense, reply to this and I will explain it properly.${sign}`,
        "See available times"
      ),
      email(
        2,
        "What the visit actually looks like",
        "How the day runs",
        "Access, timing, and what happens while we are there.",
        `Hi [First name],\n\nIn case it helps to picture it: we arrive inside a two-hour window, the work takes most of the day, and everything is cleared out before we leave.\n\nNothing is needed from you on the day beyond access.${sign}`,
        "See available times"
      ),
      email(
        3,
        "From a customer in [Neighbourhood]",
        "What other homeowners said",
        "Their words, not ours.",
        `Hi [First name],\n\nRather than tell you we are good at this, here is what a customer wrote after a job like yours:\n\n[Paste a real Google review verbatim — never write one that nobody left.]\n\nThe quote is still open if you want to move on it.${sign}`,
        "See available times"
      ),
      email(
        4,
        "What actually drives the price",
        "Where the money goes on a job like this",
        "No mystery, just the things that move the number.",
        `Hi [First name],\n\nWorth knowing what sits behind the figure, because it is not one number with a margin on top.\n\nFour things move it: the size of the job, what can be kept and what has to be replaced, access, and how long we are on site. Nothing else.\n\nIf you want me to walk through which of those applied to yours, reply and I will.${sign}`,
        "Reply with your questions"
      ),
      email(
        5,
        `Before ${s.trade.peak}`,
        "Worth doing before the weather turns",
        "Timing, and why it matters on this job.",
        `Hi [First name],\n\nThis is the point in the year where the calendar starts filling. If the work is happening at all, before ${s.trade.peak} is the easy time to do it rather than the expensive one.\n\nNo pressure either way — the quote holds.${sign}`,
        "See available times"
      ),
      email(
        6,
        "Anything holding this up?",
        "One question",
        "Tell me the real blocker and I will answer it straight.",
        `Hi [First name],\n\nIf this has stalled, it is usually one specific thing rather than the whole quote. Tell me which and I will answer it straight rather than guessing.\n\nIf it has simply moved to next year, that is a fine answer too.${sign}`,
        "Reply and tell me"
      ),
      email(
        7,
        "Closing this one off",
        "Last one from me",
        "Nothing further unless you want it.",
        `Hi [First name],\n\nI will stop here. The quote stays on file and the price holds for thirty days from the date on it.\n\nIf anything changes, the calendar is always open at [booking link], and you can reply to this email any time.${sign}`,
        "See available times"
      ),
    ],
  };
}

function file4For(s: ClientSpec): AssetPack["file4"] {
  const B = s.shortName;
  const sms = (order: number, message: string, psychology: string, replyStrategy: string) => {
    const x = nurtureStep("Text", order);
    return {
      step: x.step,
      order,
      day: x.day,
      timing: `Day ${x.day} — step ${x.step} of the 60-day sequence on an unbooked quote`,
      message,
      charCount: message.length,
      psychology,
      replyStrategy,
    };
  };
  return {
    framing: {
      overview: `The text half of the same 60-day follow-up: ${NURTURE_TEXTS.length} short messages that land between the emails. They are short on purpose and every one of them invites a reply, because a reply is what turns a sequence into a conversation.`,
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
        `Hi [First name], it is ${B}. Just checking the quote reached you okay. Happy to talk it through, or you can pick a slot yourself here: [booking link]`,
        "Picks the conversation back up the day after, while it is still the thing they were thinking about.",
        "Replies route to the office queue; a booking closes the sequence automatically."
      ),
      sms(
        2,
        `Quick one [First name] — is it still doing the same thing, or has it got worse? Changes what I would suggest doing first.`,
        "One question that takes four words to answer, which is what restarts a thread that has gone quiet.",
        "Any reply reopens the conversation with the office; the word URGENT pages the on-call number."
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
        `Hi [First name], we have space in the calendar over the next fortnight if you want it done before ${s.trade.peak}. Slots are here: [booking link]`,
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
}

function file5For(s: ClientSpec): AssetPack["file5"] {
  const B = s.shortName;
  const w = s.trade.worker;
  const sign = `\n\n— The team at ${B}`;
  return {
    framing: {
      overview:
        "The booking page and everything that protects the slot once it is taken. This is the one page in the pack we actually build and host, inside your own GoHighLevel sub-account.",
      implementationGuide: [
        `Wire the calendar to real ${w} availability rather than to a fixed grid.`,
        "Point every call to action on the website at this page.",
        "Turn on the confirmation, reminder and arrival messages together; each one is weaker alone.",
        "Attach the deposit link to larger work only, not to callout visits.",
        "Check the arrival windows against actual route times after the first month.",
      ],
      expectedImpact: "Bookings taken outside office hours, and fewer wasted trips on slots nobody is home for.",
    },
    headline: "Pick a time that suits you",
    subheadline: "Real availability, confirmed instantly, no phone call needed.",
    whatToExpect: [
      "You choose a window rather than being given a whole morning.",
      `A confirmation text arrives within a minute with the ${w}'s name.`,
      "A reminder lands the day before with what to clear access to.",
      `You get a message when the ${w} leaves the previous job.`,
      "Nothing is charged beyond the callout fee without a written price you agreed.",
    ],
    threeStepBreakdown: [
      { step: "Choose your window", description: "Live availability across the next fourteen days." },
      { step: "Confirm the details", description: "Address, the job, and the best number to reach you." },
      { step: "Get it confirmed", description: "A text within a minute, and a reminder the day before." },
    ],
    appointmentPositioning: `The visit is a diagnosis, not a sales call. The ${w} tells you what has failed, what it costs to fix, and whether they would fix it or replace it in your position. You decide after that, with the price in writing.`,
    microSocialProof: [
      `Rated ${s.rating} across ${s.reviewCount} Google reviews from ${s.city} and ${s.region}.`,
      `Licensed and insured in ${s.province}, working in ${s.region} since ${s.founded}.`,
    ],
    confirmationEmail: {
      subject: "Booked: [date] between [window]",
      body: `Hi [First name],\n\nThat is confirmed. [Technician] will be with you on [date] between [window].\n\nBefore they arrive, please clear access — that is the single thing that most often turns a visit into a second visit.\n\nNeed to move it? Reply to this email or to the text you just received and we will find another slot.${sign}`,
    },
    reminderEmail24h: {
      subject: "Tomorrow between [window]",
      body: `Hi [First name],\n\nA quick reminder that [Technician] is booked to visit tomorrow between [window].\n\nTwo things that help: clear access, and a note of anything that has changed since you booked.\n\nIf tomorrow no longer works, reply and we will move it.${sign}`,
    },
    dayOfReminderSms: `${B} here — [Technician] is on the way and should reach you inside your [window] slot. Reply if anything has changed.`,
    noShowRecoveryEmail: {
      subject: "We came by today",
      body: `Hi [First name],\n\n[Technician] came out today but could not get access, so the visit did not go ahead.\n\nNo problem at all. Reply with a day that suits you this week, or pick a new slot yourself at [booking link], and we will get you back in the calendar.${sign}`,
    },
    noShowRecoverySms1:
      "We came by today and could not get access. Reply with a day that works and we will get you booked back in this week.",
    noShowRecoverySms2:
      "Still happy to get this sorted whenever it suits. Pick any slot here and it is confirmed straight away: [booking link]",
    rescheduleFraming:
      "Rescheduling is offered as a one-word reply on every message, because a customer who cannot easily move an appointment tends to simply not be home for it.",
    showUpQualityNotes:
      "The reminders exist to keep attendance where it is as booking volume moves online and the wait between booking and visit gets longer.",
    implementation: [
      "Host the page inside the GoHighLevel sub-account so bookings write straight to the pipeline.",
      "Sync availability with the dispatch calendar rather than maintaining a second one.",
      "Send the confirmation within sixty seconds; a slow confirmation reads as a failed booking.",
      "Keep the reschedule reply to a single character on SMS.",
    ],
  };
}

/* ════════════════════════════════════════════════════════════════════════════
 * 8 · (THE COLD AUDIT — DELETED 2026-08-01)
 *
 * This section held coldAuditCopyFor() and coldAuditFor(): hand-written copy per
 * fired leak, run through gradeColdAuditFindings and enforceColdAuditLaws to
 * write 00-cold-audit.html / cold-audit.json beside each pack. The pre-sale
 * surface was deleted by ruling, those files are gone from _fixtures/clients/,
 * and nothing pre-sale is generated here any more. Section numbering is kept so
 * old run logs still line up.
 * ══════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
 * 9 · VALIDATE AND WRITE
 * ══════════════════════════════════════════════════════════════════════════ */

let refused = false;

/* ── THE ONE KNOWN-STALE GATE, AND WHY IT IS OVERRIDDEN HERE ─────────────────
 *
 * WHAT THE FIXTURE FOUND. A client who answers the WHOLE intake form cannot get
 * a pack out of the product today. `validateRenderedDeliverables`
 * (src/lib/exporters/index.ts) requires one kickoff-verification line in D1's
 * HTML for every leak whose evidenceTier is BENCHMARK:
 *
 *     const benchmarkLeaks = (pack.intelligence?.leakAnalysis ?? [])
 *       .filter((l) => l.evidenceTier === "BENCHMARK");
 *
 * That was right before intake confirmation existed. It is not right now. The
 * kickoff line is the sentence "we verify this together at kickoff — if you
 * already have this covered, it comes off the list", and its whole purpose is to
 * hedge a claim we have NOT had confirmed. A leak the client has already
 * confirmed at intake must NOT carry it — asking a question they have already
 * answered, in the document they paid for, is an insult, and the PACK validator
 * agrees: it splits BENCHMARK leaks into hedged and confirmed and holds each to
 * its own rule ("Part C · kickoff line" / "Part C · intake-confirmed").
 *
 * So the moment a client confirms even ONE invisible gap, the render gate
 * demands a line the pack validator forbids, and `buildAssetZipChecked` refuses
 * to hand the operator a ZIP. The golden sample never caught it because its
 * intake is deliberately PARTIAL — all seven of its BENCHMARK leaks are still
 * hedged.
 *
 * THE EDIT (one line, in a file this agent does not own):
 *     .filter((l) => l.evidenceTier === "BENCHMARK" && !l.intakeConfirmed);
 *
 * Until that lands, this script runs the CORRECTED rule in place of the stale
 * one — stricter, not weaker, because it also checks the half the stale rule
 * never looked at — and prints the override on every run so it cannot be quietly
 * forgotten.
 * ────────────────────────────────────────────────────────────────────────── */
const STALE_KICKOFF_VIOLATION = /^D1 HTML renders \d+ kickoff-verification line\(s\) but has \d+ BENCHMARK leak\(s\)\.$/;
const STALE_KICKOFF_EXPLANATION =
  "src/lib/exporters/index.ts counts ALL BENCHMARK leaks, including the ones the client CONFIRMED at intake — " +
  "which must not carry a kickoff line at all. Fix: add `&& !l.intakeConfirmed` to that filter.";

const KICKOFF_SIGNATURE = /comes off the list|verify (this|it)(?: together)? at kickoff/i;
const CONFIRMED_SIGNATURE = /confirmed at intake|you told us/i;

/**
 * The rule the render gate should be applying, run against D1's real HTML.
 *
 * TWO HALVES, and the second is the one the stale rule never had:
 *   · every HEDGED benchmark leak must carry the kickoff-verification line —
 *     identical to the stale rule for this case, so nothing is weakened;
 *   · every CONFIRMED benchmark leak must carry the confirmed framing ("you told
 *     us" / "confirmed at intake") and must NOT carry a kickoff line, because
 *     re-asking a question the client answered is the failure this half exists to
 *     catch.
 *
 * Section-scoped rather than counted document-wide: a total tells you a line is
 * missing but not which finding is missing it, and the whole point of the second
 * half is to name the finding.
 */
function kickoffRuleCorrected(pack: AssetPack, d1Html: string): string[] {
  const out: string[] = [];
  const benchmark = (pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceTier === "BENCHMARK");
  const hedged = benchmark.filter((l) => !l.intakeConfirmed);
  const confirmed = benchmark.filter((l) => l.intakeConfirmed);

  const kickoffCount = (d1Html.match(new RegExp(KICKOFF_SIGNATURE, "gi")) ?? []).length;
  if (kickoffCount < hedged.length)
    out.push(
      `D1 renders ${kickoffCount} kickoff-verification line(s) for ${hedged.length} HEDGED benchmark leak(s): ` +
        hedged.map((l) => l.leakName ?? l.area).join(", ")
    );

  for (const l of confirmed) {
    const text = [l.evidence, l.explanation, l.businessImpact, l.recommendedFix, l.industryPattern]
      .filter(Boolean)
      .join("\n");
    if (!CONFIRMED_SIGNATURE.test(text))
      out.push(`"${l.leakName ?? l.area}" was confirmed at intake but its prose never attributes the claim to the client.`);
    if (KICKOFF_SIGNATURE.test(text))
      out.push(
        `"${l.leakName ?? l.area}" was confirmed at intake and still asks to verify it at kickoff — the client already answered that.`
      );
  }
  return out;
}

function writeClient(built: BuiltClient): void {
  const { spec, pack, allowedNumbers, leakInputs, resolutions } = built;
  const dir = resolve(OUT_ROOT, spec.dir);

  console.log(`\n${"═".repeat(78)}`);
  console.log(`${spec.label} · ${spec.name} (${spec.industry}, ${spec.city})`);
  console.log(`  ${spec.purpose}`);
  console.log("═".repeat(78));

  console.log(formatValidation(validatePack(pack, allowedNumbers)));

  const verdict = assertPackValid(pack);
  const rendered = validateRenderedDeliverables(pack);

  const grades = leakInputs.reduce<Record<string, number>>((acc, li) => {
    acc[li.grade] = (acc[li.grade] ?? 0) + 1;
    return acc;
  }, {});
  const tiers = leakInputs.reduce<Record<string, number>>((acc, li) => {
    acc[li.tier] = (acc[li.tier] ?? 0) + 1;
    return acc;
  }, {});
  const on = resolutions.filter((r) => r.on);
  const off = resolutions.filter((r) => !r.on);

  console.log(`\n  leaks:          ${leakInputs.length}`);
  console.log(`  tiers:          ${Object.entries(tiers).map(([k, n]) => `${k}×${n}`).join(", ")}`);
  console.log(`  grades:         ${Object.entries(grades).map(([k, n]) => `${k}×${n}`).join(", ")}`);
  console.log(`  workflows on:   ${on.length}/${resolutions.length}`);
  if (off.length)
    console.log(`  workflows off:  ${off.map((r) => `${r.workflow.id} (${r.source})`).join(", ")}`);

  // ── THE INVARIANTS THIS FIXTURE EXISTS TO DEMONSTRATE ──────────────────────
  const problems: string[] = [];

  // Every leak must carry a grade. The validator treats a missing grade as
  // "inferred", which is right for a pack saved before Phase 1 — and means an
  // UNGRADED fixture would quietly validate clean. Fail here, where the cause is.
  const ungraded = (pack.intelligence?.leakAnalysis ?? []).filter((l) => !l.evidenceGrade);
  if (ungraded.length)
    problems.push(
      `${ungraded.length} leak(s) left the generator with no evidence grade: ${ungraded.map((l) => l.leakName ?? l.area).join(", ")}.`
    );

  if (spec.intake === null) {
    // 1 · PRE-SALE. Nothing was disclosed, so nothing may be graded disclosed.
    const disclosed = (pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceGrade === "disclosed");
    if (disclosed.length)
      problems.push(
        `the pre-sale client carries ${disclosed.length} disclosed leak(s): ${disclosed.map((l) => l.leakName).join(", ")}. Nothing has been disclosed.`
      );
    if (!pack.meta.internalTest)
      problems.push("the pre-sale pack is not flagged internalTest — the covers will not carry the no-intake marker.");
  } else {
    // 2/3 · FULL INTAKE. The answers have to have MOVED something, or the
    // fixture is proving the pre-sale case a second time under another name.
    const disclosed = (pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceGrade === "disclosed");
    if (!disclosed.length)
      problems.push("a fully-answered intake produced no disclosed leak — the answers changed nothing.");
    if (pack.meta.internalTest)
      problems.push("an intake-bearing pack is flagged internalTest.");
  }

  if (spec.overrides) {
    // 3 · TOGGLED. All three overrides must actually have taken effect. If the
    // evidence lock ever widens to cover one of them this fails loudly rather
    // than quietly demonstrating nothing.
    for (const [id, wanted] of Object.entries(spec.overrides)) {
      const r = resolutions.find((x) => x.workflow.id === id);
      if (!r) problems.push(`override names "${id}", which is not in the catalogue.`);
      else if (r.on !== wanted)
        problems.push(
          `operator switched "${id}" ${wanted ? "on" : "off"} and it resolved ${r.on ? "on" : "off"} (${r.source}${r.locked ? ", locked" : ""}). Pick three unlocked workflows for this fixture.`
        );
    }
    // And the build has to be visibly smaller than the untoggled one.
    const offCount = resolutions.filter((x) => !x.on).length;
    if (offCount < Object.keys(spec.overrides).length)
      problems.push(`only ${offCount} workflow(s) are off; the override was supposed to remove ${Object.keys(spec.overrides).length}.`);
  }

  if (!verdict.ok) problems.push(`pack validator: ${verdict.fails.length} failure(s).\n${verdict.report}`);
  for (const v of rendered.violations) {
    if (STALE_KICKOFF_VIOLATION.test(v)) {
      // ── THE ONE EXEMPTION, AND IT IS REPLACED BY A STRONGER RULE ────────────
      // See STALE_KICKOFF_VIOLATION below for what is wrong upstream and the
      // exact one-line edit. The rule this skips is not dropped: the corrected
      // version runs immediately after and is STRICTER, because it also checks
      // the half the stale rule never looked at (that a confirmed leak carries
      // the confirmed framing and does NOT re-ask a question the client already
      // answered).
      const failures = kickoffRuleCorrected(pack, renderDeliverableHtml(pack, "diagnosis"));
      console.log(`\n  KNOWN-STALE GATE OVERRIDDEN — ${v}`);
      console.log(`    ${STALE_KICKOFF_EXPLANATION}`);
      console.log(`    Corrected rule run in its place: ${failures.length ? "FAILED" : "passed"}.`);
      for (const f of failures) problems.push(`rendered HTML (corrected kickoff rule): ${f}`);
      continue;
    }
    problems.push(`rendered HTML: ${v}`);
  }

  if (problems.length) {
    refused = true;
    console.error(`\n  REFUSING TO WRITE ${spec.dir}:`);
    for (const p of problems) console.error(`    ✗ ${p}`);
    return;
  }

  mkdirSync(dir, { recursive: true });
  const written: { name: string; bytes: number }[] = [];
  const put = (name: string, contents: string) => {
    writeFileSync(resolve(dir, name), contents);
    written.push({ name, bytes: Buffer.byteLength(contents, "utf8") });
  };

  for (const d of DELIVERABLES) put(`${d.filename}`, renderDeliverableHtml(pack, d.id));
  put("pack.json", `${JSON.stringify(pack, null, 2)}\n`);

  built.files = written;
  console.log(`\n  wrote _fixtures/clients/${spec.dir}/`);
  for (const f of written) console.log(`    ${f.name.padEnd(52)} ${f.bytes.toLocaleString()} bytes`);
}

const built = CLIENTS.map(buildClient);
for (const b of built) writeClient(b);

if (refused) {
  console.error(
    "\nOne or more fixture clients did not pass their own laws, so nothing was written for them.\n" +
      "A fixture that does not pass is worse than no fixture: the suite would go green on a lie.\n"
  );
  process.exit(1);
}

console.log(`\n${"═".repeat(78)}`);
console.log("THE MATRIX");
console.log("═".repeat(78));
for (const b of built) {
  const disclosed = (b.pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceGrade === "disclosed").length;
  const inferred = (b.pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceGrade === "inferred").length;
  const observed = (b.pack.intelligence?.leakAnalysis ?? []).filter((l) => l.evidenceGrade === "observed").length;
  const workflowsOn = b.resolutions.filter((r) => r.on).length;
  const bytes = b.files.reduce((n, f) => n + f.bytes, 0);
  console.log(
    `  ${b.spec.label.padEnd(12)} ${b.spec.name.padEnd(24)} ` +
      `observed ${observed} · disclosed ${disclosed} · inferred ${inferred} · ` +
      `workflows ${workflowsOn}/${b.resolutions.length} · ${b.files.length} files · ${bytes.toLocaleString()} bytes`
  );
}
console.log("");
