// Cold Audit HTML renderer.
//
// Produces the FREE one-page audit shown live on the sales call — the hook that
// makes a prospect's hidden conversion leaks visible, painful, and quantified,
// then pivots to the paid engagement. It matches the paid deliverable design
// system so free and paid feel like one brand: restrained, premium, light /
// consulting-grade. No external assets — CSS is inlined. The embedded screenshot
// (signed ScreenshotOne URL) loads from the network when opened online; if it
// fails it gracefully hides.
//
// HARD RESTRAINT BUDGET: only the tokens below; no color outside this list (no
// blue); ZERO gradients; ONE subtle shadow token; hairline borders preferred;
// exactly ONE reveal-on-scroll animation (this is presented live), reduced-motion
// safe; no hover-lift.

import type { ColdAuditReport, ColdAuditFinding } from "@/types";
import { softenFlatAssertions } from "../leak-narrative";

// ── Law enforcement (deterministic, not prompt-dependent) ───────────────────
// The generation prompt asks the model to follow the cold-audit laws, but a
// prompt can't GUARANTEE compliance — the model drifts and older saved audits
// predate the rules. So we hard-enforce the laws that are mechanically checkable
// on the data itself, at every output boundary (HTML render, plaintext copy,
// and generation). This is what makes a forbidden line impossible to ship.

// Law 10: the close must PIVOT to the paid engagement, never offer free help.
// This compliant fallback is used whenever the model's CTA offers freebies.
export const COLD_AUDIT_CTA_FALLBACK =
  "This is just a fraction of what I found. Want me to walk you through everything that's leaking and what it would take to fix it properly?";

// Patterns that signal an offer of FREE help (forbidden). Carefully scoped so
// the compliant pivot ("...what it would take to fix it") is never flagged —
// we only catch the act of OFFERING to give fixes/tips/wins away.
const CTA_FREEBIE_PATTERNS: RegExp[] = [
  /\bquick (fix|fixes|win|wins|tip|tips)\b/i,
  /\bfree (fix|fixes|tip|tips|audit|sample|guide|advice|help|pointers|checklist|report)\b/i,
  /\b(share|send|give|show|hand|shoot|drop)\s+(you\s+|over\s+|you\s+over\s+)?(a\s+|some\s+|the\s+|a\s+few\s+|a\s+couple\s+(of\s+)?)?(quick\s+)?(fix|fixes|tip|tips|win|wins|advice|pointers|steps|ideas|suggestions|how-?to|walkthrough|guide|checklist)\b/i,
  /\bshow you how\b/i,
  /\bhow to (fix|improve|speed up|fix it)\b/i,
  /\b(a few|some|a couple of|a handful of)\s+(quick\s+)?(fixes|tips|pointers|ideas|suggestions|tweaks)\b/i,
  /\b(let me|i can|i'?ll|i will|happy to)\s+(fix|send|share|give|show|put together|throw together)\b/i,
];

export function ctaViolatesLaw10(message: string | null | undefined): boolean {
  if (!message) return false;
  return CTA_FREEBIE_PATTERNS.some((re) => re.test(message));
}

// Generic, on-spec deeper-leak questions used only as a fallback when the model
// returns none. They invent no business-specific data (Law 1 safe) and mirror
// the Law 3 examples: response time, follow-up, no-shows.
const DEEPER_LEAK_FALLBACK: string[] = [
  "When a lead reaches out after hours, how fast do they actually hear back? If it's the next day, you're handing them to whoever called first.",
  "What happens to the people who enquire but don't book? If no one follows up, that's revenue quietly walking out the door.",
];

// Part H2: the pipeline discovery question — always a distinct, high-value probe
// that surfaces the inquiry→client gap where the money hides. Guaranteed present
// among the deeper-leak questions so duplicated questions are replaced by it.
export const PIPELINE_DISCOVERY_QUESTION =
  "How many inquiries came in last month — and how many actually became clients? The gap between those two numbers is usually where the money is.";

// Matches a question already probing the inquiry→client pipeline, so we don't
// double up when the model already asked it.
const PIPELINE_QUESTION_SIGNATURE =
  /how many.*(inquir|enquir|lead|call).*(became|turn|convert|client|customer|book)/i;

// Part H2: dedupe deeper-leak questions to DISTINCT probes and guarantee the
// pipeline question is one of them (replacing a duplicate slot when needed).
export function distinctDeeperQuestions(raw: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const q of raw) {
    const t = q?.trim();
    if (!t) continue;
    const key = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(t);
  }
  const base = distinct.length ? distinct : [...DEEPER_LEAK_FALLBACK];
  if (base.some((q) => PIPELINE_QUESTION_SIGNATURE.test(q))) return base.slice(0, 3);
  // No pipeline probe yet: keep up to two of the strongest existing questions,
  // then append the pipeline question so it always earns a slot (cap 3).
  return [...base.slice(0, 2), PIPELINE_DISCOVERY_QUESTION].slice(0, 3);
}

