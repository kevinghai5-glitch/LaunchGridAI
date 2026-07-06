"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Phone,
  Star,
  Gauge,
  AlertTriangle,
  Video,
  PhoneForwarded,
  X,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { ZoomRoomView } from "@/components/calendar/ZoomRoomView";
import {
  DateNav,
  type CalScale,
  isSameDay,
  startOfDay,
  startOfWeek,
  addDays,
} from "@/components/dashboard/DateNav";

type CalMode = "calendar" | "zoom";

// Event shape returned by GET /api/calendar (dates are ISO strings).
interface CalEvent {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  type: "ZOOM" | "CALLBACK";
  start: string;
  end: string;
  mapsUrl: string | null;
  enrichment: {
    rating: number | null;
    reviewCount: number | null;
    painPoint: string | null;
    outreachAngle: string | null;
    topLeak: string | null;
    headlineCost: string | null;
    mobileScore: number | null;
  };
}

// The visible grid runs 8am → 8pm. Events outside are clamped into range so they
// never vanish off the top/bottom of the grid.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_PX = 56; // row height per hour

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Minutes from the top of the grid (8am) for a given Date, clamped to the window.
function offsetMinutes(d: Date): number {
  const mins = d.getHours() * 60 + d.getMinutes();
  const min = DAY_START_HOUR * 60;
  const max = DAY_END_HOUR * 60;
  return Math.max(min, Math.min(max, mins)) - min;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [coldCalls, setColdCalls] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<CalScale>("week");
  const [mode, setMode] = useState<CalMode>("calendar");
  const [date, setDate] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Cursor offset (px) from the top of the dragged block, so the drop lands on
  // the block's start rather than wherever the pointer happened to grab it.
  const grabOffsetRef = useRef(0);

  // The columns to render: 7 for week, 1 for day.
  const days = useMemo(() => {
    if (scale === "week") {
      const start = startOfWeek(date);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [startOfDay(date)];
  }, [scale, date]);

  // Fetch range covers the visible columns.
  const rangeKey = `${ymd(days[0])}_${ymd(days[days.length - 1])}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    const from = startOfDay(days[0]).toISOString();
    const toEnd = new Date(days[days.length - 1]);
    toEnd.setHours(23, 59, 59, 999);
    (async () => {
      try {
        const res = await fetch(
          `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(toEnd.toISOString())}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as {
          events: CalEvent[];
          coldCalls: Record<string, number>;
        };
        if (!cancelled) {
          setEvents(data.events ?? []);
          setColdCalls(data.coldCalls ?? {});
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i
  );
  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
  const today = new Date();

  // Group events by their calendar day for column rendering.
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      const key = ymd(new Date(ev.start));
      (map[key] ??= []).push(ev);
    }
    return map;
  }, [events]);

  const zoomCount = events.filter((e) => e.type === "ZOOM").length;

  // Persist a Business patch, optimistically updating the event list. Reverts
  // and toasts on failure. `next` is the optimistic local event mutation.
  async function patchBusiness(
    ev: CalEvent,
    body: Record<string, unknown>,
    next: (e: CalEvent) => CalEvent | null
  ) {
    const prev = events;
    setEvents((list) =>
      list.flatMap((e) => {
        if (e.id !== ev.id) return [e];
        const updated = next(e);
        return updated ? [updated] : [];
      })
    );
    setSelected((s) => (s && s.id === ev.id ? next(s) : s));
    try {
      const res = await fetch(`/api/businesses/${ev.businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
    } catch (e) {
      setEvents(prev);
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  // Drag-to-reschedule: keep the same duration, move the start to newStart.
  function rescheduleEvent(ev: CalEvent, newStart: Date) {
    const oldStart = new Date(ev.start);
    const durMs = new Date(ev.end).getTime() - oldStart.getTime();
    if (newStart.getTime() === oldStart.getTime()) return;
    const newEnd = new Date(newStart.getTime() + durMs);
    const startIso = newStart.toISOString();
    const endIso = newEnd.toISOString();
    void patchBusiness(
      ev,
      { nextActionAt: startIso },
      (e) => ({ ...e, start: startIso, end: endIso })
    );
    toast.success(
      `Moved to ${newStart.toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })}`
    );
  }

  // Switch a block between Zoom and Callback.
  function changeType(ev: CalEvent, toType: "ZOOM" | "CALLBACK") {
    if (ev.type === toType) return;
    void patchBusiness(
      ev,
      { status: toType === "ZOOM" ? "BOOKED_ZOOM" : "CALLBACK" },
      (e) => ({ ...e, type: toType })
    );
  }

  // Cancel a commitment: send the lead back to the queue (clears its time slot).
  function cancelEvent(ev: CalEvent) {
    setSelected(null);
    void patchBusiness(
      ev,
      { status: "QUEUED", nextAction: "Cold call", nextActionAt: new Date().toISOString() },
      () => null
    );
    toast.success("Sent back to the call queue", {
      action: {
        label: "Undo",
        onClick: () => {
          setEvents((list) => (list.some((e) => e.id === ev.id) ? list : [...list, ev]));
          void fetch(`/api/businesses/${ev.businessId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: ev.type === "ZOOM" ? "BOOKED_ZOOM" : "CALLBACK",
              nextActionAt: ev.start,
            }),
          });
        },
      },
    });
  }

  return (
    <>
      <TopBar title="Calendar" subtitle="Your booked Zooms & callbacks" />
      <div style={{ width: "100%", padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {/* header */}
        <div className="rise" style={{ marginBottom: 18 }}>
          <h1
            className="lg-display"
            style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.032em", color: "var(--text)" }}
          >
            Calendar
          </h1>
          <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-3)" }}>
            {mode === "zoom"
              ? "Run your booked Zooms"
              : loading
                ? "Loading…"
                : `${zoomCount} Zoom${zoomCount === 1 ? "" : "s"} booked this ${scale === "week" ? "week" : "day"}`}
          </p>
        </div>

        {/* mode toggle — the calendar grid vs. the "On the Zoom" runner list */}
        <div className="flex items-center" style={{ gap: 4, marginBottom: 20 }}>
          <ModeTab active={mode === "calendar"} onClick={() => setMode("calendar")}>
            Calendar
          </ModeTab>
          <ModeTab active={mode === "zoom"} onClick={() => setMode("zoom")}>
            Zoom Room
          </ModeTab>
        </div>

        {mode === "zoom" ? (
          <ZoomRoomView />
        ) : (
          <>
        {/* navigator */}
        <div style={{ marginBottom: 16 }}>
          <DateNav date={date} onChange={setDate} scale={scale} onScaleChange={setScale} />
        </div>

        {/* legend */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: 14, marginBottom: 14, fontSize: 11.5, color: "var(--text-subtle)" }}
        >
          <span className="flex items-center" style={{ gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--money)" }} /> Zoom
          </span>
          <span className="flex items-center" style={{ gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)" }} /> Callback
          </span>
        </div>

        {error && (
          <div className="panel p-5 text-sm" style={{ color: "var(--danger, #f87171)" }}>
            {error}
          </div>
        )}

        {/* calendar grid */}
        {!error && (
          <div
            className="panel"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {/* day headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ borderRight: "1px solid var(--line)" }} />
              {days.map((d) => {
                const isCurrent = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    style={{
                      padding: "10px 12px",
                      textAlign: scale === "week" ? "center" : "left",
                      borderRight: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div
                      className="lg-display"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginTop: 2,
                        color: isCurrent ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* all-day lane — untimed cold calls */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
                borderBottom: "1px solid var(--line)",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div
                style={{
                  borderRight: "1px solid var(--line)",
                  fontSize: 9.5,
                  color: "var(--text-4)",
                  padding: "8px 6px",
                  textAlign: "right",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                all-day
              </div>
              {days.map((d) => {
                const n = coldCalls[ymd(d)] ?? 0;
                return (
                  <div
                    key={d.toISOString()}
                    style={{ borderRight: "1px solid var(--line)", padding: "6px 8px", minHeight: 34 }}
                  >
                    {n > 0 && (
                      <Link
                        href="/call-queue"
                        className="flex items-center"
                        style={{
                          gap: 6,
                          padding: "5px 9px",
                          borderRadius: 7,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid var(--line-strong)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "var(--text-2)",
                          textDecoration: "none",
                        }}
                      >
                        <Phone size={11} strokeWidth={2} />
                        {n} cold call{n === 1 ? "" : "s"}
                        <ArrowRight size={11} strokeWidth={2} style={{ marginLeft: "auto", color: "var(--text-4)" }} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* time grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
                position: "relative",
              }}
            >
              {/* hour gutter */}
              <div style={{ borderRight: "1px solid var(--line)" }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: HOUR_PX,
                      fontSize: 10,
                      color: "var(--text-4)",
                      textAlign: "right",
                      paddingRight: 8,
                      transform: "translateY(-6px)",
                    }}
                  >
                    {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </div>
                ))}
              </div>

              {/* day columns */}
              {days.map((d) => {
                const dayEvents = eventsByDay[ymd(d)] ?? [];
                return (
                  <div
                    key={d.toISOString()}
                    onDragOver={(e) => {
                      if (dragId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const ev = events.find((x) => x.id === dragId);
                      setDragId(null);
                      if (!ev) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top - grabOffsetRef.current;
                      // px → minutes from grid top, snapped to 15-min slots.
                      const rawMin = (y / HOUR_PX) * 60 + DAY_START_HOUR * 60;
                      const snapped = Math.round(rawMin / 15) * 15;
                      const clamped = Math.max(
                        DAY_START_HOUR * 60,
                        Math.min(DAY_END_HOUR * 60 - 15, snapped)
                      );
                      const newStart = new Date(d);
                      newStart.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
                      rescheduleEvent(ev, newStart);
                    }}
                    style={{
                      position: "relative",
                      borderRight: "1px solid var(--line)",
                      height: gridHeight,
                    }}
                  >
                    {/* hour lines */}
                    {hours.slice(1).map((h) => (
                      <div
                        key={h}
                        style={{
                          position: "absolute",
                          top: (h - DAY_START_HOUR) * HOUR_PX,
                          left: 0,
                          right: 0,
                          borderTop: "1px solid var(--line)",
                          opacity: 0.5,
                        }}
                      />
                    ))}

                    {/* event blocks */}
                    {dayEvents.map((ev) => {
                      const start = new Date(ev.start);
                      const end = new Date(ev.end);
                      const top = (offsetMinutes(start) / 60) * HOUR_PX;
                      const durMin = Math.max(
                        15,
                        (end.getTime() - start.getTime()) / 60_000
                      );
                      const height = Math.max(22, (durMin / 60) * HOUR_PX - 2);
                      const isZoom = ev.type === "ZOOM";
                      const fg = isZoom ? "var(--money)" : "var(--accent)";
                      const bg = isZoom ? "rgba(74,222,128,0.12)" : "var(--accent-soft)";
                      return (
                        <button
                          key={ev.id}
                          draggable
                          onDragStart={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            grabOffsetRef.current = e.clientY - rect.top;
                            setDragId(ev.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => setSelected(ev)}
                          className="text-left"
                          style={{
                            position: "absolute",
                            top,
                            left: 3,
                            right: 3,
                            height,
                            padding: "4px 7px",
                            borderRadius: 6,
                            background: bg,
                            borderLeft: `2px solid ${fg}`,
                            border: "none",
                            cursor: dragId === ev.id ? "grabbing" : "grab",
                            overflow: "hidden",
                            fontFamily: "inherit",
                            opacity: dragId === ev.id ? 0.4 : 1,
                          }}
                        >
                          <div
                            className="flex items-center"
                            style={{ gap: 4, fontSize: 11, fontWeight: 600, color: fg }}
                          >
                            {isZoom ? (
                              <Video size={11} strokeWidth={2} />
                            ) : (
                              <PhoneForwarded size={11} strokeWidth={2} />
                            )}
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                color: "var(--text)",
                              }}
                            >
                              {ev.name}
                            </span>
                          </div>
                          {height > 34 && (
                            <div className="lg-mono" style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 2 }}>
                              {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
            No Zooms or callbacks scheduled in this range. Book one from{" "}
            <Link href="/call-queue" style={{ color: "var(--accent)" }}>
              the call queue
            </Link>
            .
          </p>
        )}
          </>
        )}
      </div>

      {/* event detail popover */}
      {selected && (
        <EventDetail
          ev={selected}
          onClose={() => setSelected(null)}
          onChangeType={(t) => changeType(selected, t)}
          onCancel={() => cancelEvent(selected)}
        />
      )}
    </>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px",
        fontSize: 12.5,
        fontWeight: 600,
        color: active ? "var(--text)" : "var(--text-3)",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: `1px solid ${active ? "var(--line-strong)" : "transparent"}`,
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--t), background var(--t), border-color var(--t)",
      }}
    >
      {children}
    </button>
  );
}

function EventDetail({
  ev,
  onClose,
  onChangeType,
  onCancel,
}: {
  ev: CalEvent;
  onClose: () => void;
  onChangeType: (t: "ZOOM" | "CALLBACK") => void;
  onCancel: () => void;
}) {
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  const isZoom = ev.type === "ZOOM";
  const fg = isZoom ? "var(--money)" : "var(--accent)";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-lg)",
          padding: 22,
          boxShadow: "var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.5))",
        }}
      >
        <div className="flex items-start" style={{ gap: 12, justifyContent: "space-between" }}>
          <div>
            <div
              className="flex items-center"
              style={{ gap: 6, fontSize: 11, fontWeight: 600, color: fg, textTransform: "uppercase", letterSpacing: "0.04em" }}
            >
              {isZoom ? <Video size={12} strokeWidth={2} /> : <PhoneForwarded size={12} strokeWidth={2} />}
              {isZoom ? "Booked Zoom" : "Callback"}
            </div>
            <h2 className="lg-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>
              {ev.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid place-items-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
              cursor: "pointer",
              flex: "none",
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="lg-mono" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 10 }}>
          {start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} –{" "}
          {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>

        {/* contact + signals */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: 12, marginTop: 12, fontSize: 12.5, color: "var(--text-3)" }}
        >
          {ev.phone && (
            <span className="flex items-center" style={{ gap: 5 }}>
              <Phone size={12} strokeWidth={1.9} /> {ev.phone}
            </span>
          )}
          {ev.city && <span>{ev.city}</span>}
          {ev.enrichment.rating != null && (
            <span className="flex items-center" style={{ gap: 4 }}>
              <Star size={12} strokeWidth={1.9} style={{ color: "oklch(0.82 0.14 85)" }} />
              {ev.enrichment.rating}
              {ev.enrichment.reviewCount != null && (
                <span style={{ color: "var(--text-4)" }}> ({ev.enrichment.reviewCount})</span>
              )}
            </span>
          )}
          {ev.enrichment.mobileScore != null && (
            <span className="flex items-center" style={{ gap: 4 }}>
              <Gauge size={12} strokeWidth={1.9} /> {ev.enrichment.mobileScore}
            </span>
          )}
        </div>

        {/* talking points */}
        {(ev.enrichment.topLeak || ev.enrichment.painPoint || ev.enrichment.headlineCost) && (
          <div
            style={{
              marginTop: 14,
              padding: "11px 13px",
              borderRadius: 9,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
              <AlertTriangle size={12} strokeWidth={2} style={{ color: "oklch(0.82 0.14 85)" }} />
              {ev.enrichment.topLeak || ev.enrichment.painPoint || "Talking points"}
              {ev.enrichment.headlineCost && (
                <span style={{ color: "var(--money)", marginLeft: "auto" }}>{ev.enrichment.headlineCost}</span>
              )}
            </div>
            {ev.enrichment.painPoint && ev.enrichment.topLeak && (
              <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
                {ev.enrichment.painPoint}
              </p>
            )}
            {ev.enrichment.outreachAngle && (
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
                <span style={{ color: "var(--text-4)" }}>Angle: </span>
                {ev.enrichment.outreachAngle}
              </p>
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 16 }}>
          {isZoom && (
            <Link
              href={`/call/${ev.businessId}`}
              className="flex items-center"
              style={{
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "var(--money)",
                border: "1px solid var(--money)",
                color: "#06210f",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Video size={13} strokeWidth={2.2} /> Start Zoom
            </Link>
          )}
          <Link
            href={`/businesses/${ev.businessId}`}
            className="flex items-center"
            style={{
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background: "var(--accent-soft)",
              border: "1px solid oklch(0.55 0.18 248 / 0.4)",
              color: "var(--accent)",
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open lead <ArrowRight size={13} strokeWidth={2} />
          </Link>
          {ev.website && (
            <a
              href={ev.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
              style={{
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Website <ExternalLink size={12} strokeWidth={2} />
            </a>
          )}
        </div>

        {/* reschedule / cancel — edit the commitment like a spreadsheet cell */}
        <div
          className="flex items-center"
          style={{
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => onChangeType(isZoom ? "CALLBACK" : "ZOOM")}
            className="flex items-center"
            style={{
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <RefreshCw size={12} strokeWidth={2} />
            Switch to {isZoom ? "Callback" : "Zoom"}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center"
            style={{
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              marginLeft: "auto",
            }}
          >
            <Undo2 size={12} strokeWidth={2} />
            Back to queue
          </button>
        </div>
      </div>
    </div>
  );
}
