"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { SavedBusinessCard } from "@/components/businesses/SavedBusinessCard";
import type { SavedBusiness } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ClientDrawer, type ClientDrawerTab } from "@/components/businesses/ClientDrawer";
import { ObservedFactsRow } from "@/components/businesses/ObservedFactsRow";
// Type-only: the compute lives server-side (the feed ships the small object);
// importing VALUES from the lib here would drag the detection layer into the
// client bundle — see the note at the top of ObservedFactsRow.tsx.
import type { ObservedFacts } from "@/lib/observed-facts";
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
  Gauge,
  ScrollText,
  Plus,
  Link as LinkIcon,
  Layers,
  Loader2,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Workflow,
  HelpCircle,
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
    // THE FOUR ANSWERS NO FINDING ASKS FOR, but the BUILD does — they change what
    // gets switched on rather than only what a document says. "NO_ACCOUNTS" drops
    // Social DM Capture, a dormant past-customer list drives Database
    // Reactivation, NEVER on deposits takes Text-to-Pay out, and NOBODY on review
    // replies is a finding in its own right.
    //
    // CHECKED AGAINST THE ROUTE, not assumed: /api/assets/library selects AND
    // returns all four (an earlier comment here claimed it didn't — it does).
    // They are declared for one blunt reason: an answer the feed carries but this
    // type doesn't name is an answer the drawer's form opens BLANK for, and a
    // blank next to a question already answered is how he ends up asking a client
    // the same thing twice on a fifteen-minute call.
    socialEnquiries?: string | null;
    pastCustomerContact?: string | null;
    takesDeposits?: string | null;
    reviewReplyOwner?: string | null;
  };
  // The four pre-dial values (mobile speed, reviews vs local median, booking
  // link, click-to-call), computed SERVER-SIDE by /api/assets/library from the
  // stored research/PSI snapshots. This replaced the cold-audit column when the
  // free audit was deleted (owner ruling, 2026-08-01): a number cannot
  // hallucinate, and "—" honestly means "we could not see".
  observedFacts: ObservedFacts;
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

// ── How tall an open business is allowed to get ───────────────────────────────
//
// THE COMPLAINT THIS ANSWERS: "it expands the page and makes it so long… i have
// to scroll." Every column below is capped and scrolls INSIDE the panel, so an
// open business is the same height whatever is in it — six proposals or none, a
// generated pack or an empty state. Nothing that happens inside a column can move
// the business rows underneath it.
//
// WHY A CAP AND NOT A FIXED HEIGHT. A fixed height would leave a tall empty box
// under a client with one proposal and no pack. A cap only bites when there is
// genuinely more content than fits; below it the panel is exactly as tall as its
// content, and CSS grid stretches all three columns to match the tallest one, so
// they still read as one block rather than three ragged ones.
//
// WHY clamp() AND NOT A PIXEL NUMBER. 46vh keeps roughly half the screen free —
// enough that the next business is still visible under an open one — on his
// laptop AND on the external monitor, where a fixed 420px would look like a
// letterbox. The floor stops it collapsing to nothing in a short window; the
// ceiling stops one client owning an entire 4K screen.
const WORK_SURFACE_MAX = "clamp(280px, 46vh, 620px)";

// ── Small section primitives ──────────────────────────────────────────────────

// The three columns share one shape: a head that stays put and a body that
// scrolls. The head carries Generate and the three ways into the client drawer, so
// those are always one click away no matter how far down a column he has scrolled.
const COLUMN_SHELL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  // minHeight:0 is what actually makes the cap hold. A grid item's default
  // minimum size is its content, which would push straight through maxHeight.
  minHeight: 0,
  maxHeight: WORK_SURFACE_MAX,
  padding: "18px 20px",
};

