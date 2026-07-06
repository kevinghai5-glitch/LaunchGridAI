/**
 * Step-4 re-baseline harness for the scraping-accuracy fix.
 *
 * For each site, runs the REAL Firecrawl scrape, then detects the four
 * externally-fingerprinted signals two ways:
 *   OLD substrate — cleaned `html`, homepage only (the pre-fix behavior).
 *   NEW substrate — full `rawHtml`, across every scraped page (the fix),
 *                   resolved to the PRESENT/ABSENT/UNKNOWN tri-state.
 *
 * Prints a per-signal comparison and a roll-up: how many prior false negatives
 * (OLD=false) resolved to PRESENT vs UNKNOWN vs stayed ABSENT. Those numbers
 * decide whether Playwright (step 5) is worth building.
 *
 *   set -a && . ./.env.local && set +a
 *   node node_modules/.bin/tsx scripts/scan-baseline.ts
 *
 * Only FIRECRAWL_API_KEY is required. Add sites via --site "name|industry|city|url|phone".
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { firecrawlSite, type FirecrawlScrape } from "@/lib/firecrawl";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { toScrapeData } from "@/lib/leak-detection";
import type { Tri } from "@/lib/leak-taxonomy";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

interface Site {
  name: string;
  industry: string | null;
  city: string | null;
  website: string;
  phone: string | null;
}

// Default panel: the two confirmed-bug sites first, then a spread of real local
// service businesses likely to run GTM-injected widgets. Override with --site.
const DEFAULT_SITES: Site[] = [
  { name: "Priority Plumbing", industry: "plumbing", city: "Toronto", website: "https://priorityplumbing.ca", phone: "416-762-8662" },
  { name: "Cambie Plumbing", industry: "plumbing", city: "Vancouver", website: "https://cambieplumbing.ca", phone: null },
  { name: "Milani", industry: "plumbing", city: "Vancouver", website: "https://milani.ca", phone: null },
  { name: "Reliance Home Comfort", industry: "hvac", city: "Toronto", website: "https://reliancehomecomfort.com", phone: null },
  { name: "Dr. Bicuspid Dental", industry: "dental", city: "Toronto", website: "https://www.altima.ca", phone: null },
  { name: "Canadian Roofing", industry: "roofing", city: "Toronto", website: "https://canadianroofingservices.ca", phone: null },
];

function parseSiteArgs(): Site[] {
  const sites: Site[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--site") continue;
    const spec = argv[i + 1] ?? "";
    const [name, industry, city, website, phone] = spec.split("|");
    if (!name || !website) continue;
    sites.push({
      name,
      industry: industry || null,
      city: city || null,
      website,
      phone: phone || null,
    });
  }
  return sites.length ? sites : DEFAULT_SITES;
}

// The four externally-fingerprinted signals under test.
const SIGNALS = ["contactForm", "onlineBooking", "chatWidget", "clickToCall"] as const;
type Signal = (typeof SIGNALS)[number];

function oldBool(scrape: FirecrawlScrape, sig: Signal): boolean {
  // OLD behavior: cleaned html, homepage only.
  const html = scrape.homepage?.html || "";
  const intel = buildAuditIntelligence({
    websiteHtml: html,
    hasWebsiteUrl: true,
    reviews: [],
    competitors: [],
    self: { rating: null, reviewCount: null },
  });
  const w = intel.website;
  switch (sig) {
    case "contactForm": return w.formDetected;
    case "onlineBooking": return w.bookingDetected;
    case "chatWidget": return w.marketing.chat.length > 0;
    case "clickToCall": return w.phoneClickable;
  }
}

function newTri(scrape: FirecrawlScrape, site: Site): Record<Signal, Tri> {
  // NEW behavior: rawHtml, all pages → tri-state via the real adapter.
  const rawMulti = scrape.used && scrape.homepage
    ? [scrape.homepage, ...scrape.subpages].map((p) => p.rawHtml || p.html).filter(Boolean).join("\n\n")
    : "";
  const intel = buildAuditIntelligence({
    websiteHtml: rawMulti,
    hasWebsiteUrl: true,
    reviews: [],
    competitors: [],
    self: { rating: null, reviewCount: null },
  });
  const data = toScrapeData({
    business: { name: site.name, industry: site.industry, category: site.industry, city: site.city, phone: site.phone, website: site.website, rating: null, reviewCount: null },
    intel,
    scrape,
    fallbackText: "",
  });
  const w = data.website!;
  return {
    contactForm: w.hasContactForm,
    onlineBooking: w.hasOnlineBookingLink,
    chatWidget: w.hasChatWidget,
    clickToCall: w.hasClickToCallOnMobile,
  };
}

const RAW_HTML_MIN_BYTES = 1000;
function scanGoodOf(scrape: FirecrawlScrape): boolean {
  const raw = scrape.used && scrape.homepage
    ? [scrape.homepage, ...scrape.subpages].map((p) => p.rawHtml || "").join("\n\n")
    : "";
  if (!raw || raw.length < RAW_HTML_MIN_BYTES) return false;
  return /<\/(?:body|html|main|section|div)>/i.test(raw) || /<(?:form|a|button|script)\b/i.test(raw);
}

async function main() {
  loadEnv();
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY not set (looked in env, .env.local, .env).");
    process.exit(2);
  }

  const sites = parseSiteArgs();
  console.log(`\nRe-baselining ${sites.length} site(s) — OLD (cleaned homepage html) vs NEW (rawHtml, all pages → tri-state)\n`);

  // Roll-up over prior false negatives (OLD=false): where did they land?
  const tally: Record<Signal, { falseNeg: number; toPresent: number; toUnknown: number; stayedAbsent: number }> = {
    contactForm: { falseNeg: 0, toPresent: 0, toUnknown: 0, stayedAbsent: 0 },
    onlineBooking: { falseNeg: 0, toPresent: 0, toUnknown: 0, stayedAbsent: 0 },
    chatWidget: { falseNeg: 0, toPresent: 0, toUnknown: 0, stayedAbsent: 0 },
    clickToCall: { falseNeg: 0, toPresent: 0, toUnknown: 0, stayedAbsent: 0 },
  };

  for (const site of sites) {
    let scrape: FirecrawlScrape;
    try {
      scrape = await firecrawlSite(site.website);
    } catch (err) {
      console.log(`■ ${site.name} (${site.website})\n    scrape threw: ${(err as Error).message}\n`);
      continue;
    }

    const pages = [scrape.homepage, ...scrape.subpages].filter(Boolean);
    const rawBytes = pages.reduce((n, p) => n + (p!.rawHtml?.length ?? 0), 0);
    const htmlBytes = pages.reduce((n, p) => n + (p!.html?.length ?? 0), 0);
    const good = scanGoodOf(scrape);

    console.log(`■ ${site.name} (${site.website})`);
    if (!scrape.used) {
      console.log(`    scrape failed / bot-walled — homepage not retrieved (this is the UNKNOWN floor: OLD asserts false 'no X', NEW hedges)`);
    }
    console.log(`    pages: ${pages.length}  ·  rawHtml: ${rawBytes.toLocaleString()}B  ·  cleaned html: ${htmlBytes.toLocaleString()}B  ·  scanGood: ${good ? "YES" : "NO"}`);

    const tri = newTri(scrape, site);
    for (const sig of SIGNALS) {
      const before = oldBool(scrape, sig);
      const after = tri[sig];
      const flag = !before && after === "PRESENT" ? "  ← RECOVERED (false-neg → PRESENT)"
        : !before && after === "UNKNOWN" ? "  ← now honest (false-claim → UNKNOWN)"
        : "";
      console.log(`      ${sig.padEnd(14)} OLD=${String(before).padEnd(5)}  NEW=${after}${flag}`);
      if (!before) {
        tally[sig].falseNeg++;
        if (after === "PRESENT") tally[sig].toPresent++;
        else if (after === "UNKNOWN") tally[sig].toUnknown++;
        else tally[sig].stayedAbsent++;
      }
    }
    console.log("");
  }

  console.log("─".repeat(72));
  console.log("ROLL-UP — of prior false negatives (OLD=false), where did they land?\n");
  for (const sig of SIGNALS) {
    const t = tally[sig];
    console.log(
      `  ${sig.padEnd(14)} OLD-false: ${t.falseNeg}  →  PRESENT: ${t.toPresent}  ·  UNKNOWN: ${t.toUnknown}  ·  ABSENT(confirmed): ${t.stayedAbsent}`
    );
  }
  console.log(
    "\n  PRESENT  = a real capability the OLD scan missed (fix recovered it).\n" +
    "  UNKNOWN  = OLD would have asserted a false 'no X'; NEW hedges to kickoff instead.\n" +
    "  ABSENT   = genuinely absent even on a good rawHtml scan (a true negative).\n"
  );
}

main().catch((err) => {
  console.error("scan-baseline failed:", err);
  process.exit(1);
});
