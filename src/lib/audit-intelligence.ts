// Audit intelligence layer.
//
// Turns raw inputs (scraped site HTML, Google reviews, local competitors) into
// structured signals the generation engine can reason over — CTA / booking /
// trust detection on the live site, review sentiment + theme extraction, and
// competitor benchmarking. Every enricher is best-effort and degrades
// gracefully: when a real signal is unavailable it is omitted and a labelled
// strategic assumption is recorded instead of fabricating data.
//
// Heuristic by design (regex + keyword buckets, no extra API calls). Built
// modularly so a future vision/screenshot enricher can append to the same
// AuditIntelligence shape without touching callers.

import type { PlaceReview, CompetitorResult } from "./google-places";
import type { BusinessFacts } from "./business-facts";
import { factsToPromptBlock } from "./business-facts";
import type { PsiBundle } from "./pagespeed";
import { psiToPromptBlock } from "./pagespeed";
import type { DataForSeoBundle } from "./dataforseo";
import { dfsToPromptBlock } from "./dataforseo";
import type { ScreenshotBundle } from "./screenshotone";

export interface WebsiteSignals {
  hasWebsite: boolean;
  ctaDetected: boolean;
  ctaSamples: string[];
  bookingDetected: boolean;
  bookingProviders: string[];
  formDetected: boolean;
  phoneClickable: boolean;
  trust: {
    mentionsReviews: boolean;
    testimonials: boolean;
    guarantee: boolean;
    licensedInsured: boolean;
    certifications: boolean;
    awards: boolean;
  };
  // Marketing-stack fingerprint from the live HTML (script/pixel/embed detection).
  // Presence proves they're already investing; absence is a concrete, named leak.
  marketing: {
    metaPixel: boolean;
    googleAdsTag: boolean;
    analytics: string[];
    tiktokPixel: boolean;
    chat: string[];
    emailMarketing: string[];
    crm: string[];
  };
}

const EMPTY_MARKETING: WebsiteSignals["marketing"] = {
  metaPixel: false,
  googleAdsTag: false,
  analytics: [],
  tiktokPixel: false,
  chat: [],
  emailMarketing: [],
  crm: [],
};

export interface ReviewIntel {
  available: boolean;
  count: number;
  averageRating: number | null;
  trustDrivers: string[];
  painPoints: string[];
  sampleQuotes: { rating: number; text: string }[];
}

export interface CompetitorIntel {
  available: boolean;
  count: number;
  averageRating: number | null;
  averageReviewCount: number | null;
  withWebsite: number;
  withoutWebsite: number;
  topRated: { name: string; rating: number; reviewCount: number }[];
  observations: string[];
}

export interface AuditIntelligence {
  website: WebsiteSignals;
  reviews: ReviewIntel;
  competitors: CompetitorIntel;
  verifiedFacts: BusinessFacts | null;
  performance: PsiBundle | null;
  dataForSeo: DataForSeoBundle | null;
  screenshots: ScreenshotBundle | null;
  dataConfidence: "high" | "medium" | "low";
  assumptions: string[];
}

const BOOKING_PROVIDERS: Record<string, string> = {
  calendly: "Calendly",
  acuityscheduling: "Acuity",
  acuity: "Acuity",
  squareup: "Square Appointments",
  setmore: "Setmore",
  schedulicity: "Schedulicity",
  vagaro: "Vagaro",
  booksy: "Booksy",
  mindbody: "Mindbodyonline",
  housecallpro: "Housecall Pro",
  jobber: "Jobber",
  "gohighlevel": "HighLevel",
  "leadconnectorhq": "HighLevel",
  zcal: "Zcal",
  "cal.com": "Cal.com",
};

