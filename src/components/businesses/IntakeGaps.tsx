"use client";

// ── What he failed to collect, and where he collects it ───────────────────────
// Every leak still graded "inferred" after intake is a leak the deliverables MUST
// hedge — "most businesses like this…, we haven't measured yours". Hedged copy is
// weaker copy, and the fix is usually one question that never got asked on the
// kickoff call. This panel names those questions AND takes their answers: each
// collectible gap carries the control that records it, in the row that asks it.
//
// WHY THE CONTROL LIVES HERE AND NOT ONLY IN THE FORM. He fills this in live, on a
// fifteen-minute Zoom, while the owner is talking. Reading five questions in one
// place and then hunting for those same five inside the sixteen-field form is two
// jobs where there is one: the list and the form were the same work, split in two.
// He hears "voicemail, usually", clicks it in the row he just read out, and the
// count drops. Nothing scrolls, nothing opens, the client's name never leaves the
// screen. (In the client drawer this panel IS the first tab, and the full form is
// the second — same relationship, one keystroke apart.)
//
// FOUR THINGS IT REFUSES TO DO, because each one would make it lie:
//
//  1. IT NEVER PRESENTS AN UNCOLLECTIBLE GAP AS A CHORE. The taxonomy separates
//     "we never asked" from "no question we ask could ever confirm this" (webchat,
//     lead qualification at the front door). The second kind is listed, plainly,
//     in its own block with NO control on it — because a to-do he can never clear
//     is a nag that teaches him to ignore the panel.
//
//  2. IT NEVER SHOWS AN EMPTY LIST AS A CLEAN BILL OF HEALTH. A client with no
//     research snapshot has an empty list because nothing has been scanned, not
//     because nothing is missing. Those two read completely differently here.
//
//  3. IT NEVER COLLAPSES "NOT ASKED" INTO "NO". Blank is a real answer — "no"
//     confirms the gap and makes the deliverable declarative, blank leaves the
//     benchmark hedge. Every control here has a third state for exactly that.
//
//  4. IT NEVER LETS AN ANSWER LOOK LIKE IT DID NOTHING. If the answer clears the
//     leak, the row goes and the headline count drops. If it does NOT — a "not
//     sure" — the row says so in words, because a question he answered that
//     changed nothing on screen is indistinguishable from a bug.
//
// And when there genuinely is nothing to do it says so once, quietly. A quality
// panel that celebrates is a panel that gets skimmed.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, EyeOff, HelpCircle, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import {
  AFTER_HOURS_HANDLING_OPTIONS,
  BOOKING_METHOD_OPTIONS,
  MISSED_CALL_HANDLING_OPTIONS,
  PAST_CUSTOMER_CONTACT_OPTIONS,
  RESPONSE_SPEED_OPTIONS,
  REVIEW_REPLY_OWNER_OPTIONS,
  SOCIAL_ENQUIRIES_OPTIONS,
} from "@/lib/intake-options";
// Type-only, so none of the taxonomy reaches the client bundle. It buys the one
// thing worth having: the control map below is keyed by real ClientIntake fields,
// so renaming a field breaks the build instead of quietly dropping its control.
import type { ClientIntake } from "@/lib/leak-taxonomy";

// ── The contract with /api/leak-gaps ──────────────────────────────────────────
// Declared here and imported by the route type-only, so there is exactly one
// declaration of the payload and the panel can never disagree with what it's fed.

/** One fired leak still sitting at grade "inferred". */
export interface LeakGap {
  leakId: string;
  leakName: string;
  /** The one intake question that would upgrade this leak from a guess to
   *  something the client told us, verbatim from the intake form. null = no
   *  question we ask can settle it (structural). */
  question: string | null;
  /** The ClientIntake field carrying that answer. null when structural. */
  field: string | null;
  /** The answer already on file, in the operator's own words — null when the
   *  question was never answered. An answer that is on file and STILL leaves the
   *  leak guessed is a "not sure": re-asking it the same way changes nothing. */
  answerOnFile: string | null;
  /** The SAME answer as the raw slug / boolean actually stored — null when
   *  nothing is on file. This is what the control renders its selected state
   *  from. Without it the panel would have to map `answerOnFile` back to an
   *  option, and a reverse lookup over labels is a second copy of the vocabulary,
   *  free to disagree with the first. */
  currentValue: string | boolean | null;
}

