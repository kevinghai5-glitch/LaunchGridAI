// Builds a complete, ready-to-edit proposal from a business and (when present)
// its stored audit. The proposal sells ONE bespoke two-part engagement and is
// framed entirely around CONVERSION — turning the leads the business already
// pays for into booked, paying customers. It never sells lead generation, ads,
// SEO, or traffic.
//
// Every leak the proposal restates is pulled from the business's stored audit
// (AssetPack intelligence → ColdAudit findings) with its diagnosed dollar cost.
// When no audit exists we fall back to a CLEARLY LABELLED conservative
// assumption (never fabricated proof or invented numbers).

import type {
  AssetPack,
  ColdAuditReport,
  ProposalComponent,
  ProposalContent,
  ProposalFaq,
  ProposalLeak,
  ProposalPhase,
  ProposalProblem,
  ProposalProof,
  ProposalRoi,
  ProposalScope,
} from "@/types";
import { PRODUCT_NAME, AGENCY_NAME } from "./brand";
import { SETUP_FEE_CAD, MONTHLY_RETAINER_CAD } from "./constants";
import { formatCurrency } from "./utils";

// The proposal's prices ARE the offer's prices. Re-exported from the single
// source in constants.ts instead of re-typed, so a price change lands in the
// proposal and on the operator's screen in one edit and cannot half-happen.
export const DEFAULT_SETUP_FEE = SETUP_FEE_CAD; // one-time, CAD
export const DEFAULT_MONTHLY = MONTHLY_RETAINER_CAD; // retainer, CAD/mo

// Money convention, product-wide: the CAD marker goes BEFORE the figure
// ("CAD $2,400"), which is what formatCurrency() and leak-narrative's cad()
// both produce. A proposal that printed a bare "$2,400" beside a report that
// printed "CAD $2,400" reads like two different documents — and a bare dollar
// sign is ambiguous to a Canadian owner who assumes USD.
function fmtRange(low: number, high: number): string {
  if (low <= 0 && high <= 0) return "";
  if (low === high) return `${formatCurrency(low)} / mo`;
  return `${formatCurrency(low)}–${formatCurrency(high)} / mo`;
}

interface AuditSource {
  pack?: AssetPack | null;
  audit?: ColdAuditReport | null;
}

// Pull a [low, high] monthly dollar range out of a free-text cost line when the
// text happens to carry supplied figures. Returns [0,0] when none is found
// (the common pre-intake case, where cost lines are spend-anchored, not dollar).
function parseDollarRange(text: string): [number, number] {
  if (!text) return [0, 0];
  const nums = (text.match(/\$\s*([\d,]+(?:\.\d+)?)/g) ?? [])
    .map((m) => Number(m.replace(/[^\d.]/g, "")))
    .filter((n) => n > 0);
  if (!nums.length) return [0, 0];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [Math.min(...nums), Math.max(...nums)];
}

type LeakResult = { leaks: ProposalLeak[]; basis: string; totalLow: number; totalHigh: number };

// Build a leak result from the AssetPack's leak analysis (per-leak dollars).
function leaksFromPack(pack: AssetPack): LeakResult | null {
  const packLeaks = pack.intelligence?.leakAnalysis ?? [];
  if (!packLeaks.length) return null;
  const top = [...packLeaks]
    .sort((a, b) => (b.dollarImpact?.monthlyHigh ?? 0) - (a.dollarImpact?.monthlyHigh ?? 0))
    .slice(0, 4);
  let totalLow = 0;
  let totalHigh = 0;
  const leaks: ProposalLeak[] = top.map((l) => {
    const lo = l.dollarImpact?.monthlyLow ?? 0;
    const hi = l.dollarImpact?.monthlyHigh ?? 0;
    totalLow += lo;
    totalHigh += hi;
    return {
      title: l.area,
      monthlyCost: fmtRange(lo, hi) || "Cost to confirm on kickoff",
      detail: l.businessImpact || l.explanation || l.evidence,
    };
  });
  return { leaks, basis: "Pulled directly from your conversion audit.", totalLow, totalHigh };
}

// Build a leak result from a ColdAudit (single headline dollar gut-punch; per-leak
// figures stay blank — we never invent them).
function leaksFromAudit(audit: ColdAuditReport): LeakResult | null {
  const findings = audit.findings ?? [];
  if (!findings.length) return null;
  const leaks: ProposalLeak[] = findings.slice(0, 4).map((f) => ({
    title: f.title,
    monthlyCost: "",
    detail: f.whyItCosts || f.problem,
  }));
  const [totalLow, totalHigh] = parseDollarRange(audit.headlineCost ?? "");
  return {
    leaks,
    basis: audit.headlineCost
      ? `From your audit: ${audit.headlineCost}`
      : "From your audit. Exact per-leak dollar figures confirmed on kickoff.",
    totalLow,
    totalHigh,
  };
}

