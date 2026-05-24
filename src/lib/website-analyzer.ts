// Best-effort public website scraper used to ground AI asset generation in the
// business's actual copy, services, and positioning. Never throws — on any
// failure (timeout, non-HTML, network error) it returns an empty string and the
// caller falls back to Places metadata only.

const MAX_CHARS = 6000;

export async function fetchWebsiteText(
  website: string | null | undefined
): Promise<string> {
  if (!website) return "";

  let url: string;
  try {
    url = new URL(website).toString();
  } catch {
    return "";
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
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
    if (!res.ok || !contentType.includes("text/html")) return "";

    const html = await res.text();
    return extractReadableText(html).slice(0, MAX_CHARS);
  } catch {
    return "";
  }
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
