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
      where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY" },
      orderBy: { createdAt: "desc" },
      select: { industry: true },
    });
    niche = latest?.industry ?? null;
  }

  const leads = niche
    ? await prisma.business.findMany({
        where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY", industry: niche },
        orderBy: [{ reviewCount: "asc" }, { createdAt: "desc" }],
      })
    : [];

  return NextResponse.json({ niche, count: leads.length, leads });
}

// Clear the un-triaged batch: removes every still-SUGGESTED prospect that has NO
// call history so it disappears from BOTH Opportunities and the CRM's New Leads
// column. Optional ?niche= scopes the clear to one niche.
//
// Non-destructive guardrail: a lead that has ever been called (has a CallLog) is
// NEVER hard-deleted here, even if it's back in SUGGESTED — deleting it would
// destroy its call history. Only raw, never-worked suggestions are removed, and
// re-generating a niche resurfaces fresh prospects. `source` is intentionally not
// filtered so leads reset back to New Leads (any source) are caught too.
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const niche = new URL(req.url).searchParams.get("niche")?.trim() || null;

  const result = await prisma.business.deleteMany({
    where: {
      userId: session.user.id,
      status: "SUGGESTED",
      callLogs: { none: {} },
      ...(niche ? { industry: niche } : {}),
    },
  });

  return NextResponse.json({ cleared: result.count });
}
