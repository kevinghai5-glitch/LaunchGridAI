# Detector checkability manifest

> **STATUS NOTE (2026-08-01).** The pre-sale surface this manifest was written
> against — the free cold audit, its renderer and its public teaser — was
> deleted on 2026-07-29, by ruling, after a third fabrication in a real
> document ("do not improve the cold audit instead of deleting it"). The
> detection layer this manifest catalogues survives in full, so the manifest
> now governs only the PAID Growth Leak Report and the non-generative
> observed-facts row: `CA` in the master table marks membership in the
> most-provable top-3 pool (`selectColdAudit`), which the paid pack threads
> through as pre-call context — no free document reads it any more. File
> references to `cold-audit-html.ts` and `/a/[publicId]` below are history,
> kept because they explain why the rules exist.

**What this file is for.** A real cold audit for a real law-firm prospect shipped this as finding 01:

> "No clear call to action on your homepage — Critical
> Measured on your public pages, 7/29/2026
> 'Visitors arrive on your homepage but face no clear direction on what to do next. There's no primary action above the fold, and your phone number is buried.'"

The business visibly has both. Two separate defects produced that sentence, and this manifest exists so agents B, C and D fix the right one:

- **Bug A — the detector should not have fired.** `weak_landing_cta` reason 1 asks "is there a clear primary action above the fold", which is an interpretive judgment. What the code actually computes is a 13-phrase regex over the first 1500 characters of the homepage's *markdown*. Markdown has no fold. See row 7 and `hasPrimaryCtaAboveFold` in the ledger.
- **Bug B — the sentence was never measured at all.** Nothing in `ScrapeData` contains "your phone number is buried" or "no primary action above the fold". The only string the detector produced was `"No clear primary CTA above the fold on the homepage"`. The rest was written by the model and then stamped `Measured on your public pages` by `gradeLabel()` (`src/lib/exporters/cold-audit-html.ts:613`), which reads the grade — and the grade certifies **that a detector fired**, not that the sentence is true.

The click-to-call clause is the proof that Bug B is the dangerous one. `hasClickToCallOnMobile` was almost certainly `PRESENT` for that firm (a `tel:` header link fingerprints on `/href=["']tel:/i`), which is *why* reason 3 did not fire — the reasons array would have carried "Phone number is not click-to-call" if it had. So the document asserted the exact opposite of what the detector measured, under a label claiming we measured it, and no gate in the system can catch that: `statGuard` (`src/lib/leak-narrative.ts:878`) validates numbers only, and the pack validator checks vocabulary, dollar labelling and tier-voice consistency. None of those can tell whether a sentence about a website is true.

**Preserved verbatim, do not touch:** the outside/inside frame at the top, the grade labels themselves (`Measured on your public pages` beside `Industry pattern — not measured for you`), the pivot section's six phrases and questions, and opening on a real observed positive about their reviews. The fix is what is allowed to *earn* the "measured" label, not the label.

---

## How to read this

**Verdict vocabulary** — four values, used in the master table and in the JSON handoff:

| Verdict | Meaning | Consequence |
|---|---|---|
| `HARD` | Every claim the leak may make is anchored in a field with ground truth behind it, and the leak has an `OBSERVED` detection branch. | May be graded `observed`. May appear pre-sale. Bind copy to the listed values. |
| `HARD — no OBSERVED branch` | The inputs are ground truth, but the leak has no `OBSERVED` tier at all, so `gradeOf()` can never return `observed` for it. The claim is about an internal mechanism. | Structurally barred from the "measured" label already. May appear pre-sale only in the hedged/pattern voice. Still needs evidence binding, because the `EVIDENCED` branch quotes real review fragments. |
| `INTERPRETIVE` | At least one detection reason requires visual or editorial judgment, or the computed value has no ground truth behind it despite being a boolean. | May **never** be graded `observed`. Must **not** appear in a pre-sale artifact. Narrow it or remove it. |
| `NEEDS A DECISION` | I cannot classify it confidently — the claim is checkable in principle but the code does not check it, and the remedy is a product choice (fix the measurement vs. narrow the sentence). | Read the per-leak block. Do not guess. |

**Provenance codes** — appended to every field path. This is the distinction that matters: a boolean named `hasPrimaryCtaAboveFold` is not ground truth just because it is a boolean.

