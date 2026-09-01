// CRM API — the full lead lifecycle in one place, driven entirely by
// Business.status (no parallel pipeline table). GET returns every lead the
// operator owns, mapped to its board column, with the last call outcome and any
// attached deal $ so the board/table can render value on the closing columns.
//
// Status moves are written through the existing PATCH /api/businesses/[id]
// (it stamps lastActivityAt) — this route is read-only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOARD_STATUSES, stageForStatus } from "@/lib/crm";
import { MONTHLY_RETAINER_CAD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // POST-BOOKING ONLY. The pipeline is run in GoHighLevel; the only thing this
  // software needs from a lead's status is whether it has booked, because that is
  // the gate on generating its documents.
  //
  // Without this filter the board loaded every live business — so a cold lead you
  // declined months ago still sat in the table, and at 10,000+ dialled businesses
  // that is a screen nobody could read. Cold leads are already gone by two other
  // routes (exported ones are soft-deleted, declined ones just are not shown), and
  // DECLINED rows deliberately STAY in the database: they are what the 90-day
  // re-approach window reads. This hides them; it does not touch them.
  //
  // BOARD_STATUSES is derived from the two columns the board draws, so the query
  // and the board cannot disagree about what belongs here.
  const businesses = await prisma.business.findMany({
    where: { userId: session.user.id, deletedAt: null, status: { in: BOARD_STATUSES } },
    include: {
      callLogs: {
        where: { deletedAt: null },
        orderBy: { calledAt: "desc" },
        take: 1,
        select: { disposition: true, note: true, calledAt: true },
      },
      deals: { where: { deletedAt: null }, select: { monthlyValue: true } },
    },
  });

  const leads = businesses.map((b) => {
    const lastCall = b.callLogs[0];
    // Monthly value: prefer an attached deal, else the standard retainer. It
    // used to read the latest proposal's price; that row no longer exists and
    // the retainer is one number for every client (see src/lib/crm-rollup.ts).
    const dealValue = b.deals.reduce((s, d) => s + (d.monthlyValue || 0), 0);
    const monthlyValue = dealValue || MONTHLY_RETAINER_CAD;
    return {
      id: b.id,
      name: b.name,
      city: b.city,
      industry: b.industry,
      phone: b.phone,
      website: b.website,
      rating: b.rating,
      reviewCount: b.reviewCount,
      status: b.status,
      stage: stageForStatus(b.status),
      nextAction: b.nextAction,
      nextActionAt: b.nextActionAt?.toISOString() ?? null,
      attemptCount: b.attemptCount,
      lastActivityAt: (b.lastActivityAt ?? b.createdAt).toISOString(),
      source: b.source,
      monthlyValue,
      lastCall: lastCall
        ? {
            disposition: lastCall.disposition,
            note: lastCall.note,
            calledAt: lastCall.calledAt.toISOString(),
          }
        : null,
    };
  });

  return NextResponse.json({ leads });
}
