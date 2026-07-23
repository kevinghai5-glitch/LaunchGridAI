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
  { value: "REVIEW_GENERATION", label: "Review generation" },
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
