// Verified BusinessFacts extractor.
//
// Cross-references Firecrawl scrape output + Google Places metadata to build a
// single, source-tagged ground-truth object the AI must defer to over inference.
// Every field carries provenance so the prompt can label assumptions vs facts.
//
// Pure regex + deterministic merging — no extra API calls.

import type { FirecrawlScrape } from "./firecrawl";

type Source = "places" | "website" | "merged";

export interface Fact<T> {
  value: T;
  source: Source;
}

export interface BusinessFacts {
  name: Fact<string> | null;
  phones: Fact<string[]>;
  emails: Fact<string[]>;
  addresses: Fact<string[]>;
  hours: Fact<string[]>; // free-form lines pulled from the site
  services: Fact<string[]>;
  pricesMentioned: Fact<string[]>; // raw "$X" / "$X-$Y" / "from $X" snippets
  bookingLinks: Fact<string[]>;
  socialLinks: Fact<{ platform: string; url: string }[]>;
  certifications: Fact<string[]>;
  guarantees: Fact<string[]>;
  team: Fact<string[]>; // detected staff/practitioner names
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const PRICE_RE = /(?:from\s*)?\$\s?\d{1,4}(?:[,.]\d{2,3})?(?:\s?[-–]\s?\$?\s?\d{1,4}(?:[,.]\d{2,3})?)?(?:\s?\/\s?\w+)?/gi;

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  instagram: /^https?:\/\/(?:www\.)?instagram\.com\/[^/?#]+/i,
  facebook: /^https?:\/\/(?:www\.)?facebook\.com\/[^/?#]+/i,
  tiktok: /^https?:\/\/(?:www\.)?tiktok\.com\/@?[^/?#]+/i,
  youtube: /^https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)?[^/?#]+/i,
  linkedin: /^https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^/?#]+/i,
  twitter: /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^/?#]+/i,
  yelp: /^https?:\/\/(?:www\.)?yelp\.com\/biz\/[^/?#]+/i,
};

const BOOKING_HOSTS = [
  "calendly.com",
  "acuityscheduling.com",
  "app.acuityscheduling.com",
  "squareup.com",
  "setmore.com",
  "schedulicity.com",
  "vagaro.com",
  "booksy.com",
  "mindbodyonline.com",
  "housecallpro.com",
  "getjobber.com",
  "gohighlevel.com",
  "leadconnectorhq.com",
  "zcal.co",
  "cal.com",
  "savvy.cal",
];

const CERT_PATTERNS = [
  /board[-\s]?certified[^.\n]{0,80}/gi,
  /licensed[^.\n]{0,60}/gi,
  /accredit(?:ed|ation)[^.\n]{0,60}/gi,
  /BBB[^.\n]{0,40}/g,
  /better business bureau[^.\n]{0,60}/gi,
  /(?:NADCA|IICRC|ASHI|NACE|ASE|NATE|NABCEP|ICC)\b[^.\n]{0,40}/g,
];

const GUARANTEE_PATTERNS = [
  /(?:satisfaction|money[-\s]?back|workmanship|lifetime)\s+guarantee[^.\n]{0,80}/gi,
  /\d+[-\s]?(?:day|year|month)\s+(?:warranty|guarantee)[^.\n]{0,60}/gi,
];

const HOURS_PATTERNS = [
  /(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:[\s,&–-]+(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))*\s*[:\-–]?\s*(?:closed|\d{1,2}(?::\d{2})?\s?(?:am|pm)\s?[-–]\s?\d{1,2}(?::\d{2})?\s?(?:am|pm))/gi,
];

const SERVICE_LIST_RE = /^(?:[-*•]|\d+\.)\s+([A-Z][^.\n]{4,80})$/gm;

const STOP_WORDS = new Set([
  "home",
  "about",
  "contact",
  "blog",
  "menu",
  "services",
  "service",
  "pricing",
  "prices",
  "book now",
  "schedule",
  "shop",
  "cart",
  "login",
  "log in",
  "sign in",
  "sign up",
]);

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

function dedupePhones(phones: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of phones) {
    const digits = normalizePhone(raw);
    if (digits.length < 10) continue;
    const key = digits.slice(-10);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

function extractFromText(text: string): Omit<BusinessFacts, "name"> {
  const phones = dedupePhones((text.match(PHONE_RE) ?? []).map(clean)).slice(0, 4);
  const emails = uniq((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))
    .filter((e) => !/sentry|wix|wordpress|squarespace|noreply|example/i.test(e))
    .slice(0, 4);

  const prices = uniq((text.match(PRICE_RE) ?? []).map(clean)).slice(0, 12);

  const services: string[] = [];
  const serviceMatches = Array.from(text.matchAll(SERVICE_LIST_RE));
  for (const m of serviceMatches) {
    const candidate = clean(m[1]);
    if (candidate.length < 4 || candidate.length > 80) continue;
    if (STOP_WORDS.has(candidate.toLowerCase())) continue;
    services.push(candidate);
    if (services.length >= 14) break;
  }

  const certifications: string[] = [];
  for (const re of CERT_PATTERNS) {
    for (const m of text.match(re) ?? []) {
      certifications.push(clean(m));
      if (certifications.length >= 6) break;
    }
  }

  const guarantees: string[] = [];
  for (const re of GUARANTEE_PATTERNS) {
    for (const m of text.match(re) ?? []) {
      guarantees.push(clean(m));
      if (guarantees.length >= 4) break;
    }
  }

  const hours: string[] = [];
  for (const re of HOURS_PATTERNS) {
    for (const m of text.match(re) ?? []) {
      hours.push(clean(m));
      if (hours.length >= 8) break;
    }
  }

  return {
    phones: { value: phones, source: "website" },
    emails: { value: emails, source: "website" },
    addresses: { value: [], source: "website" },
    hours: { value: uniq(hours), source: "website" },
    services: { value: uniq(services), source: "website" },
    pricesMentioned: { value: prices, source: "website" },
    bookingLinks: { value: [], source: "website" },
    socialLinks: { value: [], source: "website" },
    certifications: { value: uniq(certifications), source: "website" },
    guarantees: { value: uniq(guarantees), source: "website" },
    team: { value: [], source: "website" },
  };
}

function extractFromLinks(allLinks: string[]): {
  bookingLinks: string[];
  socialLinks: { platform: string; url: string }[];
} {
  const bookingLinks: string[] = [];
  const socialLinks: { platform: string; url: string }[] = [];
  const seenSocialPlatforms = new Set<string>();

  for (const raw of allLinks) {
    const link = raw.trim();
    try {
      const u = new URL(link);
      if (BOOKING_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
        if (!bookingLinks.includes(link)) bookingLinks.push(link);
      }
      for (const [platform, re] of Object.entries(SOCIAL_PATTERNS)) {
        if (re.test(link) && !seenSocialPlatforms.has(platform)) {
          seenSocialPlatforms.add(platform);
          socialLinks.push({ platform, url: link });
          break;
        }
      }
    } catch {
      // skip malformed
    }
  }

  return { bookingLinks: bookingLinks.slice(0, 4), socialLinks };
}

export interface BuildBusinessFactsInput {
  scrape: FirecrawlScrape;
  // Fallback when Firecrawl unused — the legacy native scrape text/html.
  fallbackText: string;
  places: {
    name: string | null | undefined;
    phone: string | null | undefined;
    address: string | null | undefined;
    website: string | null | undefined;
  };
}

export function buildBusinessFacts(input: BuildBusinessFactsInput): BusinessFacts {
  // Combine text from all crawled pages (homepage + subpages) for richer extraction.
  const corpusParts: string[] = [];
  const allLinks: string[] = [];

  if (input.scrape.used && input.scrape.homepage) {
    corpusParts.push(input.scrape.homepage.markdown || input.scrape.homepage.html);
    allLinks.push(...input.scrape.homepage.links);
    for (const sp of input.scrape.subpages) {
      corpusParts.push(sp.markdown || sp.html);
      allLinks.push(...sp.links);
    }
  } else if (input.fallbackText) {
    corpusParts.push(input.fallbackText);
  }

  const corpus = corpusParts.join("\n\n");
  const fromText = extractFromText(corpus);
  const fromLinks = extractFromLinks(allLinks);

  // Merge phone + address from Places (authoritative).
  const phonesMerged = dedupePhones(
    [input.places.phone, ...fromText.phones.value]
      .filter(Boolean)
      .map((s) => String(s))
  );
  const phonesSource: Source =
    input.places.phone && fromText.phones.value.length ? "merged" : input.places.phone ? "places" : "website";

  const addresses: string[] = [];
  if (input.places.address) addresses.push(input.places.address);

  const name = input.places.name
    ? { value: input.places.name, source: "places" as Source }
    : null;

  return {
    name,
    phones: { value: phonesMerged, source: phonesSource },
    emails: fromText.emails,
    addresses: { value: addresses, source: "places" },
    hours: fromText.hours,
    services: fromText.services,
    pricesMentioned: fromText.pricesMentioned,
    bookingLinks: { value: fromLinks.bookingLinks, source: "website" },
    socialLinks: { value: fromLinks.socialLinks, source: "website" },
    certifications: fromText.certifications,
    guarantees: fromText.guarantees,
    team: fromText.team,
  };
}

// Render facts into a compact, prompt-ready block. The AI must defer to these
// over anything it would otherwise infer or invent.
export function factsToPromptBlock(facts: BusinessFacts): string {
  const lines: string[] = ["VERIFIED BUSINESS FACTS (defer to these over inference):"];

  if (facts.name) lines.push(`- Name: ${facts.name.value} [${facts.name.source}]`);
  if (facts.phones.value.length)
    lines.push(`- Phone(s): ${facts.phones.value.join(", ")} [${facts.phones.source}]`);
  if (facts.emails.value.length)
    lines.push(`- Email(s): ${facts.emails.value.join(", ")} [website]`);
  if (facts.addresses.value.length)
    lines.push(`- Address: ${facts.addresses.value.join(" | ")} [places]`);
  if (facts.hours.value.length)
    lines.push(`- Hours mentioned: ${facts.hours.value.slice(0, 4).join(" | ")} [website]`);
  if (facts.services.value.length)
    lines.push(`- Services listed: ${facts.services.value.join("; ")} [website]`);
  if (facts.pricesMentioned.value.length)
    lines.push(`- Pricing mentioned: ${facts.pricesMentioned.value.join("; ")} [website]`);
  if (facts.bookingLinks.value.length)
    lines.push(`- Online booking link(s): ${facts.bookingLinks.value.join(" ")} [website]`);
  if (facts.socialLinks.value.length)
    lines.push(
      `- Social: ${facts.socialLinks.value.map((s) => `${s.platform}=${s.url}`).join(" | ")} [website]`
    );
  if (facts.certifications.value.length)
    lines.push(`- Certifications/credentials: ${facts.certifications.value.join("; ")} [website]`);
  if (facts.guarantees.value.length)
    lines.push(`- Guarantees: ${facts.guarantees.value.join("; ")} [website]`);

  if (lines.length === 1) lines.push("- (No verified facts extracted — treat copy as unverified.)");

  return lines.join("\n");
}
