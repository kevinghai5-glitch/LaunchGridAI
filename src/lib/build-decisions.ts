// The five build decisions — the only workflow choices that exist.
//
// Nine of the fourteen workflows install in every build. They are not decisions,
// they have no switch, and they do not appear on the intake screen at all.
// Showing an operator nine switches he must never touch, each with a paragraph
// explaining why it always installs, is the problem this file exists to end.
//
// The five below are real: each one has a fact that takes it out, and that fact
// is either an intake answer or something discovered during the build. They are
// derived from the catalogue — `every_build` is silent, everything else is a
// decision — so adding or reclassifying a workflow there changes this list
// automatically and cannot leave the two out of step.

import { WORKFLOWS, type WorkflowDefinition } from "@/lib/workflow-catalogue";

/** The workflows that carry a genuine on/off choice. Nine `every_build`
 *  workflows are excluded by construction. */
export const DECIDABLE_WORKFLOWS: WorkflowDefinition[] = WORKFLOWS.filter(
  (w) => w.applicability.kind !== "every_build"
);

/** How many install with no decision to make. Printed on the screen as a single
 *  line, because the count is worth knowing and the list is not. */
export const ALWAYS_INSTALLED_COUNT = WORKFLOWS.length - DECIDABLE_WORKFLOWS.length;

export type BuildDecisions = Record<string, boolean>;

/** One line per decision: what it is, and the single fact that takes it out.
 *  Deliberately one sentence — the full description belongs in the client's
 *  Build Plan, not in an admin panel. */
export const OFF_WHEN: Record<string, string> = {
  "social-dm-capture": "No social accounts at all",
  "text-to-pay": "Paid at time of service, no deposits",
  "database-reactivation": "Never or rarely contact past customers",
  "review-response": "Owner writes his own replies",
  "webchat-capture": "Snippet can't be placed — decided at install",
};

/** Read the stored overrides, defaulting every decision ON.
 *
 *  Default-on is the rule: the build is the whole system unless a specific fact
 *  removes a piece. An absent key means "not yet decided", which for a client who
 *  is getting the standard build is the same as on. */
export function readDecisions(stored: unknown): BuildDecisions {
  const raw = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const out: BuildDecisions = {};
  for (const w of DECIDABLE_WORKFLOWS) {
    out[w.id] = typeof raw[w.id] === "boolean" ? (raw[w.id] as boolean) : true;
  }
  return out;
}

/** What the intake answers imply, for the four decisions a form can speak to.
 *
 *  A SUGGESTION, NOT A SETTING. These pre-set the switches so the operator is
 *  confirming rather than typing, and he can override any of them — the fact
 *  that "they said no social accounts" is a strong signal, not a decision the
 *  software gets to make on his behalf. Webchat is absent on purpose: nothing on
 *  an intake form can answer it.
 */
export interface IntakeSignals {
  socialEnquiries?: string | null;
  takesDeposits?: string | null;
  pastCustomerContact?: string | null;
  reviewReplyOwner?: string | null;
}

export function suggestedDecisions(intake: IntakeSignals): Partial<BuildDecisions> {
  const out: Partial<BuildDecisions> = {};
  if (intake.socialEnquiries === "NO_ACCOUNTS") out["social-dm-capture"] = false;
  if (intake.takesDeposits === "NEVER") out["text-to-pay"] = false;
  if (intake.pastCustomerContact === "NEVER") out["database-reactivation"] = false;
  if (intake.reviewReplyOwner === "OWNER") out["review-response"] = false;
  return out;
}
