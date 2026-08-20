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
  // en-CA, explicitly. This was `undefined`, meaning "whatever locale the
  // machine doing the render is set to" — so the same pack rendered on two
  // machines put two different date formats on the client's cover. The pack's
  // own Generated line was already pinned, to en-GB, which is why the Asset
  // Pack showed "August 13, 2026" up top and "13 August 2026" ten lines down.
  const prettyDate = new Date(meta.generatedAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const assumptions = meta.assumptions.length
    ? `<div class="assumptions"><span class="ico">&#9432;</span><div><strong>Methodology note.</strong> ${meta.assumptions
        .map((a) => esc(a))
        .join(" ")}</div></div>`
    : "";


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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
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

    /* ON-INK TRIO — for the cover, which is painted --ink rather than --surface.
       They exist because the light-ground tokens fail on it: --accent measures
       4.46:1 on --ink and --ink-muted 3.10:1, both under the 4.5 AA body floor.
       Same three roles (accent, muted copy, hairline) re-cut for a dark ground,
       used NOWHERE else — a light ground keeps the light tokens.
         --on-ink-accent  7.88:1 on --ink
         --on-ink-muted   6.79:1 on --ink
         --on-ink-rule    a hairline, never text                                */
    --on-ink-accent: #C9A961;
    --on-ink-muted: #A5A092;
    --on-ink-rule: #3A362E;

    /* The label gutter, as tokens so ONE breakpoint restacks every labelled row
       in all three documents instead of nine selectors drifting apart. */
    --label-w: 132px;
    --label-gutter: 156px;
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
  /* SCREEN ONLY — already hidden in print, so this is the reading view's chrome
     and never something a client receives on paper. It was a white bar with a
     bold serif wordmark and two outlined pill buttons sitting directly above an
     ink cover: two different documents stacked on each other. It now takes the
     cover's ink, so the page opens as one continuous dark band and the bar
     reads as the document's own header instead of browser furniture. */
  .cmdbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; gap: 16px;
    padding: 0 26px; height: 54px;
    background: var(--ink); border-bottom: none;
  }
  /* The wordmark is the cover's eyebrow: same mono, same brass, same short rule
     instead of a dot. One brand mark in the document, not two. */
  .cmdbar .cb-brand { display: inline-flex; align-items: center; gap: 10px; font-family: var(--mono); font-weight: 500; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--on-ink-accent); white-space: nowrap; }
  .cmdbar .cb-brand .dot { width: 18px; height: 2px; border-radius: 0; background: var(--on-ink-accent); }
  .cmdbar .cb-idx { font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: .14em; color: var(--on-ink-muted); text-transform: uppercase; padding-left: 16px; border-left: 1px solid var(--on-ink-rule); }
  .cmdbar .cb-center { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .cmdbar .cb-biz { font-family: var(--heading); font-weight: 400; font-size: 15px; color: var(--bg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40ch; }
  .cmdbar .cb-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .cmd-btn { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 13px; border-radius: 3px; font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; font-weight: 500; color: var(--on-ink-muted); background: transparent; border: 1px solid var(--on-ink-rule); cursor: pointer; white-space: nowrap; }
  .cmd-btn:hover { border-color: var(--on-ink-accent); color: var(--on-ink-accent); }
  .cmd-btn svg { width: 13px; height: 13px; }
  .cmd-btn.is-on { color: var(--ink); border-color: var(--on-ink-accent); background: var(--on-ink-accent); }

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
    position: relative; background: var(--ink); color: var(--bg);
    border: none; border-radius: 4px;
    padding: 62px 52px 46px; margin-bottom: 30px;
  }
  /* The eyebrow leads with a short brass rule rather than sitting alone — it is
     the one mark that reads as a letterhead at a glance. */
  header.doc .eyebrow { display: flex; align-items: center; gap: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: .2em; font-size: 10px; color: var(--on-ink-accent); margin-bottom: 44px; font-weight: 500; }
  header.doc .eyebrow::before { content: ""; width: 20px; height: 2px; background: var(--on-ink-accent); flex: none; }
  /* Serif at 300. That weight is the difference between this reading as a
     letterhead and reading as a form — it is why the stylesheet loads 300. */
  header.doc h1 { font-family: var(--heading); margin: 0 0 18px; font-size: 52px; line-height: 1.03; letter-spacing: -.022em; font-weight: 300; max-width: 18ch; color: var(--bg); }
  header.doc .subtitle { font-size: 15.5px; line-height: 1.6; color: var(--on-ink-muted); max-width: 52ch; margin: 0 0 44px; }
  .cover-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 34px; border-top: 1px solid var(--on-ink-rule); padding-top: 30px; }
  .cover-meta .cm { display: flex; flex-direction: column; gap: 9px; min-width: 0; padding: 0; margin: 0; border: none; }
  .cover-meta .cm .k { font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .18em; color: var(--on-ink-muted); margin-bottom: 0; font-weight: 500; }
  .cover-meta .cm .v { font-family: var(--heading); font-size: 17px; font-weight: 400; letter-spacing: -.005em; color: var(--bg); }

  /* ── V2 LABEL ROW ────────────────────────────────────────────────────────
     The one repeating shape in every deliverable: a mono label in a fixed
     column, its value beside it, a hairline under. It replaced a stack of
     tinted panels — .wf-fires, .wf-sees, .lc-said and .lc-fix were each their
     own filled box, so a card carried three competing grounds and the reader
     could not tell what was subordinate to what.
     No markup changed: every one of these already emitted a label element
     followed by its text, so the label is cell one and the text becomes an
     anonymous grid item in cell two.                                          */
  /* THE LABEL IS OUT OF FLOW, and that is the whole trick. This was a two-column
     GRID, which broke the moment a value contained inline markup: every child
     element becomes its own grid item, so a merge-field <code> in the middle of
     a sentence became item 3 and wrapped into the LABEL column with the rest of
     the sentence beside it. Values here are generated prose and routinely carry
     <code>, <strong> and <a>, so the grid could never hold.
     Absolutely positioning the label leaves the value as ordinary inline flow —
     any markup, any length, wraps normally. The rows are short and their cards
     already carry break-inside: avoid, so the label cannot detach in print. */
  .row-k,
  .wf-fires, .wf-sees, .wf-incl, .lc-said, .lc-fix, .dest,
  .leak-card > p:not(.lc-said):not(.lc-fix),
  .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl) {
    display: block; position: relative;
    padding: 15px 0 15px var(--label-gutter); margin: 0;
    border-bottom: 1px solid var(--border);
    background: none; border-radius: 0; border-left: none; border-right: none; border-top: none;
    font-family: inherit; font-size: 14.5px; line-height: 1.62; color: var(--ink);
  }
  .wf-fires > b, .wf-sees > strong, .wf-incl > strong, .lc-fix > strong, .dest > .dest-k,
  .lc-said::before,
  .leak-card > p:not(.lc-said):not(.lc-fix)::before,
  .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl)::before {
    position: absolute; left: 0; top: 18px; width: var(--label-w);
    font-family: var(--mono); font-size: 9.5px; letter-spacing: .12em; line-height: 1.5;
    text-transform: uppercase; color: var(--ink-muted); font-weight: 500;
  }

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
    background: transparent; border: none; border-radius: 0;
    padding: 0; margin-bottom: 46px; position: relative;
  }
  .sec-head { display: flex; align-items: baseline; gap: 16px; margin: 0 0 26px; padding: 0 0 18px; border-bottom: 1px solid var(--border); font-family: var(--heading); font-size: 27px; font-weight: 400; letter-spacing: -.014em; }
  .sec-num { font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--accent-text); background: transparent; padding: 0; border-radius: 0; line-height: 1; flex: none; letter-spacing: .06em; }
  .sec-inner > :first-child { margin-top: 0; }

  /* Three deliberate section WEIGHTS. Five identical white cards told the reader
     nothing about what mattered; these say it in the layout, before a word is
     read. Standard .sec is unchanged — the weights are the exceptions. */

  /* KEY — the anchor. The total, and the money. One or two per document. */
  .sec--key {
    background: transparent; border: none; border-radius: 0;
  }
  /* Weight now comes from the RULE, not from a fill: the key section's head is
     drawn in the accent at 2px where an ordinary head is a hairline. The ink
     figure panel directly beneath it is the real anchor. */
  .sec--key .sec-head { border-bottom: 2px solid var(--accent); }
  .sec--key h2 { font-size: 30px; }
  .sec--key .sec-num { background: transparent; }

  /* METHOD — recessed. Basis, assumptions, caveats. Always last. */
  /* METHOD — the quietest weight. A dashed border round a card said "aside";
     with no card, indenting it off the accent rule says the same thing. */
  .sec--method {
    background: transparent; border: none;
    border-left: 2px solid var(--border); border-radius: 0;
    padding: 4px 0 4px 28px;
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
  .label {
    font-family: var(--mono); font-size: 9.5px; font-weight: 500; text-transform: uppercase;
    letter-spacing: .14em; color: var(--ink-muted); margin: 22px 0 10px;
  }
  .label::after { content: ""; flex: 1; height: 1px; background: var(--border); }

  /* ── Tables ────────────────────────────────────────────────────────────── */
  /* EVERY table takes the banded treatment, not just .msg-table. Five tables
     render with no class at all — the pipeline stages, the section orders, the
     advisory notes — and they were coming out with a pale header and no surface
     while the message tables next to them had an ink band. */
  table, .msg-table {
    width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
  }
  th {
    text-align: left; background: var(--ink); color: var(--on-ink-muted);
    font-family: var(--mono); font-size: 9.5px; font-weight: 500; text-transform: uppercase;
    letter-spacing: .14em; padding: 15px 20px; border-bottom: none; vertical-align: bottom;
  }
  td { text-align: left; padding: 16px 20px; border-bottom: 1px solid var(--border); vertical-align: top; line-height: 1.6; }
  tr:last-child td { border-bottom: none; }
  /* This rule is why the classless tables stayed pale after the bare element
     selector was banded: thead-th outranks a lone th and sat after it, so the
     five tables with no class kept a --surface-2 header while the .msg-tables
     beside them carried an ink band. Same treatment now, stated once.
     (No backticks in here — this stylesheet lives inside a template literal.) */
  thead th { background: var(--ink); color: var(--on-ink-muted); font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .14em; font-weight: 500; border-bottom: none; }
  tbody tr:last-child td { border-bottom: none; }

  /* Message tables. The 4-column Step/Channel/Timing/Message shape spent three
     columns on one fact and left a 40-word SMS to fight for what remained of an
     860px column. Two columns: WHEN (with the channel as a chip) and MESSAGE. */
  /* The header row takes the ink bar, so a message table is the same object as a
     workflow card and a finding: banded head, ruled body, one surface. */
  .msg-table {
    width: 100%; border-collapse: collapse; margin: 0 0 16px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
  }
  .msg-table th {
    text-align: left; background: var(--ink); color: var(--on-ink-muted);
    font-family: var(--mono); font-size: 9.5px; font-weight: 500; text-transform: uppercase;
    letter-spacing: .14em; padding: 15px 24px; border-bottom: none;
  }
  .msg-table th:first-child { width: 168px; }
  .msg-table td { padding: 17px 24px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 14px; line-height: 1.62; }
  .msg-table tr:last-child td { border-bottom: none; }
  .msg-when { font-family: var(--mono); font-size: 11px; font-weight: 500; letter-spacing: 0; color: var(--ink-muted); }
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
  .hero-quote { background: transparent; border: none; border-left: 2px solid var(--accent); border-radius: 0; padding: 4px 0 4px 26px; font-family: var(--heading); font-size: 25px; font-weight: 400; line-height: 1.35; margin: 0 0 22px; letter-spacing: -.014em; color: var(--ink); }

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
  /* The figure is the one object in the pack a client screenshots, so it takes
     the ink ground the cover uses — the two read as the same document rather
     than a dark cover stapled to a light report. */
  .headline {
    display: grid; grid-template-columns: minmax(0,1fr) 268px; gap: 36px;
    align-items: start; background: var(--ink); border-radius: 4px;
    padding: 34px 36px; margin: 0 0 30px;
  }
  .hl-amount {
    font-family: var(--heading); font-size: 44px; font-weight: 400;
    letter-spacing: -.022em; line-height: 1; color: var(--on-ink-accent);
    font-variant-numeric: tabular-nums;
  }
  .hl-k {
    font-family: var(--mono); font-size: 9.5px; font-weight: 500;
    text-transform: uppercase; letter-spacing: .16em;
    color: var(--on-ink-muted); margin-bottom: 14px;
  }
  .hl-annual { margin-top: 14px; font-size: 13.5px; color: var(--on-ink-muted); }
  .hl-inputs {
    border-left: 1px solid var(--on-ink-rule); padding-left: 28px;
    display: grid; gap: 16px;
  }
  .hl-input .k {
    font-family: var(--mono); font-size: 9px; font-weight: 500; text-transform: uppercase;
    letter-spacing: .16em; color: var(--on-ink-muted); margin-bottom: 5px;
  }
  .hl-input .v {
    font-family: var(--heading); font-size: 19px; font-weight: 400;
    letter-spacing: -.008em; color: var(--bg);
  }

  /* Top-three ranked bar — each leak's share of the total, drawn with one
     pseudo-element off a --share custom property. No chart library, nothing to
     load, and it still reads on paper. */
  /* Each row is its own surface now. The section stopped being a white card, so
     without this the rows would sit loose on the cream page. */
  .rank { margin: 0; padding: 0; border-top: none; display: grid; gap: 10px; }
  .rank-row {
    display: grid; grid-template-columns: 26px minmax(0,1fr) 164px; gap: 18px; align-items: center;
    background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 18px 24px;
  }
  .rank-n { font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--accent-text); }
  .rank-name { font-size: 15px; font-weight: 500; }
  .rank-bar { height: 5px; border-radius: 0; background: var(--accent-tint); border: none; position: relative; overflow: hidden; }
  .rank-bar::after { content: ""; position: absolute; inset: 0 auto 0 0; width: calc(var(--share) * 1%); background: var(--accent); }
  .rank-cost { font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--ink); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* Leak cards. .lc-head is a flex row with a gap because the title and the
     price were rendering glued together — "After hoursCAD $1,200–2,400/mo". */
  .leak-card {
    border: 1px solid var(--border); border-radius: 4px; background: var(--surface);
    padding: 0; margin: 0 0 14px; overflow: hidden;
  }
  .leak-card:last-child { margin-bottom: 0; }
  /* The header is an INK bar — the cover's ground, carried into the body so the
     document reads as one piece rather than a dark cover on a light report.
     .lc-head keeps its flex gap: the title and price rendered glued together
     once — "After hoursCAD $1,200-2,400/mo" — and the gap is what fixed it. */
  .lc-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 20px; flex-wrap: wrap; margin: 0; padding: 18px 24px;
    background: var(--ink); border-bottom: none;
  }
  .lc-title { font-family: var(--heading); font-size: 20px; font-weight: 400; letter-spacing: -.01em; color: var(--bg); }
  .lc-cost { font-family: var(--mono); font-size: 12.5px; font-weight: 500; color: var(--on-ink-accent); white-space: nowrap; }
  /* The card's body is inset from the ink bar above it. The rows themselves are
     the shared V2 label row; only the gutter and the ::before TEXT live here. */
  .leak-card > .lc-said, .leak-card > .lc-fix,
  .leak-card > p:not(.lc-said):not(.lc-fix) { margin-left: 26px; margin-right: 26px; }
  .leak-card > p:not(.lc-said):not(.lc-fix)::before { content: "Which means"; }
  .lc-said::before { content: "In your words"; }
  .lc-fix { border-bottom: none; padding-bottom: 22px; }

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
    font-family: var(--mono); font-size: 11.5px; font-weight: 600;
    color: var(--accent-text); background: transparent;
    border-radius: 0; padding: 0; text-align: left; letter-spacing: .06em;
  }
  .wf-stage-t { font-family: var(--heading); font-size: 21px; font-weight: 400; letter-spacing: -.012em; }
  .wf-stage-d { grid-column: 2; font-size: 13.5px; color: var(--ink-muted); margin: 0 0 14px; }

  /* ONE column, not two. A label row reserves 132px for its label, so a
     half-width card left the value in a ~180px gutter and every sentence broke
     across four lines. The two-up grid was affordable only while the card was a
     stack of tinted panels. */
  .wf-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .wf-card {
    border: 1px solid var(--border); border-radius: 4px; background: var(--surface);
    padding: 0; display: block; overflow: hidden;
  }
  /* The ink bar, same object as the Diagnosis finding header — that is what
     makes the two documents read as one set. */
  .wf-head {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    flex-wrap: wrap; margin: 0; padding: 17px 26px; background: var(--ink);
  }
  .wf-name { font-family: var(--heading); font-size: 20px; font-weight: 400; letter-spacing: -.01em; color: var(--bg); }
  .wf-head .chan { background: transparent; border-color: var(--on-ink-rule); color: var(--on-ink-accent); }

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
  /* Styling lives on the shared V2 label row above. What stays here is the one
     thing that is specific to a trigger: it is quoted machine behaviour, so the
     VALUE keeps the mono face even though the row is otherwise prose. */
  .wf-fires { font-size: 13px; }

  /* Body rows are inset from the ink bar. The bare paragraph gets a label like
     every other row, so a card has no unlabelled block floating in it. */
  .wf-card > .wf-fires, .wf-card > .wf-sees, .wf-card > .wf-why, .wf-card > .wf-incl,
  .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl) { margin-left: 26px; margin-right: 26px; }
  /* Only the FIRST unlabelled paragraph is the what-it-does summary. The four
     toggled workflows carry a second one — "Included by decision." — which
     already opens with its own bold lead-in, so labelling every bare paragraph
     printed WHAT IT DOES twice in the same card. The second runs full width
     under the first, with no empty label gutter beside it. */
  .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl)::before { content: "What it does"; }
  .wf-card > .wf-sees { border-bottom: none; padding-bottom: 22px; }
  .wf-card > .wf-why { margin-bottom: 22px; }
  /* The auto top margin pins these to the bottom of the flex card, so a row of
     cards with uneven copy still lines its closing statements up. */
  .wf-sees { font-size: 14px; }
  .wf-card.is-pending { border-left: 2px solid var(--warn); border-radius: 0 4px 4px 0; }
  /* The one place a fill still earns its keep: "confirmed during the build" is
     a caveat about THIS workflow, not another field of it, so it must not read
     as one more label row. Amber, and the only tinted block left in a card. */
  .wf-why {
    display: block; margin: 4px 0 0; padding: 13px 16px; background: var(--warn-soft, var(--surface-2));
    border-left: 2px solid var(--warn); border-radius: 0 4px 4px 0; font-size: 13.5px; line-height: 1.6;
  }
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
  .flow-node { padding: 20px 18px; background: var(--surface); border-right: 1px solid var(--border); }
  .flow-node:last-child { border-right: none; }
  /* A live stage is marked by a brass cap, not a wash — a tinted column beside
     white ones reads as a highlight the reader has to decode. */
  .flow-node.is-live { background: var(--surface); box-shadow: inset 0 3px 0 0 var(--accent); }
  .flow-n { font-family: var(--mono); font-size: 9.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 9px; }
  .flow-t { font-family: var(--heading); font-size: 16px; font-weight: 400; letter-spacing: -.01em; margin-bottom: 9px; line-height: 1.25; }
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
  .dest { font-size: 14px; }

  /* ── Engagement spine (D4: the two windows and what each one costs) ─────── */
  .spine { display: grid; gap: 0; margin: 6px 0 4px; }
  .spine-band { display: grid; grid-template-columns: 108px minmax(0, 1fr) 176px; gap: 22px; align-items: start; border: 1px solid var(--border); border-radius: 4px; padding: 22px 24px; background: var(--surface); }
  .spine-band.is-run { border-color: var(--accent); background: var(--surface); box-shadow: inset 2px 0 0 0 var(--accent); }
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
  .spine-golive { display: flex; align-items: flex-start; gap: 12px; margin: 0; padding: 16px 24px; font-size: 13.5px; color: var(--ink); border-left: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--surface); }
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

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────
     Three widths, because a client opens this on whatever is in their hand.
     TABLET (940) drops the contents rail and stacks the side-by-side grids —
     that block already existed. What follows is the two ends it was missing. */

  /* LAPTOP / narrow desktop — the label gutter is 156px of a 860px column, which
     is affordable. Below that it starts squeezing the value into a ~40ch ribbon,
     so it tightens before it stacks. */
  @media (max-width: 1100px) {
    :root { --label-w: 116px; --label-gutter: 136px; }
  }

  /* PHONE — the gutter goes entirely. A 132px label beside a 200px value is how
     you get four-word lines; the label sits ABOVE its value instead, which is
     the same information in the order a narrow screen can actually read. */
  @media (max-width: 700px) {
    :root { --label-w: auto; --label-gutter: 0px; }
    .row-k,
    .wf-fires, .wf-sees, .wf-incl, .lc-said, .lc-fix, .dest,
    .leak-card > p:not(.lc-said):not(.lc-fix),
    .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl) { padding: 34px 0 14px; }
    .wf-fires > b, .wf-sees > strong, .wf-incl > strong, .lc-fix > strong, .dest > .dest-k,
    .lc-said::before,
    .leak-card > p:not(.lc-said):not(.lc-fix)::before,
    .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl)::before { top: 12px; width: auto; }

    .layout, .layout.solo { padding: 18px 14px 48px; }
    header.doc { padding: 40px 22px 30px; border-radius: 0; }
    header.doc h1 { font-size: 34px; }
    header.doc .subtitle { font-size: 14.5px; margin-bottom: 30px; }
    /* Three meta columns cannot hold at 360px — one per row, still ruled. */
    .cover-meta { grid-template-columns: 1fr; gap: 18px; padding-top: 22px; }

    .sec-head { font-size: 21px; gap: 11px; margin-bottom: 20px; }
    .sec--key h2, .sec-head h2 { font-size: 21px; }
    .headline { padding: 24px 20px; }
    .hl-amount { font-size: 28px; }
    .hl-inputs { grid-template-columns: 1fr; }
    .leak-card > .lc-said, .leak-card > .lc-fix,
    .leak-card > p:not(.lc-said):not(.lc-fix),
    .wf-card > .wf-fires, .wf-card > .wf-sees, .wf-card > .wf-why, .wf-card > .wf-incl,
    .wf-card > p:not(.wf-sees):not(.wf-why):not(.wf-incl) { margin-left: 18px; margin-right: 18px; }
    .lc-head, .wf-head { padding: 14px 18px; }
    .lc-title, .wf-name { font-size: 17px; }
    /* A merge field is one long unbreakable token; on a phone it must be allowed
       to break or it pushes the whole card sideways. */
    .mf { white-space: normal; word-break: break-all; }
    .msg-table th, .msg-table td { padding: 12px 14px; }
    .msg-table th:first-child { width: 96px; }
    .cmdbar { gap: 10px; padding: 0 14px; }
    .cmdbar .cb-biz { font-size: 13px; }
  }

  @media (max-width: 940px) {
    .layout, .layout.solo { grid-template-columns: 1fr; gap: 0; padding: 26px 18px 64px; max-width: 720px; }
    .rail { display: none; }
    .cmdbar .cb-idx { display: none; }
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
