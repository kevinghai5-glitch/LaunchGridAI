/** Dial-status API — powers the phone-first exception logger + retry view.
 *
 *  GET  ?q=<name or phone>  → search the operator's businesses (to log an
 *       exception on the one he's on the phone with).
 *       no q                → the retry list: everything currently "dialed",
 *       oldest attempt first (the ones most overdue for a second dial).
 *
 *  POST { businessId, status } → set a dial status. The only statuses this route
 *       accepts are the exceptions the logger offers (not_interested, booked,
 *       do_not_call); "dialed" is set by the CSV export and "fresh" only at
 *       generation, never by hand. do_not_call is irreversible (canSetFromUi).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DIAL_STATUS_META,
  EXCEPTION_DIAL_STATUSES,
  canSetFromUi,
  recordDialStatus,
  type DialStatus,
} from "@/lib/dial-status";

export const dynamic = "force-dynamic";

// Columns the logger needs — small, no snapshot blobs.
const ROW_SELECT = {
  id: true,
  name: true,
  phone: true,
  city: true,
  industry: true,
  dialStatus: true,
  dialStatusAt: true,
  attemptCount: true,
} as const;

// How many "dialed" businesses the retry view shows / how many search hits.
const RETRY_LIMIT = 100;
const SEARCH_LIMIT = 30;
// Cap on the numeric-phone scan (raw phones carry formatting, so a digit query
// can't be a SQL substring match — we normalize in JS over a bounded set).
const PHONE_SCAN_CAP = 1000;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  // No query → the retry list: businesses sitting in "dialed", oldest first so
  // the ones waiting longest for their next attempt surface at the top.
  if (!q) {
    const rows = await prisma.business.findMany({
      where: { userId, deletedAt: null, dialStatus: "dialed" },
      orderBy: { dialStatusAt: "asc" },
      take: RETRY_LIMIT,
      select: ROW_SELECT,
    });
    return NextResponse.json({ mode: "retry", rows: rows.map(serialize) });
  }

  // Search. Name is the primary path (he reads it off his GHL screen). Phone is
  // matched two ways: raw substring (handles typing it as stored) and, when the
  // query is mostly digits, a normalized-digit match over a bounded recent scan.
  const digits = q.replace(/\D/g, "");
  const byField = await prisma.business.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { dialStatusAt: "desc" },
    take: SEARCH_LIMIT,
    select: ROW_SELECT,
  });

  const found = new Map(byField.map((r) => [r.id, r]));
  if (digits.length >= 5 && found.size < SEARCH_LIMIT) {
    const scan = await prisma.business.findMany({
      where: { userId, deletedAt: null, phone: { not: null } },
      orderBy: { lastActivityAt: "desc" },
      take: PHONE_SCAN_CAP,
      select: ROW_SELECT,
    });
    for (const r of scan) {
      if (found.size >= SEARCH_LIMIT) break;
      if ((r.phone ?? "").replace(/\D/g, "").includes(digits)) found.set(r.id, r);
    }
  }

  return NextResponse.json({ mode: "search", rows: Array.from(found.values()).map(serialize) });
}

function serialize(r: {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  industry: string | null;
  dialStatus: string;
  dialStatusAt: Date | null;
  attemptCount: number;
}) {
  return {
    ...r,
    dialStatusAt: r.dialStatusAt?.toISOString() ?? null,
    label: DIAL_STATUS_META[r.dialStatus as DialStatus]?.label ?? r.dialStatus,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => null)) as {
    businessId?: string;
    status?: string;
  } | null;

  if (!body?.businessId || !body.status) {
    return NextResponse.json(
      { error: "businessId and status are required" },
      { status: 400 }
    );
  }
  // This route only ever SETS the three exceptions. fresh/dialed are never set by
  // hand — they come from generation and export respectively.
  if (!EXCEPTION_DIAL_STATUSES.includes(body.status as DialStatus)) {
    return NextResponse.json(
      { error: `This view can only set: ${EXCEPTION_DIAL_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  const target = body.status as DialStatus;

  const business = await prisma.business.findFirst({
    where: { id: body.businessId, userId, deletedAt: null },
    select: { id: true, dialStatus: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // The irreversibility guard: a business already do_not_call cannot be changed
  // from the UI, full stop. 409 so the client can say why rather than silently
  // appearing to succeed.
  const guard = canSetFromUi(business.dialStatus, target);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 409 });
  }

  const at = new Date();
  await prisma.$transaction((tx) =>
    recordDialStatus(tx, { businessId: business.id, userId, status: target, source: "manual", at })
  );

  return NextResponse.json({
    ok: true,
    businessId: business.id,
    dialStatus: target,
    label: DIAL_STATUS_META[target].label,
    dialStatusAt: at.toISOString(),
  });
}
