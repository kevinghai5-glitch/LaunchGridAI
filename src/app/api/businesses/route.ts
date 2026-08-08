import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveBusinessSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { DELIVERABLE_STATUSES } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const favoritedOnly = url.searchParams.get("favorited") === "true";
    // Studio asks for ?deliverable=true so its picker only lists leads in
    // deliverable production (booked a Zoom or beyond) plus any lead with
    // existing generated work — never raw cold prospects.
    const deliverableOnly = url.searchParams.get("deliverable") === "true";

    const businesses = await prisma.business.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        ...(favoritedOnly ? { favorited: true } : {}),
        ...(deliverableOnly
          ? {
              OR: [
                { status: { in: DELIVERABLE_STATUSES } },
                { generatedSystems: { some: { type: { in: ["ASSETS", "COLD_AUDIT"] }, deletedAt: null } } },
                { leakAssessment: { isNot: null } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch businesses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitCheck = await checkPlanLimit(session.user.id, "businessSaves");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Free plan limit reached (${limitCheck.limit} businesses). Upgrade to Pro for unlimited.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = saveBusinessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // ── THE SAME PLACE, TWICE ──────────────────────────────────────────────
    // This is how the one duplicate in the data got there: a business generated
    // into a batch, declined, and later hand-saved again under a different niche
    // — same Google place, two rows, and at 10k dials that is a second call to
    // someone who already said no.
    //
    // The generator dedups against everything the operator has seen; this path
    // never did. It now returns the EXISTING row rather than erroring, because
    // "save this business" and "you already have it" have the same right answer
    // from the caller's point of view: here is the record.
    //
    // A soft-deleted row is deliberately revived rather than duplicated — the
    // history on it (declines, dial status, call logs) is the reason not to
    // start a fresh row beside it.
    if (parsed.data.googlePlaceId) {
      const existing = await prisma.business.findFirst({
        where: { userId: session.user.id, googlePlaceId: parsed.data.googlePlaceId },
      });
      if (existing) {
        if (!existing.deletedAt) {
          return NextResponse.json({ business: existing, alreadySaved: true }, { status: 200 });
        }
        const revived = await prisma.business.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
        return NextResponse.json({ business: revived, revived: true }, { status: 200 });
      }
    }

    const business = await prisma.business.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save business" }, { status: 500 });
  }
}
