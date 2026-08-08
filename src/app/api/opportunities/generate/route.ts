// Daily prospect generation.
//
// POST { niche, count? } — sources a fresh batch of REAL prospects in that niche
// from Google Places (rotated across NA metros), dedups against everything this
// operator has already seen or recently declined, scores by need, writes a call
// angle for each, and persists them as SUGGESTED leads awaiting approve/decline.
//
// count is operator-chosen (the box beside Filter/Shuffle) and clamped to
// [MIN_BATCH_SIZE, MAX_BATCH_SIZE]. It is a TARGET, not a promise: the metro
// gate only sources from cities in a live calling window, so a large batch run
// during a narrow window comes back short ON PURPOSE. The response carries
// `requested` alongside `count` so the UI can say which happened.
//
// Idempotent-ish per day: if a SUGGESTED batch already exists it is replaced, so
// re-generating the same niche the same day doesn't stack duplicates.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gatherProspects, writeAngles } from "@/lib/daily-prospects";
import { clampBatchSize, DECLINE_COOLDOWN_DAYS, NA_METROS } from "@/lib/crm";
import { anyMetroCallableNow } from "@/lib/call-timing";
import { resurfacesIntoFreshBatch } from "@/lib/dial-status";

export const dynamic = "force-dynamic";
// A 30-lead run touches ~3 metros and one LLM wave. A 150-lead run walks every
// open metro and fans ~19 angle-writing calls, so the old 120s ceiling was a
// timeout waiting to happen at the sizes this box now allows.
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    niche?: string;
    count?: number;
  } | null;
  const niche = body?.niche?.trim();
  if (!niche) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }
  // Clamped, never rejected: a bad number in the count box falls back to the
  // default rather than costing the operator the run.
  const requested = clampBatchSize(body?.count);

  // Dedup set: EVERY Place this operator has ever seen — including cleared/removed
  // (soft-deleted) rows. A lead you cleared or removed must NEVER come back as a
  // fresh SUGGESTED lead on the next generation; excluding only live rows was the
  // bug that resurrected cleared leads and created duplicate rows (16× the same
  // business). So we scan ALL rows (no deletedAt filter) and exclude their Places.
  //
  // The ONE intentional exception is the decline cooldown: a still-live DECLINED
  // lead whose declinedAt is older than the cooldown window is allowed to resurface
  // (a long-ago pre-dial "not for me" can be re-approached). A cleared (soft-
  // deleted) row is never eligible to resurface — clearing means gone.
  //
  // dialStatus is the HARD gate layered on top: only "fresh" businesses may ever
  // resurface. A business that has been dialed, said no, asked never to be called,
  // booked, or been disqualified is excluded no matter what the cooldown says —
  // so the 90-day re-approach can revive a fresh pre-dial decline but can NEVER
  // revive a do_not_call. This is the compliance guarantee: once someone is
  // do_not_call, no generation can hand them back.
  const cooldownCutoff = new Date(Date.now() - DECLINE_COOLDOWN_DAYS * 86_400_000);
  const known = await prisma.business.findMany({
    where: { userId: session.user.id },
    select: { googlePlaceId: true, status: true, dialStatus: true, declinedAt: true, deletedAt: true },
  });
  const exclude = new Set<string>();
  for (const b of known) {
    if (!b.googlePlaceId) continue;
    // The exclusion rule lives in one shared predicate (dial-status.ts) so the
    // generator and scripts/prove-dnc.ts exercise identical logic — a do_not_call
    // proven excluded in the script is excluded here by the same code.
    if (!resurfacesIntoFreshBatch(b, cooldownCutoff)) exclude.add(b.googlePlaceId);
  }

  // Rotate the metro start by day-of-year so each day surfaces fresh cities.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );

  let batch;
  try {
    batch = await gatherProspects(niche, exclude, requested, dayOfYear);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    const status = msg.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
  const prospects = batch.prospects;

  if (prospects.length === 0) {
    return NextResponse.json({
      leads: [],
      requested,
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
    // skipDuplicates pairs with the partial unique index: two generate requests
    // racing each other (a double-click, two tabs) both build the same exclude
    // set and both try to insert. Without this the second one 500s and the
    // operator loses the batch; with it, the overlap is silently dropped and the
    // rest lands.
    skipDuplicates: true,
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

  // ONLY the prospects this run created — matched by the exact Place IDs just
  // written, not by niche.
  //
  // This used to return every un-triaged SUGGESTED lead in the niche. Generation
  // appends, so a run of 77 against a niche already holding 30 from an old test
  // answered with 107 — and the operator, who typed 77, got 107 on screen with
  // no explanation of where the extra 30 came from. The count box has to mean
  // what it says: ask for 77, see 77. The older 30 still exist and still show in
  // the CRM's New Leads column, which is where a backlog belongs.
  const createdPlaceIds = prospects.map((p) => p.placeId).filter(Boolean);
  const leads = await prisma.business.findMany({
    where: {
      userId: session.user.id,
      status: "SUGGESTED",
      source: "DAILY",
      industry: niche,
      deletedAt: null,
      googlePlaceId: { in: createdPlaceIds },
    },
    orderBy: { reviewCount: "asc" },
  });

  // outsideCallingHours = true only when it's off-hours across ALL metros (late
  // night) and the batch fell back to the soonest-to-open regions. The UI shows a
  // heads-up when this is set.
  //
  // requested vs sourced is the honest pair. `count` stays what it has always
  // been — every SUGGESTED lead sitting in this niche, including ones generated
  // on earlier runs — so it cannot answer "did I get my 77?". `sourced` is what
  // THIS run added, and when it lands under `requested` the shortfall is the
  // calling-window gate doing its job, not an error. Say that plainly rather
  // than letting a silent 61-of-77 read as a bug.
  return NextResponse.json({
    niche,
    count: leads.length,
    leads,
    requested,
    sourced: prospects.length,
    metrosOpen: batch.metrosOpen,
    outsideCallingHours: !anyMetroCallableNow(NA_METROS, new Date()),
  });
}