// Pull diagnosed conversion leaks from the source that actually dollarizes the
// leak. A pack/audit only "wins" when it yields real figures, so a stale or weak
// pack (no per-leak dollars) never shadows a grounded cold audit that has them.
function deriveLeaks(src: AuditSource): LeakResult {
  const packResult = src.pack ? leaksFromPack(src.pack) : null;
  const auditResult = src.audit ? leaksFromAudit(src.audit) : null;

  // Prefer whichever source produced real dollar figures.
  if (packResult && packResult.totalHigh > 0) return packResult;
  if (auditResult && auditResult.totalHigh > 0) return auditResult;
  // Neither dollarized: keep the richest real findings we have (pack first).
  if (packResult) return packResult;
  if (auditResult) return auditResult;

  // No audit on file — conservative, clearly-labelled placeholder leaks.
  //
  // NOTE ON WORDING: none of these may assume the business buys ads. Plenty of
  // these owners get their enquiries from their listing, word of mouth, or
  // repeat customers, and a proposal that says "your paid leads" to an owner who
  // has never bought a click reads as a template — the exact thing that loses
  // the room. "Enquiries you already get" is true either way.
  const leaks: ProposalLeak[] = [
    {
      title: "Slow response to new leads",
      monthlyCost: "",
      detail:
        "Leads that wait more than a few minutes for a reply book elsewhere. Every hour of delay quietly lowers how many of the enquiries you already get turn into jobs.",
    },
    {
      title: "No structured follow-up",
      monthlyCost: "",
      detail:
        "Leads who don't book on the first touch rarely get chased. Without a sequence working them, a large share go cold and never come back.",
    },
    {
      title: "No qualification before booking",
      monthlyCost: "",
      detail:
        "Without sorting leads up front, time goes to low-fit enquiries while ready-to-buy customers wait — and some leave before they're spoken to.",
    },
    {
      title: "No-shows and missed bookings",
      monthlyCost: "",
      detail:
        "Booked appointments with no confirmation or reminder cadence turn into no-shows — demand you already earned that never reaches your calendar.",
    },
  ];
  return {
    leaks,
    basis:
      "Conservative assumption — no audit is on file for this business yet. Run the audit, or confirm the exact figures on the kickoff call.",
    totalLow: 0,
    totalHigh: 0,
  };
}

// Map each diagnosed leak to a deployed component, with LeadGate as the
// continuously-running retainer engine. Done-for-you framing throughout (Law 3).
function deriveComponents(leaks: ProposalLeak[]): ProposalComponent[] {
  const components: ProposalComponent[] = [
    {
      name: `${PRODUCT_NAME} qualification engine`,
      addresses: "No qualification before booking",
      detail: `We deploy and run ${PRODUCT_NAME} — the engine that instantly responds to, qualifies, and routes every inbound lead so your team only spends time on the ones ready to buy. This runs continuously as part of the monthly retainer.`,
      isRetainer: true,
    },
    {
      name: "Speed-to-lead automation",
      addresses: "Slow response to new leads",
      detail:
        "We build automated instant-response across your forms, calls, and messages so a new lead hears back in seconds, not hours — the single biggest lever on whether a paid lead books.",
      isRetainer: false,
    },
    {
      name: "Multi-touch follow-up sequences",
      addresses: "No structured follow-up",
      detail:
        "We write and deploy email + SMS follow-up that keeps working every lead who doesn't book first time, so warm demand stops going cold.",
      isRetainer: false,
    },
    {
      name: "Booking page + reminder system",
      addresses: "No-shows and missed bookings",
      detail:
        "We build and brand your booking page inside GoHighLevel — one-tap booking, with confirmation and reminder cadences that cut no-shows and get more booked appointments to actually show up. It's the one page we build; your own website is untouched.",
      isRetainer: false,
    },
  ];

  // Re-point the "addresses" lines at the actual diagnosed leak titles when we
  // have a real audit, so each component visibly closes a named leak.
  const titles = leaks.map((l) => l.title.toLowerCase());
  for (const c of components) {
    const match = leaks.find((l) => {
      const t = l.title.toLowerCase();
      const a = c.addresses.toLowerCase();
      return t.includes(a.split(" ")[0]) || a.includes(t.split(" ")[0]);
    });
    if (match) c.addresses = match.title;
  }
  void titles;
  return components;
}

