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
// The audit peek this route used to compute off the latest COLD_AUDIT row was
// replaced by the observed-facts row when the cold audit was deleted (owner
// ruling, 2026-08-01). Computed HERE, server-side, off the snapshot columns the
// row already carries — only the small ObservedFacts object ships; the multi-MB
// snapshots never reach the client.
import { observedFactsFor } from "@/lib/observed-facts";

export const dynamic = "force-dynamic";

// Default block lengths (minutes). Mirrors the Diagnose/Pivot/Proposal 0–30 Zoom.
const ZOOM_MIN = 30;
const CALLBACK_MIN = 15;

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
      deletedAt: null,
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
        // The four pre-dial values (cached, pure-CPU) — a week of Zooms is a
        // small set, so every event carries its row.
        observedFacts: observedFactsFor(b),
        enrichment: {
          rating: b.rating,
          reviewCount: b.reviewCount,
          painPoint: b.painPoint,
          outreachAngle: b.outreachAngle,
        },
      };
    });

  // Per-day cold-call counts: untimed leads that are callable now feed the
  // all-day lane. Cold calls have no individual time slot, so they all attribute
  // to "today" (the only day they're actionable from the burn-down list).
  const callable = await prisma.business.findMany({
    where: { userId: session.user.id, deletedAt: null },
    select: { status: true, nextActionAt: true, followUpUntil: true },
  });
  const coldCount = callable.filter((b) =>
    isInQueue({ status: b.status, nextActionAt: b.nextActionAt, followUpUntil: b.followUpUntil }, now)
  ).length;

  const coldCalls: Record<string, number> = {};
  if (coldCount > 0) coldCalls[ymd(now)] = coldCount;

  return NextResponse.json({ events, coldCalls });
}
