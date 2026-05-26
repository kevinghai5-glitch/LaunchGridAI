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
}

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
}

export function buildAuditIntelligence(
  input: AuditIntelligenceInput
): AuditIntelligence {
  const website = analyzeWebsite(input.websiteHtml);
  const reviews = analyzeReviews(input.reviews);
  const competitors = analyzeCompetitors(input.competitors, input.self);

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
  if (!reviews.available) {
    assumptions.push(
      "No Google review text was available — trust and sentiment findings are strategic assumptions, not extracted from real reviews."
    );
  }
  if (!competitors.available) {
    assumptions.push(
      "Local competitor data was unavailable — positioning is based on common patterns for this niche and city."
    );
  }

  // Confidence reflects how much of the audit rests on real vs assumed data.
  const realSignals = [website.hasWebsite, reviews.available, competitors.available].filter(
    Boolean
  ).length;
  const dataConfidence =
    realSignals >= 3 ? "high" : realSignals === 2 ? "medium" : "low";

  return { website, reviews, competitors, dataConfidence, assumptions };
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

  if (intel.assumptions.length) {
    lines.push("\nLABELLED ASSUMPTIONS (state these as assumptions, never as data):");
    intel.assumptions.forEach((a) => lines.push(`- ${a}`));
  }

  return lines.join("\n");
}
