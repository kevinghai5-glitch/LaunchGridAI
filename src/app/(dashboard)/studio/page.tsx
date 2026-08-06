"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, ChevronDown, History } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import { AssetPackView } from "@/components/businesses/AssetPackView";
import {
  PackGateDialog,
  parsePackGateFailure,
  type PackGateBoundary,
  type PackGateFailure,
  type PackOverridePayload,
} from "@/components/businesses/PackOverrideDialog";
import {
  SETUP_FEE_CAD,
  MONTHLY_RETAINER_CAD,
  FIRST_YEAR_VALUE_CAD,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type {
  AssetPack,
  PackGovernance,
  SavedBusiness,
  DeliverableId,
} from "@/types";

type GenProgress = { completed: number; total: number; label: string };

// Local cache of the last generation per business, so the "View previous
// generation" button reappears after every run without touching the Library.
const lastPackKey = (id: string) => `studio:lastPack:${id}`;

function readCachedPack(id: string): { pack: AssetPack; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lastPackKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pack: AssetPack; at: string };
    return parsed?.pack ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedPack(id: string, pack: AssetPack, at: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastPackKey(id), JSON.stringify({ pack, at }));
  } catch {
    /* quota / serialization — non-fatal, the button just won't persist */
  }
}

// Same-day generations are treated as "still current" — they auto-open as the
// live deliverable with no regenerate banner. Anything older surfaces the
// regenerate prompt so the operator refreshes stale work before sending it.
function isSameDayAsNow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// Flat surface card matching the opportunities search bar (no gradient/shadow).
const flatCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "none",
};

