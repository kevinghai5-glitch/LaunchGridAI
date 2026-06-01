"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, ChevronDown, Send } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import { AssetPackView } from "@/components/businesses/AssetPackView";
import { ColdAuditView } from "@/components/businesses/ColdAuditView";
import type { AssetPack, ColdAuditReport, SavedBusiness } from "@/types";

type StudioView = "pack" | "audit";

const THINKING_STEPS = [
  "Loading business profile",
  "Reading their website copy",
  "Analyzing positioning & gaps",
  "Writing landing page + lead capture",
  "Drafting emails, SMS & booking page",
];

export default function StudioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const businessId = params.get("businessId");

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [selected, setSelected] = useState<SavedBusiness | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [pack, setPack] = useState<AssetPack | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [view, setView] = useState<StudioView>("pack");
  const [coldAudit, setColdAudit] = useState<ColdAuditReport | null>(null);
  const [coldRunning, setColdRunning] = useState(false);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coldAbortRef = useRef<AbortController | null>(null);

  // Initial business list — pick from URL, then last-used (localStorage), then first.
  useEffect(() => {
    fetch("/api/businesses")
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
    setColdAudit(null);
    fetch(`/api/assets/latest?businessId=${encodeURIComponent(selected.id)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { pack: AssetPack | null; generatedAt?: string }) => {
        if (cancelled) return;
        if (data.pack) {
          setPack(data.pack);
          setDone(true);
          setRestoredAt(data.generatedAt ?? null);
          setActiveStep(THINKING_STEPS.length);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    fetch(`/api/cold-audit/latest?businessId=${encodeURIComponent(selected.id)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { audit: ColdAuditReport | null }) => {
        if (cancelled) return;
        if (data.audit) setColdAudit(data.audit);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      abortRef.current?.abort();
      coldAbortRef.current?.abort();
    };
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    abortRef.current?.abort();
    if (stepTimer.current) clearInterval(stepTimer.current);
    setRunning(false);
    setPack(null);
    setDone(false);
    setRestoredAt(null);
    setActiveStep(-1);
  };

  const start = async () => {
    if (!selected || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setDone(false);
    setPack(null);
    setActiveStep(0);

    // Animate the "thinking" steps while the real request is in flight.
    let s = 0;
    stepTimer.current = setInterval(() => {
      s++;
      if (s < THINKING_STEPS.length - 1) setActiveStep(s);
    }, 1600);

    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selected.id }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate assets");
        setRunning(false);
        setActiveStep(-1);
        return;
      }
      setPack(data.assetPack as AssetPack);
      setActiveStep(THINKING_STEPS.length);
      setDone(true);
      toast.success("Asset pack generated");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Generation cancelled");
      } else {
        toast.error("Failed to generate assets");
      }
      setActiveStep(-1);
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      abortRef.current = null;
      setRunning(false);
    }
  };

  const startCold = async () => {
    if (!selected || coldRunning) return;
    const controller = new AbortController();
    coldAbortRef.current = controller;
    setColdRunning(true);
    try {
      const res = await fetch("/api/generate/cold-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selected.id }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate cold audit");
        return;
      }
      setColdAudit(data.coldAudit as ColdAuditReport);
      toast.success("Cold audit ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Generation cancelled");
      } else {
        toast.error("Failed to generate cold audit");
      }
    } finally {
      coldAbortRef.current = null;
      setColdRunning(false);
    }
  };

  const isAudit = view === "audit";
  const busy = isAudit ? coldRunning : running;

  return (
    <>
      <TopBar title="Studio" subtitle={selected ? selected.name : "AI generation lab"} />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1500, margin: "0 auto" }}>
        <header
          className="flex justify-between items-end"
          style={{ marginBottom: 32 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 6 }}>Studio · for</div>
            <h1
              className="lg-display"
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                color: "var(--text)",
              }}
            >
              {selected ? selected.name : "Save a business to begin"}
            </h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-3)", fontSize: 13 }}>
              Generates 5 full, business-specific documents — a Growth Asset Pack you can sell.
            </p>
          </div>
          {done && selected && (
            <div className="flex" style={{ gap: 8 }}>
              <LgButton
                variant="primary"
                icon="file"
                onClick={() => router.push(`/proposals/new?businessId=${selected.id}`)}
              >
                Use in proposal
              </LgButton>
            </div>
          )}
        </header>

        <div className="grid" style={{ gridTemplateColumns: "340px 1fr", gap: 20 }}>
          {/* LEFT: configuration */}
          <div className="flex flex-col" style={{ gap: 16 }}>
            <LgCard padded={false}>
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

            <LgCard padded={false}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Eyebrow>What you get</Eyebrow>
              </div>
              <div className="flex flex-col" style={{ padding: 16, gap: 10 }}>
                {[
                  "Landing page copy (hero, offer, CTAs, trust signals)",
                  "Lead capture + qualification + scoring",
                  "7-day email nurture sequence",
                  "SMS follow-up system",
                  "Booking page + objection handling",
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

            <LgCard padded={false}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Eyebrow>Deal economics</Eyebrow>
              </div>
              <div className="flex flex-col" style={{ padding: 14, gap: 10 }}>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6 }}>Setup fee</div>
                  <div
                    className="lg-display tnum"
                    style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--text)" }}
                  >
                    $6,500
                    <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>one-time</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "oklch(0.55 0.10 158 / 0.08)",
                    border: "1px solid oklch(0.55 0.10 158 / 0.18)",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "oklch(0.78 0.10 158)", marginBottom: 6 }}>Monthly retainer</div>
                  <div
                    className="lg-display tnum"
                    style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--money)" }}
                  >
                    $1k–$2k
                    <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>/mo</span>
                  </div>
                </div>
                <div className="flex justify-between" style={{ padding: "2px 2px", fontSize: 11.5 }}>
                  <span style={{ color: "var(--text-3)" }}>12-mo deal value</span>
                  <span className="lg-mono tnum" style={{ color: "var(--text)", fontWeight: 500 }}>
                    $18,500–$30,500
                  </span>
                </div>
              </div>
            </LgCard>

            <LgCard padded={false}>
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
                    onClick={isAudit ? startCold : start}
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
                      {isAudit
                        ? coldRunning
                          ? "Generating…"
                          : coldAudit
                          ? "Regenerate cold audit"
                          : "Generate cold audit"
                        : running
                        ? "Generating…"
                        : done
                        ? "Regenerate asset pack"
                        : "Generate asset pack"}
                    </span>
                  </LgButton>
                </div>
                {busy && (
                  <button
                    onClick={isAudit ? () => coldAbortRef.current?.abort() : cancel}
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
                  {isAudit
                    ? "A free, specific mini-report to send before you pitch"
                    : "Grounded in their live website + Google Places data"}
                </div>
              </div>
            </LgCard>

            {!isAudit && (running || done) && (
              <LgCard padded={false}>
                <div
                  className="flex justify-between items-center"
                  style={{
                    padding: "14px 20px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Eyebrow>Thinking</Eyebrow>
                  {done && <LgBadge tone="success">complete</LgBadge>}
                </div>
                <div className="flex flex-col" style={{ padding: 16, gap: 10 }}>
                  {THINKING_STEPS.map((s, i) => {
                    const isDone = i < activeStep || done;
                    const isActive = i === activeStep && !done;
                    return (
                      <div
                        key={i}
                        className="flex items-center"
                        style={{
                          gap: 10,
                          opacity: i > activeStep && !done ? 0.4 : 1,
                        }}
                      >
                        {isDone ? (
                          <div
                            className="grid place-items-center flex-none"
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 99,
                              background: "var(--success)",
                              color: "white",
                            }}
                          >
                            <Check size={10} strokeWidth={3} />
                          </div>
                        ) : isActive ? (
                          <Spinner small />
                        ) : (
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 99,
                              border: "1.5px solid var(--border-strong)",
                              flex: "none",
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            color: isActive ? "var(--text)" : "var(--text-muted)",
                            fontWeight: isActive ? 600 : 500,
                          }}
                        >
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </LgCard>
            )}
          </div>

          {/* RIGHT: output */}
          <LgCard
            padded={false}
            style={{
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
                <ViewToggle value={view} onChange={setView} />
                {selected && (
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
                    {selected.name}
                  </span>
                )}
              </div>
              <div className="flex items-center" style={{ gap: 8 }}>
                {isAudit && coldRunning && (
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
                {isAudit && !coldRunning && coldAudit && (
                  <LgBadge tone="success">
                    <Check size={11} strokeWidth={2.5} /> Ready to send
                  </LgBadge>
                )}
                {!isAudit && running && (
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
                {!isAudit && done && (
                  <LgBadge tone="success">
                    <Check size={11} strokeWidth={2.5} /> Generated
                  </LgBadge>
                )}
                {isAudit
                  ? !coldRunning && !coldAudit && (
                      <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Ready</span>
                    )
                  : !running && !done && (
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
                  Save a business first to use AI Studio.
                </div>
              )}

              {/* ── COLD AUDIT VIEW ── */}
              {selected && isAudit && coldRunning && (
                <ColdGeneratingState business={selected} />
              )}
              {selected && isAudit && !coldRunning && !coldAudit && (
                <ColdEmptyState business={selected} />
              )}
              {selected && isAudit && !coldRunning && coldAudit && (
                <ColdAuditView report={coldAudit} businessId={selected.id} />
              )}

              {/* ── ASSET PACK VIEW ── */}
              {selected && !isAudit && !running && !done && !restoring && (
                <EmptyState business={selected} />
              )}
              {selected && !isAudit && !running && !done && restoring && (
                <div
                  className="text-center"
                  style={{ padding: "64px 20px", color: "var(--text-muted)", fontSize: 13.5 }}
                >
                  Checking for a saved deliverable…
                </div>
              )}
              {!isAudit && running && <GeneratingState business={selected} />}
              {!isAudit && done && pack && selected && (
                <>
                  {restoredAt && !running && (
                    <div
                      style={{
                        margin: "0 0 18px",
                        padding: "10px 14px",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        fontSize: 12.5,
                        color: "var(--text-3)",
                      }}
                    >
                      <span>
                        Restored from your last session ·{" "}
                        <span className="lg-mono tnum" style={{ color: "var(--text-2)" }}>
                          {new Date(restoredAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <div className="flex items-center" style={{ gap: 8 }}>
                        <button
                          onClick={start}
                          disabled={running}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--line)",
                            color: "var(--text-2)",
                            padding: "5px 12px",
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: running ? "default" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={reset}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--line)",
                            color: "var(--text-3)",
                            padding: "5px 12px",
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  <AssetPackView pack={pack} businessId={selected.id} onUpdate={setPack} />
                </>
              )}
            </div>
          </LgCard>
        </div>
      </div>
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
        border: `2px solid ${small ? "var(--accent-soft)" : "color-mix(in oklch, white 30%, transparent)"}`,
        borderTopColor: small ? "var(--accent)" : "white",
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
          border: "1px solid var(--border-strong)",
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
          border: "1px solid var(--border-strong)",
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
            border: "1px solid var(--border)",
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

function EmptyState({ business }: { business: SavedBusiness }) {
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
        A complete growth asset pack for <strong style={{ color: "var(--text)" }}>{business.name}</strong> —
        landing page copy, lead capture, a 7-day email sequence, SMS follow-ups, and booking page
        positioning, written from their real website and Places data.
      </p>
    </div>
  );
}

function GeneratingState({ business }: { business: SavedBusiness | null }) {
  return (
    <div className="text-center" style={{ padding: "72px 20px", color: "var(--text-muted)" }}>
      <div className="mx-auto" style={{ width: 22, marginBottom: 20 }}>
        <Spinner />
      </div>
      <p style={{ fontSize: 14 }}>
        Analyzing {business?.name ?? "the business"} and writing custom assets…
      </p>
      <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 6 }}>
        This usually takes 15–40 seconds.
      </p>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: StudioView;
  onChange: (v: StudioView) => void;
}) {
  const options: { id: StudioView; label: string }[] = [
    { id: "pack", label: "Asset Pack" },
    { id: "audit", label: "Cold Audit" },
  ];
  return (
    <div
      className="flex items-center"
      style={{
        gap: 2,
        padding: 3,
        borderRadius: 9,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--line)",
      }}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              border: "none",
              color: active ? "var(--accent)" : "var(--text-3)",
              background: active ? "var(--accent-soft)" : "transparent",
            }}
          >
            {o.id === "audit" ? (
              <Send size={12} strokeWidth={2} />
            ) : (
              <Sparkles size={12} strokeWidth={2} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ColdEmptyState({ business }: { business: SavedBusiness }) {
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
        <Send size={20} strokeWidth={1.75} />
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
        Cold-open audit
      </h3>
      <p style={{ margin: "0 auto", maxWidth: 440, fontSize: 14, lineHeight: 1.55 }}>
        A free, one-page mini-report for{" "}
        <strong style={{ color: "var(--text)" }}>{business.name}</strong> — 3–5 specific things
        quietly costing them customers, grounded in their real site speed, screenshot, and reviews,
        with one soft, editable close. Send it before you pitch to earn the reply.
      </p>
    </div>
  );
}

function ColdGeneratingState({ business }: { business: SavedBusiness | null }) {
  return (
    <div className="text-center" style={{ padding: "72px 20px", color: "var(--text-muted)" }}>
      <div className="mx-auto" style={{ width: 22, marginBottom: 20 }}>
        <Spinner />
      </div>
      <p style={{ fontSize: 14 }}>
        Inspecting {business?.name ?? "the business"} for the sharpest, most specific findings…
      </p>
      <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 6 }}>
        Measuring real site speed and reading their pages. This usually takes 15–40 seconds.
      </p>
    </div>
  );
}
