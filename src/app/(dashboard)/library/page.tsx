"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { SavedBusinessCard } from "@/components/businesses/SavedBusinessCard";
import type { SavedBusiness } from "@/types";
import { APP_URL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { IntakeForm, type IntakeValues } from "@/components/businesses/IntakeForm";
import { IntakeGaps } from "@/components/businesses/IntakeGaps";
import { WorkflowPanel } from "@/components/businesses/WorkflowPanel";
import {
  PackGateDialog,
  parsePackGateFailure,
  type PackGateBoundary,
  type PackGateFailure,
  type PackOverridePayload,
} from "@/components/businesses/PackOverrideDialog";
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
  SlidersHorizontal,
  Check,
  ChevronRight,
  ChevronDown,
  Workflow,
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
    avgClientValueCad: number | null;
    monthlyLeadVolume: number | null;
    hasCrm: boolean | null;
    hasFollowUpSequence: boolean | null;
    hasReminderSystem: boolean | null;
    hasPastCustomerDatabase: boolean | null;
    servicesFocus: string | null;
    bookingMethod: string | null;
    bookingToolName: string | null;
    gbpManagement: string | null;
    buildPriorities: string | null;
    // /api/assets/library DOES select these five now (the comment that said it
    // didn't was stale). They stay optional as a tolerance, not as a description:
    // a feed that stopped sending one would render it blank rather than break the
    // build, and the form only PATCHes fields the operator actually changed, so a
    // blank it never showed a value for can't overwrite what's in the database.
    // The "still guessed" panel above reads the columns server-side either way, so
    // it stays right even if this feed ever thins out.
    hasCallTracking?: boolean | null;
    hasOnlinePayment?: boolean | null;
    afterHoursHandling?: string | null;
    missedCallHandling?: string | null;
    responseSpeed?: string | null;
    // THE TWO BUILD-BEARING ANSWERS. Same tolerance as the five above, and named
    // here because they are the only intake answers that change what gets BUILT
    // rather than only what a document says: "NO_ACCOUNTS" drops Social DM Capture
    // and a `false` past-customer list drops Database Reactivation.
    //
    // /api/assets/library does not select them today, which is safe but not ideal.
    // Safe because the build panel resolves them server-side off the row itself,
    // and because the intake form only PATCHes answers the operator actually
    // changed — a question it was handed nothing for computes to "not asked" on
    // both sides of the diff, so it is never written. Not ideal because an answer
    // already on file shows blank in the Library's intake editor, which invites
    // him to answer it a second time. The fix is one line in that route's select,
    // and these two are declared here so it becomes a one-file change.
    socialEnquiries?: string | null;
    pastCustomerContact?: string | null;
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

// The two affordances under a saved cold audit — an anchor and a button that
// have to read as siblings, so they share one style object.
const teaserActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-3)",
  textDecoration: "none",
};

// Copies the ABSOLUTE public teaser URL. The "View" anchor beside this can stay
// relative because the browser resolves it; a link pasted into the pre-call
// email cannot, so it goes out with the configured host on the front.
function copyTeaserLink(publicId: string) {
  navigator.clipboard
    .writeText(`${APP_URL}/a/${publicId}`)
    .then(() => toast.success("Teaser link copied — this is what the prospect sees"))
    .catch(() => toast.error("Couldn't copy"));
}

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

// Money on this page goes through formatCurrency (lib/utils) — the one formatter
// for the whole product. There used to be a local helper here that printed a
// US-formatted "$6,500", so a saved proposal row read "$6,500 + $1,000/mo" with
// no currency on it at all, while the audit beside it read "CAD $1,290". The
// prices are Canadian and the marker goes BEFORE the figure; keeping a second
// formatter in this file is what let the two drift apart in the first place.
// (formatCurrency rounds to whole dollars, same as the helper it replaced.)

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
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
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
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {action}
      </div>
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
            background: "var(--accent-grad)",
            transition: "width .4s cubic-bezier(0.32,0.72,0,1)",
            animation: pct != null ? undefined : "lg-pulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// Button twin of MiniAction (same look) that runs an in-place generator.
