"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  Star,
  Gauge,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  PhoneCall,
  X,
  SkipForward,
  UserRound,
  MapPin,
  Globe,
  ExternalLink,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { DateNav, isSameDay, startOfDay } from "@/components/dashboard/DateNav";
import {
  QUICK_DISPOSITIONS,
  SECONDARY_DISPOSITIONS,
  STATUS_META,
  QUEUE_LIMIT,
  type Disposition,
  type LeadStatus,
  type Urgency,
} from "@/lib/call-queue";
import { ObservedFactsRow } from "@/components/businesses/ObservedFactsRow";
// Type-only: the route computes the four values server-side and ships the small
// object; importing VALUES from the lib here would drag the detection layer into
// the client bundle (see ObservedFactsRow.tsx).
import type { ObservedFacts } from "@/lib/observed-facts";

// Row shape returned by GET /api/call-queue (dates are ISO strings).
interface QueueLead {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  industry: string | null;
  status: string;
  nextAction: string | null;
  nextActionAt: string | null;
  followUpUntil: string | null;
  attemptCount: number;
  urgency: Urgency;
  /** The four measured pre-dial values, computed server-side by the route.
   *  Replaced the cold-audit peek (owner ruling, 2026-08-01). */
  observedFacts: ObservedFacts;
  enrichment: {
    rating: number | null;
    reviewCount: number | null;
    mapsUrl: string | null;
    painPoint: string | null;
    outreachAngle: string | null;
    ownerName: string | null;
  };
  lastCall: { id: string; disposition: string; note: string | null; calledAt: string } | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const NEEDS_TIME = new Set<Disposition>(
  QUICK_DISPOSITIONS.filter((d) => d.needsTime).map((d) => d.id)
);

function urgencyColor(u: Urgency): string {
  switch (u) {
    case "overdue":
      return "var(--danger)";
    case "due":
      return "var(--warn)";
    case "booked":
      return "var(--money)";
    case "dead":
      return "var(--text-4)";
    default:
      return "var(--line-strong)";
  }
}

function relativeDue(iso: string | null): string {
  if (!iso) return "";
  const due = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - startOfToday.getTime()) / dayMs);
  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` ${time}`;
}

function toneColor(tone: string): { fg: string; bg: string } {
  switch (tone) {
    case "success":
      return { fg: "var(--money)", bg: "var(--money-soft)" };
    case "accent":
      return { fg: "var(--accent)", bg: "var(--accent-soft)" };
    case "danger":
      return { fg: "var(--danger)", bg: "var(--danger-soft)" };
    // muted and default keep two different surface steps as well as two
    // different inks, so the pair stays as distinguishable as it was.
    case "muted":
      return { fg: "var(--text-4)", bg: "var(--surface-2)" };
    default:
      return { fg: "var(--text-3)", bg: "var(--surface-hi)" };
  }
}

// ── page ────────────────────────────────────────────────────────────────────

