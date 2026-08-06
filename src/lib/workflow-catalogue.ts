/**
 * ============================================================================
 * THE BUILD, AS DATA — the 14 GoHighLevel workflows + the one CRM pipeline
 * ============================================================================
 *
 * WHY THIS FILE EXISTS
 * The build Kevin sells is fourteen named workflows and a six-stage pipeline.
 * Until now that build lived as prose, retyped into a different generation
 * prompt every time it was needed — so the proposal, the Blueprint and the
 * roadmap could each describe a slightly different build, and nothing could
 * check them against each other. This file is the one place the build is
 * written down. Deliverables render from it, the operator's toggles resolve
 * against it, and the validator checks against it.
 *
 * EVERY STRING IN HERE IS ONE EDIT AWAY FROM A CLIENT'S EYES. It is held to the
 * same bar as generated copy: no lead-generation language (no ads, no search
 * ranking, no "more leads" — we fix conversion of demand that already exists),
 * no promises to build or rebuild a website (site findings are advisory; the
 * booking page inside GoHighLevel is the only page we build), owner vocabulary
 * (calls, jobs, booked work) rather than marketing vocabulary, and no hype. The
 * pack validator hard-fails all of those, so a sloppy sentence here becomes a
 * failed document later.
 *
 * ── THE RULE THAT SHAPES THE WHOLE TYPE ─────────────────────────────────────
 * A WORKFLOW IS INSTALLED ALWAYS; ITS LEAK IS ONLY SOMETIMES EVIDENCED.
 *
 * Kevin's ruling, on Review Response, applies to all fourteen:
 *
 *   "It's one of the 14 workflows I install in every build. low_review_velocity
 *    is supporting evidence when present, not a precondition — a client with
 *    great reviews still gets the reply workflow, because unanswered reviews
 *    look inattentive regardless of volume."
 *
 * So `justifyingLeaks` is the evidence a document may CITE for a workflow, never
 * the reason it exists. Three things in the type below make that structural
 * rather than a comment somebody can ignore:
 *
 *   1. `gatedOnALeak` is typed as the literal `false`, not `boolean`. "Yes, this
 *      one is gated" cannot be written down.
 *   2. `justifyingLeaks` is typed `SupportingLeakEvidence`. There is deliberately
 *      no `requiredLeaks` counterpart anywhere in this file.
 *   3. `resolveWorkflow()` — the ONLY function that answers "is this workflow in
 *      this client's build?" — takes the intake answers and the operator's
 *      overrides. It has no parameter that can carry a fired leak, so a future
 *      author cannot make installation depend on one without changing the
 *      signature and explaining why.
 *
 * One entry proves the rule on its own: "Appointment Cancelled — Stop Reminders"
 * has an EMPTY justifyingLeaks list and is still in every build. No leak in the
 * taxonomy fires for it, and it ships anyway, because a reminder for a visit the
 * customer already cancelled makes the whole build look broken.
 *
 * ── STABLE IDS ──────────────────────────────────────────────────────────────
 * `id` is written into Business.workflowToggles the moment an operator flips a
 * switch. Renaming one silently drops that client's decision and the workflow
 * reverts to its default. Ids are append-only: never rename, never reuse.
 * ==========================================================================*/

import type { ClientIntake } from "./leak-taxonomy";
import { LEAKS } from "./leak-taxonomy";

/* ============================================================================
 * SECTION 1 — THE CANONICAL PIPELINE
 * ==========================================================================*/

/**
 * The six stages of the CRM pipeline we configure inside the client's
 * GoHighLevel sub-account. THIS IS THE CANONICAL DEFINITION.
 *
 * FOUR OTHER STAGE LISTS EXIST IN THE REPO TODAY and none of them is this one.
 * They are written down here so the next person does not have to rediscover
 * them; nothing in this file edits them, and pointing them at this constant is a
 * later job:
 *
 *   · src/lib/asset-generation.ts:1201 — the Blueprint prompt orders EXACTLY 9
 *     pipeline stages (New Lead, Contact Attempted, Qualified, Consultation
 *     Booked, Consultation Completed, Proposal Sent, Won, Lost, Nurture). This is
 *     the one that reaches a client document.
 *   · src/lib/leak-taxonomy.ts:1319 — the no_crm_pipeline fix describes 5 stages
 *     (new → qualified → booked → showed → won). No Lost, so a lead that never
 *     books has nowhere to go.
 *   · src/lib/asset-generation.ts:1192 (+ the count assertion at 1222, and the
 *     validator's stages.length !== 6 check in
 *     src/lib/exporters/validate-pack.ts:386) — a DIFFERENT 6-stage list. That
 *     one is the conversion FUNNEL (Capture, Qualify, Speed-to-Lead, Nurture,
 *     Book, Show-Up), not the pipeline. Same count, different thing: worth
 *     knowing before someone "reconciles" the two and breaks both.
 *   · src/lib/crm.ts:40 — the 9-column board for Kevin's OWN prospects. Not the
 *     client's pipeline at all and correctly separate; listed so it is not
 *     mistaken for a fifth contradiction.
 *
 * Note the last stage. Workflow 8 (Lead Nurture — No Booking) ends by moving the
 * deal to Lost after 60 days, so a pipeline without Lost has nowhere to put the
 * leads that never booked, and the board slowly fills with dead names.
 */
export const PIPELINE_STAGES = [
  "New Lead",
  "Qualified",
  "Booked",
  "Showed",
  "Won",
  "Lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface PipelineStageDef {
  stage: PipelineStage;
  /** What this column means, in one sentence an owner reads without help. */
  whatItMeans: string;
  /** What puts a lead in this column. */
  howALeadArrives: string;
  /** What takes a lead out of it. */
  howALeadLeaves: string;
}

