// Daily Call Queue configuration — the single source of truth for lead statuses,
// call dispositions, and the deterministic disposition→next-action mapping.
//
// Mirrors the project convention in src/lib/stages.ts: String DB columns + TS union
// types + a constants module (NOT native Prisma enums). Values are hard-coded and
// non-configurable on purpose — the whole point is a fast, opinionated call flow.

// ---------------------------------------------------------------------------
// Status / disposition / reason vocabularies (stored as Strings on the row)
// ---------------------------------------------------------------------------

export type LeadStatus =
  | "SUGGESTED" // auto-sourced, awaiting approve/decline (not yet in the call queue)
  | "DECLINED" // rejected from a daily batch (resurfaces after a window)
  | "QUEUED"
  | "CALLED"
  | "NO_ANSWER"
  | "CALLBACK"
  | "BOOKED_ZOOM"
  | "ZOOM_NO_SHOW" // booked a Zoom but didn't show — needs a rebook / GHL no-show recovery
  | "ZOOM_OPEN" // showed to the Zoom, proposal presented live, no close yet — recovery in progress
  | "WAITING"
  | "PROPOSAL" // proposal sent — in the closing half of the pipeline
  | "WON"
  | "CLOSED"
  | "DEAD";

export type Disposition =
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "BUSY"
  | "GATEKEEPER"
  | "CALLBACK"
  | "INTERESTED"
  | "BOOKED"
  | "NOT_INTERESTED"
  | "WRONG_NUMBER";

export type ClosedReason =
  | "PRICE"
  | "NO_PAIN"
  | "NO_BUDGET"
  | "COMPETITOR"
  | "UNRESPONSIVE"
  | "WON";

// Statuses that take a lead out of the queue permanently.
export const TERMINAL_STATUSES: LeadStatus[] = ["CLOSED", "DEAD", "WON", "DECLINED"];

// ---------------------------------------------------------------------------
// Status display metadata (badges)
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "accent" | "success" | "danger" | "muted";

export interface StatusDef {
  id: LeadStatus;
  label: string;
  tone: Tone;
}

export const STATUS_META: Record<LeadStatus, StatusDef> = {
  SUGGESTED: { id: "SUGGESTED", label: "Suggested", tone: "muted" },
  DECLINED: { id: "DECLINED", label: "Declined", tone: "muted" },
  QUEUED: { id: "QUEUED", label: "Queued", tone: "neutral" },
  CALLED: { id: "CALLED", label: "Called", tone: "neutral" },
  NO_ANSWER: { id: "NO_ANSWER", label: "No answer", tone: "neutral" },
  CALLBACK: { id: "CALLBACK", label: "Callback", tone: "accent" },
  BOOKED_ZOOM: { id: "BOOKED_ZOOM", label: "Booked Zoom", tone: "success" },
  ZOOM_NO_SHOW: { id: "ZOOM_NO_SHOW", label: "No-show", tone: "danger" },
  ZOOM_OPEN: { id: "ZOOM_OPEN", label: "Deciding", tone: "accent" },
  WAITING: { id: "WAITING", label: "Waiting", tone: "accent" },
  PROPOSAL: { id: "PROPOSAL", label: "Proposal sent", tone: "accent" },
  WON: { id: "WON", label: "Won", tone: "success" },
  CLOSED: { id: "CLOSED", label: "Closed", tone: "success" },
  DEAD: { id: "DEAD", label: "Dead", tone: "muted" },
};

// ---------------------------------------------------------------------------
// Quick dispositions — the number-key UX (1..6) shown on the active row.
// ---------------------------------------------------------------------------

export interface QuickDisposition {
  key: string;
  id: Disposition;
  label: string;
  /** When true, the rep must supply a time before this can be submitted. */
  needsTime?: boolean;
}

export const QUICK_DISPOSITIONS: QuickDisposition[] = [
  { key: "1", id: "NO_ANSWER", label: "No answer" },
  { key: "2", id: "VOICEMAIL", label: "Voicemail" },
  { key: "3", id: "CALLBACK", label: "Callback", needsTime: true },
  { key: "4", id: "INTERESTED", label: "Interested" },
  { key: "5", id: "BOOKED", label: "Booked Zoom", needsTime: true },
  { key: "6", id: "NOT_INTERESTED", label: "Not interested" },
];

