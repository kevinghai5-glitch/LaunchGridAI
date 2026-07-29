// Shared intake vocabularies — mirror the ReclaimedHQ client intake form verbatim.
// Imported by BOTH the Library intake UI and the generation route so the slugs,
// labels, and option order can never drift between capture and consumption.

export type BookingMethod = "PHONE_EMAIL_ONLY" | "BOOKING_TOOL" | "OTHER";
export const BOOKING_METHOD_OPTIONS: { value: BookingMethod; label: string }[] = [
  { value: "PHONE_EMAIL_ONLY", label: "Phone/Email only" },
  { value: "BOOKING_TOOL", label: "A booking tool" },
  { value: "OTHER", label: "Other" },
];

export type GbpManagement = "SELF" | "NOT_SELF" | "SOMEONE_ELSE" | "NOT_SURE";
export const GBP_MANAGEMENT_OPTIONS: { value: GbpManagement; label: string }[] = [
  { value: "SELF", label: "Yes" },
  { value: "NOT_SELF", label: "No" },
  { value: "SOMEONE_ELSE", label: "Someone else does" },
  { value: "NOT_SURE", label: "Not sure" },
];

// ── How enquiries are actually handled today ────────────────────────────────
// Three questions the detectors could previously only guess at. Each vocabulary
// has ONE "handled" answer that takes its leak off the list entirely, one or more
// answers that CONFIRM the gap (so the deliverable stops hedging about whether it
// exists), and a "not sure / we don't track it" answer that leaves today's
// benchmark hedge exactly as it is. Which slug does which lives in the detectors
// (leak-detection.ts) — this file only owns the words the operator sees.

export type AfterHoursHandling =
  | "AUTO_RESPONSE"
  | "NEXT_MORNING"
  | "NOTHING"
  | "UNKNOWN";
export const AFTER_HOURS_HANDLING_OPTIONS: { value: AfterHoursHandling; label: string }[] = [
  { value: "AUTO_RESPONSE", label: "They get an automated response" },
  { value: "NEXT_MORNING", label: "Someone gets back to them next morning" },
  { value: "NOTHING", label: "Nothing until someone checks" },
  { value: "UNKNOWN", label: "Not sure" },
];

export type MissedCallHandling =
  | "INSTANT_TEXT_BACK"
  | "CALL_BACK_WHEN_FREE"
  | "VOICEMAIL_ONLY"
  | "UNKNOWN";
export const MISSED_CALL_HANDLING_OPTIONS: { value: MissedCallHandling; label: string }[] = [
  { value: "INSTANT_TEXT_BACK", label: "They get an instant text back" },
  { value: "CALL_BACK_WHEN_FREE", label: "We call back when we're free" },
  { value: "VOICEMAIL_ONLY", label: "Voicemail only" },
  { value: "UNKNOWN", label: "Not sure" },
];

export type ResponseSpeed =
  | "UNDER_5_MIN"
  | "FEW_HOURS"
  | "DAY_OR_TWO"
  | "NOT_TRACKED";
export const RESPONSE_SPEED_OPTIONS: { value: ResponseSpeed; label: string }[] = [
  { value: "UNDER_5_MIN", label: "Under 5 minutes" },
  { value: "FEW_HOURS", label: "A few hours" },
  { value: "DAY_OR_TWO", label: "A day or two" },
  { value: "NOT_TRACKED", label: "We don't track it" },
];

// ── The two questions that close the last STRUCTURAL evidence gaps ──────────
// A "structural" gap was a leak that could NEVER stop being a guess, because no
// question on the form could confirm it — so the deliverable hedged it forever
// no matter how thorough the kickoff call was. These two close the last of them.

