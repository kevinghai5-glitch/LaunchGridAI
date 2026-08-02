/**
 * PHASE 4 PROOF — what survives the cold audit's deletion, demonstrated against
 * the REAL shipped code, offline. No network, no database, no API key.
 *
 *   node_modules/.bin/tsx scripts/verify-phase4.ts
 *   npm run verify:phase4
 *
 * Every check prints its own inputs and outputs before it asserts, so a reader
 * can audit the claim without trusting the assertion. Exits 1 if ANY check fails.
 *
 * WHAT THIS FILE USED TO BE, AND WHAT DIED (2026-08-01). Phase 4's original
 * subject was the cold audit as a credibility beat: the outside/inside frame,
 * the six pivot phrases, the single CTA, the pre-sale disclosure gates, the
 * evidence voice and the benchmark labelling ON THE AUDIT (old sections A–G).
 * The owner deleted that entire surface by ruling on 2026-07-29 — "the output
 * shape demands three or four prose findings from thin public data… when the
 * real material runs out, the model fills the space" — so those sections died
 * with their subject. (The pre-sale disclosure gates themselves survive where
 * the union survives: verify-phase1 section D proves them against the
 * observed-facts row, the audit's non-generative replacement.)
 *
 * WHAT REMAINS is everything here that protects a SURVIVING surface:
 *
 *   H. THE MONEY LAW HOLDS ON   — "CAD $6,500", never a bare "$6,500", anywhere a
 *      THE PUBLIC PROPOSAL        prospect can see. Proved by rendering the real
 *                                 component and reading the visible words.
 *   I. THE OWNER'S DOCUMENT IS  — every list in docs/final-verification.md is
 *      KEPT TRUE BY THE CODE      re-derived from the shipped code and compared,
 *                                 not trusted: the twelve intake questions, the
 *                                 no-question leaks, the 60-day nurture map, the
 *                                 commands, and the three fixture clients.
 *   J. THE MONEY LAW,           — the SOURCE of every prospect-facing file, so a
 *      MECHANICALLY               new bare "$" cannot be typed in the first place.
 *
 * READ THE LABELS. Some checks below prove RUNTIME behaviour (the code behaves)
 * and some are a SOURCE-LEVEL scan (the code does not contain what must not
 * exist). They are not the same strength of promise, so every check that makes a
 * structural claim says which it is — the same discipline as section D of
 * scripts/verify-phase1.ts and the header of verify-phase3.ts.
 */

import assert from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { detectLeaks } from "@/lib/leak-detection";
import { gradeOf, intakeFieldsForZeroInferred, LEAKS } from "@/lib/leak-taxonomy";
import { NURTURE_SEQUENCE } from "@/lib/asset-generation";
import { buildProposalDefaults } from "@/lib/proposal-defaults";
import { PublicProposal } from "@/components/proposals/PublicProposal";
import type { AuditIntelligence } from "@/lib/audit-intelligence";
import type { FirecrawlScrape } from "@/lib/firecrawl";
import type { ProposalContent } from "@/types";

/* ════════════════════════════════════════════════════════════════════════════
 * (THE CTA PROBE — DELETED 2026-08-01. It re-ran this file as a child process
 * with NEXT_PUBLIC_BOOKING_URL set to prove the audit's configured-CTA branch.
 * The audit renderer is deleted; there is no branch left to probe.)
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

function section(title: string): void {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");

/**
 * Source with every comment removed, so a check about what the CODE does cannot
 * be satisfied — or defeated — by prose. Borrowed verbatim from verify-phase2 and
 * verify-phase3, and load-bearing here for a specific reason: several files in
 * this round open with long comments quoting the very strings whose SINGLE copy
 * this file is asserting, and a naive `includes()` would count the explanation.
 */
function codeOnly(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, including doc headers
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "); // line comments, but not "https://"
}

/** Every .ts/.tsx file under src/, repo-relative. Walked with fs (no shell), so
 *  the I2 pre-sale-caller scan covers a file the day it is created. */
function allSrcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(resolve(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(resolve(REPO, rel)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
    }
  };
  walk("src");
  return out;
}

/** The words a reader actually sees, markup removed. Same shape the pack
 *  validator uses (visibleText), so "on the page" means the same thing here as it
 *  does at the gate. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dollar amounts written WITHOUT the currency marker in front of them. The money
 *  law is "CAD $1,290" — marker first, everywhere, no exceptions. */
