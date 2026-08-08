// THE TIMEZONE MAP IS LOAD-BEARING — this proves it, entry by entry.
//
//   node_modules/.bin/tsx scripts/verify-metros.ts
//   npm run verify:metros
//
// The whole calling strategy is "dial when it is a good LOCAL hour there". 11:00
// Toronto works because it is 08:00 in Los Angeles and 10:00 in Chicago. One
// wrong zone dials somebody's lunch hour every day for six months and never
// looks wrong on screen — the list is full, the names are real, the numbers
// connect. Nothing surfaces the mistake.
//
// So no entry is eyeballed. Each metro's zone is checked against the offsets its
// state or province is documented to keep, in BOTH January and July, which is
// what catches the DST traps (Arizona, Saskatchewan) — a wrong zone that happens
// to match in winter separates in summer.

import { METRO_TIMEZONES, timezoneForCity, metroCallTier, localHourInMetro } from "../src/lib/call-timing";
import { NA_METROS } from "../src/lib/crm";

let pass = 0;
const failures: string[] = [];
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

/** Actual UTC offset in hours for a zone on a given instant. Read from the
 *  runtime's own tz database, never from a table we maintain. */
function offsetHours(tz: string, iso: string): number {
  const d = new Date(iso);
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

const JAN = "2026-01-15T18:00:00Z"; // northern winter — standard time everywhere
const JUL = "2026-07-15T18:00:00Z"; // northern summer — DST where observed

/** [January offset, July offset] each region is documented to keep. */
const RULES: Record<string, [number, number]> = {
  eastern: [-5, -4],
  central: [-6, -5],
  mountain: [-7, -6],
  arizona: [-7, -7], // no DST
  pacific: [-8, -7],
  atlantic: [-4, -3], // Halifax
  saskatchewan: [-6, -6], // no DST
};

/** Which rule each ZONE must satisfy. Keyed by zone, not by metro, so adding a
 *  metro to an already-verified zone needs no new expectation. */
const ZONE_RULE: Record<string, keyof typeof RULES> = {
  "America/New_York": "eastern",
  "America/Indiana/Indianapolis": "eastern",
  "America/Toronto": "eastern",
  "America/Chicago": "central",
  "America/Winnipeg": "central",
  "America/Denver": "mountain",
  "America/Edmonton": "mountain",
  "America/Phoenix": "arizona",
  "America/Los_Angeles": "pacific",
  "America/Vancouver": "pacific",
  "America/Halifax": "atlantic",
  "America/Regina": "saskatchewan",
};

const metros = Object.keys(METRO_TIMEZONES);

// ── A · every zone is real and keeps the offsets its region keeps ────────────
{
  const zones = Array.from(new Set(Object.values(METRO_TIMEZONES)));
  for (const tz of zones) {
    // A zone the runtime does not ship throws here rather than silently
    // falling back to UTC, which would read as "everywhere is callable".
    let valid = true;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    } catch {
      valid = false;
    }
    check(`A1 ${tz} is a real IANA zone`, valid);
    if (!valid) continue;

    const rule = ZONE_RULE[tz];
    check(`A2 ${tz} has a documented expectation`, Boolean(rule),
      "add it to ZONE_RULE with the offsets its region keeps — an unchecked zone is an unchecked metro");
    if (!rule) continue;

    const [wantJan, wantJul] = RULES[rule];
    const gotJan = offsetHours(tz, JAN);
    const gotJul = offsetHours(tz, JUL);
    check(`A3 ${tz} January offset`, gotJan === wantJan, `got UTC${gotJan}, want UTC${wantJan} (${rule})`);
    check(`A4 ${tz} July offset`, gotJul === wantJul, `got UTC${gotJul}, want UTC${wantJul} (${rule})`);
  }
}

// ── B · the DST traps, asserted by name ──────────────────────────────────────
// These are the four that a plausible-looking "tidy-up" would break.
{
  const az = offsetHours("America/Phoenix", JAN) === offsetHours("America/Phoenix", JUL);
  check("B1 Arizona does not shift for DST", az, "Phoenix must be America/Phoenix, never America/Denver");
  const sk = offsetHours("America/Regina", JAN) === offsetHours("America/Regina", JUL);
  check("B2 Saskatchewan does not shift for DST", sk, "Regina/Saskatoon must be America/Regina");

  // In JULY, Arizona reads the same hour as Pacific — the exact coincidence that
  // makes a wrong Denver mapping look right for half the year.
  check("B3 Phoenix matches Pacific in summer (why the trap is a trap)",
    offsetHours("America/Phoenix", JUL) === offsetHours("America/Los_Angeles", JUL));
  check("B4 …and matches Mountain in winter",
    offsetHours("America/Phoenix", JAN) === offsetHours("America/Denver", JAN));

  check("B5 El Paso is Mountain, not Central", METRO_TIMEZONES["El Paso, TX"] === "America/Denver");
  check("B6 Pensacola is Central, not Eastern", METRO_TIMEZONES["Pensacola, FL"] === "America/Chicago");
  check("B7 Indianapolis uses its own zone", METRO_TIMEZONES["Indianapolis, IN"] === "America/Indiana/Indianapolis");
  check("B8 Nashville is Central", METRO_TIMEZONES["Nashville, TN"] === "America/Chicago");
  check("B9 Knoxville is Eastern (Tennessee is split)", METRO_TIMEZONES["Knoxville, TN"] === "America/New_York");
  check("B10 Halifax is Atlantic", METRO_TIMEZONES["Halifax, NS"] === "America/Halifax");
}

