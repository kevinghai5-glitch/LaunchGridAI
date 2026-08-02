"use client";

// ── The observed-facts row — four measured numbers, read before the dial ──────
//
// The cold audit's replacement is deliberately NOT a document: it is this row.
// One line per value, a quiet verdict label, and two copy actions. Nothing here
// composes a sentence about the business beyond the fixed templates below, and
// the templates only ever interpolate the measured values — no adjectives about
// the business, no inferred claims, no severity theatre ("Critical"). A value
// we could not see renders "—", which is a different fact from "none" and is
// kept different on screen.
//
// TYPES COME IN TYPE-ONLY. The compute lives in src/lib/observed-facts.ts,
// which imports the detection layer; importing its VALUES here would drag the
// whole leak taxonomy into the client bundle (the same trap IntakeGaps.tsx
// documents). The routes compute server-side and ship only the small
// ObservedFacts object; this file renders it and builds copy from it.

import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { BOOKING_URL } from "@/lib/constants";
import type { ObservedFacts, ObservedVerdict } from "@/lib/observed-facts";

// ── Copy builders — exported pure functions so a test can pin them ────────────

/** One paste-able line for call notes. Only values that exist appear; a fully
 *  unmeasured row yields "" (callers disable the button on that). e.g.
 *  "Mobile 77/100 4.1s · Reviews 16 vs local median 5
 *   · Booking link none · Click-to-call found" */
export function buildObservedLine(f: ObservedFacts): string {
  // Verdict suffix only on the numeric rows: "none"/"found" already carry the
  // judgement for the presence rows, and unknown never speaks.
  const tag = (v: ObservedVerdict): string =>
    "";  // OWNER RULE 2026-08-01: the row is PROOF HE LOOKED, not a diagnosis —
      // no verdict ever reaches copy or screen. (tag kept as a no-op so the
      // builder's shape is stable; the threshold logic stays internal.)

  const parts: string[] = [];
  if (f.mobileSpeed.score != null || f.mobileSpeed.loadSeconds != null) {
    const bits = [
      f.mobileSpeed.score != null ? `${f.mobileSpeed.score}/100` : null,
      f.mobileSpeed.loadSeconds != null ? `${f.mobileSpeed.loadSeconds}s` : null,
    ]
      .filter(Boolean)
      .join(" ");
    parts.push(`Mobile ${bits}${tag(f.mobileSpeed.verdict)}`);
  }
  if (f.reviews.count != null) {
    const vs = f.reviews.localAvg != null ? ` vs local ${f.reviews.localAvg}` : "";
    parts.push(`Reviews ${f.reviews.count}${vs}${tag(f.reviews.verdict)}`);
  }
  if (f.bookingLink.state !== "unknown") parts.push(`Booking link ${f.bookingLink.state}`);
  if (f.clickToCall.state !== "unknown") parts.push(`Click-to-call ${f.clickToCall.state}`);
  return parts.join(" · ");
}

/**
 * The "just email me" branch, owner-approved: EXACTLY three sentences, plain
 * text, built from the row's two strongest worth-fixing NUMBERS (the numeric
 * rows only — reviews first because it is the number a prospect can check
 * themselves in ten seconds, then speed) plus our booking link. No attachment
 * language — there is deliberately nothing to attach any more. No hype. Money
 * never appears in this template; if it ever did, it would be CAD.
 *
 * Degrades honestly: one worth-fixing number → the one-number variant; none,
 * but something measured → a no-urgent-findings variant hedged as an industry
 * pattern (never a claim about THIS business); nothing measured at all → ""
 * (the button disables — a template must not claim a look that never happened).
 *
 * `bookingUrl` is a parameter (pass BOOKING_URL) so the function stays pure and
 * pinnable; unset → a VISIBLE "{booking link}" placeholder, never a silent omission.
 */
