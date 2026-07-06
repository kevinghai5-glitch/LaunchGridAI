// Triage a suggested batch: approve leads into the call queue, or decline them.
//
// POST { action: "approve" | "decline", ids?: string[], all?: boolean }
//   - approve → status QUEUED, due now (drops into the Call Queue immediately)
//   - decline → status DECLINED + declinedAt (suppressed until the cooldown ends)
//   - all:true applies to the operator's entire current SUGGESTED batch.

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

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    ids?: string[];
    all?: boolean;
  } | null;

  const action = body?.action;
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ error: "action must be approve or decline" }, { status: 400 });
  }

  // Only ever touch the operator's own currently-SUGGESTED leads.
  const where = {
    userId: session.user.id,
    status: "SUGGESTED",
    ...(body?.all ? {} : { id: { in: body?.ids ?? [] } }),
  };

  if (!body?.all && (!body?.ids || body.ids.length === 0)) {
    return NextResponse.json({ error: "ids or all is required" }, { status: 400 });
  }

  const now = new Date();
  const data =
    action === "approve"
      ? {
          status: "QUEUED",
          nextAction: "Cold call",
          nextActionAt: now,
          lastActivityAt: now,
        }
      : {
          status: "DECLINED",
          declinedAt: now,
          lastActivityAt: now,
        };

  const result = await prisma.business.updateMany({ where, data });

  return NextResponse.json({ updated: result.count, action });
}
