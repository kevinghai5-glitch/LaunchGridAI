"use client";

// ── The client drawer ─────────────────────────────────────────────────────────
//
// THE BUG THIS FIXES. The Library's expanded business panel used to get taller
// every time anything opened: the sixteen-field intake form and the fourteen
// build switches were appended BELOW the three-column grid, so opening either
// one pushed the page down and sent the operator scrolling to find a field.
// Both now live in a right-anchored overlay that takes its own scrollbar. The
// page behind is exactly as tall — and sitting at exactly the same scroll
// offset — after this opens as it was before.
//
// WHY A DRAWER AND NOT A MODAL. He fills this in live, on a fifteen-minute Zoom,
// while the owner is talking. A centred modal blanks out the client's record
// behind it — the findings, the pack, the gaps count — and he is reading those
// back to the owner between questions. A right-hand drawer keeps the record on
// screen to the left of it, scrolls on its own, and never moves the page
// underneath. Losing whose record he is editing is the failure mode on a call,
// so the business name sits in a header that is pinned outside the scroll area
// and cannot be scrolled away from.
//
// WHY THE TABS ARE IN HERE AND NOT IN THE PANEL. The questions, the intake form
// and the build are three tall things and only one of them is ever being worked
// on, so they want to be tabs. But tabs inside the in-page panel just re-creates
// the original bug: switching to the sixteen-field tab makes the panel taller and
// the page starts scrolling again. Inside a fixed, full-height drawer a tab switch
// changes nothing outside this component — only which of the three panes has the
// drawer's own scrollbar.
//
// WHY "QUESTIONS" IS THE FIRST TAB AND THE DEFAULT. It is the prioritised subset
// of Intake: the handful of answers that actually change how the deliverables read
// ("5 of 8 findings will read as industry pattern instead of fact"), each one
// answerable in the row that asks it. That is what he needs in the first thirty
// seconds of a fifteen-minute call. The full sixteen-field form is one keystroke
// away for the other eleven, and the build is behind it again. Opening onto the
// long form and expecting him to find those five inside it is the split this whole
// change exists to remove.
//
// THIS FILE IS A CONTAINER, NOT A FORM. It owns no questions, no switches, no
// option lists and no save path. IntakeGaps, IntakeForm and WorkflowPanel are
// rendered exactly as they are, through the props they already expose. Forking any
// of them would give this screen a second copy of rules that is free to disagree
// with the first — which is how the pack that comes out ends up depending on which
// screen got used.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import { ClipboardList, HelpCircle, Loader2, Workflow, X, type LucideIcon } from "lucide-react";
import { IntakeGaps } from "@/components/businesses/IntakeGaps";
import {
  IntakeForm,
  type IntakeFooterState,
  type IntakeSource,
  type IntakeValues,
} from "@/components/businesses/IntakeForm";
import { WorkflowPanel } from "@/components/businesses/WorkflowPanel";

// ── Public contract ───────────────────────────────────────────────────────────

/** Tab order IS this order — "questions" first because it is the useful default.
 *  See the note at the top of the file. */
export type ClientDrawerTab = "questions" | "intake" | "build";

/** One answer recorded on the Questions tab: the Business column that was
 *  written, and the raw value written to it. */
export type RecordedAnswers = Record<string, string | boolean | null>;

