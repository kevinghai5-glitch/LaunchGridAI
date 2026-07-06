// V2 flagship deliverable composer.
//
// Reorganizes the underlying file1..file5 content PLUS the V2 strategic
// components (intelligence, infrastructure, supportingAssets, roadmap) into the
// FOUR client-facing flagship deliverables the platform now sells:
//
//   D1  Growth Leak Intelligence Report          (diagnosis)
//   D2  Client Acquisition Infrastructure Blueprint (architecture)
//   D3  Conversion Asset Pack                     (supporting assets)
//   D4  90-Day Growth Execution Roadmap           (execution guidance)
//
// All V2 components are optional on AssetPack — when missing (pre-V2 packs),
// every renderer falls back to the underlying file content so old packs still
// produce a complete, premium document.

import type {
  AssetPack,
  DeliverableId,
  ScorecardMetric,
  LeakAnalysisItem,
  DollarImpact,
  DeployOwner,
  FunnelStage,
  CrmStage,
  LeadTier,
  RoadmapPhase,
  LandingPageIntelligence,
  LandingPageAssets,
  LandingDiagnosisPoint,
} from "@/types";
import { OWNER_US, OWNER_YOU } from "../brand";
import {
  esc,
  para,
  list,
  section,
  shell,
  pill,
  renderTechnicalUx,
  renderVisuals,
  emailBlock,
  type ShellOptions,
} from "./_shell";

// ── Small local presentation helpers ─────────────────────────────────────────

function gradeClass(score: number): string {
  if (score >= 80) return "grade-strong";
  if (score >= 55) return "grade-mid";
  return "grade-weak";
}

function dial(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return `<div class="score-dial ${gradeClass(
    s
  )}" style="--dial:${s}"><span>${s}</span></div>`;
}

