// Best-effort public website scraper used to ground AI asset generation in the
// business's actual copy, services, and positioning. Never throws — on any
// failure (timeout, non-HTML, network error) it returns an empty string and the
// caller falls back to Places metadata only.

const MAX_CHARS = 6000;
const MAX_HTML_CHARS = 120000;

export interface WebsitePage {
  text: string;
  html: string;
}

// Fetch a page once and return both readable text (for the AI prompt) and a
// capped slice of raw HTML (for heuristic CTA/form/booking signal detection).
// Never throws — returns empty strings on any failure.
export async function fetchWebsitePage(
  website: string | null | undefined,
  timeoutMs = 7000
): Promise<WebsitePage> {
  if (!website) return { text: "", html: "" };

  let url: string;
  try {
    url = new URL(website).toString();
  } catch {
    return { text: "", html: "" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify as a normal browser so most sites return real markup.
        "User-Agent":
          "Mozilla/5.0 (compatible; LaunchGridBot/1.0; +https://launchgrid.ai)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/html")) {
      return { text: "", html: "" };
    }

    const html = await res.text();
    return {
      text: extractReadableText(html).slice(0, MAX_CHARS),
      html: html.slice(0, MAX_HTML_CHARS),
    };
  } catch {
    return { text: "", html: "" };
  }
}

// Backwards-compatible helper: readable text only.
export async function fetchWebsiteText(
  website: string | null | undefined
): Promise<string> {
  const { text } = await fetchWebsitePage(website);
  return text;
}

function extractReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}