function deriveRoi(setupFee: number, monthly: number, totalLow: number, totalHigh: number): ProposalRoi {
  const hasNumbers = totalHigh > 0;
  const recovered = hasNumbers
    ? // conservatively recover ~a third to half of the diagnosed leak
      fmtRange(Math.round(totalLow * 0.33), Math.round(totalHigh * 0.5))
    : "";
  const firstYear = setupFee + monthly * 12;
  const points: string[] = [];
  if (hasNumbers) {
    points.push(
      `Your audit puts the conversion leak at roughly ${fmtRange(totalLow, totalHigh)}. Recovering even a conservative slice of that covers the full investment.`
    );
  } else {
    points.push(
      "The investment is designed to pay for itself from a small lift in the share of the enquiries you already get that become booked customers."
    );
  }
  points.push(
    // Marker BEFORE the figure, via formatCurrency — this line used to print
    // "$18,500 CAD", which is the one place in the proposal that broke the
    // product-wide money convention.
    `Total first-year investment is ${formatCurrency(firstYear)} — the one-time setup plus 12 months of retainer.`
  );
  points.push(
    // Was "…without raising your ad budget", which quietly assumed the owner buys
    // ads. We don't touch ad spend and many of these owners have none.
    "This is conversion, not spend: we lift results from the enquiries already coming in, so nothing here depends on you spending more to get found."
  );
  return {
    summary: hasNumbers
      ? `The system is built to recover ${recovered} in conversions you're currently losing — against an investment that's a fraction of that leak.`
      : "The system is built to convert more of the enquiries you already get into booked, paying customers — so it pays for itself from a modest lift in your close rate.",
    recovered,
    points,
  };
}

// A persisted proposal row, as returned by Prisma (Json columns are `unknown`).
interface ProposalRow {
  title: string;
  agencyName: string | null;
  setupFee: number;
  monthlyPrice: number;
  packageOverview: string;
  deliverables: unknown;
  problem: unknown;
  roi: unknown;
  scope: unknown;
  timeline: unknown;
  proof: unknown;
  faq: unknown;
  nextSteps: string | null;
  emailMessage: string | null;
  business: { name: string; industry?: string | null; city?: string | null };
}

// Assemble renderable ProposalContent from a stored row, falling back to
// audit-grounded defaults for any section an older row is missing.
export function proposalContentFromRow(row: ProposalRow): ProposalContent {
  const defaults = buildProposalDefaults(row.business);
  const deliverables = Array.isArray(row.deliverables) && row.deliverables.length
    ? (row.deliverables as ProposalComponent[])
    : defaults.deliverables;
  return {
    title: row.title || defaults.title,
    agencyName: row.agencyName ?? defaults.agencyName,
    setupFee: row.setupFee || defaults.setupFee,
    monthlyPrice: row.monthlyPrice || defaults.monthlyPrice,
    packageOverview: row.packageOverview || defaults.packageOverview,
    problem: (row.problem as ProposalProblem) ?? defaults.problem,
    deliverables,
    roi: (row.roi as ProposalRoi) ?? defaults.roi,
    scope: (row.scope as ProposalScope) ?? defaults.scope,
    timeline: (Array.isArray(row.timeline) ? (row.timeline as ProposalPhase[]) : null) ?? defaults.timeline,
    proof: (row.proof as ProposalProof) ?? defaults.proof,
    nextSteps: row.nextSteps ?? defaults.nextSteps,
    faq: (Array.isArray(row.faq) ? (row.faq as ProposalFaq[]) : null) ?? defaults.faq,
    emailMessage: row.emailMessage ?? defaults.emailMessage,
  };
}