// Format a Date as YYYY-MM-DD in local time (for the ?date= API param).
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CallQueuePage() {
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [calledToday, setCalledToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [activeIndex, setActiveIndex] = useState(0);
  // Lead whose detail popup is open (click a row's name to open it). Null = closed.
  const [detail, setDetail] = useState<QueueLead | null>(null);
  const [note, setNote] = useState("");
  const [armed, setArmed] = useState<Disposition | null>(null);
  const [callbackTime, setCallbackTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const noteRef = useRef<HTMLTextAreaElement>(null);

  // The selected day's relation to today decides the slice + interactivity.
  const today = new Date();
  const isToday = isSameDay(selectedDate, today);
  const isPast = startOfDay(selectedDate).getTime() < startOfDay(today).getTime();
  const view: "today" | "upcoming" | "past" = isToday ? "today" : isPast ? "past" : "upcoming";

  const dateKey = ymd(selectedDate);

  // Fetch the selected day's slice. Returns a cancel flag so the mount effect can
  // ignore stale responses; also callable on demand (e.g. after an undo) to resync.
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/call-queue?date=${dateKey}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as { leads: QueueLead[]; calledToday?: number };
        setLeads(data.leads ?? []);
        setCalledToday(data.calledToday ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [dateKey]
  );

  useEffect(() => {
    setActiveIndex(0);
    load();
  }, [load]);

  const activeLead = leads[activeIndex] ?? null;

  // Reset the per-lead input state and focus the note whenever the active lead
  // changes. In history view, prefill the note with the logged call's note so it
  // can be edited rather than retyped.
  useEffect(() => {
    setNote(isPast && activeLead?.lastCall?.note ? activeLead.lastCall.note : "");
    setArmed(null);
    setCallbackTime("");
    setExpanded(false);
    noteRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLead?.id]);

  // Undo a logged call: deletes the last CallLog server-side (reverts status +
  // attemptCount + the "called today" count) and resyncs. Wired to the Undo toast.
  const undo = useCallback(
    async (businessId: string) => {
      try {
        const res = await fetch("/api/call-queue", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId }),
        });
        if (!res.ok) {
          toast.error("Couldn't undo");
          return;
        }
        toast.success("Call reverted");
        await load({ silent: true });
      } catch {
        toast.error("Couldn't undo");
      }
    },
    [load]
  );

  const submit = useCallback(
    async (d: Disposition, time?: string) => {
      if (!activeLead || submitting) return;
      setSubmitting(true);
      const targetId = activeLead.id;
      try {
        const res = await fetch("/api/call-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: targetId,
            disposition: d,
            note: note.trim() || undefined,
            callbackTime: time || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to log call");
          return;
        }
        // Dispositioned leads leave today's queue → remove and auto-advance.
        setLeads((prev) => prev.filter((l) => l.id !== targetId));
        setActiveIndex((i) => (i >= leads.length - 1 ? Math.max(0, leads.length - 2) : i));
        toast.success(`Logged: ${d.replace(/_/g, " ").toLowerCase()}`, {
          action: { label: "Undo", onClick: () => undo(targetId) },
        });
      } catch {
        toast.error("Failed to log call");
      } finally {
        setSubmitting(false);
      }
    },
    [activeLead, submitting, note, leads.length, undo]
  );

  // History view: re-pick a disposition to CHANGE the logged call in place (edits
  // the CallLog row, re-advances the lead) — the spreadsheet-style "redo".
  const editDisposition = useCallback(
    async (logId: string, d: Disposition) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/call-queue", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "editLog",
            logId,
            disposition: d,
            note: note.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to update");
          return;
        }
        toast.success(`Updated: ${d.replace(/_/g, " ").toLowerCase()}`);
        await load({ silent: true });
      } catch {
        toast.error("Failed to update");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, note, load]
  );

  // Remove a company from the call queue WITHOUT destroying it. SOFT-DELETES the
  // lead (deletedAt), so it disappears from EVERY view — today's queue, past/date
  // history, the CRM board, Opportunities and Saved — while the row + call history
  // stay in the DB (recoverable, never hard-deleted). It does not reappear anywhere
  // or fall backward into New Leads / Lost. Non-destructive, so no scary confirm.
  const removeLead = useCallback(
    async (id: string) => {
      const before = leads;
      const idx = leads.findIndex((l) => l.id === id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setActiveIndex((i) => (idx <= i && i > 0 ? i - 1 : i));
      try {
        const res = await fetch("/api/call-queue", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: id, action: "remove" }),
        });
        if (!res.ok) {
          setLeads(before);
          toast.error("Failed to remove");
          return;
        }
        toast.success("Removed everywhere");
      } catch {
        setLeads(before);
        toast.error("Failed to remove");
      }
    },
    [leads]
  );

  // Skip a lead WITHOUT logging a call — defers it to tomorrow. Optimistically
  // removes it and auto-advances, mirroring the disposition flow.
  const skip = useCallback(
    async (id: string) => {
      if (submitting) return;
      const before = leads;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setActiveIndex((i) => (i >= leads.length - 1 ? Math.max(0, leads.length - 2) : i));
      try {
        const res = await fetch("/api/call-queue", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: id, action: "skip" }),
        });
        if (!res.ok) {
          setLeads(before);
          toast.error("Failed to skip");
          return;
        }
        toast.success("Skipped to tomorrow");
      } catch {
        setLeads(before);
        toast.error("Failed to skip");
      }
    },
    [leads, submitting]
  );

  // Fire a quick disposition. In history view, re-picking edits the existing call
  // in place (no time picker). Otherwise: time-based ones arm the picker, the rest
  // log immediately.
  const fire = useCallback(
    (d: Disposition) => {
      if (isPast && activeLead?.lastCall) {
        editDisposition(activeLead.lastCall.id, d);
        return;
      }
      if (NEEDS_TIME.has(d)) {
        setArmed(d);
        return;
      }
      submit(d);
    },
    [submit, editDisposition, isPast, activeLead]
  );

  const confirmArmed = useCallback(() => {
    if (!armed) return;
    if (NEEDS_TIME.has(armed) && !callbackTime) {
      toast.error("Pick a time first");
      return;
    }
    submit(armed, callbackTime || undefined);
  }, [armed, callbackTime, submit]);

  // Global keyboard: digits 1–6 disposition when not typing in the note; the note's
  // own handler covers the empty-note fast path + Cmd/Ctrl+Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeLead || submitting) return;
      const target = e.target as HTMLElement | null;
      const inNote = target === noteRef.current;
      const inField =
        target?.tagName === "INPUT" ||
        (target?.tagName === "TEXTAREA" && !inNote);
      if (inField) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (armed) confirmArmed();
        return;
      }
      // "s" skips the active lead to tomorrow (today's list only), when not mid-note.
      if ((e.key === "s" || e.key === "S") && isToday && !(inNote && note.length > 0)) {
        e.preventDefault();
        skip(activeLead.id);
        return;
      }
      const hit = QUICK_DISPOSITIONS.find((q) => q.key === e.key);
      if (hit) {
        // In the note, only intercept a digit when the note is empty.
        if (inNote && note.length > 0) return;
        e.preventDefault();
        fire(hit.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeLead, submitting, note, armed, fire, confirmArmed, skip, isToday]);

  // When the detail popup resolves an owner name, cache it back onto the row so
  // the "Ask for …" line also shows in the list (and stays if the modal reopens).
  const setOwnerForLead = useCallback((id: string, ownerName: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, enrichment: { ...l.enrichment, ownerName } } : l
      )
    );
    setDetail((d) => (d && d.id === id ? { ...d, enrichment: { ...d.enrichment, ownerName } } : d));
  }, []);

  const dueCount = useMemo(
    () => leads.filter((l) => l.urgency === "overdue" || l.urgency === "due").length,
    [leads]
  );

  return (
    <>
      <TopBar title="Call Queue" subtitle="Who to call right now" />
      <div style={{ width: "100%", padding: "40px 56px 80px", maxWidth: 1080, margin: "0 auto" }}>
        {/* header */}
        <div className="rise" style={{ marginBottom: 18 }}>
          <h1
            className="lg-display"
            style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.032em", color: "var(--text)" }}
          >
            {view === "today" ? "Today's call list" : view === "upcoming" ? "Scheduled ahead" : "Call history"}
          </h1>
          <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-3)" }}>
            {loading
              ? "Loading…"
              : view === "today"
                ? `${leads.length} lead${leads.length === 1 ? "" : "s"} queued · ${dueCount} due now`
                : view === "upcoming"
                  ? `${leads.length} follow-up${leads.length === 1 ? "" : "s"} scheduled`
                  : `${leads.length} recently called`}
          </p>
        </div>

        {/* date navigator + today's burn-down ring */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: 14, marginBottom: 18, justifyContent: "space-between" }}
        >
          <DateNav date={selectedDate} onChange={setSelectedDate} />
          {isToday && <ProgressRing done={calledToday} total={QUEUE_LIMIT} />}
        </div>

        {/* legend */}
        {!loading && leads.length > 0 && (
          <div
            className="flex flex-wrap items-center"
            style={{ gap: 14, marginBottom: 16, fontSize: 11.5, color: "var(--text-subtle)" }}
          >
            <Legend color={urgencyColor("overdue")} label="Overdue" />
            <Legend color={urgencyColor("due")} label="Due now" />
            <Legend color={urgencyColor("booked")} label="Booked" />
            <Legend color={urgencyColor("queued")} label="Queued" />
            <span style={{ marginLeft: "auto" }}>
              {isPast ? (
                <>
                  Press <Kbd>1</Kbd>–<Kbd>6</Kbd> to change a logged call
                </>
              ) : (
                <>
                  Press <Kbd>1</Kbd>–<Kbd>6</Kbd> to log · <Kbd>s</Kbd> to skip · <Kbd>⌘↵</Kbd> to confirm
                </>
              )}
            </span>
          </div>
        )}

        {error && (
          <div className="panel p-5 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {!loading && !error && leads.length === 0 && (
          <div
            className="panel"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <PhoneCall
              size={26}
              strokeWidth={1.6}
              style={{ color: "var(--text-4)", margin: "0 auto 12px" }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {view === "today" ? "Queue clear" : view === "upcoming" ? "Nothing scheduled" : "No calls yet"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
              {view === "today"
                ? "Nothing due right now. Save more businesses or check back when follow-ups resurface."
                : view === "upcoming"
                  ? "No future callbacks or Zooms booked. Schedule one from today's list."
                  : "Logged calls will appear here as you work the queue."}
            </div>
          </div>
        )}

        {/* rows */}
        <div className="flex flex-col" style={{ gap: 8 }}>
          {leads.map((lead, i) => {
            const active = i === activeIndex;
            const dead = lead.urgency === "dead";
            const border = urgencyColor(lead.urgency);
            const status = STATUS_META[lead.status as LeadStatus];
            const st = status ? toneColor(status.tone) : toneColor("neutral");
            return (
              <div
                key={lead.id}
                onClick={() => !active && setActiveIndex(i)}
                style={{
                  borderRadius: "var(--radius)",
                  border: `1px solid ${active ? "var(--line-strong)" : "var(--line)"}`,
                  borderLeft: `3px solid ${border}`,
                  background: active ? "var(--surface-2)" : "var(--surface)",
                  padding: active ? "14px 16px" : "11px 16px",
                  cursor: active ? "default" : "pointer",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                  transition: "background var(--t), border-color var(--t)",
                }}
              >
                {/* one-line summary */}
                <div className="flex items-center" style={{ gap: 12 }}>
                  <span
                    className="lg-mono tnum"
                    style={{ fontSize: 11, color: "var(--text-4)", width: 18, flex: "none" }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(lead);
                      }}
                      title="View details"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: dead ? "var(--text-4)" : "var(--text)",
                        textDecoration: dead ? "line-through" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: "pointer",
                        width: "fit-content",
                        maxWidth: "100%",
                      }}
                    >
                      {lead.name}
                    </div>
                    <div
                      className="flex items-center"
                      style={{ gap: 10, marginTop: 2, fontSize: 11.5, color: "var(--text-3)" }}
                    >
                      {lead.phone && (
                        <span className="flex items-center" style={{ gap: 4 }}>
                          <Phone size={11} strokeWidth={1.9} /> {lead.phone}
                        </span>
                      )}
                      {lead.enrichment.ownerName && (
                        <span
                          className="flex items-center"
                          style={{ gap: 4, color: "var(--accent)", fontWeight: 500 }}
                          title="Owner / decision-maker — ask for them to get past the gatekeeper"
                        >
                          <UserRound size={11} strokeWidth={1.9} /> Ask for {lead.enrichment.ownerName}
                        </span>
                      )}
                      {lead.city && <span>{lead.city}</span>}
                      {lead.enrichment.rating != null && (
                        <span className="flex items-center" style={{ gap: 3 }}>
                          <Star size={11} strokeWidth={1.9} style={{ color: "var(--warn)" }} />
                          {lead.enrichment.rating}
                          {lead.enrichment.reviewCount != null && (
                            <span style={{ color: "var(--text-4)" }}> ({lead.enrichment.reviewCount})</span>
                          )}
                        </span>
                      )}
                      {lead.observedFacts.mobileSpeed.score != null && (
                        <span className="flex items-center" style={{ gap: 3 }}>
                          <Gauge size={11} strokeWidth={1.9} /> {lead.observedFacts.mobileSpeed.score}
                        </span>
                      )}
                      {lead.attemptCount > 0 && (
                        <span style={{ color: "var(--text-4)" }}>
                          {lead.attemptCount} attempt{lead.attemptCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* status + due */}
                  <div className="flex items-center" style={{ gap: 10, flex: "none" }}>
                    {lead.nextActionAt && (
                      <span
                        className="lg-mono"
                        style={{
                          fontSize: 11,
                          color: lead.urgency === "overdue" ? border : "var(--text-3)",
                        }}
                      >
                        {relativeDue(lead.nextActionAt)}
                      </span>
                    )}
                    {status && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 999,
                          color: st.fg,
                          background: st.bg,
                        }}
                      >
                        {status.label}
                      </span>
                    )}
                    {active && isToday && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          skip(lead.id);
                        }}
                        aria-label="Skip to tomorrow"
                        title="Skip to tomorrow (s)"
                        className="grid place-items-center"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: "transparent",
                          border: "1px solid var(--line)",
                          color: "var(--text-4)",
                          cursor: "pointer",
                          flex: "none",
                        }}
                      >
                        <SkipForward size={13} strokeWidth={1.7} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLead(lead.id);
                      }}
                      aria-label="Remove from queue"
                      title="Remove from queue (stays saved)"
                      className="grid place-items-center"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid var(--line)",
                        color: "var(--text-4)",
                        cursor: "pointer",
                        flex: "none",
                      }}
                    >
                      <X size={13} strokeWidth={1.7} />
                    </button>
                  </div>
                </div>

                {/* active controls */}
                {active && (
                  <div style={{ marginTop: 12 }}>
                    {/* The four measured pre-dial values — the cold-audit peek's
                        replacement (owner ruling, 2026-08-01). "—" means "we
                        could not see", which is a different fact from "nothing
                        is wrong", and it stays different on screen. */}
                    <div style={{ marginBottom: 12 }}>
                      <ObservedFactsRow facts={lead.observedFacts} />
                    </div>
                    {/* talking-point peek — AI outreach suggestions + last call */}
                    {(lead.enrichment.painPoint ||
                      lead.enrichment.outreachAngle ||
                      lead.lastCall) && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--surface-2)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <button
                          onClick={() => setExpanded((v) => !v)}
                          className="flex items-center w-full text-left"
                          style={{
                            gap: 6,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-2)",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <AlertTriangle size={12} strokeWidth={2} style={{ color: "var(--warn)" }} />
                          <span style={{ flex: 1 }}>
                            {lead.enrichment.painPoint || "Talking points"}
                          </span>
                          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {expanded && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
                            {lead.enrichment.painPoint && <p>{lead.enrichment.painPoint}</p>}
                            {lead.enrichment.outreachAngle && (
                              <p style={{ marginTop: 6 }}>
                                <span style={{ color: "var(--text-4)" }}>Angle: </span>
                                {lead.enrichment.outreachAngle}
                              </p>
                            )}
                            {lead.lastCall && (
                              <p style={{ marginTop: 6 }}>
                                <span style={{ color: "var(--text-4)" }}>Last call: </span>
                                {lead.lastCall.disposition.replace(/_/g, " ").toLowerCase()}
                                {lead.lastCall.note ? ` — ${lead.lastCall.note}` : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* note */}
                    <textarea
                      ref={noteRef}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          if (armed) confirmArmed();
                        }
                      }}
                      placeholder="[objection] | [detail] | [commitment]  ·  press 1–6, or type then ⌘↵"
                      rows={2}
                      style={{
                        width: "100%",
                        resize: "none",
                        borderRadius: 8,
                        border: "1px solid var(--line-strong)",
                        background: "var(--bg-deep)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        padding: "9px 11px",
                        outline: "none",
                      }}
                    />

                    {/* disposition buttons */}
                    <div className="flex flex-wrap items-center" style={{ gap: 7, marginTop: 10 }}>
                      {QUICK_DISPOSITIONS.map((q) => {
                        const isCurrent =
                          isPast && activeLead?.lastCall?.disposition === q.id;
                        const isArmed = armed === q.id || isCurrent;
                        return (
                          <button
                            key={q.id}
                            onClick={() => fire(q.id)}
                            disabled={submitting}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              borderRadius: 8,
                              padding: "7px 11px",
                              fontSize: 12.5,
                              fontWeight: 600,
                              fontFamily: "inherit",
                              cursor: submitting ? "default" : "pointer",
                              color: isArmed ? "var(--accent)" : "var(--text-2)",
                              background: isArmed ? "var(--accent-soft)" : "var(--surface-2)",
                              border: `1px solid ${isArmed ? "color-mix(in oklab, var(--accent) 40%, transparent)" : "var(--line-strong)"}`,
                              opacity: submitting ? 0.6 : 1,
                            }}
                          >
                            <span
                              className="lg-mono"
                              style={{
                                fontSize: 10,
                                padding: "1px 4px",
                                borderRadius: 4,
                                background: "var(--surface-hi)",
                                color: "var(--text-4)",
                              }}
                            >
                              {q.key}
                            </span>
                            {q.label}
                          </button>
                        );
                      })}
                      {/* secondary dispositions */}
                      {SECONDARY_DISPOSITIONS.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => fire(q.id)}
                          disabled={submitting}
                          style={{
                            borderRadius: 8,
                            padding: "7px 11px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: submitting ? "default" : "pointer",
                            color: "var(--text-3)",
                            background: "transparent",
                            border: "1px solid var(--line)",
                            opacity: submitting ? 0.6 : 1,
                          }}
                        >
                          {q.label}
                        </button>
                      ))}
                      {submitting && (
                        <Loader2 size={15} className="animate-spin" style={{ color: "var(--text-3)" }} />
                      )}
                    </div>

                    {/* time picker for armed time-based dispositions */}
                    {armed && NEEDS_TIME.has(armed) && (
                      <div
                        className="flex items-center"
                        style={{ gap: 8, marginTop: 10 }}
                      >
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                          {armed === "BOOKED" ? "Zoom time" : "Call back at"}
                        </span>
                        <input
                          type="datetime-local"
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          style={{
                            borderRadius: 7,
                            border: "1px solid var(--line-strong)",
                            background: "var(--bg-deep)",
                            color: "var(--text)",
                            fontFamily: "inherit",
                            fontSize: 12.5,
                            padding: "6px 9px",
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={confirmArmed}
                          disabled={submitting || !callbackTime}
                          style={{
                            borderRadius: 7,
                            padding: "7px 13px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: !callbackTime || submitting ? "default" : "pointer",
                            color: "var(--accent)",
                            background: "var(--accent-soft)",
                            border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                            opacity: !callbackTime || submitting ? 0.6 : 1,
                          }}
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {detail && (
        <QueueDetailModal
          lead={detail}
          onClose={() => setDetail(null)}
          onOwnerResolved={setOwnerForLead}
        />
      )}
    </>
  );
}

// Detail popup for a queued lead — the Call Queue mirror of the prospect card's
// SuggestionDetailModal. Read-only: shows the find, contact rows (incl. the owner
// to ask for), and a Maps link. Opens when a row's business name is clicked.
function QueueDetailModal({
  lead,
  onClose,
  onOwnerResolved,
}: {
  lead: QueueLead;
  onClose: () => void;
  onOwnerResolved: (id: string, ownerName: string) => void;
}) {
  const e = lead.enrichment;

  // Resolve the owner on open if we don't already have one (same free single-site
  // read the prospect card uses; cached back to the row via onOwnerResolved).
  const [owner, setOwner] = useState<string | null>(e.ownerName);
  const [ownerLoading, setOwnerLoading] = useState(false);
  useEffect(() => {
    setOwner(e.ownerName);
    // Resolve on open (site first, then a "<name> <city> owner" web search), so we
    // attempt even without a website — search only needs the name + city.
    if (e.ownerName) return;
    let cancelled = false;
    setOwnerLoading(true);
    fetch("/api/opportunities/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ownerName) {
          setOwner(d.ownerName as string);
          onOwnerResolved(lead.id, d.ownerName as string);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOwnerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, e.ownerName, onOwnerResolved]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        // DELIBERATE LITERAL: modal scrim — black in both themes by definition.
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "lg-fade-up 0.14s ease-out",
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="surface"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 0,
          borderRadius: 16,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid place-items-center"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 8,
            // DELIBERATE LITERAL: close button over the modal's hero artwork.
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line)",
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <X size={15} strokeWidth={1.8} />
        </button>

        <div style={{ padding: "24px 24px 24px" }}>
          <div
            className="lg-display"
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}
          >
            {lead.name}
          </div>
          <div
            className="flex items-center"
            style={{ gap: 8, marginTop: 5, fontSize: 12.5, color: "var(--text-3)", flexWrap: "wrap" }}
          >
            {lead.industry && <span>{lead.industry}</span>}
            {lead.industry && lead.city && <span style={{ color: "var(--text-4)" }}>·</span>}
            {lead.city && (
              <span className="flex items-center" style={{ gap: 4 }}>
                <MapPin size={12} strokeWidth={1.7} /> {lead.city}
              </span>
            )}
          </div>

          {(e.rating != null || e.reviewCount != null) && (
            <div
              className="flex items-center"
              style={{ gap: 10, marginTop: 10, fontSize: 13, color: "var(--text-2)" }}
            >
              {e.rating != null && (
                <span className="flex items-center" style={{ gap: 4 }}>
                  <Star size={13} strokeWidth={1.9} style={{ color: "var(--warn)" }} /> {e.rating}
                </span>
              )}
              {e.reviewCount != null && (
                <>
                  <span style={{ color: "var(--text-4)" }}>·</span>
                  <span>{e.reviewCount} reviews</span>
                </>
              )}
            </div>
          )}

          {/* The cold-call finding — full, never truncated */}
          {(e.painPoint || e.outreachAngle) && (
            <div
              style={{
                marginTop: 18,
                padding: "14px 16px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderLeft: "2px solid var(--warn)",
              }}
            >
              <div
                className="lg-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--warn)",
                  marginBottom: 8,
                }}
              >
                The find to open with
              </div>
              {e.painPoint && (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>
                  {e.painPoint}
                </p>
              )}
              {e.outreachAngle && (
                <p style={{ margin: e.painPoint ? "10px 0 0" : 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <span style={{ color: "var(--text-4)" }}>Angle · </span>
                  {e.outreachAngle}
                </p>
              )}
            </div>
          )}

          {/* Contact rows */}
          <div className="flex flex-col" style={{ gap: 2, marginTop: 16 }}>
            {lead.phone && (
              <QueueDetailRow icon={<Phone size={14} strokeWidth={1.6} />} href={`tel:${lead.phone}`} text={lead.phone} />
            )}
            <QueueDetailRow
              icon={<UserRound size={14} strokeWidth={1.6} />}
              text={owner ? `Ask for ${owner}` : ownerLoading ? "Finding owner…" : "Owner not found"}
              muted={!owner}
            />
            {lead.website && (
              <QueueDetailRow
                icon={<Globe size={14} strokeWidth={1.6} />}
                href={lead.website}
                text={lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                external
              />
            )}
          </div>

          {e.mapsUrl && (
            <div
              className="flex items-center"
              style={{ gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--line)" }}
            >
              <a
                href={e.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
                style={{ gap: 6, marginLeft: "auto", fontSize: 12.5, color: "var(--text-3)", textDecoration: "none" }}
              >
                Google Maps <ExternalLink size={12} strokeWidth={1.7} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueDetailRow({
  icon,
  text,
  href,
  external,
  muted,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
  external?: boolean;
  muted?: boolean;
}) {
  const inner = (
    <div
      className="flex items-center"
      style={{
        gap: 10,
        padding: "7px 0",
        fontSize: 13,
        color: muted ? "var(--text-4)" : href ? "var(--text)" : "var(--text-2)",
      }}
    >
      <span style={{ color: "var(--text-3)", flex: "none" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
  if (!href) return inner;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{ textDecoration: "none" }}
    >
      {inner}
    </a>
  );
}

// Compact burn-down ring: how many of today's batch have been called.
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const size = 30;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const complete = done >= total && total > 0;
  return (
    <div className="flex items-center" style={{ gap: 9 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? "var(--money)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset var(--t)" }}
        />
      </svg>
      <div style={{ lineHeight: 1.2 }}>
        <div className="lg-mono tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {done} / {total}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>called today</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="lg-mono"
      style={{
        fontSize: 10.5,
        padding: "1px 5px",
        borderRadius: 4,
        background: "var(--surface-hi)",
        border: "1px solid var(--line)",
        color: "var(--text-3)",
      }}
    >
      {children}
    </span>
  );
}
