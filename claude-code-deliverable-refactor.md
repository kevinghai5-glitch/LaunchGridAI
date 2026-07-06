# Claude Code Task — Deliverable Generator Refactor: Leak Taxonomy Integration

## Context

LaunchGrid's internal software generates 4 consultant-grade HTML deliverables (Growth Leak Intelligence Report, Client Acquisition Infrastructure Blueprint, Conversion Asset Pack, 90-Day Growth Execution Roadmap) plus a cold audit, from real research data it collects per business: website scrape (home/service/about/contact/booking pages), PageSpeed test, screenshots of the site and competitors, Google reviews, Google Business Profile data, and local competitor comparison.

**The problem:** leak identification is currently open-ended generation. The model invents leaks freely from the scraped data, including problems LaunchGrid cannot fix in GoHighLevel/LeadGate (site redesigns, SEO, ad strategy). That breaks the offer — the $6,500 engagement is deliverables + DFY implementation of the fixes *in GHL*. A report that recommends things Kevin can't build is a report that torches credibility on the Zoom.

**The fix:** a closed leak taxonomy (`leak-taxonomy.ts`, provided alongside this file) becomes the single source of truth. The generator may only surface leaks from it, only when their detection conditions match real data, phrased at the honesty tier the evidence supports, with fixes auto-mapped from the taxonomy into the roadmap and blueprint.

This is a **governance refactor, not a redesign**. The deliverables' visual design, structure, and section layout stay as they are. What changes is *which leaks appear, why, and how they're phrased*.

---

## The target behavior (end state)

1. Every leak in any deliverable or cold audit traces to a taxonomy `id`.
2. A leak appears only when its `detection` rules matched the business's actual scraped data.
3. Each surfaced leak carries an evidence tier (OBSERVED / EVIDENCED / BENCHMARK) that controls its phrasing — facts stated as facts, inferences stated as inferences, benchmarks hedged with the kickoff-verification line.
4. Every statistic in any output exists in the taxonomy's `STATS` map. Zero exceptions.
5. Out-of-scope findings (site speed, design, GBP visibility) appear only in a clearly-framed "Also worth knowing" section — never as recommendations, never in the roadmap, never in leak counts.
6. Fired leaks auto-populate: roadmap tasks (via `ghlFix` + `roadmapPhase`), blueprint infrastructure (via funnel-stage mapping), and asset pack contents (via `assetPackItems`). No fix appears for a leak that didn't fire.
7. The cold audit is the top-3 by ranking rules, with the provability constraint (≥2 of 3 must be OBSERVED/EVIDENCED).

---

## Phase 0 — Audit (read-only; report before touching anything)

Do not modify code in this phase. Produce a short written map, then stop for review:

1. **Locate the generation pipeline.** Find where deliverable content is produced (prompt templates, generation functions, API routes). List the files.
2. **Map the data model.** Find the real shapes for scraped website data, PageSpeed results, reviews, GBP, and competitors. Produce a field-by-field mapping onto the `ScrapeData` interface in `leak-taxonomy.ts`. Where a taxonomy field has **no existing source** (e.g., `formHasQualifyingFields`, `hasClickToCallOnMobile`, `ownerResponseRate`, `recentCount90d`, `limitedHours`), list it under "detection gaps" — these become small scraper additions in Phase 2, or the affected detection rule degrades gracefully (see Phase 2 rules).
3. **Inventory the current scorecard.** List the 9 areas as currently named in code/output. Map each onto the taxonomy's `ScorecardArea` ids. Flag any area that maps to nothing (candidate for removal or a taxonomy addition — **flag, don't decide**).
4. **Find where stats/numbers currently enter output.** Any place the model can emit an uncited number is a defect to fix in Phase 4.

**Deliverable of this phase:** the mapping doc + detection-gap list + scorecard reconciliation, as a markdown file in the repo (`docs/taxonomy-integration-audit.md`). Wait for approval before Phase 1.

---

## Phase 1 — Wire the taxonomy as source of truth

