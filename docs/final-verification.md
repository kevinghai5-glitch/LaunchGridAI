# Final verification — what the software now guarantees, and how to check it yourself

Written for the person who sells this, not for a developer. Every list below was
produced by running the code, not by typing it out, and `npm run verify:phase4`
re-checks this document against the code on every run — so if somebody changes a
question on the intake form and forgets this page, the suite fails.

Last regenerated against the code on 2026-07-28.

---

## 1. The questions a client has to answer for the report to stop guessing

The report grades every finding one of three ways:

| Grade | What it means | How it reads on the page |
|---|---|---|
| **observed** | We measured it ourselves off their public pages. | Stated as fact, with the measurement cited. |
| **disclosed** | They told us, at intake. | Stated as fact, but **attributed** — "you told us…". |
| **inferred** | Neither. We are describing a pattern. | Hedged, and labelled as a pattern we did not measure. |

Twelve questions decide the difference between *inferred* and *disclosed*. Answer
all twelve and every leak that **can** stop guessing does. This list is generated
by `intakeFieldsForZeroInferred()` in `src/lib/leak-taxonomy.ts`, and the wording
is verbatim from the intake form — so you can read it down the phone.

| # | Question, as the form asks it | Field | What answering it settles |
|---|---|---|---|
| 1 | How fast does a new enquiry usually get a reply? | `responseSpeed` | slow_speed_to_lead |
| 2 | What happens when you miss a call? | `missedCallHandling` | missed_calls_no_recovery |
| 3 | What happens when someone calls after hours? | `afterHoursHandling` | no_after_hours_coverage |
| 4 | How do they book right now? | `bookingMethod` | no_online_booking |
| 5 | Systems they already have — Automated follow-up | `hasFollowUpSequence` | no_follow_up_sequence, no_long_cycle_nurture |
| 6 | Systems they already have — Appointment reminders | `hasReminderSystem` | no_show_exposure |
| 7 | Systems they already have — CRM / lead pipeline | `hasCrm` | no_crm_pipeline |
| 8 | When did you last contact past customers or old quotes? | `pastCustomerContact` | no_database_reactivation |
| 9 | Who replies to your Google reviews right now? | `reviewReplyOwner` | no_review_replies |
| 10 | Do enquiries come in through Instagram or Facebook messages? | `socialEnquiries` | social_dm_unmanaged |
| 11 | Do you track calls, answered vs missed, today? | `hasCallTracking` | no_call_tracking |
| 12 | Can a customer pay or leave a deposit online today? | `hasOnlinePayment` | payment_booking_friction |

**One question does double duty.** Question 5 settles two leaks — the follow-up
on an unbooked quote, and the longer sequence for the ones who say "not this
year". Everything else is one question, one leak.

**Two questions the form asks that are NOT on this list, and why.** `takesDeposits`
("Do you take a deposit or payment before the work is done?") and
`hasPastCustomerDatabase` ("Is there a list of past customers?") do not settle a
finding — they decide whether a **workflow** belongs in the build at all. They
still matter; they just answer a different question.

---

## 2. The leaks that still have no evidence source

Answering all twelve clears every leak that a question **can** clear. Four
findings stay outside that list, and this is the honest reason for each:

| Leak | Why no question is asked |
|---|---|
| `no_webchat` — No website chat capture | **We measure it.** The scan sees whether a chat widget is on the page, so there is nothing to ask. It grades *observed*. |
| `no_lead_qualification` — No lead qualification at intake | **We measure it.** The scan reads the form's fields. It grades *observed*. |
| `weak_landing_cta` — Weak landing page conversion path | **We measure it.** The scan reads the calls to action on the page. It grades *observed*. |
| `low_review_velocity` — Review volume behind local competitors | **We measure it.** Review counts come off the listing, ours and the competitors'. It grades *observed*. |

**So the answer to "which leaks still have no evidence source" is: none.** Every
one of the seventeen in-scope findings is either something we measure ourselves
or something one of the twelve questions settles. That was not true before this
programme: social DMs and the dormant past-customer list used to be permanent
guesses, and each got the one question that could actually settle it
(`socialEnquiries`, `pastCustomerContact`).

