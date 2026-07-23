// Zoom Room data — the leads that carry a live Zoom state (booked / no-show /
// deciding), plus a fallback "most recent" lead so the empty-state can offer a
// runner preview. Feeds the "Zoom Room" toggle on the Calendar page. Unscoped by
// date on purpose: these are lifecycle states, not calendar slots.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@/lib/call-queue";

export const dynamic = "force-dynamic";

const ZOOM_STATUSES: LeadStatus[] = ["BOOKED_ZOOM", "ZOOM_OPEN", "ZOOM_NO_SHOW"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [zoomLeads, recentLead] = await Promise.all([
    prisma.business.findMany({
      where: { userId: session.user.id, status: { in: ZOOM_STATUSES }, deletedAt: null },
      orderBy: { nextActionAt: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        industry: true,
        phone: true,
        status: true,
        nextActionAt: true,
      },
    }),
    prisma.business.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { lastActivityAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({
    zoomLeads: zoomLeads.map((l) => ({
      ...l,
      nextActionAt: l.nextActionAt ? l.nextActionAt.toISOString() : null,
    })),
    recentLead,
  });
}
