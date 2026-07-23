// Owner / decision-maker name enrichment.
//
// The cold-call SOP's gatekeeper script needs ONE owner name to get past a
// receptionist ("Is that [owner], or someone else?"). This module extracts that
// name from the About/Team/Contact text the cold-audit already scrapes — no new
// API call in the daily batch, and zero cost on regenerate (the caller caches
// the result and never re-runs once resolved).
//
// The ONE law here mirrors the finding engine: verifiable-or-silent. A wrong
// name on a live call is worse than no name, so we only ever surface owner(s)
// the site actually names — never a guess:
//   • one clearly-stated owner   → show it ("John Smith")
//   • a genuinely co-owned biz   → show both ("John Smith & Jane Doe")
//   • nobody clearly named, or 3+ noisy candidates → show nothing (null)
// Tier 1 is deterministic regex (free); Tier 2 is an AI fallback over the SAME
// already-scraped text (reuses the existing OpenAI client). Both obey the rule.

import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { fetchWebsitePage } from "@/lib/website-analyzer";
import { firecrawlSite, firecrawlSearch, type FirecrawlPage } from "@/lib/firecrawl";

// A plausible person name: 2–4 capitalized words, allowing an initial, hyphen,
// apostrophe (O'Brien, Jean-Luc), and an optional honorific we strip later.
const NAME_CORE = "[A-Z][a-z'’-]+(?:\\s+[A-Z]\\.?)?(?:\\s+[A-Z][a-z'’-]+){1,2}";

// An optional second, conjoined name — "... John Smith and Jane Doe". Captured
// so a co-owned business registers TWO candidates and is ruled ambiguous (null)
// rather than silently picking the first name.
const CO_OWNER = `(?:\\s*(?:,|&|and)\\s*(${NAME_CORE}))?`;

// Role keywords, first-letter case-tolerant (Title Case + lowercase) so the
// regex flag can stay "g" — keeping NAME_CORE strictly capital-sensitive so only
// genuinely capitalized names are ever captured.
const OWNED = "[Oo]wned";
const FOUNDED = "[Ff]ounded";
const OWNER = "[Oo]wner";
const FOUNDER = "[Ff]ounder";
const ROLE = "(?:[Oo]wner|[Ff]ounder|[Pp]roprietor|[Pp]rincipal)";

// Owner-role anchors, capturing the name(s) on either side of the role word.
const OWNER_PATTERNS: RegExp[] = [
  // "Owned & operated by John Smith [and Jane Doe]" / "Founded by Jane Doe"
  new RegExp(`\\b(?:${OWNED}(?:\\s*&|\\s+and)?\\s*operated\\s+by|${FOUNDED}\\s+by|${OWNED}\\s+by)\\s+(${NAME_CORE})${CO_OWNER}`, "g"),
  // "Meet John Smith[, and Jane Doe], owner" / "Meet the owner, Jane Doe"
  new RegExp(`\\b[Mm]eet\\s+(?:the\\s+(?:${OWNER}|${FOUNDER})[,:]?\\s+)?(${NAME_CORE})${CO_OWNER}`, "g"),
  // "John Smith, Owner" / "Jane Doe — Founder & CEO"
  new RegExp(`(${NAME_CORE})\\s*(?:,|—|–|-|\\||\\n)\\s*(?:the\\s+)?${ROLE}\\b`, "g"),
  // "Owner: John Smith [and Jane Doe]" / "Founder – Jane Doe"
  new RegExp(`\\b${ROLE}s?\\s*(?:[:—–-]|\\bis\\b|\\bare\\b)\\s*(${NAME_CORE})${CO_OWNER}`, "g"),
];

// Honorifics we keep as part of the spoken name (medical/dental especially —
// you ask for "Dr. Wang", not "Wang"). Captured separately so we can re-attach.
const HONORIFIC_RE = new RegExp(`\\b([Dd]r\\.?|[Dd]octor)\\s+(${NAME_CORE})`, "g");

// Words that look name-shaped but are not people (nav, generic page nouns, and
// common business-name tails). Any candidate containing these is discarded.
// The second alternation group catches boilerplate that sits next to the
// "owned & operated" anchor and gets mis-captured as a name (e.g. the phrase
// "Owned & Operated · Equipment We use" yielding "Operated Equipment We").
const NON_NAME = /\b(?:LLC|Inc|Incorporated|Corp|Company|Co\.|Group|Services?|Solutions|Clinic|Dental|Medical|Team|Staff|About|Contact|Home|Reviews?|Google|Facebook|Instagram|Privacy|Terms|Copyright|Rights?\s+Reserved|Operated|Operating|Equipment|Locally|Family|Fully|Licensed|Insured|Serving|We|Us|Our|Your|Their)\b/i;

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[.,;:—–\-|]+$/, "")
    .trim();
}

