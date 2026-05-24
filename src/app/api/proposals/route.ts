import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProposalSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const proposals = await prisma.proposal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { business: true },
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitCheck = await checkPlanLimit(session.user.id, "proposals");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Proposal limit reached (${limitCheck.limit}). Upgrade to Pro for unlimited.`, limitReached: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createProposalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // Verify business belongs to user
    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const proposal = await prisma.proposal.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}