/** The same six stages with the wording a deliverable renders. */
export const PIPELINE: readonly PipelineStageDef[] = [
  {
    stage: "New Lead",
    whatItMeans: "Someone new has come in and nobody has spoken to them yet.",
    howALeadArrives:
      "Any first contact at all — a form, a call, a chat on the site, a message on Facebook or Instagram, a text to your number.",
    howALeadLeaves:
      "Somebody works out what they want and moves them on, or the follow-up sequence runs its course without them booking.",
  },
  {
    stage: "Qualified",
    whatItMeans:
      "You know what they want, roughly what it is worth, and that it is work you actually do.",
    howALeadArrives:
      "The qualifying questions come back with an answer worth your time, or you talk to them and decide it is worth pursuing.",
    howALeadLeaves: "They take a time on the calendar, or they go quiet and drop into follow-up.",
  },
  {
    stage: "Booked",
    whatItMeans: "There is a time on the calendar with their name against it.",
    howALeadArrives:
      "An appointment is confirmed — booked by them online, or put in by you or your team.",
    howALeadLeaves: "The appointment happens, or it does not.",
  },
  {
    stage: "Showed",
    whatItMeans: "They turned up, and the conversation about the job has happened.",
    howALeadArrives: "The appointment is marked as attended.",
    howALeadLeaves: "They go ahead, or they decide against it.",
  },
  {
    stage: "Won",
    whatItMeans: "The job is yours.",
    howALeadArrives: "They say yes — or a deposit lands, which says yes for them.",
    howALeadLeaves:
      "It does not. This is the end of the line, and reaching it is what asks the customer for a review.",
  },
  {
    stage: "Lost",
    whatItMeans: "It is not happening this time.",
    howALeadArrives:
      "They say no, they go elsewhere, or the 60-day follow-up sequence finishes without a booking and closes them out.",
    howALeadLeaves:
      "They come back in as a New Lead the day they get in touch again — nothing is deleted, the history stays with them.",
  },
];

/* ============================================================================
 * SECTION 2 — LEAK EVIDENCE (SUPPORTING, NEVER REQUIRED)
 * ==========================================================================*/

/**
 * Every in-scope leak id in src/lib/leak-taxonomy.ts, written out so the compiler
 * catches a typo in a `justifyingLeaks` list instead of a document shipping with
 * a citation that points at nothing.
 *
 * Out-of-scope leak ids are deliberately NOT here. A workflow can only ever
 * support something ReclaimedHQ actually fixes; citing a site-speed finding as
 * the justification for a workflow would be selling work we do not do.
 *
 * `verifyWorkflowCatalogue()` checks this list against the real taxonomy, so a
 * leak renamed or removed over there surfaces as a failed check rather than as a
 * dangling reference nobody notices.
 *
 * SOME IN-SCOPE LEAKS ARE DELIBERATELY CITED BY NO WORKFLOW, because what fixes
 * them is not a workflow. Do not add a fifteenth workflow to close the gap:
 *   · no_crm_pipeline — the pipeline itself, exported above as PIPELINE.
 *   · no_call_tracking — the tracked number and the monthly report. The taxonomy
 *     says so in as many words: "NOT ONE OF THE 14 SOLD WORKFLOWS."
 *   · weak_landing_cta — the GoHighLevel booking page we build, plus written
 *     recommendations for their own site. We do not touch their website.
 *   · no_online_booking — the calendar and the booking page. Workflow 4 rides on
 *     it and cites it, but the calendar is not itself a workflow.
 */
export type TaxonomyLeakId =
  | "slow_speed_to_lead"
  | "missed_calls_no_recovery"
  | "no_after_hours_coverage"
  | "no_online_booking"
  | "no_webchat"
  | "no_lead_qualification"
  | "weak_landing_cta"
  | "no_follow_up_sequence"
  | "no_show_exposure"
  | "no_crm_pipeline"
  | "no_database_reactivation"
  | "no_long_cycle_nurture"
  | "low_review_velocity"
  | "no_review_replies"
  | "social_dm_unmanaged"
  | "no_call_tracking"
  | "payment_booking_friction";

/**
 * Leaks a document may CITE when it explains why a workflow is in the build.
 *
 * The name is the point. This list is evidence, and evidence is optional: an
 * empty list means "no leak in the taxonomy speaks to this one", which is a
 * perfectly ordinary state for a workflow that ships in every build regardless.
 * There is no `RequiredLeaks` type in this file and there must never be one — the
 * moment a workflow's existence depends on a detector firing, a client whose scan
 * came back thin silently loses part of the build they paid for.
 */
export type SupportingLeakEvidence = readonly TaxonomyLeakId[];

/* ============================================================================
 * SECTION 3 — APPLICABILITY
 * ==========================================================================*/

/**
 * How it is decided whether this workflow is in a particular client's build.
 *
 * Note what is NOT in this union: any variant that reads a fired leak. That is
 * the point of the whole file. The three legitimate reasons a workflow is left
 * out are all facts about the client's business or the operator's judgement —
 * never "the detector didn't fire".
 */
export type WorkflowApplicability =
  | {
      /** In every build. Ten of the fourteen are this. */
      kind: "every_build";
      /**
       * The one legitimate reason an operator switches this off by hand at
       * install time, where such a reason exists. This is NOT a rule — nothing
       * evaluates it — it is the note that stops the operator wondering whether
       * he is allowed to.
       */
      operatorOffReason?: string;
    }
  | {
      /** Decided by an answer on the intake form we actually store. */
      kind: "intake_rule";
      /** Typed as a key of ClientIntake, so a renamed column breaks the build
       *  here instead of quietly making the rule un-evaluable. */
      field: keyof ClientIntake;
      /** The question, verbatim from the shipped intake form. The operator has
       *  to be able to read this and ask it word for word. */
      question: string;
      /** The answer that takes the workflow out, in plain words. */
      offWhen: string;
      /** The same rule, executable. Takes the intake answers and NOTHING else —
       *  no leaks, no scrape data, no scores. */
      isOff: (intake: ClientIntake) => boolean;
    }
  | {
      /**
       * The software must not decide this one. Only the operator can switch it
       * off — either because no column on the form carries the fact, or because
       * the form DOES ask and the answer deliberately must not flip the state.
       */
      kind: "operator_only";
      /** The fact that takes the workflow out, in plain words. */
      offWhen: string;
      /**
       * Ready to paste onto the intake form — present only while the question is
       * genuinely missing.
       *
       * ABSENT IS NOW A SECOND, DIFFERENT STATE, so it is spelled out: the form
       * asks the question, and the answer STILL does not flip the workflow. That is
       * not an oversight and it is not a rule half-written; it is a decision, and
       * the workflow carries an `offSuggestion` instead. Review Response is the
       * case — "I write my own replies" is a real answer that makes removal
       * reasonable, and it is the operator's call to make with the client, not the
       * software's to make on his behalf.
       */
      missingIntakeQuestion?: string;
    };

