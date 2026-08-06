"use client";

// Dial status — the phone-first exception logger + retry view.
//
// Built for the moment the operator is mid-call, on his phone, dialing from
// GoHighLevel in another app. He is NOT going to log 70 outcomes here after a
// block — so this logs only the EXCEPTIONS: someone says no, someone says never
// call again, someone books. Search a name, one tap, done.
//
// Designed for a phone, not resized to fit one: one column, big tap targets,
// nothing else on screen. It also doubles as the retry view — with the search
// empty it lists everything currently "dialed" (attempted, no outcome), oldest
// first, so no-answers stay findable and re-dialable instead of being lost.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, PhoneOff, X, RotateCw, Ban, Check, CalendarCheck } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { DIAL_STATUS_META, type DialStatus, type DialTone } from "@/lib/dial-status";

interface Row {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  industry: string | null;
  dialStatus: string;
  dialStatusAt: string | null;
  attemptCount: number;
  label: string;
}

const toneColor: Record<DialTone, string> = {
  neutral: "var(--text-2)",
  accent: "var(--accent)",
  success: "var(--money)",
  danger: "var(--danger)",
  muted: "var(--text-4)",
};

function relative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function DialStatusPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<"retry" | "search">("retry");
  const [loading, setLoading] = useState(true);
  // Which row's Do-Not-Call is armed (waiting for the confirm tap). Only one at a
  // time — do_not_call is permanent, so it deliberately takes two taps.
  const [armedDnc, setArmedDnc] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (query: string) => {
    const mine = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/dial-status?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      if (mine !== reqId.current) return; // a newer keystroke won
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = (await res.json()) as { mode: "retry" | "search"; rows: Row[] };
      if (mine !== reqId.current) return;
      setMode(data.mode);
      setRows(data.rows ?? []);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, []);

  // Debounced search; empty query loads the retry list.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), q.trim() ? 220 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const setStatus = async (row: Row, status: DialStatus) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/dial-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: row.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not update");
        return;
      }
      const label = DIAL_STATUS_META[status].label;
      toast.success(`${row.name} → ${label}`);
      // In the retry view the row is no longer "dialed", so drop it. In search,
      // update its badge in place and retire its action buttons.
      if (mode === "retry") {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, dialStatus: status, label, dialStatusAt: data.dialStatusAt } : r
          )
        );
      }
    } finally {
      setBusyId(null);
      setArmedDnc(null);
    }
  };

  return (
    <>
      <TopBar title="Dial status" subtitle="Log a no, a do-not-call, or a booking" />
      {/* Narrow column even on desktop — this is a phone tool first. */}
      <div style={{ width: "100%", maxWidth: 620, margin: "0 auto", padding: "24px 16px 96px" }}>
        {/* Search — the primary control, kept at the top and sticky. */}
        <div
          style={{
            position: "sticky",
            top: 12,
            zIndex: 20,
            marginBottom: 18,
          }}
        >
          <div
            className="flex items-center"
            style={{
              gap: 10,
              padding: "0 14px",
              height: 52,
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
            }}
          >
            <Search size={18} strokeWidth={2} style={{ color: "var(--text-4)", flexShrink: 0 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              autoComplete="off"
              placeholder="Search a business by name or phone"
              aria-label="Search a business by name or phone"
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                fontSize: 16, // 16px so iOS Safari doesn't zoom the field on focus
                color: "var(--text)",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  color: "var(--text-3)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={17} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Section label */}
        <div
          className="lg-mono flex items-center"
          style={{
            gap: 7,
            fontSize: 10.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-4)",
            marginBottom: 12,
            paddingLeft: 2,
          }}
        >
          {mode === "retry" ? (
            <>
              <RotateCw size={12} strokeWidth={2} /> In retry — dialed, awaiting outcome
            </>
          ) : (
            <>
              <Search size={12} strokeWidth={2} /> Results
            </>
          )}
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center"
            style={{ padding: "48px 0", color: "var(--text-4)" }}
          >
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: "44px 20px",
              textAlign: "center",
              border: "1px dashed var(--line-strong)",
              borderRadius: 14,
              color: "var(--text-3)",
            }}
          >
            <PhoneOff size={24} strokeWidth={1.6} style={{ color: "var(--text-4)", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {mode === "search" ? "No match" : "Nothing in retry"}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 6 }}>
              {mode === "search"
                ? "Try the business name as it reads in GoHighLevel."
                : "Businesses you export land here as “dialed” until you log an outcome."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 10 }}>
            {rows.map((row) => (
              <DialRow
                key={row.id}
                row={row}
                busy={busyId === row.id}
                dncArmed={armedDnc === row.id}
                onArmDnc={() => setArmedDnc((cur) => (cur === row.id ? null : row.id))}
                onSet={(s) => setStatus(row, s)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DialRow({
  row,
  busy,
  dncArmed,
  onArmDnc,
  onSet,
}: {
  row: Row;
  busy: boolean;
  dncArmed: boolean;
  onArmDnc: () => void;
  onSet: (status: DialStatus) => void;
}) {
  const meta = DIAL_STATUS_META[row.dialStatus as DialStatus];
  const tone = meta?.tone ?? "neutral";
  // Actions only make sense while a business is still live in the funnel. A
  // do_not_call is permanent (no path back), and the other terminal states are
  // already logged — so show the badge and stop.
  const terminal =
    row.dialStatus === "do_not_call" ||
    row.dialStatus === "not_interested" ||
    row.dialStatus === "booked" ||
    row.dialStatus === "disqualified";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 14,
        opacity: busy ? 0.6 : 1,
        transition: "opacity var(--t)",
      }}
    >
      {/* Identity */}
      <div className="flex items-start justify-between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 650, color: "var(--text)", lineHeight: 1.25 }}>
            {row.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 3 }}>
            {row.phone || "no number on file"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 3 }}>
            {[row.city, row.industry].filter(Boolean).join(" · ")}
            {row.attemptCount > 0 && ` · ${row.attemptCount} attempt${row.attemptCount === 1 ? "" : "s"}`}
            {row.dialStatusAt && ` · ${relative(row.dialStatusAt)}`}
          </div>
        </div>
        <span
          className="lg-mono"
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: toneColor[tone],
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${toneColor[tone]}33`,
            borderRadius: 999,
            padding: "4px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {row.label}
        </span>
      </div>

      {/* Actions — the whole point. Big tap targets, one row on a phone. */}
      {terminal ? (
        row.dialStatus === "do_not_call" ? (
          <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 12 }}>
            Permanent — reversing Do Not Call requires a direct database change.
          </div>
        ) : null
      ) : (
        <div className="flex" style={{ gap: 8, marginTop: 14 }}>
          <TapButton
            label="Not interested"
            icon={<X size={15} strokeWidth={2.2} />}
            tone="muted"
            disabled={busy}
            onClick={() => onSet("not_interested")}
          />
          <TapButton
            label="Booked"
            icon={<CalendarCheck size={15} strokeWidth={2} />}
            tone="success"
            disabled={busy}
            onClick={() => onSet("booked")}
          />
          {dncArmed ? (
            <TapButton
              label="Confirm — permanent"
              icon={<Check size={15} strokeWidth={2.4} />}
              tone="danger"
              solid
              disabled={busy}
              onClick={() => onSet("do_not_call")}
            />
          ) : (
            <TapButton
              label="Do not call"
              icon={<Ban size={15} strokeWidth={2} />}
              tone="danger"
              disabled={busy}
              onClick={onArmDnc}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TapButton({
  label,
  icon,
  tone,
  solid,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "muted" | "success" | "danger";
  solid?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const color =
    tone === "danger" ? "var(--danger)" : tone === "success" ? "var(--money)" : "var(--text-2)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center"
      style={{
        flex: 1,
        gap: 6,
        minHeight: 46, // comfortable thumb target
        padding: "0 8px",
        fontSize: 12.5,
        fontWeight: 650,
        borderRadius: 11,
        color: solid ? "#fff" : color,
        background: solid ? color : "rgba(255,255,255,0.04)",
        border: `1px solid ${solid ? color : "var(--line)"}`,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        lineHeight: 1.1,
        textAlign: "center",
        transition: "background var(--t), border-color var(--t), color var(--t)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
