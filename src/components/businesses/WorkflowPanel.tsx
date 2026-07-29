"use client";

// ── What this client's build includes ─────────────────────────────────────────
// The thing Kevin sells is fourteen named GoHighLevel workflows and a six-stage
// pipeline. Until this panel, "which fourteen does THIS client get?" was answered
// in his head, on a call, from memory — and the answer only became visible once
// the deliverables were generated and he read them back. This is that answer, on
// screen, before anything is generated, with a switch beside each row.
//
// THE RULE THE WHOLE PANEL IS SHAPED AROUND, from the catalogue:
//   A WORKFLOW IS INSTALLED ALWAYS; ITS LEAK IS ONLY SOMETIMES EVIDENCED.
// A row with no finding against it is NOT a row that failed a check. It is the
// ordinary, correct state of a workflow whose problem cannot be seen from outside
// the business. If this panel let that read as an oversight, the first thing an
// operator would do is "fix" it by switching the workflow off — and a paying
// client would lose part of the build. So every empty-evidence row says so in
// words, and the footer says why, once, plainly.
//
// FOUR THINGS IT REFUSES TO DO, because each one makes a switch untrustworthy:
//
//  1. NO UNEXPLAINED SWITCH. Every row carries the reason it sits where it sits —
//     a default, an answer the client gave, a measurement we took, or a decision
//     he made himself. A toggle he cannot explain is a toggle he will not trust,
//     and one he flips without understanding is worse than one he never touches.
//
//  2. AN "OFF" NAMES THE FACT THAT CAUSED IT. Not "not applicable" — the actual
//     sentence ("They told us they have no social accounts"), so he can see the
//     answer that removed it instead of guessing which question did.
//
//  3. A MEASURED PROBLEM LOCKS ITS FIX IN. Where our own tooling MEASURED the
//     problem a workflow solves (evidence grade "observed" — not a guess, not
//     something the client told us), the switch is disabled and the tooltip says
//     why. The client's report will carry that measurement as a finding, and a
//     document that contradicts the build is a call he has to explain. The lock
//     only ever prevents REMOVING work, never shipping: the worst it can cause is
//     a client receiving a workflow they did not strictly need.
//
//  4. AN EMPTY EVIDENCE LIST NEVER MEANS TWO THINGS. "Nothing fired for this
//     workflow" and "nothing has been scanned for this client at all" read
//     completely differently, so an unscanned client is told so ONCE at the top
//     rather than shown fourteen misleading "no finding" notes.
//
// WHERE THE ANSWERS COME FROM. Every sentence on this screen is computed
// server-side by src/lib/workflow-toggles.ts and rendered verbatim. Nothing here
// re-derives whether a workflow is in the build, and nothing here rewrites the
// reason: a second copy of that arithmetic is a second chance for the screen and
// the deliverable to disagree about what the client is getting.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Lock, ScanSearch, Workflow } from "lucide-react";
// TYPE-ONLY, as workflow-toggles.ts asks in as many words: that module reaches
// leak-narrative at runtime, so a value import here would drag the leak taxonomy
// into the browser bundle for the sake of shapes the compiler erases anyway.
import type { WorkflowToggleRow, WorkflowTogglesResponse } from "@/lib/workflow-toggles";
import type { EvidenceGrade } from "@/types";

/**
 * The one endpoint this panel talks to.
 *
 *   GET   ?businessId=…                          → WorkflowTogglesResponse
 *   PATCH { businessId, workflowId, on }         → WorkflowTogglesResponse
 *
 * A PATCH answers with the FULL re-resolved set, not just the row that moved: one
 * decision can change another row's sentence, and re-resolving server-side is the
 * only way this screen and a regenerated deliverable stay in step.
 */
const WORKFLOWS_ENDPOINT = "/api/workflow-toggles";

/** The toggle write, mirroring the route's `patchSchema` field for field. `on` is
 *  two-state because the stored column is two-state — readStoredToggles drops any
 *  value that is not a boolean, so a third state would be silently discarded. */
