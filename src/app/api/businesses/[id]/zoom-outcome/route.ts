// Zoom outcome API.
//
//  POST — record the single outcome of the "On the Zoom" runner (Diagnose →
//         Pivot → Proposal). Applies the deterministic patch from
//         resolveZoomOutcome so the lead advances to the right lifecycle state
//         (WON / ZOOM_OPEN / ZOOM_NO_SHOW / DEAD). No CallLog — a Zoom isn't a
//         dial. Scoped to the session user.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveZoomOutcome } from "@/lib/call-queue";
import { zoomOutcomeSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = zoomOutcomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  const patch = resolveZoomOutcome(parsed.data.outcome);

  const result = await prisma.business.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: {
      status: patch.status,
      nextAction: patch.nextAction,
      nextActionAt: patch.nextActionAt,
      followUpUntil: patch.followUpUntil,
      closedReason: patch.closedReason,
      lastActivityAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: patch.status, nextAction: patch.nextAction });
}