// Q "Do enquiries come in through Instagram or Facebook messages?"
//
// TWO CONSUMERS, and they are NOT the same question — read this before changing
// anything here, because another part of the build depends on the distinction:
//
//   1. THE LEAK (social_dm_unmanaged). "YES" means enquiries really do arrive as
//      DMs and nothing catches them, so the leak fires CONFIRMED (declarative,
//      attributed to them). "NO" and "NO_ACCOUNTS" BOTH take the leak off the
//      report — there is no leak in a channel that brings no enquiries.
//
//   2. THE BUILD (the Social DM Capture workflow). ONLY "NO_ACCOUNTS" switches
//      that workflow off: no accounts, nothing to connect. "NO" does NOT switch
//      it off — they have the accounts, so the capture workflow still gets
//      installed and simply sits quiet until a DM arrives.
//
// So the two answers that behave identically for the leak behave DIFFERENTLY for
// the build. Collapsing them into one option would silently drop a workflow from
// the builds of every client who just doesn't get many DMs today.
export type SocialEnquiries = "YES" | "NO" | "NO_ACCOUNTS";
export const SOCIAL_ENQUIRIES_OPTIONS: { value: SocialEnquiries; label: string }[] = [
  { value: "YES", label: "Yes, we get enquiries there" },
  { value: "NO", label: "No, not really" },
  { value: "NO_ACCOUNTS", label: "We don't have social accounts" },
];

// Q "When did you last contact past customers or old quotes?"
//
// WHY THIS EXISTS ALONGSIDE the "Past-customer list" yes/no, which we KEEP. The
// two answer different questions and only one of them can speak to the leak:
//   · hasPastCustomerDatabase → "is there a list?" That is the APPLICABILITY
//     fact for the Database Reactivation workflow, and as a leak question it
//     could only ever SUPPRESS: "no list" takes the leak off the report, and
//     "yes, a list" is exactly what makes it fire. It could never confirm the
//     claim the leak actually makes.
//   · pastCustomerContact → "is that list going cold?" That IS the claim. Only
//     "Within the last month, systematically" means it is being worked; the
//     other three confirm it is dormant.
export type PastCustomerContact = "SYSTEMATIC" | "OCCASIONAL" | "OVER_A_YEAR" | "NEVER";
export const PAST_CUSTOMER_CONTACT_OPTIONS: { value: PastCustomerContact; label: string }[] = [
  { value: "SYSTEMATIC", label: "Within the last month, systematically" },
  { value: "OCCASIONAL", label: "Occasionally, when we remember" },
  { value: "OVER_A_YEAR", label: "Over a year ago" },
  { value: "NEVER", label: "Never" },
];

// ── The two questions that decide what gets BUILT, not what a document says ──
// Every vocabulary above answers a question about a LEAK: does the gap exist, and
// may we state it as fact. These two answer a question about the BUILD: is this
// workflow in this client's fourteen at all. That is a different job with a
// different failure mode — get a leak wrong and a paragraph hedges when it
// shouldn't; get one of these wrong and a client is quoted a workflow he cannot
// use, or loses one he is paying for.

// Q "Do you take a deposit or payment before the work is done?"
//
// DO NOT MERGE THIS WITH hasOnlinePayment ("Can a customer pay or leave a deposit
// online today?"). They read like the same question and they run in OPPOSITE
// directions, so collapsing them is not a tidy-up — it is a silent inversion:
//
//   · takesDeposits asks whether there is ever a MOMENT in their day for a payment
//     link to sit in. That is the applicability fact for the Text-to-Pay workflow,
//     and the ONLY answer that takes it out of the build is NEVER — paid in person
//     when the work is done, so there is no "yes" to convert while it is hot.
//   · hasOnlinePayment asks whether they already have a MECHANISM. It does exactly
//     one job: suppressing the payment_booking_friction leak. It must never reach
//     the on/off rule.
//
// The business that takes deposits and has NO online way to collect them is the
// BEST Text-to-Pay candidate in the book, not the worst: they are chasing
// e-transfers and cheques by hand today. Run those two answers through one column
// and that client's build loses the workflow that helps him most.
export type TakesDeposits = "ALWAYS" | "SOMETIMES" | "NEVER";
export const TAKES_DEPOSITS_OPTIONS: { value: TakesDeposits; label: string }[] = [
  { value: "ALWAYS", label: "Yes, always" },
  { value: "SOMETIMES", label: "Sometimes" },
  { value: "NEVER", label: "No, we're paid at the time of service" },
];

