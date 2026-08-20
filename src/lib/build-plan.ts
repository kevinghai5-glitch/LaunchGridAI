// The Build Plan, ASSEMBLED — what we install, what we don't, and when.
//
// The Blueprint and the Roadmap used to be two documents. They answered one
// question between them ("what are you actually building, and when is it live")
// and neither answered it on its own, so this merges them.
//
// PURE. No Prisma, no fetch, no React. Everything here is derived from the
// workflow catalogue, the five build decisions, and one nullable date.
//
// ── THE TWO RULES THAT SHAPE THIS FILE ──────────────────────────────────────
//
// 1 · NO SILENT OMISSION. Every one of the fourteen workflows appears in exactly
//     one of three lists, and the two that are not plainly "installed" each
//     carry a sentence saying why. A client who reads a list of what he got and
//     cannot tell whether something was left out — or worse, cannot tell that
//     anything WAS left out — has been given a document that invites the
//     question "did I get less than the next guy". When nothing is off, the plan
//     says so out loud rather than leaving the absence of a section to imply it.
//
// 2 · NO IMPLIED START DATE. kickoffAt is nullable, and a Build Plan generated
//     before payment genuinely has no engagement date. It is not invented and
//     the section is not hidden: the windows render RELATIVE to kickoff, with a
//     visible note that exact dates land once kickoff is booked. A document that
//     quietly implies a start date it does not have is the same class of error
//     as a fabricated finding.

import { WORKFLOWS, type WorkflowDefinition } from "./workflow-catalogue";
import { DECIDABLE_WORKFLOWS, OFF_WHEN, readDecisions } from "./build-decisions";

/** The three states a workflow can be in on a Build Plan. */
export type InstallState = "installed" | "pending" | "off";

/** The one workflow that cannot be confirmed from a form or a decision.
 *
 *  Webchat Capture needs a snippet placed on the client's own website. Whether
 *  that is possible depends on what their site is built on and who can edit it —
 *  discovered during the build, not before it. Reporting it as "installed" in a
 *  document written before anyone has touched the site would be a claim we have
 *  no basis for, so it renders as PENDING with the reason stated. */
export const PENDING_WORKFLOW_ID = "webchat-capture";

/** Calendar days from kickoff to go-live. The one number the whole schedule is
 *  built from — the same fourteen days quoted on the offer page. */
export const BUILD_DAYS = 14;

export interface BuildPlanItem {
  id: string;
  name: string;
  whatItDoes: string;
  whatTheClientSees: string;
  trigger: string;
  state: InstallState;
  /** Why it is pending or off, in one sentence. Present on every non-installed
   *  item and absent on installed ones — the type does not enforce that, so
   *  buildPlan() guarantees it and verify-build-plan asserts it. */
  note?: string;
}

export interface BuildDates {
  /** A kickoff date is known, so real calendar dates are printed. */
  anchored: boolean;
  /** "12 August 2026", or "Kickoff" when there is no date yet. */
  kickoff: string;
  /** "12–26 August 2026", or "Days 1–14 from kickoff". */
  buildWindow: string;
  /** "26 August 2026", or "14 days after kickoff". */
  goLive: string;
  /** "From 26 August 2026", or "From go-live". */
  runningFrom: string;
  /** The visible caveat. EMPTY when anchored — a note that always shows is a
   *  note nobody reads. */
  note: string;
}

export interface BuildPlan {
  installed: BuildPlanItem[];
  pending: BuildPlanItem[];
  off: BuildPlanItem[];
  /** Fourteen. Stated rather than hardcoded in the copy. */
  totalWorkflows: number;
  /** Nothing was switched off for this client. Drives the "all fourteen are
   *  installed for you" line, which is said explicitly rather than implied by an
   *  empty section. */
  nothingOff: boolean;
  dates: BuildDates;
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** "August 12, 2026". Pinned locale and explicit parts so the rendered HTML is
 *  byte-identical wherever it is generated — a document that reads differently
 *  on a different machine is a document we cannot verify.
 *
 *  en-CA, matching the cover. It was en-GB, which was pinned but DISAGREED: the
 *  same Build Plan carried "August 13, 2026" on its cover and "1 September 2026"
 *  in its schedule. Being deterministic is not the same as being consistent. */
function longDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function buildDates(kickoffAt: Date | null | undefined): BuildDates {
  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) {
    // No engagement date. Say what is true — the shape of the schedule — and say
    // plainly that the dates themselves are not set yet.
    return {
      anchored: false,
      // "Day 1", not "Kickoff": this string is the WHEN column beside a row whose
      // title is already "Kickoff", and the two together read "Kickoff Kickoff".
      // Day 1 also matches the build window right below it ("Days 1–14").
      kickoff: "Day 1",
      buildWindow: `Days 1–${BUILD_DAYS} from kickoff`,
      goLive: `${BUILD_DAYS} days after kickoff`,
      runningFrom: "From go-live",
      note:
        "Kickoff is not booked yet, so this schedule is written relative to it rather than to calendar dates. " +
        "The build runs for two weeks from the day we start; exact dates land here once kickoff is booked.",
    };
  }
  const start = kickoffAt;
  const live = addDays(start, BUILD_DAYS);
  return {
    anchored: true,
    kickoff: longDate(start),
    buildWindow: `${longDate(start)} – ${longDate(live)}`,
    goLive: longDate(live),
    runningFrom: `From ${longDate(live)}`,
    note: "",
  };
}

// ── The plan ─────────────────────────────────────────────────────────────────

function toItem(w: WorkflowDefinition, state: InstallState, note?: string): BuildPlanItem {
  return {
    id: w.id,
    name: w.name,
    whatItDoes: w.whatItDoes,
    whatTheClientSees: w.whatTheClientSees,
    trigger: w.trigger,
    state,
    ...(note ? { note } : {}),
  };
}

export function buildPlan(
  workflowToggles: unknown,
  kickoffAt: Date | null | undefined
): BuildPlan {
  const decisions = readDecisions(workflowToggles);

  const installed: BuildPlanItem[] = [];
  const pending: BuildPlanItem[] = [];
  const off: BuildPlanItem[] = [];

  for (const w of WORKFLOWS) {
    const isDecidable = DECIDABLE_WORKFLOWS.some((d) => d.id === w.id);
    // Only the five carry a decision. A forged key for one of the nine cannot
    // reach here: readDecisions returns keys for the decidable set and nothing
    // else, so `decisions[w.id]` is undefined for the nine and never `false`.
    const switchedOff = isDecidable && decisions[w.id] === false;

    if (switchedOff) {
      // OFF_WHEN covers every decidable workflow (verify-intake-screen A5). The
      // fallback is unreachable today and exists so a workflow added tomorrow
      // without a reason still renders an honest sentence instead of a blank.
      off.push(toItem(w, "off", OFF_WHEN[w.id] ?? "Not needed for this build"));
      continue;
    }
    if (w.id === PENDING_WORKFLOW_ID) {
      pending.push(
        toItem(
          w,
          "pending",
          "This one needs a small snippet added to your website. Whether that is possible " +
            "depends on how your site is built, so we confirm it during the build rather than " +
            "promising it now."
        )
      );
      continue;
    }
    installed.push(toItem(w, "installed"));
  }

  return {
    installed,
    pending,
    off,
    totalWorkflows: WORKFLOWS.length,
    nothingOff: off.length === 0,
    dates: buildDates(kickoffAt),
  };
}
