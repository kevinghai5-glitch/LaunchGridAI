# Taxonomy Integration — Phase 0 Audit (read-only)

Status: **read-only audit complete. No code modified.** Awaiting approval before Phase 1.

This document maps the existing LaunchGrid generation pipeline onto `leak-taxonomy.ts`,
lists the detection gaps, reconciles the current scorecard with the taxonomy's 9 areas,
and inventories where uncited numbers currently enter output. It is the deliverable
required by Phase 0 of `claude-code-deliverable-refactor.md`.

---

## 1. The generation pipeline (files)

### 1a. Data collection / enrichment (the real "ScrapeData" sources)
| File | Produces | Notes |
|---|---|---|
| `src/lib/google-places.ts` | `PlaceResult`, `PlaceReview[]`, `CompetitorResult[]` | Google Places: business metadata, up to **5** reviews, up to 8 competitors |
| `src/lib/website-analyzer.ts` | `{ text, html }` | Legacy native page fetch (fallback when Firecrawl unused) |
| `src/lib/firecrawl.ts` | `FirecrawlScrape` (homepage + subpages: markdown/html/links) | Multi-page crawl; primary site source |
| `src/lib/audit-intelligence.ts` | `AuditIntelligence` (`WebsiteSignals`, `ReviewIntel`, `CompetitorIntel`) | **Heuristic signal layer** — regex/keyword detection over HTML + reviews + competitors |
| `src/lib/business-facts.ts` | `BusinessFacts` | Source-tagged facts: phones, booking links, social links, hours, services, certs, guarantees |
| `src/lib/pagespeed.ts` | `PsiBundle` (mobile/desktop) | Real Core Web Vitals via Google PSI |
| `src/lib/dataforseo.ts` | `DataForSeoBundle` (`GbpProfile`, `DfsReviewIntel`) | GBP completeness + up to **20** reviews w/ sentiment |
| `src/lib/screenshotone.ts` | `ScreenshotBundle` | Above-the-fold shots (target + competitors) — **not analyzed programmatically** |

### 1b. Orchestration
- `src/lib/cold-audit-pipeline.ts` — gathers all signals → `buildAuditIntelligence()` → `generateColdAudit()`.
- `src/app/api/generate/cold-audit/route.ts` — cold-audit endpoint.
- `src/app/api/generate/assets/route.ts` — full-pack endpoint (streams NDJSON progress).
- `src/app/api/generate/proposal/route.ts` — proposal (uses cold audit as fallback).

### 1c. Content generation (the model calls — where leaks are *invented today*)
- `src/lib/cold-audit.ts` — `generateColdAudit()`: 1 model call, open-ended "3–5 findings".
- `src/lib/asset-generation.ts` — **10 parallel model calls** making the pack:
  - `generateFile1`..`generateFile5` (audit+landing, qualification, email, SMS, booking)
  - `generateIntelligence` (**the 7-metric scorecard + leak analysis** — the core to govern)
  - `generateInfrastructure` (6-stage funnel + 9-stage pipeline + 4 tiers)
  - `generateSupportingAssets`, `generateRoadmap`, `generateLandingModule`
- Governing prompt today = `STYLE_RULES` (asset-generation.ts:59–90) + `COLD_AUDIT_RULES` (cold-audit.ts:29–45). **These are open-ended: the model freely invents leaks, numbers, and dollar figures.** This is exactly what the taxonomy replaces.

### 1d. Rendering (HTML deliverables)
- `src/lib/exporters/deliverables.ts` — the 4 deliverables incl. `renderScorecard()` (lines ~243–262).
- `src/lib/exporters/cold-audit-html.ts` — cold-audit HTML + `enforceColdAuditLaws()`.
- `src/lib/exporters/_shell.ts` (shell/CSS/glossary), `index.ts` (ZIP orchestrator + rendered-HTML governance), `validate-pack.ts` (already asserts `metrics.length === 7`).
  - Note: the old `html.ts` / `pdf.tsx` / `docx.ts` / `txt.ts` / `niche-theme.ts` exporter cluster was deleted — it had zero importers. Deliverable rendering is HTML-only via `deliverables.ts`.

---

## 2. Data-model mapping onto `ScrapeData`

Legend: ✅ available · ⚠️ partial/proxy · ❌ **detection gap**