function bareDollarFigures(text: string): string[] {
  const out: string[] = [];
  const re = /\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    // "CAD $1,290" is the law; "US$84" is a different currency somebody wrote on
    // purpose and is left alone by the guard, so it is left alone here too.
    if (!/CAD\s*$/.test(before) && !/[A-Za-z]$/.test(before)) out.push(m[0]);
  }
  return out;
}
/* ════════════════════════════════════════════════════════════════════════════
 * THE FIXTURES
 *
 * Synthetic, like the golden pack and for the same reason: a .example domain that
 * can never resolve and a phone number in the reserved 555-01xx block, so nothing
 * in this file traces to a real prospect. Only the raw site material survives
 * here — section I2 derives its no-tel variant from it.
 * ══════════════════════════════════════════════════════════════════════════ */

const SCAN_DATE = "2026-07-01T12:00:00.000Z";

// A synthetic trade site with the signals a typical owner-run business shows: a
// four-field contact form, a tappable phone number, no scheduler and no chat.
// Every one of those is something src/lib/leak-detection.ts fingerprints.
const COLD_HTML = `<!doctype html><html lang="en"><head>
<title>Harbourline Air — Furnace and Heat Pump Service in Dartmouth</title></head><body>
<header><a class="logo" href="/">Harbourline Air</a>
<nav><a href="/services">Services</a><a href="/contact">Contact</a>
<a class="btn" href="tel:+19025550117">902-555-0117</a></nav></header>
<section class="hero"><h1>Furnace and heat pump service across Dartmouth</h1>
<p>Licensed and insured, working in the Halifax Regional Municipality since 2011.</p>
<a class="btn primary" href="/contact">Request a quote</a></section>
<section class="contact"><h2>Get in touch</h2>
<form action="/contact" method="post">
<label>Name<input type="text" name="name"></label>
<label>Email<input type="email" name="email"></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Message<textarea name="message"></textarea></label>
<button type="submit">Send message</button></form></section>
<footer><p>Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.</p></footer>
</body></html>`;

const COLD_MARKDOWN = `# Furnace and heat pump service across Dartmouth

Licensed and insured, working in the Halifax Regional Municipality since 2011.

[Request a quote](/contact) · [Call 902-555-0117](tel:+19025550117)

## Get in touch
Name, Email, Phone, Message.

Office hours Monday to Friday, 8am to 4:30pm. Closed weekends.`;

const COLD_SCRAPE: FirecrawlScrape = {
  used: true,
  homepage: {
    url: "https://harbourline-air.example/",
    title: "Harbourline Air",
    description: "",
    markdown: COLD_MARKDOWN,
    html: COLD_HTML,
    rawHtml: COLD_HTML,
    links: [],
  },
  subpages: [],
};

// (COLD_INTEL, the pre-sale detection, the hand-written model findings, the
// enforced baseReport and the teaser source all lived here — the raw material of
// old sections A–G. Deleted with the surface on 2026-08-01. COLD_HTML and
// COLD_SCRAPE above SURVIVE because section I2 derives its no-tel variant from
// them, which is what keeps that check non-vacuous.)

/* ════════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

console.log("\nPHASE 4 VERIFICATION — the money law and the owner's document, on the surviving surfaces");

/* ════════════════════════════════════════════════════════════════════════════
 * A–G — DELETED 2026-08-01, WITH THEIR SURFACE.
 *
 * A (the outside/inside frame), B (the six pivot phrases as one set of strings),
 * C (one CTA, counted on the markup, both branches via a child probe), D (the
 * pre-sale disclosure gates on the audit pipeline), E (evidence voice on both
 * artifacts), F (benchmark labelling on every audit dollar figure) and G (the
 * scope sweep on the audit) all asserted on the cold audit and its public
 * teaser. Both are deleted by ruling; a check whose surface is gone is a check
 * that can only rot. Where a law they enforced outlives the audit, it is
 * enforced elsewhere on the survivor:
 *   · pre-sale cannot carry intake      → verify-phase1 D (against the union and
 *                                          the observed-facts row)
 *   · interpretive leaks stay barred    → verify-fabrication A, and I2 below
 *   · tier-aware voice / money laws     → verify-phase05 (paid pack), H/J here
 *   · scope discipline on the pack      → validate-pack, exercised in
 *                                          verify-fabrication B5
 * ══════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────────
 * H · THE MONEY LAW ON THE PUBLIC PROPOSAL PAGE
 * ────────────────────────────────────────────────────────────────────── */
section("H · THE MONEY LAW — 'CAD $6,500', never a bare '$6,500', on the page a prospect decides on");

const PROSPECT = { name: "Harbourline Air", industry: "HVAC", city: "Dartmouth" };

