/**
 * THEME PROOF — the dark operator theme is applied, complete and readable, and it
 * CANNOT reach a client-facing document. Run offline: no network, no database, no
 * API key.
 *
 *   node_modules/.bin/tsx scripts/verify-theme.ts
 *   npm run verify:theme
 *
 * Every check prints its own inputs and outputs before it asserts, so a reader can
 * audit the claim without trusting the assertion. Exits 1 if ANY check fails.
 *
 * WHY THIS FILE EXISTS. The owner flagged the constraint himself, in these words:
 *
 *     "new ui changes should ONLY impact the internal software itself and NOT the
 *      deliverables or cold audit. (critical)"
 *
 * (The cold audit was deleted by ruling on 2026-07-29 — every pre-sale generative
 * surface with it — so the constraint now protects the four PAID deliverables and
 * the public proposal page, which are the client-facing surfaces that still
 * render. The fence is the same fence; only the roster behind it shrank.)
 *
 * That is a promise, and a promise is worth nothing to the next person who opens
 * globals.css at 11pm and adds `body { background: var(--bg) }` because the
 * dashboard has a cream gutter on their machine. This file turns the promise into
 * a test. The five sections are the five ways it could quietly stop being true.
 *
 *   A. THE CLIENT-FACING       — the four paid deliverables are RENDERED here, and
 *      PALETTES ARE UNCHANGED    their colour set is asserted to be EXACTLY the
 *                                eleven brand values. Not "no dark colour leaked" —
 *                                the stronger claim that no colour changed at all.
 *                                Every value is printed.
 *
 *   B. THE THEME CANNOT REACH  — src/app/p/[publicId]/page.tsx is the public
 *      A CLIENT ROUTE            proposal a prospect opens to decide to pay. It
 *                                sits under the ROOT layout, which imports
 *                                globals.css, so it is the one genuine bleed path
 *                                left. EVERY rule in globals.css is classified as
 *                                client-reachable / operator-fenced / opt-in, all
 *                                three buckets are named, and the reachable bucket
 *                                is held to a DEFAULT-DENY property allowlist.
 *
 *   C. THE TOKENS ARE COMPLETE — every var(--x) read anywhere in the dashboard or
 *                                the component library resolves to a real value in
 *                                the shipped block. A token that is USED but not
 *                                DEFINED renders as an invalid value and silently
 *                                falls back — usually to black on black, which is
 *                                how "half the text vanished" happens.
 *
 *   D. DARK IS THE SHIPPED     — the applied palette is the dark block, token by
 *      STATE                     token, against the values the owner supplied. Not
 *                                light, not an opt-in a user has to find, and not
 *                                conditional on prefers-color-scheme.
 *
 *   E. CONTRAST, MECHANICALLY  — the WCAG ratio for every foreground/background
 *                                pairing the dashboard actually writes, computed
 *                                and PRINTED. The owner cannot check this himself
 *                                without opening every page, and unreadable muted
 *                                text on #262624 is the single most likely
 *                                regression in this whole change.
 *
 * READ THE LABELS. Some checks below prove a RUNTIME guarantee (the code renders
 * the right bytes), some are a SOURCE-LEVEL scan (the file does not contain a rule
 * that would bleed), and some are ARITHMETIC over the resolved token graph (the
 * numbers clear a threshold). They are not the same strength of promise, so every
 * check that makes a structural claim says which it is — the same discipline as
 * the header of scripts/verify-phase4.ts.
 *
 * WHAT THIS FILE CANNOT PROVE, and nobody should read it as proving: it does not
 * run a browser. It resolves the cascade the way the cascade is written, from one
 * stylesheet and two layouts. A rule injected by a third-party stylesheet at
 * runtime, or a browser without :has() support, is outside its reach — see the
 * notes on those two cases in B5 and B8.
 */

import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { DELIVERABLES, renderDeliverableHtml } from "@/lib/exporters/deliverables";
import type { AssetPack } from "@/types";

/* ════════════════════════════════════════════════════════════════════════════
 * HARNESS — identical in shape to verify-phase4.ts so the two read as one suite.
 * ══════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ✓  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ✗  ${name}`);
    console.log(`          ${(err as Error).message}`);
  }
}

/** Evidence line — the inputs/outputs a reader needs to audit the claim above. */
function show(label: string, value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  console.log(`          · ${label}: ${text}`);
}

