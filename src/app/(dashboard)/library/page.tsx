"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { SavedBusinessCard } from "@/components/businesses/SavedBusinessCard";
import type { SavedBusiness } from "@/types";
import {
  Search,
  Library as LibraryIcon,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  FileText,
  Activity,
  Network,
  CalendarRange,
  Stethoscope,
  ScrollText,
  Plus,
  Link as LinkIcon,
  Layers,
  Loader2,
  Eye,
} from "lucide-react";

type LibraryMode = "workspaces" | "saved";

// ── Types mirroring /api/assets/library ───────────────────────────────────────

interface ProposalRow {
  id: string;
  title: string;
  status: string;
  publicId: string;
  setupFee: number;
  monthlyPrice: number;
  createdAt: string;
}

interface AuditRow {
  id: string;
  publicId: string;
  createdAt: string;
}

interface LibraryItem {
  id: string;
  businessId: string;
  hasPack: boolean;
  packDate: string | null;
  lastActivity: string;
  createdAt: string;
  business: {
    id: string;
    name: string;
    city: string | null;
    industry: string | null;
    category: string | null;
    website: string | null;
    photoUrl: string | null;
  };
  audits: AuditRow[];
  proposals: ProposalRow[];
}

// The four flagship deliverables, rendered from a single asset pack. Kept local
// so the Library page doesn't pull the full HTML renderer into the client bundle.
const DELIVERABLE_META: {
  id: "d1" | "d2" | "d3" | "d4";
  label: string;
  short: string;
  icon: typeof Activity;
}[] = [
  { id: "d1", label: "Growth Leak Intelligence Report", short: "Diagnosis", icon: Activity },
  { id: "d2", label: "Client Acquisition Infrastructure", short: "Architecture", icon: Network },
  { id: "d3", label: "Conversion Asset Pack", short: "Assets", icon: FileText },
  { id: "d4", label: "Implementation & Optimization Timeline", short: "Execution", icon: CalendarRange },
];

function nicheKey(item: LibraryItem): string {
  return (item.business.industry ?? item.business.category ?? "").toLowerCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Proposal status → accent color. Mirrors the lifecycle: draft → sent → viewed →
// accepted / rejected.
function statusColor(status: string): { fg: string; bg: string } {
  switch (status.toUpperCase()) {
    case "ACCEPTED":
      return { fg: "var(--money)", bg: "rgba(74,222,128,0.10)" };
    case "SENT":
      return { fg: "var(--accent)", bg: "var(--accent-soft)" };
    case "VIEWED":
      return { fg: "oklch(0.82 0.14 85)", bg: "rgba(234,179,8,0.10)" };
    case "REJECTED":
      return { fg: "var(--danger, #f87171)", bg: "rgba(248,113,113,0.10)" };
    default:
      return { fg: "var(--text-3)", bg: "rgba(255,255,255,0.05)" };
  }
}

// ── Small section primitives ──────────────────────────────────────────────────

function SectionHead({
  icon: Icon,
  label,
  count,
  action,
}: {
  icon: typeof Activity;
  label: string;
  count: number;
  action: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} strokeWidth={1.9} style={{ color: "var(--text-3)" }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          {label}
        </span>
        <span
          className="lg-mono tnum"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-3)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "1px 7px",
          }}
        >
          {count}
        </span>
      </div>
      {action}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        border: "1px dashed var(--line)",
        borderRadius: 10,
        fontSize: 12,
        color: "var(--text-subtle)",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

// Hover-lift row link used across the three sections.
function rowHover(e: React.MouseEvent, on: boolean) {
  const el = e.currentTarget as HTMLElement;
  el.style.borderColor = on ? "var(--line-strong)" : "var(--line)";
  el.style.background = on ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)";
}

// ── Inline generation UI ──────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

// Simulated cold-audit stages — the endpoint is a single POST, so we walk these
// on a timer and snap to 100% on resolve (mirrors Studio's cold-audit progress).
const AUDIT_STAGES = [
  "Measuring live site speed",
  "Reading their pages",
  "Pulling recent reviews",
  "Finding the most expensive leaks",
  "Writing the cold-open audit",
];

