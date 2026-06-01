// HTML deliverable builders (File 1 and File 5).
//
// Produces standalone, styled, responsive HTML documents that read like premium
// client-facing consulting deliverables. No external assets — everything is
// inlined so the file works when downloaded and opened directly.

import type {
  AssetPack,
  AssetSection,
  GrowthAuditFile,
  LeadQualificationFile,
  EmailNurtureFile,
  SmsFollowUpFile,
  BookingSystemFile,
  AssetPackMeta,
  TechnicalUxSection,
  VisualIntelligence,
  DeliverableFraming,
} from "@/types";
import { resolveNicheTheme, type NicheTheme } from "./niche-theme";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Preserve author line breaks inside long-form copy.
function para(s: string | null | undefined): string {
  if (!s) return "";
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function list(items: string[] | undefined, ordered = false): string {
  if (!items?.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
}

function section(num: number, title: string, inner: string): string {
  if (!inner) return "";
  const id = `sec-${num.toString().padStart(2, "0")}-${slugify(title)}`;
  return `<section class="sec reveal" id="${id}"><div class="sec-num">${num
    .toString()
    .padStart(2, "0")}</div><h2>${esc(title)}</h2>${inner}</section>`;
}

// Extract section anchors from rendered body for the sticky TOC.
function buildToc(body: string): string {
  const re = /<section class="sec reveal" id="(sec-[^"]+)">[\s\S]*?<h2>([^<]+)<\/h2>/g;
  const items: { id: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    items.push({ id: m[1], title: m[2] });
  }
  if (items.length < 3) return "";
  return `<nav class="toc" aria-label="Document sections"><div class="toc-label">In this document</div><ol>${items
    .map((i, idx) => `<li><a href="#${i.id}"><span class="toc-n">${(idx + 1)
      .toString()
      .padStart(2, "0")}</span>${i.title}</a></li>`)
    .join("")}</ol></nav>`;
}

