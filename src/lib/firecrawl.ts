// Firecrawl-powered website scraper.
//
// Replaces the brittle native fetch + regex scrape with Firecrawl's structured
// scraping: gets clean markdown + raw HTML for the homepage plus a small set of
// high-signal subpages (services / about / contact / pricing / book). Used to
// (a) ground the AI with much richer copy, and (b) extract verified business
// facts (phone, email, hours, prices, booking links, etc.).
//
// Best-effort. Falls back gracefully — every function returns empty/null on any
// failure so generation still proceeds with whatever signal is available.

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

// Paths we'll opportunistically try on the same origin if the link map doesn't
// surface them. Ordered by signal value.
const HIGH_SIGNAL_PATHS = [
  "/services",
  "/service",
  "/about",
  "/about-us",
  "/pricing",
  "/prices",
  "/contact",
  "/contact-us",
  "/book",
  "/booking",
  "/appointments",
  "/schedule",
  "/menu",
  "/treatments",
  "/locations",
  "/faq",
];

export interface FirecrawlPage {
  url: string;
  markdown: string;
  html: string;
  /** Full post-JS-rendered DOM incl. script/iframe tags. Cleaned `html` strips
   *  these, hiding GTM-injected widgets (chat/booking) — signal detection must
   *  fingerprint over rawHtml, not html. */
  rawHtml: string;
  title: string;
  description: string;
  links: string[];
}

export interface FirecrawlScrape {
  /** True iff Firecrawl is configured AND we got at least the homepage. */
  used: boolean;
  homepage: FirecrawlPage | null;
  subpages: FirecrawlPage[];
}

function hasFirecrawl(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

async function scrapeOne(url: string): Promise<FirecrawlPage | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html", "rawHtml", "links"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: 20000,
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        html?: string;
        rawHtml?: string;
        links?: string[];
        metadata?: { title?: string; description?: string; sourceURL?: string };
      };
    };
    if (!data.success || !data.data) return null;

    const md = data.data.markdown ?? "";
    const html = data.data.html ?? "";
    const rawHtml = data.data.rawHtml ?? "";
    if (!md && !html) return null;

    return {
      url: data.data.metadata?.sourceURL ?? url,
      markdown: md,
      html,
      rawHtml,
      title: data.data.metadata?.title ?? "",
      description: data.data.metadata?.description ?? "",
      links: Array.isArray(data.data.links) ? data.data.links : [],
    };
  } catch {
    return null;
  }
}

// Pick up to N "high signal" subpage URLs from the homepage's link map, preferring
// same-origin paths that look like services / about / contact / pricing / booking.
function pickSubpageUrls(homepage: FirecrawlPage, max: number): string[] {
  let origin: string | null = null;
  try {
    origin = new URL(homepage.url).origin;
  } catch {
    origin = null;
  }
  if (!origin) return [];
  const originStr: string = origin;

  const sameOrigin = new Set<string>();
  for (const raw of homepage.links) {
    try {
      const u: URL = new URL(raw, originStr);
      if (u.origin !== originStr) continue;
      if (u.pathname === "/" || u.pathname === "") continue;
      const cleaned = `${u.origin}${u.pathname.replace(/\/$/, "")}`;
      sameOrigin.add(cleaned);
    } catch {
      // ignore malformed
    }
  }

  const ranked: { url: string; rank: number }[] = [];
  Array.from(sameOrigin).forEach((url) => {
    const path = url.replace(originStr, "").toLowerCase();
    const idx = HIGH_SIGNAL_PATHS.findIndex((p) => path === p || path.startsWith(`${p}/`));
    if (idx >= 0) ranked.push({ url, rank: idx });
  });

  ranked.sort((a, b) => a.rank - b.rank);
  const picked = ranked.slice(0, max).map((r) => r.url);

  // If we didn't find enough via the link map, opportunistically add common paths
  // even if they weren't linked from the homepage (often hidden in nav menus).
  if (picked.length < max) {
    for (const p of HIGH_SIGNAL_PATHS) {
      if (picked.length >= max) break;
      const candidate = `${origin}${p}`;
      if (!picked.includes(candidate) && !sameOrigin.has(candidate)) {
        picked.push(candidate);
      }
    }
  }

  return picked;
}

/**
 * Scrape the homepage plus up to `maxSubpages` high-signal subpages with
 * Firecrawl. Returns an empty scrape (used:false) when Firecrawl isn't
 * configured or the homepage fetch fails.
 */
export async function firecrawlSite(
  website: string | null | undefined,
  maxSubpages = 3
): Promise<FirecrawlScrape> {
  if (!website || !hasFirecrawl()) {
    return { used: false, homepage: null, subpages: [] };
  }

  let normalized: string;
  try {
    normalized = new URL(website).toString();
  } catch {
    return { used: false, homepage: null, subpages: [] };
  }

  const homepage = await scrapeOne(normalized);
  if (!homepage) return { used: false, homepage: null, subpages: [] };

  const subpageUrls = pickSubpageUrls(homepage, maxSubpages);
  const subpageResults = await Promise.all(subpageUrls.map((u) => scrapeOne(u)));
  const subpages = subpageResults.filter((p): p is FirecrawlPage => p !== null);

  return { used: true, homepage, subpages };
}
