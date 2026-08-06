/** GET /api/assets/screenshot/[id] — serve a stored screenshot's bytes.
 *
 *  PUBLIC, by design: the deliverable that embeds this image is opened by the
 *  client (a stranger, not a logged-in operator), so this cannot require a
 *  session. The id is an unguessable cuid and is the capability — exactly the
 *  same model as the public proposal pages keyed by publicId.
 *
 *  This is the "serve our own copy" half of item 4: the bytes were fetched from
 *  ScreenshotOne ONCE at generation (screenshot-store.ts). Serving them from here
 *  means ScreenshotOne is never hit again, however many times the pack is opened,
 *  and no access key is anywhere in the document.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const shot = await prisma.storedScreenshot.findUnique({
    where: { id: params.id },
    select: { bytes: true, contentType: true, byteSize: true },
  });
  if (!shot) {
    return new NextResponse("Not found", { status: 404 });
  }

  // The bytes are immutable once stored, so cache hard — the browser and any CDN
  // render this once and never re-request. This is what makes repeat opens free.
  return new NextResponse(Buffer.from(shot.bytes), {
    status: 200,
    headers: {
      "Content-Type": shot.contentType || "image/jpeg",
      "Content-Length": String(shot.byteSize),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