export interface ClientDrawerProps {
  /** Host-owned open state. Closed renders nothing at all — see the note on the
   *  component below for why that unmount is deliberate rather than incidental. */
  open: boolean;
  /** The business row, passed straight through to IntakeForm. Its `id` IS the
   *  businessId WorkflowPanel and IntakeGaps are given: one field rather than
   *  three, so the panes of this drawer can never end up pointed at different
   *  clients. Hosts hand in whatever they already hold — `item.business` in the
   *  Library, the fetched business on the detail page. */
  business: IntakeSource;
  /** Shown in the pinned header. Separate from `business` because the intake
   *  feed is a set of answer columns and does not carry the name. */
  businessName: string;
  /** Which pane is showing when it opens — each host has one button per tab, and
   *  the button he pressed is the tab he gets. Defaults to "questions". */
  initialTab?: ClientDrawerTab;
  /** Called when the drawer has decided it is safe to go. NOTE: a close request
   *  does NOT always reach this — an unsaved intake draft asks first, and a save
   *  in flight refuses until the write lands. */
  onClose: () => void;
  /** Fires after a SUCCESSFUL intake save, with the full normalised answer set —
   *  IntakeForm's own `onSaved`, forwarded. Hosts merge it into their local copy.
   *  The Questions tab's re-count is handled in here, not by the host.
   *
   *  MERGING IS NOT OPTIONAL. IntakeForm derives "dirty" by diffing its draft
   *  against the `business` prop, so a host that bumps a key without merging
   *  leaves the form looking unsaved forever — and this drawer would then ask
   *  him to save again on the way out, over a write that already landed.
   *
   *  There is no equivalent for the build tab on purpose: WorkflowPanel exposes
   *  no change callback, and a flipped switch changes nothing a host renders. */
  onIntakeSaved?: (values: IntakeValues) => void;
  /**
   * Fires ONCE, on the way out, with every answer the Questions tab recorded this
   * session — `{ missedCallHandling: "VOICEMAIL_ONLY", hasCrm: false }`. Each one
   * is already written to the database (IntakeGaps PATCHes on click); this is only
   * so the host's copy of the row catches up.
   *
   * WHY ON THE WAY OUT AND NOT AS EACH ANSWER LANDS. IntakeForm seeds its draft
   * from `business` once, on mount, and decides what to PATCH by diffing that
   * draft against the SAME prop. Move `business` under the mounted form and it
   * sees "stored" change while its draft stayed blank, reads that as an edit, and
   * writes the blank back over the answer on the next save (see the long trap note
   * on IntakeGaps.onAnswered). Both panes stay mounted in here, so the form is
   * ALWAYS mounted while he is on the Questions tab — there is no safe moment to
   * merge until this thing is closing.
   *
   * NOT WIRING IT IS SAFE BUT COSTS HIM A QUESTION. Nothing is lost from the
   * database. What goes stale is the host's row, which is what seeds the form on
   * the NEXT open — so a question answered here would open blank tomorrow, and a
   * blank is an invitation to ask a client the same thing twice.
   */
  onAnswersRecorded?: (answers: RecordedAnswers) => void;
  /** Bump to make the Questions tab re-read while the drawer is OPEN. It re-reads
   *  itself after every answer and remounts on every open, so this is only for
   *  things the drawer cannot see: a cold audit or a pack generation finishing
   *  behind it, which captures the research snapshot the whole list is computed
   *  from. A host with nothing like that leaves it out. */
  questionsReloadKey?: number;
  /** Toast wording on a successful intake save. Each screen says something
   *  different about what happens next, so the host still owns the sentence. */
  successMessage?: string;
}

// Below any PackGateDialog (z-index 200 in PackOverrideDialog.tsx). A blocked
// gate has to be readable over whatever is open, including this.
const Z = 190;

// LABELLED IN HIS LANGUAGE, one word each, so the three read as siblings.
// "Questions" over "Gaps" or "Still guessed": those name the deficiency, and what
// he is actually looking at is the short list of things he can simply ask. The
// glyph is the same HelpCircle that marks every unanswered row inside the pane, so
// the button, the tab and the row all carry one mark.
const TABS: { id: ClientDrawerTab; label: string; icon: LucideIcon }[] = [
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "intake", label: "Intake", icon: ClipboardList },
  { id: "build", label: "Build", icon: Workflow },
];

// ── The drawer ────────────────────────────────────────────────────────────────

