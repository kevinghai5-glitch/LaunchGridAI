"use client";

// The operator-facing half of the Phase 0.6 governance override.
//
// The gates themselves are server-side (src/lib/exporters/validate-pack.ts —
// `assertPackValid` blocks, `evaluateOverride` decides whether a waiver counts).
// This file is the only place the operator ever meets one.
//
// It exists because a 422 from those gates used to arrive as
// `toast.error(data.error)`. A toast is one truncated line; a blocked pack can
// carry a dozen separate law failures, each quoting the exact copy that broke
// it. So the real reason was, in practice, lost — and a rule nobody can read is
// a rule that eventually gets commented out.
//
// Two jobs:
//   1. Render EVERY failing check in full — law, level, whole message, nothing
//      truncated or summarised. This is also what makes the override honest:
//      the server grants one only when the caller echoes back the id of every
//      check failing RIGHT NOW, and the only way to hold those ids is to have
//      been sent — and therefore shown — the list.
//   2. Take a written reason and re-post it. No reason, no override.
//
// Generation gets NO override. A pack that fails at generation is regenerated,
// never forced — so that boundary uses this same dialog with the confirm half
// switched off. Reading which laws broke is just as useful there.

import { useEffect, useRef, useState } from "react";
import { FileWarning, Loader2, ShieldAlert, X } from "lucide-react";
import type { PackCheckLevel, PackGovernance, PackValidationCheck } from "@/types";

/** Which boundary produced the list on screen. Drives every sentence, and
 *  whether an override is offered at all. `record` is not a gate — it is the
 *  historical view of a pack that already shipped over one. */
export type PackGateBoundary = "export" | "save" | "generate" | "record";

/** A blocked gate's 422 body, normalised. Deliberately a subset of what the
 *  routes send: see `parsePackGateFailure` for the three fields we drop. */
export interface PackGateFailure {
  /** Every finding that blocked, each carrying its stable id. This is BOTH what
   *  gets rendered and, verbatim, what an override acknowledges. */
  checks: PackValidationCheck[];
  /** Non-fatal findings. Shown for completeness; never a reason to block. */
  warnings: PackValidationCheck[];
  /** Set when a previous override attempt was REFUSED — most often because the
   *  pack changed between being shown the list and confirming, so the echoed
   *  ids no longer match. The list below is then the new, current one. */
  overrideError?: string;
}

// Hard cap on the stored reason, mirroring MAX_OVERRIDE_REASON_LENGTH in
// src/lib/exporters/validate-pack.ts. Repeated as a literal rather than
// imported so this client component doesn't pull the whole validator (and its
// brand/leak-narrative deps) into the browser bundle — same trade the Library
// page makes with the deliverable titles. If it changes there, change it here.
const MAX_REASON_LENGTH = 2000;

const LEVEL_STYLE: Record<PackCheckLevel, { fg: string; bg: string }> = {
  fail: { fg: "var(--danger)", bg: "var(--danger-soft)" },
  warn: { fg: "var(--warn)", bg: "var(--warn-soft)" },
  pass: { fg: "var(--money)", bg: "var(--money-soft)" },
};

const plural = (n: number) => (n === 1 ? "" : "s");

// Wording per boundary. The tone target is a good force-push confirmation: say
// exactly what is about to happen and what gets written down, then get out of
// the way. The operator owns this business — this is a legitimate escape hatch,
// not a scolding.
const COPY: Record<
  PackGateBoundary,
  {
    title: (n: number) => string;
    intro: string;
    confirmLabel?: string;
    consequence?: string;
  }
