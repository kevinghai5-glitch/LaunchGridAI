// DataForSEO integration — tactical, conversion-focused only.
//
// Two live endpoints:
//   1. Business Data → Google → My Business Info (live, advanced)
//      Pulls verified Google Business Profile fields for the target business —
//      name, address, phone, website, category, rating, review count, hours,
//      attributes — and we surface "what's missing" (incomplete profile signals).
//   2. Business Data → Google → Reviews (live)
//      Pulls up to 20 reviews with sentiment we can theme — deeper than Places.
//
// No backlink/keyword/SERP-rank work — we intentionally avoid SEO-dashboard
// bloat per product direction.
//
// Best-effort: every function returns null/empty on any failure.

const DFS_BASE = "https://api.dataforseo.com/v3";

function dfsAuthHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function dfsPost<T>(path: string, body: unknown[]): Promise<T | null> {
  const auth = dfsAuthHeader();
  if (!auth) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${DFS_BASE}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Business Profile completeness ────────────────────────────────────────────

export interface GbpProfile {
  available: boolean;
  category: string | null;
  hasHours: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasMenuLink: boolean;
  hasBookingLink: boolean;
  hasPhotos: boolean;
  attributesPresent: string[];
  attributesMissing: string[]; // conversion-relevant gaps (e.g. "no online booking attribute")
}

interface DfsGbpItem {
  category?: string;
  work_time?: unknown;
  url?: string;
  phone?: string;
  menu_url?: string;
  book_online_url?: string;
  total_photos?: number;
  attributes?: Record<string, unknown> | string[];
}

interface DfsResult<T> {
  tasks?: { result?: { items?: T[] }[] }[];
}

const HIGH_VALUE_ATTRS = [
  "online_booking",
  "appointment_required",
  "wheelchair_accessible",
  "free_wifi",
  "credit_cards",
  "delivery",
  "takeout",
  "reservations",
];

export async function fetchGbpProfile(
  name: string | null | undefined,
  address: string | null | undefined
): Promise<GbpProfile> {
  const empty: GbpProfile = {
    available: false,
    category: null,
    hasHours: false,
    hasWebsite: false,
    hasPhone: false,
    hasMenuLink: false,
    hasBookingLink: false,
    hasPhotos: false,
    attributesPresent: [],
    attributesMissing: HIGH_VALUE_ATTRS,
  };
  if (!name || !dfsAuthHeader()) return empty;

  const keyword = address ? `${name} ${address}` : name;
  const data = await dfsPost<DfsResult<DfsGbpItem>>(
    "/business_data/google/my_business_info/live",
    [
      {
        keyword,
        language_code: "en",
        location_code: 2840, // United States — adequate generic anchor
      },
    ]
  );

  const item = data?.tasks?.[0]?.result?.[0]?.items?.[0];
  if (!item) return empty;

  const attrs = item.attributes;
  const present = new Set<string>();
  if (Array.isArray(attrs)) {
    for (const a of attrs) if (typeof a === "string") present.add(a.toLowerCase());
  } else if (attrs && typeof attrs === "object") {
    for (const k of Object.keys(attrs)) present.add(k.toLowerCase());
  }

  return {
    available: true,
    category: item.category ?? null,
    hasHours: Boolean(item.work_time),
    hasWebsite: Boolean(item.url),
    hasPhone: Boolean(item.phone),
    hasMenuLink: Boolean(item.menu_url),
    hasBookingLink: Boolean(item.book_online_url),
    hasPhotos: typeof item.total_photos === "number" ? item.total_photos > 0 : false,
    attributesPresent: Array.from(present),
    attributesMissing: HIGH_VALUE_ATTRS.filter((a) => !present.has(a)),
  };
}

// ── Deeper Review Intelligence ───────────────────────────────────────────────

export interface DfsReview {
  rating: number;
  text: string;
  date: string | null;
}

export interface DfsReviewIntel {
  available: boolean;
  count: number;
  averageRating: number | null;
  positive: number;
  neutral: number;
  negative: number;
  positiveThemes: string[];
  negativeThemes: string[];
  trustGaps: string[]; // distilled trust-eroding patterns
  recentNegativeQuote: string | null;
  recentPositiveQuote: string | null;
}

interface DfsReviewItem {
  rating?: { value?: number };
  review_text?: string;
  text?: string;
  timestamp?: string;
}

const POSITIVE_THEMES: Record<string, RegExp> = {
  "Professionalism / expertise": /professional|knowledgeable|expert|skilled|experienced/i,
  "Friendly / personable staff": /friendly|kind|welcoming|personable|caring|warm|courteous/i,
  "Punctual / reliable": /on time|prompt|reliable|punctual|showed up|quick/i,
  "Clean / modern environment": /clean|spotless|comfortable|modern|tidy|beautiful/i,
  "Fair / transparent pricing": /fair price|reasonable|honest|transparent|good value|affordable/i,
  "Strong results / quality": /great (job|work|results)|amazing|excellent|highly recommend|best|life[-\s]?changing/i,
  "Clear communication": /communicat|explained|answered|responsive|kept (me|us) informed/i,
};

const NEGATIVE_THEMES: Record<string, RegExp> = {
  "Long waits / delays": /wait(ed|ing)?|delay|slow|took (forever|too long)|behind schedule/i,
  "Pricing surprises / overpriced": /expensive|overpriced|pricey|too much|hidden (fee|cost)|upcharge|sticker shock/i,
  "Poor communication": /didn'?t (call|respond|answer)|no (response|callback)|hard to reach|ignored/i,
  "Scheduling friction / no-shows": /cancel|reschedul|no[\s-]?show|missed (the )?appointment|double[\s-]?booked/i,
  "Rude / unprofessional": /rude|unprofessional|dismissive|disrespect/i,
  "Unmet expectations": /disappoint|not what (i|we) expected|let down|subpar|mediocre/i,
  "Cleanliness / environment issues": /dirty|filthy|smell(y|ed)?|unsanitary|gross/i,
};

const TRUST_GAP_HINTS: { match: RegExp; gap: string }[] = [
  { match: /hidden (fee|cost)|upcharge|surprise (bill|fee)/i, gap: "Pricing transparency gap (clients reporting unexpected charges)" },
  { match: /didn'?t (call|respond|answer)|no (response|callback)/i, gap: "Lead-response gap (slow or missed callbacks during sales cycle)" },
  { match: /no[\s-]?show|missed (the )?appointment|cancel(led)? last minute/i, gap: "Reliability gap (cancellations / no-shows hurting trust)" },
  { match: /rude|dismissive|disrespect/i, gap: "Front-line professionalism gap (rude or dismissive staff interactions)" },
  { match: /dirty|smell(y|ed)?|unsanitary/i, gap: "Cleanliness gap (environment perception undermining premium pricing)" },
];

function classify(text: string): "positive" | "neutral" | "negative" {
  if (/love|amazing|excellent|highly recommend|the best|incredible|fantastic/i.test(text)) return "positive";
  if (/terrible|awful|worst|never (again|coming back)|scam|ripoff|do not (recommend|go)/i.test(text))
    return "negative";
  return "neutral";
}

export async function fetchDfsReviewIntel(
  name: string | null | undefined,
  address: string | null | undefined
): Promise<DfsReviewIntel> {
  const empty: DfsReviewIntel = {
    available: false,
    count: 0,
    averageRating: null,
    positive: 0,
    neutral: 0,
    negative: 0,
    positiveThemes: [],
    negativeThemes: [],
    trustGaps: [],
    recentNegativeQuote: null,
    recentPositiveQuote: null,
  };
  if (!name || !dfsAuthHeader()) return empty;

  const keyword = address ? `${name} ${address}` : name;
  const data = await dfsPost<DfsResult<DfsReviewItem>>(
    "/business_data/google/reviews/live",
    [
      {
        keyword,
        language_code: "en",
        location_code: 2840,
        depth: 20,
        sort_by: "newest",
      },
    ]
  );

  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
  if (!items.length) return empty;

  const reviews: DfsReview[] = items
    .map((i) => ({
      rating: i.rating?.value ?? 0,
      text: (i.review_text ?? i.text ?? "").trim(),
      date: i.timestamp ?? null,
    }))
    .filter((r) => r.text.length > 0);

  if (!reviews.length) return empty;

  const corpus = reviews.map((r) => r.text).join("\n").toLowerCase();
  const rated = reviews.filter((r) => r.rating > 0);
  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
      : null;

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let recentNegativeQuote: string | null = null;
  let recentPositiveQuote: string | null = null;

  for (const r of reviews) {
    const c = r.rating >= 4 ? "positive" : r.rating > 0 && r.rating <= 2 ? "negative" : classify(r.text);
    if (c === "positive") {
      positive += 1;
      if (!recentPositiveQuote) recentPositiveQuote = r.text;
    } else if (c === "negative") {
      negative += 1;
      if (!recentNegativeQuote) recentNegativeQuote = r.text;
    } else {
      neutral += 1;
    }
  }

  const positiveThemes = Object.entries(POSITIVE_THEMES)
    .filter(([, re]) => re.test(corpus))
    .map(([k]) => k);
  const negativeThemes = Object.entries(NEGATIVE_THEMES)
    .filter(([, re]) => re.test(corpus))
    .map(([k]) => k);

  const trustGaps: string[] = [];
  for (const hint of TRUST_GAP_HINTS) {
    if (hint.match.test(corpus)) trustGaps.push(hint.gap);
  }

  const trim = (s: string | null) => (s ? (s.length > 240 ? `${s.slice(0, 237)}…` : s) : null);

  return {
    available: true,
    count: reviews.length,
    averageRating,
    positive,
    neutral,
    negative,
    positiveThemes,
    negativeThemes,
    trustGaps,
    recentNegativeQuote: trim(recentNegativeQuote),
    recentPositiveQuote: trim(recentPositiveQuote),
  };
}

// ── Combined bundle for the audit pipeline ───────────────────────────────────

export interface DataForSeoBundle {
  available: boolean;
  gbp: GbpProfile;
  reviews: DfsReviewIntel;
}

export async function runDataForSeo(
  name: string | null | undefined,
  address: string | null | undefined
): Promise<DataForSeoBundle> {
  const [gbp, reviews] = await Promise.all([
    fetchGbpProfile(name, address),
    fetchDfsReviewIntel(name, address),
  ]);
  return {
    available: gbp.available || reviews.available,
    gbp,
    reviews,
  };
}

export function dfsToPromptBlock(bundle: DataForSeoBundle): string {
  if (!bundle.available) {
    return "DEEPER REVIEW + GBP INTELLIGENCE: unavailable — rely on Places data only.";
  }
  const lines = ["DEEPER REVIEW + GBP INTELLIGENCE (DataForSEO):"];

  if (bundle.gbp.available) {
    lines.push(
      `- Google Business Profile completeness: hours=${bundle.gbp.hasHours ? "yes" : "no"}, website=${
        bundle.gbp.hasWebsite ? "yes" : "no"
      }, phone=${bundle.gbp.hasPhone ? "yes" : "no"}, booking link=${
        bundle.gbp.hasBookingLink ? "yes" : "no"
      }, photos=${bundle.gbp.hasPhotos ? "yes" : "no"}.`
    );
    if (bundle.gbp.attributesMissing.length) {
      lines.push(
        `- High-value GBP attributes MISSING (treat as conversion leaks): ${bundle.gbp.attributesMissing.join(", ")}.`
      );
    }
  }

  if (bundle.reviews.available) {
    lines.push(
      `- ${bundle.reviews.count} reviews analyzed; avg ${bundle.reviews.averageRating ?? "n/a"}★; sentiment ${bundle.reviews.positive}/${bundle.reviews.neutral}/${bundle.reviews.negative} (pos/neu/neg).`
    );
    if (bundle.reviews.positiveThemes.length)
      lines.push(`- Strongest praise themes: ${bundle.reviews.positiveThemes.join(", ")}.`);
    if (bundle.reviews.negativeThemes.length)
      lines.push(`- Recurring complaint themes: ${bundle.reviews.negativeThemes.join(", ")}.`);
    if (bundle.reviews.trustGaps.length)
      lines.push(`- Trust gaps surfaced: ${bundle.reviews.trustGaps.join("; ")}.`);
    if (bundle.reviews.recentNegativeQuote)
      lines.push(`- Recent negative quote: "${bundle.reviews.recentNegativeQuote}"`);
    if (bundle.reviews.recentPositiveQuote)
      lines.push(`- Recent positive quote: "${bundle.reviews.recentPositiveQuote}"`);
  }

  return lines.join("\n");
}