function renderProposal(content: ProposalContent): string {
  return renderToStaticMarkup(
    createElement(PublicProposal, { business: PROSPECT, content })
  );
}

check("H1 · RUNTIME — the default proposal renders with no bare dollar figure anywhere visible", () => {
  const html = renderProposal(buildProposalDefaults(PROSPECT));
  const visible = visibleText(html);
  const bare = bareDollarFigures(visible);
  show("marked figures", Array.from(new Set(visible.match(/CAD \$[\d,]+/g) ?? [])).slice(0, 6));
  show("bare figures  ", bare);
  assert.deepEqual(bare, [], "the proposal a prospect opens carries a bare dollar figure");
});

check("H2 · RUNTIME — a hand-edited proposal carrying bare figures is repaired at the page", () => {
  // The prose is SAVED on the proposal row and editable afterwards, so a proposal
  // written before the convention was fixed can still reach this page carrying a
  // bare "$2,400" or a trailing "$18,500 CAD". The component is the last thing
  // between that text and the buyer.
  const content = buildProposalDefaults(PROSPECT);
  const dirty: ProposalContent = {
    ...content,
    packageOverview: "The build is $6,500 one-time and the retainer is $1,000 CAD a month.",
    problem: {
      summary: "Roughly $2,400 a month is leaking out before it converts.",
      basis: "Estimated at $2,400–$4,100 a month from the audit.",
      leaks: [
        {
          title: "Missed calls",
          monthlyCost: "$1,290 / mo",
          detail: "About $1,290 a month of demand you already paid for, going unanswered.",
        },
      ],
    },
    roi: { ...content.roi, summary: "Recovering $18,500 CAD over a year.", points: ["$860 a month, conservatively."] },
  };
  const visible = visibleText(renderProposal(dirty));
  show("input carried", ["$6,500", "$1,000 CAD", "$2,400", "$1,290", "$18,500 CAD", "$860"]);
  show("bare on page ", bareDollarFigures(visible));
  assert.deepEqual(bareDollarFigures(visible), [], "a hand-edited bare figure reached the buyer");
  for (const fig of ["CAD $6,500", "CAD $2,400", "CAD $1,290", "CAD $18,500", "CAD $860"]) {
    assert(visible.includes(fig), `"${fig}" is not on the rendered page — the guard changed the digits or dropped one`);
  }
  assert(!/\$18,500\s*CAD/.test(visible), "the now-redundant trailing CAD survived beside a marked figure");
});

check("H3 · RUNTIME — the two headline prices are the offer's prices, CAD-marked", () => {
  const visible = visibleText(renderProposal(buildProposalDefaults(PROSPECT)));
  show("one-time", /CAD\s*\$6,500/.test(visible));
  show("monthly ", /CAD\s*\$1,000/.test(visible));
  assert(/CAD\s*\$6,500/.test(visible), "the one-time fee is not rendered as CAD $6,500");
  assert(/CAD\s*\$1,000/.test(visible), "the monthly retainer is not rendered as CAD $1,000");
});

check("H4 · RUNTIME — a foreign-currency figure somebody wrote on purpose is left alone", () => {
  // "US$84" is not the money law being broken, it is a different currency. A guard
  // that rewrote it would be inventing a number, which is worse than the ambiguity
  // it is trying to remove.
  const content = buildProposalDefaults(PROSPECT);
  const withUsd: ProposalContent = {
    ...content,
    roi: { ...content.roi, points: ["Industry cost per lead runs US$84 before conversion."] },
  };
  const visible = visibleText(renderProposal(withUsd));
  show("on the page", /US\$84/.test(visible));
  assert(visible.includes("US$84"), "a deliberately foreign figure was rewritten as CAD");
  assert.deepEqual(bareDollarFigures(visible), [], "the foreign figure was counted as a bare one");
});

/* ──────────────────────────────────────────────────────────────────────────
 * I · THE OWNER'S DOCUMENT IS KEPT TRUE BY THE CODE
 * ────────────────────────────────────────────────────────────────────── */
section("I · docs/final-verification.md — every list in it is re-derived and compared, not trusted");

const DOC_PATH = "docs/final-verification.md";
const doc = read(DOC_PATH);

/** The cells of every pipe-table row in the document, trimmed. Header and
 *  separator rows are dropped. Reading the doc as DATA is the point: a list
 *  somebody hand-edited into it stops matching the code and this section fails. */
function docTableRows(): string[][] {
  return doc
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
}
const docRows = docTableRows();