export interface LeakGapsResponse {
  businessId: string;
  /** false = no usable research snapshot, so nothing was detected. The empty
   *  lists below mean "we haven't looked", never "nothing is missing". */
  scanned: boolean;
  /** When the research snapshot this reads was captured. */
  researchAt: string | null;
  counts: {
    /** In-scope fired leaks the report will carry. */
    total: number;
    /** We measured it — states as fact. */
    observed: number;
    /** They told us — states as fact, attributed. */
    disclosed: number;
    /** Neither — gets hedged as an industry pattern. */
    inferred: number;
  };
  /** Still guessed, and one question we already ask would fix it. */
  collectible: LeakGap[];
  /** Still guessed, and nothing on the form can settle it. Not a to-do. */
  structural: LeakGap[];
}

export interface IntakeGapsProps {
  businessId: string;
  /** Bump to refetch. Hosts change this after an intake save so the list shrinks
   *  in place — the whole point is watching it shrink as the form gets filled in,
   *  not reloading the page to find out whether the answer helped. */
  reloadKey?: number;
  /** Type scale only, matched to the two densities IntakeForm and WorkflowPanel
   *  ship. Same content either way. */
  density?: "compact" | "comfortable";
  /**
   * How much room the host is giving it. PRESENTATION ONLY — same fetch, same
   * controls, same sentences, same save path in both. There is deliberately no
   * second component for the drawer: a fork would be free to drift on the four
   * refusals at the top of this file, and the one that drifted would be the one
   * he happened to use on the call.
   *
   *  · "inline" (default) — the narrow, height-capped column this was built for.
   *    Everything is one flat stack, because a border per question in a 300px
   *    column is more chrome than content.
   *  · "panel" — the client drawer's 560px pane, with the full window height and
   *    no sibling columns. Each question becomes its own bordered row (a list of
   *    things to ask, scannable at a glance mid-call, instead of one long ribbon
   *    of text), the headline count is set at reading size because it is the
   *    reason he opened the tab, and the chips are bigger targets because he is
   *    hitting them while a client talks.
   */
  layout?: "inline" | "panel";
  /**
   * Fired after ONE answer given here is saved, with the Business column written
   * and the raw value written to it. Optional, and NOT wiring it is safe — the
   * write already landed in the database and this panel has already re-read
   * itself. It exists for the other panels on the same screen: an answer here can
   * move the BUILD (no social accounts drops the social-inbox workflow), and a
   * build panel that silently disagrees with the answer beside it is worse than
   * one that reloads.
   *
   * ONE TRAP, and it is the reason this is a notification rather than a required
   * prop. IntakeForm seeds its draft from the host's copy of the row ONCE, on
   * mount, and decides what to save by diffing that draft against the same copy.
   * So:
   *   · host does nothing            → SAFE. The form's draft and its idea of
   *     what's stored stay equal, so the field simply isn't in the next PATCH
   *     body. It displays a stale blank for a question already answered here,
   *     and it never writes over the answer.
   *   · host merges into its copy    → LOST WRITE, unless the mounted IntakeForm
   *     re-seeds its draft in the same breath. The form would see "stored" move
   *     while its draft stayed blank, read that as an edit, and PATCH the blank
   *     back over the answer on the next save.
   * Merge into the host copy only if the form is remounted or re-seeded with it.
   */
  onAnswered?: (field: string, value: string | boolean | null) => void;
}

// ── Density ───────────────────────────────────────────────────────────────────

interface Scale {
  stack: number;
  head: number;
  body: number;
  hint: number;
  gap: number;
  icon: number;
  /** Answer chips. Kept small in the inline layout on purpose: there it lives in a
   *  narrow, height-capped column, and every pixel it adds is a pixel of the
   *  scrolling the whole change exists to remove. The drawer's pane has the room,
   *  so PANEL below gives them back. */
  chip: number;
  chipPad: string;
}

const SIZE: Record<NonNullable<IntakeGapsProps["density"]>, Scale> = {
  compact: { stack: 9, head: 12, body: 11, hint: 10.5, gap: 7, icon: 12, chip: 11, chipPad: "3px 8px" },
  comfortable: {
    stack: 11,
    head: 13,
    body: 12,
    hint: 11,
    gap: 8,
    icon: 13,
    chip: 11.5,
    chipPad: "4px 10px",
  },
};

/** What the drawer's pane buys, on top of whichever density it was given. Only
 *  the numbers that should actually change with the extra room: the headline (it
 *  is the reason he opened this), the question text, and the chip targets. The
 *  hint sizes stay put — a footnote does not get more important because there is
 *  space for it. */
const PANEL: Partial<Scale> = {
  stack: 12,
  head: 15,
  body: 12.5,
  gap: 9,
  chip: 12,
  chipPad: "5px 11px",
};

function scaleFor(
  density: NonNullable<IntakeGapsProps["density"]>,
  layout: NonNullable<IntakeGapsProps["layout"]>
): Scale {
  const base = SIZE[density];
  return layout === "panel" ? { ...base, ...PANEL } : base;
}