function shell(meta: AssetPackMeta, docTitle: string, body: string): string {
  const confidence = meta.dataConfidence.toUpperCase();
  const theme: NicheTheme = resolveNicheTheme(meta.industry);
  const toc = buildToc(body);
  const assumptions = meta.assumptions.length
    ? `<div class="assumptions"><strong>Methodology note.</strong> ${meta.assumptions
        .map((a) => esc(a))
        .join(" ")}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)} — ${esc(meta.businessName)}</title>
<style>
  :root {
    --ink: #14161b; --muted: #56606e; --soft: #8a93a2; --line: #e7e9ee;
    --accent: ${theme.accent}; --accent-soft: ${theme.accentSoft};
    --grad-a: ${theme.gradientStart}; --grad-b: ${theme.gradientEnd};
    --bg: #f4f5f8; --card: #ffffff; --warn: #b54708;
    --high: #b42318; --med: #b54708; --low: #027a48;
    --heading: ${theme.headingFont};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background:
      radial-gradient(1200px 600px at 80% -100px, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%),
      radial-gradient(900px 500px at -10% 200px, color-mix(in srgb, var(--accent) 8%, transparent), transparent 55%),
      var(--bg);
    color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.62; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: var(--heading); }
  .layout { max-width: 1180px; margin: 0 auto; padding: 48px 24px 96px; display: grid; grid-template-columns: 240px 1fr; gap: 36px; }
  .toc { position: sticky; top: 32px; align-self: start; max-height: calc(100vh - 64px); overflow-y: auto; padding: 6px 4px; }
  .toc-label { text-transform: uppercase; letter-spacing: .12em; font-size: 10.5px; font-weight: 700; color: var(--soft); margin: 0 8px 10px; }
  .toc ol { list-style: none; margin: 0; padding: 0; }
  .toc li { margin: 0; }
  .toc a {
    display: flex; gap: 10px; align-items: baseline;
    text-decoration: none; color: var(--muted); font-size: 13px;
    padding: 7px 10px; border-radius: 7px; line-height: 1.35;
    border-left: 2px solid transparent; transition: background .15s ease, color .15s ease, border-color .15s ease;
  }
  .toc a:hover { background: rgba(0,0,0,.03); color: var(--ink); border-left-color: var(--accent); }
  .toc-n { font-size: 10.5px; font-weight: 700; color: var(--soft); letter-spacing: .04em; min-width: 18px; }
  .main { min-width: 0; }
  header.doc {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
    color: #fff; border-radius: 20px; padding: 44px 44px 40px; margin-bottom: 32px;
    box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--grad-b) 60%, transparent);
  }
  header.doc::before {
    content: ""; position: absolute; inset: -40% -20% auto auto; width: 70%; height: 200%;
    background: radial-gradient(closest-side, rgba(255,255,255,.18), transparent 70%);
    pointer-events: none;
  }
  header.doc::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.06), transparent 40%);
    pointer-events: none;
  }
  header.doc > * { position: relative; }
  header.doc .eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: 11.5px; opacity: .88; margin-bottom: 16px; font-weight: 600; }
  header.doc h1 { margin: 0 0 10px; font-size: 34px; line-height: 1.15; letter-spacing: -.02em; font-weight: 700; }
  header.doc .meta { font-size: 14.5px; opacity: .92; }
  header.doc .badge {
    display: inline-block; margin-top: 20px; background: rgba(255,255,255,.14);
    border: 1px solid rgba(255,255,255,.28); padding: 6px 14px; border-radius: 99px; font-size: 11.5px;
    font-weight: 600; letter-spacing: .04em; backdrop-filter: blur(8px);
  }
  .assumptions {
    background: #fff8ec; border: 1px solid #f5d9a8; color: #7a4d05;
    border-radius: 12px; padding: 14px 18px; font-size: 13.5px; margin-bottom: 28px;
  }
  .sec {
    background: var(--card); border: 1px solid var(--line); border-radius: 16px;
    padding: 30px 34px; margin-bottom: 18px; position: relative;
    box-shadow: 0 1px 2px rgba(15,17,28,.04), 0 8px 24px -16px rgba(15,17,28,.08);
    transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
  }
  .sec:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 2px rgba(15,17,28,.04), 0 16px 36px -20px rgba(15,17,28,.14);
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
  }
  .sec-num {
    position: absolute; top: 24px; right: 30px; font-size: 11.5px; font-weight: 700;
    color: var(--accent); letter-spacing: .08em;
    background: var(--accent-soft); padding: 4px 10px; border-radius: 99px;
  }
  h2 { font-size: 22px; margin: 0 0 16px; letter-spacing: -.015em; padding-right: 64px; font-weight: 700; }
  h3 { font-size: 15px; margin: 22px 0 8px; color: var(--ink); }
  p { margin: 0 0 12px; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 0 0 6px; }
  .muted { color: var(--muted); }
  .label { text-transform: uppercase; letter-spacing: .09em; font-size: 11px; font-weight: 700; color: var(--accent); margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 14px; }
  th, td { text-align: left; padding: 11px 13px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { background: var(--accent-soft); color: color-mix(in srgb, var(--grad-b) 80%, #000); font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
  tbody tr { transition: background .15s ease; }
  tbody tr:hover { background: color-mix(in srgb, var(--accent-soft) 60%, transparent); }
  .score { font-weight: 700; }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .pill.high { background: #fee4e2; color: var(--high); }
  .pill.medium { background: #fef0c7; color: var(--med); }
  .pill.low { background: #d1fadf; color: var(--low); }
  .card {
    background: linear-gradient(180deg, #fafbfd, var(--bg));
    border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 0 0 12px;
    transition: border-color .15s ease, transform .15s ease;
  }
  .card:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); transform: translateY(-1px); }
  .hero-quote {
    background: var(--accent-soft); border-left: 4px solid var(--accent);
    border-radius: 0 12px 12px 0; padding: 20px 22px;
    font-family: var(--heading); font-size: 21px; font-weight: 600; line-height: 1.3;
    margin: 0 0 14px; letter-spacing: -.01em;
  }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
  .ba > div { padding: 16px 18px; font-size: 14px; }
  .ba .before { background: #fff5f5; border-right: 1px solid var(--line); }
  .ba .after { background: #f2fbf6; }
  .ba .t { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; margin-bottom: 6px; color: var(--muted); }
  .email { border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin-bottom: 12px; background: var(--card); }
  .email .subj { font-weight: 700; margin-bottom: 4px; font-size: 15px; }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 6px 0 4px; }
  .shot { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #0b1220; box-shadow: 0 12px 28px -20px rgba(0,0,0,.4); }
  .shot img { display: block; width: 100%; height: auto; }
  .shot .cap { background: #0b1220; color: #e5edff; padding: 9px 13px; font-size: 12.5px; letter-spacing: .02em; font-weight: 500; }
  .shots-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; margin-bottom: 14px; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 6px 0 14px; }
  .metric {
    background: linear-gradient(180deg, #fff, var(--bg));
    border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px;
    transition: border-color .15s ease;
  }
  .metric:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
  .metric .v { font-family: var(--heading); font-size: 24px; font-weight: 700; letter-spacing: -.015em; color: var(--ink); }
  .metric .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--soft); margin-top: 2px; font-weight: 600; }
  .strategy-block {
    background: linear-gradient(135deg, var(--accent-soft), color-mix(in srgb, var(--accent-soft) 55%, #fff));
    border-left: 3px solid var(--accent);
    padding: 16px 18px; border-radius: 0 10px 10px 0; margin: 12px 0 16px; font-size: 14.5px;
  }
  details.collapsible {
    border: 1px solid var(--line); border-radius: 10px; padding: 0; margin: 0 0 10px;
    background: var(--card); transition: border-color .15s ease;
  }
  details.collapsible[open] { border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
  details.collapsible > summary {
    cursor: pointer; padding: 14px 18px; font-weight: 600; list-style: none;
    display: flex; justify-content: space-between; align-items: center;
  }
  details.collapsible > summary::-webkit-details-marker { display: none; }
  details.collapsible > summary::after {
    content: "+"; color: var(--accent); font-weight: 700; font-size: 18px; line-height: 1;
    transition: transform .2s ease;
  }
  details.collapsible[open] > summary::after { content: "−"; }
  details.collapsible > *:not(summary) { padding: 0 18px 16px; }
  footer.doc { text-align: center; color: var(--soft); font-size: 12.5px; margin-top: 40px; }
  .reveal { opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .5s ease; }
  .reveal.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .reveal { opacity: 1; transform: none; transition: none; }
    .sec:hover { transform: none; }
  }
  @media (max-width: 880px) {
    .layout { grid-template-columns: 1fr; gap: 0; padding: 32px 16px 64px; }
    .toc { display: none; }
    .grid2, .ba, .shots, .shots-row { grid-template-columns: 1fr; }
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
    header.doc { padding: 28px 24px; }
    header.doc h1 { font-size: 26px; }
    .sec { padding: 22px 22px; }
  }
  @media print {
    body { background: #fff; }
    .toc { display: none; }
    .layout { display: block; padding: 0; }
    .sec, .card { break-inside: avoid; box-shadow: none; }
    .reveal { opacity: 1; transform: none; }
  }
</style>
</head>
<body>
  <div class="layout">
    ${toc}
    <main class="main">
      <header class="doc">
        <div class="eyebrow">${esc(theme.eyebrow)}</div>
        <h1>${esc(docTitle)}</h1>
        <div class="meta">${esc(meta.businessName)}${meta.city ? ` · ${esc(meta.city)}` : ""}${
          meta.industry ? ` · ${esc(meta.industry)}` : ""
        }</div>
        <div class="badge">Data confidence: ${esc(confidence)}</div>
      </header>
      ${assumptions}
      ${body}
      <footer class="doc">${esc(meta.businessName)} · ${esc(
        new Date(meta.generatedAt).toLocaleDateString()
      )}</footer>
    </main>
  </div>
  <script>
    (function () {
      if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
      document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    })();
  </script>
</body>
</html>`;
}