/* THE STALE-DOC LEDGER IS CLOSED (2026-08-01). This file used to carry
 * STALE_DOC_CLAIMS — four recorded, bounded exemptions where the doc still held
 * sentences the code had outgrown (the weak_landing_cta row, the "none have no
 * evidence source" conclusion, and the three fixture-figure rows), each with its
 * exact replacement, plus I7 to keep the ledger honest. The doc has now been
 * edited: the recorded replacements are IN, the cold-audit claims are OUT, and
 * the fixture figures below are asserted byte-for-byte with no exemption
 * branch. A new mismatch is drift and fails I5 outright. */

check("I1 · the twelve intake questions in the doc ARE intakeFieldsForZeroInferred()", () => {
  const fields = intakeFieldsForZeroInferred();
  // The doc's question table is the one whose rows carry a backticked field name
  // that is a real ClientIntake key from the generated set.
  const wanted = new Map(fields.map((f) => [f.field as string, f]));
  const rows = docRows.filter((r) => r.length >= 4 && /^`[a-zA-Z]+`$/.test(r[2]) && wanted.has(r[2].replace(/`/g, "")));
  show("questions produced by the code", fields.length);
  show("question rows found in the doc ", rows.length);
  assert.equal(rows.length, fields.length, "the doc lists a different number of intake questions than the code produces");
  fields.forEach((f, i) => {
    const row = rows[i];
    show(`${i + 1}. ${f.field}`, `"${f.question}" → ${f.upgrades.join(", ")}`);
    assert.equal(row[2].replace(/`/g, ""), f.field, `row ${i + 1} names field "${row[2]}", the code says "${f.field}"`);
    assert.equal(row[1], f.question, `row ${i + 1} quotes the question differently from the intake form`);
    assert.equal(
      row[3],
      f.upgrades.join(", "),
      `row ${i + 1} lists the wrong leaks for "${f.field}" — the doc says "${row[3]}", the code says "${f.upgrades.join(", ")}"`
    );
  });
});

/**
 * I2 · WHAT CHANGED HERE, AND WHY THE OLD ASSERTION HAD TO GO.
 *
 * This check used to assert one thing about every in-scope leak with no intake
 * question: `evidenceClass === "OBSERVED"`. Its reasoning was the doc's — nothing
 * is left with NO evidence source, because a leak nobody is asked about is a leak
 * we measure ourselves. That was true of the code as it stood, and the code was
 * wrong: `weak_landing_cta` was declared OBSERVED and "measured" by a thirteen-
 * phrase regex over 1500 characters of markdown, which is how a law firm with a
 * tappable number in its header received "your phone number is buried" under the
 * words "Measured on your public pages".
 *
 * The leak is now classified INTERPRETIVE, so the old assertion fails — CORRECTLY.
 * Weakening it to "OBSERVED or INTERPRETIVE" would prove nothing at all, so the
 * replacement is strictly STRONGER: a question-less in-scope leak is either
 * something we measure (OBSERVED class, HARD checkability), or it is INTERPRETIVE,
 * and then FIVE structural consequences are asserted one at a time — the grade
 * ceiling, the most-provable-pool exclusion (targets AND selector output), the
 * advisory routing, and the absence of any pre-sale detectLeaks caller at all.
 * The old check proved one field on one leak; this proves the whole blast
 * radius, on a fixture where the leak actually FIRES.
 *
 * ONE CONSEQUENCE CHANGED SHAPE ON 2026-08-01. detectLeaks used to DROP
 * interpretive fires in pre_sale mode at runtime; that branch policed the free
 * cold-audit generator and was deleted with it (detectLeaks is mode-blind now —
 * its own doc comment says so). The surviving guarantee is structural instead:
 * NO pre-sale surface calls detectLeaks at all — the observed-facts row reads
 * toScrapeData directly and composes no findings — and that is asserted here at
 * SOURCE level, so the day somebody adds a pre-sale detectLeaks call site this
 * check names the file.
 */

/** A scrape shaped so `weak_landing_cta` genuinely fires: identical to the cold
 *  fixture above except the phone number is TYPED OUT rather than linked, so
 *  `/href=["']tel:/i` finds nothing and `hasClickToCallOnMobile` resolves ABSENT.
 *
 *  It exists so I2 is not vacuous. Asserting "the interpretive leak never reaches
 *  a pre-sale document" against data where it never fires in the first place is
 *  the shape of check that passes forever and guards nothing. */
const NO_TEL_HTML = COLD_HTML.replace(
  '<a class="btn" href="tel:+19025550117">902-555-0117</a>',
  "<span class=\"phone\">902-555-0117</span>"
);

