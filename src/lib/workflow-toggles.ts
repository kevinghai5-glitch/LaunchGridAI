/**
 * ============================================================================
 * WHICH OF THE 14 WORKFLOWS IS ACTUALLY IN THIS CLIENT'S BUILD
 * ============================================================================
 *
 * WHAT THIS FILE IS FOR
 * `src/lib/workflow-catalogue.ts` says what the fourteen workflows ARE and what
 * would take each one out. It deliberately cannot see a fired leak — that is the
 * rule the whole catalogue is shaped around, and it must stay that way.
 *
 * This file is the layer above it: the one place that puts the catalogue, the
 * client's intake answers, the operator's stored decisions and THE EVIDENCE
 * together and answers the only question the toggles screen asks — is this
 * workflow in the build, who decided that, and is the operator allowed to change
 * it? Nothing else in the codebase should do this arithmetic. If a second copy of
 * it appears, the screen and the deliverable will eventually disagree about what
 * the client is getting, and the client is the one who finds out.
 *
 * ── THE PRECEDENCE ──────────────────────────────────────────────────────────
 *
 *      operator override  >  applicability rule  >  default
 *
 * ...except a LOCKED workflow, which nothing can switch off. See THE EVIDENCE
 * LOCK below.
 *
 * Why that order. The operator is in the room with the client and knows things no
 * column on the form can hold ("the chat box can't go on their site"), so his
 * decision beats a rule. The rule beats the default because it is a fact the
 * client actually told us. The default is last because it is what we believe with
 * nothing else to go on — and every default is "in the build", because everything
 * ReclaimedHQ sells ships unless something specific takes it out.
 *
 * ── THE EVIDENCE LOCK ───────────────────────────────────────────────────────
 * Kevin's rule, verbatim: "an observed leak's toggle is disabled with a tooltip."
 *
 * If a workflow is justified by a leak we MEASURED — grade "observed" — its toggle
 * is locked ON and no override can take it out. The reason is not tidiness: the
 * client's report will carry that measurement as a finding, and handing a paying
 * client a document that says "we measured that you have no online booking" next
 * to a build that leaves the booking workflow out is a contradiction he has to
 * explain on a call.
 *
 * The other two grades deliberately do NOT lock:
 *   · disclosed — the client told us. A client who can tell us a thing can also
 *     tell us he will handle it himself, and we are not going to argue with him
 *     about his own business.
 *   · inferred — we are guessing. A guess must never overrule the operator; that
 *     is the whole reason the grades exist.
 *
 * ── TWO THINGS THAT ARE NOT THE ON/OFF ANSWER ───────────────────────────────
 * Each resolved row also carries a PRIORITY and, sometimes, a SUGGESTION. Both
 * read the client's intake answers and NEITHER can change whether a workflow is
 * in the build:
 *
 *   · priority — "high" says this client's answers make this workflow unusually
 *     valuable to them, so wire it first. It exists so one specific fact (they
 *     take deposits and have no online way to collect one) can raise Text-to-Pay
 *     up the list WITHOUT being able to take it out of a build. Everything at
 *     "standard" is exactly as installed as everything at "high".
 *   · suggestion — "the client said something that makes taking this one out
 *     reasonable, and we have not done it." A sentence for the operator to read
 *     and act on himself, next to a switch that is still on and still his.
 *
 * The arithmetic for both lives in the catalogue, beside the workflows, and comes
 * back as text and a level — never as a boolean the precedence below could pick
 * up by accident.
 *
 * ── WHAT THIS FILE MUST NEVER READ ──────────────────────────────────────────
 * `servicesFocus` (and its neighbour `buildPriorities`) are COPY EMPHASIS ONLY.
 * They shape wording and ordering in a document — which service gets named first,
 * which phase leads the roadmap — and they must never add, remove or reweight a
 * leak, a score or a workflow.
 *
 * These toggles decide what gets BUILT. Conflating the two is a specific, easy,
 * expensive mistake: "Which of these do you want prioritized in your build?" reads
 * exactly like a question about scope, and it is not one. A client who says he
 * cares most about after-hours calls has told us how to write the document, not
 * that the other thirteen workflows are cancelled. He paid for fourteen. So
 * neither field is imported here, neither is a parameter below, and neither may
 * ever become one.
 *
 * ── A NAME THAT EXISTS TWICE, ON PURPOSE ────────────────────────────────────
 * `workflow-catalogue.ts` also exports a `resolveWorkflows`. That one is the
 * catalogue's own default+rule+override arithmetic and knows nothing about
 * evidence; this one is the full answer and is what the screen and the API use.
 * The signatures are deliberately incompatible — that one takes positional
 * arguments, this one takes a single object — so importing the wrong one is a
 * compile error rather than a screen that quietly forgets to lock anything.
 * ==========================================================================*/

