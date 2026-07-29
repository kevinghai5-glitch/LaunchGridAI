# Landing-page call — asset inventory before deletion

**Status:** inventory only. Nothing has been deleted, moved, or edited. This file is the
pre-condition for the deletion, not a record of it.

## What this file is for

We are removing the 10th LLM call in the asset pack — `generateLandingModule()` in
`src/lib/asset-generation.ts:1341`. It is the one that writes a whole landing-page spec:
the page sections, the hero headline and subhead options, the CTA buttons, the FAQ, the
thank-you copy, and the implementation notes.

The rule for the removal is that **copy gets repointed, not lost**. We do not build or host
websites — the one page we build is the booking page inside the GoHighLevel sub-account —
so a call that writes "a landing page" is writing for a surface that does not exist in the
offer. But most of the *words* it produces are still the right words for surfaces that DO
exist: the booking page, the lead-capture form, the LeadGate qualification screens, the
webchat, and the written advice the client hands to whoever runs their site.

So: every asset that call produces is listed below with a verdict. **REPOINT** means it has
a real home in the build. **DROP** means it is deliberately binned, with the reason written
down. **DECIDE** means I could not place it honestly and it needs a call from the owner —
those are listed separately in section 4 so they cannot be skimmed past.

Three months from now, the check is: read the REPOINT rows, confirm each one actually shows
up where it says it does. If a row says VERBATIM, the exact wording is supposed to have
survived word-for-word.

---

## 0. Read this before you delete anything

Four things are not what they look like. Each one is a way the deletion goes wrong quietly.

**0.1 — `techStack` ("e.g. Framer") is NOT in the 10th call.** It is in `generateFile1`, the
*first* call, at `src/lib/asset-generation.ts:607`, alongside a sibling
`implementationNotes: "how to deploy this page"` at line 606. Deleting the 10th call leaves
both alive and still generating. They are covered in section 3 and need their own edit.

**0.2 — Deleting the call does not delete the sections.** Both renderers have a fallback
that fires when `pack.landing` is absent:

| Deliverable | Section | Preferred path | Falls back to |
| --- | --- | --- | --- |
| D1 | Landing Page Conversion Intelligence | `deliverables.ts:681-683` | `renderLandingIntelligenceFallback` (`deliverables.ts:614-660`) — reads `file1.ctaStrategy`, `file1.conversionBottlenecks`, `file1.trustGapAnalysis`, `file1.trackingAnalytics` |
| D3 | Landing Page Conversion Assets | `deliverables.ts:1078-1080` | `renderLandingAssetsFallback` (`deliverables.ts:1046-1063`) — reads `file1.landingPage.*` |

So the result of deleting only the call is not "the landing section is gone". It is "the
landing section silently downgrades to file1's thinner copy". That includes
`file1.landingPage.testimonials`, generated at `asset-generation.ts:598` with the hint
*"believable local name"* / *"specific, believable outcome"* — invented proof. The fallback
does not currently render testimonials, but they sit in the saved pack JSON and are scanned
by the validator. Decide the fallbacks' fate in the same change, not later.

**0.3 — Already-saved packs still contain `landing`.** The pack is persisted whole as
`GeneratedSystem.content Json` (`prisma/schema.prisma:268`) and rows are only ever
soft-deleted (`deletedAt`, line 275). Every pack generated to date carries a populated
`landing` object. If the `LandingPageModule` type and the two `renderLandingIntelligence` /
`renderLandingAssets` functions are removed along with the call, every historical pack
re-renders through the weaker fallback. Recommendation: **delete the generation call, keep
the type and both renderers**, so old packs render exactly as they always did.

**0.4 — Nothing here escapes the validator.** `validatePack` walks the entire pack with
`collectStrings(scannable)` (`validate-pack.ts:367-369`), not just the rendered fields. Any
copy that gets repointed into a new field is still fatal-checked for Law 2 lead-gen
language, banned vocabulary, and unlabelled dollar figures. Repointing is not a way around
the gate, and it should not be.

---

## 1. Diagnosis half — `LandingPageIntelligence` → Deliverable 1