1. Add `leak-taxonomy.ts` to the repo (suggested: `src/lib/leak-taxonomy.ts`). **Do not edit its contents** except to fix TypeScript compilation issues against the project's config (imports, strictness). Semantics are frozen; content changes go through Kevin.
2. Rename `ScrapeData` fields to match the real data model per the Phase 0 mapping (adapter function preferred over renaming taxonomy fields: `toScrapeData(rawResearch): ScrapeData`).
3. Export a single accessor the rest of the codebase uses: `getFiredLeaks(data: ScrapeData): FiredLeak[]` where `FiredLeak = { leak: Leak; tier: EvidenceTier; score: number; evidence: string[] }`. `evidence` holds the concrete data points that triggered detection (e.g., the matching review fragments, the observed booking-link absence) so deliverable text can cite them.

## Phase 2 — Detection engine

1. Implement each leak's `detection` rules as pure, unit-testable functions. First matching rule wins and sets the tier. No match → leak absent.
2. **Review-signal matching:** case-insensitive substring match of `REVIEW_SIGNALS` phrases against review texts; require ≥2 distinct reviews to claim EVIDENCED (per the taxonomy comment). Store the matching fragments (max ~10 words each) in `evidence`.
3. **Graceful degradation:** if a data field needed by a rule is missing/unfetched, that rule is skipped (does not fire, does not error). A leak whose only rules depend on missing data simply doesn't appear. Never guess a field's value.
4. **Suppression:** implement the intake-contradiction rule (`RULES.selection`) — e.g., `intake.hasCrm === true` suppresses `no_crm_pipeline` entirely. Implement the `no_long_cycle_nurture` fold-in rule.
5. **Detection gaps from Phase 0:** implement the small scraper/parse additions where cheap (e.g., detecting a booking link, chat widget script, click-to-call `tel:` link, CTA-above-fold heuristic, GBP hours parse, review owner-response rate). Where not cheap, leave the rule degraded and note it in the audit doc. Do not build new headless-browser infrastructure for this — work with what the pipeline already fetches.

## Phase 3 — Selection & ranking

1. Implement `RULES.ranking` exactly: `score = impactWeight × TIER_MULTIPLIER[tier] × (verticalBoost ? 1.2 : 1.0)`.
2. Report = all fired in-scope leaks ranked descending, grouped under `scorecardArea` (this drives the 9-area scorecard grades — an area's grade should now be a function of its leaks' presence/tier/score; document the grading formula you implement in the audit doc).
3. Cold audit = top 3 with the provability constraint (≥2 OBSERVED/EVIDENCED; fall back per taxonomy rules).
4. Out-of-scope flags: routed only to the "Also worth knowing" renderer. Excluded from counts, rankings, scorecard grades, roadmap, blueprint, asset pack.

## Phase 4 — Language & math enforcement

This is where hallucination actually dies. The generation prompts (or template logic) must be rebuilt so that:

1. **Leak narrative inputs are structured, not open.** For each fired leak, the model receives: `symptom`, `revenueMechanism`, tier, the `evidence` array, allowed stats (resolved `STATS` objects), and the tier's phrasing rules from `RULES.language`. The prompt instructs: write the leak section using ONLY this material. It may rephrase; it may not add facts, numbers, or claims.
2. **Tier phrasing enforced:**
   - OBSERVED → stated as fact with the observed data point.
   - EVIDENCED → signal first, inference second; review fragments quoted at most ~10 words.
   - BENCHMARK → mandatory three-part shape: (a) acknowledge it isn't externally visible, (b) the industry pattern with its stat or `softFraming`, (c) the kickoff-verification line ("We verify this together at kickoff — if you already have this covered, it comes off the list.").
3. **Stat guard:** post-generation validation pass scans output for numeric claims (percentages, multipliers, dollar figures) and verifies each against (a) the leak's allowed `STATS` entries, (b) computed math-template results, or (c) the business's own observed data (review counts, ratings, PageSpeed score). Any unmatched number → regenerate that section or strip the claim. Tier B stats may only appear via their `softFraming` string.
4. **Math templates:** implement `RULES.math` exactly. Hard split between pre-intake (spend-anchored, CPL-based, benchmark-labeled) and post-intake (client numbers). Conservative end of every range. Every computed figure rendered with its "estimated" label and the inputs visible ("based on the healthcare benchmark of…").
5. **Voice guard:** the banned-words list and banned structures from `words_to_avoid.md` (already in the project) applied to deliverable generation prompts + a post-pass lint (banned-word scan is a simple string check; fail → regenerate section). Hedged verbs required for non-OBSERVED content.

## Phase 5 — Deliverable integration

Wire `DELIVERABLE_ROUTING` per artifact. Keep the existing HTML design system; change the content plumbing only.

