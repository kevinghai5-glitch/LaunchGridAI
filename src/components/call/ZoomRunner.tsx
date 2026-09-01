"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Phone,
  Globe,
  Stethoscope,
  Shuffle,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Clock,
  UserX,
  X,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { ObservedFactsRow } from "@/components/businesses/ObservedFactsRow";
import { ClientOffer } from "@/components/client/ClientOffer";
import { STATUS_META, type LeadStatus, type ZoomOutcome } from "@/lib/call-queue";
// Type-only: the server page computes the four values and ships the small object.
import type { ObservedFacts } from "@/lib/observed-facts";
import type { ClientOffer as Offer } from "@/lib/client-offer";
import { rangeText } from "@/lib/leak-calculator";

interface RunnerBusiness {
  name: string;
  industry: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  status: string;
}

interface ZoomRunnerProps {
  businessId: string;
  business: RunnerBusiness;
  /** The four measured pre-dial values — the Diagnose beat. Replaced the cold
   *  audit (owner ruling, 2026-08-01): same slot on the call, numbers instead of
   *  prose, because a number cannot hallucinate. */
  observedFacts: ObservedFacts | null;
  /** The saved calculator, assembled. Null when it has not been filled in for
   *  this business — the phases then say so and link to it. */
  offer: Offer | null;
}

type PhaseId = "diagnose" | "pivot" | "offer";

const PHASES: { id: PhaseId; n: string; label: string; window: string; icon: typeof Stethoscope }[] = [
  { id: "diagnose", n: "01", label: "Diagnose", window: "0–10 min", icon: Stethoscope },
  { id: "pivot", n: "02", label: "Pivot", window: "10–15 min", icon: Shuffle },
  { id: "offer", n: "03", label: "Offer", window: "15–30 min", icon: FileText },
];

// The four ways a Zoom ends → the lifecycle state each writes (via resolveZoomOutcome).
const OUTCOMES: {
  id: ZoomOutcome;
  label: string;
  hint: string;
  icon: typeof Check;
  tone: "success" | "accent" | "danger" | "muted";
}[] = [
  { id: "CLOSED", label: "Closed — they said yes", hint: "→ Client · send Stripe + intake", icon: Check, tone: "success" },
  { id: "OPEN", label: "Still deciding", hint: "→ Recap + follow up in 2 days", icon: Clock, tone: "accent" },
  { id: "NO_SHOW", label: "No-show", hint: "→ Rebook the Zoom", icon: UserX, tone: "muted" },
  { id: "LOST", label: "Not interested", hint: "→ Lost", icon: X, tone: "danger" },
];

function toneColor(tone: "success" | "accent" | "danger" | "muted"): string {
  if (tone === "success") return "var(--money)";
  if (tone === "accent") return "var(--accent)";
  if (tone === "danger") return "oklch(0.62 0.2 25)";
  return "var(--text-3)";
}