Produced by the schema at `src/lib/asset-generation.ts:1364-1373`. Typed at
`src/types/index.ts:578-587`. Rendered by `renderLandingIntelligence`
(`src/lib/exporters/deliverables.ts:538-609`), which is called from D1 at
`deliverables.ts:681-685` under the heading "Landing Page Conversion Intelligence".

| # | Asset | Produced at | Rendered today | Verdict | Destination / reason | Must survive verbatim |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Landing page executive diagnosis (4-6 sentences) | `asset-generation.ts:1365` | `deliverables.ts:541-546` | REPOINT | Advisory site recommendations. Already carries the scope sentence in the golden fixture: *"These are advisory notes for whoever looks after the site. The one page we build ourselves is the booking page inside your GoHighLevel sub-account…"* (`_fixtures/golden-pack.json:1363`) | Yes — the "advisory / the one page we build" framing sentence |
| 1.2 | Hero section diagnosis (problem · evidence · why it matters · fix · expected improvement) | `asset-generation.ts:1366` | `deliverables.ts:549`, rendered by `diagPoint` at `522-536` | REPOINT | Advisory site recommendations for the diagnosis; its `recommendedFix` is the input that justifies the **booking page headline** in row 2.1 | No |
| 1.3 | CTA strategy diagnosis (same 5 parts) | `asset-generation.ts:1367` | `deliverables.ts:550` | REPOINT | Advisory site recommendations. In practice the fix is "point the existing buttons at the booking page" — the same sentence as row 2.16b | No |
| 1.4 | Trust placement diagnosis (same 5 parts) | `asset-generation.ts:1368` | `deliverables.ts:551` | REPOINT | Advisory site recommendations; feeds the **booking page reassurance line** (row 2.5) | No |
| 1.5 | Conversion bottleneck analysis, 4-6 cards (stage · friction · likely visitor behaviour · impact · fix · priority) | `asset-generation.ts:1369` | `deliverables.ts:557-576` | REPOINT | Split by stage. On-page stages ("Mobile visitor → CTA") → advisory site recommendations. Post-submit stages ("Form submission → follow-up") describe **our build**, not their site — those belong with the lead-capture form and the workflows | No |
| 1.6 | Landing page technical UX diagnosis (3-5 sentences tying PSI to booking behaviour) | `asset-generation.ts:1370` | `deliverables.ts:578-583` | DROP | **Duplicate.** `file1.technicalUx.businessImpactSummary` (`asset-generation.ts:538`) already translates the same measured PSI numbers into business consequence, and renders in its own D1 section at `deliverables.ts:675-676`. Site performance is flagged, never fixed, so a second prose read of the same numbers adds no advisory value. *Confirm this one — it is the only row where live prose is dropped on duplication grounds* | No |
| 1.7 | Fastest landing page wins — 4-6 ranked rows (fix · why · priority · difficulty · expected outcome) | `asset-generation.ts:1371` | `deliverables.ts:585-600` (table) | REPOINT | Advisory site recommendations, kept as the ranked table. Any row whose fix is a workflow or the booking page belongs to the build, not the advice — split on the way over | No |
| 1.8 | Landing page tracking recommendations, 6-8 tool-agnostic items | `asset-generation.ts:1372` | `deliverables.ts:602-607` | REPOINT + DECIDE | Their-own-site half → advisory site recommendations. The half about CTA clicks / booking-button clicks on **our** GoHighLevel page belongs to the reporting dashboard + monthly report, which is not one of the approved destinations. See 4.1 | No |

---

## 2. Assets half — `LandingPageAssets` → Deliverable 3

Produced by the schema at `src/lib/asset-generation.ts:1374-1384`. Typed at
`src/types/index.ts:606-626`. Rendered by `renderLandingAssets`
(`src/lib/exporters/deliverables.ts:962-1043`), called from D3 at `deliverables.ts:1078-1094`.

The D3 section already frames this correctly today — `assetFrame("Booking page copy we
build and brand for you", "Turn the enquiries you already get into booked, qualified
calls")` at `deliverables.ts:1089-1092`. That frame is the destination these rows are
repointing *into*, not something new.

