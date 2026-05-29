// Library API — returns the operator's saved asset packs across all businesses,
// most-recent first. Used by /library page for search / filter / restore.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.generatedSystem.findMany({
    where: { userId: session.user.id, type: "ASSETS" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
          city: true,
          industry: true,
          category: true,
          website: true,
          photoUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ items: rows });
}