import type { ClientIntake, EvidenceGrade } from "./leak-taxonomy";
import type { FiredLeak } from "./leak-detection";
import { attributesToClient } from "./leak-narrative";
import {
  WORKFLOWS,
  resolveWorkflow,
  workflowOffSuggestion,
  workflowPriority,
  type WorkflowDefinition,
  type WorkflowPriority,
  type WorkflowToggles,
} from "./workflow-catalogue";

/* ============================================================================
 * SECTION 1 — THE RESOLVED SHAPE
 * ==========================================================================*/

/**
 * WHO DECIDED. One word, so the screen can show it next to each switch.
 *
 *   operator — he made an explicit decision and it is stored against this client.
 *   rule     — something the software applied took it out of his hands: either an
 *              applicability rule reading an intake answer, or the evidence lock.
 *   default  — nothing decided it. The workflow is in because that is what every
 *              build contains.
 *
 * NOTE THE ASYMMETRY, because it is what makes "rule" unambiguous: every
 * applicability rule in the catalogue is an OFF-SWITCH. No rule can turn a
 * workflow on — the default already does that — so "off, and he did not do it"
 * can only mean a rule did. If someone ever writes a rule that turns something ON,
 * this derivation is the thing to revisit.
 */
export type ToggleSource = "default" | "rule" | "operator";

export interface ResolvedWorkflow {
  workflow: WorkflowDefinition;

  /** Is it in this client's build? */
  on: boolean;

  /** Who decided — see ToggleSource. */
  source: ToggleSource;

  /**
   * True when the operator may not switch this off: a leak we MEASURED justifies
   * it. The screen disables the switch; the API refuses the write.
   */
  locked: boolean;

  /** Operator-facing wording naming the measurement. Present only when locked. */
  lockReason?: string;

  /**
   * The fired leaks this workflow answers, strongest first.
   *
   * EVIDENCE, NOT A PRECONDITION. An empty list is a completely normal state and
   * never means the workflow is out — "Appointment Cancelled — Stop Reminders"
   * has no leak in the taxonomy that can fire for it and ships in every build.
   * This list exists so the screen can show WHY a workflow is locked, and so a
   * document can cite the finding it fixes.
   */
  justification: FiredLeak[];

  /**
   * The one line the operator reads off the screen. Not in the original spec for
   * this shape and added deliberately: a switch sitting OFF with no explanation is
   * the fastest way to make him distrust the panel, and the catalogue already
   * computes the sentence ("They told us they have no social accounts…"). When
   * locked, this is the lock reason, because that is the fact that decided it.
   */
  because: string;

  /**
   * ORDERING, NOT INCLUSION. "high" means this client's own answers say this
   * workflow is unusually valuable to them — it is still exactly as installed as
   * every other one. Almost always "standard", which is the norm and not a
   * demotion.
   *
   * It is deliberately its own field rather than a nudge to `on`: the one rule
   * that sets it reads hasOnlinePayment, and that column must never be able to
   * decide whether a workflow ships. See WorkflowPriorityRule in the catalogue.
   */
  priority: WorkflowPriority;