const NO_TEL_SCRAPE: FirecrawlScrape = {
  used: true,
  homepage: {
    ...COLD_SCRAPE.homepage!,
    html: NO_TEL_HTML,
    rawHtml: NO_TEL_HTML,
  },
  subpages: [],
};

const NO_TEL_BUSINESS = {
  name: "Harbourline Air",
  industry: "HVAC",
  category: "HVAC contractor",
  city: "Dartmouth",
  phone: "902-555-0117",
  website: "https://harbourline-air.example",
  rating: 4.3,
  reviewCount: 38,
};

const NO_TEL_INTEL: AuditIntelligence = buildAuditIntelligence({
  websiteHtml: NO_TEL_HTML,
  hasWebsiteUrl: true,
  reviews: [],
  competitors: [],
  self: { rating: 4.3, reviewCount: 38 },
  verifiedFacts: null,
  performance: null,
  dataForSeo: null,
  screenshots: null,
});

check("I2 · a question-less leak is MEASURED, or it is INTERPRETIVE and barred from every pre-sale surface", () => {
  const noAsk = LEAKS.filter((l) => !l.intakeAsk);
  const inScope = noAsk.filter((l) => l.scope !== "out_of_scope");
  show("leaks with no intake question", noAsk.map((l) => l.id));
  show("of those, in scope           ", inScope.map((l) => l.id));
  for (const l of noAsk) {
    assert(
      doc.includes(`\`${l.id}\``),
      `${DOC_PATH} does not mention "${l.id}", which has no intake question behind it — the owner would not know it exists`
    );
  }

  // The detection the interpretive half is proved against: the cold fixture's
  // site with the phone number TYPED OUT rather than linked, so the leak
  // genuinely fires. detectLeaks is mode-blind since 2026-08-01 (the pre-sale
  // drop died with the audit generator), so ONE detection serves: what matters
  // is where a fire is ROUTED, plus consequence 5's proof that no pre-sale
  // caller exists to receive it.
  const fires = detectLeaks({
    mode: "post_intake",
    business: NO_TEL_BUSINESS,
    intel: NO_TEL_INTEL,
    scrape: NO_TEL_SCRAPE,
    asOf: SCAN_DATE,
  });
  show("no-tel scrape · hasClickToCallOnMobile", fires.data.website?.hasClickToCallOnMobile);
  assert.equal(
    fires.data.website?.hasClickToCallOnMobile,
    "ABSENT",
    "the no-tel fixture still fingerprints a tel: link — the interpretive half of this check would be vacuous"
  );

  // 5 (proved once, not per leak) · SOURCE — no pre-sale surface calls
  // detectLeaks at all. The one pre-sale consumer of the adapter is the
  // observed-facts row, which reads toScrapeData directly and composes no
  // findings; every detectLeaks call site in src/ is a post-intake surface.
  const srcFiles = allSrcFiles();
  const preSaleCallers = srcFiles.filter((rel) => {
    const code = codeOnly(rel);
    const i = code.indexOf("detectLeaks({");
    if (i < 0) return false;
    // A call site that passes the pre_sale discriminator anywhere in the file.
    return /detectLeaks\(\s*\{[^}]*mode:\s*"pre_sale"/.test(code);
  });
  show("src files calling detectLeaks", srcFiles.filter((rel) => codeOnly(rel).includes("detectLeaks(")).length);
  show("of those, pre-sale call sites", preSaleCallers.length ? preSaleCallers : "(none)");
  assert.deepEqual(
    preSaleCallers,
    [],
    `a PRE-SALE detectLeaks call site exists again: ${preSaleCallers.join(", ")}. detectLeaks no longer drops ` +
      "interpretive fires at runtime (that branch died with the cold audit), so a pre-sale caller would put a " +
      "judgment about a rendered page in front of a prospect with nothing left to stop it."
  );

  const interpretive: string[] = [];
  for (const l of inScope) {
    if (l.checkability === "INTERPRETIVE") {
      interpretive.push(l.id);
      // 1 · the grade ceiling: OBSERVED tier cannot buy the "measured" label.
      const graded = gradeOf({ tier: "OBSERVED", leak: l });
      show(`${l.id} · gradeOf(tier OBSERVED)`, graded);
      assert.notEqual(graded, "observed", `"${l.id}" can still be graded observed — that label prints "Measured on your public pages"`);
      // 2 · the leak is not in the most-provable (cold_audit-target) pool — the
      //     pool a pre-sale-shaped detection may fill, which is why an
      //     interpretive leak can never be listed in it.
      show(`${l.id} · deliverableTargets`, l.deliverableTargets);
      assert(
        !l.deliverableTargets.includes("cold_audit"),
        `"${l.id}" is still routed to the pre-sale-capable cold_audit pool — a judgment about a rendered page has no place there`
      );
      // 3 · it fires (non-vacuity) …
      const fired = fires.fired.some((f) => f.leak.id === l.id);
      show(`${l.id} · fires on the no-tel fixture`, fired);
      assert(fired, `"${l.id}" does not fire even on the no-tel fixture — nothing below is being tested`);
      // 4 · … and it is nowhere near the most-provable selection.
      assert(
        !fires.coldAudit.some((f) => f.leak.id === l.id),
        `"${l.id}" reached selectColdAudit's output — the most-provable selection the paid pack threads through as pre-call context`
      );
      // 5 · it routes to the advisory surface instead of being dropped silently.
      assert(
        fires.advisoryOnly.some((f) => f.leak.id === l.id),
        `"${l.id}" is filtered out of the findings and does NOT appear on the advisory surface — the leak has been silently deleted rather than reclassified`
      );
      continue;
    }
    assert.equal(
      l.evidenceClass,
      "OBSERVED",
      `"${l.id}" has no intake question, is not INTERPRETIVE, and is not something we observe — it now has no evidence source at all`
    );
    assert.equal(
      l.checkability,
      "HARD",
      `"${l.id}" claims to be observable but its checkability is not HARD`
    );
  }
  show("interpretive, therefore never measured", interpretive);
  show("advisory-only fires on the no-tel scan  ", fires.advisoryOnly.map((f) => f.leak.id));
});

check("I3 · the 60-day mapping printed in the doc IS NURTURE_SEQUENCE, step for step", () => {
  const rows = docRows.filter((r) => r.length === 4 && /^\d+$/.test(r[0]) && /^(Email|Text) \d+$/.test(r[1]));
  show("steps in the canvas", NURTURE_SEQUENCE.length);
  show("rows in the doc    ", rows.length);
  assert.equal(rows.length, NURTURE_SEQUENCE.length, "the doc prints a different number of nurture steps than the workflow has");
  NURTURE_SEQUENCE.forEach((s, i) => {
    const row = rows[i];
    assert.equal(Number(row[0]), s.step, `row ${i + 1} is step ${row[0]}, the canvas says ${s.step}`);
    assert.equal(row[1], `${s.channel} ${s.index}`, `row ${i + 1} names "${row[1]}", the canvas says "${s.channel} ${s.index}"`);
    assert.equal(Number(row[2]), s.day, `row ${i + 1} is day ${row[2]}, the canvas says ${s.day}`);
    assert.equal(row[3], s.purpose, `row ${i + 1} describes step ${s.step} differently from the canvas`);
  });
  const emails = NURTURE_SEQUENCE.filter((s) => s.channel === "Email").length;
  const texts = NURTURE_SEQUENCE.filter((s) => s.channel === "Text").length;
  const lastDay = Math.max(...NURTURE_SEQUENCE.map((s) => s.day));
  show("emails / texts / last day", `${emails} / ${texts} / ${lastDay}`);
  assert(
    doc.includes(`${NURTURE_SEQUENCE.length} steps, ${NURTURE_SEQUENCE.length} assets, ${lastDay} days`) ||
      doc.includes("Thirteen steps, thirteen assets, sixty days"),
    "the doc's summary sentence no longer matches the canvas"
  );
  assert.equal(emails, 7, "the email half is no longer seven messages — update the doc's summary sentence");
  assert.equal(texts, 6, "the text half is no longer six messages — update the doc's summary sentence");
  assert.equal(lastDay, 60, "the sequence no longer runs the full sixty days");
});

check("I4 · every command the doc tells the owner to run actually exists", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  const commands = Array.from(new Set(doc.match(/`npm run [a-z0-9:._-]+`/g) ?? [])).map((c) =>
    c.replace(/`|npm run /g, "")
  );
  show("commands named in the doc", commands);
  for (const c of commands) {
    assert(pkg.scripts[c], `${DOC_PATH} tells the owner to run "npm run ${c}", which is not in package.json`);
  }
  // And the one that matters most is wired into the chain.
  assert(
    pkg.scripts["verify:all"].includes("verify:phase4"),
    "verify:phase4 is not in the verify:all chain — the acceptance test does not run this file"
  );
  assert(pkg.scripts["fixtures:clients"], "the fixture-clients script is not wired into package.json");
});

check("I5 · the three fixture clients described in the doc are the ones on disk", () => {
  const dirs = [
    "01-pre-sale-cedar-ridge-plumbing",
    "02-full-intake-harbourline-electric",
    "03-toggled-pinecrest-roofing",
  ];
  for (const d of dirs) {
    assert(doc.includes(d), `${DOC_PATH} does not describe the fixture client "${d}"`);
    const path = `_fixtures/clients/${d}/pack.json`;
    if (!existsSync(resolve(REPO, path))) {
      // Not a failure of the document — a failure to have run the generator. Say
      // which command fixes it rather than leaving a bare ENOENT.
      throw new Error(`${path} is missing. Rebuild the fixtures with: npm run fixtures:clients`);
    }
    const pack = JSON.parse(read(path)) as {
      intelligence?: { leakAnalysis?: { evidenceGrade?: string }[] };
      meta: { internalTest?: boolean };
    };
    const leaks = pack.intelligence?.leakAnalysis ?? [];
    const count = (g: string) => leaks.filter((l) => (l.evidenceGrade ?? "inferred") === g).length;
    show(d, `${leaks.length} leaks · observed ${count("observed")} · disclosed ${count("disclosed")} · inferred ${count("inferred")}`);
    // Byte-for-byte against the sentence the owner reads, with NO exemption
    // branch: the stale-doc ledger this check used to consult is closed, so a
    // mismatch here is drift — re-run npm run fixtures:clients, then update the
    // table in section 4 of the doc.
    const sentence = `${leaks.length} leaks: **${count("observed")} observed, ${count("disclosed")} disclosed, ${count("inferred")} inferred**`;
    assert(
      doc.includes(sentence),
      `${DOC_PATH} does not quote "${sentence}" for "${d}". The committed pack and the doc's section-4 table disagree — ` +
        "one of them changed without the other."
    );
    // The pre-sale client is the one claim in the doc that is a promise rather
    // than a description, so it is asserted rather than merely quoted.
    if (d.startsWith("01-")) {
      assert.equal(count("disclosed"), 0, "the pre-sale fixture carries a disclosed leak — nothing has been disclosed");
      assert.equal(pack.meta.internalTest, true, "the pre-sale fixture is not flagged as generated without intake");
    } else {
      assert(count("disclosed") > 0, `"${d}" answered the intake form and nothing came back disclosed`);
      assert.notEqual(pack.meta.internalTest, true, `"${d}" has intake but is flagged as generated without it`);
    }
  }
});

