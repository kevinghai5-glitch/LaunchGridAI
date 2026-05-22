"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import {
  buildLeadSystemTokens,
  buildContentSystemTokens,
  type StreamToken,
} from "@/lib/system-tokens";
import type { SavedBusiness } from "@/types";

const SYSTEM_TYPES = [
  {
    id: "lead" as const,
    label: "Lead Capture System",
    desc: "Complete lead funnel: hook, qualifying questions, follow-up sequence.",
  },
  {
    id: "content" as const,
    label: "30-Day Content System",
    desc: "Posting plan, content pillars, hooks, and local angles.",
  },
];

const THINKING_STEPS = [
  "Looking up business in Google Places",
  "Reading reviews & local context",
  "Drafting offer positioning",
  "Generating components",
  "Polishing copy & formatting",
];

export default function StudioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const businessId = params.get("businessId");

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [selected, setSelected] = useState<SavedBusiness | null>(null);
  const [systemType, setSystemType] = useState<"lead" | "content">("lead");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [tokens, setTokens] = useState<StreamToken[]>([]);
  const [activeStep, setActiveStep] = useState(-1);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => {
        const list: SavedBusiness[] = data.businesses ?? [];
        setBusinesses(list);
        const pick = businessId
          ? list.find((b) => b.id === businessId)
          : list[0];
        if (pick) setSelected(pick);
      })
      .catch(() => {});
  }, [businessId]);

  useEffect(() => {
    if (outRef.current && running) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [tokens, running]);

  const start = () => {
    if (!selected || running) return;
    setRunning(true);
    setDone(false);
    setTokens([]);
    setActiveStep(0);

    const blocks =
      systemType === "lead"
        ? buildLeadSystemTokens({
            name: selected.name,
            industry: selected.industry ?? "business",
            city: selected.city ?? "your city",
            reviewCount: selected.reviewCount,
          })
        : buildContentSystemTokens({
            name: selected.name,
            industry: selected.industry ?? "business",
            city: selected.city ?? "your city",
            reviewCount: selected.reviewCount,
          });

    let s = 0;
    const stepTimer = setInterval(() => {
      s++;
      if (s >= THINKING_STEPS.length) clearInterval(stepTimer);
      else setActiveStep(s);
    }, 700);

    let i = 0;
    const tick = () => {
      if (i >= blocks.length) {
        setRunning(false);
        setDone(true);
        setActiveStep(THINKING_STEPS.length);
        return;
      }
      const b = blocks[i];
      setTokens((prev) => [...prev, b]);
      i++;
      const delay =
        b.kind === "h1" || b.kind === "section" ? 240 : b.kind === "li" ? 160 : 200;
      setTimeout(tick, delay);
    };
    setTimeout(tick, 600);
  };

  return (
    <>
      <TopBar title="AI Studio" />
      <div style={{ padding: "32px 40px 48px", maxWidth: 1320, margin: "0 auto" }}>
        <header
          className="flex justify-between items-end"
          style={{ marginBottom: 24 }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--text)",
              }}
            >
              AI Studio
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14.5 }}>
              One click generates a complete system, custom-written for the business.
            </p>
          </div>
          {done && (
            <div className="flex" style={{ gap: 8 }}>
              <LgButton variant="secondary" icon="copy">
                Copy
              </LgButton>
              <LgButton variant="secondary" icon="download">
                Export PDF
              </LgButton>
              <LgButton
                variant="primary"
                icon="file"
                onClick={() =>
                  router.push(
                    selected ? `/proposals/new?businessId=${selected.id}` : "/proposals/new"
                  )
                }
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
                <Eyebrow>System type</Eyebrow>
              </div>
              <div
                className="flex flex-col"
                style={{ padding: 12, gap: 6 }}
              >
                {SYSTEM_TYPES.map((t) => {
                  const active = systemType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSystemType(t.id)}
                      disabled={running}
                      className="flex text-left"
                      style={{
                        gap: 12,
                        padding: 12,
                        alignItems: "flex-start",
                        background: active ? "var(--accent-soft)" : "transparent",
                        border: active
                          ? "1.5px solid var(--accent)"
                          : "1.5px solid transparent",
                        borderRadius: "var(--radius)",
                        cursor: running ? "not-allowed" : "pointer",
                        color: "inherit",
                        fontFamily: "inherit",
                        opacity: running ? 0.6 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 99,
                          marginTop: 2,
                          flex: "none",
                          border: `2px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                          background: active ? "var(--accent)" : "var(--surface)",
                          boxShadow: active ? "inset 0 0 0 3px var(--surface)" : "none",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                          {t.label}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {t.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </LgCard>

            <LgCard padded={false}>
              <div style={{ padding: 16 }}>
                <div className="relative">
                  {!running && !done && (
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
                    icon={running ? undefined : "sparkles"}
                    onClick={start}
                    disabled={running || !selected}
                    style={{
                      width: "100%",
                      position: "relative",
                      zIndex: 1,
                      overflow: "hidden",
                    }}
                  >
                    {!running && !done && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)",
                          backgroundSize: "200% 100%",
                          animation: "lg-shimmer-x 2.6s ease-in-out infinite",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    {running ? <Spinner /> : null}
                    <span style={{ position: "relative" }}>
                      {running ? "Generating…" : done ? "Regenerate" : "Generate system"}
                    </span>
                  </LgButton>
                </div>
                <div
                  className="text-center"
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--text-subtle)",
                  }}
                >
                  ~50 seconds · 4o · grounded with Places data
                </div>
              </div>
            </LgCard>

            {(running || done) && (
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
                <div
                  className="flex flex-col"
                  style={{ padding: 16, gap: 10 }}
                >
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

          {/* RIGHT: streaming output */}
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
              <div className="flex items-center" style={{ gap: 10 }}>
                <Sparkles size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {systemType === "lead"
                    ? "Lead Capture System"
                    : "30-Day Content System"}{" "}
                  {selected && (
                    <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                      · {selected.name}
                    </span>
                  )}
                </div>
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
                      Streaming
                    </span>
                  </>
                )}
                {done && (
                  <LgBadge tone="success">
                    <Check size={11} strokeWidth={2.5} /> Generated
                  </LgBadge>
                )}
                {!running && !done && (
                  <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                    Ready
                  </span>
                )}
              </div>
            </div>

            <div
              ref={outRef}
              style={{
                flex: 1,
                padding: "32px 40px",
                overflowY: "auto",
                background: "var(--surface)",
              }}
            >
              {!running && !done && selected && (
                <EmptyState business={selected} systemType={systemType} />
              )}
              {!selected && (
                <div
                  className="text-center"
                  style={{
                    padding: "64px 20px",
                    color: "var(--text-muted)",
                    fontSize: 14,
                  }}
                >
                  Save a business first to use AI Studio.
                </div>
              )}
              {tokens.map((b, i) => (
                <StreamBlock key={i} b={b} />
              ))}
              {running && (
                <span
                  style={{
                    display: "inline-block",
                    width: 9,
                    height: 18,
                    marginLeft: 2,
                    background: "var(--accent)",
                    verticalAlign: "text-bottom",
                    animation: "lg-blink 0.9s steps(1, end) infinite",
                  }}
                />
              )}
            </div>
          </LgCard>
        </div>
      </div>
    </>
  );
}

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

function EmptyState({
  business,
  systemType,
}: {
  business: SavedBusiness;
  systemType: "lead" | "content";
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
      <p style={{ margin: "0 auto", maxWidth: 420, fontSize: 14, lineHeight: 1.55 }}>
        A complete{" "}
        <strong style={{ color: "var(--text)" }}>
          {systemType === "lead" ? "Lead Capture System" : "30-Day Content System"}
        </strong>{" "}
        for {business.name}. The output streams in real time, grounded in their actual reviews
        and Places data.
      </p>
    </div>
  );
}

function StreamBlock({ b }: { b: StreamToken }) {
  if (b.kind === "h1") {
    return (
      <h1
        className="lg-fade-in"
        style={{
          margin: "0 0 8px",
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "var(--text)",
        }}
      >
        {b.text}
      </h1>
    );
  }
  if (b.kind === "subtitle") {
    return (
      <p
        className="lg-fade-in"
        style={{
          margin: "0 0 28px",
          fontSize: 15,
          color: "var(--text-muted)",
        }}
      >
        {b.text}
      </p>
    );
  }
  if (b.kind === "section") {
    return (
      <h2
        className="lg-fade-in"
        style={{
          margin: "32px 0 12px",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {b.text}
      </h2>
    );
  }
  if (b.kind === "p") {
    return (
      <p
        className="lg-fade-in"
        style={{
          margin: "0 0 16px",
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text)",
        }}
      >
        {b.text}
      </p>
    );
  }
  if (b.kind === "quote") {
    return (
      <blockquote
        className="lg-fade-in"
        style={{
          margin: "0 0 16px",
          padding: "16px 20px",
          borderLeft: "3px solid var(--accent)",
          background: "var(--accent-soft)",
          borderRadius: "0 var(--radius) var(--radius) 0",
          fontSize: 18,
          fontStyle: "italic",
          lineHeight: 1.45,
          color: "var(--text)",
          fontWeight: 500,
        }}
      >
        &quot;{b.text}&quot;
      </blockquote>
    );
  }
  if (b.kind === "li") {
    return (
      <div
        className="lg-fade-in flex items-start"
        style={{ gap: 12, padding: "8px 0" }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: "var(--accent)",
            marginTop: 9,
            flex: "none",
          }}
        />
        <span
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          {b.text}
        </span>
      </div>
    );
  }
  return null;
}
