/** POST /api/businesses/[id]/measure — the "Fetch measured values" button.
 *
 *  Operator-triggered, never automatic. Two external calls (one mobile-only
 *  PageSpeed, one plain homepage GET) — see src/lib/measure-facts.ts for why
 *  those two and nothing else.
 *
 *  It writes measuredFacts / measuredFactsAt and NEVER touches researchSnapshot
 *  or psiSnapshot. Those columns mean "a full research capture ran"; this did
 *  not run one, and a half-filled snapshot would make an unrun scan look like a
 *  scan that found nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { measureFacts, type MeasuredFacts } from "@/lib/measure-facts";
import { observedFactsFor } from "@/lib/observed-facts";

export const dynamic = "force-dynamic";
// Two network calls, one of which is PageSpeed (35s client timeout).
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Nothing to measure without a site. A readable 422 rather than a 500 or a
  // silent all-unknown write: the operator should learn the record is missing a
  // website, not that "the button doesn't work".
  if (!business.website?.trim()) {
    return NextResponse.json(
      {
        error:
          "No website on record for this business, so there is nothing to measure. Add the site URL to the record and try again.",
      },
      { status: 422 }
    );
  }

  const measured = await measureFacts(business.website);
  const measuredFactsAt = new Date();

  const updated = await prisma.business.update({
    where: { id: business.id },
    data: { measuredFacts: measured as unknown as object, measuredFactsAt },
  });

  // Return the recomputed row so the client updates in place — the operator is
  // mid-prep and should not have to reload to see what he just paid for.
  return NextResponse.json({
    ok: true,
    measuredAt: measuredFactsAt.toISOString(),
    observedFacts: observedFactsFor(updated),
  });
}

/** PATCH /api/businesses/[id]/measure — correct one measured value by hand.
 *
 *  The booking-link check is a text scan of the homepage HTML: it looks for a
 *  known booking host and infers from that. It is wrong often enough that the
 *  operator reads it on a live call and knows better, and a value stated to a
 *  prospect that the prospect knows is wrong costs more than the check is worth.
 *
 *  It writes the same measuredFacts column the scan writes, and it DOES stamp
 *  measuredFactsAt. That was not the first instinct — a hand edit did not run the
 *  checks, so leaving the timestamp alone felt more honest. It made the control a
 *  silent no-op: observedFactsFor only lets a measure win when it is the FRESHER
 *  source, so an unstamped correction loses to whatever snapshot came before it
 *  and the value on screen never changes. The timestamp does not claim a scan
 *  ran; it records when this row's values were last established, and the operator
 *  reading the site on a call establishes them more recently than any scan did.
 *
 *  Only bookingLink is editable. The other three are either a real number from
 *  PageSpeed or a count from Google; if one of those is wrong the fix is to
 *  re-measure, not to type over it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { bookingLink?: unknown } | null;
  const next = body?.bookingLink;
  if (next !== "found" && next !== "none" && next !== "unknown") {
    return NextResponse.json(
      { error: 'bookingLink must be "found", "none" or "unknown"' },
      { status: 400 }
    );
  }

  const business = await prisma.business.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Merge onto whatever the last scan wrote rather than replacing it. Written
  // from scratch this would blank the mobile score and the click-to-call result,
  // which ARE measured, because a correction to one value is not a measurement of
  // the other three.
  // The merge must produce a COMPLETE MeasuredFacts. asMeasuredFacts rejects the
  // whole object unless both presence fields are one of found/none/unknown, so a
  // partial write — bookingLink alone, on a business that was never scanned — is
  // silently discarded and nothing changes on screen.
  const prev = (business.measuredFacts ?? {}) as Partial<MeasuredFacts>;
  const merged: MeasuredFacts = {
    mobile: prev.mobile ?? null,
    bookingLink: next,
    clickToCall:
      prev.clickToCall === "found" || prev.clickToCall === "none" ? prev.clickToCall : "unknown",
  };

  const updated = await prisma.business.update({
    where: { id: business.id },
    data: { measuredFacts: merged as unknown as object, measuredFactsAt: new Date() },
  });

  return NextResponse.json({ ok: true, observedFacts: observedFactsFor(updated) });
}