### `business`
| Taxonomy field | Real source | Status |
|---|---|---|
| `name` | `Business.name` / Places | ✅ |
| `industry: Vertical` | `Business.industry`/`category` (free string) | ⚠️ **needs mapping** — current value is a free-text Google category, not the 9-member `Vertical` union. Needs a `category → Vertical` classifier (with a `home_services_other` fallback). Drives `verticalBoost` + vertical stats. |
| `city` | `Business.city` | ✅ |
| `phone` | Places `phone` / `BusinessFacts.phones` | ✅ |
| `websiteUrl` | `Business.website` | ✅ |

### `website`
| Taxonomy field | Real source | Status |
|---|---|---|
| `pagesFound` (`home/services/about/contact/booking`) | Firecrawl subpages + `links` | ⚠️ pages/links exist but are **not classified** into that enum set |
| `pageText: Record<string,string>` | Firecrawl homepage/subpage markdown | ⚠️ available **per page** but currently merged into one corpus, not keyed |
| `hasContactForm` | `WebsiteSignals.formDetected` | ✅ |
| `formHasQualifyingFields` | — | ❌ **gap** — `formDetected` is boolean only; no field-content analysis |
| `hasOnlineBookingLink` | `WebsiteSignals.bookingDetected` / `bookingProviders` / `BusinessFacts.bookingLinks` / `gbp.hasBookingLink` | ✅ (strong — multiple corroborating sources) |
| `hasChatWidget` | `WebsiteSignals.marketing.chat` (non-empty) | ✅ |
| `hasClickToCallOnMobile` | `WebsiteSignals.phoneClickable` (`href=tel:`) | ⚠️ proxy — detects click-to-call site-wide, **not mobile-specifically** |
| `hasPrimaryCtaAboveFold` | `WebsiteSignals.ctaDetected` (presence only) | ❌ **gap** — no above-the-fold positional detection |
| `servicePagesHaveCtas` | — | ❌ **gap** — no per-service-page CTA detection |
| `mentionsTextingOption` | — | ❌ **gap** — no "text us" detection (cheap regex add) |
| `linksToFacebook` | `BusinessFacts.socialLinks` (facebook) | ✅ |
| `linksToInstagram` | `BusinessFacts.socialLinks` (instagram) | ✅ |

### `pageSpeed`
| Taxonomy field | Real source | Status |
|---|---|---|
| `mobileScore` | `psi.mobile.performanceScore` | ✅ |
| `lcpSeconds` | `psi.mobile.metrics.lcpSeconds` | ✅ |

### `googleReviews`
| Taxonomy field | Real source | Status |
|---|---|---|
| `rating` | Places `rating` / `Business.rating` | ✅ |
| `count` | `Business.reviewCount` / Places `userRatingsTotal` | ✅ (total). Note: **sampled** review *texts* are only 5 (Places) / 20 (DFS). |
| `recentCount90d` | — | ❌ **gap** — no 90-day windowing. DFS reviews carry `timestamp`; **derivable** from DFS. Places `when` is relative text only. |
| `ownerResponseRate` | — | ❌ **gap** — owner replies are **not fetched** by Places or DFS. Blocks `unanswered_reviews` (OBSERVED). |
| `reviewTexts` | `PlaceReview.text[]` / DFS review texts | ✅ but **shallow** (5–20 reviews) — see §3 note on the ≥2-review EVIDENCED threshold |

### `gbp`
| Taxonomy field | Real source | Status |
|---|---|---|
| `hoursListed` | `dfs.gbp.hasHours` | ✅ |
| `limitedHours` (evenings+weekends closed) | raw `work_time` (unparsed) | ❌ **gap** — only a boolean `hasHours`; no evening/weekend parse. Blocks `no_after_hours_coverage` (OBSERVED). |
| `hasBookingLink` | `dfs.gbp.hasBookingLink` | ✅ |
| `messagingEnabled` | — | ❌ **gap** — GBP messaging attribute not pulled |

### `competitors`
| Taxonomy field | Real source | Status |
|---|---|---|
| `name` / `rating` / `reviewCount` | `CompetitorResult` | ✅ |
| `hasOnlineBooking` | — | ❌ **gap** — `findCompetitors` doesn't fetch competitor site signals |
| `hasChatWidget` | — | ❌ **gap** — same |

