// Zoom Calendar API.
//
//  GET — the commitments grid. Returns the timed events a lead already carries:
//        Booked Zooms (status BOOKED_ZOOM) and Callbacks (status CALLBACK), whose
//        nextActionAt falls inside the requested ?from..?to range. No schema of its
//        own — this is pure visualization of datetimes the call-queue flow wrote.
//
//        Also returns per-day cold-call counts (the untimed burn-down) so the
//        calendar's all-day lane can show "N cold calls to make" per day.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isInQueue } from "@/lib/call-queue";
import type { ColdAuditReport } from "@/types";

export const dynamic = "force-dynamic";

// Default block lengths (minutes). Mirrors the Diagnose/Pivot/Proposal 0–30 Zoom.
const ZOOM_MIN = 30;
const CALLBACK_MIN = 15;

// Compact talking-point peek from the latest COLD_AUDIT content JSON.
function auditPeek(content: unknown): {
  topLeak: string | null;
  headlineCost: string | null;
  mobileScore: number | null;
} {
  const r = content as Partial<ColdAuditReport> | null | undefined;
  if (!r || typeof r !== "object") {
    return { topLeak: null, headlineCost: null, mobileScore: null };
  }
  return {
    topLeak: r.findings?.[0]?.title ?? null,
    headlineCost: r.headlineCost ?? null,
    mobileScore: r.performance?.mobileScore ?? null,
  };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  // Default to the current week if no range supplied.
  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now);
  const to = toParam ? new Date(toParam) : new Date(now);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
  }

  const businesses = await prisma.business.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["BOOKED_ZOOM", "CALLBACK"] },
      nextActionAt: { gte: from, lte: to },
    },
    include: {
      generatedSystems: {
        where: { type: "COLD_AUDIT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: { nextActionAt: "asc" },
  });

  const events = businesses
    .filter((b) => b.nextActionAt)
    .map((b) => {
      const start = b.nextActionAt as Date;
      const type: "ZOOM" | "CALLBACK" = b.status === "BOOKED_ZOOM" ? "ZOOM" : "CALLBACK";
      const mins = type === "ZOOM" ? ZOOM_MIN : CALLBACK_MIN;
      const end = new Date(start.getTime() + mins * 60_000);
      return {
        id: b.id,
        businessId: b.id,
        name: b.name,
        phone: b.phone,
        website: b.website,
        city: b.city,
        type,
        start: start.toISOString(),
        end: end.toISOString(),
        mapsUrl: b.mapsUrl,
        enrichment: {
          rating: b.rating,
          reviewCount: b.reviewCount,
          painPoint: b.painPoint,
          outreachAngle: b.outreachAngle,
          ...auditPeek(b.generatedSystems[0]?.content),
        },
      };
    });

  // Per-day cold-call counts: untimed leads that are callable now feed the
  // all-day lane. Cold calls have no individual time slot, so they all attribute
  // to "today" (the only day they're actionable from the burn-down list).
  const callable = await prisma.business.findMany({
    where: { userId: session.user.id },
    select: { status: true, nextActionAt: true, followUpUntil: true },
  });
  const coldCount = callable.filter((b) =>
    isInQueue({ status: b.status, nextActionAt: b.nextActionAt, followUpUntil: b.followUpUntil }, now)
  ).length;

  const coldCalls: Record<string, number> = {};
  if (coldCount > 0) coldCalls[ymd(now)] = coldCount;

  return NextResponse.json({ events, coldCalls });
}
