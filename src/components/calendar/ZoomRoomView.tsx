"use client";

// The "On the Zoom" runner's home, shown as a toggle inside the Calendar page.
// Lists the leads that carry a live Zoom state (booked / no-show / deciding) and
// launches the runner for each. With nothing booked, it still lets you preview
// the runner against your most recent lead so the surface is never a dead end.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, ArrowRight, CalendarClock } from "lucide-react";
import { STATUS_META, type LeadStatus } from "@/lib/call-queue";

interface ZoomLead {
  id: string;
  name: string;
  city: string | null;
  industry: string | null;
  phone: string | null;
  status: LeadStatus;
  nextActionAt: string | null;
}

interface ZoomRoomData {
  zoomLeads: ZoomLead[];
  recentLead: { id: string; name: string } | null;
}

function fmtWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ZoomRoomView() {
  const [data, setData] = useState<ZoomRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/calendar/zoom-room", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = (await res.json()) as ZoomRoomData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13.5, color: "var(--text-3)", maxWidth: 560, lineHeight: 1.55 }}>
          The live call cockpit: Diagnose the audit, Pivot leaks into the offer, present the Proposal,
          then record how it ended. Launch it for any booked Zoom below.
        </p>
      </div>

      {error && (
        <div className="panel p-5 text-sm" style={{ color: "var(--danger, #f87171)" }}>
          {error}
        </div>
      )}

      {loading && !error && (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Loading…</p>
      )}

      {!loading && !error && data && data.zoomLeads.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {data.zoomLeads.map((lead) => {
            const meta = STATUS_META[lead.status];
            const when = fmtWhen(lead.nextActionAt);
            const market = [lead.city, lead.industry].filter(Boolean).join(" · ");
            return (
              <Link
                key={lead.id}
                href={`/call/${lead.id}`}
                className="panel hover-lift flex items-center"
                style={{ gap: 14, padding: "16px 18px", borderRadius: 14, textDecoration: "none" }}
              >
                <span
                  className="grid place-items-center"
                  style={{
                    width: 42,
                    height: 42,
                    flex: "none",
                    borderRadius: 11,
                    background: "rgba(74,222,128,0.12)",
                    color: "var(--money)",
                  }}
                >
                  <Video size={18} strokeWidth={2} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="flex items-center" style={{ gap: 9 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{lead.name}</span>
                    {meta && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          color: "var(--text-2)",
                          background: "var(--surface-2)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center" style={{ gap: 12, marginTop: 4, fontSize: 12.5, color: "var(--text-3)" }}>
                    {when && (
                      <span className="flex items-center" style={{ gap: 5 }}>
                        <CalendarClock size={12} strokeWidth={1.9} /> {when}
                      </span>
                    )}
                    {market && <span>{market}</span>}
                  </span>
                </span>
                <span
                  className="flex items-center"
                  style={{
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 9,
                    flex: "none",
                    background: "var(--money)",
                    color: "#06210f",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  Start Zoom <ArrowRight size={13} strokeWidth={2.2} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && !error && data && data.zoomLeads.length === 0 && (
        <div className="panel" style={{ padding: 28, borderRadius: 16, textAlign: "center" }}>
          <span
            className="grid place-items-center"
            style={{ width: 46, height: 46, margin: "0 auto 12px", borderRadius: 12, background: "var(--surface-2)", color: "var(--text-3)" }}
          >
            <Video size={20} strokeWidth={1.8} />
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>No Zooms booked yet</div>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6, maxWidth: 460, marginInline: "auto", lineHeight: 1.55 }}>
            Book a Zoom from the Call Queue (disposition a call as &ldquo;Booked Zoom&rdquo;) and it shows up
            here. Want to see the runner right now?
          </p>
          {data.recentLead && (
            <Link
              href={`/call/${data.recentLead.id}`}
              className="flex items-center"
              style={{
                gap: 6,
                marginTop: 16,
                padding: "9px 16px",
                borderRadius: 9,
                background: "var(--accent-grad)",
                border: "1px solid var(--accent)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                width: "fit-content",
                marginInline: "auto",
              }}
            >
              <Video size={14} strokeWidth={2} /> Preview with {data.recentLead.name}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