export function buildProposalDefaults(
  business: { name: string; industry?: string | null; city?: string | null },
  src: AuditSource = {}
): ProposalContent {
  const setupFee = DEFAULT_SETUP_FEE;
  const monthlyPrice = DEFAULT_MONTHLY;
  const { leaks, basis, totalLow, totalHigh } = deriveLeaks(src);
  const components = deriveComponents(leaks);

  const problem: ProposalProblem = {
    summary: `${business.name} already gets leads — the issue isn't getting found, it's how many of those leads turn into booked, paying customers. The audit surfaced specific places where qualified demand is leaking out before it converts.`,
    basis,
    leaks,
  };

  const roi = deriveRoi(setupFee, monthlyPrice, totalLow, totalHigh);

  return {
    title: `Client Conversion System for ${business.name}`,
    agencyName: AGENCY_NAME.toLowerCase() === "our team" ? "" : AGENCY_NAME,
    setupFee,
    monthlyPrice,
    // "any page we touch" used to appear here — it implied we edit their website,
    // which contradicts the absolute exclusion three fields down. We build one
    // page (the booking page, inside GoHighLevel) and touch nothing else.
    packageOverview: `The visible problems in the audit are symptoms — where the leak shows up. What we build and run is the system behind them: instant lead response, qualification through ${PRODUCT_NAME}, structured follow-up, and a booking flow that reduces no-shows. We build all of it for you inside GoHighLevel and we run it — you implement nothing. This is not a website redesign: we don't touch your site, and anything the audit says about it is advisory, for whoever looks after it. The one page we build is your booking page. You keep your current lead sources — we make far more of them turn into paying jobs.`,
    problem,
    deliverables: components,
    roi,
    scope: {
      // Every line says WHICH of the two parts it belongs to. A flat list reads
      // as one bill, and the most expensive misunderstanding available on a call
      // is a client who thinks the qualification engine came with the one-time
      // build and then sees a monthly invoice for it.
      included: [
        "One-time build — the four deliverables: your leak diagnosis, the infrastructure blueprint, the conversion copy, and the implementation timeline",
        "One-time build — done-for-you setup of the full conversion system inside GoHighLevel: workflows, CRM pipeline, and lead-capture form",
        "One-time build — instant speed-to-lead response across your forms, calls, and messages",
        "One-time build — email + SMS follow-up sequences, written and deployed for you",
        "One-time build — your booking page, built and branded for you inside GoHighLevel, with confirmation and reminder cadences to cut no-shows",
        `Monthly retainer — the ${PRODUCT_NAME} qualification engine, running continuously on every new lead`,
        "Monthly retainer — we run, monitor, and tune the live system, and send you a monthly report",
      ],
      // ABSOLUTE exclusions. Each of these used to be phrased as a carve-out
      // ("beyond the conversion path", "paid separately") which implies some
      // website work and some ad involvement are in scope. They are not, at any
      // price — a carve-out is a scope argument waiting to happen on the call.
      excluded: [
        "Advertising of any kind — we don't run, manage, buy, or advise on ads or media",
        "Lead generation, new traffic, or SEO — this system converts the leads you already get",
        "Website design, build, or redesign — we don't touch your site. Anything we say about it is advisory only; the page we build and brand for you lives inside GoHighLevel",
      ],
    },
    timeline: [
      {
        label: "Week 1–2 — Build & deploy",
        // Was a hardcoded "LeadGate" — the product name is configurable, so a
        // literal here would have printed the wrong name the day it changes.
        detail: `We map your current lead flow, then build and launch the full system for you inside GoHighLevel: speed-to-lead response, ${PRODUCT_NAME} qualification, follow-up sequences, and your booking page. Done-for-you — you review, we ship.`,
      },
      {
        label: "Ongoing — Run & optimise",
        detail: `From go-live, ${PRODUCT_NAME} runs continuously while we manage, test, and tune the system. You receive a monthly report showing booked conversions recovered. This is what the monthly retainer covers.`,
      },
    ],
    proof: {
      note: "Add your own results and client testimonials here before sending. Never use placeholder or invented proof.",
      testimonials: [],
    },
    nextSteps:
      "Accept this proposal to lock in the build, then we book a short kickoff call to map your lead flow. Your conversion system goes live within two weeks.",
    faq: [
      {
        q: "Is this lead generation?",
        a: "No. You already get enquiries. This system converts more of them into booked, paying customers — we don't sell traffic, ads, or SEO, and we don't touch what you spend to get found.",
      },
      {
        q: "Is this a website redesign?",
        a: "No — and we don't touch your website at all. The things you can see on the page are just where the leak shows up. What you're buying is the system behind them: instant lead response, qualification, follow-up, and booking, all built and run by us. Anything the audit says about your own site is advisory — notes you can hand to whoever looks after it. The one page we build is your booking page.",
      },
      {
        q: "What's the difference between the setup fee and the monthly?",
        a: `The one-time setup covers the four deliverables and the full done-for-you build — every workflow, your CRM pipeline, and your booking page. The monthly retainer is separate and covers what runs after go-live: ${PRODUCT_NAME} qualifying every new lead, us running and tuning the system, and your monthly report. ${PRODUCT_NAME} sits in the retainer, not the build.`,
      },
      {
        q: "What do I need to do?",
        a: "Very little. This is done-for-you — we build the system and we run it, so nothing lands on you or your staff to implement. After a short kickoff call you approve the copy, take the calls it books, and watch booked jobs go up.",
      },
    ],
    emailMessage: `Hi — I put together a short proposal for ${business.name}. It's focused on one thing: converting more of the leads you already get into booked customers. It lays out exactly what's leaking, what we'd build, and the investment. Take a look and let me know if you'd like to book a quick kickoff.`,
  };
}
