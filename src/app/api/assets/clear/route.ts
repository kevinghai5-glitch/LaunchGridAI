// POST /api/assets/clear — retire a business's saved deliverables.
//
// It exists so a pack can be thrown away and rebuilt from scratch. "Regenerate"
// overwrites in place, which is right when the pack is nearly correct and wrong
// when it was built from answers that have since changed: the operator wants an
// empty column and a clean run, not a diff against something stale.
//
// SOFT DELETE, ALWAYS. Nothing here is destroyed. The GeneratedSystem rows keep
// their content, their timestamps and their governance stamps forever — they are
// the record of what was sent to a client and when, and that record outlives any
// UI decision to stop showing it. `deletedAt` is set; every read in the app
// already filters on it, so the pack disappears from the Library and the row
// stays in the database.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { businessId?: string } | null;
  const businessId = body?.businessId;
  if (!businessId || typeof businessId !== "string") {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  // Scoped to the operator's own business. A businessId off the wire must never
  // reach another account's rows.
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const now = new Date();
  const { count } = await prisma.generatedSystem.updateMany({
    where: {
      businessId: business.id,
      userId: session.user.id,
      type: "ASSETS",
      deletedAt: null,
    },
    data: { deletedAt: now },
  });

  return NextResponse.json({ ok: true, cleared: count, clearedAt: now.toISOString() });
}