function renderTechnicalUx(tux: TechnicalUxSection | undefined): string {
  if (!tux) return "";
  if (!tux.available) {
    return `<div class="strategy-block">${esc(
      tux.businessImpactSummary ||
        "Live page-speed data was unavailable for this run. Treat any technical UX commentary as a strategic assumption to verify post-engagement."
    )}</div>`;
  }
  const metricCell = (k: string, v: string | number | null | undefined) =>
    v == null || v === ""
      ? `<div class="metric"><div class="v muted">—</div><div class="k">${esc(k)}</div></div>`
      : `<div class="metric"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`;

  const grid = (label: string, m: TechnicalUxSection["mobile"]) =>
    m
      ? `<div class="label">${esc(label)}</div><div class="metric-grid">${metricCell(
          "Perf score",
          m.score != null ? `${m.score}/100` : null
        )}${metricCell("LCP", m.lcpSeconds != null ? `${m.lcpSeconds}s` : null)}${metricCell(
          "CLS",
          m.cls != null ? m.cls : null
        )}${metricCell("INP", m.inpMs != null ? `${m.inpMs}ms` : null)}</div>`
      : "";

  const fixes = (tux.topFixes ?? []).length
    ? `<div class="label">Highest-leverage fixes</div>${(tux.topFixes ?? [])
        .map(
          (f) =>
            `<div class="card"><strong>${esc(f.fix)}</strong><p>${esc(
              f.businessImpact
            )}</p></div>`
        )
        .join("")}`
    : "";

  return `${grid("Mobile (measured)", tux.mobile)}${grid("Desktop (measured)", tux.desktop)}${
    tux.businessImpactSummary
      ? `<div class="strategy-block">${esc(tux.businessImpactSummary)}</div>`
      : ""
  }${fixes}`;
}