/** A question row's own frame, in the layout that has room for one. Same
 *  measurements as the card the hosts used to wrap this whole panel in, moved
 *  down one level: in the drawer the unit worth framing is ONE QUESTION, because
 *  the pane holds nothing else. */
const CARD: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.015)",
  padding: "11px 12px",
};

// ── Which control answers which question ──────────────────────────────────────

/**
 * Every intake answer that comes from a fixed vocabulary, pointed straight at the
 * vocabulary in intake-options.ts.
 *
 * NEVER WRITE AN OPTION LIST HERE. The words on these chips have to be the words
 * on the ReclaimedHQ intake form, and the only way to guarantee that is for them
 * to be literally the same array — a second copy would drift the first time a
 * label is reworded, and the operator would be reading the client one wording
 * while the deliverable was built from another.
 *
 * Keyed by ClientIntake field (what an IntakeAsk names). Every key here is also a
 * Business column and an accepted key of updateBusinessSchema — that identity is
 * what makes a single-field PATCH of `{ [field]: value }` valid. The intake keys
 * that DON'T share their column name (avgJobValueCad, monthlyEnquiries) are money
 * numbers, no leak asks for them, and they deliberately have no control here.
 */
const OPTION_FIELDS = {
  responseSpeed: RESPONSE_SPEED_OPTIONS,
  missedCallHandling: MISSED_CALL_HANDLING_OPTIONS,
  afterHoursHandling: AFTER_HOURS_HANDLING_OPTIONS,
  bookingMethod: BOOKING_METHOD_OPTIONS,
  socialEnquiries: SOCIAL_ENQUIRIES_OPTIONS,
  pastCustomerContact: PAST_CUSTOMER_CONTACT_OPTIONS,
  reviewReplyOwner: REVIEW_REPLY_OWNER_OPTIONS,
} satisfies Partial<Record<keyof ClientIntake, readonly { value: string; label: string }[]>>;

type OptionField = keyof typeof OPTION_FIELDS;

/** The yes/no columns. Same key rule as above: field name === column name. */
const BOOLEAN_FIELDS = [
  "hasCrm",
  "hasFollowUpSequence",
  "hasReminderSystem",
  "hasPastCustomerDatabase",
  "hasCallTracking",
  "hasOnlinePayment",
] as const satisfies readonly (keyof ClientIntake)[];

const BOOLEAN_FIELD_SET: ReadonlySet<string> = new Set<string>(BOOLEAN_FIELDS);

function optionsFor(field: string): readonly { value: string; label: string }[] | null {
  return Object.prototype.hasOwnProperty.call(OPTION_FIELDS, field)
    ? OPTION_FIELDS[field as OptionField]
    : null;
}

/**
 * Every field this panel can answer in one click, exported so a VERIFY SCRIPT can
 * assert the coverage rather than a human remembering to check it.
 *
 * WHY IT IS EXPORTED FROM HERE. The rule that matters is "every question the
 * taxonomy tells him to ask is answerable in the row that asks it", and that rule
 * spans two files: intakeAsk in leak-taxonomy.ts names the field, the two maps
 * above render its control. Nothing fails today if a new leak adds an intakeAsk
 * pointing at a field with no control — the row degrades honestly to question-only
 * (see AnswerControl) — which is exactly the kind of silent, correct-looking
 * regression that only a machine catches. Comparing this set against
 * intakeFieldsForZeroInferred() is a one-line assertion; see the handoff.
 */
export const ANSWERABLE_INTAKE_FIELDS: ReadonlySet<string> = new Set<string>([
  ...Object.keys(OPTION_FIELDS),
  ...BOOLEAN_FIELDS,
]);

/** Can this field be answered in one click here at all? Asked at the CALL SITE,
 *  not by looking at what <AnswerControl> returned — a component that renders
 *  null still produces a React element, so `control === null` would never be
 *  true and the fallback copy would never show. */
function hasControl(field: string): boolean {
  // Reads the exported set rather than re-testing the two maps, so what a verify
  // script asserts is answerable and what this panel actually offers a control for
  // are the same sentence, not two that agree today.
  return ANSWERABLE_INTAKE_FIELDS.has(field);
}

/**
 * The one vocabulary in this file that isn't imported, because the boolean
 * columns don't have one to import: a yes/no column's three states ARE yes, no,
 * and never-asked. The third is a first-class answer, not an empty state —
 * "no" confirms the gap and makes the deliverable declarative, "not sure" leaves
 * the benchmark hedge exactly as it is. Collapsing the two is the single mistake
 * the whole evidence-grade system turns on, which is why it gets its own chip
 * with its own sentence rather than being the absence of a click.
 */