/* ============================================================================
 * SECTION 3b — TWO SIGNALS THAT ARE NOT APPLICABILITY
 * ==========================================================================
 * Both of these read intake answers, and NEITHER may ever change whether a
 * workflow is in the build. That is the whole reason they are separate types with
 * separate functions rather than extra branches of the union above: the union is
 * the on/off decision, and anything that lands in it decides what a client gets.
 * `resolveWorkflow` does not look at either of them.
 * ==========================================================================*/

/**
 * HOW HARD THIS ONE MATTERS FOR THIS CLIENT — ordering and emphasis, never
 * inclusion.
 *
 * It exists because of one specific pair of answers. A business that takes
 * deposits and has NO online way to collect them is the single best Text-to-Pay
 * candidate there is: they are chasing e-transfers and cheques by hand today. But
 * "no online payment mechanism" (hasOnlinePayment) must never touch the on/off
 * rule — run it through applicability and that exact client, the one it helps
 * most, LOSES the workflow. So the signal is carried here instead, where the worst
 * it can do is move a line up a page.
 *
 * ONLY UPWARDS. `level` is the literal "high", not a scale: a rule that LOWERED
 * priority would be a rule that quietly de-emphasises work the client paid for,
 * and there is no client fact that justifies that.
 */
export type WorkflowPriority = "standard" | "high";

export interface WorkflowPriorityRule {
  /** The only level a rule may set. See ONLY UPWARDS above. */
  level: "high";
  /** Operator-facing wording naming the two answers that raised it. */
  because: string;
  /** Executable. Takes the intake answers and NOTHING else — no leaks, no scores,
   *  and nothing it returns can reach `resolveWorkflow`. */
  when: (intake: ClientIntake) => boolean;
}

/**
 * A REASON TO CONSIDER REMOVING THIS ONE BY HAND — a hint on the panel, never a
 * state change.
 *
 * The distinction is the point, and it is worth stating plainly because the
 * shortcut is so tempting: an `intake_rule` says "this answer takes the workflow
 * out" and the software acts on it. A suggestion says "this answer is worth a
 * conversation" and the software does nothing at all. Review Response is why the
 * type exists: an owner who writes his own review replies is the only client for
 * whom removing it is reasonable — and he still benefits from a draft waiting for
 * him the same day, so the software has no business deciding that for him. Faking
 * it with a rule would silently strip a workflow from the build of every proud
 * owner who answered honestly.
 */
export interface WorkflowOffSuggestion {
  /** The intake answer that raises the hint. Typed as a key of ClientIntake, so a
   *  renamed column breaks the build here instead of leaving a dead hint. */
  field: keyof ClientIntake;
  /** The question, verbatim from the shipped intake form. */
  question: string;
  /** Operator-facing wording: what the client said, what it would mean to act on
   *  it, and — because a hint with no counter-argument is just a nudge to delete
   *  things — what he still gets if it stays in. */
  hint: string;
  /** Executable. Reads intake and nothing else, and its result reaches the screen
   *  only as text: no caller may use it to switch a workflow off. */
  when: (intake: ClientIntake) => boolean;
}

/* ============================================================================
 * SECTION 4 — THE WORKFLOW DEFINITION
 * ==========================================================================*/

export interface WorkflowDefinition {
  /**
   * Stable slug. Written into Business.workflowToggles when the operator makes a
   * decision, so renaming one throws that decision away. Append-only.
   */
  id: string;

  /** The name Kevin and the client both use for it. Verbatim from the build. */
  name: string;

  /** One or two sentences an owner understands with no explanation. No product
   *  menu names, no automation jargon. */
  whatItDoes: string;

  /** What fires it, in owner language — "a form is submitted", "a call rings out
   *  unanswered". Not an event name. */
  trigger: string;

  /**
   * The visible artifact: the message that goes out, the notification that
   * arrives, the calendar invite that lands. This is the field that makes the
   * build feel like a real thing in a document rather than a list of features,
   * so it is written as what a person actually receives.
   */
  whatTheClientSees: string;

  /**
   * Leak ids this workflow answers, for a document that wants to point at the
   * evidence. SUPPORTING, NEVER REQUIRED — see SupportingLeakEvidence. An empty
   * list is a normal, correct value.
   */
  justifyingLeaks: SupportingLeakEvidence;

  /**
   * Typed as the literal `false`, not `boolean`, on purpose. A workflow is never
   * gated on a leak firing, so "yes it is" is not a state the type system will
   * let anyone write. If a future author genuinely needs leak-gated behaviour,
   * they have to widen this type and answer for it — which is exactly the
   * conversation that should happen before a client loses a workflow because a
   * cold scan came back thin.
   */
  readonly gatedOnALeak: false;

  /** How inclusion is decided for a given client. */
  applicability: WorkflowApplicability;

  /**
   * Raises this workflow to HIGH priority for a client whose answers say it is
   * unusually valuable to them. Ordering and emphasis only — see
   * WorkflowPriorityRule. Absent on thirteen of the fourteen, which is the normal
   * state: everything in the build matters, and marking everything urgent marks
   * nothing urgent.
   */
  priorityRule?: WorkflowPriorityRule;

  /**
   * An answer worth surfacing as "you may want to take this one out by hand".
   * A HINT, NEVER A RULE — nothing evaluates it into an on/off decision. See
   * WorkflowOffSuggestion.
   */
  offSuggestion?: WorkflowOffSuggestion;

  /**
   * Is this workflow in the build with nothing checked at all?
   *
   *   true  — the ten that are simply part of every build, unconditionally.
   *   false — the four that are CONDITIONAL: a fact about the client decides.
   *
   * READ THIS BEFORE USING THE FLAG. `false` does not mean "left out". All four
   * conditional rules are OFF-SWITCHES: the answer that removes the workflow is
   * named in `applicability.offWhen`, and every other answer — including "we
   * never asked" — leaves it in. `false` means "do not treat this one as
   * automatic; the rule decides." `resolveWorkflow()` is the answer, always;
   * this flag exists so the toggles screen can show which four carry a rule at
   * all, and it is deliberately not the thing a deliverable reads.
   */
  defaultOn: boolean;
}