export function buildObservedEmail(f: ObservedFacts, bookingUrl: string | undefined): string {
  const link = bookingUrl && bookingUrl.trim() ? bookingUrl.trim() : "{booking link}";

  const frags: string[] = [];
  if (f.reviews.verdict === "worth_fixing" && f.reviews.count != null && f.reviews.localAvg != null) {
    // localAvg is the MEDIAN over the FULL competitor set the research captured
    // (null under 5 usable competitors, so this sentence never quotes a thin
    // sample). "Typically have" is the plain-English rendering of a median —
    // never "benchmark" or "average" (nobody computed a mean).
    frags.push(
      `you have ${f.reviews.count} Google reviews while businesses around you typically have ${f.reviews.localAvg}`
    );
  }
  if (f.mobileSpeed.verdict === "worth_fixing") {
    const bits: string[] = [];
    if (f.mobileSpeed.score != null) bits.push(`your website scores ${f.mobileSpeed.score}/100 for mobile speed`);
    if (f.mobileSpeed.loadSeconds != null) {
      bits.push(
        `${bits.length ? "takes" : "your website takes"} ${f.mobileSpeed.loadSeconds}s to show its main content on a phone`
      );
    }
    if (bits.length) frags.push(bits.join(" and "));
  }

  const close = `If you want that, grab a time here: ${link}.`;
  if (frags.length >= 2) {
    return [
      `Two numbers from a quick look at your website and Google listing: ${frags[0]}, and ${frags[1]}.`,
      `Both are fixable, and walking through them takes about ten minutes.`,
      close,
    ].join(" ");
  }
  if (frags.length === 1) {
    return [
      `One number from a quick look at your website and Google listing: ${frags[0]}.`,
      `It's fixable, and walking through it takes about ten minutes.`,
      close,
    ].join(" ");
  }

  const anythingMeasured =
    f.mobileSpeed.score != null ||
    f.mobileSpeed.loadSeconds != null ||
    f.reviews.count != null ||
    f.bookingLink.state !== "unknown" ||
    f.clickToCall.state !== "unknown";
  if (!anythingMeasured) return "";

  // Measured, and nothing crossed a threshold. The middle sentence is hedged as
  // an industry pattern ("most local businesses"), never stated about them —
  // the same voice rule the deliverables use for inferred claims.
  return [
    `A quick look at your website and Google listing didn't turn up anything urgent.`,
    `The leaks that cost money in most local businesses are in follow-up and speed-to-reply, which can't be seen from the outside.`,
    `If you want the ten-minute version of what I checked, grab a time here: ${link}.`,
  ].join(" ");
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/** Display fallback when a host has no facts yet (e.g. a feed that predates the
 *  field). Typed against ObservedFacts so shape drift breaks the build here. */
const ALL_UNKNOWN: ObservedFacts = {
  mobileSpeed: { score: null, loadSeconds: null, verdict: "unknown" },
  reviews: { count: null, rating: null, localAvg: null, verdict: "unknown" },
  bookingLink: { state: "unknown", verdict: "unknown" },
  clickToCall: { state: "unknown", verdict: "unknown" },
  observedAt: null,
};

/** Verdict → quiet label + colour. Label AND colour together, so the row still
 *  reads if the colour doesn't (any theme, any eyes). unknown renders nothing —
 *  the "—" in the value column is the whole statement. */
function VerdictLabel(_props: { verdict: ObservedVerdict }) {
  // OWNER RULE (2026-08-01): these four values are PROOF I LOOKED, not a
  // diagnosis — \"worth fixing\" is a judgment and reintroduces the severity
  // framing the cold audit was deleted for. The verdicts are still computed in
  // the lib (selection/sorting may use them); they just never render. Kept as a
  // component so the call sites document where a label deliberately is not.
  return null;
}

function FactLine({
  label,
  value,
  verdict,
}: {
  label: string;
  value: string | null;
  verdict: ObservedVerdict;
}) {
  const seen = value != null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-subtle)", flex: "0 0 84px" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: seen ? "var(--text)" : "var(--text-subtle)",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* "—" is "we could not see", which is a different fact from "none". */}
        {seen ? value : "—"}
      </span>
      <VerdictLabel verdict={verdict} />
    </div>
  );
}