// Q "Who replies to your Google reviews right now?"
//
// DELIBERATELY A PROCESS QUESTION, NOT A PREFERENCE ONE, and the wording is the
// whole point. "Do you write your own review replies?" invites a SCOPE answer —
// an owner hears "do you want to keep this?" and says yes out of politeness or
// pride, and we drop a workflow he would have been glad of. "Who replies right
// now?" is a fact about how the business runs today, the same shape as every other
// question on this form ("what happens when you miss a call?"). A fact can be
// recorded; a preference has to be negotiated.
//
// It earns its keep twice, and the two uses do NOT behave the same way:
//   · NOBODY is itself a FINDING. It is the only thing that can ever establish
//     that reviews go unanswered — nothing we fetch from Google or DataForSEO
//     carries an owner-reply field, so the client telling us is the only evidence
//     that exists. It fires the review-response finding as DISCLOSED.
//   · OWNER is the only answer that makes switching the Review Response workflow
//     off reasonable — and it does NOT switch it off. An owner who writes his own
//     replies still benefits from having drafts ready the same day; the workflow
//     installs and the operator removes it by hand if the client insists. See the
//     suggestion (not rule) on that workflow in workflow-catalogue.ts.
export type ReviewReplyOwner = "NOBODY" | "OWNER" | "STAFF_OR_AGENCY";
export const REVIEW_REPLY_OWNER_OPTIONS: { value: ReviewReplyOwner; label: string }[] = [
  { value: "NOBODY", label: "Nobody" },
  { value: "OWNER", label: "I do" },
  { value: "STAFF_OR_AGENCY", label: "A staff member or agency" },
];

// "Which of these do you want PRIORITIZED in your build?" — the fixed 10-option
// checkbox. Stored as a comma-separated string of these slugs.
export const BUILD_PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "INSTANT_LEAD_RESPONSE", label: "Instant lead response" },
  { value: "MISSED_CALL_TEXTBACK", label: "Missed-call text-back" },
  { value: "AFTER_HOURS_COVERAGE", label: "After-hours lead coverage" },
  { value: "ONLINE_BOOKING", label: "Online booking" },
  { value: "FOLLOW_UP_SEQUENCES", label: "Follow-up sequences" },
  { value: "REMINDERS_NOSHOW", label: "Reminders + no-show protection" },
  { value: "LEAD_PIPELINE", label: "Lead pipeline" },
  // LABEL ONLY — the slug is stored in the DB and flows nowhere near the model,
  // so it stays put; renaming it would orphan every saved intake row. The LABEL
  // is what reaches the generation prompt, and the pack validator hard-fails any
  // output containing the banned review-generation section phrase — which this
  // label used to inject verbatim. "Review requests" is what we actually build:
  // the post-job ask, not a sold service.
  { value: "REVIEW_GENERATION", label: "Review requests" },
  { value: "PAST_CUSTOMER_REACTIVATION", label: "Past-customer reactivation" },
  { value: "WEBSITE_CHAT", label: "Website chat" },
];

const PRIORITY_LABEL = new Map(BUILD_PRIORITY_OPTIONS.map((o) => [o.value, o.label]));

// Parse the stored comma-separated slug string into human labels, in the stored
// order, dropping anything that isn't a known slug. Empty → [].
export function buildPriorityLabels(stored: string | null | undefined): string[] {
  if (!stored) return [];
  return stored
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((slug) => PRIORITY_LABEL.get(slug))
    .filter((l): l is string => Boolean(l));
}
