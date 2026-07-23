// Daily prospect generation.
//
// POST { niche } — sources a fresh batch of REAL prospects in that niche from
// Google Places (rotated across NA metros), dedups against everything this
// operator has already seen or recently declined, scores by need, writes a call
// angle for each, and persists them as SUGGESTED leads awaiting approve/decline.
//
// Idempotent-ish per day: if a SUGGESTED batch already exists it is replaced, so
// re-generating the same niche the same day doesn't stack duplicates.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gatherProspects, writeAngles } from "@/lib/daily-prospects";
import { DAILY_BATCH_SIZE, DECLINE_COOLDOWN_DAYS, NA_METROS } from "@/lib/crm";
import { anyMetroCallableNow } from "@/lib/call-timing";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { niche?: string } | null;
  const niche = body?.niche?.trim();
  if (!niche) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  // Dedup set: EVERY Place this operator has ever seen — including cleared/removed
  // (soft-deleted) rows. A lead you cleared or removed must NEVER come back as a
  // fresh SUGGESTED lead on the next generation; excluding only live rows was the
  // bug that resurrected cleared leads and created duplicate rows (16× the same
  // business). So we scan ALL rows (no deletedAt filter) and exclude their Places.
  //
  // The ONE intentional exception is the decline cooldown: a still-live DECLINED
  // lead whose declinedAt is older than the cooldown window is allowed to resurface
  // (a long-ago "not interested" can be re-approached). A cleared (soft-deleted)
  // row is never eligible to resurface — clearing means gone.
  const cooldownCutoff = new Date(Date.now() - DECLINE_COOLDOWN_DAYS * 86_400_000);
  const known = await prisma.business.findMany({
    where: { userId: session.user.id },
    select: { googlePlaceId: true, status: true, declinedAt: true, deletedAt: true },
  });
  const exclude = new Set<string>();
  for (const b of known) {
    if (!b.googlePlaceId) continue;
    if (!b.deletedAt && b.status === "DECLINED" && b.declinedAt && b.declinedAt < cooldownCutoff) {
      continue; // live, cooled-down decline — eligible to resurface
    }
    exclude.add(b.googlePlaceId);
  }

  // Rotate the metro start by day-of-year so each day surfaces fresh cities.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );

  let prospects;
  try {
    prospects = await gatherProspects(niche, exclude, DAILY_BATCH_SIZE, dayOfYear);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    const status = msg.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  if (prospects.length === 0) {
    return NextResponse.json({
      leads: [],
      message: "No fresh prospects found for this niche right now. Try another niche.",
    });
  }

  // Generation stays FAST: it only sources + scores prospects and writes their
  // call angle. Owner/decision-maker resolution (a per-site fetch) is deliberately
  // NOT done here — fanning it across all 30 Places results blew the request
  // budget and made generation time out. It instead runs when you APPROVE a lead
  // into the Call Queue (see /api/opportunities/triage), scoped to just the leads
  // you keep, so the owner is ready by the time you dial without ever slowing this.
  const angles = await writeAngles(prospects, niche);

  // Append to (not replace) this niche's SUGGESTED batch. Prospects you've already
  // generated persist until you approve them into the Call Queue, so re-visiting a
  // niche another day still shows what you sourced. The dedup exclude-set above
  // already prevents the same Place from being added twice.
  const now = new Date();
  await prisma.business.createMany({
    data: prospects.map((p, i) => ({
      userId: session.user.id,
      googlePlaceId: p.placeId || null,
      name: p.name,
      address: p.address || null,
      phone: p.phone || null,
      website: p.website || null,
      rating: p.rating || null,
      reviewCount: p.userRatingsTotal || null,
      latitude: p.location?.lat || null,
      longitude: p.location?.lng || null,
      mapsUrl: p.mapsUrl || null,
      category: p.category || null,
      description: p.description || null,
      photoUrl: p.photoUrl || null,
      industry: niche,
      city: p.metro || null,
      painPoint: angles[i]?.painPoint || null,
      outreachAngle: angles[i]?.outreachAngle || null,
      status: "SUGGESTED",
      source: "DAILY",
      lastActivityAt: now,
    })),
  });

  const leads = await prisma.business.findMany({
    where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY", industry: niche, deletedAt: null },
    orderBy: { reviewCount: "asc" },
  });

  // outsideCallingHours = true only when it's off-hours across ALL metros (late
  // night) and the batch fell back to the soonest-to-open regions. The UI shows a
  // heads-up when this is set.
  return NextResponse.json({
    niche,
    count: leads.length,
    leads,
    outsideCallingHours: !anyMetroCallableNow(NA_METROS, new Date()),
  });
}
