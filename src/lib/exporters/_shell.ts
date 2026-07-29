// Shared HTML deliverable primitives: the document shell, CSS design system,
// and the small render helpers used by BOTH the legacy per-file renderers
// (html.ts) and the V2 flagship deliverable composer (deliverables.ts).
//
// Everything is inlined (fonts excepted) — the produced HTML works standalone
// when downloaded. The design language (v3) is a RESTRAINED, light, consulting-
// grade report: serif headings + Inter body, flat fills (zero gradients), a
// single muted-gold accent, hairline borders, and one subtle shadow at most.
// A print-safe plain-language clarification layer (info markers + glossary)
// explains genuine jargon for non-technical owners (Law 14).

import type {
  AssetPackMeta,
  TechnicalUxSection,
  VisualIntelligence,
  DeliverableFraming,
} from "@/types";
import { AGENCY_NAME } from "../brand";

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

export function list(items: string[] | undefined, ordered = false): string {
  if (!items?.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
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
export function buildToc(body: string): string {
  const re = /<section class="sec" id="(sec-[^"]+)">[\s\S]*?<h2>([^<]+)<\/h2>/g;
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
  // Optional sticky "Key Actions" panel rendered in the left rail. Each group is
  // a small titled cluster (e.g. "Fix now", "Quick wins").
  keyActions?: { title: string; tone?: "urgent" | "win" | "threat" | "neutral"; items: string[] }[];
}

