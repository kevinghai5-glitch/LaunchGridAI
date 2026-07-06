import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBusinessSchema } from "@/lib/validations";

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
      where: { id: params.id, userId: session.user.id },
      include: {
        generatedSystems: {
          orderBy: { createdAt: "desc" },
        },
        proposals: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, monthlyPrice: true, createdAt: true },
        },
        callLogs: {
          orderBy: { calledAt: "desc" },
          select: { id: true, disposition: true, note: true, durationSec: true, calledAt: true },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ business });
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
      where: { id: params.id, userId: session.user.id },
      data,
    });

    if (business.count === 0) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const updated = await prisma.business.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    return NextResponse.json({ business: updated });
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

    await prisma.business.deleteMany({
      where: { id: params.id, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