export default function StudioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const businessId = params.get("businessId");
  const restoreParam = params.get("restore"); // "pack" → auto-open the saved pack (from Library)
  const deliverableParam = params.get("deliverable") as DeliverableId | null; // d1..d4 deep-link

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [selected, setSelected] = useState<SavedBusiness | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [pack, setPack] = useState<AssetPack | null>(null);
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPack, setSavedPack] = useState(false);
  // A blocked governance gate, held open until the operator deals with it. Both
  // gates that can land here return a multi-check report, and a toast can only
  // ever show one truncated line of one of them — so it is rendered in full.
  // Save may be overridden; generation may not (a pack that fails at generation
  // gets regenerated, never forced), which is what `boundary` selects.
  const [gate, setGate] = useState<{
    boundary: PackGateBoundary;
    failure: PackGateFailure;
  } | null>(null);
  // The governance block the save route hands back when a save was forced. The
  // pack object below was built before the server stamped it, so this is what
  // lets the pack view show its "shipped over a failing check" marker straight
  // away instead of only after the pack is reloaded from the database.
  const [saveOverride, setSaveOverride] = useState<PackGovernance | null>(null);
  // Previously-saved generations, loaded but NOT auto-shown — Studio opens fresh.
  // Surfaced behind an explicit "View previous generation" button instead.
  const [archivedPack, setArchivedPack] = useState<AssetPack | null>(null);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  // Refetch token for the "still guessed" panel. Bumped after a run that can have
  // changed the stored research snapshot the panel reads.
  const abortRef = useRef<AbortController | null>(null);

  // Initial business list — pick from URL, then last-used (localStorage), then first.
  useEffect(() => {
    fetch("/api/businesses?deliverable=true")
      .then((r) => r.json())
      .then((data) => {
        const list: SavedBusiness[] = data.businesses ?? [];
        setBusinesses(list);
        const remembered =
          typeof window !== "undefined"
            ? window.localStorage.getItem("studio:lastBusinessId")
            : null;
        const pick =
          (businessId && list.find((b) => b.id === businessId)) ||
          (remembered && list.find((b) => b.id === remembered)) ||
          list[0];
        if (pick) setSelected(pick);
      })
      .catch(() => {});
  }, [businessId]);

  // Persist last-used selection + restore latest pack whenever selection changes.
  useEffect(() => {
    if (!selected) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("studio:lastBusinessId", selected.id);
    }
    let cancelled = false;
    setRestoring(true);
    setPack(null);
    setDone(false);
    setRestoredAt(null);
    setSavedPack(false);
    // A different business's forced-save marker must not follow the operator
    // onto this one. A pack restored from the Library carries its own record in
    // `pack.governance`, which is where it belongs.
    setSaveOverride(null);
    setArchivedPack(null);
    setArchivedAt(null);
    setGenProgress(null);
    // Surface the last generation behind the "View previous generation" button
    // without auto-showing it. Prefer the local cache (every run is cached here,
    // saved or not); fall back to the last Library save if there's no cache yet.
    // When arriving from the Library with ?restore=pack for THIS business, open
    // the saved pack straight away instead of leaving it behind the button. We
    // do this in the same effect that loads/resets the pack so there's no
    // cross-effect race (StrictMode double-invoke was wiping a separate effect).
    const shouldRestore = restoreParam === "pack" && selected.id === businessId;
    // Open a saved pack into view. Same-day generations open with no banner (they
    // read as the current deliverable); older ones pass their date so the
    // regenerate banner shows. Auto-open when the last pack is from today, or
    // always when arriving from the Library/Saved card (?restore=pack).
    const openPack = (p: AssetPack, at: string | null) => {
      setPack(p);
      setRestoredAt(isSameDayAsNow(at) ? null : at);
      setDone(true);
      setSavedPack(true); // it came from the Library — already saved
    };
    const cached = readCachedPack(selected.id);
    if (cached) {
      setArchivedPack(cached.pack);
      setArchivedAt(cached.at);
      if (shouldRestore || isSameDayAsNow(cached.at)) openPack(cached.pack, cached.at);
    }
    fetch(`/api/assets/latest?businessId=${encodeURIComponent(selected.id)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { pack: AssetPack | null; generatedAt?: string }) => {
        if (cancelled || cached) return; // local cache wins — it's the freshest
        if (data.pack) {
          setArchivedPack(data.pack);
          setArchivedAt(data.generatedAt ?? null);
          if (shouldRestore || isSameDayAsNow(data.generatedAt))
            openPack(data.pack, data.generatedAt ?? null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, businessId, restoreParam]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    abortRef.current?.abort();
    setRunning(false);
    setPack(null);
    setDone(false);
    setRestoredAt(null);
    setSaveOverride(null);
    setGenProgress(null);
  };

  // Pull the last saved generation into view on demand (it's not shown by default).
  const viewArchivedPack = () => {
    if (!archivedPack) return;
    setPack(archivedPack);
    // Different pack on screen — the archived one carries its own record inside
    // `governance` if it has one.
    setSaveOverride(null);
    setRestoredAt(isSameDayAsNow(archivedAt) ? null : archivedAt);
    setDone(true);
    setSavedPack(true); // archived packs come from the Library — already saved
  };

  const saveToLibrary = async (override?: PackOverridePayload) => {
    if (!selected || !pack || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/assets/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selected.id,
          assetPack: pack,
          ...(override ? { override } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 422 is the governance gate — nothing was written and the body carries
        // every failing check with its stable id. Those ids are what an override
        // has to echo back, so the dialog is both the report and the only place
        // the override can legitimately start.
        const failure = res.status === 422 ? parsePackGateFailure(data) : null;
        if (failure) {
          setGate({ boundary: "save", failure });
          return;
        }
        setGate(null);
        toast.error(data.error || "Failed to save");
        return;
      }
      setGate(null);
      setSavedPack(true);
      setArchivedPack(pack);
      setArchivedAt(data.savedAt ?? new Date().toISOString());
      // The route echoes the governance block back on a forced save, so this
      // never reports as a plain success when it was not one.
      setSaveOverride((data.override as PackGovernance | undefined) ?? null);
      if (data.override) {
        const n = Array.isArray(data.override.checks) ? data.override.checks.length : 0;
        toast.warning("Saved with an override on the record", {
          description: `This pack entered the Library over ${n} failing check${
            n === 1 ? "" : "s"
          }. Your reason and those checks are stored on the row — internal only.`,
          duration: 12000,
        });
      } else {
        toast.success("Saved to library");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const start = async (opts?: { refreshResearch?: boolean }) => {
    if (!selected || running) return;
    // The deliberate "refresh research" action re-scrapes every source and
    // re-persists the snapshot. A plain (re)generate reuses the stored bundle, so
    // it's a zero-scrape, zero-API-cost operation that can't drift the facts.
    const refreshResearch = opts?.refreshResearch === true;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setDone(false);
    setPack(null);
    setSavedPack(false);
    setSaveOverride(null);
    // Real progress streamed from the server. Starts at 0/10 ("gathering data").
    setGenProgress({
      completed: 0,
      total: 10,
      label: refreshResearch
        ? "Refreshing live site & market data"
        : "Gathering live site & market data",
    });

    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selected.id, refreshResearch }),
        signal: controller.signal,
      });
      // Early errors (auth / validation / not-found) come back as plain JSON.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to generate assets");
        setRunning(false);
        setGenProgress(null);
        return;
      }

      // Stream of newline-delimited JSON progress events + a final pack.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fresh: AssetPack | null = null;
      let streamError: string | null = null;
      let streamFailure: PackGateFailure | null = null;

      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg: {
            type: string;
            completed?: number;
            total?: number;
            label?: string;
            error?: string;
            assetPack?: AssetPack;
          };
          try {
            msg = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (msg.type === "progress") {
            setGenProgress({
              completed: msg.completed ?? 0,
              total: msg.total ?? 10,
              label: msg.label ?? "",
            });
          } else if (msg.type === "error") {
            streamError = msg.error ?? "Failed to generate assets";
            // A `reason:"invalid"` frame carries the full list of laws that
            // broke. There is NO override at this boundary — a pack that fails
            // at generation gets regenerated, not forced — but the operator
            // still has to be able to read why, which one toast line cannot do.
            streamFailure = parsePackGateFailure(msg);
          } else if (msg.type === "done") {
            fresh = msg.assetPack ?? null;
          }
        }
      }

      if (streamFailure) {
        setGate({ boundary: "generate", failure: streamFailure });
        setGenProgress(null);
        return;
      }
      if (streamError || !fresh) {
        toast.error(streamError || "Failed to generate assets");
        setGenProgress(null);
        return;
      }

      const now = new Date().toISOString();
      setGenProgress({ completed: 10, total: 10, label: "Done" });
      setPack(fresh);
      // Cache locally so the "View previous generation" button persists across
      // selection changes and reloads — independent of saving to the Library.
      writeCachedPack(selected.id, fresh, now);
      setArchivedPack(fresh);
      setArchivedAt(now);
      setDone(true);
      toast.success("Asset pack generated");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Generation cancelled");
      } else {
        toast.error("Failed to generate assets");
      }
      setGenProgress(null);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const busy = running;

  return (
    <>
      <TopBar title="Workspace" subtitle={selected ? selected.name : "Generate & preview deliverables"} />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1500, margin: "0 auto" }}>
        <header
          className="flex justify-between items-end"
          style={{ marginBottom: 32 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 6 }}>Workspace · for</div>
            <h1
              className="lg-display"
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              {selected ? selected.name : "Save a business to begin"}
            </h1>
            {/* This line used to read "You deliver the strategy; the client's team
                implements it." That was the PREVIOUS business model and it is the
                opposite of what is sold now: ReclaimedHQ is done-for-you. We build
                the system inside a GoHighLevel sub-account we own and operate, and
                we run it. Nothing is handed to the client to implement — do not
                reintroduce a sentence that says otherwise. */}
            <p style={{ margin: "8px 0 0", color: "var(--text-3)", fontSize: 13 }}>
              Builds the four consultant-grade deliverables — the diagnosis, what gets built,
              the copy that goes live, and the schedule. Done-for-you: we build the system
              inside a GoHighLevel sub-account we own and operate, then run it.
            </p>
          </div>
          {done && selected && pack && (
            <div className="flex" style={{ gap: 8 }}>
              <LgButton
                variant={savedPack ? "ghost" : "primary"}
                icon={savedPack ? "check" : "bookmark"}
                // Wrapped, not passed by reference: saveToLibrary's first
                // argument is the override payload, and a bare handler would
                // hand it the click event.
                onClick={() => saveToLibrary()}
                disabled={saving || savedPack}
              >
                {saving ? "Saving…" : savedPack ? "Saved to library" : "Save to library"}
              </LgButton>
            </div>
          )}
        </header>

        <div className="grid" style={{ gridTemplateColumns: "340px 1fr", gap: 20 }}>
          {/* LEFT: configuration */}
          <div className="flex flex-col" style={{ gap: 16 }}>
            <LgCard padded={false} style={flatCard}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Eyebrow>For</Eyebrow>
              </div>
              <div style={{ padding: 16 }}>
                <BusinessPicker
                  businesses={businesses}
                  value={selected}
                  onChange={setSelected}
                  disabled={running}
                />
              </div>
            </LgCard>

            <LgCard padded={false} style={flatCard}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Eyebrow>What you get</Eyebrow>
              </div>
              <div className="flex flex-col" style={{ padding: 16, gap: 10 }}>
                {/* Titles are the canonical DELIVERABLES titles from
                    src/lib/exporters/deliverables.ts. Repeated as literals (not
                    imported) so this client page doesn't pull the whole HTML
                    renderer into the bundle — same trade the Library page makes.
                    If a title changes there, change it here. */}
                {[
                  "Growth Leak Intelligence Report — competitor comparison, technical UX read, growth leak scorecard, revenue leak analysis. Anything about their own site is advisory only",
                  "Client Acquisition Infrastructure Blueprint — funnel, qualification, follow-up & CRM",
                  "Conversion Asset Pack — GoHighLevel booking page copy, lead-capture form, LeadGate front-end and webchat copy, email, SMS, review & thank-you assets",
                  "Implementation & Optimization Timeline — what we deploy, then the ongoing retainer cadence",
                  // The count comes from the real catalogue in
                  // src/lib/workflow-catalogue.ts, which asserts WORKFLOWS.length
                  // === 14 at load. If that ever changes, change this number too.
                  "Done-for-you: we build the 14 GoHighLevel workflows, the CRM pipeline, and their booking page inside a sub-account we own and operate. Nothing is handed to their team",
                ].map((line) => (
                  <div
                    key={line}
                    className="flex items-start"
                    style={{ gap: 9, fontSize: 13, color: "var(--text-muted)" }}
                  >
                    <span
                      className="grid place-items-center flex-none"
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 99,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        marginTop: 1,
                      }}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                    {line}
                  </div>
                ))}
              </div>
            </LgCard>

            <LgCard padded={false} style={flatCard}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Eyebrow>Deal economics</Eyebrow>
              </div>
              {/* Both figures come from src/lib/constants.ts — the SAME constants the
                  proposal builder uses — so this screen and a proposal he sends can
                  never quote a client two different prices. Written marker-first
                  ("CAD $6,500") by formatCurrency, the product-wide money convention.
                  The caption under each figure exists to keep the two halves of the
                  offer apart: LeadGate is what the MONTHLY buys, never the build. */}
              <div className="flex flex-col" style={{ padding: 14, gap: 10 }}>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6 }}>Setup fee</div>
                  <div
                    className="lg-display tnum"
                    style={{ fontSize: 26, fontWeight: 680, letterSpacing: "-0.03em", color: "var(--text)" }}
                  >
                    {formatCurrency(SETUP_FEE_CAD)}
                    <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>one-time</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6, lineHeight: 1.45 }}>
                    The four deliverables + the GoHighLevel build
                  </div>
                </div>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    // money-toned card: this is the recurring revenue number
                    background: "var(--money-soft)",
                    border: "1px solid color-mix(in oklab, var(--money) 18%, transparent)",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "var(--money)", marginBottom: 6 }}>Monthly retainer</div>
                  <div
                    className="lg-display tnum"
                    style={{ fontSize: 26, fontWeight: 680, letterSpacing: "-0.03em", color: "var(--money)" }}
                  >
                    {formatCurrency(MONTHLY_RETAINER_CAD)}
                    <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>/mo</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6, lineHeight: 1.45 }}>
                    LeadGate qualification, us running the system, monthly report
                  </div>
                </div>
                <div className="flex justify-between" style={{ padding: "2px 2px", fontSize: 11.5 }}>
                  <span style={{ color: "var(--text-3)" }}>12-mo deal value</span>
                  <span className="lg-mono tnum" style={{ color: "var(--text)", fontWeight: 500 }}>
                    {formatCurrency(FIRST_YEAR_VALUE_CAD)}
                  </span>
                </div>
              </div>
            </LgCard>

            <LgCard padded={false} style={flatCard}>
              <div style={{ padding: 16 }}>
                <div className="relative">
                  {!busy && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: -4,
                        borderRadius: "calc(var(--radius) + 4px)",
                        background:
                          "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent), transparent 70%)",
                        filter: "blur(12px)",
                        animation: "lg-pulse 2.4s ease-in-out infinite",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />
                  )}
                  <LgButton
                    variant="primary"
                    size="lg"
                    icon={busy ? undefined : "sparkles"}
                    onClick={() => start()}
                    disabled={busy || !selected}
                    style={{
                      width: "100%",
                      position: "relative",
                      zIndex: 1,
                      overflow: "hidden",
                    }}
                  >
                    {busy ? <Spinner /> : null}
                    <span style={{ position: "relative" }}>
                      {running
                        ? "Generating…"
                        : done
                        ? "Regenerate asset pack"
                        : "Generate asset pack"}
                    </span>
                  </LgButton>
                </div>
                {busy && (
                  <button
                    onClick={cancel}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "9px 16px",
                      background: "transparent",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      color: "var(--text-2)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancel generation
                  </button>
                )}
                <div
                  className="text-center"
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--text-subtle)",
                  }}
                >
                  Grounded in their live website + Google Places data
                </div>
                {/* Regenerate reuses the stored research snapshot (no re-scrape),
                    so facts never drift between runs. This is the deliberate
                    escape hatch to pull fresh live data on purpose. */}
                {!busy && (
                  <button
                    onClick={() => start({ refreshResearch: true })}
                    disabled={!selected}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "6px 12px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-subtle)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: selected ? "pointer" : "default",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    Refresh research (re-scrape live data)
                  </button>
                )}
              </div>
            </LgCard>
          </div>

          {/* RIGHT: output */}
          <LgCard
            padded={false}
            style={{
              ...flatCard,
              minHeight: 640,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              className="flex justify-between items-center flex-none"
              style={{
                padding: "14px 24px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center" style={{ gap: 12 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                  }}
                >
                  Asset Pack
                </span>
                {selected && (
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
                    {selected.name}
                  </span>
                )}
              </div>
              <div className="flex items-center" style={{ gap: 8 }}>
                {running && (
                  <>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 99,
                        background: "var(--accent)",
                        animation: "lg-pulse 1s ease-in-out infinite",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                      Generating
                    </span>
                  </>
                )}
                {done && (
                  <LgBadge tone="success">
                    <Check size={11} strokeWidth={2.5} /> Generated
                  </LgBadge>
                )}
                {!running && !done && (
                  <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Ready</span>
                )}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                padding: "32px 40px",
                overflowY: "auto",
                background: "var(--surface)",
              }}
            >
              {!selected && (
                <div
                  className="text-center"
                  style={{ padding: "64px 20px", color: "var(--text-muted)", fontSize: 14 }}
                >
                  Save a business first to generate deliverables.
                </div>
              )}

              {/* ── ASSET PACK VIEW ── */}
              {selected && !running && !done && !restoring && (
                <EmptyState
                  business={selected}
                  hasArchived={!!archivedPack}
                  archivedAt={archivedAt}
                  onViewArchived={viewArchivedPack}
                />
              )}
              {selected && !running && !done && restoring && (
                <div
                  className="text-center"
                  style={{ padding: "64px 20px", color: "var(--text-muted)", fontSize: 13.5 }}
                >
                  Checking for a saved deliverable…
                </div>
              )}
              {running && (
                <GeneratingState business={selected} progress={genProgress} />
              )}
              {done && pack && selected && (
                <>
                  {restoredAt && !running && (
                    <RegenBanner
                      label="Previous generation"
                      at={restoredAt}
                      onRegenerate={start}
                      onClear={reset}
                      busy={running}
                    />
                  )}
                  <AssetPackView
                    pack={pack}
                    businessId={selected.id}
                    // "Regenerate pack" inside the view produces a DIFFERENT
                    // pack: it is no longer the one that was saved, and any
                    // override recorded against the old one does not describe
                    // it. Both facts have to be dropped together.
                    onUpdate={(next) => {
                      setPack(next);
                      setSavedPack(false);
                      setSaveOverride(null);
                    }}
                    governance={saveOverride}
                    initialTab={
                      deliverableParam && selected.id === businessId
                        ? deliverableParam
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          </LgCard>
        </div>
      </div>

      {gate && (
        <PackGateDialog
          boundary={gate.boundary}
          failure={gate.failure}
          busy={saving}
          onClose={() => setGate(null)}
          // Save can be forced with a written reason; generation cannot.
          onConfirm={
            gate.boundary === "save"
              ? (payload) => void saveToLibrary(payload)
              : undefined
          }
        />
      )}
    </>
  );
}

/* ---------- shared UI ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-subtle)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 14 : 16;
  return (
    <div
      style={{
        width: size,
        height: size,
        // the large spinner sits on an accent-gradient button, so it rides on
        // the same ink token that fill uses rather than a bare `white`
        border: `2px solid ${
          small
            ? "var(--accent-soft)"
            : "color-mix(in oklab, var(--accent-fill-text) 30%, transparent)"
        }`,
        borderTopColor: small ? "var(--accent)" : "var(--accent-fill-text)",
        borderRadius: "50%",
        animation: "lg-spin 0.7s linear infinite",
        flex: "none",
      }}
    />
  );
}

function BusinessPicker({
  businesses,
  value,
  onChange,
  disabled,
}: {
  businesses: SavedBusiness[];
  value: SavedBusiness | null;
  onChange: (b: SavedBusiness) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!value) {
    return (
      <div
        style={{
          padding: 12,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        No saved businesses yet.
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center w-full text-left"
        style={{
          gap: 12,
          padding: 12,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          color: "inherit",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div
          className="grid place-items-center flex-none"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {value.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--text)",
            }}
          >
            {value.name}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {value.industry ?? "—"} · {value.city ?? "—"}
          </div>
        </div>
        <ChevronDown size={14} strokeWidth={1.75} style={{ color: "var(--text-subtle)" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 10,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {businesses.map((b) => {
            const isActive = b.id === value.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  onChange(b);
                  setOpen(false);
                }}
                className="flex items-center w-full text-left"
                style={{
                  padding: "10px 12px",
                  gap: 10,
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "inherit",
                }}
              >
                <div
                  className="grid place-items-center flex-none"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    fontFamily: "var(--font-sans), sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {b.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {b.industry ?? "—"} · {b.city ?? "—"}
                  </div>
                </div>
                {isActive && (
                  <Check size={14} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  business,
  hasArchived,
  archivedAt,
  onViewArchived,
}: {
  business: SavedBusiness;
  hasArchived: boolean;
  archivedAt: string | null;
  onViewArchived: () => void;
}) {
  return (
    <div className="text-center" style={{ padding: "64px 20px", color: "var(--text-muted)" }}>
      <div
        className="grid place-items-center mx-auto"
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          marginBottom: 20,
        }}
      >
        <Sparkles size={22} strokeWidth={1.75} />
      </div>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.015em",
        }}
      >
        Ready to generate
      </h3>
      <p style={{ margin: "0 auto", maxWidth: 440, fontSize: 14, lineHeight: 1.55 }}>
        Four consultant-grade deliverables for <strong style={{ color: "var(--text)" }}>{business.name}</strong> —
        a Growth Leak Intelligence Report, Client Acquisition Infrastructure Blueprint, Conversion
        Asset Pack, and Implementation &amp; Optimization Timeline, built from their real website
        and Places data.
      </p>
      {hasArchived && (
        <ArchiveLink
          onClick={onViewArchived}
          label="View previous generation"
          at={archivedAt}
        />
      )}
    </div>
  );
}

// Subtle, opt-in link to pull a previously-saved generation back into view.
function ArchiveLink({
  onClick,
  label,
  at,
}: {
  onClick: () => void;
  label: string;
  at?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      className="mx-auto flex items-center"
      style={{
        marginTop: 24,
        gap: 7,
        padding: "7px 14px",
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 999,
        color: "var(--text-2)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <History size={13} strokeWidth={2} style={{ color: "var(--text-subtle)" }} />
      {label}
      {at && (
        <span className="lg-mono tnum" style={{ color: "var(--text-subtle)", fontWeight: 500 }}>
          ·{" "}
          {new Date(at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
    </button>
  );
}

// Inline banner shown above a restored deliverable, with regenerate + clear
// actions.
function RegenBanner({
  label,
  at,
  onRegenerate,
  onClear,
  busy,
}: {
  label: string;
  at: string | null;
  onRegenerate: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const pill = (tone: "regen" | "clear"): React.CSSProperties => ({
    background: "transparent",
    border: "1px solid var(--line)",
    color: tone === "regen" ? "var(--text-2)" : "var(--text-3)",
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    fontFamily: "inherit",
  });
  return (
    <div
      style={{
        margin: "0 0 18px",
        padding: "10px 14px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--surface-2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: 12.5,
        color: "var(--text-3)",
      }}
    >
      <span>
        {label}
        {at && (
          <>
            {" · "}
            <span className="lg-mono tnum" style={{ color: "var(--text-2)" }}>
              {new Date(at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </>
        )}
      </span>
      <div className="flex items-center" style={{ gap: 8 }}>
        <button onClick={onRegenerate} disabled={busy} style={pill("regen")}>
          Regenerate
        </button>
        <button onClick={onClear} style={pill("clear")}>
          Clear
        </button>
      </div>
    </div>
  );
}

// Sleek progress bar with the percentage inside (real streamed progress).
function ProgressMeter({ progress }: { progress: GenProgress | null }) {
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 10;
  const pct = Math.max(2, Math.min(100, Math.round((completed / total) * 100)));
  const label = progress?.label || "Working…";
  return (
    <>
      <div
        style={{
          position: "relative",
          height: 26,
          borderRadius: 999,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          overflow: "hidden",
          // black inset = recessed lighting, not a brand colour — see the
          // --shadow-* tokens in globals.css, which are also plain black rgba
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            borderRadius: 999,
            background: "var(--accent-grad)",
            // was a blue-violet bloom from the old palette, glowing a colour the
            // bar underneath it no longer is
            boxShadow: "0 0 16px color-mix(in oklab, var(--accent) 55%, transparent)",
            transition: "width 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
        {/* moving sheen */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            borderRadius: 999,
            // specular sheen travelling over the accent fill — same ink token as
            // the fill's text, so it stays a highlight in either theme
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent-fill-text) 22%, transparent), transparent)",
            backgroundSize: "200% 100%",
            animation: "lg-shimmer-x 1.6s linear infinite",
            transition: "width 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center"
          style={{ justifyContent: "flex-end", paddingRight: 12 }}
        >
          <span
            className="lg-mono tnum"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              // past 52% the label sits on the accent fill, so it takes the fill's ink
              color: pct > 52 ? "var(--accent-fill-text)" : "var(--text)",
              // black legibility shadow — lighting, not brand colour
              textShadow: pct > 52 ? "0 1px 2px rgba(0,0,0,0.4)" : "none",
              letterSpacing: "-0.01em",
            }}
          >
            {pct}%
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-between"
        style={{ marginTop: 12, fontSize: 12.5 }}
      >
        <span style={{ color: "var(--text-2)" }}>{label}</span>
        <span className="lg-mono tnum" style={{ color: "var(--text-subtle)" }}>
          {Math.min(completed, total)}/{total}
        </span>
      </div>
    </>
  );
}

function GeneratingState({
  business,
  progress,
}: {
  business: SavedBusiness | null;
  progress: GenProgress | null;
}) {
  return (
    <div style={{ padding: "60px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
        <Spinner small />
        <span style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600 }}>
          Building {business?.name ?? "the business"}&apos;s acquisition pack
        </span>
      </div>
      <ProgressMeter progress={progress} />
    </div>
  );
}