// ── C · short names are unique, because that is what gets stored ─────────────
// gatherProspects strips the state before persisting, so the row carries
// "Portland". Two Portlands and every lead in one of them gets the other's zone.
{
  const shorts = metros.map((m) => m.split(",")[0].trim().toLowerCase());
  const dupes = Array.from(new Set(shorts.filter((s, i) => shorts.indexOf(s) !== i)));
  check("C1 no two metros share a short name", dupes.length === 0, dupes.join(", "));

  // And every metro round-trips through the lookup the exporter actually calls.
  const broken = metros.filter((m) => timezoneForCity(m.split(",")[0]) !== METRO_TIMEZONES[m]);
  check("C2 every metro resolves through timezoneForCity", broken.length === 0, broken.join(", "));

  // An unknown city must return "" — a GUESSED zone in a dialer CSV is worse
  // than a blank one.
  check("C3 an unknown city resolves to blank, never a guess", timezoneForCity("Atlantis") === "");
}

// ── D · the rotation and the map are the same set ────────────────────────────
{
  check("D1 NA_METROS is derived from the map", NA_METROS.length === metros.length,
    `rotation ${NA_METROS.length} vs map ${metros.length}`);
  const missing = NA_METROS.filter((m) => !METRO_TIMEZONES[m]);
  check("D2 every metro in the rotation has a zone", missing.length === 0, missing.join(", "));
}

// ── E · the gate still behaves at the hours he actually dials ────────────────
// Not a restatement of the map: this runs the real tier function and asserts the
// windows he plans around are what the software will serve.
{
  const at = (etHour: number) => new Date(Date.UTC(2026, 6, 15, etHour + 4)); // July, EDT
  const callable = (d: Date) => metros.filter((m) => metroCallTier(m, d) > 0);

  const at11 = at(11);
  check("E1 at 11:00 ET, Los Angeles is 08:00 local", localHourInMetro("Los Angeles, CA", at11) === 8);
  check("E2 at 11:00 ET, Chicago is 10:00 local", localHourInMetro("Chicago, IL", at11) === 10);
  check("E3 at 11:00 ET, Toronto is 11:00 local", localHourInMetro("Toronto, ON", at11) === 11);
  // 11:00 ET is the widest window of the day — every metro EXCEPT Halifax, which
  // is Atlantic and therefore already at noon. The lunch gate correctly holds it
  // back. Asserted precisely rather than as "all of them": a check written to the
  // round number would have to be loosened the first time it was right, and a
  // loosened check is how the gate stops being checked at all.
  const out11 = metros.filter((m) => metroCallTier(m, at11) === 0);
  check("E4 at 11:00 ET only Halifax is held back (it is at lunch, Atlantic time)",
    out11.length === 1 && out11[0] === "Halifax, NS",
    `held back: ${out11.join(", ") || "(none)"}`);
  check("E4b …which is exactly local noon there", localHourInMetro("Halifax, NS", at11) === 12);

  // Nobody is dialled at 3am local, whatever the ET clock says.
  const at3am = at(3);
  const asleep = metros.filter((m) => metroCallTier(m, at3am) > 0);
  check("E5 at 03:00 ET nothing is callable", asleep.length === 0, asleep.slice(0, 4).join(", "));

  // And the lunch hour is excluded in each metro's OWN noon, not Toronto's.
  const noonPacific = at(15); // 15:00 ET = 12:00 PT
  check("E6 the lunch gate is local, not Eastern",
    metroCallTier("Los Angeles, CA", noonPacific) === 0 && metroCallTier("New York, NY", noonPacific) > 0,
    "LA should be at lunch while New York is not");
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-metros: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
const byZone = new Map<string, number>();
for (const tz of Object.values(METRO_TIMEZONES)) byZone.set(tz, (byZone.get(tz) ?? 0) + 1);
console.log(`✓ verify-metros: ${pass} assertions passed`);
console.log(`  ${metros.length} metros across ${byZone.size} verified zones`);
for (const [tz, n] of Array.from(byZone).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${tz}  (UTC${offsetHours(tz, JAN)} Jan / UTC${offsetHours(tz, JUL)} Jul)`);
}
