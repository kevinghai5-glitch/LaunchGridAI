// ScreenshotOne signed URL builder.
//
// We generate signed image URLs (no API call here, just HMAC-signed query
// strings). The browser/PDF/HTML deliverable loads them directly on render.
// Above-the-fold only for now: 1280×800 desktop, 390×844 mobile. Full-page
// disabled per product decision.

import crypto from "crypto";

const SCREENSHOTONE_BASE = "https://api.screenshotone.com/take";

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