> = {
  export: {
    title: (n) => `Export blocked — ${n} failing check${plural(n)}`,
    intro:
      "The pack renders fine; it breaks its own deliverable laws. Read what broke. Regenerating is the clean fix — but if a check is wrong about this pack, you can export over it and the fact gets written down.",
    confirmLabel: "Export anyway",
    consequence:
      "The ZIP downloads with these violations still in it. Your reason and the exact checks above are recorded on this pack and inside the archive. All of that is internal — none of it renders into anything the client opens.",
  },
  save: {
    title: (n) => `Save blocked — ${n} failing check${plural(n)}`,
    intro:
      "Nothing was written; whatever is already in the Library for this business is untouched. Read what broke, then regenerate — or save over it and the fact gets written down.",
    confirmLabel: "Save anyway",
    consequence:
      "The pack enters the Library carrying these violations. Your reason and the exact checks above are stored on the row. Internal only — no renderer reads it.",
  },
  generate: {
    title: (n) => `Generation refused — ${n} failing check${plural(n)}`,
    intro:
      "The generator would not hand this pack back, and nothing was saved. There is no override here on purpose: a pack that fails at generation gets regenerated, not forced. Fix the inputs — usually the intake answers — and run it again.",
  },
  record: {
    title: (n) => `This pack shipped over ${n} failing check${plural(n)}`,
    intro:
      "Recorded when someone chose to ship over these checks. Kept so nobody has to remember. This is an internal note — the client's documents are unaffected and say nothing about it.",
  },
};

// ── Wire parsing ──────────────────────────────────────────────────────────────

function asChecks(value: unknown): PackValidationCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is PackValidationCheck => {
    if (!c || typeof c !== "object") return false;
    const x = c as Partial<PackValidationCheck>;
    // `id` is required, not cosmetic: it is the token the override handshake
    // echoes back. A check without one could never be acknowledged, so treating
    // it as renderable would promise an override that can't be granted.
    return (
      typeof x.id === "string" &&
      typeof x.law === "string" &&
      typeof x.message === "string" &&
      (x.level === "fail" || x.level === "warn" || x.level === "pass")
    );
  });
}

/**
 * Turn a 422 body (export / save) or an ndjson `{type:"error"}` frame
 * (generate) into something renderable. Returns null when the payload carries
 * no structured checks at all — the caller then falls back to a plain toast,
 * because a dialog with an empty list is worse than a sentence.
 *
 * THREE FIELDS ARE DELIBERATELY DROPPED:
 *  · `report` — the flattened one-line-per-check CLI string. It restates the
 *    same findings we are about to render individually.
 *  · `violations` — on the export route this already contains the rendered-HTML
 *    findings AND a flattened restatement of the pack-validator report, while
 *    `fatalChecks` contains those same rendered-HTML findings promoted to real
 *    checks (see validateRenderedDeliverables). Rendering both would show every
 *    violation twice.
 *  · `error` — the route's own headline, e.g. "…fails 3 of its own deliverable
 *    laws: Law 2, Law 5". A summary of the list that is about to be shown whole.
 */
export function parsePackGateFailure(payload: unknown): PackGateFailure | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;

  // `fatalChecks` is the authoritative set on both gates — everything that
  // blocked, in one uniform id-carrying list, and exactly what an override must
  // acknowledge. `checks` is the fallback for the generation stream, which has
  // no override and so only ships the pack-validator failures.
  const fatal = asChecks(body.fatalChecks);
  const checks = fatal.length ? fatal : asChecks(body.checks);
  if (!checks.length) return null;

  return {
    checks,
    warnings: asChecks(body.warnings),
    overrideError: typeof body.overrideError === "string" ? body.overrideError : undefined,
  };
}

/** The payload both gates accept. Shape fixed by `evaluateOverride`. */
export interface PackOverridePayload {
  reason: string;
  acknowledgedChecks: string[];
}

// ── The check list (read-only, shared by every mode) ──────────────────────────