// Reject a candidate that is really the business's own name (e.g. "Smith Dental"
// matching a 2-word pattern) or that carries a non-person token.
function isPlausiblePerson(candidate: string, businessName: string): boolean {
  const c = cleanName(candidate);
  if (c.length < 4 || c.length > 40) return false;
  if (NON_NAME.test(c)) return false;
  const words = c.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  // Overlap with the business name → almost certainly the brand, not a person.
  const bizWords = new Set(
    businessName.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const nameWords = c.toLowerCase().split(/\s+/);
  const shared = nameWords.filter((w) => bizWords.has(w)).length;
  if (shared >= 2) return false;
  return true;
}

// Collect every distinct owner-name candidate found by the regex anchors. Case-
// and honorific-insensitive dedup so "Dr. Wang" and "Wang" don't count as two.
function collectCandidates(text: string, businessName: string): Map<string, string> {
  // key: lowercased last two name words (identity) → value: display form.
  const found = new Map<string, string>();

  const add = (rawName: string, honorific?: string) => {
    const name = cleanName(rawName);
    if (!isPlausiblePerson(name, businessName)) return;
    const words = name.toLowerCase().split(/\s+/);
    const key = words.slice(-2).join(" "); // identity = surname-ish tail
    const display = honorific ? `${honorific.replace(/\bdoctor\b/i, "Dr.")} ${name}` : name;
    // Prefer the first spelling we see; a later honorific upgrade replaces it.
    if (!found.has(key)) found.set(key, display);
    else if (honorific && !/^dr\.?\b/i.test(found.get(key)!)) found.set(key, display);
  };

  for (const re of OWNER_PATTERNS) {
    re.lastIndex = 0;
    for (const m of Array.from(text.matchAll(re))) {
      // Every capture group is a candidate owner (group 2 = a conjoined co-owner
      // when present) — two distinct names makes the business ambiguous → null.
      for (let g = 1; g < m.length; g++) {
        if (m[g]) add(m[g]);
      }
    }
  }
  // Doctor honorific near an owner context — only attach if that person was
  // already captured as an owner (avoids grabbing every listed practitioner).
  HONORIFIC_RE.lastIndex = 0;
  for (const m of Array.from(text.matchAll(HONORIFIC_RE))) {
    const person = cleanName(m[2] ?? "");
    const key = person.toLowerCase().split(/\s+/).slice(-2).join(" ");
    if (found.has(key)) add(person, m[1]);
  }

  return found;
}

// The most owner names we'll ever list. One or two owners is a real co-owned
// business (show both); three-plus "owners" is almost always extraction noise
// (a staff directory), so we treat that as unknown and show nothing.
const MAX_OWNERS = 2;

// --- Tier 1: deterministic regex over the scraped About/Team text ------------
// Returns every clearly owner-anchored name (1–2). 0 or >2 → [] (nothing / too
// noisy to trust), deferring to the AI tier or silence.
export function extractOwnersRegex(corpus: string, businessName: string): string[] {
  if (!corpus) return [];
  const candidates = collectCandidates(corpus, businessName);
  if (candidates.size === 0 || candidates.size > MAX_OWNERS) return [];
  return Array.from(candidates.values());
}

// --- Tier 2: AI fallback over the SAME scraped text --------------------------
// Only invoked when Tier 1 is silent. Returns the clearly-stated owner(s). The
// prompt still forbids guessing: it lists the owners the site actually names, or
// returns nothing — it never invents one or picks between unrelated people.
export async function extractOwnersAI(corpus: string, businessName: string): Promise<string[]> {
  if (!corpus.trim()) return [];
  const snippet = corpus.slice(0, 12000);

  const prompt = `You are reading the About/Team/Contact text scraped from a local business's own website. List the OWNER(S) / FOUNDER(S) — the decision-maker(s) — of "${businessName}" so a salesperson can ask for them by name.

STRICT RULES — a wrong name on a cold call is worse than no name:
- List ONLY people the text clearly identifies as the owner/founder/proprietor/principal (or co-owners/partners). If a business is co-owned, list both.
- Return an EMPTY list if no owner/founder is clearly identified (only staff, only the business name, or nobody). Never guess or invent a name.
- Do NOT infer from a phone number, an email prefix, a reviewer, or the business name itself. Do NOT list regular staff/employees who are not owners.
- Keep an honorific if the site uses one for them (e.g. "Dr. Lopez").

WEBSITE TEXT:
${snippet}

Return ONLY valid JSON: { "owners": ["<full name>", ...] } — the clearly-stated owner(s), or { "owners": [] } if none.`;

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { owners?: unknown };
    const raw = Array.isArray(parsed.owners) ? parsed.owners : [];
    const owners = raw
      .filter((o): o is string => typeof o === "string")
      .map(cleanName)
      // Re-apply the deterministic person guard so the model can't smuggle the
      // business name or a non-person string past the same bar Tier 1 enforces.
      .filter((o) => o && isPlausiblePerson(o.replace(/^dr\.?\s+/i, ""), businessName));
    // De-dupe by surname-ish tail and cap. >MAX_OWNERS distinct → likely noise.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of owners) {
      const key = o.toLowerCase().split(/\s+/).slice(-2).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    return out.length > MAX_OWNERS ? [] : out;
  } catch {
    return [];
  }
}