interface WorkflowToggleRequest {
  businessId: string;
  workflowId: string;
  on: boolean;
}

/** What the route sends back when it refuses a write. The 409 case — switching
 *  off a workflow held on by a measurement — carries the lock text in `reason`,
 *  and that is the half worth reading: "not allowed" with no reason is how an
 *  operator ends up reloading the page at 11pm wondering what he broke. */
interface WorkflowToggleError {
  error?: string;
  reason?: string | null;
}

/**
 * Is this actually a resolved build?
 *
 * The fourteen are asserted to be fourteen by the catalogue's own integrity
 * check, so an empty or malformed list here is not "a client with no workflows" —
 * it is a payload that went wrong. This panel has exactly one answer it must
 * never give, and "this client gets no workflows" is it, so a body that fails
 * this check is treated as a failed read and says so.
 */
function isBuild(body: unknown): body is WorkflowTogglesResponse {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<WorkflowTogglesResponse>;
  return Array.isArray(b.workflows) && b.workflows.length > 0 && Boolean(b.counts);
}

export interface WorkflowPanelProps {
  businessId: string;
  /** Bump to refetch. Hosts change this after an intake save — an answer that
   *  changes applicability has to visibly change the build — and after anything
   *  that captures a research snapshot, because new findings can lock a switch. */
  reloadKey?: number;
  /** Density only, matched to IntakeForm's two hosts. Same content either way. */
  density?: "compact" | "comfortable";
}

/** A row plus its number in the build. The API returns the fourteen in catalogue
 *  order, which IS the build's own 1–14 numbering — the numbers Kevin and the
 *  client both use out loud ("workflow 8 closes the lead out"). It is derived
 *  from position in the list rather than sent, because the catalogue's order is
 *  the only definition of it. */
interface NumberedRow extends WorkflowToggleRow {
  position: number;
}

// ── Density ───────────────────────────────────────────────────────────────────

interface Scale {
  stack: number;
  head: number;
  name: number;
  body: number;
  hint: number;
  gap: number;
  icon: number;
  rowPad: string;
}

const SIZE: Record<NonNullable<WorkflowPanelProps["density"]>, Scale> = {
  compact: {
    stack: 9,
    head: 12,
    name: 12,
    body: 11,
    hint: 10.5,
    gap: 8,
    icon: 12,
    rowPad: "8px 9px",
  },
  comfortable: {
    stack: 11,
    head: 13,
    name: 13,
    body: 12,
    hint: 11,
    gap: 9,
    icon: 13,
    rowPad: "10px 11px",
  },
};

// ── Wording ───────────────────────────────────────────────────────────────────

/**
 * Evidence, in the voice its grade earns.
 *
 * This is the same honesty ladder GRADE_VOICE in leak-narrative.ts imposes on the
 * client-facing documents — we measured it / they told us / it is a pattern we
 * have not measured. Keeping the operator's labels on that ladder means what he
 * reads here is what the deliverable will actually be allowed to claim. Softening
 * one of these would let him believe a finding is firmer than the document can
 * print, which is how a confident sentence ends up in front of a client.
 */
const GRADE_LABEL: Record<EvidenceGrade, string> = {
  observed: "We measured",
  disclosed: "They told us",
  inferred: "Pattern, not measured",
};

const GRADE_TONE: Record<EvidenceGrade, string> = {
  observed: "var(--money)",
  disclosed: "var(--accent)",
  inferred: "var(--text-subtle)",
};

/** "12 of 14 workflows are in this build." Built as one string rather than
 *  assembled in JSX, where a line break before the full stop renders as
 *  "build ." */
function headline(on: number, total: number): string {
  return on === total
    ? `All ${total} workflows are in this build.`
    : `${on} of ${total} workflows are in this build.`;
}

/** The second line under the headline: how many switches he cannot move, and
 *  why. Silent when nothing is locked — a panel that narrates a non-event is a
 *  panel that gets skimmed. */
