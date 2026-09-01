/** POST /api/call-queue/export?date=YYYY-MM-DD[&view=today|upcoming|past]
 *
 *  The day's call list as a CSV shaped for the LeadConnector (GHL) power dialer.
 *  Same selection function as the on-screen queue (see call-queue-query.ts), so
 *  the file is the list he is looking at — not a second query that agrees with
 *  it today and drifts next month.
 *
 *  NOT read-only, by design (item 1 / dial status). Exporting a business IS the
 *  act of dialing it — he dials the CSV in GoHighLevel and never comes back to
 *  log outcomes — so download flips every included business to dialStatus
 *  "dialed" with a timestamp and an append-only history event. That is what keeps
 *  the generator from ever re-serving someone already dialed, with zero effort
 *  from him. Because it mutates, it is POST, not GET.
 *
 *  It never DEMOTES a permanent status: a booked / not_interested / do_not_call
 *  that somehow sits in the queue is left exactly as-is (and shows up in the
 *  file's Dial Status column as the flag it is).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQueueParams, selectQueueLeads } from "@/lib/call-queue-query";
import {
  buildCallQueueCsv,
  exportFilename,
  type ExportLead,
} from "@/lib/call-queue-csv";
import { isGeneratable, recordDialStatusBulk } from "@/lib/dial-status";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const query = parseQueueParams(new URL(req.url).searchParams, now);
  const selected = await selectQueueLeads(session.user.id, query, now);

  // Which included businesses may be flipped to "dialed". Only fresh and
  // already-dialed qualify: a permanent status (booked / not_interested /
  // do_not_call / disqualified) must never be demoted by a re-export. A repeat
  // export of a still-dialed retry lead records another "dialed" event, which is
  // exactly the fresh → dialed → dialed → … trail the retry cadence should leave.
  const markableIds = selected
    .filter((b) => isGeneratable(b.dialStatus) || b.dialStatus === "dialed")
    .map((b) => b.id);

  const dialedAt = new Date();
  if (markableIds.length > 0) {
    await prisma.$transaction((tx) =>
      recordDialStatusBulk(tx, {
        businessIds: markableIds,
        userId: session.user.id,
        status: "dialed",
        source: "export",
        at: dialedAt,
      })
    );
  }
  const marked = new Set(markableIds);

  const leads: ExportLead[] = selected.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.phone,
    website: b.website,
    city: b.city,
    address: b.address,
    industry: b.industry,
    status: b.status,
    // EFFECTIVE dial status: the ones we just flipped read "dialed" in the file;
    // any permanent status left untouched shows through as the leak flag it is.
    dialStatus: marked.has(b.id) ? "dialed" : b.dialStatus,
    nextAction: b.nextAction,
    attemptCount: b.attemptCount,
    rating: b.rating,
    reviewCount: b.reviewCount,
    mapsUrl: b.mapsUrl,
    painPoint: b.painPoint,
    outreachAngle: b.outreachAngle,
    ownerName: b.ownerName,
  }));

  const { csv, rowCount, skippedNoPhone, writtenIds } = buildCallQueueCsv(leads, query.dateKey);
  const filename = exportFilename(query.dateKey);

  // CLEAR THE QUEUE ON DOWNLOAD. Once a business is in the file it is GoHighLevel's
  // to track, and leaving it here only builds a list the operator never works from.
  //
  // SOFT delete, like every other removal in this app: the row, its dial-status
  // history and its googlePlaceId all survive. That last one is load-bearing —
  // resurfacesIntoFreshBatch returns false for any row carrying deletedAt, and the
  // generator's exclude-set query deliberately does NOT filter deleted rows out, so
  // a cleared business can never be sourced back into a future batch. Clearing is
  // what prevents a re-dial, not what risks one.
  //
  // Only rows ACTUALLY WRITTEN are cleared. A lead skipped for want of a dialable
  // phone never reached GoHighLevel, so clearing it would drop it out of both
  // systems at once and leave nothing pointing at the fact it existed.
  // AND it must be safe to touch. `marked` is the set the dial stamp already
  // filters to — fresh or dialed only, never a permanent outcome — and the
  // clear reuses it rather than restating the rule.
  //
  // Without this, a BOOKED_ZOOM lead whose next action has fallen into the past
  // is back in the queue (isInQueue tests the lead status and the due time, not
  // the dial status), so it rides into the file and gets soft-deleted with the
  // cold ones. That is a booked call disappearing out of the CRM. The stamp was
  // always careful here — "a permanent status must never be demoted by a
  // re-export" — and the clear, which is the more destructive of the two, was
  // not.
  const clearableIds = writtenIds.filter((id) => marked.has(id));
  let cleared = 0;
  if (clearableIds.length > 0) {
    const clearedRes = await prisma.business.updateMany({
      where: { id: { in: clearableIds }, userId: session.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    cleared = clearedRes.count;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // The filename is the tracking mechanism — one of these lands in his
      // downloads folder every morning and has to stay identifiable later.
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Counts ride in headers so the UI can report the outcome without having
      // to parse the body it is about to hand to the browser as a download.
      "X-Row-Count": String(rowCount),
      "X-Skipped-No-Phone": String(skippedNoPhone),
      "X-Marked-Dialed": String(markableIds.length),
      "X-Cleared": String(cleared),
      "Cache-Control": "no-store",
    },
  });
}