// Law 6 (voice) + Defect 1: the visible header must lead with the bleed, not a
// soft "quick note / quick wins / boost visibility" opener. The page <title> is
// already loss-framed, so a stale or off-voice headline/intro contradicts it.
// These patterns catch the banned soft openers; matches are replaced with the
// loss-framed fallbacks below so the header can never ship soft.
const HEADER_SOFT_PATTERNS: RegExp[] = [
  /\bquick note\b/i,
  /\b(a\s+)?(few\s+)?quick (win|wins|fix|fixes|tip|tips)\b/i,
  /\bboost(ing)? your (visibility|presence|online presence|rankings?)\b/i,
  /\b(potential )?opportunit(y|ies) to (improve|optimi[sz]e|grow|boost)\b/i,
  /\ba (quick|brief|short) (note|look|review|thought)\b/i,
  /\b(some|a few) (opportunities|improvements|optimi[sz]ations)\b/i,
  /\bjust (a|wanted to)\b/i,
];

export function headerViolatesVoice(text: string | null | undefined): boolean {
  if (!text) return false;
  return HEADER_SOFT_PATTERNS.some((re) => re.test(text));
}

// Loss-framed header fallbacks. The intro acknowledges effort in a single clause
// WITHOUT inventing a specific metric/competitor (Law 1 safe), then pivots to the
// bleed (Law 6). businessName is interpolated by the caller.
function fallbackHeadline(businessName: string): string {
  const name = businessName?.trim() || "your business";
  return `Where ${name} is quietly losing clients`;
}
const FALLBACK_INTRO =
  "You've clearly put real work into this business — but here's where you're quietly losing clients before they ever reach out.";

// Law 2 (spend-anchored, pre-intake): the headline-cost block must ALWAYS render
// a gut-punch, but pre-intake we make ZERO claims about the client's revenue and
// never invent a lead volume or customer value. When the model returns none, fall
// back to a spend-anchored line with no fabricated figures.
const HEADLINE_COST_FALLBACK =
  "You already pay to get these leads — through ads, referrals, and the time you put into being found. Every lead that hits this gap is money you've already spent to earn someone who now slips away before they ever reach you.";

// Defect 3 + Law 6: strip hedge-STACKS from observed facts. We only collapse
// redundant double-hedges ("may potentially", "could possibly") — removing a
// single hedge risks breaking grammar, but a doubled hedge is always safe to
// thin and reads as confident once collapsed.
function dehedge(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text
    .replace(/\b(may|might|could|can)\s+(potentially|possibly|perhaps)\b/gi, "$1")
    .replace(/\b(potentially|possibly|perhaps)\s+(may|might|could|can)\b/gi, "$2")
    .replace(/\b(may|might|could)\s+(may|might|could)\b/gi, "$1")
    .replace(/\s{2,}/g, " ");
}