// I6 — DELETED 2026-08-01. It re-asserted old sections A–G on the COMMITTED
// fixture cold audits (00-cold-audit.html / cold-audit.json). Those artifacts
// are deleted with their surface; the committed PACKS get the equivalent
// treatment in verify-fabrication B5/C7/E1, which run the full validator and
// the claim scans over every pack document on disk.

// I7 — DELETED 2026-08-01 with the ledger it audited. Every recorded stale
// claim was applied to the doc as part of the cold-audit deletion, so the
// exemptions are closed and I5 above runs with no escape branch.

/* ══════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
 * J. THE MONEY LAW, MECHANICALLY — the SOURCE, not just the rendered page.
 *
 * Section H already proves the RENDERED proposal carries no bare figure. This is
 * the complement: it reads the SOURCE of the prospect-facing files, so a new bare
 * "$" cannot be typed in the first place. H catches a bad value; J catches a bad
 * habit.
 *
 * WHY A SOURCE-LEVEL SCAN AND NOT ANOTHER SWEEP. Three separately hand-rolled
 * money formatters survived several deliberate passes over this codebase. They
 * survived for one reason: a literal "$" written in JSX text reads as PROSE, so
 * anything looking for a formatter CALL walks straight past it. That is how a
 * public proposal came to render "$6,500 CAD" beside an audit rendering
 * "CAD $1,290" — two documents, apparently from two companies, on the page where
 * a prospect decides to pay.
 *
 * The audit's math strings are already locked (verify-phase05 D1). This locks the
 * other half: the UI files a PROSPECT sees.
 *
 * SCOPE IS DELIBERATE AND NARROW, and the exclusions are stated rather than
 * silent. Kevin's own internal playbook page is excluded: it is his reading
 * material, and it legitimately contains prose ranges like "$300k–$3M revenue"
 * which are market sizing, not prices. Prompt strings are excluded for the same
 * reason — they instruct a model, they are not rendered. If either ever becomes
 * client-facing, add it here.
 * ══════════════════════════════════════════════════════════════════════════ */

