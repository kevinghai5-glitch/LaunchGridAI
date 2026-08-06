// Materialize a ScreenshotOne bundle into OUR OWN stored files.
//
// The signed-URL bundle from screenshotone.ts is never delivered as-is. Before it
// reaches a document we fetch each shot's bytes ONCE, here on our server where the
// access key belongs, store them (StoredScreenshot), and rewrite each imageUrl to
// point at our own serving route. The delivered pack then holds
// `<img src="…/api/assets/screenshot/<id>">` — no ScreenshotOne URL, no access
// key, and ScreenshotOne is billed exactly once per image no matter how many
// times the client opens their pack.
//
// This lives apart from screenshotone.ts so that file stays free of Prisma and
// its pure guards (carriesScreenshotCredential) remain trivially testable.

import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/constants";
import {
  fetchScreenshotBytes,
  type ScreenshotBundle,
  type ScreenshotUrl,
} from "@/lib/screenshotone";

const BASE = APP_URL.replace(/\/+$/, "");

/** Public URL of a stored shot. Absolute (from APP_URL) so it resolves whether
 *  the pack is viewed on our host or opened from an email. */
export function storedScreenshotUrl(id: string): string {
  return `${BASE}/api/assets/screenshot/${id}`;
}

// One shot: fetch its bytes, persist, return our own URL. null on any failure —
// the shot is then dropped, which is the safe direction (better no image than a
// signed URL leaking the key).
async function storeOne(
  shot: ScreenshotUrl,
  userId: string,
  businessId: string | null
): Promise<ScreenshotUrl | null> {
  const got = await fetchScreenshotBytes(shot.imageUrl, { timeoutMs: 30000 });
  if (!got) return null;
  const row = await prisma.storedScreenshot.create({
    data: {
      userId,
      businessId,
      contentType: got.contentType,
      bytes: got.bytes,
      byteSize: got.bytes.length,
    },
    select: { id: true },
  });
  return { ...shot, imageUrl: storedScreenshotUrl(row.id) };
}

/** Replace every signed shot in a bundle with a stored copy served from us.
 *
 *  Runs the fetches in parallel (each capped at 30s) because generation pays for
 *  all of them up front now, where it used to defer the render to client-open.
 *  Any shot that fails to fetch is dropped, never passed through with its signed
 *  URL intact — so a credential can't slip out through a partial failure. */
export async function materializeScreenshotBundle(
  bundle: ScreenshotBundle,
  opts: { userId: string; businessId?: string | null }
): Promise<ScreenshotBundle> {
  if (!bundle.available || bundle.shots.length === 0) {
    return { available: false, shots: [] };
  }
  const results = await Promise.all(
    bundle.shots.map((s) => storeOne(s, opts.userId, opts.businessId ?? null))
  );
  const shots = results.filter((s): s is ScreenshotUrl => s !== null);
  return { available: shots.length > 0, shots };
}