/**
 * Closed renders null, so the body below only ever exists while it is open.
 * That is doing real work: every open is a fresh mount, which means fresh
 * fetches (the build, the guessed count) instead of whatever was true the last
 * time he looked, and it means a discarded draft is genuinely gone rather than
 * waiting to reappear on the next client.
 */
export function ClientDrawer(props: ClientDrawerProps) {
  if (!props.open) return null;
  return <DrawerBody {...props} />;
}

function DrawerBody({
  business,
  businessName,
  initialTab = "questions",
  onClose,
  onIntakeSaved,
  onAnswersRecorded,
  questionsReloadKey = 0,
  successMessage = "Intake saved — regenerate to apply",
}: ClientDrawerProps) {
  const [tab, setTab] = useState<ClientDrawerTab>(initialTab);
  const ids = useId();

  // Mirror of IntakeForm's footer state, for the chrome OUTSIDE the form: the
  // pinned Save button, the unsaved dot on the tab, and the close guard. It
  // arrives one commit late (it is reported from an effect), which is fine for
  // everything it drives.
  const [intake, setIntake] = useState<{ saving: boolean; dirty: boolean }>({
    saving: false,
    dirty: false,
  });
  // The same thing, always current as of the last commit. Close decisions read
  // THIS, never the state above — a close request can arrive in the same tick as
  // an edit, and a one-commit-old `dirty` would wave it through.
  const intakeRef = useRef<IntakeFooterState | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [heldBySave, setHeldBySave] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Set when he picks "Save and close", cleared by whichever of the two possible
  // endings happens first. A ref because the success path reads it synchronously
  // from inside IntakeForm's save.
  const closeAfterSave = useRef(false);

  // Bumped after every successful intake save AND after every single answer
  // clicked on the Questions tab, so the build pane re-reads. Either one can take
  // a workflow out of the build entirely ("we don't have social accounts"), and
  // the drawer is the only thing that knows all three panes — so it is the only
  // thing that can keep them in step.
  const [buildKey, setBuildKey] = useState(0);
  // Bumped only by a full-form save. The Questions tab re-reads ITSELF after each
  // of its own answers (it has to: only the server knows whether an answer
  // upgraded a finding, took it off the report, or changed nothing), so bumping
  // this there would just buy a second identical GET per click.
  const [gapsKey, setGapsKey] = useState(0);

  // Every answer the Questions tab recorded this session, flushed to the host on
  // the way out. A ref, not state: nothing in here renders it, and it must be
  // readable synchronously from the close path.
  const recorded = useRef<RecordedAnswers>({});

  const firstControlRef = useRef<HTMLButtonElement>(null);

  // The host asking for a tab wins, even when the drawer is already open on the
  // other one. Without this, clicking a build affordance while intake happens to
  // be showing does nothing at all, which reads as a broken button. He can still
  // move between them himself — this only re-asserts a fresh request.
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Focus lands on the first control, and goes back where it came from on close.
  // On a call the next Tab has to continue from the thing he opened this with,
  // not from the top of the page.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    firstControlRef.current?.focus();
    return () => {
      if (returnTo && returnTo !== document.body && document.contains(returnTo)) {
        returnTo.focus();
      }
    };
  }, []);

  /**
   * The single exit. Hands the host whatever the Questions tab recorded, then
   * closes.
   *
   * ORDERING IS DELIBERATE AND IT IS THE REVERSE OF WHAT YOU'D GUESS. "Save &
   * close" gives the host the full form's normalised answer set first
   * (onIntakeSaved), and that set was seeded from the row as it looked BEFORE
   * these chips were clicked — so it carries a blank for every field answered on
   * the Questions tab. Applying the chips after it is what leaves the host's copy
   * matching the database. Nothing was ever at risk IN the database: IntakeForm
   * PATCHes only fields whose draft differs from that same stale copy, and a field
   * it reads as blank on both sides is simply not in the body.
   *
   * Every path out is routed through this — clean close, Escape, scrim, discard,
   * save-and-close. An answer he clicked is saved either way, so an exit that
   * skipped this would only ever mean the next open asks the client again.
   */
  const finish = useCallback(() => {
    const answers = recorded.current;
    recorded.current = {};
    if (Object.keys(answers).length > 0) onAnswersRecorded?.(answers);
    onClose();
  }, [onAnswersRecorded, onClose]);

  /**
   * Every way out goes through here, and it is allowed to say no.
   *
   * IntakeForm PATCHes only the fields that actually changed and holds the rest
   * as local draft state, so an un-saved answer exists nowhere but in this
   * component's subtree — closing on it loses it with nothing on screen to say
   * so. Hence: a save in flight refuses to close, and a dirty draft asks.
   *
   * The build tab has nothing to guard. Each switch is its own committed PATCH
   * the moment it is flipped, with its own rollback and its own error toast, so
   * there is never an unsaved decision sitting in that pane.
   */
  const requestClose = useCallback(() => {
    const state = intakeRef.current;
    if (state?.saving) {
      // Yanking the panel away mid-PATCH leaves him with no idea whether the
      // answer landed. Say what is happening and stay put; the notice clears
      // itself when the write finishes.
      setHeldBySave(true);
      return;
    }
    if (state?.dirty) {
      // Cleared first: a failure from an earlier attempt is old news, and the
      // prompt reopening with "that save didn't land" over a save that has since
      // landed would be a lie.
      setSaveFailed(false);
      setConfirming(true);
      return;
    }
    finish();
  }, [finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape out of the question first, not out of the drawer — otherwise the
      // reflex that opened the prompt is the same reflex that discards the work.
      if (confirming) {
        setConfirming(false);
        return;
      }
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, requestClose]);

  // The "still saving" notice is about one specific write; once that write is
  // done the sentence is no longer true.
  useEffect(() => {
    if (!intake.saving) setHeldBySave(false);
  }, [intake.saving]);

  // The prompt only ever asks about an unsaved draft. If there stops being one —
  // he put the field back the way he found it, or the save landed and the host
  // merged it — the question answers itself and the footer goes back to normal.
  useEffect(() => {
    if (confirming && !intake.dirty && !intake.saving) setConfirming(false);
  }, [confirming, intake.dirty, intake.saving]);

  // Did a "Save and close" fail? IntakeForm calls onSaved ONLY on success, and
  // that handler clears the flag. So a save that finished with the flag still
  // set is a save that did not land — the drawer stays open and says so, on top
  // of the error toast IntakeForm has already raised.
  const wasSaving = useRef(false);
  useEffect(() => {
    const finished = wasSaving.current && !intake.saving;
    wasSaving.current = intake.saving;
    if (finished && closeAfterSave.current) {
      closeAfterSave.current = false;
      setSaveFailed(true);
    }
  }, [intake.saving]);

  const reportIntake = useCallback((saving: boolean, dirty: boolean) => {
    // Guarded so an unchanged report is a no-op: this is called after every
    // commit of IntakeForm, which is every keystroke.
    setIntake((prev) => (prev.saving === saving && prev.dirty === dirty ? prev : { saving, dirty }));
  }, []);

  const handleSaved = (values: IntakeValues) => {
    onIntakeSaved?.(values);
    setBuildKey((n) => n + 1);
    // The full form can answer any of the questions the other tab lists, so that
    // count has to be recomputed server-side before he looks at it again.
    setGapsKey((n) => n + 1);
    setSaveFailed(false);
    if (closeAfterSave.current) {
      closeAfterSave.current = false;
      finish();
    }
  };

  /**
   * One answer, clicked on the Questions tab and already written by IntakeGaps.
   * Two consequences the panel itself cannot know about:
   *
   *  · THE BUILD MAY HAVE MOVED. "No social accounts" drops Social DM Capture
   *    outright. A build pane sitting one tab away, still showing a workflow the
   *    answer just removed, is worse than one that re-reads.
   *  · THE HOST'S ROW IS NOW BEHIND. Buffered, NOT forwarded now — the form on the
   *    next tab is mounted and diffs against that row. See onAnswersRecorded.
   */
  const handleAnswered = (field: string, value: string | boolean | null) => {
    recorded.current = { ...recorded.current, [field]: value };
    setBuildKey((n) => n + 1);
  };

  const saveAndClose = () => {
    setSaveFailed(false);
    closeAfterSave.current = true;
    intakeRef.current?.save();
  };

  return (
    <div
      // Scrim. Clicking it is a close REQUEST, not a close — same as Escape, and
      // for the same reason: a stray click must not be able to throw away a
      // half-answered form.
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "flex-end",
        // The page behind is NOT scroll-locked, deliberately. Setting overflow
        // hidden on <body> is the usual move and it is exactly what this change
        // is meant to stop: removing the scrollbar shifts the layout sideways,
        // which is a visible jump at the moment of opening. A fixed overlay
        // costs the page no height and no scroll offset on its own; the panes
        // below use overscroll-behavior so their own scrolling never chains out
        // to the page.
        animation: "fade 0.14s ease-out",
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${businessName} — questions, client intake and build`}
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: "min(100vw, 560px)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          // Square against the right edge of the screen; rounded where it meets
          // the record it is sitting on top of.
          borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
          borderRight: "none",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          animation: "lg-fade-up 0.16s ease-out",
        }}
      >
        {/* ── Header. Pinned outside the scroll area: whose record this is can
            never be scrolled off screen. ─────────────────────────────────── */}
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "16px 18px 13px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-subtle)",
                marginBottom: 5,
              }}
            >
              Client record
            </div>
            <div
              className="lg-display"
              title={businessName}
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {businessName}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid place-items-center"
            style={{
              flex: "none",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
              cursor: "pointer",
            }}
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Client record sections"
          style={{
            flex: "none",
            display: "flex",
            gap: 4,
            padding: "9px 14px 0",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                // Focus-on-open lands on the SELECTED tab, not always the first
                // one — opening straight onto the build and finding the cursor
                // parked on the intake tab is a half-second of "wait, which one
                // am I on", which is a half-second he does not have on a call.
                ref={active ? firstControlRef : undefined}
                type="button"
                role="tab"
                id={`${ids}-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`${ids}-pane-${t.id}`}
                // The unsaved marker is a bare dot, which a screen reader has no
                // way to announce — so the state rides on the tab's own name
                // instead and the dot below is decoration.
                aria-label={
                  t.id === "intake" && intake.dirty ? "Intake — unsaved answers" : undefined
                }
                onClick={() => setTab(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 12px 9px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  color: active ? "var(--text)" : "var(--text-3)",
                  marginBottom: -1,
                }}
              >
                <Icon size={13} strokeWidth={1.9} />
                {t.label}
                {/* An unsaved answer is visible from the other tab too. He can
                    flip to the build, forget, and reach for Escape. */}
                {t.id === "intake" && intake.dirty && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "var(--warn)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── The three panes ───────────────────────────────────────────────────
            ALL STAY MOUNTED, the inactive ones hidden. Unmounting IntakeForm on
            a tab switch would silently throw away the draft — the exact thing
            the close guard exists to prevent — and it would drop the build's
            fetched state, and re-fetch the guessed count, every time he glanced
            at something else. Hiding also gives each pane its own scroll
            position, so flipping to the build and back puts him at the question
            he was on. */}
        <div
          role="tabpanel"
          id={`${ids}-pane-questions`}
          aria-labelledby={`${ids}-tab-questions`}
          style={paneStyle(tab === "questions", PANE_PAD)}
        >
          {/* The panel exactly as it ships, in its wide presentation. It owns its
              own fetch, its own optimistic single-field PATCH, its own rollback
              and its own re-read — this file adds nothing to that and takes
              nothing away. `layout="panel"` is type scale and one border per
              question; the data path is the one the narrow column used. */}
          <IntakeGaps
            businessId={business.id}
            // Two monotonic counters added together: the host's (a cold audit or
            // pack finishing behind the drawer captured new research) and the
            // drawer's own (the full form was saved). Either one moving moves the
            // sum, which is all reloadKey needs.
            reloadKey={questionsReloadKey + gapsKey}
            density="comfortable"
            layout="panel"
            onAnswered={handleAnswered}
          />
        </div>
        <div
          role="tabpanel"
          id={`${ids}-pane-intake`}
          aria-labelledby={`${ids}-tab-intake`}
          style={paneStyle(tab === "intake", PANE_PAD)}
        >
          <IntakeForm
            business={business}
            density="comfortable"
            successMessage={successMessage}
            // NEVER the form's own copy of the guessed list. It is the tab next
            // door now: two mounted copies would mean two counts that can disagree
            // while one is mid-save, and two live controls for one question.
            showGaps={false}
            onSaved={handleSaved}
            // The form's own footer is replaced by an invisible bridge: the Save
            // button lives in the drawer's pinned footer instead, where sixteen
            // fields of scrolling can never put it out of reach. The bridge
            // exists because the close guard and that button both need
            // save/saving/dirty, which only IntakeForm knows.
            renderFooter={(state) => (
              <IntakeStateBridge state={state} stateRef={intakeRef} onReport={reportIntake} />
            )}
          />
        </div>
        <div
          role="tabpanel"
          id={`${ids}-pane-build`}
          aria-labelledby={`${ids}-tab-build`}
          style={paneStyle(tab === "build", PANE_PAD)}
        >
          <WorkflowPanel businessId={business.id} reloadKey={buildKey} density="comfortable" />
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: "none",
            padding: "11px 18px 13px",
            borderTop: "1px solid var(--line)",
            background: "rgba(255,255,255,0.012)",
          }}
        >
          {confirming ? (
            <ConfirmClose
              saving={intake.saving}
              failed={saveFailed}
              onSaveAndClose={saveAndClose}
              // Discards the FORM'S unsaved draft. The chips on the Questions tab
              // were written the moment they were clicked, so they still go home to
              // the host — hence finish(), not onClose.
              onDiscard={finish}
              onKeepEditing={() => setConfirming(false)}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: intake.dirty ? "var(--warn)" : "var(--text-subtle)",
                  minWidth: 0,
                }}
              >
                {statusLine(tab, intake.saving, intake.dirty, heldBySave)}
              </span>
              {tab === "intake" ? (
                <button
                  type="button"
                  onClick={() => intakeRef.current?.save()}
                  disabled={!intake.dirty || intake.saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    flex: "none",
                    padding: "7px 14px",
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    color: intake.dirty && !intake.saving ? "var(--text)" : "var(--text-4)",
                    background:
                      intake.dirty && !intake.saving ? "rgba(255,255,255,0.05)" : "transparent",
                    border: `1px solid ${
                      intake.dirty && !intake.saving ? "var(--line-strong)" : "var(--line)"
                    }`,
                    cursor: intake.dirty && !intake.saving ? "pointer" : "default",
                  }}
                >
                  {intake.saving && <Loader2 size={12} className="animate-spin" />}
                  {intake.saving ? "Saving…" : "Save intake"}
                </button>
              ) : (
                <button type="button" onClick={requestClose} style={ghostButton}>
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

/**
 * Renders nothing. It is handed to IntakeForm as its footer purely to get at
 * save/saving/dirty, which the form otherwise keeps to itself.
 *
 * Both writes happen in an effect rather than during render: reporting up from
 * inside a child's render phase is the "cannot update a component while
 * rendering another" warning, and it would be a lie anyway — the value has not
 * committed yet. No dependency array on purpose; this needs to run after every
 * commit of the form, and both of the things it does are cheap and idempotent.
 */
function IntakeStateBridge({
  state,
  stateRef,
  onReport,
}: {
  state: IntakeFooterState;
  stateRef: MutableRefObject<IntakeFooterState | null>;
  onReport: (saving: boolean, dirty: boolean) => void;
}) {
  useEffect(() => {
    stateRef.current = state;
    onReport(state.saving, state.dirty);
  });

  // Cleared on unmount so nothing can read a dead form's `dirty` and refuse to
  // close over a draft that no longer exists.
  useEffect(() => {
    const ref = stateRef;
    return () => {
      ref.current = null;
    };
  }, [stateRef]);

  return null;
}

/**
 * The unsaved-draft prompt. Inline in the footer rather than a second overlay:
 * stacking a modal on top of a drawer, mid-call, to ask a one-line question is
 * how a fast tool starts feeling like paperwork.
 *
 * Three answers, and all three are real. "Discard" is the escape hatch and it is
 * spelled out rather than implied — he is the one who decides an answer was
 * wrong.
 */
function ConfirmClose({
  saving,
  failed,
  onSaveAndClose,
  onDiscard,
  onKeepEditing,
}: {
  saving: boolean;
  failed: boolean;
  onSaveAndClose: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>
        {saving ? (
          "Saving your answers — the drawer closes as soon as they land."
        ) : failed ? (
          <>
            <strong style={{ color: "var(--danger)" }}>That save didn&apos;t land.</strong> Nothing
            was written. Try again, or close and lose the answers you just typed.
          </>
        ) : (
          "Answers on this form haven't been saved yet. Closing now loses them."
        )}
      </span>
      {!saving && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onDiscard} style={ghostButton}>
            Discard &amp; close
          </button>
          <button type="button" onClick={onKeepEditing} style={ghostButton}>
            Keep editing
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "var(--money)",
              background: "var(--money-soft)",
              border: "1px solid color-mix(in oklch, var(--money) 35%, transparent)",
              cursor: "pointer",
            }}
          >
            Save &amp; close
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

/** One padding for all three panes. It used to be picked by a `density` prop that
 *  neither host ever passed: "compact" existed because the intake form used to be
 *  crammed into a third of a Library row, and in here there is 560px and a client
 *  talking. Both hosted components are handed "comfortable" for the same reason. */
const PANE_PAD = "15px 18px 20px";

/** A pane fills the space between the tabs and the footer and scrolls INSIDE
 *  it. `minHeight: 0` is what actually makes that true — without it a flex child
 *  refuses to shrink below its content and the whole drawer grows instead.
 *  `overscrollBehavior: contain` stops a flick at the end of the form from
 *  carrying on into the page behind. */
function paneStyle(active: boolean, padding: string): CSSProperties {
  return {
    display: active ? "block" : "none",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding,
  };
}

const ghostButton: CSSProperties = {
  padding: "7px 13px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: "inherit",
  color: "var(--text-2)",
  background: "transparent",
  border: "1px solid var(--line)",
  cursor: "pointer",
};

/** One line, always true. The unsaved warning follows him onto the other two tabs,
 *  because that is where he is standing when he reaches for Escape. */
function statusLine(
  tab: ClientDrawerTab,
  saving: boolean,
  dirty: boolean,
  heldBySave: boolean
): string {
  if (saving) {
    return heldBySave ? "Still saving — this stays open until the answers land." : "Saving…";
  }
  if (dirty) {
    return tab === "intake" ? "Unsaved answers." : "Unsaved answers on Intake.";
  }
  // Both of these save on click, so neither pane has anything to lose — and both
  // say so, because a screen with a Save button on one tab and none on another
  // otherwise reads as a missing button.
  if (tab === "questions") return "Every answer saves the moment you click it.";
  if (tab === "build") return "Every switch saves the moment you flip it.";
  return "Everything on this form is saved.";
}
