// Mechanical validator for the 10 deliverable laws.
//
// Turns the structurally-checkable parts of the "LaunchGrid Deliverable
// Generation System Prompt (v2)" laws into assertions against an AssetPack, so
// "does this pack satisfy the laws" becomes a testable property instead of a
// manual eyeball check. Laws that need human/LLM judgement (real-data grounding,
// gut-punch quality, full voice) are covered with best-effort heuristics and
// flagged as warnings rather than hard fails.
//
// Used by scripts/gen-check.ts (CLI) and safe to call anywhere — pure, no I/O.

import type { AssetPack } from "@/types";
import { PRODUCT_NAME, AGENCY_NAME } from "../brand";
import { hasInventedOffer } from "../leak-narrative";

export type CheckLevel = "pass" | "warn" | "fail";

export interface LawCheck {
  law: string; // short id, e.g. "Law 5 · dollar math"
  level: CheckLevel;
  message: string;
}

export interface ValidationResult {
  checks: LawCheck[];
  fails: number;
  warns: number;
  passed: boolean; // true when there are zero fails
}

// ── text helpers ──────────────────────────────────────────────────────────────

// Deep-walk every string value in an object graph (for keyword scans).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

// Find which of `needles` appear (word-boundary) anywhere in `haystack`.
function hits(haystack: string, needles: string[]): string[] {
  const lc = haystack.toLowerCase();
  return needles.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lc));
}

// Lead-gen language that violates the conversion-only scope (Law 2). The only
// allowed lead-adjacent topic is review-REQUEST automation (post-sale trust), so
// "review" / "referral" wording inside supporting assets is tolerated separately.
const LEADGEN_TERMS = [
  "seo",
  "paid ads",
  "google ads",
  "facebook ads",
  "ad campaign",
  "ad spend",
  "ppc",
  "social media marketing",
  "content marketing",
  "blog posts",
  "lead generation",
  "lead gen",
  "more traffic",
  "drive traffic",
  "buy traffic",
  "cold outreach",
  "cold email",
];

// Tautology / filler that Law 7 bans.
const FILLER_TERMS = [
  "leverage synergies",
  "in order to",
  "at the end of the day",
  "best practices",
  "world-class",
  "cutting-edge",
  "game-changer",
  "game changer",
  "move the needle",
  "low-hanging fruit",
  "circle back",
  "synergy",
];

// Hedge words — fine in moderation on projected outcomes, but a high density
// across the whole pack signals the "hedge-soup" Law 10 warns against.
const HEDGE_TERMS = ["may", "might", "could", "potentially", "possibly", "likely", "perhaps", "designed to"];

// Part B3 · out-of-scope recommendations. Site speed, redesign, and SEO are NOT
// part of a conversion engagement. Measured performance numbers may be shown as
// context, but the pack must NEVER prescribe a technical/SEO/redesign fix. These
// are recommendation-shaped phrases (verbs + targets), chosen to catch the PSI
// "top fixes" (reduce CSS, optimize images…) and redesign/SEO pitches without
// tripping on the measured-metric labels (Perf score, LCP, CLS).
const OUT_OF_SCOPE_RECO_TERMS = [
  "reduce css",
  "unused css",
  "minify",
  "compress images",
  "compress your images",
  "optimize images",
  "optimise images",
  "optimize your images",
  "image optimization",
  "next-gen format",
  "webp",
  "lazy load",
  "lazy-load",
  "defer offscreen",
  "render-blocking",
  "reduce javascript",
  "reduce server response",
  "improve page speed",
  "improve site speed",
  "improve your page speed",
  "speed up your site",
  "speed up the site",
  "faster load time",
  "redesign your site",
  "redesign your website",
  "redesign the site",
  "rebuild your site",
  "rebuild the site",
  "site redesign",
  "website redesign",
  "improve your seo",
  "seo optimization",
  // SEO-specific "rank higher" phrasings only — a bare "rank higher" also matches
  // legitimate lead-qualification scoring ("emergency issues rank higher in score"),
  // which is in-scope. Anchor to search context to avoid that false positive.
  "rank higher in search",
  "rank higher on google",
  "rank higher in google",
  "rank higher in search results",
  "search ranking",
  "keyword ranking",
];

// ── the validator ─────────────────────────────────────────────────────────────