// Live-chat / messaging widgets — presence means they're capturing inbound
// conversation; absence on a service site is a responsiveness leak.
const CHAT_PROVIDERS: Record<string, string> = {
  "tawk.to": "Tawk.to",
  intercom: "Intercom",
  drift: "Drift",
  "crisp.chat": "Crisp",
  zdassets: "Zendesk Chat",
  zendesk: "Zendesk",
  livechatinc: "LiveChat",
  tidio: "Tidio",
  hubspot: "HubSpot Chat",
  podium: "Podium",
  birdeye: "Birdeye",
  "manychat": "ManyChat",
};

// Email-marketing / list-building platforms — presence means an email channel
// exists; absence is the single biggest follow-up leak we can name concretely.
const EMAIL_PROVIDERS: Record<string, string> = {
  mailchimp: "Mailchimp",
  "list-manage": "Mailchimp",
  klaviyo: "Klaviyo",
  constantcontact: "Constant Contact",
  "ctctcdn": "Constant Contact",
  convertkit: "ConvertKit",
  "kit.com": "ConvertKit",
  aweber: "AWeber",
  activecampaign: "ActiveCampaign",
  getdrip: "Drip",
  sendinblue: "Brevo",
  brevo: "Brevo",
  hubspotusercontent: "HubSpot",
  mailerlite: "MailerLite",
  omnisend: "Omnisend",
};

// CRM / lead-management platforms — presence means leads are being tracked;
// absence means leads likely live in a phone/inbox with no system behind them.
const CRM_PROVIDERS: Record<string, string> = {
  "hs-scripts": "HubSpot CRM",
  "hsforms": "HubSpot CRM",
  salesforce: "Salesforce",
  "pardot": "Salesforce Pardot",
  zoho: "Zoho",
  pipedrive: "Pipedrive",
  gohighlevel: "HighLevel",
  leadconnectorhq: "HighLevel",
  keap: "Keap",
  infusionsoft: "Keap",
};

const CTA_PATTERNS = [
  "book",
  "schedule",
  "appointment",
  "get a quote",
  "request a quote",
  "free consultation",
  "free estimate",
  "contact us",
  "call now",
  "get started",
  "claim",
  "reserve",
  "sign up",
];

// --- Website signal detection -------------------------------------------------

