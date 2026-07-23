// Today's suggested batch — the SUGGESTED leads awaiting approve/decline.
// Returns whatever the most recent generation produced so the triage list is
// stable across reloads until the operator clears it.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?niche= scopes to one niche's persisted batch. Without it we surface
  // the most recently generated niche so a fresh page load lands somewhere useful.
  let niche = new URL(req.url).searchParams.get("niche")?.trim() || null;
  if (!niche) {
    const latest = await prisma.business.findFirst({
      where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { industry: true },
    });
    niche = latest?.industry ?? null;
  }

  const leads = niche
    ? await prisma.business.findMany({
        where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY", industry: niche, deletedAt: null },
        orderBy: [{ reviewCount: "asc" }, { createdAt: "desc" }],
      })
    : [];

  // How many cleared (soft-deleted) un-triaged prospects are sitting recoverable —
  // powers the "Restore cleared" affordance. Only never-worked SUGGESTED rows count.
  const clearedCount = await prisma.business.count({
    where: {
      userId: session.user.id,
      status: "SUGGESTED",
      deletedAt: { not: null },
      callLogs: { none: {} },
    },
  });

  return NextResponse.json({ niche, count: leads.length, leads, clearedCount });
}

// Restore a previously-cleared batch: flips deletedAt back to null on the
// soft-deleted, never-worked SUGGESTED prospects so they reappear in Opportunities
// (and the CRM's New Leads). Optional ?niche= scopes the restore to one niche;
// without it, every cleared un-triaged prospect comes back.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "restore") {
    return NextResponse.json({ error: "action: 'restore' is required" }, { status: 400 });
  }

  const niche = new URL(req.url).searchParams.get("niche")?.trim() || null;

  const result = await prisma.business.updateMany({
    where: {
      userId: session.user.id,
      status: "SUGGESTED",
      deletedAt: { not: null },
      callLogs: { none: {} },
      ...(niche ? { industry: niche } : {}),
    },
    data: { deletedAt: null },
  });

  return NextResponse.json({ restored: result.count });
}

// Clear the un-triaged batch: SOFT-deletes every still-SUGGESTED prospect that has
// NO call history so it disappears from BOTH Opportunities and the CRM's New Leads
// column. Optional ?niche= scopes the clear to one niche.
//
// We NEVER hard-delete. "Clear" sets deletedAt; every row stays in the DB and is
// always recoverable — reads filter deletedAt: null so cleared leads don't resurface.
// The call-history guard is retained (only raw, never-worked suggestions are cleared).
// `source` is intentionally not filtered so leads reset back to New Leads (any
// source) are caught too.
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const niche = new URL(req.url).searchParams.get("niche")?.trim() || null;

  const result = await prisma.business.updateMany({
    where: {
      userId: session.user.id,
      status: "SUGGESTED",
      callLogs: { none: {} },
      deletedAt: null,
      ...(niche ? { industry: niche } : {}),
    },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ cleared: result.count });
}