  /** Why priority was raised, in the operator's language. Null at "standard". */
  priorityReason: string | null;

  /**
   * A HINT, NOT A DECISION: the client said something that makes taking this one
   * out by hand reasonable, and the software has deliberately not acted on it.
   * Null for almost every workflow and every client.
   *
   * NULL WHILE LOCKED, and that is not a technicality. A locked switch cannot be
   * flipped and the API refuses the write, so showing "you may want to remove
   * this" beside it would be advice the operator cannot take — the exact kind of
   * dead end that makes somebody power-cycle a page at 11pm. The lock's own
   * reason says what to change instead.
   */
  suggestion: string | null;
}

export interface ResolveWorkflowsInput {
  /**
   * The workflows to resolve. Defaults to the real fourteen; a caller passes a
   * subset only in a test or a fixture, never in the app.
   */
  catalogue?: readonly WorkflowDefinition[];

  /** What the client told us, or null before they have told us anything. */
  intake?: ClientIntake | null;

  /**
   * The leaks that fired for this client, each carrying the grade it was born
   * with. Pass the REPORT set (in-scope, ranked, fold-ins applied), not every
   * raw fire: the lock's justification is "the client's report carries this
   * finding", so locking on a fire the report never prints would be locking on
   * something the client cannot see.
   *
   * Null/empty is a legitimate state — no scan yet — and it means nothing locks.
   * A screen showing an unscanned client must say so, or an operator reads a
   * panel with no locks on it as "nothing was measured here".
   */
  firedLeaks?: readonly FiredLeak[] | null;

  /**
   * The operator's explicit decisions, exactly as stored in
   * Business.workflowToggles: { [workflowId]: boolean }. ONLY decisions are
   * stored — an absent key means "no opinion, use the rule", which is the state
   * almost every workflow stays in for almost every client.
   */
  overrides?: WorkflowToggles | null;
}

/* ============================================================================
 * SECTION 2 — THE EVIDENCE LOCK
 * ==========================================================================*/

/** The grade that locks. Written once, here, so the rule is greppable. */
const LOCKING_GRADE: EvidenceGrade = "observed";

/**
 * The fires that justify this workflow, strongest first.
 *
 * Sorted rather than left in the caller's order so the same client resolves the
 * same way every time — the tooltip quotes the top one, and a tooltip that
 * changes wording between two page loads is a tooltip nobody trusts. Score
 * descending, ties broken by leak id so the order is total.
 */
function justifyingFires(
  workflow: WorkflowDefinition,
  firedLeaks: readonly FiredLeak[] | null | undefined
): FiredLeak[] {
  if (!firedLeaks || firedLeaks.length === 0) return [];
  const cited = new Set<string>(workflow.justifyingLeaks);
  return firedLeaks
    .filter((f) => cited.has(f.leak.id))
    .slice()
    .sort((a, b) => b.score - a.score || a.leak.id.localeCompare(b.leak.id));
}

/**
 * The evidence line we may quote as OUR measurement.
 *
 * A fire's `evidence` array is not uniformly ours. When the client also confirmed
 * a gap at intake, the detector PREPENDS his own words ("Confirmed at intake: …")
 * so a reader sees the strongest provenance first — which means evidence[0] on an
 * OBSERVED fire can be the client's sentence, not ours. Quoting that under "we
 * measured it" is the exact lie the grade system exists to prevent, so we skip
 * any line that attributes itself to the client and use the same
 * `attributesToClient` the pack validator uses, rather than a second copy of the
 * rule that could drift from it.
 *
 * No quotable line → we say nothing specific. The grade still licenses "we
 * measured this", because OBSERVED means it was visible in the scan; only the
 * quote has to be ours.
 */
