// Verifies the dial-status / do-not-call axis at the SOURCE level — the pure
// guards plus the wiring in the generation gate and the schema. Hermetic: no DB,
// so it runs on a fresh clone. The live "mark do_not_call → generate → prove it
// never appears" proof is a separate DB demonstration (scripts/prove-dnc.ts).
// Run: node_modules/.bin/tsx scripts/verify-dial-status.ts

import {
  DIAL_STATUSES,
  GENERATABLE_DIAL_STATUSES,
  PERMANENT_DIAL_STATUSES,
  EXCEPTION_DIAL_STATUSES,
  DIAL_STATUS_META,
  isGeneratable,
  isPermanent,
  canSetFromUi,
  resurfacesIntoFreshBatch,
  type DialStatus,
} from "../src/lib/dial-status";

// A cooled-down, live, DECLINED business of the given dial status — the ONLY
// shape that could resurface. Only "fresh" should actually come back.
function resurfacesIntoFreshBatchProbe(dialStatus: string): boolean {
  const longAgo = new Date(Date.now() - 200 * 86_400_000);
  const cutoff = new Date(Date.now() - 90 * 86_400_000);
  return resurfacesIntoFreshBatch(
    { dialStatus, status: "DECLINED", declinedAt: longAgo, deletedAt: null },
    cutoff
  );
}
import { readFileSync } from "fs";
import { join } from "path";