function lockLine(locked: number): string | null {
  if (locked === 0) return null;
  return locked === 1
    ? "1 switch is held on by something we measured ourselves."
    : `${locked} switches are held on by things we measured ourselves.`;
}

function listNames(rows: NumberedRow[]): string {
  return rows.map((r) => r.name).join(", ");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ── The switch ────────────────────────────────────────────────────────────────

/**
 * A plain two-state switch, disabled while the row is locked or its own save is
 * in flight.
 *
 * THE TOOLTIP LIVES ON THE WRAPPER, NOT THE BUTTON. A disabled <button> swallows
 * pointer events in every browser, so a `title` on the button itself never
 * appears — which would leave a locked switch that refuses to move and gives no
 * reason, the exact thing this panel exists to prevent.
 */
function Switch({
  on,
  disabled,
  busy,
  reason,
  label,
  onToggle,
  s,
}: {
  on: boolean;
  disabled: boolean;
  busy: boolean;
  reason: string;
  label: string;
  onToggle: () => void;
  s: Scale;
}) {
  const w = Math.round(s.icon * 2.4);
  const h = Math.round(s.icon * 1.4);
  const knob = h - 4;
  return (
    <span title={reason} style={{ display: "inline-flex", flex: "none", marginTop: 1 }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onToggle}
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 999,
          border: `1px solid ${on ? "transparent" : "var(--line-strong)"}`,
          background: on ? "var(--accent-grad)" : "rgba(255,255,255,0.05)",
          padding: 0,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled && !busy ? 0.6 : 1,
          transition: "background 140ms ease, opacity 140ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: on ? w - knob - 3 : 1,
            width: knob,
            height: knob,
            borderRadius: 999,
            background: on ? "#fff" : "var(--text-3)",
            transition: "left 140ms cubic-bezier(0.32,0.72,0,1)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy && (
            <Loader2
              size={Math.max(7, knob - 3)}
              strokeWidth={2.6}
              style={{ color: "var(--accent)", animation: "lg-spin 0.7s linear infinite" }}
            />
          )}
        </span>
      </button>
    </span>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Note({
  icon,
  tone,
  text,
  s,
}: {
  icon: React.ReactNode;
  tone: string;
  text: string;
  s: Scale;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: s.gap }}>
      <span style={{ color: tone, flex: "none", marginTop: 1, display: "inline-flex" }}>{icon}</span>
      <span style={{ fontSize: s.body, color: "var(--text-3)", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function Chip({
  text,
  tone,
  bg,
  title,
  icon,
  s,
}: {
  text: string;
  tone: string;
  bg: string;
  title?: string;
  icon?: React.ReactNode;
  s: Scale;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: s.hint,
        fontWeight: 600,
        color: tone,
        background: bg,
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: "1px 7px",
        lineHeight: 1.6,
      }}
    >
      {icon}
      {text}
    </span>
  );
}

/** Two lines, then a tooltip. Used for the description and for the reason, both
 *  of which are written server-side at whatever length the truth needed —
 *  fourteen untruncated paragraphs would turn this panel into an essay, and
 *  editing the strings down here would put a second, shorter version of the
 *  reason on screen. Clamp and keep the whole thing one hover away instead. */
function Clamped({
  text,
  size,
  color,
  lines,
}: {
  text: string;
  size: number;
  color: string;
  lines: number;
}) {
  return (
    <span
      title={text}
      style={{
        fontSize: size,
        color,
        lineHeight: 1.45,
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {text}
    </span>
  );
}

// ── One workflow ──────────────────────────────────────────────────────────────

function Row({
  row,
  scanned,
  busy,
  onToggle,
  s,
}: {
  row: NumberedRow;
  scanned: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
  s: Scale;
}) {
  const switchReason = busy
    ? "Saving…"
    : row.locked
      ? (row.lockReason ?? "We measured the problem this fixes, so it stays in the build.")
      : row.on
        ? `Switch "${row.name}" out of this client's build`
        : `Switch "${row.name}" into this client's build`;

  // WHAT WOULD TAKE THIS ONE OUT — the single most useful line on a row that is
  // currently in the build, because it tells him which answer to go and get.
  //
  // Two conditions on showing it, and both were wrong before they were tested.
  //  · Only while the workflow is IN. Once it is out, "what would take it out" is
  //    a question already answered by the line above it.
  //  · Only when `because` does not already contain it. For an operator_only
  //    workflow the resolver has ALREADY folded this sentence into `because`
  //    ("In the build. Switch it off by hand if: …"), and printing it again shows
  //    him the same sentence twice in three lines. The containment check tells the
  //    two cases apart without this component having to know which applicability
  //    kind it is looking at.
  const offReason =
    row.on && row.operatorOffReason && !row.because.includes(row.operatorOffReason)
      ? row.operatorOffReason
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: s.gap,
        padding: s.rowPad,
        border: "1px solid var(--line)",
        borderRadius: 9,
        // A workflow that is OUT reads as out before a word is read.
        background: row.on ? "rgba(255,255,255,0.015)" : "transparent",
        opacity: row.on ? 1 : 0.72,
      }}
    >
      <Switch
        on={row.on}
        disabled={row.locked || busy}
        busy={busy}
        reason={switchReason}
        label={`${row.name} — ${row.on ? "in the build" : "out of the build"}`}
        onToggle={() => onToggle(!row.on)}
        s={s}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <span className="lg-mono tnum" style={{ fontSize: s.hint, color: "var(--text-subtle)" }}>
            {row.position}
          </span>
          <span
            style={{ fontSize: s.name, fontWeight: 600, color: "var(--text)", lineHeight: 1.35 }}
          >
            {row.name}
          </span>

          {/* The lock is its own chip AND the switch's tooltip. Two places, because
              the switch is where he finds out he cannot move it and the chip is
              where he sees it while scanning without touching anything. */}
          {row.locked && (
            <Chip
              text="Measured"
              tone="var(--money)"
              bg="var(--money-soft, rgba(74,222,128,0.10))"
              title={row.lockReason ?? undefined}
              icon={<Lock size={s.hint} strokeWidth={2.2} />}
              s={s}
            />
          )}

          {/* WHO DECIDED, where anyone decided. "default" gets no chip: the group
              heading already says these are in every build, and a chip on ten of
              fourteen rows is noise that hides the two that matter.

              Both disappear while a save is in flight, for the same reason the
              reason line does — who decided is precisely what is changing, and a
              stale "Their answer" sitting beside a switch he just moved himself is
              a small lie the server is about to correct anyway. */}
          {!busy && !row.locked && row.source === "operator" && (
            <Chip
              text="Your call"
              tone="var(--warn)"
              bg="var(--warn-soft, rgba(234,179,8,0.10))"
              title="You set this switch by hand for this client. It beats the rule underneath it."
              s={s}
            />
          )}
          {!busy && !row.locked && row.source === "rule" && (
            <Chip
              text="Their answer"
              tone="var(--accent)"
              bg="var(--accent-soft)"
              title="An answer on the intake form decided this one."
              s={s}
            />
          )}
        </div>

        {/* Verbatim from the catalogue — the sentence a client eventually reads,
            so it is never rewritten here. */}
        <Clamped text={row.whatItDoes} size={s.body} color="var(--text-3)" lines={2} />

        {/* THE REASON. Never omitted, on any row, in any state. */}
        {busy ? (
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            Saving your decision…
          </span>
        ) : (
          <Clamped text={row.because} size={s.hint} color="var(--text-2)" lines={2} />
        )}

        {/* Phrased as a noun clause rather than a conditional ("Comes out only
            if: …") because the catalogue writes these as completed facts — "They
            told us they have no social accounts" — and an "if" in front of a
            past-tense statement reads as a typo. */}
        {!busy && offReason && (
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            The only thing that takes it out: {offReason}
          </span>
        )}

        {/* Supporting evidence, where any fired. Grade-labelled, because "we
            measured it", "they told us" and "most businesses like this" are three
            different strengths of claim and the deliverable treats them as three. */}
        {!busy && scanned && row.justification.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 1 }}>
            {row.justification.map((f) => (
              <Chip
                key={f.leakId}
                text={`${GRADE_LABEL[f.grade]}: ${f.leakName}`}
                tone={GRADE_TONE[f.grade]}
                bg="transparent"
                title={f.measured ?? undefined}
                s={s}
              />
            ))}
          </div>
        )}

        {/* NOT AN OVERSIGHT, AND IT MUST NOT READ AS ONE. Two conditions:
            · Only when a scan actually ran. With nothing scanned an empty list
              means "we have not looked", which is a different sentence entirely
              and is said once at the top instead of fourteen times down here.
            · Only when the workflow is IN. "Installed anyway" printed under a
              switch sitting off is a flat contradiction, and a panel that
              contradicts itself on one row is a panel he stops believing on all
              fourteen. A workflow that is out already has its reason above. */}
        {!busy && scanned && row.on && row.justification.length === 0 && (
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            No finding fired for this one — installed anyway.
          </span>
        )}
      </div>
    </div>
  );
}