// Pass no `label` for an icon-only button (used for secondary actions that need
// to stay compact so a header's actions fit on one line).
function MiniButton({
  onClick,
  icon: Icon,
  label,
  title,
  busy,
}: {
  onClick: () => void;
  icon: typeof Plus;
  label?: string;
  title?: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title ?? label}
      aria-label={title ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: label ? 5 : 0,
        fontSize: 11.5,
        fontWeight: 600,
        color: busy ? "var(--text-2)" : "var(--text-3)",
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 7,
        padding: label ? "4px 9px" : "4px 6px",
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

// Compact count/status pill shown on a collapsed panel row.
function StatChip({
  icon: Icon,
  label,
  on,
}: {
  icon: typeof Activity;
  label: string;
  on?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: on ? "var(--text-2)" : "var(--text-subtle)",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      <Icon size={11} strokeWidth={1.9} />
      {label}
    </span>
  );
}

// ── Per-business control panel ────────────────────────────────────────────────

function BusinessPanel({
  item,
  onChange,
  autoGenerate,
}: {
  item: LibraryItem;
  onChange: (next: LibraryItem) => void;
  autoGenerate?: boolean;
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
  const [showIntake, setShowIntake] = useState(false);
  const [showBuild, setShowBuild] = useState(false);
  // Refetch token for the two panels that are COMPUTED SERVER-SIDE from the intake
  // answers and the stored research — "what's still guessed" and "what this build
  // includes". Bumped on every intake save and on anything that captures a research
  // snapshot. Neither can be adjusted optimistically: one answer can take a leak off
  // the report entirely, and a newly-measured leak can lock a workflow's switch, and
  // only a server-side re-run knows which. One token for both because they read the
  // same two inputs and go stale at exactly the same moments.
  const [intelKey, setIntelKey] = useState(0);
  // A blocked governance gate. Both gates reachable from this panel answer with
  // a multi-check report that a toast can only show one truncated line of, so it
  // is rendered in full. Save may be overridden with a written reason;
  // generation may not — a pack that fails at generation gets regenerated.
  const [gate, setGate] = useState<{
    boundary: PackGateBoundary;
    failure: PackGateFailure;
  } | null>(null);
  const [savingPack, setSavingPack] = useState(false);
  // The generated pack the save gate refused, kept so an override retry re-posts
  // the SAME bytes the operator was just shown a report for — regenerating would
  // produce a different pack and different check ids, and the handshake would
  // (correctly) reject the acknowledgement as stale.
  const pendingPackRef = useRef<unknown>(null);
  // Collapsed by default so 50 clients read as 50 scannable rows, not 50 tall
  // cards. Any in-flight work (generation or the intake editor) forces it open.
  const [expanded, setExpanded] = useState(false);
  const auditTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const open =
    expanded || packRunning || auditRunning || proposalRunning || showIntake || showBuild;

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
        // REPLACE, don't prepend. Regeneration soft-deletes the previous audit row
        // server-side and the new row inherits its publicId (F3), so prepending
        // showed two entries carrying the SAME share link until the next fetch.
        // One live audit per business is the intended post-F3 shape.
        audits: [
          {
            id: data.system.id,
            publicId: data.system.publicId,
            createdAt: data.system.createdAt ?? new Date().toISOString(),
          },
        ],
        lastActivity: new Date().toISOString(),
      });
      // A cold audit captures the research snapshot when there isn't one, so both
      // computed panels may have just gone from "nothing scanned yet" to a real
      // answer: the gaps list gets findings, and the build panel gets its locks —
      // a newly-measured leak is what disables a workflow's switch. Re-read rather
      // than leaving either stale beside a finished audit.
      setIntelKey((n) => n + 1);
      toast.success("Cold audit ready");
    } catch {
      toast.error("Failed to generate cold audit");
    } finally {
      stop();
      setAuditRunning(false);
      setAuditProgress(null);
    }
  };

  // Persist a generated pack. Split out of runPack because the save gate can
  // block it, and the override retry has to re-post that exact pack without
  // regenerating.
  const savePack = async (packToSave: unknown, override?: PackOverridePayload) => {
    setSavingPack(true);
    try {
      const saveRes = await fetch("/api/assets/save", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          businessId: b.id,
          assetPack: packToSave,
          ...(override ? { override } : {}),
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        // 422 is the governance gate: nothing was written, the pack already in
        // the Library is untouched, and the body carries every failing check
        // with the stable id an override has to echo back.
        const failure = saveRes.status === 422 ? parsePackGateFailure(saveData) : null;
        if (failure) {
          pendingPackRef.current = packToSave;
          setGate({ boundary: "save", failure });
          return;
        }
        setGate(null);
        toast.error(saveData.error || "Generated, but failed to save");
        return;
      }
      setGate(null);
      pendingPackRef.current = null;
      onChange({
        ...item,
        hasPack: true,
        packDate: saveData.savedAt ?? new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });
      // Same reason as the audit path: generating the pack is what captures the
      // research snapshot both computed panels read.
      setIntelKey((n) => n + 1);
      // The route echoes its governance block back on a forced save, so a pack
      // that entered the Library over a known violation never reports as a
      // plain success.
      if (saveData.override) {
        const n = Array.isArray(saveData.override.checks) ? saveData.override.checks.length : 0;
        toast.warning("Saved with an override on the record", {
          description: `This pack entered the Library over ${n} failing check${
            n === 1 ? "" : "s"
          }. Your reason and those checks are stored on the row — internal only.`,
          duration: 12000,
        });
      } else {
        toast.success("Deliverables generated & saved");
      }
    } catch {
      toast.error("Generated, but failed to save");
    } finally {
      setSavingPack(false);
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
      let streamFailure: PackGateFailure | null = null;
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
            // A `reason:"invalid"` frame carries every law that broke. No
            // override exists at this boundary — a pack that fails at
            // generation is regenerated, not forced — but the operator still
            // needs to read WHY, which one toast line cannot deliver.
            streamFailure = parsePackGateFailure(msg);
          } else if (msg.type === "done") {
            fresh = msg.assetPack ?? null;
          }
        }
      }
      if (streamFailure) {
        setGate({ boundary: "generate", failure: streamFailure });
        return;
      }
      if (streamError || !fresh) {
        toast.error(streamError || "Failed to generate deliverables");
        return;
      }
      setPackProgress({ pct: 96, label: "Saving to library" });
      await savePack(fresh);
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

  // Arriving from a "Generate asset pack" button (CRM modal / Opportunities card)
  // routes here as /library?businessId=…&generate=1. When that flag targets this
  // panel, open it and immediately kick off the pack — the whole point is to land
  // the operator on the running generation, not on a page they still have to click.
  // Fires once, and only when there's no pack yet (an existing pack is left alone
  // so we never silently overwrite prior work).
  const autoFired = useRef(false);
  useEffect(() => {
    if (autoGenerate && !autoFired.current) {
      autoFired.current = true;
      setExpanded(true);
      if (!item.hasPack && !packRunning) runPack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  return (
    <div
      id={`biz-${item.businessId}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      {/* Panel header — click anywhere to expand/collapse the work surface */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "13px 16px",
          borderBottom: open ? "1px solid var(--line)" : "none",
          background: "rgba(255,255,255,0.012)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          {open ? (
            <ChevronDown size={16} strokeWidth={2} style={{ color: "var(--text-3)", flex: "none" }} />
          ) : (
            <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--text-3)", flex: "none" }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <h3
                className="lg-display"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--text)",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
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
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    textDecoration: "none",
                    flex: "none",
                  }}
                >
                  <ExternalLink size={12} strokeWidth={1.8} />
                  Site
                </a>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
              {b.city ? `${b.city} · ` : ""}
              <span style={{ textTransform: "capitalize" }}>{niche}</span>
              <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
              <span className="lg-mono tnum">Updated {fmtDate(item.lastActivity)}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {!open && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StatChip icon={Layers} label={item.hasPack ? "Pack" : "No pack"} on={item.hasPack} />
              {item.proposals.length > 0 && (
                <StatChip icon={ScrollText} label={String(item.proposals.length)} on />
              )}
              {item.audits.length > 0 && (
                <StatChip icon={Stethoscope} label={String(item.audits.length)} on />
              )}
            </div>
          )}
          <Link
            href={item.hasPack ? `${studioBase}&restore=pack` : studioBase}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 13px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              color: "var(--text)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), var(--shadow-sm)",
            }}
          >
            Open
            <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Three-column work surface — revealed on expand */}
      {open && (
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
                          {formatCurrency(p.setupFee)}
                          <span style={{ color: "var(--text-3)", fontWeight: 500 }}>
                            {" "}
                            + {formatCurrency(p.monthlyPrice)}/mo
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
              <div style={{ display: "inline-flex", gap: 6 }}>
                {/* The build sits beside intake, not behind it: the intake answers
                    are what move it, so the two belong within one glance of each
                    other. Its own disclosure rather than a section of the intake
                    editor, because he opens this to CHECK the build far more often
                    than he opens it to change an answer. */}
                <MiniButton
                  onClick={() => setShowBuild((v) => !v)}
                  icon={Workflow}
                  title="The build — which of the 14 workflows this client gets"
                />
                <MiniButton
                  onClick={() => setShowIntake((v) => !v)}
                  icon={SlidersHorizontal}
                  title="Intake"
                />
                <MiniButton
                  onClick={runPack}
                  icon={item.hasPack ? Sparkles : Plus}
                  label={item.hasPack ? "Regenerate" : "Generate"}
                  busy={packRunning}
                />
              </div>
            }
          />
          {/* What's still guessed, hosted HERE rather than inside the intake form,
              so it's visible the moment the panel opens — the count is a reason to
              open intake at all, and hiding it behind the editor means he only
              learns what he failed to collect once he's already gone looking. The
              form is told not to render its own copy (showGaps={false}); this one
              re-reads on every intake save via intelKey. */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.015)",
              padding: "11px 12px",
              marginBottom: 10,
            }}
          >
            <IntakeGaps businessId={b.id} reloadKey={intelKey} density="compact" />
          </div>
          {/* What this client's build includes — the fourteen workflows, whether
              each is in, and why. Above the intake editor and sharing its refetch
              token, so answering a question and watching a workflow drop out of the
              build is one continuous motion rather than two screens. */}
          {showBuild && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.015)",
                padding: "12px 12px 13px",
                marginBottom: 10,
              }}
            >
              <WorkflowPanel businessId={b.id} reloadKey={intelKey} density="compact" />
            </div>
          )}
          {/* Intake sits right next to the Generate button because these answers
              are the only inputs that change what D1–D4 say. Same questions, same
              component, same save path as the business-detail card. */}
          {showIntake && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.015)",
                padding: "12px 12px 13px",
                marginBottom: 10,
              }}
            >
              <IntakeForm
                business={item.business}
                density="compact"
                successMessage="Intake saved — regenerate to apply"
                showGaps={false}
                onSaved={(next: IntakeValues) => {
                  onChange({ ...item, business: { ...item.business, ...next } });
                  // Both computed panels live one level up, so the save has to reach
                  // them from here — he answers a question and watches the guessed
                  // list shrink and the build change in the same breath. An answer
                  // that moves a workflow (no social accounts, no past-customer
                  // list) has to be visible in the build immediately, or he has no
                  // way to tell whether it landed.
                  setIntelKey((n) => n + 1);
                }}
                renderFooter={({ save, saving, dirty }) => (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <MiniButton
                      onClick={save}
                      icon={Check}
                      label={dirty ? "Save intake" : "Saved"}
                      busy={saving}
                    />
                  </div>
                )}
              />
            </div>
          )}
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
                  <div
                    className="flex items-center"
                    style={{
                      borderTop: "1px solid var(--line)",
                      padding: "6px 12px",
                      gap: 14,
                    }}
                  >
                    <a
                      href={`/a/${a.publicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={teaserActionStyle}
                    >
                      <Eye size={11} strokeWidth={2} />
                      View public teaser
                    </a>
                    {/* Same URL the anchor opens, but absolute — this is the link
                        that gets pasted into the pre-call email, so it has to
                        carry the host, not the relative path. */}
                    <button
                      onClick={() => copyTeaserLink(a.publicId)}
                      style={{
                        ...teaserActionStyle,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <LinkIcon size={11} strokeWidth={2} />
                      Copy link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {gate && (
        <PackGateDialog
          boundary={gate.boundary}
          failure={gate.failure}
          busy={savingPack}
          onClose={() => setGate(null)}
          // Save can be forced with a written reason; generation cannot.
          onConfirm={
            gate.boundary === "save"
              ? (payload) => void savePack(pendingPackRef.current, payload)
              : undefined
          }
        />
      )}
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
  // Deep-link target: /library?businessId=…(&generate=1) arrives here from every
  // "Generate asset pack" button. autogenId is the business whose panel should
  // auto-open and immediately run the pack.
  const [autogenId, setAutogenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Read the deep-link params off the URL (client-only, so no Suspense
        // boundary needed as useSearchParams would require).
        const params = new URLSearchParams(window.location.search);
        const bizId = params.get("businessId");
        const wantsGen = params.get("generate") === "1";

        // The two halves of "your businesses": those with work (workspaces) and
        // the full saved list (includes bare bookmarks the workspaces view omits).
        const [libRes, bizRes] = await Promise.all([
          fetch("/api/assets/library", { cache: "no-store" }),
          fetch("/api/businesses", { cache: "no-store" }),
        ]);
        if (!libRes.ok) throw new Error(`Failed (${libRes.status})`);
        const data = (await libRes.json()) as { items: LibraryItem[] };
        let nextItems = data.items ?? [];

        // If we were sent here for a specific business that has no work yet, it
        // won't be in the library feed (which only returns businesses that already
        // have a pack/audit/proposal or are in deliverable status). Fetch it and
        // synthesize an empty workspace row so its panel exists to generate into.
        if (bizId && !nextItems.some((i) => i.businessId === bizId)) {
          try {
            const oneRes = await fetch(`/api/businesses/${bizId}`, { cache: "no-store" });
            if (oneRes.ok) {
              const { business: b } = (await oneRes.json()) as {
                business:
                  | (LibraryItem["business"] & {
                      createdAt?: string;
                      lastActivityAt?: string;
                    })
                  | null;
              };
              if (b) {
                const nowIso = new Date().toISOString();
                const synth: LibraryItem = {
                  id: b.id,
                  businessId: b.id,
                  hasPack: false,
                  packDate: null,
                  lastActivity: b.lastActivityAt ?? b.createdAt ?? nowIso,
                  createdAt: b.createdAt ?? nowIso,
                  business: {
                    id: b.id,
                    name: b.name,
                    city: b.city ?? null,
                    industry: b.industry ?? null,
                    category: b.category ?? null,
                    website: b.website ?? null,
                    photoUrl: b.photoUrl ?? null,
                    avgClientValueCad: b.avgClientValueCad ?? null,
                    monthlyLeadVolume: b.monthlyLeadVolume ?? null,
                    hasCrm: b.hasCrm ?? null,
                    hasFollowUpSequence: b.hasFollowUpSequence ?? null,
                    hasReminderSystem: b.hasReminderSystem ?? null,
                    hasPastCustomerDatabase: b.hasPastCustomerDatabase ?? null,
                    servicesFocus: b.servicesFocus ?? null,
                    bookingMethod: b.bookingMethod ?? null,
                    bookingToolName: b.bookingToolName ?? null,
                    gbpManagement: b.gbpManagement ?? null,
                    buildPriorities: b.buildPriorities ?? null,
                    // This path reads the single-business endpoint, which returns
                    // the whole row — so unlike the library feed it does carry the
                    // five "how enquiries are handled" answers.
                    hasCallTracking: b.hasCallTracking ?? null,
                    hasOnlinePayment: b.hasOnlinePayment ?? null,
                    afterHoursHandling: b.afterHoursHandling ?? null,
                    missedCallHandling: b.missedCallHandling ?? null,
                    responseSpeed: b.responseSpeed ?? null,
                  },
                  audits: [],
                  proposals: [],
                };
                nextItems = [synth, ...nextItems];
              }
            }
          } catch {
            // Non-fatal: fall through with whatever the library returned.
          }
        }

        if (!cancelled) {
          setItems(nextItems);
          if (bizId && wantsGen && nextItems.some((i) => i.businessId === bizId)) {
            setAutogenId(bizId);
          }
        }
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

  // Once the target panel is in the DOM, scroll it into view so the running
  // generation is what the operator sees on arrival.
  useEffect(() => {
    if (!autogenId || loading) return;
    const el = document.getElementById(`biz-${autogenId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [autogenId, loading]);

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
                autoGenerate={item.businessId === autogenId}
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
