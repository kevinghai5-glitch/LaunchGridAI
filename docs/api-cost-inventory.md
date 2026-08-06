# External API call inventory — per business, per generation

**Purpose of this document.** It is a factual inventory of every external API call
the ReclaimedHQ deliverable pipeline makes for one business, counted by reading
the source, so that unit economics can be calculated once pricing tiers are
supplied. It is written to be handed to an analyst (human or LLM) who has the
account pricing this document deliberately does not assert.

**Everything below marked VERIFIED was read out of the code**, file and line
cited. Everything marked UNKNOWN is genuinely not determinable from the
repository and must not be assumed. A number invented to fill an UNKNOWN would
be worse than no number, because it would be indistinguishable from a measured
one in the final calculation.

---

## 1. The architectural fact that governs cost

**Scraping and generation are separate, separately-billed events.**

There are two persisted caches on the `Business` row, both with a **30-day TTL**:

| Cache | Column | TTL constant |
|---|---|---|
| Research snapshot | `researchSnapshot` / `researchSnapshotAt` | `RESEARCH_SNAPSHOT_TTL_MS` — `src/lib/research-snapshot.ts:32` |
| PageSpeed snapshot | `psiSnapshot` / `psiSnapshotAt` | `PSI_SNAPSHOT_TTL_MS` — `src/lib/psi-snapshot.ts:16` |

Generating a deliverable pack **reads these caches**. It does not scrape. Only an
explicit operator "refresh research" action busts them
(`src/app/api/generate/assets/route.ts:88-93`, `forceRefresh: refreshResearch`).

**Consequence for the cost model:** vendor scrape cost is incurred **once per
business per 30 days**, not once per pack. LLM cost is incurred **on every pack
generation**. These must be modelled as two separate line items, not summed into
a single "cost per pack".

---

## 2. Scrape-layer calls — incurred once per business per 30 days

All five run in parallel from one function
(`captureResearch`, `src/lib/research-snapshot.ts:93-100`), plus PageSpeed which
is a sibling snapshot.

| Vendor | Endpoint | Calls | Source |
|---|---|---|---|
| **Google Places** | `https://places.googleapis.com/v1/places:searchText` | **2** | `fetchPlaceReviews` (`google-places.ts:204`), `findCompetitors` (`google-places.ts:245`) |
| **Google Places (photo)** | `…/{photoName}/media` | **0–1** | `resolvePhotoUrl` (`google-places.ts:75`) — reached only via `findCompetitors` when a result carries a photo (`google-places.ts:140`); **conditional, not guaranteed** |
| **Firecrawl** | `https://api.firecrawl.dev/v1` (scrape) | **1–4** | `firecrawlSite` (`firecrawl.ts:216`): homepage always (`:231`), plus up to `maxSubpages = 3` high-signal subpages (`:218`, `:234-235`) |
| **DataForSEO** | `POST /v3/business_data/google/my_business_info/live` | **1** | `fetchGbpProfile` (`dataforseo.ts:157`) |
| **DataForSEO** | `POST /v3/business_data/google/reviews/live` | **1** | `fetchDfsReviewIntel` (`dataforseo.ts:282`) |
| **Google PageSpeed** | `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` | **2** | `runOne` called for `"mobile"` and `"desktop"` (`pagespeed.ts:142-143`) |

**Not billed, listed for completeness:** `fetchWebsitePage`
(`src/lib/website-analyzer.ts`) performs a plain HTTP GET against the prospect's
own website. No vendor, no cost.

### Scrape totals per business per 30 days

- **Minimum: 7 billable calls** (2 Places + 1 Firecrawl + 2 DataForSEO + 2 PSI)
- **Maximum: 11 billable calls** (3 Places incl. photo + 4 Firecrawl + 2 + 2)
- **Typical: 9–10**, since most sites expose at least two of the targeted
  subpages (services / about / contact / pricing / book).

Firecrawl is the only vendor whose call count varies with the target site.

---

## 3. LLM calls — incurred on every pack generation

