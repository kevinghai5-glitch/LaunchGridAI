# Prospecting path — external API calls per business

**Scope.** What fires when the operator clicks *Generate* on the Opportunities
screen and receives N businesses for the call queue. This is the PRE-PAYMENT
path. It is a different code path from deliverable generation and shares none of
its scrape layer.

Entry point: `POST /api/opportunities/generate` → `gatherProspects()` +
`writeAngles()` (`src/lib/daily-prospects.ts`).

---

## 1. The direct answer

**Question asked:** does prospecting fire Firecrawl, DataForSEO reviews,
DataForSEO GBP, desktop PageSpeed, or the competitor search?

**Answer: none of them. Zero. Not one of the five.**

| Service | Fires during prospecting? |
|---|---|
| Firecrawl (1–4 scrapes) | **No** |
| DataForSEO — reviews | **No** |
| DataForSEO — GBP profile | **No** |
| PageSpeed — mobile | **No** |
| PageSpeed — desktop | **No** |
| Places — competitor search (`findCompetitors`) | **No** |

Verified structurally: `daily-prospects.ts` imports exactly two external clients
— `searchBusinesses` from `google-places` and `openai` (lines 10–11). It imports
no other vendor module, so no other vendor call is reachable from this path.

One thing was cut: Place Photos hydration, which used to run on every raw search
result rather than on the leads actually kept. See the correction in §2.

---

## 2. What it actually calls

| Vendor | Endpoint (SKU) | Calls | Unit |
|---|---|---|---|
| **Google Places** | `places:searchText` (Text Search) | 1 | **per PAGE of 20 results**, per metro |
| **Google Places** | `{photo}/media` (Place Photos) | 1 | **per prospect KEPT** |
| **OpenAI** | `chat.completions` (`DEFAULT_MODEL`) | `ceil(N / 8)` | **per batch of 8 prospects** |

> **Correction (2026-08-05).** An earlier revision of this table listed Text
> Search alone and concluded "nothing to cut". That was wrong: it missed the
> Place Photos SKU entirely. `runTextSearch` hydrated a photo URL for **every raw
> result it fetched**, one billed call each, *before* scoring discarded ~75% of
> them. At a 77-lead batch that was roughly **200+ Photo calls to keep 77** —
> the largest single line in the prospecting path, and it was invisible in this
> document. It is now deferred (see below) and the table above is the corrected
> shape.

**Text Search, per page not per business.** Text Search returns 20 per page and
hard-caps at 60 (3 pages); each page is its own billed request. `gatherProspects`
scales depth per metro with the requested count and stops as soon as
`collected.length >= count * 2.5`, so pages are only bought when the batch size
actually needs them.

**Place Photos, per KEPT prospect.** Metro searches now run with
`{ resolvePhotos: false }`, which returns the raw photo resource name instead of
paying to resolve it. `hydratePhotoUrls` then runs once, on the ranked-and-sliced
survivors only. So this SKU is billed **exactly `N` times for an `N`-lead
batch** — no longer a multiple of how wide the search had to cast.

**OpenAI, batched at 8.** `ANGLE_CHUNK_SIZE = 8`; chunks run in parallel. This
writes the outreach angle, not the four observed values.

### Cost per business, structurally

Text Search and OpenAI **amortise across the batch** — marginal cost of one more
prospect is a fraction of a search page plus one-eighth of an LLM call. Place
Photos does **not** amortise: it is exactly one call per lead delivered. That is
the floor, and it is the right floor — it is the only one of the three that
scales with what he actually receives rather than with what was searched.

Price the three against the current SKU rates on the Google Cloud billing page
rather than a number quoted here; the SKU names above are what to look for.

---

## 3. The finding that matters more than the cost

**The four observed-facts values are ALL EMPTY for a freshly prospected
business.** The row renders four dashes for exactly the businesses in the call
queue — the case it was built for.

Why, mechanically:

1. `observedFactsFor()` (`src/lib/observed-facts.ts`) derives all four values
   from `Business.researchSnapshot` and `Business.psiSnapshot`.