There is a fifth leak with no question — `oos_slow_site_speed` — and it is
deliberately **out of scope**. Site speed is not part of a conversion engagement.
It is reported as context and never as a project.

---

## 3. The 60-day follow-up: the Asset Pack matches the workflow, step for step

The Conversion Asset Pack (D3) contains seven emails and six texts. The build
contains one workflow — **Lead Nurture — No Booking** — with thirteen steps. The
worry is that these two drift: the operator pastes seven emails into a workflow
that only has five slots, or the sequence stops before the workflow does.

They do not drift, because the Asset Pack reads its day numbers and step numbers
off the same list the workflow is built from (`NURTURE_SEQUENCE`). Here is the
whole mapping, printed:

| Workflow step | Asset Pack piece | Day | What it is for |
|---|---|---|---|
| 1 | Text 1 | 1 | Short nudge — pick the conversation back up and offer a time |
| 2 | Email 1 | 2 | What you do and what happens next, with the booking link |
| 3 | Text 2 | 4 | One question that is easy to answer, to restart the thread |
| 4 | Email 2 | 7 | How the job actually runs — remove the uncertainty that stalls people |
| 5 | Text 3 | 11 | Offer to answer the one thing holding them up |
| 6 | Email 3 | 16 | Local proof — real reviews and real work, no invented names |
| 7 | Text 4 | 23 | Timing check — is this still on the list this season? |
| 8 | Email 4 | 30 | What drives the price, honestly, so cost stops being a mystery |
| 9 | Text 5 | 38 | Availability nudge, no pressure and no invented deadline |
| 10 | Email 5 | 45 | The usual reason people wait, answered straight |
| 11 | Text 6 | 52 | Last text — a direct, warm ask |
| 12 | Email 6 | 58 | Final email — the straight ask with the booking link |
| 13 | Email 7 | 60 | Close-out — we stop here, the door stays open, and the deal moves to Lost |

**Thirteen steps, thirteen assets, sixty days, nothing left over on either side.**
The sequence stops the moment the customer replies or books, and on day 60 the
deal moves to Lost — it is not deleted, and the same person comes back in as a
new lead the day they get in touch again.

---

## 4. The three fixture clients

`npm run fixtures:clients` writes three complete, invented clients into
`_fixtures/clients/`. Every one gets the four paid deliverables plus the free
cold audit, and every one passes the same validator a paying client's pack has to
pass. Nothing in them traces to a real business: reserved `.example` domains,
`555-01xx` phone numbers, invented reviews and invented competitors.

They exist so the three situations a client actually arrives in can be read side
by side:

| Fixture | What it demonstrates | Result |
|---|---|---|
| `01-pre-sale-cedar-ridge-plumbing` | Public data only — no intake, nothing they told us. | 10 leaks: **3 observed, 0 disclosed, 7 inferred**. Every cover carries the "generated without client intake" marker. |
| `02-full-intake-harbourline-electric` | Every question on the form answered. | 13 leaks: **5 observed, 8 disclosed, 0 inferred**. The hedging is gone; the gaps they confirmed are attributed to them. |
| `03-toggled-pinecrest-roofing` | Full intake, plus three workflows switched off by hand. | 14 leaks: **5 observed, 9 disclosed, 0 inferred** — and the build is visibly smaller: 11 of 14 workflows, and the Conversion Asset Pack carries 6 workflow copy tables instead of 9 (Text-to-Pay, Database Reactivation and Review Response are gone from the document, not just from the switchboard). |

Read `01` against `02` and you can see exactly what the intake form buys you: the
same scan, the same site, and seven hedged "this is the industry pattern"
findings turning into eight "you told us" findings. That is the difference
between a document a sceptical owner argues with and one he recognises.

---

## 5. What I found that contradicts the stated business model

