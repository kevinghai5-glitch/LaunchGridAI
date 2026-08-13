// Shared HTML deliverable primitives: the document shell, CSS design system,
// and the small render helpers used by the deliverable composer
// (deliverables.ts), which is this file's only consumer.
//
// Everything is inlined (fonts excepted) — the produced HTML works standalone
// when downloaded. The design language (v3) is a RESTRAINED, light, consulting-
// grade report: serif headings + Inter body, flat fills (zero gradients), a
// single muted-gold accent, hairline borders, no shadows.
// A print-safe plain-language clarification layer (info markers + glossary)
// explains genuine jargon for non-technical owners (Law 14).
//
// The stylesheet carries ONLY vocabulary the composer actually emits. Roughly
// 100 selectors for the pre-rebuild deliverables (leak tabs, scorecards,
// funnels, roadmap timelines, dollar callouts) were removed once rendering all
// three documents proved nothing reached them — a stylesheet that styles things
// nobody emits is how `.leak-card` shipped with no rules at all.

import type {
  AssetPackMeta,
  TechnicalUxSection,
  VisualIntelligence,
  DeliverableFraming,
} from "@/types";
import { AGENCY_NAME } from "../brand";
import { carriesScreenshotCredential } from "../screenshotone";

// Part B: the one line that replaces every site-speed / redesign recommendation.
// Measured performance data may still be shown as context, but the engagement
// never prescribes technical fixes — this closes the section and moves on.
export const OUT_OF_SCOPE_PERFORMANCE_LINE =
  "Site performance sits outside this engagement — worth flagging to whoever manages your website. Everything we fix below works within your existing site.";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Preserve author line breaks inside long-form copy.