section("J · THE MONEY LAW, MECHANICALLY — the SOURCE, not just the rendered page");

check("J1 · every rendered dollar figure a prospect can see carries the CAD marker", () => {
  // The two genuinely public surfaces, plus the operator screens that print a
  // price beside an audit figure — the exact place a mismatch is noticed.
  const FILES = [
    "src/components/proposals/PublicProposal.tsx",
    // src/app/a/[publicId]/page.tsx was scanned here until the teaser was
    // deleted with the cold audit (2026-08-01).
    "src/app/(dashboard)/proposals/page.tsx",
    "src/app/(dashboard)/library/page.tsx",
    "src/app/(dashboard)/businesses/[id]/page.tsx",
    "src/app/(dashboard)/crm/page.tsx",
  ];
  const offenders: string[] = [];
  for (const rel of FILES) {
    const abs = resolve(REPO, rel);
    if (!existsSync(abs)) {
      offenders.push(`${rel}: file not found — the scan cannot vouch for a path that moved`);
      continue;
    }
    const lines = readFileSync(abs, "utf8").split("\n");

    // A trailing "$" whose figure sits on the NEXT line is invisible to a
    // line-by-line scan, and one real violation was written exactly that way:
    // JSX wrapping left `· $` at the end of one line and `{stats.pipelineMRR}`
    // at the start of the next. It CANNOT be closed by joining the lines first —
    // that produces `${`, which is exactly the template-placeholder form the scan
    // is meant to skip, so the join would hide the bug instead of finding it. It
    // is its own rule: in JSX, a line ending in a bare "$" with an expression
    // opening the next line is always this mistake.
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
      if (/\$$/.test(t) && /^\{/.test((lines[i + 1] ?? "").trim())) {
        offenders.push(`${rel}:${i + 1} → (figure wraps to the next line) ${t.slice(-60)}`);
      }
    });

    lines
      .forEach((line, i) => {
        // Skip comment lines — including JSX comments, which is how a line
        // EXPLAINING a past violation ("this printed a raw $1000/mo") gets
        // flagged as one. The comment is the fix's own documentation.
        const t = line.trim();
        if (
          t.startsWith("//") ||
          t.startsWith("*") ||
          t.startsWith("/*") ||
          t.startsWith("{/*")
        )
          return;
        for (let j = 0; j < line.length; j++) {
          if (line[j] !== "$") continue;
          if (line[j + 1] === "{") continue; // a template placeholder, not a sign
          if (line[j - 1] === "\\") continue; // escaped
          if (line.slice(Math.max(0, j - 4), j) === "CAD ") continue; // already marked
          // Only a "$" immediately followed by a digit or an interpolation is a
          // rendered figure. A lone "$" in prose is not money.
          if (!/^\$\s*(\d|\$\{)/.test(line.slice(j))) continue;
          offenders.push(`${rel}:${i + 1} → ${t.slice(0, 78)}`);
        }
      });
  }
  show("files scanned", FILES.length);
  show("unmarked figures", offenders.length ? offenders.slice(0, 8) : "(none)");
  assert.equal(
    offenders.length,
    0,
    `${offenders.length} unmarked dollar figure(s) on a prospect-facing surface:\n  ${offenders
      .slice(0, 8)
      .join("\n  ")}\nRoute it through formatCurrency (src/lib/utils.ts). The marker goes BEFORE the figure.`
  );
});