2. Those columns are written **only** by `resolveResearchSnapshot()` /
   `resolvePsiSnapshot()`.
3. Those two functions have exactly **one caller in the entire codebase**:
   `src/app/api/generate/assets/route.ts:92-93` — the PAID deliverable
   generation path.
4. The prospecting path never calls them. A prospected business has both columns
   `null`.

**Consequence:** the data required for the pre-call row only exists *after* a
client has paid and a pack has been generated. The call-queue row is
structurally empty at the moment it is needed.

This is a wiring gap, not a cost problem, and it is invisible in testing with
established businesses (whose snapshots exist from earlier pack runs).

---

## 4. What each of the four values would cost to populate

Minimum calls to fill the row for one prospect, if this gap is closed:

| Value | Source needed | Marginal calls |
|---|---|---|
| Review count | **Already free** — Places Text Search returns `userRatingCount` in the existing field mask (`google-places.ts:108`) | **0** |
| Local median | **Already free** — `gatherProspects` already builds a per-metro `Benchmark[]` of `{name, reviews}` from the same search batch (`daily-prospects.ts:50-70`) | **0** |
| Mobile speed | PageSpeed, `strategy: "mobile"` only | **1** |
| Booking link present | A page fetch + link detection | **1** |
| Click-to-call present | Same fetch as above (`tel:` link in the same HTML) | **0 additional** |

**Two of the four values are already in hand and are being discarded.** Review
count is in the Places response. The local median is computed during prospecting
for the finding-selection logic and then dropped — it is not persisted to the
`Business` row.

**Marginal cost to complete the row: ~2 calls per business** (one mobile
PageSpeed, one page fetch). Notably:

- **Desktop PageSpeed is not needed** — the row shows mobile only. That is half
  the current PSI cost avoided.
- **Firecrawl is not needed** for booking-link and click-to-call detection. Both
  are `href` pattern checks answerable from a plain HTTP GET of the homepage
  (the same thing `fetchWebsitePage` in `src/lib/website-analyzer.ts` already
  does, unbilled). Firecrawl's multi-page markdown extraction exists to feed
  deliverable prose, not these two booleans.
- **DataForSEO is not needed** — its GBP and review endpoints feed leak
  detection for the paid report, not the four values.

---

## 5. Recommendation

Do not add the deliverable scrape layer to prospecting. To fill the row at
minimum cost:

1. **Persist what is already free** — write review count and the metro benchmark
   median onto the `Business` row at prospect-creation time. Two of four values,
   zero additional API calls.
2. **Add one mobile-only PageSpeed call**, not the mobile+desktop pair.
3. **Add one plain homepage GET** for the two link booleans, reusing the existing
   unbilled `fetchWebsitePage`, not Firecrawl.

Estimated marginal cost per prospect: **2 billable calls**, versus the 7–11 the
deliverable path uses.

---

## 6. Token accounting — implemented

`usage.total_tokens` is now recorded on every LLM request in the deliverable
pipeline.

- Counted in `rawGenerateJson` (`src/lib/asset-generation.ts`), the single place
  a request is issued — so corrective retries are counted automatically and
  cannot be missed by a future caller.
- Reset per run at the top of `generateAssetPack`.
- Logged on completion: call count, prompt tokens, completion tokens, total.
- `readTokenUsage()` is exported for any caller that wants to persist or display
  it.

The logged `calls` value above 11 is the corrective-retry count made visible for
the first time.

**Prospecting is now instrumented too (2026-08-05).** `writeAngles`
(`src/lib/daily-prospects.ts`) carries the same accounting as the deliverable
pipeline: a module-scoped accumulator, `resetProspectingTokenUsage()` at the top
of each run, counting at the single issue point (`writeAnglesChunk`, where
`res.usage` is read), and `readProspectingTokenUsage()` exported. On completion it
logs `[prospecting] writeAngles: N prospects · C LLM call(s) · T total tokens
(prompt …, completion …)`. Prospecting spend is measured now, not estimated.

---

*Verified by reading the repository. No pricing is asserted; call counts only.*