Four things. The first three are real defects the fixture matrix uncovered; the
fourth is a tidy-up. **None of the four is in a file this pass was allowed to
edit**, so all four are written down here rather than fixed. Each one has the
exact change beside it.

### 5.1 A client who answers the WHOLE intake form cannot be sent a pack

**Where:** `src/lib/exporters/index.ts`, in `validateRenderedDeliverables`.

**What happens:** the export gate demands one "we'll verify this at kickoff — if
you already have this covered, it comes off the list" line for every finding that
came from an industry pattern. That sentence exists to hedge something we have
**not** had confirmed. The moment a client confirms one of those gaps on the
intake form, the sentence must come off — asking a question they already answered
in the document they paid for is an insult, and the pack validator agrees: it
holds confirmed and unconfirmed findings to opposite rules.

But the export gate still counts **all** of them. So a fully-answered intake
produces zero kickoff lines against eight or nine findings, the gate blocks, and
`buildAssetZipChecked` refuses to hand over the ZIP.

**Why it was never caught:** the golden sample's intake is deliberately partial,
so all seven of its pattern-findings are still hedged and the gate is satisfied.
The full-intake fixture is the first artifact in the repo that answers everything.

**The fix, one line:**

```ts
// src/lib/exporters/index.ts
const benchmarkLeaks = (pack.intelligence?.leakAnalysis ?? [])
  .filter((l) => l.evidenceTier === "BENCHMARK" && !l.intakeConfirmed);
//                                                 ^^^^^^^^^^^^^^^^^^^^ add this
```

**Until then:** `scripts/make-fixture-clients.ts` runs a corrected version of the
rule in place of the stale one — stricter, because it also checks the half the
old rule never looked at (that a confirmed finding attributes the claim to the
client and does *not* re-ask the question) — and prints the override on every run
so it cannot be quietly forgotten.

### 5.2 A pre-intake dollar figure can print without saying it is an estimate

**Where:** `src/lib/leak-narrative.ts`, the `after_hours_value` branch of
`computeMathEstimate`.

**What happens:** before a client gives us any numbers, the after-hours estimate
is a slice of the missed-call estimate, and both run on an **assumed** enquiry
volume. The sentence that shows the working comes out as

> CAD $487–CAD $487/mo missed-call exposure × 28% arriving after hours = CAD $136/mo

with nothing in it saying the volume was our assumption — which the pack
validator correctly refuses ("E3 · label assumed $"). The same line also prints a
pointless "X–X" range, because in that mode the low and high are the same number.

Every other figure in the chain carries its label. This one inherits its
neighbours' labels for the volume and the customer value but builds its own
working-out line without one.

**The fix:** carry the assumption caveat into the `formula` string in that
branch, and collapse the range when low equals high — the same way the frame
above it already does.

**Until then:** the pre-sale fixture's synthetic site carries a chat widget, which
means the after-hours finding does not fire for that client. That is a dodge and
it is labelled as one in the fixture script. It still exercises the pre-intake
maths on missed calls, whose working-out line **is** labelled correctly.

### 5.3 The go-live day plan never reaches the client's document

**Where:** `src/lib/exporters/deliverables.ts`, the D4 (timeline) renderer.

**What happens:** the roadmap's middle phase carries a **go-live block** — what
switches on that day, the short honest list of what you need from the owner
(forward the number, confirm the hours, get the chat snippet onto the site, hand
over the past-customer list), and the plain test that settles whether it is
actually live. It is generated, saved on the pack, and validated. It is printed
nowhere.

So the one page in D4 that tells a client what go-live day looks like — and what
they have to do for it — does not exist in the document they receive. On the day,
that list gets read out on a call instead, which is unbilled work and the sort of
thing that slips.

**Why it was never caught:** the suite asserted the block **exists on the pack**,
never that it **reached a page**. That is the exact failure the "generated ⇒
rendered" section was written for, one field further along than it was looking.