export function validatePack(pack: AssetPack): ValidationResult {
  const checks: LawCheck[] = [];
  const add = (law: string, level: CheckLevel, message: string) =>
    checks.push({ law, level, message });

  const intel = pack.intelligence;
  const infra = pack.infrastructure;
  const roadmap = pack.roadmap;
  const allText = collectStrings(pack).join("\n");

  // ── Structure (is this a v2 pack at all?) ────────────────────────────────────
  if (!intel) add("Structure", "fail", "Missing `intelligence` — this is a pre-v2 (stale) pack. Regenerate.");
  if (!infra) add("Structure", "fail", "Missing `infrastructure` — pre-v2 (stale) pack. Regenerate.");
  if (!roadmap) add("Structure", "fail", "Missing `roadmap` — pre-v2 (stale) pack. Regenerate.");

  const metrics = intel?.scorecard?.metrics ?? [];
  if (intel) {
    if (metrics.length !== 9)
      add("Structure", metrics.length ? "warn" : "fail", `Scorecard has ${metrics.length} metrics, expected 9 conversion axes.`);
    if (!intel.leakAnalysis?.length)
      add("Structure", "fail", "No leakAnalysis items.");
  }

  const stages = infra?.funnel?.stages ?? [];
  if (infra && stages.length !== 6)
    add("Structure", stages.length ? "warn" : "fail", `Funnel has ${stages.length} stages, expected 6 conversion-path stages.`);

  const phases = roadmap?.phases ?? [];
  if (roadmap && phases.length !== 3)
    add("Structure", phases.length ? "warn" : "fail", `Roadmap has ${phases.length} phases, expected 3 (Setup · Stabilize · Ongoing Optimization).`);

  // ── Law 2 · conversion-only scope ────────────────────────────────────────────
  // Scan the surfaces that must stay conversion-only (funnel + roadmap + the
  // strategic intelligence). Supporting review/thank-you assets are exempt.
  const scopeText = [
    collectStrings(infra).join("\n"),
    collectStrings(roadmap).join("\n"),
    collectStrings(intel).join("\n"),
  ].join("\n");
  const leakgen = hits(scopeText, LEADGEN_TERMS);
  if (leakgen.length)
    add("Law 2 · conversion-only", "fail", `Lead-gen language in conversion surfaces: ${Array.from(new Set(leakgen)).join(", ")}.`);
  else add("Law 2 · conversion-only", "pass", "No lead-gen language in funnel/roadmap/intelligence.");

  // ── Law 2 (v3) · forbidden sections, by name ─────────────────────────────────
  // "Local Market Positioning Gap" and "Review Generation" sections are banned
  // outright (v3). The only allowed review touch is a single post-job review
  // request — so a populated localPositioningGap or a "review generation" heading
  // is a hard fail.
  const forbiddenSections: string[] = [];
  const lcAll = allText.toLowerCase();
  if (lcAll.includes("local market positioning gap")) forbiddenSections.push('"Local Market Positioning Gap" heading');
  if (lcAll.includes("review generation")) forbiddenSections.push('"Review Generation" heading');
  if (lcAll.includes("positioning gap")) forbiddenSections.push('"Positioning Gap" content');
  if (forbiddenSections.length)
    add("Law 2 · forbidden sections", "fail", `Banned section present: ${forbiddenSections.join("; ")}.`);
  else add("Law 2 · forbidden sections", "pass", "No banned (positioning-gap / review-generation) sections.");

  // ── Part B3 · no out-of-scope (speed / redesign / SEO) recommendations ────────
  // Measured PSI numbers are allowed; prescriptions are not.
  const outOfScopeRecos = hits(allText, OUT_OF_SCOPE_RECO_TERMS);
  if (outOfScopeRecos.length)
    add(
      "Part B · scope",
      "fail",
      `Out-of-scope recommendation(s) present (site speed / redesign / SEO are not in a conversion engagement): ${Array.from(
        new Set(outOfScopeRecos)
      ).join(", ")}. Keep measured data; drop the fix.`
    );
  else add("Part B · scope", "pass", "No site-speed / redesign / SEO recommendations.");

  // ── Part C2 · every BENCHMARK leak carries the kickoff-verification line ──────
  // A benchmark-tier leak isn't externally visible, so it must invite the client
  // to confirm it at kickoff. Signature: the "…comes off the list" tail of the
  // kickoff line survives minor wording drift.
  const KICKOFF_SIGNATURE = /comes off the list|verify (this|it)(?: together)? at kickoff/i;
  const benchmarkLeaks = (intel?.leakAnalysis ?? []).filter(
    (l) => l.evidenceTier === "BENCHMARK"
  );
  const missingKickoff = benchmarkLeaks.filter((l) => {
    const text = collectStrings(l).join("\n");
    return !KICKOFF_SIGNATURE.test(text);
  });
  if (benchmarkLeaks.length) {
    if (missingKickoff.length)
      add(
        "Part C · kickoff line",
        "fail",
        `${missingKickoff.length}/${benchmarkLeaks.length} BENCHMARK leak(s) miss the kickoff-verification line ("…comes off the list"): ${missingKickoff
          .map((l) => l.area)
          .join(", ")}.`
      );
    else add("Part C · kickoff line", "pass", "Every BENCHMARK leak carries the kickoff-verification line.");
  }

  // ── Part D1 · clean axes read neutral (no fabricated problem) ─────────────────
  // A scorecard axis with no fired leak grades to exactly 95 (gradeAreas special-
  // cases zero-leak areas). Its diagnosis must NOT assert a problem, gap, or loss —
  // that would be inventing a leak the taxonomy never fired (Part D).
  const PROBLEM_VOCAB =
    /\b(losing|lose|lost|bleed(?:ing)?|hemorrhag\w*|missing|missed|gap|weak(?:ness)?|leak(?:ing|s)?|broken|failing|fails|poor|hurting|costing|costs you|slipping|drop-?off|dropping|underperform\w*|deficien\w*|struggl\w*)\b/i;
  const cleanAxisViolations: string[] = [];
  for (const m of metrics) {
    if (m.score !== 95) continue; // only the deterministically-clean axes
    const diag = [m.diagnosis, m.cause, m.evidence].filter(Boolean).join(" ");
    if (PROBLEM_VOCAB.test(diag)) cleanAxisViolations.push(m.name);
  }
  if (metrics.length) {
    if (cleanAxisViolations.length)
      add(
        "Part D · clean axis",
        "fail",
        `${cleanAxisViolations.length} clean axis(es) (grade 95, no leak fired) assert a fabricated problem in their diagnosis: ${cleanAxisViolations.join(
          ", "
        )}. Clean axes must read neutral/positive.`
      );
    else add("Part D · clean axis", "pass", "Clean (grade-95) axes read neutral — no fabricated problems.");
  }

  // ── Law 11 · never print the scaffold ────────────────────────────────────────
  // Prompt scaffolding leaks as slash-delimited analysis-dimension lists in copy
  // (e.g. "headline clarity / subheadline strength / CTA visibility / ..."). A
  // value with 3+ " / "-joined short fragments is almost certainly scaffolding.
  const scaffoldHits: string[] = [];
  for (const s of collectStrings(pack)) {
    // Match the renderer's stripScaffold separator: " / " or a spaced en/em-dash.
    const segs = s.split(/\s+[/\u2013\u2014]\s+/);
    // 3+ slash-joined fragments where most are short noun-phrases = a leaked
    // checklist. Allowing one longer fragment catches scaffolds the strict
    // "every segment ≤5 words" rule used to miss.
    const shortSegs = segs.filter((seg) => seg.trim().split(/\s+/).length <= 5).length;
    if (segs.length >= 3 && shortSegs >= 3) {
      scaffoldHits.push(s.length > 80 ? `${s.slice(0, 80)}…` : s);
    }
  }
  if (scaffoldHits.length)
    add("Law 11 · no scaffold", "fail", `${scaffoldHits.length} value(s) look like leaked scaffold checklists: ${Array.from(new Set(scaffoldHits)).slice(0, 2).join(" | ")}.`);
  else add("Law 11 · no scaffold", "pass", "No leaked scaffold checklists detected.");

  // ── Law 12 · reconcile every dollar figure ───────────────────────────────────
  // The exec-summary total (if stated) must equal the sum of itemized leaks.
  // We can at least surface the itemized rolled-up total so a human/CLI sees it,
  // and flag if any single leak's number contradicts itself (low > high).
  const leaks = intel?.leakAnalysis ?? [];
  let sumLow = 0;
  let sumHigh = 0;
  let inverted = 0;
  for (const l of leaks) {
    const d = l.dollarImpact;
    if (!d) continue;
    sumLow += d.monthlyLow || 0;
    sumHigh += d.monthlyHigh || 0;
    if ((d.monthlyLow || 0) > (d.monthlyHigh || 0) && (d.monthlyHigh || 0) > 0) inverted++;
  }
  if (leaks.length) {
    if (inverted)
      add("Law 12 · reconcile $", "fail", `${inverted} leak(s) have monthlyLow > monthlyHigh — internally inconsistent.`);
    else
      add("Law 12 · reconcile $", "pass", `Itemized leaks roll up to $${Math.round(sumLow).toLocaleString()}–$${Math.round(sumHigh).toLocaleString()}/mo — any exec-summary total should match this.`);
  }

  // ── Law 13 · label every assumption, including volume ────────────────────────
  // A leadVolumeBasis that cites a number but no assumption language ("assum…",
  // "estimate", "replace with", "benchmark") risks presenting an invented volume
  // as fact.
  // Prefix match (no trailing \b) so "assum" catches "assuming/assumption",
  // "estimat" catches "estimate/estimated", etc. A trailing \b would fail to
  // match "Assuming" (no boundary between "assum" and "ing") — a false negative.
  const ASSUME_WORDS = /\b(assum|estimat|replace with|benchmark|typical|conservativ|industry)/i;
  let volumeUnlabeled = 0;
  for (const l of leaks) {
    const basis = l.dollarImpact?.leadVolumeBasis ?? "";
    if (/\d/.test(basis) && !ASSUME_WORDS.test(basis)) volumeUnlabeled++;
  }
  if (leaks.length) {
    if (volumeUnlabeled)
      add("Law 13 · label volume", "fail", `${volumeUnlabeled}/${leaks.length} leaks cite a lead volume without assumption language ("assuming…/estimate/replace with your actual number") — an invented volume is being presented as fact.`);
    else add("Law 13 · label volume", "pass", "Lead-volume bases read as labeled assumptions, not invented facts.");
  }

  // ── Law 3 · done-for-you framing + no agency name ────────────────────────────
  const badOwners: string[] = [];
  for (const s of stages) if (s.owner !== "us" && s.owner !== "you") badOwners.push(`funnel:${s.stage}`);
  for (const p of phases) if (p.owner !== "us" && p.owner !== "you") badOwners.push(`phase:${p.phase}`);
  for (const l of intel?.leakAnalysis ?? []) if (l.owner !== "us" && l.owner !== "you") badOwners.push(`leak:${l.area}`);
  if (badOwners.length)
    add("Law 3 · done-for-you", "fail", `Invalid owners (must be "us"/"you"): ${badOwners.join(", ")}.`);
  else add("Law 3 · done-for-you", "pass", "All owners are us/you.");

  // Agency name must never surface in client-facing copy (unless it's the generic
  // default "our team", which is allowed).
  if (AGENCY_NAME.toLowerCase() !== "our team" && allText.toLowerCase().includes(AGENCY_NAME.toLowerCase()))
    add("Law 3 · no agency name", "fail", `Agency name "${AGENCY_NAME}" appears in client copy.`);
  else add("Law 3 · no agency name", "pass", "Agency name not exposed in copy.");

  // ── Law 4 · retainer positioned + product named ──────────────────────────────
  const retainerStages = stages.filter((s) => s.isRetainer);
  const retainerPhases = phases.filter((p) => p.isRetainerPhase);
  if (infra && retainerStages.length !== 1)
    add("Law 4 · retainer", "fail", `Expected exactly 1 retainer funnel stage, found ${retainerStages.length}.`);
  if (roadmap && retainerPhases.length !== 1)
    add("Law 4 · retainer", "fail", `Expected exactly 1 retainer roadmap phase, found ${retainerPhases.length}.`);
  if (!allText.includes(PRODUCT_NAME))
    add("Law 4 · retainer", "fail", `Product name "${PRODUCT_NAME}" is never mentioned anywhere in the pack.`);
  else if ((infra && retainerStages.length === 1) || (roadmap && retainerPhases.length === 1))
    add("Law 4 · retainer", "pass", `"${PRODUCT_NAME}" retainer positioned in funnel and/or roadmap.`);

  // ── Law 5 · dollar impact with visible math + assumptions ────────────────────
  // Governance model: pre-intake BENCHMARK leaks make NO client-revenue claim, so
  // they carry a stamped `mathFrame` (labeled "≈ $X/mo — assuming…") and/or cited
  // stats instead of a full structured dollarImpact. A leak is quantified when it
  // has EITHER a complete structured dollarImpact OR a stamped math frame OR cited
  // stats. But some leaks are QUALITATIVE BY DESIGN — the taxonomy gives them no
  // statIds and no mathTemplate (e.g. CRM pipeline, call-tracking, payment
  // friction). Those carry `quantifiable: false` and must NOT be forced to invent
  // a number. Only a QUANTIFIABLE leak that still shows nothing is a real gap.
  let leaksUnquantified = 0;
  for (const l of intel?.leakAnalysis ?? []) {
    // Leaks stamped before this field, or with no quantification path, are
    // qualitative — skip. (undefined = legacy/unstamped, treat as qualitative.)
    if (l.quantifiable !== true) continue;
    const d = l.dollarImpact;
    const structured =
      d &&
      d.formula?.trim() &&
      d.leadVolumeBasis?.trim() &&
      d.effectSize?.trim() &&
      d.avgValueBasis?.trim() &&
      (d.monthlyLow > 0 || d.monthlyHigh > 0);
    const stamped = Boolean(l.mathFrame?.trim() || (l.allowedStats ?? []).length);
    if (!structured && !stamped) leaksUnquantified++;
  }
  if (intel?.leakAnalysis?.length) {
    if (leaksUnquantified)
      add("Law 5 · dollar math", "fail", `${leaksUnquantified} quantifiable leak(s) carry no quantification at all (no structured dollar impact, no computed math frame, no cited stat).`);
    else add("Law 5 · dollar math", "pass", "Every quantifiable leak carries visible math and/or cited industry stats; qualitative leaks correctly assert no invented figure.");
  }

  // ── Defect 1 · quantification is not gone ────────────────────────────────────
  // A report WITH fired leaks that renders ZERO stat references AND zero computed
  // math is the overcorrection we're guarding against. At least one fired leak
  // must surface a whitelisted stat or a computed dollar frame.
  const analysisLeaks = intel?.leakAnalysis ?? [];
  if (analysisLeaks.length) {
    const withStats = analysisLeaks.filter((l) => (l.allowedStats ?? []).length).length;
    const withMath = analysisLeaks.filter((l) => l.mathFrame?.trim()).length;
    if (withStats === 0 && withMath === 0)
      add("Defect 1 · quantification", "fail", `Report has ${analysisLeaks.length} fired leak(s) but ZERO cited stats and ZERO computed math frames — quantification was stripped.`);
    else add("Defect 1 · quantification", "pass", `${withStats} leak(s) cite stats; ${withMath} carry a computed math frame.`);
    // ≤2 dollar-bearing math frames per document (spend-anchored CPL leaks only).
    const dollarFrames = analysisLeaks.filter((l) => /\$\s?\d/.test(l.mathFrame ?? "") && /\/mo\b/.test(l.mathFrame ?? "")).length;
    if (dollarFrames > 2)
      add("Defect 1 · math cap", "fail", `${dollarFrames} leaks carry a dollar math frame — cap is 2 per document.`);
    else add("Defect 1 · math cap", "pass", `${dollarFrames} dollar math frame(s) (≤2).`);
  }

  // ── Defect 2 · leak section identity ─────────────────────────────────────────
  // Every leak section must be titled by a fired taxonomy leak name (stamped
  // `leakName`), not a free-text axis label. And no "critical" leak may sit on an
  // axis the scorecard rates 90+ (self-contradiction: bleeding vs. clean).
  if (analysisLeaks.length) {
    const untitled = analysisLeaks.filter((l) => !l.leakName?.trim()).length;
    if (untitled)
      add("Defect 2 · leak identity", "fail", `${untitled}/${analysisLeaks.length} leak section(s) lack a stamped taxonomy leak name (title falls back to a free-text axis label).`);
    else add("Defect 2 · leak identity", "pass", "Every leak section is titled by its taxonomy leak name.");

    const contradictions: string[] = [];
    for (const l of analysisLeaks) {
      if (l.priority !== "critical" || !l.scorecardArea) continue;
      const m = metrics.find((x) => x.name === l.scorecardArea);
      if (m && m.score >= 90) contradictions.push(`${l.leakName} (${l.scorecardArea} scores ${m.score})`);
    }
    if (contradictions.length)
      add("Defect 2 · axis coherence", "fail", `Critical leak(s) share an axis the scorecard rates 90+: ${contradictions.join(", ")}.`);
    else add("Defect 2 · axis coherence", "pass", "No critical leak contradicts a 90+ axis score.");
  }

  // ── Defect 5 · no invented offers ────────────────────────────────────────────
  // A fabricated "$N off"/"N% off" promotion anywhere in the pack is a hard fail;
  // real offers must be operator-supplied, else an editable placeholder.
  const offenders = collectStrings(pack).filter((s) => hasInventedOffer(s));
  if (offenders.length)
    add("Defect 5 · no invented offers", "fail", `${offenders.length} string(s) contain a fabricated discount amount: ${offenders.slice(0, 2).map((s) => (s.length > 60 ? s.slice(0, 60) + "…" : s)).join(" | ")}.`);
  else add("Defect 5 · no invented offers", "pass", "No invented discount/offer amounts.");

  // ── Law 6 · defensible scores (rubric + evidence) ────────────────────────────
  let metricsMissing = 0;
  for (const m of metrics) if (!m.rubric?.trim() || !m.evidence?.trim()) metricsMissing++;
  if (metrics.length) {
    if (metricsMissing)
      add("Law 6 · defensible scores", "fail", `${metricsMissing}/${metrics.length} scorecard metrics lack a rubric and/or evidence.`);
    else add("Law 6 · defensible scores", "pass", "Every score carries a rubric + evidence.");
  }

  // ── Law 7 · no tautologies / filler ──────────────────────────────────────────
  const filler = hits(allText, FILLER_TERMS);
  if (filler.length)
    add("Law 7 · no filler", "warn", `Filler/tautology phrases found: ${Array.from(new Set(filler)).join(", ")}.`);
  else add("Law 7 · no filler", "pass", "No banned filler phrases.");

  // ── Law 8 · lead with the gut-punch (heuristic) ──────────────────────────────
  const opener = (intel?.executiveSummary?.narrative ?? "").trim();
  if (opener) {
    const firstSentence = opener.split(/(?<=[.!?])\s/)[0].toLowerCase();
    const complimentOpeners = ["great", "you have a strong", "you've built", "impressive", "well done", "congratulations", "your business is doing", "kudos", "nice"];
    if (complimentOpeners.some((c) => firstSentence.startsWith(c)))
      add("Law 8 · gut-punch opening", "warn", `Exec summary may open with a compliment: "${opener.slice(0, 80)}…"`);
    else add("Law 8 · gut-punch opening", "pass", "Exec summary does not open with a compliment.");
  }

  // ── Law 10 · voice (hedge-soup density, heuristic) ───────────────────────────
  const words = allText.split(/\s+/).length || 1;
  const hedgeCount = HEDGE_TERMS.reduce((n, t) => n + (allText.toLowerCase().match(new RegExp(`\\b${t}\\b`, "g"))?.length ?? 0), 0);
  const hedgePer1k = (hedgeCount / words) * 1000;
  if (hedgePer1k > 12)
    add("Law 10 · voice", "warn", `High hedge-word density (${hedgePer1k.toFixed(1)}/1k words) — risk of hedge-soup.`);
  else add("Law 10 · voice", "pass", `Hedge density acceptable (${hedgePer1k.toFixed(1)}/1k words).`);

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  return { checks, fails, warns, passed: fails === 0 };
}

// Pretty one-line-per-check report for CLI output.
export function formatValidation(r: ValidationResult): string {
  const icon = { pass: "✓", warn: "!", fail: "✗" } as const;
  const lines = r.checks.map((c) => `  ${icon[c.level]} [${c.law}] ${c.message}`);
  const head = r.passed
    ? `PASSED — ${r.warns} warning(s), 0 failures`
    : `FAILED — ${r.fails} failure(s), ${r.warns} warning(s)`;
  return `${head}\n${lines.join("\n")}`;
}