const COLUMN_BODY: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  // Reaching the bottom of a column must not start scrolling the whole Library
  // underneath it — he is reading one client, not leaving.
  overscrollBehavior: "contain",
};

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
        // Pinned: the column body below scrolls, this does not. Losing the
        // Generate button off the top of a scrolled column would be a new way to
        // have to hunt for something.
        flex: "none",
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
  const [packRunning, setPackRunning] = useState(false);
  const [packProgress, setPackProgress] = useState<{ pct: number; label: string } | null>(null);
  const [proposalRunning, setProposalRunning] = useState(false);
  // The questions, the sixteen intake fields and the fourteen build switches used
  // to be toggles that appended themselves BELOW this panel — which is what made
  // the page grow. They are now three tabs of one drawer over the page: one piece
  // of state, where null means closed and the value is which tab it opens on.
  const [drawer, setDrawer] = useState<ClientDrawerTab | null>(null);
  // Refetch token for "what's still guessed", which is COMPUTED SERVER-SIDE from
  // the intake answers plus the stored research. It has exactly one job left now
  // that the panel itself lives in the drawer: a pack that finishes while the
  // drawer is open has just captured a research snapshot, and the Questions tab
  // is reading the one from before. The generator bumps it; the drawer forwards
  // it as questionsReloadKey.
  //
  // It is never adjusted optimistically. One answer can upgrade a finding, take it
  // off the report entirely — which moves the TOTAL, not just the guessed count —
  // or change nothing at all, and only re-running detection server-side knows
  // which. Guessing the new number here would be a second copy of the detection
  // rules that the deliverables don't use.
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
  // cards. Any in-flight generation forces it open, so progress is never running
  // behind a collapsed row.
  //
  // The drawer is deliberately NOT in this list any more: it floats over the page
  // and costs the panel no height, so whether it is open has nothing to do with
  // whether this business is expanded.
  const [expanded, setExpanded] = useState(false);
  const open = expanded || packRunning || proposalRunning;

  /**
   * Merge answers into this row's business — and the reason it goes through a ref
   * instead of straight through `onChange`.
   *
   * THE DRAWER CAN HAND BACK TWO MERGES IN ONE TICK, and does on the mainline path:
   * "Save & close" reports the form's whole answer set (onIntakeSaved) and then the
   * chips he clicked on the Questions tab (onAnswersRecorded), one after the other,
   * before React has re-rendered anything. `onChange` takes a WHOLE ROW, so two
   * calls built from this render's `item` would both start from the same
   * pre-merge copy and the second would silently drop the first — his sixteen-field
   * save, gone from the row that seeds the form on the next open.
   *
   * The ref carries the last business object THIS panel produced, so the second
   * merge composes onto the first. Everything else on `item` is untouched in that
   * tick, so spreading the render's copy around the new business is correct.
   *
   * ORDER OF THE TWO, when one field is in both: the chips land last and win. That
   * is right for the case that actually happens — a question answered by chip and
   * never touched in the form, where the form's set carries a blank for it because
   * it was seeded before the chip existed. It is wrong only if he answered the SAME
   * question in the form afterwards, and then it is a stale digit on screen that
   * the next load fixes: the database has whichever PATCH landed last, and the form
   * writes nothing it thinks is unchanged.
   */
  const businessRef = useRef(item.business);
  useEffect(() => {
    businessRef.current = item.business;
  }, [item.business]);
  const mergeBusiness = <P extends object>(patch: P) => {
    const nextBusiness = { ...businessRef.current, ...patch };
    businessRef.current = nextBusiness;
    onChange({ ...item, business: nextBusiness });
  };

  /**
   * Called by the one generator that can capture a research snapshot — the pack
   * — and by nothing else. An ANSWER does not come through here any more: both
   * places one can be given now live inside the drawer, and it re-reads its own
   * count (the Questions tab after every chip, and again after a full-form
   * save). WATCHING THE NUMBER DROP IS THE POINT, but the number is in the
   * drawer, so the drawer is what has to re-read it.
   */
  const refreshIntel = () => setIntelKey((n) => n + 1);

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
      // Generating the pack is what captures the research snapshot the guessed
      // list is computed from.
      refreshIntel();
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

  // Proposal — one-shot: generate pack-grounded content, then persist a row.
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
              <span className="tnum">Updated {fmtDate(item.lastActivity)}</span>
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
        <section style={{ ...COLUMN_SHELL, borderRight: "1px solid var(--line)" }}>
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
          <div style={COLUMN_BODY}>
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
                            className="tnum"
                            style={{ fontSize: 11.5, color: "var(--money)", fontWeight: 600 }}
                          >
                            {formatCurrency(p.setupFee)}
                            <span style={{ color: "var(--text-3)", fontWeight: 500 }}>
                              {" "}
                              + {formatCurrency(p.monthlyPrice)}/mo
                            </span>
                          </span>
                          <span
                            className="tnum"
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
          </div>
        </section>

        {/* Deliverables (D1–D4) */}
        <section style={{ ...COLUMN_SHELL, borderRight: "1px solid var(--line)" }}>
          <SectionHead
            icon={Layers}
            label="Deliverables"
            count={item.hasPack ? 4 : 0}
            action={
              <div style={{ display: "inline-flex", gap: 6 }}>
                {/* THREE WAYS INTO THE SAME DRAWER, in the drawer's own tab order —
                    Questions, Intake, Build — so the row and the tabs it lands on
                    read as one thing, and the order is also most-used first: on a
                    call he wants the five questions that move the report, then the
                    other eleven, then the switches. All three used to unroll this
                    panel downwards; now the panel behind does not move by a pixel.

                    THE COUNT DOES NOT RIDE ON THE FIRST BUTTON. See the note above
                    the drawer at the foot of this component for why. */}
                <MiniButton
                  onClick={() => setDrawer("questions")}
                  icon={HelpCircle}
                  title="Questions — what the scan couldn't settle, and what to ask on the call"
                />
                <MiniButton
                  onClick={() => setDrawer("intake")}
                  icon={SlidersHorizontal}
                  title="Client intake — the full set of questions, beside this record"
                />
                <MiniButton
                  onClick={() => setDrawer("build")}
                  icon={Workflow}
                  title="The build — which of the 14 workflows this client gets"
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
          {/* DELIVERABLES ONLY. The guessed-answers card used to sit at the top of
              this body and it was the tallest thing in the column — a scrollbar
              inside a scrollbar, in a third of a row, for a list he fills in live
              on a Zoom. It is the drawer's first tab now; nothing summarising it is
              left behind here, on purpose.

              THE CAP AND THE SCROLL STAY (COLUMN_SHELL / COLUMN_BODY). Checked
              rather than assumed: what is left is four fixed deliverable rows plus
              the generated-on line, about 250px of body, and the cap's FLOOR is
              280px — which is what is in force on any window shorter than ~610px
              tall (46vh < 280px). So on the laptop in a split screen this column
              still overflows and still needs its own scrollbar. Above that the cap
              simply never bites, which costs nothing: overflow:auto draws no
              scrollbar when there is nothing to scroll. Exempting one of three grid
              siblings from the shared shape would also make it the one column free
              to push the row taller the day a D5 appears. */}
          <div style={COLUMN_BODY}>
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
                    className="tnum"
                    style={{ fontSize: 10.5, color: "var(--text-subtle)", marginTop: 10 }}
                  >
                    Pack generated {fmtDate(item.packDate)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Observed facts — the cold-audit column's replacement (owner ruling,
            2026-08-01). Not a document and not a generator: four measured values
            computed server-side from the snapshots the feed already reads, each
            "—" when we could not see. There is deliberately NO run button — the
            row costs nothing to read, and a missing snapshot degrades to "—"
            rather than triggering a scrape. The count in the head is how many of
            the four were actually measured. */}
        <section style={COLUMN_SHELL}>
          <SectionHead
            icon={Gauge}
            label="Observed facts"
            count={
              [
                item.observedFacts.mobileSpeed.score != null ||
                  item.observedFacts.mobileSpeed.loadSeconds != null,
                item.observedFacts.reviews.count != null,
                item.observedFacts.bookingLink.state !== "unknown",
                item.observedFacts.clickToCall.state !== "unknown",
              ].filter(Boolean).length
            }
            action={null}
          />
          <div style={COLUMN_BODY}>
            <ObservedFactsRow facts={item.observedFacts} />
          </div>
        </section>
      </div>
      )}

      {/* The questions, the intake form and the build switches, over the page
          instead of under it. It is `position: fixed`, so it costs this panel no
          height and the Library keeps its scroll position exactly where he left it.

          WHY THERE IS NO COUNT BADGE ON THE QUESTIONS BUTTON. "5 of 8 findings
          will read as industry pattern" is the reason to press it, and a number on
          the button would be labelling the button rather than putting the card back
          in this column — so it was worth having. It is not affordable HERE. The
          count is computed server-side from the research snapshot plus the intake
          answers, /api/assets/library does not carry it, and this component is
          rendered once per client — so a badge means one leak-detection GET per
          expanded row purely to draw a digit, and a second code path onto the same
          endpoint that the drawer's own panel is already the authority on. Two
          copies of one number is exactly what this change removed. The honest
          version is one field in the library feed; see the handoff. Until then the
          count is the first line inside the tab that opens by default, and the
          button's tooltip says what is behind it. */}
      <ClientDrawer
        open={drawer !== null}
        business={item.business}
        businessName={b.name}
        // `?? "questions"` is only ever read while open; on close the drawer
        // unmounts, and the next open re-asserts whichever button he pressed.
        initialTab={drawer ?? "questions"}
        // A pack generation started BEFORE he opened this can land while it is
        // open, and it can capture the research snapshot the whole guessed list
        // is computed from — so the token that tracks that reaches the Questions
        // tab. Nothing else needs to: it re-reads itself after each of its own
        // answers, and it remounts fresh on every open.
        questionsReloadKey={intelKey}
        onClose={() => setDrawer(null)}
        successMessage="Intake saved — regenerate to apply"
        // MERGING IS NOT OPTIONAL (see ClientDrawer.onIntakeSaved): the form diffs
        // its draft against this object to decide what is unsaved, so a merge
        // skipped here leaves it looking dirty forever and it would ask him to save
        // again on the way out, over a write that already landed.
        onIntakeSaved={mergeBusiness}
        // The answers he clicked straight onto the Questions tab, handed over as it
        // closes (see ClientDrawer.onAnswersRecorded for why not sooner). They are
        // already in the database; this is what stops the same question opening
        // blank next time and getting asked twice on a call. Both of these can fire
        // in the same tick — see mergeBusiness for why that needs a ref.
        onAnswersRecorded={mergeBusiness}
      />

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
        // won't be in the library feed (which only returns businesses in
        // deliverable status). Fetch it and synthesize an empty workspace row so
        // its panel exists to generate into.
        if (bizId && !nextItems.some((i) => i.businessId === bizId)) {
          try {
            const oneRes = await fetch(`/api/businesses/${bizId}`, { cache: "no-store" });
            if (oneRes.ok) {
              const { business: b } = (await oneRes.json()) as {
                business:
                  | (LibraryItem["business"] & {
                      createdAt?: string;
                      lastActivityAt?: string;
                      // The single-business endpoint computes the same four
                      // pre-dial values server-side and ships the small object.
                      observedFacts?: ObservedFacts | null;
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
                    // EVERY intake answer, copied across. This path reads the
                    // single-business endpoint, which returns the whole row — so
                    // any answer left out here is left out on purpose or by
                    // accident, and it was by accident: the four below were being
                    // dropped, so a client reached through the CRM's "Generate
                    // asset pack" button opened the intake drawer showing blanks
                    // for questions that were already answered. Nothing was
                    // overwritten (the form only writes what he actually changes),
                    // but a blank is an invitation to ask it again on the call.
                    hasCallTracking: b.hasCallTracking ?? null,
                    hasOnlinePayment: b.hasOnlinePayment ?? null,
                    afterHoursHandling: b.afterHoursHandling ?? null,
                    missedCallHandling: b.missedCallHandling ?? null,
                    responseSpeed: b.responseSpeed ?? null,
                    socialEnquiries: b.socialEnquiries ?? null,
                    pastCustomerContact: b.pastCustomerContact ?? null,
                    takesDeposits: b.takesDeposits ?? null,
                    reviewReplyOwner: b.reviewReplyOwner ?? null,
                  },
                  // The endpoint computed these from the stored snapshots; a row
                  // it didn't send degrades to the honest all-unknown shape,
                  // which renders as four dashes — "we could not see", never
                  // "nothing is wrong".
                  observedFacts: b.observedFacts ?? {
                    mobileSpeed: { score: null, loadSeconds: null, verdict: "unknown" },
                    reviews: { count: null, rating: null, localAvg: null, verdict: "unknown" },
                    bookingLink: { state: "unknown", verdict: "unknown" },
                    clickToCall: { state: "unknown", verdict: "unknown" },
                    observedAt: null,
                  },
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
        acc.packs += i.hasPack ? 1 : 0;
        return acc;
      },
      { proposals: 0, packs: 0 }
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
