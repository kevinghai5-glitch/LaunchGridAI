// Verifies the call-queue CSV export and the operator-chosen batch size.
// Run: node_modules/.bin/tsx scripts/verify-export.ts
//
// Both features fail SILENTLY and expensively if they're wrong: a malformed CSV
// gets rejected (or worse, half-accepted) by GHL after he's already started
// dialing, and a batch-size bug shows up as "I asked for 77 and got 30" with no
// error anywhere. So every rule that can be checked without a network is checked
// here rather than left to be noticed on a Tuesday morning.

import {
  csvCell,
  normalizePhone,
  splitOwnerName,
  buildCallQueueCsv,
  exportFilename,
  CSV_HEADERS,
  type ExportLead,
} from "../src/lib/call-queue-csv";
import { clampBatchSize, MIN_BATCH_SIZE, MAX_BATCH_SIZE, DAILY_BATCH_SIZE } from "../src/lib/crm";
import { QUEUE_LIMIT } from "../src/lib/call-queue";
import { timezoneForCity, METRO_TIMEZONES, metroCallTier } from "../src/lib/call-timing";
import { dateKeyOf, parseQueueParams } from "../src/lib/call-queue-query";
import { readFileSync } from "fs";
import { join } from "path";

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    pass++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  check(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const ROOT = join(__dirname, "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

// ── A · Phone normalization (the field the dialer cannot work without) ────────

eq("A1 national US format → E.164", normalizePhone("(416) 555-0123"), "+14165550123");
eq("A2 bare 10 digits → E.164", normalizePhone("4165550123"), "+14165550123");
eq("A3 leading 1, 11 digits → E.164", normalizePhone("1-416-555-0123"), "+14165550123");
eq("A4 already E.164 passes through", normalizePhone("+14165550123"), "+14165550123");
eq("A5 international keeps its own country code", normalizePhone("+44 20 7946 0958"), "+442079460958");
eq("A6 empty → null", normalizePhone(""), null);
eq("A7 null → null", normalizePhone(null), null);
eq("A8 too few digits → null", normalizePhone("555-0123"), null);
eq("A9 junk → null", normalizePhone("call the shop"), null);
eq("A10 9 digits is not silently padded", normalizePhone("416555012"), null);
// A wrong country code is worse than no number: it dials a stranger.
eq("A11 11 digits NOT starting with 1 → null", normalizePhone("24165550123"), null);
eq("A12 over-long digit run → null", normalizePhone("+1234567890123456"), null);
eq("A13 extension noise is stripped, not guessed", normalizePhone("416.555.0123"), "+14165550123");

// ── B · CSV encoding (RFC 4180) ──────────────────────────────────────────────

eq("B1 plain value unquoted", csvCell("Acme Plumbing"), "Acme Plumbing");
eq("B2 comma forces quotes", csvCell("Acme, Inc"), '"Acme, Inc"');
eq("B3 embedded quote is doubled", csvCell('The "Best" Shop'), '"The ""Best"" Shop"');
eq("B4 newline forces quotes", csvCell("line one\nline two"), '"line one\nline two"');
eq("B5 carriage return forces quotes", csvCell("a\rb"), '"a\rb"');
eq("B6 null → empty", csvCell(null), "");
eq("B7 undefined → empty", csvCell(undefined), "");
eq("B8 number renders", csvCell(42), "42");
// A real zero must survive: "0 reviews" is a finding, blank is a missing value.
eq("B9 numeric zero renders as 0, not blank", csvCell(0), "0");
eq("B10 tab forces quotes", csvCell("a\tb", false), '"a\tb"');

// ── C · Formula injection (he opens these in Sheets) ─────────────────────────

eq("C1 = is neutralized", csvCell("=1+1"), "'=1+1");
eq("C2 + is neutralized", csvCell("+1 special offer"), "'+1 special offer");
eq("C3 - is neutralized", csvCell("-50% response rate"), "'-50% response rate");
eq("C4 @ is neutralized", csvCell("@handle"), "'@handle");
eq("C5 tab is neutralized", csvCell("\tsneaky"), '"\'\tsneaky"');
eq("C6 neutralized AND quoted when it also has a comma", csvCell("=cmd|calc,x"), "\"'=cmd|calc,x\"");
// The whole reason csvCell takes a flag: E.164 always starts with "+", and a
// leading apostrophe on the Phone column would break the import it exists for.
eq("C7 trusted column is NOT neutralized", csvCell("+14165550123", false), "+14165550123");
eq("C8 trusted column still gets RFC quoting", csvCell("a,b", false), '"a,b"');

// ── D · Owner name split ─────────────────────────────────────────────────────

eq("D1 first + last", JSON.stringify(splitOwnerName("Dana Whitfield")), JSON.stringify({ first: "Dana", last: "Whitfield" }));
eq("D2 single token → first only", JSON.stringify(splitOwnerName("Dana")), JSON.stringify({ first: "Dana", last: "" }));
eq("D3 multi-part surname kept whole", JSON.stringify(splitOwnerName("Mary Anne Van Der Berg")), JSON.stringify({ first: "Mary", last: "Anne Van Der Berg" }));
eq("D4 null → blanks", JSON.stringify(splitOwnerName(null)), JSON.stringify({ first: "", last: "" }));
eq("D5 whitespace-only → blanks", JSON.stringify(splitOwnerName("   ")), JSON.stringify({ first: "", last: "" }));

// ── E · Whole-file build ─────────────────────────────────────────────────────

const lead = (over: Partial<ExportLead> = {}): ExportLead => ({
  id: "biz_1",
  name: "Northside Plumbing",
  phone: "(416) 555-0123",
  website: "https://northside.example",
  city: "Toronto",
  address: "12 King St W, Toronto, ON",
  industry: "Plumber",
  status: "QUEUED",
  dialStatus: "fresh",
  nextAction: "Cold call",
  attemptCount: 0,
  rating: 4.6,
  reviewCount: 38,
  mapsUrl: "https://maps.example/1",
  painPoint: "38 reviews vs a competitor's 210",
  outreachAngle: "Noticed you're at 38 reviews while Bright Plumbing shows 210",
  ownerName: "Dana Whitfield",
  ...over,
});

const built = buildCallQueueCsv([lead()], "2026-08-05");
const lines = built.csv.split("\r\n").filter(Boolean);

eq("E1 header + one row", lines.length, 2);
eq("E2 row count reported", built.rowCount, 1);
eq("E3 nothing skipped", built.skippedNoPhone, 0);
check("E4 CRLF line endings", built.csv.includes("\r\n"), "RFC 4180 requires CRLF");
check("E5 file ends with a newline", built.csv.endsWith("\r\n"));
eq("E6 header row matches CSV_HEADERS", lines[0], CSV_HEADERS.join(","));
check("E7 Phone header present and exactly once", CSV_HEADERS.filter((h) => h === "Phone").length === 1);
check("E8 no BOM (naive parsers read it into the first header)", !built.csv.startsWith("﻿"));

// Every row must have exactly as many fields as the header. Split respecting
// quotes, because angles and addresses legitimately contain commas.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const cells = splitCsvLine(lines[1]);
eq("E9 row field count matches header", cells.length, CSV_HEADERS.length);

const at = (h: string): string => cells[CSV_HEADERS.indexOf(h)];
eq("E10 phone is dialable E.164", at("Phone"), "+14165550123");
eq("E11 owner first name", at("First Name"), "Dana");
eq("E12 owner last name", at("Last Name"), "Whitfield");
eq("E13 business name", at("Business Name"), "Northside Plumbing");
eq("E14 timezone resolved from the metro", at("Time Zone"), "America/Toronto");
eq("E15 lead id round-trips", at("Lead ID"), "biz_1");
check("E16 tags carry the export date", at("Tags").includes("2026-08-05"), at("Tags"));
eq("E16b dial status is a labelled column", at("Dial Status"), "Fresh");
check(
  "E16c a leaked do_not_call is visible in the file",
  buildCallQueueCsv([lead({ dialStatus: "do_not_call" })], "2026-08-05").csv.includes("Do not call"),
  "a non-fresh business in an export must show its flag in the Dial Status column"
);

// A comma inside the angle must survive the round-trip intact — this is the
// single most likely way a real file breaks, since every angle is a sentence.
const commaAngle = "Noticed you're at 38 reviews, while Bright shows 210";
const withComma = buildCallQueueCsv([lead({ outreachAngle: commaAngle })], "2026-08-05");
const commaCells = splitCsvLine(withComma.csv.split("\r\n")[1]);
eq("E17 comma inside a field survives", commaCells[CSV_HEADERS.indexOf("Call Angle")], commaAngle);
eq("E18 comma field does not shift the row", commaCells.length, CSV_HEADERS.length);

// A quoted business name — Places returns these.
const quoteName = 'Bob\'s "Fast" Plumbing, Ltd';
const withQuote = buildCallQueueCsv([lead({ name: quoteName })], "2026-08-05");
const quoteCells = splitCsvLine(withQuote.csv.split("\r\n")[1]);
eq("E19 quotes inside a field survive", quoteCells[CSV_HEADERS.indexOf("Business Name")], quoteName);

// ── F · Phone-less rows are skipped, never emitted blank ─────────────────────

const mixed = buildCallQueueCsv(
  [lead({ id: "a" }), lead({ id: "b", phone: null }), lead({ id: "c", phone: "nope" }), lead({ id: "d" })],
  "2026-08-05"
);
eq("F1 only dialable rows written", mixed.rowCount, 2);
eq("F2 skipped count reported", mixed.skippedNoPhone, 2);
const mixedLines = mixed.csv.split("\r\n").filter(Boolean);
eq("F3 file has header + 2 rows", mixedLines.length, 3);
check(
  "F4 no row carries an empty Phone",
  mixedLines.slice(1).every((l) => splitCsvLine(l)[CSV_HEADERS.indexOf("Phone")].length > 0)
);

// ── G · Time zone lookup never guesses ───────────────────────────────────────

eq("G1 short city resolves", timezoneForCity("Toronto"), "America/Toronto");
eq("G2 full metro resolves", timezoneForCity("Los Angeles, CA"), "America/Los_Angeles");
eq("G3 case-insensitive", timezoneForCity("PHOENIX"), "America/Phoenix");
// "Saskatoon" used to be the fictional city here. It became a real metro when the
// rotation expanded to 128, and the check started failing — correctly. The
// replacement cannot become real: it is not a place.
eq("G4 unknown city → blank, never a guess", timezoneForCity("Zzyzx Prime"), "");
eq("G4b …and an empty city is blank too", timezoneForCity(""), "");
eq("G5 null → blank", timezoneForCity(null), "");
eq("G6 empty → blank", timezoneForCity(""), "");
check(
  "G7 every rotation metro resolves (a blank here means a silently untimed lead)",
  Object.keys(METRO_TIMEZONES).every((m) => timezoneForCity(m.split(",")[0]) !== "")
);

// ── H · Filename carries the date ────────────────────────────────────────────

eq("H1 dated filename", exportFilename("2026-08-05"), "call-queue-2026-08-05.csv");
eq("H2 malformed date is not interpolated", exportFilename("garbage"), "call-queue-undated.csv");
eq("H3 path traversal cannot reach the filename", exportFilename("../../etc/passwd"), "call-queue-undated.csv");
check("H4 filename is quote-safe for Content-Disposition", !exportFilename("2026-08-05").includes('"'));

// dateKeyOf must use LOCAL parts. toISOString() would roll a 7pm ET export into
// the next day, filing the evening's list under tomorrow's date.
const evening = new Date(2026, 7, 5, 21, 30, 0);
eq("H5 local date key at 9:30pm stays on the same day", dateKeyOf(evening), "2026-08-05");
eq("H6 date key zero-pads", dateKeyOf(new Date(2026, 0, 9, 12, 0, 0)), "2026-01-09");

// ── I · Query parsing (export and screen must resolve the same view) ─────────

const now = new Date(2026, 7, 5, 12, 0, 0);
eq("I1 no params → today", parseQueueParams(new URLSearchParams(""), now).view, "today");
eq("I2 past date → past view", parseQueueParams(new URLSearchParams("date=2026-08-01"), now).view, "past");
eq("I3 future date → upcoming view", parseQueueParams(new URLSearchParams("date=2026-08-09"), now).view, "upcoming");
eq("I4 today's date → today view", parseQueueParams(new URLSearchParams("date=2026-08-05"), now).view, "today");
eq("I5 explicit view wins over date", parseQueueParams(new URLSearchParams("date=2026-08-01&view=today"), now).view, "today");
eq("I6 malformed date ignored", parseQueueParams(new URLSearchParams("date=nonsense"), now).view, "today");
eq("I7 dateKey defaults to today", parseQueueParams(new URLSearchParams(""), now).dateKey, "2026-08-05");
eq("I8 dateKey echoes the requested day", parseQueueParams(new URLSearchParams("date=2026-08-01"), now).dateKey, "2026-08-01");

// ── J · Batch size clamping ──────────────────────────────────────────────────

eq("J1 in-range passes", clampBatchSize(77), 77);
eq("J2 numeric string passes", clampBatchSize("77"), 77);
eq("J3 above ceiling clamps", clampBatchSize(9999), MAX_BATCH_SIZE);
eq("J4 below floor clamps", clampBatchSize(0), MIN_BATCH_SIZE);
eq("J5 negative clamps", clampBatchSize(-5), MIN_BATCH_SIZE);
eq("J6 fractional floors", clampBatchSize(77.9), 77);
// A typo must not cost a generation — fall back, never throw.
eq("J7 empty string → default", clampBatchSize(""), DAILY_BATCH_SIZE);
eq("J8 non-numeric → default", clampBatchSize("abc"), DAILY_BATCH_SIZE);
eq("J9 null → default", clampBatchSize(null), DAILY_BATCH_SIZE);
eq("J10 undefined → default", clampBatchSize(undefined), DAILY_BATCH_SIZE);
eq("J11 NaN → default", clampBatchSize(NaN), DAILY_BATCH_SIZE);
eq("J12 Infinity → default", clampBatchSize(Infinity), DAILY_BATCH_SIZE);

// The queue cap has to sit ABOVE the biggest batch, or approving a full
// generation silently truncates both the screen and the CSV — the exact bug
// that made a 30-lead cap invisible until a 77-lead day.
check(
  "J13 QUEUE_LIMIT exceeds MAX_BATCH_SIZE",
  QUEUE_LIMIT > MAX_BATCH_SIZE,
  `QUEUE_LIMIT=${QUEUE_LIMIT}, MAX_BATCH_SIZE=${MAX_BATCH_SIZE}`
);

// ── K · The calling-window gate still holds at any batch size ────────────────

// 6pm ET on a DST date: Eastern (18) and Central (17) are shut; Mountain (16)
// is peak and Pacific (15) is open. Batch size must not enter into this.
const sixPmEt = new Date("2026-08-05T22:00:00Z");
eq("K1 Eastern shut at 6pm ET", metroCallTier("New York, NY", sixPmEt), 0);
eq("K2 Central shut at 5pm local", metroCallTier("Chicago, IL", sixPmEt), 0);
eq("K3 Mountain at peak", metroCallTier("Denver, CO", sixPmEt), 2);
eq("K4 Pacific open", metroCallTier("Los Angeles, CA", sixPmEt), 1);
// 10:30am ET: Pacific is 7:30am — before the 8am floor.
const tenThirtyEt = new Date("2026-08-05T14:30:00Z");
eq("K5 Pacific shut at 10:30am ET", metroCallTier("Los Angeles, CA", tenThirtyEt), 0);
eq("K6 Eastern at peak at 10:30am ET", metroCallTier("New York, NY", tenThirtyEt), 2);

// ── L · Source guarantees the type system can't express ──────────────────────

const prospects = read("src/lib/daily-prospects.ts");
// The gate is a promise about WHICH cities are dialed, and a short batch must
// never be padded from closed ones. If a future edit swaps the ordered list for
// the raw metro list, that promise breaks silently.
check(
  "L1 sourcing loop walks the call-time-ordered metros",
  /orderedMetros\s*=\s*ordering\.metros/.test(prospects) &&
    /i\s*<\s*orderedMetros\.length/.test(prospects),
  "the metro loop must iterate the ordered (gated) list, not NA_METROS"
);
check(
  "L2 no un-gated NA_METROS iteration in the sourcing loop",
  !/for\s*\([^)]*of\s+NA_METROS/.test(prospects) && !/i\s*<\s*NA_METROS\.length/.test(prospects)
);
// Photos are billed per place; hydrating before the scoring cut is money spent
// on rows that get discarded.
check(
  "L3 search runs with photo hydration OFF",
  /resolvePhotos:\s*false/.test(prospects)
);
check(
  "L4 photos hydrated only after the slice",
  prospects.indexOf("hydratePhotoUrls(ranked)") > prospects.indexOf(".slice(0, count)"),
  "hydratePhotoUrls must run on the ranked+sliced survivors"
);

const generateRoute = read("src/app/api/opportunities/generate/route.ts");
check("L5 generate route clamps the operator's count", /clampBatchSize\(body\?\.count\)/.test(generateRoute));
check("L6 generate route passes the count through", /gatherProspects\(niche,\s*exclude,\s*requested/.test(generateRoute));
check(
  "L7 generate route reports requested vs sourced",
  /requested,/.test(generateRoute) && /sourced:\s*prospects\.length/.test(generateRoute)
);

const exportRoute = read("src/app/api/call-queue/export/route.ts");
check("L8 export sets a CSV content type", /text\/csv/.test(exportRoute));
check("L9 export sets an attachment filename", /Content-Disposition[\s\S]{0,60}attachment/.test(exportRoute));
check("L10 export is session-scoped", /getServerSession/.test(exportRoute) && /session\.user\.id/.test(exportRoute));
// Item 1 INVERTED the old "export is read-only" rule: exporting IS dialing, so
// download flips the batch to "dialed". These pin the new contract instead.
check(
  "L11 export marks the batch dialed on download",
  /recordDialStatusBulk/.test(exportRoute) && /status:\s*"dialed"/.test(exportRoute),
  "the export must set dialStatus=dialed so the generator never re-serves a dialed business"
);
check(
  "L11b export never demotes a permanent status",
  /isGeneratable\(b\.dialStatus\)\s*\|\|\s*b\.dialStatus === "dialed"/.test(exportRoute),
  "only fresh/dialed may be flipped — booked/not_interested/do_not_call must be left alone"
);
check(
  "L11c a mutating export is POST, not a prefetchable GET",
  /export async function POST/.test(exportRoute) && !/export async function GET/.test(exportRoute)
);
check(
  "L12 export reuses the shared selection (cannot drift from the screen)",
  /selectQueueLeads/.test(exportRoute)
);

const queueRoute = read("src/app/api/call-queue/route.ts");
check(
  "L13 screen route uses the same shared selection",
  /selectQueueLeads/.test(queueRoute)
);

// ── M · Leads appear from ONE place: the Generate button ─────────────────────
//
// Picking a niche used to PATCH action:"restore" — un-deleting every cleared
// lead for that niche and rendering them. A chip click then looked exactly like
// a generation nobody asked for, at a size the count box never set. These pin
// the boundary: selection is inert, generation is the only producer.

// Strip comments before scanning. These checks assert the ABSENCE of certain
// calls, and the comments explaining why they're absent name those very calls —
// a scan that reads its own documentation as evidence proves nothing. The `:`
// guard keeps "https://" in string literals from being eaten as a comment.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const opportunitiesPage = stripComments(read("src/app/(dashboard)/businesses/page.tsx"));

// Isolate selectNiche's body so the assertions can't be satisfied (or broken)
// by unrelated code elsewhere in a 2,500-line file.
const selectNicheBody = /const selectNiche =[\s\S]*?\n  \};/.exec(opportunitiesPage)?.[0] ?? "";
check("M1 selectNiche exists", selectNicheBody.length > 0);
check(
  "M2 selecting a niche makes no network call",
  !/fetch\(/.test(selectNicheBody),
  "picking a niche must not hit the API — it only chooses what to generate next"
);
check(
  "M3 selecting a niche never restores cleared leads",
  !/restore/.test(selectNicheBody),
  'a chip click must not un-delete rows the operator Cleared'
);
check(
  "M4 selecting a niche does not populate the list",
  !/setSuggestions|setActiveNiche/.test(selectNicheBody),
  "only a generation may put leads on screen"
);
// The chip is its own reset: clicking the selected one clears it. There is no
// separate Reset control, and adding one back would be redundant chrome.
check(
  "M4b clicking the selected chip deselects it",
  /prev === n \? "" : n/.test(selectNicheBody),
  "re-clicking an active niche must clear the selection"
);

// Opening the page must not render a leftover batch. The API's default GET (no
// ?niche) returns the most recently generated niche's live leads — piping that
// straight into the list made a days-old test run look like a generation the
// operator never triggered, at a size the count box never set.
check(
  "M8 there is no loadDaily",
  !/const loadDaily\s*=/.test(opportunitiesPage),
  "page load must not fetch the daily list at all"
);
check("M9 there is no resumeBatch", !/const resumeBatch\s*=/.test(opportunitiesPage));
check(
  "M10 nothing on this page restores cleared leads",
  !/action:\s*["']restore["']/.test(opportunitiesPage),
  "un-deleting cleared rows is what resurrected a test batch as a fake generation"
);
check(
  "M11 the mount effect loads saved businesses only",
  /useEffect\(\(\) => \{\s*loadSaved\(\);\s*\}, \[\]\);/.test(opportunitiesPage),
  "the mount effect must not touch the prospect list"
);

// ── The hard gate ────────────────────────────────────────────────────────────
// Absence-of-code is not enough by itself: this rule has now been broken twice
// by ADDING a line somewhere else. The render boundary is locked behind a flag
// only a successful generate() sets, so a third path cannot display anything
// either — even if it manages to fill the state.
check(
  "M13 the gate flag exists",
  /const \[generatedThisSession, setGeneratedThisSession\] = useState\(false\)/.test(opportunitiesPage)
);
check(
  "M14 the list renders through the gate",
  /suggestions=\{generatedThisSession \? suggestions : \[\]\}/.test(opportunitiesPage),
  "DailyView must receive an empty array until a generation has happened"
);
check(
  "M15 the top-bar count is behind the same gate",
  /generatedThisSession && activeNiche/.test(opportunitiesPage),
  "a lead count in the header is a business appearing on screen too"
);
// Exactly one setter. More than one means the gate leaks.
const gateOpens = (opportunitiesPage.match(/setGeneratedThisSession\(true\)/g) ?? []).length;
eq("M16 the gate opens in exactly one place", gateOpens, 1);
const generateBody = /const generate = async[\s\S]*?\n  \};/.exec(opportunitiesPage)?.[0] ?? "";
check("M17 that one place is generate()", /setGeneratedThisSession\(true\)/.test(generateBody));

// generate puts leads ON screen; clearBatch + triage take them off.
const ALLOWED_SETTERS = ["generate", "clearBatch", "triage"];
// Resolve each call site's enclosing handler by walking BACK to the nearest
// top-level `const name = ` declaration — splitting the file into blocks
// misattributes the first chunk.
const setterOwners: string[] = [];
const declRe = /\n  const (\w+) = /g;
const decls: { name: string; at: number }[] = [];
for (let m = declRe.exec(opportunitiesPage); m; m = declRe.exec(opportunitiesPage)) {
  decls.push({ name: m[1], at: m.index });
}
const callRe = /setSuggestions\(/g;
for (let m = callRe.exec(opportunitiesPage); m; m = callRe.exec(opportunitiesPage)) {
  let owner = "(top level)";
  for (const d of decls) {
    if (d.at < m.index) owner = d.name;
    else break;
  }
  if (!setterOwners.includes(owner)) setterOwners.push(owner);
}
check("M12a the scan found call sites", setterOwners.length > 0);
check(
  "M12b only generate / clearBatch / triage may touch the list",
  setterOwners.every((n) => ALLOWED_SETTERS.includes(n)),
  `setSuggestions is called from: ${setterOwners.join(", ")}`
);

// ── N · A run returns what was asked for, not the niche's backlog ────────────
// Generation APPENDS to a niche's SUGGESTED rows. Returning the whole niche
// meant a 77-run against a niche holding 30 old test leads answered with 107.
check(
  "N1 the run's response is scoped to the Place IDs it just created",
  /googlePlaceId:\s*\{\s*in:\s*createdPlaceIds\s*\}/.test(generateRoute),
  "the response must not re-query the niche's whole un-triaged backlog"
);
check(
  "N2 those IDs come from this run's prospects",
  /const createdPlaceIds = prospects\.map\(\(p\) => p\.placeId\)\.filter\(Boolean\)/.test(generateRoute)
);

// Whatever else changes, the count the button sends must come from the box.
check(
  "M5 generate sends the operator's count",
  /body:\s*JSON\.stringify\(\{\s*niche:\s*target,\s*count\s*\}\)/.test(opportunitiesPage),
  "the POST body must carry the clamped count from the input"
);
check(
  "M6 the count is read from the input, not a constant",
  /const count = clampBatchSize\(batchCount\)/.test(opportunitiesPage)
);
// The niche chips must select, never generate.
check(
  "M7 niche chips call selectNiche, not generate",
  /onClick=\{\(\) => selectNiche\(n\)\}/.test(opportunitiesPage) &&
    !/onClick=\{\(\) => generate\(n\)\}/.test(opportunitiesPage)
);

// ── Report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`\n✗ verify-export: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-export: ${pass} assertions passed`);