| Setting | Value | Source |
|---|---|---|
| Model | `gpt-4o-mini` | `ASSET_MODEL`, `src/lib/openai.ts:19` (override: `OPENAI_ASSET_MODEL`) |
| Endpoint | `chat.completions.create` | `asset-generation.ts:808` |
| Temperature | `0.7` | `asset-generation.ts:812` |
| `max_tokens` | **set per part (2026-08-05)** | `PART_MAX_TOKENS`, `asset-generation.ts` — 6,144–12,288 by part; a hit throws (finish_reason "length") rather than shipping a truncated doc |
| Calls per pack | **11** | `ASSET_PACK_PARTS = 11`, `asset-generation.ts:2504` |

**Retry behaviour materially affects cost.** Each of the 11 generations may fire
**one** corrective regeneration when the output fails a governance lint
(`asset-generation.ts:953` initial, `:981` corrective). The retry sends a longer
prompt than the original (it appends the violation report).

- **Best case: 11 calls.**
- **Worst case: 22 calls.**
- Real-world rate is UNKNOWN — not instrumented.

**Prompt size is large and variable.** Each prompt embeds the scraped corpus
(homepage + subpage text, reviews, competitor data, GBP intelligence). Cost is
therefore dominated by input tokens, not by call count.

---

## 4. ScreenshotOne — fetch-once-and-store (fixed 2026-08-05)

`buildScreenshotBundle` (`screenshotone.ts`) still constructs the signed URLs,
but they are no longer delivered. `materializeScreenshotBundle`
(`src/lib/screenshot-store.ts`), called immediately after the bundle is built
(`src/app/api/generate/assets/route.ts`), fetches each shot's bytes ONCE at
generation, stores them (`StoredScreenshot`), and rewrites every `imageUrl` to
our own `/api/assets/screenshot/<id>` route.

**Billing shape is now fixed and bounded:** exactly **one ScreenshotOne render
per image at generation**, up to `(1 target + 3 competitors) × 2 viewports = 8`.
The delivered document serves our stored copy, so a client opening their pack 20
times triggers **zero** additional renders — the previous behaviour (a signed
`<img>` re-rendering, and re-billing, on every open) is gone.

**Credential leak closed too.** A signed URL carries `access_key` in plain sight;
none now reaches client HTML. Two independent gates enforce it: materialize
replaces every URL, and `renderVisuals` (`exporters/_shell.ts`) independently
drops any `<img>` whose src still `carriesScreenshotCredential`. Covered by
`scripts/verify-screenshots.ts`.

---

## 5. Summary table

### Cold business (first ever pack)
| Layer | Calls |
|---|---|
| Scrape (Places, Firecrawl, DataForSEO, PSI) | 7–11 |
| OpenAI (`gpt-4o-mini`) | 11–22 |
| **Total HTTP** | **18–33** |

### Warm business (regenerated within 30 days)
| Layer | Calls |
|---|---|
| Scrape | **0** |
| OpenAI | 11–22 |
| **Total HTTP** | **11–22** |

---

## 6. UNKNOWN — required inputs the code cannot supply

A cost-per-business or cost-per-1,000 figure **cannot be derived from this
repository alone.** Two inputs are missing:

**6.1 — Pricing tiers.** Credentials live in `.env` (not read), and tier is an
account-level setting that does not appear in source at all. Required:

- Google Places — which SKU each call bills as (Text Search Essentials vs Pro
  materially changes the rate), and whether the $200/mo free credit applies
- Firecrawl — plan and per-scrape credit cost
- DataForSEO — per-call price for the two `/live` endpoints (live pricing differs
  from standard/queued)
- Google PageSpeed — quota tier (commonly free within limits)
- OpenAI — negotiated rate, if any, vs list price for `gpt-4o-mini`

**6.2 — Token volume per pack.** The dominant LLM cost driver. Not instrumented:
nothing in the code records `usage.total_tokens`. Without it, any OpenAI cost
figure is a guess.

---

## 7. Recommended next step before any modelling

The OpenAI response object returns `usage.total_tokens` on every call. Summing it
across the 11 (or up to 22) calls and logging it per generation would convert
6.2 from an estimate into a measurement, permanently. This is a small change,
localised to `generateJson` in `src/lib/asset-generation.ts`.

Until then, the cheapest accurate path is empirical: generate one pack and read
the actual spend from the OpenAI dashboard. That yields true per-business LLM
cost with no modelling assumptions at all.

---

*Counts verified against the repository at commit `eb49b59`. Every figure above
is a call count read from source; no pricing is asserted anywhere in this
document.*
