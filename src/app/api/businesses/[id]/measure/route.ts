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
import { measureFacts } from "@/lib/measure-facts";
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