export function ZoomRunner({ businessId, business, observedFacts, offer }: ZoomRunnerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<PhaseId>("diagnose");
  const [submitting, setSubmitting] = useState<ZoomOutcome | null>(null);

  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  const meta = STATUS_META[business.status as LeadStatus];
  const subtitle = [business.city, business.industry].filter(Boolean).join(" · ") || "On the Zoom";

  const recordOutcome = async (outcome: ZoomOutcome) => {
    setSubmitting(outcome);
    try {
      const res = await fetch(`/api/businesses/${businessId}/zoom-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error();
      const done = OUTCOMES.find((o) => o.id === outcome);
      toast.success(done ? done.label : "Outcome recorded");
      router.push("/crm");
      router.refresh();
    } catch {
      toast.error("Couldn't record the outcome");
      setSubmitting(null);
    }
  };

  return (
    <>
      <TopBar title={business.name} subtitle={subtitle} />

      <div style={{ padding: "24px 40px 140px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        {/* Header: who + how to reach them + the phase stepper */}
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 16, marginBottom: 22 }}>
          <div>
            <div className="flex items-center" style={{ gap: 10 }}>
              <h1 className="lg-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
                {business.name}
              </h1>
              {meta && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 999,
                    color: toneColor(meta.tone === "neutral" ? "muted" : meta.tone),
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {meta.label}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 14, marginTop: 8, fontSize: 13, color: "var(--text-3)" }}>
              {business.phone && (
                <span className="flex items-center" style={{ gap: 5 }}>
                  <Phone size={13} strokeWidth={1.9} /> {business.phone}
                </span>
              )}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                  style={{ gap: 5, color: "var(--text-3)", textDecoration: "none" }}
                >
                  <Globe size={13} strokeWidth={1.9} /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Phase stepper */}
        <div className="flex items-center" style={{ gap: 8, marginBottom: 24 }}>
          {PHASES.map((p, i) => {
            const active = p.id === phase;
            const passed = i < phaseIndex;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className="flex items-center hover-lift"
                style={{
                  flex: 1,
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.4)" : "var(--line)"}`,
                }}
              >
                <span
                  className="grid place-items-center"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    flex: "none",
                    background: active ? "var(--accent-grad)" : passed ? "var(--money-soft, rgba(52,199,89,0.12))" : "var(--surface-2)",
                    color: active ? "#fff" : passed ? "var(--money)" : "var(--text-3)",
                  }}
                >
                  {passed ? <Check size={15} strokeWidth={2.4} /> : <Icon size={15} strokeWidth={2} />}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="lg-mono" style={{ display: "block", fontSize: 10.5, color: active ? "var(--accent)" : "var(--text-4)" }}>
                    {p.n} · {p.window}
                  </span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: active ? "var(--text)" : "var(--text-2)" }}>
                    {p.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Phase body */}
        {phase === "diagnose" && <DiagnosePhase facts={observedFacts} />}
        {phase === "pivot" &&
          (offer ? <PivotPhase offer={offer} /> : <NoAssessment businessId={businessId} />)}
        {phase === "offer" &&
          (offer ? <OfferPhase offer={offer} /> : <NoAssessment businessId={businessId} />)}

        {/* Prev / next */}
        <div className="flex items-center justify-between" style={{ marginTop: 24 }}>
          <button
            onClick={() => phaseIndex > 0 && setPhase(PHASES[phaseIndex - 1].id)}
            disabled={phaseIndex === 0}
            className="flex items-center"
            style={{
              gap: 6,
              padding: "9px 14px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: phaseIndex === 0 ? "default" : "pointer",
              opacity: phaseIndex === 0 ? 0.4 : 1,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
            }}
          >
            <ArrowLeft size={14} strokeWidth={2} /> {phaseIndex > 0 ? PHASES[phaseIndex - 1].label : "Back"}
          </button>
          {phaseIndex < PHASES.length - 1 && (
            <button
              onClick={() => setPhase(PHASES[phaseIndex + 1].id)}
              className="flex items-center"
              style={{
                gap: 6,
                padding: "9px 16px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                background: "var(--accent-grad)",
                border: "1px solid var(--accent)",
                color: "#fff",
              }}
            >
              {PHASES[phaseIndex + 1].label} <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Sticky outcome bar — record how the Zoom ended from any phase */}
      <div
        className="flex items-center"
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 20,
          gap: 10,
          padding: "14px 40px",
          background: "rgba(9, 9, 10, 0.72)",
          borderTop: "1px solid var(--line)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginRight: 4 }}>
          How did it end?
        </span>
        {OUTCOMES.map((o) => {
          const Icon = o.icon;
          const busy = submitting === o.id;
          const c = toneColor(o.tone);
          return (
            <button
              key={o.id}
              onClick={() => recordOutcome(o.id)}
              disabled={submitting !== null}
              title={o.hint}
              className="flex items-center"
              style={{
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: submitting !== null ? "default" : "pointer",
                opacity: submitting !== null && !busy ? 0.5 : 1,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: c,
              }}
            >
              {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Icon size={14} strokeWidth={2} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Phase 1: Diagnose — the four measured numbers, read out loud ──────────────
// Same beat the cold audit used to fill, numbers instead of prose (the audit was
// deleted by owner ruling, 2026-08-01: the money math happens live on the Zoom
// in a separate calculator, and four measured values on a screen prove we looked
// better than a generated document — a number cannot hallucinate). "—" means "we
// could not see", which is a different fact from "nothing is wrong", and the row
// keeps them different on screen.
function DiagnosePhase({ facts }: { facts: ObservedFacts | null }) {
  return (
    <div className="panel" style={{ padding: 20, borderRadius: 14 }}>
      <ScriptCue text="Share your screen. Read the measured numbers out loud — worth-fixing first — then pivot: the outside is the smaller half, and the interesting leaks are the ones a scan can't see." />
      <div style={{ marginTop: 12 }}>
        <ObservedFactsRow facts={facts} framed={false} />
      </div>
    </div>
  );
}

// ── Phase 2: Pivot — each leak becomes the thing we deploy (DIY vs DFY) ─────────
// Both halves of every pair come from the calculator: the answer they gave and
// the figure it carries on the left, the fix defined against that same question
// on the right. Nothing here is written for the call — it is the row they just
// watched being filled in.
function PivotPhase({ offer }: { offer: Offer }) {
  return (
    <div className="panel" style={{ padding: 24, borderRadius: 14 }}>
      <ScriptCue text="Pivot from pain to path: “Here's exactly what's leaking, and here's what closes each one.” Then frame the choice — do it yourself, or have us build and run it." />

      {offer.allClean && (
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 16, lineHeight: 1.55 }}>
          Every area came back covered. There is no leak column to walk — go straight to
          what the build makes automatic.
        </p>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {offer.leakRows.map((row) => (
          <div
            key={row.id}
            className="flex items-stretch"
            style={{ gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}
          >
            <div style={{ flex: 1, padding: "14px 16px", background: "rgba(255,80,80,0.04)" }}>
              <div className="lg-mono" style={{ fontSize: 10.5, color: "oklch(0.62 0.2 25)", marginBottom: 4 }}>
                LEAK · {rangeText(row.monthlyLow ?? 0, row.monthlyHigh ?? 0)}/MO
                {row.assumed ? " · ASSUMED" : ""}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{row.label}</div>
              {row.consequence && (
                <p style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 5, lineHeight: 1.55 }}>
                  {row.consequence}
                </p>
              )}
            </div>
            <div className="grid place-items-center" style={{ width: 40, flex: "none", background: "var(--surface-2)" }}>
              <ArrowRight size={16} strokeWidth={2} style={{ color: "var(--text-4)" }} />
            </div>
            <div style={{ flex: 1, padding: "14px 16px", background: "rgba(52,199,89,0.04)" }}>
              <div className="lg-mono" style={{ fontSize: 10.5, color: "var(--money)", marginBottom: 4 }}>
                WE DEPLOY
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 0, lineHeight: 1.55 }}>
                {row.fix || "Covered in the build"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* DIY vs DFY framing */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
        <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Do it yourself</div>
          <p style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 6, lineHeight: 1.55 }}>
            You take the blueprint and build it in-house. It works — if you have the time and someone
            to own it. Most don&apos;t, which is why the leak is still open.
          </p>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid oklch(0.55 0.18 248 / 0.4)", background: "var(--accent-soft)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Done for you</div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, lineHeight: 1.55 }}>
            We build and run the whole system — {offer.installedCount} automations, live in two
            weeks, then managed monthly. That&apos;s the offer on the next screen.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Phase 3: Offer — present the two-part investment live ───────────────────────
// The SAME component the share link renders. What he presents and what he sends
// are one artefact, so there is no version of the offer that only exists live.
function OfferPhase({ offer }: { offer: Offer }) {
  return (
    <div>
      <div className="panel" style={{ padding: 20, borderRadius: 14, marginBottom: 14 }}>
        <ScriptCue text="Present the investment, then make the verbal ask: “That's the setup plus the monthly to keep it running — want me to get you started?” Then stop talking." />
      </div>
      <div
        style={{
          border: "1px solid #E7E3D8",
          borderRadius: 12,
          overflow: "hidden",
          maxHeight: 720,
          overflowY: "auto",
          background: "#FBFAF7",
        }}
      >
        <ClientOffer offer={offer} />
      </div>
    </div>
  );
}

// No saved calculator for this business. Says so and links to it, rather than
// rendering an offer nobody agreed to — a made-up figure on a live call is
// unrecoverable in a way an empty panel is not.
function NoAssessment({ businessId }: { businessId: string }) {
  return (
    <div className="panel" style={{ padding: 24, borderRadius: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        No calculator saved for this business yet
      </div>
      <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8, lineHeight: 1.6, maxWidth: "60ch" }}>
        The leak figures and the offer are both built from it. Open the calculator, fill it
        in on the call, and both of these screens fill themselves.
      </p>
      {/* ITS OWN TAB. This link is used mid-Zoom with the prospect watching a
          shared tab — opening the calculator in place would put the runner, and
          whatever else is on this screen, in front of them on the way there. */}
      <a
        href={`/library/${businessId}/calculator`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          marginTop: 16,
          padding: "10px 16px",
          borderRadius: 10,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Open the calculator
        <ArrowRight size={14} strokeWidth={2.2} />
      </a>
    </div>
  );
}

// A one-line coaching cue at the top of each phase — what to actually say/do.
function ScriptCue({ text }: { text: string }) {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 9,
        padding: "11px 14px",
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        fontSize: 12.5,
        color: "var(--text-2)",
        lineHeight: 1.55,
      }}
    >
      <span style={{ color: "var(--accent)", fontWeight: 700, flex: "none" }}>›</span>
      <span>{text}</span>
    </div>
  );
}