function measurementLine(fire: FiredLeak): string | null {
  for (const line of fire.evidence) {
    const trimmed = line.trim();
    if (trimmed && !attributesToClient(trimmed)) return trimmed.replace(/[.\s]+$/, "");
  }
  return null;
}

/**
 * The tooltip on a disabled switch. Operator-facing, and it has three jobs:
 * name the measurement, say why that locks the switch, and — because a gate with
 * no way out is a gate that strands you on a call — say what the actual way out
 * is. The way out is never the switch: the resolver would ignore the stored value
 * anyway. It is to change what we know.
 */
function lockReasonFor(workflow: WorkflowDefinition, fire: FiredLeak): string {
  const measured = measurementLine(fire);
  const finding = measured ? `${fire.leak.name} — ${measured}.` : `${fire.leak.name}.`;
  return (
    `Locked on. ${finding} We measured that ourselves, and it goes in this client's ` +
    `report as a finding — so the fix it names stays in the build. Leaving it out ` +
    `would hand a paying client a document that contradicts what we built. If the ` +
    `measurement is wrong, the way out is to change what we know (re-run the scan, ` +
    `or record the intake answer that contradicts it), not this switch.`
  );
}

/* ============================================================================
 * SECTION 3 — THE RESOLVER
 * ==========================================================================*/

/**
 * THE ONE PLACE THIS ARITHMETIC LIVES.
 *
 * Pure: same four inputs, same answer, every time. No database, no clock, no
 * scraping, no randomness — which is what lets the screen, the API and a
 * regenerated deliverable agree about what this client is getting.
 *
 * The precedence (operator > rule > default) is not re-implemented here. It is
 * the catalogue's `resolveWorkflow`, called below, because two copies of a
 * precedence is two chances for the screen and the document to disagree. What
 * this function adds is the evidence layer the catalogue is not allowed to see.
 */
export function resolveWorkflows(input: ResolveWorkflowsInput): ResolvedWorkflow[] {
  const { catalogue = WORKFLOWS, intake = null, firedLeaks = null, overrides = null } = input;

  return catalogue.map((workflow) => {
    const justification = justifyingFires(workflow, firedLeaks);

    // Both computed from intake alone, and NEITHER is allowed anywhere near the
    // on/off answer below — that is why they are read off their own functions in
    // the catalogue rather than folded into `resolveWorkflow`. Priority reorders a
    // list; a suggestion prints a sentence. Neither removes anything from a build.
    const priority = workflowPriority(workflow, intake);
    const suggestion = workflowOffSuggestion(workflow, intake);

    // THE SUBTLE CASE, AND THE ONE MOST LIKELY TO BE BROKEN LATER.
    //
    // The lock is computed from the EVIDENCE, before the stored override is even
    // looked at, and it wins outright. So a stale `false` sitting in
    // workflowToggles — written before the scan that found this, or by a UI bug,
    // or by a tab left open — cannot defeat it. `on` comes back true and `locked`
    // comes back true, and the stored value is simply not honoured.
    //
    // IGNORED IS NOT DELETED. His decision stays in the JSON exactly as he left
    // it. If the measurement later goes away — a re-scan, or an intake answer that
    // contradicts it — the lock lifts and his decision applies again, which is the
    // only reading of "an absent key means no opinion" that does not quietly throw
    // away something he said on purpose.
    const lockingFire = justification.find((f) => f.grade === LOCKING_GRADE);
    const override = overrides?.[workflow.id];

    if (lockingFire) {
      const lockReason = lockReasonFor(workflow, lockingFire);
      return {
        workflow,
        on: true,
        // "operator" only when he independently switched it on and the lock
        // agrees with him. Never when his stored value was overruled — crediting
        // him with a decision the software refused to honour is how a screen
        // starts lying about who is in charge. Otherwise the lock decided it, and
        // the lock is a rule.
        source: override === true ? "operator" : "rule",
        locked: true,
        lockReason,
        justification,
        because: lockReason,
        priority: priority.level,
        priorityReason: priority.because,
        // Suppressed under a lock — advice he cannot act on. See `suggestion`.
        suggestion: null,
      };
    }

    // Nothing measured justifies this one, so the ordinary precedence applies,
    // computed by the catalogue itself.
    const base = resolveWorkflow(workflow, intake, overrides);

    return {
      workflow,
      on: base.on,
      // Off without an override can only have come from an applicability rule —
      // every rule in the catalogue is an off-switch, and nothing else here can
      // turn a workflow off.
      source: base.overridden ? "operator" : base.on ? "default" : "rule",
      locked: false,
      justification,
      because: base.because,
      priority: priority.level,
      priorityReason: priority.because,
      // Kept even when the workflow is already OFF: the hint explains the client
      // fact behind the decision, and blanking it the moment he acts on it would
      // leave a switch off with nothing next to it saying why.
      suggestion,
    };
  });
}