**Also missing from D4:** `workflowsInThisWindow` — the list naming which
workflows go live in which window. That is precisely what makes a *smaller* build
visible in the schedule: the toggled fixture client has eleven names in those
windows instead of fourteen, and the timeline document shows neither number. The
reduced build is visible in the Conversion Asset Pack (six workflow copy tables
instead of nine) but not in the schedule.

**The fix:** render both in D4 — the go-live block on the middle phase, and the
workflow list under each window.

**Now guarded:** `npm run verify:phase3` grew a check (`G3`) that names both gaps
explicitly and fails if a **third** roadmap field ever starts being dropped. It
also proves the two prices really do reach the page, so the one exemption on that
list that is a *reformat* rather than a loss cannot hide a loss.

### 5.4 One heading exists in two places

**Where:** `src/app/a/[publicId]/page.tsx` declares its own
`const SCAN_SECTION_LABEL = "What a scan can see from out here"`, and
`src/lib/exporters/cold-audit-html.ts` now exports the same string.

Every other word the emailed document and the public teaser share is imported
from one place, on purpose: a prospect reads those words in the pre-call email
and then hears them out of your mouth on the Zoom, and that match is the whole
effect. This one heading is a second copy that can drift. The suite currently
reads the literal out of the page and asserts it is byte-identical to the
exported one, so a drift fails — but the right fix is to delete the local copy
and import it.

**Nothing else contradicted the model.** Specifically checked and clean: no
document anywhere recommends ads, SEO, lead generation or "more traffic"; nothing
proposes building, rebuilding or redesigning a website; the one page the pack
promises to build is the booking page; the qualification engine is priced in the
monthly retainer and never inside the one-time build; and every dollar figure a
prospect can see carries the CAD marker in front of it.

---

## 6. How to check this yourself

Run these from the repo root. Each one is offline — no network, no database, no
API key — and each prints what it checked before it says whether it passed.

| Command | What it proves |
|---|---|
| `npm run verify:all` | **The whole thing.** Runs everything below plus the typecheck and the unit tests, in order, and stops at the first failure. This is the one to run before you send anything to a client. |
| `npm run typecheck` | The guarantees that are compile errors rather than tests. Two matter most: a pre-sale document is structurally incapable of carrying anything the client told us, and the free audit's generator cannot be handed an intake field even by copy-paste. |
| `npm run verify:phase4` | The free cold audit behaves like the credibility beat it now is: the "this is the smaller half" frame lands before any finding, the six invisible leaks are asked in your own phone words on both the document and the teaser link, there is exactly one ask and it books the call, nothing is claimed as disclosed before the sale, unmeasured findings read as patterns, every dollar figure says it is a benchmark, nothing recommends work you do not sell, and the public proposal page never shows a bare dollar sign. |
| `npm run verify:phase3` | The four paid documents agree with each other: the report's total is bounded and says so, the pipeline in the Blueprint is the pipeline in the build, every asset in the Asset Pack names the box it goes in, and the schedule prices the fortnight and the months separately. |
| `npm run verify:phase1` | Every finding carries where it came from, and that grade — not the wording — decides how flatly it may be written. |
| `npm run verify:phase2` | The fourteen workflows, and what switches each one off. |
| `npm run verify:intake` | Every intake question, and what each answer changes. |
| `npm run fixtures:clients` | Rebuilds the three fixture clients from scratch and refuses to write any of them that does not pass its own laws. Re-running it produces byte-for-byte identical files, so a change in the output is always a change in the code. |
| `npm run sample:golden` | Rebuilds the committed golden pack the same way. |

**Reading a failure.** Every check prints its inputs and its outputs above the
PASS/FAIL line, and the failure message says what was expected and what happened
instead. A failing check is not necessarily a bug in the code — sometimes the
code changed for a good reason and the check is now describing the old truth. The
rule in this repo is that a stale check gets **replaced with a stronger one that
states the new truth**, never deleted and never softened.

**What is in `_fixtures/`.** Everything there is invented. Reserved `.example`
domains, `555-01xx` phone numbers, invented reviews, invented competitors. A
fresh clone of this repo runs `verify:all` and exits clean without a single real
client's data anywhere in it.