// --- Combined text extractor: Tier 1 → Tier 2 --------------------------------
// Regex first (free); AI only if regex is silent. Returns the owner(s) as one
// display string ("A" or "A & B"), or null when neither tier can name anyone.
export async function extractOwnersFromText(
  corpus: string,
  businessName: string
): Promise<string | null> {
  const owners = extractOwnersRegex(corpus, businessName);
  const resolved = owners.length ? owners : await extractOwnersAI(corpus, businessName);
  return resolved.length ? resolved.slice(0, MAX_OWNERS).join(" & ") : null;
}

// Links that tend to carry the owner's name — checked on the homepage so we can
// pull in the one extra page most likely to name them.
const ABOUT_LINK_RE = /href\s*=\s*["']([^"'#?]*\/(?:about(?:-us)?|our-(?:team|story)|team|meet(?:-the-team)?|staff|leadership)\/?)["']/i;

function resolveAboutUrl(html: string, base: string): string | null {
  const m = html.match(ABOUT_LINK_RE);
  if (!m) return null;
  try {
    return new URL(m[1], base).toString();
  } catch {
    return null;
  }
}

// --- Website resolver (cheap, generation-time) -------------------------------
// The daily batch runs this across up to 30 prospects under a 120s serverless
// budget, so it is deliberately REGEX-ONLY and short-timeout: a free native
// fetch of the homepage, and only if that names no one, one linked About/Team
// page. No AI, no paid API — an unnamed owner just stays blank (like a missing
// phone). The AI tier is reserved for the low-volume per-business snapshot
// backfill (extractOwnersFromText), never this hot path.
const OWNER_FETCH_TIMEOUT_MS = 4500;

export async function resolveOwnerFromWebsite(
  website: string | null | undefined,
  businessName: string,
  // useAI upgrades to the two-tier extractor (regex → AI fallback). Off for the
  // 30-at-once daily batch (fast, free); ON for the single on-demand card resolve,
  // where one small model call is affordable and lifts the hit-rate for sites that
  // name an owner in prose the regex can't anchor.
  opts: { useAI?: boolean } = {}
): Promise<string | null> {
  if (!website) return null;
  const home = await fetchWebsitePage(website, OWNER_FETCH_TIMEOUT_MS);

  if (!opts.useAI) {
    // Regex-only fast path: homepage, then (only if silent) one linked About page.
    if (home.text.trim()) {
      const hit = extractOwnersRegex(home.text, businessName);
      if (hit.length) return hit.slice(0, MAX_OWNERS).join(" & ");
    }
    const aboutUrl = home.html ? resolveAboutUrl(home.html, website) : null;
    if (!aboutUrl) return null;
    const about = await fetchWebsitePage(aboutUrl, OWNER_FETCH_TIMEOUT_MS);
    if (!about.text.trim()) return null;
    const hit = extractOwnersRegex(about.text, businessName);
    return hit.length ? hit.slice(0, MAX_OWNERS).join(" & ") : null;
  }

  // Two-tier path: assemble the full corpus and run the regex → AI extractor.
  // Both tiers obey the same verifiable-or-silent law.
  //
  // Small-business sites are overwhelmingly JS-rendered, so a native fetch returns
  // an empty/thin body — which starves both extractor tiers and is why the owner
  // came back blank for every prospect. Firecrawl renders the page (same scraper
  // the Cold Audit already relies on) and yields real About/Team prose. Try it
  // first; fall back to the native corpus if Firecrawl isn't configured or fails.
  let corpus = "";
  try {
    // 4 subpages so the About/About-Us page is always in the scrape — the owner's
    // name lives there, and the default (2) only reached the service pages, which
    // is why owners were coming back blank even when the site named one.
    const scrape = await firecrawlSite(website, 4);
    if (scrape.used) {
      const pages = [scrape.homepage, ...scrape.subpages].filter(Boolean) as FirecrawlPage[];
      // Owner names live on About/Team/Story pages. On large sites the AI tier only
      // sees the first slice of the corpus, so float those pages to the front (the
      // regex tier scans the whole corpus, so ordering only helps the AI tier).
      const isAboutish = (u: string) => /\b(about|team|our-story|story|leadership|founder|owner|staff)\b/i.test(u);
      pages.sort((a, b) => Number(isAboutish(b.url)) - Number(isAboutish(a.url)));
      corpus = pages.map((p) => p.markdown || p.html).join("\n\n");
    }
  } catch {
    // fall through to the native corpus below
  }

  if (!corpus.trim()) {
    corpus = home.text;
    const aboutUrl = home.html ? resolveAboutUrl(home.html, website) : null;
    if (aboutUrl) {
      const about = await fetchWebsitePage(aboutUrl, OWNER_FETCH_TIMEOUT_MS);
      if (about.text) corpus += `\n\n${about.text}`;
    }
  }

  if (!corpus.trim()) return null;
  return extractOwnersFromText(corpus, businessName);
}