### `intake` (post-close)
Entirely **absent pre-sale by design** (not a gap). Every intake-gated rule must fire at
BENCHMARK tier pre-intake and honor suppression once intake data exists (`RULES.selection`).

### Detection-gap summary (Phase 2 targets)
**Cheap scraper/parse additions (do in Phase 2):**
- `mentionsTextingOption` — regex "text us"/"text me" on site copy.
- `recentCount90d` — count DFS review `timestamp`s within 90 days.
- `formHasQualifyingFields` — inspect form input labels/names for budget/timeline/service/zip.
- `limitedHours` — parse DFS `work_time` for evening/weekend closure.
- `hasPrimaryCtaAboveFold` / `servicePagesHaveCtas` — heuristic on first-N-chars of homepage markdown / per-subpage CTA scan.
- `industry → Vertical` classifier from Google category string.

**Not cheap / degrade gracefully (leave rule degraded, note it):**
- `ownerResponseRate` — requires fetching owner replies (new Places/DFS field or call). Blocks `unanswered_reviews` OBSERVED.
- `gbp.messagingEnabled` — requires a GBP attribute not currently pulled.
- competitor `hasOnlineBooking` / `hasChatWidget` — would require crawling each competitor site (avoid new headless infra).

Per Phase 2 rule 3, any leak whose only detection rules depend on a missing field simply
does not fire (no error, no guess).

---

## 3. Scorecard reconciliation

**Current output = 7 axes** (asset-generation.ts:492–500; enforced by `validate-pack.ts` `!== 7`):
1. Speed-to-Lead · 2. Lead Capture · 3. Lead Qualification · 4. Follow-Up ·
5. Booking & No-Show · 6. On-Page Conversion · 7. On-Page Trust.
Prompt explicitly **forbids** "Review Count" and "Local Authority" as standalone scores
(good — aligns with the taxonomy's conversion-only stance; review velocity is treated as
conversion-side reputation, not lead-gen).

**Taxonomy = 9 `ScorecardArea` ids.** Mapping:

| Taxonomy `ScorecardArea` | Current axis | Reconciliation |
|---|---|---|
| `response_speed` | Speed-to-Lead | ✅ 1:1 |
| `call_capture` | Lead Capture | ✅ (covers `missed_calls_no_recovery`, `no_webchat`, `social_dm_unmanaged`) |
| `after_hours_coverage` | — | ❌ **no current axis** — `no_after_hours_coverage` has no scorecard home |
| `online_booking` | (half of) Booking & No-Show | ⚠️ merged with show-rate |
| `lead_qualification` | Lead Qualification | ✅ (also `weak_landing_cta`, whose `scorecardArea` = `lead_qualification`) |
| `follow_up_nurture` | Follow-Up | ✅ |
| `show_rate_protection` | (half of) Booking & No-Show | ⚠️ merged with online_booking |
| `pipeline_tracking` | — | ❌ **no current axis** — `no_crm_pipeline`, `no_call_tracking` have no home |
| `reputation_social_proof` | On-Page Trust (partial) | ⚠️ On-Page Trust ≈ on-page proof placement; taxonomy area also spans `low_review_velocity` + `unanswered_reviews` |

**Flags (not decisions — per Phase 0 instruction):**
- **Axis count mismatch (7 vs 9).** Two taxonomy areas — `after_hours_coverage` and
  `pipeline_tracking` — have **no** current scorecard axis. Their leaks currently have
  nowhere to grade.
- **"On-Page Conversion" maps to nothing clean** in the taxonomy. On-page conversion is
  represented by `weak_landing_cta`, which the taxonomy files under `lead_qualification`.
  Decision needed: keep "On-Page Conversion" as a display axis, or fold into
  `lead_qualification`.
- **"Booking & No-Show" is one axis covering two taxonomy areas** (`online_booking` +
  `show_rate_protection`). Splitting to match taxonomy would move 7→8; adding
  `after_hours_coverage` + `pipeline_tracking` → 9 or 10.
- **Grading formula does not yet exist per-area.** Today each metric `score` (0–100) is
  **model-invented** (see §4). Phase 3 requires the grade to become a function of an area's
  fired leaks (presence/tier/score). That formula is not implemented; it must be designed
  and documented in Phase 3.
- `validate-pack.ts` hard-asserts exactly 7 metrics — will need updating in Phase 5/6 to
  whatever final axis set is chosen.

---

## 4. Where numbers currently enter output (Phase 4 defects)

