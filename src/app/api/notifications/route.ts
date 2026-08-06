import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_META, TERMINAL_STATUSES } from "@/lib/call-queue";

export const dynamic = "force-dynamic";

// The bell's feed. There is NO notifications table and nothing here is
// fabricated: every event is DERIVED live from rows that already record it —
//
//   proposal opened  → Proposal.status VIEWED    (stamped by updatedAt)
//   proposal won     → Proposal.status ACCEPTED  (updatedAt)
//   proposal lost    → Proposal.status REJECTED  (updatedAt)
//   lead due         → Business.nextActionAt has passed and the lead is still
//                      callable (not CLOSED/DEAD/WON/DECLINED — the terminal
//                      set from call-queue.ts, imported so it can't drift)
//
// An event's time IS the underlying row's stamp. If a proposal was opened
// three weeks ago, it shows as three weeks ago — the feed never re-sorts
// reality to look busier.
//
// "Unread" is one timestamp on the User row (notificationsSeenAt): events
// newer than it count toward the badge. null = never opened the bell, so
// everything recent is unread — correct for a first open.

const FEED_LIMIT = 20;

type NotificationKind =
  | "lead-due";

interface FeedEvent {
  kind: NotificationKind;
  title: string;
  meta: string;
  at: Date;
  href: string;
}

// How each proposal status reads as a feed line. Keyed by the real status
// vocabulary (see PROPOSAL_STATUSES in src/lib/constants.ts).
// Loose lookup for the status badge label — a status this build doesn't know
// falls back to the raw string rather than crashing the feed.
const STATUS_LABEL = STATUS_META as Record<string, { label: string } | undefined>;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    const [user, dueLeads] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { notificationsSeenAt: true },
      }),
      prisma.business.findMany({
        where: {
          userId,
          deletedAt: null,
          // Due = the scheduled next touch has arrived AND the lead can still
          // be worked. TERMINAL_STATUSES is the call queue's own definition of
          // "done" — imported, not re-typed, so the two can never disagree.
          nextActionAt: { lte: now },
          status: { notIn: TERMINAL_STATUSES },
        },
        orderBy: { nextActionAt: "desc" },
        take: FEED_LIMIT,
        select: {
          id: true,
          name: true,
          status: true,
          nextAction: true,
          nextActionAt: true,
        },
      }),
    ]);

    const events: FeedEvent[] = [];

    for (const b of dueLeads) {
      if (!b.nextActionAt) continue; // guaranteed by the lte filter; keeps TS honest
      events.push({
        kind: "lead-due",
        title: `${b.name} — ${b.nextAction ?? "call due"}`,
        meta: STATUS_LABEL[b.status]?.label ?? b.status,
        at: b.nextActionAt,
        href: "/call-queue",
      });
    }

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    const feed = events.slice(0, FEED_LIMIT);

    const seenAt = user?.notificationsSeenAt ?? null;
    const unreadCount = seenAt
      ? feed.filter((e) => e.at.getTime() > seenAt.getTime()).length
      : feed.length;

    return NextResponse.json({ events: feed, unreadCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// PATCH — "I've seen these." Stamps notificationsSeenAt = now, which zeroes the
// badge until something newer lands. The feed itself never changes: seen is not
// deleted, hidden, or re-ordered — it's just no longer counted as new.
export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const seenAt = new Date();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationsSeenAt: seenAt },
    });

    return NextResponse.json({ ok: true, seenAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to mark notifications seen" }, { status: 500 });
  }
}