check("J2 · the scan is not vacuous — it CATCHES an unmarked figure", () => {
  // Same predicate, run over a line that is deliberately wrong. Without this, H1
  // would keep passing if the matcher silently stopped matching anything.
  const bad = `          <KpiCard label="Closed MRR" value={\`$\${closedMRR.toLocaleString()}\`} />`;
  const good = `          <KpiCard label="Closed MRR" value={formatCurrency(closedMRR)} />`;
  const flags = (line: string): boolean => {
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== "$") continue;
      if (line[j + 1] === "{") continue;
      if (line[j - 1] === "\\") continue;
      if (line.slice(Math.max(0, j - 4), j) === "CAD ") continue;
      if (!/^\$\s*(\d|\$\{)/.test(line.slice(j))) continue;
      return true;
    }
    return false;
  };
  show("flags the hand-built form", flags(bad));
  show("passes the formatter form ", !flags(good));
  assert(flags(bad), "the matcher no longer catches a hand-built money string — H1 proves nothing");
  assert(!flags(good), "the matcher flags a correct formatCurrency call — it would block the fix");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    "\nThis suite is the Phase 4 acceptance test on the SURVIVING surfaces: the public proposal\n" +
      "carries the money law everywhere a prospect can see, and docs/final-verification.md says\n" +
      "nothing the code has outgrown. A failure here means a prospect-facing page or the owner's\n" +
      "own document is claiming something we cannot stand behind.\n"
  );
  process.exit(1);
}
console.log("\nALL CHECKS PASSED\n");