// --- Tier 3: web search fallback ---------------------------------------------
// When a business's OWN site never names an owner, a web search ("<name> <city>
// owner") usually surfaces one from a directory, BBB, LinkedIn, or news snippet.
// Search results mix in OTHER businesses of a similar name, so this uses a
// match-the-business AI prompt (not the generic About-page extractor): it must
// name the owner of THIS exact business+city, or return nothing. Still obeys the
// verifiable-or-silent law — a wrong name on a live call is worse than no name.
async function extractOwnerFromSearch(
  results: { title: string; description: string }[],
  businessName: string,
  city: string | null
): Promise<string | null> {
  const snippets = results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.description}`)
    .join("\n")
    .slice(0, 8000);
  if (!snippets.trim()) return null;

  const where = city ? ` in ${city}` : "";
  const prompt = `Below are web search results for finding the OWNER of the local business "${businessName}"${where}. Identify the owner/founder/proprietor of THIS EXACT business so a salesperson can ask for them by name.

STRICT RULES — a wrong name on a cold call is worse than no name:
- Return a name ONLY if a result clearly identifies the owner/founder of "${businessName}"${where} specifically. Match the business name (and city if given).
- Search results often include DIFFERENT businesses with similar names — if a result is about a different company, ignore it. When unsure it's the same business, return nothing.
- Do NOT guess from a reviewer, an employee, an email, or the business name itself. If co-owned, you may list both.
- Keep an honorific if used for them (e.g. "Dr. Lopez").

SEARCH RESULTS:
${snippets}

Return ONLY valid JSON: { "owners": ["<full name>", ...] } — the clearly-identified owner(s) of this exact business, or { "owners": [] } if none is clear.`;

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { owners?: unknown };
    const raw = Array.isArray(parsed.owners) ? parsed.owners : [];
    const owners = raw
      .filter((o): o is string => typeof o === "string")
      .map(cleanName)
      .filter((o) => o && isPlausiblePerson(o.replace(/^dr\.?\s+/i, ""), businessName));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of owners) {
      const key = o.toLowerCase().split(/\s+/).slice(-2).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    return out.length && out.length <= MAX_OWNERS ? out.slice(0, MAX_OWNERS).join(" & ") : null;
  } catch {
    return null;
  }
}

// Public entry for the web-search tier: run the "<name> <city> owner" query and
// extract the owner of that specific business. Best-effort; null on any failure.
export async function resolveOwnerViaSearch(
  businessName: string,
  city: string | null | undefined
): Promise<string | null> {
  const query = `${businessName} ${city ?? ""} owner`.trim();
  const results = await firecrawlSearch(query, 6).catch(() => []);
  if (!results.length) return null;
  return extractOwnerFromSearch(results, businessName, city ?? null);
}

// Resolve owners for a batch of prospects with bounded concurrency so the daily
// generation never fans out into 30+ simultaneous fetches. Order-preserving;
// any single failure degrades to null and can never reject the batch.
export async function resolveOwnersBatch(
  prospects: { website: string | null | undefined; name: string }[],
  concurrency = 6
): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(prospects.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < prospects.length) {
      const i = next++;
      const p = prospects[i];
      out[i] = await resolveOwnerFromWebsite(p.website, p.name).catch(() => null);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, prospects.length) }, worker)
  );
  return out;
}