function CheckRow({ check }: { check: PackValidationCheck }) {
  // Falls back rather than indexing blindly: a governance block replayed out of
  // the database is JSON, and a marker that crashes the whole pack view over one
  // odd `level` value would be a bad trade for a badge.
  const tone = LEVEL_STYLE[check.level] ?? LEVEL_STYLE.fail;
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderLeft: `2px solid ${tone.fg}`,
        borderRadius: 10,
        background: "rgba(255,255,255,0.015)",
        padding: "11px 13px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: tone.fg,
            background: tone.bg,
            borderRadius: 999,
            padding: "2px 7px",
            flex: "none",
          }}
        >
          {check.level}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
          {check.law}
        </span>
        {/* The id is shown because it is the thing that actually gets recorded
            and echoed back on an override — worth being able to read off the
            screen when reconciling a log line later. */}
        <span
          className="lg-mono"
          style={{ fontSize: 10, color: "var(--text-subtle)", marginLeft: "auto" }}
        >
          {check.id}
        </span>
      </div>
      {/* In full. No clamp, no ellipsis: the message quotes the exact copy that
          broke the law, and a truncated quote is not evidence of anything. */}
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--text-2)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {check.message}
      </div>
    </div>
  );
}

// ── The dialog ────────────────────────────────────────────────────────────────

export function PackGateDialog({
  boundary,
  failure,
  busy,
  onClose,
  onConfirm,
  recorded,
}: {
  boundary: PackGateBoundary;
  failure: PackGateFailure;
  busy?: boolean;
  onClose: () => void;
  /** Omit to render read-only (generation, and the historical record view).
   *  `acknowledgedChecks` is derived from the list that was just rendered, so
   *  what the server is told the operator saw and what the operator actually
   *  saw are the same array by construction. */
  onConfirm?: (payload: PackOverridePayload) => void;
  /** Only for boundary "record" — the stored reason and when it was made. */
  recorded?: { reason: string; at: string; boundary: "save" | "export" };
}) {
  const [reason, setReason] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const copy = COPY[boundary];
  const canOverride = Boolean(onConfirm);
  const ready = reason.trim().length > 0 && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  // A refused override sends back the CURRENT failing set, which may differ from
  // the one that was on screen a moment ago. Scroll back to the top so the
  // operator lands on the refusal notice and re-reads from the first check
  // rather than confirming again from wherever they happened to be.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [failure]);

  const confirm = () => {
    if (!onConfirm || !ready) return;
    onConfirm({
      reason: reason.trim(),
      acknowledgedChecks: failure.checks.map((c) => c.id),
    });
  };

  return (
    <div
      // A stray backdrop click must not throw away a typed reason. Escape and
      // Cancel are deliberate acts and still close it.
      onClick={() => {
        if (!busy && !reason.trim()) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "lg-fade-up 0.14s ease-out",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title(failure.checks.length)}
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "flex-start",
            gap: 13,
            padding: "18px 20px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span
            className="grid place-items-center"
            style={{
              flex: "none",
              width: 32,
              height: 32,
              borderRadius: 9,
              background: boundary === "record" ? "var(--warn-soft)" : "var(--danger-soft)",
              color: boundary === "record" ? "var(--warn)" : "var(--danger)",
            }}
          >
            {boundary === "record" ? (
              <ShieldAlert size={16} strokeWidth={1.9} />
            ) : (
              <FileWarning size={16} strokeWidth={1.9} />
            )}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="lg-display"
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--text)",
              }}
            >
              {copy.title(failure.checks.length)}
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--text-3)",
              }}
            >
              {copy.intro}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="grid place-items-center"
            style={{
              flex: "none",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>

        {/* Body — the whole list, scrollable, never truncated */}
        <div
          ref={bodyRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}
        >
          {recorded && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "var(--warn-soft)",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--warn)",
                  marginBottom: 6,
                }}
              >
                Reason given · {recorded.boundary === "export" ? "forced export" : "forced save"} ·{" "}
                <span className="lg-mono tnum" style={{ letterSpacing: 0 }}>
                  {new Date(recorded.at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {recorded.reason}
              </div>
            </div>
          )}

          {failure.overrideError && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                border: "1px solid var(--line-strong)",
                borderRadius: 10,
                background: "var(--danger-soft)",
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--text)",
              }}
            >
              <strong style={{ color: "var(--danger)" }}>That override was refused.</strong>{" "}
              {failure.overrideError}
            </div>
          )}

          <SectionLabel>
            {boundary === "record" ? "Checks waived" : "What blocked"} ·{" "}
            <span className="lg-mono tnum">{failure.checks.length}</span>
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {failure.checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </div>

          {failure.warnings.length > 0 && (
            <>
              <div style={{ marginTop: 18 }}>
                <SectionLabel>
                  Warnings — these never block ·{" "}
                  <span className="lg-mono tnum">{failure.warnings.length}</span>
                </SectionLabel>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {failure.warnings.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer — the reason, or just a way out */}
        <div
          style={{
            flex: "none",
            padding: "14px 20px 16px",
            borderTop: "1px solid var(--line)",
            background: "rgba(255,255,255,0.012)",
          }}
        >
          {canOverride ? (
            <>
              <label
                htmlFor="pack-override-reason"
                style={{
                  display: "block",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-2)",
                  marginBottom: 6,
                }}
              >
                Why this ships anyway
              </label>
              <textarea
                id="pack-override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                autoFocus
                rows={3}
                maxLength={MAX_REASON_LENGTH}
                placeholder="e.g. Law 2 is matching “cold email” inside the client's own quoted testimonial — not a recommendation. Sending for the 4pm call."
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: 8,
                  border: "1px solid var(--line-strong)",
                  background: "var(--bg-deep, #0b0d12)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: "9px 11px",
                  outline: "none",
                }}
              />
              <p
                style={{
                  margin: "9px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: "var(--text-subtle)",
                }}
              >
                {copy.consequence}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button onClick={onClose} disabled={busy} style={ghostButton(busy)}>
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={!ready}
                  // Disabled until a non-empty trimmed reason exists. The server
                  // rejects a blank one anyway (NO_REASON); the button matches
                  // that rule so the operator finds out here, not after a round
                  // trip that looks like a failure.
                  title={ready ? undefined : "Write a reason first"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 15px",
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    color: ready ? "var(--danger)" : "var(--text-4)",
                    background: ready ? "var(--danger-soft)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${ready ? "var(--danger)" : "var(--line)"}`,
                    cursor: ready ? "pointer" : "default",
                  }}
                >
                  {busy && <Loader2 size={13} className="animate-spin" />}
                  {copy.confirmLabel}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} style={ghostButton(false)}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-subtle)",
        marginBottom: 9,
      }}
    >
      {children}
    </div>
  );
}

