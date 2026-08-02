import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBusinessSchema } from "@/lib/validations";
import { observedFactsFor } from "@/lib/observed-facts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { id: params.id, userId: session.user.id, deletedAt: null },
      include: {
        generatedSystems: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        proposals: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, monthlyPrice: true, createdAt: true },
        },
        callLogs: {
          where: { deletedAt: null },
          orderBy: { calledAt: "desc" },
          select: { id: true, disposition: true, note: true, durationSec: true, calledAt: true },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Observed facts are computed HERE, server-side, from the snapshot columns —
    // and those columns are then withheld from the payload. The research/PSI
    // snapshots are multi-MB JSON no client code reads (verified: nothing under
    // src/ touches business.psiSnapshot / business.researchSnapshot from a
    // fetch payload); shipping them was pure weight. The small ObservedFacts
    // object is what the pre-dial row renders.
    const observedFacts = observedFactsFor(business);
    const {
      psiSnapshot: _omitPsiSnapshot,
      researchSnapshot: _omitResearchSnapshot,
      ...clientSafe
    } = business;

    return NextResponse.json({ business: { ...clientSafe, observedFacts } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateBusinessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // A manual status move (board drag / record control) counts as a touch.
    const data = parsed.data.status
      ? { ...parsed.data, lastActivityAt: new Date() }
      : parsed.data;

    const business = await prisma.business.updateMany({
      where: { id: params.id, userId: session.user.id, deletedAt: null },
      data,
    });

    if (business.count === 0) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const updated = await prisma.business.findFirst({
      where: { id: params.id, userId: session.user.id, deletedAt: null },
    });

    // Same blob discipline as GET: the snapshot columns are server-side inputs,
    // not payload. Every consumer of this PATCH merges single fields ("MERGE,
    // don't replace" — see businesses/[id]/page.tsx) or ignores the body, and an
    // intake chip click was downloading megabytes of stored scrape JSON for
    // nothing. observedFacts stays a GET concern — no PATCH consumer reads it.
    if (!updated) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const {
      psiSnapshot: _omitPsiSnapshot,
      researchSnapshot: _omitResearchSnapshot,
      ...clientSafe
    } = updated;

    return NextResponse.json({ business: clientSafe });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Soft-delete: never hard-delete. Set deletedAt; the row stays in the DB and is
    // filtered out of reads (deletedAt: null). Always recoverable.
    await prisma.business.updateMany({
      where: { id: params.id, userId: session.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