export function shell(
  meta: AssetPackMeta,
  docTitle: string,
  body: string,
  opts: ShellOptions = {}
): string {
  const confidence = meta.dataConfidence.toUpperCase();
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

  // Sticky top command bar — brand, live business context, confidence, and the
  // workspace controls (present mode + print). Print/present are inert-safe.
  const cmdBar = `<div class="cmdbar">
    <span class="cb-brand"><span class="dot"></span>ReclaimedHQ</span>
    ${opts.docIndex ? `<span class="cb-idx">${esc(opts.docIndex)}</span>` : ""}
    <div class="cb-center">
      <span class="cb-biz">${esc(meta.businessName)}</span>
      ${marketLine ? `<span class="cb-sep">\u00B7</span><span class="cb-meta">${esc(marketLine)}</span>` : ""}
      <span class="cb-conf"><span class="cdot"></span>${esc(confidence)} confidence</span>
    </div>
    <div class="cb-right">
      <button class="cmd-btn" type="button" data-present aria-pressed="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        <span class="cb-btxt">Present</span>
      </button>
      <button class="cmd-btn" type="button" data-print>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
        <span class="cb-btxt">Print / PDF</span>
      </button>
    </div>
  </div>`;

  const keyActionsPanel =
    !solo && opts.keyActions?.length
      ? `<div class="keyactions"><div class="ka-h">Key actions</div>${opts.keyActions
          .filter((g) => g.items?.length)
          .map(
            (g) =>
              `<div class="ka-group ${g.tone ?? "neutral"}"><div class="ka-t">${esc(
                g.title
              )}</div><ul>${g.items
                .slice(0, 4)
                .map((i) => `<li>${esc(i)}</li>`)
                .join("")}</ul></div>`
          )
          .join("")}</div>`
      : "";

  const rail = solo ? "" : `<aside class="rail">${toc}${keyActionsPanel}</aside>`;

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

  return `<!DOCTYPE html>
<html lang="en">
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
    --shadow: 0 1px 2px rgba(26,24,20,.05);
  }
  * { box-sizing: border-box; }
  /* Law 9: no motion. Anchor offset only — no smooth-scroll animation. */
  html { scroll-padding-top: 78px; }
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
  .cmdbar .cb-conf { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--good); background: var(--surface-2); border: 1px solid var(--border); padding: 4px 10px; border-radius: 99px; }
  .cmdbar .cb-conf .cdot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); }
  .cmdbar .cb-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .cmd-btn { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--border); cursor: pointer; white-space: nowrap; }
  .cmd-btn:hover { border-color: var(--accent); color: var(--accent); }
  .cmd-btn svg { width: 14px; height: 14px; }
  .cmd-btn.is-on { color: var(--accent); border-color: var(--accent); background: var(--accent-tint); }

  /* ── Contents rail ─────────────────────────────────────────────────────── */
  .rail { position: sticky; top: 78px; align-self: start; max-height: calc(100vh - 98px); overflow-y: auto; padding: 2px 2px 8px; display: flex; flex-direction: column; gap: 18px; scrollbar-width: thin; }
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
  .toc a.is-active { background: var(--accent-tint); color: var(--ink); border-left-color: var(--accent); }
  .toc-n { font-family: var(--heading); font-size: 11px; font-weight: 700; color: var(--accent); }
  .toc-t { font-weight: 500; }
  .main { min-width: 0; }

  /* ── Key actions panel (rail) ──────────────────────────────────────────── */
  .keyactions { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 16px 16px 6px; }
  .keyactions .ka-h { font-family: var(--heading); font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; font-weight: 700; color: var(--ink-muted); margin-bottom: 12px; }
  .ka-group { margin-bottom: 14px; }
  .ka-group .ka-t { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px; color: var(--accent); }
  .ka-group.urgent .ka-t { color: var(--warn); } .ka-group.threat .ka-t { color: var(--critical); } .ka-group.win .ka-t { color: var(--good); }
  .ka-group ul { list-style: none; margin: 0; padding: 0; }
  .ka-group li { position: relative; padding: 5px 0 5px 16px; font-size: 12px; line-height: 1.4; color: var(--ink); border-bottom: 1px solid var(--border); }
  .ka-group li:last-child { border-bottom: none; }
  .ka-group li::before { content: ""; position: absolute; left: 0; top: 11px; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
  .ka-group.urgent li::before { background: var(--warn); }
  .ka-group.threat li::before { background: var(--critical); }
  .ka-group.win li::before { background: var(--good); }

  /* ── Cover header ──────────────────────────────────────────────────────── */
  header.doc {
    position: relative; background: var(--surface); color: var(--ink);
    border: 1px solid var(--border); border-top: 3px solid var(--accent);
    border-radius: 4px; padding: 44px 46px 36px; margin-bottom: 30px;
  }
  .doc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-muted); font-weight: 600; }
  header.doc .eyebrow { font-family: var(--heading); text-transform: uppercase; letter-spacing: .26em; font-size: 11px; color: var(--accent); margin-bottom: 16px; font-weight: 700; }
  header.doc h1 { margin: 0 0 14px; font-size: 38px; line-height: 1.1; letter-spacing: -.015em; font-weight: 700; max-width: 20ch; color: var(--ink); }
  header.doc .subtitle { font-size: 16px; line-height: 1.55; color: var(--ink-muted); max-width: 60ch; margin: 0 0 28px; }
  .cover-meta { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid var(--border); padding-top: 20px; }
  .cover-meta .cm { padding-right: 32px; margin-right: 32px; border-right: 1px solid var(--border); }
  .cover-meta .cm:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .cover-meta .cm .k { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-muted); margin-bottom: 5px; font-weight: 600; }
  .cover-meta .cm .v { font-size: 15px; font-weight: 600; color: var(--ink); }
  .cover-meta .cm .v.chip { display: inline-block; background: var(--accent-tint); border: 1px solid var(--border); color: var(--accent); padding: 3px 11px; border-radius: 99px; font-size: 11.5px; }

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
  .sec-num { font-family: var(--heading); font-size: 13px; font-weight: 700; color: var(--accent); background: var(--accent-tint); padding: 5px 11px; border-radius: 6px; line-height: 1; flex: none; }
  h2 { font-size: 24px; margin: 0; letter-spacing: -.015em; font-weight: 700; line-height: 1.2; max-width: 36ch; }
  h3 { font-size: 15.5px; margin: 24px 0 9px; color: var(--ink); letter-spacing: -.01em; }
  p { margin: 0 0 13px; color: var(--ink); max-width: 70ch; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 13px; padding-left: 22px; color: var(--ink); max-width: 70ch; }
  li { margin: 0 0 7px; }
  li::marker { color: var(--accent); }
  strong { color: var(--ink); font-weight: 600; }
  .muted { color: var(--ink-muted); }
  .label { font-family: var(--heading); text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; color: var(--accent); margin: 26px 0 10px; display: flex; align-items: center; gap: 10px; }
  .label::after { content: ""; flex: 1; height: 1px; background: var(--border); }

  /* ── Tables ────────────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; margin: 10px 0 6px; font-size: 14px; }
  th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
  thead th { background: var(--surface-2); color: var(--ink); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: none; }
  .score { font-weight: 700; font-family: var(--heading); color: var(--accent); }

  /* ── Pills / chips ─────────────────────────────────────────────────────── */
  .pill { display: inline-block; padding: 3px 11px; border-radius: 99px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-muted); }
  .pill.crit { background: var(--surface-2); color: var(--critical); border-color: var(--critical); }
  .pill.high { color: var(--warn); border-color: var(--warn); }
  .pill.medium { color: var(--ink-muted); border-color: var(--border); }
  .pill.low { color: var(--good); border-color: var(--good); }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 99px; font-size: 11.5px; font-weight: 600; background: var(--accent-tint); color: var(--accent); border: 1px solid var(--border); }

  /* ── Generic cards / callouts ──────────────────────────────────────────── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; margin: 0 0 12px; }
  .hero-quote { background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; padding: 20px 24px; font-family: var(--heading); font-size: 22px; font-weight: 600; line-height: 1.3; margin: 0 0 16px; letter-spacing: -.01em; color: var(--ink); }
  .strategy-block { background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--accent); padding: 18px 20px; border-radius: 0 6px 6px 0; margin: 14px 0 18px; font-size: 15px; color: var(--ink); }
  .lead { font-size: 17px; line-height: 1.6; color: var(--ink); }

  /* Structured diagnostic / asset cards. */
  .diag-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; margin: 0 0 12px; }
  .diag-card .dt { font-family: var(--heading); font-size: 16px; font-weight: 700; color: var(--ink); margin: 0 0 4px; letter-spacing: -.01em; }
  .diag-card .dt .pill { vertical-align: middle; margin-left: 8px; }
  .diag-row { margin: 11px 0; }
  .diag-row .dk { text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 700; color: var(--ink-muted); margin-bottom: 3px; }
  .diag-row p { margin: 0; font-size: 14px; color: var(--ink); }
  .diag-row.fix { background: var(--accent-tint); border-radius: 6px; padding: 11px 14px; margin-top: 12px; }
  .diag-row.fix .dk { color: var(--accent); }
  .struct-num { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--accent-tint); color: var(--accent); font-size: 11.5px; font-weight: 700; margin-right: 9px; }
  .opt-list { list-style: none; padding: 0; margin: 0 0 6px; counter-reset: opt; }
  .opt-list li { counter-increment: opt; position: relative; padding: 11px 15px 11px 40px; margin: 0 0 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 15px; color: var(--ink); }
  .opt-list li::before { content: counter(opt); position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 5px; background: var(--accent-tint); color: var(--accent); font-size: 10.5px; font-weight: 700; display: grid; place-items: center; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
  .ba > div { padding: 18px 20px; font-size: 14px; }
  .ba .before { background: var(--surface-2); border-right: 1px solid var(--border); }
  .ba .after { background: var(--surface); }
  .ba .t { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; margin-bottom: 7px; }
  .ba .before .t { color: var(--critical); }
  .ba .after .t { color: var(--good); }
  .email { border: 1px solid var(--border); border-radius: 6px; padding: 20px 22px; margin-bottom: 12px; background: var(--surface); position: relative; }
  .email::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 3px; background: var(--accent); }
  .email .subj { font-weight: 700; margin-bottom: 6px; font-size: 15.5px; color: var(--ink); }

  /* ── Screenshots ───────────────────────────────────────────────────────── */
  .shots-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; margin-bottom: 16px; }
  .shot { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--surface-2); }
  .shot img { display: block; width: 100%; height: auto; }
  .shot .cap { background: var(--surface-2); color: var(--ink-muted); padding: 10px 14px; font-size: 12px; font-weight: 500; border-top: 1px solid var(--border); }

  /* ── Metric tiles ──────────────────────────────────────────────────────── */
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 8px 0 16px; }
  .metric { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px 18px; }
  .metric .v { font-family: var(--heading); font-size: 26px; font-weight: 700; letter-spacing: -.02em; color: var(--accent); }
  .metric .v.muted { color: var(--ink-muted); }
  .metric .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-muted); margin-top: 3px; font-weight: 600; }

  /* ── Executive summary grid ────────────────────────────────────────────── */
  .exec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0 6px; }
  .exec-card { border: 1px solid var(--border); border-radius: 6px; padding: 20px 22px; background: var(--surface); position: relative; overflow: hidden; }
  .exec-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
  .exec-card.threat::before { background: var(--critical); }
  .exec-card.urgent::before { background: var(--warn); }
  .exec-card.win::before { background: var(--good); }
  .exec-card .h { display: flex; align-items: center; gap: 9px; font-family: var(--heading); font-size: 12px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
  .exec-card .h .dotc { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .exec-card.threat .h .dotc { background: var(--critical); }
  .exec-card.urgent .h .dotc { background: var(--warn); }
  .exec-card.win .h .dotc { background: var(--good); }
  .exec-card ul { margin: 0; padding-left: 18px; font-size: 14px; }

  /* ── Score hero + scorecard (flat: number in accent + thin semantic bar) ── */
  .grade-strong { --sem: var(--good); }
  .grade-mid { --sem: var(--warn); }
  .grade-weak { --sem: var(--critical); }
  .score-hero { display: grid; grid-template-columns: 104px 1fr; gap: 26px; align-items: center; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 24px 28px; margin: 6px 0 22px; }
  .ring { position: relative; width: 104px; height: 104px; border-radius: 8px; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--border); }
  .ring .rv { font-family: var(--heading); font-weight: 700; font-size: 36px; letter-spacing: -.03em; color: var(--sem, var(--accent)); line-height: 1; }
  .ring .rl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-muted); margin-top: 3px; font-weight: 600; }
  .ring::before { content: ""; position: absolute; left: 12px; right: 12px; bottom: 10px; height: 3px; border-radius: 2px; background: var(--border); }
  .ring::after { content: ""; position: absolute; left: 12px; bottom: 10px; height: 3px; border-radius: 2px; background: var(--sem, var(--accent)); width: calc((100% - 24px) * var(--ring, 0) / 100); }
  .score-hero .sh-grade { font-family: var(--heading); font-size: 21px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 6px; }
  .scorecard { display: grid; gap: 12px; margin: 8px 0 6px; }
  .score-row { border: 1px solid var(--border); border-radius: 6px; padding: 20px 22px; background: var(--surface); display: grid; grid-template-columns: 64px 1fr; gap: 20px; align-items: start; }
  .score-dial { position: relative; width: 64px; height: 64px; border-radius: 8px; display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border); }
  .score-dial span { font-family: var(--heading); font-weight: 700; font-size: 22px; color: var(--sem, var(--accent)); }
  .score-dial::before { content: ""; position: absolute; left: 8px; right: 8px; bottom: 7px; height: 3px; border-radius: 2px; background: var(--border); }
  .score-dial::after { content: ""; position: absolute; left: 8px; bottom: 7px; height: 3px; border-radius: 2px; background: var(--sem, var(--accent)); width: calc((100% - 16px) * var(--dial, 0) / 100); }
  .score-body .name { font-family: var(--heading); font-weight: 700; font-size: 16px; margin-bottom: 5px; letter-spacing: -.01em; }
  .score-body .name .pct { color: var(--ink-muted); font-weight: 600; font-size: 13px; font-family: 'Inter', sans-serif; }
  .score-body .diag { font-size: 14px; margin-bottom: 12px; color: var(--ink); }
  .score-kv { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; font-size: 13px; padding-top: 12px; border-top: 1px solid var(--border); }
  .score-kv .k { text-transform: uppercase; letter-spacing: .08em; font-size: 9.5px; font-weight: 700; color: var(--ink-muted); margin-bottom: 3px; }

  /* ── Leak analysis ─────────────────────────────────────────────────────── */
  .leak { border: 1px solid var(--border); border-radius: 6px; padding: 0; margin-bottom: 14px; background: var(--surface); overflow: hidden; display: grid; grid-template-columns: 4px 1fr; }
  .leak .rail { background: var(--accent); }
  .leak.crit .rail { background: var(--critical); }
  .leak.high .rail { background: var(--warn); }
  .leak.medium .rail { background: var(--ink-muted); }
  .leak.low .rail { background: var(--good); }
  .leak .lk-body { padding: 20px 24px; }
  .leak .lh { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
  .leak .lt { font-family: var(--heading); font-weight: 700; font-size: 17px; letter-spacing: -.01em; }
  .leak .badges { display: flex; gap: 7px; flex-shrink: 0; flex-wrap: wrap; }
  .leak .kv { margin: 11px 0; }
  .leak .kv .k { text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 700; color: var(--ink-muted); margin-bottom: 3px; }
  .leak .kv p { margin: 0; font-size: 14px; }
  .leak .fix { background: var(--accent-tint); border-radius: 6px; padding: 12px 15px; margin-top: 12px; }
  .leak .fix .k { color: var(--accent); }

  /* ── Funnel ────────────────────────────────────────────────────────────── */
  .funnel { display: grid; gap: 0; margin: 10px 0; }
  .funnel-row { display: grid; grid-template-columns: 48px 1fr; gap: 18px; position: relative; padding-bottom: 16px; }
  .funnel-row::before { content: ""; position: absolute; left: 23px; top: 44px; bottom: -2px; width: 1px; background: var(--border); }
  .funnel-row:last-child { padding-bottom: 0; }
  .funnel-row:last-child::before { display: none; }
  .fn-node { width: 48px; height: 48px; border-radius: 8px; display: grid; place-items: center; font-family: var(--heading); font-weight: 700; font-size: 17px; color: var(--accent); background: var(--accent-tint); border: 1px solid var(--border); position: relative; z-index: 1; }
  .fn-card { border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; background: var(--surface); }
  .fn-card .st { font-family: var(--heading); font-weight: 700; font-size: 16.5px; margin: 0 0 10px; letter-spacing: -.01em; }
  .fn-card p { font-size: 13.5px; margin: 0 0 7px; }
  .fn-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }

  /* ── Tiers ─────────────────────────────────────────────────────────────── */
  .tiers { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 10px 0; }
  .tier { border: 1px solid var(--border); border-radius: 6px; padding: 20px 22px; background: var(--surface); position: relative; overflow: hidden; }
  .tier::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }
  .tier:nth-child(1)::before { background: var(--good); }
  .tier:nth-child(2)::before { background: var(--ink-muted); }
  .tier:nth-child(3)::before { background: var(--warn); }
  .tier .tn { font-family: var(--heading); font-size: 11.5px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; color: var(--ink-muted); margin-bottom: 6px; }
  .tier .rng { font-family: var(--heading); font-size: 28px; font-weight: 700; letter-spacing: -.03em; margin-bottom: 8px; color: var(--accent); }
  .tier p { font-size: 13.5px; }

  /* ── Timeline / roadmap ────────────────────────────────────────────────── */
  .timeline { display: grid; gap: 0; margin: 12px 0; }
  .phase-row { display: grid; grid-template-columns: 56px 1fr; gap: 22px; position: relative; padding-bottom: 26px; }
  .phase-row::before { content: ""; position: absolute; left: 27px; top: 52px; bottom: -4px; width: 1px; background: var(--border); }
  .phase-row:last-child { padding-bottom: 0; }
  .phase-row:last-child::before { display: none; }
  .phase-node { width: 56px; height: 56px; border-radius: 8px; display: grid; place-items: center; font-family: var(--heading); font-weight: 700; font-size: 22px; color: var(--accent); background: var(--accent-tint); border: 1px solid var(--border); position: relative; z-index: 1; }
  .phase-card { border: 1px solid var(--border); border-radius: 6px; padding: 24px 26px; background: var(--surface); }
  .phase-card .ph-h { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
  .phase-card .ph-n { font-family: var(--heading); font-weight: 700; font-size: 20px; letter-spacing: -.01em; }
  .phase-card .ph-w { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); background: var(--accent-tint); border: 1px solid var(--border); padding: 4px 12px; border-radius: 99px; }
  .phase-card .ph-obj { font-size: 15px; color: var(--ink); margin-bottom: 6px; }
  .phase-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 28px; }

  /* ── Checklist ─────────────────────────────────────────────────────────── */
  .checklist { list-style: none; padding: 0; margin: 8px 0; }
  .checklist li { position: relative; padding: 8px 0 8px 28px; font-size: 14px; border-bottom: 1px solid var(--border); color: var(--ink); }
  .checklist li:last-child { border-bottom: none; }
  .checklist li::before { content: ""; position: absolute; left: 0; top: 11px; width: 15px; height: 15px; border: 1.5px solid var(--accent); border-radius: 4px; background: var(--accent-tint); }
  .checklist li::after { content: "\u2713"; position: absolute; left: 3px; top: 8px; font-size: 11px; font-weight: 800; color: var(--accent); }

  /* ── Asset cards (D3) ──────────────────────────────────────────────────── */
  .asset-frame { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .asset-frame .chip.where { background: var(--surface-2); color: var(--ink-muted); border-color: var(--border); }

  /* ── Leak filter bar ──────────────────────────────────────────────────── */
  .filterbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 18px; }
  .filterbar .fb-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-muted); margin-right: 4px; }
  .fchip { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--ink-muted); background: var(--surface); border: 1px solid var(--border); cursor: pointer; }
  .fchip:hover { color: var(--ink); border-color: var(--ink-muted); }
  .fchip .fc-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .fchip[data-f="crit"] { color: var(--critical); } .fchip[data-f="high"] { color: var(--warn); }
  .fchip[data-f="medium"] { color: var(--ink-muted); } .fchip[data-f="low"] { color: var(--good); }
  .fchip .fc-n { font-size: 10.5px; opacity: .7; font-weight: 700; }
  .fchip.is-on { background: var(--accent-tint); border-color: var(--accent); }
  .fchip[data-f="all"] { color: var(--ink); }
  .leak.is-hidden { display: none; }

  /* ── Leak card tabs ───────────────────────────────────────────────────── */
  .leak-tabs { display: inline-flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); margin: 4px 0 14px; }
  .leak-tab { appearance: none; border: none; background: none; font: inherit; cursor: pointer; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--ink-muted); }
  .leak-tab:hover { color: var(--ink); }
  .leak-tab.is-on { background: var(--surface); color: var(--ink); border: 1px solid var(--border); }
  .leak-pane[hidden] { display: none; }
  /* Scorecard-axis tag beside a leak title (Defect 2). */
  .lk-area { display: inline-block; margin-left: 10px; padding: 2px 9px; border-radius: 99px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-muted); background: var(--surface-2); border: 1px solid var(--border); vertical-align: middle; }
  /* Whitelisted industry stats + computed math (Defect 1). */
  .lk-stats { margin: 6px 0 0; padding-left: 18px; }
  .lk-stats li { margin: 3px 0; font-size: 13px; color: var(--ink); }
  .lk-math { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); font-size: 13px; color: var(--ink); }
  .lk-math-label { display: block; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted); margin-bottom: 4px; }
  /* Kickoff-verification line on BENCHMARK leaks (Defect 3). */
  .kickoff-line { margin: 8px 0 0; font-style: italic; color: var(--ink-muted); }

  /* ── Evidence-grade chips (Phase 1 · what this finding rests on) ───────── */
  /* The grade used to be visible only inside the closed Evidence tab. It now
     rides on the card header, so a reader skimming knows whether we measured a
     thing, were told it, or are quoting a pattern — before they read the claim.
     Colour follows the same three semantics as the rest of the report: measured
     is solid (good), told is the accent (their word), pattern is muted. */
  .ev-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-muted); white-space: nowrap; }
  .ev-chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .ev-chip.ev-observed { color: var(--good); }
  .ev-chip.ev-disclosed { color: var(--accent); background: var(--accent-tint); }
  .ev-chip.ev-inferred { color: var(--ink-muted); }
  .ev-chip.is-clean { color: var(--good); background: var(--surface-2); text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 11px; }
  .score-body .name .ev-chip { margin-left: 10px; vertical-align: middle; }
  /* A clean axis is a PASS, and it reads like one rather than like a ninth
     problem in a grid of problems. */
  .score-row.is-clean { border-color: var(--good); }

  /* ── Advisory band (work we are NOT delivering) ─────────────────────────── */
  /* Everything under it is a recommendation about a website we neither build nor
     host. Rendered by the composer, never by the model, so the scope promise
     cannot go missing on a generation that forgot to write it. */
  .advisory-band { display: flex; gap: 14px; align-items: flex-start; background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--warn); border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 0 0 20px; font-size: 13.5px; line-height: 1.55; color: var(--ink); }
  .advisory-band .ab-tag { flex: none; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--warn); border: 1px solid var(--warn); border-radius: 99px; padding: 3px 10px; margin-top: 2px; }

  /* ── Reconciliation + cap notes on the headline total ───────────────────── */
  /* Both say the itemized figures below will NOT add up to the number above, so
     they sit directly under the amount rather than under the working. */
  .dc-note { margin-top: 12px; padding: 11px 14px; border-radius: 6px; background: var(--surface); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.5; color: var(--ink); }
  .dc-note .dcn-k { display: block; font-family: 'Inter', sans-serif; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted); margin-bottom: 4px; }
  .dc-note.is-capped { border-left: 3px solid var(--warn); }
  .dc-note.is-capped .dcn-k { color: var(--warn); }
  .dc-note.is-checked { border-left: 3px solid var(--good); }
  .dc-note.is-checked .dcn-k { color: var(--good); }
  .dollar-callout.dc-total { border-left-width: 4px; }
  .dollar-callout.dc-total .dc-formula { margin-top: 12px; }

  /* ── Asset destinations (D3: where each piece of copy actually goes) ────── */
  .dest { margin: 6px 0 10px; padding: 8px 12px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); font-size: 12.5px; line-height: 1.45; color: var(--ink); }
  .dest .dest-k { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); margin-bottom: 2px; }

  /* ── Engagement spine (D4: the two windows and what each one costs) ─────── */
  .spine { display: grid; gap: 0; margin: 6px 0 4px; }
  .spine-band { display: grid; grid-template-columns: 108px minmax(0, 1fr) 176px; gap: 22px; align-items: start; border: 1px solid var(--border); border-radius: 6px; padding: 22px 24px; background: var(--surface); }
  .spine-band.is-run { border-color: var(--accent); background: var(--accent-tint); }
  .spine-band .sb-when { font-family: var(--heading); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); padding-top: 4px; }
  .spine-band .sb-title { font-family: var(--heading); font-size: 19px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 6px; }
  .spine-band p { font-size: 13.5px; margin: 0; }
  .spine-band .sb-price { text-align: right; border-left: 1px solid var(--border); padding-left: 20px; }
  .spine-band .sb-amount { font-family: var(--heading); font-size: 24px; font-weight: 700; letter-spacing: -.02em; color: var(--accent); line-height: 1.1; }
  .spine-band .sb-note { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-muted); margin-top: 4px; }
  .spine-golive { display: flex; align-items: flex-start; gap: 12px; margin: 0; padding: 14px 24px; font-size: 13.5px; color: var(--ink); border-left: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--surface-2); }
  .spine-golive .sg-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--good); margin-top: 6px; }

  /* ── Owner tags (done-for-you framing) ─────────────────────────────────── */
  .owner-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
  .owner-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .owner-tag.owner-us { color: var(--accent); background: var(--accent-tint); border: 1px solid var(--border); }
  .owner-tag.owner-you { color: var(--ink-muted); background: var(--surface-2); border: 1px solid var(--border); }
  .fix-owner { margin-top: 10px; }

  /* ── Retainer badge (the continuously-running engine) ──────────────────── */
  .retainer-badge { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; padding: 3px 10px; border-radius: 99px; font-family: 'Inter', sans-serif; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--accent); background: var(--accent-tint); border: 1px solid var(--border); vertical-align: middle; }
  .retainer-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .fn-card.is-retainer, .phase-card.is-retainer { border-color: var(--accent); background: var(--accent-tint); }

  /* ── Dollar-impact callout (every leak quantified, Law 5) ──────────────── */
  .dollar-callout { position: relative; margin: 16px 0; padding: 18px 20px; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; background: var(--accent-tint); }
  .dc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .dc-label { font-family: var(--heading); font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; font-weight: 700; color: var(--ink-muted); }
  .dc-amount { font-family: var(--heading); font-size: 27px; font-weight: 700; letter-spacing: -.02em; color: var(--accent); line-height: 1.05; }
  .dc-amount .per { font-size: 13px; font-weight: 600; color: var(--ink-muted); letter-spacing: 0; margin-left: 6px; }
  .dc-formula { margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; display: inline-block; }
  .dc-assume { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; }
  .dc-assume li { font-size: 12.5px; color: var(--ink); line-height: 1.45; }
  .dc-assume li span { display: inline-block; min-width: 112px; font-weight: 700; color: var(--ink-muted); text-transform: uppercase; font-size: 10px; letter-spacing: .06em; margin-right: 8px; }
  .bench-flag { margin-top: 12px; font-size: 12px; line-height: 1.45; color: var(--warn); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 9px 12px; }

  /* ── Plain-language clarification markers (Law 14) ──────────────────────── */
  .lg-info { display: inline; position: relative; }
  .lg-info > summary { display: inline; list-style: none; cursor: pointer; color: var(--accent); font-weight: 700; font-size: .72em; vertical-align: super; line-height: 0; margin-left: 1px; }
  .lg-info > summary::-webkit-details-marker { display: none; }
  .lg-info[open] > summary { color: var(--ink-muted); }
  .lg-pop { display: block; margin: 6px 0; padding: 10px 13px; background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; font-size: 13px; line-height: 1.5; color: var(--ink); font-weight: 400; }
  .lg-pop strong { color: var(--accent); }

  /* ── Glossary block ────────────────────────────────────────────────────── */
  .glossary .gl { margin: 16px 0 0; display: grid; gap: 0; }
  .gl-item { padding: 12px 0; border-bottom: 1px solid var(--border); display: grid; grid-template-columns: 180px 1fr; gap: 18px; }
  .gl-item:last-child { border-bottom: none; }
  .gl-item dt { font-family: var(--heading); font-weight: 700; font-size: 14px; color: var(--accent); }
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

  @media (max-width: 940px) {
    .layout, .layout.solo { grid-template-columns: 1fr; gap: 0; padding: 26px 18px 64px; max-width: 720px; }
    .rail { display: none; }
    .cmdbar .cb-meta, .cmdbar .cb-sep, .cmdbar .cb-idx { display: none; }
    .cmd-btn .cb-btxt { display: none; }
    .cmd-btn { padding: 0 9px; }
    .grid2, .ba, .shots-row, .exec-grid, .tiers, .phase-cols, .gl-item { grid-template-columns: 1fr; }
    /* The spine stacks: the price stops being a right-hand column and becomes a
       line under the description, still attached to its own window. */
    .spine-band { grid-template-columns: 1fr; gap: 12px; }
    .spine-band .sb-price { text-align: left; border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 12px; }
    .advisory-band { flex-direction: column; gap: 10px; }
    .gl-item { gap: 2px; }
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
    .score-kv { grid-template-columns: 1fr; gap: 8px; }
    .score-hero { grid-template-columns: 1fr; text-align: center; justify-items: center; }
    header.doc { padding: 32px 24px; }
    header.doc h1 { font-size: 28px; }
    .cover-meta { flex-direction: column; gap: 12px; }
    .cover-meta .cm { width: 100%; border-right: none; padding-right: 0; margin-right: 0; }
    .sec { padding: 24px 20px; }
  }

  @media print {
    html, body { background: #fff; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rail, .cmdbar { display: none; }
    .layout, .layout.solo { display: block; padding: 0; max-width: none; }
    .sec, .card, .leak, .phase-card, .score-row, .fn-card, .exec-card, .tier, .dollar-callout,
    .spine-band, .advisory-band, .dc-note { break-inside: avoid; }
    /* Colour-carrying markers keep their colour on paper: the advisory band, the
       cap note and the evidence chips are all things a printed copy must not
       silently lose. */
    .advisory-band, .dc-note, .ev-chip, .spine-band, .dest { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .leak-pane[hidden] { display: block; }
    .leak-tabs { display: none; }
    .leak.is-hidden { display: grid; }
    /* Inline markers hidden in print — the glossary block is the backstop. */
    .lg-info { display: none; }
  }
</style>
</head>
<body>
  ${cmdBar}
  ${testBanner}
  <div class="layout${solo ? " solo" : ""}">
    ${rail}
    <main class="main">
      <header class="doc">
        ${testStamp}
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
          <div class="cm"><div class="k">Data confidence</div><div class="v chip">${esc(
            confidence
          )}</div></div>
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
  <script>
    (function () {
      var doc = document;

      // ── Scrollspy: highlight the active TOC entry (no animation) ─────────
      var links = Array.prototype.slice.call(doc.querySelectorAll(".toc a"));
      var sections = links.map(function (a) {
        return doc.getElementById((a.getAttribute("href") || "").slice(1));
      });
      var active = -1;
      function onScroll() {
        var mark = window.scrollY + 120, cur = 0;
        for (var i = 0; i < sections.length; i++) {
          if (sections[i] && sections[i].offsetTop <= mark) cur = i;
        }
        if (cur === active) return;
        active = cur;
        links.forEach(function (a, idx) { a.classList.toggle("is-active", idx === cur); });
      }
      if (links.length) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

      // ── Priority filters on leak sections ───────────────────────────────
      var LBL = { crit: "Critical", high: "High", medium: "Medium", low: "Low" };
      doc.querySelectorAll(".sec").forEach(function (sec) {
        var leaks = Array.prototype.slice.call(sec.querySelectorAll(".leak"));
        if (leaks.length < 2) return;
        var counts = {};
        leaks.forEach(function (l) {
          ["crit", "high", "medium", "low"].forEach(function (k) {
            if (l.classList.contains(k)) counts[k] = (counts[k] || 0) + 1;
          });
        });
        var present = Object.keys(LBL).filter(function (k) { return counts[k]; });
        if (present.length < 2) return;
        var bar = doc.createElement("div");
        bar.className = "filterbar";
        var html = '<span class="fb-label">Filter</span><button class="fchip is-on" data-f="all">All <span class="fc-n">' + leaks.length + "</span></button>";
        present.forEach(function (k) {
          html += '<button class="fchip" data-f="' + k + '"><span class="fc-dot"></span>' + LBL[k] + ' <span class="fc-n">' + counts[k] + "</span></button>";
        });
        bar.innerHTML = html;
        var firstLeak = leaks[0];
        firstLeak.parentNode.insertBefore(bar, firstLeak);
        bar.addEventListener("click", function (ev) {
          var btn = ev.target.closest(".fchip"); if (!btn) return;
          var f = btn.getAttribute("data-f");
          bar.querySelectorAll(".fchip").forEach(function (c) { c.classList.toggle("is-on", c === btn); });
          leaks.forEach(function (l) {
            l.classList.toggle("is-hidden", f !== "all" && !l.classList.contains(f));
          });
        });
      });

      // ── Leak card tabs (Summary / Evidence / Recommendation) ────────────
      doc.querySelectorAll(".leak-tabs").forEach(function (tabs) {
        var body = tabs.closest(".lk-body");
        tabs.addEventListener("click", function (ev) {
          var btn = ev.target.closest(".leak-tab"); if (!btn) return;
          var name = btn.getAttribute("data-tab");
          tabs.querySelectorAll(".leak-tab").forEach(function (t) { t.classList.toggle("is-on", t === btn); });
          body.querySelectorAll(".leak-pane").forEach(function (p) {
            p.hidden = p.getAttribute("data-pane") !== name;
          });
        });
      });

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
  const groups = new Map<string, { desktop?: typeof viz.shots[number]; mobile?: typeof viz.shots[number] }>();
  for (const s of viz.shots) {
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