function copyToClipboard(text: string, okMessage: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(okMessage))
    .catch(() => toast.error("Couldn't copy"));
}

const actionStyle = (enabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "inherit",
  color: "var(--text-3)",
  background: "transparent",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "3px 8px",
  cursor: enabled ? "pointer" : "default",
  opacity: enabled ? 1 : 0.5,
});

export interface ObservedFactsRowProps {
  facts: ObservedFacts | null | undefined;
  /** Frame it as its own panel (default) or render bare inside a host's card. */
  framed?: boolean;
}

/**
 * Four values, one line each, two copy actions. No document, no generation —
 * the row the operator reads before he dials, and the honest "—" when nothing
 * has been scanned (which is a different statement from "nothing is wrong").
 */
export function ObservedFactsRow({ facts, framed = true }: ObservedFactsRowProps) {
  const f = facts ?? ALL_UNKNOWN;

  const line = buildObservedLine(f);
  const email = buildObservedEmail(f, BOOKING_URL);

  const mobileValue =
    f.mobileSpeed.score != null || f.mobileSpeed.loadSeconds != null
      ? [
          f.mobileSpeed.score != null ? `${f.mobileSpeed.score}/100` : null,
          f.mobileSpeed.loadSeconds != null ? `${f.mobileSpeed.loadSeconds}s` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const reviewsValue =
    f.reviews.count != null
      ? [
          `${f.reviews.count}`,
          f.reviews.rating != null ? `★${f.reviews.rating}` : null,
          // "local median", said precisely — the sample is the top-rated nearby
          // businesses, and the statistic is a median (see observed-facts.ts).
          f.reviews.localAvg != null ? `local median ${f.reviews.localAvg}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const presenceValue = (state: "found" | "none" | "unknown"): string | null =>
    state === "unknown" ? null : state;

  const scannedOn = f.observedAt ? new Date(f.observedAt) : null;
  const scannedLabel =
    scannedOn && !Number.isNaN(scannedOn.getTime())
      ? scannedOn.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : null;

  return (
    <div
      className={framed ? "panel" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: framed ? "10px 12px" : undefined,
      }}
    >
      <FactLine label="Mobile speed" value={mobileValue} verdict={f.mobileSpeed.verdict} />
      <FactLine label="Reviews" value={reviewsValue} verdict={f.reviews.verdict} />
      <FactLine
        label="Booking link"
        value={presenceValue(f.bookingLink.state)}
        verdict={f.bookingLink.verdict}
      />
      <FactLine
        label="Click-to-call"
        value={presenceValue(f.clickToCall.state)}
        verdict={f.clickToCall.verdict}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          disabled={line === ""}
          title={line === "" ? "Nothing measured yet — run research first" : "Copy a one-line summary for call notes"}
          style={actionStyle(line !== "")}
          onClick={() => copyToClipboard(line, "Call line copied")}
        >
          <Copy size={12} strokeWidth={2} />
          Copy line
        </button>
        <button
          type="button"
          disabled={email === ""}
          title={
            email === ""
              ? "Nothing measured yet — run research first"
              : "Copy the three-sentence “just email me” note"
          }
          style={actionStyle(email !== "")}
          onClick={() =>
            BOOKING_URL
              ? copyToClipboard(email, "Email copied")
              : copyToClipboard(
                  email,
                  "Email copied — NEXT_PUBLIC_BOOKING_URL is unset, so it contains a {booking link} placeholder"
                )
          }
        >
          <Mail size={12} strokeWidth={2} />
          Copy email
        </button>
        {/* Provenance, said out loud: a stale row must be stale on its face. */}
        {scannedLabel && (
          <span style={{ fontSize: 10.5, color: "var(--text-subtle)", marginLeft: "auto" }}>
            seen {scannedLabel}
          </span>
        )}
      </div>
    </div>
  );
}