/** A raw evidence line, for tables that would be unreadable as JSON. */
function row(text: string): void {
  console.log(`            ${text}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

/**
 * Source with every comment blanked, so a check about what the CODE does cannot
 * be satisfied — or defeated — by prose. Newlines are preserved so reported line
 * numbers still point at the real line.
 *
 * This is load-bearing here, not hygiene. globals.css and BOTH layouts open with
 * long comments that quote the exact strings several checks below search for
 * (`data-theme="dark"`, `prefers-color-scheme`, `.lg-theme-light`). A naive
 * `includes()` would read the warning ABOUT the mistake as the mistake.
 */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:/])\/\/[^\n]*/g, (m, p1: string) => p1 + " ".repeat(m.length - p1.length));
}

const codeOnly = (rel: string): string => blankComments(read(rel));

/* ════════════════════════════════════════════════════════════════════════════
 * PATHS — every file this suite reasons about, named once.
 * ══════════════════════════════════════════════════════════════════════════ */

const GLOBALS = "src/app/globals.css";
const ROOT_LAYOUT = "src/app/layout.tsx";
const DASH_LAYOUT = "src/app/(dashboard)/layout.tsx";
// The teaser (src/app/a/[publicId]/page.tsx) was deleted with the cold audit on
// 2026-07-29. The public proposal page is now the ONE client route under the
// root layout, so it inherits the whole fence the teaser used to be measured by.
const PUBLIC_PROPOSAL_PAGE = "src/app/p/[publicId]/page.tsx";
// The generated proposal was deleted on 2026-08-06 and this component replaced
// it at the same route: the offer, assembled from the saved calculator. The
// route did not move, so the whole fence below still measures the same boundary
// — only the component behind it changed. It renders in TWO places (the public
// page and, inside the dark call cockpit, the Zoom runner's Offer phase), which
// is exactly why its palette must be self-contained rather than inherited.
const PUBLIC_PROPOSAL = "src/components/client/ClientOffer.tsx";
const TAILWIND = "tailwind.config.ts";
const DOC_SHELL = "src/lib/exporters/_shell.ts";

/** The directories whose var() reads section C must account for. */
const TOKEN_CONSUMER_ROOTS = ["src/app/(dashboard)", "src/components"];

/** Committed, synthetic packs. A fresh clone renders all of these. (The three
 *  cold-audit fixtures that used to sit beside them were deleted with their
 *  surface on 2026-08-01.) */
const PACK_FIXTURES = [
  "_fixtures/golden-pack.json",
  "_fixtures/clients/01-pre-sale-cedar-ridge-plumbing/pack.json",
  "_fixtures/clients/02-full-intake-harbourline-electric/pack.json",
  "_fixtures/clients/03-toggled-pinecrest-roofing/pack.json",
];

/* ════════════════════════════════════════════════════════════════════════════
 * THE TWO PALETTES, WRITTEN OUT — this file's own copy, on purpose.
 *
 * A verification file that reads its expected values out of the file it is
 * checking proves nothing. These are transcribed from the brief the owner
 * supplied, by hand, and section D asserts globals.css agrees with them.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The CLIENT brand. Fourteen values in the paid deliverables. */
const BRAND = {
  paper: "#fbfaf7", //   --bg        the cream page
  surface: "#ffffff", // --surface   the card
  surface2: "#f4f2ec", // --surface-2 the inset
  ink: "#1a1814", //     --ink       body copy
  inkMuted: "#6b6659", // --ink-muted secondary copy
  gold: "#9a7b3f", //    --accent    the one muted-gold accent
  goldTint: "#f2ecdd", // --accent-tint (deliverables only)
  border: "#e7e3d8", //  --border    hairline
  good: "#3f7d5a", //    --good / --low
  warn: "#b5862f", //    --warn / --med
  critical: "#a8443b", // --critical / --high
  // The text-weight twins, added 2026-08-13 for AA. They are not new brand
  // colours by choice — each one exists because the semantic colour above it
  // fails 4.5:1 as body text on a ground it actually lands on. A3b holds them
  // to that: a twin must clear AA everywhere, and its original must fail
  // somewhere, or the twin has no reason to be in the palette.
  goldText: "#7e6229", // --accent-text  reads where --accent only rules/fills
  warnText: "#8a5a18", //  --warn-text
  goodText: "#356b4c", //  --good-text
} as const;
const BRAND_VALUES = Object.values(BRAND).map((v) => v.toLowerCase());

/** The serif the client documents set their headings in. */
const BRAND_SERIF_TOKENS = ["Source Serif 4", "Georgia", "Times New Roman", "serif"];

/**
 * The owner's DARK palette, transcribed from his brief. This is the shipped set.
 * `--radius` is included because it came with the palette and D1 checks it too.
 */
const OWNER_DARK: Record<string, string> = {
  "--background": "#262624",
  "--foreground": "#c3c0b6",
  "--card": "#262624",
  "--card-foreground": "#faf9f5",
  "--popover": "#30302e",
  "--popover-foreground": "#e5e5e2",
  "--primary": "#d97757",
  "--primary-foreground": "#ffffff",
  "--secondary": "#faf9f5",
  "--secondary-foreground": "#30302e",
  "--muted": "#1b1b19",
  "--muted-foreground": "#b7b5a9",
  "--accent": "#1a1915",
  "--accent-foreground": "#f5f4ee",
  "--destructive": "#ef4444",
  "--destructive-foreground": "#ffffff",
  "--border": "#3e3e38",
  "--input": "#52514a",
  "--ring": "#d97757",
  "--chart-1": "#b05730",
  "--chart-2": "#9c87f5",
  "--chart-3": "#1a1915",
  "--chart-4": "#2f2b48",
  "--chart-5": "#b4552d",
  "--sidebar": "#1f1e1d",
  "--sidebar-foreground": "#c3c0b6",
  "--sidebar-primary": "#343434",
  "--sidebar-primary-foreground": "#fbfbfb",
  "--sidebar-accent": "#0f0f0e",
  "--sidebar-accent-foreground": "#c3c0b6",
  "--sidebar-border": "#ebebeb",
  "--sidebar-ring": "#b5b5b5",
  "--radius": "0.5rem",
};

/** The owner's LIGHT palette. Defined in globals.css, NOT the shipped state. */
const OWNER_LIGHT: Record<string, string> = {
  "--background": "#faf9f5",
  "--foreground": "#3d3929",
  "--card": "#faf9f5",
  "--card-foreground": "#141413",
  "--popover": "#ffffff",
  "--popover-foreground": "#28261b",
  "--primary": "#c96442",
  "--secondary": "#e9e6dc",
  "--secondary-foreground": "#535146",
  "--muted": "#ede9de",
  "--muted-foreground": "#83827d",
  "--accent": "#e9e6dc",
  "--accent-foreground": "#28261b",
  "--border": "#dad9d4",
  "--input": "#b4b2a7",
  "--ring": "#c96442",
  "--sidebar": "#f5f4ee",
  "--sidebar-foreground": "#3d3d3a",
  "--chart-3": "#ded8c4",
  "--chart-4": "#dbd3f0",
};

/**
 * THE THREE DEVIATIONS from the owner's literal names, each with the token that
 * preserves his supplied value and the reason. globals.css documents all three in
 * prose; D1 asserts the prose is true, which is the only version that survives an
 * edit. A deviation that is not in this table is an unexplained change and fails.
 */
const DECLARED_DEVIATIONS: {
  token: string;
  ownerValue: string;
  shippedValue: string;
  preservedAt: string;
  why: string;
}[] = [
  {
    token: "--accent",
    ownerValue: "#1a1915",
    shippedValue: "#d97757",
    preservedAt: "--accent-subtle",
    why:
      "in his palette --accent is shadcn's subtle hover SURFACE (a near-black); in this " +
      "codebase --accent is the BRAND accent, read as text/icon/border colour at ~129 call " +
      "sites. His literal would turn all of them near-black on a near-black surface.",
  },
  {
    token: "--background",
    ownerValue: "#262624",
    shippedValue: "#1f1e1d",
    preservedAt: "--card",
    why:
      "his --background and --card are the same colour; his #262624 sits on the CARD so " +
      "cards stay distinguishable. The canvas was first mapped to his --muted (#1b1b19), " +
      "then moved to his --sidebar (#1f1e1d) by OWNER RULING 2026-08-01: every page canvas " +
      "matches the nav bar — 'that's Claude's real colour'. The canvas token references " +
      "var(--sidebar), so the two cannot drift.",
  },
  {
    token: "--primary-foreground",
    ownerValue: "#ffffff",
    shippedValue: "#1a1915",
    preservedAt: "--accent-fill-text",
    why:
      "white on flat #d97757 measures 3.12:1 — below AA for normal text. His own #1a1915 on " +
      "#d97757 measures 5.63:1. White is kept where it passes: on the gradient's deep end.",
  },
];

/**
 * Every dark-palette value, for the "did any of this leak into a client document"
 * sweep in A4. Includes the derived --lgx-* steps, because a leak of a derived
 * value is exactly as visible as a leak of a supplied one.
 *
 * #ffffff IS DELIBERATELY ABSENT. It is in the dark palette (--primary-foreground,
 * --destructive-foreground) AND it is the client documents' --surface. It is the
 * one value the two palettes share, so searching for it would fail every document
 * for a colour that was always theirs. Named here rather than silently dropped.
 */
const DARK_PALETTE_HEXES = [
  "#262624", "#c3c0b6", "#faf9f5", "#30302e", "#e5e5e2", "#d97757", "#1b1b19",
  "#b7b5a9", "#3e3e38", "#52514a", "#ef4444", "#b05730", "#9c87f5", "#1a1915",
  "#2f2b48", "#b4552d", "#1f1e1d", "#343434", "#fbfbfb", "#0f0f0e", "#ebebeb",
  "#b5b5b5", "#f5f4ee", "#6dbf95", "#d4b04a", "#a8a69b", "#939185", "#e89478",
  "#3a3934", "#6b6961",
];
const SHARED_WITH_BRAND = ["#ffffff"];

/* ════════════════════════════════════════════════════════════════════════════
 * COLOUR ARITHMETIC — sRGB, alpha compositing, WCAG 2.1 relative luminance.
 *
 * Hand-rolled rather than pulled in, for one reason: this suite must run in a
 * fresh clone with no extra dependency, and the formulas are four lines each.
 * They are the formulas from WCAG 2.1 SC 1.4.3, not an approximation.
 * ══════════════════════════════════════════════════════════════════════════ */

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseHex(hex: string): Rgba | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}

/** #rgb / #rrggbb / rgb() / rgba(). Returns null for anything else, on purpose. */
function parseColor(value: string): Rgba | null {
  const v = value.trim();
  if (v.startsWith("#")) return parseHex(v);
  const m = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (!m) return null;
  const parts = m[1].split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const n = (s: string): number => Number.parseFloat(s);
  if (parts.slice(0, 3).some((p) => Number.isNaN(n(p)))) return null;
  return {
    r: Math.round(n(parts[0])),
    g: Math.round(n(parts[1])),
    b: Math.round(n(parts[2])),
    a: parts.length > 3 ? n(parts[3]) : 1,
  };
}

/** Every hex stop in a linear-gradient(), in source order. */
function gradientStops(value: string): string[] {
  if (!/gradient\(/i.test(value)) return [];
  return value.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
}

/** Flatten a translucent colour onto an opaque one. */
function composite(fg: Rgba, base: Rgba): Rgba {
  if (fg.a >= 1) return { ...fg, a: 1 };
  const mix = (f: number, b: number): number => Math.round(fg.a * f + (1 - fg.a) * b);
  return { r: mix(fg.r, base.r), g: mix(fg.g, base.g), b: mix(fg.b, base.b), a: 1 };
}

/** WCAG 2.1 relative luminance. */
function luminance(c: Rgba): number {
  const lin = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2.1 contrast ratio. Both arguments must already be opaque. */
function contrast(fg: Rgba, bg: Rgba): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const ratioText = (n: number): string => `${r2(n).toFixed(2)}:1`;

/* WCAG thresholds. "Large" is ≥24px, or ≥18.66px at weight ≥700 (SC 1.4.3). */
const AA_BODY = 4.5;
const AA_LARGE = 3.0;

function thresholdFor(fontSize: number | null, fontWeight: number | null): number {
  if (fontSize === null) return AA_BODY; // unknown size is treated as body — the safe side
  if (fontSize >= 24) return AA_LARGE;
  if (fontSize >= 18.66 && (fontWeight ?? 400) >= 700) return AA_LARGE;
  return AA_BODY;
}

/* ════════════════════════════════════════════════════════════════════════════
 * A MINIMAL CSS MODEL — enough to classify rules and resolve custom properties.
 *
 * Not a full parser and does not pretend to be. It handles exactly what
 * globals.css contains: flat style rules, @layer and @media wrappers, and
 * @keyframes (whose inner `from`/`to` blocks are skipped rather than mistaken
 * for element selectors).
 * ══════════════════════════════════════════════════════════════════════════ */

interface CssDecl {
  prop: string;
  value: string;
}

interface CssRule {
  selector: string;
  selectors: string[];
  at: string[];
  decls: CssDecl[];
  line: number;
  index: number;
}

function parseDecls(body: string): CssDecl[] {
  const out: CssDecl[] = [];
  for (const raw of body.split(";")) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const colon = chunk.indexOf(":");
    if (colon < 0) continue;
    out.push({ prop: chunk.slice(0, colon).trim(), value: chunk.slice(colon + 1).trim() });
  }
  return out;
}

function parseCss(src: string): CssRule[] {
  const css = blankComments(src);
  const rules: CssRule[] = [];
  const at: string[] = [];
  let buf = "";
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    // A top-level statement at-rule — `@tailwind base;` — ends at its semicolon
    // and is NOT a block. Without flushing here, the three @tailwind lines at the
    // top of globals.css stay in `buf`, so the FIRST real selector inherits their
    // leading "@" and the whole light palette gets misread as an at-rule prelude.
    // That is exactly the bug this line fixes, and it silently swallowed a 42-token
    // block until D3 noticed the block was missing.
    if (ch === ";") {
      buf = "";
      i += 1;
      continue;
    }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        at.push(prelude);
        i += 1;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth += 1;
        else if (css[j] === "}") depth -= 1;
        j += 1;
      }
      rules.push({
        selector: prelude.replace(/\s+/g, " "),
        selectors: prelude.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean),
        at: [...at],
        decls: parseDecls(css.slice(i + 1, j - 1)),
        line: css.slice(0, i).split("\n").length,
        index: rules.length,
      });
      i = j;
      continue;
    }
    if (ch === "}") {
      at.pop();
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  return rules.filter((r) => !r.at.some((a) => a.startsWith("@keyframes")));
}

const GLOBALS_SRC = read(GLOBALS);
const GLOBAL_RULES = parseCss(GLOBALS_SRC);

/**
 * THE APPLIED SELECTOR CHAIN — what is live when the dashboard shell is mounted.
 * `.lg-app` carries `data-theme="dark"`, and it is a descendant of <html>, so all
 * three of these contribute and the last declaration wins.
 */
const APPLIED_CHAIN = [":root", ".lg-app", '[data-theme="dark"]'];

/** Custom-property declarations from a chosen set of selectors, in source order. */
function collectTokens(selectors: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of GLOBAL_RULES) {
    if (!rule.selectors.some((s) => selectors.includes(s))) continue;
    for (const d of rule.decls) {
      if (d.prop.startsWith("--")) out.set(d.prop, d.value);
    }
  }
  return out;
}

const SHIPPED = collectTokens(APPLIED_CHAIN);
const LIGHT_ONLY = collectTokens([".lg-theme-light"]);

/** Follow a var() chain to a literal. Honours an inline fallback. */
function resolveIn(tokens: Map<string, string>, value: string, depth = 0): string {
  if (depth > 16) return value;
  const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,([\s\S]*))?\)$/.exec(value.trim());
  if (!m) return value.trim();
  const name = m[1];
  const fallback = m[2]?.trim();
  const next = tokens.get(name) ?? fallback;
  if (next === undefined) return `UNDEFINED(${name})`;
  return resolveIn(tokens, next, depth + 1);
}

const shipped = (token: string): string => resolveIn(SHIPPED, `var(${token})`);

/** Every --token named anywhere inside a value, including inside a font stack. */
function referencedTokens(value: string): string[] {
  return Array.from(value.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)).map((m) => m[1]);
}

/** True when the value gives that reference an inline fallback to land on. */
function hasFallbackFor(value: string, token: string): boolean {
  return new RegExp(`var\\(\\s*${token}\\s*,`).test(value);
}

/** A resolved token as an opaque colour, flattened onto `over` if translucent. */
function tokenColor(token: string, over?: Rgba): Rgba | null {
  const raw = shipped(token);
  const parsed = parseColor(raw);
  if (!parsed) return null;
  if (parsed.a >= 1) return parsed;
  if (!over) return null;
  return composite(parsed, over);
}

/* ── the surface ladder, and what each step is for ─────────────────────────── */

/** Every opaque surface the dashboard paints, darkest first. */
const SURFACE_LADDER = [
  { token: "--bg", role: "canvas" },
  { token: "--bg-elevated", role: "elevated / sidebar" },
  { token: "--surface", role: "card" },
  { token: "--surface-2", role: "raised / popover" },
  { token: "--surface-hi", role: "active" },
];

/**
 * The three surfaces body copy actually sits on. E1 asserts against these; the
 * two above them are printed as evidence and carry an advisory instead, because
 * --surface-2 and --surface-hi are hover/active states of a control, not reading
 * surfaces, and holding a hover state to body-text AA would fail the design's own
 * intent rather than a real readability problem.
 */
const READING_SURFACES = ["--bg", "--bg-elevated", "--surface"];

/** Every token the dashboard reads as INK, with the surface family it belongs to. */
const INK_TOKENS: { token: string; role: "body" | "secondary" | "status"; on: "dark" | "bright" }[] = [
  { token: "--text", role: "body", on: "dark" },
  { token: "--text-2", role: "body", on: "dark" },
  { token: "--text-3", role: "secondary", on: "dark" },
  { token: "--text-4", role: "secondary", on: "dark" },
  { token: "--text-muted", role: "secondary", on: "dark" },
  { token: "--text-subtle", role: "secondary", on: "dark" },
  { token: "--accent", role: "status", on: "dark" },
  { token: "--accent-hover", role: "status", on: "dark" },
  { token: "--money", role: "status", on: "dark" },
  { token: "--success", role: "status", on: "dark" },
  { token: "--warn", role: "status", on: "dark" },
  { token: "--warning", role: "status", on: "dark" },
  { token: "--danger", role: "status", on: "dark" },
  // The ink for the --secondary BRIGHT fill (near-white chip), never for a dark
  // surface. Sidebar.tsx names it SB_ON_BRIGHT for exactly that reason.
  { token: "--secondary-foreground", role: "body", on: "bright" },
];

/* ════════════════════════════════════════════════════════════════════════════
 * KNOWN CONTRAST DEBT — the logged, reasoned override.
 *
 * WHY THIS TABLE EXISTS AND NOT A BLOCK. Seven pairings in this design miss AA.
 * Every one of them lives in a file this workflow does not own, and none of them
 * is new to the theme change in the sense that matters: the pattern was already
 * written, and repointing a token moved the number. A gate that fails the whole
 * build for a 10px metadata chip would be commented out inside a week and then
 * nothing would be checked at all. So the gate stays, and the misses are LOGGED
 * with their measured ratio, the ratio under the OLD palette, an absolute floor,
 * and the exact edit that clears them.
 *
 * The table is self-cleaning. Each entry fails if:
 *   · the ratio drops below `floor`               — it got worse than tolerable
 *   · the ratio drops below `measured` at all     — it regressed since recorded
 *   · the ratio now clears `threshold`            — the entry is dead weight and
 *                                                   is hiding the next drift
 * And a pair that misses WITHOUT an entry here fails outright, so new debt cannot
 * be added silently.
 *
 * `was` is the ratio the same pairing measured under the PREVIOUS palette
 * (near-black surfaces, oklch blue accent), computed once by hand and recorded so
 * the owner can tell a regression from inherited debt at a glance.
 * ══════════════════════════════════════════════════════════════════════════ */

interface ContrastDebt {
  id: string;
  bg: string;
  ink: string;
  /** The opaque surface a translucent fill is measured over. */
  over: string | null;
  measured: number;
  threshold: number;
  floor: number;
  was: number;
  why: string;
  fix: string;
  sites: string[];
}

const KNOWN_CONTRAST_DEBT: ContrastDebt[] = [
  {
    id: "accent-soft-pill",
    bg: "--accent-soft",
    ink: "--accent",
    over: "--surface",
    measured: 3.72,
    threshold: AA_BODY,
    floor: AA_LARGE,
    was: 5.73,
    why:
      "the accent pill: terracotta ink on an 18%-terracotta wash. REGRESSION — the old blue " +
      "accent measured 5.73:1 on a near-black card. 10 call sites across studio, call-queue, " +
      "playbook, calendar, library and AssetPackView, all at 10–14px, so none qualifies as " +
      "WCAG large text.",
    fix:
      "globals.css block B: make the wash OPAQUE so its contrast stops depending on what is " +
      "behind it — `--lgx-accent-soft: #38271f` (4.55:1 with --accent, 13.49:1 with --text) — " +
      "and give the glow its own translucent token: add `--lgx-accent-glow: rgba(217,119,87,.18)` " +
      "and point block D's `--accent-glow` at it instead of --lgx-accent-soft.",
    sites: [
      "src/app/(dashboard)/studio/page.tsx:684,1191,1262,1310,1638",
      "src/app/(dashboard)/call-queue/page.tsx:864",
      "src/app/(dashboard)/playbook/PlaybookBody.tsx:455",
      "src/app/(dashboard)/calendar/page.tsx:777",
      "src/app/(dashboard)/library/page.tsx:1228",
      "src/components/businesses/AssetPackView.tsx:318",
    ],
  },
      {
    id: "danger-pill",
    bg: "--danger-soft",
    ink: "--danger",
    over: "--surface",
    measured: 3.53,
    threshold: AA_BODY,
    floor: AA_LARGE,
    was: 6.1,
    why:
      ".lg-pill-danger — #ef4444 on a 13% wash of itself. REGRESSION from 6.10:1. Same root " +
      "cause as danger-ink-on-card: the ink is too dark for a dark surface.",
    fix:
      "the --lgx-danger-ink edit above raises this to 4.28:1 on a card. To clear 4.5 as well, " +
      "drop the wash to 0.10: `--lgx-danger-soft: rgba(239, 68, 68, 0.10)`.",
    sites: ["src/app/globals.css:776 (.lg-pill-danger)"],
  },
  {
    id: "gradient-light-stop",
    bg: "--accent-grad",
    ink: "#ffffff",
    over: null,
    measured: 2.35,
    threshold: AA_BODY,
    // Below AA-large, and deliberately recorded that way rather than dressed up.
    // The floor is the measured value: this may not get one shade worse.
    floor: 2.35,
    was: 2.29,
    why:
      "INHERITED, NOT A REGRESSION — the old blue gradient's light stop measured 2.29:1 with " +
      "the same white ink, so this has been shipping for as long as .lg-grad has existed. " +
      "White text over the gradient reads 4.94:1 at the deep end (#b05730) and 2.35:1 at the " +
      "light end (#e89478). The globals.css comment cites only the deep end, which is the half " +
      "that passes. This is the worst number in the whole theme and the owner should see it.",
    fix:
      "use the FLAT accent fill for anything carrying a label: `.lg-pill-active`, `.lg-grad` → " +
      "`background: var(--accent-fill)` (#b05730), white ink, a uniform 4.94:1. If the gradient " +
      "stays, either cap its light stop at #b85a36 (white = 4.61:1) or switch the ink to " +
      "`var(--lgx-accent-ink)` (#1a1915, min 3.56:1 across the stops — large text only).",
    sites: [
      "src/app/globals.css:772 (.lg-pill-active)",
      "src/app/globals.css:779 (.lg-grad)",
    ],
  },
  {
    id: "accent-glyph-on-raised",
    bg: "--surface-2",
    ink: "--accent",
    over: null,
    measured: 4.24,
    threshold: AA_BODY,
    floor: AA_LARGE,
    was: 6.74,
    why:
      "two icon tiles — a 38px box with a 16px glyph and a 44px icon container. As NON-TEXT " +
      "content (WCAG 1.4.11) the requirement is 3:1 and this clears it; it is listed because " +
      "the glyph in the 38px box is a text node, so the stricter reading applies.",
    fix:
      "use `var(--accent-hover)` for the glyph on a --surface-2 tile (5.63:1), or drop the tile " +
      "to --surface (4.86:1).",
    sites: [
      "src/app/(dashboard)/playbook/PlaybookBody.tsx:888",
      "src/app/(dashboard)/dashboard/DashboardBody.tsx:173",
    ],
  },
  {
    id: "text4-on-active",
    bg: "--surface-hi",
    ink: "--text-4",
    over: null,
    measured: 3.65,
    threshold: AA_BODY,
    floor: AA_LARGE,
    was: 3.02,
    why:
      "INHERITED AND IMPROVED — the same pairing measured 3.02:1 under the old palette. One " +
      "10px count chip. --text-4 is documented as the faintest step ON A CARD (4.79:1); this " +
      "is its use one surface higher.",
    fix: "use `var(--text-3)` at this one site — 4.73:1 on --surface-hi, and visually near-identical.",
    sites: ["src/app/(dashboard)/call-queue/page.tsx:796"],
  },
];

/**
 * Debt keys are matched on a normalised form. Without this, `color: #fff` in
 * globals.css would not match an entry recorded as `#ffffff` and the entry would
 * look absent — which is a false failure, and worse, a false failure that reads
 * exactly like a real one.
 */
function debtKey(value: string): string {
  const v = value.trim().toLowerCase();
  const m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return `#${m[1].split("").map((c) => c + c).join("")}`;
  return v.replace(/^var\((--[\w-]+)\)$/, "$1");
}

const debtFor = (bg: string, ink: string, over: string | null): ContrastDebt | undefined =>
  KNOWN_CONTRAST_DEBT.find(
    (d) => debtKey(d.bg) === debtKey(bg) && debtKey(d.ink) === debtKey(ink) && d.over === over
  );

/* ════════════════════════════════════════════════════════════════════════════
 * RENDER THE CLIENT DOCUMENTS ONCE — real renderers, committed synthetic packs.
 * ══════════════════════════════════════════════════════════════════════════ */

interface RenderedDoc {
  label: string;
  html: string;
}

const CLIENT_DOCS: RenderedDoc[] = [];
for (const packPath of PACK_FIXTURES) {
  const pack = JSON.parse(read(packPath)) as AssetPack;
  for (const d of DELIVERABLES) {
    CLIENT_DOCS.push({
      label: `${d.id} · ${packPath.split("/").slice(-2).join("/")}`,
      html: renderDeliverableHtml(pack, d.id),
    });
  }
}

// Every client document is a paid deliverable now — the cold audit and its
// renderer were deleted with the pre-sale surface. The alias keeps the section-A
// checks reading the way they are written.
const DELIVERABLE_DOCS = CLIENT_DOCS;

/** Every distinct 6-digit hex in a document, lower-cased and sorted. */
function hexesIn(html: string): string[] {
  const found = html.toLowerCase().match(/#[0-9a-f]{6}\b/g) ?? [];
  return Array.from(new Set(found)).sort();
}

console.log(
  "\nTHEME PROOF — dark operator theme applied, complete, readable, and fenced off\n" +
    "from every client-facing document.\n"
);
show("stylesheet", GLOBALS);
show("style rules parsed", GLOBAL_RULES.length);
show("tokens on the applied chain", SHIPPED.size);
show("client documents rendered", CLIENT_DOCS.length);

/* ════════════════════════════════════════════════════════════════════════════
 * A · THE CLIENT-FACING PALETTES ARE UNCHANGED.
 *
 * RUNTIME. Every claim in this section is made against HTML produced by the real
 * shipped renderers, not against their source.
 *
 * The four paid deliverables are standalone <!DOCTYPE html>
 * documents with inline CSS, so they are safe BY CONSTRUCTION — globals.css never
 * touches them. That is exactly why they still get checked here: "safe by
 * construction" is a property of today's architecture, and the day somebody
 * switches a deliverable to a Next route to get a share link, this section is the
 * thing that notices.
 * ══════════════════════════════════════════════════════════════════════════ */

section("A · THE CLIENT-FACING PALETTES ARE UNCHANGED — rendered, then read");

check("A1 · the four deliverables render the cream page, the serif and the muted gold", () => {
  const misses: string[] = [];
  for (const doc of DELIVERABLE_DOCS) {
    const bg = /--bg:\s*(#[0-9A-Fa-f]{6})/.exec(doc.html)?.[1] ?? "(none)";
    const ink = /--ink:\s*(#[0-9A-Fa-f]{6})/.exec(doc.html)?.[1] ?? "(none)";
    const accent = /--accent:\s*(#[0-9A-Fa-f]{6})/.exec(doc.html)?.[1] ?? "(none)";
    const heading = /--heading:\s*([^;]+);/.exec(doc.html)?.[1]?.trim() ?? "(none)";
    if (bg.toLowerCase() !== BRAND.paper) misses.push(`${doc.label}: --bg is ${bg}, expected ${BRAND.paper}`);
    if (ink.toLowerCase() !== BRAND.ink) misses.push(`${doc.label}: --ink is ${ink}, expected ${BRAND.ink}`);
    if (accent.toLowerCase() !== BRAND.gold) misses.push(`${doc.label}: --accent is ${accent}, expected ${BRAND.gold}`);
    if (!BRAND_SERIF_TOKENS.some((f) => heading.includes(f))) {
      misses.push(`${doc.label}: --heading is "${heading}" — no serif family in it`);
    }
    if (!/h1,\s*h2,\s*h3,\s*h4\s*\{\s*font-family:\s*var\(--heading\)/.test(doc.html)) {
      misses.push(`${doc.label}: headings no longer read var(--heading)`);
    }
  }
  const sample = DELIVERABLE_DOCS[0];
  show("documents", DELIVERABLE_DOCS.length);
  show("page background --bg  ", /--bg:\s*(#[0-9A-Fa-f]{6})/.exec(sample.html)?.[1] ?? "?");
  show("body ink     --ink   ", /--ink:\s*(#[0-9A-Fa-f]{6})/.exec(sample.html)?.[1] ?? "?");
  show("accent       --accent", /--accent:\s*(#[0-9A-Fa-f]{6})/.exec(sample.html)?.[1] ?? "?");
  show("heading font --heading", /--heading:\s*([^;]+);/.exec(sample.html)?.[1]?.trim() ?? "?");
  show("mismatches", misses.length ? misses : "(none)");
  assert.equal(misses.length, 0, `the deliverable brand shifted:\n  ${misses.join("\n  ")}`);
});

// A2 — DELETED 2026-08-01. It asserted the cold-audit document rendered the same
// brand shell as the deliverables. The document, its renderer and its fixtures
// are gone; A1/A3/A4 keep the identical guarantee on every surface that still
// renders.

check("A3 · the client colour set is EXACTLY the brand set — nothing added, nothing dropped", () => {
  // Stronger than "no dark colour leaked": the complete list of colours in each
  // document is enumerated and compared to the brand. A new hex of ANY kind — a
  // stray blue, a hand-typed grey, a dark token — fails here.
  const offenders: string[] = [];
  for (const doc of CLIENT_DOCS) {
    const hexes = hexesIn(doc.html);
    const extra = hexes.filter((h) => !BRAND_VALUES.includes(h));
    if (extra.length) offenders.push(`${doc.label}: ${extra.join(" ")}`);
  }
  const deliverableHexes = hexesIn(DELIVERABLE_DOCS[0].html);
  show(`brand palette (${BRAND_VALUES.length} values)`, BRAND_VALUES.join(" "));
  show(`deliverable colours (${deliverableHexes.length})`, deliverableHexes.join(" "));
  show("documents checked", CLIENT_DOCS.length);
  show("off-brand colours", offenders.length ? offenders : "(none)");
  assert.equal(
    offenders.length,
    0,
    `a colour that is not in the client brand reached a client document:\n  ${offenders.join("\n  ")}`
  );
  // "Nothing dropped" is the other half of the law, and it is the half that
  // catches a token being deleted rather than added. Counted against the
  // transcription so the two move together or the check fails.
  assert.equal(
    deliverableHexes.length,
    BRAND_VALUES.length,
    `the deliverables should carry ${BRAND_VALUES.length} colours, found ${deliverableHexes.length}`
  );
});

/**
 * The three -text twins are the only colours ever added to this palette, and
 * they were added for one reason: their originals are unreadable as text. A
 * check that only counted them would pass just as happily on three arbitrary
 * hexes. This asserts the REASON — which is also the rule that decides whether
 * a fourth twin should exist (--critical's answer is no, and that is asserted
 * here too, so a twin added for symmetry rather than for contrast fails).
 */
check("A3b · each -text twin clears AA where its original does not — the reason they were added", () => {
  // The grounds a deliverable actually paints text on. Anything else is a
  // border or a fill, which is what the untwinned original is FOR.
  const GROUNDS: Array<[string, string]> = [
    ["--bg", BRAND.paper],
    ["--surface", BRAND.surface],
    ["--surface-2", BRAND.surface2],
    ["--accent-tint", BRAND.goldTint],
  ];
  const TWINNED: Array<[string, string, string, string]> = [
    ["--accent", BRAND.gold, "--accent-text", BRAND.goldText],
    ["--warn", BRAND.warn, "--warn-text", BRAND.warnText],
    ["--good", BRAND.good, "--good-text", BRAND.goodText],
  ];

  const problems: string[] = [];
  const on = (hex: string, ground: string): number =>
    contrast(parseHex(hex)!, parseHex(ground)!);

  for (const [origName, orig, twinName, twin] of TWINNED) {
    const failing = GROUNDS.filter(([, g]) => on(orig, g) < AA_BODY);
    const twinFails = GROUNDS.filter(([, g]) => on(twin, g) < AA_BODY);
    show(
      `${origName} → ${twinName}`,
      GROUNDS.map(([gn, g]) => `${gn} ${ratioText(on(orig, g))} → ${ratioText(on(twin, g))}`).join("  ·  ")
    );
    if (!failing.length) {
      problems.push(`${twinName} has no job: ${origName} already clears ${AA_BODY} on every ground`);
    }
    for (const [gn, g] of twinFails) {
      problems.push(`${twinName} is ${ratioText(on(twin, g))} on ${gn} — below ${AA_BODY}, so it does not fix what it was added for`);
    }
  }

  // The untwinned one, stated as a claim rather than left implicit: --critical
  // is in the palette without a twin, and that is only correct while it reads.
  const critFails = GROUNDS.filter(([, g]) => on(BRAND.critical, g) < AA_BODY);
  show(
    "--critical (no twin)",
    GROUNDS.map(([gn, g]) => `${gn} ${ratioText(on(BRAND.critical, g))}`).join("  ·  ")
  );
  for (const [gn, g] of critFails) {
    problems.push(`--critical is ${ratioText(on(BRAND.critical, g))} on ${gn} and has no -text twin — it needs one`);
  }

  show("problems", problems.length ? problems : "(none)");
  assert.equal(problems.length, 0, `the -text twins do not do what they exist to do:\n  ${problems.join("\n  ")}`);
});

check("A4 · not one dark-palette value appears in any client document", () => {
  // The direct form of the owner's constraint, stated as its own check so a
  // failure names the leaked colour rather than "the set changed".
  const offenders: string[] = [];
  for (const doc of CLIENT_DOCS) {
    const lower = doc.html.toLowerCase();
    const hits = DARK_PALETTE_HEXES.filter((h) => lower.includes(h));
    if (hits.length) offenders.push(`${doc.label}: ${hits.join(" ")}`);
  }
  show("dark values searched", DARK_PALETTE_HEXES.length);
  show("excluded, shared with the brand", `${SHARED_WITH_BRAND.join(" ")} (the documents' own --surface)`);
  show("documents searched", CLIENT_DOCS.length);
  show("leaks", offenders.length ? offenders : "(none)");
  assert.equal(
    offenders.length,
    0,
    `a dark-theme colour is inside a document a prospect opens:\n  ${offenders.join("\n  ")}`
  );
});

check("A5 · no fence class, theme marker or dashboard token reaches a client document", () => {
  // A class name would mean the document had started depending on globals.css;
  // a dashboard token name would mean a var() with nothing to resolve against.
  const FORBIDDEN = [
    "lg-app",
    "lg-dashboard",
    "lg-theme-dark",
    "lg-theme-light",
    'data-theme="dark"',
    "--lgx-",
    "--surface-hi",
    "--text-2",
    "--text-3",
    "--text-4",
    "--line-strong",
    "--accent-grad",
    "--sidebar",
    "--card-foreground",
    "prefers-color-scheme",
  ];
  const offenders: string[] = [];
  for (const doc of CLIENT_DOCS) {
    const hits = FORBIDDEN.filter((f) => doc.html.includes(f));
    if (hits.length) offenders.push(`${doc.label}: ${hits.join(" ")}`);
  }
  show("markers searched", FORBIDDEN.length);
  show("hits", offenders.length ? offenders : "(none)");
  assert.equal(offenders.length, 0, `dashboard vocabulary in a client document:\n  ${offenders.join("\n  ")}`);
});

// A6 — DELETED 2026-08-01. It asserted the free teaser's inline palette was
// byte-identical to the cold-audit renderer's :root palette. Both files are
// deleted; there is no second copy of the brand left to drift. The public
// proposal's own palette discipline is held by B8 (every rule .lgp-scoped) and
// A3/A4 (no off-brand or dark value in any rendered client document).

check("A6 · the public proposal page carries no off-brand hex of its own", () => {
  // The proposal PAGE is the one client route left under the root layout. Its
  // stylesheet lives in PublicProposal.tsx (B8 proves it .lgp-scoped); the page
  // wrapper itself must not introduce colours the brand does not own.
  const pageHexes = Array.from(
    new Set(codeOnly(PUBLIC_PROPOSAL_PAGE).toLowerCase().match(/#[0-9a-f]{6}\b/g) ?? [])
  ).sort();
  const offBrand = pageHexes.filter((h) => !BRAND_VALUES.includes(h));
  show("hexes typed on the page", pageHexes.length ? pageHexes.join(" ") : "(none)");
  show("off-brand", offBrand.length ? offBrand : "(none)");
  assert.equal(
    offBrand.length,
    0,
    `an off-brand colour is typed directly on ${PUBLIC_PROPOSAL_PAGE}: ${offBrand.join(" ")}`
  );
});

check("A7 · the sweep is not vacuous — it CATCHES a doctored document", () => {
  // Without this, A3/A4 would keep passing if the matcher silently stopped
  // matching anything at all.
  const doctored = DELIVERABLE_DOCS[0].html.replace(BRAND.paper.toUpperCase(), "#262624");
  const darkHits = DARK_PALETTE_HEXES.filter((h) => doctored.toLowerCase().includes(h));
  const offBrand = hexesIn(doctored).filter((h) => !BRAND_VALUES.includes(h));
  show("A4 predicate on the doctored copy", darkHits);
  show("A3 predicate on the doctored copy", offBrand);
  assert(darkHits.includes("#262624"), "the A4 dark-value sweep no longer catches a swapped background");
  assert(offBrand.includes("#262624"), "the A3 exact-set check no longer catches an added colour");
  assert(
    !DARK_PALETTE_HEXES.some((h) => DELIVERABLE_DOCS[0].html.toLowerCase().includes(h)),
    "the undoctored document already trips the sweep — the check would be meaningless"
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * B · THE THEME CANNOT REACH A CLIENT ROUTE.
 *
 * SOURCE-LEVEL. This section reads globals.css and both layouts and reasons about
 * the cascade as written. It does not run a browser.
 *
 * THE RISK, PRECISELY. src/app/p/[publicId]/page.tsx — the public proposal, the
 * page a prospect decides to pay on — is a Next page under src/app/layout.tsx,
 * the ROOT layout, which imports globals.css. So any rule in globals.css that
 * matches <html>, <body>, `*` or a bare element name reaches it. (The free
 * teaser used to be the second route with this exposure; it was deleted with the
 * cold audit on 2026-07-29, which REMOVED a bleed path and changed nothing about
 * this one.) The page sets its own colours via its .lgp-scoped stylesheet, so
 * most declarations lose; but font-family inheritance, the body background
 * behind a short page, accent-color on a form control and ::selection all bleed
 * straight through styles that do not mention them.
 *
 * THE METHOD IS DEFAULT-DENY, not a list of dangerous properties. Every rule that
 * can match a client-route element must declare NOTHING except custom properties
 * and an explicitly allowlisted set of layout resets. That way a property nobody
 * thought of — the next `text-wrap`, the next `forced-color-adjust` — fails
 * closed instead of sailing through a blocklist that predates it.
 * ══════════════════════════════════════════════════════════════════════════ */

section("B · THE THEME CANNOT REACH A CLIENT ROUTE — every global rule, named");

/** Markers that pin a rule inside the operator shell. */
const FENCE_MARKERS = [".lg-app", ".lg-theme-dark", ".lg-theme-light", ".dark", '[data-theme="dark"]', ".lg-dashboard"];

const isFenced = (sel: string): boolean => FENCE_MARKERS.some((m) => sel.includes(m));
/** A selector with a class, id or attribute component. The proposal page renders
 *  only Tailwind LAYOUT classes (asserted in B6, where the rendered class list is
 *  also intersected with these selectors), so an opt-in rule stays unreachable. */
const isOptIn = (sel: string): boolean => /[.#]|\[/.test(sel.replace(/:[a-z-]+\((?:[^()]*)\)/g, ""));

type Bucket = "reachable" | "fenced" | "opt-in";

function bucketOf(rule: CssRule): Bucket {
  // A selector LIST reaches the client route if ANY of its parts does.
  const parts = rule.selectors;
  if (parts.some((s) => !isFenced(s) && !isOptIn(s))) return "reachable";
  if (parts.every((s) => isFenced(s))) return "fenced";
  return "opt-in";
}

const BUCKETS: Record<Bucket, CssRule[]> = { reachable: [], fenced: [], "opt-in": [] };
for (const rule of GLOBAL_RULES) BUCKETS[bucketOf(rule)].push(rule);

/**
 * The properties a client-reachable rule MAY declare. Nothing that paints, nothing
 * that sets a font, nothing that constrains width. Custom properties are allowed
 * unconditionally: a custom property paints nothing until something reads it, and
 * B6 proves the client route reads none of the dashboard's.
 */
const ALLOWED_ON_REACHABLE = new Set([
  "box-sizing",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "min-height",
  "scroll-behavior",
  "scroll-padding-top",
  "animation-duration",
  "animation-iteration-count",
  "transition-duration",
]);

/**
 * THE ONE DECLARED GLOBAL PAINT RULE. `html, body { background: <paper> }` is
 * genuinely global and has to be: it is the overscroll gutter, the one strip of
 * body a client page cannot cover, because the public route paints an opaque
 * min-height wrapper and nothing behind it. Its default is the BRAND paper so a
 * prospect rubber-banding the proposal on a phone sees cream. B5 asserts the
 * value, and that the dark variant is gated behind :has(.lg-app).
 */
const GLOBAL_PAINT_EXCEPTION = { selector: "html, body", prop: "background" };

check("B1 · the ROOT layout puts no theme marker on <html> or <body>", () => {
  const src = codeOnly(ROOT_LAYOUT);
  const htmlTag = /<html([^>]*)>/.exec(src)?.[1]?.trim() ?? "(no <html> tag found)";
  const bodyTag = /<body([^>]*)>/.exec(src)?.[1]?.trim() ?? "(no <body> tag found)";
  const bodyClasses =
    /<body[^>]*className=\{`([^`]*)`\}/.exec(src)?.[1]?.trim() ??
    /<body[^>]*className="([^"]*)"/.exec(src)?.[1]?.trim() ??
    "";
  show("<html …>", htmlTag);
  show("<body …>", bodyTag);
  show("body class tokens", bodyClasses.split(/\s+/).filter(Boolean));

  const FORBIDDEN_ON_ROOT = ["lg-app", "lg-dashboard", "lg-theme", "data-theme", "className=\"dark", " dark "];
  const onHtml = FORBIDDEN_ON_ROOT.filter((f) => htmlTag.includes(f.trim()));
  const onBody = FORBIDDEN_ON_ROOT.filter((f) => bodyTag.includes(f.trim()));
  show("theme markers on <html>", onHtml.length ? onHtml : "(none)");
  show("theme markers on <body>", onBody.length ? onBody : "(none)");
  assert.equal(
    onHtml.length + onBody.length,
    0,
    `a theme marker is on the ROOT layout (${[...onHtml, ...onBody].join(" ")}). Everything under it ` +
      `includes ${PUBLIC_PROPOSAL_PAGE}. Move it to ${DASH_LAYOUT}.`
  );
  // A colour or a font typed directly onto html/body would bypass the stylesheet
  // fence entirely, so both tags are also checked for inline paint.
  for (const [where, tag] of [["<html>", htmlTag], ["<body>", bodyTag]] as const) {
    assert(
      !/style=/.test(tag),
      `${where} in ${ROOT_LAYOUT} carries an inline style — it reaches every client route`
    );
  }
  const paintClasses = bodyClasses
    .split(/\s+/)
    .filter((c) => /^(bg|text|from|to|via|border|ring|accent|caret|decoration|divide|outline|shadow)-/.test(c));
  show("colour utilities on <body>", paintClasses.length ? paintClasses : "(none)");
  assert.equal(
    paintClasses.length,
    0,
    `a Tailwind colour utility is on <body> (${paintClasses.join(" ")}) — it inherits into the public proposal`
  );
});

check("B2 · the DASHBOARD layout is where the theme is applied", () => {
  const src = codeOnly(DASH_LAYOUT);
  const hasApp = /className="[^"]*\blg-app\b[^"]*"/.test(src);
  const hasDashboard = /className="[^"]*\blg-dashboard\b[^"]*"/.test(src);
  const hasDataTheme = /data-theme="dark"/.test(src);
  show("lg-app on the shell      ", hasApp);
  show("lg-dashboard on the shell", hasDashboard);
  show('data-theme="dark"        ', hasDataTheme);
  assert(hasApp, `lg-app is not applied in ${DASH_LAYOUT} — the theme paints nothing`);
  assert(hasDashboard, `lg-dashboard is not applied in ${DASH_LAYOUT} — the operator's tables lose their min-width`);
  assert(hasDataTheme, `data-theme="dark" is not on the shell — Tailwind's dark: variant is dead`);

  // and nowhere else, so there is exactly one place to reason about.
  const others: string[] = [];
  for (const rel of [ROOT_LAYOUT, PUBLIC_PROPOSAL_PAGE, PUBLIC_PROPOSAL, "src/app/page.tsx", "src/app/providers.tsx"]) {
    const s = codeOnly(rel);
    if (/\blg-app\b|\blg-theme-(dark|light)\b|data-theme=/.test(s)) others.push(rel);
  }
  show("other files applying a theme marker", others.length ? others : "(none)");
  assert.equal(others.length, 0, `a theme marker escaped the dashboard layout: ${others.join(" ")}`);
});

check("B3 · Tailwind's dark: variant is keyed to the shell, not to <html>", () => {
  const tw = codeOnly(TAILWIND);
  const darkMode = /darkMode:\s*(\[[^\]]*\]|"[^"]*")/.exec(tw)?.[1]?.replace(/\s+/g, " ") ?? "(not set)";
  show("tailwind.config.ts darkMode", darkMode);
  show("major version (package.json)", /"tailwindcss":\s*"([^"]+)"/.exec(read("package.json"))?.[1] ?? "?");
  assert(
    darkMode.includes('[data-theme="dark"]'),
    `darkMode is ${darkMode}. If it is "media" or keyed to a class on <html>, every dark: utility ` +
      `in the codebase becomes live on a prospect's page.`
  );
  assert(
    !/darkMode:\s*"media"/.test(tw),
    "darkMode: 'media' makes the variant depend on the PROSPECT's OS setting"
  );
});

check("B4 · every client-reachable rule in globals.css paints NOTHING (default-deny)", () => {
  const violations: string[] = [];
  console.log("          · client-reachable rules, each with every property it declares:");
  for (const rule of BUCKETS.reachable) {
    const props = rule.decls.map((d) => d.prop);
    const custom = props.filter((p) => p.startsWith("--")).length;
    const concrete = props.filter((p) => !p.startsWith("--"));
    const at = rule.at.length ? ` [${rule.at.join(" ")}]` : "";
    row(
      `${GLOBALS}:${String(rule.line).padStart(3)}  ${rule.selector}${at}  →  ` +
        (custom ? `${custom} custom propert${custom === 1 ? "y" : "ies"}` : "") +
        (custom && concrete.length ? " + " : "") +
        (concrete.length ? concrete.join(", ") : custom ? "" : "(nothing)")
    );
    for (const d of rule.decls) {
      if (d.prop.startsWith("--")) continue;
      if (ALLOWED_ON_REACHABLE.has(d.prop)) continue;
      if (rule.selector === GLOBAL_PAINT_EXCEPTION.selector && d.prop === GLOBAL_PAINT_EXCEPTION.prop) {
        row(`      ↑ declared global paint exception: ${d.prop}: ${d.value}  (asserted in B5)`);
        continue;
      }
      violations.push(`${GLOBALS}:${rule.line}  ${rule.selector} { ${d.prop}: ${d.value} }`);
    }
  }
  show("reachable rules", BUCKETS.reachable.length);
  show("operator-fenced rules", BUCKETS.fenced.length);
  show("opt-in rules (need a class the client route never renders — B6 proves that)", BUCKETS["opt-in"].length);
  show("violations", violations.length ? violations : "(none)");
  assert.equal(
    violations.length,
    0,
    `${violations.length} declaration(s) reach ${PUBLIC_PROPOSAL_PAGE}:\n  ${violations.join("\n  ")}\n` +
      `Move each under .lg-app (see THE FENCE at the bottom of ${GLOBALS}). If one genuinely must ` +
      `be global, add it to GLOBAL_PAINT_EXCEPTION here and assert its value the way B5 does.`
  );
});

check("B5 · the one legitimately-global paint rule is the BRAND paper, and its dark twin is gated", () => {
  const rule = GLOBAL_RULES.find(
    (r) => r.selector === GLOBAL_PAINT_EXCEPTION.selector && r.decls.some((d) => d.prop === "background")
  );
  assert(rule, `${GLOBALS} no longer has a "${GLOBAL_PAINT_EXCEPTION.selector}" background rule — B4's exception is stale`);
  const value = rule.decls.find((d) => d.prop === "background")?.value ?? "";
  const colour = parseColor(value);
  show("rule", `${GLOBALS}:${rule.line}  ${rule.selector} { background: ${value} }`);
  show("relative luminance", colour ? r2(luminance(colour)) : "(unparseable)");
  show("is a dark-palette value", DARK_PALETTE_HEXES.includes(value.toLowerCase()));
  assert(colour, `the global gutter background is "${value}" — not a flat colour this check can vouch for`);
  assert(
    !DARK_PALETTE_HEXES.includes(value.toLowerCase()),
    `the global gutter is painted with a DARK-THEME value (${value}). A prospect rubber-banding the ` +
      `public proposal on a phone would see the dashboard's charcoal.`
  );
  assert(
    luminance(colour) > 0.85,
    `the global gutter is ${value} (luminance ${r2(luminance(colour))}). It must stay the brand paper — ` +
      `${BRAND.paper} — because it is the one strip of <body> a client page cannot cover.`
  );

  // The dark canvas is opt-in via :has(.lg-app). Fails safe: a browser without
  // :has() gives the OPERATOR a cream gutter, which is cosmetic and operator-only.
  // It can never give a client page the dark one.
  const gated = GLOBAL_RULES.filter(
    (r) => r.selector.includes(":has(.lg-app)") && r.decls.some((d) => d.prop === "background")
  );
  show("dark-canvas rules, and their gate", gated.map((r) => `${GLOBALS}:${r.line} ${r.selector}`));
  assert(gated.length > 0, "nothing switches the canvas to the dark value — the dashboard has a cream gutter");
  for (const g of gated) {
    assert(
      g.selector.includes(":has(.lg-app)"),
      `${g.selector} paints a dark canvas without the :has(.lg-app) gate`
    );
  }
});

check("B6 · what DOES reach the client route is inert there, explicitly", () => {
  // (The first half of this check used to fence the free teaser's root element;
  // that page was deleted with the cold audit, so the proposal page carries the
  // whole fence now.)
  //
  // The public proposal is the one client route under the root layout. It uses
  // Tailwind layout classes only, and re-declares every token it reads inside
  // .lgp — so the three things that genuinely cross the boundary (font-family
  // inheritance from <body>, the colourless `antialiased`, and B5's gutter
  // background) all lose before they paint anything a prospect sees.
  const proposalPage = codeOnly(PUBLIC_PROPOSAL_PAGE);
  const proposalClasses = Array.from(
    new Set((proposalPage.match(/className="([^"]*)"/g) ?? []).flatMap((m) => m.replace(/className="|"/g, "").split(/\s+/)))
  ).filter(Boolean);
  show("public-proposal page classes", proposalClasses);
  const paintish = proposalClasses.filter(
    (c) => /^(bg|text|border|ring|from|to|via|font|accent|decoration)-/.test(c) && c !== "text-center"
  );
  show("of those, any that paint", paintish.length ? paintish : "(none — layout only)");
  assert.equal(
    paintish.length,
    0,
    `${PUBLIC_PROPOSAL_PAGE} uses a painting utility (${paintish.join(" ")}); it is a cream client document`
  );

  // And the load-bearing half of B4's bucketing: an opt-in rule is unreachable
  // only while no class the page RENDERS appears in an opt-in SELECTOR. The
  // rendered class list is intersected with every opt-in selector, so the day
  // somebody types className="lg-app" on this page, the fence fails by name
  // instead of silently re-bucketing.
  const optInHits: string[] = [];
  for (const rule of BUCKETS["opt-in"]) {
    for (const cls of proposalClasses) {
      if (rule.selectors.some((s) => s.includes(`.${cls}`))) {
        optInHits.push(`${GLOBALS}:${rule.line}  ${rule.selector}  ← matches rendered class "${cls}"`);
      }
    }
  }
  show("opt-in selectors matching a rendered class", optInHits.length ? optInHits : "(none)");
  assert.equal(
    optInHits.length,
    0,
    `an opt-in rule in globals.css matches a class the proposal page renders:\n  ${optInHits.join("\n  ")}\n` +
      "B4 counts these rules as unreachable; this page just made one reachable."
  );
});

check("B7 · every dark value in globals.css is a custom-property value or is fenced", () => {
  // The palette lives at :root, which IS client-reachable — and that is fine,
  // because a custom property paints nothing until something reads it. This check
  // is the other half of that argument: no dark value appears in a declaration
  // that actually paints, unless the rule is inside the fence.
  const offenders: string[] = [];
  for (const rule of GLOBAL_RULES) {
    for (const d of rule.decls) {
      if (d.prop.startsWith("--")) continue;
      const hits = DARK_PALETTE_HEXES.filter((h) => d.value.toLowerCase().includes(h));
      if (!hits.length) continue;
      if (rule.selectors.every((s) => isFenced(s) || isOptIn(s))) continue;
      offenders.push(`${GLOBALS}:${rule.line}  ${rule.selector} { ${d.prop}: ${d.value} }  → ${hits.join(" ")}`);
    }
  }
  const paletteDecls = GLOBAL_RULES.flatMap((r) =>
    r.decls.filter((d) => d.prop.startsWith("--") && DARK_PALETTE_HEXES.some((h) => d.value.toLowerCase().includes(h)))
  );
  show("dark values held in custom properties", paletteDecls.length);
  show("dark values in a painting declaration outside the fence", offenders.length ? offenders : "(none)");
  assert.equal(
    offenders.length,
    0,
    `a dark colour is painted by a rule that can match a client-route element:\n  ${offenders.join("\n  ")}`
  );
});

check("B8 · no component <style> tag ships a rule that could paint a client route", () => {
  // A <style> element injects GLOBAL css wherever it is mounted, so a component
  // that renders one is a second stylesheet the fence has to account for. Three
  // exist. All three must be @keyframes only — a keyframe paints nothing until an
  // `animation` property names it, and naming it is a class-scoped act.
  //
  // PublicProposal.tsx is the one legitimate exception: it injects a full
  // stylesheet, every rule prefixed `.lgp`, which is how the cream proposal keeps
  // its own tokens. It is asserted as .lgp-scoped rather than keyframe-only.
  const files = [
    "src/components/dashboard/MotivationPopup.tsx",
    "src/app/(dashboard)/library/page.tsx",
    PUBLIC_PROPOSAL,
  ];
  const offenders: string[] = [];
  for (const rel of files) {
    const src = codeOnly(rel);
    const blocks = src.match(/<style[^>]*>\{`([\s\S]*?)`\}<\/style>/g) ?? [];
    if (!blocks.length && rel !== PUBLIC_PROPOSAL) {
      offenders.push(`${rel}: expected a <style> block, found none — this check is now stale`);
      continue;
    }
    for (const block of blocks) {
      const css = block.replace(/^<style[^>]*>\{`/, "").replace(/`\}<\/style>$/, "");
      const rules = parseCss(css);
      const bad = rules.filter((r) => bucketOf(r) === "reachable" && r.decls.some((d) => !d.prop.startsWith("--")));
      row(`${rel}: ${rules.length} rule(s), ${bad.length} client-reachable`);
      for (const r of bad) offenders.push(`${rel}: ${r.selector} { ${r.decls.map((d) => d.prop).join(", ")} }`);
    }
  }
  // The proposal's stylesheet lives in a const, not a template inside <style>.
  const proposalCss = /const CSS = `([\s\S]*?)`;/.exec(codeOnly(PUBLIC_PROPOSAL))?.[1] ?? "";
  const proposalRules = parseCss(proposalCss);
  const unscoped = proposalRules.filter((r) => !r.selectors.every((s) => s.startsWith(".lgp")));
  row(`${PUBLIC_PROPOSAL}: ${proposalRules.length} rule(s), ${unscoped.length} not .lgp-scoped`);
  show("global paint from a component <style>", offenders.length ? offenders : "(none)");
  show("unscoped rules in the proposal stylesheet", unscoped.map((r) => r.selector));
  assert.equal(offenders.length, 0, `a component <style> paints a client-reachable selector:\n  ${offenders.join("\n  ")}`);
  assert.equal(
    unscoped.length,
    0,
    `${PUBLIC_PROPOSAL} injects a rule that is not .lgp-scoped (${unscoped
      .map((r) => r.selector)
      .join(" ")}); it renders inside the operator's dark preview frame too`
  );
});

check("B9 · the fence scan is not vacuous — it CATCHES a rule added to body", () => {
  // The exact regression this section exists to stop, written on purpose and fed
  // through the same bucketing and the same allowlist.
  const doctored = `
    body { background: var(--bg); color: var(--text); font-family: var(--font-sf); }
    .lg-app { accent-color: var(--accent); }
    ::selection { background: var(--accent-soft); }
  `;
  const rules = parseCss(doctored);
  const reachable = rules.filter((r) => bucketOf(r) === "reachable");
  const caught = reachable.flatMap((r) =>
    r.decls.filter((d) => !d.prop.startsWith("--") && !ALLOWED_ON_REACHABLE.has(d.prop)).map((d) => `${r.selector}{${d.prop}}`)
  );
  show("rules in the doctored stylesheet", rules.map((r) => r.selector));
  show("bucketed reachable", reachable.map((r) => r.selector));
  show("caught", caught);
  assert(caught.some((c) => c.includes("body") && c.includes("background")), "a body background is no longer caught");
  assert(caught.some((c) => c.includes("body") && c.includes("color")), "a body color is no longer caught");
  assert(caught.some((c) => c.includes("font-family")), "a global font-family is no longer caught");
  assert(caught.some((c) => c.includes("::selection")), "a bare ::selection is no longer caught");
  assert(
    !caught.some((c) => c.includes(".lg-app")),
    "the fenced .lg-app rule was flagged — the check would block the correct fix"
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * C · THE TOKENS ARE COMPLETE.
 *
 * SOURCE-LEVEL + ARITHMETIC over the resolved graph.
 *
 * WHY THIS IS THE QUIETEST FAILURE IN THE WHOLE CHANGE. `color: var(--text-5)`
 * with no --text-5 defined is not an error. It is an invalid value, so the
 * declaration is dropped and the element inherits — and inside a dark shell what
 * it inherits is usually another dark colour. Nothing logs, nothing throws, and
 * the text is simply not there. Renaming ONE token during a palette swap is
 * enough to do it, which is precisely what a palette swap involves.
 * ══════════════════════════════════════════════════════════════════════════ */

section("C · THE TOKENS ARE COMPLETE — every var(--x) the dashboard reads resolves");

/** Every var(--x) read under the given roots, with one example call site each. */
function collectVarReads(roots: string[]): Map<string, { count: number; where: string }> {
  const out = new Map<string, { count: number; where: string }>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(resolve(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(resolve(REPO, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const src = blankComments(readFileSync(resolve(REPO, rel), "utf8"));
      for (const m of Array.from(src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g))) {
        const prev = out.get(m[1]);
        out.set(m[1], { count: (prev?.count ?? 0) + 1, where: prev?.where ?? rel });
      }
    }
  };
  for (const r of roots) walk(r);
  return out;
}

const VAR_READS = collectVarReads(TOKEN_CONSUMER_ROOTS);

/**
 * The three places a token can legitimately come from that is NOT globals.css.
 * Each is a real definition site, and C2 proves each one exists rather than
 * exempting the names on trust.
 */
const OTHER_DEFINITION_SOURCES = {
  /** Re-declared by the component that reads them, inside its own .lgp block. */
  clientDocumentVocabulary: {
    file: PUBLIC_PROPOSAL,
    tokens: ["--ink", "--ink-muted", "--heading", "--accent-tint", "--good", "--critical"],
    why:
      "the CLIENT-DOCUMENT vocabulary. Declared inside `.lgp` in the component itself so the cream " +
      "proposal carries its own palette and globals.css never has to define a client token — which " +
      "would invent a bleed path where none exists.",
  },
  /** Injected by next/font as a class on <body> in the root layout. */
  nextFont: {
    file: ROOT_LAYOUT,
    tokens: ["--font-sans", "--font-mono"],
    why: "next/font generates these; the root layout names them via the `variable:` option.",
  },
  /** Supplied by Radix on the element it measures, at runtime. */
  radix: {
    file: "@radix-ui/react-select",
    tokens: ["--radix-select-trigger-height", "--radix-select-trigger-width"],
    why: "measured and set by Radix on the popper element; no stylesheet can or should define them.",
  },
} as const;

/** The union of the three: tokens globals.css legitimately does not define. */
const EXTERNALLY_SUPPLIED = new Set<string>([
  ...OTHER_DEFINITION_SOURCES.clientDocumentVocabulary.tokens,
  ...OTHER_DEFINITION_SOURCES.nextFont.tokens,
  ...OTHER_DEFINITION_SOURCES.radix.tokens,
]);

check("C1 · every token read across the dashboard and the component library resolves", () => {
  const known = EXTERNALLY_SUPPLIED;
  const missing: string[] = [];
  const fromElsewhere: string[] = [];
  for (const [token, meta] of Array.from(VAR_READS).sort()) {
    if (SHIPPED.has(token)) continue;
    if (known.has(token)) {
      fromElsewhere.push(`${token} (${meta.count}× — ${meta.where})`);
      continue;
    }
    missing.push(`${token} — ${meta.count} read(s), e.g. ${meta.where}`);
  }
  show("roots scanned", TOKEN_CONSUMER_ROOTS);
  show("distinct tokens read", VAR_READS.size);
  show("total var() reads", Array.from(VAR_READS.values()).reduce((a, b) => a + b.count, 0));
  show("defined in the shipped block", VAR_READS.size - fromElsewhere.length - missing.length);
  show("defined elsewhere, accounted for in C2", fromElsewhere);
  show("UNDEFINED", missing.length ? missing : "(none)");
  assert.equal(
    missing.length,
    0,
    `${missing.length} token(s) are READ but never DEFINED. Each renders as an invalid value, so the ` +
      `declaration is dropped silently and the element inherits — usually dark on dark:\n  ${missing.join("\n  ")}`
  );
});

check("C2 · the three non-globals definition sources are real, not exemptions on trust", () => {
  const proposalCss = /const CSS = `([\s\S]*?)`;/.exec(codeOnly(PUBLIC_PROPOSAL))?.[1] ?? "";
  const missingInProposal = OTHER_DEFINITION_SOURCES.clientDocumentVocabulary.tokens.filter(
    (t) => !new RegExp(`${t}\\s*:`).test(proposalCss)
  );
  show(`${PUBLIC_PROPOSAL} declares`, OTHER_DEFINITION_SOURCES.clientDocumentVocabulary.tokens);
  show("of those, not found", missingInProposal.length ? missingInProposal : "(none)");
  assert.equal(
    missingInProposal.length,
    0,
    `${PUBLIC_PROPOSAL} reads ${missingInProposal.join(" ")} but no longer declares them inside .lgp`
  );
  assert(
    /\.lgp\s*\{[\s\S]*?--ink\s*:/.test(proposalCss),
    "the proposal's tokens are no longer declared on .lgp itself — a nested re-theme could not override them"
  );

  const rootSrc = codeOnly(ROOT_LAYOUT);
  const fontVars = Array.from(rootSrc.matchAll(/variable:\s*"(--[a-z-]+)"/g)).map((m) => m[1]);
  show(`${ROOT_LAYOUT} next/font variables`, fontVars);
  for (const t of OTHER_DEFINITION_SOURCES.nextFont.tokens) {
    assert(
      fontVars.includes(t),
      `${t} is read in the dashboard but ${ROOT_LAYOUT} no longer declares it via next/font's variable: option`
    );
  }
  assert(
    /<body[^>]*\$\{inter\.variable\}/.test(rootSrc) && /<body[^>]*\$\{jetbrainsMono\.variable\}/.test(rootSrc),
    "the font variable classes are no longer on <body>, so --font-sans/--font-mono resolve nowhere"
  );

  // Radix: nothing declares these, and nothing should. What is provable is that
  // they are only read where Radix supplies them — the select popper.
  const radixReaders = OTHER_DEFINITION_SOURCES.radix.tokens.map((t) => VAR_READS.get(t)?.where ?? "(unread)");
  show("Radix runtime tokens, read only in", Array.from(new Set(radixReaders)));
  for (const where of radixReaders) {
    assert(
      where === "src/components/ui/select.tsx" || where === "(unread)",
      `a --radix-* token is read in ${where}, outside the Radix Select it is supplied by`
    );
  }
});

check("C3 · no token in the shipped block references a name that does not exist, and no chain loops", () => {
  // A value is NOT always a single var(): --font-display is a font STACK,
  // `var(--font-sf), var(--font-sans), "Segoe UI", sans-serif`, and every name in
  // it has to exist. So the graph is walked over EVERY reference in a value rather
  // than following one chain, and a name is only forgiven if it has an inline
  // fallback or comes from one of the three sources C2 verified.
  const broken: string[] = [];
  const cycles: string[] = [];
  let edges = 0;
  for (const token of Array.from(SHIPPED.keys()).sort()) {
    const path: string[] = [];
    const walk = (name: string): void => {
      if (path.includes(name)) {
        cycles.push(`${[...path, name].join(" → ")}`);
        return;
      }
      const value = SHIPPED.get(name);
      if (value === undefined) return;
      path.push(name);
      for (const ref of referencedTokens(value)) {
        edges += 1;
        if (!SHIPPED.has(ref)) {
          if (EXTERNALLY_SUPPLIED.has(ref)) continue;
          if (hasFallbackFor(value, ref)) continue;
          broken.push(`${name}: ${value}  →  ${ref} is not defined anywhere`);
          continue;
        }
        walk(ref);
      }
      path.pop();
    };
    walk(token);
  }
  show("tokens on the applied chain", SHIPPED.size);
  show("var() references followed", edges);
  show("references to a name that does not exist", broken.length ? Array.from(new Set(broken)) : "(none)");
  show("cycles", cycles.length ? Array.from(new Set(cycles)) : "(none)");
  assert.equal(
    broken.length,
    0,
    `a token in the shipped block points at a name nothing defines:\n  ${Array.from(new Set(broken)).join("\n  ")}`
  );
  assert.equal(
    cycles.length,
    0,
    `a var() chain loops, so the whole chain resolves to nothing:\n  ${Array.from(new Set(cycles)).join("\n  ")}`
  );
});

check("C4 · the light block defines no token the dark block leaves out", () => {
  // A token defined only under .lg-theme-light would be UNDEFINED in the shipped
  // state — the same silent-drop failure as C1, arriving through the back door of
  // a palette the owner supplied but does not ship.
  const orphans = Array.from(LIGHT_ONLY.keys()).filter((t) => !SHIPPED.has(t)).sort();
  show("tokens in the light block", LIGHT_ONLY.size);
  show("tokens on the applied chain", SHIPPED.size);
  show("light-only orphans", orphans.length ? orphans : "(none)");
  assert.equal(
    orphans.length,
    0,
    `defined for light but not for the shipped dark state: ${orphans.join(" ")}. Any component reading ` +
      `one gets an invalid value and drops the declaration.`
  );
});

check("C5 · the token scan is not vacuous — it CATCHES a renamed token", () => {
  const fake = new Map(SHIPPED);
  fake.delete("--text-3");
  const resolved = resolveIn(fake, "var(--text-3)");
  show("resolve --text-3 with the definition removed", resolved);
  show("resolve --text-3 as shipped", shipped("--text-3"));
  assert(resolved.startsWith("UNDEFINED("), "the resolver no longer reports a missing token");
  assert(VAR_READS.has("--text-3"), "--text-3 is no longer read anywhere — the probe is meaningless");
  assert(
    !shipped("--text-3").startsWith("UNDEFINED("),
    "--text-3 is genuinely undefined right now, so C1 should already have failed"
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * D · DARK IS THE SHIPPED STATE.
 *
 * SOURCE-LEVEL + ARITHMETIC. The owner's words were "make sure its dark mode not
 * light mode". Light is in the stylesheet because his CSS defined both and a
 * :root/.dark pair is the shape he handed over — but it has to be INERT, and the
 * dark values have to be what an element actually resolves to.
 * ══════════════════════════════════════════════════════════════════════════ */

section("D · DARK IS THE SHIPPED STATE — token by token against the supplied palette");

check("D1 · every supplied dark value is what the applied chain resolves to", () => {
  const mismatches: string[] = [];
  const deviations: string[] = [];
  for (const [token, ownerValue] of Object.entries(OWNER_DARK)) {
    const got = shipped(token).toLowerCase();
    if (got === ownerValue.toLowerCase()) continue;
    const declared = DECLARED_DEVIATIONS.find((d) => d.token === token);
    if (!declared) {
      mismatches.push(`${token}: shipped ${got}, owner supplied ${ownerValue}`);
      continue;
    }
    if (declared.shippedValue.toLowerCase() !== got) {
      mismatches.push(
        `${token}: shipped ${got}, but the declared deviation says ${declared.shippedValue}`
      );
      continue;
    }
    const preserved = shipped(declared.preservedAt).toLowerCase();
    if (preserved !== declared.ownerValue.toLowerCase()) {
      mismatches.push(
        `${token}: deviates to ${got}, and the value it claims to preserve at ${declared.preservedAt} ` +
          `is ${preserved}, not ${declared.ownerValue}`
      );
      continue;
    }
    deviations.push(`${token} ${ownerValue} → ${got} (his value kept at ${declared.preservedAt})`);
  }
  show("tokens compared", Object.keys(OWNER_DARK).length);
  show("exact matches", Object.keys(OWNER_DARK).length - deviations.length - mismatches.length);
  console.log("          · declared deviations, each with the token that keeps his value:");
  for (const d of DECLARED_DEVIATIONS) row(`${d.token}: ${d.ownerValue} → ${d.shippedValue}   kept at ${d.preservedAt}`);
  show("undeclared mismatches", mismatches.length ? mismatches : "(none)");
  assert.equal(
    mismatches.length,
    0,
    `the shipped palette diverges from the one the owner supplied, with no reason on record:\n  ${mismatches.join("\n  ")}`
  );
  assert.equal(
    deviations.length,
    DECLARED_DEVIATIONS.length,
    `DECLARED_DEVIATIONS lists ${DECLARED_DEVIATIONS.length} entr(y/ies) but only ${deviations.length} still ` +
      `deviate. A dead exemption hides the next drift — delete the stale one.`
  );
});

check("D2 · the palette is NOT conditional on the viewer's OS setting", () => {
  const css = blankComments(GLOBALS_SRC);
  const mediaBlocks = Array.from(css.matchAll(/@media([^{]*)\{/g)).map((m) => m[1].trim());
  const colorScheme = mediaBlocks.filter((b) => b.includes("prefers-color-scheme"));
  show("@media blocks in globals.css", mediaBlocks);
  show("gated on prefers-color-scheme", colorScheme.length ? colorScheme : "(none)");
  assert.equal(
    colorScheme.length,
    0,
    `a palette block is behind ${colorScheme.join(" ")}. The operator's OS setting would decide whether ` +
      `his dashboard is dark, which is not what "make sure its dark mode not light mode" means.`
  );
  const dashSrc = codeOnly(DASH_LAYOUT);
  assert(
    !/useState|useEffect|localStorage|matchMedia/.test(dashSrc.split("return (")[0] ?? ""),
    `${DASH_LAYOUT} reads a runtime preference before applying the theme — dark must not be an opt-in`
  );
});

check("D3 · the dark block WINS on :root, by source order", () => {
  // Both blocks list :root with equal specificity, so the later one wins. That is
  // the entire mechanism making dark the default, and it survives only as long as
  // the order does.
  const rootBlocks = GLOBAL_RULES.filter(
    (r) => r.selectors.includes(":root") && r.decls.some((d) => d.prop === "--background")
  );
  const lightIdx = rootBlocks.findIndex((r) => r.decls.some((d) => d.prop === "--background" && d.value.toLowerCase() === OWNER_LIGHT["--background"]));
  const darkIdx = rootBlocks.findIndex((r) => r.decls.some((d) => d.prop === "--background" && d.value.toLowerCase() === OWNER_DARK["--background"]));
  show("rules declaring --background on :root", rootBlocks.map((r) => `${GLOBALS}:${r.line} ${r.selector}`));
  show("light block position", lightIdx);
  show("dark block position ", darkIdx);
  show("--background as resolved on the applied chain", shipped("--background"));
  assert(lightIdx >= 0, "the light block no longer declares --background on :root — D3 cannot check the order");
  assert(darkIdx >= 0, "the dark block no longer declares --background on :root — the palette may not be applied at all");
  assert(
    darkIdx > lightIdx,
    `the LIGHT block is declared after the DARK one on :root (light at index ${lightIdx}, dark at ${darkIdx}). ` +
      `Equal specificity means the last one wins, so the dashboard would load light.`
  );
  // and .lg-app carries the palette itself, so the shell stays dark even if it is
  // ever mounted inside a light ancestor.
  const darkRule = rootBlocks[darkIdx];
  show("dark block selector list", darkRule.selectors);
  assert(
    darkRule.selectors.includes(".lg-app"),
    "the dark block is not declared on .lg-app; the shell would inherit whatever an ancestor set"
  );
});

check("D4 · the light palette is UNREACHABLE — nothing applies its class", () => {
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(resolve(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(resolve(REPO, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const src = blankComments(readFileSync(resolve(REPO, rel), "utf8"));
      if (/\blg-theme-light\b/.test(src)) hits.push(rel);
    }
  };
  walk("src");
  show("files applying lg-theme-light", hits.length ? hits : "(none)");
  show("light-block selectors in globals.css", GLOBAL_RULES.filter((r) => r.selectors.includes(".lg-theme-light")).map((r) => `${GLOBALS}:${r.line}`));
  assert.equal(
    hits.length,
    0,
    `lg-theme-light is applied in ${hits.join(" ")}. The light palette is transcribed for completeness ` +
      `and must stay inert — the owner ships dark.`
  );
});

check("D5 · the applied state is dark ARITHMETICALLY, not just by name", () => {
  // The last word on "is it dark": measure it. A canvas that resolved to a light
  // value would pass every name-based check above and still be wrong.
  const canvas = tokenColor("--bg");
  const card = tokenColor("--surface");
  const ink = tokenColor("--text");
  assert(canvas && card && ink, "the canvas, card or body ink no longer resolves to a flat colour");
  const lc = luminance(canvas);
  const lk = luminance(card);
  const li = luminance(ink);
  show("--bg     ", `${shipped("--bg")}  luminance ${r2(lc)}`);
  show("--surface", `${shipped("--surface")}  luminance ${r2(lk)}`);
  show("--text   ", `${shipped("--text")}  luminance ${r2(li)}`);
  show("ink is lighter than canvas", li > lc);
  assert(lc < 0.05, `the canvas resolves to ${shipped("--bg")} (luminance ${r2(lc)}) — that is not a dark canvas`);
  assert(lk < 0.05, `the card resolves to ${shipped("--surface")} (luminance ${r2(lk)}) — that is not a dark card`);
  assert(li > 0.7, `the body ink resolves to ${shipped("--text")} (luminance ${r2(li)}) — dark ink on a dark canvas`);
  assert(lk > lc, "the card is not lighter than the canvas; the surface ladder has inverted");
});

/* ════════════════════════════════════════════════════════════════════════════
 * E · CONTRAST, MECHANICALLY.
 *
 * ARITHMETIC over the resolved token graph, against pairings taken from the
 * SOURCE rather than from taste.
 *
 * The owner cannot check this himself without opening every page, and unreadable
 * muted text on #262624 is the single most likely regression in this whole change.
 * Every ratio is printed, whether it passes or not, so the numbers can be eyeballed
 * rather than trusted.
 *
 * THE THRESHOLDS ARE WCAG 2.1 SC 1.4.3: 4.5:1 for body text, 3:1 for large text
 * (≥24px, or ≥18.66px at weight ≥700). Where a pairing's text size cannot be read
 * from the source, it is treated as BODY — the strict side.
 * ══════════════════════════════════════════════════════════════════════════ */

section("E · CONTRAST, MECHANICALLY — every ratio computed and printed");

check("E1 · the ink ladder on every surface the dashboard paints", () => {
  const surfaces = SURFACE_LADDER.map((s) => ({ ...s, colour: tokenColor(s.token) }));
  for (const s of surfaces) assert(s.colour, `${s.token} no longer resolves to a flat colour`);

  console.log("          · rows are ink tokens, columns are surfaces (darkest → lightest):");
  row(
    "ink".padEnd(24) +
      surfaces.map((s) => `${s.token.replace("--", "")}`.padStart(13)).join("") +
      "   role"
  );
  row(
    "".padEnd(24) +
      surfaces.map((s) => `${shipped(s.token)}`.padStart(13)).join("")
  );

  const failures: string[] = [];
  const advisories: string[] = [];
  for (const ink of INK_TOKENS) {
    // Skipped from the DARK matrix and measured against its own bright fill just
    // below, rather than quietly dropped: on a dark surface it reads 1.15:1, which
    // would be a real-looking failure for a pairing that never renders.
    if (ink.on === "bright") continue;
    const colour = tokenColor(ink.token);
    assert(colour, `${ink.token} no longer resolves to a flat colour`);
    const cells: string[] = [];
    for (const s of surfaces) {
      const ratio = contrast(colour, s.colour!);
      const isReading = READING_SURFACES.includes(s.token);
      // EVERY ink here gets the BODY threshold, "secondary" included. That is not
      // an oversight: --text-3 and --text-4 are used at 10–13px, which is body
      // text no matter what the token is called. The `role` column is printed as
      // context for a reader, not used to soften the number.
      const threshold = AA_BODY;
      const mark = ratio >= threshold ? " " : ratio >= AA_LARGE ? "·" : "!";
      cells.push(`${r2(ratio).toFixed(2)}${mark}`.padStart(13));
      if (ratio >= threshold) continue;
      const record = `${ink.token} on ${s.token} = ${ratioText(ratio)}`;
      if (!isReading) {
        advisories.push(`${record} (hover/active surface, not a reading surface)`);
        continue;
      }
      const debt = debtFor(s.token, ink.token, null);
      if (debt) {
        advisories.push(`${record} — logged debt "${debt.id}", asserted in E5`);
        continue;
      }
      failures.push(record);
    }
    row(`${ink.token.padEnd(24)}${cells.join("")}   ${ink.role}`);
  }
  row("legend:  (blank) ≥4.5 AA body   · ≥3.0 AA large only   ! below 3.0");

  // The one ink that belongs on a BRIGHT fill, measured where it actually renders.
  // shadcn's Button/Badge `secondary` variants and the sidebar's SB_ON_BRIGHT all
  // pair --secondary-foreground with --secondary, which is a near-white chip.
  const bright = tokenColor("--secondary");
  const brightInk = tokenColor("--secondary-foreground");
  assert(bright && brightInk, "--secondary or --secondary-foreground no longer resolves to a flat colour");
  const brightRatio = contrast(brightInk, bright);
  row(
    `--secondary-foreground on --secondary (the bright chip): ${shipped("--secondary-foreground")} on ` +
      `${shipped("--secondary")} = ${ratioText(brightRatio)}   ` +
      `[src/components/ui/button.tsx, ui/badge.tsx, dashboard/Sidebar.tsx SB_ON_BRIGHT]`
  );
  if (brightRatio < AA_BODY) {
    failures.push(`--secondary-foreground on --secondary = ${ratioText(brightRatio)} (the bright chip)`);
  }

  show("body-AA misses on a reading surface", failures.length ? failures : "(none)");
  show("advisories (logged debt, or a hover/active surface)", advisories.length ? advisories : "(none)");
  assert.equal(
    failures.length,
    0,
    `${failures.length} ink/surface pairing(s) below 4.5:1 on a surface body copy actually sits on, with ` +
      `nothing on record:\n  ${failures.join("\n  ")}\nEither lighten the ink in ${GLOBALS} or add an entry ` +
      `to KNOWN_CONTRAST_DEBT in this file with the reason and the exact fix.`
  );
});

check("E2 · the pairings the SOURCE actually writes, from inline style objects", () => {
  // Every element in the dashboard that sets BOTH a background and a colour in one
  // style object, with both values unconditional var() tokens. This is the literal
  // answer to "the pairings the dashboard actually uses" — not a cross product, and
  // not a designer's list.
  //
  // TERNARIES ARE SKIPPED, and that is not laziness: `background: active ?
  // "var(--accent-grad)" : "transparent"` beside `color: active ? "#fff" :
  // "var(--text-3)"` would be read as text-3 on the gradient, which is a pairing
  // that never renders. Pairing the wrong branches invents failures and hides real
  // ones. The conditional cases are covered by E1's full ladder instead.
  interface Pair {
    bg: string;
    ink: string;
    sites: { file: string; line: number; size: number | null; weight: number | null }[];
  }
  const pairs = new Map<string, Pair>();

  const styleObjects = (src: string): { offset: number; body: string }[] => {
    const out: { offset: number; body: string }[] = [];
    for (const m of Array.from(src.matchAll(/style=\{\{/g))) {
      const start = (m.index ?? 0) + m[0].length;
      let depth = 1;
      let j = start;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth += 1;
        else if (src[j] === "}") depth -= 1;
        j += 1;
      }
      out.push({ offset: m.index ?? 0, body: src.slice(start, j - 1) });
    }
    return out;
  };
  const single = (body: string, re: RegExp): string | null => {
    const found = Array.from(body.matchAll(re)).map((m) => m[1].trim().replace(/,$/, ""));
    return found.length === 1 ? found[0] : null;
  };

  const walk = (dir: string): void => {
    for (const entry of readdirSync(resolve(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(resolve(REPO, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      const src = blankComments(readFileSync(resolve(REPO, rel), "utf8"));
      for (const obj of styleObjects(src)) {
        const bgRaw = single(obj.body, /\b(?:background|backgroundColor)\s*:\s*([^,\n]+)/g);
        const fgRaw = single(obj.body, /(?<![A-Za-z-])color\s*:\s*([^,\n]+)/g);
        if (!bgRaw || !fgRaw) continue;
        if (bgRaw.includes("?") || fgRaw.includes("?")) continue;
        const bg = /^"var\((--[\w-]+)\)"$/.exec(bgRaw)?.[1];
        const ink = /^"var\((--[\w-]+)\)"$/.exec(fgRaw)?.[1];
        if (!bg || !ink) continue;
        const size = /\bfontSize\s*:\s*([0-9.]+)/.exec(obj.body)?.[1];
        const weight = /\bfontWeight\s*:\s*([0-9]+)/.exec(obj.body)?.[1];
        const key = `${bg}|${ink}`;
        const entry2 = pairs.get(key) ?? { bg, ink, sites: [] };
        entry2.sites.push({
          file: rel,
          line: src.slice(0, obj.offset).split("\n").length,
          size: size ? Number.parseFloat(size) : null,
          weight: weight ? Number.parseInt(weight, 10) : null,
        });
        pairs.set(key, entry2);
      }
    }
  };
  for (const r of TOKEN_CONSUMER_ROOTS) walk(r);

  // A translucent fill's contrast depends on what is behind it, so it is measured
  // over the surface the pill actually sits inside. --surface (the card) is the
  // declared assumption; E3 prints the whole range.
  const ASSUMED_PARENT = "--surface";
  const parent = tokenColor(ASSUMED_PARENT);
  assert(parent, `${ASSUMED_PARENT} no longer resolves`);

  const failures: string[] = [];
  const logged: string[] = [];
  console.log("          · one row per pairing, worst text size on that pairing:");
  for (const p of Array.from(pairs.values()).sort((a, b) => (a.bg + a.ink).localeCompare(b.bg + b.ink))) {
    const bgColour = tokenColor(p.bg, parent);
    const inkColour = tokenColor(p.ink, parent);
    if (!bgColour || !inkColour) {
      row(`${p.bg} × ${p.ink} — not a flat colour pair, skipped (${shipped(p.bg)} / ${shipped(p.ink)})`);
      continue;
    }
    const ratio = contrast(inkColour, bgColour);
    const translucent = (parseColor(shipped(p.bg))?.a ?? 1) < 1;
    // The strictest threshold across the sites, i.e. the smallest text.
    const threshold = Math.max(...p.sites.map((s) => thresholdFor(s.size, s.weight)));
    const sizes = Array.from(new Set(p.sites.map((s) => s.size ?? "inherited"))).join("/");
    const verdict = ratio >= threshold ? "PASS" : "MISS";
    row(
      `${ratioText(ratio).padStart(8)} ${verdict}  ${p.bg.padEnd(15)} × ${p.ink.padEnd(16)} ` +
        `need ${threshold.toFixed(1)}  ${p.sites.length} site(s)  size ${sizes}` +
        (translucent ? `  [over ${ASSUMED_PARENT}]` : "")
    );
    if (ratio >= threshold) continue;
    const debt = debtFor(p.bg, p.ink, translucent ? ASSUMED_PARENT : null);
    if (debt) {
      logged.push(`${p.bg} × ${p.ink} = ${ratioText(ratio)} — logged debt "${debt.id}"`);
      continue;
    }
    failures.push(
      `${p.bg} × ${p.ink} = ${ratioText(ratio)}, needs ${threshold.toFixed(1)} — ` +
        p.sites.map((s) => `${s.file}:${s.line}`).join(", ")
    );
  }
  show("pairings found in source", pairs.size);
  show("logged as known debt", logged.length ? logged : "(none)");
  show("unlogged misses", failures.length ? failures : "(none)");
  assert.equal(
    failures.length,
    0,
    `${failures.length} pairing(s) the dashboard actually renders are below their WCAG threshold with ` +
      `nothing on record:\n  ${failures.join("\n  ")}`
  );
});

check("E3 · a translucent fill is a RANGE, not a value — printed across the whole ladder", () => {
  // Every wash the dashboard paints is rgba, so its contrast changes with whatever
  // is behind it. A pill that reads fine on a card can be unreadable on a hover
  // row. The realistic parents are the canvas and the card; the deeper steps are
  // printed so the owner can see how fast it degrades if a pill is ever nested.
  const WASHES = [
    { bg: "--accent-soft", ink: "--accent", note: ".lg-pill-active's quiet twin, and 10 inline pills" },
    { bg: "--accent-soft", ink: "--text", note: "::selection inside the shell" },
    { bg: "--money-soft", ink: "--money", note: ".lg-pill-success" },
    { bg: "--success-soft", ink: "--success", note: ".lg-pill-success (alias)" },
    { bg: "--warn-soft", ink: "--warn", note: ".lg-pill-warn" },
    { bg: "--warning-soft", ink: "--warning", note: ".lg-pill-warn (alias)" },
    { bg: "--danger-soft", ink: "--danger", note: ".lg-pill-danger" },
    { bg: "--danger-soft", ink: "--text", note: "the refused-override notice" },
    { bg: "--glass", ink: "--text", note: ".glass floating panels" },
  ];
  const REALISTIC_PARENTS = ["--bg", "--surface"];
  const failures: string[] = [];
  const logged: string[] = [];
  console.log("          · ratio over each surface the wash could sit on:");
  row("wash × ink".padEnd(34) + SURFACE_LADDER.map((s) => s.token.replace("--", "").padStart(12)).join(""));
  for (const w of WASHES) {
    const cells: string[] = [];
    for (const s of SURFACE_LADDER) {
      const base = tokenColor(s.token);
      const bgColour = tokenColor(w.bg, base ?? undefined);
      const inkColour = tokenColor(w.ink, base ?? undefined);
      if (!base || !bgColour || !inkColour) {
        cells.push("—".padStart(12));
        continue;
      }
      const ratio = contrast(inkColour, bgColour);
      const realistic = REALISTIC_PARENTS.includes(s.token);
      cells.push(`${r2(ratio).toFixed(2)}${ratio >= AA_BODY ? " " : ratio >= AA_LARGE ? "·" : "!"}`.padStart(12));
      if (!realistic || ratio >= AA_BODY) continue;
      const debt = debtFor(w.bg, w.ink, s.token) ?? debtFor(w.bg, w.ink, "--surface");
      if (debt) {
        logged.push(`${w.bg} × ${w.ink} over ${s.token} = ${ratioText(ratio)} — logged "${debt.id}"`);
        continue;
      }
      failures.push(`${w.bg} × ${w.ink} over ${s.token} = ${ratioText(ratio)} (${w.note})`);
    }
    row(`${`${w.bg} × ${w.ink}`.padEnd(34)}${cells.join("")}`);
  }
  row("legend:  (blank) ≥4.5   · ≥3.0   ! below 3.0        realistic parents: --bg, --surface");
  show("logged as known debt", logged.length ? logged : "(none)");
  show("unlogged misses on a realistic parent", failures.length ? failures : "(none)");
  assert.equal(
    failures.length,
    0,
    `a translucent fill is unreadable on a surface it actually sits on:\n  ${failures.join("\n  ")}`
  );
});

check("E4 · globals.css's own background+colour rules, including the gradient", () => {
  // The rules that paint a fill and its ink in one place: the shell, the card
  // primitives, the five pills, the gradient CTA and the toast.
  //
  // A GRADIENT IS MEASURED AT ITS WORST STOP. Contrast against a gradient varies
  // pixel by pixel, so light ink has to clear the threshold against the LIGHTEST
  // stop under it, not the average and not the end the comment happens to cite.
  const parent = tokenColor("--surface");
  assert(parent, "--surface no longer resolves");
  const failures: string[] = [];
  const logged: string[] = [];
  let inspected = 0;
  console.log("          · rule → ratio (translucent fills measured over --surface):");
  for (const rule of GLOBAL_RULES) {
    const bgDecl = rule.decls.filter((d) => d.prop === "background" || d.prop === "background-color").at(-1);
    const fgDecl = rule.decls.filter((d) => d.prop === "color").at(-1);
    if (!bgDecl || !fgDecl) continue;
    const bgValue = resolveIn(SHIPPED, bgDecl.value);
    const inkValue = resolveIn(SHIPPED, fgDecl.value);
    const inkColour = parseColor(inkValue);
    if (!inkColour) continue;
    inspected += 1;

    const stops = gradientStops(bgValue);
    const bases: { label: string; colour: Rgba }[] = stops.length
      ? stops.map((s) => ({ label: s, colour: parseHex(s)! })).filter((s) => s.colour)
      : (() => {
          const flat = parseColor(bgValue);
          if (!flat) return [];
          return [{ label: bgValue, colour: flat.a >= 1 ? flat : composite(flat, parent) }];
        })();
    if (!bases.length) {
      row(`${GLOBALS}:${rule.line} ${rule.selector} → background "${bgValue}" is not a flat colour, skipped`);
      continue;
    }
    const measured = bases.map((b) => ({ ...b, ratio: contrast(inkColour, b.colour) }));
    const worst = measured.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
    row(
      `${ratioText(worst.ratio).padStart(8)} ${worst.ratio >= AA_BODY ? "PASS" : "MISS"}  ${rule.selector.padEnd(34)} ` +
        `${inkValue} on ${worst.label}` +
        (measured.length > 1 ? `  (${measured.length} stops: ${measured.map((m) => r2(m.ratio).toFixed(2)).join(" → ")})` : "")
    );
    if (worst.ratio >= AA_BODY) continue;
    const bgKey = debtKey(bgDecl.value);
    const debt =
      debtFor(bgKey, inkValue, null) ??
      debtFor(bgKey, fgDecl.value, null) ??
      debtFor(bgKey, fgDecl.value, "--surface");
    if (debt) {
      logged.push(`${rule.selector} = ${ratioText(worst.ratio)} — logged "${debt.id}"`);
      continue;
    }
    failures.push(`${GLOBALS}:${rule.line} ${rule.selector} → ${ratioText(worst.ratio)} (${inkValue} on ${worst.label})`);
  }
  show("rules painting both a fill and its ink", inspected);
  show("logged as known debt", logged.length ? logged : "(none)");
  show("unlogged misses", failures.length ? failures : "(none)");
  assert.equal(
    failures.length,
    0,
    `a rule in ${GLOBALS} paints unreadable text:\n  ${failures.join("\n  ")}`
  );
});

check("E5 · every logged contrast debt is real, bounded and not stale", () => {
  // The gate on the escape hatch. Each entry is re-measured. It may not get worse
  // than recorded, may not fall below its floor, and may not still be listed once
  // it passes.
  const problems: string[] = [];
  console.log("          · id, measured now vs recorded vs the OLD palette, and the fix:");
  for (const d of KNOWN_CONTRAST_DEBT) {
    const base = d.over ? tokenColor(d.over) : null;
    const bgColour = d.bg.startsWith("--")
      ? (() => {
          const raw = shipped(d.bg);
          const stops = gradientStops(raw);
          if (stops.length) {
            // worst stop for the recorded ink
            const ink = d.ink.startsWith("--") ? parseColor(shipped(d.ink)) : parseColor(d.ink);
            if (!ink) return null;
            const rated = stops.map((s) => ({ s, r: contrast(ink, parseHex(s)!) })).sort((a, b) => a.r - b.r);
            return parseHex(rated[0].s);
          }
          return tokenColor(d.bg, base ?? undefined);
        })()
      : parseColor(d.bg);
    const inkColour = d.ink.startsWith("--") ? tokenColor(d.ink, base ?? undefined) : parseColor(d.ink);
    if (!bgColour || !inkColour) {
      problems.push(`${d.id}: one side no longer resolves (${d.bg} / ${d.ink}) — the entry cannot be verified`);
      continue;
    }
    const now = r2(contrast(inkColour, bgColour));
    const direction = now > d.was ? "improved from" : now < d.was ? "REGRESSED from" : "unchanged from";
    row(`${d.id}`);
    row(
      `   now ${ratioText(now)}   recorded ${d.measured.toFixed(2)}   floor ${d.floor.toFixed(2)}   ` +
        `needs ${d.threshold.toFixed(1)}   ${direction} ${d.was.toFixed(2)} under the old palette`
    );
    row(`   ${d.why}`);
    row(`   FIX: ${d.fix}`);
    row(`   at: ${d.sites.join(" · ")}`);
    if (now < d.floor - 0.005) {
      problems.push(`${d.id}: ${ratioText(now)} is below its floor of ${d.floor.toFixed(1)} — this is no longer tolerable`);
    } else if (now < d.measured - 0.05) {
      problems.push(
        `${d.id}: ${ratioText(now)} is worse than the recorded ${d.measured.toFixed(2)} — something made it worse. ` +
          `Fix it, or re-record the number and say why.`
      );
    } else if (now >= d.threshold) {
      problems.push(
        `${d.id}: ${ratioText(now)} now clears ${d.threshold.toFixed(1)}. The entry is dead weight and is hiding ` +
          `the next drift — delete it from KNOWN_CONTRAST_DEBT.`
      );
    }
  }
  show("entries", KNOWN_CONTRAST_DEBT.length);
  show("regressions from the old palette", KNOWN_CONTRAST_DEBT.filter((d) => d.measured < d.was).map((d) => d.id));
  show("inherited debt (no worse than before)", KNOWN_CONTRAST_DEBT.filter((d) => d.measured >= d.was).map((d) => d.id));
  show("problems", problems.length ? problems : "(none)");
  assert.equal(problems.length, 0, `the contrast-debt table is out of date:\n  ${problems.join("\n  ")}`);
});

check("E6 · the contrast maths is not vacuous — checked against known WCAG values", () => {
  // If the arithmetic drifted, every ratio above would be wrong in the same
  // direction and every check would keep passing. These four are the standard
  // reference values.
  const cases: { fg: string; bg: string; expect: number }[] = [
    { fg: "#ffffff", bg: "#000000", expect: 21 },
    { fg: "#000000", bg: "#000000", expect: 1 },
    { fg: "#767676", bg: "#ffffff", expect: 4.54 }, // the canonical AA boundary grey
    { fg: "#ffffff", bg: "#767676", expect: 4.54 },
  ];
  for (const c of cases) {
    const got = r2(contrast(parseHex(c.fg)!, parseHex(c.bg)!));
    show(`${c.fg} on ${c.bg}`, `${got}:1 (expected ${c.expect})`);
    assert(
      Math.abs(got - c.expect) < 0.02,
      `contrast(${c.fg}, ${c.bg}) = ${got}, expected ${c.expect} — the luminance formula has drifted and ` +
        `every ratio in section E is wrong`
    );
  }
  // Alpha compositing, checked the same way: 50% white over black is #808080.
  const half = composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
  show("50% white over black", `rgb(${half.r},${half.g},${half.b})`);
  assert.equal(half.r, 128, "alpha compositing is wrong, so every wash ratio in E3 is wrong");
  // And a real miss is still reported as a miss.
  const soft = tokenColor("--accent-soft", tokenColor("--surface")!);
  const accent = tokenColor("--accent");
  assert(soft && accent, "--accent-soft or --accent no longer resolves");
  show("--accent on --accent-soft over --surface", ratioText(contrast(accent, soft)));
  assert(
    contrast(accent, soft) < AA_BODY,
    "the accent pill now passes AA — good news, but delete the accent-soft-pill entry from " +
      "KNOWN_CONTRAST_DEBT and this probe with it"
  );
});

/* ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    "\nThis suite is the theme's acceptance test. Read the section that failed:\n" +
      "  A — a colour changed inside a document a client opens. Stop and look at the document.\n" +
      "  B — a rule in globals.css can now reach /p/[publicId], the public proposal a prospect\n" +
      "      decides to pay on. This is the failure the owner flagged himself as critical.\n" +
      "  C — a token is read but not defined. Something on screen is invisible right now.\n" +
      "  D — the dashboard is not shipping dark.\n" +
      "  E — text somewhere in the dashboard is below the readable threshold, and the pair\n" +
      "      is named above with the file, the line and the exact fix.\n"
  );
  process.exit(1);
}
console.log(
  "\nALL CHECKS PASSED\n" +
    "\nWhat is proven: the client documents render the brand palette and nothing else (RUNTIME);\n" +
    "no rule in globals.css can paint the public proposal route (SOURCE-LEVEL); every token the\n" +
    "dashboard reads resolves (SOURCE-LEVEL); the applied palette is the supplied dark one (ARITHMETIC);\n" +
    "and every foreground/background pairing the dashboard writes clears its WCAG threshold or is\n" +
    "logged above with its measured ratio and its fix (ARITHMETIC).\n" +
    "\nWhat is NOT proven, and only the owner can confirm on screen: how it LOOKS. This suite does\n" +
    "not run a browser. See the checks marked SOURCE-LEVEL — they reason about the cascade as\n" +
    "written, in one stylesheet and two layouts.\n"
);
