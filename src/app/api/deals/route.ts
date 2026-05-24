import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDealSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deals = await prisma.deal.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        business: true,
        proposal: {
          select: { id: true, title: true, status: true, monthlyPrice: true },
        },
      },
    });

    return NextResponse.json({ deals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createDealSchema.safeParse(body);

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

    const deal = await prisma.deal.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
      include: {
        business: true,
        proposal: true,
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