// Compact in-place progress shown inside a column while it generates. Numeric
// `pct` drives the bar for the streamed asset pack; when omitted the bar pulses
// as an indeterminate "working" state (proposal generation isn't streamed).
function InlineProgress({ label, pct }: { label: string; pct?: number }) {
  return (
    <div
      style={{
        padding: "13px 12px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Loader2
          size={13}
          strokeWidth={2.4}
          style={{ color: "var(--accent)", animation: "lg-spin 0.7s linear infinite", flex: "none" }}
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: pct != null ? `${Math.max(6, Math.min(100, pct))}%` : "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--accent), oklch(0.62 0.20 286))",
            transition: "width .4s cubic-bezier(0.32,0.72,0,1)",
            animation: pct != null ? undefined : "lg-pulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// Button twin of MiniAction (same look) that runs an in-place generator.
function MiniButton({
  onClick,
  icon: Icon,
  label,
  busy,
}: {
  onClick: () => void;
  icon: typeof Plus;
  label: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        color: busy ? "var(--text-2)" : "var(--text-3)",
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 7,
        padding: "4px 9px",
        cursor: busy ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "color 140ms ease, border-color 140ms ease, background 140ms ease",
      }}
      onMouseEnter={(e) => {
        if (busy) return;
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = busy ? "var(--text-2)" : "var(--text-3)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {busy ? (
        <Loader2 size={12} strokeWidth={2.4} style={{ animation: "lg-spin 0.7s linear infinite" }} />
      ) : (
        <Icon size={12} strokeWidth={2} />
      )}
      {label}
    </button>
  );
}

// ── Per-business control panel ────────────────────────────────────────────────

function BusinessPanel({
  item,
  onChange,
}: {
  item: LibraryItem;
  onChange: (next: LibraryItem) => void;
}) {
  const b = item.business;
  const niche = b.industry ?? b.category ?? "—";
  const studioBase = `/studio?businessId=${b.id}`;

  // Per-column generation state. Each generator runs IN PLACE and, on success,
  // patches this business's item so the new artifact appears without a reload.
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState<{ pct: number; label: string } | null>(null);
  const [packRunning, setPackRunning] = useState(false);
  const [packProgress, setPackProgress] = useState<{ pct: number; label: string } | null>(null);
  const [proposalRunning, setProposalRunning] = useState(false);
  const auditTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (auditTimer.current) clearInterval(auditTimer.current);
    },
    []
  );

  // Cold audit — single POST, simulated staged progress.
  const runAudit = async () => {
    if (auditRunning) return;
    setAuditRunning(true);
    let step = 0;
    setAuditProgress({ pct: 8, label: AUDIT_STAGES[0] });
    if (auditTimer.current) clearInterval(auditTimer.current);
    auditTimer.current = setInterval(() => {
      step = Math.min(step + 1, AUDIT_STAGES.length - 1);
      setAuditProgress({
        pct: Math.min(90, 8 + (step / (AUDIT_STAGES.length - 1)) * 82),
        label: AUDIT_STAGES[step],
      });
    }, 3500);
    const stop = () => {
      if (auditTimer.current) {
        clearInterval(auditTimer.current);
        auditTimer.current = null;
      }
    };
    try {
      const res = await fetch("/api/generate/cold-audit", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ businessId: b.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to generate cold audit");
        return;
      }
      onChange({
        ...item,
        audits: [
          {
            id: data.system.id,
            publicId: data.system.publicId,
            createdAt: data.system.createdAt ?? new Date().toISOString(),
          },
          ...item.audits,
        ],
        lastActivity: new Date().toISOString(),
      });
      toast.success("Cold audit ready");
    } catch {
      toast.error("Failed to generate cold audit");
    } finally {
      stop();
      setAuditRunning(false);
      setAuditProgress(null);
    }
  };

  // Asset pack — NDJSON stream of progress, then auto-save to the Library.
  const runPack = async () => {
    if (packRunning) return;
    setPackRunning(true);
    setPackProgress({ pct: 4, label: "Gathering live site & market data" });
    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ businessId: b.id }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to generate deliverables");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fresh: unknown = null;
      let streamError: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let msg: {
            type: string;
            completed?: number;
            total?: number;
            label?: string;
            error?: string;
            assetPack?: unknown;
          };
          try {
            msg = JSON.parse(t);
          } catch {
            continue;
          }
          if (msg.type === "progress") {
            const total = msg.total ?? 10;
            setPackProgress({
              pct: Math.max(4, Math.round(((msg.completed ?? 0) / total) * 100)),
              label: msg.label ?? "",
            });
          } else if (msg.type === "error") {
            streamError = msg.error ?? "Failed to generate deliverables";
          } else if (msg.type === "done") {
            fresh = msg.assetPack ?? null;
          }
        }
      }
      if (streamError || !fresh) {
        toast.error(streamError || "Failed to generate deliverables");
        return;
      }
      setPackProgress({ pct: 96, label: "Saving to library" });
      const saveRes = await fetch("/api/assets/save", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ businessId: b.id, assetPack: fresh }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        toast.error(saveData.error || "Generated, but failed to save");
        return;
      }
      onChange({
        ...item,
        hasPack: true,
        packDate: saveData.savedAt ?? new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });
      toast.success("Deliverables generated & saved");
    } catch {
      toast.error("Failed to generate deliverables");
    } finally {
      setPackRunning(false);
      setPackProgress(null);
    }
  };

  // Proposal — one-shot: generate audit-grounded content, then persist a row.
  const runProposal = async () => {
    if (proposalRunning) return;
    setProposalRunning(true);
    try {
      const genRes = await fetch("/api/generate/proposal", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ businessId: b.id }),
      });
      const genData = await genRes.json().catch(() => ({}));
      if (!genRes.ok) {
        toast.error(genData.error || "Failed to generate proposal");
        return;
      }
      const saveRes = await fetch("/api/proposals", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ businessId: b.id, ...genData.proposalData }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        toast.error(saveData.error || "Failed to save proposal");
        return;
      }
      const p = saveData.proposal;
      onChange({
        ...item,
        proposals: [
          {
            id: p.id,
            title: p.title,
            status: p.status,
            publicId: p.publicId,
            setupFee: p.setupFee,
            monthlyPrice: p.monthlyPrice,
            createdAt: p.createdAt,
          },
          ...item.proposals,
        ],
        lastActivity: new Date().toISOString(),
      });
      toast.success("Proposal generated");
    } catch {
      toast.error("Failed to generate proposal");
    } finally {
      setProposalRunning(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      {/* Panel header — identity + primary action */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: "20px 22px",
          borderBottom: "1px solid var(--line)",
          background: "rgba(255,255,255,0.012)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h3
              className="lg-display"
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              {b.name}
            </h3>
            {b.website && (
              <a
                href={b.website}
                target="_blank"
                rel="noopener noreferrer"
                title={b.website}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11.5,
                  color: "var(--text-3)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={12} strokeWidth={1.8} />
                Site
              </a>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 6 }}>
            {b.city ? `${b.city} · ` : ""}
            <span style={{ textTransform: "capitalize" }}>{niche}</span>
            <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
            <span className="lg-mono tnum">Updated {fmtDate(item.lastActivity)}</span>
          </div>
        </div>
        <Link
          href={item.hasPack ? `${studioBase}&restore=pack` : studioBase}
          style={{
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
            color: "var(--text)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--radius)",
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), var(--shadow-sm)",
          }}
        >
          Open workspace
          <ArrowUpRight size={14} strokeWidth={2} />
        </Link>
      </div>

      {/* Three-column work surface */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 0,
        }}
      >
        {/* Proposals */}
        <section
          style={{
            padding: "18px 20px",
            borderRight: "1px solid var(--line)",
          }}
        >
          <SectionHead
            icon={ScrollText}
            label="Proposals"
            count={item.proposals.length}
            action={
              <MiniButton
                onClick={runProposal}
                icon={Plus}
                label={item.proposals.length ? "New" : "Generate"}
                busy={proposalRunning}
              />
            }
          />
          {proposalRunning && (
            <div style={{ marginBottom: item.proposals.length ? 8 : 0 }}>
              <InlineProgress label="Generating proposal…" />
            </div>
          )}
          {item.proposals.length === 0 ? (
            proposalRunning ? null : <EmptyRow text="No proposals yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {item.proposals.map((p) => {
                const sc = statusColor(p.status);
                return (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.015)",
                      transition: "border-color 140ms ease, background 140ms ease",
                    }}
                    onMouseEnter={(e) => rowHover(e, true)}
                    onMouseLeave={(e) => rowHover(e, false)}
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.title}
                        </span>
                        <span
                          style={{
                            flex: "none",
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: sc.fg,
                            background: sc.bg,
                            borderRadius: 999,
                            padding: "2px 7px",
                          }}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 7,
                        }}
                      >
                        <span
                          className="lg-mono tnum"
                          style={{ fontSize: 11.5, color: "var(--money)", fontWeight: 600 }}
                        >
                          {money(p.setupFee)}
                          <span style={{ color: "var(--text-3)", fontWeight: 500 }}>
                            {" "}
                            + {money(p.monthlyPrice)}/mo
                          </span>
                        </span>
                        <span
                          className="lg-mono tnum"
                          style={{ fontSize: 10.5, color: "var(--text-subtle)" }}
                        >
                          {fmtDate(p.createdAt)}
                        </span>
                      </div>
                    </Link>
                    <div
                      style={{
                        borderTop: "1px solid var(--line)",
                        padding: "6px 12px",
                      }}
                    >
                      <a
                        href={`/p/${p.publicId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-3)",
                          textDecoration: "none",
                        }}
                      >
                        <LinkIcon size={11} strokeWidth={2} />
                        Public link
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deliverables (D1–D4) */}
        <section
          style={{
            padding: "18px 20px",
            borderRight: "1px solid var(--line)",
          }}
        >
          <SectionHead
            icon={Layers}
            label="Deliverables"
            count={item.hasPack ? 4 : 0}
            action={
              <MiniButton
                onClick={runPack}
                icon={item.hasPack ? Sparkles : Plus}
                label={item.hasPack ? "Regenerate" : "Generate"}
                busy={packRunning}
              />
            }
          />
          {packRunning ? (
            <InlineProgress
              label={packProgress?.label || "Generating deliverables…"}
              pct={packProgress?.pct}
            />
          ) : !item.hasPack ? (
            <EmptyRow text="No asset pack generated yet." />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DELIVERABLE_META.map((d, i) => {
                  const Icon = d.icon;
                  return (
                    <Link
                      key={d.id}
                      href={`${studioBase}&restore=pack&deliverable=${d.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 11px",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.015)",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "border-color 140ms ease, background 140ms ease",
                      }}
                      onMouseEnter={(e) => rowHover(e, true)}
                      onMouseLeave={(e) => rowHover(e, false)}
                    >
                      <span
                        style={{
                          flex: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        <Icon size={14} strokeWidth={1.9} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            className="lg-mono"
                            style={{ color: "var(--text-3)", marginRight: 6 }}
                          >
                            D{i + 1}
                          </span>
                          {d.label}
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--text-subtle)" }}>
                          {d.short}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              {item.packDate && (
                <div
                  className="lg-mono tnum"
                  style={{ fontSize: 10.5, color: "var(--text-subtle)", marginTop: 10 }}
                >
                  Pack generated {fmtDate(item.packDate)}
                </div>
              )}
            </>
          )}
        </section>

        {/* Cold Audits */}
        <section style={{ padding: "18px 20px" }}>
          <SectionHead
            icon={Stethoscope}
            label="Cold Audits"
            count={item.audits.length}
            action={
              <MiniButton
                onClick={runAudit}
                icon={Plus}
                label={item.audits.length ? "Run" : "Generate"}
                busy={auditRunning}
              />
            }
          />
          {auditRunning && (
            <div style={{ marginBottom: item.audits.length ? 8 : 0 }}>
              <InlineProgress
                label={auditProgress?.label || "Running cold audit…"}
                pct={auditProgress?.pct}
              />
            </div>
          )}
          {item.audits.length === 0 ? (
            auditRunning ? null : <EmptyRow text="No cold audits yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {item.audits.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.015)",
                    transition: "border-color 140ms ease, background 140ms ease",
                  }}
                  onMouseEnter={(e) => rowHover(e, true)}
                  onMouseLeave={(e) => rowHover(e, false)}
                >
                  <Link
                    href={`${studioBase}&view=audit`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "10px 12px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <Stethoscope
                        size={14}
                        strokeWidth={1.8}
                        style={{ color: "var(--text-3)", flex: "none" }}
                      />
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        Cold audit
                        {i === 0 && (
                          <span
                            style={{
                              marginLeft: 7,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--money)",
                              background: "rgba(74,222,128,0.10)",
                              borderRadius: 999,
                              padding: "1px 6px",
                            }}
                          >
                            Latest
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className="lg-mono tnum"
                      style={{ fontSize: 10.5, color: "var(--text-subtle)", flex: "none" }}
                    >
                      {fmtDate(a.createdAt)}
                    </span>
                  </Link>
                  <div style={{ borderTop: "1px solid var(--line)", padding: "6px 12px" }}>
                    <a
                      href={`/a/${a.publicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-3)",
                        textDecoration: "none",
                      }}
                    >
                      <Eye size={11} strokeWidth={2} />
                      View public teaser
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState<string>("all");
  const [mode, setMode] = useState<LibraryMode>("workspaces");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The two halves of "your businesses": those with work (workspaces) and
        // the full saved list (includes bare bookmarks the workspaces view omits).
        const [libRes, bizRes] = await Promise.all([
          fetch("/api/assets/library", { cache: "no-store" }),
          fetch("/api/businesses", { cache: "no-store" }),
        ]);
        if (!libRes.ok) throw new Error(`Failed (${libRes.status})`);
        const data = (await libRes.json()) as { items: LibraryItem[] };
        if (!cancelled) setItems(data.items ?? []);
        if (bizRes.ok) {
          const bizData = (await bizRes.json()) as { businesses: SavedBusiness[] };
          if (!cancelled) setSaved(bizData.businesses ?? []);
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
  }, []);

  // Per-business pack info (hasPack + date) keyed by id, from the workspaces
  // fetch — lets the Saved cards show the same "Asset pack" badge/date.
  const packInfo = useMemo(() => {
    const map: Record<string, { hasPack: boolean; date: string }> = {};
    items.forEach((i) => {
      map[i.businessId] = { hasPack: i.hasPack, date: i.packDate ?? i.createdAt };
    });
    return map;
  }, [items]);

  const savedNicheKey = (b: SavedBusiness): string =>
    (b.industry ?? b.category ?? "").toLowerCase();

  const niches = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const k = nicheKey(i);
      if (k) set.add(k);
    });
    saved.forEach((b) => {
      const k = savedNicheKey(b);
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  }, [items, saved]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, i) => {
        acc.proposals += i.proposals.length;
        acc.audits += i.audits.length;
        acc.packs += i.hasPack ? 1 : 0;
        return acc;
      },
      { proposals: 0, audits: 0, packs: 0 }
    );
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (niche !== "all" && nicheKey(i) !== niche) return false;
      if (!term) return true;
      const hay = [
        i.business.name,
        i.business.city ?? "",
        i.business.industry ?? "",
        i.business.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [items, q, niche]);

  const filteredSaved = useMemo(() => {
    const term = q.trim().toLowerCase();
    return saved
      .filter((b) => {
        if (niche !== "all" && savedNicheKey(b) !== niche) return false;
        if (!term) return true;
        const hay = [b.name, b.city ?? "", b.industry ?? "", b.category ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [saved, q, niche]);

  return (
    <>
      <TopBar title="Control Centre" subtitle="Every business, every asset" />
      <div style={{ width: "100%", padding: "40px 56px 80px", maxWidth: 1320, margin: "0 auto" }}>
        <div className="rise" style={{ marginBottom: 24 }}>
          <h1
            className="lg-display"
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            Control Centre
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            {loading ? (
              "Loading…"
            ) : mode === "saved" ? (
              <>
                {saved.length} saved business{saved.length === 1 ? "" : "es"}
              </>
            ) : (
              <>
                {items.length} business{items.length === 1 ? "" : "es"}
                <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                {totals.packs} asset pack{totals.packs === 1 ? "" : "s"}
                <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                {totals.proposals} proposal{totals.proposals === 1 ? "" : "s"}
                <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                {totals.audits} cold audit{totals.audits === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>

        {/* mode toggle — the full work panels vs. every saved business */}
        <div className="flex items-center" style={{ gap: 4, marginBottom: 20 }}>
          <ModeTab active={mode === "workspaces"} onClick={() => setMode("workspaces")}>
            Workspaces
          </ModeTab>
          <ModeTab active={mode === "saved"} onClick={() => setMode("saved")}>
            Saved
          </ModeTab>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 480 }}>
            <Search
              size={14}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-3)",
              }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by business, city, industry…"
              style={{
                width: "100%",
                padding: "10px 14px 10px 34px",
                background: "var(--bg-deep)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 13.5,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            style={{
              padding: "10px 12px",
              background: "var(--bg-deep)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--text)",
              fontSize: 13.5,
              fontFamily: "inherit",
              outline: "none",
              minWidth: 180,
            }}
          >
            <option value="all">All niches</option>
            {niches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 220,
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                  backgroundSize: "200% 100%",
                  animation: "lg-shimmer 1.4s ease-in-out infinite",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                }}
              />
            ))}
            <style>{`@keyframes lg-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 20,
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--text-2)",
              fontSize: 13.5,
            }}
          >
            Couldn&apos;t load control centre: {error}
          </div>
        )}

        {mode === "workspaces" && !loading && !error && filtered.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              border: "1px dashed var(--line)",
              borderRadius: 14,
              textAlign: "center",
              color: "var(--text-2)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <LibraryIcon size={20} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {items.length === 0 ? "No saved businesses yet" : "No matches"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
              {items.length === 0
                ? "Save a business from Find opportunities and it'll appear here."
                : "Try a different search term or niche filter."}
            </div>
            {items.length === 0 && (
              <Link
                href="/businesses"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 18,
                  padding: "9px 16px",
                  background: "var(--text)",
                  color: "var(--bg-deep)",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Sparkles size={13} strokeWidth={2} /> Find opportunities
              </Link>
            )}
          </div>
        )}

        {mode === "workspaces" && !loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {filtered.map((item) => (
              <BusinessPanel
                key={item.id}
                item={item}
                onChange={(next) =>
                  setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)))
                }
              />
            ))}
          </div>
        )}

        {/* Saved — every saved business, including bare bookmarks with no work yet */}
        {mode === "saved" && !loading && !error && filteredSaved.length > 0 && (
          <div
            className="rise"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {filteredSaved.map((b) => {
              const info = packInfo[b.id];
              return (
                <SavedBusinessCard
                  key={b.id}
                  item={{
                    businessId: b.id,
                    name: b.name,
                    city: b.city,
                    niche: b.industry ?? b.category,
                    hasPack: info?.hasPack ?? false,
                    date: info?.date ?? b.createdAt,
                  }}
                />
              );
            })}
          </div>
        )}

        {mode === "saved" && !loading && !error && filteredSaved.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              border: "1px dashed var(--line)",
              borderRadius: 14,
              textAlign: "center",
              color: "var(--text-2)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <LibraryIcon size={20} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {saved.length === 0 ? "No saved businesses yet" : "No matches"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
              {saved.length === 0
                ? "Search Google Places on Opportunities and save a business — it'll appear here."
                : "Try a different search term or niche filter."}
            </div>
            {saved.length === 0 && (
              <Link
                href="/businesses"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 18,
                  padding: "9px 16px",
                  background: "var(--text)",
                  color: "var(--bg-deep)",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Sparkles size={13} strokeWidth={2} /> Find opportunities
              </Link>
            )}
          </div>
        )}
      </div>
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
