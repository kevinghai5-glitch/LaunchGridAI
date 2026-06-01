// Cold-Open Audit HTML renderer.
//
// Produces a standalone, premium, single-page mini-report — the free value we
// send cold before pitching the full pack. No external assets: theme is inlined
// and niche-aware so a med spa reads luxe and a roofer reads trust-heavy. The
// embedded screenshot (signed ScreenshotOne URL) loads from the network when
// opened online; if it fails it gracefully hides.

import type { ColdAuditReport, ColdAuditFinding } from "@/types";
import { resolveNicheTheme, type NicheTheme } from "./niche-theme";

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

function renderFinding(f: ColdAuditFinding, i: number): string {
  return `<div class="finding reveal">
    <div class="f-head">
      <span class="f-num">${(i + 1).toString().padStart(2, "0")}</span>
      <h3>${esc(f.title)}</h3>
      <span class="pill ${esc(f.severity)}">${esc(f.severity)}</span>
    </div>
    <p class="f-problem">${esc(f.problem)}</p>
    <div class="f-cost"><span class="f-cost-label">What it's costing you</span>${esc(
      f.whyItCosts
    )}</div>
  </div>`;
}

export function renderColdAuditHtml(report: ColdAuditReport): string {
  const theme: NicheTheme = resolveNicheTheme(report.industry);
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

  const ctaBlock = report.closingCta?.message
    ? `<div class="cta reveal">
        <div class="cta-eyebrow">One quick thing</div>
        <p class="cta-msg">${para(report.closingCta.message).replace(/^<p>|<\/p>$/g, "")}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A quick look at ${esc(report.businessName)}</title>
<style>
  :root {
    --ink: #14161b; --muted: #56606e; --soft: #8a93a2; --line: #e7e9ee;
    --accent: ${theme.accent}; --accent-soft: ${theme.accentSoft};
    --grad-a: ${theme.gradientStart}; --grad-b: ${theme.gradientEnd};
    --bg: #f4f5f8; --card: #ffffff;
    --high: #b42318; --med: #b54708; --low: #027a48;
    --heading: ${theme.headingFont};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background:
      radial-gradient(1100px 560px at 82% -120px, color-mix(in srgb, var(--accent) 13%, transparent), transparent 60%),
      radial-gradient(820px 480px at -8% 220px, color-mix(in srgb, var(--accent) 8%, transparent), transparent 55%),
      var(--bg);
    color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.62; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: var(--heading); }
  .wrap { max-width: 760px; margin: 0 auto; padding: 48px 22px 96px; }
  header.doc {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
    color: #fff; border-radius: 20px; padding: 40px 40px 36px; margin-bottom: 26px;
    box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--grad-b) 60%, transparent);
  }
  header.doc::before {
    content: ""; position: absolute; inset: -40% -20% auto auto; width: 70%; height: 200%;
    background: radial-gradient(closest-side, rgba(255,255,255,.18), transparent 70%); pointer-events: none;
  }
  header.doc > * { position: relative; }
  header.doc .eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: 11px; opacity: .88; margin-bottom: 14px; font-weight: 600; }
  header.doc h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.18; letter-spacing: -.02em; font-weight: 700; }
  header.doc .intro { font-size: 15.5px; opacity: .95; margin: 0; max-width: 56ch; }
  header.doc .who { margin-top: 18px; font-size: 13px; opacity: .85; }
  figure.shot { margin: 0 0 26px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #0b1220; box-shadow: 0 16px 38px -24px rgba(0,0,0,.45); }
  figure.shot img { display: block; width: 100%; height: auto; }
  figure.shot figcaption { background: #0b1220; color: #cdd7ea; padding: 10px 15px; font-size: 12.5px; letter-spacing: .01em; }
  .section-label { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin: 0 4px 14px; }
  .finding {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 22px 24px; margin-bottom: 14px;
    box-shadow: 0 1px 2px rgba(15,17,28,.04), 0 10px 26px -18px rgba(15,17,28,.10);
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .finding:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 30%, var(--line)); box-shadow: 0 1px 2px rgba(15,17,28,.04), 0 18px 38px -22px rgba(15,17,28,.16); }
  .f-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .f-num { font-family: var(--heading); font-size: 13px; font-weight: 700; color: var(--accent); background: var(--accent-soft); padding: 4px 9px; border-radius: 8px; letter-spacing: .04em; }
  .f-head h3 { margin: 0; font-size: 18px; letter-spacing: -.015em; flex: 1; line-height: 1.3; }
  .f-problem { margin: 0 0 12px; color: var(--muted); }
  .f-cost { background: var(--accent-soft); border-radius: 10px; padding: 13px 16px; font-size: 14.5px; }
  .f-cost-label { display: block; text-transform: uppercase; letter-spacing: .08em; font-size: 10.5px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .pill.high { background: #fee4e2; color: var(--high); }
  .pill.medium { background: #fef0c7; color: var(--med); }
  .pill.low { background: #d1fadf; color: var(--low); }
  .perf { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(15,17,28,.04), 0 10px 26px -18px rgba(15,17,28,.10); }
  .perf-metrics { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .metric { background: linear-gradient(180deg, #fff, var(--bg)); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; min-width: 120px; }
  .metric .v { font-family: var(--heading); font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .metric .v .u { font-size: 14px; color: var(--soft); font-weight: 600; margin-left: 2px; }
  .metric .k { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--soft); margin-top: 2px; font-weight: 600; }
  .perf-read { margin: 0; color: var(--muted); font-size: 14.5px; }
  .cta { margin-top: 26px; background: linear-gradient(135deg, var(--accent-soft), color-mix(in srgb, var(--accent-soft) 50%, #fff)); border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line)); border-left: 4px solid var(--accent); border-radius: 14px; padding: 24px 26px; }
  .cta-eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 10px; }
  .cta-msg { margin: 0; font-family: var(--heading); font-size: 19px; line-height: 1.45; font-weight: 600; letter-spacing: -.01em; }
  footer.doc { text-align: center; color: var(--soft); font-size: 12.5px; margin-top: 38px; }
  .reveal { opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .5s ease; }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } .finding:hover { transform: none; } }
  @media (max-width: 640px) {
    .wrap { padding: 30px 15px 64px; }
    header.doc { padding: 28px 24px; }
    header.doc h1 { font-size: 24px; }
    .finding, .perf, .cta { padding: 18px 18px; }
  }
  @media print {
    body { background: #fff; }
    .finding, .perf, .cta { break-inside: avoid; box-shadow: none; }
    .reveal { opacity: 1; transform: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      <div class="eyebrow">${esc(theme.eyebrow)}</div>
      <h1>${esc(report.headline)}</h1>
      ${report.intro ? `<p class="intro">${esc(report.intro)}</p>` : ""}
      <div class="who">${esc(report.businessName)}${
        report.city ? ` · ${esc(report.city)}` : ""
      }</div>
    </header>
    ${screenshotBlock}
    <div class="section-label">What I noticed</div>
    ${findings.map((f, i) => renderFinding(f, i)).join("\n")}
    ${perfBlock}
    ${ctaBlock}
    <footer class="doc">${esc(report.businessName)} · ${esc(
      new Date(report.generatedAt).toLocaleDateString()
    )}</footer>
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
