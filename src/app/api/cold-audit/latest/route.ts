// Returns the latest saved Cold-Open Audit for a given business (owned by the
// user). Used by Studio to restore the last audit on refresh / session resume.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const latest = await prisma.generatedSystem.findFirst({
    where: { businessId, userId: session.user.id, type: "COLD_AUDIT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, content: true },
  });

  if (!latest) return NextResponse.json({ audit: null });
  return NextResponse.json({
    audit: latest.content,
    generatedAt: latest.createdAt,
    id: latest.id,
  });
}