/* ============================================================================
 * SECTION 5 — THE FOURTEEN
 * ==========================================================================*/

export const WORKFLOWS: readonly WorkflowDefinition[] = [
  // 1 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. slow_speed_to_lead is suppressed when
  // the client answers "under 5 minutes" — and the workflow still ships. A person
  // replying in five minutes is a person who is free; the same person on a roof,
  // in a chair or in court is not. The workflow is what makes the five minutes
  // survive a busy Tuesday.
  {
    id: "instant-lead-response",
    name: "Instant Lead Response",
    whatItDoes:
      "Every new enquiry gets an answer inside about a minute, day or night, without anyone having to notice it came in. The reply comes from your business number and your email address, and it carries a link to book.",
    trigger: "A form is submitted — on your website, on your booking page, or anywhere else the form is placed.",
    whatTheClientSees:
      "A text and a matching email within about a minute: \"Thanks for getting in touch with [Business] — we have your details and someone is on it. Want to lock in a time now? [booking link]\". The enquiry appears in your pipeline at New Lead with the time it arrived.",
    justifyingLeaks: ["slow_speed_to_lead"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 2 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. missed_calls_no_recovery is suppressed
  // when the client says missed callers already get an instant text back. The
  // workflow still ships, because the build moves every call onto one tracked
  // number and the text-back has to exist on THAT number — otherwise the recovery
  // they already had stops working the day we go live.
  {
    id: "missed-call-text-back",
    name: "Missed Call Text-Back",
    whatItDoes:
      "When a call rings out or drops into voicemail, the caller gets a text straight back instead of silence. Most people answer a text, so the conversation carries on from there rather than moving to the next business on their list.",
    trigger: "A call to your business number rings out unanswered, or lands in voicemail.",
    whatTheClientSees:
      "The caller gets: \"Sorry we missed you — this is [Business]. Tell us what you need and we will sort it, or grab a time here: [booking link]\". You get a note of who called with their number, and they land in your pipeline at New Lead.",
    justifyingLeaks: ["missed_calls_no_recovery"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 3 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. no_after_hours_coverage is suppressed
  // when they already send an automated reply after hours. The workflow still
  // ships: the build owns the number, the calendar and the inbox, so the
  // after-hours reply has to be wired into the system that now answers the phone.
  {
    id: "after-hours-auto-reply",
    name: "After-Hours Auto-Reply",
    whatItDoes:
      "Calls and messages that arrive when you are closed get an answer instead of a closed door. The reply says when you open, takes their details, and offers them a time on the calendar while they are still thinking about it.",
    trigger: "A call or a message arrives outside your opening hours — an evening, a weekend, a holiday.",
    whatTheClientSees:
      "\"Thanks for reaching [Business] — we are closed right now and open again at [time]. Leave us the details and we will call first thing, or book yourself in here: [booking link]\". Anything that reads as urgent is flagged to you rather than held until morning.",
    justifyingLeaks: ["no_after_hours_coverage"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 4 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. no_show_exposure is suppressed when
  // they say they already have reminders. The workflow still ships, and this is
  // the clearest case of the pattern in the whole build: the booking calendar we
  // stand up is a NEW calendar, and a booking made on it that sends no
  // confirmation is worse than no online booking at all.
  {
    id: "booking-confirmation-reminders",
    name: "Booking Confirmation + Reminders",
    whatItDoes:
      "Every booking is confirmed the moment it is made, then reminded before it happens. The customer knows where to be and when, and you stop losing slots to people who simply forgot.",
    trigger: "An appointment is booked — by the customer online, or by you or your team.",
    whatTheClientSees:
      "A confirmation text and email with the date, time and address plus a calendar invite, then a reminder a day out and another two hours out. Each one carries a link to move the appointment, so a clash becomes a reschedule instead of an empty slot.",
    justifyingLeaks: ["no_show_exposure", "no_online_booking"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 5 ──────────────────────────────────────────────────────────────────────────
  // THE PROOF OF THE RULE. justifyingLeaks is EMPTY: no leak in the taxonomy
  // fires for it, no detector can see it, no client ever asks for it by name —
  // and it is in every build, because it is what stops the reminder system
  // embarrassing the client. A reminder for a visit the customer cancelled two
  // days ago undoes the trust the other thirteen workflows just built. If
  // installation were gated on evidence, this one would never ship at all.
  {
    id: "appointment-cancelled-stop-reminders",
    name: "Appointment Cancelled — Stop Reminders",
    whatItDoes:
      "The moment an appointment is cancelled or moved, the reminders for the old slot stop. Nobody gets a cheerful reminder for a visit they already cancelled.",
    trigger: "An appointment is cancelled or rescheduled, by the customer or by you.",
    whatTheClientSees:
      "Silence about the old slot — that is the whole job. What they do get is one short note confirming the cancellation with a link to pick a new time, and if they rebook, the reminders start again against the new appointment.",
    justifyingLeaks: [],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 6 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. Shares no_show_exposure with workflow
  // 4, so a client who already runs reminders suppresses that leak and still gets
  // this one — reminders stop some no-shows, nothing recovers the rest.
  {
    id: "no-show-recovery",
    name: "No-Show Recovery",
    whatItDoes:
      "When somebody does not turn up, they hear from you within the hour with an easy way to rebook, rather than the slot quietly becoming a write-off.",
    trigger: "A booked appointment is marked as a no-show.",
    whatTheClientSees:
      "\"We had you down for [time] today and missed you — no problem at all. Pick a new time here: [booking link]\". One more nudge follows the next day if nothing comes back, and then they move into the follow-up sequence rather than being dropped.",
    justifyingLeaks: ["no_show_exposure"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 7 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES — the sibling of Kevin's own ruling on
  // Review Response. low_review_velocity only fires when their review count sits
  // behind the local competitor median. A client already ahead of that median
  // still gets the ask after every job: staying ahead is why they are ahead.
  {
    id: "review-request",
    name: "Review Request",
    whatItDoes:
      "Every finished job asks the customer for a Google review at the moment they are happiest with you, without anyone having to remember to do it.",
    trigger: "A job is marked complete — the deal reaches Won in your pipeline.",
    whatTheClientSees:
      "\"Thanks for having us out, [name]. If we did right by you, a quick review helps us more than you would think: [review link]\". One polite reminder follows if nothing happens, and then it stops asking.",
    justifyingLeaks: ["low_review_velocity"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 8 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. no_follow_up_sequence is suppressed
  // when the client ticks "automated follow-up" on the intake checklist. The
  // workflow still ships: the leads it chases are the ones the new build captured,
  // and a sequence that lives in their old tool cannot see them. It is also the
  // only workflow that CLOSES leads — it ends by moving the deal to Lost, which is
  // what keeps the pipeline honest instead of full of names nobody will call.
  {
    id: "lead-nurture-no-booking",
    name: "Lead Nurture — No Booking",
    whatItDoes:
      "A lead who never booked keeps hearing from you for 60 days — a handful of texts and emails spread out, not a barrage. If they book or reply it stops on its own; if the 60 days run out, the deal moves to Lost so your pipeline shows what is real.",
    trigger: "A new lead passes a set number of days without booking anything.",
    whatTheClientSees:
      "A short run of texts and emails over 60 days — a nudge, a reminder of what you do, a straight \"do you still want that quote?\" — each with a booking link, each stopping the moment they reply or book.",
    justifyingLeaks: ["no_follow_up_sequence", "no_long_cycle_nurture"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 9 ──────────────────────────────────────────────────────────────────────────
  // INSTALLED ALWAYS, EVIDENCED SOMETIMES. no_lead_qualification is a LeadGate
  // leak and does not fire for every client, but the notification is what makes
  // the qualifying worth anything: a score nobody sees at the moment it is
  // calculated is a report, not a system. It ships whether or not the leak fired.
  {
    id: "owner-hot-lead-notification",
    name: "Owner Hot-Lead Notification",
    whatItDoes:
      "The enquiries worth dropping everything for reach you the second they land, separately from everything else, so a big job never sits in the queue behind ten small ones.",
    trigger:
      "A new enquiry scores as high intent — the job type, the urgency or the size crosses the line you set with us.",
    whatTheClientSees:
      "A text and a phone notification: who it is, what they asked for, why it scored hot, and their number ready to tap and call. The lead sits at the top of your pipeline until somebody touches it.",
    justifyingLeaks: ["no_lead_qualification"],
    gatedOnALeak: false,
    applicability: { kind: "every_build" },
    defaultOn: true,
  },

  // 10 ─────────────────────────────────────────────────────────────────────────
  // THE ONE THAT IS GENUINELY UNDECIDED WHEN THE DOCUMENTS GO OUT. no_webchat is
  // suppressed when a chat widget is already on the site — and this one still
  // ships, because a chat that ends in somebody else's inbox does not create a
  // contact, does not text them back, and does not enter the pipeline.
  //
  // OPERATOR_ONLY, NOT EVERY_BUILD. Whether the chat box can be placed is
  // discovered during the build, days after the Build Plan is sent — no question
  // on the intake form could have told us, and no rule the software can evaluate
  // decides it. It used to sit in `every_build` with an operatorOffReason, which
  // made it look settled on a screen where it is not. It is one of the five real
  // decisions now, and the Build Plan says PENDING for it rather than claiming
  // either way.
  {
    id: "webchat-capture",
    name: "Webchat Capture",
    whatItDoes:
      "A visitor with a quick question can start a conversation from your website instead of leaving. The chat turns into a text thread on your business number, so it carries on after they close the tab.",
    trigger: "A visitor opens the chat box on your website and leaves a name and a number.",
    whatTheClientSees:
      "The visitor gets an answer in the chat straight away and then a text on their phone continuing the same conversation. You see one thread, not two, and they enter your pipeline at New Lead.",
    // weak_landing_cta is NOT cited here even though a chat box gives a dead page
    // something to do. That leak's fix is the booking page plus written advice on
    // their own site, and citing it against a workflow would invite a document to
    // read as though we are fixing their website. We are not.
    justifyingLeaks: ["no_webchat"],
    gatedOnALeak: false,
    applicability: {
      kind: "operator_only",
      offWhen:
        "The chat box cannot be placed on the site — no access to it, or a platform that will not take the snippet. That is found at install time, not on the intake form, so it is the operator's call rather than a rule the software can evaluate.",
      // No `missingIntakeQuestion`: the question is not missing, it is
      // unanswerable at intake. Nobody knows until the snippet is attempted.
    },
    // CONDITIONAL, NOT LEFT OUT — see the note on the flag. Webchat installs in
    // every build; `false` only marks that a decision hangs on it, which is what
    // lets the Build Plan print it as PENDING instead of claiming either way.
    defaultOn: false,
  },

  // 11 ─────────────────────────────────────────────────────────────────────────
  // CONDITIONAL, AND THE ONLY ANSWER THAT SWITCHES IT OFF IS "no accounts".
  // "No, not really" does NOT switch it off. The accounts exist, so we connect
  // them and the workflow sits quiet until a message arrives — dropping it would
  // leave that channel uncovered the first time one does. The leak and the build
  // read this same answer differently and always have; see the socialEnquiries
  // note in leak-taxonomy.ts.
  {
    id: "social-dm-capture",
    name: "Social DM Capture",
    whatItDoes:
      "Messages sent to your Facebook page or Instagram account land in the same place as your calls and forms, get the same quick first reply, and become contacts you can follow up like any other enquiry.",
    trigger: "Somebody sends a message to your Facebook page or your Instagram account.",
    whatTheClientSees:
      "The sender gets a reply in the app within a minute with a link to book, and you see their message alongside your texts and emails instead of in a separate phone app nobody opens between jobs.",
    justifyingLeaks: ["social_dm_unmanaged"],
    gatedOnALeak: false,
    applicability: {
      kind: "intake_rule",
      field: "socialEnquiries",
      question: "Do enquiries come in through Instagram or Facebook messages?",
      offWhen:
        "They told us they have no social accounts. There is nothing to connect, so the workflow is left out of the build.",
      // Strict equality against the one answer that means "no accounts". "NO"
      // means the accounts exist and are quiet — the workflow still installs.
      // An unanswered question leaves it in as well: never drop a paid-for
      // workflow because a question was skipped.
      isOff: (intake) => intake.socialEnquiries === "NO_ACCOUNTS",
    },
    defaultOn: false,
  },

  // 12 ─────────────────────────────────────────────────────────────────────────
  // CONDITIONAL, AND THE COLUMN NOW EXISTS. This used to be operator_only because
  // no question on the form carried the fact the rule needs — "is there ever a
  // moment in their day for a payment link to sit in?" — and the nearest column,
  // hasOnlinePayment, answers something else entirely. The form now asks it
  // directly ("Do you take a deposit or payment before the work is done?"), so the
  // rule is real and executable below.
  //
  // THE TRAP, AND IT IS THE REASON THIS COMMENT IS LONG. takesDeposits and
  // hasOnlinePayment read like the same question and run in OPPOSITE directions.
  // Somebody will eventually notice two payment-shaped columns and "tidy them up".
  //
  //   · takesDeposits  → is there a moment for the link? APPLICABILITY. NEVER
  //     ("we're paid at the time of service") is the ONLY answer that takes this
  //     workflow out of a build.
  //   · hasOnlinePayment → do they already have a mechanism? It has exactly ONE
  //     job — suppressing the payment_booking_friction LEAK — and it must never
  //     reach the on/off rule below.
  //
  // Merge them and the inversion is silent: a business that takes deposits with no
  // online way to collect them is chasing e-transfers and cheques by hand, which
  // makes it the BEST Text-to-Pay candidate in the book, not the worst. That client
  // would lose the workflow that helps him most. hasOnlinePayment is therefore read
  // ONLY by the priorityRule underneath, where the worst it can do is move this
  // workflow up the operator's list.
  {
    id: "text-to-pay",
    name: "Text-to-Pay",
    whatItDoes:
      "When a customer says yes, they get a link by text and pay while they still feel like saying yes. Paying holds the slot, and the receipt and the booking confirmation go out on their own.",
    trigger:
      "A lead is marked as agreed, or a booking needs a deposit before the slot is held.",
    whatTheClientSees:
      "A text with the amount and a link — card details on their phone, done in under a minute, receipt straight after. The deal moves to Won in your pipeline once the payment clears.",
    justifyingLeaks: ["payment_booking_friction"],
    gatedOnALeak: false,
    applicability: {
      kind: "intake_rule",
      field: "takesDeposits",
      question: "Do you take a deposit or payment before the work is done?",
      offWhen:
        "They told us they are paid at the time of service and never take a deposit. There is no moment in their day for a payment link to sit in, so the workflow is left out of the build.",
      // Strict equality against the ONE answer that means "never". "Sometimes" is
      // an install — an occasional deposit is still a deposit, and the link has to
      // exist on the day they want one. Undefined is an install too: an unasked
      // question must never remove a workflow the client is paying for.
      //
      // NOTE WHAT IS NOT IN THIS FUNCTION: hasOnlinePayment. It cannot appear here.
      // See the trap above.
      isOff: (intake) => intake.takesDeposits === "NEVER",
    },
    // PRIORITY IS NOT INCLUSION. This is where hasOnlinePayment is allowed to be
    // read, and the only thing it can do from here is push this workflow up the
    // operator's list for a client who is currently collecting deposits by hand.
    priorityRule: {
      level: "high",
      because:
        "They take deposits and have no online way to collect one — so today that money is chased by e-transfer, cheque or a phone call. This is the workflow with the most to give this client, and it is worth wiring first.",
      when: (intake) =>
        (intake.takesDeposits === "ALWAYS" || intake.takesDeposits === "SOMETIMES") &&
        intake.hasOnlinePayment === false,
    },
    defaultOn: false,
  },

  // 13 ─────────────────────────────────────────────────────────────────────────
  // CONDITIONAL ON THE LIST EXISTING, which is a different question from whether
  // the list has gone cold. hasPastCustomerDatabase answers "is there a list?" —
  // the applicability fact, and the one this rule reads. pastCustomerContact
  // answers "is it dormant?" — the leak. Both questions are on the form and both
  // are kept; see the note on pastCustomerContact in leak-taxonomy.ts.
  {
    id: "database-reactivation",
    name: "Database Reactivation",
    whatItDoes:
      "Your past customers and old quotes hear from you again — a short, polite campaign that brings some of them back for work they were already going to need.",
    trigger:
      "You hand the list over once and we send it in batches, then it runs again on whatever rhythm you agree — usually seasonal.",
    whatTheClientSees:
      "\"Hi [name], it is [Business]. It has been a while since we [job] for you. If you are about due, here is a time: [booking link]\", with a one-tap way to hear nothing further. Anyone who replies lands in your pipeline as a new lead.",
    justifyingLeaks: ["no_database_reactivation"],
    gatedOnALeak: false,
    applicability: {
      kind: "intake_rule",
      field: "hasPastCustomerDatabase",
      question: "Systems they already have — Past-customer list",
      offWhen:
        "They told us there is no past-customer list. There is nobody to send to, so the campaign is left out of the build.",
      // Strict === false, not a falsy check. Undefined means the question was
      // never asked, and an unasked question must never remove a workflow the
      // client is paying for — only an explicit "no, there is no list" does.
      isOff: (intake) => intake.hasPastCustomerDatabase === false,
    },
    defaultOn: false,
  },

  // 14 ─────────────────────────────────────────────────────────────────────────
  // KEVIN'S OWN RULING, AND THE ONE THIS WHOLE FILE IS SHAPED AROUND:
  //   "It's one of the 14 workflows I install in every build. low_review_velocity
  //    is supporting evidence when present, not a precondition — a client with
  //    great reviews still gets the reply workflow, because unanswered reviews
  //    look inattentive regardless of volume."
  // The leak is cited when it fired and simply not mentioned when it did not.
  //
  // THE FORM NOW ASKS THE QUESTION, AND IT STILL IS NOT A RULE. "Who replies to
  // your Google reviews right now?" is on the intake form, and "I do" is the only
  // answer that makes removing this workflow reasonable. It does NOT remove it. An
  // owner who writes his own replies still benefits from a draft sitting ready the
  // same day — the work is the writing, not the posting — so the answer is
  // surfaced to the operator as a SUGGESTION (`offSuggestion` below) and he takes
  // it out by hand if the client actually wants it out. Turning it into an
  // intake_rule would strip the workflow from the build of every proud owner who
  // answered the question honestly, which is the opposite of what the answer means.
  {
    id: "review-response",
    name: "Review Response",
    whatItDoes:
      "Every new Google review gets a reply, quickly and in your voice, whether it is five stars or one. Reviews sitting there unanswered read as inattentive to the next person deciding whether to call you.",
    trigger: "A new Google review is posted about your business.",
    whatTheClientSees:
      "A reply under each new review, usually the same day — warm and specific on a good one, calm and straight on a complaint — posted in your business name, with anything awkward run past you first.",
    // TWO LEAKS, TWO DIFFERENT CLAIMS, and both are evidence rather than a
    // precondition. low_review_velocity is about review VOLUME (measured against
    // the local competitor median). no_review_replies is about RESPONSIVENESS
    // (whether anybody answers), which nothing we fetch can see — it fires only
    // when the client has told us nobody does. A client can carry either, both, or
    // neither and still gets the workflow.
    justifyingLeaks: ["low_review_velocity", "no_review_replies"],
    gatedOnALeak: false,
    applicability: {
      kind: "operator_only",
      offWhen:
        "The owner writes their own review replies and wants to keep doing it. Nothing else takes this workflow out — a strong review profile is a reason to keep replying, not a reason to stop.",
      // No `missingIntakeQuestion`: the question is not missing any more. It is on
      // the form, and the answer is deliberately a suggestion rather than a rule.
    },
    offSuggestion: {
      field: "reviewReplyOwner",
      question: "Who replies to your Google reviews right now?",
      hint:
        "They told us the owner writes the replies himself. That is the one answer that makes taking this out reasonable — so it is your call, not the software's. Worth asking before you do: the workflow drafts each reply in his voice within the day and holds anything awkward for him to approve, so what he gives up is the writing, not the say-so. If he wants it out, switch it off here.",
      when: (intake) => intake.reviewReplyOwner === "OWNER",
    },
    defaultOn: false,
  },
];

/* ============================================================================
 * SECTION 6 — LOOKUP + RESOLUTION
 * ==========================================================================*/

const WORKFLOW_BY_ID = new Map<string, WorkflowDefinition>(WORKFLOWS.map((w) => [w.id, w]));

/** One workflow by its stable id, or undefined if the id is unknown (a toggle
 *  saved against a workflow that has since been removed). */
export function workflowById(id: string): WorkflowDefinition | undefined {
  return WORKFLOW_BY_ID.get(id);
}

/** The operator's explicit decisions, exactly as stored in
 *  Business.workflowToggles: { [workflowId]: boolean }. An absent key means "no
 *  opinion, use the rule", which is the state almost every workflow stays in. */
export type WorkflowToggles = Record<string, boolean>;

export interface WorkflowResolution {
  workflow: WorkflowDefinition;
  /** Is it in this client's build? */
  on: boolean;
  /** Why, in one line an operator can read off the screen. */
  because: string;
  /** True when the operator overrode the rule, so a screen can show it as a
   *  deliberate decision rather than a default. */
  overridden: boolean;
}

/**
 * Is this workflow in this client's build?
 *
 * LOOK AT WHAT THIS FUNCTION CANNOT SEE. There is no parameter for fired leaks,
 * no scrape data, no scores. That is deliberate and it is the enforcement of the
 * rule at the top of this file: installation cannot depend on a leak, because
 * nothing here knows about leaks.
 *
 * The order is: the operator's decision wins, then the applicability rule, and in
 * the absence of both the workflow is IN. Everything ReclaimedHQ sells is in the
 * build unless something specific takes it out — an unanswered intake question
 * never does.
 */
export function resolveWorkflow(
  workflow: WorkflowDefinition,
  intake?: ClientIntake | null,
  toggles?: WorkflowToggles | null
): WorkflowResolution {
  const override = toggles?.[workflow.id];
  if (typeof override === "boolean") {
    return {
      workflow,
      on: override,
      because: override
        ? "You switched this on for this client."
        : "You switched this off for this client.",
      overridden: true,
    };
  }

  const rule = workflow.applicability;

  if (rule.kind === "intake_rule") {
    // The rule is only evaluated against answers we actually have. With no
    // intake at all — a pre-sale document, a client who has not filled the form
    // in yet — the workflow stays in the build, because leaving it out would
    // understate what they are buying.
    if (intake && rule.isOff(intake)) {
      return { workflow, on: false, because: rule.offWhen, overridden: false };
    }
    return {
      workflow,
      on: true,
      because: intake
        ? "Their answer does not take it out, so it is in the build."
        : "Nothing on file takes it out, so it is in the build.",
      overridden: false,
    };
  }

  if (rule.kind === "operator_only") {
    // Nothing on the form can answer this one, so the software does not try. It
    // stays in until the operator says otherwise — the same default as every
    // other workflow, and the reason the missing question is worth adding.
    return {
      workflow,
      on: true,
      because: "In the build. Switch it off by hand if: " + rule.offWhen,
      overridden: false,
    };
  }

  return { workflow, on: true, because: "In every build.", overridden: false };
}

/** Resolve all fourteen for one client, in catalogue order. */
export function resolveWorkflows(
  intake?: ClientIntake | null,
  toggles?: WorkflowToggles | null
): WorkflowResolution[] {
  return WORKFLOWS.map((w) => resolveWorkflow(w, intake, toggles));
}

/**
 * How hard this workflow matters for THIS client. Ordering and emphasis only.
 *
 * SEPARATE FUNCTION, SEPARATE RETURN TYPE, ON PURPOSE. It returns a level and a
 * sentence — never a boolean — so there is nothing here a caller could mistake for
 * an answer to "is it in the build?". `resolveWorkflow` above does not call it and
 * must not: the day priority can switch something off, a client silently stops
 * getting a workflow because he answered a question about something else.
 *
 * No rule, or no intake yet → "standard", which is what thirteen of the fourteen
 * are for almost every client. Standard is not "unimportant"; it is the norm.
 */
export function workflowPriority(
  workflow: WorkflowDefinition,
  intake?: ClientIntake | null
): { level: WorkflowPriority; because: string | null } {
  const rule = workflow.priorityRule;
  if (!rule || !intake || !rule.when(intake)) return { level: "standard", because: null };
  return { level: rule.level, because: rule.because };
}

/**
 * The hint for a workflow the client's own answer says is worth a conversation —
 * or null, which is the state of thirteen of the fourteen for every client.
 *
 * IT RETURNS A SENTENCE. That is the entire safety property: a suggestion can be
 * shown to an operator and cannot be acted on by the software. If this ever starts
 * returning something an `if` can branch on, it has become a rule, and the reason
 * it is not one (see WorkflowOffSuggestion) has to be answered again first.
 */
export function workflowOffSuggestion(
  workflow: WorkflowDefinition,
  intake?: ClientIntake | null
): string | null {
  const suggestion = workflow.offSuggestion;
  if (!suggestion || !intake || !suggestion.when(intake)) return null;
  return suggestion.hint;
}

/* ============================================================================
 * SECTION 7 — INTEGRITY CHECK
 * ==========================================================================*/

/**
 * Check the catalogue against the taxonomy and against its own rules.
 *
 * IT RETURNS PROBLEMS, IT DOES NOT THROW. This runs over static data that is
 * either right or wrong at the moment it is written, so the place to catch a
 * problem is a verification script or a test — not at import time in a live app,
 * where a single bad id would take a page down at the worst possible moment.
 *
 * Empty array = the catalogue is sound.
 */
export function verifyWorkflowCatalogue(): string[] {
  const problems: string[] = [];

  const taxonomyIds = new Set(LEAKS.map((l) => l.id));
  const inScopeIds = new Set(LEAKS.filter((l) => l.scope !== "out_of_scope").map((l) => l.id));

  // Every leak id the catalogue can name has to still exist in the taxonomy, and
  // has to still be something ReclaimedHQ fixes.
  const declared: TaxonomyLeakId[] = [
    "slow_speed_to_lead",
    "missed_calls_no_recovery",
    "no_after_hours_coverage",
    "no_online_booking",
    "no_webchat",
    "no_lead_qualification",
    "weak_landing_cta",
    "no_follow_up_sequence",
    "no_show_exposure",
    "no_crm_pipeline",
    "no_database_reactivation",
    "no_long_cycle_nurture",
    "low_review_velocity",
    "no_review_replies",
    "social_dm_unmanaged",
    "no_call_tracking",
    "payment_booking_friction",
  ];
  for (const id of declared) {
    if (!taxonomyIds.has(id))
      problems.push(`TaxonomyLeakId "${id}" is not a leak in leak-taxonomy.ts any more.`);
    else if (!inScopeIds.has(id))
      problems.push(`TaxonomyLeakId "${id}" is now out_of_scope — a workflow may not cite it.`);
  }
  for (const l of LEAKS) {
    if (l.scope === "out_of_scope") continue;
    if (!declared.includes(l.id as TaxonomyLeakId))
      problems.push(`Leak "${l.id}" is in-scope but missing from TaxonomyLeakId.`);
  }

  // Every justifying leak resolves to a real, in-scope leak.
  for (const w of WORKFLOWS) {
    for (const leakId of w.justifyingLeaks) {
      if (!inScopeIds.has(leakId))
        problems.push(`Workflow "${w.id}" cites leak "${leakId}", which is not an in-scope leak.`);
    }
  }

  // Fourteen workflows, unique ids.
  if (WORKFLOWS.length !== 14)
    problems.push(`Expected 14 workflows, found ${WORKFLOWS.length}.`);
  const seen = new Set<string>();
  for (const w of WORKFLOWS) {
    if (seen.has(w.id)) problems.push(`Duplicate workflow id "${w.id}".`);
    seen.add(w.id);
  }

  // Exactly FIVE carry a rule; the other nine are unconditional. If these two ever
  // disagree, a workflow is claiming to be conditional with no rule behind it (or
  // the reverse), and the intake screen would show the wrong thing.
  //
  // It was four until webchat-capture moved out of `every_build`. Whether the chat
  // snippet can be placed is discovered during the build, days after the Build
  // Plan is sent — so presenting it as settled was the one claim in that document
  // nobody could stand behind. It is a decision now, and the fifth switch.
  const conditional = WORKFLOWS.filter((w) => !w.defaultOn);
  if (conditional.length !== 5)
    problems.push(`Expected exactly 5 conditional workflows, found ${conditional.length}.`);
  for (const w of WORKFLOWS) {
    const hasRule = w.applicability.kind !== "every_build";
    if (hasRule === w.defaultOn)
      problems.push(
        `Workflow "${w.id}": defaultOn=${w.defaultOn} disagrees with applicability "${w.applicability.kind}".`
      );
  }

  // A SUGGESTION MUST NEVER BECOME A RULE. The two are one careless edit apart:
  // both read an intake answer, and only one of them may change what the client
  // gets. Two things are checked, both cheap and both real:
  //   · the hint has words in it — a suggestion the operator cannot read is a
  //     switch he will flip on a guess;
  //   · no workflow hints AND rules on the SAME field. That combination is the
  //     shape the mistake takes: somebody adds the rule "while they're in there",
  //     the hint stays, and the panel now explains a decision it did not make.
  // (Nothing else needs checking: resolveWorkflow cannot see offSuggestion at all,
  // so a suggestion has no path to the on/off answer by construction.)
  for (const w of WORKFLOWS) {
    const s = w.offSuggestion;
    if (!s) continue;
    if (!s.hint.trim())
      problems.push(`Workflow "${w.id}" carries an offSuggestion with no wording for the operator to read.`);
    if (w.applicability.kind === "intake_rule" && w.applicability.field === s.field)
      problems.push(
        `Workflow "${w.id}" has BOTH an applicability rule and a suggestion on "${String(s.field)}". One answer cannot both decide the build and merely hint at it — pick which one this field is.`
      );
  }

  // Six pipeline stages, ending at Lost — the stage workflow 8 needs somewhere to
  // put a lead that never booked.
  if (PIPELINE.length !== 6) problems.push(`Expected 6 pipeline stages, found ${PIPELINE.length}.`);
  if (PIPELINE.map((s) => s.stage).join(" → ") !== PIPELINE_STAGES.join(" → "))
    problems.push("PIPELINE and PIPELINE_STAGES describe different pipelines.");

  return problems;
}
