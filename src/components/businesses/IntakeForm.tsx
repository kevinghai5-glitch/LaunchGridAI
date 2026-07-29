"use client";

// ── The one client-intake form ────────────────────────────────────────────────
// Intake is the ONLY operator input that changes what the paid D1–D4 deliverables
// say: it flips a leak from a hedged benchmark to "confirmed at intake", takes a
// leak off the list entirely, and swaps benchmark math for the client's real
// numbers. So it has to be the SAME set of questions everywhere. Two screens used
// to collect two different subsets, which meant the screen the operator happened
// to open changed the pack that came out. This component is the single source of
// truth for the questions, the vocabularies, and the save path; hosts only supply
// the surrounding chrome (card, heading, save button).
//
// Two rules that everything below exists to protect:
//  1. BLANK IS A REAL ANSWER. Blank means "we didn't ask" and is NOT the same as
//     "no". "No" confirms the gap and makes the report declarative; blank leaves
//     the benchmark hedge in place. Never collapse one into the other.
//  2. WE ONLY WRITE WHAT THE OPERATOR TOUCHED. The PATCH body carries only the
//     fields that actually changed, so opening this form on a screen whose feed
//     didn't load every column can never blank a column it never showed.

import { Fragment, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import { IntakeGaps } from "@/components/businesses/IntakeGaps";
import {
  AFTER_HOURS_HANDLING_OPTIONS,
  BOOKING_METHOD_OPTIONS,
  BUILD_PRIORITY_OPTIONS,
  GBP_MANAGEMENT_OPTIONS,
  MISSED_CALL_HANDLING_OPTIONS,
  PAST_CUSTOMER_CONTACT_OPTIONS,
  RESPONSE_SPEED_OPTIONS,
  REVIEW_REPLY_OWNER_OPTIONS,
  SOCIAL_ENQUIRIES_OPTIONS,
  TAKES_DEPOSITS_OPTIONS,
  type AfterHoursHandling,
  type BookingMethod,
  type GbpManagement,
  type MissedCallHandling,
  type PastCustomerContact,
  type ResponseSpeed,
  type ReviewReplyOwner,
  type SocialEnquiries,
  type TakesDeposits,
} from "@/lib/intake-options";

// ── Public contract ───────────────────────────────────────────────────────────

/** Every intake column, normalised. This is what gets saved and what hosts get
 *  handed back — null everywhere meaning "not asked". */
export interface IntakeValues {
  avgClientValueCad: number | null;
  monthlyLeadVolume: number | null;
  hasCrm: boolean | null;
  hasFollowUpSequence: boolean | null;
  hasReminderSystem: boolean | null;
  /** "Is there a list?" — the applicability half. Its dormancy half is
   *  pastCustomerContact below; the two are asked together in the form. */
  hasPastCustomerDatabase: boolean | null;
  /** "Do they already have a mechanism?" — suppresses the payment-friction leak
   *  and NOTHING else. Its build-side twin is takesDeposits below; the two look
   *  alike and must never be collapsed. */
  hasOnlinePayment: boolean | null;
  hasCallTracking: boolean | null;
  afterHoursHandling: AfterHoursHandling | null;
  missedCallHandling: MissedCallHandling | null;
  responseSpeed: ResponseSpeed | null;
  socialEnquiries: SocialEnquiries | null;
  pastCustomerContact: PastCustomerContact | null;
  /** "Is there ever a moment for a payment link?" — the applicability fact for
   *  Text-to-Pay. NEVER is the only answer that takes that workflow out. */
  takesDeposits: TakesDeposits | null;
  /** "Who replies to your Google reviews right now?" — NOBODY is a finding in its
   *  own right; OWNER only ever raises a hint on the Review Response workflow. */
  reviewReplyOwner: ReviewReplyOwner | null;
  bookingMethod: BookingMethod | null;
  bookingToolName: string | null;
  gbpManagement: GbpManagement | null;
  servicesFocus: string | null;
  buildPriorities: string | null;
}

/** What a host hands in. Deliberately loose: the vocabulary columns are plain
 *  Strings in the database (this codebase has no Prisma enums), and a given API
 *  feed may not select every column, so each field is optional and untyped-ish
 *  on the way IN. The form narrows to the real unions on the way OUT. */
export interface IntakeSource {
  id: string;
  avgClientValueCad?: number | null;
  monthlyLeadVolume?: number | null;
  hasCrm?: boolean | null;
  hasFollowUpSequence?: boolean | null;
  hasReminderSystem?: boolean | null;
  hasPastCustomerDatabase?: boolean | null;
  hasCallTracking?: boolean | null;
  hasOnlinePayment?: boolean | null;
  afterHoursHandling?: string | null;
  missedCallHandling?: string | null;
  responseSpeed?: string | null;
  socialEnquiries?: string | null;
  pastCustomerContact?: string | null;
  takesDeposits?: string | null;
  reviewReplyOwner?: string | null;
  bookingMethod?: string | null;
  bookingToolName?: string | null;
  gbpManagement?: string | null;
  servicesFocus?: string | null;
  buildPriorities?: string | null;
}

export interface IntakeFooterState {
  save: () => void;
  saving: boolean;
  /** True when at least one answer differs from what's stored. */
  dirty: boolean;
}

export interface IntakeFormProps {
  business: IntakeSource;
  /** Handed the full normalised answer set after a successful save, so the host
   *  can merge it into its local copy without a refetch. */
  onSaved: (values: IntakeValues) => void;
  /** "compact" for the Library's three-column work surface, "comfortable" for the
   *  business-detail sidebar card. Density only — same questions either way. */
  density?: Density;
  /** Toast on success. Each screen says something slightly different about what
   *  happens next, so the host owns the wording. */
  successMessage?: string;
  /** Lets a host keep its own save affordance (shadcn Button vs. the Library's
   *  MiniButton) instead of the built-in one. */
  renderFooter?: (state: IntakeFooterState) => ReactNode;
  /** "What's still guessed" rides ALONG WITH the questions by default, because
   *  the list is the agenda for filling them in and it shrinks as he does. A host
   *  that shows the panel itself — the Library puts it beside the Generate button,
   *  where it's visible whether or not the intake editor is open — passes false so
   *  it isn't rendered twice on one screen. */
  showGaps?: boolean;
}

// ── Density ───────────────────────────────────────────────────────────────────

type Density = "compact" | "comfortable";

const SIZE: Record<
  Density,
  {
    stack: number;
    groupGap: number;
    heading: number;
    label: number;
    hint: number;
    control: number;
    pad: string;
    radius: number;
    line: string;
    segPad: string;
    segFont: number;
  }
> = {
  compact: {
    stack: 13,
    groupGap: 7,
    heading: 10,
    label: 11.5,
    hint: 10.5,
    control: 12,
    pad: "6px 9px",
    radius: 7,
    line: "var(--line)",
    segPad: "3px 10px",
    segFont: 11,
  },
  comfortable: {
    stack: 16,
    groupGap: 9,
    heading: 11,
    label: 12,
    hint: 11,
    control: 13,
    pad: "9px 11px",
    radius: 8,
    line: "var(--line-strong)",
    segPad: "5px 12px",
    segFont: 12,
  },
};

// ── Draft state ───────────────────────────────────────────────────────────────
// Everything is held as the string/tri-state the control actually produces, then
// normalised once on save. Keeping the draft in control-shape is what lets the
// dirty check compare like with like.

type Tri = "yes" | "no" | "unknown";

const BOOLEAN_KEYS = [
  "hasCrm",
  "hasFollowUpSequence",
  "hasReminderSystem",
  "hasPastCustomerDatabase",
  "hasCallTracking",
  "hasOnlinePayment",
] as const;
type BooleanKey = (typeof BOOLEAN_KEYS)[number];

interface Draft {
  avg: string;
  vol: string;
  booleans: Record<BooleanKey, Tri>;
  afterHoursHandling: string;
  missedCallHandling: string;
  responseSpeed: string;
  socialEnquiries: string;
  pastCustomerContact: string;
  takesDeposits: string;
  reviewReplyOwner: string;
  bookingMethod: string;
  bookingToolName: string;
  gbpManagement: string;
  servicesFocus: string;
  /** Slug list, order preserved. */
  priorities: string[];
}

const b2tri = (v: boolean | null | undefined): Tri =>
  v === true ? "yes" : v === false ? "no" : "unknown";
const tri2bool = (t: Tri): boolean | null => (t === "yes" ? true : t === "no" ? false : null);

function draftFrom(b: IntakeSource): Draft {
  return {
    avg: b.avgClientValueCad?.toString() ?? "",
    vol: b.monthlyLeadVolume?.toString() ?? "",
    booleans: {
      hasCrm: b2tri(b.hasCrm),
      hasFollowUpSequence: b2tri(b.hasFollowUpSequence),
      hasReminderSystem: b2tri(b.hasReminderSystem),
      hasPastCustomerDatabase: b2tri(b.hasPastCustomerDatabase),
      hasCallTracking: b2tri(b.hasCallTracking),
      hasOnlinePayment: b2tri(b.hasOnlinePayment),
    },
    afterHoursHandling: b.afterHoursHandling ?? "",
    missedCallHandling: b.missedCallHandling ?? "",
    responseSpeed: b.responseSpeed ?? "",
    socialEnquiries: b.socialEnquiries ?? "",
    pastCustomerContact: b.pastCustomerContact ?? "",
    takesDeposits: b.takesDeposits ?? "",
    reviewReplyOwner: b.reviewReplyOwner ?? "",
    bookingMethod: b.bookingMethod ?? "",
    bookingToolName: b.bookingToolName ?? "",
    gbpManagement: b.gbpManagement ?? "",
    servicesFocus: b.servicesFocus ?? "",
    // Unknown slugs are kept, not filtered. They render no chip, but dropping
    // them here would silently delete an answer on the next save.
    priorities: b.buildPriorities
      ? b.buildPriorities.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

// A positive whole number, or null. 0 and junk both mean "no answer": the API
// schema only accepts positive integers, so sending a typed 0 would bounce the
// whole save with a 400 instead of just leaving that field on benchmarks.
function toPositiveInt(s: string): number | null {
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Only accept a slug we actually offer. A value that isn't in the vocabulary
// would fail the API's z.enum and take the whole save down with it, and it can't
// be shown in the control either — so it reads as blank.
function asOption<T extends string>(raw: string, options: { value: T }[]): T | null {
  const hit = options.find((o) => o.value === raw);
  return hit ? hit.value : null;
}

function toValues(d: Draft): IntakeValues {
  const method = asOption(d.bookingMethod, BOOKING_METHOD_OPTIONS);
  const tool = d.bookingToolName.trim();
  return {
    avgClientValueCad: toPositiveInt(d.avg),
    monthlyLeadVolume: toPositiveInt(d.vol),
    hasCrm: tri2bool(d.booleans.hasCrm),
    hasFollowUpSequence: tri2bool(d.booleans.hasFollowUpSequence),
    hasReminderSystem: tri2bool(d.booleans.hasReminderSystem),
    hasPastCustomerDatabase: tri2bool(d.booleans.hasPastCustomerDatabase),
    hasCallTracking: tri2bool(d.booleans.hasCallTracking),
    hasOnlinePayment: tri2bool(d.booleans.hasOnlinePayment),
    afterHoursHandling: asOption(d.afterHoursHandling, AFTER_HOURS_HANDLING_OPTIONS),
    missedCallHandling: asOption(d.missedCallHandling, MISSED_CALL_HANDLING_OPTIONS),
    responseSpeed: asOption(d.responseSpeed, RESPONSE_SPEED_OPTIONS),
    socialEnquiries: asOption(d.socialEnquiries, SOCIAL_ENQUIRIES_OPTIONS),
    // NOT gated on the past-customer-list answer, unlike bookingToolName above.
    // "No list" already takes reactivation off the report on its own, so blanking
    // this alongside it would buy nothing and would destroy an answer he gave —
    // and a cleared field reads as "never asked", which is a different fact.
    pastCustomerContact: asOption(d.pastCustomerContact, PAST_CUSTOMER_CONTACT_OPTIONS),
    // NOT gated on hasOnlinePayment, and that is the whole point of the pair. They
    // are two independent facts: whether there is a moment for a payment link
    // (this) and whether a mechanism already exists (that). Deriving one from the
    // other is the merge this codebase keeps warning about.
    takesDeposits: asOption(d.takesDeposits, TAKES_DEPOSITS_OPTIONS),
    reviewReplyOwner: asOption(d.reviewReplyOwner, REVIEW_REPLY_OWNER_OPTIONS),
    bookingMethod: method,
    // The tool name only means anything when they book through a tool — the
    // generator uses it to say "we connect your Calendly", which would be a lie
    // if they'd since told us they take bookings by phone.
    bookingToolName: method === "BOOKING_TOOL" && tool ? tool : null,
    gbpManagement: asOption(d.gbpManagement, GBP_MANAGEMENT_OPTIONS),
    servicesFocus: d.servicesFocus.trim() || null,
    buildPriorities: d.priorities.length ? d.priorities.join(",") : null,
  };
}

// ── Field primitives ──────────────────────────────────────────────────────────

function Group({
  title,
  hint,
  s,
  children,
}: {
  title: string;
  hint?: string;
  s: (typeof SIZE)[Density];
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.groupGap }}>
      <span
        style={{
          fontSize: s.heading,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
        }}
      >
        {title}
      </span>
      {hint && (
        <p style={{ fontSize: s.hint, color: "var(--text-subtle)", margin: 0, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function FieldLabel({ text, s }: { text: string; s: (typeof SIZE)[Density] }) {
  return (
    <span style={{ fontSize: s.label, color: "var(--text-2)", lineHeight: 1.4 }}>{text}</span>
  );
}

function controlStyle(s: (typeof SIZE)[Density]): CSSProperties {
  return {
    width: "100%",
    borderRadius: s.radius,
    border: `1px solid ${s.line}`,
    background: "var(--bg-deep, #0b0d12)",
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: s.control,
    padding: s.pad,
    outline: "none",
  };
}

// Yes / No / didn't-ask. The "?" is a first-class answer, not an empty state —
// "no" confirms the gap in the report, "?" leaves it hedged as a benchmark.
function TriControl({
  label,
  value,
  onChange,
  s,
}: {
  label: string;
  value: Tri;
  onChange: (next: Tri) => void;
  s: (typeof SIZE)[Density];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <FieldLabel text={label} s={s} />
      <div
        style={{
          display: "inline-flex",
          borderRadius: s.radius,
          overflow: "hidden",
          border: `1px solid ${s.line}`,
          flex: "none",
        }}
      >
        {(["yes", "no", "unknown"] as const).map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              title={opt === "unknown" ? "Didn't ask" : opt === "yes" ? "Yes" : "No"}
              aria-pressed={active}
              style={{
                padding: s.segPad,
                fontSize: s.segFont,
                fontFamily: "inherit",
                cursor: "pointer",
                border: "none",
                borderLeft: opt === "yes" ? "none" : `1px solid ${s.line}`,
                background: active ? "var(--accent-grad)" : "transparent",
                color: active ? "#fff" : "var(--text-3)",
              }}
            >
              {opt === "yes" ? "Yes" : opt === "no" ? "No" : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One answer from a fixed vocabulary, or nothing. The blank option is always
// first and always says so — an unanswered question must never read as broken.
function SelectControl<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  s,
}: {
  label: string;
  hint?: string;
  value: string;
  options: { value: T; label: string }[];
  onChange: (next: string) => void;
  s: (typeof SIZE)[Density];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <FieldLabel text={label} s={s} />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={controlStyle(s)}>
        <option value="">Didn&apos;t ask</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function NumberControl({
  label,
  prefix,
  value,
  onChange,
  s,
}: {
  label: string;
  prefix?: string;
  value: string;
  onChange: (next: string) => void;
  s: (typeof SIZE)[Density];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <FieldLabel text={label} s={s} />
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-subtle)",
              fontSize: s.control,
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{
            ...controlStyle(s),
            paddingLeft: prefix ? 20 : undefined,
          }}
        />
      </div>
    </label>
  );
}

// The four booleans that were only ever collected as a checklist, kept in the
// order the conversation runs. The past-customer row is the one exception to the
// plain list: it carries a paired follow-up question rendered directly beneath
// it — see the render below for why the two are not duplicates.
const SYSTEM_CHECKLIST: { key: BooleanKey; label: string }[] = [
  { key: "hasCrm", label: "CRM / lead pipeline" },
  { key: "hasFollowUpSequence", label: "Automated follow-up" },
  { key: "hasReminderSystem", label: "Appointment reminders" },
  { key: "hasPastCustomerDatabase", label: "Past-customer list" },
];

// ── The form ──────────────────────────────────────────────────────────────────

export function IntakeForm({
  business,
  onSaved,
  density = "compact",
  successMessage = "Intake saved — regenerate to apply",
  renderFooter,
  showGaps = true,
}: IntakeFormProps) {
  const s = SIZE[density];
  const [draft, setDraft] = useState<Draft>(() => draftFrom(business));
  const [saving, setSaving] = useState(false);
  // Bumped after every successful save so the gaps panel re-reads. Answering a
  // question and not seeing the list shrink is the difference between a to-do
  // list and a lecture — he has to see the effect of the answer he just gave,
  // without reloading the page.
  const [gapsKey, setGapsKey] = useState(0);

  // What's on the server right now, run through the exact same normalisation as
  // the draft — so the diff below compares like with like and a field the
  // operator never touched can't look dirty.
  const stored = useMemo(() => toValues(draftFrom(business)), [business]);
  const values = useMemo(() => toValues(draft), [draft]);

  // Only the answers that actually changed. PATCH takes a partial body, so
  // omitting a field leaves it exactly as it was — which is what makes it safe
  // to open this form on a screen whose feed didn't load every column.
  const changed = useMemo(() => {
    const out: Partial<IntakeValues> = {};
    (Object.keys(values) as (keyof IntakeValues)[]).forEach((key) => {
      if (!Object.is(values[key], stored[key])) {
        Object.assign(out, { [key]: values[key] });
      }
    });
    return out;
  }, [values, stored]);
  const dirty = Object.keys(changed).length > 0;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save intake");
        return;
      }
      // Hand back the full normalised set, not the diff — the host merges it into
      // its local copy, which then matches what the next dirty check reads.
      onSaved(values);
      // Detection has to be re-run server-side to know what the answer changed —
      // one answer can take a leak off the list entirely, so the count can't be
      // adjusted optimistically here.
      setGapsKey((n) => n + 1);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to save intake");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.stack }}>
      <p style={{ fontSize: s.hint, color: "var(--text-subtle)", margin: 0, lineHeight: 1.55 }}>
        Every question is optional. Leaving one blank is a real answer — it means we
        didn&apos;t ask, which the deliverables treat very differently from a “no”.
      </p>

      {/* What's still guessed, above the questions rather than after them: it's the
          agenda for the ones that are worth filling in, and it shrinks as they are. */}
      {showGaps && (
        <div
          style={{
            border: `1px solid ${s.line}`,
            borderRadius: s.radius + 1,
            background: "rgba(255,255,255,0.015)",
            padding: density === "compact" ? "10px 11px" : "12px 13px",
          }}
        >
          <IntakeGaps businessId={business.id} reloadKey={gapsKey} density={density} />
        </div>
      )}

      <Group
        title="Their numbers"
        hint="Filled in, the money math runs on their real economics. Blank falls back to industry benchmarks."
        s={s}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <NumberControl
            label="Avg. customer value (CAD)"
            prefix="$"
            value={draft.avg}
            onChange={(v) => set("avg", v)}
            s={s}
          />
          <NumberControl
            label="Monthly enquiries"
            value={draft.vol}
            onChange={(v) => set("vol", v)}
            s={s}
          />
        </div>
      </Group>

      <Group
        title="How enquiries are handled today"
        hint="The strongest lever here: one answer can take a leak off the report entirely, or turn a hedged benchmark into “confirmed at intake”."
        s={s}
      >
        <SelectControl
          label="How fast does a new enquiry usually get a reply?"
          value={draft.responseSpeed}
          options={RESPONSE_SPEED_OPTIONS}
          onChange={(v) => set("responseSpeed", v)}
          s={s}
        />
        <SelectControl
          label="What happens when you miss a call?"
          value={draft.missedCallHandling}
          options={MISSED_CALL_HANDLING_OPTIONS}
          onChange={(v) => set("missedCallHandling", v)}
          s={s}
        />
        <SelectControl
          label="What happens when someone calls after hours?"
          value={draft.afterHoursHandling}
          options={AFTER_HOURS_HANDLING_OPTIONS}
          onChange={(v) => set("afterHoursHandling", v)}
          s={s}
        />
        {/* The only answer on this form that is both a report fact and a BUILD
            fact, so the hint has to spell the difference out: the two "no"
            answers do the same thing to the report and different things to the
            build, and picking the wrong one quietly drops a workflow. */}
        <SelectControl
          label="Do enquiries come in through Instagram or Facebook messages?"
          hint="Either “no” takes this off the report. Only “we don’t have social accounts” also drops the social-inbox workflow from the build — if the accounts exist we still connect them, quiet channel or not."
          value={draft.socialEnquiries}
          options={SOCIAL_ENQUIRIES_OPTIONS}
          onChange={(v) => set("socialEnquiries", v)}
          s={s}
        />
        <TriControl
          label="Do you track calls, answered vs missed, today?"
          value={draft.booleans.hasCallTracking}
          onChange={(t) => set("booleans", { ...draft.booleans, hasCallTracking: t })}
          s={s}
        />
        <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
          Nothing outside the business can see call tracking — only they can tell us.
        </span>
      </Group>

      <Group
        title="Systems they already have"
        hint="Yes removes that leak. No has it written as confirmed at intake. Blank leaves the benchmark hedge."
        s={s}
      >
        {SYSTEM_CHECKLIST.map((q) => (
          <Fragment key={q.key}>
            <TriControl
              label={q.label}
              value={draft.booleans[q.key]}
              onChange={(t) => set("booleans", { ...draft.booleans, [q.key]: t })}
              s={s}
            />
            {/* HANGS OFF THE ROW ABOVE ON PURPOSE. These two look like the same
                question and are not, so the indent, the rule, and the lead-in
                line all exist to stop him skipping the second one as a repeat.
                "Do you have a list?" decides whether reactivation belongs in the
                report at all; "when did you last work it?" is the only one that
                can confirm what the finding actually says, which is that the list
                is sitting dormant. */}
            {q.key === "hasPastCustomerDatabase" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginLeft: density === "compact" ? 8 : 10,
                  paddingLeft: density === "compact" ? 9 : 11,
                  borderLeft: `1px solid ${s.line}`,
                }}
              >
                <span
                  style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}
                >
                  Not a repeat of the line above — the other half of it. That one asks
                  whether a list exists. This one asks whether anyone is working it.
                </span>
                <SelectControl
                  label="When did you last contact past customers or old quotes?"
                  hint="Only “within the last month, systematically” takes this off the report. The other three have it written as confirmed at intake."
                  value={draft.pastCustomerContact}
                  options={PAST_CUSTOMER_CONTACT_OPTIONS}
                  onChange={(v) => set("pastCustomerContact", v)}
                  s={s}
                />
              </div>
            )}
          </Fragment>
        ))}
        <TriControl
          label="Can a customer pay or leave a deposit online today?"
          value={draft.booleans.hasOnlinePayment}
          onChange={(t) => set("booleans", { ...draft.booleans, hasOnlinePayment: t })}
          s={s}
        />
        {/* THE SECOND HALF OF THE PAYMENT PAIR, indented for the same reason the
            past-customer pair is: these two read as the same question and are not.
            The one above asks whether a way to pay online EXISTS — it only ever
            takes the payment-friction finding off the report. This one asks
            whether there is ever a moment in their day for a payment link to sit
            in, and it is the answer that decides whether Text-to-Pay is in the
            build at all. They also run opposite ways, which is why the hint says
            so out loud: deposits with no online way to take them is the strongest
            case for this workflow, not a reason to drop it. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            marginLeft: density === "compact" ? 8 : 10,
            paddingLeft: density === "compact" ? 9 : 11,
            borderLeft: `1px solid ${s.line}`,
          }}
        >
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            Not a repeat of the line above. That one asks whether a way to pay online
            exists. This one asks whether there is ever a payment to take before the
            job.
          </span>
          <SelectControl
            label="Do you take a deposit or payment before the work is done?"
            hint="Only “no, we’re paid at the time of service” drops the text-to-pay workflow from the build. If they take deposits but have no online way to collect them, that is the strongest case for it there is — they’re chasing e-transfers by hand today."
            value={draft.takesDeposits}
            options={TAKES_DEPOSITS_OPTIONS}
            onChange={(v) => set("takesDeposits", v)}
            s={s}
          />
        </div>
      </Group>

      <Group
        title="Booking"
        hint="Phone/email only confirms the missing-booking gap. A named tool means the build connects and optimises what they already use, instead of claiming they have no booking."
        s={s}
      >
        <SelectControl
          label="How do they book right now?"
          value={draft.bookingMethod}
          options={BOOKING_METHOD_OPTIONS}
          onChange={(v) => set("bookingMethod", v)}
          s={s}
        />
        {draft.bookingMethod === "BOOKING_TOOL" && (
          <input
            type="text"
            aria-label="Which booking tool"
            value={draft.bookingToolName}
            maxLength={120}
            onChange={(e) => set("bookingToolName", e.target.value)}
            placeholder="Which one? e.g. Calendly, Acuity, GHL"
            style={controlStyle(s)}
          />
        )}
      </Group>

      <Group
        title="Google listing"
        // The two questions here do DIFFERENT jobs, so the hint no longer claims
        // that nothing in this group touches a finding: who MANAGES the listing is
        // framing only (review counts and ratings come from Google either way),
        // but who REPLIES is the one thing no scan can see, so that answer is the
        // only evidence for it that will ever exist.
        hint="Who manages the listing is framing only — who approves the work, or who we coordinate access with. Who replies is different: it's the one review fact nothing outside the business can see, so their answer is the only evidence there is."
        s={s}
      >
        <SelectControl
          label="Do they manage their own Google Business listing?"
          value={draft.gbpManagement}
          options={GBP_MANAGEMENT_OPTIONS}
          onChange={(v) => set("gbpManagement", v)}
          s={s}
        />
        {/* ASKED AS A PROCESS QUESTION, NOT A PREFERENCE ONE, and the wording is
            load-bearing. "Do you write your own replies?" invites a scope answer —
            an owner says yes out of pride and we quietly drop a workflow he would
            have been glad of. "Who replies right now?" is a fact about how the
            business runs today, which is the shape every other question here
            takes. It is also the ONLY thing that can ever establish that reviews
            go unanswered: nothing we pull from Google carries owner replies. */}
        <SelectControl
          label="Who replies to your Google reviews right now?"
          hint="“Nobody” is a finding in its own right — it is the only way we can ever know, so it goes in the report as something they told us. “I do” doesn’t drop the reply workflow: they still get a draft ready the same day, and you take it out by hand if they want it out."
          value={draft.reviewReplyOwner}
          options={REVIEW_REPLY_OWNER_OPTIONS}
          onChange={(v) => set("reviewReplyOwner", v)}
          s={s}
        />
      </Group>

      <Group title="What to emphasise" s={s}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel text="Services they want more of" s={s} />
          <textarea
            value={draft.servicesFocus}
            maxLength={300}
            rows={2}
            onChange={(e) => set("servicesFocus", e.target.value)}
            placeholder="e.g. emergency drain calls, water heater installs"
            style={{ ...controlStyle(s), resize: "vertical" }}
          />
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            Copy wording only — never changes which leaks fire, the scores, or the math.
          </span>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel text="Prioritize in the build" s={s} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {BUILD_PRIORITY_OPTIONS.map((opt) => {
              const active = draft.priorities.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    set(
                      "priorities",
                      active
                        ? draft.priorities.filter((v) => v !== opt.value)
                        : [...draft.priorities, opt.value]
                    )
                  }
                  style={{
                    padding: "4px 10px",
                    fontSize: s.segFont,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--accent)" : s.line}`,
                    background: active ? "var(--accent-grad)" : "transparent",
                    color: active ? "#fff" : "var(--text-3)",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: s.hint, color: "var(--text-subtle)", lineHeight: 1.5 }}>
            Ordering &amp; emphasis only — wires the checked doors first, never changes leaks or math.
          </span>
        </div>
      </Group>

      {renderFooter ? (
        renderFooter({ save, saving, dirty })
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            style={{
              fontSize: s.segFont,
              fontWeight: 600,
              fontFamily: "inherit",
              padding: "5px 11px",
              borderRadius: s.radius,
              border: `1px solid ${s.line}`,
              background: "transparent",
              color: dirty && !saving ? "var(--text)" : "var(--text-subtle)",
              cursor: dirty && !saving ? "pointer" : "default",
            }}
          >
            {saving ? "Saving…" : "Save intake"}
          </button>
        </div>
      )}
    </div>
  );
}