/** One workflow's resolution, or undefined if the id is not in the catalogue. */
export function resolvedWorkflowById(
  resolved: readonly ResolvedWorkflow[],
  workflowId: string
): ResolvedWorkflow | undefined {
  return resolved.find((r) => r.workflow.id === workflowId);
}

/* ============================================================================
 * SECTION 4 — READING AND WRITING THE STORED DECISIONS
 * ==========================================================================*/

/**
 * Business.workflowToggles is a Json column, which means it holds whatever was
 * last written to it — including shapes today's code would not produce (an older
 * format, a half-finished write, hand-edited data). Read it defensively:
 *
 *   · anything that is not a plain object is no decisions at all;
 *   · a key whose value is not a boolean is dropped, because `on` is a two-state
 *     fact and a third state ("null", "maybe") would be honoured by nothing;
 *   · a key naming a workflow this catalogue does not know is KEPT. Ids are
 *     append-only, so an unknown one is far more likely to be a workflow added on
 *     another branch than a mistake, and silently dropping the operator's decision
 *     on the next write is the kind of data loss nobody notices until a build
 *     ships wrong.
 */
export function readStoredToggles(value: unknown): WorkflowToggles {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: WorkflowToggles = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "boolean") out[key] = raw;
  }
  return out;
}

/**
 * The stored decisions with one more applied. A new object every time — never a
 * mutation of what came out of the database — so a caller cannot half-write a
 * column by handing the same reference to two places.
 */
export function withOverride(
  stored: WorkflowToggles,
  workflowId: string,
  on: boolean
): WorkflowToggles {
  return { ...stored, [workflowId]: on };
}

/* ============================================================================
 * SECTION 5 — THE WIRE SHAPE
 * ==========================================================================*/

/**
 * ONE ROW ON THE TOGGLES SCREEN.
 *
 * A flat projection, not the WorkflowDefinition itself, for a concrete reason:
 * `applicability` can carry an `isOff` FUNCTION, and JSON.stringify drops
 * functions without a word. Sending the definition whole would put a
 * half-serialized object on the wire that looks complete and is not — the exact
 * kind of thing that gets read as "the rule is missing" months later. Everything
 * the screen needs is named explicitly below.
 *
 * IMPORT THESE TYPES WITH `import type`. This module reaches leak-narrative at
 * runtime; a value import from a client component would drag the taxonomy into
 * the browser bundle for the sake of a shape that is erased at compile time.
 */
