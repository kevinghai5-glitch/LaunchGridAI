// Daily Call Queue API.
//
//  GET  — today's callable list. Reuses the existing Business model (= "Lead") and
//         its enrichment (rating/reviews) plus the four observed pre-dial values
//         for inline talking points. Filters/sorts/caps in JS (mirrors
//         /api/assets/library).
//
//  POST — log one call disposition. ONE click → ONE transaction: append a CallLog
//         attempt + advance the lead per the deterministic mapping in call-queue.ts.

import { NextResponse } from "next/server";
import { callWindowForCity } from "@/lib/call-timing";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  resolveDisposition,
  urgency,
  type ClosedReason,
  type Disposition,
  type DispositionPatch,
} from "@/lib/call-queue";
// Selection (which leads, in what order, capped) lives in one place so this
// route and the CSV export can never disagree about what "today's queue" is.
import { parseQueueParams, selectQueueLeads } from "@/lib/call-queue-query";
// The audit peek this route used to compute off the latest COLD_AUDIT row was
// replaced by the observed-facts row when the cold audit was deleted (owner
// ruling, 2026-08-01). Computed HERE, server-side, off the snapshot columns the
// row already carries — only the small ObservedFacts object ships; the multi-MB
// snapshots never reach the client.
import { observedFactsFor } from "@/lib/observed-facts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const params = new URL(req.url).searchParams;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Optional ?view / ?date=YYYY-MM-DD — see parseQueueParams.
  const query = parseQueueParams(params, now);
  const selected = await selectQueueLeads(session.user.id, query, now);

  const leads = selected
    .map((b) => {
      const lastCall = b.callLogs[0];
      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        website: b.website,
        city: b.city,
        industry: b.industry,
        status: b.status,
        nextAction: b.nextAction,
        nextActionAt: b.nextActionAt?.toISOString() ?? null,
        followUpUntil: b.followUpUntil?.toISOString() ?? null,
        attemptCount: b.attemptCount,
        urgency: urgency(
          { status: b.status, nextActionAt: b.nextActionAt, followUpUntil: b.followUpUntil },
          now
        ),
        // The four pre-dial values, computed after selectQueueLeads has already
        // capped the list, so at most one page of leads pays the (cached,
        // pure-CPU) compute per request.
        observedFacts: observedFactsFor(b),
        // What time it is where THEY are, right now. Read-only — the queue
        // shows it, the operator decides. Nothing is filtered or blocked on it.
        callWindow: callWindowForCity(b.city, now),
        enrichment: {
          rating: b.rating,
          reviewCount: b.reviewCount,
          mapsUrl: b.mapsUrl,
          painPoint: b.painPoint,
          outreachAngle: b.outreachAngle,
          ownerName: b.ownerName,
        },
        lastCall: lastCall
          ? {
              id: lastCall.id,
              disposition: lastCall.disposition,
              note: lastCall.note,
              calledAt: lastCall.calledAt.toISOString(),
            }
          : null,
      };
    });

  // Burn-down progress: how many calls this user has logged so far today.
  const calledToday = await prisma.callLog.count({
    where: { userId: session.user.id, calledAt: { gte: startOfToday }, deletedAt: null },
  });

  return NextResponse.json({ leads, calledToday });
}

const DISPOSITIONS: Disposition[] = [
  "NO_ANSWER",
  "VOICEMAIL",
  "BUSY",
  "GATEKEEPER",
  "CALLBACK",
  "INTERESTED",
  "BOOKED",
  "NOT_INTERESTED",
  "WRONG_NUMBER",
];