const TRI_OPTIONS: { value: boolean | null; label: string; title: string }[] = [
  { value: true, label: "Yes", title: "Yes, they have it — takes the finding off the report entirely." },
  { value: false, label: "No", title: "No, they don't — the finding is written as confirmed at intake." },
  {
    value: null,
    label: "Not sure",
    // Deliberately covers both "he asked and they didn't know" and "he never
    // asked": the column cannot tell those apart, and both leave the same hedge.
    title:
      "Not sure, or not asked — the column can't tell those apart, and either way the finding stays hedged as an industry pattern.",
  },
];

/**
 * What a row says when it is STILL on the list after he answered it.
 *
 * This sentence is the whole of rule 4 at the top of this file. Both outcomes are
 * honest — "not sure" really does leave the hedge in place, and clearing an
 * answer really does put the question back to unasked — and both are
 * indistinguishable from a dead button unless the row says so in words.
 */
function unchangedNote(label: string, cleared: boolean): string {
  return cleared
    ? "Cleared — back to “not asked”, so this one stays hedged as an industry pattern."
    : `Saved “${label}” — that answer doesn't settle it, so this one still reads as an industry pattern.`;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

/** One question, its control, and every finding that single answer would firm up. */
interface AskGroup {
  field: string;
  question: string;
  answerOnFile: string | null;
  currentValue: string | boolean | null;
  leakNames: string[];
}

/** The route returns one row per leak, faithfully. The operator's unit of work is
 *  a QUESTION, though, and one question can carry more than one leak (automated
 *  follow-up covers both the follow-up gap and long-cycle nurture). Grouping here
 *  keeps the API a plain projection of the taxonomy while the panel reads as the
 *  list of things he actually has to ask — and, now, one control per question
 *  rather than one per leak. */
function groupByQuestion(gaps: LeakGap[]): AskGroup[] {
  const order: AskGroup[] = [];
  const byField = new Map<string, AskGroup>();
  for (const gap of gaps) {
    if (!gap.field || !gap.question) continue;
    const existing = byField.get(gap.field);
    if (existing) {
      existing.leakNames.push(gap.leakName);
      continue;
    }
    const group: AskGroup = {
      field: gap.field,
      question: gap.question,
      answerOnFile: gap.answerOnFile,
      // Every row for one field carries the same stored answer (the route
      // resolves it once, per field), so the first one is the answer.
      currentValue: gap.currentValue,
      leakNames: [gap.leakName],
    };
    byField.set(gap.field, group);
    order.push(group);
  }
  return order;
}

/** The answer currently shown for a field, read back off the payload. */
function answerOf(
  payload: LeakGapsResponse | null,
  field: string
): { value: string | boolean | null; label: string | null } {
  const row = payload?.collectible.find((g) => g.field === field);
  return { value: row?.currentValue ?? null, label: row?.answerOnFile ?? null };
}

/** Put one answer onto every row that names that field, and nothing else.
 *
 *  THE COUNTS ARE DELIBERATELY UNTOUCHED. Only the server can know whether an
 *  answer upgrades the leak, takes it off the report entirely, or changes nothing
 *  — so guessing the new headline here would be a second copy of the detection
 *  rules, and the one number in this panel that must never be invented. */
function withAnswer(
  payload: LeakGapsResponse,
  field: string,
  answer: { value: string | boolean | null; label: string | null }
): LeakGapsResponse {
  return {
    ...payload,
    collectible: payload.collectible.map((g) =>
      g.field === field
        ? { ...g, currentValue: answer.value, answerOnFile: answer.label }
        : g
    ),
  };
}

/** "3 of 8 findings will read as industry pattern instead of fact." — the cost,
 *  in the words the owner used, with the singular case written out rather than
 *  bolted on with an "(s)". */
function costLine(inferred: number, total: number): string {
  return inferred === 1
    ? `1 of ${total} findings will read as an industry pattern instead of fact.`
    : `${inferred} of ${total} findings will read as industry pattern instead of fact.`;
}

/** The other half of the picture, so the count above has something to sit
 *  against: how much of the report will state a fact, and where that firmness
 *  comes from. Built as one string rather than assembled in JSX, where a line
 *  break before the closing full stop renders as "…they told us) ." */
function firmLine(counts: LeakGapsResponse["counts"], hasQuestions: boolean): string {
  const firm = counts.observed + counts.disclosed;
  const split =
    counts.disclosed > 0
      ? ` (${counts.observed} measured, ${counts.disclosed} they told us)`
      : "";
  const head = firm === 0 ? "None of them reads as fact yet" : `${firm} will read as fact${split}`;
  const tail = hasQuestions
    ? " Answer one below and it moves — the answer saves as you click it."
    : "";
  return `${head}.${tail}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Line({
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

function Footnote({ iso, s }: { iso: string | null; s: Scale }) {
  if (!iso) return null;
  const when = fmtDate(iso);
  if (!when) return null;
  return (
    <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
      Read from the {when} research snapshot — refresh research to re-measure.
    </span>
  );
}

/**
 * One answer chip.
 *
 * IT WRAPS RATHER THAN TRUNCATES. The inline layout lives in a narrow sidebar
 * column, and some of these labels are whole sentences ("Someone gets back to them
 * next morning"). A nowrap chip would push the column sideways; an ellipsis would
 * hide the difference between two answers that mean opposite things. So the text
 * wraps inside the pill and the row grows by a line instead — in both layouts,
 * because a 560px pane still can't fit four of those on one line.
 */
function Chip({
  label,
  active,
  disabled,
  title,
  onClick,
  s,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
  s: Scale;
}) {
  return (
    <button
      type="button"
      // aria-pressed, not role="radio", to match the chips and tri-controls the
      // intake form already ships. A radiogroup owes screen-reader users
      // arrow-key navigation and a single tab stop; these are plain toggles he
      // tabs through one at a time, which is also the faster keyboard path
      // mid-call. Claiming a contract we don't implement would be worse than not
      // claiming it.
      aria-pressed={active}
      aria-disabled={disabled}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        padding: s.chipPad,
        fontSize: s.chip,
        fontFamily: "inherit",
        lineHeight: 1.35,
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
        background: active ? "var(--accent-grad)" : "transparent",
        color: active ? "#fff" : "var(--text-3)",
        opacity: disabled ? 0.55 : 1,
        maxWidth: "100%",
        whiteSpace: "normal",
        wordBreak: "break-word",
        transition: "opacity 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

/**
 * The control for one question, chosen by the field the taxonomy named.
 *
 * A FIELD WE CANNOT RESOLVE GETS NO CONTROL, and that is on purpose. Guessing a
 * vocabulary would put words in the client's mouth that the form never offered
 * and the detectors would not recognise; the honest fallback is the row as it has
 * always read — the question, and nothing pretending to record it. The caller
 * asks hasControl() before rendering this at all, so it can say so in the row;
 * the null return here is the same refusal, held locally so this component can
 * never be the one that invents an option list. Nothing lands there today: every
 * field an intakeAsk currently names is in one of the two maps above.
 */
function AnswerControl({
  field,
  question,
  value,
  disabled,
  onPick,
  s,
}: {
  field: string;
  question: string;
  value: string | boolean | null;
  disabled: boolean;
  /** `value` is what gets written to the column; `label` is that same answer in
   *  the operator's words for the optimistic "on file" line (null when the answer
   *  is being cleared or is a blank boolean); `note` is what the row says if it
   *  survives the answer. */
  onPick: (
    value: string | boolean | null,
    label: string | null,
    note: string
  ) => void;
  s: Scale;
}) {
  // A span rather than a div because the row that hosts it is phrasing content,
  // and it WRAPS rather than scrolls: the inline layout lives in a narrow sidebar
  // column, so the chips have to fall onto a second line instead of pushing the
  // column sideways.
  const row = (children: React.ReactNode) => (
    <span
      role="group"
      aria-label={question}
      style={{ display: "flex", flexWrap: "wrap", gap: 4, minWidth: 0 }}
    >
      {children}
    </span>
  );

  const options = optionsFor(field);
  if (options) {
    return row(
      options.map((o) => {
        const active = value === o.value;
        return (
          <Chip
            key={o.value}
            s={s}
            label={o.label}
            active={active}
            disabled={disabled}
            // These vocabularies can say "not sure" where the form offers it, so
            // NOTHING is lit when nothing is on file — an unasked question must
            // not wear an answer. Clicking the lit chip is the way back to that
            // state, which is the only undo a chip row can carry without adding
            // an option the intake form doesn't have.
            title={active ? "Recorded — click again to clear it back to “not asked”" : o.label}
            onClick={() =>
              active
                ? onPick(null, null, unchangedNote(o.label, true))
                : onPick(o.value, o.label, unchangedNote(o.label, false))
            }
          />
        );
      })
    );
  }

  if (BOOLEAN_FIELD_SET.has(field)) {
    return row(
      TRI_OPTIONS.map((o) => (
        <Chip
          key={String(o.value)}
          s={s}
          label={o.label}
          // A boolean column has no separate "not asked" slot, so null lights
          // "Not sure" — which is exactly what the column means and what the
          // intake form's own tri-control shows for the same value.
          active={value === o.value}
          disabled={disabled}
          title={o.title}
          // A null here is the "Not sure" ANSWER, not a clear, so it keeps the
          // "Saved …" wording. The column stores the same thing either way; what
          // differs is what he just did, and that is what the note describes.
          onClick={() =>
            onPick(o.value, o.value === null ? null : o.label, unchangedNote(o.label, false))
          }
        />
      ))
    );
  }

  return null;
}

// ── The panel ─────────────────────────────────────────────────────────────────

export function IntakeGaps({
  businessId,
  reloadKey = 0,
  density = "compact",
  layout = "inline",
  onAnswered,
}: IntakeGapsProps) {
  const s = scaleFor(density, layout);
  // Whether a question gets its own frame. Read at ONE place below, so the two
  // layouts can never end up with two different row structures.
  const carded = layout === "panel";
  const [data, setData] = useState<LeakGapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Fields whose own save is in flight. A Set rather than one field, so two quick
  // answers cannot cancel each other's spinner or each other's rollback — the
  // same shape WorkflowPanel uses for its switches.
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  // The same set, readable from inside an async handler that closed over an older
  // render — used to decide which rows a fresh payload may overwrite.
  const pendingRef = useRef<ReadonlySet<string>>(new Set());
  // What THIS session's answer did, per field, already phrased. Used for one
  // thing only: a row that is STILL here after he answered it has to say why, or
  // an answer that changed nothing looks like a broken button.
  const [answered, setAnswered] = useState<Record<string, string>>({});
  // Every read is numbered so a stale one — a superseded refetch, or one landing
  // after he switched business — can be dropped instead of overwriting newer data.
  const seqRef = useRef(0);

  const setPendingBoth = useCallback((next: ReadonlySet<string>) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  // Answers belong to the client they were given for. Switching business drops
  // them, or the confirmation line under one client's question would be quoting
  // an answer a different client gave.
  useEffect(() => {
    setAnswered({});
    setPendingBoth(new Set());
  }, [businessId, setPendingBoth]);

  /**
   * Re-read the panel. Used on mount, whenever a host bumps reloadKey, and after
   * every saved answer.
   *
   * IT IS A REFETCH, NOT LOCAL ARITHMETIC, and it has to be. One answer can
   * upgrade a leak to "they told us", take it off the report entirely (which
   * moves the TOTAL, not just the guessed count), or change nothing at all.
   * Deciding which of those happened is detection's job, and a local guess at it
   * would be a second copy of the rules that the deliverables don't use.
   */
  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const seq = ++seqRef.current;
      setLoading(true);
      let body: LeakGapsResponse;
      try {
        const res = await fetch(`/api/leak-gaps?businessId=${encodeURIComponent(businessId)}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        body = (await res.json()) as LeakGapsResponse;
      } catch (err: unknown) {
        // An aborted or superseded request is this read being replaced, not a
        // failure — the read that replaced it owns the spinner from here, so this
        // one must not switch it off or flash an error on its way out.
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (seq !== seqRef.current) return;
        setFailed(true);
        setLoading(false);
        return;
      }
      if (seq !== seqRef.current) return;
      setData((prev) => {
        const stillPending = pendingRef.current;
        if (!prev || stillPending.size === 0) return body;
        // A field whose own save is still in the air keeps the answer he just
        // clicked: the server's copy of that field predates his write, so taking
        // it would flick the chip backwards for a moment mid-call.
        return {
          ...body,
          collectible: body.collectible.map((g) => {
            if (!g.field || !stillPending.has(g.field)) return g;
            const local = answerOf(prev, g.field);
            return { ...g, currentValue: local.value, answerOnFile: local.label };
          }),
        };
      });
      setFailed(false);
      setLoading(false);
    },
    [businessId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setFailed(false);
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, reloadKey]);

  /**
   * Record one answer: optimistic, rolled back and toasted on failure — the same
   * shape as every other PATCH in this codebase (WorkflowPanel.toggleRow,
   * crm/page.tsx patchField), with two deliberate specifics.
   *
   *  · THE BODY CARRIES ONE KEY. /api/businesses/[id] takes a partial body and
   *    writes exactly what it is given, so a single-field PATCH cannot blank a
   *    column this panel never showed. It is also why the answer given here does
   *    not fight with the full intake form, which likewise only writes what the
   *    operator touched in it.
   *  · THE SNAPSHOT IS ONE FIELD, not the whole payload, so a second answer
   *    already in flight is not silently undone by the first one failing.
   */
  const saveAnswer = async (
    field: string,
    value: string | boolean | null,
    label: string | null,
    note: string
  ) => {
    if (!data || pendingRef.current.has(field)) return;
    const before = answerOf(data, field);

    const nextPending = new Set(pendingRef.current);
    nextPending.add(field);
    setPendingBoth(nextPending);

    // Optimistic: the chip lights up now. The COUNT deliberately does not move
    // until the server says what the answer did to it.
    setData((prev) => (prev ? withAnswer(prev, field, { value, label }) : prev));
    const restore = () =>
      setData((prev) => (prev ? withAnswer(prev, field, before) : prev));

    try {
      const res = await fetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const payload: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        restore();
        const err = payload as { error?: string };
        toast.error(err.error || "Couldn't save that answer — nothing was recorded");
        return;
      }

      setAnswered((prev) => ({ ...prev, [field]: note }));
      // Hosts keeping their own copy of the row get told, so the full intake form
      // doesn't sit there showing a stale blank for a question already answered.
      onAnswered?.(field, value);
      // Then, and only then, ask the server what that answer actually changed.
      await load();
    } catch {
      restore();
      toast.error("Couldn't save that answer — nothing was recorded");
    } finally {
      const rest = new Set(pendingRef.current);
      rest.delete(field);
      setPendingBoth(rest);
    }
  };

  // A refetch triggered by a save keeps the previous list on screen rather than
  // blanking to a spinner — he just answered something and is watching for what
  // changed, so the list must not disappear underneath him. It dims instead, which
  // is enough to say "this number is being recomputed" without losing the compare.
  //
  // A FAILED REFETCH DOES NOT TAKE THE PANEL AWAY EITHER, now that it re-reads on
  // every answer rather than once. A blip at 11pm used to replace the whole list
  // with an error line; instead the last good list stays, labelled as possibly one
  // answer behind. Stale and SAID to be stale beats correct-or-nothing here — the
  // answers themselves are already saved, and he is mid-call.
  const wrap = (children: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: s.stack,
        opacity: loading && data ? 0.5 : 1,
        transition: "opacity 140ms ease",
      }}
    >
      {failed && data && (
        <Line
          s={s}
          tone="var(--warn)"
          icon={<HelpCircle size={s.icon} strokeWidth={2} />}
          text="Couldn't re-check just now — answers are still saving, but the counts below may be one behind. The next answer refreshes them."
        />
      )}
      {children}
    </div>
  );

  if (loading && !data) {
    return wrap(
      <Line
        s={s}
        tone="var(--text-subtle)"
        icon={
          <Loader2
            size={s.icon}
            strokeWidth={2.2}
            style={{ animation: "lg-spin 0.7s linear infinite" }}
          />
        }
        text="Checking what's still guessed…"
      />
    );
  }

  // A failed check with NOTHING to fall back on is a failed check. It must not
  // read as "nothing to collect" — that is the one wrong answer this panel can
  // give. (A failure with a previous list still in hand is handled in wrap()
  // above, which keeps the list and labels it as possibly stale.)
  if (!data) {
    return wrap(
      <Line
        s={s}
        tone="var(--text-subtle)"
        icon={<HelpCircle size={s.icon} strokeWidth={2} />}
        text="Couldn't check what's still guessed. The intake answers still save normally."
      />
    );
  }

  // Nothing scanned → there is nothing to have gaps IN. Say that, rather than
  // rendering an empty list that reads as a clean bill of health.
  if (!data.scanned) {
    return wrap(
      <Line
        s={s}
        tone="var(--text-subtle)"
        icon={<ScanSearch size={s.icon} strokeWidth={2} />}
        text="Nothing scanned for this client yet. Refresh research or generate the pack, then this shows which findings are still guesses."
      />
    );
  }

  if (data.counts.total === 0) {
    return wrap(
      <Line
        s={s}
        tone="var(--text-subtle)"
        icon={<ScanSearch size={s.icon} strokeWidth={2} />}
        text="The last scan fired no leaks for this client — nothing to hedge, and nothing to collect."
      />
    );
  }

  // Calm confirmation, not a celebration: one line, muted, and then out of the way.
  if (data.counts.inferred === 0) {
    return wrap(
      <>
        <Line
          s={s}
          tone="var(--money)"
          icon={<Check size={s.icon} strokeWidth={2.6} />}
          text={`Nothing left guessing — all ${data.counts.total} findings will read as measured or as something they told us.`}
        />
        <Footnote iso={data.researchAt} s={s} />
      </>
    );
  }

  const groups = groupByQuestion(data.collectible);

  return wrap(
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: s.head, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
          {costLine(data.counts.inferred, data.counts.total)}
        </span>
        <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
          {firmLine(data.counts, groups.length > 0)}
        </span>
      </div>

      {groups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: s.stack }}>
          {groups.map((g) => {
            const saving = pending.has(g.field);
            const justAnswered = answered[g.field];
            const answerable = hasControl(g.field);
            return (
              <div
                key={g.field}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: s.gap,
                  ...(carded ? CARD : null),
                }}
              >
                <span
                  style={{
                    color: saving ? "var(--accent)" : "var(--warn)",
                    flex: "none",
                    marginTop: 2,
                    display: "inline-flex",
                  }}
                >
                  {/* The spinner replaces the marker rather than sitting beside it:
                      same row height, and it appears exactly where his eye already
                      is — on the question he just answered. */}
                  {saving ? (
                    <Loader2
                      size={s.icon}
                      strokeWidth={2.2}
                      style={{ animation: "lg-spin 0.7s linear infinite" }}
                    />
                  ) : (
                    <HelpCircle size={s.icon} strokeWidth={2} />
                  )}
                </span>
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}
                >
                  {/* Verbatim from the intake form — he has to be able to read this
                      out word for word on the call, and then record the answer in
                      this same row without looking anywhere else. */}
                  <span style={{ fontSize: s.body, color: "var(--text-2)", lineHeight: 1.45 }}>
                    {g.question}
                  </span>
                  {answerable && (
                    <AnswerControl
                      s={s}
                      field={g.field}
                      question={g.question}
                      value={g.currentValue}
                      disabled={saving}
                      onPick={(value, label, note) =>
                        void saveAnswer(g.field, value, label, note)
                      }
                    />
                  )}
                  <span style={{ fontSize: s.hint, color: "var(--text-3)", lineHeight: 1.5 }}>
                    {g.leakNames.join(" · ")}
                  </span>
                  {/* A field with no control we can resolve. Nothing lands here
                      today; if something ever does, it must not look like a
                      control that failed to render. */}
                  {!answerable && (
                    <span
                      style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}
                    >
                      No one-click answer for this one — it&apos;s in the full intake form.
                    </span>
                  )}
                  {/* THE ROW IS STILL HERE AFTER HE ANSWERED IT. That happens when
                      the answer was "not sure" — the honest outcome, and the one
                      that looks most like a bug if it isn't said out loud. */}
                  {justAnswered && !saving ? (
                    <span
                      style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}
                    >
                      {/* THE NOTE ONLY EARNS ITS CLAIM IF THE RE-CHECK RAN. "That
                          answer doesn't settle it" is inferred from the row still
                          being here after a refetch — but a row also survives when
                          the refetch itself FAILED, and then the claim is very
                          likely false ("voicemail only" almost certainly did settle
                          it; we just couldn't ask). Saying so anyway would break
                          rule 4 in the other direction: not a dead button, a
                          confident wrong answer. So when the re-check didn't land
                          we state only what we actually know — it saved. */}
                      {failed
                        ? "Saved. Couldn't re-check what it changed just now, so this row may be one answer behind."
                        : justAnswered}
                    </span>
                  ) : (
                    // Asked and answered "not sure" on an earlier call is a different
                    // problem from never asked: repeating the question the same way
                    // gets the same answer.
                    !saving &&
                    g.answerOnFile && (
                      <span
                        style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}
                      >
                        On file: “{g.answerOnFile}” — that answer doesn&apos;t settle it.
                      </span>
                    )
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* NEVER TAKES THE CARD TREATMENT, in either layout. Below a divider, flat,
          and unframed is how this block says "not a to-do" — dressing it like the
          answerable rows above would make it look like five more things he has
          failed to click, which is rule 1 at the top of this file. */}
      {data.structural.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            paddingTop: s.stack,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: s.gap }}>
            <span
              style={{
                color: "var(--text-subtle)",
                flex: "none",
                marginTop: 2,
                display: "inline-flex",
              }}
            >
              <EyeOff size={s.icon} strokeWidth={2} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: s.body, color: "var(--text-3)", lineHeight: 1.45 }}>
                {data.structural.length === 1
                  ? "1 stays hedged whatever you ask"
                  : `${data.structural.length} stay hedged whatever you ask`}
              </span>
              <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
                {data.structural.map((g) => g.leakName).join(" · ")}
              </span>
              {/* Stated once, plainly, so it never reads as a chore he forgot — and
                  it carries no control, because there is no answer that would
                  clear it. That absence is the point, not an omission. */}
              <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
                Nothing on the intake form can confirm these. Closing one needs a new
                question on the form, not a better call — not a to-do.
              </span>
            </span>
          </div>
        </div>
      )}

      <Footnote iso={data.researchAt} s={s} />
    </>
  );
}