export function para(s: string | null | undefined): string {
  if (!s) return "";
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Blank entries are dropped rather than rendered: a copy option emptied upstream
// would otherwise become a bullet with nothing beside it, and an empty <li> in a
// client document reads as missing content, not as an absent option.
export function list(items: string[] | undefined, ordered = false): string {
  const kept = items?.filter((i) => i?.trim()) ?? [];
  if (!kept.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${kept.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
}

export function section(num: number, title: string, inner: string): string {
  if (!inner) return "";
  const id = `sec-${num.toString().padStart(2, "0")}-${slugify(title)}`;
  return `<section class="sec" id="${id}"><div class="sec-head"><div class="sec-num">${num
    .toString()
    .padStart(2, "0")}</div><h2>${esc(title)}</h2></div><div class="sec-inner">${inner}</div></section>`;
}

// Extract section anchors from rendered body for the sticky TOC. Run on the
// ORIGINAL (pre-glossary-annotation) body so titles stay clean.
//
// The class match is `sec[^"]*` because a weighted section emits `sec sec--key`
// or `sec sec--method`. Matching `class="sec"` exactly made every weighted
// section invisible here, which on a three-section Diagnosis carrying two of
// them left one item, tripped the floor below, and dropped the rail entirely.
export function buildToc(body: string): string {
  const re = /<section class="sec[^"]*" id="(sec-[^"]+)">[\s\S]*?<h2>([^<]+)<\/h2>/g;
  const items: { id: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    items.push({ id: m[1], title: m[2] });
  }
  if (items.length < 3) return "";
  return `<nav class="toc" aria-label="Document sections"><div class="toc-label">Contents</div><ol>${items
    .map((i, idx) => `<li><a href="#${i.id}"><span class="toc-n">${(idx + 1)
      .toString()
      .padStart(2, "0")}</span><span class="toc-t">${i.title}</span></a></li>`)
    .join("")}</ol></nav>`;
}

// Priority/difficulty badge.
export function pill(kind: string | undefined, label?: string): string {
  if (!kind) return "";
  const k = String(kind).toLowerCase();
  const cls =
    k === "critical" ? "crit" : k === "high" ? "high" : k === "medium" ? "medium" : "low";
  return `<span class="pill ${cls}">${esc(label ?? kind)}</span>`;
}

// ── Plain-language clarification layer (Law 14) ───────────────────────────────
// Only GENUINE jargon a non-technical owner would stumble on. Each definition is
// one warm, non-condescending sentence. The first occurrence of a term anywhere
// in a document gets a click/tap info marker; a full glossary backstops print.

interface GlossaryTerm {
  term: string;
  def: string;
}

const GLOSSARY: GlossaryTerm[] = [
  { term: "speed-to-lead", def: "How fast you respond to a new lead. The faster you reply, the far more likely they are to book — minutes matter, not hours." },
  { term: "conversion rate", def: "The share of visitors or leads who take the action you want (call, form, booking). A small lift here compounds into real revenue." },
  { term: "lead qualification", def: "Sorting incoming leads so you spend time on the ones most likely to become paying customers." },
  { term: "lead nurturing", def: "Staying in front of leads who aren't ready yet with timely, helpful follow-up so they choose you when they are." },
  { term: "CRM pipeline", def: "The system that tracks every lead from first contact to booked job, so none slip through the cracks." },
  { term: "no-show rate", def: "The share of booked appointments where the person doesn't turn up — reminders and confirmations bring this down." },
  { term: "above-the-fold", def: "The part of your page a visitor sees before scrolling — the most valuable real estate for your offer and call-to-action." },
  { term: "bounce rate", def: "The share of visitors who leave after seeing just one page without taking any action." },
  { term: "CTA", def: "Call-to-action — the button or prompt that tells a visitor exactly what to do next, like \u201CBook a free estimate.\u201D" },
  { term: "LCP", def: "Largest Contentful Paint — how long the main content takes to appear. Slow loads quietly cost you leads." },
  { term: "CLS", def: "Cumulative Layout Shift — how much the page jumps around while loading. Lots of shifting frustrates visitors and hurts trust." },
  { term: "INP", def: "Interaction to Next Paint — how quickly the page reacts when someone taps or clicks. Laggy pages feel broken." },
  { term: "routing", def: "Automatically sending each lead or call to the right person or step instantly, so nothing waits in an inbox." },
];

function infoMarker(g: GlossaryTerm): string {
  return `<details class="lg-info"><summary aria-label="What does ${esc(
    g.term
  )} mean?">&#9432;</summary><span class="lg-pop"><strong>${esc(g.term)}.</strong> ${esc(
    g.def
  )}</span></details>`;
}

// Insert a click-to-reveal info marker after the FIRST mention of each glossary
// term across the whole document. Walks HTML text segments only (tags untouched),
// so attributes and existing markup are never corrupted.
export function annotateGlossary(html: string): string {
  const used = new Set<string>();
  const parts = html.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i += 2) {
    let text = parts[i];
    if (!text) continue;
    // Collect insertions (position + marker) for terms not yet used.
    const inserts: { pos: number; html: string }[] = [];
    for (const g of GLOSSARY) {
      if (used.has(g.term)) continue;
      const re = new RegExp(`\\b${g.term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`, "i");
      const m = re.exec(text);
      if (m) {
        used.add(g.term);
        inserts.push({ pos: m.index + m[0].length, html: infoMarker(g) });
      }
    }
    if (inserts.length) {
      inserts.sort((a, b) => b.pos - a.pos);
      for (const ins of inserts) text = text.slice(0, ins.pos) + ins.html + text.slice(ins.pos);
      parts[i] = text;
    }
  }
  return parts.join("");
}

// Full glossary block — only terms that actually appeared get listed; it doubles
// as the print backstop for the inline markers.
function glossaryBlock(html: string): string {
  const present = GLOSSARY.filter((g) =>
    new RegExp(`\\b${g.term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`, "i").test(html)
  );
  if (!present.length) return "";
  const items = present
    .map(
      (g) =>
        `<div class="gl-item"><dt>${esc(g.term)}</dt><dd>${esc(g.def)}</dd></div>`
    )
    .join("");
  return `<section class="sec glossary"><div class="sec-head"><div class="sec-num">&#9432;</div><h2>Plain-English Glossary</h2></div><div class="sec-inner"><p class="muted">Quick, jargon-free definitions for the terms used in this report.</p><dl class="gl">${items}</dl></div></section>`;
}

export interface ShellOptions {
  subtitle?: string;
  docIndex?: string; // e.g. "01 / 04"
}

export function shell(
  meta: AssetPackMeta,
  docTitle: string,
  body: string,
  opts: ShellOptions = {}
): string {
  const toc = buildToc(body); // built on clean body
  const solo = toc === "";
  const prettyDate = new Date(meta.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const assumptions = meta.assumptions.length
    ? `<div class="assumptions"><span class="ico">&#9432;</span><div><strong>Methodology note.</strong> ${meta.assumptions
        .map((a) => esc(a))
        .join(" ")}</div></div>`
    : "";

  const marketLine = [meta.city, meta.industry].filter(Boolean).join(" \u00B7 ");

  // Glossary annotation happens on a copy for rendering; TOC used the clean body.
  const annotatedBody = annotateGlossary(body);
  const glossary = glossaryBlock(body);

  // Sticky top command bar — brand, live business context, and the workspace
  // controls (present mode + print). Print/present are inert-safe.
  //
  // Both buttons carry an aria-label because .cb-btxt is display:none below
  // 940px: without one, the narrow layout hands a screen reader two unlabelled
  // icon buttons.
  const cmdBar = `<div class="cmdbar">
    <span class="cb-brand"><span class="dot"></span>ReclaimedHQ</span>
    ${opts.docIndex ? `<span class="cb-idx">${esc(opts.docIndex)}</span>` : ""}
    <div class="cb-center">
      <span class="cb-biz">${esc(meta.businessName)}</span>
      ${marketLine ? `<span class="cb-sep">\u00B7</span><span class="cb-meta">${esc(marketLine)}</span>` : ""}
    </div>
    <div class="cb-right">
      <button class="cmd-btn" type="button" data-present aria-pressed="false" aria-label="Presentation mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        <span class="cb-btxt">Present</span>
      </button>
      <button class="cmd-btn" type="button" data-print aria-label="Print or save as PDF">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
        <span class="cb-btxt">Print / PDF</span>
      </button>
    </div>
  </div>`;

  // Leading newline so an absent rail leaves no blank line in the output.
  const rail = solo ? "" : `\n    <aside class="rail">${toc}</aside>`;

  const agencyLine =
    AGENCY_NAME.toLowerCase() !== "our team" ? ` \u00B7 ${esc(AGENCY_NAME)}` : "";

  // Unmissable "generated without client intake" marker. Set on the pack meta at
  // generation time when NO intake field was provided (the pure pre-intake
  // TESTING path). It renders as a full-width banner under the command bar AND a
  // stamp on the cover, and it prints. There is no toggle to remove it — the only
  // way it disappears is regenerating with real intake present.
  const testBanner = meta.internalTest
    ? `<div class="testbar" role="alert">INTERNAL TEST \u2014 generated without client intake. Not for client delivery.</div>`
    : "";
  const testStamp = meta.internalTest
    ? `<div class="test-stamp">INTERNAL TEST \u00B7 no client intake</div>`
    : "";
  // The banner is sticky, so on a test document the chrome an anchor has to
  // clear is taller than the command bar alone. This is how --sticky learns it.
  const htmlClass = meta.internalTest ? ` class="has-testbar"` : "";

  return `<!DOCTYPE html>
<html lang="en"${htmlClass}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)} \u2014 ${esc(meta.businessName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
<style>
  :root {
    /* v3 light/consulting palette — single muted-gold accent, hairline borders,
       three semantic colors. No blues, neons, gradients, or stray hex. */
    --bg: #FBFAF7;
    --surface: #FFFFFF;
    --surface-2: #F4F2EC;
    --ink: #1A1814;
    --ink-muted: #6B6659;
    --accent: #9A7B3F;
    --accent-tint: #F2ECDD;
    --border: #E7E3D8;
    --good: #3F7D5A;
    --warn: #B5862F;
    --critical: #A8443B;
    --heading: 'Source Serif 4', Georgia, 'Times New Roman', serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;

    /* Text-weight twins of the semantic colours. The originals were picked to
       read as RULES, BORDERS and DOTS at 1–8px, and a hue with enough chroma to
       register at that size fails AA as body text. Measured on the grounds they
       actually land on (WCAG normal text needs 4.5):
         --accent on white 3.98 · on tint 3.38   →  --accent-text 5.73 · 4.86
         --warn   on surface-2  2.92             →  --warn-text   5.90 · 5.27
         --good   on surface-2  4.37             →  --good-text   6.25 · 5.58
       So fills, borders and dots keep --accent/--warn/--good; anything a reader
       has to READ takes the -text twin. That is the whole reason two accents
       exist — they are not light/dark variants and are not interchangeable.
       --critical has no twin: it already clears AA as text (5.28 on surface-2). */
    --accent-text: #7E6229;
    --warn-text: #8A5A18;
    --good-text: #356B4C;
  }
  * { box-sizing: border-box; }
  /* How much sticky chrome sits above the page. The command bar is 54px at every
     width — the 940px block trims what it CONTAINS, never its height — so there
     is no responsive twin. The internal-test banner is the one thing that can
     grow the stack: it sticks directly under the bar and adds ~38px (13px of
     text at line-height 1.65, plus 8px of padding either side). Anchor offsets
     and the rail's own top both derive from this, so neither can drift from it. */
  :root { --sticky: 54px; }
  :root.has-testbar { --sticky: 92px; }
  /* Law 9: no motion. Anchor offset only — no smooth-scroll animation. */
  html { scroll-padding-top: calc(var(--sticky) + 24px); }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65; font-size: 16px; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    font-variant-numeric: tabular-nums;
  }
  h1, h2, h3, h4 { font-family: var(--heading); }
  /* Law 9: reading column clamped to ~860px even with the contents rail. */
  .layout {
    max-width: 1152px; margin: 0 auto; padding: 36px 28px 100px;
    display: grid; grid-template-columns: 244px minmax(0, 860px); gap: 48px;
    justify-content: center;
  }
  .layout.solo { grid-template-columns: minmax(0, 860px); max-width: 860px; }

  /* ── Internal-test marker (no client intake) ───────────────────────────── */
  .testbar {
    position: sticky; top: 54px; z-index: 49;
    background: var(--critical); color: #fff;
    font-weight: 700; font-size: 13px; letter-spacing: .02em;
    text-align: center; padding: 8px 24px;
    text-transform: uppercase;
  }
  .test-stamp {
    display: inline-block; margin-bottom: 14px;
    border: 1.5px solid var(--critical); color: var(--critical);
    font-weight: 700; font-size: 11px; letter-spacing: .06em;
    text-transform: uppercase; border-radius: 4px; padding: 4px 10px;
  }
  @media print {
    .testbar { position: static; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .test-stamp { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Command bar ───────────────────────────────────────────────────────── */
  .cmdbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; gap: 18px;
    padding: 0 24px; height: 54px;
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .cmdbar .cb-brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--heading); font-weight: 700; font-size: 14px; letter-spacing: -.01em; color: var(--ink); white-space: nowrap; }
  .cmdbar .cb-brand .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .cmdbar .cb-idx { font-size: 11px; font-weight: 600; letter-spacing: .14em; color: var(--ink-muted); text-transform: uppercase; padding-left: 14px; border-left: 1px solid var(--border); }
  .cmdbar .cb-center { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .cmdbar .cb-biz { font-weight: 600; font-size: 13.5px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40ch; }
  .cmdbar .cb-sep { color: var(--border); }
  .cmdbar .cb-meta { font-size: 12px; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cmdbar .cb-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .cmd-btn { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--border); cursor: pointer; white-space: nowrap; }
  .cmd-btn:hover { border-color: var(--accent); color: var(--accent); }
  .cmd-btn svg { width: 14px; height: 14px; }
  .cmd-btn.is-on { color: var(--accent); border-color: var(--accent); background: var(--accent-tint); }

  /* ── Contents rail ─────────────────────────────────────────────────────── */
  .rail { position: sticky; top: calc(var(--sticky) + 24px); align-self: start; max-height: calc(100vh - var(--sticky) - 44px); overflow-y: auto; padding: 2px 2px 8px; display: flex; flex-direction: column; gap: 18px; scrollbar-width: thin; }
  .rail::-webkit-scrollbar { width: 7px; } .rail::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
  .toc { padding: 0; }
  .toc-label { font-family: var(--heading); text-transform: uppercase; letter-spacing: .2em; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); margin: 0 10px 12px; }
  .toc ol { list-style: none; margin: 0; padding: 0; }
  .toc li { margin: 0; }
  .toc a {
    display: grid; grid-template-columns: 24px 1fr; gap: 9px; align-items: baseline;
    text-decoration: none; color: var(--ink-muted); font-size: 13px;
    padding: 7px 11px; border-radius: 6px; line-height: 1.4;
    border-left: 2px solid transparent;
  }
  .toc a:hover { background: var(--surface-2); color: var(--ink); }
  .toc-n { font-family: var(--heading); font-size: 11px; font-weight: 700; color: var(--accent-text); }
  .toc-t { font-weight: 500; }
  .main { min-width: 0; }

  /* ── Cover header ──────────────────────────────────────────────────────── */
  header.doc {
    position: relative; background: var(--surface); color: var(--ink);
    border: 1px solid var(--border); border-top: 3px solid var(--accent);
    border-radius: 4px; padding: 44px 46px 36px; margin-bottom: 30px;
  }
  header.doc .eyebrow { font-family: var(--heading); text-transform: uppercase; letter-spacing: .26em; font-size: 11px; color: var(--accent-text); margin-bottom: 16px; font-weight: 700; }
  header.doc h1 { margin: 0 0 14px; font-size: 38px; line-height: 1.1; letter-spacing: -.015em; font-weight: 700; max-width: 20ch; color: var(--ink); }
  header.doc .subtitle { font-size: 16px; line-height: 1.55; color: var(--ink-muted); max-width: 60ch; margin: 0 0 28px; }
  .cover-meta { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid var(--border); padding-top: 20px; }
  .cover-meta .cm { padding-right: 32px; margin-right: 32px; border-right: 1px solid var(--border); }
  .cover-meta .cm:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .cover-meta .cm .k { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-muted); margin-bottom: 5px; font-weight: 600; }
  .cover-meta .cm .v { font-size: 15px; font-weight: 600; color: var(--ink); }

  /* ── Methodology note ──────────────────────────────────────────────────── */
  .assumptions {
    display: flex; gap: 12px; align-items: flex-start;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--ink-muted);
    border-radius: 8px; padding: 14px 18px; font-size: 13.5px; margin-bottom: 28px;
  }
  .assumptions strong { color: var(--ink); }
  .assumptions .ico { flex: none; color: var(--accent); font-size: 16px; line-height: 1.3; }

  /* ── Sections ──────────────────────────────────────────────────────────── */
  .sec {
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    padding: 34px 38px; margin-bottom: 20px; position: relative;
  }
  .sec-head { display: flex; align-items: center; gap: 16px; margin: 0 0 22px; padding: 0 0 16px; border-bottom: 1px solid var(--border); }
  .sec-num { font-family: var(--heading); font-size: 13px; font-weight: 700; color: var(--accent-text); background: var(--accent-tint); padding: 5px 11px; border-radius: 6px; line-height: 1; flex: none; }
  .sec-inner > :first-child { margin-top: 0; }

  /* Three deliberate section WEIGHTS. Five identical white cards told the reader
     nothing about what mattered; these say it in the layout, before a word is
     read. Standard .sec is unchanged — the weights are the exceptions. */

  /* KEY — the anchor. The total, and the money. One or two per document. */
  .sec--key {
    background: var(--accent-tint);
    border-color: var(--accent);
    border-left: 4px solid var(--accent);
    border-radius: 0 6px 6px 0;
  }
  .sec--key .sec-head { border-bottom-color: var(--accent); }
  .sec--key h2 { font-size: 27px; }
  .sec--key .sec-num { background: var(--surface); }

  /* METHOD — recessed. Basis, assumptions, caveats. Always last. */
  .sec--method {
    background: transparent;
    border-style: dashed;
    padding: 24px 28px;
  }
  .sec--method h2 { font-size: 17px; }
  .sec--method .sec-inner { font-size: 13px; color: var(--ink-muted); }
  .sec--method .sec-num { display: none; }

  h2 { font-size: 24px; margin: 0; letter-spacing: -.015em; font-weight: 700; line-height: 1.2; max-width: 36ch; }
  h3 { font-size: 15.5px; margin: 24px 0 9px; color: var(--ink); letter-spacing: -.01em; }
  p { margin: 0 0 13px; color: var(--ink); max-width: 70ch; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 13px; padding-left: 22px; color: var(--ink); max-width: 70ch; }
  li { margin: 0 0 7px; }
  li::marker { color: var(--accent); }
  strong { color: var(--ink); font-weight: 600; }
  .muted { color: var(--ink-muted); }
  .label { font-family: var(--heading); text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent-text); margin: 26px 0 10px; display: flex; align-items: center; gap: 10px; }
  .label::after { content: ""; flex: 1; height: 1px; background: var(--border); }

  /* ── Tables ────────────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; margin: 10px 0 6px; font-size: 14px; }
  th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
  thead th { background: var(--surface-2); color: var(--ink); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: none; }

  /* Message tables. The 4-column Step/Channel/Timing/Message shape spent three
     columns on one fact and left a 40-word SMS to fight for what remained of an
     860px column. Two columns: WHEN (with the channel as a chip) and MESSAGE. */
  .msg-table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
  .msg-table th { text-align: left; background: var(--surface-2); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; padding: 9px 14px; border-bottom: 1px solid var(--border); }
  .msg-table th:first-child { width: 168px; }
  .msg-table td { padding: 15px 14px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 13.5px; }
  .msg-table tr:last-child td { border-bottom: none; }
  .msg-when { font-family: var(--heading); font-size: 12px; font-weight: 700; letter-spacing: -.005em; }
  .msg-when .chan { margin-top: 6px; display: inline-flex; }
  .msg-subj { font-weight: 700; display: block; margin-bottom: 5px; }
  .mf { font-family: var(--mono); font-size: 11.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; color: var(--accent-text); white-space: nowrap; }

  /* ── Pills / chips ─────────────────────────────────────────────────────── */
  /* Every pill sits on --surface-2 at 10.5px, so its label is normal text and
     owes 4.5. The border keeps the saturated token — it is a 1px rule — while
     the label takes the -text twin: --warn measured 2.92 there and --good 4.37.
     --critical stays as-is at 5.28, and --ink-muted at 5.11. */
  .pill { display: inline-block; padding: 3px 11px; border-radius: 99px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-muted); }
  .pill.crit { background: var(--surface-2); color: var(--critical); border-color: var(--critical); }
  .pill.high { color: var(--warn-text); border-color: var(--warn); }
  .pill.medium { color: var(--ink-muted); border-color: var(--border); }
  .pill.low { color: var(--good-text); border-color: var(--good); }
  /* Bare .chip is now emitted directly by the composer. It used to appear only
     with its colour overridden, which is why it was not on the audit's swap
     list — on the tint, plain --accent measures 3.38 and fails AA. */
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 99px; font-size: 11.5px; font-weight: 600; background: var(--accent-tint); color: var(--accent-text); border: 1px solid var(--border); }

  /* ── Generic cards / callouts ──────────────────────────────────────────── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; margin: 0 0 12px; }
  .hero-quote { background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; padding: 20px 24px; font-family: var(--heading); font-size: 22px; font-weight: 600; line-height: 1.3; margin: 0 0 16px; letter-spacing: -.01em; color: var(--ink); }

  /* Structured diagnostic / asset cards. Reached only through the legacy
     landing-assets shape on the pack, which generations predating conversion
     surfaces still carry — live, just not on a current generation. */
  .diag-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; margin: 0 0 12px; }
  .diag-card .dt { font-family: var(--heading); font-size: 16px; font-weight: 700; color: var(--ink); margin: 0 0 4px; letter-spacing: -.01em; }
  .diag-card .dt .pill { vertical-align: middle; margin-left: 8px; }
  .diag-row { margin: 11px 0; }
  .diag-row .dk { text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 700; color: var(--ink-muted); margin-bottom: 3px; }
  .diag-row p { margin: 0; font-size: 14px; color: var(--ink); }
  .diag-row.fix { background: var(--accent-tint); border-radius: 6px; padding: 11px 14px; margin-top: 12px; }
  .diag-row.fix .dk { color: var(--accent-text); }
  .struct-num { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--accent-tint); color: var(--accent-text); font-size: 11.5px; font-weight: 700; margin-right: 9px; }
  .opt-list { list-style: none; padding: 0; margin: 0 0 6px; counter-reset: opt; }
  .opt-list li { counter-increment: opt; position: relative; padding: 11px 15px 11px 40px; margin: 0 0 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 15px; color: var(--ink); }
  .opt-list li::before { content: counter(opt); position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 5px; background: var(--accent-tint); color: var(--accent-text); font-size: 10.5px; font-weight: 700; display: grid; place-items: center; }

  .email { border: 1px solid var(--border); border-radius: 6px; padding: 20px 22px; margin-bottom: 12px; background: var(--surface); position: relative; }
  .email::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 3px; background: var(--accent); }
  .email .subj { font-weight: 700; margin-bottom: 6px; font-size: 15.5px; color: var(--ink); }

  /* ── Diagnosis ─────────────────────────────────────────────────────────── */
  /* Headline panel — the screenshot-and-forward object. It goes FIRST: the only
     question the reader arrives with is how much, and it used to be answered
     last, after seven cards of working. */
  .headline {
    display: grid; grid-template-columns: minmax(0,1fr) 260px; gap: 32px;
    align-items: start;
  }
  .hl-amount {
    font-family: var(--heading); font-size: 46px; font-weight: 700;
    letter-spacing: -.03em; line-height: 1; color: var(--accent-text);
  }
  .hl-k {
    font-family: var(--heading); font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .14em;
    color: var(--ink-muted); margin-bottom: 10px;
  }
  .hl-annual { margin-top: 10px; font-size: 13.5px; color: var(--ink-muted); }
  .hl-inputs {
    border-left: 1px solid var(--border); padding-left: 24px;
    display: grid; gap: 14px;
  }
  .hl-input .k {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: var(--ink-muted); margin-bottom: 2px;
  }
  .hl-input .v {
    font-family: var(--heading); font-size: 19px; font-weight: 700;
    letter-spacing: -.01em; color: var(--ink);
  }

  /* Top-three ranked bar — each leak's share of the total, drawn with one
     pseudo-element off a --share custom property. No chart library, nothing to
     load, and it still reads on paper. */
  .rank { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--accent); display: grid; gap: 12px; }
  .rank-row { display: grid; grid-template-columns: 24px minmax(0,1fr) 150px; gap: 14px; align-items: center; }
  .rank-n { font-family: var(--heading); font-size: 13px; font-weight: 700; color: var(--accent-text); }
  .rank-name { font-size: 14.5px; font-weight: 600; }
  .rank-bar { height: 8px; border-radius: 99px; background: var(--surface); border: 1px solid var(--border); position: relative; overflow: hidden; }
  .rank-bar::after { content: ""; position: absolute; inset: 0 auto 0 0; width: calc(var(--share) * 1%); background: var(--accent); }
  .rank-cost { font-family: var(--heading); font-size: 14px; font-weight: 700; color: var(--accent-text); text-align: right; white-space: nowrap; }

  /* Leak cards. .lc-head is a flex row with a gap because the title and the
     price were rendering glued together — "After hoursCAD $1,200–2,400/mo". */
  .leak-card {
    border: 1px solid var(--border); border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0; background: var(--surface);
    padding: 20px 24px; margin: 0 0 14px;
  }
  .leak-card:last-child { margin-bottom: 0; }
  .lc-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 20px; flex-wrap: wrap; margin-bottom: 14px;
    padding-bottom: 12px; border-bottom: 1px solid var(--border);
  }
  .lc-title { font-family: var(--heading); font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
  .lc-cost { font-family: var(--heading); font-size: 17px; font-weight: 700; color: var(--accent-text); white-space: nowrap; }
  .lc-said {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
    padding: 11px 14px; margin: 0 0 12px; font-size: 14px;
  }
  .lc-said::before {
    content: "In your words"; display: block; font-family: var(--heading);
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: var(--ink-muted); margin-bottom: 4px;
  }
  .lc-fix { background: var(--accent-tint); border-radius: 6px; padding: 12px 15px; margin: 12px 0 0; font-size: 14px; }
  .lc-fix strong { color: var(--accent-text); }

  /* Total band — kept for the basis section, no longer the headline. */
  .total-band { border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--accent-tint); padding: 24px 28px; margin: 0 0 18px; }
  .tb-k { font-family: var(--heading); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-muted); margin-bottom: 8px; }
  .tb-v { font-family: var(--heading); font-size: 38px; font-weight: 700; letter-spacing: -.025em; line-height: 1.05; color: var(--accent-text); }
  .tb-a { margin-top: 8px; font-size: 13px; color: var(--ink-muted); }

  /* ── Build Plan ────────────────────────────────────────────────────────── */
  /* Journey groups: the 14 workflows become 5 named moments. Flat, they were 14
     near-identical ~90-word blocks in one grid — the section the client cares
     most about, reading as a wall. */
  .wf-stage { margin: 0 0 30px; }
  .wf-stage:last-child { margin-bottom: 0; }
  .wf-stage-h {
    display: grid; grid-template-columns: 30px minmax(0,1fr); gap: 13px;
    align-items: baseline; margin: 0 0 6px;
  }
  .wf-stage-n {
    font-family: var(--heading); font-size: 12px; font-weight: 700;
    color: var(--accent-text); background: var(--accent-tint);
    border-radius: 6px; padding: 5px 0; text-align: center;
  }
  .wf-stage-t { font-family: var(--heading); font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
  .wf-stage-d { grid-column: 2; font-size: 13.5px; color: var(--ink-muted); margin: 0 0 14px; }

  .wf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .wf-card {
    border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
    padding: 18px 20px; display: flex; flex-direction: column;
  }
  .wf-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .wf-name { font-family: var(--heading); font-size: 16px; font-weight: 700; letter-spacing: -.01em; }

  /* Channel chips — instant scanability across 14 cards. */
  .wf-ch { display: inline-flex; gap: 5px; flex: none; }
  .chan {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
    padding: 3px 8px; border-radius: 99px; border: 1px solid var(--border);
    background: var(--surface-2); color: var(--ink-muted); white-space: nowrap;
  }
  .chan.is-text  { color: var(--accent-text); background: var(--accent-tint); }
  .chan.is-email { color: var(--ink-muted); }
  .chan.is-alert { color: var(--warn-text); border-color: var(--warn); }
  .chan.is-public{ color: var(--good-text); border-color: var(--good); }

  /* Trigger line — the one line that answers "when does this happen". The
     composer already writes it for the Asset Pack; it belongs here, in the
     document the client actually reads. Mono because it is a condition, not prose. */
  .wf-fires {
    font-family: var(--mono); font-size: 11.5px; line-height: 1.45;
    color: var(--ink-muted); background: var(--surface-2);
    border-radius: 5px; padding: 7px 10px; margin: 0 0 11px;
  }
  .wf-fires b { color: var(--ink); font-weight: 600; }

  .wf-card p { font-size: 13.5px; margin: 0 0 10px; }
  /* The auto top margin pins these to the bottom of the flex card, so a row of
     cards with uneven copy still lines its closing statements up. */
  .wf-sees { margin: auto 0 0; padding: 11px 13px; border-radius: 6px; background: var(--surface-2); font-size: 13px; }
  .wf-sees strong { color: var(--accent-text); }
  .wf-card.is-pending { border-left: 3px solid var(--warn); border-radius: 0 6px 6px 0; }
  .wf-why { margin: auto 0 0; padding: 11px 13px; background: var(--surface-2); border-left: 3px solid var(--warn); border-radius: 0 6px 6px 0; font-size: 13px; }
  .wf-why strong { color: var(--warn-text); }

  .sub-h {
    font-family: var(--heading); font-size: 13px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .12em; color: var(--accent-text);
    margin: 26px 0 10px; display: flex; align-items: center; gap: 10px;
  }
  .sub-h::after { content: ""; flex: 1; height: 1px; background: var(--border); }
  .sub-h:first-child { margin-top: 0; }

  /* Lead-flow strip — the one visual that explains the purchase. */
  .flow { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 0; margin: 4px 0 26px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .flow-node { padding: 16px 14px; background: var(--surface); border-right: 1px solid var(--border); }
  .flow-node:last-child { border-right: none; }
  .flow-node.is-live { background: var(--accent-tint); }
  .flow-n { font-family: var(--heading); font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 6px; }
  .flow-t { font-family: var(--heading); font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 7px; line-height: 1.25; }
  .flow-wf { list-style: none; margin: 0; padding: 0; }
  .flow-wf li { font-size: 11.5px; line-height: 1.4; color: var(--ink-muted); padding-left: 10px; position: relative; margin-bottom: 3px; }
  .flow-wf li::before { content: ""; position: absolute; left: 0; top: 7px; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }

  /* Schedule */
  .schedule { display: grid; gap: 0; }
  .sched-row { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 22px; padding: 20px 0; border-bottom: 1px solid var(--border); }
  .sched-row:first-child { padding-top: 0; }
  .sched-row:last-child { border-bottom: none; padding-bottom: 0; }
  .sr-when { font-family: var(--heading); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--accent-text); padding-top: 3px; }
  .sr-title { font-family: var(--heading); font-size: 17px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 6px; }
  .sr-main p { font-size: 13.5px; margin: 0; }
  .sched-note { display: flex; gap: 12px; background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--warn); border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 0 0 20px; font-size: 13.5px; }
  .sched-note strong { color: var(--warn-text); }

  /* ── Asset destinations (D3: where each piece of copy actually goes) ────── */
  .dest { margin: 6px 0 10px; padding: 8px 12px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.45; color: var(--ink); }
  .dest .dest-k { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--accent-text); margin-bottom: 2px; }

  /* ── Engagement spine (D4: the two windows and what each one costs) ─────── */
  .spine { display: grid; gap: 0; margin: 6px 0 4px; }
  .spine-band { display: grid; grid-template-columns: 108px minmax(0, 1fr) 176px; gap: 22px; align-items: start; border: 1px solid var(--border); border-radius: 6px; padding: 22px 24px; background: var(--surface); }
  .spine-band.is-run { border-color: var(--accent); background: var(--accent-tint); }
  /* The build window is the one being paid for now, the run window is the one
     that continues — only the second gets the tint, so the two read as
     different commitments rather than as a repeated card. */
  .spine-band.is-build { border-color: var(--border); background: var(--surface); }
  .spine-band .sb-main { min-width: 0; }
  .spine-band .sb-when, .spine-band .sb-amount { color: var(--accent-text); }
  .spine-band .sb-when { font-family: var(--heading); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; padding-top: 4px; }
  .spine-band .sb-title { font-family: var(--heading); font-size: 19px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 6px; }
  .spine-band p { font-size: 13.5px; margin: 0; }
  .spine-band .sb-price { text-align: right; border-left: 1px solid var(--border); padding-left: 20px; }
  .spine-band .sb-amount { font-family: var(--heading); font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
  .spine-band .sb-note { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-muted); margin-top: 4px; }
  .spine-golive { display: flex; align-items: flex-start; gap: 12px; margin: 0; padding: 14px 24px; font-size: 13.5px; color: var(--ink); border-left: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--surface-2); }
  .spine-golive .sg-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--good); margin-top: 6px; }

  /* ── Plain-language clarification markers (Law 14) ──────────────────────── */
  .lg-info { display: inline; position: relative; }
  .lg-info > summary { display: inline; list-style: none; cursor: pointer; color: var(--accent); font-weight: 700; font-size: .72em; vertical-align: super; line-height: 0; margin-left: 1px; }
  .lg-info > summary::-webkit-details-marker { display: none; }
  .lg-info[open] > summary { color: var(--ink-muted); }
  .lg-pop { display: block; margin: 6px 0; padding: 10px 13px; background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; font-size: 13px; line-height: 1.5; color: var(--ink); font-weight: 400; }
  .lg-pop strong { color: var(--accent-text); }

  /* ── Glossary block ────────────────────────────────────────────────────── */
  .glossary .gl { margin: 16px 0 0; display: grid; gap: 0; }
  .gl-item { padding: 12px 0; border-bottom: 1px solid var(--border); display: grid; grid-template-columns: 180px 1fr; gap: 18px; }
  .gl-item:last-child { border-bottom: none; }
  .gl-item dt { font-family: var(--heading); font-weight: 700; font-size: 14px; color: var(--accent-text); }
  .gl-item dd { margin: 0; font-size: 14px; color: var(--ink); }

  /* ── Presentation mode (no animation) ───────────────────────────────────── */
  body.present .layout { grid-template-columns: minmax(0, 1fr); max-width: 920px; }
  body.present .rail { display: none; }
  body.present .sec { padding: 44px 50px; margin-bottom: 26px; }
  body.present .sec h2 { font-size: 28px; }
  body.present header.doc h1 { font-size: 44px; }

  /* ── Footer ────────────────────────────────────────────────────────────── */
  footer.doc { display: flex; justify-content: space-between; align-items: center; gap: 16px; color: var(--ink-muted); font-size: 12px; margin-top: 42px; padding-top: 20px; border-top: 1px solid var(--border); flex-wrap: wrap; }
  footer.doc .conf { text-transform: uppercase; letter-spacing: .1em; font-size: 10px; font-weight: 600; }
  /* Print-only running footer. A fixed element repeats on every printed sheet,
     which is what makes page 3 of a loose Build Plan identifiable at all. The
     business name is the part that must never be missing, so it rides the
     element rather than the @page margin box below, which carries the number. */
  .print-foot { display: none; }

  @media (max-width: 940px) {
    .layout, .layout.solo { grid-template-columns: 1fr; gap: 0; padding: 26px 18px 64px; max-width: 720px; }
    .rail { display: none; }
    .cmdbar .cb-meta, .cmdbar .cb-sep, .cmdbar .cb-idx { display: none; }
    .cmd-btn .cb-btxt { display: none; }
    .cmd-btn { padding: 0 9px; }
    .gl-item { grid-template-columns: 1fr; gap: 2px; }
    /* The spine stacks: the price stops being a right-hand column and becomes a
       line under the description, still attached to its own window. */
    .spine-band { grid-template-columns: 1fr; gap: 12px; }
    .spine-band .sb-price { text-align: left; border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 12px; }
    .wf-grid, .flow { grid-template-columns: 1fr; grid-auto-flow: row; }
    .flow-node { border-right: none; border-bottom: 1px solid var(--border); }
    .flow-node:last-child { border-bottom: none; }
    .headline { grid-template-columns: 1fr; gap: 20px; }
    .hl-inputs { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 18px; grid-template-columns: 1fr 1fr; }
    .hl-amount { font-size: 34px; }
    .rank-row { grid-template-columns: 20px minmax(0,1fr); }
    .rank-bar { display: none; }
    .rank-cost { grid-column: 2; text-align: left; }
    .sched-row { grid-template-columns: 1fr; gap: 8px; }
    .msg-table th:first-child { width: auto; }
    .msg-table, .msg-table tbody, .msg-table tr, .msg-table td { display: block; width: 100%; }
    .msg-table thead { display: none; }
    .msg-table tr { border-bottom: 1px solid var(--border); padding: 14px 0; }
    .msg-table td { border: none; padding: 0 0 8px; }
    .tb-v { font-size: 30px; }
    header.doc { padding: 32px 24px; }
    header.doc h1 { font-size: 28px; }
    .cover-meta { flex-direction: column; gap: 12px; }
    .cover-meta .cm { width: 100%; border-right: none; padding-right: 0; margin-right: 0; }
    .sec { padding: 24px 20px; }
  }

  @media print {
    @page {
      margin: 16mm 14mm 18mm;
      /* The page NUMBER can only come from a counter, and a counter can only be
         read inside a margin box. Engines that implement them (Prince, Paged.js
         — the PDF paths) draw it here; Chrome parses the box, ignores it, and
         prints its own page footer, so the number is never actually missing. */
      @bottom-right { content: counter(page); font-family: 'Inter', sans-serif; font-size: 9px; }
    }
    html, body { background: #fff; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rail, .cmdbar { display: none; }
    .layout, .layout.solo { display: block; padding: 0; max-width: none; }
    header.doc { break-after: page; }
    .sec, .card, .leak-card, .wf-card, .sched-row, .total-band, .headline,
    .wf-stage, .flow, .msg-table tr, .spine-band { break-inside: avoid; }
    /* A stage heading or a section heading stranded at the foot of a page is
       worse than a short page — never break directly after either. */
    .wf-stage-h { break-after: avoid; }
    .sec-head { break-after: avoid; }
    /* Colour-carrying markers keep their colour on paper. Each of these says
       something the black-and-white version would silently lose: the money
       band, the pending build, the caveat, the key section. */
    .total-band, .leak-card, .wf-card.is-pending, .sched-note,
    .sec--key, .chan, .flow-node.is-live, .spine-band, .dest {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    /* Inline markers hidden in print — the glossary block is the backstop. */
    .lg-info { display: none; }
    .print-foot {
      display: block; position: fixed; bottom: 0; left: 0; right: 0;
      font-size: 9px; letter-spacing: .08em; text-transform: uppercase;
      color: var(--ink-muted); border-top: 1px solid var(--border);
      padding-top: 4px;
    }
  }
</style>
</head>
<body>
  ${cmdBar}
  ${testBanner}
  <div class="layout${solo ? " solo" : ""}">${rail}
    <main class="main">
      <header class="doc">${testStamp}
        <div class="eyebrow">Conversion Intelligence</div>
        <h1>${esc(docTitle)}</h1>
        ${opts.subtitle ? `<p class="subtitle">${esc(opts.subtitle)}</p>` : ""}
        <div class="cover-meta">
          <div class="cm"><div class="k">Prepared for</div><div class="v">${esc(
            meta.businessName
          )}</div></div>
          ${
            meta.city || meta.industry
              ? `<div class="cm"><div class="k">Market</div><div class="v">${esc(
                  [meta.city, meta.industry].filter(Boolean).join(" \u00B7 ")
                )}</div></div>`
              : ""
          }
          <div class="cm"><div class="k">Date</div><div class="v">${esc(prettyDate)}</div></div>
        </div>
      </header>
      ${assumptions}
      ${annotatedBody}
      ${glossary}
      <footer class="doc">
        <span>${esc(meta.businessName)} \u00B7 ${esc(prettyDate)}</span>
        <span class="conf">Confidential \u2014 prepared for ${esc(meta.businessName)}${agencyLine}</span>
      </footer>
    </main>
  </div>
  <div class="print-foot">${esc(meta.businessName)} \u00B7 ${esc(docTitle)}</div>
  <script>
    (function () {
      var doc = document;

      // ── Present mode (instant, no animation) ────────────────────────────
      var presentBtn = doc.querySelector("[data-present]");
      if (presentBtn) {
        presentBtn.addEventListener("click", function () {
          var on = doc.body.classList.toggle("present");
          presentBtn.classList.toggle("is-on", on);
          presentBtn.setAttribute("aria-pressed", String(on));
        });
      }
      var printBtn = doc.querySelector("[data-print]");
      if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
      doc.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && doc.body.classList.contains("present") && presentBtn) presentBtn.click();
      });
    })();
  </script>
</body>
</html>`;
}

export function renderTechnicalUx(tux: TechnicalUxSection | undefined): string {
  if (!tux) return "";
  if (!tux.available) {
    return `<div class="strategy-block">${esc(
      tux.businessImpactSummary ||
        "Live page-speed data was unavailable for this run. Treat any technical UX commentary as a strategic assumption to verify post-engagement."
    )}</div>`;
  }
  const metricCell = (k: string, v: string | number | null | undefined) =>
    v == null || v === ""
      ? `<div class="metric"><div class="v muted">\u2014</div><div class="k">${esc(k)}</div></div>`
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

  // Site speed / redesign is out of scope for a conversion engagement (Part B):
  // we keep the MEASURED numbers as context but never ship fix recommendations
  // (reduce CSS, optimize images, redesign). One closing line flags it and moves on.
  return `${grid("Mobile (measured)", tux.mobile)}${grid(
    "Desktop (measured)",
    tux.desktop
  )}<div class="strategy-block">${esc(OUT_OF_SCOPE_PERFORMANCE_LINE)}</div>`;
}

export function renderVisuals(viz: VisualIntelligence | undefined): string {
  if (!viz || !viz.available || !viz.shots?.length) return "";
  // Independent credential gate. Screenshots SHOULD already be our own stored
  // copies (screenshot-store.ts materializes them at generation), but this is the
  // last boundary before bytes become client-facing HTML, so it refuses to emit
  // any <img> whose src still carries a ScreenshotOne credential \u2014 even if a
  // future change forgets to materialize. A dropped image is a cosmetic loss; a
  // leaked access key is a rotated secret.
  const safeShots = viz.shots.filter((s) => !carriesScreenshotCredential(s.imageUrl));
  if (!safeShots.length) return "";
  const groups = new Map<string, { desktop?: typeof viz.shots[number]; mobile?: typeof viz.shots[number] }>();
  for (const s of safeShots) {
    const base = s.label.replace(/\s+\u2014\s+(desktop|mobile)$/i, "").trim();
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
      return `<div class="label">${esc(name)}</div><div class="shots-row">${cells.join("")}</div>`;
    })
    .join("");
  return `${viz.competitiveRead ? `<div class="strategy-block">${esc(viz.competitiveRead)}</div>` : ""}${blocks}`;
}

export function renderFramingOverview(framing: DeliverableFraming | undefined): string {
  if (!framing?.overview) return "";
  return `<div class="strategy-block">${para(framing.overview)}</div>`;
}

export function renderFramingClose(framing: DeliverableFraming | undefined): string {
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

/** One email asset. `whereHtml` is the caller's already-rendered "Where this goes"
 *  line — an asset a client is meant to act on has to say which automation sends
 *  it, and that belongs directly under the label, above the subject. Optional so
 *  callers with nothing useful to say about the destination stay unchanged rather
 *  than being forced to invent one. */
export function emailBlock(
  label: string,
  e: { subject: string; body: string },
  whereHtml = ""
): string {
  if (!e?.subject && !e?.body) return "";
  return `<div class="email">${
    label ? `<div class="label">${esc(label)}</div>` : ""
  }${whereHtml}<div class="subj">${esc(e.subject)}</div>${para(e.body)}</div>`;
}