function ghostButton(busy?: boolean): React.CSSProperties {
  return {
    padding: "8px 15px",
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
    color: "var(--text-2)",
    background: "transparent",
    border: "1px solid var(--line)",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  };
}

// ── The "this one shipped dirty" marker ───────────────────────────────────────

/**
 * Small standing marker for a pack whose governance block is set — i.e. one that
 * was saved or exported over failing checks. INTERNAL ONLY: it reads the pack's
 * own `governance` metadata, which no deliverable renderer touches, and it lives
 * on operator screens exclusively. It must never appear on a client-facing view.
 *
 * Deliberately amber and quiet rather than red and loud. The point is that the
 * operator can tell at a glance, months later, that this particular pack went
 * out over a known violation — not to re-litigate a decision they already made.
 */
export function PackOverrideMarker({ governance }: { governance: PackGovernance }) {
  const [open, setOpen] = useState(false);
  const n = governance.checks.length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Internal record — see what was waived and why"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 11px",
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: "inherit",
          color: "var(--warn)",
          background: "var(--warn-soft)",
          border: "1px solid color-mix(in oklch, var(--warn) 35%, transparent)",
          cursor: "pointer",
        }}
      >
        <ShieldAlert size={12} strokeWidth={2} />
        {governance.boundary === "export" ? "Exported" : "Saved"} over {n} failing check
        {plural(n)}
        <span className="lg-mono tnum" style={{ color: "var(--text-3)", fontWeight: 500 }}>
          {new Date(governance.at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </button>
      {open && (
        <PackGateDialog
          boundary="record"
          failure={{ checks: governance.checks, warnings: [] }}
          recorded={{
            reason: governance.reason,
            at: governance.at,
            boundary: governance.boundary,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
