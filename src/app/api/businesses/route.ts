import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveBusinessSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const favoritedOnly = url.searchParams.get("favorited") === "true";

    const businesses = await prisma.business.findMany({
      where: {
        userId: session.user.id,
        ...(favoritedOnly ? { favorited: true } : {}),
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