// Secondary dispositions (no number key) available from the row's overflow.
export const SECONDARY_DISPOSITIONS: QuickDisposition[] = [
  { key: "", id: "BUSY", label: "Busy" },
  { key: "", id: "GATEKEEPER", label: "Gatekeeper" },
  { key: "", id: "WRONG_NUMBER", label: "Wrong number" },
];

// ---------------------------------------------------------------------------
// Disposition → next-action resolution (the deterministic rule, in code)
// ---------------------------------------------------------------------------

export interface DispositionPatch {
  status: LeadStatus;
  nextAction: string | null;
  nextActionAt: Date | null;
  followUpUntil: Date | null;
  closedReason: ClosedReason | null;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Given a disposition (and, for time-based ones, a caller-supplied time), returns
 * the patch to apply to the lead. Pure — no DB access, no side effects. The API
 * route applies this inside a single transaction alongside the CallLog insert.
 */
export function resolveDisposition(
  d: Disposition,
  opts?: { callbackTime?: Date | null; now?: Date; closedReason?: ClosedReason | null }
): DispositionPatch {
  const now = opts?.now ?? new Date();
  const callbackTime = opts?.callbackTime ?? null;

  switch (d) {
    case "NO_ANSWER":
    case "BUSY":
      return {
        status: "NO_ANSWER",
        nextAction: "Retry call",
        nextActionAt: addDays(now, 1),
        followUpUntil: null,
        closedReason: null,
      };
    case "VOICEMAIL":
      return {
        status: "NO_ANSWER",
        nextAction: "Retry call",
        nextActionAt: addDays(now, 3),
        followUpUntil: null,
        closedReason: null,
      };
    case "GATEKEEPER":
      return {
        status: "NO_ANSWER",
        nextAction: "Get past gatekeeper",
        nextActionAt: addDays(now, 1),
        followUpUntil: null,
        closedReason: null,
      };
    case "CALLBACK":
      return {
        status: "CALLBACK",
        nextAction: "Call back",
        // Fall back to +1d if no time was supplied so it never loses its place.
        nextActionAt: callbackTime ?? addDays(now, 1),
        followUpUntil: null,
        closedReason: null,
      };
    case "INTERESTED":
      // Send the audit today, then resurface in 2 days to follow up.
      return {
        status: "WAITING",
        nextAction: "Send audit, follow up",
        nextActionAt: addDays(now, 2),
        followUpUntil: addDays(now, 2),
        closedReason: null,
      };
    case "BOOKED":
      return {
        status: "BOOKED_ZOOM",
        nextAction: "Run Zoom",
        nextActionAt: callbackTime ?? addDays(now, 1),
        followUpUntil: null,
        closedReason: null,
      };
    case "NOT_INTERESTED":
      return {
        status: "DEAD",
        nextAction: null,
        nextActionAt: null,
        followUpUntil: null,
        closedReason: opts?.closedReason ?? "NO_PAIN",
      };
    case "WRONG_NUMBER":
      return {
        status: "DEAD",
        nextAction: null,
        nextActionAt: null,
        followUpUntil: null,
        closedReason: "UNRESPONSIVE",
      };
  }
}

// ---------------------------------------------------------------------------
// Zoom outcome → next-action resolution (the deterministic rule, in code)
// ---------------------------------------------------------------------------
//
// After the "On the Zoom" runner (Diagnose → Pivot → Proposal), the rep records
// one outcome. Mirrors resolveDisposition: a pure function returning the patch
// the API applies. This is the seam that lets the CRM measure zoom conversion
// and hand each state to the right GHL follow-up sequence.

export type ZoomOutcome =
  | "CLOSED" // they said yes on the call → won
  | "OPEN" // showed, proposal presented, still deciding → post-zoom recovery
  | "NO_SHOW" // booked but didn't join → rebook / no-show recovery
  | "LOST"; // hard no on the call

/**
 * Given a Zoom outcome, returns the patch to apply to the lead. Pure — no DB
 * access, no side effects. The API route applies it inside a scoped update.
 */
export function resolveZoomOutcome(
  o: ZoomOutcome,
  opts?: { now?: Date }
): DispositionPatch {
  const now = opts?.now ?? new Date();
  switch (o) {
    case "CLOSED":
      return {
        status: "WON",
        nextAction: "Send Stripe link + intake form",
        nextActionAt: null,
        followUpUntil: null,
        closedReason: "WON",
      };
    case "OPEN":
      // Proposal is live in front of them — recap today, resurface in 2 days.
      return {
        status: "ZOOM_OPEN",
        nextAction: "Send recap + proposal link, follow up",
        nextActionAt: addDays(now, 2),
        followUpUntil: addDays(now, 2),
        closedReason: null,
      };
    case "NO_SHOW":
      return {
        status: "ZOOM_NO_SHOW",
        nextAction: "Rebook the Zoom",
        nextActionAt: addDays(now, 1),
        followUpUntil: null,
        closedReason: null,
      };
    case "LOST":
      return {
        status: "DEAD",
        nextAction: null,
        nextActionAt: null,
        followUpUntil: null,
        closedReason: "NO_PAIN",
      };
  }
}

// ---------------------------------------------------------------------------
// Queue membership, ordering & urgency
// ---------------------------------------------------------------------------

export interface QueueLeadCore {
  status: string;
  nextActionAt: Date | null;
  followUpUntil: Date | null;
}

/**
 * Whether a lead belongs in today's queue:
 *  - not terminal (CLOSED / DEAD), AND
 *  - NOT deferred to a future day (a scheduled nextActionAt in the future — e.g. a
 *    lead skipped to tomorrow — waits there, even if still QUEUED), AND
 *  - fresh (QUEUED), OR its next action is due, OR its WAITING resurface has passed.
 * WAITING leads with a future followUpUntil are hidden until they come due.
 */
export function isInQueue(lead: QueueLeadCore, now: Date = new Date()): boolean {
  if (TERMINAL_STATUSES.includes(lead.status as LeadStatus)) return false;
  // Deferred ahead: a future next touch means it lives on that future day, not
  // today — so a skipped/QUEUED lead leaves today's list and resurfaces then.
  if (lead.nextActionAt && lead.nextActionAt.getTime() > now.getTime()) return false;
  if (lead.status === "QUEUED") return true;
  if (lead.nextActionAt && lead.nextActionAt.getTime() <= now.getTime()) return true;
  if (lead.followUpUntil && lead.followUpUntil.getTime() <= now.getTime()) return true;
  return false;
}

export type Urgency = "overdue" | "due" | "booked" | "dead" | "queued";

/**
 * Visual urgency bucket for color-coding a row. "due" = due today; "overdue" =
 * its due time has already passed (before today). Booked Zooms get their own
 * (green) treatment; terminal leads render muted.
 */
export function urgency(lead: QueueLeadCore, now: Date = new Date()): Urgency {
  if (TERMINAL_STATUSES.includes(lead.status as LeadStatus)) return "dead";
  if (lead.status === "BOOKED_ZOOM") return "booked";

  const due = lead.nextActionAt ?? lead.followUpUntil;
  if (due) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    if (due.getTime() < startOfToday.getTime()) return "overdue";
    if (due.getTime() <= now.getTime()) return "due";
  }
  return "queued";
}

// Sort weight: overdue first, then due, then queued; booked/dead sink. Lower = higher.
const URGENCY_WEIGHT: Record<Urgency, number> = {
  overdue: 0,
  due: 1,
  queued: 2,
  booked: 3,
  dead: 4,
};

/**
 * Comparator for the queue: urgency bucket first, then earliest due time
 * (nulls last). WAITING leads that just came due bubble to the top.
 */
export function compareQueue(
  a: QueueLeadCore,
  b: QueueLeadCore,
  now: Date = new Date()
): number {
  const wa = URGENCY_WEIGHT[urgency(a, now)];
  const wb = URGENCY_WEIGHT[urgency(b, now)];
  if (wa !== wb) return wa - wb;

  const da = (a.nextActionAt ?? a.followUpUntil)?.getTime() ?? Infinity;
  const db = (b.nextActionAt ?? b.followUpUntil)?.getTime() ?? Infinity;
  return da - db;
}

// Max leads surfaced in a day — keeps the list to a callable size.
export const QUEUE_LIMIT = 30;