// Fingerprint the marketing stack from raw HTML by matching known script hosts,
// pixel IDs and embed snippets. All matchers are substring/regex on the lowered
// HTML — best-effort and presence-only (we never claim spend or performance).
function detectMarketing(lower: string): WebsiteSignals["marketing"] {
  const matchProviders = (map: Record<string, string>): string[] =>
    Array.from(
      new Set(
        Object.entries(map)
          .filter(([key]) => lower.includes(key))
          .map(([, label]) => label)
      )
    );

  const analytics = new Set<string>();
  if (/gtag\(|googletagmanager\.com\/gtag\/js|google-analytics\.com\/(g\/collect|analytics\.js)|\bga\(/.test(lower))
    analytics.add("Google Analytics");
  if (/googletagmanager\.com\/gtm\.js|\bgtm-[a-z0-9]+\b/.test(lower))
    analytics.add("Google Tag Manager");
  if (/hotjar\.com|static\.hotjar/.test(lower)) analytics.add("Hotjar");
  if (/clarity\.ms/.test(lower)) analytics.add("Microsoft Clarity");

  return {
    metaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init|facebook pixel/.test(lower),
    googleAdsTag: /googleadservices\.com|googletagmanager\.com\/gtag\/js\?id=aw-|gtag\(\s*['"]config['"]\s*,\s*['"]aw-/.test(lower),
    analytics: Array.from(analytics),
    tiktokPixel: /analytics\.tiktok\.com|ttq\.load|ttq\.track/.test(lower),
    chat: matchProviders(CHAT_PROVIDERS),
    emailMarketing: matchProviders(EMAIL_PROVIDERS),
    crm: matchProviders(CRM_PROVIDERS),
  };
}

export function analyzeWebsite(html: string): WebsiteSignals {
  if (!html) {
    return {
      hasWebsite: false,
      ctaDetected: false,
      ctaSamples: [],
      bookingDetected: false,
      bookingProviders: [],
      formDetected: false,
      phoneClickable: false,
      trust: {
        mentionsReviews: false,
        testimonials: false,
        guarantee: false,
        licensedInsured: false,
        certifications: false,
        awards: false,
      },
      marketing: EMPTY_MARKETING,
    };
  }

  const lower = html.toLowerCase();

  // CTA detection: scan visible text inside <a> / <button> for action language.
  const ctaSamples = new Set<string>();
  const clickableText = Array.from(
    html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)
  );
  for (const match of clickableText) {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length > 60) continue;
    const t = text.toLowerCase();
    if (CTA_PATTERNS.some((p) => t.includes(p))) {
      ctaSamples.add(text);
      if (ctaSamples.size >= 6) break;
    }
  }

  const bookingProviders = Object.entries(BOOKING_PROVIDERS)
    .filter(([key]) => lower.includes(key))
    .map(([, label]) => label);

  return {
    hasWebsite: true,
    ctaDetected: ctaSamples.size > 0,
    ctaSamples: Array.from(ctaSamples),
    bookingDetected:
      bookingProviders.length > 0 ||
      /book (an? )?(appointment|consultation|call)|schedule (an? )?(appointment|consultation|call)/i.test(
        lower
      ),
    bookingProviders: Array.from(new Set(bookingProviders)),
    formDetected: /<form\b/i.test(lower),
    phoneClickable: /href=["']tel:/i.test(lower),
    trust: {
      mentionsReviews: /\breview(s|ed)?\b|\bgoogle reviews?\b|\bstar(s| rating)\b/.test(lower),
      testimonials: /testimonial|what (our )?clients say|client stories|happy customers/.test(lower),
      guarantee: /guarantee|money[\s-]?back|satisfaction guaranteed|warranty/.test(lower),
      licensedInsured: /licensed|insured|bonded/.test(lower),
      certifications: /certified|accredited|board[\s-]?certified|bbb|better business bureau/.test(lower),
      awards: /award|best of|voted|#1 |top[\s-]?rated/.test(lower),
    },
    marketing: detectMarketing(lower),
  };
}

// --- Review sentiment + theme extraction -------------------------------------

const TRUST_DRIVER_THEMES: Record<string, RegExp> = {
  "Professionalism": /professional|knowledgeable|expert|skilled/i,
  "Friendly & personable staff": /friendly|kind|welcoming|personable|caring|courteous/i,
  "Punctuality & reliability": /on time|prompt|reliable|punctual|showed up|quick/i,
  "Cleanliness & environment": /clean|spotless|comfortable|modern|tidy/i,
  "Fair, transparent pricing": /fair price|reasonable|honest|transparent|good value|affordable/i,
  "Quality of results": /great (job|work|results)|amazing|excellent|highly recommend|best/i,
  "Clear communication": /communicat|explained|answered|responsive|kept me informed/i,
};

const PAIN_POINT_THEMES: Record<string, RegExp> = {
  "Long wait / delays": /wait(ed|ing)?|delay|slow|took (forever|too long)|behind schedule/i,
  "Pricing concerns": /expensive|overpriced|pricey|too much|hidden (fee|cost)|upcharge/i,
  "Poor communication": /didn'?t (call|respond|answer)|no (response|callback)|hard to reach|ignored/i,
  "Scheduling friction": /cancel|reschedul|no[\s-]?show|missed (the )?appointment|double[\s-]?booked/i,
  "Rude / unprofessional": /rude|unprofessional|dismissive|disrespect/i,
  "Unmet expectations": /disappoint|not what (i|we) expected|let down|subpar|mediocre/i,
};

export function analyzeReviews(reviews: PlaceReview[]): ReviewIntel {
  if (!reviews || reviews.length === 0) {
    return {
      available: false,
      count: 0,
      averageRating: null,
      trustDrivers: [],
      painPoints: [],
      sampleQuotes: [],
    };
  }

  const corpus = reviews.map((r) => r.text).join("\n").toLowerCase();
  const rated = reviews.filter((r) => r.rating > 0);
  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
      : null;

  const trustDrivers = Object.entries(TRUST_DRIVER_THEMES)
    .filter(([, re]) => re.test(corpus))
    .map(([label]) => label);

  // Pain points weighted toward lower-rated reviews, but scan the whole corpus.
  const painPoints = Object.entries(PAIN_POINT_THEMES)
    .filter(([, re]) => re.test(corpus))
    .map(([label]) => label);

  const sampleQuotes = reviews
    .slice(0, 4)
    .map((r) => ({
      rating: r.rating,
      text: r.text.length > 280 ? `${r.text.slice(0, 277)}…` : r.text,
    }));

  return {
    available: true,
    count: reviews.length,
    averageRating,
    trustDrivers,
    painPoints,
    sampleQuotes,
  };
}

// --- Competitor benchmarking --------------------------------------------------

export function analyzeCompetitors(
  competitors: CompetitorResult[],
  self: { rating?: number | null; reviewCount?: number | null }
): CompetitorIntel {
  if (!competitors || competitors.length === 0) {
    return {
      available: false,
      count: 0,
      averageRating: null,
      averageReviewCount: null,
      withWebsite: 0,
      withoutWebsite: 0,
      topRated: [],
      observations: [],
    };
  }

  const rated = competitors.filter((c) => c.rating > 0);
  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, c) => s + c.rating, 0) / rated.length) * 10) / 10
      : null;
  const reviewed = competitors.filter((c) => c.reviewCount > 0);
  const averageReviewCount =
    reviewed.length > 0
      ? Math.round(reviewed.reduce((s, c) => s + c.reviewCount, 0) / reviewed.length)
      : null;
  const withWebsite = competitors.filter((c) => c.website).length;
  const withoutWebsite = competitors.length - withWebsite;

  const topRated = [...competitors]
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 3)
    .map((c) => ({ name: c.name, rating: c.rating, reviewCount: c.reviewCount }));

  const observations: string[] = [];
  if (averageReviewCount !== null) {
    observations.push(
      `Local competitors average ~${averageReviewCount} reviews; review volume is a visible differentiator in this market.`
    );
  }
  if (withoutWebsite > 0) {
    observations.push(
      `${withoutWebsite} of ${competitors.length} nearby competitors have no website on their Google listing — a conversion gap to exploit.`
    );
  }
  if (averageRating !== null && self.rating != null && self.rating > 0) {
    if (self.rating >= averageRating) {
      observations.push(
        `This business (${self.rating}★) rates at or above the local average (${averageRating}★) — a trust advantage to lead with.`
      );
    } else {
      observations.push(
        `This business (${self.rating}★) trails the local average (${averageRating}★) — reputation recovery should factor into positioning.`
      );
    }
  }
  if (
    averageReviewCount !== null &&
    self.reviewCount != null &&
    self.reviewCount > 0 &&
    self.reviewCount < averageReviewCount
  ) {
    observations.push(
      `Review count (${self.reviewCount}) is below the local average — a review-generation system is a fast credibility win.`
    );
  }

  return {
    available: true,
    count: competitors.length,
    averageRating,
    averageReviewCount,
    withWebsite,
    withoutWebsite,
    topRated,
    observations,
  };
}