1. **Growth Leak Report:** ranked leak sections from fired leaks; scorecard graded from area-grouped results; `weak_landing_cta` detail feeds the existing Landing Page Conversion Intelligence section; "Also worth knowing" section added for out-of-scope flags (short, clearly framed as outside the engagement, no fixes attached).
2. **Blueprint:** each fired leak's `ghlFix.assetName` placed at its funnel stage; LeadGate config section driven by `no_lead_qualification` when fired; pipeline stage set always present via `no_crm_pipeline`'s fix definition (it's the rail, even when the leak itself was suppressed by intake).
3. **Asset Pack:** generate/customize ONLY `assetPackItems` belonging to fired leaks. If `no_follow_up_sequence` didn't fire (rare), the 7-email/6-text sequence isn't padded in.
4. **Roadmap:** fired leaks' fixes slotted into their `roadmapPhase`, ordered by score within phase; each line = assetName → leak plugged → success marker. Success markers come from the fix's measurable outcome (e.g., "missed-call recovery live; recovery rate visible in weekly report").
5. **Cold audit:** top-3 format per routing spec — symptom, evidence line, one stat, spend-anchored cost frame, one-sentence fix teaser.

## Phase 6 — Validation harness

1. **Unit tests** on detection functions: each leak gets at least one firing fixture per detection rule + one non-firing fixture.
2. **Three golden fixtures** (synthetic businesses): (a) a dentist with limited hours, no booking link, low review response; (b) a roofer with slow-response review complaints and no chat; (c) a law firm with a bare contact form and strong reviews. For each, snapshot: fired leaks + tiers + ranking + cold-audit top 3. These snapshots are the regression net for future taxonomy edits.
3. **Output validators as tests:** stat guard (no un-whitelisted numbers), banned-word lint, out-of-scope containment (no out-of-scope id appears outside "Also worth knowing"), taxonomy containment (every leak heading in output matches a taxonomy id).
4. A `pnpm test`-runnable suite; CI-friendly.

---

## Acceptance criteria

- [ ] Generating deliverables for the three golden fixtures produces only taxonomy leaks, each traceable to a fired detection rule with stored evidence.
- [ ] No number appears in any output that isn't in `STATS`, computed by a math template, or observed business data. Demonstrated by the stat-guard test.
- [ ] BENCHMARK leaks always carry the kickoff-verification line; OBSERVED leaks cite their data point.
- [ ] Out-of-scope findings appear only in "Also worth knowing", with no fix attached, in all three fixtures.
- [ ] Roadmap/blueprint/asset-pack contents are exactly the fired leaks' fixes/assets — nothing more.
- [ ] Cold audit = 3 leaks, ≥2 provable, spend-anchored framing, zero client-revenue claims.
- [ ] Existing HTML design/layout visually unchanged (spot-check against a pre-refactor output).
- [ ] Banned-word lint passes on all fixture outputs.
- [ ] `docs/taxonomy-integration-audit.md` exists with the Phase 0 mapping, detection gaps, and scorecard reconciliation.

## Deferred — do NOT build now

- Perplexity/enrichment pipeline for `revenueMechanism` / new stats (structure supports it; the pass happens later, manually).
- Admin UI for editing the taxonomy (it's a code file; edits go through git).
- Additional verticals beyond the `Vertical` union.
- New detection infrastructure (headless browser, call-testing, form-submission probes).
- A/B variants of leak copy.
- Any change to LeadGate itself, the proposal generator, or the Control Centre dashboard (separate tasks — the dashboard fix list already exists).
- PDF export changes, design-system changes, new deliverable types.

## Never

- Never generate a leak, fix, or recommendation not present in the taxonomy.
- Never emit a statistic outside `STATS`. Never state a Tier B percentage as fact.
- Never present out-of-scope items as things LaunchGrid fixes, and never let SEO / ads / site-redesign / lead-gen recommendations into any deliverable — the business is conversion, not generation.
- Never fabricate client results, testimonials, case studies, or business history.
- Never present a projection as a guarantee; never drop the "estimated" label from computed dollar figures.
- Never claim external visibility into follow-up processes, CRMs, or reminder systems — those are BENCHMARK-tier by definition until intake says otherwise.
- Never modify taxonomy semantics (weights, scopes, detection logic, stats) without explicit sign-off — compilation fixes only.