export interface WorkflowToggleRow {
  id: string;
  name: string;
  /** Owner-language description, straight from the catalogue. */
  whatItDoes: string;
  on: boolean;
  source: ToggleSource;
  locked: boolean;
  lockReason: string | null;
  because: string;
  /**
   * True for the four workflows that carry an applicability rule at all, so the
   * screen can show which ones a client fact can move. NOT "it is off" — all four
   * rules are off-switches and every other answer leaves the workflow in.
   */
  conditional: boolean;
  /**
   * THE ONE THING THAT TAKES THIS WORKFLOW OUT OF A BUILD, in plain words, where
   * the catalogue names one — null for the workflows that name none.
   *
   * It is a REASON, not a state: it reads the same whether the workflow is
   * currently in or out. For the four conditional workflows this is the rule's own
   * `offWhen`; for Webchat Capture it is the hand-decision note the catalogue
   * carries so the operator does not have to wonder whether he is allowed to
   * switch it off. The name says "operator" because that is who reads it.
   */
  operatorOffReason: string | null;
  /**
   * "high" when this client's answers make this workflow unusually valuable to
   * them — ORDERING AND EMPHASIS ONLY. It is not a second on/off flag and the
   * screen must never render it as one: every workflow with `on: true` is equally
   * in the build, whatever this says.
   */
  priority: WorkflowPriority;
  /** Why, in plain words. Null at "standard". */
  priorityReason: string | null;
  /**
   * THE CLIENT SAID SOMETHING WORTH A CONVERSATION — and the software did not act
   * on it. Present only when an answer makes removing this workflow reasonable;
   * null otherwise, and null whenever the row is locked (advice he cannot take).
   *
   * Render it as a note beside a switch that is still ON and still his to flip.
   * Rendering it as a warning, or auto-flipping anything from it, turns a hint
   * into the rule it was deliberately not made.
   */
  suggestion: string | null;
  /** The evidence, flattened for display. Strongest first. */
  justification: Array<{
    leakId: string;
    leakName: string;
    grade: EvidenceGrade;
    /** The measurement in our own words, or null when the only evidence on file
     *  is the client's own answer. */
    measured: string | null;
  }>;
}

export interface WorkflowTogglesResponse {
  businessId: string;
  /**
   * FALSE MEANS "WE HAVE NOT LOOKED", NOT "NOTHING WAS FOUND". With no stored
   * research snapshot there is nothing to run detection against, so no workflow
   * can be locked and every row below is defaults and rules only. The screen has
   * to say "run a scan first" — rendering an unlocked list as if it were a
   * considered result is how a panel starts lying.
   */
  scanned: boolean;
  /** When the research this was resolved against was captured. */
  researchAt: string | null;
  workflows: WorkflowToggleRow[];
  counts: { total: number; on: number; off: number; locked: number };
}

/** Flatten a resolution for the wire. */
export function toToggleRow(resolved: ResolvedWorkflow): WorkflowToggleRow {
  const { workflow } = resolved;
  const applicability = workflow.applicability;
  return {
    id: workflow.id,
    name: workflow.name,
    whatItDoes: workflow.whatItDoes,
    on: resolved.on,
    source: resolved.source,
    locked: resolved.locked,
    lockReason: resolved.lockReason ?? null,
    because: resolved.because,
    conditional: applicability.kind !== "every_build",
    operatorOffReason:
      applicability.kind === "every_build"
        ? applicability.operatorOffReason ?? null
        : applicability.offWhen,
    priority: resolved.priority,
    priorityReason: resolved.priorityReason,
    suggestion: resolved.suggestion,
    justification: resolved.justification.map((f) => ({
      leakId: f.leak.id,
      leakName: f.leak.name,
      grade: f.grade,
      measured: measurementLine(f),
    })),
  };
}

/** The whole payload, counts included so the screen never recounts and drifts. */
export function toTogglesResponse(args: {
  businessId: string;
  scanned: boolean;
  researchAt: string | null;
  resolved: readonly ResolvedWorkflow[];
}): WorkflowTogglesResponse {
  const workflows = args.resolved.map(toToggleRow);
  return {
    businessId: args.businessId,
    scanned: args.scanned,
    researchAt: args.researchAt,
    workflows,
    counts: {
      total: workflows.length,
      on: workflows.filter((w) => w.on).length,
      off: workflows.filter((w) => !w.on).length,
      locked: workflows.filter((w) => w.locked).length,
    },
  };
}