// --- Orchestrator -------------------------------------------------------------

export interface AuditIntelligenceInput {
  websiteHtml: string;
  hasWebsiteUrl: boolean;
  reviews: PlaceReview[];
  competitors: CompetitorResult[];
  self: { rating?: number | null; reviewCount?: number | null };
  verifiedFacts?: BusinessFacts | null;
  performance?: PsiBundle | null;
  dataForSeo?: DataForSeoBundle | null;
  screenshots?: ScreenshotBundle | null;
}

export function buildAuditIntelligence(
  input: AuditIntelligenceInput
): AuditIntelligence {
  const website = analyzeWebsite(input.websiteHtml);
  const reviews = analyzeReviews(input.reviews);
  const competitors = analyzeCompetitors(input.competitors, input.self);
  const verifiedFacts = input.verifiedFacts ?? null;
  const performance = input.performance ?? null;
  const dataForSeo = input.dataForSeo ?? null;
  const screenshots = input.screenshots ?? null;

  const assumptions: string[] = [];
  if (!input.hasWebsiteUrl) {
    assumptions.push(
      "No website URL on record — landing-page and conversion findings are strategic assumptions based on the niche, not the live site."
    );
  } else if (!website.hasWebsite) {
    assumptions.push(
      "The website could not be read automatically — on-page findings are inferred from the niche and Places data."
    );
  }
  if (!reviews.available && !(dataForSeo?.reviews.available)) {
    assumptions.push(
      "No Google review text was available — trust and sentiment findings are strategic assumptions, not extracted from real reviews."
    );
  }
  if (!competitors.available) {
    assumptions.push(
      "Local competitor data was unavailable — positioning is based on common patterns for this niche and city."
    );
  }
  if (!performance?.available) {
    assumptions.push(
      "Live page-speed data was unavailable — technical UX findings are strategic assumptions, not measured."
    );
  }

  // Confidence reflects how much of the audit rests on real vs assumed data.
  // We now weight in the deeper signals (deep reviews, perf, screenshots, verified facts).
  const realSignals = [
    website.hasWebsite,
    reviews.available || Boolean(dataForSeo?.reviews.available),
    competitors.available,
    Boolean(performance?.available),
    Boolean(dataForSeo?.gbp.available),
    Boolean(screenshots?.available),
    Boolean(verifiedFacts && (verifiedFacts.phones.value.length || verifiedFacts.services.value.length)),
  ].filter(Boolean).length;

  const dataConfidence =
    realSignals >= 5 ? "high" : realSignals >= 3 ? "medium" : "low";

  return {
    website,
    reviews,
    competitors,
    verifiedFacts,
    performance,
    dataForSeo,
    screenshots,
    dataConfidence,
    assumptions,
  };
}