function priorityClass(priority: string | undefined): string {
  const p = String(priority ?? "").toLowerCase();
  if (p === "critical") return "crit";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function kv(label: string, value: string | undefined): string {
  if (!value) return "";
  return `<div class="kv"><div class="k">${esc(label)}</div><div>${esc(value)}</div></div>`;
}

function checklist(items: string[] | undefined): string {
  if (!items?.length) return "";
  return `<ul class="checklist">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

// Owner tag — done-for-you framing (Law 3). "us" → "Deployed by us",
// "you" → "You (owner)". Never names the agency.
function ownerLabel(owner: DeployOwner | undefined): string {
  return owner === "you" ? OWNER_YOU : OWNER_US;
}
function ownerTag(owner: DeployOwner | undefined): string {
  const us = owner !== "you";
  return `<span class="owner-tag ${us ? "owner-us" : "owner-you"}">${esc(
    ownerLabel(owner)
  )}</span>`;
}

function money(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Defect 4 / Law 11: prompt scaffolding sometimes leaks into copy as a
// slash-delimited list of analysis dimensions (e.g. "headline clarity /
// subheadline strength / CTA visibility / above-the-fold trust / local
// relevance"). The prompts forbid this, but stale or drifting output can still
// carry it, so we strip it deterministically at render. A fragment is treated as
// leaked scaffold when 3+ " / "-joined pieces are each short noun-phrases
// (≤5 words) — matching the validator's Law 11 heuristic.
// A leaked scaffold list joins its dimensions with " / " or a spaced en/em-dash
// (e.g. "booking-vs-contact / urgency specificity — diagnose the intent
// mismatch"). 3+ such fragments where 3+ are short noun-phrases (≤5 words) is a
// checklist, not prose. Hyphens inside a single token ("booking-vs-contact",
// "above-the-fold") are NOT separators — only spaced slashes/dashes are.
const SCAFFOLD_SEP = /\s+[/\u2013\u2014]\s+/;
function isScaffoldFragment(s: string): boolean {
  const segs = s.split(SCAFFOLD_SEP);
  if (segs.length < 3) return false;
  const shortSegs = segs.filter((seg) => seg.trim().split(/\s+/).length <= 5).length;
  return shortSegs >= 3;
}

// Removes leaked scaffold from a prose value: splits into SENTENCE-level chunks
// (so a real finding glued onto a dimension list survives), drops any chunk that
// is itself a scaffold list, and rejoins the survivors. We do NOT split on
// dashes here — the dash is a scaffold separator handled inside
// isScaffoldFragment, not a sentence boundary. If every chunk is scaffold the
// result is "" and the caller omits the field.
function stripScaffold(text: string | undefined | null): string {
  if (!text) return "";
  const chunks = text.split(/(?<=[.!?])\s+|\n+/);
  const kept = chunks.filter((c) => c.trim() && !isScaffoldFragment(c));
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

// Defect 5 / Law 12: dollar figures live in exactly one place per leak (the
// structured dollarCallout) and the rolled-up reconciledTotal. Free-typed money
// in narrative/diagnosis prose creates totals that contradict the computed
// source of truth, so we scrub money expressions out of that prose. The
// structured callouts are never passed through here, so the authoritative numbers
// stay intact.
function scrubMoney(text: string | undefined | null): string {
  if (!text) return "";
  const moneyExpr =
    /(?:of\s+|roughly\s+|around\s+|about\s+|approximately\s+|an?\s+estimated\s+|up\s+to\s+|between\s+)?\$\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?(?:\s*[–—-]\s*\$?\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?)?(?:\s*(?:\/\s*mo\b|\/\s*month\b|per\s+month|a\s+month|each\s+month|monthly|annually|per\s+year|a\s+year))?/g;
  return text
    .replace(moneyExpr, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+(every|each)\s+(month|year)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Defect 4 + 5 combined cleaner for D1 landing/exec prose: strip scaffold lists
// AND free-typed money so no leaked checklist or contradicting total survives.
function cleanD1Prose(text: string | undefined | null): string {
  return scrubMoney(stripScaffold(text));
}

// Gold-bordered dollar-impact callout (Law 5): the headline range, the visible
// math, and the stated assumptions — with a benchmark flag when the customer
// value is an industry benchmark rather than the business's real number.
function dollarCallout(d: DollarImpact | undefined): string {
  if (!d) return "";
  const range =
    d.monthlyLow || d.monthlyHigh
      ? `${money(d.monthlyLow)}–${money(d.monthlyHigh)}<span class="per">/mo lost</span>`
      : "";
  // A6: a leak with no computable figure (mathTemplate null) gets NO revenue-leak
  // slot — an "Estimated revenue leak" header with a blank amount is an empty box.
  if (!range) return "";
  const assume = [
    d.leadVolumeBasis ? `<li><span>Lead volume</span> ${esc(d.leadVolumeBasis)}</li>` : "",
    d.effectSize ? `<li><span>Conversion effect</span> ${esc(d.effectSize)}</li>` : "",
    d.avgValueBasis ? `<li><span>Customer value</span> ${esc(d.avgValueBasis)}</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  const bench = d.usesBenchmarkValue
    ? `<div class="bench-flag">Uses an industry-benchmark customer value (erring low). Plug in your real average customer value to make this figure exact.</div>`
    : "";
  return `<div class="dollar-callout"><div class="dc-head"><span class="dc-label">Estimated revenue leak</span><span class="dc-amount">${range}</span></div>${
    d.formula ? `<div class="dc-formula">${esc(d.formula)}</div>` : ""
  }${assume ? `<ul class="dc-assume">${assume}</ul>` : ""}${bench}</div>`;
}

// ── D1 · Growth Leak Intelligence Report ──────────────────────────────────────

// Law 12: the exec-summary total is COMPUTED from the itemized leaks, never a
// free-typed number — so it always equals the sum of the leaks below.
function reconciledTotal(pack: AssetPack): string {
  const leaks = pack.intelligence?.leakAnalysis ?? [];
  let low = 0;
  let high = 0;
  let counted = 0;
  for (const l of leaks) {
    const d = l.dollarImpact;
    if (!d) continue;
    low += d.monthlyLow || 0;
    high += d.monthlyHigh || 0;
    if ((d.monthlyLow || 0) || (d.monthlyHigh || 0)) counted++;
  }
  if (!counted || (!low && !high)) return "";
  return `<div class="dollar-callout"><div class="dc-head"><span class="dc-label">Total recoverable revenue leak</span><span class="dc-amount">${money(
    low
  )}–${money(high)}<span class="per">/mo</span></span></div><div class="dc-formula">Sum of the ${counted} itemized conversion leak${
    counted === 1 ? "" : "s"
  } below — fix the leaks and this is the monthly upside in play.</div></div>`;
}

function renderExecutiveSummary(pack: AssetPack): string {
  const intel = pack.intelligence;
  const summary = intel?.executiveSummary;
  if (!summary) {
    // Fallback to file1 executive summary.
    return para(pack.file1.executiveSummary);
  }
  const callout = (title: string, cls: string, items: string[] | undefined) =>
    items?.length
      ? `<div class="exec-card ${cls}"><div class="h">${esc(title)}</div>${list(items)}</div>`
      : "";
  return `${para(cleanD1Prose(summary.narrative))}${reconciledTotal(pack)}<div class="exec-grid">${callout(
    "Biggest Opportunities",
    "win",
    summary.biggestOpportunities
  )}${callout("Biggest Threats", "threat", summary.biggestThreats)}${callout(
    "Most Urgent Fixes",
    "urgent",
    summary.mostUrgentFixes
  )}${callout("Quick Wins", "win", summary.quickWins)}</div>`;
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Strong foundation";
  if (score >= 55) return "Mixed — clear upside";
  return "High leakage — urgent upside";
}

function scoreHero(metrics: ScorecardMetric[], readout?: string): string {
  const avg = Math.round(
    metrics.reduce((sum, m) => sum + (m.score || 0), 0) / metrics.length
  );
  const ringClass = gradeClass(avg);
  return `<div class="score-hero"><div class="ring ${ringClass}" style="--ring:${avg}"><span class="rv">${avg}</span><span class="rl">Overall</span></div><div><div class="sh-grade">${esc(
    gradeLabel(avg)
  )}</div><p class="muted" style="margin:0">${esc(
    readout || "A read across the nine conversion surfaces a paid lead crosses on the way to becoming a customer — higher is healthier, lower is where revenue quietly escapes."
  )}</p></div></div>`;
}

function renderScorecard(metrics: ScorecardMetric[] | undefined, readout?: string): string {
  if (!metrics?.length) return "";
  const rows = metrics
    .map(
      (m) =>
        `<div class="score-row">${dial(m.score)}<div class="score-body"><div class="name">${esc(
          m.name
        )} <span class="pct">${esc(m.score)}/100</span></div><div class="diag">${esc(
          m.diagnosis
        )}</div><div class="score-kv">${kv("Rubric", m.rubric)}${kv(
          "Evidence",
          m.evidence
        )}${kv("Why it matters", m.whyItMatters)}${kv(
          "Likely cause",
          m.cause
        )}${kv("Expected benefit", m.expectedBenefit)}</div></div></div>`
    )
    .join("");
  return `${scoreHero(metrics, readout)}<div class="scorecard">${rows}</div>`;
}

// Part C1: the evidence label must match the tier — an industry benchmark is
// never presented as something "observed" on this business.
function evidenceLabel(tier: LeakAnalysisItem["evidenceTier"]): string {
  if (tier === "BENCHMARK") return "Industry pattern";
  if (tier === "EVIDENCED") return "Signal in your reviews";
  return "What we observed"; // OBSERVED, or unlabeled legacy packs
}

// The whitelisted industry stats + the computed benchmark/real dollar math for a
// leak, rendered deterministically (Defect 1). Stats carry their inline source
// citation already (shortSource, via allowedStatPhrase); the math frame is the
// pre-computed, labeled "≈ $X/mo — assuming…" sentence.
function statsBlock(l: LeakAnalysisItem): string {
  const stats = (l.allowedStats ?? []).filter(Boolean);
  const frame = l.mathFrame?.trim();
  if (!stats.length && !frame) return "";
  // For BENCHMARK leaks the stats already appear in the Industry-pattern body,
  // so we only surface the computed math here to avoid duplicating them.
  const showStats = l.evidenceTier !== "BENCHMARK" && stats.length > 0;
  const statList = showStats
    ? `<ul class="lk-stats">${stats.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
    : "";
  const mathHtml = frame
    ? `<div class="lk-math"><span class="lk-math-label">Estimated impact</span>${esc(
        frame
      )}</div>`
    : "";
  if (!statList && !mathHtml) return "";
  return `<div class="kv"><div class="k">Industry benchmarks</div>${statList}${mathHtml}</div>`;
}

// The evidence / industry-pattern pane body (Defect 4). BENCHMARK leaks show the
// industry pattern (its stat/softFraming) + the kickoff-verification line — NEVER
// the symptom, which lives in the summary slot. OBSERVED/EVIDENCED leaks show the
// real evidence.
function leakEvidencePane(l: LeakAnalysisItem): string {
  const label = `<div class="k">${esc(evidenceLabel(l.evidenceTier))}</div>`;
  let body: string;
  if (l.evidenceTier === "BENCHMARK") {
    const pattern = l.industryPattern?.trim();
    const kickoff = l.kickoffLine?.trim();
    body = `${pattern ? para(pattern) : ""}${kickoff ? `<p class="kickoff-line">${esc(kickoff)}</p>` : ""}`;
    // Fall back to any real evidence only when no pattern/kickoff was stamped.
    if (!pattern && !kickoff) body = para(l.evidence);
  } else {
    body = para(l.evidence);
  }
  return `<div class="kv">${label}${body}${statsBlock(l)}</div>`;
}

function renderLeakAnalysis(items: LeakAnalysisItem[] | undefined): string {
  if (!items?.length) return "";
  return items
    .map((l) => {
      const cls = priorityClass(l.priority);
      // Title = the taxonomy leak name (Defect 2), tagged with its scorecard axis.
      const title = l.leakName || l.area;
      const areaTag = l.scorecardArea
        ? `<span class="lk-area">${esc(l.scorecardArea)}</span>`
        : "";
      const summary = `<div class="kv"><div class="k">Business impact</div>${para(
        l.businessImpact
      )}</div><div class="kv"><div class="k">Strategic explanation</div>${para(
        l.explanation
      )}</div>`;
      const evidence = leakEvidencePane(l);
      const fix = `<div class="fix"><div class="k">Recommended fix</div>${para(
        l.recommendedFix
      )}<div class="fix-owner">${ownerTag(l.owner)}</div></div>`;
      const impact = dollarCallout(l.dollarImpact);
      return `<div class="leak ${cls}" data-priority="${cls}"><div class="rail"></div><div class="lk-body"><div class="lh"><div class="lt">${esc(
        title
      )}${areaTag}</div><div class="badges">${pill(l.priority, `${l.priority} priority`)}${pill(
        l.difficulty,
        `${l.difficulty} effort`
      )}${ownerTag(l.owner)}</div></div>${impact}<div class="leak-tabs" role="tablist"><button class="leak-tab is-on" type="button" data-tab="summary">Summary</button><button class="leak-tab" type="button" data-tab="evidence">Evidence</button><button class="leak-tab" type="button" data-tab="fix">Recommendation</button></div><div class="leak-pane" data-pane="summary">${summary}</div><div class="leak-pane" data-pane="evidence" hidden>${evidence}</div><div class="leak-pane" data-pane="fix" hidden>${fix}</div></div></div>`;
    })
    .join("");
}

// ── Landing Page Conversion Intelligence (D1 diagnosis half) ──────────────────

function diagPoint(title: string, p: LandingDiagnosisPoint | undefined): string {
  if (!p) return "";
  const row = (k: string, v: string | undefined, cls = "") => {
    const cv = cleanD1Prose(v);
    return cv ? `<div class="diag-row ${cls}"><div class="dk">${esc(k)}</div>${para(cv)}</div>` : "";
  };
  return `<div class="diag-card"><div class="dt">${esc(title)}</div>${row(
    "Problem",
    p.problem
  )}${row("What we observed", p.evidence)}${row("Why it matters", p.whyItMatters)}${row(
    "Recommended fix",
    p.recommendedFix,
    "fix"
  )}${row("Expected improvement", p.expectedImprovement)}</div>`;
}

function renderLandingIntelligence(li: LandingPageIntelligence): string {
  const parts: string[] = [];

  if (li.executiveDiagnosis)
    parts.push(
      `<div class="label">Landing Page Executive Diagnosis</div><div class="strategy-block">${para(
        cleanD1Prose(li.executiveDiagnosis)
      )}</div>`
    );

  const diags = [
    diagPoint("Hero Section Diagnosis", li.heroDiagnosis),
    diagPoint("CTA Strategy Diagnosis", li.ctaDiagnosis),
    diagPoint("Trust Placement Diagnosis", li.trustDiagnosis),
  ]
    .filter(Boolean)
    .join("");
  if (diags) parts.push(`<div class="label">Hero · CTA · Trust Diagnosis</div>${diags}`);

  if (li.conversionBottlenecks?.length) {
    const cards = li.conversionBottlenecks
      .map(
        (b) =>
          `<div class="diag-card"><div class="dt">${esc(b.stage)}${pill(
            b.priority,
            `${b.priority} priority`
          )}</div><div class="diag-row"><div class="dk">Current friction</div>${para(
            cleanD1Prose(b.currentFriction)
          )}</div><div class="diag-row"><div class="dk">Likely visitor behavior</div>${para(
            cleanD1Prose(b.likelyVisitorBehavior)
          )}</div><div class="diag-row"><div class="dk">Business impact</div>${para(
            cleanD1Prose(b.businessImpact)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(b.recommendedFix)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Conversion Bottleneck Analysis</div>${cards}`);
  }

  if (li.technicalUxDiagnosis)
    parts.push(
      `<div class="label">Landing Page Technical UX Diagnosis</div>${para(
        cleanD1Prose(li.technicalUxDiagnosis)
      )}`
    );

  if (li.fastestWins?.length) {
    const rows = li.fastestWins
      .map(
        (w) =>
          `<tr><td><strong>${esc(stripScaffold(w.fix))}</strong></td><td>${esc(
            cleanD1Prose(w.whyItMatters)
          )}</td><td>${pill(w.priority, w.priority)}</td><td>${pill(
            w.difficulty,
            w.difficulty
          )}</td><td>${esc(scrubMoney(w.expectedOutcome))}</td></tr>`
      )
      .join("");
    parts.push(
      `<div class="label">Fastest Landing Page Wins</div><table><thead><tr><th>Fix</th><th>Why it matters</th><th>Priority</th><th>Difficulty</th><th>Expected outcome</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  if (li.trackingRecommendations?.length)
    parts.push(
      `<div class="label">Landing Page Tracking Recommendations</div>${list(
        li.trackingRecommendations.map((t) => stripScaffold(t)).filter(Boolean)
      )}`
    );

  return parts.join("");
}

// Fallback when no dedicated landing module exists (pre-module packs): compose a
// lighter Landing Page Conversion Intelligence section from the file1 audit.
function renderLandingIntelligenceFallback(f: AssetPack["file1"]): string {
  const parts: string[] = [];

  if (f.ctaStrategy)
    parts.push(`<div class="label">CTA Strategy Diagnosis</div>${para(cleanD1Prose(f.ctaStrategy))}`);

  if (f.conversionBottlenecks?.length) {
    const cards = f.conversionBottlenecks
      .map(
        (b) =>
          `<div class="diag-card"><div class="dt">${esc(
            b.stage
          )}</div><div class="diag-row"><div class="dk">Problem</div>${para(
            cleanD1Prose(b.problem)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(b.fix)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Conversion Bottleneck Analysis</div>${cards}`);
  }

  if (f.trustGapAnalysis?.length) {
    const cards = f.trustGapAnalysis
      .map(
        (t) =>
          `<div class="diag-card"><div class="dt">${esc(
            t.gap
          )}</div><div class="diag-row"><div class="dk">Impact</div>${para(
            cleanD1Prose(t.impact)
          )}</div><div class="diag-row fix"><div class="dk">Recommended fix</div>${para(
            cleanD1Prose(t.fix)
          )}</div></div>`
      )
      .join("");
    parts.push(`<div class="label">Trust Placement Diagnosis</div>${cards}`);
  }

  if (f.trackingAnalytics?.length)
    parts.push(
      `<div class="label">Landing Page Tracking Recommendations</div>${list(
        f.trackingAnalytics.map((t) => stripScaffold(t)).filter(Boolean)
      )}`
    );

  return parts.join("");
}

function renderDeliverable1(pack: AssetPack): string {
  const intel = pack.intelligence;
  const f = pack.file1;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  parts.push(section(next(), "Executive Summary", renderExecutiveSummary(pack)));

  const visuals = renderVisuals(f.visuals);
  if (visuals)
    parts.push(section(next(), "Visual Intelligence (Target vs. Local Competitors)", visuals));

  const tux = renderTechnicalUx(f.technicalUx);
  if (tux) parts.push(section(next(), "Technical UX & Performance", tux));

  // Landing Page Conversion Intelligence — diagnoses the landing page as a
  // conversion system (absorbed from the old Landing Page Growth Audit). Sits
  // between Technical UX and the Growth Leak Scorecard.
  const landingIntel = pack.landing?.intelligence
    ? renderLandingIntelligence(pack.landing.intelligence)
    : renderLandingIntelligenceFallback(f);
  if (landingIntel)
    parts.push(section(next(), "Landing Page Conversion Intelligence", landingIntel));

  const scorecard = renderScorecard(intel?.scorecard.metrics, intel?.scorecard.overallReadout);
  if (scorecard) parts.push(section(next(), "Conversion Leak Scorecard", scorecard));

  const leaks = renderLeakAnalysis(intel?.leakAnalysis);
  if (leaks) {
    parts.push(section(next(), "Growth Leak Analysis", leaks));
  } else if (f.revenueLeaks?.length) {
    // Fallback to file1 revenue leaks table.
    parts.push(
      section(
        next(),
        "Growth Leak Analysis",
        `<table><thead><tr><th>Issue</th><th>Why it matters</th><th>Impact</th><th>Fix</th></tr></thead><tbody>${f.revenueLeaks
          .map(
            (l) =>
              `<tr><td><strong>${esc(l.issue)}</strong></td><td>${esc(
                l.whyItMatters
              )}</td><td class="score">${esc(l.impact)}/10</td><td>${esc(
                l.recommendedFix
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      )
    );
  }

  // Fastest Revenue Wins
  const wins = intel?.fastestWins;
  if (wins?.length) {
    parts.push(
      section(
        next(),
        "Fastest Revenue Wins",
        `<table><thead><tr><th>Opportunity</th><th>Impact</th><th>Effort</th><th>Speed</th></tr></thead><tbody>${wins
          .map(
            (w) =>
              `<tr><td><strong>${esc(w.opportunity)}</strong></td><td>${esc(
                w.impact
              )}</td><td>${pill(w.difficulty, w.difficulty)}</td><td>${esc(
                w.speed
              )}</td></tr>`
          )
          .join("")}</tbody></table>`
      )
    );
  } else if (f.fastestWins?.length) {
    parts.push(section(next(), "Fastest Revenue Wins", list(f.fastestWins)));
  }

  const recs = intel?.strategicRecommendations;
  parts.push(
    section(
      next(),
      "What We Deploy",
      recs?.length ? list(recs) : para(f.positioningStrategy)
    )
  );

  const summary = intel?.executiveSummary;
  const keyActions: NonNullable<ShellOptions["keyActions"]> = [];
  if (summary?.mostUrgentFixes?.length)
    keyActions.push({ title: "Fix now", tone: "urgent", items: summary.mostUrgentFixes });
  if (summary?.quickWins?.length)
    keyActions.push({ title: "Quick wins", tone: "win", items: summary.quickWins });
  if (summary?.biggestThreats?.length)
    keyActions.push({ title: "Watch-outs", tone: "threat", items: summary.biggestThreats });

  return shell(pack.meta, "Growth Leak Intelligence Report", parts.join("\n"), {
    ...shellOpts("d1"),
    keyActions: keyActions.length ? keyActions : undefined,
  });
}

// ── D2 · Client Acquisition Infrastructure Blueprint ──────────────────────────

function renderFunnel(stages: FunnelStage[] | undefined): string {
  if (!stages?.length) return "";
  const blocks = stages
    .map(
      (s, i) =>
        `<div class="funnel-row"><div class="fn-node">${String(i + 1).padStart(
          2,
          "0"
        )}</div><div class="fn-card${s.isRetainer ? " is-retainer" : ""}"><div class="st">${esc(
          s.stage
        )}${
          s.isRetainer ? `<span class="retainer-badge">Monthly retainer · runs continuously</span>` : ""
        }</div>${
          s.role ? `<p><strong>Role.</strong> ${esc(s.role)}</p>` : ""
        }${
          s.currentWeakness
            ? `<p><strong>Current break point.</strong> ${esc(s.currentWeakness)}</p>`
            : ""
        }${
          s.whatWeDeploy
            ? `<p><strong>What we deploy.</strong> ${esc(s.whatWeDeploy)}</p>`
            : ""
        }<div class="fn-meta">${ownerTag(s.owner)}${
          s.kpi ? `<span class="chip">KPI · ${esc(s.kpi)}</span>` : ""
        }</div></div></div>`
    )
    .join("");
  return `<div class="funnel">${blocks}</div>`;
}

function renderLeadTiers(tiers: LeadTier[] | undefined): string {
  if (!tiers?.length) return "";
  const cards = tiers
    .map(
      (t) =>
        `<div class="tier"><div class="tn">${esc(t.tier)}</div><div class="rng">${esc(
          t.range
        )}</div><p>${esc(t.meaning)}</p><p><strong>Action.</strong> ${esc(
          t.action
        )}</p><p class="muted"><strong>Response.</strong> ${esc(
          t.responseTime
        )} · <strong>Owner.</strong> ${esc(t.owner)} · <strong>Method.</strong> ${esc(
          t.followUpMethod
        )}</p></div>`
    )
    .join("");
  return `<div class="tiers">${cards}</div>`;
}

function renderCrmStages(stages: CrmStage[] | undefined): string {
  if (!stages?.length) return "";
  return `<table><thead><tr><th>Stage</th><th>Entry criteria</th><th>Exit criteria</th><th>Ownership</th><th>Review</th></tr></thead><tbody>${stages
    .map(
      (s) =>
        `<tr><td><strong>${esc(s.stage)}</strong></td><td>${esc(
          s.entryCriteria
        )}</td><td>${esc(s.exitCriteria)}</td><td>${esc(s.ownership)}</td><td>${esc(
          s.reviewProcess
        )}</td></tr>`
    )
    .join("")}</tbody></table>`;
}

function renderDeliverable2(pack: AssetPack): string {
  const infra = pack.infrastructure;
  const f2 = pack.file2;
  const f3 = pack.file3;
  const f4 = pack.file4;
  const f5 = pack.file5;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  if (infra?.funnel.overview)
    parts.push(
      section(next(), "Infrastructure Overview", `<div class="strategy-block">${para(
        infra.funnel.overview
      )}</div>`)
    );

  const funnel = renderFunnel(infra?.funnel.stages);
  if (funnel) parts.push(section(next(), "The Conversion Path", funnel));

  // Lead Qualification Framework: tiers + file2 intake/scoring/routing.
  const tiers = renderLeadTiers(infra?.crmPipeline.leadTiers);
  const intake = (f2.questions ?? []).length
    ? `<div class="label">Intake & scoring questions</div>${(f2.questions ?? [])
        .map(
          (q, i) =>
            `<div class="card"><strong>${i + 1}. ${esc(q.question)}</strong><p class="muted">${esc(
              q.purpose
            )} · ${esc(q.scoringImpact)}</p></div>`
        )
        .join("")}`
    : "";
  const routing = f2.routingLogic?.length
    ? `<div class="label">Routing logic</div><table><thead><tr><th>Tier</th><th>Timing</th><th>Action</th></tr></thead><tbody>${f2.routingLogic
        .map(
          (r) =>
            `<tr><td><strong>${esc(r.tier)}</strong></td><td>${esc(r.timing)}</td><td>${esc(
              r.action
            )}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "";
  const crmFields = f2.crmFields?.length
    ? `<div class="label">CRM fields to capture</div>${list(f2.crmFields)}`
    : "";
  parts.push(
    section(
      next(),
      "Lead Qualification Framework",
      `${tiers}${intake}${routing}${crmFields}`
    )
  );

  // Follow-Up Operating System: SMS (file4) + email (file3) + reply strategy.
  const sms = (f4.messages ?? []).length
    ? `<div class="label">SMS follow-up framework</div>${(f4.messages ?? [])
        .map(
          (m) =>
            `<div class="card"><div class="label">Send ${esc(m.timing)}</div><p><strong>${esc(
              m.message
            )}</strong></p><p class="muted">${esc(m.psychology)} · On reply: ${esc(
              m.replyStrategy
            )}</p></div>`
        )
        .join("")}`
    : "";
  const emailRhythm = (f3.emails ?? []).length
    ? `<div class="label">Email nurture rhythm</div><table><thead><tr><th>Day</th><th>Purpose</th><th>Subject</th></tr></thead><tbody>${(
        f3.emails ?? []
      )
        .map(
          (e) =>
            `<tr><td>${esc(e.day)}</td><td>${esc(e.purpose)}</td><td>${esc(
              e.subject
            )}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "";
  parts.push(
    section(next(), "Follow-Up Operating System", `${sms}${emailRhythm}`)
  );

  // Booking & Show-Up System (file5).
  parts.push(
    section(
      next(),
      "Booking & Show-Up System",
      `${f5.whatToExpect?.length ? `<div class="label">What to expect</div>${list(f5.whatToExpect)}` : ""}${
        f5.appointmentPositioning
          ? `<div class="label">Appointment positioning</div>${para(f5.appointmentPositioning)}`
          : ""
      }${
        f5.showUpQualityNotes
          ? `<div class="label">Show-up quality</div>${para(f5.showUpQualityNotes)}`
          : ""
      }${
        f5.rescheduleFraming
          ? `<div class="label">Reschedule framing</div>${para(f5.rescheduleFraming)}`
          : ""
      }`
    )
  );

  // CRM / Pipeline Blueprint.
  const crm = renderCrmStages(infra?.crmPipeline.stages);
  if (crm) {
    parts.push(
      section(
        next(),
        "CRM & Pipeline Blueprint",
        `${
          infra?.crmPipeline.overview
            ? `<div class="strategy-block">${para(infra.crmPipeline.overview)}</div>`
            : ""
        }${crm}`
      )
    );
  }

  return shell(
    pack.meta,
    "Client Acquisition Infrastructure Blueprint",
    parts.join("\n"),
    shellOpts("d2")
  );
}

// ── D3 · Conversion Asset Pack ────────────────────────────────────────────────

function assetFrame(where: string, purpose: string): string {
  return `<div class="asset-frame"><span class="chip where">Used: ${esc(
    where
  )}</span><span class="chip">Purpose: ${esc(purpose)}</span></div>`;
}

// ── Landing Page Conversion Assets (D3 assets half) ───────────────────────────

function renderLandingAssets(la: LandingPageAssets): string {
  // Lead with the actual ready-to-paste copy (spec 03 / Law: D3 is COPY, not a
  // structure lecture). The recommended-structure reference is demoted to a
  // compact appendix at the very end.
  const parts: string[] = [];

  const h = la.heroCopy;
  if (h) {
    let hero = "";
    if (h.headlineOptions?.length)
      hero += `<div class="label">Headline options — paste one</div><ol class="opt-list">${h.headlineOptions
        .map((o) => `<li>${esc(o)}</li>`)
        .join("")}</ol>`;
    if (h.subheadlineOptions?.length)
      hero += `<div class="label">Subheadline options</div><ol class="opt-list">${h.subheadlineOptions
        .map((o) => `<li>${esc(o)}</li>`)
        .join("")}</ol>`;
    const micro = [
      h.primaryCta ? `<div class="diag-row"><div class="dk">Primary button</div><p>${esc(h.primaryCta)}</p></div>` : "",
      h.secondaryCta ? `<div class="diag-row"><div class="dk">Secondary button</div><p>${esc(h.secondaryCta)}</p></div>` : "",
      h.trustMicrocopy ? `<div class="diag-row"><div class="dk">Trust line under the button</div><p>${esc(h.trustMicrocopy)}</p></div>` : "",
      h.aboveFoldProofLine ? `<div class="diag-row"><div class="dk">Above-the-fold proof line</div><p>${esc(h.aboveFoldProofLine)}</p></div>` : "",
    ]
      .filter(Boolean)
      .join("");
    if (micro) hero += `<div class="diag-card">${micro}</div>`;
    if (hero) parts.push(`<div class="label">Hero — first thing visitors see</div>${hero}`);
  }

  if (la.problemCopy) parts.push(`<div class="label">Problem section — paste as written</div>${para(la.problemCopy)}`);
  if (la.solutionCopy) parts.push(`<div class="label">Value / solution section — paste as written</div>${para(la.solutionCopy)}`);
  if (la.trustCopy) parts.push(`<div class="label">Trust / proof section — paste as written</div>${para(la.trustCopy)}`);

  if (la.ctaOptions?.length) {
    const cards = la.ctaOptions
      .map(
        (c) =>
          `<div class="diag-card"><div class="dt">${esc(c.label)}${
            c.type ? `<span class="chip">${esc(c.type)}</span>` : ""
          }</div>${
            c.whereToUse
              ? `<div class="diag-row"><div class="dk">Where to place it</div><p>${esc(c.whereToUse)}</p></div>`
              : ""
          }</div>`
      )
      .join("");
    parts.push(`<div class="label">Call-to-action buttons — paste these</div>${cards}`);
  }

  if (la.faq?.length) {
    const cards = la.faq
      .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
      .join("");
    parts.push(`<div class="label">FAQ / objection handling — paste as written</div>${cards}`);
  }

  if (la.thankYouPageCopy)
    parts.push(`<div class="label">Thank-you page copy — paste as written</div>${para(la.thankYouPageCopy)}`);

  // Compact structure reference (appendix) — a brief note is allowed, but it is
  // not the substance of the deliverable.
  if (la.recommendedStructure?.length) {
    const rows = la.recommendedStructure
      .map(
        (s, i) =>
          `<tr><td><span class="struct-num">${String(i + 1).padStart(2, "0")}</span>${esc(
            s.name
          )}</td><td>${esc(s.purpose)}</td></tr>`
      )
      .join("");
    parts.push(
      `<div class="label">Page order — for whoever assembles the page</div><table><thead><tr><th>Section</th><th>What it does</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  if (la.implementationNotes?.length)
    parts.push(
      `<div class="label">Implementation notes</div>${list(la.implementationNotes)}`
    );

  return parts.join("");
}

// Fallback when no dedicated landing module exists: render the file1 landing copy.
function renderLandingAssetsFallback(lp: AssetPack["file1"]["landingPage"] | undefined): string {
  if (!lp) return "";
  return `<div class="hero-quote">${esc(lp.heroHeadline)}</div>${para(
    lp.heroSubheadline
  )}<div class="label">CTA block</div>${para(lp.ctaBlock)}<div class="label">Problem</div>${para(
    lp.problemSection
  )}<div class="label">Solution</div>${para(lp.solutionSection)}<div class="label">Offer</div>${para(
    lp.offerSection
  )}<div class="label">Benefits</div>${list(lp.benefits)}<div class="label">Trust / proof</div>${para(
    lp.trustSection
  )}${
    lp.faq?.length
      ? `<div class="label">FAQ / Objection Handling</div>${lp.faq
          .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
          .join("")}`
      : ""
  }<div class="label">Final CTA</div>${para(lp.finalCta)}`;
}

function renderDeliverable3(pack: AssetPack): string {
  const f1 = pack.file1;
  const f3 = pack.file3;
  const f4 = pack.file4;
  const f5 = pack.file5;
  const sa = pack.supportingAssets;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  // Landing Page Conversion Assets — the actual recommended page copy/assets,
  // absorbed from the old Landing Page Growth Audit. Prefer the dedicated landing
  // module; fall back to the file1 landing copy for pre-module packs.
  const landingBody = pack.landing?.assets
    ? renderLandingAssets(pack.landing.assets)
    : renderLandingAssetsFallback(f1.landingPage);
  if (landingBody) {
    parts.push(
      section(
        next(),
        "Landing Page Conversion Assets",
        `${assetFrame(
          "Primary conversion page / paid-traffic destination",
          "Turn cold visitors into qualified booked calls"
        )}${landingBody}`
      )
    );
  }

  // Email assets (file3).
  if ((f3.emails ?? []).length) {
    parts.push(
      section(
        next(),
        "Email Nurture Assets",
        `${assetFrame(
          "Post-opt-in nurture sequence",
          "Build trust and pull unconverted leads back to booking"
        )}${(f3.emails ?? [])
          .map(
            (e) =>
              `<div class="email"><div class="label">Day ${esc(e.day)} · ${esc(
                e.purpose
              )}</div><div class="subj">${esc(e.subject)}</div>${para(e.body)}</div>`
          )
          .join("")}`
      )
    );
  }

  // SMS assets (file4).
  if ((f4.messages ?? []).length) {
    parts.push(
      section(
        next(),
        "SMS Follow-Up Assets",
        `${assetFrame(
          "Speed-to-lead and re-engagement texting",
          "Recover no-responses with timely, human messages"
        )}${(f4.messages ?? [])
          .map(
            (m) =>
              `<div class="card"><div class="label">Send ${esc(m.timing)}</div><p><strong>${esc(
                m.message
              )}</strong></p></div>`
          )
          .join("")}`
      )
    );
  }

  // Booking assets (file5).
  parts.push(
    section(
      next(),
      "Booking & Reminder Assets",
      `${assetFrame(
        "Booking page + confirmation / reminder automations",
        "Maximize show-up rate and reduce no-shows"
      )}<div class="hero-quote">${esc(f5.headline)}</div>${para(
        f5.subheadline
      )}${emailBlock("Confirmation email", f5.confirmationEmail)}${emailBlock(
        "24-hour reminder email",
        f5.reminderEmail24h
      )}<div class="label">Day-of reminder SMS</div><div class="card">${esc(
        f5.dayOfReminderSms
      )}</div>${emailBlock("No-show recovery email", f5.noShowRecoveryEmail)}`
    )
  );

  // Thank-you & post-purchase assets (supportingAssets.thankYouAssets). The only
  // permitted review touch (Law 2) is a single review-REQUEST automation fired
  // after a completed job — folded in here, not a standalone review section.
  const ty = sa?.thankYouAssets;
  const reviewMsg = sa?.reviewAssets?.postJobRequest;
  if (ty || reviewMsg) {
    parts.push(
      section(
        next(),
        "Thank-You & Post-Purchase Assets",
        `${assetFrame(
          "Confirmation / thank-you page and post-job messaging",
          "Set next steps, reduce buyer's remorse, and confirm the win"
        )}${
          ty?.thankYouPageCopy
            ? `<div class="label">Thank-you page copy</div>${para(ty.thankYouPageCopy)}`
            : ""
        }${
          ty?.nextStepMessaging
            ? `<div class="label">Next-step messaging</div>${para(ty.nextStepMessaging)}`
            : ""
        }${
          ty?.postPurchaseSequence?.length
            ? `<div class="label">Post-purchase sequence</div>${ty.postPurchaseSequence
                .map((m) => `<div class="card">${esc(m)}</div>`)
                .join("")}`
            : ""
        }${
          reviewMsg
            ? `<div class="label">Review request — sent automatically after a completed job</div><div class="card">${esc(
                reviewMsg
              )}</div>`
            : ""
        }`
      )
    );
  }

  return shell(pack.meta, "Conversion Asset Pack", parts.join("\n"), shellOpts("d3"));
}

// ── D4 · 90-Day Growth Execution Roadmap ──────────────────────────────────────

function renderPhases(phases: RoadmapPhase[] | undefined): string {
  if (!phases?.length) return "";
  const blocks = phases
    .map(
      (p, i) =>
        `<div class="phase-row"><div class="phase-node">${i + 1}</div><div class="phase-card${
          p.isRetainerPhase ? " is-retainer" : ""
        }"><div class="ph-h"><span class="ph-n">${esc(p.phase)}${
          p.isRetainerPhase
            ? `<span class="retainer-badge">Monthly retainer</span>`
            : ""
        }</span><span class="ph-w">${esc(p.window)}</span></div><p class="ph-obj"><strong>Objective.</strong> ${esc(
          p.objective
        )}</p>${
          p.deployActions?.length || p.doneDefinition?.length
            ? `<div class="phase-cols">${
                p.deployActions?.length
                  ? `<div><div class="label">What we deploy</div>${list(p.deployActions)}</div>`
                  : ""
              }${
                p.doneDefinition?.length
                  ? `<div><div class="label">Done means</div>${checklist(p.doneDefinition)}</div>`
                  : ""
              }</div>`
            : ""
        }<div class="fn-meta" style="margin-top:14px">${ownerTag(p.owner)}</div></div></div>`
    )
    .join("");
  return `<div class="timeline">${blocks}</div>`;
}

function renderDeliverable4(pack: AssetPack): string {
  const roadmap = pack.roadmap;
  const parts: string[] = [];
  let n = 0;
  const next = () => ++n;

  if (roadmap?.overview)
    parts.push(
      section(next(), "Roadmap Overview", `<div class="strategy-block">${para(
        roadmap.overview
      )}</div>`)
    );

  const phases = renderPhases(roadmap?.phases);
  if (phases) {
    parts.push(section(next(), "Implementation & Optimization Plan", phases));
  } else {
    // Fallback: derive a lightweight plan from each file's implementation guide.
    const guides = [
      pack.file1.framing?.implementationGuide,
      pack.file2.framing?.implementationGuide,
      pack.file5.framing?.implementationGuide,
    ]
      .filter((g): g is string[] => Boolean(g?.length))
      .flat();
    if (guides.length) {
      parts.push(
        section(next(), "Execution Checklist", checklist(guides))
      );
    }
  }

  return shell(
    pack.meta,
    "Implementation & Optimization Timeline",
    parts.join("\n"),
    shellOpts("d4")
  );
}

// ── Metadata + dispatcher ─────────────────────────────────────────────────────

export const DELIVERABLES: {
  id: DeliverableId;
  title: string;
  subtitle: string;
  filename: string;
}[] = [
  {
    id: "d1",
    title: "Growth Leak Intelligence Report",
    subtitle: "Diagnosis — where revenue is quietly leaking and why",
    filename: "01-growth-leak-intelligence-report.html",
  },
  {
    id: "d2",
    title: "Client Acquisition Infrastructure Blueprint",
    subtitle: "Architecture — the conversion path we build to turn your leads into customers",
    filename: "02-client-acquisition-infrastructure-blueprint.html",
  },
  {
    id: "d3",
    title: "Conversion Asset Pack",
    subtitle: "Assets — the copy and messaging that runs the system",
    filename: "03-conversion-asset-pack.html",
  },
  {
    id: "d4",
    title: "Implementation & Optimization Timeline",
    subtitle: "Execution — what we deploy, then the ongoing retainer cadence",
    filename: "04-implementation-optimization-timeline.html",
  },
];

function shellOpts(id: DeliverableId): ShellOptions {
  const idx = DELIVERABLES.findIndex((d) => d.id === id);
  const d = DELIVERABLES[idx];
  return {
    subtitle: d?.subtitle,
    docIndex: `${String(idx + 1).padStart(2, "0")} / ${String(DELIVERABLES.length).padStart(2, "0")}`,
  };
}

export function renderDeliverableHtml(pack: AssetPack, id: DeliverableId): string {
  switch (id) {
    case "d1":
      return renderDeliverable1(pack);
    case "d2":
      return renderDeliverable2(pack);
    case "d3":
      return renderDeliverable3(pack);
    case "d4":
      return renderDeliverable4(pack);
  }
}
