// ScreenshotOne signed URL builder.
//
// We generate signed image URLs (no API call here, just HMAC-signed query
// strings). Above-the-fold only for now: 1280×800 desktop, 390×844 mobile.
// Full-page disabled per product decision.
//
// ── D2 · A SIGNED URL IS A URL WITH OUR ACCESS KEY IN IT ─────────────────────
//
// The URLs below carry `access_key=<our key>&signature=<hmac>`. That is fine in
// the operator's own browser and fine in our logs. It is NOT fine in a document
// we email to a stranger: an audit that embeds
// `<img src="https://api.screenshotone.com/take?access_key=…">` hands the key to
// everybody who opens the file and picks View Source, and to every mail provider
// that keeps a copy of the message.
//
// So the client-facing path does not LINK the shot, it CARRIES it: fetched once
// at generation, on our server, where the key belongs, and embedded as a data:
// URI. The emailed document then holds an image and no credential — and it still
// renders years later when the signature has expired, and offline in a mail
// client that blocks remote images.
//
// `carriesScreenshotCredential` is the machine-checkable half of that rule, and
// the renderer enforces the stricter version of it independently (it embeds only
// `data:` sources — see embeddableScreenshotSource in exporters/cold-audit-html).
// Two independent gates, because this one is a leak of a secret and the cost of
// the check being skipped once is a rotated key.

import crypto from "crypto";

const SCREENSHOTONE_HOST = "api.screenshotone.com";
const SCREENSHOTONE_BASE = `https://${SCREENSHOTONE_HOST}/take`;

/** Query parameters that are, or are derived from, the secret. */
export const SCREENSHOT_CREDENTIAL_PARAMS = ["access_key", "signature"] as const;

/** True when this URL must never reach a client-facing document.
 *
 *  Deliberately wider than "contains our key": ANY api.screenshotone.com URL is
 *  refused, credential or not. A bare endpoint URL is useless to a reader (it
 *  401s), it tells the reader which vendor we use, and treating the whole host as
 *  unembeddable means a future parameter rename cannot quietly re-open the hole.
 *  A malformed string that cannot be parsed is refused too — an unparseable
 *  `src` is not a thing we are confident enough about to send. */
export function carriesScreenshotCredential(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  // data: URIs are our own copy of the bytes; they have no query string at all.
  if (/^data:/i.test(raw)) return false;
  try {
    const u = new URL(raw);
    if (u.hostname.toLowerCase() === SCREENSHOTONE_HOST) return true;
    return SCREENSHOT_CREDENTIAL_PARAMS.some((p) => u.searchParams.has(p));
  } catch {
    return SCREENSHOT_CREDENTIAL_PARAMS.some((p) => raw.includes(`${p}=`));
  }
}

/** Ceiling on an embedded shot. A 1280×800 JPEG at quality 82 lands around
 *  150–300 KB, so this leaves generous headroom while making it impossible for a
 *  pathological page to turn a 15 KB audit into a multi-megabyte email. Over the
 *  cap we ship no image rather than an unsendable document. */
export const MAX_EMBEDDED_SCREENSHOT_BYTES = 1_500_000;

/** Fetch one of OUR signed shots and return it as a `data:` URI, or null.
 *
 *  Null on every failure path — no key configured, network refused, timeout, a
 *  non-image response, an over-cap image. The screenshot is a nicety; the audit
 *  ships without it exactly as it does today when ScreenshotOne is unconfigured.
 *  It is never allowed to be the reason a document does not exist.
 *
 *  The host allowlist is the point of the `signedUrl` parameter being narrow:
 *  this function can only ever fetch from ScreenshotOne, so it cannot be handed
 *  an arbitrary URL and used as a general-purpose fetcher on our server. */
export async function fetchScreenshotAsDataUri(
  signedUrl: string | null | undefined,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<string | null> {
  const raw = signedUrl?.trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== SCREENSHOTONE_HOST) return null;

  const maxBytes = opts.maxBytes ?? MAX_EMBEDDED_SCREENSHOT_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45000);
  try {
    const res = await fetch(raw, { signal: controller.signal });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/")) return null;
    // Trust the declared length when it is present and already over the cap, so a
    // huge body is refused before it is read into memory.
    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type Viewport = "desktop" | "mobile";

const PRESETS: Record<
  Viewport,
  { viewport_width: string; viewport_height: string; device_scale_factor: string; user_agent?: string }
> = {
  desktop: {
    viewport_width: "1280",
    viewport_height: "800",
    device_scale_factor: "1",
  },
  mobile: {
    viewport_width: "390",
    viewport_height: "844",
    device_scale_factor: "2",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
};

export interface ScreenshotUrl {
  url: string;
  imageUrl: string;
  viewport: Viewport;
  label: string; // e.g. "Target — desktop", "Competitor: Acme — mobile"
}

function hasScreenshotOne(): boolean {
  return Boolean(process.env.SCREENSHOTONE_ACCESS_KEY && process.env.SCREENSHOTONE_SECRET_KEY);
}

function signedUrl(targetUrl: string, viewport: Viewport): string | null {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  const secretKey = process.env.SCREENSHOTONE_SECRET_KEY;
  if (!accessKey || !secretKey) return null;

  const preset = PRESETS[viewport];
  const params = new URLSearchParams({
    access_key: accessKey,
    url: targetUrl,
    format: "jpg",
    image_quality: "82",
    block_ads: "true",
    block_cookie_banners: "true",
    block_chats: "true",
    cache: "true",
    cache_ttl: "604800", // 7 days
    response_type: "by_format",
    viewport_width: preset.viewport_width,
    viewport_height: preset.viewport_height,
    device_scale_factor: preset.device_scale_factor,
    full_page: "false",
    timeout: "30",
  });
  if (preset.user_agent) params.set("user_agent", preset.user_agent);

  // ScreenshotOne signing: HMAC-SHA256 of the query string with the secret key,
  // appended as &signature=<hex>.
  const query = params.toString();
  const signature = crypto.createHmac("sha256", secretKey).update(query).digest("hex");
  return `${SCREENSHOTONE_BASE}?${query}&signature=${signature}`;
}

export interface BuildScreenshotsInput {
  target: { url: string | null | undefined; label: string };
  competitors: { url: string | null | undefined; label: string }[];
  maxCompetitors?: number;
}

export interface ScreenshotBundle {
  available: boolean;
  shots: ScreenshotUrl[];
}

export function buildScreenshotBundle(input: BuildScreenshotsInput): ScreenshotBundle {
  if (!hasScreenshotOne()) return { available: false, shots: [] };

  const shots: ScreenshotUrl[] = [];

  const pushPair = (url: string, label: string) => {
    for (const viewport of ["desktop", "mobile"] as const) {
      const signed = signedUrl(url, viewport);
      if (signed) {
        shots.push({ url, imageUrl: signed, viewport, label: `${label} — ${viewport}` });
      }
    }
  };

  if (input.target.url) {
    try {
      pushPair(new URL(input.target.url).toString(), input.target.label);
    } catch {
      // ignore malformed
    }
  }

  const maxComp = input.maxCompetitors ?? 3;
  let added = 0;
  for (const c of input.competitors) {
    if (added >= maxComp) break;
    if (!c.url) continue;
    try {
      pushPair(new URL(c.url).toString(), c.label);
      added += 1;
    } catch {
      // ignore malformed
    }
  }

  return { available: shots.length > 0, shots };
}
