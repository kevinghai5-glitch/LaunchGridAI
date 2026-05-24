"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import type { AssetPack, SavedBusiness } from "@/types";

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
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  const start = async () => {
    if (!selected || running) return;
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
    } catch {
      toast.error("Failed to generate assets");
      setActiveStep(-1);
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      setRunning(false);
    }
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
              One click generates a complete growth asset pack, custom-written for the business.
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
              <div style={{ padding: 16 }}>
                <div className="relative">
                  {!running && (
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
                    {running ? <Spinner /> : null}
                    <span style={{ position: "relative" }}>
                      {running
                        ? "Generating…"
                        : done
                        ? "Regenerate asset pack"
                        : "Generate asset pack"}
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
                  Grounded in their live website + Google Places data
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
              <div className="flex items-center" style={{ gap: 10 }}>
                <Sparkles size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Growth Asset Pack
                  {selected && (
                    <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                      {" "}· {selected.name}
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
                  Save a business first to use AI Studio.
                </div>
              )}
              {selected && !running && !done && <EmptyState business={selected} />}
              {running && <GeneratingState business={selected} />}
              {done && pack && <AssetPackOutput pack={pack} />}
            </div>
          </LgCard>
        </div>
      </div>
    </>
  );
}

/* ---------- Asset pack renderer (theme-aware via CSS vars) ---------- */

function AssetPackOutput({ pack }: { pack: AssetPack }) {
  return (
    <div className="lg-fade-in">
      <Section title="Analysis">
        <Para>{pack.businessSummary?.positioning}</Para>
        <Label>Services</Label>
        <Bullets items={pack.businessSummary?.services} />
        <Label>Strengths</Label>
        <Bullets items={pack.businessSummary?.strengths} />
        <Label>Opportunities to fix</Label>
        <Bullets items={pack.businessSummary?.opportunities} />
        <Label>Local angle</Label>
        <Para>{pack.businessSummary?.localAngle}</Para>
      </Section>

      <Section title="Landing Page Copy">
        <Quote>{pack.landingPage?.heroHeadline}</Quote>
        <Para>{pack.landingPage?.heroSubheadline}</Para>
        <Label>Offer & positioning</Label>
        <Para>{pack.landingPage?.offer}</Para>
        <Label>Primary CTA</Label>
        <Para>{pack.landingPage?.ctaPrimary}</Para>
        <Label>Urgency framing</Label>
        <Para>{pack.landingPage?.ctaUrgency}</Para>
        <Label>Trust signals</Label>
        <Bullets items={pack.landingPage?.trustSignals} />
      </Section>

      <Section title="Lead Capture & Qualification">
        <Label>Qualification questions</Label>
        <Bullets items={pack.leadCapture?.qualificationQuestions} />
        <Label>Intake flow</Label>
        <Numbered items={pack.leadCapture?.intakeFlow} />
        <Label>Lead scoring</Label>
        <Para>{pack.leadCapture?.leadScoring}</Para>
        <Label>Thank-you page</Label>
        <Para>{pack.leadCapture?.thankYouPage}</Para>
      </Section>

      <Section title="7-Day Email Sequence">
        {pack.emailSequence?.map((e, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div
              className="flex items-center"
              style={{ gap: 8, marginBottom: 4 }}
            >
              <LgBadge tone="accent">Day {e.day}</LgBadge>
              <span style={{ fontSize: 12, color: "var(--text-subtle)", textTransform: "capitalize" }}>
                {e.purpose}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {e.subject}
            </div>
            <Para>{e.body}</Para>
          </div>
        ))}
      </Section>

      <Section title="SMS Follow-Up System">
        {pack.smsSequence?.map((m, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {m.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>· {m.timing}</span>
            </div>
            <Para>{m.message}</Para>
          </div>
        ))}
      </Section>

      <Section title="Booking Page & Offer Positioning">
        <Label>What to expect</Label>
        <Bullets items={pack.bookingPage?.whatToExpect} />
        <Label>Social proof structure</Label>
        <Para>{pack.bookingPage?.socialProofStructure}</Para>
        <Label>Objection handling</Label>
        {pack.bookingPage?.objectionHandling?.map((o, i) => (
          <div
            key={i}
            style={{
              borderLeft: "2px solid var(--accent)",
              paddingLeft: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {o.objection}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>
              {o.response}
            </div>
          </div>
        ))}
        <Label>Appointment framing</Label>
        <Para>{pack.bookingPage?.appointmentFraming}</Para>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--text-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        margin: "16px 0 6px",
      }}
    >
      {children}
    </div>
  );
}

function Para({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      style={{
        margin: "0 0 4px",
        fontSize: 14.5,
        lineHeight: 1.65,
        color: "var(--text)",
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </p>
  );
}

function Quote({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <blockquote
      style={{
        margin: "0 0 12px",
        padding: "16px 20px",
        borderLeft: "3px solid var(--accent)",
        background: "var(--accent-soft)",
        borderRadius: "0 var(--radius) var(--radius) 0",
        fontSize: 19,
        fontWeight: 600,
        lineHeight: 1.4,
        color: "var(--text)",
      }}
    >
      {children}
    </blockquote>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start" style={{ gap: 12, padding: "6px 0" }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "var(--accent)",
              marginTop: 8,
              flex: "none",
            }}
          />
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--text)" }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function Numbered({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start" style={{ gap: 12, padding: "6px 0" }}>
          <span
            className="grid place-items-center flex-none"
            style={{
              width: 20,
              height: 20,
              borderRadius: 99,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 700,
              marginTop: 1,
            }}
          >
            {i + 1}
          </span>
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--text)" }}>{item}</span>
        </div>
      ))}
    </div>
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
