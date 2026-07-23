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
import { resolveOwnersBatch } from "@/lib/owner-name";

export const dynamic = "force-dynamic";

// Owner/decision-maker names are resolved HERE, at approve time — not at
// generation — because it's a per-site fetch and only the leads you actually keep
// are worth spending it on. Fired in the background so approve returns instantly;
// the names cache onto the rows and show up in the Call Queue moments later. A
// blank owner is fine (verifiable-or-silent), so any failure is swallowed.
function backfillOwnersInBackground(
  leads: { id: string; name: string; website: string | null; ownerName: string | null }[]
): void {
  const pending = leads.filter((l) => l.website && !l.ownerName);
  if (pending.length === 0) return;
  void resolveOwnersBatch(pending)
    .then(async (owners) => {
      await Promise.all(
        owners.map((owner, i) =>
          owner
            ? prisma.business
                .update({ where: { id: pending[i].id }, data: { ownerName: owner } })
                .catch(() => {})
            : Promise.resolve()
        )
      );
    })
    .catch(() => {});
}

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
    deletedAt: null,
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

  // For approve, capture the kept leads BEFORE the update (the where-clause filters
  // on status: SUGGESTED, which the update clears) so we can resolve their owners.
  const approved =
    action === "approve"
      ? await prisma.business.findMany({
          where,
          select: { id: true, name: true, website: true, ownerName: true },
        })
      : [];

  const result = await prisma.business.updateMany({ where, data });

  // Fire-and-forget: resolve owner names for the leads just approved into the
  // queue. Non-blocking so approve stays instant; names cache in behind it.
  if (action === "approve") backfillOwnersInBackground(approved);

  return NextResponse.json({ updated: result.count, action });
}