let pass = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
function eq(name: string, a: unknown, b: unknown): void {
  check(name, Object.is(a, b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
const ROOT = join(__dirname, "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

// ── A · The vocabulary ───────────────────────────────────────────────────────
eq("A1 six statuses", DIAL_STATUSES.length, 6);
for (const s of ["fresh", "dialed", "not_interested", "do_not_call", "booked", "disqualified"]) {
  check(`A2 has ${s}`, DIAL_STATUSES.includes(s as DialStatus));
}
for (const s of DIAL_STATUSES) {
  check(`A3 ${s} has badge meta`, Boolean(DIAL_STATUS_META[s]));
}

// ── B · Only fresh is generatable ────────────────────────────────────────────
eq("B1 exactly one generatable status", GENERATABLE_DIAL_STATUSES.length, 1);
check("B2 fresh is generatable", isGeneratable("fresh"));
for (const s of ["dialed", "not_interested", "do_not_call", "booked", "disqualified"]) {
  check(`B3 ${s} is NOT generatable`, !isGeneratable(s));
}
// A missing/legacy value defaults to fresh (backfill contract).
check("B4 null defaults to generatable (fresh backfill)", isGeneratable(null));
check("B5 undefined defaults to generatable", isGeneratable(undefined));

// ── C · Permanence ───────────────────────────────────────────────────────────
for (const s of ["not_interested", "do_not_call", "booked", "disqualified"]) {
  check(`C1 ${s} is permanent`, isPermanent(s));
}
check("C2 fresh is not permanent", !isPermanent("fresh"));
// The retryability guarantee: a no-answer must NOT be permanent.
check("C3 dialed is NOT permanent (stays retryable)", !isPermanent("dialed"));

// ── D · do_not_call is irreversible from the UI ──────────────────────────────
check(
  "D1 nothing can transition OUT of do_not_call in the UI",
  !canSetFromUi("do_not_call", "fresh").ok &&
    !canSetFromUi("do_not_call", "dialed").ok &&
    !canSetFromUi("do_not_call", "not_interested").ok &&
    !canSetFromUi("do_not_call", "booked").ok
);
check("D2 the block explains why", Boolean(canSetFromUi("do_not_call", "fresh").reason));
// Setting do_not_call is allowed from any live state.
check("D3 fresh → do_not_call allowed", canSetFromUi("fresh", "do_not_call").ok);
check("D4 dialed → do_not_call allowed", canSetFromUi("dialed", "do_not_call").ok);
check("D5 dialed → not_interested allowed", canSetFromUi("dialed", "not_interested").ok);
check("D6 fresh → booked allowed", canSetFromUi("fresh", "booked").ok);
check("D7 unknown target rejected", !canSetFromUi("fresh", "nonsense" as DialStatus).ok);

// ── E · The exception logger's three actions ─────────────────────────────────
eq("E1 three exception actions", EXCEPTION_DIAL_STATUSES.length, 3);
for (const s of ["not_interested", "do_not_call", "booked"]) {
  check(`E2 logger can set ${s}`, EXCEPTION_DIAL_STATUSES.includes(s as DialStatus));
}
check("E3 logger cannot set fresh", !EXCEPTION_DIAL_STATUSES.includes("fresh"));
check("E4 logger cannot set dialed", !EXCEPTION_DIAL_STATUSES.includes("dialed"));

// ── F · The generation gate wiring ───────────────────────────────────────────
const generateRoute = read("src/app/api/opportunities/generate/route.ts");
check(
  "F1 generate route selects dialStatus",
  /select:\s*\{[^}]*dialStatus:\s*true/.test(generateRoute)
);
check(
  "F2 generation uses the shared resurface predicate",
  /resurfacesIntoFreshBatch\(b, cooldownCutoff\)/.test(generateRoute),
  "the generator and the proof must share one exclusion rule"
);
// The compliance guarantee, at the source: the ONLY way a placeId is NOT excluded
// is the shared predicate returning true, and that predicate requires
// isGeneratable. So do_not_call can never fall out of the exclude set.
check(
  "F3 exclude is the default; resurface is the narrow exception",
  /if \(!resurfacesIntoFreshBatch\(b, cooldownCutoff\)\) exclude\.add/.test(generateRoute)
);
// The predicate itself: permanence beats the cooldown, at runtime.
check("F5 do_not_call never resurfaces", !resurfacesIntoFreshBatchProbe("do_not_call"));
check("F6 not_interested never resurfaces", !resurfacesIntoFreshBatchProbe("not_interested"));
check("F7 booked never resurfaces", !resurfacesIntoFreshBatchProbe("booked"));
check("F8 a cooled-down FRESH decline DOES resurface", resurfacesIntoFreshBatchProbe("fresh"));

// ── G · Schema + writer ──────────────────────────────────────────────────────
const schema = read("prisma/schema.prisma");
check("G1 Business has dialStatus defaulting to fresh", /dialStatus\s+String\s+@default\("fresh"\)/.test(schema));
check("G2 Business has dialStatusAt", /dialStatusAt\s+DateTime\?/.test(schema));
check("G3 DialStatusEvent history model exists", /model DialStatusEvent \{/.test(schema));
check(
  "G4 history table has no soft-delete (audit records are never removed)",
  !/model DialStatusEvent \{[\s\S]*?deletedAt[\s\S]*?\n\}/.test(schema),
  "a dial-status audit trail must not be deletable"
);
const lib = read("src/lib/dial-status.ts");
check(
  "G5 the writer records status AND appends an event together",
  /business\.update/.test(lib) && /dialStatusEvent\.create/.test(lib)
);

// ── H · The phone-first exception logger API ─────────────────────────────────
const logApi = read("src/app/api/dial-status/route.ts");
check("H1 logger enforces the irreversibility guard", /canSetFromUi/.test(logApi));
check(
  "H2 logger only sets the three exception statuses",
  /EXCEPTION_DIAL_STATUSES\.includes/.test(logApi),
  "fresh/dialed must never be set by hand"
);
check("H3 logger blocks a guarded change with 409", /status:\s*409/.test(logApi));
check("H4 logger writes through the shared recorder", /recordDialStatus\(/.test(logApi));
const logPage = read("src/app/(dashboard)/dial-status/page.tsx");
check(
  "H5 do_not_call takes two taps (armed → confirm)",
  /armedDnc/.test(logPage) && /Confirm — permanent/.test(logPage),
  "a permanent status must not be a single mis-tap"
);
check(
  "H6 the logger offers booked as its own action",
  /onSet\("booked"\)/.test(logPage),
  "bookings come through a GHL form, so booked must be settable here too"
);

// ── I · The booking disposition hook (the secondary path to booked) ──────────
const cq = read("src/app/api/call-queue/route.ts");
check(
  "I1 a BOOKED disposition also advances the dial axis",
  /marksBooked/.test(cq) && /dialStatus:\s*"booked"/.test(cq)
);
check(
  "I2 the booking hook never overrides do_not_call",
  /lead\.dialStatus !== "do_not_call"/.test(cq),
  "do_not_call is permanent — a booking must not silently revive it"
);

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-dial-status: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-dial-status: ${pass} assertions passed`);
