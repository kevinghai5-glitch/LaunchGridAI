// Dial status — the do-not-call / compliance axis for the cold-call campaign.
//
// SEPARATE from LeadStatus (call-queue.ts) on purpose. LeadStatus runs the CRM
// pipeline and only advances when a call outcome is logged in-app. Dialing 10k
// businesses from a GoHighLevel CSV means that never happens — so LeadStatus
// cannot answer "have I dialed this one already?". dialStatus can, because it is
// set WITHOUT in-app logging: exporting a business in a call CSV flips it to
// "dialed" automatically. The generator treats it as the single authority on
// eligibility — only "fresh" businesses are ever served.
//
// Mirrors the project convention (String column + TS union + constants module;
// no native Prisma enum). The pure parts of this file — the union, the sets, the
// guard — carry no Prisma import so they stay trivially unit-testable.

import type { Prisma, PrismaClient } from "@prisma/client";

export type DialStatus =
  | "fresh" // never dialed — the ONLY status the generator serves
  | "dialed" // attempted, no outcome yet (no-answer / VM / gatekeeper). Retryable.
  | "not_interested" // said no. Not hostile, just no.
  | "do_not_call" // asked not to be contacted again. PERMANENT, irreversible in UI.
  | "booked" // booked a Zoom — now also lives in GoHighLevel
  | "disqualified"; // their systems are already tight — a clean disqualify

export const DIAL_STATUSES: DialStatus[] = [
  "fresh",
  "dialed",
  "not_interested",
  "do_not_call",
  "booked",
  "disqualified",
];

// The generator serves ONLY these. Everything else is excluded — not sorted
// lower, excluded. Today that's exactly "fresh"; kept as a set so the gate reads
// as intent rather than a bare equality.
export const GENERATABLE_DIAL_STATUSES: DialStatus[] = ["fresh"];

export function isGeneratable(status: string | null | undefined): boolean {
  return GENERATABLE_DIAL_STATUSES.includes((status ?? "fresh") as DialStatus);
}

// Never resurface, immune to the DECLINED re-approach cooldown, never generated
// again. "dialed" is deliberately NOT here — a no-answer must stay retryable.
export const PERMANENT_DIAL_STATUSES: DialStatus[] = [
  "not_interested",
  "do_not_call",
  "booked",
  "disqualified",
];

export function isPermanent(status: string | null | undefined): boolean {
  return PERMANENT_DIAL_STATUSES.includes((status ?? "fresh") as DialStatus);
}

// The generation-exclusion rule, as one pure predicate shared by the generator
// and its proof so they can never drift. A business's Place resurfaces into a
// FRESH batch ONLY when it is still dialStatus 'fresh' AND is a cooled-down,
// live, pre-dial triage decline. Everything else — every permanent status, every
// already-dialed one, every cleared row — stays excluded. This is what makes
// do_not_call immune to the 90-day DECLINED re-approach cooldown: isGeneratable
// is false for it, so the whole predicate is false, so it is never resurfaced.
export interface ResurfaceInput {
  dialStatus: string | null | undefined;
  status: string | null | undefined;
  declinedAt: Date | null | undefined;
  deletedAt: Date | null | undefined;
}

export function resurfacesIntoFreshBatch(
  b: ResurfaceInput,
  cooldownCutoff: Date
): boolean {
  return (
    isGeneratable(b.dialStatus) &&
    !b.deletedAt &&
    b.status === "DECLINED" &&
    !!b.declinedAt &&
    b.declinedAt < cooldownCutoff
  );
}

// The statuses the phone-first exception logger can SET. Booked is here because
// bookings happen through a GoHighLevel form, not by tapping BOOKED in this app,
// so the operator needs to record it from the same one-tap view as the no's.
export const EXCEPTION_DIAL_STATUSES: DialStatus[] = [
  "not_interested",
  "booked",
  "do_not_call",
];

export type DialTone = "neutral" | "accent" | "success" | "danger" | "muted";

export interface DialStatusDef {
  id: DialStatus;
  label: string;
  tone: DialTone;
  /** One line for the badge tooltip / logger button subtitle. */
  hint: string;
}

export const DIAL_STATUS_META: Record<DialStatus, DialStatusDef> = {
  fresh: { id: "fresh", label: "Fresh", tone: "neutral", hint: "Never dialed" },
  dialed: { id: "dialed", label: "Dialed", tone: "accent", hint: "Attempted — in the retry cadence" },
  not_interested: { id: "not_interested", label: "Not interested", tone: "muted", hint: "Said no" },
  do_not_call: { id: "do_not_call", label: "Do not call", tone: "danger", hint: "Asked not to be contacted — permanent" },
  booked: { id: "booked", label: "Booked", tone: "success", hint: "Booked a Zoom" },
  disqualified: { id: "disqualified", label: "Disqualified", tone: "muted", hint: "Systems already tight" },
};

// ── The one irreversible rule ────────────────────────────────────────────────
// do_not_call has no path back through the UI. Reversing it must require a
// deliberate database edit, because a mis-click here has consequences the
// operator cannot see (a re-dialed person who explicitly asked not to be).
export function canSetFromUi(
  current: string | null | undefined,
  target: DialStatus
): { ok: boolean; reason?: string } {
  const from = (current ?? "fresh") as DialStatus;
  if (from === "do_not_call") {
    return {
      ok: false,
      reason:
        "This business is marked Do Not Call. That is permanent and can only be changed with a direct database edit.",
    };
  }
  if (!DIAL_STATUSES.includes(target)) {
    return { ok: false, reason: `Unknown dial status: ${target}` };
  }
  return { ok: true };
}

// ── The shared writer ────────────────────────────────────────────────────────
// Every dialStatus change goes through here, so the Business row and the
// append-only DialStatusEvent are always written together. Accepts either the
// prisma singleton or a transaction client, so callers that already own a
// transaction (the call-queue disposition handler) keep it atomic.
type DialTx = PrismaClient | Prisma.TransactionClient;

export interface RecordDialStatusArgs {
  businessId: string;
  userId: string;
  status: DialStatus;
  source: "generate" | "export" | "manual" | "booking";
  at?: Date;
}

export async function recordDialStatus(
  tx: DialTx,
  { businessId, userId, status, source, at = new Date() }: RecordDialStatusArgs
): Promise<void> {
  await tx.business.update({
    where: { id: businessId },
    data: { dialStatus: status, dialStatusAt: at },
  });
  await tx.dialStatusEvent.create({
    data: { businessId, userId, status, source, createdAt: at },
  });
}

// Bulk variant for the CSV export, which flips a whole batch to "dialed" at once.
// One updateMany + one createMany instead of N round-trips. Caller passes ONLY
// the ids it is allowed to mark (permanent statuses must be filtered out first —
// re-exporting a booked lead must not demote it to dialed).
export async function recordDialStatusBulk(
  tx: DialTx,
  {
    businessIds,
    userId,
    status,
    source,
    at = new Date(),
  }: { businessIds: string[]; userId: string; status: DialStatus; source: RecordDialStatusArgs["source"]; at?: Date }
): Promise<void> {
  if (businessIds.length === 0) return;
  await tx.business.updateMany({
    where: { id: { in: businessIds }, userId },
    data: { dialStatus: status, dialStatusAt: at },
  });
  await tx.dialStatusEvent.createMany({
    data: businessIds.map((businessId) => ({ businessId, userId, status, source, createdAt: at })),
  });
}