Three classes, per source review + a repo scan:

### (a) Hardcoded in code — presentational, low risk
- `deliverables.ts:48–50, 226–228` — scorecard grade thresholds (80 / 55) for
  strong/mixed/weak labels. Rendering logic, not a factual claim. Acceptable.
- `_shell.ts` — LCP/CLS/INP glossary strings; PSI metric display (`${lcpSeconds}s`, etc.).
  Real measured data, fine.

### (b) Benchmark stats baked into prompt strings the model is told it may cite — **NOT in `STATS`**
These are the uncited-number source to eliminate in Phase 4:
- `asset-generation.ts:82` — "each +1s mobile LCP beyond ~2.5s ≈ **5–10%** relative conversion drop".
- `asset-generation.ts:83` — "sub-5-minute response vs hours can multiply contact-to-lead rates **~5–8x**".
- `asset-generation.ts:84–86` — "no nurture… most not-ready leads lost", "no-shows… a large share" (soft, but uncited).
- `asset-generation.ts:59,63` — "$6,000" / "~$6k" engagement price (context; not a leak stat but appears in copy).
- `cold-audit.ts:101` — example "**$3,200–$5,800**/month" gut-punch (teaches the model to invent a dollar range).
> None of `5–10%`, `5–8x`, `2.5s` exist in taxonomy `STATS`. The closest legitimate stats
> are `speed_5min_21x` / `speed_1hr_7x` / `speed_close_32_vs_12`, whose framing differs.
> Phase 4 must replace these prompt-baked multipliers with `STATS`-sourced claims + the
> `RULES.math` templates (spend-anchored pre-intake).

### (c) Free-invented by the model per business — **the core hallucination surface**
- `generateIntelligence` (asset-generation.ts:506, 520–524): `dollarImpact.{monthlyLow,
  monthlyHigh, effectSize, leadVolumeBasis, avgValueBasis, formula}` and every scorecard
  `score` (0–100) are model-produced with no `STATS` guard.
- `cold-audit.ts` `headlineCost` + each finding's `whyItCosts` — free-invented dollar ranges
  (Law 2 actively *instructs* the model to produce a dollar gut-punch).
- `generateFile1` `revenueLeaks[].impact/urgency/difficulty`, exec-summary totals.
- `cold-audit-html.ts:91` — hardcoded **fallback** "$3,500–$7,000" assumption when the model
  returns none.

**Legitimate (keep):** PSI metrics overlaid from the real API in `generateFile1`
(asset-generation.ts:305–323) and `cold-audit.ts:153–163` — observed data, allowed.

Phase 4 stat-guard must scan generated output for any numeric claim and validate it against
(a) the fired leak's allowed `STATS`, (b) a `RULES.math` template result, or (c) the
business's own observed data (review count, rating, PSI score) — else regenerate/strip.

---

## 5. Headline conclusions for Phase 1+

1. **No schema/data-collection blocker for the majority of leaks.** Booking, chat,
   forms (presence), click-to-call, social links, reviews text, ratings, competitor
   counts, PSI, GBP completeness are all already collected → most in-scope leaks are
   detectable now.
2. **Adapter, not rename.** Build `toScrapeData(rawResearch): ScrapeData` over
   `AuditIntelligence` + `BusinessFacts` + `PsiBundle` + `DataForSeoBundle` + Places, rather
   than renaming taxonomy fields (per Phase 1.2).
3. **Six cheap detection additions** unlock the remaining OBSERVED/EVIDENCED tiers
   (texting option, recent-90d, form-qualifiers, limited-hours, above-fold CTA, vertical
   classifier). Three are genuinely hard and should degrade gracefully
   (`ownerResponseRate`, GBP messaging, competitor site signals).
4. **Scorecard needs a structural decision** (7→9 axes) and a **new area-grading formula**
   (Phase 3) — today scores are invented.
5. **Number hallucination is systemic**, concentrated in `generateIntelligence` and the
   cold audit. The prompt-baked multipliers (5–8x, 5–10%) and the free dollar fields are the
   two things Phase 4's stat-guard + `RULES.math` templates must replace.

---

**Phase 0 complete. No files modified besides this audit doc and the two source files
(`leak-taxonomy.ts`, `claude-code-deliverable-refactor.md`) saved verbatim at repo root.
Stopping for review before Phase 1.**