// Render the intelligence into a compact, prompt-friendly briefing block.
export function intelligenceToPromptBlock(intel: AuditIntelligence): string {
  const lines: string[] = [];

  lines.push(`DATA CONFIDENCE: ${intel.dataConfidence.toUpperCase()}`);

  lines.push("\nLIVE WEBSITE SIGNALS:");
  if (intel.website.hasWebsite) {
    lines.push(`- CTA detected: ${intel.website.ctaDetected ? "yes" : "no"}${intel.website.ctaSamples.length ? ` (e.g. ${intel.website.ctaSamples.map((s) => `"${s}"`).join(", ")})` : ""}`);
    lines.push(`- Online booking: ${intel.website.bookingDetected ? `yes${intel.website.bookingProviders.length ? ` via ${intel.website.bookingProviders.join(", ")}` : ""}` : "no — appears to rely on phone/contact only"}`);
    lines.push(`- Lead capture form: ${intel.website.formDetected ? "yes" : "no"}`);
    lines.push(`- Click-to-call phone: ${intel.website.phoneClickable ? "yes" : "no"}`);
    const trust = intel.website.trust;
    const present = Object.entries({
      reviews: trust.mentionsReviews,
      testimonials: trust.testimonials,
      guarantee: trust.guarantee,
      "licensed/insured": trust.licensedInsured,
      certifications: trust.certifications,
      awards: trust.awards,
    })
      .filter(([, v]) => v)
      .map(([k]) => k);
    lines.push(`- Trust signals present: ${present.length ? present.join(", ") : "none detected"}`);

    // Marketing-stack fingerprint: name what they DO run, and flag concrete
    // missing channels as leaks (this is real, observed evidence from the HTML).
    const m = intel.website.marketing;
    const running: string[] = [];
    if (m.metaPixel) running.push("Meta Pixel");
    if (m.googleAdsTag) running.push("Google Ads tag");
    if (m.tiktokPixel) running.push("TikTok Pixel");
    running.push(...m.analytics);
    if (m.chat.length) running.push(`chat (${m.chat.join(", ")})`);
    if (m.emailMarketing.length) running.push(`email marketing (${m.emailMarketing.join(", ")})`);
    if (m.crm.length) running.push(`CRM (${m.crm.join(", ")})`);
    lines.push(`- Marketing stack detected on site: ${running.length ? running.join(", ") : "none detected"}`);

    const missing: string[] = [];
    if (!m.emailMarketing.length)
      missing.push("no email-marketing platform — no list-building or follow-up sequences detected");
    if (!m.crm.length)
      missing.push("no CRM/lead-management tool — inbound leads likely tracked manually, if at all");
    if (!m.chat.length)
      missing.push("no live-chat/messaging widget — website visitors can't start a conversation instantly");
    if (!m.metaPixel && !m.googleAdsTag && !m.tiktokPixel)
      missing.push("no ad-retargeting pixels — site visitors who don't convert can't be re-reached with ads");
    if (missing.length) {
      lines.push("- MARKETING-STACK LEAKS (observed from the live HTML — concrete, not assumed):");
      missing.forEach((leak) => lines.push(`  · ${leak}`));
    }
  } else {
    lines.push("- Website could not be read; treat on-page findings as strategic assumptions.");
  }

  lines.push("\nGOOGLE REVIEW INTELLIGENCE:");
  if (intel.reviews.available) {
    lines.push(`- ${intel.reviews.count} reviews sampled, avg ${intel.reviews.averageRating ?? "n/a"}★`);
    if (intel.reviews.trustDrivers.length)
      lines.push(`- Customers praise: ${intel.reviews.trustDrivers.join(", ")}`);
    if (intel.reviews.painPoints.length)
      lines.push(`- Recurring friction/complaints: ${intel.reviews.painPoints.join(", ")}`);
    intel.reviews.sampleQuotes.forEach((q) =>
      lines.push(`- Quote (${q.rating}★): "${q.text}"`)
    );
  } else {
    lines.push("- No review text available. Do NOT invent review insights.");
  }

  lines.push("\nLOCAL COMPETITOR INTELLIGENCE:");
  if (intel.competitors.available) {
    lines.push(
      `- ${intel.competitors.count} competitors; avg ${intel.competitors.averageRating ?? "n/a"}★, avg ${intel.competitors.averageReviewCount ?? "n/a"} reviews; ${intel.competitors.withoutWebsite} have no website.`
    );
    intel.competitors.topRated.forEach((c) =>
      lines.push(`- Top: ${c.name} (${c.rating}★, ${c.reviewCount} reviews)`)
    );
    intel.competitors.observations.forEach((o) => lines.push(`- ${o}`));
  } else {
    lines.push("- No competitor data. Base positioning on common niche patterns.");
  }

  if (intel.verifiedFacts) {
    lines.push("");
    lines.push(factsToPromptBlock(intel.verifiedFacts));
  }

  if (intel.performance) {
    lines.push("");
    lines.push(psiToPromptBlock(intel.performance));
  }

  if (intel.dataForSeo) {
    lines.push("");
    lines.push(dfsToPromptBlock(intel.dataForSeo));
  }

  if (intel.screenshots?.available) {
    lines.push("");
    lines.push(
      `VISUAL INTELLIGENCE: ${intel.screenshots.shots.length} above-the-fold screenshots captured (target + competitors, desktop + mobile). The deliverable embeds these so the buyer can SEE the competitive landscape — reference visual differences (hero clarity, CTA prominence, trust signal placement, mobile UX gaps) where relevant.`
    );
  }

  if (intel.assumptions.length) {
    lines.push("\nLABELLED ASSUMPTIONS (state these as assumptions, never as data):");
    intel.assumptions.forEach((a) => lines.push(`- ${a}`));
  }

  return lines.join("\n");
}