// Re-derive a lead's scheduling from its most recent remaining call. Used after an
// edit or undo so the lead reflects whatever its latest disposition now is — or, if
// no calls are left, drops back into the live queue (QUEUED, due now).
function patchFromLatest(latest: Disposition | null, now: Date): DispositionPatch {
  if (!latest) {
    return {
      status: "QUEUED",
      nextAction: "Cold call",
      nextActionAt: now,
      followUpUntil: null,
      closedReason: null,
    };
  }
  return resolveDisposition(latest, { now });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    businessId?: string;
    disposition?: string;
    note?: string;
    callbackTime?: string;
    durationSec?: number;
    closedReason?: string;
  } | null;

  if (!body?.businessId || !body.disposition) {
    return NextResponse.json({ error: "businessId and disposition are required" }, { status: 400 });
  }
  if (!DISPOSITIONS.includes(body.disposition as Disposition)) {
    return NextResponse.json({ error: "Invalid disposition" }, { status: 400 });
  }

  // Scope the lead to the operator. dialStatus comes along so a BOOKED disposition
  // can also advance the dial axis — the SECONDARY path to dialStatus "booked"
  // (the primary is the phone-first logger, because bookings actually happen
  // through a GoHighLevel form, not by tapping BOOKED here).
  const lead = await prisma.business.findFirst({
    where: { id: body.businessId, userId: session.user.id, deletedAt: null },
    select: { id: true, dialStatus: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const now = new Date();
  const callbackTime = body.callbackTime ? new Date(body.callbackTime) : null;
  const patch = resolveDisposition(body.disposition as Disposition, {
    callbackTime: callbackTime && !isNaN(callbackTime.getTime()) ? callbackTime : null,
    closedReason: (body.closedReason as ClosedReason) ?? null,
    now,
  });

  // A BOOKED disposition also flips the dial axis to "booked" — UNLESS the
  // business is already do_not_call, which is permanent and nothing overrides.
  const marksBooked =
    body.disposition === "BOOKED" && lead.dialStatus !== "do_not_call";

  // One click → one transaction: append the attempt + advance the lead (and, on a
  // booking, the dial axis + its history event).
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.callLog.create({
      data: {
        businessId: lead.id,
        userId: session.user.id,
        disposition: body.disposition as Disposition,
        note: body.note?.trim() || null,
        durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
      },
    }),
    prisma.business.update({
      where: { id: lead.id },
      data: {
        status: patch.status,
        nextAction: patch.nextAction,
        nextActionAt: patch.nextActionAt,
        followUpUntil: patch.followUpUntil,
        closedReason: patch.closedReason,
        attemptCount: { increment: 1 },
        ...(marksBooked ? { dialStatus: "booked", dialStatusAt: now } : {}),
      },
      select: {
        id: true,
        status: true,
        nextAction: true,
        nextActionAt: true,
        followUpUntil: true,
        attemptCount: true,
        closedReason: true,
      },
    }),
  ];
  if (marksBooked) {
    ops.push(
      prisma.dialStatusEvent.create({
        data: {
          businessId: lead.id,
          userId: session.user.id,
          status: "booked",
          source: "booking",
          createdAt: now,
        },
      })
    );
  }
  const [, updated] = await prisma.$transaction(ops);

  return NextResponse.json({ lead: updated });
}

// PATCH — non-call lead moves that don't log an attempt (no CallLog written,
// attemptCount untouched). Two actions:
//
//   skip   — defer to tomorrow. Pushes the next touch out a day so the lead
//            leaves today's list but stays QUEUED and resurfaces tomorrow.
//
//   remove — pull the lead OUT of every view without destroying it. SOFT-DELETES
//            the row (deletedAt = now), exactly like the Opportunities "Clear". The
//            row + its CallLog history stay in the DB (recoverable, never hard-
//            deleted), but every read filters deletedAt: null, so the lead vanishes
//            from ALL surfaces: today's queue, any past/date history view, the CRM
//            board (every column, including Lost), Opportunities and Saved. It does
//            NOT reappear anywhere. Use this when testing to fully clear a lead.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    businessId?: string;
    action?: string;
    logId?: string;
    disposition?: string;
    note?: string;
  } | null;

  // editLog — change a previously-logged disposition/note. Updates the CallLog in
  // place (preserving the row, per the non-destructive rule) and, when it's the
  // lead's most recent call, re-advances the lead to match the new outcome.
  if (body?.action === "editLog") {
    if (!body.logId || !body.disposition) {
      return NextResponse.json(
        { error: "logId and disposition are required" },
        { status: 400 }
      );
    }
    if (!DISPOSITIONS.includes(body.disposition as Disposition)) {
      return NextResponse.json({ error: "Invalid disposition" }, { status: 400 });
    }
    // Scope the log to the operator via its business.
    const log = await prisma.callLog.findFirst({
      where: { id: body.logId, userId: session.user.id, deletedAt: null },
      select: { id: true, businessId: true },
    });
    if (!log) {
      return NextResponse.json({ error: "Call log not found" }, { status: 404 });
    }

    await prisma.callLog.update({
      where: { id: log.id },
      data: {
        disposition: body.disposition as Disposition,
        note: body.note?.trim() || null,
      },
    });

    // Only re-advance the lead if this is its latest call (status mirrors the most
    // recent disposition). Editing an older log is a pure history correction.
    const latest = await prisma.callLog.findFirst({
      where: { businessId: log.businessId, deletedAt: null },
      orderBy: { calledAt: "desc" },
      select: { id: true, disposition: true },
    });
    if (latest?.id === log.id) {
      const patch = patchFromLatest(body.disposition as Disposition, new Date());
      const updated = await prisma.business.update({
        where: { id: log.businessId },
        data: {
          status: patch.status,
          nextAction: patch.nextAction,
          nextActionAt: patch.nextActionAt,
          followUpUntil: patch.followUpUntil,
          closedReason: patch.closedReason,
          lastActivityAt: new Date(),
        },
        select: { id: true, status: true },
      });
      return NextResponse.json({ lead: updated });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body?.businessId || (body.action !== "skip" && body.action !== "remove")) {
    return NextResponse.json(
      { error: "businessId and action: 'skip' | 'remove' are required" },
      { status: 400 }
    );
  }

  const lead = await prisma.business.findFirst({
    where: { id: body.businessId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (body.action === "remove") {
    const updated = await prisma.business.update({
      where: { id: lead.id },
      data: { deletedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json({ lead: updated });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const updated = await prisma.business.update({
    where: { id: lead.id },
    data: { status: "QUEUED", nextAction: "Cold call", nextActionAt: tomorrow },
    select: { id: true, status: true, nextAction: true, nextActionAt: true },
  });

  return NextResponse.json({ lead: updated });
}

// DELETE — undo a logged call. Deletes one CallLog (the lead's most recent by
// default, or a specific ?logId), decrements attemptCount, and re-derives the
// lead's scheduling from whatever call now remains — so a misclick fully reverts,
// the lead drops back into the queue, and the "called today" count self-corrects.
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    businessId?: string;
    logId?: string;
  } | null;

  if (!body?.businessId && !body?.logId) {
    return NextResponse.json(
      { error: "businessId or logId is required" },
      { status: 400 }
    );
  }

  // Resolve the target log (scoped to the operator).
  const target = body.logId
    ? await prisma.callLog.findFirst({
        where: { id: body.logId, userId: session.user.id, deletedAt: null },
        select: { id: true, businessId: true },
      })
    : await prisma.callLog.findFirst({
        where: { businessId: body.businessId, userId: session.user.id, deletedAt: null },
        orderBy: { calledAt: "desc" },
        select: { id: true, businessId: true },
      });

  if (!target) {
    return NextResponse.json({ error: "Call log not found" }, { status: 404 });
  }

  const businessId = target.businessId;

  const updated = await prisma.$transaction(async (tx) => {
    // Soft-delete: never hard-delete. Mark the undone log deletedAt; the row stays
    // in the DB and is excluded from the "latest remaining" recompute below.
    await tx.callLog.update({
      where: { id: target.id },
      data: { deletedAt: new Date() },
    });
    const latest = await tx.callLog.findFirst({
      where: { businessId, deletedAt: null },
      orderBy: { calledAt: "desc" },
      select: { disposition: true },
    });
    const patch = patchFromLatest(
      (latest?.disposition as Disposition | undefined) ?? null,
      new Date()
    );
    return tx.business.update({
      where: { id: businessId },
      data: {
        status: patch.status,
        nextAction: patch.nextAction,
        nextActionAt: patch.nextActionAt,
        followUpUntil: patch.followUpUntil,
        closedReason: patch.closedReason,
        // attemptCount tracks number of calls — drop by one, never below zero.
        attemptCount: { decrement: 1 },
        lastActivityAt: new Date(),
      },
      select: { id: true, status: true, attemptCount: true },
    });
  });

  // Guard against a negative count if data had drifted.
  if (updated.attemptCount < 0) {
    await prisma.business.update({
      where: { id: businessId },
      data: { attemptCount: 0 },
    });
  }

  return NextResponse.json({
    lead: { ...updated, attemptCount: Math.max(0, updated.attemptCount) },
  });
}