function renderVisuals(viz: VisualIntelligence | undefined): string {
  if (!viz || !viz.available || !viz.shots?.length) return "";
  // Group by label (target/competitor) so desktop+mobile sit side-by-side.
  const groups = new Map<string, { desktop?: typeof viz.shots[number]; mobile?: typeof viz.shots[number] }>();
  for (const s of viz.shots) {
    const base = s.label.replace(/\s+—\s+(desktop|mobile)$/i, "").trim();
    const g = groups.get(base) ?? {};
    if (s.viewport === "desktop") g.desktop = s;
    else g.mobile = s;
    groups.set(base, g);
  }
  const blocks = Array.from(groups.entries())
    .map(([name, g]) => {
      const cells: string[] = [];
      if (g.desktop) {
        cells.push(
          `<div class="shot"><img loading="lazy" src="${esc(
            g.desktop.imageUrl
          )}" alt="${esc(g.desktop.label)}"><div class="cap">${esc(g.desktop.label)}</div></div>`
        );
      }
      if (g.mobile) {
        cells.push(
          `<div class="shot"><img loading="lazy" src="${esc(
            g.mobile.imageUrl
          )}" alt="${esc(g.mobile.label)}"><div class="cap">${esc(g.mobile.label)}</div></div>`
        );
      }
      return `<div class="label">${esc(name)}</div><div class="shots-row">${cells.join(
        ""
      )}</div>`;
    })
    .join("");
  return `${viz.competitiveRead ? `<div class="strategy-block">${esc(viz.competitiveRead)}</div>` : ""}${blocks}`;
}

// 4-section framing: Overview goes first, Implementation Guide + Expected
// Impact close the document. Returns "" when no framing exists (old packs).
function renderFramingOverview(framing: DeliverableFraming | undefined): string {
  if (!framing?.overview) return "";
  return `<div class="strategy-block">${para(framing.overview)}</div>`;
}

function renderFramingClose(framing: DeliverableFraming | undefined): string {
  if (!framing) return "";
  const guide = framing.implementationGuide?.length
    ? `<div class="label">Implementation guide</div>${list(framing.implementationGuide, true)}`
    : "";
  const impact = framing.expectedImpact
    ? `<div class="label">Expected impact</div><div class="strategy-block">${para(
        framing.expectedImpact
      )}</div>`
    : "";
  return `${guide}${impact}`;
}

function emailBlock(label: string, e: { subject: string; body: string }): string {
  if (!e?.subject && !e?.body) return "";
  return `<div class="email"><div class="label">${esc(label)}</div><div class="subj">${esc(
    e.subject
  )}</div>${para(e.body)}</div>`;
}

// ── FILE 1 ───────────────────────────────────────────────────────────────────