// Returns a corrected copy of the report with the mechanically-enforceable laws
// applied. Idempotent and non-mutating. Run at every output boundary.
export function enforceColdAuditLaws(report: ColdAuditReport): ColdAuditReport {
  const cta = report.closingCta ?? { tiedToFinding: "", message: "" };
  const message = ctaViolatesLaw10(cta.message)
    ? COLD_AUDIT_CTA_FALLBACK
    : cta.message;

  // Part H2: distinct deeper-leak questions with a guaranteed pipeline probe.
  const questions = distinctDeeperQuestions(report.deeperLeakQuestions ?? []);

  // Defect 1 / Law 6: never let a soft or empty header reach the page.
  const headline =
    !report.headline?.trim() || headerViolatesVoice(report.headline)
      ? fallbackHeadline(report.businessName)
      : report.headline;
  const intro =
    !report.intro?.trim() || headerViolatesVoice(report.intro)
      ? FALLBACK_INTRO
      : report.intro;

  // Defect 2 / Law 2+8: the dollar gut-punch always renders.
  const headlineCost = report.headlineCost?.trim()
    ? report.headlineCost
    : HEADLINE_COST_FALLBACK;

  // Defect 3 / Law 6: thin redundant hedge-stacks in observed-fact prose.
  // Law 13 backstop: soften any flat operational assertion about an invisible
  // internal behavior that survived generation (or predates the rule) — a saved
  // audit can't be regenerated at render, so we hedge it deterministically.
  const findings = (report.findings ?? []).map((f) => ({
    ...f,
    problem: softenFlatAssertions(dehedge(f.problem)),
    whyItCosts: softenFlatAssertions(dehedge(f.whyItCosts)),
  }));

  return {
    ...report,
    headline,
    intro,
    headlineCost,
    findings,
    closingCta: { ...cta, message },
    deeperLeakQuestions: questions,
  };
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(s: string | null | undefined): string {
  if (!s) return "";
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function severityRank(sev: ColdAuditFinding["severity"]): number {
  return sev === "high" ? 0 : sev === "medium" ? 1 : 2;
}

function sevLabel(sev: ColdAuditFinding["severity"]): string {
  return sev === "high" ? "Critical" : sev === "medium" ? "Costly" : "Worth fixing";
}

function renderFinding(f: ColdAuditFinding, i: number): string {
  return `<div class="finding reveal">
    <div class="f-head">
      <span class="f-num">${(i + 1).toString().padStart(2, "0")}</span>
      <h3>${esc(f.title)}</h3>
      <span class="tag ${esc(f.severity)}">${sevLabel(f.severity)}</span>
    </div>
    <p class="f-problem">${esc(f.problem)}</p>
    <div class="f-cost"><span class="f-cost-label">What it's costing you</span>${esc(
      f.whyItCosts
    )}</div>
  </div>`;
}

export function renderColdAuditHtml(rawReport: ColdAuditReport): string {
  // Enforce the laws on the data before rendering — guarantees a forbidden CTA
  // or missing deeper-leak block can never reach the page, even for stale audits.
  const report = enforceColdAuditLaws(rawReport);
  const findings = [...(report.findings ?? [])].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );

  const screenshotBlock = report.screenshotUrl
    ? `<figure class="shot reveal">
        <img src="${esc(report.screenshotUrl)}" alt="${esc(
          report.businessName
        )} website" onerror="this.closest('figure').style.display='none'">
        <figcaption>${esc(report.websiteUrl || report.businessName)} — as it looks today</figcaption>
      </figure>`
    : "";

  // Frame the figure as ONE leak (the worst), so the much-larger paid-deliverable
  // total reads as expected upside, not a contradiction. The count is the number
  // of findings actually rendered below — deterministic, never free-typed.
  const leakCount = findings.length;
  const oneLeakNote =
    leakCount > 1
      ? `<p class="hc-note">Just one of ${leakCount} leaks we found below — and the most expensive of them.</p>`
      : "";

  const costBlock = report.headlineCost
    ? `<div class="headline-cost reveal">
        <span class="hc-label">Your single biggest leak</span>
        <p class="hc-figure">${esc(report.headlineCost)}</p>
        ${oneLeakNote}
      </div>`
    : "";

  const perf = report.performance;
  const perfBlock =
    perf && perf.available
      ? `<div class="perf reveal">
          <div class="perf-metrics">
            ${
              perf.mobileScore != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.mobileScore
                  )}<span class="u">/100</span></div><div class="k">Mobile speed</div></div>`
                : ""
            }
            ${
              perf.lcpSeconds != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.lcpSeconds
                  )}<span class="u">s</span></div><div class="k">Load time</div></div>`
                : ""
            }
            ${
              perf.clsValue != null
                ? `<div class="metric"><div class="v">${esc(
                    perf.clsValue
                  )}</div><div class="k">Layout shift</div></div>`
                : ""
            }
          </div>
          <p class="perf-read">${esc(perf.readout)}</p>
        </div>`
      : "";

  const questions = (report.deeperLeakQuestions ?? []).filter(Boolean);
  const questionsBlock = questions.length
    ? `<div class="questions reveal">
        <div class="section-label">And the leaks I can't see from out here</div>
        <ul class="q-list">
          ${questions.map((q) => `<li>${esc(q)}</li>`).join("\n")}
        </ul>
      </div>`
    : "";

  const ctaBlock = report.closingCta?.message
    ? `<div class="cta reveal">
        <div class="cta-eyebrow">Where this goes next</div>
        <p class="cta-msg">${para(report.closingCta.message).replace(/^<p>|<\/p>$/g, "")}</p>
      </div>`
    : "";

  const date = new Date(report.generatedAt).toLocaleDateString();
  const footerParts = [esc(report.businessName), esc(date)];
  if (report.agencyName && report.agencyName !== "our team") {
    footerParts.push(esc(report.agencyName));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Where ${esc(report.businessName)} is losing clients</title>
<style>
  :root {
    --bg: #FBFAF7; --surface: #FFFFFF; --surface-2: #F4F2EC;
    --ink: #1A1814; --ink-muted: #6B6659; --accent: #9A7B3F; --border: #E7E3D8;
    --high: #A8443B; --med: #B5862F; --low: #3F7D5A;
    --shadow: 0 1px 2px rgba(26,24,20,.05);
    --serif: Georgia, "Times New Roman", serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: var(--serif); font-weight: 600; letter-spacing: -.01em; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 56px 24px 96px; }

  header.doc { margin-bottom: 30px; }
  header.doc .eyebrow { text-transform: uppercase; letter-spacing: .16em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 16px; }
  header.doc h1 { margin: 0 0 14px; font-size: 30px; line-height: 1.2; color: var(--ink); }
  header.doc .intro { font-size: 17px; line-height: 1.55; color: var(--ink-muted); margin: 0; max-width: 60ch; }

  figure.shot { margin: 0 0 28px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
  figure.shot img { display: block; width: 100%; height: auto; }
  figure.shot figcaption { background: var(--surface-2); color: var(--ink-muted); padding: 10px 16px; font-size: 12.5px; border-top: 1px solid var(--border); }

  .headline-cost { background: var(--surface-2); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 12px; padding: 24px 26px; margin-bottom: 30px; }
  .headline-cost .hc-label { display: block; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }
  .headline-cost .hc-figure { margin: 0; font-family: var(--serif); font-size: 22px; line-height: 1.4; color: var(--ink); font-variant-numeric: tabular-nums; }
  .headline-cost .hc-note { margin: 12px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-muted); }

  .section-label { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin: 0 2px 14px; }

  .finding { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .f-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .f-num { font-family: var(--serif); font-size: 13px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .f-head h3 { margin: 0; font-size: 18px; line-height: 1.3; flex: 1; color: var(--ink); }
  .f-problem { margin: 0 0 14px; color: var(--ink-muted); }
  .f-cost { background: var(--surface-2); border-radius: 8px; padding: 13px 16px; font-size: 14.5px; color: var(--ink); }
  .f-cost-label { display: block; text-transform: uppercase; letter-spacing: .08em; font-size: 10.5px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }

  .tag { display: inline-block; padding: 2px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border: 1px solid currentColor; }
  .tag.high { color: var(--high); }
  .tag.medium { color: var(--med); }
  .tag.low { color: var(--low); }

  .perf { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .perf-metrics { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .metric { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; min-width: 116px; }
  .metric .v { font-family: var(--serif); font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .metric .v .u { font-size: 14px; color: var(--ink-muted); font-weight: 600; margin-left: 2px; }
  .metric .k { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-muted); margin-top: 2px; font-weight: 600; }
  .perf-read { margin: 0; color: var(--ink-muted); font-size: 14.5px; }

  .questions { margin: 28px 0 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px 26px; box-shadow: var(--shadow); }
  .q-list { margin: 0; padding: 0; list-style: none; }
  .q-list li { position: relative; padding: 0 0 0 22px; margin-bottom: 14px; color: var(--ink); font-size: 16px; line-height: 1.55; }
  .q-list li:last-child { margin-bottom: 0; }
  .q-list li::before { content: "?"; position: absolute; left: 0; top: 0; font-family: var(--serif); font-weight: 700; color: var(--accent); }

  .cta { margin-top: 28px; background: var(--surface-2); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 12px; padding: 26px 28px; }
  .cta-eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }
  .cta-msg { margin: 0; font-family: var(--serif); font-size: 20px; line-height: 1.45; color: var(--ink); }

  footer.doc { text-align: center; color: var(--ink-muted); font-size: 12.5px; margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--border); }

  .reveal { opacity: 0; transform: translateY(10px); transition: opacity .5s ease, transform .5s ease; }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } html { scroll-behavior: auto; } }

  @media (max-width: 640px) {
    .wrap { padding: 36px 16px 64px; }
    header.doc h1 { font-size: 25px; }
    .finding, .perf, .cta, .headline-cost, .questions { padding: 18px 18px; }
  }
  @media print {
    body { background: #fff; }
    .finding, .perf, .cta, .headline-cost, .questions, figure.shot { break-inside: avoid; box-shadow: none; }
    .reveal { opacity: 1; transform: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      <div class="eyebrow">Conversion audit</div>
      <h1>${esc(report.headline)}</h1>
      ${report.intro ? `<p class="intro">${esc(report.intro)}</p>` : ""}
    </header>
    ${screenshotBlock}
    ${costBlock}
    <div class="section-label">What's leaking right now</div>
    ${findings.map((f, i) => renderFinding(f, i)).join("\n")}
    ${perfBlock}
    ${questionsBlock}
    ${ctaBlock}
    <footer class="doc">${footerParts.join(" · ")}</footer>
  </div>
  <script>
    (function () {
      if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
      document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    })();
  </script>
</body>
</html>`;
}
