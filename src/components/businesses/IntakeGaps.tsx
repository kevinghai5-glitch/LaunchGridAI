"use client";

// ── What he failed to collect ─────────────────────────────────────────────────
// Every leak still graded "inferred" after intake is a leak the deliverables MUST
// hedge — "most businesses like this…, we haven't measured yours". Hedged copy is
// weaker copy, and the fix is usually one question that never got asked on the
// kickoff call. This panel turns that invisible quality problem into a to-do list:
// the questions still unanswered, and the findings each answer would firm up.
//
// TWO THINGS IT REFUSES TO DO, because both would make it lie:
//
//  1. IT NEVER PRESENTS AN UNCOLLECTIBLE GAP AS A CHORE. The taxonomy separates
//     "we never asked" from "no question we ask could ever confirm this" (webchat,
//     lead qualification at the front door, social DMs, the dormant-database
//     claim). The second kind is listed, plainly, in its own block — because a
//     to-do he can never clear is a nag that teaches him to ignore the panel.
//
//  2. IT NEVER SHOWS AN EMPTY LIST AS A CLEAN BILL OF HEALTH. A client with no
//     research snapshot has an empty list because nothing has been scanned, not
//     because nothing is missing. Those two read completely differently here.
//
// And when there genuinely is nothing to do it says so once, quietly. A quality
// panel that celebrates is a panel that gets skimmed.

import { useEffect, useState } from "react";
import { Check, EyeOff, HelpCircle, Loader2, ScanSearch } from "lucide-react";

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
  /** Density only, matched to IntakeForm's two hosts. Same content either way. */
  density?: "compact" | "comfortable";
}

// ── Density ───────────────────────────────────────────────────────────────────

interface Scale {
  stack: number;
  head: number;
  body: number;
  hint: number;
  gap: number;
  icon: number;
}

const SIZE: Record<NonNullable<IntakeGapsProps["density"]>, Scale> = {
  compact: { stack: 9, head: 12, body: 11, hint: 10.5, gap: 7, icon: 12 },
  comfortable: { stack: 11, head: 13, body: 12, hint: 11, gap: 8, icon: 13 },
};

// ── Grouping ──────────────────────────────────────────────────────────────────

/** One question, and every finding that single answer would firm up. */
interface AskGroup {
  field: string;
  question: string;
  answerOnFile: string | null;
  leakNames: string[];
}

/** The route returns one row per leak, faithfully. The operator's unit of work is
 *  a QUESTION, though, and one question can carry more than one leak (automated
 *  follow-up covers both the follow-up gap and long-cycle nurture). Grouping here
 *  keeps the API a plain projection of the taxonomy while the panel reads as the
 *  list of things he actually has to ask. */
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
      leakNames: [gap.leakName],
    };
    byField.set(gap.field, group);
    order.push(group);
  }
  return order;
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
    ? " Each answer below turns one hedge into something they told us."
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

// ── The panel ─────────────────────────────────────────────────────────────────

export function IntakeGaps({ businessId, reloadKey = 0, density = "compact" }: IntakeGapsProps) {
  const s = SIZE[density];
  const [data, setData] = useState<LeakGapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/leak-gaps?businessId=${encodeURIComponent(businessId)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as LeakGapsResponse;
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

  // A refetch triggered by a save keeps the previous list on screen rather than
  // blanking to a spinner — he just answered something and is watching for what
  // changed, so the list must not disappear underneath him. It dims instead, which
  // is enough to say "this number is being recomputed" without losing the compare.
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

  // A failed check is a failed check. It must not read as "nothing to collect" —
  // that is the one wrong answer this panel can give.
  if (failed || !data) {
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
        text="Nothing scanned for this client yet. Run a cold audit or generate the pack, then this shows which findings are still guesses."
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
          {groups.map((g) => (
            <div key={g.field} style={{ display: "flex", alignItems: "flex-start", gap: s.gap }}>
              <span
                style={{
                  color: "var(--warn)",
                  flex: "none",
                  marginTop: 2,
                  display: "inline-flex",
                }}
              >
                <HelpCircle size={s.icon} strokeWidth={2} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {/* Verbatim from the intake form — he has to be able to read this
                    out word for word on the call. */}
                <span style={{ fontSize: s.body, color: "var(--text-2)", lineHeight: 1.45 }}>
                  {g.question}
                </span>
                <span style={{ fontSize: s.hint, color: "var(--text-3)", lineHeight: 1.5 }}>
                  {g.leakNames.join(" · ")}
                </span>
                {/* Asked and answered "not sure" is a different problem from never
                    asked: repeating the question the same way gets the same answer. */}
                {g.answerOnFile && (
                  <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
                    On file: “{g.answerOnFile}” — that answer doesn&apos;t settle it.
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

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
              {/* Stated once, plainly, so it never reads as a chore he forgot. */}
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