| Code | Means | Trust |
|---|---|---|
| `M` | **Measured value.** A number or flag reported by an outside system that owns the fact (PageSpeed's Lighthouse run, Google's review count, DataForSEO's `book_online_url` / `work_time`), or a deterministic parse of such a value. | State it. Cite it with its source and date. |
| `F` | **Fingerprint over markup.** A regex or substring match against the post-JS DOM looking for a specific, named artifact (`<form`, `href="tel:`, a provider host from a closed list). A positive match is proof-positive. A negative match is only "none of the things we look for were found". | State a `PRESENT` flatly. State an `ABSENT` **only** scoped to the fingerprint list. |
| `P` | **Parsed guess.** A boolean produced by a heuristic that stands in for a judgment the code cannot make — position on a page, quality of a call to action, what a form asks. No ground truth exists behind the value. | Never state as measured. Section 4 lists every one of these. |
| `H` | **Heuristic over page text.** A regex over prose from anywhere in the scraped corpus, used to answer a question about a specific element or behaviour. Wrong in both directions and not scoped to the thing it claims to describe. | Never state as measured. |
| `I` | **Intake answer.** The client told us. | `disclosed` voice: declarative but attributed. Impossible pre-sale. |
| `C` | **Classification.** A regex bucket over a category string. | Fine internally; never a client-facing claim. |

All field paths below are on `ScrapeData` (`src/lib/leak-taxonomy.ts:68`) unless stated. Detectors live in `DETECTORS`, `src/lib/leak-detection.ts:564`.

---

## 1. The master table

`CA` = the leak is in `deliverableTargets: ["cold_audit", …]`, i.e. it can reach a stranger's inbox on a free document.

| # | Leak id / name | CA | Exact `ScrapeData` fields read (with provenance) | Verdict | Action |
|---|---|---|---|---|---|
| 1 | `slow_speed_to_lead` — Slow response to web leads | CA | `intake.responseSpeed` `I` · `website.hasContactForm` `F` · `googleReviews.reviewTexts[]` `M` (vs `REVIEW_SIGNALS.slowResponse`, ≥2 distinct) · `website.hasChatWidget` `F` · `website.pageText.contact ?? website.pageText.home` `H` (`promisesInstant` regex) | `HARD — no OBSERVED branch` | Keep. Bind the review count + fragments; never state a response time. |
| 2 | `missed_calls_no_recovery` — Missed calls with no recovery | CA | `intake.missedCallHandling` `I` · `googleReviews.reviewTexts[]` `M` (vs `missedCalls`, ≥2) · `business.phone` `M` · `website` existence · `website.mentionsTextingOption` `H` | `HARD — no OBSERVED branch` | Keep. Never assert a missed-call rate for *them*; the stat is the industry's. |
| 3 | `no_after_hours_coverage` — No after-hours capture | CA | `intake.afterHoursHandling` `I` · `gbp.limitedHours` `M` · `gbp.hoursListed` `M` · `website.hasOnlineBookingLink` `F` · `website.hasChatWidget` `F` · `!website` | `HARD` | Keep observed. **Narrow the absence half** to the fingerprint list (see 3.3). |
| 4 | `no_online_booking` — No online booking path | CA | `website` existence · `gbp.hasBookingLink` `M` · `website.hasOnlineBookingLink` `F` · `intake.bookingMethod` `I` | `HARD` | Keep observed. **Narrow** — and fix the symptom string's "the only way is to call" (3.4). |
| 5 | `no_webchat` — No website chat capture | — | `website` existence · `website.hasChatWidget` `F` | `HARD` | Keep. Assertion must stay "no widget among the providers we fingerprint". |
| 6 | `no_lead_qualification` — No lead qualification at intake | — | `website.hasContactForm` `F` · `website.formHasQualifyingFields` `H` · `website.hasChatWidget` `F` | `NEEDS A DECISION` | The `OBSERVED` branch grades to `observed` on a field that never inspects the form. Fix the measurement or drop the branch (3.6). |
| 7 | `weak_landing_cta` — Weak landing page conversion path | **CA** | `website` existence · `website.scanConfident` `P` · `website.hasPrimaryCtaAboveFold` `P` · `website.servicePagesHaveCtas` `P` · `website.hasClickToCallOnMobile` `F` | **`INTERPRETIVE`** | **This is the bug.** Remove `cold_audit` from its targets; split the detector so only the `tel:` reason survives as observable (3.7). |
| 8 | `no_follow_up_sequence` — No structured follow-up | CA | `intake.hasFollowUpSequence` `I` · `googleReviews.reviewTexts[]` `M` (vs `noFollowUp`, ≥2) | `HARD — no OBSERVED branch` | Keep. Its unconfirmed evidence string already names itself an industry pattern — preserve that wording. |
| 9 | `no_show_exposure` — No-show exposure | — | `intake.hasReminderSystem` `I` · `googleReviews.reviewTexts[]` `M` (vs `schedulingFriction`, ≥2) · `business.industry` `C` | `HARD — no OBSERVED branch` | Keep. |
| 10 | `no_crm_pipeline` — No pipeline | — | `intake.hasCrm` `I` — nothing else | `HARD — no OBSERVED branch` | Keep. See 5.5: a visible CRM fingerprint exists and is ignored. |
| 11 | `no_database_reactivation` — Dormant customer database | — | `intake.hasPastCustomerDatabase` `I` · `intake.pastCustomerContact` `I` · `googleReviews.count >= 20` `M` | `HARD — no OBSERVED branch` | Keep. `count` is real; the dormancy inference is not, and the evidence string says so. |
| 12 | `no_long_cycle_nurture` — No long-cycle nurture | — | `intake.hasFollowUpSequence` `I` — nothing else | `HARD — no OBSERVED branch` | Keep. |
| 13 | `low_review_velocity` — Review volume behind competitors | CA | `googleReviews` existence · `googleReviews.count` `M` · `competitors[].reviewCount` `M` (median of the `>0` counts) | `HARD` | Keep observed. **The numbers are real and the label on them is wrong** — `competitors` is the top 3 *by rating*, not a market sample (3.13). |
| 14 | `no_review_replies` — Reviews going unanswered | — | `intake.reviewReplyOwner` `I` — nothing else, by design | `HARD — no OBSERVED branch` | Keep. Cannot fire pre-sale by construction. |
| 15 | `social_dm_unmanaged` — Social DMs outside the system | — | `intake.socialEnquiries` `I` · `website.linksToFacebook` `M` · `website.linksToInstagram` `M` | `HARD — no OBSERVED branch` | Keep. Channel presence is a real link parse; response behaviour must stay hedged. |
| 16 | `no_call_tracking` — No visibility into call performance | — | `intake.hasCallTracking` `I` — nothing else | `HARD — no OBSERVED branch` | Keep. |
| 17 | `payment_booking_friction` — Friction between 'yes' and paid | — | `intake.hasOnlinePayment` `I` · `business.industry` `C` — **no scan of any kind** | `HARD — no OBSERVED branch` | Keep. Its evidence string already says we never scanned for it; do not soften that. |
| 18 | `oos_slow_site_speed` — Slow site performance | — | `pageSpeed.mobileScore` `M` · `pageSpeed.lcpSeconds` `M` | `HARD` | Keep. The cleanest observed leak in the file. |

**Counts.** 18 leaks, 18 detectors, no orphans either way. 5 `HARD` (rows 3, 4, 5, 13, 18), 11 `HARD — no OBSERVED branch` (1, 2, 8, 9, 10, 11, 12, 14, 15, 16, 17), 1 `INTERPRETIVE` (7), 1 `NEEDS A DECISION` (6).

**The only leaks that can ever be graded `observed`** — the only ones with an `OBSERVED` tier a detector can actually reach, and therefore the entire blast radius of this fix: `no_after_hours_coverage`, `no_online_booking`, `no_webchat`, `no_lead_qualification`, `weak_landing_cta`, `low_review_velocity`, `oos_slow_site_speed`. Every other row in the table is already structurally incapable of printing "Measured on your public pages" (`gradeOf()` returns `observed` only for `tier === "OBSERVED"`). Of those seven, **two need work** — `weak_landing_cta` (the bug) and `no_lead_qualification` (needs a decision). The other five stay observed with narrowed wording.

---

## 2. Evidence binding — the permitted values, per leak

This is the column agents B and C implement from. For each leak: the exact values a finding may reference, and the exact assertions it may make. Anything not listed is fabrication, including anything the model can infer from the leak's `symptom` string (see 5.1 — the symptom is a fabrication channel and must be treated as untrusted prose, not as evidence).

### 2.1 `slow_speed_to_lead`
- May reference: `googleReviews.reviewTexts` **count of distinct matching reviews** (`number`, ≥2) and up to 3 fragments of ≤10 words each, already quoted in `FiredLeak.evidence`; `website.hasContactForm === "PRESENT"`; `website.hasChatWidget` (`"PRESENT" | "ABSENT" | "UNKNOWN"`).
- Permitted assertions: "N reviews mention slow or no response" + the fragments. "A contact form is present, with no chat widget and no visible response-time commitment."
- Forbidden: any hours/days figure attributed to *them*; "you take 42 hours" (that is `speed_avg_response_42h`, an industry average, and must be labelled as one).

### 2.2 `missed_calls_no_recovery`
- May reference: distinct matching-review count (`number`, ≥2) + fragments; `business.phone` (`string`, presence only); `website.mentionsTextingOption` (`boolean`).
- Permitted assertions: "N reviews mention unanswered or missed calls" + fragments. "A phone line with no visible text-back or missed-call recovery path" — *visible* is load-bearing and must survive rephrasing.
- Forbidden: a missed-call count or rate for this business. `missed_rate_by_industry` is the industry's number and must carry its source tag.

### 2.3 `no_after_hours_coverage`
- May reference: `gbp.limitedHours` (`boolean`, parsed from Google's `work_time` timetable); `gbp.hoursListed` (`boolean`); `website.hasOnlineBookingLink` and `website.hasChatWidget` (`Tri` — only `"ABSENT"` licenses a factual absence).
- Permitted `OBSERVED` assertion (narrowed): **"Your Google hours show evenings and weekends closed, and we found no booking link or chat widget on the pages we scanned."** Note the two halves have different provenance and the sentence keeps them apart: the hours are Google's data, the absence is bounded by our fingerprints.
- Forbidden: "nothing reaches an after-hours caller", "calls go unanswered at night", or any claim about what actually happens to one. That is `afterHoursHandling`, an intake answer, and it does not exist pre-sale.

### 2.4 `no_online_booking`
- May reference: `website.hasOnlineBookingLink` (`Tri`); `gbp.hasBookingLink` (`boolean`, `Boolean(item.book_online_url)` from DataForSEO).
- Permitted `OBSERVED` assertion (narrowed): **"No online booking link on the site or the Google Business Profile."** Present tense, scoped, already the shipped evidence string — keep it verbatim.
- Forbidden: "the only way to become a customer is to call" (the leak fires happily on sites that have a contact form — see 3.4); any claim about how many steps, scrolls or clicks anything takes; naming a scheduler we did not detect.
- Contract note for B: if a finding should be able to name the scheduler it *did* find, `AuditIntelligence.website.bookingProviders: string[]` exists but is **not** carried onto `ScrapeData`. Widening the contract is a separate, additive change.

### 2.5 `no_webchat`
- May reference: `website.hasChatWidget` (`Tri`).
- Permitted `OBSERVED` assertion: **"No live-chat or webchat widget detected on the pages we scanned."** "detected" is load-bearing: `CHAT_PROVIDERS` (`src/lib/audit-intelligence.ts:114`) is a closed list of 12 hosts. Olark, Freshchat, Chatra, Smartsupp, JivoChat, Weave, Hatch, Chatwoot and LeadConnector's own widget are **not** on it and all read as `ABSENT`.

### 2.6 `no_lead_qualification`
- May reference *today*: `website.hasContactForm` (`Tri`), `website.formHasQualifyingFields` (`boolean` — **do not describe this as measured**), `website.hasChatWidget` (`Tri`).
- See 3.6. Until the measurement is fixed, the only defensible assertion is the `BENCHMARK` one that already ships ("No confirmed form or chat capture — intake likely runs through the phone… verified at kickoff").

### 2.7 `weak_landing_cta`
- May reference *after the fix*: `website.hasClickToCallOnMobile === "ABSENT"` and nothing else.
- Permitted assertion, and the only one: **"No `tel:` link found anywhere in the HTML of the pages we scanned."** That is checkable, falsifiable in one browser inspection, and it is what `/href=["']tel:/i` over the rawHtml corpus actually establishes.
- **Forbidden outright, at any grade, in any deliverable:** "no primary action above the fold", "buried", "hard to find", "three scrolls down", "the page doesn't tell visitors what to do", "generic contact us", "weak hero", or any statement about where something sits on a page. We render no page and measure no position. `hasPrimaryCtaAboveFold` and `servicePagesHaveCtas` may not be cited, quoted, paraphrased or alluded to in client-facing copy.
- The name of the field is not evidence. `hasPrimaryCtaAboveFold` is a 13-phrase regex over 1500 characters of markdown.

### 2.8 `no_follow_up_sequence`
- May reference: distinct matching-review count (≥2) + fragments; `intake.hasFollowUpSequence` when disclosed.
- Permitted assertions: "N reviews mention no follow-up or a promised quote that never arrived" + fragments. Unconfirmed, the shipped evidence string is itself the permitted sentence and it names itself an industry pattern — do not compress that clause away.

### 2.9 `no_show_exposure`
- May reference: distinct matching-review count (≥2) + fragments; `business.industry` ∈ {`dental`, `med_spa`, `law`}; the vertical's `STATS` no-show range (conservative end only).
- Forbidden: a no-show rate for this business.

### 2.10 `no_crm_pipeline` · 2.12 `no_long_cycle_nurture` · 2.16 `no_call_tracking`
- May reference: nothing but the intake answer, or nothing at all. Each already ships a `BENCHMARK` string that states out loud it is an industry pattern rather than an observation. Those strings are the permitted sentences.

### 2.11 `no_database_reactivation`
- May reference: `googleReviews.count` (`number`) as evidence of *operating history only*; `intake.pastCustomerContact` when disclosed.
- Forbidden: a list size, a dormancy period, or any figure about their database.

### 2.13 `low_review_velocity`
- May reference: `googleReviews.count` (`number`), `googleReviews.rating` (`number`), `competitors[].name` (`string`), `competitors[].reviewCount` (`number`), `competitors[].rating` (`number`), and the computed median.
- Permitted assertion (narrowed): **"N reviews, against a median of ~M across the highest-rated nearby businesses we pulled."** The sample must be named — see 3.13.
- Forbidden: "nobody asks them for a review" (an internal claim, never measured, and it is sitting in the leak's own `symptom` string); "the competitor down the street adds ten a month" (also from the symptom string — a fabricated velocity; `recentCount90d` is never even read by this detector); any per-month velocity figure at all.

### 2.14 `no_review_replies` · 2.15 `social_dm_unmanaged` · 2.17 `payment_booking_friction`
- May reference: the intake answer, plus (for `social_dm_unmanaged`) `website.linksToFacebook` / `website.linksToInstagram` (`boolean`, from parsed link hosts) as **channel presence only**.
- Forbidden: reply rates, DM response times, deposit-handling descriptions. `payment_booking_friction` scans nothing whatsoever and its evidence string says so.

### 2.18 `oos_slow_site_speed`
- May reference: `pageSpeed.mobileScore` (`number`, 0–100), `pageSpeed.lcpSeconds` (`number`, one decimal), both mobile strategy.
- Permitted assertion: the shipped string — "Mobile PageSpeed N/100, LCP Xs" — plus the date of the run.
- Contract note for B: the owner named CLS as a hard signal. `PsiResult.metrics.cls`, `.inpMs`, `.fcpSeconds`, `.ttfbMs` are all fetched (`src/lib/pagespeed.ts`) but `ScrapeData.pageSpeed` carries **only** `mobileScore` and `lcpSeconds` (`src/lib/leak-detection.ts:339`). CLS cannot be cited today without widening the contract.

---

## 3. The rows that need work

### 3.3 `no_after_hours_coverage` — narrow the absence half
`gbp.limitedHours` is a genuine measurement: `parseLimitedHours()` walks DataForSEO's `work_time.work_hours.timetable`, returns `false` on anything it cannot read, and requires both weekend days closed *and* every open weekday closing by 18:00. Conservative and correct. The other half of the `OBSERVED` sentence — "with no online booking or chat to catch after-hours demand" — is two fingerprint absences over closed provider lists. Keep the leak observed; scope the second clause to what we scanned. Wording in 2.3.

### 3.4 `no_online_booking` — the symptom string over-claims
The detector fires on the absence of a *booking link*. Its `symptom` (`src/lib/leak-taxonomy.ts:1085`) says "The only way to become a customer is to call during business hours." That is false for every business with a working contact form — and `no_lead_qualification` proves we often detect one. The symptom is handed to the model verbatim (5.1), so this sentence is one rephrase away from being a false claim under an `observed` label. Rewrite the symptom to the absence, not the exclusivity.

### 3.6 `no_lead_qualification` — `NEEDS A DECISION`
The `OBSERVED` branch requires `isPresent(hasContactForm) && !formHasQualifyingFields`, grades to `observed`, and prints "Contact form collects no qualifying fields (job type / budget / timeline / service area)". Neither input supports that sentence:

- `hasContactForm` is `/<form\b/i` over the joined rawHtml of every scraped page (`src/lib/audit-intelligence.ts:270`). A site-search box, a newsletter signup or a login form all satisfy it. So the "contact form" in the sentence may be a search box.
- `formHasQualifyingFields` is `QUALIFYING_FIELD_RE.test(html || corpus)` — a prose regex over the **whole cleaned-HTML corpus across all pages**, not scoped to the `<form>` element at all (`src/lib/leak-detection.ts:315`). "We work within your budget" in body copy makes it `true`; a real `<select name="budget">` whose options are injected by JS after render can leave it `false`.

Two honest options, and this is a product call:

- **(a) Fix the measurement → the leak becomes `HARD`.** Extract each `<form>…</form>` block, collect `name` / `id` / `placeholder` / `aria-label` / associated `<label>` text of its `<input|select|textarea>` children, and match `QUALIFYING_FIELD_RE` against *that*. Then the permitted assertion is "the form on /contact collects name, email and message and no job type, budget, timeline or service area", which a prospect can verify in ten seconds. This also lets `hasContactForm` distinguish a contact form from a search box (a form with a single text input named `s` / `q` / `search` is not lead capture).
- **(b) Drop the `OBSERVED` branch.** The leak still fires `BENCHMARK` on "no confirmed form or chat", which is already honest, and the leak is not cold-audit eligible so nothing pre-sale changes.

Recommendation: (a). It is the only row in this file where a modest amount of parsing converts a laundered claim into a real one, and the leak is `leadgate` scope — it justifies the LeadGate front-end, so the finding is worth having properly.

### 3.7 `weak_landing_cta` — `INTERPRETIVE`, and the fix
Three reasons build the `reasons[]` array (`src/lib/leak-detection.ts:764`). Any non-empty array fires `tier: "OBSERVED"` → `grade: "observed"` → the "Measured on your public pages" label.

| Reason | Guard | What it actually is | Verdict |
|---|---|---|---|
| "No clear primary CTA above the fold on the homepage" | `scanConfident && !hasPrimaryCtaAboveFold` | `CTA_RE.test(pageText.home.slice(0, 1500))`. 13 closed phrases against the first 1500 characters of Firecrawl **markdown**. | `INTERPRETIVE` — no ground truth exists. Remove. |
| "Service pages missing a distinct CTA" | `scanConfident && !servicePagesHaveCtas` | `servicePageTexts.every(t => CTA_RE.test(t))` over pages whose **URL path** matched `/services?|treatments?|pricing|prices|menu/`. | `INTERPRETIVE` — "distinct CTA" is a judgment; the input is the same closed phrase list. Remove. |
| "Phone number is not click-to-call" | `isAbsent(hasClickToCallOnMobile)` | `/href=["']tel:/i` over the rawHtml corpus, tri-stated behind proof-of-scan. | `HARD` — keep, reworded. |

**Why reason 1 has no ground truth, concretely.** There is no fold in markdown; document order is not viewport position. The 1500-character window is spent on nav, skip links, logo alt text and cookie banners on any real site before the hero is reached. And `CTA_RE` (`src/lib/leak-detection.ts:144`) matches `book`, `schedule`, `appointment`, `get a quote|estimate`, `request a quote|estimate`, `free consultation|estimate|quote`, `call now|us|today`, `get started`, `reserve`, `claim your` — and nothing else. For a law firm that means **"Free Case Evaluation", "Request a Consultation", "Talk to an attorney", "Contact Us Today", "Get in touch", "Speak with a lawyer" and a bare phone number all read as "no CTA"**. the firm's CTA sat in a styled div; even if its text had been in the window, unless it used one of thirteen phrases it did not count.

**The fix, in three parts:**
1. **Remove `"cold_audit"` from `weak_landing_cta.deliverableTargets`** (`src/lib/leak-taxonomy.ts:1246`). An interpretive judgment must not reach a stranger on a document stamped with a measurement date. Read 6 first — this has a ranking consequence.
2. **Reduce the detector to reason 3 only**, or split the leak so reasons 1–2 can only ever produce a non-graded internal note for the operator. Do **not** leave them firing at a lower tier: `BENCHMARK` would print them as an *industry pattern*, which is a different false statement, and `EVIDENCED` would print them as a signal we observed.
3. **Do not delete the leak.** `verifyWorkflowCatalogue()` (`src/lib/workflow-catalogue.ts:991`) declares `weak_landing_cta` and asserts it still exists and is still in scope; `TaxonomyLeakId` includes it; it is what justifies the GoHighLevel booking page build plus the written site advisory. Removing the id breaks `npm run verify:all`. Narrow the detector and the targets, keep the row.

### 3.13 `low_review_velocity` — right numbers, wrong label
`gr.count` and `c.reviewCount` are both Google-reported counts. The arithmetic is fine. Two problems with how it is described:

- **`competitors` is not a market sample.** `ScrapeData.competitors` is built from `intel.competitors.topRated` (`src/lib/leak-detection.ts:389`), which is `[...competitors].sort(by rating, then reviewCount).slice(0, 3)` (`src/lib/audit-intelligence.ts:382`). So the "competitor median" is the median of the **three highest-rated** nearby businesses — a deliberately unflattering comparison set, presented as a local benchmark. The shipped evidence string says "a competitor median of ~M — under half the local benchmark". "The local benchmark" is not what was computed. Name the sample. `intel.competitors.averageReviewCount` (a mean over the *full* competitor set) exists and is not carried onto `ScrapeData`; if a true local benchmark is wanted, that is the additive contract change.
- **The median is the upper median.** `counts[Math.floor(counts.length / 2)]` on an ascending array returns the upper of the two middles for even lengths. With 2 competitors it returns the larger. Harmless arithmetically, worth knowing before anyone reproduces the number by hand in front of a prospect.

Also note the taxonomy's `when` string for this leak references `googleReviews.recentCount90d`, and **the detector never reads it**. See 5.3 — that field is nonetheless in the model's allowed-number set.

---

## 4. Every scrape field that is a parsed guess, not a measurement

The list the owner asked for. These are the fields whose names promise a measurement the code does not take. **A finding may not cite any of them.**

| Field | How the value is actually produced | False-positive mode (fires the leak when it should not) |
|---|---|---|
| `website.hasPrimaryCtaAboveFold` `P` | `CTA_RE.test((pageText.home ?? corpus).slice(0, 1500))`. `pageText.home` is `scrape.homepage.markdown \|\| scrape.homepage.html`. (`src/lib/leak-detection.ts:152`, `:325`) | **This is the field that produced the the firm finding.** Four independent ways to be wrong: (1) markdown has no fold, so position is never measured; (2) 1500 characters of nav/logo/cookie-banner markdown exhausts the window before the hero on most real sites; (3) `CTA_RE` is 13 closed phrases — "Free Case Evaluation", "Request a Consultation", "Contact Us Today", "Get in touch", a bare phone number all read as absent; (4) when `markdown` is empty the window becomes 1500 characters of raw **HTML**, i.e. `<head>` and inline CSS, which essentially guarantees a false fire. A CTA inside a styled div is invisible to it whenever the div's text is not one of the thirteen phrases. |
| `website.servicePagesHaveCtas` `P` | `servicePageTexts.every(t => CTA_RE.test(t))`, over pages whose **URL** matched `/(services?\|treatments?\|pricing\|prices\|menu)\b/`. Empty set → `true` (graceful). (`src/lib/leak-detection.ts:328`, `:168`) | Same closed phrase list, so any service page whose call to action is worded differently fires "service pages missing a distinct CTA". `every()` means **one** page out of five drags the flag false. And "distinct CTA" is a judgment the code never makes — it only asks whether one of thirteen phrases appears anywhere in the page's text, including in a footer or a blog excerpt. Inverse failure for law: practice-area pages live at `/practice-areas/*`, never classify as `services`, so the set is empty and the check silently passes. |
| `website.formHasQualifyingFields` `H` | `intel.website.formDetected && QUALIFYING_FIELD_RE.test(html \|\| corpus)` — a prose regex over the **joined cleaned HTML of every scraped page**, not scoped to the form. (`src/lib/leak-detection.ts:315`) | Fires "your form collects no qualifying fields" whenever the qualifying vocabulary happens not to appear anywhere on any scraped page — even though the form itself was never read. Symmetrically, marketing copy saying "we work within your budget" or "how soon do you need service?" suppresses a real gap. Not scoped to the element it describes. |
| `website.hasContactForm` `F` | `/<form\b/i` over the rawHtml corpus, tri-stated. (`src/lib/audit-intelligence.ts:270`) | `PRESENT` is proof a `<form>` exists — **not** proof it is a contact form. A site-search box, a newsletter signup or a WordPress login form all satisfy it, and `no_lead_qualification` then says "contact form collects no qualifying fields" about a search box. |
| `website.mentionsTextingOption` `H` | `TEXTING_RE.test(corpus)` over the markdown corpus. Not tri-stated, not gated by `scanConfident`. (`src/lib/leak-detection.ts:332`) | An empty or bot-walled corpus yields `false`, which reads as "no visible text-back path". Only ever feeds a `BENCHMARK` branch, so it hedges rather than asserts — the least dangerous of the set, but still an absence claim from silence. |
| `website.hasOnlineBookingLink` `F` (asymmetric) | `triState(bookingMatched, scanGood \|\| gbp.hasBookingLink)` where `bookingMatched` includes `intel.website.bookingDetected` — which is `bookingProviders.length > 0` **OR a text regex** `/book (an? )?(appointment\|consultation\|call)\|schedule …/` over the HTML. (`src/lib/audit-intelligence.ts:264`) | The false positive is *safe*: prose saying "book an appointment" with no scheduler anywhere makes it `PRESENT` and **suppresses** the leak. No false claim results — we simply miss a real gap. Recorded for completeness because the field mixes a link fingerprint and a prose regex under one name. `ABSENT` is bounded by `BOOKING_HOSTS` (16 hosts) + `BOOKING_PROVIDERS` (15 substrings): Zenoti, NexHealth, Weave, Dentrix, Podium scheduling and any custom booking page are not on either list. |
| `website.hasChatWidget` `F` | `triState(intel.website.marketing.chat.length > 0, scanGood)` against `CHAT_PROVIDERS`, 12 hosts. (`src/lib/audit-intelligence.ts:114`) | `ABSENT` means "none of twelve hosts fingerprinted", not "no chat widget". Olark, Freshchat, Chatra, Smartsupp, JivoChat, Gorgias, Weave, Hatch, Chatwoot and LeadConnector's own widget all read absent. The shipped evidence string says "detected", which is the correct hedge — preserve that word. |
| `website.hasClickToCallOnMobile` `F` | `triState(intel.website.phoneClickable, scanGood)`, `phoneClickable = /href=["']tel:/i.test(html)` over the rawHtml corpus. (`src/lib/audit-intelligence.ts:271`) | Genuinely checkable, and the honest half of `weak_landing_cta`. Misses: unquoted `href=tel:`, `href = "tel:"` with spaces, a number rendered as an image, and a `tel:` link injected by JS after Firecrawl's 1500 ms `waitFor`. The name says "OnMobile"; the check is the desktop DOM site-wide — `docs/taxonomy-integration-audit.md:71` already flags that as a proxy. **On the owner's site this was `PRESENT`, which is why reason 3 did not fire and why "your phone number is buried" contradicted our own data.** |
| `website.scanConfident` `P` | `isGoodScan(rawHtml)`: joined rawHtml across all pages, `length >= 1000`, and matches either a closing structural tag or `<form\|<a\|<button\|<script`. (`src/lib/leak-detection.ts:232`) | **The weakest link under the "Measured" label.** A Cloudflare or bot-wall interstitial is comfortably over 1000 bytes and always contains `<script`, so it *passes* the proof-of-good-scan check. Its markdown then contains no CTA → `hasPrimaryCtaAboveFold` false → `weak_landing_cta` fires `OBSERVED` about a page we never actually read. Second failure mode: the check runs on the **joined** corpus, so one good subpage licenses absence claims about the homepage. A thin homepage plus a good `/about` page yields `scanConfident: true` for a homepage assertion. |
| `website.pagesFound` / `website.pageText` `P` | URL-path classification, first pattern wins; `pageText[kind]` is **overwritten** per kind, so only the last matching page of each kind survives. (`src/lib/leak-detection.ts:175`) | `pageText.contact` (read by `slow_speed_to_lead`'s `promisesInstant`) is whichever `/contact*` page came last. Law-firm practice areas, dental "procedures", trades "what we do" never classify as `services`. |
| `googleReviews.recentCount90d` `M`(partial) | `countRecentReviews(dfsReviews, asOf)` — 90-day window over **DataForSEO reviews only, capped at 20** (`src/lib/leak-detection.ts:366`, `:210`). Places reviews carry relative text (`"2 weeks ago"`) and are excluded. | It is a **floor, not a count**. Any business with more than 20 reviews inside 90 days is undercounted, and a business whose reviews all lack parseable timestamps reads 0. No detector reads it — but `allowedNumbersFor` does (5.3), so the model may print it as a measured figure. |
| `googleReviews.ownerResponseRate` | Hard-wired `-1` sentinel. Nothing we fetch carries owner replies. | Never read by a detector, and correctly **not** in `allowedNumbersFor`. Leave it. Reading `-1` as "nobody replies" is the defect that got the old `unanswered_reviews` leak deleted. |
| `gbp.messagingEnabled` | Hard-wired `false` — the GBP messaging attribute is not pulled. (`src/lib/leak-detection.ts:386`) | Currently read by no detector, so harmless today. It is a contract slot that lies: any future detector reading it gets "messaging is off" for every business on earth. Either populate it or make it optional. |
| `competitors[]` `M`(mislabelled) | `intel.competitors.topRated` — the **top 3 by rating**, then review count. (`src/lib/audit-intelligence.ts:382`) | The counts are real Google numbers; the *sample* is the three best-rated nearby businesses, not a market cross-section, and `low_review_velocity` calls its median "the local benchmark". See 3.13. |
| `business.industry` `C` | `classifyVertical()` — ordered regex buckets over industry/category/GBP-category strings, first match wins, unmapped → `home_services_other`. (`src/lib/leak-detection.ts:136`) | Only ever gates vertical boosts, stat selection and `no_show_exposure` / `payment_booking_friction` membership. Never a client-facing claim. Ordering matters (dental and med_spa are tested before law). |

**Genuinely measured, for contrast** — these are the fields a finding may cite as measurements, with their source named: `pageSpeed.mobileScore`, `pageSpeed.lcpSeconds` (Lighthouse, mobile strategy, per-run); `googleReviews.count`, `googleReviews.rating`, `competitors[].reviewCount`, `competitors[].rating` (Google); `googleReviews.reviewTexts[]` (verbatim review text, the substrate for every `EVIDENCED` fire); `gbp.hoursListed`, `gbp.limitedHours`, `gbp.hasBookingLink` (DataForSEO's `work_time` / `book_online_url`); `business.phone` (Places); `website.linksToFacebook`, `website.linksToInstagram` (host-matched links from Firecrawl's link map).

---

## 5. Fabrication channels outside the detectors

Fixing the detectors is necessary and not sufficient. These four paths let a false checkable-sounding specific reach the page even when every detector is honest. They matter to B, C and D.

### 5.1 The `symptom` string is handed to the model as material about this business
`leakInputsToPromptBlock` prints `symptom: ${li.symptom}` (`src/lib/leak-narrative.ts:826`), and the block's own rule is "You may rephrase for flow; you may NOT add facts… not present here." So everything in a symptom string **is** licensed. `weak_landing_cta.symptom` (`src/lib/leak-taxonomy.ts:1212`) reads:

> "Traffic arrives, reads, and leaves. The page doesn't tell visitors what to do next — no clear primary action, buried phone number, generic 'contact us'."

**"Buried phone number" is in the taxonomy.** That is where the fabricated sentence came from — not from a hallucination out of nowhere, but from generic taxonomy prose the model correctly treated as permitted material and the grade then stamped as measured. Two other symptom strings carry the same defect on `observed`-capable, cold-audit-eligible leaks:

- `low_review_velocity.symptom` — "nobody asks them for a review" (an internal claim we never measured) and "the competitor down the street adds ten a month" (a fabricated velocity; note "ten" is a word, so `statGuard` never sees a number).
- `no_online_booking.symptom` — "the only way to become a customer is to call" (3.4).

And one class mismatch worth a look: `no_lead_qualification` is `evidenceClass: "OBSERVED"` while its symptom asserts internal behaviour ("the owner spends selling time sorting instead of closing").

Whoever owns the taxonomy strings should scrub every `symptom` on an `observed`-capable leak down to what the detector can support, or the prompt must stop presenting `symptom` as citable material about this business.

### 5.2 The grade certifies the fire, not the sentence
`gradeOf()` maps `tier === "OBSERVED"` → `"observed"` unconditionally (`src/lib/leak-taxonomy.ts:407`), and `gradeLabel()` renders that as "Measured on your public pages, {date}". Nothing between the detector and the page checks that the sentence printed under the label corresponds to the evidence array. The evidence array is *offered* to the model; it is not *binding*. That is the hole B and C are closing.

### 5.3 `allowedNumbersFor` permits numbers no detector established
`allowedNumbersFor` (`src/lib/leak-narrative.ts:899`) adds `googleReviews.recentCount90d` to the model's allowed-number set. No detector reads that field, it is a floor rather than a count (capped at 20 DataForSEO reviews), and `statGuard` will therefore *pass* a sentence like "only 3 reviews in the last 90 days" for a business with thirty. Independent of every detector fix.

### 5.4 `statGuard` cannot see the claims that matter
It extracts numeric tokens and checks them against an allowed set, ignoring bare integers below 3 (`src/lib/leak-narrative.ts:878`). "Your phone number is buried", "no primary action above the fold", "three scrolls down" (word form), "nobody asks for reviews" — none are numbers. Any new gate has to be a claim gate, not a number gate.

### 5.5 A detected CRM is ignored by the CRM leak
`intel.website.marketing.crm` fingerprints HubSpot, Salesforce, Zoho, Pipedrive, Keap and HighLevel from the HTML. `no_crm_pipeline` reads only `intake.hasCrm`, so a business with HubSpot forms on every page gets told, pre-sale, that most businesses like them have no pipeline. It is correctly hedged as a pattern so it is not a false measurement — but it is a pattern we can already see does not apply. Cheap suppression, out of scope for this fix; noted so it is not lost.

---

## 6. The consequence of pulling `weak_landing_cta` out of the cold audit — read before doing it

`selectColdAudit()` (`src/lib/leak-detection.ts:1109`) takes the top 3 and enforces a provability constraint: **at least 2 of the 3 must be `OBSERVED` or `EVIDENCED`**. Pre-sale there is no intake, so the pool of cold-audit-eligible leaks that can reach `OBSERVED` or `EVIDENCED` is:

| Leak | Can reach provable pre-sale via | Requires |
|---|---|---|
| `no_after_hours_coverage` | `OBSERVED` | `gbp.limitedHours` true **and** booking + chat both confirmed `ABSENT` |
| `no_online_booking` | `OBSERVED` | booking link confirmed `ABSENT` (needs `scanGood`) |
| `low_review_velocity` | `OBSERVED` | competitor data present **and** count < half the median |
| `weak_landing_cta` | `OBSERVED` | — fires on any one of three reasons, two of which are nearly free |
| `slow_speed_to_lead` | `EVIDENCED` | ≥2 reviews matching `slowResponse` |
| `missed_calls_no_recovery` | `EVIDENCED` | ≥2 reviews matching `missedCalls` |
| `no_follow_up_sequence` | `EVIDENCED` | ≥2 reviews matching `noFollowUp` |

`weak_landing_cta` is the cheapest provable fire in that list — which is exactly why it has been carrying the constraint, and exactly why it shipped a false claim. Removing it means a business with no competitor data, listed hours, an unconfirmable booking path and no matching review phrases will have **fewer than 2 provable leaks**.

**There is already an escape hatch and it does not strand anyone:** `selectColdAudit` returns `top3` when `provableCount >= 2 || ranked.length < 3`, and its rebalance branch fills from `nonProvables` when there are not enough provables. It never throws and never returns empty. So the audit degrades to a more hedged document rather than failing to generate — which is the correct behaviour and should be left alone.

What D should verify rather than assume: that a fixture with thin scan data still produces a cold audit, that its findings all read as patterns rather than measurements, and that no path prints "Measured on your public pages" for a leak whose only fire came from a `BENCHMARK` branch. If anyone later wants a hard floor on provable findings, it must be a logged, reasoned degradation — never a block that stops a document generating at 11pm.

---

## 7. Handoff summary

**Never allowed to be graded `observed`, whatever a detector says:** `weak_landing_cta` reasons 1–2 (delete or demote to a non-graded operator note), and `no_lead_qualification`'s `OBSERVED` branch until `formHasQualifyingFields` actually inspects the form.

**Never allowed in a pre-sale artifact:** `weak_landing_cta` — remove `"cold_audit"` from `deliverableTargets`. Do not delete the leak (`verifyWorkflowCatalogue()` asserts the id exists and is in scope).

**Fields no finding may ever cite:** `hasPrimaryCtaAboveFold`, `servicePagesHaveCtas`, `formHasQualifyingFields` (as computed today), `mentionsTextingOption`, `scanConfident`, `ownerResponseRate`, `messagingEnabled`, `recentCount90d`.

**Wordings that must be preserved because they are already the honest version:** "No online booking link on the site or Google Business Profile"; "No live-chat / webchat widget **detected**"; the `no_follow_up_sequence` / `no_crm_pipeline` / `no_call_tracking` / `payment_booking_friction` unconfirmed strings, each of which names itself an industry pattern rather than an observation.

**Additive contract widenings a narrowed assertion would need** (none required for the fix; listed so nobody invents a field): `AuditIntelligence.website.bookingProviders` → `ScrapeData` (to name a detected scheduler); `PsiResult.metrics.cls` → `ScrapeData.pageSpeed` (the owner named CLS as hard, and it is fetched but dropped); `intel.competitors.averageReviewCount` → `ScrapeData` (a true local mean, if "the local benchmark" is to be said truthfully).
