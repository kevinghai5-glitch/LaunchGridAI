// Shared Call Queue selection — fetch → filter → sort → cap.
//
// This exists so the CSV export and the on-screen queue are the SAME list by
// construction. They were briefly two copies of this logic, which is a bug
// waiting to happen: the operator exports a file for the power dialer, dials it
// all day, and never finds out it held a different set of leads than the screen
// he approved from. One function, two callers, no drift.

import { prisma } from "@/lib/prisma";
import { compareQueue, isInQueue, QUEUE_LIMIT } from "@/lib/call-queue";

// Which slice of the queue to return:
//   today    — due now (the callable list): default.
//   upcoming — future scheduled (callbacks/Zooms/follow-ups not yet due).
//   past     — already-called leads, most-recent first (the activity log).
export type QueueView = "today" | "upcoming" | "past";

export interface QueueQuery {
  view: QueueView;
  dayStart: Date | null;
  dayEnd: Date | null;
  /** The YYYY-MM-DD the caller asked for, or today's when unscoped. */
  dateKey: string;
}

/** Local-time YYYY-MM-DD. Never toISOString() — that would shift the day in any
 *  timezone behind UTC, so an evening export would be filed under tomorrow. */
export function dateKeyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Resolve ?view and ?date into a concrete query. An explicit ?view wins;
 * otherwise a ?date derives it from the day's relation to today; default is
 * today's live queue.
 */
export function parseQueueParams(
  params: URLSearchParams,
  now: Date = new Date()
): QueueQuery {
  const viewParam = params.get("view");
  const dateParam = params.get("date");

  let dayStart: Date | null = null;
  let dayEnd: Date | null = null;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  let view: QueueView;
  if (viewParam === "upcoming" || viewParam === "past" || viewParam === "today") {
    view = viewParam;
  } else if (dayStart) {
    if (dayStart.getTime() < startOfToday.getTime()) view = "past";
    else if (dayStart.getTime() > startOfToday.getTime()) view = "upcoming";
    else view = "today";
  } else {
    view = "today";
  }

  return { view, dayStart, dayEnd, dateKey: dayStart ? dateKeyOf(dayStart) : dateKeyOf(now) };
}

/**
 * The operator's leads for this query, filtered/sorted/capped. Mirrors
 * /api/assets/library: the DB read is scoped to the user and the shaping is done
 * in JS, because queue membership depends on comparing several nullable dates
 * against "now" and reads far clearer here than as SQL.
 */
export async function selectQueueLeads(
  userId: string,
  q: QueueQuery,
  now: Date = new Date()
) {
  const businesses = await prisma.business.findMany({
    where: { userId, deletedAt: null },
    include: {
      callLogs: {
        where: { deletedAt: null },
        orderBy: { calledAt: "desc" },
        take: q.dayStart && q.view === "past" ? 20 : 1,
        select: { id: true, disposition: true, note: true, calledAt: true },
      },
    },
  });

  const inDay = (d: Date | null | undefined): boolean =>
    !!d &&
    !!q.dayStart &&
    !!q.dayEnd &&
    d.getTime() >= q.dayStart.getTime() &&
    d.getTime() <= q.dayEnd.getTime();

  const filtered = businesses.filter((b) => {
    const core = {
      status: b.status,
      nextActionAt: b.nextActionAt,
      followUpUntil: b.followUpUntil,
    };
    if (q.view === "upcoming") {
      // Scheduled ahead but not yet due, and not terminal.
      if (q.dayStart) {
        // Day-scoped: items whose next touch lands on that specific day.
        return inDay(b.nextActionAt) || inDay(b.followUpUntil);
      }
      if (isInQueue(core, now)) return false;
      const due = b.nextActionAt ?? b.followUpUntil;
      return Boolean(due && due.getTime() > now.getTime());
    }
    if (q.view === "past") {
      // Day-scoped: called on that specific day. Otherwise: ever called.
      if (q.dayStart) return b.callLogs.some((c) => inDay(c.calledAt));
      return b.callLogs.length > 0;
    }
    return isInQueue(core, now);
  });

  const sorted =
    q.view === "past"
      ? filtered.sort(
          (a, b) =>
            (b.callLogs[0]?.calledAt.getTime() ?? 0) -
            (a.callLogs[0]?.calledAt.getTime() ?? 0)
        )
      : q.view === "upcoming"
        ? filtered.sort((a, b) => {
            const da = (a.nextActionAt ?? a.followUpUntil)?.getTime() ?? Infinity;
            const db = (b.nextActionAt ?? b.followUpUntil)?.getTime() ?? Infinity;
            return da - db;
          })
        : filtered.sort((a, b) =>
            compareQueue(
              {
                status: a.status,
                nextActionAt: a.nextActionAt,
                followUpUntil: a.followUpUntil,
              },
              {
                status: b.status,
                nextActionAt: b.nextActionAt,
                followUpUntil: b.followUpUntil,
              },
              now
            )
          );

  return sorted.slice(0, QUEUE_LIMIT);
}