// ── One group ─────────────────────────────────────────────────────────────────

function Group({
  title,
  blurb,
  rows,
  scanned,
  pending,
  onToggle,
  collapsible,
  expanded,
  onToggleExpanded,
  s,
}: {
  title: string;
  blurb: string;
  rows: NumberedRow[];
  scanned: boolean;
  pending: ReadonlySet<string>;
  onToggle: (row: NumberedRow, on: boolean) => void;
  collapsible: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  s: Scale;
}) {
  if (rows.length === 0) return null;
  const off = rows.filter((r) => !r.on);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  const head = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {collapsible && (
        <Chevron
          size={s.icon}
          strokeWidth={2.2}
          style={{ color: "var(--text-subtle)", flex: "none" }}
        />
      )}
      <span
        style={{
          fontSize: s.hint,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {title}
      </span>
      <span
        className="lg-mono tnum"
        style={{
          fontSize: s.hint,
          fontWeight: 600,
          color: "var(--text-3)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          padding: "0 6px",
        }}
      >
        {rows.length - off.length}/{rows.length}
      </span>
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          style={{
            display: "flex",
            alignItems: "center",
            padding: 0,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {head}
        </button>
      ) : (
        head
      )}

      {/* The group's own one-liner, and — when something is out — the names. A
          collapsed group that hides an exception is how a panel starts being
          wrong at a glance, so the exception is named in the heading whether the
          group is open or shut. */}
      <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
        {off.length === 0 ? blurb : `${blurb} Out: ${listNames(off)}.`}
      </span>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              scanned={scanned}
              busy={pending.has(row.id)}
              onToggle={(on) => onToggle(row, on)}
              s={s}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── The panel ─────────────────────────────────────────────────────────────────

export function WorkflowPanel({
  businessId,
  reloadKey = 0,
  density = "compact",
}: WorkflowPanelProps) {
  const s = SIZE[density];
  const [data, setData] = useState<WorkflowTogglesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Rows whose own save is in flight. A Set rather than one id, so two quick
  // toggles cannot cancel each other's spinner or each other's rollback.
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  // The same set, readable from inside an async handler that closed over an older
  // render — used to decide which rows the server's answer may overwrite.
  const pendingRef = useRef<ReadonlySet<string>>(new Set());
  // null = he has never touched the disclosure, so it follows the data (open when
  // one of the ten is out of the ordinary). Once he opens or shuts it, his choice
  // sticks for the rest of the session.
  const [everyBuildOpen, setEveryBuildOpen] = useState<boolean | null>(null);

  const setPendingBoth = useCallback((next: ReadonlySet<string>) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`${WORKFLOWS_ENDPOINT}?businessId=${encodeURIComponent(businessId)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body: unknown = await res.json();
        if (!isBuild(body)) throw new Error("malformed");
        return body;
      })
      .then((body) => {
        setData(body);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // An aborted request is this effect being superseded, not a failure —
        // showing an error for it would flash on every business switch.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [businessId, reloadKey]);

  /**
   * Flip one switch: optimistic, with a rollback on failure — the same shape as
   * every other PATCH in this codebase (crm/page.tsx patchField, calendar/page.tsx
   * patchBusiness), with one deliberate difference. The snapshot is ONE ROW, not
   * the whole list, so a second toggle already in flight is not silently undone by
   * the first one failing.
   *
   * THE REASON LINE IS NOT GUESSED WHILE THE SAVE IS IN THE AIR. It reads "Saving
   * your decision…" until the server answers, because the sentence that belongs
   * under a flipped switch is the resolver's, and writing a local version of it
   * here would be a second copy of the rule, free to disagree with the first.
   */
  const toggleRow = async (row: NumberedRow, on: boolean) => {
    if (pendingRef.current.has(row.id)) return;
    // The row exactly as the server last described it — what goes back if the
    // write does not land. It carries the derived `position` along with it, which
    // is harmless: position is recomputed from list order on every render, so a
    // restored row picks its number back up from where it sits.
    const before: WorkflowToggleRow = row;

    const nextPending = new Set(pendingRef.current);
    nextPending.add(row.id);
    setPendingBoth(nextPending);

    // Optimistic: the switch moves now.
    setData((prev) =>
      prev
        ? { ...prev, workflows: prev.workflows.map((w) => (w.id === row.id ? { ...w, on } : w)) }
        : prev
    );

    const restore = () =>
      setData((prev) =>
        prev
          ? { ...prev, workflows: prev.workflows.map((w) => (w.id === row.id ? before : w)) }
          : prev
      );

    try {
      const body: WorkflowToggleRequest = { businessId, workflowId: row.id, on };
      const res = await fetch(WORKFLOWS_ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        restore();
        // The route refuses a locked switch with a 409 whose `reason` names the
        // measurement. That is the useful half, so it goes in the toast rather
        // than being flattened into a generic failure. Only a stale tab can
        // normally reach this — the switch is already disabled on a fresh render —
        // which is exactly the case where he needs telling why.
        const body = payload as WorkflowToggleError;
        toast.error(body.error || "Couldn't change the build — nothing was saved", {
          description: body.reason ?? undefined,
          duration: body.reason ? 10000 : undefined,
        });
        return;
      }

      // The server re-resolves all fourteen, because one decision can change
      // another row's sentence. Rows with their OWN save still in flight keep the
      // position the operator just gave them: the server's copy of those predates
      // their write and would snap the switch backwards for a moment.
      if (!isBuild(payload)) {
        // A 200 whose body we cannot read leaves us unable to say what stuck, so
        // the switch goes back to the last thing we know was true rather than
        // sitting in a position nothing has confirmed.
        restore();
        toast.error("Saved, but the build came back unreadable — reopen this panel to check");
        return;
      }
      const fresh = payload;
      setData((prev) => {
        if (!prev) return fresh;
        const stillPending = pendingRef.current;
        return {
          ...fresh,
          workflows: fresh.workflows.map((w) =>
            w.id !== row.id && stillPending.has(w.id)
              ? (prev.workflows.find((p) => p.id === w.id) ?? w)
              : w
          ),
        };
      });
    } catch {
      restore();
      toast.error("Couldn't change the build — nothing was saved");
    } finally {
      const rest = new Set(pendingRef.current);
      rest.delete(row.id);
      setPendingBoth(rest);
    }
  };

  // GROUPED BY WHAT DECIDES THE SWITCH, which is the only axis that makes fourteen
  // rows scannable. The four a fact about this client can move are the ones worth
  // his attention and are always open; the ten that are simply part of every build
  // are reference and collapse to a heading. Catalogue order inside each group,
  // because that is the order he and the client both name them in.
  const { conditional, everyBuild } = useMemo(() => {
    const numbered: NumberedRow[] = (data?.workflows ?? []).map((w, i) => ({
      ...w,
      position: i + 1,
    }));
    return {
      conditional: numbered.filter((r) => r.conditional),
      everyBuild: numbered.filter((r) => !r.conditional),
    };
  }, [data]);

  // The ten open on their own when one of them is out of the build or was set by
  // hand. A shut group hiding an exception is worse than a long list.
  const everyBuildException = everyBuild.some((r) => !r.on || r.source === "operator");
  const everyBuildExpanded = everyBuildOpen ?? everyBuildException;

  const wrap = (children: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: s.stack,
        // A refetch after a save keeps the list on screen and dims it rather than
        // blanking to a spinner: he just answered a question and is watching for
        // what moved, so the thing he is comparing against must not vanish.
        opacity: loading && data ? 0.5 : 1,
        transition: "opacity 140ms ease",
      }}
    >
      {children}
    </div>
  );

  if (loading && !data) {
    return wrap(
      <Note
        s={s}
        tone="var(--text-subtle)"
        icon={
          <Loader2
            size={s.icon}
            strokeWidth={2.2}
            style={{ animation: "lg-spin 0.7s linear infinite" }}
          />
        }
        text="Working out what this client's build includes…"
      />
    );
  }

  // A failed read is a failed read. It must never render as an empty build —
  // "this client gets no workflows" is the one wrong answer this panel can give.
  if (failed || !data) {
    return wrap(
      <Note
        s={s}
        tone="var(--text-subtle)"
        icon={<Workflow size={s.icon} strokeWidth={2} />}
        text="Couldn't read this client's build. Nothing has changed — the fourteen workflows and any decisions you saved are untouched."
      />
    );
  }

  // Counts come from the payload rather than being recounted here, so the heading
  // can never disagree with the rows underneath it.
  const locks = lockLine(data.counts.locked);

  return wrap(
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: s.head, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
          {headline(data.counts.on, data.counts.total)}
        </span>
        <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
          {locks
            ? `${locks} Every switch below says why it is where it is.`
            : "Every switch below says why it is where it is — a default, an answer they gave, or a call you made."}
        </span>
      </div>

      {/* Said ONCE, here, instead of fourteen times on the rows. It is not a
          problem with the build — the build is the build — but it does mean no row
          can cite a finding and nothing can be locked, and that has to be visible
          or an absence of evidence reads as a clean sweep. */}
      {!data.scanned && (
        <Note
          s={s}
          tone="var(--text-subtle)"
          icon={<ScanSearch size={s.icon} strokeWidth={2} />}
          text="Nothing scanned for this client yet, so no findings are cited below and nothing is locked. The build is unaffected — all fourteen ship unless a fact takes one out."
        />
      )}

      <Group
        title="Decided by this client"
        blurb="A fact about their business — or your own call — decides these four. Every rule is an off-switch: a question nobody asked never removes one."
        rows={conditional}
        scanned={data.scanned}
        pending={pending}
        onToggle={toggleRow}
        collapsible={false}
        expanded
        onToggleExpanded={() => undefined}
        s={s}
      />

      <Group
        title="In every build"
        blurb="Installed as standard — nothing is evaluated. Switch one off only for a reality you hit at install."
        rows={everyBuild}
        scanned={data.scanned}
        pending={pending}
        onToggle={toggleRow}
        collapsible
        expanded={everyBuildExpanded}
        onToggleExpanded={() => setEveryBuildOpen(!everyBuildExpanded)}
        s={s}
      />

      {/* The rule, once, at the bottom — the sentence that stops an operator
          "fixing" a workflow with no finding against it by switching it off. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingTop: s.stack - 3,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.55 }}>
          A workflow with no finding against it is still installed. Findings are the
          evidence a document may cite, never the reason a workflow exists — most of
          what these fix cannot be seen from outside the business at all, and one of
          the fourteen has no finding in the taxonomy that could ever fire for it.
        </span>
        {data.scanned && data.researchAt && fmtDate(data.researchAt) && (
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            Findings read from the {fmtDate(data.researchAt)} research snapshot —
            refresh research to re-measure.
          </span>
        )}
      </div>
    </>
  );
}