| # | Asset | Produced at | Rendered today | Verdict | Destination / reason | Must survive verbatim |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | **3 headline options** | `asset-generation.ts:1376` | `deliverables.ts:971-974` ("Headline options — paste one") | REPOINT | **GoHighLevel booking page — headline.** This is the copy the owner named explicitly. All three options must survive, not just one; he picks at build time | **Yes — all 3 options, exact strings** |
| 2.2 | **3 subheadline options** | `asset-generation.ts:1376` | `deliverables.ts:975-978` | REPOINT | **GoHighLevel booking page — subhead.** All three survive | **Yes — all 3 options, exact strings** |
| 2.3 | Primary CTA button text | `asset-generation.ts:1376` | `deliverables.ts:980` ("Primary button") | REPOINT | GoHighLevel booking page primary button **and** the lead-capture form submit button. Golden fixture: *"Book a service visit"* | Yes |
| 2.4 | Secondary CTA button text | `asset-generation.ts:1376` | `deliverables.ts:981` ("Secondary button") | REPOINT | Booking page secondary route / lead-capture form alternate. Golden fixture: *"Request a written quote"* | Yes |
| 2.5 | Trust microcopy — the short reassurance line under the button | `asset-generation.ts:1376` | `deliverables.ts:982` ("Trust line under the button") | REPOINT | **GoHighLevel booking page — reassurance line.** This is the named destination, one-to-one. Golden fixture: *"4.4 stars across 61 Google reviews. Licensed and insured for gas work in British Columbia."* | **Yes** |
| 2.6 | Above-the-fold proof line | `asset-generation.ts:1376` | `deliverables.ts:983` | REPOINT | GoHighLevel booking page, above the fold. Carries the standing rule from `asset-generation.ts:1358`: never invent proof — unproven claims ship as a labelled `[Insert verified client testimonial]` placeholder | Yes, including the placeholder form |
| 2.7 | Problem-section copy (paragraph) | `asset-generation.ts:1377` | `deliverables.ts:991` | DECIDE | The approved booking-page slots are headline, subhead, reassurance line — there is no problem-section slot. Default if no decision: advisory site recommendations. See 4.2 | No |
| 2.8 | Value / solution-section copy (paragraph) | `asset-generation.ts:1378` | `deliverables.ts:992` | DECIDE | Same as 2.7. See 4.2 | No |
| 2.9 | Trust / proof-section copy (paragraph) | `asset-generation.ts:1379` | `deliverables.ts:993` | DECIDE | Same as 2.7, except its first line is already condensed into row 2.5. See 4.2. Note it legitimately contains `[Paste three real Google reviews here…]`-style placeholders — those are the honest form, keep them | The placeholder instruction, if the copy survives at all |
| 2.10 | CTA option **labels + types**, 6-8 (Primary / Secondary / Phone / Booking / Low-friction / Final) | `asset-generation.ts:1380` | `deliverables.ts:999-1001` | REPOINT | Split across real surfaces: Primary/Booking → booking page buttons; Phone → the dedicated tracked number; Low-friction → **webchat launcher** (the golden fixture's is literally *"Ask a quick question" · "Webchat launcher, present on every page"*); Secondary → lead-capture form | Yes — the label strings |
| 2.11 | CTA option `whereToUse` (placement instruction) | `asset-generation.ts:1380` | `deliverables.ts:1002-1004` ("Where to place it") | REPOINT | Travels with 2.10 — without it the labels are a word list. Rewrite "Hero, sticky header, and the close" in booking-page terms | No |
| 2.12 | CTA option `whyItExists` + `expectedRole` | `asset-generation.ts:1380` | **Nowhere** — `renderLandingAssets` renders only `label`, `type`, `whereToUse` (`deliverables.ts:996-1006`) | DROP | Already dark. Generated, typed (`types/index.ts:602-603`), persisted, validator-scanned, and never shown to a client in any deliverable. Dropping it loses nothing that ships | No |
| 2.13 | FAQ / objection handling, 5-8 Q&A | `asset-generation.ts:1381` | `deliverables.ts:1011-1016` | REPOINT + DECIDE | Booking page FAQ block by default. But several entries are not page copy at all — the golden fixture's *"What happens if I message you in the evening?"* is a **webchat away-message**, and *"How quickly can somebody get here?"* / *"Should I repair this furnace or replace it?"* are **LeadGate question framing**. The split needs a decision; see 4.3 | Yes for whichever entries land on the booking page |
| 2.14 | Thank-you page copy | `asset-generation.ts:1382` | `deliverables.ts:1018-1019` | REPOINT + DECIDE | **Lead-capture form — post-submit confirmation.** Collides with `supportingAssets.thankYouAssets.thankYouPageCopy`, which renders separately in the same document at `deliverables.ts:1172-1173` and survives this deletion. Two thank-you copies exist today; keep one. See 4.4 | Yes — specifically the timeline expectation and the emergency route (*"If it is an emergency, call … it will route straight to the on-call technician"*) |
| 2.15a | Recommended page structure — 9 section **names + purposes** | `asset-generation.ts:1375` | `deliverables.ts:1023-1034` ("Page order — for whoever assembles the page") | REPOINT | Booking page section order for the sections that exist there, advisory site recommendations for the rest | No |
| 2.15b | Recommended structure — `whatToCommunicate` per section | `asset-generation.ts:1375` | **Nowhere** — the table renders `name` and `purpose` only | DROP | Already dark, same as 2.12. Surfacing it would require a renderer change, which is not part of this deletion | No |
| 2.15c | Recommended structure — `implementationNote` per section | `asset-generation.ts:1375` | **Nowhere** — same table | DROP, **with one carve-out** | Already dark. But the booking-section note in the golden fixture reads *"This is the GoHighLevel booking page, embedded or linked."* (`_fixtures/golden-pack.json:1490`) — the single sentence that says which page is ours. That sentence must be preserved somewhere visible; it duplicates row 2.16a, so preserving 2.16a satisfies it | The GoHighLevel booking-page sentence, via 2.16a |
| 2.16 | Implementation notes (the "deployment notes") — array of 4 | `asset-generation.ts:1383` | `deliverables.ts:1037-1040` | **REPOINT — not a drop.** See warning below | Broken out in 2.16a-d | **Yes, all four** |

### 2.16 — the "deployment notes" are not deployment notes

The brief assumed these were an obvious DROP alongside `techStack`. They are not. In this
codebase `landing.assets.implementationNotes` does not contain build-and-deploy
instructions — it contains **the scope language that says we do not build websites**.
Dropping it deletes the sentence that protects the offer. All four entries
(`_fixtures/golden-pack.json:1588-1593`):

| # | Note (verbatim) | Verdict | Destination |
| --- | --- | --- | --- |
| 2.16a | *"These are advisory notes for whoever maintains the website; the page we build and host is the GoHighLevel booking page."* | REPOINT — **VERBATIM** | Advisory site recommendations, as the opening line of the advisory block |
| 2.16b | *"The fastest version of all of this is repointing the existing buttons at the booking page and leaving the rest of the site alone."* | REPOINT — **VERBATIM** | Advisory site recommendations |
| 2.16c | *"Never publish a review, a name or a photo that did not come from a real customer, however good the placeholder reads."* | REPOINT — **VERBATIM** | Advisory site recommendations. Standing rule, applies to every surface, not just the page |
| 2.16d | *"Any response time promised on the page has to match what the automation actually does, or the page becomes a liability."* | REPOINT — **VERBATIM** | Booking page + advisory site recommendations. This is the sentence that keeps the page honest about the workflows |

The genuinely drop-worthy deployment content is in **file1**, not here — see 3.6 and 3.7.

---

## 3. Boundary — file1's landing fields, which this deletion does NOT touch

Everything in this section is produced by `generateFile1` (the *first* call), not the 10th.
It stays alive unless someone edits `generateFile1` separately. Listed because the owner's
description of the call to be deleted included `techStack`, which lives here.

| # | Asset | Produced at | Rendered today | Verdict | Destination / reason |
| --- | --- | --- | --- | --- | --- |
| 3.1 | `file1.landingPage.*` — heroHeadline, heroSubheadline, ctaBlock, problemSection, solutionSection, offerSection, threeStepProcess, benefits, trustSection, testimonials, faq, urgencyBlock, finalCta | `asset-generation.ts:593-601`, typed `types/index.ts:183-197` | Partially — `renderLandingAssetsFallback` (`deliverables.ts:1046-1063`) renders 10 of the 13 when `pack.landing` is absent | DECIDE | Becomes the **only** D3 landing copy the moment the 10th call is gone. See 4.5 |
| 3.2 | `file1.landingPage.testimonials` — invented local names and quotes | `asset-generation.ts:598` (hint: *"believable local name"*, *"specific, believable outcome"*) | Not rendered by the fallback, but persisted in pack JSON and validator-scanned | DECIDE — flagged | Fabricated proof is banned. It does not reach a document today, but it is in every saved pack. Raised in 4.5 |
| 3.3 | `file1.landingStructure` (ordered section list) | `asset-generation.ts:602` | **Nowhere** (verified: only `types/index.ts:198`, `asset-generation.ts:602`, `scripts/make-golden-sample.ts:1715`) | DROP | Already dark, and duplicated by 2.15a |
| 3.4 | `file1.ctaStrategy` | `asset-generation.ts:603` | `deliverables.ts:617-618`, **fallback path only** | DECIDE | Only reachable when `pack.landing` is absent — which after this change is always. See 4.5 |
| 3.5 | `file1.socialProofRecommendations`, `file1.urgencyStrategy` | `asset-generation.ts:604-605` | **Nowhere** | DROP | Already dark. `urgencyStrategy` in particular invites invented urgency, which is validator-fatal |
| 3.6 | `file1.implementationNotes` — *"how to deploy this page"* | `asset-generation.ts:606` | **Nowhere** | DROP | **We do not build or deploy websites.** Deployment instructions for a page we never deploy are instructions for work outside the offer. Not the same field as 2.16 — that one is advisory scope language and is kept |
| 3.7 | `file1.techStack` — `[{tool: "e.g. Framer", purpose}]` | `asset-generation.ts:607`, typed `types/index.ts:203` | **Nowhere** (verified: only `types/index.ts:203`, `asset-generation.ts:607`, `scripts/make-golden-sample.ts:1737`) | DROP | **We do not build or deploy websites, so we do not recommend a tool for building one.** Naming Framer implies a site build is in scope; it is not, and it is not something we would advise on either. Never rendered, so nothing client-facing is lost — but it is in the saved JSON and validator-scanned, so it should still go. **Requires a separate edit to `generateFile1`; deleting the 10th call does not remove it** |
| 3.8 | `file1.trackingAnalytics` | `asset-generation.ts:608` | `deliverables.ts:652-657`, **fallback path only** | DECIDE | Same fallback problem as 3.4, and duplicates 1.8. See 4.5 |
| 3.9 | `file1.loomTalkingPoints`, `file1.beforeAfterAngles`, `file1.salesEnablement` | `asset-generation.ts:609-614` | **Nowhere** | Out of scope for this inventory | Internal sales material, not landing-page copy. Not touched by this change. Listed so nobody assumes they were audited |

---

## 4. Needs a decision — do not guess these

Five rows I could not place honestly. Each states the options and what I would default to,
but none should be actioned without the owner saying so.

**4.1 — Where do the GoHighLevel-side tracking recommendations go?** (row 1.8)
Half of `trackingRecommendations` is advice for their own analytics (clean → advisory). The
other half — CTA clicks, booking-button clicks, source-to-booking rate on *our* page — is
already covered by the reporting dashboard and the monthly report, which is not one of the
five approved destinations. Options: (a) fold that half into the advisory block anyway and
accept the slight scope blur, (b) drop that half as duplicated by the monthly report, (c)
add "monthly report / reporting dashboard" as a sixth destination. **Default if silent:
(b), because the monthly report already covers it.**

**4.2 — Does the booking page get long-form copy?** (rows 2.7, 2.8, 2.9)
`problemCopy`, `solutionCopy`, and `trustCopy` are three full paragraphs of sales prose. The
approved booking-page slots are headline, subhead, and reassurance line only. Either the
booking page is longer than those three slots and these have a home, or it is a short
booking page and all three become advisory copy the client hands to their web person.
**Default if silent: advisory site recommendations** — that keeps the words and makes no
promise about a page we have not agreed to build.

**4.3 — How is the FAQ split?** (row 2.13)
5-8 objection-handling Q&As. Some are booking-page FAQ, some are webchat away-message
material, some are LeadGate question framing. The split is a judgement about the questions
themselves, not something I can derive from the code. **Default if silent: all of it to the
booking page FAQ block**, on the grounds that it is the destination that loses the least.

**4.4 — Which thank-you copy survives?** (row 2.14)
Two exist and both render in D3 today: `landing.assets.thankYouPageCopy`
(`deliverables.ts:1018-1019`) and `supportingAssets.thankYouAssets.thankYouPageCopy`
(`deliverables.ts:1172-1173`). Only the second survives this deletion. The first contains
material the second may not — the timeline expectation, the preparation instructions, and
the emergency route. **Default if silent: keep `supportingAssets`' version as the single
thank-you copy, and merge the landing version's timeline + emergency-route sentences into
it before deleting.** Losing the emergency route is a real regression.

**4.5 — What happens to the two fallback render paths?** (rows 3.1, 3.2, 3.4, 3.8)
`renderLandingIntelligenceFallback` and `renderLandingAssetsFallback` exist for packs
generated before the landing module. Once the module is gone, *every new pack* takes the
fallback, and D1/D3 silently start rendering file1's older, thinner landing copy — the
opposite of the intended change, and it re-exposes `file1.landingPage` content that was
superseded on purpose. Three options: (a) delete the fallbacks too, so the landing sections
disappear cleanly and the copy lives at its repointed destinations; (b) keep the fallbacks
for historical packs only, gated on the pack having no `landing` **and** being older than
the change; (c) leave as-is and accept the downgrade. **Default if silent: (a) delete the
fallbacks, keep `renderLandingIntelligence` / `renderLandingAssets` and the
`LandingPageModule` type so that every saved pack in `GeneratedSystem.content` still renders
the way it did the day it was made.**

---

## 5. Mechanical follow-ups for whoever makes the edit

Not copy, but they break if the call goes and nobody touches them.

| Item | Location | What needs to happen |
| --- | --- | --- |
| `ASSET_PACK_PARTS = 10` | `asset-generation.ts:1456` | Becomes 9. It drives the progress bar's denominator — leave it at 10 and generation appears to stall at 90% forever |
| Stale comment: *"All nine deliverable calls fire in parallel"* | `asset-generation.ts:1458` | Already wrong (there are ten). Becomes right by accident; say nine deliberately |
| `Promise.all` tuple + destructure | `asset-generation.ts:1474-1507` | Remove the `landing` element from the array, the tuple type, and the destructure — all three, or the types drift |
| `track("Landing page conversion module", …)` | `asset-generation.ts:1495` | Removed with the above |
| `landing` key on the returned pack | `asset-generation.ts:1522` | Removed |
| `landingAssertions` | `asset-generation.ts:1322-1339` | Orphaned once its only caller (`asset-generation.ts:1388`) is gone |
| Imports `LandingPageModule`, `LandingDiagnosisPoint` | `asset-generation.ts:41-42` | Unused after the delete — `tsc --noEmit` will not fail on unused imports, but lint will |
| Golden fixture builder | `scripts/make-golden-sample.ts:1161-1438` (`const landing` at 1165), assembled into the pack at `2207` | Writes the whole `landing` block. `npm run check:pack:sample` reads `_fixtures/golden-pack.json`; regenerate the fixture in the same change or `verify:all` diverges from what generation actually produces |
| `_fixtures/golden-pack.json` | lines `1361-1595` | The committed golden pack's `landing` block. Same regeneration |

Note that `generateOneSection` (`asset-generation.ts:1405-1421`) only ever regenerated
`file1`-`file5`, so the landing module was never individually regenerable. No change needed
there — recorded so nobody goes looking for the missing case.