export function renderFile1Html(pack: AssetPack): string {
  const f: GrowthAuditFile = pack.file1;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(section(next(), "Executive Summary", para(f.executiveSummary)));

  const visualsHtml = renderVisuals(f.visuals);
  if (visualsHtml) {
    parts.push(section(next(), "Visual Intelligence (Target vs. Local Competitors)", visualsHtml));
  }

  const tuxHtml = renderTechnicalUx(f.technicalUx);
  if (tuxHtml) {
    parts.push(section(next(), "Technical UX & Performance", tuxHtml));
  }

  parts.push(
    section(
      next(),
      "Business Growth Audit",
      para(f.growthAudit?.overview) +
        (f.growthAudit?.findings?.length
          ? `<table><thead><tr><th>Area</th><th>Finding</th><th>Severity</th></tr></thead><tbody>${f.growthAudit.findings
              .map(
                (x) =>
                  `<tr><td><strong>${esc(x.area)}</strong></td><td>${esc(
                    x.finding
                  )}</td><td><span class="pill ${esc(x.severity)}">${esc(
                    x.severity
                  )}</span></td></tr>`
              )
              .join("")}</tbody></table>`
          : "")
    )
  );

  parts.push(
    section(
      next(),
      "Top 5 Revenue Leaks",
      f.revenueLeaks?.length
        ? `<table><thead><tr><th>Issue</th><th>Why it matters</th><th>Impact</th><th>Urgency</th><th>Difficulty</th><th>Recommended fix</th><th>Expected impact</th></tr></thead><tbody>${f.revenueLeaks
            .map(
              (l) =>
                `<tr><td><strong>${esc(l.issue)}</strong></td><td>${esc(
                  l.whyItMatters
                )}</td><td class="score">${esc(l.impact)}/10</td><td class="score">${esc(
                  l.urgency
                )}/10</td><td class="score">${esc(l.difficulty)}/10</td><td>${esc(
                  l.recommendedFix
                )}</td><td>${esc(l.expectedImpact)}</td></tr>`
            )
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Conversion Bottleneck Analysis",
      (f.conversionBottlenecks ?? [])
        .map(
          (b) =>
            `<div class="card"><h3>${esc(b.stage)}</h3><p><strong>Problem.</strong> ${esc(
              b.problem
            )}</p><p><strong>Fix.</strong> ${esc(b.fix)}</p></div>`
        )
        .join("")
    )
  );

  const lmi = f.localMarketIntelligence;
  parts.push(
    section(
      next(),
      "Local Market Intelligence",
      lmi
        ? [
            ["Customer Psychology", lmi.customerPsychology],
            ["Buying Behavior", lmi.buyingBehavior],
            ["Trust Expectations", lmi.trustExpectations],
            ["Competitive Saturation", lmi.competitiveSaturation],
            ["Seasonal Demand", lmi.seasonalDemand],
            ["Price Sensitivity", lmi.priceSensitivity],
            ["Local Credibility Markers", lmi.credibilityMarkers],
          ]
            .map(([t, v]) => `<div class="label">${esc(t)}</div>${para(v)}`)
            .join("")
        : ""
    )
  );

  const cp = f.competitorPositioning;
  parts.push(
    section(
      next(),
      "Competitor Positioning Analysis",
      cp
        ? `<div class="label">Common weak messaging</div>${list(cp.commonWeakMessaging)}
           <div class="label">Overused claims</div>${list(cp.overusedClaims)}
           <div class="label">Trust gaps competitors ignore</div>${list(cp.trustGapsIgnored)}
           <div class="label">Opportunities to stand out</div>${list(cp.opportunitiesToStandOut)}
           <div class="label">Recommended angle</div>${para(cp.recommendedAngle)}`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Trust Gap Analysis",
      (f.trustGapAnalysis ?? [])
        .map(
          (g) =>
            `<div class="card"><h3>${esc(g.gap)}</h3><p><strong>Impact.</strong> ${esc(
              g.impact
            )}</p><p><strong>Fix.</strong> ${esc(g.fix)}</p></div>`
        )
        .join("")
    )
  );

  parts.push(section(next(), "Fastest Conversion Wins", list(f.fastestWins)));
  parts.push(section(next(), "Recommended Positioning Strategy", para(f.positioningStrategy)));

  const lp = f.landingPage;
  parts.push(
    section(
      next(),
      "Complete Landing Page Copy",
      lp
        ? `<div class="hero-quote">${esc(lp.heroHeadline)}</div>${para(lp.heroSubheadline)}
           <div class="label">CTA block</div>${para(lp.ctaBlock)}
           <div class="label">Problem</div>${para(lp.problemSection)}
           <div class="label">Solution</div>${para(lp.solutionSection)}
           <div class="label">Offer</div>${para(lp.offerSection)}
           <div class="label">3-step process</div>${list(
             (lp.threeStepProcess ?? []).map((s) => `${s.step} — ${s.description}`),
             true
           )}
           <div class="label">Benefits</div>${list(lp.benefits)}
           <div class="label">Trust / proof section</div>${para(lp.trustSection)}
           <div class="label">Testimonials</div>${(lp.testimonials ?? [])
             .map(
               (t) =>
                 `<div class="card">“${esc(t.quote)}”<br><span class="muted">— ${esc(
                   t.name
                 )}, ${esc(t.location)}</span></div>`
             )
             .join("")}
           <div class="label">FAQ / objection handling</div>${(lp.faq ?? [])
             .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
             .join("")}
           <div class="label">Urgency / scarcity</div>${para(lp.urgencyBlock)}
           <div class="label">Final CTA</div>${para(lp.finalCta)}`
        : ""
    )
  );

  parts.push(section(next(), "Landing Page Structure", list(f.landingStructure, true)));
  parts.push(section(next(), "CTA Strategy", para(f.ctaStrategy)));
  parts.push(section(next(), "Social Proof Recommendations", list(f.socialProofRecommendations)));
  parts.push(section(next(), "Urgency / Scarcity Strategy", para(f.urgencyStrategy)));
  parts.push(section(next(), "Implementation Notes", para(f.implementationNotes)));

  parts.push(
    section(
      next(),
      "Recommended Tech Stack",
      (f.techStack ?? []).length
        ? `<table><thead><tr><th>Tool</th><th>Purpose</th></tr></thead><tbody>${f.techStack
            .map((t) => `<tr><td><strong>${esc(t.tool)}</strong></td><td>${esc(t.purpose)}</td></tr>`)
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(section(next(), "Tracking / Analytics Recommendations", list(f.trackingAnalytics)));
  parts.push(section(next(), "Loom Walkthrough Talking Points", list(f.loomTalkingPoints)));

  parts.push(
    section(
      next(),
      "Before / After Content Angles",
      (f.beforeAfterAngles ?? [])
        .map(
          (b) =>
            `<div class="ba"><div class="before"><div class="t">Before</div>${esc(
              b.before
            )}</div><div class="after"><div class="t">After</div>${esc(b.after)}</div></div>`
        )
        .join("")
    )
  );

  const se = f.salesEnablement;
  parts.push(
    section(
      next(),
      "High-Ticket Sales Enablement",
      se
        ? `<div class="label">Cold outreach angle</div>${para(se.coldOutreachAngle)}
           <div class="label">Personalized opener</div>${para(se.personalizedOpener)}
           <div class="label">Loom audit script</div>${list(se.loomScriptBullets)}
           <div class="label">Proposal positioning</div>${para(se.proposalPositioning)}
           <div class="label">Discovery call talking points</div>${list(se.discoveryCallPoints)}
           <div class="label">Objection handling</div>${(se.objectionHandling ?? [])
             .map(
               (o) => `<div class="card"><strong>${esc(o.objection)}</strong>${para(o.response)}</div>`
             )
             .join("")}`
        : ""
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation & Expected Impact", close));

  return shell(pack.meta, "Landing Page Growth Audit", parts.join("\n"));
}

// ── FILE 5 ───────────────────────────────────────────────────────────────────

export function renderFile5Html(pack: AssetPack): string {
  const f: BookingSystemFile = pack.file5;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "Booking Page",
      `<div class="hero-quote">${esc(f.headline)}</div>${para(f.subheadline)}`
    )
  );
  parts.push(section(next(), "What to Expect", list(f.whatToExpect)));
  parts.push(
    section(
      next(),
      "3-Step Appointment Breakdown",
      list((f.threeStepBreakdown ?? []).map((s) => `${s.step} — ${s.description}`), true)
    )
  );
  parts.push(section(next(), "Appointment Positioning", para(f.appointmentPositioning)));
  parts.push(section(next(), "Micro Social Proof", list(f.microSocialProof)));
  parts.push(
    section(
      next(),
      "Email & SMS Sequence",
      emailBlock("Confirmation email", f.confirmationEmail) +
        emailBlock("24-hour reminder email", f.reminderEmail24h) +
        `<div class="label">Day-of reminder SMS</div><div class="card">${esc(
          f.dayOfReminderSms
        )}</div>` +
        emailBlock("No-show recovery email", f.noShowRecoveryEmail) +
        `<div class="label">No-show recovery SMS 1</div><div class="card">${esc(
          f.noShowRecoverySms1
        )}</div>` +
        `<div class="label">No-show recovery SMS 2</div><div class="card">${esc(
          f.noShowRecoverySms2
        )}</div>`
    )
  );
  parts.push(section(next(), "Reschedule Framing", para(f.rescheduleFraming)));
  parts.push(section(next(), "Show-Up Quality Notes", para(f.showUpQualityNotes)));
  parts.push(section(next(), "Implementation Instructions", list(f.implementation, true)));

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Booking & Appointment System", parts.join("\n"));
}

// ── FILE 2 ───────────────────────────────────────────────────────────────────

export function renderFile2Html(pack: AssetPack): string {
  const f: LeadQualificationFile = pack.file2;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "Lead Qualification Form",
      `<div class="hero-quote">${esc(f.formHeadline)}</div>${para(f.formSubheadline)}`
    )
  );

  parts.push(
    section(
      next(),
      "Intake Questions",
      (f.questions ?? [])
        .map(
          (q, i) =>
            `<div class="card"><h3>${i + 1}. ${esc(q.question)}</h3><p class="muted"><strong>Input.</strong> ${esc(
              q.inputType
            )}</p>${
              q.options?.length
                ? `<p class="muted"><strong>Options.</strong> ${esc(q.options.join(" · "))}</p>`
                : ""
            }<p><strong>Purpose.</strong> ${esc(q.purpose)}</p><p><strong>Scoring.</strong> ${esc(
              q.scoringImpact
            )}</p></div>`
        )
        .join("")
    )
  );

  const ls = f.leadScoring;
  parts.push(
    section(
      next(),
      "Lead Scoring Model",
      ls
        ? `<div class="label">Rubric</div>${para(ls.rubric)}
           <div class="label">Hot</div>${para(ls.hot)}
           <div class="label">Warm</div>${para(ls.warm)}
           <div class="label">Cold / nurture</div>${para(ls.cold)}`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Routing Logic",
      f.routingLogic?.length
        ? `<table><thead><tr><th>Tier</th><th>Timing</th><th>Action</th></tr></thead><tbody>${f.routingLogic
            .map(
              (r) =>
                `<tr><td><strong>${esc(r.tier)}</strong></td><td>${esc(r.timing)}</td><td>${esc(
                  r.action
                )}</td></tr>`
            )
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Automation & Implementation",
      `<div class="label">Automation workflow</div>${list(f.automationWorkflow)}
       <div class="label">Thank-you page</div>${para(f.thankYouPage)}
       <div class="label">CRM fields</div>${list(f.crmFields)}
       <div class="label">Follow-up timing</div>${para(f.followUpTiming)}
       <div class="label">Implementation</div>${list(f.implementation, true)}`
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Lead Qualification System", parts.join("\n"));
}

// ── FILE 3 ───────────────────────────────────────────────────────────────────

export function renderFile3Html(pack: AssetPack): string {
  const f: EmailNurtureFile = pack.file3;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "7-Day Email Nurture Sequence",
      (f.emails ?? [])
        .map(
          (e) =>
            `<div class="email"><div class="label">Email · Day ${esc(e.day)} · ${esc(
              e.timing
            )}${e.purpose ? ` · ${esc(e.purpose)}` : ""}</div><div class="subj">${esc(
              e.subject
            )}</div>${
              e.subjectB ? `<p class="muted">A/B subject: ${esc(e.subjectB)}</p>` : ""
            }${
              e.previewText ? `<p class="muted">Preview: ${esc(e.previewText)}</p>` : ""
            }${para(e.body)}${
              e.cta ? `<div class="strategy-block">${esc(e.cta)}</div>` : ""
            }</div>`
        )
        .join("")
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Email Nurture System", parts.join("\n"));
}

// ── FILE 4 ───────────────────────────────────────────────────────────────────

export function renderFile4Html(pack: AssetPack): string {
  const f: SmsFollowUpFile = pack.file4;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "SMS Follow-Up Sequence",
      (f.messages ?? [])
        .map(
          (m) =>
            `<div class="card"><div class="label">Message ${esc(m.order)} · send ${esc(
              m.timing
            )} · ${esc(m.charCount)} chars</div><p><strong>${esc(
              m.message
            )}</strong></p><p class="muted"><strong>Psychology.</strong> ${esc(
              m.psychology
            )}</p><p class="muted"><strong>On reply.</strong> ${esc(m.replyStrategy)}</p></div>`
        )
        .join("")
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "SMS Follow-Up System", parts.join("\n"));
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

// Render any of the five files as a standalone, premium client-facing HTML
// document — used by Studio to preview the *actual deliverable* (not the
// in-app data view).
export function renderFileHtml(pack: AssetPack, section: AssetSection): string {
  switch (section) {
    case "file1":
      return renderFile1Html(pack);
    case "file2":
      return renderFile2Html(pack);
    case "file3":
      return renderFile3Html(pack);
    case "file4":
      return renderFile4Html(pack);
    case "file5":
      return renderFile5Html(pack);
  }
}
