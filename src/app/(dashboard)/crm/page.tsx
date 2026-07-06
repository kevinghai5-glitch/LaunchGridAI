"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutGrid,
  Table2,
  Phone,
  X,
  Globe,
  Sparkles,
  Star,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { KpiCard } from "@/components/dashboard/os";
import { LgButton } from "@/components/ui/lg-button";
import {
  CRM_STAGES,
  type CrmStageId,
  opportunityScore,
  gapsFor,
} from "@/lib/crm";

// Lead row returned by GET /api/crm (dates are ISO strings).
interface CrmLead {
  id: string;
  name: string;
  city: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: string;
  stage: CrmStageId;
  nextAction: string | null;
  nextActionAt: string | null;
  attemptCount: number;
  lastActivityAt: string;
  source: string;
  monthlyValue: number;
  lastCall: { disposition: string; note: string | null; calledAt: string } | null;
}

// The status each board column writes when a lead is dropped into it. Picks the
// canonical/primary status for the column (manual operator override).
const STAGE_DROP_STATUS: Record<CrmStageId, string> = {
  SUGGESTED: "SUGGESTED",
  QUEUED: "QUEUED",
  ATTEMPTING: "NO_ANSWER",
  CALLBACK: "CALLBACK",
  INTERESTED: "WAITING",
  BOOKED: "BOOKED_ZOOM",
  PROPOSAL: "PROPOSAL",
  WON: "WON",
  LOST: "DEAD",
};

function toneColor(tone: string): string {
  switch (tone) {
    case "success":
      return "var(--money)";
    case "accent":
      return "var(--accent)";
    case "danger":
      return "var(--danger, #f87171)";
    case "muted":
      return "var(--text-4)";
    default:
      return "var(--text-3)";
  }
}

function relDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CrmPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "table">("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStageId | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const activeLead = activeLeadId ? leads.find((l) => l.id === activeLeadId) ?? null : null;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setLeads(data.leads ?? []);
    } finally {
      setLoading(false);
    }
  };

  const moveLead = async (id: string, toStage: CrmStageId) => {
    const lead = leads.find((l) => l.id === id);
    setDragId(null);
    setOverStage(null);
    if (!lead || lead.stage === toStage) return;
    const newStatus = STAGE_DROP_STATUS[toStage];
    const before = leads;
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, stage: toStage, status: newStatus } : l))
    );
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setLeads(before);
        toast.error("Failed to move lead");
      }
    } catch {
      setLeads(before);
      toast.error("Failed to move lead");
    }
  };

  // Generic inline-cell save: optimistically patch local state, persist through the
  // shared business PATCH, and revert on failure. Powers the editable table cells.
  const patchField = async (
    id: string,
    data: Record<string, unknown>,
    optimistic: Partial<CrmLead>
  ) => {
    const before = leads;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...optimistic } : l)));
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setLeads(before);
        toast.error("Failed to save");
      }
    } catch {
      setLeads(before);
      toast.error("Failed to save");
    }
  };

  // KPIs across the whole lifecycle.
  const stats = useMemo(() => {
    const won = leads.filter((l) => l.stage === "WON");
    const activeMRR = won.reduce((s, l) => s + l.monthlyValue, 0);
    const inMotion = leads.filter(
      (l) => l.stage !== "WON" && l.stage !== "LOST" && l.stage !== "SUGGESTED"
    );
    const pipelineMRR = inMotion.reduce((s, l) => s + l.monthlyValue, 0);
    return { total: leads.length, activeMRR, pipelineMRR, inMotion: inMotion.length, won: won.length };
  }, [leads]);

  return (
    <>
      <TopBar title="CRM" subtitle="Every lead, cold to closed" />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1600, margin: "0 auto" }}>
        {/* Header */}
        <div className="rise" style={{ marginBottom: 28 }}>
          <h1
            className="lg-display"
            style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}
          >
            CRM
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            {stats.total} leads · ${stats.activeMRR.toLocaleString()} active MRR · $
            {stats.pipelineMRR.toLocaleString()} in motion
          </div>
        </div>

        {/* KPIs */}
        <div className="rise grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
          <KpiCard label="Active MRR" value={`$${stats.activeMRR.toLocaleString()}`} sub={`${stats.won} retainers live`} color="money" />
          <KpiCard label="In pipeline" value={`$${stats.pipelineMRR.toLocaleString()}`} sub={`${stats.inMotion} leads in motion`} />
          <KpiCard label="Total leads" value={stats.total.toLocaleString()} sub="Across all stages" />
        </div>

        {/* View toggle */}
        <div className="flex items-center" style={{ gap: 4, marginBottom: 18 }}>
          <ViewTab active={view === "board"} onClick={() => setView("board")} icon={<LayoutGrid size={13} strokeWidth={1.9} />}>
            Board
          </ViewTab>
          <ViewTab active={view === "table"} onClick={() => setView("table")} icon={<Table2 size={13} strokeWidth={1.9} />}>
            Table
          </ViewTab>
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
            Loading leads…
          </div>
        )}

        {!loading && leads.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
            No leads yet. Generate prospects from Opportunities to fill your CRM.
          </div>
        )}

        {/* Board */}
        {!loading && leads.length > 0 && view === "board" && (
          <div
            className="grid items-start"
            style={{ gridTemplateColumns: `repeat(${CRM_STAGES.length}, minmax(190px, 1fr))`, gap: 12, overflowX: "auto", paddingBottom: 8 }}
          >
            {CRM_STAGES.map((s) => {
              const stageLeads = leads.filter((l) => l.stage === s.id);
              const mrr = stageLeads.reduce((acc, l) => acc + l.monthlyValue, 0);
              const isOver = overStage === s.id;
              const accent = toneColor(s.tone);
              return (
                <div
                  key={s.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(s.id);
                  }}
                  onDragLeave={() => setOverStage((cur) => (cur === s.id ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) moveLead(dragId, s.id);
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {/* column header */}
                  <div style={{ padding: "2px 2px 8px" }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span className="flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: accent }} />
                        {s.label}
                      </span>
                      <span className="lg-mono tnum" style={{ fontSize: 11, color: "var(--text-4)" }}>
                        {stageLeads.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>
                      {s.money && mrr > 0 ? `$${mrr.toLocaleString()}/mo` : s.hint}
                    </div>
                  </div>

                  {/* cards */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      minHeight: 56,
                      padding: isOver ? 6 : 0,
                      borderRadius: 12,
                      border: isOver ? "1px dashed var(--accent)" : "1px solid transparent",
                      background: isOver ? "var(--accent-soft)" : "transparent",
                      transition: "background var(--t), border-color var(--t)",
                    }}
                  >
                    {stageLeads.length === 0 && !isOver ? (
                      <div
                        style={{
                          padding: "16px 12px",
                          border: "1px dashed var(--line)",
                          borderRadius: 10,
                          fontSize: 11,
                          color: "var(--text-4)",
                          textAlign: "center",
                        }}
                      >
                        Empty
                      </div>
                    ) : (
                      stageLeads.map((l) => (
                        <LeadCard
                          key={l.id}
                          lead={l}
                          money={s.money}
                          dragging={dragId === l.id}
                          onDragStart={() => setDragId(l.id)}
                          onDragEnd={() => setDragId(null)}
                          onMove={(toStage) => moveLead(l.id, toStage)}
                          onOpen={() => setActiveLeadId(l.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        {!loading && leads.length > 0 && view === "table" && (
          <div
            className="surface"
            style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", textAlign: "left" }}>
                  <Th>Lead</Th>
                  <Th>Stage</Th>
                  <Th>Next action</Th>
                  <Th>Attempts</Th>
                  <Th>Last call</Th>
                  <Th>Activity</Th>
                  <Th align="right">MRR</Th>
                </tr>
              </thead>
              <tbody>
                {[...leads]
                  .sort(
                    (a, b) =>
                      CRM_STAGES.findIndex((s) => s.id === a.stage) -
                      CRM_STAGES.findIndex((s) => s.id === b.stage)
                  )
                  .map((l) => {
                    return (
                      <tr
                        key={l.id}
                        style={{ borderTop: "1px solid var(--line)" }}
                      >
                        <Td>
                          <button
                            onClick={() => setActiveLeadId(l.id)}
                            style={{
                              color: "var(--text)",
                              fontWeight: 600,
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {l.name}
                          </button>
                          <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 2 }}>
                            {[l.city, l.industry].filter(Boolean).join(" · ")}
                          </div>
                        </Td>
                        <Td>
                          <StageSelect
                            value={l.stage}
                            onChange={(toStage) => moveLead(l.id, toStage)}
                          />
                        </Td>
                        <Td muted>
                          <InlineText
                            value={l.nextAction ?? ""}
                            placeholder="—"
                            onCommit={(v) =>
                              patchField(l.id, { nextAction: v || null }, { nextAction: v || null })
                            }
                          />
                        </Td>
                        <Td muted>{l.attemptCount}</Td>
                        <Td muted>
                          {l.lastCall
                            ? l.lastCall.disposition.replace(/_/g, " ").toLowerCase()
                            : "—"}
                        </Td>
                        <Td muted>{relDate(l.lastActivityAt)}</Td>
                        <Td align="right">
                          {l.monthlyValue > 0 ? (
                            <span className="lg-mono tnum" style={{ color: "var(--money)" }}>
                              ${l.monthlyValue.toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-4)" }}>—</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeLead && (
        <CrmLeadModal
          lead={activeLead}
          onClose={() => setActiveLeadId(null)}
          onStageChange={(toStage) => moveLead(activeLead.id, toStage)}
          onGenerate={() => {
            router.push(`/businesses/${activeLead.id}?generate=assets`);
          }}
        />
      )}
    </>
  );
}

function LeadCard({
  lead,
  money,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  lead: CrmLead;
  money?: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (toStage: CrmStageId) => void;
  onOpen: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="surface hover-lift"
      style={{
        padding: "12px 14px",
        cursor: "grab",
        opacity: dragging ? 0.85 : 1,
        transform: dragging ? "rotate(-1.5deg) scale(1.02)" : "none",
        transition: "transform 0.18s cubic-bezier(0.2,0.7,0.3,1), opacity 0.18s, background var(--t)",
      }}
    >
      <div
        className="lg-display"
        style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--text)" }}
      >
        {lead.name}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>
        {[lead.city, lead.industry].filter(Boolean).join(" · ") || "—"}
      </div>
      {lead.nextAction && (
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8 }}>
          {lead.nextAction}
        </div>
      )}
      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        {lead.phone ? (
          <span className="flex items-center" style={{ gap: 4, fontSize: 11, color: "var(--text-4)" }}>
            <Phone size={10} strokeWidth={1.9} />
            {lead.attemptCount > 0 ? `${lead.attemptCount} att.` : "Not called"}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-4)" }}>No phone</span>
        )}
        {money && lead.monthlyValue > 0 && (
          <span className="lg-mono tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--money)" }}>
            ${lead.monthlyValue.toLocaleString()}
          </span>
        )}
      </div>
      {/* re-stage without dragging */}
      <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
        <StageSelect value={lead.stage} onChange={onMove} />
      </div>
    </div>
  );
}

// Lead detail popup — opens when a CRM card/row is clicked (replaces the old
// full-page navigation). Shows the lead's snapshot + quick actions, and lets the
// operator re-stage or jump straight into asset generation.
function CrmLeadModal({
  lead,
  onClose,
  onStageChange,
  onGenerate,
}: {
  lead: CrmLead;
  onClose: () => void;
  onStageChange: (toStage: CrmStageId) => void;
  onGenerate: () => void;
}) {
  const score = opportunityScore(lead.rating ?? 0, lead.reviewCount ?? 0, Boolean(lead.website));
  const gaps = gapsFor(lead.rating ?? 0, lead.reviewCount ?? 0, Boolean(lead.website));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [lead.name, lead.city].filter(Boolean).join(" ")
  )}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "lg-fade-up 0.14s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{
          width: "100%",
          maxWidth: 540,
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
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", paddingRight: 40 }}
          >
            {lead.name}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>
            {[lead.city, lead.industry].filter(Boolean).join(" · ") || "—"}
          </div>

          <div
            className="flex items-center"
            style={{ gap: 10, marginTop: 10, fontSize: 13, color: "var(--text-2)" }}
          >
            {(lead.rating ?? 0) > 0 && (
              <span className="flex items-center" style={{ gap: 5 }}>
                <Star size={13} strokeWidth={1.7} style={{ fill: "var(--money)", color: "var(--money)" }} />
                {lead.rating?.toFixed(1)}
              </span>
            )}
            {(lead.reviewCount ?? 0) > 0 && (
              <>
                <span style={{ color: "var(--text-4)" }}>·</span>
                <span>{lead.reviewCount} reviews</span>
              </>
            )}
          </div>

          <div className="flex" style={{ gap: 12, marginTop: 18 }}>
            <div className="surface" style={{ flex: 1, padding: "12px 14px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                Opportunity score
              </div>
              <div
                className="lg-display tnum"
                style={{ fontSize: 22, fontWeight: 680, letterSpacing: "-0.02em", color: "var(--text)" }}
              >
                {score}
              </div>
            </div>
            <div className="surface" style={{ flex: 1, padding: "12px 14px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                Attempts
              </div>
              <div
                className="lg-display tnum"
                style={{ fontSize: 22, fontWeight: 680, letterSpacing: "-0.02em", color: "var(--text)" }}
              >
                {lead.attemptCount}
              </div>
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: 2, marginTop: 18 }}>
            <DetailRow icon={<MapPin size={14} strokeWidth={1.6} />} href={mapsUrl} text={lead.city || "View on Google Maps"} external />
            {lead.phone && (
              <DetailRow icon={<Phone size={14} strokeWidth={1.6} />} href={`tel:${lead.phone}`} text={lead.phone} />
            )}
            {lead.website && (
              <DetailRow
                icon={<Globe size={14} strokeWidth={1.6} />}
                href={lead.website}
                text={lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                external
              />
            )}
          </div>

          {lead.nextAction && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              <span style={{ color: "var(--text-3)" }}>Next · </span>
              {lead.nextAction}
            </div>
          )}
          {lead.lastCall && (
            <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--text-3)" }}>
              Last call: {lead.lastCall.disposition.replace(/_/g, " ").toLowerCase()} · {relDate(lead.lastCall.calledAt)}
              {lead.lastCall.note ? ` — ${lead.lastCall.note}` : ""}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>
              Likely funnel gaps
            </div>
            <div className="flex" style={{ flexWrap: "wrap", gap: 6 }}>
              {gaps.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>
              Stage
            </div>
            <StageSelect value={lead.stage} onChange={onStageChange} />
          </div>

          <div
            className="flex items-center"
            style={{ gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}
          >
            {["BOOKED_ZOOM", "ZOOM_NO_SHOW", "ZOOM_OPEN"].includes(lead.status) && (
              <a href={`/call/${lead.id}`} style={{ textDecoration: "none" }}>
                <LgButton variant="primary" size="md">
                  <Video size={14} strokeWidth={1.7} /> Start Zoom
                </LgButton>
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`} style={{ textDecoration: "none" }}>
                <LgButton variant="secondary" size="md">
                  <Phone size={14} strokeWidth={1.7} /> Call
                </LgButton>
              </a>
            )}
            <LgButton
              variant={
                ["BOOKED_ZOOM", "ZOOM_NO_SHOW", "ZOOM_OPEN"].includes(lead.status)
                  ? "secondary"
                  : "primary"
              }
              size="md"
              onClick={onGenerate}
            >
              <Sparkles size={14} strokeWidth={1.7} /> Generate asset pack
            </LgButton>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
              style={{ gap: 6, marginLeft: "auto", fontSize: 12.5, color: "var(--text-3)", textDecoration: "none" }}
            >
              Google Maps <ExternalLink size={12} strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// A single icon + label row inside the lead modal. Renders as a link when a
// destination is supplied, else as plain text.
function DetailRow({
  icon,
  text,
  href,
  external,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center" style={{ gap: 10, padding: "7px 0", fontSize: 13, color: "var(--text-2)" }}>
      <span style={{ color: "var(--text-4)", flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
  if (!href) return inner;
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {inner}
    </a>
  );
}

// Inline stage picker — a styled native <select> so a lead can be re-staged from
// the table without dragging. Writes through moveLead (status mapping + persist).
function StageSelect({
  value,
  onChange,
}: {
  value: CrmStageId;
  onChange: (toStage: CrmStageId) => void;
}) {
  const stage = CRM_STAGES.find((s) => s.id === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CrmStageId)}
      onClick={(e) => e.stopPropagation()}
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "inherit",
        padding: "3px 24px 3px 10px",
        borderRadius: 999,
        color: toneColor(stage?.tone ?? "neutral"),
        background: "var(--surface-hi)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        appearance: "none",
        outline: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
      }}
    >
      {CRM_STAGES.map((s) => (
        <option key={s.id} value={s.id} style={{ color: "var(--text)", background: "var(--surface)" }}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

// Inline editable text cell — click to edit, commits on blur/Enter, Escape cancels.
function InlineText({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Click to edit"
        style={{
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: 6,
          padding: "3px 7px",
          margin: "-3px -7px",
          textAlign: "left",
          font: "inherit",
          color: value ? "var(--text-3)" : "var(--text-4)",
          cursor: "text",
          width: "100%",
          transition: "background var(--t), border-color var(--t)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.borderColor = "var(--line)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        {value || placeholder || "—"}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
  };
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      placeholder={placeholder}
      style={{
        font: "inherit",
        color: "var(--text)",
        background: "var(--bg-deep, #0b0d12)",
        border: "1px solid var(--accent)",
        borderRadius: 6,
        padding: "3px 7px",
        margin: "-3px -7px",
        width: "100%",
        outline: "none",
      }}
    />
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 7,
        padding: "7px 13px",
        fontSize: 12.5,
        fontWeight: 600,
        color: active ? "var(--text)" : "var(--text-3)",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: `1px solid ${active ? "var(--line-strong)" : "transparent"}`,
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--t), background var(--t)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        padding: "11px 16px",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-4)",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  muted,
  align,
}: {
  children: React.ReactNode;
  muted?: boolean;
  align?: "right";
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        color: muted ? "var(--text-3)" : "var(--text-2)",
        textAlign: align ?? "left",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
